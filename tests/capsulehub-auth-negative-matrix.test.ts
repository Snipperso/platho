import { describe, expect, it } from 'vitest';
import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  CapsuleHub,
  BindDeploymentManifest,
  SealGenesis,
  PublishPrivateFromVault,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { MockVaultAckSink } from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const PRIVATE_FEE = 5_000_000n;

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.AUTH.${label}`).digest('hex'));
}

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.CAPSULE.AUTH.${label}`).digest());
}

async function deployMockVault(blockchain: Blockchain) {
  const mockVaultInit = await MockVaultAckSink.init();
  const mockVaultAddress = contractAddress(0, mockVaultInit);
  await blockchain.setShardAccount(mockVaultAddress, createShardAccount({
    address: mockVaultAddress,
    code: mockVaultInit.code,
    data: mockVaultInit.data,
    balance: toNano('1'),
    workchain: mockVaultAddress.workChain,
  }));
  return {
    mockVault: blockchain.openContract(new MockVaultAckSink(mockVaultAddress, mockVaultInit)),
    mockVaultAddress,
  };
}

async function setup(options?: { sealed?: boolean; vaultBound?: boolean }) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const controller = await blockchain.treasury('capsule-auth-controller');
  const attacker = await blockchain.treasury('capsule-auth-attacker');
  const author = await blockchain.treasury('capsule-auth-author');
  const { mockVault, mockVaultAddress } = await deployMockVault(blockchain);
  const feeAccumulator = fixtureAddress('FEE_ACCUMULATOR');

  const init = await CapsuleHub.init(
    feeAccumulator,
    options?.vaultBound === false ? controller.address : mockVaultAddress,
    options?.vaultBound ?? true,
    options?.sealed ?? true,
    options?.sealed === false ? 0n : MANIFEST_HASH,
    controller.address,
  );
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  return { blockchain, capsule: blockchain.openContract(new CapsuleHub(address, init)), controller, attacker, author, mockVault, mockVaultAddress };
}

function vaultPrivate(overrides?: Partial<PublishPrivateFromVault>): PublishPrivateFromVault {
  const header_0 = overrides?.header_0 ?? finalPrivateHeader0Cell(0x76);
  const header_1 = overrides?.header_1 ?? finalPrivateHeader1Cell(0x77);
  const body = overrides?.body ?? finalPrivateBodyCell(1, 0x78);
  return {
    $$type: 'PublishPrivateFromVault',
    bounce_id: 7001n,
    bounce_tag: 7001n,
    publish_id: hash256('vault-private'),
    size_class: 1n,
    crypto_suite: 1n,
    header_0_hash: cellHash(header_0),
    header_1_hash: cellHash(header_1),
    body_hash: cellHash(body),
    header_0,
    header_1,
    body,
    protocol_fee_paid: PRIVATE_FEE,
    ...overrides,
  } as PublishPrivateFromVault;
}

describe('CapsuleHub negative authorization matrix', () => {
  it('CAPSULE-AUTH-NEG-01: only genesis controller can bind and seal before publish surface opens', async () => {
    const { capsule, controller, attacker, mockVaultAddress } = await setup({ sealed: false, vaultBound: false });

    await capsule.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: mockVaultAddress,
    } as BindDeploymentManifest);
    expect((await capsule.getGetState()).vault_bound).toBe(false);

    await capsule.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: mockVaultAddress,
    } as BindDeploymentManifest);
    expect((await capsule.getGetState()).vault_bound).toBe(true);

    await capsule.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await capsule.getGetState()).sealed).toBe(false);

    await capsule.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await capsule.getGetState()).sealed).toBe(true);
  });

  it('CAPSULE-AUTH-NEG-02: unsealed hub rejects publish and sealed hub rejects rebinding', async () => {
    const unsealed = await setup({ sealed: false, vaultBound: true });
    await unsealed.capsule.send(unsealed.blockchain.sender(unsealed.mockVaultAddress), { value: toNano('0.1') }, vaultPrivate());
    expect((await unsealed.capsule.getGetState()).private_latest_id).toBe(0n);

    const sealed = await setup();
    await sealed.capsule.send(sealed.controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: sealed.attacker.address,
    } as BindDeploymentManifest);
    expect((await sealed.capsule.getGetState()).vault_address.toString()).toBe(sealed.mockVaultAddress.toString());
  });

  it('CAPSULE-AUTH-NEG-03: author spoof and forged Vault publish cannot mutate entries or ACK state', async () => {
    const { capsule, attacker, mockVault } = await setup();

    await capsule.send(attacker.getSender(), { value: toNano('0.1') }, vaultPrivate());
    expect((await capsule.getGetState()).private_latest_id).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(0n);
  });

  it('CAPSULE-AUTH-NEG-04: Vault publish with invalid identifiers is rejected without ACK', async () => {
    const { blockchain, capsule, mockVault, mockVaultAddress } = await setup();

    await capsule.send(blockchain.sender(mockVaultAddress), { value: toNano('0.1') }, vaultPrivate({ publish_id: 0n }));
    await capsule.send(blockchain.sender(mockVaultAddress), { value: toNano('0.1') }, vaultPrivate({ body_hash: 0n }));

    expect((await capsule.getGetState()).private_latest_id).toBe(0n);
    expect((await mockVault.getGetState()).ack_count).toBe(0n);
  });
});
