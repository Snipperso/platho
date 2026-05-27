import { Address, Builder, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ATHMaster, storeDeployTreasurySupply } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHVesting } from '../build/ATHVesting/ATHVesting_ATHVesting';
import { ATHWallet, storeATHTransferRequest } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  BuybackBurn,
  storeBindBuybackFeeAccumulator,
  storeBindBuybackOfficialAthWallet,
  storeSealBuybackBurnGenesis,
} from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import {
  CapsuleHub,
  storeBindDeploymentManifest as storeCapsuleBindDeploymentManifest,
  storeSealGenesis as storeCapsuleSealGenesis,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import {
  MarketStabilitySeller,
  storeBindMarketStabilityOfficialAthWallet,
  storeBindMarketStabilityReserveFunder,
  storeBindMarketStabilityTreasury,
  storeSealMarketStabilityGenesis,
} from '../build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller';
import {
  ProfileRegistry,
  storeBindProfileOfficialAthWallet,
  storeSealGenesis as storeProfileSealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import {
  UsernameRegistry,
  storeBindOfficialAthWallet as storeUsernameBindOfficialAthWallet,
  storeSealGenesis as storeUsernameSealGenesis,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  Vault,
  storeBindDeploymentManifest as storeVaultBindDeploymentManifest,
  storeBindOfficialAthWallet as storeVaultBindOfficialAthWallet,
  storeSealGenesis as storeVaultSealGenesis,
} from '../build/Vault/Vault_Vault';

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
};

type ContractInit = { code: Cell; data: Cell };

const ARTIFACTS_LOCAL_DIR = join(process.cwd(), 'artifacts', 'local');
const DEFAULT_DRAFT_PATH = join(ARTIFACTS_LOCAL_DIR, 'mainnet_final_manifest_draft.json');
const DEFAULT_OUTPUT_JSON = join(ARTIFACTS_LOCAL_DIR, 'mainnet_tx_dry_run_packet.json');
const DEFAULT_OUTPUT_MD = join(ARTIFACTS_LOCAL_DIR, 'MAINNET_TX_DRY_RUN_PACKET.md');
const ATH_METADATA_PATH = join(process.cwd(), 'artifacts', 'ath_metadata_content.json');

const DEPLOY_VALUE_RECOMMENDED_NANOTONS = '500000000';
const CONTROL_VALUE_RECOMMENDED_NANOTONS = '50000000';
const DEPLOY_TREASURY_SUPPLY_VALUE_RECOMMENDED_NANOTONS = '10000000';
const ATH_TRANSFER_REQUEST_VALUE_MIN_NANOTONS = '30000000';
const ATH_TRANSFER_REQUEST_VALUE_RECOMMENDED_NANOTONS = '40000000';

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function friendly(address: Address): string {
  return address.toString({ bounceable: false, testOnly: false });
}

function raw(address: Address): string {
  return `${address.workChain}:${address.hash.toString('hex')}`;
}

function parseAddress(value: string, label: string): Address {
  if (!value) throw new Error(`${label} is missing`);
  const address = Address.parse(value);
  if (address.workChain !== 0) {
    throw new Error(`${label} must be workchain 0, got ${address.workChain}`);
  }
  return address;
}

function addressHash(address: Address): bigint {
  return BigInt(`0x${beginCell().storeAddress(address).endCell().hash().toString('hex')}`);
}

function placeholderAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.MAINNET.STATEINIT_PLACEHOLDER.${label}`).digest());
}

function stateInitCell(init: ContractInit): Cell {
  return beginCell().store(storeStateInit(init)).endCell();
}

function bodyCell(store: (builder: Builder) => void): Cell {
  return beginCell().store(store).endCell();
}

function cellArtifact(cell: Cell) {
  const boc = cell.toBoc();
  return {
    cell_hash_hex: cell.hash().toString('hex'),
    boc_sha256_hex: sha256Hex(boc),
    boc_base64: boc.toString('base64'),
    bits: cell.bits.length,
    refs: cell.refs.length,
  };
}

function stateInitArtifact(init: ContractInit) {
  const cell = stateInitCell(init);
  return {
    ...cellArtifact(cell),
    code_hash_hex: init.code.hash().toString('hex'),
    data_hash_hex: init.data.hash().toString('hex'),
  };
}

function loadDraft(path: string): Draft {
  if (!existsSync(path)) throw new Error(`Missing manifest draft: ${path}`);
  const draft = JSON.parse(readFileSync(path, 'utf8')) as Draft;
  if (draft.document !== 'PLATHO.V1.MAINNET_FINAL_MANIFEST_DRAFT') {
    throw new Error(`Unexpected draft document: ${draft.document}`);
  }
  if (draft.production_deploy_executed !== false) {
    throw new Error('Draft claims production_deploy_executed is not false');
  }
  return draft;
}

function roleAddress(draft: Draft, key: string): Address {
  return parseAddress(draft.role_summary[key]?.normalized_address ?? '', `role_summary.${key}.normalized_address`);
}

function manifestAddress(draft: Draft, key: string): Address {
  return parseAddress(draft.manifest.addresses[key] ?? '', `manifest.addresses.${key}`);
}

function manifestHashBigInt(draft: Draft): bigint {
  const value = draft.manifest.manifest_hash_hex;
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`Invalid manifest_hash_hex: ${value}`);
  }
  return BigInt(`0x${value}`);
}

function constantBigInt(draft: Draft, key: string): bigint {
  const value = draft.manifest.constants[key];
  if (!/^[0-9]+$/.test(value ?? '')) throw new Error(`Missing/invalid manifest constant ${key}`);
  return BigInt(value);
}

function readAthContentCell(): Cell {
  const artifact = JSON.parse(readFileSync(ATH_METADATA_PATH, 'utf8')) as {
    contentBocBase64: string;
    contentHashHex: string;
    bocSha256Hex: string;
  };
  const boc = Buffer.from(artifact.contentBocBase64, 'base64');
  if (sha256Hex(boc) !== artifact.bocSha256Hex) {
    throw new Error('ATH metadata BOC sha256 mismatch');
  }
  const cells = Cell.fromBoc(boc);
  if (cells.length !== 1) throw new Error('ATH metadata BOC must contain exactly one root cell');
  if (cells[0].hash().toString('hex') !== artifact.contentHashHex) {
    throw new Error('ATH metadata content hash mismatch');
  }
  return cells[0];
}

function assertAddress(label: string, actual: Address, expected: Address) {
  if (!actual.equals(expected)) {
    throw new Error(`${label} address mismatch: actual=${friendly(actual)} expected=${friendly(expected)}`);
  }
}

function assertStateHash(label: string, actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`${label} state init hash mismatch: actual=${actual} expected=${expected}`);
  }
}

async function deriveState(draft: Draft) {
  const athTreasuryOwner = roleAddress(draft, 'ath_treasury_owner');
  const genesisController = roleAddress(draft, 'genesis_controller_one_shot');
  const vestingBeneficiary = roleAddress(draft, 'ath_long_term_vesting_beneficiary');
  const tonTreasuryReceiver = roleAddress(draft, 'ton_treasury_receiver');
  const treasuryAthReceiver = roleAddress(draft, 'treasury_ath_receiver');
  const profileTreasuryAthReceiver = roleAddress(draft, 'profile_registry_treasury_ath_receiver');
  const athContent = readAthContentCell();
  const vestingStartTime = constantBigInt(draft, 'ath_long_term_vesting_start_time_unix');

  const vaultCapsulePlaceholder = placeholderAddress('VAULT_INITIAL_CAPSULEHUB_COUNTERPART');
  const capsuleVaultPlaceholder = placeholderAddress('CAPSULEHUB_INITIAL_VAULT_COUNTERPART');
  const usernameAthPlaceholder = placeholderAddress('USERNAME_REGISTRY_INITIAL_ATH_WALLET');
  const profileAthPlaceholder = placeholderAddress('PROFILE_REGISTRY_INITIAL_ATH_WALLET');

  const athMaster = await ATHMaster.init(athTreasuryOwner, athContent);
  const athMasterAddress = contractAddress(0, athMaster);

  const athLongTermVesting = await ATHVesting.init(athMasterAddress, vestingBeneficiary, vestingStartTime);
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
  const vaultOfficialAthWalletAddress = contractAddress(0, vaultOfficialAthWallet);

  const athLongTermVestingOfficialAthWallet = await ATHWallet.init(0n, athLongTermVestingAddress, athMasterAddress);
  const athLongTermVestingOfficialAthWalletAddress = contractAddress(0, athLongTermVestingOfficialAthWallet);

  const treasuryOwnerAthWallet = await ATHWallet.init(0n, athTreasuryOwner, athMasterAddress);
  const treasuryOwnerAthWalletAddress = contractAddress(0, treasuryOwnerAthWallet);

  const initial = {
    ath_master: { init: athMaster, address: athMasterAddress, manifestKey: 'ath_master', stateKey: 'ath_master' },
    ath_long_term_vesting: { init: athLongTermVesting, address: athLongTermVestingAddress, manifestKey: 'ath_long_term_vesting', stateKey: 'ath_long_term_vesting_initial' },
    buyback_burn: { init: buybackBurn, address: buybackBurnAddress, manifestKey: 'buyback_burn', stateKey: 'buyback_burn_initial' },
    market_stability_seller: { init: marketStabilitySeller, address: marketStabilitySellerAddress, manifestKey: 'market_stability_seller', stateKey: 'market_stability_seller_initial' },
    fee_accumulator: { init: feeAccumulator, address: feeAccumulatorAddress, manifestKey: 'fee_accumulator', stateKey: 'fee_accumulator' },
    vault: { init: vault, address: vaultAddress, manifestKey: 'vault', stateKey: 'vault_initial' },
    capsulehub: { init: capsuleHub, address: capsuleHubAddress, manifestKey: 'capsulehub', stateKey: 'capsulehub_initial' },
    username_registry: { init: usernameRegistry, address: usernameRegistryAddress, manifestKey: 'username_registry', stateKey: 'username_registry_initial' },
    profile_registry: { init: profileRegistry, address: profileRegistryAddress, manifestKey: 'profile_registry', stateKey: 'profile_registry_initial' },
  };

  for (const [label, value] of Object.entries(initial)) {
    const expectedAddress = manifestAddress(draft, value.manifestKey);
    const expectedHash = draft.manifest.state_init_hashes[value.stateKey];
    assertAddress(label, value.address, expectedAddress);
    assertStateHash(label, stateInitCell(value.init).hash().toString('hex'), expectedHash);
  }

  assertAddress('vault official ATH wallet', vaultOfficialAthWalletAddress, manifestAddress(draft, 'vault_official_ath_wallet'));
  assertStateHash('vault official ATH wallet', stateInitCell(vaultOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.vault_official_ath_wallet);
  assertAddress('ATHVesting official ATH wallet', athLongTermVestingOfficialAthWalletAddress, manifestAddress(draft, 'ath_long_term_vesting_official_ath_wallet'));
  assertStateHash('ATHVesting official ATH wallet', stateInitCell(athLongTermVestingOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.ath_long_term_vesting_official_ath_wallet);

  return {
    addresses: {
      athTreasuryOwner,
      genesisController,
      athMaster: athMasterAddress,
      athLongTermVesting: athLongTermVestingAddress,
      buybackBurn: buybackBurnAddress,
      marketStabilitySeller: marketStabilitySellerAddress,
      feeAccumulator: feeAccumulatorAddress,
      vault: vaultAddress,
      capsuleHub: capsuleHubAddress,
      usernameRegistry: usernameRegistryAddress,
      profileRegistry: profileRegistryAddress,
      vaultOfficialAthWallet: vaultOfficialAthWalletAddress,
      athLongTermVestingOfficialAthWallet: athLongTermVestingOfficialAthWalletAddress,
      treasuryOwnerAthWallet: treasuryOwnerAthWalletAddress,
    },
    initial,
    officialWalletStateInits: {
      vault_official_ath_wallet: { address: vaultOfficialAthWalletAddress, init: vaultOfficialAthWallet },
      ath_long_term_vesting_official_ath_wallet: { address: athLongTermVestingOfficialAthWalletAddress, init: athLongTermVestingOfficialAthWallet },
      treasury_owner_ath_wallet: { address: treasuryOwnerAthWalletAddress, init: treasuryOwnerAthWallet },
    },
  };
}

function txBody(label: string, cell: Cell, params: Record<string, unknown>) {
  return {
    label,
    ...cellArtifact(cell),
    params,
  };
}

async function buildDryRunPacket(draft: Draft) {
  const derived = await deriveState(draft);
  const manifestHash = manifestHashBigInt(draft);
  const mh = draft.manifest.manifest_hash_hex;

  const deploys = [
    ['D01', 'ATHMaster', 'ath_treasury_owner', derived.addresses.athMaster, derived.initial.ath_master.init],
    ['D03', 'BuybackBurn', 'genesis_controller_one_shot', derived.addresses.buybackBurn, derived.initial.buyback_burn.init],
    ['D04', 'MarketStabilitySeller', 'genesis_controller_one_shot', derived.addresses.marketStabilitySeller, derived.initial.market_stability_seller.init],
    ['D05', 'FeeAccumulator', 'ton_treasury_receiver', derived.addresses.feeAccumulator, derived.initial.fee_accumulator.init],
    ['D06', 'ATHVesting', 'ath_long_term_vesting_beneficiary', derived.addresses.athLongTermVesting, derived.initial.ath_long_term_vesting.init],
    ['D07', 'Vault', 'genesis_controller_one_shot', derived.addresses.vault, derived.initial.vault.init],
    ['D08', 'CapsuleHub', 'genesis_controller_one_shot', derived.addresses.capsuleHub, derived.initial.capsulehub.init],
    ['D09', 'UsernameRegistry', 'genesis_controller_one_shot', derived.addresses.usernameRegistry, derived.initial.username_registry.init],
    ['D10', 'ProfileRegistry', 'genesis_controller_one_shot', derived.addresses.profileRegistry, derived.initial.profile_registry.init],
  ].map(([id, contract, signerRole, target, init]) => ({
    id,
    contract,
    signer_role: signerRole,
    signer_address: friendly(roleAddress(draft, signerRole as string)),
    target_address: friendly(target as Address),
    target_raw_address: raw(target as Address),
    value_nanotons_recommended: DEPLOY_VALUE_RECOMMENDED_NANOTONS,
    body: null,
    state_init: stateInitArtifact(init as ContractInit),
    safety_check: 'Tonkeeper preview target address and StateInit hash must match this packet before signing.',
  }));

  const deployTreasurySupplyBody = txBody(
    'ATHMaster.DeployTreasurySupply',
    bodyCell(storeDeployTreasurySupply({
      $$type: 'DeployTreasurySupply',
      query_id: 1n,
      response_destination: derived.addresses.athTreasuryOwner,
    })),
    {
      query_id: '1',
      response_destination: friendly(derived.addresses.athTreasuryOwner),
    },
  );

  const controlMessages = [
    {
      id: 'D02',
      phase: 'deploy_treasury_supply',
      signer_role: 'ath_treasury_owner',
      signer_address: friendly(derived.addresses.athTreasuryOwner),
      target_address: friendly(derived.addresses.athMaster),
      value_nanotons_recommended: DEPLOY_TREASURY_SUPPLY_VALUE_RECOMMENDED_NANOTONS,
      body: deployTreasurySupplyBody,
      safety_check: 'After success, Treasury Owner ATHWallet must hold exactly 100M ATH.',
    },
    {
      id: 'B01',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.buybackBurn),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'BuybackBurn.BindBuybackFeeAccumulator',
        bodyCell(storeBindBuybackFeeAccumulator({
          $$type: 'BindBuybackFeeAccumulator',
          deployment_manifest_hash: manifestHash,
          fee_accumulator_address: derived.addresses.feeAccumulator,
        })),
        { deployment_manifest_hash_hex: mh, fee_accumulator_address: friendly(derived.addresses.feeAccumulator) },
      ),
    },
    {
      id: 'B02',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.buybackBurn),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'BuybackBurn.BindBuybackOfficialAthWallet',
        bodyCell(storeBindBuybackOfficialAthWallet({
          $$type: 'BindBuybackOfficialAthWallet',
          deployment_manifest_hash: manifestHash,
          official_ath_wallet_address: manifestAddress(draft, 'buyback_burn_official_ath_wallet'),
        })),
        { deployment_manifest_hash_hex: mh, official_ath_wallet_address: draft.manifest.addresses.buyback_burn_official_ath_wallet },
      ),
    },
    {
      id: 'B03',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.marketStabilitySeller),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'MarketStabilitySeller.BindMarketStabilityReserveFunder',
        bodyCell(storeBindMarketStabilityReserveFunder({
          $$type: 'BindMarketStabilityReserveFunder',
          deployment_manifest_hash: manifestHash,
          reserve_funder_address: roleAddress(draft, 'market_stability_reserve_funder'),
        })),
        { deployment_manifest_hash_hex: mh, reserve_funder_address: friendly(roleAddress(draft, 'market_stability_reserve_funder')) },
      ),
    },
    {
      id: 'B04',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.marketStabilitySeller),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'MarketStabilitySeller.BindMarketStabilityOfficialAthWallet',
        bodyCell(storeBindMarketStabilityOfficialAthWallet({
          $$type: 'BindMarketStabilityOfficialAthWallet',
          deployment_manifest_hash: manifestHash,
          official_ath_wallet_address: manifestAddress(draft, 'market_stability_seller_official_ath_wallet'),
        })),
        { deployment_manifest_hash_hex: mh, official_ath_wallet_address: draft.manifest.addresses.market_stability_seller_official_ath_wallet },
      ),
    },
    {
      id: 'B05',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.marketStabilitySeller),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'MarketStabilitySeller.BindMarketStabilityTreasury',
        bodyCell(storeBindMarketStabilityTreasury({
          $$type: 'BindMarketStabilityTreasury',
          deployment_manifest_hash: manifestHash,
          ton_treasury_receiver_address: roleAddress(draft, 'market_stability_ton_treasury_receiver'),
        })),
        { deployment_manifest_hash_hex: mh, ton_treasury_receiver_address: friendly(roleAddress(draft, 'market_stability_ton_treasury_receiver')) },
      ),
    },
    {
      id: 'B06',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.vault),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'Vault.BindDeploymentManifest',
        bodyCell(storeVaultBindDeploymentManifest({
          $$type: 'BindDeploymentManifest',
          deployment_manifest_hash: manifestHash,
          counterpart_address: derived.addresses.capsuleHub,
        })),
        { deployment_manifest_hash_hex: mh, counterpart_address: friendly(derived.addresses.capsuleHub) },
      ),
    },
    {
      id: 'B07',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.vault),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'Vault.BindOfficialAthWallet',
        bodyCell(storeVaultBindOfficialAthWallet({
          $$type: 'BindOfficialAthWallet',
          deployment_manifest_hash: manifestHash,
          official_ath_wallet_address: derived.addresses.vaultOfficialAthWallet,
        })),
        { deployment_manifest_hash_hex: mh, official_ath_wallet_address: friendly(derived.addresses.vaultOfficialAthWallet) },
      ),
    },
    {
      id: 'B08',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.capsuleHub),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'CapsuleHub.BindDeploymentManifest',
        bodyCell(storeCapsuleBindDeploymentManifest({
          $$type: 'BindDeploymentManifest',
          deployment_manifest_hash: manifestHash,
          counterpart_address: derived.addresses.vault,
        })),
        { deployment_manifest_hash_hex: mh, counterpart_address: friendly(derived.addresses.vault) },
      ),
    },
    {
      id: 'B09',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.usernameRegistry),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'UsernameRegistry.BindOfficialAthWallet',
        bodyCell(storeUsernameBindOfficialAthWallet({
          $$type: 'BindOfficialAthWallet',
          deployment_manifest_hash: manifestHash,
          official_ath_wallet_address: manifestAddress(draft, 'username_registry_official_ath_wallet'),
        })),
        { deployment_manifest_hash_hex: mh, official_ath_wallet_address: draft.manifest.addresses.username_registry_official_ath_wallet },
      ),
    },
    {
      id: 'B10',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.profileRegistry),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'ProfileRegistry.BindProfileOfficialAthWallet',
        bodyCell(storeBindProfileOfficialAthWallet({
          $$type: 'BindProfileOfficialAthWallet',
          deployment_manifest_hash: manifestHash,
          official_ath_wallet_address: manifestAddress(draft, 'profile_registry_official_ath_wallet'),
        })),
        { deployment_manifest_hash_hex: mh, official_ath_wallet_address: draft.manifest.addresses.profile_registry_official_ath_wallet },
      ),
    },
    {
      id: 'S01',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.vault),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('Vault.SealGenesis', bodyCell(storeVaultSealGenesis({ $$type: 'SealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S02',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.capsuleHub),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('CapsuleHub.SealGenesis', bodyCell(storeCapsuleSealGenesis({ $$type: 'SealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S03',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.usernameRegistry),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('UsernameRegistry.SealGenesis', bodyCell(storeUsernameSealGenesis({ $$type: 'SealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S04',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.profileRegistry),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('ProfileRegistry.SealGenesis', bodyCell(storeProfileSealGenesis({ $$type: 'SealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S05',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.buybackBurn),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('BuybackBurn.SealBuybackBurnGenesis', bodyCell(storeSealBuybackBurnGenesis({ $$type: 'SealBuybackBurnGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S06',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.marketStabilitySeller),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('MarketStabilitySeller.SealMarketStabilityGenesis', bodyCell(storeSealMarketStabilityGenesis({ $$type: 'SealMarketStabilityGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
  ];

  const fundingMessages = [
    {
      id: 'F01',
      purpose: 'Fund Vault activity airdrop backing with exactly 15M ATH',
      query_id: 1001n,
      recipient_owner: derived.addresses.vault,
      expected_recipient_ath_wallet: derived.addresses.vaultOfficialAthWallet,
      amount_atomic: constantBigInt(draft, 'vault_activity_airdrop_total_atomic'),
    },
    {
      id: 'F02',
      purpose: 'Fund ATHVesting long-term vesting backing with exactly 10M ATH',
      query_id: 1002n,
      recipient_owner: derived.addresses.athLongTermVesting,
      expected_recipient_ath_wallet: derived.addresses.athLongTermVestingOfficialAthWallet,
      amount_atomic: constantBigInt(draft, 'ath_long_term_vesting_allocation_atomic'),
    },
  ].map((funding) => {
    const cell = bodyCell(storeATHTransferRequest({
      $$type: 'ATHTransferRequest',
      query_id: funding.query_id,
      amount: funding.amount_atomic,
      recipient: funding.recipient_owner,
      response_destination: derived.addresses.athTreasuryOwner,
    }));
    return {
      id: funding.id,
      phase: 'final_genesis_funding',
      signer_role: 'ath_treasury_owner',
      signer_address: friendly(derived.addresses.athTreasuryOwner),
      target_address: friendly(derived.addresses.treasuryOwnerAthWallet),
      target_is: 'Treasury Owner ATHWallet, not the recipient official wallet',
      value_nanotons_min: ATH_TRANSFER_REQUEST_VALUE_MIN_NANOTONS,
      value_nanotons_recommended: ATH_TRANSFER_REQUEST_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(`ATHWallet.ATHTransferRequest.${funding.id}`, cell, {
        query_id: funding.query_id.toString(),
        amount_atomic: funding.amount_atomic.toString(),
        recipient_owner_address: friendly(funding.recipient_owner),
        expected_recipient_ath_wallet: friendly(funding.expected_recipient_ath_wallet),
        response_destination: friendly(derived.addresses.athTreasuryOwner),
      }),
      safety_check: 'Tonkeeper target must be the Treasury Owner ATHWallet. The message recipient field must be the recipient OWNER contract; the recipient official ATHWallet is derived inside ATHWallet.',
    };
  });

  return {
    document: 'PLATHO.V1.MAINNET_TX_DRY_RUN_PACKET',
    generated_at: new Date().toISOString(),
    production_deploy_executed: false,
    source_draft_generated_at: draft.generated_at,
    manifest_hash_hex: mh,
    treasury_owner_ath_wallet: {
      address: friendly(derived.addresses.treasuryOwnerAthWallet),
      raw_address: raw(derived.addresses.treasuryOwnerAthWallet),
      state_init: stateInitArtifact(derived.officialWalletStateInits.treasury_owner_ath_wallet.init),
      note: 'This wallet receives the 100M ATH genesis supply after ATHMaster.DeployTreasurySupply and is the target for later ATHTransferRequest funding messages.',
    },
    deploy_contracts: deploys,
    control_messages: controlMessages,
    funding_messages: fundingMessages,
    official_wallet_state_inits: Object.fromEntries(
      Object.entries(derived.officialWalletStateInits).map(([key, value]) => [
        key,
        {
          address: friendly(value.address),
          raw_address: raw(value.address),
          state_init: stateInitArtifact(value.init),
        },
      ]),
    ),
    warnings: [
      'This packet is dry-run serialization only. It does not send transactions and does not contain private keys.',
      'Re-run mainnet:manifest:draft and mainnet:tx:dry-run immediately before signing production transactions.',
      'Stop if Tonkeeper/Tonviewer displays a target address, StateInit hash, or body hash different from this packet.',
      'Funding messages must target the Treasury Owner ATHWallet; direct ordinary transfers to official system ATHWallets are unsupported unless generated by this packet flow.',
    ],
  };
}

function markdown(packet: Awaited<ReturnType<typeof buildDryRunPacket>>): string {
  const lines = [
    '# Mainnet Transaction Dry-Run Packet',
    '',
    `Generated: ${packet.generated_at}`,
    `Manifest hash: ${packet.manifest_hash_hex}`,
    '',
    '## Treasury Owner ATHWallet',
    '',
    `- Address: ${packet.treasury_owner_ath_wallet.address}`,
    `- StateInit hash: ${packet.treasury_owner_ath_wallet.state_init.cell_hash_hex}`,
    `- Note: ${packet.treasury_owner_ath_wallet.note}`,
    '',
    '## Deploy Contracts',
    '',
    '| Step | Contract | Target | StateInit hash | Value Recommended |',
    '| --- | --- | --- | --- | ---: |',
  ];

  for (const step of packet.deploy_contracts) {
    lines.push(`| ${step.id} | ${step.contract} | ${step.target_address} | ${step.state_init.cell_hash_hex} | ${step.value_nanotons_recommended} |`);
  }

  lines.push('', '## Control Messages', '', '| Step | Phase | Target | Body | Body hash | Value Recommended |', '| --- | --- | --- | --- | --- | ---: |');
  for (const step of packet.control_messages) {
    lines.push(`| ${step.id} | ${step.phase} | ${step.target_address} | ${step.body.label} | ${step.body.cell_hash_hex} | ${step.value_nanotons_recommended} |`);
  }

  lines.push('', '## Final Genesis Funding Messages', '', '| Step | Target | Body | Body hash | Amount Atomic | Recipient Owner | Expected Official Wallet |', '| --- | --- | --- | --- | ---: | --- | --- |');
  for (const step of packet.funding_messages) {
    const params = step.body.params as Record<string, string>;
    lines.push(`| ${step.id} | ${step.target_address} | ${step.body.label} | ${step.body.cell_hash_hex} | ${params.amount_atomic} | ${params.recipient_owner_address} | ${params.expected_recipient_ath_wallet} |`);
  }

  lines.push('', '## Warnings', '');
  for (const warning of packet.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const draftPath = process.argv[2] ?? DEFAULT_DRAFT_PATH;
  const draft = loadDraft(draftPath);
  const packet = await buildDryRunPacket(draft);
  mkdirSync(ARTIFACTS_LOCAL_DIR, { recursive: true });
  writeFileSync(DEFAULT_OUTPUT_JSON, JSON.stringify(packet, null, 2) + '\n');
  writeFileSync(DEFAULT_OUTPUT_MD, markdown(packet));
  console.log(JSON.stringify({
    ok: true,
    outputJson: DEFAULT_OUTPUT_JSON,
    outputMarkdown: DEFAULT_OUTPUT_MD,
    manifestHash: packet.manifest_hash_hex,
    deployContracts: packet.deploy_contracts.length,
    controlMessages: packet.control_messages.length,
    fundingMessages: packet.funding_messages.length,
    treasuryOwnerAthWallet: packet.treasury_owner_ath_wallet.address,
  }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
