import { describe, expect, it, beforeEach } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { keyPairFromSeed, sign, KeyPair } from '@ton/crypto';
import { NullifierShard } from '../build/NullifierShard/NullifierShard_NullifierShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';

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
  bucketKey?: bigint; frameCommit?: bigint;
  kind?: bigint; introBucket?: bigint; introR?: bigint; introViewTag?: bigint;
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
    kind: opts.kind ?? 1n,
    bucket_key: opts.bucketKey ?? 0xB0CCE7n,
    frame_commit: opts.frameCommit ?? 0xF4A3En,
    intro_bucket: opts.introBucket ?? 0n,
    intro_r: opts.introR ?? 0n,
    intro_view_tag: opts.introViewTag ?? 0n,
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

  // ── Increment 3: the forward to the RecordShard (the terminal hop) ─────────────────────────────────────────

  async function recordShardFor(bucketKey: bigint, epoch: number): Promise<SandboxContract<RecordShard>> {
    const init = await RecordShard.init(bucketKey, BigInt(epoch));
    const c = blockchain.openContract(new RecordShard(contractAddress(0, init), init));
    await c.send(relay.getSender(), { value: toNano('0.1') }, null);
    return c;
  }
  const txTo = (res: any, dest: Address): any => res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString());

  it('RS-01: a spent token is forwarded and stored at its RecordShard(bucket_key, epoch)', async () => {
    const bucketKey = 0xABCDEF00n;
    const frameCommit = 0x1111222233334444n;
    const { body, serial, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xC0)), epoch: nowEpoch, nonce: 20n, bucketKey, frameCommit });
    const nullShard = await shardFor(nowEpoch, lane);
    const recordShard = await recordShardFor(bucketKey, nowEpoch);

    const res = await nullShard.send(relay.getSender(), { value: toNano('0.2') }, body as any);
    expect(computeExit(res, nullShard.address), 'nullifier burnt').toBe(0);
    expect(await nullShard.getIsSpent(serial)).toBe(true);
    // the forward reached the RecordShard and stored the record
    const rsTx = txTo(res, recordShard.address);
    expect(Number(rsTx?.description?.computePhase?.exitCode), 'record stored').toBe(0);
    const rec = await recordShard.getGetRecord(0n);
    expect(rec.exists).toBe(true);
    expect(rec.frame_commit).toBe(frameCommit);
    expect((await recordShard.getGetView()).record_count).toBe(1n);
  }, 120_000);

  it('RS-02: the RecordShard is the terminal hop — its accepting path emits NOTHING (no action-phase failure)', async () => {
    const bucketKey = 0xBEEF01n;
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xC1)), epoch: nowEpoch, nonce: 21n, bucketKey });
    const nullShard = await shardFor(nowEpoch, lane);
    const recordShard = await recordShardFor(bucketKey, nowEpoch);
    const res = await nullShard.send(relay.getSender(), { value: toNano('0.2') }, body as any);
    const rsTx = txTo(res, recordShard.address);
    expect(Number(rsTx.description.computePhase.exitCode)).toBe(0);
    expect(rsTx.description.actionPhase?.totalActions ?? 0, 'RecordShard sends nothing').toBe(0);
    expect(rsTx.description.aborted ?? false).toBe(false);
  }, 120_000);

  it('RS-03: a record forged directly (not from the authorized NullifierShard) is refused (13650)', async () => {
    // Without RS-AUTH anyone could write free records, bypassing the nullifier burn.
    const bucketKey = 0xF0F0n;
    const recordShard = await recordShardFor(bucketKey, nowEpoch);
    const res = await recordShard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, {
      $$type: 'RecordStore', serial: 12345n, frame_commit: 0x9999n,
    } as any);
    expect(computeExit(res, recordShard.address)).toBe(13650);
    expect((await recordShard.getGetView()).record_count).toBe(0n);
  }, 120_000);

  it('RS-04: a double-spent token yields exactly ONE record (the second is stopped at the nullifier)', async () => {
    const bucketKey = 0xD00Dn;
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xC2)), epoch: nowEpoch, nonce: 22n, bucketKey });
    const nullShard = await shardFor(nowEpoch, lane);
    const recordShard = await recordShardFor(bucketKey, nowEpoch);

    expect(computeExit(await nullShard.send(relay.getSender(), { value: toNano('0.2') }, body as any), nullShard.address)).toBe(0);
    expect((await recordShard.getGetView()).record_count).toBe(1n);
    // replay: the nullifier shard stops it (13604) BEFORE any forward, so no second record is written
    const replay = await nullShard.send(relay.getSender(), { value: toNano('0.2'), bounce: true }, body as any);
    expect(computeExit(replay, nullShard.address)).toBe(13604);
    expect(txTo(replay, recordShard.address), 'no forward on a double-spend').toBeUndefined();
    expect((await recordShard.getGetView()).record_count, 'still one record').toBe(1n);
  }, 120_000);

  it('NS-05: an accept with too little value to carry the record is refused in COMPUTE (13624)', async () => {
    // The forward's funding is checked BEFORE the burn, in COMPUTE, so it bounces and the nullifier is NOT burnt.
    const { body, lane, serial } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0x94)), epoch: nowEpoch, nonce: 9n });
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.003'), bounce: true }, body as any);  // 3M < ~5.21M floor
    expect(computeExit(res, shard.address)).toBe(13624);
    expect(didBounce(res)).toBe(true);
    expect(await shard.getIsSpent(serial), 'not burnt — the token survives for a funded retry').toBe(false);
  }, 120_000);

  it('RS-05: CARRY value flow — the relay gets its excess back; each shard keeps only its own endowment', async () => {
    // The bug this closes: before the change, a fat msg.value stranded ~0.198 GRAM on the NullifierShard forever
    // (it is ephemeral, so that value is lost). Now the shard keeps only base + nullifier endowment, forwards the
    // record endowment, and returns the rest to the relay. Assert the relay's NET cost is small and the endowments
    // landed where they fund real storage.
    
    const bk = 0xCA4409n;
    const { body, lane } = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xC5)), epoch: nowEpoch, nonce: 25n, bucketKey: bk });
    const nullShard = await shardFor(nowEpoch, lane);
    const recordShard = await recordShardFor(bk, nowEpoch);

    const relayBefore = await relay.getBalance();
    const nsBefore = (await blockchain.getContract(nullShard.address)).balance;
    const res = await nullShard.send(relay.getSender(), { value: toNano('1') }, body as any);  // deliberately fat: 1 GRAM
    expect(computeExit(res, nullShard.address)).toBe(0);

    const relayAfter = await relay.getBalance();
    const netCost = relayBefore - relayAfter;   // includes the relay's own send gas
    // The relay sent 1 GRAM and must get almost all of it back — net cost is endowments + path gas, well under 0.02.
    expect(netCost).toBeLessThan(toNano('0.02'));

    // The NullifierShard did NOT accumulate the excess: its balance grew by only ~its own endowment, not ~1 GRAM.
    const nsAfter = (await blockchain.getContract(nullShard.address)).balance;
    expect(nsAfter - nsBefore, 'shard kept only its own endowment, not the fat value').toBeLessThan(toNano('0.05'));

    // The record landed and carries a funding endowment (the RecordShard balance rose above the record's ~1-yr rent).
    expect((await recordShard.getGetView()).record_count).toBe(1n);
    const rsBal = (await blockchain.getContract(recordShard.address)).balance;
    expect(rsBal).toBeGreaterThan(129924n);  // measured 2 cells x 64962/yr rent for one record
  }, 120_000);

  // ── Increment 6: the INTRO lane (first contact, stealth) ───────────────────────────────────────────────────

  async function introShardFor(epoch: number, bucket: bigint): Promise<SandboxContract<IntroShard>> {
    const init = await IntroShard.init(BigInt(epoch), bucket);
    const c = blockchain.openContract(new IntroShard(contractAddress(0, init), init));
    await c.send(relay.getSender(), { value: toNano('0.1') }, null);
    return c;
  }

  it('INTRO-01: an INTRO spend forwards the (R, view_tag, commit) to its IntroShard(epoch, bucket)', async () => {
    const introBucket = 42n;
    const R = 0xAAAA0001n, viewTag = 0x1234n, commit = 0xC0FFEEn;
    const { body, serial, lane } = buildSpend({
      spend: keyPairFromSeed(Buffer.alloc(32, 0xD0)), epoch: nowEpoch, nonce: 30n,
      kind: 2n, introBucket, introR: R, introViewTag: viewTag, frameCommit: commit,
    });
    const nullShard = await shardFor(nowEpoch, lane);
    const introShard = await introShardFor(nowEpoch, introBucket);

    const res = await nullShard.send(relay.getSender(), { value: toNano('0.2') }, body as any);
    expect(computeExit(res, nullShard.address), 'nullifier burnt').toBe(0);
    expect(await nullShard.getIsSpent(serial)).toBe(true);
    // stored at the intro shard, compactly (body lives in tx history)
    const e = await introShard.getGetEntry(0n);
    expect(e.exists).toBe(true);
    expect(e.r).toBe(R);
    expect(e.view_tag).toBe(viewTag);
    expect(e.body_commit).toBe(commit);
    expect((await introShard.getGetView()).live_count).toBe(1n);
  }, 120_000);

  it('INTRO-02: a direct IntroStore (not from the authorized NullifierShard) is refused (13681)', async () => {
    const introShard = await introShardFor(nowEpoch, 7n);
    const res = await introShard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, {
      $$type: 'IntroStore', serial: 999n, r: 1n, view_tag: 2n, body_commit: 3n,
    } as any);
    expect(computeExit(res, introShard.address)).toBe(13681);
    expect((await introShard.getGetView()).live_count).toBe(0n);
  }, 120_000);

  it('INTRO-03: a token spent in CONV cannot ALSO be spent in INTRO — one nullifier covers both lanes', async () => {
    const spend = keyPairFromSeed(Buffer.alloc(32, 0xD3));
    // CONV spend
    const conv = buildSpend({ spend, epoch: nowEpoch, nonce: 33n, bucketKey: 0xBEEFn });
    const nullShard = await shardFor(nowEpoch, conv.lane);
    await recordShardFor(0xBEEFn, nowEpoch);
    expect(computeExit(await nullShard.send(relay.getSender(), { value: toNano('0.2') }, conv.body as any), nullShard.address)).toBe(0);
    // same token (same serial), now as an INTRO spend -> the nullifier is already burnt
    const intro = buildSpend({ spend, epoch: nowEpoch, nonce: 33n, kind: 2n, introBucket: 5n, introR: 1n, introViewTag: 1n });
    expect(conv.serial).toBe(intro.serial);
    const introShard = await introShardFor(nowEpoch, 5n);
    const res = await nullShard.send(relay.getSender(), { value: toNano('0.2'), bounce: true }, intro.body as any);
    expect(computeExit(res, nullShard.address), 'double-spend across lanes -> 13604').toBe(13604);
    expect((await introShard.getGetView()).live_count, 'no intro written').toBe(0n);
  }, 120_000);

  it('INTRO-04: intros past the 1-week window are evicted; fresher ones survive', async () => {
    const introBucket = 88n;
    const introShard = await introShardFor(nowEpoch, introBucket);
    // one intro now
    const a = buildSpend({ spend: keyPairFromSeed(Buffer.alloc(32, 0xD4)), epoch: nowEpoch, nonce: 40n, kind: 2n, introBucket, introR: 0xA1n, introViewTag: 1n });
    const nsA = await shardFor(nowEpoch, a.lane);
    await nsA.send(relay.getSender(), { value: toNano('0.2') }, a.body as any);
    expect((await introShard.getGetView()).live_count).toBe(1n);

    // 8 days later, a fresh intro in the SAME (epoch, bucket)... but epoch is nowEpoch; the shard is epoch-scoped,
    // so to test eviction we advance time and evict: the first intro is now > 1 week old.
    blockchain.now = blockchain.now! + 8 * 86400;
    const keeper = await blockchain.treasury('intro-keeper');
    const ev = await introShard.send(keeper.getSender(), { value: toNano('0.1') }, { $$type: 'EvictIntros', max_count: 32n } as any);
    expect(computeExit(ev, introShard.address)).toBe(0);
    expect((await introShard.getGetView()).live_count, 'the stale intro was evicted').toBe(0n);
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

  it('CAC-06: an over-long certificate window is refused (13636) — the yearly-cadence cap', async () => {
    // A cert that tries to authorize a subkey for far longer than the ~18-month cap: refused regardless of who
    // signed it, so a ceremony error (or one rogue signing) cannot mint a decade-long subkey.
    const spend = keyPairFromSeed(Buffer.alloc(32, 0xA5));
    const { body, lane } = buildSpend({
      spend, epoch: nowEpoch, nonce: 16n,
      validFrom: nowEpoch - 3, validTo: nowEpoch + 600,   // window 603 > 550
    });
    const shard = await shardFor(nowEpoch, lane);
    const res = await shard.send(relay.getSender(), { value: toNano('0.1'), bounce: true }, body as any);
    expect(computeExit(res, shard.address)).toBe(13636);
    expect((await shard.getGetView()).max_cert_epochs).toBe(550n);
  }, 120_000);

  it('CAC-07: a ~15-month operational window (yearly ceremony with overlap) is accepted', async () => {
    // The real regime: a yearly ceremony signs a 15-month window so a late ceremony leaves no gap. Well under the
    // 18-month cap, so it publishes normally.
    const spend = keyPairFromSeed(Buffer.alloc(32, 0xA6));
    const { body, lane } = buildSpend({
      spend, epoch: nowEpoch, nonce: 17n,
      validFrom: nowEpoch - 30, validTo: nowEpoch + 425,  // ~15 months, < 550
    });
    const shard = await shardFor(nowEpoch, lane);
    expect(computeExit(await shard.send(relay.getSender(), { value: toNano('0.1') }, body as any), shard.address)).toBe(0);
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
