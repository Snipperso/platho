import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, beginCell, toNano, Cell } from '@ton/core';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { buildPublicPublish } from '../web/publish-builder.mjs';
import { buildPublicPublishBrowser } from '../web/public-publish-browser.mjs';
import { computeCellHashAndDepth, serializeBoc, beginCell as clientCell } from '../web/pwa-contract-transactions.mjs';
import {
  publicChannelPartitionKey,
  publicThreadPartitionKey,
  publicBeaconPartitionKey,
  publicAvatarPartitionKey,
  publicPostUid,
  publicWalletHash,
  publicEpochTag,
  publicEraOf,
} from '../web/shard-discovery.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-PUBLISH-BROWSER — the browser sends the same PublicPublish, or the money is spent and nothing renders.
//
// Two silent failure modes, exactly the intro lane's:
//   - StateInit missing/wrong: PublicShards deploy lazily, so the first publish lands on an uninitialised account,
//     runs with its compute phase SKIPPED, and vanishes — no bounce, wallet reports success.
//   - Body layout off by anything: the contract recomputes body_commit from the (header, body) cells it receives
//     and stores only that; the reader re-derives it to authenticate the post. A near-miss stores a commit no read
//     matches — a post paid for and unreadable.
// Neither is visible without comparing against the @ton/core reference, then sending the browser-built message to
// a real PublicShard. Covered across all four kinds because the message's `kind`/`key_arg` differ per lane.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const KIND = { CHANNEL: 0, THREAD: 1, BEACON: 2, AVATAR: 3 } as const;
// a valid friendly address to hash for the CHANNEL/AVATAR owner in the parity test (PUB-01 only needs both
// builders to receive the SAME partition_key; the real senderHash check is PUB-02 against the chain).
const OWNER_FRIENDLY = 'EQCpZjky6GPpte-242B_1Hw-Py1lcPcUZk63p6bvzsXQUHy-';

/** Capsule cells built with the CLIENT's primitives — where they come from in production. A cell holds 1023 bits,
 *  so anything larger is a snake of chained cells, exactly as real bodies are. Mirrors intro-publish-browser. */
const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = clientCell().bytesValue(chunks[chunks.length - 1], chunks[chunks.length - 1].length, 'chunk').endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) {
    cell = clientCell().bytesValue(chunks[i], chunks[i].length, 'chunk').ref(cell, 'next').endCell();
  }
  return cell;
};

const asCore = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));

describe('PUBLIC-PUBLISH-BROWSER — the same PublicPublish, built without @ton/core', () => {
  it('PUB-01: address, body, StateInit and commit are identical to the reference builder, all four kinds', async () => {
    const ownerHash = publicWalletHash(OWNER_FRIENDLY);
    const channelPk = await publicChannelPartitionKey(ownerHash, 0);
    const channelTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, CLOCK));
    const postUid = await publicPostUid(channelPk, channelTag, 7n);

    const cases = [
      { name: 'channel', kind: KIND.CHANNEL, keyArg: 0n,
        partitionKey: channelPk, epochTag: channelTag, header: cellOf(0x11), body: cellOf(0x12, 200) },
      { name: 'thread', kind: KIND.THREAD, keyArg: postUid,
        partitionKey: await publicThreadPartitionKey(postUid, 0), epochTag: publicEpochTag(KIND.THREAD, publicEraOf(KIND.THREAD, CLOCK)),
        header: cellOf(0x21), body: cellOf(0x22, 40) },
      { name: 'beacon', kind: KIND.BEACON, keyArg: 5n,
        partitionKey: await publicBeaconPartitionKey(5n), epochTag: publicEpochTag(KIND.BEACON, publicEraOf(KIND.BEACON, CLOCK)),
        header: cellOf(0x31, 1), body: cellOf(0x32, 700) },
      { name: 'avatar', kind: KIND.AVATAR, keyArg: 0n,
        partitionKey: await publicAvatarPartitionKey(ownerHash), epochTag: publicEpochTag(KIND.AVATAR, publicEraOf(KIND.AVATAR, CLOCK)),
        header: cellOf(0x41), body: cellOf(0x42, 1) },
    ];

    for (const c of cases) {
      const reference = await buildPublicPublish({
        kind: c.kind, keyArg: c.keyArg, shardSeq: 0, header: asCore(c.header), body: asCore(c.body),
        value: toNano('0.05'), partitionKey: c.partitionKey, epochTag: c.epochTag,
      });
      const browser = await buildPublicPublishBrowser({
        kind: c.kind, keyArg: c.keyArg, shardSeq: 0, header: c.header, body: c.body,
        value: toNano('0.05'), partitionKey: c.partitionKey, epochTag: c.epochTag,
      });

      expect(browser.to, `destination for ${c.name}`).toBe(reference.to.toRawString());
      expect(await hashOf(browser.body), `the message body for ${c.name}`).toEqual(reference.body.hash());
      const referenceInit = beginCell()
        .storeUint(0, 1).storeUint(0, 1).storeUint(1, 1).storeUint(1, 1).storeUint(0, 1)
        .storeRef((reference.init as any).code)
        .storeRef((reference.init as any).data)
        .endCell();
      expect(await hashOf(browser.init), `the StateInit for ${c.name}`).toEqual(referenceInit.hash());
      expect(browser.commit, `the commit for ${c.name}`).toBe((reference as any).commit);
    }
  }, 240_000);

  it('PUB-02: a browser-built channel publish is ACCEPTED by the real contract and stores the right entry', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = CLOCK;
    await deployFeeSink(blockchain, { funderSeed: 'pub-browser-sink' });
    const payer = await blockchain.treasury('pub-browser-channel');

    const ownerHash = publicWalletHash(payer.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, blockchain.now));
    const built = await buildPublicPublishBrowser({
      kind: KIND.CHANNEL, keyArg: 0n, header: cellOf(0x55), body: cellOf(0x56, 256),
      value: toNano('0.1'), partitionKey, epochTag,
    });

    const dest = Address.parseRaw(built.to);
    const res = await payer.send({
      to: dest,
      value: built.value,
      body: toCoreCell(built.body),
      init: { code: toCoreCell(built.init).refs[0], data: toCoreCell(built.init).refs[1] },
      bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the contract accepted it').toBe(0);

    const shard = blockchain.openContract(PublicShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.entry_count, 'it created the shard and counted one entry').toBe(1n);

    const entry = await shard.getGetEntry(0n);
    expect(entry.exists, 'the entry exists').toBe(true);
    expect(entry.body_commit, 'commit stored by the contract == commit the browser computed').toBe(built.commit);
    expect(entry.publisher.toString(), 'attributed to the channel wallet').toBe(payer.address.toString());
  }, 240_000);

  it('PUB-03: without the StateInit the same message is silently lost — why attaching it is not optional', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = CLOCK;
    const payer = await blockchain.treasury('pub-noinit');

    const ownerHash = publicWalletHash(payer.address.toString());
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(KIND.CHANNEL, publicEraOf(KIND.CHANNEL, blockchain.now));
    const built = await buildPublicPublishBrowser({
      kind: KIND.CHANNEL, keyArg: 0n, header: cellOf(1), body: cellOf(2), value: toNano('0.1'), partitionKey, epochTag,
    });
    const dest = Address.parseRaw(built.to);
    const res = await payer.send({ to: dest, value: built.value, body: toCoreCell(built.body), bounce: false } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    // No exit code at all: the account does not exist, so the compute phase never ran. Nothing failed visibly.
    expect(tx?.description?.computePhase?.exitCode ?? null, 'no error is reported').toBeNull();

    const account = await blockchain.getContract(dest);
    expect((account.accountState as any)?.type ?? 'uninit', 'and no shard was created').not.toBe('active');
  }, 180_000);
});
