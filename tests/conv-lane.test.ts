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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-LANE — the read assembly, end-to-end against a STUB transport: A publishes into its outgoing RecordShard, B
// scans that same shard as "incoming" (the conv-discovery invariant), and the lane returns exactly A's capsule —
// verified under the conversation write key and openable to B's plaintext — while junk and a forged-signature body at
// the same address are dropped. If the assembly wired the wrong direction or skipped the write-sig gate, B would read
// nothing (silent loss) or accept a forgery. Runs with no chain, the way public-lane/intro-lane tests do.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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

    // A publishes into its outgoing direction (A=self, B=peer).
    const routeA = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const capsule = await createEncryptedConvCapsule('доставлено через RecordShard', bBundle, A, routeA.bucketKey, {});
    const good = await buildConvPublishWalletMessage({
      writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq: 1, epoch: routeA.epoch, capsule, value: CONV_PUBLISH_VALUE,
    });

    // A FORGED body: a structurally-valid CapsulePublish signed by a DIFFERENT write secret, dumped at the same shard
    // address (anyone can send a message there). Its write sig must fail under A's write pubkey.
    const forgedSecret = new Uint8Array(32).fill(0x99);
    const forgedCapsule = await createEncryptedConvCapsule('forgery', bBundle, A, routeA.bucketKey, {});
    const forged = await buildConvPublishWalletMessage({
      writePublicKey: ed25519.getPublicKey(forgedSecret), writeSecret: forgedSecret, seq: 2, epoch: routeA.epoch, capsule: forgedCapsule, value: CONV_PUBLISH_VALUE,
    });
    const junk = beginCell().uint(0xdeadbeefn, 32, 'op').uint(0n, 64, 'x').endCell();

    // Stub transport: A's shard address holds the good body + a forged body + junk; every other address is empty.
    const byAddress = new Map<string, any[]>();
    byAddress.set(addrKey(good.to), [
      { bodyCell: onWire(good.body), source: null },
      { bodyCell: onWire(forged.body), source: null },
      { bodyCell: onWire(junk), source: null },
    ]);
    const lane = createConvReadLane({
      readMessagesWithSource: async (address: string) => byAddress.get(addrKey(address)) ?? [],
    });

    // B receives (B=self, A=peer), scanning a window that covers the epoch.
    const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });

    expect(entries.length, 'exactly the one authentic capsule survives (junk + forgery dropped)').toBe(1);
    expect(addrKey(entries[0].address), 'it came from A\'s outgoing shard = B\'s incoming shard').toBe(addrKey(good.to));
    expect(entries[0].seq).toBe('1');

    const opened = await openPrivateCapsuleChainEntry(entries[0].entry, B.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext, 'B decrypts A\'s message').toBe('доставлено через RecordShard');
    expect(opened.openedAs).toBe('recipient');
  }, 120_000);

  it('CONV-PAGE-01: a shard that outran the 128-body window is paged BACK to what the device already holds — and a real gap is said once', async () => {
    // MEASURED 2026-08-21 on the owner's incoming shards: 159, 213, 371, 2156 and 3968 capsules in one direction-epoch,
    // single senders, thousands in minutes. The reader took the newest 128 bodies, the app's high-water jumped to the
    // top, and every body between the mark and the window was lost without a word — except fifteen "page cap" lines
    // every twelve seconds, one per shard, saying the same thing forever.
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const bBundle = exportPublicKeyBundle(B.encryptionKeyPair);
    const routeA = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const N = 700;
    const rows: Array<{ bodyCell: any; source: null; createdLt: string; seq: number }> = [];
    for (let seq = 1; seq <= N; seq += 1) {
      const capsule = await createEncryptedConvCapsule(`msg ${seq}`, bBundle, A, routeA.bucketKey, {});
      const built = await buildConvPublishWalletMessage({
        writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq, epoch: routeA.epoch, capsule, value: CONV_PUBLISH_VALUE,
      });
      rows.push({ bodyCell: onWire(built.body), source: null, createdLt: String(1_000 + seq), seq });
    }
    const shardKey = addrKey(rows.length ? (await buildConvPublishWalletMessage({
      writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq: 1, epoch: routeA.epoch,
      capsule: await createEncryptedConvCapsule('addr', bBundle, A, routeA.bucketKey, {}), value: CONV_PUBLISH_VALUE,
    })).to : '');
    // toncenter-shaped: newest first, 128 per call, `end_lt` honoured (MEASURED).
    const reads: any[] = [];
    const readMessagesWithSource = async (address: string, options: any = {}) => {
      reads.push(options);
      if (addrKey(address) !== shardKey) return [];
      const endLt = options?.endLt == null ? null : BigInt(options.endLt);
      return rows.filter((r) => endLt === null || BigInt(r.createdLt) <= endLt).sort((a, b) => b.seq - a.seq).slice(0, 128)
        .map(({ bodyCell, source, createdLt }) => ({ bodyCell, source, createdLt }));
    };
    const lane = createConvReadLane({ readMessagesWithSource });
    const warns: any[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => { warns.push(args.join(' ')); };
    try {
      // The device holds up to seq 100. The newest window (573..700) does not reach it: page back until it does.
      reads.length = 0;
      const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => 100 });
      const seqs = new Set(entries.map((e: any) => Number(e.seq)));
      for (let seq = 101; seq <= N; seq += 1) expect(seqs.has(seq), `seq ${seq} must be readable — it was never read before`).toBe(true);
      expect(reads.filter((o) => o?.endLt != null).length, 'four older pages: 445.., 317.., 189.., 61..').toBe(4);
      expect(lane.shardReadStats().pagedBack, 'counted').toBe(4);
      expect(warns, 'the window was closed, so nothing to say').toEqual([]);

      // The device holds almost nothing (seq 10): the cap stops paging at seq 61 — a REAL gap, said ONCE.
      reads.length = 0;
      await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => 10 });
      expect(warns.length, 'one honest line').toBe(1);
      expect(warns[0]).toMatch(/outran the reader/);
      await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => 10 });
      expect(warns.length, 'not a line per pass').toBe(1);

      // No mark from the caller: the window is read as before, nothing is paged, nothing is said.
      reads.length = 0;
      const plain = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
      expect(plain.length, 'the newest 128').toBe(128);
      expect(reads.filter((o) => o?.endLt != null).length).toBe(0);

      // A COLD shard (mark -1: nothing held from it — a fresh device, a deleted dialog) is not a gap: the newest
      // window, no paging, no line. OBSERVED 2026-08-21 on the owner's reload: "bodies between seq -1 and 3694" on a
      // farm-bot shard — five pages of spam decrypted per shard per reload for nothing.
      reads.length = 0;
      const warnsBefore = warns.length;
      const cold = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2, knownSeqOf: () => -1 });
      expect(cold.length, 'the newest 128, as a cold start always read').toBe(128);
      expect(reads.filter((o) => o?.endLt != null).length, 'no paging for a shard with no mark').toBe(0);
      expect(warns.length, 'and nothing said').toBe(warnsBefore);
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE CHANGE-MARKER GATE — a quiet conversation must cost NO history reads, and a message must never be the price.
//
// MEASURED 2026-08-04: one conversation, nothing new, and every pass still fetched all three window epochs — three
// sequential requests, every 12 seconds, to learn nothing. At N conversations it is 3N and the pass stops fitting
// between ticks. `last_transaction_lt` answers "did anyone write here" out of a batch the pass makes anyway.
//
// Every test below is about the DANGEROUS direction: a gate that skips a shard it should have read loses messages
// silently, which is the one failure this lane exists to prevent.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('CONV-LANE — the change-marker gate', () => {
  const window = { kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 };

  /** A lane over a stub that records which addresses were actually asked for. */
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

  /** The state map readAccountStates hands back: only addresses the indexer has seen appear at all. */
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

    // toncenter omits an address it has never seen: no row means no history to read.
    await lane.readIncoming({ ...window, shards, states: new Map() });
    expect(reads, 'an empty state map is an ANSWER: none of these shards was ever written to').toEqual([]);

    // No states argument is NOT that answer — it is "nobody asked", and the lane must fall back to reading.
    reads.length = 0;
    await lane.readIncoming({ ...window, shards });
    expect(reads.length, 'without a state probe the lane reads every shard, exactly as it always did').toBe(shards.length);
  }, 120_000);

  it('CONV-MARK-03: a FAILED history read leaves no mark — the next pass tries again', async () => {
    // The dangerous direction. A read that threw returned nothing; marking it would declare the shard handled and
    // skip it until somebody writes to it again, i.e. permanently lose whatever was in it.
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
    // changeMarkerOf would still return a string for such a row ("null"), and a CONSTANT marker is the worst
    // possible one: it matches itself on the next pass and silences the shard permanently.
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
    // The lane only knows the bytes arrived. The app decrypts them, and a capsule that failed to open for a
    // transient reason has to come back — but the shard's marker has not moved, so only this can bring it back.
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
