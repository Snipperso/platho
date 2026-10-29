
import { beginCell, parseBocBase64, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=59';
import {
  RECORDSHARD_CODE_BOC, INTROSHARD_CODE_BOC, RECOVERYSHARD_CODE_BOC, KEYSHARD_CODE_BOC, PUBLICSHARD_CODE_BOC,
} from './shard-code.mjs?v=6';
import {
  RECORDSHARD_CODE_BOC_18, INTROSHARD_CODE_BOC_18, PUBLICSHARD_CODE_BOC_18, FEEVAULT_CODE_BOC_18, KEYSHARD_CODE_BOC_18,
  REPORTSHARD_CODE_BOC_18, SANCTIONSHARD_CODE_BOC_18,
} from './shard-code-18.mjs?v=2';
import { generationForEpoch } from './cutover-epoch.mjs?v=7';

const LANE_CODE = {
  record: { 17: RECORDSHARD_CODE_BOC, 18: RECORDSHARD_CODE_BOC_18 },
  intro: { 17: INTROSHARD_CODE_BOC, 18: INTROSHARD_CODE_BOC_18 },
  public: { 17: PUBLICSHARD_CODE_BOC, 18: PUBLICSHARD_CODE_BOC_18 },
  key: { 17: KEYSHARD_CODE_BOC, 18: KEYSHARD_CODE_BOC_18 },
  vault: { 18: FEEVAULT_CODE_BOC_18 },
  report: { 18: REPORTSHARD_CODE_BOC_18 },
  sanction: { 18: SANCTIONSHARD_CODE_BOC_18 },
};

const LANE_CODE_TEST_OVERRIDES = (globalThis.__plathoLaneCodeOverrides
  ??= new Map());
export function __setLaneGenerationCodeForTests(lane, generation, boc) {
  LANE_CODE_TEST_OVERRIDES.set(`${lane}:${generation}`, boc);
}
export function __resetLaneGenerationCodeOverridesForTests() {
  LANE_CODE_TEST_OVERRIDES.clear();
}

export function laneCodeBoc(lane, generation) {
  const boc = LANE_CODE_TEST_OVERRIDES.get(`${lane}:${generation}`) ?? LANE_CODE[lane]?.[generation];
  if (!boc) {
    const error = new RangeError(`no ${lane} shard code cell for generation ${generation} in this build — only a `
      + 'release that carries the sealed cells of that generation can address it');
    error.code = 'CUTOVER_UPDATE_REQUIRED';
    throw error;
  }
  return boc;
}

export function hasLaneCode(lane, generation) {
  return Boolean(LANE_CODE_TEST_OVERRIDES.get(`${lane}:${generation}`) ?? LANE_CODE[lane]?.[generation]);
}

export function canDeriveForEpoch(lane, epoch) {
  return hasLaneCode(lane, generationForEpoch(Number(epoch)));
}

const CODE_CACHE = new Map();

const HASH_MEMO = new WeakMap();

function codeCell(boc) {
  let cell = CODE_CACHE.get(boc);
  if (!cell) { cell = parseBocBase64(boc); CODE_CACHE.set(boc, cell); }
  return cell;
}

function storeInt257(builder, value, name) {
  const v = BigInt(value);
  if (v < 0n) throw new RangeError(`${name} must be non-negative for this derivation, got ${v}`);
  if (v >= (1n << 256n)) throw new RangeError(`${name} does not fit int257 magnitude`);
  builder.uint(0, 1, `${name} sign`);
  builder.uint(v, 256, name);
  return builder;
}

function storeAddressArg(builder, value, name) {
  const raw = String(value ?? '');
  const match = /^(-?\d+):([0-9a-fA-F]{64})$/.exec(raw.trim());
  if (!match) throw new RangeError(`${name} must be a raw "workchain:hex" address, got ${JSON.stringify(value)}`);
  const workchain = Number(match[1]);
  if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
    throw new RangeError(`${name} workchain ${workchain} does not fit int8`);
  }
  builder.uint(0b100, 3, `${name} addr_std tag + anycast`);
  builder.uint(BigInt(workchain & 0xff), 8, `${name} workchain`);
  builder.uint(BigInt(`0x${match[2]}`), 256, `${name} hash`);
  return builder;
}

function initDataCell(args) {
  const builder = beginCell();
  builder.uint(0, 1, 'tact init prefix');
  for (const [name, value, kind] of args) {
    if (kind === 'address') storeAddressArg(builder, value, name);
    else storeInt257(builder, value, name);
  }
  return builder.endCell();
}

export function shardStateInitCell(codeBoc, args) {
  const state = beginCell();
  state.uint(0, 1, 'split_depth');
  state.uint(0, 1, 'special');
  state.uint(1, 1, 'code present');
  state.uint(1, 1, 'data present');
  state.uint(0, 1, 'library');
  state.ref(codeCell(codeBoc), 'code');
  state.ref(initDataCell(args), 'data');
  return state.endCell();
}

async function addressFor(codeBoc, args) {
  const state = beginCell();
  state.uint(0, 1, 'split_depth');
  state.uint(0, 1, 'special');
  state.uint(1, 1, 'code present');
  state.uint(1, 1, 'data present');
  state.uint(0, 1, 'library');
  state.ref(codeCell(codeBoc), 'code');
  state.ref(initDataCell(args), 'data');
  const { hash } = await computeCellHashAndDepth(state.endCell(), HASH_MEMO);
  return { workchain: 0, hash };
}

export const recordShardCodeCellFor = (generation) => codeCell(laneCodeBoc('record', generation));
export const recordShardDataCellFor = (generation, writePublicKey, epoch) =>
  initDataCell([['write_pubkey', writePublicKey], ['epoch', epoch]]);

export const recordShardStateInitFor = (generation, writePublicKey, epoch) =>
  shardStateInitCell(laneCodeBoc('record', generation), [['write_pubkey', writePublicKey], ['epoch', epoch]]);
export const recordShardAddressBytesFor = (generation, writePublicKey, epoch) =>
  addressFor(laneCodeBoc('record', generation), [['write_pubkey', writePublicKey], ['epoch', epoch]]);
export const introShardStateInitFor = (generation, epoch, bucket) =>
  shardStateInitCell(laneCodeBoc('intro', generation), [['epoch', epoch], ['bucket', bucket]]);
export const introShardAddressBytesFor = (generation, epoch, bucket) =>
  addressFor(laneCodeBoc('intro', generation), [['epoch', epoch], ['bucket', bucket]]);

export const introShardStateInit = (epoch, bucket) =>
  introShardStateInitFor(generationForEpoch(Number(epoch)), epoch, bucket);
export const recordShardStateInit = (writePublicKey, epoch) =>
  recordShardStateInitFor(generationForEpoch(Number(epoch)), writePublicKey, epoch);
export const recoveryShardStateInit = (selfBucketKey) =>
  shardStateInitCell(RECOVERYSHARD_CODE_BOC, [['self_bucket_key', selfBucketKey]]);

export const recordShardAddressBytes = (writePublicKey, epoch) =>
  recordShardAddressBytesFor(generationForEpoch(Number(epoch)), writePublicKey, epoch);

export const introShardAddressBytes = (epoch, bucket) =>
  introShardAddressBytesFor(generationForEpoch(Number(epoch)), epoch, bucket);

export const recoveryShardAddressBytes = (selfBucketKey) =>
  addressFor(RECOVERYSHARD_CODE_BOC, [['self_bucket_key', selfBucketKey]]);

export const keyShardAddressBytesFor = (generation, ownerWallet, profileRegistry) =>
  addressFor(laneCodeBoc('key', generation), [['owner_wallet', ownerWallet, 'address'], ['profile_registry', profileRegistry, 'address']]);

export const keyShardStateInitFor = (generation, ownerWallet, profileRegistry) =>
  shardStateInitCell(laneCodeBoc('key', generation), [['owner_wallet', ownerWallet, 'address'], ['profile_registry', profileRegistry, 'address']]);

export const keyShardAddressBytes = (ownerWallet, profileRegistry, generation) =>
  keyShardAddressBytesFor(requireNamedGeneration(generation, 'keyShardAddressBytes'), ownerWallet, profileRegistry);

export const keyShardStateInit = (ownerWallet, profileRegistry, generation) =>
  keyShardStateInitFor(requireNamedGeneration(generation, 'keyShardStateInit'), ownerWallet, profileRegistry);

function requireNamedGeneration(generation, who) {
  if (generation === 17 || generation === 18) return generation;
  const error = new RangeError(`${who}: name the generation (17 or 18) — a default would answer the wrong chain on flip day`);
  error.code = 'PLATHO_GENERATION_REQUIRED';
  throw error;
}

export const publicShardAddressBytesFor = (generation, partitionKey, epochTag) =>
  addressFor(laneCodeBoc('public', generation), [['partition_key', partitionKey], ['epoch_tag', epochTag]]);

export const publicShardCodeCellFor = (generation) => codeCell(laneCodeBoc('public', generation));
export const publicShardDataCellFor = (partitionKey, epochTag) =>
  initDataCell([['partition_key', partitionKey], ['epoch_tag', epochTag]]);

export const publicShardStateInitFor = (generation, partitionKey, epochTag) =>
  shardStateInitCell(laneCodeBoc('public', generation), [['partition_key', partitionKey], ['epoch_tag', epochTag]]);

export const publicShardAddressBytes = (partitionKey, epochTag) =>
  publicShardAddressBytesFor(17, partitionKey, epochTag);

export const publicShardStateInit = (partitionKey, epochTag) =>
  publicShardStateInitFor(17, partitionKey, epochTag);

export const reportShardCodeCellFor = (generation) => codeCell(laneCodeBoc('report', generation));
export const reportShardDataCellFor = (era, bucket) => initDataCell([['era', era], ['bucket', bucket]]);
export const reportShardStateInitFor = (generation, era, bucket) =>
  shardStateInitCell(laneCodeBoc('report', generation), [['era', era], ['bucket', bucket]]);
export const reportShardAddressBytesFor = (generation, era, bucket) =>
  addressFor(laneCodeBoc('report', generation), [['era', era], ['bucket', bucket]]);
export const sanctionShardDataCellFor = (gateAddress, walletHash) => initDataCell([['gate', gateAddress, 'address'], ['wallet', walletHash]]);
export const sanctionShardAddressBytesFor = (generation, gateAddress, walletHash) =>
  addressFor(laneCodeBoc('sanction', generation), [['gate', gateAddress, 'address'], ['wallet', walletHash]]);
export function sanctionShardCodeAvailable(generation = 18) {
  try {
    laneCodeBoc('sanction', generation);
    return true;
  } catch (error) {
    if (error?.code === 'CUTOVER_UPDATE_REQUIRED') return false;
    throw error;
  }
}

export function reportShardCodeAvailable(generation = 18) {
  try {
    laneCodeBoc('report', generation);
    return true;
  } catch (error) {
    if (error?.code === 'CUTOVER_UPDATE_REQUIRED') return false;
    throw error;
  }
}

export const feeVaultCodeBoc = (generation = 18) => laneCodeBoc('vault', generation);

export function feeVaultCodeAvailable(generation = 18) {
  try {
    feeVaultCodeBoc(generation);
    return true;
  } catch (error) {
    if (error?.code === 'CUTOVER_UPDATE_REQUIRED') return false;
    throw error;
  }
}

export function rawAddress({ workchain, hash }) {
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${workchain}:${hex}`;
}
