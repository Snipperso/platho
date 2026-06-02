import { Address, beginCell, Cell, contractAddress, storeStateInit } from '@ton/core';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BuybackBurn } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';
import { ATHWallet } from '../build/BuybackBurn/BuybackBurn_ATHWallet';
import { isTestnetFriendlyAddress } from './m20f_mainnet_route_freeze_preflight';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const DEFAULT_INPUT_PATH = join(ARTIFACTS_DIR, 'm20f_mainnet_address_derivation_input.json');
const TEMPLATE_PATH = join(ARTIFACTS_DIR, 'm20f_mainnet_address_derivation_input_template.json');

export interface M20FMainnetAddressDerivationInput {
  document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_DERIVATION_INPUT';
  network: 'mainnet';
  status: 'DRAFT_MAINNET_ADDRESS_INPUT' | 'FINAL_MAINNET_ADDRESS_INPUT';
  genesisControllerAddress: string;
  athMasterAddress: string;
  proofRefs: {
    finalGenesisControllerProof: string;
    athDeploymentManifest: string;
    buybackBurnBuildArtifact: string;
  };
}

export interface M20FMainnetAddressDerivationReport {
  document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_DERIVATION';
  status:
    | 'BLOCKED_MISSING_FINAL_MAINNET_ADDRESS_INPUTS'
    | 'BLOCKED_TESTNET_OR_NONPROD_ADDRESS_INPUT'
    | 'BLOCKED_INVALID_ADDRESS_INPUT'
    | 'DERIVED_MAINNET_BUYBACKBURN_ADDRESSES';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  address_derivation_ready: boolean;
  production_buyback_burn_unlocked: false;
  inputSource: string | null;
  blockers: string[];
  missingInputs: string[];
  rejectedNonProdInputs: string[];
  invalidInputs: string[];
  inputs: {
    genesisControllerAddress: string | null;
    athMasterAddress: string | null;
    genesisControllerHashHex: string | null;
    genesisControllerHashUint256: string | null;
  };
  derived: {
    buybackBurnAddress: string | null;
    buybackBurnRawAddress: string | null;
    buybackBurnStateInitHash: string | null;
    buybackBurnCodeHash: string | null;
    buybackBurnDataHash: string | null;
    buybackBurnOfficialAthWalletAddress: string | null;
    buybackBurnOfficialAthWalletRawAddress: string | null;
    buybackBurnOfficialAthWalletStateInitHash: string | null;
    buybackBurnOfficialAthWalletCodeHash: string | null;
    buybackBurnOfficialAthWalletDataHash: string | null;
  };
  nextM20FInputs: {
    athMasterAddress: string | null;
    buybackBurnAddress: string | null;
    buybackBurnOfficialAthWalletAddress: string | null;
  };
  proofRefs: M20FMainnetAddressDerivationInput['proofRefs'] | null;
}

function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  return v.length === 0
    || v.includes('REQUIRED_')
    || v.includes('required:')
    || v.includes('FILL_')
    || v.includes('PLACEHOLDER')
    || v.includes('<');
}

function hasNonProdMarker(value: string): boolean {
  return /\b(testnet|fixture|preview|mock|template|placeholder)\b/i.test(value);
}

function currentBuybackBurnCodeHash(): string {
  return Cell.fromBoc(readFileSync(join(process.cwd(), 'build', 'BuybackBurn', 'BuybackBurn_BuybackBurn.code.boc')))[0]
    .hash()
    .toString('hex');
}

function explicitBuybackBurnHash(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const manifestMatch = value.match(/code_hashes\.buyback_burn=([0-9a-f]{64})/i);
  if (manifestMatch) return manifestMatch[1].toLowerCase();
  return null;
}

function parseAddress(value: string): Address | null {
  try {
    return Address.parse(value);
  } catch {
    return null;
  }
}

function friendly(address: Address): string {
  return address.toString({ bounceable: true, testOnly: false });
}

function raw(address: Address): string {
  return `${address.workChain}:${address.hash.toString('hex')}`;
}

function addressHash(address: Address): bigint {
  return BigInt(`0x${beginCell().storeAddress(address).endCell().hash().toString('hex')}`);
}

function stateInitHash(init: { code: any; data: any }): string {
  return beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
}

function template(): M20FMainnetAddressDerivationInput {
  return {
    document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_DERIVATION_INPUT',
    network: 'mainnet',
    status: 'DRAFT_MAINNET_ADDRESS_INPUT',
    genesisControllerAddress: 'REQUIRED_FINAL_MAINNET_GENESIS_CONTROLLER_ADDRESS',
    athMasterAddress: 'REQUIRED_FINAL_MAINNET_ATH_MASTER_ADDRESS',
    proofRefs: {
      finalGenesisControllerProof: 'required: immutable final genesis controller proof path/hash',
      athDeploymentManifest: 'required: immutable ATH deployment manifest path/hash',
      buybackBurnBuildArtifact: 'required: immutable BuybackBurn build artifact path/hash',
    },
  };
}

function collectFindings(input: M20FMainnetAddressDerivationInput | null) {
  const missingInputs: string[] = [];
  const rejectedNonProdInputs: string[] = [];
  const invalidInputs: string[] = [];

  if (!input) {
    return {
      missingInputs: [
        'M20F_MAINNET_ADDRESS_DERIVATION_INPUT',
        'FINAL_MAINNET_GENESIS_CONTROLLER_ADDRESS',
        'FINAL_MAINNET_ATH_MASTER_ADDRESS',
      ],
      rejectedNonProdInputs,
      invalidInputs,
    };
  }

  if (input.document !== 'PLATHO.V1.M20F_MAINNET_ADDRESS_DERIVATION_INPUT') missingInputs.push('VALID_M20F_ADDRESS_DERIVATION_DOCUMENT');
  if (input.network !== 'mainnet') rejectedNonProdInputs.push('network');
  if (input.status !== 'FINAL_MAINNET_ADDRESS_INPUT') missingInputs.push('FINAL_MAINNET_ADDRESS_INPUT_STATUS');

  for (const [key, value] of Object.entries({
    genesisControllerAddress: input.genesisControllerAddress,
    athMasterAddress: input.athMasterAddress,
  })) {
    if (isPlaceholder(value)) {
      missingInputs.push(key);
      continue;
    }
    if (hasNonProdMarker(value) || isTestnetFriendlyAddress(value)) {
      rejectedNonProdInputs.push(key);
      continue;
    }
    const parsed = parseAddress(value);
    if (!parsed) invalidInputs.push(key);
    if (parsed && parsed.workChain !== 0) rejectedNonProdInputs.push(`${key}.workchain`);
  }

  for (const [key, value] of Object.entries(input.proofRefs ?? {})) {
    if (isPlaceholder(value)) missingInputs.push(`proofRefs.${key}`);
    if (typeof value === 'string' && hasNonProdMarker(value)) rejectedNonProdInputs.push(`proofRefs.${key}`);
  }

  const explicitBuildHash = explicitBuybackBurnHash(input.proofRefs?.buybackBurnBuildArtifact);
  if (explicitBuildHash && explicitBuildHash !== currentBuybackBurnCodeHash()) {
    invalidInputs.push('proofRefs.buybackBurnBuildArtifact.code_hash');
  }

  return { missingInputs, rejectedNonProdInputs, invalidInputs };
}

export function createM20FMainnetAddressDerivationInputTemplate() {
  return template();
}

export async function createM20FMainnetAddressDerivationReport(options: {
  input?: M20FMainnetAddressDerivationInput | null;
  inputSource?: string | null;
} = {}): Promise<M20FMainnetAddressDerivationReport> {
  const input = options.input ?? null;
  const findings = collectFindings(input);
  const blockers: string[] = [];
  if (findings.missingInputs.length > 0) blockers.push('MISSING_FINAL_MAINNET_ADDRESS_INPUTS');
  if (findings.rejectedNonProdInputs.length > 0) blockers.push('TESTNET_OR_NONPROD_ADDRESS_INPUT');
  if (findings.invalidInputs.length > 0) blockers.push('INVALID_ADDRESS_INPUT');

  const base: M20FMainnetAddressDerivationReport = {
    document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_DERIVATION',
    status: blockers.includes('INVALID_ADDRESS_INPUT')
      ? 'BLOCKED_INVALID_ADDRESS_INPUT'
      : blockers.includes('TESTNET_OR_NONPROD_ADDRESS_INPUT')
        ? 'BLOCKED_TESTNET_OR_NONPROD_ADDRESS_INPUT'
        : blockers.length > 0
          ? 'BLOCKED_MISSING_FINAL_MAINNET_ADDRESS_INPUTS'
          : 'DERIVED_MAINNET_BUYBACKBURN_ADDRESSES',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    address_derivation_ready: false,
    production_buyback_burn_unlocked: false,
    inputSource: options.inputSource ?? null,
    blockers,
    missingInputs: findings.missingInputs,
    rejectedNonProdInputs: findings.rejectedNonProdInputs,
    invalidInputs: findings.invalidInputs,
    inputs: {
      genesisControllerAddress: input?.genesisControllerAddress ?? null,
      athMasterAddress: input?.athMasterAddress ?? null,
      genesisControllerHashHex: null,
      genesisControllerHashUint256: null,
    },
    derived: {
      buybackBurnAddress: null,
      buybackBurnRawAddress: null,
      buybackBurnStateInitHash: null,
      buybackBurnCodeHash: null,
      buybackBurnDataHash: null,
      buybackBurnOfficialAthWalletAddress: null,
      buybackBurnOfficialAthWalletRawAddress: null,
      buybackBurnOfficialAthWalletStateInitHash: null,
      buybackBurnOfficialAthWalletCodeHash: null,
      buybackBurnOfficialAthWalletDataHash: null,
    },
    nextM20FInputs: {
      athMasterAddress: null,
      buybackBurnAddress: null,
      buybackBurnOfficialAthWalletAddress: null,
    },
    proofRefs: input?.proofRefs ?? null,
  };

  if (!input || blockers.length > 0) return base;

  const genesisControllerAddress = Address.parse(input.genesisControllerAddress);
  const athMasterAddress = Address.parse(input.athMasterAddress);
  const genesisHash = addressHash(genesisControllerAddress);
  const genesisHashHex = genesisHash.toString(16).padStart(64, '0');
  const buybackBurnInit = await BuybackBurn.init(genesisHash, athMasterAddress);
  const buybackBurnAddress = contractAddress(0, buybackBurnInit);
  const officialAthWalletInit = await ATHWallet.init(0n, buybackBurnAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(buybackBurnAddress.workChain, officialAthWalletInit);

  return {
    ...base,
    address_derivation_ready: true,
    inputs: {
      genesisControllerAddress: friendly(genesisControllerAddress),
      athMasterAddress: friendly(athMasterAddress),
      genesisControllerHashHex: genesisHashHex,
      genesisControllerHashUint256: genesisHash.toString(),
    },
    derived: {
      buybackBurnAddress: friendly(buybackBurnAddress),
      buybackBurnRawAddress: raw(buybackBurnAddress),
      buybackBurnStateInitHash: stateInitHash(buybackBurnInit),
      buybackBurnCodeHash: buybackBurnInit.code.hash().toString('hex'),
      buybackBurnDataHash: buybackBurnInit.data.hash().toString('hex'),
      buybackBurnOfficialAthWalletAddress: friendly(officialAthWalletAddress),
      buybackBurnOfficialAthWalletRawAddress: raw(officialAthWalletAddress),
      buybackBurnOfficialAthWalletStateInitHash: stateInitHash(officialAthWalletInit),
      buybackBurnOfficialAthWalletCodeHash: officialAthWalletInit.code.hash().toString('hex'),
      buybackBurnOfficialAthWalletDataHash: officialAthWalletInit.data.hash().toString('hex'),
    },
    nextM20FInputs: {
      athMasterAddress: friendly(athMasterAddress),
      buybackBurnAddress: friendly(buybackBurnAddress),
      buybackBurnOfficialAthWalletAddress: friendly(officialAthWalletAddress),
    },
  };
}

function markdown(report: M20FMainnetAddressDerivationReport) {
  return [
    '# M20F Mainnet Address Derivation',
    '',
    `Status: ${report.status}`,
    '',
    `- address_derivation_ready: ${report.address_derivation_ready}`,
    `- production_buyback_burn_unlocked: ${report.production_buyback_burn_unlocked}`,
    '',
    '## Inputs',
    '',
    `- genesisControllerAddress: ${report.inputs.genesisControllerAddress ?? 'not supplied'}`,
    `- athMasterAddress: ${report.inputs.athMasterAddress ?? 'not supplied'}`,
    `- genesisControllerHashHex: ${report.inputs.genesisControllerHashHex ?? 'not derived'}`,
    '',
    '## Derived Addresses',
    '',
    `- buybackBurnAddress: ${report.derived.buybackBurnAddress ?? 'not derived'}`,
    `- buybackBurnOfficialAthWalletAddress: ${report.derived.buybackBurnOfficialAthWalletAddress ?? 'not derived'}`,
    '',
    '## StateInit Hashes',
    '',
    `- buybackBurnStateInitHash: ${report.derived.buybackBurnStateInitHash ?? 'not derived'}`,
    `- buybackBurnOfficialAthWalletStateInitHash: ${report.derived.buybackBurnOfficialAthWalletStateInitHash ?? 'not derived'}`,
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`) : ['- none']),
    '',
    '## M20F Collector Inputs',
    '',
    `- athMasterAddress: ${report.nextM20FInputs.athMasterAddress ?? 'not ready'}`,
    `- buybackBurnAddress: ${report.nextM20FInputs.buybackBurnAddress ?? 'not ready'}`,
    `- buybackBurnOfficialAthWalletAddress: ${report.nextM20FInputs.buybackBurnOfficialAthWalletAddress ?? 'not ready'}`,
    '',
  ].join('\n');
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function writeM20FMainnetAddressDerivationArtifacts(inputPath = DEFAULT_INPUT_PATH) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(TEMPLATE_PATH, `${JSON.stringify(template(), null, 2)}\n`);
  const input = existsSync(inputPath) ? readJson(inputPath) as M20FMainnetAddressDerivationInput : null;
  const report = await createM20FMainnetAddressDerivationReport({
    input,
    inputSource: existsSync(inputPath) ? inputPath.replace(/\\/g, '/') : null,
  });
  writeFileSync(join(ARTIFACTS_DIR, 'm20f_mainnet_address_derivation.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20F_MAINNET_ADDRESS_DERIVATION.md'), markdown(report));
  return report;
}

if (require.main === module) {
  writeM20FMainnetAddressDerivationArtifacts().then((report) => {
    console.log(JSON.stringify({
      status: report.status,
      address_derivation_ready: report.address_derivation_ready,
      production_buyback_burn_unlocked: report.production_buyback_burn_unlocked,
      blockers: report.blockers,
      nextM20FInputs: report.nextM20FInputs,
      output: 'artifacts/m20f_mainnet_address_derivation.json',
    }, null, 2));
    if (report.blockers.length > 0) process.exit(1);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
