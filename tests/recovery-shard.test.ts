import { describe, expect, it, beforeEach } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// RECOVERY-SHARD — the durability lane: the K_root self-recovery blob, sharded.
//
// One partition per user's self_bucket_key (epoch-independent). Self-funded (owner brings the endowment), owner-
// signed (no CAC, no nullifier). The two attacks it must close, both caught in the monolith's review:
//   - ROLLBACK: a stale owner-signed publish must not downgrade K_root to an old value (RECOVERY-04 / 13564).
//   - HIJACK: a third party who reads the on-chain self_bucket_key must not overwrite the blob (RECOVERY-03 / 13563).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const RECOVERY_DOMAIN = 0x42525331n; // "BRS1"
const SLOT_DOMAIN = 0x52534C4Bn;     // "RSLK" — the slot IS the owner key: self_bucket_key = H(SLOT_DOMAIN ‖ owner_pubkey)
const RETENTION = 94608000;          // 3 years
const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));
const cellOf = (b: Buffer) => beginCell().storeBuffer(b).endCell();

// The slot identity, mirroring RecoveryShard.slotKeyForOwner — only the seed that derives owner_pubkey names it.
const slotKeyForOwner = (ownerPub: bigint): bigint =>
  bufToInt(beginCell().storeUint(SLOT_DOMAIN, 32).storeUint(ownerPub, 256).endCell().hash());
const selfOf = (owner: KeyPair): bigint => slotKeyForOwner(bufToInt(owner.publicKey));

function digest(selfBucket: bigint, seq: bigint, h0: bigint, h1: bigint, bh: bigint): Buffer {
  return beginCell()
    .storeUint(RECOVERY_DOMAIN, 32)
    .storeUint(selfBucket, 256)
    .storeUint(seq, 64)
    .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
    .endCell()
    .hash();
}

// A recovery publish, signed by `owner`. h0/h1/bh vary with `fill` so successive versions differ.
function store(owner: KeyPair, selfBucket: bigint, seq: bigint, fill: number, sigOwner?: KeyPair) {
  const h0 = 0x100n + BigInt(fill), h1 = 0x200n + BigInt(fill), bh = 0x300n + BigInt(fill);
  const d = digest(selfBucket, seq, h0, h1, bh);
  return {
    $$type: 'RecoveryStore' as const,
    owner_pubkey: bufToInt(owner.publicKey),
    seq, h0, h1, bh,
    body: beginCell().storeUint(0xDEADBEEFn + BigInt(fill), 256).endCell(),
    owner_sig: cellOf(sign(d, (sigOwner ?? owner).secretKey)),
  };
}

function exitOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

describe('RECOVERY-SHARD — owner-signed, rollback-proof, 3-year durability', () => {
  let blockchain: Blockchain;
  let relay: SandboxContract<TreasuryContract>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    relay = await blockchain.treasury('rec-relay');
  });

  async function shard(selfBucket: bigint): Promise<SandboxContract<RecoveryShard>> {
    const init = await RecoveryShard.init(selfBucket);
    const c = blockchain.openContract(new RecoveryShard(contractAddress(0, init), init));
    await c.send(relay.getSender(), { value: toNano('0.05') }, null);
    return c;
  }

  it('RECOVERY-01: the first publish binds the owner and stores the blob; the change is returned', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x10));
    const self = selfOf(owner);
    const rs = await shard(self);
    const before = await relay.getBalance();
    const res = await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 1n, 0) as any);
    expect(exitOf(res, rs.address)).toBe(0);
    const v = await rs.getGetView();
    expect(v.bound).toBe(true);
    expect(v.owner_pubkey).toBe(bufToInt(owner.publicKey));
    expect(v.seq).toBe(1n);
    // change returned: net cost well under the 0.1 sent (endowment ~0.023 + gas)
    expect(before - await relay.getBalance()).toBeLessThan(toNano('0.04'));
    // the shard keeps ~the endowment
    expect((await blockchain.getContract(rs.address)).balance).toBeGreaterThan(20_000_000n);
  }, 120_000);

  it('RECOVERY-02: the owner updates forward with a higher seq', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x11));
    const self = selfOf(owner);
    const rs = await shard(self);
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 1n, 0) as any);
    const res = await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 5n, 1) as any);
    expect(exitOf(res, rs.address)).toBe(0);
    expect((await rs.getGetView()).seq).toBe(5n);
  }, 120_000);

  it('RECOVERY-03: a DIFFERENT owner cannot overwrite the bound slot (13563) — no hijack', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x12));
    const attacker = keyPairFromSeed(Buffer.alloc(32, 0x99));
    const self = selfOf(owner);
    const rs = await shard(self);
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 1n, 0) as any);
    // attacker signs their own publish with a higher seq (their key does not name this slot, but the slot is already
    // bound to the owner, so this is stopped as a hijack at 13563 — the owner-mismatch gate)
    const res = await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(attacker, self, 9n, 2) as any);
    expect(exitOf(res, rs.address)).toBe(13563);
    expect((await rs.getGetView()).owner_pubkey).toBe(bufToInt(owner.publicKey));
  }, 120_000);

  it('RECOVERY-04: a stale (lower-or-equal seq) publish is refused (13564) — no rollback of K_root', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x13));
    const self = selfOf(owner);
    const rs = await shard(self);
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 5n, 0) as any);
    // replay the owner's OWN earlier version (seq 5) and an older one (seq 3): both rejected as non-increasing
    expect(exitOf(await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(owner, self, 5n, 0) as any), rs.address)).toBe(13564);
    expect(exitOf(await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(owner, self, 3n, 9) as any), rs.address)).toBe(13564);
    expect((await rs.getGetView()).seq).toBe(5n);
  }, 120_000);

  it('RECOVERY-05: a forged owner signature is refused (13574)', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x14));
    const forger = keyPairFromSeed(Buffer.alloc(32, 0xEE));
    const self = selfOf(owner);
    const rs = await shard(self);
    // owner_pubkey claims `owner` (whose key names this slot), but the signature is by `forger`
    const res = await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(owner, self, 1n, 0, forger) as any);
    expect(exitOf(res, rs.address)).toBe(13574);
    expect((await rs.getGetView()).bound).toBe(false);
  }, 120_000);

  it('RECOVERY-06: an underfunded self-funded publish is refused (13572)', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x15));
    const self = selfOf(owner);
    const rs = await shard(self);
    const res = await rs.send(relay.getSender(), { value: toNano('0.02'), bounce: true }, store(owner, self, 1n, 0) as any);  // < 23.2M + gas
    expect(exitOf(res, rs.address)).toBe(13572);
  }, 120_000);

  it('RECOVERY-07: eviction is refused before 3 years and clears the slot after', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x16));
    const self = selfOf(owner);
    const rs = await shard(self);
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 1n, 0) as any);
    const keeper = await blockchain.treasury('rec-keeper');
    // before 3 years: refused
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05'), bounce: true }, { $$type: 'EvictRecovery' } as any), rs.address)).toBe(13562);
    // after 3 years + a day: cleared
    blockchain.now = blockchain.now! + RETENTION + 86400;
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05') }, { $$type: 'EvictRecovery' } as any), rs.address)).toBe(0);
    expect((await rs.getGetView()).bound).toBe(false);
  }, 120_000);

  it('RECOVERY-08: [SQUAT-CLOSE] only the key that names the slot can bind it — fresh AND after eviction (13575)', async () => {
    // The slot's address commits to owner_pubkey, so the first binding is self-authenticating: a squatter whose key
    // does not derive this slot cannot bind it, either on a fresh slot or after a 3-year eviction frees it. This is
    // the vector the review found — an unauthenticated first-publish after eviction — closed for good.
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x17));
    const attacker = keyPairFromSeed(Buffer.alloc(32, 0x9A));
    const self = selfOf(owner);                       // == H(SLOT_DOMAIN ‖ owner.pub); attacker's key hashes elsewhere
    const rs = await shard(self);

    // (a) FRESH slot: a squatter cannot make the first binding — their key does not name this address
    const squat1 = await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(attacker, self, 1n, 0) as any);
    expect(exitOf(squat1, rs.address), 'squat on a fresh slot -> 13575').toBe(13575);
    expect((await rs.getGetView()).bound).toBe(false);

    // the true owner binds it, then goes silent for 3 years and the slot is evicted (freed)
    expect(exitOf(await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 1n, 0) as any), rs.address)).toBe(0);
    blockchain.now = blockchain.now! + RETENTION + 86400;
    const keeper = await blockchain.treasury('rec-keeper8');
    await rs.send(keeper.getSender(), { value: toNano('0.05') }, { $$type: 'EvictRecovery' } as any);
    expect((await rs.getGetView()).bound, 'slot freed by eviction').toBe(false);

    // (b) AFTER eviction: the squatter STILL cannot bind the freed slot — identity is the owner key, not first-writer
    const squat2 = await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(attacker, self, 1n, 3) as any);
    expect(exitOf(squat2, rs.address), 'squat after eviction -> 13575').toBe(13575);
    expect((await rs.getGetView()).bound).toBe(false);

    // only the true owner can re-establish recovery on their slot (seq resets to 0 on eviction, so seq 1 is forward)
    expect(exitOf(await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, self, 1n, 5) as any), rs.address), 'owner re-binds').toBe(0);
    expect((await rs.getGetView()).owner_pubkey).toBe(bufToInt(owner.publicKey));
  }, 120_000);
});
