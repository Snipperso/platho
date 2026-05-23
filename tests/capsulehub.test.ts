import { describe, expect, it } from 'vitest';
import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { findTransaction } from '@ton/test-utils';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  FlushFees,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import {
  MockVaultAckSink,
  ForwardVaultPrivate,
  ForwardVaultPublic,
} from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
  finalPublicBodyCell,
  finalPublicHeaderCell,
} from './helpers/capsule-cells';

const PLATO_PRIVATE_STANDARD_FEE = 5_000_000n;
const PLATO_PUBLIC_FEE = 5_000_000n;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE = CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE;
const CAPSULEHUB_ACK_FORWARD_RESERVE = 30_000_000n;
const OP_DEPOSIT_PROTOCOL_FEE = 0xff775609;
const OP_CAPSULEHUB_PUBLISH_ACK = 0x874e576a;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(label).digest('hex'));
}

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function setup(options?: { feeAccumulatorDeployed?: boolean; capsuleBalance?: bigint }) {
  const blockchain = await Blockchain.create();
  const author = await blockchain.treasury('author');
  const attacker = await blockchain.treasury('attacker');
  const operator = await blockchain.treasury('operator');
  const treasury = await blockchain.treasury('treasury-receiver');

  let feeAccumulatorAddress: Address;
  let feeAccumulator: FeeAccumulator | null = null;

  if (options?.feeAccumulatorDeployed === false) {
    feeAccumulatorAddress = fixtureAddress('UNDEPLOYED_FEE_ACCUMULATOR');
  } else if (options?.feeAccumulatorDeployed === true) {
    const feeAccumulatorInit = await FeeAccumulator.init(treasury.address, fixtureAddress('BUYBACK_RECEIVER'));
    feeAccumulatorAddress = contractAddress(0, feeAccumulatorInit);
    await blockchain.setShardAccount(
      feeAccumulatorAddress,
      createShardAccount({
        address: feeAccumulatorAddress,
        code: feeAccumulatorInit.code,
        data: feeAccumulatorInit.data,
        balance: 0n,
        workchain: feeAccumulatorAddress.workChain,
      }),
    );
    feeAccumulator = blockchain.openContract(new FeeAccumulator(feeAccumulatorAddress, feeAccumulatorInit));
  } else {
    feeAccumulatorAddress = treasury.address;
  }

  const mockVaultInit = await MockVaultAckSink.init();
  const mockVaultAddress = contractAddress(0, mockVaultInit);
  await blockchain.setShardAccount(
    mockVaultAddress,
    createShardAccount({
      address: mockVaultAddress,
      code: mockVaultInit.code,
      data: mockVaultInit.data,
      balance: toNano('1'),
      workchain: mockVaultAddress.workChain,
    }),
  );
  const mockVault = blockchain.openContract(new MockVaultAckSink(mockVaultAddress, mockVaultInit));

  const init = await CapsuleHub.init(feeAccumulatorAddress, mockVaultAddress, true, true, 0n, fixtureAddress('GENESIS_CONTROLLER'));
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: options?.capsuleBalance ?? toNano('1'),
      workchain: address.workChain,
    }),
  );

  const capsule = blockchain.openContract(new CapsuleHub(address, init));
  return { blockchain, capsule, author, attacker, operator, treasury, feeAccumulator, feeAccumulatorAddress, mockVault, mockVaultAddress };
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
}

function forwardVaultPrivate(capsuleAddress: Address, overrides?: Partial<ForwardVaultPrivate>): ForwardVaultPrivate {
  const sizeClass = overrides?.size_class ?? 1n;
  const header_0 = overrides?.header_0 ?? finalPrivateHeader0Cell(0x76);
  const header_1 = overrides?.header_1 ?? finalPrivateHeader1Cell(0x77);
  const body = overrides?.body ?? finalPrivateBodyCell(sizeClass, 0x78);
  return {
    $$type: 'ForwardVaultPrivate',
    capsule_hub_address: capsuleAddress,
    bounce_id: 1001n,
    publish_id: hash256('vault-private-publish-id'),
    size_class: sizeClass,
    crypto_suite: 1n,
    header_0_hash: cellHash(header_0),
    header_1_hash: cellHash(header_1),
    body_hash: cellHash(body),
    header_0,
    header_1,
    body,
    protocol_fee_paid: PLATO_PRIVATE_STANDARD_FEE,
    value_to_capsule: 100_000_000n,
    ...overrides,
  } as ForwardVaultPrivate;
}

function forwardVaultPublic(capsuleAddress: Address, author: Address, overrides?: Partial<ForwardVaultPublic>): ForwardVaultPublic {
  const header = overrides?.header ?? finalPublicHeaderCell(0x50);
  const body = overrides?.body ?? finalPublicBodyCell(0x79);
  return {
    $$type: 'ForwardVaultPublic',
    capsule_hub_address: capsuleAddress,
    bounce_id: 1002n,
    publish_id: hash256('vault-public-publish-id'),
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    header_hash: cellHash(header),
    body_hash: cellHash(body),
    header,
    body,
    protocol_fee_paid: PLATO_PUBLIC_FEE,
    value_to_capsule: 100_000_000n,
    ...overrides,
  } as ForwardVaultPublic;
}

describe('CapsuleHub v1 milestone 1', () => {
  it('CAPSULE-FEE-01/02/03/04: FlushFees(amount) is bounce-safe and restores accrued on bounce', async () => {
    const { capsule, author, operator, mockVault } = await setup({ feeAccumulatorDeployed: false });

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPublic(capsule.address, author.address));
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    await capsule.send(operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);

    const state = await capsule.getGetState();
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
  });

  it('CAPSULE-FEE-01/05: FlushFees(amount) debits accrued for deployed FeeAccumulator receiver', async () => {
    const { blockchain, capsule, author, operator, feeAccumulator, mockVault } = await setup({ feeAccumulatorDeployed: true });

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPublic(capsule.address, author.address));

    const flush = await capsule.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);

    const state = await capsule.getGetState();
    expect(state.accrued_plato_fee_ton).toBe(0n);

    expect(feeAccumulator).not.toBeNull();
    const depositTx = findTransaction(flush.transactions, {
      from: capsule.address,
      to: feeAccumulator!.address,
      op: OP_DEPOSIT_PROTOCOL_FEE,
      success: true,
    });
    expect(depositTx).toBeDefined();
    expect(inboundValue(depositTx)).toBe(PLATO_PUBLIC_FEE + CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

    const feeState = await feeAccumulator!.getGetState();
    expect(feeState.accumulated_ton).toBe(PLATO_PUBLIC_FEE);
    const unaccountedBalance = (await contractBalance(blockchain, feeAccumulator!.address)) - feeState.accumulated_ton;
    expect(unaccountedBalance).toBeLessThanOrEqual(CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);
  });

  it('CAPSULE-FEE-06: dust or locally underfunded FlushFees cannot drain CapsuleHub reserve', async () => {
    const { capsule, author, operator, mockVault } = await setup({ feeAccumulatorDeployed: true });

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPublic(capsule.address, author.address));

    await capsule.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE - 1n }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    await capsule.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    await capsule.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(0n);
  });

  it('CAPSULE-FEE-DUST-01: final discounted Vault fee below min flushes when it is the whole accrued bucket', async () => {
    const { capsule, mockVault, operator, author, feeAccumulator } = await setup({ feeAccumulatorDeployed: true });

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPublic(capsule.address, author.address, {
      publish_id: hash256('discounted-dust-publish'),
      protocol_fee_paid: 1n,
      value_to_capsule: 100_000_000n,
    }));
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(1n);

    await capsule.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE - 1n }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(1n);

    await capsule.send(operator.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(0n);
    expect((await feeAccumulator!.getGetState()).accumulated_ton).toBe(1n);
  });

  it('CAPSULE-04/CAPSULE-ID-04: Vault private publish from immutable Vault creates entry and ACKs', async () => {
    const { capsule, mockVault, operator } = await setup();

    const forwarded = forwardVaultPrivate(capsule.address);
    const result = await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwarded);

    const hubState = await capsule.getGetState();
    expect(hubState.private_latest_id).toBe(1n);
    expect(hubState.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE);

    const vaultState = await mockVault.getGetState();
    expect(vaultState.ack_count).toBe(1n);
    expect(vaultState.last_publish_id).toBe(hash256('vault-private-publish-id'));
    expect(vaultState.last_entry_id).toBe(0n);
    const stored = await capsule.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(vaultState.last_entry_uid).toBe(stored.entry_uid);
    expect(stored.publish_id).toBe(forwarded.publish_id);
    expect(stored.body.hash().toString('hex')).toBe(forwarded.body.hash().toString('hex'));

    const ackTx = findTransaction(result.transactions, {
      from: capsule.address,
      to: mockVault.address,
      op: OP_CAPSULEHUB_PUBLISH_ACK,
      success: true,
    });
    expect(inboundValue(ackTx)).toBe(CAPSULEHUB_ACK_FORWARD_RESERVE);
  });

  it('CAPSULE-VAULT-BACKING-01: Vault publish retains protocol fee backing instead of returning it as ACK excess', async () => {
    const { blockchain, capsule, mockVault, operator } = await setup({ capsuleBalance: 0n });

    await mockVault.send(operator.getSender(), { value: toNano('0.1') }, forwardVaultPrivate(capsule.address, {
      value_to_capsule: 100_000_000n,
    }));

    const state = await capsule.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE);
    expect(await contractBalance(blockchain, capsule.address)).toBeGreaterThanOrEqual(PLATO_PRIVATE_STANDARD_FEE);
  });

  it('CAPSULE-05: Vault public publish accepts verified author from immutable Vault and ACKs', async () => {
    const { capsule, mockVault, operator, author } = await setup();

    const forwarded = forwardVaultPublic(capsule.address, author.address);
    const result = await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwarded);

    const hubState = await capsule.getGetState();
    expect(hubState.public_latest_id).toBe(1n);
    expect(hubState.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    const vaultState = await mockVault.getGetState();
    expect(vaultState.ack_count).toBe(1n);
    expect(vaultState.last_publish_id).toBe(hash256('vault-public-publish-id'));
    const stored = await capsule.getGetPublicEntry(0n);
    expect(stored.exists).toBe(true);
    expect(vaultState.last_entry_uid).toBe(stored.entry_uid);
    expect(stored.author_wallet.toString()).toBe(author.address.toString());
    expect(stored.body.hash().toString('hex')).toBe(forwarded.body.hash().toString('hex'));

    const ackTx = findTransaction(result.transactions, {
      from: capsule.address,
      to: mockVault.address,
      op: OP_CAPSULEHUB_PUBLISH_ACK,
      success: true,
    });
    expect(inboundValue(ackTx)).toBe(CAPSULEHUB_ACK_FORWARD_RESERVE);
  });

  it('CAP-REJECT-07: Vault-only publish from non-Vault sender rejected', async () => {
    const { capsule, attacker, author } = await setup();

    await capsule.send(attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'PublishPublicFromVault',
      bounce_id: 666n,
      publish_id: hash256('evil'),
      author_wallet: author.address,
      marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
      header_hash: forwardVaultPublic(capsule.address, author.address).header_hash,
      body_hash: forwardVaultPublic(capsule.address, author.address).body_hash,
      header: forwardVaultPublic(capsule.address, author.address).header,
      body: forwardVaultPublic(capsule.address, author.address).body,
      protocol_fee_paid: PLATO_PUBLIC_FEE,
    });

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  });

  it('CAP-REJECT-08: Vault publish rejects protocol_fee_paid greater than full fee', async () => {
    const { capsule, mockVault, operator } = await setup();

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPublic(capsule.address, operator.address, {
      publish_id: hash256('too-much-fee'),
      protocol_fee_paid: PLATO_PUBLIC_FEE + 1n,
    }));

    const hubState = await capsule.getGetState();
    const vaultState = await mockVault.getGetState();
    expect(hubState.public_latest_id).toBe(0n);
    expect(hubState.accrued_plato_fee_ton).toBe(0n);
    expect(vaultState.ack_count).toBe(0n);
  });

  it('NO-ADMIN: empty fallback rejected and cannot mutate state', async () => {
    const { capsule, attacker } = await setup();

    await capsule.send(attacker.getSender(), { value: toNano('0.1') }, null);

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.private_latest_id).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  });
});
