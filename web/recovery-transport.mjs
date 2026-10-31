
import { toWireAddress } from './shard-reader.mjs?v=109';
import { stackNumOr0 } from './ton-stack-num.mjs?v=2';
import { parseBocBase64 } from './pwa-contract-transactions.mjs?v=59';

export const RECOVERY_SHARD_VIEW_ARITY = 12;

export function decodeRecoveryViewStack(stack) {
  if (!Array.isArray(stack) || stack.length !== RECOVERY_SHARD_VIEW_ARITY) {
    throw new Error(`get_view returned ${stack?.length ?? 0} stack items, expected ${RECOVERY_SHARD_VIEW_ARITY}`);
  }
  const num = (i) => stackNumOr0(stack[i]?.value, `get_view[${i}]`);
  return {
    self_bucket_key: num(0),
    bound: num(1) !== 0n,
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

export function decodeRecoveryBodyStack(stack) {
  const value = Array.isArray(stack) ? stack[0]?.value : null;
  if (!value) return null;
  return typeof value === 'string' ? parseBocBase64(value) : value;
}

function isRecoveryUninitExit(code) { return Number(code) === -13 || Number(code) === -256; }
function isRecoveryUninitError(error) { return isRecoveryUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code); }

export function createRecoveryViewReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecoveryViewReader requires runGetMethod');
  return async (address) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    } catch (error) {
      if (isRecoveryUninitError(error)) return null;
      throw error;
    }
    if (!raw) return null;
    if (isRecoveryUninitExit(raw.exit_code)) return null;
    if (raw.exit_code !== 0) throw new Error(`get_view failed with exit_code ${raw.exit_code}`);
    return decodeRecoveryViewStack(raw.stack);
  };
}

export function createRecoveryBodyReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecoveryBodyReader requires runGetMethod');
  return async (address) => {
    const raw = await runGetMethod({ address: toWireAddress(address), method: 'get_body', stack: [] });
    if (!raw || raw.exit_code !== 0) return null;
    return decodeRecoveryBodyStack(raw.stack);
  };
}
