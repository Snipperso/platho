import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { beginCell } from '@ton/core';
import { createShardStatesRequest, createShardMessagesReader, createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';
import { readAccountStates, refusedIndexFromDetail, isDeadlineDetail, seedStatesBatchCeiling, subscribeStatesBatchCeiling, __resetRefusedAddressesForTests, __statesBatchCeilingForTests } from '../web/shard-reader.mjs';
import { toncenterScanLaneOptions } from '../web/ton-rpc-transport.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';

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
  delete (globalThis as any).plathoTonRpcConfig;
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

  it('RPC-04C: a 422 is bisected — one refused address costs one UNKNOWN row, never the whole probe', async () => {
    // OWNER'S CONSOLE 2026-08-21: "accountStates failed with HTTP 422" on the probe over every conversation's
    // shards, then "reading every shard" — the whole batch abandoned for whatever the endpoint refused, and the
    // reason thrown away with the body. MEASURED the same hour: 1024, 1025 and 1100 well-formed addresses in one
    // request all answer 200, so a 422 is about SOMETHING in the batch, not its size. Bisect it: the rest of the
    // addresses are still answerable, the refused one is recorded as UNKNOWN (an omitted address would read as
    // "never written, skip it" to the lanes — the silent-loss shape), and the endpoint's own `detail` reaches the
    // error text.
    const good1 = '0:' + '51'.repeat(32);
    const bad = '0:' + '52'.repeat(32);
    const good2 = '0:' + '53'.repeat(32);
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(String(url));
      const asked = new URL(String(url)).searchParams.getAll('address');
      if (asked.includes(bad)) {
        return { ok: false, status: 422, text: async () => JSON.stringify({ detail: [{ loc: ['query', 'address', asked.indexOf(bad)], msg: 'invalid address' }] }) } as any;
      }
      return { ok: true, status: 200, json: async () => ({ accounts: asked.map((a) => ({ address: a, status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '9' })) }) } as any;
    };
    const request = createShardStatesRequest({ endpoint: ENDPOINT, fetch: fetchImpl, strict: true });
    const states = await readAccountStates([good1, bad, good2], { request });
    expect(states.get(good1)?.status, 'the first good address was read').toBe('active');
    expect(states.get(good2)?.status, 'the second good address was read').toBe('active');
    expect(states.get(bad)?.status, 'the refused address is UNKNOWN, present, unmarked').toBe('unknown');
    expect(states.get(bad)?.refused).toBe(true);
    expect(states.get(bad)?.lastLt ?? null, 'no marker — a lane reads it and remembers nothing').toBeNull();
    // Bisected, not abandoned: [3] → [2] + [1]; [2] = [good1, bad] → [good1] + [bad]. Five requests, no throw.
    expect(urls.length).toBe(5);
    // And the reason is in the error text now, not only the status.
    await expect(readAccountStates([bad], { request })).resolves.toBeTruthy();   // single refused → unknown, no throw
    const plain = createShardStatesRequest({ endpoint: ENDPOINT, fetch: async () => ({ ok: false, status: 422, text: async () => '{"detail":"why"}' }) as any });
    await expect(plain({ path: '/accountStates?address=x' })).rejects.toThrow(/HTTP 422: \{"detail":"why"\}/);
  });

  it('RPC-04D: when toncenter NAMES the refused position, that address is excised in one request and remembered for the session', async () => {
    // OWNER'S CONSOLE 2026-08-21, after RPC-04C shipped: a column of identical red 422 rows — the same probe, every
    // pass, bisected from the top every time. Two facts the first cut missed. (1) toncenter v3 says WHICH address:
    // {"error":"failed to decode: schema: error converting value for index N of \"address\""} — measured live the
    // same day. (2) A refusal is about the address, not the moment, so asking again next pass is the same 422.
    // So: excise the named index and ask the rest ONCE (2 requests for any batch size, not 2·log2 N), and remember
    // the refused wire address so later batches answer it from memory with no request at all.
    __resetRefusedAddressesForTests();
    const addrs = Array.from({ length: 8 }, (_, i) => '0:' + (0x60 + i).toString(16).repeat(32));
    const bad = addrs[5];
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(String(url));
      const asked = new URL(String(url)).searchParams.getAll('address');
      const at = asked.indexOf(bad);
      if (at >= 0) {
        // The live body, verbatim shape (a Go schema decoder naming the index).
        return { ok: false, status: 422, text: async () => `{"error":"failed to decode: schema: error converting value for index ${at} of \\"address\\""}` } as any;
      }
      return { ok: true, status: 200, json: async () => ({ accounts: asked.map((a) => ({ address: a, status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '9' })) }) } as any;
    };
    const request = createShardStatesRequest({ endpoint: ENDPOINT, fetch: fetchImpl, strict: true });
    const first = await readAccountStates(addrs, { request });
    expect(urls.length, 'full batch (422, index named) + the other seven in ONE request').toBe(2);
    expect(new URL(urls[1]).searchParams.getAll('address')).toEqual(addrs.filter((a) => a !== bad));
    for (const a of addrs) expect(first.get(a)?.status, a).toBe(a === bad ? 'unknown' : 'active');
    expect(first.get(bad)?.refused).toBe(true);
    // Next pass: the refused address never reaches the wire again; the rest is one clean request.
    const second = await readAccountStates(addrs, { request });
    expect(urls.length, 'one more request, and it does not carry the refused address').toBe(3);
    expect(new URL(urls[2]).searchParams.getAll('address')).not.toContain(bad);
    expect(second.get(bad)?.status, 'still present as UNKNOWN — never omitted').toBe('unknown');
    expect(second.size).toBe(8);
    // The parser itself, against the live body and against bodies that do not name a position.
    expect(refusedIndexFromDetail('{"error":"failed to decode: schema: error converting value for index 0 of \\"address\\""}')).toBe(0);
    expect(refusedIndexFromDetail('{"error":"failed to decode: schema: error converting value for index 1023 of "address"}')).toBe(1023);
    expect(refusedIndexFromDetail('{"detail":[{"loc":["query","address",3],"msg":"invalid address"}]}')).toBe(-1);
    expect(refusedIndexFromDetail('')).toBe(-1);
    expect(refusedIndexFromDetail(null)).toBe(-1);
    // An index the body names but the batch does not have (a proxy's lie) falls back to bisection, never throws.
    __resetRefusedAddressesForTests();
    const lying = createShardStatesRequest({ endpoint: ENDPOINT, fetch: async (url: string) => {
      const asked = new URL(String(url)).searchParams.getAll('address');
      if (asked.length > 1) return { ok: false, status: 422, text: async () => '{"error":"failed to decode: schema: error converting value for index 99 of \\"address\\""}' } as any;
      return { ok: true, status: 200, json: async () => ({ accounts: asked.map((a) => ({ address: a, status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '9' })) }) } as any;
    }, strict: true });
    const viaBisect = await readAccountStates(addrs.slice(0, 2), { request: lying });
    expect(viaBisect.size).toBe(2);
    __resetRefusedAddressesForTests();
  });

  it('RPC-04E: a 422 that is the endpoint\'s DEADLINE splits the batch, refuses nothing, and makes the next batches smaller', async () => {
    // OWNER'S CONSOLE 2026-08-22: "[states] HTTP 422 on a batch of 342 addresses … the endpoint said:
    // {"error":"context deadline exceeded"}". toncenter wears its own timeout as a 422. That is about the batch
    // against their clock, not about any address, so: split it (the halves fit), memoise NOTHING as refused, and
    // build the next batches under a lowered ceiling so the deadline is not paid again every pass — then double
    // the ceiling back after a clean run. A single address that times out is UNKNOWN this pass, unrefused, and
    // goes back on the wire next time.
    __resetRefusedAddressesForTests();
    expect(isDeadlineDetail('{"error":"context deadline exceeded"}')).toBe(true);
    expect(isDeadlineDetail('{"error":"request timed out"}')).toBe(true);
    expect(isDeadlineDetail('{"error":"failed to decode: schema: error converting value for index 3 of \\"address\\""}')).toBe(false);
    const addrs = Array.from({ length: 200 }, (_, i) => '0:' + (0x100 + i).toString(16).padStart(2, '0').repeat(32).slice(0, 64));
    const sizes: number[] = [];
    let tooSlowAbove = 100;                     // the endpoint answers batches of ≤ 100 in time, larger ones time out
    // Driven DIRECTLY (no pump: it spaces real requests ~1 s apart and this gate makes two dozen), with errors
    // shaped exactly as createShardStatesRequest shapes them — status and detail on the Error (RPC-04C proves that).
    const deadline = () => Object.assign(new Error('accountStates failed with HTTP 422: {"error":"context deadline exceeded"}'), { status: 422, detail: '{"error":"context deadline exceeded"}' });
    const request = async ({ path }: { path: string }) => {
      const asked = new URL('https://x' + path).searchParams.getAll('address');
      sizes.push(asked.length);
      if (asked.length > tooSlowAbove) throw deadline();
      return { accounts: asked.map((a) => ({ address: a, status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '9' })) };
    };
    const first = await readAccountStates(addrs, { request });
    expect(sizes, 'the full batch timed out, its halves answered').toEqual([200, 100, 100]);
    expect(first.size).toBe(200);
    expect([...first.values()].every((row) => row.status === 'active'), 'every address read, none refused').toBe(true);
    expect(__statesBatchCeilingForTests(), 'the ceiling dropped to half the batch that timed out').toBe(100);
    // Next pass: built under the ceiling up front — two requests, no deadline paid.
    sizes.length = 0;
    await readAccountStates(addrs, { request });
    expect(sizes).toEqual([100, 100]);
    // After a clean run the ceiling doubles back (towards the measured URL limit), so a transient slow spell does
    // not cost the small batches forever.
    tooSlowAbove = 1024;
    for (let i = 0; i < 8; i += 1) await readAccountStates(addrs, { request });   // 16 clean batches of 100
    expect(__statesBatchCeilingForTests()).toBe(200);
    sizes.length = 0;
    await readAccountStates(addrs, { request });
    expect(sizes, 'one batch again').toEqual([200]);
    // A SINGLE address that times out is unknown and unrefused — and asked again next pass.
    __resetRefusedAddressesForTests();
    let calls = 0;
    const slowOne = async () => { calls += 1; throw deadline(); };
    const lone = addrs[0];
    const one = await readAccountStates([lone], { request: slowOne });
    expect(one.get(lone)).toMatchObject({ status: 'unknown', refused: false, unanswered: true });
    expect(one.get(lone)?.lastLt ?? null, 'no marker — the lane reads it the slow way').toBeNull();
    await readAccountStates([lone], { request: slowOne });
    expect(calls, 'asked again — a deadline is not a refusal to remember').toBe(2);
    __resetRefusedAddressesForTests();
  });

  it('RPC-04F: the learned batch ceiling can be seeded and is reported on every change — so a device can remember it across reloads', async () => {
    // OWNER'S CONSOLE 2026-08-22, after RPC-04E shipped: the deadline still fired once per session, on the first and
    // biggest batch (666 addresses), because the ceiling lived in memory. The module owns no storage, so it exposes
    // the two halves: seed (the app reads its stored value at boot) and subscribe (the app writes every change).
    __resetRefusedAddressesForTests();
    const seen: number[] = [];
    const unsubscribe = subscribeStatesBatchCeiling((c) => seen.push(c));
    // Seeding clamps to [floor, maximum] and does not notify (nothing changed on the wire yet).
    expect(seedStatesBatchCeiling(100)).toBe(100);
    expect(seedStatesBatchCeiling(5)).toBe(32);
    expect(seedStatesBatchCeiling(99_999)).toBe(1024);
    expect(seedStatesBatchCeiling('nonsense')).toBe(1024);
    expect(seen).toEqual([]);
    seedStatesBatchCeiling(200);
    // A seeded device builds its FIRST batch under the seed — the deadline is not paid to relearn it.
    const addrs = Array.from({ length: 400 }, (_, i) => '0:' + (0x200 + i).toString(16).padStart(2, '0').repeat(32).slice(0, 64));
    const sizes: number[] = [];
    let tooSlowAbove = 1024;
    const deadline = () => Object.assign(new Error('accountStates failed with HTTP 422: {"error":"context deadline exceeded"}'), { status: 422, detail: '{"error":"context deadline exceeded"}' });
    const request = async ({ path }: { path: string }) => {
      const asked = new URL('https://x' + path).searchParams.getAll('address');
      sizes.push(asked.length);
      if (asked.length > tooSlowAbove) throw deadline();
      return { accounts: asked.map((a) => ({ address: a, status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '9' })) };
    };
    await readAccountStates(addrs, { request });
    expect(sizes, 'batches built under the seeded ceiling').toEqual([200, 200]);
    // A timeout lowers it and is reported; a clean run raises it and is reported.
    tooSlowAbove = 100;
    sizes.length = 0;
    await readAccountStates(addrs, { request });
    expect(__statesBatchCeilingForTests()).toBe(100);
    expect(seen).toEqual([100]);
    tooSlowAbove = 1024;
    for (let i = 0; i < 4; i += 1) await readAccountStates(addrs, { request });   // 16 clean batches of 100
    expect(__statesBatchCeilingForTests()).toBe(200);
    expect(seen).toEqual([100, 200]);
    unsubscribe();
    seedStatesBatchCeiling(50); tooSlowAbove = 10;
    await readAccountStates(addrs.slice(0, 20), { request });
    expect(seen, 'an unsubscribed listener hears nothing more').toEqual([100, 200]);
    __resetRefusedAddressesForTests();
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

  it('RPC-WIN-01: a window can be moved BACK — by lt or by time — and the bounds reach the wire only when asked', async () => {
    // Two readers page a shard's bodies backwards now: the comment thread by `end_lt` (older pages of "show earlier
    // comments") and the INTRO lane by `start_utime`/`end_utime` (an entry whose body fell out of the newest window).
    // Both parameters were MEASURED honoured by toncenter v3 on 2026-08-21. A plain read must not carry them, or a
    // proxy that trips on unknown parameters would break every read, not just the paged ones.
    const rows = Array.from({ length: 2 }, () => ({ opcode: '0x50535031', source: null, created_lt: '5000', message_content: { body: psp1Body() } }));
    const read = createShardMessagesWithSourceReader({ endpoint: MESSAGES, opcode: PSP1, limit: 4, fetch: fakeFetch({ messages: rows }) });
    await read('0:' + '44'.repeat(32));
    expect(seen[0].url).not.toMatch(/end_lt=|start_utime=|end_utime=/);
    const plain = await read('0:' + '44'.repeat(32), { endLt: '7777' });
    expect(seen[1].url).toContain('end_lt=7777');
    expect(plain[0].createdLt, 'each row reports where it sits in the history').toBe('5000');
    await read('0:' + '44'.repeat(32), { startUtime: 1_790_000_000, endUtime: 1_790_000_600 });
    expect(seen[2].url).toContain('start_utime=1790000000');
    expect(seen[2].url).toContain('end_utime=1790000600');
    expect(seen[2].url, 'a time-bounded read carries no lt bound').not.toContain('end_lt=');
    // An endpoint that IGNORED end_lt would hand the newest rows back under an older name: rows above the bound are
    // dropped here rather than trusted.
    const above = await read('0:' + '44'.repeat(32), { endLt: '10' });
    expect(above, 'rows newer than the bound never come back').toEqual([]);
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE PUMP THIS LANE RIDES — one queue, at the configured cadence.
//
// MEASURED 2026-08-04 against live toncenter: six consecutive shard reads landed 1775 / 1605 / 1619 / 1588 /
// 1602 ms apart — 8.3 seconds for six requests, on a key whose configured spacing is 125 ms. The lane passed no
// spacing at all, so every request inherited ton-rpc-transport's 1500 ms module default, and it did so on its own
// 'shard-scan' limiter key: a SECOND single-worker queue beside the shared one. Twelve times too slow on the
// entire receive path — a quiet conversation's "syncing" spinner stood for ~20 seconds doing nothing but waiting
// its turn — and two parallel connections to one host, which platho-config calls out as the iPhone-freeze shape.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('SHARD-RPC — the scan lane rides the app pump at the app cadence', () => {
  it('RPC-PACE-01: the configured spacing REACHES the wire (it used to stop at the module default)', async () => {
    // Timed on purpose: the spacing is only observable as delay, so asserting on an options object would pass
    // just as happily if the value were dropped one call later. Its own limiter key keeps the shared queue's
    // state out of this measurement.
    (globalThis as any).plathoToncenterApiKey = 'a-key';
    (globalThis as any).plathoTonRpcConfig = {
      primaryProviderId: 'p',
      providers: [{ id: 'p', useUserApiKey: true, requestSpacingMs: 20, rateLimitKey: 'test-scan-pacing' }],
    };
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, fetch: fakeFetch({ messages: [] }),
    });

    const startedAt = Date.now();
    for (const index of [0, 1, 2, 3]) await read(`0:${String(index).repeat(64)}`);
    const elapsedMs = Date.now() - startedAt;

    expect(seen.length, 'four reads, four requests').toBe(4);
    // Four requests at the 1500 ms default cost >= 4500 ms; at the configured 20 ms they cost ~60 ms. Anything
    // under this threshold can only be the configured value — the gap between the two is two orders of magnitude.
    expect(elapsedMs, `four paced reads took ${elapsedMs} ms — the module default would cost 4500`).toBeLessThan(700);
  });

  it('RPC-PACE-02: the cadence and the queue come from the REAL config, keyed and keyless', () => {
    // The values themselves, against what the app actually ships — a fast lane pointed at the wrong queue would
    // put two lanes x 8 rps against a 10 rps key cap, so the pair has to be read together.
    (globalThis as any).plathoToncenterApiKey = 'a-key';
    expect(toncenterScanLaneOptions(PLATHO_APP_CONFIG.network.tonRpc)).toEqual({
      rateLimitKey: 'toncenter-shared',
      requestSpacingMs: 125,
    });

    // No key: anonymous toncenter is ~1 rps and the lane must slow down with everything else, not race ahead.
    delete (globalThis as any).plathoToncenterApiKey;
    expect(toncenterScanLaneOptions(PLATHO_APP_CONFIG.network.tonRpc).requestSpacingMs).toBe(1100);
  });

  it('RPC-PACE-04: a DECLINED request is not an empty shard — strict callers get a throw', async () => {
    // scheduleToncenterHttpRequest resolves to undefined when the pump refuses a request outright (a 429 backoff,
    // with skipIfRateLimited set). For a lane that re-reads its whole window every pass, calling that "no messages"
    // is harmless. For conv-lane, which REMEMBERS what it read, it is a silent loss: the shard gets recorded as
    // read at its current change marker and is skipped until somebody writes to it again — a capsule sitting in it
    // is never delivered, and every counter reports a clean pass.
    (globalThis as any).plathoToncenterApiKey = 'a-key';
    (globalThis as any).plathoTonRpcConfig = {
      primaryProviderId: 'p',
      providers: [{ id: 'p', useUserApiKey: true, requestSpacingMs: 5, rateLimitKey: 'test-declined-lane' }],
    };
    // A fetch that never runs, because the pump declines first: emulate the decline by making the scheduled request
    // resolve to nothing, which is exactly the shape scheduleToncenterRequest returns on a skip.
    const declining = async () => undefined as any;

    const lenient = createShardMessagesWithSourceReader({ endpoint: MESSAGES, opcode: PSP1, fetch: declining });
    await expect(lenient('0:' + '77'.repeat(32)), 'the default stays lenient — the other lanes rely on it').resolves.toEqual([]);

    const strict = createShardMessagesWithSourceReader({ endpoint: MESSAGES, opcode: PSP1, fetch: declining, strict: true });
    await expect(strict('0:' + '77'.repeat(32)), 'strict refuses to manufacture an empty window').rejects.toThrow(/did not run/);
  });

  it('RPC-PACE-03: no config yet — the lane still runs, at the safe default', () => {
    // Boot order is not something this module gets to assume. Before installConfiguredTonRuntime has published a
    // config, an empty answer leaves scheduleToncenterHttpRequest on its own conservative default rather than
    // inventing a fast one.
    delete (globalThis as any).plathoTonRpcConfig;
    expect(toncenterScanLaneOptions()).toEqual({});
  });
});
