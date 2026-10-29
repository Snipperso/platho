import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { chooseBeaconBucket, BEACON_READABLE_ENTRIES } from '../web/public-lane-send.mjs';
import { createPublicLane } from '../web/public-lane.mjs';
import { publicBeaconPartitionKey, publicEpochTag, publicEraOf, addrKey } from '../web/shard-discovery.mjs';
import { publicShardAddressBytes, rawAddress } from '../web/shard-address.mjs';


if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const CLOCK = 1_790_000_000;
const HOME = 42;
const CANDIDATES = [101, 202, 303];

describe('BEACONROLL — the announcer can leave a full bucket', () => {
  it('BEACONROLL-01: a roomy home bucket is still the home bucket', () => {
    const choice = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: () => 4000 });
    expect(choice).toMatchObject({ bucket: HOME, rolled: false, reason: 'home' });
  });

  it('BEACONROLL-02: a full home bucket rolls to the first candidate with room', () => {
    const room = new Map<number, number>([[HOME, 0], [101, 3], [202, 4096], [303, 4096]]);
    const choice = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: (b: number) => room.get(b) ?? null });
    expect(choice).toMatchObject({ bucket: 202, rolled: true, reason: 'home-full' });
  });

  it('BEACONROLL-03: an UNREADABLE probe is not a full bucket', () => {
    const choice = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: () => null });
    expect(choice).toMatchObject({ bucket: HOME, rolled: false, reason: 'unknown' });
    const thrown = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: () => { throw new Error('rpc'); } });
    expect(thrown.bucket).toBe(HOME);
    const blind = chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES, roomOf: (b: number) => (b === HOME ? 0 : null),
    });
    expect(blind).toMatchObject({ bucket: HOME, rolled: false, reason: 'no-room-anywhere' });
  });

  it('BEACONROLL-04: the lane reads a bucket\'s room, and an uninit bucket is EMPTY rather than unknown', async () => {
    const tag = publicEpochTag(2, publicEraOf(2, CLOCK));
    const addressOf = async (bucket: number) =>
      addrKey(rawAddress(await publicShardAddressBytes(await publicBeaconPartitionKey(bucket), tag)));
    const fullAddress = await addressOf(HOME);
    const lane = createPublicLane({
      now: () => CLOCK,
      endpoint: 'https://x/api/v3/accountStates',
      fetch: async (urlStr: string) => {
        const url = new URL(urlStr);
        if (!url.pathname.endsWith('/accountStates')) throw new Error(`unexpected fetch ${urlStr}`);
        const accounts = url.searchParams.getAll('address')
          .filter((a) => addrKey(a) === fullAddress)
          .map((a) => ({ address: addrKey(a), status: 'active', balance: '1000000', data_hash: 'h', last_transaction_lt: '1' }));
        return { ok: true, status: 200, json: async () => ({ accounts }) } as any;
      },
      runGetMethod: async (call: any) => {
        expect(call.method, 'room is read with the view getter, not a page').toBe('get_view');
        const num = (v: bigint) => ({ type: 'num', value: '0x' + v.toString(16) });
        return { stack: [num(1n), num(BigInt(tag)), num(2n), num(0n), num(4090n), num(4096n), num(0n), num(0n), num(0n), num(0n), num(0n), num(0n), num(0n)] };
      },
    });

    const room = await lane.readBeaconBucketRoom([HOME, ...CANDIDATES], { nowUnix: CLOCK });
    expect(room.get(HOME)).toMatchObject({ live: true, entryCount: 4090, safeCap: 4096, room: 6 });
    for (const bucket of CANDIDATES) {
      expect(room.get(bucket)).toMatchObject({ live: false, entryCount: 0, room: Number.POSITIVE_INFINITY });
    }
    expect(room.get(HOME)?.safeCap).toBe(4096);

    const choice = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: (b: number) => room.get(b)?.room ?? null });
    expect(choice.rolled, 'six slots left is inside the margin, so it rolls').toBe(true);
    expect(CANDIDATES).toContain(choice.bucket);
  });

  it('BEACONROLL-05: the save path uses it, and the roll is unpredictable', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const save = app.slice(app.indexOf('async function chooseChannelBeaconBucket('), app.indexOf('async function publishChannelProfileDirect('));
    expect(save).toContain('const home = Number(walletHash % BigInt(PUBLIC_BEACON_READ_SPACE));');
    expect(save).toContain('cryptoImpl.getRandomValues(draws)');
    expect(save).toContain('const bucket = draw % PUBLIC_BEACON_READ_SPACE;');
    expect(save).toContain("console.warn('[public] beacon bucket probe failed, announcing in the home bucket', error);");
    expect(app).toContain('const bucket = await chooseChannelBeaconBucket(walletHash, createdAtSec);');
  });
  it('BEACONROLL-06: the roll fires on what a READER can see, not on what the shard can hold', async () => {
    const entries = new Map<number, number>([[HOME, BEACON_READABLE_ENTRIES], ...CANDIDATES.map((b) => [b, 0] as [number, number])]);
    const rolled = chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES,
      entriesOf: (b: number) => entries.get(b) ?? null,
      roomOf: () => 4_096 - BEACON_READABLE_ENTRIES,
    });
    expect(rolled.rolled, 'a bucket at the readable limit must roll however much capacity is left').toBe(true);
    expect(CANDIDATES).toContain(rolled.bucket);

    entries.set(HOME, BEACON_READABLE_ENTRIES - 1);
    expect(chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES, entriesOf: (b: number) => entries.get(b) ?? null, roomOf: () => 1,
    }).rolled, 'a readable bucket must not be abandoned').toBe(false);

    expect(chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES, entriesOf: () => null, roomOf: () => null,
    }).reason).toBe('unknown');
  });

  it('BEACONROLL-07: the writer mirror of the reader window cannot drift from it', () => {
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    const pageRows = Number(lane.match(/const PAGE_ROWS = (\d+);/)?.[1]);
    expect(pageRows, 'the reader page cap must still be there').toBeGreaterThan(0);
    expect(BEACON_READABLE_ENTRIES, 'head page + tail page, exactly').toBe(pageRows * 2);
    expect(lane).toContain('if (first.entry_count > 96n) {');
    expect(lane).toContain('const tail = await readers.readShardPosts(state.address, { entryCount: first.entry_count });');
  });
});
