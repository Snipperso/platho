import { describe, expect, it, beforeEach } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { NullifierShard } from '../build/NullifierShard/NullifierShard_NullifierShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// NULLIFIER-SHARD — the load-bearing proof for the clean-17 redesign.
//
// Increment 1 (NS-*): a blind spend token binds to exactly ONE (epoch, lane) shard, so it cannot be replayed
//   across the 2^20 partitions. Two design rounds died on this; measured hole was 1 token accepted by 9 of 9
//   shards because a shard trusted the sender's lane and its own deploy-time epoch, neither recomputed.
// Increment 2 (CAC-*): authority. M-of-N roots are frozen in code; a root ceremony signs a per-window issuer
//   SUBKEY; the certificate travels IN the token. Revocation = not renewing a subkey's window. These tests prove
//   a valid 2-of-3 cert is accepted, a 1-of-3 / duplicate-root / expired cert is not, and a subkey works only
//   inside its window.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ISSUER_SIG_DOMAIN = 0x42534931n; // "BSI1"
const CERT_DOMAIN = 0x43414331n;       // "CAC1"
const LANE_COUNT = 1_048_576n;         // 2^20, must match NS_LANE_COUNT
const EPOCH_SECONDS = 86400;

// The three frozen roots baked into NullifierShard (seeds 0x21/0x22/0x23) and one live issuer subkey.
const ROOTS: KeyPair[] = [0x21, 0x22, 0x23].map((s) => keyPairFromSeed(Buffer.alloc(32, s)));
const subkey: KeyPair = keyPairFromSeed(Buffer.alloc(32, 0x30));

const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));
const sigCell = (b: Buffer) => beginCell().storeBuffer(b).endCell();

// A CAC certificate: roots idxA/idxB (idxA < idxB) sign H(CAC1 ‖ subkey_pubkey ‖ valid_from ‖ valid_to).
function makeCert(sk: KeyPair, validFrom: number, validTo: number, idxA = 0, idxB = 1) {
  const digest = beginCell()
    .storeUint(CERT_DOMAIN, 32)
    .storeUint(bufToInt(sk.publicKey), 256)
    .storeUint(BigInt(validFrom), 32)
    .storeUint(BigInt(validTo), 32)
    .endCell()
    .hash();
  return {
    subkey_pubkey: bufToInt(sk.publicKey),
    valid_from: BigInt(validFrom),
    valid_to: BigInt(validTo),
    root_idx_a: BigInt(idxA),
    root_idx_b: BigInt(idxB),
    cert_sig_a: sigCell(sign(digest, ROOTS[idxA].secretKey)),
    cert_sig_b: sigCell(sign(digest, ROOTS[idxB].secretKey)),
  };
}

// A full spend: token signed by `sk` (the subkey), plus the certificate authorizing `sk`.
function buildSpend(opts: {
  spend: KeyPair; epoch: number; nonce: bigint; sk?: KeyPair;
  validFrom?: number; validTo?: number; idxA?: number; idxB?: number;
}) {
  const sk = opts.sk ?? subkey;
  const spendPub = bufToInt(opts.spend.publicKey);
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(BigInt(opts.epoch), 32).storeUint(opts.nonce, 64)
    .endCell().hash();
  const serial = bufToInt(serialBuf);
  const lane = serial % LANE_COUNT;
  const cert = makeCert(sk, opts.validFrom ?? opts.epoch - 3, opts.validTo ?? opts.epoch + 3, opts.idxA ?? 0, opts.idxB ?? 1);
  const body = {
    $$type: 'NullifierSpend' as const,
    spend_pubkey: spendPub,
    epoch: BigInt(opts.epoch),
    nonce: opts.nonce,
    ...cert,
    issuer_sig: sigCell(sign(serialBuf, sk.secretKey)),
  };
  return { body, serial, lane };
}

function computeExit(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}
const didBounce = (res: any): boolean => res.transactions.some((t: any) => t.inMessage?.info?.bounced === true);

describe('NULLIFIER-SHARD — one token, one shard, one authority', () => {
  let blockchain: Blockchain;
  let relay: SandboxContract<TreasuryContract>;
  let nowEpoch: number;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    nowEpoch = Math.floor(blockchain.now / EPOCH_SECONDS);
    relay = await blockchain.treasury('ns-relay');
  });

  async function shardFor(epoch: number, lane: bigint): Promise<SandboxContract<NullifierShard>> {
    const init = await NullifierShard.init(BigInt(epoch), lane);
    const c = blockchain.openContract(new NullifierShard(contractAddress(0, init), init));
    await c.send(relay.getSender(), { value: toNano('0.1') }, null);
    return c;
  }

  // ── Increment 1: sharding ────────────────────────────────────────────────────────────────────────────────

  it('NS-01: a token is accepted by the ONE shard matching (its epoch, its lane) and rejected by every other', async () => {
    const spend = keyPairFromSeed(Buffer.alloc(32, 0x90));
    const { body, serial, lane } = buildSpend({ spend, epoch: nowEpoch, nonce: 1n });

    const correct = await shardFor(nowEpoch, lane);
    const wrongLaneA = await shardFor(nowEpoch, (lane + 1n) % LANE_COUNT);
    const wrongLaneB = await shardFor(nowEpoch, (lane + 12345n) % LANE_COUNT);
    const wrongEpoch = await shardFor(nowEpoch + 1, lane);

    expect(computeExit(await correct.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any), correct.address), 'the matching shard accepts').toBe(0);
    const rl1 = await wrongLaneA.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(rl1, wrongLaneA.address), 'wrong lane -> 13622').toBe(13622);
    expect(didBounce(rl1), 'and it bounces').toBe(true);
    expect(computeExit(await wrongLaneB.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any), wrongLaneB.address)).toBe(13622);
    const re = await wrongEpoch.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(re, wrongEpoch.address), 'wrong epoch -> 13621 (the load-bearing 4th gate)').toBe(13621);
    expect(didBounce(re)).toBe(true);

    expect(await correct.getIsSpent(serial)).toBe(true);
    expect((await correct.getGetView()).spent_count).toBe(1n);
    expect(await wrongLaneA.getIsSpent(serial)).toBe(false);
    expect(await wrongEpoch.getIsSpent(serial)).toBe(false);
  }, 120_000);

  it('NS-02: a token replayed at its OWN shard is a double-spend (13604) and bounces', async () => {
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0x91)), epoch: nowEpoch, nonce: 7n });
    const shard = await shardFor(nowEpoch, lane);
    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1') }, body as any), shard.address)).toBe(0);
    const replay = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(replay, shard.address)).toBe(13604);
    expect(didBounce(replay)).toBe(true);
    expect((await shard.getGetView()).spent_count).toBe(1n);
  }, 120_000);

  it('NS-04: a token whose epoch is outside the wall-clock window is refused (13600)', async () => {
    const farEpoch = nowEpoch + 100;
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0x93)), epoch: farEpoch, nonce: 5n });
    const shard = await shardFor(farEpoch, lane);
    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any), shard.address)).toBe(13600);
  }, 120_000);

  it('NS-05: the accepting path emits NOTHING — the ACTION phase has no failure surface', async () => {
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0x94)), epoch: nowEpoch, nonce: 9n });
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1') }, body as any);
    const tx: any = res.transactions.find(
      (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === shard.address.toString());
    expect(Number(tx.description.computePhase.exitCode)).toBe(0);
    expect(tx.description.actionPhase?.totalActions ?? 0, 'zero outgoing messages').toBe(0);
    expect(tx.description.aborted ?? false).toBe(false);
  }, 120_000);

  // ── Increment 2: CAC authority ───────────────────────────────────────────────────────────────────────────

  it('CAC-01: a token under a valid 2-of-3 certificate is accepted', async () => {
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xA0)), epoch: nowEpoch, nonce: 11n, idxA: 0, idxB: 2 });
    const shard = await shardFor(nowEpoch, lane);
    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1') }, body as any), shard.address)).toBe(0);
    expect((await shard.getGetView()).root_threshold).toBe(2n);
  }, 120_000);

  it('CAC-02: only ONE real root signature (the other forged) is refused (13633/13634)', async () => {
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xA1)), epoch: nowEpoch, nonce: 12n });
    // Replace root b's signature with one from a NON-root key.
    const forger = keyPairFromSeed(Buffer.alloc(32, 0xEE));
    const digest = beginCell().storeUint(CERT_DOMAIN, 32).storeUint(body.subkey_pubkey, 256)
      .storeUint(body.valid_from, 32).storeUint(body.valid_to, 32).endCell().hash();
    const forged = { ...body, cert_sig_b: sigCell(sign(digest, forger.secretKey)) };
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, forged as any);
    expect(computeExit(res, shard.address)).toBe(13634);
    expect((await shard.getGetView()).spent_count).toBe(0n);
  }, 120_000);

  it('CAC-03: the same root index presented twice is refused (13631) — 2-of-3 cannot collapse to 1-of-1', async () => {
    // Sign the cert with root 1 for BOTH slots and declare idxA==idxB==1. The distinctness gate must reject it.
    const spend = keyPairFromSeed(Buffer.alloc(32, 0xA2));
    const built = buildSpend({ spend, epoch: nowEpoch, nonce: 13n });
    const digest = beginCell().storeUint(CERT_DOMAIN, 32).storeUint(built.body.subkey_pubkey, 256)
      .storeUint(built.body.valid_from, 32).storeUint(built.body.valid_to, 32).endCell().hash();
    const dup = {
      ...built.body,
      root_idx_a: 1n, root_idx_b: 1n,
      cert_sig_a: sigCell(sign(digest, ROOTS[1].secretKey)),
      cert_sig_b: sigCell(sign(digest, ROOTS[1].secretKey)),
    };
    const shard = await shardFor(nowEpoch, built.lane);
    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, dup as any), shard.address)).toBe(13631);
  }, 120_000);

  it('CAC-04: a subkey used OUTSIDE its certificate window is refused (13630) — this is how revocation works', async () => {
    // The cert authorized the subkey only for an earlier window; the ceremony did not renew it. Spending now, past
    // valid_to, must fail — a leaked subkey dies when its window ends.
    const spend = keyPairFromSeed(Buffer.alloc(32, 0xA3));
    const { body, lane } = buildSpend({
      spend, epoch: nowEpoch, nonce: 14n,
      validFrom: nowEpoch - 8, validTo: nowEpoch - 5,   // window already closed
    });
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(res, shard.address)).toBe(13630);
    expect((await shard.getGetView()).spent_count).toBe(0n);
  }, 120_000);

  it('CAC-05: a token signed by a subkey the roots never certified is refused (13601)', async () => {
    // A rogue subkey with a self-made "cert": the roots did not sign it, so cert verification fails first (13633),
    // and even if the cert somehow passed, the token sig is by a key no cert authorizes. Build a cert the roots
    // did NOT sign (sign it with non-root keys) to hit the cert gate.
    const rogue = keyPairFromSeed(Buffer.alloc(32, 0xB0));
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xA4)), epoch: nowEpoch, nonce: 15n, sk: rogue });
    // Overwrite the (validly-rfrom-real-roots) cert sigs with rogue self-signatures.
    const digest = beginCell().storeUint(CERT_DOMAIN, 32).storeUint(body.subkey_pubkey, 256)
      .storeUint(body.valid_from, 32).storeUint(body.valid_to, 32).endCell().hash();
    const rogueBody = { ...body, cert_sig_a: sigCell(sign(digest, rogue.secretKey)), cert_sig_b: sigCell(sign(digest, rogue.secretKey)) };
    const shard = await shardFor(nowEpoch, lane);
    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, rogueBody as any), shard.address)).toBe(13633);
  }, 120_000);
});
