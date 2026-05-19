import { describe, expect, it } from 'vitest';
import {
  PLATHO_APP_CONFIG,
  PLATHO_APP_MODES,
  validatePlathoAppConfig,
} from '../web/platho-config.mjs';

const productionConfig = {
  mode: PLATHO_APP_MODES.PRODUCTION,
  domain: 'platho.app',
  network: {
    chain: 'mainnet',
    label: 'mainnet',
  },
  tonConnect: {
    manifestUrl: './tonconnect-manifest.json',
    expectedDomain: 'platho.app',
    expectedChain: '-239',
  },
  vault: {
    address: '0:1111111111111111111111111111111111111111111111111111111111111111',
    provider: {
      globalName: 'plathoVaultChainProvider',
      moduleUrl: './vault-ton-rpc-provider.mjs',
      exportName: 'default',
      requiredInProduction: true,
    },
  },
  crypto: {
    signedBundlePurpose: 'pwa-production',
  },
  ui: {
    brandNetworkLabel: 'mainnet',
    networkLabel: 'mainnet',
    walletLabel: 'wallet',
  },
  preview: {
    threads: [],
  },
};

describe('PWA runtime config guard', () => {
  it('PWA-CONFIG-01: default workspace config is explicitly non-production', () => {
    const report = validatePlathoAppConfig(PLATHO_APP_CONFIG);

    expect(report.ok).toBe(false);
    expect(report.mode).toBe(PLATHO_APP_MODES.PREVIEW);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_MODE_NOT_PRODUCTION');
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_NETWORK_NOT_MAINNET');
  });

  it('PWA-CONFIG-02: production config passes only with mainnet and provider module configured', () => {
    const report = validatePlathoAppConfig(productionConfig);

    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('PWA-CONFIG-03: production config rejects hidden testnet or preview strings', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      ui: {
        ...productionConfig.ui,
        networkLabel: 'testnet',
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_PRODUCTION_CONFIG_CONTAINS_NON_PROD_MARKERS');
  });

  it('PWA-CONFIG-04: production config requires a Vault provider entry', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      vault: {
        ...productionConfig.vault,
        provider: {
          globalName: null,
          moduleUrl: null,
          requiredInProduction: true,
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_VAULT_CHAIN_PROVIDER_REQUIRED');
  });

  it('PWA-CONFIG-05: TON Connect expectedChain must match the configured network', () => {
    const report = validatePlathoAppConfig({
      ...productionConfig,
      tonConnect: {
        ...productionConfig.tonConnect,
        expectedChain: '-3',
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.id)).toContain('PWA_TONCONNECT_CHAIN_MISMATCH');
  });
});
