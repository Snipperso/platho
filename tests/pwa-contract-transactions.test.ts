import { Address, beginCell, Cell } from '@ton/core';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import {
  storeDepositTon,
  storeMintUsernameFromVaultBalance,
  storeRegisterMessagingKeys,
  storeReplaceMessagingKeys,
  storeSetProfileAvatarFromVaultBalance,
  storeWithdrawAth,
  storeWithdrawTon,
} from '../build/Vault/Vault_Vault';
import {
  storeATHBurn,
  storeATHTransferRequest,
  storeATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  ATH_WALLET_RESERVES_NANOTONS,
  PUBLIC_BODY_FLAGS,
  PUBLIC_BODY_KIND,
  PUBLIC_BODY_MEDIA_FORMATS,
  PUBLIC_POST_BODY_MAX_BYTES,
  PUBLIC_COMMENT_TEXT_MAX_BYTES,
  PUBLIC_POST_TEXT_MAX_BYTES,
  PROFILE_AVATAR_PRICE_ATH,
  PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
  RECEIVE_ASSETS,
  USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
  VAULT_CRYPTO_SUITE,
  VAULT_PUBLISH_KIND,
  VAULT_SIZE_CLASS,
  buildAthWalletMessageBody,
  buildVaultBalancePublishBodyCell,
  buildVaultBalancePublishExternalBoc,
  buildVaultProfileAvatarBodyCell,
  buildVaultProfileAvatarExternalBoc,
  buildVaultReceiveIntentExternalBoc,
  buildVaultUsernameMintBodyCell,
  buildVaultUsernameMintExternalBoc,
  buildVaultMessageBody,
  createAthWalletMessage,
  createPublicPostPayload,
  createWalletTransaction,
  createVaultWalletMessage,
  estimateAthWalletAttachedValueNanotons,
  estimateVaultAttachedValueNanotons,
  readPublicPostPayload,
  tonCell,
} from '../web/pwa-contract-transactions.mjs';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

const OWNER = `0:${'11'.repeat(32)}`;
const RECIPIENT = `0:${'22'.repeat(32)}`;
const VAULT = `0:${'33'.repeat(32)}`;
const ATH_WALLET = `0:${'44'.repeat(32)}`;
const USERNAME_REGISTRY = `0:${'55'.repeat(32)}`;
const PROFILE_REGISTRY = `0:${'77'.repeat(32)}`;
const DEPLOYMENT_MANIFEST_HASH = `0x${'66'.repeat(32)}`;

function generatedBody(store: (builder: any) => void) {
  return beginCell().store(store).endCell().toBoc({ idx: false, crc32: false }).toString('base64');
}

function cellPayload(cell: any) {
  return {
    hash: `0x${cell.hash().toString('hex')}`,
    boc: cell.toBoc({ idx: false, crc32: false }).toString('base64'),
  };
}

function snakeCellFromBytes(bytes: Buffer) {
  let tail = null;
  for (let offset = bytes.length; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(bytes.subarray(start, offset));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

function bigintToBuffer(value: bigint, bytes = 32) {
  return Buffer.from(value.toString(16).padStart(bytes * 2, '0'), 'hex');
}

const PQ_PUBKEY_BYTES = Buffer.alloc(1184, 0x55);
const PQ_PUBKEY_CELL = snakeCellFromBytes(PQ_PUBKEY_BYTES);
const PRIVATE_HEADER_0 = finalPrivateHeader0Cell();
const PRIVATE_HEADER_1 = finalPrivateHeader1Cell();
const PRIVATE_BODY = finalPrivateBodyCell();

function privatePublishFixture(maxCharge = 58_000_000n) {
  return {
    client_nonce: 3n,
    max_charge: maxCharge,
    publish: {
      publish_kind: VAULT_PUBLISH_KIND.PRIVATE,
      size_class: VAULT_SIZE_CLASS.STANDARD,
      crypto_suite: VAULT_CRYPTO_SUITE.HYBRID,
      header_0_hash: cellPayload(PRIVATE_HEADER_0).hash,
      header_1_hash: cellPayload(PRIVATE_HEADER_1).hash,
      body_hash: cellPayload(PRIVATE_BODY).hash,
      header_0_cell: cellPayload(PRIVATE_HEADER_0),
      header_1_cell: cellPayload(PRIVATE_HEADER_1),
      body_cell: cellPayload(PRIVATE_BODY),
    },
  };
}

describe('PWA contract transaction builders', () => {
  it('PWA-TX-06C: parses indexed TON RPC BoC cells with CRC trailer', () => {
    const bytes = Buffer.alloc(300, 0x5a);
    const boc = snakeCellFromBytes(bytes).toBoc({ idx: true, crc32: true }).toString('base64');

    expect(Buffer.from(tonCell.readSnakeCellBytes(boc, {
      maxBytes: bytes.length,
      name: 'indexed rpc snake cell',
    }))).toEqual(bytes);
  });

  it.each([
    [
      'DepositTon',
      { amount: 123_000_000n },
      storeDepositTon({ $$type: 'DepositTon', amount: 123_000_000n }),
    ],
    [
      'WithdrawTon',
      { amount: 44_000_000n, recipient: RECIPIENT },
      storeWithdrawTon({ $$type: 'WithdrawTon', amount: 44_000_000n, recipient: Address.parseRaw(RECIPIENT) }),
    ],
    [
      'WithdrawAth',
      { query_id: 77n, amount: 500n, recipient: RECIPIENT },
      storeWithdrawAth({
        $$type: 'WithdrawAth',
        query_id: 77n,
        amount: 500n,
        recipient: Address.parseRaw(RECIPIENT),
      }),
    ],
    [
      'RegisterMessagingKeys',
      {
        enc_pubkey: 0x11n,
        sign_pubkey: 0x22n,
        pq_kem_pubkey_hash: 0x55n,
        pq_kem_pubkey_len: 1184n,
        pq_kem_pubkey: PQ_PUBKEY_BYTES,
        crypto_suite_mask: 2n,
      },
      storeRegisterMessagingKeys({
        $$type: 'RegisterMessagingKeys',
        enc_pubkey: 0x11n,
        sign_pubkey: 0x22n,
        pq_kem_pubkey_hash: 0x55n,
        pq_kem_pubkey_len: 1184n,
        pq_kem_pubkey: PQ_PUBKEY_CELL,
        crypto_suite_mask: 2n,
      }),
    ],
    [
      'ReplaceMessagingKeys',
      {
        enc_pubkey: 0x33n,
        sign_pubkey: 0x44n,
        pq_kem_pubkey_hash: 0x55n,
        pq_kem_pubkey_len: 1184n,
        pq_kem_pubkey: PQ_PUBKEY_BYTES,
        crypto_suite_mask: 2n,
      },
      storeReplaceMessagingKeys({
        $$type: 'ReplaceMessagingKeys',
        enc_pubkey: 0x33n,
        sign_pubkey: 0x44n,
        pq_kem_pubkey_hash: 0x55n,
        pq_kem_pubkey_len: 1184n,
        pq_kem_pubkey: PQ_PUBKEY_CELL,
        crypto_suite_mask: 2n,
      }),
    ],
  ])('PWA-TX-01: %s body matches generated Tact wrapper encoding', (type, params, store) => {
    expect(buildVaultMessageBody(type, params)).toBe(generatedBody(store));
  });

  it('PWA-TX-01B: payment checks are signed Vault external BOCs, not wallet message bodies', async () => {
    const signingSecretKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    expect(() => buildVaultMessageBody('CreateReceiveIntent', {})).toThrow(/Unsupported Vault message type/);
    expect(() => buildVaultMessageBody('ClaimReceiveIntent', {})).toThrow(/Unsupported Vault message type/);
    expect(() => buildVaultMessageBody('CancelReceiveIntent', {})).toThrow(/Unsupported Vault message type/);

    const createExternal = await buildVaultReceiveIntentExternalBoc('CreateReceiveIntent', {
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
      client_nonce: 9n,
      asset: RECEIVE_ASSETS.TON,
      amount: 120_000_000n,
      recipient_wallet: RECIPIENT,
      commitment: 0x7777n,
    });
    const claimExternal = await buildVaultReceiveIntentExternalBoc('ClaimReceiveIntent', {
      owner_wallet: RECIPIENT,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
      client_nonce: 10n,
      intent_id: 0x8888n,
      secret32: 0x9999n,
    });
    const cancelExternal = await buildVaultReceiveIntentExternalBoc('CancelReceiveIntent', {
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
      client_nonce: 11n,
      intent_id: 0x8888n,
    });

    for (const external of [createExternal, claimExternal, cancelExternal]) {
      expect(external.vaultAddress).toBe(VAULT);
      expect(external.boc).toMatch(/^te6/);
      expect(external.signedDataHash).toMatch(/^[0-9a-f]{64}$/);
      expect(external.signature).toMatch(/^[0-9a-f]{128}$/);
      expect(ed25519.verify(
        Buffer.from(external.signature, 'hex'),
        Buffer.from(external.signedDataHash, 'hex'),
        ed25519.getPublicKey(signingSecretKey),
      )).toBe(true);
    }
  });

  it('PWA-TX-02: quotes exact explicit Vault reserve values used by the PWA', () => {
    expect(estimateVaultAttachedValueNanotons('DepositTon', { amount: 1_000n }, { userExists: false })).toBe(12_001_000n);
    expect(estimateVaultAttachedValueNanotons('DepositTon', { amount: 1_000n }, { userExists: true })).toBe(2_001_000n);
    expect(() => estimateVaultAttachedValueNanotons('RegisterMessagingKeys', { crypto_suite_mask: 1n }, { userExists: false })).toThrow(/hybrid-v1/);
    expect(estimateVaultAttachedValueNanotons('RegisterMessagingKeys', { crypto_suite_mask: 2n }, { userExists: true })).toBe(32_000_000n);
    expect(estimateVaultAttachedValueNanotons('CreateReceiveIntent')).toBe(9_000_000n);
    expect(estimateVaultAttachedValueNanotons('ClaimReceiveIntent')).toBe(0n);
    expect(estimateVaultAttachedValueNanotons('WithdrawAth')).toBe(40_000_000n);
  });

  it('PWA-TX-03: creates embedded wallet transaction messages with decimal nanotons and payload', () => {
    const message = createVaultWalletMessage('WithdrawTon', {
      amount: 44_000_000n,
      recipient: OWNER,
    }, {
      vaultAddress: VAULT,
    });

    expect(message.address).toBe(VAULT);
    expect(message.amount).toBe('2000000');
    expect(message.payload).toBe(generatedBody(storeWithdrawTon({
      $$type: 'WithdrawTon',
      amount: 44_000_000n,
      recipient: Address.parseRaw(OWNER),
    })));

    expect(createWalletTransaction(message, { nowMs: 1_700_000_000_000, ttlSeconds: 60 })).toEqual({
      validUntil: 1_700_000_060,
      messages: [message],
    });
  });

  it.each([
    [
      'ATHTransferRequest',
      {
        query_id: 11n,
        amount: 500n,
        recipient: RECIPIENT,
        response_destination: OWNER,
      },
      storeATHTransferRequest({
        $$type: 'ATHTransferRequest',
        query_id: 11n,
        amount: 500n,
        recipient: Address.parseRaw(RECIPIENT),
        response_destination: Address.parseRaw(OWNER),
      }),
    ],
    [
      'ATHTransferRequestWithNotify',
      {
        query_id: 12n,
        amount: 700n,
        recipient: VAULT,
        response_destination: OWNER,
        notify_destination: VAULT,
        notify_value: 30_000_000n,
      },
      storeATHTransferRequestWithNotify({
        $$type: 'ATHTransferRequestWithNotify',
        query_id: 12n,
        amount: 700n,
        recipient: Address.parseRaw(VAULT),
        response_destination: Address.parseRaw(OWNER),
        notify_destination: Address.parseRaw(VAULT),
        notify_value: 30_000_000n,
      }),
    ],
    [
      'ATHBurn',
      {
        query_id: 14n,
        amount: 900n,
        response_destination: OWNER,
      },
      storeATHBurn({
        $$type: 'ATHBurn',
        query_id: 14n,
        amount: 900n,
        response_destination: Address.parseRaw(OWNER),
      }),
    ],
  ])('PWA-TX-06: %s ATHWallet body matches generated Tact wrapper encoding', (type, params, store) => {
    expect(buildAthWalletMessageBody(type, params)).toBe(generatedBody(store));
  });

  it('PWA-TX-06B: direct ATHWallet username/avatar product actions are unsupported', () => {
    expect(() => buildAthWalletMessageBody('WalletProductMintUsername', {
      query_id: 13n,
      amount: 100_000_000_000n,
      recipient: USERNAME_REGISTRY,
      response_destination: OWNER,
      notify_value: 32_000_000n,
      username: 'name_1-x',
    })).toThrow(/Unsupported ATHWallet message type/);
    expect(() => buildAthWalletMessageBody('WalletProductProfileAvatar', {
      query_id: 15n,
      amount: 100_000_000_000n,
      recipient: USERNAME_REGISTRY,
      response_destination: OWNER,
      notify_value: 30_000_000n,
      avatar_hash: 0x1234n,
      avatar_entry_id: 77n,
      avatar_stream_id: 0xabcden,
      avatar_part_count: 8n,
      media_format: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
    })).toThrow(/Unsupported ATHWallet message type/);
  });

  it('PWA-TX-07: quotes exact ATHWallet generic values used by the PWA', () => {
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequest')).toBe(30_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHBurn')).toBe(4_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestWithNotify', { notify_value: 30_000_000n })).toBe(51_000_000n);
    expect(() => estimateAthWalletAttachedValueNanotons('WalletProductMintUsername', { notify_value: 32_000_000n })).toThrow(/Unsupported ATHWallet message type/);
    expect(() => estimateAthWalletAttachedValueNanotons('WalletProductProfileAvatar', { notify_value: 30_000_000n })).toThrow(/Unsupported ATHWallet message type/);
    expect(ATH_WALLET_RESERVES_NANOTONS.transferNotifyMinValue).toBe(30_000_000n);
  });

  it('PWA-TX-08: builds generic ATHWallet wallet messages only', () => {
    const athMessage = createAthWalletMessage('ATHTransferRequest', {
      query_id: 11n,
      amount: 500n,
      recipient: RECIPIENT,
      response_destination: OWNER,
    }, {
      athWalletAddress: ATH_WALLET,
    });
    expect(athMessage.address).toBe(ATH_WALLET);
    expect(athMessage.amount).toBe('30000000');
    expect(athMessage.payload).toBe(generatedBody(storeATHTransferRequest({
      $$type: 'ATHTransferRequest',
      query_id: 11n,
      amount: 500n,
      recipient: Address.parseRaw(RECIPIENT),
      response_destination: Address.parseRaw(OWNER),
    })));
  });

  it('PWA-TX-04: creates signed Vault-balance private publish bodies', async () => {
    const fixture = privatePublishFixture(58_000_000n);
    const signingSecretKey = new Uint8Array(32).fill(0x11);
    const built = await buildVaultBalancePublishBodyCell('PublishPrivateFromVaultBalance', {
      ...fixture,
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
    });

    expect(built.signature).toHaveLength(128);
    expect(built.signedDataHash).toHaveLength(64);
    expect(ed25519.verify(
      Buffer.from(built.signature, 'hex'),
      Buffer.from(built.signedDataHash, 'hex'),
      ed25519.getPublicKey(signingSecretKey),
    )).toBe(true);
    expect(tonCell.bytesToBase64(tonCell.serializeBoc(built.bodyCell))).toMatch(/^te6/);
  });

  it('PWA-TX-04B: Vault-balance external publish builder requires deployment manifest hash', async () => {
    const fixture = privatePublishFixture(58_000_000n);
    await expect(buildVaultBalancePublishExternalBoc('PublishPrivateFromVaultBalance', {
      ...fixture,
      owner_wallet: OWNER,
      signingSecretKey: new Uint8Array(32).fill(0x11),
    }, {
      vaultAddress: VAULT,
    })).rejects.toThrow(/deployment_manifest_hash must be an integer/);
  });

  it('PWA-TX-04C: Vault-balance external publish accepts bare hex deployment manifest hashes', async () => {
    const built = await buildVaultBalancePublishExternalBoc('PublishPrivateFromVaultBalance', {
      ...privatePublishFixture(58_000_000n),
      owner_wallet: OWNER,
      signingSecretKey: new Uint8Array(32).fill(0x11),
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH.slice(2),
    }, {
      vaultAddress: VAULT,
    });

    expect(built.boc).toMatch(/^te6/);
    expect(built.signature).toHaveLength(128);
  });

  it('PWA-TX-04D: creates signed Vault-funded profile avatar registration messages', async () => {
    const signingSecretKey = new Uint8Array(32).fill(0x33);
    const built = await buildVaultProfileAvatarBodyCell({
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      profile_registry_address: PROFILE_REGISTRY,
      client_nonce: 9n,
      max_ton_charge: PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
      avatar_hash: `0x${'aa'.repeat(32)}`,
      avatar_entry_id: 17n,
      avatar_stream_id: 0xbbn,
      avatar_part_count: 2n,
      media_format: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      signingSecretKey,
    });
    const signedPayloadCell = Cell.fromBoc(Buffer.from(
      tonCell.bytesToBase64(tonCell.serializeBoc(built.signedData)),
      'base64',
    ))[0];

    expect(PROFILE_AVATAR_PRICE_ATH).toBe(100_000_000_000n);
    expect(PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS).toBe(61_000_000n);
    expect(ed25519.verify(
      Buffer.from(built.signature, 'hex'),
      Buffer.from(built.signedDataHash, 'hex'),
      ed25519.getPublicKey(signingSecretKey),
    )).toBe(true);
    expect(tonCell.bytesToBase64(tonCell.serializeBoc(built.bodyCell))).toBe(generatedBody(storeSetProfileAvatarFromVaultBalance({
      $$type: 'SetProfileAvatarFromVaultBalance',
      owner_wallet: Address.parseRaw(OWNER),
      signature: Buffer.from(built.signature, 'hex'),
      signed_payload: signedPayloadCell,
    })));

    const external = await buildVaultProfileAvatarExternalBoc({
      owner_wallet: OWNER,
      profile_registry_address: PROFILE_REGISTRY,
      client_nonce: 9n,
      max_ton_charge: PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
      avatar_hash: `0x${'aa'.repeat(32)}`,
      avatar_entry_id: 17n,
      avatar_stream_id: 0xbbn,
      avatar_part_count: 2n,
      media_format: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH.slice(2),
      signingSecretKey,
    }, {
      vaultAddress: VAULT,
    });
    expect(external.vaultAddress).toBe(VAULT);
    expect(external.boc).toMatch(/^te6/);
  });

  it('PWA-TX-04E: creates signed Vault-funded username mint messages', async () => {
    const signingSecretKey = new Uint8Array(32).fill(0x44);
    const built = await buildVaultUsernameMintBodyCell({
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      username_registry_address: USERNAME_REGISTRY,
      client_nonce: 11n,
      max_ton_charge: USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
      username: 'platho',
      signingSecretKey,
    });
    const signedPayloadCell = Cell.fromBoc(Buffer.from(
      tonCell.bytesToBase64(tonCell.serializeBoc(built.signedData)),
      'base64',
    ))[0];

    expect(USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS).toBe(63_000_000n);
    expect(ed25519.verify(
      Buffer.from(built.signature, 'hex'),
      Buffer.from(built.signedDataHash, 'hex'),
      ed25519.getPublicKey(signingSecretKey),
    )).toBe(true);
    expect(tonCell.bytesToBase64(tonCell.serializeBoc(built.bodyCell))).toBe(generatedBody(storeMintUsernameFromVaultBalance({
      $$type: 'MintUsernameFromVaultBalance',
      owner_wallet: Address.parseRaw(OWNER),
      signature: Buffer.from(built.signature, 'hex'),
      signed_payload: signedPayloadCell,
    })));

    const external = await buildVaultUsernameMintExternalBoc({
      owner_wallet: OWNER,
      username_registry_address: USERNAME_REGISTRY,
      client_nonce: 11n,
      max_ton_charge: USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
      username: 'platho.ath',
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH.slice(2),
      signingSecretKey,
    }, {
      vaultAddress: VAULT,
    });
    expect(external.vaultAddress).toBe(VAULT);
    expect(external.boc).toMatch(/^te6/);

    const separatorPolicyExternal = await buildVaultUsernameMintExternalBoc({
      owner_wallet: OWNER,
      username_registry_address: USERNAME_REGISTRY,
      client_nonce: 12n,
      max_ton_charge: USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
      username: '----.ath',
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH.slice(2),
      signingSecretKey,
    }, {
      vaultAddress: VAULT,
    });
    expect(separatorPolicyExternal.vaultAddress).toBe(VAULT);
    expect(separatorPolicyExternal.boc).toMatch(/^te6/);
  });

  it('PWA-TX-09: creates public post payload cells and signed Vault-balance public publish messages', async () => {
    const bodyText = 'p'.repeat(PUBLIC_POST_TEXT_MAX_BYTES);
    const payload = await createPublicPostPayload(bodyText);
    const headerCell = Cell.fromBoc(Buffer.from(payload.headerBoc, 'base64'))[0];
    const bodyCell = Cell.fromBoc(Buffer.from(payload.bodyBoc, 'base64'))[0];
    const parsedPayload = readPublicPostPayload(payload);
    expect(payload).toMatchObject({
      type: 'post',
      kind: PUBLIC_BODY_KIND.POST,
      bytes: PUBLIC_POST_BODY_MAX_BYTES,
      headerBytes: 68,
      bodyBytes: PUBLIC_POST_BODY_MAX_BYTES,
    });
    expect(payload.headerHash).toBe(`0x${headerCell.hash().toString('hex')}`);
    expect(payload.bodyHash).toBe(`0x${bodyCell.hash().toString('hex')}`);
    expect(parsedPayload).toMatchObject({
      type: 'post',
      bytes: PUBLIC_POST_BODY_MAX_BYTES,
      flags: 0,
      commentsAllowed: true,
      partIndex: 0,
      partCount: 1,
      profileVersion: 0,
      avatarHash: `0x${'00'.repeat(32)}`,
      text: bodyText,
    });

    const publish = {
      publish_kind: VAULT_PUBLISH_KIND.PUBLIC,
      size_class: VAULT_SIZE_CLASS.STANDARD,
      crypto_suite: VAULT_CRYPTO_SUITE.PUBLIC_NONE,
      header_0_hash: payload.headerHash,
      header_hash: payload.headerHash,
      body_hash: payload.bodyHash,
      header_0_cell: payload.header_cell,
      header_cell: payload.header_cell,
      body_cell: payload.body_cell,
    };

    const built = await buildVaultBalancePublishExternalBoc('PublishPublicFromVaultBalance', {
      owner_wallet: OWNER,
      client_nonce: 4n,
      max_charge: 57_000_000n,
      publish,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey: new Uint8Array(32).fill(0x22),
    }, {
      vaultAddress: VAULT,
    });
    expect(built.vaultAddress).toBe(VAULT);
    expect(built.boc).toMatch(/^te6/);
    expect(built.signature).toHaveLength(128);
  });

  it('PWA-TX-09B: public comments use compact binary parent references', async () => {
    const parentHash = `0x${'ab'.repeat(32)}`;
    const payload = await createPublicPostPayload({
      type: 'comment',
      parentEntryId: 123n,
      parentHash,
      partIndex: 0,
      partCount: 1,
      text: 'one level only',
    });

    expect(payload).toMatchObject({
      type: 'comment',
      kind: PUBLIC_BODY_KIND.COMMENT,
    });
    expect(readPublicPostPayload(payload)).toMatchObject({
      type: 'comment',
      parentEntryId: 123n,
      parentHash,
      text: 'one level only',
    });
    await expect(createPublicPostPayload({
      type: 'comment',
      parentEntryId: 1n,
      parentHash,
      text: 'x'.repeat(PUBLIC_COMMENT_TEXT_MAX_BYTES + 1),
    })).rejects.toThrow(/public comment text exceeds/i);
    expect(PUBLIC_POST_TEXT_MAX_BYTES).toBe(1024);
    expect(PUBLIC_COMMENT_TEXT_MAX_BYTES).toBe(1024);
  });

  it('PWA-TX-09C: public posts can close immutable comments in binary flags', async () => {
    const payload = await createPublicPostPayload({
      type: 'post',
      text: 'Comments closed for this one.',
      commentsAllowed: false,
    });

    const parsed = readPublicPostPayload(payload);
    expect(parsed).toMatchObject({
      type: 'post',
      flags: PUBLIC_BODY_FLAGS.COMMENTS_DISABLED,
      commentsAllowed: false,
      text: 'Comments closed for this one.',
    });
    expect(parsed.header[6]).toBe(PUBLIC_BODY_FLAGS.COMMENTS_DISABLED);
  });

  it('PWA-TX-09D: public header carries multipart stream metadata outside the 1024-byte body', async () => {
    const streamId = new Uint8Array(16).fill(0x42);
    const payload = await createPublicPostPayload({
      type: 'post',
      text: 'part two',
      streamId,
      partIndex: 1,
      partCount: 3,
    });

    const parsed = readPublicPostPayload(payload);
    expect(payload.bodyBytes).toBe(8);
    expect(parsed).toMatchObject({
      type: 'post',
      stream_id: `0x${'42'.repeat(16)}`,
      partIndex: 1,
      partCount: 3,
      text: 'part two',
    });
  });

  it('PWA-TX-09E: public image posts and comments store compact raw WebP parts', async () => {
    const imageBytes = new Uint8Array(1024).fill(0x5a);
    const post = await createPublicPostPayload({
      type: 'image',
      bytes: imageBytes,
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      commentsAllowed: false,
      partIndex: 2,
      partCount: 9,
    });
    const parsedPost = readPublicPostPayload(post);

    expect(post).toMatchObject({
      type: 'image',
      kind: PUBLIC_BODY_KIND.IMAGE_POST,
      bodyBytes: 1024,
    });
    expect(parsedPost).toMatchObject({
      type: 'image',
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      commentsAllowed: false,
      partIndex: 2,
      partCount: 9,
    });
    expect([...parsedPost.imageBytes]).toEqual([...imageBytes]);

    const parentHash = `0x${'cd'.repeat(32)}`;
    const comment = await createPublicPostPayload({
      type: 'image_comment',
      parentEntryId: 42n,
      parentHash,
      bytes: imageBytes.slice(0, 333),
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
    });
    const parsedComment = readPublicPostPayload(comment);

    expect(comment.kind).toBe(PUBLIC_BODY_KIND.IMAGE_COMMENT);
    expect(parsedComment).toMatchObject({
      type: 'image_comment',
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      parentEntryId: 42n,
      parentHash,
    });
    expect(parsedComment.imageBytes).toHaveLength(333);
  });

  it('PWA-TX-09F: public avatar capsules and profile pointers use compact binary headers', async () => {
    const imageBytes = new Uint8Array(777).fill(0xa7);
    const avatarHash = `0x${'12'.repeat(32)}`;
    const streamId = new Uint8Array(16).fill(0x7a);
    const payload = await createPublicPostPayload({
      type: 'avatar',
      bytes: imageBytes,
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      streamId,
      partIndex: 3,
      partCount: 8,
      profileVersion: 2,
      avatarHash,
    });

    expect(payload).toMatchObject({
      type: 'avatar',
      kind: PUBLIC_BODY_KIND.AVATAR,
      headerBytes: 68,
      bodyBytes: 777,
    });
    expect(readPublicPostPayload(payload)).toMatchObject({
      type: 'avatar',
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      partIndex: 3,
      partCount: 8,
      profileVersion: 2,
      avatarHash,
    });
  });
});
