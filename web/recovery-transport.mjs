// recovery-transport — the client reads for the RECOVERY restore path: a slot's get_view (seq for anti-rollback +
// the frame hashes) and get_body (the sealed K_root blob cell). No @ton/core and no build/*.ts — this runs in the
// browser, so the getter stacks are decoded by the client's own parser, pinned against the compiled contract stack.
//
// WHY BOTH. A backup must read get_view().seq first and publish at seq+1 (the shard rejects a non-advancing seq,
// gate 13564/13573). A restore reads get_body() and opens it from the seed (recovery-blob). get_view ALSO returns
// h0/h1/bh so the read is self-verifying: bh must equal the body cell's hash. The address-decoding + rate-limited
// pump are shared with the other lanes (toWireAddress / the injected runGetMethod).

import { toWireAddress } from './shard-reader.mjs?v=9';
import { stackNumOr0 } from './ton-stack-num.mjs?v=1';
import { parseBocBase64 } from './pwa-contract-transactions.mjs?v=35';

/**
 * Decode a RecoveryShardView getter stack (12 items, in declaration order). An arity check guards the same silent
 * drift the other lanes learned the hard way — a getter that grew a field would shift every value after it.
 * `stack` is the toncenter wire shape ([{ type, value }, …]); `value` is a decimal/hex string for ints.
 */
export function decodeRecoveryViewStack(stack) {
  if (!Array.isArray(stack) || stack.length < 12) {
    throw new Error(`get_view returned ${stack?.length ?? 0} stack items, expected 12`);
  }
  // The comment below was right about the -1 and the parser still used BigInt(), which THROWS on the "-0x1" toncenter
  // actually sends. Knowing the value and mis-parsing it are independent mistakes; see ton-stack-num.mjs.
  const num = (i) => stackNumOr0(stack[i]?.value, `get_view[${i}]`);
  return {
    self_bucket_key: num(0),
    bound: num(1) !== 0n,      // Tact Bool → TVM int (-1 true / 0 false)
    owner_pubkey: num(2),
    seq: num(3),
    updated_at: num(4),
    retention: num(5),
    endowment: num(6),
    max_slots: Number(num(7)),
    h0: num(8),
    h1: num(9),
    bh: num(10),
    max_blob_cells: Number(num(11)),
  };
}

/** Decode a get_body getter stack: one Cell item — the sealed recovery blob. Returns a client cell (or null if empty). */
export function decodeRecoveryBodyStack(stack) {
  const value = Array.isArray(stack) ? stack[0]?.value : null;
  if (!value) return null;
  return typeof value === 'string' ? parseBocBase64(value) : value;
}

// A code-less account aborts a get-method run with -13 (production, via this transport — TON_GET_METHOD_UNINITIALIZED_
// EXIT_CODE, as isAthWalletNotDeployedError matches) or -256 (the @ton/sandbox emulator). BOTH mean "fresh/unbound slot".
function isRecoveryUninitExit(code) { return Number(code) === -13 || Number(code) === -256; }
function isRecoveryUninitError(error) { return isRecoveryUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code); }

/**
 * Bind get_view to a get-method runner. `runGetMethod({ address, method, stack })` resolves toncenter's response;
 * an uninitialised slot (never bound) returns null rather than raising — the normal case under lazy deploy.
 */
export function createRecoveryViewReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecoveryViewReader requires runGetMethod');
  return async (address) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    } catch (error) {
      // An unbound slot ABORTS the get-method, and this transport THROWS that (exitCode -13). It is a fresh/unbound
      // slot, NOT a read failure: return null so the restore keeps probing and stays CLEAN. Mis-catching it as a
      // transient (clean=false) would block EVERY backup, since almost all 256 slots are unbound. [confirm review: -13]
      if (isRecoveryUninitError(error)) return null;
      throw error;
    }
    if (!raw) return null;
    if (isRecoveryUninitExit(raw.exit_code)) return null;          // account not initialised = fresh/unbound slot
    if (raw.exit_code !== 0) throw new Error(`get_view failed with exit_code ${raw.exit_code}`);
    return decodeRecoveryViewStack(raw.stack);
  };
}

/** Bind get_body to a get-method runner. Returns the blob cell, or null for an empty/uninitialised slot. */
export function createRecoveryBodyReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecoveryBodyReader requires runGetMethod');
  return async (address) => {
    const raw = await runGetMethod({ address: toWireAddress(address), method: 'get_body', stack: [] });
    if (!raw || raw.exit_code !== 0) return null;
    return decodeRecoveryBodyStack(raw.stack);
  };
}
