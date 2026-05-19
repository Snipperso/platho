import { describe, expect, it } from 'vitest';
import {
  createStaticWebDeployReport,
  selectStaticWebRuntimeFiles,
} from '../scripts/prepare_static_web_deploy.mjs';

const runtimeFiles = [
  { path: 'index.html', bytes: 11, sha256: 'a'.repeat(64) },
  { path: 'app.js', bytes: 13, sha256: 'b'.repeat(64) },
  { path: 'platho-config.mjs', bytes: 15, sha256: '0'.repeat(64) },
  { path: 'no-backend-transport.mjs', bytes: 16, sha256: '1'.repeat(64) },
  { path: 'transport-share.mjs', bytes: 17, sha256: '4'.repeat(64) },
  { path: 'encrypted-message-store.mjs', bytes: 18, sha256: '2'.repeat(64) },
  { path: 'vault-ton-rpc-provider.mjs', bytes: 20, sha256: '3'.repeat(64) },
  { path: 'sw.js', bytes: 17, sha256: 'c'.repeat(64) },
  { path: 'manifest.webmanifest', bytes: 19, sha256: 'd'.repeat(64) },
  { path: 'tonconnect-manifest.json', bytes: 23, sha256: 'e'.repeat(64) },
  { path: 'assets/platho-icon.png', bytes: 29, sha256: 'f'.repeat(64) },
];

const productionFindings = [
  {
    id: 'PWA_MODE_NOT_PRODUCTION',
    file: 'web/platho-config.mjs',
    message: 'PWA config is not in production mode.',
  },
  {
    id: 'PWA_NETWORK_NOT_MAINNET',
    file: 'web/platho-config.mjs',
    message: 'PWA config does not target mainnet.',
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
    tonConnectManifest: {
      url: 'https://platho.app',
      iconUrl: 'https://platho.app/assets/platho-icon.png',
    },
    webManifest: {
      start_url: './index.html',
      scope: './',
    },
    ...overrides,
  });
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
    expect(result.blockers).toContain('PWA_NETWORK_NOT_MAINNET');
  });

  it('WEB-DEPLOY-03: production package can be ready only after production findings are cleared', () => {
    const result = report({ mode: 'production', productionFindings: [] });

    expect(result.status).toBe('PRODUCTION_STATIC_PACKAGE_READY');
    expect(result.productionReady).toBe(true);
    expect(result.checks.productionMarkersCleared).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('WEB-DEPLOY-04: runtime selection excludes docs, local server, sourcemaps, and TypeScript sources', () => {
    const selected = selectStaticWebRuntimeFiles([
      'index.html',
      'encrypted-message-store.mjs',
      'no-backend-transport.mjs',
      'platho-config.mjs',
      'transport-share.mjs',
      'vault-ton-rpc-provider.mjs',
      'static-server.js',
      'CRYPTO_PROTOCOL.md',
      'preview-desktop.png',
      'crypto/platho-crypto.mjs',
      'crypto/platho-crypto.test.ts',
      'vendor/@noble/curves/ed25519.js',
      'vendor/@noble/curves/ed25519.js.map',
      'vendor/@noble/curves/ed25519.d.ts',
      'vendor/@noble/curves/src/ed25519.ts',
      'vendor/@noble/curves/LICENSE',
      'assets/platho-icon.png',
    ]);

    expect(selected).toEqual([
      'assets/platho-icon.png',
      'crypto/platho-crypto.mjs',
      'encrypted-message-store.mjs',
      'index.html',
      'no-backend-transport.mjs',
      'platho-config.mjs',
      'transport-share.mjs',
      'vault-ton-rpc-provider.mjs',
      'vendor/@noble/curves/LICENSE',
      'vendor/@noble/curves/ed25519.js',
    ]);
  });
});
