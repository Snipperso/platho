import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address, beginCell } from '@ton/core';
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
      capsule_hub_address: string;
      vault_ath_wallet_address: string;
      ath_master_address: string;
    };
    vault_official_ath_wallet: BaseSnapshot & {
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
    };
    market_stability_seller_official_ath_wallet: BaseSnapshot & {
      owner_address: string;
      ath_master_address: string;
      balance_atomic: string;
    };
    capsulehub: BaseSnapshot & {
      vault_address: string;
      fee_accumulator_address: string;
    };
    username_registry: BaseSnapshot & {
      official_ath_wallet_address: string;
      ath_master_address: string;
      treasury_ath_receiver: string;
    };
    profile_registry: BaseSnapshot & {
      official_ath_wallet_address: string;
      ath_master_address: string;
      treasury_ath_receiver: string;
    };
    buyback_burn: BaseSnapshot & {
      fee_accumulator_address: string;
      official_ath_wallet_address: string;
      ath_master_address: string;
      genesis_config_hash: string;
      route_frozen: boolean;
    };
    fee_accumulator: BaseSnapshot & {
      buyback_burn_address: string;
      ton_treasury_receiver: string;
      buyback_split_enabled: boolean;
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
  issue_codes: string[];
  issues: Issue[];
  checked_manifest_hash: string | null;
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

function addBasechainAddress(issues: Issue[], code: string, value: unknown, label: string) {
  const workchain = addressWorkchain(value);
  if (workchain !== null && workchain !== 0) {
    issues.push(issue(code, `${label} must be a basechain workchain 0 address for the current release; got workchain ${workchain}.`));
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

function checkSealed(issues: Issue[], manifest: ManifestLike, snapshot: BaseSnapshot, contractKey: string) {
  addTrue(issues, `${contractKey.toUpperCase()}_NOT_SEALED`, snapshot.sealed, `${contractKey}.sealed`);
  addEq(issues, `${contractKey.toUpperCase()}_MANIFEST_HASH_MISMATCH`, snapshot.deployment_manifest_hash, manifest.manifest_hash_hex, `${contractKey}.deployment_manifest_hash`);
}

export function createMainnetGenesisVerifyInputTemplate(): MainnetGenesisVerifyInput {
  const requiredManifest: ManifestLike = {
    profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
    status: 'FINAL_GENESIS',
    manifest_hash_hex: 'required: 64 lowercase hex final manifest hash',
    addresses: {
      ath_master: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
      ath_treasury_owner: 'REQUIRED_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
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
      ath_wallet: 'required: current ATHWallet code hash',
      vault: 'required: current Vault code hash',
      market_stability_seller: 'required: current MarketStabilitySeller code hash',
      capsulehub: 'required: current CapsuleHub code hash',
      username_registry: 'required: current UsernameRegistry code hash',
      profile_registry: 'required: current ProfileRegistry code hash',
      buyback_burn: 'required: current BuybackBurn code hash',
      fee_accumulator: 'required: current FeeAccumulator code hash',
    },
    constants: {
      ath_total_supply_atomic: 'required: decimal atomic ATH amount',
      vault_activity_airdrop_total_atomic: 'required: decimal atomic ATH amount',
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
        capsule_hub_address: 'REQUIRED_MAINNET_CAPSULEHUB_ADDRESS',
        vault_ath_wallet_address: 'REQUIRED_MAINNET_VAULT_OFFICIAL_ATH_WALLET_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
      },
      vault_official_ath_wallet: {
        address: 'REQUIRED_MAINNET_VAULT_OFFICIAL_ATH_WALLET_ADDRESS',
        code_hash: 'required: current ATHWallet code hash',
        owner_address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: 'required: decimal ATH balance from get_wallet_data',
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
      },
      market_stability_seller_official_ath_wallet: {
        address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_ADDRESS',
        code_hash: 'required: current ATHWallet code hash',
        owner_address: 'REQUIRED_MAINNET_MARKET_STABILITY_SELLER_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        balance_atomic: 'required: decimal ATH balance from get_wallet_data',
      },
      capsulehub: {
        ...base,
        address: 'REQUIRED_MAINNET_CAPSULEHUB_ADDRESS',
        vault_address: 'REQUIRED_MAINNET_VAULT_ADDRESS',
        fee_accumulator_address: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
      },
      username_registry: {
        ...base,
        address: 'REQUIRED_MAINNET_USERNAME_REGISTRY_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        treasury_ath_receiver: 'REQUIRED_MAINNET_USERNAME_TREASURY_ATH_RECEIVER_ADDRESS',
      },
      profile_registry: {
        ...base,
        address: 'REQUIRED_MAINNET_PROFILE_REGISTRY_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        treasury_ath_receiver: 'REQUIRED_MAINNET_PROFILE_TREASURY_ATH_RECEIVER_ADDRESS',
      },
      buyback_burn: {
        ...base,
        address: 'REQUIRED_MAINNET_BUYBACKBURN_ADDRESS',
        fee_accumulator_address: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
        official_ath_wallet_address: 'REQUIRED_MAINNET_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
        ath_master_address: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
        genesis_config_hash: 'required: 64 lowercase hex buyback launch controller hash',
        route_frozen: false,
      },
      fee_accumulator: {
        address: 'REQUIRED_MAINNET_FEE_ACCUMULATOR_ADDRESS',
        code_hash: 'required: current FeeAccumulator code hash',
        buyback_burn_address: 'REQUIRED_MAINNET_BUYBACKBURN_ADDRESS',
        ton_treasury_receiver: 'REQUIRED_MAINNET_TON_TREASURY_RECEIVER_ADDRESS',
        buyback_split_enabled: false,
      },
    },
    evidenceRefs: {
      getterSnapshotSource: 'required: immutable getter snapshot path/hash',
      codeHashProofSource: 'required: immutable code hash proof path/hash',
      finalManifestSource: 'required: immutable final manifest path/hash',
    },
  };
}

export function verifyMainnetGenesisSnapshot(input: MainnetGenesisVerifyInput | null): MainnetGenesisVerifyReport {
  if (!input) {
    return {
      document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_REPORT',
      status: 'BLOCKED_MISSING_INPUT',
      generated_at: 'DETERMINISTIC_ARTIFACT',
      mainnet_genesis_verified: false,
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

  for (const [key, value] of Object.entries(manifest.addresses ?? {})) {
    if (!isParseableMainnetAddress(value)) issues.push(issue(`BAD_MANIFEST_ADDRESS_${key.toUpperCase()}`, `${key} must be a parseable mainnet address.`));
  }
  addBasechainAddress(issues, 'ATH_MASTER_NOT_BASECHAIN', manifest.addresses?.ath_master, 'manifest.addresses.ath_master');
  for (const [key, value] of Object.entries(manifest.code_hashes ?? {})) {
    if (!isHex64(value)) issues.push(issue(`BAD_MANIFEST_CODE_HASH_${key.toUpperCase()}`, `${key} code hash must be 32-byte hex.`));
  }
  const athTotalSupply = manifest.constants?.ath_total_supply_atomic;
  if (!isDecimalString(athTotalSupply)) {
    issues.push(issue('BAD_ATH_TOTAL_SUPPLY', 'manifest.constants.ath_total_supply_atomic must be a decimal atomic ATH string.'));
  }
  const vaultActivityAirdropTotal = manifest.constants?.vault_activity_airdrop_total_atomic;
  if (!isDecimalString(vaultActivityAirdropTotal)) {
    issues.push(issue('BAD_VAULT_ACTIVITY_AIRDROP_TOTAL', 'manifest.constants.vault_activity_airdrop_total_atomic must be a decimal atomic ATH string.'));
  }
  const marketStabilityReserveTotal = manifest.constants?.ath_market_stability_reserve_allocation_atomic;
  if (!isDecimalString(marketStabilityReserveTotal)) {
    issues.push(issue('BAD_MARKET_STABILITY_RESERVE_TOTAL', 'manifest.constants.ath_market_stability_reserve_allocation_atomic must be a decimal atomic ATH string.'));
  }

  const s = input.snapshot;
  checkBase(issues, manifest, s.ath_master, 'ath_master', 'ath_master', 'ath_master');
  addAddressEq(issues, 'ATH_MASTER_TREASURY_OWNER_MISMATCH', s.ath_master.treasury_owner_address, manifest.addresses.ath_treasury_owner, 'ath_master.treasury_owner_address');
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
  addAddressEq(issues, 'VAULT_CAPSULE_HUB_ADDRESS_MISMATCH', s.vault.capsule_hub_address, manifest.addresses.capsulehub, 'vault.capsule_hub_address');
  addAddressEq(issues, 'VAULT_OFFICIAL_ATH_WALLET_MISMATCH', s.vault.vault_ath_wallet_address, manifest.addresses.vault_official_ath_wallet, 'vault.vault_ath_wallet_address');
  addAddressEq(issues, 'VAULT_ATH_MASTER_MISMATCH', s.vault.ath_master_address, manifest.addresses.ath_master, 'vault.ath_master_address');

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
  checkBase(issues, manifest, vaultOfficialAthWallet, 'vault_official_ath_wallet', 'vault_official_ath_wallet', 'ath_wallet');
  addAddressEq(issues, 'VAULT_OFFICIAL_ATH_WALLET_OWNER_MISMATCH', vaultOfficialAthWallet.owner_address, manifest.addresses.vault, 'vault_official_ath_wallet.owner_address');
  addAddressEq(issues, 'VAULT_OFFICIAL_ATH_WALLET_MASTER_MISMATCH', vaultOfficialAthWallet.ath_master_address, manifest.addresses.ath_master, 'vault_official_ath_wallet.ath_master_address');
  if (isDecimalString(vaultActivityAirdropTotal)) {
    addDecimalGte(
      issues,
      'VAULT_ACTIVITY_AIRDROP_BACKING_UNDERFUNDED',
      vaultOfficialAthWallet.balance_atomic,
      vaultActivityAirdropTotal,
      'vault_official_ath_wallet.balance_atomic',
    );
  }

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
  addBasechainAddress(issues, 'MARKET_STABILITY_SELLER_ATH_MASTER_NOT_BASECHAIN', marketSeller.ath_master_address, 'market_stability_seller.ath_master_address');
  addDecimalEq(issues, 'MARKET_STABILITY_RESERVE_DUE_NOT_ZERO_AT_GENESIS', marketSeller.reserve_due_ath, '0', 'market_stability_seller.reserve_due_ath');
  addDecimalEq(issues, 'MARKET_STABILITY_RESERVE_FUNDED_TOTAL_NOT_ZERO_AT_GENESIS', marketSeller.reserve_funded_total_ath, '0', 'market_stability_seller.reserve_funded_total_ath');
  addDecimalEq(issues, 'MARKET_STABILITY_TREASURY_DUE_NOT_ZERO_AT_GENESIS', marketSeller.treasury_due_ton, '0', 'market_stability_seller.treasury_due_ton');
  addDecimalEq(issues, 'MARKET_STABILITY_SOLD_TOTAL_NOT_ZERO_AT_GENESIS', marketSeller.sold_ath_total, '0', 'market_stability_seller.sold_ath_total');

  const marketSellerOfficialAthWallet = (s as any).market_stability_seller_official_ath_wallet ?? {
    address: '',
    code_hash: '',
    owner_address: '',
    ath_master_address: '',
    balance_atomic: '',
  };
  if (!(s as any).market_stability_seller_official_ath_wallet) {
    issues.push(issue('MISSING_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_SNAPSHOT', 'snapshot.market_stability_seller_official_ath_wallet getter data is required.'));
  }
  checkBase(issues, manifest, marketSellerOfficialAthWallet, 'market_stability_seller_official_ath_wallet', 'market_stability_seller_official_ath_wallet', 'ath_wallet');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_OWNER_MISMATCH', marketSellerOfficialAthWallet.owner_address, manifest.addresses.market_stability_seller, 'market_stability_seller_official_ath_wallet.owner_address');
  addAddressEq(issues, 'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_MASTER_MISMATCH', marketSellerOfficialAthWallet.ath_master_address, manifest.addresses.ath_master, 'market_stability_seller_official_ath_wallet.ath_master_address');
  addDecimalEq(issues, 'MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_FUNDED_AT_GENESIS', marketSellerOfficialAthWallet.balance_atomic, '0', 'market_stability_seller_official_ath_wallet.balance_atomic');

  checkBase(issues, manifest, s.capsulehub, 'capsulehub', 'capsulehub', 'capsulehub');
  checkSealed(issues, manifest, s.capsulehub, 'capsulehub');
  addAddressEq(issues, 'CAPSULEHUB_VAULT_ADDRESS_MISMATCH', s.capsulehub.vault_address, manifest.addresses.vault, 'capsulehub.vault_address');
  addAddressEq(issues, 'CAPSULEHUB_FEE_ACCUMULATOR_MISMATCH', s.capsulehub.fee_accumulator_address, manifest.addresses.fee_accumulator, 'capsulehub.fee_accumulator_address');

  checkBase(issues, manifest, s.username_registry, 'username_registry', 'username_registry', 'username_registry');
  checkSealed(issues, manifest, s.username_registry, 'username_registry');
  addAddressEq(issues, 'USERNAME_REGISTRY_OFFICIAL_ATH_WALLET_MISMATCH', s.username_registry.official_ath_wallet_address, manifest.addresses.username_registry_official_ath_wallet, 'username_registry.official_ath_wallet_address');
  addAddressEq(issues, 'USERNAME_REGISTRY_ATH_MASTER_MISMATCH', s.username_registry.ath_master_address, manifest.addresses.ath_master, 'username_registry.ath_master_address');
  addBasechainAddress(issues, 'USERNAME_REGISTRY_ATH_MASTER_NOT_BASECHAIN', s.username_registry.ath_master_address, 'username_registry.ath_master_address');
  addAddressEq(issues, 'USERNAME_REGISTRY_TREASURY_RECEIVER_MISMATCH', s.username_registry.treasury_ath_receiver, manifest.addresses.treasury_ath_receiver, 'username_registry.treasury_ath_receiver');

  checkBase(issues, manifest, s.profile_registry, 'profile_registry', 'profile_registry', 'profile_registry');
  checkSealed(issues, manifest, s.profile_registry, 'profile_registry');
  addAddressEq(issues, 'PROFILE_REGISTRY_OFFICIAL_ATH_WALLET_MISMATCH', s.profile_registry.official_ath_wallet_address, manifest.addresses.profile_registry_official_ath_wallet, 'profile_registry.official_ath_wallet_address');
  addAddressEq(issues, 'PROFILE_REGISTRY_ATH_MASTER_MISMATCH', s.profile_registry.ath_master_address, manifest.addresses.ath_master, 'profile_registry.ath_master_address');
  addBasechainAddress(issues, 'PROFILE_REGISTRY_ATH_MASTER_NOT_BASECHAIN', s.profile_registry.ath_master_address, 'profile_registry.ath_master_address');
  addAddressEq(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_MISMATCH', s.profile_registry.treasury_ath_receiver, manifest.addresses.profile_registry_treasury_ath_receiver, 'profile_registry.treasury_ath_receiver');
  addBasechainAddress(issues, 'PROFILE_REGISTRY_TREASURY_RECEIVER_NOT_BASECHAIN', s.profile_registry.treasury_ath_receiver, 'profile_registry.treasury_ath_receiver');

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

  checkBase(issues, manifest, s.fee_accumulator, 'fee_accumulator', 'fee_accumulator', 'fee_accumulator');
  addAddressEq(issues, 'FEE_ACCUMULATOR_BUYBACK_BURN_MISMATCH', s.fee_accumulator.buyback_burn_address, manifest.addresses.buyback_burn, 'fee_accumulator.buyback_burn_address');
  addAddressEq(issues, 'FEE_ACCUMULATOR_TON_TREASURY_MISMATCH', s.fee_accumulator.ton_treasury_receiver, manifest.addresses.fee_accumulator_ton_treasury_receiver, 'fee_accumulator.ton_treasury_receiver');
  if (s.fee_accumulator.buyback_split_enabled !== false) {
    issues.push(issue('FEE_ACCUMULATOR_BUYBACK_SPLIT_ENABLED_AT_GENESIS', 'fee_accumulator.buyback_split_enabled must be false at final genesis; buyback split is enabled only after the 15% activity distribution / pool-launch gate.'));
  }

  for (const [key, value] of Object.entries(input.evidenceRefs ?? {})) {
    if (isPlaceholder(value)) issues.push(issue(`MISSING_EVIDENCE_REF_${key.toUpperCase()}`, `${key} must point to immutable release evidence.`));
  }

  return {
    document: 'PLATHO.V1.MAINNET_GENESIS_VERIFY_REPORT',
    status: issues.length === 0 ? 'MAINNET_GENESIS_VERIFIED' : 'BLOCKED_GENESIS_MISMATCH',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    mainnet_genesis_verified: issues.length === 0,
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
    '',
    '## Issues',
    '',
    ...(report.issues.length > 0 ? report.issues.map((item) => `- ${item.code}: ${item.message}`) : ['- none']),
    '',
  ];
  return lines.join('\n');
}

export function writeMainnetGenesisVerifyArtifacts(inputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, 'mainnet_genesis_verify_input_template.json'), `${JSON.stringify(createMainnetGenesisVerifyInputTemplate(), null, 2)}\n`);

  const input = inputPath && existsSync(inputPath) ? readJson(inputPath) as MainnetGenesisVerifyInput : null;
  const report = verifyMainnetGenesisSnapshot(input);
  writeFileSync(join(ARTIFACTS_DIR, 'mainnet_genesis_verify_report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'MAINNET_GENESIS_VERIFY.md'), markdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'MAINNET_GENESIS_VERIFIED.txt'), `${report.mainnet_genesis_verified}\n`);
  return report;
}

if (require.main === module) {
  const report = writeMainnetGenesisVerifyArtifacts(process.argv[2]);
  console.log(JSON.stringify({
    status: report.status,
    mainnet_genesis_verified: report.mainnet_genesis_verified,
    issue_codes: report.issue_codes,
    output: 'artifacts/mainnet_genesis_verify_report.json',
  }, null, 2));
}
