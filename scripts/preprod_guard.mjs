import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const checks = [
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

const envChecks = [
  {
    id: 'TESTNET_ENV_PRESENT',
    file: '.env.testnet.local',
    message: 'Testnet env file is present. Production deploy must not run from this workspace/config.',
  },
];

const failures = validatePlathoAppConfig(PLATHO_APP_CONFIG).findings.map((finding) => ({ ...finding }));

for (const check of checks) {
  const path = join(ROOT, check.file);
  if (!existsSync(path)) {
    failures.push({ id: check.id, file: check.file, message: 'Required file is missing.' });
    continue;
  }
  const text = readFileSync(path, 'utf8');
  if (check.pattern.test(text)) {
    failures.push({ id: check.id, file: check.file, message: check.message });
  }
}

for (const check of envChecks) {
  if (existsSync(join(ROOT, check.file))) {
    failures.push({ id: check.id, file: check.file, message: check.message });
  }
}

if (failures.length > 0) {
  console.error('PREPROD_GUARD_BLOCKED');
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}

console.log('PREPROD_GUARD_PASS');
