import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { findTransaction } from '@ton/test-utils';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  PublishPrivateDirect,
  PublishPublicDirect,
  FlushFees,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import {
  MockVaultAckSink,
  ForwardVaultPrivate,
  ForwardVaultPublic,
} from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';

const PLATO_PRIVATE_STANDARD_FEE = 5_000_000n;
const PLATO_PRIVATE_LONG_TERM_FEE = 10_000_000n;
const PLATO_PUBLIC_FEE = 5_000_000n;
const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE = 3_000_000n;
const CAPSULEHUB_PUBLIC_EXEC_RESERVE = 3_000_000n;
const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE = 1_000_000n;
const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 4_000_000n;
const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 3_000_000n;
const CAPSULEHUB_PAGE_STORAGE_ENDOWMENT = 10_000_000n;
const CAPSULEHUB_PRIVATE_STANDARD_DIRECT_REQUIRED = PLATO_PRIVATE_STANDARD_FEE
  + CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE
  + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE
  + CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT
  + CAPSULEHUB_PAGE_STORAGE_ENDOWMENT;
const CAPSULEHUB_PUBLIC_DIRECT_REQUIRED = PLATO_PUBLIC_FEE
  + CAPSULEHUB_PUBLIC_EXEC_RESERVE
  + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE
  + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT
  + CAPSULEHUB_PAGE_STORAGE_ENDOWMENT;
const CAPSULEHUB_PUBLIC_DIRECT_NO_PAGE_REQUIRED = PLATO_PUBLIC_FEE
  + CAPSULEHUB_PUBLIC_EXEC_RESERVE
  + CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE
  + CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT;
const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2_000_000n;
const CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE = CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE + CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE;
const OP_DEPOSIT_PROTOCOL_FEE = 0xff775609;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(label).digest('hex'));
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

function privateMsg(overrides?: Partial<PublishPrivateDirect>): PublishPrivateDirect {
  return {
    $$type: 'PublishPrivateDirect',
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: hash256('h0'),
    header_1_hash: hash256('h1'),
    body_hash: hash256('body'),
    protocol_fee_paid: PLATO_PRIVATE_STANDARD_FEE,
    ...overrides,
  } as PublishPrivateDirect;
}

function publicMsg(author: Address, overrides?: Partial<PublishPublicDirect>): PublishPublicDirect {
  return {
    $$type: 'PublishPublicDirect',
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    body_hash: hash256('public-body'),
    protocol_fee_paid: PLATO_PUBLIC_FEE,
    ...overrides,
  } as PublishPublicDirect;
}

function forwardVaultPrivate(capsuleAddress: Address, overrides?: Partial<ForwardVaultPrivate>): ForwardVaultPrivate {
  return {
    $$type: 'ForwardVaultPrivate',
    capsule_hub_address: capsuleAddress,
    bounce_id: 1001n,
    publish_id: hash256('vault-private-publish-id'),
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: hash256('vault-h0'),
    header_1_hash: hash256('vault-h1'),
    body_hash: hash256('vault-body'),
    protocol_fee_paid: PLATO_PRIVATE_STANDARD_FEE,
    value_to_capsule: 100_000_000n,
    ...overrides,
  } as ForwardVaultPrivate;
}

function forwardVaultPublic(capsuleAddress: Address, author: Address, overrides?: Partial<ForwardVaultPublic>): ForwardVaultPublic {
  return {
    $$type: 'ForwardVaultPublic',
    capsule_hub_address: capsuleAddress,
    bounce_id: 1002n,
    publish_id: hash256('vault-public-publish-id'),
    author_wallet: author,
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    body_hash: hash256('vault-public-body'),
    protocol_fee_paid: PLATO_PUBLIC_FEE,
    value_to_capsule: 100_000_000n,
    ...overrides,
  } as ForwardVaultPublic;
}

describe('CapsuleHub v1 milestone 1', () => {
  it('CAPSULE-02/CAPSULE-ID-01/03: public direct publish assigns sequential entry_id and accrues fee', async () => {
    const { capsule, author } = await setup();

    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_REQUIRED }, publicMsg(author.address));
    let state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(1n);
    expect(state.last_public_entry_id).toBe(0n);
    expect(state.public_entry_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
    expect(state.public_page_count).toBe(1n);

    const firstUid = state.last_public_entry_uid;
    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_NO_PAGE_REQUIRED }, publicMsg(author.address));
    state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(2n);
    expect(state.last_public_entry_id).toBe(1n);
    expect(state.public_entry_count).toBe(2n);
    expect(state.last_public_entry_uid).not.toBe(firstUid);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE * 2n);
  });

  it('CAPSULE-03: public direct publish rejects author spoofing', async () => {
    const { capsule, author, attacker } = await setup();

    await capsule.send(attacker.getSender(), { value: toNano('0.1') }, publicMsg(author.address));

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.public_entry_count).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  });

  it('CAPSULE-01: private direct publish validates allowed header/body/suite pair and accrues fee', async () => {
    const { capsule, author } = await setup();

    await capsule.send(author.getSender(), { value: CAPSULEHUB_PRIVATE_STANDARD_DIRECT_REQUIRED }, privateMsg());
    const state = await capsule.getGetState();
    expect(state.private_latest_id).toBe(1n);
    expect(state.last_private_entry_id).toBe(0n);
    expect(state.private_entry_count).toBe(1n);
    expect(state.private_page_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE);
  });

  it('CAP-REJECT-07A: private direct publish rejects mismatched size_class/crypto_suite and zero headers', async () => {
    const { capsule, author } = await setup();

    await capsule.send(author.getSender(), { value: toNano('0.1') }, privateMsg({ crypto_suite: 2n }));
    await capsule.send(author.getSender(), { value: toNano('0.1') }, privateMsg({ header_0_hash: 0n }));

    const state = await capsule.getGetState();
    expect(state.private_latest_id).toBe(0n);
    expect(state.private_entry_count).toBe(0n);
    expect(state.accrued_plato_fee_ton).toBe(0n);
  });

  it('CAPSULE-ID-06B: failed/underfunded publish does not create entry_id gaps', async () => {
    const { capsule, author } = await setup();

    await capsule.send(author.getSender(), { value: 1n }, publicMsg(author.address));
    let state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.public_entry_count).toBe(0n);

    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_REQUIRED }, publicMsg(author.address));
    state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(1n);
    expect(state.last_public_entry_id).toBe(0n);
  });

  it('CAPSULE-ID-07/09: first entry in a page charges page storage reserve; later same page does not require it', async () => {
    const { capsule, author } = await setup();

    // Missing first-page reserve, should fail and not increment.
    const withoutPageReserve = PLATO_PUBLIC_FEE + 3_000_000n + 1_000_000n + 3_000_000n;
    await capsule.send(author.getSender(), { value: withoutPageReserve }, publicMsg(author.address));
    expect((await capsule.getGetState()).public_latest_id).toBe(0n);

    // First page with page reserve succeeds.
    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_REQUIRED }, publicMsg(author.address));
    expect((await capsule.getGetState()).public_page_count).toBe(1n);

    // Second entry on same page succeeds without page reserve.
    await capsule.send(author.getSender(), { value: withoutPageReserve }, publicMsg(author.address));
    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(2n);
    expect(state.public_page_count).toBe(1n);
  });

  it('CAPSULE-FEE-01/02/03/04: FlushFees(amount) is bounce-safe and restores accrued on bounce', async () => {
    const { capsule, author, operator } = await setup({ feeAccumulatorDeployed: false });

    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_REQUIRED }, publicMsg(author.address));
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    await capsule.send(operator.getSender(), { value: toNano('0.1') }, {
      $$type: 'FlushFees',
      amount: PLATO_PUBLIC_FEE,
    } as FlushFees);

    const state = await capsule.getGetState();
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);
  });

  it('CAPSULE-FEE-01/05: FlushFees(amount) debits accrued for deployed FeeAccumulator receiver', async () => {
    const { blockchain, capsule, author, operator, feeAccumulator } = await setup({ feeAccumulatorDeployed: true });

    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_REQUIRED }, publicMsg(author.address));

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
    const { capsule, author, operator } = await setup({ feeAccumulatorDeployed: true });

    await capsule.send(author.getSender(), { value: CAPSULEHUB_PUBLIC_DIRECT_REQUIRED }, publicMsg(author.address));

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

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPrivate(capsule.address));

    const hubState = await capsule.getGetState();
    expect(hubState.private_latest_id).toBe(1n);
    expect(hubState.last_private_entry_id).toBe(0n);
    expect(hubState.private_entry_count).toBe(1n);
    expect(hubState.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE);

    const vaultState = await mockVault.getGetState();
    expect(vaultState.ack_count).toBe(1n);
    expect(vaultState.last_publish_id).toBe(hash256('vault-private-publish-id'));
    expect(vaultState.last_entry_id).toBe(0n);
    expect(vaultState.last_entry_uid).toBe(hubState.last_private_entry_uid);
  });

  it('CAPSULE-VAULT-BACKING-01: Vault publish retains protocol fee backing instead of returning it as ACK excess', async () => {
    const { blockchain, capsule, mockVault, operator } = await setup({ capsuleBalance: 0n });

    await mockVault.send(operator.getSender(), { value: toNano('0.1') }, forwardVaultPrivate(capsule.address, {
      value_to_capsule: 100_000_000n,
    }));

    const state = await capsule.getGetState();
    expect(state.private_entry_count).toBe(1n);
    expect(state.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE);
    expect(await contractBalance(blockchain, capsule.address)).toBeGreaterThanOrEqual(PLATO_PRIVATE_STANDARD_FEE);
  });

  it('CAPSULE-05: Vault public publish accepts verified author from immutable Vault and ACKs', async () => {
    const { capsule, mockVault, operator, author } = await setup();

    await mockVault.send(operator.getSender(), { value: toNano('0.2') }, forwardVaultPublic(capsule.address, author.address));

    const hubState = await capsule.getGetState();
    expect(hubState.public_latest_id).toBe(1n);
    expect(hubState.last_public_entry_id).toBe(0n);
    expect(hubState.public_entry_count).toBe(1n);
    expect(hubState.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_FEE);

    const vaultState = await mockVault.getGetState();
    expect(vaultState.ack_count).toBe(1n);
    expect(vaultState.last_publish_id).toBe(hash256('vault-public-publish-id'));
    expect(vaultState.last_entry_uid).toBe(hubState.last_public_entry_uid);
  });

  it('CAP-REJECT-07: Vault-only publish from non-Vault sender rejected', async () => {
    const { capsule, attacker, author } = await setup();

    await capsule.send(attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'PublishPublicFromVault',
      bounce_id: 666n,
      publish_id: hash256('evil'),
      author_wallet: author.address,
      marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
      body_hash: hash256('evil-body'),
      protocol_fee_paid: PLATO_PUBLIC_FEE,
    });

    const state = await capsule.getGetState();
    expect(state.public_latest_id).toBe(0n);
    expect(state.public_entry_count).toBe(0n);
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
