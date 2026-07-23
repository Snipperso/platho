import { Address, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { ATHWallet, ATHTransferRequest, ATHBurn } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { FeeAccumulator, DepositProtocolFee, EnableBuybackSplit, SplitAccumulated, FlushTreasuryDue, FlushBuybackDue } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationRegistryMintUsername,
  FlushTreasuryAthDue,
  FlushBurnAthDue,
  PrunePendingUsernameMint,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const USERNAME_MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;

export type M17TxMetric = {
  total_fees_nanotons: string;
  gas_used: string;
  gas_fees_nanotons: string;
  action_fees_nanotons: string;
  fwd_fees_nanotons: string;
  out_messages: number;
  aborted: boolean;
  success: boolean;
  exit_code: number | null;
};

export type M17OperationMetric = {
  label: string;
  inbound_value_nanotons: string;
  tx_count: number;
  total_fees_nanotons: string;
  max_single_tx_fee_nanotons: string;
  max_gas_used: string;
  aborted_count: number;
  failed_compute_count: number;
  transactions: M17TxMetric[];
};

export type M17ScenarioMetric = {
  id: string;
  status: 'ok';
  operations: M17OperationMetric[];
  total_fees_nanotons: string;
  max_operation_fee_nanotons: string;
  max_gas_used: string;
};

export type M17Report = {
  milestone: string;
  status: 'PASS';
  generated_at: string;
  note: string;
  thresholds: {
    max_total_fees_per_operation_nanotons: string;
    max_gas_used_per_transaction: string;
  };
  scenarios: M17ScenarioMetric[];
};

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function compactTx(tx: any): M17TxMetric {
  const desc = tx.description;
  const compute = desc?.computePhase?.type === 'vm' ? desc.computePhase : null;
  const action = desc?.actionPhase;
  return {
    total_fees_nanotons: String(tx.totalFees?.coins ?? 0n),
    gas_used: String(compute?.gasUsed ?? 0n),
    gas_fees_nanotons: String(compute?.gasFees ?? 0n),
    action_fees_nanotons: String(action?.totalActionFees ?? 0n),
    fwd_fees_nanotons: String(action?.totalFwdFees ?? 0n),
    out_messages: Number(tx.outMessagesCount ?? 0),
    aborted: Boolean(desc?.aborted),
    success: Boolean(compute?.success ?? true),
    exit_code: compute?.exitCode ?? null,
  };
}

function sumBig(values: bigint[]): bigint {
  return values.reduce((a, b) => a + b, 0n);
}

function opMetric(label: string, inboundValue: bigint, result: any): M17OperationMetric {
  const transactions = (result.transactions ?? []).map(compactTx);
  const fees = transactions.map((t: M17TxMetric) => BigInt(t.total_fees_nanotons));
  const gas = transactions.map((t: M17TxMetric) => BigInt(t.gas_used));
  return {
    label,
    inbound_value_nanotons: String(inboundValue),
    tx_count: transactions.length,
    total_fees_nanotons: String(sumBig(fees)),
    max_single_tx_fee_nanotons: String(fees.length ? fees.reduce((a: bigint, b: bigint) => a > b ? a : b) : 0n),
    max_gas_used: String(gas.length ? gas.reduce((a: bigint, b: bigint) => a > b ? a : b) : 0n),
    aborted_count: transactions.filter((t: M17TxMetric) => t.aborted).length,
    failed_compute_count: transactions.filter((t: M17TxMetric) => !t.success).length,
    transactions,
  };
}

function scenario(id: string, operations: M17OperationMetric[]): M17ScenarioMetric {
  const opFees = operations.map((o) => BigInt(o.total_fees_nanotons));
  const opGas = operations.map((o) => BigInt(o.max_gas_used));
  return {
    id,
    status: 'ok',
    operations,
    total_fees_nanotons: String(sumBig(opFees)),
    max_operation_fee_nanotons: String(opFees.length ? opFees.reduce((a, b) => a > b ? a : b) : 0n),
    max_gas_used: String(opGas.length ? opGas.reduce((a, b) => a > b ? a : b) : 0n),
  };
}

function assertScenarioHealthy(s: M17ScenarioMetric) {
  const maxFee = 100_000_000n; // 0.1 TON broad sanity threshold, not a final reserve proof.
  const maxGas = 100_000n;
  for (const op of s.operations) {
    if (BigInt(op.total_fees_nanotons) > maxFee) {
      throw new Error(`${s.id}/${op.label} total fees exceed sanity threshold: ${op.total_fees_nanotons}`);
    }
    if (BigInt(op.max_gas_used) > maxGas) {
      throw new Error(`${s.id}/${op.label} gas exceeds sanity threshold: ${op.max_gas_used}`);
    }
  }
}

async function deployAthWallet(blockchain: Blockchain, owner: Address, master: Address, balance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(balance, owner, master);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function athTransferScenario(): Promise<M17ScenarioMetric> {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const sourceOwner = await blockchain.treasury('m17-ath-transfer-source');
  const recipientOwner = fixtureAddress('M17_ATH_TRANSFER_RECIPIENT');
  const master = fixtureAddress('M17_ATH_TRANSFER_MASTER');
  const amount = 123_456_789n;
  const sourceWallet = await deployAthWallet(blockchain, sourceOwner.address, master, 1_000_000_000n);
  const value = toNano('0.2');
  const res = await sourceWallet.send(sourceOwner.getSender(), { value }, {
    $$type: 'ATHTransferRequest',
    query_id: 17001n,
    amount,
    recipient: recipientOwner,
    response_destination: sourceOwner.address,
  } as ATHTransferRequest);
  return scenario('ATH_TRANSFER_SUCCESS', [opMetric('owner_to_recipient_wallet', value, res)]);
}

async function athBurnScenario(): Promise<M17ScenarioMetric> {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const owner = await blockchain.treasury('m17-ath-burn-owner');
  const treasuryOwner = fixtureAddress('M17_ATH_MASTER_TREASURY');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();
  const masterInit = await ATHMaster.init(treasuryOwner, content);
  const masterAddress = contractAddress(0, masterInit);
  await blockchain.setShardAccount(masterAddress, createShardAccount({
    address: masterAddress,
    code: masterInit.code,
    data: masterInit.data,
    balance: toNano('2'),
    workchain: masterAddress.workChain,
  }));
  const wallet = await deployAthWallet(blockchain, owner.address, masterAddress, 1_000_000_000n);
  const value = toNano('0.2');
  const res = await wallet.send(owner.getSender(), { value }, {
    $$type: 'ATHBurn',
    query_id: 17002n,
    amount: 100_000_000n,
    response_destination: owner.address,
  } as ATHBurn);
  const master = blockchain.openContract(new ATHMaster(masterAddress, masterInit));
  const data = await master.getGetJettonData();
  if (data.total_supply !== ATH_TOTAL_SUPPLY_ATOMIC - 100_000_000n) {
    throw new Error('ATH burn scenario did not reduce total_supply exactly');
  }
  return scenario('ATH_BURN_SUCCESS', [opMetric('wallet_to_master_burn_finalized', value, res)]);
}


async function feeAccumulatorScenario(): Promise<M17ScenarioMetric> {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const capsuleHub = await blockchain.treasury('m17-fee-capsule');
  const operator = await blockchain.treasury('m17-fee-operator');
  const treasury = await blockchain.treasury('m17-fee-treasury');
  const buyback = fixtureAddress('M17_MISSING_BUYBACK');
  const init = await FeeAccumulator.init(treasury.address, buyback);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({ address, code: init.code, data: init.data, balance: toNano('2'), workchain: address.workChain }));
  const fee = blockchain.openContract(new FeeAccumulator(address, init));
  const bootstrapAmount = toNano('1');
  const buybackEnvelope = 51_050_000_000n;
  const postEnableAmount = buybackEnvelope * 2n;
  const bootstrapDepositValue = bootstrapAmount + toNano('0.1');
  const postEnableDepositValue = postEnableAmount + toNano('0.1');
  const enableValue = toNano('0.05');
  const splitValue = toNano('0.05');
  const flushTreasuryValue = toNano('0.1');
  const flushBuybackValue = toNano('0.2');
  const bootstrapDepositRes = await fee.send(capsuleHub.getSender(), { value: bootstrapDepositValue }, { $$type: 'DepositProtocolFee', amount: bootstrapAmount } as DepositProtocolFee);
  const enableRes = await fee.send(treasury.getSender(), { value: enableValue }, { $$type: 'EnableBuybackSplit' } as EnableBuybackSplit);
  const bootstrapTreasuryRes = await fee.send(operator.getSender(), { value: flushTreasuryValue }, { $$type: 'FlushTreasuryDue', amount: bootstrapAmount } as FlushTreasuryDue);
  const postEnableDepositRes = await fee.send(capsuleHub.getSender(), { value: postEnableDepositValue }, { $$type: 'DepositProtocolFee', amount: postEnableAmount } as DepositProtocolFee);
  const splitRes = await fee.send(capsuleHub.getSender(), { value: splitValue }, { $$type: 'SplitAccumulated' } as SplitAccumulated);
  const treasuryRes = await fee.send(operator.getSender(), { value: flushTreasuryValue }, { $$type: 'FlushTreasuryDue', amount: buybackEnvelope } as FlushTreasuryDue);
  const buybackRes = await fee.send(operator.getSender(), { value: flushBuybackValue }, { $$type: 'FlushBuybackDue', amount: buybackEnvelope } as FlushBuybackDue);
  const state = await fee.getGetState();
  if (state.treasury_due_ton !== 0n || state.buyback_due_ton !== buybackEnvelope) {
    throw new Error('FeeAccumulator scenario did not preserve expected due state after buyback bounce');
  }
  return scenario('FEEACCUMULATOR_SPLIT_FLUSH', [
    opMetric('deposit_bootstrap_protocol_fee', bootstrapDepositValue, bootstrapDepositRes),
    opMetric('enable_buyback_split', enableValue, enableRes),
    opMetric('flush_bootstrap_treasury_due', flushTreasuryValue, bootstrapTreasuryRes),
    opMetric('deposit_post_enable_protocol_fee', postEnableDepositValue, postEnableDepositRes),
    opMetric('split_accumulated', splitValue, splitRes),
    opMetric('flush_treasury_due', flushTreasuryValue, treasuryRes),
    opMetric('flush_buyback_due_bounce', flushBuybackValue, buybackRes),
  ]);
}

async function deployRegistryWithAthSystem(options: { officialWalletBalance: bigint; deployMaster: boolean }) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('m17-registry-deployer');
  const flusher = await blockchain.treasury('m17-registry-flusher');
  const placeholderAthWallet = fixtureAddress('M17_REGISTRY_PLACEHOLDER_ATH_WALLET');
  const treasuryAthReceiver = fixtureAddress('M17_REGISTRY_TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('M17_REGISTRY_VAULT');
  const masterTreasuryOwner = fixtureAddress('M17_REGISTRY_ATH_MASTER_TREASURY');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();
  const masterInit = await ATHMaster.init(masterTreasuryOwner, content);
  const athMasterAddress = contractAddress(0, masterInit);
  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  const officialZeroInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialBalanceInit = await ATHWallet.init(options.officialWalletBalance, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialZeroInit);

  if (options.deployMaster) {
    await blockchain.setShardAccount(athMasterAddress, createShardAccount({ address: athMasterAddress, code: masterInit.code, data: masterInit.data, balance: toNano('2'), workchain: athMasterAddress.workChain }));
  }
  await blockchain.setShardAccount(registryAddress, createShardAccount({ address: registryAddress, code: registryInit.code, data: registryInit.data, balance: toNano('3'), workchain: registryAddress.workChain }));
  await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({ address: officialAthWalletAddress, code: officialZeroInit.code, data: officialBalanceInit.data, balance: toNano('3'), workchain: officialAthWalletAddress.workChain }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialZeroInit));
  const master = blockchain.openContract(new ATHMaster(athMasterAddress, masterInit));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: USERNAME_MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: USERNAME_MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, officialAthWalletAddress, athMasterAddress, master, treasuryAthReceiver, flusher, vaultAddress };
}

async function mintValidName(blockchain: Blockchain, registry: any, officialAthWalletAddress: Address, ownerWallet: Address, name: string, payerWallet: Address) {
  // clean-16 L2/#14: registry now retains ~911M (6M + 800M item deploy + 1M + 4M + 100M name-record, 100-year
  // endowments); the mint notification must carry >= that.
  const value = toNano('1.2');
  const res = await registry.send(blockchain.sender(officialAthWalletAddress), { value }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 17701n,
    amount: PRICE_6_PLUS,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name).asCell(),
  } as AthTransferNotificationRegistryMintUsername);
  return { value, res };
}

async function usernameRegistryScenario(): Promise<M17ScenarioMetric> {
  const ctx = await deployRegistryWithAthSystem({ officialWalletBalance: PRICE_6_PLUS * 2n, deployMaster: true });
  const ownerA = fixtureAddress('M17_USERNAME_OWNER_A');
  const ownerRejected = fixtureAddress('M17_USERNAME_REJECTED_OWNER');
  const mintA = await mintValidName(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerA, 'platho', ctx.vaultAddress);
  if ((await ctx.registry.getGetNameRecord(nameHash('platho'))).exists !== true) {
    throw new Error('Username mint scenario did not create NameRecord');
  }

  const invalidValue = toNano('0.1');
  const invalidRes = await ctx.registry.send(ctx.blockchain.sender(ctx.officialAthWalletAddress), { value: invalidValue }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 17702n,
    amount: PRICE_6_PLUS,
    sender_key: 0n,
    payer_wallet: ctx.vaultAddress,
    owner_wallet: ownerRejected,
    username_len: 6n,
    username: usernameSlice('Larisa').asCell(),
  } as AthTransferNotificationRegistryMintUsername);

  const treasuryValue = toNano('0.2');
  const treasuryRes = await ctx.registry.send(ctx.flusher.getSender(), { value: treasuryValue }, {
    $$type: 'FlushTreasuryAthDue',
    query_id: 17703n,
  } as FlushTreasuryAthDue);

  const burnValue = toNano('0.2');
  const burnRes = await ctx.registry.send(ctx.flusher.getSender(), { value: burnValue }, {
    $$type: 'FlushBurnAthDue',
    query_id: 17704n,
  } as FlushBurnAthDue);

  const afterMaster = await ctx.master.getGetJettonData();
  if (afterMaster.total_supply !== ATH_TOTAL_SUPPLY_ATOMIC - HALF_PRICE) {
    throw new Error('Username burn flush did not decrease ATH total_supply exactly');
  }

  // Create a stuck pending mint with no ACK, then prune it after TTL.
  const ctxPrune = await deployRegistryWithAthSystem({ officialWalletBalance: PRICE_6_PLUS, deployMaster: true });
  const ownerPrune = fixtureAddress('M17_USERNAME_PRUNE_OWNER');
  const stuckName = 'stuckx';
  const stuckHash = nameHash(stuckName);
  const noAckItemInit = await (await import('../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck')).MockUsernameNFTItemNoAck.init();
  const itemAddress = await ctxPrune.registry.getGetUsernameItemAddress(stuckHash);
  await ctxPrune.blockchain.setShardAccount(itemAddress, createShardAccount({
    address: itemAddress,
    code: noAckItemInit.code,
    data: noAckItemInit.data,
    balance: toNano('0.1'),
    workchain: itemAddress.workChain,
  }));
  const stuckMint = await mintValidName(ctxPrune.blockchain, ctxPrune.registry, ctxPrune.officialAthWalletAddress, ownerPrune, stuckName, ctxPrune.vaultAddress);
  ctxPrune.blockchain.now = (ctxPrune.blockchain.now ?? 1_700_000_000) + 86_401;
  const pruneValue = toNano('0.05');
  const pruneRes = await ctxPrune.registry.send(ctxPrune.flusher.getSender(), { value: pruneValue }, {
    $$type: 'PrunePendingUsernameMint',
    name_hash: stuckHash,
  } as PrunePendingUsernameMint);

  return scenario('USERNAME_REGISTRY_MINT_FLUSH_PRUNE', [
    opMetric('valid_username_mint_with_item_ack', mintA.value, mintA.res),
    opMetric('invalid_username_rejected_notification', invalidValue, invalidRes),
    opMetric('flush_treasury_due_ath', treasuryValue, treasuryRes),
    opMetric('flush_burn_due_ath', burnValue, burnRes),
    opMetric('stuck_pending_mint_creation_no_ack', stuckMint.value, stuckMint.res),
    opMetric('prune_stale_pending_mint', pruneValue, pruneRes),
  ]);
}


export async function runM17GasReserveSanity(writeArtifacts = true): Promise<M17Report> {
  const scenarios = [
    await athTransferScenario(),
    await athBurnScenario(),
    await feeAccumulatorScenario(),
    await usernameRegistryScenario(),
  ];
  scenarios.forEach(assertScenarioHealthy);
  const report: M17Report = {
    milestone: 'M17_GAS_RESERVE_SANITY',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    note: 'Sandbox gas/reserve sanity pass for implemented subset. Not a final mainnet gas freeze. Thresholds are broad regression guards, not protocol reserves.',
    thresholds: {
      max_total_fees_per_operation_nanotons: '100000000',
      max_gas_used_per_transaction: '100000',
    },
    scenarios,
  };
  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'm17_gas_reserve_sanity_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'm17_gas_reserve_sanity_summary.md'), renderMarkdown(report));
  }
  return report;
}

function renderMarkdown(report: M17Report): string {
  const lines: string[] = [];
  lines.push('# Platho M17 Gas / Reserve Sanity Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('| Scenario | Operations | Total fees, nanotons | Max op fee, nanotons | Max gas used |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const s of report.scenarios) {
    lines.push(`| ${s.id} | ${s.operations.length} | ${s.total_fees_nanotons} | ${s.max_operation_fee_nanotons} | ${s.max_gas_used} |`);
  }
  lines.push('');
  lines.push('## Operation details');
  for (const s of report.scenarios) {
    lines.push('');
    lines.push(`### ${s.id}`);
    lines.push('');
    lines.push('| Operation | Tx count | Total fees | Max single tx fee | Max gas used | Aborted | Failed compute |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|');
    for (const op of s.operations) {
      lines.push(`| ${op.label} | ${op.tx_count} | ${op.total_fees_nanotons} | ${op.max_single_tx_fee_nanotons} | ${op.max_gas_used} | ${op.aborted_count} | ${op.failed_compute_count} |`);
    }
  }
  lines.push('');
  lines.push('## Result');
  lines.push('');
  lines.push('No implemented-subset scenario exceeded the broad M17 sanity thresholds. This does not finalize mainnet gas constants; it only prevents obvious reserve regressions while BuybackBurn/STON.fi values remain blocked.');
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) {
  runM17GasReserveSanity(true)
    .then((report) => {
      console.log(JSON.stringify({ status: report.status, scenarios: report.scenarios.length }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
