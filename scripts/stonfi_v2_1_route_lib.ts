import { Address, beginCell, Cell, Slice, toNano } from '@ton/core';
import { createHash } from 'crypto';

export const STONFI_SDK_SOURCE = {
  package: '@ston-fi/sdk',
  version: '2.7.0',
  repository: 'https://github.com/ston-fi/sdk/tree/main/packages/sdk',
  dexExport: '@ston-fi/sdk/dex/v2_1',
  sourceFiles: [
    'src/contracts/dex/v2_1/router/BaseRouterV2_1.ts',
    'src/contracts/dex/v2_1/constants.ts',
    'src/contracts/pTON/v2_1/PtonV2_1.ts',
    'src/contracts/pTON/v2_1/constants.ts',
  ],
} as const;

export const STONFI_V2_1 = {
  DEX_OP_SWAP: 0x6664de2a,
  PTON_OP_TON_TRANSFER: 0x01f3835d,
  DEFAULT_TX_DEADLINE_SECONDS: 15 * 60,
  BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS: toNano('0.3'),
  PTON_TON_TRANSFER_GAS: toNano('0.01'),
  CONSERVATIVE_BUYBACK_ROUTE_FORWARD_GAS: toNano('1'),
  CONSERVATIVE_BUYBACK_PTON_TRANSFER_GAS: toNano('0.05'),
  DEFAULT_REFERRAL_VALUE_BPS: 10n,
} as const;

export const PLATHO_BUYBACK_STONFI_M19B = {
  BUYBACK_OFFER_AMOUNT: toNano('50'),
  CONSERVATIVE_ROUTE_FORWARD_GAS: toNano('1'),
  CONSERVATIVE_PTON_TRANSFER_GAS: toNano('0.05'),
  CONSERVATIVE_TOTAL_STONFI_SEND_VALUE: toNano('51.05'),
  ROUTE_ATH_NOTIFY_FORWARD_GAS: 40_000_000n,
  ROUTE_NOTIFY_PAYLOAD_DOMAIN: 0x42594E46,
  EXCESS_AND_REFUND_RECEIVER: 'BuybackBurn',
  STATUS: 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
} as const;

export type AddressLike = Address | string | null | undefined;

export function toAddressOrNull(value: AddressLike): Address | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Address) return value;
  return Address.parse(value);
}

export function deterministicAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(label).digest());
}

export function addressRaw(address: Address | null): string | null {
  if (!address) return null;
  return `${address.workChain}:${address.hash.toString('hex')}`;
}

export function cellHashHex(cell: Cell): string {
  return cell.hash().toString('hex');
}

export function cellBocBase64(cell: Cell): string {
  return cell.toBoc({ idx: false }).toString('base64');
}

export interface StonfiSwapBodyV21Params {
  askJettonWalletAddress: AddressLike;
  receiverAddress: AddressLike;
  minAskAmount: bigint | number | string;
  refundAddress: AddressLike;
  excessesAddress?: AddressLike;
  dexCustomPayloadForwardGasAmount?: bigint | number | string;
  dexCustomPayload?: Cell | null;
  refundForwardGasAmount?: bigint | number | string;
  refundPayload?: Cell | null;
  ptonTonTransferGas?: bigint | number | string;
  referralValue?: bigint | number | string;
  referralAddress?: AddressLike;
  deadline: bigint | number;
}

function asBigInt(value: bigint | number | string | undefined, fallback = 0n): bigint {
  if (value === undefined) return fallback;
  return BigInt(value);
}

export function createStonfiSwapBodyV21(params: StonfiSwapBodyV21Params): Cell {
  const referralValue = asBigInt(params.referralValue, STONFI_V2_1.DEFAULT_REFERRAL_VALUE_BPS);
  if (referralValue < 0n || referralValue > 100n) {
    throw new Error('STON.fi v2.1 referralValue must be in range [0, 100] BPS');
  }

  const refundAddress = toAddressOrNull(params.refundAddress);
  if (!refundAddress) throw new Error('refundAddress is required');

  return beginCell()
    .storeUint(STONFI_V2_1.DEX_OP_SWAP, 32)
    .storeAddress(toAddressOrNull(params.askJettonWalletAddress))
    .storeAddress(refundAddress)
    .storeAddress(toAddressOrNull(params.excessesAddress) ?? refundAddress)
    .storeUint(BigInt(params.deadline), 64)
    .storeRef(
      beginCell()
        .storeCoins(asBigInt(params.minAskAmount))
        .storeAddress(toAddressOrNull(params.receiverAddress))
        .storeCoins(asBigInt(params.dexCustomPayloadForwardGasAmount))
        .storeMaybeRef(params.dexCustomPayload ?? null)
        .storeCoins(asBigInt(params.refundForwardGasAmount))
        .storeMaybeRef(params.refundPayload ?? null)
        .storeUint(referralValue, 16)
        .storeAddress(toAddressOrNull(params.referralAddress))
        .endCell(),
    )
    .endCell();
}

export function createBuybackRouteNotifyPayload(queryId: bigint | number | string): Cell {
  return beginCell()
    .storeUint(PLATHO_BUYBACK_STONFI_M19B.ROUTE_NOTIFY_PAYLOAD_DOMAIN, 32)
    .storeUint(asBigInt(queryId), 64)
    .endCell();
}

export interface StonfiPtonTonTransferBodyV21Params {
  tonAmount: bigint | number | string;
  refundAddress: AddressLike;
  forwardPayload?: Cell | null;
  queryId?: bigint | number | string;
}

export function createPtonTonTransferBodyV21(params: StonfiPtonTonTransferBodyV21Params): Cell {
  const refundAddress = toAddressOrNull(params.refundAddress);
  if (!refundAddress) throw new Error('refundAddress is required');
  const builder = beginCell()
    .storeUint(STONFI_V2_1.PTON_OP_TON_TRANSFER, 32)
    .storeUint(asBigInt(params.queryId), 64)
    .storeCoins(asBigInt(params.tonAmount))
    .storeAddress(refundAddress);

  if (params.forwardPayload) {
    builder.storeBit(true).storeRef(params.forwardPayload);
  } else {
    builder.storeBit(false);
  }

  return builder.endCell();
}

export interface StonfiTonToJettonTxParamsV21 {
  queryId?: bigint | number | string;
  offerAmount: bigint | number | string;
  minAskAmount: bigint | number | string;
  routerAddress: AddressLike;
  ptonWalletAddress: AddressLike;
  askJettonWalletAddress: AddressLike;
  receiverAddress: AddressLike;
  refundAddress: AddressLike;
  excessesAddress?: AddressLike;
  deadline: bigint | number;
  forwardGasAmount?: bigint | number | string;
  dexCustomPayloadForwardGasAmount?: bigint | number | string;
  dexCustomPayload?: Cell | null;
  refundForwardGasAmount?: bigint | number | string;
  refundPayload?: Cell | null;
  ptonTonTransferGas?: bigint | number | string;
  referralValue?: bigint | number | string;
  referralAddress?: AddressLike;
}

export interface SenderArgsLike {
  to: Address;
  value: bigint;
  body: Cell;
  forwardPayload: Cell;
}

export function buildStonfiTonToJettonTxParamsV21(params: StonfiTonToJettonTxParamsV21): SenderArgsLike {
  const forwardPayload = createStonfiSwapBodyV21({
    askJettonWalletAddress: params.askJettonWalletAddress,
    receiverAddress: params.receiverAddress,
    minAskAmount: params.minAskAmount,
    refundAddress: params.refundAddress,
    excessesAddress: params.excessesAddress,
    dexCustomPayloadForwardGasAmount: params.dexCustomPayloadForwardGasAmount,
    dexCustomPayload: params.dexCustomPayload,
    refundForwardGasAmount: params.refundForwardGasAmount,
    refundPayload: params.refundPayload,
    referralValue: params.referralValue,
    referralAddress: params.referralAddress,
    deadline: params.deadline,
  });

  const forwardTonAmount = asBigInt(
    params.forwardGasAmount,
    STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS,
  );

  const body = createPtonTonTransferBodyV21({
    queryId: params.queryId,
    tonAmount: params.offerAmount,
    refundAddress: params.refundAddress,
    forwardPayload,
  });

  return {
    to: toAddressOrNull(params.ptonWalletAddress)!,
    value: asBigInt(params.offerAmount) + forwardTonAmount + asBigInt(params.ptonTonTransferGas, STONFI_V2_1.PTON_TON_TRANSFER_GAS),
    body,
    forwardPayload,
  };
}

export function decodeStonfiSwapBodyV21(cell: Cell) {
  const s = cell.beginParse();
  const op = s.loadUint(32);
  const askJettonWalletAddress = s.loadAddress();
  const refundAddress = s.loadAddress();
  const excessesAddress = s.loadAddress();
  const deadline = s.loadUintBig(64);
  const ref = s.loadRef().beginParse();
  const minAskAmount = ref.loadCoins();
  const receiverAddress = ref.loadAddress();
  const dexCustomPayloadForwardGasAmount = ref.loadCoins();
  const dexCustomPayload = ref.loadMaybeRef();
  const refundForwardGasAmount = ref.loadCoins();
  const refundPayload = ref.loadMaybeRef();
  const referralValue = ref.loadUintBig(16);
  const referralAddress = ref.loadAddressAny();
  assertNoRemainingBitsOrRefs(s, 'STON.fi swap root');
  assertNoRemainingBitsOrRefs(ref, 'STON.fi swap details ref');
  return {
    op,
    askJettonWalletAddress,
    refundAddress,
    excessesAddress,
    deadline: deadline.toString(),
    details: {
      minAskAmount: minAskAmount.toString(),
      receiverAddress,
      dexCustomPayloadForwardGasAmount: dexCustomPayloadForwardGasAmount.toString(),
      hasDexCustomPayload: dexCustomPayload !== null,
      dexCustomPayloadHash: dexCustomPayload ? cellHashHex(dexCustomPayload) : null,
      refundForwardGasAmount: refundForwardGasAmount.toString(),
      hasRefundPayload: refundPayload !== null,
      referralValue: referralValue.toString(),
      referralAddress,
    },
  };
}

export function decodePtonTonTransferBodyV21(cell: Cell) {
  const s = cell.beginParse();
  const op = s.loadUint(32);
  const queryId = s.loadUintBig(64);
  const tonAmount = s.loadCoins();
  const refundAddress = s.loadAddress();
  const hasForwardPayload = s.loadBoolean();
  const forwardPayload = hasForwardPayload ? s.loadRef() : null;
  assertNoRemainingBitsOrRefs(s, 'pTON transfer root');
  return {
    op,
    queryId: queryId.toString(),
    tonAmount: tonAmount.toString(),
    refundAddress,
    hasForwardPayload,
    forwardPayload,
  };
}

function assertNoRemainingBitsOrRefs(slice: Slice, label: string) {
  if (slice.remainingBits !== 0 || slice.remainingRefs !== 0) {
    throw new Error(`${label} has trailing data: bits=${slice.remainingBits} refs=${slice.remainingRefs}`);
  }
}

export function jsonAddress(address: Address | null): string | null {
  return address ? addressRaw(address) : null;
}

export function jsonAddressAny(address: any): string | null {
  if (!address) return null;
  if (address instanceof Address) return addressRaw(address);
  return String(address);
}

export function normalizeDecodedSwapForJson(decoded: ReturnType<typeof decodeStonfiSwapBodyV21>) {
  return {
    op: `0x${decoded.op.toString(16).padStart(8, '0')}`,
    askJettonWalletAddress: jsonAddress(decoded.askJettonWalletAddress),
    refundAddress: jsonAddress(decoded.refundAddress),
    excessesAddress: jsonAddress(decoded.excessesAddress),
    deadline: decoded.deadline,
    details: {
      minAskAmount: decoded.details.minAskAmount,
      receiverAddress: jsonAddress(decoded.details.receiverAddress),
      dexCustomPayloadForwardGasAmount: decoded.details.dexCustomPayloadForwardGasAmount,
      hasDexCustomPayload: decoded.details.hasDexCustomPayload,
      dexCustomPayloadHash: decoded.details.dexCustomPayloadHash,
      refundForwardGasAmount: decoded.details.refundForwardGasAmount,
      hasRefundPayload: decoded.details.hasRefundPayload,
      referralValue: decoded.details.referralValue,
      referralAddress: jsonAddressAny(decoded.details.referralAddress),
    },
  };
}

export function normalizeDecodedPtonForJson(decoded: ReturnType<typeof decodePtonTonTransferBodyV21>) {
  return {
    op: `0x${decoded.op.toString(16).padStart(8, '0')}`,
    queryId: decoded.queryId,
    tonAmount: decoded.tonAmount,
    refundAddress: jsonAddress(decoded.refundAddress),
    hasForwardPayload: decoded.hasForwardPayload,
    forwardPayloadHash: decoded.forwardPayload ? cellHashHex(decoded.forwardPayload) : null,
  };
}


export interface ConservativeBuybackRouteProfileParams {
  buybackBurnAddress: AddressLike;
  refundAddress: AddressLike;
  excessesAddress: AddressLike;
  offerAmount: bigint | number | string;
  routeForwardGas: bigint | number | string;
  ptonTransferGas: bigint | number | string;
}

export function validateConservativeBuybackRouteProfile(params: ConservativeBuybackRouteProfileParams) {
  const buybackBurn = toAddressOrNull(params.buybackBurnAddress);
  const refund = toAddressOrNull(params.refundAddress);
  const excesses = toAddressOrNull(params.excessesAddress);
  if (!buybackBurn || !refund || !excesses) throw new Error('buyback/refund/excess addresses are required');
  if (!refund.equals(buybackBurn)) throw new Error('STON.fi refund_address must be BuybackBurn');
  if (!excesses.equals(buybackBurn)) throw new Error('STON.fi excesses_address must be BuybackBurn');
  if (asBigInt(params.offerAmount) !== PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT) {
    throw new Error('Buyback offer amount must remain exactly 50 TON');
  }
  if (asBigInt(params.routeForwardGas) < STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS) {
    throw new Error('Route forward gas must not be below SDK v2.1 default');
  }
  if (asBigInt(params.ptonTransferGas) < STONFI_V2_1.PTON_TON_TRANSFER_GAS) {
    throw new Error('pTON transfer gas must not be below SDK v2.1 default');
  }
  return true;
}

export interface StonfiRouteFreezeCandidateV21 {
  candidateLabel: string;
  status: 'DRAFT_NOT_FINAL_ROUTE_FREEZE' | 'FINAL_ROUTE_FREEZE_CANDIDATE';
  officialSource: typeof STONFI_SDK_SOURCE;
  addresses: {
    athMasterAddress: AddressLike;
    buybackBurnAddress: AddressLike;
    buybackBurnOfficialAthWalletAddress: AddressLike;
    stonfiRouterAddress: AddressLike;
    stonfiPoolAddressTonAth: AddressLike;
    stonfiAthSourceOwnerAddress: AddressLike;
    stonfiAthSourceWalletAddress: AddressLike;
    stonfiPtonWalletAddress: AddressLike;
    stonfiVaultAddress?: AddressLike;
    askJettonWalletAddress: AddressLike;
  };
  codeHashes: {
    athMasterCodeHash: string;
    athWalletCodeHash: string;
    stonfiRouterCodeHash: string;
    stonfiPoolCodeHash: string;
    stonfiPtonCodeHash: string;
    stonfiVaultCodeHash?: string | null;
  };
  swap: {
    queryId: bigint | number | string;
    deadline: bigint | number | string;
    offerAmountNanotons: bigint | number | string;
    conservativeTotalSendValueNanotons: bigint | number | string;
    routeForwardGasNanotons: bigint | number | string;
    ptonTransferGasNanotons: bigint | number | string;
    quoteOutAtomicAth: bigint | number | string;
    dexMinOutAtomicAth: bigint | number | string;
    buybackMinAthOutPer50TonAtomic: bigint | number | string;
  };
  sdkSample: {
    ptonTransferBodyBocBase64: string;
    stonfiSwapForwardPayloadBocBase64: string;
  };
  liveProofs: {
    sdkOrApiTxParamsCaptured: boolean;
    liveQuoteCaptured: boolean;
    successExcessesAddressObservedAsBuybackBurn: boolean;
    minOutFailureRefundObservedAsBuybackBurn: boolean;
    ptonRefundObservedAsBuybackBurn: boolean;
    bounceOrFailureBehaviorDocumented: boolean;
  };
}

export interface StonfiRouteFreezeValidationIssue {
  code: string;
  message: string;
}

export interface StonfiRouteFreezeValidationReport {
  candidateLabel: string;
  freezeReady: boolean;
  issues: StonfiRouteFreezeValidationIssue[];
  decoded?: {
    ptonTransfer: ReturnType<typeof normalizeDecodedPtonForJson>;
    stonfiSwapPayload: ReturnType<typeof normalizeDecodedSwapForJson>;
  };
  rebuiltHashes?: {
    ptonTransferBodyHash: string;
    samplePtonTransferBodyHash: string;
    stonfiSwapForwardPayloadHash: string;
    sampleStonfiSwapForwardPayloadHash: string;
  };
}

export function cellFromBocBase64(bocBase64: string): Cell {
  const cells = Cell.fromBoc(Buffer.from(bocBase64, 'base64'));
  if (cells.length !== 1) {
    throw new Error(`Expected a single root cell BOC, got ${cells.length}`);
  }
  return cells[0];
}

function hasPlausibleHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function addIssue(issues: StonfiRouteFreezeValidationIssue[], code: string, message: string) {
  issues.push({ code, message });
}

function isBasechainAddressLike(value: AddressLike): boolean {
  const parsed = toAddressOrNull(value);
  return parsed !== null && parsed.workChain === 0;
}

function floorPercent(value: bigint, numerator: bigint, denominator: bigint): bigint {
  return (value * numerator) / denominator;
}

export function validateStonfiRouteFreezeCandidateV21(candidate: StonfiRouteFreezeCandidateV21): StonfiRouteFreezeValidationReport {
  const issues: StonfiRouteFreezeValidationIssue[] = [];
  let decoded: StonfiRouteFreezeValidationReport['decoded'] | undefined;
  let rebuiltHashes: StonfiRouteFreezeValidationReport['rebuiltHashes'] | undefined;

  let buybackBurn: Address | null = null;
  let ptonWallet: Address | null = null;
  let askJettonWallet: Address | null = null;
  let stonfiAthSourceWallet: Address | null = null;
  let buybackOfficialAthWallet: Address | null = null;

  try { buybackBurn = toAddressOrNull(candidate.addresses.buybackBurnAddress); } catch { addIssue(issues, 'BAD_BUYBACK_BURN_ADDRESS', 'BuybackBurn address is not parseable'); }
  try { ptonWallet = toAddressOrNull(candidate.addresses.stonfiPtonWalletAddress); } catch { addIssue(issues, 'BAD_PTON_WALLET_ADDRESS', 'STON.fi pTON wallet address is not parseable'); }
  try { askJettonWallet = toAddressOrNull(candidate.addresses.askJettonWalletAddress); } catch { addIssue(issues, 'BAD_ASK_JETTON_WALLET_ADDRESS', 'ask jetton wallet address is not parseable'); }
  try { stonfiAthSourceWallet = toAddressOrNull(candidate.addresses.stonfiAthSourceWalletAddress); } catch { addIssue(issues, 'BAD_STONFI_ATH_SOURCE_WALLET_ADDRESS', 'STON.fi ATH source wallet address is not parseable'); }
  try { buybackOfficialAthWallet = toAddressOrNull(candidate.addresses.buybackBurnOfficialAthWalletAddress); } catch { addIssue(issues, 'BAD_BUYBACK_ATH_WALLET_ADDRESS', 'BuybackBurn official ATH wallet address is not parseable'); }

  for (const [label, addressLike] of Object.entries(candidate.addresses)) {
    if (addressLike === undefined || addressLike === null) {
      if (label === 'stonfiVaultAddress') continue;
      addIssue(issues, `MISSING_${label.toUpperCase()}`, `${label} is required`);
      continue;
    }
    try { toAddressOrNull(addressLike as AddressLike); } catch { addIssue(issues, `BAD_${label.toUpperCase()}`, `${label} is not parseable as an address`); }
  }

  const basechainAddressFields: Array<[
    keyof StonfiRouteFreezeCandidateV21['addresses'],
    string,
    string,
  ]> = [
    ['athMasterAddress', 'ATH_MASTER', 'ATH master address'],
    ['buybackBurnAddress', 'BUYBACK_BURN', 'BuybackBurn address'],
    ['buybackBurnOfficialAthWalletAddress', 'BUYBACK_OFFICIAL_ATH_WALLET', 'BuybackBurn official ATH wallet address'],
    ['stonfiRouterAddress', 'STONFI_ROUTER', 'STON.fi router address'],
    ['stonfiPoolAddressTonAth', 'STONFI_POOL', 'STON.fi TON/ATH pool address'],
    ['stonfiAthSourceOwnerAddress', 'STONFI_ATH_SOURCE_OWNER', 'STON.fi ATH source owner address'],
    ['stonfiAthSourceWalletAddress', 'STONFI_ATH_SOURCE_WALLET', 'STON.fi ATH source wallet address'],
    ['stonfiPtonWalletAddress', 'PTON_WALLET', 'STON.fi pTON wallet address'],
    ['askJettonWalletAddress', 'ASK_JETTON_WALLET', 'ask jetton wallet address'],
  ];
  for (const [field, codeLabel, label] of basechainAddressFields) {
    const value = candidate.addresses[field];
    if (value === undefined || value === null) continue;
    try {
      if (!isBasechainAddressLike(value)) {
        addIssue(issues, `ROUTE_ADDRESS_NOT_BASECHAIN_${codeLabel}`, `${label} must be a basechain workchain 0 address`);
      }
    } catch {
      // Parse errors are reported by BAD_* checks above.
    }
  }
  if (candidate.addresses.stonfiVaultAddress !== undefined && candidate.addresses.stonfiVaultAddress !== null) {
    try {
      if (!isBasechainAddressLike(candidate.addresses.stonfiVaultAddress)) {
        addIssue(issues, 'ROUTE_ADDRESS_NOT_BASECHAIN_STONFI_VAULT', 'STON.fi vault address must be a basechain workchain 0 address when provided');
      }
    } catch {
      // Parse errors are reported by BAD_* checks above.
    }
  }

  for (const [label, hash] of Object.entries(candidate.codeHashes)) {
    if (label === 'stonfiVaultCodeHash' && (hash === undefined || hash === null)) continue;
    if (!hasPlausibleHash(hash as string)) {
      addIssue(issues, `BAD_${label.toUpperCase()}`, `${label} must be a 32-byte hex code hash`);
    }
  }

  const quoteOut = asBigInt(candidate.swap.quoteOutAtomicAth);
  const dexMinOut = asBigInt(candidate.swap.dexMinOutAtomicAth);
  const buybackMin = asBigInt(candidate.swap.buybackMinAthOutPer50TonAtomic);
  const offerAmount = asBigInt(candidate.swap.offerAmountNanotons);
  const totalValue = asBigInt(candidate.swap.conservativeTotalSendValueNanotons);
  const routeForwardGas = asBigInt(candidate.swap.routeForwardGasNanotons);
  const ptonTransferGas = asBigInt(candidate.swap.ptonTransferGasNanotons);

  if (offerAmount !== PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT) {
    addIssue(issues, 'BAD_OFFER_AMOUNT', 'Buyback offer amount must be exactly 50 TON');
  }
  if (totalValue !== offerAmount + routeForwardGas + ptonTransferGas) {
    addIssue(issues, 'BAD_TOTAL_VALUE_FORMULA', 'Total STON.fi send value must equal offer + route forward gas + pTON transfer gas');
  }
  if (totalValue !== PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE) {
    addIssue(issues, 'BAD_CONSERVATIVE_TOTAL_VALUE', 'Conservative total STON.fi send value must be 51.05 TON for v1 profile');
  }
  if (routeForwardGas < PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS) {
    addIssue(issues, 'ROUTE_FORWARD_GAS_TOO_LOW', 'Route forward gas is below Platho conservative profile');
  }
  if (ptonTransferGas < PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS) {
    addIssue(issues, 'PTON_TRANSFER_GAS_TOO_LOW', 'pTON transfer gas is below Platho conservative profile');
  }
  if (quoteOut <= 0n) addIssue(issues, 'MISSING_QUOTE_OUT', 'Live quote output must be positive');
  if (buybackMin <= 0n) addIssue(issues, 'MISSING_BUYBACK_MIN_OUT', 'BUYBACK_MIN_ATH_OUT_PER_50_TON must be positive');
  if (dexMinOut < buybackMin) addIssue(issues, 'DEX_MIN_OUT_BELOW_BUYBACK_MIN', 'dex_min_out is below BUYBACK_MIN_ATH_OUT_PER_50_TON');
  if (quoteOut > 0n && dexMinOut < floorPercent(quoteOut, 95n, 100n)) {
    addIssue(issues, 'DEX_MIN_OUT_BELOW_95_PERCENT_QUOTE', 'dex_min_out must be at least floor(live quote out * 0.95)');
  }
  if (askJettonWallet && stonfiAthSourceWallet && !askJettonWallet.equals(stonfiAthSourceWallet)) {
    addIssue(issues, 'ASK_JETTON_WALLET_NOT_SOURCE_ATH_WALLET', 'Pinned ask jetton wallet must equal the ATHWallet derived from the pinned STON.fi ATH source owner');
  }

  try {
    validateConservativeBuybackRouteProfile({
      buybackBurnAddress: candidate.addresses.buybackBurnAddress,
      refundAddress: candidate.addresses.buybackBurnAddress,
      excessesAddress: candidate.addresses.buybackBurnAddress,
      offerAmount,
      routeForwardGas,
      ptonTransferGas,
    });
  } catch (e: any) {
    addIssue(issues, 'BAD_CONSERVATIVE_PROFILE', e?.message ?? String(e));
  }

  try {
    const samplePton = cellFromBocBase64(candidate.sdkSample.ptonTransferBodyBocBase64);
    const sampleSwap = cellFromBocBase64(candidate.sdkSample.stonfiSwapForwardPayloadBocBase64);
    const decodedPton = decodePtonTonTransferBodyV21(samplePton);
    const decodedSwap = decodeStonfiSwapBodyV21(sampleSwap);
    decoded = {
      ptonTransfer: normalizeDecodedPtonForJson(decodedPton),
      stonfiSwapPayload: normalizeDecodedSwapForJson(decodedSwap),
    };

    if (!decodedPton.forwardPayload || cellHashHex(decodedPton.forwardPayload) !== cellHashHex(sampleSwap)) {
      addIssue(issues, 'SAMPLE_FORWARD_PAYLOAD_MISMATCH', 'pTON sample body must contain the supplied STON.fi swap forward payload by hash');
    }
    if (ptonWallet && !toAddressOrNull(candidate.addresses.stonfiPtonWalletAddress)?.equals(ptonWallet)) {
      addIssue(issues, 'INTERNAL_PTON_ADDRESS_ERROR', 'Internal pTON address parse mismatch');
    }
    if (decodedPton.op !== STONFI_V2_1.PTON_OP_TON_TRANSFER) {
      addIssue(issues, 'BAD_PTON_OPCODE', 'pTON sample opcode does not match STON.fi v2.1 ton transfer opcode');
    }
    if (decodedSwap.op !== STONFI_V2_1.DEX_OP_SWAP) {
      addIssue(issues, 'BAD_SWAP_OPCODE', 'Swap sample opcode does not match STON.fi v2.1 swap opcode');
    }
    if (decodedPton.tonAmount !== offerAmount.toString()) {
      addIssue(issues, 'SAMPLE_OFFER_AMOUNT_MISMATCH', 'pTON sample ton_amount must be exactly 50 TON');
    }
    if (!decodedPton.refundAddress?.equals(buybackBurn!)) {
      addIssue(issues, 'SAMPLE_PTON_REFUND_NOT_BUYBACK', 'pTON sample refund_address must be BuybackBurn');
    }
    if (decodedSwap.details.minAskAmount !== dexMinOut.toString()) {
      addIssue(issues, 'SAMPLE_MIN_OUT_MISMATCH', 'STON.fi sample min_ask_amount must equal dex_min_out');
    }
    if (!decodedSwap.refundAddress?.equals(buybackBurn!)) {
      addIssue(issues, 'SAMPLE_SWAP_REFUND_NOT_BUYBACK', 'STON.fi sample refund_address must be BuybackBurn');
    }
    if (!decodedSwap.excessesAddress?.equals(buybackBurn!)) {
      addIssue(issues, 'SAMPLE_SWAP_EXCESSES_NOT_BUYBACK', 'STON.fi sample excesses_address must be BuybackBurn');
    }
    if (!decodedSwap.details.receiverAddress?.equals(buybackOfficialAthWallet!)) {
      addIssue(issues, 'SAMPLE_RECEIVER_NOT_BUYBACK_ATH_WALLET', 'STON.fi sample receiver must be BuybackBurn official ATH wallet');
    }
    if (!decodedSwap.askJettonWalletAddress?.equals(askJettonWallet!)) {
      addIssue(issues, 'SAMPLE_ASK_JETTON_WALLET_MISMATCH', 'STON.fi sample ask jetton wallet does not match pinned ask wallet address');
    }
    if (decodedSwap.details.dexCustomPayloadForwardGasAmount !== PLATHO_BUYBACK_STONFI_M19B.ROUTE_ATH_NOTIFY_FORWARD_GAS.toString()) {
      addIssue(issues, 'SAMPLE_NOTIFY_FORWARD_GAS_MISMATCH', 'STON.fi sample dex custom payload forward gas must fund BuybackBurn ATH notification');
    }
    if (!decodedSwap.details.hasDexCustomPayload) {
      addIssue(issues, 'SAMPLE_NOTIFY_CUSTOM_PAYLOAD_MISSING', 'STON.fi sample must carry the BuybackBurn route notify custom payload');
    }
    if (decodedSwap.details.dexCustomPayloadHash !== cellHashHex(createBuybackRouteNotifyPayload(candidate.swap.queryId))) {
      addIssue(issues, 'SAMPLE_NOTIFY_CUSTOM_PAYLOAD_MISMATCH', 'STON.fi sample custom payload must equal BYNF(query_id)');
    }

    if (ptonWallet && askJettonWallet && buybackBurn && buybackOfficialAthWallet) {
      const rebuilt = buildStonfiTonToJettonTxParamsV21({
        queryId: candidate.swap.queryId,
        offerAmount,
        minAskAmount: dexMinOut,
        routerAddress: candidate.addresses.stonfiRouterAddress,
        ptonWalletAddress: ptonWallet,
        askJettonWalletAddress: askJettonWallet,
        receiverAddress: buybackOfficialAthWallet,
        refundAddress: buybackBurn,
        excessesAddress: buybackBurn,
        deadline: BigInt(candidate.swap.deadline),
        forwardGasAmount: routeForwardGas,
        dexCustomPayloadForwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.ROUTE_ATH_NOTIFY_FORWARD_GAS,
        dexCustomPayload: createBuybackRouteNotifyPayload(candidate.swap.queryId),
        ptonTonTransferGas: ptonTransferGas,
      });
      if (rebuilt.value !== totalValue) {
        addIssue(issues, 'REBUILT_VALUE_MISMATCH', 'Rebuilt tx value does not equal candidate total value');
      }
      rebuiltHashes = {
        ptonTransferBodyHash: cellHashHex(rebuilt.body),
        samplePtonTransferBodyHash: cellHashHex(samplePton),
        stonfiSwapForwardPayloadHash: cellHashHex(rebuilt.forwardPayload),
        sampleStonfiSwapForwardPayloadHash: cellHashHex(sampleSwap),
      };
      if (rebuiltHashes.ptonTransferBodyHash !== rebuiltHashes.samplePtonTransferBodyHash) {
        addIssue(issues, 'REBUILT_PTON_BODY_HASH_MISMATCH', 'Manual pTON body builder does not match SDK/API sample BOC');
      }
      if (rebuiltHashes.stonfiSwapForwardPayloadHash !== rebuiltHashes.sampleStonfiSwapForwardPayloadHash) {
        addIssue(issues, 'REBUILT_SWAP_PAYLOAD_HASH_MISMATCH', 'Manual swap payload builder does not match SDK/API sample BOC');
      }
    }
  } catch (e: any) {
    addIssue(issues, 'SAMPLE_DECODE_FAILED', e?.message ?? String(e));
  }

  for (const [label, ok] of Object.entries(candidate.liveProofs)) {
    if (!ok) addIssue(issues, `MISSING_${label.toUpperCase()}`, `Live proof is required: ${label}`);
  }

  if (candidate.status !== 'FINAL_ROUTE_FREEZE_CANDIDATE') {
    addIssue(issues, 'STATUS_NOT_FINAL_ROUTE_FREEZE_CANDIDATE', 'Route freeze candidate status must be FINAL_ROUTE_FREEZE_CANDIDATE');
  }

  return {
    candidateLabel: candidate.candidateLabel,
    freezeReady: issues.length === 0,
    issues,
    decoded,
    rebuiltHashes,
  };
}
