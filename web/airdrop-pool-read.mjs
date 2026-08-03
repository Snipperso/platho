// airdrop-pool-read — how much of the activity airdrop has actually been distributed.
//
// WHY IT EXISTS. The profile row "activity drop issued" used to read the Vault global. clean-17 deleted the Vault and
// moved the undistributed remainder into AirdropPool, and until the genesis ceremony sealed there was no pool address
// to configure — so the row rendered a dash, with a comment in app.js saying exactly that and calling for this reader.
// The ceremony sealed on 2026-08-02; this is that reader.
//
// `distributed_total` is read DIRECTLY rather than derived as total-minus-remaining. Both are on the same getter, but
// the pool caps remaining_budget at seal time, so the subtraction has an edge the field does not.
import { stackNumOr0 } from './ton-stack-num.mjs?v=1';

/**
 * Decode an AirdropGlobalView getter stack. The struct is 18 fields, in declaration order, and indices 3..7 are
 * ADDRESSES — skipped here because nothing on this screen needs them and decoding a slice would drag the BOC parser
 * in for nothing.
 *
 * Positional by necessity: a raw stack has no names. The arity check is what makes that survivable — AirdropPool.tact
 * carries an APPENDED-never-inserted rule on this struct precisely because a field added in the middle would hand
 * every later value to the wrong caller, silently.
 */
export function decodeAirdropGlobalStack(stack) {
  if (!Array.isArray(stack) || stack.length < 18) {
    throw new Error(`get_global returned ${stack?.length ?? 0} stack items, expected 18`);
  }
  const num = (i, name) => stackNumOr0(stack[i]?.value, `get_global: ${name}`);
  return {
    sealed: num(0, 'sealed') !== 0n,
    athPerCredit: num(8, 'ath_per_credit'),
    totalPool: num(9, 'total_pool'),
    fundedAmount: num(10, 'funded_amount'),
    remainingBudget: num(11, 'remaining_budget'),
    distributedTotal: num(12, 'distributed_total'),
    claimCount: num(13, 'claim_count'),
  };
}

/**
 * Read the pool. Returns `{ exists: false }` if the account cannot be read, so a transient RPC failure or a client
 * pointed at a pre-genesis config degrades to "unknown" rather than to a confident zero.
 */
export function createAirdropPoolReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createAirdropPoolReader requires runGetMethod');
  return async (poolAddress) => {
    if (!poolAddress) return { exists: false };
    const raw = await runGetMethod({ address: poolAddress, method: 'get_global', stack: [] });
    if (!raw || raw.exit_code !== 0) return { exists: false };
    return { exists: true, ...decodeAirdropGlobalStack(raw.stack) };
  };
}
