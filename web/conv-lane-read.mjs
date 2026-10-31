
import { parseBocBase64, serializeBoc, tonCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=59';
import { toWireAddress } from './shard-reader.mjs?v=109';
import { stackNumOr0 } from './ton-stack-num.mjs?v=2';
import { parseVaultPublishEnvelope, M21C_VAULT_PUBLISH_OPCODE } from './m21c-envelope.mjs?v=5';
import { WRITES_GENERATION } from './cutover-epoch.mjs?v=7';
import { convWriteDigestCell } from './conv-publish-browser.mjs?v=48';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

export const CAPSULE_PUBLISH_OPCODE = 0x52535031n;

export const CONV_READ_OPCODES = Object.freeze(WRITES_GENERATION >= 18
  ? [CAPSULE_PUBLISH_OPCODE, M21C_VAULT_PUBLISH_OPCODE]
  : [CAPSULE_PUBLISH_OPCODE]);

const CONV_READ_OPCODES_17 = Object.freeze([CAPSULE_PUBLISH_OPCODE]);
const CONV_READ_OPCODES_18 = Object.freeze([M21C_VAULT_PUBLISH_OPCODE]);

export function convReadOpcodesForGeneration(generation) {
  const g = Number(generation);
  if (g === 17) return CONV_READ_OPCODES_17;
  if (g === 18) return CONV_READ_OPCODES_18;
  return CONV_READ_OPCODES;
}
const RS_FRAME_DOMAIN = 0x52534643n;
const RS_WRITE_DOMAIN = 0x52535744n;

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

function cellReader(cell) {
  if (cell && typeof cell.beginParse === 'function') {
    const slice = cell.beginParse();
    return {
      remaining: () => slice.remainingBits,
      refs: () => slice.remainingRefs,
      loadUint: (w) => slice.loadUintBig(w),
      loadRef: () => slice.loadRef(),
    };
  }
  const bytes = cell?.data ?? new Uint8Array(0);
  const bitLength = Number(cell?.bitLength ?? bytes.length * 8);
  const refs = (cell && Array.isArray(cell.refs)) ? cell.refs : [];
  let bit = 0;
  let refIndex = 0;
  return {
    remaining: () => bitLength - bit,
    refs: () => refs.length - refIndex,
    loadUint: (w) => {
      let value = 0n;
      for (let i = 0; i < w; i += 1, bit += 1) {
        value = (value << 1n) | BigInt(((bytes[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1);
      }
      return value;
    },
    loadRef: () => refs[refIndex++] ?? null,
  };
}

export function convHeader0BucketKey(header0) {
  try {
    const r = cellReader(header0);
    if (r.remaining() !== 320) return null;
    if (r.loadUint(32) !== 0x50483043n) return null;
    r.loadUint(8);
    if (r.loadUint(8) !== 1n) return null;
    r.loadUint(16);
    return r.loadUint(256);
  } catch {
    return null;
  }
}

function sigBytesFromCell(cell) {
  if (cell && typeof cell.beginParse === 'function') {
    try {
      const slice = cell.beginParse();
      if (slice.remainingBits < 512) return null;
      return Uint8Array.from(slice.loadBuffer(64));
    } catch {
      return null;
    }
  }
  const bytes = cell?.data ?? null;
  if (!bytes || bytes.length < 64) return null;
  return Uint8Array.from(bytes.subarray(0, 64));
}

const cellToBocBase64 = (cell) => tonCell.bytesToBase64(serializeBoc(cell));

export function parseCapsulePublishBody(bodyCell) {
  if (!bodyCell) return null;
  const envelope = parseVaultPublishEnvelope(bodyCell, cellReader);
  const inner = envelope ? envelope.record : bodyCell;
  try {
    const r = cellReader(inner);
    if (r.remaining() < 32 + 64) return null;
    if (r.loadUint(32) !== CAPSULE_PUBLISH_OPCODE) return null;
    const seq = r.loadUint(64);
    if (r.refs() < 3) return null;
    const header0 = r.loadRef();
    const header1 = r.loadRef();
    const bodySig = r.loadRef();
    const rb = cellReader(bodySig);
    if (rb.refs() < 2) return null;
    const body = rb.loadRef();
    const sig = sigBytesFromCell(rb.loadRef());
    if (!header0 || !header1 || !body || !sig) return null;
    if (!Number.isSafeInteger(Number(seq))) return null;
    return { seq, header0, header1, body, sig };
  } catch {
    return null;
  }
}

export function convChainEntryFromParsed(parsed, { createdAtSec = null } = {}) {
  if (!parsed?.header0 || !parsed?.header1 || !parsed?.body) throw new Error('convChainEntryFromParsed requires header0/header1/body cells');
  return {
    exists: true,
    header_0_boc: cellToBocBase64(parsed.header0),
    header_1_boc: cellToBocBase64(parsed.header1),
    body_boc: cellToBocBase64(parsed.body),
    seq: parsed.seq === undefined ? null : String(parsed.seq),
    created_at: createdAtSec === null ? undefined : String(createdAtSec),
  };
}

async function cellHashBig(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

async function convFrameCommit(header0, header1, body) {
  const cell = tonCell.beginCell()
    .uint(RS_FRAME_DOMAIN, 32, 'RS_FRAME_DOMAIN')
    .uint(await cellHashBig(header0), 256, 'header0 hash')
    .uint(await cellHashBig(header1), 256, 'header1 hash')
    .uint(await cellHashBig(body), 256, 'body hash')
    .endCell();
  return cellHashBig(cell);
}

export const RECORD_SHARD_VIEW_ARITIES = Object.freeze([10, 11]);

const assertRecordShardViewArity = (stack) => {
  if (!Array.isArray(stack) || !RECORD_SHARD_VIEW_ARITIES.includes(stack.length)) {
    throw new Error(`RecordShard get_view returned ${stack?.length ?? 0} stack items, expected `
      + RECORD_SHARD_VIEW_ARITIES.join(' or '));
  }
};

export function decodeRecordShardLastSeq(stack) {
  assertRecordShardViewArity(stack);
  return Number(stackNumOr0(stack[2]?.value, 'get_view: last_seq'));
}

export function decodeRecordShardView(stack) {
  assertRecordShardViewArity(stack);
  return {
    lastSeq: Number(stackNumOr0(stack[2]?.value, 'get_view: last_seq')),
    recordCount: Number(stackNumOr0(stack[3]?.value, 'get_view: record_count')),
  };
}

export const CAPSULE_RECORD_VIEW_ARITY = 3;

export function decodeCapsuleRecordView(stack) {
  if (!Array.isArray(stack) || stack.length !== CAPSULE_RECORD_VIEW_ARITY) {
    throw new Error(`RecordShard get_record returned ${stack?.length ?? 0} stack items, expected ${CAPSULE_RECORD_VIEW_ARITY}`);
  }
  return {
    exists: stackNumOr0(stack[0]?.value, 'get_record: exists') !== 0n,
    frameCommit: stackNumOr0(stack[1]?.value, 'get_record: frame_commit'),
    createdAt: Number(stackNumOr0(stack[2]?.value, 'get_record: created_at')),
  };
}

const RS_UNINIT_EXIT_CODES = new Set([-13, -256]);
function isUninitExit(code) { return RS_UNINIT_EXIT_CODES.has(Number(code)); }
function isStructurallyAbsent(error) {
  return isUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);
}

export function createRecordShardViewReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardViewReader requires runGetMethod');
  return async (address) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    } catch (error) {
      if (isStructurallyAbsent(error)) return { exists: false, lastSeq: 0, recordCount: 0 };
      throw error;
    }
    if (!raw) throw new Error('RecordShard get_view returned no response');
    if (isUninitExit(raw.exit_code)) return { exists: false, lastSeq: 0, recordCount: 0 };
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_view failed with exit_code ${raw.exit_code}`);
    return { exists: true, ...decodeRecordShardView(raw.stack) };
  };
}

export function createRecordShardRecordReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardRecordReader requires runGetMethod');
  return async (address, entryId) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_record', stack: [{ type: 'num', value: String(entryId) }] });
    } catch (error) {
      if (isStructurallyAbsent(error)) return { exists: false, frameCommit: 0n, createdAt: 0 };
      throw error;
    }
    if (!raw) throw new Error('RecordShard get_record returned no response');
    if (isUninitExit(raw.exit_code)) return { exists: false, frameCommit: 0n, createdAt: 0 };
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_record failed with exit_code ${raw.exit_code}`);
    return decodeCapsuleRecordView(raw.stack);
  };
}

export const RECORD_PAGE_ARITY = 4;

export function decodeRecordPage(stack) {
  if (!Array.isArray(stack) || stack.length !== RECORD_PAGE_ARITY) {
    throw new Error(`RecordShard get_page returned ${stack?.length ?? 0} stack items, expected ${RECORD_PAGE_ARITY}`);
  }
  const num = (i, name) => stackNumOr0(stack[i]?.value, `get_page: ${name}`);
  const rowsValue = stack[3]?.value;
  const rows = !rowsValue ? null : typeof rowsValue === 'string' ? parseBocBase64(rowsValue) : rowsValue;
  return {
    fromId: Number(num(0, 'from_id')),
    count: Number(num(1, 'count')),
    recordCount: Number(num(2, 'record_count')),
    rows,
  };
}

const RS_PAGE_ROW_BITS = 320;

export function unpackRecordPageRows(rows, count) {
  const out = [];
  let cur = rows;
  while (cur && out.length < count) {
    if (typeof cur.beginParse === 'function') {
      const slice = cur.beginParse();
      while (slice.remainingBits >= RS_PAGE_ROW_BITS && out.length < count) {
        out.push({ frameCommit: slice.loadUintBig(256), createdAt: Number(slice.loadUintBig(64)) });
      }
    } else {
      const bytes = cur.data ?? new Uint8Array(0);
      const bitLength = Number(cur.bitLength ?? bytes.length * 8);
      let bit = 0;
      const take = (width) => {
        let value = 0n;
        for (let i = 0; i < width; i += 1, bit += 1) {
          value = (value << 1n) | BigInt(((bytes[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1);
        }
        return value;
      };
      while (bitLength - bit >= RS_PAGE_ROW_BITS && out.length < count) {
        out.push({ frameCommit: take(256), createdAt: Number(take(64)) });
      }
    }
    cur = (cur.refs && cur.refs.length > 0) ? cur.refs[0] : null;
  }
  return out;
}

export function createRecordShardPageReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardPageReader requires runGetMethod');
  const absent = () => ({ exists: false, fromId: 0, count: 0, recordCount: 0, rows: [] });
  return async (address, fromId, maxCount) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_page',
        stack: [{ type: 'num', value: String(fromId) }, { type: 'num', value: String(maxCount) }] });
    } catch (error) {
      if (isStructurallyAbsent(error)) return absent();
      throw error;
    }
    if (!raw) throw new Error('RecordShard get_page returned no response');
    if (isUninitExit(raw.exit_code)) return absent();
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_page failed with exit_code ${raw.exit_code}`);
    const page = decodeRecordPage(raw.stack);
    return { exists: true, fromId: page.fromId, count: page.count, recordCount: page.recordCount,
      rows: unpackRecordPageRows(page.rows, page.count) };
  };
}

export async function confirmConvRecordsLanded({ readView, readRecord, readPage = null, pageSize = 256, address, commits, minSeq = null, maxScan = null }) {
  if (typeof readView !== 'function' || typeof readRecord !== 'function') {
    throw new Error('confirmConvRecordsLanded requires readView/readRecord');
  }
  const want = new Set((commits ?? []).map((c) => BigInt(c)));
  if (want.size === 0) return { landed: true, complete: true, seqShort: false, recordCount: 0, lastSeq: 0, scanned: 0, found: [] };
  const view = await readView(address);
  if (!view?.exists) return { landed: false, complete: true, seqShort: false, recordCount: 0, lastSeq: 0, scanned: 0, found: [] };
  const recordCount = Number(view.recordCount);
  const lastSeq = Number(view.lastSeq);
  if (minSeq != null && lastSeq < Number(minSeq)) {
    return { landed: false, complete: false, seqShort: true, recordCount, lastSeq, scanned: 0, found: [] };
  }
  const limit = maxScan == null ? recordCount : Math.min(Number(maxScan), recordCount);
  const found = new Set();
  let scanned = 0;
  if (typeof readPage === 'function') {
    const size = Math.max(1, Math.min(Number(pageSize) || 256, 256));
    let top = recordCount;
    while (top > 0 && scanned < limit && found.size < want.size) {
      const count = Math.min(size, top, limit - scanned);
      const from = top - count;
      const page = await readPage(address, from, count);
      const rows = Array.isArray(page?.rows) ? page.rows : [];
      if (!page?.exists || Number(page.fromId) !== from || rows.length !== count) {
        throw new Error(`RecordShard get_page answered ${rows.length} of ${count} rows from ${from} — the scan is retried, not concluded`);
      }
      for (let i = rows.length - 1; i >= 0 && found.size < want.size; i -= 1) {
        scanned += 1;
        if (want.has(BigInt(rows[i].frameCommit))) found.add(BigInt(rows[i].frameCommit));
      }
      top = from;
    }
  } else {
    for (let id = recordCount - 1; id >= 0 && scanned < limit && found.size < want.size; id -= 1) {
      const rec = await readRecord(address, id);
      scanned += 1;
      if (rec?.exists && want.has(BigInt(rec.frameCommit))) found.add(BigInt(rec.frameCommit));
    }
  }
  const landed = found.size === want.size;
  const complete = landed || scanned >= recordCount;
  return { landed, complete, seqShort: false, recordCount, lastSeq, scanned, foundCount: found.size, found: [...found].map((commit) => commit.toString(16)) };
}

export function createRecordShardLastSeqReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardLastSeqReader requires runGetMethod');
  return async (address) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    } catch (error) {
      if (isStructurallyAbsent(error)) return 0;
      throw error;
    }
    if (!raw || isUninitExit(raw.exit_code)) return 0;
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_view failed with exit_code ${raw.exit_code}`);
    return decodeRecordShardLastSeq(raw.stack);
  };
}

export async function verifyConvWriteSignature(parsed, writePublicKey, epoch, { boundary } = {}) {
  if (!parsed?.sig || !writePublicKey) return false;
  try {
    const commit = await convFrameCommit(parsed.header0, parsed.header1, parsed.body);
    const digestCell = convWriteDigestCell({ seq: parsed.seq, commit, epoch, ...(boundary === undefined ? {} : { boundary }) });
    const { hash: digest } = await computeCellHashAndDepth(digestCell);
    const pub = writePublicKey instanceof Uint8Array ? writePublicKey : Uint8Array.from(writePublicKey);
    return ed25519.verify(parsed.sig, digest, pub);
  } catch {
    return false;
  }
}
