
import { beginCell, bytesToBase64, parseBocBase64, serializeBoc } from './pwa-contract-transactions.mjs?v=59';
import { cellReader } from './public-shard-ton-rpc-provider.mjs?v=44';

export const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10_000_000n;

export const ATH_REQUEST_COST = Object.freeze({
  notify: Object.freeze({ gas: 17_353n, cells: 90n, bits: 54_219n }),
  mint: Object.freeze({ gas: 17_973n, cells: 90n, bits: 54_355n }),
  avatar: Object.freeze({ gas: 18_635n, cells: 90n, bits: 54_691n }),
});
export const ATH_TOP_UP_RECEIVE_GAS = 4_610n;
export const ATH_WALLET_RENT_PER_YEAR = 5_800_000n;
export const ATH_REQUEST_MARGIN_PERCENT = 125n;
export const ATH_WALLET_TOP_UP_OPCODE = 0x41544807;

const YEAR_SECONDS = 365n * 86_400n;

function configCell(value) {
  return typeof value === 'string' ? parseBocBase64(value) : value;
}

export function parseForwardPrices(value) {
  const r = cellReader(configCell(value));
  const tag = Number(r.loadUint(8));
  if (tag !== 0xea) throw new Error(`config 25 is not MsgForwardPrices (tag 0x${tag.toString(16)})`);
  return { lump: r.loadUint(64), bit: r.loadUint(64), cell: r.loadUint(64) };
}

export function parseGasPrices(value) {
  const r = cellReader(configCell(value));
  const tag = Number(r.loadUint(8));
  if (tag !== 0xd1) throw new Error(`config 21 is not the flat-prefixed GasLimitsPrices (tag 0x${tag.toString(16)})`);
  const flatLimit = r.loadUint(64);
  const flatPrice = r.loadUint(64);
  const inner = Number(r.loadUint(8));
  if (inner !== 0xde) throw new Error(`config 21 inner prices are not gas_prices_ext (tag 0x${inner.toString(16)})`);
  return { flatLimit, flatPrice, gasPrice: r.loadUint(64) };
}

export function gasFeeNanotons(gas, prices) {
  const units = BigInt(gas);
  if (units <= prices.flatLimit) return prices.flatPrice;
  return prices.flatPrice + ((units - prices.flatLimit) * prices.gasPrice + 65_535n) / 65_536n;
}

export function forwardFeeNanotons(cells, bits, prices) {
  return prices.lump + (prices.bit * BigInt(bits) + prices.cell * BigInt(cells) + 65_535n) / 65_536n;
}

export function athRequestCostNanotons(lane, { gas, fwd }) {
  const cost = ATH_REQUEST_COST[lane];
  if (!cost) throw new RangeError(`no measured ATH request lane ${lane}`);
  return gasFeeNanotons(cost.gas, gas) + forwardFeeNanotons(cost.cells, cost.bits, fwd);
}

export function athWalletRentOwedNanotons({ lastTransactionAt = null, storageFeesDue = 0n, nowSec }) {
  const since = lastTransactionAt === null || lastTransactionAt === undefined ? YEAR_SECONDS : BigInt(Math.max(0, Number(nowSec) - Number(lastTransactionAt)));
  return (ATH_WALLET_RENT_PER_YEAR * since + YEAR_SECONDS - 1n) / YEAR_SECONDS + BigInt(storageFeesDue ?? 0n);
}

export function athRequestTopUpNanotons({ lane, prices, walletTon, rentOwed = 0n }) {
  const need = (athRequestCostNanotons(lane, prices) * ATH_REQUEST_MARGIN_PERCENT + 99n) / 100n;
  const spare = BigInt(walletTon) - BigInt(rentOwed);
  const have = (spare > 0n ? spare : 0n) + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;
  if (need <= have) return 0n;
  return need - have + gasFeeNanotons(ATH_TOP_UP_RECEIVE_GAS, prices.gas);
}


export const ATH_TRANSFER_EXEC_RESERVE = 2_000_000n;

export const ATH_TRANSFER_GAS = Object.freeze({ custodyExit: 14_799n, stake: 15_319n });

export function athTransferTopUpNanotons({ lane, prices, walletTon = 0n, rentOwed = 0n }) {
  const gas = ATH_TRANSFER_GAS[lane];
  if (!gas) throw new RangeError(`no measured ATH transfer lane ${lane}`);
  const need = (gasFeeNanotons(gas, prices.gas) * ATH_REQUEST_MARGIN_PERCENT + 99n) / 100n;
  const spare = BigInt(walletTon) - BigInt(rentOwed);
  const have = (spare > 0n ? spare : 0n) + ATH_TRANSFER_EXEC_RESERVE;
  if (need <= have) return 0n;
  return need - have + gasFeeNanotons(ATH_TOP_UP_RECEIVE_GAS, prices.gas);
}

export function athTransferTopUpPossible(lane, prices) {
  return athTransferTopUpNanotons({ lane, prices, walletTon: 0n, rentOwed: 0n }) > 0n;
}


export const ATH_ENTRY_LEG_COST = Object.freeze({
  owner: Object.freeze({ gas: 13_775n, onwardCells: 89n, onwardBits: 53_824n }),
  burn: Object.freeze({ gas: 5_796n, notifyCells: 1n, notifyBits: 758n, masterGas: 8_147n, finalCells: 1n, finalBits: 491n }),
});
export const ATH_INTERNAL_TRANSFER_ARRIVAL_MIN = 29_000_000n;
export const ATH_BURN_ARRIVAL_MIN = 2_000_000n;
export const ATH_ENTRY_LEG_FLOOR = Object.freeze({ owner: 39_000_000n, burn: 4_000_000n });

const withRequestMargin = (value) => (value * ATH_REQUEST_MARGIN_PERCENT + 99n) / 100n;
const atLeast = (value, floor) => (value > floor ? value : floor);

export function groupEntryLegValues(prices) {
  if (!prices?.gas || !prices?.fwd) return { owner: ATH_ENTRY_LEG_FLOOR.owner, burn: ATH_ENTRY_LEG_FLOOR.burn };
  const { owner, burn } = ATH_ENTRY_LEG_COST;
  const carriage = withRequestMargin(forwardFeeNanotons(owner.onwardCells, owner.onwardBits, prices.fwd));
  const master = withRequestMargin(gasFeeNanotons(burn.masterGas, prices.gas) + forwardFeeNanotons(burn.finalCells, burn.finalBits, prices.fwd));
  return {
    owner: atLeast(ATH_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ARRIVAL_MIN + carriage, ATH_ENTRY_LEG_FLOOR.owner),
    burn: atLeast(ATH_TRANSFER_EXEC_RESERVE + atLeast(master, ATH_BURN_ARRIVAL_MIN), ATH_ENTRY_LEG_FLOOR.burn),
  };
}

function entryLegWalletCost(leg, prices) {
  const cost = ATH_ENTRY_LEG_COST[leg];
  if (!cost) throw new RangeError(`no measured group entry leg ${leg}`);
  const gas = gasFeeNanotons(cost.gas, prices.gas);
  return leg === 'burn' ? gas + forwardFeeNanotons(cost.notifyCells, cost.notifyBits, prices.fwd) : gas;
}

export function groupEntryTopUpNanotons({ legs, prices, walletTon = 0n, rentOwed = 0n }) {
  if (!prices?.gas || !prices?.fwd) return 0n;
  const spare = BigInt(walletTon) - BigInt(rentOwed);
  let have = spare > 0n ? spare : 0n;
  let short = 0n;
  for (const leg of legs) {
    have += ATH_TRANSFER_EXEC_RESERVE - withRequestMargin(entryLegWalletCost(leg, prices));
    if (-have > short) short = -have;
  }
  return short > 0n ? short + gasFeeNanotons(ATH_TOP_UP_RECEIVE_GAS, prices.gas) : 0n;
}

export function groupEntryTopUpPossible(legs, prices) {
  return groupEntryTopUpNanotons({ legs, prices }) > 0n;
}

export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3_000_000n;
export const ATH_JETTON_EXCESSES_MIN = 1_000_000n;

export function groupEntryLegsSettledNanotons({ prices, legs = ['owner', 'burn'], values = groupEntryLegValues(prices) }) {
  const { owner, burn } = ATH_ENTRY_LEG_COST;
  let gone = 0n;
  if (legs.includes('owner')) {
    const arrival = values.owner - ATH_TRANSFER_EXEC_RESERVE - forwardFeeNanotons(owner.onwardCells, owner.onwardBits, prices.fwd);
    const excess = arrival - ATH_INTERNAL_TRANSFER_ARRIVAL_MIN;
    gone += values.owner - ATH_INTERNAL_TRANSFER_ACK_VALUE - (excess >= ATH_JETTON_EXCESSES_MIN ? excess : 0n);
  }
  if (legs.includes('burn')) {
    gone += ATH_TRANSFER_EXEC_RESERVE + gasFeeNanotons(burn.masterGas, prices.gas) + forwardFeeNanotons(burn.finalCells, burn.finalBits, prices.fwd);
  }
  return gone;
}

export function buildAthWalletTopUpMessage(athWalletAddress, amount) {
  const value = BigInt(amount);
  if (value <= 0n) throw new RangeError('an ATH wallet top-up must carry TON');
  const payload = bytesToBase64(serializeBoc(beginCell().uint(BigInt(ATH_WALLET_TOP_UP_OPCODE), 32, 'op').endCell()));
  return { address: athWalletAddress, amount: value, payload, stateInit: null, bounce: false };
}
