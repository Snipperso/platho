import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';
import {
  PUBLIC_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS,
  PUBLIC_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS,
  PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS,
  PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS,
} from '../web/message-pricing-policy.mjs';

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
const CURRENT_CODE_HASH_TO_MANIFEST_KEY = {
  ATHMASTER_CODE_HASH: 'ath_master',
  ATHVESTING_CODE_HASH: 'ath_vesting',
  ATH_WALLET_CODE_HASH: 'ath_wallet',
  BUYBACKBURN_CODE_HASH: 'buyback_burn',
  MARKET_STABILITY_SELLER_CODE_HASH: 'market_stability_seller',
  CAPSULEHUB_CODE_HASH: 'capsulehub',
  FEEACCUMULATOR_CODE_HASH: 'fee_accumulator',
  PROFILE_REGISTRY_CODE_HASH: 'profile_registry',
  USERNAME_NFT_ITEM_CODE_HASH: 'username_nft_item',
  USERNAME_REGISTRY_CODE_HASH: 'username_registry',
  VAULT_CODE_HASH: 'vault',
};

const PRODUCTION_CODE_HASH_KEYS = Object.freeze(Object.keys(CURRENT_CODE_HASH_TO_MANIFEST_KEY).sort());
const TEST_DEPLOY_TARGET_RE = /(?:Mock|Harness|M20T)/i;
const POST_POOL_COMMANDS = Object.freeze([
  'npm.cmd run m20f:collect',
  'npm.cmd run m20f:preflight',
  'npm.cmd run market-stability:readiness',
  'npm.cmd run buyback:enable-preflight',
]);

const CONTRACT_TO_CURRENT_CODE_HASH_KEY = {
  ATHMaster: 'ATHMASTER_CODE_HASH',
  ATHVesting: 'ATHVESTING_CODE_HASH',
  BuybackBurn: 'BUYBACKBURN_CODE_HASH',
  MarketStabilitySeller: 'MARKET_STABILITY_SELLER_CODE_HASH',
  CapsuleHub: 'CAPSULEHUB_CODE_HASH',
  FeeAccumulator: 'FEEACCUMULATOR_CODE_HASH',
  ProfileRegistry: 'PROFILE_REGISTRY_CODE_HASH',
  UsernameNFTItem: 'USERNAME_NFT_ITEM_CODE_HASH',
  UsernameRegistry: 'USERNAME_REGISTRY_CODE_HASH',
  Vault: 'VAULT_CODE_HASH',
};

const DEPLOY_ACTION_TO_CONTRACT = {
  'Deploy ATHMaster': 'ATHMaster',
  'Deploy ATHVesting': 'ATHVesting',
  'Deploy BuybackBurn': 'BuybackBurn',
  'Deploy MarketStabilitySeller': 'MarketStabilitySeller',
  'Deploy CapsuleHub': 'CapsuleHub',
  'Deploy FeeAccumulator': 'FeeAccumulator',
  'Deploy ProfileRegistry': 'ProfileRegistry',
  'Deploy UsernameRegistry': 'UsernameRegistry',
  'Deploy Vault': 'Vault',
};

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

function computeInlineImportMapCspHashes() {
  const html = readTextIfExists('web/index.html');
  if (!html) return null;
  const match = html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/);
  if (!match) return null;
  const importMap = match[1];
  const canonicalLfImportMap = importMap.replace(/\r\n/g, '\n');
  return unique([
    `sha256-${sha256Base64(importMap)}`,
    `sha256-${sha256Base64(canonicalLfImportMap)}`,
  ]);
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

function validateFeeAccumulatorHashAliases() {
  const canonical = readTextIfExists('artifacts/FEEACCUMULATOR_CODE_HASH.txt');
  const legacyAlias = readTextIfExists('artifacts/FEE_ACCUMULATOR_CODE_HASH.txt');
  const currentText = readTextIfExists('artifacts/CURRENT_CODE_HASHES.txt');
  if (!canonical || !legacyAlias) return;

  const canonicalHash = normalizeHashFileText(canonical);
  const aliasHash = normalizeHashFileText(legacyAlias);
  const currentHash = normalizeHash(parseKeyValueLines(currentText ?? '').FEEACCUMULATOR_CODE_HASH);
  if (canonicalHash !== aliasHash || (currentHash && canonicalHash !== currentHash)) {
    failures.push({
      id: 'FEE_ACCUMULATOR_HASH_ALIAS_MISMATCH',
      file: 'artifacts/FEEACCUMULATOR_CODE_HASH.txt',
      message: 'FeeAccumulator canonical and legacy hash artifact filenames must remain identical and match CURRENT_CODE_HASHES.txt.',
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
    const manifestHash = normalizeHash(input?.manifest?.code_hashes?.[CURRENT_CODE_HASH_TO_MANIFEST_KEY[key]]);
    if (!productionHash || !currentHash || productionHash !== currentHash) {
      mismatches.push(`${key}: production=${productionHash || 'missing'}, current=${currentHash || 'missing'}`);
    }
    if (input && (!productionHash || !manifestHash || productionHash !== manifestHash)) {
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
  if (normalizeHash(PLATHO_APP_CONFIG?.vault?.deploymentManifestHash) !== manifestHash) {
    failures.push({
      id: 'PWA_FINAL_MANIFEST_HASH_MISMATCH',
      file: 'web/platho-config.mjs',
      message: 'PWA vault.deploymentManifestHash must match the verified final genesis manifest hash.',
    });
  }

  const addressChecks = [
    ['PWA_VAULT_ADDRESS_MISMATCH', 'vault.address', PLATHO_APP_CONFIG?.vault?.address, manifest?.addresses?.vault],
    ['PWA_CAPSULEHUB_ADDRESS_MISMATCH', 'capsuleHub.address', PLATHO_APP_CONFIG?.capsuleHub?.address, manifest?.addresses?.capsulehub],
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
      if (!contract) continue;
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

function validateCspImportMapHash() {
  const expectedHashes = computeInlineImportMapCspHashes();
  if (!expectedHashes) {
    failures.push({
      id: 'PWA_CSP_IMPORTMAP_MISSING',
      file: 'web/index.html',
      message: 'web/index.html must contain the inline importmap used by the CSP hash guard.',
    });
    return;
  }

  for (const file of ['deploy/Caddyfile', 'deploy/nginx-platho.app.conf', 'deploy/README.md', 'scripts/server/Caddyfile', 'PRODUCTION_READINESS.md']) {
    const text = readTextIfExists(file);
    if (!text) {
      failures.push({ id: 'PWA_CSP_CONFIG_MISSING', file, message: 'Required CSP documentation/config is missing.' });
      continue;
    }
    for (const expectedHash of expectedHashes) {
      if (!text.includes(expectedHash)) {
        failures.push({
          id: 'PWA_CSP_IMPORTMAP_HASH_MISMATCH',
          file,
          message: `CSP importmap hash must match web/index.html, including line-ending-safe hash: ${expectedHash}.`,
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
  const codeChecks = [
    ['vault', 'VAULT_CODE_HASH'],
    ['capsulehub', 'CAPSULEHUB_CODE_HASH'],
    ['ath_wallet', 'ATH_WALLET_CODE_HASH'],
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

  const expectedCaseIds = [
    'public_1k',
    'public_2k',
    'public_4k',
    'public_8k',
    'public_16k',
    'public_32k',
    'private_hybrid_1k',
    'private_hybrid_2k',
    'private_hybrid_4k',
    'private_hybrid_8k',
    'private_hybrid_16k',
    'private_hybrid_32k',
  ];
  const actualCaseIds = (report.cases ?? []).map((item) => item?.id);
  for (const caseId of expectedCaseIds) {
    if (!actualCaseIds.includes(caseId)) {
      failures.push({
        id: 'PUBLISH_RESERVE_PRICING_CASE_MISSING',
        file: 'artifacts/publish_reserve_pricing_report.json',
        message: `Publish reserve pricing report must cover ${caseId}.`,
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

  const caseById = new Map((report.cases ?? []).map((item) => [item?.id, item]));
  const expectedPwaCases = [
    ...Object.entries(PUBLIC_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS).map(([sizeClass, hold]) => ({
      id: `public_${sizeClass}k`,
      hold,
      net: PUBLIC_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[sizeClass],
    })),
    ...Object.entries(PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS).map(([sizeClass, hold]) => ({
      id: `private_hybrid_${sizeClass}k`,
      hold,
      net: PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[sizeClass],
    })),
  ];

  for (const expectedCase of expectedPwaCases) {
    const actual = caseById.get(expectedCase.id);
    if (
      String(actual?.canonical_max_charge_nanotons ?? '') !== expectedCase.hold.toString()
      || String(actual?.user_net_debit_nanotons ?? '') !== expectedCase.net.toString()
      || String(actual?.protocol_fee_nanotons ?? '') !== '10000000'
    ) {
      failures.push({
        id: 'PUBLISH_RESERVE_PRICING_PWA_TABLE_MISMATCH',
        file: 'artifacts/publish_reserve_pricing_report.json',
        message: `Publish reserve pricing report ${expectedCase.id} must match the PWA hold/net table and 0.010 TON protocol fee.`,
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
validateFeeAccumulatorHashAliases();
validateProductionDeployPacketHasNoTestTargets();
validateReleaseDocsPhaseOrder();
validateCspImportMapHash();
validatePublishReservePricingArtifact();

if (failures.length > 0) {
  console.error('PREPROD_GUARD_BLOCKED');
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}

console.log('PREPROD_GUARD_PASS');
