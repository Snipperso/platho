import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';

const ROOT = process.cwd();
const WEB_ROOT = join(ROOT, 'web');
const ARTIFACTS_DIR = join(ROOT, 'artifacts');
const DEFAULT_DOMAIN = 'platho.app';

const ROOT_RUNTIME_FILES = new Set([
  'index.html',
  'styles.css',
  'app.js',
  'platho-config.mjs',
  'capsule-part-policy.mjs',
  'message-pricing-policy.mjs',
  'public-channel-subscriptions.mjs',
  'recipient-identities.mjs',
  'encrypted-message-store.mjs',
  'pwa-contract-transactions.mjs',
  'platho-wallet.mjs',
  'vault-ton-rpc-provider.mjs',
  'ton-dns-provider.mjs',
  'capsulehub-ton-rpc-provider.mjs',
  'ath-ton-rpc-provider.mjs',
  'profile-registry-ton-rpc-provider.mjs',
  'username-ton-rpc-provider.mjs',
  'sw.js',
  'manifest.webmanifest',
  'replay-store.mjs',
  'vault-chain-provider.mjs',
]);

const PRODUCTION_CHECKS = [
  {
    id: 'PWA_LOCAL_WALLET_PROOF',
    file: 'web/app.js',
    pattern: /createLocalWalletProofKeyPair|testnet:local-wallet-preview|local-preview/,
    message: 'PWA still uses removed preview wallet data.',
  },
  {
    id: 'CRYPTO_PROD_REMAINING_WORK',
    file: 'web/CRYPTO_PROTOCOL.md',
    pattern: /Before production private messaging|external cryptographic review/,
    message: 'Crypto protocol still documents production blockers.',
  },
  {
    id: 'PROD_CHECKLIST_OPEN_BLOCKERS',
    file: 'PRODUCTION_READINESS.md',
    pattern: /Hard blockers/,
    message: 'Production readiness checklist still has open hard blockers.',
  },
];

function toPosix(path) {
  return path.split(sep).join('/');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function parseArgs(argv) {
  const args = {
    mode: 'preview',
    domain: DEFAULT_DOMAIN,
    outputDir: null,
    clean: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--clean') {
      args.clean = true;
    } else if (arg.startsWith('--mode=')) {
      args.mode = arg.slice('--mode='.length);
    } else if (arg === '--mode') {
      args.mode = argv[++i];
    } else if (arg.startsWith('--domain=')) {
      args.domain = arg.slice('--domain='.length);
    } else if (arg === '--domain') {
      args.domain = argv[++i];
    } else if (arg.startsWith('--out-dir=')) {
      args.outputDir = arg.slice('--out-dir='.length);
    } else if (arg === '--out-dir') {
      args.outputDir = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['preview', 'production'].includes(args.mode)) {
    throw new Error('--mode must be preview or production');
  }
  if (!args.domain) throw new Error('--domain is required');
  if (!args.outputDir) {
    args.outputDir = join(ARTIFACTS_DIR, `platho-web-static-${args.mode}`);
  }

  return args;
}

export function shouldIncludeWebRuntimeFile(relativePath) {
  const path = relativePath.replace(/\\/g, '/');
  const first = path.split('/')[0];
  const name = basename(path);
  const ext = extname(path).toLowerCase();

  if (!path || path.includes('..')) return false;
  if (ROOT_RUNTIME_FILES.has(path)) return true;
  if (first === 'assets') return true;
  if (first === 'channels') return ext === '.json';
  if (first === 'docs') return ext === '.md';
  if (first === 'crypto') return ext === '.mjs';
  if (first !== 'vendor') return false;

  return ext === '.js' || name === 'LICENSE' || name === 'package.json';
}

function walkFiles(root, dir = root) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(root, full));
    } else if (entry.isFile()) {
      out.push(toPosix(relative(root, full)));
    }
  }
  return out.sort();
}

export function selectStaticWebRuntimeFiles(allWebFiles) {
  return allWebFiles.filter(shouldIncludeWebRuntimeFile).sort();
}

function scanProductionFindings(root = ROOT) {
  const findings = validatePlathoAppConfig(PLATHO_APP_CONFIG).findings.map((finding) => ({ ...finding }));

  for (const check of PRODUCTION_CHECKS) {
    const filePath = join(root, check.file);
    if (!existsSync(filePath)) {
      findings.push({
        id: check.id,
        file: check.file,
        message: 'Required file is missing.',
      });
      continue;
    }
    const text = readFileSync(filePath, 'utf8');
    if (check.pattern.test(text)) {
      findings.push({
        id: check.id,
        file: check.file,
        message: check.message,
      });
    }
  }

  if (existsSync(join(root, '.env.testnet.local'))) {
    findings.push({
      id: 'TESTNET_ENV_PRESENT',
      file: '.env.testnet.local',
      message: 'Testnet env file is present. Production deploy must not run from this workspace/config.',
    });
  }

  return findings;
}

function readJsonFile(path, fallback = {}) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function createFileRecords(webRoot, files) {
  return files.map((file) => {
    const full = join(webRoot, file);
    const body = readFileSync(full);
    return {
      path: file,
      bytes: statSync(full).size,
      sha256: sha256(body),
    };
  });
}

function createBundleHash(fileRecords) {
  const body = fileRecords
    .map((file) => `${file.path}\0${file.bytes}\0${file.sha256}`)
    .join('\n');
  return sha256(body);
}

export function createStaticWebDeployReport(input) {
  const productionFindingIds = input.productionFindings.map((finding) => finding.id);
  const blockers = input.mode === 'production' ? productionFindingIds : [];
  const warnings = input.mode === 'preview'
    ? ['STATIC_PACKAGE_IS_NON_PRODUCTION', ...productionFindingIds]
    : [];
  const status = blockers.length > 0
    ? 'BLOCKED_BY_PREPROD'
    : input.mode === 'production'
      ? 'PRODUCTION_STATIC_PACKAGE_READY'
      : 'PREVIEW_STATIC_PACKAGE_READY';
  const runtimeBytes = input.files.reduce((sum, file) => sum + file.bytes, 0);

  return {
    document: 'PLATHO.WEB_STATIC_DEPLOY_PREP.V1',
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    domain: input.domain,
    outputDir: input.outputDir,
    status,
    productionReady: status === 'PRODUCTION_STATIC_PACKAGE_READY',
    noBackendRuntime: true,
    runtime: {
      fileCount: input.files.length,
      totalBytes: runtimeBytes,
      bundleSha256: createBundleHash(input.files),
      files: input.files,
      excludedWebFiles: input.excludedWebFiles,
    },
    checks: {
      serviceWorkerIncluded: input.files.some((file) => file.path === 'sw.js'),
      pwaStartUrlIsStatic: input.webManifest.start_url === './' || input.webManifest.start_url === '/',
      pwaScopeIsStatic: input.webManifest.scope === './',
      envFilesIncluded: input.files.some((file) => /^\.env/.test(file.path)),
      serverRuntimeIncluded: input.files.some((file) => file.path === 'static-server.js'),
      productionMarkersCleared: input.productionFindings.length === 0,
    },
    blockers,
    warnings,
    productionFindings: input.productionFindings,
  };
}

function copyRuntimeFiles(webRoot, outputDir, files) {
  const resolvedOutput = resolve(outputDir);
  const resolvedArtifacts = resolve(ARTIFACTS_DIR);
  if (!isInside(resolvedArtifacts, resolvedOutput)) {
    throw new Error(`Refusing to write deploy package outside artifacts: ${outputDir}`);
  }

  mkdirSync(outputDir, { recursive: true });
  for (const file of files) {
    const source = resolve(webRoot, file);
    if (!isInside(resolve(webRoot), source)) {
      throw new Error(`Refusing to copy path outside web root: ${file}`);
    }
    const target = join(outputDir, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}

function listOutputFiles(outputDir) {
  if (!existsSync(outputDir)) return [];
  return walkFiles(outputDir);
}

function assertNoStaleOutputFiles(outputDir, runtimeFiles) {
  const expected = new Set(runtimeFiles);
  const stale = listOutputFiles(outputDir).filter((file) => !expected.has(file));
  if (stale.length > 0) {
    throw new Error(`Output directory contains stale files. Remove it or re-run with --clean: ${stale.join(', ')}`);
  }
}

function renderMarkdown(report) {
  return [
    '# Platho Static Web Deploy Prep',
    '',
    `Status: ${report.status}`,
    `Mode: ${report.mode}`,
    `Domain: ${report.domain}`,
    `Output: ${report.outputDir}`,
    '',
    '## Runtime',
    '',
    '```text',
    `fileCount=${report.runtime.fileCount}`,
    `totalBytes=${report.runtime.totalBytes}`,
    `bundleSha256=${report.runtime.bundleSha256}`,
    `noBackendRuntime=${report.noBackendRuntime}`,
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
    '## Production Findings',
    '',
    ...(report.productionFindings.length > 0
      ? report.productionFindings.map((item) => `- ${item.id}: ${item.message} (${item.file})`)
      : ['None']),
    '',
  ].join('\n');
}

function writeReport(report) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const mode = report.mode.toLowerCase();
  const modeLabel = report.mode.toUpperCase();
  writeFileSync(join(ARTIFACTS_DIR, 'web_static_deploy_prep.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'WEB_STATIC_DEPLOY_PREP.md'), renderMarkdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'WEB_STATIC_DEPLOY_STATUS.txt'), `${report.status}\n`);
  writeFileSync(join(ARTIFACTS_DIR, `web_static_deploy_prep.${mode}.json`), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, `WEB_STATIC_DEPLOY_PREP_${modeLabel}.md`), renderMarkdown(report));
  writeFileSync(join(ARTIFACTS_DIR, `WEB_STATIC_DEPLOY_STATUS_${modeLabel}.txt`), `${report.status}\n`);
}

function prepareStaticWebDeploy(options) {
  const webFiles = walkFiles(WEB_ROOT);
  const runtimeFiles = selectStaticWebRuntimeFiles(webFiles);
  const excludedWebFiles = webFiles.filter((file) => !runtimeFiles.includes(file));
  const outputDir = resolve(ROOT, options.outputDir);

  const files = createFileRecords(WEB_ROOT, runtimeFiles);
  const report = createStaticWebDeployReport({
    mode: options.mode,
    domain: options.domain,
    outputDir,
    files,
    excludedWebFiles,
    productionFindings: scanProductionFindings(ROOT),
    webManifest: readJsonFile(join(WEB_ROOT, 'manifest.webmanifest')),
  });

  if (report.blockers.length > 0) {
    writeReport(report);
    return report;
  }

  if (options.clean && existsSync(outputDir)) {
    if (!isInside(resolve(ARTIFACTS_DIR), outputDir)) {
      throw new Error(`Refusing to clean output outside artifacts: ${outputDir}`);
    }
    rmSync(outputDir, { recursive: true, force: true });
  }
  assertNoStaleOutputFiles(outputDir, runtimeFiles);
  copyRuntimeFiles(WEB_ROOT, outputDir, runtimeFiles);
  writeReport(report);

  return report;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = prepareStaticWebDeploy(options);
  console.log(JSON.stringify({
    ok: report.blockers.length === 0,
    status: report.status,
    mode: report.mode,
    outputDir: report.outputDir,
    fileCount: report.runtime.fileCount,
    bundleSha256: report.runtime.bundleSha256,
    blockers: report.blockers,
    warnings: report.warnings,
    productionReady: report.productionReady,
  }, null, 2));
  if (report.blockers.length > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
