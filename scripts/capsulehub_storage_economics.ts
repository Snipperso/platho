import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  CapsuleHub,
  PublishPrivateFromVault,
  PublishPublicFromVault,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { MockVaultAckSink } from '../build/MockVaultAckSink/MockVaultAckSink_MockVaultAckSink';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const PLATHO_PUBLIC_MARKETING_NOTE = 0x73656e742076696120506c6174686f2e417070n;

const PRIVATE_STANDARD_FEE = 5_000_000n;
const PRIVATE_HYBRID_FEE = 10_000_000n;
const PUBLIC_FEE = 5_000_000n;
const PRIVATE_STANDARD_EXEC = 3_000_000n;
const PRIVATE_HYBRID_EXEC = 4_000_000n;
const PUBLIC_EXEC = 3_000_000n;
const KEEPALIVE = 1_000_000n;
const PRIVATE_ENTRY_STORAGE = 4_000_000n;
const PUBLIC_ENTRY_STORAGE = 1_000_000n;
const ACK_RESERVE = 30_000_000n;

const HEADER0_BYTES = 140;
const HEADER1_BYTES = 30;
const STANDARD_BODY_BYTES = 1140;
const HYBRID_BODY_BYTES = 2228;
const PUBLIC_HEADER_BYTES = 68;
const PUBLIC_HEADER_MAX_BYTES = 72;
const PUBLIC_BODY_MAX_BYTES = 1024;

export type CapsuleHubStorageCase = {
  label: string;
  inbound_value_nanotons: string;
  protocol_fee_delta_nanotons: string;
  balance_delta_nanotons: string;
  retained_non_fee_nanotons: string;
  required_storage_reserve_nanotons: string;
  retained_margin_nanotons: string;
  tx_count: number;
  aborted_count: number;
};

export type CapsuleHubStorageEconomicsReport = {
  profile: 'PLATHO.V1.CAPSULEHUB_STORAGE_ECONOMICS';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  note: string;
  canonical_capsule_cells: {
    header0_bytes: number;
    header1_bytes: number;
    standard_body_bytes: number;
    hybrid_body_bytes: number;
    public_header_max_bytes: number;
    public_body_max_bytes: number;
  };
  cases: CapsuleHubStorageCase[];
  worst_margin_nanotons: string;
};

function snakeCell(byteLength: number, fill = 0x61): Cell {
  const bytes = Buffer.alloc(byteLength, fill);
  let tail: Cell | null = null;
  for (let offset = bytes.length; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(bytes.subarray(start, offset));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

function cellHash(cell: Cell): bigint {
  return BigInt(`0x${cell.hash().toString('hex')}`);
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.CAPSULEHUB.ECON.${label}`).digest());
}

function hash256(label: string): bigint {
  return BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULEHUB.ECON.${label}`).digest('hex'));
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const author = await blockchain.treasury('caphub-econ-author');
  const feeAccumulator = fixtureAddress('FEE_ACCUMULATOR');
  const genesisController = fixtureAddress('GENESIS_CONTROLLER');

  const mockVaultInit = await MockVaultAckSink.init();
  const mockVaultAddress = contractAddress(0, mockVaultInit);
  await blockchain.setShardAccount(mockVaultAddress, createShardAccount({
    address: mockVaultAddress,
    code: mockVaultInit.code,
    data: mockVaultInit.data,
    balance: toNano('1'),
    workchain: mockVaultAddress.workChain,
  }));

  const init = await CapsuleHub.init(feeAccumulator, mockVaultAddress, true, true, MANIFEST_HASH, genesisController);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: 0n,
    workchain: address.workChain,
  }));

  return {
    blockchain,
    capsule: blockchain.openContract(new CapsuleHub(address, init)),
    author,
    mockVaultAddress,
  };
}

async function balanceOf(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function privateVault(sizeClass: 1n | 2n, fill: number): PublishPrivateFromVault {
  const header0 = snakeCell(HEADER0_BYTES, fill);
  const header1 = snakeCell(HEADER1_BYTES, fill + 1);
  const body = snakeCell(sizeClass === 2n ? HYBRID_BODY_BYTES : STANDARD_BODY_BYTES, fill + 2);
  return {
    $$type: 'PublishPrivateFromVault',
    bounce_id: BigInt(10_000 + fill),
    bounce_tag: BigInt(30_000 + fill),
    publish_id: hash256(`vault-private-${fill}`),
    size_class: sizeClass,
    crypto_suite: sizeClass,
    header_0_hash: cellHash(header0),
    header_1_hash: cellHash(header1),
    body_hash: cellHash(body),
    header_0: header0,
    header_1: header1,
    body,
    protocol_fee_paid: sizeClass === 2n ? PRIVATE_HYBRID_FEE : PRIVATE_STANDARD_FEE,
  };
}

function publicVault(fill: number, author: Address): PublishPublicFromVault {
  const header = snakeCell(PUBLIC_HEADER_BYTES, 0x50);
  const body = snakeCell(PUBLIC_BODY_MAX_BYTES, fill);
  return {
    $$type: 'PublishPublicFromVault',
    bounce_id: BigInt(20_000 + fill),
    bounce_tag: BigInt(40_000 + fill),
    publish_id: hash256(`vault-public-${fill}`),
    marketing_note: PLATHO_PUBLIC_MARKETING_NOTE,
    author_wallet: author,
    header_hash: cellHash(header),
    body_hash: cellHash(body),
    header,
    body,
    protocol_fee_paid: PUBLIC_FEE,
  };
}

function abortedCount(result: any): number {
  return (result.transactions ?? []).filter((tx: any) => Boolean(tx.description?.aborted)).length;
}

async function measure(
  label: string,
  inbound: bigint,
  storageReserve: bigint,
  send: (ctx: Awaited<ReturnType<typeof setup>>) => Promise<any>,
): Promise<CapsuleHubStorageCase> {
  const ctx = await setup();
  const beforeBalance = await balanceOf(ctx.blockchain, ctx.capsule.address);
  const beforeState = await ctx.capsule.getGetState();
  const result = await send(ctx);
  const afterState = await ctx.capsule.getGetState();
  const afterBalance = await balanceOf(ctx.blockchain, ctx.capsule.address);
  const balanceDelta = afterBalance - beforeBalance;
  const feeDelta = afterState.accrued_plato_fee_ton - beforeState.accrued_plato_fee_ton;
  const retainedNonFee = balanceDelta - feeDelta;
  const margin = retainedNonFee - storageReserve;
  if (margin < 0n) {
    throw new Error(`${label} under-retained storage reserve by ${-margin} nanotons`);
  }
  return {
    label,
    inbound_value_nanotons: String(inbound),
    protocol_fee_delta_nanotons: String(feeDelta),
    balance_delta_nanotons: String(balanceDelta),
    retained_non_fee_nanotons: String(retainedNonFee),
    required_storage_reserve_nanotons: String(storageReserve),
    retained_margin_nanotons: String(margin),
    tx_count: result.transactions?.length ?? 0,
    aborted_count: abortedCount(result),
  };
}

export async function runCapsuleHubStorageEconomics(writeArtifacts = true): Promise<CapsuleHubStorageEconomicsReport> {
  const cases = [
    await measure(
      'VAULT_PRIVATE_STANDARD',
      PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE,
      KEEPALIVE + PRIVATE_ENTRY_STORAGE,
      (ctx) => ctx.capsule.send(ctx.blockchain.sender(ctx.mockVaultAddress), {
        value: PRIVATE_STANDARD_FEE + PRIVATE_STANDARD_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE,
      }, privateVault(1n, 0x60)),
    ),
    await measure(
      'VAULT_PRIVATE_HYBRID',
      PRIVATE_HYBRID_FEE + PRIVATE_HYBRID_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE,
      KEEPALIVE + PRIVATE_ENTRY_STORAGE,
      (ctx) => ctx.capsule.send(ctx.blockchain.sender(ctx.mockVaultAddress), {
        value: PRIVATE_HYBRID_FEE + PRIVATE_HYBRID_EXEC + KEEPALIVE + PRIVATE_ENTRY_STORAGE + ACK_RESERVE,
      }, privateVault(2n, 0x70)),
    ),
    await measure(
      'VAULT_PUBLIC_STANDARD',
      PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE,
      KEEPALIVE + PUBLIC_ENTRY_STORAGE,
      (ctx) => ctx.capsule.send(ctx.blockchain.sender(ctx.mockVaultAddress), {
        value: PUBLIC_FEE + PUBLIC_EXEC + KEEPALIVE + PUBLIC_ENTRY_STORAGE + ACK_RESERVE,
      }, publicVault(0x80, ctx.author.address)),
    ),
  ];
  const worst = cases.map((c) => BigInt(c.retained_margin_nanotons)).reduce((a, b) => a < b ? a : b);
  const report: CapsuleHubStorageEconomicsReport = {
    profile: 'PLATHO.V1.CAPSULEHUB_STORAGE_ECONOMICS',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    note: 'Sandbox evidence for canonical final CapsuleHub cells. Page boundaries are metadata-only and do not change publish price. This proves current v1 private fixed-size payloads and bounded public payloads retain the configured non-fee entry reserve after transaction fees; it is not a mainnet storage-rent oracle.',
    canonical_capsule_cells: {
      header0_bytes: HEADER0_BYTES,
      header1_bytes: HEADER1_BYTES,
      standard_body_bytes: STANDARD_BODY_BYTES,
      hybrid_body_bytes: HYBRID_BODY_BYTES,
      public_header_max_bytes: PUBLIC_HEADER_MAX_BYTES,
      public_body_max_bytes: PUBLIC_BODY_MAX_BYTES,
    },
    cases,
    worst_margin_nanotons: String(worst),
  };
  if (writeArtifacts) {
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync(path.join('artifacts', 'capsulehub_storage_economics_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join('artifacts', 'capsulehub_storage_economics_summary.md'), renderMarkdown(report));
  }
  return report;
}

function renderMarkdown(report: CapsuleHubStorageEconomicsReport): string {
  const lines: string[] = [];
  lines.push('# CapsuleHub Storage Economics Report');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push(report.note);
  lines.push('');
  lines.push('| Case | Inbound | Fee delta | Balance delta | Retained non-fee | Required storage | Margin |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const c of report.cases) {
    lines.push(`| ${c.label} | ${c.inbound_value_nanotons} | ${c.protocol_fee_delta_nanotons} | ${c.balance_delta_nanotons} | ${c.retained_non_fee_nanotons} | ${c.required_storage_reserve_nanotons} | ${c.retained_margin_nanotons} |`);
  }
  lines.push('');
  lines.push(`Worst retained margin: **${report.worst_margin_nanotons} nanotons**.`);
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) {
  runCapsuleHubStorageEconomics(true)
    .then((report) => {
      console.log(JSON.stringify({ status: report.status, cases: report.cases.length, worst_margin_nanotons: report.worst_margin_nanotons }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
