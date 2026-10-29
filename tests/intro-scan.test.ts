import { describe, expect, it } from 'vitest';
import { x25519 } from '@noble/curves/ed25519.js';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';
import { scanIntros, scanIntroIndices } from '../web/intro-scan.mjs';


const bufToInt = (b: Uint8Array): bigint => BigInt('0x' + Buffer.from(b).toString('hex'));

async function introFor(recipientScanSec: Uint8Array, eph: { sec: Uint8Array; pub: Uint8Array }, commit: bigint) {
  const view_tag = BigInt(await computePrivateScanViewTag(recipientScanSec, bufToInt(eph.pub)));
  return { r: bufToInt(eph.pub), view_tag, body_commit: commit };
}

function x25519Key() {
  const sec = x25519.utils.randomSecretKey();
  return { sec, pub: x25519.getPublicKey(sec) };
}

describe('INTRO-SCAN — recipient finds their own intros, leak-free', () => {
  it('SCAN-01: the scan finds the intro addressed to the recipient', async () => {
    const me = x25519Key();
    const eph = x25519Key();
    const entry = await introFor(me.sec, eph, 0xAAAAn);
    const found = await scanIntros(me.sec, [entry]);
    expect(found.length).toBe(1);
    expect(found[0].body_commit).toBe(0xAAAAn);
  });

  it('SCAN-02: the recipient picks out their intro among many decoys addressed to OTHER recipients', async () => {
    const me = x25519Key();
    const mine = await introFor(me.sec, x25519Key(), 0x1234n);

    const entries: any[] = [];
    for (let i = 0; i < 100; i++) entries.push(await introFor(x25519Key().sec, x25519Key(), BigInt(i)));
    entries.push(mine);
    for (let i = 100; i < 200; i++) entries.push(await introFor(x25519Key().sec, x25519Key(), BigInt(i)));

    const idx = await scanIntroIndices(me.sec, entries);
    expect(idx).toContain(100);
    expect(idx.length).toBeLessThanOrEqual(2);
  }, 60_000);

  it('SCAN-03: an intro addressed to someone else is (essentially always) not a candidate for me', async () => {
    const me = x25519Key();
    const someoneElse = x25519Key();
    const theirIntro = await introFor(someoneElse.sec, x25519Key(), 0x9999n);
    const found = await scanIntros(me.sec, [theirIntro]);
    expect(found.length).toBe(0);
  });


  it('SCAN-04: a poisoned entry (r = 0) is skipped, and the genuine intro on the same page is still found', async () => {
    const me = x25519Key();
    const mine = await introFor(me.sec, x25519Key(), 0xBEEFn);

    const poison = { r: 0n, view_tag: 0n, body_commit: 0xDEADn };

    const found = await scanIntros(me.sec, [poison, mine]);
    expect(found.length, 'the genuine intro survives a poisoned page').toBe(1);
    expect(found[0].body_commit).toBe(0xBEEFn);

    const idx = await scanIntroIndices(me.sec, [poison, mine]);
    expect(idx, 'index scan skips the poison and points at the real entry').toEqual([1]);
  });

  it('SCAN-05: a page of NOTHING but degenerate points returns empty instead of throwing', async () => {
    const me = x25519Key();
    const lowOrder = [0n, 1n, 325606250916557431795983626356110631294008115727848805560023387167927233504n];
    const page = lowOrder.map((r, i) => ({ r, view_tag: 0n, body_commit: BigInt(i) }));
    await expect(scanIntros(me.sec, page)).resolves.toEqual([]);
  });

  it('SCAN-06: a broken environment still throws — the skip must not swallow real failures', async () => {
    const shortSecret = new Uint8Array(31);
    const entry = await introFor(x25519Key().sec, x25519Key(), 1n);
    await expect(scanIntros(shortSecret, [entry])).rejects.toThrow(/scanSecretKey/);
  });
});
