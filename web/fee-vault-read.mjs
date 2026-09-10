// fee-vault-read — the one read the discount door needs: can this vault take a publish right now, and at what price.
//
// WHY ONE READ AND NOT FIVE. Routing a publish through the vault depends on five facts that all live in the same
// account — is the door armed, what is the discount, what value floor does a publish have to clear, how much must
// stay behind, and what does the float actually hold. get_vault answers all of them in one getter, so the routing
// decision costs exactly one request and never guesses. A client that guessed instead would learn it was wrong on
// chain: the cheap refusals cost a lost publish, and the float-short one costs a transaction's gas.
//
// AN UNDEPLOYED VAULT IS THE NORMAL CASE, not an error. Vaults are per-user and deployed on demand, so a getter
// against one that does not exist ABORTS with exit -13 (uninit). That is "this user has no vault", and the caller
// answers it by deploying the vault with its first publish. Treating it as a read failure would make
// every non-staker's send look broken.

import { toWireAddress } from './shard-reader.mjs?v=61';
import { stackNumOr0 } from './ton-stack-num.mjs?v=1';

// FeeVaultView, in declaration order. The arity check is the guard against the drift this codebase has already
// paid for on other lanes: a getter that grows a field shifts every value after it, and the read keeps "working"
// while returning one field's value under another field's name.
// TWELVE SINCE 2026-09-01, when the external door was deleted [OWNER: the money for sending travels WITH
// the message]. The view lost publish_pubkey, publish_nonce, ext_min_value, ext_float_overhead and
// ext_max_actions — the five fields that existed only to size a publish funded from a standing float.
// Every field below is read BY INDEX, so this number moving IS the migration: the exact-arity guard
// turns a stale client into a loud refusal instead of a silently shifted read.
export const FEE_VAULT_VIEW_ARITY = 12;

/**
 * Decode a get_vault stack. `owner` and `ath_wallet` are deliberately NOT decoded: both are addresses the caller
 * already knows — it derived the vault from the owner, and the ATH wallet is derivable from the vault — so
 * decoding them here would add a second address-slice decoder to this client for values nobody reads.
 */
export function decodeFeeVaultViewStack(stack) {
  // EXACT, NOT "AT LEAST" [audit 2026-08-30]. This guard read `< ARITY`, so it could only ever catch a getter
  // that SHRANK — and the gate that covers it is named "notices if the getter grows a field". It could not: when
  // get_vault grew from 13 to 15, a stack one field short was still 14 and decoded silently. Every field below is
  // read BY INDEX, so a getter that gains a field in the middle shifts everything after it, and the routing
  // decision would be taken from one number while the client believed it was another. An exact arity turns any
  // change to the view — either direction — into a red test, which is the only way a positional decoder stays
  // honest across a contract generation.
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
    // index 6 is ath_wallet, a slice this client derives for itself rather than decodes.
    balance: at(7, 'balance'),
    // THE OPEN EXIT DEBT AND WHEN IT LAPSES. EmergencyExit books a debt for what it asked for, and a credit
    // arriving within FV_EXIT_ABSORB_WINDOW pays that debt down instead of raising the mirror — correct while the
    // hatch really did take the ATH, and invisible until these two fields existed. Without them a client cannot
    // distinguish "your re-stake was swallowed by a settling exit" from "your stake never arrived", which is the
    // difference between waiting five minutes and believing the vault is broken.
    exited: at(8, 'exited'),
    exited_at: at(9, 'exited_at'),
    // Booked-but-unflushed protocol fees and the automatic flush threshold [OWNER 2026-08-30: 1 GRAM]. The
    // client prices a publish from fee_due PLUS the flush amortisation while fee_due > 0 (fee-vault.mjs holds
    // the mirror), and a treasury tick in the owner's own history is explained by these two.
    accrued_fee: at(10, 'accrued_fee'),
    flush_min: at(11, 'flush_min'),
  };
}

const isUninitExit = (code) => Number(code) === -13 || Number(code) === -256;
const isUninitError = (error) =>
  isUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);

/**
 * Bind get_vault to a get-method runner. `runGetMethod({ address, method, stack })` resolves the transport's
 * response; a vault that was never deployed returns null rather than raising.
 */
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
