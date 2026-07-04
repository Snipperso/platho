import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  AthTransferNotificationVaultMintUsername,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  UsernameRegistry,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  NftTransfer,
  ResendDeployedAck,
  UsernameNFTItem,
} from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const MANIFEST_HASH = 0x555345524e414d455f53544f524147455f45434f4e4f4d49435300000001n;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_4 = 10_000_000_000_000n;
const PRICE_5 = 1_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = 6_000_000n;
const USERNAME_STATE_GROWTH_EXEC_RESERVE = 4_000_000n;
const USERNAME_NFT_ITEM_DEPLOY_RESERVE = 500_000_000n;
const USERNAME_ATH_NOTIFICATION_ACK_VALUE = 1_000_000n;
const USERNAME_NAME_RECORD_STORAGE_ENDOWMENT = 36_000_000n; // dedicated century-rent endowment for the never-evicted name_records entry (mirrors PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT)
// The registry retains 6M endowment + 500M item deploy reserve + 1M ack value + 4M state-growth reserve + 36M
// name-record endowment = 547M, then forwards the 500M deploy reserve to the item. The notify message must carry
// the full retained value plus a gas/fwd-fee margin for the registry's own accept + deploy send.
const USERNAME_RETAINED_VALUE =
  USERNAME_PENDING_MINT_STORAGE_ENDOWMENT +
  USERNAME_NFT_ITEM_DEPLOY_RESERVE +
  USERNAME_ATH_NOTIFICATION_ACK_VALUE +
  USERNAME_STATE_GROWTH_EXEC_RESERVE +
  USERNAME_NAME_RECORD_STORAGE_ENDOWMENT;
const USERNAME_NOTIFY_VALUE = USERNAME_RETAINED_VALUE + 89_000_000n; // 636M total: full retained value + thick exec/fwd margin
const USERNAME_ITEM_ACK_FORWARD_RESERVE = 3_000_000n;
const USERNAME_ITEM_ACK_EXEC_RESERVE = 1_000_000n;
const USERNAME_ITEM_ACK_FWD_FEE_ALLOWANCE = 100_000n;
const USERNAME_ITEM_MIN_RETAINED_AFTER_INIT = 15_900_000n;
const MINIMUM_STORAGE_MARGIN_NANOTONS = 1_000_000n;

type StorageCase = {
  label: string;
  kind: 'successful_mint' | 'item_bounce' | 'item_resend' | 'item_transfer';
  raw_balance_delta_nanotons: string;
  item_balance_delta_nanotons: string;
  expected_registry_endowment_nanotons: string;
  expected_item_floor_nanotons: string;
  retained_margin_vs_registry_endowment_nanotons: string;
  item_margin_vs_floor_nanotons: string;
  name_record_count: string;
  pending_mint_count: string;
};

export type UsernameRegistryStorageEconomicsReport = {
  profile: 'PLATHO.V1.USERNAME_REGISTRY_STORAGE_ECONOMICS';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  code_hashes: {
    username_registry: string;
    username_nft_item: string;
  };
  note: string;
    constants: {
      username_pending_mint_storage_endowment_nanotons: string;
      username_state_growth_exec_reserve_nanotons: string;
      username_nft_item_deploy_reserve_nanotons: string;
      username_ath_notification_ack_value_nanotons: string;
      username_item_ack_forward_reserve_nanotons: string;
    username_item_ack_exec_reserve_nanotons: string;
    username_item_ack_fwd_fee_allowance_nanotons: string;
    username_item_min_retained_after_init_nanotons: string;
    minimum_storage_margin_nanotons: string;
  };
  cases: StorageCase[];
  worst_registry_margin_nanotons: string;
  worst_item_margin_nanotons: string;
};

type Setup = Awaited<ReturnType<typeof setupRegistry>>;

function codeHash(relPath: string): string {
  return Cell.fromBoc(fs.readFileSync(relPath))[0].hash().toString('hex');
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.USERNAME.STORAGE.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function emptySlice() {
  return beginCell().endCell().beginParse();
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

async function balance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

async function setupRegistry(label: string) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury(`username-storage-${label}-deployer`);
  const placeholderAthWallet = fixtureAddress(`${label}_PLACEHOLDER`);
  const athMasterAddress = fixtureAddress(`${label}_ATH_MASTER`);
  const treasuryAthReceiver = fixtureAddress(`${label}_TREASURY`);
  const vaultAddress = fixtureAddress(`${label}_VAULT`);
  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);

  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('1'),
    workchain: registryAddress.workChain,
  }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWallet = await registry.getGetAthWalletAddress(registryAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWallet,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);
  // Art upload is DECOUPLED from the genesis seal (locked separately by SealArt), so the
  // storage-economics model — which measures mint/refund value flow, not rendering — seals
  // the genesis with an empty art dict (uploading 56 parts x 7 cases would only add latency).
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, vaultAddress };
}

function mintBody(owner: Address, name: string, amount: bigint, queryId: bigint, payerWallet: Address): AthTransferNotificationVaultMintUsername {
  return {
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: queryId,
    amount,
    sender_key: 77n,
    payer_wallet: payerWallet,
    owner_wallet: owner,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  };
}

async function sendMint(ctx: Setup, owner: Address, name: string, amount: bigint, queryId: bigint, value = USERNAME_NOTIFY_VALUE) {
  return await ctx.registry.send(ctx.blockchain.sender(ctx.officialAthWallet), { value }, mintBody(owner, name, amount, queryId, ctx.vaultAddress));
}

function assertNonNegative(label: string, value: bigint) {
  if (value < 0n) throw new Error(`${label}: negative retained margin ${value}`);
}

async function successfulMintCase(label: string, name: string, price: bigint): Promise<StorageCase> {
  const ctx = await setupRegistry(label);
  const owner = fixtureAddress(`${label}_OWNER`);
  const hash = nameHash(name);
  const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
  const beforeRegistry = await balance(ctx.blockchain, ctx.registry.address);

  await sendMint(ctx, owner, name, price, 1n);

  const afterRegistry = await balance(ctx.blockchain, ctx.registry.address);
  const itemBalance = await balance(ctx.blockchain, itemAddress);
  const global = await ctx.registry.getGetGlobal();
  const registryDelta = afterRegistry - beforeRegistry;
  const registryMargin = registryDelta - USERNAME_PENDING_MINT_STORAGE_ENDOWMENT;
  const itemMargin = itemBalance - USERNAME_ITEM_MIN_RETAINED_AFTER_INIT;
  assertNonNegative(label, registryMargin);
  // clean-11: the never-evicted name_records entry must retain its dedicated century-rent endowment beyond the
  // transient pending endowment, so the ownership record self-funds its storage rent for the life of the collection.
  assertNonNegative(`${label} name-record endowment`, registryMargin - USERNAME_NAME_RECORD_STORAGE_ENDOWMENT);
  assertNonNegative(`${label} item`, itemMargin);

  return {
    label,
    kind: 'successful_mint',
    raw_balance_delta_nanotons: String(registryDelta),
    item_balance_delta_nanotons: String(itemBalance),
    expected_registry_endowment_nanotons: String(USERNAME_PENDING_MINT_STORAGE_ENDOWMENT),
    expected_item_floor_nanotons: String(USERNAME_ITEM_MIN_RETAINED_AFTER_INIT),
    retained_margin_vs_registry_endowment_nanotons: String(registryMargin),
    item_margin_vs_floor_nanotons: String(itemMargin),
    name_record_count: String(global.name_record_count),
    pending_mint_count: String(global.pending_mint_count),
  };
}

async function itemBounceCase(): Promise<StorageCase> {
  const label = 'ITEM_DEPLOY_BOUNCE_REFUND_REQUEST';
  const ctx = await setupRegistry(label);
  const owner = fixtureAddress(`${label}_OWNER`);
  const hash = nameHash('bounce');
  const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
  const rejectInit = await MockAthWalletNoAck.init();

  await ctx.blockchain.setShardAccount(itemAddress, createShardAccount({
    address: itemAddress,
    code: rejectInit.code,
    data: rejectInit.data,
    balance: toNano('0.05'),
    workchain: itemAddress.workChain,
  }));

  const beforeRegistry = await balance(ctx.blockchain, ctx.registry.address);
  await sendMint(ctx, owner, 'bounce', PRICE_6_PLUS, 1n, USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE + USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE + USERNAME_NAME_RECORD_STORAGE_ENDOWMENT);
  const afterRegistry = await balance(ctx.blockchain, ctx.registry.address);
  const global = await ctx.registry.getGetGlobal();
  const registryDelta = afterRegistry - beforeRegistry;
  assertNonNegative(label, registryDelta);

  return {
    label,
    kind: 'item_bounce',
    raw_balance_delta_nanotons: String(registryDelta),
    item_balance_delta_nanotons: '0',
    expected_registry_endowment_nanotons: '0',
    expected_item_floor_nanotons: '0',
    retained_margin_vs_registry_endowment_nanotons: String(registryDelta),
    item_margin_vs_floor_nanotons: '0',
    name_record_count: String(global.name_record_count),
    pending_mint_count: String(global.pending_mint_count),
  };
}

async function itemResendCase(): Promise<StorageCase> {
  const label = 'ITEM_RESEND_ACK_CALLER_FUNDED';
  const ctx = await setupRegistry(label);
  const owner = fixtureAddress(`${label}_OWNER`);
  const hash = nameHash('resend');
  const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
  await sendMint(ctx, owner, 'resend', PRICE_6_PLUS, 1n);
  const item = ctx.blockchain.openContract(new UsernameNFTItem(itemAddress));
  const caller = await ctx.blockchain.treasury('username-storage-resend-caller');
  const beforeItem = await balance(ctx.blockchain, itemAddress);
  const beforeRegistry = await balance(ctx.blockchain, ctx.registry.address);

  await item.send(caller.getSender(), { value: USERNAME_ITEM_ACK_FORWARD_RESERVE + USERNAME_ITEM_ACK_EXEC_RESERVE }, {
    $$type: 'ResendDeployedAck',
  } as ResendDeployedAck);

  const afterItem = await balance(ctx.blockchain, itemAddress);
  const afterRegistry = await balance(ctx.blockchain, ctx.registry.address);
  const global = await ctx.registry.getGetGlobal();
  const itemDelta = afterItem - beforeItem;
  const registryDelta = afterRegistry - beforeRegistry;
  const itemMargin = afterItem - USERNAME_ITEM_MIN_RETAINED_AFTER_INIT;
  assertNonNegative(label, itemMargin);

  return {
    label,
    kind: 'item_resend',
    raw_balance_delta_nanotons: String(registryDelta),
    item_balance_delta_nanotons: String(itemDelta),
    expected_registry_endowment_nanotons: '0',
    expected_item_floor_nanotons: String(USERNAME_ITEM_MIN_RETAINED_AFTER_INIT),
    retained_margin_vs_registry_endowment_nanotons: String(registryDelta),
    item_margin_vs_floor_nanotons: String(itemMargin),
    name_record_count: String(global.name_record_count),
    pending_mint_count: String(global.pending_mint_count),
  };
}

async function itemTransferCase(label: string, value: bigint, forwardAmount: bigint): Promise<StorageCase> {
  const ctx = await setupRegistry(label);
  const owner = fixtureAddress(`${label}_OWNER`);
  const nextOwner = fixtureAddress(`${label}_NEXT_OWNER`);
  const response = fixtureAddress(`${label}_RESPONSE`);
  const hash = nameHash('moveit');
  const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
  await sendMint(ctx, owner, 'moveit', PRICE_6_PLUS, 1n);
  const item = ctx.blockchain.openContract(new UsernameNFTItem(itemAddress));
  const beforeItem = await balance(ctx.blockchain, itemAddress);
  const beforeRegistry = await balance(ctx.blockchain, ctx.registry.address);

  await item.send(ctx.blockchain.sender(owner), { value }, {
    $$type: 'NftTransfer',
    query_id: 88n,
    new_owner: nextOwner,
    response_destination: response,
    custom_payload: null,
    forward_amount: forwardAmount,
    forward_payload: emptySlice(),
  } as NftTransfer);

  const afterItem = await balance(ctx.blockchain, itemAddress);
  const afterRegistry = await balance(ctx.blockchain, ctx.registry.address);
  const global = await ctx.registry.getGetGlobal();
  const itemMargin = afterItem - USERNAME_ITEM_MIN_RETAINED_AFTER_INIT;
  assertNonNegative(label, itemMargin);

  return {
    label,
    kind: 'item_transfer',
    raw_balance_delta_nanotons: String(afterRegistry - beforeRegistry),
    item_balance_delta_nanotons: String(afterItem - beforeItem),
    expected_registry_endowment_nanotons: '0',
    expected_item_floor_nanotons: String(USERNAME_ITEM_MIN_RETAINED_AFTER_INIT),
    retained_margin_vs_registry_endowment_nanotons: String(afterRegistry - beforeRegistry),
    item_margin_vs_floor_nanotons: String(itemMargin),
    name_record_count: String(global.name_record_count),
    pending_mint_count: String(global.pending_mint_count),
  };
}

function renderMarkdown(report: UsernameRegistryStorageEconomicsReport): string {
  const lines: string[] = [];
  lines.push('# UsernameRegistry / UsernameNFTItem Storage Economics Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push(`UsernameRegistry code hash: \`${report.code_hashes.username_registry}\``);
  lines.push(`UsernameNFTItem code hash: \`${report.code_hashes.username_nft_item}\``);
  lines.push('');
  lines.push('| Case | Kind | Registry delta | Registry endowment | Registry margin | Item delta/balance | Item floor | Item margin |');
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const item of report.cases) {
    lines.push(`| ${item.label} | ${item.kind} | ${item.raw_balance_delta_nanotons} | ${item.expected_registry_endowment_nanotons} | ${item.retained_margin_vs_registry_endowment_nanotons} | ${item.item_balance_delta_nanotons} | ${item.expected_item_floor_nanotons} | ${item.item_margin_vs_floor_nanotons} |`);
  }
  lines.push('');
  lines.push(`Minimum storage margin gate: **${report.constants.minimum_storage_margin_nanotons} nanotons**.`);
  lines.push(`Worst relevant registry margin: **${report.worst_registry_margin_nanotons} nanotons**.`);
  lines.push(`Worst relevant item margin: **${report.worst_item_margin_nanotons} nanotons**.`);
  lines.push('');
  return lines.join('\n');
}

export async function runUsernameRegistryStorageEconomics(writeArtifacts = true): Promise<UsernameRegistryStorageEconomicsReport> {
  const cases = [
    await successfulMintCase('SUCCESS_4_CHAR', 'abcd', PRICE_4),
    await successfulMintCase('SUCCESS_5_CHAR', 'abcde', PRICE_5),
    await successfulMintCase('SUCCESS_6_PLUS', 'larisa', PRICE_6_PLUS),
    await itemBounceCase(),
    await itemResendCase(),
    await itemTransferCase('ITEM_TRANSFER_EXACT_MIN', 14_000_000n, 0n),
    await itemTransferCase('ITEM_TRANSFER_WITH_FORWARD', 13_000_000n, 1_000_000n),
  ];
  const relevantRegistryMargins = cases
    .filter((item) => BigInt(item.expected_registry_endowment_nanotons) > 0n)
    .map((item) => BigInt(item.retained_margin_vs_registry_endowment_nanotons));
  const relevantItemMargins = cases
    .filter((item) => BigInt(item.expected_item_floor_nanotons) > 0n)
    .map((item) => BigInt(item.item_margin_vs_floor_nanotons));
  const worstRegistry = relevantRegistryMargins
    .reduce((a, b) => a < b ? a : b);
  const worstItem = relevantItemMargins
    .reduce((a, b) => a < b ? a : b);
  if (worstRegistry < MINIMUM_STORAGE_MARGIN_NANOTONS) {
    throw new Error(`UsernameRegistry retained margin ${worstRegistry} is below gate ${MINIMUM_STORAGE_MARGIN_NANOTONS}`);
  }
  if (worstItem < MINIMUM_STORAGE_MARGIN_NANOTONS) {
    throw new Error(`UsernameNFTItem retained margin ${worstItem} is below gate ${MINIMUM_STORAGE_MARGIN_NANOTONS}`);
  }
  const report: UsernameRegistryStorageEconomicsReport = {
    profile: 'PLATHO.V1.USERNAME_REGISTRY_STORAGE_ECONOMICS',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      username_registry: codeHash(path.join('build', 'UsernameRegistry', 'UsernameRegistry_UsernameRegistry.code.boc')),
      username_nft_item: codeHash(path.join('build', 'UsernameNFTItem', 'UsernameNFTItem_UsernameNFTItem.code.boc')),
    },
    note: 'Sandbox evidence that username mint and item recovery paths retain enough TON against the explicit V1 endowment model. This is not a mainnet rent oracle; it is a release gate against underfunded permanent UsernameRegistry records and UsernameNFTItem state.',
    constants: {
      username_pending_mint_storage_endowment_nanotons: String(USERNAME_PENDING_MINT_STORAGE_ENDOWMENT),
      username_state_growth_exec_reserve_nanotons: String(USERNAME_STATE_GROWTH_EXEC_RESERVE),
      username_nft_item_deploy_reserve_nanotons: String(USERNAME_NFT_ITEM_DEPLOY_RESERVE),
      username_ath_notification_ack_value_nanotons: String(USERNAME_ATH_NOTIFICATION_ACK_VALUE),
      username_item_ack_forward_reserve_nanotons: String(USERNAME_ITEM_ACK_FORWARD_RESERVE),
      username_item_ack_exec_reserve_nanotons: String(USERNAME_ITEM_ACK_EXEC_RESERVE),
      username_item_ack_fwd_fee_allowance_nanotons: String(USERNAME_ITEM_ACK_FWD_FEE_ALLOWANCE),
      username_item_min_retained_after_init_nanotons: String(USERNAME_ITEM_MIN_RETAINED_AFTER_INIT),
      minimum_storage_margin_nanotons: String(MINIMUM_STORAGE_MARGIN_NANOTONS),
    },
    cases,
    worst_registry_margin_nanotons: String(worstRegistry),
    worst_item_margin_nanotons: String(worstItem),
  };

  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'username_registry_storage_economics_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'username_registry_storage_economics_summary.md'), renderMarkdown(report));
  }
  return report;
}

if (require.main === module) {
  runUsernameRegistryStorageEconomics(true)
    .then((report) => {
      console.log(JSON.stringify({
        status: report.status,
        cases: report.cases.length,
        worst_registry_margin_nanotons: report.worst_registry_margin_nanotons,
        worst_item_margin_nanotons: report.worst_item_margin_nanotons,
      }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
