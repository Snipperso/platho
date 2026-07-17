import { describe, expect, it, beforeEach } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { NullifierShard } from '../build/NullifierShard/NullifierShard_NullifierShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// NULLIFIER-SHARD — the load-bearing proof for the clean-17 redesign.
//
// Two design rounds died on the same thing: a blind spend token could be replayed across shards. Measured hole:
// one token accepted by 9 of 9 shards (unbounded), because a shard trusted (a) the lane the SENDER named and
// (b) its own deploy-time epoch, neither recomputed from the token. This suite drives ONE token at many shards of
// different (epoch, lane) and asserts EXACTLY ONE accepts — the double-spend hole closed, in code, not in a doc.
//
// A NullifierShard is one (epoch, lane) partition, deployed lazily; its address is f(StateInit{epoch, lane}), so a
// distinct (epoch, lane) is a distinct contract. The token cannot choose which shard it lands in: its lane is
// serial mod 2^20 and its epoch is fixed at issuance, so exactly one deployed shard's identity matches it.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ISSUER_SIG_DOMAIN = 0x42534931n; // "BSI1"
const LANE_COUNT = 1_048_576n;         // 2^20, must match NS_LANE_COUNT
const EPOCH_SECONDS = 86400;

// The frozen issuer key baked into NullifierShard (seed 0x11 = anon.ts issuerKey() default).
const issuerKey: KeyPair = keyPairFromSeed(Buffer.alloc(32, 0x11));

const bufToInt = (b: Buffer): bigint => BigInt('0x' + b.toString('hex'));

// Build a token exactly as CapsuleHub/anon.ts do: serial = H(BSI1 ‖ spend_pubkey ‖ epoch ‖ nonce), issuer signs
// the serial bytes. Returns the message fields plus the derived serial and its lane.
function buildToken(spend: KeyPair, epoch: number, nonce: bigint) {
  const spendPub = bufToInt(spend.publicKey);
  const serialBuf = beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32)
    .storeUint(spendPub, 256)
    .storeUint(BigInt(epoch), 32)
    .storeUint(nonce, 64)
    .endCell()
    .hash();
  const serial = bufToInt(serialBuf);
  const lane = serial % LANE_COUNT;
  const issuerSig = sign(serialBuf, issuerKey.secretKey);
  const body = {
    $$type: 'NullifierSpend' as const,
    spend_pubkey: spendPub,
    epoch: BigInt(epoch),
    nonce,
    issuer_sig: beginCell().storeBuffer(issuerSig).asSlice(),
  };
  return { body, serial, lane };
}

function computeExit(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());
  return Number(tx?.description?.computePhase?.exitCode ?? -999);
}

function bounced(res: any): boolean {
  return res.transactions.some((t: any) => t.inMessage?.info?.bounced === true);
}

describe('NULLIFIER-SHARD — one token lands in exactly one shard', () => {
  let blockchain: Blockchain;
  let relay: SandboxContract<TreasuryContract>;
  let nowEpoch: number;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    nowEpoch = Math.floor(blockchain.now / EPOCH_SECONDS);
    relay = await blockchain.treasury('ns-relay');
  });

  // Lazy-deploy a shard for (epoch, lane) and return its opened contract. The address is a pure function of
  // (epoch, lane), which is the whole point: nobody can deploy a shard at a DIFFERENT address for the same identity.
  async function shardFor(epoch: number, lane: bigint): Promise<SandboxContract<NullifierShard>> {
    const init = await NullifierShard.init(BigInt(epoch), lane);
    const c = blockchain.openContract(new NullifierShard(contractAddress(0, init), init));
    await c.send(relay.getSender(), { value: toNano('0.1') }, null);   // carrier deploy
    return c;
  }

  it('NS-01: a token is accepted by the ONE shard matching (its epoch, its lane) and rejected by every other', async () => {
    const spend = keyPairFromSeed(Buffer.alloc(32, 0x90));
    const { body, serial, lane } = buildToken(spend, nowEpoch, 1n);

    // The one shard the token belongs to.
    const correct = await shardFor(nowEpoch, lane);
    // Decoys: right epoch / wrong lane, and right lane / wrong epoch (still inside the wall-clock window, so this
    // isolates gate (2) from gate (1)).
    const wrongLaneA = await shardFor(nowEpoch, (lane + 1n) % LANE_COUNT);
    const wrongLaneB = await shardFor(nowEpoch, (lane + 12345n) % LANE_COUNT);
    const wrongEpoch = await shardFor(nowEpoch + 1, lane);

    // Send the SAME token to all four.
    const okRes = await correct.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(okRes, correct.address), 'the matching shard accepts').toBe(0);

    const rl1 = await wrongLaneA.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(rl1, wrongLaneA.address), 'wrong lane -> 13622').toBe(13622);
    expect(bounced(rl1), 'and it bounces (COMPUTE refusal, relay refunded)').toBe(true);

    const rl2 = await wrongLaneB.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(rl2, wrongLaneB.address), 'wrong lane -> 13622').toBe(13622);

    const re = await wrongEpoch.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(re, wrongEpoch.address), 'wrong epoch -> 13621 (the load-bearing 4th gate)').toBe(13621);
    expect(bounced(re)).toBe(true);

    // Exactly one shard burnt the nullifier.
    expect(await correct.getIsSpent(serial)).toBe(true);
    expect((await correct.getGetView()).spent_count).toBe(1n);
    expect(await wrongLaneA.getIsSpent(serial)).toBe(false);
    expect(await wrongEpoch.getIsSpent(serial)).toBe(false);
  }, 120_000);

  it('NS-02: a token replayed at its OWN shard is refused as a double-spend (13604) and bounces', async () => {
    const spend = keyPairFromSeed(Buffer.alloc(32, 0x91));
    const { body, serial, lane } = buildToken(spend, nowEpoch, 7n);
    const shard = await shardFor(nowEpoch, lane);

    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1') }, body as any), shard.address)).toBe(0);
    const replay = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(replay, shard.address), 'second spend of the same serial').toBe(13604);
    expect(bounced(replay)).toBe(true);
    expect((await shard.getGetView()).spent_count, 'still one').toBe(1n);
    void serial;
  }, 120_000);

  it('NS-03: a forged issuer signature is refused (13601)', async () => {
    const spend = keyPairFromSeed(Buffer.alloc(32, 0x92));
    const { body, lane } = buildToken(spend, nowEpoch, 3n);
    // Replace the issuer signature with one from a DIFFERENT key — the frozen NS_ISSUER_PUBKEY must reject it.
    const forgerSerial = beginCell()
      .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(body.spend_pubkey, 256)
      .storeUint(body.epoch, 32).storeUint(body.nonce, 64).endCell().hash();
    const forger = keyPairFromSeed(Buffer.alloc(32, 0xEE));
    const forged = { ...body, issuer_sig: beginCell().storeBuffer(sign(forgerSerial, forger.secretKey)).asSlice() };
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, forged as any);
    expect(computeExit(res, shard.address)).toBe(13601);
    expect((await shard.getGetView()).spent_count).toBe(0n);
  }, 120_000);

  it('NS-04: a token whose epoch is outside the wall-clock window is refused (13600)', async () => {
    // A shard deployed for the far-future epoch, with a token to match — gate (2) passes but gate (1) does not,
    // because the wall clock has not reached that epoch.
    const spend = keyPairFromSeed(Buffer.alloc(32, 0x93));
    const farEpoch = nowEpoch + 100;
    const { body, lane } = buildToken(spend, farEpoch, 5n);
    const shard = await shardFor(farEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(res, shard.address)).toBe(13600);
  }, 120_000);

  it('NS-05: the accepting path emits NOTHING — the ACTION phase has no failure surface', async () => {
    // The property that removes silent code-50 loss by construction: on success there are zero outgoing messages
    // and no nativeReserve, so the ACTION phase cannot fail. Assert it directly.
    const spend = keyPairFromSeed(Buffer.alloc(32, 0x94));
    const { body, lane } = buildToken(spend, nowEpoch, 9n);
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1') }, body as any);
    const tx: any = res.transactions.find(
      (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === shard.address.toString());
    expect(Number(tx.description.computePhase.exitCode)).toBe(0);
    expect(tx.description.actionPhase?.totalActions ?? 0, 'zero outgoing messages').toBe(0);
    expect(tx.description.aborted ?? false).toBe(false);
  }, 120_000);
});
