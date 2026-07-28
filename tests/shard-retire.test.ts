import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { toNano, beginCell, contractAddress, Address, internal, SendMode } from '@ton/core';
import { WalletContractV5R1 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { buildIntroPublish, buildConvPublish } from '../web/publish-builder.mjs';
import { epochOf } from '../web/shard-discovery.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-RETIRE — one O(1) call ends a shard, replacing the per-entry eviction loop.
//
// WHY THE OLD DESIGN WAS DELETED, in one line of arithmetic: retiring a shard costs the SAME whatever it holds
// (measured 5140 gas at N = 1 … 4096), while the eviction bounty charged per RECORD. At RS_SAFE_CAP that bounty
// collected 4096 x 800_000 = 3.28 GRAM to fund a job worth 0.00096 GRAM — 3400x overfunded — and a one-record
// shard was still UNDERfunded, so a real caller LOST money sweeping it. Every publisher was paying 0.0008 GRAM
// per message for a service a rational actor would never perform.
//
// EVERY ECONOMIC FIGURE HERE IS MEASURED WITH A REAL WalletContractV5R1, NOT A SANDBOX TREASURY. That distinction
// cost this project a day: a treasury does no ed25519 verification and carries a smaller code cell, so it
// understates a real caller by ~224_200 — 200_134 of that the signature check alone. Every eviction figure
// measured with a treasury was optimistic, and one of them inverted the conclusion.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;               // after the Apr-2026 config-18 storage switch

const RS_DEPLOY_MIN_VALUE = 19_100_000n;
const IS_DEPLOY_MIN_VALUE = 17_810_000n;

const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
const FA_BUYBACK = Address.parse('UQDCA1g25Mx4PpNlQNRBJhlTjCLKsBeRtGDKlQrdMGbAetlc');

// The sink must be BOUND, not merely deployed: gate 15055 refuses a capsule fee from a shard it cannot
// re-derive, a publish whose fee is refused stores no record, and a shard with no records cannot pay its
// retirer. That is how a missing bind shows up here — as a NEGATIVE payout, four steps from its cause.
const deploySink = (bc: Blockchain) => deployFeeSink(bc, { funderSeed: 'retire-sink-funder' });

/**
 * A REAL wallet, warmed. Two details matter and both were learned the hard way:
 *  - a treasury is not a wallet (see the header), so every net figure below uses this;
 *  - a COLD w5 bills its own deploy StateInit to the first measured send, which flatters nothing but confuses
 *    everything, so the wallet is deployed and its balance sampled only afterwards.
 */
async function warmWallet(bc: Blockchain, seed: string) {
  const key = await mnemonicToPrivateKey([seed, 'retire', 'probe', 'wallet']);
  const wallet = bc.openContract(WalletContractV5R1.create({ workchain: 0, publicKey: key.publicKey }));
  const funder = await bc.treasury(`fund-${seed}`);
  await funder.send({ to: wallet.address, value: toNano('50'), bounce: false } as any);
  const send = async (to: Address, value: bigint, body: any) => {
    const seqno = await wallet.getSeqno();
    return wallet.sendTransfer({
      seqno, secretKey: key.secretKey, sendMode: SendMode.PAY_GAS_SEPARATELY,
      // valid_until MUST be derived from the SANDBOX clock. Left to default it is computed from Date.now(), which
      // here is a year behind bc.now — the external message arrives already expired and the wallet refuses it
      // with "External message not accepted by smart contract", which looks nothing like a clock problem.
      timeout: bc.now! + 3600,
      messages: [internal({ to, value, body, bounce: true })],
    });
  };
  await send(funder.address, toNano('0.01'), null);   // warm it: deploy the wallet before anything is measured
  return { wallet, send };
}

async function fillConv(bc: Blockchain, n: number, seed: number) {
  const epoch = epochOf(bc.now!);
  const payer = await bc.treasury(`rt-conv-${seed}`);
  const secret = new Uint8Array(32).fill(seed);
  const publicKey = ed25519.getPublicKey(secret);
  let to: any = null;
  for (let i = 0; i < n; i += 1) {
    const b = await buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq: BigInt(i + 1), epoch,
      header0: cell(i & 255), header1: cell((i + 1) & 255), body: cell((i + 2) & 255), value: toNano('0.05'),
    });
    to = b.to;
    const due = i === 0 ? RS_DEPLOY_MIN_VALUE : toNano('0.05');
    await payer.send({ to: b.to, value: due, body: b.body, init: b.init, bounce: true } as any);
  }
  return bc.openContract(RecordShard.fromAddress(to));
}

const retireBody = (op: number) => beginCell().storeUint(op, 32).endCell();
const RS_RETIRE = 0x52535033;
const IS_RETIRE = 0x49535033;

describe('SHARD-RETIRE — one call ends a shard, and it pays at every size', () => {
  it('RT-01: the gate is EXACT — refused at the retire instant, accepted one second later', async () => {
    // The retire destroys the account permanently, so this gate is the only thing standing between a live
    // conversation and its deletion. It depends solely on `epoch`, which is an init parameter and therefore baked
    // into the address — no amount of money, and no ordering, can move it.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const shard = await fillConv(bc, 2, 0x11);
    const retireAt = Number((await shard.getGetView()).retire_at);

    const w = await warmWallet(bc, 'early');
    bc.now = retireAt;                                   // exactly at the instant: the gate is `>`, so REFUSED
    const at = await w.send(shard.address, toNano('0.05'), retireBody(RS_RETIRE));
    const atTx = (at.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(atTx?.description?.computePhase?.exitCode, 'at the instant itself the shard must survive').toBe(13655);
    expect((await bc.getContract(shard.address)).accountState?.type, 'and still be active').toBe('active');
    expect((await shard.getGetView()).record_count, 'with its records intact').toBe(2n);

    bc.now = retireAt + 1;
    await w.send(shard.address, toNano('0.05'), retireBody(RS_RETIRE));
    expect((await bc.getContract(shard.address)).accountState?.type, 'one second later it is gone').not.toBe('active');
  }, 300_000);

  it('RT-02: a ONE-record shard pays its retirer — the case the per-record bounty could never fund', async () => {
    // Under the deleted design a real w5 wallet LOST 191_740 sweeping a single record, so nobody would have. The
    // whole point of moving the funding into the per-shard base endowment is that N=1 now works.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const shard = await fillConv(bc, 1, 0x21);
    const retireAt = Number((await shard.getGetView()).retire_at);

    const w = await warmWallet(bc, 'one');
    bc.now = retireAt + 86400;
    const before = (await bc.getContract(w.wallet.address)).balance;
    await w.send(shard.address, toNano('0.05'), retireBody(RS_RETIRE));
    const net = (await bc.getContract(w.wallet.address)).balance - before;

    expect(net, `a one-record retire must pay a REAL wallet (got ${net})`).toBeGreaterThan(0n);
    expect((await bc.getContract(shard.address)).accountState?.type).not.toBe('active');
  }, 300_000);

  it('RT-03: the payout scales with the shard, and the cost does not', async () => {
    // The governing property: the caller's cost is a per-SHARD constant while the residual grows with N. That is
    // exactly the shape the old per-record bounty got backwards.
    const nets: Array<{ n: number; net: bigint }> = [];
    for (const n of [1, 8, 64]) {
      const bc = await Blockchain.create();
      bc.now = CLOCK;
      await deploySink(bc);
      const shard = await fillConv(bc, n, 0x30 + n);
      const retireAt = Number((await shard.getGetView()).retire_at);
      const w = await warmWallet(bc, `scale${n}`);
      bc.now = retireAt + 86400;
      const before = (await bc.getContract(w.wallet.address)).balance;
      await w.send(shard.address, toNano('0.05'), retireBody(RS_RETIRE));
      nets.push({ n, net: (await bc.getContract(w.wallet.address)).balance - before });
    }
    for (const { n, net } of nets) expect(net, `N=${n} must pay`).toBeGreaterThan(0n);
    expect(nets[2].net, 'a bigger shard returns more').toBeGreaterThan(nets[0].net);
    console.log(`  [RT-03] retire net — ${nets.map((r) => `N=${r.n}: ${r.net}`).join(', ')}`);
  }, 900_000);

  it('RT-04: an EMPTY shard is retireable — no record_count gate, on purpose', async () => {
    // A shard someone created and never wrote to must stay retireable, or the money that funded it is stranded in
    // an immortal account. That is precisely the failure this change exists to remove, so the absence of a
    // `record_count > 0` gate is deliberate. An attacker's variant that added a residual floor was measured to
    // create permanently unretireable zombie shards for 0.0032 GRAM apiece.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const epoch = epochOf(bc.now);
    const init = await RecordShard.init(12345n, BigInt(epoch));
    const shard = bc.openContract(RecordShard.fromAddress(contractAddress(0, init)));
    const seeder = await bc.treasury('rt04-seeder');
    await seeder.send({ to: shard.address, value: toNano('0.02'), init, body: beginCell().endCell(), bounce: false } as any);
    expect((await bc.getContract(shard.address)).accountState?.type, 'the empty shard exists').toBe('active');

    const w = await warmWallet(bc, 'empty');
    bc.now = (epoch + 2) * 86400 + 31536000 + 86400;
    await w.send(shard.address, toNano('0.05'), retireBody(RS_RETIRE));
    expect((await bc.getContract(shard.address)).accountState?.type, 'and it can still be cleaned up').not.toBe('active');
  }, 300_000);

  it('RT-05: INTRO retires only AFTER the client scan window closes — the zero-second margin is gone', async () => {
    // MEASURED: an IntroShard of epoch E leaves the reader's window at exactly (E+9)*86400
    // (INTRO_SCAN_EPOCHS_BACK = 8, web/intro-receive.mjs), and the bare death instant is the SAME second. A
    // margin of zero. Nothing exercises that today because nobody evicts; making retirement real would arm it,
    // and the failure is silent — a destroyed account answers exit -256, which the reader reads as "empty", marks
    // the bucket drained and commits its cursor. IS_RETIRE_SLACK buys four epochs.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const epoch = epochOf(bc.now);
    const bucket = 21n;
    const payer = await bc.treasury('rt05-payer');
    const b = await buildIntroPublish({
      epoch, bucket, r: 7n, viewTag: 3n, header0: cell(1), body: cell(2), value: IS_DEPLOY_MIN_VALUE,
    });
    await payer.send({ to: b.to, value: IS_DEPLOY_MIN_VALUE, body: b.body, init: b.init, bounce: true } as any);
    const shard = bc.openContract(IntroShard.fromAddress(contractAddress(0, await IntroShard.init(BigInt(epoch), bucket))));

    const retireAt = Number((await shard.getGetView()).retire_at);
    const windowExit = (epoch + 9) * 86400;          // the last second any shipping client still reads this shard
    expect(retireAt, 'retirement must come strictly AFTER the client stops reading the shard')
      .toBeGreaterThan(windowExit);
    expect(retireAt - windowExit, 'and the slack must be the four epochs the contract documents')
      .toBe(4 * 86400);

    // The gate really enforces it: still alive while any client could be reading.
    const w = await warmWallet(bc, 'intro');
    bc.now = windowExit + 1;
    const early = await w.send(shard.address, toNano('0.05'), retireBody(IS_RETIRE));
    const tx = (early.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'inside the slack the shard must survive').toBe(13683);

    bc.now = retireAt + 1;
    const beforeBal = (await bc.getContract(w.wallet.address)).balance;
    await w.send(shard.address, toNano('0.05'), retireBody(IS_RETIRE));
    expect((await bc.getContract(shard.address)).accountState?.type, 'and be retireable after').not.toBe('active');
    expect((await bc.getContract(w.wallet.address)).balance - beforeBal, 'paying its caller').toBeGreaterThan(0n);
  }, 300_000);

  it('RT-06: the FIRST publish must bring the deploy price, and a client can tell which price applies', async () => {
    // The base endowment is charged explicitly now. HEAD left it to the reserve, and ReserveAtMost simply clamps:
    // a first publish paying exactly the old minimum left the shard 201_469 SHORT of its own target, which would
    // make it unable to fund its own retirement and therefore immortal.
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deploySink(bc);
    const epoch = epochOf(bc.now);
    const payer = await bc.treasury('rt06');
    const secret = new Uint8Array(32).fill(0x61);
    const publicKey = ed25519.getPublicKey(secret);
    const mk = (seq: bigint, value: bigint) => buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq, epoch,
      header0: cell(1), header1: cell(2), body: cell(3), value,
    });

    // Steady-state money is NOT enough for a deploying publish, and it is refused in COMPUTE so it refunds.
    const short = await mk(1n, RS_DEPLOY_MIN_VALUE - 1n);
    const r1 = await payer.send({ to: short.to, value: RS_DEPLOY_MIN_VALUE - 1n, body: short.body, init: short.init, bounce: true } as any);
    const t1 = (r1.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(short.to));
    expect(t1?.description?.computePhase?.exitCode, 'an underfunded deploy is refused by gate 13652').toBe(13652);

    const ok = await mk(1n, RS_DEPLOY_MIN_VALUE);
    await payer.send({ to: ok.to, value: RS_DEPLOY_MIN_VALUE, body: ok.body, init: ok.init, bounce: true } as any);
    const shard = bc.openContract(RecordShard.fromAddress(ok.to));
    const view = await shard.getGetView();
    expect(view.record_count, 'the deploying publish is accepted at the deploy price').toBe(1n);

    // And the client can read BOTH figures, so it never has to mirror the arithmetic.
    expect(view.deploy_min_value, 'deploy price is published').toBe(RS_DEPLOY_MIN_VALUE);
    expect(view.min_value, 'and the steady-state price is lower').toBeLessThan(view.deploy_min_value);

    // A second publish at the steady-state price is accepted.
    const second = await mk(2n, view.min_value);
    const r3 = await payer.send({ to: second.to, value: view.min_value, body: second.body, bounce: true } as any);
    const t3 = (r3.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(second.to));
    expect(t3?.description?.computePhase?.exitCode, 'a later publish pays the lower price').toBe(0);
  }, 300_000);
});
