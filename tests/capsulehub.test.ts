import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { findTransaction } from '@ton/test-utils';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { createHash } from 'crypto';
import { webcrypto } from 'crypto';
import {
  CapsuleHub,
  DepositProtocolFee,
  FlushFees,
  SweepExcessReserve,
  storeDepositProtocolFee,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  FeeAccumulator,
  FlushTreasuryDue,
  SplitAccumulated,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { finalPrivateHeader0Cell } from './helpers/capsule-cells';
import {
  HUB_MANIFEST,
  KIND_PRIVATE,
  KIND_PUBLIC,
  marketingCell,
  hubTxExit,
} from './helpers/vpb2';
import {
  EPOCH_SECONDS,
  anonBatch,
  bufToInt,
  convPartToken,
  fundPool,
  issuerKey,
  publicPartToken,
  spendKey,
} from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration. The Hub's Vault-forwarded publish (receive(PublishBatchToHub), op 0xA4F862D1) is GONE; the
// SOLE publish path is now the permissionless receive(PublishAnonBatch) — per-part spend-token authorized, drawing a
// prepaid pool credit. This file is the ONLY coverage of the FlushFees / SweepExcessReserve / DepositProtocolFee-bounce
// / reserve fee-safety receivers, which are UNCHANGED by B3. Only the SEEDING moved: accrued fees are now accrued by
// PUBLISHING real PUBLIC/PRIVATE parts over the anon path (each stored PUBLIC part accrues PLATO_PUBLIC_POST_FEE_TON,
// each PRIVATE part accrues PLATO_PRIVATE_LONG_TERM_FEE_TON, INTRO accrues 0) instead of a free-parameter
// protocol_fee_total. Every fee-safety assertion (accrued values, bounce-restore, sweep protection, the exact
// 13200-13206 / 13220-13224 error codes, forged-bounce 13203 rejection) is preserved verbatim.
//
// setupHubFee() below produces an anon-READY Hub (deployed UNSEALED, then BindDeploymentManifest -> BindCreditIssuer
// -> SealGenesis -> HubMirrorIssuerKey -> FundAnonPool), because the anon path needs a funded pool + a mirrored issuer
// key + a bound credit issuer that a sealed-via-init Hub does not have. The `feeAccumulatorDeployed` knob is preserved:
// when false the FeeAccumulator address is init'd but NOT deployed, so FlushFees' deposit bounces and the
// bounce-restore path is exercised; when true a real FeeAccumulator is deployed so its accumulated_ton getter reads.

const PLATO_PUBLIC_FEE = 10_000_000n;             // full per-part public fee (PLATO_PUBLIC_POST_FEE_TON)
const PLATO_PRIVATE_HYBRID_FEE = 10_000_000n;     // full per-part private hybrid fee (PLATO_PRIVATE_LONG_TERM_FEE_TON)
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE = CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE;
const CAPSULEHUB_SWEEP_CALLER_RESERVE = CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE;
const FEEACCUMULATOR_SPLIT_EXEC_RESERVE = 2_000_000n;
const FEEACCUMULATOR_FLUSH_EXEC_RESERVE = 5_000_000n;
const CAPSULEHUB_MIN_PROTECTED_RESERVE = 100_000_000_000n;
// [G8 CANONICAL] Per-entry 1-yr storage reserve = the endowment alone (@64962/cell/yr frozen). Mirrors the single
// derivation in CapsuleHub.tact: measured_cells x 64962 x 1yr x 1.5 rate-risk margin. The per-entry keepalive(1M)
// was dropped — the 100-TON reserve floor covers liveness (RT3-#6), so charging it per entry double-billed.
const CAPSULEHUB_PRIVATE_INDEX_1Y = 784_000n;      // 8.02 cells measured (WORST 1-yr lane: two headers)
const CAPSULEHUB_PUBLIC_INDEX_1Y = 589_000n;       // 6.02 cells measured (fresh channel index per post)
const OP_DEPOSIT_PROTOCOL_FEE = 0xff775609;

const START_NOW = 1_700_000_000;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(label).digest('hex'));
}

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

// The opaque bucketKey a convPartToken(fill=f) part carries: header0 = finalPrivateHeader0Cell(0x30 + f), and the
// Hub reads bucketKey from bits[64,320) of that 40-byte cell (privateHeaderBucketKey: skip 64 meta bits, load 256).
function convBucketKey(fill: number): bigint {
  const s = finalPrivateHeader0Cell(0x30 + fill).beginParse();
  s.skip(64);
  return s.loadUintBig(256);
}

// Build an anon-READY CapsuleHub bound+sealed to a FeeAccumulator address (mirrors the frozen genesis ceremony:
// unsealed deploy -> BindDeploymentManifest(vault stand-in) -> BindCreditIssuer -> SealGenesis -> HubMirrorIssuerKey
// -> FundAnonPool). `feeAccumulatorDeployed`:
//   true  -> a real FeeAccumulator contract is deployed at the bound address (its getGetState is readable),
//   false -> the bound address is an undeployed account (FlushFees/Sweep deposits bounce back to the Hub).
// The FeeAccumulator address is deterministic in `treasuryReceiver` + BUYBACK_RECEIVER, so the undeployed case can be
// deployed later (RT-CFEE-001) at exactly the address the Hub is bound to. The Hub balance is set AFTER the ceremony
// so the FlushFees/Sweep reserve math is deterministic (an anon publish keeps its pre-existing balance verbatim).
async function setupHubFee(opts: { feeAccumulatorDeployed: boolean; balance?: bigint } = { feeAccumulatorDeployed: true }) {
  const blockchain = await Blockchain.create();
  blockchain.now = START_NOW;
  const deployer = await blockchain.treasury('cap-fee-deployer');       // genesis controller
  const vaultStandIn = await blockchain.treasury('cap-fee-vault');      // SealGenesis requires a bound vault
  const creditIssuer = await blockchain.treasury('cap-fee-credit-issuer');
  const operator = await blockchain.treasury('cap-fee-operator');       // FlushFees/Sweep are permissionless
  const relay = await blockchain.treasury('cap-fee-relay');             // any treasury may relay an anon batch
  const treasuryReceiver = await blockchain.treasury('cap-fee-treasury');

  const feeInit = await FeeAccumulator.init(treasuryReceiver.address, fixtureAddress('BUYBACK_RECEIVER'));
  const feeAccumulatorAddress = contractAddress(0, feeInit);
  let feeAccumulator: FeeAccumulator | null = null;
  if (opts.feeAccumulatorDeployed) {
    await blockchain.setShardAccount(feeAccumulatorAddress, createShardAccount({
      address: feeAccumulatorAddress, code: feeInit.code, data: feeInit.data, balance: 0n, workchain: 0,
    }));
    feeAccumulator = blockchain.openContract(new FeeAccumulator(feeAccumulatorAddress, feeInit));
  }

  // Unsealed, unbound Hub bound to the (maybe-undeployed) fee address; genesis controller = deployer.
  const init = await CapsuleHub.init(feeAccumulatorAddress, fixtureAddress('UNBOUND_VAULT'), false, false, 0n, deployer.address);
  const hubAddress = contractAddress(0, init);
  await blockchain.setShardAccount(hubAddress, createShardAccount({
    address: hubAddress, code: init.code, data: init.data, balance: toNano('200'), workchain: 0,
  }));
  const hub = blockchain.openContract(new CapsuleHub(hubAddress, init));

  const slot = 0n;
  const issuer = issuerKey(0x11);
  const nowEpoch = BigInt(Math.floor(blockchain.now / EPOCH_SECONDS));
  const send = (body: any) => hub.send(deployer.getSender(), { value: toNano('0.05') }, body);
  await send({ $$type: 'BindDeploymentManifest', deployment_manifest_hash: HUB_MANIFEST, counterpart_address: vaultStandIn.address });
  await send({ $$type: 'BindCreditIssuer', credit_issuer_address: creditIssuer.address });
  await send({ $$type: 'SealGenesis', deployment_manifest_hash: HUB_MANIFEST });
  await send({ $$type: 'HubMirrorIssuerKey', slot, pubkey: bufToInt(issuer.publicKey), active: true, version: 0n });
  await fundPool(hub, creditIssuer, 4n, nowEpoch);

  // Pin the Hub balance to the test's requested value (post-ceremony). The pool/issuer state lives in the data cell,
  // not the raw balance, so overriding the coins is safe and makes the reserve-floor math (13206/13223) deterministic.
  const sc = await blockchain.getContract(hubAddress);
  sc.balance = opts.balance ?? toNano('200');

  return {
    blockchain, hub, deployer, vaultStandIn, creditIssuer, operator, relay, treasuryReceiver,
    feeAccumulator, feeAccumulatorAddress, issuer, slot, nowEpoch, _seedCursor: 0,
  };
}

// Seed accrued_plato_fee_ton by PUBLISHING real parts over the anon path. Each stored PUBLIC or PRIVATE part accrues
// exactly PLATO_PUBLIC_FEE (= the Hub's own constant; a relay cannot spoof it), so `feeTotal` MUST be a multiple of
// PLATO_PUBLIC_FEE — the parts published = feeTotal / PLATO_PUBLIC_FEE (or an explicit partCount, <= MAX_BATCH_PARTS_ANON
// = 4 per batch). Each part uses a distinct spend key + nonce (tracked across seeds via env._seedCursor) so no nullifier
// is ever reused. Returns { publishId, res } for callers that inspect the publish.
async function seedAccruedFee(
  env: any,
  opts: { kind?: bigint; partCount?: number; feeTotal: bigint; publishId: bigint; value?: bigint },
): Promise<{ publishId: bigint; res: any }> {
  const kind = opts.kind ?? KIND_PUBLIC;
  const partCount = opts.partCount ?? Number(opts.feeTotal / PLATO_PUBLIC_FEE);
  const start = env._seedCursor;

  // Build the part+token chain tail-first so each non-last node carries the linked next ref.
  let node: any = null;
  for (let i = partCount - 1; i >= 0; i -= 1) {
    const idx = start + i;
    const base = {
      issuer: env.issuer, spend: spendKey(idx), slot: env.slot, epoch: env.nowEpoch,
      nonce: BigInt(1000 + idx), fill: idx % 90, next: node,
    };
    node = kind === KIND_PUBLIC ? publicPartToken(base) : convPartToken({ ...base, kind: KIND_PRIVATE });
  }
  env._seedCursor = start + partCount;

  const res = await env.hub.send(env.relay.getSender(), { value: opts.value ?? toNano('0.5') }, anonBatch({
    parts: node.part,
    tokens: node.tok,
    partCount: BigInt(partCount),
    kind,
    publishId: opts.publishId,
    marketing: kind === KIND_PUBLIC ? marketingCell() : null,
  }));
  expect(hubTxExit(res, env.hub)).toBe(0);
  return { publishId: opts.publishId, res };
}

describe('CapsuleHub fee / sweep / backing safety — B3 anon path', () => {
  // CAPSULE-04/CAPSULE-ID-04: removed — covered by HUB-BATCH-01 (capsulehub-batch-ingest.test.ts)
  // CAPSULE-05: removed — covered by HUB-BATCH-03 (capsulehub-batch-ingest.test.ts)
  // CAP-REJECT-07: removed — covered by HUB-BATCH-02 (capsulehub-batch-ingest.test.ts)
  // CAP-REJECT-08 / 13506: removed — clean-16 B3 has no relay-supplied protocol_fee_total; each part accrues the
  //   Hub's OWN per-kind constant, so the aggregate over-charge guard (13506) no longer exists to test.
  // NO-ADMIN / 13500 sender==vault gate: removed — the publish path is permissionless (any relay treasury), so there
  //   is no sender==vault gate to probe. Relay-permissionlessness lives in capsulehub-anon-spend.test.ts.

  it('CAPSULE-FEE-01/02/03/04: FlushFees(amount) is bounce-safe and restores accrued on bounce', async () => {
    // Fee accumulator is UNDEPLOYED -> the DepositProtocolFee bounces, and the bounced<DepositProtocolFee>
    // handler restores the debited accrued fee. Net accrued is unchanged across the flush round-trip.
    const env = await setupHubFee({
      feeAccumulatorDeployed: false,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });
    const { hub, operator } = env;

    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-bounce-seed'), kind: KIND_PUBLIC });
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);

    // Debited then restored by the bounce handler -> back to the seeded amount.
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
  });

  it('RT-FEE-003/CAPSULE-FEE-01/05: FlushFees debits CapsuleHub and credits FeeAccumulator with exact backing', async () => {
    const env = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });
    const { blockchain, hub, operator, feeAccumulator } = env;

    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-flush-seed'), kind: KIND_PUBLIC });
    const beforeHubState = await hub.getGetState();
    const beforeFeeState = await feeAccumulator!.getGetState();
    expect(beforeHubState.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
    expect(beforeFeeState.accumulated_ton).toBe(0n);
    expect(await contractBalance(blockchain, hub.address)).toBeGreaterThanOrEqual(beforeHubState.accrued_plato_fee_ton);

    const flush = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);

    const state = await hub.getGetState();
    expect(state.accrued_plato_fee_ton).toBe(0n);

    const depositTx = findTransaction(flush.transactions, {
      from: hub.address,
      to: feeAccumulator!.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
      success: true,
    });
    expect(depositTx).toBeDefined();
    expect(inboundValue(depositTx)).toBe(PLATO_PUBLIC_FEE + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

    const feeState = await feeAccumulator!.getGetState();
    expect(feeState.accumulated_ton).toBe(PLATO_PUBLIC_FEE);
    expect(await contractBalance(blockchain, hub.address)).toBeGreaterThanOrEqual(state.accrued_plato_fee_ton);
    expect(await contractBalance(blockchain, feeAccumulator!.address)).toBeGreaterThanOrEqual(feeState.accumulated_ton);
    const unaccountedBalance = (await contractBalance(blockchain, feeAccumulator!.address)) - feeState.accumulated_ton;
    expect(unaccountedBalance).toBeLessThanOrEqual(CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);
  });

  it('RT-CFEE-003: three public fees flush, split, and treasury-flush with exact bucket conservation', async () => {
    const env = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });
    const { blockchain, hub, operator, treasuryReceiver, feeAccumulator } = env;
    const expectedFee = PLATO_PUBLIC_FEE * 3n;

    // Seed 3 public fees in a single 3-part anon batch (each part accrues PLATO_PUBLIC_POST_FEE_TON).
    await seedAccruedFee(env, {
      feeTotal: expectedFee,
      publishId: hash256('rt-cfee-003-public-batch'),
      kind: KIND_PUBLIC,
      partCount: 3,
      value: toNano('0.5'),
    });
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(expectedFee);

    const flush = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: expectedFee,
    } as FlushFees);

    const depositTx = findTransaction(flush.transactions, {
      from: hub.address,
      to: feeAccumulator!.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
      success: true,
    });
    expect(depositTx).toBeDefined();
    expect(inboundValue(depositTx)).toBe(expectedFee + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(0n);

    let feeState = await feeAccumulator!.getGetState();
    expect(feeState.accumulated_ton).toBe(expectedFee);
    expect(feeState.treasury_due_ton).toBe(0n);
    expect(feeState.buyback_due_ton).toBe(0n);

    await feeAccumulator!.send(operator.getSender(), { value: FEEACCUMULATOR_SPLIT_EXEC_RESERVE }, {
      $$type: 'SplitAccumulated',
    } as SplitAccumulated);

    feeState = await feeAccumulator!.getGetState();
    expect(feeState.accumulated_ton).toBe(0n);
    expect(feeState.treasury_due_ton).toBe(expectedFee);
    expect(feeState.buyback_due_ton).toBe(0n);

    const treasuryFlush = await feeAccumulator!.send(operator.getSender(), { value: FEEACCUMULATOR_FLUSH_EXEC_RESERVE }, {
      $$type: 'FlushTreasuryDue',
      amount: expectedFee,
    } as FlushTreasuryDue);

    const treasuryTx = findTransaction(treasuryFlush.transactions, {
      from: feeAccumulator!.address,
      to: treasuryReceiver.address,
      success: true,
    });
    expect(treasuryTx).toBeDefined();
    expect(inboundValue(treasuryTx)).toBe(expectedFee);

    feeState = await feeAccumulator!.getGetState();
    expect(feeState.accumulated_ton).toBe(0n);
    expect(feeState.treasury_due_ton).toBe(0n);
    expect(feeState.buyback_due_ton).toBe(0n);
    expect(await contractBalance(blockchain, feeAccumulator!.address)).toBeGreaterThanOrEqual(0n);
  });

  it('CAPSULE-FEE-06: dust or locally underfunded FlushFees cannot drain CapsuleHub reserve', async () => {
    // Default ~1 TON Hub balance: the protected reserve (100 TON floor) exceeds the balance, so even a
    // properly-funded full-amount flush is blocked by 13206. This reproduces the original three-leg guard:
    //   underfunded exec (13202) -> sub-floor dust (13205) -> full amount but balance < reserve (13206).
    const env = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: toNano('1'),
    });
    const { hub, operator } = env;

    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-06-seed'), kind: KIND_PUBLIC });
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    // Underfunded local exec value -> 13202 bounce, accrued unchanged.
    const r1 = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE - 1n }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);
    expect(hubTxExit(r1, hub)).toBe(13202);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    // Dust amount below the min-flush floor that is NOT the whole bucket -> 13205 bounce, accrued unchanged.
    const r2 = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);
    expect(hubTxExit(r2, hub)).toBe(13205);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    // Full amount, properly funded exec, but the Hub balance is below the protected reserve floor -> 13206.
    const r3 = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);
    expect(hubTxExit(r3, hub)).toBe(13206);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
  });

  // CAPSULE-FEE-DUST-01: DELETED (clean-16 B3). It seeded a sub-floor accrued bucket (1 nanoton) via a discounted
  // Vault-supplied protocol_fee_total to exercise the "amount == whole accrued bucket bypasses the 13205 min-flush
  // floor" branch. The anon path has no relay-supplied fee: every PUBLIC/PRIVATE part accrues exactly
  // PLATO_PUBLIC_POST_FEE_TON, which equals CAPSULEHUB_MIN_FEE_FLUSH_TON — so an accrued bucket strictly BELOW the
  // min-flush floor is no longer constructible, and the branch cannot be reached to test. (The 13205 floor itself is
  // still covered by CAPSULE-FEE-06's second leg.)

  it('CAPSULE-FEE-07: forged FeeAccumulator bounce from a non-accumulator sender cannot restore accrued fees', async () => {
    const env = await setupHubFee({ feeAccumulatorDeployed: true });
    const { blockchain, hub } = env;
    const attacker = await blockchain.treasury('cap-fee-07-attacker');

    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-07-seed'), kind: KIND_PUBLIC });
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    // A forged DepositProtocolFee bounce from a non-accumulator sender must be rejected by the 13203 sender
    // guard in bounced<DepositProtocolFee> -> accrued is NOT credited again.
    await blockchain.sendMessage(internal({
      from: attacker.address,
      to: hub.address,
      value: toNano('0.05'),
      bounced: true,
      bounce: false,
      body: beginCell()
        .storeUint(0xffffffff, 32)
        .store(storeDepositProtocolFee({
          $$type: 'DepositProtocolFee',
          amount: PLATO_PUBLIC_FEE,
        } as DepositProtocolFee))
        .endCell(),
    }));

    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
  });

  it('CAPSULE-PRIVATE-INDEX-01: private (CONV) publishes maintain ONE opaque bucket linked index, no directional graph', async () => {
    const env = await setupHubFee({ feeAccumulatorDeployed: true });
    const { hub, issuer, slot, nowEpoch, relay } = env;

    // clean-16: a private (CONV) capsule carries ONE opaque bucketKey in header0[8..40); there is no sender/recipient
    // keyId anymore. Two anon CONV batches under the SAME bucketKey (identical header0 fill) chain into one bucket
    // index; their spend keys/nonces differ so both parts publish. bucketKey is DERIVED from the part header, not a
    // relay-chosen value (the removed Vault path let the caller inject an arbitrary header0).
    const bucketKey = convBucketKey(0);
    const p0 = convPartToken({ issuer, spend: spendKey(0), slot, epoch: nowEpoch, nonce: 501n, fill: 0, kind: KIND_PRIVATE });
    const p1 = convPartToken({ issuer, spend: spendKey(1), slot, epoch: nowEpoch, nonce: 502n, fill: 0, kind: KIND_PRIVATE });

    await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: p0.part, tokens: p0.tok, partCount: 1n, kind: KIND_PRIVATE, publishId: hash256('indexed-private-publish-1'),
    }));
    await hub.send(relay.getSender(), { value: toNano('0.3') }, anonBatch({
      parts: p1.part, tokens: p1.tok, partCount: 1n, kind: KIND_PRIVATE, publishId: hash256('indexed-private-publish-2'),
    }));

    const bucketIndex = await hub.getGetPrivateBucketIndex(bucketKey);
    expect(bucketIndex).toMatchObject({
      exists: true,
      bucket_key: bucketKey,
      latest_entry_id: 1n,
      latest_entry_link: 2n,
      entry_count: 2n,
    });

    // D7-override: there is no sender-keyed or recipient-keyed getter to reconstruct a who-to-whom edge; the
    // only private-lane index getter is the opaque bucket one. Entries carry a single backward bucket link.
    const firstEntry = await hub.getGetPrivateEntry(0n);
    const secondEntry = await hub.getGetPrivateEntry(1n);
    expect(firstEntry.bucket_prev_link).toBe(0n);
    expect(secondEntry.bucket_prev_link).toBe(1n);
    expect((hub as unknown as Record<string, unknown>).getGetPrivateRecipientIndex).toBeUndefined();
    expect((hub as unknown as Record<string, unknown>).getGetPrivateSenderIndex).toBeUndefined();
  });

  it('CAPSULE-BACKING-01: an anon publish retains the accrued protocol fee on-balance (relay gets only the gas float)', async () => {
    // Re-framed from CAPSULE-VAULT-BACKING-01. The removed Vault-forward model reserved fee + storage and returned
    // only the ACK surplus. The anon-path equivalent: the prepaid pool backs the endowment (already on-balance) and
    // the publish keeps its ENTIRE pre-existing balance (nativeReserve ReserveAddOriginalBalance), returning only the
    // unspent gas float to the relay — so the accrued protocol fee stays retained and backed, never leaked as ACK excess.
    const env = await setupHubFee({ feeAccumulatorDeployed: true });
    const { blockchain, hub } = env;

    await seedAccruedFee(env, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('backing-seed'), kind: KIND_PRIVATE });

    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.private_live_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_HYBRID_FEE);
    // The accrued fee is backed by retained balance (the publish kept its pre-existing balance, not returned as excess).
    expect(await contractBalance(blockchain, hub.address)).toBeGreaterThanOrEqual(PLATO_PRIVATE_HYBRID_FEE);
  });

  it('CAPSULE-RESERVE-01: SweepExcessReserve protects accrued fees plus 1.25x live-index reserve and sends only surplus to FeeAccumulator', async () => {
    const env = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: toNano('101'),
    });
    const { blockchain, hub, operator, feeAccumulator } = env;

    // One private + one public publish -> live counts 1/1 and a non-trivial dynamic index reserve.
    await seedAccruedFee(env, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('reserve-01-private'), kind: KIND_PRIVATE });
    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('reserve-01-public'), kind: KIND_PUBLIC });

    const state = await hub.getGetState();
    expect(state.private_live_count).toBe(1n);
    expect(state.public_live_count).toBe(1n);
    expect(state.index_storage_reserve_ton).toBe(((CAPSULEHUB_PRIVATE_INDEX_1Y + CAPSULEHUB_PUBLIC_INDEX_1Y) * 125n) / 100n);
    expect(state.reserve_floor_ton).toBe(CAPSULEHUB_MIN_PROTECTED_RESERVE);
    expect(state.protected_reserve_ton).toBe(CAPSULEHUB_MIN_PROTECTED_RESERVE + state.accrued_plato_fee_ton);
    expect(state.reserve_buffer_numerator).toBe(125n);
    expect(state.reserve_buffer_denominator).toBe(100n);

    // A sweep larger than the available surplus is rejected (13224); nothing leaves.
    const tooMuch = await hub.send(operator.getSender(), { value: CAPSULEHUB_SWEEP_CALLER_RESERVE }, {
      $$type: 'SweepExcessReserve',
      amount: toNano('2'),
    } as SweepExcessReserve);
    expect(findTransaction(tooMuch.transactions, {
      from: hub.address,
      to: feeAccumulator!.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
    })).toBeUndefined();
    expect((await feeAccumulator!.getGetState()).accumulated_ton).toBe(0n);

    // A within-surplus sweep deposits exactly amount + exec reserve to the accumulator.
    const sweepAmount = toNano('0.5');
    const sweep = await hub.send(operator.getSender(), { value: CAPSULEHUB_SWEEP_CALLER_RESERVE }, {
      $$type: 'SweepExcessReserve',
      amount: sweepAmount,
    } as SweepExcessReserve);

    const depositTx = findTransaction(sweep.transactions, {
      from: hub.address,
      to: feeAccumulator!.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
      success: true,
    });
    expect(depositTx).toBeDefined();
    expect(inboundValue(depositTx)).toBe(sweepAmount + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);
    expect((await feeAccumulator!.getGetState()).accumulated_ton).toBe(sweepAmount);
    expect(await contractBalance(blockchain, hub.address)).toBeGreaterThan(state.protected_reserve_ton - toNano('0.01'));
  });

  it('CAPSULE-RESERVE-01B: bounced reserve sweep is reclassified as backed accrued fee due', async () => {
    const env = await setupHubFee({
      feeAccumulatorDeployed: false,
      balance: toNano('101'),
    });
    const { hub, operator } = env;

    await seedAccruedFee(env, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('reserve-01b-private'), kind: KIND_PRIVATE });
    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('reserve-01b-public'), kind: KIND_PUBLIC });

    const before = await hub.getGetState();
    const sweepAmount = toNano('0.5');
    const sweep = await hub.send(operator.getSender(), { value: CAPSULEHUB_SWEEP_CALLER_RESERVE }, {
      $$type: 'SweepExcessReserve',
      amount: sweepAmount,
    } as SweepExcessReserve);

    // The deposit goes out (to the undeployed accumulator) and bounces; the bounce handler reclassifies the
    // returned excess as accrued fee due.
    expect(findTransaction(sweep.transactions, {
      from: hub.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
    })).toBeDefined();
    const after = await hub.getGetState();
    expect(after.accrued_plato_fee_ton).toBe(before.accrued_plato_fee_ton + sweepAmount);
    expect(after.protected_reserve_ton).toBe(before.protected_reserve_ton + sweepAmount);
  });

  it('RT-CFEE-001: bounced reserve sweep can later flush through normal FeeAccumulator deposit path', async () => {
    const env = await setupHubFee({
      feeAccumulatorDeployed: false,
      balance: toNano('101'),
    });
    const { blockchain, hub, operator, feeAccumulatorAddress, treasuryReceiver } = env;

    await seedAccruedFee(env, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('rt-cfee-001-private'), kind: KIND_PRIVATE });
    await seedAccruedFee(env, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('rt-cfee-001-public'), kind: KIND_PUBLIC });

    const before = await hub.getGetState();
    const sweepAmount = toNano('0.5');
    const sweep = await hub.send(operator.getSender(), { value: CAPSULEHUB_SWEEP_CALLER_RESERVE }, {
      $$type: 'SweepExcessReserve',
      amount: sweepAmount,
    } as SweepExcessReserve);

    const bouncedDeposit = findTransaction(sweep.transactions, {
      from: hub.address,
      to: feeAccumulatorAddress,
      op: OP_DEPOSIT_PROTOCOL_FEE,
    });
    expect(bouncedDeposit).toBeDefined();
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(before.accrued_plato_fee_ton + sweepAmount);

    // Now deploy a real FeeAccumulator at the configured address and flush the reclassified amount.
    const feeInit = await FeeAccumulator.init(treasuryReceiver.address, fixtureAddress('BUYBACK_RECEIVER'));
    await blockchain.setShardAccount(feeAccumulatorAddress, createShardAccount({
      address: feeAccumulatorAddress, code: feeInit.code, data: feeInit.data, balance: 0n, workchain: 0,
    }));
    const feeAccumulator = blockchain.openContract(new FeeAccumulator(feeAccumulatorAddress, feeInit));

    const flush = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: sweepAmount,
    } as FlushFees);

    const depositTx = findTransaction(flush.transactions, {
      from: hub.address,
      to: feeAccumulator.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
      success: true,
    });
    expect(depositTx).toBeDefined();
    expect(inboundValue(depositTx)).toBe(sweepAmount + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);
    expect((await feeAccumulator.getGetState()).accumulated_ton).toBe(sweepAmount);

    const after = await hub.getGetState();
    expect(after.accrued_plato_fee_ton).toBe(before.accrued_plato_fee_ton);
    expect(after.protected_reserve_ton).toBe(before.protected_reserve_ton);
    expect(await contractBalance(blockchain, hub.address)).toBeGreaterThanOrEqual(after.protected_reserve_ton);
  });

  // Retention / eviction is now FIFO auto-eviction folded into the publish path (no standalone PruneCapsuleEntry
  // op). Its coverage — retention gate, FIFO order, index un-push, entry_count exactness, state bounding, both
  // kinds — lives in tests/capsulehub-eviction.test.ts.
});
