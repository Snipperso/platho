import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { beginCell } from '@ton/core';
import { createShardStatesRequest, createShardMessagesReader, createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';
import { readAccountStates, refusedIndexFromDetail, isDeadlineDetail, seedStatesBatchCeiling, subscribeStatesBatchCeiling, __resetRefusedAddressesForTests, __statesBatchCeilingForTests } from '../web/shard-reader.mjs';
import { toncenterScanLaneOptions } from '../web/ton-rpc-transport.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';


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
    (globalThis as any).plathoToncenterApiKey = 'secret-key-value';
    const request = createShardStatesRequest({ endpoint: ENDPOINT, fetch: fakeFetch({ accounts: [] }) });
    await readAccountStates(['0:' + '11'.repeat(32)], { request });

    expect(seen[0].headers['X-API-Key'], 'the key rides in the header').toBe('secret-key-value');
    expect(seen[0].url, 'and never in the URL').not.toContain('secret-key-value');
  });

  it('RPC-03: a rate-limited pass returns empty rather than throwing', async () => {
    const request = createShardStatesRequest({
      endpoint: ENDPOINT,
      fetch: async () => null as any,
    });
    const states = await readAccountStates(['0:' + '22'.repeat(32)], { request });
    expect(states.size, 'a declined pass is empty, not broken').toBe(0);
  });

  it('RPC-04: an HTTP failure IS raised — a bad response must not look like an empty bucket', async () => {
    const request = createShardStatesRequest({
      endpoint: ENDPOINT, fetch: fakeFetch({}, false, 503),
    });
    await expect(readAccountStates(['0:' + '33'.repeat(32)], { request }))
      .rejects.toThrow(/HTTP 503/);
  });

  it('RPC-04C: a 422 is bisected — one refused address costs one UNKNOWN row, never the whole probe', async () => {
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
    expect(urls.length).toBe(2);
    await expect(readAccountStates([bad], { request })).resolves.toBeTruthy();

    __resetRefusedAddressesForTests();
    const blindUrls: string[] = [];
    const blindFetch = async (url: string) => {
      blindUrls.push(String(url));
      const asked = new URL(String(url)).searchParams.getAll('address');
      if (asked.includes(bad)) return { ok: false, status: 422, text: async () => '{"detail":"invalid address"}' } as any;
      return { ok: true, status: 200, json: async () => ({ accounts: asked.map((a) => ({ address: a, status: 'active', balance: '1', data_hash: 'h', last_transaction_lt: '9' })) }) } as any;
    };
    const blind = await readAccountStates([good1, bad, good2], { request: createShardStatesRequest({ endpoint: ENDPOINT, fetch: blindFetch, strict: true }) });
    expect(blind.get(good1)?.status).toBe('active');
    expect(blind.get(good2)?.status).toBe('active');
    expect(blind.get(bad)?.status).toBe('unknown');
    expect(blindUrls.length, 'an unnamed refusal bisects: [3] → [2] + [1] → [1] + [1]').toBe(5);
    const plain = createShardStatesRequest({ endpoint: ENDPOINT, fetch: async () => ({ ok: false, status: 422, text: async () => '{"detail":"why"}' }) as any });
    await expect(plain({ path: '/accountStates?address=x' })).rejects.toThrow(/HTTP 422: \{"detail":"why"\}/);
  });

  it('RPC-04D: when toncenter NAMES the refused position, that address is excised in one request and remembered for the session', async () => {
    __resetRefusedAddressesForTests();
    const addrs = Array.from({ length: 8 }, (_, i) => '0:' + (0x60 + i).toString(16).repeat(32));
    const bad = addrs[5];
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(String(url));
      const asked = new URL(String(url)).searchParams.getAll('address');
      const at = asked.indexOf(bad);
      if (at >= 0) {
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
    const second = await readAccountStates(addrs, { request });
    expect(urls.length, 'one more request, and it does not carry the refused address').toBe(3);
    expect(new URL(urls[2]).searchParams.getAll('address')).not.toContain(bad);
    expect(second.get(bad)?.status, 'still present as UNKNOWN — never omitted').toBe('unknown');
    expect(second.size).toBe(8);
    expect(refusedIndexFromDetail('{"error":"failed to decode: schema: error converting value for index 0 of \\"address\\""}')).toBe(0);
    expect(refusedIndexFromDetail('{"error":"failed to decode: schema: error converting value for index 1023 of "address"}')).toBe(1023);
    expect(refusedIndexFromDetail('{"detail":[{"loc":["query","address",3],"msg":"invalid address"}]}')).toBe(-1);
    expect(refusedIndexFromDetail('')).toBe(-1);
    expect(refusedIndexFromDetail(null)).toBe(-1);
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
    __resetRefusedAddressesForTests();
    expect(isDeadlineDetail('{"error":"context deadline exceeded"}')).toBe(true);
    expect(isDeadlineDetail('{"error":"request timed out"}')).toBe(true);
    expect(isDeadlineDetail('{"error":"failed to decode: schema: error converting value for index 3 of \\"address\\""}')).toBe(false);
    const addrs = Array.from({ length: 200 }, (_, i) => '0:' + (0x100 + i).toString(16).padStart(2, '0').repeat(32).slice(0, 64));
    const sizes: number[] = [];
    let tooSlowAbove = 100;
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
    sizes.length = 0;
    await readAccountStates(addrs, { request });
    expect(sizes).toEqual([100, 100]);
    tooSlowAbove = 1024;
    for (let i = 0; i < 8; i += 1) await readAccountStates(addrs, { request });
    expect(__statesBatchCeilingForTests()).toBe(200);
    sizes.length = 0;
    await readAccountStates(addrs, { request });
    expect(sizes, 'one batch again').toEqual([200]);
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
    __resetRefusedAddressesForTests();
    const seen: number[] = [];
    const unsubscribe = subscribeStatesBatchCeiling((c) => seen.push(c));
    expect(seedStatesBatchCeiling(100)).toBe(100);
    expect(seedStatesBatchCeiling(5)).toBe(32);
    expect(seedStatesBatchCeiling(99_999)).toBe(1024);
    expect(seedStatesBatchCeiling('nonsense')).toBe(1024);
    expect(seen).toEqual([]);
    seedStatesBatchCeiling(200);
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
    tooSlowAbove = 100;
    sizes.length = 0;
    await readAccountStates(addrs, { request });
    expect(__statesBatchCeilingForTests()).toBe(100);
    expect(seen).toEqual([100]);
    tooSlowAbove = 1024;
    for (let i = 0; i < 4; i += 1) await readAccountStates(addrs, { request });
    expect(__statesBatchCeilingForTests()).toBe(200);
    expect(seen).toEqual([100, 200]);
    unsubscribe();
    seedStatesBatchCeiling(50); tooSlowAbove = 10;
    await readAccountStates(addrs.slice(0, 20), { request });
    expect(seen, 'an unsubscribed listener hears nothing more').toEqual([100, 200]);
    __resetRefusedAddressesForTests();
  });

  it('RPC-04G: a deadline that recurs at every size splits down to the floor and no further — bounded, not 2N requests', async () => {
    __resetRefusedAddressesForTests();
    const addrs = Array.from({ length: 256 }, (_, i) => '0:' + (0x300 + i).toString(16).padStart(2, '0').repeat(32).slice(0, 64));
    const sizes: number[] = [];
    const request = async ({ addresses }: { addresses: string[] }) => { sizes.push(addresses.length); throw Object.assign(new Error('accountStates failed with HTTP 422: {"error":"context deadline exceeded"}'), { status: 422, detail: '{"error":"context deadline exceeded"}' }); };
    const states = await readAccountStates(addrs, { request });
    expect(sizes, 'the split stops at the floor and never re-asks a sibling at a refused size').toEqual([256, 128, 64, 32, 32, 32, 32, 32, 32, 32, 32]);
    expect(sizes.length, 'bounded: 11 requests for 256 addresses, not 2N').toBe(11);
    expect(states.size, 'every address answered in the map').toBe(256);
    expect([...states.values()].every((row) => row.status === 'unknown' && row.unanswered === true && row.refused === false), 'all unanswered, none refused').toBe(true);
    expect(__statesBatchCeilingForTests(), 'the ceiling sits at the floor for the next pass').toBe(32);
    __resetRefusedAddressesForTests();
  });

  it('RPC-PUMP-01: a request that never answers is cut by the pump, with its signal aborted, and the queue goes on', async () => {
    let signalSeen: AbortSignal | null = null;
    let hung = 0;
    const fetchImpl = async (url: string, init: any) => {
      if (String(url).includes('address=0%3A' + '77'.repeat(32))) {
        hung += 1;
        signalSeen = init?.signal ?? null;
        return new Promise<never>(() => {});
      }
      return { ok: true, status: 200, json: async () => ({ accounts: [] }) } as any;
    };
    const request = createShardStatesRequest({ endpoint: ENDPOINT, fetch: fetchImpl, strict: true, requestOptions: { requestTimeoutMs: 80, skipIfRateLimited: false } });
    const t0 = Date.now();
    await expect(readAccountStates(['0:' + '77'.repeat(32)], { request })).rejects.toThrow(/timed out after 80 ms/);
    expect(Date.now() - t0, 'cut by the request deadline, not by a longer one').toBeLessThan(5_000);
    expect(hung).toBe(1);
    expect(signalSeen?.aborted, 'the fetch was told to stop').toBe(true);
    const next = await readAccountStates(['0:' + '78'.repeat(32)], { request });
    expect(next.size).toBe(0);
  });

  it('RPC-04B: a STRICT reader refuses to turn a request that never ran into an empty account list', async () => {
    const declined = async () => null as any;
    const scan = createShardStatesRequest({ endpoint: ENDPOINT, fetch: declined });
    expect((await readAccountStates(['0:' + '44'.repeat(32)], { request: scan })).size).toBe(0);

    const strict = createShardStatesRequest({ endpoint: ENDPOINT, fetch: declined, strict: true });
    await expect(readAccountStates(['0:' + '44'.repeat(32)], { request: strict }))
      .rejects.toThrow(/absence is not proven/);
  });

  it('RPC-05: the messages reader returns cells, skips what it cannot parse, and never throws on junk', async () => {
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
    const payload = beginCell().storeUint(0x50535031, 32).endCell();
    const src = '0:' + 'c1'.repeat(32);
    const readWithSource = createShardMessagesWithSourceReader({
      endpoint: MESSAGES,
      fetch: fakeFetch({
        messages: [
          { source: src, message_content: { body: payload.toBoc().toString('base64') } },
          { source: '0:' + 'ff'.repeat(32), message_content: { body: 'not-a-cell' } },
          { message_content: { body: payload.toBoc().toString('base64') } },
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


const PSP1 = 0x50535031;
const psp1Body = () => beginCell().storeUint(PSP1, 32).endCell().toBoc().toString('base64');
const junkBody = () => beginCell().storeUint(0xdeadbeef, 32).endCell().toBoc().toString('base64');

const pagedFetch = (pages: any[][], pageSize = 4) => async (url: string, init: any) => {
  seen.push({ url: String(url), headers: init?.headers ?? {} });
  const offset = Number(new URL(String(url)).searchParams.get('offset') ?? 0);
  return { ok: true, status: 200, json: async () => ({ messages: pages[offset / pageSize] ?? [] }) } as any;
};

const offsetBlindFetch = (page: any[]) => async (url: string, init: any) => {
  seen.push({ url: String(url), headers: init?.headers ?? {} });
  return { ok: true, status: 200, json: async () => ({ messages: page }) } as any;
};

describe('SHARD-RPC — the opcode-filtered history window', () => {
  it('RPC-OP-01: the opcode goes on the wire as 0x-hex — a decimal value is rejected with 422', async () => {
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
    const above = await read('0:' + '44'.repeat(32), { endLt: '10' });
    expect(above, 'rows newer than the bound never come back').toEqual([]);
  });

  it('RPC-OP-03: an endpoint that IGNORES the filter is detected by the rows, and paged past', async () => {
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
    expect(seen.length).toBe(3);
    expect(seen[2].url).toContain('offset=8');
  });

  it('RPC-OP-04: a row with NO opcode field is KEPT — an indexer that does not decode opcodes must not blind us', async () => {
    const read = createShardMessagesWithSourceReader({
      endpoint: MESSAGES, opcode: PSP1, limit: 8,
      fetch: fakeFetch({
        messages: [
          { source: null, message_content: { body: psp1Body() } },
          { opcode: null, source: null, message_content: { body: psp1Body() } },
          { opcode: '', source: null, message_content: { body: psp1Body() } },
          { opcode: '0xdeadbeef', source: null, message_content: { body: junkBody() } },
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

describe('SHARD-RPC — the scan lane rides the app pump at the app cadence', () => {
  it('RPC-PACE-01: the configured spacing REACHES the wire (it used to stop at the module default)', async () => {
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
    expect(elapsedMs, `four paced reads took ${elapsedMs} ms — the module default would cost 4500`).toBeLessThan(700);
  });

  it('RPC-PACE-02: the cadence and the queue come from the REAL config, keyed and keyless', () => {
    (globalThis as any).plathoToncenterApiKey = 'a-key';
    expect(toncenterScanLaneOptions(PLATHO_APP_CONFIG.network.tonRpc)).toEqual({
      rateLimitKey: 'toncenter-shared',
      requestSpacingMs: 125,
    });

    delete (globalThis as any).plathoToncenterApiKey;
    expect(toncenterScanLaneOptions(PLATHO_APP_CONFIG.network.tonRpc).requestSpacingMs).toBe(1100);
  });

  it('RPC-PACE-04: a DECLINED request is not an empty shard — strict callers get a throw', async () => {
    (globalThis as any).plathoToncenterApiKey = 'a-key';
    (globalThis as any).plathoTonRpcConfig = {
      primaryProviderId: 'p',
      providers: [{ id: 'p', useUserApiKey: true, requestSpacingMs: 5, rateLimitKey: 'test-declined-lane' }],
    };
    const declining = async () => undefined as any;

    const lenient = createShardMessagesWithSourceReader({ endpoint: MESSAGES, opcode: PSP1, fetch: declining });
    await expect(lenient('0:' + '77'.repeat(32)), 'the default stays lenient — the other lanes rely on it').resolves.toEqual([]);

    const strict = createShardMessagesWithSourceReader({ endpoint: MESSAGES, opcode: PSP1, fetch: declining, strict: true });
    await expect(strict('0:' + '77'.repeat(32)), 'strict refuses to manufacture an empty window').rejects.toThrow(/did not run/);
  });

  it('RPC-PACE-03: no config yet — the lane still runs, at the safe default', () => {
    delete (globalThis as any).plathoTonRpcConfig;
    expect(toncenterScanLaneOptions()).toEqual({});
  });
});
