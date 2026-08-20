import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RECIPIENT_NOT_ACTIVATED,
  isKeyShardAbsentError,
  resolveRecipientBundleByWallet,
} from '../web/conv-reply-bundle.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// "not sent: TON RPC get-method exit code -13"
//
// What the owner's user actually saw, 2026-08-20, twice, after picking an image and pressing send. The recipient
// had never opened Platho, so their KeyShard was never deployed, so the get-method aborted — and the status line
// printed the transport's words at a person who had done nothing wrong and could not act on them.
//
// Three separate faults in one line: the reason was unreadable, the send retried a question already answered, and
// the app knew perfectly well what -13 means (its own shard readers treat it as ABSENCE everywhere else).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const i18n = readFileSync('web/i18n-strings.mjs', 'utf8');

const shardView = { /* never reached in these cases */ };
const providerThrowing = (error: any) => ({ getView: async () => { throw error; } });
const withExit = (exitCode: number) => Object.assign(new Error(`TON RPC get-method exit code ${exitCode}`), { exitCode });

describe('NOTACTIVATED — a recipient who never set Platho up is an answer, not a crash', () => {
  it('NOTACT-01: mainnet -13 and sandbox -256 both mean absence', () => {
    expect(isKeyShardAbsentError(withExit(-13))).toBe(true);
    expect(isKeyShardAbsentError(withExit(-256))).toBe(true);
    // Prose-only carriers still count — some transports lose the field.
    expect(isKeyShardAbsentError(new Error('TON RPC get-method exit code -13'))).toBe(true);
  });

  it('NOTACT-02: a transport failure is NEVER read as absence', () => {
    // Calling a blip "this person does not exist" is a confident lie about a live account, and the user would be
    // told to go badger a friend who is already on Platho.
    for (const error of [
      Object.assign(new Error('HTTP 404'), { status: 404 }),
      Object.assign(new Error('HTTP 500'), { status: 500 }),
      new Error('network timeout'),
      Object.assign(new Error('TON RPC get-method exit code 4'), { exitCode: 4 }),
      Object.assign(new Error('rate limited'), { status: 429 }),
    ]) {
      expect(isKeyShardAbsentError(error), String(error.message)).toBe(false);
    }
  });

  it('NOTACT-03: the resolver converts absence into the code the UI matches on', async () => {
    await expect(resolveRecipientBundleByWallet({ provider: providerThrowing(withExit(-13)), wallet: '0:ab' }))
      .rejects.toMatchObject({ code: RECIPIENT_NOT_ACTIVATED });
    // …and passes everything else through untouched, so a real fault keeps its own diagnosis.
    const boom = Object.assign(new Error('HTTP 503'), { status: 503 });
    await expect(resolveRecipientBundleByWallet({ provider: providerThrowing(boom), wallet: '0:ab' }))
      .rejects.toBe(boom);
    expect(shardView).toBeDefined();
  });

  it('NOTACT-04: the status line says it in the user language, ABOVE the raw TON RPC passthrough', () => {
    const fn = app.slice(app.indexOf('function privateSendPreflightStatusText'));
    const body = fn.slice(0, fn.indexOf('function privateSendBlockedStatusText'));
    const typed = body.indexOf('RECIPIENT_NOT_ACTIVATED');
    const passthrough = body.indexOf('/TON RPC|sendBoc transport');
    expect(typed).toBeGreaterThan(-1);
    expect(passthrough).toBeGreaterThan(-1);
    // Order IS the fix: below the passthrough, the exit code would still be what the user reads.
    expect(typed).toBeLessThan(passthrough);
    expect(body).toContain("t('chat.recipientNotActivated')");
  });

  it('NOTACT-05: every locale carries the string', () => {
    const hits = [...i18n.matchAll(/"chat\.recipientNotActivated":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(hits.length, 'one per locale').toBe(10);
    expect(new Set(hits).size, 'ten distinct translations, not nine copies of English').toBe(10);
  });

  it('NOTACT-06: the send does not retry a question already answered', () => {
    const fatal = app.slice(app.indexOf('function isFatalPrivateSendError'));
    expect(fatal.slice(0, 1400)).toContain('RECIPIENT_NOT_ACTIVATED');
  });
});
