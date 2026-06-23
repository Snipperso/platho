import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { webcrypto } from 'crypto';
import {
  AthTransferNotification,
  CapsuleHubBatchAck,
  loadVault$Data,
  storeVault$Data,
} from '../build/Vault/Vault_Vault';
import { FlushFees } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import {
  createMessagingIdentity,
  createEncryptedPrivateCapsuleFromPublicBundle,
  encodeCompactPayload,
  exportPublicKeyBundle,
  PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
} from '../web/crypto/platho-crypto.mjs';
import { splitBytesToCapsuleParts, MAX_CAPSULE_USEFUL_BYTES } from '../web/capsule-part-policy.mjs';
import { createPublicPostPayload, PUBLIC_BODY_MEDIA_FORMATS } from '../web/pwa-contract-transactions.mjs';
import {
  KIND_PRIVATE,
  KIND_PUBLIC,
  SIZE_1K,
  SIZE_2K,
  SIZE_4K,
  SIZE_8K,
  SIZE_16K,
  SIZE_32K,
  ACT_PUBLISH_BATCH,
  RES_CONFIRMED,
  AIRDROP_REWARD_PER_CAPSULE,
  PROTOCOL_FEE_TON_BATCH,
  ATH_FULL_DISCOUNT_AMOUNT,
  OP_PUBLISH_BATCH_TO_HUB,
  MANIFEST_HASH,
  cellHash,
  partsList,
  privatePartCustom,
  publicPartCustom,
  batchExternalBody,
  computeBatchPublishId,
  bounceIdOf,
  setupVault,
  setupVaultAirdrop,
  registerHybrid,
  depositTon,
  deployBoundSealedPair,
} from './helpers/vpb2';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// VPB2 migration of the legacy "Vault milestone 6" Vault-balance publish-orchestration suite. The removed
// single-publish externals (0x7E1F5031/0x7E1F5032) and getCanonicalPublishCharge are gone; every kept test
// is repointed onto the batch external (op 0x7e1f5041, batchExternalBody) + the Group D settlement chain.
// The full chain (Vault accept -> PublishBatchToHub -> Hub ingest -> CapsuleHubBatchAck -> settle) runs
// synchronously inside one blockchain.sendMessage(external(...)) on a deployBoundSealedPair scaffold.

// A maxCharge that comfortably clears the canonical_total for small private/public batches in these scaffolds.
const PRIVATE_MAX_CHARGE = toNano('1');
const PUBLIC_MAX_CHARGE = toNano('1');

// ---------------------------------------------------------------------------
// Local helpers (inlined — the shared helper is frozen).
// ---------------------------------------------------------------------------

// Reads the protocol_fee_total field straight off the Vault->Hub PublishBatchToHub internal message body.
// op(32) bounce_id(64) bounce_tag(160) publish_id(256) publish_kind(8) part_count(8) protocol_fee_total(128)
function outgoingProtocolFeeTotal(res: any, hubAddress: Address): bigint {
  const tx = res.transactions.find((t: any) =>
    t.inMessage?.info?.type === 'internal' &&
    t.inMessage.info.dest?.toString() === hubAddress.toString() &&
    t.inMessage.body &&
    t.inMessage.body.beginParse().remainingBits >= 32 &&
    t.inMessage.body.beginParse().loadUint(32) === Number(OP_PUBLISH_BATCH_TO_HUB));
  expect(tx, 'expected a Vault->Hub PublishBatchToHub message').toBeDefined();
  const s = tx.inMessage.body.beginParse();
  s.loadUint(32);   // op
  s.loadUintBig(64); // bounce_id
  s.loadUintBig(160); // bounce_tag
  s.loadUintBig(256); // publish_id
  s.loadUint(8);    // publish_kind
  s.loadUint(8);    // part_count
  return s.loadUintBig(128); // protocol_fee_total
}

// Poke ONLY genesis_config_hash on a live Vault contract (parse current storage, rewrite one field). Used to
// flip a bound+sealed pair into the activity-airdrop discount-unlocked state without disturbing users/keys.
async function pokeVaultGenesisConfigHash(blockchain: Blockchain, vault: any, newHash: bigint) {
  const account = await blockchain.getContract(vault.address);
  const dataCell: Cell = account.account!.account!.storage.state.state!.data!;
  const slice = dataCell.beginParse();
  const initialized = slice.loadBit();
  const data = loadVault$Data(slice);
  const rewritten = beginCell()
    .storeBit(initialized)
    .store(storeVault$Data({ ...data, genesis_config_hash: newHash }))
    .endCell();
  await blockchain.setShardAccount(vault.address, createShardAccount({
    address: vault.address,
    code: account.account!.account!.storage.state.state!.code!,
    data: rewritten,
    balance: account.balance,
    workchain: vault.address.workChain,
  }));
}

// Credits ATH to a user's vault ledger via an AthTransferNotification from the bound official ATH wallet.
async function creditAth(blockchain: Blockchain, vault: any, owner: Address, athWallet: Address, amount: bigint, queryId: bigint) {
  await vault.send(blockchain.sender(athWallet), { value: toNano('0.05') }, {
    $$type: 'AthTransferNotification',
    query_id: queryId,
    amount,
    sender_key: 1n,
    sender_wallet: owner,
  } as AthTransferNotification);
}

// Drives a full-chain batch publish through deployBoundSealedPair and returns its identifiers + the result of
// the originating external send (whose transaction graph contains the Vault->Hub forward AND the Hub->Vault
// ACK, both processed synchronously). The bound-sealed Vault's deployment_manifest_hash is MANIFEST_HASH, which
// is the manifest field BOTH the signing root and the publish_id derivation use (NOT ctx.genesisHash, which is
// the airdrop pin = addressCellHash(deployer)).
async function sendBoundBatch(ctx: any, opts: {
  partsRoot: Cell;
  partCount: bigint;
  kind: bigint;
  maxCharge: bigint;
}) {
  const { blockchain, vault, user } = ctx;
  const nonce = (await vault.getGetUser(user.address)).publish_nonce;
  const body = batchExternalBody({
    vaultAddr: vault.address,
    owner: user.address,
    nonce,
    maxCharge: opts.maxCharge,
    partCount: opts.partCount,
    partsRoot: opts.partsRoot,
    kind: opts.kind,
    genesisHash: MANIFEST_HASH,
  });
  const res = await blockchain.sendMessage(external({ to: vault.address, body }));
  const publishId = computeBatchPublishId({
    owner: user.address, nonce, partsRoot: opts.partsRoot, kind: opts.kind, partCount: opts.partCount,
    genesisHash: MANIFEST_HASH,
  });
  return { nonce, publishId, bounceId: bounceIdOf(publishId), res };
}

describe('Vault milestone 6: Vault-balance batch publish orchestration (VPB2)', () => {
  it('VAULT-M6-01: a signed private batch reaches the Hub, is ACKed, stores the entry, airdrops, and the receipt is CONFIRMED', async () => {
    const ctx = await deployBoundSealedPair();
    const { blockchain, vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));

    const partsRoot = partsList(KIND_PRIVATE, 1);
    const beforeUser = await vault.getGetUser(user.address);
    const { nonce, bounceId } = await sendBoundBatch(ctx, {
      partsRoot, partCount: 1n, kind: KIND_PRIVATE, maxCharge: PRIVATE_MAX_CHARGE,
    });

    // Full chain settled inside the one external: pending cleared, entry stored, ACK confirmed.
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    const cs = await hub.getGetState();
    expect(cs.private_latest_id).toBe(1n);
    expect(cs.private_live_count).toBe(1n);
    const stored = await hub.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);

    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_CAPSULE);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot).toBeDefined();
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect(slot!.nonce).toBe(nonce);
    expect(slot!.part_count).toBe(1n);
  });

  it('VAULT-M6-01A: a messaging signing key (non-auth keypair) cannot authorize a batch — pre-accept 16457', async () => {
    const { blockchain, vault, user } = await setupVault();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    const before = await vault.getGetUser(user.address);

    // Sign with a DIFFERENT keypair than the registered AUTH_KEY_PAIR — the signature check fails pre-accept,
    // the sandbox REJECTS in JS, and the nonce + balance are untouched.
    const wrongKey = (await import('@ton/crypto')).keyPairFromSeed(Buffer.alloc(32, 7));
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce: before.publish_nonce,
      maxCharge: PRIVATE_MAX_CHARGE, partCount: 1n, partsRoot: partsList(KIND_PRIVATE, 1),
      signKey: wrongKey.secretKey,
    });
    await expect(blockchain.sendMessage(external({ to: vault.address, body }))).rejects.toThrow(/16457/);

    const after = await vault.getGetUser(user.address);
    expect(after.publish_nonce).toBe(before.publish_nonce);
    expect(after.ton_balance).toBe(before.ton_balance);
    expect((await vault.getGetUserReceipts(user.address)).receipts.size).toBe(0);
  });

  it('VAULT-M6-01B: a private-batch surcharge above the canonical floor is refunded to the ledger on ACK', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));

    // The maxCharge is far above canonical_total for a 1-part private batch; the Hub returns the over-hold via
    // the mode-128 ACK and the Vault credits it back, so the net debit is only the real cost (< maxCharge).
    const maxCharge = toNano('1.5');
    const beforeUser = await vault.getGetUser(user.address);
    const { bounceId } = await sendBoundBatch(ctx, {
      partsRoot: partsList(KIND_PRIVATE, 1), partCount: 1n, kind: KIND_PRIVATE, maxCharge,
    });
    const afterUser = await vault.getGetUser(user.address);

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
    // Surcharge above the real cost was refunded: the net debit is strictly less than maxCharge.
    const netDebit = beforeUser.ton_balance - afterUser.ton_balance;
    expect(netDebit).toBeGreaterThan(0n);
    expect(netDebit).toBeLessThan(maxCharge);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_CAPSULE);
  });

  it('VAULT-M6-01D: 1-32 KiB private batches all settle — entry stored, airdrop credited, net debit within maxCharge', async () => {
    for (const size of [SIZE_1K, SIZE_2K, SIZE_4K, SIZE_8K, SIZE_16K, SIZE_32K]) {
      const ctx = await deployBoundSealedPair();
      const { vault, hub, user } = ctx;
      await registerHybrid(vault, user);
      await depositTon(vault, user, toNano('3'));

      const maxCharge = toNano('2');
      const partsRoot = partsList(KIND_PRIVATE, 1, size);
      const beforeUser = await vault.getGetUser(user.address);
      const { bounceId } = await sendBoundBatch(ctx, {
        partsRoot, partCount: 1n, kind: KIND_PRIVATE, maxCharge,
      });
      const afterUser = await vault.getGetUser(user.address);

      expect((await vault.getGetGlobal()).pending_publish_count, `size ${size} pending`).toBe(0n);
      expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
      expect((await hub.getGetState()).private_latest_id, `size ${size} latest_id`).toBe(1n);
      expect((await hub.getGetPrivateEntry(0n)).exists, `size ${size} stored`).toBe(true);
      expect(afterUser.ath_balance, `size ${size} airdrop`).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_CAPSULE);
      const netDebit = beforeUser.ton_balance - afterUser.ton_balance;
      expect(netDebit, `size ${size} debit > 0`).toBeGreaterThan(0n);
      expect(netDebit, `size ${size} debit < maxCharge`).toBeLessThan(maxCharge);
    }
  });

  it('VAULT-CAPSULE-PUBLIC-01: a signed public batch stores a public entry, ACKs, and clears pending', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));

    const partsRoot = partsList(KIND_PUBLIC, 1);
    const beforeUser = await vault.getGetUser(user.address);
    const { nonce, bounceId } = await sendBoundBatch(ctx, {
      partsRoot, partCount: 1n, kind: KIND_PUBLIC, maxCharge: PUBLIC_MAX_CHARGE,
    });

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    const cs = await hub.getGetState();
    expect(cs.public_latest_id).toBe(1n);
    expect(cs.private_latest_id).toBe(0n);
    expect(cs.public_live_count).toBe(1n);
    const stored = await hub.getGetPublicEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.author_wallet.toString()).toBe(user.address.toString());

    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_CAPSULE);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.result).toBe(RES_CONFIRMED);
  });

  it('VAULT-CAPSULE-PUBLIC-01C: a signed 32 KiB public batch stores one public entry with the right body hash', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));

    const partsRoot = partsList(KIND_PUBLIC, 1, SIZE_32K);
    const expectedBodyHash = (() => {
      // Reconstruct the body hash the helper used (publicPart fillBase 0 at SIZE_32K).
      const s = partsRoot.beginParse();
      s.loadUint(8); s.loadUint(8); s.loadUint(64); s.loadUintBig(256); // size, reserved, parent_link, header_hash
      return s.loadUintBig(256); // body hash field
    })();

    await sendBoundBatch(ctx, {
      partsRoot, partCount: 1n, kind: KIND_PUBLIC, maxCharge: toNano('2'),
    });

    const stored = await hub.getGetPublicEntry(0n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
    expect(stored.exists).toBe(true);
    expect(stored.body_hash).toBe(expectedBodyHash);
  });

  it('VAULT-CAPSULE-PUBLIC-01D: a real PWA avatar public payload reaches the Hub through a public batch', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));

    const avatarHash = `0x${'21'.repeat(32)}`;
    const streamId = new Uint8Array(16).fill(0x7b);
    const payload = await createPublicPostPayload({
      type: 'avatar',
      bytes: new Uint8Array(26 * 1024).fill(0xa7),
      mediaFormat: PUBLIC_BODY_MEDIA_FORMATS.WEBP,
      streamId,
      partIndex: 0,
      partCount: 1,
      profileVersion: 1,
      avatarHash,
    });
    const headerCell = Cell.fromBoc(Buffer.from(payload.headerBoc, 'base64'))[0];
    const bodyCell = Cell.fromBoc(Buffer.from(payload.bodyBoc, 'base64'))[0];
    const sizeClass = BigInt(payload.size_class);

    // Frame the real crypto-lib header/body cells into a single public batch part (declared hashes match).
    const partsRoot = publicPartCustom({ sizeClass, hCell: headerCell, bodyCell });

    await sendBoundBatch(ctx, {
      partsRoot, partCount: 1n, kind: KIND_PUBLIC, maxCharge: toNano('2'),
    });

    const stored = await hub.getGetPublicEntry(0n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
    expect(stored.exists).toBe(true);
    expect(stored.author_wallet.toString()).toBe(user.address.toString());
    expect(stored.header_hash).toBe(cellHash(headerCell));
    expect(stored.body_hash).toBe(cellHash(bodyCell));
  });

  it('VAULT-CAPSULE-PUBLIC-01B: a public-batch surcharge above canonical is refunded to the ledger on ACK', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));

    const maxCharge = toNano('1.5');
    const beforeUser = await vault.getGetUser(user.address);
    const { bounceId } = await sendBoundBatch(ctx, {
      partsRoot: partsList(KIND_PUBLIC, 1), partCount: 1n, kind: KIND_PUBLIC, maxCharge,
    });
    const afterUser = await vault.getGetUser(user.address);

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetPendingBatchPublish(bounceId)).exists).toBe(false);
    expect((await hub.getGetState()).public_latest_id).toBe(1n);
    const netDebit = beforeUser.ton_balance - afterUser.ton_balance;
    expect(netDebit).toBeGreaterThan(0n);
    expect(netDebit).toBeLessThan(maxCharge);
  });

  it('VAULT-M6-03: a signed private batch debits internal TON and the ACK refunds the over-hold back to the ledger', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));

    const maxCharge = PRIVATE_MAX_CHARGE;
    const before = await vault.getGetUser(user.address);
    const { nonce } = await sendBoundBatch(ctx, {
      partsRoot: partsList(KIND_PRIVATE, 1), partCount: 1n, kind: KIND_PRIVATE, maxCharge,
    });
    const after = await vault.getGetUser(user.address);

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await hub.getGetState()).private_latest_id).toBe(1n);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect(after.ath_balance).toBe(before.ath_balance + AIRDROP_REWARD_PER_CAPSULE);
    // Net debit is the real cost: positive but strictly under the held maxCharge (over-hold refunded on ACK).
    const netDebit = before.ton_balance - after.ton_balance;
    expect(netDebit).toBeGreaterThan(0n);
    expect(netDebit).toBeLessThan(maxCharge);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot!.result).toBe(RES_CONFIRMED);
  });

  it('VAULT-M6-03B: a real PWA-built 2-part document reaches the Hub as a 2-part private batch', async () => {
    const ctx = await deployBoundSealedPair();
    const { vault, hub, user } = ctx;
    const recipient = await ctx.blockchain.treasury('m6-pwa-recipient');
    const senderIdentity = await createMessagingIdentity({ signingSecretKey: new Uint8Array(32).fill(0x92) });
    const recipientIdentity = await createMessagingIdentity({ signingSecretKey: new Uint8Array(32).fill(0x93) });
    // The hybrid key registration must carry the AUTH_KEY_PAIR auth_pubkey (the batch is signed by it); the
    // enc/sign/pq fields come from the real PWA sender identity so the produced capsule cells are authentic.
    await registerHybrid(vault, user, {
      enc_pubkey: BigInt('0x' + Buffer.from(senderIdentity.encryptionKeyPair.x25519PublicKey).toString('hex')),
      sign_pubkey: BigInt('0x' + Buffer.from(senderIdentity.signingPublicKey).toString('hex')),
      pq_kem_pubkey_hash: BigInt('0x' + Buffer.from(senderIdentity.encryptionKeyPair.mlKem768PublicKeyHash).toString('hex')),
    });
    await depositTon(vault, user, toNano('4'));

    const recipientBundle = exportPublicKeyBundle(recipientIdentity.encryptionKeyPair);
    const perPartOverheadBytes = PLATHO_COMPACT_SENDER_RECOVERY_BYTES
      + PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES
      + PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES;
    const documentBytes = new Uint8Array(40_000).fill(0x42);
    const documentParts = splitBytesToCapsuleParts(documentBytes, MAX_CAPSULE_USEFUL_BYTES, { perPartOverheadBytes });
    expect(documentParts).toHaveLength(2);

    const streamId = new Uint8Array(16).fill(0xab);
    const nowMs = 1_700_000_000_000;
    // Build the real per-part header/body cells (PWA crypto lib cells) and keep them so we can frame them into
    // a singly-linked private batch in REVERSE (last part first), giving part[0].next = part[1].
    type RealPart = { sizeClass: bigint; h0: Cell; h1: Cell; body: Cell };
    const realParts: RealPart[] = [];
    for (let index = 0; index < documentParts.length; index += 1) {
      const part = documentParts[index];
      const payloadBytes = encodeCompactPayload({
        type: 'document',
        bytes: part.bytes,
        sizeClass: part.sizeClass,
        streamId,
        partIndex: index,
        partCount: documentParts.length,
        senderWallet: user.address.toRawString(),
        senderVaultKeyId: 1n,
        recipientWallet: recipient.address.toRawString(),
        reservedTailBytes: PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
      });
      const capsule = await createEncryptedPrivateCapsuleFromPublicBundle('', recipientBundle, senderIdentity, {
        payloadBytes,
        sizeClass: part.sizeClass,
        senderRecovery: true,
        now: nowMs,
        createdAt: nowMs,
        expiresAt: nowMs + 60_000,
      });
      const pub = capsule.publish;
      realParts.push({
        sizeClass: BigInt(pub.size_class),
        h0: Cell.fromBoc(Buffer.from(pub.header_0_cell.boc, 'base64'))[0],
        h1: Cell.fromBoc(Buffer.from(pub.header_1_cell.boc, 'base64'))[0],
        body: Cell.fromBoc(Buffer.from(pub.body_cell.boc, 'base64'))[0],
      });
    }
    // Frame REVERSE so the chain link is real: part[1] is the tail, part[0] carries .next = part[1].
    let next: Cell | null = null;
    for (let i = realParts.length - 1; i >= 0; i -= 1) {
      const rp = realParts[i];
      next = privatePartCustom({ sizeClass: rp.sizeClass, h0Cell: rp.h0, h1Cell: rp.h1, bodyCell: rp.body, next });
    }
    const partsRoot = next!;

    await sendBoundBatch(ctx, {
      partsRoot, partCount: 2n, kind: KIND_PRIVATE, maxCharge: toNano('3'),
    });

    const state = await hub.getGetState();
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect(state.private_latest_id).toBe(2n);
    expect(state.private_live_count).toBe(2n);
    expect((await hub.getGetPrivateEntry(0n)).exists).toBe(true);
    expect((await hub.getGetPrivateEntry(1n)).exists).toBe(true);
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(AIRDROP_REWARD_PER_CAPSULE * 2n);
  });

  it('VAULT-M20X-01: discount LOCKED — the full per-part fee is forwarded to the Hub (no activity discount)', async () => {
    const { blockchain, vault, user, capsuleHub } = await setupVault();
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));

    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const partsRoot = partsList(KIND_PRIVATE, 1);
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce,
      maxCharge: PRIVATE_MAX_CHARGE, partCount: 1n, partsRoot, kind: KIND_PRIVATE,
    });
    const res = await blockchain.sendMessage(external({ to: vault.address, body }));

    // setupVault is sealed with genesis_config_hash = GENESIS_HASH (>> 0), so the activity-airdrop discount is
    // LOCKED and discountedFee returns the FULL per-part fee. Observe it in the outgoing protocol_fee_total.
    expect(outgoingProtocolFeeTotal(res, capsuleHub.address)).toBe(PROTOCOL_FEE_TON_BATCH);
  });

  it('VAULT-M20X-02: discount UNLOCKED + held ATH >= threshold — the forwarded per-part fee drops to the min fee', async () => {
    const { blockchain, vault, user, athWallet, capsuleHub } = await setupVaultAirdrop({ airdropRemaining: 0n });
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('2'));
    // Credit the user the full-discount ATH amount so discountedFee returns the floor (PLATO_MIN_PROTOCOL_FEE_TON).
    await creditAth(blockchain, vault, user.address, athWallet.address, ATH_FULL_DISCOUNT_AMOUNT, 9002n);
    expect((await vault.getGetUser(user.address)).ath_balance).toBeGreaterThanOrEqual(ATH_FULL_DISCOUNT_AMOUNT);

    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const partsRoot = partsList(KIND_PRIVATE, 1);
    const body = batchExternalBody({
      vaultAddr: vault.address, owner: user.address, nonce,
      maxCharge: PRIVATE_MAX_CHARGE, partCount: 1n, partsRoot, kind: KIND_PRIVATE,
    });
    const res = await blockchain.sendMessage(external({ to: vault.address, body }));

    // PLATO_MIN_PROTOCOL_FEE_TON == 0 → with the full discount the forwarded fee is the min (0), strictly less
    // than the full PROTOCOL_FEE_TON_BATCH.
    const fee = outgoingProtocolFeeTotal(res, capsuleHub.address);
    expect(fee).toBeLessThan(PROTOCOL_FEE_TON_BATCH);
    expect(fee).toBe(0n);
  });

  it('VAULT-CAPSULE-DUST-01: discount unlocked with near-full ATH yields a 1-nanoTON fee, accrued and then flushed', async () => {
    // Full chain so the Hub actually accrues + can flush the dust fee. Start from the bound-sealed pair, then
    // unlock the discount by poking genesis_config_hash to 0 (which also stops the airdrop crediting).
    const ctx = await deployBoundSealedPair();
    const { blockchain, vault, hub, user, deployer, feeAccumulator } = ctx;
    const officialAthWallet = await deriveBoundAthWallet(ctx);
    await registerHybrid(vault, user);
    await depositTon(vault, user, toNano('3'));
    // Credit one atomic ATH below the full-discount threshold so the per-part fee rounds up to exactly 1 nanoTON.
    await creditAth(blockchain, vault, user.address, officialAthWallet, ATH_FULL_DISCOUNT_AMOUNT - 1n, 9001n);
    await pokeVaultGenesisConfigHash(blockchain, vault, 0n);

    const partsRoot = partsList(KIND_PRIVATE, 1);
    await sendBoundBatch(ctx, {
      partsRoot, partCount: 1n, kind: KIND_PRIVATE, maxCharge: toNano('2'),
    });

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(1n);

    await hub.send(deployer.getSender(), { value: toNano('0.1') }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);

    expect((await hub.getGetState()).accrued_plato_fee_ton).toBe(0n);
    expect((await feeAccumulator.getGetState()).accumulated_ton).toBe(1n);
  });

  // VAULT-M6-01C: removed — getGetCanonicalPublishCharge no longer exists (charge derivation moved into the
  // batch external; the canonical_total is computed internally, not exposed as a getter).
  // VAULT-CAPSULE-PUBLIC-01A: removed — getGetCanonicalPublishCharge no longer exists (see VAULT-M6-01C).
  // VAULT-M6-02: removed — covered by SETTLE-BOUNCE-01 (vault-batch-publish.test.ts).
  // VAULT-M6-04: removed — covered by BATCH-NONCE-01 (vault-batch-publish.test.ts).
  // VAULT-M6-04B: removed — covered by BATCH-NONCE-01 (vault-batch-publish.test.ts).
  // VAULT-CAPSULE-PUBLIC-02: removed — covered by HUB-BATCH-06 (capsulehub-batch-ingest.test.ts).
  // VAULT-CAPSULE-PUBLIC-03: removed — covered by HUB-BATCH-06 (capsulehub-batch-ingest.test.ts).
});

// Derives the official ATH wallet address bound in deployBoundSealedPair (owner = vault, master = deployer).
async function deriveBoundAthWallet(ctx: any): Promise<Address> {
  const { ATHWallet } = await import('../build/ATHWallet/ATHWallet_ATHWallet');
  const { contractAddress } = await import('@ton/core');
  const init = await ATHWallet.init(0n, ctx.vaultAddress, ctx.deployer.address);
  return contractAddress(ctx.vaultAddress.workChain, init);
}
