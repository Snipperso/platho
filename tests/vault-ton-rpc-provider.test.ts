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
import { tonCell } from '../web/pwa-contract-transactions.mjs';

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
  return { signedBundle, draft };
}

describe('Vault TON RPC provider', () => {
  it('VAULT-RPC-01: encodes and decodes TON address slice BoC for get_user', () => {
    const boc = encodeTonAddressSliceBoc(OWNER);

    expect(boc).toMatch(/^te6/);
    expect(decodeTonAddressSliceBoc(boc)).toBe(OWNER);
  });

  it('VAULT-RPC-02: calls get_user/get_key_record and binds a signed bundle to Vault record', async () => {
    const { signedBundle, draft } = await keyFixture();
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
              num(7n),
              num(3n),
            ],
          };
        }
        if (call.method === 'get_key_record') {
          expect(call.stack).toEqual([{ type: 'num', value: '0x7' }]);
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
    expect(binding.currentKeyId).toBe(7n);
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

  it('VAULT-RPC-04K1: fails closed when critical read verification has only one provider', async () => {
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

    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_global', stack: [] })).rejects.toMatchObject({
      name: 'VaultTonRpcProviderError',
      code: 'RPC_VERIFICATION_UNAVAILABLE',
    });
    await expect(transport?.runGetMethod({ address: VAULT, method: 'get_noncritical', stack: [] })).resolves.toMatchObject({
      stack: [num(1n)],
    });
    await expect(transport?.runGetMethod({
      address: VAULT,
      method: 'get_noncritical',
      stack: [],
      verify: true,
    })).rejects.toMatchObject({
      name: 'VaultTonRpcProviderError',
      code: 'RPC_VERIFICATION_UNAVAILABLE',
    });
    await expect(transport?.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' })).resolves.toMatchObject({ ok: true });
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
        if (call.method === 'get_canonical_publish_charge') return { stack: [num(58_000_000n)] };
        if (call.method === 'get_global') {
          return {
            stack: [
              num(-1n),
              num(-1n),
              num(0x9999n),
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'66'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'77'.repeat(32)}`) },
              { type: 'slice', value: encodeTonAddressSliceBoc(`0:${'88'.repeat(32)}`) },
              num(1n),
              num(2n),
              num(3n),
              num(4n),
              num(5n),
              num(6n),
              num(7n),
              num(86_400n),
              num(8n),
              num(9n),
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
    await expect(provider.getCanonicalPublishCharge(OWNER, 1n, 1n, 2n)).resolves.toBe(58_000_000n);
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
      'get_canonical_publish_charge',
      'get_global',
    ]);
    expect(decodeTonAddressSliceBoc(calls[5].stack[0].value)).toBe(OWNER);
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
