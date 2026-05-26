import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import {
  createM20FMainnetRouteFreezePreflight,
  isTestnetFriendlyAddress,
  M20FMainnetRouteFreezeInput,
} from '../scripts/m20f_mainnet_route_freeze_preflight';
import { deterministicAddress } from '../scripts/stonfi_v2_1_route_lib';

function address(label: string, testOnly = false, workchain = 0): string {
  return deterministicAddress(`M20F.${label}`, workchain).toString({ testOnly });
}

function completeInput(overrides: Partial<M20FMainnetRouteFreezeInput> = {}): M20FMainnetRouteFreezeInput {
  const base: M20FMainnetRouteFreezeInput = {
    document: 'PLATHO.V1.M20F_MAINNET_ROUTE_FREEZE_INPUT',
    network: 'mainnet',
    status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    addresses: {
      athMasterAddress: address('athMaster'),
      buybackBurnStateInitAddress: address('buybackBurn'),
      buybackBurnOfficialAthWalletAddress: address('buybackOfficialWallet'),
      stonfiRouterAddress: address('stonfiRouter'),
      stonfiPoolAddressTonAth: address('stonfiPoolTonAth'),
      stonfiAthSourceOwnerAddress: address('stonfiAthSourceOwner'),
      stonfiAthSourceWalletAddress: address('askJettonWallet'),
      stonfiPtonMasterAddress: address('ptonMaster'),
      stonfiPtonWalletAddress: address('ptonWallet'),
      askJettonWalletAddress: address('askJettonWallet'),
    },
    evidenceRefs: {
      athDeploymentManifest: 'sha256:ath-deployment-manifest-mainnet',
      buybackBurnStateInitVector: 'sha256:buyback-stateinit-mainnet',
      officialAthWalletDerivationVector: 'sha256:official-ath-wallet-mainnet',
      stonfiAthSourceWalletDerivationVector: 'sha256:stonfi-ath-source-wallet-mainnet',
      stonfiApiSimulationCapture: 'sha256:stonfi-api-simulation-mainnet',
      stonfiSdkOrApiTxParamsCapture: 'sha256:stonfi-sdk-tx-params-mainnet',
      routerPoolPtonCodeHashes: 'sha256:router-pool-pton-code-hashes-mainnet',
      successExcessProof: 'tx:success-excess-mainnet',
      minOutFailureRefundProof: 'tx:min-out-refund-mainnet',
      ptonRefundProof: 'tx:pton-refund-mainnet',
      bounceOrFailureBehaviorProof: 'tx:bounce-failure-mainnet',
    },
    safeValueBounds: {
      buybackRouteAthNotifyValueUpstreamNanotons: '40000000',
      vaultAthDepositOwnerRequestValueNanotons: '50000000',
      usernameMintOwnerRequestValueNanotons: '50000000',
      buybackRouteAthNotifyBoundaryProof: 'sha256:buyback-notify-boundary-mainnet',
      athNotifyOwnerRequestBoundaryProof: 'sha256:ath-notify-owner-boundary-mainnet',
    },
    m19fDossierPath: 'artifacts/stonfi_route_evidence_dossier_m19f.json',
  };

  return {
    ...base,
    ...overrides,
    addresses: { ...base.addresses, ...(overrides.addresses ?? {}) },
    evidenceRefs: { ...base.evidenceRefs, ...(overrides.evidenceRefs ?? {}) },
  };
}

function withM20TArtifact() {
  const dir = mkdtempSync(join(tmpdir(), 'platho-m20f-'));
  writeFileSync(join(dir, 'm20t_testnet_evidence.json'), JSON.stringify({
    status: 'LIVE_TESTNET_M20T_HARNESS_PASS',
    network: 'testnet',
    notMainnetRouteFreeze: true,
    notProductionBuybackBurnUnlock: true,
    productionFlagsRemainFalse: true,
  }));
  return dir;
}

describe('M20F mainnet STON.fi route-freeze preflight', () => {
  it('reports the exact missing mainnet inputs when no M20F input exists', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const report = createM20FMainnetRouteFreezePreflight({ artifactsDir, input: null, m19fRouteFreezeReady: false });

      expect(report.route_freeze_ready).toBe(false);
      expect(report.status).toBe('BLOCKED_MISSING_FINAL_MAINNET_INPUTS');
      expect(report.m20t.complete).toBe(true);
      expect(report.blockers).toContain('MISSING_FINAL_MAINNET_M20F_INPUTS');
      expect(report.blockers).toContain('M19F_ROUTE_EVIDENCE_DOSSIER_NOT_READY');
      expect(report.production_buyback_burn_unlocked).toBe(false);
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  it('rejects testnet-friendly addresses in a mainnet route-freeze input', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const testnetRouter = address('testnetRouter', true);
      const report = createM20FMainnetRouteFreezePreflight({
        artifactsDir,
        input: completeInput({ addresses: { stonfiRouterAddress: testnetRouter } as any }),
        m19fRouteFreezeReady: true,
      });

      expect(isTestnetFriendlyAddress(testnetRouter)).toBe(true);
      expect(report.status).toBe('BLOCKED_TESTNET_OR_NONPROD_INPUT');
      expect(report.rejectedNonProdInputs).toContain('stonfiRouterAddress');
      expect(report.route_freeze_ready).toBe(false);
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  it('rejects parseable masterchain addresses in a mainnet route-freeze input', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const masterchainRouter = address('masterchainRouter', false, -1);
      const report = createM20FMainnetRouteFreezePreflight({
        artifactsDir,
        input: completeInput({ addresses: { stonfiRouterAddress: masterchainRouter } as any }),
        m19fRouteFreezeReady: true,
      });

      expect(report.status).toBe('BLOCKED_TESTNET_OR_NONPROD_INPUT');
      expect(report.rejectedNonProdInputs).toContain('stonfiRouterAddress.workchain');
      expect(report.route_freeze_ready).toBe(false);
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  it('keeps M20F blocked until the M19F evidence dossier itself passes', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const report = createM20FMainnetRouteFreezePreflight({
        artifactsDir,
        input: completeInput(),
        m19fRouteFreezeReady: false,
      });

      expect(report.status).toBe('BLOCKED_M19F_DOSSIER_NOT_READY');
      expect(report.missingInputs).toEqual([]);
      expect(report.rejectedNonProdInputs).toEqual([]);
      expect(report.blockers).toEqual(['M19F_ROUTE_EVIDENCE_DOSSIER_NOT_READY']);
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  it('blocks final route input when buyback ATH notify value proof is below the safe upstream bound', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const report = createM20FMainnetRouteFreezePreflight({
        artifactsDir,
        input: completeInput({
          safeValueBounds: {
            ...completeInput().safeValueBounds,
            buybackRouteAthNotifyValueUpstreamNanotons: '35000000',
          },
        }),
        m19fRouteFreezeReady: true,
      });

      expect(report.route_freeze_ready).toBe(false);
      expect(report.status).toBe('BLOCKED_MISSING_FINAL_MAINNET_INPUTS');
      expect(report.missingInputs).toContain('buybackRouteAthNotifyValueUpstreamNanotons');
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  it('blocks final route input when owner-facing ATH notify request values are not full-path safe', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const report = createM20FMainnetRouteFreezePreflight({
        artifactsDir,
        input: completeInput({
          safeValueBounds: {
            ...completeInput().safeValueBounds,
            usernameMintOwnerRequestValueNanotons: '40000000',
          },
        }),
        m19fRouteFreezeReady: true,
      });

      expect(report.route_freeze_ready).toBe(false);
      expect(report.missingInputs).toContain('usernameMintOwnerRequestValueNanotons');
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });

  it('never treats route freeze as direct production BuybackBurn unlock', () => {
    const artifactsDir = withM20TArtifact();
    try {
      const report = createM20FMainnetRouteFreezePreflight({
        artifactsDir,
        input: completeInput(),
        m19fRouteFreezeReady: true,
      });

      expect(report.route_freeze_ready).toBe(true);
      expect(report.production_buyback_burn_unlocked).toBe(false);
    } finally {
      rmSync(artifactsDir, { recursive: true, force: true });
    }
  });
});
