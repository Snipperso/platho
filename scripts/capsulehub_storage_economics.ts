import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  CapsuleHub,
  PublishBatchToHub,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  marketingCell,
  partsList,
} from '../tests/helpers/vpb2';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;

const PRIVATE_HYBRID_FEE = 10_000_000n;
const PUBLIC_FEE = 10_000_000n;
// VPB2 batch ingest charges a flat per-batch compute reserve (getComputeFee(HUB_BATCH_BASE_GAS) +
// getComputeFee(HUB_PART_GAS_*) for the single part). Unlike the old single-publish ABI, the Hub's
// required value is INDEPENDENT of the body size class (it validates payload cells by declared hash and
// stores only compact index entries), so this reserve is flat across 1K..32K. Empirical floor for the
// 1-part batch is ~5.94M nanotons; 7M leaves headroom that the Hub returns to the Vault via mode-128.
const BATCH_EXEC_RESERVE = 14_000_000n; // raised to cover HUB_PART_GAS_* up to 180k (getComputeFee ~12.0M) + base, after auto-eviction
const SIZE_CLASSES = [1n, 2n, 4n, 8n, 16n, 32n] as const;
const KEEPALIVE = 1_000_000n;
const PRIVATE_ENTRY_STORAGE = 3_300_000n;
const PUBLIC_ENTRY_STORAGE = 9_400_000n; // mirrors CapsuleHub CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT (author/parent index)
const PAGE_STORAGE = 0n;
const ACK_RESERVE = 30_000_000n;
// The Hub keeps storage with the 1.25 protectedReserve buffer (batchStorageReserveWithBuffer); the inbound
// value must therefore carry the BUFFERED storage so the post-loop value gate (13530) passes. The reported
// required_storage_reserve stays un-buffered so retained_margin measures the real backed surplus.
const STORAGE_RESERVE_BUFFER_NUMERATOR = 125n;
const STORAGE_RESERVE_BUFFER_DENOMINATOR = 100n;
function bufferedStorage(unbuffered: bigint): bigint {
  return unbuffered * STORAGE_RESERVE_BUFFER_NUMERATOR / STORAGE_RESERVE_BUFFER_DENOMINATOR;
}

// clean-16 ИНК2: the CONV private header0 is 40 bytes (320 bits), was 140 pre-clean-16.
const HEADER0_BYTES = 40;
const HEADER1_BYTES = 30;
const HYBRID_BODY_BYTES = 2228;
const PUBLIC_HEADER_BYTES = 68;
const PUBLIC_HEADER_MAX_BYTES = 72;
const MINIMUM_RETAINED_MARGIN_NANOTONS = 1_000_000n;

type SizeClass = typeof SIZE_CLASSES[number];

export type CapsuleHubStorageCase = {
  label: string;
  inbound_value_nanotons: string;
  protocol_fee_delta_nanotons: string;
  balance_delta_nanotons: string;
  retained_non_fee_nanotons: string;
  protected_retained_nanotons: string;
  required_storage_reserve_nanotons: string;
  retained_margin_nanotons: string;
  tx_count: number;
  aborted_count: number;
};

export type CapsuleHubStorageEconomicsReport = {
  profile: 'PLATHO.V1.CAPSULEHUB_STORAGE_ECONOMICS';
  status: 'PASS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  code_hashes: {
    capsulehub: string;
  };
  note: string;
  minimum_retained_margin_nanotons: string;
  canonical_capsule_cells: {
    header0_bytes: number;
    header1_bytes: number;
    hybrid_body_bytes: number;
    hybrid_body_bytes_by_size_class: Record<string, number>;
    public_header_max_bytes: number;
    public_body_max_bytes: number;
    public_body_bytes_by_size_class: Record<string, number>;
  };
  cases: CapsuleHubStorageCase[];
  worst_margin_nanotons: string;
};

function codeHash(relPath: string): string {
  return Cell.fromBoc(fs.readFileSync(relPath))[0].hash().toString('hex');
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

  // The bound vault is the only allowed sender and the recipient of the VPB2 CapsuleHubBatchAck. A sandbox
  // treasury swallows the ACK cleanly (the batch ack mock for the single-publish ABI was removed), which is
  // all this economics harness needs — it measures the Hub's reserved balance, not the Vault credit-back.
  const mockVault = await blockchain.treasury('caphub-econ-bound-vault');
  const mockVaultAddress = mockVault.address;

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

function privateBodyBytes(sizeClass: bigint, cryptoSuite: bigint): number {
  if (cryptoSuite !== 2n) {
    throw new Error(`unsupported private crypto suite ${cryptoSuite}`);
  }
  return 1204 + (Number(sizeClass) * 1024);
}

function execReserve(_sizeClass: SizeClass): bigint {
  // Flat across size classes under the VPB2 batch ABI (see BATCH_EXEC_RESERVE note).
  return BATCH_EXEC_RESERVE;
}

function publicBodyBytes(sizeClass: SizeClass): number {
  return Number(sizeClass) * 1024;
}

// A 1-part private VPB2 batch (the Vault->Hub wire format). The Hub validates the part shape against its
// declared hashes and stores only the compact index entry, so partsList builds the canonical 1K..32K hybrid
// part. protocol_fee_total carries the per-part fee that the Hub accrues (drives the economics fee delta).
function privateVault(sizeClass: SizeClass, _cryptoSuite: 2n, fill: number, author: Address): PublishBatchToHub {
  return {
    $$type: 'PublishBatchToHub',
    bounce_id: BigInt(10_000 + fill),
    bounce_tag: BigInt(30_000 + fill),
    publish_id: hash256(`vault-private-${fill}`),
    publish_kind: KIND_PRIVATE,
    part_count: 1n,
    protocol_fee_total: PRIVATE_HYBRID_FEE,
    author_wallet: author,
    parts: partsList(KIND_PRIVATE, 1, sizeClass),
    marketing: null,
  };
}

function publicVault(sizeClass: SizeClass, fill: number, author: Address): PublishBatchToHub {
  return {
    $$type: 'PublishBatchToHub',
    bounce_id: BigInt(20_000 + fill),
    bounce_tag: BigInt(40_000 + fill),
    publish_id: hash256(`vault-public-${fill}`),
    publish_kind: KIND_PUBLIC,
    part_count: 1n,
    protocol_fee_total: PUBLIC_FEE,
    author_wallet: author,
    parts: partsList(KIND_PUBLIC, 1, sizeClass),
    marketing: marketingCell(),
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
  const aborted = abortedCount(result);
  const afterState = await ctx.capsule.getGetState();
  const afterBalance = await balanceOf(ctx.blockchain, ctx.capsule.address);
  const balanceDelta = afterBalance - beforeBalance;
  const feeDelta = afterState.accrued_plato_fee_ton - beforeState.accrued_plato_fee_ton;
  const retainedNonFee = balanceDelta - feeDelta;
  const protectedRetained = balanceDelta;
  const margin = protectedRetained - storageReserve;
  return {
    label,
    inbound_value_nanotons: String(inbound),
    protocol_fee_delta_nanotons: String(feeDelta),
    balance_delta_nanotons: String(balanceDelta),
    retained_non_fee_nanotons: String(retainedNonFee),
    protected_retained_nanotons: String(protectedRetained),
    required_storage_reserve_nanotons: String(storageReserve),
    retained_margin_nanotons: String(margin),
    tx_count: result.transactions?.length ?? 0,
    aborted_count: aborted,
  };
}

export async function runCapsuleHubStorageEconomics(writeArtifacts = true): Promise<CapsuleHubStorageEconomicsReport> {
  const privateCases = await Promise.all(SIZE_CLASSES.map((sizeClass, index) => {
    const inbound = PRIVATE_HYBRID_FEE + execReserve(sizeClass) + bufferedStorage(KEEPALIVE + PRIVATE_ENTRY_STORAGE + PAGE_STORAGE) + ACK_RESERVE;
    return measure(
      `VAULT_PRIVATE_HYBRID_${sizeClass}K`,
      inbound,
      KEEPALIVE + PRIVATE_ENTRY_STORAGE + PAGE_STORAGE,
      (ctx) => ctx.capsule.send(ctx.blockchain.sender(ctx.mockVaultAddress), {
        value: inbound,
      }, privateVault(sizeClass, 2n, 0x70 + index, ctx.author.address)),
    );
  }));
  const publicCases = await Promise.all(SIZE_CLASSES.map((sizeClass, index) => {
    const inbound = PUBLIC_FEE + execReserve(sizeClass) + bufferedStorage(KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE) + ACK_RESERVE;
    return measure(
      `VAULT_PUBLIC_${sizeClass}K`,
      inbound,
      KEEPALIVE + PUBLIC_ENTRY_STORAGE + PAGE_STORAGE,
      (ctx) => ctx.capsule.send(ctx.blockchain.sender(ctx.mockVaultAddress), {
        value: inbound,
      }, publicVault(sizeClass, 0x80 + index, ctx.author.address)),
    );
  }));
  const cases = [
    ...privateCases,
    ...publicCases,
  ];
  const aborted = cases.filter((c) => c.aborted_count > 0);
  if (aborted.length > 0) {
    const labels = aborted.map((c) => `${c.label}:${c.aborted_count}`).join(', ');
    throw new Error(`CapsuleHub storage economics publish aborted: ${labels}`);
  }
  const worst = cases.map((c) => BigInt(c.retained_margin_nanotons)).reduce((a, b) => a < b ? a : b);
  if (worst < MINIMUM_RETAINED_MARGIN_NANOTONS) {
    const failing = cases
      .filter((c) => BigInt(c.retained_margin_nanotons) < MINIMUM_RETAINED_MARGIN_NANOTONS)
      .map((c) => `${c.label}=${c.retained_margin_nanotons}`)
      .join(', ');
    throw new Error(`CapsuleHub retained margin ${worst} is below gate ${MINIMUM_RETAINED_MARGIN_NANOTONS}: ${failing}`);
  }
  const report: CapsuleHubStorageEconomicsReport = {
    profile: 'PLATHO.V1.CAPSULEHUB_STORAGE_ECONOMICS',
    status: 'PASS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    code_hashes: {
      capsulehub: codeHash(path.join('build', 'CapsuleHub', 'CapsuleHub_CapsuleHub.code.boc')),
    },
    note: 'Sandbox evidence for canonical final CapsuleHub index cells. Body payload cells are validated in the publish transaction and authenticated by stored hashes, but only compact headers/indexes remain in CapsuleHub state. Pages are virtual ranges derived from entry ids. Retained margin includes accrued protocol fee because FlushFees is gated by protectedReserve(), so accrued fee cannot be drained while index storage reserve is not backed. This is not a mainnet storage-rent oracle.',
    minimum_retained_margin_nanotons: String(MINIMUM_RETAINED_MARGIN_NANOTONS),
    canonical_capsule_cells: {
      header0_bytes: HEADER0_BYTES,
      header1_bytes: HEADER1_BYTES,
      hybrid_body_bytes: HYBRID_BODY_BYTES,
      hybrid_body_bytes_by_size_class: Object.fromEntries(SIZE_CLASSES.map((sizeClass) => [
        `${sizeClass}K`,
        privateBodyBytes(sizeClass, 2n),
      ])),
      public_header_max_bytes: PUBLIC_HEADER_MAX_BYTES,
      public_body_max_bytes: publicBodyBytes(32n),
      public_body_bytes_by_size_class: Object.fromEntries(SIZE_CLASSES.map((sizeClass) => [
        `${sizeClass}K`,
        publicBodyBytes(sizeClass),
      ])),
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
  lines.push(`CapsuleHub code hash: \`${report.code_hashes.capsulehub}\``);
  lines.push(`Minimum retained margin gate: **${report.minimum_retained_margin_nanotons} nanotons**.`);
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
