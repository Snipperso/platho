import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, beginCell, toNano, Cell } from '@ton/core';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { buildRecoveryPublish } from '../web/publish-builder.mjs';
import { buildRecoveryPublishBrowser } from '../web/recovery-publish-browser.mjs';
import { computeCellHashAndDepth, serializeBoc, beginCell as clientCell, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { sealRecoveryBlob, openRecoveryBlob } from '../web/recovery-blob.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// RECOVERY-PUBLISH-BROWSER — the browser stores the same owner-signed K_root durability record. The shard verifies
// the owner signature (bound to the shard address), that slotKey == slotKeyForOwner(owner_pubkey, slot_index), that
// seq advanced, and that body.hash() == bh — so a body off by anything, a wrong ref split, or a mis-signed digest is
// refused. Pinned against the @ton/core reference and then accepted by a live RecoveryShard.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const SEED = new Uint8Array(32).fill(0x9c);
const H0 = (1n << 240n) + 0x11n;
const H1 = (1n << 200n) + 0x22n;

const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = clientCell().bytesValue(chunks[chunks.length - 1], chunks[chunks.length - 1].length, 'chunk').endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) {
    cell = clientCell().bytesValue(chunks[i], chunks[i].length, 'chunk').ref(cell, 'next').endCell();
  }
  return cell;
};
const asCore = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));

describe('RECOVERY-PUBLISH-BROWSER — the same owner-signed recovery record, built without @ton/core', () => {
  it('REC-01: address, body, StateInit and slotKey are identical to the reference builder', async () => {
    for (const slotIndex of [0, 3, 255]) {
      const body = cellOf(0x40 + slotIndex, 200);
      const reference = await buildRecoveryPublish({ seed: SEED, slotIndex, seq: 1, h0: H0, h1: H1, body: asCore(body), value: toNano('0.05') });
      const browser = await buildRecoveryPublishBrowser({ seed: SEED, slotIndex, seq: 1, h0: H0, h1: H1, body, value: toNano('0.05') });
      expect(browser.to, `destination slot ${slotIndex}`).toBe(reference.to.toRawString());
      expect(browser.slotKey, `slotKey slot ${slotIndex}`).toBe((reference as any).slotKey);
      expect(await hashOf(browser.body), `the signed message body slot ${slotIndex}`).toEqual(reference.body.hash());
      const referenceInit = beginCell()
        .storeUint(0, 1).storeUint(0, 1).storeUint(1, 1).storeUint(1, 1).storeUint(0, 1)
        .storeRef((reference.init as any).code).storeRef((reference.init as any).data).endCell();
      expect(await hashOf(browser.init), `the StateInit slot ${slotIndex}`).toEqual(referenceInit.hash());
    }
  }, 240_000);

  it('REC-02: a browser-built recovery store is ACCEPTED by the real RecoveryShard and stored', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'rec-02-sink' });
    const payer = await bc.treasury('rec-02-payer');

    const body = cellOf(0x77, 256);
    const built = await buildRecoveryPublishBrowser({ seed: SEED, slotIndex: 5, seq: 1, h0: H0, h1: H1, body, value: toNano('0.05') });
    const bh = BigInt('0x' + (await hashOf(body)).toString('hex'));

    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    const res = await payer.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the shard accepted the owner-signed record').toBe(0);

    const shard = bc.openContract(RecoveryShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.bound, 'the slot is bound').toBe(true);
    expect(view.seq, 'seq advanced to the published seq').toBe(1n);
    expect(view.self_bucket_key, 'the shard is at the derived slot key').toBe(built.slotKey);
    expect(view.bh, 'the stored body hash matches the blob').toBe(bh);
  }, 240_000);

  it('REC-03: a REAL sealed K_root blob publishes, reads back via get_view + get_body, and opens to the same map (reinstall)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'rec-03-sink' });
    const payer = await bc.treasury('rec-03-payer');

    // A real conversation key map, sealed under the wallet seed (the reinstall-recovery payload).
    const A = new Uint8Array(32).fill(0x11);
    const B = new Uint8Array(32).fill(0x22);
    const kRootAB = new Uint8Array(32).fill(0x5a);
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(A, B, { kRoot: kRootAB, createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: 'w-A' });
    await store.advanceConvScanCursor(A, B, 19005);
    const map = store.snapshot();
    const convId = [...map.keys()][0];

    const { body, h0, h1 } = await sealRecoveryBlob(SEED, map);
    const built = await buildRecoveryPublishBrowser({ seed: SEED, slotIndex: 3, seq: 1, h0, h1, body, value: toNano('0.05') });

    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    const res = await payer.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the shard accepted the sealed blob').toBe(0);

    const shard = bc.openContract(RecoveryShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.h0, 'the digest hashes are stored').toBe(h0);
    expect(view.h1).toBe(h1);

    // THE REINSTALL PATH: read the blob back off chain (get_body) and open it from the SEED alone.
    const storedBody = await shard.getGetBody();
    const restored = await openRecoveryBlob(SEED, parseBocBase64(storedBody.toBoc().toString('base64')));
    const rec = restored.get(convId)!;
    expect(rec, 'the conversation is recovered on a fresh device from the seed + chain').toBeTruthy();
    expect(Buffer.from(rec.kRootCurrent).toString('hex'), 'the SAME K_root the device once held').toBe(Buffer.from(kRootAB).toString('hex'));
    expect(rec.lastScannedEpoch, 'the scan cursor is recovered too').toBe(19005);

    // and a wrong seed cannot open the on-chain blob.
    await expect(openRecoveryBlob(new Uint8Array(32).fill(0x01), parseBocBase64(storedBody.toBoc().toString('base64')))).rejects.toThrow();
  }, 240_000);

  it('REC-04: a NAMED slot (index 256, the prefs slot) is ACCEPTED by the real RecoveryShard (gate 13576 widened)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'rec-04-sink' });
    const payer = await bc.treasury('rec-04-payer');

    // slot 256 is the first NAMED slot — above the [0,256) conversation scan range. A restoring client reads it by its
    // fixed derivation, so it is reachable, and the contract now accepts it (13576 allows [0, RS_MAX_SLOTS+RS_NAMED_SLOTS)).
    const body = cellOf(0x5c, 200);
    const built = await buildRecoveryPublishBrowser({ seed: SEED, slotIndex: 256, seq: 1, h0: H0, h1: H1, body, value: toNano('0.05') });
    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    const res = await payer.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the named prefs slot binds (was gate 13576 out-of-range before)').toBe(0);

    const shard = bc.openContract(RecoveryShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.bound, 'the named slot is bound').toBe(true);
    expect(view.self_bucket_key, 'the shard is at the derived named-slot key').toBe(built.slotKey);
  }, 240_000);
});
