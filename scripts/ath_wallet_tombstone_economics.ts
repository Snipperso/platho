import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  ATHInternalTransferVaultMintUsername,
  ATHInternalTransferVaultProfileAvatar,
  ATHInternalTransferWithNotify,
  ATHWallet,
  AthTransferNotificationAck,
  JettonInternalTransfer,
  PruneStaleNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;
const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1_000_000n;
const ATH_VAULT_RESPONSE_ACK_VALUE = 3_000_000n;
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1_000_000n;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7_000_000n;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 20_000_000n;
const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE = 2_000_000n;
const ATH_PENDING_NOTIFICATION_TTL = 86_400;
const AMOUNT = 100_000_000n;

export type AthWalletTombstoneEconomicsCase = {
  label: string;
  terminal: 'ack' | 'prune';
  inbound_value_nanotons: string;
  terminal_caller_value_nanotons: string;
  raw_balance_delta_nanotons: string;
  retained_excluding_terminal_value_nanotons: string;
  required_tombstone_endowment_nanotons: string;
  retained_margin_nanotons: string;
  pending_exists_after_terminal: boolean;
  wallet_token_balance_atomic: string;
  tx_count: number;
  aborted_count: number;
};

export type AthWalletTombstoneEconomicsReport = {
  profile: 'PLATHO.V1.ATH_WALLET_TOMBSTONE_ECONOMICS';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  code_hashes: {
    ath_wallet: string;
  };
  note: string;
  required_tombstone_endowment_nanotons: string;
  cases: AthWalletTombstoneEconomicsCase[];
  worst_margin_nanotons: string;
};

type Terminal = 'ack' | 'prune';

type CaseSpec = {
  label: string;
  terminal: Terminal;
  vaultResponse?: boolean;
  message: (ctx: SetupContext) => any;
};

type SetupContext = {
  sourceOwner: Address;
  sourceWalletAddress: Address;
  recipientOwner: Address;
  responseDestination: Address;
  ownerWallet: Address;
  queryId: bigint;
};

function codeHash(relPath: string): string {
  return Cell.fromBoc(fs.readFileSync(relPath))[0].hash().toString('hex');
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.ATH.TOMBSTONE.${label}`).digest());
}

function senderKey(senderOwner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

function usernameSlice() {
  return beginCell().storeBuffer(Buffer.from('platho', 'ascii')).endCell().beginParse();
}

function notifyInboundValue(responseAckValue: bigint): bigint {
  return ATH_TRANSFER_NOTIFY_MIN_VALUE
    + responseAckValue
    + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
    + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
    + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
}

async function setup(label: string) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const recipientOwnerTreasury = await blockchain.treasury(`ath-tombstone-${label}-owner`);
  const sourceOwner = fixtureAddress(`${label}_SOURCE_OWNER`);
  const responseDestination = fixtureAddress(`${label}_RESPONSE_DESTINATION`);
  const ownerWallet = fixtureAddress(`${label}_OWNER_WALLET`);
  const master = fixtureAddress(`${label}_MASTER`);
  const recipientZeroInit = await ATHWallet.init(0n, recipientOwnerTreasury.address, master);
  const recipientDataInit = await ATHWallet.init(0n, recipientOwnerTreasury.address, master);
  const recipientAddress = contractAddress(recipientOwnerTreasury.address.workChain, recipientZeroInit);
  await blockchain.setShardAccount(recipientAddress, createShardAccount({
    address: recipientAddress,
    code: recipientZeroInit.code,
    data: recipientDataInit.data,
    balance: 0n,
    workchain: recipientAddress.workChain,
  }));

  const sourceInit = await ATHWallet.init(0n, sourceOwner, master);
  const sourceWalletAddress = contractAddress(sourceOwner.workChain, sourceInit);

  return {
    blockchain,
    wallet: blockchain.openContract(new ATHWallet(recipientAddress, recipientZeroInit)),
    recipientOwner: recipientOwnerTreasury,
    ctx: {
      sourceOwner,
      sourceWalletAddress,
      recipientOwner: recipientOwnerTreasury.address,
      responseDestination,
      ownerWallet,
      queryId: BigInt(10_000 + Math.abs(createHash('sha256').update(label).digest()[0])),
    } satisfies SetupContext,
  };
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function abortedCount(result: any): number {
  return (result.transactions ?? []).filter((tx: any) => Boolean(tx.description?.aborted)).length;
}

const caseSpecs: CaseSpec[] = [
  {
    label: 'NORMAL_NOTIFY_ACK',
    terminal: 'ack',
    message: (ctx) => ({
      $$type: 'ATHInternalTransferWithNotify',
      query_id: ctx.queryId,
      amount: AMOUNT,
      sender_owner: ctx.sourceOwner,
      response_destination: ctx.responseDestination,
      notify_destination: ctx.recipientOwner,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHInternalTransferWithNotify),
  },
  {
    label: 'VAULT_USERNAME_NOTIFY_ACK',
    terminal: 'ack',
    vaultResponse: true,
    message: (ctx) => ({
      $$type: 'ATHInternalTransferVaultMintUsername',
      query_id: ctx.queryId,
      amount: AMOUNT,
      sender_owner: ctx.sourceOwner,
      response_destination: ctx.responseDestination,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
      owner_wallet: ctx.ownerWallet,
      username_len: 6n,
      username: usernameSlice(),
    } as ATHInternalTransferVaultMintUsername),
  },
  {
    label: 'VAULT_PROFILE_NOTIFY_ACK',
    terminal: 'ack',
    vaultResponse: true,
    message: (ctx) => ({
      $$type: 'ATHInternalTransferVaultProfileAvatar',
      query_id: ctx.queryId,
      amount: AMOUNT,
      sender_owner: ctx.sourceOwner,
      response_destination: ctx.responseDestination,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
      owner_wallet: ctx.ownerWallet,
      avatar_hash: 0x1234n,
      avatar_entry_id: 1n,
      avatar_stream_id: 2n,
      avatar_part_count: 1n,
      media_format: 1n,
    } as ATHInternalTransferVaultProfileAvatar),
  },
  // clean-12: the standard Lane A path (JettonInternalTransfer forward_ton>0) no longer creates a pending-notification
  // tombstone -- it emits the standard fire-and-forget 0x7362D09C JettonTransferNotification. So there is no
  // standard-path tombstone to measure; only the Lane B custom-notify cases carry a tombstone.
  {
    label: 'NORMAL_NOTIFY_STALE_PRUNE',
    terminal: 'prune',
    message: (ctx) => ({
      $$type: 'ATHInternalTransferWithNotify',
      query_id: ctx.queryId,
      amount: AMOUNT,
      sender_owner: ctx.sourceOwner,
      response_destination: ctx.responseDestination,
      notify_destination: ctx.recipientOwner,
      notify_value: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    } as ATHInternalTransferWithNotify),
  },
];

async function measureCase(spec: CaseSpec): Promise<AthWalletTombstoneEconomicsCase> {
  const { blockchain, wallet, recipientOwner, ctx } = await setup(spec.label);
  const key = senderKey(ctx.sourceOwner, ctx.queryId);
  const responseAckValue = spec.vaultResponse ? ATH_VAULT_RESPONSE_ACK_VALUE : ATH_TRANSFER_NOTIFY_ACK_VALUE;
  const inbound = notifyInboundValue(responseAckValue);
  const beforeBalance = await contractBalance(blockchain, wallet.address);
  const publishResult = await wallet.send(blockchain.sender(ctx.sourceWalletAddress), { value: inbound }, spec.message(ctx));
  const pending = await wallet.getGetPendingNotification(ctx.queryId, key);
  if (!pending.exists) throw new Error(`${spec.label}: pending notification was not created`);

  let terminalValue = ATH_TRANSFER_NOTIFY_ACK_VALUE;
  let terminalResult: any;
  if (spec.terminal === 'ack') {
    terminalResult = await wallet.send(recipientOwner.getSender(), { value: terminalValue }, {
      $$type: 'AthTransferNotificationAck',
      query_id: ctx.queryId,
      amount: AMOUNT,
      sender_key: key,
    } as AthTransferNotificationAck);
  } else {
    blockchain.now = (blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    terminalValue = ATH_PRUNE_NOTIFICATION_EXEC_RESERVE;
    terminalResult = await wallet.send(recipientOwner.getSender(), { value: terminalValue }, {
      $$type: 'PruneStaleNotification',
      query_id: ctx.queryId,
      sender_key: key,
    } as PruneStaleNotification);
  }

  const afterPending = await wallet.getGetPendingNotification(ctx.queryId, key);
  const afterWallet = await wallet.getGetWalletData();
  const afterBalance = await contractBalance(blockchain, wallet.address);
  const rawDelta = afterBalance - beforeBalance;
  const retainedExcludingTerminal = rawDelta - terminalValue;
  const margin = retainedExcludingTerminal - ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT;
  if (afterPending.exists) throw new Error(`${spec.label}: pending notification survived terminal path`);
  if (afterWallet.balance !== AMOUNT) throw new Error(`${spec.label}: wallet token balance mismatch`);
  if (margin < 0n) throw new Error(`${spec.label}: tombstone retained margin is negative (${margin})`);

  return {
    label: spec.label,
    terminal: spec.terminal,
    inbound_value_nanotons: String(inbound),
    terminal_caller_value_nanotons: String(terminalValue),
    raw_balance_delta_nanotons: String(rawDelta),
    retained_excluding_terminal_value_nanotons: String(retainedExcludingTerminal),
    required_tombstone_endowment_nanotons: String(ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT),
    retained_margin_nanotons: String(margin),
    pending_exists_after_terminal: afterPending.exists,
    wallet_token_balance_atomic: String(afterWallet.balance),
    tx_count: (publishResult.transactions?.length ?? 0) + (terminalResult.transactions?.length ?? 0),
    aborted_count: abortedCount(publishResult) + abortedCount(terminalResult),
  };
}

function renderMarkdown(report: AthWalletTombstoneEconomicsReport): string {
  const lines: string[] = [];
  lines.push('# ATHWallet Tombstone Economics Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push(`ATHWallet code hash: \`${report.code_hashes.ath_wallet}\``);
  lines.push(`Required tombstone endowment: **${report.required_tombstone_endowment_nanotons} nanotons**.`);
  lines.push('');
  lines.push('| Case | Terminal | Inbound | Terminal caller value | Retained excl. terminal | Margin |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const c of report.cases) {
    lines.push(`| ${c.label} | ${c.terminal} | ${c.inbound_value_nanotons} | ${c.terminal_caller_value_nanotons} | ${c.retained_excluding_terminal_value_nanotons} | ${c.retained_margin_nanotons} |`);
  }
  lines.push('');
  lines.push(`Worst retained margin: **${report.worst_margin_nanotons} nanotons**.`);
  lines.push('');
  return lines.join('\n');
}

export async function runAthWalletTombstoneEconomics(writeArtifacts = true): Promise<AthWalletTombstoneEconomicsReport> {
  const cases = [];
  for (const spec of caseSpecs) {
    cases.push(await measureCase(spec));
  }
  const worst = cases.map((c) => BigInt(c.retained_margin_nanotons)).reduce((a, b) => a < b ? a : b);
  const report: AthWalletTombstoneEconomicsReport = {
    profile: 'PLATHO.V1.ATH_WALLET_TOMBSTONE_ECONOMICS',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      ath_wallet: codeHash(path.join('build', 'ATHWallet', 'ATHWallet_ATHWallet.code.boc')),
    },
    note: 'Sandbox evidence that finalized/pruned ATH notification tombstones retain at least ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT after conservatively subtracting the terminal ACK/prune caller value. This is not a mainnet rent oracle; it is release evidence that the value envelope preserves tombstone backing across supported notification variants.',
    required_tombstone_endowment_nanotons: String(ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT),
    cases,
    worst_margin_nanotons: String(worst),
  };
  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'ath_wallet_tombstone_economics_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'ath_wallet_tombstone_economics_summary.md'), renderMarkdown(report));
  }
  return report;
}

if (require.main === module) {
  runAthWalletTombstoneEconomics(true)
    .then((report) => {
      console.log(JSON.stringify({
        status: report.status,
        cases: report.cases.length,
        worst_margin_nanotons: report.worst_margin_nanotons,
      }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
