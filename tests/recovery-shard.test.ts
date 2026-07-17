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
const RETENTION = 94608000;          // 3 years
const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));
const cellOf = (b: Buffer) => beginCell().storeBuffer(b).endCell();

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
  const SELF = 0x5E1F00n;

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
    const rs = await shard(BigInt(SELF));
    const before = await relay.getBalance();
    const res = await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, BigInt(SELF), 1n, 0) as any);
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
    const rs = await shard(BigInt(SELF));
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, BigInt(SELF), 1n, 0) as any);
    const res = await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, BigInt(SELF), 5n, 1) as any);
    expect(exitOf(res, rs.address)).toBe(0);
    expect((await rs.getGetView()).seq).toBe(5n);
  }, 120_000);

  it('RECOVERY-03: a DIFFERENT owner cannot overwrite the bound slot (13563) — no hijack', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x12));
    const attacker = keyPairFromSeed(Buffer.alloc(32, 0x99));
    const rs = await shard(BigInt(SELF));
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, BigInt(SELF), 1n, 0) as any);
    // attacker signs their own publish with a higher seq
    const res = await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(attacker, BigInt(SELF), 9n, 2) as any);
    expect(exitOf(res, rs.address)).toBe(13563);
    expect((await rs.getGetView()).owner_pubkey).toBe(bufToInt(owner.publicKey));
  }, 120_000);

  it('RECOVERY-04: a stale (lower-or-equal seq) publish is refused (13564) — no rollback of K_root', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x13));
    const rs = await shard(BigInt(SELF));
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, BigInt(SELF), 5n, 0) as any);
    // replay the owner's OWN earlier version (seq 5) and an older one (seq 3): both rejected as non-increasing
    expect(exitOf(await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(owner, BigInt(SELF), 5n, 0) as any), rs.address)).toBe(13564);
    expect(exitOf(await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(owner, BigInt(SELF), 3n, 9) as any), rs.address)).toBe(13564);
    expect((await rs.getGetView()).seq).toBe(5n);
  }, 120_000);

  it('RECOVERY-05: a forged owner signature is refused (13574)', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x14));
    const forger = keyPairFromSeed(Buffer.alloc(32, 0xEE));
    const rs = await shard(BigInt(SELF));
    // owner_pubkey claims `owner`, but the signature is by `forger`
    const res = await rs.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, store(owner, BigInt(SELF), 1n, 0, forger) as any);
    expect(exitOf(res, rs.address)).toBe(13574);
    expect((await rs.getGetView()).bound).toBe(false);
  }, 120_000);

  it('RECOVERY-06: an underfunded self-funded publish is refused (13572)', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x15));
    const rs = await shard(BigInt(SELF));
    const res = await rs.send(relay.getSender(), { value: toNano('0.02'), bounce: true }, store(owner, BigInt(SELF), 1n, 0) as any);  // < 23.2M + gas
    expect(exitOf(res, rs.address)).toBe(13572);
  }, 120_000);

  it('RECOVERY-07: eviction is refused before 3 years and clears the slot after', async () => {
    const owner = keyPairFromSeed(Buffer.alloc(32, 0x16));
    const rs = await shard(BigInt(SELF));
    await rs.send(relay.getSender(), { value: toNano('0.1') }, store(owner, BigInt(SELF), 1n, 0) as any);
    const keeper = await blockchain.treasury('rec-keeper');
    // before 3 years: refused
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05'), bounce: true }, { $$type: 'EvictRecovery' } as any), rs.address)).toBe(13562);
    // after 3 years + a day: cleared
    blockchain.now = blockchain.now! + RETENTION + 86400;
    expect(exitOf(await rs.send(keeper.getSender(), { value: toNano('0.05') }, { $$type: 'EvictRecovery' } as any), rs.address)).toBe(0);
    expect((await rs.getGetView()).bound).toBe(false);
  }, 120_000);
});
