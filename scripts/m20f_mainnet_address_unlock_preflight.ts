import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const DEFAULT_PROJECT_ROOT = process.cwd();
const DEFAULT_ARTIFACTS_DIR = join(DEFAULT_PROJECT_ROOT, 'artifacts');

export interface M20FMainnetAddressUnlockPreflight {
  document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_UNLOCK_PREFLIGHT';
  status:
    | 'BLOCKED_PRODUCTION_BUYBACKBURN_CONTRACT_MISSING'
    | 'BLOCKED_TACT_CONFIG_MISSING_BUYBACKBURN'
    | 'BLOCKED_TESTNET_HARNESS_SELECTED_AS_PRODUCTION'
    | 'BLOCKED_BUYBACKBURN_BUILD_ARTIFACT_MISSING'
    | 'READY_FOR_MAINNET_ADDRESS_DERIVATION';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  address_unlock_ready: boolean;
  production_buyback_burn_unlocked: boolean;
  production_buyback_burn_contract: {
    expectedSourcePath: string;
    sourceExists: boolean;
    harnessSourcePath: string;
    harnessSourceExists: boolean;
    configPath: string;
    configExists: boolean;
    configProjectFound: boolean;
    configProjectName: string | null;
    configProjectPath: string | null;
    configProjectOutput: string | null;
    configSelectsHarness: boolean;
    buildCodeBocPath: string | null;
    buildCodeBocExists: boolean;
  };
  m20t: {
    evidenceSource: string;
    status: string | null;
    complete: boolean;
    notProductionUnlock: boolean;
  };
  blockers: string[];
  requiredNextActions: string[];
  addressDerivationNotes: string[];
}

function safeReadJson(path: string): any | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function toProjectRelative(projectRoot: string, path: string | null) {
  if (!path) return null;
  return relative(projectRoot, path).replace(/\\/g, '/');
}

function readM20TStatus(artifactsDir: string) {
  const evidencePath = join(artifactsDir, 'm20t_testnet_evidence.json');
  const evidence = safeReadJson(evidencePath);
  if (!evidence) {
    return {
      evidenceSource: 'artifacts/m20t_testnet_evidence.json',
      status: null,
      complete: false,
      notProductionUnlock: true,
    };
  }

  return {
    evidenceSource: 'artifacts/m20t_testnet_evidence.json',
    status: typeof evidence.status === 'string' ? evidence.status : null,
    complete: evidence.status === 'LIVE_TESTNET_M20T_HARNESS_PASS'
      && evidence.network === 'testnet'
      && evidence.productionFlagsRemainFalse === true,
    notProductionUnlock: evidence.notProductionBuybackBurnUnlock === true
      && evidence.notMainnetRouteFreeze === true,
  };
}

function findBuybackBurnProject(config: any) {
  const projects = Array.isArray(config?.projects) ? config.projects : [];
  const exact = projects.find((project: any) => project?.name === 'BuybackBurn');
  if (exact) return exact;

  return projects.find((project: any) => (
    typeof project?.name === 'string'
    && project.name.toLowerCase().includes('buybackburn')
    && !project.name.toLowerCase().includes('harness')
  )) ?? null;
}

function configProjectSelectsHarness(project: any) {
  const name = String(project?.name ?? '').toLowerCase();
  const path = String(project?.path ?? '').toLowerCase();
  const output = String(project?.output ?? '').toLowerCase();
  return name.includes('harness') || path.includes('harness') || output.includes('harness');
}

function findBuildCodeBoc(projectRoot: string, project: any) {
  if (!project?.output || typeof project.output !== 'string') return null;
  const outputDir = join(projectRoot, project.output);
  if (!existsSync(outputDir)) return null;

  const preferred = join(outputDir, `${project.name}_${project.name}.code.boc`);
  if (existsSync(preferred)) return preferred;

  const fallback = readdirSync(outputDir)
    .filter((file) => file.endsWith('.code.boc'))
    .sort()[0];
  return fallback ? join(outputDir, fallback) : null;
}

export function createM20FMainnetAddressUnlockPreflight(options: {
  projectRoot?: string;
  artifactsDir?: string;
} = {}): M20FMainnetAddressUnlockPreflight {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;
  const artifactsDir = options.artifactsDir ?? join(projectRoot, 'artifacts');
  const sourcePath = join(projectRoot, 'contracts', 'BuybackBurn.tact');
  const harnessPath = join(projectRoot, 'contracts', 'M20TBuybackBurnHarness.tact');
  const configPath = join(projectRoot, 'tact.config.json');
  const config = safeReadJson(configPath);
  const configProject = findBuybackBurnProject(config);
  const configSelectsHarness = configProjectSelectsHarness(configProject);
  const buildCodeBocPath = findBuildCodeBoc(projectRoot, configProject);
  const m20t = readM20TStatus(artifactsDir);

  const sourceExists = existsSync(sourcePath);
  const configExists = existsSync(configPath);
  const configProjectFound = !!configProject;
  const buildCodeBocExists = !!buildCodeBocPath && existsSync(buildCodeBocPath);
  const blockers: string[] = [];

  if (!m20t.complete) blockers.push('M20T_TESTNET_DEPLOYMENT_PROBE_NOT_COMPLETE');
  if (!m20t.notProductionUnlock) blockers.push('M20T_EVIDENCE_MUST_REMAIN_NON_PRODUCTION_UNLOCK');
  if (!sourceExists) blockers.push('PRODUCTION_BUYBACKBURN_CONTRACT_MISSING');
  if (!configExists || !configProjectFound) blockers.push('TACT_CONFIG_MISSING_PRODUCTION_BUYBACKBURN_PROJECT');
  if (configSelectsHarness) blockers.push('TESTNET_BUYBACKBURN_HARNESS_SELECTED_AS_PRODUCTION');
  if (sourceExists && configProjectFound && !buildCodeBocExists) blockers.push('BUYBACKBURN_BUILD_CODE_BOC_MISSING');

  const addressUnlockReady = blockers.length === 0;
  const status = addressUnlockReady
    ? 'READY_FOR_MAINNET_ADDRESS_DERIVATION'
    : blockers.includes('PRODUCTION_BUYBACKBURN_CONTRACT_MISSING')
      ? 'BLOCKED_PRODUCTION_BUYBACKBURN_CONTRACT_MISSING'
      : blockers.includes('TESTNET_BUYBACKBURN_HARNESS_SELECTED_AS_PRODUCTION')
        ? 'BLOCKED_TESTNET_HARNESS_SELECTED_AS_PRODUCTION'
        : blockers.includes('TACT_CONFIG_MISSING_PRODUCTION_BUYBACKBURN_PROJECT')
          ? 'BLOCKED_TACT_CONFIG_MISSING_BUYBACKBURN'
          : 'BLOCKED_BUYBACKBURN_BUILD_ARTIFACT_MISSING';
  const requiredNextActions = addressUnlockReady
    ? [
      'Derive the final mainnet BuybackBurn StateInit address from the final genesis hash and final ATH master address.',
      'Derive the official BuybackBurn ATH wallet from that BuybackBurn address and ATH master.',
      'Feed the final mainnet ATH/BuybackBurn addresses into the M20F live STON.fi collector with real proof refs.',
      'Keep production_buyback_burn_unlocked false until M20F route freeze and production review gates pass.',
    ]
    : [
      'Implement contracts/BuybackBurn.tact as a production contract, not a testnet harness.',
      'Break the StateInit circularity by deriving BuybackBurn before route freeze and binding route/official ATH wallet pre-seal.',
      'Add BuybackBurn to tact.config.json under the exact project name BuybackBurn.',
      'Build BuybackBurn and commit the generated code hash/state-init evidence.',
      'Only then derive the final mainnet BuybackBurn address and its official ATH wallet for M20F live collection.',
    ];

  return {
    document: 'PLATHO.V1.M20F_MAINNET_ADDRESS_UNLOCK_PREFLIGHT',
    status,
    generated_at: 'DETERMINISTIC_ARTIFACT',
    address_unlock_ready: addressUnlockReady,
    production_buyback_burn_unlocked: false,
    production_buyback_burn_contract: {
      expectedSourcePath: 'contracts/BuybackBurn.tact',
      sourceExists,
      harnessSourcePath: 'contracts/M20TBuybackBurnHarness.tact',
      harnessSourceExists: existsSync(harnessPath),
      configPath: 'tact.config.json',
      configExists,
      configProjectFound,
      configProjectName: typeof configProject?.name === 'string' ? configProject.name : null,
      configProjectPath: typeof configProject?.path === 'string' ? configProject.path : null,
      configProjectOutput: typeof configProject?.output === 'string' ? configProject.output : null,
      configSelectsHarness,
      buildCodeBocPath: toProjectRelative(projectRoot, buildCodeBocPath),
      buildCodeBocExists,
    },
    m20t,
    blockers,
    requiredNextActions,
    addressDerivationNotes: [
      'FeeAccumulator already stores an immutable buyback_burn_address, so the final BuybackBurn StateInit address must exist before FeeAccumulator production deployment.',
      'The M20TBuybackBurnHarness address must never be reused as the production BuybackBurn address.',
      'The official BuybackBurn ATH wallet is derived after the BuybackBurn address is known; it must not be hardcoded from testnet evidence.',
      'M20F route evidence remains separate from production unlock and must stay false until final mainnet evidence passes.',
    ],
  };
}

function markdown(report: M20FMainnetAddressUnlockPreflight) {
  const lines = [
    '# M20F Mainnet Address Unlock Preflight',
    '',
    `Status: ${report.status}`,
    '',
    `- address_unlock_ready: ${report.address_unlock_ready}`,
    `- production_buyback_burn_unlocked: ${report.production_buyback_burn_unlocked}`,
    `- production BuybackBurn source exists: ${report.production_buyback_burn_contract.sourceExists}`,
    `- production BuybackBurn Tact project exists: ${report.production_buyback_burn_contract.configProjectFound}`,
    `- production BuybackBurn code BOC exists: ${report.production_buyback_burn_contract.buildCodeBocExists}`,
    `- harness selected as production: ${report.production_buyback_burn_contract.configSelectsHarness}`,
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((blocker) => `- ${blocker}`) : ['- none']),
    '',
    '## Required Next Actions',
    '',
    ...report.requiredNextActions.map((action) => `- ${action}`),
    '',
    '## Address Derivation Notes',
    '',
    ...report.addressDerivationNotes.map((note) => `- ${note}`),
    '',
  ];
  return lines.join('\n');
}

export function writeM20FMainnetAddressUnlockPreflightArtifacts() {
  mkdirSync(DEFAULT_ARTIFACTS_DIR, { recursive: true });
  const report = createM20FMainnetAddressUnlockPreflight({
    projectRoot: DEFAULT_PROJECT_ROOT,
    artifactsDir: DEFAULT_ARTIFACTS_DIR,
  });

  writeFileSync(
    join(DEFAULT_ARTIFACTS_DIR, 'm20f_mainnet_address_unlock_preflight.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(
    join(DEFAULT_ARTIFACTS_DIR, 'M20F_MAINNET_ADDRESS_UNLOCK_PREFLIGHT.md'),
    markdown(report),
  );
  writeFileSync(
    join(DEFAULT_ARTIFACTS_DIR, 'M20F_MAINNET_ADDRESS_UNLOCK_READY.txt'),
    `${report.address_unlock_ready}\n`,
  );
  return report;
}

if (require.main === module) {
  const report = writeM20FMainnetAddressUnlockPreflightArtifacts();
  console.log(JSON.stringify({
    status: report.status,
    address_unlock_ready: report.address_unlock_ready,
    production_buyback_burn_unlocked: report.production_buyback_burn_unlocked,
    blockers: report.blockers,
    output: 'artifacts/m20f_mainnet_address_unlock_preflight.json',
  }, null, 2));
}
