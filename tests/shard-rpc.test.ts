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

  it('RPC-04B: a STRICT reader refuses to turn a request that never ran into an empty account list', async () => {
    // RPC-03 is right for a background scan and WRONG for the self lanes. Those read absence as proof that a slot
    // was never written and then skip it, so an empty answer is a claim about the user's data — and manufacturing
    // it from a declined request is how a restore silently loses conversations. Strict makes the difference
    // explicit: the same declined request that reads as "nothing here" for a scan must raise for a prober, so the
    // caller's fallback (probe every slot the slow way) engages instead.
    const declined = async () => null as any;                 // the pump declining, exactly as in RPC-03
    const scan = createShardStatesRequest({ endpoint: ENDPOINT, fetch: declined });
    expect((await readAccountStates(['0:' + '44'.repeat(32)], { request: scan })).size).toBe(0);

    const strict = createShardStatesRequest({ endpoint: ENDPOINT, fetch: declined, strict: true });
    await expect(readAccountStates(['0:' + '44'.repeat(32)], { request: strict }))
      .rejects.toThrow(/absence is not proven/);
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE HISTORY WINDOW IS FILTERED BY OPCODE — the fix for the shard griefing vector.
//
// Capsule bodies are read from a shard's inbound history, newest first, with a limit. Shard addresses are
// derivable by anyone (a channel's from the wallet + epoch tag; an IntroShard's from (epoch, bucket), which is
// what lets a stranger send a first contact at all), so a griefer could push cheap junk at a shard and shove
// the real publishes out of the window: a channel feed goes empty, and on the INTRO lane the body for an entry
// that IS on chain and paid for stops being found — a first contact lost with no error anywhere.
//
// The parameters below were MEASURED against live toncenter v3 on 2026-07-28, never assumed.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const PSP1 = 0x50535031;
const psp1Body = () => beginCell().storeUint(PSP1, 32).endCell().toBoc().toString('base64');
const junkBody = () => beginCell().storeUint(0xdeadbeef, 32).endCell().toBoc().toString('base64');

/** A fetch stub that answers by `offset`, so paging can be observed. Past the last page the history is empty. */
const pagedFetch = (pages: any[][], pageSize = 4) => async (url: string, init: any) => {
  seen.push({ url: String(url), headers: init?.headers ?? {} });
  const offset = Number(new URL(String(url)).searchParams.get('offset') ?? 0);
  return { ok: true, status: 200, json: async () => ({ messages: pages[offset / pageSize] ?? [] }) } as any;
};

/** A fetch stub that IGNORES `offset` — every page is the same one, the way a proxy without paging behaves. */
const offsetBlindFetch = (page: any[]) => async (url: string, init: any) => {
  seen.push({ url: String(url), headers: init?.headers ?? {} });
  return { ok: true, status: 200, json: async () => ({ messages: page }) } as any;
};

describe('SHARD-RPC — the opcode-filtered history window', () => {
  it('RPC-OP-01: the opcode goes on the wire as 0x-hex — a decimal value is rejected with 422', async () => {
    // MEASURED: `?opcode=1347506225` answers 422; `?opcode=0x50535031` filters. The wire form is not cosmetic.
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1,
      fetch: fakeFetch({ messages: [{ opcode: '0x50535031', source: null, message_content: { body: psp1Body() } }] }),
    });
    await read('0:' + '11'.repeat(32));
    expect(seen[0].url).toContain('opcode=0x50535031');
    expect(seen[0].url, 'never the decimal form').not.toContain(String(PSP1));
  });

  it('RPC-OP-02: when the endpoint honours the filter, one request IS the window — no paging', async () => {
    const rows = Array.from({ length: 4 }, () => ({ opcode: '0x50535031', source: null, message_content: { body: psp1Body() } }));
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, limit: 4, fetch: fakeFetch({ messages: rows }),
    });
    const out = await read('0:' + '22'.repeat(32));
    expect(out.length).toBe(4);
    expect(seen.length, 'a full page of ours needs no second request').toBe(1);
    expect(seen[0].url, 'and no offset is spent').not.toContain('offset=');
  });

  it('RPC-OP-03: an endpoint that IGNORES the filter is detected by the rows, and paged past', async () => {
    // THE DEFENCE THAT MATTERS. An unknown query parameter is dropped silently and still answers 200 (MEASURED
    // for `op`, `op_code`, `message_opcode`), so support can only be proven by the rows. Here the endpoint
    // returns the griefer's flood; the reader must page with `offset` until the window holds real publishes,
    // rather than reporting a channel with no posts.
    const junk = { opcode: '0xdeadbeef', source: null, message_content: { body: junkBody() } };
    const real = { opcode: '0x50535031', source: '0:' + 'c1'.repeat(32), message_content: { body: psp1Body() } };
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, limit: 4,
      fetch: pagedFetch([[junk, junk, junk, junk], [junk, junk, real, real]]),
    });

    const out = await read('0:' + '33'.repeat(32));
    expect(out.length, 'the two real publishes were recovered from behind the flood').toBe(2);
    expect(out.every((r: any) => r.source === real.source), 'and no junk row occupies the window').toBe(true);
    expect(seen[1].url, 'paged by offset, as measured to work alongside opcode').toContain('offset=4');
    // Three requests, not two: the window asked for 4 and holds 2, so it keeps looking and stops on the empty
    // page. Under-filling a window that the caller sized deliberately is what let the flood win in the first place.
    expect(seen.length).toBe(3);
    expect(seen[2].url).toContain('offset=8');
  });

  it('RPC-OP-04: a row with NO opcode field is KEPT — an indexer that does not decode opcodes must not blind us', async () => {
    // The asymmetry that makes this safe to ship. A missing opcode is AMBIGUOUS: with a filtering endpoint the
    // row is ours and simply was not decoded. Dropping it would empty the feed of a user whose endpoint does not
    // populate the field — turning a griefing defence into a total blackout. Only a row that identifies itself
    // as someone else's may ever be removed.
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, limit: 8,
      fetch: fakeFetch({
        messages: [
          { source: null, message_content: { body: psp1Body() } },              // no opcode field at all
          { opcode: null, source: null, message_content: { body: psp1Body() } },
          { opcode: '', source: null, message_content: { body: psp1Body() } },
          { opcode: '0xdeadbeef', source: null, message_content: { body: junkBody() } },   // provably foreign
        ],
      }),
    });
    const out = await read('0:' + '44'.repeat(32));
    expect(out.length, 'three ambiguous rows kept, one provably foreign row dropped').toBe(3);
  });

  it('RPC-OP-05: without an opcode the reader keeps its old take-everything behaviour', async () => {
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES,
      fetch: fakeFetch({
        messages: [
          { opcode: '0xdeadbeef', source: null, message_content: { body: junkBody() } },
          { opcode: '0x50535031', source: null, message_content: { body: psp1Body() } },
        ],
      }),
    });
    const out = await read('0:' + '55'.repeat(32));
    expect(out.length, 'no filter requested, no filtering done').toBe(2);
    expect(seen[0].url, 'and no opcode parameter is sent').not.toContain('opcode=');
  });

  it('RPC-OP-06B: an endpoint that ignores `offset` too is noticed, not looped over', async () => {
    // Found by a test stub that repeated its last page: if `offset` is dropped as silently as `opcode` was, the
    // reader keeps re-reading the newest rows and the window fills with DUPLICATES of one post. A repeated first
    // row is the tell — there is nothing further back to fetch, so stop with what is genuinely there.
    const junk = { hash: 'h-junk', opcode: '0xdeadbeef', source: null, message_content: { body: junkBody() } };
    const real = { hash: 'h-real', opcode: '0x50535031', source: '0:' + 'c1'.repeat(32), message_content: { body: psp1Body() } };
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, limit: 4, maxPages: 6, fetch: offsetBlindFetch([junk, junk, junk, real]),
    });

    const out = await read('0:' + '88'.repeat(32));
    expect(out.length, 'the one real row, counted ONCE — not four copies of it').toBe(1);
    expect(seen.length, 'two requests: the first, and one that proved paging is unsupported').toBe(2);
  });

  it('RPC-OP-06: paging is bounded — an endless flood cannot spin the reader forever', async () => {
    // A griefer controls how much junk exists, so the fallback path must have a ceiling. It stops and returns
    // what it has rather than paging until the request budget is gone.
    // Each page carries DISTINCT junk, so the repeat detector stays out of the way and the cap is what stops it.
    const flood = (page: number) => Array.from({ length: 4 }, (_, i) => ({
      hash: `h${page}-${i}`, opcode: '0xdeadbeef', source: null, message_content: { body: junkBody() },
    }));
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, limit: 4, maxPages: 3,
      fetch: pagedFetch([flood(0), flood(1), flood(2), flood(3)]),
    });
    const out = await read('0:' + '66'.repeat(32));
    expect(out.length).toBe(0);
    expect(seen.length, 'stopped at the cap instead of chasing the flood').toBe(3);
  });
});
