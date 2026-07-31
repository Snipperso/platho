import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import { bindMessageKey, bindStepId } from './ceremony_bind_order';

type Draft = {
  document: string;
  generated_at: string;
  production_deploy_executed: boolean;
  manifest: {
    manifest_hash_hex: string;
    addresses: Record<string, string>;
    code_hashes: Record<string, string>;
    state_init_hashes: Record<string, string>;
    constants: Record<string, string>;
  };
  role_summary: Record<string, { label: string; normalized_address: string }>;
  initial_state_init: Record<string, {
    address: string;
    raw_address: string;
    state_init_hash: string;
    sealed?: boolean;
    deployment_manifest_hash?: unknown;
    binding_flags?: unknown;
    [key: string]: unknown;
  }>;
  official_ath_wallets: Record<string, string>;
  derived_ath_wallets: Record<string, { address: string; owner_address: string; ath_master_address: string; state_init_hash: string; note: string }>;
  funding_checklist: Array<{
    phase: string;
    required_balance_wallet: string;
    wallet_owner_address: string;
    amount_ath: string;
    amount_atomic: string;
    funding_route: string;
    requirement: string;
  }>;
  pre_seal_bindings: Array<[string, string]>;
};

const ARTIFACTS_LOCAL_DIR = join(process.cwd(), 'artifacts', 'local');
const DEFAULT_DRAFT_PATH = join(ARTIFACTS_LOCAL_DIR, 'mainnet_final_manifest_draft.json');
const DEFAULT_OUTPUT_JSON = join(ARTIFACTS_LOCAL_DIR, 'mainnet_deploy_packet.json');
const DEFAULT_OUTPUT_MD = join(ARTIFACTS_LOCAL_DIR, 'MAINNET_DEPLOY_PACKET.md');

function loadDraft(path: string): Draft {
  const draft = JSON.parse(readFileSync(path, 'utf8')) as Draft;
  if (draft.document !== 'PLATHO.V1.MAINNET_FINAL_MANIFEST_DRAFT') {
    throw new Error(`Unexpected draft document: ${draft.document}`);
  }
  if (draft.production_deploy_executed !== false) {
    throw new Error('Draft claims production_deploy_executed is not false');
  }
  return draft;
}

function role(draft: Draft, key: string): string {
  const entry = draft.role_summary[key];
  if (!entry?.normalized_address) throw new Error(`Missing role ${key}`);
  return entry.normalized_address;
}

function address(draft: Draft, key: string): string {
  const value = draft.manifest.addresses[key];
  if (!value) throw new Error(`Missing manifest address ${key}`);
  return value;
}

// W1-002: the FeeAccumulator lane/ticket binds carry a CODE cell, not an address, so their required value is the
// bound code hash recorded in the manifest.
function codeHashOf(draft: Draft, key: string): string {
  const value = (draft.manifest as any).code_hashes?.[key];
  if (!value) throw new Error(`Missing manifest code hash ${key}`);
  return value;
}

function derivedAthWallet(draft: Draft, key: string): string {
  const value = draft.derived_ath_wallets?.[key]?.address;
  if (!value) throw new Error(`Missing derived ATH wallet ${key}`);
  return value;
}

function stateHash(draft: Draft, key: string): string {
  const value = draft.manifest.state_init_hashes[key];
  if (!value) throw new Error(`Missing state init hash ${key}`);
  return value;
}

function codeHash(draft: Draft, key: string): string {
  const value = draft.manifest.code_hashes[key];
  if (!value) throw new Error(`Missing code hash ${key}`);
  return value;
}

function sameAddressString(left: string, right: string): boolean {
  try {
    return Address.parse(left).equals(Address.parse(right));
  } catch {
    return left === right;
  }
}

function optionalAddress(draft: Draft, key: string): string | null {
  return draft.manifest.addresses[key] ?? null;
}

function protocolRoleDenylist(draft: Draft): Array<[string, string]> {
  const keys = [
    'ath_master',
    'ath_long_term_vesting',
    'ath_long_term_vesting_official_ath_wallet',
    'ath_treasury_owner_ath_wallet',
    'buyback_burn',
    'buyback_burn_initial_genesis_controller',
    'buyback_burn_launch_controller',
    'buyback_burn_official_ath_wallet',
    'airdrop_pool',
    'airdrop_pool_official_ath_wallet',
    'fee_accumulator',
    'genesis_controller_one_shot',
    'market_stability_seller',
    'market_stability_seller_initial_genesis_controller',
    'market_stability_seller_launch_controller',
    'market_stability_seller_official_ath_wallet',
    'profile_registry',
    'profile_registry_initial_ath_wallet_placeholder',
    'profile_registry_official_ath_wallet',
    'username_registry',
    'username_registry_initial_ath_wallet_placeholder',
    'username_registry_official_ath_wallet',
  ];
  return keys
    .map((key): [string, string | null] => [key, optionalAddress(draft, key)])
    .filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function validateTreasuryReceiverNotProtocolOwned(draft: Draft, receiverKey: string, label: string) {
  const receiver = address(draft, receiverKey);
  for (const [forbiddenKey, forbidden] of protocolRoleDenylist(draft)) {
    if (sameAddressString(receiver, forbidden)) {
      throw new Error(`${label} must not equal protocol role ${forbiddenKey}: ${receiver}`);
    }
  }
}

function validateDistinctManifestAddresses(draft: Draft) {
  const keys = ['airdrop_pool', 'profile_registry', 'username_registry'];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const leftKey = keys[i];
      const rightKey = keys[j];
      const left = address(draft, leftKey);
      const right = address(draft, rightKey);
      if (sameAddressString(left, right)) {
        throw new Error(`Manifest core role address collision: ${leftKey} and ${rightKey} both resolve to ${left}`);
      }
    }
  }

  const profileTreasury = address(draft, 'profile_registry_treasury_ath_receiver');
  for (const forbiddenKey of ['profile_registry', 'profile_registry_official_ath_wallet', 'airdrop_pool', 'ath_master']) {
    const forbidden = address(draft, forbiddenKey);
    if (sameAddressString(profileTreasury, forbidden)) {
      throw new Error(`ProfileRegistry treasury receiver must not equal ${forbiddenKey}: ${profileTreasury}`);
    }
  }

  const usernameTreasury = address(draft, 'treasury_ath_receiver');
  for (const forbiddenKey of ['username_registry', 'username_registry_official_ath_wallet', 'airdrop_pool', 'ath_master']) {
    const forbidden = address(draft, forbiddenKey);
    if (sameAddressString(usernameTreasury, forbidden)) {
      throw new Error(`UsernameRegistry treasury receiver must not equal ${forbiddenKey}: ${usernameTreasury}`);
    }
  }

  validateTreasuryReceiverNotProtocolOwned(draft, 'profile_registry_treasury_ath_receiver', 'ProfileRegistry treasury receiver');
  validateTreasuryReceiverNotProtocolOwned(draft, 'treasury_ath_receiver', 'UsernameRegistry treasury receiver');
  validateTreasuryReceiverNotProtocolOwned(draft, 'fee_accumulator_ton_treasury_receiver', 'FeeAccumulator TON treasury receiver');
  validateTreasuryReceiverNotProtocolOwned(draft, 'market_stability_ton_treasury_receiver', 'MarketStabilitySeller TON treasury receiver');
  validateTreasuryReceiverNotProtocolOwned(draft, 'market_stability_reserve_funder', 'MarketStabilitySeller reserve funder');
}

function requiredInitialStateEntries(): Array<[string, string, string]> {
  return [
    ['ath_master', 'ath_master', 'ath_master'],
    ['ath_long_term_vesting', 'ath_long_term_vesting', 'ath_long_term_vesting_initial'],
    ['buyback_burn', 'buyback_burn', 'buyback_burn_initial'],
    ['market_stability_seller', 'market_stability_seller', 'market_stability_seller_initial'],
    ['fee_accumulator', 'fee_accumulator', 'fee_accumulator'],
    ['airdrop_pool', 'airdrop_pool', 'airdrop_pool_initial'],
    ['username_registry', 'username_registry', 'username_registry_initial'],
    ['profile_registry', 'profile_registry', 'profile_registry_initial'],
  ];
}

const STAGED_BIND_SEAL_INITIAL_STATE: Record<string, string> = {
  buyback_burn: 'bind FeeAccumulator and official ATH wallet before SealBuybackBurnGenesis',
  market_stability_seller: 'bind reserve funder, official ATH wallet, and treasury before SealMarketStabilityGenesis',
  airdrop_pool: 'bind ATHMaster + pool ATH wallet, credit issuer (=FeeAccumulator in clean-17), and treasury before AirdropSealGenesis',
  username_registry: 'bind official ATH wallet before SealGenesis',
  profile_registry: 'bind official ATH wallet before SealGenesis',
};

function isNonZeroInitialScalar(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === '') return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'bigint') return value !== 0n;
  if (typeof value !== 'string') return true;
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === '0') return false;
  if (/^0x0+$/.test(normalized)) return false;
  if (/^0+$/.test(normalized)) return false;
  return true;
}

function validateInitialStateInit(draft: Draft) {
  for (const [entryKey, addressKey, stateKey] of requiredInitialStateEntries()) {
    const entry = draft.initial_state_init?.[entryKey];
    if (!entry) throw new Error(`Missing initial StateInit entry ${entryKey}`);

    const expectedAddress = address(draft, addressKey);
    if (!sameAddressString(entry.address, expectedAddress)) {
      throw new Error(`Initial StateInit ${entryKey} address mismatch: expected ${expectedAddress}, got ${entry.address}`);
    }

    const expectedStateHash = stateHash(draft, stateKey);
    if ((entry.state_init_hash ?? '').toLowerCase() !== expectedStateHash.toLowerCase()) {
      throw new Error(`Initial StateInit ${entryKey} hash mismatch: expected ${expectedStateHash}, got ${entry.state_init_hash}`);
    }

    const stagedBindSealReason = STAGED_BIND_SEAL_INITIAL_STATE[entryKey];
    if (stagedBindSealReason && entry.sealed === true) {
      throw new Error(`Initial StateInit ${entryKey} must be unsealed; ${stagedBindSealReason}.`);
    }
    if (stagedBindSealReason) {
      const preboundFields = Object.entries(entry)
        .filter(([field, value]) => field.endsWith('_bound') && value === true)
        .map(([field]) => field);
      if (preboundFields.length > 0 || isNonZeroInitialScalar(entry.binding_flags)) {
        throw new Error(`Initial StateInit ${entryKey} must start unbound before staged bind/seal; found ${preboundFields.concat(isNonZeroInitialScalar(entry.binding_flags) ? ['binding_flags'] : []).join(', ')}.`);
      }
      if (isNonZeroInitialScalar(entry.deployment_manifest_hash)) {
        throw new Error(`Initial StateInit ${entryKey} must not carry deployment_manifest_hash before staged bind/seal.`);
      }
    }
  }
}

function requiredPreSealBindings(draft: Draft): Array<[string, string]> {
  return [
    ['BuybackBurn.BindBuybackFeeAccumulator', address(draft, 'fee_accumulator')],
    ['BuybackBurn.BindBuybackOfficialAthWallet', address(draft, 'buyback_burn_official_ath_wallet')],
    ['MarketStabilitySeller.BindMarketStabilityReserveFunder', address(draft, 'market_stability_reserve_funder')],
    ['MarketStabilitySeller.BindMarketStabilityOfficialAthWallet', address(draft, 'market_stability_seller_official_ath_wallet')],
    ['MarketStabilitySeller.BindMarketStabilityTreasury', address(draft, 'market_stability_ton_treasury_receiver')],
    // W1-001: BuybackBurn's treasury bind was missing from every artifact; seal (22509) is impossible without it.
    ['BuybackBurn.BindBuybackTreasury', address(draft, 'fee_accumulator_ton_treasury_receiver')],
    ['AirdropPool.AirdropBindAthMaster.ath_master_address', address(draft, 'ath_master')],
    ['AirdropPool.AirdropBindAthMaster.pool_ath_wallet_address', address(draft, 'airdrop_pool_official_ath_wallet')],
    ['AirdropPool.AirdropBindCreditIssuer.credit_issuer_address', address(draft, 'fee_accumulator')],
    ['AirdropPool.AirdropBindTreasury.treasury_address', address(draft, 'treasury_ath_receiver')],
    ['FeeAccumulator.BindAirdropPool.airdrop_pool_address', address(draft, 'airdrop_pool')],
    // W1-002: missing from every artifact -> every capsule fee bounced (15055) and the airdrop never accrued.
    ['FeeAccumulator.BindShardCode.shard_code', codeHashOf(draft, 'record_shard')],
    ['FeeAccumulator.BindIntroShardCode.intro_shard_code', codeHashOf(draft, 'intro_shard')],
    ['FeeAccumulator.BindPublicShardCode.public_shard_code', codeHashOf(draft, 'public_shard')],
    ['FeeAccumulator.BindTicketCode.ticket_code', codeHashOf(draft, 'airdrop_ticket')],
    ['UsernameRegistry.BindOfficialAthWallet', address(draft, 'username_registry_official_ath_wallet')],
    ['ProfileRegistry.BindProfileOfficialAthWallet', address(draft, 'profile_registry_official_ath_wallet')],
  ];
}

function bindingOwnerAddress(draft: Draft, message: string): string | null {
  if (message.startsWith('AirdropPool.')) return address(draft, 'airdrop_pool');
  if (message.startsWith('FeeAccumulator.')) return address(draft, 'fee_accumulator');
  if (message.startsWith('UsernameRegistry.')) return address(draft, 'username_registry');
  if (message.startsWith('ProfileRegistry.')) return address(draft, 'profile_registry');
  if (message.startsWith('BuybackBurn.')) return address(draft, 'buyback_burn');
  if (message.startsWith('MarketStabilitySeller.')) return address(draft, 'market_stability_seller');
  return null;
}

function validatePreSealBindings(draft: Draft) {
  const required = requiredPreSealBindings(draft);
  const requiredByMessage = new Map(required);
  const seen = new Map<string, string>();

  for (const [message, value] of draft.pre_seal_bindings) {
    if (seen.has(message)) throw new Error(`Duplicate pre-seal binding ${message}`);
    seen.set(message, value);

    const expected = requiredByMessage.get(message);
    if (!expected) throw new Error(`Unexpected pre-seal binding ${message}`);
    if (!sameAddressString(value, expected)) {
      throw new Error(`Pre-seal binding ${message} target mismatch: expected ${expected}, got ${value}`);
    }

    const ownerAddress = bindingOwnerAddress(draft, message);
    if (ownerAddress && sameAddressString(value, ownerAddress)) {
      throw new Error(`Pre-seal binding ${message} self-binds ${value}`);
    }
  }

  for (const [message, expected] of required) {
    if (!seen.has(message)) throw new Error(`Missing required pre-seal binding ${message} -> ${expected}`);
  }
}

export function buildPacket(draft: Draft) {
  validateDistinctManifestAddresses(draft);
  validateInitialStateInit(draft);
  validatePreSealBindings(draft);
  const manifestHash = draft.manifest.manifest_hash_hex;
  const deploymentSteps = [
    {
      id: 'D01',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Deploy ATHMaster',
      target_address: address(draft, 'ath_master'),
      code_hash: codeHash(draft, 'ath_master'),
      state_init_hash: stateHash(draft, 'ath_master'),
      stop_check: 'ATHMaster getter: total_supply=100M ATH, treasury_owner matches role, treasury_supply_deployed=false.',
    },
    {
      id: 'D02',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Call ATHMaster.DeployTreasurySupply',
      target_address: address(draft, 'ath_master'),
      // [RAISED 2026-07-29, wave-8 HIGH: 5M -> 620M] The old floor understated this transaction's own cost (MEASURED
      // 754,268 gas + 3,826,734 of action-phase forward fees for a message carrying the full ATHWallet StateInit) and,
      // since ATHMaster now forwards the surplus instead of refunding it, this value IS the treasury wallet's
      // permanent endowment — 100 years of its MEASURED 5,132,011/year rent. See ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE
      // and DEPLOY_TREASURY_SUPPLY_VALUE_RECOMMENDED_NANOTONS, raised in the same change.
      value_nanotons_min: '620000000',
      stop_check: 'Treasury owner ATH wallet receives exactly 100M ATH; treasury_supply_deployed=true; the wallet is left holding at least 500,000,000 nanoton of rent endowment.',
    },
    {
      id: 'D03',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy BuybackBurn',
      target_address: address(draft, 'buyback_burn'),
      code_hash: codeHash(draft, 'buyback_burn'),
      state_init_hash: stateHash(draft, 'buyback_burn_initial'),
      stop_check: 'BuybackBurn unsealed, fee/official wallet unbound, route not frozen.',
    },
    {
      id: 'D04',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy MarketStabilitySeller',
      target_address: address(draft, 'market_stability_seller'),
      code_hash: codeHash(draft, 'market_stability_seller'),
      state_init_hash: stateHash(draft, 'market_stability_seller_initial'),
      stop_check: 'MarketStabilitySeller unsealed, pricing not frozen, no reserve/sale state.',
    },
    {
      id: 'D05',
      signer_role: 'ton_treasury_receiver',
      signer_address: role(draft, 'ton_treasury_receiver'),
      action: 'Deploy FeeAccumulator',
      target_address: address(draft, 'fee_accumulator'),
      code_hash: codeHash(draft, 'fee_accumulator'),
      state_init_hash: stateHash(draft, 'fee_accumulator'),
      stop_check: 'FeeAccumulator buyback split disabled and all buckets zero.',
    },
    {
      id: 'D06',
      signer_role: 'ath_long_term_vesting_beneficiary',
      signer_address: role(draft, 'ath_long_term_vesting_beneficiary'),
      action: 'Deploy ATHVesting',
      target_address: address(draft, 'ath_long_term_vesting'),
      code_hash: codeHash(draft, 'ath_vesting'),
      state_init_hash: stateHash(draft, 'ath_long_term_vesting_initial'),
      stop_check: 'ATHVesting beneficiary/schedule match manifest, claimed=0, idle phase.',
    },
    {
      id: 'D07',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy AirdropPool',
      target_address: address(draft, 'airdrop_pool'),
      code_hash: codeHash(draft, 'airdrop_pool'),
      state_init_hash: stateHash(draft, 'airdrop_pool_initial'),
      stop_check: 'AirdropPool unsealed; ath_master/credit_issuer/treasury unbound; deployment_manifest_hash=0; funded_amount=0.',
    },
    {
      id: 'D08',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy UsernameRegistry',
      target_address: address(draft, 'username_registry'),
      code_hash: codeHash(draft, 'username_registry'),
      state_init_hash: stateHash(draft, 'username_registry_initial'),
      stop_check: 'UsernameRegistry unsealed, official ATH wallet placeholder still present.',
    },
    {
      id: 'D09',
      signer_role: 'genesis_controller_one_shot',
      signer_address: role(draft, 'genesis_controller_one_shot'),
      action: 'Deploy ProfileRegistry',
      target_address: address(draft, 'profile_registry'),
      code_hash: codeHash(draft, 'profile_registry'),
      state_init_hash: stateHash(draft, 'profile_registry_initial'),
      stop_check: 'ProfileRegistry unsealed, official ATH wallet placeholder still present.',
    },
  ];

  // [CORRECTED 2026-07-31] `index + 1` numbered the draft's seventeen bound FIELDS, while the ceremony signs sixteen
  // MESSAGES — AirdropBindAthMaster carries two fields in one body. From the seventh row on, every id here pointed at
  // a different step than the same id in the packet that gets signed, including B06, the one the runbook names as
  // the gate before the funding. Ids now come from CEREMONY_BIND_ORDER, which both generators read.
  const bindingSteps = draft.pre_seal_bindings.map(([message, value]) => {
    // clean-17: FeeAccumulator.BindAirdropPool is authorized by requireTreasury() (FeeAccumulator gate 15050,
    // sender == treasury_receiver_address == the ton_treasury_receiver role that deploys FeeAccumulator), NOT the
    // genesis controller. Signing it with genesis_controller_one_shot would BOUNCE on-chain (exit 15050). Every
    // AirdropPool.* binding + all other binds use requireController -> genesis_controller_one_shot.
    const signerRole = message.startsWith('FeeAccumulator.') ? 'ton_treasury_receiver' : 'genesis_controller_one_shot';
    return {
      id: bindStepId(bindMessageKey(message)),
      signer_role: signerRole,
      signer_address: role(draft, signerRole),
      message,
      value,
      deployment_manifest_hash: manifestHash,
      stop_check: 'Getter must show bound value exactly; second/replay binding must remain impossible after seal.',
    };
  });

  const sealSteps = [
    ['S01', 'AirdropPool.AirdropSealGenesis', address(draft, 'airdrop_pool')],
    ['S02', 'UsernameRegistry.SealGenesis', address(draft, 'username_registry')],
    ['S03', 'ProfileRegistry.SealGenesis', address(draft, 'profile_registry')],
    ['S04', 'BuybackBurn.SealBuybackBurnGenesis', address(draft, 'buyback_burn')],
    ['S05', 'MarketStabilitySeller.SealMarketStabilityGenesis', address(draft, 'market_stability_seller')],
  ].map(([id, message, target_address]) => ({
    id,
    signer_role: 'genesis_controller_one_shot',
    signer_address: role(draft, 'genesis_controller_one_shot'),
    message,
    target_address,
    deployment_manifest_hash: manifestHash,
    stop_check: 'Getter must show sealed=true and deployment_manifest_hash equals manifest hash; no user activity before final genesis verification.',
  }));

  const fundingSteps = [
    {
      id: 'F01',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Send ATHTransferRequest from Treasury Owner ATHWallet to fund AirdropPool airdrop backing',
      target_address: derivedAthWallet(draft, 'treasury_owner_ath_wallet'),
      target_is: 'Treasury Owner ATHWallet',
      recipient_owner_address: address(draft, 'airdrop_pool'),
      expected_recipient_ath_wallet: address(draft, 'airdrop_pool_official_ath_wallet'),
      amount_atomic: draft.manifest.constants.vault_activity_airdrop_total_atomic,
      warning: 'Do not send directly to the official ATH wallet address. ATHTransferRequest.recipient is the owner contract address.',
      stop_check: 'AirdropPool official ATHWallet balance is exactly 15M ATH; AirdropPool funded_amount/remaining_budget is 15M and distributed_total is 0.',
    },
    {
      id: 'F02',
      signer_role: 'ath_treasury_owner',
      signer_address: role(draft, 'ath_treasury_owner'),
      action: 'Send ATHTransferRequest from Treasury Owner ATHWallet to fund ATHVesting backing',
      target_address: derivedAthWallet(draft, 'treasury_owner_ath_wallet'),
      target_is: 'Treasury Owner ATHWallet',
      recipient_owner_address: address(draft, 'ath_long_term_vesting'),
      expected_recipient_ath_wallet: address(draft, 'ath_long_term_vesting_official_ath_wallet'),
      amount_atomic: draft.manifest.constants.ath_long_term_vesting_allocation_atomic,
      warning: 'Do not send directly to the official ATH wallet address. ATHTransferRequest.recipient is the owner contract address.',
      stop_check: 'ATHVesting official ATHWallet balance is exactly 10M ATH; ATHVesting remains idle/clean.',
    },
  ];

  // [ADDED 2026-07-31, ceremony reachability audit] W01..W04 existed in the tx dry-run packet and in NO human-readable
  // document: the operator sheet, the runbook and this packet all went straight from the funding to the seals. The
  // step tops up the storage float of the four ATHWallets that hold 85,000,000 ATH and are never redeployable, taking
  // them from the ~20,000,000 their transfer leg carries (≈3.7 years of rent, frozen at ≈22) to 600,000,000 (≈110
  // years). Permissionless, so unlike the seals it stays repairable — but a step nobody has written down is a step
  // nobody performs, and the account it protects has no second chance if it ever does freeze.
  const officialWalletEndowmentSteps = ([
    ['W01', 'market_stability_seller_official_ath_wallet', 'MarketStabilitySeller official ATHWallet (holds 60,000,000 ATH)'],
    ['W02', 'airdrop_pool_official_ath_wallet', 'AirdropPool official ATHWallet (holds 15,000,000 ATH)'],
    ['W03', 'ath_long_term_vesting_official_ath_wallet', 'ATHVesting official ATHWallet (holds 10,000,000 ATH)'],
    ['W04', 'buyback_burn_official_ath_wallet', 'BuybackBurn official ATHWallet (holds bought ATH awaiting burn)'],
  ] as Array<[string, string, string]>).map(([id, key, label]) => ({
    id,
    signer_role: 'ath_treasury_owner',
    signer_address: role(draft, 'ath_treasury_owner'),
    action: `Send ATHWalletTopUpStorageReserve to endow ${label}`,
    target_address: address(draft, key),
    target_is: label,
    warning: 'Target is the official ATHWallet ITSELF, not its owner contract, and must be signed NON-BOUNCEABLE (UQ): '
      + "W01's and W04's wallets do not exist yet, and the bounceable form returns the endowment while the send succeeds.",
    stop_check: 'Wallet balance is at least 600,000,000 nanoton once the account exists; no ATH balance change, no state change.',
  }));

  return {
    document: 'PLATHO.V1.MAINNET_DEPLOY_PACKET',
    generated_at: new Date().toISOString(),
    source_draft_generated_at: draft.generated_at,
    production_deploy_executed: false,
    lifecycle_stage: 'pre_execution_deploy_packet_template',
    lifecycle_note: 'production_deploy_executed=false means this local packet is a pre-execution template; live release truth comes from mainnet_genesis_verify_report.json after fresh verification.',
    manifest_hash_hex: manifestHash,
    roles: draft.role_summary,
    contract_addresses: Object.fromEntries(
      Object.entries(draft.initial_state_init).map(([key, value]) => [key, value.address]),
    ),
    official_ath_wallets: draft.official_ath_wallets,
    derived_ath_wallets: draft.derived_ath_wallets,
    phase_1_deploy_contracts: deploymentSteps,
    phase_2_pre_seal_bindings: bindingSteps,
    phase_3_pre_seal_funding: fundingSteps,
    phase_3b_official_wallet_endowment: officialWalletEndowmentSteps,
    phase_4_seal_contracts: sealSteps,
    phase_5_final_genesis_verification: {
      template: 'artifacts/mainnet_genesis_verify_input_template.json',
      command: 'npm.cmd run mainnet:genesis:verify',
      must_pass_before: [
        'production PWA mainnet config release',
        '15M activity airdrop distribution through AirdropPool',
        'initial liquidity pool launch',
        'MarketStability pricing freeze',
        'Buyback route freeze',
        'EnableBuybackSplit',
      ],
    },
    post_genesis_not_in_this_packet: [
      'Release production PWA/mainnet config only after preprod and crypto gates pass.',
      'Distribute the 15M ATH activity airdrop through AirdropPool until remaining_budget is zero.',
      'Open 15M ATH / 100,000 TON liquidity pool only after the activity airdrop is fully distributed.',
      'Collect STON.fi route evidence and run M20F route preflights.',
      'Freeze BuybackBurn route.',
      'Freeze MarketStabilitySeller pricing.',
      'Fund 60M ATH seller reserve through official reserve notify flow.',
      'Run market_stability_seller_readiness.',
      'Keep official MarketStabilitySeller buy tooling disabled until MARKET_STABILITY_SELLER_READY.txt is true.',
      'Run enable_buyback_split_preflight only after activity airdrop distribution, route freeze, and seller readiness gates are clean.',
      'Enable FeeAccumulator buyback split.',
    ],
    hard_stops: [
      'Stop on any address mismatch between this packet, Tonkeeper transaction preview, and live getter.',
      'Stop if a wallet asks for seed phrase in a browser page.',
      'Stop if final manifest hash changes after funding begins.',
      'Stop if AirdropPool or ATHVesting official ATHWallet is not active with exact funding, or if zero-balance official ATHWallets are active with non-zero ATH. Username/Profile/Buyback/MSS official ATHWallets may still be uninit at their deterministic StateInit addresses.',
      'Stop if any post-seal binding still succeeds.',
    ],
  };
}

function markdown(packet: ReturnType<typeof buildPacket>): string {
  const lines = [
    '# Mainnet Deploy Packet',
    '',
    `Generated: ${packet.generated_at}`,
    `Manifest hash: ${packet.manifest_hash_hex}`,
    `Production deploy executed: ${packet.production_deploy_executed}`,
    `Lifecycle stage: ${packet.lifecycle_stage}`,
    `Lifecycle note: ${packet.lifecycle_note}`,
    '',
    '## Contract Addresses',
    '',
    '| Contract | Address |',
    '| --- | --- |',
  ];

  for (const [key, value] of Object.entries(packet.contract_addresses)) {
    lines.push(`| ${key} | ${value} |`);
  }

  lines.push('', '## Official ATH Wallets', '', '| Wallet | Address |', '| --- | --- |');
  for (const [key, value] of Object.entries(packet.official_ath_wallets)) {
    lines.push(`| ${key} | ${value} |`);
  }

  lines.push('', '## Phase 1: Deploy Contracts', '', '| Step | Signer | Action | Target | Stop Check |', '| --- | --- | --- | --- | --- |');
  for (const step of packet.phase_1_deploy_contracts) {
    lines.push(`| ${step.id} | ${step.signer_role} | ${step.action} | ${step.target_address} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 2: Pre-Seal Bindings', '', '| Step | Message | Value | Stop Check |', '| --- | --- | --- | --- |');
  for (const step of packet.phase_2_pre_seal_bindings) {
    lines.push(`| ${step.id} | ${step.message} | ${step.value} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 3: Pre-Seal Genesis Funding', '', '| Step | Signer | Action | Target | Recipient Owner | Expected Official Wallet | Amount Atomic | Stop Check |', '| --- | --- | --- | --- | --- | --- | ---: | --- |');
  for (const step of packet.phase_3_pre_seal_funding) {
    lines.push(`| ${step.id} | ${step.signer_role} | ${step.action} | ${step.target_address} | ${step.recipient_owner_address} | ${step.expected_recipient_ath_wallet} | ${step.amount_atomic} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 3b: Official Wallet Storage Endowment', '',
    'Signed after the funding and before the seals, so Phase 5 reads the endowed balances instead of assuming them. '
    + 'These four wallets hold 85,000,000 ATH and can never be redeployed.', '',
    '| Step | Signer | Action | Target (the ATHWallet itself) | Stop Check |', '| --- | --- | --- | --- | --- |');
  for (const step of packet.phase_3b_official_wallet_endowment) {
    lines.push(`| ${step.id} | ${step.signer_role} | ${step.action} | ${step.target_address} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 4: Seal Contracts', '', '| Step | Message | Target | Stop Check |', '| --- | --- | --- | --- |');
  for (const step of packet.phase_4_seal_contracts) {
    lines.push(`| ${step.id} | ${step.message} | ${step.target_address} | ${step.stop_check} |`);
  }

  lines.push('', '## Phase 5: Final Genesis Verification', '');
  lines.push(`- Template: ${packet.phase_5_final_genesis_verification.template}`);
  lines.push(`- Command: \`${packet.phase_5_final_genesis_verification.command}\``);
  lines.push('- Must pass before:');
  for (const item of packet.phase_5_final_genesis_verification.must_pass_before) {
    lines.push(`  - ${item}`);
  }

  lines.push('', '## Post-Genesis Tasks Not In This Packet', '');
  for (const item of packet.post_genesis_not_in_this_packet) {
    lines.push(`- ${item}`);
  }

  lines.push('', '## Hard Stops', '');
  for (const stop of packet.hard_stops) {
    lines.push(`- ${stop}`);
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const draftPath = process.argv[2] ?? DEFAULT_DRAFT_PATH;
  const draft = loadDraft(draftPath);
  const packet = buildPacket(draft);
  mkdirSync(ARTIFACTS_LOCAL_DIR, { recursive: true });
  writeFileSync(DEFAULT_OUTPUT_JSON, JSON.stringify(packet, null, 2) + '\n');
  writeFileSync(DEFAULT_OUTPUT_MD, markdown(packet));
  console.log(JSON.stringify({
    ok: true,
    outputJson: DEFAULT_OUTPUT_JSON,
    outputMarkdown: DEFAULT_OUTPUT_MD,
    manifestHash: packet.manifest_hash_hex,
    deploySteps: packet.phase_1_deploy_contracts.length,
    bindingSteps: packet.phase_2_pre_seal_bindings.length,
    fundingSteps: packet.phase_3_pre_seal_funding.length,
    endowmentSteps: packet.phase_3b_official_wallet_endowment.length,
    sealSteps: packet.phase_4_seal_contracts.length,
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
