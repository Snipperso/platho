import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPublicLane } from '../web/public-lane.mjs';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell as coreCell } from '@ton/core';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { buildPublicPublishWalletMessage, publishPublicLaneParts } from '../web/public-lane-send.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { computeCellHashAndDepth, parseBocBase64, snakeCellFromBytes } from '../web/pwa-contract-transactions.mjs';
import { publicBeaconPartitionKey, publicChannelPartitionKey, publicWalletHash, publicEpochTag, publicEraOf, addrKey } from '../web/shard-discovery.mjs';
import { publicShardAddressBytesFor, rawAddress } from '../web/shard-address.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-LANE-SEND — the deploy figures the client attaches, and the wallet-message shape it builds.
//   * PLS-PRICE pins each kind's deploy figure against the LIVE get_view, so a contract endowment change is a red
//     test (loud) rather than a publish refused in production (silent) — the exact failure publish-price warns of.
//   * PLS-MSG proves the wallet message carries the built message unchanged (address/value/StateInit and a payload
//     whose bytes reproduce the body cell), so nothing is mangled between the pinned builder and the wallet send.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
// snakeCellFromBytes chunks into 127-byte cells, exactly as createPublicPostPayloadV2 builds real bodies — a naive
// one-cell helper would overflow the 1023-bit cell limit and produce an unparseable BoC.
const cellOf = (fill: number, len = 48) => snakeCellFromBytes(new Uint8Array(len).fill(fill), 'chunk');
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);

describe('PUBLIC-LANE-SEND', () => {
  it('PLS-PRICE: publicPublishValueForKind matches the live deploy_min_value for every kind', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const funder = await bc.treasury('pls-price');
    for (const kind of [0, 1, 2, 3]) {
      const era = publicEraOf(kind, CLOCK);
      const pk = kind === 2 ? await publicBeaconPartitionKey(1n) : BigInt(2000 + kind);
      const shard = bc.openContract(await PublicShard.fromInit(pk, publicEpochTag(kind, era)));
      await shard.send(funder.getSender(), { value: toNano('0.05') }, null);
      const view = await shard.getGetView();
      expect(publicPublishValueForKind(kind), `deploy figure for kind ${kind}`).toBe(view.deploy_min_value);
    }
  }, 120_000);

  it('PLS-MSG: the wallet message carries the built PublicPublish unchanged', async () => {
    const ownerHash = publicWalletHash('EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP');
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const header = cellOf(0x11);
    const body = cellOf(0x12, 200);

    const prepared = await buildPublicPublishWalletMessage({
      kind: 0, keyArg: 0n, header, body, value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK,
    });

    expect(prepared.message.address, 'destination is the built shard address').toBe(prepared.to);
    expect(prepared.message.amount, 'value is the deploy figure').toBe(publicPublishValueForKind(0));
    expect(prepared.message.stateInit, 'StateInit attached for lazy deploy').toBe(prepared.init);
    expect(prepared.message.bounce, 'bounceable so a refused publish returns funds').toBe(true);

    // the payload base64 must reproduce the exact body cell the builder produced
    const payloadCell = parseBocBase64(prepared.message.payload);
    expect(await hashOf(payloadCell), 'payload BoC == the built message body').toEqual(await hashOf(prepared.body));
  }, 60_000);
  it('SHARDSEQ-01: a full shard seq rolls to the next, and an untouched one is where a write belongs', async () => {
    // [audit 2026-09-01, round 9.] PublicShard refuses at PS_SAFE_CAP with throwUnless(13705,...) and its comment
    // says "Overflow is the client's job: it rolls shard_seq to a fresh account and readers probe
    // 0..PS_SEQ_PROBE-1". The READER probes four seqs; every WRITE site passed a literal 0, so the mechanism the
    // contract documents never ran once. A channel that reached PS_SAFE_CAP entries inside its era was refused for
    // the rest of it — 30 days for a channel, a year for a thread's comments — with no client signal beyond a
    // six-minute "failed".
    const CLOCK = 1_790_000_000;
    const counts = new Map<string, { entry: number; cap: number }>();
    const seen: string[] = [];
    const lane = createPublicLane({
      now: () => CLOCK,
      endpoint: 'https://x/api/v3/accountStates',
      fetch: async (urlStr: string) => {
        const url = new URL(urlStr);
        if (!url.pathname.endsWith('/accountStates')) throw new Error(`unexpected fetch ${urlStr}`);
        const accounts = url.searchParams.getAll('address')
          .filter((a) => counts.has(addrKey(a)))
          .map((a) => ({ address: addrKey(a), status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '1' }));
        return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
      },
      runGetMethod: async (call: any) => {
        seen.push(call.method);
        const held = counts.get(addrKey(call.address));
        const num = (v: bigint) => ({ type: 'num', value: '0x' + v.toString(16) });
        return { stack: [num(1n), num(0n), num(0n), num(0n), num(BigInt(held?.entry ?? 0)), num(BigInt(held?.cap ?? 4096)),
          num(0n), num(0n), num(0n), num(0n), num(0n), num(0n), num(0n)] };
      },
    });

    const walletHash = 12345n;
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const addressFor = async (seq: number) =>
      addrKey(rawAddress(await publicShardAddressBytesFor(17, await publicChannelPartitionKey(walletHash, seq), epochTag)));
    const partitionKeyOf = (seq: number) => publicChannelPartitionKey(walletHash, seq);

    // Nothing written anywhere: seq 0, and no getter runs at all — the batch alone answers it.
    expect(await lane.readWriteShardSeq({ kind: 0, partitionKeyOf, epochTag, need: 1 })).toBe(0);
    expect(seen, 'an untouched seq space costs no getter').toEqual([]);

    // Seq 0 at the cap: the write rolls to 1, which the reader already probes.
    counts.set(await addressFor(0), { entry: 4096, cap: 4096 });
    expect(await lane.readWriteShardSeq({ kind: 0, partitionKeyOf, epochTag, need: 1 })).toBe(1);

    // A seq with room for one but not for this multipart write rolls too — `need` is the whole message.
    counts.clear();
    counts.set(await addressFor(0), { entry: 4090, cap: 4096 });
    expect(await lane.readWriteShardSeq({ kind: 0, partitionKeyOf, epochTag, need: 4 })).toBe(0);
    expect(await lane.readWriteShardSeq({ kind: 0, partitionKeyOf, epochTag, need: 8 })).toBe(1);

    // Every probed seq full: null, and the caller writes to 0 rather than refusing to publish.
    counts.clear();
    for (let seq = 0; seq < 4; seq += 1) counts.set(await addressFor(seq), { entry: 4096, cap: 4096 });
    expect(await lane.readWriteShardSeq({ kind: 0, partitionKeyOf, epochTag, need: 1 })).toBeNull();
  });

  it('SHARDSEQ-02: no write site hardwires shard seq 0 any more', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(code, 'the channel write must resolve its seq').not.toContain('publicChannelPartitionKey(walletHash, 0)');
    expect(code, 'and so must the thread write').not.toContain('publicThreadPartitionKey(postUid, 0)');
    expect(code).toContain('publicChannelPartitionKey(walletHash, channelShardSeq)');
    expect(code).toContain('publicThreadPartitionKey(postUid, threadShardSeq)');
    // An unreadable probe must fall back to seq 0 WITH the halves rather than refuse: a bad minute on the network may
    // not cost a post, and seq 0 with the StateInit attached is the shape that lands on an empty and a live shard alike.
    const resolver = code.slice(code.indexOf('async function resolvePublicWriteShard('));
    expect(resolver.slice(0, 900)).toContain('return { seq: 0, live: false };');
    // THE HALVES RIDE ONCE, AND ONLY WHEN THE SHARD MAY NOT EXIST [audit 2026-09-05, round 1]: every write site hands
    // the funnel what the probe learned about the shard, and the funnel attaches the StateInit to the first part alone
    // unless the shard was read live. Before this every part of every post carried the shard's code (1.13M nanoton a
    // part on generation 17, twice 2.53M through the vault door on 18).
    expect(code).toContain('shardLive: channelShard.live');
    expect(code).toContain('shardLive: threadShard.live');
    expect(code).toContain('shardLive: profileShard.live');
    const funnel = readFileSync('web/public-lane-send.mjs', 'utf8');
    expect(funnel).toContain('const attachStateInit = !deploying.has(shardKey) && part.shardLive !== true;');
    expect(funnel).toContain('stateInit: attachStateInit ? built.init : null,');
    // and the routed builder's DIRECT verdict returns a message that honours the same flag [round 2]
    expect(funnel).toContain('kind, keyArg, shardSeq, header, body, value, partitionKey, epochTag, nowUnix, boundary, attachStateInit,');
  });

  it('SHARDSEQ-04: the halves ride once PER SHARD of a transfer — a channel part and a beacon part both deploy, a second part to the same shard does not', async () => {
    // [audit 2026-09-05, round 2] "first part only" left the profile save's BEACON part (a different shard, index 1)
    // without its StateInit: a first announcement into an unwritten bucket-era bounced while the screen said saved.
    const ownerHash = publicWalletHash('EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP');
    const channelPk = await publicChannelPartitionKey(ownerHash, 0);
    const channelTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const beaconPk = await publicBeaconPartitionKey(7n);
    const beaconTag = publicEpochTag(2, publicEraOf(2, CLOCK));
    const sent: any[] = [];
    const wallet = { address: 'EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP' };
    const parts = [
      { kind: 0, keyArg: 0n, header: cellOf(0x11), body: cellOf(0x12, 200), value: publicPublishValueForKind(0), partitionKey: channelPk, epochTag: channelTag, nowUnix: CLOCK },
      { kind: 2, keyArg: 7n, header: cellOf(0x11), body: cellOf(0x12, 200), value: publicPublishValueForKind(2), partitionKey: beaconPk, epochTag: beaconTag, nowUnix: CLOCK },
      { kind: 0, keyArg: 0n, header: cellOf(0x13), body: cellOf(0x14, 200), value: publicPublishValueForKind(0), partitionKey: channelPk, epochTag: channelTag, nowUnix: CLOCK },
    ];
    const { parts: prepared } = await publishPublicLaneParts({ wallet, transport: null }, parts, {
      shardDebt: async (address: string, lane: string) => ({ cushion: 0n, debt: 0n, status: 'nonexist' }),
      // the wallet is a stub: what matters is what was PREPARED
      send: async (_w: any, tx: any) => { sent.push(tx); return { ok: true }; },
    } as any).catch((error: any) => ({ parts: error?.preparedParts ?? null, error }));
    expect(prepared, 'the funnel prepared its parts').toBeTruthy();
    expect(prepared[0].message.stateInit, 'the channel shard: deployed by its first part').toBe(prepared[0].init);
    expect(prepared[1].message.stateInit, 'the BEACON shard is another account: its first part deploys it too').toBe(prepared[1].init);
    expect(prepared[2].message.stateInit, 'a second part to the channel shard follows the first').toBeNull();
    // and a part whose shard the caller read as live carries none
    const { parts: live } = await publishPublicLaneParts({ wallet, transport: null }, [{ ...parts[0], shardLive: true }], {
      shardDebt: async () => ({ cushion: 0n, debt: 0n, status: 'active' }), send: async () => ({ ok: true }),
    } as any).catch((error: any) => ({ parts: error?.preparedParts ?? null }));
    expect(live[0].message.stateInit).toBeNull();
  });

  it('SHARDSEQ-03: a part for a LIVE shard leaves the StateInit off, a deploying one carries it', async () => {
    const ownerHash = publicWalletHash('EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP');
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const args = { kind: 0, keyArg: 0n, header: cellOf(0x11), body: cellOf(0x12, 200), value: publicPublishValueForKind(0), partitionKey, epochTag, nowUnix: CLOCK };
    const deploying = await buildPublicPublishWalletMessage(args);
    const live = await buildPublicPublishWalletMessage({ ...args, attachStateInit: false });
    expect(deploying.message.stateInit).toBe(deploying.init);
    expect(live.message.stateInit, 'no halves for a shard that exists').toBeNull();
    expect(live.init, 'the StateInit is still derived — the address depends on it').toBe(live.init);
    expect(live.to).toBe(deploying.to);
    expect(live.message.payload).toBe(deploying.message.payload);
  });
});
