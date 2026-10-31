import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=94';
import { buyValueNanotons } from './market-stability-read.mjs?v=3';

const MARKET_STABILITY_BUY_OPCODE = 0x4D534558n;

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

export function nextMarketStabilityQueryId(lastTerminalQueryId, now = Date.now()) {
  const floor = BigInt(lastTerminalQueryId ?? 0n);
  const raw = typeof now === 'bigint' ? now : BigInt(Math.floor(Number(now) || 0));
  const stamp = raw > 1n ? raw : 1n;
  return stamp > floor ? stamp : floor + 1n;
}

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
    bounce: true,
  };
  const result = await sendPlathoWalletTransaction(wallet, { messages: [message] }, { ...options, transport });
  return { queryId, amountAtomic: BigInt(amountAtomic), value, message, result };
}
