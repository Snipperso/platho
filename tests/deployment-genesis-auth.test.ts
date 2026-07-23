import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet as RegistryBindAth,
  SealGenesis as RegistrySeal,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ProfileRegistry,
  BindProfileOfficialAthWallet as ProfileBindAth,
  SealGenesis as ProfileSeal,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';

const MANIFEST_HASH = 0x67656e657369735f617574685f6d616e69666573745f763100000000000001n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}




async function deployUnsealedUsernameRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const genesisController = await blockchain.treasury('registry-genesis-controller');
  const attacker = await blockchain.treasury('registry-genesis-attacker');
  const placeholderAthWallet = fixtureAddress('GENESIS_AUTH_REGISTRY_ATH_PLACEHOLDER');
  const athMasterAddress = fixtureAddress('GENESIS_AUTH_REGISTRY_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('GENESIS_AUTH_REGISTRY_TREASURY');

  const registryInit = await UsernameRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    genesisController.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));

  return { blockchain, genesisController, attacker, registry, registryAddress, placeholderAthWallet };
}

async function deployUnsealedProfileRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const genesisController = await blockchain.treasury('profile-registry-genesis-controller');
  const attacker = await blockchain.treasury('profile-registry-genesis-attacker');
  const placeholderAthWallet = fixtureAddress('GENESIS_AUTH_PROFILE_ATH_PLACEHOLDER');
  const athMasterAddress = fixtureAddress('GENESIS_AUTH_PROFILE_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('GENESIS_AUTH_PROFILE_TREASURY');

  const registryInit = await ProfileRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    genesisController.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new ProfileRegistry(registryAddress, registryInit));

  return { genesisController, attacker, registry, placeholderAthWallet };
}

describe('Deployment genesis controller auth', () => {

  it('DEPLOY-AUTH-05/06/07: arbitrary sender cannot bind/seal UsernameRegistry and controller has no post-seal authority', async () => {
    const { genesisController, attacker, registry, placeholderAthWallet } = await deployUnsealedUsernameRegistry();
    const officialAthWallet = await registry.getGetAthWalletAddress(registry.address);
    const attackerAthWallet = fixtureAddress('GENESIS_AUTH_REGISTRY_ATTACKER_ATH_WALLET');

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as RegistryBindAth);
    let global = await registry.getGetGlobal();
    expect(global.official_ath_wallet_bound).toBe(false);
    expect(global.official_ath_wallet_address.equals(placeholderAthWallet)).toBe(true);
    expect(global.deployment_manifest_hash).toBe(0n);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as RegistryBindAth);

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    expect((await registry.getGetGlobal()).sealed).toBe(false);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
    expect(global.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as RegistryBindAth);
    const afterPostSealAttempt = await registry.getGetGlobal();
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(attackerAthWallet)).toBe(false);
  });

  it('DEPLOY-AUTH-08: arbitrary sender cannot bind/seal ProfileRegistry and controller has no post-seal authority', async () => {
    const { genesisController, attacker, registry, placeholderAthWallet } = await deployUnsealedProfileRegistry();
    const officialAthWallet = await registry.getGetAthWalletAddress(registry.address);
    const attackerAthWallet = fixtureAddress('GENESIS_AUTH_PROFILE_ATTACKER_ATH_WALLET');

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as ProfileBindAth);
    let global = await registry.getGetGlobal();
    expect(global.official_ath_wallet_bound).toBe(false);
    expect(global.official_ath_wallet_address.equals(placeholderAthWallet)).toBe(true);
    expect(global.deployment_manifest_hash).toBe(0n);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as ProfileBindAth);

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);
    expect((await registry.getGetGlobal()).sealed).toBe(false);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);
    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
    expect(global.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as ProfileBindAth);
    const afterPostSealAttempt = await registry.getGetGlobal();
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(attackerAthWallet)).toBe(false);
  });
});
