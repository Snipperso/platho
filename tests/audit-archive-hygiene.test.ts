import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('audit archive hygiene', () => {
  it('ARCHIVE-HYGIENE-01: Larisa audit archive uses git allow-list and forbidden path guard', () => {
    const script = readFileSync('scripts/create_larisa_audit_archive.ps1', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const gitignore = readFileSync('.gitignore', 'utf8');
    const checklist = readFileSync('MAINNET_RELEASE_CHECKLIST.md', 'utf8');
    const runbook = readFileSync('DEPLOYMENT_RUNBOOK.md', 'utf8');

    expect(packageJson.scripts['audit:archive']).toMatch(/create_larisa_audit_archive\.ps1/);
    expect(script).toMatch(/git -C \$root ls-files --cached --others --exclude-standard/);
    expect(script).toMatch(/Test-ForbiddenArchivePath/);
    expect(script).toMatch(/\$safeLocalArtifactPaths/);
    expect(script).toMatch(/Assert-SafeLocalArtifactContent/);
    expect(script).toMatch(/Test-JsonObjectForSensitiveLocalFields/);
    expect(script).toMatch(/production_deploy_executed=false/);
    expect(script).toMatch(/mnemonic\|private\[_ -\]\?key\|secret\[_ -\]\?key\|seed\[_ -\]\?phrase/);
    expect(script).toMatch(/artifacts\/local\/mainnet_final_manifest_draft\.json/);
    expect(script).toMatch(/artifacts\/local\/mainnet_deploy_packet\.json/);
    expect(script).toMatch(/artifacts\/local\/mainnet_tx_dry_run_packet\.json/);
    expect(script).toMatch(/\^artifacts\/local\(\/\|\$\)/);
    expect(script).toMatch(/\.edge-smoke/);
    expect(script).toMatch(/Default\/Login Data/);
    expect(script).toMatch(/Default\/Network\/Cookies/);
    expect(script).toMatch(/IndexedDB/);
    expect(script).toMatch(/Local Storage/);
    expect(script).toMatch(/Session Storage/);
    expect(script).toMatch(/Local State/);
    expect(script).toMatch(/Secure Preferences/);
    expect(script).toMatch(/artifacts\/.*\\\.zip/);
    expect(script).toMatch(/\.env\.testnet\.example/);
    expect(script).toMatch(/Remove-Item -LiteralPath \$resolvedOutput/);
    expect(gitignore).toMatch(/artifacts\/platho_larisa_audit\*\.zip/);
    expect(checklist).toMatch(/npm\.cmd run audit:archive/);
    expect(checklist).toMatch(/browser profiles, cookies, IndexedDB, Local Storage/);
    expect(runbook).toMatch(/npm\.cmd run audit:archive/);
    expect(runbook).toMatch(/archive hygiene guard/);
  });

  it('RUNBOOK-DEPLOY-01: deployment runbook lists every generated pre-seal binding message', () => {
    const runbook = readFileSync('DEPLOYMENT_RUNBOOK.md', 'utf8');
    const packet = JSON.parse(readFileSync('artifacts/local/mainnet_deploy_packet.json', 'utf8'));
    const bindingMessages = packet.phase_2_pre_seal_bindings
      .map((step: { message?: string }) => step.message)
      .filter(Boolean);

    expect(bindingMessages.length).toBeGreaterThan(0);
    for (const message of bindingMessages) {
      expect(runbook, message).toContain(`\`${message}\``);
    }
  });
});
