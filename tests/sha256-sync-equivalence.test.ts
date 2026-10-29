import { describe, expect, it } from 'vitest';
import { sha256Sync } from '../web/crypto/platho-crypto.mjs';
import { computeCellHashAndDepth, beginCell } from '../web/pwa-contract-transactions.mjs';
import { introShardAddress, recordShardAddress, recoveryShardAddress } from '../web/shard-discovery.mjs';


const platformSha256 = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const CONV_PIN = 'EQBdwa3Wtvv7O0UuR8DMWMlC3VVuVwinJ45EsDOo8R90V04y';
const RECOVERY_PIN = 'EQDuZ-39o5GPFfXMON1WRCmDA8M4Yo77LUTY02rLK9ai31F5';

describe('SHA256-SYNC', () => {
  it('SHA-01: identical to crypto.subtle across empty, block-boundary and cell-preimage sizes', async () => {
    const sizes = [0, 1, 31, 32, 55, 56, 63, 64, 65, 71, 119, 120, 127, 128, 1000];
    for (const n of sizes) {
      const input = new Uint8Array(n);
      for (let i = 0; i < n; i += 1) input[i] = (i * 131 + n) & 0xff;
      expect(hex(sha256Sync(input)), `size ${n}`).toBe(hex(await platformSha256(input)));
    }
  });

  it('SHA-02: the CELL hasher agrees with a crypto.subtle-derived hash, on real shard init data', async () => {
    for (const [epoch, bucket] of [[20700n, 0n], [20700n, 1023n], [0n, 0n], [99999n, 7n]]) {
      const cell = beginCell().uint(epoch, 32, 'epoch').uint(bucket, 32, 'bucket').endCell();
      const { hash } = await computeCellHashAndDepth(cell);
      const repr = new Uint8Array([0x00, 0x10, ...new Uint8Array(8)]);
      const view = new DataView(repr.buffer);
      view.setUint32(2, Number(epoch));
      view.setUint32(6, Number(bucket));
      expect(hex(hash), `epoch ${epoch} bucket ${bucket}`).toBe(hex(await platformSha256(repr)));
    }
  });

  it('SHA-03: the derived addresses themselves are unchanged — the values that decide delivery', async () => {
    expect(await introShardAddress(20700, 7)).toBe('EQB2wlJoZ7laXDFy5PBPQ393ZqhxQjhS-RVxgFJ0fQGYkD6S');
    expect(await recordShardAddress(12345n, 20700)).toBe(CONV_PIN);
    expect(await recoveryShardAddress(999n)).toBe(RECOVERY_PIN);
  });
});
