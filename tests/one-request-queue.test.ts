import { beforeEach, describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { createTonRpcTransport, __toncenterLimiterKeysForTests } from '../web/ton-rpc-transport.mjs';
import { createShardStatesRequest, createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';

// EVERY toncenter request must share ONE queue.
//
// The pump keeps its state in a Map keyed by limiter key (toncenterRequestStates), so a second key is a second
// queue with a second worker — and two workers mean two simultaneous connections, which is what stalled the WebKit
// run loop on the owner's iPhone. The config pins `rateLimitKey: 'toncenter-shared'` on both providers precisely to
// collapse them into one, and the shard reader takes its key from the primary provider.
//
// NOTHING FAILS when a caller forgets. toncenterLimiterKey falls through to a derived `origin|key-mode` key, so the
// forgetful lane just quietly gets its own queue — which is exactly what happened to the shard scan: it ran at a
// module-default 1500ms pacing in a queue of its own until somebody measured it (8290ms -> 1515ms once merged).
// A grep cannot catch that, so this drives the REAL config through the REAL entry points and counts the queues.
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
    // The pump's state map is module-global and other suites share this process; the assertions below compare the
    // set BEFORE and AFTER, so a key left by a neighbour cannot make this pass or fail by accident.
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

    // A gate that passes because nothing ran is worse than no gate: prove every path reached the network layer.
    expect(fetches, 'some path never reached the pump, so it proved nothing').toBeGreaterThanOrEqual(4);

    const added = __toncenterLimiterKeysForTests().filter((key) => !before.has(key));
    expect(added.length, `these paths opened ${added.length} queues: ${added.join(', ')}`).toBe(1);
    expect(added[0], 'and it must be the key the config pins, not a derived origin|key-mode fallback')
      .toBe('toncenter-shared');
  });

  it('ONEQUEUE-01B: WITHOUT a key it is the SAME queue, only paced slower', async () => {
    // The app must work with no key at all — that is the founding usability rule, not a fallback. Keyless traffic
    // therefore has to share the ONE queue and merely move at the slower per-task spacing (1100ms vs 125ms). If the
    // absent key derived its own queue instead, a user without a key would run TWO workers — the iPhone-freeze
    // shape — and adding a key mid-session would fork a third.
    const before = new Set(__toncenterLimiterKeysForTests());
    const rpc = PLATHO_APP_CONFIG.network.tonRpc;
    let fetches = 0;
    const fetchImpl = async () => { fetches += 1; return okJson({ ok: true, stack: [], accounts: [], messages: [] }); };

    const transport = createTonRpcTransport({ ...rpc, apiKey: null, fetch: fetchImpl, fetchImpl });
    await transport.runGetMethod({ address: `0:${'33'.repeat(32)}`, method: 'seqno', stack: [], cacheTtlMs: 0 });
    await createShardStatesRequest({ endpoint, apiKey: null, fetch: fetchImpl })({ path: '/accountStates?address=y' })
      .catch(() => {});

    expect(fetches, 'the keyless path never reached the pump').toBeGreaterThanOrEqual(2);
    const added = __toncenterLimiterKeysForTests().filter((key) => !before.has(key));
    expect(added, 'a keyless client opened its own queue').toEqual([]);

    // And the pacing IS the thing that differs — the same queue, a slower step.
    expect(rpc.providers.find((p: any) => p.id === 'keyless-toncenter')?.requestSpacingMs).toBe(1100);
    expect(rpc.providers.find((p: any) => p.id === 'user-toncenter')?.requestSpacingMs).toBe(125);
  });

  it('ONEQUEUE-02: every configured provider pins the same explicit key', () => {
    const providers = PLATHO_APP_CONFIG.network.tonRpc.providers ?? [];
    expect(providers.length).toBeGreaterThan(0);
    const keys = new Set(providers.map((provider: any) => provider.rateLimitKey));
    // An UNSET key is the dangerous case, not a wrong one: it silently derives a separate queue.
    expect(keys.has(undefined), 'a provider left rateLimitKey unset — it will derive its own queue').toBe(false);
    expect(keys.size, `providers sit in ${keys.size} queues: ${[...keys].join(', ')}`).toBe(1);
  });
});
