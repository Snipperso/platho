import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// BEHAVIORAL coverage for the ATH flush in-flight overlay (v704).
//
// The owner-reported bug: tapping "Flush ATH" sent the wallet transaction, but the immediate
// post-transaction refresh overwrote the optimistic "flushing" state with a stale chain read (the
// transaction had not landed yet, so the chain still answered due>0/pending=0) — the status snapped back to
// "250 ATH ready" with an ACTIVE button, and a second tap would have sent a duplicate flush.
//
// applyAthFlushOptimisticOverlay is the single merge point: while the chain still shows the EXACT pre-flush
// picture for a flushed bucket, the displayed state holds due=0/pending+1; the moment the chain moves
// (pending counted, or the due changed — including a new accrual arriving mid-flight) or the TTL expires,
// the chain wins. web/app.js is not importable (browser module), so this extracts the REAL shipped function
// (brace-balanced by name) and executes it — invert a condition in app.js and this goes red, unlike a grep.

const appJsPath = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'web', 'app.js');
const source = readFileSync(appJsPath, 'utf8');

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

type Harness = {
  apply: (state: Record<string, unknown>) => Record<string, unknown>;
  setOverlay: (overlay: unknown) => void;
  getOverlay: () => unknown;
};

const factory = new Function(`
  ${extractFunction('nonNegativeBigInt')}
  let athFlushOptimisticFlush = null;
  ${extractFunction('applyAthFlushOptimisticOverlay')}
  return {
    apply: applyAthFlushOptimisticOverlay,
    setOverlay: (overlay) => { athFlushOptimisticFlush = overlay; },
    getOverlay: () => athFlushOptimisticFlush,
  };
`) as () => Harness;

function chainState(overrides: Record<string, unknown> = {}) {
  return {
    username_burn_due_ath: 0n,
    profile_burn_due_ath: 0n,
    username_pending_burn_flush_count: 0n,
    profile_pending_burn_flush_count: 0n,
    busy: false,
    error: null,
    ...overrides,
  };
}

function armedOverlay(overrides: Record<string, unknown> = {}) {
  return {
    username: { flushed: true, baselineDue: 250n },
    profile: { flushed: false, baselineDue: 0n },
    until: Date.now() + 5 * 60 * 1000,
    ...overrides,
  };
}

describe('ATH flush in-flight overlay (real app.js code)', () => {
  it('ATH-FLUSH-OVERLAY-01: no overlay -> the chain read passes through untouched', () => {
    const h = factory();
    const state = chainState({ username_burn_due_ath: 250n });
    expect(h.apply(state)).toBe(state);
  });

  it('ATH-FLUSH-OVERLAY-02: pre-flush chain picture stays held at due=0/pending+1 (the owner bug)', () => {
    const h = factory();
    h.setOverlay(armedOverlay());
    const out = h.apply(chainState({ username_burn_due_ath: 250n }));
    expect(out.username_burn_due_ath).toBe(0n);
    expect(out.username_pending_burn_flush_count).toBe(1n);
    // The overlay stays armed for the NEXT refresh too (the transaction may still be in flight).
    expect(h.getOverlay()).not.toBeNull();
    const again = h.apply(chainState({ username_burn_due_ath: 250n }));
    expect(again.username_burn_due_ath).toBe(0n);
  });

  it('ATH-FLUSH-OVERLAY-03: the chain counting the pending flush releases the bucket and clears the overlay', () => {
    const h = factory();
    h.setOverlay(armedOverlay());
    const out = h.apply(chainState({ username_burn_due_ath: 0n, username_pending_burn_flush_count: 1n }));
    expect(out.username_pending_burn_flush_count).toBe(1n);
    expect(out.username_burn_due_ath).toBe(0n);
    expect(h.getOverlay()).toBeNull();
  });

  it('ATH-FLUSH-OVERLAY-04: a changed due (processed flush OR a new accrual) releases the bucket', () => {
    const h = factory();
    h.setOverlay(armedOverlay());
    // Fully processed: due dropped to zero without a visible pending window.
    const processed = h.apply(chainState({ username_burn_due_ath: 0n }));
    expect(processed.username_burn_due_ath).toBe(0n);
    expect(h.getOverlay()).toBeNull();

    h.setOverlay(armedOverlay());
    // New accrual mid-flight: a DIFFERENT due must show (and re-arm the button) rather than being masked.
    const accrued = h.apply(chainState({ username_burn_due_ath: 400n }));
    expect(accrued.username_burn_due_ath).toBe(400n);
    expect(accrued.username_pending_burn_flush_count).toBe(0n);
    expect(h.getOverlay()).toBeNull();
  });

  it('ATH-FLUSH-OVERLAY-05: an expired TTL trusts the chain (a lost transaction re-arms the button honestly)', () => {
    const h = factory();
    h.setOverlay(armedOverlay({ until: Date.now() - 1 }));
    const out = h.apply(chainState({ username_burn_due_ath: 250n }));
    expect(out.username_burn_due_ath).toBe(250n);
    expect(out.username_pending_burn_flush_count).toBe(0n);
    expect(h.getOverlay()).toBeNull();
  });

  it('ATH-FLUSH-OVERLAY-06: buckets are independent — an unflushed bucket is never touched', () => {
    const h = factory();
    h.setOverlay(armedOverlay({
      username: { flushed: true, baselineDue: 250n },
      profile: { flushed: true, baselineDue: 90n },
    }));
    const out = h.apply(chainState({
      username_burn_due_ath: 250n,
      profile_burn_due_ath: 0n, // profile flush already processed
      profile_pending_burn_flush_count: 0n,
    }));
    // username still held, profile released to the chain value.
    expect(out.username_burn_due_ath).toBe(0n);
    expect(out.username_pending_burn_flush_count).toBe(1n);
    expect(out.profile_burn_due_ath).toBe(0n);
    expect(out.profile_pending_burn_flush_count).toBe(0n);
    expect(h.getOverlay()).not.toBeNull();
  });
});
