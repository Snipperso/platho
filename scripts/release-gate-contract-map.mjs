// THE ONE COPY. Previously there were two: scripts/preprod_guard.mjs and tests/release-truth-single-source.test.ts
// each declared all six of these constants, and the gate is the thing the test is supposed to be checking.
//
// They had already drifted, in the direction that matters: the test's manifest map listed all fourteen code hashes
// the manifest carries, the gate's listed nine. So the test knew about record_shard, intro_shard, public_shard,
// airdrop_pool and airdrop_ticket, and the LAST PRODUCTION GATE did not compare a single one of them — while the
// suite stayed green, because the test was reading its own correct copy. A guard and its test agreeing is worth
// nothing when they agree about different things.
//
// Anything both files need lives here now. Adding a contract means editing one list, and the tests below the
// exports check that the lists still cover what the packets actually contain, so an omission cannot stay quiet.

/** Every code hash the genesis MANIFEST carries, mapped to its CURRENT_CODE_HASHES.txt key. */
export const CURRENT_CODE_HASH_TO_MANIFEST_KEY = Object.freeze({
  ATHMASTER_CODE_HASH: 'ath_master',
  ATHVESTING_CODE_HASH: 'ath_vesting',
  ATH_WALLET_CODE_HASH: 'ath_wallet',
  BUYBACKBURN_CODE_HASH: 'buyback_burn',
  MARKET_STABILITY_SELLER_CODE_HASH: 'market_stability_seller',
  FEEACCUMULATOR_CODE_HASH: 'fee_accumulator',
  PROFILE_REGISTRY_CODE_HASH: 'profile_registry',
  USERNAME_NFT_ITEM_CODE_HASH: 'username_nft_item',
  USERNAME_REGISTRY_CODE_HASH: 'username_registry',
  AIRDROP_POOL_CODE_HASH: 'airdrop_pool',
  RECORD_SHARD_CODE_HASH: 'record_shard',
  INTRO_SHARD_CODE_HASH: 'intro_shard',
  PUBLIC_SHARD_CODE_HASH: 'public_shard',
  AIRDROP_TICKET_CODE_HASH: 'airdrop_ticket',
});

/**
 * Production-critical, with NO manifest counterpart — and that absence is correct, not an omission. The ceremony
 * binds a shard's code hash only where the fee passthrough must authenticate the depositor; RecoveryShard takes no
 * protocol fee and KeyShard is paid registration, so neither is ever sent on chain at genesis. They still belong to
 * the production hash file: every recovery slot address derives from one and every wallet's identity address from
 * the other, so a silent change to either moves addresses the network has already published. Nothing on chain
 * pins them — tests/shard-code-hash-freeze.test.ts is the only thing that does.
 */
export const PRODUCTION_ONLY_CODE_HASH_KEYS = Object.freeze(['RECOVERY_SHARD_CODE_HASH', 'KEY_SHARD_CODE_HASH']);

export const PRODUCTION_CODE_HASH_KEYS = Object.freeze(
  [...Object.keys(CURRENT_CODE_HASH_TO_MANIFEST_KEY), ...PRODUCTION_ONLY_CODE_HASH_KEYS].sort(),
);

export const CONTRACT_TO_CURRENT_CODE_HASH_KEY = Object.freeze({
  ATHMaster: 'ATHMASTER_CODE_HASH',
  ATHVesting: 'ATHVESTING_CODE_HASH',
  BuybackBurn: 'BUYBACKBURN_CODE_HASH',
  MarketStabilitySeller: 'MARKET_STABILITY_SELLER_CODE_HASH',
  FeeAccumulator: 'FEEACCUMULATOR_CODE_HASH',
  ProfileRegistry: 'PROFILE_REGISTRY_CODE_HASH',
  UsernameNFTItem: 'USERNAME_NFT_ITEM_CODE_HASH',
  UsernameRegistry: 'USERNAME_REGISTRY_CODE_HASH',
  // [ADDED 2026-07-31] AirdropPool was missing from both copies of this map AND from the deploy-action map below,
  // and the gate's loop skipped unmapped steps with a bare `continue`. So D07 'Deploy AirdropPool' — the contract
  // holding the entire 15M ATH airdrop — had its packet code hash compared against nothing, silently, on the last
  // check before a production deploy.
  AirdropPool: 'AIRDROP_POOL_CODE_HASH',
});

export const DEPLOY_ACTION_TO_CONTRACT = Object.freeze({
  'Deploy ATHMaster': 'ATHMaster',
  'Deploy ATHVesting': 'ATHVesting',
  'Deploy BuybackBurn': 'BuybackBurn',
  'Deploy MarketStabilitySeller': 'MarketStabilitySeller',
  'Deploy FeeAccumulator': 'FeeAccumulator',
  'Deploy ProfileRegistry': 'ProfileRegistry',
  'Deploy UsernameRegistry': 'UsernameRegistry',
  'Deploy AirdropPool': 'AirdropPool',
});

export const POST_POOL_COMMANDS = Object.freeze([
  'npm.cmd run m20f:collect',
  'npm.cmd run m20f:preflight',
  'npm.cmd run market-stability:readiness',
  'npm.cmd run buyback:enable-preflight',
]);

export const TEST_DEPLOY_TARGET_RE = /(?:Mock|Harness|M20T)/i;
