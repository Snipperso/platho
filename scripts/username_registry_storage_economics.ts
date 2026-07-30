import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { sealArtAndCollectionMeta } from '../tests/helpers/username-registry-genesis';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  AthTransferNotificationRegistryMintUsername,
  BindOfficialAthWallet,
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
// ── Every constant in the contract's retainedValue gate is READ FROM THE CONTRACT, never copied. ──────────────
// All four used to be hand-mirrored here, and two had silently drifted:
//   USERNAME_NFT_ITEM_DEPLOY_RESERVE   script 500_000_000  vs contract 829_000_000
//   USERNAME_NAME_RECORD_STORAGE_...   script  36_000_000  vs contract 100_000_000
// So the model computed retainedValue = 611M while the contract demanded 940M, the notify under-funded the mint,
// gate 19122 threw, the registry retained nothing, and the case reported "negative retained margin -6000000" —
// which reads as an economics hole. It was a stale copy. (The 829M is not drift to "fix": its comment records the
// owner's decision that a username mint costs EXACTLY 1 TON, and the roadmap's #7 rollback explicitly excludes
// username for that reason.)
// tests/constants-single-source.test.ts polices contract-vs-spec drift but does not reach scripts/; parsing the
// source is what makes this model unable to lie.
const CONTRACT_SRC = fs.readFileSync(path.join('contracts', 'UsernameRegistry.tact'), 'utf8');
function contractConst(name: string): bigint {
  const m = CONTRACT_SRC.match(new RegExp(`^const ${name}: Int = (\\d+);`, 'm'));
  if (!m) throw new Error(`${name} not found in contracts/UsernameRegistry.tact`);
  return BigInt(m[1]);
}
const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = contractConst('USERNAME_PENDING_MINT_STORAGE_ENDOWMENT');
const USERNAME_STATE_GROWTH_EXEC_RESERVE = contractConst('USERNAME_STATE_GROWTH_EXEC_RESERVE');
const USERNAME_NFT_ITEM_DEPLOY_RESERVE = contractConst('USERNAME_NFT_ITEM_DEPLOY_RESERVE');
const USERNAME_ATH_NOTIFICATION_ACK_VALUE = contractConst('USERNAME_ATH_NOTIFICATION_ACK_VALUE');
// 2026-07-20: name_records was deleted ("THE ITEM IS THE RECORD"), so the old USERNAME_NAME_RECORD_STORAGE_ENDOWMENT
// slot is now USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION — same 100M in the same gate-19122 retained-value sum, it just
// funds the REGISTRY'S own code rent instead of a per-name map entry.
const USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION = contractConst('USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION');
// The registry retains pending endowment + item deploy reserve + ack value + state-growth reserve + self-rent
// contribution, then forwards the deploy reserve to the item. The notify must carry the full retained value plus a
// gas/fwd margin for the registry's own accept + deploy send. Figures are NOT written here on purpose — they are
// read from the contract above, because the two that were written here are exactly the two that drifted.
const USERNAME_RETAINED_VALUE =
  USERNAME_PENDING_MINT_STORAGE_ENDOWMENT +
  USERNAME_NFT_ITEM_DEPLOY_RESERVE +
  USERNAME_ATH_NOTIFICATION_ACK_VALUE +
  USERNAME_STATE_GROWTH_EXEC_RESERVE +
  USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION;
const USERNAME_NOTIFY_VALUE = USERNAME_RETAINED_VALUE + 89_000_000n; // full retained value (read from contract) + thick exec/fwd margin
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
  // Art upload used to be DECOUPLED from the genesis seal, and this model sealed with an empty art dict to avoid
  // 56 uploads x 7 cases of latency. That is no longer possible: SealGenesis throws 19045/19046 unless the art and
  // the collection metadata are locked, because leaving them open left the genesis controller — a hot wallet —
  // permanent write authority over every .ath NFT's art in an otherwise immutable contract.
  //
  // Worth recording HOW this surfaced, because it is the failure mode the gate is meant to prevent, in miniature:
  // the seal was silently refused, the registry stayed unsealed, the mint notification hit requireSealed instead of
  // minting, and the only symptom was a retained margin of exactly -6,000,000 — a number that looks like a funding
  // shortfall, not a refused seal. A skipped lock reads as an economics bug.
  await sealArtAndCollectionMeta(registry, deployer);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, vaultAddress };
}

function mintBody(owner: Address, name: string, amount: bigint, queryId: bigint, payerWallet: Address): AthTransferNotificationRegistryMintUsername {
  return {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: queryId,
    amount,
    sender_key: 77n,
    payer_wallet: payerWallet,
    owner_wallet: owner,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name).asCell(),
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
  // Since name_records was deleted (2026-07-20) this 100M no longer funds a per-name map entry — it is the
  // registry's own century-rent self-contribution, retained beyond the transient pending endowment so the registry
  // self-funds its code storage for the life of the collection.
  assertNonNegative(`${label} registry self-rent`, registryMargin - USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION);
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
  await sendMint(ctx, owner, 'bounce', PRICE_6_PLUS, 1n, USERNAME_PENDING_MINT_STORAGE_ENDOWMENT + USERNAME_NFT_ITEM_DEPLOY_RESERVE + USERNAME_ATH_NOTIFICATION_ACK_VALUE + USERNAME_STATE_GROWTH_EXEC_RESERVE + USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION);
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

  const transferPayload = beginCell()
    .storeAddress(nextOwner)
    .storeAddress(response)
    .storeMaybeRef(null)
    .storeCoins(forwardAmount)
    .storeBit(0)
    .endCell()
    .beginParse();
  await item.send(ctx.blockchain.sender(owner), { value }, {
    $$type: 'NftTransfer',
    query_id: 88n,
    payload: transferPayload,
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
