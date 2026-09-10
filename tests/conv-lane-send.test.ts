import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell, beginCell, toNano } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  randomBytes,
} from '../web/crypto/platho-crypto.mjs';
import { buildConvPublishWalletMessage, prepareConvLaneParts } from '../web/conv-lane-send.mjs';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { vaultInternalPublishValue, stateInitCarriageNanotons, FV_DEPLOY_FUNDING, FV_PROTOCOL_FEE } from '../web/fee-vault.mjs';
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

  // ── THE ONE DOOR PAST THE FLIP, as the funnel routes it [CUTOVER item 11] ────────────────────────────────────
  // Shapes only: the cells for generation 18 are stand-ins here (the real ones live in contracts18, where
  // CONVVAULT-02 replays these very messages against the compiled vault and shard). What this holds is the routing:
  // which door, in what order, with what attached, and what is refused before anything reaches the wallet.
  const DUMMY_CELL = beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64');
  const VAULT = `0:${'77'.repeat(32)}`;
  const OWNER = `0:${'88'.repeat(32)}`;
  const refsOf = (m: any) => parseBocBase64(m.payload).refs.length;
  const bytesOf = (m: any) => serializeBoc(parseBocBase64(m.payload).refs[0]).length;   // the record the vault forwards

  it('CLS-ROUTE-01: before the flip every part takes the direct door, and no vault is deployed whatever the caller says', async () => {
    const capsule = await sealConvCapsule('direct door', randomBytes(32));
    const parts = [{ writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE }];
    const { prepared, deploy, route } = await prepareConvLaneParts({ ownerWallet: OWNER, vaultAddress: VAULT, feeDue: 5_000_000n, deployVault: true }, parts);
    expect(route).toBe('direct');
    expect(deploy, 'generation 17 has no vault door, so nothing deploys one').toBeNull();
    expect(prepared[0].route).toBe('direct');
    expect(prepared[0].message.address).toBe(prepared[0].to);
    expect(BigInt(prepared[0].message.amount)).toBe(CONV_PUBLISH_VALUE);
    const bare = await prepareConvLaneParts({}, parts);
    expect(bare.route, 'and a caller with no vault at all is served').toBe('direct');
  });

  it('CLS-ROUTE-02: past the flip every part is an envelope to the payer vault; the deploy leads; the halves ride the first part only', async () => {
    __setLaneGenerationCodeForTests('record', 18, DUMMY_CELL);
    __setLaneGenerationCodeForTests('vault', 18, DUMMY_CELL);
    try {
      const parts: any[] = [];
      for (const seq of [1, 2]) {
        parts.push({ writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq, epoch: EPOCH,
          capsule: await sealConvCapsule('vault door ' + seq, randomBytes(32)), value: CONV_PUBLISH_VALUE, boundary: EPOCH });
      }
      const { prepared, deploy, route } = await prepareConvLaneParts({ ownerWallet: OWNER, vaultAddress: VAULT, feeDue: null, deployVault: true }, parts);
      expect(route).toBe('vault');
      expect(deploy.address).toBe(VAULT);
      expect(BigInt(deploy.amount)).toBe(FV_DEPLOY_FUNDING);
      expect(deploy.stateInit, 'the deploy carries the vault StateInit').toBeTruthy();
      expect(deploy.bounce).toBe(false);
      for (const p of prepared) {
        expect(p.route).toBe('vault');
        expect(p.message.address, 'every envelope is addressed to the vault').toBe(VAULT);
        expect(p.shard, 'and names the one shard').toBe(prepared[0].shard);
        expect(p.message.bounce).toBe(true);
      }
      expect(refsOf(prepared[0].message), 'the first part carries shard_code + shard_data').toBe(3);
      expect(refsOf(prepared[1].message), 'the second part does not').toBe(1);
      // the attach is the door's own figure at the FULL fee when no fresh fee is known — and the first part, which
      // carries the shard's StateInit, is priced for carrying it: the halves ride the vault -> shard hop and its
      // forward fee is charged on their cells [2026-09-05]
      const [, shardCode, shardData] = parseBocBase64(prepared[0].message.payload).refs;
      const initCarriage = stateInitCarriageNanotons(shardCode, shardData);
      expect(initCarriage > 0n, 'the RecordShard code weighs something').toBe(true);
      expect(BigInt(prepared[0].message.amount)).toBe(vaultInternalPublishValue({
        directValue: CONV_PUBLISH_VALUE, capsuleBytes: bytesOf(prepared[0].message), feeDue: FV_PROTOCOL_FEE,
        stateInit: { code: shardCode, data: shardData } }));
      expect(BigInt(prepared[0].message.amount) - initCarriage, 'the halves are the only difference the first part pays for')
        .toBe(vaultInternalPublishValue({ directValue: CONV_PUBLISH_VALUE, capsuleBytes: bytesOf(prepared[0].message), feeDue: FV_PROTOCOL_FEE }));
      expect(BigInt(prepared[1].message.amount), 'the second part carries no halves and pays for none')
        .toBe(vaultInternalPublishValue({ directValue: CONV_PUBLISH_VALUE, capsuleBytes: bytesOf(prepared[1].message), feeDue: FV_PROTOCOL_FEE }));
      // a fresh, discounted fee lowers it — and without `deployVault` nothing is prepended
      const cheaper = await prepareConvLaneParts({ ownerWallet: OWNER, vaultAddress: VAULT, feeDue: 5_000_000n }, parts.slice(0, 1));
      expect(BigInt(cheaper.prepared[0].message.amount) < BigInt(prepared[0].message.amount)).toBe(true);
      expect(cheaper.deploy).toBeNull();
      // a shard the caller knows to be live spares the halves even on the first part
      const live = await prepareConvLaneParts({ ownerWallet: OWNER, vaultAddress: VAULT }, [{ ...parts[0], shardLive: true }]);
      expect(refsOf(live.prepared[0].message)).toBe(1);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('CLS-ROUTE-03: past the flip a send with no vault is refused before anything reaches the wallet, and one transfer may not straddle the flip', async () => {
    __setLaneGenerationCodeForTests('record', 18, DUMMY_CELL);
    try {
      const capsule = await sealConvCapsule('no vault', randomBytes(32));
      const part18 = { writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE, boundary: EPOCH };
      await expect(prepareConvLaneParts({}, [part18])).rejects.toMatchObject({ code: 'CONV_VAULT_DOOR_REQUIRED' });
      const part17 = { ...part18, epoch: EPOCH - 1, seq: 2 };   // the day before the flip still belongs to 17
      await expect(prepareConvLaneParts({ ownerWallet: OWNER, vaultAddress: VAULT }, [part17, part18])).rejects.toThrow(/straddle/);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });
});
