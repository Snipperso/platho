import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { Address, Cell, beginCell, toNano } from '@ton/core';
import { KeyShard, storeKeyShardRegisterKeys } from '../build/KeyShard/KeyShard_KeyShard';
import {
  createMessagingIdentity,
  exportSignedPublicKeyBundle,
  verifySignedPublicKeyBundle,
  createVaultMessagingKeyDraft,
  randomBytes,
} from '../web/crypto/platho-crypto.mjs';
import { buildKeyShardRegisterBrowser } from '../web/key-shard-register-browser.mjs';
import { KEYSHARD_REGISTER_VALUE } from '../web/publish-price.mjs';
import { computeCellHashAndDepth, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// KEY-SHARD-REGISTER — the clean-17 DIRECT-PAY replacement for the Vault RegisterMessagingKeys activation. The user
// sends an INTERNAL KeyShardRegisterKeys (KSG1) from their OWN wallet to their KeyShard; the shard's whole auth is
// sender() == owner_wallet. Silent if wrong: the shard recomputes key_id from the fields, so a mangled body stores a
// bundle a peer's resolve rejects (unscannable / undecryptable). These pin the byte-exact split against the compiled
// storeKeyShardRegisterKeys, prove a live KeyShard ACCEPTS it and get_view reflects the keys, and prove the builder
// FAILS CLOSED on a missing/degenerate auth key (which the contract bricks on, gates 22118/22119).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const OWNER = '0:' + '11'.repeat(32);
const REGISTRY = '0:' + '44'.repeat(32);
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);
const toCoreCell = (c: any) => Cell.fromBase64(Buffer.from(serializeBoc(c)).toString('base64'));

async function validKeyRecord() {
  const identity: any = await createMessagingIdentity();
  const signed = await exportSignedPublicKeyBundle(identity, { ownerWallet: OWNER, vaultAddress: REGISTRY, issuedAt: 1_700_000_000_000 });
  const verified = await verifySignedPublicKeyBundle(signed, { now: 1_700_000_001_000 });
  const authPublicKey = ed25519.getPublicKey(randomBytes(32));   // a DISTINCT auth key (≠ signing key)
  const draft = await createVaultMessagingKeyDraft(verified.bundle, verified.signingPublicKey, { authPublicKey });
  return draft.message;
}

describe('KEY-SHARD-REGISTER', () => {
  it('KSR-BYTES: the browser message body + address are byte-identical to the compiled storeKeyShardRegisterKeys', async () => {
    const keyRecord = await validKeyRecord();
    const built = await buildKeyShardRegisterBrowser({ ownerWallet: OWNER, profileRegistry: REGISTRY, keyRecord, value: toNano('0.1') });

    // Reference body: the compiled Tact serialiser, fed the SAME pq_kem cell so we compare the outer split framing.
    const refMsg = {
      $$type: 'KeyShardRegisterKeys' as const,
      enc_pubkey: BigInt(keyRecord.enc_pubkey),
      sign_pubkey: BigInt(keyRecord.sign_pubkey),
      scan_pubkey: BigInt(keyRecord.scan_pubkey),
      auth_pubkey: BigInt(keyRecord.auth_pubkey),
      pq_kem_pubkey_hash: BigInt(keyRecord.pq_kem_pubkey_hash),
      pq_kem_pubkey_len: BigInt(keyRecord.pq_kem_pubkey_len),
      pq_kem_pubkey: toCoreCell(built.pqKemCell),
      crypto_suite_mask: BigInt(keyRecord.crypto_suite_mask),
    };
    const refBody = beginCell().store(storeKeyShardRegisterKeys(refMsg)).endCell();
    expect(await hashOf(built.body), 'the KSG1 body matches the compiled serialiser byte-for-byte').toEqual(refBody.hash());

    const ref = await KeyShard.fromInit(Address.parse(OWNER), Address.parse(REGISTRY));
    expect(built.to, 'the KeyShard address commits to (owner_wallet, profile_registry)').toBe(ref.address.toRawString());
  }, 120_000);

  it('KSR-SHARD: a browser-built register is ACCEPTED by the real KeyShard and get_view reflects the keys', async () => {
    const bc = await Blockchain.create();
    const owner = await bc.treasury('ksr-owner');
    const registry = await bc.treasury('ksr-registry');
    const keyRecord = await validKeyRecord();

    const built = await buildKeyShardRegisterBrowser({
      ownerWallet: owner.address.toRawString(), profileRegistry: registry.address.toRawString(), keyRecord, value: KEYSHARD_REGISTER_VALUE,
    });
    const dest = Address.parseRaw(built.to);
    const initCore = toCoreCell(built.init);
    const res = await owner.send({
      to: dest, value: built.value, body: toCoreCell(built.body),
      init: { code: initCore.refs[0], data: initCore.refs[1] }, bounce: true,
    } as any);
    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === dest.toString());
    expect(Number(tx?.description?.computePhase?.exitCode), 'the shard accepted the wallet-authorised register').toBe(0);

    const shard = bc.openContract(KeyShard.fromAddress(dest));
    const view = await shard.getGetView();
    expect(view.exists, 'the shard is registered').toBe(true);
    expect(view.owner_wallet.toString(), 'address commits to the owner wallet').toBe(owner.address.toString());
    expect(view.enc_pubkey, 'enc key stored').toBe(BigInt(keyRecord.enc_pubkey));
    expect(view.sign_pubkey, 'sign key stored').toBe(BigInt(keyRecord.sign_pubkey));
    expect(view.scan_pubkey, 'scan key stored (stealth scannability)').toBe(BigInt(keyRecord.scan_pubkey));
    expect(view.key_id, 'key_id computed').not.toBe(0n);
    // PIN the funding figure against the LIVE contract floor: KEYSHARD_REGISTER_VALUE must cover min_register_value.
    expect(BigInt(view.min_register_value) <= KEYSHARD_REGISTER_VALUE, 'the funded value covers the shard register floor').toBe(true);
  }, 240_000);

  it('KSR-AUTH-GUARD: the builder REFUSES a missing/zero/degenerate auth key (the contract would brick, gates 22118/22119)', async () => {
    const keyRecord = await validKeyRecord();
    // auth == sign → gate 22119.
    await expect(buildKeyShardRegisterBrowser({
      ownerWallet: OWNER, profileRegistry: REGISTRY, value: toNano('0.1'),
      keyRecord: { ...keyRecord, auth_pubkey: BigInt(keyRecord.sign_pubkey) },
    })).rejects.toThrow(/distinct auth key|22119/i);
    // auth absent → gate 22118.
    const noAuth: any = { ...keyRecord };
    delete noAuth.auth_pubkey;
    await expect(buildKeyShardRegisterBrowser({ ownerWallet: OWNER, profileRegistry: REGISTRY, keyRecord: noAuth, value: toNano('0.1') }))
      .rejects.toThrow(/non-zero auth key|22118|brick/i);
  }, 60_000);
});
