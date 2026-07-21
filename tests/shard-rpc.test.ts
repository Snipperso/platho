import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { beginCell } from '@ton/core';
import { createShardStatesRequest, createShardMessagesReader, createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';
import { readAccountStates } from '../web/shard-reader.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-RPC — the two reads the shard lane needs and the app's transport did not expose.
//
// The transport asks about ONE account at a time; a scan asks about a thousand, in one request, because that is
// the only thing that makes a leak-free first-contact scan affordable at all. And a capsule body lives in
// transaction history rather than in state, so recovering it is a /messages read rather than a getter.
//
// Both must ride the SHARED pump. A scan that opened its own connection would race the app's own reads for the
// user's toncenter budget, and the whole rate model — one queue per client key — assumes there is one queue.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ENDPOINT = 'https://toncenter.com/api/v3/accountStates';
const MESSAGES = 'https://toncenter.com/api/v3/messages';

let seen: Array<{ url: string; headers: Record<string, string> }>;
const fakeFetch = (body: any, ok = true, status = 200) => async (url: string, init: any) => {
  seen.push({ url: String(url), headers: init?.headers ?? {} });
  return { ok, status, json: async () => body } as any;
};

beforeEach(() => { seen = []; });
afterEach(() => {
  delete (globalThis as any).plathoTonRpcEndpoint;
  delete (globalThis as any).plathoToncenterApiKey;
});

describe('SHARD-RPC — batched state reads and history reads, on the shared pump', () => {
  it('RPC-01: readAccountStates drives it end to end, and absence really means empty', async () => {
    // The contract this adapter exists to satisfy, exercised through the real consumer rather than by asserting
    // on its own shape. ABSENT MEANS EMPTY is the load-bearing half: under lazy deploy most buckets have no
    // account, and treating a missing row as an error would turn the normal case into a failure.
    const live = '0:126ccfbbfbe08845584b512bd3f44e495714f0511436d00a00a8d8fd20f3fe3e';
    const request = createShardStatesRequest({
      endpoint: ENDPOINT,
      fetch: fakeFetch({ accounts: [{ address: live, status: 'active', balance: '5', data_hash: 'dh', last_transaction_lt: '7' }] }),
    });

    const ghost = '0:' + 'ab'.repeat(32);
    const states = await readAccountStates([live, ghost], { request });

    expect(states.size, 'only the account that exists comes back').toBe(1);
    expect(states.get(`0:${'126ccfbbfbe08845584b512bd3f44e495714f0511436d00a00a8d8fd20f3fe3e'}`)?.balance).toBe(5n);
    expect(seen.length, 'both addresses fit one request — that is the whole point').toBe(1);
    expect(seen[0].url, 'both are in the query').toContain('address=');
    expect(seen[0].url).toContain('include_boc=false');
  });

  it('RPC-02: the API key is sent as a header, never in the URL', async () => {
    // A key in a query string ends up in logs, proxies and referrers. It belongs in a header.
    (globalThis as any).plathoToncenterApiKey = 'secret-key-value';
    const request = createShardStatesRequest({ endpoint: ENDPOINT, fetch: fakeFetch({ accounts: [] }) });
    await readAccountStates(['0:' + '11'.repeat(32)], { request });

    expect(seen[0].headers['X-API-Key'], 'the key rides in the header').toBe('secret-key-value');
    expect(seen[0].url, 'and never in the URL').not.toContain('secret-key-value');
  });

  it('RPC-03: a rate-limited pass returns empty rather than throwing', async () => {
    // The pump may decline a background request outright (skipIfRateLimited). A scan that treated that as an
    // error would surface a failure to the user for something that is simply "not now" — the next pass is a
    // minute away and the cursor makes it cheap. It must look like a pass that found nothing.
    const request = createShardStatesRequest({
      endpoint: ENDPOINT,
      fetch: async () => null as any,     // stands in for the pump declining
    });
    // The adapter treats a null response as an empty pass; readAccountStates then yields an empty map.
    const states = await readAccountStates(['0:' + '22'.repeat(32)], { request });
    expect(states.size, 'a declined pass is empty, not broken').toBe(0);
  });

  it('RPC-04: an HTTP failure IS raised — a bad response must not look like an empty bucket', async () => {
    // The mirror of RPC-03, and the more important half. Silently turning a 500 into "no intros here" would
    // advance cursors past messages nobody read, which is the silent-loss class this project keeps meeting.
    const request = createShardStatesRequest({
      endpoint: ENDPOINT, fetch: fakeFetch({}, false, 503),
    });
    await expect(readAccountStates(['0:' + '33'.repeat(32)], { request }))
      .rejects.toThrow(/HTTP 503/);
  });

  it('RPC-05: the messages reader returns cells, skips what it cannot parse, and never throws on junk', async () => {
    // A shard's history carries plain top-ups, bounces and the fee deposit alongside publishes. One unreadable
    // body must not fail the whole read, or a single odd transaction hides every capsule behind it.
    const payload = beginCell().storeUint(0x49535031, 32).endCell();
    const readMessages = createShardMessagesReader({
      endpoint: MESSAGES,
      fetch: fakeFetch({
        messages: [
          { message_content: { body: payload.toBoc().toString('base64') } },
          { message_content: { body: 'not-a-cell' } },
          { message_content: {} },
          {},
        ],
      }),
    });

    const cells = await readMessages('0:' + '44'.repeat(32));
    expect(cells.length, 'one readable body out of four rows').toBe(1);
    expect(seen[0].url, 'asked for messages TO the shard').toContain('destination=');
    expect(seen[0].url, 'newest first').toContain('sort=desc');
  });

  it('RPC-07: the source-bearing messages reader pairs each parsed body with its top-level source', async () => {
    // The PUBLIC lane recovers a post's author from the transaction source, which get_page omits. `source` is a
    // TOP-LEVEL field of the message object (MEASURED against live toncenter v3 2026-07-21), raw 0:HEX, next to
    // message_content.body — NOT message.in_msg.source. A body that will not parse is skipped, source and all.
    const payload = beginCell().storeUint(0x50535031, 32).endCell();
    const src = '0:' + 'c1'.repeat(32);
    const readWithSource = createShardMessagesWithSourceReader({
      endpoint: MESSAGES,
      fetch: fakeFetch({
        messages: [
          { source: src, message_content: { body: payload.toBoc().toString('base64') } },
          { source: '0:' + 'ff'.repeat(32), message_content: { body: 'not-a-cell' } },  // dropped: unparseable
          { message_content: { body: payload.toBoc().toString('base64') } },            // parseable, source null
        ],
      }),
    });

    const rows = await readWithSource('0:' + '77'.repeat(32));
    expect(rows.length, 'two parseable bodies out of three rows').toBe(2);
    expect(rows[0].source, 'the top-level source is carried through').toBe(src);
    expect(rows[0].bodyCell, 'and paired with the parsed body').toBeTruthy();
    expect(rows[1].source, 'a message with no source yields null, not a throw').toBeNull();
  });

  it('RPC-06: with no endpoint configured it fails loudly rather than guessing one', async () => {
    const request = createShardStatesRequest({ fetch: fakeFetch({ accounts: [] }) });
    await expect(readAccountStates(['0:' + '55'.repeat(32)], { request }))
      .rejects.toThrow(/no TON RPC endpoint configured/);
  });
});
