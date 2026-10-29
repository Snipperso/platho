import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { FA_BUYBACK, deployFeeSink } from './helpers/fee-sink-fixture';
import { toNano, beginCell, contractAddress, Address } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { epochOf, introShardAddress, addrKey } from '../web/shard-discovery.mjs';
import { createIntroLane } from '../web/intro-lane.mjs';
import { createMemoryIntroCursorStore } from '../web/intro-cursor-store.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';


const cellOf = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;
const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const INTRO_DEPLOY = 17_810_000n;

function fakeToncenter(bc: Blockchain, shardAddress: string, inbound: any[]) {
  return async (url: string) => {
    const text = String(url);
    if (text.includes('/messages')) {
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
          data_hash: 'dh-1',
          last_transaction_lt: '1',
        }] : [],
      }),
    } as any;
  };
}

function toncenterInt(value: bigint): string {
  return value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
}

function runGetMethodFrom(bc: Blockchain) {
  return async ({ address, method, stack }: any) => {
    const res = await bc.runGetMethod(Address.parse(String(address)), method, (stack ?? []).map((s: any) => ({
      type: 'int', value: BigInt(s.value ?? s),
    })) as any);
    return {
      exit_code: res.exitCode,
      stack: (res.stack as any[]).map((item: any) => (item.type === 'cell' || item.type === 'slice'
        ? { type: 'cell', value: item.cell.toBoc().toString('base64') }
        : { type: 'int', value: toncenterInt(item.value) })),
    };
  };
}

describe('INTRO-LANE — a first contact travels from the chain to onIntro', () => {
  it('LANE-01: an intro addressed to this scan key is delivered, with its body verified', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sink = await deployFeeSink(bc, { funderSeed: 'lane-fund' });

    const epoch = epochOf(bc.now!);
    const bucket = 0n;
    const payer = await bc.treasury('lane-payer');

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

    const shardAddress = await introShardAddress(epoch, Number(bucket));
    const delivered: any[] = [];
    const lane = await createIntroLane({
      scanSecretKey: scanSecret,
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

    expect(delivered.length, 'exactly the intro addressed to this key').toBe(1);
    expect(delivered[0].r, 'and it is the right one').toBe(mine!.r);
    expect(delivered[0].epoch).toBe(epoch);
    expect(delivered[0].bucket).toBe(Number(bucket));
    expect(addrKey(shardAddress), 'the hit names the shard it came from').toBe(delivered[0].key);

    expect(delivered[0].capsule, 'the capsule body was fetched').toBeTruthy();
    expect(delivered[0].capsule.bodyCommit, 'and it was verified against what the contract stored').toBeTruthy();
    lane.stop();
  }, 300_000);

  it('LANE-02: it refuses to be built without the three things it cannot work without', async () => {
    await expect(createIntroLane({} as any)).rejects.toThrow(/scanSecretKey/);
    await expect(createIntroLane({ scanSecretKey: new Uint8Array(32) } as any)).rejects.toThrow(/runGetMethod/);
    await expect(createIntroLane({
      scanSecretKey: new Uint8Array(32), runGetMethod: async () => ({}),
    } as any)).rejects.toThrow(/onIntro/);
  });

  it('LANE-03: a delivered intro is delivered ONCE, across passes', async () => {
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
