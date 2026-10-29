
import { addrKey } from './shard-discovery.mjs?v=103';
import { beginCell, bytesToBase64, serializeBoc, computeCellHashAndDepth, bytesToBigUint, parseBocBase64 } from './pwa-contract-transactions.mjs?v=59';
import {
  reportShardAddressBytesFor, reportShardStateInitFor, reportShardCodeAvailable, sanctionShardAddressBytesFor, sanctionShardCodeAvailable,
  publicShardAddressBytesFor, rawAddress,
} from './shard-address.mjs?v=47';
import { readInt, readCell, cellReader, extractStack } from './public-shard-ton-rpc-provider.mjs?v=44';
import { toWireAddress } from './shard-reader.mjs?v=108';
import { PLATHO_APP_CONFIG } from './platho-config.mjs?v=175';

export const REPORT_ERA_SECONDS = 2_592_000;
export const REPORT_BUCKET_COUNT = 64;
export const REPORT_REASON_COUNT = 8;
export const REPORT_FEE = 5_000_000n;
export const REPORT_DEPLOY_VALUE = 12_350_000n;
export const REPORT_OP = 0x4D525231;
export const LEDGER_OP = Object.freeze({ PROPOSE: 0x4D4C5031, APPROVE: 0x4D4C4131, VERDICT: 0x4D4C5631 });
export const GATE_OP = Object.freeze({ SET_LEDGER: 0x4D475331 });
export const SANCTION_OP = Object.freeze({ RETIRE: 0x4D535258 });
export const LEDGER_COUNCIL_VALUE = 3_000_000n;
export const COUNCIL_KIND = Object.freeze({ REPLACE_ROOT: 1, ADD_MODERATOR: 2, REMOVE_MODERATOR: 3, SET_LEDGER: 4, SWEEP_GATE: 5, ACCEPT_GATE: 6, WITHDRAW: 7 });
export const VERDICT_ACTION = Object.freeze({ HIDE_ENTRY: 1, UNHIDE_ENTRY: 2, WARN_WALLET: 3, RESTRICT_WALLET: 4, UNRESTRICT_WALLET: 5, REVIEW_REPORT: 6, UNWARN_WALLET: 7 });
export const WARNINGS_TO_RESTRICT = 3;
export const SANCTION_RETENTION_SECONDS = 31_536_000;
export const REPORT_REASONS = Object.freeze(['spam', 'illegal', 'harassment', 'scam', 'violence', 'sexual', 'impersonation', 'other']);
export const MODERATION_GENERATION = 18;

const TARGET_LIMIT = 1n << 144n;
const toBig = (v, name) => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return BigInt(v.trim());
  throw new TypeError(`${name} must be an integer, got ${typeof v}`);
};

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

export function walletHashOf(address) {
  return BigInt(`0x${addrKey(address).split(':')[1]}`);
}
export const walletHashHex = (address) => walletHashOf(address).toString(16).padStart(64, '0');
export const walletAddressOfHash = (hash) => `0:${toBig(hash, 'walletHash').toString(16).padStart(64, '0')}`;

export async function sanctionShardAddressFor(gateAddress, walletHash, generation = MODERATION_GENERATION) {
  return rawAddress(await sanctionShardAddressBytesFor(generation, gateAddress, toBig(walletHash, 'walletHash')));
}

export function moderationGateAddress() {
  const configured = PLATHO_APP_CONFIG?.moderationGate?.address ?? null;
  if (!configured) return null;
  try { return addrKey(configured); } catch { return null; }
}
export function moderationTrustedLedgers() {
  const listed = PLATHO_APP_CONFIG?.moderationGate?.ledgers;
  const out = new Set();
  for (const ledger of Array.isArray(listed) ? listed : []) {
    try { out.add(addrKey(ledger)); } catch { }
  }
  return out;
}
export function moderationLedgerTrusted(ledgerAddress) {
  if (!ledgerAddress) return false;
  try { return moderationTrustedLedgers().has(addrKey(ledgerAddress)); } catch { return false; }
}

export function moderationSupported() {
  return Boolean(moderationGateAddress()) && reportShardCodeAvailable(MODERATION_GENERATION) && sanctionShardCodeAvailable(MODERATION_GENERATION);
}

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

const VERDICT_REFERENCE_GAS = Object.freeze({ flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n });
const VERDICT_REFERENCE_FWD = Object.freeze({ lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n });
export const VERDICT_GATE_GAS_UNITS = 8_300n;
export const VERDICT_GATE_FORWARD_AT_REFERENCE = Object.freeze({ entry: 100_000n, wallet: 770_000n, review: 115_000n });
export const VERDICT_FAR_GAS_UNITS = Object.freeze({ entry: 87_000n, wallet: 15_000n, review: 31_500n });
export const VERDICT_FAR_CHANGE_FORWARD_AT_REFERENCE = 70_000n;

export const LEDGER_VERDICT_GAS_UNITS = 50_000n;
export const LEDGER_RELAY_FWD_CELLS = 22n;
export const LEDGER_RELAY_FWD_BITS = 11_000n;
export const LEDGER_VERDICT_FORWARD = Object.freeze({ entry: 10_450_000n, wallet: 4_500_000n, review: 3_300_000n });

export function verdictLaneOf(action) {
  const a = Number(action);
  if (a === VERDICT_ACTION.HIDE_ENTRY || a === VERDICT_ACTION.UNHIDE_ENTRY) return 'entry';
  if (a === VERDICT_ACTION.REVIEW_REPORT) return 'review';
  if (Object.values(VERDICT_ACTION).includes(a)) return 'wallet';
  throw new RangeError(`unknown verdict action ${action}`);
}

function verdictGasFee(units, gas) {
  return units <= gas.flatLimit ? gas.flatPrice : gas.flatPrice + ((units - gas.flatLimit) * gas.gasPrice + 65_535n) / 65_536n;
}
function verdictForwardAt(value, fwd) {
  let out = value;
  for (const key of ['lump', 'bit', 'cell']) {
    const ref = VERDICT_REFERENCE_FWD[key];
    const scaled = (value * toBig(fwd[key], `fwd.${key}`) + ref - 1n) / ref;
    if (scaled > out) out = scaled;
  }
  return out;
}

export function verdictLiveSurchargeNanotons(action, prices = null) {
  const lane = verdictLaneOf(action);
  if (!prices?.gas && !prices?.fwd) return 0n;
  const gas = { ...VERDICT_REFERENCE_GAS, ...(prices.gas ?? {}) };
  const fwd = { ...VERDICT_REFERENCE_FWD, ...(prices.fwd ?? {}) };
  const positive = (n) => (n > 0n ? n : 0n);
  const gate = positive(verdictGasFee(VERDICT_GATE_GAS_UNITS, gas) - verdictGasFee(VERDICT_GATE_GAS_UNITS, VERDICT_REFERENCE_GAS));
  const carriage = verdictForwardAt(VERDICT_GATE_FORWARD_AT_REFERENCE[lane], fwd) - VERDICT_GATE_FORWARD_AT_REFERENCE[lane];
  const far = positive(verdictGasFee(VERDICT_FAR_GAS_UNITS[lane], gas) - verdictGasFee(VERDICT_FAR_GAS_UNITS[lane], VERDICT_REFERENCE_GAS));
  const change = verdictForwardAt(VERDICT_FAR_CHANGE_FORWARD_AT_REFERENCE, fwd) - VERDICT_FAR_CHANGE_FORWARD_AT_REFERENCE;
  return gate + carriage + far + change;
}

export function verdictMinimumCeiling(action, ratio = 10n) {
  const lane = verdictLaneOf(action);
  const r = toBig(ratio, 'ratio');
  const gas = { flatLimit: VERDICT_REFERENCE_GAS.flatLimit, flatPrice: VERDICT_REFERENCE_GAS.flatPrice * r, gasPrice: VERDICT_REFERENCE_GAS.gasPrice * r };
  const relay = VERDICT_REFERENCE_FWD.lump * r
    + (VERDICT_REFERENCE_FWD.bit * r * LEDGER_RELAY_FWD_BITS + VERDICT_REFERENCE_FWD.cell * r * LEDGER_RELAY_FWD_CELLS + 65_535n) / 65_536n;
  return verdictGasFee(LEDGER_VERDICT_GAS_UNITS, gas) + relay + LEDGER_VERDICT_FORWARD[lane];
}

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

export function buildApproveMessage(ledgerAddress, { proposer, kind, a, b = a, value = LEDGER_COUNCIL_VALUE }) {
  const k = Number(kind);
  if (!Object.values(COUNCIL_KIND).includes(k)) throw new RangeError(`unknown council kind ${kind}`);
  const payload = opBody(LEDGER_OP.APPROVE, (x) => { x.address(proposer, 'proposer').uint(BigInt(k), 8, 'kind').address(a, 'a').address(b, 'b'); });
  return { address: ledgerAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

export function buildSetLedgerMessage(gateAddress, { ledger, value = 50_000_000n }) {
  const payload = opBody(GATE_OP.SET_LEDGER, (x) => { x.address(ledger, 'ledger'); });
  return { address: gateAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

export function buildRetireSanctionMessage(shardAddress, { value }) {
  if (value === undefined || value === null) throw new RangeError('a retire carries at least the shard\'s SS_RETIRE_GAS');
  const payload = opBody(SANCTION_OP.RETIRE, () => {});
  return { address: shardAddress, amount: toBig(value, 'value'), payload, stateInit: null, bounce: true };
}

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
  if (reader.remaining() < 267) return null;
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

export function decodeProposal(result) {
  const stack = extractStack(result);
  if (stack.length !== 7) throw new Error(`get_proposal: expected 7 stack items, got ${stack.length}`);
  return {
    exists: readInt(stack, 0, 'exists') !== 0n, kind: Number(readInt(stack, 1, 'kind')),
    a: decodeAddressList(readCell(stack, 2), 1)[0] ?? null, b: decodeAddressList(readCell(stack, 3), 1)[0] ?? null,
    createdAt: Number(readInt(stack, 4, 'created_at')), expiresAt: Number(readInt(stack, 5, 'expires_at')),
    secondedBy: decodeAddressList(readCell(stack, 6), 1)[0] ?? null,
  };
}

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

export function decodeReportShardView(result) {
  const stack = extractStack(result);
  if (stack.length !== 12) throw new Error(`report get_view: expected 12 stack items, got ${stack.length}`);
  const names = ['era', 'bucket', 'target_count', 'safe_cap', 'report_fee', 'min_value', 'ladder_premium', 'repeat_value', 'deploy_min_value', 'retire_at'];
  const view = {};
  names.forEach((name, i) => { view[name] = readInt(stack, i, name); });
  return view;
}

export function decodeSanctionView(result) {
  const stack = extractStack(result);
  if (stack.length !== 13) throw new Error(`sanction get_view: expected 13 stack items, got ${stack.length}`);
  return {
    exists: readInt(stack, 0, 'exists') !== 0n, wallet: readInt(stack, 1, 'wallet'), warnings: Number(readInt(stack, 2, 'warnings')),
    restricted: readInt(stack, 3, 'restricted') !== 0n, auto: readInt(stack, 4, 'auto') !== 0n, since: Number(readInt(stack, 5, 'since')),
    reason: Number(readInt(stack, 6, 'reason')), updatedAt: Number(readInt(stack, 7, 'updated_at')), retention: Number(readInt(stack, 8, 'retention')),
    minValue: readInt(stack, 9, 'min_value'), liftValue: readInt(stack, 10, 'lift_value'), retireAt: Number(readInt(stack, 11, 'retire_at')),
  };
}

const CLEAR_STANDING = Object.freeze({ exists: false, wallet: 0n, warnings: 0, restricted: false, auto: false, since: 0, reason: 0, updatedAt: 0 });
export function parseSanctionAccountData(dataBoc) {
  const cell = typeof dataBoc === 'string' ? parseBocBase64(dataBoc) : dataBoc;
  const reader = cellReader(cell);
  if (reader.remaining() < 1) throw new Error('sanction account data is empty');
  if (reader.loadUint(1) === 0n) return { ...CLEAR_STANDING };
  if (reader.remaining() < 267 + 256 + 8 + 1 + 1 + 32 + 8 + 32) throw new Error(`sanction account data is ${reader.remaining() + 1} bits, expected 606`);
  reader.loadUint(3); reader.loadUint(8); reader.loadUint(256);
  const wallet = reader.loadUint(256);
  const warnings = Number(reader.loadUint(8));
  const restricted = reader.loadUint(1) === 1n;
  const auto = reader.loadUint(1) === 1n;
  const since = Number(reader.loadUint(32));
  const reason = Number(reader.loadUint(8));
  const updatedAt = Number(reader.loadUint(32));
  return { exists: updatedAt > 0, wallet, warnings, restricted, auto, since, reason, updatedAt };
}

export function sanctionStandingFromState(row) {
  if (!row || row.status !== 'active') return { ...CLEAR_STANDING };
  if (!row.dataBoc) return null;
  return parseSanctionAccountData(row.dataBoc);
}

const isUninitExit = (code) => Number(code) === -13 || Number(code) === -256;
const isUninitError = (error) => isUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);

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

export function createModerationLedgerReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createModerationLedgerReader requires runGetMethod');
  return {
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

export async function reportShardPrices(runGetMethod, shardAddress) {
  const raw = await callGetter(runGetMethod, shardAddress, 'get_view');
  if (!raw) return { live: false, deployMinValue: REPORT_DEPLOY_VALUE, minValue: REPORT_DEPLOY_VALUE, repeatValue: REPORT_DEPLOY_VALUE, targetCount: 0 };
  const v = decodeReportShardView(raw);
  return {
    live: true, deployMinValue: v.deploy_min_value, minValue: v.min_value, ladderPremium: v.ladder_premium, repeatValue: v.repeat_value,
    targetCount: Number(v.target_count),
    safeCap: Number(v.safe_cap ?? 0),
  };
}

export const reportAttachValue = (prices, repeat = false) => {
  if (repeat && prices.live && prices.repeatValue) return prices.repeatValue;
  return prices.live && prices.targetCount > 0 ? prices.minValue : prices.deployMinValue;
};

export const SANCTION_STANDING_TTL_MS = 3_600_000;

export function sanctionStandingForVerdict(standing, nowSec) {
  if (!standing) return standing;
  const at = Number(standing.updatedAt ?? 0) > 0 ? Number(standing.updatedAt) + SANCTION_RETENTION_SECONDS : 0;
  return at > 0 && Number(nowSec) > at ? { ...standing, exists: false, warnings: 0, restricted: false } : standing;
}

export function createSanctionCache({ readStates, gateAddress, generation = MODERATION_GENERATION, ttlMs = SANCTION_STANDING_TTL_MS, now = () => Date.now() }) {
  if (typeof readStates !== 'function') throw new Error('createSanctionCache requires readStates');
  const entries = new Map();
  const accountOf = new Map();
  const accountFor = async (key, address) => {
    if (!accountOf.has(key)) accountOf.set(key, await sanctionShardAddressFor(gateAddress, walletHashOf(address), generation));
    return accountOf.get(key);
  };
  const normal = (e, readAt) => ({ exists: e.exists === true, restricted: e.restricted === true, auto: e.auto === true, warnings: Number(e.warnings ?? 0),
    updatedAt: Number(e.updatedAt ?? 0), readAt: Number(readAt ?? 0) });
  const held = (address) => (address ? (entries.get(addrKey(address)) ?? null) : null);
  const spentAt = (e) => (e && e.updatedAt > 0 ? e.updatedAt + SANCTION_RETENTION_SECONDS : 0);
  const spent = (e) => { const at = spentAt(e); return at > 0 && Math.floor(now() / 1000) > at; };
  return {
    get: (address) => held(address),
    isRestricted: (address) => { const e = held(address); return e?.restricted === true && !spent(e); },
    warningsOf: (address) => { const e = held(address); return e && !spent(e) ? e.warnings : 0; },
    spentAt: (address) => spentAt(held(address)),
    invalidate: (address) => { if (address) entries.delete(addrKey(address)); },
    accountOf: (address) => (address ? accountOf.get(addrKey(address)) ?? null : null),
    entries: () => [...entries.entries()].map(([k, e]) => [k, { ...e }]),
    seed(list) {
      let taken = 0;
      for (const [address, entry] of list ?? []) {
        if (!address || !entry) continue;
        const key = addrKey(address);
        const have = entries.get(key);
        if (have && have.readAt >= Number(entry.readAt ?? 0)) continue;
        entries.set(key, normal(entry, entry.readAt));
        taken += 1;
      }
      return taken;
    },
    async lookup(addresses, { force = false, requestClass = null } = {}) {
      const result = { asked: 0, read: 0, changed: false };
      if (!gateAddress) return result;
      const t = now();
      const wanted = new Map();
      for (const a of addresses ?? []) {
        if (!a) continue;
        const key = addrKey(a);
        const have = entries.get(key);
        if (!force && have && t - have.readAt < ttlMs) continue;
        wanted.set(addrKey(await accountFor(key, a)), key);
      }
      result.asked = wanted.size;
      if (wanted.size === 0) return result;
      let rows;
      try {
        rows = await readStates([...wanted.keys()], requestClass);
      } catch (error) {
        console.warn('[moderation] sanction state read failed; the last answers stay', error);
        return result;
      }
      if (typeof rows?.get !== 'function') return result;
      for (const [account, walletKey] of wanted) {
        const row = rows.get(account) ?? { status: 'nonexist' };
        if (row.refused || row.unanswered || row.status === 'unknown') continue;
        let standing;
        try { standing = sanctionStandingFromState(row); } catch (error) {
          console.warn('[moderation] a sanction account did not parse; its wallet keeps its last answer', error);
          continue;
        }
        if (!standing) continue;
        const prev = entries.get(walletKey);
        const next = normal(standing, t);
        if ((prev?.exists ?? false) !== next.exists || (prev?.restricted ?? false) !== next.restricted
          || (prev?.warnings ?? 0) !== next.warnings || (prev?.updatedAt ?? 0) !== next.updatedAt) result.changed = true;
        entries.set(walletKey, next);
        result.read += 1;
      }
      return result;
    },
    size: () => entries.size,
  };
}

export function createReportQueueReader({ readStates, runGetMethod, generation = MODERATION_GENERATION, alive = () => true }) {
  return async function sweep(era) {
    const addresses = [];
    for (let bucket = 0; bucket < REPORT_BUCKET_COUNT; bucket += 1) addresses.push(await reportShardAddressFor(era, bucket, generation));
    const states = await readStates(addresses);
    const queue = [];
    for (let bucket = 0; bucket < REPORT_BUCKET_COUNT; bucket += 1) {
      if (!alive()) break;
      const address = addresses[bucket];
      const state = states.get(addrKey(address));
      if (!state || state.status !== 'active') continue;
      for (let from = 0; alive();) {
        const raw = await callGetter(runGetMethod, address, 'get_page', [num(from), num(96)]);
        if (!raw) break;
        const page = decodeReportPage(raw);
        for (const row of page.rows) {
          const rowKey = await reportRowKeyOf(row.key, row.partitionKey);
          queue.push({ ...row, rowKey, rowKeyString: rowKey.toString(), unreviewed: row.count - row.reviewedCount, era, bucket, shard: address });
        }
        if (page.count === 0 || from + page.count >= page.targetCount) break;
        from += page.count;
      }
    }
    queue.sort((a, b) => b.unreviewed - a.unreviewed || b.count - a.count || b.lastAt - a.lastAt);
    return queue;
  };
}

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

