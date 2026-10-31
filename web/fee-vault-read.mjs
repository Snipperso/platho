
import { toWireAddress } from './shard-reader.mjs?v=109';
import { stackNumOr0 } from './ton-stack-num.mjs?v=2';

export const FEE_VAULT_VIEW_ARITY = 12;

export function decodeFeeVaultViewStack(stack) {
  if (!Array.isArray(stack) || stack.length !== FEE_VAULT_VIEW_ARITY) {
    throw new Error(`get_vault returned ${stack?.length ?? 0} stack items, expected ${FEE_VAULT_VIEW_ARITY}`);
  }
  const at = (index, name) => stackNumOr0(
    Array.isArray(stack[index]) ? stack[index][1] : (stack[index]?.value ?? stack[index]), name);
  return {
    staked: at(1, 'staked'),
    pending: at(2, 'pending'),
    pending_at: at(3, 'pending_at'),
    discount_bps: at(4, 'discount_bps'),
    fee_due: at(5, 'fee_due'),
    balance: at(7, 'balance'),
    exited: at(8, 'exited'),
    exited_at: at(9, 'exited_at'),
    accrued_fee: at(10, 'accrued_fee'),
    flush_min: at(11, 'flush_min'),
  };
}

const isUninitExit = (code) => Number(code) === -13 || Number(code) === -256;
const isUninitError = (error) =>
  isUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);

export function createFeeVaultReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createFeeVaultReader requires runGetMethod');
  return async (address) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_vault', stack: [] });
    } catch (error) {
      if (isUninitError(error)) return null;
      throw error;
    }
    if (!raw) return null;
    const exitCode = raw.exit_code ?? raw.exitCode;
    if (exitCode !== undefined && Number(exitCode) !== 0) {
      if (isUninitExit(exitCode)) return null;
      throw new Error(`get_vault exited ${exitCode}`);
    }
    return decodeFeeVaultViewStack(raw.stack ?? raw.result ?? raw);
  };
}
