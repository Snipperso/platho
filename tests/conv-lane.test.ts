import { describe, expect, it } from 'vitest';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  openPrivateCapsuleChainEntry,
} from '../web/crypto/platho-crypto.mjs';
import { outgoingRecordShard } from '../web/conv-discovery.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';


const kRoot = new Uint8Array(32).fill(0x5a);
const keyIdA = new Uint8Array(32).fill(0x11);
const keyIdB = new Uint8Array(32).fill(0x22);
const CREATED = 1_790_000_000;
const EPOCH = Math.floor(CREATED / 86400);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

describe('CONV-LANE (read assembly)', () => {
  it('CONV-LANE-01: A publishes; B reads its incoming shard, finds+verifies+opens A\'s capsule, drops junk+forgery', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const bBundle = exportPublicKeyBundle(B.encryptionKeyPair);

    const routeA = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const capsule = await createEncryptedConvCapsule('доставлено через RecordShard', bBundle, A, routeA.bucketKey, {});
    const good = await buildConvPublishWalletMessage({
      writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq: 1, epoch: routeA.epoch, capsule, value: CONV_PUBLISH_VALUE,
    });

    const forgedSecret = new Uint8Array(32).fill(0x99);
    const forgedCapsule = await createEncryptedConvCapsule('forgery', bBundle, A, routeA.bucketKey, {});
    const forged = await buildConvPublishWalletMessage({
      writePublicKey: ed25519.getPublicKey(forgedSecret), writeSecret: forgedSecret, seq: 2, epoch: routeA.epoch, capsule: forgedCapsule, value: CONV_PUBLISH_VALUE,
    });
    const junk = beginCell().uint(0xdeadbeefn, 32, 'op').uint(0n, 64, 'x').endCell();

    const byAddress = new Map<string, any[]>();
    byAddress.set(addrKey(good.to), [
      { bodyCell: onWire(good.body), source: null },
      { bodyCell: onWire(forged.body), source: null },
      { bodyCell: onWire(junk), source: null },
    ]);
    const lane = createConvReadLane({
      readMessagesWithSource: async (address: string) => byAddress.get(addrKey(address)) ?? [],
    });

    const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });

    expect(entries.length, 'exactly the one authentic capsule survives (junk + forgery dropped)').toBe(1);
    expect(addrKey(entries[0].address), 'it came from A\'s outgoing shard = B\'s incoming shard').toBe(addrKey(good.to));
    expect(entries[0].seq).toBe('1');

    const opened = await openPrivateCapsuleChainEntry(entries[0].entry, B.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext, 'B decrypts A\'s message').toBe('доставлено через RecordShard');
    expect(opened.openedAs).toBe('recipient');
  }, 120_000);

  it('CONV-PAGE-01: a shard that outran the 128-body window is paged BACK to the device\'s last whole read of it — and a real gap is said once', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const bBundle = exportPublicKeyBundle(B.encryptionKeyPair);
    const routeA = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const N = 700;
    const rows: Array<{ bodyCell: any; source: null; createdLt: string; createdAt: number; seq: number }> = [];
    for (let seq = 1; seq <= N; seq += 1) {
      const capsule = await createEncryptedConvCapsule(`msg ${seq}`, bBundle, A, routeA.bucketKey, {});
      const built = await buildConvPublishWalletMessage({
        writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq, epoch: routeA.epoch, capsule, value: CONV_PUBLISH_VALUE,
      });
      rows.push({ bodyCell: onWire(built.body), source: null, createdLt: String(1_000 + seq), createdAt: CREATED + seq * 120, seq });
    }
    const shardKey = addrKey(rows.length ? (await buildConvPublishWalletMessage({
      writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq: 1, epoch: routeA.epoch,
      capsule: await createEncryptedConvCapsule('addr', bBundle, A, routeA.bucketKey, {}), value: CONV_PUBLISH_VALUE,
    })).to : '');
    const reads: any[] = [];
    let visible = N;
    const readMessagesWithSource = async (address: string, options: any = {}) => {
      reads.push(options);
      if (addrKey(address) !== shardKey) return [];
      const endLt = options?.endLt == null ? null : BigInt(options.endLt);
      return rows.filter((r) => r.seq <= visible && (endLt === null || BigInt(r.createdLt) <= endLt)).sort((a, b) => b.seq - a.seq).slice(0, 128)
        .map(({ bodyCell, source, createdLt, createdAt }) => ({ bodyCell, source, createdLt, createdAt }));
    };
    let marker = 0;
    const states = () => new Map([[shardKey, { lastLt: String((marker += 1)) }]]);
    const lane = createConvReadLane({ readMessagesWithSource });
    const warns: any[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => { warns.push(args.join(' ')); };
    try {
      visible = 100;
      await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, states: states(), knownSeqOf: () => -1 });
      visible = N;
      reads.length = 0;
      const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, states: states(), knownSeqOf: () => 100 });
      const seqs = new Set(entries.map((e: any) => Number(e.seq)));
      for (let seq = 101; seq <= N; seq += 1) expect(seqs.has(seq), `seq ${seq} must be readable — it was never read before`).toBe(true);
      expect(reads.filter((o) => o?.endLt != null).length, 'four older pages: 445.., 317.., 189.., 61..').toBe(4);
      expect(lane.shardReadStats().pagedBack, 'counted').toBe(4);
      expect(warns, 'the window was closed, so nothing to say').toEqual([]);

      const fresh = createConvReadLane({ readMessagesWithSource });
      reads.length = 0;
      await fresh.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => 10 });
      expect(warns.length, 'one honest line').toBe(1);
      expect(warns[0]).toMatch(/outran the reader/);
      await fresh.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => 10 });
      expect(warns.length, 'not a line per pass').toBe(1);

      reads.length = 0;
      const plain = await fresh.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
      expect(plain.length, 'the newest 128').toBe(128);
      expect(reads.filter((o) => o?.endLt != null).length).toBe(0);

      reads.length = 0;
      const warnsBefore = warns.length;
      const cold = await fresh.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => -1 });
      expect(cold.length, 'the newest window and four older pages: seq 61..700').toBe(640);
      expect(reads.filter((o) => o?.endLt != null).length, 'a full window with no mark is paged, to the cap').toBe(4);
      expect(warns.length, 'said once per shard, and it was said already').toBe(warnsBefore);
    } finally {
      console.warn = origWarn;
    }
  }, 300_000);

  it('CONV-LANE-02: a conversation with no published messages reads back empty (clean, not an error)', async () => {
    const lane = createConvReadLane({ readMessagesWithSource: async () => [] });
    const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
    expect(entries).toEqual([]);
  });
});

describe('CONV-LANE — the change-marker gate', () => {
  const window = { kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 };

  function countingLane(bodiesByAddress = new Map<string, any[]>()) {
    const reads: string[] = [];
    const lane = createConvReadLane({
      verifyWriteSig: false,
      readMessagesWithSource: async (address: string) => {
        reads.push(addrKey(address));
        return bodiesByAddress.get(addrKey(address)) ?? [];
      },
    });
    return { lane, reads };
  }

  const statesFor = (addresses: string[], lt: string) =>
    new Map(addresses.map((address) => [addrKey(address), { address, status: 'active', lastLt: lt } as any]));

  it('CONV-MARK-01: an unchanged shard is read ONCE, then skipped — and a moved marker re-reads it', async () => {
    const { lane, reads } = countingLane();
    const shards = await (await import('../web/conv-discovery.mjs')).incomingRecordShards(window as any);
    const addresses = shards.map((s: any) => s.address);

    await lane.readIncoming({ ...window, shards, states: statesFor(addresses, '100') });
    expect(reads.length, 'first pass reads the whole window — nothing is known yet').toBe(addresses.length);

    reads.length = 0;
    await lane.readIncoming({ ...window, shards, states: statesFor(addresses, '100') });
    expect(reads, 'second pass at the same marker: not one history request').toEqual([]);

    reads.length = 0;
    await lane.readIncoming({ ...window, shards, states: statesFor(addresses, '101') });
    expect(reads.length, 'the marker moved — every shard is read again').toBe(addresses.length);
  }, 120_000);

  it('CONV-MARK-02: a shard the indexer has never seen costs nothing, and no states at all reads everything', async () => {
    const { lane, reads } = countingLane();
    const shards = await (await import('../web/conv-discovery.mjs')).incomingRecordShards(window as any);

    await lane.readIncoming({ ...window, shards, states: new Map() });
    expect(reads, 'an empty state map is an ANSWER: none of these shards was ever written to').toEqual([]);

    reads.length = 0;
    await lane.readIncoming({ ...window, shards });
    expect(reads.length, 'without a state probe the lane reads every shard, exactly as it always did').toBe(shards.length);
  }, 120_000);

  it('CONV-MARK-03: a FAILED history read leaves no mark — the next pass tries again', async () => {
    const reads: string[] = [];
    let failing = true;
    const lane = createConvReadLane({
      verifyWriteSig: false,
      readMessagesWithSource: async (address: string) => {
        reads.push(addrKey(address));
        if (failing) throw new Error('transient');
        return [];
      },
    });
    const shards = await (await import('../web/conv-discovery.mjs')).incomingRecordShards(window as any);
    const states = statesFor(shards.map((s: any) => s.address), '100');

    await lane.readIncoming({ ...window, shards, states });
    expect(reads.length).toBe(shards.length);

    failing = false;
    reads.length = 0;
    await lane.readIncoming({ ...window, shards, states });
    expect(reads.length, 'the same unchanged marker, but nothing was ever read from it').toBe(shards.length);
  }, 120_000);

  it('CONV-MARK-05: a row with no lt and no data hash is UNKNOWN — read every time, never marked', async () => {
    const { lane, reads } = countingLane();
    const shards = await (await import('../web/conv-discovery.mjs')).incomingRecordShards(window as any);
    const blank = new Map(shards.map((s: any) => [addrKey(s.address), { address: s.address, status: 'active' } as any]));

    await lane.readIncoming({ ...window, shards, states: blank });
    expect(reads.length).toBe(shards.length);
    reads.length = 0;
    await lane.readIncoming({ ...window, shards, states: blank });
    expect(reads.length, 'still unknown, so still read — no mark was ever taken').toBe(shards.length);
  }, 120_000);

  it('CONV-MARK-04: forgetShard drops the mark, so a caller whose DECRYPT failed gets the bytes again', async () => {
    const { lane, reads } = countingLane();
    const shards = await (await import('../web/conv-discovery.mjs')).incomingRecordShards(window as any);
    const addresses = shards.map((s: any) => s.address);
    const states = statesFor(addresses, '100');

    await lane.readIncoming({ ...window, shards, states });
    reads.length = 0;
    await lane.readIncoming({ ...window, shards, states });
    expect(reads, 'skipped, as designed').toEqual([]);

    lane.forgetShard(addresses[0]);
    reads.length = 0;
    await lane.readIncoming({ ...window, shards, states });
    expect(reads, 'exactly the forgotten one comes back — the others stay skipped').toEqual([addrKey(addresses[0])]);
  }, 120_000);
});
