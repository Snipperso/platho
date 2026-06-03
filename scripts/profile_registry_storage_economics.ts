import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  AthTransferNotificationVaultProfileAvatar,
  BindProfileOfficialAthWallet,
  BindProfileVault,
  ProfileRegistry,
  SealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';

const MANIFEST_HASH = 0x50524f46494c45524547495354525953544f524147450000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const PROFILE_NOTIFY_VALUE = 30_000_000n;
const PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT = 6_000_000n;
const PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT = 3_000_000n;
const PROFILE_STATE_GROWTH_EXEC_RESERVE = 3_000_000n;
const PROFILE_ATH_NOTIFICATION_ACK_VALUE = 1_000_000n;
const PROFILE_EXCESS_REFUND_FORWARD_RESERVE = 200_000n;
const MINIMUM_STORAGE_MARGIN_NANOTONS = 1_000_000n;
const PROFILE_FIRST_RETAINED_MODEL = PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT
  + PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT
  + PROFILE_STATE_GROWTH_EXEC_RESERVE
  + PROFILE_ATH_NOTIFICATION_ACK_VALUE;
const PROFILE_REPEAT_RETAINED_MODEL = PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT
  + PROFILE_STATE_GROWTH_EXEC_RESERVE
  + PROFILE_ATH_NOTIFICATION_ACK_VALUE;

type ProfileStorageCase = {
  label: string;
  updates: number;
  raw_balance_delta_nanotons: string;
  expected_permanent_endowment_nanotons: string;
  expected_retained_model_nanotons: string;
  retained_margin_vs_permanent_endowment_nanotons: string;
  profile_count: string;
  avatar_record_count: string;
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
    profile_avatar_record_storage_endowment_nanotons: string;
    profile_owner_version_storage_endowment_nanotons: string;
    profile_state_growth_exec_reserve_nanotons: string;
    profile_ath_notification_ack_value_nanotons: string;
    profile_excess_refund_forward_reserve_nanotons: string;
    profile_first_retained_model_nanotons: string;
    profile_repeat_retained_model_nanotons: string;
    minimum_storage_margin_nanotons: string;
  };
  cases: ProfileStorageCase[];
  worst_margin_vs_permanent_endowment_nanotons: string;
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
    $$type: 'BindProfileVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vault,
  } as BindProfileVault);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, vault };
}

function avatarNotification(ctx: Setup, owner: Address, queryId: bigint): AthTransferNotificationVaultProfileAvatar {
  return {
    $$type: 'AthTransferNotificationVaultProfileAvatar',
    query_id: queryId,
    amount: PROFILE_AVATAR_PRICE_ATH,
    sender_key: 77n,
    payer_wallet: ctx.vault,
    owner_wallet: owner,
    avatar_hash: 0xabc000n + queryId,
    avatar_entry_id: queryId,
    avatar_stream_id: 0x11223344556677889900n + queryId,
    avatar_part_count: 1n,
    media_format: 1n,
  };
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
  const owner = fixtureAddress(`${label}_OWNER`);
  for (let i = 0; i < preUpdates; i += 1) {
    await sendAvatar(ctx, owner, BigInt(i + 1));
  }

  const before = await contractBalance(ctx.blockchain, ctx.registry.address);
  await sendAvatar(ctx, owner, BigInt(preUpdates + 1));
  const after = await contractBalance(ctx.blockchain, ctx.registry.address);
  const state = await ctx.registry.getGetGlobal();
  const expectedPermanent = PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT
    + (preUpdates === 0 ? PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT : 0n);
  const expectedRetainedModel = preUpdates === 0 ? PROFILE_FIRST_RETAINED_MODEL : PROFILE_REPEAT_RETAINED_MODEL;
  const rawDelta = after - before;
  const margin = rawDelta - expectedPermanent;
  if (margin < 0n) throw new Error(`${label}: retained margin is negative (${margin})`);

  return {
    label,
    updates: 1,
    raw_balance_delta_nanotons: String(rawDelta),
    expected_permanent_endowment_nanotons: String(expectedPermanent),
    expected_retained_model_nanotons: String(expectedRetainedModel),
    retained_margin_vs_permanent_endowment_nanotons: String(margin),
    profile_count: String(state.profile_count),
    avatar_record_count: String(state.avatar_record_count),
  };
}

async function aggregateCase(label: string, owners: number, updatesPerOwner: number): Promise<ProfileStorageCase> {
  const ctx = await setupRegistry(label);
  const before = await contractBalance(ctx.blockchain, ctx.registry.address);
  let queryId = 1n;
  for (let ownerIndex = 0; ownerIndex < owners; ownerIndex += 1) {
    const owner = fixtureAddress(`${label}_OWNER_${ownerIndex}`);
    for (let updateIndex = 0; updateIndex < updatesPerOwner; updateIndex += 1) {
      await sendAvatar(ctx, owner, queryId);
      queryId += 1n;
    }
  }
  const after = await contractBalance(ctx.blockchain, ctx.registry.address);
  const state = await ctx.registry.getGetGlobal();
  const updates = owners * updatesPerOwner;
  const expectedPermanent = BigInt(owners) * PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT
    + BigInt(updates) * PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT;
  const expectedRetainedModel = BigInt(owners) * PROFILE_FIRST_RETAINED_MODEL
    + BigInt(updates - owners) * PROFILE_REPEAT_RETAINED_MODEL;
  const rawDelta = after - before;
  const margin = rawDelta - expectedPermanent;
  if (margin < 0n) throw new Error(`${label}: aggregate retained margin is negative (${margin})`);

  return {
    label,
    updates,
    raw_balance_delta_nanotons: String(rawDelta),
    expected_permanent_endowment_nanotons: String(expectedPermanent),
    expected_retained_model_nanotons: String(expectedRetainedModel),
    retained_margin_vs_permanent_endowment_nanotons: String(margin),
    profile_count: String(state.profile_count),
    avatar_record_count: String(state.avatar_record_count),
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
  lines.push('| Case | Updates | Retained delta | Permanent endowment | Margin |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const item of report.cases) {
    lines.push(`| ${item.label} | ${item.updates} | ${item.raw_balance_delta_nanotons} | ${item.expected_permanent_endowment_nanotons} | ${item.retained_margin_vs_permanent_endowment_nanotons} |`);
  }
  lines.push('');
  lines.push(`Minimum retained margin gate: **${report.constants.minimum_storage_margin_nanotons} nanotons**.`);
  lines.push(`Worst retained margin vs permanent endowment: **${report.worst_margin_vs_permanent_endowment_nanotons} nanotons**.`);
  lines.push('');
  return lines.join('\n');
}

export async function runProfileRegistryStorageEconomics(writeArtifacts = true): Promise<ProfileRegistryStorageEconomicsReport> {
  const cases = [
    await singleCase('VAULT_FIRST_AVATAR', 0),
    await singleCase('VAULT_REPEAT_AVATAR', 1),
    await aggregateCase('VAULT_MANY_OWNERS_12', 12, 1),
    await aggregateCase('VAULT_MANY_UPDATES_ONE_OWNER_10', 1, 10),
  ];
  const worst = cases.map((item) => BigInt(item.retained_margin_vs_permanent_endowment_nanotons)).reduce((a, b) => a < b ? a : b);
  if (worst < MINIMUM_STORAGE_MARGIN_NANOTONS) {
    throw new Error(`ProfileRegistry retained margin ${worst} is below gate ${MINIMUM_STORAGE_MARGIN_NANOTONS}`);
  }
  const report: ProfileRegistryStorageEconomicsReport = {
    profile: 'PLATHO.V1.PROFILE_REGISTRY_STORAGE_ECONOMICS',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      profile_registry: codeHash(path.join('build', 'ProfileRegistry', 'ProfileRegistry_ProfileRegistry.code.boc')),
    },
    note: 'Sandbox evidence that accepted ProfileRegistry avatar updates retain enough TON after ACK/refund actions to cover the permanent avatar record and owner-version map endowments. This is not a mainnet rent oracle; it is a release gate against underfunded permanent avatar pointer growth.',
    constants: {
      profile_avatar_record_storage_endowment_nanotons: String(PROFILE_AVATAR_RECORD_STORAGE_ENDOWMENT),
      profile_owner_version_storage_endowment_nanotons: String(PROFILE_OWNER_VERSION_STORAGE_ENDOWMENT),
      profile_state_growth_exec_reserve_nanotons: String(PROFILE_STATE_GROWTH_EXEC_RESERVE),
      profile_ath_notification_ack_value_nanotons: String(PROFILE_ATH_NOTIFICATION_ACK_VALUE),
      profile_excess_refund_forward_reserve_nanotons: String(PROFILE_EXCESS_REFUND_FORWARD_RESERVE),
      profile_first_retained_model_nanotons: String(PROFILE_FIRST_RETAINED_MODEL),
      profile_repeat_retained_model_nanotons: String(PROFILE_REPEAT_RETAINED_MODEL),
      minimum_storage_margin_nanotons: String(MINIMUM_STORAGE_MARGIN_NANOTONS),
    },
    cases,
    worst_margin_vs_permanent_endowment_nanotons: String(worst),
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
      }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
