import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLATHO_APP_CONFIG, validatePlathoAppConfig } from '../web/platho-config.mjs';
import {
  broadcastDoors,
  broadcastThroughNextDoor,
  classifyBroadcastDoorAnswer,
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

  it('DOORS-08: a door\'s refusal is READ — a chain verdict is told apart from a door that merely failed', () => {
    // OWNER'S CONSOLE 2026-08-21: tonapi 406, tonhub 406, toncenter 500 — three refusals of the same bytes in a
    // row, and under each one an INFO line claiming the re-broadcast had gone out. Nobody read the status. The
    // three bodies below are the MEASURED answers of the three doors to an external the chain cannot run (one
    // POST per door, 2026-08-21); "rejected by the chain" must be recognised in every one of those shapes, and a
    // bare 5xx with no verdict in it must NOT be — that one is the door's own failure and is still worth retrying.
    const liteServer = 'cannot apply external message to current state : External message was not accepted: cannot run message on account: inbound external message rejected by transaction 410E…:\nexitcode=133, steps=4, gas_used=0\nVM Log (truncated):\n...';
    const toncenter = classifyBroadcastDoorAnswer({ status: 500, body: JSON.stringify({ error: `LITE_SERVER_UNKNOWN: ${liteServer}` }) });
    expect(toncenter.rejectedByChain, 'toncenter: 500 carrying the lite-server verdict').toBe(true);
    expect(toncenter.chainExitCode, 'and the contract exit code is surfaced').toBe(133);

    const tonapi = classifyBroadcastDoorAnswer({ status: 406, body: JSON.stringify({ error: `error code: 4294966595 message: ${liteServer}` }) });
    expect(tonapi.rejectedByChain, 'tonapi: 406 carrying the same text').toBe(true);
    // "error code: 4294966595" precedes the exit code in tonapi's body — the parser must not mistake it for one.
    expect(tonapi.chainExitCode, 'the TVM exit code, not tonapi\'s own error code').toBe(133);

    const tonhub = classifyBroadcastDoorAnswer({ status: 406, body: JSON.stringify({ status: -5 }) });
    expect(tonhub.rejectedByChain, 'tonhub: 406 with no text at all — the status IS the verdict').toBe(true);
    expect(tonhub.chainExitCode, 'no exit code to surface').toBeNull();

    const doorDown = classifyBroadcastDoorAnswer({ status: 502, body: '<html>Bad Gateway</html>' });
    expect(doorDown.rejectedByChain, 'a bare 5xx is the DOOR failing, not the chain refusing').toBe(false);
    const throttled = classifyBroadcastDoorAnswer({ status: 429, body: JSON.stringify({ error: 'rate limit' }) });
    expect(throttled.rejectedByChain, 'a 429 says nothing about the bytes').toBe(false);
    expect(classifyBroadcastDoorAnswer({ status: 200, body: '' }).rejectedByChain).toBe(false);
  });

  it('DOORS-09: the carousel reports the classified answer and still never throws', async () => {
    // The caller used to get { door, status } and nothing else — so the CONV confirm could not stop re-offering
    // bytes the chain had already refused, and could not tell the console the truth. The answer rides along now;
    // DOORS-04 still holds (a thrown fetch resolves, never rejects).
    const answers = [
      { ok: false, status: 406, text: async () => JSON.stringify({ error: 'cannot apply external message to current state : … exitcode=133, steps=4' }) },
      { ok: false, status: 500, text: async () => JSON.stringify({ error: 'upstream timeout' }) },
      { ok: true, status: 200, text: async () => '' },
    ];
    let i = 0;
    const fetchImpl = async () => answers[i++ % answers.length];
    const first = await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl });
    expect(first).toMatchObject({ door: 'tonapi', status: 406, rejectedByChain: true, chainExitCode: 133 });
    const second = await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl });
    expect(second).toMatchObject({ door: 'tonhub-v4', status: 500, rejectedByChain: false, chainExitCode: null });
    const third = await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: fetchImpl });
    expect(third).toMatchObject({ door: 'toncenter', status: 200, rejectedByChain: false });
    // A fetch that throws still resolves to a door answer with no verdict in it.
    const down = await broadcastThroughNextDoor('te6ccgEBAQEAAgAAAA==', { config, fetch: async () => { throw new Error('offline'); } });
    expect(down).toMatchObject({ status: null, rejectedByChain: false });
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

  it('DOORS-07: EVERY lane that re-sends signed bytes rotates — not just the one I happened to wire first', () => {
    // Owner, 2026-08-06: "проверь, что это у нас теперь используется везде. И в публичной ленте и при публикации
    // аватара." Three retry paths were still knocking on the door that had already failed to deliver: the INTRO
    // idempotent retry, the CONV captured-external retry, and the public lane's retained-external re-broadcast.
    //
    // The gate is on the COMPLETENESS of the set, not on the four call sites I know about: any transport.sendBoc of
    // a PREVIOUSLY CAPTURED external must sit behind a rotation. The wallet's own first broadcast of each chunk is
    // the one exception and stays direct — the carousel is for retries, and a first send has no failure to route
    // around yet.
    const app = readFileSync('web/app.js', 'utf8');
    const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');

    for (const [name, source] of [['app.js', app], ['platho-wallet.mjs', wallet]] as const) {
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (!/transport\??\.sendBoc\(\{ boc/.test(line)) return;
        // `built.boc` is the freshly signed chunk — the FIRST attempt, deliberately straight to the primary.
        if (line.includes('boc: built.boc')) return;
        const previous = lines[index - 1] ?? '';
        expect(
          previous.includes('broadcastThroughNextDoor('),
          `${name}:${index + 1} re-sends a captured external without rotating the door:\n${line.trim()}`,
        ).toBe(true);
      });
    }

    // And the rotation is reachable from both files that need it.
    expect(app).toContain('broadcastThroughNextDoor,');
    expect(wallet).toContain('broadcastThroughNextDoor,');
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
