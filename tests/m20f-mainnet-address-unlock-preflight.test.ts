import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createM20FMainnetAddressUnlockPreflight } from '../scripts/m20f_mainnet_address_unlock_preflight';

function fixtureRoot(label: string) {
  const root = join(tmpdir(), `platho-m20f-address-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(root, 'contracts'), { recursive: true });
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  return root;
}

function writeM20TEvidence(root: string) {
  writeFileSync(join(root, 'artifacts', 'm20t_testnet_evidence.json'), JSON.stringify({
    status: 'LIVE_TESTNET_M20T_HARNESS_PASS',
    network: 'testnet',
    notMainnetRouteFreeze: true,
    notProductionBuybackBurnUnlock: true,
    productionFlagsRemainFalse: true,
  }));
}

function writeConfig(root: string, project: any) {
  writeFileSync(join(root, 'tact.config.json'), JSON.stringify({ projects: [project] }, null, 2));
}

describe('M20F mainnet address unlock preflight', () => {
  it('reports the current real blocker when production BuybackBurn is missing', () => {
    const root = fixtureRoot('missing-contract');
    try {
      writeM20TEvidence(root);
      writeFileSync(join(root, 'contracts', 'M20TBuybackBurnHarness.tact'), '// harness only\n');
      writeConfig(root, {
        name: 'M20TBuybackBurnHarness',
        path: 'contracts/M20TBuybackBurnHarness.tact',
        output: 'build/M20TBuybackBurnHarness',
      });

      const report = createM20FMainnetAddressUnlockPreflight({
        projectRoot: root,
        artifactsDir: join(root, 'artifacts'),
      });

      expect(report.status).toBe('BLOCKED_PRODUCTION_BUYBACKBURN_CONTRACT_MISSING');
      expect(report.address_unlock_ready).toBe(false);
      expect(report.production_buyback_burn_unlocked).toBe(false);
      expect(report.blockers).toContain('PRODUCTION_BUYBACKBURN_CONTRACT_MISSING');
      expect(report.blockers).toContain('TACT_CONFIG_MISSING_PRODUCTION_BUYBACKBURN_PROJECT');
      expect(report.production_buyback_burn_contract.harnessSourceExists).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects selecting a testnet harness as production BuybackBurn', () => {
    const root = fixtureRoot('harness-selected');
    try {
      writeM20TEvidence(root);
      writeFileSync(join(root, 'contracts', 'BuybackBurn.tact'), '// production candidate\n');
      writeConfig(root, {
        name: 'BuybackBurn',
        path: 'contracts/M20TBuybackBurnHarness.tact',
        output: 'build/M20TBuybackBurnHarness',
      });
      mkdirSync(join(root, 'build', 'M20TBuybackBurnHarness'), { recursive: true });
      writeFileSync(join(root, 'build', 'M20TBuybackBurnHarness', 'BuybackBurn_BuybackBurn.code.boc'), 'fixture');

      const report = createM20FMainnetAddressUnlockPreflight({
        projectRoot: root,
        artifactsDir: join(root, 'artifacts'),
      });

      expect(report.status).toBe('BLOCKED_TESTNET_HARNESS_SELECTED_AS_PRODUCTION');
      expect(report.blockers).toContain('TESTNET_BUYBACKBURN_HARNESS_SELECTED_AS_PRODUCTION');
      expect(report.address_unlock_ready).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a built production code BOC before address derivation', () => {
    const root = fixtureRoot('missing-build');
    try {
      writeM20TEvidence(root);
      writeFileSync(join(root, 'contracts', 'BuybackBurn.tact'), '// production candidate\n');
      writeConfig(root, {
        name: 'BuybackBurn',
        path: 'contracts/BuybackBurn.tact',
        output: 'build/BuybackBurn',
      });
      mkdirSync(join(root, 'build', 'BuybackBurn'), { recursive: true });

      const report = createM20FMainnetAddressUnlockPreflight({
        projectRoot: root,
        artifactsDir: join(root, 'artifacts'),
      });

      expect(report.status).toBe('BLOCKED_BUYBACKBURN_BUILD_ARTIFACT_MISSING');
      expect(report.blockers).toEqual(['BUYBACKBURN_BUILD_CODE_BOC_MISSING']);
      expect(report.production_buyback_burn_contract.buildCodeBocExists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows address derivation only when production source, config, build, and M20T evidence are all present', () => {
    const root = fixtureRoot('ready');
    try {
      writeM20TEvidence(root);
      writeFileSync(join(root, 'contracts', 'BuybackBurn.tact'), '// production candidate\n');
      writeConfig(root, {
        name: 'BuybackBurn',
        path: 'contracts/BuybackBurn.tact',
        output: 'build/BuybackBurn',
      });
      mkdirSync(join(root, 'build', 'BuybackBurn'), { recursive: true });
      writeFileSync(join(root, 'build', 'BuybackBurn', 'BuybackBurn_BuybackBurn.code.boc'), 'fixture');

      const report = createM20FMainnetAddressUnlockPreflight({
        projectRoot: root,
        artifactsDir: join(root, 'artifacts'),
      });

      expect(report.status).toBe('READY_FOR_MAINNET_ADDRESS_DERIVATION');
      expect(report.address_unlock_ready).toBe(true);
      expect(report.production_buyback_burn_unlocked).toBe(false);
      expect(report.blockers).toEqual([]);
      expect(report.production_buyback_burn_contract.buildCodeBocPath).toBe('build/BuybackBurn/BuybackBurn_BuybackBurn.code.boc');
      expect(report.requiredNextActions[0]).toContain('Derive the final mainnet BuybackBurn StateInit address');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
