import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createPublicLane } from '../web/public-lane.mjs';
import { ACCOUNT_STATES_MAX_PER_CALL, ACCOUNT_STATES_URL_MAX, accountStatesAddressCost } from '../web/shard-reader.mjs';


if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const CLOCK = 1_790_000_000;
const ERA_WINDOW = 14;
const SEQ_PROBE = 4;
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
    const perAddress = accountStatesAddressCost(wallets(1)[0]);
    const perChunk = Math.min(ACCOUNT_STATES_MAX_PER_CALL, Math.floor((ACCOUNT_STATES_URL_MAX - 1024) / perAddress));
    expect(counts.stateRequests, 'chunks are bounded by the URL budget, not only by the 1024 count')
      .toBe(Math.ceil((K * ADDRESSES_PER_CHANNEL) / perChunk));
    expect(counts.worstUrlBytes, 'no request may exceed the byte wall the endpoint was measured to accept')
      .toBeLessThanOrEqual(ACCOUNT_STATES_URL_MAX);
    expect(counts.stateRequests, 'still a handful per pass — the number that used to be 100').toBeLessThan(10);
    expect(counts.stateRequests * 1.1, 'a pass fits inside its own 30-second period again').toBeLessThan(30);
  });

  it('FEEDBATCH-02: a channel whose own read throws does not take the feed with it', async () => {
    const seen: string[] = [];
    const lane = createPublicLane({
      runGetMethod: async () => { throw new Error('getter refused'); },
      now: () => CLOCK,
      endpoint: 'https://x/api/v3/accountStates',
      fetch: async (urlStr: string) => {
        const url = new URL(urlStr);
        if (url.pathname.endsWith('/accountStates')) {
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
    const { lane, counts } = countingLane();
    const { readChannelPosts } = lane;
    expect(await readChannelPosts(wallets(1)[0])).toEqual([]);
    expect(counts.stateRequests).toBe(1);
    expect(counts.addresses).toBe(ADDRESSES_PER_CHANNEL);
  });

  it('FEEDBATCH-04: the app pass asks once, for every channel it has', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const sync = app.slice(app.indexOf('async function syncPublicChannelFromShards()'), app.indexOf('async function syncPublicChannelFromChain()'));
    expect(sync).toContain('const readNow = [...walletOfChannel.keys()].filter((wallet) => publicChannelReadThisPass(wallet, walletOfChannel.get(wallet), passStartedAt));');
    expect(sync).toContain('await lane.readChannelPostsMany(readNow, {');
    expect(sync, 'the per-channel read is gone from the pass').not.toMatch(/await lane\.readChannelPosts\(/);
    expect(sync).toContain("console.warn('[public] feed state batch failed', error);");
  });
});
