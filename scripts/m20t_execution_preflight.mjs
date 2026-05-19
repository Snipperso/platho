import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { toNano } = require('@ton/core');

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const FULL_SIZE_MIN_BALANCE = toNano('55');
const SCALED_MIN_BALANCE = toNano('1');
const TEMPLATE_NOT_EXECUTED = 'TEMPLATE_NOT_EXECUTED';
const FINAL_STATEMENT = 'M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.';

export function parseEnvText(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

export function readPublicM20TEnv(envPath = '.env.testnet.local') {
  const env = parseEnvText(readFileSync(envPath, 'utf8'));
  return {
    network: env.PLATHO_NETWORK ?? '',
    rpcEndpoint: env.PLATHO_TON_RPC_ENDPOINT ?? '',
    deployerAddress: env.PLATHO_TESTNET_DEPLOYER_ADDRESS ?? '',
    deployerWalletVersion: env.PLATHO_TESTNET_DEPLOYER_WALLET_VERSION ?? '',
    minBalanceNanotons: env.PLATHO_TESTNET_MIN_BALANCE_NANOTONS ?? '',
    allowMainnet: env.PLATHO_M20T_ALLOW_MAINNET ?? '',
    setStonfiRouteFreezeReady: env.PLATHO_M20T_SET_STONFI_ROUTE_FREEZE_READY ?? '',
    setBuybackBurnImplementationReady: env.PLATHO_M20T_SET_BUYBACKBURN_IMPLEMENTATION_READY ?? '',
  };
}

function ok(value, blocker, blockers) {
  if (!value) blockers.push(blocker);
  return value;
}

function parseObservedBalanceArg(argv) {
  const idx = argv.indexOf('--observed-balance-nanotons');
  if (idx < 0) return undefined;
  if (!argv[idx + 1]) throw new Error('Missing value for --observed-balance-nanotons');
  return BigInt(argv[idx + 1]);
}

function isPlaceholder(value) {
  return value.length === 0 || value.includes('FILL_') || value.includes('PLACEHOLDER');
}

function hasTestnetAddressShape(value) {
  return /^[-0-9]+:[0-9a-fA-F]{64}$/.test(value) || /^[0-9A-Za-z_-]{48}$/.test(value);
}

function safeJsonParse(text, name) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

function createFunding(observedBalanceNanotons) {
  if (observedBalanceNanotons === undefined) {
    return {
      status: 'BALANCE_NOT_CHECKED',
      funding: {
        observedBalanceNanotons: 'NOT_CHECKED',
        scaledHarnessMinimumNanotons: SCALED_MIN_BALANCE.toString(),
        fullSizeM20TMinimumNanotons: FULL_SIZE_MIN_BALANCE.toString(),
        remainingForScaledHarnessNanotons: 'NOT_CHECKED',
        remainingForFullSizeM20TNanotons: 'NOT_CHECKED',
      },
    };
  }
  const status = observedBalanceNanotons >= FULL_SIZE_MIN_BALANCE
    ? 'READY_FOR_FULL_SIZE_M20T'
    : observedBalanceNanotons >= SCALED_MIN_BALANCE
      ? 'READY_FOR_SCALED_HARNESS_ONLY'
      : 'NEED_TESTNET_TON';
  return {
    status,
    funding: {
      observedBalanceNanotons: observedBalanceNanotons.toString(),
      scaledHarnessMinimumNanotons: SCALED_MIN_BALANCE.toString(),
      fullSizeM20TMinimumNanotons: FULL_SIZE_MIN_BALANCE.toString(),
      remainingForScaledHarnessNanotons: observedBalanceNanotons >= SCALED_MIN_BALANCE ? '0' : (SCALED_MIN_BALANCE - observedBalanceNanotons).toString(),
      remainingForFullSizeM20TNanotons: observedBalanceNanotons >= FULL_SIZE_MIN_BALANCE ? '0' : (FULL_SIZE_MIN_BALANCE - observedBalanceNanotons).toString(),
    },
  };
}

export function createM20TExecutionPreflight(input) {
  const blockers = [];
  const warnings = [];
  const minBalance = input.env.minBalanceNanotons ? BigInt(input.env.minBalanceNanotons) : 0n;
  const funding = createFunding(input.observedBalanceNanotons);
  const manifestTemplate = safeJsonParse(input.manifestTemplateText, 'm20t_testnet_manifest_template.json');
  const evidenceTemplate = safeJsonParse(input.evidenceTemplateText, 'm20t_testnet_evidence_template.json');

  const checks = {
    envExampleExists: ok(input.envExampleExists, 'M20T_ENV_EXAMPLE_MISSING', blockers),
    envLocalExists: ok(input.envLocalExists, 'M20T_ENV_LOCAL_MISSING', blockers),
    networkIsTestnet: ok(input.env.network === 'testnet', 'M20T_NETWORK_NOT_TESTNET', blockers),
    rpcEndpointIsTestnet: ok(input.env.rpcEndpoint.includes('testnet'), 'M20T_RPC_ENDPOINT_NOT_TESTNET', blockers),
    mainnetDisabled: ok(input.env.allowMainnet === 'false', 'M20T_MAINNET_NOT_DISABLED', blockers),
    stonfiRouteFreezeFlagFalse: ok(input.env.setStonfiRouteFreezeReady === 'false', 'M20T_STONFI_ROUTE_FREEZE_FLAG_NOT_FALSE', blockers),
    buybackBurnImplementationFlagFalse: ok(
      input.env.setBuybackBurnImplementationReady === 'false',
      'M20T_BUYBACKBURN_IMPLEMENTATION_FLAG_NOT_FALSE',
      blockers,
    ),
    minBalanceIsFullSizeM20T: ok(minBalance === FULL_SIZE_MIN_BALANCE, 'M20T_MIN_BALANCE_NOT_55_TON', blockers),
    deployerAddressPresent: ok(!isPlaceholder(input.env.deployerAddress), 'M20T_DEPLOYER_ADDRESS_NOT_SET', blockers),
    deployerAddressShape: ok(hasTestnetAddressShape(input.env.deployerAddress), 'M20T_DEPLOYER_ADDRESS_SHAPE_INVALID', blockers),
    walletVersionPinned: ok(input.env.deployerWalletVersion === 'v4r2', 'M20T_WALLET_VERSION_NOT_V4R2', blockers),
    vitestVmThreads: ok(/pool:\s*['"]vmThreads['"]/.test(input.vitestAllConfigText), 'M20T_VITEST_NOT_VMTHREADS', blockers),
    localEnvIgnored: ok(/\.env\.\*/.test(input.gitignoreText), 'M20T_ENV_FILES_NOT_IGNORED', blockers),
    secretArtifactsIgnored: ok(/\*\.mnemonic/.test(input.gitignoreText) && /\*\.seed/.test(input.gitignoreText), 'M20T_SECRET_PATTERNS_NOT_IGNORED', blockers),
    manifestTemplateReady: ok(manifestTemplate.status === TEMPLATE_NOT_EXECUTED, 'M20T_MANIFEST_TEMPLATE_NOT_READY', blockers),
    evidenceTemplateReady: ok(evidenceTemplate.status === TEMPLATE_NOT_EXECUTED, 'M20T_EVIDENCE_TEMPLATE_NOT_READY', blockers),
    evidenceFinalStatementPinned: ok(evidenceTemplate.requiredFinalStatement === FINAL_STATEMENT, 'M20T_EVIDENCE_FINAL_STATEMENT_MISSING', blockers),
    observedBalanceProvided: input.observedBalanceNanotons !== undefined,
    fullSizeBalanceReady: input.observedBalanceNanotons !== undefined && input.observedBalanceNanotons >= FULL_SIZE_MIN_BALANCE,
  };

  if (!checks.observedBalanceProvided) warnings.push('M20T_BALANCE_NOT_CHECKED');
  if (input.envLocalSecretPresence?.mnemonicPresent !== true) warnings.push('M20T_LOCAL_MNEMONIC_NOT_DETECTED');
  if (input.envLocalSecretPresence?.rpcApiKeyPresent !== true) warnings.push('M20T_RPC_API_KEY_NOT_SET_OR_NOT_DETECTED');

  const status = blockers.length > 0
    ? 'BLOCKED_BY_PREFLIGHT'
    : checks.fullSizeBalanceReady
      ? 'READY_FOR_FULL_SIZE_M20T'
      : funding.status;

  return {
    document: 'PLATHO.V1.M20T_EXECUTION_PREFLIGHT',
    status,
    generatedAt: new Date().toISOString(),
    network: input.env.network,
    deployer: {
      address: input.env.deployerAddress,
      walletVersion: input.env.deployerWalletVersion,
      secretMaterialPrinted: false,
      mnemonicPresent: input.envLocalSecretPresence?.mnemonicPresent === true,
      rpcApiKeyPresent: input.envLocalSecretPresence?.rpcApiKeyPresent === true,
    },
    funding: funding.funding,
    checks,
    blockers,
    warnings,
    allowedToExecuteFullSizeM20T: blockers.length === 0 && checks.fullSizeBalanceReady,
    productionUnlock: false,
    requiredFinalStatement: FINAL_STATEMENT,
  };
}

function renderMarkdown(report) {
  return [
    '# M20T Execution Preflight',
    '',
    `Status: ${report.status}`,
    '',
    '## Wallet',
    '',
    '```text',
    `address=${report.deployer.address}`,
    `walletVersion=${report.deployer.walletVersion}`,
    `secretMaterialPrinted=${report.deployer.secretMaterialPrinted}`,
    `mnemonicPresent=${report.deployer.mnemonicPresent}`,
    `rpcApiKeyPresent=${report.deployer.rpcApiKeyPresent}`,
    '```',
    '',
    '## Funding',
    '',
    '```text',
    `observedBalanceNanotons=${report.funding.observedBalanceNanotons}`,
    `fullSizeM20TMinimumNanotons=${report.funding.fullSizeM20TMinimumNanotons}`,
    `remainingForFullSizeM20TNanotons=${report.funding.remainingForFullSizeM20TNanotons}`,
    '```',
    '',
    '## Checks',
    '',
    ...Object.entries(report.checks).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Blockers',
    '',
    ...(report.blockers.length > 0 ? report.blockers.map((item) => `- ${item}`) : ['None']),
    '',
    '## Warnings',
    '',
    ...(report.warnings.length > 0 ? report.warnings.map((item) => `- ${item}`) : ['None']),
    '',
    '## Final Statement',
    '',
    report.requiredFinalStatement,
    '',
  ].join('\n');
}

function readInputFromWorkspace(observedBalanceNanotons) {
  const envPath = '.env.testnet.local';
  const envLocalExists = existsSync(envPath);
  const envText = envLocalExists ? readFileSync(envPath, 'utf8') : '';
  const rawEnv = parseEnvText(envText);
  return {
    env: envLocalExists
      ? readPublicM20TEnv(envPath)
      : {
        network: '',
        rpcEndpoint: '',
        deployerAddress: '',
        deployerWalletVersion: '',
        minBalanceNanotons: '',
        allowMainnet: '',
        setStonfiRouteFreezeReady: '',
        setBuybackBurnImplementationReady: '',
      },
    observedBalanceNanotons,
    envLocalExists,
    envExampleExists: existsSync('.env.testnet.example'),
    vitestAllConfigText: readFileSync('vitest.all.config.ts', 'utf8'),
    manifestTemplateText: readFileSync(join('artifacts', 'm20t_testnet_manifest_template.json'), 'utf8'),
    evidenceTemplateText: readFileSync(join('artifacts', 'm20t_testnet_evidence_template.json'), 'utf8'),
    gitignoreText: readFileSync('.gitignore', 'utf8'),
    envLocalSecretPresence: {
      mnemonicPresent: !isPlaceholder(rawEnv.PLATHO_TESTNET_DEPLOYER_MNEMONIC ?? ''),
      rpcApiKeyPresent: (rawEnv.PLATHO_TON_RPC_API_KEY ?? '').length > 0,
    },
  };
}

function main() {
  const observedBalanceNanotons = parseObservedBalanceArg(process.argv.slice(2));
  const report = createM20TExecutionPreflight(readInputFromWorkspace(observedBalanceNanotons));
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, 'm20t_execution_preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_EXECUTION_PREFLIGHT.md'), renderMarkdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_EXECUTION_PREFLIGHT_STATUS.txt'), `${report.status}\n`);
  console.log(JSON.stringify({
    ok: report.blockers.length === 0,
    status: report.status,
    address: report.deployer.address,
    observedBalanceNanotons: report.funding.observedBalanceNanotons,
    allowedToExecuteFullSizeM20T: report.allowedToExecuteFullSizeM20T,
    blockers: report.blockers,
    warnings: report.warnings,
    productionUnlock: false,
  }, null, 2));
  if (report.blockers.length > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
