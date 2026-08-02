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
    'airdrop_pool',
    'market_stability_seller',
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
    airdrop_pool: addr('airdrop_pool'),
    airdrop_pool_official_ath_wallet: addr('airdrop_pool_official_ath_wallet'),
    airdrop_pool_treasury: addr('treasury_ath_receiver'),
    market_stability_seller: addr('market_stability_seller'),
    market_stability_seller_initial_genesis_controller: addr('market_stability_seller_initial_genesis_controller'),
    market_stability_seller_official_ath_wallet: addr('market_stability_seller_official_ath_wallet'),
    market_stability_reserve_funder: addr('market_stability_reserve_funder'),
    market_stability_ton_treasury_receiver: addr('market_stability_ton_treasury_receiver'),
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
    market_stability_seller: hash('market_stability_seller'),
    airdrop_pool: hash('airdrop_pool'),
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
    airdrop_pool: hash('state_init_airdrop_pool'),
    airdrop_pool_official_ath_wallet: hash('state_init_airdrop_pool_official_ath_wallet'),
    market_stability_seller: hash('state_init_market_stability_seller'),
    market_stability_seller_official_ath_wallet: hash('state_init_market_stability_seller_official_ath_wallet'),
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
      airdrop_pool: {
        address: addresses.airdrop_pool,
        code_hash: code_hashes.airdrop_pool,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        ath_master_bound: true,
        credit_issuer_bound: true,
        treasury_bound: true,
        ath_master_address: addresses.ath_master,
        pool_ath_wallet_address: addresses.airdrop_pool_official_ath_wallet,
        credit_issuer_address: addresses.fee_accumulator,
        treasury_address: addresses.airdrop_pool_treasury,
        ath_per_credit: '10000000000',
        total_pool: '15000000000000000',
        funded_amount: '15000000000000000',
        remaining_budget: '15000000000000000',
        distributed_total: '0',
        claim_count: '0',
        sealed_at: '1770000100',
        genesis_config_hash: '0',
      },
      airdrop_pool_official_ath_wallet: {
        address: addresses.airdrop_pool_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.airdrop_pool,
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
        // [CUTOVER 2026-08-02] Zero, not the launch controller's hash. clean-17's SealMarketStabilityGenesis clears
        // this field to revoke the controller — see the inverted check in the verifier.
        genesis_config_hash: '0'.repeat(64),
        pricing_frozen: true,
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
      username_registry: {
        address: addresses.username_registry,
        code_hash: code_hashes.username_registry,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        official_ath_wallet_bound: true,
        official_ath_wallet_address: addresses.username_registry_official_ath_wallet,
        ath_master_address: addresses.ath_master,
        treasury_ath_receiver: addresses.treasury_ath_receiver,
        // name_record_count is gone with the name dictionary clean-17 deleted — that removal is what lifted the
        // 13,076-name ceiling. "No name minted before the seal" is now proved by treasury_due/burn_due below plus the
        // registry's official wallet never having been deployed.
        pending_mint_count: '0',
        treasury_due_ath: '0',
        burn_due_ath: '0',
        pending_treasury_flush_count: '0',
        pending_burn_flush_count: '0',
        // The art and collection-metadata locks. SealGenesis refuses without them (19045 / 19046) precisely because
        // the seal does NOT revoke the genesis controller: skip SealArt and a hot wallet keeps permanent write
        // authority over the SVG every .ath NFT renders. The verifier now asserts both — the two upload scripts had
        // claimed for months that it did, and it did not.
        art_sealed: true,
        meta_sealed: true,
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
        pending_avatar_write_count: '0',
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

  it('rejects final genesis when AirdropPool binds are absent or the distributor/treasury mismatch', () => {
    const athMasterUnbound = finalInput();
    athMasterUnbound.snapshot.airdrop_pool.ath_master_bound = false;
    let report = verifyMainnetGenesisSnapshot(athMasterUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_ATH_MASTER_NOT_BOUND');

    // clean-17: the distributor bound into the pool must be the FeeAccumulator address (the getter field is NAMED
    // credit_issuer_address but there is no CreditIssuer contract). A wrong distributor is a fatal, unfixable misroute.
    const distributorMismatch = finalInput();
    distributorMismatch.snapshot.airdrop_pool.credit_issuer_address = addr('wrong_distributor');
    report = verifyMainnetGenesisSnapshot(distributorMismatch);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_DISTRIBUTOR_NOT_FEE_ACCUMULATOR');

    const treasuryMismatch = finalInput();
    treasuryMismatch.snapshot.airdrop_pool.treasury_address = addr('wrong_treasury');
    report = verifyMainnetGenesisSnapshot(treasuryMismatch);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_TREASURY_MISMATCH');
  });

  it('rejects final genesis when core AirdropPool/Profile/Username roles collapse to one address', () => {
    const profileUsernameCollision = finalInput();
    profileUsernameCollision.manifest.addresses.profile_registry = profileUsernameCollision.manifest.addresses.username_registry;
    profileUsernameCollision.snapshot.profile_registry.address = profileUsernameCollision.manifest.addresses.username_registry;
    resealToManifest(profileUsernameCollision);

    let report = verifyMainnetGenesisSnapshot(profileUsernameCollision);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_GENESIS_CORE_CONTRACT_ADDRESS_COLLISION');

    const poolUsernameCollision = finalInput();
    poolUsernameCollision.manifest.addresses.airdrop_pool = poolUsernameCollision.manifest.addresses.username_registry;
    poolUsernameCollision.snapshot.airdrop_pool.address = poolUsernameCollision.manifest.addresses.username_registry;
    resealToManifest(poolUsernameCollision);

    report = verifyMainnetGenesisSnapshot(poolUsernameCollision);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_GENESIS_CORE_CONTRACT_ADDRESS_COLLISION');
  });

  it('rejects funded official ATH wallets that are still uninit', () => {
    const input = finalInput();
    markOfficialWalletUninit(input, 'airdrop_pool_official_ath_wallet');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_OFFICIAL_ATH_WALLET_NOT_ACTIVE');
    expect(report.issue_codes).toContain('ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT');
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
    const changedPool = addr('changed_airdrop_pool_address');
    input.manifest.addresses.airdrop_pool = changedPool;
    input.snapshot.airdrop_pool.address = changedPool;
    input.snapshot.airdrop_pool_official_ath_wallet.owner_address = changedPool;
    input.manifest.manifest_hash_hex = staleHash;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_HASH_MISMATCH');
  });

  it('rejects a final manifest whose hash does not commit to changed code hashes', () => {
    const input = finalInput();
    input.manifest.code_hashes.airdrop_pool = hash('changed_airdrop_pool_code_hash');
    input.snapshot.airdrop_pool.code_hash = input.manifest.code_hashes.airdrop_pool;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('FINAL_MANIFEST_HASH_MISMATCH');
  });

  it('rejects a final manifest whose hash does not commit to changed StateInit hashes', () => {
    const input = finalInput();
    input.manifest.state_init_hashes!.airdrop_pool = hash('changed_airdrop_pool_state_init_hash');

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

  it('rejects final genesis when the AirdropPool distributor is not the FeeAccumulator address', () => {
    // clean-17: the pool's accrual authenticator (getter field credit_issuer_address, a clean-16 holdover name) must
    // be the FeeAccumulator address. There is no CreditIssuer contract; a wrong distributor is a fatal misroute.
    const input = finalInput();
    input.snapshot.airdrop_pool.credit_issuer_address = addr('not_the_fee_accumulator');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_DISTRIBUTOR_NOT_FEE_ACCUMULATOR');
  });

  it('rejects final genesis when AirdropPool bind flags are false', () => {
    const creditUnbound = finalInput();
    creditUnbound.snapshot.airdrop_pool.credit_issuer_bound = false;
    let report = verifyMainnetGenesisSnapshot(creditUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_CREDIT_ISSUER_NOT_BOUND');

    const treasuryUnbound = finalInput();
    treasuryUnbound.snapshot.airdrop_pool.treasury_bound = false;
    report = verifyMainnetGenesisSnapshot(treasuryUnbound);
    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_TREASURY_NOT_BOUND');
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
    input.snapshot.airdrop_pool.ath_master_address = masterchainAthMaster;
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
      airdrop_pool: addr('masterchain_airdrop_pool', -1),
      airdrop_pool_official_ath_wallet: addr('masterchain_airdrop_pool_wallet', -1),
      airdrop_pool_treasury: addr('masterchain_treasury_ath_receiver', -1),
      ath_long_term_vesting: addr('masterchain_ath_long_term_vesting', -1),
      ath_long_term_vesting_beneficiary: addr('masterchain_ath_long_term_vesting_beneficiary', -1),
      ath_long_term_vesting_official_ath_wallet: addr('masterchain_ath_long_term_vesting_wallet', -1),
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
    input.snapshot.airdrop_pool.address = addresses.airdrop_pool;
    input.snapshot.airdrop_pool.pool_ath_wallet_address = addresses.airdrop_pool_official_ath_wallet;
    input.snapshot.airdrop_pool.credit_issuer_address = addresses.fee_accumulator;
    input.snapshot.airdrop_pool.treasury_address = addresses.airdrop_pool_treasury;
    input.snapshot.airdrop_pool_official_ath_wallet.address = addresses.airdrop_pool_official_ath_wallet;
    input.snapshot.airdrop_pool_official_ath_wallet.owner_address = addresses.airdrop_pool;
    input.snapshot.ath_long_term_vesting.address = addresses.ath_long_term_vesting;
    input.snapshot.ath_long_term_vesting.beneficiary_address = addresses.ath_long_term_vesting_beneficiary;
    input.snapshot.ath_long_term_vesting.official_ath_wallet_address = addresses.ath_long_term_vesting_official_ath_wallet;
    input.snapshot.ath_long_term_vesting_official_ath_wallet.address = addresses.ath_long_term_vesting_official_ath_wallet;
    input.snapshot.ath_long_term_vesting_official_ath_wallet.owner_address = addresses.ath_long_term_vesting;
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
    expect(report.issue_codes).toContain('AIRDROP_POOL_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('AIRDROP_POOL_ADDRESS_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('AIRDROP_POOL_OFFICIAL_ATH_WALLET_NOT_BASECHAIN');
    expect(report.issue_codes).toContain('AIRDROP_POOL_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN');
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

  it('rejects a self-consistent manifest with a non-15M activity airdrop constant', () => {
    const input = finalInput();
    input.manifest.constants!.vault_activity_airdrop_total_atomic = '14000000000000000';
    input.snapshot.airdrop_pool.total_pool = '14000000000000000';
    input.snapshot.airdrop_pool.funded_amount = '14000000000000000';
    input.snapshot.airdrop_pool.remaining_budget = '14000000000000000';
    input.snapshot.airdrop_pool_official_ath_wallet.balance_atomic = '14000000000000000';
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
      ['airdrop_pool', 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_AIRDROP_POOL'],
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

  it('rejects final genesis when the official AirdropPool ATH wallet underfunds the activity airdrop allocation', () => {
    const input = finalInput();
    input.snapshot.airdrop_pool_official_ath_wallet.balance_atomic = '14999999999999999';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT');
  });

  it('rejects final genesis when the official AirdropPool ATH wallet overfunds the activity airdrop allocation', () => {
    const input = finalInput();
    input.snapshot.airdrop_pool_official_ath_wallet.balance_atomic = '15000000000000001';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT');
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

  it('rejects final genesis when the official AirdropPool ATH wallet getter snapshot is missing', () => {
    const input = finalInput() as any;
    delete input.snapshot.airdrop_pool_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('MISSING_AIRDROP_POOL_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects final genesis when the official AirdropPool ATH wallet identity does not match AirdropPool and ATHMaster', () => {
    const input = finalInput();
    input.snapshot.airdrop_pool_official_ath_wallet.owner_address = addr('wrong_airdrop_pool_owner');
    input.snapshot.airdrop_pool_official_ath_wallet.ath_master_address = addr('wrong_ath_master');

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_OFFICIAL_ATH_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('AIRDROP_POOL_OFFICIAL_ATH_WALLET_MASTER_MISMATCH');
  });

  it('rejects final genesis when AirdropPool has already distributed or claimed at genesis', () => {
    const input = finalInput();
    input.snapshot.airdrop_pool.distributed_total = '10000000000';
    input.snapshot.airdrop_pool.claim_count = '1';
    input.snapshot.airdrop_pool.remaining_budget = '14999990000000000';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('AIRDROP_POOL_DISTRIBUTED_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('AIRDROP_POOL_CLAIM_COUNT_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('AIRDROP_POOL_REMAINING_NOT_FULL_AT_GENESIS');
  });

  it('rejects a snapshot that names a release artefact as its own source', () => {
    // There is NO collector that reads mainnet and produces the verifier input — every section is typed in by hand.
    // getterSnapshotSource is the only statement that the numbers came from the chain, and it was free text the
    // verifier recorded without ever inspecting. Filling the snapshot from the manifest is the natural mistake when
    // a check keeps failing and the manifest is the document that looks authoritative; it turns the verification
    // into a comparison of the manifest against itself and reports MAINNET_GENESIS_VERIFIED.
    for (const source of [
      'artifacts/local/mainnet_final_manifest_draft.json',
      'artifacts/CURRENT_CODE_HASHES.txt#sha256=abc',
      'derived from mainnet_deploy_packet',
    ]) {
      const input = finalInput();
      input.evidenceRefs.getterSnapshotSource = source;
      const report = verifyMainnetGenesisSnapshot(input);
      expect(report.mainnet_genesis_verified, `"${source}" is not a chain read and must not verify`).toBe(false);
      expect(report.issue_codes).toContain('GETTER_SNAPSHOT_SOURCE_IS_NOT_A_CHAIN_READ');
    }

    // And the honest case still passes, or the check would just be a second way to block every genesis.
    const good = finalInput();
    good.evidenceRefs.getterSnapshotSource = 'live-rpc/platho-toncenter/2026-07-31T00:00:00.000Z';
    expect(verifyMainnetGenesisSnapshot(good).issue_codes)
      .not.toContain('GETTER_SNAPSHOT_SOURCE_IS_NOT_A_CHAIN_READ');
  });

  it('rejects final genesis when the username art or collection metadata was never locked', () => {
    // Calibration, not decoration. Adding art_sealed/meta_sealed to the happy-path fixture would make the two new
    // assertions pass without ever proving they can fail — which is exactly how this repo has shipped guards aimed
    // at nothing three times. Each flag is knocked out on its own so neither can hide behind the other.
    for (const flag of ['art_sealed', 'meta_sealed'] as const) {
      const input = finalInput();
      (input.snapshot.username_registry as any)[flag] = false;
      const report = verifyMainnetGenesisSnapshot(input);
      expect(report.mainnet_genesis_verified, `a genesis with ${flag} = false must NOT verify: the genesis `
        + 'controller keeps permanent write authority over the collection until both locks are set').toBe(false);
    }
  });

  it('rejects final genesis when registries or FeeAccumulator already hold records or due buckets', () => {
    const input = finalInput();
    input.snapshot.username_registry.pending_mint_count = '1';
    input.snapshot.username_registry.treasury_due_ath = '1';
    input.snapshot.username_registry.burn_due_ath = '1';
    input.snapshot.username_registry.pending_treasury_flush_count = '1';
    input.snapshot.username_registry.pending_burn_flush_count = '1';
    input.snapshot.profile_registry.profile_count = '1';
    input.snapshot.profile_registry.pending_avatar_write_count = '1';
    input.snapshot.profile_registry.treasury_due_ath = '1';
    input.snapshot.profile_registry.burn_due_ath = '1';
    input.snapshot.profile_registry.pending_treasury_flush_count = '1';
    input.snapshot.profile_registry.pending_burn_flush_count = '1';
    input.snapshot.fee_accumulator.accumulated_ton = '1';
    input.snapshot.fee_accumulator.treasury_due_ton = '1';
    input.snapshot.fee_accumulator.buyback_due_ton = '1';

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.mainnet_genesis_verified).toBe(false);
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_PENDING_MINTS_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_TREASURY_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('USERNAME_REGISTRY_BURN_DUE_NOT_ZERO_AT_GENESIS');
    expect(report.issue_codes).toContain('PROFILE_REGISTRY_PENDING_AVATAR_WRITES_NOT_ZERO_AT_GENESIS');
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
      ['airdrop_pool', 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_AIRDROP_POOL'],
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
      'airdrop_pool',
      'ath_master',
      'buyback_burn',
      'market_stability_seller',
      'username_registry',
      'profile_registry',
      'ath_long_term_vesting',
      'airdrop_pool_official_ath_wallet',
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
    // clean-17 flips this: frozen is the HEALTHY state, so the negative case is a seller reporting NOT frozen.
    input.snapshot.market_stability_seller.pricing_frozen = false;
    // [CUTOVER 2026-08-02] Also flipped: zero is now the healthy state, so the unhealthy case is a seller that STILL
    // carries a controller hash after the seal — i.e. a controller that was never revoked.
    input.snapshot.market_stability_seller.genesis_config_hash = addressHashHex(input.manifest.addresses.market_stability_seller_initial_genesis_controller);
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
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_PRICING_NOT_FROZEN_AT_GENESIS');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SELLER_CONTROLLER_NOT_REVOKED');
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

  // [REWRITTEN 2026-08-02] This used to assert that a retained launch-controller hash must MATCH the manifest address,
  // which was the clean-15 model: the price was stored state, a controller set it once the pool existed, and the hash
  // was how you knew which key still held that right. clean-17 made the price a compile-time constant and made the seal
  // ZERO this field, so there is no legitimate holder left — and "matching" buys nothing.
  //
  // Kept as a test rather than deleted, because the property it guards got STRONGER and a deleted test would have left
  // the strongest of the five revocations unasserted. Both cases are checked, precisely because the matching one is the
  // tempting exception: a snapshot carrying the RIGHT controller's hash still means that controller was never revoked.
  it('rejects final genesis when MarketStabilitySeller retained ANY launch controller hash, matching or not', () => {
    for (const which of ['the manifest controller', 'some other key'] as const) {
      const input = finalInput();
      input.snapshot.market_stability_seller.genesis_config_hash = which === 'the manifest controller'
        ? addressHashHex(input.manifest.addresses.market_stability_seller_initial_genesis_controller)
        : hash('wrong_market_stability_launch_controller');
      const label = which;

      const report = verifyMainnetGenesisSnapshot(input);

      expect(report.mainnet_genesis_verified, label).toBe(false);
      expect(report.issue_codes, label).toContain('MARKET_STABILITY_SELLER_CONTROLLER_NOT_REVOKED');
    }
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

  // MEASURED 2026-07-28 while rebaselining onto clean-17: feeding this verifier a snapshot from an older generation
  // did not produce a report at all — it threw `Cannot read properties of undefined (reading 'address')` and wrote
  // nothing. On ceremony day that is a stack trace instead of the name of the missing contract, at the exact moment
  // the tool exists to be trusted, holding a snapshot that is expensive to re-take.
  //
  // Nine sections already had dedicated MISSING_*_SNAPSHOT codes (asserted by the tests above); these six primary
  // contracts never got them, which is precisely why they threw.
  for (const section of ['ath_master', 'airdrop_pool', 'fee_accumulator', 'buyback_burn', 'username_registry', 'profile_registry']) {
    it(`reports a named issue instead of throwing when snapshot.${section} is absent`, () => {
      const input = finalInput() as any;
      delete input.snapshot[section];

      // The throw is the actual regression under test: assert it does not happen before looking at the report.
      let report!: ReturnType<typeof verifyMainnetGenesisSnapshot>;
      expect(() => { report = verifyMainnetGenesisSnapshot(input); }, `snapshot.${section} must not crash the verifier`).not.toThrow();

      expect(report.mainnet_genesis_verified).toBe(false);
      expect(report.status, 'an incomplete snapshot is not the same failure as a chain/manifest mismatch')
        .toBe('BLOCKED_SNAPSHOT_INCOMPLETE');
      expect(report.issue_codes).toContain(`SNAPSHOT_SECTION_MISSING_${section.toUpperCase()}`);
    });
  }

  it('still gives the precise MISSING_*_SNAPSHOT diagnosis for sections that have their own code', () => {
    // Guard against the gate above swallowing the finer-grained codes: an official ATHWallet has its own issue and
    // must keep reporting it, with the full run of checks (not an early return).
    const input = finalInput() as any;
    delete input.snapshot.airdrop_pool_official_ath_wallet;

    const report = verifyMainnetGenesisSnapshot(input);

    expect(report.issue_codes).toContain('MISSING_AIRDROP_POOL_OFFICIAL_ATH_WALLET_SNAPSHOT');
    expect(report.issue_codes).not.toContain('SNAPSHOT_SECTION_MISSING_AIRDROP_POOL_OFFICIAL_ATH_WALLET');
    expect(report.status).toBe('BLOCKED_GENESIS_MISMATCH');
  });
});
