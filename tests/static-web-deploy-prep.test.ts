import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  createStaticWebDeployReport,
  selectStaticWebRuntimeFiles,
  scanProductionFindings,
} from '../scripts/prepare_static_web_deploy.mjs';

const runtimeFiles = [
  { path: 'index.html', bytes: 11, sha256: 'a'.repeat(64) },
  { path: 'app.js', bytes: 13, sha256: 'b'.repeat(64) },
  { path: 'platho-config.mjs', bytes: 15, sha256: '0'.repeat(64) },
  { path: 'capsule-part-policy.mjs', bytes: 17, sha256: '8'.repeat(64) },
  { path: 'message-pricing-policy.mjs', bytes: 17, sha256: '9'.repeat(64) },
  { path: 'public-channel-subscriptions.mjs', bytes: 17, sha256: '5'.repeat(64) },
  { path: 'recipient-identities.mjs', bytes: 17, sha256: '7'.repeat(64) },
  { path: 'channels/platho.app/feed.json', bytes: 17, sha256: '6'.repeat(64) },
  { path: 'encrypted-message-store.mjs', bytes: 18, sha256: '2'.repeat(64) },
  { path: 'pwa-contract-transactions.mjs', bytes: 19, sha256: 'aa'.repeat(32) },
  { path: 'platho-wallet.mjs', bytes: 19, sha256: 'ab'.repeat(32) },
  { path: 'vault-ton-rpc-provider.mjs', bytes: 20, sha256: '3'.repeat(64) },
  { path: 'ton-dns-provider.mjs', bytes: 20, sha256: '4'.repeat(64) },
  { path: 'ath-ton-rpc-provider.mjs', bytes: 22, sha256: 'a2'.repeat(32) },
  { path: 'username-ton-rpc-provider.mjs', bytes: 23, sha256: 'a3'.repeat(32) },
  { path: 'qr-code.mjs', bytes: 24, sha256: 'a4'.repeat(32) },
  { path: 'sw.js', bytes: 17, sha256: 'c'.repeat(64) },
  { path: 'manifest.webmanifest', bytes: 19, sha256: 'd'.repeat(64) },
  { path: 'assets/platho-icon.png', bytes: 29, sha256: 'f'.repeat(64) },
];

const productionFindings = [
  {
    id: 'PWA_MODE_NOT_PRODUCTION',
    file: 'web/platho-config.mjs',
    message: 'PWA config is not in production mode.',
  },
];

function report(overrides = {}) {
  return createStaticWebDeployReport({
    mode: 'preview',
    domain: 'platho.app',
    outputDir: 'artifacts/platho-web-static-preview',
    files: runtimeFiles,
    excludedWebFiles: ['CRYPTO_PROTOCOL.md', 'static-server.js'],
    productionFindings,
    webManifest: {
      start_url: './index.html',
      scope: './',
    },
    ...overrides,
  });
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('static web deploy prep', () => {
  it('WEB-DEPLOY-01: preview package is explicit non-production but deployable as static files', () => {
    const result = report();

    expect(result.status).toBe('PREVIEW_STATIC_PACKAGE_READY');
    expect(result.productionReady).toBe(false);
    expect(result.noBackendRuntime).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toContain('STATIC_PACKAGE_IS_NON_PRODUCTION');
    expect(result.warnings).toContain('PWA_MODE_NOT_PRODUCTION');
    expect(result.checks.serverRuntimeIncluded).toBe(false);
  });

  it('WEB-DEPLOY-02: production package blocks on the same release blockers as preprod', () => {
    const result = report({ mode: 'production' });

    expect(result.status).toBe('BLOCKED_BY_PREPROD');
    expect(result.productionReady).toBe(false);
    expect(result.blockers).toContain('PWA_MODE_NOT_PRODUCTION');
    expect(result.blockers).not.toContain('PWA_NETWORK_NOT_MAINNET');
  });

  it('WEB-DEPLOY-03: production package can be ready only after production findings are cleared', () => {
    const result = report({ mode: 'production', productionFindings: [] });

    expect(result.status).toBe('PRODUCTION_STATIC_PACKAGE_READY');
    expect(result.productionReady).toBe(true);
    expect(result.checks.productionMarkersCleared).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('WEB-DEPLOY-04: runtime selection includes public docs and excludes top-level docs, local server, sourcemaps, and TypeScript sources', () => {
    const selected = selectStaticWebRuntimeFiles([
      'index.html',
      'encrypted-message-store.mjs',
      'platho-config.mjs',
      'capsule-part-policy.mjs',
      'message-pricing-policy.mjs',
      'platho-wallet.mjs',
      'ton-mnemonic-wordlist.mjs',
      'public-channel-subscriptions.mjs',
      'recipient-identities.mjs',
      'pwa-contract-transactions.mjs',
      'channels/platho.app/feed.json',
      'vault-ton-rpc-provider.mjs',
      'webp-encoder.mjs',
      'qr-code.mjs',
      'ton-dns-provider.mjs',
      'ath-ton-rpc-provider.mjs',
      'username-ton-rpc-provider.mjs',
      'static-server.js',
      'CRYPTO_PROTOCOL.md',
      'docs/about-platho.md',
      'docs/crypto-protocol.md',
      'docs/private-notes.txt',
      'preview-desktop.png',
      'crypto/platho-crypto.mjs',
      'crypto/platho-crypto.test.ts',
      'vendor/@noble/curves/ed25519.js',
      'vendor/@noble/curves/ed25519.js.map',
      'vendor/@noble/curves/ed25519.d.ts',
      'vendor/@noble/curves/src/ed25519.ts',
      'vendor/@noble/curves/LICENSE',
      'assets/platho-icon.png',
      'vendor/@jsquash/webp/codec/enc/webp_enc.js',
      'vendor/@jsquash/webp/codec/enc/webp_enc.wasm',
      'vendor/@jsquash/webp/codec/LICENSE.codec.md',
    ]);

    expect(selected).toEqual([
      'assets/platho-icon.png',
      'ath-ton-rpc-provider.mjs',
      'capsule-part-policy.mjs',
      'channels/platho.app/feed.json',
      'crypto/platho-crypto.mjs',
      'docs/about-platho.md',
      'docs/crypto-protocol.md',
      'encrypted-message-store.mjs',
      'index.html',
      'message-pricing-policy.mjs',
      'platho-config.mjs',
      'platho-wallet.mjs',
      'public-channel-subscriptions.mjs',
      'pwa-contract-transactions.mjs',
      'qr-code.mjs',
      'recipient-identities.mjs',
      'ton-dns-provider.mjs',
      'ton-mnemonic-wordlist.mjs',
      'username-ton-rpc-provider.mjs',
      'vault-ton-rpc-provider.mjs',
      'vendor/@jsquash/webp/codec/LICENSE.codec.md',
      'vendor/@jsquash/webp/codec/enc/webp_enc.js',
      'vendor/@jsquash/webp/codec/enc/webp_enc.wasm',
      'vendor/@noble/curves/LICENSE',
      'vendor/@noble/curves/ed25519.js',
      'webp-encoder.mjs',
    ]);
  });

  it('WEB-DEPLOY-05: stored static deploy prep artifacts match the current web runtime files', () => {
    for (const mode of ['preview', 'production']) {
      const artifact = JSON.parse(readFileSync(`artifacts/web_static_deploy_prep.${mode}.json`, 'utf8'));

      for (const file of artifact.runtime.files) {
        const path = `web/${file.path}`;
        expect(existsSync(path), path).toBe(true);
        expect(statSync(path).size, path).toBe(file.bytes);
        expect(sha256File(path), path).toBe(file.sha256);
      }
    }
  });

  it('WEB-DEPLOY-06: production crypto blocker is cleared from source and public runtime crypto docs', () => {
    const findings = scanProductionFindings(process.cwd()).filter(
      (finding) => finding.id === 'CRYPTO_PROD_REMAINING_WORK',
    );

    expect(findings).toEqual([]);
  });

  it('WEB-DEPLOY-07: static deploy script defaults to production prep and blocks non-ready production deploys', () => {
    const script = readFileSync('scripts/deploy_static_web.ps1', 'utf8');

    expect(script).toContain('[string] $Mode = "production"');
    expect(script).toContain('"--mode", $Mode, "--clean"');
    expect(script).toContain('$prep.mode -ne $Mode');
    expect(script).toContain('$Mode -eq "production" -and $prep.productionReady -ne $true');
  });
});
