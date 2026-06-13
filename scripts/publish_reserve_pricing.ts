import { Cell, external, toNano } from '@ton/core';
import { defaultConfig, loadConfig } from '@ton/sandbox';
import * as fs from 'fs';
import * as path from 'path';

import { TopUpStorageReserve as CapsuleTopUpStorageReserve } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  ACT_PUBLISH_BATCH,
  KIND_PRIVATE,
  KIND_PUBLIC,
  MANIFEST_HASH,
  RES_CONFIRMED,
  batchExternalBody,
  deployBoundSealedPair,
  depositTon,
  partsList,
  registerHybrid,
} from '../tests/helpers/vpb2';

// VPB2 migration: the single-publish surface (PublishPrivateFromVault / PublishPublicFromVault) and the
// per-message Vault.get_canonical_publish_charge getter were removed with the batch redeploy (commit d602d74).
// This harness now drives the real VPB2 batch path — a signed batch external through the bound+sealed
// Vault -> PublishBatchToHub -> CapsuleHub ingest -> CapsuleHubBatchAck -> Vault settle — to capture
// current-build fee evidence, and sources the per-size hold / net price / protocol fee from the client
// message-pricing-policy tables (mirrored below). See tests/helpers/vpb2.ts for the wire format.

// EVIDENCE_MAX_CHARGE clears the VPB2 pre-accept floor (BATCH_FLOOR_BASE_PIN 200_700_000 + per-part pin) so the
// batch settles CONFIRMED and refunds the excess down to the runtime-priced canonical total. It is the signed
// hold *envelope* for the sandbox evidence run, NOT the per-size client hold reported in canonical_max_charge.
const EVIDENCE_MAX_CHARGE = toNano('1');
const EVIDENCE_DEPOSIT = toNano('2');
const RECEIPT_RING_SIZE = 20n;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const BASE_NOW = 1_700_000_000;

const SIZE_CLASSES = [1n, 2n, 4n, 8n, 16n, 32n] as const;

// Mirror of web/message-pricing-policy.mjs (PUBLIC/PRIVATE_CAPSULE_HOLD + _NET_PRICE tables and the
// SUCCESSFUL_PUBLISH_ACK_REFUND constant). Kept in sync — not derived — so the artifact stays a flat pin;
// tests/publish-reserve-pricing-artifact and scripts/preprod_guard.mjs both cross-check these against the
// policy module and fail the build on any drift. These hold/net tables are the OLD per-message client model
// and are slated for re-derivation against the batch floor-pin in the Session 6 client pricing rework.
const PROTOCOL_FEE = 10_000_000n;
const SUCCESSFUL_PUBLISH_ACK_REFUND = 25_800_000n;
const PUBLIC_HOLD_BY_SIZE: Record<number, bigint> = {
  1: 59_500_000n,
  2: 66_500_000n,
  4: 70_200_000n,
  8: 77_800_000n,
  16: 93_100_000n,
  32: 123_600_000n,
};
const PRIVATE_HOLD_BY_SIZE: Record<number, bigint> = {
  1: 60_500_000n,
  2: 62_400_000n,
  4: 66_100_000n,
  8: 73_700_000n,
  16: 89_000_000n,
  32: 119_500_000n,
};
// Net price = hold - successful-publish ACK refund (PUBLIC_CAPSULE_NET_PRICE / PRIVATE_CAPSULE_NET_PRICE).
function netPrice(hold: bigint): bigint {
  return hold - SUCCESSFUL_PUBLISH_ACK_REFUND;
}

const CURRENT = {
  privateHybridFee: PROTOCOL_FEE,
  publicFee: PROTOCOL_FEE,
  successfulPublishAckRefund: SUCCESSFUL_PUBLISH_ACK_REFUND,
  // VPB2 pinned pre-accept floor (contracts/Vault.tact BATCH_FLOOR_BASE_PIN / BATCH_FLOOR_PER_PART_PIN).
  batchFloorBasePin: 200_700_000n,
  batchFloorPerPartPin: 6_200_000n,
  ackMinForward: 30_000_000n,
};

type PublishCaseId = string;

type PublishCaseSpec = {
  id: PublishCaseId;
  kind: bigint;
  sizeClass: bigint;
  hold: bigint;
  net: bigint;
  protocolFee: bigint;
};

type TxMetric = {
  role: string;
  inbound_type: string;
  inbound_value_nanotons: string;
  total_fees_nanotons: string;
  storage_fees_nanotons: string;
  gas_used: string;
  gas_fees_nanotons: string;
  action_fees_nanotons: string;
  fwd_fees_nanotons: string;
  out_messages: number;
  aborted: boolean;
  success: boolean;
  exit_code: number | null;
};

type PublishCaseReport = {
  id: PublishCaseId;
  canonical_max_charge_nanotons: string;
  protocol_fee_nanotons: string;
  user_net_debit_nanotons: string;
  observed_settled_charge_nanotons: string;
  vault_external_fee_nanotons: string;
  capsulehub_publish_fee_nanotons: string;
  vault_ack_fee_nanotons: string;
  one_year_storage_fee_nanotons: string;
  recommended: {
    vault_local_exec_reserve_nanotons: string;
    capsulehub_exec_reserve_nanotons: string;
    vault_pending_refund_exec_reserve_nanotons: string;
    storage_endowment_1y_x2_nanotons: string;
    storage_endowment_3y_x2_nanotons: string;
    storage_endowment_5y_x2_nanotons: string;
    net_price_1y_storage_x2_nanotons: string;
    net_price_3y_storage_x2_nanotons: string;
    net_price_5y_storage_x2_nanotons: string;
  };
  transactions: TxMetric[];
};

type PricingReport = {
  profile: 'PLATHO.V1.PUBLISH_RESERVE_PRICING';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  code_hashes: {
    vault: string;
    capsulehub: string;
    ath_wallet: string;
  };
  policy: {
    network_fee_basis: string;
    reference_safety_multiplier: string;
    storage_note: string;
    client_pricing_source: string;
    current_code_hash_gate: string;
  };
  fee_config_snapshot: Record<string, string>;
  current_constants_nanotons: Record<string, string>;
  cases: PublishCaseReport[];
};

function codeHash(relPath: string): string {
  return Cell.fromBoc(fs.readFileSync(relPath))[0].hash().toString('hex');
}

function currentFeeConfigSnapshot(): Record<string, string> {
  const config = loadConfig(defaultConfig) as any;
  const storagePrices = config['18']?.anon0;
  const gas = config['21']?.anon0;
  const forward = config['25']?.anon0;
  if (!storagePrices || !gas || !forward) {
    throw new Error('Bundled sandbox config is missing basechain storage/gas/forward fee params 18/21/25');
  }
  let latestStorage: any = null;
  for (const [, storage] of storagePrices) {
    if (!latestStorage || Number(storage.utime_since) > Number(latestStorage.utime_since)) {
      latestStorage = storage;
    }
  }
  if (!latestStorage) {
    throw new Error('Bundled sandbox config has no basechain storage fee schedule in param 18');
  }
  const gasOther = gas.other;
  const snapshot: Record<string, string> = {
    source: '@ton/sandbox defaultConfig, verified against TON mainnet config on 2026-06-02',
    config_18_latest_utime_since: String(latestStorage.utime_since),
    config_18_latest_bit_price_ps: String(latestStorage.bit_price_ps),
    config_18_latest_cell_price_ps: String(latestStorage._cell_price_ps),
    config_18_latest_mc_bit_price_ps: String(latestStorage.mc_bit_price_ps),
    config_18_latest_mc_cell_price_ps: String(latestStorage.mc_cell_price_ps),
    config_21_flat_gas_limit: String(gas.flat_gas_limit),
    config_21_flat_gas_price: String(gas.flat_gas_price),
    config_21_gas_price: String(gasOther.gas_price),
    config_21_gas_limit: String(gasOther.gas_limit),
    config_21_special_gas_limit: String(gasOther.special_gas_limit),
    config_25_lump_price: String(forward.lump_price),
    config_25_bit_price: String(forward.bit_price),
    config_25_cell_price: String(forward._cell_price),
  };
  const expected: Record<string, string> = {
    config_18_latest_utime_since: '1777500000',
    config_18_latest_bit_price_ps: '0',
    config_18_latest_cell_price_ps: '135',
    config_18_latest_mc_bit_price_ps: '1000',
    config_18_latest_mc_cell_price_ps: '500000',
    config_21_flat_gas_limit: '100',
    config_21_flat_gas_price: '6667',
    config_21_gas_price: '4369067',
    config_25_lump_price: '66667',
    config_25_bit_price: '4369067',
    config_25_cell_price: '436906667',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (snapshot[key] !== value) {
      throw new Error(`Bundled fee config ${key}=${snapshot[key]} does not match the audited 2026-06-02 TON mainnet value ${value}`);
    }
  }
  return snapshot;
}

function addressFromTx(tx: any): any {
  const info = tx.inMessage?.info;
  if (info?.type === 'external-in') {
    return info.dest ?? null;
  }
  if (info?.type === 'internal') {
    return info.dest ?? null;
  }
  return null;
}

function inboundType(tx: any): string {
  return tx.inMessage?.info?.type ?? 'unknown';
}

function inboundValue(tx: any): bigint {
  const info = tx.inMessage?.info;
  if (info?.type === 'internal') {
    return info.value?.coins ?? 0n;
  }
  return 0n;
}

function txStorageFees(tx: any): bigint {
  return tx.description?.storagePhase?.storageFeesCollected ?? 0n;
}

function txMetric(tx: any, role: string): TxMetric {
  const desc = tx.description;
  const compute = desc?.computePhase?.type === 'vm' ? desc.computePhase : null;
  const action = desc?.actionPhase;
  return {
    role,
    inbound_type: inboundType(tx),
    inbound_value_nanotons: String(inboundValue(tx)),
    total_fees_nanotons: String(tx.totalFees?.coins ?? 0n),
    storage_fees_nanotons: String(txStorageFees(tx)),
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

function ceilMul(value: bigint, multiplier: bigint): bigint {
  return value * multiplier;
}

function roundUp(value: bigint, quantum: bigint): bigint {
  return ((value + quantum - 1n) / quantum) * quantum;
}

function txAtRole(tx: any, ctx: { vaultAddress: any; hubAddress: any }): string {
  const address = addressFromTx(tx);
  if (!address) {
    return 'unknown';
  }
  if (address.equals(ctx.vaultAddress)) {
    return inboundType(tx) === 'external-in' ? 'vault_external_publish' : 'vault_ack_or_bounce';
  }
  if (address.equals(ctx.hubAddress)) {
    return 'capsulehub_publish';
  }
  return 'other';
}

function sumFees(metrics: TxMetric[], role: string): bigint {
  return metrics
    .filter((m) => m.role === role)
    .reduce((acc, m) => acc + BigInt(m.total_fees_nanotons), 0n);
}

// Drives one signed 1-part VPB2 batch external through a freshly bound+sealed Vault/CapsuleHub pair and
// returns the settled transactions. Mirrors tests/vault-hub-batch-integration (E2E-BATCH-01).
async function publishBatch(kind: bigint, sizeClass: bigint) {
  const ctx = await deployBoundSealedPair();
  const { blockchain, vault, hub, user, vaultAddress } = ctx;
  await registerHybrid(vault, user);
  await depositTon(vault, user, EVIDENCE_DEPOSIT);
  const before = await vault.getGetUser(user.address);
  const partsRoot = partsList(kind, 1, sizeClass);
  const result = await blockchain.sendMessage(external({
    to: vaultAddress,
    body: batchExternalBody({
      vaultAddr: vaultAddress,
      owner: user.address,
      nonce: before.publish_nonce,
      maxCharge: EVIDENCE_MAX_CHARGE,
      partCount: 1n,
      partsRoot,
      kind,
      genesisHash: MANIFEST_HASH,
    }),
  }));
  return { ctx, before, result };
}

async function oneYearStorageFee(id: PublishCaseId, kind: bigint, sizeClass: bigint): Promise<bigint> {
  const { ctx } = await publishBatch(kind, sizeClass);
  ctx.blockchain.now = BASE_NOW + SECONDS_PER_YEAR;
  const touch = await ctx.hub.send(ctx.deployer.getSender(), { value: 2_000_000n }, {
    $$type: 'TopUpStorageReserve',
  } as CapsuleTopUpStorageReserve);
  const hubTx = touch.transactions.find((tx: any) => addressFromTx(tx)?.equals(ctx.hub.address));
  if (!hubTx) {
    throw new Error(`Missing one-year CapsuleHub storage touch tx for ${id}`);
  }

  const empty = await deployBoundSealedPair();
  empty.blockchain.now = BASE_NOW + SECONDS_PER_YEAR;
  const emptyTouch = await empty.hub.send(empty.deployer.getSender(), { value: 2_000_000n }, {
    $$type: 'TopUpStorageReserve',
  } as CapsuleTopUpStorageReserve);
  const emptyTx = emptyTouch.transactions.find((tx: any) => addressFromTx(tx)?.equals(empty.hub.address));
  if (!emptyTx) {
    throw new Error(`Missing empty one-year CapsuleHub storage touch tx for ${id}`);
  }

  return txStorageFees(hubTx) - txStorageFees(emptyTx);
}

async function measureCase(spec: PublishCaseSpec): Promise<PublishCaseReport> {
  const { id, kind, sizeClass, hold, net, protocolFee } = spec;

  const { ctx, before, result } = await publishBatch(kind, sizeClass);
  const { vault, hub, user, vaultAddress } = ctx;

  const after = await vault.getGetUser(user.address);
  if (after.publish_nonce !== before.publish_nonce + 1n) {
    throw new Error(`${id}: publish nonce did not advance`);
  }
  if ((await vault.getGetGlobal()).pending_publish_count !== 0n) {
    throw new Error(`${id}: pending publish did not clear`);
  }
  const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(before.publish_nonce % RECEIPT_RING_SIZE));
  if (!slot || slot.action !== ACT_PUBLISH_BATCH || slot.result !== RES_CONFIRMED) {
    throw new Error(`${id}: batch did not settle CONFIRMED (action=${slot?.action} result=${slot?.result})`);
  }

  const metrics = result.transactions.map((tx: any) => txMetric(tx, txAtRole(tx, {
    vaultAddress,
    hubAddress: hub.address,
  })));
  const hubPublish = metrics.find((tx) => tx.role === 'capsulehub_publish');
  if (!hubPublish || hubPublish.aborted || !hubPublish.success || hubPublish.exit_code !== 0) {
    throw new Error(`${id}: CapsuleHub batch ingest did not finalize successfully`);
  }

  const observedSettledCharge = before.ton_balance - after.ton_balance;
  const vaultExternalFee = sumFees(metrics, 'vault_external_publish');
  const capsuleHubFee = sumFees(metrics, 'capsulehub_publish');
  const vaultAckFee = sumFees(metrics, 'vault_ack_or_bounce');
  const storageOneYear = await oneYearStorageFee(id, kind, sizeClass);

  const vaultLocalRecommended = roundUp(ceilMul(vaultExternalFee, 2n), 100_000n);
  const capsuleRecommended = roundUp(ceilMul(capsuleHubFee, 2n), 100_000n);
  const ackRecommended = roundUp(ceilMul(vaultAckFee, 2n), 100_000n);
  const storage1y = roundUp(storageOneYear * 2n, 100_000n);
  const storage3y = roundUp(storageOneYear * 6n, 100_000n);
  const storage5y = roundUp(storageOneYear * 10n, 100_000n);

  return {
    id,
    canonical_max_charge_nanotons: String(hold),
    protocol_fee_nanotons: String(protocolFee),
    user_net_debit_nanotons: String(net),
    observed_settled_charge_nanotons: String(observedSettledCharge),
    vault_external_fee_nanotons: String(vaultExternalFee),
    capsulehub_publish_fee_nanotons: String(capsuleHubFee),
    vault_ack_fee_nanotons: String(vaultAckFee),
    one_year_storage_fee_nanotons: String(storageOneYear),
    recommended: {
      vault_local_exec_reserve_nanotons: String(vaultLocalRecommended),
      capsulehub_exec_reserve_nanotons: String(capsuleRecommended),
      vault_pending_refund_exec_reserve_nanotons: String(ackRecommended),
      storage_endowment_1y_x2_nanotons: String(storage1y),
      storage_endowment_3y_x2_nanotons: String(storage3y),
      storage_endowment_5y_x2_nanotons: String(storage5y),
      net_price_1y_storage_x2_nanotons: String(protocolFee + vaultLocalRecommended + capsuleRecommended + ackRecommended + storage1y),
      net_price_3y_storage_x2_nanotons: String(protocolFee + vaultLocalRecommended + capsuleRecommended + ackRecommended + storage3y),
      net_price_5y_storage_x2_nanotons: String(protocolFee + vaultLocalRecommended + capsuleRecommended + ackRecommended + storage5y),
    },
    transactions: metrics,
  };
}

function renderMarkdown(report: PricingReport): string {
  const lines: string[] = [];
  lines.push('# Publish Reserve Pricing Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push('Current code hashes:');
  lines.push('');
  lines.push(`- Vault: \`${report.code_hashes.vault}\``);
  lines.push(`- CapsuleHub: \`${report.code_hashes.capsulehub}\``);
  lines.push(`- ATHWallet: \`${report.code_hashes.ath_wallet}\``);
  lines.push('');
  lines.push('Policy: the canonical max charge (hold), net price, and 0.010 TON protocol fee per size class are the client message-pricing-policy tables; the measured fees are sandbox evidence from a signed VPB2 batch external driven through the bound+sealed Vault + CapsuleHub at the current code hashes. Observed fees use the bundled sandbox config matching the audited TON mainnet basechain fee snapshot. The x2 columns are reference sizing only; PASS does not require reserves to equal a 2x target.');
  lines.push('');
  lines.push('Fee snapshot:');
  lines.push('');
  lines.push(`- Source: ${report.fee_config_snapshot.source}`);
  lines.push(`- Config 18 latest basechain storage since: \`${report.fee_config_snapshot.config_18_latest_utime_since}\``);
  lines.push(`- Config 18 basechain bit/cell prices ps: \`${report.fee_config_snapshot.config_18_latest_bit_price_ps}\` / \`${report.fee_config_snapshot.config_18_latest_cell_price_ps}\``);
  lines.push(`- Config 21 flat gas price: \`${report.fee_config_snapshot.config_21_flat_gas_price}\``);
  lines.push(`- Config 21 gas price: \`${report.fee_config_snapshot.config_21_gas_price}\``);
  lines.push(`- Config 25 lump/bit/cell prices: \`${report.fee_config_snapshot.config_25_lump_price}\` / \`${report.fee_config_snapshot.config_25_bit_price}\` / \`${report.fee_config_snapshot.config_25_cell_price}\``);
  lines.push('');
  lines.push('| Case | Hold | Net price | Observed settled | Vault fee | Capsule fee | ACK fee | 1y storage | Reference x2 net 1y | Reference x2 net 3y | Reference x2 net 5y |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of report.cases) {
    lines.push(`| ${c.id} | ${c.canonical_max_charge_nanotons} | ${c.user_net_debit_nanotons} | ${c.observed_settled_charge_nanotons} | ${c.vault_external_fee_nanotons} | ${c.capsulehub_publish_fee_nanotons} | ${c.vault_ack_fee_nanotons} | ${c.one_year_storage_fee_nanotons} | ${c.recommended.net_price_1y_storage_x2_nanotons} | ${c.recommended.net_price_3y_storage_x2_nanotons} | ${c.recommended.net_price_5y_storage_x2_nanotons} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function runPublishReservePricing(writeArtifacts = true): Promise<PricingReport> {
  const publicCases: PublishCaseSpec[] = SIZE_CLASSES.map((sizeClass) => {
    const hold = PUBLIC_HOLD_BY_SIZE[Number(sizeClass)];
    return {
      id: `public_${sizeClass}k`,
      kind: KIND_PUBLIC,
      sizeClass,
      hold,
      net: netPrice(hold),
      protocolFee: CURRENT.publicFee,
    };
  });
  const privateCases: PublishCaseSpec[] = SIZE_CLASSES.map((sizeClass) => {
    const hold = PRIVATE_HOLD_BY_SIZE[Number(sizeClass)];
    return {
      id: `private_hybrid_${sizeClass}k`,
      kind: KIND_PRIVATE,
      sizeClass,
      hold,
      net: netPrice(hold),
      protocolFee: CURRENT.privateHybridFee,
    };
  });
  const cases = [
    ...(await Promise.all(publicCases.map((item) => measureCase(item)))),
    ...(await Promise.all(privateCases.map((item) => measureCase(item)))),
  ];
  const report: PricingReport = {
    profile: 'PLATHO.V1.PUBLISH_RESERVE_PRICING',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      vault: codeHash(path.join('build', 'Vault', 'Vault_Vault.code.boc')),
      capsulehub: codeHash(path.join('build', 'CapsuleHub', 'CapsuleHub_CapsuleHub.code.boc')),
      ath_wallet: codeHash(path.join('build', 'ATHWallet', 'ATHWallet_ATHWallet.code.boc')),
    },
    policy: {
      network_fee_basis: 'Measured on @ton/sandbox defaultConfig matching the audited 2026-06-02 TON mainnet basechain storage/gas/forward fee snapshot.',
      reference_safety_multiplier: '2',
      storage_note: 'Storage is continuous rent, not a one-shot fee. The report gives 1y/3y/5y reference options at 2x observed incremental yearly CapsuleHub index/header rent; pages are virtual entry-id ranges.',
      client_pricing_source: 'canonical_max_charge_nanotons (hold), user_net_debit_nanotons (net = hold - successful-publish ACK refund), and protocol_fee_nanotons mirror web/message-pricing-policy.mjs. The sandbox evidence run signs the contract-required hold envelope (clears the VPB2 pre-accept floor) and refunds down to the runtime canonical total recorded as observed_settled_charge_nanotons.',
      current_code_hash_gate: 'This report is deploy evidence only when code_hashes match artifacts/CURRENT_CODE_HASHES.txt for the release being verified.',
    },
    fee_config_snapshot: currentFeeConfigSnapshot(),
    current_constants_nanotons: Object.fromEntries(Object.entries(CURRENT).map(([key, value]) => [key, String(value)])),
    cases,
  };
  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'publish_reserve_pricing_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'publish_reserve_pricing_summary.md'), renderMarkdown(report));
  }
  return report;
}

if (require.main === module) {
  runPublishReservePricing(true)
    .then((report) => {
      console.log(JSON.stringify({
        status: report.status,
        cases: report.cases.map((item) => ({
          id: item.id,
          hold: item.canonical_max_charge_nanotons,
          net: item.user_net_debit_nanotons,
          observed_settled: item.observed_settled_charge_nanotons,
          reference_x2_1y_net: item.recommended.net_price_1y_storage_x2_nanotons,
          reference_x2_3y_net: item.recommended.net_price_3y_storage_x2_nanotons,
          reference_x2_5y_net: item.recommended.net_price_5y_storage_x2_nanotons,
        })),
      }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
