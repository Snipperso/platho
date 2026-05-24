import { Cell } from '@ton/core';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildImplementedSubsetManifest, computeManifestCell } from './deployment_manifest_m15';

const M18_PROFILE = 'PLATHO.V1.M18.ARTIFACT_INTEGRITY_AND_REPRODUCIBILITY_LOCK';

const codeHashChecks: Array<{ key: string; buildDir: string; artifactName: string; artifactFile: string; manifestKey?: string }> = [
  { key: 'ATHMASTER_CODE_HASH', buildDir: 'ATHMaster', artifactName: 'ATHMaster_ATHMaster', artifactFile: 'ATHMASTER_CODE_HASH.txt', manifestKey: 'ath_master' },
  { key: 'ATH_WALLET_CODE_HASH', buildDir: 'ATHWallet', artifactName: 'ATHWallet_ATHWallet', artifactFile: 'ATH_WALLET_CODE_HASH.txt', manifestKey: 'ath_wallet' },
  { key: 'BUYBACKBURN_CODE_HASH', buildDir: 'BuybackBurn', artifactName: 'BuybackBurn_BuybackBurn', artifactFile: 'BUYBACKBURN_CODE_HASH.txt', manifestKey: 'buyback_burn' },
  { key: 'MARKET_STABILITY_SELLER_CODE_HASH', buildDir: 'MarketStabilitySeller', artifactName: 'MarketStabilitySeller_MarketStabilitySeller', artifactFile: 'MARKET_STABILITY_SELLER_CODE_HASH.txt', manifestKey: 'market_stability_seller' },
  { key: 'CAPSULEHUB_CODE_HASH', buildDir: 'CapsuleHub', artifactName: 'CapsuleHub_CapsuleHub', artifactFile: 'CAPSULEHUB_CODE_HASH.txt', manifestKey: 'capsulehub' },
  { key: 'FEEACCUMULATOR_CODE_HASH', buildDir: 'FeeAccumulator', artifactName: 'FeeAccumulator_FeeAccumulator', artifactFile: 'FEEACCUMULATOR_CODE_HASH.txt', manifestKey: 'fee_accumulator' },
  { key: 'PROFILE_REGISTRY_CODE_HASH', buildDir: 'ProfileRegistry', artifactName: 'ProfileRegistry_ProfileRegistry', artifactFile: 'PROFILE_REGISTRY_CODE_HASH.txt', manifestKey: 'profile_registry' },
  { key: 'VAULT_CODE_HASH', buildDir: 'Vault', artifactName: 'Vault_Vault', artifactFile: 'VAULT_CODE_HASH.txt', manifestKey: 'vault' },
  { key: 'USERNAME_NFT_ITEM_CODE_HASH', buildDir: 'UsernameNFTItem', artifactName: 'UsernameNFTItem_UsernameNFTItem', artifactFile: 'USERNAME_NFT_ITEM_CODE_HASH.txt', manifestKey: 'username_nft_item' },
  { key: 'USERNAME_REGISTRY_CODE_HASH', buildDir: 'UsernameRegistry', artifactName: 'UsernameRegistry_UsernameRegistry', artifactFile: 'USERNAME_REGISTRY_CODE_HASH.txt', manifestKey: 'username_registry' },
  { key: 'MOCK_VAULT_ATH_WALLET_CODE_HASH', buildDir: 'MockVaultAthWallet', artifactName: 'MockVaultAthWallet_MockVaultAthWallet', artifactFile: 'MOCK_VAULT_ATH_WALLET_CODE_HASH.txt' },
  { key: 'MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH', buildDir: 'MockUsernameNFTItemNoAck', artifactName: 'MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck', artifactFile: 'MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH.txt' },
];

const stableArtifacts = [
  'artifacts/CURRENT_CODE_HASHES.txt',
  'artifacts/ATHMASTER_CODE_HASH.txt',
  'artifacts/ATH_WALLET_CODE_HASH.txt',
  'artifacts/BUYBACKBURN_CODE_HASH.txt',
  'artifacts/MARKET_STABILITY_SELLER_CODE_HASH.txt',
  'artifacts/CAPSULEHUB_CODE_HASH.txt',
  'artifacts/FEEACCUMULATOR_CODE_HASH.txt',
  'artifacts/FEE_ACCUMULATOR_CODE_HASH.txt',
  'artifacts/PROFILE_REGISTRY_CODE_HASH.txt',
  'artifacts/VAULT_CODE_HASH.txt',
  'artifacts/USERNAME_NFT_ITEM_CODE_HASH.txt',
  'artifacts/USERNAME_REGISTRY_CODE_HASH.txt',
  'artifacts/ath_wallet_derivation_vectors.json',
  'artifacts/deployment_ath_wallet_binding_vectors.json',
  'artifacts/username_nft_item_vectors.json',
  'artifacts/username_registry_foundation_vectors.json',
  'artifacts/username_registry_mint_vectors.json',
  'artifacts/deployment_manifest_implemented_subset_m15.json',
  'artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt',
  'artifacts/m16_conformance_report.json',
  'artifacts/m17_gas_reserve_sanity_report.json',
  'artifacts/platho_v1_open_values_v0_18_artifact_integrity.md',
  'artifacts/SPEC_CHANGELOG_M18_ARTIFACT_INTEGRITY.md',
  'artifacts/platho_v1_open_values_v0_49_final_tokenomics_market_stability.md',
  'artifacts/MILESTONE_SUMMARY_M49_FINAL_TOKENOMICS_MARKET_STABILITY.md',
  'artifacts/SPEC_CHANGELOG_M49_FINAL_TOKENOMICS_MARKET_STABILITY.md',
  'artifacts/platho_v1_open_values_v0_50_market_stability_seller.md',
  'artifacts/MILESTONE_SUMMARY_M50_MARKET_STABILITY_SELLER.md',
  'artifacts/SPEC_CHANGELOG_M50_MARKET_STABILITY_SELLER.md',
];

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function readJson(path: string): any {
  return JSON.parse(readText(path));
}

function builtCodeHash(buildDir: string, artifactName: string): string {
  const boc = readFileSync(join('build', buildDir, `${artifactName}.code.boc`));
  return Cell.fromBoc(boc)[0].hash().toString('hex');
}

function parseKeyValueLines(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readText(path).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function normalize(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'generated_at' || key === 'generated_at_utc') {
        out[key] = 'DETERMINISTIC_ARTIFACT';
      } else {
        out[key] = normalize(value[key]);
      }
    }
    return out;
  }
  return value;
}

function stableStringify(value: any): string {
  return JSON.stringify(normalize(value), null, 2) + '\n';
}

function normalizedArtifactHash(path: string): string {
  if (path.endsWith('.json')) {
    return sha256(stableStringify(readJson(path)));
  }
  return sha256(readFileSync(path));
}

function allTrue(obj: Record<string, boolean>): boolean {
  return Object.values(obj).every(Boolean);
}

export type M18Report = {
  profile: string;
  status: 'PASS' | 'FAIL';
  contract_code_changed: boolean;
  functional_surface_added: boolean;
  checks: Record<string, boolean>;
  code_hashes: Record<string, { built: string; pinned: string; current_file: string | null; match: boolean }>;
  vector_checks: Record<string, boolean>;
  manifest: {
    stored_hash: string;
    rebuilt_hash: string;
    match: boolean;
    status: string;
    blockers_before_final_genesis: string[];
  };
  stable_artifact_lock: Record<string, string>;
  source_lock: Record<string, string>;
  notes: string[];
};

export async function runM18ArtifactIntegrity(writeArtifacts = true): Promise<M18Report> {
  const current = parseKeyValueLines('artifacts/CURRENT_CODE_HASHES.txt');
  const codeHashes: M18Report['code_hashes'] = {};

  for (const check of codeHashChecks) {
    const built = builtCodeHash(check.buildDir, check.artifactName);
    const pinned = readText(join('artifacts', check.artifactFile)).trim();
    const currentFileValue = current[check.key] ?? null;
    codeHashes[check.key] = {
      built,
      pinned,
      current_file: currentFileValue,
      match: built === pinned && currentFileValue === built,
    };
  }

  const athVectors = readJson('artifacts/ath_wallet_derivation_vectors.json');
  const deploymentAthVectors = readJson('artifacts/deployment_ath_wallet_binding_vectors.json');
  const nftVectors = readJson('artifacts/username_nft_item_vectors.json');
  const registryFoundationVectors = readJson('artifacts/username_registry_foundation_vectors.json');
  const registryMintVectors = readJson('artifacts/username_registry_mint_vectors.json');
  const m17Report = readJson('artifacts/m17_gas_reserve_sanity_report.json');

  const vectorChecks: Record<string, boolean> = {
    ath_wallet_vectors_use_current_wallet_hash: athVectors.ATH_WALLET_CODE_HASH === codeHashes.ATH_WALLET_CODE_HASH.built && athVectors.vectors.every((v: any) => v.ATH_WALLET_CODE_HASH === codeHashes.ATH_WALLET_CODE_HASH.built && v.match === true),
    deployment_ath_binding_uses_current_wallet_hash: deploymentAthVectors.ath_wallet_code_cell_hash === codeHashes.ATH_WALLET_CODE_HASH.built,
    username_nft_item_vectors_use_current_hash: nftVectors.username_nft_item_code_hash === codeHashes.USERNAME_NFT_ITEM_CODE_HASH.built,
    username_registry_foundation_vectors_use_current_hashes:
      registryFoundationVectors.ath_wallet_code_hash === codeHashes.ATH_WALLET_CODE_HASH.built &&
      registryFoundationVectors.username_nft_item_code_hash === codeHashes.USERNAME_NFT_ITEM_CODE_HASH.built &&
      registryFoundationVectors.username_registry_code_hash === codeHashes.USERNAME_REGISTRY_CODE_HASH.built,
    username_registry_mint_vectors_use_current_hashes:
      registryMintVectors.code_hashes.ath_wallet === codeHashes.ATH_WALLET_CODE_HASH.built &&
      registryMintVectors.code_hashes.username_nft_item === codeHashes.USERNAME_NFT_ITEM_CODE_HASH.built &&
      registryMintVectors.code_hashes.username_registry === codeHashes.USERNAME_REGISTRY_CODE_HASH.built,
    username_registry_mint_vectors_use_m13_ack_reserve: registryMintVectors.constants.USERNAME_ITEM_ACK_FORWARD_RESERVE_NANOTONS === '3000000',
    m17_gas_report_passes: m17Report.status === 'PASS' && m17Report.scenarios.every((s: any) => s.status === 'ok'),
  };

  const { manifest } = await buildImplementedSubsetManifest();
  const storedManifest = readJson('artifacts/deployment_manifest_implemented_subset_m15.json');
  const storedHash = readText('artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt').trim();
  const rebuiltHash = computeManifestCell({
    addresses: manifest.addresses,
    code_hashes: manifest.code_hashes,
    state_init_hashes: manifest.state_init_hashes,
    constants: manifest.constants,
    blockers_before_final_genesis: manifest.blockers_before_final_genesis,
  }).hash().toString('hex');

  const manifestChecks = {
    stored_json_equals_rebuilt_manifest: stableStringify(storedManifest) === stableStringify(manifest),
    stored_hash_matches_rebuilt_hash: storedHash === rebuiltHash && manifest.manifest_hash_hex === rebuiltHash,
    manifest_remains_non_final_with_blockers: manifest.status === 'IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS' && manifest.blockers_before_final_genesis.length > 0,
    manifest_code_hashes_match_build: codeHashChecks.filter((x) => x.manifestKey).every((x) => manifest.code_hashes[x.manifestKey!] === codeHashes[x.key].built),
  };

  const artifactLock: Record<string, string> = {};
  for (const artifact of stableArtifacts) {
    if (!existsSync(artifact)) {
      artifactLock[artifact] = 'MISSING';
    } else {
      artifactLock[artifact] = normalizedArtifactHash(artifact);
    }
  }

  const sourceLock: Record<string, string> = {};
  for (const dir of ['contracts', 'scripts', 'tests']) {
    for (const name of readdirSync(dir).filter((x) => x.endsWith('.tact') || x.endsWith('.ts') || x.endsWith('.js')).sort()) {
      const p = join(dir, name);
      sourceLock[p] = sha256(readFileSync(p));
    }
  }
  for (const p of ['package.json', 'package-lock.json', 'tact.config.json', 'vitest.all.config.ts', 'vitest.debug.config.ts']) {
    if (existsSync(p)) sourceLock[p] = sha256(readFileSync(p));
  }

  const checks: Record<string, boolean> = {
    all_code_hash_artifacts_match_build_and_current_file: Object.values(codeHashes).every((x) => x.match),
    fee_accumulator_duplicate_hash_artifacts_match: readText('artifacts/FEE_ACCUMULATOR_CODE_HASH.txt').trim() === readText('artifacts/FEEACCUMULATOR_CODE_HASH.txt').trim(),
    all_vector_artifacts_match_current_build_hashes: allTrue(vectorChecks),
    manifest_artifacts_match_rebuilt_manifest: allTrue(manifestChecks),
    all_stable_artifacts_present: Object.values(artifactLock).every((x) => x !== 'MISSING'),
  };

  const report: M18Report = {
    profile: M18_PROFILE,
    status: allTrue(checks) ? 'PASS' : 'FAIL',
    contract_code_changed: true,
    functional_surface_added: true,
    checks,
    code_hashes: codeHashes,
    vector_checks: vectorChecks,
    manifest: {
      stored_hash: storedHash,
      rebuilt_hash: rebuiltHash,
      match: allTrue(manifestChecks),
      status: manifest.status,
      blockers_before_final_genesis: manifest.blockers_before_final_genesis,
    },
    stable_artifact_lock: artifactLock,
    source_lock: sourceLock,
    notes: [
      'M50 adds the MarketStabilitySeller contract and refreshes the implemented-subset artifact lock accordingly.',
      'JSON artifact hashes are normalized by replacing generated_at/generated_at_utc with DETERMINISTIC_ARTIFACT and sorting object keys.',
      'This is an implemented-subset artifact integrity lock, not a final genesis manifest.',
    ],
  };

  if (writeArtifacts) {
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/m18_artifact_integrity_report.json', JSON.stringify(report, null, 2) + '\n');
    writeFileSync('artifacts/m18_artifact_lock.json', JSON.stringify({ profile: M18_PROFILE, stable_artifact_lock: artifactLock, source_lock: sourceLock }, null, 2) + '\n');
    writeFileSync('artifacts/MILESTONE_SUMMARY_M18_ARTIFACT_INTEGRITY.md', renderMarkdown(report));
  }

  if (report.status !== 'PASS') {
    throw new Error(`M18 artifact integrity failed: ${JSON.stringify({ checks, vectorChecks, manifestChecks }, null, 2)}`);
  }

  return report;
}

function renderMarkdown(report: M18Report): string {
  const lines: string[] = [];
  lines.push('# Platho M18 Artifact Integrity & Reproducibility Lock');
  lines.push('');
  lines.push(`Status: **${report.status}**`);
  lines.push('');
  lines.push('Scope: current implemented subset artifacts, including the M50 MarketStabilitySeller contract. This pass locks generated artifacts against the current build so stale vectors do not quietly survive into later milestones. Yes, apparently files can lie by omission too.');
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  for (const [k, v] of Object.entries(report.checks)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('## Vector checks');
  lines.push('');
  for (const [k, v] of Object.entries(report.vector_checks)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('## Manifest');
  lines.push('');
  lines.push(`- Stored hash: ${report.manifest.stored_hash}`);
  lines.push(`- Rebuilt hash: ${report.manifest.rebuilt_hash}`);
  lines.push(`- Match: ${report.manifest.match}`);
  lines.push(`- Status: ${report.manifest.status}`);
  lines.push('');
  lines.push('## Code hashes');
  lines.push('');
  lines.push('| Key | Built | Pinned | Match |');
  lines.push('|---|---|---|---|');
  for (const [k, v] of Object.entries(report.code_hashes)) {
    lines.push(`| ${k} | ${v.built} | ${v.pinned} | ${v.match} |`);
  }
  lines.push('');
  lines.push('## Remaining final-genesis blockers');
  lines.push('');
  for (const blocker of report.manifest.blockers_before_final_genesis) {
    lines.push(`- ${blocker}`);
  }
  lines.push('');
  return lines.join('\n');
}

if (require.main === module) {
  runM18ArtifactIntegrity(true)
    .then((report) => {
      console.log(JSON.stringify({ status: report.status, artifacts_locked: Object.keys(report.stable_artifact_lock).length }, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
