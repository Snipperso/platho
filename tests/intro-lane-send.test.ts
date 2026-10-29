import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedIntroCapsule,
} from '../web/crypto/platho-crypto.mjs';
import { buildIntroPublishWalletMessage } from '../web/intro-lane-send.mjs';
import { INTRO_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { parseBocBase64, serializeBoc, computeCellHashAndDepth } from '../web/pwa-contract-transactions.mjs';


const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const bytesToBig = (b: Uint8Array): bigint => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

async function sealIntro() {
  const sender: any = await createMessagingIdentity();
  const recipient: any = await createMessagingIdentity();
  const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
  const capsule = await createEncryptedIntroCapsule(recipientBundle, sender, { firstMessageBytes: new TextEncoder().encode('первый контакт'), now: CLOCK * 1000 });
  return { sender, recipient, capsule };
}

describe('INTRO-LANE-SEND', () => {
  it('ILS-MSG: the wallet message carries the built INTRO publish unchanged (real sealed capsule)', async () => {
    const { capsule } = await sealIntro();
    const prepared = await buildIntroPublishWalletMessage({ epoch: EPOCH, bucket: 3n, capsule, value: INTRO_PUBLISH_VALUE });

    expect(prepared.message.address, 'destination is the built shard address').toBe(prepared.to);
    expect(prepared.message.amount, 'value is the INTRO deploy figure').toBe(INTRO_PUBLISH_VALUE);
    expect(prepared.message.stateInit, 'StateInit attached for lazy deploy').toBe(prepared.init);
    expect(prepared.message.bounce).toBe(true);
    const payloadCell = parseBocBase64(prepared.message.payload);
    expect(await hashOf(payloadCell), 'payload BoC == the built body').toEqual(await hashOf(prepared.body));
  }, 120_000);

  it('ILS-SHARD: a module-built INTRO publish is ACCEPTED by the real IntroShard and stores the capsule r + view_tag', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const payer = await bc.treasury('ils-shard-payer');

    const { capsule } = await sealIntro();
    const built = await buildIntroPublishWalletMessage({ epoch: EPOCH, bucket: 5n, capsule, value: INTRO_PUBLISH_VALUE });

    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    const res = await payer.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the shard accepted the intro publish').toBe(0);

    const shard = bc.openContract(IntroShard.fromAddress(dest));
    const entry = await shard.getGetEntry(0n);
    expect(entry.exists, 'the shard was created and the intro stored').toBe(true);
    const expectedR = bytesToBig(new Uint8Array(Buffer.from((capsule as any).header0.ephemeralR, 'base64url')));
    expect(entry.r, 'ephemeral R stored').toBe(expectedR);
    expect(entry.view_tag, 'stealth view_tag stored').toBe(BigInt((capsule as any).header0.viewTag ?? 0));
  }, 240_000);
});
