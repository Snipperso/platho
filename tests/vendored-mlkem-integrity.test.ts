import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


const VENDOR_ROOT = 'web/vendor/@noble';
const UPSTREAM_ROOT = 'node_modules/@noble';

function normalized(path: string): string {
  const source = readFileSync(path, 'utf8')
    .replace(/from '(?:\.\.\/)+(hashes|curves|post-quantum|ciphers)\//g, "from '@noble/$1/")
    .replace(/\r\n/g, '\n');
  return createHash('sha256').update(source).digest('hex');
}

function vendoredFiles(dir = VENDOR_ROOT, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) vendoredFiles(path, out);
    else if (name.endsWith('.js')) out.push(path);
  }
  return out;
}

describe('the vendored cryptography is upstream, unmodified', () => {
  it('VENDOR-01: every vendored @noble file matches node_modules apart from import paths', () => {
    const files = vendoredFiles();
    expect(files.length, 'the sweep must find the vendored crypto').toBeGreaterThan(40);

    const drifted: string[] = [];
    for (const vendored of files) {
      const upstream = vendored.replace(VENDOR_ROOT, UPSTREAM_ROOT);
      let upstreamHash: string;
      try {
        upstreamHash = normalized(upstream);
      } catch {
        drifted.push(`${vendored}: no upstream counterpart at ${upstream}`);
        continue;
      }
      if (normalized(vendored) !== upstreamHash) drifted.push(`${vendored}: code differs from upstream`);
    }
    expect(drifted, 'the cryptography that actually runs has been modified relative to the published package. Any '
      + `difference here is a change to the ciphers themselves:\n${drifted.join('\n')}`).toEqual([]);
  });

  it('VENDOR-02: the declared dependency is the version that was vendored', () => {
    const declared = JSON.parse(readFileSync('package.json', 'utf8')).dependencies['@noble/post-quantum'];
    const installed = JSON.parse(readFileSync('node_modules/@noble/post-quantum/package.json', 'utf8')).version;
    const vendoredPkg = JSON.parse(readFileSync(`${VENDOR_ROOT}/post-quantum/package.json`, 'utf8')).version;
    expect(vendoredPkg, `vendored ${vendoredPkg} vs installed ${installed} (declared ${declared}) — re-vendor or `
      + 'pin the dependency; the two must describe the same code').toBe(installed);
  });
});

describe('the vendored ML-KEM-768 behaves as FIPS-203 requires', () => {
  it('MLKEM-01: key, ciphertext and shared secret sizes are the standard ones', () => {
    const kp = ml_kem768.keygen();
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(kp.publicKey);
    expect(kp.publicKey.length, 'ML-KEM-768 public key').toBe(1184);
    expect(kp.secretKey.length, 'ML-KEM-768 secret key').toBe(2400);
    expect(cipherText.length, 'ML-KEM-768 ciphertext').toBe(1088);
    expect(sharedSecret.length, 'shared secret').toBe(32);
    expect(Buffer.from(ml_kem768.decapsulate(cipherText, kp.secretKey)).toString('hex'),
      'encapsulate/decapsulate must agree').toBe(Buffer.from(sharedSecret).toString('hex'));
  });

  it('MLKEM-02: decapsulation rejects IMPLICITLY — the property the anonymity claim rests on', () => {
    const kp = ml_kem768.keygen();
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(kp.publicKey);
    const good = Buffer.from(sharedSecret).toString('hex');

    const tampered = Uint8Array.from(cipherText);
    tampered[7] ^= 1;

    let first: string | null = null;
    let second: string | null = null;
    expect(() => {
      first = Buffer.from(ml_kem768.decapsulate(tampered, kp.secretKey)).toString('hex');
      second = Buffer.from(ml_kem768.decapsulate(tampered, kp.secretKey)).toString('hex');
    }, 'a tampered ciphertext must NOT throw — an exception is a decryption oracle').not.toThrow();

    expect(first, 'implicit rejection must not return the true shared secret').not.toBe(good);
    expect(second, 'rejection must be deterministic: the same bad ciphertext always yields the same secret').toBe(first);

    const stranger = ml_kem768.keygen();
    const cross = Buffer.from(ml_kem768.decapsulate(cipherText, stranger.secretKey)).toString('hex');
    expect(cross, 'a stranger must not recover the secret').not.toBe(good);
  });

  it('MLKEM-03: the rejection path costs the same as the success path (gross-asymmetry smoke check)', () => {
    const kp = ml_kem768.keygen();
    const { cipherText } = ml_kem768.encapsulate(kp.publicKey);
    const tampered = Uint8Array.from(cipherText);
    tampered[7] ^= 1;

    const valid: number[] = [];
    const invalid: number[] = [];
    for (let i = 0; i < 120; i++) {
      let start = process.hrtime.bigint();
      ml_kem768.decapsulate(cipherText, kp.secretKey);
      valid.push(Number(process.hrtime.bigint() - start));
      start = process.hrtime.bigint();
      ml_kem768.decapsulate(tampered, kp.secretKey);
      invalid.push(Number(process.hrtime.bigint() - start));
    }
    const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
    const ratio = median(invalid) / median(valid);
    expect(ratio, `rejection took ${ratio.toFixed(3)}x the time of success — a shortcut on the failure path turns `
      + 'implicit rejection back into a distinguisher').toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(2.5);
  }, 60_000);
});
