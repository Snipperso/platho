import { Address, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { BuybackBurn } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { CapsuleHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { MarketStabilitySeller } from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import { ProfileRegistry } from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { UsernameRegistry } from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { Vault } from '../build/Vault/Vault_Vault';

export const MANIFEST_DOMAIN = 'PLATHO.V1.DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15';
export const MANIFEST_VERSION = 15;
export const MANIFEST_STATUS = 'IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS';

export type AddressMap = Record<string, string>;
export type HashMap = Record<string, string>;
export type ConstantMap = Record<string, string>;

export type ImplementedSubsetManifest = {
  profile: string;
  version: number;
  status: string;
  manifest_hash_hex: string;
  manifest_hash_uint256: string;
  manifest_cell_hash_hex: string;
  addresses: AddressMap;
  code_hashes: HashMap;
  state_init_hashes: HashMap;
  constants: ConstantMap;
  blockers_before_final_genesis: string[];
};

export type ImplementedSubsetInits = {
  athMaster: Awaited<ReturnType<typeof ATHMaster.init>>;
  buybackBurn: Awaited<ReturnType<typeof BuybackBurn.init>>;
  marketStabilitySeller: Awaited<ReturnType<typeof MarketStabilitySeller.init>>;
  vault: Awaited<ReturnType<typeof Vault.init>>;
  capsuleHub: Awaited<ReturnType<typeof CapsuleHub.init>>;
  feeAccumulator: Awaited<ReturnType<typeof FeeAccumulator.init>>;
  usernameRegistry: Awaited<ReturnType<typeof UsernameRegistry.init>>;
  profileRegistry: Awaited<ReturnType<typeof ProfileRegistry.init>>;
};

export type ImplementedSubsetBuild = {
  manifest: ImplementedSubsetManifest;
  manifestCell: Cell;
  inits: ImplementedSubsetInits;
  parsed: {
    athMasterAddress: Address;
    buybackBurnAddress: Address;
    marketStabilitySellerAddress: Address;
    vaultAddress: Address;
    capsuleHubAddress: Address;
    feeAccumulatorAddress: Address;
    usernameRegistryAddress: Address;
    profileRegistryAddress: Address;
    buybackBurnOfficialAthWalletAddress: Address;
    marketStabilitySellerOfficialAthWalletAddress: Address;
    vaultOfficialAthWalletAddress: Address;
    usernameRegistryOfficialAthWalletAddress: Address;
    profileRegistryOfficialAthWalletAddress: Address;
  };
};

export function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.M15.${label}`).digest());
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function codeHash(path: string): string {
  return Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
}

function stateInitHash(init: { code: Cell; data: Cell }): string {
  return beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
}

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function sortedEntries<T extends Record<string, string>>(map: T): [string, string][] {
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function labeledAddressListCell(addresses: AddressMap): Cell {
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

function labeledHashListCell(hashes: HashMap): Cell {
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

function labeledUIntListCell(values: ConstantMap): Cell {
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

export function computeManifestCell(args: {
  addresses: AddressMap;
  code_hashes: HashMap;
  state_init_hashes: HashMap;
  constants: ConstantMap;
  blockers_before_final_genesis: string[];
}): Cell {
  const hashes: HashMap = {
    ...args.code_hashes,
    ...Object.fromEntries(Object.entries(args.state_init_hashes).map(([k, v]) => [`state_init.${k}`, v])),
  };
  return beginCell()
    .storeBuffer(sha256(MANIFEST_DOMAIN))
    .storeUint(MANIFEST_VERSION, 16)
    .storeUint(1, 1) // implemented-subset marker; this cell is not final genesis while blockers remain
    .storeRef(labeledAddressListCell(args.addresses))
    .storeRef(labeledHashListCell(hashes))
    .storeRef(labeledUIntListCell(args.constants))
    .storeRef(blockersCell(args.blockers_before_final_genesis))
    .endCell();
}

export async function buildImplementedSubsetManifest(): Promise<ImplementedSubsetBuild> {
  const athTreasuryOwner = fixtureAddress('ATH_TREASURY_OWNER');
  const tonTreasuryReceiver = fixtureAddress('TON_TREASURY_RECEIVER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');
  const profileTreasuryAthReceiver = fixtureAddress('PROFILE_TREASURY_ATH_RECEIVER');

  const vaultCapsulePlaceholder = fixtureAddress('VAULT_CAPSULEHUB_PLACEHOLDER');
  const capsuleVaultPlaceholder = fixtureAddress('CAPSULEHUB_VAULT_PLACEHOLDER');
  const usernameAthPlaceholder = fixtureAddress('USERNAME_REGISTRY_ATH_WALLET_PLACEHOLDER');
  const profileAthPlaceholder = fixtureAddress('PROFILE_REGISTRY_ATH_WALLET_PLACEHOLDER');
  const genesisController = fixtureAddress('GENESIS_CONTROLLER_ONE_SHOT');

  const athMaster = await ATHMaster.init(athTreasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
  const athMasterAddress = contractAddress(0, athMaster);

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

  const profileRegistryOfficialAthWallet = await ATHWallet.init(0n, profileRegistryAddress, athMasterAddress);
  const profileRegistryOfficialAthWalletAddress = contractAddress(profileRegistryAddress.workChain, profileRegistryOfficialAthWallet);

  const buybackBurnOfficialAthWallet = await ATHWallet.init(0n, buybackBurnAddress, athMasterAddress);
  const buybackBurnOfficialAthWalletAddress = contractAddress(buybackBurnAddress.workChain, buybackBurnOfficialAthWallet);

  const marketStabilitySellerOfficialAthWallet = await ATHWallet.init(0n, marketStabilitySellerAddress, athMasterAddress);
  const marketStabilitySellerOfficialAthWalletAddress = contractAddress(marketStabilitySellerAddress.workChain, marketStabilitySellerOfficialAthWallet);

  const addresses: AddressMap = {
    ath_master: athMasterAddress.toString(),
    ath_treasury_owner: athTreasuryOwner.toString(),
    buyback_burn: buybackBurnAddress.toString(),
    buyback_burn_initial_genesis_controller: genesisController.toString(),
    buyback_burn_official_ath_wallet: buybackBurnOfficialAthWalletAddress.toString(),
    market_stability_seller: marketStabilitySellerAddress.toString(),
    market_stability_seller_initial_genesis_controller: genesisController.toString(),
    market_stability_seller_official_ath_wallet: marketStabilitySellerOfficialAthWalletAddress.toString(),
    market_stability_reserve_funder: athTreasuryOwner.toString(),
    market_stability_ton_treasury_receiver: tonTreasuryReceiver.toString(),
    capsulehub: capsuleHubAddress.toString(),
    capsulehub_initial_vault_placeholder: capsuleVaultPlaceholder.toString(),
    fee_accumulator: feeAccumulatorAddress.toString(),
    fee_accumulator_buyback_burn: buybackBurnAddress.toString(),
    fee_accumulator_ton_treasury_receiver: tonTreasuryReceiver.toString(),
    profile_registry: profileRegistryAddress.toString(),
    profile_registry_initial_ath_wallet_placeholder: profileAthPlaceholder.toString(),
    profile_registry_official_ath_wallet: profileRegistryOfficialAthWalletAddress.toString(),
    profile_registry_treasury_ath_receiver: profileTreasuryAthReceiver.toString(),
    treasury_ath_receiver: treasuryAthReceiver.toString(),
    username_registry: usernameRegistryAddress.toString(),
    username_registry_initial_ath_wallet_placeholder: usernameAthPlaceholder.toString(),
    genesis_controller_one_shot: genesisController.toString(),
    username_registry_official_ath_wallet: usernameRegistryOfficialAthWalletAddress.toString(),
    vault: vaultAddress.toString(),
    vault_ath_master: athMasterAddress.toString(),
    vault_initial_controller_slot: genesisController.toString(),
    vault_initial_genesis_controller: genesisController.toString(),
    vault_initial_capsulehub_placeholder: vaultCapsulePlaceholder.toString(),
    vault_official_ath_wallet: vaultOfficialAthWalletAddress.toString(),
  };

  const code_hashes: HashMap = {
    ath_master: codeHash('build/ATHMaster/ATHMaster_ATHMaster.code.boc'),
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
    ath_activity_airdrop_allocation_percent: '30',
    ath_initial_liquidity_allocation_percent: '15',
    ath_treasury_operations_allocation_percent: '10',
    ath_market_stability_reserve_allocation_percent: '45',
    ath_founder_allocation_percent: '0',
    ath_initial_liquidity_allocation_atomic: '15000000000000000',
    ath_treasury_operations_allocation_atomic: '10000000000000000',
    ath_market_stability_reserve_allocation_atomic: '45000000000000000',
    ath_market_stability_tranche_count: '15',
    ath_market_stability_tranche_percent: '3',
    ath_market_stability_tranche_atomic: '3000000000000000',
    ath_market_stability_start_multiplier: '2',
    ath_market_stability_end_multiplier: '16',
    buyback_offer_amount_nanotons: '50000000000',
    buyback_funding_envelope_nanotons: '51050000000',
    profile_avatar_price_ath_atomic: '100000000000',
    profile_avatar_max_parts: '16',
    username_pending_mint_stale_ttl_seconds: '86400',
    username_item_ack_forward_reserve_nanotons: '3000000',
    vault_pending_publish_stale_ttl_seconds: '86400',
    vault_activity_airdrop_total_atomic: '30000000000000000',
    vault_activity_airdrop_reward_per_message_atomic: '10000000000',
    vault_activity_airdrop_per_wallet_cap_atomic: '0',
  };

  const blockers_before_final_genesis = [
    'ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT',
    'BUYBACKBURN_POST_POOL_ROUTE_FREEZE_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE',
    'STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED',
    'MARKET_STABILITY_SELLER_PRICING_MUST_BE_FROZEN_FROM_FINAL_POOL_LAUNCH_EVIDENCE',
    'MARKET_STABILITY_RESERVE_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_SELLER_ATH_WALLET_BEFORE_USE',
    'FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES',
    'VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS',
  ];

  const manifestCell = computeManifestCell({ addresses, code_hashes, state_init_hashes, constants, blockers_before_final_genesis });
  const manifestHash = manifestCell.hash();
  const manifest: ImplementedSubsetManifest = {
    profile: MANIFEST_DOMAIN,
    version: MANIFEST_VERSION,
    status: MANIFEST_STATUS,
    manifest_hash_hex: manifestHash.toString('hex'),
    manifest_hash_uint256: BigInt(`0x${manifestHash.toString('hex')}`).toString(),
    manifest_cell_hash_hex: manifestHash.toString('hex'),
    addresses,
    code_hashes,
    state_init_hashes,
    constants,
    blockers_before_final_genesis,
  };

  return {
    manifest,
    manifestCell,
    inits: { athMaster, buybackBurn, marketStabilitySeller, vault, capsuleHub, feeAccumulator, usernameRegistry, profileRegistry },
    parsed: {
      athMasterAddress,
      buybackBurnAddress,
      marketStabilitySellerAddress,
      vaultAddress,
      capsuleHubAddress,
      feeAccumulatorAddress,
      usernameRegistryAddress,
      profileRegistryAddress,
      buybackBurnOfficialAthWalletAddress,
      marketStabilitySellerOfficialAthWalletAddress,
      vaultOfficialAthWalletAddress,
      usernameRegistryOfficialAthWalletAddress,
      profileRegistryOfficialAthWalletAddress,
    },
  };
}

export function assertFinalGenesisReady(manifest: ImplementedSubsetManifest) {
  if (manifest.blockers_before_final_genesis.length > 0) {
    throw new Error(`Final genesis manifest blocked: ${manifest.blockers_before_final_genesis.join('; ')}`);
  }
}

async function main() {
  const { manifest } = await buildImplementedSubsetManifest();
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/deployment_manifest_implemented_subset_m15.json', JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync('artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt', manifest.manifest_hash_hex + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
