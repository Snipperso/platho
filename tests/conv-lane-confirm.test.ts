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
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import {
  createRecordShardViewReader,
  createRecordShardRecordReader,
  confirmConvRecordsLanded,
} from '../web/conv-lane-read.mjs';
import { deployFeeSink } from './helpers/fee-sink-fixture';


const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const WRITE_SECRET = new Uint8Array(32).fill(0x5a);
const WRITE_PUB = ed25519.getPublicKey(WRITE_SECRET);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));

async function sealConvCapsule(text: string, bucketKey: Uint8Array) {
  const sender: any = await createMessagingIdentity();
  const recipient: any = await createMessagingIdentity();
  const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
  return createEncryptedConvCapsule(text, recipientBundle, sender, bucketKey, { now: CLOCK * 1000 });
}

function sandboxRunGetMethod(blockchain: any) {
  return async ({ address, method, stack }: any) => {
    const shard = blockchain.openContract(RecordShard.fromAddress(Address.parse(String(address))));
    const absent = (e: any) => /non-active|not.*active|uninitial/i.test(String(e?.message ?? e));
    if (method === 'get_view') {
      let v;
      try { v = await shard.getGetView(); } catch (e) { if (absent(e)) return { exit_code: -256, stack: [] }; throw e; }
      return {
        exit_code: 0,
        stack: [
          { type: 'num', value: '0x' + v.write_pubkey.toString(16) },
          { type: 'num', value: '0x' + v.epoch.toString(16) },
          { type: 'num', value: '0x' + v.last_seq.toString(16) },
          { type: 'num', value: '0x' + v.record_count.toString(16) },
          { type: 'num', value: '0x' + v.safe_cap.toString(16) },
          { type: 'num', value: '0x' + v.retention.toString(16) },
          { type: 'num', value: '0x' + v.min_value.toString(16) },
          { type: 'num', value: '0x' + v.deploy_min_value.toString(16) },
          { type: 'num', value: '0x' + v.protocol_fee.toString(16) },
          { type: 'num', value: '0x' + v.retire_at.toString(16) },
        ],
      };
    }
    if (method === 'get_record') {
      let r;
      try { r = await shard.getGetRecord(BigInt(stack[0].value)); } catch (e) { if (absent(e)) return { exit_code: -256, stack: [] }; throw e; }
      return {
        exit_code: 0,
        stack: [
          { type: 'num', value: r.exists ? '-0x1' : '0x0' },
          { type: 'num', value: '0x' + r.frame_commit.toString(16) },
          { type: 'num', value: '0x' + r.created_at.toString(16) },
        ],
      };
    }
    throw new Error(`unexpected method ${method}`);
  };
}

async function deployAndPublish(blockchain: any, payer: any, bucketKey: Uint8Array, count: number) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const capsule = await sealConvCapsule(`part ${i}`, bucketKey);
    parts.push(await buildConvPublishWalletMessage({
      writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: i + 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
    }));
  }
  const dest = Address.parseRaw(parts[0].to);
  const initCore = toCoreCell(parts[0].init);
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    const res = await payer.send({
      to: dest, value: p.value, body: toCoreCell(p.body),
      init: i === 0 ? { code: initCore.refs[0], data: initCore.refs[1] } : undefined, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), `part ${i} accepted`).toBe(0);
  }
  return { address: parts[0].to, commits: parts.map((p) => p.commit) };
}

describe('CONV-LANE-CONFIRM', () => {
  it('CLC-FOUND: every part commit is matched among the shard records — verified delivery', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-found-sink' });
    const payer = await bc.treasury('clc-found-payer');
    const { address, commits } = await deployAndPublish(bc, payer, randomBytes(32), 3);

    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(run);
    const res = await confirmConvRecordsLanded({ readView, readRecord, address, commits });
    expect(res.landed, 'all three commits are stored').toBe(true);
    expect(res.complete, 'the confirm is authoritative').toBe(true);
    expect(res.recordCount).toBe(3);
  }, 240_000);

  it('CLC-ABSENT: a commit never published is NOT found, and the scan reports COMPLETE (definitive non-landing)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-absent-sink' });
    const payer = await bc.treasury('clc-absent-payer');
    const { address } = await deployAndPublish(bc, payer, randomBytes(32), 2);

    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(run);
    const res = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [0xdeadbeefn] });
    expect(res.landed, 'the bogus commit is not stored').toBe(false);
    expect(res.complete, 'reached the bottom — this is a definitive not-landed, not a scan-window artefact').toBe(true);
  }, 240_000);

  it('CLC-PARTIAL: if ANY part commit is missing the message is not landed (a middle part can bounce)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-partial-sink' });
    const payer = await bc.treasury('clc-partial-payer');
    const { address, commits } = await deployAndPublish(bc, payer, randomBytes(32), 2);

    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(run);
    const res = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [...commits, 0xabcdn] });
    expect(res.landed).toBe(false);
    expect(res.complete, 'authoritative: two of three found, bottom reached').toBe(true);
  }, 240_000);

  it('CLC-UNDEPLOYED: an undeployed shard reads record_count 0 and confirms not-landed (never throws)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const capsule = await sealConvCapsule('unsent', randomBytes(32));
    const built = await buildConvPublishWalletMessage({
      writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: 1, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
    });

    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(run);
    const res = await confirmConvRecordsLanded({ readView, readRecord, address: built.to, commits: [built.commit] });
    expect(res.landed, 'nothing was published — not landed').toBe(false);
    expect(res.complete, 'record_count 0 is authoritative').toBe(true);
    expect(res.recordCount).toBe(0);
  }, 120_000);

  it('CLC-TRANSIENT: a 429 read PROPAGATES — the confirm never mistakes "could not read" for "not stored"', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-transient-sink' });
    const payer = await bc.treasury('clc-transient-payer');
    const { address, commits } = await deployAndPublish(bc, payer, randomBytes(32), 1);

    const throwing = async () => { const e: any = new Error('rate limited'); e.status = 429; throw e; };
    const readView = createRecordShardViewReader(throwing);
    const readRecord = createRecordShardRecordReader(sandboxRunGetMethod(bc));
    await expect(confirmConvRecordsLanded({ readView, readRecord, address, commits }))
      .rejects.toThrow(/rate limited|429/i);
  }, 240_000);

  it('CLC-404: a bare HTTP 404 PROPAGATES too — a proxy/gateway 404 is NOT structural absence (would false-red → double-publish)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-404-sink' });
    const payer = await bc.treasury('clc-404-payer');
    const { address, commits } = await deployAndPublish(bc, payer, randomBytes(32), 1);

    const notFound = async () => { const e: any = new Error('Not Found'); e.status = 404; throw e; };
    const readView = createRecordShardViewReader(notFound);
    const readRecord = createRecordShardRecordReader(sandboxRunGetMethod(bc));
    await expect(confirmConvRecordsLanded({ readView, readRecord, address, commits }))
      .rejects.toThrow(/not found|404/i);
  }, 240_000);

  it('CLC-UNINIT-13: the PRODUCTION uninit signal (transport throws exitCode -13) reads as absence, not a transient', async () => {
    const uninit13 = async () => { const e: any = new Error('TON RPC get-method exit code -13'); e.exitCode = -13; throw e; };
    const readView = createRecordShardViewReader(uninit13);
    const readRecord = createRecordShardRecordReader(uninit13);
    const res = await confirmConvRecordsLanded({ readView, readRecord, address: 'EQC_undeployed_000000000000000000000000000000000000', commits: [0x1234n] });
    expect(res.landed, 'undeployed shard → not landed').toBe(false);
    expect(res.complete, '-13 is authoritative absence (would redden past max age)').toBe(true);
    expect(res.recordCount).toBe(0);
  }, 60_000);

  it('CLC-SEQSHORT: last_seq below my seq confirms not-landed with ZERO record reads (the >512-record bounce, cheaply)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-seqshort-sink' });
    const payer = await bc.treasury('clc-seqshort-payer');
    const { address, commits } = await deployAndPublish(bc, payer, randomBytes(32), 1);

    let recordReads = 0;
    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(async (call: any) => { if (call.method === 'get_record') recordReads += 1; return run(call); });
    const res = await confirmConvRecordsLanded({ readView, readRecord, address, commits, minSeq: 5 });
    expect(res.seqShort, 'the shard has not reached my seq').toBe(true);
    expect(res.landed).toBe(false);
    expect(recordReads, 'no record scan was needed — the last_seq floor decided it').toBe(0);
  }, 240_000);

  it('CLC-FULLSCAN: the default scan covers the WHOLE shard so absence is provable; a bounded window leaves it inconclusive', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    await deployFeeSink(bc, { funderSeed: 'clc-fullscan-sink' });
    const payer = await bc.treasury('clc-fullscan-payer');
    const { address } = await deployAndPublish(bc, payer, randomBytes(32), 3);

    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(run);
    const bounded = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [0xdeadn], maxScan: 2 });
    expect(bounded.landed).toBe(false);
    expect(bounded.complete, 'a bounded window with records below is NOT authoritative').toBe(false);
    const full = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [0xdeadn] });
    expect(full.landed).toBe(false);
    expect(full.complete, 'the full-shard scan is authoritative — absence is proven').toBe(true);
  }, 240_000);
});
