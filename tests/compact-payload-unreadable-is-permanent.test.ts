import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { beginCell } from '@ton/core';
import {
  encodeCompactPayload, decodeCompactPayload, PLATHO_CAPSULE_UNREADABLE_CODE,
  createEncryptedConvCapsule, createMessagingIdentity, exportPublicKeyBundle, openPrivateCapsuleChainEntry, randomBytes,
} from '../web/crypto/platho-crypto.mjs';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });


const APP = readFileSync('web/app.js', 'utf8');

function loadClassifier() {
  const mismatchAt = APP.indexOf('function isPrivateOpenKeyMismatchError(');
  const end = APP.indexOf('function privateSyncResult(');
  expect(mismatchAt, 'the classifiers must still be there').toBeGreaterThan(-1);
  expect(end, 'and the slice must end at privateSyncResult').toBeGreaterThan(mismatchAt);
  // eslint-disable-next-line no-new-func
  return new Function('PLATHO_CAPSULE_UNREADABLE_CODE', 'PLATHO_CAPSULE_CLOCK_SKEW_CODE', `
    ${APP.slice(mismatchAt, end)}
    return isPrivateUnreadableCapsuleError;
  `)(PLATHO_CAPSULE_UNREADABLE_CODE, 'PLATHO_CAPSULE_CLOCK_SKEW');
}

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

    const accepted = verdicts.filter((v) => !v.threw).map((v) => v.label);
    expect(accepted, `these broken payloads decoded without complaint:\n${accepted.join('\n')}`).toEqual([]);
    const retried = verdicts.filter((v) => !v.permanent).map((v) => `${v.label}: ${v.message}`);
    expect(retried, `these would be retried forever instead of skipped:\n${retried.join('\n')}`).toEqual([]);
    expect(verdicts.length).toBe(10);
  });

  it('CPUNREAD-02: a genuine transport failure is still TRANSIENT — the safe default is untouched', () => {
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
    const crypto = readFileSync('web/crypto/platho-crypto.mjs', 'utf8');
    expect(crypto).toContain("export const PLATHO_CAPSULE_UNREADABLE_CODE = 'PLATHO_CAPSULE_UNREADABLE';");
    expect(crypto).toContain('function decodeCompactPayloadBytesInner(bytesLike, options = {})');
    expect(crypto).toMatch(/if \(error && typeof error === 'object' && error\.code === undefined\) \{/);
    const classifier = APP.slice(APP.indexOf('function isPrivateUnreadableCapsuleError('));
    const codeAt = classifier.indexOf('error?.code === PLATHO_CAPSULE_UNREADABLE_CODE');
    const regexAt = classifier.indexOf('String(error?.message');
    expect(codeAt, 'the code check must be there').toBeGreaterThan(-1);
    expect(regexAt, 'the sentence check must still be there for older paths').toBeGreaterThan(-1);
    expect(codeAt, 'the code is consulted before the sentence').toBeLessThan(regexAt);
  });

  it('CPUNREAD-04: a body whose key agreement cannot run — a degenerate ephemeral point — is a permanent verdict too [audit 2026-09-23, round 5]', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built: any = await createEncryptedConvCapsule('hello', exportPublicKeyBundle(recipient.encryptionKeyPair), sender, randomBytes(32), {});
    const snakeBoc = (bytes: Uint8Array) => {
      const chunks: Uint8Array[] = [];
      for (let o = 0; o < bytes.length; o += 127) chunks.push(bytes.subarray(o, o + 127));
      let cell = beginCell().storeBuffer(Buffer.from(chunks[chunks.length - 1])).endCell();
      for (let i = chunks.length - 2; i >= 0; i -= 1) cell = beginCell().storeBuffer(Buffer.from(chunks[i])).storeRef(cell).endCell();
      return cell.toBoc().toString('base64');
    };
    const entryWith = (bodyBytes: Uint8Array) => ({ exists: true, header_0_boc: built.chainCells.header0.boc, header_1_boc: built.chainCells.header1.boc, body_boc: snakeBoc(bodyBytes) });
    const sound = Buffer.from(built.body.bodyBytes, 'base64url');
    const opened: any = await openPrivateCapsuleChainEntry(entryWith(new Uint8Array(sound)), recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext).toBe('hello');
    const hostile = new Uint8Array(sound);
    hostile.fill(0, 36, 68);
    let error: any = null;
    try { await openPrivateCapsuleChainEntry(entryWith(hostile), recipient.encryptionKeyPair, { enforceExpiry: false }); } catch (e) { error = e; }
    expect(error, 'it does not open').not.toBeNull();
    expect(error.code, 'and the verdict is tagged permanent').toBe(PLATHO_CAPSULE_UNREADABLE_CODE);
    expect(loadClassifier()(error), 'so the scan skips the row and moves the mark').toBe(true);
  });

});
