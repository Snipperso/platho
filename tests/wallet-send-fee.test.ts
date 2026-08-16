import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell, internal, SendMode } from '@ton/core';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  createEncryptedIntroCapsule,
  exportSignedPublicKeyBundle,
  verifySignedPublicKeyBundle,
  createVaultMessagingKeyDraft,
  randomBytes,
  PLATHO_COMPACT_IDENTITY_BYTES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
} from '../web/crypto/platho-crypto.mjs';
import { splitBytesToCapsuleParts, MAX_CAPSULE_USEFUL_BYTES } from '../web/capsule-part-policy.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { CONV_PUBLISH_VALUE, KEYSHARD_REGISTER_VALUE } from '../web/publish-price.mjs';
import { buildKeyShardRegisterBrowser } from '../web/key-shard-register-browser.mjs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import {
  walletSendFeeNanotons,
  walletSendExternalCount,
  WALLET_SEND_FEE_PER_PART_NANOTONS,
  WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS,
  WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS,
} from '../web/wallet-send-fee.mjs';
import { chunkWalletMessages } from '../web/platho-wallet.mjs';
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
const REGISTRY = '0:' + '44'.repeat(32);

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
      // Sent the way the wallet really sends it: chunkWalletMessages splits the part list into SEPARATE externals
      // (58,000-byte budget), each signed and imported on its own. Measuring one payer.sendMessages() call instead
      // would hide every base fee past the first — which is exactly the defect this shape caught: two 32 KiB parts
      // are two externals, and the one-base model quoted 532,380 BELOW the real cost.
      const messages = built.map((part) => {
        const initCore = toCore(part.init);
        return {
          message: internal({
            to: Address.parseRaw(part.to),
            value: part.value,
            bounce: true,
            body: toCore(part.body),
            init: { code: initCore.refs[0], data: initCore.refs[1] },
          }),
          payload: Buffer.from(serializeBoc(part.body)).toString('base64'),
        };
      });
      const chunks = chunkWalletMessages(messages);
      let measured = 0n;
      for (const chunk of chunks) {
        const res = await payer.sendMessages(
          chunk.map((entry: any) => entry.message), SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        );
        const walletTx: any = res.transactions.find((t: any) => t.inMessage?.info?.type === 'external-in');
        expect(walletTx, 'the payer executed the signed external').toBeTruthy();
        measured += BigInt(walletTx.totalFees.coins);
      }
      return { measured, sizeClasses, externals: chunks.length };
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
      // and the part-count axis, where the base is charged once per EXTERNAL
      { label: 'two parts', texts: ['ок', 'ок'] },
      { label: 'three parts', texts: ['ок', 'ок', 'ок'] },
      { label: 'four parts', texts: ['ок', 'ок', 'ок', 'ок'] },
      { label: 'mixed sizes', texts: ['ок', 'x'.repeat(3500), 'x'.repeat(15000)] },
      // …and the cases that span MORE THAN ONE external, where a once-per-send base quotes below the truth
      { label: 'two 30KB parts', texts: ['x'.repeat(30000), 'x'.repeat(30000)] },
      { label: 'four 30KB parts', texts: Array.from({ length: 4 }, () => 'x'.repeat(30000)) },
      { label: 'eight 15KB parts', texts: Array.from({ length: 8 }, () => 'x'.repeat(15000)) },
    ];

    const seenClasses = new Set<number>();
    let multiExternalCases = 0;
    for (const { label, texts } of cases) {
      const { measured, sizeClasses, externals } = await send(texts);
      sizeClasses.forEach((value) => seenClasses.add(value));
      if (externals > 1) multiExternalCases += 1;
      expect(walletSendExternalCount(sizeClasses), `${label}: the model split into a different number of externals`)
        .toBe(externals);
      const quoted = walletSendFeeNanotons(sizeClasses);
      expect(quoted >= measured, `${label}: quoted ${quoted} UNDER the measured ${measured}`).toBe(true);
      expect(quoted <= (measured * 115n) / 100n, `${label}: quoted ${quoted} is >15% over the measured ${measured}`).toBe(true);
    }

    // A table with an unexercised row is a number nobody checked. Every class in the model must have been sent.
    expect([...seenClasses].sort((a, b) => a - b), 'every size class in the model was measured')
      .toEqual(Object.keys(WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS).map(Number).sort((a, b) => a - b));
    // …and the multi-external shape must actually have been exercised, or the per-external base is unproven.
    expect(multiExternalCases, 'no case above spanned more than one external').toBeGreaterThanOrEqual(3);
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

  it('WSF-07: the model splits a part list into externals exactly as the wallet does', async () => {
    // walletSendExternalCount MIRRORS chunkWalletMessages rather than calling it (calling it would mean synthesizing
    // a full base64 payload per part on every keystroke). A mirror can drift; this is what stops it silently.
    const classes = Object.keys(WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS).map(Number);
    const lists: number[][] = [
      ...classes.map((c) => [c]),
      ...classes.map((c) => [c, c]),
      ...classes.map((c) => Array.from({ length: 4 }, () => c)),
      ...classes.map((c) => Array.from({ length: 8 }, () => c)),
      [1, 32], [32, 1], [16, 16, 1], [32, 32, 1, 1], [8, 8, 8, 8, 8, 8, 8, 8],
      Array.from({ length: 255 }, () => 1), Array.from({ length: 260 }, () => 1),
    ];
    for (const list of lists) {
      // A message whose base64 payload is the length the real part of that class serializes to — the only field
      // the wallet's packer measures (estimateWalletMessageExternalBytes).
      const messages = list.map((sizeClass) => ({
        payload: 'A'.repeat(Math.ceil((WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass] * 4) / 3)),
      }));
      expect(walletSendExternalCount(list), `[${list.join(',')}] packs differently than chunkWalletMessages`)
        .toBe(chunkWalletMessages(messages).length);
    }
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

  it('WSF-06: the pre-flight reserve scales with the message, and never dips below the old flat floor', () => {
    // The affordability check reserved a FLAT 10,000,000 for send fees. Sending one 32 KiB part costs 28,167,641
    // (WSF-01 measures it), so a large post could clear the check and still be short when the wallet signs — and the
    // wallet stamps SendIgnoreErrors on every action, so the tail of a multipart message would be dropped SILENTLY
    // while the UI reported success. Every pre-flight now reserves the measured figure, floored at the old constant.
    const APP = readFileSync('web/app.js', 'utf8');
    const FLOOR = 10_000_000n;

    // No pre-flight adds the bare constant any more — the only mentions left are its definition and the floor test.
    const bareUses = APP.split('\n').filter((line) => /\+ WALLET_FEE_HEADROOM_NANOTONS/.test(line));
    expect(bareUses, `these still reserve a flat fee:\n${bareUses.join('\n')}`).toEqual([]);

    // COMPLETENESS, not a count. A hand-written "at least N call sites" passes while a NEW send path quietly ships
    // with no send-fee reserve at all — which is how the INTRO transfer and the channel-profile save came to have no
    // pre-flight whatsoever (found in review 2026-08-16, after the count-based version of this test was green).
    // Every required-amount expression must carry the term.
    const source = APP.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    // `await` so the helper's own DEFINITION is not mistaken for a call site.
    const preflights = [...source.matchAll(/await assertWalletGramAtLeast\(([\s\S]*?),\s*'[^']*'\)/g)].map((m) => m[1]);
    expect(preflights.length, 'the pre-flight sites should all be found').toBeGreaterThanOrEqual(9);
    const flat = preflights.filter((argument) => !argument.includes('walletSendFeeReserveNanotons('));
    expect(flat, `these pre-flights do not reserve the send fee:\n${flat.join('\n---\n')}`).toEqual([]);
    // The airdrop claim checks the balance by hand instead of through the helper — it needs the term too.
    expect(source).toMatch(/const required = value \+ walletSendFeeReserveNanotons\(\);/);

    // The reserve is the thing the old constant was not: bigger for a bigger message.
    expect(walletSendFeeNanotons([32])).toBeGreaterThan(FLOOR);
    expect(walletSendFeeNanotons([32, 32, 32])).toBeGreaterThan(walletSendFeeNanotons([32]));
    // …and never smaller than what the code reserved before, even for the smallest possible send.
    const reserveForSmallest = walletSendFeeNanotons([1]) > FLOOR ? walletSendFeeNanotons([1]) : FLOOR;
    expect(reserveForSmallest).toBeGreaterThanOrEqual(FLOOR);
  });

  it('PWA-INTRO-FEE-01: the INTRO handshake seals no bigger than the class the first-contact quote assumes', async () => {
    // A first contact is TWO signed transfers; the INTRO's own send fee is quoted from a CONSTANT because the
    // capsule does not exist when the composer draws the line. The constant is only safe while the handshake stays
    // inside that class — if it grows, this goes red instead of the quote going low.
    const APP = readFileSync('web/app.js', 'utf8');
    const declared = Number(APP.match(/const INTRO_CAPSULE_SIZE_CLASS = (\d+);/)?.[1]);
    expect(declared).toBeGreaterThan(0);
    expect(APP).toContain('INTRO_PUBLISH_VALUE + walletSendFeeNanotons([INTRO_CAPSULE_SIZE_CLASS])');

    const recipient: any = await createMessagingIdentity();
    const sender: any = await createMessagingIdentity();
    const capsule: any = await createEncryptedIntroCapsule(
      exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { now: CLOCK * 1000 },
    );
    expect(Number(capsule.header0.sizeClass), 'the INTRO capsule outgrew the quoted class').toBeLessThanOrEqual(declared);
  }, 120_000);

  it('PWA-ACTIVATION-FEE-01: activation quotes what sending the register really costs', async () => {
    // Activation is the one send a brand-new wallet makes: a wallet funded to exactly the quoted figure is the
    // NORMAL case here, so the quote understating the send fee is felt immediately.
    const APP = readFileSync('web/app.js', 'utf8');
    const declared = Number(APP.match(/const KEYSHARD_REGISTER_SIZE_CLASS = (\d+);/)?.[1]);
    expect(APP).toContain('KEYSHARD_REGISTER_VALUE + walletSendFeeNanotons([KEYSHARD_REGISTER_SIZE_CLASS])');

    const bc = await Blockchain.create();
    const payer = await bc.treasury('wsf-activation');
    const owner = payer.address.toRawString();
    const identity: any = await createMessagingIdentity();
    const signed = await exportSignedPublicKeyBundle(identity, { ownerWallet: owner, vaultAddress: REGISTRY, issuedAt: 1_700_000_000_000 });
    const verified = await verifySignedPublicKeyBundle(signed, { now: 1_700_000_001_000 });
    const draft = await createVaultMessagingKeyDraft(verified.bundle, verified.signingPublicKey, {
      authPublicKey: ed25519.getPublicKey(randomBytes(32)),
    });
    const built: any = await buildKeyShardRegisterBrowser({
      ownerWallet: owner, profileRegistry: REGISTRY, keyRecord: draft.message, value: KEYSHARD_REGISTER_VALUE,
    });
    const initCore = toCore(built.init);
    const res = await payer.sendMessages([internal({
      to: Address.parseRaw(built.to), value: built.value, bounce: true, body: toCore(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] },
    })], SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS);
    const walletTx: any = res.transactions.find((t: any) => t.inMessage?.info?.type === 'external-in');
    const measured = BigInt(walletTx.totalFees.coins);

    const quoted = walletSendFeeNanotons([declared]);
    expect(quoted >= measured, `activation quotes ${quoted} for a send that costs ${measured}`).toBe(true);
    expect(quoted <= (measured * 115n) / 100n).toBe(true);
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
