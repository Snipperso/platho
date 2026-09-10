import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createRecordShardPlanner } from '../web/conv-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE RECEIVE PASS DERIVES EACH CONVERSATION'S SHARDS ONCE, NOT ONCE EVERY TWELVE SECONDS.
//
// MEASURED 2026-08-29 (node 22, desktop, 50 conversations, the steady-state window): 3.575 ms per conversation per
// pass — HKDF per epoch per direction, an ed25519 keygen, a StateInit hash, six addresses. The idle receive tier is
// MESSAGE_AUTO_SYNC_IDLE_MS = 12 s, so the cost scaled with how many conversations a person HAS rather than with
// what arrived: 500 conversations is 14.9% of this desktop's CPU, permanently, and a phone is several times worse.
// The same fixture through the planner: 0.0121 ms per conversation warm — 295x.
//
// The derivation is a pure function of (kRoot, selfKeyId, peerKeyId, epoch, window) and all five hold still for a
// whole day, which is what makes the cache correct rather than merely fast. This file pins the parts where being
// wrong would be silent: that a changed input really does re-derive, and that a wallet switch drops the lot.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const app = readFileSync('web/app.js', 'utf8');
const bytes = (seed: number) => Uint8Array.from({ length: 32 }, (_, i) => (seed * 31 + i * 7) & 0xff);
const CONV = { kRoot: bytes(1), selfKeyId: bytes(2), peerKeyId: bytes(3), epochNow: 20690, windowW: 2 };

describe('CONVPLAN — the shard plan is derived once per (keys, epoch, window)', () => {
  it('CONVPLAN-01: a repeated pass derives nothing and returns the same addresses', async () => {
    const planner = createRecordShardPlanner();
    const first = await planner.incoming(CONV);
    const second = await planner.incoming(CONV);
    expect(planner.stats).toMatchObject({ misses: 1, hits: 1 });
    expect(second.map((s: any) => s.address)).toEqual(first.map((s: any) => s.address));
    // Six addresses is the steady-state pass: (window 2 + 1) epochs, both directions, counted here so a change to
    // CONV_RECV_WINDOW_W cannot quietly multiply the per-pass cost this file exists to remove.
    const out = await planner.outgoing(CONV);
    expect(first.length + out.length).toBe(6);
  });

  it('CONVPLAN-02: the two directions are separate answers, not one cached twice', async () => {
    const planner = createRecordShardPlanner();
    const incoming = await planner.incoming(CONV);
    const outgoing = await planner.outgoing(CONV);
    expect(planner.stats).toMatchObject({ misses: 2, hits: 0 });
    // If the group were left out of the cache key, my own sent messages would be read from the peer's shards and a
    // restored device would show half of every conversation.
    expect(new Set(outgoing.map((s: any) => s.address))).not.toEqual(new Set(incoming.map((s: any) => s.address)));
  });

  it('CONVPLAN-03: every input that changes the answer re-derives it', async () => {
    const planner = createRecordShardPlanner();
    await planner.incoming(CONV);
    const variants = [
      { ...CONV, epochNow: CONV.epochNow + 1 },       // a new day
      { ...CONV, windowW: CONV.windowW + 1 },         // a cold walk / manual full rescan widens the window
      { ...CONV, kRoot: bytes(9) },                   // a re-INTRO adopted a new root
      { ...CONV, peerKeyId: bytes(9) },               // a different conversation
      { ...CONV, selfKeyId: bytes(9) },               // a different identity on the same device
    ];
    for (const variant of variants) await planner.incoming(variant);
    expect(planner.stats.hits, 'none of these may be served from the cache').toBe(0);
    expect(planner.stats.misses).toBe(1 + variants.length);
  });

  it('CONVPLAN-04: it is bounded, and the eviction is least-recently-used', async () => {
    const planner = createRecordShardPlanner({ limit: 2 });
    await planner.incoming({ ...CONV, peerKeyId: bytes(11) });   // A
    await planner.incoming({ ...CONV, peerKeyId: bytes(12) });   // B
    await planner.incoming({ ...CONV, peerKeyId: bytes(11) });   // A again — now the most recent
    await planner.incoming({ ...CONV, peerKeyId: bytes(13) });   // C evicts B, not A
    expect(planner.size).toBe(2);
    expect(planner.stats.evictions).toBe(1);
    const before = planner.stats.hits;
    await planner.incoming({ ...CONV, peerKeyId: bytes(11) });
    expect(planner.stats.hits, 'the recently used entry survived').toBe(before + 1);
  });

  it('CONVPLAN-05: the app clears it on a wallet switch', () => {
    // The addresses are derived FROM this identity's keys. A cache that outlived the switch would keep one wallet's
    // routing warm for the next one — [[cross-wallet-identity-bleed]], the defect this project has already shipped.
    const teardown = app.slice(app.indexOf('function clearWalletScopedRuntimeState('), app.indexOf('\n}\n', app.indexOf('function clearWalletScopedRuntimeState(')));
    expect(teardown).toContain('convShardPlanner.clear();');
    // And the pass really goes through it — the raw derivations are no longer called from app.js at all.
    expect(app).toContain('await convShardPlanner.incoming({ kRoot, selfKeyId, peerKeyId, epochNow, windowW })');
    expect(app).toContain('await convShardPlanner.outgoing({ kRoot, selfKeyId, peerKeyId, epochNow, windowW })');
    expect(app).not.toMatch(/await incomingRecordShards\(/);
    expect(app).not.toMatch(/await outgoingRecordShards\(/);
  });
});
