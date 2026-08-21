import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { createIntroScanRunner, INTRO_CAPSULE_EAGER_RETRIES } from '../web/intro-scan-runner.mjs';
import { createMemoryIntroCursorStore } from '../web/intro-cursor-store.mjs';
import { DEFAULT_POLICY } from '../web/intro-scan-policy.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-SCAN-RUNNER — the loop, driven by a fake clock against a real chain.
//
// The runner is where the pieces become a behaviour, and where the failures are the ones a user would actually
// report: "it showed me the same message twice", "it never showed me the message at all", "it ate my data plan",
// "my battery died with the app in the background". Each test below is one of those sentences.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

describe('INTRO-SCAN-RUNNER — the loop a user actually experiences', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  const READ_SPACE = 8;

  // A controllable clock, so cadence is tested by arithmetic rather than by waiting.
  let clockMs: number;
  let timers: Array<{ id: number; at: number; fn: () => any }>;
  let nextTimerId: number;

  const now = () => clockMs;
  const setTimer = (fn: () => void, ms: number) => {
    const id = nextTimerId++;
    timers.push({ id, at: clockMs + ms, fn });
    return id;
  };
  const clearTimer = (id: any) => { timers = timers.filter((t) => t.id !== id); };
  /**
   * Advance the clock and run whatever became due, exactly as a real timer would — and AWAIT it. A scan pass is a
   * long async chain (load cursors, batch read, page, filter, deliver, save), so firing the callback without
   * waiting for it lets the assertions run against a pass that has not happened yet. That reads as a product bug
   * and is really a broken test harness, which is the more expensive kind of wrong.
   */
  async function advance(ms: number) {
    const target = clockMs + ms;
    for (let guard = 0; guard < 500; guard += 1) {
      const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t.id !== due.id);
      clockMs = due.at;
      await due.fn();
      await new Promise((r) => setImmediate(r));
    }
    clockMs = target;
  }

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    clockMs = blockchain.now * 1000;
    timers = [];
    nextTimerId = 1;
    payer = await blockchain.treasury('isr-payer');
  });

  const readStates = async (addresses: any[]) => {
    const out = new Map<string, any>();
    for (const address of addresses) {
      const contract = await blockchain.getContract(Address.parse(String(address)));
      const state: any = contract.accountState;
      if (!state || state.type !== 'active') continue;
      out.set(addrKey(address), {
        address, status: 'active', balance: contract.balance,
        dataHash: state.state?.data?.hash()?.toString('hex') ?? null,
        lastLt: String(contract.lastTransactionLt ?? ''), dataBoc: null,
      });
    }
    return out;
  };
  const readScanPage = async (address: any, fromId: number, maxCount: number) => {
    const contract = await blockchain.getContract(Address.parse(String(address)));
    if (!contract.accountState || (contract.accountState as any).type !== 'active') return null;
    return blockchain.openContract(IntroShard.fromAddress(Address.parse(String(address)))).getGetScanPage(BigInt(fromId), BigInt(maxCount));
  };

  async function publishIntroTo(ownerScanSecret: Uint8Array, bucket: number) {
    const ephemeralSecret = x25519.utils.randomSecretKey();
    const R = x25519.getPublicKey(ephemeralSecret);
    const tag = await computePrivateScanViewTag(ownerScanSecret, R);
    const built = await buildIntroPublish({
      epoch, bucket: BigInt(bucket), r: BigInt('0x' + Buffer.from(R).toString('hex')), viewTag: BigInt(tag),
      header0: cellOf(1), body: cellOf(2), value: toNano('0.05'),
    });
    await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
  }

  function makeRunner(scanSecretKey: Uint8Array, store: any, delivered: any[], extra: any = {}) {
    return createIntroScanRunner({
      scanSecretKey, store, readStates, readScanPage,
      onIntro: async (d: any) => { delivered.push(d); },
      readSpace: READ_SPACE, now, setTimer, clearTimer,
      ...extra,
    });
  }

  it('RUN-01: a first contact arrives on the very first pass — the app-open case', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 2);

    const delivered: any[] = [];
    const runner = makeRunner(mine, createMemoryIntroCursorStore(), delivered);
    await runner.start();

    expect(delivered.length, 'opening the app finds it immediately, no waiting for a cadence').toBe(1);
    runner.stop();
  }, 240_000);

  it('RUN-02: the same intro is never delivered twice, across passes and across a restart', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 1);

    const store = createMemoryIntroCursorStore();
    const delivered: any[] = [];
    const runner = makeRunner(mine, store, delivered);
    await runner.start();
    expect(delivered.length).toBe(1);

    // several cadence ticks go by with nothing new
    await advance(10 * 60_000);
    expect(delivered.length, 'idle passes deliver nothing').toBe(1);
    runner.stop();

    // the app is closed and reopened: the SAME store, a brand new runner
    const delivered2: any[] = [];
    const reopened = makeRunner(mine, store, delivered2);
    await reopened.start();
    expect(delivered2, 'a restart must not replay what was already shown').toEqual([]);

    // and a genuinely new intro still arrives
    await publishIntroTo(mine, 1);
    await advance(5 * 60_000);
    expect(delivered2.length, 'the new one does arrive').toBe(1);
    reopened.stop();
  }, 300_000);

  it('RUN-03: stopping really stops — a hidden app spends nothing', async () => {
    const mine = x25519.utils.randomSecretKey();
    let stateReads = 0;
    const counting = async (addresses: any[]) => { stateReads += 1; return readStates(addresses); };

    const runner = makeRunner(mine, createMemoryIntroCursorStore(), [], { readStates: counting });
    await runner.start();
    const afterStart = stateReads;
    runner.stop();

    await advance(60 * 60_000);   // an hour in the background
    expect(stateReads, 'not one request while stopped').toBe(afterStart);

    await runner.start();
    expect(stateReads, 'and it resumes when the app comes back').toBeGreaterThan(afterStart);
    runner.stop();
  }, 240_000);

  it('RUN-04: a failing endpoint does not lose the contact and does not stop the loop', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 5);

    let failures = 2;
    const flaky = async (address: any, fromId: number, maxCount: number) => {
      if (failures > 0) { failures -= 1; throw new Error('503 Service Unavailable'); }
      return readScanPage(address, fromId, maxCount);
    };

    const delivered: any[] = [];
    const runner = makeRunner(mine, createMemoryIntroCursorStore(), delivered, { readScanPage: flaky });
    await runner.start();
    expect(delivered, 'the failing passes deliver nothing, as they must').toEqual([]);

    await advance(10 * 60_000);   // the loop keeps trying
    expect(delivered.length, 'and once the endpoint recovers, the contact still arrives').toBe(1);
    runner.stop();
  }, 300_000);

  it('RUN-05: cursors for shards past the window are pruned, so the map cannot grow forever', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 3);

    const store = createMemoryIntroCursorStore();
    const runner = makeRunner(mine, store, []);
    await runner.start();
    const afterFirst = (await store.load()).size;
    expect(afterFirst, 'the shard we read is remembered').toBeGreaterThan(0);
    runner.stop();

    // a month passes; every shard from that first pass has aged out of the retention window
    blockchain.now = blockchain.now! + 86400 * 30;
    clockMs = blockchain.now * 1000;
    const later = makeRunner(mine, store, []);
    await later.start();
    later.stop();

    const keys = [...(await store.load()).keys()];
    expect(keys.length, 'stale shards are dropped, not accumulated for the life of the install').toBeLessThanOrEqual(afterFirst);
    const staleKey = addrKey(contractAddress(0, await IntroShard.init(BigInt(epoch), 3n)));
    expect(keys, 'the shard from a month ago is gone').not.toContain(staleKey);
  }, 300_000);

  it('RUN-06: the cadence follows the plan, and a manual refresh sweeps the whole space now', async () => {
    const mine = x25519.utils.randomSecretKey();
    const store = createMemoryIntroCursorStore();
    const runner = makeRunner(mine, store, []);
    await runner.start();
    // The FIRST pass is necessarily a full sweep — a client with no history has to look everywhere once.
    expect(runner.lastStats!.plan.full, 'the cold-start pass sweeps everything').toBe(true);
    const probedFull = runner.lastStats!.probed;

    // the next scheduled pass is a hot one, and must be strictly cheaper
    await advance(DEFAULT_POLICY.minIntervalMs + 1_000);
    const probedHot = runner.lastStats!.probed;
    expect(runner.lastStats!.plan.full, 'the follow-up is a hot pass').toBe(false);
    expect(probedHot, 'which looks at strictly less than the full sweep').toBeLessThan(probedFull);

    const outcome = await runner.refreshNow();
    expect(outcome!.stats.plan.full, 'a user-initiated refresh is a full sweep again').toBe(true);
    expect(outcome!.stats.probed, 'and it looks at more than the hot pass did').toBeGreaterThan(probedHot);

    // the plan reports what it expects to spend, so the cost is never invisible
    expect(outcome!.stats.plan.estimatedDailyBytes).toBeGreaterThan(0);
    runner.stop();
  }, 300_000);

  it('RUN-07: two overlapping passes cannot clobber each other', async () => {
    // A manual refresh landing on top of a scheduled pass: both load the cursor map, both save. Whichever saves
    // second wins, and the other pass's progress is lost — which re-delivers its intros next time.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 4);

    const store = createMemoryIntroCursorStore();
    const delivered: any[] = [];
    const runner = makeRunner(mine, store, delivered);

    await Promise.all([runner.start(), runner.refreshNow(), runner.refreshNow()]);
    expect(delivered.length, 'concurrent passes still deliver exactly once').toBe(1);
    runner.stop();
  }, 300_000);

  it('RUN-08: stopping DURING a pass does not let that pass schedule the next one', async () => {
    // The real leak is not a pending timer — stop() clears that. It is a pass already in flight: it finishes
    // after stop() and calls schedule() on its way out, quietly reviving the loop in a backgrounded app. The user
    // sees a battery drain they never consented to, and nothing in the UI says the scanner is still running.
    const mine = x25519.utils.randomSecretKey();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let stateReads = 0;
    let firstPass = true;

    const slow = async (addresses: any[]) => {
      stateReads += 1;
      if (firstPass) { firstPass = false; await gate; }
      return readStates(addresses);
    };

    const runner = makeRunner(mine, createMemoryIntroCursorStore(), [], { readStates: slow });
    const started = runner.start();          // blocks inside the first pass
    await new Promise((r) => setImmediate(r));
    runner.stop();                           // the user backgrounds the app mid-pass
    release();
    await started;

    const afterStop = stateReads;
    await advance(60 * 60_000);
    expect(stateReads, 'the in-flight pass must not revive the loop on its way out').toBe(afterStop);
    expect(runner.isRunning, 'and the runner reports itself stopped').toBe(false);
  }, 240_000);

  it('RUN-09: even with the cursor lost, a first contact is not shown twice', async () => {
    // The cursor is the normal defence: a pass does not re-read what it already read. But it is not the only one
    // that must hold. A storage error, a restored backup, a retry after a failed delivery — anything that makes
    // the client re-read a bucket would otherwise put the same first contact in front of the user again. Showing
    // a duplicate is showing rubbish, so the delivery ledger enforces it independently of the cursor.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 2);

    const store = createMemoryIntroCursorStore();
    const delivered: any[] = [];
    const runner = makeRunner(mine, store, delivered);
    await runner.start();
    expect(delivered.length).toBe(1);
    runner.stop();

    // the cursors are wiped, exactly as a storage failure or a stale backup would leave them
    await store.save(new Map());

    const delivered2: any[] = [];
    const reopened = makeRunner(mine, store, delivered2);
    await reopened.start();
    expect(reopened.lastStats!.candidates, 'the bucket really was re-read').toBeGreaterThan(0);
    expect(delivered2, 'and yet nothing was shown a second time').toEqual([]);
    reopened.stop();
  }, 300_000);

  it('RUN-10: a delivery that FAILS is retried, and only then recorded', async () => {
    // The ledger must not run ahead of the hand-off: recording a delivery that threw would turn a transient UI
    // error into a permanently invisible first contact — the exact failure the ledger exists alongside, not a
    // second instance of it.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 6);

    const store = createMemoryIntroCursorStore();
    let failFirst = true;
    const seen: any[] = [];
    const runner = createIntroScanRunner({
      scanSecretKey: mine, store, readStates, readScanPage,
      onIntro: async (d: any) => {
        if (failFirst) { failFirst = false; throw new Error('the UI blew up while rendering it'); }
        seen.push(d);
      },
      readSpace: READ_SPACE, now, setTimer, clearTimer, onError: () => {},
    });

    await runner.start();
    expect(seen, 'the failed hand-off delivered nothing').toEqual([]);

    await advance(5 * 60_000);
    expect(seen.length, 'and the retry does deliver it').toBe(1);

    await advance(5 * 60_000);
    expect(seen.length, 'but only once — the retry is recorded').toBe(1);
    runner.stop();
  }, 300_000);

  it('RUN-12: a body that cannot be fetched is retried with back-off — never handed over as null, never once a pass forever', async () => {
    // OBSERVED 2026-08-21 in the owner's console, once a minute: "[intro] scan error TypeError: intro header0 must be
    // a TON cell or BoC payload". The scan page had the entry, get_entry had it, and toncenter's /messages did not
    // yet carry the publish — fetchCapsule answered null, the runner handed `capsule: null` to onIntro, the handler
    // threw about header0, the cursor rolled back, and the identical fetch ran again on every pass for as long as
    // the app lived. A null body is "try again later": eagerly for a few passes (index lag is seconds), then with a
    // doubling back-off — and the moment the body appears, it is delivered exactly once.
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 3);

    const store = createMemoryIntroCursorStore();
    let passes = 0;
    const load = store.load.bind(store);
    store.load = async () => { passes += 1; return load(); };
    let fetches = 0;
    let available = false;
    const errors: any[] = [];
    const delivered: any[] = [];
    const runner = makeRunner(mine, store, delivered, {
      fetchCapsule: async () => { fetches += 1; return available ? { header0: cellOf(1), body: cellOf(2), bodyCommit: 1n } : null; },
      onError: (error: any) => errors.push(error),
    });

    await runner.start();
    expect(fetches, 'the first pass tried to fetch the body').toBe(1);
    expect(delivered, 'and handed nothing over — a null body is not a first contact').toEqual([]);
    expect(errors.length, 'one honest line about it').toBe(1);
    expect(String(errors[0]?.message), 'which names the actual problem').toMatch(/not readable yet/);
    expect(errors[0]?.code).toBe('INTRO_CAPSULE_UNAVAILABLE');

    // Many more passes with the body still missing. Eager for the first few, then backing off: the number of
    // fetches grows like log(passes), not like passes — and the console is not written on every attempt either.
    for (let i = 0; i < 24; i += 1) await advance(5 * 60_000);
    expect(passes, 'the loop kept running').toBeGreaterThan(10);
    expect(delivered, 'still nothing handed over').toEqual([]);
    const bound = INTRO_CAPSULE_EAGER_RETRIES + 1 + Math.ceil(Math.log2(Math.max(1, passes)));
    expect(fetches, `${fetches} fetches over ${passes} passes — the retry must back off`).toBeLessThanOrEqual(bound);
    expect(fetches, 'but it keeps trying').toBeGreaterThanOrEqual(INTRO_CAPSULE_EAGER_RETRIES);
    expect(fetches, 'and it is NOT one fetch per pass').toBeLessThan(passes);
    expect(errors.length, 'and not a log line per attempt').toBeLessThan(fetches);
    expect(runner.lastStats!.unfetchable, 'the dump shows the stuck entry').toBe(1);

    // The body appears (the index caught up). The next due attempt delivers it — once.
    available = true;
    for (let i = 0; i < 200 && delivered.length === 0; i += 1) await advance(5 * 60_000);
    expect(delivered.length, 'delivered as soon as the body could be read').toBe(1);
    expect(delivered[0].capsule, 'with the body, never null').toBeTruthy();
    expect(runner.lastStats!.unfetchable, 'and it is no longer stuck').toBe(0);
    for (let i = 0; i < 6; i += 1) await advance(5 * 60_000);
    expect(delivered.length, 'and never a second time').toBe(1);
    runner.stop();
  }, 300_000);

  it('RUN-11: the delivery ledger is pruned, so it cannot grow for the life of the install', async () => {
    const mine = x25519.utils.randomSecretKey();
    await publishIntroTo(mine, 3);

    const store = createMemoryIntroCursorStore();
    const runner = makeRunner(mine, store, []);
    await runner.start();
    expect((await store.loadDelivered()).size, 'the delivery is recorded').toBe(1);
    runner.stop();

    // a month later that intro is long evicted, so remembering it is dead weight
    blockchain.now = blockchain.now! + 86400 * 30;
    clockMs = blockchain.now * 1000;
    const later = makeRunner(mine, store, []);
    await later.start();
    later.stop();
    expect((await store.loadDelivered()).size, 'records outside the window are dropped').toBe(0);
  }, 300_000);
});
