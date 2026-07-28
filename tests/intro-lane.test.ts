import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { toNano, beginCell, contractAddress, Address } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { epochOf, introShardAddress, addrKey } from '../web/shard-discovery.mjs';
import { createIntroLane } from '../web/intro-lane.mjs';
import { createMemoryIntroCursorStore } from '../web/intro-cursor-store.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-LANE — the assembly, run end to end against a real contract.
//
// Every piece of this lane was already tested alone, and the lane still did not work: the app imported none of
// it, and where two pieces did meet the types did not (the production decoder handed the production unpacker a
// cell it could not read, and no test in the repo put those two together). So this file exists to exercise the
// join, not the parts — a real IntroShard, a real publish, a real stealth key, and the assembled runner.
//
// What it deliberately does NOT do is decide what a first contact MEANS. createIntroLane stops at onIntro
// because which conversation a first contact starts, and where its K_root lives, is a subsystem the app does
// not have yet. A guess at it buried in plumbing would be worse than the gap.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;
const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const FA_BUYBACK = Address.parse('UQDCA1g25Mx4PpNlQNRBJhlTjCLKsBeRtGDKlQrdMGbAetlc');
const INTRO_DEPLOY = 17_810_000n;   // IS_DEPLOY_MIN_VALUE — read from the live getter, not remembered

/**
 * Stand in for toncenter on the two endpoints the lane reads: /accountStates for what exists, /messages for the
 * capsule bodies. Both are served from the sandbox, so the fixture is the chain rather than a hand-written shape.
 * ABSENT MEANS EMPTY — a bucket nobody wrote to simply has no row, which is the ordinary case under lazy deploy.
 */
function fakeToncenter(bc: Blockchain, shardAddress: string, inbound: any[]) {
  return async (url: string) => {
    const text = String(url);
    if (text.includes('/messages')) {
      // The sandbox does not expose an account's transactions (bc.getContract has no `transactions`), so the
      // fixture collects the inbound bodies as it publishes — which is closer to the real thing anyway: these
      // are the exact cells the chain carried.
      const messages = [...inbound].reverse()
        .map((body: any) => ({ message_content: { body: body.toBoc().toString('base64') } }));
      return { ok: true, status: 200, json: async () => ({ messages }) } as any;
    }
    const asked = text.includes(encodeURIComponent(shardAddress));
    const account = await bc.getContract(Address.parse(shardAddress));
    return {
      ok: true, status: 200,
      json: async () => ({
        accounts: asked ? [{
          address: Address.parse(shardAddress).toRawString(),
          status: 'active',
          balance: String(account.balance),
          // The marker deliberately does not move between passes: nothing changed on chain, so a later pass must
          // find nothing new even before the delivery ledger is consulted.
          data_hash: 'dh-1',
          last_transaction_lt: '1',
        }] : [],
      }),
    } as any;
  };
}

/** The app's transport shape: one get-method call, raw toncenter-style response. */
function runGetMethodFrom(bc: Blockchain) {
  return async ({ address, method, stack }: any) => {
    const res = await bc.runGetMethod(Address.parse(String(address)), method, (stack ?? []).map((s: any) => ({
      type: 'int', value: BigInt(s.value ?? s),
    })) as any);
    return {
      exit_code: res.exitCode,
      stack: (res.stack as any[]).map((item: any) => (item.type === 'cell' || item.type === 'slice'
        ? { type: 'cell', value: item.cell.toBoc().toString('base64') }
        : { type: 'int', value: String(item.value) })),
    };
  };
}

describe('INTRO-LANE — a first contact travels from the chain to onIntro', () => {
  it('LANE-01: an intro addressed to this scan key is delivered, with its body verified', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deployFeeSink(bc, { funderSeed: 'lane-fund' });

    const epoch = epochOf(bc.now!);
    const bucket = 0n;                                  // the write rule packs densely from the bottom
    const payer = await bc.treasury('lane-payer');

    // A real recipient and a real stranger, so the filter has something to reject as well as something to find.
    const scanSecret = x25519.utils.randomSecretKey();
    const decoySecret = x25519.utils.randomSecretKey();
    const header0 = cellOf(0x11);
    const body = cellOf(0x22);

    const inbound: any[] = [];
    let mine: { r: bigint; tag: number } | null = null;
    for (let i = 0; i < 4; i += 1) {
      const ephemeral = x25519.utils.randomSecretKey();
      const R = x25519.getPublicKey(ephemeral);
      const owner = i === 2 ? scanSecret : decoySecret;
      const tag = await computePrivateScanViewTag(owner, R);
      const r = BigInt('0x' + Buffer.from(R).toString('hex'));
      if (i === 2) mine = { r, tag };
      const built = await buildIntroPublish({
        epoch, bucket, r, viewTag: BigInt(tag), header0, body,
        value: i === 0 ? INTRO_DEPLOY : 15_310_000n,
      });
      const res = await payer.send({
        to: built.to, value: i === 0 ? INTRO_DEPLOY : 15_310_000n,
        body: built.body, init: built.init, bounce: true,
      } as any);
      for (const t of res.transactions as any[]) {
        if (t.inMessage?.info?.dest?.toString() === String(built.to)) inbound.push(t.inMessage.body);
      }
    }
    expect(mine, 'the fixture published an intro for this key').toBeTruthy();

    // Assemble the lane against the sandbox. readStates is stubbed at the transport boundary only — everything
    // above it (the policy, the runner, the cursor store, the page decode, the body fetch) is the real thing.
    const shardAddress = await introShardAddress(epoch, Number(bucket));
    const delivered: any[] = [];
    const lane = await createIntroLane({
      scanSecretKey: scanSecret,
      // The sandbox clock, not Date.now() — see createIntroLane's note on `now`.
      now: () => bc.now! * 1000,
      readSpace: 4,
      setTimer: () => null,
      clearTimer: () => {},
      runGetMethod: runGetMethodFrom(bc),
      onIntro: (hit: any) => { delivered.push(hit); },
      store: createMemoryIntroCursorStore(),
      endpoint: 'https://example.invalid/api/v3/accountStates',
      // Stand in for toncenter on BOTH endpoints. Serving only /accountStates was the first version, and the
      // capsule then arrived as null — the tag matched, the hit was delivered, and the message had no content.
      // The body lives in the shard's TRANSACTION HISTORY, so /messages is half the receive path, not a detail.
      fetch: fakeToncenter(bc, shardAddress, inbound),
    });

    await lane.refreshNow();

    expect(delivered.length, 'exactly the intro addressed to this key').toBe(1);
    expect(delivered[0].r, 'and it is the right one').toBe(mine!.r);
    expect(delivered[0].epoch).toBe(epoch);
    expect(delivered[0].bucket).toBe(Number(bucket));
    expect(addrKey(shardAddress), 'the hit names the shard it came from').toBe(delivered[0].key);

    // THE BODY MUST ACTUALLY HAVE ARRIVED, not just the tag match. A first version of this test asserted only
    // the hit fields, so a broken body fetch would have passed it — `fetchCapsule` returning null still delivers
    // the hit, and a message with no content is not a message. The body lives in the shard's TRANSACTION
    // HISTORY, so this is the only assertion covering that half of the path.
    expect(delivered[0].capsule, 'the capsule body was fetched').toBeTruthy();
    expect(delivered[0].capsule.bodyCommit, 'and it was verified against what the contract stored').toBeTruthy();
    lane.stop();
  }, 300_000);

  it('LANE-02: it refuses to be built without the three things it cannot work without', async () => {
    // Each of these has a silent failure mode if defaulted: no scan key means every tag misses and the user
    // simply never hears from anyone; no transport means the same; no onIntro means hits are found and dropped.
    await expect(createIntroLane({} as any)).rejects.toThrow(/scanSecretKey/);
    await expect(createIntroLane({ scanSecretKey: new Uint8Array(32) } as any)).rejects.toThrow(/runGetMethod/);
    await expect(createIntroLane({
      scanSecretKey: new Uint8Array(32), runGetMethod: async () => ({}),
    } as any)).rejects.toThrow(/onIntro/);
  });

  it('LANE-03: a delivered intro is delivered ONCE, across passes', async () => {
    // The ledger is what makes a re-read safe, and a re-read is normal: a failed delivery deliberately leaves
    // its cursor alone so the next pass retries it. Showing a duplicate is showing rubbish.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deployFeeSink(bc, { funderSeed: 'l3-fund' });

    const epoch = epochOf(bc.now!);
    const payer = await bc.treasury('l3-payer');
    const scanSecret = x25519.utils.randomSecretKey();
    const ephemeral = x25519.utils.randomSecretKey();
    const R = x25519.getPublicKey(ephemeral);
    const tag = await computePrivateScanViewTag(scanSecret, R);
    const built = await buildIntroPublish({
      epoch, bucket: 0n, r: BigInt('0x' + Buffer.from(R).toString('hex')), viewTag: BigInt(tag),
      header0: cellOf(1), body: cellOf(2), value: INTRO_DEPLOY,
    });
    const pub = await payer.send({ to: built.to, value: INTRO_DEPLOY, body: built.body, init: built.init, bounce: true } as any);
    const inbound = (pub.transactions as any[])
      .filter((t) => t.inMessage?.info?.dest?.toString() === String(built.to))
      .map((t) => t.inMessage.body);

    const shardAddress = await introShardAddress(epoch, 0);
    const delivered: any[] = [];
    const lane = await createIntroLane({
      scanSecretKey: scanSecret,
      // The sandbox clock, not Date.now() — see createIntroLane's note on `now`.
      now: () => bc.now! * 1000,
      readSpace: 4,
      setTimer: () => null,
      clearTimer: () => {},
      runGetMethod: runGetMethodFrom(bc),
      onIntro: (hit: any) => { delivered.push(hit); },
      store: createMemoryIntroCursorStore(),
      endpoint: 'https://example.invalid/api/v3/accountStates',
      fetch: fakeToncenter(bc, shardAddress, inbound),
    });

    await lane.refreshNow();
    await lane.refreshNow();
    await lane.refreshNow();
    expect(delivered.length, 'three passes, one delivery').toBe(1);
    lane.stop();
  }, 300_000);
});
