import { describe, expect, it } from 'vitest';
import { sha256Sync } from '../web/crypto/platho-crypto.mjs';
import { computeCellHashAndDepth, beginCell } from '../web/pwa-contract-transactions.mjs';
import { introShardAddress, recordShardAddress, recoveryShardAddress } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHA256-SYNC — the client's cell hasher moved off crypto.subtle, and EVERY shard address depends on it.
//
// WHY IT MOVED [2026-08-28, owner's standing speed directive]: five modules each wrapped the ASYNCHRONOUS
// crypto.subtle.digest, and one of them sits on the hottest loop the client has — an intro sweep derives
// INTRO_READ_SPACE x epochs addresses, two cell hashes each. On a 71-byte cell preimage the per-call overhead
// of an async platform digest IS the cost: MEASURED over one sweep's 16,384 hashes, 240 ms via crypto.subtle
// against 15 ms with the vendored synchronous implementation. The whole sweep went 419 ms -> 147 ms.
//
// WHY THIS GATE EXISTS: a wrong address cannot be detected at send time. A message to an uninitialised account
// has its compute phase skipped, nothing is stored, no error is raised, and the wallet reports success. So a
// hash that is merely FASTER is worth nothing — it has to be the same bytes, always. This gate holds the two
// implementations against each other directly, on the shapes the derivation actually feeds them.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const platformSha256 = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

// The addresses these three derivations must keep producing. Pinned as literals so a change to the hasher, the
// cell encoder, the init-argument order or the address formatter is a red test rather than a silent redirection
// of every message to an account that does not exist.
const CONV_PIN = 'EQBdwa3Wtvv7O0UuR8DMWMlC3VVuVwinJ45EsDOo8R90V04y';
const RECOVERY_PIN = 'EQDuZ-39o5GPFfXMON1WRCmDA8M4Yo77LUTY02rLK9ai31F5';

describe('SHA256-SYNC', () => {
  it('SHA-01: identical to crypto.subtle across empty, block-boundary and cell-preimage sizes', async () => {
    // 71 bytes is the real StateInit preimage (2 descriptor + 1 data + 2 depths + 2 hashes); 55/56/64/65 and
    // 119/120 straddle SHA-256's 64-byte block and its length-padding boundary, where a wrong implementation
    // breaks and a right one does not.
    const sizes = [0, 1, 31, 32, 55, 56, 63, 64, 65, 71, 119, 120, 127, 128, 1000];
    for (const n of sizes) {
      const input = new Uint8Array(n);
      for (let i = 0; i < n; i += 1) input[i] = (i * 131 + n) & 0xff;
      expect(hex(sha256Sync(input)), `size ${n}`).toBe(hex(await platformSha256(input)));
    }
  });

  it('SHA-02: the CELL hasher agrees with a crypto.subtle-derived hash, on real shard init data', async () => {
    // Cell hashing is where it matters: this is the exact shape every shard address is built from.
    for (const [epoch, bucket] of [[20700n, 0n], [20700n, 1023n], [0n, 0n], [99999n, 7n]]) {
      const cell = beginCell().uint(epoch, 32, 'epoch').uint(bucket, 32, 'bucket').endCell();
      const { hash } = await computeCellHashAndDepth(cell);
      // Rebuild the same representation independently and hash it with the PLATFORM, not with our code.
      const repr = new Uint8Array([0x00, 0x10, ...new Uint8Array(8)]);
      const view = new DataView(repr.buffer);
      view.setUint32(2, Number(epoch));
      view.setUint32(6, Number(bucket));
      expect(hex(hash), `epoch ${epoch} bucket ${bucket}`).toBe(hex(await platformSha256(repr)));
    }
  });

  it('SHA-03: the derived addresses themselves are unchanged — the values that decide delivery', async () => {
    // ALL THREE PINNED [corrected 2026-08-29]. Two of these asserted `typeof === 'string'`, which is true of
    // every wrong answer as well: an auditor swapped the CONV init-arg order and added 1 to the RECOVERY bucket
    // key — every conversation and every seed backup addressed to an account that does not exist — and SHA-01..03
    // all passed. (The sibling files shard-browser-address and shard-discovery did catch it, so these lines were
    // redundant rather than load-bearing; the comment above claimed otherwise, which is the part that misleads.)
    expect(await introShardAddress(20700, 7)).toBe('EQB2wlJoZ7laXDFy5PBPQ393ZqhxQjhS-RVxgFJ0fQGYkD6S');
    expect(await recordShardAddress(12345n, 20700)).toBe(CONV_PIN);
    expect(await recoveryShardAddress(999n)).toBe(RECOVERY_PIN);
  });
});
