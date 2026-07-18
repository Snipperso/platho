import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { recordShardAddress, introShardAddress, recoveryShardAddress } from '../web/shard-discovery.mjs';
import { recordShardAddressBytes, introShardAddressBytes, recoveryShardAddressBytes, rawAddress } from '../web/shard-address.mjs';
import { renderShardCodeModule } from '../scripts/generate_shard_code.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-BROWSER-ADDRESS — the browser derives the SAME address as the reference implementation, or messages vanish.
//
// This is the correctness gate the clean-17 client rests on, and it exists because of one TON behaviour: shards
// are deployed lazily, so a message to a shard that does not exist yet is the NORMAL case, and such a message
// runs with its compute phase SKIPPED. No error, no bounce — the wallet reports success and the message is gone.
// A wrong address is therefore indistinguishable from a right one at send time. "It seemed to work" proves
// nothing here; only two independent implementations agreeing does.
//
// The reference path uses @ton/core and the compiled Tact wrappers, which cannot load in a browser. The browser
// path hand-rolls the same encoding on top of the client's own cell primitives. These tests pin them together.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const asRaw = (address: any) => address.toRawString();

describe('SHARD-BROWSER-ADDRESS — two implementations, one address', () => {
  it('ADDR-01: INTRO shard addresses match the reference for a wide spread of arguments', async () => {
    const cases: Array<[number, number]> = [
      [0, 0], [1, 0], [20718, 0], [20718, 1], [20718, 1023],
      [20718, 4095], [65535, 65535], [1, 999983], [20000, 7], [2 ** 31 - 1, 2 ** 20],
    ];
    for (const [epoch, bucket] of cases) {
      const reference = asRaw(await introShardAddress(epoch, bucket));
      const browser = rawAddress(await introShardAddressBytes(epoch, bucket));
      expect(browser, `INTRO(${epoch}, ${bucket})`).toBe(reference);
    }
  }, 120_000);

  it('ADDR-02: CONV shard addresses match, including full-width 256-bit write keys', async () => {
    // write_pubkey is a full ed25519 key, so this is where a naive 64-bit or hex-string derivation would break.
    const keys = [
      0n,
      1n,
      0xdeadbeefn,
      (1n << 255n),
      (1n << 256n) - 1n,
      BigInt('0x' + 'a3'.repeat(32)),
    ];
    for (const key of keys) {
      for (const epoch of [0, 20718]) {
        const reference = asRaw(await recordShardAddress(key, epoch));
        const browser = rawAddress(await recordShardAddressBytes(key, epoch));
        expect(browser, `CONV(${key.toString(16)}, ${epoch})`).toBe(reference);
      }
    }
  }, 120_000);

  it('ADDR-03: RECOVERY slot addresses match', async () => {
    for (const slot of [0n, 7n, (1n << 255n) + 12345n, (1n << 256n) - 1n]) {
      const reference = asRaw(await recoveryShardAddress(slot));
      const browser = rawAddress(await recoveryShardAddressBytes(slot));
      expect(browser, `RECOVERY(${slot.toString(16)})`).toBe(reference);
    }
  }, 120_000);

  it('ADDR-04: the browser refuses arguments it cannot encode instead of producing a wrong address', async () => {
    // Silently truncating an out-of-range value would produce a plausible address that nobody can ever read from.
    await expect(introShardAddressBytes(-1, 0)).rejects.toThrow();
    await expect(recoveryShardAddressBytes(1n << 256n)).rejects.toThrow();
  }, 60_000);

  it('ADDR-05: the checked-in code constants are exactly what build/ produces', () => {
    // web/shard-code.mjs carries the compiled code cells because the browser cannot import build/*.ts. If it goes
    // stale after a contract rebuild, every address it derives is wrong — and wrong addresses fail silently.
    const onDisk = readFileSync('web/shard-code.mjs', 'utf8');
    expect(onDisk.trim(), 'run: node scripts/generate_shard_code.mjs').toBe(renderShardCodeModule().trim());
  });
});
