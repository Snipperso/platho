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
  PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS,
  USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS,
  VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN,
  VAULT_CRYPTO_SUITE,
  VAULT_PROFILE_AVATAR_SIGNING_DOMAIN,
  VAULT_PUBLISH_KIND,
  VAULT_SIZE_CLASS,
  VAULT_WITHDRAW_ATH_SIGNING_DOMAIN,
  VAULT_WITHDRAW_TON_SIGNING_DOMAIN,
  VAULT_USERNAME_MINT_SIGNING_DOMAIN,
  buildAthWalletMessageBody,
  buildProfileRegistryMessageBody,
  buildUsernameRegistryMessageBody,
  buildVaultBalancePublishBodyCell,
  buildVaultBalancePublishExternalBoc,
  buildVaultProfileAvatarBodyCell,
  buildVaultProfileAvatarExternalBoc,
  buildVaultReplaceMessagingKeysExternalBoc,
  buildVaultWithdrawAthExternalBoc,
  buildVaultWithdrawTonExternalBoc,
  buildVaultUsernameMintBodyCell,
  buildVaultUsernameMintExternalBoc,
  buildVaultMessageBody,
  createAthWalletMessage,
  createProfileRegistryMessage,
  createPublicPostPayload,
  createUsernameRegistryMessage,
  createWalletTransaction,
  createVaultWalletMessage,
  estimateAthWalletAttachedValueNanotons,
  REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS,
  estimateVaultAttachedValueNanotons,
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

  it('PWA-TX-01B: TON withdrawal and key rotation are signed Vault external BOCs, not wallet message bodies', async () => {
    const signingSecretKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    expect(() => buildVaultMessageBody('ReplaceMessagingKeys', {})).toThrow(/Unsupported Vault message type/);
    expect(() => buildVaultMessageBody('WithdrawTonFromVaultBalance', {})).toThrow(/Unsupported Vault message type/);
    expect(() => buildVaultMessageBody('WithdrawAthFromVaultBalance', {})).toThrow(/Unsupported Vault message type/);

    const replaceExternal = await buildVaultReplaceMessagingKeysExternalBoc({
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
      client_nonce: 12n,
      enc_pubkey: 0x33n,
      sign_pubkey: 0x44n,
      pq_kem_pubkey_hash: 0x55n,
      pq_kem_pubkey_len: 1184n,
      pq_kem_pubkey: PQ_PUBKEY_BYTES,
      crypto_suite_mask: 2n,
    });
    const withdrawExternal = await buildVaultWithdrawTonExternalBoc({
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
      client_nonce: 13n,
      amount: 55_000_000n,
      recipient: RECIPIENT,
    });
    const withdrawAthExternal = await buildVaultWithdrawAthExternalBoc({
      owner_wallet: OWNER,
      vaultAddress: VAULT,
      deploymentManifestHash: DEPLOYMENT_MANIFEST_HASH,
      signingSecretKey,
      client_nonce: 14n,
      amount: 500n,
      recipient: RECIPIENT,
    });

    const withdrawSlice = expectVaultAddressSignedDataEnvelope(withdrawExternal.signedData, VAULT_WITHDRAW_TON_SIGNING_DOMAIN, OWNER);
    expect(withdrawSlice.loadUintBig(64)).toBe(13n);
    expect(withdrawSlice.remainingBits).toBe(0);
    expect(withdrawSlice.remainingRefs).toBe(1);
    const withdrawAction = withdrawSlice.loadRef().beginParse();
    expect(withdrawAction.loadUintBig(128)).toBe(55_000_000n);
    expect(withdrawAction.loadAddress()?.equals(Address.parseRaw(RECIPIENT))).toBe(true);
    expect(withdrawAction.remainingBits).toBe(0);
    expect(withdrawAction.remainingRefs).toBe(0);
    const withdrawAthSlice = expectVaultAddressSignedDataEnvelope(withdrawAthExternal.signedData, VAULT_WITHDRAW_ATH_SIGNING_DOMAIN, OWNER);
    expect(withdrawAthSlice.loadUintBig(64)).toBe(14n);
    expect(withdrawAthSlice.remainingBits).toBe(0);
    expect(withdrawAthSlice.remainingRefs).toBe(1);
    const withdrawAthAction = withdrawAthSlice.loadRef().beginParse();
    expect(withdrawAthAction.loadUintBig(128)).toBe(500n);
    expect(withdrawAthAction.loadAddress()?.equals(Address.parseRaw(RECIPIENT))).toBe(true);
    expect(withdrawAthAction.remainingBits).toBe(0);
    expect(withdrawAthAction.remainingRefs).toBe(0);

    for (const external of [replaceExternal, withdrawExternal, withdrawAthExternal]) {
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
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequest')).toBe(48_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHBurn')).toBe(4_000_000n);
    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestWithNotify', { notify_value: 30_000_000n })).toBe(69_000_000n);
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
    expect(athMessage.amount).toBe('48000000');
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
    expectPublishSignedDataEnvelope(
      built.signedData,
      VAULT_PUBLISH_KIND.PRIVATE,
      OWNER,
      VAULT_SIZE_CLASS.STANDARD,
      VAULT_CRYPTO_SUITE.HYBRID,
    );
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

  it('PWA-USERNAME-ROUTE-ATHMASTER-01: username route verifies official ATH wallet owner and ATHMaster', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const route = app.match(/async function requireUsernameRegistryVaultRoute[\s\S]*?async function requireUsernameRegistryVaultRouteForOwnVaultAction/);

    expect(route?.[0]).toContain('provider.getAthWalletAddress(registry');
    expect(route?.[0]).toContain('registryGlobal.official_ath_wallet_address');
    expect(route?.[0]).toContain('createAthWalletTonRpcProvider({ athWalletAddress: officialWallet }).getWalletData');
    expect(route?.[0]).toContain('if (!isAthWalletNotDeployedError(error)) throw error');
    expect(route?.[0]).not.toContain('isMissingAthWalletOwnerError');
    expect(route?.[0]).toContain('UsernameRegistry official ATH wallet is not the derived registry wallet');
    expect(route?.[0]).toContain('UsernameRegistry official ATH wallet owner does not match registry');
    expect(route?.[0]).toContain('UsernameRegistry official ATH wallet ATHMaster binding does not match this app config');
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
      size_class: payload.size_class,
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
    expectPublishSignedDataEnvelope(
      built.signedData,
      VAULT_PUBLISH_KIND.PUBLIC,
      OWNER,
      VAULT_SIZE_CLASS.KIB_32,
      VAULT_CRYPTO_SUITE.PUBLIC_NONE,
    );
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
