import { describe, expect, it } from 'vitest';
import {
  createMessagingIdentity,
  createVaultMessagingKeyDraft,
  exportSignedPublicKeyBundle,
  verifySignedPublicKeyBundle,
} from '../web/crypto/platho-crypto.mjs';
import { bindVaultRecordFromChain } from '../web/vault-chain-provider.mjs';
import {
  clearToncenterMessagesCache,
  clearToncenterRunGetMethodCache,
  createFallbackTonRpcTransport,
  createTonCenterV3VaultTransport,
  createTonRpcTransport,
  createVaultTonRpcProvider,
  decodeTonAddressSliceBoc,
  decodeVaultGlobalViewStack,
  encodeTonAddressSliceBoc,
} from '../web/vault-ton-rpc-provider.mjs';
import { computeVaultMessagingKeyId, tonCell } from '../web/pwa-contract-transactions.mjs';

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

function snakeBoc(bytes: Uint8Array) {
  return tonCell.bytesToBase64(tonCell.serializeBoc(tonCell.snakeCellFromBytes(bytes)));
}

async function keyFixture() {
  const identity = await createMessagingIdentity();
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: NOW,
    ownerWallet: OWNER,
    purpose: 'vault-ton-rpc-provider-test',
  });
  const verified = await verifySignedPublicKeyBundle(signedBundle, { now: NOW + 1 });
  const draft = await createVaultMessagingKeyDraft(verified.bundle, verified.signingPublicKey);
  const keyId = await computeVaultMessagingKeyId({
    owner_wallet: OWNER,
    key_generation: 0n,
    enc_pubkey: draft.message.enc_pubkey,
    sign_pubkey: draft.message.sign_pubkey,
    pq_kem_pubkey_hash: draft.message.pq_kem_pubkey_hash,
    pq_kem_pubkey_len: draft.message.pq_kem_pubkey_len,
    crypto_suite_mask: draft.message.crypto_suite_mask,
  });
  return { signedBundle, draft, keyId };
}

describe('Vault TON RPC provider', () => {
  it('VAULT-RPC-01: encodes and decodes TON address slice BoC for get_user', () => {
    const boc = encodeTonAddressSliceBoc(OWNER);

    expect(boc).toMatch(/^te6/);
    expect(decodeTonAddressSliceBoc(boc)).toBe(OWNER);
  });

  it('VAULT-RPC-02: calls get_user/get_key_record and binds a signed bundle to Vault record', async () => {
    const { signedBundle, draft, keyId } = await keyFixture();
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      kind: 'mock-ton-rpc',
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_user') {
          expect(decodeTonAddressSliceBoc(call.stack[0].value)).toBe(OWNER);
          return {
            stack: [
              num(-1n),
              num(0n),
              num(0n),
              num(keyId),
              num(0x99n),
              num(3n),
            ],
          };
        }
        if (call.method === 'get_key_record') {
          expect(call.stack).toEqual([{ type: 'num', value: `0x${keyId.toString(16)}` }]);
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              num(0n),
              num(draft.message.enc_pubkey),
              num(draft.message.sign_pubkey),
              num(draft.message.pq_kem_pubkey_hash),
              num(draft.message.pq_kem_pubkey_len),
              { type: 'cell', value: snakeBoc(draft.message.pq_kem_pubkey) },
              num(draft.message.crypto_suite_mask),
              num(1_700_000_000n),
              num(10n),
              num(0n),
              num(0n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createVaultTonRpcProvider({ vaultAddress: VAULT, transport });

    const binding = await bindVaultRecordFromChain(
      signedBundle,
      { walletAddress: OWNER },
      { provider, vaultAddress: VAULT, now: NOW + 1 },
    );

    expect(binding.active).toBe(true);
    expect(binding.providerKind).toBe('mock-ton-rpc');
    expect(binding.currentKeyId).toBe(keyId);
    expect(calls.map((call) => call.method)).toEqual(['get_user', 'get_key_record']);
    expect(calls.every((call) => call.address === VAULT)).toBe(true);
  });

  it('VAULT-RPC-03: stays fail-closed without transport or Vault address', async () => {
    const provider = createVaultTonRpcProvider({ transport: null });

    await expect(provider.getUser(OWNER, { vaultAddress: VAULT })).rejects.toThrow(/transport/i);
    await expect(createVaultTonRpcProvider({
      transport: {
        async runGetMethod() {
          return { stack: [] };
        },
      },
    }).getUser(OWNER)).rejects.toThrow(/Vault contract address/i);
  });

  it('VAULT-RPC-04: wraps TON Center v3 runGetMethod with explicit endpoint and API key', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
      name: 'VaultTonRpcProviderError',
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('VAULT-RPC-04C2: a 429 without Retry-After carries the CONFIGURED backoff, not a hardcoded 60s', async () => {
    // Regression: toncenterHttpError used to hardcode retryAfterMs=60000 on a header-less 429. That value
    // propagated up to the app-level limiter + the higher retry loops, making them sleep a full minute per
    // 429 — a keyless image send idled ~10 min issuing almost no requests. It must now carry the transport's
    // configured rateLimitBackoffMs so the loops retry at the intended ~7s cadence.
    const transport = createTonCenterV3VaultTransport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      requestSpacingMs: 0,
      rateLimitBackoffMs: 7000,
      rateLimitRetries: 0,
      rateLimitKey: `test-${Math.random()}`,
      fetch: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => null }, // no Retry-After header
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
    const transport = createTonCenterV3VaultTransport({
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
    })).resolves.toMatchObject({ exit_code: 0 });
    expect(requests).toHaveLength(2);
  });

  it('VAULT-RPC-04E: suppresses background get-method fetches during rate-limit cooldown', async () => {
    const requests: any[] = [];
    const transport = createTonCenterV3VaultTransport({
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
      name: 'VaultTonRpcProviderError',
      status: 429,
      code: 'RATE_LIMITED',
    });
    await expect(transport.runGetMethod({
      address: VAULT,
      method: 'get_global',
      stack: [],
    })).rejects.toMatchObject({
      name: 'VaultTonRpcProviderError',
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
    expect(messageRequests[0].init.cache).toBeUndefined();
    expect(messageRequests[1].init.cache).toBe('no-store');
  });

  it('VAULT-RPC-04H3: fresh get-method reads do not attach to cached in-flight requests', async () => {
    clearToncenterRunGetMethodCache();
    const requests: any[] = [];
    let releaseFetch: ((value: unknown) => void) | null = null;
    const fetchGate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    const transport = createTonCenterV3VaultTransport({
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
    const transport = createTonCenterV3VaultTransport({
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
      method: 'get_receive_intent',
      stack: [],
    })).resolves.toMatchObject({ stack: [num(9n)] });
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
      verify: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });

    expect(calls).toEqual([
      'https://toncenter.example/api/v3/runGetMethod:get_receive_intent',
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
        if (endpoint.includes('rpc.platho.example') && method === 'get_receive_intent') {
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

    // A critical read with explicit verify:true is NEVER cross-verified against the keyless emergency
    // transport (it is not an "on equal footing" verifier). With no other non-emergency verifier alive,
    // cross-verification is STRUCTURALLY impossible, so the lone live primary read — itself a trusted
    // multi-source endpoint — is SELF-TRUSTED and returned (the "1 live source → trust it, stay alive"
    // degrade). The keyless host is consulted for nothing; only the primary call is issued.
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_user',
      stack: [],
      verify: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });
    // A failing primary read still falls through to the emergency transport as a PRIMARY-read
    // fallback (the censorship-survival path), not as a verifier.
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_receive_intent',
      stack: [],
    })).resolves.toMatchObject({ stack: [num(7n)] });
    // Sends still prefer the healthy primary; the emergency transport stays out of normal
    // broadcast duty.
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    // The keyless emergency transport is NEVER consulted for verification (no toncenter get_user);
    // it appears only as the primary-read fallback for the 503'd get_receive_intent.
    expect(calls).toEqual([
      'https://rpc.platho.example/api/v3/runGetMethod:get_user',
      'https://rpc.platho.example/api/v3/runGetMethod:get_receive_intent',
      'https://toncenter.example/api/v3/runGetMethod:get_receive_intent',
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
          // A state-level block typically surfaces as an HTTP error or a
          // connection failure; both must fall through to the emergency path.
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

    const call = { address: VAULT, method: 'get_receive_intent', stack: [], cacheTtlMs: 0 };
    // Two consecutive hard failures fall through to the emergency transport.
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(9n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(9n)] });
    // Parked: the dead primary is skipped entirely while the window lasts.
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(9n)] });
    expect(transport?.isDegraded()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 70));
    // Past the retry window the primary is probed and recovers.
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
    // The keyless emergency transport is the only other read transport, but it is NEVER used as a
    // verifier — so a verify:true read finds no eligible verifier and, rather than failing closed,
    // SELF-TRUSTS the lone live primary (itself multi-source) and returns its result every time.
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });

    // It is skipped before any request is issued, so its ~1 rps host is never touched for verification.
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
      // A 401/403 verifier parks for minutes regardless of the configured
      // dead-retry window, so a region-blocked verifier is not re-probed every
      // sync cycle (which would re-throw on the first critical read each time).
      transportDeadRetryMs: 1,
      verifyCriticalReads: true,
      criticalMethods: ['get_user'],
      fetch: async (url: string) => {
        const endpoint = String(url);
        calls.push(endpoint);
        if (endpoint.includes('toncenter.example')) {
          // Deterministic policy denial, e.g. keyless toncenter blocked for
          // the user's network/region.
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

    // Only ONE non-emergency (gateway) read transport exists, so cross-read verification is
    // structurally degraded from the start — the keyless emergency transport does NOT count as a
    // verifier and is never consulted as one.
    expect(transport?.isVerificationDegraded()).toBe(true);
    const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
    // A verify:true read finds no eligible (gateway) verifier; rather than failing closed it
    // SELF-TRUSTS the lone live gateway (trust the gateway) — WITHOUT ever touching the keyless
    // emergency host, so its 403/429 limits never matter for verification.
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    expect(transport?.isVerificationDegraded()).toBe(true);
    // Primary stays healthy: this is verification degradation, not the censorship-survival
    // primary-parked mode (the gateway is still the live read/send source).
    expect(transport?.isDegraded()).toBe(false);
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    // The keyless emergency transport is never consulted for verification, ever.
    const toncenterCalls = calls.filter((endpoint) => endpoint.includes('toncenter.example'));
    expect(toncenterCalls).toHaveLength(0);
    // Unverified reads keep flowing through the healthy primary (trust the gateway).
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
      // Keyless toncenter is ~1 rps; under sync load it answers 429, not 403.
      // A rate-limited verifier must park exactly like a denied one so the app
      // degrades to the live gateway instead of re-hammering the throttled host
      // and throwing "verification unavailable" on every critical read.
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

    // Single gateway (non-emergency) read transport → cross-read verification is structurally
    // degraded; the keyless emergency transport is not a verifier and is never hit as one.
    expect(transport?.isVerificationDegraded()).toBe(true);
    const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
    // verify:true self-trusts the lone gateway without consulting the keyless host, so its ~1 rps
    // limit is irrelevant to verification.
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    expect(transport?.isVerificationDegraded()).toBe(true);
    // Primary stays healthy: verification degradation, not censorship-survival primary-parked mode.
    expect(transport?.isDegraded()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(transport?.isVerificationDegraded()).toBe(true);
    await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
    // Never consulted for verification.
    const toncenterCalls = calls.filter((endpoint) => endpoint.includes('toncenter.example'));
    expect(toncenterCalls).toHaveLength(0);
    // Unverified reads keep flowing through the healthy primary (trust the gateway).
    await expect(transport?.runGetMethod({
      ...call,
      verify: false,
      allowUnverifiedCriticalRead: true,
    })).resolves.toMatchObject({ stack: [num(7n)] });
  });

  it('VAULT-RPC-04I8C: toncenter-only — a no-key user-toncenter stays the non-emergency PRIMARY; verify:true self-trusts (the emergency keyless is never a verifier)', async () => {
    // Toncenter-only model: user-toncenter carries the user's own key at runtime but has none yet, so it runs
    // anonymous (429-prone). It is NOT demoted to emergency (with Orbs gone that would leave zero live primaries
    // -> perpetual syncing). The only other transport is the emergency keyless-toncenter, which is never a
    // routine verifier, so a verify:true read finds no eligible verifier and SELF-TRUSTS the lone (anonymous)
    // primary instead of failing closed (which previously bricked keyless sends at p0:built).
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
          // The emergency keyless must never be consulted as a verifier; 429 it so any consultation surfaces.
          return { ok: false, status: 429, async json() { return { ok: false }; } };
        },
      });

      // Only ONE non-emergency read source exists (the anonymous primary); the emergency keyless does not
      // count, so verification is structurally degraded (and the app-side no-double-spend guard stays fail-closed).
      expect(transport?.isVerificationDegraded()).toBe(true);
      const call = { address: VAULT, method: 'get_user', stack: [], cacheTtlMs: 0, verify: true };
      // verify:true must SELF-TRUST the lone (anonymous) primary, not fail closed.
      await expect(transport?.runGetMethod(call)).resolves.toMatchObject({ stack: [num(7n)] });
      // The emergency keyless is never consulted as a verifier.
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
          // A code-less (never-deployed) account aborts the get-method with -13,
          // surfaced as a structured error.exitCode by the toncenter transport.
          const error: any = new Error('TON RPC get-method exit code -13');
          error.exitCode = -13;
          throw error;
        },
      });
      const primary = uninitialized('primary-rpc');
      const fallback = uninitialized('fallback-rpc');
      return { calls, transport: createFallbackTonRpcTransport({ transports: [primary, fallback] }) };
    };

    // Opt-in (the wallet seqno read): the primary's -13 is a definitive on-chain
    // answer, so the emergency/fallback transport is never touched.
    const optIn = makeTransports();
    await expect(optIn.transport?.runGetMethod({
      address: VAULT, method: 'seqno', stack: [], stopOnUninitializedAccount: true,
    })).rejects.toMatchObject({ exitCode: -13 });
    expect(optIn.calls).toEqual(['primary-rpc:seqno']);

    // No opt-in (e.g. a Vault getter read): the existing behavior is preserved —
    // the candidate loop still exhausts every transport before failing.
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
    const primary = createTonCenterV3VaultTransport({
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
      name: 'VaultTonRpcProviderError',
      code: 'RPC_DISAGREEMENT',
    });
  });

  it('RT-PWA-VLT-001: get_user critical verification tolerates volatile counter lag (balance/nonce), resolving to the primary', async () => {
    // ton_balance[1], ath_balance[2] and publish_nonce[5] mutate on every credit/withdraw/publish, so two
    // HONEST replicas observed at different block heights legitimately disagree on them during the hot
    // send/confirm window. Cross-verifying them turned every keyed (verify:true) hot read into a spurious
    // RPC_DISAGREEMENT -> the [8,20,45,60]s private-send retry ladder (the dominant send-latency bottleneck).
    // They are excluded from the compare (mirror of get_global); the read resolves to the primary value.
    // Key-identity fields stay cross-verified -> see VAULT-RPC-04K4.
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

    // A single (non-emergency) read transport is the trusted gateway acting alone: cross-read
    // verification is structurally impossible, so a critical read SELF-TRUSTS the lone gateway and
    // returns its result rather than failing closed and bricking the app (the "1 live gateway →
    // trust the gateway, stay alive" degrade). Failing closed here is exactly the regression that
    // wedged the Vault balance behind "provider required".
    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).resolves.toMatchObject({
      stack: [num(1n)],
    });
    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_noncritical', stack: [] })).resolves.toMatchObject({
      stack: [num(1n)],
    });
    // Even an explicit per-call verify:true self-trusts the lone gateway (no second source exists).
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_noncritical',
      stack: [],
      verify: true,
    })).resolves.toMatchObject({ stack: [num(1n)] });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });

    // Fail-closed is preserved for the genuinely inconclusive case: when a SECOND (gateway)
    // verifier exists and is actually tried but errors, the read does NOT silently self-trust —
    // verification was attempted and could not confirm, so it fails closed (RPC_VERIFICATION_UNAVAILABLE).
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
      name: 'VaultTonRpcProviderError',
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

    // exists/current_key_id/auth_pubkey agree on both replicas; only the mutable ton_balance/ath_balance/
    // publish_nonce lag. The read must NOT fail closed on that lag (mirror of VAULT-RPC-04K5 for get_global)
    // and resolves to the primary (fresh) value.
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
    // The signing-key identity a lying RPC must NOT be able to fake stays cross-verified even though the
    // volatile counters were relaxed: current_key_id[3] and auth_pubkey[4]. Each, differing alone (with the
    // mutable counters identical), must still throw RPC_DISAGREEMENT.
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
        name: 'VaultTonRpcProviderError',
        code: 'RPC_DISAGREEMENT',
      });
    }
  });

  it('VAULT-RPC-04K5: verifies get_global static route fields without rejecting mutable counter lag', async () => {
    const capsuleHub = `0:${'66'.repeat(32)}`;
    const profileRegistry = `0:${'77'.repeat(32)}`;
    const usernameRegistry = `0:${'88'.repeat(32)}`;
    const vaultAthWallet = `0:${'99'.repeat(32)}`;
    const athMaster = `0:${'aa'.repeat(32)}`;
    const stablePrefix = [
      num(-1n),
      num(-1n),
      num(-1n),
      num(-1n),
      num(0x9999n),
      { type: 'slice', value: encodeTonAddressSliceBoc(capsuleHub) },
      { type: 'slice', value: encodeTonAddressSliceBoc(profileRegistry) },
      { type: 'slice', value: encodeTonAddressSliceBoc(usernameRegistry) },
      { type: 'slice', value: encodeTonAddressSliceBoc(vaultAthWallet) },
      { type: 'slice', value: encodeTonAddressSliceBoc(athMaster) },
    ];
    const first = {
      kind: 'fresh-rpc',
      async runGetMethod() {
        return {
          exit_code: 0,
          stack: [
            ...stablePrefix,
            num(12n),
            num(4n),
            num(7n),
            num(0n),
            num(2n),
            num(0n),
            num(0n),
            num(9n),
            num(86_400n),
            num(14_999_970_000_000_000n),
            num(30_000_000_000n),
            num(10_000_000_000n),
            num(15_000_000_000_000_000n),
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
            ...stablePrefix,
            num(11n),
            num(3n),
            num(6n),
            num(0n),
            num(1n),
            num(0n),
            num(0n),
            num(8n),
            num(86_400n),
            num(14_999_980_000_000_000n),
            num(20_000_000_000n),
            num(10_000_000_000n),
            num(15_000_000_000_000_000n),
          ],
        };
      },
    };
    const transport = createFallbackTonRpcTransport({
      transports: [first, second],
      verifyCriticalReads: true,
      criticalMethods: ['get_global'],
    });

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).resolves.toMatchObject({
      stack: expect.arrayContaining([num(12n), num(14_999_970_000_000_000n)]),
    });
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
      name: 'VaultTonRpcProviderError',
      code: 'RPC_DISAGREEMENT',
    });
  });

  it('VAULT-RPC-04L: reads account balance through the configured provider instead of app hardcoding Toncenter v2', async () => {
    const requests: string[] = [];
    const transport = createTonCenterV3VaultTransport({
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

  it('VAULT-RPC-05: exposes typed Vault getters needed by the PWA', async () => {
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_receive_intent') {
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'44'.repeat(32)}`) },
              num(1n),
              num(100n),
              num(0xabcdn),
              num(77n),
              num(2_000_000n),
              num(1_700_000_000n),
              num(0n),
            ],
          };
        }
        if (call.method === 'get_receive_intent_id') return { stack: [num(0x1010n)] };
        if (call.method === 'get_receive_intent_commitment') return { stack: [num(0x2020n)] };
        if (call.method === 'get_ath_withdrawal_id') return { stack: [num(0x3030n)] };
        if (call.method === 'get_pending_ath_withdrawal_for') {
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'44'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'55'.repeat(32)}`) },
              num(500n),
              num(1_700_000_001n),
            ],
          };
        }
        if (call.method === 'get_global') {
          return {
            stack: [
              num(-1n),
              num(-1n),
              num(-1n),
              num(-1n),
              num(0x9999n),
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'66'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'77'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'78'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'88'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'99'.repeat(32)}`) },
              num(1n),
              num(2n),
              num(3n),
              num(4n),
              num(5n),
              num(6n),
              num(7n),
              num(8n),
              num(86_400n),
              num(8n),
              num(9n),
              num(1n),
              num(10n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createVaultTonRpcProvider({ vaultAddress: VAULT, transport });

    await expect(provider.getReceiveIntent(0x999n)).resolves.toMatchObject({
      exists: true,
      sender_wallet: OWNER,
      asset: 1n,
      amount: 100n,
      settlement_reserve_ton: 2_000_000n,
      claimed: false,
    });
    await expect(provider.getReceiveIntentId(OWNER, `0:${'44'.repeat(32)}`, 1n, 100n, 77n)).resolves.toBe(0x1010n);
    await expect(provider.getReceiveIntentCommitment(0x1010n, `0:${'44'.repeat(32)}`, 0x7777n)).resolves.toBe(0x2020n);
    await expect(provider.getAthWithdrawalId(OWNER, 12n)).resolves.toBe(0x3030n);
    await expect(provider.getPendingAthWithdrawalFor(OWNER, 12n)).resolves.toMatchObject({
      exists: true,
      owner_wallet: OWNER,
      amount: 500n,
    });
    // VPB2: getCanonicalPublishCharge is now a pure client computation (SHARED_BASE + per-part marginal == a
    // 1-part batch canonical_total) — the per-message contract getter get_canonical_publish_charge was removed
    // with the batch redeploy, so this makes NO RPC call and is absent from the calls list below.
    await expect(provider.getCanonicalPublishCharge(OWNER, 1n, 1n, 2n)).resolves.toBe(162_600_000n);
    await expect(provider.getCanonicalPublishCharge(OWNER, 2n, 1n, 0n)).resolves.toBe(169_800_000n);
    await expect(provider.getGlobal()).resolves.toMatchObject({
      sealed: true,
      capsule_hub_bound: true,
      user_count: 1n,
      airdrop_total_allocation_ath: 10n,
    });

    expect(calls.map((call) => call.method)).toEqual([
      'get_receive_intent',
      'get_receive_intent_id',
      'get_receive_intent_commitment',
      'get_ath_withdrawal_id',
      'get_pending_ath_withdrawal_for',
      'get_global',
    ]);
    // get_pending_ath_withdrawal_for (now index 4 after get_canonical_publish_charge stopped hitting the RPC)
    // passes the owner address as its first stack arg.
    expect(decodeTonAddressSliceBoc(calls[4].stack[0].value)).toBe(OWNER);
  });

  it('VAULT-RPC-06: decodes the Vault registry binding fields from new get_global stacks', () => {
    const profileRegistry = `0:${'99'.repeat(32)}`;
    const usernameRegistry = `0:${'aa'.repeat(32)}`;
    const view = decodeVaultGlobalViewStack({
      stack: [
        num(-1n),
        num(-1n),
        num(-1n),
        num(-1n),
        num(0x9999n),
        { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'66'.repeat(32)}`) },
        { type: 'slice', value: encodeTonAddressSliceBoc(profileRegistry) },
        { type: 'slice', value: encodeTonAddressSliceBoc(usernameRegistry) },
        { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'77'.repeat(32)}`) },
        { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'88'.repeat(32)}`) },
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
      ],
    });

    expect(view.profile_registry_bound).toBe(true);
    expect(view.username_registry_bound).toBe(true);
    expect(view.profile_registry_address).toBe(profileRegistry);
    expect(view.username_registry_address).toBe(usernameRegistry);
    expect(view.pending_profile_avatar_payment_count).toBe(6n);
    expect(view.pending_username_mint_payment_count).toBe(7n);
    expect(view.airdrop_total_allocation_ath).toBe(12n);
  });
});
