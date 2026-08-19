import { beforeEach, describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';
import {
  approximateBocBytes,
  createTonCenterV3Transport,
  firstBroadcastDoorForBytes,
  __resetFirstBroadcastDoorCursorForTests,
  __toncenterLimiterKeysForTests,
} from '../web/ton-rpc-transport.mjs';

// A LARGE EXTERNAL MUST NOT START AT TONCENTER.
//
// MEASURED 2026-08-19 with the official TON SDK (@ton/ton, @ton/core, @ton/crypto), one POST per attempt, no
// re-sending, sizes alternating so a busy hour cannot pose as a size effect. Through toncenter: a 1252 B external
// landed 50/50, median 2.2s; a 62161 B external landed 29/49, median 24.7s, worst case 100.2s. Re-run with the
// door rotating as well: through tonapi and tonhub the 62161 B externals landed in 2.0-2.3s, the same as small
// ones, while toncenter in those very cycles took 18.3, 24.6 and 21.3s. Small externals held ~2.2s on all three
// doors throughout, which is what rules out "the network was busy" — the penalty follows the DOOR.
//
// The app used to pay for that on every large send: the first broadcast went to toncenter and stalled, and only
// the 5s retry moved to a healthy door. These gates hold the first broadcast on a healthy door instead.
describe('LARGEDOOR — a large first broadcast skips the slow door', () => {
  const config = PLATHO_APP_CONFIG.network.tonRpc;
  const PRIMARY = 'https://toncenter.example/api/v3/message';
  const SMALL_BOC = 'te6ccgEBAQEAAgAAAA==';
  const LARGE_BOC = 'A'.repeat(80_000);          // ~60 KB once base64 is undone, the measured-bad size class

  beforeEach(() => __resetFirstBroadcastDoorCursorForTests());

  const transportRecording = (sink: any[], respond: (url: string) => any = () => ({ ok: true, status: 200 })) =>
    createTonCenterV3Transport({
      endpoint: 'https://toncenter.example/api/v3/runGetMethod',
      sendBocEndpoint: PRIMARY,
      apiKey: 'test-api-key',
      config,
      rateLimitKey: 'toncenter-shared',
      fetch: async (url: string, init: any) => {
        sink.push({ url, init });
        return { async json() { return { ok: true }; }, ...respond(url) };
      },
    });

  it('LARGEDOOR-01: the threshold sits inside the measured band, at the edge of what is known good', () => {
    const threshold = Number(config.firstBroadcastAlternateDoorAboveBytes);
    expect(Number.isFinite(threshold) && threshold > 0, 'the gate must be configured').toBe(true);
    // 3762 B externals were clean on 2026-08-05; 36555 B ones were not. A threshold outside that band is either
    // routing traffic that was never shown to need it, or leaving traffic that was shown to suffer.
    expect(threshold).toBeGreaterThan(3762);
    expect(threshold).toBeLessThanOrEqual(36555);
    expect(validatePlathoAppConfig(PLATHO_APP_CONFIG).ok, 'the real config must still validate').toBe(true);
  });

  it('LARGEDOOR-02: a small external is untouched — it still goes to the configured primary', async () => {
    const seen: any[] = [];
    await transportRecording(seen).sendBoc({ boc: SMALL_BOC });
    expect(seen.map((r) => r.url)).toEqual([PRIMARY]);
    expect(seen[0].init.headers['X-API-Key'], 'the primary keeps its key').toBe('test-api-key');
  });

  it('LARGEDOOR-03: a large external goes out through an alternate door, and only once', async () => {
    const seen: any[] = [];
    await transportRecording(seen).sendBoc({ boc: LARGE_BOC });
    expect(seen).toHaveLength(1);
    const host = new URL(seen[0].url).hostname;
    expect(host, 'a large first broadcast must not start at toncenter').not.toMatch(/toncenter/i);
    expect(['tonapi.io', 'mainnet-v4.tonhubapi.com']).toContain(host);
    // NOT A MIRROR: the same bytes go out once, to a different host. Mirroring was rejected on upload cost.
    expect(seen.filter((r) => r.url === PRIMARY), 'the primary must not also receive a copy').toEqual([]);
  });

  it('LARGEDOOR-04: the API key never leaves the configured provider', async () => {
    const seen: any[] = [];
    await transportRecording(seen).sendBoc({ boc: LARGE_BOC });
    for (const request of seen) {
      if (request.url === PRIMARY) continue;
      const headers = request.init?.headers ?? {};
      const carried = Object.keys(headers).filter((name) => /api[-_]?key|authorization/i.test(name));
      expect(carried, `${request.url} was handed ${carried.join(', ')}`).toEqual([]);
    }
  });

  it('LARGEDOOR-05: an alternate that refuses falls back to the primary, so this is never worse than before', async () => {
    const seen: any[] = [];
    const transport = transportRecording(seen, (url) => (url === PRIMARY
      ? { ok: true, status: 200 }
      : { ok: false, status: 503 }));
    await expect(transport.sendBoc({ boc: LARGE_BOC })).resolves.toMatchObject({ ok: true });
    // The fallback is the exact request that used to be the first one — including its key.
    expect(seen.map((r) => r.url).at(-1)).toBe(PRIMARY);
    expect(seen.at(-1).init.headers['X-API-Key']).toBe('test-api-key');
  });

  it('LARGEDOOR-06: consecutive large sends spread across the alternates', async () => {
    const seen: any[] = [];
    const transport = transportRecording(seen);
    await transport.sendBoc({ boc: LARGE_BOC });
    await transport.sendBoc({ boc: LARGE_BOC });
    const hosts = seen.map((r) => new URL(r.url).hostname);
    // Every Platho client starting its large sends at one fixed alternate would aim the whole app at one free
    // service. Assert the SET, so a rotation that quietly collapses to a single door fails here.
    expect(new Set(hosts).size, `both sends went to ${hosts.join(', ')}`).toBe(2);
  });

  it('LARGEDOOR-07: the alternate rides the SHARED queue — a second queue is the iPhone-freeze shape', async () => {
    const seen: any[] = [];
    await transportRecording(seen).sendBoc({ boc: LARGE_BOC });
    // Assert on the WHOLE key set rather than on what this case added: a before/after diff passes silently once an
    // earlier case has already opened the offending queue.
    const perHost = __toncenterLimiterKeysForTests()
      .filter((key: string) => /tonapi\.io|tonhubapi\.com/i.test(key));
    expect(perHost, `an alternate door opened its own queue: ${perHost.join(', ')}`).toEqual([]);
    expect(__toncenterLimiterKeysForTests()).toContain('toncenter-shared');
  });

  it('LARGEDOOR-08: with no doors configured the gate is inert, not a crash', () => {
    expect(firstBroadcastDoorForBytes(90_000, { ...config, broadcastDoors: [] })).toBe(null);
    expect(firstBroadcastDoorForBytes(90_000, {})).toBe(null);
    expect(firstBroadcastDoorForBytes(10, config), 'a small external never diverts').toBe(null);
    expect(approximateBocBytes(SMALL_BOC)).toBeLessThan(4096);
    expect(approximateBocBytes(LARGE_BOC)).toBeGreaterThan(36555);
  });
});
