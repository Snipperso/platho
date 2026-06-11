import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CURRENT_CODE_HASH_TO_MANIFEST_KEY: Record<string, string> = {
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

const CONTRACT_TO_CURRENT_CODE_HASH_KEY: Record<string, string> = {
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

const DEPLOY_ACTION_TO_CONTRACT: Record<string, string> = {
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

const POST_POOL_COMMANDS = [
  'npm.cmd run m20f:collect',
  'npm.cmd run m20f:preflight',
  'npm.cmd run market-stability:readiness',
  'npm.cmd run buyback:enable-preflight',
];

const TEST_DEPLOY_TARGET_RE = /(?:Mock|Harness|M20T)/i;

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function readJson(path: string): any {
  return JSON.parse(readText(path));
}

function listTestFiles(dir = 'tests'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = `${dir}/${name}`;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listTestFiles(path));
    } else if (name.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out;
}

function parseKeyValueLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function normalizeHash(value: unknown): string {
  return typeof value === 'string' ? value.replace(/^0x/i, '').toLowerCase() : '';
}

function sectionAfterHeading(text: string, heading: string): string | null {
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const after = text.slice(start + heading.length);
  const nextHeading = after.search(/\n##\s+/);
  return nextHeading >= 0 ? after.slice(0, nextHeading) : after;
}

function currentManifestCodeHashMismatches(): string[] {
  const currentCodeHashes = parseKeyValueLines(readText('artifacts/CURRENT_CODE_HASHES.txt'));
  const input = readJson('artifacts/mainnet_genesis_verify_input.json');
  const mismatches: string[] = [];

  for (const [currentKey, manifestKey] of Object.entries(CURRENT_CODE_HASH_TO_MANIFEST_KEY)) {
    const currentHash = normalizeHash(currentCodeHashes[currentKey]);
    const manifestHash = normalizeHash(input.manifest?.code_hashes?.[manifestKey]);
    if (!currentHash || !manifestHash || currentHash !== manifestHash) mismatches.push(manifestKey);
  }

  return mismatches;
}

describe('release truth single-source guard', () => {
  it('does not claim mainnet genesis verified for a different current code hash set', () => {
    const verified = readText('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim().toLowerCase();
    const mismatches = currentManifestCodeHashMismatches();

    if (mismatches.length > 0) expect(verified).not.toBe('true');
    if (verified === 'true') expect(mismatches).toEqual([]);
  });

  it('does not allow a verified-mainnet flag beside a non-final current deployment manifest', () => {
    const verified = readText('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim().toLowerCase();
    const currentManifest = readJson('artifacts/deployment_manifest_implemented_subset_m15.json');

    if (currentManifest.status !== 'FINAL_GENESIS') {
      expect(verified).not.toBe('true');
    }
  });

  it('keeps the mainnet verified flag and verifier report in agreement', () => {
    const verified = readText('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim().toLowerCase();
    const report = readJson('artifacts/mainnet_genesis_verify_report.json');

    expect(report.mainnet_genesis_verified).toBe(verified === 'true');
    expect(report.status === 'MAINNET_GENESIS_VERIFIED').toBe(verified === 'true');
  });

  it('marks stale mainnet verifier input when it no longer matches the current local final manifest draft', () => {
    const verified = readText('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim().toLowerCase();
    const input = readJson('artifacts/mainnet_genesis_verify_input.json');
    const report = readJson('artifacts/mainnet_genesis_verify_report.json');
    const markdown = readText('artifacts/MAINNET_GENESIS_VERIFY.md');
    const localDraftPath = 'artifacts/local/mainnet_final_manifest_draft.json';

    if (!existsSync(localDraftPath)) return;

    const localDraft = readJson(localDraftPath);
    const inputHash = normalizeHash(input.manifest?.manifest_hash_hex);
    const localDraftHash = normalizeHash(localDraft.manifest?.manifest_hash_hex);

    if (verified !== 'true' && inputHash !== localDraftHash) {
      expect(report.issue_codes).toContain('MAINNET_GENESIS_VERIFY_INPUT_STALE_RELATIVE_TO_LOCAL_DRAFT');
      expect(markdown).toMatch(/MAINNET_GENESIS_VERIFY_INPUT_STALE_RELATIVE_TO_LOCAL_DRAFT/);
      expect(markdown).toMatch(new RegExp(localDraftHash));
    }
  });

  it('requires production PWA manifest hash to match final verified genesis evidence', async () => {
    const { PLATHO_APP_CONFIG, PLATHO_APP_MODES } = await import('../web/platho-config.mjs');
    const verified = readText('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim().toLowerCase();
    const input = readJson('artifacts/mainnet_genesis_verify_input.json');

    if (PLATHO_APP_CONFIG.mode === PLATHO_APP_MODES.PRODUCTION && verified === 'true') {
      expect(normalizeHash(PLATHO_APP_CONFIG.vault?.deploymentManifestHash)).toBe(
        normalizeHash(input.manifest?.manifest_hash_hex),
      );
    } else if (PLATHO_APP_CONFIG.mode === PLATHO_APP_MODES.PRODUCTION) {
      const productionPrep = readJson('artifacts/web_static_deploy_prep.production.json');
      expect(productionPrep.productionReady).toBe(false);
      expect(productionPrep.status).toMatch(/BLOCKED/);
      expect(productionPrep.blockers).toContain('MAINNET_GENESIS_NOT_VERIFIED');
    } else {
      expect(PLATHO_APP_CONFIG.mode).not.toBe(PLATHO_APP_MODES.PRODUCTION);
    }
  });

  it('keeps current full-suite evidence aligned with the current test tree', () => {
    const summary = readJson('artifacts/CURRENT_FULL_TEST_SUMMARY.json');
    const testFiles = listTestFiles();

    expect(summary.status).toBe('PASS');
    expect(summary.command).toBe('npm.cmd test');
    expect(summary.config).toBe('vitest.all.config.ts');
    expect(summary.discovered_test_files).toBe(testFiles.length);
    expect(summary.executed_test_files).toBe(testFiles.length);
    expect(summary.passed_test_files).toBe(testFiles.length);
    expect(summary.failed_test_files).toBe(0);
    expect(summary.passed_tests).toBe(summary.total_tests);
    expect(summary.failed_tests).toBe(0);
    expect(summary.total_tests).toBeGreaterThan(0);
    expect(summary.supersedes_historical_artifacts).toContain('artifacts/M21A_CHUNKED_FULL_MATRIX_SUMMARY.txt');
  });

  it('does not claim production gates pass while production release gates are blocked', async () => {
    const summary = readJson('artifacts/CURRENT_FULL_TEST_SUMMARY.json');
    const notes = Array.isArray(summary.notes) ? summary.notes.join('\n') : '';
    const claimsProductionGatesPassed = /production release gates now pass/i.test(notes)
      || /production gates now pass/i.test(notes)
      || /verified mainnet genesis and production PWA/i.test(notes);
    const { PLATHO_APP_CONFIG, PLATHO_APP_MODES } = await import('../web/platho-config.mjs');
    const verified = readText('artifacts/MAINNET_GENESIS_VERIFIED.txt').trim().toLowerCase() === 'true';
    const productionPrep = readJson('artifacts/web_static_deploy_prep.production.json');
    const gatesActuallyPass = verified
      && PLATHO_APP_CONFIG.mode === PLATHO_APP_MODES.PRODUCTION
      && productionPrep.productionReady === true;

    if (!gatesActuallyPass) {
      expect(claimsProductionGatesPassed).toBe(false);
    }
  });

  it('keeps exact current economics values in dedicated reports instead of full-suite prose', () => {
    const summary = readJson('artifacts/CURRENT_FULL_TEST_SUMMARY.json');
    const notes = Array.isArray(summary.notes) ? summary.notes.join('\n') : '';
    const pricingReport = readJson('artifacts/publish_reserve_pricing_report.json');
    const profileReport = readJson('artifacts/profile_registry_storage_economics_report.json');
    const usernameReport = readJson('artifacts/username_registry_storage_economics_report.json');

    expect(pricingReport.status).toBe('PASS');
    expect(profileReport.status).toBe('PASS');
    expect(usernameReport.status).toBe('PASS');
    expect(notes).not.toMatch(/\bpublic\s+1K\b[^\n.]*\b0\.\d+\s*TON\b/i);
    expect(notes).not.toMatch(/\bprivate\s+1K\b[^\n.]*\b0\.\d+\s*TON\b/i);
    expect(notes).not.toMatch(/\bfrom\s+0\.\d+\s*TON\b/i);
    expect(notes).not.toMatch(/\b0\.0(?:10|30|337|347|50|63)\s*TON\b/i);
    expect(notes).not.toMatch(/audited\s+2026-06-0[12]/i);
    expect(notes).not.toMatch(/TON mainnet (?:basechain )?fee (?:config )?snapshot/i);
    expect(notes).not.toMatch(/worst retained margin is now [0-9,]+ nanotons/i);
    expect(notes).not.toMatch(/username mint hold to 0\.\d+\s*TON/i);
  });

  it('keeps local mainnet final manifest code hashes aligned with CURRENT_CODE_HASHES when the local draft is archived', () => {
    const path = 'artifacts/local/mainnet_final_manifest_draft.json';
    if (!existsSync(path)) return;

    const currentCodeHashes = parseKeyValueLines(readText('artifacts/CURRENT_CODE_HASHES.txt'));
    const draft = readJson(path);

    for (const [currentKey, manifestKey] of Object.entries(CURRENT_CODE_HASH_TO_MANIFEST_KEY)) {
      expect(normalizeHash(draft.manifest?.code_hashes?.[manifestKey]), manifestKey).toBe(
        normalizeHash(currentCodeHashes[currentKey]),
      );
    }
  });

  it('keeps a production-only code hash file without mock or harness evidence keys', () => {
    const currentCodeHashes = parseKeyValueLines(readText('artifacts/CURRENT_CODE_HASHES.txt'));
    const productionCodeHashes = parseKeyValueLines(readText('artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt'));
    const expectedKeys = Object.keys(CURRENT_CODE_HASH_TO_MANIFEST_KEY).sort();

    expect(Object.keys(productionCodeHashes).sort()).toEqual(expectedKeys);

    for (const key of expectedKeys) {
      expect(key).not.toMatch(TEST_DEPLOY_TARGET_RE);
      expect(normalizeHash(productionCodeHashes[key]), key).toBe(normalizeHash(currentCodeHashes[key]));
    }

    const localDraftPath = 'artifacts/local/mainnet_final_manifest_draft.json';
    if (!existsSync(localDraftPath)) return;

    const draft = readJson(localDraftPath);
    for (const [currentKey, manifestKey] of Object.entries(CURRENT_CODE_HASH_TO_MANIFEST_KEY)) {
      expect(normalizeHash(productionCodeHashes[currentKey]), manifestKey).toBe(
        normalizeHash(draft.manifest?.code_hashes?.[manifestKey]),
      );
    }
  });

  it('keeps local mainnet deploy packet code hashes aligned with CURRENT_CODE_HASHES when the packet is archived', () => {
    const path = 'artifacts/local/mainnet_deploy_packet.json';
    if (!existsSync(path)) return;

    const currentCodeHashes = parseKeyValueLines(readText('artifacts/CURRENT_CODE_HASHES.txt'));
    const packet = readJson(path);

    for (const step of packet.phase_1_deploy_contracts ?? []) {
      const contract = DEPLOY_ACTION_TO_CONTRACT[step.action];
      if (!contract) continue;
      const currentKey = CONTRACT_TO_CURRENT_CODE_HASH_KEY[contract];
      expect(normalizeHash(step.code_hash), `${step.id} ${step.action}`).toBe(normalizeHash(currentCodeHashes[currentKey]));
    }
  });

  it('keeps local mainnet tx dry-run StateInit code hashes aligned with CURRENT_CODE_HASHES when the packet is archived', () => {
    const path = 'artifacts/local/mainnet_tx_dry_run_packet.json';
    if (!existsSync(path)) return;

    const currentCodeHashes = parseKeyValueLines(readText('artifacts/CURRENT_CODE_HASHES.txt'));
    const packet = readJson(path);

    for (const step of packet.deploy_contracts ?? []) {
      const currentKey = CONTRACT_TO_CURRENT_CODE_HASH_KEY[step.contract];
      if (!currentKey) continue;
      expect(normalizeHash(step.state_init?.code_hash_hex), `${step.id} ${step.contract}`).toBe(
        normalizeHash(currentCodeHashes[currentKey]),
      );
    }
  });

  it('keeps local mainnet deploy and dry-run packets free of mock, harness, and M20T deploy targets', () => {
    const deployPath = 'artifacts/local/mainnet_deploy_packet.json';
    if (existsSync(deployPath)) {
      const packet = readJson(deployPath);
      const deployedTargets = (packet.phase_1_deploy_contracts ?? []).map((step: any) => [
        step.id,
        step.action,
        step.contract,
        step.message,
        step.target_is,
      ].filter(Boolean).join(' '));

      expect(deployedTargets).not.toEqual(expect.arrayContaining([expect.stringMatching(TEST_DEPLOY_TARGET_RE)]));
    }

    const dryRunPath = 'artifacts/local/mainnet_tx_dry_run_packet.json';
    if (existsSync(dryRunPath)) {
      const packet = readJson(dryRunPath);
      const deployedTargets = (packet.deploy_contracts ?? []).map((step: any) => [
        step.id,
        step.action,
        step.contract,
        step.message,
      ].filter(Boolean).join(' '));

      expect(deployedTargets).not.toEqual(expect.arrayContaining([expect.stringMatching(TEST_DEPLOY_TARGET_RE)]));
    }
  });

  it('labels local mainnet draft, deploy packet, and dry-run packet as pre-execution templates', () => {
    const expectations = [
      ['artifacts/local/mainnet_final_manifest_draft.json', 'pre_execution_manifest_template'],
      ['artifacts/local/mainnet_deploy_packet.json', 'pre_execution_deploy_packet_template'],
      ['artifacts/local/mainnet_tx_dry_run_packet.json', 'pre_execution_tx_dry_run_template'],
    ] as const;

    for (const [path, stage] of expectations) {
      if (!existsSync(path)) continue;
      const artifact = readJson(path);
      expect(artifact.production_deploy_executed, path).toBe(false);
      expect(artifact.lifecycle_stage, path).toBe(stage);
      expect(artifact.lifecycle_note, path).toMatch(/pre-execution template/);
      expect(artifact.lifecycle_note, path).toMatch(/mainnet_genesis_verify_report\.json/);
    }
  });

  it('keeps post-pool commands out of pre-PWA production release gates', () => {
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
      const text = readText(doc.file);
      const before = sectionAfterHeading(text, doc.beforeHeading);
      const post = sectionAfterHeading(text, doc.postHeading);

      expect(before, doc.file).not.toBeNull();
      expect(post, doc.file).not.toBeNull();
      for (const command of POST_POOL_COMMANDS) {
        expect(before, `${doc.file} before section`).not.toContain(command);
        expect(post, `${doc.file} post section`).toContain(command);
      }
    }
  });
});
