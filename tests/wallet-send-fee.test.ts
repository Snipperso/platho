import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';
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
import {
  splitBytesToCapsuleParts, MAX_CAPSULE_USEFUL_BYTES, CAPSULE_USEFUL_SIZE_BYTES, capsuleSizeClassForUsefulBytes,
} from '../web/capsule-part-policy.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { CONV_PUBLISH_VALUE, KEYSHARD_REGISTER_VALUE } from '../web/publish-price.mjs';
import { prepareKeyShardRegister } from '../web/key-shard-register-send.mjs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import {
  walletSendFeeNanotons,
  walletSendExternalCount,
  WALLET_SEND_FEE_PER_PART_NANOTONS,
  WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS,
  WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS,
  WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS,
} from '../web/wallet-send-fee.mjs';
import { chunkWalletMessages, createPlathoWallet, buildPlathoWalletExternalBoc } from '../web/platho-wallet.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';
import { testMnemonic } from './helpers/test-mnemonic';

const TEST_WALLET_MNEMONIC = await testMnemonic('wallet-a');


const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const toCore = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const REGISTRY = '0:' + '44'.repeat(32);

describe('WALLET-SEND-FEE', () => {
  it('WSF-01: a wallet funded at the quote lands every part, and one funded just under it does not', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    let seed = 200;

    const attempt = async (texts: string[], balance: bigint) => {
      seed += 1;
      const secret = new Uint8Array(32).fill((seed % 251) || 7);
      const pub = ed25519.getPublicKey(secret);
      const payer = await bc.treasury(`wsf01-${seed}`, { balance });
      const built: any[] = [];
      const sizeClasses: number[] = [];
      let seq = 1;
      for (const text of texts) {
        const capsule: any = await createEncryptedConvCapsule(text, bundle, sender, randomBytes(32), { now: CLOCK * 1000 });
        sizeClasses.push(Number(capsule.header0.sizeClass));
        built.push(await buildConvPublishWalletMessage({
          writePublicKey: pub, writeSecret: secret, seq: seq++, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
        }));
      }
      const shard = Address.parseRaw(built[0].to);
      const messages = built.map((part) => {
        const initCore = toCore(part.init);
        return {
          message: internal({
            to: Address.parseRaw(part.to), value: part.value, bounce: true,
            body: toCore(part.body), init: { code: initCore.refs[0], data: initCore.refs[1] },
          }),
          payload: Buffer.from(serializeBoc(part.body)).toString('base64'),
        };
      });
      const chunks = chunkWalletMessages(messages);
      let landed = 0;
      for (const chunk of chunks) {
        try {
          const res = await payer.sendMessages(
            chunk.map((entry: any) => entry.message), SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
          );
          for (const tx of res.transactions) {
            const info: any = tx.inMessage?.info;
            if (info?.type !== 'internal' || String(info.dest) !== String(shard)) continue;
            const cp: any = (tx.description as any)?.computePhase;
            if (cp?.type === 'vm' && cp.success
              && Number((tx.description as any)?.actionPhase?.totalActions ?? 0) > 0) landed += 1;
          }
        } catch { }
      }
      return { landed, sizeClasses, externals: chunks.length };
    };

    const cases: Array<{ label: string; texts: string[] }> = [
      { label: 'tiny', texts: ['ok'] },
      { label: '800B', texts: ['x'.repeat(800)] },
      { label: '1.5KB', texts: ['x'.repeat(1500)] },
      { label: '3.5KB', texts: ['x'.repeat(3500)] },
      { label: '7.5KB', texts: ['x'.repeat(7500)] },
      { label: '15KB', texts: ['x'.repeat(15000)] },
      { label: '30KB', texts: ['x'.repeat(30000)] },
      { label: 'three parts', texts: ['ok', 'ok', 'ok'] },
      { label: 'mixed sizes', texts: ['ok', 'x'.repeat(3500), 'x'.repeat(15000)] },
      { label: 'two 30KB parts', texts: ['x'.repeat(30000), 'x'.repeat(30000)] },
      { label: 'four 30KB parts', texts: Array.from({ length: 4 }, () => 'x'.repeat(30000)) },
    ];

    const seenClasses = new Set<number>();
    let multiExternalCases = 0;
    for (const { label, texts } of cases) {
      const probe = await attempt(texts, 10_000_000_000n);
      probe.sizeClasses.forEach((value) => seenClasses.add(value));
      if (probe.externals > 1) multiExternalCases += 1;
      expect(walletSendExternalCount(probe.sizeClasses), `${label}: the model split into a different number of externals`)
        .toBe(probe.externals);
      expect(probe.landed, `${label}: an amply funded send must land every part`).toBe(texts.length);

      const required = CONV_PUBLISH_VALUE * BigInt(texts.length) + walletSendFeeNanotons(probe.sizeClasses);
      const atQuote = await attempt(texts, required);
      expect(atQuote.landed, `${label}: funded at the app own figure ${required}, only ${atQuote.landed} of ${texts.length} parts landed`)
        .toBe(texts.length);

      const under = (required * 90n) / 100n;
      const atUnder = await attempt(texts, under);
      expect(atUnder.landed < texts.length, `${label}: 90% of the quote (${under}) still landed everything — the quote is inflated`)
        .toBe(true);
    }

    expect([...seenClasses].sort((a, b) => a - b), 'every size class in the model was measured')
      .toEqual(Object.keys(WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS).map(Number).sort((a, b) => a - b));
    expect(multiExternalCases, 'no case above spanned more than one external').toBeGreaterThanOrEqual(2);
  }, 900_000);

  it('WSF-02: a minimal private message quotes the measured debit', () => {
    const MEASURED_DEBIT = 22_300_000n;
    const quoted = CONV_PUBLISH_VALUE + walletSendFeeNanotons([1]);
    expect(quoted).toBeGreaterThanOrEqual(MEASURED_DEBIT);
    expect(quoted).toBeLessThan((MEASURED_DEBIT * 110n) / 100n);
  });

  it('WSF-03: every direct-pay quote funnels through the fee, and the fee actually reaches the total', () => {
    const APP = readFileSync('web/app.js', 'utf8');
    expect(APP).toMatch(/import \{[^}]*walletSendFeeNanotons[^}]*\} from '\.\/wallet-send-fee\.mjs\?v=\d+';/);

    expect(APP.indexOf('function composerEstimatedNetCostNanotons('), 'the shared estimator must still be there').toBeGreaterThan(-1);
    const source = sourceBlock(APP, 'function composerEstimatedNetCostNanotons(');

    // eslint-disable-next-line no-new-func
    const estimate = new Function('MARKER', `
      const composerProfileNetPriceNanotons = () => 1000n;
      const composerProfileSquatCushionNanotons = () => 3n;      // the squat cushion per part, as the pre-flight demands [round 6]
      const composerWalletSendFeeReserveNanotons = () => MARKER;   // the measured reserve floor, as the pre-flight demands [round 6]
      // the direct door (generation 17): every part at its own figure — the generation-18 whole-message quote is R10-C3's
      const generationForUnixSeconds = () => 17;
      const chainNowSec = () => Math.floor(Date.now() / 1000);
      const composerProfileKindLabel = () => 'private';
      const composerConvMessageQuoteNanotons = () => { throw new Error('generation 17 prices no vault message'); };
      const currentNetworkFeeSurchargeNanotons = () => 0n;
      ${source}
      return composerEstimatedNetCostNanotons;
    `)(7n);

    expect(estimate([{}, {}]), 'the batch quote must carry the send fee and a cushion per part').toBe((1000n + 3n) * 2n + 7n);
    expect(estimate({}, 3), 'and so must the per-part quote').toBe((1000n + 3n) * 3n + 7n);
    expect(estimate({}, 1)).not.toBe(1000n);

    for (const caller of ['composerEstimatedNetCostNanotons(']) {
      expect(APP.split(caller).length - 1, 'the estimator must have callers').toBeGreaterThan(1);
    }
  });

  it('WSF-07: the model splits a part list into externals exactly as the wallet does', async () => {
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
      const messages = list.map((sizeClass) => ({
        payload: 'A'.repeat(Math.ceil((WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass] * 4) / 3)),
      }));
      expect(walletSendExternalCount(list), `[${list.join(',')}] packs differently than chunkWalletMessages`)
        .toBe(chunkWalletMessages(messages).length);
    }
  });

  it('WSF-05: a part NEVER seals into a bigger class than the composer priced', async () => {
    const overhead = PLATHO_COMPACT_IDENTITY_BYTES
      + PLATHO_COMPACT_SENDER_RECOVERY_BYTES
      + PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES
      + PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES;
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
    const APP = readFileSync('web/app.js', 'utf8');
    const FLOOR = 10_000_000n;

    const bareUses = APP.split('\n').filter((line) => /\+ WALLET_FEE_HEADROOM_NANOTONS/.test(line));
    expect(bareUses, `these still reserve a flat fee:\n${bareUses.join('\n')}`).toEqual([]);

    const source = APP.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
    const definitionOf = (name) => source.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`))?.[1] ?? name;
    const preflights = [...source.matchAll(/await assertWalletGramAtLeast\(([\s\S]*?),\s*'[^']*'\)/g)]
      .map((m) => (/^\s*(\w+)\s*$/.test(m[1]) ? definitionOf(m[1].trim()) : m[1]));
    expect(preflights.length, 'the pre-flight sites should all be found').toBeGreaterThanOrEqual(9);
    const flat = preflights.filter((argument) => !argument.includes('walletSendFeeReserveNanotons('));
    expect(flat, `these pre-flights do not reserve the send fee:\n${flat.join('\n---\n')}`).toEqual([]);

    expect(walletSendFeeNanotons([32])).toBeGreaterThan(FLOOR);
    expect(walletSendFeeNanotons([32, 32, 32])).toBeGreaterThan(walletSendFeeNanotons([32]));
    const reserveForSmallest = walletSendFeeNanotons([1]) > FLOOR ? walletSendFeeNanotons([1]) : FLOOR;
    expect(reserveForSmallest).toBeGreaterThanOrEqual(FLOOR);
  });

  it('PWA-INTRO-FEE-01: the INTRO handshake seals no bigger than the class the first-contact quote assumes', async () => {
    const APP = readFileSync('web/app.js', 'utf8');
    const declared = Number(APP.match(/const INTRO_CAPSULE_SIZE_CLASS = (\d+);/)?.[1]);
    expect(declared).toBeGreaterThan(0);
    expect(APP).toContain('INTRO_PUBLISH_VALUE + introDirectLiveExtraNanotons() + squatCushionNanotons(LANE_INTRO) + walletSendFeeReserveNanotons([INTRO_CAPSULE_SIZE_CLASS])');

    const recipient: any = await createMessagingIdentity();
    const sender: any = await createMessagingIdentity();
    const capsule: any = await createEncryptedIntroCapsule(
      exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { now: CLOCK * 1000 },
    );
    expect(Number(capsule.header0.sizeClass), 'the INTRO capsule outgrew the quoted class').toBeLessThanOrEqual(declared);
  }, 120_000);

  it('PWA-ACTIVATION-FEE-01: a wallet funded at the activation quote actually gets registered', async () => {
    const APP = readFileSync('web/app.js', 'utf8');
    const declared = Number(APP.match(/const KEYSHARD_REGISTER_SIZE_CLASS = (\d+);/)?.[1]);
    expect(APP, 'the activation quote must carry the reserve the pre-flight demands')
      .toContain('return KEYSHARD_REGISTER_VALUE + arrear + walletSendFeeReserveNanotons([KEYSHARD_REGISTER_SIZE_CLASS]);');
    expect(APP, 'the pre-flight must demand the same term over the figure the send carries')
      .toContain("registerValue + walletSendFeeReserveNanotons([KEYSHARD_REGISTER_SIZE_CLASS]), 'activate')");
    expect(APP).toContain("error?.code === 'PLATHO_WALLET_GRAM_REQUIRED'\n        ? error.message\n        : t('quickstart.couldNotCompleteLater')");

    const bc = await Blockchain.create();
    let seed = 300;

    const attempt = async (balance: bigint) => {
      seed += 1;
      const payer = await bc.treasury(`wsf-activation-${seed}`, { balance });
      const owner = payer.address.toRawString();
      const identity: any = await createMessagingIdentity();
      const authSecret = randomBytes(32);
      const signed = await exportSignedPublicKeyBundle(identity, { ownerWallet: owner, vaultAddress: REGISTRY, issuedAt: 1_700_000_000_000 });
      const verified = await verifySignedPublicKeyBundle(signed, { now: 1_700_000_001_000 });
      const draft = await createVaultMessagingKeyDraft(verified.bundle, verified.signingPublicKey, {
        authPublicKey: ed25519.getPublicKey(authSecret),
      });
      const { built }: any = await prepareKeyShardRegister({
        ownerWallet: owner, profileRegistry: REGISTRY, keyRecord: draft.message, value: KEYSHARD_REGISTER_VALUE,
        signSecretKey: identity.signingSecretKey, authSecretKey: authSecret,
      });
      const target = Address.parseRaw(built.to);
      const initCore = toCore(built.init);
      let landed = false;
      try {
        const res = await payer.sendMessages([internal({
          to: target, value: built.value, bounce: true, body: toCore(built.body),
          init: { code: initCore.refs[0], data: initCore.refs[1] },
        })], SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS);
        for (const tx of res.transactions) {
          const info: any = tx.inMessage?.info;
          if (info?.type !== 'internal' || String(info.dest) !== String(target)) continue;
          const cp: any = (tx.description as any)?.computePhase;
          if (cp?.type === 'vm' && cp.success) landed = true;
        }
      } catch { }
      return landed;
    };

    const required = KEYSHARD_REGISTER_VALUE + walletSendFeeNanotons([declared]);
    expect(await attempt(required), `funded at the class figure ${required}, the register did not land`).toBe(true);
    const under = (required * 90n) / 100n;
    expect(await attempt(under), `90% of the quote (${under}) still registered — the activation quote is inflated`).toBe(false);
  }, 300_000);

  it('WSF-09: a wallet\'s FIRST external carries the wallet — the real v5r1, undeployed, funded at the quote', async () => {
    const APP = readFileSync('web/app.js', 'utf8');
    expect(APP, 'the reserve adds the term until the wallet is seen activated')
      .toContain('const measured = walletSendFeeNanotons(sizeClasses) + (hasActivePlathoAccount() ? 0n : WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS);');

    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'wsf09-sink' });
    const wallet: any = await createPlathoWallet({ mnemonic: TEST_WALLET_MNEMONIC });
    const address = Address.parse(wallet.address);
    const funder = await bc.treasury('wsf09-funder');
    await funder.send({ to: address, value: 1_000_000n, bounce: false } as any);
    expect((await bc.getContract(address)).accountState?.type, 'the wallet has no code yet').toBe('uninit');

    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const capsule: any = await createEncryptedConvCapsule('x'.repeat(7500), exportPublicKeyBundle(recipient.encryptionKeyPair), sender, randomBytes(32), { now: CLOCK * 1000 });
    expect(Number(capsule.header0.sizeClass)).toBe(8);
    const secret = new Uint8Array(32).fill(0x5e);
    const part: any = await buildConvPublishWalletMessage({
      writePublicKey: ed25519.getPublicKey(secret), writeSecret: secret, seq: 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
    });
    const shard = Address.parseRaw(part.to);
    const boc = (await buildPlathoWalletExternalBoc(wallet, [part.message], { seqno: 0, timeout: CLOCK + 300 })).boc;

    const attempt = async (balance: bigint) => {
      const snapshot = bc.snapshot();
      try {
        (await bc.getContract(address)).balance = balance;
        try { await bc.sendMessage(Cell.fromBase64(boc)); } catch { return false; }
        return (await bc.getContract(shard)).accountState?.type === 'active';
      } finally {
        await bc.loadFrom(snapshot);
      }
    };
    const table = BigInt(part.value) + walletSendFeeNanotons([8]);
    expect(await attempt(table + WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS), 'funded at the quote with the first-external term, the part stored').toBe(true);
    expect(await attempt(table), 'funded at the table alone, the first external lands the wallet and drops the part — the term is needed').toBe(false);
  }, 300_000);

  it('WSF-04: the fee is priced off the size class the plan already carries, and rounds UP when it is unknown', () => {
    const classes = Object.keys(WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < classes.length; i += 1) {
      expect(walletSendFeeNanotons([classes[i]])).toBeGreaterThan(walletSendFeeNanotons([classes[i - 1]]));
    }
    expect(walletSendFeeNanotons([3])).toBe(walletSendFeeNanotons([4]));
    expect(walletSendFeeNanotons([64])).toBe(walletSendFeeNanotons([32]));
    const base = walletSendFeeNanotons([1]) - WALLET_SEND_FEE_PER_PART_NANOTONS;
    expect(walletSendFeeNanotons([1, 1, 1])).toBe(base + WALLET_SEND_FEE_PER_PART_NANOTONS * 3n);
  });
  it('WSF-08: every payload-byte entry is what the REAL builder produces — the non-circular anchor', async () => {
    const bucketKey = randomBytes(32);
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    for (const usefulBytes of CAPSULE_USEFUL_SIZE_BYTES) {
      const sizeClass = capsuleSizeClassForUsefulBytes(usefulBytes);
      for (const length of [usefulBytes - 700, usefulBytes - 200]) {
        const capsule = await createEncryptedConvCapsule('x'.repeat(length), recipientBundle, sender, bucketKey, {
          now: 1_790_000_000_000,
        });
        const built: any = await buildConvPublishWalletMessage({
          writePublicKey: randomBytes(32), writeSecret: randomBytes(32),
          seq: 1, epoch: 20_700, capsule, value: '19100000',
        });
        const measured = Math.ceil((built.message.payload.length * 3) / 4);
        expect(measured, `class ${sizeClass} at ${length} useful bytes serializes differently than the table says`)
          .toBe(WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass]);
      }
    }
  });
});
