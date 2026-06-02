import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  BindProfileRegistry as VaultBindProfile,
  BindUsernameRegistry as VaultBindUsername,
  SealGenesis as VaultSeal,
} from '../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  UsernameRegistry,
  BindOfficialAthWallet as RegistryBindAth,
  BindUsernameVault as RegistryBindVault,
  SealGenesis as RegistrySeal,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ProfileRegistry,
  BindProfileOfficialAthWallet as ProfileBindAth,
  BindProfileVault as ProfileBindVault,
  SealGenesis as ProfileSeal,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x67656e657369735f617574685f6d616e69666573745f763100000000000001n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}


function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

async function deriveAthWallet(owner: Address, athMasterAddress: Address): Promise<Address> {
  const walletInit = await ATHWallet.init(0n, owner, athMasterAddress);
  return contractAddress(owner.workChain, walletInit);
}

async function deployUnsealedVaultCapsulePair() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const genesisController = await blockchain.treasury('genesis-controller');
  const attacker = await blockchain.treasury('genesis-attacker');
  const feeAccumulator = await blockchain.treasury('genesis-fee-accumulator');

  const vaultPlaceholder = fixtureAddress('GENESIS_AUTH_VAULT_CAPSULE_PLACEHOLDER');
  const capsulePlaceholder = fixtureAddress('GENESIS_AUTH_CAPSULE_VAULT_PLACEHOLDER');

  const vaultInit = await Vault.init(genesisController.address, genesisController.address, vaultPlaceholder, addressHash(genesisController.address), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);
  const officialAthWallet = await deriveAthWallet(vaultAddress, genesisController.address);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('2'),
    workchain: vaultAddress.workChain,
  }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

  const capsuleInit = await CapsuleHub.init(feeAccumulator.address, capsulePlaceholder, false, false, 0n, genesisController.address);
  const capsuleAddress = contractAddress(0, capsuleInit);
  await blockchain.setShardAccount(capsuleAddress, createShardAccount({
    address: capsuleAddress,
    code: capsuleInit.code,
    data: capsuleInit.data,
    balance: toNano('2'),
    workchain: capsuleAddress.workChain,
  }));
  const capsule = blockchain.openContract(new CapsuleHub(capsuleAddress, capsuleInit));

  return { blockchain, genesisController, attacker, officialAthWallet, vault, vaultAddress, vaultPlaceholder, capsule, capsuleAddress, capsulePlaceholder };
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
  it('DEPLOY-AUTH-01/02/03: arbitrary sender cannot bind or seal Vault genesis', async () => {
    const { genesisController, attacker, officialAthWallet, vault, capsuleAddress, vaultPlaceholder } = await deployUnsealedVaultCapsulePair();
    const attackerCapsule = fixtureAddress('GENESIS_AUTH_ATTACKER_CAPSULE');
    const attackerAthWallet = fixtureAddress('GENESIS_AUTH_ATTACKER_ATH_WALLET');
    const profileRegistryAddress = fixtureAddress('GENESIS_AUTH_VAULT_PROFILE_REGISTRY');
    const usernameRegistryAddress = fixtureAddress('GENESIS_AUTH_VAULT_USERNAME_REGISTRY');

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: attackerCapsule,
    } as VaultBind);
    let global = await vault.getGetGlobal();
    expect(global.capsule_hub_bound).toBe(false);
    expect(global.capsule_hub_address.equals(vaultPlaceholder)).toBe(true);
    expect(global.deployment_manifest_hash).toBe(0n);

    await vault.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: capsuleAddress,
    } as VaultBind);

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as VaultBindAth);
    global = await vault.getGetGlobal();
    expect(global.vault_ath_wallet_address.equals(genesisController.address)).toBe(true);
    expect(global.vault_ath_wallet_address.equals(attackerAthWallet)).toBe(false);

    await vault.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as VaultBindAth);

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);
    expect((await vault.getGetGlobal()).sealed).toBe(false);

    await vault.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);
    expect((await vault.getGetGlobal()).sealed).toBe(false);

    await vault.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileRegistry',
      deployment_manifest_hash: MANIFEST_HASH,
      profile_registry_address: profileRegistryAddress,
    } as VaultBindProfile);
    await vault.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindUsernameRegistry',
      deployment_manifest_hash: MANIFEST_HASH,
      username_registry_address: usernameRegistryAddress,
    } as VaultBindUsername);
    await vault.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);
    expect((await vault.getGetGlobal()).sealed).toBe(true);
  });

  it('DEPLOY-AUTH-04: arbitrary sender cannot bind or seal CapsuleHub genesis', async () => {
    const { genesisController, attacker, capsule, vaultAddress, capsulePlaceholder } = await deployUnsealedVaultCapsulePair();
    const attackerVault = fixtureAddress('GENESIS_AUTH_ATTACKER_VAULT');

    await capsule.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: attackerVault,
    } as CapsuleBind);
    let state = await capsule.getGetState();
    expect(state.vault_bound).toBe(false);
    expect(state.vault_address.equals(capsulePlaceholder)).toBe(true);
    expect(state.deployment_manifest_hash).toBe(0n);

    await capsule.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: vaultAddress,
    } as CapsuleBind);

    await capsule.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as CapsuleSeal);
    expect((await capsule.getGetState()).sealed).toBe(false);

    await capsule.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as CapsuleSeal);
    state = await capsule.getGetState();
    expect(state.sealed).toBe(true);
    expect(state.vault_address.equals(vaultAddress)).toBe(true);
  });

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
    expect(global.sealed).toBe(false);

    const vaultAddress = fixtureAddress('GENESIS_AUTH_USERNAME_VAULT');
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindUsernameVault',
      deployment_manifest_hash: MANIFEST_HASH,
      vault_address: vaultAddress,
    } as RegistryBindVault);
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
    expect(global.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(global.vault_bound).toBe(true);
    expect(global.vault_address.equals(vaultAddress)).toBe(true);

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
    expect(global.sealed).toBe(false);

    const vaultAddress = fixtureAddress('GENESIS_AUTH_PROFILE_VAULT');
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileVault',
      deployment_manifest_hash: MANIFEST_HASH,
      vault_address: vaultAddress,
    } as ProfileBindVault);
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);
    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
    expect(global.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(global.vault_bound).toBe(true);
    expect(global.vault_address.equals(vaultAddress)).toBe(true);

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
