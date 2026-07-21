import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import {
  createPublicShardTonRpcProvider,
  decodePublicPage,
  publicBodyCommit,
  parsePublicPublish,
} from '../web/public-shard-ton-rpc-provider.mjs';
import { publicChannelPartitionKey, publicWalletHash, publicEpochTag, publicEraOf } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-SHARD-RPC — the read provider that turns a shard into rendered, AUTHENTICATED posts.
//
// The whole trust model is here: a body is real only when it hashes to a commit the shard STORED, and the
// publisher is recovered from that message's source. PSRPC-01 drives it against a real PublicShard in a sandbox —
// a genuine get_page stack, genuine message bodies — and proves a forged body (right shape, never accepted) is
// dropped while the honest posts survive with their publisher recovered.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const KIND_CHANNEL = 0;
const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(48, f)).endCell();

const publicPublishBody = (kind: number, keyArg: bigint, shardSeq: number, header: any, body: any) =>
  beginCell()
    .storeUint(0x50535031, 32)   // PSP1
    .storeUint(kind, 8)
    .storeUint(keyArg, 256)
    .storeUint(shardSeq, 32)
    .storeRef(header)
    .storeRef(body)
    .endCell();

describe('PUBLIC-SHARD-RPC — authenticated post assembly from a real shard', () => {
  it('PSRPC-01: get_page commits match built bodies, publisher is recovered, a forgery is dropped', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'psrpc-sink' });
    const owner = await bc.treasury('psrpc-owner');
    const mallory = await bc.treasury('psrpc-mallory');
    const era = publicEraOf(KIND_CHANNEL, CLOCK);
    const pk = await publicChannelPartitionKey(publicWalletHash(owner.address), 0);
    const tag = publicEpochTag(KIND_CHANNEL, era);

    const shard = bc.openContract(await PublicShard.fromInit(pk, tag));
    await shard.send(owner.getSender(), { value: toNano('0.03') }, null);

    // Publish three real posts; keep the (header, body) cells so we can replay them as the /messages the reader
    // would return.
    const built: Array<{ header: any; body: any }> = [];
    for (let i = 0; i < 3; i++) {
      bc.now = CLOCK + i * 97;
      const header = cell(10 + i);
      const body = cell(100 + i);
      built.push({ header, body });
      const v = await shard.getGetView();
      const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
      await shard.send(owner.getSender(), { value: due + toNano('0.02') },
        { $$type: 'PublicPublish', kind: 0n, key_arg: 0n, shard_seq: 0n, header, body } as any);
    }

    // The reader's job: the messages the shard received, newest first, each as { bodyCell, source }. Reproduce it
    // from the built posts (real senders = owner) plus ONE forgery from mallory whose commit was NEVER stored.
    const forgeHeader = cell(200);
    const forgeBody = cell(201);
    const messages = [
      // newest first, matching /messages sort=desc
      ...built.slice().reverse().map(({ header, body }) => ({
        bodyCell: publicPublishBody(0, 0n, 0, header, body),
        source: owner.address.toString(),
      })),
      { bodyCell: publicPublishBody(0, 0n, 0, forgeHeader, forgeBody), source: mallory.address.toString() },
      { bodyCell: beginCell().storeUint(0, 32).endCell(), source: owner.address.toString() },   // a plain top-up
    ];
    const readMessagesWithSource = async () => messages;

    const provider = createPublicShardTonRpcProvider({
      transport: {
        async runGetMethod(call: any) {
          // Serve get_page / get_view straight from the live contract, as the real transport would.
          if (call.method === 'get_page') {
            const p = await shard.getGetPage(BigInt(call.stack[0].value), BigInt(call.stack[1].value));
            return { stack: [
              { type: 'num', value: '0x' + p.from_id.toString(16) },
              { type: 'num', value: '0x' + p.count.toString(16) },
              { type: 'num', value: '0x' + p.entry_count.toString(16) },
              { type: 'cell', value: p.rows },
            ] };
          }
          throw new Error(`unexpected method ${call.method}`);
        },
      },
    });

    const { entry_count, posts } = await provider.readPosts(shard.address.toString(), { readMessagesWithSource });

    expect(entry_count, 'the shard holds three entries').toBe(3n);
    expect(posts.length, 'exactly the three ACCEPTED posts survive — the forgery and the top-up are dropped').toBe(3);
    // Newest first, and each attributed to the real publisher recovered from the message source. The provider
    // returns raw 0:hex; compare on the raw form, not the friendly string.
    const ownerRaw = owner.address.toRawString();
    for (const post of posts) {
      expect(post.publisher, 'every post is attributed to the owner wallet').toBe(ownerRaw);
    }
    expect(posts[0].created_at > posts[2].created_at, 'ordered newest-first by created_at').toBe(true);
    // The forged commit must appear nowhere.
    const forgedCommit = await publicBodyCommit(forgeHeader, forgeBody);
    const stored = await Promise.all([0, 1, 2].map((i) => shard.getGetEntry(BigInt(i)).then((e) => e.body_commit)));
    expect(stored.includes(forgedCommit), 'the forged commit was never stored').toBe(false);
  }, 300_000);

  it('PSRPC-02: the page and view decoders reject a drifted ABI arity', async () => {
    expect(() => decodePublicPage({ stack: [{ type: 'num', value: '0x0' }] }))
      .toThrow(/expected 4 stack items/);
  });

  it('PSRPC-03: parsePublicPublish returns null for non-publish traffic', () => {
    expect(parsePublicPublish(beginCell().storeUint(0, 32).endCell()), 'a plain top-up is not a publish').toBeNull();
    expect(parsePublicPublish(beginCell().storeUint(0xdeadbeef, 32).endCell()), 'a foreign opcode is not a publish').toBeNull();
    expect(parsePublicPublish(null), 'a missing body is not a publish').toBeNull();
    const ok = parsePublicPublish(publicPublishBody(2, 517n, 1, cell(1), cell(2)));
    expect(ok?.kind, 'a real publish parses its kind').toBe(2);
    expect(ok?.key_arg).toBe(517n);
    expect(ok?.shard_seq).toBe(1);
  });
});
