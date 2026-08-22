import { describe, expect, it } from 'vitest';
import { incomingRecordShards, outgoingRecordShard, outgoingRecordShards, selfRecoveryShard } from '../web/conv-discovery.mjs';
import { addrKey, recoveryOwnerSlotKey } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-DISCOVERY — A writes into exactly the shard B reads. The delivery correctness of the sharded CONV lane.
//
// Both parties derive the same bucketKey from the shared K_root and the pair's key-ids (A's outgoing direction ==
// B's incoming direction), and a RecordShard address is a pure function of (bucketKey, epoch). So a message A
// publishes lands at the address B computes locally as "incoming" — no directory, no lookup. If this failed,
// messages would be published where the recipient never looks.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const kRoot = new Uint8Array(32).fill(0x5a);          // a shared per-pair root (the real one is HKDF from the KEM)
const keyIdA = new Uint8Array(32).fill(0x11);
const keyIdB = new Uint8Array(32).fill(0x22);
const CREATED = 1_700_000_000;
const EPOCH = Math.floor(CREATED / 86400);

describe('CONV-DISCOVERY — A publishes where B reads', () => {
  it('CONV-DISC-01: A\'s outgoing RecordShard is among B\'s incoming RecordShards for the same epoch', async () => {
    // A publishes (A=self, B=peer)
    const aOut = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    // B receives (B=self, A=peer), scanning a window that covers the epoch
    const bIn = await incomingRecordShards({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });

    const bAddrs = new Set(bIn.map((x) => addrKey(x.address)));
    expect(bAddrs.has(addrKey(aOut.address)), 'A publishes into a shard B reads').toBe(true);
    // and it is the entry for exactly A's epoch
    const match = bIn.find((x) => addrKey(x.address) === addrKey(aOut.address));
    expect(match?.epoch).toBe(aOut.epoch);
  });

  it('CONV-DISC-02: the reverse direction is DISTINCT — B->A does not collide with A->B', async () => {
    const aToB = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const bToA = await outgoingRecordShard({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, createdAtSec: CREATED });
    // directional buckets: the two directions of the same pair land in different shards (dir byte differs)
    expect(addrKey(aToB.address)).not.toBe(addrKey(bToA.address));
    expect(aToB.dir).not.toBe(bToA.dir);
  });

  it('CONV-DISC-03: derivation is deterministic — same inputs give the same shard address', async () => {
    const a = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const b = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    expect(addrKey(a.address)).toBe(addrKey(b.address));
  });

  it('CONV-DISC-04: the self-recovery shard is deterministic AND commits to the owner key (squat-close binding)', async () => {
    const seed = new Uint8Array(32).fill(0x99);
    const r1 = await selfRecoveryShard(seed, 0);
    const r2 = await selfRecoveryShard(seed, 0);
    expect(addrKey(r1.address)).toBe(addrKey(r2.address));
    // the slot IS the owner key: self_bucket_key == H(RS_SLOT_DOMAIN ‖ owner_pubkey). This is exactly what makes the
    // slot bindable only by the seed-holder (gate 13575) — a reinstalled client re-derives the same owner key and
    // finds its slot in one lookup, but no one else can name it.
    expect(r1.slotKey).toBe(await recoveryOwnerSlotKey(r1.ownerPublicKey, 0));
    // a different seed -> a different owner key -> a different recovery shard
    const other = await selfRecoveryShard(new Uint8Array(32).fill(0x98), 0);
    expect(addrKey(r1.address)).not.toBe(addrKey(other.address));
    expect(r1.slotKey).not.toBe(other.slotKey);
  });

  it('CONV-DISC-05: A\'s OUTGOING window is exactly B\'s INCOMING window — a restore reads its own side from the same shards it wrote', async () => {
    // [OWNER 2026-08-22, restored device: "only the peer's replies synced, mine did not".] The private sync now reads
    // both sides of a conversation. Its own side is the OUTGOING window: per epoch, the shard outgoingRecordShard
    // wrote into — which is, bucket for bucket, what the peer scans as incoming. Address, epoch and write key agree.
    const mine = await outgoingRecordShards({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, epochNow: EPOCH, windowW: 2 });
    const theirs = await incomingRecordShards({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
    expect(mine.map((s) => s.epoch)).toEqual([EPOCH - 2, EPOCH - 1, EPOCH]);
    expect(mine.map((s) => addrKey(s.address))).toEqual(theirs.map((s) => addrKey(s.address)));
    expect(mine.map((s) => Buffer.from(s.writePublicKey).toString('hex'))).toEqual(theirs.map((s) => Buffer.from(s.writePublicKey).toString('hex')));
    // And the per-send derivation for a message stamped in the window lands in one of them.
    const sent = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    expect(mine.map((s) => addrKey(s.address))).toContain(addrKey(sent.address));
    // Never the device's own incoming side.
    const myIncoming = await incomingRecordShards({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, epochNow: EPOCH, windowW: 2 });
    for (const s of mine) expect(myIncoming.map((x) => addrKey(x.address))).not.toContain(addrKey(s.address));
  });
});
