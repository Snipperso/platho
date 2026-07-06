import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Ф6 — BEHAVIORAL coverage for the private/public publish double-spend gate.
//
// The audit flagged that runPrivatePublishConfirmationRetry / retryUnconfirmedPrivatePublishBroadcasts and the
// per-part re-sign predicates were guarded ONLY by source-string greps in pwa-runtime-config.test.ts: an edit that
// keeps the grepped literals but inverts a condition (mis-ordering the signed-part check, or letting an
// already-signed part take the fresh-nonce path) would stay green while enabling a double-publish = a double-spend
// of Vault GRAM + a duplicate airdrop credit.
//
// web/app.js is not importable (browser module, top-level browser globals), so this test EXTRACTS the actual pure
// predicate source from web/app.js by name (brace-balanced) and executes it against constructed part/publishState
// shapes. It exercises the REAL shipped code — invert a condition in app.js and this test goes red, unlike a grep.
//
// The core double-spend invariant under test: a part may take the FRESH-sign path (publishPartCanFreshSendRetry ===
// true) ONLY when it was never signed (no clientNonce, no externalBoc, no publishId) and is not already
// chain-attempted; every signed/attempted part is confined to the idempotent same-nonce re-broadcast lane.

const appJsPath = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'web', 'app.js');
const source = readFileSync(appJsPath, 'utf8');

// Extract a `function NAME(...) { ... }` block from source with balanced-brace matching (robust to reformatting).
function extractFunction(name: string): string {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`app.js: function ${name} not found`);
  let i = source.indexOf('{', start);
  if (i < 0) throw new Error(`app.js: function ${name} has no body`);
  let depth = 0;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`app.js: function ${name} braces unbalanced`);
}

// Pull the real PUBLISH_PART_STATUS_* constant declarations straight from source so the test binds to the shipped
// string values (not a hand-copied set that could silently drift).
function extractStatusConstants(): string {
  const lines: string[] = [];
  const re = /const (PUBLISH_PART_STATUS_[A-Z_]+) = '([^']+)';/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) lines.push(`const ${m[1]} = '${m[2]}';`);
  if (lines.length < 7) throw new Error(`app.js: expected >=7 PUBLISH_PART_STATUS_* constants, found ${lines.length}`);
  return lines.join('\n');
}

// Assemble the extracted closure into an executable module. These functions are self-contained (they depend only on
// the status constants and on each other), so no app.js globals are needed.
const factory = new Function(`
  ${extractStatusConstants()}
  ${extractFunction('publishHashPlain')}
  ${extractFunction('publishIdForPart')}
  ${extractFunction('publishPartAlreadyAttempted')}
  ${extractFunction('publishPartHadPriorChainAttempt')}
  ${extractFunction('publishPartEligibleForChainConfirmation')}
  ${extractFunction('publishPartAwaitingCapsuleHubConfirmation')}
  ${extractFunction('publishStateHasLandedUnconfirmedPart')}
  ${extractFunction('publishStateHasRetryableSendParts')}
  ${extractFunction('publishPartCanFreshSendRetry')}
  ${extractFunction('publishPartNeedsBroadcastRetry')}
  ${extractFunction('publishPartSignedAndUnconfirmed')}
  return {
    publishHashPlain, publishIdForPart, publishPartAlreadyAttempted, publishPartHadPriorChainAttempt,
    publishPartEligibleForChainConfirmation, publishPartAwaitingCapsuleHubConfirmation,
    publishStateHasLandedUnconfirmedPart, publishStateHasRetryableSendParts,
    publishPartCanFreshSendRetry, publishPartNeedsBroadcastRetry, publishPartSignedAndUnconfirmed,
  };
`);

const P = factory() as {
  publishHashPlain: (v: unknown) => string | null;
  publishIdForPart: (part: any) => string | null;
  publishPartAlreadyAttempted: (part: any) => boolean;
  publishPartHadPriorChainAttempt: (part: any) => boolean;
  publishPartEligibleForChainConfirmation: (part: any) => boolean;
  publishPartAwaitingCapsuleHubConfirmation: (part: any) => boolean;
  publishStateHasLandedUnconfirmedPart: (state: any) => boolean;
  publishStateHasRetryableSendParts: (state: any) => boolean;
  publishPartCanFreshSendRetry: (part: any) => boolean;
  publishPartNeedsBroadcastRetry: (part: any) => boolean;
  publishPartSignedAndUnconfirmed: (part: any) => boolean;
};

const SIGNED = { clientNonce: 7n, externalBoc: 'te6ccg...boc' };

describe('publish double-spend gate — publishPartCanFreshSendRetry (the ONLY fresh-nonce path)', () => {
  it('permits a fresh sign ONLY for a never-signed part in a pre-send status', () => {
    expect(P.publishPartCanFreshSendRetry({ status: 'built' })).toBe(true);
    expect(P.publishPartCanFreshSendRetry({ status: 'sending' })).toBe(true);
    expect(P.publishPartCanFreshSendRetry({ status: 'failed' })).toBe(true);
  });

  it('REFUSES a fresh sign for any part that already carries a signed external (double-spend guard)', () => {
    // A live clientNonce means an external was signed under it — re-signing under a new nonce would double-publish.
    expect(P.publishPartCanFreshSendRetry({ status: 'built', clientNonce: 7n })).toBe(false);
    // nonce 0 is a real nonce, not "unset" — must still block.
    expect(P.publishPartCanFreshSendRetry({ status: 'built', clientNonce: 0n })).toBe(false);
    // A non-empty externalBoc means it was signed.
    expect(P.publishPartCanFreshSendRetry({ status: 'built', externalBoc: 'abc' })).toBe(false);
    // A publishId means it was already assigned on-chain identity.
    expect(P.publishPartCanFreshSendRetry({ status: 'built', publishId: 'deadbeef' })).toBe(false);
    expect(P.publishPartCanFreshSendRetry({ status: 'failed', clientNonce: 3n, externalBoc: 'abc' })).toBe(false);
  });

  it('REFUSES a fresh sign for any already-chain-attempted status', () => {
    for (const status of ['sent', 'unknown', 'vault_submitted', 'capsulehub_confirmed']) {
      expect(P.publishPartCanFreshSendRetry({ status })).toBe(false);
    }
  });

  it('treats an empty-string externalBoc as unsigned (length gate, not mere presence)', () => {
    expect(P.publishPartCanFreshSendRetry({ status: 'built', externalBoc: '' })).toBe(true);
  });

  it('rejects null/undefined parts', () => {
    expect(P.publishPartCanFreshSendRetry(null)).toBe(false);
    expect(P.publishPartCanFreshSendRetry(undefined)).toBe(false);
  });
});

describe('publish re-broadcast lane — signed parts idempotently re-broadcast, never re-sign', () => {
  it('needsBroadcastRetry ONLY for a fully-signed SENT|UNKNOWN part', () => {
    expect(P.publishPartNeedsBroadcastRetry({ status: 'sent', ...SIGNED })).toBe(true);
    expect(P.publishPartNeedsBroadcastRetry({ status: 'unknown', ...SIGNED })).toBe(true);
  });

  it('needsBroadcastRetry EXCLUDES vault_submitted (nonce already consumed on-chain — must not re-POST)', () => {
    // A vault_submitted part has landed; re-broadcasting is pointless and it must stay out of the retry lane.
    expect(P.publishPartNeedsBroadcastRetry({ status: 'vault_submitted', ...SIGNED })).toBe(false);
    expect(P.publishPartNeedsBroadcastRetry({ status: 'capsulehub_confirmed', ...SIGNED })).toBe(false);
    expect(P.publishPartNeedsBroadcastRetry({ status: 'built', ...SIGNED })).toBe(false);
  });

  it('needsBroadcastRetry requires BOTH a non-empty boc AND a live nonce', () => {
    expect(P.publishPartNeedsBroadcastRetry({ status: 'sent', externalBoc: '', clientNonce: 7n })).toBe(false);
    expect(P.publishPartNeedsBroadcastRetry({ status: 'sent', externalBoc: 'abc' })).toBe(false);
    expect(P.publishPartNeedsBroadcastRetry({ status: 'sent' })).toBe(false);
  });

  it('signedAndUnconfirmed INCLUDES vault_submitted (the dropped-recovery candidate set) unlike needsBroadcastRetry', () => {
    expect(P.publishPartSignedAndUnconfirmed({ status: 'vault_submitted', ...SIGNED })).toBe(true);
    expect(P.publishPartSignedAndUnconfirmed({ status: 'sent', ...SIGNED })).toBe(true);
    expect(P.publishPartSignedAndUnconfirmed({ status: 'unknown', ...SIGNED })).toBe(true);
    // But a confirmed part is done, and an unsigned one was never in flight.
    expect(P.publishPartSignedAndUnconfirmed({ status: 'capsulehub_confirmed', ...SIGNED })).toBe(false);
    expect(P.publishPartSignedAndUnconfirmed({ status: 'built' })).toBe(false);
  });
});

describe('publish state / attempt predicates', () => {
  it('alreadyAttempted covers exactly the four chain-touched statuses', () => {
    for (const status of ['sent', 'unknown', 'vault_submitted', 'capsulehub_confirmed']) {
      expect(P.publishPartAlreadyAttempted({ status })).toBe(true);
    }
    for (const status of ['built', 'sending', 'failed']) {
      expect(P.publishPartAlreadyAttempted({ status })).toBe(false);
    }
  });

  it('hasRetryableSendParts is true iff some part is not yet chain-attempted', () => {
    expect(P.publishStateHasRetryableSendParts({ parts: [{ status: 'sent' }, { status: 'built' }] })).toBe(true);
    expect(P.publishStateHasRetryableSendParts({ parts: [{ status: 'sent' }, { status: 'capsulehub_confirmed' }] })).toBe(false);
    expect(P.publishStateHasRetryableSendParts({ parts: [] })).toBe(false);
  });

  it('hasLandedUnconfirmedPart is true iff some part is vault_submitted (nonce consumed, ACK pending)', () => {
    expect(P.publishStateHasLandedUnconfirmedPart({ parts: [{ status: 'vault_submitted' }] })).toBe(true);
    expect(P.publishStateHasLandedUnconfirmedPart({ parts: [{ status: 'sent' }, { status: 'capsulehub_confirmed' }] })).toBe(false);
  });

  it('eligibleForChainConfirmation includes parts whose retryPreviousStatus shows a prior chain attempt', () => {
    expect(P.publishPartEligibleForChainConfirmation({ status: 'built', retryPreviousStatus: 'sent' })).toBe(true);
    expect(P.publishPartEligibleForChainConfirmation({ status: 'sent' })).toBe(true);
    expect(P.publishPartEligibleForChainConfirmation({ status: 'built' })).toBe(false);
  });
});

describe('publishHashPlain / publishIdForPart normalization (drives the has-publishId gate)', () => {
  it('normalizes hex forms and rejects empties', () => {
    expect(P.publishHashPlain(null)).toBeNull();
    expect(P.publishHashPlain('')).toBeNull();
    expect(P.publishHashPlain('0xAB')).toBe('ab'.padStart(64, '0'));
    expect(P.publishHashPlain('ab')).toBe('ab'.padStart(64, '0'));
  });

  it('publishIdForPart reads either publishId or publish_id', () => {
    expect(P.publishIdForPart({ publishId: 'ff' })).toBe('ff'.padStart(64, '0'));
    expect(P.publishIdForPart({ publish_id: 'ff' })).toBe('ff'.padStart(64, '0'));
    expect(P.publishIdForPart({})).toBeNull();
  });
});
