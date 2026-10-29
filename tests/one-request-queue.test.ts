import { beforeEach, describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { createTonRpcTransport, __toncenterLimiterKeysForTests } from '../web/ton-rpc-transport.mjs';
import { createShardStatesRequest, createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';

const PRODUCTION_HOST_QUEUE = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:toncenter\.com|tonapi\.io|tonhubapi\.com)\b/i;

describe('ONEQUEUE — all toncenter traffic shares a single request queue', () => {
  const endpoint = 'https://toncenter.com/api/v3/runGetMethod';
  const apiKey = 'test-key';

  const okJson = (body: unknown) => ({
    ok: true,
    status: 200,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
    clone() { return okJson(body); },
  });

  beforeEach(() => {
  });

  it('ONEQUEUE-01: a read, a broadcast and a shard scan all land on the SAME limiter key', async () => {
    const before = new Set(__toncenterLimiterKeysForTests());
    const rpc = PLATHO_APP_CONFIG.network.tonRpc;
    let fetches = 0;
    const fetchImpl = async () => { fetches += 1; return okJson({ ok: true, stack: [], accounts: [], messages: [] }); };

    const transport = createTonRpcTransport({ ...rpc, apiKey, fetch: fetchImpl, fetchImpl });
    expect(transport, 'the real config must build a transport').toBeTruthy();

    await transport.runGetMethod({ address: `0:${'11'.repeat(32)}`, method: 'seqno', stack: [], cacheTtlMs: 0 });
    await transport.sendBoc({ boc: 'te6ccgEBAQEAAgAAAA==' }).catch(() => {});
    await createShardStatesRequest({ endpoint, apiKey, fetch: fetchImpl })({ path: '/accountStates?address=x' })
      .catch(() => {});
    await createShardMessagesWithSourceReader({ endpoint, apiKey, fetch: fetchImpl })({ address: `0:${'22'.repeat(32)}` })
      .catch(() => {});

    expect(fetches, 'some path never reached the pump, so it proved nothing').toBeGreaterThanOrEqual(4);

    const keys = __toncenterLimiterKeysForTests();
    expect(keys, 'the pinned queue is missing').toContain('toncenter-shared');
    const derived = keys.filter((key) => PRODUCTION_HOST_QUEUE.test(key));
    expect(derived, `a lane derived its own queue: ${derived.join(', ')}`).toEqual([]);
    void before;
  });

  it('ONEQUEUE-01B: WITHOUT a key it is the SAME queue, only paced slower', async () => {
    const before = new Set(__toncenterLimiterKeysForTests());
    const rpc = PLATHO_APP_CONFIG.network.tonRpc;
    let fetches = 0;
    const fetchImpl = async () => { fetches += 1; return okJson({ ok: true, stack: [], accounts: [], messages: [] }); };

    const transport = createTonRpcTransport({ ...rpc, apiKey: null, fetch: fetchImpl, fetchImpl });
    await transport.runGetMethod({ address: `0:${'33'.repeat(32)}`, method: 'seqno', stack: [], cacheTtlMs: 0 });
    await createShardStatesRequest({ endpoint, apiKey: null, fetch: fetchImpl })({ path: '/accountStates?address=y' })
      .catch(() => {});

    expect(fetches, 'the keyless path never reached the pump').toBeGreaterThanOrEqual(2);
    const derived = __toncenterLimiterKeysForTests().filter((key) => PRODUCTION_HOST_QUEUE.test(key));
    expect(derived, `a keyless client derived its own queue: ${derived.join(', ')}`).toEqual([]);
    void before;

    expect(rpc.providers.find((p: any) => p.id === 'keyless-toncenter')?.requestSpacingMs).toBe(1100);
    expect(rpc.providers.find((p: any) => p.id === 'user-toncenter')?.requestSpacingMs).toBe(125);
  });

  it('ONEQUEUE-02: every configured provider pins the same explicit key', () => {
    const providers = PLATHO_APP_CONFIG.network.tonRpc.providers ?? [];
    expect(providers.length).toBeGreaterThan(0);
    const keys = new Set(providers.map((provider: any) => provider.rateLimitKey));
    expect(keys.has(undefined), 'a provider left rateLimitKey unset — it will derive its own queue').toBe(false);
    expect(keys.size, `providers sit in ${keys.size} queues: ${[...keys].join(', ')}`).toBe(1);
  });
});
