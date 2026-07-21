import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  AthTransferNotificationRegistryProfileAvatar,
  BindProfileOfficialAthWallet,
  ProfileRegistry,
  SealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { registerKeyShard } from '../tests/helpers/key-shard-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE QUESTION THIS ARTIFACT ANSWERS CHANGED ON 2026-07-21.
//
// It used to ask: does an accepted avatar update retain enough TON to fund the PERMANENT per-profile state this
// registry stores? That question is now void, because the registry stores no per-profile state. The maps it used
// to keep cost a MEASURED 5.0000 cells per profile against a ~65536-cell account — a hard ceiling of 13,076
// profiles, reached in the ACTION phase as code 50 while COMPUTE reports exit 0, i.e. reached silently. The
// pointer moved into the buyer's own KeyShard, which funds its own rent from its own endowment (KS-RENT-01).
//
// So there are two questions left, and both are release gates:
//
//   1. DOES THE ACCOUNT STILL GROW PER PROFILE? It must not, and the measurement must be taken across MANY
//      owners rather than argued from the source, because that is exactly the claim the old ceiling disproved.
//      `data_cells_per_owner` is the number; anything but 0 means the ceiling is back.
//
//   2. DOES A PURCHASE COST THE REGISTRY MONEY? The write to the shard is round-tripped (the ack returns the
//      change, or the bounce returns it), but the registry also emits the ATH ack and the TON excess refund out
//      of what it retained. If the net were negative the registry would drain — slowly, invisibly, and then
//      stop being able to settle anything. `raw_balance_delta_nanotons` must stay non-negative with margin.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST_HASH = 0x50524f46494c45524547495354525953544f524147450000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const PROFILE_NOTIFY_VALUE = 66_000_000n;
const PROFILE_KEY_SHARD_WRITE_VALUE = 50_000_000n;
const PROFILE_AVATAR_SETTLE_EXEC_RESERVE = 5_000_000n;
const PROFILE_STATE_GROWTH_EXEC_RESERVE = 3_000_000n;
const PROFILE_ATH_NOTIFICATION_ACK_VALUE = 1_000_000n;
const PROFILE_ATH_NOTIFICATION_REFUND_VALUE = 45_000_000n;
const PROFILE_EXCESS_REFUND_FORWARD_RESERVE = 200_000n;
const MINIMUM_STORAGE_MARGIN_NANOTONS = 1_000_000n;
/** What gate 21112 demands of an arriving notification. */
const PROFILE_RETAINED_MODEL = PROFILE_KEY_SHARD_WRITE_VALUE
  + PROFILE_AVATAR_SETTLE_EXEC_RESERVE
  + PROFILE_STATE_GROWTH_EXEC_RESERVE;

type ProfileStorageCase = {
  label: string;
  owners: number;
  updates: number;
  raw_balance_delta_nanotons: string;
  /** Zero by construction since 2026-07-21 — kept in the schema so a return of per-profile state is loud. */
  expected_permanent_endowment_nanotons: string;
  expected_retained_model_nanotons: string;
  retained_margin_vs_permanent_endowment_nanotons: string;
  profile_count: string;
  pending_avatar_write_count: string;
  registry_data_cells: string;
  /** THE CEILING NUMBER. Must be 0. */
  data_cells_per_owner: string;
};

export type ProfileRegistryStorageEconomicsReport = {
  profile: 'PLATHO.V1.PROFILE_REGISTRY_STORAGE_ECONOMICS';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  code_hashes: {
    profile_registry: string;
  };
  note: string;
  constants: {
    profile_key_shard_write_value_nanotons: string;
    profile_avatar_settle_exec_reserve_nanotons: string;
    profile_state_growth_exec_reserve_nanotons: string;
    profile_ath_notification_ack_value_nanotons: string;
    profile_ath_notification_refund_value_nanotons: string;
    profile_excess_refund_forward_reserve_nanotons: string;
    profile_retained_model_nanotons: string;
    minimum_storage_margin_nanotons: string;
  };
  cases: ProfileStorageCase[];
  worst_margin_vs_permanent_endowment_nanotons: string;
  worst_data_cells_per_owner: string;
};

type Setup = Awaited<ReturnType<typeof setupRegistry>>;

function codeHash(relPath: string): string {
  return Cell.fromBoc(fs.readFileSync(relPath))[0].hash().toString('hex');
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.PROFILE.STORAGE.${label}`).digest());
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

/** Cells the account's data actually occupies — the unit the ~65536-cell account ceiling is counted in. */
async function dataCells(blockchain: Blockchain, address: Address): Promise<number> {
  const state: any = (await blockchain.getContract(address)).accountState as any;
  const root: Cell | undefined = state?.state?.data;
  if (!root) return 0;
  const seen = new Set<string>();
  let count = 0;
  (function walk(cell: Cell) {
    const key = cell.hash().toString('hex');
    if (seen.has(key)) return;
    seen.add(key);
    count += 1;
    for (const ref of cell.refs) walk(ref);
  })(root);
  return count;
}

async function setupRegistry(label: string) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury(`profile-storage-${label}-deployer`);
  const athMaster = fixtureAddress(`${label}_ATH_MASTER`);
  const treasury = fixtureAddress(`${label}_TREASURY`);
  const vault = fixtureAddress(`${label}_VAULT`);
  const placeholderAthWallet = fixtureAddress(`${label}_PLACEHOLDER`);
  const init = await ProfileRegistry.init(placeholderAthWallet, athMaster, treasury, false, 0n, 0n, deployer.address);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));

  const registry = blockchain.openContract(new ProfileRegistry(address, init));
  const officialAthWallet = await registry.getGetAthWalletAddress(address);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWallet,
  } as BindProfileOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, vault };
}

// Direct-pay: the avatar's owner must BE the payer (gate 21163), with no Vault in the middle. Pointer fields vary
// with queryId so that no two writes can share cells — the dedup trap that once made a growing map look flat.
function avatarNotification(ctx: Setup, owner: Address, queryId: bigint): AthTransferNotificationRegistryProfileAvatar {
  return {
    $$type: 'AthTransferNotificationRegistryProfileAvatar',
    query_id: queryId,
    amount: PROFILE_AVATAR_PRICE_ATH,
    sender_key: 77n,
    payer_wallet: owner,
    owner_wallet: owner,
    avatar_hash: 0xabc000n + queryId,
    avatar_entry_id: queryId,
    avatar_stream_id: 0x11223344556677889900n + queryId,
    avatar_part_count: 1n,
    media_format: 1n,
  };
}

/** A buyer with an identity. Gate 22202 refuses an avatar write into an unregistered shard, so this is part of
 *  what an ACCEPTED purchase now requires — without it every case below would measure a refund, not a sale. */
async function buyer(ctx: Setup, label: string, index: number): Promise<Address> {
  const owner = fixtureAddress(`${label}_OWNER_${index}`);
  await registerKeyShard(ctx.blockchain, owner, ctx.registry.address, 3 + (index % 200));
  return owner;
}

async function sendAvatar(ctx: Setup, owner: Address, queryId: bigint) {
  await ctx.registry.send(
    ctx.blockchain.sender(ctx.officialAthWallet),
    { value: PROFILE_NOTIFY_VALUE },
    avatarNotification(ctx, owner, queryId),
  );
}

async function singleCase(label: string, preUpdates: number): Promise<ProfileStorageCase> {
  const ctx = await setupRegistry(label);
  const owner = await buyer(ctx, label, 0);
  for (let i = 0; i < preUpdates; i += 1) {
    await sendAvatar(ctx, owner, BigInt(i + 1));
  }

  const before = await contractBalance(ctx.blockchain, ctx.registry.address);
  const cellsBefore = await dataCells(ctx.blockchain, ctx.registry.address);
  await sendAvatar(ctx, owner, BigInt(preUpdates + 1));
  const after = await contractBalance(ctx.blockchain, ctx.registry.address);
  const cellsAfter = await dataCells(ctx.blockchain, ctx.registry.address);
  const state = await ctx.registry.getGetGlobal();
  if (state.profile_count !== 1n) throw new Error(`${label}: the purchase did not settle (profile_count ${state.profile_count})`);
  const rawDelta = after - before;
  if (rawDelta < 0n) throw new Error(`${label}: the registry LOST ${-rawDelta} nanotons on a purchase`);
  if (preUpdates > 0 && cellsAfter !== cellsBefore) {
    throw new Error(`${label}: an update grew the registry account ${cellsBefore} -> ${cellsAfter} cells`);
  }

  return {
    label,
    owners: 1,
    updates: 1,
    raw_balance_delta_nanotons: String(rawDelta),
    expected_permanent_endowment_nanotons: '0',
    expected_retained_model_nanotons: String(PROFILE_RETAINED_MODEL),
    retained_margin_vs_permanent_endowment_nanotons: String(rawDelta),
    profile_count: String(state.profile_count),
    pending_avatar_write_count: String(state.pending_avatar_write_count),
    registry_data_cells: String(cellsAfter),
    data_cells_per_owner: '0',
  };
}

async function aggregateCase(label: string, owners: number, updatesPerOwner: number): Promise<ProfileStorageCase> {
  const ctx = await setupRegistry(label);
  const before = await contractBalance(ctx.blockchain, ctx.registry.address);
  let queryId = 1n;
  let cellsAfterFirstOwner = -1;
  for (let ownerIndex = 0; ownerIndex < owners; ownerIndex += 1) {
    const owner = await buyer(ctx, label, ownerIndex);
    for (let updateIndex = 0; updateIndex < updatesPerOwner; updateIndex += 1) {
      // Shift the clock per purchase so two writes cannot coincide into shared cells.
      ctx.blockchain.now = 1_700_000_000 + Number(queryId) * 97;
      await sendAvatar(ctx, owner, queryId);
      queryId += 1n;
    }
    if (ownerIndex === 0) cellsAfterFirstOwner = await dataCells(ctx.blockchain, ctx.registry.address);
  }
  const after = await contractBalance(ctx.blockchain, ctx.registry.address);
  const cellsAfter = await dataCells(ctx.blockchain, ctx.registry.address);
  const state = await ctx.registry.getGetGlobal();
  const updates = owners * updatesPerOwner;
  if (state.profile_count !== BigInt(owners)) {
    throw new Error(`${label}: expected ${owners} settled profiles, got ${state.profile_count}`);
  }
  const rawDelta = after - before;
  if (rawDelta < 0n) throw new Error(`${label}: the registry LOST ${-rawDelta} nanotons over ${updates} purchases`);

  // THE CEILING MEASUREMENT. Growth is taken from the first owner onward, so the base cells the account has
  // regardless of any purchase do not dilute it.
  const perOwner = owners > 1 ? (cellsAfter - cellsAfterFirstOwner) / (owners - 1) : 0;
  if (perOwner !== 0) {
    throw new Error(`${label}: the registry grows ${perOwner} cells per profile — the 13,076-profile ceiling is back`);
  }

  return {
    label,
    owners,
    updates,
    raw_balance_delta_nanotons: String(rawDelta),
    expected_permanent_endowment_nanotons: '0',
    expected_retained_model_nanotons: String(BigInt(updates) * PROFILE_RETAINED_MODEL),
    retained_margin_vs_permanent_endowment_nanotons: String(rawDelta),
    profile_count: String(state.profile_count),
    pending_avatar_write_count: String(state.pending_avatar_write_count),
    registry_data_cells: String(cellsAfter),
    data_cells_per_owner: String(perOwner),
  };
}

function renderMarkdown(report: ProfileRegistryStorageEconomicsReport): string {
  const lines: string[] = [];
  lines.push('# ProfileRegistry Storage Economics Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push(`ProfileRegistry code hash: \`${report.code_hashes.profile_registry}\``);
  lines.push('');
  lines.push('| Case | Owners | Updates | Retained delta | Registry cells | Cells per owner |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const item of report.cases) {
    lines.push(`| ${item.label} | ${item.owners} | ${item.updates} | ${item.raw_balance_delta_nanotons} | ${item.registry_data_cells} | ${item.data_cells_per_owner} |`);
  }
  lines.push('');
  lines.push(`Minimum retained margin gate: **${report.constants.minimum_storage_margin_nanotons} nanotons**.`);
  lines.push(`Worst retained margin: **${report.worst_margin_vs_permanent_endowment_nanotons} nanotons**.`);
  lines.push(`Worst cells per owner (must be 0): **${report.worst_data_cells_per_owner}**.`);
  lines.push('');
  return lines.join('\n');
}

export async function runProfileRegistryStorageEconomics(writeArtifacts = true): Promise<ProfileRegistryStorageEconomicsReport> {
  const cases = [
    await singleCase('DIRECT_FIRST_AVATAR', 0),
    await singleCase('DIRECT_REPEAT_AVATAR', 1),
    await aggregateCase('DIRECT_MANY_OWNERS_12', 12, 1),
    await aggregateCase('DIRECT_MANY_UPDATES_ONE_OWNER_10', 1, 10),
  ];
  const worst = cases.map((item) => BigInt(item.retained_margin_vs_permanent_endowment_nanotons)).reduce((a, b) => a < b ? a : b);
  if (worst < MINIMUM_STORAGE_MARGIN_NANOTONS) {
    throw new Error(`ProfileRegistry retained margin ${worst} is below gate ${MINIMUM_STORAGE_MARGIN_NANOTONS}`);
  }
  const worstCells = cases.map((item) => Number(item.data_cells_per_owner)).reduce((a, b) => a > b ? a : b);
  if (worstCells !== 0) {
    throw new Error(`ProfileRegistry grows ${worstCells} cells per profile — the account ceiling is back`);
  }
  const report: ProfileRegistryStorageEconomicsReport = {
    profile: 'PLATHO.V1.PROFILE_REGISTRY_STORAGE_ECONOMICS',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      profile_registry: codeHash(path.join('build', 'ProfileRegistry', 'ProfileRegistry_ProfileRegistry.code.boc')),
    },
    note: 'Sandbox evidence for the two properties that survived the 2026-07-21 pointer move: the registry account does NOT grow with the number of profiles (it used to grow 5.0000 cells each, capping the product at 13,076 profiles silently), and a settled purchase does not cost the registry TON. Per-profile storage endowments are gone with the state they funded; the buyer KeyShard funds its own rent, measured in tests/key-shard.test.ts KS-RENT-01. This is not a mainnet rent oracle; it is a release gate.',
    constants: {
      profile_key_shard_write_value_nanotons: String(PROFILE_KEY_SHARD_WRITE_VALUE),
      profile_avatar_settle_exec_reserve_nanotons: String(PROFILE_AVATAR_SETTLE_EXEC_RESERVE),
      profile_state_growth_exec_reserve_nanotons: String(PROFILE_STATE_GROWTH_EXEC_RESERVE),
      profile_ath_notification_ack_value_nanotons: String(PROFILE_ATH_NOTIFICATION_ACK_VALUE),
      profile_ath_notification_refund_value_nanotons: String(PROFILE_ATH_NOTIFICATION_REFUND_VALUE),
      profile_excess_refund_forward_reserve_nanotons: String(PROFILE_EXCESS_REFUND_FORWARD_RESERVE),
      profile_retained_model_nanotons: String(PROFILE_RETAINED_MODEL),
      minimum_storage_margin_nanotons: String(MINIMUM_STORAGE_MARGIN_NANOTONS),
    },
    cases,
    worst_margin_vs_permanent_endowment_nanotons: String(worst),
    worst_data_cells_per_owner: String(worstCells),
  };

  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'profile_registry_storage_economics_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'profile_registry_storage_economics_summary.md'), renderMarkdown(report));
  }
  return report;
}

if (require.main === module) {
  runProfileRegistryStorageEconomics(true)
    .then((report) => {
      console.log(JSON.stringify({
        status: report.status,
        cases: report.cases.length,
        worst_margin_vs_permanent_endowment_nanotons: report.worst_margin_vs_permanent_endowment_nanotons,
        worst_data_cells_per_owner: report.worst_data_cells_per_owner,
      }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
