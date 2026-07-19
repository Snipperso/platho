import { createHash } from 'crypto';
import { Address, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  computeFinalGenesisManifestHashHex,
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

function resealToManifest(input: MainnetGenesisVerifyInput) {
  const manifestHash = computeFinalGenesisManifestHashHex(input.manifest);
  input.manifest.manifest_hash_hex = manifestHash;
  for (const key of [
    'vault',
    'market_stability_seller',
    'capsulehub',
    'username_registry',
    'profile_registry',
    'buyback_burn',
  ] as const) {
    input.snapshot[key].deployment_manifest_hash = manifestHash;
  }
}

function markOfficialWalletUninit(input: MainnetGenesisVerifyInput, key: keyof MainnetGenesisVerifyInput['snapshot']) {
  const wallet = (input.snapshot as any)[key];
  wallet.account_state = 'uninit';
  wallet.code_hash = '';
  wallet.owner_address = '';
  wallet.ath_master_address = '';
  wallet.balance_atomic = '0';
}

function finalInput(): MainnetGenesisVerifyInput {
  const addresses = {
    ath_master: addr('ath_master'),
    ath_long_term_vesting: addr('ath_long_term_vesting'),
    ath_long_term_vesting_beneficiary: addr('ath_long_term_vesting_beneficiary'),
    ath_long_term_vesting_official_ath_wallet: addr('ath_long_term_vesting_official_ath_wallet'),
    ath_treasury_owner: addr('ath_treasury_owner'),
    ath_treasury_owner_ath_wallet: addr('ath_treasury_owner_ath_wallet'),
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
    ath_vesting: hash('ath_vesting'),
    ath_wallet: hash('ath_wallet'),
    vault: hash('vault'),
    market_stability_seller: hash('market_stability_seller'),
    capsulehub: hash('capsulehub'),
    username_nft_item: hash('username_nft_item'),
    username_registry: hash('username_registry'),
    profile_registry: hash('profile_registry'),
    buyback_burn: hash('buyback_burn'),
    fee_accumulator: hash('fee_accumulator'),
  };
  const state_init_hashes = {
    ath_master: hash('state_init_ath_master'),
    ath_treasury_owner_ath_wallet: hash('state_init_ath_treasury_owner_ath_wallet'),
    ath_long_term_vesting: hash('state_init_ath_long_term_vesting'),
    ath_long_term_vesting_official_ath_wallet: hash('state_init_ath_long_term_vesting_official_ath_wallet'),
    vault: hash('state_init_vault'),
    vault_official_ath_wallet: hash('state_init_vault_official_ath_wallet'),
    market_stability_seller: hash('state_init_market_stability_seller'),
    market_stability_seller_official_ath_wallet: hash('state_init_market_stability_seller_official_ath_wallet'),
    capsulehub: hash('state_init_capsulehub'),
    username_registry: hash('state_init_username_registry'),
    username_registry_official_ath_wallet: hash('state_init_username_registry_official_ath_wallet'),
    profile_registry: hash('state_init_profile_registry'),
    profile_registry_official_ath_wallet: hash('state_init_profile_registry_official_ath_wallet'),
    buyback_burn: hash('state_init_buyback_burn'),
    buyback_burn_official_ath_wallet: hash('state_init_buyback_burn_official_ath_wallet'),
    fee_accumulator: hash('state_init_fee_accumulator'),
  };
  const manifest = {
    profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
    version: 1,
    status: 'FINAL_GENESIS',
    manifest_hash_hex: '0'.repeat(64),
    addresses,
    code_hashes,
    state_init_hashes,
    constants: {
      ath_total_supply_atomic: '100000000000000000',
      vault_activity_airdrop_total_atomic: '15000000000000000',
      ath_long_term_vesting_allocation_atomic: '10000000000000000',
      ath_long_term_vesting_period_count: '100',
      ath_long_term_vesting_period_seconds: '31536000',
      ath_long_term_vesting_period_unlock_amount_atomic: '100000000000000',
      ath_long_term_vesting_start_time_unix: '1770000000',
      ath_market_stability_reserve_allocation_atomic: '60000000000000000',
    },
    blockers_before_final_genesis: [],
  };
  const manifestHash = computeFinalGenesisManifestHashHex(manifest);
  manifest.manifest_hash_hex = manifestHash;

  return {
    document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_INPUT',
    network: 'mainnet',
    manifest,
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
        capsule_hub_bound: true,
        capsule_hub_address: addresses.capsulehub,
        profile_registry_bound: true,
        profile_registry_address: addresses.profile_registry,
        username_registry_bound: true,
        username_registry_address: addresses.username_registry,
        vault_ath_wallet_address: addresses.vault_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        user_count: '0',
        key_record_count: '0',
        receive_intent_count: '0',
        pending_ath_withdrawal_count: '0',
        pending_publish_count: '0',
        processed_ath_deposit_count: '0',
        airdrop_remaining_ath: '15000000000000000',
        airdrop_distributed_ath: '0',
      },
      vault_official_ath_wallet: {
        address: addresses.vault_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.vault,
        ath_master_address: addresses.ath_master,
        balance_atomic: '15000000000000000',
      },
      ath_treasury_owner_ath_wallet: {
        address: addresses.ath_treasury_owner_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.ath_treasury_owner,
        ath_master_address: addresses.ath_master,
        balance_atomic: '15000000000000000',
      },
      ath_long_term_vesting: {
        address: addresses.ath_long_term_vesting,
        code_hash: code_hashes.ath_vesting,
        ath_master_address: addresses.ath_master,
        beneficiary_address: addresses.ath_long_term_vesting_beneficiary,
        official_ath_wallet_address: addresses.ath_long_term_vesting_official_ath_wallet,
        start_time: '1770000000',
        period_seconds: '31536000',
        period_count: '100',
        period_unlock_amount: '100000000000000',
        total_amount: '10000000000000000',
        phase: '0',
        claimed_ath: '0',
        vested_ath: '0',
        claimable_ath: '0',
        pending_query_id: '0',
        pending_amount: '0',
        pending_created_at: '0',
        last_terminal_query_id: '0',
      },
      ath_long_term_vesting_official_ath_wallet: {
        address: addresses.ath_long_term_vesting_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.ath_long_term_vesting,
        ath_master_address: addresses.ath_master,
        balance_atomic: '10000000000000000',
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
        reserve_due_ath: '60000000000000000',
        reserve_funded_total_ath: '60000000000000000',
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
        balance_atomic: '60000000000000000',
      },
      capsulehub: {
        address: addresses.capsulehub,
        code_hash: code_hashes.capsulehub,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        ton_balance: '0',
        vault_bound: true,
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
        official_ath_wallet_bound: true,
        official_ath_wallet_address: addresses.username_registry_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        treasury_ath_receiver: addresses.treasury_ath_receiver,
        name_record_count: '0',
        pending_mint_count: '0',
        treasury_due_ath: '0',
        burn_due_ath: '0',
        pending_treasury_flush_count: '0',
        pending_burn_flush_count: '0',
      },
      username_registry_official_ath_wallet: {
        address: addresses.username_registry_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.username_registry,
        ath_master_address: addresses.ath_master,
        balance_atomic: '0',
      },
      profile_registry: {
        address: addresses.profile_registry,
        code_hash: code_hashes.profile_registry,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        official_ath_wallet_bound: true,
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
      profile_registry_official_ath_wallet: {
        address: addresses.profile_registry_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.profile_registry,
        ath_master_address: addresses.ath_master,
        balance_atomic: '0',
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
      buyback_burn_official_ath_wallet: {
        address: addresses.buyback_burn_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.buyback_burn,
        ath_master_address: addresses.ath_master,
        balance_atomic: '0',
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
    expect(report.input_source).toBeNull();
    expect(report.input_sha256).toBeNull();
    expect(report.evidence_refs).toBeNull();
    expect(report.issue_codes).toEqual(['MISSING_INPUT']);
  });

  it('accepts a final manifest only when getter snapshot bindings match every immutable counterpart', () => {
    const input = finalInput();
    const report = verifyMainnetGenesisSnapshot(input, {
      inputSource: 'artifacts/mainnet_genesis_verify_input.json',
      inputSha256: 'b'.repeat(64),
    });

    expect(report.mainnet_genesis_verified).toBe(true);
    expect(report.status).toBe('MAINNET_GENESIS_VERIFIED');
    expect(report.input_source).toBe('artifacts/mainnet_genesis_verify_input.json');
    expect(report.input_sha256).toBe('b'.repeat(64));
    expect(report.evidence_refs).toEqual(input.evidenceRefs);
    expect(report.issue_codes).toEqual([]);
  });

  it('accepts unfunded official ATH wallets that are still uninit at final genesis', () => {
    const input = finalInput();
    // clean-15: the MSS official ATHWallet is NOT in this set — it holds the fully-capitalized
    // 60M reserve at genesis, so it must be active+funded (covered by the funded-wallet checks).
    markOfficialWalletUninit(input, 'username_registry_official_ath_wallet');
    markOfficialWalletUninit(input, 'profile_registry_official_ath_wallet');
    markOfficialWalletUninit(input, 'buyback_burn_official_ath_wallet');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(true);
    expect(report.status).toBe('MAINNET_GENESIS_VERIFIED');
    expect(report.issue_codes).toEqual([]);
  });

  it('rejects final genesis when the Vault side of the registry bindings is absent or mismatched', () => {
    const vaultProfileUnbound = finalInput();
    vaultProfileUnbound.snapshot.vault.profile_registry_bound = false;
    let report = verifyMainnetGenesisSnapshot(vaultProfileUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_PROFILE_REGISTRY_NOT_BOUND');

    const vaultProfileMismatched = finalInput();
    vaultProfileMismatched.snapshot.vault.profile_registry_address = addr('wrong_vault_profile_registry');
    report = verifyMainnetGenesisSnapshot(vaultProfileMismatched);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_PROFILE_REGISTRY_ADDRESS_MISMATCH');

    const vaultUsernameUnbound = finalInput();
    vaultUsernameUnbound.snapshot.vault.username_registry_bound = false;
    report = verifyMainnetGenesisSnapshot(vaultUsernameUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_USERNAME_REGISTRY_NOT_BOUND');

    const vaultUsernameMismatched = finalInput();
    vaultUsernameMismatched.snapshot.vault.username_registry_address = addr('wrong_vault_username_registry');
    report = verifyMainnetGenesisSnapshot(vaultUsernameMismatched);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_USERNAME_REGISTRY_ADDRESS_MISMATCH');
  });

  it('rejects final genesis when core Vault/CapsuleHub/Profile/Username roles collapse to one address', () => {
    const profileUsernameCollision = finalInput();
    profileUsernameCollision.manifest.addresses.profile_registry = profileUsernameCollision.manifest.addresses.username_registry;
    profileUsernameCollision.snapshot.profile_registry.address = profileUsernameCollision.manifest.addresses.username_registry;
    profileUsernameCollision.snapshot.vault.profile_registry_address = profileUsernameCollision.manifest.addresses.username_registry;
    resealToManifest(profileUsernameCollision);

    let report = verifyMainnetGenesisSnapshot(profileUsernameCollision);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_GENESIS_CORE_CONTRACT_ADDRESS_COLLISION');

    const vaultCapsuleCollision = finalInput();
    vaultCapsuleCollision.manifest.addresses.capsulehub = vaultCapsuleCollision.manifest.addresses.vault;
    vaultCapsuleCollision.snapshot.capsulehub.address = vaultCapsuleCollision.manifest.addresses.vault;
    vaultCapsuleCollision.snapshot.vault.capsule_hub_address = vaultCapsuleCollision.manifest.addresses.vault;
    resealToManifest(vaultCapsuleCollision);

    report = verifyMainnetGenesisSnapshot(vaultCapsuleCollision);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_GENESIS_CORE_CONTRACT_ADDRESS_COLLISION');
  });

  it('rejects funded official ATH wallets that are still uninit', () => {
    const input = finalInput();
    markOfficialWalletUninit(input, 'vault_official_ath_wallet');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_OFFICIAL_ATH_WALLET_NOT_ACTIVE');
    expect(report.issue_codes).toContain('VAULT_ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT');
  });

  it('rejects an uninit zero official ATH wallet when the manifest lacks its StateInit hash', () => {
    const input = finalInput();
    markOfficialWalletUninit(input, 'username_registry_official_ath_wallet');
    delete input.manifest.state_init_hashes!.username_registry_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_STATE_INIT_HASH_MISSING');
  });

  it('rejects a final manifest whose hash does not commit to changed addresses', () => {
    const input = finalInput();
    const staleHash = input.manifest.manifest_hash_hex;
    const changedVault = addr('changed_vault_address');
    input.manifest.addresses.vault = changedVault;
    input.snapshot.vault.address = changedVault;
    input.snapshot.capsulehub.vault_address = changedVault;
    input.snapshot.vault_official_ath_wallet.owner_address = changedVault;
    input.manifest.manifest_hash_hex = staleHash;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_HASH_MISMATCH');
  });

  it('rejects a final manifest whose hash does not commit to changed code hashes', () => {
    const input = finalInput();
    input.manifest.code_hashes.vault = hash('changed_vault_code_hash');
    input.snapshot.vault.code_hash = input.manifest.code_hashes.vault;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_HASH_MISMATCH');
  });

  it('rejects a final manifest whose hash does not commit to changed StateInit hashes', () => {
    const input = finalInput();
    input.manifest.state_init_hashes!.vault = hash('changed_vault_state_init_hash');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_HASH_MISMATCH');
  });

  it('rejects a final manifest whose hash does not commit to changed constants', () => {
    const input = finalInput();
    input.manifest.constants!.additional_release_constant = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_HASH_MISMATCH');
  });

  it('rejects final manifests without StateInit hashes', () => {
    const input = finalInput() as any;
    delete input.manifest.state_init_hashes;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_STATE_INIT_HASHES_MISSING');
  });

  it('rejects sealing a correct manifest hash with the wrong Vault counterpart address', () => {
    const input = finalInput();
    input.snapshot.vault.capsule_hub_address = addr('wrong_capsulehub');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_CAPSULE_HUB_ADDRESS_MISMATCH');
  });

  it('rejects final genesis when Vault/CapsuleHub binding flags are false', () => {
    const vaultUnbound = finalInput();
    vaultUnbound.snapshot.vault.capsule_hub_bound = false;
    let report = verifyMainnetGenesisSnapshot(vaultUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_CAPSULE_HUB_NOT_BOUND');

    const capsuleHubUnbound = finalInput();
    capsuleHubUnbound.snapshot.capsulehub.vault_bound = false;
    report = verifyMainnetGenesisSnapshot(capsuleHubUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('CAPSULEHUB_VAULT_NOT_BOUND');
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
    input.snapshot.ath_long_term_vesting.ath_master_address = masterchainAthMaster;
    input.snapshot.ath_long_term_vesting_official_ath_wallet.ath_master_address = masterchainAthMaster;
    input.snapshot.market_stability_seller.ath_master_address = masterchainAthMaster;
    input.snapshot.market_stability_seller_official_ath_wallet.ath_master_address = masterchainAthMaster;
    input.snapshot.username_registry.ath_master_address = masterchainAthMaster;
    input.snapshot.username_registry_official_ath_wallet.ath_master_address = masterchainAthMaster;
    input.snapshot.profile_registry.ath_master_address = masterchainAthMaster;
    input.snapshot.buyback_burn.ath_master_address = masterchainAthMaster;
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_ATH_MASTER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('BUYBACK_ATH_MASTER_NOT_BASECHAIN');
  });

  it('rejects self-consistent masterchain protocol-owned contracts and official wallet addresses', () => {
    const input = finalInput();
    const addresses = {
      ath_treasury_owner: addr('masterchain_ath_treasury_owner', -1),
      ath_treasury_owner_ath_wallet: addr('masterchain_ath_treasury_owner_wallet', -1),
      genesis_controller_one_shot: addr('masterchain_genesis_controller', -1),
      vault: addr('masterchain_vault', -1),
      vault_official_ath_wallet: addr('masterchain_vault_wallet', -1),
      ath_long_term_vesting: addr('masterchain_ath_long_term_vesting', -1),
      ath_long_term_vesting_beneficiary: addr('masterchain_ath_long_term_vesting_beneficiary', -1),
      ath_long_term_vesting_official_ath_wallet: addr('masterchain_ath_long_term_vesting_wallet', -1),
      capsulehub: addr('masterchain_capsulehub', -1),
      fee_accumulator: addr('masterchain_fee_accumulator', -1),
      buyback_burn: addr('masterchain_buyback', -1),
      buyback_burn_initial_genesis_controller: addr('masterchain_buyback_controller', -1),
      buyback_burn_official_ath_wallet: addr('masterchain_buyback_wallet', -1),
      market_stability_seller: addr('masterchain_market_seller', -1),
      market_stability_seller_initial_genesis_controller: addr('masterchain_market_controller', -1),
      market_stability_seller_official_ath_wallet: addr('masterchain_market_seller_wallet', -1),
      username_registry: addr('masterchain_username_registry', -1),
      username_registry_official_ath_wallet: addr('masterchain_username_wallet', -1),
      profile_registry: addr('masterchain_profile_registry', -1),
      profile_registry_official_ath_wallet: addr('masterchain_profile_wallet', -1),
      treasury_ath_receiver: addr('masterchain_treasury_ath_receiver', -1),
      profile_registry_treasury_ath_receiver: addr('masterchain_profile_treasury', -1),
      fee_accumulator_ton_treasury_receiver: addr('masterchain_fee_treasury', -1),
      market_stability_reserve_funder: addr('masterchain_market_funder', -1),
      market_stability_ton_treasury_receiver: addr('masterchain_market_treasury', -1),
    };
    Object.assign(input.manifest.addresses, addresses);
    input.snapshot.ath_master.treasury_owner_address = addresses.ath_treasury_owner;
    input.snapshot.ath_treasury_owner_ath_wallet.address = addresses.ath_treasury_owner_ath_wallet;
    input.snapshot.ath_treasury_owner_ath_wallet.owner_address = addresses.ath_treasury_owner;
    input.snapshot.vault.address = addresses.vault;
    input.snapshot.vault.vault_ath_wallet_address = addresses.vault_official_ath_wallet;
    input.snapshot.vault.capsule_hub_address = addresses.capsulehub;
    input.snapshot.vault_official_ath_wallet.address = addresses.vault_official_ath_wallet;
    input.snapshot.vault_official_ath_wallet.owner_address = addresses.vault;
    input.snapshot.ath_long_term_vesting.address = addresses.ath_long_term_vesting;
    input.snapshot.ath_long_term_vesting.beneficiary_address = addresses.ath_long_term_vesting_beneficiary;
    input.snapshot.ath_long_term_vesting.official_ath_wallet_address = addresses.ath_long_term_vesting_official_ath_wallet;
    input.snapshot.ath_long_term_vesting_official_ath_wallet.address = addresses.ath_long_term_vesting_official_ath_wallet;
    input.snapshot.ath_long_term_vesting_official_ath_wallet.owner_address = addresses.ath_long_term_vesting;
    input.snapshot.capsulehub.address = addresses.capsulehub;
    input.snapshot.capsulehub.vault_address = addresses.vault;
    input.snapshot.capsulehub.fee_accumulator_address = addresses.fee_accumulator;
    input.snapshot.fee_accumulator.address = addresses.fee_accumulator;
    input.snapshot.fee_accumulator.buyback_burn_address = addresses.buyback_burn;
    input.snapshot.fee_accumulator.ton_treasury_receiver = addresses.fee_accumulator_ton_treasury_receiver;
    input.snapshot.buyback_burn.address = addresses.buyback_burn;
    input.snapshot.buyback_burn.fee_accumulator_address = addresses.fee_accumulator;
    input.snapshot.buyback_burn.official_ath_wallet_address = addresses.buyback_burn_official_ath_wallet;
    input.snapshot.buyback_burn_official_ath_wallet.address = addresses.buyback_burn_official_ath_wallet;
    input.snapshot.buyback_burn_official_ath_wallet.owner_address = addresses.buyback_burn;
    input.snapshot.market_stability_seller.address = addresses.market_stability_seller;
    input.snapshot.market_stability_seller.reserve_funder_address = addresses.market_stability_reserve_funder;
    input.snapshot.market_stability_seller.official_ath_wallet_address = addresses.market_stability_seller_official_ath_wallet;
    input.snapshot.market_stability_seller.ton_treasury_receiver_address = addresses.market_stability_ton_treasury_receiver;
    input.snapshot.market_stability_seller_official_ath_wallet.address = addresses.market_stability_seller_official_ath_wallet;
    input.snapshot.market_stability_seller_official_ath_wallet.owner_address = addresses.market_stability_seller;
    input.snapshot.username_registry.address = addresses.username_registry;
    input.snapshot.username_registry.official_ath_wallet_address = addresses.username_registry_official_ath_wallet;
    input.snapshot.username_registry.treasury_ath_receiver = addresses.treasury_ath_receiver;
    input.snapshot.username_registry_official_ath_wallet.address = addresses.username_registry_official_ath_wallet;
    input.snapshot.username_registry_official_ath_wallet.owner_address = addresses.username_registry;
    input.snapshot.profile_registry.address = addresses.profile_registry;
    input.snapshot.profile_registry.official_ath_wallet_address = addresses.profile_registry_official_ath_wallet;
    input.snapshot.profile_registry.treasury_ath_receiver = addresses.profile_registry_treasury_ath_receiver;
    input.snapshot.profile_registry_official_ath_wallet.address = addresses.profile_registry_official_ath_wallet;
    input.snapshot.profile_registry_official_ath_wallet.owner_address = addresses.profile_registry;
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('VAULT_ADDRESS_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('VAULT_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('VAULT_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_ADDRESS_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_BENEFICIARY_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_TREASURY_OWNER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_TREASURY_OWNER_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_TREASURY_OWNER_ATH_WALLET_ADDRESS_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('ATH_MASTER_TREASURY_OWNER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('GENESIS_CONTROLLER_ONE_SHOT_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('CAPSULEHUB_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('BUYBACK_BURN_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('BUYBACK_BURN_INITIAL_GENESIS_CONTROLLER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('BUYBACK_BURN_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_INITIAL_GENESIS_CONTROLLER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('TREASURY_ATH_RECEIVER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_TREASURY_ATH_RECEIVER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_TON_TREASURY_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_TON_TREASURY_RECEIVER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_TON_TREASURY_NOT_BASECHAIN');
  });

  it('rejects self-consistent non-basechain MarketStabilitySeller reserve funder binding', () => {
    const input = finalInput();
    const masterchainReserveFunder = addr('market_stability_reserve_funder_masterchain', -1);
    input.manifest.addresses.market_stability_reserve_funder = masterchainReserveFunder;
    input.snapshot.market_stability_seller.reserve_funder_address = masterchainReserveFunder;
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDER_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_RESERVE_FUNDER_NOT_BASECHAIN');
  });

  it('rejects self-consistent protocol-owned MarketStabilitySeller reserve funder binding', () => {
    const input = finalInput();
    input.manifest.addresses.market_stability_reserve_funder = input.manifest.addresses.market_stability_seller;
    input.snapshot.market_stability_seller.reserve_funder_address = input.manifest.addresses.market_stability_seller;
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDER_IS_PROTOCOL_ROLE');
  });

  it('rejects self-consistent non-basechain MarketStabilitySeller TON treasury binding', () => {
    const input = finalInput();
    const masterchainTonTreasury = addr('market_stability_ton_treasury_masterchain', -1);
    input.manifest.addresses.market_stability_ton_treasury_receiver = masterchainTonTreasury;
    input.snapshot.market_stability_seller.ton_treasury_receiver_address = masterchainTonTreasury;
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_TON_TREASURY_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_TON_TREASURY_NOT_BASECHAIN');
  });

  it('rejects final genesis when ATHMaster total supply does not match the manifest supply constant', () => {
    const input = finalInput();
    input.snapshot.ath_master.total_supply_atomic = '99999999999999999';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_MASTER_TOTAL_SUPPLY_MISMATCH');
  });

  it('rejects final genesis when ATHMaster treasury supply has not been deployed', () => {
    const input = finalInput();
    input.snapshot.ath_master.treasury_supply_deployed = false;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_TREASURY_SUPPLY_NOT_DEPLOYED');
  });

  it('rejects a self-consistent manifest with a non-100M ATH total supply constant', () => {
    const input = finalInput();
    input.manifest.constants!.ath_total_supply_atomic = '90000000000000000';
    input.snapshot.ath_master.total_supply_atomic = '90000000000000000';
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_TOTAL_SUPPLY_CONSTANT_MISMATCH');
  });

  it('rejects a self-consistent manifest with a non-15M Vault activity airdrop constant', () => {
    const input = finalInput();
    input.manifest.constants!.vault_activity_airdrop_total_atomic = '14000000000000000';
    input.snapshot.vault.airdrop_remaining_ath = '14000000000000000';
    input.snapshot.vault_official_ath_wallet.balance_atomic = '14000000000000000';
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_ACTIVITY_AIRDROP_TOTAL_CONSTANT_MISMATCH');
  });

  it('rejects a manifest with a non-60M market-stability reserve constant', () => {
    const input = finalInput();
    input.manifest.constants!.ath_market_stability_reserve_allocation_atomic = '59000000000000000';
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_CONSTANT_MISMATCH');
  });

  it('rejects a self-consistent manifest with a non-10M long-term vesting constant', () => {
    const input = finalInput();
    input.manifest.constants!.ath_long_term_vesting_allocation_atomic = '9999999999999999';
    input.snapshot.ath_long_term_vesting.total_amount = '9999999999999999';
    input.snapshot.ath_long_term_vesting_official_ath_wallet.balance_atomic = '9999999999999999';
    resealToManifest(input);

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_CONSTANT_MISMATCH');
  });

  it('rejects final genesis when ATHVesting official wallet is not exactly funded', () => {
    const input = finalInput();
    input.snapshot.ath_long_term_vesting_official_ath_wallet.balance_atomic = '10000000000000001';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_BACKING_BALANCE_NOT_EXACT');
  });

  it('RT-VEST-001: rejects final genesis when ATHVesting official wallet has the wrong code hash', () => {
    const input = finalInput();
    input.snapshot.ath_long_term_vesting_official_ath_wallet.code_hash = hash('wrong_ath_vesting_official_wallet_code');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_CODE_HASH_MISMATCH');
  });

  it('rejects final genesis when ATHVesting already has claimed or pending state', () => {
    const input = finalInput();
    input.snapshot.ath_long_term_vesting.claimed_ath = '1';
    input.snapshot.ath_long_term_vesting.vested_ath = '1';
    input.snapshot.ath_long_term_vesting.claimable_ath = '1';
    input.snapshot.ath_long_term_vesting.phase = '1';
    input.snapshot.ath_long_term_vesting.pending_query_id = '1';
    input.snapshot.ath_long_term_vesting.pending_amount = '1';
    input.snapshot.ath_long_term_vesting.pending_created_at = '1';
    input.snapshot.ath_long_term_vesting.last_terminal_query_id = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_CLAIMED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_VESTED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_CLAIMABLE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_PHASE_NOT_IDLE_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_PENDING_QUERY_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_PENDING_AMOUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_PENDING_CREATED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_LAST_TERMINAL_QUERY_NOT_ZERO_AT_GENESIS');
  });

  it('RT-VEST-005: rejects final genesis if ATHVesting start time is stale enough to unlock immediately', () => {
    const input = finalInput();
    input.snapshot.ath_long_term_vesting.vested_ath = '100000000000000';
    input.snapshot.ath_long_term_vesting.claimable_ath = '100000000000000';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_VESTED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_CLAIMABLE_NOT_ZERO_AT_GENESIS');
  });

  it('rejects final genesis when ATHVesting snapshot identity is wrong or missing', () => {
    const input = finalInput() as any;
    input.snapshot.ath_long_term_vesting.beneficiary_address = addr('wrong_vesting_beneficiary');
    input.snapshot.ath_long_term_vesting.official_ath_wallet_address = addr('wrong_vesting_wallet');
    input.snapshot.ath_long_term_vesting_official_ath_wallet.owner_address = addr('wrong_vesting_owner');
    input.snapshot.ath_long_term_vesting_official_ath_wallet.ath_master_address = addr('wrong_vesting_master');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_BENEFICIARY_MISMATCH');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_MISMATCH');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_MASTER_MISMATCH');

    const missing = finalInput() as any;
    delete missing.snapshot.ath_long_term_vesting;
    delete missing.snapshot.ath_long_term_vesting_official_ath_wallet;

    const missingReport = verifyMainnetGenesisSnapshot(missing);

    expect(missingReport.mainnet_genesis_verified).toBe(false);
    expect(missingReport.issue_codes).toContain('MISSING_ATH_LONG_TERM_VESTING_SNAPSHOT');
    expect(missingReport.issue_codes).toContain('MISSING_ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects sealing a correct manifest hash with the wrong ProfileRegistry official ATH wallet', () => {
    const input = finalInput();
    input.snapshot.profile_registry.official_ath_wallet_address = addr('wrong_profile_registry_official_ath_wallet');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_MISMATCH');
  });

  it('rejects final genesis when ProfileRegistry official ATH wallet binding flag is false', () => {
    const input = finalInput();
    input.snapshot.profile_registry.official_ath_wallet_bound = false;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BOUND');
  });

  it('rejects final genesis when ProfileRegistry treasury receiver is a protocol-owned address', () => {
    const cases: Array<[keyof ReturnType<typeof finalInput>['manifest']['addresses'], string]> = [
      ['profile_registry', 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_PROFILE_REGISTRY'],
      ['profile_registry_official_ath_wallet', 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_OFFICIAL_ATH_WALLET'],
      ['vault', 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_VAULT'],
      ['ath_master', 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_ATH_MASTER'],
    ];

    for (const [addressKey, issueCode] of cases) {
      const input = finalInput();
      const protocolAddress = input.manifest.addresses[addressKey];
      input.manifest.addresses.profile_registry_treasury_ath_receiver = protocolAddress;
      input.snapshot.profile_registry.treasury_ath_receiver = protocolAddress;

      const report = verifyMainnetGenesisSnapshot(input);

      expect(report.mainnet_genesis_verified).toBe(false);
      expect(report.issue_codes).toContain(issueCode);
    }
  });

  it('rejects final genesis when official Vault ATH wallet underfunds the activity airdrop allocation', () => {
    const input = finalInput();
    input.snapshot.vault_official_ath_wallet.balance_atomic = '14999999999999999';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT');
  });

  it('rejects final genesis when official Vault ATH wallet overfunds the activity airdrop allocation', () => {
    const input = finalInput();
    input.snapshot.vault_official_ath_wallet.balance_atomic = '15000000000000001';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('VAULT_ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT');
  });

  it('rejects final genesis when the Treasury Owner ATH wallet does not custody the remaining 75M ATH', () => {
    const underfunded = finalInput();
    underfunded.snapshot.ath_treasury_owner_ath_wallet.balance_atomic = '74999999999999999';
    let report = verifyMainnetGenesisSnapshot(underfunded);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_TREASURY_OWNER_REMAINING_BALANCE_NOT_EXACT');

    const wrongOwner = finalInput();
    wrongOwner.snapshot.ath_treasury_owner_ath_wallet.owner_address = addr('wrong_treasury_owner');
    report = verifyMainnetGenesisSnapshot(wrongOwner);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ATH_TREASURY_OWNER_ATH_WALLET_OWNER_MISMATCH');

    const missing = finalInput() as any;
    delete missing.snapshot.ath_treasury_owner_ath_wallet;
    report = verifyMainnetGenesisSnapshot(missing);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_ATH_TREASURY_OWNER_ATH_WALLET_SNAPSHOT');
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

  it('allows CapsuleHub to start below the protected reserve floor at final genesis', () => {
    const input = finalInput();
    input.snapshot.capsulehub.ton_balance = '99999999999';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(true);
    expect(report.issue_codes).toEqual([]);
  });

  it('rejects final genesis when CapsuleHub raw TON balance snapshot is malformed', () => {
    const input = finalInput();
    input.snapshot.capsulehub.ton_balance = 'not-a-decimal';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('CAPSULEHUB_TON_BALANCE_INVALID_AT_GENESIS');
  });

  it('rejects final genesis when registries or FeeAccumulator already hold records or due buckets', () => {
    const input = finalInput();
    input.snapshot.username_registry.name_record_count = '1';
    input.snapshot.username_registry.pending_mint_count = '1';
    input.snapshot.username_registry.treasury_due_ath = '1';
    input.snapshot.username_registry.burn_due_ath = '1';
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

  it('rejects final genesis when UsernameRegistry official ATH wallet snapshot is missing', () => {
    const input = finalInput() as any;
    delete input.snapshot.username_registry_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects final genesis when UsernameRegistry official ATH wallet owner or master is wrong', () => {
    const input = finalInput();
    input.snapshot.username_registry_official_ath_wallet.owner_address = addr('wrong_username_registry_owner');
    input.snapshot.username_registry_official_ath_wallet.ath_master_address = addr('wrong_username_registry_master');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_MASTER_MISMATCH');
  });

  it('rejects final genesis when UsernameRegistry official ATH wallet is funded', () => {
    const input = finalInput();
    input.snapshot.username_registry_official_ath_wallet.balance_atomic = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS');
  });

  it('rejects final genesis when UsernameRegistry official ATH wallet binding flag is false', () => {
    const input = finalInput();
    input.snapshot.username_registry.official_ath_wallet_bound = false;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BOUND');
  });

  it('rejects final genesis when UsernameRegistry treasury receiver is a protocol-owned address', () => {
    const cases: Array<[keyof ReturnType<typeof finalInput>['manifest']['addresses'], string]> = [
      ['username_registry', 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_USERNAME_REGISTRY'],
      ['username_registry_official_ath_wallet', 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_OFFICIAL_ATH_WALLET'],
      ['vault', 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_VAULT'],
      ['ath_master', 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_ATH_MASTER'],
    ];

    for (const [addressKey, issueCode] of cases) {
      const input = finalInput();
      const protocolAddress = input.manifest.addresses[addressKey];
      input.manifest.addresses.treasury_ath_receiver = protocolAddress;
      input.snapshot.username_registry.treasury_ath_receiver = protocolAddress;

      const report = verifyMainnetGenesisSnapshot(input);

      expect(report.mainnet_genesis_verified).toBe(false);
      expect(report.issue_codes).toContain(issueCode);
    }
  });

  it('rejects final genesis when broader treasury receiver roles point at protocol-owned addresses', () => {
    const feeInput = finalInput();
    feeInput.manifest.addresses.fee_accumulator_ton_treasury_receiver = feeInput.manifest.addresses.fee_accumulator;
    feeInput.snapshot.fee_accumulator.ton_treasury_receiver = feeInput.manifest.addresses.fee_accumulator;
    let report = verifyMainnetGenesisSnapshot(feeInput);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FEE_ACCUMULATOR_TON_TREASURY_IS_PROTOCOL_ROLE');

    const marketInput = finalInput();
    marketInput.manifest.addresses.market_stability_ton_treasury_receiver = marketInput.manifest.addresses.market_stability_seller;
    marketInput.snapshot.market_stability_seller.ton_treasury_receiver_address = marketInput.manifest.addresses.market_stability_seller;
    report = verifyMainnetGenesisSnapshot(marketInput);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_TON_TREASURY_IS_PROTOCOL_ROLE');

    const profileInput = finalInput();
    profileInput.manifest.addresses.profile_registry_treasury_ath_receiver = profileInput.manifest.addresses.buyback_burn_official_ath_wallet;
    profileInput.snapshot.profile_registry.treasury_ath_receiver = profileInput.manifest.addresses.buyback_burn_official_ath_wallet;
    report = verifyMainnetGenesisSnapshot(profileInput);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_TREASURY_RECEIVER_IS_PROTOCOL_ROLE');

    const usernameInput = finalInput();
    usernameInput.manifest.addresses.treasury_ath_receiver = usernameInput.manifest.addresses.market_stability_seller_official_ath_wallet;
    usernameInput.snapshot.username_registry.treasury_ath_receiver = usernameInput.manifest.addresses.market_stability_seller_official_ath_wallet;
    report = verifyMainnetGenesisSnapshot(usernameInput);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_TREASURY_RECEIVER_IS_PROTOCOL_ROLE');
  });

  it('RT-FEE-04: rejects FeeAccumulator TON treasury receiver equal to protocol-owned roles', () => {
    const cases: Array<keyof ReturnType<typeof finalInput>['manifest']['addresses']> = [
      'vault',
      'capsulehub',
      'ath_master',
      'buyback_burn',
      'market_stability_seller',
      'username_registry',
      'profile_registry',
      'ath_long_term_vesting',
      'vault_official_ath_wallet',
      'buyback_burn_official_ath_wallet',
      'market_stability_seller_official_ath_wallet',
      'username_registry_official_ath_wallet',
      'profile_registry_official_ath_wallet',
      'ath_long_term_vesting_official_ath_wallet',
      'ath_treasury_owner_ath_wallet',
    ];

    for (const addressKey of cases) {
      const input = finalInput();
      const protocolAddress = input.manifest.addresses[addressKey];
      input.manifest.addresses.fee_accumulator_ton_treasury_receiver = protocolAddress;
      input.snapshot.fee_accumulator.ton_treasury_receiver = protocolAddress;

      const report = verifyMainnetGenesisSnapshot(input);

      expect(report.mainnet_genesis_verified, addressKey).toBe(false);
      expect(report.issue_codes, addressKey).toContain('FEE_ACCUMULATOR_TON_TREASURY_IS_PROTOCOL_ROLE');
    }
  });

  it('rejects final genesis when UsernameRegistry treasury ATH receiver is not basechain', () => {
    const input = finalInput();
    const masterchainTreasury = addr('username_treasury_masterchain', -1);
    input.manifest.addresses.treasury_ath_receiver = masterchainTreasury;
    input.snapshot.username_registry.treasury_ath_receiver = masterchainTreasury;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_TREASURY_RECEIVER_NOT_BASECHAIN');
  });

  it('rejects final genesis when ProfileRegistry official ATH wallet snapshot is missing', () => {
    const input = finalInput() as any;
    delete input.snapshot.profile_registry_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects final genesis when ProfileRegistry official ATH wallet owner or master is wrong', () => {
    const input = finalInput();
    input.snapshot.profile_registry_official_ath_wallet.owner_address = addr('wrong_profile_registry_owner');
    input.snapshot.profile_registry_official_ath_wallet.ath_master_address = addr('wrong_profile_registry_master');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_MASTER_MISMATCH');
  });

  it('rejects final genesis when ProfileRegistry official ATH wallet is funded', () => {
    const input = finalInput();
    input.snapshot.profile_registry_official_ath_wallet.balance_atomic = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS');
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
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_DUE_NOT_FULLY_CAPITALIZED');
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDED_TOTAL_NOT_FULLY_CAPITALIZED');
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

  it('rejects final genesis when BuybackBurn official ATH wallet snapshot is missing', () => {
    const input = finalInput() as any;
    delete input.snapshot.buyback_burn_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_BUYBACK_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects final genesis when BuybackBurn official ATH wallet owner or master is wrong', () => {
    const input = finalInput();
    input.snapshot.buyback_burn_official_ath_wallet.owner_address = addr('wrong_buyback_owner');
    input.snapshot.buyback_burn_official_ath_wallet.ath_master_address = addr('wrong_buyback_master');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_OFFICIAL_ATH_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('BUYBACK_OFFICIAL_ATH_WALLET_MASTER_MISMATCH');
  });

  it('rejects final genesis when BuybackBurn official ATH wallet is funded', () => {
    const input = finalInput();
    input.snapshot.buyback_burn_official_ath_wallet.balance_atomic = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('BUYBACK_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS');
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
