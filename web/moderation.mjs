// web/moderation.mjs — reports, verdicts and the two lookups every public surface reads through. [CUTOVER item 15]
//
// THE SHAPE, IN ONE PARAGRAPH [rebuilt 2026-09-04, audit]. A reader reports a post or comment into a ReportShard —
// one per (30-day era, bucket of 64), the bucket derived from the ROW KEY, hash(target ‖ partition key) — for a
// fee that goes to the bucket's sink. Moderators sweep those shards as a queue and send VERDICTS to the one
// ModerationLedger, which checks the seat and the daily cap and FORWARDS each verdict through the ModerationGate
// to where the content lives: a hide flips a bit in the PublicShard row every reader already reads (the page
// decoder in public-shard-ton-rpc-provider.mjs carries it as `hidden`), a wallet sanction lands as a leaf in the
// wallet's SanctionShard, which a reader asks for the authors on its screen in one call per bucket, and a review
// mark folds a report row's count. No client folds a log any more: the first design's page log put forty
// verdicts a day at the account ceiling and made every fresh device replay the whole log.
//
// WHAT IS PINNED AND WHERE. The target key, the row key, the message layouts and the getter layouts mirror the
// contracts (contracts18/contracts/ReportShard.tact, ModerationLedger.tact, SanctionShard.tact, ModerationGate.tact,
// moderation-wire.tact) and are held against the compiled cells by contracts18/tests/moderation-client.test.ts; the
// pure half (the sanction cache, the queue order, the mute store, the arithmetic) by tests/moderation.test.ts.

import { addrKey } from './shard-discovery.mjs?v=58';
import { beginCell, bytesToBase64, serializeBoc, computeCellHashAndDepth, bytesToBigUint } from './pwa-contract-transactions.mjs?v=47';
import {
  reportShardAddressBytesFor, reportShardStateInitFor, reportShardCodeAvailable, sanctionShardAddressBytesFor, sanctionShardCodeAvailable,
  publicShardAddressBytesFor, rawAddress,
} from './shard-address.mjs?v=29';
import { readInt, readCell, cellReader, extractStack } from './public-shard-ton-rpc-provider.mjs?v=28';
import { toWireAddress } from './shard-reader.mjs?v=61';
import { PLATHO_APP_CONFIG } from './platho-config.mjs?v=143';

// ── the contracts' numbers, mirrored (pinned by moderation-client.test.ts against the compiled cells) ──────────
export const REPORT_ERA_SECONDS = 2_592_000;         // MR_ERA_SECONDS
export const REPORT_BUCKET_COUNT = 64;               // MR_BUCKET_COUNT
export const REPORT_REASON_COUNT = 8;                // MR_REASON_COUNT
export const REPORT_FEE = 5_000_000n;                // MR_REPORT_FEE
/** deploy_min_value of an EMPTY ReportShard at fill 0: base 2,500,000 + target 250,000 + gas 2,000,000 + fee 5,000,000 +
 *  transport 600,000. A live shard's own `min_value` (the ladder) and `repeat_value` are READ, never mirrored. */
export const REPORT_DEPLOY_VALUE = 10_350_000n;
export const REPORT_OP = 0x4D525231;                 // "MRR1" ReportEntry
export const LEDGER_OP = Object.freeze({ PROPOSE: 0x4D4C5031, APPROVE: 0x4D4C4131, VERDICT: 0x4D4C5631 });
export const GATE_OP = Object.freeze({ SET_LEDGER: 0x4D475331 });
export const SANCTION_OP = Object.freeze({ PRUNE: 0x4D535058 });
export const LEDGER_COUNCIL_VALUE = 3_000_000n;     // ML_COUNCIL_GAS
export const COUNCIL_KIND = Object.freeze({ REPLACE_ROOT: 1, ADD_MODERATOR: 2, REMOVE_MODERATOR: 3, SET_LEDGER: 4, SWEEP_GATE: 5, ACCEPT_GATE: 6, WITHDRAW: 7 });
export const VERDICT_ACTION = Object.freeze({ HIDE_ENTRY: 1, UNHIDE_ENTRY: 2, WARN_WALLET: 3, RESTRICT_WALLET: 4, UNRESTRICT_WALLET: 5, REVIEW_REPORT: 6, UNWARN_WALLET: 7 });
export const SANCTION_BUCKET_COUNT = 64;             // MS_SANCTION_BUCKET_COUNT
export const SANCTION_MANY_CAP = 96;                 // SS_MANY_CAP
export const WARNINGS_TO_RESTRICT = 3;               // SS_WARNINGS_TO_RESTRICT — OWNER 2026-09-03
/** Reason codes 0..7 as the report shard counts them; labels live in i18n under moderation.reason.<name>. */
export const REPORT_REASONS = Object.freeze(['spam', 'illegal', 'harassment', 'scam', 'violence', 'sexual', 'impersonation', 'other']);
export const MODERATION_GENERATION = 18;

const TARGET_LIMIT = 1n << 144n;
const toBig = (v, name) => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return BigInt(v.trim());
  throw new TypeError(`${name} must be an integer, got ${typeof v}`);
};

// ── the target key and the row key ─────────────────────────────────────────────────────────────────────────
/**
 * The 144-bit key the report shard packs for a public entry: generation(8) | kind(8) | epoch_tag(64) | shard_seq(32)
 * | entry_id(32). Mirrors ReportShard.targetKey. NOT an identity on its own — every channel's era shard numbers
 * its entries from 0 — which is why the ROW key below folds the partition key in.
 */
export function targetKeyOf({ generation, kind, epochTag, shardSeq, entryId }) {
  const g = toBig(generation, 'generation'); const k = toBig(kind, 'kind');
  const tag = toBig(epochTag, 'epochTag'); const seq = toBig(shardSeq, 'shardSeq'); const id = toBig(entryId, 'entryId');
  if (g < 0n || g > 255n) throw new RangeError(`generation ${g} does not fit uint8`);
  if (k < 0n || k > 255n) throw new RangeError(`kind ${k} does not fit uint8`);
  if (tag < 0n || tag >= (1n << 64n)) throw new RangeError('epochTag does not fit uint64');
  if (seq < 0n || seq >= (1n << 32n)) throw new RangeError('shardSeq does not fit uint32');
  if (id < 0n || id >= (1n << 32n)) throw new RangeError('entryId does not fit uint32');
  if (k !== (tag >> 32n)) throw new RangeError(`kind ${k} is not the kind of epochTag ${tag} (${tag >> 32n})`);
  return (((((g << 8n) | k) << 64n) | tag) << 32n | seq) << 32n | id;
}

export function unpackTargetKey(key) {
  const k = toBig(key, 'key');
  if (k < 0n || k >= TARGET_LIMIT) throw new RangeError('not a packed target key');
  return {
    entryId: Number(k & 0xFFFFFFFFn),
    shardSeq: Number((k >> 32n) & 0xFFFFFFFFn),
    epochTag: (k >> 64n) & 0xFFFFFFFFFFFFFFFFn,
    kind: Number((k >> 128n) & 0xFFn),
    generation: Number((k >> 136n) & 0xFFn),
  };
}

/** The row key: the representation hash of the cell (target: uint144 ‖ partition_key: uint256). Mirrors ReportShard.rowKeyOf. */
export async function reportRowKeyOf(target, partitionKey) {
  const key = typeof target === 'bigint' ? target : targetKeyOf(target);
  const pk = toBig(partitionKey, 'partitionKey');
  if (pk <= 0n || pk >= (1n << 256n)) throw new RangeError('partitionKey must be the shard partition key');
  const cell = beginCell().uint(key, 144, 'target').uint(pk, 256, 'partition_key').endCell();
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBigUint(hash);
}

export const reportEraOf = (nowUnix) => Math.floor(Number(nowUnix) / REPORT_ERA_SECONDS);
export const reportBucketOf = (rowKey) => Number(toBig(rowKey, 'rowKey') % BigInt(REPORT_BUCKET_COUNT));

export async function reportShardAddressFor(era, bucket, generation = MODERATION_GENERATION) {
  return rawAddress(await reportShardAddressBytesFor(generation, era, bucket));
}

/** A raw 0:HEX wallet address as the 256-bit hash the sanction shards and the ledger carry. */
export function walletHashOf(address) {
  return BigInt(`0x${addrKey(address).split(':')[1]}`);
}
export const walletHashHex = (address) => walletHashOf(address).toString(16).padStart(64, '0');
export const sanctionBucketOf = (address) => Number(walletHashOf(address) % BigInt(SANCTION_BUCKET_COUNT));
export async function sanctionShardAddressFor(gateAddress, bucket, generation = MODERATION_GENERATION) {
  return rawAddress(await sanctionShardAddressBytesFor(generation, gateAddress, bucket));
}

// ── what the client addresses at all ──────────────────────────────────────────────────────────────────────────
/** The gate's address is the one config constant of the lane; the ledger is read FROM the gate (get_ledger). */
export function moderationGateAddress() {
  const configured = PLATHO_APP_CONFIG?.moderationGate?.address ?? null;
  if (!configured) return null;
  // RAW, ALWAYS [audit round 3]: the shard derivations hash this address through storeAddressArg, which takes
  // "workchain:hex" and NOTHING else — while every other address in platho-config is written in the friendly
  // form. A gate pasted as UQ... would make every sanction read and every verdict throw a RangeError from inside
  // the derivation instead of the lane simply reporting itself unavailable. Normalised here, once.
  try { return addrKey(configured); } catch { return null; }
}
/** All three halves must exist: the gate in the config, the report lane's cell and the sanction lane's cell in this build. */
export function moderationSupported() {
  return Boolean(moderationGateAddress()) && reportShardCodeAvailable(MODERATION_GENERATION) && sanctionShardCodeAvailable(MODERATION_GENERATION);
}

// ── messages ───────────────────────────────────────────────────────────────────────────────────────────────
const opBody = (op, build) => {
  const b = beginCell().uint(BigInt(op), 32, 'op');
  if (build) build(b);
  return bytesToBase64(serializeBoc(b.endCell()));
};
const storeMaybeAddress = (b, address, name) => {
  if (address === null || address === undefined) b.uint(0n, 2, `${name} addr_none`);
  else b.address(address, name);
  return b;
};

/**
 * The wallet message that reports `target` with `reason`, into the report shard of the current era and the row's
 * bucket. Carries the shard's StateInit (the first report of the era-bucket deploys it). `value` is what the
 * shard demands: read from a live shard's get_view (min_value for a fresh row at its fill, repeat_value for a row
 * already there — `reportShardPrices`), or REPORT_DEPLOY_VALUE for a shard not yet deployed. The squat cushion
 * is added by the funnel.
 */
export async function buildReportMessage({ target, reason, nowUnix, value, generation = MODERATION_GENERATION }) {
  const r = Number(reason);
  if (!Number.isInteger(r) || r < 0 || r >= REPORT_REASON_COUNT) throw new RangeError(`reason ${reason} is not one of 0..${REPORT_REASON_COUNT - 1}`);
  const key = targetKeyOf(target);
  const rowKey = await reportRowKeyOf(key, target.partitionKey);
  const era = reportEraOf(nowUnix);
  const bucket = reportBucketOf(rowKey);
  const to = await reportShardAddressFor(era, bucket, generation);
  const t = { generation: toBig(target.generation, 'generation'), kind: toBig(target.kind, 'kind'), epochTag: toBig(target.epochTag, 'epochTag'),
    shardSeq: toBig(target.shardSeq, 'shardSeq'), entryId: toBig(target.entryId, 'entryId'), partitionKey: toBig(target.partitionKey, 'partitionKey') };
  const amount = toBig(value ?? REPORT_DEPLOY_VALUE, 'value');
  const payload = opBody(REPORT_OP, (b) => {
    b.uint(t.generation, 8, 'generation').uint(t.kind, 8, 'kind').uint(t.epochTag, 64, 'epoch_tag')
      .uint(t.shardSeq, 32, 'shard_seq').uint(t.entryId, 32, 'entry_id').uint(BigInt(r), 8, 'reason').uint(t.partitionKey, 256, 'partition_key');
  });
  return {
    to, era, bucket, key, keyString: key.toString(), rowKey, rowKeyString: rowKey.toString(), value: amount, reason: r,
    message: { address: to, amount, payload, stateInit: reportShardStateInitFor(generation, era, bucket), bounce: true },
  };
}

/**
 * A moderator's verdict. Entry actions name the PublicShard (`shard`) and the entry; wallet actions the wallet's
 * account hash in `key` and no shard; a review names the ReportShard and the row key. `value` is the ledger's
 * published minimum for the action (get_view.*_min_value), plus whatever arrear the far shard carries.
 */
export function buildVerdictMessage(ledgerAddress, { action, reason = 0, shard = null, entryId = 0n, key = 0n, value }) {
  if (!ledgerAddress) throw new Error('buildVerdictMessage requires the ledger address');
  const a = Number(action);
  if (!Object.values(VERDICT_ACTION).includes(a)) throw new RangeError(`unknown verdict action ${action}`);
  const id = toBig(entryId, 'entryId'); const k = toBig(key, 'key');
  const entryAction = a <= VERDICT_ACTION.UNHIDE_ENTRY;
  const walletAction = (a >= VERDICT_ACTION.WARN_WALLET && a <= VERDICT_ACTION.UNRESTRICT_WALLET) || a === VERDICT_ACTION.UNWARN_WALLET;
  if (entryAction && !(shard && k === 0n)) throw new RangeError('an entry verdict names a shard and no key');
  if (walletAction && !(!shard && k > 0n && id === 0n)) throw new RangeError('a wallet verdict names a wallet hash and no shard');
  if (!entryAction && !walletAction && !(shard && k > 0n && id === 0n)) throw new RangeError('a review names a report shard and a row key');
  if (value === undefined || value === null) throw new RangeError('a verdict carries the value the ledger published for its action');
  const payload = opBody(LEDGER_OP.VERDICT, (b) => {
    b.uint(BigInt(a), 8, 'action').uint(BigInt(Number(reason)), 8, 'reason');
    storeMaybeAddress(b, shard, 'shard');
    b.uint(id, 32, 'entry_id').uint(k, 256, 'key');
  });
  return { address: ledgerAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

export function buildProposeMessage(ledgerAddress, { kind, a, b = a, value = LEDGER_COUNCIL_VALUE }) {
  const k = Number(kind);
  if (!Object.values(COUNCIL_KIND).includes(k)) throw new RangeError(`unknown council kind ${kind}`);
  const payload = opBody(LEDGER_OP.PROPOSE, (x) => { x.uint(BigInt(k), 8, 'kind').address(a, 'a').address(b, 'b'); });
  return { address: ledgerAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

/** The second vote names what it seconds — kind, a, b as read from get_proposal — so a swapped slot is refused (29046). */
export function buildApproveMessage(ledgerAddress, { proposer, kind, a, b = a, value = LEDGER_COUNCIL_VALUE }) {
  const k = Number(kind);
  if (!Object.values(COUNCIL_KIND).includes(k)) throw new RangeError(`unknown council kind ${kind}`);
  const payload = opBody(LEDGER_OP.APPROVE, (x) => { x.address(proposer, 'proposer').uint(BigInt(k), 8, 'kind').address(a, 'a').address(b, 'b'); });
  return { address: ledgerAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

/** The gate's seating message: the deployer seats the first ledger (the console), the ledger hands over (SET_LEDGER). */
export function buildSetLedgerMessage(gateAddress, { ledger, value = 50_000_000n }) {
  const payload = opBody(GATE_OP.SET_LEDGER, (x) => { x.address(ledger, 'ledger'); });
  return { address: gateAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

/** A list cell of wallet hashes, three per cell, chained by the first ref, tail first — what get_many and PruneWallets walk. */
export function walletListCell(hashes) {
  let cell = null;
  for (let start = hashes.length - (hashes.length % 3 || 3); start >= 0; start -= 3) {
    const b = beginCell();
    for (const h of hashes.slice(start, start + 3)) b.uint(toBig(h, 'wallet'), 256, 'wallet');
    if (cell) b.ref(cell);
    cell = b.endCell();
  }
  return cell;
}

/** Name up to 32 stale leaves of one bucket shard; each that is really past the retention is dropped for the bounty. */
export function buildPruneWalletsMessage(shardAddress, hashes, { value = 50_000_000n } = {}) {
  if (!Array.isArray(hashes) || hashes.length === 0 || hashes.length > 32) throw new RangeError('a prune names 1..32 wallets');
  const payload = opBody(SANCTION_OP.PRUNE, (b) => { b.ref(walletListCell(hashes)); });
  return { address: shardAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

// ── decoding ──────────────────────────────────────────────────────────────────────────────────────────────
/** An AddressList (3 addresses per cell, chained): raw 0:HEX strings. Also decodes ONE stored Address cell. */
export function decodeAddressList(listCell, count) {
  const out = [];
  let cell = listCell;
  while (cell && out.length < count) {
    const reader = cellReader(cell);
    while (reader.remaining() >= 267 && out.length < count) {
      reader.loadUint(3);
      const workchain = Number(reader.loadUint(8));
      const hash = reader.loadUint(256).toString(16).padStart(64, '0');
      out.push(`${workchain > 127 ? workchain - 256 : workchain}:${hash}`);
    }
    cell = reader.refs() > 0 ? reader.loadRef() : null;
  }
  return out;
}
const readAddress = (stack, i, name) => {
  const cell = readCell(stack, i);
  if (!cell) return null;
  const reader = cellReader(cell);
  if (reader.remaining() < 267) return null;          // addr_none
  return decodeAddressList(cell, 1)[0] ?? null;
};
void readAddress;

export function decodeLedgerView(result) {
  const stack = extractStack(result);
  if (stack.length !== 10) throw new Error(`get_view: expected 10 stack items, got ${stack.length}`);
  const names = ['root_count', 'moderator_count', 'threshold', 'proposal_ttl', 'verdicts_per_day', 'entry_min_value', 'wallet_min_value',
    'review_min_value', 'council_min_value'];
  const view = {};
  names.forEach((name, i) => { view[name] = readInt(stack, i, name); });
  view.gate = decodeAddressList(readCell(stack, 9), 1)[0] ?? null;
  return view;
}

export function decodeAddressListResult(result) {
  const stack = extractStack(result);
  if (stack.length !== 2) throw new Error(`address list: expected 2 stack items, got ${stack.length}`);
  const count = Number(readInt(stack, 0, 'count'));
  return decodeAddressList(readCell(stack, 1), count);
}

/** get_proposal: { exists, kind, a, b, createdAt, expiresAt }. */
export function decodeProposal(result) {
  const stack = extractStack(result);
  if (stack.length !== 6) throw new Error(`get_proposal: expected 6 stack items, got ${stack.length}`);
  return {
    exists: readInt(stack, 0, 'exists') !== 0n, kind: Number(readInt(stack, 1, 'kind')),
    a: decodeAddressList(readCell(stack, 2), 1)[0] ?? null, b: decodeAddressList(readCell(stack, 3), 1)[0] ?? null,
    createdAt: Number(readInt(stack, 4, 'created_at')), expiresAt: Number(readInt(stack, 5, 'expires_at')),
  };
}

/** The gate's get_ledger: a raw address, or null while nothing is seated. */
export function decodeGateLedger(result) {
  const stack = extractStack(result);
  if (stack.length !== 1) throw new Error(`get_ledger: expected 1 stack item, got ${stack.length}`);
  const item = stack[0];
  if (!item || item.type === 'null') return null;
  const cell = readCell(stack, 0);
  if (!cell) return null;
  const reader = cellReader(cell);
  if (reader.remaining() < 267) return null;
  return decodeAddressList(cell, 1)[0] ?? null;
}

/** One report shard's rows: target 256 | partition_key 256 | count 32 | reviewed_count 32 | reasons 16 | first_at 32 | last_at 32, one per cell, chained. */
export const REPORT_ROW_BITS = 656;
export function decodeReportPage(result) {
  const stack = extractStack(result);
  if (stack.length !== 4) throw new Error(`get_page: expected 4 stack items, got ${stack.length}`);
  const fromSlot = Number(readInt(stack, 0, 'from_slot'));
  const count = Number(readInt(stack, 1, 'count'));
  const targetCount = Number(readInt(stack, 2, 'target_count'));
  const rows = [];
  let reader = readCell(stack, 3) ? cellReader(readCell(stack, 3)) : null;
  for (let i = 0; i < count && reader; i += 1) {
    if (reader.remaining() < REPORT_ROW_BITS && reader.refs() > 0) reader = cellReader(reader.loadRef());
    if (reader.remaining() < REPORT_ROW_BITS) break;
    const key = reader.loadUint(256);
    const partitionKey = reader.loadUint(256);
    rows.push({ key, keyString: key.toString(), target: unpackTargetKey(key), partitionKey, count: Number(reader.loadUint(32)),
      reviewedCount: Number(reader.loadUint(32)), reasons: Number(reader.loadUint(16)), firstAt: Number(reader.loadUint(32)), lastAt: Number(reader.loadUint(32)) });
  }
  return { fromSlot, count, targetCount, rows };
}

/** ReportShard get_view: the prices a report must bring at the shard's CURRENT fill. */
export function decodeReportShardView(result) {
  const stack = extractStack(result);
  if (stack.length !== 12) throw new Error(`report get_view: expected 12 stack items, got ${stack.length}`);
  const names = ['era', 'bucket', 'target_count', 'safe_cap', 'report_fee', 'min_value', 'ladder_premium', 'repeat_value', 'deploy_min_value', 'retire_at'];
  const view = {};
  names.forEach((name, i) => { view[name] = readInt(stack, i, name); });
  return view;
}

/** SanctionShard get_many: [{ restricted, warnings }] in the order asked. */
export function decodeSanctionMany(result) {
  const stack = extractStack(result);
  if (stack.length !== 1) throw new Error(`get_many: expected 1 stack item, got ${stack.length}`);
  const cell = readCell(stack, 0);
  if (!cell) return [];
  const reader = cellReader(cell);
  const n = Number(reader.loadUint(8));
  const out = [];
  for (let i = 0; i < n && reader.remaining() >= 9; i += 1) {
    out.push({ restricted: reader.loadUint(1) === 1n, warnings: Number(reader.loadUint(8)) });
  }
  return out;
}

/** SanctionShard get_wallet: { exists, warnings, restricted, auto, since, reason, updatedAt } — `auto` says the third warning set the restriction. */
export function decodeSanctionWallet(result) {
  const stack = extractStack(result);
  if (stack.length !== 7) throw new Error(`get_wallet: expected 7 stack items, got ${stack.length}`);
  return {
    exists: readInt(stack, 0, 'exists') !== 0n, warnings: Number(readInt(stack, 1, 'warnings')), restricted: readInt(stack, 2, 'restricted') !== 0n,
    auto: readInt(stack, 3, 'auto') !== 0n, since: Number(readInt(stack, 4, 'since')), reason: Number(readInt(stack, 5, 'reason')), updatedAt: Number(readInt(stack, 6, 'updated_at')),
  };
}

const isUninitExit = (code) => Number(code) === -13 || Number(code) === -256;
const isUninitError = (error) => isUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);

/** One getter call through the app's pump. Null means "no contract there" (uninit), never "no data". */
export async function callGetter(runGetMethod, address, method, stack = []) {
  let raw;
  try {
    raw = await runGetMethod({ address: toWireAddress(address), method, stack });
  } catch (error) {
    if (isUninitError(error)) return null;
    throw error;
  }
  if (!raw) return null;
  const exitCode = raw.exit_code ?? raw.exitCode;
  if (exitCode !== undefined && Number(exitCode) !== 0) {
    if (isUninitExit(exitCode)) return null;
    throw new Error(`${method} exited ${exitCode}`);
  }
  return raw;
}
const num = (v) => ({ type: 'num', value: `0x${BigInt(v).toString(16)}` });
const sliceArg = (address) => ({ type: 'slice', value: bytesToBase64(serializeBoc(beginCell().address(address, 'address').endCell())) });

/** The ledger reader: null answers mean "no contract at that address", never "no data". */
export function createModerationLedgerReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createModerationLedgerReader requires runGetMethod');
  return {
    /** The gate's current ledger, or null while none is seated (or no gate is there). */
    ledgerOf: async (gateAddress) => { const raw = await callGetter(runGetMethod, gateAddress, 'get_ledger'); return raw ? decodeGateLedger(raw) : null; },
    view: async (address) => { const raw = await callGetter(runGetMethod, address, 'get_view'); return raw ? decodeLedgerView(raw) : null; },
    isModerator: async (address, wallet) => {
      const raw = await callGetter(runGetMethod, address, 'is_moderator', [sliceArg(wallet)]);
      return raw ? readInt(extractStack(raw), 0, 'is_moderator') !== 0n : false;
    },
    moderators: async (address) => {
      const out = [];
      for (let from = 0; from < 4096; from += 48) {
        const raw = await callGetter(runGetMethod, address, 'get_moderators', [num(from), num(48)]);
        if (!raw) return null;
        const batch = decodeAddressListResult(raw);
        out.push(...batch);
        if (batch.length < 48) break;
      }
      return out;
    },
    roots: async (address) => { const raw = await callGetter(runGetMethod, address, 'get_roots'); return raw ? decodeAddressListResult(raw) : null; },
    proposal: async (address, proposer) => { const raw = await callGetter(runGetMethod, address, 'get_proposal', [sliceArg(proposer)]); return raw ? decodeProposal(raw) : null; },
    reportShardView: async (address) => { const raw = await callGetter(runGetMethod, address, 'get_view'); return raw ? decodeReportShardView(raw) : null; },
  };
}

/** What a report into `shardAddress` must bring: the shard's own prices when it is live, the deploy figure when not. */
export async function reportShardPrices(runGetMethod, shardAddress) {
  const raw = await callGetter(runGetMethod, shardAddress, 'get_view');
  if (!raw) return { live: false, deployMinValue: REPORT_DEPLOY_VALUE, minValue: REPORT_DEPLOY_VALUE, repeatValue: REPORT_DEPLOY_VALUE, targetCount: 0 };
  const v = decodeReportShardView(raw);
  return {
    live: true, deployMinValue: v.deploy_min_value, minValue: v.min_value, ladderPremium: v.ladder_premium, repeatValue: v.repeat_value,
    targetCount: Number(v.target_count),
    // a fresh row past this is refused at 13808 — the client says so before signing [audit 2026-09-05, round 2]
    safeCap: Number(v.safe_cap ?? 0),
  };
}

/** What a report must bring: the deploy figure until the shard holds a row (the contract demands it while
 *  target_count == 0, deployed or not), the shard's own fresh-row price after — and for a row that is ALREADY
 *  there, the flat repeat figure, which is what the contract charges (no endowment, no ladder premium). */
export const reportAttachValue = (prices, repeat = false) => {
  if (repeat && prices.live && prices.repeatValue) return prices.repeatValue;
  return prices.live && prices.targetCount > 0 ? prices.minValue : prices.deployMinValue;
};

// ── the sanction cache: what the surfaces read for an author ──────────────────────────────────────────────────
/**
 * A wallet's standing, cached for `ttlMs`, read in batches of up to SANCTION_MANY_CAP per bucket shard with ONE
 * getter call per bucket. `lookup(addresses)` fills the cache for whatever is stale; `get(address)` is synchronous
 * and answers from the cache (null = never read). A bucket shard that is not deployed answers "clear" for all.
 */
/**
 * How full a SanctionShard is: a fresh leaf into a shard at SS_SAFE_CAP is refused (29206) AFTER the ledger and the
 * gate have taken their legs — the forward strands in the gate (the MG-03 class). Read before a WARN or RESTRICT
 * of a wallet that has no leaf yet [audit 2026-09-06, round 3]. `live` false: no shard there yet (room for all).
 */
export async function sanctionShardRoom(runGetMethod, shardAddress) {
  const raw = await callGetter(runGetMethod, shardAddress, 'get_view', []);
  if (!raw) return { live: false, count: 0, safeCap: 0 };
  const stack = extractStack(raw);
  return { live: true, count: Number(readInt(stack, 1, 'count')), safeCap: Number(readInt(stack, 2, 'safe_cap')) };
}

export function createSanctionCache({ runGetMethod, gateAddress, generation = MODERATION_GENERATION, ttlMs = 600_000, now = () => Date.now() }) {
  if (typeof runGetMethod !== 'function') throw new Error('createSanctionCache requires runGetMethod');
  const entries = new Map();   // addrKey -> { restricted, warnings, readAt }
  const shardAddresses = new Map();
  const shardOf = async (bucket) => {
    if (!shardAddresses.has(bucket)) shardAddresses.set(bucket, await sanctionShardAddressFor(gateAddress, bucket, generation));
    return shardAddresses.get(bucket);
  };
  const listCell = walletListCell;
  return {
    get: (address) => (address ? (entries.get(addrKey(address)) ?? null) : null),
    isRestricted: (address) => Boolean(address && entries.get(addrKey(address))?.restricted),
    warningsOf: (address) => (address ? (entries.get(addrKey(address))?.warnings ?? 0) : 0),
    invalidate: (address) => { if (address) entries.delete(addrKey(address)); },
    async lookup(addresses, { force = false } = {}) {
      if (!gateAddress) return;
      const t = now();
      const byBucket = new Map();
      for (const a of addresses ?? []) {
        if (!a) continue;
        const key = addrKey(a);
        const have = entries.get(key);
        if (!force && have && t - have.readAt < ttlMs) continue;
        const bucket = sanctionBucketOf(a);
        if (!byBucket.has(bucket)) byBucket.set(bucket, new Map());
        byBucket.get(bucket).set(key, walletHashOf(a));
      }
      for (const [bucket, wallets] of byBucket) {
        const shard = await shardOf(bucket);
        const keys = [...wallets.keys()];
        for (let start = 0; start < keys.length; start += SANCTION_MANY_CAP) {
          const chunk = keys.slice(start, start + SANCTION_MANY_CAP);
          const cell = listCell(chunk.map((k) => wallets.get(k)));
          let answers;
          try {
            const raw = await callGetter(runGetMethod, shard, 'get_many', [{ type: 'cell', value: bytesToBase64(serializeBoc(cell)) }]);
            answers = raw ? decodeSanctionMany(raw) : chunk.map(() => ({ restricted: false, warnings: 0 }));
            // a short answer is a broken read, never "clear": the last answers stay for those wallets
            if (answers.length !== chunk.length) throw new Error(`get_many answered ${answers.length} of ${chunk.length}`);
          } catch (error) {
            console.warn('[moderation] sanction bucket read failed; the last answers stay', bucket, error);
            continue;
          }
          chunk.forEach((k, i) => { entries.set(k, { restricted: answers[i].restricted === true, warnings: answers[i].warnings ?? 0, readAt: t }); });
        }
      }
    },
    size: () => entries.size,
  };
}

// ── the moderators' queue ──────────────────────────────────────────────────────────────────────────────────────
/**
 * Sweep the report shards of one era: 64 addresses in one accountStates batch, then pages from the live ones.
 * `readStates(addresses) -> Map(addrKey -> { status })` is the app's batch reader; `runGetMethod` its pump.
 * Rows sort by what arrived SINCE a moderator last looked (count - reviewedCount), then by count.
 */
export function createReportQueueReader({ readStates, runGetMethod, generation = MODERATION_GENERATION }) {
  return async function sweep(era) {
    const addresses = [];
    for (let bucket = 0; bucket < REPORT_BUCKET_COUNT; bucket += 1) addresses.push(await reportShardAddressFor(era, bucket, generation));
    const states = await readStates(addresses);
    const queue = [];
    for (let bucket = 0; bucket < REPORT_BUCKET_COUNT; bucket += 1) {
      const address = addresses[bucket];
      const state = states.get(addrKey(address));
      if (!state || state.status !== 'active') continue;
      for (let from = 0; from < 8192; from += 96) {
        const raw = await callGetter(runGetMethod, address, 'get_page', [num(from), num(96)]);
        if (!raw) break;
        const page = decodeReportPage(raw);
        for (const row of page.rows) {
          // the page carries target and partition key; the ROW key (what a review mark names) is their hash
          const rowKey = await reportRowKeyOf(row.key, row.partitionKey);
          queue.push({ ...row, rowKey, rowKeyString: rowKey.toString(), unreviewed: row.count - row.reviewedCount, era, bucket, shard: address });
        }
        if (from + page.count >= page.targetCount || page.count === 0) break;
      }
    }
    queue.sort((a, b) => b.unreviewed - a.unreviewed || b.count - a.count || b.lastAt - a.lastAt);
    return queue;
  };
}

/**
 * The entry a report names, read from the PublicShard the partition key derives: `get_entry` gives the publisher
 * (the wallet a wallet verdict names), the body commitment, the time and — on clean-18 shards — the hidden bit.
 * Null when the shard or the entry is not there.
 */
export async function readPublicEntry({ runGetMethod, generation, partitionKey, epochTag, entryId }) {
  const shard = rawAddress(await publicShardAddressBytesFor(Number(generation), toBig(partitionKey, 'partitionKey'), toBig(epochTag, 'epochTag')));
  const raw = await callGetter(runGetMethod, shard, 'get_entry', [num(toBig(entryId, 'entryId'))]);
  if (!raw) return null;
  const stack = extractStack(raw);
  if (stack.length !== 4 && stack.length !== 5) throw new Error(`get_entry: expected 4 or 5 stack items, got ${stack.length}`);
  const exists = readInt(stack, 0, 'exists') !== 0n;
  const publisherCell = readCell(stack, 1);
  const publisher = publisherCell ? (decodeAddressList(publisherCell, 1)[0] ?? null) : null;
  return {
    shard, exists, publisher: exists ? publisher : null, bodyCommit: readInt(stack, 2, 'body_commit'), createdAt: Number(readInt(stack, 3, 'created_at')),
    hidden: stack.length === 5 ? readInt(stack, 4, 'hidden') !== 0n : false,
  };
}

// ── the local mute: a device's own silence, no chain ─────────────────────────────────────────────────────────
export const LOCAL_MUTE_STORAGE_KEY = 'platho.moderation.mute.v1';
export function createLocalMuteStore(storage = globalThis.localStorage ?? null) {
  let cache = null;
  const load = () => {
    if (cache) return cache;
    cache = new Set();
    try {
      const raw = storage?.getItem?.(LOCAL_MUTE_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) for (const a of list) if (typeof a === 'string') cache.add(addrKey(a));
    } catch { /* an unreadable store is an empty one */ }
    return cache;
  };
  const save = () => { try { storage?.setItem?.(LOCAL_MUTE_STORAGE_KEY, JSON.stringify([...load()])); } catch { /* ignore */ } };
  return {
    has: (address) => Boolean(address && load().has(addrKey(address))),
    add: (address) => { load().add(addrKey(address)); save(); },
    remove: (address) => { load().delete(addrKey(address)); save(); },
    list: () => [...load()],
  };
}
