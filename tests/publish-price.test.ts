import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { FA_BUYBACK, deployFeeSink } from './helpers/fee-sink-fixture';
import { toNano, beginCell, contractAddress, Address } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { buildConvPublish, buildIntroPublish } from '../web/publish-builder.mjs';
import { epochOf } from '../web/shard-discovery.mjs';
import {
  CONV_MIN_VALUE, CONV_PUBLISH_VALUE, INTRO_MIN_VALUE, INTRO_PUBLISH_VALUE, RECOVERY_PUBLISH_VALUE, publishValueFor,
} from '../web/publish-price.mjs';
import { ed25519 } from '@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLISH-PRICE — what a client attaches, and the reason the answer is a constant rather than a lookup.
//
// The publish gates became STATE-DEPENDENT when the eviction bounty was replaced by a per-shard retirement
// endowment: a shard charges more for the publish that creates it. The natural client rule — "pay the deploy
// figure when the account is absent" — is forgeable. Anyone can create a shard with a bare value message through
// its catch-all receive(), leaving an account that EXISTS with zero entries; a client reading absence then
// attaches the steady figure and is refused. On the INTRO lane the bucket space is public, so every address is
// derivable and the grief is cheap and repeatable.
//
// So the client attaches the deploy figure always. This file pins that it is safe, that it is correct, and that
// the hand-held mirrors have not drifted from the contracts.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cell = (f: number) => beginCell().storeBuffer(Buffer.alloc(64, f)).endCell();
const CLOCK = 1_790_000_000;
const FA_TREASURY = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');

async function withSink() {
  const bc = await Blockchain.create();
  bc.now = CLOCK;
  await deployFeeSink(bc, { funderSeed: 'pp-fund' });
  return bc;
}

describe('PUBLISH-PRICE — the client pays the deploy figure, always', () => {
  it('PP-01: the client mirrors match the contracts, on both lanes and both figures', () => {
    // Four hand-held copies of contract constants. Every one of them, wrong, is a publish refused in production.
    const rec = readFileSync('contracts/RecordShard.tact', 'utf8');
    const intro = readFileSync('contracts/IntroShard.tact', 'utf8');
    const recov = readFileSync('contracts/RecoveryShard.tact', 'utf8');
    const constOf = (src: string, name: string, depth = 0): bigint => {
      const m = src.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*([^;]+);`));
      if (!m) throw new Error(`${name} not found`);
      const expr = m[1].trim();
      if (/^\d+$/.test(expr)) return BigInt(expr);
      return expr.split('+').map((t) => t.trim())
        .reduce((s, t) => s + (/^\d+$/.test(t) ? BigInt(t) : constOf(src, t, depth + 1)), 0n);
    };

    expect(constOf(rec, 'RS_MIN_VALUE'), 'CONV steady').toBe(CONV_MIN_VALUE);
    expect(constOf(rec, 'RS_DEPLOY_MIN_VALUE'), 'CONV deploy').toBe(CONV_PUBLISH_VALUE);
    expect(constOf(intro, 'IS_MIN_VALUE'), 'INTRO steady').toBe(INTRO_MIN_VALUE);
    expect(constOf(intro, 'IS_DEPLOY_MIN_VALUE'), 'INTRO deploy').toBe(INTRO_PUBLISH_VALUE);
    // RECOVERY: RS_MIN_VALUE is required on every write (endowment + path gas); one figure, no separate deploy value.
    expect(constOf(recov, 'RS_MIN_VALUE'), 'RECOVERY write value').toBe(RECOVERY_PUBLISH_VALUE);
    expect(publishValueFor('conv')).toBe(CONV_PUBLISH_VALUE);
    expect(publishValueFor('intro')).toBe(INTRO_PUBLISH_VALUE);
    expect(publishValueFor('recovery')).toBe(RECOVERY_PUBLISH_VALUE);
    expect(() => publishValueFor('bogus' as any), 'an unknown lane must throw, not guess').toThrow();
  });

  it('PP-02: the deploy figure works for BOTH the first publish and every later one, and the surplus returns', async () => {
    // The whole justification for a constant rather than a lookup. MEASURED: a later publish attached at the
    // deploy figure gave back 3_137_794 — the reserve keeps only what it needs.
    const bc = await withSink();
    const epoch = epochOf(bc.now!);
    const payer = await bc.treasury('pp-conv');
    const secret = new Uint8Array(32).fill(0x88);
    const publicKey = ed25519.getPublicKey(secret);

    const spends: bigint[] = [];
    let to: any = null;
    for (const seq of [1n, 2n]) {
      const b = await buildConvPublish({
        writePublicKey: publicKey, writeSecret: secret, seq, epoch,
        header0: cell(1), header1: cell(2), body: cell(3), value: CONV_PUBLISH_VALUE,
      });
      to = b.to;
      const before = (await bc.getContract(payer.address)).balance;
      const r = await payer.send({ to: b.to, value: CONV_PUBLISH_VALUE, body: b.body, init: b.init, bounce: true } as any);
      const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(b.to));
      expect(tx?.description?.computePhase?.exitCode, `publish ${seq} must be accepted`).toBe(0);
      spends.push(before - (await bc.getContract(payer.address)).balance);
    }

    expect((await bc.openContract(RecordShard.fromAddress(to)).getGetView()).record_count).toBe(2n);
    // The second publish costs materially less than it attached: the surplus is change, not a fee.
    expect(spends[1], 'a later publish gives most of the extra back').toBeLessThan(CONV_PUBLISH_VALUE);
    // The property is that the deploy premium comes BACK, not that it comes back to the last nanoton: the second
    // publish still burns its own gas. Measured against RS_BASE_ENDOWMENT (3_500_000) rather than a round number
    // sitting next to it — the old 3_000_000 threshold was 4,406 above the real figure and went red the moment
    // RS_FEE_TRANSPORT grew, which said "the surplus stopped coming back" when 85% of it still did.
    const change = CONV_PUBLISH_VALUE - spends[1];
    // eslint-disable-next-line no-console
    console.log(`[PP-02] deploy premium returned: ${change} of RS_BASE_ENDOWMENT 3_500_000 (${Number(change) / 3_500_000 * 100}%)`);
    expect(change, 'most of the deploy premium must come back as change, not be kept as a fee')
      .toBeGreaterThan((3_500_000n * 3n) / 4n);
  }, 300_000);

  it('PP-03: the steady figure is REFUSED on a fresh shard — which is why the rule cannot be "pay the minimum"', async () => {
    const bc = await withSink();
    const epoch = epochOf(bc.now!);
    const payer = await bc.treasury('pp-refuse');
    const secret = new Uint8Array(32).fill(0x99);
    const publicKey = ed25519.getPublicKey(secret);
    const b = await buildConvPublish({
      writePublicKey: publicKey, writeSecret: secret, seq: 1n, epoch,
      header0: cell(1), header1: cell(2), body: cell(3), value: CONV_MIN_VALUE,
    });
    const r = await payer.send({ to: b.to, value: CONV_MIN_VALUE, body: b.body, init: b.init, bounce: true } as any);
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(b.to));
    expect(tx?.description?.computePhase?.exitCode, 'gate 13652 refuses the steady figure on a fresh shard').toBe(13652);
  }, 300_000);

  it('PP-04: account-absence is FORGEABLE, so a rule that reads it is a denial of service', async () => {
    // The grief, demonstrated rather than asserted. A stranger creates the shard with a bare value message —
    // it now EXISTS but holds nothing — and a client that decided its funding from "is the account there?"
    // attaches the steady figure and is refused. On INTRO the bucket space is public, so every address is
    // derivable by anyone and this can be repeated across the whole space for a few thousandths of a GRAM each.
    const bc = await withSink();
    const epoch = epochOf(bc.now!);
    const bucket = 5n;
    const init = await IntroShard.init(BigInt(epoch), bucket);
    const addr = contractAddress(0, init);

    const mallory = await bc.treasury('pp-mallory');
    await mallory.send({ to: addr, value: toNano('0.01'), init, body: beginCell().endCell(), bounce: false } as any);
    const shard = bc.openContract(IntroShard.fromAddress(addr));
    expect((await bc.getContract(addr)).accountState?.type, 'the shard now EXISTS').toBe('active');
    expect((await shard.getGetView()).next_id, 'while holding nothing at all').toBe(0n);

    // Alice, deciding from presence, would attach the steady figure — and be refused.
    const alice = await bc.treasury('pp-alice');
    const steady = await buildIntroPublish({
      epoch, bucket, r: 1n, viewTag: 2n, header0: cell(1), body: cell(2), value: INTRO_MIN_VALUE,
    });
    const r1 = await alice.send({ to: steady.to, value: INTRO_MIN_VALUE, body: steady.body, bounce: true } as any);
    const t1 = (r1.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(addr));
    expect(t1?.description?.computePhase?.exitCode, 'presence-based funding is refused by gate 13682').toBe(13682);

    // Attaching the deploy figure — the actual rule — goes through regardless of what Mallory did.
    const ok = await buildIntroPublish({
      epoch, bucket, r: 3n, viewTag: 4n, header0: cell(3), body: cell(4), value: INTRO_PUBLISH_VALUE,
    });
    const r2 = await alice.send({ to: ok.to, value: INTRO_PUBLISH_VALUE, body: ok.body, bounce: true } as any);
    const t2 = (r2.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(addr));
    expect(t2?.description?.computePhase?.exitCode, 'the constant rule is immune to the grief').toBe(0);
    expect((await shard.getGetView()).next_id, 'and the intro is stored').toBe(1n);
  }, 300_000);
});
