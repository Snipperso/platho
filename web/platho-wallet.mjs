import { ed25519, x25519 } from './vendor/@noble/curves/ed25519.js';
import { hmac } from './vendor/@noble/hashes/hmac.js';
import { pbkdf2Async } from './vendor/@noble/hashes/pbkdf2.js';
import { sha512 } from './vendor/@noble/hashes/sha2.js';
import { ml_kem768 } from './vendor/@noble/post-quantum/ml-kem.js';
import { TON_MNEMONIC_WORDLIST } from './ton-mnemonic-wordlist.mjs?v=1';
import {
  CONTRACT_CRYPTO_SUITE,
  CRYPTO_SUITES,
  ED25519_SECRET_KEY_BYTES,
  MLKEM768_PUBLIC_KEY_BYTES,
  computeHybridKeyId,
  createMessagingIdentity,
  parseTonAddress,
} from './crypto/platho-crypto.mjs?v=13';
import { tonCell } from './pwa-contract-transactions.mjs?v=35';

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
// TON config-43 max_ext_msg_size: validators DROP an inbound external BoC larger than this BEFORE the wallet
// contract runs — a SILENT loss (the v443 "oversized external dropped at ingest" class). So a multi-part media
// message must be split across externals by BYTE size, not only by the 255-message count. Over-splitting is safe;
// under-splitting trips the hard guard in buildPlathoWalletExternalBoc (fail-loud) — never a silent drop.
export const PLATHO_WALLET_MAX_EXTERNAL_MESSAGE_BYTES = 65535;
// Pack target per external: < the hard ceiling with margin for the signed v5 envelope, the shared ~1.1KB
// RecordShard StateInit, and BoC cell framing/dedup slack. The existing multi-transfer streaming (seqno-ordered,
// waitForWalletSeqnoAtLeast) then carries the extra externals — so an 8-capsule media message sends across as
// many externals as the byte ceiling requires instead of being dropped whole.
export const PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET = 58000;
// Per internal-message header (addr/value/flags) + out-action wrapper. Kept small so it does NOT over-split a bulk
// send of many TINY (null-payload) messages below the 255 count — those actually serialize at ~100 bytes each, so
// the 255-count external stays far under the ceiling. For a LARGE (media) part the ~30KB payload dominates and this
// term is negligible; the budget's ~7.5KB margin under 65535 absorbs the uncounted shared StateInit + envelope, so
// no validly-chunked external can trip the hard guard. [byte-aware chunk calibration]
const PLATHO_WALLET_MESSAGE_FRAMING_BYTES = 150;
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
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('crypto.subtle is unavailable');
  return new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes));
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
  // clean-16 hybrid: derive the stealth scan secret deterministically from the seed. FROZEN info-string
  // 'messaging.hybrid-v1.scan.x25519' (audit-critical: changing it orphans every published scan_pubkey). Without
  // this the scan secret fell back to randomBytes → advertised scan_pubkey desynced from the Vault-registered one
  // across sessions/devices, so no INTRO capsule could ever be scanned/accepted after reinstall.
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

/**
 * One outgoing internal message.
 *
 * `message.stateInit` — A DESTINATION StateInit, attached by reference. This is NOT the wallet's own deploy
 * StateInit (that rides the EXTERNAL message and is the `includeStateInit` option elsewhere in this file); it is
 * the init of the account being SENT TO.
 *
 * It has to exist because the clean-17 shards are deployed LAZILY: a CONV or INTRO shard is a fresh account
 * every epoch, and the first publish into one is what creates it. Without the StateInit that message lands on an
 * uninitialised account, its COMPUTE PHASE IS SKIPPED, nothing is stored, no error is raised and the wallet
 * reports a perfectly successful transaction. Until this branch existed, every first write into a bucket-day
 * would have vanished exactly that way — the worst failure mode this project has, on the send path that signs
 * every transfer.
 *
 * TL-B: message$_ info:CommonMsgInfo init:(Maybe (Either StateInit ^StateInit)) body:(Either X ^X)
 * The Maybe/Either pair below is `1` then `1` — present, and by reference.
 */
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

function walletTransferBody(wallet, messages, options = {}) {
  const seqno = Number(options.seqno ?? 0);
  const timeout = Number(options.timeout ?? Math.floor(Date.now() / 1000) + 300);
  const sendMode = Number(options.sendMode ?? 3);
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0 || list.length > PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER) {
    throw new RangeError(`Wallet transfer supports 1-${PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER} messages`);
  }
  const signing = beginCell()
    .uint(0x7369676en, 32, 'wallet.auth_signed_external')
    .uint(wallet.walletId ?? PLATHO_WALLET_ID, 32, 'wallet_id');
  if (seqno === 0) {
    signing.uint(0xffffffffn, 32, 'wallet.timeout_init');
  } else {
    signing.uint(timeout, 32, 'wallet.timeout');
  }
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

// TON aborts the `seqno` get-method on an account with no code (a never-deployed
// wallet) with this exit code. The toncenter transport surfaces it as
// error.exitCode. It is a definitive "wallet not deployed yet" signal, so the
// first transfer carries the stateInit to deploy it (seqno is provably 0).
const TON_GET_METHOD_UNINITIALIZED_EXIT_CODE = -13;

function tonRpcExitCodeIsUninitializedAccount(error) {
  return Number(error?.exitCode) === TON_GET_METHOD_UNINITIALIZED_EXIT_CODE;
}

// Account statuses (TON Center v2 `state` / v3 `status`) that mean the wallet
// contract has no code on chain yet. Such an account has no persistent state,
// so its seqno is provably 0 and its first external must carry the wallet
// stateInit to deploy it. `frozen` is intentionally excluded — a frozen account
// retains prior state and is NOT safe to treat as seqno 0.
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

// A freshly created wallet has no contract code on chain until its first
// outgoing transfer, so the `seqno` get-method aborts (TON exit_code -13) even
// when the RPC is perfectly healthy. Confirm the account really is
// uninitialized — distinct from a deployed wallet whose read merely failed —
// before treating its seqno as a safe 0.
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
      // A never-deployed wallet aborts this get-method with exit_code -13. Tell
      // the fallback transport that is a definitive answer, so it does not
      // exhaust (and load) the censorship-survival fallback transports just to
      // rediscover the wallet is undeployed.
      stopOnUninitializedAccount: true,
    }));
  } catch (error) {
    if (options.allowSeqnoFallback === true) return 0;
    // Fast path: a structured uninitialized-account abort (exit_code -13) already
    // proves the wallet has no code yet, so its seqno is provably 0 and its first
    // transfer carries the stateInit to deploy it — no extra account read needed.
    if (tonRpcExitCodeIsUninitializedAccount(error)) return 0;
    // Slow path: the read failed without a definitive -13 (e.g. a transport that
    // does not surface exit codes, or a network error). Confirm the account
    // really is uninitialized before falling back; a *deployed* wallet whose read
    // merely failed (RPC unreachable or lying) must still refuse, to avoid
    // signing with a stale seqno and burning the user's funds.
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
  // Hard external-size backstop: TON validators DROP an inbound external larger than max_ext_msg_size (config-43)
  // at ingest, silently. If the byte-aware chunker ever under-splits, fail LOUD here (the caller retries / surfaces
  // an error) instead of broadcasting a doomed external that vanishes and only reddens minutes later.
  const externalBytes = Math.ceil((boc.length * 3) / 4);
  if (externalBytes > PLATHO_WALLET_MAX_EXTERNAL_MESSAGE_BYTES) {
    throw new RangeError(
      `Wallet external is ${externalBytes} bytes, exceeds TON max_ext_msg_size ${PLATHO_WALLET_MAX_EXTERNAL_MESSAGE_BYTES} `
      + '(validators drop it at ingest) — split the message into fewer/smaller parts',
    );
  }
  return { boc, seqno, wallet: wallet.address };
}

// Conservative estimate of one internal message's contribution to the serialized external, in bytes: its payload
// BoC (base64 -> bytes) plus per-message header framing. Over-estimates so the packer over-splits (safe) rather
// than under-splits (which would trip the hard external-size guard at build). The shared StateInit (~1.1KB) is
// covered by the budget's margin under the 65535 ceiling, so it is not double-counted per message.
function estimateWalletMessageExternalBytes(message) {
  const payload = message?.payload;
  const payloadBytes = typeof payload === 'string' ? Math.ceil((payload.length * 3) / 4) : 0;
  return payloadBytes + PLATHO_WALLET_MESSAGE_FRAMING_BYTES;
}

// Split into externals by BOTH the 255-message count AND the byte budget: a chunk closes when adding the next
// message would exceed either. A single message always goes in alone (it cannot be split here — a genuinely
// oversized single message is caught fail-loud by the build guard). The multi-chunk streaming in
// sendPlathoWalletTransaction then sends each chunk as its own seqno-ordered external.
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

export async function sendPlathoWalletTransaction(wallet, transaction, options = {}) {
  const transport = options.transport
    ?? globalThis.plathoWalletRpcTransport
    ?? globalThis.plathoTonRpcTransport;
  if (!transport?.sendBoc) throw new Error('TON RPC sendBoc transport is not configured');
  const messages = Array.isArray(transaction?.messages) ? transaction.messages : [transaction];
  const chunks = chunkWalletMessages(messages, options.maxMessagesPerTransfer ?? PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER);
  let seqno = options.seqno ?? await getPlathoWalletSeqno(wallet, transport, options);
  if (chunks.length > 1 && !transport.runGetMethod && options.seqno === undefined) {
    throw new Error('TON RPC runGetMethod transport is required for multi-transfer wallet publish');
  }

  const batches = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const built = await buildPlathoWalletExternalBoc(wallet, chunk, {
      ...options,
      transport,
      seqno,
      timeout: options.timeout ?? transaction?.validUntil,
      includeStateInit: options.includeStateInit ?? seqno === 0,
    });
    let result = null;
    try {
      result = await transport.sendBoc({ boc: built.boc, walletAddress: wallet.address });
    } catch (error) {
      // Surface WHY toncenter rejected the WALLET external (transfers/top-ups/deploy) — this was the last
      // broadcast path without a [platho] warn, so its 500s showed as bare mysteries in the console.
      console.warn('[platho] wallet external broadcast failed', {
        status: error?.status ?? null,
        code: error?.code ?? null,
        detail: error?.responseBody ?? String(error?.message ?? error),
        seqno,
      });
      // Attach the SIGNED external so an AMBIGUOUS broadcast (the send may or may not have landed) can be re-broadcast
      // idempotently on retry instead of re-signing a fresh seqno — a fresh sign would double-execute if the first
      // copy actually landed. The external is bound to `seqno`, so the chain runs it at most once. [direct-pay send hardening]
      if (error && typeof error === 'object' && built?.boc && error.builtBoc === undefined) {
        try { error.builtBoc = built.boc; error.builtSeqno = seqno; } catch { /* frozen error — best effort */ }
      }
      throw error;
    }
    batches.push({ ...built, result, messageCount: chunk.length });
    if (index < chunks.length - 1) {
      seqno = await waitForWalletSeqnoAtLeast(wallet, transport, seqno + 1, options);
    }
  }

  const first = batches[0];
  const last = batches[batches.length - 1];
  return {
    ...first,
    result: last.result,
    batchCount: batches.length,
    batches,
  };
}
