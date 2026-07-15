import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// clean-16 Фаза 4 · ИНК2 — header0 shape fork (tests-first). GENESIS-WIRE CHANGE.
//
// The pre-clean-16 private lane pinned a single 1120-bit (140-byte, 2-cell, 1-ref) header0 carrying sender +
// recipient keyIds. clean-16 splits the private lane by shape: the CONV lane (publish_kind=PRIVATE, the
// ordinary-conversation lane) carries a 320-bit (40-byte) header0 = meta(64) + opaque bucketKey(256); the
// INTRO lane (first contact, wired in ИНК4) carries 336 bits (42 bytes). Both are ONE cell, ZERO refs (each
// fits a single 1023-bit cell). ИНК2 replaces the private path's shape validation with the 320-bit CONV shape
// and reserves the 336-bit INTRO pin; the receive path fails CLOSED (13514) on any other size. RECOVERY (ИНК6)
// reuses the CONV 320-bit shape. The 784-bit part frame + refs 3/4 and header1=240 are UNTOUCHED.
//
// A mistake here is baked into immutable genesis: a wrong shape pin rejects every message of that class forever.

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');
const VAULT = readFileSync(join('contracts', 'Vault.tact'), 'utf8');

describe('CapsuleHub/Vault header0 shape fork (clean-16 Фаза 4 ИНК2)', () => {
  it('HEADER0-FORK-01: the monolithic 1120-bit private header0 pin is removed from both contracts', () => {
    // The old 1120-bit / 2-cell / 1-ref shape must NOT survive anywhere. It is the pre-clean-16 wire and
    // orphans every clean-16 capsule if it reaches genesis.
    expect(HUB, 'Hub: no 1120-bit private header0 pin').not.toMatch(/CAPSULEHUB_PRIVATE_HEADER0_BITS/);
    expect(VAULT, 'Vault: no 1120-bit private header0 pin').not.toMatch(/CAPSULEHUB_PRIVATE_HEADER0_BITS/);
    expect(HUB, 'Hub: no residual 1120 literal').not.toMatch(/=\s*1120\b/);
    expect(VAULT, 'Vault: no residual 1120 literal').not.toMatch(/=\s*1120\b/);
  });

  it('HEADER0-FORK-02: CONV=320 and INTRO=336 header0 pins exist in both contracts', () => {
    for (const [name, src] of [['Hub', HUB], ['Vault', VAULT]] as const) {
      expect(src, `${name}: CONV header0 = 320 bits`).toMatch(/CAPSULEHUB_CONV_HEADER0_BITS:\s*Int\s*=\s*320\b/);
      expect(src, `${name}: INTRO header0 = 336 bits`).toMatch(/CAPSULEHUB_INTRO_HEADER0_BITS:\s*Int\s*=\s*336\b/);
    }
  });

  it('HEADER0-FORK-03: the private header0 is now one cell with zero refs (was 2 cells / 1 ref)', () => {
    for (const [name, src] of [['Hub', HUB], ['Vault', VAULT]] as const) {
      expect(src, `${name}: header0 CELLS = 1`).toMatch(/CAPSULEHUB_PRIVATE_HEADER0_CELLS:\s*Int\s*=\s*1\b/);
      expect(src, `${name}: header0 REFS = 0`).toMatch(/CAPSULEHUB_PRIVATE_HEADER0_REFS:\s*Int\s*=\s*0\b/);
    }
  });

  it('HEADER0-FORK-04: the Hub receive path validates the CONV 320-bit header0 (fail-closed 13513/13514)', () => {
    // The private-branch exact-cell check must now bind CAPSULEHUB_CONV_HEADER0_BITS, so a 1120- or 336-bit
    // header0 arriving under publish_kind=PRIVATE fails computeDataSize.bits != 320 -> throw 13514.
    expect(HUB).toMatch(/requireExactPayloadCell\(header0,\s*h0,\s*CAPSULEHUB_PRIVATE_HEADER0_CELLS,\s*CAPSULEHUB_CONV_HEADER0_BITS,\s*CAPSULEHUB_PRIVATE_HEADER0_REFS,\s*13513,\s*13514\)/);
  });

  it('HEADER0-FORK-05: Vault renames the private shape validator to isConvCapsuleShapeValid(320)', () => {
    // The Vault walk validator for the private (CONV) lane must bind the CONV 320-bit shape, not the old 1120.
    expect(VAULT, 'isConvCapsuleShapeValid defined').toMatch(/fun isConvCapsuleShapeValid\(/);
    expect(VAULT, 'old isPrivateCapsuleShapeValid renamed away').not.toMatch(/isPrivateCapsuleShapeValid/);
    const fn = VAULT.match(/fun isConvCapsuleShapeValid\([\s\S]*?\n {4}\}/);
    expect(fn, 'isConvCapsuleShapeValid body').not.toBeNull();
    expect(fn![0], 'validator binds CONV 320-bit header0').toMatch(/CAPSULEHUB_CONV_HEADER0_BITS/);
  });

  it('HEADER0-FORK-06: the shared part frame (784 bits, refs 3/4) and header1 (240) are untouched', () => {
    // These belong to the single private frame shared by CONV/INTRO/RECOVERY and must NOT change in ИНК2.
    expect(HUB, 'Hub: part frame 784 intact').toMatch(/part\.bits\(\)\s*==\s*784/);
    expect(HUB, 'Hub: header1 240 intact').toMatch(/CAPSULEHUB_PRIVATE_HEADER1_BITS:\s*Int\s*=\s*240\b/);
    expect(VAULT, 'Vault: header1 240 intact').toMatch(/CAPSULEHUB_PRIVATE_HEADER1_BITS:\s*Int\s*=\s*240\b/);
  });
});
