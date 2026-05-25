import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import { isTestnetFriendlyAddress } from './m20f_mainnet_route_freeze_preflight';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

type Issue = { code: string; message: string };

type ManifestLike = {
  profile: string;
  status: string;
  manifest_hash_hex: string;
  addresses: Record<string, string>;
  code_hashes: Record<string, string>;
  constants?: Record<string, string>;
  blockers_before_final_genesis?: string[];
};

type BaseSnapshot = {
  address: string;
  code_hash: string;
  sealed?: boolean;
  deployment_manifest_hash?: string;
};

export interface MarketStabilitySellerReadinessInput {
  document: 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_INPUT';
  network: 'mainnet';
  manifest: ManifestLike;
  snapshot: {
    market_stability_seller: BaseSnapshot & {
      reserve_funder_address: string;
      official_ath_wallet_address: string;
      ton_treasury_receiver_address: string;
      ath_master_address: string;
      genesis_config_hash: string;
      pricing_frozen: boolean;
      base_tranche_price_nanotons: string;
      evidence_x1_tranche_quote_nanotons: string;
      pricing_evidence_hash: string;
      phase: string;
      reserve_due_ath: string;
      treasury_due_ton: string;
      pending_query_id: string;
      pending_amount_ath: string;
      pending_paid_ton: string;
      completed_tranche_count: string;
      current_tranche_sold_ath: string;
      current_multiplier: string;
      current_tranche_remaining_ath: string;
      last_terminal_query_id: string;
      reserve_funded_total_ath: string;
      sold_ath_total: string;
      treasury_flushed_ton_total: string;
    };
    market_stability_seller_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
  };
  evidenceRefs: {
    finalPoolLaunchPriceSource: string;
    pricingFreezeTx: string;
    reserveFundingTx: string;
    getterSnapshotSource: string;
    codeHashProofSource: string;
    finalManifestSource: string;
  };
}

export interface MarketStabilitySellerReadinessReport {
  document: 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_REPORT';
  status: 'BLOCKED_MISSING_INPUT' | 'BLOCKED_MARKET_STABILITY_SELLER_READINESS' | 'MARKET_STABILITY_SELLER_READY';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  market_stability_seller_ready: boolean;
  issue_codes: string[];
  issues: Issue[];
  checked_manifest_hash: string | null;
  reserve_allocation_atomic: string | null;
  base_tranche_price_nanotons: string | null;
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function issue(code: string, message: string): Issue {
  return { code, message };
}

function isHex64(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function isZeroHex64(value: unknown): boolean {
  return isHex64(value) && /^0{64}$/i.test(value);
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

function addBasechainAddress(issues: Issue[], code: string, value: unknown, label: string) {
  const workchain = addressWorkchain(value);
  if (workchain !== null && workchain !== 0) {
    issues.push(issue(code, `${label} must be a basechain workchain 0 address for the current release; got workchain ${workchain}.`));
  }
}

function addDecimalEq(issues: Issue[], code: string, actual: unknown, expected: unknown, label: string) {
  if (!isDecimalString(actual)) {
    issues.push(issue(code, `${label} must be a decimal integer string; got ${actual}`));
    return;
  }
  if (!isDecimalString(expected)) {
    issues.push(issue(code, `${label} expected value must be a decimal integer string; got ${expected}`));
    return;
  }
  if (BigInt(actual) !== BigInt(expected)) {
    issues.push(issue(code, `${label} mismatch: expected ${expected}, got ${actual}`));
  }
}

function addDecimalGtZero(issues: Issue[], code: string, actual: unknown, label: string) {
  if (!isDecimalString(actual)) {
    issues.push(issue(code, `${label} must be a decimal integer string; got ${actual}`));
    return;
  }
  if (BigInt(actual) <= 0n) {
    issues.push(issue(code, `${label} must be greater than zero; got ${actual}`));
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

function checkSealed(issues: Issue[], manifest: ManifestLike, snapshot: BaseSnapshot, contractKey: string) {
  if (snapshot.sealed !== true) {
    issues.push(issue(`${contractKey.toUpperCase()}_NOT_SEALED`, `${contractKey}.sealed must be true.`));
  }
  addEq(issues, `${contractKey.toUpperCase()}_MANIFEST_HASH_MISMATCH`, snapshot.deployment_manifest_hash, manifest.manifest_hash_hex, `${contractKey}.deployment_manifest_hash`);
}

export function createMarketStabilitySellerReadinessInputTemplate(): MarketStabilitySellerReadinessInput {
  return {
    document: 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_INPUT',
    network: 'mainnet',
    manifest: {
      profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
      status: 'FINAL_GENESIS',
      manifest_hash_hex: 'required: 64 lowercase hex final manifest hash',
      addresses: {
        ath_master: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        market_stability_seller: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
        market_stability_seller_official_ath_wallet: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
        market_stability_reserve_funder: 'REQUIRED_MAINNET_MARKET_STABILITY_RESERVE_FUNDER_ADDRESS',
        market_stability_ton_treasury_receiver: 'REQUIRED_MAINNET_MARKET_STABILITY_TON_TREASURY_RECEIVER_ADDRESS',
      },
      code_hashes: {
        ath_wallet: 'required: current ATHWallet code hash',
        market_stability_seller: 'required: current MarketStabilitySeller code hash',
      },
      constants: {
        ath_market_stability_reserve_allocation_atomic: '45000000000000000',
        ath_market_stability_tranche_atomic: '3000000000000000',
        ath_market_stability_tranche_count: '15',
        ath_market_stability_start_multiplier: '2',
        ath_market_stability_end_multiplier: '16',
      },
      blockers_before_final_genesis: [],
    },
    snapshot: {
      market_stability_seller: {
        address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
        code_hash: 'required: current MarketStabilitySeller code hash',
        sealed: true,
        deployment_manifest_hash: 'required: final manifest hash',
        reserve_funder_address: 'REQUIRED_MAINNET_MARKET_STABILITY_RESERVE_FUNDER_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
        ton_treasury_receiver_address: 'REQUIRED_MAINNET_MARKET_STABILITY_TON_TREASURY_RECEIVER_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        genesis_config_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        pricing_frozen: true,
        base_tranche_price_nanotons: 'required: exact decimal nanotons per 3,000,000 ATH x1 tranche',
        evidence_x1_tranche_quote_nanotons: 'required: same decimal x1 quote evidence amount',
        pricing_evidence_hash: 'required: 64 lowercase hex evidence hash',
        phase: '0',
        reserve_due_ath: '45000000000000000',
        treasury_due_ton: '0',
        pending_query_id: '0',
        pending_amount_ath: '0',
        pending_paid_ton: '0',
        completed_tranche_count: '0',
        current_tranche_sold_ath: '0',
        current_multiplier: '2',
        current_tranche_remaining_ath: '3000000000000000',
        last_terminal_query_id: '0',
        reserve_funded_total_ath: '45000000000000000',
        sold_ath_total: '0',
        treasury_flushed_ton_total: '0',
      },
      market_stability_seller_official_ath_wallet: {
        address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
        code_hash: 'required: current ATHWallet code hash',
        owner_address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: '45000000000000000',
      },
    },
    evidenceRefs: {
      finalPoolLaunchPriceSource: 'required: immutable pool launch price proof path/hash',
      pricingFreezeTx: 'required: one-time FreezeMarketStabilityPricing transaction hash',
      reserveFundingTx: 'required: authenticated reserve ATH notification/funding transaction hash',
      getterSnapshotSource: 'required: immutable post-pool seller getter snapshot path/hash',
      codeHashProofSource: 'required: immutable code hash proof path/hash',
      finalManifestSource: 'required: immutable final genesis manifest path/hash',
    },
  };
}

export function verifyMarketStabilitySellerReadiness(input: MarketStabilitySellerReadinessInput | null): MarketStabilitySellerReadinessReport {
  if (!input) {
    return {
      document: 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_REPORT',
      status: 'BLOCKED_MISSING_INPUT',
      generated_at: 'DETERMINISTIC_ARTIFACT',
      market_stability_seller_ready: false,
      issue_codes: ['MISSING_INPUT'],
      issues: [issue('MISSING_INPUT', 'Supply a post-pool MarketStabilitySeller getter snapshot input.')],
      checked_manifest_hash: null,
      reserve_allocation_atomic: null,
      base_tranche_price_nanotons: null,
    };
  }

  const issues: Issue[] = [];
  const manifest = input.manifest;
  const constants = manifest.constants ?? {};
  const reserveTotal = constants.ath_market_stability_reserve_allocation_atomic;
  const trancheAmount = constants.ath_market_stability_tranche_atomic;
  const trancheCount = constants.ath_market_stability_tranche_count;
  const startMultiplier = constants.ath_market_stability_start_multiplier;
  const endMultiplier = constants.ath_market_stability_end_multiplier;
  const snapshot = (input as any).snapshot ?? {};
  const seller = snapshot.market_stability_seller ?? {
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
    base_tranche_price_nanotons: '',
    evidence_x1_tranche_quote_nanotons: '',
    pricing_evidence_hash: '',
    phase: '',
    reserve_due_ath: '',
    treasury_due_ton: '',
    pending_query_id: '',
    pending_amount_ath: '',
    pending_paid_ton: '',
    completed_tranche_count: '',
    current_tranche_sold_ath: '',
    current_multiplier: '',
    current_tranche_remaining_ath: '',
    last_terminal_query_id: '',
    reserve_funded_total_ath: '',
    sold_ath_total: '',
    treasury_flushed_ton_total: '',
  };
  const officialWallet = snapshot.market_stability_seller_official_ath_wallet ?? {
    address: '',
    code_hash: '',
    owner_address: '',
    ath_master_address: '',
    balance_atomic: '',
  };
  if (!snapshot.market_stability_seller) {
    issues.push(issue('MISSING_MARKET_STABILITY_SELLER_SNAPSHOT', 'snapshot.market_stability_seller getter data is required.'));
  }
  if (!snapshot.market_stability_seller_official_ath_wallet) {
    issues.push(issue('MISSING_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_SNAPSHOT', 'snapshot.market_stability_seller_official_ath_wallet getter data is required.'));
  }

  if (input.document !== 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_INPUT') issues.push(issue('BAD_DOCUMENT_TYPE', 'Input document type is invalid.'));
  if (input.network !== 'mainnet') issues.push(issue('NETWORK_NOT_MAINNET', 'MarketStabilitySeller readiness only accepts mainnet snapshots.'));
  if (manifest.status !== 'FINAL_GENESIS') issues.push(issue('MANIFEST_NOT_FINAL_GENESIS', 'Manifest status must be FINAL_GENESIS before post-pool seller readiness can pass.'));
  if (!isHex64(manifest.manifest_hash_hex)) issues.push(issue('BAD_MANIFEST_HASH', 'manifest_hash_hex must be a 32-byte hex hash.'));
  if ((manifest.blockers_before_final_genesis ?? []).length > 0) issues.push(issue('FINAL_GENESIS_BLOCKERS_NOT_EMPTY', 'Final manifest must not contain open blockers.'));

  for (const key of [
    'ath_master',
    'market_stability_seller',
    'market_stability_seller_official_ath_wallet',
    'market_stability_reserve_funder',
    'market_stability_ton_treasury_receiver',
  ]) {
    if (!isParseableMainnetAddress(manifest.addresses?.[key])) {
      issues.push(issue(`BAD_MANIFEST_ADDRESS_${key.toUpperCase()}`, `${key} must be a parseable mainnet address.`));
    }
  }
  addBasechainAddress(issues, 'ATH_MASTER_NOT_BASECHAIN', manifest.addresses?.ath_master, 'manifest.addresses.ath_master');
  addBasechainAddress(issues, 'MARKET_STABILITY_RESERVE_FUNDER_NOT_BASECHAIN', manifest.addresses?.market_stability_reserve_funder, 'manifest.addresses.market_stability_reserve_funder');
  addBasechainAddress(issues, 'MARKET_STABILITY_TON_TREASURY_NOT_BASECHAIN', manifest.addresses?.market_stability_ton_treasury_receiver, 'manifest.addresses.market_stability_ton_treasury_receiver');

  for (const key of ['ath_wallet', 'market_stability_seller']) {
    if (!isHex64(manifest.code_hashes?.[key])) {
      issues.push(issue(`BAD_MANIFEST_CODE_HASH_${key.toUpperCase()}`, `${key} code hash must be 32-byte hex.`));
    }
  }

  addDecimalEq(issues, 'BAD_MARKET_STABILITY_RESERVE_TOTAL', reserveTotal, '45000000000000000', 'manifest.constants.ath_market_stability_reserve_allocation_atomic');
  addDecimalEq(issues, 'BAD_MARKET_STABILITY_TRANCHE_AMOUNT', trancheAmount, '3000000000000000', 'manifest.constants.ath_market_stability_tranche_atomic');
  addDecimalEq(issues, 'BAD_MARKET_STABILITY_TRANCHE_COUNT', trancheCount, '15', 'manifest.constants.ath_market_stability_tranche_count');
  addDecimalEq(issues, 'BAD_MARKET_STABILITY_START_MULTIPLIER', startMultiplier, '2', 'manifest.constants.ath_market_stability_start_multiplier');
  addDecimalEq(issues, 'BAD_MARKET_STABILITY_END_MULTIPLIER', endMultiplier, '16', 'manifest.constants.ath_market_stability_end_multiplier');

  checkBase(issues, manifest, seller, 'market_stability_seller', 'market_stability_seller', 'market_stability_seller');
  checkSealed(issues, manifest, seller, 'market_stability_seller');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_RESERVE_FUNDER_MISMATCH', seller.reserve_funder_address, manifest.addresses.market_stability_reserve_funder, 'market_stability_seller.reserve_funder_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_MISMATCH', seller.official_ath_wallet_address, manifest.addresses.market_stability_seller_official_ath_wallet, 'market_stability_seller.official_ath_wallet_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_TON_TREASURY_MISMATCH', seller.ton_treasury_receiver_address, manifest.addresses.market_stability_ton_treasury_receiver, 'market_stability_seller.ton_treasury_receiver_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_ATH_MASTER_MISMATCH', seller.ath_master_address, manifest.addresses.ath_master, 'market_stability_seller.ath_master_address');
  addBasechainAddress(issues, 'MARKET_STABILITY_SELLER_ATH_MASTER_NOT_BASECHAIN', seller.ath_master_address, 'market_stability_seller.ath_master_address');

  if (seller.pricing_frozen !== true) {
    issues.push(issue('MARKET_STABILITY_PRICING_NOT_FROZEN', 'market_stability_seller.pricing_frozen must be true after the post-pool pricing freeze.'));
  }
  if (!isZeroHex64(seller.genesis_config_hash)) {
    issues.push(issue('MARKET_STABILITY_LAUNCH_CONTROLLER_NOT_CLEARED', 'market_stability_seller.genesis_config_hash must be zero after the one-time post-pool pricing freeze.'));
  }
  addDecimalGtZero(issues, 'MARKET_STABILITY_BASE_PRICE_NOT_SET', seller.base_tranche_price_nanotons, 'market_stability_seller.base_tranche_price_nanotons');
  if (!isDecimalString(seller.evidence_x1_tranche_quote_nanotons)) {
    issues.push(issue('BAD_MARKET_STABILITY_BASE_PRICE_EVIDENCE_DECIMAL', `market_stability_seller.evidence_x1_tranche_quote_nanotons must be a decimal integer string; got ${seller.evidence_x1_tranche_quote_nanotons}`));
  } else if (isDecimalString(seller.base_tranche_price_nanotons)) {
    addDecimalEq(issues, 'MARKET_STABILITY_BASE_PRICE_EVIDENCE_MISMATCH', seller.base_tranche_price_nanotons, seller.evidence_x1_tranche_quote_nanotons, 'market_stability_seller.base_tranche_price_nanotons');
  }
  if (!isHex64(seller.pricing_evidence_hash) || isZeroHex64(seller.pricing_evidence_hash)) {
    issues.push(issue('MARKET_STABILITY_PRICING_EVIDENCE_HASH_MISSING', 'market_stability_seller.pricing_evidence_hash must be a non-zero 32-byte hex hash.'));
  }

  addDecimalEq(issues, 'MARKET_STABILITY_PHASE_NOT_IDLE', seller.phase, '0', 'market_stability_seller.phase');
  addDecimalEq(issues, 'MARKET_STABILITY_PENDING_QUERY_NOT_ZERO', seller.pending_query_id, '0', 'market_stability_seller.pending_query_id');
  addDecimalEq(issues, 'MARKET_STABILITY_PENDING_AMOUNT_NOT_ZERO', seller.pending_amount_ath, '0', 'market_stability_seller.pending_amount_ath');
  addDecimalEq(issues, 'MARKET_STABILITY_PENDING_PAID_NOT_ZERO', seller.pending_paid_ton, '0', 'market_stability_seller.pending_paid_ton');
  addDecimalEq(issues, 'MARKET_STABILITY_COMPLETED_TRANCHE_COUNT_NOT_ZERO', seller.completed_tranche_count, '0', 'market_stability_seller.completed_tranche_count');
  addDecimalEq(issues, 'MARKET_STABILITY_CURRENT_TRANCHE_SOLD_NOT_ZERO', seller.current_tranche_sold_ath, '0', 'market_stability_seller.current_tranche_sold_ath');
  addDecimalEq(issues, 'MARKET_STABILITY_CURRENT_MULTIPLIER_NOT_START', seller.current_multiplier, '2', 'market_stability_seller.current_multiplier');
  if (isDecimalString(trancheAmount)) {
    addDecimalEq(issues, 'MARKET_STABILITY_CURRENT_TRANCHE_REMAINING_MISMATCH', seller.current_tranche_remaining_ath, trancheAmount, 'market_stability_seller.current_tranche_remaining_ath');
  }
  addDecimalEq(issues, 'MARKET_STABILITY_LAST_TERMINAL_QUERY_NOT_ZERO', seller.last_terminal_query_id, '0', 'market_stability_seller.last_terminal_query_id');
  addDecimalEq(issues, 'MARKET_STABILITY_TREASURY_DUE_NOT_ZERO', seller.treasury_due_ton, '0', 'market_stability_seller.treasury_due_ton');
  addDecimalEq(issues, 'MARKET_STABILITY_SOLD_TOTAL_NOT_ZERO', seller.sold_ath_total, '0', 'market_stability_seller.sold_ath_total');
  addDecimalEq(issues, 'MARKET_STABILITY_TREASURY_FLUSHED_NOT_ZERO', seller.treasury_flushed_ton_total, '0', 'market_stability_seller.treasury_flushed_ton_total');
  if (isDecimalString(reserveTotal)) {
    addDecimalEq(issues, 'MARKET_STABILITY_RESERVE_DUE_NOT_FULLY_FUNDED', seller.reserve_due_ath, reserveTotal, 'market_stability_seller.reserve_due_ath');
    addDecimalEq(issues, 'MARKET_STABILITY_RESERVE_FUNDED_TOTAL_MISMATCH', seller.reserve_funded_total_ath, reserveTotal, 'market_stability_seller.reserve_funded_total_ath');
  }

  checkBase(issues, manifest, officialWallet, 'market_stability_seller_official_ath_wallet', 'market_stability_seller_official_ath_wallet', 'ath_wallet');
  addAddressEq(issues, 'MARKET_STABILITY_OFFICIAL_WALLET_OWNER_MISMATCH', officialWallet.owner_address, manifest.addresses.market_stability_seller, 'market_stability_seller_official_ath_wallet.owner_address');
  addAddressEq(issues, 'MARKET_STABILITY_OFFICIAL_WALLET_MASTER_MISMATCH', officialWallet.ath_master_address, manifest.addresses.ath_master, 'market_stability_seller_official_ath_wallet.ath_master_address');
  if (isDecimalString(reserveTotal)) {
    addDecimalEq(issues, 'MARKET_STABILITY_OFFICIAL_WALLET_BALANCE_MISMATCH', officialWallet.balance_atomic, reserveTotal, 'market_stability_seller_official_ath_wallet.balance_atomic');
  }

  for (const [key, value] of Object.entries(input.evidenceRefs ?? {})) {
    if (isPlaceholder(value)) issues.push(issue(`MISSING_EVIDENCE_REF_${key.toUpperCase()}`, `${key} must point to immutable post-pool release evidence.`));
  }

  return {
    document: 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_REPORT',
    status: issues.length === 0 ? 'MARKET_STABILITY_SELLER_READY' : 'BLOCKED_MARKET_STABILITY_SELLER_READINESS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    market_stability_seller_ready: issues.length === 0,
    issue_codes: issues.map((i) => i.code),
    issues,
    checked_manifest_hash: manifest.manifest_hash_hex ?? null,
    reserve_allocation_atomic: isDecimalString(reserveTotal) ? reserveTotal : null,
    base_tranche_price_nanotons: isDecimalString(seller.base_tranche_price_nanotons) ? seller.base_tranche_price_nanotons : null,
  };
}

function markdown(report: MarketStabilitySellerReadinessReport) {
  const lines = [
    '# MarketStabilitySeller Readiness',
    '',
    `Status: ${report.status}`,
    '',
    `- market_stability_seller_ready: ${report.market_stability_seller_ready}`,
    `- checked_manifest_hash: ${report.checked_manifest_hash ?? 'none'}`,
    `- reserve_allocation_atomic: ${report.reserve_allocation_atomic ?? 'unknown'}`,
    `- base_tranche_price_nanotons: ${report.base_tranche_price_nanotons ?? 'unknown'}`,
    '',
    '## Issues',
    '',
    ...(report.issues.length > 0 ? report.issues.map((item) => `- ${item.code}: ${item.message}`) : ['- none']),
    '',
  ];
  return lines.join('\n');
}

export function writeMarketStabilitySellerReadinessArtifacts(inputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, 'market_stability_seller_readiness_input_template.json'), `${JSON.stringify(createMarketStabilitySellerReadinessInputTemplate(), null, 2)}\n`);

  const input = inputPath && existsSync(inputPath) ? readJson(inputPath) as MarketStabilitySellerReadinessInput : null;
  const report = verifyMarketStabilitySellerReadiness(input);
  writeFileSync(join(ARTIFACTS_DIR, 'market_stability_seller_readiness_report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'MARKET_STABILITY_SELLER_READINESS.md'), markdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'MARKET_STABILITY_SELLER_READY.txt'), `${report.market_stability_seller_ready}\n`);
  return report;
}

if (require.main === module) {
  const report = writeMarketStabilitySellerReadinessArtifacts(process.argv[2]);
  console.log(JSON.stringify({
    status: report.status,
    market_stability_seller_ready: report.market_stability_seller_ready,
    issue_codes: report.issue_codes,
    output: 'artifacts/market_stability_seller_readiness_report.json',
  }, null, 2));
}
