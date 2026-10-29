import { describe, expect, it, beforeEach } from 'vitest';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, toNano } from '@ton/core';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { addrKey, introShardAddress } from '../web/shard-discovery.mjs';
import { scanIntroWindow } from '../web/intro-receive.mjs';
import { planIntroScan } from '../web/intro-scan-policy.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';


const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

describe('INTRO-DUST', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  const READ_SPACE = 16;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('dust-payer');
  });

  const readStatesWithDust = (dusted: Set<string>) => async (addresses: any[]) => {
    const out = new Map<string, any>();
    for (const address of addresses) {
      const key = addrKey(address);
      const contract = await blockchain.getContract(Address.parse(String(address)));
      const state: any = contract.accountState;
      if (state && state.type === 'active') {
        out.set(key, { address, status: 'active', balance: contract.balance,
          dataHash: state.state?.data?.hash()?.toString('hex') ?? null,
          lastLt: String(contract.lastTransactionLt ?? ''), dataBoc: null });
      } else if (dusted.has(key)) {
        out.set(key, { address, status: 'uninit', balance: 1n, dataHash: null, lastLt: '4242', dataBoc: null });
      }
    }
    return out;
  };

  const readScanPage = async (address: any, fromId: number, maxCount: number) => {
    const contract = await blockchain.getContract(Address.parse(String(address)));
    if (!contract.accountState || (contract.accountState as any).type !== 'active') return null;
    const shard = blockchain.openContract(IntroShard.fromAddress(Address.parse(String(address))));
    return shard.getGetScanPage(BigInt(fromId), BigInt(maxCount));
  };

  async function publishIntroTo(scanSecret: Uint8Array, bucket: number) {
    const ephemeral = x25519.utils.randomSecretKey();
    const R = x25519.getPublicKey(ephemeral);
    const tag = await computePrivateScanViewTag(scanSecret, R);
    const built = await buildIntroPublish({
      epoch, bucket: BigInt(bucket), r: BigInt('0x' + Buffer.from(R).toString('hex')),
      viewTag: BigInt(tag), header0: cellOf(1), body: cellOf(2), value: toNano('0.05') });
    await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
  }

  it('DUST-01: dusted buckets cost no getter call and do not inflate the statistic that sets the poll interval', async () => {
    const scanSecret = x25519.utils.randomSecretKey();
    await publishIntroTo(scanSecret, 0);

    const dusted = new Set<string>();
    for (let e = epoch - 1; e <= epoch + 1; e += 1) {
      for (let b = 0; b < READ_SPACE; b += 1) dusted.add(addrKey(await introShardAddress(e, b)));
    }

    const res = await scanIntroWindow({
      scanSecretKey: scanSecret, currentEpoch: epoch, fromEpoch: epoch - 1, toEpoch: epoch + 1,
      readSpace: READ_SPACE, readStates: readStatesWithDust(dusted), readScanPage });

    // eslint-disable-next-line no-console
    console.log(`[DUST-01] live=${res.stats.live} distinctLiveBuckets=${res.stats.distinctLiveBuckets}`
      + ` changed=${res.stats.changed} pagesRead=${res.stats.pagesRead} hits=${res.hits.length}`);

    expect(res.hits.length, 'the honest first contact still arrives').toBe(1);
    expect(res.stats.distinctLiveBuckets,
      'THE POISONED STATISTIC: only genuinely live buckets may be counted').toBe(1);
    expect(res.stats.live, 'and the live tally counts only what is really there').toBe(1);
    expect(res.stats.changed, 'a dead address must never be opened — this is the request half of the attack')
      .toBe(1);
    expect(res.stats.pagesRead, 'and it must not cost a page read either').toBe(1);
    expect(res.stats.liveBucketIndices, 'the named live set is the honest one').toEqual([0]);
  }, 120_000);

  it('DUST-03: a bucket made ACTIVE but EMPTY stops counting once the scan has looked inside it', async () => {
    const scanSecret = x25519.utils.randomSecretKey();
    await publishIntroTo(scanSecret, 0);

    for (let b = 1; b < READ_SPACE; b += 1) {
      const init = (await IntroShard.fromInit(BigInt(epoch), BigInt(b))).init!;
      await payer.send({ to: Address.parse(String(await introShardAddress(epoch, b))),
        value: toNano('0.05'), bounce: false, init, body: beginCell().endCell() } as any);
    }

    const args = { scanSecretKey: scanSecret, currentEpoch: epoch, fromEpoch: epoch, toEpoch: epoch,
      readSpace: READ_SPACE, readStates: readStatesWithDust(new Set<string>()), readScanPage };

    const first = await scanIntroWindow(args);
    const second = await scanIntroWindow({ ...args, cursors: first.cursors });

    // eslint-disable-next-line no-console
    console.log(`[DUST-03] ${READ_SPACE - 1} active-but-empty buckets | pass 1 distinctLiveBuckets=`
      + `${first.stats.distinctLiveBuckets} | pass 2 distinctLiveBuckets=${second.stats.distinctLiveBuckets}`
      + ` | hits ${first.hits.length}/${second.hits.length}`);

    expect(first.hits.length, 'the honest first contact arrives on the first pass').toBe(1);
    expect(first.stats.distinctLiveBuckets,
      'and the narrowing holds on the pass that DOES the opening, not only on the one after it').toBe(1);
    expect(second.stats.distinctLiveBuckets,
      'THE POISONED STATISTIC: a bucket the scan has drained and found EMPTY holds no intro, so it must not '
      + 'size the hot range — only the one bucket that really carries a first contact may').toBe(1);
    expect(second.stats.live, 'the raw account tally still sees them all — the narrowing is deliberate and is '
      + 'only applied to the statistic that sets the cadence').toBe(READ_SPACE);

    const askedPerDay = (stats: any) => {
      const p = planIntroScan({ distinctLiveBuckets: stats.distinctLiveBuckets, liveBuckets: stats.live,
        liveBucketIndices: stats.liveBucketIndices, readSpace: 1024, msSinceFullSweep: 0 });
      const asked = (p.buckets.to - p.buckets.from) + (p.extraBuckets?.length ?? 0);
      return { asked, perDay: Math.round(asked * 86_400_000 / p.intervalMs) };
    };
    const poisonedAsk = askedPerDay(second.stats);
    // eslint-disable-next-line no-console
    console.log(`[DUST-03] under the poisoning the next pass asks ${poisonedAsk.asked} addresses, `
      + `${poisonedAsk.perDay} a day`);
    expect(poisonedAsk.asked, 'a bucket the scan drained and found EMPTY must not be named to the next pass '
      + 'either — naming it is what the pass actually spends its request on').toBeLessThanOrEqual(8);
    const plan = (n: number) => planIntroScan({
      distinctLiveBuckets: n, liveBuckets: n, readSpace: 1024, msSinceFullSweep: 0 });
    expect(plan(second.stats.distinctLiveBuckets).intervalMs,
      'first contact must still be polled at the honest cadence').toBe(plan(1).intervalMs);
    expect(plan(READ_SPACE).intervalMs, 'and the unnarrowed count really would have moved it')
      .toBeGreaterThanOrEqual(plan(1).intervalMs);
  }, 240_000);

  it('DUST-02: the poll interval the policy derives is unchanged by dusting the whole space', async () => {
    const plan = (n: number) => planIntroScan({
      distinctLiveBuckets: n, liveBuckets: n, readSpace: 1024, msSinceFullSweep: 0 });
    const honest = plan(1);
    const poisoned = plan(1024);
    // eslint-disable-next-line no-console
    console.log(`[DUST-02] honest buckets 0..${honest.buckets.to} poll=${honest.intervalMs / 1000}s`
      + ` pass=${honest.estimatedPassBytes}B | if the count were poisoned 0..${poisoned.buckets.to}`
      + ` poll=${poisoned.intervalMs / 1000}s pass=${poisoned.estimatedPassBytes}B`);
    expect(poisoned.intervalMs, 'a poisoned count really does collapse the polling cadence')
      .toBeGreaterThan(honest.intervalMs);

    const scanSecret = x25519.utils.randomSecretKey();
    await publishIntroTo(scanSecret, 0);
    const dusted = new Set<string>();
    for (let b = 0; b < READ_SPACE; b += 1) dusted.add(addrKey(await introShardAddress(epoch, b)));
    const res = await scanIntroWindow({
      scanSecretKey: scanSecret, currentEpoch: epoch, fromEpoch: epoch, toEpoch: epoch,
      readSpace: READ_SPACE, readStates: readStatesWithDust(dusted), readScanPage });
    expect(plan(res.stats.distinctLiveBuckets).intervalMs,
      'the cadence the scan actually asks for is the honest one, under a full dusting').toBe(honest.intervalMs);
  }, 120_000);
});
