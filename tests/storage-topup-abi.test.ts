import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { Vault, TopUpStorageReserve as VaultTopUpStorageReserve } from '../build/Vault/Vault_Vault';
import { CapsuleHub, TopUpStorageReserve as CapsuleHubTopUpStorageReserve } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator, TopUpStorageReserve as FeeAccumulatorTopUpStorageReserve } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { BuybackBurn, TopUpStorageReserve as BuybackBurnTopUpStorageReserve } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { UsernameRegistry, UsernameRegistryTopUpStorageReserve } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem, TopUpStorageReserve as UsernameNFTItemTopUpStorageReserve } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.STORAGE.TOPUP.${label}`).digest());
}

async function deploy<T>(
  blockchain: Blockchain,
  init: { code: any; data: any },
  make: (address: Address, init: any) => T,
  balance = toNano('1'),
): Promise<T & { address: Address }> {
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance,
    workchain: address.workChain,
  }));
  return blockchain.openContract(make(address, init)) as T & { address: Address };
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function normalizeState(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Address) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeState(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeState(item)]));
  }
  return value;
}

describe('Storage top-up ABI coverage', () => {
  it('STORAGE-TOPUP-01: production storage top-up entrypoints accept TON without state authority', async () => {
    const blockchain = await Blockchain.create();
    const donor = await blockchain.treasury('storage-topup-donor');
    const controller = await blockchain.treasury('storage-topup-controller');
    const athMaster = fixtureAddress('ATH_MASTER');
    const athWallet = fixtureAddress('ATH_WALLET');
    const capsuleVault = fixtureAddress('CAPSULE_VAULT');
    const treasury = fixtureAddress('TREASURY');
    const buyback = fixtureAddress('BUYBACK');

    const vaultInit = await Vault.init(athWallet, athMaster, capsuleVault, 0n, true, true, 0n);
    const vault = await deploy(blockchain, vaultInit, (address, init) => new Vault(address, init));
    const vaultBefore = await vault.getGetGlobal();
    const vaultBalanceBefore = await contractBalance(blockchain, vault.address);
    await vault.send(donor.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpStorageReserve',
    } as VaultTopUpStorageReserve);
    expect(normalizeState(await vault.getGetGlobal())).toEqual(normalizeState(vaultBefore));
    expect(await contractBalance(blockchain, vault.address)).toBeGreaterThan(vaultBalanceBefore);

    const capsuleInit = await CapsuleHub.init(treasury, capsuleVault, true, true, 0n, controller.address);
    const capsule = await deploy(blockchain, capsuleInit, (address, init) => new CapsuleHub(address, init));
    const capsuleBefore = await capsule.getGetState();
    const capsuleBalanceBefore = await contractBalance(blockchain, capsule.address);
    await capsule.send(donor.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpStorageReserve',
    } as CapsuleHubTopUpStorageReserve);
    expect(normalizeState(await capsule.getGetState())).toEqual(normalizeState(capsuleBefore));
    expect(await contractBalance(blockchain, capsule.address)).toBeGreaterThan(capsuleBalanceBefore);

    const feeInit = await FeeAccumulator.init(treasury, buyback);
    const fee = await deploy(blockchain, feeInit, (address, init) => new FeeAccumulator(address, init));
    const feeBefore = await fee.getGetState();
    const feeBalanceBefore = await contractBalance(blockchain, fee.address);
    await fee.send(donor.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpStorageReserve',
    } as FeeAccumulatorTopUpStorageReserve);
    expect(normalizeState(await fee.getGetState())).toEqual(normalizeState(feeBefore));
    expect(await contractBalance(blockchain, fee.address)).toBeGreaterThan(feeBalanceBefore);

    const buybackInit = await BuybackBurn.init(0x1234n, athMaster);
    const buybackBurn = await deploy(blockchain, buybackInit, (address, init) => new BuybackBurn(address, init));
    const buybackConfigBefore = await buybackBurn.getGetBuybackBurnConfig();
    const buybackStateBefore = await buybackBurn.getGetBuybackBurnState();
    const buybackTotalsBefore = await buybackBurn.getGetBuybackBurnTotals();
    const buybackBalanceBefore = await contractBalance(blockchain, buybackBurn.address);
    await buybackBurn.send(donor.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpStorageReserve',
    } as BuybackBurnTopUpStorageReserve);
    expect(normalizeState(await buybackBurn.getGetBuybackBurnConfig())).toEqual(normalizeState(buybackConfigBefore));
    expect(normalizeState(await buybackBurn.getGetBuybackBurnState())).toEqual(normalizeState(buybackStateBefore));
    expect(normalizeState(await buybackBurn.getGetBuybackBurnTotals())).toEqual(normalizeState(buybackTotalsBefore));
    expect(await contractBalance(blockchain, buybackBurn.address)).toBeGreaterThan(buybackBalanceBefore);

    const registryInit = await UsernameRegistry.init(athWallet, athMaster, treasury, true, 0n, 0n, controller.address);
    const registry = await deploy(blockchain, registryInit, (address, init) => new UsernameRegistry(address, init));
    const registryBefore = await registry.getGetGlobal();
    const registryBalanceBefore = await contractBalance(blockchain, registry.address);
    await registry.send(donor.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameRegistryTopUpStorageReserve',
    } as UsernameRegistryTopUpStorageReserve);
    expect(normalizeState(await registry.getGetGlobal())).toEqual(normalizeState(registryBefore));
    expect(await contractBalance(blockchain, registry.address)).toBeGreaterThan(registryBalanceBefore);

    const itemInit = await UsernameNFTItem.init(donor.address, registry.address, BigInt('0x' + beginCell().storeAddress(donor.address).endCell().hash().toString('hex')));
    const item = await deploy(blockchain, itemInit, (address, init) => new UsernameNFTItem(address, init));
    const itemBefore = await item.getGetState();
    const itemBalanceBefore = await contractBalance(blockchain, item.address);
    await item.send(donor.getSender(), { value: toNano('0.05') }, {
      $$type: 'TopUpStorageReserve',
    } as UsernameNFTItemTopUpStorageReserve);
    expect(normalizeState(await item.getGetState())).toEqual(normalizeState(itemBefore));
    expect(await contractBalance(blockchain, item.address)).toBeGreaterThan(itemBalanceBefore);
  });
});
