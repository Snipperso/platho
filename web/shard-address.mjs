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
import { RECORDSHARD_CODE_BOC, INTROSHARD_CODE_BOC, RECOVERYSHARD_CODE_BOC } from './shard-code.mjs?v=1';

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

function initDataCell(args) {
  const builder = beginCell();
  builder.uint(0, 1, 'tact init prefix');
  for (const [name, value] of args) storeInt257(builder, value, name);
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

/** Raw `workchain:hex` form — what toncenter accepts, and what a test can compare without an Address class. */
export function rawAddress({ workchain, hash }) {
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${workchain}:${hex}`;
}
