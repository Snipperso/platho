import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  randomBytes,
} from '../web/crypto/platho-crypto.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { computeCellHashAndDepth, parseBocBase64, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-LANE-SEND — the SEND glue that carries a REAL sealed CONV capsule to the wallet transfer. buildConvPublishBrowser
// is already pinned byte-exact against the contract (conv-publish-browser.test.ts); this module adds the capsule→cells
// decode and the wallet-message shaping, and BOTH are silent if wrong (a mangled body stores a commitment the reader
// rejects — money spent, nothing arrives). So these tests drive an ACTUAL createEncryptedConvCapsule through the module
// and prove: the message is shaped unchanged, a live RecordShard accepts it, and a multipart plan lands N records in
// the one shard with strictly-increasing seq. No stub — the capsule is the real thing the client sends.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const WRITE_SECRET = new Uint8Array(32).fill(0x5a);
const WRITE_PUB = ed25519.getPublicKey(WRITE_SECRET);
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));

async function sealConvCapsule(text: string, bucketKey: Uint8Array) {
  const sender: any = await createMessagingIdentity();
  const recipient: any = await createMessagingIdentity();
  const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
  return createEncryptedConvCapsule(text, recipientBundle, sender, bucketKey, { now: CLOCK * 1000 });
}

describe('CONV-LANE-SEND', () => {
  it('CLS-MSG: the wallet message carries the built CONV publish unchanged (real sealed capsule)', async () => {
    const capsule = await sealConvCapsule('привет CONV lane', randomBytes(32));
    const prepared = await buildConvPublishWalletMessage({
      writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
    });

    expect(prepared.message.address, 'destination is the built shard address').toBe(prepared.to);
    expect(prepared.message.amount, 'value is the CONV deploy figure').toBe(CONV_PUBLISH_VALUE);
    expect(prepared.message.stateInit, 'StateInit attached for lazy deploy').toBe(prepared.init);
    expect(prepared.message.bounce, 'bounceable so a refused publish returns funds').toBe(true);

    // the payload base64 must reproduce the exact signed body cell the builder produced
    const payloadCell = parseBocBase64(prepared.message.payload);
    expect(await hashOf(payloadCell), 'payload BoC == the built message body').toEqual(await hashOf(prepared.body));
  }, 120_000);

  it('CLS-SHARD: a module-built CONV publish is ACCEPTED by the real RecordShard and stores the record', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'cls-shard-sink' });
    const payer = await bc.treasury('cls-shard-payer');

    const capsule = await sealConvCapsule('secret body over the wire', randomBytes(32));
    const built = await buildConvPublishWalletMessage({
      writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
    });

    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    const res = await payer.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the shard accepted the signed publish').toBe(0);

    const shard = bc.openContract(RecordShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.record_count, 'one record stored').toBe(1n);
    expect(view.last_seq, 'last_seq advanced to the published seq').toBe(1n);
  }, 240_000);

  it('CLS-MULTI: a 3-part message lands 3 records in the SAME shard with strictly-increasing seq', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'cls-multi-sink' });
    const payer = await bc.treasury('cls-multi-payer');

    // Every part shares the conversation-direction write key + epoch (so the same shard), with base+i seq.
    const bucketKey = randomBytes(32);
    const parts = [];
    for (let i = 0; i < 3; i += 1) {
      const capsule = await sealConvCapsule(`part ${i}`, bucketKey);
      parts.push(await buildConvPublishWalletMessage({
        writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: i + 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
      }));
    }
    // all parts address the SAME shard (same write key + epoch)
    expect(new Set(parts.map((p) => p.to)).size, 'all parts target one shard').toBe(1);

    const dest = Address.parseRaw(parts[0].to);
    const initCore = toCoreCell(parts[0].init);
    // The first publish deploys the shard (StateInit); the rest publish into it in seq order.
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      const res = await payer.send({
        to: dest, value: p.value, body: toCoreCell(p.body),
        init: i === 0 ? { code: initCore.refs[0], data: initCore.refs[1] } : undefined, bounce: true,
      } as any);
      const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
      expect(Number(tx?.description?.computePhase?.exitCode), `part ${i} accepted`).toBe(0);
    }

    const shard = bc.openContract(RecordShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.record_count, 'three records stored').toBe(3n);
    expect(view.last_seq, 'last_seq advanced to the final part').toBe(3n);
  }, 240_000);
});
