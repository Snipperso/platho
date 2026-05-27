import { describe, expect, it } from 'vitest';
import { buildPacket } from '../scripts/mainnet_deploy_packet';

const ADDR = {
  treasuryOwner: 'UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH',
  launchController: 'UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH',
  treasuryReceiver: 'UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH',
  treasuryOwnerAthWallet: 'UQBWNqV5jW7yLfZe-UIEgFwxeceYXKlR1SYWaE_ZPGimuCZs',
  athMaster: 'UQBM60Qzy7C7QhsD2xDWovXQ3vKW1338plaZgduLNT0styiF',
  athVesting: 'UQCWYmdIW6uLsD8X7A11UJAzPkOzFyWtxw_LDd53WJbOIRp4',
  athVestingOfficialWallet: 'UQDC2ZPTw0_N2W1RW3Td3i2-VIhMDezPHogBjnJoH_79PvkA',
  buybackBurn: 'UQDQKam_McC8nu3qXb8xo59r6gp-grrPNrZhtQdwBhTQdsh0',
  marketSeller: 'UQDvf0Jefu2NaUhrvhifL3fQl59TgCLY88PpwmqbbsTyEesq',
  feeAccumulator: 'UQDe0MA_HBkPCo7niVC2X2EI39brI-XLoYm9B0DvtKd4H8PR',
  vault: 'UQDt623mcqYrdedu-XUwQhzKETjKjGQNUFRJxlV6HczZMJ2Q',
  vaultOfficialWallet: 'UQCJ3BTCIDsXfj4bA4lDdP9lGFZrgerVDdD6NKFvpc5-_miu',
  capsuleHub: 'UQDwLp11cZBG5KOyPv_ELmkeH-MTkrWJH0Y0xeYyadKO_MXg',
  usernameRegistry: 'UQAfrcDdQqSu0U2MIaQz30SH8pebJcRC6nnmSQDrPI0q05F4',
  profileRegistry: 'UQCB1BKwEpHa2RSTdHVIGQGYvYC4JNEfHJfdVmJOR3rmAHw7',
  buybackOfficialWallet: 'UQCd1li35LbfoFGbmte4SmtoSlDov_-lJ7SKtSCvXPd9BhBO',
  marketOfficialWallet: 'UQCxGV2UfZtEJp0E3WBF0HtltXM0q9StdfdbaUsqxna5ftne',
  usernameOfficialWallet: 'UQDBBswovfE46VHUSNHn4JzAcVHqo45pXdpIBKdNEICUAyR3',
  profileOfficialWallet: 'UQBgu5Hr303jxkSVnS4OtSJZ_45cCs2H2Bojl_x6wR3USeK-',
};

function fakeHash(seed: string): string {
  return seed.padEnd(64, '0').slice(0, 64);
}

function draft() {
  const addresses = {
    ath_master: ADDR.athMaster,
    ath_long_term_vesting: ADDR.athVesting,
    buyback_burn: ADDR.buybackBurn,
    market_stability_seller: ADDR.marketSeller,
    fee_accumulator: ADDR.feeAccumulator,
    vault: ADDR.vault,
    vault_official_ath_wallet: ADDR.vaultOfficialWallet,
    capsulehub: ADDR.capsuleHub,
    username_registry: ADDR.usernameRegistry,
    profile_registry: ADDR.profileRegistry,
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
    'vault',
    'capsulehub',
    'username_registry',
    'profile_registry',
  ].map((key, index) => [key, fakeHash(`${index + 1}`)]));
  const state_init_hashes = Object.fromEntries([
    'ath_master',
    'buyback_burn_initial',
    'market_stability_seller_initial',
    'fee_accumulator',
    'ath_long_term_vesting_initial',
    'vault_initial',
    'capsulehub_initial',
    'username_registry_initial',
    'profile_registry_initial',
  ].map((key, index) => [key, fakeHash(`${index + 11}`)]));

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
      .filter(([key]) => ['ath_master', 'ath_long_term_vesting', 'buyback_burn', 'market_stability_seller', 'fee_accumulator', 'vault', 'capsulehub', 'username_registry', 'profile_registry'].includes(key))
      .map(([key, address]) => [key, { address, raw_address: `0:${key}`, state_init_hash: fakeHash(key) }])),
    official_ath_wallets: {
      vault_official_ath_wallet: ADDR.vaultOfficialWallet,
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
    pre_seal_bindings: [],
  } as any;
}

describe('mainnet deploy packet funding semantics', () => {
  it('H-DEP-FUND-01: funding steps target the Treasury Owner ATHWallet and keep official wallets as expected balance wallets only', () => {
    const packet = buildPacket(draft());
    const funding = packet.phase_4_final_genesis_funding;

    expect(funding).toHaveLength(2);
    expect(funding[0]).toMatchObject({
      id: 'F01',
      target_address: ADDR.treasuryOwnerAthWallet,
      target_is: 'Treasury Owner ATHWallet',
      recipient_owner_address: ADDR.vault,
      expected_recipient_ath_wallet: ADDR.vaultOfficialWallet,
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
  });
});
