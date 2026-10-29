
import {
  beginCell, bytesToBase64, computeCellHashAndDepth, serializeBoc,
  estimateAthWalletAttachedValueNanotons,
} from './pwa-contract-transactions.mjs?v=59';
import { shardStateInitCell, rawAddress } from './shard-address.mjs?v=47';
import { gasFeeNanotons } from './ath-request-reserve.mjs?v=10';

const toBig = (value, name) => {
  let out;
  if (typeof value === 'bigint') out = value;
  else if (typeof value === 'number' && Number.isSafeInteger(value)) out = BigInt(value);
  else if (typeof value === 'string' && /^\d+$/.test(value)) out = BigInt(value);
  else throw new TypeError(`${name} must be a non-negative integer`);
  if (out < 0n) throw new TypeError(`${name} must be a non-negative integer`);
  return out;
};

export const FV_PROTOCOL_FEE = 10_000_000n;

export const FV_FEE_TRANSPORT = 600_000n;

export const FV_FLUSH_MIN = 1_000_000_000n;
export const FV_FLUSH_AMORT = 2_000n;

export const FV_STAKE_MIN_ATH = 100n;
export const FV_STAKE_MAX_ATH = 10_000n;
export const FV_ATOMIC_PER_ATH = 1_000_000_000n;

export function feeDueForStakedAtoms(stakedAtoms, protocolFee = FV_PROTOCOL_FEE) {
  const held = toBig(stakedAtoms ?? 0n, 'stakedAtoms') / FV_ATOMIC_PER_ATH;
  const bps = held > FV_STAKE_MAX_ATH ? FV_STAKE_MAX_ATH : held;
  return protocolFee * (FV_STAKE_MAX_ATH - bps) / FV_STAKE_MAX_ATH;
}

export function stakeBandVerdict(ath, { protocolFee = FV_PROTOCOL_FEE, stakedAtoms = 0n } = {}) {
  let typed;
  if (typeof ath === 'bigint') {
    typed = ath;
  } else if (typeof ath === 'number') {
    if (!Number.isFinite(ath) || !Number.isInteger(ath)) {
      return { ok: false, reason: 'not-a-whole-number' };
    }
    typed = BigInt(ath);
  } else if (typeof ath === 'string' && /^\d+$/.test(ath.trim())) {
    typed = BigInt(ath.trim());
  } else {
    return { ok: false, reason: 'not-a-whole-number' };
  }
  if (typed < 0n) return { ok: false, reason: 'not-a-whole-number' };
  const held = toBig(stakedAtoms, 'stakedAtoms') / FV_ATOMIC_PER_ATH;
  const whole = held + typed;
  const bps = whole > FV_STAKE_MAX_ATH ? FV_STAKE_MAX_ATH : whole;
  const feeDue = feeDueForStakedAtoms(whole * FV_ATOMIC_PER_ATH, protocolFee);
  const shape = {
    whole,
    atoms: typed * FV_ATOMIC_PER_ATH,
    bps,
    percent: Number(bps) / 100,
    feeDue,
    savedPerPublish: protocolFee - feeDue,
  };
  if (whole < FV_STAKE_MIN_ATH) return { ok: false, reason: 'below-band', ...shape };
  if (whole > FV_STAKE_MAX_ATH) return { ok: false, reason: 'above-band', ...shape };
  if (typed <= 0n) return { ok: false, reason: 'nothing-to-send', ...shape };
  return { ok: true, reason: 'in-band', ...shape };
}

export function vaultTakeFor(feeDue) {
  const fee = toBig(feeDue, 'feeDue');
  return fee > 0n ? fee + FV_FLUSH_AMORT : 0n;
}

export const FV_CARRIAGE_BASE = 1_100_000n;
export const FV_CARRIAGE_PER_BYTE = 600n;

export const FV_MSG_FORWARD_PRICES = Object.freeze({ lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n });

export function cellTreeStats(root) {
  const seen = new WeakSet();
  let cells = 0n;
  let bits = 0n;
  const visit = (cell) => {
    if (!cell || seen.has(cell)) return;
    seen.add(cell);
    cells += 1n;
    bits += BigInt(cell.bitLength ?? 0);
    for (const ref of cell.refs ?? []) visit(ref);
  };
  visit(root);
  return { cells, bits };
}

export function forwardFeeNanotons({ cells, bits }, prices = FV_MSG_FORWARD_PRICES) {
  return prices.lump + (prices.bit * BigInt(bits) + prices.cell * BigInt(cells) + 65_535n) / 65_536n;
}

export function stateInitCarriageNanotons(code, data, prices = FV_MSG_FORWARD_PRICES) {
  if (!code && !data) return 0n;
  if (!!code !== !!data) throw new RangeError('stateInitCarriageNanotons: code and data must be supplied together');
  const c = cellTreeStats(code);
  const d = cellTreeStats(data);
  return (prices.bit * (c.bits + d.bits) + prices.cell * (c.cells + d.cells) + 65_535n) / 65_536n;
}

export const FV_EXIT_ABSORB_WINDOW = 300;

export const FV_UNSTAKE_UNJAM_GRACE_SECONDS = 3600;


export const FEE_VAULT_OPS = Object.freeze({
  PublishViaVault: 0x4D323144,
  Unstake: 0x4D323145,
  UnstakeUnjam: 0x4D323146,
  WithdrawFloat: 0x4D323148,
  EmergencyExit: 0x4D323147,
  FlushFees: 0x4D32314B,
});

export const FV_DEPLOY_FUNDING = 50_000_000n;

export const FV_UNSTAKE_MIN_INBOUND = 55_000_000n;

export const FV_EXIT_INBOUND = 80_000_000n;

export const FV_EXIT_LEG_CELLS = 89n;
export const FV_EXIT_LEG_BITS = 53_744n;
export const FV_EXIT_FIXED_NEED = 34_000_000n;
export const FV_STAKE_LEG_CELLS = 89n;
export const FV_STAKE_LEG_BITS = 53_768n;
export const FV_STAKE_FIXED_NEED = 33_000_000n;
export const FV_LIVE_PRICE_MARGIN_PERCENT = 125n;

const withLiveMargin = (fixed, variable) => fixed + (variable * FV_LIVE_PRICE_MARGIN_PERCENT + 99n) / 100n;

export function vaultExitInboundNanotons(fwdPrices = FV_MSG_FORWARD_PRICES) {
  const priced = withLiveMargin(FV_EXIT_FIXED_NEED,
    forwardFeeNanotons({ cells: FV_EXIT_LEG_CELLS, bits: FV_EXIT_LEG_BITS }, fwdPrices));
  return priced > FV_EXIT_INBOUND ? priced : FV_EXIT_INBOUND;
}

export function vaultStakeAttachNanotons(floor, forwardTonAmount, fwdPrices = FV_MSG_FORWARD_PRICES) {
  const leg = forwardFeeNanotons({ cells: FV_STAKE_LEG_CELLS, bits: FV_STAKE_LEG_BITS }, fwdPrices);
  const priced = withLiveMargin(FV_STAKE_FIXED_NEED + toBig(forwardTonAmount, 'forwardTonAmount'), 2n * leg + 1n);
  const base = toBig(floor, 'floor');
  return priced > base ? priced : base;
}

export const FV_UNJAM_INBOUND = 20_000_000n;

export const FV_PUBLISH_SELF_RESERVE = 1_000_001n;
export const FV_FWD_HEADROOM = 1_000_000n;

export const FV_REFERENCE_GAS_PRICES = Object.freeze({ flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n });
export const FV_PUBLISH_GAS_UNITS = 15_000n;
export const FV_SHARD_PUBLISH_GAS_MAX = 23_000n;
export const FV_PUBLIC_SHARD_PUBLISH_GAS_MAX = 28_000n;

function upscale(value, live, ref) {
  const v = toBig(value, 'value');
  const l = toBig(live, 'live price');
  return l > ref ? (v * l + ref - 1n) / ref : v;
}

export function scaleByNetworkPrices(value, prices = null) {
  let out = toBig(value, 'value');
  if (!prices) return out;
  const pairs = [
    [prices.gas?.flatPrice, FV_REFERENCE_GAS_PRICES.flatPrice], [prices.gas?.gasPrice, FV_REFERENCE_GAS_PRICES.gasPrice],
    [prices.fwd?.lump, FV_MSG_FORWARD_PRICES.lump], [prices.fwd?.bit, FV_MSG_FORWARD_PRICES.bit], [prices.fwd?.cell, FV_MSG_FORWARD_PRICES.cell],
  ];
  const base = out;
  for (const [live, ref] of pairs) {
    if (live === undefined || live === null) continue;
    const scaled = upscale(base, live, ref);
    if (scaled > out) out = scaled;
  }
  return out;
}

export function networkPricesWithin(prices, ratio = 10n) {
  const pairs = [
    [prices?.gas?.flatPrice, FV_REFERENCE_GAS_PRICES.flatPrice], [prices?.gas?.gasPrice, FV_REFERENCE_GAS_PRICES.gasPrice],
    [prices?.fwd?.lump, FV_MSG_FORWARD_PRICES.lump], [prices?.fwd?.bit, FV_MSG_FORWARD_PRICES.bit], [prices?.fwd?.cell, FV_MSG_FORWARD_PRICES.cell],
  ];
  return pairs.every(([live, ref]) => typeof live === 'bigint' && live >= 0n && live <= ref * toBig(ratio, 'ratio'));
}

export function vaultLiveSurchargeNanotons({ capsuleBytes, stateInit = null, prices = null, shardGas = FV_SHARD_PUBLISH_GAS_MAX }) {
  if (!prices?.gas && !prices?.fwd) return 0n;
  const gas = { ...FV_REFERENCE_GAS_PRICES, ...(prices.gas ?? {}) };
  const fwd = { ...FV_MSG_FORWARD_PRICES, ...(prices.fwd ?? {}) };
  const bytes = BigInt(Math.max(0, Math.trunc(Number(capsuleBytes) || 0)));
  const positive = (n) => (n > 0n ? n : 0n);
  const keep = positive(gasFeeNanotons(FV_PUBLISH_GAS_UNITS, gas) - FV_PUBLISH_SELF_RESERVE);
  const shard = positive(gasFeeNanotons(shardGas, gas) - gasFeeNanotons(shardGas, FV_REFERENCE_GAS_PRICES));
  const carriageAtReference = FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * bytes + FV_MSG_FORWARD_PRICES.lump;
  const scaled = [
    upscale(carriageAtReference, fwd.lump, FV_MSG_FORWARD_PRICES.lump),
    upscale(carriageAtReference, fwd.bit, FV_MSG_FORWARD_PRICES.bit),
    upscale(carriageAtReference, fwd.cell, FV_MSG_FORWARD_PRICES.cell),
  ].reduce((a, b) => (a > b ? a : b));
  const carriage = scaled - carriageAtReference;
  const init = stateInit
    ? positive(stateInitCarriageNanotons(stateInit.code, stateInit.data, fwd) - stateInitCarriageNanotons(stateInit.code, stateInit.data))
    : 0n;
  return keep + shard + carriage + init;
}

export const DIRECT_WRITE_GAS_MAX = Object.freeze({ public: 30_000n, intro: 23_000n, report: 30_000n, react: 30_000n });
export const DIRECT_OUTBOUND_FORWARD_AT_REFERENCE = 150_000n;
const DIRECT_OUTBOUND_MESSAGES = 3n;

export function directWriteLiveSurchargeNanotons({ prices = null, receiverGas }) {
  if (!prices?.gas && !prices?.fwd) return 0n;
  const gas = { ...FV_REFERENCE_GAS_PRICES, ...(prices.gas ?? {}) };
  const fwd = { ...FV_MSG_FORWARD_PRICES, ...(prices.fwd ?? {}) };
  const units = toBig(receiverGas, 'receiverGas');
  const positive = (n) => (n > 0n ? n : 0n);
  const compute = positive(gasFeeNanotons(units, gas) - gasFeeNanotons(units, FV_REFERENCE_GAS_PRICES));
  const outboundAtReference = DIRECT_OUTBOUND_FORWARD_AT_REFERENCE * DIRECT_OUTBOUND_MESSAGES;
  const outbound = [
    upscale(outboundAtReference, fwd.lump, FV_MSG_FORWARD_PRICES.lump),
    upscale(outboundAtReference, fwd.bit, FV_MSG_FORWARD_PRICES.bit),
    upscale(outboundAtReference, fwd.cell, FV_MSG_FORWARD_PRICES.cell),
  ].reduce((a, b) => (a > b ? a : b)) - outboundAtReference;
  return compute + outbound;
}

export const FV_RENT_FLOAT = 50_000_000n;
export const FV_FLOAT_TOPUP_BELOW = FV_RENT_FLOAT / 2n;
export const FV_FLOAT_RETURN_MIN = 10_000_000n;

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

export function feeVaultStateInitCell(vaultCodeBoc, ownerWallet) {
  return shardStateInitCell(vaultCodeBoc, [['owner', ownerWallet, 'address']]);
}

export function feeVaultInitializedDataCell(ownerWallet) {
  const match = /^(-?\d+):([0-9a-fA-F]{64})$/.exec(String(ownerWallet ?? '').trim());
  if (!match) throw new RangeError(`the vault owner must be a raw "workchain:hex" address, got ${JSON.stringify(ownerWallet)}`);
  const data = beginCell();
  data.uint(1, 1, 'tact init done');
  data.uint(0b100, 3, 'owner addr_std tag + anycast');
  data.uint(BigInt(Number(match[1]) & 0xff), 8, 'owner workchain');
  data.uint(BigInt(`0x${match[2]}`), 256, 'owner hash');
  data.uint(0, 4, 'staked (coins)');
  data.uint(0, 4, 'pending (coins)');
  data.uint(0, 32, 'pending_at');
  data.uint(0, 64, 'unstake_seq');
  data.uint(0, 4, 'exited (coins)');
  data.uint(0, 32, 'exited_at');
  data.uint(0, 4, 'accrued_fee (coins)');
  return data.endCell();
}

export async function feeVaultAddressBytes(vaultCodeBoc, ownerWallet) {
  const { hash } = await computeCellHashAndDepth(feeVaultStateInitCell(vaultCodeBoc, ownerWallet));
  return { workchain: 0, hash };
}

export async function feeVaultAddress(vaultCodeBoc, ownerWallet) {
  return rawAddress(await feeVaultAddressBytes(vaultCodeBoc, ownerWallet));
}




export function vaultActionValue({ directValue, capsuleBytes, feeDue, stateInit = null, protocolFee = FV_PROTOCOL_FEE, feeTransport = FV_FEE_TRANSPORT }) {
  const direct = toBig(directValue, 'directValue');
  if (feeDue === undefined || feeDue === null) {
    throw new Error('vaultActionValue: feeDue is required — pass view.fee_due; a default is only right at 100%');
  }
  if (capsuleBytes === undefined || capsuleBytes === null) {
    throw new Error('vaultActionValue: capsuleBytes is required — the carriage is charged per byte, and a '
      + 'default of 0 prices a publish that nobody sends');
  }
  const due = toBig(feeDue, 'feeDue');
  const fee = toBig(protocolFee, 'protocolFee');
  const transport = toBig(feeTransport, 'feeTransport');
  if (due > fee) throw new Error('vaultActionValue: feeDue exceeds the protocol fee');
  const feeLeg = fee + transport;
  const arrival = direct > feeLeg ? direct - feeLeg : 0n;
  const bytes = BigInt(Math.max(0, Math.trunc(Number(capsuleBytes) || 0)));
  const carriage = FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * bytes;
  const init = stateInit ? stateInitCarriageNanotons(stateInit.code, stateInit.data) : 0n;
  return arrival + carriage + init + vaultTakeFor(due);
}








const opBody = (op, build) => {
  const b = beginCell().uint(BigInt(op), 32, 'op');
  if (build) build(b);
  return bytesToBase64(serializeBoc(b.endCell()));
};

export function buildVaultDeployMessage(vaultCodeBoc, ownerWallet, vaultAddress, value = FV_DEPLOY_FUNDING) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: null,
    stateInit: feeVaultStateInitCell(vaultCodeBoc, ownerWallet),
    bounce: true,
  };
}

export function buildVaultTopUpMessage(vaultAddress, amount) {
  return { address: vaultAddress, amount: toBig(amount, 'amount'), payload: null, stateInit: null, bounce: true };
}


export function buildVaultUnstakeMessage(vaultAddress, amount, value = FV_EXIT_INBOUND) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.Unstake, (b) => b.coins(toBig(amount, 'amount'), 'amount')),
    stateInit: null,
    bounce: true,
  };
}

export function buildVaultUnstakeUnjamMessage(vaultAddress, value = FV_UNJAM_INBOUND) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.UnstakeUnjam, (b) => b),
    stateInit: null,
    bounce: true,
  };
}

export function buildVaultEmergencyExitMessage(vaultAddress, amount, value = FV_EXIT_INBOUND) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.EmergencyExit, (b) => b.coins(toBig(amount, 'amount'), 'amount')),
    stateInit: null,
    bounce: true,
  };
}

export function vaultExitDebtWindow(view, nowSec) {
  const exited = toBig(view?.exited ?? 0n, 'exited');
  if (exited === 0n) return { open: false, exited: 0n, secondsLeft: 0 };
  const at = Number(view?.exited_at ?? 0);
  const left = at + FV_EXIT_ABSORB_WINDOW - Math.floor(Number(nowSec) || 0);
  return { open: left >= 0, exited, secondsLeft: left > 0 ? left : 0 };
}

export function buildVaultWithdrawFloatMessage(vaultAddress, value = 20_000_000n) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.WithdrawFloat),
    stateInit: null,
    bounce: true,
  };
}

export function vaultInternalPublishValue(args) {
  return vaultActionValue(args) + FV_PUBLISH_SELF_RESERVE + FV_FWD_HEADROOM + vaultLiveSurchargeNanotons(args);
}

export const PS_KIND_BEACON = 2;

export function publicPublishRoute({ kind, capsuleBytes, feeDue, stateInit = null, protocolFee = FV_PROTOCOL_FEE,
  feeTransport = FV_FEE_TRANSPORT, prices = null }) {
  const k = Number(kind);
  if (!Number.isInteger(k) || k < 0 || k > 3) {
    throw new RangeError(`publicPublishRoute: ${kind} is not a PublicShard kind (expected 0..3) — CONV and `
      + 'INTRO have one door each, so the question does not arise there');
  }
  if (k === PS_KIND_BEACON) return { route: 'direct', reason: 'kind-closed' };

  const bytes = toBig(capsuleBytes, 'capsuleBytes');
  const saved = protocolFee + feeTransport - vaultTakeFor(feeDue);
  const fwd = prices?.fwd ? { ...FV_MSG_FORWARD_PRICES, ...prices.fwd } : FV_MSG_FORWARD_PRICES;
  const carriage = FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * bytes;
  const liveCarriage = [
    upscale(carriage, fwd.lump, FV_MSG_FORWARD_PRICES.lump),
    upscale(carriage, fwd.bit, FV_MSG_FORWARD_PRICES.bit),
    upscale(carriage, fwd.cell, FV_MSG_FORWARD_PRICES.cell),
  ].reduce((a, b) => (a > b ? a : b));
  const extra = liveCarriage + (stateInit ? stateInitCarriageNanotons(stateInit.code, stateInit.data, fwd) : 0n);
  return saved > extra ? { route: 'vault', reason: 'discount' } : { route: 'direct', reason: 'carriage' };
}

export function buildVaultInternalPublishMessage(vaultAddress, { shard, record, shardCode = null, shardData = null, value }) {
  if (!record) throw new TypeError('record is required');
  if (!!shardCode !== !!shardData) throw new RangeError('shardCode and shardData must be supplied together');
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.PublishViaVault, (b) => {
      b.address(shard, 'shard').ref(record, 'record');
      b.customPayloadMaybe(shardCode, 'shard_code');
      b.customPayloadMaybe(shardData, 'shard_data');
    }),
    stateInit: null,
    bounce: true,
  };
}

export const FV_FLUSH_TRIGGER = FV_RENT_FLOAT + FV_FWD_HEADROOM;

export function buildVaultFlushFeesMessage(vaultAddress, value = FV_FLUSH_TRIGGER) {
  return {
    address: vaultAddress,
    amount: toBig(value, 'value'),
    payload: opBody(FEE_VAULT_OPS.FlushFees),
    stateInit: null,
    bounce: true,
  };
}

export const FV_STAKE_FORWARD_NANOTONS = 10_000_000n;
export function vaultStakeTransferParams({ vaultAddress, ownerWallet, amount, queryId = 0n, forwardTonAmount = FV_STAKE_FORWARD_NANOTONS }) {
  const forward = toBig(forwardTonAmount, 'forwardTonAmount');
  if (forward <= 0n) throw new RangeError('staking requires a positive forward amount, or the vault credits nothing');
  const params = {
    query_id: toBig(queryId, 'queryId'),
    amount: toBig(amount, 'amount'),
    destination: vaultAddress,
    response_destination: ownerWallet,
    custom_payload: null,
    forward_ton_amount: forward,
  };
  return {
    type: 'JettonTransfer',
    params,
    attach: estimateAthWalletAttachedValueNanotons('JettonTransfer', params),
  };
}
