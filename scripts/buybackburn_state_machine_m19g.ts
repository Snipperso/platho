import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import { PLATHO_BUYBACK_STONFI_M19B } from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

export const BUYBACKBURN_M19G = {
  document: 'PLATHO.V1.BUYBACKBURN_ROUTE_INDEPENDENT_STATE_MACHINE_M19G',
  status: 'FREEZE_CANDIDATE_NOT_PRODUCTION_CONTRACT',
  routeFreezeRequired: true,
  productionBuybackBurnImplementationReady: false,
  buybackOfferAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
  routeTotalValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE,
  routeForwardGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
  ptonTransferGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
  stateModelOnly: true,
  noProductionContract: true,
  noRoutePlaceholder: true,
  noFallbackRoute: true,
  noIgnoredErrorSend: true,
} as const;

export function op32(label: string): string {
  return `0x${createHash('sha256').update(label).digest().subarray(0, 4).toString('hex').toUpperCase()}`;
}

export const BUYBACKBURN_M19G_CANDIDATE_OPS = {
  ExecuteBuybackChunk: op32('PLATHO.V1.BuybackBurn.ExecuteBuybackChunk'),
  StonfiRouteRefunded: op32('PLATHO.V1.BuybackBurn.StonfiRouteRefunded'),
  RetryAthBurnDue: op32('PLATHO.V1.BuybackBurn.RetryAthBurnDue'),
} as const;

export type BuybackPhase = 'IDLE' | 'PENDING_STONFI_SWAP' | 'PENDING_ATH_BURN';

export interface PendingBuybackM19G {
  queryId: string;
  phase: Exclude<BuybackPhase, 'IDLE'>;
  offerAmountNanotons: string;
  routeTotalValueNanotons: string;
  dexMinOutAtomicAth: string;
  buybackMinAthOutPer50TonAtomic: string;
  liveQuoteOutAtomicAth: string;
  expectedOfficialAthWallet: string;
  athMasterAddress: string;
  startedAt: number;
  receivedAthAtomic?: string;
}

export interface BuybackBurnModelStateM19G {
  phase: BuybackPhase;
  pending: PendingBuybackM19G | null;
  completedBuybacks: number;
  burnedAthAtomic: string;
  routeRefundDueNanotons: string;
  athBurnRetryDueAtomic: string;
  rejectedEvents: string[];
}

export function initialBuybackBurnStateM19G(): BuybackBurnModelStateM19G {
  return {
    phase: 'IDLE',
    pending: null,
    completedBuybacks: 0,
    burnedAthAtomic: '0',
    routeRefundDueNanotons: '0',
    athBurnRetryDueAtomic: '0',
    rejectedEvents: [],
  };
}

function reject(state: BuybackBurnModelStateM19G, code: string): BuybackBurnModelStateM19G {
  return { ...state, rejectedEvents: [...state.rejectedEvents, code] };
}

function addDec(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}

function floor95Percent(value: bigint): bigint {
  return (value * 95n) / 100n;
}

export interface ExecuteBuybackInputM19G {
  routeFreezeReady: boolean;
  queryId: string;
  offerAmountNanotons: string;
  routeTotalValueNanotons: string;
  dexMinOutAtomicAth: string;
  buybackMinAthOutPer50TonAtomic: string;
  liveQuoteOutAtomicAth: string;
  expectedOfficialAthWallet: string;
  athMasterAddress: string;
  now: number;
}

export function executeBuybackChunkM19G(
  state: BuybackBurnModelStateM19G,
  input: ExecuteBuybackInputM19G,
): BuybackBurnModelStateM19G {
  if (!input.routeFreezeReady) return reject(state, 'ROUTE_FREEZE_NOT_READY');
  if (state.pending || state.phase !== 'IDLE') return reject(state, 'PENDING_BUYBACK_ALREADY_EXISTS');
  if (input.offerAmountNanotons !== BUYBACKBURN_M19G.buybackOfferAmountNanotons.toString()) return reject(state, 'BAD_OFFER_AMOUNT');
  if (input.routeTotalValueNanotons !== BUYBACKBURN_M19G.routeTotalValueNanotons.toString()) return reject(state, 'BAD_ROUTE_TOTAL_VALUE');

  const dexMinOut = BigInt(input.dexMinOutAtomicAth);
  const staticMinOut = BigInt(input.buybackMinAthOutPer50TonAtomic);
  const quoteOut = BigInt(input.liveQuoteOutAtomicAth);
  if (dexMinOut < staticMinOut) return reject(state, 'DEX_MIN_OUT_BELOW_STATIC_CIRCUIT_BREAKER');
  if (dexMinOut < floor95Percent(quoteOut)) return reject(state, 'DEX_MIN_OUT_BELOW_95_PERCENT_LIVE_QUOTE');

  const pending: PendingBuybackM19G = {
    queryId: input.queryId,
    phase: 'PENDING_STONFI_SWAP',
    offerAmountNanotons: input.offerAmountNanotons,
    routeTotalValueNanotons: input.routeTotalValueNanotons,
    dexMinOutAtomicAth: input.dexMinOutAtomicAth,
    buybackMinAthOutPer50TonAtomic: input.buybackMinAthOutPer50TonAtomic,
    liveQuoteOutAtomicAth: input.liveQuoteOutAtomicAth,
    expectedOfficialAthWallet: input.expectedOfficialAthWallet,
    athMasterAddress: input.athMasterAddress,
    startedAt: input.now,
  };
  return { ...state, phase: 'PENDING_STONFI_SWAP', pending };
}

export function onOfficialAthReceivedM19G(
  state: BuybackBurnModelStateM19G,
  sender: string,
  amountAtomicAth: string,
): BuybackBurnModelStateM19G {
  if (!state.pending || state.pending.phase !== 'PENDING_STONFI_SWAP') return reject(state, 'NO_PENDING_STONFI_SWAP');
  if (sender !== state.pending.expectedOfficialAthWallet) return reject(state, 'ATH_NOTIFICATION_NOT_FROM_OFFICIAL_WALLET');
  if (BigInt(amountAtomicAth) < BigInt(state.pending.dexMinOutAtomicAth)) return reject(state, 'ATH_RECEIVED_BELOW_DEX_MIN_OUT');
  return {
    ...state,
    phase: 'PENDING_ATH_BURN',
    pending: { ...state.pending, phase: 'PENDING_ATH_BURN', receivedAthAtomic: amountAtomicAth },
  };
}

export function onRouteRefundOrFailureM19G(
  state: BuybackBurnModelStateM19G,
  refundedNanotons: string,
): BuybackBurnModelStateM19G {
  if (!state.pending || state.pending.phase !== 'PENDING_STONFI_SWAP') return reject(state, 'NO_PENDING_STONFI_SWAP_TO_REFUND');
  return {
    ...state,
    phase: 'IDLE',
    pending: null,
    routeRefundDueNanotons: addDec(state.routeRefundDueNanotons, refundedNanotons),
  };
}

export function onAthBurnFinalizedM19G(
  state: BuybackBurnModelStateM19G,
  sender: string,
  amountAtomicAth: string,
): BuybackBurnModelStateM19G {
  if (!state.pending || state.pending.phase !== 'PENDING_ATH_BURN') return reject(state, 'NO_PENDING_ATH_BURN');
  if (sender !== state.pending.athMasterAddress) return reject(state, 'BURN_FINALIZED_NOT_FROM_ATH_MASTER');
  if (state.pending.receivedAthAtomic !== amountAtomicAth) return reject(state, 'BURN_FINALIZED_AMOUNT_MISMATCH');
  return {
    ...state,
    phase: 'IDLE',
    pending: null,
    completedBuybacks: state.completedBuybacks + 1,
    burnedAthAtomic: addDec(state.burnedAthAtomic, amountAtomicAth),
  };
}

export function onAthBurnFailedM19G(
  state: BuybackBurnModelStateM19G,
  sender: string,
  amountAtomicAth: string,
): BuybackBurnModelStateM19G {
  if (!state.pending || state.pending.phase !== 'PENDING_ATH_BURN') return reject(state, 'NO_PENDING_ATH_BURN_TO_FAIL');
  if (sender !== state.pending.expectedOfficialAthWallet) return reject(state, 'BURN_FAILED_NOT_FROM_OFFICIAL_ATH_WALLET');
  if (state.pending.receivedAthAtomic !== amountAtomicAth) return reject(state, 'BURN_FAILED_AMOUNT_MISMATCH');
  return {
    ...state,
    phase: 'IDLE',
    pending: null,
    athBurnRetryDueAtomic: addDec(state.athBurnRetryDueAtomic, amountAtomicAth),
  };
}

export function createBuybackBurnStateMachineProfileM19G() {
  return {
    document: BUYBACKBURN_M19G.document,
    status: BUYBACKBURN_M19G.status,
    routeFreezeRequired: BUYBACKBURN_M19G.routeFreezeRequired,
    productionBuybackBurnImplementationReady: false,
    candidateOps: BUYBACKBURN_M19G_CANDIDATE_OPS,
    values: {
      buybackOfferAmountNanotons: BUYBACKBURN_M19G.buybackOfferAmountNanotons.toString(),
      routeForwardGasNanotons: BUYBACKBURN_M19G.routeForwardGasNanotons.toString(),
      ptonTransferGasNanotons: BUYBACKBURN_M19G.ptonTransferGasNanotons.toString(),
      routeTotalValueNanotons: BUYBACKBURN_M19G.routeTotalValueNanotons.toString(),
    },
    states: ['IDLE', 'PENDING_STONFI_SWAP', 'PENDING_ATH_BURN'],
    transitions: [
      'IDLE --ExecuteBuybackChunk(routeFreezeReady, exact 50 TON offer, 51.05 TON total, dex_min_out checks)--> PENDING_STONFI_SWAP',
      'PENDING_STONFI_SWAP --official BuybackBurn ATH wallet notification amount >= dex_min_out--> PENDING_ATH_BURN',
      'PENDING_STONFI_SWAP --route refund/failure proof--> IDLE + routeRefundDueNanotons',
      'PENDING_ATH_BURN --ATHBurnFinalized from ATH Master exact amount--> IDLE + burnedAthAtomic',
      'PENDING_ATH_BURN --ATHBurnFailed from official ATH wallet exact amount--> IDLE + athBurnRetryDueAtomic',
    ],
    forbidden: [
      'production BuybackBurn before STON.fi route freeze',
      'fallback route',
      'route switch',
      'DeDust route',
      'ignored-error send mode for money sends',
      'clearing pending swap from router payload claims without ATH receipt',
      'clearing pending burn without ATHBurnFinalized from ATH Master',
      'treating transfer-to-dead-address as burn',
    ],
  };
}

function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const profile = createBuybackBurnStateMachineProfileM19G();
  writeFileSync(join(ARTIFACTS_DIR, 'buybackburn_state_machine_m19g.json'), `${JSON.stringify(profile, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'BUYBACKBURN_IMPLEMENTATION_READY_M19G.txt'), 'false\n');
  console.log(JSON.stringify({ ok: true, document: profile.document, implementationReady: false, states: profile.states.length }, null, 2));
}

if (require.main === module) main();
