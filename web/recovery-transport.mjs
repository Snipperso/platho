// recovery-transport — the client reads for the RECOVERY restore path: a slot's get_view (seq for anti-rollback +
// the frame hashes) and get_body (the sealed K_root blob cell). No @ton/core and no build/*.ts — this runs in the
// browser, so the getter stacks are decoded by the client's own parser, pinned against the compiled contract stack.
//
// WHY BOTH. A backup must read get_view().seq first and publish at seq+1 (the shard rejects a non-advancing seq,
// gate 13564/13573). A restore reads get_body() and opens it from the seed (recovery-blob). get_view ALSO returns
// h0/h1/bh so the read is self-verifying: bh must equal the body cell's hash. The address-decoding + rate-limited
// pump are shared with the other lanes (toWireAddress / the injected runGetMethod).

import { toWireAddress } from './shard-reader.mjs';
import { parseBocBase64 } from './pwa-contract-transactions.mjs?v=33';

/**
 * Decode a RecoveryShardView getter stack (12 items, in declaration order). An arity check guards the same silent
 * drift the other lanes learned the hard way — a getter that grew a field would shift every value after it.
 * `stack` is the toncenter wire shape ([{ type, value }, …]); `value` is a decimal/hex string for ints.
 */
export function decodeRecoveryViewStack(stack) {
  if (!Array.isArray(stack) || stack.length < 12) {
    throw new Error(`get_view returned ${stack?.length ?? 0} stack items, expected 12`);
  }
  const num = (i) => BigInt(stack[i]?.value ?? 0);
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

/**
 * Bind get_view to a get-method runner. `runGetMethod({ address, method, stack })` resolves toncenter's response;
 * an uninitialised slot (never bound) returns null rather than raising — the normal case under lazy deploy.
 */
export function createRecoveryViewReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecoveryViewReader requires runGetMethod');
  return async (address) => {
    const raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    if (!raw) return null;
    if (raw.exit_code === -256) return null;                       // account not initialised = fresh/unbound slot
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
