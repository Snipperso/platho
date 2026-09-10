import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  encodeCompactPayload, decodeCompactPayload, PLATHO_CAPSULE_UNREADABLE_CODE,
} from '../web/crypto/platho-crypto.mjs';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A BODY THAT WILL NOT DECODE WILL NEVER DECODE — and until 2026-09-01 the CONV scan believed the opposite.
//
// [audit round 9.] The scan classifies a failed open as either PERMANENTLY unreadable (skip that entry, let the
// mark and the cursor move on) or TRANSIENT (bar the bucket, drop the lane's change marker, freeze the cursor,
// come back). The default is transient, deliberately and correctly: mistaking a network blip for a dead body
// would advance a cursor past a message that was readable, which is silent loss.
//
// But the verdict was reached by matching the error's ENGLISH SENTENCE against a list, and none of the compact
// payload layer's wordings were on it — the list knew `magic mismatch` while the throw says "Invalid Platho
// compact payload magic", and `compact body` while every one of these says "compact payload". MEASURED: 8 of 8
// real decode failures classified transient.
//
// What one such body then costs: the shard's whole history is re-fetched and every capsule in it re-decrypted on
// every 12-second pass, forever; the read window widens by an epoch a day to the 366-epoch cap; and the account
// never reports itself up to date again. It is not only a hostile peer's doing either — an unsupported VERSION or
// content TYPE is exactly what today's client throws on a message from tomorrow's.
//
// So the decoder tags what it raises, at the single door they all pass through, and the classifier reads the tag
// before it reads any sentence. This file drives the real encoder and the real decoder over the real mutations.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const APP = readFileSync('web/app.js', 'utf8');

/** isPrivateUnreadableCapsuleError and its helper, lifted verbatim out of app.js. */
function loadClassifier() {
  const mismatchAt = APP.indexOf('function isPrivateOpenKeyMismatchError(');
  const end = APP.indexOf('function privateSyncResult(');
  expect(mismatchAt, 'the classifiers must still be there').toBeGreaterThan(-1);
  expect(end, 'and the slice must end at privateSyncResult').toBeGreaterThan(mismatchAt);
  // eslint-disable-next-line no-new-func
  return new Function('PLATHO_CAPSULE_UNREADABLE_CODE', `
    ${APP.slice(mismatchAt, end)}
    return isPrivateUnreadableCapsuleError;
  `)(PLATHO_CAPSULE_UNREADABLE_CODE);
}

/** A real, valid compact payload — then broken one byte at a time. */
function validPayload() {
  return encodeCompactPayload({ type: 'text', text: 'hello' }, { partIndex: 0, partCount: 1 });
}

describe('COMPACT-UNREADABLE — a body that cannot be decoded is a permanent verdict, not a retry', () => {
  it('CPUNREAD-01: every decode failure carries the unreadable code', () => {
    const base = validPayload();
    const broken: Array<{ label: string; bytes: Uint8Array }> = [];
    const bend = (label: string, mutate: (b: Uint8Array) => void) => {
      const bytes = Uint8Array.from(base);
      mutate(bytes);
      broken.push({ label, bytes });
    };
    // The shapes measured on the shipping decoder, at the offsets its own reader uses (compactPayloadContent):
    // 0..3 magic, 4 version, 5 type, 6 flags, 8..23 streamId, 24..25 partIndex, 26..27 partCount,
    // 28..29 contentLength, 30..31 reserved.
    bend('magic broken', (b) => { b[0] ^= 0xff; });
    bend('version bumped', (b) => { b[4] = 0x7f; });
    bend('content type unknown', (b) => { b[5] = 0x40; });
    bend('flags unknown', (b) => { b[6] = 0xff; });
    bend('part count zero', (b) => { b[26] = 0; b[27] = 0; });
    bend('part index past the count', (b) => { b[24] = 0; b[25] = 9; });
    bend('content length absurd', (b) => { b[28] = 0xff; b[29] = 0xff; });
    bend('reserved byte set', (b) => { b[30] = 0x01; });
    bend('second reserved byte set', (b) => { b[31] = 0x01; });
    bend('tail padding dirtied', (b) => { b[b.length - 1] = 0x5a; });

    const isPrivateUnreadableCapsuleError = loadClassifier();
    const verdicts: Array<{ label: string; threw: boolean; permanent: boolean; message: string }> = [];
    for (const { label, bytes } of broken) {
      let threw = false; let permanent = false; let message = '';
      try {
        decodeCompactPayload(bytes);
      } catch (error: any) {
        threw = true;
        message = String(error?.message ?? error);
        permanent = isPrivateUnreadableCapsuleError(error) === true;
      }
      verdicts.push({ label, threw, permanent, message });
    }

    // Every mutation must be REJECTED — a decoder that accepts a broken body is a different (worse) defect.
    const accepted = verdicts.filter((v) => !v.threw).map((v) => v.label);
    expect(accepted, `these broken payloads decoded without complaint:\n${accepted.join('\n')}`).toEqual([]);
    // …and every rejection must be a PERMANENT verdict, or one body wedges the conversation for good.
    const retried = verdicts.filter((v) => !v.permanent).map((v) => `${v.label}: ${v.message}`);
    expect(retried, `these would be retried forever instead of skipped:\n${retried.join('\n')}`).toEqual([]);
    expect(verdicts.length).toBe(10);
  });

  it('CPUNREAD-02: a genuine transport failure is still TRANSIENT — the safe default is untouched', () => {
    // The direction that must never flip. Mistaking a blip for a dead body advances the cursor past a message
    // that was readable, and that is silent loss — strictly worse than the wedge this fix closes.
    const isPrivateUnreadableCapsuleError = loadClassifier();
    for (const error of [
      { code: 'TIMEOUT', message: 'request timed out' },
      { code: 'NETWORK_ERROR', message: 'failed to fetch' },
      { status: 503, message: 'HTTP 503 service unavailable' },
      { code: 'RATE_LIMITED', message: 'rpc busy, backoff' },
      { message: 'verification unavailable' },
    ]) {
      expect(isPrivateUnreadableCapsuleError(error), `${error.message} must stay transient`).toBe(false);
    }
  });

  it('CPUNREAD-03: the tag is applied at the decoder door, not sprinkled over its throws', () => {
    // 62 of the decoder's throws mention "compact payload" and there are 260 in the module; tagging them one by
    // one is how the next one gets forgotten. One try/catch at the single entry point covers them all, and it
    // must not overwrite a code an inner layer set deliberately.
    const crypto = readFileSync('web/crypto/platho-crypto.mjs', 'utf8');
    expect(crypto).toContain("export const PLATHO_CAPSULE_UNREADABLE_CODE = 'PLATHO_CAPSULE_UNREADABLE';");
    expect(crypto).toContain('function decodeCompactPayloadBytesInner(bytesLike, options = {})');
    expect(crypto).toMatch(/if \(error && typeof error === 'object' && error\.code === undefined\) \{/);
    // The classifier consults the code FIRST, before any sentence matching.
    const classifier = APP.slice(APP.indexOf('function isPrivateUnreadableCapsuleError('));
    const codeAt = classifier.indexOf('error?.code === PLATHO_CAPSULE_UNREADABLE_CODE');
    const regexAt = classifier.indexOf('String(error?.message');
    expect(codeAt, 'the code check must be there').toBeGreaterThan(-1);
    expect(regexAt, 'the sentence check must still be there for older paths').toBeGreaterThan(-1);
    expect(codeAt, 'the code is consulted before the sentence').toBeLessThan(regexAt);
  });
});
