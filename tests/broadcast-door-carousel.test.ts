import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';
import {
  broadcastDoors,
  broadcastThroughNextDoor,
  __resetBroadcastDoorCursorForTests,
  __toncenterLimiterKeysForTests,
} from '../web/ton-rpc-transport.mjs';

// A RETRY KNOCKS ON A DIFFERENT DOOR.
//
// An external reaches ONE node and spreads from there; until it reaches the collator of our shard it is nowhere.
// MEASURED 2026-08-05: 3762-byte externals landed in 2-3s every time, while our 36555-byte ones took 4, 17, 24, 33,
// 37, 73, 100, 121, 143, 181 and 200s — with every configured limit satisfied twice over (56% of max_ext_msg_size,
// depth 262 of 512, 3.5% of the block byte budget, trivial gas). That spread, with nothing about the message
// differing, is what luck-of-the-route looks like. So a retry should try another entry point, not re-knock.
//
// This adds ZERO requests: the FIRST broadcast still goes to the primary alone, and only the retry that already
// existed changes address. Mirroring every send to all three would have cost 220KB of upload for a 2-part image
// instead of 73KB.
describe('DOORS — a broadcast retry rotates entry points', () => {
  // The pump's fallback queue key is `origin|key-mode`, so a URL-shaped key is a lane that skipped the shared one.
  // SCOPED TO THE REAL HOSTS on purpose: neighbouring suites build transports against invented endpoints with no
  // explicit key, and those fixtures are not production lanes. A gate that cries about somebody else's stub gets
  // muted, and a muted gate guards nothing.
  const PRODUCTION_HOST_QUEUE = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:toncenter\.com|tonapi\.io|tonhubapi\.com)/i;

  const config = PLATHO_APP_CONFIG.network.tonRpc;

  beforeEach(() => __resetBroadcastDoorCursorForTests());

  it('DOORS-01: the production config carries three independent public doors', () => {
    const doors = broadcastDoors(config);
    expect(doors.map((door: any) => door.id)).toEqual(['toncenter', 'tonapi', 'tonhub-v4']);
    // Three OPERATORS, not three URLs of one: blocking one must not stop a message from leaving.
    const hosts = doors.map((door: any) => new URL(door.sendBocEndpoint).hostname);
    expect(new Set(hosts).size).toBe(3);
    expect(validatePlathoAppConfig(PLATHO_APP_CONFIG).ok, 'the real config must validate with the doors').toBe(true);
  });

  it('DOORS-02: successive retries walk the carousel and come back around', async () => {
    const seen: string[] = [];
    const fetchImpl = async (url: string) => { seen.push(new URL(url).hostname); return { ok: true, status: 200 }; };
    for (let i = 0; i < 4; i += 1) {
      await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl });
    }
    // Door 0 is the primary the first attempt already used, so the rotation STARTS at the next one.
    expect(seen).toEqual(['tonapi.io', 'mainnet-v4.tonhubapi.com', 'toncenter.com', 'tonapi.io']);
  });

  it('DOORS-03: doors ride the SHARED queue — a second queue would be two simultaneous connections', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200 });
    await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl });
    await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl });
    // Assert on the WHOLE key set, not on what this case added: a before/after diff silently passes once an earlier
    // case in the same file has already opened the offending queue — which is exactly how this gate first went blind.
    const derived = __toncenterLimiterKeysForTests().filter((key) => PRODUCTION_HOST_QUEUE.test(key));
    expect(derived, `a door opened its own queue — that is the iPhone-freeze shape: ${derived.join(', ')}`).toEqual([]);
    expect(__toncenterLimiterKeysForTests(), 'doors must ride the pinned queue').toContain('toncenter-shared');
  });

  it('DOORS-04: a door that refuses is swallowed — its answer may never decide delivery', async () => {
    const fetchImpl = async () => { throw new Error('network down'); };
    await expect(broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl }))
      .resolves.not.toBeNull();
    // Delivery is decided by READING THE SHARD. A door's refusal proves nothing: the earlier copy may still land.
  });

  it('DOORS-06: every door host is allowed by the served Content-Security-Policy', () => {
    // SHIPPED BROKEN AND THE OWNER FOUND IT: the doors went live while connect-src still listed only toncenter, so
    // the browser refused every retry — "Refused to connect because it violates the document's Content Security
    // Policy". None of the other gates could see it: they stub fetch in Node, where no CSP exists. A door the
    // browser cannot reach is not a door.
    const files = [
      'deploy/Caddyfile',
      'deploy/nginx-platho.app.conf',
      'scripts/server/Caddyfile',
    ];
    const hosts = broadcastDoors(config).map((door: any) => new URL(door.sendBocEndpoint).origin);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const connectSrc = /connect-src[^;"]*/.exec(text)?.[0] ?? '';
      expect(connectSrc, `${file} has no connect-src`).toBeTruthy();
      for (const host of hosts) {
        const wildcard = host.replace(/^https:\/\/[^.]+\./, 'https://*.');
        expect(
          connectSrc.includes(host) || connectSrc.includes(wildcard),
          `${file}: connect-src does not allow the door ${host} — the browser will block every retry to it`,
        ).toBe(true);
      }
    }
  });

  it('DOORS-05: a door may never answer a read, and may never be a host of ours', () => {
    // A door with a read endpoint would become a second source of truth — and cross-verifying reads against a
    // slower provider is what made every critical read wait, the real reason the second provider was removed.
    const withRead = validatePlathoAppConfig({
      ...PLATHO_APP_CONFIG,
      network: {
        ...PLATHO_APP_CONFIG.network,
        tonRpc: {
          ...config,
          broadcastDoors: [...config.broadcastDoors, {
            id: 'reader', sendBocEndpoint: 'https://tonapi.io/v2/blockchain/message',
            runGetMethodEndpoint: 'https://tonapi.io/v2/whatever',
          }],
        },
      },
    });
    expect(withRead.findings.map((f: any) => f.id)).toContain('PWA_TON_RPC_BROADCAST_DOOR_READS_FORBIDDEN');

    const bespoke = validatePlathoAppConfig({
      ...PLATHO_APP_CONFIG,
      network: {
        ...PLATHO_APP_CONFIG.network,
        tonRpc: {
          ...config,
          broadcastDoors: [{ id: 'ours', sendBocEndpoint: 'https://rpc.platho.app/api/v3/message' }],
        },
      },
    });
    expect(bespoke.findings.map((f: any) => f.id)).toContain('PWA_TON_RPC_BROADCAST_DOOR_FORBIDDEN');
  });
});
