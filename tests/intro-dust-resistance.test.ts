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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO DUST RESISTANCE — the cheapest attack found against this product, and the reason it was invisible.
//
// THE ATTACK [audit 2026-08-28]. A bucket address needs no contract to become expensive. toncenter omits an
// address it has NEVER seen, but an address that was touched ONCE and is now empty comes back forever as a full
// ~525 B `uninit` row — a behaviour web/intro-scan-policy.mjs measured against the live endpoint and wrote down,
// considering only retired shards. So one 1-nanoton bodiless transfer to each of the 1024 bucket addresses of an
// epoch, costing ~0.31 GRAM, permanently adds 1024 dead rows to EVERY scanner's EVERY pass. No contract runs, no
// fee is charged, no gate and no SAFE-CAP is involved, and there is no on-chain remedy because there is nothing
// on chain to remedy.
//
// It poisoned both things a pass decides: changedSince listed every dead row (its marker is unknown) and spent a
// doomed getter call on it, and distinctLiveBuckets counted it — the statistic that sizes the hot range and
// therefore the poll interval. MEASURED by the audit: hot pass 987 B -> 579,686 B, poll 1 minute -> 60 minutes.
//
// WHY NOTHING CAUGHT IT. Every existing INTRO test injects a readStates that SKIPS non-active accounts
// ("uninit -> absent, never an error"), which models the never-touched address and not the touched one. The
// fixture could not express the attack. This gate injects the real behaviour instead.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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

  /** The endpoint as it really behaves: a touched-but-empty address returns a full `uninit` row. */
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
        // Touched once, nothing there: the indexer keeps answering about it forever.
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
    await publishIntroTo(scanSecret, 0);   // one honest first contact, in the bucket the write rule picks

    // The attacker touches every bucket address in the window.
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
    // `changed`, NOT `pagesRead` [corrected 2026-08-29]. pagesRead is incremented AFTER the null check, so a
    // doomed getter call costs nothing in this counter — an auditor let the dusted rows back into the set that
    // feeds changedSince and both DUST tests stayed green while the pass made 48 real round trips against a
    // reported pagesRead of 1. `changed` IS the set of buckets the pass decided to open, which is the half of
    // the attack that costs requests; the other half is the statistic asserted above.
    expect(res.stats.changed, 'a dead address must never be opened — this is the request half of the attack')
      .toBe(1);
    expect(res.stats.pagesRead, 'and it must not cost a page read either').toBe(1);
    expect(res.stats.liveBucketIndices, 'the named live set is the honest one').toEqual([0]);
  }, 120_000);

  it('DUST-03: a bucket made ACTIVE but EMPTY stops counting once the scan has looked inside it', async () => {
    // THE SUCCESSOR TO THE ATTACK ABOVE, and it walks straight past the fix for it. DUST-01/02 drop rows that
    // are merely `uninit`, so the answer is to make the account REAL: `IntroShard.receive {}` accepts a bare
    // transfer, and the bucket is then `active` with no entries in it at all.
    //
    // MEASURED 2026-09-01: 1024 such buckets in one epoch cost the attacker 2.24 GRAM and took the poll interval
    // from 60,000 ms to 980,111 ms — a first contact arriving in sixteen minutes instead of one, for every
    // scanner in the network. That is ~3,570x cheaper than doing the same damage with real intros, which is the
    // wall this lane's flat fee was designed to be.
    //
    // THE CONTRACT CANNOT CLOSE IT, measured before assuming: a message carrying StateInit applies that StateInit
    // EVEN WHEN THE TRANSACTION ABORTS. Sent with an unknown opcode, the shard throws 130, `aborted` is true, and
    // the account is still `active` (balance 0). So making the empty receiver throw would leave the attacker with
    // the same active buckets and a CHEAPER bill — they would keep the attached value and pay only gas. The fix
    // has to be the statistic, and the statistic has the evidence: a drained empty bucket carries `nextId: 0`.
    const scanSecret = x25519.utils.randomSecretKey();
    await publishIntroTo(scanSecret, 0);

    // Every other bucket of the epoch, made active and empty by a bare transfer — no fee, no gate, no entry.
    for (let b = 1; b < READ_SPACE; b += 1) {
      const init = (await IntroShard.fromInit(BigInt(epoch), BigInt(b))).init!;
      await payer.send({ to: Address.parse(String(await introShardAddress(epoch, b))),
        value: toNano('0.05'), bounce: false, init, body: beginCell().endCell() } as any);
    }

    const args = { scanSecretKey: scanSecret, currentEpoch: epoch, fromEpoch: epoch, toEpoch: epoch,
      readSpace: READ_SPACE, readStates: readStatesWithDust(new Set<string>()), readScanPage };

    // TWO PASSES, because the fix has to hold on both and for different reasons. The statistic is computed
    // AFTER the drain loop, so pass 1 already reports the narrowed count for the buckets it opened; pass 2 gets
    // there from the committed cursors without opening anything. MEASURED: 1 on both.
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

    // AND THE CADENCE HOLDS, which is the half that reaches the user.
    // ASSERT WHAT THE NEXT PASS WILL ASK FOR, NOT ONLY HOW OFTEN [round 15]. Round 14 narrowed the COUNT and
    // left liveBucketIndices naming every bucket that merely exists; those become the next pass's
    // extraBuckets, which passCostBytes does not count — so the request stayed full width while the interval
    // fell to 60 s, and the poisoned pass ran SIXTEEN TIMES MORE OFTEN than before the fix (90,269
    // address-asks a day became 1,474,560, against a 30 MiB budget). A gate that watched only the statistic
    // could not see it. This one prices the pass the scan actually asks for.
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
    // This is the damage that reaches the user: the hot range, and with it how often first contact is polled.
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

    // With the filter in place the scan reports the honest count even under a full dusting, so the policy it
    // feeds is unaffected. DUST-01 proves the count; this pins the consequence to it.
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
