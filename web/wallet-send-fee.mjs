
import {
  PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET,
  PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER,
  PLATHO_WALLET_MESSAGE_FRAMING_BYTES,
} from './platho-wallet.mjs?v=93';

export const WALLET_SEND_FEE_BASE_NANOTONS = 1_100_000n;

export const WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS = 480_000n;

export const WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS = Object.freeze({
  1: 3_730_000n,
  2: 4_930_000n,
  4: 7_330_000n,
  8: 12_120_000n,
  16: 21_730_000n,
  32: 40_930_000n,
});

export const WALLET_SEND_FEE_PER_PART_NANOTONS = WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS[1];

export const WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS = Object.freeze({
  1: 2_454,
  2: 3_504,
  4: 5_598,
  8: 9_792,
  16: 18_177,
  32: 35_226,
});

const SIZE_CLASSES = Object.freeze([1, 2, 4, 8, 16, 32]);

export function walletSendSizeClassForPayloadBytes(payloadBytes) {
  const bytes = Number(payloadBytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return SIZE_CLASSES[0];
  for (const sizeClass of SIZE_CLASSES) {
    if (bytes <= WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass]) return sizeClass;
  }
  return SIZE_CLASSES[SIZE_CLASSES.length - 1];
}

function normalizedSizeClass(sizeClass) {
  const requested = Number(sizeClass);
  const normalized = Number.isFinite(requested) && requested > 0 ? requested : 1;
  return SIZE_CLASSES.find((value) => value >= normalized) ?? SIZE_CLASSES[SIZE_CLASSES.length - 1];
}

function perPartFeeNanotons(sizeClass) {
  return WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS[normalizedSizeClass(sizeClass)];
}

export function walletSendPayloadBytesFor(sizeClass) {
  return WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[normalizedSizeClass(sizeClass)];
}

export function walletSendExternalCount(sizeClasses = []) {
  const list = Array.isArray(sizeClasses) ? sizeClasses : [sizeClasses];
  if (list.length === 0) return 1;
  let externals = 1;
  let bytes = 0;
  let count = 0;
  for (const sizeClass of list) {
    const messageBytes = walletSendPayloadBytesFor(sizeClass) + PLATHO_WALLET_MESSAGE_FRAMING_BYTES;
    if (count > 0 && (count >= PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER
      || bytes + messageBytes > PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET)) {
      externals += 1;
      bytes = 0;
      count = 0;
    }
    bytes += messageBytes;
    count += 1;
  }
  return externals;
}

export function walletSendFeeNanotons(sizeClasses = []) {
  const list = Array.isArray(sizeClasses) ? sizeClasses : [sizeClasses];
  const parts = list.length > 0 ? list : [1];
  let fee = WALLET_SEND_FEE_BASE_NANOTONS * BigInt(walletSendExternalCount(list));
  for (const sizeClass of parts) fee += perPartFeeNanotons(sizeClass);
  return fee;
}
