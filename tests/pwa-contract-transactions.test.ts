import { readFileSync } from 'node:fs';
import { Address, beginCell, Cell } from '@ton/core';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';
import {
  storeATHBurn,
  storeATHTransferRequest,
  storeATHTransferRequestWithNotify,
  storeATHTransferRequestRegistryMintUsername,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  storeFlushProfileBurnAthDue,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import {
  storeFlushBurnAthDue,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ATH_WALLET_RESERVES_NANOTONS,
  PUBLIC_BODY_FLAGS,
  PUBLIC_BODY_KIND,
  PUBLIC_BODY_MEDIA_FORMATS,
  PUBLIC_POST_BODY_MAX_BYTES,
  PUBLIC_COMMENT_TEXT_MAX_BYTES,
  PUBLIC_POST_TEXT_MAX_BYTES,
  PROFILE_AVATAR_PRICE_ATH,
  VAULT_SIZE_CLASS,
  buildAthWalletMessageBody,
  buildProfileRegistryMessageBody,
  buildUsernameRegistryMessageBody,
  createAthWalletMessage,
  createProfileRegistryMessage,
  createPublicPostPayload,
  createUsernameRegistryMessage,
  createWalletTransaction,
  estimateAthWalletAttachedValueNanotons,
  REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS,
  readPublicPostPayload,
  readPublicPartHeaderInfo,
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

function tonCellToCoreCell(cell: any) {
  return Cell.fromBoc(Buffer.from(
    tonCell.bytesToBase64(tonCell.serializeBoc(cell)),
    'base64',
  ))[0];
}

function expectVaultAddressSignedDataEnvelope(cell: any, domain: bigint, owner: string) {
  const slice = tonCellToCoreCell(cell).beginParse();
  expect(slice.loadUintBig(32)).toBe(domain);
  expect(slice.loadUintBig(256)).toBe(BigInt(DEPLOYMENT_MANIFEST_HASH));
  expect(slice.loadAddress()?.equals(Address.parseRaw(VAULT))).toBe(true);
  expect(slice.loadAddress()?.equals(Address.parseRaw(owner))).toBe(true);
  return slice;
}

function expectRegistrySignedDataEnvelope(cell: any, domain: bigint, owner: string) {
  const slice = tonCellToCoreCell(cell).beginParse();
  expect(slice.loadUintBig(32)).toBe(domain);
  expect(slice.loadUintBig(256)).toBe(BigInt(DEPLOYMENT_MANIFEST_HASH));
  expect(slice.loadAddress()?.equals(Address.parseRaw(owner))).toBe(true);
  slice.loadUintBig(64);
  slice.loadUintBig(128);
  expect(slice.loadAddress()?.equals(Address.parseRaw(VAULT))).toBe(true);
  return slice;
}

function addressHashValue(raw: string) {
  return BigInt(`0x${Address.parseRaw(raw).hash.toString('hex')}`);
}

function expectPublishSignedDataEnvelope(
  cell: any,
  kind: bigint,
  owner: string,
  sizeClass: bigint,
  cryptoSuite: bigint,
) {
  const slice = tonCellToCoreCell(cell).beginParse();
  expect(slice.loadUintBig(32)).toBe(VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN);
  expect(slice.loadUintBig(256)).toBe(BigInt(DEPLOYMENT_MANIFEST_HASH));
  expect(slice.loadUintBig(256)).toBe(addressHashValue(VAULT));
  expect(slice.loadUintBig(8)).toBe(kind);
  expect(slice.loadUintBig(256)).toBe(addressHashValue(owner));
  slice.loadUintBig(64);
  slice.loadUintBig(128);
  expect(slice.loadUintBig(8)).toBe(sizeClass);
  expect(slice.loadUintBig(8)).toBe(cryptoSuite);
  expect(slice.remainingBits).toBe(0);
  expect(slice.remainingRefs).toBe(1);
  return slice;
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

  it('PWA-TX-06C: ATHTransferRequestRegistryMintUsername body matches the compiled Tact store (direct-pay mint)', () => {
    const usernameBytes = new TextEncoder().encode('alice-01');
    const payload = buildAthWalletMessageBody('ATHTransferRequestRegistryMintUsername', {
      query_id: 21n,
      amount: 100_000_000_000n,
      recipient: USERNAME_REGISTRY,
      response_destination: OWNER,
      notify_value: 32_000_000n,
      owner_wallet: OWNER,
      username: usernameBytes,
    });
    expect(payload).toBe(generatedBody(storeATHTransferRequestRegistryMintUsername({
      $$type: 'ATHTransferRequestRegistryMintUsername',
      query_id: 21n,
      amount: 100_000_000_000n,
      recipient: Address.parseRaw(USERNAME_REGISTRY),
      response_destination: Address.parseRaw(OWNER),
      notify_value: 32_000_000n,
      owner_wallet: Address.parseRaw(OWNER),
      username_len: BigInt(usernameBytes.length),
      username: beginCell().storeBuffer(Buffer.from(usernameBytes)).endCell().beginParse(),
    })));
  });

  it('PWA-TX-06D: builds permissionless registry ATH burn flush messages', () => {
    const usernamePayload = buildUsernameRegistryMessageBody('FlushBurnAthDue', {
      query_id: 31n,
    });
    const profilePayload = buildProfileRegistryMessageBody('FlushProfileBurnAthDue', {
      query_id: 32n,
    });
    expect(usernamePayload).toBe(generatedBody(storeFlushBurnAthDue({
      $$type: 'FlushBurnAthDue',
      query_id: 31n,
    })));
    expect(profilePayload).toBe(generatedBody(storeFlushProfileBurnAthDue({
      $$type: 'FlushProfileBurnAthDue',
      query_id: 32n,
    })));

    const usernameMessage = createUsernameRegistryMessage('FlushBurnAthDue', {
      query_id: 31n,
    }, {
      usernameRegistryAddress: USERNAME_REGISTRY,
    });
    const profileMessage = createProfileRegistryMessage('FlushProfileBurnAthDue', {
      query_id: 32n,
    }, {
      profileRegistryAddress: PROFILE_REGISTRY,
    });
    expect(usernameMessage).toMatchObject({
      address: USERNAME_REGISTRY,
      amount: REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS.toString(),
      payload: usernamePayload,
    });
    expect(profileMessage).toMatchObject({
      address: PROFILE_REGISTRY,
      amount: REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS.toString(),
      payload: profilePayload,
    });
    expect(createWalletTransaction([usernameMessage, profileMessage], {
      nowMs: 1_700_000_000_000,
      ttlSeconds: 60,
    })).toEqual({
      validUntil: 1_700_000_060,
      messages: [usernameMessage, profileMessage],
    });
  });

  it('PWA-TX-07: quotes exact ATHWallet generic values used by the PWA', () => {
    // 2M owner exec + 29M arrival floor (2+3+4+20) + 8M forward allowance. Was 48,000,000 while the forward
    // allowance was an unmeasured 21,000,000; see ATH-MIRROR-04, which derives this from the contract.
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequest')).toBe(39_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHBurn')).toBe(4_000_000n);
    // 30M notify + 1M notify-ack + 4M source-ack + 7M notify-exec + 20M endowment + 10M owner-exec. Was 69_000_000
    // while the source-ack mirror sat at a stale 1M; see ATH-MIRROR-01, which derives this from the contract.
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestWithNotify', { notify_value: 30_000_000n })).toBe(72_000_000n);
    expect(() => estimateAthWalletAttachedValueNanotons('WalletProductMintUsername', { notify_value: 32_000_000n })).toThrow(/Unsupported ATHWallet message type/);
    expect(() => estimateAthWalletAttachedValueNanotons('WalletProductProfileAvatar', { notify_value: 30_000_000n })).toThrow(/Unsupported ATHWallet message type/);
    // Raised 30M -> 45M on 2026-07-20: at 30M a refused registry purchase refunded only 24,037,796, under the 26M
    // that gate 14212 demands on arrival, so the buyer's ATH was stranded. See ath-notify-refund-floor.test.ts.
    expect(ATH_WALLET_RESERVES_NANOTONS.transferNotifyMinValue).toBe(45_000_000n);
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
    expect(athMessage.amount).toBe('39000000');
    expect(athMessage.payload).toBe(generatedBody(storeATHTransferRequest({
      $$type: 'ATHTransferRequest',
      query_id: 11n,
      amount: 500n,
      recipient: Address.parseRaw(RECIPIENT),
      response_destination: Address.parseRaw(OWNER),
    })));
  });

  it('PWA-TX-04D2: profile avatar pays ProfileRegistry directly, with no Vault route read', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const direct = app.slice(
      app.indexOf('async function submitProfileAvatarDirect'),
      app.indexOf('// clean-17 direct-pay: the avatar rides ONE wallet transfer'),
    );

    // The Vault route verifier (Vault global -> ProfileRegistry -> derived official ATH wallet) is gone with the
    // Vault avatar path. Direct pay addresses the registry from the config+manifest pin and sends the 100 ATH as
    // a plain ATHWallet transfer, so there is no registry global to cross-check before signing.
    expect(app).not.toContain('async function requireProfileRegistryVaultRoute');
    expect(app).not.toContain('ProfileRegistry official ATH wallet is not the derived registry wallet');
    expect(direct).toContain("createAthWalletMessage('ATHTransferRequestRegistryProfileAvatar'");
    expect(direct).toContain('recipient: requireProfileRegistryAddress()');
    expect(direct).toContain('amount: PROFILE_AVATAR_PRICE_ATH');
  });

  // PWA-USERNAME-ROUTE-ATHMASTER-01 removed with the Vault username route: it verified a VAULT-declared
  // UsernameRegistry (its official ATH wallet, that wallet's owner, and its ATHMaster binding) before signing a
  // Vault external. Direct pay signs no Vault external — the wallet pays the registry from the config+manifest
  // pin — so there is no declared route to cross-check. The mint message itself stays byte-pinned above.

  it('PWA-TX-09: creates public post payload cells (V1 reader wire)', async () => {
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

    // The size class the READERS key their limits on — the Vault-balance publish that used to ride here went
    // with the Vault batch machinery (2026-08-29).
    expect(payload.size_class).toBe(VAULT_SIZE_CLASS.KIB_32);
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
    expect(PUBLIC_POST_TEXT_MAX_BYTES).toBe(32 * 1024);
    expect(PUBLIC_COMMENT_TEXT_MAX_BYTES).toBe(32 * 1024);
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

  it('PWA-TX-09D: public header carries multipart stream metadata outside the size-class body', async () => {
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
      size_class: VAULT_SIZE_CLASS.STANDARD,
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

  it('PWA-TX-09E2: public document posts and comments store compact raw document parts', async () => {
    const documentBytes = new Uint8Array([0x50, 0x44, 0x43, 0x31, 1, 0, 0, 1, 1, 0, 0, 0, 0, 2, 0x68, 0x69]);
    const post = await createPublicPostPayload({
      type: 'document',
      bytes: documentBytes,
      commentsAllowed: false,
      partIndex: 1,
      partCount: 2,
    });
    const parsedPost = readPublicPostPayload(post);

    expect(post).toMatchObject({
      type: 'document',
      kind: PUBLIC_BODY_KIND.DOCUMENT_POST,
      bodyBytes: documentBytes.length,
      size_class: VAULT_SIZE_CLASS.STANDARD,
    });
    expect(parsedPost).toMatchObject({
      type: 'document',
      commentsAllowed: false,
      partIndex: 1,
      partCount: 2,
    });
    expect([...parsedPost.documentBytes]).toEqual([...documentBytes]);

    const parentHash = `0x${'ef'.repeat(32)}`;
    const comment = await createPublicPostPayload({
      type: 'document_comment',
      parentEntryId: 77n,
      parentHash,
      bytes: documentBytes,
    });
    const parsedComment = readPublicPostPayload(comment);

    expect(comment.kind).toBe(PUBLIC_BODY_KIND.DOCUMENT_COMMENT);
    expect(parsedComment).toMatchObject({
      type: 'document_comment',
      parentEntryId: 77n,
      parentHash,
    });
    expect([...parsedComment.documentBytes]).toEqual([...documentBytes]);
  });

  it('PWA-TX-09F: public avatar capsules and profile pointers use compact binary headers', async () => {
    const imageBytes = new Uint8Array(26 * 1024).fill(0xa7);
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
      bodyBytes: 26 * 1024,
      size_class: VAULT_SIZE_CLASS.KIB_32,
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

// Header-ONLY multipart info (v650): the feed walk's straddle extension groups entries into multipart streams
// without body reads — the parser must round-trip the builder's headers for every kind and NEVER throw on junk.
describe('readPublicPartHeaderInfo', () => {
  it('PWA-PUB-HDR-01: round-trips multipart fields from real builder headers (post, image, comment kinds)', async () => {
    const streamId = new Uint8Array(16).fill(0x5a);
    const image = await createPublicPostPayload({
      type: 'image', bytes: new Uint8Array(64).fill(7), mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      streamId, partIndex: 1, partCount: 2, createdAtSec: 1_783_000_000,
      profileVersion: 0, avatarHash: `0x${'00'.repeat(32)}`, commentsAllowed: true,
    }, { sizeClass: 1 });
    expect(readPublicPartHeaderInfo(image.header_boc)).toMatchObject({
      kind: PUBLIC_BODY_KIND.IMAGE_POST,
      streamId: `0x${'5a'.repeat(16)}`,
      partIndex: 1,
      partCount: 2,
    });
    const comment = await createPublicPostPayload({
      type: 'comment', text: 'hi', streamId, partIndex: 0, partCount: 1, createdAtSec: 1_783_000_000,
      profileVersion: 0, avatarHash: `0x${'00'.repeat(32)}`,
      parentEntryId: 7n, parentHash: `0x${'11'.repeat(32)}`,
    }, { sizeClass: 1 });
    expect(readPublicPartHeaderInfo(comment.header_boc)).toMatchObject({
      kind: PUBLIC_BODY_KIND.COMMENT,
      partIndex: 0,
      partCount: 1,
    });
  });

  it('PWA-PUB-HDR-02: tolerant null on junk — a malformed header must never throw out of the walker', () => {
    expect(readPublicPartHeaderInfo(null)).toBe(null);
    expect(readPublicPartHeaderInfo(undefined)).toBe(null);
    expect(readPublicPartHeaderInfo('not-a-boc')).toBe(null);
    expect(readPublicPartHeaderInfo({ boc: 'AAAA' })).toBe(null);
  });
});
