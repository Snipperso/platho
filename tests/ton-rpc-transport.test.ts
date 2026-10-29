import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clearToncenterMessagesCache,
  clearToncenterRunGetMethodCache,
  createFallbackTonRpcTransport,
  createTonCenterV3Transport,
  createTonRpcTransport,
  decodeTonAddressSliceBoc,
  encodeTonAddressSliceBoc,
  parseStackBigIntValue,
} from '../web/ton-rpc-transport.mjs';

const NOW = Date.UTC(2026, 0, 3, 10, 0, 0);
const OWNER = `0:${'11'.repeat(32)}`;
const VAULT = `0:${'22'.repeat(32)}`;

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

describe('Vault TON RPC provider', () => {
  it('VAULT-RPC-01: encodes and decodes TON address slice BoC for get_user', () => {
    const boc = encodeTonAddressSliceBoc(OWNER);

    expect(boc).toMatch(/^te6/);
    expect(decodeTonAddressSliceBoc(boc)).toBe(OWNER);
  });



  it('VAULT-RPC-04: wraps TON Center v3 runGetMethod with explicit endpoint and API key', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      apiKey: 'test-api-key',
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(1n)] };
          },
        };
      },
    });

    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_key_record',
      stack: [{ type: 'num', value: '0x7' }],
    })).resolves.toMatchObject({ exit_code: 0 });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://toncenter.example/api/v3/runGetMethod');
    expect(requests[0].init.headers['X-API-Key']).toBe('test-api-key');
    expect(JSON.parse(requests[0].init.body)).toEqual({
      address: VAULT,
      method: 'get_key_record',
      stack: [{ type: 'num', value: '0x7' }],
    });
  });

  it('VAULT-RPC-04B: wraps configured sendBoc endpoint for embedded wallet broadcasts', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      sendBocEndpoint: 'https://toncenter.example/api/v3/message',
      apiKey: 'test-api-key',
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, result: { hash: 'abc' } };
          },
        };
      },
    });

    await expect(transport.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://toncenter.example/api/v3/message');
    expect(requests[0].init.headers['X-API-Key']).toBe('test-api-key');
    expect(JSON.parse(requests[0].init.body)).toEqual({ boc: 'te6ccgEBAQEAAgAAAA==' });
  });

  it('VAULT-RPC-04B1: preserves upstream sendBoc error details for diagnostics', async () => {
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      sendBocEndpoint: 'https://toncenter.example/api/v3/message',
      requestSpacingMs: 0,
      fetch: async () => {
        const response = {
          ok: false,
          status: 500,
          clone() {
            return response;
          },
          async text() {
            return JSON.stringify({ error: 'external message was not accepted' });
          },
        };
        return response;
      },
    });

    let error: any = null;
    try {
      await transport.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      status: 500,
      code: 'HTTP_ERROR',
      responseBody: 'external message was not accepted',
    });
    expect(error?.message).toContain('TON RPC sendBoc HTTP 500: external message was not accepted');
  });

  it('VAULT-RPC-04B1A: prefers gateway upstream_error over generic gateway error', async () => {
    const upstreamDetail = 'LITE_SERVER_UNKNOWN: cannot apply external message to current state: External message was not accepted: cannot run message on account: exitcode=16483';
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      sendBocEndpoint: 'https://toncenter.example/api/v3/message',
      requestSpacingMs: 0,
      fetch: async () => {
        const response = {
          ok: false,
          status: 500,
          clone() {
            return response;
          },
          async text() {
            return JSON.stringify({
              ok: false,
              error: 'upstream request failed',
              upstream_status: 500,
              upstream_error: upstreamDetail,
            });
          },
        };
        return response;
      },
    });

    let error: any = null;
    try {
      await transport.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      status: 500,
      code: 'HTTP_ERROR',
      responseBody: upstreamDetail,
    });
    expect(error?.message).toContain(upstreamDetail);
    expect(error?.message).not.toContain('upstream request failed');
  });

  it('VAULT-RPC-04B2: wraps TON Center v3 messages endpoint through the shared limiter', async () => {
    clearToncenterMessagesCache();
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      apiKey: 'test-api-key',
      requestSpacingMs: 0,
      rateLimitKey: `messages-${Math.random()}`,
      fetch: async (url: string, init: any) => {
        requests.push({ url: String(url), init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { messages: [{ message_content: { body: 'te6ccgEBAQEAAgAAAA==' } }] };
          },
        };
      },
    });

    const params = {
      destination: VAULT,
      opcode: '0xA4F862C0',
      exclude_externals: true,
      limit: 100,
      sort: 'desc',
    };
    await expect(transport.getMessages(params)).resolves.toMatchObject({
      messages: [{ message_content: { body: 'te6ccgEBAQEAAgAAAA==' } }],
    });
    await expect(transport.getMessages({ ...params, sort: 'desc' })).resolves.toMatchObject({
      messages: [{ message_content: { body: 'te6ccgEBAQEAAgAAAA==' } }],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('https://toncenter.example/api/v3/messages?');
    expect(requests[0].url).toContain(`destination=${encodeURIComponent(VAULT)}`);
    expect(requests[0].url).toContain('opcode=0xA4F862C0');
    expect(requests[0].init.method).toBe('GET');
    expect(requests[0].init.headers['X-API-Key']).toBe('test-api-key');
  });

  it('VAULT-RPC-04C: surfaces TON Center 429 as a typed rate-limit error', async () => {
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitBackoffMs: 0,
      rateLimitRetries: 0,
      rateLimitKey: `test-${Math.random()}`,
      fetch: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => null },
        async json() {
          return {};
        },
      }),
    });

    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
    })).rejects.toMatchObject({
      name: 'TonRpcTransportError',
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('VAULT-RPC-04C2: a 429 without Retry-After carries the CONFIGURED backoff, not a hardcoded 60s', async () => {
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitBackoffMs: 7000,
      rateLimitRetries: 0,
      rateLimitKey: `test-${Math.random()}`,
      fetch: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => null },
        async json() {
          return {};
        },
      }),
    });

    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
    })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterMs: 7000,
    });
  });

  it('VAULT-RPC-04D: retries TON Center 429 once before surfacing success', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitBackoffMs: 0,
      rateLimitRetries: 1,
      rateLimitKey: `test-${Math.random()}`,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        if (requests.length === 1) {
          return {
            ok: false,
            status: 429,
            headers: { get: () => null },
            async json() {
              return {};
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(1n)] };
          },
        };
      },
    });

    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
      rateLimitBackoffMs: 0,
    })).resolves.toMatchObject({ exit_code: 0 });
    expect(requests).toHaveLength(2);
  });

  it('VAULT-RPC-04E: suppresses background get-method fetches during rate-limit cooldown', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitBackoffMs: 30_000,
      rateLimitRetries: 0,
      rateLimitKey: `test-${Math.random()}`,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: false,
          status: 429,
          headers: { get: () => null },
          async json() {
            return {};
          },
        };
      },
    });

    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
    })).rejects.toMatchObject({
      name: 'TonRpcTransportError',
      status: 429,
      code: 'RATE_LIMITED',
    });
    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_global',
      stack: [],
    })).rejects.toMatchObject({
      name: 'TonRpcTransportError',
      status: 429,
      code: 'RATE_LIMITED',
    });

    expect(requests).toHaveLength(1);
  });

  it('VAULT-RPC-04F: deduplicates identical in-flight runGetMethod requests', async () => {
    clearToncenterRunGetMethodCache();
    const requests: any[] = [];
    let releaseFetch: ((value: unknown) => void) | null = null;
    const fetchGate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitKey: `dedupe-${Math.random()}`,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        await fetchGate;
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(42n)] };
          },
        };
      },
    });

    const first = transport.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [{ type: 'num', value: '0x1' }],
    });
    const second = transport.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [{ value: '0x1', type: 'num' }],
    });
    releaseFetch?.(null);

    await expect(Promise.all([first, second])).resolves.toEqual([
      { exit_code: 0, stack: [num(42n)] },
      { exit_code: 0, stack: [num(42n)] },
    ]);
    expect(requests).toHaveLength(1);
  });

  it('VAULT-RPC-04G: serves repeated get-method calls from the TTL cache', async () => {
    clearToncenterRunGetMethodCache();
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitKey: `cache-${Math.random()}`,
      runGetMethodCacheTtlMs: 60_000,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(requests.length)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_global', stack: [] };
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });

    expect(requests).toHaveLength(1);
  });

  it('VAULT-RPC-04H: clears cached get-method and message-history reads after sendBoc succeeds', async () => {
    clearToncenterRunGetMethodCache();
    clearToncenterMessagesCache();
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      sendBocEndpoint: 'https://toncenter.example/api/v3/message',
      messagesEndpoint: 'https://toncenter.example/api/v3/messages',
      requestSpacingMs: 0,
      rateLimitKey: `cache-clear-${Math.random()}`,
      runGetMethodCacheTtlMs: 60_000,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        if (String(url).includes('/messages')) {
          const messageCount = requests.filter((request) => String(request.url).includes('/messages')).length;
          return {
            ok: true,
            status: 200,
            async json() {
              return { messages: [{ id: messageCount }] };
            },
          };
        }
        if (String(url).includes('/message')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { ok: true };
            },
          };
        }
        const getMethodCount = requests.filter((request) => String(request.url).includes('/runGetMethod')).length;
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(getMethodCount)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_global', stack: [] };
    const messages = { destination: VAULT, opcode: '0xA4F862C0', limit: 100 };
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport.getMessages(messages)).resolves.toMatchObject({ messages: [{ id: 1 }] });
    await expect(transport.getMessages(messages)).resolves.toMatchObject({ messages: [{ id: 1 }] });
    await expect(transport.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(2n)] });
    await expect(transport.getMessages(messages)).resolves.toMatchObject({ messages: [{ id: 2 }] });

    expect(requests.map((request) => String(request.url).split('?')[0])).toEqual([
      'https://toncenter.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/messages',
      'https://toncenter.example/api/v3/message',
      'https://toncenter.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/messages',
    ]);
  });

  it('VAULT-RPC-04H2: cacheTtlMs zero bypasses cached get-method and messages reads', async () => {
    clearToncenterRunGetMethodCache();
    clearToncenterMessagesCache();
    const requests: any[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      messagesEndpoint: 'https://toncenter.example/api/v3/messages',
      requestSpacingMs: 0,
      rateLimitKey: `fresh-cache-${Math.random()}`,
      runGetMethodCacheTtlMs: 60_000,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        if (String(url).includes('/messages')) {
          const messageCount = requests.filter((request) => String(request.url).includes('/messages')).length;
          return {
            ok: true,
            status: 200,
            async json() {
              return { messages: [{ id: messageCount }] };
            },
          };
        }
        const getMethodCount = requests.filter((request) => String(request.url).includes('/runGetMethod')).length;
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(getMethodCount)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_canonical_publish_charge', stack: [] };
    const messages = { destination: VAULT, opcode: '0xA4F862C0', limit: 100 };
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport.runGetMethod({ ...call, cacheTtlMs: 0 })).resolves.toMatchObject({ stack: [num(2n)] });
    await expect(transport.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport.getMessages(messages)).resolves.toMatchObject({ messages: [{ id: 1 }] });
    await expect(transport.getMessages(messages)).resolves.toMatchObject({ messages: [{ id: 1 }] });
    await expect(transport.getMessages(messages, { cacheTtlMs: 0 })).resolves.toMatchObject({ messages: [{ id: 2 }] });
    await expect(transport.getMessages(messages)).resolves.toMatchObject({ messages: [{ id: 1 }] });

    expect(requests.map((request) => String(request.url).split('?')[0])).toEqual([
      'https://toncenter.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/messages',
      'https://toncenter.example/api/v3/messages',
    ]);
    const messageRequests = requests.filter((request) => String(request.url).includes('/messages'));
    expect(messageRequests[0].init.cache).toBe('no-store');
    expect(messageRequests[1].init.cache).toBe('no-store');
  });

  it('VAULT-RPC-04H3: fresh get-method reads do not attach to cached in-flight requests', async () => {
    clearToncenterRunGetMethodCache();
    const requests: any[] = [];
    let releaseFetch: ((value: unknown) => void) | null = null;
    const fetchGate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitKey: `fresh-flight-${Math.random()}`,
      runGetMethodCacheTtlMs: 60_000,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        if (requests.length === 1) await fetchGate;
        const count = requests.length;
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(count)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_user', stack: [{ type: 'num', value: '0x1' }] };
    const cachedInFlight = transport.runGetMethod(call);
    const freshInFlight = transport.runGetMethod({ ...call, cacheTtlMs: 0 });
    releaseFetch?.(null);

    await expect(cachedInFlight).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(freshInFlight).resolves.toMatchObject({ stack: [num(2n)] });
    expect(requests).toHaveLength(2);
  });

  it('VAULT-RPC-04H4: fresh critical reads do not attach to lower-priority in-flight reads', async () => {
    clearToncenterRunGetMethodCache();
    const requests: any[] = [];
    let releaseFetch: ((value: unknown) => void) | null = null;
    const fetchGate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitKey: `fresh-critical-flight-${Math.random()}`,
      fetch: async (url: string, init: any) => {
        requests.push({ url, init });
        if (requests.length === 1) await fetchGate;
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(requests.length)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_private_sender_index', stack: [{ type: 'num', value: '0x1' }], cacheTtlMs: 0 };
    const syncRead = transport.runGetMethod({
      ...call,
      priority: 'messages',
      verify: false,
      allowUnverifiedCriticalRead: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(transport.runGetMethod({
      ...call,
      priority: 'critical',
      verify: true,
      queueTimeoutMs: 5,
      requestTimeoutMs: 50,
    })).rejects.toMatchObject({
      code: 'QUEUE_TIMEOUT',
    });

    expect(requests).toHaveLength(1);
    releaseFetch?.(null);
    await expect(syncRead).resolves.toMatchObject({ stack: [num(1n)] });
  });

  it('VAULT-RPC-04I: builds a fallback transport from provider config and skips missing custom globals', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'custom',
      fallbackProviderIds: ['toncenter'],
      providers: [
        { id: 'custom', kind: 'custom', globalName: `missingCustom${Math.random()}` },
        {
          id: 'toncenter',
          kind: 'toncenter-v3',
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.example/api/v3/message',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `fallback-config-${Math.random()}`,
      fetch: async (url: string, init: any) => {
        calls.push(String(url));
        return {
          ok: true,
          status: 200,
          async json() {
            return String(url).includes('/message')
              ? { ok: true, result: { hash: 'sent' } }
              : { exit_code: 0, stack: [num(9n)] };
          },
        };
      },
    });

    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_global',
      stack: [],
    })).resolves.toMatchObject({ stack: [num(9n)] });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    expect(calls).toEqual([
      'https://toncenter.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/message',
    ]);
  });

  it('VAULT-RPC-04I2: skips read-only providers when broadcasting BOCs from fallback config', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-readonly',
      fallbackProviderIds: ['toncenter-send'],
      providers: [
        {
          id: 'platho-readonly',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
          messagesEndpoint: false,
        },
        {
          id: 'toncenter-send',
          kind: 'toncenter-v3',
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.example/api/v3/message',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `fallback-send-config-${Math.random()}`,
      fetch: async (url: string) => {
        calls.push(String(url));
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, result: { hash: 'sent' } };
          },
        };
      },
    });

    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual(['https://toncenter.example/api/v3/message']);
  });

  it('VAULT-RPC-04I3: routes get-method reads only to providers that declare support for that method', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-readonly',
      fallbackProviderIds: ['toncenter-read'],
      providers: [
        {
          id: 'platho-readonly',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
          messagesEndpoint: false,
          supportedGetMethods: ['get_user'],
        },
        {
          id: 'toncenter-read',
          kind: 'toncenter-v3',
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `fallback-capability-config-${Math.random()}`,
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
      fetch: async (url: string, init: any) => {
        const method = JSON.parse(String(init?.body ?? '{}')).method;
        calls.push(`${String(url)}:${method}`);
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(method === 'get_user' ? 7n : 9n)] };
          },
        };
      },
    });

    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_key_record',
      stack: [],
    })).resolves.toMatchObject({ stack: [num(9n)] });
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
      verify: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });

    expect(calls).toEqual([
      'https://toncenter.example/api/v3/runGetMethod:get_key_record',
      'https://rpc.platho.example/api/v3/runGetMethod:get_user',
      'https://toncenter.example/api/v3/runGetMethod:get_user',
    ]);
  });

  it('VAULT-RPC-04I4: emergency-fallback providers are never critical-read verifiers; they serve reads/sends only as emergency fallback', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-rpc',
      fallbackProviderIds: [],
      providers: [
        {
          id: 'platho-rpc',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://rpc.platho.example/api/v3/message',
        },
        {
          id: 'toncenter-direct',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.example/api/v3/message',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `verifier-only-${Math.random()}`,
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
      fetch: async (url: string, init: any) => {
        const endpoint = String(url);
        if (endpoint.includes('/message')) {
          calls.push(endpoint);
          return {
            ok: true,
            status: 200,
            async json() {
              return { ok: true };
            },
          };
        }
        const method = JSON.parse(String(init?.body ?? '{}')).method;
        calls.push(`${endpoint}:${method}`);
        if (endpoint.includes('rpc.platho.example') && method === 'get_key_record') {
          return {
            ok: false,
            status: 503,
            async json() {
              return { ok: false };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(7n)] };
          },
        };
      },
    });

    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
      verify: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_key_record',
      stack: [],
    })).resolves.toMatchObject({ stack: [num(7n)] });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    expect(calls).toEqual([
      'https://rpc.platho.example/api/v3/runGetMethod:get_user',
      'https://rpc.platho.example/api/v3/runGetMethod:get_key_record',
      'https://toncenter.example/api/v3/runGetMethod:get_key_record',
      'https://rpc.platho.example/api/v3/message',
    ]);
  });

  it('VAULT-RPC-04I5: broadcasts through the emergency verifier-only transport when the primary send fails', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-rpc',
      fallbackProviderIds: [],
      providers: [
        {
          id: 'platho-rpc',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://rpc.platho.example/api/v3/message',
        },
        {
          id: 'toncenter-direct',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
          sendBocEndpoint: 'https://toncenter.example/api/v3/message',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `emergency-send-${Math.random()}`,
      fetch: async (url: string) => {
        const endpoint = String(url);
        calls.push(endpoint);
        if (endpoint.includes('rpc.platho.example')) {
          return {
            ok: false,
            status: 403,
            async json() {
              return { ok: false };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true };
          },
        };
      },
    });

    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([
      'https://rpc.platho.example/api/v3/message',
      'https://toncenter.example/api/v3/message',
    ]);
  });

  it('VAULT-RPC-04I6: parks a hard-failing primary transport and probes it again after the retry window', async () => {
    const calls: string[] = [];
    let plathoFailures = 0;
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-rpc',
      fallbackProviderIds: [],
      providers: [
        {
          id: 'platho-rpc',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
        },
        {
          id: 'toncenter-direct',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `transport-parking-${Math.random()}`,
      transportDeadRetryMs: 50,
      fetch: async (url: string) => {
        const endpoint = String(url);
        calls.push(endpoint);
        if (endpoint.includes('rpc.platho.example')) {
          if (plathoFailures < 2) {
            plathoFailures += 1;
            throw new TypeError('failed to fetch');
          }
          return {
            ok: true,
            status: 200,
            async json() {
              return { exit_code: 0, stack: [num(1n)] };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(9n)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_key_record', stack: [], cacheTtlMs: 0 };
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(9n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(9n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(9n)] });
    expect(transport?.isDegraded()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 70));
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(1n)] });
    expect(transport?.isDegraded()).toBe(false);

    expect(calls).toEqual([
      'https://rpc.platho.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/runGetMethod',
      'https://rpc.platho.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/runGetMethod',
      'https://toncenter.example/api/v3/runGetMethod',
      'https://rpc.platho.example/api/v3/runGetMethod',
    ]);
  });

  it('VAULT-RPC-04I7: never consults the keyless emergency transport as a critical-read verifier', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-rpc',
      fallbackProviderIds: [],
      providers: [
        {
          id: 'platho-rpc',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
        },
        {
          id: 'toncenter-direct',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `dead-verifier-${Math.random()}`,
      transportDeadRetryMs: 60_000,
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
      fetch: async (url: string) => {
        const endpoint = String(url);
        calls.push(endpoint);
        if (endpoint.includes('toncenter.example')) {
          throw new TypeError('failed to fetch');
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(7n)] };
          },
        };
      },
    });

    const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });

    const toncenterCalls = calls.filter((endpoint) => endpoint.includes('toncenter.example'));
    expect(toncenterCalls).toHaveLength(0);
  });

  it('VAULT-RPC-04I8: a keyless (403-prone) emergency transport is never a verifier; verification degrades to the single gateway', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-rpc',
      fallbackProviderIds: [],
      providers: [
        {
          id: 'platho-rpc',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
        },
        {
          id: 'toncenter-direct',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `verifier-403-${Math.random()}`,
      transportDeadRetryMs: 1,
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
      fetch: async (url: string) => {
        const endpoint = String(url);
        calls.push(endpoint);
        if (endpoint.includes('toncenter.example')) {
          return {
            ok: false,
            status: 403,
            async json() {
              return { ok: false };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(7n)] };
          },
        };
      },
    });

    expect(transport?.isVerificationDegraded()).toBe(true);
    const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    expect(transport?.isVerificationDegraded()).toBe(true);
    expect(transport?.isDegraded()).toBe(false);
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    const toncenterCalls = calls.filter((endpoint) => endpoint.includes('toncenter.example'));
    expect(toncenterCalls).toHaveLength(0);
    await expect(transport?.runGetMethod({
      ...call,
      verify: false,
      allowUnverifiedCriticalRead: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });
  });

  it('VAULT-RPC-04I8B: a keyless (429-prone) emergency transport is never a verifier; a single-gateway topology stays degraded', async () => {
    const calls: string[] = [];
    const transport = createTonRpcTransport({
      primaryProviderId: 'platho-rpc',
      fallbackProviderIds: [],
      providers: [
        {
          id: 'platho-rpc',
          kind: 'platho-rpc',
          runGetMethodEndpoint: 'https://rpc.platho.example/api/v3/runGetMethod',
        },
        {
          id: 'toncenter-direct',
          kind: 'toncenter-v3',
          verifierOnly: true,
          emergencyFallback: true,
          runGetMethodEndpoint: 'https://toncenter.example/api/v3/runGetMethod',
        },
      ],
      requestSpacingMs: 0,
      rateLimitKey: `verifier-429-${Math.random()}`,
      transportDeadRetryMs: 1,
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
      fetch: async (url: string) => {
        const endpoint = String(url);
        calls.push(endpoint);
        if (endpoint.includes('toncenter.example')) {
          return {
            ok: false,
            status: 429,
            async json() {
              return { ok: false };
            },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { exit_code: 0, stack: [num(7n)] };
          },
        };
      },
    });

    expect(transport?.isVerificationDegraded()).toBe(true);
    const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    expect(transport?.isVerificationDegraded()).toBe(true);
    expect(transport?.isDegraded()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(transport?.isVerificationDegraded()).toBe(true);
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    const toncenterCalls = calls.filter((endpoint) => endpoint.includes('toncenter.example'));
    expect(toncenterCalls).toHaveLength(0);
    await expect(transport?.runGetMethod({
      ...call,
      verify: false,
      allowUnverifiedCriticalRead: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });
  });

  it('VAULT-RPC-04I8C: toncenter-only — a no-key user-toncenter stays the non-emergency PRIMARY; verify:true self-trusts (the emergency keyless is never a verifier)', async () => {
    const calls: string[] = [];
    const prevKey = (globalThis as any).plathoToncenterApiKey;
    (globalThis as any).plathoToncenterApiKey = undefined;
    try {
      const transport = createTonRpcTransport({
        primaryProviderId: 'user-toncenter',
        fallbackProviderIds: ['keyless-toncenter'],
        providers: [
          {
            id: 'user-toncenter',
            kind: 'toncenter-v3',
            useUserApiKey: true,
            runGetMethodEndpoint: 'https://usertoncenter.example/api/v3/runGetMethod',
          },
          {
            id: 'keyless-toncenter',
            kind: 'toncenter-v3',
            verifierOnly: true,
            emergencyFallback: true,
            runGetMethodEndpoint: 'https://keyless.example/api/v3/runGetMethod',
          },
        ],
        requestSpacingMs: 0,
        rateLimitKey: `user-key-missing-${Math.random()}`,
        verifyCriticalReads: false,
        criticalMethods: ['get_user'],
        fetch: async (url: string) => {
          const endpoint = String(url);
          calls.push(endpoint);
          if (endpoint.includes('usertoncenter.example')) {
            return { ok: true, status: 200, async json() { return { exit_code: 0, stack: [num(7n)] }; } };
          }
          return { ok: false, status: 429, async json() { return { ok: false }; } };
        },
      });

      expect(transport?.isVerificationDegraded()).toBe(true);
      const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
      await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
      expect(calls.filter((endpoint) => endpoint.includes('keyless.example'))).toHaveLength(0);
    } finally {
      (globalThis as any).plathoToncenterApiKey = prevKey;
    }
  });

  it('VAULT-RPC-04J: falls back on rate-limited reads and sends', async () => {
    const primary = {
      kind: 'primary-rpc',
      async runGetMethod() {
        const error: any = new Error('primary limited');
        error.status = 429;
        error.code = 'RATE_LIMITED';
        throw error;
      },
      async sendBoc() {
        const error: any = new Error('primary limited');
        error.status = 429;
        error.code = 'RATE_LIMITED';
        throw error;
      },
    };
    const fallbackCalls: string[] = [];
    const fallback = {
      kind: 'fallback-rpc',
      async runGetMethod(call: any) {
        fallbackCalls.push(`read:${call.method}`);
        return { exit_code: 0, stack: [num(11n)] };
      },
      async sendBoc() {
        fallbackCalls.push('send');
        return { ok: true };
      },
    };
    const transport = createFallbackTonRpcTransport({ transports: [primary, fallback] });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).resolves.toMatchObject({ stack: [num(11n)] });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
    expect(fallbackCalls).toEqual(['read:get_global', 'send']);
  });

  it('VAULT-RPC-04K: stops the read fallback on a definitive uninitialized-account (-13) only when the caller opts in', async () => {
    const makeTransports = () => {
      const calls: string[] = [];
      const uninitialized = (kind: string) => ({
        kind,
        async runGetMethod(call: any) {
          calls.push(`${kind}:${call.method}`);
          const error: any = new Error('TON RPC get-method exit code -13');
          error.exitCode = -13;
          throw error;
        },
      });
      const primary = uninitialized('primary-rpc');
      const fallback = uninitialized('fallback-rpc');
      return { calls, transport: createFallbackTonRpcTransport({ transports: [primary, fallback] }) };
    };

    const optIn = makeTransports();
    await expect(optIn.transport?.runGetMethod({
      address: VAULT, method: 'seqno', stack: [], stopOnUninitializedAccount: true,
    })).rejects.toMatchObject({ exitCode: -13 });
    expect(optIn.calls).toEqual(['primary-rpc:seqno']);

    const noOptIn = makeTransports();
    await expect(noOptIn.transport?.runGetMethod({
      address: VAULT, method: 'get_global', stack: [],
    })).rejects.toMatchObject({ exitCode: -13 });
    expect(noOptIn.calls).toEqual(['primary-rpc:get_global', 'fallback-rpc:get_global']);
  });

  it('VAULT-RPC-04J1: read-only send fallback does not replace the real broadcast error', async () => {
    const primary = {
      kind: 'toncenter-send',
      supportsSendBoc: true,
      async sendBoc() {
        const error: any = new Error('primary limited');
        error.status = 429;
        error.code = 'RATE_LIMITED';
        throw error;
      },
    };
    const readonly = {
      kind: 'platho-readonly',
      supportsSendBoc: false,
      async sendBoc() {
        throw new Error('TON sendBoc endpoint is not configured');
      },
    };
    const transport = createFallbackTonRpcTransport({ transports: [primary, readonly] });

    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
  });

  it('VAULT-RPC-04J2: falls back after RPC request timeouts', async () => {
    const primary = createTonCenterV3Transport({
      endpoint: 'https://primary.example/api/v3/runGetMethod',
      sendBocEndpoint: 'https://primary.example/api/v3/message',
      requestSpacingMs: 0,
      requestTimeoutMs: 5,
      rateLimitKey: `timeout-primary-${Math.random()}`,
      fetch: async (_url: string, init: any) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener?.('abort', () => {
          const error: any = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    });
    const fallbackCalls: string[] = [];
    const fallback = {
      kind: 'fallback-rpc',
      async runGetMethod(call: any) {
        fallbackCalls.push(`read:${call.method}`);
        return { exit_code: 0, stack: [num(33n)] };
      },
      async sendBoc() {
        fallbackCalls.push('send');
        return { ok: true };
      },
    };
    const transport = createFallbackTonRpcTransport({ transports: [primary, fallback] });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).resolves.toMatchObject({ stack: [num(33n)] });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
    expect(fallbackCalls).toEqual(['read:get_global', 'send']);
  });

  it('VAULT-RPC-04J3: falls back when a custom read transport ignores request timeouts', async () => {
    const primary = {
      kind: 'custom-hanging-read',
      async runGetMethod() {
        return new Promise(() => {});
      },
    };
    const fallbackCalls: string[] = [];
    const fallback = {
      kind: 'fallback-rpc',
      async runGetMethod(call: any) {
        fallbackCalls.push(`read:${call.method}`);
        return { exit_code: 0, stack: [num(44n)] };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [primary, fallback],
      requestTimeoutMs: 5,
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_private_sender_index', stack: [] })).resolves.toMatchObject({ stack: [num(44n)] });
    expect(fallbackCalls).toEqual(['read:get_private_sender_index']);
  });

  it('VAULT-RPC-04J4: falls back when a custom send transport ignores request timeouts', async () => {
    const primary = {
      kind: 'custom-hanging-send',
      supportsSendBoc: true,
      async sendBoc() {
        return new Promise(() => {});
      },
    };
    const fallbackCalls: string[] = [];
    const fallback = {
      kind: 'fallback-rpc',
      supportsSendBoc: true,
      async sendBoc() {
        fallbackCalls.push('send');
        return { ok: true, result: { hash: 'fallback' } };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [primary, fallback],
      requestTimeoutMs: 5,
    });

    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
    expect(fallbackCalls).toEqual(['send']);
  });

  it('VAULT-RPC-04K: fails closed when critical read providers disagree', async () => {
    const first = {
      kind: 'first-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: [num(1n)] };
      },
    };
    const second = {
      kind: 'second-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: [num(2n)] };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [first, second],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).rejects.toMatchObject({
      name: 'TonRpcTransportError',
      code: 'RPC_DISAGREEMENT',
    });
  });

  it('RT-PWA-VLT-001: get_user critical verification tolerates volatile counter lag (balance/nonce), resolving to the primary', async () => {
    const baseUserStack = [
      num(-1n),
      num(100n),
      num(200n),
      num(300n),
      num(400n),
      num(500n),
    ];

    for (const [label, stackIndex, verifierValue] of [
      ['ton_balance', 1, 101n],
      ['ath_balance', 2, 201n],
      ['publish_nonce', 5, 501n],
    ] as const) {
      const first = {
        kind: `primary-${label}`,
        async runGetMethod() {
          return { exit_code: 0, stack: baseUserStack };
        },
      };
      const second = {
        kind: `verifier-${label}`,
        async runGetMethod() {
          const stack = [...baseUserStack];
          stack[stackIndex] = num(verifierValue);
          return { exit_code: 0, stack };
        },
      };
      const transport = createFallbackTonRpcTransport({
        transports: [first, second],
        verifyCriticalReads: true,
        criticalMethods: ['get_user'],
      });

      await expect(transport?.runGetMethod({
        address: VAULT,
        method: 'get_user',
        stack: [],
      }), label).resolves.toMatchObject({ stack: baseUserStack });
    }
  });

  it('VAULT-RPC-04K0: explicit allowUnverifiedCriticalRead bypasses critical verifier disputes', async () => {
    const first = {
      kind: 'first-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: [num(1n)] };
      },
    };
    const second = {
      kind: 'second-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: [num(2n)] };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [first, second],
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_user', stack: [] })).rejects.toMatchObject({
      code: 'RPC_DISAGREEMENT',
    });
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
      allowUnverifiedCriticalRead: true,
    })).resolves.toMatchObject({ stack: [num(1n)] });
  });

  it('VAULT-RPC-04K1: self-trusts the sole live read transport, but fails closed when a verifier was tried yet could not confirm', async () => {
    const onlyProvider = {
      kind: 'only-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: [num(1n)] };
      },
      async sendBoc() {
        return { ok: true };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [onlyProvider],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).resolves.toMatchObject({
      stack: [num(1n)],
    });
    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_noncritical', stack: [] })).resolves.toMatchObject({
      stack: [num(1n)],
    });
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_noncritical',
      stack: [],
      verify: true,
    })).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    const flakyVerifier = {
      kind: 'second-rpc',
      async runGetMethod() {
        throw new Error('verifier offline');
      },
    };
    const verifiedPair = createFallbackTonRpcTransport({
      transports: [onlyProvider, flakyVerifier],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    });
    await expect(verifiedPair?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).rejects.toMatchObject({
      name: 'TonRpcTransportError',
      code: 'RPC_VERIFICATION_UNAVAILABLE',
    });
  });

  it('VAULT-RPC-04K2: compares verified RPC stacks semantically across provider encodings', async () => {
    const addressSlice = encodeTonAddressSliceBoc(OWNER);
    const first = {
      kind: 'first-rpc',
      async runGetMethod() {
        return {
          exit_code: 0,
          stack: [
            { type: 'num', value: '0x1' },
            { type: 'bool', value: true },
            { type: 'slice', value: addressSlice },
          ],
        };
      },
    };
    const second = {
      kind: 'second-rpc',
      async runGetMethod() {
        return {
          result: {
            exit_code: 0,
            stack: [
              ['int', '1'],
              ['bool', '-0x1'],
              { type: 'address', value: OWNER },
            ],
          },
        };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [first, second],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).resolves.toMatchObject({
      stack: [
        { type: 'num', value: '0x1' },
        { type: 'bool', value: true },
        { type: 'slice', value: addressSlice },
      ],
    });
  });

  it('VAULT-RPC-04K3: tolerates get_user balance and nonce lag, resolving to the primary (mutable counters not cross-verified)', async () => {
    const first = {
      kind: 'fresh-rpc',
      async runGetMethod() {
        return {
          exit_code: 0,
          stack: [
            num(-1n),
            num(120_000_000n),
            num(50_000_000_000n),
            num(777n),
            num(888n),
            num(12n),
          ],
        };
      },
    };
    const second = {
      kind: 'lagging-rpc',
      async runGetMethod() {
        return {
          exit_code: 0,
          stack: [
            num(-1n),
            num(80_000_000n),
            num(40_000_000_000n),
            num(777n),
            num(888n),
            num(11n),
          ],
        };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [first, second],
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_user', stack: [] })).resolves.toMatchObject({
      stack: [
        num(-1n),
        num(120_000_000n),
        num(50_000_000_000n),
        num(777n),
        num(888n),
        num(12n),
      ],
    });
  });

  it('VAULT-RPC-04K4: still rejects get_user when a verified key-identity field (current_key_id or auth_pubkey) disagrees', async () => {
    for (const [label, keyIndex, wrongValue] of [
      ['current_key_id', 3, 778n],
      ['auth_pubkey', 4, 889n],
    ] as const) {
      const baseStack = [
        num(-1n),
        num(120_000_000n),
        num(50_000_000_000n),
        num(777n),
        num(888n),
        num(12n),
      ];
      const first = {
        kind: 'fresh-rpc',
        async runGetMethod() {
          return { exit_code: 0, stack: baseStack };
        },
      };
      const second = {
        kind: `wrong-${label}-rpc`,
        async runGetMethod() {
          const stack = [...baseStack];
          stack[keyIndex] = num(wrongValue);
          return { exit_code: 0, stack };
        },
      };
      const transport = createFallbackTonRpcTransport({
        transports: [first, second],
        verifyCriticalReads: true,
        criticalMethods: ['get_user'],
      });

      await expect(transport?.runGetMethod({ address: VAULT, method: 'get_user', stack: [] }), label).rejects.toMatchObject({
        name: 'TonRpcTransportError',
        code: 'RPC_DISAGREEMENT',
      });
    }
  });

  it('VAULT-RPC-04K5: get_global cross-verifies the sealed latch, both deployment hashes and the address slots, and tolerates every counter', async () => {
    const officialAthWallet = `0:${'aa'.repeat(32)}`;
    const athMaster = `0:${'bb'.repeat(32)}`;
    const genesisController = `0:${'cc'.repeat(32)}`;
    const treasuryReceiver = `0:${'dd'.repeat(32)}`;
    const poolAthWallet = `0:${'ee'.repeat(32)}`;
    const slice = (address: string) => ({ type: 'slice', value: encodeTonAddressSliceBoc(address) });

    const profileRegistryView = (profileCount: bigint, pendingAvatarWrites: bigint) => [
      num(-1n), num(-1n), num(0x1111n), num(0x2222n),
      slice(officialAthWallet), slice(athMaster), slice(treasuryReceiver), slice(genesisController),
      num(profileCount), num(pendingAvatarWrites), num(7n), num(0n), num(0n), num(0n), num(0n),
    ];
    const usernameRegistryView = (pendingMints: bigint, treasuryDue: bigint) => [
      num(-1n), num(-1n), num(0x1111n), num(0x2222n),
      slice(officialAthWallet), slice(genesisController),
      num(pendingMints), num(treasuryDue), num(0n), num(0n), num(0n), num(86_400n),
    ];
    const airdropView = (distributed: bigint, claims: bigint) => [
      num(-1n), num(0x1111n), num(0x2222n),
      slice(genesisController), slice(athMaster), slice(poolAthWallet), slice(officialAthWallet), slice(treasuryReceiver),
      num(1_000n), num(15_000_000_000_000_000n), num(15_000_000_000_000_000n), num(9_000n),
      num(distributed), num(claims), num(1_800_000_000n), num(-1n), num(-1n), num(-1n),
    ];

    const readWith = (a: unknown[], b: unknown[]) => createFallbackTonRpcTransport({
      transports: [
        { kind: 'fresh-rpc', async runGetMethod() { return { exit_code: 0, stack: a }; } },
        { kind: 'lagging-rpc', async runGetMethod() { return { exit_code: 0, stack: b }; } },
      ],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    })?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] });

    await expect(readWith(profileRegistryView(12n, 4n), profileRegistryView(11n, 3n)),
      'ProfileRegistry: profile_count and pending_avatar_write_count move on every avatar purchase').resolves.toBeTruthy();
    await expect(readWith(usernameRegistryView(3n, 500n), usernameRegistryView(2n, 400n)),
      'UsernameRegistry: pending_mint_count sits at [6], which is what sets the window at six').resolves.toBeTruthy();
    await expect(readWith(airdropView(9n, 3n), airdropView(8n, 2n)),
      'AirdropPool: distributed_total and claim_count move on every claim').resolves.toBeTruthy();

    const faked: [string, unknown[], unknown[]][] = [
      ['sealed', profileRegistryView(12n, 4n), [num(0n), ...profileRegistryView(12n, 4n).slice(1)]],
      ['deployment_manifest_hash', profileRegistryView(12n, 4n),
        [...profileRegistryView(12n, 4n).slice(0, 2), num(0xdeadn), ...profileRegistryView(12n, 4n).slice(3)]],
      ['an address slot inside the window', profileRegistryView(12n, 4n),
        [...profileRegistryView(12n, 4n).slice(0, 5), slice(`0:${'99'.repeat(32)}`), ...profileRegistryView(12n, 4n).slice(6)]],
    ];
    for (const [label, a, b] of faked) {
      await expect(readWith(a, b), label).rejects.toMatchObject({
        name: 'TonRpcTransportError',
        code: 'RPC_DISAGREEMENT',
      });
    }
  });

  it('VAULT-RPC-04K6: the window is exactly as wide as the contracts allow — read off their own structs, both generations', () => {
    const fieldsOf = (path: string, struct: string) => {
      const src = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
      const at = src.indexOf(`struct ${struct}`);
      expect(at, `${struct} is declared in ${path}`).toBeGreaterThan(-1);
      const body = src.slice(src.indexOf('{', at) + 1, src.indexOf('}', at));
      return [...body.matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);
    };

    const VOLATILE = /count$|_due_|^next_|^remaining_|^distributed_|^claim_count$/;

    const views: [string, string][] = [
      ['contracts/ProfileRegistry.tact', 'ProfileRegistryGlobalView'],
      ['contracts/UsernameRegistry.tact', 'UsernameRegistryGlobalView'],
      ['contracts/AirdropPool.tact', 'AirdropGlobalView'],
      ['contracts18/contracts/ProfileRegistry.tact', 'ProfileRegistryGlobalView'],
      ['contracts18/contracts/UsernameRegistry.tact', 'UsernameRegistryGlobalView'],
    ];
    let firstVolatile = Infinity;
    for (const [path, struct] of views) {
      const fields = fieldsOf(path, struct);
      expect(fields.length, `${struct} in ${path} has fields`).toBeGreaterThan(6);
      for (const [index, name] of fields.entries()) {
        if (VOLATILE.test(name)) { firstVolatile = Math.min(firstVolatile, index); break; }
      }
      for (const name of fields.slice(0, 6)) {
        expect(VOLATILE.test(name), `${struct} [${fields.indexOf(name)}] ${name} is compared, so it must be stable`).toBe(false);
      }
    }
    expect(firstVolatile, 'the first volatile slot across the three views is what fixes the window at six').toBe(6);

    const transport = readFileSync(new URL('../web/ton-rpc-transport.mjs', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    expect(transport, 'and the comparator uses it').toContain('return stableJsonString(stack.slice(0, 6));');
    expect(transport.includes('stack.slice(0, 10)'), 'the deleted Vault window is gone').toBe(false);
  });

  it('VAULT-RPC-04K6: still rejects get_global when static route fields disagree', async () => {
    const baseStack = [
      num(-1n),
      num(-1n),
      num(-1n),
      num(-1n),
      num(0x9999n),
      { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'66'.repeat(32)}`) },
      { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'77'.repeat(32)}`) },
      { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'88'.repeat(32)}`) },
      { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'99'.repeat(32)}`) },
      { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'aa'.repeat(32)}`) },
      num(1n),
      num(2n),
      num(3n),
      num(4n),
      num(5n),
      num(6n),
      num(7n),
      num(8n),
      num(86_400n),
      num(9n),
      num(10n),
      num(11n),
      num(12n),
    ];
    const first = {
      kind: 'first-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: baseStack };
      },
    };
    const second = {
      kind: 'wrong-manifest-rpc',
      async runGetMethod() {
        return { exit_code: 0, stack: baseStack.map((item, index) => (index === 4 ? num(0x8888n) : item)) };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [first, second],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).rejects.toMatchObject({
      name: 'TonRpcTransportError',
      code: 'RPC_DISAGREEMENT',
    });
  });

  it('VAULT-RPC-04L: reads account balance through the configured provider instead of app hardcoding Toncenter v2', async () => {
    const requests: string[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      walletBalanceEndpoint: 'https://toncenter.example/api/v2/getAddressInformation',
      requestSpacingMs: 0,
      rateLimitKey: `balance-${Math.random()}`,
      fetch: async (url: string) => {
        requests.push(String(url));
        return {
          ok: true,
          status: 200,
          async json() {
            return { result: { balance: '123456' } };
          },
        };
      },
    });

    await expect(transport.getAccountBalance(OWNER)).resolves.toBe('123456');
    expect(requests[0]).toContain('https://toncenter.example/api/v2/getAddressInformation?');
    expect(requests[0]).toContain(`address=${encodeURIComponent(OWNER)}`);
  });


});

describe('parseStackBigIntValue non-numeric string does not self-recurse (PWA-IOS-BIGINT-NO-TOSTRING-RECURSION-01)', () => {
  it('throws a plain error (not RangeError) on a base64 cell string', () => {
    const cell = 'te6cckECOwEAAvMAAgHHAQICASADBAIBYjEyAgEgBQYCASAbHA';
    let caught: unknown = null;
    try {
      parseStackBigIntValue(cell, 'TON RPC compare value');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).constructor.name).toBe('Error');
    expect((caught as Error).message).toMatch(/must be an integer stack item/);
    expect((caught as RangeError).message).not.toMatch(/call stack/i);
  });

  it('still parses decimal and hex integer strings', () => {
    expect(parseStackBigIntValue('133', 't')).toBe(133n);
    expect(parseStackBigIntValue('0x85', 't')).toBe(133n);
    expect(parseStackBigIntValue('-0x10', 't')).toBe(-16n);
    expect(parseStackBigIntValue(42n, 't')).toBe(42n);
  });

  it('does not hang on an address slice string (get_global compare value)', () => {
    expect(() => parseStackBigIntValue(`0:${'ab'.repeat(32)}`, 't')).toThrow(/must be an integer stack item/);
  });


  const r6Fetch = (script: Array<{ status: number }>, calls: number[] = []) => async () => {
    calls.push(Date.now());
    const step = script.length > 1 ? script.shift()! : script[0];
    if (step.status === 429) return { ok: false, status: 429, async json() { return {}; }, headers: { get: () => null } };
    return { ok: true, status: 200, async json() { return { exit_code: 0, stack: [] }; }, headers: { get: () => null } };
  };

  it('RPC-R6-01: the consecutive-429 ladder applies through a transport built the way platho-config builds it — the first stray parks for seconds', async () => {
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      rateLimitKey: 'rpc-r6-01', requestSpacingMs: 0, rateLimitRetries: 0, rateLimitBackoffMs: 7000,
      fetch: r6Fetch([{ status: 429 }, { status: 200 }]),
    });
    const call = { address: '0:' + '41'.repeat(32), method: 'seqno', stack: [], cacheTtlMs: 0, skipIfRateLimited: false };
    const started = Date.now();
    await transport.runGetMethod(call).catch(() => null);
    await transport.runGetMethod(call);
    const elapsed = Date.now() - started;
    expect(elapsed, 'the ladder\'s first step, not the configured flat figure').toBeLessThan(4_000);
    expect(elapsed).toBeGreaterThanOrEqual(1_500);
  }, 20_000);

  it('RPC-R6-02: a cached answer is served only as fresh as THIS caller asked for', async () => {
    const calls: number[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod', rateLimitKey: 'rpc-r6-02', requestSpacingMs: 0, rateLimitRetries: 0,
      fetch: r6Fetch([{ status: 200 }], calls),
    });
    const call = { address: '0:' + '42'.repeat(32), method: 'seqno', stack: [] };
    await transport.runGetMethod({ ...call, cacheTtlMs: 300_000 });
    await transport.runGetMethod({ ...call, cacheTtlMs: 300_000 });
    expect(calls.length, 'a long request is answered by the fresh entry').toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await transport.runGetMethod({ ...call, cacheTtlMs: 5 });
    expect(calls.length, 'a 5 ms request is not answered by a 300 s entry written 30 ms ago').toBe(2);
  });

  it('RPC-R6-03: a cached read that asked to WAIT does not share the verdict of a skippable twin registered first', async () => {
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod', rateLimitKey: 'rpc-r6-03', requestSpacingMs: 0, rateLimitRetries: 0,
      fetch: r6Fetch([{ status: 429 }, { status: 200 }]),
    });
    const call = { address: '0:' + '43'.repeat(32), method: 'seqno', stack: [], cacheTtlMs: 60_000 };
    await transport.runGetMethod({ ...call, skipIfRateLimited: true }).catch(() => null);
    const [skippable, waiting] = await Promise.allSettled([
      transport.runGetMethod({ ...call, skipIfRateLimited: true }),
      transport.runGetMethod({ ...call, skipIfRateLimited: false }),
    ]);
    expect(skippable.status, 'the skippable twin is dropped at once').toBe('rejected');
    expect(waiting.status, 'the one that asked to wait waited').toBe('fulfilled');
  }, 20_000);

});
