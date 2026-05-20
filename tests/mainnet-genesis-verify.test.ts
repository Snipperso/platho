import { createHash } from 'crypto';
import { Address } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  MainnetGenesisVerifyInput,
  verifyMainnetGenesisSnapshot,
} from '../scripts/mainnet_genesis_verify';

function addr(label: string): string {
  return new Address(0, createHash('sha256').update(`PLATHO.MAINNET.GENESIS.${label}`).digest()).toString();
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
    stonfi_pool_address_ton_ath: addr('stonfi_pool_address_ton_ath'),
  };
  const code_hashes = {
    ath_master: hash('ath_master'),
    vault: hash('vault'),
    capsulehub: hash('capsulehub'),
    username_registry: hash('username_registry'),
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
      buyback_burn: {
        address: addresses.buyback_burn,
        code_hash: code_hashes.buyback_burn,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        fee_accumulator_address: addresses.fee_accumulator,
        official_ath_wallet_address: addresses.buyback_burn_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        route_frozen: true,
        stonfi_pool_address_ton_ath: addresses.stonfi_pool_address_ton_ath,
      },
      fee_accumulator: {
        address: addresses.fee_accumulator,
        code_hash: code_hashes.fee_accumulator,
        buyback_burn_address: addresses.buyback_burn,
        ton_treasury_receiver: addresses.fee_accumulator_ton_treasury_receiver,
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
});
