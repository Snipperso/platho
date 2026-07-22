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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-LANE-CONFIRM — the DELIVERY confirm driven against a REAL RecordShard. The first confirm driver was reverted
// because it matched the shard's GLOBAL last_seq: a later message reaching that seq while an earlier one bounced
// false-confirmed the bounced one → silent loss. This confirm matches MY frame_commit — per-record, unique to my
// capsule — so it can only ever confirm the exact record I published. These prove, over a live shard: all my parts'
// commits are found (verified), a commit never published is NOT found and the scan reports itself COMPLETE (definitive
// non-landing, not a bounded-scan artefact), a partial set is caught, an undeployed shard reads as record_count 0 /
// not-landed, and a TRANSIENT read (429) PROPAGATES rather than being mistaken for absence.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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

// A runGetMethod that stands in for toncenter over the sandbox, returning the SAME wire stack shape (bool as -1/0,
// ints as hex strings) the readers decode in production. Dispatches on method like the real transport.
function sandboxRunGetMethod(blockchain: any) {
  return async ({ address, method, stack }: any) => {
    const shard = blockchain.openContract(RecordShard.fromAddress(Address.parse(String(address))));
    // An uninitialised account: the sandbox throws "non-active contract"; toncenter returns TVM exit_code -256. Map the
    // former to the latter so the sandbox faithfully stands in for the production absent-account signal the readers decode.
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
        ],
      };
    }
    if (method === 'get_record') {
      let r;
      try { r = await shard.getGetRecord(BigInt(stack[0].value)); } catch (e) { if (absent(e)) return { exit_code: -256, stack: [] }; throw e; }
      return {
        exit_code: 0,
        stack: [
          { type: 'num', value: r.exists ? '-1' : '0' },
          { type: 'num', value: '0x' + r.frame_commit.toString(16) },
          { type: 'num', value: '0x' + r.created_at.toString(16) },
        ],
      };
    }
    throw new Error(`unexpected method ${method}`);
  };
}

// Deploy a shard and publish `count` parts into it, returning the shard address + each part's frame_commit.
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
    // a bogus commit — never stored. The scan walks to the bottom (record 0) without finding it.
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
    // both real commits landed, but a third (never sent) part is required too → not fully delivered.
    const res = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [...commits, 0xabcdn] });
    expect(res.landed).toBe(false);
    expect(res.complete, 'authoritative: two of three found, bottom reached').toBe(true);
  }, 240_000);

  it('CLC-UNDEPLOYED: an undeployed shard reads record_count 0 and confirms not-landed (never throws)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    // build a message just to get a well-formed shard address, but DO NOT publish it.
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

    // a runGetMethod whose get_view raises a 429 (a rate limit, NOT a structural -256 absence).
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

    // a transport-level 404 (nginx/CDN/misroute), NOT a TVM -256. It must be transient, never "recordCount 0".
    const notFound = async () => { const e: any = new Error('Not Found'); e.status = 404; throw e; };
    const readView = createRecordShardViewReader(notFound);
    const readRecord = createRecordShardRecordReader(sandboxRunGetMethod(bc));
    await expect(confirmConvRecordsLanded({ readView, readRecord, address, commits }))
      .rejects.toThrow(/not found|404/i);
  }, 240_000);

  it('CLC-UNINIT-13: the PRODUCTION uninit signal (transport throws exitCode -13) reads as absence, not a transient', async () => {
    // This transport surfaces a never-deployed account as a THROWN exitCode -13 (TON_GET_METHOD_UNINITIALIZED_EXIT_CODE),
    // NOT -256 (that is the sandbox emulator). A first-contact publish that bounced leaves the shard undeployed; the
    // confirm MUST read that as not-landed (so it can redden), never as a transient (which would stay optimistic green).
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
    const { address, commits } = await deployAndPublish(bc, payer, randomBytes(32), 1);   // shard reaches last_seq=1

    // count every get_record so we can prove the floor short-circuits before any record scan.
    let recordReads = 0;
    const run = sandboxRunGetMethod(bc);
    const readView = createRecordShardViewReader(run);
    const readRecord = createRecordShardRecordReader(async (call: any) => { if (call.method === 'get_record') recordReads += 1; return run(call); });
    // my message claims seq 5, but the shard only ever reached seq 1 → it never accepted mine.
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
    // THE OLD BUG: a maxScan smaller than record_count can never reach the bottom → complete stays false → never reddens.
    const bounded = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [0xdeadn], maxScan: 2 });
    expect(bounded.landed).toBe(false);
    expect(bounded.complete, 'a bounded window with records below is NOT authoritative').toBe(false);
    // THE FIX: the default (no maxScan) walks the full record_count, so an absent commit is provably not landed.
    const full = await confirmConvRecordsLanded({ readView, readRecord, address, commits: [0xdeadn] });
    expect(full.landed).toBe(false);
    expect(full.complete, 'the full-shard scan is authoritative — absence is proven').toBe(true);
  }, 240_000);
});
