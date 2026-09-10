import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { chooseBeaconBucket, BEACON_READABLE_ENTRIES } from '../web/public-lane-send.mjs';
import { createPublicLane } from '../web/public-lane.mjs';
import { publicBeaconPartitionKey, publicEpochTag, publicEraOf, addrKey } from '../web/shard-discovery.mjs';
import { publicShardAddressBytes, rawAddress } from '../web/shard-address.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A FULL DIRECTORY BUCKET IS NO LONGER A PERMANENT DENIAL.
//
// A BEACON bucket-era holds PS_SAFE_CAP = 4096 entries and the BEACON era is a YEAR. The live contract refuses a
// full shard in COMPUTE (gate 13705), so an announcement into a full bucket bounces and the channel is simply not
// in Discover. MEASURED by audit: 57.2 GRAM fills one. With the bucket pinned to walletHash % 1024 that was a
// targeted, year-long denial for the price of a dinner, and the victim could not move.
//
// IT WAS NEVER PINNED BY THE CONTRACT. A BEACON address folds H(PS_BEACON_DOMAIN, bucket) with no sender in it
// (PublicShard.tact:301); gate 13702 checks only that the claimed key matches the address you sent to; and
// `publisher` is stamped by the VM from sender, so an entry can still only advertise its own announcer. The
// sweep reads every bucket and keys the catalogue by publisher, so an announcement is found wherever it lands.
// The contract's own overflow note says it in as many words: "overflow is the client's job".
//
// The roll is RANDOM rather than home+1 on purpose: an attacker who cannot predict the next bucket has to fill
// all 1024 to deny one channel — 58,573 GRAM and a network-wide attack — instead of 57.2 GRAM and a person.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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
    // 101 has three slots left, which is INSIDE the margin — a save that lands at the cap bounces, so "nearly
    // full" is treated as full.
    expect(choice).toMatchObject({ bucket: 202, rolled: true, reason: 'home-full' });
  });

  it('BEACONROLL-03: an UNREADABLE probe is not a full bucket', () => {
    // The one way this could make things worse: treating a bad minute on the network as "your bucket is full" and
    // scattering announcements no reader expects. Unknown means home.
    const choice = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: () => null });
    expect(choice).toMatchObject({ bucket: HOME, rolled: false, reason: 'unknown' });
    const thrown = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: () => { throw new Error('rpc'); } });
    expect(thrown.bucket).toBe(HOME);
    // And when the home bucket IS known full but nothing else can be read, the save still goes to the home bucket:
    // the publish bounces and says so, which beats writing into a bucket we have no reason to think is freer.
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
      // Only the home bucket exists on chain; the rest have never been written to.
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
        // partition_key, epoch_tag, kind, era_index, entry_count, safe_cap,... — the shipping shape.
        return { stack: [num(1n), num(BigInt(tag)), num(2n), num(0n), num(4090n), num(4096n), num(0n), num(0n), num(0n), num(0n), num(0n), num(0n), num(0n)] };
      },
    });

    const room = await lane.readBeaconBucketRoom([HOME, ...CANDIDATES], { nowUnix: CLOCK });
    expect(room.get(HOME)).toMatchObject({ live: true, entryCount: 4090, safeCap: 4096, room: 6 });
    for (const bucket of CANDIDATES) {
      // An uninitialised bucket-era holds nothing — the shard is deployed by its first entry — so this is a fact,
      // not a guess, and it must not read as "unknown" or the roll would never find anywhere to go.
      expect(room.get(bucket)).toMatchObject({ live: false, entryCount: 0, room: Number.POSITIVE_INFINITY });
    }
    // The cap comes from the SHARD, never from a constant copied into the client.
    expect(room.get(HOME)?.safeCap).toBe(4096);

    const choice = chooseBeaconBucket({ home: HOME, candidates: CANDIDATES, roomOf: (b: number) => room.get(b)?.room ?? null });
    expect(choice.rolled, 'six slots left is inside the margin, so it rolls').toBe(true);
    expect(CANDIDATES).toContain(choice.bucket);
  });

  it('BEACONROLL-05: the save path uses it, and the roll is unpredictable', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const save = app.slice(app.indexOf('async function chooseChannelBeaconBucket('), app.indexOf('async function publishChannelProfileDirect('));
    expect(save).toContain('const home = Number(walletHash % BigInt(PUBLIC_BEACON_READ_SPACE));');
    // RANDOM, not home+1: a predictable roll can be pre-filled for the same 57.2 GRAM per bucket.
    expect(save).toContain('cryptoImpl.getRandomValues(draws)');
    expect(save).toContain('const bucket = draw % PUBLIC_BEACON_READ_SPACE;');
    // Every failure path lands on the home bucket rather than refusing to announce.
    expect(save).toContain("console.warn('[public] beacon bucket probe failed, announcing in the home bucket', error);");
    expect(app).toContain('const bucket = await chooseChannelBeaconBucket(walletHash, createdAtSec);');
  });
  it('BEACONROLL-06: the roll fires on what a READER can see, not on what the shard can hold', async () => {
    // [audit 2026-09-01, round 9.] The margin was 8 — the roll waited until a bucket was within 8 entries of
    // PS_SAFE_CAP, i.e. 4,088 announcements. But sweepChannelCatalog does not read a bucket: it reads the HEAD
    // page and the TAIL page, PS_PAGE_CAP rows each. Everything between is on chain, paid for, inside its
    // retention, and reachable by no client path. MEASURED: a bucket filled to 201 entries with an honest
    // channel's only announcement at index 100 returned ONE channel from the sweep — the spammer — while the
    // room probe reported 3,895 free and the roll declined to fire. Burying a named victim cost 192
    // announcements (3.10 GRAM at the measured 16,128,102 each), not the 66 GRAM a full bucket costs.
    const entries = new Map<number, number>([[HOME, BEACON_READABLE_ENTRIES], ...CANDIDATES.map((b) => [b, 0] as [number, number])]);
    const rolled = chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES,
      entriesOf: (b: number) => entries.get(b) ?? null,
      roomOf: () => 4_096 - BEACON_READABLE_ENTRIES,   // acres of capacity: the old form would NOT have rolled
    });
    expect(rolled.rolled, 'a bucket at the readable limit must roll however much capacity is left').toBe(true);
    expect(CANDIDATES).toContain(rolled.bucket);

    // One row below the limit is still the home bucket — the trigger is exactly the window, not a guess near it.
    entries.set(HOME, BEACON_READABLE_ENTRIES - 1);
    expect(chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES, entriesOf: (b: number) => entries.get(b) ?? null, roomOf: () => 1,
    }).rolled, 'a readable bucket must not be abandoned').toBe(false);

    // An unreadable probe is still NOT full: refusing to announce on a bad minute would be worse than announcing.
    expect(chooseBeaconBucket({
      home: HOME, candidates: CANDIDATES, entriesOf: () => null, roomOf: () => null,
    }).reason).toBe('unknown');
  });

  it('BEACONROLL-07: the writer mirror of the reader window cannot drift from it', () => {
    // BEACON_READABLE_ENTRIES is the reader's head page plus its tail page. It is mirrored rather than imported
    // (public-lane imports this module's siblings), so the two numbers are held equal here.
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    const pageRows = Number(lane.match(/const PAGE_ROWS = (\d+);/)?.[1]);
    expect(pageRows, 'the reader page cap must still be there').toBeGreaterThan(0);
    expect(BEACON_READABLE_ENTRIES, 'head page + tail page, exactly').toBe(pageRows * 2);
    // …and the sweep must really read both windows, or the mirror describes something that is not happening.
    expect(lane).toContain('if (first.entry_count > 96n) {');
    expect(lane).toContain('const tail = await readShardPosts(state.address, { entryCount: first.entry_count });');
  });
});
