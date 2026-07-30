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
  storeBindBuybackTreasury,
  storeSealBuybackBurnGenesis,
} from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import {
  FeeAccumulator,
  storeBindAirdropPool,
  storeBindShardCode,
  storeBindIntroShardCode,
  storeBindPublicShardCode,
  storeBindTicketCode,
} from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
// Lane/ticket CODE cells for the FeeAccumulator binds. The compiled code is independent of init args, so any
// arguments yield the cell that must be bound.
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
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
  AirdropPool,
  storeAirdropBindAthMaster,
  storeAirdropBindCreditIssuer,
  storeAirdropBindTreasury,
  storeAirdropSealGenesis,
} from '../build/AirdropPool/AirdropPool_AirdropPool';

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
// [ADDED 2026-07-29, wave-8 MED] Per-contract overrides where the flat 0.5 GRAM does not cover the contract's own
// lifetime rent. ATHVesting is the one contract whose schedule is a CENTURY long and which can go years without
// receiving a single message, so nothing tops it up along the way.
//
// MEASURED from build/ATHVesting/ATHVesting_ATHVesting.code.boc: 113 distinct code cells (62,008 bits) plus a data
// cell that spills in two at 1321 bits of fields — about 115 account cells. At the project's frozen storage rate of
// 64,962 nanoton per cell-year that is ~7,470,000 a year, so ~747,000,000 across the 100 periods of the schedule.
// The flat 500,000,000 left it short by a quarter of a GRAM and the account would have died around year 67, with the
// 10,000,000 ATH still inside and no way to reach it. 1.5 GRAM covers the century at twice the measured rent, which
// is the honest margin for a number that cannot be revised after the seal. See ATH_VESTING_LOCAL_EXEC_RESERVE, raised
// in the same change, which additionally lets each claim retain about a year of rent as it passes through.
const DEPLOY_VALUE_OVERRIDE_NANOTONS: Record<string, string> = {
  ATHVesting: '1500000000',
  // [ADDED 2026-07-30, tier-1 audit] The jetton master, funded for its own commitment horizon rather than for the
  // flat default. MEASURED from build/ATHMaster/ATHMaster_ATHMaster.code.boc: 97 distinct code cells, so with the
  // account and its data ~100 cells, and at the frozen 64,962 per cell-year that is 6,496,200 a year. The flat
  // 500,000,000 bought 77 years — against a 100-year ATHVesting schedule, on the ONE contract in this system that
  // can never be redeployed under any circumstance. Past that point burns stop being recorded and get_jetton_data
  // stops answering, so every explorer, wallet and DEX loses the token's identity. 1 GRAM buys ~154 years.
  ATHMaster: '1000000000',
};
const CONTROL_VALUE_RECOMMENDED_NANOTONS = '50000000';
// [RAISED 2026-07-29, wave-8 HIGH: 10M -> 620M] This one transaction both mints the 100,000,000 ATH and creates the
// treasury ATH wallet that holds all of it, and after the change in ATHMaster everything above the master's own
// 8,000,000 exec reserve is FORWARDED to that wallet as its permanent endowment instead of being refunded.
//
// MEASURED: the treasury wallet's rent is 5,132,011 nanoton a year. The token has to outlive the 100-year vesting
// schedule, so 100 years of rent is 513,201,100; 620,000,000 covers that plus the master's 8,000,000 and the
// wallet's own genesis gas, with room to spare. At the old 10,000,000 the wallet was left holding 1,624,999 — into
// storage debt inside the first year, with the entire supply inside it and no redeploy possible, ever.
const DEPLOY_TREASURY_SUPPLY_VALUE_RECOMMENDED_NANOTONS = '620000000';
// Floor = ATHWallet plain ATHTransferRequest required_value (contracts/ATHWallet.tact:549):
// EXEC_RESERVE(2M)+INTERNAL_TRANSFER_ACK(3M)+NOTIFY_STORAGE_ENDOWMENT(20M)+FWD_FEE_ALLOWANCE(21M)+OWNER_REQUEST_EXEC(2M)=48M.
// Raised 30M->48M / 40M->58M to track the NOTIFY_STORAGE_ENDOWMENT 2M->20M endowment raise; recommended carries a 10M buffer for forward fees.
const ATH_TRANSFER_REQUEST_VALUE_MIN_NANOTONS = '48000000';
const ATH_TRANSFER_REQUEST_VALUE_RECOMMENDED_NANOTONS = '58000000';

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

// THE FEE SINK IS BAKED INTO FOUR IMMUTABLE CONTRACTS, AND THIS IS THE ONLY PLACE THE CHECK CAN BE REAL.
// RecordShard/IntroShard/PublicShard/AirdropTicket each carry the FeeAccumulator address as a COMPILE-TIME constant.
// They are deployed lazily by users, and there is no bind to correct the value afterwards — AirdropTicket.tact says
// so outright. The address is a pure function of the FeeAccumulator code and (ton_treasury_receiver, BuybackBurn
// address), and BuybackBurn's address moves with the ATH metadata and the genesis controller. So editing almost
// anything upstream silently invalidates all four constants.
//
// WRITTEN BECAUSE IT HAPPENED (wave-7 audit, 2026-07-28). The constants were rebaked from the TEST FIXTURE's
// BuybackBurn literal (FA_BUYBACK) instead of the derived address, so every immutable contract pointed at a
// FeeAccumulator this ceremony would never deploy. Consequence on sealed contracts: each capsule fee goes to an
// uninitialised address, and the deposit acknowledgement from the REAL sink is refused by gates 13657/13685 —
// zero credits minted, the 15M ATH airdrop dead, unfixable.
//
// The suite's own PT-04b guard could not see it. It compares the constant against
// FeeAccumulator.init(FA_TREASURY, FA_BUYBACK) using that same fixture literal, so it faithfully proved the constant
// matched a FICTIONAL sink. A guard is only worth its calibration: this one runs against the roles the ceremony will
// actually sign with, and it refuses to emit a packet at all when they disagree.
const BAKED_FEE_SINKS: ReadonlyArray<readonly [string, string, RegExp]> = [
  ['RecordShard', 'contracts/RecordShard.tact', /const\s+RS_FEE_SINK:\s*Address\s*=\s*address\("([^"]+)"\)/],
  ['IntroShard', 'contracts/IntroShard.tact', /const\s+IS_FEE_SINK:\s*Address\s*=\s*address\("([^"]+)"\)/],
  ['PublicShard', 'contracts/PublicShard.tact', /const\s+PS_FEE_SINK:\s*Address\s*=\s*address\("([^"]+)"\)/],
  ['AirdropTicket', 'contracts/AirdropTicket.tact', /const\s+AT_FEE_SINK:\s*Address\s*=\s*address\("([^"]+)"\)/],
];

export function readBakedFeeSinks(): Array<{ contract: string; address: Address }> {
  return BAKED_FEE_SINKS.map(([contract, path, pattern]) => {
    const match = pattern.exec(readFileSync(path, 'utf8'));
    // A missing constant is a HARD failure, never a skip: a renamed constant would otherwise turn this guard off.
    if (!match) throw new Error(`${contract}: no baked FEE SINK constant found in ${path}`);
    return { contract, address: Address.parse(match[1]) };
  });
}

function assertBakedFeeSinksMatch(feeAccumulatorAddress: Address) {
  const wrong = readBakedFeeSinks().filter(({ address }) => !address.equals(feeAccumulatorAddress));
  if (wrong.length === 0) return;
  const detail = wrong.map(({ contract, address }) => `  ${contract}: baked ${friendly(address)}`).join('\n');
  throw new Error(
    'BAKED FEE SINK MISMATCH — this ceremony would deploy a FeeAccumulator the immutable contracts do not point at.\n'
    + `  ceremony deploys: ${friendly(feeAccumulatorAddress)}\n${detail}\n`
    + '  Rebake the constants (contracts/*.tact), rebuild those projects, regenerate web/shard-code.mjs, and re-run.',
  );
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
  assertBakedFeeSinksMatch(feeAccumulatorAddress);

  // clean-17: AirdropPool replaces Vault (15M airdrop custodian), CapsuleHub is removed. Staged deploy — manifest
  // hash 0, config 0, unsealed; the real manifest hash is bound at AirdropSealGenesis (must run AFTER funding).
  const airdropPool = await AirdropPool.init(genesisController, 0n, 0n, false);
  const airdropPoolAddress = contractAddress(0, airdropPool);

  const usernameRegistry = await UsernameRegistry.init(usernameAthPlaceholder, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, genesisController);
  const usernameRegistryAddress = contractAddress(0, usernameRegistry);

  const profileRegistry = await ProfileRegistry.init(profileAthPlaceholder, athMasterAddress, profileTreasuryAthReceiver, false, 0n, 0n, genesisController);
  const profileRegistryAddress = contractAddress(0, profileRegistry);

  const airdropPoolOfficialAthWallet = await ATHWallet.init(0n, airdropPoolAddress, athMasterAddress);
  const airdropPoolOfficialAthWalletAddress = contractAddress(0, airdropPoolOfficialAthWallet);

  const athLongTermVestingOfficialAthWallet = await ATHWallet.init(0n, athLongTermVestingAddress, athMasterAddress);
  const athLongTermVestingOfficialAthWalletAddress = contractAddress(0, athLongTermVestingOfficialAthWallet);

  const treasuryOwnerAthWallet = await ATHWallet.init(0n, athTreasuryOwner, athMasterAddress);
  const treasuryOwnerAthWalletAddress = contractAddress(0, treasuryOwnerAthWallet);

  const buybackBurnOfficialAthWallet = await ATHWallet.init(0n, buybackBurnAddress, athMasterAddress);
  const buybackBurnOfficialAthWalletAddress = contractAddress(buybackBurnAddress.workChain, buybackBurnOfficialAthWallet);

  const marketStabilitySellerOfficialAthWallet = await ATHWallet.init(0n, marketStabilitySellerAddress, athMasterAddress);
  const marketStabilitySellerOfficialAthWalletAddress = contractAddress(marketStabilitySellerAddress.workChain, marketStabilitySellerOfficialAthWallet);

  const usernameRegistryOfficialAthWallet = await ATHWallet.init(0n, usernameRegistryAddress, athMasterAddress);
  const usernameRegistryOfficialAthWalletAddress = contractAddress(usernameRegistryAddress.workChain, usernameRegistryOfficialAthWallet);

  const profileRegistryOfficialAthWallet = await ATHWallet.init(0n, profileRegistryAddress, athMasterAddress);
  const profileRegistryOfficialAthWalletAddress = contractAddress(profileRegistryAddress.workChain, profileRegistryOfficialAthWallet);

  const initial = {
    ath_master: { init: athMaster, address: athMasterAddress, manifestKey: 'ath_master', stateKey: 'ath_master' },
    ath_long_term_vesting: { init: athLongTermVesting, address: athLongTermVestingAddress, manifestKey: 'ath_long_term_vesting', stateKey: 'ath_long_term_vesting_initial' },
    buyback_burn: { init: buybackBurn, address: buybackBurnAddress, manifestKey: 'buyback_burn', stateKey: 'buyback_burn_initial' },
    market_stability_seller: { init: marketStabilitySeller, address: marketStabilitySellerAddress, manifestKey: 'market_stability_seller', stateKey: 'market_stability_seller_initial' },
    fee_accumulator: { init: feeAccumulator, address: feeAccumulatorAddress, manifestKey: 'fee_accumulator', stateKey: 'fee_accumulator' },
    airdrop_pool: { init: airdropPool, address: airdropPoolAddress, manifestKey: 'airdrop_pool', stateKey: 'airdrop_pool_initial' },
    username_registry: { init: usernameRegistry, address: usernameRegistryAddress, manifestKey: 'username_registry', stateKey: 'username_registry_initial' },
    profile_registry: { init: profileRegistry, address: profileRegistryAddress, manifestKey: 'profile_registry', stateKey: 'profile_registry_initial' },
  };

  for (const [label, value] of Object.entries(initial)) {
    const expectedAddress = manifestAddress(draft, value.manifestKey);
    const expectedHash = draft.manifest.state_init_hashes[value.stateKey];
    assertAddress(label, value.address, expectedAddress);
    assertStateHash(label, stateInitCell(value.init).hash().toString('hex'), expectedHash);
  }

  assertAddress('AirdropPool official ATH wallet', airdropPoolOfficialAthWalletAddress, manifestAddress(draft, 'airdrop_pool_official_ath_wallet'));
  assertStateHash('AirdropPool official ATH wallet', stateInitCell(airdropPoolOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.airdrop_pool_official_ath_wallet);
  assertAddress('ATHVesting official ATH wallet', athLongTermVestingOfficialAthWalletAddress, manifestAddress(draft, 'ath_long_term_vesting_official_ath_wallet'));
  assertStateHash('ATHVesting official ATH wallet', stateInitCell(athLongTermVestingOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.ath_long_term_vesting_official_ath_wallet);
  assertAddress('Treasury Owner ATH wallet', treasuryOwnerAthWalletAddress, manifestAddress(draft, 'ath_treasury_owner_ath_wallet'));
  assertStateHash('Treasury Owner ATH wallet', stateInitCell(treasuryOwnerAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.ath_treasury_owner_ath_wallet);
  assertAddress('BuybackBurn official ATH wallet', buybackBurnOfficialAthWalletAddress, manifestAddress(draft, 'buyback_burn_official_ath_wallet'));
  assertStateHash('BuybackBurn official ATH wallet', stateInitCell(buybackBurnOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.buyback_burn_official_ath_wallet);
  assertAddress('MarketStabilitySeller official ATH wallet', marketStabilitySellerOfficialAthWalletAddress, manifestAddress(draft, 'market_stability_seller_official_ath_wallet'));
  assertStateHash('MarketStabilitySeller official ATH wallet', stateInitCell(marketStabilitySellerOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.market_stability_seller_official_ath_wallet);
  assertAddress('UsernameRegistry official ATH wallet', usernameRegistryOfficialAthWalletAddress, manifestAddress(draft, 'username_registry_official_ath_wallet'));
  assertStateHash('UsernameRegistry official ATH wallet', stateInitCell(usernameRegistryOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.username_registry_official_ath_wallet);
  assertAddress('ProfileRegistry official ATH wallet', profileRegistryOfficialAthWalletAddress, manifestAddress(draft, 'profile_registry_official_ath_wallet'));
  assertStateHash('ProfileRegistry official ATH wallet', stateInitCell(profileRegistryOfficialAthWallet).hash().toString('hex'), draft.manifest.state_init_hashes.profile_registry_official_ath_wallet);

  return {
    addresses: {
      athTreasuryOwner,
      genesisController,
      athMaster: athMasterAddress,
      athLongTermVesting: athLongTermVestingAddress,
      buybackBurn: buybackBurnAddress,
      marketStabilitySeller: marketStabilitySellerAddress,
      feeAccumulator: feeAccumulatorAddress,
      airdropPool: airdropPoolAddress,
      usernameRegistry: usernameRegistryAddress,
      profileRegistry: profileRegistryAddress,
      airdropPoolOfficialAthWallet: airdropPoolOfficialAthWalletAddress,
      athLongTermVestingOfficialAthWallet: athLongTermVestingOfficialAthWalletAddress,
      treasuryOwnerAthWallet: treasuryOwnerAthWalletAddress,
      buybackBurnOfficialAthWallet: buybackBurnOfficialAthWalletAddress,
      marketStabilitySellerOfficialAthWallet: marketStabilitySellerOfficialAthWalletAddress,
      usernameRegistryOfficialAthWallet: usernameRegistryOfficialAthWalletAddress,
      profileRegistryOfficialAthWallet: profileRegistryOfficialAthWalletAddress,
    },
    initial,
    officialWalletStateInits: {
      ath_treasury_owner_ath_wallet: { address: treasuryOwnerAthWalletAddress, init: treasuryOwnerAthWallet, owner: athTreasuryOwner, athMaster: athMasterAddress },
      ath_long_term_vesting_official_ath_wallet: { address: athLongTermVestingOfficialAthWalletAddress, init: athLongTermVestingOfficialAthWallet, owner: athLongTermVestingAddress, athMaster: athMasterAddress },
      airdrop_pool_official_ath_wallet: { address: airdropPoolOfficialAthWalletAddress, init: airdropPoolOfficialAthWallet, owner: airdropPoolAddress, athMaster: athMasterAddress },
      buyback_burn_official_ath_wallet: { address: buybackBurnOfficialAthWalletAddress, init: buybackBurnOfficialAthWallet, owner: buybackBurnAddress, athMaster: athMasterAddress },
      market_stability_seller_official_ath_wallet: { address: marketStabilitySellerOfficialAthWalletAddress, init: marketStabilitySellerOfficialAthWallet, owner: marketStabilitySellerAddress, athMaster: athMasterAddress },
      username_registry_official_ath_wallet: { address: usernameRegistryOfficialAthWalletAddress, init: usernameRegistryOfficialAthWallet, owner: usernameRegistryAddress, athMaster: athMasterAddress },
      profile_registry_official_ath_wallet: { address: profileRegistryOfficialAthWalletAddress, init: profileRegistryOfficialAthWallet, owner: profileRegistryAddress, athMaster: athMasterAddress },
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
    ['D07', 'AirdropPool', 'genesis_controller_one_shot', derived.addresses.airdropPool, derived.initial.airdrop_pool.init],
    ['D08', 'UsernameRegistry', 'genesis_controller_one_shot', derived.addresses.usernameRegistry, derived.initial.username_registry.init],
    ['D09', 'ProfileRegistry', 'genesis_controller_one_shot', derived.addresses.profileRegistry, derived.initial.profile_registry.init],
  ].map(([id, contract, signerRole, target, init]) => ({
    id,
    contract,
    signer_role: signerRole,
    signer_address: friendly(roleAddress(draft, signerRole as string)),
    target_address: friendly(target as Address),
    target_raw_address: raw(target as Address),
    value_nanotons_recommended: DEPLOY_VALUE_OVERRIDE_NANOTONS[contract as string] ?? DEPLOY_VALUE_RECOMMENDED_NANOTONS,
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

  // ── W1-001 / W1-002 (audit 2026-07-24): binds that were MISSING from every packet builder ──────────────────
  // Without them the standard ceremony CANNOT complete genesis, and the broadcaster does not notice because it
  // checks seqno advance, not the seal getter:
  //   * BuybackBurn.SealBuybackBurnGenesis (S04) throws 22509 (treasury_bound) -> BuybackBurn stays sealed=false
  //     FOREVER. MarketStabilitySeller had its treasury bind (B05); BuybackBurn's was simply never written.
  //   * FeeAccumulator.DepositCapsuleFee throws 15055 (laneCodeBound) and TicketRedeem throws 15060 (ticket_code)
  //     -> EVERY capsule fee bounces, 0 GRAM reaches the pool and the 15M ATH activity airdrop is unreachable.
  // The compiled CODE cell does not depend on init arguments, so any arguments yield the cell that must be bound.
  const laneCodes = {
    record: (await RecordShard.init(0n, 0n)).code,
    intro: (await IntroShard.init(0n, 0n)).code,
    publicLane: (await PublicShard.init(0n, 0n)).code,
    ticket: (await AirdropTicket.init(derived.addresses.feeAccumulator)).code,
  };

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
    // clean-17 AirdropPool pre-seal binds. NOTE: AirdropBind* structs carry NO deployment_manifest_hash field (the
    // Vault binds did) — the pool commits to the manifest only at AirdropSealGenesis. Order within the bind phase:
    // AthMaster must precede the F01 funding (gate 26011 ath_master_bound on the fund receiver).
    {
      id: 'B06',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.airdropPool),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'AirdropPool.AirdropBindAthMaster',
        bodyCell(storeAirdropBindAthMaster({
          $$type: 'AirdropBindAthMaster',
          ath_master_address: derived.addresses.athMaster,
          pool_ath_wallet_address: derived.addresses.airdropPoolOfficialAthWallet,
        })),
        { ath_master_address: friendly(derived.addresses.athMaster), pool_ath_wallet_address: friendly(derived.addresses.airdropPoolOfficialAthWallet) },
      ),
    },
    {
      id: 'B07',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.airdropPool),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      // clean-17: the accrual authenticator ("credit_issuer_address") is the FeeAccumulator address, NOT a CreditIssuer
      // contract (CreditIssuer is deleted). The field name is a clean-16 holdover; the bound value is fee_accumulator.
      body: txBody(
        'AirdropPool.AirdropBindCreditIssuer',
        bodyCell(storeAirdropBindCreditIssuer({
          $$type: 'AirdropBindCreditIssuer',
          credit_issuer_address: derived.addresses.feeAccumulator,
        })),
        { credit_issuer_address: friendly(derived.addresses.feeAccumulator) },
      ),
    },
    {
      id: 'B08',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.airdropPool),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'AirdropPool.AirdropBindTreasury',
        bodyCell(storeAirdropBindTreasury({
          $$type: 'AirdropBindTreasury',
          treasury_address: roleAddress(draft, 'treasury_ath_receiver'),
        })),
        { treasury_address: friendly(roleAddress(draft, 'treasury_ath_receiver')) },
      ),
    },
    {
      id: 'B09',
      phase: 'pre_seal_binding',
      // CRITICAL: FeeAccumulator.BindAirdropPool is guarded by requireTreasury() (gate 15050, sender ==
      // treasury_receiver_address == ton_treasury_receiver). It MUST be signed by ton_treasury_receiver, NOT the
      // genesis controller — otherwise it bounces exit 15050 on-chain and the accrual routing is never wired.
      signer_role: 'ton_treasury_receiver',
      signer_address: friendly(roleAddress(draft, 'ton_treasury_receiver')),
      target_address: friendly(derived.addresses.feeAccumulator),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'FeeAccumulator.BindAirdropPool',
        bodyCell(storeBindAirdropPool({
          $$type: 'BindAirdropPool',
          airdrop_pool_address: derived.addresses.airdropPool,
        })),
        { airdrop_pool_address: friendly(derived.addresses.airdropPool) },
      ),
    },
    {
      id: 'B10',
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
      id: 'B11',
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
      id: 'B12',
      phase: 'pre_seal_binding',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.buybackBurn),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'BuybackBurn.BindBuybackTreasury',
        bodyCell(storeBindBuybackTreasury({
          $$type: 'BindBuybackTreasury',
          deployment_manifest_hash: manifestHash,
          treasury_address: roleAddress(draft, 'ton_treasury_receiver'),
        })),
        { deployment_manifest_hash_hex: mh, treasury_address: friendly(roleAddress(draft, 'ton_treasury_receiver')) },
      ),
      safety_check: 'W1-001. Without this bind SealBuybackBurnGenesis (S04) throws 22509 and BuybackBurn stays '
        + 'UNSEALED forever. CONFIRM THE ROLE BEFORE SIGNING: this one-shot bind fixes, permanently, where '
        + 'BuybackBurn sweeps stuck TON (SweepStuckReserveToTreasury). It is set to ton_treasury_receiver — the same '
        + 'protocol TON treasury FeeAccumulator uses — because no buyback-specific treasury role exists in the '
        + 'manifest; MarketStabilitySeller by contrast has its own market_stability_ton_treasury_receiver.',
    },
    {
      id: 'B13',
      phase: 'pre_seal_binding',
      // CRITICAL: all four FeeAccumulator code binds are guarded by requireTreasury() (gate 15050), exactly like
      // BindAirdropPool (B09). They MUST be signed by ton_treasury_receiver, NOT the genesis controller.
      signer_role: 'ton_treasury_receiver',
      signer_address: friendly(roleAddress(draft, 'ton_treasury_receiver')),
      target_address: friendly(derived.addresses.feeAccumulator),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'FeeAccumulator.BindShardCode',
        bodyCell(storeBindShardCode({ $$type: 'BindShardCode', shard_code: laneCodes.record })),
        { shard_code_hash_hex: laneCodes.record.hash().toString('hex') },
      ),
      safety_check: 'W1-002, lane 0 (CONV/RecordShard). Without it every CONV capsule fee bounces at gate 15055.',
    },
    {
      id: 'B14',
      phase: 'pre_seal_binding',
      signer_role: 'ton_treasury_receiver',
      signer_address: friendly(roleAddress(draft, 'ton_treasury_receiver')),
      target_address: friendly(derived.addresses.feeAccumulator),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'FeeAccumulator.BindIntroShardCode',
        bodyCell(storeBindIntroShardCode({ $$type: 'BindIntroShardCode', intro_shard_code: laneCodes.intro })),
        { intro_shard_code_hash_hex: laneCodes.intro.hash().toString('hex') },
      ),
      safety_check: 'W1-002, lane 1 (INTRO). Without it every INTRO capsule fee bounces at gate 15055.',
    },
    {
      id: 'B15',
      phase: 'pre_seal_binding',
      signer_role: 'ton_treasury_receiver',
      signer_address: friendly(roleAddress(draft, 'ton_treasury_receiver')),
      target_address: friendly(derived.addresses.feeAccumulator),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'FeeAccumulator.BindPublicShardCode',
        bodyCell(storeBindPublicShardCode({ $$type: 'BindPublicShardCode', public_shard_code: laneCodes.publicLane })),
        { public_shard_code_hash_hex: laneCodes.publicLane.hash().toString('hex') },
      ),
      safety_check: 'W1-002, lane 2 (PUBLIC/avatar). Without it every public capsule fee bounces at gate 15055.',
    },
    {
      id: 'B16',
      phase: 'pre_seal_binding',
      signer_role: 'ton_treasury_receiver',
      signer_address: friendly(roleAddress(draft, 'ton_treasury_receiver')),
      target_address: friendly(derived.addresses.feeAccumulator),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody(
        'FeeAccumulator.BindTicketCode',
        bodyCell(storeBindTicketCode({ $$type: 'BindTicketCode', ticket_code: laneCodes.ticket })),
        { ticket_code_hash_hex: laneCodes.ticket.hash().toString('hex') },
      ),
      safety_check: 'W1-002. Without it TicketRedeem throws 15060 and the 15M ATH activity airdrop never accrues.',
    },
    {
      id: 'S01',
      // Runs in the seal phase, which the ceremony executes AFTER the fund phase — AirdropSealGenesis requires
      // funded_amount == 15M (gate 26044). This seal BINDS the real manifest hash into the pool (message name is
      // AirdropSealGenesis; gate 26040 requires hash > 1).
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.airdropPool),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('AirdropPool.AirdropSealGenesis', bodyCell(storeAirdropSealGenesis({ $$type: 'AirdropSealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S02',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.usernameRegistry),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('UsernameRegistry.SealGenesis', bodyCell(storeUsernameSealGenesis({ $$type: 'SealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S03',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.profileRegistry),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('ProfileRegistry.SealGenesis', bodyCell(storeProfileSealGenesis({ $$type: 'SealGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S04',
      phase: 'seal',
      signer_role: 'genesis_controller_one_shot',
      signer_address: friendly(derived.addresses.genesisController),
      target_address: friendly(derived.addresses.buybackBurn),
      value_nanotons_recommended: CONTROL_VALUE_RECOMMENDED_NANOTONS,
      body: txBody('BuybackBurn.SealBuybackBurnGenesis', bodyCell(storeSealBuybackBurnGenesis({ $$type: 'SealBuybackBurnGenesis', deployment_manifest_hash: manifestHash })), { deployment_manifest_hash_hex: mh }),
    },
    {
      id: 'S05',
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
      purpose: 'Fund AirdropPool activity airdrop backing with exactly 15M ATH',
      query_id: 1001n,
      recipient_owner: derived.addresses.airdropPool,
      expected_recipient_ath_wallet: derived.addresses.airdropPoolOfficialAthWallet,
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
      // NOT last, despite living in a separate array printed after the seals. The real constraint is a SANDWICH,
      // and both edges are enforced on chain:
      //   B06 (AirdropBindAthMaster) -> THIS -> off-chain balance verify -> S01 (AirdropSealGenesis)
      // Too early: the pool's AthTransferNotification hits gate 26011 (ath_master_bound) / 26019 (sender must be the
      // pool's OWN bound wallet), the notification bounces, and funded_amount stays 0 while 15M ATH sits in the
      // wallet — after which S01 throws 26044 forever and the pool can never be sealed.
      // Too late: S01 throws 26044 (funded_amount == AIRDROP_TOTAL_POOL) — loud, but mid-ceremony on a one-shot
      // controller message.
      // The phase NAME says "final" only in the sense of final genesis; it does not mean "sign these last".
      phase: 'final_genesis_funding',
      must_be_signed_after: 'B06',
      must_be_signed_before: 'S01',
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
    lifecycle_stage: 'pre_execution_tx_dry_run_template',
    lifecycle_note: 'production_deploy_executed=false means this local dry-run packet is a pre-execution template; live release truth comes from mainnet_genesis_verify_report.json after fresh verification.',
    source_draft_generated_at: draft.generated_at,
    // THE ORDER IS PART OF THE DESIGN, AND THE FILE LAYOUT DOES NOT EXPRESS IT. Funding lives in its own array
    // printed after control_messages (which ends with the seals), so an operator working this file top to bottom
    // would sign the seals before the funding. State the canonical sequence explicitly, once, where it cannot be
    // missed. Audited 2026-07-28: both edges of the funding step are enforced on chain (26011/26019 below it,
    // 26044 above it), so a wrong order fails loudly rather than silently — but failing loudly mid-ceremony on a
    // one-shot controller message is still the thing this line exists to prevent.
    execution_order: [
      { step: 1, phase: 'deploy_contracts', note: 'D01..D09. ATHMaster first; FeeAccumulator before any shard address is derived.' },
      { step: 2, phase: 'deploy_treasury_supply', note: 'D02. The 100M genesis supply reaches the Treasury Owner ATHWallet.' },
      { step: 3, phase: 'pre_seal_binding', note: 'B01..B16. All one-shot. B06 must precede the funding: without ath_master_bound the pool refuses the deposit notification.' },
      { step: 4, phase: 'final_genesis_funding', note: 'F01..F02. AFTER B06, BEFORE S01 — not last, despite appearing last in this file.' },
      { step: 5, phase: 'off_chain_verification', note: 'Read the official ATH wallet balances and AirdropPool.funded_amount. This is the last point at which a mistake is still correctable.' },
      { step: 6, phase: 'seal', note: 'S01..S05. Irreversible. Never seal-then-fund: AirdropSealGenesis gate 26044 requires funded_amount == 15M.' },
    ],
    manifest_hash_hex: mh,
    treasury_owner_ath_wallet: {
      address: friendly(derived.addresses.treasuryOwnerAthWallet),
      raw_address: raw(derived.addresses.treasuryOwnerAthWallet),
      state_init: stateInitArtifact(derived.officialWalletStateInits.ath_treasury_owner_ath_wallet.init),
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
          owner_address: friendly(value.owner),
          ath_master_address: friendly(value.athMaster),
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
    `Production deploy executed: ${packet.production_deploy_executed}`,
    `Lifecycle stage: ${packet.lifecycle_stage}`,
    `Lifecycle note: ${packet.lifecycle_note}`,
    '',
    '## Treasury Owner ATHWallet',
    '',
    `- Address: ${packet.treasury_owner_ath_wallet.address}`,
    `- StateInit hash: ${packet.treasury_owner_ath_wallet.state_init.cell_hash_hex}`,
    `- Note: ${packet.treasury_owner_ath_wallet.note}`,
    '',
    '## Official ATHWallet StateInit Artifacts',
    '',
    '| Key | Address | Owner | StateInit hash |',
    '| --- | --- | --- | --- |',
  ];

  for (const [key, wallet] of Object.entries(packet.official_wallet_state_inits)) {
    lines.push(`| ${key} | ${wallet.address} | ${wallet.owner_address} | ${wallet.state_init.cell_hash_hex} |`);
  }

  lines.push(
    '',
    '## Deploy Contracts',
    '',
    '| Step | Contract | Target | StateInit hash | Value Recommended |',
    '| --- | --- | --- | --- | ---: |',
  );

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
