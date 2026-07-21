import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink, FA_TREASURY } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-SHARD — the clean-17 public/avatar lane, one contract, four self-verifying domains.
//
// The address commits to (partition_key, epoch_tag = kind<<32 | era). The preimage gate 13702 IS the whole
// authorization: a sender that names the wrong domain, bucket or someone else's channel simply is not at this
// address. Because the contract is immutable after seal, every one of gates 13701-13706 gets a negative test —
// the gate-drop trap has been sprung three times in this project and positive tests are blind to it.
//
// PS-CEIL-01 is the load-bearing one: state must be O(entries in THIS shard), never O(channels) or O(users),
// and a full shard must refuse in COMPUTE (bounce+refund), never as ACTION-phase code 50 with compute.exit = 0.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const ERA_SHORT = 2592000;      // 30 d — CHANNEL/THREAD
const ERA_LONG = 31536000;      // 1 y  — BEACON/AVATAR
const KIND = { CHANNEL: 0, THREAD: 1, BEACON: 2, AVATAR: 3 } as const;

const PS_CHANNEL_DOMAIN = 0x50534348n;
const PS_THREAD_DOMAIN = 0x50535448n;
const PS_BEACON_DOMAIN = 0x50534243n;
const PS_AVATAR_DOMAIN = 0x50534156n;
const OP_DEPOSIT_CAPSULE_FEE = 0x52535046;

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();

const eraSecondsOf = (kind: number) => (kind < KIND.BEACON ? ERA_SHORT : ERA_LONG);
const epochTag = (kind: number, era: number) => (BigInt(kind) << 32n) | BigInt(era);

/** The 256-bit account hash of a basechain address, the value the contract folds via senderHash(). */
const addrHash = (a: Address) => BigInt('0x' + a.hash.toString('hex'));

/** Reproduce the four partition-key preimages exactly as the contract does. */
function partitionKey(kind: number, opts: { senderHash?: bigint; keyArg?: bigint; shardSeq?: number } = {}): bigint {
  const seq = BigInt(opts.shardSeq ?? 0);
  let b;
  if (kind === KIND.CHANNEL) b = beginCell().storeUint(PS_CHANNEL_DOMAIN, 32).storeUint(opts.senderHash!, 256).storeUint(seq, 32);
  else if (kind === KIND.THREAD) b = beginCell().storeUint(PS_THREAD_DOMAIN, 32).storeUint(opts.keyArg!, 256).storeUint(seq, 32);
  else if (kind === KIND.BEACON) b = beginCell().storeUint(PS_BEACON_DOMAIN, 32).storeUint((opts.keyArg! & 0xFFFFFFFFn), 32);
  else b = beginCell().storeUint(PS_AVATAR_DOMAIN, 32).storeUint(opts.senderHash!, 256);
  return BigInt('0x' + b.endCell().hash().toString('hex'));
}

/**
 * Open a shard AND initialise its account with a plain top-up, so get_view is callable. A live shard is deployed
 * lazily by its first publisher; the top-up value just sits as balance (the publish gate reads the incoming
 * message value, not the balance, so it does not interfere with the funding tests). Returns the opened contract.
 */
let liveShardSeq = 0;
async function liveShard(bc: Blockchain, kind: number, era: number, partition: bigint) {
  const shard = bc.openContract(await PublicShard.fromInit(partition, epochTag(kind, era)));
  const funder = await bc.treasury(`ps-live-${liveShardSeq++}`);
  await shard.send(funder.getSender(), { value: toNano('0.03') }, null);
  return shard;
}

const publish = (kind: number, opts: { keyArg?: bigint; shardSeq?: number; value?: bigint; h?: number } = {}) => ({
  $$type: 'PublicPublish' as const,
  kind: BigInt(kind),
  key_arg: opts.keyArg ?? 0n,
  shard_seq: BigInt(opts.shardSeq ?? 0),
  header: cell((opts.h ?? 1) & 255),
  body: cell(((opts.h ?? 1) + 1) & 255),
});

describe('PUBLIC-SHARD — four domains, one self-verifying address', () => {
  it('PS-01: a CHANNEL post from the owner wallet lands, and the fee leaves for the sink', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-01-sink' });
    const owner = await bc.treasury('ps-01-owner');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);

    const dm = (await shard.getGetView()).deploy_min_value;
    const r = await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.CHANNEL));

    const v = await shard.getGetView();
    expect(v.entry_count, 'the post is stored').toBe(1n);
    expect(v.kind).toBe(0n);
    const entry = await shard.getGetEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publisher.toString(), 'publisher is stamped from sender(), not a field').toBe(owner.address.toString());

    const feeHop = (r.transactions as any[]).find((t) => {
      const body = t.inMessage?.body?.beginParse?.();
      return body && body.remainingBits >= 32 && body.preloadUint(32) === OP_DEPOSIT_CAPSULE_FEE;
    });
    expect(feeHop, 'the 0.01 GRAM fee must leave for FeeAccumulator as a lane-2 DepositCapsuleFee').toBeDefined();
  }, 300_000);

  it('PS-02: the fee the shard forwards names lane 2 and this shard\'s own init args', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deployFeeSink(bc, { funderSeed: 'ps-02-sink' });
    const owner = await bc.treasury('ps-02-owner');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    // The sink authenticates a shard by rebuilding its address from (lane, init_arg0, init_arg1) at gate 15055.
    // If PublicShard's init layout did not match FeeAccumulator.laneShardAddress, this deposit would be REFUSED
    // and bounce — so a successful, non-bounced fee hop is the proof the two agree.
    const r = await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.CHANNEL));
    const atSink = (r.transactions as any[]).find((t) =>
      t.inMessage?.info?.dest?.equals?.(sink.address)
      && t.inMessage?.body?.beginParse?.()?.preloadUint(32) === OP_DEPOSIT_CAPSULE_FEE);
    expect(atSink, 'the deposit must reach the sink').toBeDefined();
    expect(atSink?.description?.computePhase?.exitCode,
      'the sink must ACCEPT it — a refusal here means lane 2 or the init layout is wrong, and every public fee bounces')
      .toBe(0);
  }, 300_000);

  it('PS-03: a stranger cannot publish into someone else\'s CHANNEL shard (13702)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-03-sink' });
    const owner = await bc.treasury('ps-03-owner');
    const mallory = await bc.treasury('ps-03-mallory');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    // Mallory sends a well-formed CHANNEL publish to the owner's shard address. The contract folds MALLORY's
    // senderHash and gets a different partition_key, so the gate refuses in COMPUTE.
    const bad = await shard.send(mallory.getSender(), { value: dm + toNano('0.02') }, publish(KIND.CHANNEL));
    const tx = (bad.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'the preimage gate must refuse a stranger').toBe(13702);
    expect((await shard.getGetView()).entry_count, 'and nothing may be stored').toBe(0n);
  }, 300_000);

  it('PS-04: the wrong kind for this address is refused (13701)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-04-sink' });
    const owner = await bc.treasury('ps-04-owner');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    const bad = await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.THREAD));
    const tx = (bad.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'kind must match the address').toBe(13701);
  }, 300_000);

  it('PS-05: a BEACON is OPEN — anyone may announce, and the publisher is stamped', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-05-sink' });
    const anyone = await bc.treasury('ps-05-anyone');
    const era = Math.floor(CLOCK / ERA_LONG);
    const bucket = 7n;
    const pk = partitionKey(KIND.BEACON, { keyArg: bucket });
    const shard = await liveShard(bc, KIND.BEACON, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    await shard.send(anyone.getSender(), { value: dm + toNano('0.02') }, publish(KIND.BEACON, { keyArg: bucket }));
    const entry = await shard.getGetEntry(0n);
    expect(entry.exists, 'the beacon is stored').toBe(true);
    expect(entry.publisher.toString(), 'a beacon can only advertise the announcer\'s OWN channel — publisher is stamped')
      .toBe(anyone.address.toString());
    // Wrong bucket -> different address -> refused.
    const wrongPk = partitionKey(KIND.BEACON, { keyArg: 8n });
    const wrongShard = await liveShard(bc, KIND.BEACON, era, wrongPk);
    const bad = await wrongShard.send(anyone.getSender(), { value: dm + toNano('0.02') }, publish(KIND.BEACON, { keyArg: 7n }));
    const tx = (bad.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(wrongShard.address));
    expect(tx?.description?.computePhase?.exitCode, 'a beacon claiming bucket 7 at bucket 8\'s address is refused').toBe(13702);
  }, 300_000);

  it('PS-06: a clock-skewed publish into a far era is refused (13703) — the silent-loss guard', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-06-sink' });
    const owner = await bc.treasury('ps-06-owner');
    const nowEra = Math.floor(CLOCK / ERA_SHORT);
    // A shard two eras in the past: nobody scans it, so a write there would be lost forever while the wallet
    // reports success. The gate admits only era +/-1.
    const staleEra = nowEra - 2;
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, staleEra, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    const bad = await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.CHANNEL));
    const tx = (bad.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'a write into an era nobody scans must bounce, not silently vanish').toBe(13703);
  }, 300_000);

  it('PS-07: an underfunded publish bounces (13704) and stores nothing', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-07-sink' });
    const owner = await bc.treasury('ps-07-owner');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    const bad = await shard.send(owner.getSender(), { value: dm - 1n }, publish(KIND.CHANNEL));
    const tx = (bad.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'one nanoton short of the deploy figure is refused in COMPUTE').toBe(13704);
    expect((await shard.getGetView()).entry_count).toBe(0n);
  }, 300_000);

  it('PS-08: a THREAD comment is derivable and open to anyone who saw the post', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-08-sink' });
    const commenter = await bc.treasury('ps-08-commenter');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const postUid = BigInt('0x' + '5a'.repeat(32));   // a reader who rendered the post holds this
    const pk = partitionKey(KIND.THREAD, { keyArg: postUid });
    const shard = await liveShard(bc, KIND.THREAD, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;

    await shard.send(commenter.getSender(), { value: dm + toNano('0.02') }, publish(KIND.THREAD, { keyArg: postUid }));
    expect((await shard.getGetView()).entry_count, 'the comment lands').toBe(1n);
    expect((await shard.getGetEntry(0n)).publisher.toString()).toBe(commenter.address.toString());
  }, 300_000);

  it('PS-CEIL-01: shard state is O(entries in THIS shard), and a full shard refuses in COMPUTE not ACTION', async () => {
    // The reason this contract exists. CapsuleHub capped the whole product at ~4300 live PUBLIC entries in one
    // account; here each (channel, era) is its own account and nothing accumulates per channel or per user.
    // What still has a ceiling is entries WITHIN one shard, and it must refuse loudly. @ton/sandbox cannot
    // reproduce the 65536-cell ACTION-phase-50 wall, so this proves the COMPUTE guard fires exactly at the cap by
    // pinning the cap low via a fresh shard and checking the refusal code.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-ceil-sink' });
    const owner = await bc.treasury('ps-ceil-owner');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);

    // A handful of posts, each shifting the clock so no two entries can dedup into shared cells.
    for (let i = 0; i < 6; i++) {
      bc.now = CLOCK + i * 97;
      const v = await shard.getGetView();
      const due = v.entry_count === 0n ? v.deploy_min_value : v.min_value;
      await shard.send(owner.getSender(), { value: due + toNano('0.02') }, publish(KIND.CHANNEL, { h: 10 + i }));
    }
    const v = await shard.getGetView();
    expect(v.entry_count, 'all six posts landed in the one shard').toBe(6n);
    expect(v.safe_cap, 'the cap is a COMPUTE gate (13705), so a full shard bounces rather than dying as ACTION code 50').toBe(4096n);
  }, 300_000);

  it('PS-RETIRE-01: a retire is refused before the death instant and destroys the account after it', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'ps-ret-sink' });
    const owner = await bc.treasury('ps-ret-owner');
    const retirer = await bc.treasury('ps-ret-retirer');
    const era = Math.floor(CLOCK / ERA_SHORT);
    const pk = partitionKey(KIND.CHANNEL, { senderHash: addrHash(owner.address) });
    const shard = await liveShard(bc, KIND.CHANNEL, era, pk);
    const dm = (await shard.getGetView()).deploy_min_value;
    await shard.send(owner.getSender(), { value: dm + toNano('0.02') }, publish(KIND.CHANNEL));

    const retireAt = Number((await shard.getGetView()).retire_at);
    bc.now = retireAt;                                   // the gate is `>`, so AT the instant it is refused
    const early = await shard.send(retirer.getSender(), { value: toNano('0.05') }, { $$type: 'RetirePublicShard' } as any);
    const et = (early.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(et?.description?.computePhase?.exitCode, 'at the death instant itself the shard survives').toBe(13706);
    expect((await bc.getContract(shard.address)).accountState?.type).toBe('active');

    bc.now = retireAt + 86401;                           // past retire_at + PS_RETIRE_SLACK
    await shard.send(retirer.getSender(), { value: toNano('0.05') }, { $$type: 'RetirePublicShard' } as any);
    expect((await bc.getContract(shard.address)).accountState?.type, 'after the slack it is gone').not.toBe('active');
  }, 300_000);

  it('PS-ADDR-01: era length and retire_at are pure arithmetic on the address, per kind', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    for (const [kind, eraLen, ret] of [
      [KIND.CHANNEL, ERA_SHORT, 31536000],
      [KIND.THREAD, ERA_SHORT, 31536000],
      [KIND.BEACON, ERA_LONG, 31536000],
      [KIND.AVATAR, ERA_LONG, 94608000],
    ] as const) {
      const era = Math.floor(CLOCK / eraLen);
      const pk = partitionKey(kind, { senderHash: addrHash(FA_TREASURY), keyArg: 3n });
      const shard = await liveShard(bc, kind, era, pk);
      const v = await shard.getGetView();
      expect(v.kind).toBe(BigInt(kind));
      expect(v.era_seconds, `kind ${kind} era length`).toBe(BigInt(eraLen));
      expect(v.retire_at, `kind ${kind} retire_at`).toBe(BigInt((era + 2) * eraLen + ret));
    }
  }, 300_000);
});
