import { Address, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHVesting } from '../build/ATHVesting/ATHVesting_ATHVesting';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { BuybackBurn } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { CapsuleHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { MarketStabilitySeller } from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import { ProfileRegistry } from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { Vault } from '../build/Vault/Vault_Vault';
import { computeFinalGenesisManifestHashHex } from './mainnet_genesis_verify';

type RoleEntry = {
  label?: string;
  address?: string;
  source?: string;
};

type RolesFile = {
  profile: string;
  network: string;
  manual_roles: Record<string, RoleEntry>;
  settings?: {
    ath_long_term_vesting_start_time_unix?: string | number;
  };
};

type AddressMap = Record<string, string>;
type HashMap = Record<string, string>;
type ConstantMap = Record<string, string>;

const ARTIFACTS_LOCAL_DIR = join(process.cwd(), 'artifacts', 'local');
const DEFAULT_ROLES_PATH = join(ARTIFACTS_LOCAL_DIR, 'mainnet_roles.local.json');
const DEFAULT_OUTPUT_JSON = join(ARTIFACTS_LOCAL_DIR, 'mainnet_final_manifest_draft.json');
const DEFAULT_OUTPUT_MD = join(ARTIFACTS_LOCAL_DIR, 'MAINNET_FINAL_MANIFEST_DRAFT.md');
const ATH_METADATA_PATH = join(process.cwd(), 'artifacts', 'ath_metadata_content.json');

const REQUIRED_ROLES = [
  'ath_treasury_owner',
  'genesis_controller_one_shot',
  'buyback_launch_controller',
  'market_stability_launch_controller',
  'ath_long_term_vesting_beneficiary',
  'ton_treasury_receiver',
  'treasury_ath_receiver',
  'profile_registry_treasury_ath_receiver',
  'market_stability_reserve_funder',
  'market_stability_ton_treasury_receiver',
];

function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function stateInitHash(init: { code: Cell; data: Cell }): string {
  return beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
}

function codeHash(path: string): string {
  return Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function raw(address: Address): string {
  return `${address.workChain}:${address.hash.toString('hex')}`;
}

function friendly(address: Address): string {
  return address.toString({ bounceable: false, testOnly: false });
}

function parseMainnetBasechainAddress(value: string, label: string): Address {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label} is missing`);
  }
  if (/^[0k]Q/.test(value.trim())) {
    throw new Error(`${label} looks like a testnet friendly address: ${value}`);
  }
  const parsed = Address.parse(value);
  if (parsed.workChain !== 0) {
    throw new Error(`${label} must be workchain 0, got workchain ${parsed.workChain}`);
  }
  return parsed;
}

function placeholderAddress(label: string): Address {
  return new Address(0, sha256(`PLATHO.V1.MAINNET.STATEINIT_PLACEHOLDER.${label}`));
}

function loadRoles(path: string): RolesFile {
  if (!existsSync(path)) {
    throw new Error(`Missing roles file: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as RolesFile;
  if (parsed.profile !== 'PLATHO.V1.MAINNET_ROLES_LOCAL_DRAFT') {
    throw new Error(`Unexpected roles profile: ${parsed.profile}`);
  }
  if (parsed.network !== 'mainnet') {
    throw new Error(`Roles file must be mainnet, got ${parsed.network}`);
  }
  return parsed;
}

function readRoleAddress(roles: RolesFile, key: string): Address {
  const entry = roles.manual_roles?.[key];
  return parseMainnetBasechainAddress(entry?.address ?? '', `manual_roles.${key}.address`);
}

function requireSameAddress(left: Address, right: Address, leftLabel: string, rightLabel: string) {
  if (!left.equals(right)) {
    throw new Error(`${leftLabel} must equal ${rightLabel} in the current contract model; post-seal freeze authority uses the same genesis_config_hash.`);
  }
}

function requireDifferentAddress(left: Address, right: Address, leftLabel: string, rightLabel: string) {
  if (left.equals(right)) {
    throw new Error(`${leftLabel} must not equal ${rightLabel}.`);
  }
}

function requireNotProtocolRole(receiver: Address, receiverLabel: string, forbiddenRoles: Array<[string, Address]>) {
  for (const [roleLabel, roleAddress] of forbiddenRoles) {
    requireDifferentAddress(receiver, roleAddress, receiverLabel, roleLabel);
  }
}

function readAthContentCell(): { cell: Cell; contentHashHex: string; bocSha256Hex: string } {
  const artifact = JSON.parse(readFileSync(ATH_METADATA_PATH, 'utf8')) as {
    contentBocBase64: string;
    contentHashHex: string;
    bocSha256Hex: string;
  };
  const cells = Cell.fromBoc(Buffer.from(artifact.contentBocBase64, 'base64'));
  if (cells.length !== 1) throw new Error('ATH metadata BOC must contain exactly one root cell');
  const cell = cells[0];
  const contentHashHex = cell.hash().toString('hex');
  if (contentHashHex !== artifact.contentHashHex) {
    throw new Error(`ATH metadata content hash mismatch: artifact=${artifact.contentHashHex}, actual=${contentHashHex}`);
  }
  const bocSha256Hex = createHash('sha256').update(Buffer.from(artifact.contentBocBase64, 'base64')).digest('hex');
  if (bocSha256Hex !== artifact.bocSha256Hex) {
    throw new Error(`ATH metadata BOC sha256 mismatch: artifact=${artifact.bocSha256Hex}, actual=${bocSha256Hex}`);
  }
  return { cell, contentHashHex, bocSha256Hex };
}

function vestingStartTime(roles: RolesFile): bigint {
  const rawValue = roles.settings?.ath_long_term_vesting_start_time_unix;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    throw new Error('settings.ath_long_term_vesting_start_time_unix is required for final mainnet draft derivation');
  }
  const value = BigInt(rawValue);
  if (value <= 0n) throw new Error('settings.ath_long_term_vesting_start_time_unix must be positive');
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  if (value <= nowSeconds) {
    throw new Error(`settings.ath_long_term_vesting_start_time_unix must be in the future; got ${value}, current ${nowSeconds}`);
  }
  return value;
}

async function buildDraft(rolesPath: string) {
  const roles = loadRoles(rolesPath);
  for (const key of REQUIRED_ROLES) {
    readRoleAddress(roles, key);
  }

  const athTreasuryOwner = readRoleAddress(roles, 'ath_treasury_owner');
  const genesisController = readRoleAddress(roles, 'genesis_controller_one_shot');
  const buybackLaunchController = readRoleAddress(roles, 'buyback_launch_controller');
  const marketStabilityLaunchController = readRoleAddress(roles, 'market_stability_launch_controller');
  const vestingBeneficiary = readRoleAddress(roles, 'ath_long_term_vesting_beneficiary');
  const tonTreasuryReceiver = readRoleAddress(roles, 'ton_treasury_receiver');
  const treasuryAthReceiver = readRoleAddress(roles, 'treasury_ath_receiver');
  const profileTreasuryAthReceiver = readRoleAddress(roles, 'profile_registry_treasury_ath_receiver');
  const marketReserveFunder = readRoleAddress(roles, 'market_stability_reserve_funder');
  const marketTonTreasuryReceiver = readRoleAddress(roles, 'market_stability_ton_treasury_receiver');
  const athContent = readAthContentCell();
  const athLongTermVestingStartTime = vestingStartTime(roles);

  requireSameAddress(buybackLaunchController, genesisController, 'manual_roles.buyback_launch_controller.address', 'manual_roles.genesis_controller_one_shot.address');
  requireSameAddress(marketStabilityLaunchController, genesisController, 'manual_roles.market_stability_launch_controller.address', 'manual_roles.genesis_controller_one_shot.address');

  const vaultCapsulePlaceholder = placeholderAddress('VAULT_INITIAL_CAPSULEHUB_COUNTERPART');
  const capsuleVaultPlaceholder = placeholderAddress('CAPSULEHUB_INITIAL_VAULT_COUNTERPART');
  const usernameAthPlaceholder = placeholderAddress('USERNAME_REGISTRY_INITIAL_ATH_WALLET');
  const profileAthPlaceholder = placeholderAddress('PROFILE_REGISTRY_INITIAL_ATH_WALLET');

  const athMaster = await ATHMaster.init(athTreasuryOwner, athContent.cell);
  const athMasterAddress = contractAddress(0, athMaster);

  const treasuryOwnerAthWallet = await ATHWallet.init(0n, athTreasuryOwner, athMasterAddress);
  const treasuryOwnerAthWalletAddress = contractAddress(athTreasuryOwner.workChain, treasuryOwnerAthWallet);

  const athLongTermVesting = await ATHVesting.init(athMasterAddress, vestingBeneficiary, athLongTermVestingStartTime);
  const athLongTermVestingAddress = contractAddress(0, athLongTermVesting);

  const buybackBurn = await BuybackBurn.init(addressHash(genesisController), athMasterAddress);
  const buybackBurnAddress = contractAddress(0, buybackBurn);

  const marketStabilitySeller = await MarketStabilitySeller.init(addressHash(genesisController), athMasterAddress);
  const marketStabilitySellerAddress = contractAddress(0, marketStabilitySeller);

  const feeAccumulator = await FeeAccumulator.init(tonTreasuryReceiver, buybackBurnAddress);
  const feeAccumulatorAddress = contractAddress(0, feeAccumulator);

  const vault = await Vault.init(genesisController, athMasterAddress, vaultCapsulePlaceholder, addressHash(genesisController), false, false, 0n);
  const vaultAddress = contractAddress(0, vault);

  const capsuleHub = await CapsuleHub.init(feeAccumulatorAddress, capsuleVaultPlaceholder, false, false, 0n, genesisController);
  const capsuleHubAddress = contractAddress(0, capsuleHub);

  const usernameRegistry = await UsernameRegistry.init(usernameAthPlaceholder, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, genesisController);
  const usernameRegistryAddress = contractAddress(0, usernameRegistry);

  const profileRegistry = await ProfileRegistry.init(profileAthPlaceholder, athMasterAddress, profileTreasuryAthReceiver, false, 0n, 0n, genesisController);
  const profileRegistryAddress = contractAddress(0, profileRegistry);

  const vaultOfficialAthWallet = await ATHWallet.init(0n, vaultAddress, athMasterAddress);
  const vaultOfficialAthWalletAddress = contractAddress(vaultAddress.workChain, vaultOfficialAthWallet);

  const usernameRegistryOfficialAthWallet = await ATHWallet.init(0n, usernameRegistryAddress, athMasterAddress);
  const usernameRegistryOfficialAthWalletAddress = contractAddress(usernameRegistryAddress.workChain, usernameRegistryOfficialAthWallet);

  requireDifferentAddress(treasuryAthReceiver, usernameRegistryAddress, 'manual_roles.treasury_ath_receiver.address', 'derived username_registry address');
  requireDifferentAddress(treasuryAthReceiver, usernameRegistryOfficialAthWalletAddress, 'manual_roles.treasury_ath_receiver.address', 'derived username_registry_official_ath_wallet address');
  requireDifferentAddress(treasuryAthReceiver, vaultAddress, 'manual_roles.treasury_ath_receiver.address', 'derived vault address');
  requireDifferentAddress(treasuryAthReceiver, athMasterAddress, 'manual_roles.treasury_ath_receiver.address', 'derived ath_master address');

  const profileRegistryOfficialAthWallet = await ATHWallet.init(0n, profileRegistryAddress, athMasterAddress);
  const profileRegistryOfficialAthWalletAddress = contractAddress(profileRegistryAddress.workChain, profileRegistryOfficialAthWallet);

  requireDifferentAddress(profileTreasuryAthReceiver, profileRegistryAddress, 'manual_roles.profile_registry_treasury_ath_receiver.address', 'derived profile_registry address');
  requireDifferentAddress(profileTreasuryAthReceiver, profileRegistryOfficialAthWalletAddress, 'manual_roles.profile_registry_treasury_ath_receiver.address', 'derived profile_registry_official_ath_wallet address');
  requireDifferentAddress(profileTreasuryAthReceiver, vaultAddress, 'manual_roles.profile_registry_treasury_ath_receiver.address', 'derived vault address');
  requireDifferentAddress(profileTreasuryAthReceiver, athMasterAddress, 'manual_roles.profile_registry_treasury_ath_receiver.address', 'derived ath_master address');

  const buybackBurnOfficialAthWallet = await ATHWallet.init(0n, buybackBurnAddress, athMasterAddress);
  const buybackBurnOfficialAthWalletAddress = contractAddress(buybackBurnAddress.workChain, buybackBurnOfficialAthWallet);

  const athLongTermVestingOfficialAthWallet = await ATHWallet.init(0n, athLongTermVestingAddress, athMasterAddress);
  const athLongTermVestingOfficialAthWalletAddress = contractAddress(athLongTermVestingAddress.workChain, athLongTermVestingOfficialAthWallet);

  const marketStabilitySellerOfficialAthWallet = await ATHWallet.init(0n, marketStabilitySellerAddress, athMasterAddress);
  const marketStabilitySellerOfficialAthWalletAddress = contractAddress(marketStabilitySellerAddress.workChain, marketStabilitySellerOfficialAthWallet);

  const protocolOwnedTreasuryDenylist: Array<[string, Address]> = [
    ['derived ath_master address', athMasterAddress],
    ['derived ath_treasury_owner_ath_wallet address', treasuryOwnerAthWalletAddress],
    ['derived ath_long_term_vesting address', athLongTermVestingAddress],
    ['derived ath_long_term_vesting_official_ath_wallet address', athLongTermVestingOfficialAthWalletAddress],
    ['derived buyback_burn address', buybackBurnAddress],
    ['derived buyback_burn_official_ath_wallet address', buybackBurnOfficialAthWalletAddress],
    ['derived market_stability_seller address', marketStabilitySellerAddress],
    ['derived market_stability_seller_official_ath_wallet address', marketStabilitySellerOfficialAthWalletAddress],
    ['derived capsulehub address', capsuleHubAddress],
    ['derived fee_accumulator address', feeAccumulatorAddress],
    ['derived profile_registry address', profileRegistryAddress],
    ['derived profile_registry_official_ath_wallet address', profileRegistryOfficialAthWalletAddress],
    ['derived username_registry address', usernameRegistryAddress],
    ['derived username_registry_official_ath_wallet address', usernameRegistryOfficialAthWalletAddress],
    ['derived vault address', vaultAddress],
    ['derived vault_official_ath_wallet address', vaultOfficialAthWalletAddress],
    ['placeholder vault_initial_capsulehub address', vaultCapsulePlaceholder],
    ['placeholder capsulehub_initial_vault address', capsuleVaultPlaceholder],
    ['placeholder username_registry_initial_ath_wallet address', usernameAthPlaceholder],
    ['placeholder profile_registry_initial_ath_wallet address', profileAthPlaceholder],
    ['manual_roles.genesis_controller_one_shot.address', genesisController],
    ['manual_roles.buyback_launch_controller.address', buybackLaunchController],
    ['manual_roles.market_stability_launch_controller.address', marketStabilityLaunchController],
  ];
  requireNotProtocolRole(tonTreasuryReceiver, 'manual_roles.ton_treasury_receiver.address', protocolOwnedTreasuryDenylist);
  requireNotProtocolRole(treasuryAthReceiver, 'manual_roles.treasury_ath_receiver.address', protocolOwnedTreasuryDenylist);
  requireNotProtocolRole(profileTreasuryAthReceiver, 'manual_roles.profile_registry_treasury_ath_receiver.address', protocolOwnedTreasuryDenylist);
  requireNotProtocolRole(marketTonTreasuryReceiver, 'manual_roles.market_stability_ton_treasury_receiver.address', protocolOwnedTreasuryDenylist);
  requireNotProtocolRole(marketReserveFunder, 'manual_roles.market_stability_reserve_funder.address', protocolOwnedTreasuryDenylist);

  const addresses: AddressMap = {
    ath_master: friendly(athMasterAddress),
    ath_long_term_vesting: friendly(athLongTermVestingAddress),
    ath_long_term_vesting_beneficiary: friendly(vestingBeneficiary),
    ath_long_term_vesting_official_ath_wallet: friendly(athLongTermVestingOfficialAthWalletAddress),
    ath_treasury_owner: friendly(athTreasuryOwner),
    ath_treasury_owner_ath_wallet: friendly(treasuryOwnerAthWalletAddress),
    buyback_burn: friendly(buybackBurnAddress),
    buyback_burn_initial_genesis_controller: friendly(genesisController),
    buyback_burn_launch_controller: friendly(buybackLaunchController),
    buyback_burn_official_ath_wallet: friendly(buybackBurnOfficialAthWalletAddress),
    market_stability_seller: friendly(marketStabilitySellerAddress),
    market_stability_seller_initial_genesis_controller: friendly(genesisController),
    market_stability_seller_launch_controller: friendly(marketStabilityLaunchController),
    market_stability_seller_official_ath_wallet: friendly(marketStabilitySellerOfficialAthWalletAddress),
    market_stability_reserve_funder: friendly(marketReserveFunder),
    market_stability_ton_treasury_receiver: friendly(marketTonTreasuryReceiver),
    capsulehub: friendly(capsuleHubAddress),
    capsulehub_initial_vault_placeholder: friendly(capsuleVaultPlaceholder),
    fee_accumulator: friendly(feeAccumulatorAddress),
    fee_accumulator_buyback_burn: friendly(buybackBurnAddress),
    fee_accumulator_ton_treasury_receiver: friendly(tonTreasuryReceiver),
    profile_registry: friendly(profileRegistryAddress),
    profile_registry_initial_ath_wallet_placeholder: friendly(profileAthPlaceholder),
    profile_registry_official_ath_wallet: friendly(profileRegistryOfficialAthWalletAddress),
    profile_registry_treasury_ath_receiver: friendly(profileTreasuryAthReceiver),
    treasury_ath_receiver: friendly(treasuryAthReceiver),
    username_registry: friendly(usernameRegistryAddress),
    username_registry_initial_ath_wallet_placeholder: friendly(usernameAthPlaceholder),
    genesis_controller_one_shot: friendly(genesisController),
    username_registry_official_ath_wallet: friendly(usernameRegistryOfficialAthWalletAddress),
    vault: friendly(vaultAddress),
    vault_ath_master: friendly(athMasterAddress),
    vault_initial_controller_slot: friendly(genesisController),
    vault_initial_genesis_controller: friendly(genesisController),
    vault_initial_capsulehub_placeholder: friendly(vaultCapsulePlaceholder),
    vault_official_ath_wallet: friendly(vaultOfficialAthWalletAddress),
  };

  const code_hashes: HashMap = {
    ath_master: codeHash('build/ATHMaster/ATHMaster_ATHMaster.code.boc'),
    ath_vesting: codeHash('build/ATHVesting/ATHVesting_ATHVesting.code.boc'),
    ath_wallet: codeHash('build/ATHWallet/ATHWallet_ATHWallet.code.boc'),
    buyback_burn: codeHash('build/BuybackBurn/BuybackBurn_BuybackBurn.code.boc'),
    market_stability_seller: codeHash('build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller.code.boc'),
    capsulehub: codeHash('build/CapsuleHub/CapsuleHub_CapsuleHub.code.boc'),
    fee_accumulator: codeHash('build/FeeAccumulator/FeeAccumulator_FeeAccumulator.code.boc'),
    profile_registry: codeHash('build/ProfileRegistry/ProfileRegistry_ProfileRegistry.code.boc'),
    username_nft_item: codeHash('build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem.code.boc'),
    username_registry: codeHash('build/UsernameRegistry/UsernameRegistry_UsernameRegistry.code.boc'),
    vault: codeHash('build/Vault/Vault_Vault.code.boc'),
  };

  const state_init_hashes: HashMap = {
    ath_master: stateInitHash(athMaster),
    ath_treasury_owner_ath_wallet: stateInitHash(treasuryOwnerAthWallet),
    ath_long_term_vesting_initial: stateInitHash(athLongTermVesting),
    ath_long_term_vesting_official_ath_wallet: stateInitHash(athLongTermVestingOfficialAthWallet),
    buyback_burn_initial: stateInitHash(buybackBurn),
    buyback_burn_official_ath_wallet: stateInitHash(buybackBurnOfficialAthWallet),
    market_stability_seller_initial: stateInitHash(marketStabilitySeller),
    market_stability_seller_official_ath_wallet: stateInitHash(marketStabilitySellerOfficialAthWallet),
    capsulehub_initial: stateInitHash(capsuleHub),
    fee_accumulator: stateInitHash(feeAccumulator),
    profile_registry_initial: stateInitHash(profileRegistry),
    profile_registry_official_ath_wallet: stateInitHash(profileRegistryOfficialAthWallet),
    username_registry_initial: stateInitHash(usernameRegistry),
    username_registry_official_ath_wallet: stateInitHash(usernameRegistryOfficialAthWallet),
    vault_initial: stateInitHash(vault),
    vault_official_ath_wallet: stateInitHash(vaultOfficialAthWallet),
  };

  const constants: ConstantMap = {
    ath_total_supply_atomic: '100000000000000000',
    ath_activity_airdrop_allocation_percent: '15',
    ath_initial_liquidity_allocation_percent: '15',
    ath_long_term_vesting_allocation_percent: '10',
    ath_market_stability_reserve_allocation_percent: '60',
    ath_initial_liquidity_allocation_atomic: '15000000000000000',
    ath_long_term_vesting_allocation_atomic: '10000000000000000',
    ath_long_term_vesting_period_count: '100',
    ath_long_term_vesting_period_seconds: '31536000',
    ath_long_term_vesting_period_unlock_amount_atomic: '100000000000000',
    ath_long_term_vesting_start_time_unix: athLongTermVestingStartTime.toString(),
    ath_market_stability_reserve_allocation_atomic: '60000000000000000',
    ath_market_stability_tranche_count: '20',
    ath_market_stability_tranche_percent: '3',
    ath_market_stability_tranche_atomic: '3000000000000000',
    ath_market_stability_start_multiplier: '2',
    ath_market_stability_end_multiplier: '21',
    buyback_offer_amount_nanotons: '50000000000',
    buyback_funding_envelope_nanotons: '51050000000',
    profile_avatar_price_ath_atomic: '100000000000',
    profile_avatar_max_parts: '16',
    username_pending_mint_stale_ttl_seconds: '86400',
    username_item_ack_forward_reserve_nanotons: '3000000',
    vault_pending_publish_stale_ttl_seconds: '86400',
    vault_activity_airdrop_total_atomic: '15000000000000000',
    vault_activity_airdrop_reward_per_message_atomic: '10000000000',
    vault_activity_airdrop_per_wallet_cap_atomic: '0',
  };

  const manifest = {
    profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
    version: 1,
    status: 'FINAL_GENESIS',
    manifest_hash_hex: '0'.repeat(64),
    addresses,
    code_hashes,
    state_init_hashes,
    constants,
    blockers_before_final_genesis: [],
  };
  manifest.manifest_hash_hex = computeFinalGenesisManifestHashHex(manifest);

  const initialStateInit = {
    ath_master: { address: athMasterAddress, stateInitHash: state_init_hashes.ath_master },
    ath_long_term_vesting: { address: athLongTermVestingAddress, stateInitHash: state_init_hashes.ath_long_term_vesting_initial },
    buyback_burn: { address: buybackBurnAddress, stateInitHash: state_init_hashes.buyback_burn_initial },
    market_stability_seller: { address: marketStabilitySellerAddress, stateInitHash: state_init_hashes.market_stability_seller_initial },
    fee_accumulator: { address: feeAccumulatorAddress, stateInitHash: state_init_hashes.fee_accumulator },
    vault: { address: vaultAddress, stateInitHash: state_init_hashes.vault_initial },
    capsulehub: { address: capsuleHubAddress, stateInitHash: state_init_hashes.capsulehub_initial },
    username_registry: { address: usernameRegistryAddress, stateInitHash: state_init_hashes.username_registry_initial },
    profile_registry: { address: profileRegistryAddress, stateInitHash: state_init_hashes.profile_registry_initial },
  };

  const report = {
    document: 'PLATHO.V1.MAINNET_FINAL_MANIFEST_DRAFT',
    generated_at: new Date().toISOString(),
    production_deploy_executed: false,
    roles_source: rolesPath,
    ath_metadata: {
      path: ATH_METADATA_PATH,
      content_hash_hex: athContent.contentHashHex,
      boc_sha256_hex: athContent.bocSha256Hex,
    },
    manifest,
    role_summary: Object.fromEntries(
      Object.entries(roles.manual_roles).map(([key, value]) => [
        key,
        {
          label: value.label ?? '',
          address: value.address ?? '',
          normalized_address: value.address ? friendly(Address.parse(value.address)) : '',
        },
      ]),
    ),
    initial_state_init: Object.fromEntries(
      Object.entries(initialStateInit).map(([key, value]) => [
        key,
        {
          address: friendly(value.address),
          raw_address: raw(value.address),
          state_init_hash: value.stateInitHash,
        },
      ]),
    ),
    official_ath_wallets: {
      vault_official_ath_wallet: friendly(vaultOfficialAthWalletAddress),
      ath_long_term_vesting_official_ath_wallet: friendly(athLongTermVestingOfficialAthWalletAddress),
      username_registry_official_ath_wallet: friendly(usernameRegistryOfficialAthWalletAddress),
      profile_registry_official_ath_wallet: friendly(profileRegistryOfficialAthWalletAddress),
      buyback_burn_official_ath_wallet: friendly(buybackBurnOfficialAthWalletAddress),
      market_stability_seller_official_ath_wallet: friendly(marketStabilitySellerOfficialAthWalletAddress),
    },
    derived_ath_wallets: {
      treasury_owner_ath_wallet: {
        address: friendly(treasuryOwnerAthWalletAddress),
        owner_address: friendly(athTreasuryOwner),
        ath_master_address: friendly(athMasterAddress),
        state_init_hash: stateInitHash(treasuryOwnerAthWallet),
        note: 'Target this wallet for final-genesis ATHTransferRequest funding messages; do not target official system ATH wallets directly.',
      },
    },
    funding_checklist: [
      {
        phase: 'final_genesis',
        required_balance_wallet: friendly(vaultOfficialAthWalletAddress),
        wallet_owner_address: friendly(vaultAddress),
        amount_ath: '15000000',
        amount_atomic: constants.vault_activity_airdrop_total_atomic,
        funding_route: 'Send ATHTransferRequest to treasury_owner_ath_wallet with recipient_owner_address set to Vault.',
        requirement: 'exact balance before mainnet_genesis_verify',
      },
      {
        phase: 'final_genesis',
        required_balance_wallet: friendly(athLongTermVestingOfficialAthWalletAddress),
        wallet_owner_address: friendly(athLongTermVestingAddress),
        amount_ath: '10000000',
        amount_atomic: constants.ath_long_term_vesting_allocation_atomic,
        funding_route: 'Send ATHTransferRequest to treasury_owner_ath_wallet with recipient_owner_address set to ATHVesting.',
        requirement: 'exact balance before mainnet_genesis_verify',
      },
      {
        phase: 'post_pool',
        required_balance_wallet: friendly(marketStabilitySellerOfficialAthWalletAddress),
        wallet_owner_address: friendly(marketStabilitySellerAddress),
        amount_ath: '60000000',
        amount_atomic: constants.ath_market_stability_reserve_allocation_atomic,
        funding_route: 'Fund only through MarketStabilitySeller reserve notify flow; direct ordinary transfer is unsupported.',
        requirement: 'fund only through MarketStabilitySeller reserve notify flow',
      },
    ],
    pre_seal_bindings: [
      ['BuybackBurn.BindBuybackFeeAccumulator', friendly(feeAccumulatorAddress)],
      ['BuybackBurn.BindBuybackOfficialAthWallet', friendly(buybackBurnOfficialAthWalletAddress)],
      ['MarketStabilitySeller.BindMarketStabilityReserveFunder', friendly(marketReserveFunder)],
      ['MarketStabilitySeller.BindMarketStabilityOfficialAthWallet', friendly(marketStabilitySellerOfficialAthWalletAddress)],
      ['MarketStabilitySeller.BindMarketStabilityTreasury', friendly(marketTonTreasuryReceiver)],
      ['Vault.BindDeploymentManifest.counterpart', friendly(capsuleHubAddress)],
      ['Vault.BindOfficialAthWallet', friendly(vaultOfficialAthWalletAddress)],
      ['Vault.BindProfileRegistry', friendly(profileRegistryAddress)],
      ['Vault.BindUsernameRegistry', friendly(usernameRegistryAddress)],
      ['CapsuleHub.BindDeploymentManifest.counterpart', friendly(vaultAddress)],
      ['UsernameRegistry.BindOfficialAthWallet', friendly(usernameRegistryOfficialAthWalletAddress)],
      ['UsernameRegistry.BindUsernameVault', friendly(vaultAddress)],
      ['ProfileRegistry.BindProfileOfficialAthWallet', friendly(profileRegistryOfficialAthWalletAddress)],
      ['ProfileRegistry.BindProfileVault', friendly(vaultAddress)],
    ],
    warnings: [
      'This is a local ignored draft. It is not a live getter snapshot and does not prove production deployment.',
      'Initial placeholder addresses are committed only to break StateInit circularity; final sealed state must bind the derived counterpart/official wallet addresses listed in pre_seal_bindings.',
      'Do not commit artifacts/local files if they start carrying operational notes about signer devices or role custody.',
    ],
  };

  return report;
}

function markdown(report: Awaited<ReturnType<typeof buildDraft>>): string {
  const m = report.manifest;
  const lines = [
    '# Mainnet Final Manifest Draft',
    '',
    `Generated: ${report.generated_at}`,
    `Production deploy executed: ${report.production_deploy_executed}`,
    '',
    '## Manifest',
    '',
    `- manifest_hash_hex: ${m.manifest_hash_hex}`,
    `- profile: ${m.profile}`,
    `- status: ${m.status}`,
    `- version: ${m.version}`,
    '',
    '## Manual Roles',
    '',
    '| Role | Label | Address |',
    '| --- | --- | --- |',
  ];

  for (const [key, value] of Object.entries(report.role_summary)) {
    lines.push(`| ${key} | ${value.label} | ${value.normalized_address} |`);
  }

  lines.push('', '## Contract Addresses', '', '| Contract | Address | StateInit hash |', '| --- | --- | --- |');
  for (const [key, value] of Object.entries(report.initial_state_init)) {
    lines.push(`| ${key} | ${value.address} | ${value.state_init_hash} |`);
  }

  lines.push('', '## Official ATH Wallets', '', '| Wallet | Address |', '| --- | --- |');
  for (const [key, value] of Object.entries(report.official_ath_wallets)) {
    lines.push(`| ${key} | ${value} |`);
  }

  lines.push('', '## Derived ATH Wallets', '', '| Wallet | Address | Owner | Note |', '| --- | --- | --- | --- |');
  for (const [key, value] of Object.entries(report.derived_ath_wallets)) {
    lines.push(`| ${key} | ${value.address} | ${value.owner_address} | ${value.note} |`);
  }

  lines.push('', '## Funding Checklist', '', '| Phase | Required Balance Wallet | Wallet Owner | Amount ATH | Funding Route | Requirement |', '| --- | --- | --- | ---: | --- | --- |');
  for (const row of report.funding_checklist) {
    lines.push(`| ${row.phase} | ${row.required_balance_wallet} | ${row.wallet_owner_address} | ${row.amount_ath} | ${row.funding_route} | ${row.requirement} |`);
  }

  lines.push('', '## Pre-Seal Bindings', '', '| Message | Value |', '| --- | --- |');
  for (const [message, value] of report.pre_seal_bindings) {
    lines.push(`| ${message} | ${value} |`);
  }

  lines.push('', '## Warnings', '');
  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const rolesPath = process.argv[2] ?? DEFAULT_ROLES_PATH;
  const report = await buildDraft(rolesPath);
  mkdirSync(ARTIFACTS_LOCAL_DIR, { recursive: true });
  writeFileSync(DEFAULT_OUTPUT_JSON, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(DEFAULT_OUTPUT_MD, markdown(report));
  console.log(JSON.stringify({
    ok: true,
    outputJson: DEFAULT_OUTPUT_JSON,
    outputMarkdown: DEFAULT_OUTPUT_MD,
    manifestHash: report.manifest.manifest_hash_hex,
    contractAddresses: Object.fromEntries(
      Object.entries(report.initial_state_init).map(([key, value]) => [key, value.address]),
    ),
    officialAthWallets: report.official_ath_wallets,
  }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
