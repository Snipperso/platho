import { ed25519, x25519 } from './vendor/@noble/curves/ed25519.js';
import { hmac } from './vendor/@noble/hashes/hmac.js';
import { pbkdf2Async } from './vendor/@noble/hashes/pbkdf2.js';
import { sha256 as sha256Sync, sha512 } from './vendor/@noble/hashes/sha2.js';
import { ml_kem768 } from './vendor/@noble/post-quantum/ml-kem.js';
import { TON_MNEMONIC_WORDLIST } from './ton-mnemonic-wordlist.mjs?v=2';
import { cutoverUpdateRequired } from './cutover-epoch.mjs?v=7';
import {
  CONTRACT_CRYPTO_SUITE,
  CRYPTO_SUITES,
  ED25519_SECRET_KEY_BYTES,
  MLKEM768_PUBLIC_KEY_BYTES,
  computeHybridKeyId,
  createMessagingIdentity,
  parseTonAddress,
} from './crypto/platho-crypto.mjs?v=31';
import { tonCell } from './pwa-contract-transactions.mjs?v=59';
import { TON_RPC_MAX_QUEUE_WAIT_MS, beginTonRpcPhaseProfile, broadcastThroughNextDoor, toncenterBroadcastExitCode } from './ton-rpc-transport.mjs?v=112';

const {
  beginCell,
  serializeBoc,
  parseBocBase64,
  computeCellHashAndDepth,
  bytesToBase64,
  bytesToHex,
  concatBytes,
} = tonCell;

export const PLATHO_WALLET_VERSION = 1;
export const PLATHO_WALLET_KIND = 'platho.wallet.v5r1';
export const PLATHO_WALLET_SEED_BYTES = 32;
export const PLATHO_WALLET_MNEMONIC_WORDS = 24;
export const PLATHO_WALLET_WORKCHAIN = 0;
export const PLATHO_WALLET_NETWORK_GLOBAL_IDS = Object.freeze({
  MAINNET: -239,
  TESTNET: -3,
});
export const PLATHO_WALLET_SUBWALLET_NUMBER = 0;
export const PLATHO_WALLET_ID = 0x7fffff11;
export const PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER = 255;
export const PLATHO_WALLET_MAX_EXTERNAL_MESSAGE_BYTES = 65535;
export const PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET = 58000;
export const PLATHO_WALLET_MESSAGE_FRAMING_BYTES = 150;
export const PLATHO_WALLET_V5R1_CODE_BOC =
  'te6ccgECFAEAAoEAART/APSkE/S88sgLAQIBIAINAgFIAwQC3NAg10nBIJFbj2Mg1wsfIIIQZXh0br0hghBzaW50vbCSXwPgghBleHRuuo60gCDXIQHQdNch+kAw+kT4KPpEMFi9kVvg7UTQgQFB1yH0BYMH9A5voTGRMOGAQNchcH/bPOAxINdJgQKAuZEw4HDiEA8CASAFDAIBIAYJAgFuBwgAGa3OdqJoQCDrkOuF/8AAGa8d9qJoQBDrkOuFj8ACAUgKCwAXsyX7UTQcdch1wsfgABGyYvtRNDXCgCAAGb5fD2omhAgKDrkPoCwBAvIOAR4g1wsfghBzaWduuvLgin8PAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYEAP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERITAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAcjDXLAgkji0h8uCS0gDtRNDSAFETuvLQj1RQMJExnAGBAUDXIdcKAPLgjuLIygBYzxbJ7VST8sCN4gAQk1vbMeHXTNA=';

const encoder = new TextEncoder();
const TON_MNEMONIC_PBKDF_ITERATIONS = 100000;
const TON_MNEMONIC_WORD_SET = new Set(TON_MNEMONIC_WORDLIST);

function assertBytes(value, length, name) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.length !== length) throw new RangeError(`${name} must be ${length} bytes`);
  return bytes;
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function crc16Ccitt(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

export function formatTonUserFriendlyAddress(address, options = {}) {
  const parsed = parseTonAddress(address);
  const bounceable = options.bounceable === true;
  const testOnly = options.testOnly === true;
  const tag = (bounceable ? 0x11 : 0x51) | (testOnly ? 0x80 : 0);
  const body = new Uint8Array(34);
  body[0] = tag;
  body[1] = parsed.workchain === -1 ? 0xff : parsed.workchain & 0xff;
  body.set(parsed.hash, 2);
  const checksum = crc16Ccitt(body);
  return bytesToBase64Url(concatBytes(body, new Uint8Array([checksum >> 8, checksum & 0xff])));
}

export function normalizeTonMnemonic(value) {
  const words = (Array.isArray(value) ? value : String(value ?? '').trim().split(/\s+/))
    .map((word) => String(word).trim().toLowerCase())
    .filter(Boolean);
  if (words.length !== PLATHO_WALLET_MNEMONIC_WORDS) {
    throw new Error(`GRAM recovery phrase must contain ${PLATHO_WALLET_MNEMONIC_WORDS} words`);
  }
  for (const word of words) {
    if (!TON_MNEMONIC_WORD_SET.has(word)) {
      throw new Error('GRAM recovery phrase contains a word outside the GRAM word list');
    }
  }
  return words;
}

function mnemonicText(words) {
  return normalizeTonMnemonic(words).join(' ');
}

async function mnemonicEntropy(words, password = '') {
  return hmac(sha512, encoder.encode(mnemonicText(words)), encoder.encode(password ?? ''));
}

async function pbkdf2Sha512(key, salt, iterations, length) {
  return pbkdf2Async(sha512, key, salt, {
    c: iterations,
    dkLen: length,
    asyncTick: 10,
  });
}

async function isBasicTonMnemonicSeed(entropy) {
  const seed = await pbkdf2Sha512(
    entropy,
    'TON seed version',
    Math.max(1, Math.floor(TON_MNEMONIC_PBKDF_ITERATIONS / 256)),
    64,
  );
  return seed[0] === 0;
}

export async function validateTonMnemonic(value, password = '') {
  const words = normalizeTonMnemonic(value);
  return isBasicTonMnemonicSeed(await mnemonicEntropy(words, password));
}

async function tonMnemonicSeed(words, salt, password = '') {
  return pbkdf2Sha512(
    await mnemonicEntropy(words, password),
    salt,
    TON_MNEMONIC_PBKDF_ITERATIONS,
    64,
  );
}

async function tonMnemonicWalletSecretKey(words, password = '') {
  return (await tonMnemonicSeed(words, 'TON default seed', password)).subarray(0, 32);
}

function randomWordIndex() {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.getRandomValues) throw new Error('crypto.getRandomValues is unavailable');
  const range = TON_MNEMONIC_WORDLIST.length;
  const limit = Math.floor(0x100000000 / range) * range;
  const bytes = new Uint8Array(4);
  while (true) {
    cryptoImpl.getRandomValues(bytes);
    const value = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    if (value < limit) return value % range;
  }
}

export async function createTonMnemonic() {
  while (true) {
    const words = Array.from({ length: PLATHO_WALLET_MNEMONIC_WORDS }, () => TON_MNEMONIC_WORDLIST[randomWordIndex()]);
    if (await validateTonMnemonic(words)) return words;
  }
}

async function hkdfBytes(seed, info, length) {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('crypto.subtle is unavailable');
  const key = await cryptoImpl.subtle.importKey('raw', seed, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoImpl.subtle.deriveBits({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: encoder.encode('PLATHO.WALLET.SEED.V1'),
    info: encoder.encode(info),
  }, key, length * 8);
  return new Uint8Array(bits);
}

async function sha256(bytes) {
  return sha256Sync(bytes);
}

function walletCodeCell() {
  return parseBocBase64(PLATHO_WALLET_V5R1_CODE_BOC);
}

function uint32FromSigned(value) {
  return Number(value) >>> 0;
}

function signedFromUint32(value) {
  const normalized = Number(value) >>> 0;
  return normalized >= 0x80000000 ? normalized - 0x100000000 : normalized;
}

export async function derivePlathoWalletTag(wallet, purpose, length = 16) {
  if (!wallet?.seed) throw new Error('Platho wallet is not loaded');
  if (!purpose) throw new Error('A wallet tag needs a purpose');
  const bytes = await hkdfBytes(wallet.seed, `tag.${purpose}`, length);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function plathoWalletRecordSigner(wallet) {
  if (!wallet?.seed) throw new Error('Platho wallet is not loaded');
  const key = await hkdfBytes(wallet.seed, 'key.wallet.record.mac.v1', 32);
  return (text) => bytesToHex(hmac(sha256Sync, key, encoder.encode(String(text))));
}

export function walletIdV5R1Raw(options = {}) {
  const networkGlobalId = Number(options.networkGlobalId ?? PLATHO_WALLET_NETWORK_GLOBAL_IDS.MAINNET);
  const workchain = Number(options.workchain ?? PLATHO_WALLET_WORKCHAIN);
  const subwalletNumber = Number(options.subwalletNumber ?? PLATHO_WALLET_SUBWALLET_NUMBER);
  if (!Number.isInteger(networkGlobalId) || networkGlobalId < -2147483648 || networkGlobalId > 2147483647) {
    throw new RangeError('wallet networkGlobalId must fit int32');
  }
  if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
    throw new RangeError('wallet workchain must fit int8');
  }
  if (!Number.isInteger(subwalletNumber) || subwalletNumber < 0 || subwalletNumber >= 0x8000) {
    throw new RangeError('wallet subwalletNumber must fit uint15');
  }
  const workchainByte = workchain < 0 ? 0x100 + workchain : workchain;
  const contextUnsigned = (0x80000000 | (workchainByte << 23) | subwalletNumber) >>> 0;
  const contextSigned = signedFromUint32(contextUnsigned);
  return uint32FromSigned((networkGlobalId | 0) ^ contextSigned);
}

function walletDataCell(publicKey, walletId = PLATHO_WALLET_ID) {
  return beginCell()
    .uint(1n, 1, 'wallet.signature_allowed')
    .uint(0n, 32, 'wallet.seqno')
    .uint(walletId, 32, 'wallet.wallet_id')
    .bytesValue(publicKey, 32, 'wallet.public_key')
    .uint(0n, 1, 'wallet.extensions_empty')
    .endCell();
}

function stateInitCell(code, data) {
  return beginCell()
    .uint(0n, 1, 'state_init.split_depth_none')
    .uint(0n, 1, 'state_init.special_none')
    .uint(1n, 1, 'state_init.code_some')
    .ref(code, 'state_init.code')
    .uint(1n, 1, 'state_init.data_some')
    .ref(data, 'state_init.data')
    .uint(0n, 1, 'state_init.library_empty')
    .endCell();
}

async function contractAddressRaw(workchain, init) {
  const { hash } = await computeCellHashAndDepth(init);
  return `${workchain}:${bytesToHex(hash)}`;
}

async function derivePlathoWalletFromKeyMaterial(rootSeed, walletSecretKeyBytes, recoveryText, options = {}) {
  const seed = assertBytes(rootSeed, PLATHO_WALLET_SEED_BYTES, 'Platho wallet root seed');
  const walletSecretKey = assertBytes(walletSecretKeyBytes, ED25519_SECRET_KEY_BYTES, 'Platho wallet secret key');
  const walletPublicKey = ed25519.getPublicKey(walletSecretKey);
  const workchain = options.workchain ?? PLATHO_WALLET_WORKCHAIN;
  const networkGlobalId = options.networkGlobalId ?? PLATHO_WALLET_NETWORK_GLOBAL_IDS.MAINNET;
  const subwalletNumber = options.subwalletNumber ?? PLATHO_WALLET_SUBWALLET_NUMBER;
  const walletId = options.walletId ?? walletIdV5R1Raw({ networkGlobalId, workchain, subwalletNumber });
  const code = walletCodeCell();
  const data = walletDataCell(walletPublicKey, walletId);
  const init = stateInitCell(code, data);
  const address = await contractAddressRaw(workchain, init);
  const testOnly = networkGlobalId === PLATHO_WALLET_NETWORK_GLOBAL_IDS.TESTNET;
  return {
    version: PLATHO_WALLET_VERSION,
    kind: PLATHO_WALLET_KIND,
    seed,
    seedText: recoveryText,
    recoveryPhrase: recoveryText,
    walletSecretKey,
    walletPublicKey,
    walletId,
    walletIdSpec: {
      networkGlobalId,
      context: {
        workchain,
        walletVersion: 'v5r1',
        subwalletNumber,
      },
    },
    networkGlobalId,
    subwalletNumber,
    workchain,
    address,
    friendlyAddress: formatTonUserFriendlyAddress(address, {
      bounceable: false,
      testOnly,
    }),
    stateInit: init,
    stateInitBoc: bytesToBase64(serializeBoc(init)),
  };
}

export async function derivePlathoWalletFromMnemonic(mnemonic, options = {}) {
  const words = normalizeTonMnemonic(mnemonic);
  if (!(await validateTonMnemonic(words, options.password ?? ''))) {
    throw new Error('GRAM recovery phrase checksum is invalid');
  }
  const walletSecretKey = await tonMnemonicWalletSecretKey(words, options.password ?? '');
  return derivePlathoWalletFromKeyMaterial(
    await hkdfBytes(walletSecretKey, 'platho-messaging-root-v1', PLATHO_WALLET_SEED_BYTES),
    walletSecretKey,
    mnemonicText(words),
    options,
  );
}

export async function createPlathoWallet(options = {}) {
  return derivePlathoWalletFromMnemonic(options.mnemonic ?? await createTonMnemonic(), options);
}

export async function importPlathoWallet(recoveryPhrase, options = {}) {
  return derivePlathoWalletFromMnemonic(recoveryPhrase, options);
}

export function exportPlathoWalletRecoveryPhrase(wallet) {
  if (!wallet?.seedText) throw new Error('Platho wallet is not loaded');
  return wallet.seedText;
}

export async function deriveVaultAuthKeyPairFromWallet(wallet) {
  if (!wallet?.seed) throw new Error('Platho wallet is not loaded');
  const secretKey = await hkdfBytes(wallet.seed, 'vault.auth.ed25519', ED25519_SECRET_KEY_BYTES);
  return {
    secretKey,
    publicKey: ed25519.getPublicKey(secretKey),
  };
}

export async function deriveMessagingIdentityFromWallet(wallet, suite) {
  if (!wallet?.seed) throw new Error('Platho wallet is not loaded');
  const normalizedSuite = CRYPTO_SUITES.HYBRID_V1;
  const x25519SecretKey = await hkdfBytes(wallet.seed, `messaging.${normalizedSuite}.x25519`, 32);
  const x25519PublicKey = x25519.getPublicKey(x25519SecretKey);
  const signingSecretKey = await hkdfBytes(wallet.seed, `messaging.${normalizedSuite}.ed25519`, ED25519_SECRET_KEY_BYTES);
  const scanSecretKey = await hkdfBytes(wallet.seed, 'messaging.hybrid-v1.scan.x25519', 32);
  const mlKemSeed = await hkdfBytes(wallet.seed, 'messaging.hybrid-v1.ml-kem768', 64);
  const mlKem = ml_kem768.keygen(mlKemSeed);
  const mlKem768PublicKey = assertBytes(mlKem.publicKey, MLKEM768_PUBLIC_KEY_BYTES, 'mlKem768PublicKey');
  const mlKem768SecretKey = assertBytes(mlKem.secretKey, 2400, 'mlKem768SecretKey');
  const mlKem768PublicKeyHash = await sha256(mlKem768PublicKey);
  const encryptionKeyPair = {
    suite: CRYPTO_SUITES.HYBRID_V1,
    contractSuite: CONTRACT_CRYPTO_SUITE.HYBRID,
    keyId: await computeHybridKeyId(x25519PublicKey, mlKem768PublicKey),
    x25519SecretKey,
    x25519PublicKey,
    mlKem768SecretKey,
    mlKem768PublicKey,
    mlKem768PublicKeyHash,
    mlKem768PublicKeyLen: MLKEM768_PUBLIC_KEY_BYTES,
  };
  return createMessagingIdentity({ encryptionKeyPair, signingSecretKey, scanSecretKey });
}

export function storeInternalMessage(message) {
  const destination = parseTonAddress(message.address);
  const value = BigInt(message.amount ?? 0);
  const body = message.payload ? parseBocBase64(message.payload) : beginCell().endCell();
  const stateInit = message.stateInit ?? null;
  const builder = beginCell()
    .uint(0n, 1, 'int_msg_info.tag')
    .uint(1n, 1, 'int_msg_info.ihr_disabled')
    .uint(message.bounce === false ? 0n : 1n, 1, 'int_msg_info.bounce')
    .uint(0n, 1, 'int_msg_info.bounced')
    .uint(0n, 2, 'int_msg_info.src_none')
    .address(destination.raw, 'int_msg_info.dest')
    .coins(value, 'int_msg_info.value')
    .uint(0n, 1, 'int_msg_info.extra_currencies_empty')
    .coins(0n, 'int_msg_info.ihr_fee')
    .coins(0n, 'int_msg_info.fwd_fee')
    .uint(0n, 64, 'int_msg_info.created_lt')
    .uint(0n, 32, 'int_msg_info.created_at');
  if (stateInit) {
    builder
      .uint(1n, 1, 'message.init_some')
      .uint(1n, 1, 'message.init_ref')
      .ref(stateInit, 'message.init');
  } else {
    builder.uint(0n, 1, 'message.init_none');
  }
  return builder
    .uint(1n, 1, 'message.body_ref')
    .ref(body, 'message.body')
    .endCell();
}

export function walletMessageToRecord(message) {
  return {
    address: String(message.address),
    amount: BigInt(message.amount ?? 0).toString(),
    bounce: message.bounce !== false,
    payload: message.payload ?? null,
    stateInit: message.stateInit ? bytesToBase64(serializeBoc(message.stateInit)) : null,
  };
}

export function walletMessageFromRecord(record) {
  return {
    address: String(record.address),
    amount: BigInt(String(record.amount ?? '0')),
    bounce: record.bounce !== false,
    payload: record.payload ?? null,
    stateInit: record.stateInit ? parseBocBase64(record.stateInit) : null,
  };
}

function storeOutList(messages, sendMode) {
  let cell = beginCell().endCell();
  const safeSendMode = sendMode | 2;
  for (const message of messages) {
    cell = beginCell()
      .ref(cell, 'out_list.prev')
      .uint(0x0ec3c86dn, 32, 'out_action_send_msg.tag')
      .uint(safeSendMode, 8, 'out_action_send_msg.mode')
      .ref(storeInternalMessage(message), 'out_action_send_msg.out_msg')
      .endCell();
  }
  return cell;
}

function storeV5R1Actions(builder, messages, sendMode) {
  builder
    .uint(1n, 1, 'wallet.actions.basic_some')
    .ref(storeOutList(messages, sendMode), 'wallet.actions.basic')
    .uint(0n, 1, 'wallet.actions.extended_none');
  return builder;
}

export const WALLET_CLOCK_TOLERANCE_MS = 60_000;
const WALLET_CLOCK_MAX_OFFSET_MS = 2 * 86_400_000;
const WALLET_CLOCK_VOUCH_TOLERANCE_MS = 10 * 60_000;
const WALLET_CLOCK_VOUCHED_MAX_MS = 3_650 * 86_400_000;
let walletClockOffsetMs = 0;
let walletClockRefresh = null;
let walletClockAnchor = null;
let walletClockJumpReported = null;
const walletMonotonicNowMs = () => (typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : null);
let walletClockDoubted = false;

export function noteChainTime(chainUnixSeconds, observedAtMs = Date.now(), { vouchedOffsetMs = null } = {}) {
  const chainMs = Number(chainUnixSeconds) * 1000;
  if (!Number.isFinite(chainMs) || chainMs <= 0) return walletClockOffsetMs;
  walletClockDoubted = false;
  const offset = chainMs - Number(observedAtMs);
  const vouched = vouchedOffsetMs !== null && Number.isFinite(Number(vouchedOffsetMs))
    && Math.abs(offset - Number(vouchedOffsetMs)) <= WALLET_CLOCK_VOUCH_TOLERANCE_MS && Math.abs(offset) <= WALLET_CLOCK_VOUCHED_MAX_MS;
  if (Math.abs(offset) > WALLET_CLOCK_MAX_OFFSET_MS && !vouched) return walletClockOffsetMs;
  walletClockOffsetMs = Math.abs(offset) > WALLET_CLOCK_TOLERANCE_MS ? offset : 0;
  walletClockAnchor = { wallMs: Date.now(), monoMs: walletMonotonicNowMs() };
  return walletClockOffsetMs;
}

export function walletClockJumped(now = Date.now()) {
  const mono = walletMonotonicNowMs();
  if (!walletClockAnchor || mono === null || walletClockAnchor.monoMs === null) return false;
  return Math.abs((now - walletClockAnchor.wallMs) - (mono - walletClockAnchor.monoMs)) > WALLET_CLOCK_TOLERANCE_MS;
}

function walletOffsetInForce(now) {
  if (!walletClockJumped(now)) return walletClockOffsetMs;
  if (walletClockJumpReported !== walletClockAnchor) {
    walletClockJumpReported = walletClockAnchor;
    walletClockDoubted = walletClockRefresh !== null;
    try { walletClockRefresh?.(); } catch { }
  }
  return 0;
}

export function noteWalletReturned() {
  if (walletClockAnchor) walletClockAnchor = { wallMs: Date.now(), monoMs: walletMonotonicNowMs() };
  walletClockDoubted = walletClockRefresh !== null;
  try { walletClockRefresh?.(); } catch { }
}

export function walletClockInDoubt() {
  return walletClockDoubted;
}

export function walletChainClockOffsetMs() {
  return walletOffsetInForce(Date.now());
}

export function walletChainNowMs() {
  const now = Date.now();
  return now + walletOffsetInForce(now);
}

export function setWalletClockRefresh(callback) {
  walletClockRefresh = typeof callback === 'function' ? callback : null;
}

function walletTransferBody(wallet, messages, options = {}) {
  const seqno = Number(options.seqno ?? 0);
  const timeout = Number(options.timeout ?? Math.floor(walletChainNowMs() / 1000) + 300);
  const sendMode = Number(options.sendMode ?? 3);
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0 || list.length > PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER) {
    throw new RangeError(`Wallet transfer supports 1-${PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER} messages`);
  }
  const signing = beginCell()
    .uint(0x7369676en, 32, 'wallet.auth_signed_external')
    .uint(wallet.walletId ?? PLATHO_WALLET_ID, 32, 'wallet_id');
  signing.uint(timeout, 32, seqno === 0 ? 'wallet.timeout_init' : 'wallet.timeout');
  signing.uint(seqno, 32, 'wallet.seqno');
  storeV5R1Actions(signing, list, sendMode);
  const signingCell = signing.endCell();
  return computeCellHashAndDepth(signingCell).then(({ hash }) => {
    const signature = ed25519.sign(hash, wallet.walletSecretKey);
    return beginCell()
      .cell(signingCell, 'wallet.signing_message')
      .bytesValue(signature, 64, 'wallet.signature')
      .endCell();
  });
}

function externalInMessage(wallet, body, options = {}) {
  const includeStateInit = options.includeStateInit !== false;
  return beginCell()
    .uint(2n, 2, 'ext_in_msg_info.tag')
    .uint(0n, 2, 'ext_in_msg_info.src_none')
    .address(wallet.address, 'ext_in_msg_info.dest')
    .coins(0n, 'ext_in_msg_info.import_fee')
    .maybeRef(includeStateInit ? wallet.stateInit : null, 'external.init')
    .uint(1n, 1, 'external.body_ref')
    .ref(body, 'external.body')
    .endCell();
}

function readSeqnoFromStack(result) {
  const stack = result?.stack ?? result?.result?.stack ?? result;
  const first = Array.isArray(stack) ? stack[0] : null;
  if (first == null) return 0;
  if (typeof first === 'bigint' || typeof first === 'number') return Number(first);
  if (typeof first === 'string') return Number(BigInt(first));
  if (Array.isArray(first)) return Number(BigInt(first[1] ?? 0));
  if (typeof first === 'object') return Number(BigInt(first.value ?? first.num ?? 0));
  return 0;
}

function walletSeqnoUnavailableError(message, cause) {
  const error = new Error(message);
  error.code = 'PLATHO_WALLET_SEQNO_UNAVAILABLE';
  if (cause) error.cause = cause;
  return error;
}

const TON_GET_METHOD_UNINITIALIZED_EXIT_CODE = -13;

function tonRpcExitCodeIsUninitializedAccount(error) {
  return Number(error?.exitCode) === TON_GET_METHOD_UNINITIALIZED_EXIT_CODE;
}

const UNINITIALIZED_WALLET_ACCOUNT_STATUSES = new Set([
  'uninitialized', 'uninit', 'nonexist', 'nonexistent', 'empty', 'none',
]);

function readWalletAccountStatus(state) {
  const raw = state?.state
    ?? state?.status
    ?? state?.account_state
    ?? state?.result?.state
    ?? state?.result?.status
    ?? state?.result?.account_state
    ?? state?.account?.state
    ?? state?.account?.status
    ?? null;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : null;
}

async function walletAccountIsUninitialized(wallet, transport) {
  if (typeof transport?.getAccountState !== 'function') return false;
  try {
    const state = await transport.getAccountState({ address: wallet.address }, { skipIfRateLimited: false });
    const status = readWalletAccountStatus(state);
    return status != null && UNINITIALIZED_WALLET_ACCOUNT_STATUSES.has(status);
  } catch {
    return false;
  }
}

export async function getPlathoWalletSeqno(wallet, transport, options = {}) {
  if (!transport?.runGetMethod) {
    if (options.allowSeqnoFallback === true) return 0;
    throw walletSeqnoUnavailableError('TON RPC runGetMethod transport is required to read wallet seqno before signing');
  }
  try {
    return readSeqnoFromStack(await transport.runGetMethod({
      address: wallet.address,
      method: 'seqno',
      stack: [],
      cacheTtlMs: 0,
      priority: options.priority ?? 'critical',
      skipIfRateLimited: false,
      stopOnUninitializedAccount: true,
    }));
  } catch (error) {
    if (options.allowSeqnoFallback === true) return 0;
    if (tonRpcExitCodeIsUninitializedAccount(error)) return 0;
    if (await walletAccountIsUninitialized(wallet, transport)) return 0;
    throw walletSeqnoUnavailableError('TON RPC seqno read failed; refusing to sign with fallback seqno 0', error);
  }
}

export async function buildPlathoWalletExternalBoc(wallet, messages, options = {}) {
  const seqno = options.seqno ?? await getPlathoWalletSeqno(wallet, options.transport, options);
  const body = await walletTransferBody(wallet, messages, { ...options, seqno });
  const root = externalInMessage(wallet, body, {
    includeStateInit: options.includeStateInit ?? seqno === 0,
  });
  const boc = bytesToBase64(serializeBoc(root));
  const externalBytes = Math.ceil((boc.length * 3) / 4);
  if (externalBytes > PLATHO_WALLET_MAX_EXTERNAL_MESSAGE_BYTES) {
    throw new RangeError(
      `Wallet external is ${externalBytes} bytes, exceeds TON max_ext_msg_size ${PLATHO_WALLET_MAX_EXTERNAL_MESSAGE_BYTES} `
      + '(validators drop it at ingest) — split the message into fewer/smaller parts',
    );
  }
  return { boc, seqno, wallet: wallet.address };
}

function estimateWalletMessageExternalBytes(message) {
  const payload = message?.payload;
  const payloadBytes = typeof payload === 'string' ? Math.ceil((payload.length * 3) / 4) : 0;
  return payloadBytes + PLATHO_WALLET_MESSAGE_FRAMING_BYTES;
}

export function chunkWalletMessages(
  messages,
  maxPerTransfer = PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER,
  byteBudget = PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET,
) {
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0) throw new RangeError('Wallet transaction must include at least one message');
  const chunks = [];
  let current = [];
  let currentBytes = 0;
  for (const message of list) {
    const messageBytes = estimateWalletMessageExternalBytes(message);
    if (current.length > 0 && (current.length >= maxPerTransfer || currentBytes + messageBytes > byteBudget)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(message);
    currentBytes += messageBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const walletSeqnoFloors = new Map();
const WALLET_SEQNO_FLOOR_GRACE_MS = 90_000;

function walletSeqnoFloorKey(wallet) {
  return String(wallet?.address ?? '');
}

function applyWalletSeqnoFloor(wallet, chainSeqno, now = walletChainNowMs()) {
  const key = walletSeqnoFloorKey(wallet);
  if (!key) return chainSeqno;
  if (chainSeqno === 0) {
    const pending = walletPendingExternals.get(key);
    if (pending && Number(pending.seqno) === 0 && Number(pending.validUntil) * 1000 > now) {
      walletSeqnoFloors.set(key, { seqno: 1, at: now });
      return 1;
    }
    walletSeqnoFloors.set(key, { seqno: 0, at: now });
    return 0;
  }
  const entry = walletSeqnoFloors.get(key);
  if (!entry || chainSeqno >= entry.seqno) {
    walletSeqnoFloors.set(key, { seqno: chainSeqno, at: now });
    return chainSeqno;
  }
  if ((now - entry.at) > WALLET_SEQNO_FLOOR_GRACE_MS) {
    const pending = walletPendingExternals.get(key);
    if (pending && Number(pending.seqno) >= chainSeqno && Number(pending.validUntil) * 1000 > now) return entry.seqno;
    walletSeqnoFloors.set(key, { seqno: chainSeqno, at: now });
    return chainSeqno;
  }
  return entry.seqno;
}

function noteWalletSeqnoBroadcast(wallet, seqno, now = walletChainNowMs()) {
  const key = walletSeqnoFloorKey(wallet);
  if (!key) return;
  const next = Number(seqno) + 1;
  const entry = walletSeqnoFloors.get(key);
  if (!entry || next > entry.seqno) walletSeqnoFloors.set(key, { seqno: next, at: now });
}

export function __resetWalletSeqnoFloorsForTests() {
  walletSeqnoFloors.clear();
}

function resetWalletSeqnoFloor(wallet) {
  const key = walletSeqnoFloorKey(wallet);
  if (key) walletSeqnoFloors.delete(key);
}

export const PLATHO_WALLET_SEQNO_MISMATCH_EXIT_CODE = 133;

export const PLATHO_WALLET_EXPIRED_EXIT_CODE = 136;

function walletErrorIsExpired(error) {
  const direct = Number(error?.chainExitCode);
  if (Number.isFinite(direct)) return direct === PLATHO_WALLET_EXPIRED_EXIT_CODE;
  return toncenterBroadcastExitCode(String(error?.responseBody ?? error?.message ?? '')) === PLATHO_WALLET_EXPIRED_EXIT_CODE;
}

function walletErrorIsSeqnoMismatch(error) {
  const direct = Number(error?.chainExitCode);
  if (Number.isFinite(direct)) return direct === PLATHO_WALLET_SEQNO_MISMATCH_EXIT_CODE;
  const text = String(error?.responseBody ?? error?.message ?? '');
  return toncenterBroadcastExitCode(text) === PLATHO_WALLET_SEQNO_MISMATCH_EXIT_CODE;
}

const WALLET_SEQNO_CATCHUP_ATTEMPTS = 20;
const WALLET_SEQNO_CATCHUP_MS = 700;
const WALLET_SEQNO_FAST_POLL_WINDOW_MS = 10_000;
const WALLET_SEQNO_SLOW_POLL_MS = 3_000;

async function resolveWalletSendSeqno(wallet, transport, options) {
  const chainSeqno = await getPlathoWalletSeqno(wallet, transport, options);
  const floored = applyWalletSeqnoFloor(wallet, chainSeqno);
  if (floored <= chainSeqno) {
    clearPendingWalletExternal(wallet);
    return floored;
  }
  try {
    return await awaitWalletSeqnoConsumed(wallet, transport, floored, {
      seqnoPollAttempts: options?.seqnoCatchupAttempts,
      seqnoPollMs: options?.seqnoCatchupMs ?? WALLET_SEQNO_CATCHUP_MS,
      rebroadcastIntervalMs: options?.rebroadcastIntervalMs,
    });
  } catch (error) {
    if (error?.walletExternalExpired !== true) throw error;
    resetWalletSeqnoFloor(wallet);
    clearPendingWalletExternal(wallet);
    return getPlathoWalletSeqno(wallet, transport, options);
  }
}

async function waitForWalletSeqnoAtLeast(wallet, transport, targetSeqno, options = {}) {
  const attempts = Number(options.seqnoPollAttempts ?? 40);
  const delayMs = Number(options.seqnoPollMs ?? 1500);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const seqno = await getPlathoWalletSeqno(wallet, transport);
    if (seqno >= targetSeqno) return seqno;
    if (delayMs > 0) await wait(delayMs);
  }
  throw new Error(`Wallet seqno did not reach ${targetSeqno}`);
}

const walletPendingExternals = new Map();

const WALLET_REBROADCAST_INTERVAL_MS = 5_000;
export const WALLET_EXTERNAL_VALIDITY_S = 300;

export const WALLET_TAIL_CHUNK_RETRY_DELAYS_MS = Object.freeze([3_000, 8_000, 20_000, 45_000]);
const WALLET_TAIL_CHUNK_MIN_LIFE_MS = 30_000;

function notePartialSend(error, batches, index, chunks, { uncertain = false } = {}) {
  const total = chunks.length;
  if (!error || typeof error !== 'object' || total < 2) return;
  if (!(index > 0) && !uncertain) return;
  try {
    error.partialSend = {
      sentChunks: index,
      chunks: total,
      unsentMessages: chunks.slice(uncertain ? index + 1 : index).flat(),
      uncertainMessages: uncertain ? [...chunks[index]] : null,
    };
    if (error.builtBoc === undefined && index > 0) {
      const sent = batches[index - 1];
      error.builtBoc = sent.boc;
      error.builtSeqno = sent.seqno;
      error.builtValidUntil = sent.validUntil;
    }
  } catch { }
}

async function waitOutUncertainExternal(wallet, transport, pending, options) {
  noteWalletSeqnoBroadcast(wallet, pending.seqno);
  notePendingWalletExternal(wallet, pending.seqno, pending.boc, pending.validUntil);
  try {
    return { taken: await awaitWalletSeqnoConsumed(wallet, transport, pending.seqno + 1, { ...options, pending }) };
  } catch (error) {
    if (error?.walletExternalExpired === true && error?.seqnoReadFailed !== true) return { dead: true };
    return null;
  }
}

export function walletExternalSignedFields(boc) {
  try {
    const root = parseBocBase64(String(boc ?? ''));
    const body = root?.refs?.[root.refs.length - 1];
    if (!body || Number(body.bitLength) < 128) return null;
    const word = (byteOffset) => ((body.data[byteOffset] << 24) >>> 0) + (body.data[byteOffset + 1] << 16) + (body.data[byteOffset + 2] << 8) + body.data[byteOffset + 3];
    if (word(0) !== 0x7369676e) return null;
    return { validUntil: word(8), seqno: word(12) };
  } catch {
    return null;
  }
}

function notePendingWalletExternal(wallet, seqno, boc, validUntil) {
  const key = walletSeqnoFloorKey(wallet);
  if (key) walletPendingExternals.set(key, { seqno: Number(seqno), boc, validUntil: Number(validUntil) || 0 });
  announceWalletExternal(wallet, validUntil);
}

function clearPendingWalletExternal(wallet) {
  const key = walletSeqnoFloorKey(wallet);
  if (key) walletPendingExternals.delete(key);
}

function pendingWalletExternal(wallet) {
  const key = walletSeqnoFloorKey(wallet);
  return key ? walletPendingExternals.get(key) ?? null : null;
}

export function __resetWalletPendingExternalsForTests() {
  walletPendingExternals.clear();
}

async function awaitWalletSeqnoConsumed(wallet, transport, targetSeqno, options = {}) {
  const pending = options.pending ?? pendingWalletExternal(wallet);
  const delayMs = Number(options.seqnoPollMs ?? 1500);
  const rebroadcastMs = Number(options.rebroadcastIntervalMs ?? WALLET_REBROADCAST_INTERVAL_MS);
  const validUntilMs = Number(pending?.validUntil) > 0 ? Number(pending.validUntil) * 1000 : 0;
  const attemptsCap = options.seqnoPollAttempts != null
    ? Number(options.seqnoPollAttempts)
    : (validUntilMs > 0 ? Number.POSITIVE_INFINITY : 40);
  let lastBroadcastAt = walletChainNowMs();
  const waitStartedAt = lastBroadcastAt;
  let rebroadcasts = 0;
  let lastReadError = null;
  for (let attempt = 0; ; attempt += 1) {
    let seqno = -1;
    try {
      seqno = await getPlathoWalletSeqno(wallet, transport);
      lastReadError = null;
    } catch (error) {
      lastReadError = error;
    }
    if (seqno >= targetSeqno) {
      if (rebroadcasts > 0) console.info('[platho] wallet external landed after re-broadcast', { targetSeqno, rebroadcasts });
      if (Number(pendingWalletExternal(wallet)?.seqno ?? -1) < targetSeqno) clearPendingWalletExternal(wallet);
      return seqno;
    }
    const now = walletChainNowMs();
    const pastDeadline = validUntilMs > 0 && now >= validUntilMs + Number(options.deathGraceMs ?? WALLET_EXTERNAL_DEATH_GRACE_MS);
    const expired = pastDeadline && !walletClockDoubted;
    if (pastDeadline || attempt + 1 >= attemptsCap) {
      const error = new Error(`Wallet seqno did not reach ${targetSeqno}`);
      if (lastReadError) { error.cause = lastReadError; error.seqnoReadFailed = true; }
      if (expired) error.walletExternalExpired = true;
      throw error;
    }
    if (pending?.boc && rebroadcastMs >= 0 && (now - lastBroadcastAt) >= rebroadcastMs) {
      try {
        const rotated = await broadcastThroughNextDoor(pending.boc, { ...options, seqno: pending.seqno });
        if (!rotated) {
          await transport.sendBoc({
            boc: pending.boc, walletAddress: wallet.address, seqno: pending.seqno,
            queueTimeoutMs: TON_RPC_MAX_QUEUE_WAIT_MS,
          });
        }
        rebroadcasts += 1;
      } catch {
      }
      lastBroadcastAt = walletChainNowMs();
    }
    const pause = walletChainNowMs() - waitStartedAt < WALLET_SEQNO_FAST_POLL_WINDOW_MS ? delayMs : Math.max(delayMs, WALLET_SEQNO_SLOW_POLL_MS);
    if (pause > 0) await wait(pause);
  }
}

export async function awaitWalletExternalOutcome(wallet, transport, { seqno, validUntil, boc = null } = {}, options = {}) {
  const target = seqno === null || seqno === undefined || seqno === '' ? Number.NaN : Number(seqno);
  if (!Number.isInteger(target) || target < 0) throw new Error('awaitWalletExternalOutcome needs the seqno the external was signed at');
  const held = pendingWalletExternal(wallet);
  const pending = held && held.seqno === target ? held : { seqno: target, boc: boc ?? null, validUntil: Number(validUntil) || 0 };
  try {
    await awaitWalletSeqnoConsumed(wallet, transport, target + 1, { seqnoPollMs: WALLET_SEQNO_CATCHUP_MS, ...options, pending });
  } catch (error) {
    if (error?.walletExternalExpired === true && error?.seqnoReadFailed !== true) return 'expired';
    throw error;
  }
  return walletExternalRanAtSeqno(wallet, transport, { seqno: target, boc: pending.boc ?? boc ?? null, validUntil: Number(pending.validUntil) || Number(validUntil) || null });
}

export const WALLET_EXTERNAL_DEATH_GRACE_MS = WALLET_CLOCK_TOLERANCE_MS + 30_000;

export async function walletExternalOutcomeNow(wallet, transport, { seqno, validUntil, boc = null } = {}, { graceMs = WALLET_EXTERNAL_DEATH_GRACE_MS, quick = false, priority = 'critical' } = {}) {
  const target = seqno === null || seqno === undefined || seqno === '' ? Number.NaN : Number(seqno);
  if (!Number.isInteger(target) || target < 0 || !wallet?.address) return 'unknown';
  let chainSeqno;
  try { chainSeqno = Number(await getPlathoWalletSeqno(wallet, transport, { priority })); } catch { return 'unknown'; }
  if (!Number.isFinite(chainSeqno)) return 'unknown';
  if (chainSeqno > target) {
    const verdict = await walletExternalRanAtSeqno(wallet, transport, { seqno: target, boc, validUntil }, { quick, priority });
    return verdict === 'unverified' ? 'unknown' : verdict;
  }
  const deadlineMs = Number(validUntil) > 0 ? Number(validUntil) * 1000 : 0;
  const nowMs = walletChainNowMs();
  if (deadlineMs > 0 && !walletClockDoubted && nowMs >= deadlineMs + Number(graceMs)) return 'expired';
  return 'pending';
}

async function walletExternalBodyHashBase64(boc) {
  const root = parseBocBase64(String(boc ?? ''));
  const body = root?.refs?.[root.refs.length - 1];
  if (!body) return null;
  const { hash } = await computeCellHashAndDepth(body);
  return bytesToBase64(hash);
}

function walletExternalBodySeqno(bodyBase64) {
  try {
    const body = parseBocBase64(String(bodyBase64 ?? ''));
    if (!body || Number(body.bitLength) < 128) return null;
    const word = (byteOffset) => ((body.data[byteOffset] << 24) >>> 0) + (body.data[byteOffset + 1] << 16) + (body.data[byteOffset + 2] << 8) + body.data[byteOffset + 3];
    if (word(0) !== 0x7369676e) return null;
    return word(12);
  } catch {
    return null;
  }
}

const WALLET_OWN_EXTERNAL_PAGES = 4;
const WALLET_OWN_EXTERNAL_PAGE = 16;
const WALLET_OWN_EXTERNAL_INDEX_RETRIES_MS = Object.freeze([1_500, 3_000, 6_000]);

async function walletExternalRanAtSeqno(wallet, transport, { seqno, boc, validUntil = null }, { quick = false, priority = 'critical' } = {}) {
  if (!boc) return 'unverified';
  let ours = null;
  try { ours = await walletExternalBodyHashBase64(boc); } catch { ours = null; }
  if (!ours) return 'unverified';
  const deadlineSec = Number(validUntil) > 0 ? Math.floor(Number(validUntil)) : 0;
  if (!quick && deadlineSec > 0 && walletChainNowMs() >= deadlineSec * 1000 + WALLET_EXTERNAL_DEATH_GRACE_MS) {
    const atDeadline = await walletExternalRanByDeadline(wallet, transport, { seqno, ours, deadlineSec, priority });
    if (atDeadline !== 'unverified') return atDeadline;
  }
  const live = await walletExternalRanAtSeqnoLive(wallet, transport, { seqno, ours, priority });
  if (live !== 'unverified') return live;
  if (typeof transport?.getAccountTransactions !== 'function') return 'unverified';
  const rounds = quick ? 0 : WALLET_OWN_EXTERNAL_INDEX_RETRIES_MS.length;
  for (let round = 0; round <= rounds; round += 1) {
    if (round > 0) await wait(WALLET_OWN_EXTERNAL_INDEX_RETRIES_MS[round - 1]);
    let endLt = null;
    let passed = false;
    try {
      for (let page = 0; page < WALLET_OWN_EXTERNAL_PAGES && !passed; page += 1) {
        const json = await transport.getAccountTransactions(
          { account: wallet.address, limit: WALLET_OWN_EXTERNAL_PAGE, sort: 'desc', ...(endLt !== null ? { end_lt: endLt } : {}) },
          { priority, skipIfRateLimited: false, cacheTtlMs: 0 },
        );
        const list = Array.isArray(json?.transactions) ? json.transactions : [];
        if (list.length === 0) break;
        for (const tx of list) {
          const message = tx?.in_msg;
          if (!message || message.source) continue;
          const signedFor = walletExternalBodySeqno(message.message_content?.body);
          if (signedFor === null) continue;
          if (signedFor === seqno) return message.message_content?.hash === ours ? 'consumed' : 'replaced';
          if (signedFor < seqno) { passed = true; break; }
        }
        const oldest = list[list.length - 1];
        try { endLt = (BigInt(String(oldest?.lt ?? '0')) - 1n).toString(); } catch { break; }
      }
    } catch {
    }
  }
  return 'unverified';
}

const WALLET_DEADLINE_WALK_PAGE = 64;
const WALLET_DEADLINE_WALK_PAGES = 4;
async function walletExternalRanByDeadline(wallet, transport, { seqno, ours, deadlineSec, priority = 'critical' }) {
  if (typeof transport?.getAccountTransactions !== 'function' || !wallet?.address) return 'unverified';
  const ask = async (params) => {
    const json = await transport.getAccountTransactions(
      { account: wallet.address, ...params }, { priority, skipIfRateLimited: false, cacheTtlMs: 0 });
    return Array.isArray(json?.transactions) ? json.transactions : null;
  };
  const ltOf = (value) => {
    if (value === null || value === undefined || value === '') return null;
    try { return BigInt(String(value)); } catch { return null; }
  };
  let sawAbove = false;
  const judge = (tx) => {
    const message = tx?.in_msg;
    if (!message || message.source) return null;
    const signedFor = walletExternalBodySeqno(message.message_content?.body);
    if (signedFor === null) return null;
    if (signedFor === seqno) return message.message_content?.hash === ours ? 'consumed' : 'replaced';
    if (signedFor > seqno) { sawAbove = true; return null; }
    return sawAbove ? 'unverified' : 'expired';
  };
  try {
    const after = (await ask({ start_utime: deadlineSec + 1, sort: 'asc', limit: 1 }))?.[0];
    if (!after || !(Number(after.now) > deadlineSec)) return 'unverified';
    const first = judge(after);
    if (first) return first;
    let expect = ltOf(after.prev_trans_lt);
    for (let page = 0; page < WALLET_DEADLINE_WALK_PAGES; page += 1) {
      if (expect === null || expect <= 0n) return 'unverified';
      const list = await ask({ end_lt: expect.toString(), sort: 'desc', limit: WALLET_DEADLINE_WALK_PAGE });
      if (!list || list.length === 0) return 'unverified';
      for (const tx of list) {
        if (ltOf(tx?.lt) !== expect) return 'unverified';
        const verdict = judge(tx);
        if (verdict) return verdict;
        expect = ltOf(tx.prev_trans_lt);
        if (expect === null || expect <= 0n) return 'unverified';
      }
    }
  } catch {
  }
  return 'unverified';
}

const WALLET_OWN_EXTERNAL_LIVE_PAGE = 8;
const WALLET_OWN_EXTERNAL_LIVE_PAGES = 3;
async function walletExternalRanAtSeqnoLive(wallet, transport, { seqno, ours, priority = 'critical' }) {
  if (typeof transport?.getAccountTransactionsLive !== 'function') return 'unverified';
  let from = null;
  try {
    for (let page = 0; page < WALLET_OWN_EXTERNAL_LIVE_PAGES; page += 1) {
      const rows = await transport.getAccountTransactionsLive(
        { address: wallet.address, limit: WALLET_OWN_EXTERNAL_LIVE_PAGE, ...(from ?? {}) },
        { priority, skipIfRateLimited: false },
      );
      const list = Array.isArray(rows) ? rows : [];
      const fresh = from ? list.slice(1) : list;
      if (fresh.length === 0) return 'unverified';
      for (const tx of fresh) {
        const message = tx?.in_msg;
        if (!message || message.source) continue;
        const signedFor = walletExternalBodySeqno(message.msg_data?.body);
        if (signedFor === null) continue;
        if (signedFor === seqno) return message.body_hash === ours ? 'consumed' : 'replaced';
        if (signedFor < seqno) return 'unverified';
      }
      const last = fresh[fresh.length - 1]?.transaction_id;
      if (!last?.lt || !last?.hash) return 'unverified';
      from = { lt: String(last.lt), hash: String(last.hash) };
    }
  } catch {
  }
  return 'unverified';
}

const walletSendLanes = new Map();

async function withWalletSendLane(wallet, task) {
  const key = walletSeqnoFloorKey(wallet) || '*';
  const previous = walletSendLanes.get(key) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  walletSendLanes.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (walletSendLanes.get(key) === tail) walletSendLanes.delete(key);
  }
}

export function __resetWalletSendLanesForTests() {
  walletSendLanes.clear();
}

let walletLockManagerOverride;
export function __setWalletLockManagerForTests(manager) {
  walletLockManagerOverride = manager;
}
function walletLockManager() {
  const manager = walletLockManagerOverride !== undefined ? walletLockManagerOverride : globalThis.navigator?.locks;
  return manager && typeof manager.request === 'function' ? manager : null;
}
const WALLET_SIGNER_LOCK_PREFIX = 'platho-wallet-signer.v1:';
let walletSignerSections = 0;
export function walletSignerHeld() {
  return walletSignerSections > 0;
}
export const WALLET_SIGNER_LOCK_STEAL_AFTER_MS = (WALLET_EXTERNAL_VALIDITY_S + 60) * 1000;
const WALLET_SIGNER_STEAL_MARGIN_MS = 60_000;

function externalStillInFlight(outcome) {
  if (outcome?.outcome === 'consumed' || outcome?.outcome === 'unverified') return null;
  const seqno = Number(outcome?.pendingSeqno ?? outcome?.builtSeqno);
  const boc = outcome?.pendingBoc ?? outcome?.builtBoc ?? null;
  const validUntil = Number(outcome?.pendingValidUntil ?? outcome?.builtValidUntil) || 0;
  if (!Number.isInteger(seqno) || seqno < 0 || !boc || !(validUntil > 0)) return null;
  return { seqno, boc, validUntil };
}

async function holdWhileInFlight(address, inFlight, options) {
  if (!inFlight || !address) return;
  const transport = options.transport ?? globalThis.plathoWalletRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport) return;
  try {
    await awaitWalletSeqnoConsumed({ address }, transport, inFlight.seqno + 1, {
      seqnoPollMs: options.seqnoCatchupMs ?? WALLET_SEQNO_CATCHUP_MS,
      rebroadcastIntervalMs: options.rebroadcastIntervalMs,
      pending: inFlight,
    });
  } catch {
  }
}

function walletSignerChannel(name) {
  const Channel = globalThis.BroadcastChannel;
  if (typeof Channel !== 'function') return null;
  try {
    const channel = new Channel(name);
    channel.unref?.();
    return channel;
  } catch {
    return null;
  }
}
const walletSignerAnnouncers = new Map();
function announceWalletExternal(wallet, validUntil) {
  const key = walletSeqnoFloorKey(wallet);
  if (!key) return;
  const name = `${WALLET_SIGNER_LOCK_PREFIX}${key}`;
  if (!walletSignerAnnouncers.has(name)) walletSignerAnnouncers.set(name, walletSignerChannel(name));
  try { walletSignerAnnouncers.get(name)?.postMessage({ validUntil: Number(validUntil) || 0 }); } catch { }
}

async function withCrossWindowSigner(wallet, task, options = {}) {
  const manager = walletLockManager();
  const key = walletSeqnoFloorKey(wallet);
  if (!manager || !key) return task();
  const name = `${WALLET_SIGNER_LOCK_PREFIX}${key}`;
  const address = wallet.address;
  const holdOptions = { transport: options.transport, seqnoCatchupMs: options.seqnoCatchupMs, rebroadcastIntervalMs: options.rebroadcastIntervalMs };
  const marginMs = Number(options.signerStealMarginMs ?? WALLET_SIGNER_STEAL_MARGIN_MS);
  const stealAfterMs = Number(options.signerStealAfterMs ?? WALLET_SIGNER_LOCK_STEAL_AFTER_MS);
  let unrun = task;
  return new Promise((resolve, reject) => {
    let answered = false;
    let granted = false;
    const holder = async () => {
      granted = true;
      let run = unrun;
      unrun = null;
      if (!run) return;
      walletSignerSections += 1;
      try {
        let outcome;
        let failed = false;
        try {
          outcome = await run();
        } catch (error) {
          failed = true;
          outcome = error;
        }
        run = null;
        answered = true;
        if (failed) reject(outcome); else resolve(outcome);
        await holdWhileInFlight(address, externalStillInFlight(outcome), holdOptions);
      } finally {
        walletSignerSections -= 1;
      }
    };
    let heardUntilMs = 0;
    const listener = walletSignerChannel(name);
    if (listener) {
      listener.onmessage = (event) => {
        const until = Number(event?.data?.validUntil) * 1000;
        if (Number.isFinite(until) && until > heardUntilMs) heardUntilMs = until;
      };
    }
    const stopListening = () => { try { listener?.close(); } catch { } };
    const abort = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    const armSteal = (delayMs) => {
      timer = setTimeout(() => {
        timer = null;
        const liveUntil = heardUntilMs + marginMs;
        const now = walletChainNowMs();
        if (heardUntilMs > 0 && liveUntil > now) { armSteal(liveUntil - now); return; }
        abort.abort();
      }, Math.max(0, delayMs));
    };
    if (abort) armSteal(stealAfterMs);
    manager.request(name, abort ? { mode: 'exclusive', signal: abort.signal } : { mode: 'exclusive' }, async () => {
      if (timer) clearTimeout(timer);
      stopListening();
      return holder();
    }).catch((error) => {
      if (timer) clearTimeout(timer);
      stopListening();
      if (answered || granted) return;
      if (error?.name === 'AbortError') {
        manager.request(name, { mode: 'exclusive', steal: true }, holder).catch((stealError) => { if (!answered && !granted) reject(stealError); });
        return;
      }
      reject(error);
    });
  });
}

export async function sendPlathoWalletTransaction(wallet, transaction, options = {}) {
  if (options.seqno === undefined && cutoverUpdateRequired()) {
    const error = new Error('app update required: this version can no longer publish, reload to update');
    error.code = 'CUTOVER_UPDATE_REQUIRED';
    throw error;
  }
  if (options.seqno === undefined && walletSigningHold?.() === true) {
    const error = new Error('an app update is ready: reload before signing anything new');
    error.code = 'APP_UPDATE_PENDING';
    throw error;
  }
  if (options.seqno !== undefined) return sendPlathoWalletTransactionInLane(wallet, transaction, options);
  return withWalletSendLane(wallet, () => withCrossWindowSigner(wallet, () => sendPlathoWalletTransactionInLane(wallet, transaction, options), options));
}

let walletSigningHold = null;
export function setWalletSigningHold(predicate) {
  walletSigningHold = typeof predicate === 'function' ? predicate : null;
}

async function assertWalletBalanceInLane(wallet, transport, required) {
  if (typeof transport?.getAccountState !== 'function') {
    const error = new Error('the wallet balance could not be read; nothing was sent');
    error.code = 'PLATHO_WALLET_BALANCE_UNREAD';
    throw error;
  }
  let account = null;
  try {
    account = await transport.getAccountState({ address: wallet.address }, { skipIfRateLimited: false, priority: 'critical', cacheTtlMs: 0 });
  } catch (cause) {
    const error = new Error('the wallet balance could not be read; nothing was sent');
    error.code = 'PLATHO_WALLET_BALANCE_UNREAD';
    error.cause = cause;
    throw error;
  }
  const raw = account?.balance ?? account?.result?.balance ?? null;
  let balance = null;
  try { balance = raw === null || raw === undefined ? null : BigInt(String(raw)); } catch { balance = null; }
  if (balance === null) {
    const error = new Error('the wallet balance could not be read; nothing was sent');
    error.code = 'PLATHO_WALLET_BALANCE_UNREAD';
    throw error;
  }
  if (balance < BigInt(required)) {
    const error = new Error('the wallet cannot cover this send and its fees');
    error.code = 'PLATHO_WALLET_GRAM_REQUIRED';
    error.requiredNanotons = BigInt(required);
    error.balanceNanotons = balance;
    throw error;
  }
}

async function sendPlathoWalletTransactionInLane(wallet, transaction, options = {}) {
  const transport = options.transport
    ?? globalThis.plathoWalletRpcTransport
    ?? globalThis.plathoTonRpcTransport;
  if (!transport?.sendBoc) throw new Error('TON RPC sendBoc transport is not configured');
  const messages = Array.isArray(transaction?.messages) ? transaction.messages : [transaction];
  const chunks = chunkWalletMessages(messages, options.maxMessagesPerTransfer ?? PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER);
  const profile = options.profile ?? globalThis.plathoSendPhaseProfile ?? null;
  profile?.mark('build');
  let seqno;
  try {
    seqno = options.seqno ?? await resolveWalletSendSeqno(wallet, transport, options);
  } finally {
    profile?.mark('seqno');
  }
  if (options.requiredBalance !== undefined && options.requiredBalance !== null && options.seqno === undefined) {
    await assertWalletBalanceInLane(wallet, transport, options.requiredBalance);
  }
  if (chunks.length > 1 && !transport.runGetMethod && options.seqno === undefined) {
    throw new Error('TON RPC runGetMethod transport is required for multi-transfer wallet publish');
  }

  const batches = [];
  const validUntilFor = () => Number(
    options.timeout ?? transaction?.validUntil
      ?? (Math.floor(walletChainNowMs() / 1000) + Number(options.externalValiditySeconds ?? WALLET_EXTERNAL_VALIDITY_S)),
  );
  const canResign = () => validUntilFor() * 1000 > walletChainNowMs() + 1_000;
  const resignAfterDeath = async (index, dead) => {
    resetWalletSeqnoFloor(wallet);
    clearPendingWalletExternal(wallet);
    let chainSeqno;
    try {
      chainSeqno = await getPlathoWalletSeqno(wallet, transport, options);
    } catch (error) {
      notePartialSend(error, batches, index, chunks);
      throw error;
    }
    const ran = Number(chainSeqno) > Number(dead.seqno)
      && await walletExternalRanAtSeqno(wallet, transport, { seqno: dead.seqno, boc: dead.boc }) === 'consumed';
    return { seqno: chainSeqno, ran };
  };
  let lastOutcome = null;
  const resignedChunks = new Set();
  const settleOurs = async (index, signedAt, boc) => {
    const reported = index === chunks.length - 1 && options.awaitOutcome === true;
    const verdict = await walletExternalRanAtSeqno(wallet, transport, { seqno: signedAt, boc }, { quick: !reported });
    if (verdict !== 'replaced') {
      if (index === chunks.length - 1) lastOutcome = verdict;
      return verdict;
    }
    batches.pop();
    clearPendingWalletExternal(wallet);
    if (resignedChunks.has(index) || !canResign()) {
      const error = new Error('another signer of this wallet took the seqno this external was signed for; it never ran');
      error.code = 'PLATHO_WALLET_EXTERNAL_REPLACED';
      error.walletExternalReplaced = true;
      notePartialSend(error, batches, index, chunks);
      throw error;
    }
    return verdict;
  };
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    let resigned = false;
    for (;;) {
      const validUntil = validUntilFor();
      const built = await buildPlathoWalletExternalBoc(wallet, chunk, {
        ...options,
        transport,
        seqno,
        timeout: validUntil,
        includeStateInit: options.includeStateInit ?? seqno === 0,
      });
      profile?.mark('sign');
      if (typeof options.onSigned === 'function') {
        try {
          await options.onSigned({
            index, chunks: chunks.length, boc: built.boc, seqno, validUntil,
            chunkMessages: [...chunk], unsentMessages: chunks.slice(index + 1).flat(),
          });
        } catch (error) {
          console.warn('[platho] the signed external could not be kept before it left; it is not sent', error);
          const refusal = new Error('the persistent encrypted local history could not keep the signed external before it left: it was not sent');
          refusal.code = 'PLATHO_SIGNED_NOT_KEPT';
          refusal.cause = error;
          notePartialSend(refusal, batches, index, chunks);
          throw refusal;
        }
      }
      let result = null;
      let settled = null;
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await transport.sendBoc({
            boc: built.boc, walletAddress: wallet.address, seqno, queueTimeoutMs: TON_RPC_MAX_QUEUE_WAIT_MS,
          });
          break;
        } catch (error) {
          console.warn('[platho] wallet external broadcast failed', {
            status: error?.status ?? null,
            code: error?.code ?? null,
            detail: error?.responseBody ?? String(error?.message ?? error),
            verdict: error?.broadcastVerdict ?? null,
            seqno,
          });
          const seqnoMismatch = walletErrorIsSeqnoMismatch(error);
          if (seqnoMismatch) resetWalletSeqnoFloor(wallet);
          if (walletErrorIsExpired(error)) { try { walletClockRefresh?.(); } catch { } }
          const priorAmbiguous = error?.tonRpcPriorDeliveryAmbiguous === true;
          const neverLeft = !priorAmbiguous && (String(error?.code ?? '') === 'QUEUE_TIMEOUT'
            || error?.broadcastVerdict === 'rejected' || error?.broadcastVerdict === 'refused');
          const definitivelyRejected = (seqnoMismatch && !priorAmbiguous) || neverLeft;
          const tailDelays = Array.isArray(options.tailRetryDelaysMs) ? options.tailRetryDelaysMs : WALLET_TAIL_CHUNK_RETRY_DELAYS_MS;
          if (index > 0 && definitivelyRejected && attempt < tailDelays.length
            && Number(validUntil) * 1000 - walletChainNowMs() > Number(tailDelays[attempt]) + WALLET_TAIL_CHUNK_MIN_LIFE_MS) {
            await wait(Number(tailDelays[attempt]));
            let chainSeqno = null;
            try { chainSeqno = await getPlathoWalletSeqno(wallet, transport, options); } catch { chainSeqno = null; }
            if (chainSeqno !== null && chainSeqno <= seqno) continue;
          }
          if (chunks.length > 1 && !definitivelyRejected && built?.boc && !resigned) {
            settled = await waitOutUncertainExternal(wallet, transport, { seqno, boc: built.boc, validUntil }, options);
            if (settled?.dead && !canResign()) {
              try { error.walletExternalExpired = true; } catch { }
              clearPendingWalletExternal(wallet);
              notePartialSend(error, batches, index, chunks);
              throw error;
            }
            if (settled) break;
          }
          if (!definitivelyRejected && error && typeof error === 'object' && built?.boc && error.builtBoc === undefined) {
            try { error.builtBoc = built.boc; error.builtSeqno = seqno; error.builtValidUntil = validUntil; } catch { }
          }
          if (!definitivelyRejected && built?.boc) {
            noteWalletSeqnoBroadcast(wallet, seqno);
            notePendingWalletExternal(wallet, seqno, built.boc, validUntil);
          }
          notePartialSend(error, batches, index, chunks, { uncertain: !definitivelyRejected && Boolean(built?.boc) });
          throw error;
        }
      }
      if (settled?.dead) {
        const after = await resignAfterDeath(index, { seqno, boc: built.boc });
        if (after.ran) {
          batches.push({ ...built, result, messageCount: chunk.length, validUntil, seqno });
          seqno = after.seqno;
          if (index === chunks.length - 1) lastOutcome = 'consumed';
          break;
        }
        seqno = after.seqno;
        resigned = true;
        resignedChunks.add(index);
        continue;
      }
      if (settled) {
        batches.push({ ...built, result, messageCount: chunk.length, validUntil, seqno });
        const signedAt = seqno;
        seqno = settled.taken;
        if (await settleOurs(index, signedAt, built.boc) === 'replaced') {
          resigned = true;
          resignedChunks.add(index);
          continue;
        }
        break;
      }
      profile?.mark('broadcast');
      noteWalletSeqnoBroadcast(wallet, seqno);
      notePendingWalletExternal(wallet, seqno, built.boc, validUntil);
      batches.push({ ...built, result, messageCount: chunk.length, validUntil, seqno });
      if (index < chunks.length - 1 || chunks.length > 1 || options.awaitOutcome === true) {
        const signedAt = seqno;
        let dead = false;
        try {
          seqno = await awaitWalletSeqnoConsumed(wallet, transport, seqno + 1, options);
        } catch (error) {
          dead = error?.walletExternalExpired === true && error?.seqnoReadFailed !== true && !resigned && canResign();
          if (!dead) {
            const alive = !(error?.walletExternalExpired === true && error?.seqnoReadFailed !== true);
            if (error && typeof error === 'object' && built?.boc && error.builtBoc === undefined && alive) {
              try { error.builtBoc = built.boc; error.builtSeqno = seqno; error.builtValidUntil = validUntil; } catch { }
            }
            batches.pop();
            notePartialSend(error, batches, index, chunks, { uncertain: alive && Boolean(built?.boc) });
            throw error;
          }
        } finally {
          profile?.mark('chunkWait');
        }
        if (dead) {
          const after = await resignAfterDeath(index, { seqno: signedAt, boc: built.boc });
          seqno = after.seqno;
          if (!after.ran) {
            batches.pop();
            resigned = true;
            resignedChunks.add(index);
            continue;
          }
          if (index === chunks.length - 1) lastOutcome = 'consumed';
        } else if (await settleOurs(index, signedAt, built.boc) === 'replaced') {
          resigned = true;
          resignedChunks.add(index);
          continue;
        }
      }
      break;
    }
  }

  const first = batches[0];
  const last = batches[batches.length - 1];
  return {
    ...first,
    result: last.result,
    batchCount: batches.length,
    batches,
    pendingBoc: last.boc ?? null,
    pendingSeqno: last.seqno ?? null,
    pendingValidUntil: last.validUntil ?? null,
    outcome: lastOutcome,
  };
}
