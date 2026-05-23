import { ed25519, x25519 } from './vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from './vendor/@noble/post-quantum/ml-kem.js';
import {
  CONTRACT_CRYPTO_SUITE,
  CRYPTO_SUITES,
  ED25519_SECRET_KEY_BYTES,
  MLKEM768_PUBLIC_KEY_BYTES,
  computeClassicalKeyId,
  computeHybridKeyId,
  createMessagingIdentity,
  parseTonAddress,
  randomBytes,
} from './crypto/platho-crypto.mjs';
import { tonCell } from './pwa-contract-transactions.mjs';

const {
  beginCell,
  serializeBoc,
  parseBocBase64,
  computeCellHashAndDepth,
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
  hexToBytes,
  concatBytes,
} = tonCell;

export const PLATHO_WALLET_VERSION = 1;
export const PLATHO_WALLET_KIND = 'platho.wallet.v5r1';
export const PLATHO_WALLET_SEED_BYTES = 32;
export const PLATHO_WALLET_WORKCHAIN = 0;
export const PLATHO_WALLET_NETWORK_GLOBAL_IDS = Object.freeze({
  MAINNET: -239,
  TESTNET: -3,
});
export const PLATHO_WALLET_SUBWALLET_NUMBER = 0;
export const PLATHO_WALLET_ID = 0x7fffff11;
export const PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER = 255;
export const PLATHO_WALLET_V5R1_CODE_BOC =
  'te6ccgECFAEAAoEAART/APSkE/S88sgLAQIBIAINAgFIAwQC3NAg10nBIJFbj2Mg1wsfIIIQZXh0br0hghBzaW50vbCSXwPgghBleHRuuo60gCDXIQHQdNch+kAw+kT4KPpEMFi9kVvg7UTQgQFB1yH0BYMH9A5voTGRMOGAQNchcH/bPOAxINdJgQKAuZEw4HDiEA8CASAFDAIBIAYJAgFuBwgAGa3OdqJoQCDrkOuF/8AAGa8d9qJoQBDrkOuFj8ACAUgKCwAXsyX7UTQcdch1wsfgABGyYvtRNDXCgCAAGb5fD2omhAgKDrkPoCwBAvIOAR4g1wsfghBzaWduuvLgin8PAeaO8O2i7fshgwjXIgKDCNcjIIAg1yHTH9Mf0x/tRNDSANMfINMf0//XCgAK+QFAzPkQmiiUXwrbMeHywIffArNQB7Dy0IRRJbry4IVQNrry4Ib4I7vy0IgikvgA3gGkf8jKAMsfAc8Wye1UIJL4D95w2zzYEAP27aLt+wL0BCFukmwhjkwCIdc5MHCUIccAs44tAdcoIHYeQ2wg10nACPLgkyDXSsAC8uCTINcdBscSwgBSMLDy0InXTNc5MAGk6GwShAe78uCT10rAAPLgk+1V4tIAAcAAkVvg69csCBQgkXCWAdcsCBwS4lIQseMPINdKERITAJYB+kAB+kT4KPpEMFi68uCR7UTQgQFB1xj0BQSdf8jKAEAEgwf0U/Lgi44UA4MH9Fvy4Iwi1woAIW4Bs7Dy0JDiyFADzxYS9ADJ7VQAcjDXLAgkji0h8uCS0gDtRNDSAFETuvLQj1RQMJExnAGBAUDXIdcKAPLgjuLIygBYzxbJ7VST8sCN4gAQk1vbMeHXTNA=';

const encoder = new TextEncoder();

function assertBytes(value, length, name) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.length !== length) throw new RangeError(`${name} must be ${length} bytes`);
  return bytes;
}

function seedToText(seed) {
  return `platho1.${bytesToHex(seed)}`;
}

function seedFromText(value) {
  const text = String(value ?? '').trim();
  const raw = text.startsWith('platho1.') ? text.slice('platho1.'.length) : text;
  return assertBytes(hexToBytes(raw, PLATHO_WALLET_SEED_BYTES, 'Platho wallet seed'), PLATHO_WALLET_SEED_BYTES, 'Platho wallet seed');
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

export async function derivePlathoWalletFromSeed(seedBytes, options = {}) {
  const seed = assertBytes(seedBytes, PLATHO_WALLET_SEED_BYTES, 'Platho wallet seed');
  const walletSecretKey = await hkdfBytes(seed, 'ton-wallet-v5r1-ed25519', ED25519_SECRET_KEY_BYTES);
  const walletPublicKey = ed25519.getPublicKey(walletSecretKey);
  const workchain = options.workchain ?? PLATHO_WALLET_WORKCHAIN;
  const networkGlobalId = options.networkGlobalId ?? PLATHO_WALLET_NETWORK_GLOBAL_IDS.MAINNET;
  const subwalletNumber = options.subwalletNumber ?? PLATHO_WALLET_SUBWALLET_NUMBER;
  const walletId = options.walletId ?? walletIdV5R1Raw({ networkGlobalId, workchain, subwalletNumber });
  const code = walletCodeCell();
  const data = walletDataCell(walletPublicKey, walletId);
  const init = stateInitCell(code, data);
  return {
    version: PLATHO_WALLET_VERSION,
    kind: PLATHO_WALLET_KIND,
    seed,
    seedText: seedToText(seed),
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
    address: await contractAddressRaw(workchain, init),
    stateInit: init,
    stateInitBoc: bytesToBase64(serializeBoc(init)),
  };
}

export async function createPlathoWallet(options = {}) {
  return derivePlathoWalletFromSeed(options.seed ?? randomBytes(PLATHO_WALLET_SEED_BYTES), options);
}

export async function importPlathoWallet(seedText, options = {}) {
  return derivePlathoWalletFromSeed(seedFromText(seedText), options);
}

export function exportPlathoWalletSeed(wallet) {
  if (!wallet?.seed) throw new Error('Platho wallet is not loaded');
  return seedToText(wallet.seed);
}

export async function deriveMessagingIdentityFromWallet(wallet, suite) {
  if (!wallet?.seed) throw new Error('Platho wallet is not loaded');
  const normalizedSuite = suite === CRYPTO_SUITES.CLASSICAL_V1 ? CRYPTO_SUITES.CLASSICAL_V1 : CRYPTO_SUITES.HYBRID_V1;
  const x25519SecretKey = await hkdfBytes(wallet.seed, `messaging.${normalizedSuite}.x25519`, 32);
  const x25519PublicKey = x25519.getPublicKey(x25519SecretKey);
  const signingSecretKey = await hkdfBytes(wallet.seed, `messaging.${normalizedSuite}.ed25519`, ED25519_SECRET_KEY_BYTES);
  let encryptionKeyPair;
  if (normalizedSuite === CRYPTO_SUITES.CLASSICAL_V1) {
    encryptionKeyPair = {
      suite: CRYPTO_SUITES.CLASSICAL_V1,
      contractSuite: CONTRACT_CRYPTO_SUITE.CLASSICAL,
      keyId: await computeClassicalKeyId(x25519PublicKey),
      x25519SecretKey,
      x25519PublicKey,
    };
  } else {
    const mlKemSeed = await hkdfBytes(wallet.seed, 'messaging.hybrid-v1.ml-kem768', 64);
    const mlKem = ml_kem768.keygen(mlKemSeed);
    const mlKem768PublicKey = assertBytes(mlKem.publicKey, MLKEM768_PUBLIC_KEY_BYTES, 'mlKem768PublicKey');
    const mlKem768SecretKey = assertBytes(mlKem.secretKey, 2400, 'mlKem768SecretKey');
    const mlKem768PublicKeyHash = await sha256(mlKem768PublicKey);
    encryptionKeyPair = {
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
  }
  return createMessagingIdentity({ encryptionKeyPair, signingSecretKey });
}

function storeInternalMessage(message) {
  const destination = parseTonAddress(message.address);
  const value = BigInt(message.amount ?? 0);
  const body = message.payload ? parseBocBase64(message.payload) : beginCell().endCell();
  return beginCell()
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
    .uint(0n, 32, 'int_msg_info.created_at')
    .uint(0n, 1, 'message.init_none')
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

export async function getPlathoWalletSeqno(wallet, transport) {
  if (!transport?.runGetMethod) return 0;
  try {
    return readSeqnoFromStack(await transport.runGetMethod({
      address: wallet.address,
      method: 'seqno',
      stack: [],
    }));
  } catch {
    return 0;
  }
}

export async function buildPlathoWalletExternalBoc(wallet, messages, options = {}) {
  const seqno = options.seqno ?? await getPlathoWalletSeqno(wallet, options.transport);
  const body = await walletTransferBody(wallet, messages, { ...options, seqno });
  const root = externalInMessage(wallet, body, {
    includeStateInit: options.includeStateInit ?? seqno === 0,
  });
  return {
    boc: bytesToBase64(serializeBoc(root)),
    seqno,
    wallet: wallet.address,
  };
}

function chunkWalletMessages(messages, maxPerTransfer = PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER) {
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0) throw new RangeError('Wallet transaction must include at least one message');
  const chunks = [];
  for (let index = 0; index < list.length; index += maxPerTransfer) {
    chunks.push(list.slice(index, index + maxPerTransfer));
  }
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
  let seqno = options.seqno ?? await getPlathoWalletSeqno(wallet, transport);
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
    const result = await transport.sendBoc({ boc: built.boc, walletAddress: wallet.address });
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
