import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPacket } from '../scripts/mainnet_deploy_packet';

const ADDR = {
  treasuryOwner: 'UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH',
  launchController: 'UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH',
  treasuryReceiver: 'UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH',
  treasuryOwnerAthWallet: 'UQDa464U-R8o-bT-Y1-2F6JBfxZCEOJclTILQxF8GHejQ1cH',
  athMaster: 'UQBYtK4_sxTw2Z7bp8DuzQ2Nz09MWU7nmcHmPzovsUN9v087',
  athVesting: 'UQAbfE3debZWi3faHF-Q7719DHoMnzcGf98Cuv1ALQTg4Gbe',
  athVestingOfficialWallet: 'UQC_1J_BvjkNfqq9ak__izFrJ46fuAbRL5UThDbCzwyzboyK',
  buybackBurn: 'UQCxdVsQEDq6GjO1UZzkcnyBBmmLTcpfXaDYe0zOQ71bW0rO',
  marketSeller: 'UQD5hmzricQbtTKG6iJrGLpZzOoVQRuBB3K0HLKHkxuKFW4a',
  marketReserveFunder: 'UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH',
  marketTonTreasury: 'UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH',
  feeAccumulator: 'UQA9tgsJkoJsPEmxOyN0CWti9IYo8gAl2VQDECLRfDFGicpD',
  airdropPool: 'UQDjCu9J-a50z8pwgBp9AWpuD9MDQufKiKHPi-1VHRWpQbvc',
  airdropPoolOfficialWallet: 'UQCUSL4Ml8O1gnrl-F5e1E3OHigm3IywXKiBnWkCUuIf4Qb9',
  usernameRegistry: 'UQBT1BIkKWCHrqL6tXKw5aUMXJjFbDNrcEVzpzCRxJ8Cf3ls',
  profileRegistry: 'UQC4ncVFmD7s4xX7Q-lsjE9hyvaOrtXlNfi_Gha97NDQwUN0',
  profileRegistryTreasuryReceiver: 'UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH',
  buybackOfficialWallet: 'UQAp331ZUTmj9kFEOckbU2YkZjPpUv0U6I0F59Loo8Utdwg8',
  marketOfficialWallet: 'UQDIjPvQFNLo8VhTp1rSKte9HcF-YmXOi-Xr_cPay6Nk1Ao7',
  usernameOfficialWallet: 'UQDc-CD3Q8FXkG3H1cxzj7PXXA-sffIgy1y4HQb3qVgptygr',
  profileOfficialWallet: 'UQDpfrnMRATDMhAR5oYZnaXemELmZFgUMjHpof-YvkyV0NC9',
};

function fakeHash(seed: string): string {
  return seed.padEnd(64, '0').slice(0, 64);
}

const TEST_DEPLOY_TARGET_RE = /(?:Mock|Harness|M20T)/i;

function draft() {
  const addresses = {
    ath_master: ADDR.athMaster,
    treasury_ath_receiver: ADDR.treasuryReceiver,
    ath_long_term_vesting: ADDR.athVesting,
    buyback_burn: ADDR.buybackBurn,
    market_stability_seller: ADDR.marketSeller,
    market_stability_reserve_funder: ADDR.marketReserveFunder,
    market_stability_ton_treasury_receiver: ADDR.marketTonTreasury,
    fee_accumulator: ADDR.feeAccumulator,
    fee_accumulator_ton_treasury_receiver: ADDR.treasuryReceiver,
    airdrop_pool: ADDR.airdropPool,
    airdrop_pool_official_ath_wallet: ADDR.airdropPoolOfficialWallet,
    username_registry: ADDR.usernameRegistry,
    profile_registry: ADDR.profileRegistry,
    profile_registry_treasury_ath_receiver: ADDR.profileRegistryTreasuryReceiver,
    buyback_burn_official_ath_wallet: ADDR.buybackOfficialWallet,
    market_stability_seller_official_ath_wallet: ADDR.marketOfficialWallet,
    username_registry_official_ath_wallet: ADDR.usernameOfficialWallet,
    profile_registry_official_ath_wallet: ADDR.profileOfficialWallet,
    ath_long_term_vesting_official_ath_wallet: ADDR.athVestingOfficialWallet,
  };
  const code_hashes = Object.fromEntries([
    'ath_master',
    'buyback_burn',
    'market_stability_seller',
    'fee_accumulator',
    'ath_vesting',
    'airdrop_pool',
    'username_registry',
    'profile_registry',
  ].map((key, index) => [key, fakeHash(`${index + 1}`)]));
  const state_init_hashes = Object.fromEntries([
    'ath_master',
    'buyback_burn_initial',
    'market_stability_seller_initial',
    'fee_accumulator',
    'ath_long_term_vesting_initial',
    'airdrop_pool_initial',
    'username_registry_initial',
    'profile_registry_initial',
  ].map((key, index) => [key, fakeHash(`${index + 11}`)]));
  const initialStateKeyByContract: Record<string, string> = {
    ath_master: 'ath_master',
    ath_long_term_vesting: 'ath_long_term_vesting_initial',
    buyback_burn: 'buyback_burn_initial',
    market_stability_seller: 'market_stability_seller_initial',
    fee_accumulator: 'fee_accumulator',
    airdrop_pool: 'airdrop_pool_initial',
    username_registry: 'username_registry_initial',
    profile_registry: 'profile_registry_initial',
  };

  return {
    document: 'PLATHO.V1.MAINNET_FINAL_MANIFEST_DRAFT',
    generated_at: '2026-05-27T00:00:00.000Z',
    production_deploy_executed: false,
    manifest: {
      manifest_hash_hex: fakeHash('a'),
      addresses,
      code_hashes,
      state_init_hashes,
      constants: {
        vault_activity_airdrop_total_atomic: '15000000000000000',
        ath_long_term_vesting_allocation_atomic: '10000000000000000',
      },
    },
    role_summary: {
      ath_treasury_owner: { label: 'Treasury Owner', normalized_address: ADDR.treasuryOwner },
      genesis_controller_one_shot: { label: 'Launch Controller', normalized_address: ADDR.launchController },
      ton_treasury_receiver: { label: 'Treasury Receiver', normalized_address: ADDR.treasuryReceiver },
      ath_long_term_vesting_beneficiary: { label: 'Treasury Receiver', normalized_address: ADDR.treasuryReceiver },
    },
    initial_state_init: Object.fromEntries(Object.entries(addresses)
      .filter(([key]) => ['ath_master', 'ath_long_term_vesting', 'buyback_burn', 'market_stability_seller', 'fee_accumulator', 'airdrop_pool', 'username_registry', 'profile_registry'].includes(key))
      .map(([key, address]) => [key, { address, raw_address: `0:${key}`, state_init_hash: state_init_hashes[initialStateKeyByContract[key]] }])),
    official_ath_wallets: {
      airdrop_pool_official_ath_wallet: ADDR.airdropPoolOfficialWallet,
      ath_long_term_vesting_official_ath_wallet: ADDR.athVestingOfficialWallet,
    },
    derived_ath_wallets: {
      treasury_owner_ath_wallet: {
        address: ADDR.treasuryOwnerAthWallet,
        owner_address: ADDR.treasuryOwner,
        ath_master_address: ADDR.athMaster,
        state_init_hash: fakeHash('treasury'),
        note: 'dry run',
      },
    },
    funding_checklist: [],
    pre_seal_bindings: [
      ['BuybackBurn.BindBuybackFeeAccumulator', ADDR.feeAccumulator],
      ['BuybackBurn.BindBuybackOfficialAthWallet', ADDR.buybackOfficialWallet],
      ['MarketStabilitySeller.BindMarketStabilityReserveFunder', ADDR.marketReserveFunder],
      ['MarketStabilitySeller.BindMarketStabilityOfficialAthWallet', ADDR.marketOfficialWallet],
      ['MarketStabilitySeller.BindMarketStabilityTreasury', ADDR.marketTonTreasury],
      ['AirdropPool.AirdropBindAthMaster.ath_master_address', ADDR.athMaster],
      ['AirdropPool.AirdropBindAthMaster.pool_ath_wallet_address', ADDR.airdropPoolOfficialWallet],
      ['AirdropPool.AirdropBindCreditIssuer.credit_issuer_address', ADDR.feeAccumulator],
      ['AirdropPool.AirdropBindTreasury.treasury_address', ADDR.treasuryReceiver],
      ['FeeAccumulator.BindAirdropPool.airdrop_pool_address', ADDR.airdropPool],
      ['UsernameRegistry.BindOfficialAthWallet', ADDR.usernameOfficialWallet],
      ['ProfileRegistry.BindProfileOfficialAthWallet', ADDR.profileOfficialWallet],
    ],
  } as any;
}

describe('mainnet deploy packet funding semantics', () => {
  it('H-DEP-LIFECYCLE-01: deploy packet is explicitly a pre-execution template and deploys production targets only', () => {
    const packet = buildPacket(draft());
    const deployedTargets = packet.phase_1_deploy_contracts.map((step: any) => [
      step.id,
      step.action,
      step.contract,
      step.message,
      step.target_is,
    ].filter(Boolean).join(' '));

    expect(packet.production_deploy_executed).toBe(false);
    expect(packet.lifecycle_stage).toBe('pre_execution_deploy_packet_template');
    expect(packet.lifecycle_note).toMatch(/pre-execution template/);
    expect(packet.lifecycle_note).toMatch(/mainnet_genesis_verify_report\.json/);
    expect(deployedTargets).not.toEqual(expect.arrayContaining([expect.stringMatching(TEST_DEPLOY_TARGET_RE)]));
  });

  it('H-DEP-FUND-01: funding steps target the Treasury Owner ATHWallet and keep official wallets as expected balance wallets only', () => {
    const packet = buildPacket(draft());
    const funding = packet.phase_3_pre_seal_funding;

    expect(funding).toHaveLength(2);
    expect(funding[0]).toMatchObject({
      id: 'F01',
      target_address: ADDR.treasuryOwnerAthWallet,
      target_is: 'Treasury Owner ATHWallet',
      recipient_owner_address: ADDR.airdropPool,
      expected_recipient_ath_wallet: ADDR.airdropPoolOfficialWallet,
      amount_atomic: '15000000000000000',
    });
    expect(funding[1]).toMatchObject({
      id: 'F02',
      target_address: ADDR.treasuryOwnerAthWallet,
      target_is: 'Treasury Owner ATHWallet',
      recipient_owner_address: ADDR.athVesting,
      expected_recipient_ath_wallet: ADDR.athVestingOfficialWallet,
      amount_atomic: '10000000000000000',
    });

    for (const step of funding) {
      expect(step).not.toHaveProperty('recipient');
      expect(step.warning).toMatch(/Do not send directly to the official ATH wallet address/);
      expect(step.target_address).not.toBe(step.expected_recipient_ath_wallet);
    }

    expect(packet.phase_4_seal_contracts.map((step: any) => step.message)).toEqual([
      'AirdropPool.AirdropSealGenesis',
      'UsernameRegistry.SealGenesis',
      'ProfileRegistry.SealGenesis',
      'BuybackBurn.SealBuybackBurnGenesis',
      'MarketStabilitySeller.SealMarketStabilityGenesis',
    ]);
  });

  it('H-DEP-BIND-01: deploy packet carries AirdropPool/registry bindings before seal', () => {
    const source = draft();

    const packet = buildPacket(source);
    expect(packet.phase_2_pre_seal_bindings.map((step: any) => [step.message, step.value])).toEqual([
      ['BuybackBurn.BindBuybackFeeAccumulator', ADDR.feeAccumulator],
      ['BuybackBurn.BindBuybackOfficialAthWallet', ADDR.buybackOfficialWallet],
      ['MarketStabilitySeller.BindMarketStabilityReserveFunder', ADDR.marketReserveFunder],
      ['MarketStabilitySeller.BindMarketStabilityOfficialAthWallet', ADDR.marketOfficialWallet],
      ['MarketStabilitySeller.BindMarketStabilityTreasury', ADDR.marketTonTreasury],
      ['AirdropPool.AirdropBindAthMaster.ath_master_address', ADDR.athMaster],
      ['AirdropPool.AirdropBindAthMaster.pool_ath_wallet_address', ADDR.airdropPoolOfficialWallet],
      ['AirdropPool.AirdropBindCreditIssuer.credit_issuer_address', ADDR.feeAccumulator],
      ['AirdropPool.AirdropBindTreasury.treasury_address', ADDR.treasuryReceiver],
      ['FeeAccumulator.BindAirdropPool.airdrop_pool_address', ADDR.airdropPool],
      ['UsernameRegistry.BindOfficialAthWallet', ADDR.usernameOfficialWallet],
      ['ProfileRegistry.BindProfileOfficialAthWallet', ADDR.profileOfficialWallet],
    ]);
  });

  it('RT-MSTAB-005: deploy packet keeps official MarketStabilitySeller buy tooling gated by readiness', () => {
    const packet = buildPacket(draft());

    expect(packet.post_genesis_not_in_this_packet).toContain(
      'Keep official MarketStabilitySeller buy tooling disabled until MARKET_STABILITY_SELLER_READY.txt is true.',
    );
    expect(packet.post_genesis_not_in_this_packet.indexOf('Run market_stability_seller_readiness.')).toBeLessThan(
      packet.post_genesis_not_in_this_packet.indexOf('Keep official MarketStabilitySeller buy tooling disabled until MARKET_STABILITY_SELLER_READY.txt is true.'),
    );
  });

  it('H-DEP-BIND-02: deploy packet refuses missing, duplicate, unknown, or mismatched pre-seal bindings', () => {
    const missing = draft();
    missing.pre_seal_bindings = missing.pre_seal_bindings.filter(([message]: [string, string]) => message !== 'FeeAccumulator.BindAirdropPool.airdrop_pool_address');
    expect(() => buildPacket(missing)).toThrow(/Missing required pre-seal binding FeeAccumulator\.BindAirdropPool\.airdrop_pool_address/);

    const duplicate = draft();
    duplicate.pre_seal_bindings.push(['AirdropPool.AirdropBindTreasury.treasury_address', ADDR.treasuryReceiver]);
    expect(() => buildPacket(duplicate)).toThrow(/Duplicate pre-seal binding AirdropPool\.AirdropBindTreasury\.treasury_address/);

    const unknown = draft();
    unknown.pre_seal_bindings.push(['AirdropPool.BindSurprise', ADDR.profileRegistry]);
    expect(() => buildPacket(unknown)).toThrow(/Unexpected pre-seal binding AirdropPool\.BindSurprise/);

    const mismatched = draft();
    mismatched.pre_seal_bindings = mismatched.pre_seal_bindings.map(([message, value]: [string, string]) => (
      message === 'ProfileRegistry.BindProfileOfficialAthWallet' ? [message, ADDR.profileRegistry] : [message, value]
    ));
    expect(() => buildPacket(mismatched)).toThrow(/ProfileRegistry\.BindProfileOfficialAthWallet target mismatch/);
  });

  it('H-DEP-STATE-01: deploy packet refuses stale or mismatched initial StateInit evidence', () => {
    const wrongAddress = draft();
    wrongAddress.initial_state_init.airdrop_pool.address = ADDR.usernameRegistry;
    expect(() => buildPacket(wrongAddress)).toThrow(/Initial StateInit airdrop_pool address mismatch/);

    const wrongHash = draft();
    wrongHash.initial_state_init.airdrop_pool.state_init_hash = fakeHash('55');
    expect(() => buildPacket(wrongHash)).toThrow(/Initial StateInit airdrop_pool hash mismatch/);

    for (const entryKey of [
      'buyback_burn',
      'market_stability_seller',
      'airdrop_pool',
      'username_registry',
      'profile_registry',
    ]) {
      const sealedInitialState = draft();
      sealedInitialState.initial_state_init[entryKey].sealed = true;
      expect(() => buildPacket(sealedInitialState)).toThrow(new RegExp(`${entryKey} must be unsealed`));
    }

    // AirdropPool must deploy fully unbound (ath_master/credit_issuer/treasury) — the generic _bound scan catches it.
    const preboundAirdropPool = draft();
    preboundAirdropPool.initial_state_init.airdrop_pool.ath_master_bound = true;
    expect(() => buildPacket(preboundAirdropPool)).toThrow(/airdrop_pool must start unbound/);

    const nonzeroManifestAirdropPool = draft();
    nonzeroManifestAirdropPool.initial_state_init.airdrop_pool.deployment_manifest_hash = '0x1234';
    expect(() => buildPacket(nonzeroManifestAirdropPool)).toThrow(/airdrop_pool must not carry deployment_manifest_hash/);
  });

  it('H-DEP-ROLE-01: deploy packet refuses a collapsed AirdropPool/Profile/Username role graph', () => {
    const source = draft();
    source.manifest.addresses.profile_registry = ADDR.usernameRegistry;
    source.initial_state_init.profile_registry.address = ADDR.usernameRegistry;

    expect(() => buildPacket(source)).toThrow(/Manifest core role address collision: profile_registry and username_registry/);
  });

  it('H-DEP-ROLE-02: deploy packet refuses protocol-owned ProfileRegistry treasury receivers', () => {
    for (const forbiddenKey of ['profile_registry', 'profile_registry_official_ath_wallet', 'airdrop_pool', 'ath_master']) {
      const source = draft();
      source.manifest.addresses.profile_registry_treasury_ath_receiver = source.manifest.addresses[forbiddenKey];

      expect(() => buildPacket(source)).toThrow(new RegExp(`ProfileRegistry treasury receiver must not equal ${forbiddenKey}`));
    }
  });

  it('H-DEP-ROLE-03: deploy packet refuses protocol-owned UsernameRegistry treasury receivers', () => {
    for (const forbiddenKey of ['username_registry', 'username_registry_official_ath_wallet', 'airdrop_pool', 'ath_master']) {
      const source = draft();
      source.manifest.addresses.treasury_ath_receiver = source.manifest.addresses[forbiddenKey];

      expect(() => buildPacket(source)).toThrow(new RegExp(`UsernameRegistry treasury receiver must not equal ${forbiddenKey}`));
    }
  });

  it('H-DEP-ROLE-04: deploy packet refuses protocol-owned TON treasury receivers', () => {
    const feeSource = draft();
    feeSource.manifest.addresses.fee_accumulator_ton_treasury_receiver = feeSource.manifest.addresses.fee_accumulator;
    expect(() => buildPacket(feeSource)).toThrow(/FeeAccumulator TON treasury receiver must not equal protocol role fee_accumulator/);

    const marketSource = draft();
    marketSource.manifest.addresses.market_stability_ton_treasury_receiver = marketSource.manifest.addresses.market_stability_seller;
    expect(() => buildPacket(marketSource)).toThrow(/MarketStabilitySeller TON treasury receiver must not equal protocol role market_stability_seller/);
  });

  it('H-DEP-ROLE-05: deploy packet refuses protocol-owned MarketStabilitySeller reserve funder', () => {
    const source = draft();
    source.manifest.addresses.market_stability_reserve_funder = source.manifest.addresses.market_stability_seller;

    expect(() => buildPacket(source)).toThrow(/MarketStabilitySeller reserve funder must not equal protocol role market_stability_seller/);
  });

  // The genesis ceremony is executed ONCE, by hand, by a human reading DEPLOYMENT_RUNBOOK.md. Nothing forced
  // that prose to agree with the code, so removing a bind message left the runbook still ordering an operator
  // to send a message the contract no longer has — caught only by review. This closes the loop in BOTH
  // directions: a binding in the code but missing from the runbook is a step the operator would skip, and a
  // binding in the runbook but missing from the code is a message that no longer exists.
  it('H-DEP-BIND-03: the runbook lists exactly the pre-seal bindings the packet builder requires', () => {
    const runbook = readFileSync('DEPLOYMENT_RUNBOOK.md', 'utf8');
    const step = runbook.slice(
      runbook.indexOf('7. Perform pre-seal bindings by'),
      runbook.indexOf('8. Fund the genesis-backed official ATH wallets'),
    );
    expect(step, 'step 7 of the runbook must be findable').not.toBe('');

    // clean-17: bindings include dotless-after-contract names like AirdropPool.AirdropBindAthMaster.* — the old
    // /Word\.Bind.../ pattern (dot immediately before Bind) missed those. Match any backtick token containing Bind.
    const documented = [...step.matchAll(/`([A-Za-z.]*Bind[A-Za-z._]*)`/g)].map((m) => m[1]).sort();
    // buildPacket already rejects a draft whose bindings are missing or unexpected, so a draft that builds
    // carries exactly the required set — which makes it a sound reference for the runbook.
    const required = buildPacket(draft()).phase_2_pre_seal_bindings.map((s: any) => s.message).sort();

    expect(documented, 'runbook step 7 vs. the required pre-seal binding set').toEqual(required);
  });
});
