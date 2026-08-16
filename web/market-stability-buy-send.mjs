// market-stability-buy-send — buy ATH from the sealed reserve, paid straight from the user's own wallet.
//
// One internal message, no relay and no authorisation step: the seller is permissionless (anyone may buy) and the
// wallet is both the payer and the recipient of record. The body is flat — the compiled storeBuyMarketStabilityAth is
// op(32) | query_id(64) | amount(128) | recipient(address), 491 bits, no spill — and tests/market-stability-buy.test.ts
// pins it against that compiled store rather than against my reading of the .tact.
//
// TWO THINGS THE CALLER MUST GET RIGHT, both enforced by the contract:
//
//   query_id must be STRICTLY ABOVE the seller's last_terminal_query_id (gate 23012), and nothing else. It used to have
//   to be exactly one more, which made the whole lane grievable — an observer could take that one number with a dust
//   buy and bounce every honest buyer in the round. A timestamp satisfies the rule and cannot be raced out of.
//
//   value must cover price + delivery overhead (gate 23218). Over-providing is SAFE and expected: the contract refunds
//   the excess, and the .tact says so in as many words ("Buyers over-provide and are refunded the excess"). So this
//   sends a quote taken from a FRESH read plus that overhead, and never a figure trimmed to the nanoton.
//
// bounce: true is not decoration. The seller serves ONE sale at a time (phase must be IDLE), so a buy landing while
// someone else's is in flight is refused at 23211 — and a refused buy must return the money, not burn it. The caller
// retries; it is a queue, not a failure.
import { beginCell } from './pwa-contract-transactions.mjs?v=37';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=37';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=32';
import { buyValueNanotons } from './market-stability-read.mjs?v=1';

const MARKET_STABILITY_BUY_OPCODE = 0x4D534558n; // "MSEX"

/** Build the BuyMarketStabilityAth body. `amountAtomic` is atomic ATH; `recipient` is the raw buyer address. */
export function buildMarketStabilityBuyBody({ queryId, amountAtomic, recipient }) {
  const amount = BigInt(amountAtomic);
  if (amount <= 0n) throw new Error('market stability buy: amount must be positive');
  const query = BigInt(queryId);
  if (query <= 0n) throw new Error('market stability buy: query_id must be positive');
  return beginCell()
    .uint(MARKET_STABILITY_BUY_OPCODE, 32, 'op')
    .uint(query, 64, 'query_id')
    .uint(amount, 128, 'amount')
    .address(recipient, 'recipient')
    .endCell();
}

/**
 * A query id the contract will accept: strictly above `lastTerminalQueryId`, and monotonic in wall-clock so two buys
 * from the same device in one second cannot collide. Milliseconds since epoch is comfortably inside uint64 for the
 * next quarter-million years, and comfortably above any terminal id a real sale sequence will reach.
 */
export function nextMarketStabilityQueryId(lastTerminalQueryId, now = Date.now()) {
  const floor = BigInt(lastTerminalQueryId ?? 0n);
  // `now` arrives as a Number from Date.now() and as a BigInt from callers that already work in chain units; taking
  // Math.floor of the latter throws, which would turn a clock reading into a failed send.
  const raw = typeof now === 'bigint' ? now : BigInt(Math.floor(Number(now) || 0));
  const stamp = raw > 1n ? raw : 1n;
  return stamp > floor ? stamp : floor + 1n;
}

/**
 * Send the buy. `amountAtomic` is what the user asked for, `multiplier` and `lastTerminalQueryId` come from a FRESH
 * state read — stale ones do not lose money (the price is a constant per tranche and the value is over-provided), but
 * a stale multiplier across a tranche boundary would under-pay and bounce at 23218.
 */
export async function publishMarketStabilityBuy(
  { wallet, transport, sellerAddress, recipient, amountAtomic, multiplier, lastTerminalQueryId },
  options = {},
) {
  if (!wallet) throw new Error('publishMarketStabilityBuy requires a wallet');
  if (!sellerAddress) throw new Error('publishMarketStabilityBuy requires the seller address');
  const queryId = nextMarketStabilityQueryId(lastTerminalQueryId, options.now ?? Date.now());
  const body = buildMarketStabilityBuyBody({ queryId, amountAtomic, recipient });
  const value = buyValueNanotons(amountAtomic, multiplier);
  const message = {
    address: sellerAddress,
    amount: value.toString(),
    payload: tonCell.bytesToBase64(serializeBoc(body)),
    bounce: true,   // a refused buy (busy seller, sold-out tranche) must return the funds
  };
  const result = await sendPlathoWalletTransaction(wallet, { messages: [message] }, { ...options, transport });
  return { queryId, amountAtomic: BigInt(amountAtomic), value, message, result };
}
