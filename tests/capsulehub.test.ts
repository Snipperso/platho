import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { findTransaction } from '@ton/test-utils';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  DepositProtocolFee,
  FlushFees,
  PruneCapsuleEntry,
  SweepExcessReserve,
  storeDepositProtocolFee,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  FeeAccumulator,
  FlushTreasuryDue,
  SplitAccumulated,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import {
  finalPrivateHeader1Cell,
  finalPrivateBodyCell,
  snakeCellFromBytes,
} from './helpers/capsule-cells';
import {
  HUB_MANIFEST,
  KIND_PRIVATE,
  KIND_PUBLIC,
  SIZE_1K,
  SUITE_HYBRID,
  cellHash,
  computeEntryPublishId,
  marketingCell,
  partsList,
  publishBatchToHub,
  hubTxExit,
} from './helpers/vpb2';

// CapsuleHub fee/sweep/prune coverage — migrated onto the VPB2 batch ingest (PublishBatchToHub). The single-
// publish receivers (PublishPrivateFromVault / PublishPublicFromVault) and the MockVaultAckSink are GONE; the
// bound Vault is now a treasury that drives the Hub via the batch op and accrued fees are seeded with a 1-part
// publishBatchToHub(protocol_fee_total = X). The fee/sweep/prune receivers themselves are UNCHANGED — these
// tests are the only coverage of those features, so they must stay green.
//
// We cannot edit the shared helper, so the deployed-FeeAccumulator scaffolding is inlined locally:
// setupHub() in the helper wires the Hub to a *treasury* fee-accumulator address (good for bounce/undeployed
// cases), but RT-FEE-003 / RT-CFEE-003 / DUST / RESERVE-01 need a REAL FeeAccumulator contract whose
// accumulated_ton getter we can read — so setupHubFee() below binds the Hub to a real FeeAccumulator address
// (deployed or not, per the `feeAccumulatorDeployed` knob), mirroring the helper's bound+sealed init.

const PLATO_PUBLIC_FEE = 10_000_000n;             // full per-part public fee (PLATO_PUBLIC_POST_FEE_TON)
const PLATO_PRIVATE_HYBRID_FEE = 10_000_000n;     // full per-part private hybrid fee
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE = CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE;
const CAPSULEHUB_SWEEP_CALLER_RESERVE = CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE;
const FEEACCUMULATOR_SPLIT_EXEC_RESERVE = 2_000_000n;
const FEEACCUMULATOR_FLUSH_EXEC_RESERVE = 5_000_000n;
const CAPSULEHUB_INDEX_RETENTION_SECONDS = 31_536_000;
const CAPSULEHUB_MIN_PROTECTED_RESERVE = 100_000_000_000n;
const CAPSULEHUB_PRIVATE_INDEX_1Y = 4_300_000n;   // keepalive(1M) + private endowment(3.3M)
const CAPSULEHUB_PUBLIC_INDEX_1Y = 8_400_000n;    // keepalive(1M) + public endowment(7.4M)
const CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE = 2_000_000n;
const OP_DEPOSIT_PROTOCOL_FEE = 0xff775609;

const START_NOW = 1_700_000_000;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(label).digest('hex'));
}

function uint256Buffer(value: bigint): Buffer {
  if (value < 0n || value >= (1n << 256n)) throw new RangeError('uint256 out of range');
  return Buffer.from(value.toString(16).padStart(64, '0'), 'hex');
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

// A private header_0 whose first 64 bits are the PLTHPRIV magic and whose two 256-bit fields are the sender
// and recipient key ids the Hub's index reader extracts. Built to the EXACT 140-byte (1120-bit, 2-cell, 1-ref)
// shape requireExactPayloadCell enforces, so the part validates AND the index links resolve to our key ids.
function privateHeader0WithKeyIds(senderKeyId: bigint, recipientKeyId: bigint): Cell {
  const bytes = Buffer.alloc(140, 0x44);
  bytes.writeBigUInt64BE(0x504c544850524956n, 0); // "PLTHPRIV"
  uint256Buffer(senderKeyId).copy(bytes, 8);
  uint256Buffer(recipientKeyId).copy(bytes, 40);
  return snakeCellFromBytes(bytes);
}

// A 1-part private batch whose part embeds the given header_0 (so its sender/recipient key ids land in the
// index), with a distinct body fill so adjacent batches are non-duplicate.
function privatePartWithHeader0(header0: Cell, bodyFill: number): Cell {
  const h1 = finalPrivateHeader1Cell(0x31);
  const body = finalPrivateBodyCell(SIZE_1K, bodyFill);
  return beginCell()
    .storeUint(SIZE_1K, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(header0), 256).storeUint(cellHash(h1), 256).storeUint(cellHash(body), 256)
    .storeRef(header0).storeRef(h1).storeRef(body)
    .endCell();
}

// Local Hub setup bound+sealed to a REAL FeeAccumulator address (mirrors the frozen setupHub init exactly,
// only the fee-accumulator slot differs). `feeAccumulatorDeployed`:
//   true  -> a FeeAccumulator contract is deployed at the bound address (its getGetState is readable),
//   false -> the bound address is an undeployed account (deposits bounce back to the Hub).
// Returns the same shape as the helper's setupHub plus the deployed `feeAccumulator` (or null) and operator.
async function setupHubFee(opts: { feeAccumulatorDeployed: boolean; balance?: bigint } = { feeAccumulatorDeployed: true }) {
  const blockchain = await Blockchain.create();
  blockchain.now = START_NOW;
  const vault = await blockchain.treasury('vpb2-bound-vault');
  const controller = await blockchain.treasury('vpb2-controller');
  const operator = await blockchain.treasury('cap-fee-operator');
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

  const init = await CapsuleHub.init(feeAccumulatorAddress, vault.address, true, true, HUB_MANIFEST, controller.address);
  const addr = contractAddress(0, init);
  await blockchain.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: opts.balance ?? toNano('200'), workchain: 0,
  }));
  const hub = blockchain.openContract(new CapsuleHub(addr, init));
  return { blockchain, hub, vault, controller, operator, treasuryReceiver, feeAccumulator, feeAccumulatorAddress };
}

// Seed accrued_plato_fee_ton with a single successful batch publish carrying protocol_fee_total = feeTotal.
// Returns the batch publish_id (the EPI1 seed) so prune tests can authenticate the stored entry.
async function seedAccruedFee(
  hub: any,
  vault: any,
  opts: {
    kind?: bigint;
    partCount?: number;
    feeTotal: bigint;
    publishId: bigint;
    header0?: Cell;
    bodyFill?: number;
    value?: bigint;
  },
): Promise<{ publishId: bigint; res: any }> {
  const kind = opts.kind ?? KIND_PRIVATE;
  const partCount = opts.partCount ?? 1;
  let parts: Cell;
  if (kind === KIND_PRIVATE && opts.header0) {
    parts = privatePartWithHeader0(opts.header0, opts.bodyFill ?? 0x90);
  } else {
    parts = partsList(kind, partCount);
  }
  const res = await hub.send(vault.getSender(), { value: opts.value ?? toNano('0.2') }, publishBatchToHub({
    parts,
    authorWallet: vault.address,
    publishId: opts.publishId,
    kind,
    partCount: BigInt(partCount),
    protocolFeeTotal: opts.feeTotal,
    marketing: kind === KIND_PUBLIC ? marketingCell() : null,
  }));
  return { publishId: opts.publishId, res };
}

describe('CapsuleHub v1 milestone 1 (VPB2 batch path)', () => {
  // CAPSULE-04/CAPSULE-ID-04: removed — covered by HUB-BATCH-01 (capsulehub-batch-ingest.test.ts)
  // CAPSULE-05: removed — covered by HUB-BATCH-03 (capsulehub-batch-ingest.test.ts)
  // CAP-REJECT-07: removed — covered by HUB-BATCH-02 (capsulehub-batch-ingest.test.ts)
  // CAP-REJECT-08: removed — no per-entry fee field in a batch; the aggregate guard 13506
  //   (protocol_fee_total <= part_count * fullFeePerPart) covers over-charging.
  // NO-ADMIN: removed — the empty/fallback receiver now throws (13999); there is no silent fallback to probe.

  it('CAPSULE-FEE-01/02/03/04: FlushFees(amount) is bounce-safe and restores accrued on bounce', async () => {
    // Fee accumulator is UNDEPLOYED -> the DepositProtocolFee bounces, and the bounced<DepositProtocolFee>
    // handler restores the debited accrued fee. Net accrued is unchanged across the flush round-trip.
    const { hub, vault, operator } = await setupHubFee({
      feeAccumulatorDeployed: false,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-bounce-seed'), kind: KIND_PUBLIC });
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);

    // Debited then restored by the bounce handler -> back to the seeded amount.
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
  });

  it('RT-FEE-003/CAPSULE-FEE-01/05: FlushFees debits CapsuleHub and credits FeeAccumulator with exact backing', async () => {
    const { blockchain, hub, vault, operator, feeAccumulator } = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-flush-seed'), kind: KIND_PUBLIC });
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
    const { blockchain, hub, vault, operator, treasuryReceiver, feeAccumulator } = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });
    const expectedFee = PLATO_PUBLIC_FEE * 3n;

    // Seed 3 public fees in a single 3-part batch (protocol_fee_total = 3 * full fee, the 13506 ceiling).
    await seedAccruedFee(hub, vault, {
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
    const { hub, vault, operator } = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: toNano('1'),
    });

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-06-seed'), kind: KIND_PUBLIC });
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

  it('CAPSULE-FEE-DUST-01: final discounted Vault fee below min flushes when it is the whole accrued bucket', async () => {
    const { hub, vault, operator, feeAccumulator } = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: CAPSULEHUB_MIN_PROTECTED_RESERVE + toNano('1'),
    });

    // A discounted batch fee of 1 nanoton (allowed: 1 <= part_count * fullFee) seeds a sub-floor bucket.
    await seedAccruedFee(hub, vault, { feeTotal: 1n, publishId: hash256('discounted-dust-publish'), kind: KIND_PUBLIC });
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(1n);

    // Underfunded local exec -> 13202 bounce, bucket intact.
    const underfunded = await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE - 1n }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);
    expect(hubTxExit(underfunded, hub)).toBe(13202);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(1n);

    // Properly funded: amount == accrued bucket bypasses the min-floor (13205) -> flushes the dust.
    await hub.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(0n);
    expect((await feeAccumulator!.getGetState()).accumulated_ton).toBe(1n);
  });

  it('CAPSULE-FEE-07: forged FeeAccumulator bounce from a non-accumulator sender cannot restore accrued fees', async () => {
    const { blockchain, hub, vault, operator } = await setupHubFee({ feeAccumulatorDeployed: true });
    const attacker = await blockchain.treasury('cap-fee-07-attacker');

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('fee-07-seed'), kind: KIND_PUBLIC });
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

  it('CAPSULE-PRIVATE-INDEX-01: private publishes maintain sender and recipient linked indexes', async () => {
    const { blockchain, hub, vault, operator } = await setupHubFee({ feeAccumulatorDeployed: true });
    const senderKeyId = hash256('capsule-private-index-sender');
    const recipientKeyId = hash256('capsule-private-index-recipient');
    const header0 = privateHeader0WithKeyIds(senderKeyId, recipientKeyId);

    // Two private batches sharing the same sender/recipient key ids -> two linked index entries (ids 0,1).
    const firstId = hash256('indexed-private-publish-1');
    const secondId = hash256('indexed-private-publish-2');
    await seedAccruedFee(hub, vault, {
      feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: firstId, kind: KIND_PRIVATE, header0, bodyFill: 0x41,
    });
    await seedAccruedFee(hub, vault, {
      feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: secondId, kind: KIND_PRIVATE, header0, bodyFill: 0x42,
    });

    const senderIndex = await hub.getGetPrivateSenderIndex(senderKeyId);
    const recipientIndex = await hub.getGetPrivateRecipientIndex(recipientKeyId);
    expect(senderIndex).toMatchObject({
      exists: true,
      key_id: senderKeyId,
      latest_entry_id: 1n,
      latest_entry_link: 2n,
      entry_count: 2n,
    });
    expect(recipientIndex).toMatchObject({
      exists: true,
      key_id: recipientKeyId,
      latest_entry_id: 1n,
      latest_entry_link: 2n,
      entry_count: 2n,
    });

    const firstEntry = await hub.getGetPrivateEntry(0n);
    const secondEntry = await hub.getGetPrivateEntry(1n);
    expect(firstEntry.sender_prev_link).toBe(0n);
    expect(firstEntry.recipient_prev_link).toBe(0n);
    expect(secondEntry.sender_prev_link).toBe(1n);
    expect(secondEntry.recipient_prev_link).toBe(1n);

    // Prune entry id 1 (the second batch) after retention -> index latest falls back to entry 0.
    blockchain.now = START_NOW + CAPSULEHUB_INDEX_RETENTION_SECONDS;
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE }, {
      $$type: 'PruneCapsuleEntry',
      kind: 1n,
      entry_id: 1n,
      publish_id: computeEntryPublishId(secondId, 0),
    } as PruneCapsuleEntry);

    expect((await hub.getGetPrivateSenderIndex(senderKeyId))).toMatchObject({
      exists: true,
      latest_entry_id: 0n,
      latest_entry_link: 1n,
      entry_count: 1n,
    });
    expect((await hub.getGetPrivateRecipientIndex(recipientKeyId))).toMatchObject({
      exists: true,
      latest_entry_id: 0n,
      latest_entry_link: 1n,
      entry_count: 1n,
    });
  });

  it('CAPSULE-VAULT-BACKING-01: Vault publish retains protocol fee backing instead of returning it as ACK excess', async () => {
    const { blockchain, hub, vault } = await setupHubFee({ feeAccumulatorDeployed: true });

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('backing-seed'), kind: KIND_PRIVATE });

    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.private_live_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_HYBRID_FEE);
    // The accrued fee is backed by retained balance (the ACK reserves fee + storage, returns only the surplus).
    expect(await contractBalance(blockchain, hub.address)).toBeGreaterThanOrEqual(PLATO_PRIVATE_HYBRID_FEE);
  });

  it('CAPSULE-RESERVE-01: SweepExcessReserve protects accrued fees plus 1.25x live-index reserve and sends only surplus to FeeAccumulator', async () => {
    const { blockchain, hub, vault, operator, feeAccumulator } = await setupHubFee({
      feeAccumulatorDeployed: true,
      balance: toNano('101'),
    });

    // One private + one public batch -> live counts 1/1 and a non-trivial dynamic index reserve.
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('reserve-01-private'), kind: KIND_PRIVATE });
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('reserve-01-public'), kind: KIND_PUBLIC });

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
    const { hub, vault, operator } = await setupHubFee({
      feeAccumulatorDeployed: false,
      balance: toNano('101'),
    });

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('reserve-01b-private'), kind: KIND_PRIVATE });
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('reserve-01b-public'), kind: KIND_PUBLIC });

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
    const { blockchain, hub, vault, operator, feeAccumulatorAddress, treasuryReceiver } = await setupHubFee({
      feeAccumulatorDeployed: false,
      balance: toNano('101'),
    });

    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: hash256('rt-cfee-001-private'), kind: KIND_PRIVATE });
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: hash256('rt-cfee-001-public'), kind: KIND_PUBLIC });

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

  it('CAPSULE-RETENTION-01: compact private/public entries can be pruned only after retention window', async () => {
    const { blockchain, hub, vault, operator } = await setupHubFee({ feeAccumulatorDeployed: true });

    const privateId = hash256('retention-01-private');
    const publicId = hash256('retention-01-public');
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: privateId, kind: KIND_PRIVATE });
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: publicId, kind: KIND_PUBLIC });

    const privateEntryPublishId = computeEntryPublishId(privateId, 0);
    const publicEntryPublishId = computeEntryPublishId(publicId, 0);

    // Before the retention window: prune is rejected (13502), entry survives.
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE }, {
      $$type: 'PruneCapsuleEntry',
      kind: 1n,
      entry_id: 0n,
      publish_id: privateEntryPublishId,
    } as PruneCapsuleEntry);
    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(true);

    blockchain.now = START_NOW + CAPSULEHUB_INDEX_RETENTION_SECONDS;

    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE }, {
      $$type: 'PruneCapsuleEntry',
      kind: 1n,
      entry_id: 0n,
      publish_id: privateEntryPublishId,
    } as PruneCapsuleEntry);
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE }, {
      $$type: 'PruneCapsuleEntry',
      kind: 2n,
      entry_id: 0n,
      publish_id: publicEntryPublishId,
    } as PruneCapsuleEntry);

    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(false);
    expect((await hub.getGetPublicEntry(0n)).exists).toBe(false);
    const state = await hub.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.public_latest_id).toBe(1n);
    expect(state.private_live_count).toBe(0n);
    expect(state.public_live_count).toBe(0n);
    expect((await hub.getGetPrivatePage(0n))).toMatchObject({
      exists: true,
      first_entry_id: 0n,
      next_entry_id: 1n,
      entry_count: 1n,
      opened_at: 0n,
      updated_at: 0n,
    });
  });

  it('CAPSULE-RETENTION-01B: underfunded prune cannot delete retained entries', async () => {
    const { blockchain, hub, vault, operator } = await setupHubFee({ feeAccumulatorDeployed: true });

    const privateId = hash256('retention-01b-private');
    const publicId = hash256('retention-01b-public');
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: privateId, kind: KIND_PRIVATE });
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PUBLIC_FEE, publishId: publicId, kind: KIND_PUBLIC });

    const privateEntryPublishId = computeEntryPublishId(privateId, 0);
    const publicEntryPublishId = computeEntryPublishId(publicId, 0);

    // Underfunded prune (below the exec reserve) -> 13530 bounce, entry survives even before the window.
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE - 1n }, {
      $$type: 'PruneCapsuleEntry',
      kind: 1n,
      entry_id: 0n,
      publish_id: privateEntryPublishId,
    } as PruneCapsuleEntry);
    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(true);
    expect((await hub.getGetState()).private_live_count).toBe(1n);

    blockchain.now = START_NOW + CAPSULEHUB_INDEX_RETENTION_SECONDS;

    // Still underfunded after the window -> still rejected; both kinds survive.
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE - 1n }, {
      $$type: 'PruneCapsuleEntry',
      kind: 1n,
      entry_id: 0n,
      publish_id: privateEntryPublishId,
    } as PruneCapsuleEntry);
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE - 1n }, {
      $$type: 'PruneCapsuleEntry',
      kind: 2n,
      entry_id: 0n,
      publish_id: publicEntryPublishId,
    } as PruneCapsuleEntry);

    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(true);
    expect((await hub.getGetPublicEntry(0n)).exists).toBe(true);
    const state = await hub.getGetState();
    expect(state.private_live_count).toBe(1n);
    expect(state.public_live_count).toBe(1n);
  });

  it('CAPSULE-RETENTION-02: prune authenticates publish id before deleting an entry', async () => {
    const { blockchain, hub, vault, operator } = await setupHubFee({ feeAccumulatorDeployed: true });

    const privateId = hash256('retention-02-private');
    await seedAccruedFee(hub, vault, { feeTotal: PLATO_PRIVATE_HYBRID_FEE, publishId: privateId, kind: KIND_PRIVATE });
    blockchain.now = START_NOW + CAPSULEHUB_INDEX_RETENTION_SECONDS;

    // A wrong publish_id fails the per-entry authentication (13501) even after the window -> entry survives.
    await hub.send(operator.getSender(), { value: CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE }, {
      $$type: 'PruneCapsuleEntry',
      kind: 1n,
      entry_id: 0n,
      publish_id: hash256('wrong-publish-id'),
    } as PruneCapsuleEntry);

    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(true);
  });
});
