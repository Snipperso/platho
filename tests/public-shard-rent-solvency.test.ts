import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, beginCell, toNano } from '@ton/core';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-SHARD RENT SOLVENCY (Волна 5 / W1-005) — the endowments measured against the rent the chain ACTUALLY
// charges, not the arithmetic derivation. PublicShard.tact marks every PS_ENTRY/BASE_ENDOWMENT_* constant
// [RE-MEASURE BEFORE SEAL] with '[entry ~4 cells MEASURED-PENDING]'. Immutable after seal, so this is the moment.
//
// The clock IS the measurement: config-18 is a schedule (486975/cell/yr before Apr-2026, 64962 after). Pin to the
// frozen-rate era. Deploy BY the publish with no pre-funding — ReserveAddOriginalBalance keeps any float ON TOP of
// the endowment and reads the margin high (the exact mistake this class of test exists to catch).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const ERA_SHORT = 2592000;
const ERA_LONG = 31536000;
const KIND = { CHANNEL: 0, THREAD: 1, BEACON: 2, AVATAR: 3 } as const;
const PS_CHANNEL_DOMAIN = 0x50534348n;
const PS_BEACON_DOMAIN = 0x50534243n;
const PS_AVATAR_DOMAIN = 0x50534156n;
const G8_MARGIN = 1.5;

// Funding basis per PublicShard.tact:76-84: entry rent covers 3*era + retention; base covers the shard's full life.
// Retentions: POST/BEACON 1yr, AVATAR 3yr. Lifetime window the endowment must survive = 3*eraSeconds + retention.
const LIFETIME = {
  [KIND.CHANNEL]: 3 * ERA_SHORT + 31536000, // 3*30d + 1y
  [KIND.BEACON]: 3 * ERA_LONG + 31536000,   // 3*1y + 1y = 4y
  [KIND.AVATAR]: 3 * ERA_LONG + 94608000,   // 3*1y + 3y = 6y  ← tightest
} as const;

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const epochTag = (kind: number, era: number) => (BigInt(kind) << 32n) | BigInt(era);
const addrHash = (a: Address) => BigInt('0x' + a.hash.toString('hex'));

function partitionKey(kind: number, senderHash: bigint, keyArg = 0n): bigint {
  let b;
  if (kind === KIND.CHANNEL) b = beginCell().storeUint(PS_CHANNEL_DOMAIN, 32).storeUint(senderHash, 256).storeUint(0, 32);
  else if (kind === KIND.BEACON) b = beginCell().storeUint(PS_BEACON_DOMAIN, 32).storeUint(keyArg & 0xFFFFFFFFn, 32);
  else b = beginCell().storeUint(PS_AVATAR_DOMAIN, 32).storeUint(senderHash, 256);
  return BigInt('0x' + b.endCell().hash().toString('hex'));
}

const publish = (kind: number, keyArg = 0n, h = 1) => ({
  $$type: 'PublicPublish' as const,
  kind: BigInt(kind), key_arg: keyArg, shard_seq: 0n,
  header: cell(h & 255), body: cell((h + 1) & 255),
});

async function measureLane(kind: number, keyArg = 0n, entries = 1) {
  const bc = await Blockchain.create();
  bc.now = CLOCK;
  // The sink MUST exist. A bounceable fee to a non-existent sink BOUNCES BACK and silently inflates `retained`
  // (measured: +9_647_932), reporting a margin the live lane does not have. This is the measurement's own guard.
  await deployFeeSink(bc, { funderSeed: `ps-rent-sink-${kind}` });
  const era = Math.floor(CLOCK / (kind < KIND.BEACON ? ERA_SHORT : ERA_LONG));
  const owner = await bc.treasury(`ps-rent-${kind}`);
  const senderHash = addrHash(owner.address);
  const pk = partitionKey(kind, senderHash, keyArg);
  const shard = bc.openContract(await PublicShard.fromInit(pk, epochTag(kind, era)));

  // Read deploy_min_value from a throwaway pre-funded twin (getter needs an active account) — a pure constant.
  const twinBc = await Blockchain.create();
  twinBc.now = CLOCK;
  const twin = twinBc.openContract(await PublicShard.fromInit(pk, epochTag(kind, era)));
  await twin.send((await twinBc.treasury('twin')).getSender(), { value: toNano('0.05') }, null);
  const dm = (await twin.getGetView()).deploy_min_value;

  // Deploy BY the publish with EXACTLY deploy_min_value — no pre-funding.
  const r = await shard.send(owner.getSender(), { value: dm }, publish(kind, keyArg) as any);
  const landed = r.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === shard.address.toString());
  expect((landed as any)?.description?.computePhase?.exitCode, `publish must land (kind ${kind})`).toBe(0);
  // Subsequent entries: send generously, the shard reserves entryEndowment and returns the change.
  for (let i = 1; i < entries; i += 1) {
    await shard.send(owner.getSender(), { value: toNano('0.06') }, publish(kind, keyArg, 10 + i) as any);
  }
  expect((await shard.getGetView()).entry_count, `${entries} entries stored`).toBe(BigInt(entries));

  // GUARD THE MEASUREMENT ITSELF: the 0.01 GRAM protocol fee + transport MUST leave for the sink. If it silently
  // stayed on the shard it would inflate `retained` and report a margin the live lane does not have.
  const feeHop = (r.transactions as any[]).find((t) => {
    const body = t.inMessage?.body?.beginParse?.();
    return body && body.remainingBits >= 32 && body.preloadUint(32) === 0x52535046;
  });
  expect(feeHop, 'the capsule fee must leave the shard — otherwise `retained` is inflated').toBeDefined();

  const feeValue = (feeHop as any).inMessage.info.value.coins as bigint;
  const retained = (await bc.getContract(shard.address)).balance;
  // eslint-disable-next-line no-console
  console.log(`[PS-RECONCILE kind=${kind}] deploy_min=${dm} feeLeft=${feeValue} retained=${retained} delta=${dm - feeValue - retained}`);

  // THE MEASUREMENT: advance the full lifetime, let the chain charge real rent.
  bc.now = CLOCK + LIFETIME[kind as keyof typeof LIFETIME];
  const poke = await owner.send({ to: shard.address, value: toNano('1'), bounce: false } as any);
  const tx: any = poke.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === shard.address.toString());
  const rent = BigInt(tx.description.storagePhase.storageFeesCollected);
  const margin = Number(retained) / Number(rent);
  const years = (LIFETIME[kind as keyof typeof LIFETIME] / 31536000).toFixed(1);
  // eslint-disable-next-line no-console
  console.log(`[PS-RENT kind=${kind}] retained=${retained} rent(${years}y)=${rent} margin=${margin.toFixed(4)}x deploy_min=${dm}`);
  return { retained, rent, margin };
}

// CALIBRATION: decompose the measured rent into (code+data) and (marginal per entry) so BASE and ENTRY can be
// sized independently. Sizing only the 1-entry case would leave a FULL shard (up to PS_SAFE_CAP) insolvent.
describe('PUBLIC-SHARD RENT CALIBRATION — how the endowment constants must be sized', () => {
  it('PS-CAL: decompose base vs per-entry rent for every kind and print the required constants', async () => {
    const N = 11;
    for (const [name, kind, keyArg] of [['CHANNEL', KIND.CHANNEL, 0n], ['BEACON', KIND.BEACON, 7n], ['AVATAR', KIND.AVATAR, 0n]] as const) {
      const one = await measureLane(kind, keyArg, 1);
      const many = await measureLane(kind, keyArg, N);
      const perEntry = (Number(many.rent) - Number(one.rent)) / (N - 1);
      const baseRent = Number(one.rent) - perEntry;
      const years = (LIFETIME[kind as keyof typeof LIFETIME] / 31536000).toFixed(2);
      // eslint-disable-next-line no-console
      console.log(`[PS-CAL ${name}] life=${years}y baseRent=${Math.round(baseRent)} perEntryRent=${Math.round(perEntry)} `
        + `=> REQUIRED base>=${Math.ceil(baseRent * G8_MARGIN)} entry>=${Math.ceil(perEntry * G8_MARGIN)} `
        + `(rent1=${one.rent} rent${N}=${many.rent})`);
    }
  }, 600_000);
});

describe('PUBLIC-SHARD RENT SOLVENCY — measured against the storage phase (W1-005)', () => {
  it('PS-RENT-AVATAR: the AVATAR endowment carries a shard for its full ~6-year life at the project 1.5x margin', async () => {
    const m = await measureLane(KIND.AVATAR);
    expect(m.rent, 'AVATAR must not already be insolvent at its retention horizon').toBeLessThan(m.retained);
    expect(m.margin, `AVATAR endowment delivers ${m.margin.toFixed(4)}x, below the ${G8_MARGIN}x rule`)
      .toBeGreaterThanOrEqual(G8_MARGIN);
  }, 300_000);

  it('PS-RENT-BEACON: the BEACON endowment carries a shard for its full ~4-year life at 1.5x', async () => {
    const m = await measureLane(KIND.BEACON, 7n);
    expect(m.rent).toBeLessThan(m.retained);
    expect(m.margin, `BEACON ${m.margin.toFixed(4)}x < ${G8_MARGIN}x`).toBeGreaterThanOrEqual(G8_MARGIN);
  }, 300_000);

  it('PS-RENT-CHANNEL: the CHANNEL/POST endowment carries a shard for its full life at 1.5x', async () => {
    const m = await measureLane(KIND.CHANNEL);
    expect(m.rent).toBeLessThan(m.retained);
    expect(m.margin, `CHANNEL ${m.margin.toFixed(4)}x < ${G8_MARGIN}x`).toBeGreaterThanOrEqual(G8_MARGIN);
  }, 300_000);
});
