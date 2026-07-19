import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contractAddress, beginCell, toNano } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { recordShardAddressBytes, introShardAddressBytes, recoveryShardAddressBytes, rawAddress } from '../web/shard-address.mjs';
import { renderShardCodeModule } from '../scripts/generate_shard_code.mjs';
// The recovery slot key is derived by THREE implementations that must agree — the browser hasher (read path), the
// @ton/core builder (write path), and the contract itself. ADDR-06 pins the first two against each other.
import { recoveryOwnerSlotKey, RECOVERY_MAX_SLOTS, addrKey } from '../web/shard-discovery.mjs';
import { selfRecoveryShardSpace } from '../web/conv-discovery.mjs';
import { buildRecoveryPublish } from '../web/publish-builder.mjs';
import { recoveryOwnerPublicKey } from '../web/crypto/conv-routing.mjs';

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

// The reference side derives STRAIGHT from the compiled Tact wrappers — deliberately not through
// web/shard-discovery.mjs, which is itself built on the browser derivation under test. Routing the reference
// through it would make this comparison circular and prove nothing.
const referenceIntro = async (epoch: number, bucket: number) =>
  contractAddress(0, await IntroShard.init(BigInt(epoch), BigInt(bucket))).toRawString();
const referenceRecord = async (key: bigint, epoch: number) =>
  contractAddress(0, await RecordShard.init(key, BigInt(epoch))).toRawString();
const referenceRecovery = async (slot: bigint) =>
  contractAddress(0, await RecoveryShard.init(slot)).toRawString();

describe('SHARD-BROWSER-ADDRESS — two implementations, one address', () => {
  it('ADDR-01: INTRO shard addresses match the reference for a wide spread of arguments', async () => {
    const cases: Array<[number, number]> = [
      [0, 0], [1, 0], [20718, 0], [20718, 1], [20718, 1023],
      [20718, 4095], [65535, 65535], [1, 999983], [20000, 7], [2 ** 31 - 1, 2 ** 20],
    ];
    for (const [epoch, bucket] of cases) {
      const reference = await referenceIntro(epoch, bucket);
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
        const reference = await referenceRecord(key, epoch);
        const browser = rawAddress(await recordShardAddressBytes(key, epoch));
        expect(browser, `CONV(${key.toString(16)}, ${epoch})`).toBe(reference);
      }
    }
  }, 120_000);

  it('ADDR-03: RECOVERY slot addresses match', async () => {
    for (const slot of [0n, 7n, (1n << 255n) + 12345n, (1n << 256n) - 1n]) {
      const reference = await referenceRecovery(slot);
      const browser = rawAddress(await recoveryShardAddressBytes(slot));
      expect(browser, `RECOVERY(${slot.toString(16)})`).toBe(reference);
    }
  }, 120_000);

  it('ADDR-06: the READ path and the WRITE path derive the SAME recovery slot key, at every index', async () => {
    // ADDR-03 compares the two ADDRESS derivations given a slot key. Nothing compared the derivation of the slot
    // key ITSELF — H(RS_SLOT_DOMAIN ‖ owner_pubkey ‖ slot_index) — and those are the two halves of one round trip:
    //
    //   WRITE: web/publish-builder.mjs (@ton/core)      -> where the blob is stored and paid for
    //   READ:  web/shard-discovery.mjs (browser hasher) -> where a restoring client looks for it
    //
    // A disagreement means the blob is written at one address and searched for at another. Nothing refuses: under
    // lazy deploy the read simply finds an empty account, which is the ordinary case, so the user is told they have
    // no recovery data rather than that something is wrong. Silent loss at restore is the exact failure the whole
    // lane exists to prevent, and it would surface years after the bug shipped.
    //
    // This was genuinely uncovered: mutating shard-discovery's slot_index width from 32 to 64 bits — which changes
    // every slot address, index 0 included — left the entire test suite green.
    const seed = new Uint8Array(32).fill(0x77);
    const ownerPub = await recoveryOwnerPublicKey(seed);

    for (const slotIndex of [0, 1, 2, 7, 42, 128, 255]) {
      const read = await recoveryOwnerSlotKey(ownerPub, slotIndex);
      const write = (await buildRecoveryPublish({
        seed, slotIndex, seq: 1, h0: 0x1n, h1: 0x2n,
        body: beginCell().storeUint(0xAB, 8).endCell(), value: toNano('0.05'),
      })).slotKey;
      expect(read, `slot ${slotIndex}: read path == write path`).toBe(write);
    }

    // and the probe space a restoring client walks is the same set of addresses, in index order
    const space = await selfRecoveryShardSpace(seed);
    expect(space.slots.length, 'the probe covers the whole legal range').toBe(RECOVERY_MAX_SLOTS);
    for (const idx of [0, 99, RECOVERY_MAX_SLOTS - 1]) {
      const built = await buildRecoveryPublish({
        seed, slotIndex: idx, seq: 1, h0: 0x1n, h1: 0x2n,
        body: beginCell().storeUint(0xAB, 8).endCell(), value: toNano('0.05'),
      });
      expect(space.slots[idx].slotKey, `probe slot ${idx} is where the writer writes`).toBe(built.slotKey);
      expect(addrKey(space.slots[idx].address)).toBe(addrKey(built.to));
    }
  }, 180_000);

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
