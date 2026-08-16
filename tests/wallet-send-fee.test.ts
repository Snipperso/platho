import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell, internal, SendMode } from '@ton/core';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  randomBytes,
  PLATHO_COMPACT_IDENTITY_BYTES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
} from '../web/crypto/platho-crypto.mjs';
import { splitBytesToCapsuleParts, MAX_CAPSULE_USEFUL_BYTES } from '../web/capsule-part-policy.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import {
  walletSendFeeNanotons,
  WALLET_SEND_FEE_PER_PART_NANOTONS,
  WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS,
} from '../web/wallet-send-fee.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// WALLET-SEND-FEE — the term every price quote in this app was missing.
//
// OWNER-MEASURED on chain, 2026-08-16: the private composer said 0.0191 GRAM for a minimal message and 0.0223 left
// the wallet. 0.0191 is CONV_PUBLISH_VALUE, what the message CARRIES to the shard; the rest is what the network
// charges the WALLET to import the signed external, run it, and forward the outgoing message (sendMode 3 pays those
// separately from the value). Quoting only the carried value understated every send.
//
// This file is the gate that keeps web/wallet-send-fee.mjs honest. It does not restate the model's constants — it
// drives REAL sealed CONV capsules through the REAL builder into a sandbox, reads the fee the network actually
// charged the payer, and asserts the model brackets it: never below (a low quote promises a send the wallet cannot
// fund), never more than 15% above (a wildly high quote is its own kind of lie). Three fee constants in this repo
// have already outlived the architecture they described; when TON's schedule moves, this goes red instead of the
// user reading a stale number.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const toCore = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));

describe('WALLET-SEND-FEE', () => {
  it('WSF-01: the model brackets the fee a REAL send is charged, across every size class and part count', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'wsf-sink' });

    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);

    let seed = 0;
    // Every case gets its OWN write key, so each send DEPLOYS its shard: the measured fee is then the honest upper
    // bound. (Publishing into an existing shard is cheaper AND refunds surplus mode-128 — reading a balance delta
    // there would fold the refund into the fee, which is what the first attempt at this measurement did.)
    const send = async (texts: string[]) => {
      seed += 1;
      const secret = new Uint8Array(32).fill(seed);
      const pub = ed25519.getPublicKey(secret);
      const payer = await bc.treasury(`wsf-payer-${seed}`);
      const built: any[] = [];
      const sizeClasses: number[] = [];
      let seq = 1;
      for (const text of texts) {
        const capsule: any = await createEncryptedConvCapsule(text, bundle, sender, randomBytes(32), { now: CLOCK * 1000 });
        // The class the CAPSULE SEALED INTO, not one this test guessed: the padding is what the fee follows, so the
        // quote has to be priced off the same number the real capsule used. (WSF-05 proves the composer's plan
        // assigns this same class, which is what makes pricing off the plan correct in the app.)
        sizeClasses.push(Number(capsule.header0.sizeClass));
        built.push(await buildConvPublishWalletMessage({
          writePublicKey: pub, writeSecret: secret, seq: seq++, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
        }));
      }
      // ONE transfer carrying every part — the shape publishConvLaneParts signs.
      const res = await payer.sendMessages(built.map((part) => {
        const initCore = toCore(part.init);
        return internal({
          to: Address.parseRaw(part.to),
          value: part.value,
          bounce: true,
          body: toCore(part.body),
          init: { code: initCore.refs[0], data: initCore.refs[1] },
        });
      }), SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS);

      const walletTx: any = res.transactions.find((t: any) => t.inMessage?.info?.type === 'external-in');
      expect(walletTx, 'the payer executed the signed external').toBeTruthy();
      return { measured: BigInt(walletTx.totalFees.coins), sizeClasses };
    };

    const cases: Array<{ label: string; texts: string[] }> = [
      // one part, spanning every size class — 'x'.repeat(N) lands in the class the capsule pads N up to
      { label: 'tiny', texts: ['ок'] },
      { label: '800B', texts: ['x'.repeat(800)] },
      { label: '1.5KB', texts: ['x'.repeat(1500)] },
      { label: '3.5KB', texts: ['x'.repeat(3500)] },
      { label: '7.5KB', texts: ['x'.repeat(7500)] },
      { label: '15KB', texts: ['x'.repeat(15000)] },
      { label: '30KB', texts: ['x'.repeat(30000)] },
      // and the part-count axis, where the per-transfer base must be charged ONCE
      { label: 'two parts', texts: ['ок', 'ок'] },
      { label: 'three parts', texts: ['ок', 'ок', 'ок'] },
      { label: 'four parts', texts: ['ок', 'ок', 'ок', 'ок'] },
      { label: 'mixed sizes', texts: ['ок', 'x'.repeat(3500), 'x'.repeat(15000)] },
    ];

    const seenClasses = new Set<number>();
    for (const { label, texts } of cases) {
      const { measured, sizeClasses } = await send(texts);
      sizeClasses.forEach((value) => seenClasses.add(value));
      const quoted = walletSendFeeNanotons(sizeClasses);
      expect(quoted >= measured, `${label}: quoted ${quoted} UNDER the measured ${measured}`).toBe(true);
      expect(quoted <= (measured * 115n) / 100n, `${label}: quoted ${quoted} is >15% over the measured ${measured}`).toBe(true);
    }

    // A table with an unexercised row is a number nobody checked. Every class in the model must have been sent.
    expect([...seenClasses].sort((a, b) => a - b), 'every size class in the model was measured')
      .toEqual(Object.keys(WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS).map(Number).sort((a, b) => a - b));
  }, 300_000);

  it('WSF-02: a minimal private message quotes what the owner actually paid', () => {
    // The complaint this module answers: 0.0191 shown, 0.0223 debited. The quote is the carried value plus the fee;
    // it must now cover the real debit, and must not sail past it either.
    const OWNER_MEASURED_DEBIT = 22_300_000n;
    const quoted = CONV_PUBLISH_VALUE + walletSendFeeNanotons([1]);
    expect(quoted).toBeGreaterThanOrEqual(OWNER_MEASURED_DEBIT);
    expect(quoted).toBeLessThan((OWNER_MEASURED_DEBIT * 110n) / 100n);
  });

  it('WSF-03: every direct-pay quote funnels through the fee, not just the one that was reported', () => {
    // The defect was reported on the private composer. It lived in the shared estimator, so the public post, the
    // comment, the avatar and the channel-profile dialog were all understating too — fixing only the reported lane
    // is how this class of bug survives (fix-one-lane-check-the-twin).
    const APP = readFileSync('web/app.js', 'utf8');
    // ?v= is DERIVED from module content (bump_module_versions.mjs) and moves on its own, so match the import, not
    // the cache key — pinning the number here would turn every content change into a false red.
    expect(APP).toMatch(/import \{ walletSendFeeNanotons, WALLET_SEND_FEE_PER_PART_NANOTONS \} from '\.\/wallet-send-fee\.mjs\?v=\d+';/);
    const fn = APP.slice(APP.indexOf('function composerEstimatedNetCostNanotons'), APP.indexOf('// Hold -> net fallback'));
    expect(fn).toContain('composerWalletSendFeeNanotons(profile)');
    expect(fn).toContain('composerWalletSendFeeNanotons(Array.from({ length: count }, () => profile))');
    // the two quotes that do NOT go through the funnel carry the term themselves
    expect(APP).toContain('return USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS + walletSendFeeNanotons([]);');
    expect(APP).toContain('+ WALLET_SEND_FEE_PER_PART_NANOTONS;');
    expect(WALLET_SEND_FEE_PER_PART_NANOTONS).toBeGreaterThan(0n);
  });

  it('WSF-05: a part NEVER seals into a bigger class than the composer priced', async () => {
    // The load-bearing link. The app prices off the PLAN's size class; the network charges by the class the capsule
    // actually SEALED into. What must hold is an INEQUALITY, not equality: sealed <= planned.
    //
    // Measured here: an 850-byte part is planned as class 2 and seals into class 1, because the plan reserves the
    // capsule's per-part overhead before choosing a class. That direction is safe — the quote runs one class high on
    // a part sitting near a boundary, and quoting high is the honest error. The direction that must never appear is
    // the reverse, and this repo has already been bitten by exactly it: a part planned as one payload block sealed
    // into two, "so the body grew by 1024 bytes that the cost estimate never counted" (app.js:14986). If that comes
    // back, the quote silently under-states and this goes red.
    const overhead = PLATHO_COMPACT_IDENTITY_BYTES
      + PLATHO_COMPACT_SENDER_RECOVERY_BYTES
      + PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES
      + PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES;   // privateCompactPayloadOverhead, default sender options
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);

    for (const size of [1, 400, 850, 900, 1500, 2000, 3500, 5000, 9000, 15000, 20000, 30000]) {
      const documentBytes = new TextEncoder().encode('x'.repeat(size));
      const plan = splitBytesToCapsuleParts(documentBytes, MAX_CAPSULE_USEFUL_BYTES, { perPartOverheadBytes: overhead });
      for (const part of plan as any[]) {
        const text = new TextDecoder().decode(part.bytes);
        const capsule: any = await createEncryptedConvCapsule(text, bundle, sender, randomBytes(32), { now: CLOCK * 1000 });
        expect(Number(capsule.header0.sizeClass) <= Number(part.sizeClass),
          `${size}B part planned as class ${part.sizeClass} sealed into the BIGGER class ${capsule.header0.sizeClass} — the quote under-states it`)
          .toBe(true);
      }
    }
  }, 300_000);

  it('WSF-04: the fee is priced off the size class the plan already carries, and rounds UP when it is unknown', () => {
    // A bigger capsule is never cheaper to send…
    const classes = Object.keys(WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < classes.length; i += 1) {
      expect(walletSendFeeNanotons([classes[i]])).toBeGreaterThan(walletSendFeeNanotons([classes[i - 1]]));
    }
    // …a class between two real ones is priced at the next one UP, never the one below…
    expect(walletSendFeeNanotons([3])).toBe(walletSendFeeNanotons([4]));
    expect(walletSendFeeNanotons([64])).toBe(walletSendFeeNanotons([32]));
    // …and the per-transfer base is charged once, not per part.
    const base = walletSendFeeNanotons([1]) - WALLET_SEND_FEE_PER_PART_NANOTONS;
    expect(walletSendFeeNanotons([1, 1, 1])).toBe(base + WALLET_SEND_FEE_PER_PART_NANOTONS * 3n);
  });
});
