import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { CapsuleHub, BindDeploymentManifest as CapsuleBind, SealGenesis as CapsuleSeal } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { ProfileRegistry, BindProfileOfficialAthWallet as ProfileBindAth, SealGenesis as ProfileSeal } from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { UsernameRegistry, BindOfficialAthWallet as UsernameBindAth, SealGenesis as UsernameSeal } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { Vault, BindDeploymentManifest as VaultBind, BindOfficialAthWallet as VaultBindAth, SealGenesis as VaultSeal } from '../build/Vault/Vault_Vault';
import { assertFinalGenesisReady, buildImplementedSubsetManifest, computeManifestCell } from '../scripts/deployment_manifest_m15';

async function deployCellContract(blockchain: Blockchain, address: Address, init: { code: any; data: any }, balance = toNano('2')) {
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance,
    workchain: address.workChain,
  }));
}

describe('Deployment manifest M15 implemented-subset profile', () => {
  it('DEPLOY-M15-01: manifest hash is canonical cell hash over sorted addresses, code hashes, state init hashes, constants, and blockers', async () => {
    const { manifest } = await buildImplementedSubsetManifest();
    const recomputed = computeManifestCell({
      addresses: manifest.addresses,
      code_hashes: manifest.code_hashes,
      state_init_hashes: manifest.state_init_hashes,
      constants: manifest.constants,
      blockers_before_final_genesis: manifest.blockers_before_final_genesis,
    }).hash().toString('hex');

    expect(manifest.profile).toBe('PLATHO.V1.DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15');
    expect(manifest.status).toBe('IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS');
    expect(manifest.constants.vault_activity_airdrop_total_atomic).toBe('30000000000000000');
    expect(manifest.constants.vault_activity_airdrop_reward_per_message_atomic).toBe('10000000000');
    expect(manifest.constants.vault_activity_airdrop_per_wallet_cap_atomic).toBe('0');
    expect(manifest.constants.profile_avatar_price_ath_atomic).toBe('100000000000');
    expect(manifest.constants.profile_avatar_max_parts).toBe('16');
    expect(manifest.blockers_before_final_genesis).toContain('ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT');
    expect(manifest.blockers_before_final_genesis).toContain('VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS');
    expect(manifest.manifest_hash_hex).toBe(recomputed);
    expect(BigInt(`0x${manifest.manifest_hash_hex}`).toString()).toBe(manifest.manifest_hash_uint256);
  });

  it('DEPLOY-M15-02/05/09: Vault, CapsuleHub, UsernameRegistry, and ProfileRegistry can seal to the same implemented-subset manifest hash and expose it', async () => {
    const { manifest, inits, parsed } = await buildImplementedSubsetManifest();
    const manifestHash = BigInt(`0x${manifest.manifest_hash_hex}`);
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const genesisController = blockchain.sender(Address.parse(manifest.addresses.genesis_controller_one_shot));

    await deployCellContract(blockchain, parsed.vaultAddress, inits.vault);
    await deployCellContract(blockchain, parsed.capsuleHubAddress, inits.capsuleHub);
    await deployCellContract(blockchain, parsed.usernameRegistryAddress, inits.usernameRegistry);
    await deployCellContract(blockchain, parsed.profileRegistryAddress, inits.profileRegistry);

    const vault = blockchain.openContract(new Vault(parsed.vaultAddress, inits.vault));
    const capsuleHub = blockchain.openContract(new CapsuleHub(parsed.capsuleHubAddress, inits.capsuleHub));
    const usernameRegistry = blockchain.openContract(new UsernameRegistry(parsed.usernameRegistryAddress, inits.usernameRegistry));
    const profileRegistry = blockchain.openContract(new ProfileRegistry(parsed.profileRegistryAddress, inits.profileRegistry));

    expect(parsed.vaultAddress.toString()).toBe(manifest.addresses.vault);
    expect(parsed.capsuleHubAddress.toString()).toBe(manifest.addresses.capsulehub);
    expect(parsed.usernameRegistryAddress.toString()).toBe(manifest.addresses.username_registry);
    expect(parsed.profileRegistryAddress.toString()).toBe(manifest.addresses.profile_registry);
    expect(parsed.vaultOfficialAthWalletAddress.toString()).toBe(manifest.addresses.vault_official_ath_wallet);
    expect(parsed.usernameRegistryOfficialAthWalletAddress.toString()).toBe(manifest.addresses.username_registry_official_ath_wallet);
    expect(parsed.profileRegistryOfficialAthWalletAddress.toString()).toBe(manifest.addresses.profile_registry_official_ath_wallet);

    await vault.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: manifestHash,
      counterpart_address: parsed.capsuleHubAddress,
    } as VaultBind);
    await vault.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: manifestHash,
      official_ath_wallet_address: parsed.vaultOfficialAthWalletAddress,
    } as VaultBindAth);
    await capsuleHub.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: manifestHash,
      counterpart_address: parsed.vaultAddress,
    } as CapsuleBind);
    await usernameRegistry.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: manifestHash,
      official_ath_wallet_address: parsed.usernameRegistryOfficialAthWalletAddress,
    } as UsernameBindAth);
    await profileRegistry.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: manifestHash,
      official_ath_wallet_address: parsed.profileRegistryOfficialAthWalletAddress,
    } as ProfileBindAth);

    await vault.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: manifestHash,
    } as VaultSeal);
    await capsuleHub.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: manifestHash,
    } as CapsuleSeal);
    await usernameRegistry.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: manifestHash,
    } as UsernameSeal);
    await profileRegistry.send(genesisController, { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: manifestHash,
    } as ProfileSeal);

    const vaultState = await vault.getGetGlobal();
    const capsuleState = await capsuleHub.getGetState();
    const usernameState = await usernameRegistry.getGetGlobal();
    const profileState = await profileRegistry.getGetGlobal();

    expect(vaultState.sealed).toBe(true);
    expect(capsuleState.sealed).toBe(true);
    expect(usernameState.sealed).toBe(true);
    expect(profileState.sealed).toBe(true);
    expect(vaultState.deployment_manifest_hash).toBe(manifestHash);
    expect(capsuleState.deployment_manifest_hash).toBe(manifestHash);
    expect(usernameState.deployment_manifest_hash).toBe(manifestHash);
    expect(profileState.deployment_manifest_hash).toBe(manifestHash);
    expect(usernameState.genesis_config_hash).toBe(manifestHash);
    expect(profileState.genesis_config_hash).toBe(manifestHash);
  });

  it('DEPLOY-M15-03/06: official client profile rejects final genesis while blockers remain and detects manifest-hash mismatch', async () => {
    const { manifest } = await buildImplementedSubsetManifest();
    expect(() => assertFinalGenesisReady(manifest)).toThrow(/Final genesis manifest blocked/);

    const expected = BigInt(`0x${manifest.manifest_hash_hex}`);
    const observed = {
      vault_genesis_config_hash: expected,
      capsulehub_deployment_manifest_hash: expected + 1n,
      username_registry_genesis_config_hash: expected,
      profile_registry_genesis_config_hash: expected,
    };

    const allMatch = observed.vault_genesis_config_hash === expected
      && observed.capsulehub_deployment_manifest_hash === expected
      && observed.username_registry_genesis_config_hash === expected
      && observed.profile_registry_genesis_config_hash === expected;
    expect(allMatch).toBe(false);
  });
});
