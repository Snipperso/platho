import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  UsernameRegistryTopUpStorageReserve,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function nameHash(name: string): bigint {
  return BigInt(`0x${createHash('sha256').update(`PLATHO.V1.USERNAME.${name}`).digest('hex')}`);
}

async function deployRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('username-registry-deployer');
  const caller = await blockchain.treasury('username-registry-caller');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));

  return { blockchain, deployer, caller, registry, registryAddress, placeholderAthWallet };
}

describe('UsernameRegistry foundation milestone', () => {
  it('USERNAME-REG-M9-01: price getter enforces pinned name length tiers without accepting 1-3 char names', async () => {
    const { registry } = await deployRegistry();

    const p1 = await registry.getGetUsernamePrice(1n);
    const p3 = await registry.getGetUsernamePrice(3n);
    const p4 = await registry.getGetUsernamePrice(4n);
    const p5 = await registry.getGetUsernamePrice(5n);
    const p6 = await registry.getGetUsernamePrice(6n);
    const p12 = await registry.getGetUsernamePrice(12n);

    expect(p1.valid_length).toBe(false);
    expect(p3.valid_length).toBe(false);
    expect(p1.price_ath_atomic).toBe(0n);
    expect(p3.price_ath_atomic).toBe(0n);
    expect(p4.valid_length).toBe(true);
    expect(p4.price_ath_atomic).toBe(10_000_000_000_000n);
    expect(p5.price_ath_atomic).toBe(1_000_000_000_000n);
    expect(p6.price_ath_atomic).toBe(100_000_000_000n);
    expect(p12.price_ath_atomic).toBe(100_000_000_000n);
  });

  it('USERNAME-REG-M9-02: get_username_item_address equals local UsernameNFTItem StateInit derivation', async () => {
    const { registry, registryAddress } = await deployRegistry();
    const ownerWallet = fixtureAddress('USERNAME_REGISTRY_ITEM_OWNER');
    const usernameHash = nameHash('platho');

    const fromGetter = await registry.getGetUsernameItemAddress(ownerWallet, usernameHash);
    const itemInit = await UsernameNFTItem.init(ownerWallet, registryAddress, usernameHash);
    const local = contractAddress(ownerWallet.workChain, itemInit);

    expect(fromGetter.equals(local)).toBe(true);
  });

  it('USERNAME-REG-M9-03: item derivation follows owner workchain, including masterchain owner fixture', async () => {
    const { registry, registryAddress } = await deployRegistry();
    const ownerWallet = fixtureAddress('USERNAME_REGISTRY_MASTERCHAIN_OWNER', -1);
    const usernameHash = nameHash('larisa');

    const fromGetter = await registry.getGetUsernameItemAddress(ownerWallet, usernameHash);
    const itemInit = await UsernameNFTItem.init(ownerWallet, registryAddress, usernameHash);
    const local = contractAddress(ownerWallet.workChain, itemInit);

    expect(fromGetter.workChain).toBe(-1);
    expect(fromGetter.equals(local)).toBe(true);
  });

  it('USERNAME-REG-M9-04: official ATH wallet binds before seal and cannot be changed after seal', async () => {
    const { deployer, registry } = await deployRegistry();
    const officialAthWallet = fixtureAddress('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET');
    const attackerWallet = fixtureAddress('USERNAME_REGISTRY_ATTACKER_ATH_WALLET');

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as BindOfficialAthWallet);

    let state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(true);
    expect(state.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(state.deployment_manifest_hash).toBe(MANIFEST_HASH);
    expect(state.genesis_config_hash).toBe(1n);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    state = await registry.getGetGlobal();
    expect(state.sealed).toBe(true);
    expect(state.genesis_config_hash).toBe(MANIFEST_HASH);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerWallet,
    } as BindOfficialAthWallet);

    state = await registry.getGetGlobal();
    expect(state.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(state.official_ath_wallet_address.equals(attackerWallet)).toBe(false);
  });

  it('USERNAME-REG-M9-05: seal fails without official ATH wallet binding and storage top-up grants no authority', async () => {
    const { deployer, caller, registry, placeholderAthWallet } = await deployRegistry();

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    let state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(false);
    expect(state.official_ath_wallet_address.equals(placeholderAthWallet)).toBe(true);

    await registry.send(caller.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameRegistryTopUpStorageReserve',
    } as UsernameRegistryTopUpStorageReserve);

    state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(false);
    expect(state.name_record_count).toBe(0n);
    expect(state.pending_mint_count).toBe(0n);
    expect(state.refund_due_count).toBe(0n);
    expect(state.treasury_due_ath).toBe(0n);
    expect(state.burn_due_ath).toBe(0n);
  });
});
