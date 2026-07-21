// shard-address — derive clean-17 shard addresses in the BROWSER, with no @ton/core and no build/*.ts.
//
// WHY THIS IS A CORRECTNESS GATE AND NOT PLUMBING. Shards are deployed lazily, so a message sent to a shard
// address that does not yet exist is normal — and TON runs such a message with its COMPUTE PHASE SKIPPED. There
// is no error, no bounce; the wallet reports success and the message is simply gone. A wrong address is therefore
// indistinguishable from a correct one at send time, which makes address derivation the one piece of client code
// that cannot be validated by "it seemed to work".
//
// The live client hand-rolls its TON encoding (web/pwa-contract-transactions.mjs) because @ton/core does not load
// in the browser, and the same applies here. The address is:
//
//   StateInit = [ split_depth:0 | special:0 | code:1 | data:1 | library:0 ] + ^code + ^data      (5 bits, 2 refs)
//   address   = (workchain 0, sha256(StateInit representation))
//
// and the data cell is exactly what Tact's generated wrapper builds: one leading zero bit, then each init argument
// as int257. For the non-negative values these shards use, an int257 is a zero sign bit followed by a 256-bit
// magnitude — which is what lets this be expressed with the unsigned primitives the client already has.
//
// tests/shard-browser-address.test.ts asserts, for many arguments, that every address derived here is IDENTICAL
// to the one @ton/core derives from the compiled wrapper. Two independent implementations agreeing is the only
// evidence worth having, given the failure mode above.

import { beginCell, parseBocBase64, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=1';
import { RECORDSHARD_CODE_BOC, INTROSHARD_CODE_BOC, RECOVERYSHARD_CODE_BOC, KEYSHARD_CODE_BOC } from './shard-code.mjs?v=2';

const CODE_CACHE = new Map();

function codeCell(boc) {
  let cell = CODE_CACHE.get(boc);
  if (!cell) { cell = parseBocBase64(boc); CODE_CACHE.set(boc, cell); }
  return cell;
}

/** Tact stores an init argument as int257. Every value these shards take is non-negative, so that is a zero sign
 *  bit and a 256-bit magnitude — reject anything else rather than silently truncating it into a wrong address. */
function storeInt257(builder, value, name) {
  const v = BigInt(value);
  if (v < 0n) throw new RangeError(`${name} must be non-negative for this derivation, got ${v}`);
  if (v >= (1n << 256n)) throw new RangeError(`${name} does not fit int257 magnitude`);
  builder.uint(0, 1, `${name} sign`);
  builder.uint(v, 256, name);
  return builder;
}

/** Tact stores an Address init argument as a standard address slice: addr_std tag 10, anycast 0, workchain int8,
 *  hash 256. KeyShard is the first shard whose init arguments are addresses rather than integers, and getting the
 *  267-bit layout wrong here would produce a plausible-looking address that no contract occupies — the failure the
 *  header of this file is about. Pinned against @ton/core in tests/shard-browser-address.test.ts. */
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

/** The StateInit cell itself — the same one the address hashes. A publish must ATTACH it, because shards are
 *  deployed lazily: without it the first message to a new shard lands on an uninitialised account, runs with its
 *  compute phase skipped, and is lost while the wallet reports success. */
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
  const { hash } = await computeCellHashAndDepth(state.endCell());
  return { workchain: 0, hash };
}

export const introShardStateInit = (epoch, bucket) =>
  shardStateInitCell(INTROSHARD_CODE_BOC, [['epoch', epoch], ['bucket', bucket]]);
export const recordShardStateInit = (writePublicKey, epoch) =>
  shardStateInitCell(RECORDSHARD_CODE_BOC, [['write_pubkey', writePublicKey], ['epoch', epoch]]);
export const recoveryShardStateInit = (selfBucketKey) =>
  shardStateInitCell(RECOVERYSHARD_CODE_BOC, [['self_bucket_key', selfBucketKey]]);

/** CONV: one conversation-direction for a day. */
export const recordShardAddressBytes = (writePublicKey, epoch) =>
  addressFor(RECORDSHARD_CODE_BOC, [['write_pubkey', writePublicKey], ['epoch', epoch]]);

/** INTRO: a sender-chosen bucket for a day — the addresses a recipient scans. */
export const introShardAddressBytes = (epoch, bucket) =>
  addressFor(INTROSHARD_CODE_BOC, [['epoch', epoch], ['bucket', bucket]]);

/** RECOVERY: the user's own slot, epoch-independent. */
export const recoveryShardAddressBytes = (selfBucketKey) =>
  addressFor(RECOVERYSHARD_CODE_BOC, [['self_bucket_key', selfBucketKey]]);

/**
 * KEY: a wallet's identity — public keys, and since 2026-07-21 the paid avatar pointer that ProfileRegistry used
 * to hold in a map with a 13,076-profile ceiling.
 *
 * The registry address is the SECOND init argument, not a constant in the shard's code, which is what let the
 * registry embed KeyShard's code and derive these addresses itself with no build cycle and no genesis bind. It
 * must therefore be the SAME registry the client reads from: derive against a different one and you get a live,
 * well-formed address that simply holds nothing — the exact silent failure this module exists to prevent.
 *
 * Both arguments are raw `workchain:hex` addresses, the form rawAddress() produces.
 */
export const keyShardAddressBytes = (ownerWallet, profileRegistry) =>
  addressFor(KEYSHARD_CODE_BOC, [['owner_wallet', ownerWallet, 'address'], ['profile_registry', profileRegistry, 'address']]);

export const keyShardStateInit = (ownerWallet, profileRegistry) =>
  shardStateInitCell(KEYSHARD_CODE_BOC, [['owner_wallet', ownerWallet, 'address'], ['profile_registry', profileRegistry, 'address']]);

/** Raw `workchain:hex` form — what toncenter accepts, and what a test can compare without an Address class. */
export function rawAddress({ workchain, hash }) {
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${workchain}:${hex}`;
}
