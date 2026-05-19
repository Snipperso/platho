import { Address, Cell, beginCell, contractAddress, storeStateInit } from '@ton/core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const DEFAULT_INPUT_PATH = join(ARTIFACTS_DIR, 'mainnet_ath_master_derivation_input.json');
const TEMPLATE_PATH = join(ARTIFACTS_DIR, 'mainnet_ath_master_derivation_input_template.json');

export interface MainnetAthMasterDerivationInput {
  document: 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION_INPUT';
  network: 'mainnet';
  status: 'DRAFT_MAINNET_ATH_MASTER_INPUT' | 'FINAL_MAINNET_ATH_MASTER_INPUT';
  treasuryOwnerAddress: string;
  contentBocBase64: string;
  proofRefs: {
    treasuryOwnerProof: string;
    contentCellProof: string;
    athMasterBuildArtifact: string;
  };
}

export interface MainnetAthMasterDerivationReport {
  document: 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION';
  status:
    | 'BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS'
    | 'BLOCKED_TESTNET_OR_NONPROD_ATH_MASTER_INPUT'
    | 'BLOCKED_INVALID_ATH_MASTER_INPUT'
    | 'DERIVED_MAINNET_ATH_MASTER_ADDRESS';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  ath_master_derivation_ready: boolean;
  production_deploy_executed: false;
  inputSource: string | null;
  blockers: string[];
  missingInputs: string[];
  rejectedNonProdInputs: string[];
  invalidInputs: string[];
  inputs: {
    treasuryOwnerAddress: string | null;
    contentBocBase64: string | null;
    contentHash: string | null;
  };
  derived: {
    athMasterAddress: string | null;
    athMasterRawAddress: string | null;
    athMasterStateInitHash: string | null;
    athMasterCodeHash: string | null;
    athMasterDataHash: string | null;
  };
  nextM20FInputs: {
    athMasterAddress: string | null;
    athMasterCodeHash: string | null;
    athDeploymentManifest: string | null;
  };
  proofRefs: MainnetAthMasterDerivationInput['proofRefs'] | null;
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

function isTestnetFriendlyAddress(value: string): boolean {
  return /^[0k]Q/.test(value.trim());
}

function parseAddress(value: string): Address | null {
  try {
    return Address.parse(value);
  } catch {
    return null;
  }
}

function parseContentCell(value: string): Cell | null {
  try {
    const cells = Cell.fromBoc(Buffer.from(value, 'base64'));
    return cells.length === 1 ? cells[0] : null;
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

function stateInitHash(init: { code: Cell; data: Cell }): string {
  return beginCell().store(storeStateInit(init)).endCell().hash().toString('hex');
}

function template(): MainnetAthMasterDerivationInput {
  return {
    document: 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION_INPUT',
    network: 'mainnet',
    status: 'DRAFT_MAINNET_ATH_MASTER_INPUT',
    treasuryOwnerAddress: 'REQUIRED_FINAL_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
    contentBocBase64: 'REQUIRED_FINAL_ATH_METADATA_CONTENT_CELL_BOC_BASE64',
    proofRefs: {
      treasuryOwnerProof: 'required: immutable treasury owner proof path/hash',
      contentCellProof: 'required: immutable ATH metadata/content cell proof path/hash',
      athMasterBuildArtifact: 'required: immutable ATHMaster build artifact path/hash',
    },
  };
}

function collectFindings(input: MainnetAthMasterDerivationInput | null) {
  const missingInputs: string[] = [];
  const rejectedNonProdInputs: string[] = [];
  const invalidInputs: string[] = [];

  if (!input) {
    return {
      missingInputs: [
        'MAINNET_ATH_MASTER_DERIVATION_INPUT',
        'FINAL_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
        'FINAL_ATH_METADATA_CONTENT_CELL_BOC_BASE64',
      ],
      rejectedNonProdInputs,
      invalidInputs,
    };
  }

  if (input.document !== 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION_INPUT') missingInputs.push('VALID_MAINNET_ATH_MASTER_DERIVATION_DOCUMENT');
  if (input.network !== 'mainnet') rejectedNonProdInputs.push('network');
  if (input.status !== 'FINAL_MAINNET_ATH_MASTER_INPUT') missingInputs.push('FINAL_MAINNET_ATH_MASTER_INPUT_STATUS');

  if (isPlaceholder(input.treasuryOwnerAddress)) {
    missingInputs.push('treasuryOwnerAddress');
  } else if (hasNonProdMarker(input.treasuryOwnerAddress) || isTestnetFriendlyAddress(input.treasuryOwnerAddress)) {
    rejectedNonProdInputs.push('treasuryOwnerAddress');
  } else {
    const parsed = parseAddress(input.treasuryOwnerAddress);
    if (!parsed) invalidInputs.push('treasuryOwnerAddress');
    if (parsed && parsed.workChain !== 0) rejectedNonProdInputs.push('treasuryOwnerAddress.workchain');
  }

  if (isPlaceholder(input.contentBocBase64)) {
    missingInputs.push('contentBocBase64');
  } else if (hasNonProdMarker(input.contentBocBase64)) {
    rejectedNonProdInputs.push('contentBocBase64');
  } else if (!parseContentCell(input.contentBocBase64)) {
    invalidInputs.push('contentBocBase64');
  }

  for (const [key, value] of Object.entries(input.proofRefs ?? {})) {
    if (isPlaceholder(value)) missingInputs.push(`proofRefs.${key}`);
    if (typeof value === 'string' && hasNonProdMarker(value)) rejectedNonProdInputs.push(`proofRefs.${key}`);
  }

  return { missingInputs, rejectedNonProdInputs, invalidInputs };
}

export function createMainnetAthMasterDerivationInputTemplate() {
  return template();
}

export async function createMainnetAthMasterDerivationReport(options: {
  input?: MainnetAthMasterDerivationInput | null;
  inputSource?: string | null;
} = {}): Promise<MainnetAthMasterDerivationReport> {
  const input = options.input ?? null;
  const findings = collectFindings(input);
  const blockers: string[] = [];
  if (findings.missingInputs.length > 0) blockers.push('MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS');
  if (findings.rejectedNonProdInputs.length > 0) blockers.push('TESTNET_OR_NONPROD_ATH_MASTER_INPUT');
  if (findings.invalidInputs.length > 0) blockers.push('INVALID_ATH_MASTER_INPUT');

  const base: MainnetAthMasterDerivationReport = {
    document: 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION',
    status: blockers.includes('INVALID_ATH_MASTER_INPUT')
      ? 'BLOCKED_INVALID_ATH_MASTER_INPUT'
      : blockers.includes('TESTNET_OR_NONPROD_ATH_MASTER_INPUT')
        ? 'BLOCKED_TESTNET_OR_NONPROD_ATH_MASTER_INPUT'
        : blockers.length > 0
          ? 'BLOCKED_MISSING_FINAL_MAINNET_ATH_MASTER_INPUTS'
          : 'DERIVED_MAINNET_ATH_MASTER_ADDRESS',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    ath_master_derivation_ready: false,
    production_deploy_executed: false,
    inputSource: options.inputSource ?? null,
    blockers,
    missingInputs: findings.missingInputs,
    rejectedNonProdInputs: findings.rejectedNonProdInputs,
    invalidInputs: findings.invalidInputs,
    inputs: {
      treasuryOwnerAddress: input?.treasuryOwnerAddress ?? null,
      contentBocBase64: input?.contentBocBase64 ?? null,
      contentHash: null,
    },
    derived: {
      athMasterAddress: null,
      athMasterRawAddress: null,
      athMasterStateInitHash: null,
      athMasterCodeHash: null,
      athMasterDataHash: null,
    },
    nextM20FInputs: {
      athMasterAddress: null,
      athMasterCodeHash: null,
      athDeploymentManifest: null,
    },
    proofRefs: input?.proofRefs ?? null,
  };

  if (!input || blockers.length > 0) return base;

  const treasuryOwner = Address.parse(input.treasuryOwnerAddress);
  const content = parseContentCell(input.contentBocBase64);
  if (!content) {
    return {
      ...base,
      status: 'BLOCKED_INVALID_ATH_MASTER_INPUT',
      blockers: [...base.blockers, 'INVALID_ATH_MASTER_INPUT'],
      invalidInputs: [...base.invalidInputs, 'contentBocBase64'],
    };
  }

  const athMasterInit = await ATHMaster.init(treasuryOwner, content);
  const athMasterAddress = contractAddress(0, athMasterInit);
  const athMasterCodeHash = athMasterInit.code.hash().toString('hex');

  return {
    ...base,
    ath_master_derivation_ready: true,
    inputs: {
      treasuryOwnerAddress: friendly(treasuryOwner),
      contentBocBase64: input.contentBocBase64,
      contentHash: content.hash().toString('hex'),
    },
    derived: {
      athMasterAddress: friendly(athMasterAddress),
      athMasterRawAddress: raw(athMasterAddress),
      athMasterStateInitHash: stateInitHash(athMasterInit),
      athMasterCodeHash,
      athMasterDataHash: athMasterInit.data.hash().toString('hex'),
    },
    nextM20FInputs: {
      athMasterAddress: friendly(athMasterAddress),
      athMasterCodeHash,
      athDeploymentManifest: input.proofRefs.athMasterBuildArtifact,
    },
  };
}

function markdown(report: MainnetAthMasterDerivationReport) {
  return [
    '# Mainnet ATH Master Derivation',
    '',
    `Status: ${report.status}`,
    '',
    `- ath_master_derivation_ready: ${report.ath_master_derivation_ready}`,
    `- production_deploy_executed: ${report.production_deploy_executed}`,
    '',
    '## Inputs',
    '',
    `- treasuryOwnerAddress: ${report.inputs.treasuryOwnerAddress ?? 'not supplied'}`,
    `- contentHash: ${report.inputs.contentHash ?? 'not derived'}`,
    '',
    '## Derived ATH Master',
    '',
    `- athMasterAddress: ${report.derived.athMasterAddress ?? 'not derived'}`,
    `- athMasterStateInitHash: ${report.derived.athMasterStateInitHash ?? 'not derived'}`,
    `- athMasterCodeHash: ${report.derived.athMasterCodeHash ?? 'not derived'}`,
    `- athMasterDataHash: ${report.derived.athMasterDataHash ?? 'not derived'}`,
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`) : ['- none']),
    '',
    '## M20F Inputs',
    '',
    `- athMasterAddress: ${report.nextM20FInputs.athMasterAddress ?? 'not ready'}`,
    `- athMasterCodeHash: ${report.nextM20FInputs.athMasterCodeHash ?? 'not ready'}`,
    `- athDeploymentManifest: ${report.nextM20FInputs.athDeploymentManifest ?? 'not ready'}`,
    '',
  ].join('\n');
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function writeMainnetAthMasterDerivationArtifacts(inputPath = DEFAULT_INPUT_PATH) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(TEMPLATE_PATH, `${JSON.stringify(template(), null, 2)}\n`);
  const input = existsSync(inputPath) ? readJson(inputPath) as MainnetAthMasterDerivationInput : null;
  const report = await createMainnetAthMasterDerivationReport({
    input,
    inputSource: existsSync(inputPath) ? inputPath.replace(/\\/g, '/') : null,
  });
  writeFileSync(join(ARTIFACTS_DIR, 'mainnet_ath_master_derivation.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'MAINNET_ATH_MASTER_DERIVATION.md'), markdown(report));
  return report;
}

if (require.main === module) {
  writeMainnetAthMasterDerivationArtifacts().then((report) => {
    console.log(JSON.stringify({
      status: report.status,
      ath_master_derivation_ready: report.ath_master_derivation_ready,
      production_deploy_executed: report.production_deploy_executed,
      blockers: report.blockers,
      nextM20FInputs: report.nextM20FInputs,
      output: 'artifacts/mainnet_ath_master_derivation.json',
    }, null, 2));
    if (report.blockers.length > 0) process.exit(1);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
