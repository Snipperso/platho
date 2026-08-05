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
import { beginTonRpcPhaseProfile, toncenterBroadcastExitCode } from './ton-rpc-transport.mjs?v=71';

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
      // NEVER FROM CACHE. A seqno is a SIGNING INPUT: sign two externals against the same value and the wallet
      // contract accepts exactly one and silently drops the rest.
      //
      // MEASURED 2026-08-03 on the owner's phone: a burst of ~8 messages left every one on "sending" and exactly TWO
      // reached the recipient. This call passed no cacheTtlMs, so it inherited the transport default of 15_000 ms
      // (platho-config runGetMethodCacheTtlMs; `seqno` has no per-method override) — every message signed inside one
      // 15-second window got the SAME cached seqno, and the burst happened to straddle one window boundary, which is
      // why exactly two landed. The same cache also froze waitForWalletSeqnoAtLeast's poll loop, so a multipart send
      // could spin the full 40 attempts against a value that could not change.
      cacheTtlMs: 0,
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

// MONOTONIC SEQNO FLOOR, per wallet.
//
// A FRESH chain read is still not enough for CONCURRENT sends. Post-April TON includes a transaction in well under a
// second, so a read taken AFTER the previous send returned will normally see the advance — but two sends that overlap
// (the user taps again before the first call resolves, or a multipart message and a manual send race) still read the
// same seqno, and the loser is dropped silently.
//
// SCOPE, honestly: this does NOT explain the 2026-08-03 burst — see the header of
// tests/burst-send-seqno-collision.test.ts for the refutation and what the evidence actually points at. It is a real
// hole in a signing path, closed on its own merits.
//
// This is the same shape the Vault lane solved in v417 with a per-owner nonce floor, re-derived for the counter that
// replaced it. The floor tracks the chain UPWARD (never below a fresh read) and is raised past every seqno we
// actually broadcast.
//
// THE FAILURE MODE OF A NAIVE FLOOR is a permanent wedge: if a broadcast external is lost, the chain never reaches
// the floor, and every later message signs a seqno the wallet will not accept. So the lead is BOUNDED — once the
// chain has failed to catch up for longer than the grace, the chain wins and the floor is reset to it.
const walletSeqnoFloors = new Map();
const WALLET_SEQNO_FLOOR_GRACE_MS = 90_000;

function walletSeqnoFloorKey(wallet) {
  return String(wallet?.address ?? '');
}

/** The seqno to SIGN with: the fresh chain value, or our floor when the chain has not caught up yet. */
function applyWalletSeqnoFloor(wallet, chainSeqno, now = Date.now()) {
  const key = walletSeqnoFloorKey(wallet);
  if (!key) return chainSeqno;
  // SEQNO 0 IS NOT A LAGGING READ — it is "this wallet has no code yet". The first external must carry the StateInit
  // (`includeStateInit: seqno === 0`), so letting a floor raise it above zero would sign a transfer that can never
  // deploy the wallet and the account would stay uninitialized. Caught by PLATHO-WALLET-04E/04G, which this fix broke
  // before it shipped: the floor returned 44 where the chain said 0.
  if (chainSeqno === 0) {
    walletSeqnoFloors.set(key, { seqno: 0, at: now });
    return 0;
  }
  const entry = walletSeqnoFloors.get(key);
  if (!entry || chainSeqno >= entry.seqno) {
    // The chain caught up (or ran ahead — another device sent from the same wallet). The chain is the authority.
    walletSeqnoFloors.set(key, { seqno: chainSeqno, at: now });
    return chainSeqno;
  }
  if ((now - entry.at) > WALLET_SEQNO_FLOOR_GRACE_MS) {
    // Our floor has been ahead for too long: an external we broadcast never landed. Believe the chain rather than
    // signing forever against a seqno it will never reach.
    walletSeqnoFloors.set(key, { seqno: chainSeqno, at: now });
    return chainSeqno;
  }
  return entry.seqno;
}

/** Called after a successful broadcast: the next external must not reuse this seqno. */
function noteWalletSeqnoBroadcast(wallet, seqno, now = Date.now()) {
  const key = walletSeqnoFloorKey(wallet);
  if (!key) return;
  const next = Number(seqno) + 1;
  const entry = walletSeqnoFloors.get(key);
  if (!entry || next > entry.seqno) walletSeqnoFloors.set(key, { seqno: next, at: now });
}

/** Test seam only — the floor is module state, and a test that cannot clear it cannot prove the grace. */
export function __resetWalletSeqnoFloorsForTests() {
  walletSeqnoFloors.clear();
}

/** Drop our lead for this wallet: used when the chain has PROVEN the floor wrong, so it must not outlive its disproof. */
function resetWalletSeqnoFloor(wallet) {
  const key = walletSeqnoFloorKey(wallet);
  if (key) walletSeqnoFloors.delete(key);
}

// v5r1 throws this from recv_external when the signed seqno is not EXACTLY the stored one. MEASURED in the sandbox
// against our own PLATHO_WALLET_V5R1_CODE_BOC: ahead by one -> 133, behind -> 133, expired valid_until -> 136,
// correct -> 0. The VM log shows it literally: `EQUAL` then `THROWIFNOT 133`.
export const PLATHO_WALLET_SEQNO_MISMATCH_EXIT_CODE = 133;

/** True when the chain rejected the external for a seqno it does not accept — proof our seqno was wrong. */
function walletErrorIsSeqnoMismatch(error) {
  const direct = Number(error?.chainExitCode);
  if (Number.isFinite(direct)) return direct === PLATHO_WALLET_SEQNO_MISMATCH_EXIT_CODE;
  const text = String(error?.responseBody ?? error?.message ?? '');
  return toncenterBroadcastExitCode(text) === PLATHO_WALLET_SEQNO_MISMATCH_EXIT_CODE;
}

// How long to wait for the chain to CONSUME an external we already broadcast before concluding it was lost. TON is
// sub-second since the 2026-04 upgrade and the toncenter index lag MEASURED 2026-08-04 is 1-5s, so ~15s is many
// times the honest worst case — long enough that a healthy predecessor always lands, short enough that a lost one
// does not wedge the user.
const WALLET_SEQNO_CATCHUP_ATTEMPTS = 20;
const WALLET_SEQNO_CATCHUP_MS = 700;

/**
 * The seqno to SIGN with. Never returns a value the chain has not reached.
 *
 * A 200 from toncenter /message means "queued for broadcast", NOT "the chain executed it" — so the floor, which is
 * raised on that 200, can legitimately run ahead of the chain. Signing the floor anyway is not optimism, it is a
 * coin flip: a validator that sees seqno N+1 before N has executed throws exit code 133 and DROPS the external.
 * TON does not hold it back until its turn.
 *
 * MEASURED 2026-08-04 on the owner's mainnet wallet: chain at 149, client signing 150, twelve rejected broadcasts,
 * one image stuck on "sending" for 6.5 minutes until the 90s floor grace expired and let it sign 149. The image
 * BEFORE it had reported "the shard did not store it" — that was the dropped predecessor, the same failure seen
 * from the other end.
 */
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
    // The predecessor outlived its validity window: it can never be included now, so its seqno is provably free.
    // THIS IS THE ONLY SAFE RELEASE. Releasing on a timer (14s, as this did) fires while a copy is still live, and
    // then two externals sit on one seqno and the chain drops one of them.
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

// THE EXTERNAL WE BROADCAST BUT THE CHAIN HAS NOT CONSUMED YET, kept per wallet so it can be RE-BROADCAST verbatim.
//
// MEASURED 2026-08-05 on the owner's mainnet wallet, counting POSTs against externals that actually landed in one
// page session: 5 broadcasts -> 4 on chain, then 19 -> 17. Exactly two vanished, and they are exactly the two
// messages the user saw fail. Inclusion itself is FAST — eleven text externals landed 2-5s apart, and the two
// halves of a successful image landed 17s and 2s after their broadcasts — so these were not slow, they were
// dropped. Re-sending the SAME bytes minutes later worked on the same seqno.
//
// Re-broadcasting is safe for the one reason that matters: the external is signed and bound to a seqno, so the
// chain executes it AT MOST ONCE however many copies arrive. That is the same property the ambiguous-broadcast
// path has always relied on; it was simply never applied to "the POST succeeded and the message never landed".
const walletPendingExternals = new Map();

// How often to re-send a pending external while waiting. Inclusion is seconds, so anything that has not landed in
// this long is very likely gone rather than slow — and a duplicate costs one POST, never a duplicate execution.
const WALLET_REBROADCAST_INTERVAL_MS = 15_000;
// Validity of a message external. It is the ONLY provable answer to "may this seqno be reused" — before it passes
// the external can still land, after it never can.
const WALLET_EXTERNAL_VALIDITY_S = 300;

function notePendingWalletExternal(wallet, seqno, boc, validUntil) {
  const key = walletSeqnoFloorKey(wallet);
  if (key) walletPendingExternals.set(key, { seqno: Number(seqno), boc, validUntil: Number(validUntil) || 0 });
}

function clearPendingWalletExternal(wallet) {
  const key = walletSeqnoFloorKey(wallet);
  if (key) walletPendingExternals.delete(key);
}

function pendingWalletExternal(wallet) {
  const key = walletSeqnoFloorKey(wallet);
  return key ? walletPendingExternals.get(key) ?? null : null;
}

/** Test seam only — pending externals are module state, like the floors. */
export function __resetWalletPendingExternalsForTests() {
  walletPendingExternals.clear();
}

/**
 * Wait until the chain has CONSUMED our seqno, RE-BROADCASTING the pending external while we wait.
 *
 * The old wait was a plain 40x1500ms poll that gave up after a minute and threw the signed bytes away, so the app's
 * only recovery was to re-BUILD and re-SIGN the message — which is both slower and riskier than re-sending what was
 * already signed. A dropped external is invisible from here (toncenter answered 200 and the chain simply never ran
 * it), so the only honest response is to keep offering the same bytes until either the chain takes them or their
 * validity window closes.
 *
 * DEADLINE: the external's own valid_until, not a timer. Giving up earlier is what let the seqno be re-signed while
 * a copy was still live — two externals on one slot, one of them silently dropped.
 */
async function awaitWalletSeqnoConsumed(wallet, transport, targetSeqno, options = {}) {
  const pending = options.pending ?? pendingWalletExternal(wallet);
  const delayMs = Number(options.seqnoPollMs ?? 1500);
  const rebroadcastMs = Number(options.rebroadcastIntervalMs ?? WALLET_REBROADCAST_INTERVAL_MS);
  const validUntilMs = Number(pending?.validUntil) > 0 ? Number(pending.validUntil) * 1000 : 0;
  // With a validity deadline the deadline rules; without one (or when a caller pins it) fall back to a bounded count
  // so no code path can spin forever against a transport that never advances.
  const attemptsCap = options.seqnoPollAttempts != null
    ? Number(options.seqnoPollAttempts)
    : (validUntilMs > 0 ? Number.POSITIVE_INFINITY : 40);
  let lastBroadcastAt = Date.now();
  let rebroadcasts = 0;
  for (let attempt = 0; ; attempt += 1) {
    const seqno = await getPlathoWalletSeqno(wallet, transport);
    if (seqno >= targetSeqno) {
      if (rebroadcasts > 0) console.info('[platho] wallet external landed after re-broadcast', { targetSeqno, rebroadcasts });
      clearPendingWalletExternal(wallet);
      return seqno;
    }
    const now = Date.now();
    const expired = validUntilMs > 0 && now >= validUntilMs;
    if (expired || attempt + 1 >= attemptsCap) {
      const error = new Error(`Wallet seqno did not reach ${targetSeqno}`);
      // ONLY expiry frees the seqno. Running out of polls means we stopped looking, not that the external died —
      // releasing on that would put a fresh signature on a slot a live copy can still take.
      if (expired) error.walletExternalExpired = true;
      throw error;
    }
    if (pending?.boc && rebroadcastMs >= 0 && (now - lastBroadcastAt) >= rebroadcastMs) {
      try {
        await transport.sendBoc({ boc: pending.boc, walletAddress: wallet.address });
        rebroadcasts += 1;
      } catch {
        // The seqno read is the verdict here, not this POST. A failed re-send changes nothing: the earlier copy may
        // still land, so we keep waiting rather than treating this as the message's outcome.
      }
      lastBroadcastAt = Date.now();
    }
    if (delayMs > 0) await wait(delayMs);
  }
}

export async function sendPlathoWalletTransaction(wallet, transaction, options = {}) {
  const transport = options.transport
    ?? globalThis.plathoWalletRpcTransport
    ?? globalThis.plathoTonRpcTransport;
  if (!transport?.sendBoc) throw new Error('TON RPC sendBoc transport is not configured');
  const messages = Array.isArray(transaction?.messages) ? transaction.messages : [transaction];
  const chunks = chunkWalletMessages(messages, options.maxMessagesPerTransfer ?? PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER);
  // An explicit options.seqno is a deliberate caller choice (an idempotent re-broadcast of an already-signed
  // external) and must pass through untouched — re-signing it under a NEW seqno would double-execute if the first
  // copy had in fact landed.
  // The caller may hand in a phase stopwatch (beginTonRpcPhaseProfile) to learn WHERE a slow publish spent its
  // seconds. Optional and inert when absent — nothing on this path may depend on being measured.
  const profile = options.profile ?? globalThis.plathoSendPhaseProfile ?? null;
  // Everything the CALLER did before reaching the wallet — capsule construction and encryption for a media post.
  // Marking it here costs the lane modules no threading and still separates "the app was busy" from "the chain was".
  profile?.mark('build');
  let seqno;
  // Marked in `finally` so a phase that THREW is still attributed. MEASURED: a failed send reported 92.7s total with
  // only 21.9s across its phases — the 71s that mattered fell into a hole precisely because the throwing wait never
  // reached its mark, which is the one number the owner needed.
  try {
    seqno = options.seqno ?? await resolveWalletSendSeqno(wallet, transport, options);
  } finally {
    profile?.mark('seqno');
  }
  if (chunks.length > 1 && !transport.runGetMethod && options.seqno === undefined) {
    throw new Error('TON RPC runGetMethod transport is required for multi-transfer wallet publish');
  }

  const batches = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    // Pinned here rather than left to the builder's default so the wait knows EXACTLY when these bytes die. The
    // validity window is what makes "may this seqno be reused" answerable instead of guessed.
    const validUntil = Number(
      options.timeout ?? transaction?.validUntil ?? (Math.floor(Date.now() / 1000) + WALLET_EXTERNAL_VALIDITY_S),
    );
    const built = await buildPlathoWalletExternalBoc(wallet, chunk, {
      ...options,
      transport,
      seqno,
      timeout: validUntil,
      includeStateInit: options.includeStateInit ?? seqno === 0,
    });
    profile?.mark('sign');
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
      // A seqno mismatch is the chain PROVING our floor wrong. Two consequences, and getting either one wrong is
      // what turned a lost external into a 6.5-minute wedge:
      //   1. The floor must not outlive its own disproof — drop it now instead of waiting out the 90s grace, so the
      //      caller's next attempt reads the chain and signs a seqno that can actually be accepted.
      //   2. These bytes are a corpse. Re-broadcasting them is guaranteed to fail, so they must NOT be offered for
      //      the idempotent re-broadcast path below, which exists for AMBIGUOUS failures only.
      const definitivelyRejected = walletErrorIsSeqnoMismatch(error);
      if (definitivelyRejected) resetWalletSeqnoFloor(wallet);
      // Attach the SIGNED external so an AMBIGUOUS broadcast (the send may or may not have landed) can be re-broadcast
      // idempotently on retry instead of re-signing a fresh seqno — a fresh sign would double-execute if the first
      // copy actually landed. The external is bound to `seqno`, so the chain runs it at most once. [direct-pay send hardening]
      if (!definitivelyRejected && error && typeof error === 'object' && built?.boc && error.builtBoc === undefined) {
        try { error.builtBoc = built.boc; error.builtSeqno = seqno; } catch { /* frozen error — best effort */ }
      }
      throw error;
    }
    profile?.mark('broadcast');
    noteWalletSeqnoBroadcast(wallet, seqno);
    // The bytes are now the ONLY copy of this message that can ever execute. Keep them so the wait can re-offer
    // them instead of the caller re-signing from scratch — the whole recovery hangs on this line.
    notePendingWalletExternal(wallet, seqno, built.boc, validUntil);
    batches.push({ ...built, result, messageCount: chunk.length, validUntil });
    if (index < chunks.length - 1) {
      // The gap between the externals of ONE message: wait for the chain to actually consume this one, re-sending
      // it meanwhile. Marked in `finally` so a wait that throws is still attributed.
      try {
        seqno = await awaitWalletSeqnoConsumed(wallet, transport, seqno + 1, options);
      } finally {
        profile?.mark('chunkWait');
      }
    }
  }

  const first = batches[0];
  const last = batches[batches.length - 1];
  return {
    ...first,
    result: last.result,
    batchCount: batches.length,
    batches,
    // THE EXTERNAL THAT MAY STILL BE IN FLIGHT WHEN THIS RETURNS. Every earlier chunk was waited out against the
    // chain; the last one was only broadcast. The caller persists these so a delivery confirm — including one
    // re-armed after the app was CLOSED and reopened — can re-send the same signed bytes instead of only reddening
    // the message. Note the top-level `boc` above is the FIRST chunk's (it spreads `first`), which is exactly the
    // wrong one for that job.
    pendingBoc: last.boc ?? null,
    pendingSeqno: last.seqno ?? null,
    pendingValidUntil: last.validUntil ?? null,
  };
}
