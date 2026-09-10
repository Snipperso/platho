import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createPublicLane } from '../web/public-lane.mjs';
import { ACCOUNT_STATES_MAX_PER_CALL, ACCOUNT_STATES_URL_MAX, accountStatesAddressCost } from '../web/shard-reader.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE FEED PASS COSTS REQUESTS PER PASS, NOT REQUESTS PER CHANNEL.
//
// MEASURED 2026-08-29 over the shipping lane: a pass across 100 followed channels issued ONE HUNDRED
// accountStates requests — 56 addresses each, one per channel. The shared pump spaces requests at
// TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1100 ms without an API key, so the pass took 149.7 s of wall clock
// against its own PUBLIC_BACKGROUND_SYNC_MS = 30 s period: it could not finish before the next one was due, and
// it degraded with every channel followed. With a key (125 ms) it was 12.5 s — still half the period, at 100
// channels, doing nothing but asking which shards had moved.
//
// The addresses were never the problem. 5,600 of them fit SIX requests at ACCOUNT_STATES_MAX_PER_CALL = 1024, and
// readAccountStates has chunked exactly like that all along. Only the caller was per-channel. Same fixture through
// readChannelPostsMany: 6 requests, 7.8 s.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const CLOCK = 1_790_000_000;
const ERA_WINDOW = 14;          // PUBLIC_CHANNEL_ERA_WINDOW
const SEQ_PROBE = 4;            // PUBLIC_SEQ_PROBE
const ADDRESSES_PER_CHANNEL = ERA_WINDOW * SEQ_PROBE;

function countingLane() {
  const counts = { stateRequests: 0, addresses: 0, worstUrlBytes: 0 };
  const lane = createPublicLane({
    runGetMethod: async () => { throw new Error('no live shard in this fixture'); },
    now: () => CLOCK,
    endpoint: 'https://x/api/v3/accountStates',
    fetch: async (urlStr: string) => {
      const url = new URL(urlStr);
      if (!url.pathname.endsWith('/accountStates')) throw new Error(`unexpected fetch ${urlStr}`);
      counts.stateRequests += 1;
      counts.addresses += url.searchParams.getAll('address').length;
      counts.worstUrlBytes = Math.max(counts.worstUrlBytes, urlStr.length);
      // Nothing is live, so no shard is read: this measures the STATE probe, which is the term that scaled.
      return { ok: true, status: 200, json: async () => ({ accounts: [] }) } as any;
    },
  });
  return { lane, counts };
}

const wallets = (n: number) => Array.from({ length: n }, (_, i) => `0:${i.toString(16).padStart(4, '0').repeat(16)}`);

describe('FEEDBATCH — one state read for the whole feed', () => {
  it('FEEDBATCH-01: K channels cost a handful of URL-bounded requests, not K', async () => {
    const { lane, counts } = countingLane();
    const K = 100;
    await lane.readChannelPostsMany(wallets(K));
    expect(counts.addresses, 'every channel is still probed across its whole era window').toBe(K * ADDRESSES_PER_CHANNEL);
    // WHAT BOUNDS A CHUNK IS THE URL, NOT THE COUNT [audit 2026-08-31, round 8]. This used to assert
    // ceil(K x 56 / ACCOUNT_STATES_MAX_PER_CALL) = 6, which silently assumed 1024 addresses always fit in one
    // URL. They do in the FRIENDLY form (48 B each) and do not in the RAW hex form this fixture and the feed's
    // own coordinate path use: 77 B each x 1024 = 78,848 B, past the 65,553 B the endpoint was measured to
    // accept. So the count is now derived from the byte budget the module publishes, and the byte wall itself
    // is asserted from the URLs the lane really built — the term the old arithmetic could not see.
    const perAddress = accountStatesAddressCost(wallets(1)[0]);
    const perChunk = Math.min(ACCOUNT_STATES_MAX_PER_CALL, Math.floor((ACCOUNT_STATES_URL_MAX - 1024) / perAddress));
    expect(counts.stateRequests, 'chunks are bounded by the URL budget, not only by the 1024 count')
      .toBe(Math.ceil((K * ADDRESSES_PER_CHANNEL) / perChunk));
    expect(counts.worstUrlBytes, 'no request may exceed the byte wall the endpoint was measured to accept')
      .toBeLessThanOrEqual(ACCOUNT_STATES_URL_MAX);
    expect(counts.stateRequests, 'still a handful per pass — the number that used to be 100').toBeLessThan(10);
    // What that buys on the transport this app actually runs on: 1100 ms per request without an API key.
    expect(counts.stateRequests * 1.1, 'a pass fits inside its own 30-second period again').toBeLessThan(30);
  });

  it('FEEDBATCH-02: a channel whose own read throws does not take the feed with it', async () => {
    // The per-channel loop this replaced wrapped each read in a try/catch and skipped the one that threw. Batching
    // the STATE read must not turn one unreadable shard into a dead pass for every channel behind it.
    const seen: string[] = [];
    const lane = createPublicLane({
      runGetMethod: async () => { throw new Error('getter refused'); },
      now: () => CLOCK,
      endpoint: 'https://x/api/v3/accountStates',
      fetch: async (urlStr: string) => {
        const url = new URL(urlStr);
        if (url.pathname.endsWith('/accountStates')) {
          // Mark every probed address ACTIVE so the lane goes on to read the shard — which then throws.
          const accounts = url.searchParams.getAll('address').map((address) => ({
            address, status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: '1',
          }));
          return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
        }
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as any;
      },
    });
    const list = wallets(3);
    const byWallet = await lane.readChannelPostsMany(list, {
      onChannelError: (wallet: string) => { seen.push(wallet); },
    });
    expect([...byWallet.keys()], 'every channel still gets an answer').toEqual(list);
    for (const wallet of list) expect(byWallet.get(wallet)).toEqual([]);
    expect(seen, 'and the caller is told which ones failed').toEqual(list);
  });

  it('FEEDBATCH-03: the single-channel read still exists and still works', async () => {
    // readChannelPosts is the same read for one wallet — and it must not depend on `this`, because callers pull
    // lane methods off the object.
    const { lane, counts } = countingLane();
    const { readChannelPosts } = lane;
    expect(await readChannelPosts(wallets(1)[0])).toEqual([]);
    expect(counts.stateRequests).toBe(1);
    expect(counts.addresses).toBe(ADDRESSES_PER_CHANNEL);
  });

  it('FEEDBATCH-04: the app pass asks once, for every channel it has', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const sync = app.slice(app.indexOf('async function syncPublicChannelFromShards()'), app.indexOf('async function syncPublicChannelFromChain()'));
    expect(sync).toContain('await lane.readChannelPostsMany([...walletOfChannel.keys()], {');
    expect(sync, 'the per-channel read is gone from the pass').not.toMatch(/await lane\.readChannelPosts\(/);
    // A batch that cannot be answered at all leaves every channel's cached posts alone, which is what a
    // per-channel failure used to do.
    expect(sync).toContain("console.warn('[public] feed state batch failed', error);");
  });
});
