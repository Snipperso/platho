import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { Address, beginCell, Cell } from '@ton/core';
import { isTestnetFriendlyAddress } from './m20f_mainnet_route_freeze_preflight';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
export const DEFAULT_MAINNET_GENESIS_VERIFY_INPUT_PATH = join(ARTIFACTS_DIR, 'mainnet_genesis_verify_input.json');
const FINAL_MANIFEST_DOMAIN = 'PLATHO.V1.FINAL_GENESIS_MANIFEST';
const EXPECTED_ATH_TOTAL_SUPPLY_ATOMIC = '100000000000000000';
const EXPECTED_VAULT_ACTIVITY_AIRDROP_TOTAL_ATOMIC = '15000000000000000';
const EXPECTED_ATH_TREASURY_OWNER_REMAINING_ATOMIC = '75000000000000000';
const EXPECTED_MARKET_STABILITY_RESERVE_ATOMIC = '60000000000000000';
const EXPECTED_ATH_LONG_TERM_VESTING_ATOMIC = '10000000000000000';
const EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_COUNT = '100';
const EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_SECONDS = '31536000';
const EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_UNLOCK_ATOMIC = '100000000000000';
const CURRENT_CODE_HASH_TO_MANIFEST_KEY: Record<string, string> = {
  ATHMASTER_CODE_HASH: 'ath_master',
  ATHVESTING_CODE_HASH: 'ath_vesting',
  ATH_WALLET_CODE_HASH: 'ath_wallet',
  BUYBACKBURN_CODE_HASH: 'buyback_burn',
  MARKET_STABILITY_SELLER_CODE_HASH: 'market_stability_seller',
  CAPSULEHUB_CODE_HASH: 'capsulehub',
  FEEACCUMULATOR_CODE_HASH: 'fee_accumulator',
  PROFILE_REGISTRY_CODE_HASH: 'profile_registry',
  USERNAME_NFT_ITEM_CODE_HASH: 'username_nft_item',
  USERNAME_REGISTRY_CODE_HASH: 'username_registry',
  VAULT_CODE_HASH: 'vault',
};

type Issue = { code: string; message: string };

type ManifestLike = {
  profile: string;
  version?: number;
  status: string;
  manifest_hash_hex: string;
  addresses: Record<string, string>;
  code_hashes: Record<string, string>;
  state_init_hashes?: Record<string, string>;
  constants?: Record<string, string>;
  blockers_before_final_genesis?: string[];
};

type BaseSnapshot = {
  address: string;
  code_hash: string;
  account_state?: 'active' | 'uninit';
  sealed?: boolean;
  deployment_manifest_hash?: string;
};

export interface MainnetGenesisVerifyInput {
  document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_INPUT';
  network: 'mainnet';
  manifest: ManifestLike;
  snapshot: {
    ath_master: BaseSnapshot & {
      total_supply_atomic: string;
      treasury_owner_address: string;
      treasury_supply_deployed: boolean;
    };
    vault: BaseSnapshot & {
      capsule_hub_bound: boolean;
      capsule_hub_address: string;
      profile_registry_bound: boolean;
      profile_registry_address: string;
      username_registry_bound: boolean;
      username_registry_address: string;
      vault_ath_wallet_address: string;
      ath_master_address: string;
      user_count: string;
      key_record_count: string;
      receive_intent_count: string;
      pending_ath_withdrawal_count: string;
      pending_publish_count: string;
      processed_ath_deposit_count: string;
      airdrop_remaining_ath: string;
      airdrop_distributed_ath: string;
    };
    vault_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    ath_treasury_owner_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    ath_long_term_vesting: BaseSnapshot & {
      ath_master_address: string;
      beneficiary_address: string;
      official_ath_wallet_address: string;
      start_time: string;
      period_seconds: string;
      period_count: string;
      period_unlock_amount: string;
      total_amount: string;
      phase: string;
      claimed_ath: string;
      vested_ath: string;
      claimable_ath: string;
      pending_query_id: string;
      pending_amount: string;
      pending_created_at: string;
      last_terminal_query_id: string;
    };
    ath_long_term_vesting_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    market_stability_seller: BaseSnapshot & {
      reserve_funder_address: string;
      official_ath_wallet_address: string;
      ton_treasury_receiver_address: string;
      ath_master_address: string;
      genesis_config_hash: string;
      pricing_frozen: boolean;
      reserve_due_ath: string;
      reserve_funded_total_ath: string;
      treasury_due_ton: string;
      sold_ath_total: string;
      phase: string;
      pending_query_id: string;
      pending_amount_ath: string;
      pending_paid_ton: string;
      completed_tranche_count: string;
      current_tranche_sold_ath: string;
      last_terminal_query_id: string;
      treasury_flushed_ton_total: string;
    };
    market_stability_seller_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    capsulehub: BaseSnapshot & {
      ton_balance: string;
      vault_bound: boolean;
      vault_address: string;
      fee_accumulator_address: string;
      private_latest_id: string;
      public_latest_id: string;
      accrued_plato_fee_ton: string;
    };
    username_registry: BaseSnapshot & {
      official_ath_wallet_bound: boolean;
      official_ath_wallet_address: string;
      vault_bound: boolean;
      vault_address: string;
      ath_master_address: string;
      treasury_ath_receiver: string;
      name_record_count: string;
      pending_mint_count: string;
      refund_due_count: string;
      treasury_due_ath: string;
      burn_due_ath: string;
      pending_refund_flush_count: string;
      pending_treasury_flush_count: string;
      pending_burn_flush_count: string;
    };
    username_registry_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    profile_registry: BaseSnapshot & {
      official_ath_wallet_bound: boolean;
      official_ath_wallet_address: string;
      vault_bound: boolean;
      vault_address: string;
      ath_master_address: string;
      treasury_ath_receiver: string;
      profile_count: string;
      avatar_record_count: string;
      treasury_due_ath: string;
      burn_due_ath: string;
      pending_treasury_flush_count: string;
      pending_burn_flush_count: string;
    };
    profile_registry_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    buyback_burn: BaseSnapshot & {
      fee_accumulator_address: string;
      official_ath_wallet_address: string;
      ath_master_address: string;
      genesis_config_hash: string;
      route_frozen: boolean;
      phase: string;
      reserve_due_ton: string;
      pending_query_id: string;
      route_refund_due_ton: string;
      ath_burn_retry_due_atomic: string;
      last_terminal_query_id: string;
      accepted_reserve_count: string;
      executed_buyback_count: string;
      burned_ath_total_atomic: string;
    };
    buyback_burn_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    fee_accumulator: BaseSnapshot & {
      buyback_burn_address: string;
      ton_treasury_receiver: string;
      buyback_split_enabled: boolean;
      accumulated_ton: string;
      treasury_due_ton: string;
      buyback_due_ton: string;
    };
  };
  evidenceRefs: {
    getterSnapshotSource: string;
    codeHashProofSource: string;
    finalManifestSource: string;
  };
}

export interface MainnetGenesisVerifyReport {
  document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_REPORT';
  status: 'BLOCKED_MISSING_INPUT' | 'BLOCKED_GENESIS_MISMATCH' | 'MAINNET_GENESIS_VERIFIED';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  mainnet_genesis_verified: boolean;
  input_source: string | null;
  input_sha256: string | null;
  evidence_refs: MainnetGenesisVerifyInput['evidenceRefs'] | null;
  issue_codes: string[];
  issues: Issue[];
  checked_manifest_hash: string | null;
}

type GenesisVerifyInputMetadata = {
  inputSource?: string | null;
  inputSha256?: string | null;
};

function issue(code: string, message: string): Issue {
  return { code, message };
}

function isHex64(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  return v.length === 0 || v.includes('REQUIRED_') || v.includes('required:') || v.includes('EQ...') || v.includes('<');
}

function isParseableMainnetAddress(value: unknown): value is string {
  if (typeof value !== 'string' || isPlaceholder(value)) return false;
  try {
    Address.parse(value);
    return !isTestnetFriendlyAddress(value);
  } catch {
    return false;
  }
}

function sameAddress(a: string, b: string): boolean {
  return Address.parse(a).equals(Address.parse(b));
}

function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function normalizedArtifactSource(path: string): string {
  return relative(process.cwd(), path).replace(/\\/g, '/');
}

function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function currentBuildConsistencyIssues(input: MainnetGenesisVerifyInput): Issue[] {
  const currentCodeHashesPath = join(ARTIFACTS_DIR, 'CURRENT_CODE_HASHES.txt');
  if (!existsSync(currentCodeHashesPath)) {
    return [
      issue(
        'CURRENT_CODE_HASHES_MISSING',
        'artifacts/CURRENT_CODE_HASHES.txt is required before this final genesis snapshot can be treated as current-release evidence.',
      ),
    ];
  }

  const currentCodeHashes = parseKeyValueLines(readFileSync(currentCodeHashesPath, 'utf8'));
  const mismatches: string[] = [];
  for (const [currentKey, manifestKey] of Object.entries(CURRENT_CODE_HASH_TO_MANIFEST_KEY)) {
    const currentHash = currentCodeHashes[currentKey]?.toLowerCase();
    const manifestHash = input.manifest.code_hashes?.[manifestKey]?.toLowerCase();
    if (!currentHash || !manifestHash || currentHash !== manifestHash) {
      mismatches.push(`${manifestKey}: current=${currentHash ?? 'missing'}, manifest=${manifestHash ?? 'missing'}`);
    }
  }

  if (mismatches.length === 0) return [];
  return [
    issue(
      'CURRENT_CODE_HASHES_DO_NOT_MATCH_FINAL_MANIFEST',
      `Final genesis evidence does not belong to the current local build: ${mismatches.join('; ')}.`,
    ),
  ];
}

function withAdditionalIssues(report: MainnetGenesisVerifyReport, additionalIssues: Issue[]): MainnetGenesisVerifyReport {
  if (additionalIssues.length === 0) return report;
  const issues = [...report.issues, ...additionalIssues];
  return {
    ...report,
    status: 'BLOCKED_GENESIS_MISMATCH',
    mainnet_genesis_verified: false,
    issues,
    issue_codes: Array.from(new Set(issues.map((item) => item.code))),
  };
}

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function sortedEntries<T extends Record<string, string>>(map: T): [string, string][] {
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function labeledAddressListCell(addresses: Record<string, string>): Cell {
  let tail = beginCell().storeUint(0, 1).endCell();
  for (const [label, friendly] of sortedEntries(addresses).reverse()) {
    tail = beginCell()
      .storeUint(1, 1)
      .storeBuffer(sha256(label))
      .storeAddress(Address.parse(friendly))
      .storeRef(tail)
      .endCell();
  }
  return tail;
}

function labeledHashListCell(hashes: Record<string, string>): Cell {
  let tail = beginCell().storeUint(0, 1).endCell();
  for (const [label, hex] of sortedEntries(hashes).reverse()) {
    tail = beginCell()
      .storeUint(1, 1)
      .storeBuffer(sha256(label))
      .storeBuffer(hexToBuffer(hex))
      .storeRef(tail)
      .endCell();
  }
  return tail;
}

function labeledUIntListCell(values: Record<string, string>): Cell {
  let tail = beginCell().storeUint(0, 1).endCell();
  for (const [label, value] of sortedEntries(values).reverse()) {
    tail = beginCell()
      .storeUint(1, 1)
      .storeBuffer(sha256(label))
      .storeUint(BigInt(value), 256)
      .storeRef(tail)
      .endCell();
  }
  return tail;
}

function blockersCell(blockers: string[]): Cell {
  let tail = beginCell().storeUint(0, 1).endCell();
  for (const blocker of [...blockers].sort().reverse()) {
    tail = beginCell()
      .storeUint(1, 1)
      .storeBuffer(sha256(blocker))
      .storeRef(tail)
      .endCell();
  }
  return tail;
}

export function computeFinalGenesisManifestHashHex(manifest: ManifestLike): string {
  const stateInitHashes = manifest.state_init_hashes ?? {};
  const hashes = {
    ...manifest.code_hashes,
    ...Object.fromEntries(Object.entries(stateInitHashes).map(([key, value]) => [`state_init.${key}`, value])),
  };
  return beginCell()
    .storeBuffer(sha256(FINAL_MANIFEST_DOMAIN))
    .storeBuffer(sha256(manifest.profile))
    .storeUint(BigInt(manifest.version ?? 0), 16)
    .storeBuffer(sha256(manifest.status))
    .storeRef(labeledAddressListCell(manifest.addresses))
    .storeRef(labeledHashListCell(hashes))
    .storeRef(labeledUIntListCell(manifest.constants ?? {}))
    .storeRef(blockersCell(manifest.blockers_before_final_genesis ?? []))
    .endCell()
    .hash()
    .toString('hex');
}

function addressHashHex(value: string): string {
  return beginCell().storeAddress(Address.parse(value)).endCell().hash().toString('hex');
}

function addressWorkchain(value: unknown): number | null {
  if (!isParseableMainnetAddress(value)) return null;
  return Address.parse(value as string).workChain;
}

function addEq(issues: Issue[], code: string, actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    issues.push(issue(code, `${label} mismatch: expected ${expected}, got ${actual}`));
  }
}

function addAddressEq(issues: Issue[], code: string, actual: string, expected: string, label: string) {
  if (!isParseableMainnetAddress(actual) || !isParseableMainnetAddress(expected) || !sameAddress(actual, expected)) {
    issues.push(issue(code, `${label} address mismatch: expected ${expected}, got ${actual}`));
  }
}

function addAddressNotEq(issues: Issue[], code: string, actual: string, forbidden: string, label: string, forbiddenLabel: string) {
  if (isParseableMainnetAddress(actual) && isParseableMainnetAddress(forbidden) && sameAddress(actual, forbidden)) {
    issues.push(issue(code, `${label} must not equal ${forbiddenLabel}`));
  }
}

function addTrue(issues: Issue[], code: string, actual: boolean | undefined, label: string) {
  if (actual !== true) {
    issues.push(issue(code, `${label} must be true`));
  }
}

function addDecimalGte(issues: Issue[], code: string, actual: unknown, expected: string, label: string) {
  if (!isDecimalString(actual)) {
    issues.push(issue(code, `${label} must be a decimal atomic amount string; got ${actual}`));
    return;
  }
  if (BigInt(actual) < BigInt(expected)) {
    issues.push(issue(code, `${label} underfunded: expected at least ${expected}, got ${actual}`));
  }
}

function addDecimalEq(issues: Issue[], code: string, actual: unknown, expected: string, label: string) {
  if (!isDecimalString(actual)) {
    issues.push(issue(code, `${label} must be a decimal atomic amount string; got ${actual}`));
    return;
  }
  if (BigInt(actual) !== BigInt(expected)) {
    issues.push(issue(code, `${label} mismatch: expected ${expected}, got ${actual}`));
  }
}

function addDecimalZero(issues: Issue[], code: string, actual: unknown, label: string) {
  addDecimalEq(issues, code, actual, '0', label);
}

function addBasechainAddress(issues: Issue[], code: string, value: unknown, label: string) {
  const workchain = addressWorkchain(value);
  if (workchain !== null && workchain !== 0) {
    issues.push(issue(code, `${label} must be a basechain workchain 0 address for the current release; got workchain ${workchain}.`));
  }
}

function addDistinctManifestAddresses(issues: Issue[], manifest: ManifestLike, keys: string[], code: string) {
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const leftKey = keys[i];
      const rightKey = keys[j];
      const left = manifest.addresses?.[leftKey];
      const right = manifest.addresses?.[rightKey];
      if (!isParseableMainnetAddress(left) || !isParseableMainnetAddress(right)) continue;
      if (sameAddress(left, right)) {
        issues.push(issue(
          code,
          `manifest.addresses.${leftKey} and manifest.addresses.${rightKey} must be distinct protocol contract addresses; both resolve to ${left}.`,
        ));
      }
    }
  }
}

const PROTOCOL_TREASURY_DENYLIST_KEYS = [
  'ath_master',
  'ath_long_term_vesting',
  'ath_long_term_vesting_official_ath_wallet',
  'ath_treasury_owner_ath_wallet',
  'buyback_burn',
  'buyback_burn_initial_genesis_controller',
  'buyback_burn_launch_controller',
  'buyback_burn_official_ath_wallet',
  'capsulehub',
  'capsulehub_initial_vault_placeholder',
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
  'vault',
  'vault_initial_capsulehub_placeholder',
  'vault_official_ath_wallet',
];

function addManifestTreasuryReceiverNotProtocolOwned(
  issues: Issue[],
  manifest: ManifestLike,
  receiverKey: string,
  code: string,
) {
  const receiver = manifest.addresses?.[receiverKey];
  if (!isParseableMainnetAddress(receiver)) return;
  for (const forbiddenKey of PROTOCOL_TREASURY_DENYLIST_KEYS) {
    const forbidden = manifest.addresses?.[forbiddenKey];
    if (!isParseableMainnetAddress(forbidden)) continue;
    if (sameAddress(receiver, forbidden)) {
      issues.push(issue(code, `manifest.addresses.${receiverKey} must not equal protocol role ${forbiddenKey}.`));
    }
  }
}

function addManifestHashCheck(issues: Issue[], manifest: ManifestLike) {
  if (!Number.isInteger(manifest.version) || (manifest.version ?? 0) <= 0) {
    issues.push(issue('FINAL_MANIFEST_VERSION_MISSING', 'manifest.version must be a positive integer and is part of the final manifest hash domain.'));
  }
  if (!manifest.state_init_hashes || Object.keys(manifest.state_init_hashes).length === 0) {
    issues.push(issue('FINAL_MANIFEST_STATE_INIT_HASHES_MISSING', 'manifest.state_init_hashes are required because final manifest hash must commit to deployment StateInit hashes.'));
  }
  for (const [key, value] of Object.entries(manifest.state_init_hashes ?? {})) {
    if (!isHex64(value)) issues.push(issue(`BAD_MANIFEST_STATE_INIT_HASH_${key.toUpperCase()}`, `${key} state init hash must be 32-byte hex.`));
  }
  if (!isHex64(manifest.manifest_hash_hex)) return;
  const canRecompute =
    Number.isInteger(manifest.version)
    && (manifest.version ?? 0) > 0
    && Object.values(manifest.addresses ?? {}).every(isParseableMainnetAddress)
    && Object.values(manifest.code_hashes ?? {}).every(isHex64)
    && Object.values(manifest.state_init_hashes ?? {}).every(isHex64)
    && Object.values(manifest.constants ?? {}).every(isDecimalString);
  if (!canRecompute) return;
  const recomputed = computeFinalGenesisManifestHashHex(manifest);
  if (manifest.manifest_hash_hex.toLowerCase() !== recomputed) {
    issues.push(issue('FINAL_MANIFEST_HASH_MISMATCH', `manifest.manifest_hash_hex must equal the canonical final manifest hash ${recomputed}; got ${manifest.manifest_hash_hex}.`));
  }
}

function addAddressHashEq(issues: Issue[], code: string, actualHash: unknown, expectedAddress: unknown, label: string) {
  if (!isHex64(actualHash)) return;
  if (!isParseableMainnetAddress(expectedAddress)) {
    issues.push(issue(`${code}_ADDRESS_INVALID`, `${label} controller address must be a parseable mainnet address.`));
    return;
  }
  const expectedHash = addressHashHex(expectedAddress);
  if (actualHash.toLowerCase() !== expectedHash) {
    issues.push(issue(code, `${label} mismatch: expected hash(${expectedAddress}) = ${expectedHash}, got ${actualHash}`));
  }
}

function checkBase(
  issues: Issue[],
  manifest: ManifestLike,
  snapshot: BaseSnapshot,
  contractKey: string,
  addressKey: string,
  codeHashKey: string,
) {
  addAddressEq(issues, `${contractKey.toUpperCase()}_ADDRESS_MISMATCH`, snapshot.address, manifest.addresses[addressKey], `${contractKey}.address`);
  addEq(issues, `${contractKey.toUpperCase()}_CODE_HASH_MISMATCH`, snapshot.code_hash?.toLowerCase(), manifest.code_hashes[codeHashKey], `${contractKey}.code_hash`);
}

function checkRequiredStateInitHash(issues: Issue[], manifest: ManifestLike, key: string, label: string) {
  if (!isHex64(manifest.state_init_hashes?.[key])) {
    issues.push(issue(`${key.toUpperCase()}_STATE_INIT_HASH_MISSING`, `${label} StateInit hash must be present in manifest.state_init_hashes for deterministic uninit verification.`));
  }
}

function checkFundedOfficialAthWallet(
  issues: Issue[],
  manifest: ManifestLike,
  snapshot: BaseSnapshot & { owner_address: string; ath_master_address: string; balance_atomic: string },
  contractKey: string,
  addressKey: string,
  ownerAddress: string,
  expectedBalance: string,
  balanceIssueCode: string,
) {
  if (snapshot.account_state !== undefined && snapshot.account_state !== 'active') {
    issues.push(issue(`${contractKey.toUpperCase()}_NOT_ACTIVE`, `${contractKey}.account_state must be active because this official ATHWallet must be funded at final genesis.`));
  }
  checkBase(issues, manifest, snapshot, contractKey, addressKey, 'ath_wallet');
  addAddressEq(issues, `${contractKey.toUpperCase()}_OWNER_MISMATCH`, snapshot.owner_address, ownerAddress, `${contractKey}.owner_address`);
  addAddressEq(issues, `${contractKey.toUpperCase()}_MASTER_MISMATCH`, snapshot.ath_master_address, manifest.addresses.ath_master, `${contractKey}.ath_master_address`);
  addDecimalEq(issues, balanceIssueCode, snapshot.balance_atomic, expectedBalance, `${contractKey}.balance_atomic`);
}

function checkZeroOfficialAthWallet(
  issues: Issue[],
  manifest: ManifestLike,
  snapshot: (BaseSnapshot & { owner_address?: string; ath_master_address?: string; balance_atomic: string }) | undefined,
  contractKey: string,
  addressKey: string,
  missingIssueCode: string,
  ownerMismatchCode: string,
  masterMismatchCode: string,
  fundedIssueCode: string,
  ownerAddress: string,
) {
  if (!snapshot) {
    issues.push(issue(missingIssueCode, `snapshot.${contractKey} getter/account-state data is required.`));
    return;
  }
  addAddressEq(issues, `${contractKey.toUpperCase()}_ADDRESS_MISMATCH`, snapshot.address, manifest.addresses[addressKey], `${contractKey}.address`);
  addDecimalEq(issues, fundedIssueCode, snapshot.balance_atomic, '0', `${contractKey}.balance_atomic`);

  if (snapshot.account_state === 'uninit') {
    checkRequiredStateInitHash(issues, manifest, addressKey, contractKey);
    return;
  }

  if (snapshot.account_state !== undefined && snapshot.account_state !== 'active') {
    issues.push(issue(`${contractKey.toUpperCase()}_ACCOUNT_STATE_INVALID`, `${contractKey}.account_state must be active or uninit.`));
  }
  checkBase(issues, manifest, snapshot, contractKey, addressKey, 'ath_wallet');
  addAddressEq(issues, ownerMismatchCode, snapshot.owner_address ?? '', ownerAddress, `${contractKey}.owner_address`);
  addAddressEq(issues, masterMismatchCode, snapshot.ath_master_address ?? '', manifest.addresses.ath_master, `${contractKey}.ath_master_address`);
}

function checkSealed(issues: Issue[], manifest: ManifestLike, snapshot: BaseSnapshot, contractKey: string) {
  addTrue(issues, `${contractKey.toUpperCase()}_NOT_SEALED`, snapshot.sealed, `${contractKey}.sealed`);
  addEq(issues, `${contractKey.toUpperCase()}_MANIFEST_HASH_MISMATCH`, snapshot.deployment_manifest_hash, manifest.manifest_hash_hex, `${contractKey}.deployment_manifest_hash`);
}

export function createMainnetGenesisVerifyInputTemplate(): MainnetGenesisVerifyInput {
  const requiredManifest: ManifestLike = {
    profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
    version: 1,
    status: 'FINAL_GENESIS',
    manifest_hash_hex: 'required: 64 lowercase hex final manifest hash',
    addresses: {
      ath_master: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
      ath_long_term_vesting: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_ADDRESS',
      ath_long_term_vesting_beneficiary: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_BENEFICIARY_ADDRESS',
      ath_long_term_vesting_official_ath_wallet: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_ADDRESS',
      ath_treasury_owner: 'REQUIRED_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
      ath_treasury_owner_ath_wallet: 'REQUIRED_MAINNET_ATH_TREASURY_OWNER_ATH_WALLET_ADDRESS',
      vault: 'REQUIRED_MAINNET_VAULT_ADDRESS',
      vault_official_ath_wallet: 'REQUIRED_MAINNET_VAULT_OFFICIAL_ATH_WALLET_ADDRESS',
      market_stability_seller: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
      market_stability_seller_initial_genesis_controller: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_LAUNCH_CONTROLLER_ADDRESS',
      market_stability_seller_official_ath_wallet: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
      market_stability_reserve_funder: 'REQUIRED_MAINNET_MARKET_STABILITY_RESERVE_FUNDER_ADDRESS',
      market_stability_ton_treasury_receiver: 'REQUIRED_MAINNET_MARKET_STABILITY_TON_TREASURY_RECEIVER_ADDRESS',
      capsulehub: 'REQUIRED_MAINNET_CAPSULEHUB_ADDRESS',
      fee_accumulator: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
      fee_accumulator_ton_treasury_receiver: 'REQUIRED_MAINNET_TON_TREASURY_RECEIVER_ADDRESS',
      buyback_burn: 'REQUIRED_MAINNET_BUYBACKBURN_ADDRESS',
      buyback_burn_initial_genesis_controller: 'REQUIRED_MAINNET_BUYBACKBURN_LAUNCH_CONTROLLER_ADDRESS',
      buyback_burn_official_ath_wallet: 'REQUIRED_MAINNET_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
      username_registry: 'REQUIRED_MAINNET_USERNAME_REGISTRY_ADDRESS',
      username_registry_official_ath_wallet: 'REQUIRED_MAINNET_USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
      treasury_ath_receiver: 'REQUIRED_MAINNET_USERNAME_TREASURY_ATH_RECEIVER_ADDRESS',
      profile_registry: 'REQUIRED_MAINNET_PROFILE_REGISTRY_ADDRESS',
      profile_registry_official_ath_wallet: 'REQUIRED_MAINNET_PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
      profile_registry_treasury_ath_receiver: 'REQUIRED_MAINNET_PROFILE_TREASURY_ATH_RECEIVER_ADDRESS',
    },
    code_hashes: {
      ath_master: 'required: current ATHMaster code hash',
      ath_vesting: 'required: current ATHVesting code hash',
      ath_wallet: 'required: current ATHWallet code hash',
      vault: 'required: current Vault code hash',
      market_stability_seller: 'required: current MarketStabilitySeller code hash',
      capsulehub: 'required: current CapsuleHub code hash',
      username_nft_item: 'required: current UsernameNFTItem code hash',
      username_registry: 'required: current UsernameRegistry code hash',
      profile_registry: 'required: current ProfileRegistry code hash',
      buyback_burn: 'required: current BuybackBurn code hash',
      fee_accumulator: 'required: current FeeAccumulator code hash',
    },
    state_init_hashes: {
      ath_master: 'required: 64 lowercase hex ATHMaster StateInit hash',
      ath_treasury_owner_ath_wallet: 'required: 64 lowercase hex Treasury Owner ATHWallet StateInit hash',
      ath_long_term_vesting: 'required: 64 lowercase hex ATHVesting StateInit hash',
      ath_long_term_vesting_official_ath_wallet: 'required: 64 lowercase hex ATHVesting official ATHWallet StateInit hash',
      vault: 'required: 64 lowercase hex Vault StateInit hash',
      vault_official_ath_wallet: 'required: 64 lowercase hex Vault official ATHWallet StateInit hash',
      capsulehub: 'required: 64 lowercase hex CapsuleHub StateInit hash',
      fee_accumulator: 'required: 64 lowercase hex FeeAccumulator StateInit hash',
      buyback_burn: 'required: 64 lowercase hex BuybackBurn StateInit hash',
      buyback_burn_official_ath_wallet: 'required: 64 lowercase hex BuybackBurn official ATHWallet StateInit hash',
      market_stability_seller: 'required: 64 lowercase hex MarketStabilitySeller StateInit hash',
      market_stability_seller_official_ath_wallet: 'required: 64 lowercase hex MarketStabilitySeller official ATHWallet StateInit hash',
      username_registry: 'required: 64 lowercase hex UsernameRegistry StateInit hash',
      username_registry_official_ath_wallet: 'required: 64 lowercase hex UsernameRegistry official ATHWallet StateInit hash',
      profile_registry: 'required: 64 lowercase hex ProfileRegistry StateInit hash',
      profile_registry_official_ath_wallet: 'required: 64 lowercase hex ProfileRegistry official ATHWallet StateInit hash',
    },
    constants: {
      ath_total_supply_atomic: 'required: decimal atomic ATH amount',
      vault_activity_airdrop_total_atomic: 'required: decimal atomic ATH amount',
      ath_long_term_vesting_allocation_atomic: 'required: decimal atomic ATH amount',
      ath_long_term_vesting_period_count: 'required: decimal period count',
      ath_long_term_vesting_period_seconds: 'required: decimal period duration seconds',
      ath_long_term_vesting_period_unlock_amount_atomic: 'required: decimal atomic ATH amount',
      ath_long_term_vesting_start_time_unix: 'required: decimal unix timestamp',
      ath_market_stability_reserve_allocation_atomic: 'required: decimal atomic ATH amount',
    },
    blockers_before_final_genesis: [],
  };

  const base = {
    address: 'REQUIRED_MAINNET_CONTRACT_ADDRESS',
    code_hash: 'required: current contract code hash',
    sealed: true,
    deployment_manifest_hash: 'required: final manifest hash',
  };

  return {
    document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_INPUT',
    network: 'mainnet',
    manifest: requiredManifest,
    snapshot: {
      ath_master: {
        address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        code_hash: 'required: current ATHMaster code hash',
        total_supply_atomic: 'required: decimal total_supply from get_jetton_data',
        treasury_owner_address: 'REQUIRED_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
        treasury_supply_deployed: true,
      },
      vault: {
        ...base,
        address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        capsule_hub_bound: true,
        capsule_hub_address: 'REQUIRED_MAINNET_CAPSULEHUB_ADDRESS',
        profile_registry_bound: true,
        profile_registry_address: 'REQUIRED_MAINNET_PROFILE_REGISTRY_ADDRESS',
        username_registry_bound: true,
        username_registry_address: 'REQUIRED_MAINNET_USERNAME_REGISTRY_ADDRESS',
        vault_ath_wallet_address: 'REQUIRED_MAINNET_VAULT_OFFICIAL_ATH_WALLET_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        user_count: '0',
        key_record_count: '0',
        receive_intent_count: '0',
        pending_ath_withdrawal_count: '0',
        pending_publish_count: '0',
        processed_ath_deposit_count: '0',
        airdrop_remaining_ath: 'required: full activity airdrop allocation',
        airdrop_distributed_ath: '0',
      },
      vault_official_ath_wallet: {
        address: 'REQUIRED_MAINNET_VAULT_OFFICIAL_ATH_WALLET_ADDRESS',
        account_state: 'active',
        code_hash: 'required: current ATHWallet code hash',
        owner_address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: 'required: decimal ATH balance from get_wallet_data',
      },
      ath_treasury_owner_ath_wallet: {
        address: 'REQUIRED_MAINNET_ATH_TREASURY_OWNER_ATH_WALLET_ADDRESS',
        account_state: 'active',
        code_hash: 'required: current ATHWallet code hash',
        owner_address: 'REQUIRED_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: 'required: exact remaining 75M ATH genesis custody balance',
      },
      ath_long_term_vesting: {
        address: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_ADDRESS',
        code_hash: 'required: current ATHVesting code hash',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        beneficiary_address: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_BENEFICIARY_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_ADDRESS',
        start_time: 'required: decimal vesting start unix timestamp',
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
        address: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_ADDRESS',
        account_state: 'active',
        code_hash: 'required: current ATHWallet code hash',
        owner_address: 'REQUIRED_MAINNET_ATH_LONG_TERM_VESTING_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: 'required: exact 10M ATH vesting backing',
      },
      market_stability_seller: {
        ...base,
        address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
        reserve_funder_address: 'REQUIRED_MAINNET_MARKET_STABILITY_RESERVE_FUNDER_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
        ton_treasury_receiver_address: 'REQUIRED_MAINNET_MARKET_STABILITY_TON_TREASURY_RECEIVER_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        genesis_config_hash: 'required: 64 lowercase hex market stability launch controller hash',
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
        address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
        account_state: 'uninit',
        code_hash: '',
        owner_address: 'optional when uninit; if active, REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
        ath_master_address: 'optional when uninit; if active, REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: '0',
      },
      capsulehub: {
        ...base,
        address: 'REQUIRED_MAINNET_CAPSULEHUB_ADDRESS',
        ton_balance: 'required: decimal raw account TON balance in nanotons; no genesis reserve prefund is required',
        vault_bound: true,
        vault_address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        fee_accumulator_address: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
        private_latest_id: '0',
        public_latest_id: '0',
        accrued_plato_fee_ton: '0',
      },
      username_registry: {
        ...base,
        address: 'REQUIRED_MAINNET_USERNAME_REGISTRY_ADDRESS',
        official_ath_wallet_bound: true,
        official_ath_wallet_address: 'REQUIRED_MAINNET_USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
        vault_bound: true,
        vault_address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        treasury_ath_receiver: 'REQUIRED_MAINNET_USERNAME_TREASURY_ATH_RECEIVER_ADDRESS',
        name_record_count: '0',
        pending_mint_count: '0',
        refund_due_count: '0',
        treasury_due_ath: '0',
        burn_due_ath: '0',
        pending_refund_flush_count: '0',
        pending_treasury_flush_count: '0',
        pending_burn_flush_count: '0',
      },
      username_registry_official_ath_wallet: {
        address: 'REQUIRED_MAINNET_USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
        account_state: 'uninit',
        code_hash: '',
        owner_address: 'optional when uninit; if active, REQUIRED_MAINNET_USERNAME_REGISTRY_ADDRESS',
        ath_master_address: 'optional when uninit; if active, REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: '0',
      },
      profile_registry: {
        ...base,
        address: 'REQUIRED_MAINNET_PROFILE_REGISTRY_ADDRESS',
        official_ath_wallet_bound: true,
        official_ath_wallet_address: 'REQUIRED_MAINNET_PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
        vault_bound: true,
        vault_address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        treasury_ath_receiver: 'REQUIRED_MAINNET_PROFILE_TREASURY_ATH_RECEIVER_ADDRESS',
        profile_count: '0',
        avatar_record_count: '0',
        treasury_due_ath: '0',
        burn_due_ath: '0',
        pending_treasury_flush_count: '0',
        pending_burn_flush_count: '0',
      },
      profile_registry_official_ath_wallet: {
        address: 'REQUIRED_MAINNET_PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
        account_state: 'uninit',
        code_hash: '',
        owner_address: 'optional when uninit; if active, REQUIRED_MAINNET_PROFILE_REGISTRY_ADDRESS',
        ath_master_address: 'optional when uninit; if active, REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: '0',
      },
      buyback_burn: {
        ...base,
        address: 'REQUIRED_MAINNET_BUYBACKBURN_ADDRESS',
        fee_accumulator_address: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        genesis_config_hash: 'required: 64 lowercase hex buyback launch controller hash',
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
        address: 'REQUIRED_MAINNET_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
        account_state: 'uninit',
        code_hash: '',
        owner_address: 'optional when uninit; if active, REQUIRED_MAINNET_BUYBACKBURN_ADDRESS',
        ath_master_address: 'optional when uninit; if active, REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: '0',
      },
      fee_accumulator: {
        address: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
        code_hash: 'required: current FeeAccumulator code hash',
        buyback_burn_address: 'REQUIRED_MAINNET_BUYBACKBURN_ADDRESS',
        ton_treasury_receiver: 'REQUIRED_MAINNET_TON_TREASURY_RECEIVER_ADDRESS',
        buyback_split_enabled: false,
        accumulated_ton: '0',
        treasury_due_ton: '0',
        buyback_due_ton: '0',
      },
    },
    evidenceRefs: {
      getterSnapshotSource: 'required: immutable getter snapshot path/hash',
      codeHashProofSource: 'required: immutable code hash proof path/hash',
      finalManifestSource: 'required: immutable final manifest path/hash',
    },
  };
}

export function verifyMainnetGenesisSnapshot(
  input: MainnetGenesisVerifyInput | null,
  metadata: GenesisVerifyInputMetadata = {},
): MainnetGenesisVerifyReport {
  if (!input) {
    return {
      document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_REPORT',
      status: 'BLOCKED_MISSING_INPUT',
      generated_at: 'DETERMINISTIC_ARTIFACT',
      mainnet_genesis_verified: false,
      input_source: metadata.inputSource ?? null,
      input_sha256: metadata.inputSha256 ?? null,
      evidence_refs: null,
      issue_codes: ['MISSING_INPUT'],
      issues: [issue('MISSING_INPUT', 'Supply a final mainnet genesis getter snapshot input.')],
      checked_manifest_hash: null,
    };
  }

  const issues: Issue[] = [];
  const manifest = input.manifest;

  if (input.document !== 'PLATHO.V1.MAINNET_GENESIS_VERIFY_INPUT') issues.push(issue('BAD_DOCUMENT_TYPE', 'Input document type is invalid.'));
  if (input.network !== 'mainnet') issues.push(issue('NETWORK_NOT_MAINNET', 'Genesis verifier only accepts mainnet snapshots.'));
  if (manifest.status !== 'FINAL_GENESIS') issues.push(issue('MANIFEST_NOT_FINAL_GENESIS', 'Manifest status must be FINAL_GENESIS.'));
  if (!isHex64(manifest.manifest_hash_hex)) issues.push(issue('BAD_MANIFEST_HASH', 'manifest_hash_hex must be a 32-byte lowercase hex hash.'));
  if ((manifest.blockers_before_final_genesis ?? []).length > 0) issues.push(issue('FINAL_GENESIS_BLOCKERS_NOT_EMPTY', 'Final manifest must not contain open blockers.'));
  addManifestHashCheck(issues, manifest);

  for (const [key, value] of Object.entries(manifest.addresses ?? {})) {
    if (!isParseableMainnetAddress(value)) issues.push(issue(`BAD_MANIFEST_ADDRESS_${key.toUpperCase()}`, `${key} must be a parseable mainnet address.`));
  }
  addDistinctManifestAddresses(
    issues,
    manifest,
    ['vault', 'capsulehub', 'profile_registry', 'username_registry'],
    'FINAL_GENESIS_CORE_CONTRACT_ADDRESS_COLLISION',
  );
  const manifestBasechainChecks: [string, string][] = [
    ['ath_master', 'ATH_MASTER_NOT_BASECHAIN'],
    ['ath_long_term_vesting', 'ATH_LONG_TERM_VESTING_NOT_BASECHAIN'],
    ['ath_long_term_vesting_beneficiary', 'ATH_LONG_TERM_VESTING_BENEFICIARY_NOT_BASECHAIN'],
    ['ath_long_term_vesting_official_ath_wallet', 'ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_NOT_BASECHAIN'],
    ['ath_treasury_owner', 'ATH_TREASURY_OWNER_NOT_BASECHAIN'],
    ['ath_treasury_owner_ath_wallet', 'ATH_TREASURY_OWNER_ATH_WALLET_NOT_BASECHAIN'],
    ['genesis_controller_one_shot', 'GENESIS_CONTROLLER_ONE_SHOT_NOT_BASECHAIN'],
    ['vault', 'VAULT_NOT_BASECHAIN'],
    ['vault_official_ath_wallet', 'VAULT_OFFICIAL_ATH_WALLET_NOT_BASECHAIN'],
    ['capsulehub', 'CAPSULEHUB_NOT_BASECHAIN'],
    ['fee_accumulator', 'FEE_ACCUMULATOR_NOT_BASECHAIN'],
    ['buyback_burn', 'BUYBACK_BURN_NOT_BASECHAIN'],
    ['buyback_burn_initial_genesis_controller', 'BUYBACK_BURN_INITIAL_GENESIS_CONTROLLER_NOT_BASECHAIN'],
    ['buyback_burn_official_ath_wallet', 'BUYBACK_BURN_OFFICIAL_ATH_WALLET_NOT_BASECHAIN'],
    ['market_stability_seller', 'MARKET_STABILITY_SELLER_NOT_BASECHAIN'],
    ['market_stability_seller_initial_genesis_controller', 'MARKET_STABILITY_SELLER_INITIAL_GENESIS_CONTROLLER_NOT_BASECHAIN'],
    ['market_stability_seller_official_ath_wallet', 'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_NOT_BASECHAIN'],
    ['username_registry', 'USERNAME_REGISTRY_NOT_BASECHAIN'],
    ['username_registry_official_ath_wallet', 'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BASECHAIN'],
    ['profile_registry', 'PROFILE_REGISTRY_NOT_BASECHAIN'],
    ['profile_registry_official_ath_wallet', 'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BASECHAIN'],
    ['treasury_ath_receiver', 'TREASURY_ATH_RECEIVER_NOT_BASECHAIN'],
    ['profile_registry_treasury_ath_receiver', 'PROFILE_REGISTRY_TREASURY_ATH_RECEIVER_NOT_BASECHAIN'],
    ['fee_accumulator_ton_treasury_receiver', 'FEE_ACCUMULATOR_TON_TREASURY_NOT_BASECHAIN'],
    ['market_stability_reserve_funder', 'MARKET_STABILITY_RESERVE_FUNDER_NOT_BASECHAIN'],
    ['market_stability_ton_treasury_receiver', 'MARKET_STABILITY_TON_TREASURY_NOT_BASECHAIN'],
  ];
  for (const [key, code] of manifestBasechainChecks) {
    addBasechainAddress(issues, code, manifest.addresses?.[key], `manifest.addresses.${key}`);
  }
  addManifestTreasuryReceiverNotProtocolOwned(
    issues,
    manifest,
    'treasury_ath_receiver',
    'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_PROTOCOL_ROLE',
  );
  addManifestTreasuryReceiverNotProtocolOwned(
    issues,
    manifest,
    'profile_registry_treasury_ath_receiver',
    'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_PROTOCOL_ROLE',
  );
  addManifestTreasuryReceiverNotProtocolOwned(
    issues,
    manifest,
    'fee_accumulator_ton_treasury_receiver',
    'FEE_ACCUMULATOR_TON_TREASURY_IS_PROTOCOL_ROLE',
  );
  addManifestTreasuryReceiverNotProtocolOwned(
    issues,
    manifest,
    'market_stability_ton_treasury_receiver',
    'MARKET_STABILITY_TON_TREASURY_IS_PROTOCOL_ROLE',
  );
  addManifestTreasuryReceiverNotProtocolOwned(
    issues,
    manifest,
    'market_stability_reserve_funder',
    'MARKET_STABILITY_RESERVE_FUNDER_IS_PROTOCOL_ROLE',
  );
  for (const [key, value] of Object.entries(manifest.code_hashes ?? {})) {
    if (!isHex64(value)) issues.push(issue(`BAD_MANIFEST_CODE_HASH_${key.toUpperCase()}`, `${key} code hash must be 32-byte hex.`));
  }
  const athTotalSupply = manifest.constants?.ath_total_supply_atomic;
  if (!isDecimalString(athTotalSupply)) {
    issues.push(issue('BAD_ATH_TOTAL_SUPPLY', 'manifest.constants.ath_total_supply_atomic must be a decimal atomic ATH string.'));
  } else {
    addDecimalEq(
      issues,
      'ATH_TOTAL_SUPPLY_CONSTANT_MISMATCH',
      athTotalSupply,
      EXPECTED_ATH_TOTAL_SUPPLY_ATOMIC,
      'manifest.constants.ath_total_supply_atomic',
    );
  }
  const vaultActivityAirdropTotal = manifest.constants?.vault_activity_airdrop_total_atomic;
  if (!isDecimalString(vaultActivityAirdropTotal)) {
    issues.push(issue('BAD_VAULT_ACTIVITY_AIRDROP_TOTAL', 'manifest.constants.vault_activity_airdrop_total_atomic must be a decimal atomic ATH string.'));
  } else {
    addDecimalEq(
      issues,
      'VAULT_ACTIVITY_AIRDROP_TOTAL_CONSTANT_MISMATCH',
      vaultActivityAirdropTotal,
      EXPECTED_VAULT_ACTIVITY_AIRDROP_TOTAL_ATOMIC,
      'manifest.constants.vault_activity_airdrop_total_atomic',
    );
  }
  const marketStabilityReserveTotal = manifest.constants?.ath_market_stability_reserve_allocation_atomic;
  if (!isDecimalString(marketStabilityReserveTotal)) {
    issues.push(issue('BAD_MARKET_STABILITY_RESERVE_TOTAL', 'manifest.constants.ath_market_stability_reserve_allocation_atomic must be a decimal atomic ATH string.'));
  } else {
    addDecimalEq(
      issues,
      'MARKET_STABILITY_RESERVE_CONSTANT_MISMATCH',
      marketStabilityReserveTotal,
      EXPECTED_MARKET_STABILITY_RESERVE_ATOMIC,
      'manifest.constants.ath_market_stability_reserve_allocation_atomic',
    );
  }
  const longTermVestingTotal = manifest.constants?.ath_long_term_vesting_allocation_atomic;
  if (!isDecimalString(longTermVestingTotal)) {
    issues.push(issue('BAD_ATH_LONG_TERM_VESTING_TOTAL', 'manifest.constants.ath_long_term_vesting_allocation_atomic must be a decimal atomic ATH string.'));
  } else {
    addDecimalEq(
      issues,
      'ATH_LONG_TERM_VESTING_CONSTANT_MISMATCH',
      longTermVestingTotal,
      EXPECTED_ATH_LONG_TERM_VESTING_ATOMIC,
      'manifest.constants.ath_long_term_vesting_allocation_atomic',
    );
  }
  addDecimalEq(
    issues,
    'ATH_LONG_TERM_VESTING_PERIOD_COUNT_MISMATCH',
    manifest.constants?.ath_long_term_vesting_period_count,
    EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_COUNT,
    'manifest.constants.ath_long_term_vesting_period_count',
  );
  addDecimalEq(
    issues,
    'ATH_LONG_TERM_VESTING_PERIOD_SECONDS_MISMATCH',
    manifest.constants?.ath_long_term_vesting_period_seconds,
    EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_SECONDS,
    'manifest.constants.ath_long_term_vesting_period_seconds',
  );
  addDecimalEq(
    issues,
    'ATH_LONG_TERM_VESTING_PERIOD_UNLOCK_MISMATCH',
    manifest.constants?.ath_long_term_vesting_period_unlock_amount_atomic,
    EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_UNLOCK_ATOMIC,
    'manifest.constants.ath_long_term_vesting_period_unlock_amount_atomic',
  );
  if (!isDecimalString(manifest.constants?.ath_long_term_vesting_start_time_unix)) {
    issues.push(issue('BAD_ATH_LONG_TERM_VESTING_START_TIME', 'manifest.constants.ath_long_term_vesting_start_time_unix must be a decimal unix timestamp.'));
  }

  const s = input.snapshot;
  const snapshotBasechainChecks: [string, unknown, string][] = [
    ['ATH_MASTER_ADDRESS_NOT_BASECHAIN', (s as any).ath_master?.address, 'ath_master.address'],
    ['ATH_LONG_TERM_VESTING_ADDRESS_NOT_BASECHAIN', (s as any).ath_long_term_vesting?.address, 'ath_long_term_vesting.address'],
    ['ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).ath_long_term_vesting_official_ath_wallet?.address, 'ath_long_term_vesting_official_ath_wallet.address'],
    ['ATH_TREASURY_OWNER_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).ath_treasury_owner_ath_wallet?.address, 'ath_treasury_owner_ath_wallet.address'],
    ['VAULT_ADDRESS_NOT_BASECHAIN', (s as any).vault?.address, 'vault.address'],
    ['VAULT_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).vault_official_ath_wallet?.address, 'vault_official_ath_wallet.address'],
    ['CAPSULEHUB_ADDRESS_NOT_BASECHAIN', (s as any).capsulehub?.address, 'capsulehub.address'],
    ['FEE_ACCUMULATOR_ADDRESS_NOT_BASECHAIN', (s as any).fee_accumulator?.address, 'fee_accumulator.address'],
    ['BUYBACK_BURN_ADDRESS_NOT_BASECHAIN', (s as any).buyback_burn?.address, 'buyback_burn.address'],
    ['BUYBACK_BURN_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).buyback_burn_official_ath_wallet?.address, 'buyback_burn_official_ath_wallet.address'],
    ['MARKET_STABILITY_SELLER_ADDRESS_NOT_BASECHAIN', (s as any).market_stability_seller?.address, 'market_stability_seller.address'],
    ['MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).market_stability_seller_official_ath_wallet?.address, 'market_stability_seller_official_ath_wallet.address'],
    ['USERNAME_REGISTRY_ADDRESS_NOT_BASECHAIN', (s as any).username_registry?.address, 'username_registry.address'],
    ['USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).username_registry_official_ath_wallet?.address, 'username_registry_official_ath_wallet.address'],
    ['PROFILE_REGISTRY_ADDRESS_NOT_BASECHAIN', (s as any).profile_registry?.address, 'profile_registry.address'],
    ['PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS_NOT_BASECHAIN', (s as any).profile_registry_official_ath_wallet?.address, 'profile_registry_official_ath_wallet.address'],
  ];
  for (const [code, value, label] of snapshotBasechainChecks) {
    addBasechainAddress(issues, code, value, label);
  }

  checkBase(issues, manifest, s.ath_master, 'ath_master', 'ath_master', 'ath_master');
  addAddressEq(issues, 'ATH_MASTER_TREASURY_OWNER_MISMATCH', s.ath_master.treasury_owner_address, manifest.addresses.ath_treasury_owner, 'ath_master.treasury_owner_address');
  addBasechainAddress(issues, 'ATH_MASTER_TREASURY_OWNER_NOT_BASECHAIN', s.ath_master.treasury_owner_address, 'ath_master.treasury_owner_address');
  if (isDecimalString(athTotalSupply)) {
    addDecimalEq(
      issues,
      'ATH_MASTER_TOTAL_SUPPLY_MISMATCH',
      s.ath_master.total_supply_atomic,
      athTotalSupply,
      'ath_master.total_supply_atomic',
    );
  }
  addTrue(issues, 'ATH_TREASURY_SUPPLY_NOT_DEPLOYED', s.ath_master.treasury_supply_deployed, 'ath_master.treasury_supply_deployed');

  checkBase(issues, manifest, s.vault, 'vault', 'vault', 'vault');
  checkSealed(issues, manifest, s.vault, 'vault');
  addTrue(issues, 'VAULT_CAPSULE_HUB_NOT_BOUND', s.vault.capsule_hub_bound, 'vault.capsule_hub_bound');
  addAddressEq(issues, 'VAULT_CAPSULE_HUB_ADDRESS_MISMATCH', s.vault.capsule_hub_address, manifest.addresses.capsulehub, 'vault.capsule_hub_address');
  addTrue(issues, 'VAULT_PROFILE_REGISTRY_NOT_BOUND', s.vault.profile_registry_bound, 'vault.profile_registry_bound');
  addAddressEq(issues, 'VAULT_PROFILE_REGISTRY_ADDRESS_MISMATCH', s.vault.profile_registry_address, manifest.addresses.profile_registry, 'vault.profile_registry_address');
  addBasechainAddress(issues, 'VAULT_PROFILE_REGISTRY_ADDRESS_NOT_BASECHAIN', s.vault.profile_registry_address, 'vault.profile_registry_address');
  addTrue(issues, 'VAULT_USERNAME_REGISTRY_NOT_BOUND', s.vault.username_registry_bound, 'vault.username_registry_bound');
  addAddressEq(issues, 'VAULT_USERNAME_REGISTRY_ADDRESS_MISMATCH', s.vault.username_registry_address, manifest.addresses.username_registry, 'vault.username_registry_address');
  addBasechainAddress(issues, 'VAULT_USERNAME_REGISTRY_ADDRESS_NOT_BASECHAIN', s.vault.username_registry_address, 'vault.username_registry_address');
  addAddressEq(issues, 'VAULT_OFFICIAL_ATH_WALLET_MISMATCH', s.vault.vault_ath_wallet_address, manifest.addresses.vault_official_ath_wallet, 'vault.vault_ath_wallet_address');
  addAddressEq(issues, 'VAULT_ATH_MASTER_MISMATCH', s.vault.ath_master_address, manifest.addresses.ath_master, 'vault.ath_master_address');
  addDecimalZero(issues, 'VAULT_USER_COUNT_NOT_ZERO_AT_GENESIS', s.vault.user_count, 'vault.user_count');
  addDecimalZero(issues, 'VAULT_KEY_RECORD_COUNT_NOT_ZERO_AT_GENESIS', s.vault.key_record_count, 'vault.key_record_count');
  addDecimalZero(issues, 'VAULT_RECEIVE_INTENT_COUNT_NOT_ZERO_AT_GENESIS', s.vault.receive_intent_count, 'vault.receive_intent_count');
  addDecimalZero(issues, 'VAULT_PENDING_ATH_WITHDRAWAL_COUNT_NOT_ZERO_AT_GENESIS', s.vault.pending_ath_withdrawal_count, 'vault.pending_ath_withdrawal_count');
  addDecimalZero(issues, 'VAULT_PENDING_PUBLISH_COUNT_NOT_ZERO_AT_GENESIS', s.vault.pending_publish_count, 'vault.pending_publish_count');
  addDecimalZero(issues, 'VAULT_PROCESSED_ATH_DEPOSIT_COUNT_NOT_ZERO_AT_GENESIS', s.vault.processed_ath_deposit_count, 'vault.processed_ath_deposit_count');
  if (isDecimalString(vaultActivityAirdropTotal)) {
    addDecimalEq(
      issues,
      'VAULT_AIRDROP_REMAINING_NOT_FULL_AT_GENESIS',
      s.vault.airdrop_remaining_ath,
      vaultActivityAirdropTotal,
      'vault.airdrop_remaining_ath',
    );
  }
  addDecimalZero(issues, 'VAULT_AIRDROP_DISTRIBUTED_NOT_ZERO_AT_GENESIS', s.vault.airdrop_distributed_ath, 'vault.airdrop_distributed_ath');

  const vaultOfficialAthWallet = (s as any).vault_official_ath_wallet ?? {
    address: '',
    code_hash: '',
    owner_address: '',
    ath_master_address: '',
    balance_atomic: '',
  };
  if (!(s as any).vault_official_ath_wallet) {
    issues.push(issue('MISSING_VAULT_OFFICIAL_ATH_WALLET_SNAPSHOT', 'snapshot.vault_official_ath_wallet getter data is required.'));
  }
  checkFundedOfficialAthWallet(
    issues,
    manifest,
    vaultOfficialAthWallet,
    'vault_official_ath_wallet',
    'vault_official_ath_wallet',
    manifest.addresses.vault,
    vaultActivityAirdropTotal ?? '',
    'VAULT_ACTIVITY_AIRDROP_BACKING_BALANCE_NOT_EXACT',
  );

  const athTreasuryOwnerAthWallet = (s as any).ath_treasury_owner_ath_wallet ?? {
    address: '',
    code_hash: '',
    owner_address: '',
    ath_master_address: '',
    balance_atomic: '',
  };
  if (!(s as any).ath_treasury_owner_ath_wallet) {
    issues.push(issue('MISSING_ATH_TREASURY_OWNER_ATH_WALLET_SNAPSHOT', 'snapshot.ath_treasury_owner_ath_wallet getter data is required to prove custody of the remaining 75M ATH at final genesis.'));
  }
  checkFundedOfficialAthWallet(
    issues,
    manifest,
    athTreasuryOwnerAthWallet,
    'ath_treasury_owner_ath_wallet',
    'ath_treasury_owner_ath_wallet',
    manifest.addresses.ath_treasury_owner,
    EXPECTED_ATH_TREASURY_OWNER_REMAINING_ATOMIC,
    'ATH_TREASURY_OWNER_REMAINING_BALANCE_NOT_EXACT',
  );

  const athLongTermVesting = (s as any).ath_long_term_vesting ?? {
    address: '',
    code_hash: '',
    sealed: false,
    deployment_manifest_hash: '',
    ath_master_address: '',
    beneficiary_address: '',
    official_ath_wallet_address: '',
    start_time: '',
    period_seconds: '',
    period_count: '',
    period_unlock_amount: '',
    total_amount: '',
    phase: '',
    claimed_ath: '',
    vested_ath: '',
    claimable_ath: '',
    pending_query_id: '',
    pending_amount: '',
    pending_created_at: '',
    last_terminal_query_id: '',
  };
  if (!(s as any).ath_long_term_vesting) {
    issues.push(issue('MISSING_ATH_LONG_TERM_VESTING_SNAPSHOT', 'snapshot.ath_long_term_vesting getter data is required.'));
  }
  checkBase(issues, manifest, athLongTermVesting, 'ath_long_term_vesting', 'ath_long_term_vesting', 'ath_vesting');
  addAddressEq(issues, 'ATH_LONG_TERM_VESTING_ATH_MASTER_MISMATCH', athLongTermVesting.ath_master_address, manifest.addresses.ath_master, 'ath_long_term_vesting.ath_master_address');
  addAddressEq(issues, 'ATH_LONG_TERM_VESTING_BENEFICIARY_MISMATCH', athLongTermVesting.beneficiary_address, manifest.addresses.ath_long_term_vesting_beneficiary, 'ath_long_term_vesting.beneficiary_address');
  addAddressEq(issues, 'ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_MISMATCH', athLongTermVesting.official_ath_wallet_address, manifest.addresses.ath_long_term_vesting_official_ath_wallet, 'ath_long_term_vesting.official_ath_wallet_address');
  addBasechainAddress(issues, 'ATH_LONG_TERM_VESTING_ATH_MASTER_NOT_BASECHAIN', athLongTermVesting.ath_master_address, 'ath_long_term_vesting.ath_master_address');
  addBasechainAddress(issues, 'ATH_LONG_TERM_VESTING_BENEFICIARY_NOT_BASECHAIN', athLongTermVesting.beneficiary_address, 'ath_long_term_vesting.beneficiary_address');
  if (isDecimalString(manifest.constants?.ath_long_term_vesting_start_time_unix)) {
    addDecimalEq(issues, 'ATH_LONG_TERM_VESTING_START_TIME_MISMATCH', athLongTermVesting.start_time, manifest.constants.ath_long_term_vesting_start_time_unix, 'ath_long_term_vesting.start_time');
  }
  addDecimalEq(issues, 'ATH_LONG_TERM_VESTING_PERIOD_SECONDS_STATE_MISMATCH', athLongTermVesting.period_seconds, EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_SECONDS, 'ath_long_term_vesting.period_seconds');
  addDecimalEq(issues, 'ATH_LONG_TERM_VESTING_PERIOD_COUNT_STATE_MISMATCH', athLongTermVesting.period_count, EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_COUNT, 'ath_long_term_vesting.period_count');
  addDecimalEq(issues, 'ATH_LONG_TERM_VESTING_PERIOD_UNLOCK_STATE_MISMATCH', athLongTermVesting.period_unlock_amount, EXPECTED_ATH_LONG_TERM_VESTING_PERIOD_UNLOCK_ATOMIC, 'ath_long_term_vesting.period_unlock_amount');
  if (isDecimalString(longTermVestingTotal)) {
    addDecimalEq(issues, 'ATH_LONG_TERM_VESTING_TOTAL_STATE_MISMATCH', athLongTermVesting.total_amount, longTermVestingTotal, 'ath_long_term_vesting.total_amount');
  }
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_PHASE_NOT_IDLE_AT_GENESIS', athLongTermVesting.phase, 'ath_long_term_vesting.phase');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_CLAIMED_NOT_ZERO_AT_GENESIS', athLongTermVesting.claimed_ath, 'ath_long_term_vesting.claimed_ath');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_VESTED_NOT_ZERO_AT_GENESIS', athLongTermVesting.vested_ath, 'ath_long_term_vesting.vested_ath');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_CLAIMABLE_NOT_ZERO_AT_GENESIS', athLongTermVesting.claimable_ath, 'ath_long_term_vesting.claimable_ath');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_PENDING_QUERY_NOT_ZERO_AT_GENESIS', athLongTermVesting.pending_query_id, 'ath_long_term_vesting.pending_query_id');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_PENDING_AMOUNT_NOT_ZERO_AT_GENESIS', athLongTermVesting.pending_amount, 'ath_long_term_vesting.pending_amount');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_PENDING_CREATED_NOT_ZERO_AT_GENESIS', athLongTermVesting.pending_created_at, 'ath_long_term_vesting.pending_created_at');
  addDecimalZero(issues, 'ATH_LONG_TERM_VESTING_LAST_TERMINAL_QUERY_NOT_ZERO_AT_GENESIS', athLongTermVesting.last_terminal_query_id, 'ath_long_term_vesting.last_terminal_query_id');

  const athLongTermVestingOfficialAthWallet = (s as any).ath_long_term_vesting_official_ath_wallet ?? {
    address: '',
    code_hash: '',
    owner_address: '',
    ath_master_address: '',
    balance_atomic: '',
  };
  if (!(s as any).ath_long_term_vesting_official_ath_wallet) {
    issues.push(issue('MISSING_ATH_LONG_TERM_VESTING_OFFICIAL_ATH_WALLET_SNAPSHOT', 'snapshot.ath_long_term_vesting_official_ath_wallet getter data is required.'));
  }
  checkFundedOfficialAthWallet(
    issues,
    manifest,
    athLongTermVestingOfficialAthWallet,
    'ath_long_term_vesting_official_ath_wallet',
    'ath_long_term_vesting_official_ath_wallet',
    manifest.addresses.ath_long_term_vesting,
    longTermVestingTotal ?? '',
    'ATH_LONG_TERM_VESTING_BACKING_BALANCE_NOT_EXACT',
  );

  const marketSeller = (s as any).market_stability_seller ?? {
    address: '',
    code_hash: '',
    sealed: false,
    deployment_manifest_hash: '',
    reserve_funder_address: '',
    official_ath_wallet_address: '',
    ton_treasury_receiver_address: '',
    ath_master_address: '',
    genesis_config_hash: '',
    pricing_frozen: false,
    reserve_due_ath: '',
    reserve_funded_total_ath: '',
    treasury_due_ton: '',
    sold_ath_total: '',
  };
  if (!(s as any).market_stability_seller) {
    issues.push(issue('MISSING_MARKET_STABILITY_SELLER_SNAPSHOT', 'snapshot.market_stability_seller getter data is required.'));
  }
  checkBase(issues, manifest, marketSeller, 'market_stability_seller', 'market_stability_seller', 'market_stability_seller');
  checkSealed(issues, manifest, marketSeller, 'market_stability_seller');
  if (marketSeller.pricing_frozen !== false) {
    issues.push(issue('MARKET_STABILITY_SELLER_PRICING_FROZEN_AT_GENESIS', 'market_stability_seller.pricing_frozen must be false at final genesis; pricing freezes once after the 15% activity distribution / pool-launch gate.'));
  }
  if (!isHex64(marketSeller.genesis_config_hash) || /^0{64}$/i.test(marketSeller.genesis_config_hash)) {
    issues.push(issue('MARKET_STABILITY_SELLER_LAUNCH_CONTROLLER_HASH_MISSING', 'market_stability_seller.genesis_config_hash must retain the non-zero one-time launch controller hash until post-pool pricing freeze.'));
  } else {
    addAddressHashEq(
      issues,
      'MARKET_STABILITY_SELLER_LAUNCH_CONTROLLER_HASH_MISMATCH',
      marketSeller.genesis_config_hash,
      manifest.addresses.market_stability_seller_initial_genesis_controller,
      'market_stability_seller.genesis_config_hash',
    );
  }
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_RESERVE_FUNDER_MISMATCH', marketSeller.reserve_funder_address, manifest.addresses.market_stability_reserve_funder, 'market_stability_seller.reserve_funder_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_MISMATCH', marketSeller.official_ath_wallet_address, manifest.addresses.market_stability_seller_official_ath_wallet, 'market_stability_seller.official_ath_wallet_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_TON_TREASURY_MISMATCH', marketSeller.ton_treasury_receiver_address, manifest.addresses.market_stability_ton_treasury_receiver, 'market_stability_seller.ton_treasury_receiver_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_ATH_MASTER_MISMATCH', marketSeller.ath_master_address, manifest.addresses.ath_master, 'market_stability_seller.ath_master_address');
  addBasechainAddress(issues, 'MARKET_STABILITY_SELLER_RESERVE_FUNDER_NOT_BASECHAIN', marketSeller.reserve_funder_address, 'market_stability_seller.reserve_funder_address');
  addBasechainAddress(issues, 'MARKET_STABILITY_SELLER_TON_TREASURY_NOT_BASECHAIN', marketSeller.ton_treasury_receiver_address, 'market_stability_seller.ton_treasury_receiver_address');
  addBasechainAddress(issues, 'MARKET_STABILITY_SELLER_ATH_MASTER_NOT_BASECHAIN', marketSeller.ath_master_address, 'market_stability_seller.ath_master_address');
  addDecimalEq(issues, 'MARKET_STABILITY_RESERVE_DUE_NOT_ZERO_AT_GENESIS', marketSeller.reserve_due_ath, '0', 'market_stability_seller.reserve_due_ath');
  addDecimalEq(issues, 'MARKET_STABILITY_RESERVE_FUNDED_TOTAL_NOT_ZERO_AT_GENESIS', marketSeller.reserve_funded_total_ath, '0', 'market_stability_seller.reserve_funded_total_ath');
  addDecimalEq(issues, 'MARKET_STABILITY_TREASURY_DUE_NOT_ZERO_AT_GENESIS', marketSeller.treasury_due_ton, '0', 'market_stability_seller.treasury_due_ton');
  addDecimalEq(issues, 'MARKET_STABILITY_SOLD_TOTAL_NOT_ZERO_AT_GENESIS', marketSeller.sold_ath_total, '0', 'market_stability_seller.sold_ath_total');
  addDecimalZero(issues, 'MARKET_STABILITY_PHASE_NOT_IDLE_AT_GENESIS', marketSeller.phase, 'market_stability_seller.phase');
  addDecimalZero(issues, 'MARKET_STABILITY_PENDING_QUERY_NOT_ZERO_AT_GENESIS', marketSeller.pending_query_id, 'market_stability_seller.pending_query_id');
  addDecimalZero(issues, 'MARKET_STABILITY_PENDING_AMOUNT_NOT_ZERO_AT_GENESIS', marketSeller.pending_amount_ath, 'market_stability_seller.pending_amount_ath');
  addDecimalZero(issues, 'MARKET_STABILITY_PENDING_PAID_NOT_ZERO_AT_GENESIS', marketSeller.pending_paid_ton, 'market_stability_seller.pending_paid_ton');
  addDecimalZero(issues, 'MARKET_STABILITY_COMPLETED_TRANCHE_COUNT_NOT_ZERO_AT_GENESIS', marketSeller.completed_tranche_count, 'market_stability_seller.completed_tranche_count');
  addDecimalZero(issues, 'MARKET_STABILITY_CURRENT_TRANCHE_SOLD_NOT_ZERO_AT_GENESIS', marketSeller.current_tranche_sold_ath, 'market_stability_seller.current_tranche_sold_ath');
  addDecimalZero(issues, 'MARKET_STABILITY_LAST_TERMINAL_QUERY_NOT_ZERO_AT_GENESIS', marketSeller.last_terminal_query_id, 'market_stability_seller.last_terminal_query_id');
  addDecimalZero(issues, 'MARKET_STABILITY_TREASURY_FLUSHED_NOT_ZERO_AT_GENESIS', marketSeller.treasury_flushed_ton_total, 'market_stability_seller.treasury_flushed_ton_total');

  checkZeroOfficialAthWallet(
    issues,
    manifest,
    (s as any).market_stability_seller_official_ath_wallet,
    'market_stability_seller_official_ath_wallet',
    'market_stability_seller_official_ath_wallet',
    'MISSING_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_SNAPSHOT',
    'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_OWNER_MISMATCH',
    'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_MASTER_MISMATCH',
    'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS',
    manifest.addresses.market_stability_seller,
  );

  checkBase(issues, manifest, s.capsulehub, 'capsulehub', 'capsulehub', 'capsulehub');
  checkSealed(issues, manifest, s.capsulehub, 'capsulehub');
  addTrue(issues, 'CAPSULEHUB_VAULT_NOT_BOUND', s.capsulehub.vault_bound, 'capsulehub.vault_bound');
  addAddressEq(issues, 'CAPSULEHUB_VAULT_ADDRESS_MISMATCH', s.capsulehub.vault_address, manifest.addresses.vault, 'capsulehub.vault_address');
  addAddressEq(issues, 'CAPSULEHUB_FEE_ACCUMULATOR_MISMATCH', s.capsulehub.fee_accumulator_address, manifest.addresses.fee_accumulator, 'capsulehub.fee_accumulator_address');
  addDecimalGte(issues, 'CAPSULEHUB_TON_BALANCE_INVALID_AT_GENESIS', s.capsulehub.ton_balance, '0', 'capsulehub.ton_balance');
  addDecimalZero(issues, 'CAPSULEHUB_PRIVATE_LATEST_NOT_ZERO_AT_GENESIS', s.capsulehub.private_latest_id, 'capsulehub.private_latest_id');
  addDecimalZero(issues, 'CAPSULEHUB_PUBLIC_LATEST_NOT_ZERO_AT_GENESIS', s.capsulehub.public_latest_id, 'capsulehub.public_latest_id');
  addDecimalZero(issues, 'CAPSULEHUB_ACCRUED_PLATO_FEE_NOT_ZERO_AT_GENESIS', s.capsulehub.accrued_plato_fee_ton, 'capsulehub.accrued_plato_fee_ton');

  checkBase(issues, manifest, s.username_registry, 'username_registry', 'username_registry', 'username_registry');
  checkSealed(issues, manifest, s.username_registry, 'username_registry');
  addTrue(issues, 'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BOUND', s.username_registry.official_ath_wallet_bound, 'username_registry.official_ath_wallet_bound');
  addAddressEq(issues, 'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_MISMATCH', s.username_registry.official_ath_wallet_address, manifest.addresses.username_registry_official_ath_wallet, 'username_registry.official_ath_wallet_address');
  addTrue(issues, 'USERNAME_REGISTRY_VAULT_NOT_BOUND', s.username_registry.vault_bound, 'username_registry.vault_bound');
  addAddressEq(issues, 'USERNAME_REGISTRY_VAULT_ADDRESS_MISMATCH', s.username_registry.vault_address, manifest.addresses.vault, 'username_registry.vault_address');
  addBasechainAddress(issues, 'USERNAME_REGISTRY_VAULT_ADDRESS_NOT_BASECHAIN', s.username_registry.vault_address, 'username_registry.vault_address');
  addAddressEq(issues, 'USERNAME_REGISTRY_ATH_MASTER_MISMATCH', s.username_registry.ath_master_address, manifest.addresses.ath_master, 'username_registry.ath_master_address');
  addBasechainAddress(issues, 'USERNAME_REGISTRY_ATH_MASTER_NOT_BASECHAIN', s.username_registry.ath_master_address, 'username_registry.ath_master_address');
  addAddressEq(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_MISMATCH', s.username_registry.treasury_ath_receiver, manifest.addresses.treasury_ath_receiver, 'username_registry.treasury_ath_receiver');
  addBasechainAddress(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_NOT_BASECHAIN', s.username_registry.treasury_ath_receiver, 'username_registry.treasury_ath_receiver');
  addAddressNotEq(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_USERNAME_REGISTRY', s.username_registry.treasury_ath_receiver, manifest.addresses.username_registry, 'username_registry.treasury_ath_receiver', 'username_registry');
  addAddressNotEq(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_OFFICIAL_ATH_WALLET', s.username_registry.treasury_ath_receiver, manifest.addresses.username_registry_official_ath_wallet, 'username_registry.treasury_ath_receiver', 'username_registry_official_ath_wallet');
  addAddressNotEq(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_VAULT', s.username_registry.treasury_ath_receiver, manifest.addresses.vault, 'username_registry.treasury_ath_receiver', 'vault');
  addAddressNotEq(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_IS_ATH_MASTER', s.username_registry.treasury_ath_receiver, manifest.addresses.ath_master, 'username_registry.treasury_ath_receiver', 'ath_master');
  addDecimalZero(issues, 'USERNAME_REGISTRY_NAME_RECORDS_NOT_ZERO_AT_GENESIS', s.username_registry.name_record_count, 'username_registry.name_record_count');
  addDecimalZero(issues, 'USERNAME_REGISTRY_PENDING_MINTS_NOT_ZERO_AT_GENESIS', s.username_registry.pending_mint_count, 'username_registry.pending_mint_count');
  addDecimalZero(issues, 'USERNAME_REGISTRY_REFUND_DUE_NOT_ZERO_AT_GENESIS', s.username_registry.refund_due_count, 'username_registry.refund_due_count');
  addDecimalZero(issues, 'USERNAME_REGISTRY_TREASURY_DUE_NOT_ZERO_AT_GENESIS', s.username_registry.treasury_due_ath, 'username_registry.treasury_due_ath');
  addDecimalZero(issues, 'USERNAME_REGISTRY_BURN_DUE_NOT_ZERO_AT_GENESIS', s.username_registry.burn_due_ath, 'username_registry.burn_due_ath');
  addDecimalZero(issues, 'USERNAME_REGISTRY_PENDING_REFUND_FLUSH_NOT_ZERO_AT_GENESIS', s.username_registry.pending_refund_flush_count, 'username_registry.pending_refund_flush_count');
  addDecimalZero(issues, 'USERNAME_REGISTRY_PENDING_TREASURY_FLUSH_NOT_ZERO_AT_GENESIS', s.username_registry.pending_treasury_flush_count, 'username_registry.pending_treasury_flush_count');
  addDecimalZero(issues, 'USERNAME_REGISTRY_PENDING_BURN_FLUSH_NOT_ZERO_AT_GENESIS', s.username_registry.pending_burn_flush_count, 'username_registry.pending_burn_flush_count');

  checkZeroOfficialAthWallet(
    issues,
    manifest,
    (s as any).username_registry_official_ath_wallet,
    'username_registry_official_ath_wallet',
    'username_registry_official_ath_wallet',
    'MISSING_USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_SNAPSHOT',
    'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_OWNER_MISMATCH',
    'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_MASTER_MISMATCH',
    'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS',
    manifest.addresses.username_registry,
  );

  checkBase(issues, manifest, s.profile_registry, 'profile_registry', 'profile_registry', 'profile_registry');
  checkSealed(issues, manifest, s.profile_registry, 'profile_registry');
  addTrue(issues, 'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_NOT_BOUND', s.profile_registry.official_ath_wallet_bound, 'profile_registry.official_ath_wallet_bound');
  addAddressEq(issues, 'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_MISMATCH', s.profile_registry.official_ath_wallet_address, manifest.addresses.profile_registry_official_ath_wallet, 'profile_registry.official_ath_wallet_address');
  addTrue(issues, 'PROFILE_REGISTRY_VAULT_NOT_BOUND', s.profile_registry.vault_bound, 'profile_registry.vault_bound');
  addAddressEq(issues, 'PROFILE_REGISTRY_VAULT_ADDRESS_MISMATCH', s.profile_registry.vault_address, manifest.addresses.vault, 'profile_registry.vault_address');
  addBasechainAddress(issues, 'PROFILE_REGISTRY_VAULT_ADDRESS_NOT_BASECHAIN', s.profile_registry.vault_address, 'profile_registry.vault_address');
  addAddressEq(issues, 'PROFILE_REGISTRY_ATH_MASTER_MISMATCH', s.profile_registry.ath_master_address, manifest.addresses.ath_master, 'profile_registry.ath_master_address');
  addBasechainAddress(issues, 'PROFILE_REGISTRY_ATH_MASTER_NOT_BASECHAIN', s.profile_registry.ath_master_address, 'profile_registry.ath_master_address');
  addAddressEq(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_MISMATCH', s.profile_registry.treasury_ath_receiver, manifest.addresses.profile_registry_treasury_ath_receiver, 'profile_registry.treasury_ath_receiver');
  addBasechainAddress(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_NOT_BASECHAIN', s.profile_registry.treasury_ath_receiver, 'profile_registry.treasury_ath_receiver');
  addAddressNotEq(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_PROFILE_REGISTRY', s.profile_registry.treasury_ath_receiver, manifest.addresses.profile_registry, 'profile_registry.treasury_ath_receiver', 'profile_registry');
  addAddressNotEq(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_OFFICIAL_ATH_WALLET', s.profile_registry.treasury_ath_receiver, manifest.addresses.profile_registry_official_ath_wallet, 'profile_registry.treasury_ath_receiver', 'profile_registry_official_ath_wallet');
  addAddressNotEq(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_VAULT', s.profile_registry.treasury_ath_receiver, manifest.addresses.vault, 'profile_registry.treasury_ath_receiver', 'vault');
  addAddressNotEq(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_IS_ATH_MASTER', s.profile_registry.treasury_ath_receiver, manifest.addresses.ath_master, 'profile_registry.treasury_ath_receiver', 'ath_master');
  addDecimalZero(issues, 'PROFILE_REGISTRY_PROFILE_COUNT_NOT_ZERO_AT_GENESIS', s.profile_registry.profile_count, 'profile_registry.profile_count');
  addDecimalZero(issues, 'PROFILE_REGISTRY_AVATAR_RECORDS_NOT_ZERO_AT_GENESIS', s.profile_registry.avatar_record_count, 'profile_registry.avatar_record_count');
  addDecimalZero(issues, 'PROFILE_REGISTRY_TREASURY_DUE_NOT_ZERO_AT_GENESIS', s.profile_registry.treasury_due_ath, 'profile_registry.treasury_due_ath');
  addDecimalZero(issues, 'PROFILE_REGISTRY_BURN_DUE_NOT_ZERO_AT_GENESIS', s.profile_registry.burn_due_ath, 'profile_registry.burn_due_ath');
  addDecimalZero(issues, 'PROFILE_REGISTRY_PENDING_TREASURY_FLUSH_NOT_ZERO_AT_GENESIS', s.profile_registry.pending_treasury_flush_count, 'profile_registry.pending_treasury_flush_count');
  addDecimalZero(issues, 'PROFILE_REGISTRY_PENDING_BURN_FLUSH_NOT_ZERO_AT_GENESIS', s.profile_registry.pending_burn_flush_count, 'profile_registry.pending_burn_flush_count');

  checkZeroOfficialAthWallet(
    issues,
    manifest,
    (s as any).profile_registry_official_ath_wallet,
    'profile_registry_official_ath_wallet',
    'profile_registry_official_ath_wallet',
    'MISSING_PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_SNAPSHOT',
    'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_OWNER_MISMATCH',
    'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_MASTER_MISMATCH',
    'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS',
    manifest.addresses.profile_registry,
  );

  checkBase(issues, manifest, s.buyback_burn, 'buyback_burn', 'buyback_burn', 'buyback_burn');
  checkSealed(issues, manifest, s.buyback_burn, 'buyback_burn');
  if (s.buyback_burn.route_frozen !== false) {
    issues.push(issue('BUYBACK_ROUTE_FROZEN_AT_GENESIS', 'buyback_burn.route_frozen must be false at final genesis; the STON.fi route is frozen once after the 15% activity distribution / pool-launch gate.'));
  }
  if (!isHex64(s.buyback_burn.genesis_config_hash) || /^0{64}$/i.test(s.buyback_burn.genesis_config_hash)) {
    issues.push(issue('BUYBACK_LAUNCH_CONTROLLER_HASH_MISSING', 'buyback_burn.genesis_config_hash must retain the non-zero one-time launch controller hash until post-pool route freeze.'));
  } else {
    addAddressHashEq(
      issues,
      'BUYBACK_LAUNCH_CONTROLLER_HASH_MISMATCH',
      s.buyback_burn.genesis_config_hash,
      manifest.addresses.buyback_burn_initial_genesis_controller,
      'buyback_burn.genesis_config_hash',
    );
  }
  addAddressEq(issues, 'BUYBACK_FEE_ACCUMULATOR_MISMATCH', s.buyback_burn.fee_accumulator_address, manifest.addresses.fee_accumulator, 'buyback_burn.fee_accumulator_address');
  addAddressEq(issues, 'BUYBACK_OFFICIAL_ATH_WALLET_MISMATCH', s.buyback_burn.official_ath_wallet_address, manifest.addresses.buyback_burn_official_ath_wallet, 'buyback_burn.official_ath_wallet_address');
  addAddressEq(issues, 'BUYBACK_ATH_MASTER_MISMATCH', s.buyback_burn.ath_master_address, manifest.addresses.ath_master, 'buyback_burn.ath_master_address');
  addBasechainAddress(issues, 'BUYBACK_ATH_MASTER_NOT_BASECHAIN', s.buyback_burn.ath_master_address, 'buyback_burn.ath_master_address');
  addDecimalZero(issues, 'BUYBACK_STATE_NOT_IDLE_AT_GENESIS', s.buyback_burn.phase, 'buyback_burn.phase');
  addDecimalZero(issues, 'BUYBACK_RESERVE_DUE_NOT_ZERO_AT_GENESIS', s.buyback_burn.reserve_due_ton, 'buyback_burn.reserve_due_ton');
  addDecimalZero(issues, 'BUYBACK_PENDING_QUERY_NOT_ZERO_AT_GENESIS', s.buyback_burn.pending_query_id, 'buyback_burn.pending_query_id');
  addDecimalZero(issues, 'BUYBACK_ROUTE_REFUND_DUE_NOT_ZERO_AT_GENESIS', s.buyback_burn.route_refund_due_ton, 'buyback_burn.route_refund_due_ton');
  addDecimalZero(issues, 'BUYBACK_ATH_BURN_RETRY_DUE_NOT_ZERO_AT_GENESIS', s.buyback_burn.ath_burn_retry_due_atomic, 'buyback_burn.ath_burn_retry_due_atomic');
  addDecimalZero(issues, 'BUYBACK_LAST_TERMINAL_QUERY_NOT_ZERO_AT_GENESIS', s.buyback_burn.last_terminal_query_id, 'buyback_burn.last_terminal_query_id');
  addDecimalZero(issues, 'BUYBACK_ACCEPTED_RESERVE_COUNT_NOT_ZERO_AT_GENESIS', s.buyback_burn.accepted_reserve_count, 'buyback_burn.accepted_reserve_count');
  addDecimalZero(issues, 'BUYBACK_EXECUTED_COUNT_NOT_ZERO_AT_GENESIS', s.buyback_burn.executed_buyback_count, 'buyback_burn.executed_buyback_count');
  addDecimalZero(issues, 'BUYBACK_BURNED_ATH_TOTAL_NOT_ZERO_AT_GENESIS', s.buyback_burn.burned_ath_total_atomic, 'buyback_burn.burned_ath_total_atomic');

  checkZeroOfficialAthWallet(
    issues,
    manifest,
    (s as any).buyback_burn_official_ath_wallet,
    'buyback_burn_official_ath_wallet',
    'buyback_burn_official_ath_wallet',
    'MISSING_BUYBACK_OFFICIAL_ATH_WALLET_SNAPSHOT',
    'BUYBACK_OFFICIAL_ATH_WALLET_OWNER_MISMATCH',
    'BUYBACK_OFFICIAL_ATH_WALLET_MASTER_MISMATCH',
    'BUYBACK_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS',
    manifest.addresses.buyback_burn,
  );

  checkBase(issues, manifest, s.fee_accumulator, 'fee_accumulator', 'fee_accumulator', 'fee_accumulator');
  addAddressEq(issues, 'FEE_ACCUMULATOR_BUYBACK_BURN_MISMATCH', s.fee_accumulator.buyback_burn_address, manifest.addresses.buyback_burn, 'fee_accumulator.buyback_burn_address');
  addAddressEq(issues, 'FEE_ACCUMULATOR_TON_TREASURY_MISMATCH', s.fee_accumulator.ton_treasury_receiver, manifest.addresses.fee_accumulator_ton_treasury_receiver, 'fee_accumulator.ton_treasury_receiver');
  addBasechainAddress(issues, 'FEE_ACCUMULATOR_TON_TREASURY_RECEIVER_NOT_BASECHAIN', s.fee_accumulator.ton_treasury_receiver, 'fee_accumulator.ton_treasury_receiver');
  if (s.fee_accumulator.buyback_split_enabled !== false) {
    issues.push(issue('FEE_ACCUMULATOR_BUYBACK_SPLIT_ENABLED_AT_GENESIS', 'fee_accumulator.buyback_split_enabled must be false at final genesis; buyback split is enabled only after the 15% activity distribution / pool-launch gate.'));
  }
  addDecimalZero(issues, 'FEE_ACCUMULATOR_ACCUMULATED_NOT_ZERO_AT_GENESIS', s.fee_accumulator.accumulated_ton, 'fee_accumulator.accumulated_ton');
  addDecimalZero(issues, 'FEE_ACCUMULATOR_TREASURY_DUE_NOT_ZERO_AT_GENESIS', s.fee_accumulator.treasury_due_ton, 'fee_accumulator.treasury_due_ton');
  addDecimalZero(issues, 'FEE_ACCUMULATOR_BUYBACK_DUE_NOT_ZERO_AT_GENESIS', s.fee_accumulator.buyback_due_ton, 'fee_accumulator.buyback_due_ton');

  for (const [key, value] of Object.entries(input.evidenceRefs ?? {})) {
    if (isPlaceholder(value)) issues.push(issue(`MISSING_EVIDENCE_REF_${key.toUpperCase()}`, `${key} must point to immutable release evidence.`));
  }

  return {
    document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_REPORT',
    status: issues.length === 0 ? 'MAINNET_GENESIS_VERIFIED' : 'BLOCKED_GENESIS_MISMATCH',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    mainnet_genesis_verified: issues.length === 0,
    input_source: metadata.inputSource ?? null,
    input_sha256: metadata.inputSha256 ?? null,
    evidence_refs: input.evidenceRefs ?? null,
    issue_codes: issues.map((i) => i.code),
    issues,
    checked_manifest_hash: manifest.manifest_hash_hex ?? null,
  };
}

function markdown(report: MainnetGenesisVerifyReport) {
  const lines = [
    '# Mainnet Genesis Verify',
    '',
    `Status: ${report.status}`,
    '',
    `- mainnet_genesis_verified: ${report.mainnet_genesis_verified}`,
    `- checked_manifest_hash: ${report.checked_manifest_hash ?? 'none'}`,
    `- input_source: ${report.input_source ?? 'none'}`,
    `- input_sha256: ${report.input_sha256 ?? 'none'}`,
    '',
    '## Evidence refs',
    '',
    ...(report.evidence_refs
      ? Object.entries(report.evidence_refs).map(([key, value]) => `- ${key}: ${value}`)
      : ['- none']),
    '',
    '## Issues',
    '',
    ...(report.issues.length > 0 ? report.issues.map((item) => `- ${item.code}: ${item.message}`) : ['- none']),
    '',
  ];
  return lines.join('\n');
}

export function writeMainnetGenesisVerifyArtifacts(inputPath = DEFAULT_MAINNET_GENESIS_VERIFY_INPUT_PATH) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, 'mainnet_genesis_verify_input_template.json'), `${JSON.stringify(createMainnetGenesisVerifyInputTemplate(), null, 2)}\n`);

  const inputRaw = inputPath && existsSync(inputPath) ? readFileSync(inputPath, 'utf8') : null;
  const input = inputRaw ? JSON.parse(inputRaw) as MainnetGenesisVerifyInput : null;
  const snapshotReport = verifyMainnetGenesisSnapshot(input, {
    inputSource: inputRaw ? normalizedArtifactSource(inputPath) : null,
    inputSha256: inputRaw ? sha256Hex(inputRaw) : null,
  });
  const report = input
    ? withAdditionalIssues(snapshotReport, currentBuildConsistencyIssues(input))
    : snapshotReport;
  writeFileSync(join(ARTIFACTS_DIR, 'mainnet_genesis_verify_report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'MAINNET_GENESIS_VERIFY.md'), markdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'MAINNET_GENESIS_VERIFIED.txt'), `${report.mainnet_genesis_verified}\n`);
  return report;
}

if (require.main === module) {
  const report = writeMainnetGenesisVerifyArtifacts(process.argv[2] ?? DEFAULT_MAINNET_GENESIS_VERIFY_INPUT_PATH);
  console.log(JSON.stringify({
    status: report.status,
    mainnet_genesis_verified: report.mainnet_genesis_verified,
    input_source: report.input_source,
    input_sha256: report.input_sha256,
    issue_codes: report.issue_codes,
    output: 'artifacts/mainnet_genesis_verify_report.json',
  }, null, 2));
}
