import { createHash } from 'crypto';
import { Address, beginCell } from '@ton/core';
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

function addressHashHex(address: string): string {
  return beginCell().storeAddress(Address.parse(address)).endCell().hash().toString('hex');
}

function finalInput(): MainnetGenesisVerifyInput {
  const addresses = {
    ath_master: addr('ath_master'),
    ath_treasury_owner: addr('ath_treasury_owner'),
    vault: addr('vault'),
    vault_official_ath_wallet: addr('vault_official_ath_wallet'),
    market_stability_seller: addr('market_stability_seller'),
    market_stability_seller_initial_genesis_controller: addr('market_stability_seller_initial_genesis_controller'),
    market_stability_seller_official_ath_wallet: addr('market_stability_seller_official_ath_wallet'),
    market_stability_reserve_funder: addr('market_stability_reserve_funder'),
    market_stability_ton_treasury_receiver: addr('market_stability_ton_treasury_receiver'),
    capsulehub: addr('capsulehub'),
    fee_accumulator: addr('fee_accumulator'),
    fee_accumulator_ton_treasury_receiver: addr('fee_accumulator_ton_treasury_receiver'),
    buyback_burn: addr('buyback_burn'),
    buyback_burn_initial_genesis_controller: addr('buyback_burn_initial_genesis_controller'),
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
    market_stability_seller: hash('market_stability_seller'),
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
        ath_total_supply_atomic: '100000000000000000',
        vault_activity_airdrop_total_atomic: '30000000000000000',
        ath_market_stability_reserve_allocation_atomic: '45000000000000000',
      },
      blockers_before_final_genesis: [],
    },
    snapshot: {
      ath_master: {
        address: addresses.ath_master,
        code_hash: code_hashes.ath_master,
        total_supply_atomic: '100000000000000000',
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
        user_count: '0',
        key_record_count: '0',
        receive_intent_count: '0',
        pending_ath_withdrawal_count: '0',
        pending_publish_count: '0',
        processed_ath_deposit_count: '0',
        airdrop_remaining_ath: '30000000000000000',
        airdrop_distributed_ath: '0',
      },
      vault_official_ath_wallet: {
        address: addresses.vault_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.vault,
        ath_master_address: addresses.ath_master,
        balance_atomic: '30000000000000000',
      },
      market_stability_seller: {
        address: addresses.market_stability_seller,
        code_hash: code_hashes.market_stability_seller,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        reserve_funder_address: addresses.market_stability_reserve_funder,
        official_ath_wallet_address: addresses.market_stability_seller_official_ath_wallet,
        ton_treasury_receiver_address: addresses.market_stability_ton_treasury_receiver,
        ath_master_address: addresses.ath_master,
        genesis_config_hash: addressHashHex(addresses.market_stability_seller_initial_genesis_controller),
        pricing_frozen: false,
        reserve_due_ath: '0',
        reserve_funded_total_ath: '0',
        treasury_due_ton: '0',
        sold_ath_total: '0',
        phase: '0',
        pending_query_id: '0',
        pending_amount_ath: '0',
        pending_paid_ton: '0',
        completed_tranche_count: '0',
        current_tranche_sold_ath: '0',
        last_terminal_query_id: '0',
        treasury_flushed_ton_total: '0',
      },
      market_stability_seller_official_ath_wallet: {
        address: addresses.market_stability_seller_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.market_stability_seller,
        ath_master_address: addresses.ath_master,
        balance_atomic: '0',
      },
      capsulehub: {
        address: addresses.capsulehub,
        code_hash: code_hashes.capsulehub,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        vault_address: addresses.vault,
        fee_accumulator_address: addresses.fee_accumulator,
        private_latest_id: '0',
        public_latest_id: '0',
        accrued_plato_fee_ton: '0',
      },
      username_registry: {
        address: addresses.username_registry,
        code_hash: code_hashes.username_registry,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        official_ath_wallet_address: addresses.username_registry_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        treasury_ath_receiver: addresses.treasury_ath_receiver,
        name_record_count: '0',
        pending_mint_count: '0',
        refund_due_count: '0',
        treasury_due_ath: '0',
        burn_due_ath: '0',
        pending_refund_flush_count: '0',
        pending_treasury_flush_count: '0',
        pending_burn_flush_count: '0',
      },
      profile_registry: {
        address: addresses.profile_registry,
        code_hash: code_hashes.profile_registry,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        official_ath_wallet_address: addresses.profile_registry_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        treasury_ath_receiver: addresses.profile_registry_treasury_ath_receiver,
        profile_count: '0',
        avatar_record_count: '0',
        treasury_due_ath: '0',
        burn_due_ath: '0',
        pending_treasury_flush_count: '0',
        pending_burn_flush_count: '0',
      },
      buyback_burn: {
        address: addresses.buyback_burn,
        code_hash: code_hashes.buyback_burn,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        fee_accumulator_address: addresses.fee_accumulator,
        official_ath_wallet_address: addresses.buyback_burn_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        genesis_config_hash: addressHashHex(addresses.buyback_burn_initial_genesis_controller),
        route_frozen: false,
        phase: '0',
        reserve_due_ton: '0',
        pending_query_id: '0',
        route_refund_due_ton: '0',
        ath_burn_retry_due_atomic: '0',
        last_terminal_query_id: '0',
        accepted_reserve_count: '0',
        executed_buyback_count: '0',
        burned_ath_total_atomic: '0',
      },
      fee_accumulator: {
        address: addresses.fee_accumulator,
        code_hash: code_hashes.fee_accumulator,
        buyback_burn_address: addresses.buyback_burn,
        ton_treasury_receiver: addresses.fee_accumulator_ton_treasury_receiver,
        buyback_split_enabled: false,
        accumulated_ton: '0',
        treasury_due_ton: '0',
        buyback_due_ton: '0',
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
    input.snapshot.market_stability_seller.ath_master_address = masterchainAthMaster;
    input.snapshot.market_stability_seller_official_ath_wallet.ath_master_address = masterchainAthMaster;
    input.snapshot.username_registry.ath_master_address = masterchainAthMaster;
    input.snapshot.profile_registry.ath_master_address = masterchainAthMaster;
    input.snapshot.buyback_burn.ath_master_address = masterchainAthMaster;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('BUYBACK_ATH_MASTER_NOT_BASECHAIN');
  });

  it('rejects final genesis when ATHMaster total supply does not match the manifest supply constant', () => {
    const input = finalInput();
    input.snapshot.ath_master.total_supply_atomic = '99999999999999999';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_MASTER_TOTAL_SUPPLY_MISMATCH');
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

  it('rejects final genesis when Vault already has users, pending state, or distributed activity ATH', () => {
    const input = finalInput();
    input.snapshot.vault.user_count = '1';
    input.snapshot.vault.key_record_count = '1';
    input.snapshot.vault.receive_intent_count = '1';
    input.snapshot.vault.pending_ath_withdrawal_count = '1';
    input.snapshot.vault.pending_publish_count = '1';
    input.snapshot.vault.processed_ath_deposit_count = '1';
    input.snapshot.vault.airdrop_remaining_ath = '29999990000000000';
    input.snapshot.vault.airdrop_distributed_ath = '10000000000';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_USER_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_KEY_RECORD_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_RECEIVE_INTENT_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_PENDING_ATH_WITHDRAWAL_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_PENDING_PUBLISH_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_PROCESSED_ATH_DEPOSIT_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_AIRDROP_REMAINING_NOT_FULL_AT_GENESIS');
    expect(report.issue_codes).toContain('VAULT_AIRDROP_DISTRIBUTED_NOT_ZERO_AT_GENESIS');
  });

  it('rejects final genesis when CapsuleHub already has entries or accrued fees', () => {
    const input = finalInput();
    input.snapshot.capsulehub.private_latest_id = '1';
    input.snapshot.capsulehub.public_latest_id = '1';
    input.snapshot.capsulehub.accrued_plato_fee_ton = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('CAPSULEHUB_PRIVATE_LATEST_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('CAPSULEHUB_PUBLIC_LATEST_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('CAPSULEHUB_ACCRUED_PLATO_FEE_NOT_ZERO_AT_GENESIS');
  });

  it('rejects final genesis when registries or FeeAccumulator already hold records or due buckets', () => {
    const input = finalInput();
    input.snapshot.username_registry.name_record_count = '1';
    input.snapshot.username_registry.pending_mint_count = '1';
    input.snapshot.username_registry.refund_due_count = '1';
    input.snapshot.username_registry.treasury_due_ath = '1';
    input.snapshot.username_registry.burn_due_ath = '1';
    input.snapshot.username_registry.pending_refund_flush_count = '1';
    input.snapshot.username_registry.pending_treasury_flush_count = '1';
    input.snapshot.username_registry.pending_burn_flush_count = '1';
    input.snapshot.profile_registry.profile_count = '1';
    input.snapshot.profile_registry.avatar_record_count = '1';
    input.snapshot.profile_registry.treasury_due_ath = '1';
    input.snapshot.profile_registry.burn_due_ath = '1';
    input.snapshot.profile_registry.pending_treasury_flush_count = '1';
    input.snapshot.profile_registry.pending_burn_flush_count = '1';
    input.snapshot.fee_accumulator.accumulated_ton = '1';
    input.snapshot.fee_accumulator.treasury_due_ton = '1';
    input.snapshot.fee_accumulator.buyback_due_ton = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_NAME_RECORDS_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_TREASURY_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_BURN_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_AVATAR_RECORDS_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_BURN_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_ACCUMULATED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_TREASURY_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_BUYBACK_DUE_NOT_ZERO_AT_GENESIS');
  });

  it('rejects final genesis when MarketStabilitySeller is already priced or funded', () => {
    const input = finalInput();
    input.snapshot.market_stability_seller.pricing_frozen = true;
    input.snapshot.market_stability_seller.genesis_config_hash = '0'.repeat(64);
    input.snapshot.market_stability_seller.reserve_due_ath = '1';
    input.snapshot.market_stability_seller.reserve_funded_total_ath = '1';
    input.snapshot.market_stability_seller.treasury_due_ton = '1';
    input.snapshot.market_stability_seller.sold_ath_total = '1';
    input.snapshot.market_stability_seller.phase = '1';
    input.snapshot.market_stability_seller.pending_query_id = '1';
    input.snapshot.market_stability_seller.pending_amount_ath = '1';
    input.snapshot.market_stability_seller.pending_paid_ton = '1';
    input.snapshot.market_stability_seller.completed_tranche_count = '1';
    input.snapshot.market_stability_seller.current_tranche_sold_ath = '1';
    input.snapshot.market_stability_seller.last_terminal_query_id = '1';
    input.snapshot.market_stability_seller.treasury_flushed_ton_total = '1';
    input.snapshot.market_stability_seller_official_ath_wallet.balance_atomic = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_PRICING_FROZEN_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_LAUNCH_CONTROLLER_HASH_MISSING');
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDED_TOTAL_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_TREASURY_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SOLD_TOTAL_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_PHASE_NOT_IDLE_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_PENDING_QUERY_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_PENDING_AMOUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_PENDING_PAID_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_COMPLETED_TRANCHE_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_CURRENT_TRANCHE_SOLD_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_LAST_TERMINAL_QUERY_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_TREASURY_FLUSHED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS');
  });

  it('rejects final genesis when MarketStabilitySeller getter snapshots are missing', () => {
    const input = finalInput() as any;
    delete input.snapshot.market_stability_seller;
    delete input.snapshot.market_stability_seller_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_MARKET_STABILITY_SELLER_SNAPSHOT');
    expect(report.issue_codes).toContain('MISSING_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects final genesis when MarketStabilitySeller retained launch controller hash does not match the manifest address', () => {
    const input = finalInput();
    input.snapshot.market_stability_seller.genesis_config_hash = hash('wrong_market_stability_launch_controller');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_LAUNCH_CONTROLLER_HASH_MISMATCH');
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
    input.snapshot.buyback_burn.phase = '1';
    input.snapshot.buyback_burn.reserve_due_ton = '1';
    input.snapshot.buyback_burn.pending_query_id = '1';
    input.snapshot.buyback_burn.route_refund_due_ton = '1';
    input.snapshot.buyback_burn.ath_burn_retry_due_atomic = '1';
    input.snapshot.buyback_burn.last_terminal_query_id = '1';
    input.snapshot.buyback_burn.accepted_reserve_count = '1';
    input.snapshot.buyback_burn.executed_buyback_count = '1';
    input.snapshot.buyback_burn.burned_ath_total_atomic = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_ROUTE_FROZEN_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_STATE_NOT_IDLE_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_RESERVE_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_PENDING_QUERY_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_ROUTE_REFUND_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_ATH_BURN_RETRY_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_LAST_TERMINAL_QUERY_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_ACCEPTED_RESERVE_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_EXECUTED_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('BUYBACK_BURNED_ATH_TOTAL_NOT_ZERO_AT_GENESIS');
  });

  it('rejects final genesis when BuybackBurn launch controller hash was cleared too early', () => {
    const input = finalInput();
    input.snapshot.buyback_burn.genesis_config_hash = '0'.repeat(64);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_LAUNCH_CONTROLLER_HASH_MISSING');
  });

  it('rejects final genesis when BuybackBurn retained launch controller hash does not match the manifest address', () => {
    const input = finalInput();
    input.snapshot.buyback_burn.genesis_config_hash = hash('wrong_buyback_launch_controller');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_LAUNCH_CONTROLLER_HASH_MISMATCH');
  });
});
