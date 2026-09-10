import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir as tempRoot } from 'node:os';
import { join as joinPath } from 'node:path';
import { stalePrepFiles } from '../scripts/lib/deploy-prep-freshness.mjs';
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
  { path: 'ton-rpc-transport.mjs', bytes: 20, sha256: '3'.repeat(64) },
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
      'ton-rpc-transport.mjs',
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
      'ton-rpc-transport.mjs',
      'username-ton-rpc-provider.mjs',
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

  it('WEB-DEPLOY-08: the deploy refuses a prep older than web/ — the tarball is the snapshot, not the tree', () => {
    // [2026-09-08] Two source edits and a module bump went into web/ after the last prepare step, and the stand
    // deploy shipped the EARLIER bundle without a word: "deployed", said the log, while the stand still served the
    // old build id. Nothing in the deploy rebuilds anything — the tarball is made from the prepared directory —
    // and the only check on the prep was its mode.
    const script = readFileSync('scripts/deploy_static_web.mjs', 'utf8');
    expect(script).toContain("import { stalePrepFiles } from './lib/deploy-prep-freshness.mjs';");
    expect(script).toMatch(/const stale = stalePrepFiles\(prep\);\s*\n\s*if \(stale\.length > 0\) \{\s*\n\s*die\(/);
    // Refused BEFORE the tarball is built, not after a byte has left the machine.
    expect(script.indexOf('const stale = stalePrepFiles(prep);')).toBeLessThan(script.indexOf("spawnSync('tar', ['-cf'"));
    // The refusal names the way out — the prepare step, the same line the version guard prints.
    expect(script).toMatch(/deploy prep is older than web\/[\s\S]{0,400}npm run web:deploy:prepare/);

    // THE REAL FUNCTION AGAINST A REAL TREE: a record of two files, one edited after it was made, one removed.
    const dir = mkdtempSync(joinPath(tempRoot(), 'platho-prep-'));
    try {
      writeFileSync(joinPath(dir, 'a.js'), 'a');
      mkdirSync(joinPath(dir, 'sub'));
      writeFileSync(joinPath(dir, 'sub', 'b.css'), 'b');
      const listed = [
        { path: 'a.js', sha256: createHash('sha256').update('a').digest('hex') },
        { path: 'sub/b.css', sha256: createHash('sha256').update('b').digest('hex') },
      ];
      expect(stalePrepFiles({ runtime: { files: listed } }, dir)).toEqual([]);
      writeFileSync(joinPath(dir, 'a.js'), 'a, edited after the prep');
      const record = { runtime: { files: [...listed, { path: 'gone.svg', sha256: '00' }] } };
      expect(stalePrepFiles(record, dir)).toEqual(['a.js', 'gone.svg (missing)']);
      // No record, no verdict: a prep without a file list is the older format, and that is the mode check's job.
      expect(stalePrepFiles({}, dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
