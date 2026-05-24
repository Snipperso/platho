import { createHash } from 'crypto';
import { Address } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  MainnetGenesisVerifyInput,
  verifyMainnetGenesisSnapshot,
} from '../scripts/mainnet_genesis_verify';

function addr(label: string, workchain = 0): string {
  return new Address(workchain, createHash('sha256').update(`PLATHO.MAINNET.GENESIS.${label}`).digest()).toString();
}

function hash(label: string): string {
  return createHash('sha256').update(`PLATHO.MAINNET.GENESIS.HASH.${label}`).digest('hex');
}

function finalInput(): MainnetGenesisVerifyInput {
  const addresses = {
    ath_master: addr('ath_master'),
    ath_treasury_owner: addr('ath_treasury_owner'),
    vault: addr('vault'),
    vault_official_ath_wallet: addr('vault_official_ath_wallet'),
    capsulehub: addr('capsulehub'),
    fee_accumulator: addr('fee_accumulator'),
    fee_accumulator_ton_treasury_receiver: addr('fee_accumulator_ton_treasury_receiver'),
    buyback_burn: addr('buyback_burn'),
    buyback_burn_official_ath_wallet: addr('buyback_burn_official_ath_wallet'),
    username_registry: addr('username_registry'),
    username_registry_official_ath_wallet: addr('username_registry_official_ath_wallet'),
    treasury_ath_receiver: addr('treasury_ath_receiver'),
    profile_registry: addr('profile_registry'),
    profile_registry_official_ath_wallet: addr('profile_registry_official_ath_wallet'),
    profile_registry_treasury_ath_receiver: addr('profile_registry_treasury_ath_receiver'),
  };
  const code_hashes = {
    ath_master: hash('ath_master'),
    ath_wallet: hash('ath_wallet'),
    vault: hash('vault'),
    capsulehub: hash('capsulehub'),
    username_registry: hash('username_registry'),
    profile_registry: hash('profile_registry'),
    buyback_burn: hash('buyback_burn'),
    fee_accumulator: hash('fee_accumulator'),
  };
  const manifestHash = hash('manifest');

  return {
    document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_INPUT',
    network: 'mainnet',
    manifest: {
      profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
      status: 'FINAL_GENESIS',
      manifest_hash_hex: manifestHash,
      addresses,
      code_hashes,
      constants: {
        vault_activity_airdrop_total_atomic: '30000000000000000',
      },
      blockers_before_final_genesis: [],
    },
    snapshot: {
      ath_master: {
        address: addresses.ath_master,
        code_hash: code_hashes.ath_master,
        treasury_owner_address: addresses.ath_treasury_owner,
        treasury_supply_deployed: true,
      },
      vault: {
        address: addresses.vault,
        code_hash: code_hashes.vault,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        capsule_hub_address: addresses.capsulehub,
        vault_ath_wallet_address: addresses.vault_official_ath_wallet,
        ath_master_address: addresses.ath_master,
      },
      vault_official_ath_wallet: {
        address: addresses.vault_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.vault,
        ath_master_address: addresses.ath_master,
        balance_atomic: '30000000000000000',
      },
      capsulehub: {
        address: addresses.capsulehub,
        code_hash: code_hashes.capsulehub,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        vault_address: addresses.vault,
        fee_accumulator_address: addresses.fee_accumulator,
      },
      username_registry: {
        address: addresses.username_registry,
        code_hash: code_hashes.username_registry,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        official_ath_wallet_address: addresses.username_registry_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        treasury_ath_receiver: addresses.treasury_ath_receiver,
      },
      profile_registry: {
        address: addresses.profile_registry,
        code_hash: code_hashes.profile_registry,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        official_ath_wallet_address: addresses.profile_registry_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        treasury_ath_receiver: addresses.profile_registry_treasury_ath_receiver,
      },
      buyback_burn: {
        address: addresses.buyback_burn,
        code_hash: code_hashes.buyback_burn,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        fee_accumulator_address: addresses.fee_accumulator,
        official_ath_wallet_address: addresses.buyback_burn_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        genesis_config_hash: hash('buyback_launch_controller'),
        route_frozen: false,
      },
      fee_accumulator: {
        address: addresses.fee_accumulator,
        code_hash: code_hashes.fee_accumulator,
        buyback_burn_address: addresses.buyback_burn,
        ton_treasury_receiver: addresses.fee_accumulator_ton_treasury_receiver,
        buyback_split_enabled: false,
      },
    },
    evidenceRefs: {
      getterSnapshotSource: 'sha256:mainnet-getter-snapshot',
      codeHashProofSource: 'sha256:mainnet-code-hash-proof',
      finalManifestSource: 'sha256:final-genesis-manifest',
    },
  };
}

describe('mainnet genesis getter-vs-manifest verifier', () => {
  it('stays blocked when no final getter snapshot input is supplied', () => {
    const report = verifyMainnetGenesisSnapshot(null);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.status).toBe('BLOCKED_MISSING_INPUT');
    expect(report.issue_codes).toEqual(['MISSING_INPUT']);
  });

  it('accepts a final manifest only when getter snapshot bindings match every immutable counterpart', () => {
    const report = verifyMainnetGenesisSnapshot(finalInput());

    expect(report.mainnet_genesis_verified).toBe(true);
    expect(report.status).toBe('MAINNET_GENESIS_VERIFIED');
    expect(report.issue_codes).toEqual([]);
  });

  it('rejects sealing a correct manifest hash with the wrong Vault counterpart address', () => {
    const input = finalInput();
    input.snapshot.vault.capsule_hub_address = addr('wrong_capsulehub');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_CAPSULE_HUB_ADDRESS_MISMATCH');
  });

  it('rejects non-final implemented-subset manifests even if snapshot bindings match', () => {
    const input = finalInput();
    input.manifest.status = 'IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS';
    input.manifest.blockers_before_final_genesis = ['BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE'];

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MANIFEST_NOT_FINAL_GENESIS');
    expect(report.issue_codes).toContain('FINAL_GENESIS_BLOCKERS_NOT_EMPTY');
  });

  it('rejects unsupported masterchain ATHMaster in final mainnet genesis evidence', () => {
    const input = finalInput();
    const masterchainAthMaster = addr('ath_master_masterchain', -1);
    input.manifest.addresses.ath_master = masterchainAthMaster;
    input.snapshot.ath_master.address = masterchainAthMaster;
    input.snapshot.vault.ath_master_address = masterchainAthMaster;
    input.snapshot.username_registry.ath_master_address = masterchainAthMaster;
    input.snapshot.profile_registry.ath_master_address = masterchainAthMaster;
    input.snapshot.buyback_burn.ath_master_address = masterchainAthMaster;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('BUYBACK_ATH_MASTER_NOT_BASECHAIN');
  });

  it('rejects sealing a correct manifest hash with the wrong ProfileRegistry official ATH wallet', () => {
    const input = finalInput();
    input.snapshot.profile_registry.official_ath_wallet_address = addr('wrong_profile_registry_official_ath_wallet');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_MISMATCH');
  });

  it('rejects final genesis when official Vault ATH wallet does not fund the full activity airdrop allocation', () => {
    const input = finalInput();
    input.snapshot.vault_official_ath_wallet.balance_atomic = '29999999999999999';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_ACTIVITY_AIRDROP_BACKING_UNDERFUNDED');
  });

  it('rejects final genesis when official Vault ATH wallet getter snapshot is missing', () => {
    const input = finalInput() as any;
    delete input.snapshot.vault_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_VAULT_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects final genesis when official Vault ATH wallet identity does not match Vault and ATHMaster', () => {
    const input = finalInput();
    input.snapshot.vault_official_ath_wallet.owner_address = addr('wrong_vault_owner');
    input.snapshot.vault_official_ath_wallet.ath_master_address = addr('wrong_ath_master');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_OFFICIAL_ATH_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('VAULT_OFFICIAL_ATH_WALLET_MASTER_MISMATCH');
  });

  it('rejects final genesis when FeeAccumulator buyback split is already enabled', () => {
    const input = finalInput();
    input.snapshot.fee_accumulator.buyback_split_enabled = true;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_BUYBACK_SPLIT_ENABLED_AT_GENESIS');
  });

  it('rejects final genesis when BuybackBurn route is already frozen', () => {
    const input = finalInput();
    input.snapshot.buyback_burn.route_frozen = true;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_ROUTE_FROZEN_AT_GENESIS');
  });

  it('rejects final genesis when BuybackBurn launch controller hash was cleared too early', () => {
    const input = finalInput();
    input.snapshot.buyback_burn.genesis_config_hash = '0'.repeat(64);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_LAUNCH_CONTROLLER_HASH_MISSING');
  });
});
