import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, beginCell, toNano, Cell } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { buildConvPublish } from '../web/publish-builder.mjs';
import { buildConvPublishBrowser } from '../web/conv-publish-browser.mjs';
import { decodeRecordShardLastSeq } from '../web/conv-lane-read.mjs';
import { computeCellHashAndDepth, serializeBoc, beginCell as clientCell } from '../web/pwa-contract-transactions.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { deployFeeSink } from './helpers/fee-sink-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-PUBLISH-BROWSER — the browser sends the same signed CONV capsule, or the money is spent and nothing arrives.
// The RecordShard recomputes frameCommit from the cells it receives and verifies an ed25519 signature over
// (seq ‖ commit) under the conversation write key, so a body that is off by anything — or a wrong ref nesting — is
// refused or stores a commitment the recipient's delivery check rejects. Pinned against the @ton/core reference and
// then actually accepted by a live RecordShard.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const SECRET = new Uint8Array(32).fill(0x5a);
const WRITE_PUB = ed25519.getPublicKey(SECRET);

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

describe('CONV-PUBLISH-BROWSER — the same signed CONV capsule, built without @ton/core', () => {
  it('CONV-01: address, body, StateInit and commit are identical to the reference builder', async () => {
    const cases = [
      { seq: 1, header0: cellOf(0x11), header1: cellOf(0x12, 40), body: cellOf(0x13, 300) },
      { seq: 42, header0: cellOf(0x21, 1), header1: cellOf(0x22), body: cellOf(0x23, 700) },
    ];
    for (const c of cases) {
      const reference = await buildConvPublish({
        writePublicKey: WRITE_PUB, writeSecret: SECRET, epoch: EPOCH, value: CONV_PUBLISH_VALUE,
        seq: c.seq, header0: asCore(c.header0), header1: asCore(c.header1), body: asCore(c.body),
      });
      const browser = await buildConvPublishBrowser({
        writePublicKey: WRITE_PUB, writeSecret: SECRET, epoch: EPOCH, value: CONV_PUBLISH_VALUE,
        seq: c.seq, header0: c.header0, header1: c.header1, body: c.body,
      });
      expect(browser.to, `destination seq ${c.seq}`).toBe(reference.to.toRawString());
      expect(await hashOf(browser.body), `the signed message body seq ${c.seq}`).toEqual(reference.body.hash());
      const referenceInit = beginCell()
        .storeUint(0, 1).storeUint(0, 1).storeUint(1, 1).storeUint(1, 1).storeUint(0, 1)
        .storeRef((reference.init as any).code).storeRef((reference.init as any).data).endCell();
      expect(await hashOf(browser.init), `the StateInit seq ${c.seq}`).toEqual(referenceInit.hash());
      expect(browser.commit, `the commit seq ${c.seq}`).toBe((reference as any).commit);
    }
  }, 240_000);

  it('CONV-02: a browser-built CONV publish is ACCEPTED by the real RecordShard and stores the record', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'conv-02-sink' });
    const payer = await bc.treasury('conv-02-payer');

    const c = { seq: 1, header0: cellOf(0x55), header1: cellOf(0x56, 32), body: cellOf(0x57, 256) };
    const built = await buildConvPublishBrowser({
      writePublicKey: WRITE_PUB, writeSecret: SECRET, epoch: EPOCH, value: CONV_PUBLISH_VALUE,
      seq: c.seq, header0: c.header0, header1: c.header1, body: c.body,
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

    // CONV-03 (inline): the client last_seq decoder reads the SAME last_seq off the REAL getter stack — the cold-start
    // seq floor a send uses when the local counter has no value for this (conversation, epoch). Wire-mapped like SCAN-04.
    const raw: any = await bc.runGetMethod(dest, 'get_view', [] as any);
    const wire = (raw.stack as any[]).map((item: any) => item.type === 'cell' || item.type === 'slice' || item.type === 'builder'
      ? { type: 'cell', value: item.cell.toBoc().toString('base64') } : { type: 'int', value: String(item.value) });
    expect(decodeRecordShardLastSeq(wire), 'the client decoder reads last_seq off the real stack').toBe(1);
  }, 240_000);
});
