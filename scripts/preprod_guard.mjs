import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';
import {
  CURRENT_CODE_HASH_TO_MANIFEST_KEY,
  PRODUCTION_ONLY_CODE_HASH_KEYS,
  PRODUCTION_CODE_HASH_KEYS,
  CONTRACT_TO_CURRENT_CODE_HASH_KEY,
  DEPLOY_ACTION_TO_CONTRACT,
  POST_POOL_COMMANDS,
  TEST_DEPLOY_TARGET_RE,
} from './release-gate-contract-map.mjs';

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
    files: ['web/CRYPTO_PROTOCOL.md', 'web/docs/crypto-protocol.md'],
    pattern: /Remaining production work|prototype currently proves|Before production private messaging|external cryptographic review/,
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
function readTextIfExists(file) {
  const path = join(ROOT, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function readJsonIfExists(file) {
  const text = readTextIfExists(file);
  return text ? JSON.parse(text) : null;
}

function parseKeyValueLines(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

function sha256Base64(text) {
  return createHash('sha256').update(text).digest('base64');
}

function unique(items) {
  return Array.from(new Set(items));
}

function normalizeHash(value) {
  return typeof value === 'string' ? value.replace(/^0x/i, '').toLowerCase() : '';
}

function normalizeHashFileText(value) {
  return normalizeHash(String(value ?? '').trim());
}

function sectionAfterHeading(text, heading) {
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const after = text.slice(start + heading.length);
  const nextHeading = after.search(/\n##\s+/);
  return nextHeading >= 0 ? after.slice(0, nextHeading) : after;
}

function compactStepText(step, fields) {
  return fields
    .map((field) => step?.[field])
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value))
    .join(' ');
}

// [REPLACED 2026-07-31] This used to compare exactly two files: FEEACCUMULATOR_CODE_HASH.txt against a legacy alias
// FEE_ACCUMULATOR_CODE_HASH.txt. The alias was an ORPHAN — scripts/hash_codes.js writes one file per key present in
// CURRENT_CODE_HASHES.txt, and the underscored spelling is not a key, so nothing ever rewrote it. It had rotted to a
// hash from an older build, and the only thing in the repository that still read the legacy name was this check
// itself. A gate comparing a live file against a dead one, and blocking production on the difference.
//
// Deleting the orphan alone would have fixed the symptom and left the class: seventeen OTHER single-value hash files
// carry the same derived value, and any one of them could fall out of the generator's list the same way. So the pair
// check is replaced by a family check over every artifacts/*_CODE_HASH.txt, which fails on a NEW orphan instead of
// on the one that already happened.
function validateCodeHashArtifactFamily() {
  const currentText = readTextIfExists('artifacts/CURRENT_CODE_HASHES.txt');
  if (!currentText) return;
  const current = parseKeyValueLines(currentText);

  let files;
  try {
    files = readdirSync('artifacts').filter((name) => /^[A-Z0-9_]+_CODE_HASH\.txt$/.test(name));
  } catch {
    return;
  }

  const drifted = [];
  for (const file of files) {
    const key = file.slice(0, -'.txt'.length);
    const expected = normalizeHash(current[key]);
    const actual = normalizeHashFileText(readTextIfExists(`artifacts/${file}`) ?? '');
    if (!expected) {
      drifted.push(`${file}: no ${key} in CURRENT_CODE_HASHES.txt — the generator does not write this file, so it `
        + 'can only rot; delete it or add the key');
      continue;
    }
    if (expected !== actual) drifted.push(`${file}: file=${actual || 'empty'} vs current=${expected}`);
  }

  if (drifted.length > 0) {
    failures.push({
      id: 'CODE_HASH_ARTIFACT_FAMILY_DRIFT',
      file: 'artifacts/CURRENT_CODE_HASHES.txt',
      message: `Every artifacts/*_CODE_HASH.txt must be a current copy of its CURRENT_CODE_HASHES.txt entry. ${drifted.join(' | ')}`,
    });
  }
}

function validateProductionCodeHashes(input) {
  const currentText = readTextIfExists('artifacts/CURRENT_CODE_HASHES.txt');
  const productionText = readTextIfExists('artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt');
  if (!productionText) {
    failures.push({
      id: 'CURRENT_PRODUCTION_CODE_HASHES_MISSING',
      file: 'artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt',
      message: 'Release archives must include production-only code hashes without mock or harness hash keys.',
    });
    return;
  }

  const currentCodeHashes = parseKeyValueLines(currentText ?? '');
  const productionCodeHashes = parseKeyValueLines(productionText);
  const actualKeys = Object.keys(productionCodeHashes).sort();
  const missing = PRODUCTION_CODE_HASH_KEYS.filter((key) => !actualKeys.includes(key));
  const extra = actualKeys.filter((key) => !PRODUCTION_CODE_HASH_KEYS.includes(key));
  const testKeys = actualKeys.filter((key) => TEST_DEPLOY_TARGET_RE.test(key));
  if (missing.length > 0 || extra.length > 0 || testKeys.length > 0) {
    failures.push({
      id: 'CURRENT_PRODUCTION_CODE_HASHES_KEYSET_INVALID',
      file: 'artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt',
      message: `Production-only hash file must contain exactly production keys. missing=${missing.join(',') || '-'} extra=${extra.join(',') || '-'} test=${testKeys.join(',') || '-'}.`,
    });
  }

  const mismatches = [];
  for (const key of PRODUCTION_CODE_HASH_KEYS) {
    const productionHash = normalizeHash(productionCodeHashes[key]);
    const currentHash = normalizeHash(currentCodeHashes[key]);
    const manifestKey = CURRENT_CODE_HASH_TO_MANIFEST_KEY[key];
    const manifestHash = normalizeHash(input?.manifest?.code_hashes?.[manifestKey]);
    if (!productionHash || !currentHash || productionHash !== currentHash) {
      mismatches.push(`${key}: production=${productionHash || 'missing'}, current=${currentHash || 'missing'}`);
    }
    // KeyShard and RecoveryShard have no manifest counterpart by design (see PRODUCTION_ONLY_CODE_HASH_KEYS), so
    // comparing them against it would report a mismatch against nothing — the failure mode this gate exists to stop.
    if (manifestKey && input && (!productionHash || !manifestHash || productionHash !== manifestHash)) {
      mismatches.push(`${key}: production=${productionHash || 'missing'}, manifest=${manifestHash || 'missing'}`);
    }
  }

  if (mismatches.length > 0) {
    failures.push({
      id: 'CURRENT_PRODUCTION_CODE_HASHES_MISMATCH',
      file: 'artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt',
      message: `Production-only code hashes must match CURRENT_CODE_HASHES.txt and final manifest production hashes: ${mismatches.join('; ')}.`,
    });
  }
}

function validateProductionDeployPacketHasNoTestTargets() {
  const deployPacket = readJsonIfExists('artifacts/local/mainnet_deploy_packet.json');
  if (deployPacket) {
    const offenders = [];
    for (const step of deployPacket.phase_1_deploy_contracts ?? []) {
      const text = compactStepText(step, ['id', 'action', 'contract', 'message', 'target_is']);
      if (TEST_DEPLOY_TARGET_RE.test(text)) offenders.push(text);
    }
    if (offenders.length > 0) {
      failures.push({
        id: 'PRODUCTION_DEPLOY_PACKET_TEST_TARGET',
        file: 'artifacts/local/mainnet_deploy_packet.json',
        message: `Production deploy packet must not deploy mock, harness, or M20T contracts: ${offenders.join('; ')}.`,
      });
    }
  }

  const dryRunPacket = readJsonIfExists('artifacts/local/mainnet_tx_dry_run_packet.json');
  if (dryRunPacket) {
    const offenders = [];
    for (const step of dryRunPacket.deploy_contracts ?? []) {
      const text = compactStepText(step, ['id', 'action', 'contract', 'message']);
      if (TEST_DEPLOY_TARGET_RE.test(text)) offenders.push(text);
    }
    if (offenders.length > 0) {
      failures.push({
        id: 'PRODUCTION_TX_DRY_RUN_PACKET_TEST_TARGET',
        file: 'artifacts/local/mainnet_tx_dry_run_packet.json',
        message: `Production dry-run packet must not deploy mock, harness, or M20T contracts: ${offenders.join('; ')}.`,
      });
    }
  }
}

function validateReleaseDocsPhaseOrder() {
  const docs = [
    {
      file: 'PRODUCTION_READINESS.md',
      beforeHeading: '## Required before production PWA release',
      postHeading: '## Required only after airdrop and pool launch',
    },
    {
      file: 'MAINNET_RELEASE_CHECKLIST.md',
      beforeHeading: '## Command Gates Before Production PWA Release',
      postHeading: '## Post-Pool Command Gates',
    },
  ];

  for (const doc of docs) {
    const text = readTextIfExists(doc.file);
    if (!text) continue;
    const before = sectionAfterHeading(text, doc.beforeHeading);
    const post = sectionAfterHeading(text, doc.postHeading);
    if (before === null || post === null) {
      failures.push({
        id: 'RELEASE_DOC_PHASE_SECTIONS_MISSING',
        file: doc.file,
        message: `Release docs must split pre-PWA gates and post-pool gates with "${doc.beforeHeading}" and "${doc.postHeading}".`,
      });
      continue;
    }

    const misplaced = POST_POOL_COMMANDS.filter((command) => before.includes(command));
    const missingPost = POST_POOL_COMMANDS.filter((command) => !post.includes(command));
    if (misplaced.length > 0 || missingPost.length > 0) {
      failures.push({
        id: 'RELEASE_DOC_POST_POOL_COMMAND_PHASE_MISMATCH',
        file: doc.file,
        message: `Post-pool commands must not be required before production PWA release. misplaced=${misplaced.join(',') || '-'} missing_post=${missingPost.join(',') || '-'}.`,
      });
    }
  }
}

function validateCurrentCodeHashesMatchFinalManifest(input) {
  const currentText = readTextIfExists('artifacts/CURRENT_CODE_HASHES.txt');
  if (!currentText) {
    failures.push({
      id: 'CURRENT_CODE_HASHES_MISSING',
      file: 'artifacts/CURRENT_CODE_HASHES.txt',
      message: 'Final genesis verification requires current build code hashes in the release archive.',
    });
    return;
  }

  const currentCodeHashes = parseKeyValueLines(currentText);
  const mismatches = [];
  for (const [currentKey, manifestKey] of Object.entries(CURRENT_CODE_HASH_TO_MANIFEST_KEY)) {
    const currentHash = normalizeHash(currentCodeHashes[currentKey]);
    const manifestHash = normalizeHash(input?.manifest?.code_hashes?.[manifestKey]);
    if (!currentHash || !manifestHash || currentHash !== manifestHash) {
      mismatches.push(`${manifestKey}: current=${currentHash || 'missing'}, manifest=${manifestHash || 'missing'}`);
    }
  }

  if (mismatches.length > 0) {
    failures.push({
      id: 'MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH',
      file: 'artifacts/mainnet_genesis_verify_input.json',
      message: `MAINNET_GENESIS_VERIFIED=true must match the current local build code hashes: ${mismatches.join('; ')}.`,
    });
  }
}

function validatePwaConfigMatchesFinalManifest(input) {
  const manifest = input?.manifest;
  const manifestHash = normalizeHash(manifest?.manifest_hash_hex);
  // [CORRECTED 2026-08-02] Read `genesis`, not `vault`. The Vault contract was deleted and its block with it, but the
  // genesis binding is a RELEASE property that merely LIVED there, so it moved to its own block — and this guard kept
  // aiming at the old address. `PLATHO_APP_CONFIG.vault` is undefined, normalizeHash turns that into '', and '' never
  // equals a manifest hash: the check has been reporting a mismatch for a reason of its own making, which means the
  // binding it exists to enforce has not actually been enforced since the cutover.
  if (normalizeHash(PLATHO_APP_CONFIG?.genesis?.deploymentManifestHash) !== manifestHash) {
    failures.push({
      id: 'PWA_FINAL_MANIFEST_HASH_MISMATCH',
      file: 'web/platho-config.mjs',
      message: 'PWA genesis.deploymentManifestHash must match the verified final genesis manifest hash.',
    });
  }

  const addressChecks = [
    ['PWA_ATH_MASTER_ADDRESS_MISMATCH', 'ath.masterAddress', PLATHO_APP_CONFIG?.ath?.masterAddress, manifest?.addresses?.ath_master],
    ['PWA_USERNAME_REGISTRY_ADDRESS_MISMATCH', 'usernameRegistry.address', PLATHO_APP_CONFIG?.usernameRegistry?.address, manifest?.addresses?.username_registry],
    ['PWA_PROFILE_REGISTRY_ADDRESS_MISMATCH', 'profileRegistry.address', PLATHO_APP_CONFIG?.profileRegistry?.address, manifest?.addresses?.profile_registry],
  ];

  for (const [id, field, actual, expected] of addressChecks) {
    if (!actual || !expected || actual !== expected) {
      failures.push({
        id,
        file: 'web/platho-config.mjs',
        message: `PWA ${field} must match the verified final genesis manifest address.`,
      });
    }
  }
}

function validateSingleDeployTruthSource() {
  const implementedManifest = readJsonIfExists('artifacts/deployment_manifest_implemented_subset_m15.json');
  if (implementedManifest?.status && implementedManifest.status !== 'FINAL_GENESIS') {
    failures.push({
      id: 'RELEASE_TRUTH_SPLIT_NON_FINAL_MANIFEST',
      file: 'artifacts/deployment_manifest_implemented_subset_m15.json',
      message: 'MAINNET_GENESIS_VERIFIED=true cannot coexist with a current non-final implemented-subset deployment manifest.',
    });
  }
}

function validateLocalMainnetDeployArtifacts() {
  const currentText = readTextIfExists('artifacts/CURRENT_CODE_HASHES.txt');
  if (!currentText) return;
  const currentCodeHashes = parseKeyValueLines(currentText);

  const draft = readJsonIfExists('artifacts/local/mainnet_final_manifest_draft.json');
  const draftMismatches = [];
  if (draft) {
    for (const [currentKey, manifestKey] of Object.entries(CURRENT_CODE_HASH_TO_MANIFEST_KEY)) {
      const currentHash = normalizeHash(currentCodeHashes[currentKey]);
      const manifestHash = normalizeHash(draft.manifest?.code_hashes?.[manifestKey]);
      if (!currentHash || !manifestHash || currentHash !== manifestHash) {
        draftMismatches.push(`${manifestKey}: current=${currentHash || 'missing'}, draft=${manifestHash || 'missing'}`);
      }
    }
  }

  if (draftMismatches.length > 0) {
    failures.push({
      id: 'LOCAL_MAINNET_FINAL_MANIFEST_STALE',
      file: 'artifacts/local/mainnet_final_manifest_draft.json',
      message: `Local final manifest draft is stale relative to CURRENT_CODE_HASHES.txt: ${draftMismatches.join('; ')}.`,
    });
  }

  const deployPacket = readJsonIfExists('artifacts/local/mainnet_deploy_packet.json');
  const deployMismatches = [];
  if (deployPacket) {
    for (const step of deployPacket.phase_1_deploy_contracts ?? []) {
      const contract = DEPLOY_ACTION_TO_CONTRACT[step.action];
      if (!contract) {
        // [FIXED 2026-07-31] This was a bare `continue`. Any deploy step whose action string was absent from the map
        // had its code hash compared against NOTHING, and said so to no one — and one was absent: D07 'Deploy
        // AirdropPool', the contract holding the entire 15M ATH airdrop. A step that carries a code_hash and is not
        // recognised is now a failure, so the next contract added to the ceremony cannot be skipped in silence.
        if (step.code_hash) {
          deployMismatches.push(`${step.id} ${step.action}: carries a code hash but no entry in `
            + 'DEPLOY_ACTION_TO_CONTRACT, so it was never checked — add it to scripts/release-gate-contract-map.mjs');
        }
        continue;
      }
      const currentKey = CONTRACT_TO_CURRENT_CODE_HASH_KEY[contract];
      const currentHash = normalizeHash(currentCodeHashes[currentKey]);
      const packetHash = normalizeHash(step.code_hash);
      if (!currentHash || !packetHash || currentHash !== packetHash) {
        deployMismatches.push(`${step.id} ${contract}: current=${currentHash || 'missing'}, packet=${packetHash || 'missing'}`);
      }
    }
  }

  if (deployMismatches.length > 0) {
    failures.push({
      id: 'LOCAL_MAINNET_DEPLOY_PACKET_STALE',
      file: 'artifacts/local/mainnet_deploy_packet.json',
      message: `Local mainnet deploy packet is stale relative to CURRENT_CODE_HASHES.txt: ${deployMismatches.join('; ')}.`,
    });
  }

  const dryRunPacket = readJsonIfExists('artifacts/local/mainnet_tx_dry_run_packet.json');
  const dryRunMismatches = [];
  if (dryRunPacket) {
    for (const step of dryRunPacket.deploy_contracts ?? []) {
      const currentKey = CONTRACT_TO_CURRENT_CODE_HASH_KEY[step.contract];
      if (!currentKey) continue;
      const currentHash = normalizeHash(currentCodeHashes[currentKey]);
      const packetHash = normalizeHash(step.state_init?.code_hash_hex);
      if (!currentHash || !packetHash || currentHash !== packetHash) {
        dryRunMismatches.push(`${step.id} ${step.contract}: current=${currentHash || 'missing'}, dry_run=${packetHash || 'missing'}`);
      }
    }
  }

  if (dryRunMismatches.length > 0) {
    failures.push({
      id: 'LOCAL_MAINNET_TX_DRY_RUN_PACKET_STALE',
      file: 'artifacts/local/mainnet_tx_dry_run_packet.json',
      message: `Local mainnet tx dry-run packet is stale relative to CURRENT_CODE_HASHES.txt: ${dryRunMismatches.join('; ')}.`,
    });
  }
}

function validateMainnetGenesisEvidence() {
  const verifiedText = readTextIfExists('artifacts/MAINNET_GENESIS_VERIFIED.txt');
  if (verifiedText?.trim().toLowerCase() !== 'true') {
    failures.push({
      id: 'MAINNET_GENESIS_NOT_VERIFIED',
      file: 'artifacts/MAINNET_GENESIS_VERIFIED.txt',
      message: 'Current release candidate has no verified final mainnet genesis evidence.',
    });
    return;
  }

  const inputText = readTextIfExists('artifacts/mainnet_genesis_verify_input.json');
  const input = inputText ? JSON.parse(inputText) : null;
  const report = readJsonIfExists('artifacts/mainnet_genesis_verify_report.json');

  if (!inputText) {
    failures.push({
      id: 'MAINNET_GENESIS_VERIFY_INPUT_MISSING',
      file: 'artifacts/mainnet_genesis_verify_input.json',
      message: 'MAINNET_GENESIS_VERIFIED=true requires the final verifier input snapshot in the release archive.',
    });
  }

  if (!report) {
    failures.push({
      id: 'MAINNET_GENESIS_VERIFY_REPORT_MISSING',
      file: 'artifacts/mainnet_genesis_verify_report.json',
      message: 'MAINNET_GENESIS_VERIFIED=true requires the verifier report in the release archive.',
    });
    return;
  }

  if (report.status !== 'MAINNET_GENESIS_VERIFIED' || report.mainnet_genesis_verified !== true) {
    failures.push({
      id: 'MAINNET_GENESIS_VERIFY_REPORT_NOT_PASS',
      file: 'artifacts/mainnet_genesis_verify_report.json',
      message: 'MAINNET_GENESIS_VERIFIED=true disagrees with the stored verifier report.',
    });
  }

  if (inputText) {
    const inputSha256 = sha256Hex(inputText);
    if (report.input_sha256 !== inputSha256) {
      failures.push({
        id: 'MAINNET_GENESIS_VERIFY_INPUT_HASH_MISMATCH',
        file: 'artifacts/mainnet_genesis_verify_report.json',
        message: 'Stored verifier report input_sha256 does not match artifacts/mainnet_genesis_verify_input.json.',
      });
    }
    if (report.input_source !== 'artifacts/mainnet_genesis_verify_input.json') {
      failures.push({
        id: 'MAINNET_GENESIS_VERIFY_INPUT_SOURCE_MISMATCH',
        file: 'artifacts/mainnet_genesis_verify_report.json',
        message: 'Stored verifier report must name artifacts/mainnet_genesis_verify_input.json as input_source.',
      });
    }
  }

  if (!report.evidence_refs) {
    failures.push({
      id: 'MAINNET_GENESIS_VERIFY_EVIDENCE_REFS_MISSING',
      file: 'artifacts/mainnet_genesis_verify_report.json',
      message: 'Stored verifier report must include evidence_refs copied from the input snapshot.',
    });
  }

  if (input) {
    validateCurrentCodeHashesMatchFinalManifest(input);
    validateProductionCodeHashes(input);
    validatePwaConfigMatchesFinalManifest(input);
    validateSingleDeployTruthSource();
  }
}

function validateCspInlineScriptPolicy() {
  // The bundle intentionally ships no inline scripts and no inline import
  // map: vendor modules use relative imports so old Safari (no import-map
  // support before 16.4) can still boot, and script-src stays hash-free.
  const html = readTextIfExists('web/index.html');
  if (!html) {
    failures.push({ id: 'PWA_INDEX_MISSING', file: 'web/index.html', message: 'web/index.html is required.' });
    return;
  }
  if (/<script\s+type="importmap">/.test(html)) {
    failures.push({
      id: 'PWA_INLINE_IMPORTMAP_FORBIDDEN',
      file: 'web/index.html',
      message: 'Inline import map breaks Safari < 16.4 and re-introduces CSP hash fragility; vendor modules must use relative imports.',
    });
  }
  if (/<script(?![^>]*src=)[^>]*>/.test(html.replace(/<script\s+type="importmap">[\s\S]*?<\/script>/, ''))) {
    failures.push({
      id: 'PWA_INLINE_SCRIPT_FORBIDDEN',
      file: 'web/index.html',
      message: 'Inline scripts require CSP content hashes; the production bundle must keep script-src hash-free.',
    });
  }
  if (!html.includes('boot-guard.js')) {
    failures.push({
      id: 'PWA_BOOT_GUARD_REQUIRED',
      file: 'web/index.html',
      message: 'index.html must load boot-guard.js so a dead module graph shows a diagnostic screen instead of a dark shell.',
    });
  }

  for (const file of ['deploy/Caddyfile', 'deploy/nginx-platho.app.conf', 'deploy/README.md', 'scripts/server/Caddyfile', 'PRODUCTION_READINESS.md']) {
    const text = readTextIfExists(file);
    if (!text) {
      failures.push({ id: 'PWA_CSP_CONFIG_MISSING', file, message: 'Required CSP documentation/config is missing.' });
      continue;
    }
    const scriptSrcSections = text.match(/script-src[^;"]*/g) ?? [];
    for (const section of scriptSrcSections) {
      if (section.includes('sha256-')) {
        failures.push({
          id: 'PWA_CSP_STALE_SCRIPT_HASH',
          file,
          message: 'script-src must stay hash-free: the bundle has no inline scripts, stale hashes hide CSP drift.',
        });
      }
    }
  }
}

function validatePublishReservePricingArtifact() {
  const report = readJsonIfExists('artifacts/publish_reserve_pricing_report.json');
  if (!report) {
    failures.push({
      id: 'PUBLISH_RESERVE_PRICING_REPORT_MISSING',
      file: 'artifacts/publish_reserve_pricing_report.json',
      message: 'Production deploy requires a publish reserve pricing report generated for the final code and TON fee config snapshot.',
    });
    return;
  }
  if (report.profile !== 'PLATHO.V1.PUBLISH_RESERVE_PRICING' || report.status !== 'PASS') {
    failures.push({
      id: 'PUBLISH_RESERVE_PRICING_REPORT_NOT_PASS',
      file: 'artifacts/publish_reserve_pricing_report.json',
      message: 'Publish reserve pricing report must have status PASS.',
    });
  }

  const currentText = readTextIfExists('artifacts/CURRENT_CODE_HASHES.txt');
  const currentCodeHashes = currentText ? parseKeyValueLines(currentText) : {};
  // [FIXED 2026-07-30] This list named `vault` and `capsulehub` — two contracts clean-17 DELETED. Neither hash exists
  // in CURRENT_CODE_HASHES.txt any more, so both lookups came back undefined and the check failed unconditionally:
  // the LAST gate standing between this repo and a production deploy was UNPASSABLE BY CONSTRUCTION, and no report,
  // however carefully generated, could ever have satisfied it. It would have been discovered at seal time.
  //
  // Replaced with the contracts that actually decide what a publish costs in clean-17: the three lanes a capsule can
  // be written to, plus the ATH wallet that was already here. PREPROD-HASH-01 now fails if this list ever names a
  // contract CURRENT_CODE_HASHES.txt does not carry — a guard aimed at something deleted is an ABSENT guard, and this
  // repo has now shipped that three times.
  const codeChecks = [
    ['ath_wallet', 'ATH_WALLET_CODE_HASH'],
    ['record_shard', 'RECORD_SHARD_CODE_HASH'],
    ['intro_shard', 'INTRO_SHARD_CODE_HASH'],
    ['public_shard', 'PUBLIC_SHARD_CODE_HASH'],
  ];
  for (const [reportKey, currentKey] of codeChecks) {
    const reportHash = normalizeHash(report.code_hashes?.[reportKey]);
    const currentHash = normalizeHash(currentCodeHashes[currentKey]);
    if (!reportHash || !currentHash || reportHash !== currentHash) {
      failures.push({
        id: 'PUBLISH_RESERVE_PRICING_CODE_HASH_MISMATCH',
        file: 'artifacts/publish_reserve_pricing_report.json',
        message: `Publish reserve pricing report ${reportKey} code hash must match artifacts/CURRENT_CODE_HASHES.txt.`,
      });
    }
  }

  // [REWRITTEN 2026-07-31] This block used to demand twelve cases keyed by capsule SIZE CLASS, each carrying a
  // `canonical_max_charge_nanotons` hold and a `user_net_debit_nanotons` net, cross-checked against
  // PUBLIC/PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS in web/message-pricing-policy.mjs.
  //
  // Every one of those concepts belongs to the VAULT batch-publish model, and clean-17 deleted it: there is no hold
  // and no over-hold refund, no max_charge, no RJ_UNDERPRICED, and no size classes. A publish is a flat per-lane
  // wallet send whose floor is the receiving shard's own gate, and the shard reserves its rent and returns the
  // surplus. MEASURED: those hold/net tables are read by NOTHING in the shipped client — their only consumer in the
  // entire repository was this function.
  //
  // So the LAST gate before a production deploy was demanding a report that certifies prices nobody pays, computed
  // for a contract that does not exist. Satisfying it would have turned the gate green and proved nothing: the same
  // defect as its codeChecks list naming vault/capsulehub, one field over.
  const expectedLaneIds = [
    'conv_first_publish', 'conv_steady_publish',
    'intro_first_publish', 'intro_steady_publish',
    'recovery_write', 'keyshard_register',
    'public_channel_first', 'public_thread_first', 'public_beacon_first', 'public_avatar_first',
  ];
  const actualLaneIds = (report.cases ?? []).map((item) => item?.id);
  for (const laneId of expectedLaneIds) {
    if (!actualLaneIds.includes(laneId)) {
      failures.push({
        id: 'PUBLISH_RESERVE_PRICING_CASE_MISSING',
        file: 'artifacts/publish_reserve_pricing_report.json',
        message: `Publish reserve pricing report must cover the ${laneId} direct-pay lane.`,
      });
    }
  }

  const expectedFeeConfig = {
    config_18_latest_utime_since: '1777500000',
    config_18_latest_bit_price_ps: '0',
    config_18_latest_cell_price_ps: '135',
    config_21_flat_gas_price: '6667',
    config_21_gas_price: '4369067',
    config_25_lump_price: '66667',
    config_25_bit_price: '4369067',
    config_25_cell_price: '436906667',
  };
  for (const [key, expected] of Object.entries(expectedFeeConfig)) {
    if (String(report.fee_config_snapshot?.[key] ?? '') !== expected) {
      failures.push({
        id: 'PUBLISH_RESERVE_PRICING_FEE_CONFIG_STALE',
        file: 'artifacts/publish_reserve_pricing_report.json',
        message: `Publish reserve pricing report fee_config_snapshot.${key} must match the audited TON mainnet value ${expected}.`,
      });
    }
  }

  // The property that actually matters: on every lane the value the CLIENT attaches must cover the floor the
  // CONTRACT demands. Under it, the publish is refused in production while every contract test stays green — which
  // is exactly how four figures in web/publish-price.mjs were once left behind and every publish refused.
  for (const item of report.cases ?? []) {
    const floor = BigInt(item?.contract_floor_nanotons ?? '-1');
    const attached = BigInt(item?.client_attaches_nanotons ?? '0');
    if (floor < 0n || attached < floor) {
      failures.push({
        id: 'PUBLISH_RESERVE_PRICING_LANE_UNDERFUNDED',
        file: 'artifacts/publish_reserve_pricing_report.json',
        message: `Publish reserve pricing lane ${item?.id}: the client attaches ${attached} against a contract floor `
          + `of ${floor}. Every publish on that lane is refused.`,
      });
    }
  }
}

for (const check of checks) {
  const files = check.files ?? [check.file];
  for (const file of files) {
    const path = join(ROOT, file);
    if (!existsSync(path)) {
      failures.push({ id: check.id, file, message: 'Required file is missing.' });
      continue;
    }
    const text = readFileSync(path, 'utf8');
    if (check.pattern.test(text)) {
      failures.push({ id: check.id, file, message: check.message });
    }
  }
}

for (const check of envChecks) {
  if (existsSync(join(ROOT, check.file))) {
    failures.push({ id: check.id, file: check.file, message: check.message });
  }
}

validateProductionCodeHashes();
validateMainnetGenesisEvidence();
validateLocalMainnetDeployArtifacts();
validateCodeHashArtifactFamily();
validateProductionDeployPacketHasNoTestTargets();
validateReleaseDocsPhaseOrder();
validateCspInlineScriptPolicy();
validatePublishReservePricingArtifact();

if (failures.length > 0) {
  console.error('PREPROD_GUARD_BLOCKED');
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}

console.log('PREPROD_GUARD_PASS');
