import { Address, beginCell, Cell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  storeCancelReceiveIntent,
  storeClaimReceiveIntent,
  storeCreateReceiveIntent,
  storeDepositTon,
  storeRegisterMessagingKeys,
  storeReplaceMessagingKeys,
  storeRevokeSession,
  storeSetSession,
  storeTopUpMessageBudget,
  storeWithdrawAth,
  storeWithdrawTon,
} from '../build/Vault/Vault_Vault';
import {
  storeATHBurn,
  storeATHTransferRequest,
  storeATHTransferRequestMintUsername,
  storeATHTransferRequestProfileAvatar,
  storeATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  storeFlushAthRefundDue,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ATH_WALLET_RESERVES_NANOTONS,
  PUBLIC_BODY_FLAGS,
  PUBLIC_BODY_KIND,
  PUBLIC_BODY_MEDIA_FORMATS,
  PUBLIC_POST_BODY_MAX_BYTES,
  PUBLIC_COMMENT_TEXT_MAX_BYTES,
  PUBLIC_POST_TEXT_MAX_BYTES,
  RECEIVE_ASSETS,
  USERNAME_REGISTRY_RESERVES_NANOTONS,
  VAULT_CRYPTO_SUITE,
  VAULT_EXTERNAL_MAGIC,
  VAULT_EXTERNAL_OPS,
  VAULT_EXTERNAL_VERSION,
  VAULT_PUBLISH_KIND,
  VAULT_SIZE_CLASS,
  buildAthWalletMessageBody,
  buildUsernameRegistryMessageBody,
  buildVaultExternalPublishBoc,
  buildVaultMessageBody,
  createAthWalletMessage,
  createPublicPostPayload,
  createWalletTransaction,
  createVaultSessionKey,
  createVaultWalletMessage,
  createUsernameRegistryWalletMessage,
  estimateAthWalletAttachedValueNanotons,
  estimateUsernameRegistryAttachedValueNanotons,
  estimateVaultAttachedValueNanotons,
  readPublicPostPayload,
  signVaultSessionHash,
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

const EMPTY_PQ_CELL = beginCell().endCell();
const PQ_PUBKEY_BYTES = Buffer.alloc(1184, 0x55);
const PQ_PUBKEY_CELL = snakeCellFromBytes(PQ_PUBKEY_BYTES);

describe('PWA contract transaction builders', () => {
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
      'TopUpMessageBudget',
      { amount: 10_000_000n },
      storeTopUpMessageBudget({ $$type: 'TopUpMessageBudget', amount: 10_000_000n }),
    ],
    [
      'SetSession',
      { session_pubkey: 0x1234n, expires_at: 1_800_000_000n },
      storeSetSession({ $$type: 'SetSession', session_pubkey: 0x1234n, expires_at: 1_800_000_000n }),
    ],
    [
      'RevokeSession',
      {},
      storeRevokeSession({ $$type: 'RevokeSession' }),
    ],
    [
      'RegisterMessagingKeys',
      {
        enc_pubkey: 0x11n,
        sign_pubkey: 0x22n,
        pq_kem_pubkey_hash: 0n,
        pq_kem_pubkey_len: 0n,
        pq_kem_pubkey: Buffer.alloc(0),
        crypto_suite_mask: 1n,
      },
      storeRegisterMessagingKeys({
        $$type: 'RegisterMessagingKeys',
        enc_pubkey: 0x11n,
        sign_pubkey: 0x22n,
        pq_kem_pubkey_hash: 0n,
        pq_kem_pubkey_len: 0n,
        pq_kem_pubkey: EMPTY_PQ_CELL,
        crypto_suite_mask: 1n,
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
    [
      'CreateReceiveIntent',
      {
        asset: RECEIVE_ASSETS.TON,
        amount: 120_000_000n,
        recipient_wallet: RECIPIENT,
        commitment: 0x7777n,
        client_nonce: 9n,
      },
      storeCreateReceiveIntent({
        $$type: 'CreateReceiveIntent',
        asset: RECEIVE_ASSETS.TON,
        amount: 120_000_000n,
        recipient_wallet: Address.parseRaw(RECIPIENT),
        commitment: 0x7777n,
        client_nonce: 9n,
      }),
    ],
    [
      'ClaimReceiveIntent',
      { intent_id: 0x8888n, secret32: 0x9999n },
      storeClaimReceiveIntent({ $$type: 'ClaimReceiveIntent', intent_id: 0x8888n, secret32: 0x9999n }),
    ],
    [
      'CancelReceiveIntent',
      { intent_id: 0x8888n },
      storeCancelReceiveIntent({ $$type: 'CancelReceiveIntent', intent_id: 0x8888n }),
    ],
  ])('PWA-TX-01: %s body matches generated Tact wrapper encoding', (type, params, store) => {
    expect(buildVaultMessageBody(type, params)).toBe(generatedBody(store));
  });

  it('PWA-TX-02: quotes exact explicit Vault reserve values used by the PWA', () => {
    expect(estimateVaultAttachedValueNanotons('DepositTon', { amount: 1_000n }, { userExists: false })).toBe(12_001_000n);
    expect(estimateVaultAttachedValueNanotons('DepositTon', { amount: 1_000n }, { userExists: true })).toBe(2_001_000n);
    expect(estimateVaultAttachedValueNanotons('SetSession', {}, { userExists: false, sessionExists: false })).toBe(17_000_000n);
    expect(estimateVaultAttachedValueNanotons('SetSession', {}, { userExists: true, sessionExists: false })).toBe(7_000_000n);
    expect(estimateVaultAttachedValueNanotons('SetSession', {}, { userExists: true, sessionExists: true })).toBe(0n);
    expect(estimateVaultAttachedValueNanotons('RegisterMessagingKeys', { crypto_suite_mask: 1n }, { userExists: false })).toBe(17_000_000n);
    expect(estimateVaultAttachedValueNanotons('RegisterMessagingKeys', { crypto_suite_mask: 2n }, { userExists: true })).toBe(32_000_000n);
    expect(estimateVaultAttachedValueNanotons('CreateReceiveIntent')).toBe(7_000_000n);
    expect(estimateVaultAttachedValueNanotons('ClaimReceiveIntent', {}, { recipientUserExists: false })).toBe(12_000_000n);
    expect(estimateVaultAttachedValueNanotons('WithdrawAth')).toBe(30_000_000n);
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
      'ATHTransferRequestMintUsername',
      {
        query_id: 13n,
        amount: 100_000_000_000n,
        recipient: USERNAME_REGISTRY,
        response_destination: OWNER,
        notify_value: 30_000_000n,
        username: 'platho.ath',
      },
      storeATHTransferRequestMintUsername({
        $$type: 'ATHTransferRequestMintUsername',
        query_id: 13n,
        amount: 100_000_000_000n,
        recipient: Address.parseRaw(USERNAME_REGISTRY),
        response_destination: Address.parseRaw(OWNER),
        notify_value: 30_000_000n,
        username_len: 6n,
        username: beginCell().storeBuffer(Buffer.from('platho', 'ascii')).endCell().beginParse(),
      }),
    ],
    [
      'ATHTransferRequestProfileAvatar',
      {
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
      },
      storeATHTransferRequestProfileAvatar({
        $$type: 'ATHTransferRequestProfileAvatar',
        query_id: 15n,
        amount: 100_000_000_000n,
        recipient: Address.parseRaw(USERNAME_REGISTRY),
        response_destination: Address.parseRaw(OWNER),
        notify_value: 30_000_000n,
        avatar_hash: 0x1234n,
        avatar_entry_id: 77n,
        avatar_stream_id: 0xabcden,
        avatar_part_count: 8n,
        media_format: BigInt(PUBLIC_BODY_MEDIA_FORMATS.WEBP),
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

  it('PWA-TX-07: quotes exact ATHWallet and username refund values used by the PWA', () => {
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequest')).toBe(4_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHBurn')).toBe(4_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestWithNotify', { notify_value: 30_000_000n })).toBe(50_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestMintUsername', { notify_value: 31_000_000n })).toBe(51_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestProfileAvatar', { notify_value: 30_000_000n })).toBe(50_000_000n);
    expect(estimateUsernameRegistryAttachedValueNanotons('FlushAthRefundDue')).toBe(7_000_000n);
    expect(ATH_WALLET_RESERVES_NANOTONS.transferNotifyMinValue).toBe(30_000_000n);
    expect(USERNAME_REGISTRY_RESERVES_NANOTONS.athTransferExec).toBe(5_000_000n);
  });

  it('PWA-TX-08: builds ATHWallet and UsernameRegistry wallet messages', () => {
    const athMessage = createAthWalletMessage('ATHTransferRequest', {
      query_id: 11n,
      amount: 500n,
      recipient: RECIPIENT,
      response_destination: OWNER,
    }, {
      athWalletAddress: ATH_WALLET,
    });
    expect(athMessage.address).toBe(ATH_WALLET);
    expect(athMessage.amount).toBe('4000000');
    expect(athMessage.payload).toBe(generatedBody(storeATHTransferRequest({
      $$type: 'ATHTransferRequest',
      query_id: 11n,
      amount: 500n,
      recipient: Address.parseRaw(RECIPIENT),
      response_destination: Address.parseRaw(OWNER),
    })));

    const refundMessage = createUsernameRegistryWalletMessage('FlushAthRefundDue', {
      query_id: 22n,
      owner_wallet: OWNER,
    }, {
      usernameRegistryAddress: USERNAME_REGISTRY,
    });
    expect(refundMessage.address).toBe(USERNAME_REGISTRY);
    expect(refundMessage.amount).toBe('7000000');
    expect(refundMessage.payload).toBe(generatedBody(storeFlushAthRefundDue({
      $$type: 'FlushAthRefundDue',
      query_id: 22n,
      owner_wallet: Address.parseRaw(OWNER),
    })));
  });

  it('PWA-TX-04: creates session keys and signs Vault session publish hashes', () => {
    const secretKey = new Uint8Array(32).fill(9);
    const key = createVaultSessionKey({ secretKey });
    const hash = 0x1234n;

    expect(key.secretKey).toEqual(secretKey);
    expect(key.publicKey).toHaveLength(32);
    expect(key.session_pubkey).toBe(BigInt(`0x${Buffer.from(key.publicKey).toString('hex')}`));
    expect(signVaultSessionHash(hash, secretKey)).toHaveLength(64);
  });

  it('PWA-TX-05: builds Vault external private publish BoC matching @ton/core layout', () => {
    const secretKey = new Uint8Array(32).fill(7);
    const publishHash = 0x987654321n;
    const header0Cell = finalPrivateHeader0Cell();
    const header1Cell = finalPrivateHeader1Cell();
    const bodyCell = finalPrivateBodyCell();
    const publish = {
      publish_kind: VAULT_PUBLISH_KIND.PRIVATE,
      size_class: VAULT_SIZE_CLASS.STANDARD,
      crypto_suite: VAULT_CRYPTO_SUITE.CLASSICAL,
      header_0_hash: cellPayload(header0Cell).hash,
      header_1_hash: cellPayload(header1Cell).hash,
      body_hash: cellPayload(bodyCell).hash,
      header_0_cell: cellPayload(header0Cell),
      header_1_cell: cellPayload(header1Cell),
      body_cell: cellPayload(bodyCell),
    };
    const signature = signVaultSessionHash(publishHash, secretKey);
    const hashesRef = beginCell()
      .storeUint(BigInt(publish.body_hash), 256)
      .storeUint(BigInt(publish.header_0_hash), 256)
      .storeUint(BigInt(publish.header_1_hash), 256)
      .endCell();
    const signatureRef = beginCell().storeBuffer(Buffer.from(signature)).endCell();
    const payloadRef = beginCell()
      .storeRef(header0Cell)
      .storeRef(header1Cell)
      .storeRef(bodyCell)
      .endCell();
    const expected = beginCell()
      .storeUint(VAULT_EXTERNAL_MAGIC, 32)
      .storeUint(VAULT_EXTERNAL_VERSION, 8)
      .storeUint(VAULT_EXTERNAL_OPS.PublishPrivateBySessionExternal, 32)
      .storeAddress(Address.parseRaw(OWNER))
      .storeUint(0x5555n, 256)
      .storeUint(3n, 64)
      .storeUint(1_800_000_000n, 32)
      .storeUint(VAULT_PUBLISH_KIND.PRIVATE, 8)
      .storeUint(VAULT_SIZE_CLASS.STANDARD, 8)
      .storeUint(VAULT_CRYPTO_SUITE.CLASSICAL, 8)
      .storeUint(58_000_000n, 128)
      .storeRef(hashesRef)
      .storeRef(signatureRef)
      .storeRef(payloadRef)
      .endCell()
      .toBoc({ idx: false, crc32: false })
      .toString('base64');

    expect(buildVaultExternalPublishBoc({
      publish,
      owner: OWNER,
      sessionId: 0x5555n,
      sessionNonce: 3n,
      validUntil: 1_800_000_000n,
      maxCharge: 58_000_000n,
      sessionPublishHash: publishHash,
      sessionSecretKey: secretKey,
    })).toBe(expected);
  });

  it('PWA-TX-09: creates public post payload cells and public external publish BoCs', async () => {
    const secretKey = new Uint8Array(32).fill(8);
    const publishHash = 0x777777n;
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
      body_hash: payload.bodyHash,
      header_0_cell: payload.header_cell,
      body_cell: payload.body_cell,
    };
    const signature = signVaultSessionHash(publishHash, secretKey);
    const hashesRef = beginCell()
      .storeUint(BigInt(publish.body_hash), 256)
      .storeUint(BigInt(publish.header_0_hash), 256)
      .storeUint(0n, 256)
      .endCell();
    const signatureRef = beginCell().storeBuffer(Buffer.from(signature)).endCell();
    const payloadRef = beginCell().storeRef(headerCell).storeRef(bodyCell).endCell();
    const expected = beginCell()
      .storeUint(VAULT_EXTERNAL_MAGIC, 32)
      .storeUint(VAULT_EXTERNAL_VERSION, 8)
      .storeUint(VAULT_EXTERNAL_OPS.PublishPublicBySessionExternal, 32)
      .storeAddress(Address.parseRaw(OWNER))
      .storeUint(0x9999n, 256)
      .storeUint(4n, 64)
      .storeUint(1_800_000_000n, 32)
      .storeUint(VAULT_PUBLISH_KIND.PUBLIC, 8)
      .storeUint(VAULT_SIZE_CLASS.STANDARD, 8)
      .storeUint(VAULT_CRYPTO_SUITE.PUBLIC_NONE, 8)
      .storeUint(57_000_000n, 128)
      .storeRef(hashesRef)
      .storeRef(signatureRef)
      .storeRef(payloadRef)
      .endCell()
      .toBoc({ idx: false, crc32: false })
      .toString('base64');

    expect(buildVaultExternalPublishBoc({
      publish,
      owner: OWNER,
      sessionId: 0x9999n,
      sessionNonce: 4n,
      validUntil: 1_800_000_000n,
      maxCharge: 57_000_000n,
      sessionPublishHash: publishHash,
      sessionSecretKey: secretKey,
    })).toBe(expected);
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
