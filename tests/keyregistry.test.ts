import { describe, expect, it, beforeEach } from 'vitest';
import { Address, beginCell, external, toNano, Cell } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import '@ton/test-utils';
import { KeyRegistry } from '../build/KeyRegistry/KeyRegistry_KeyRegistry';
import { HYBRID_PQ_HASH, HYBRID_PQ_LEN, HYBRID_CRYPTO_SUITE_MASK, HYBRID_PQ_CELL, snakeCell } from './helpers/vault-hybrid-key';

const MANIFEST_HASH = 0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789n;
const CONFIG_HASH = 0n;
const KEYREG_REPLACE_KEYS_SIGNING_DOMAIN = 0x4b524b31n;
const OP_KEYREG_REPLACE = 0x4B524732n;
const REGISTER_VALUE = 60_000_000n;

function addrHash(a: Address): bigint {
  return BigInt('0x' + a.hash.toString('hex'));
}

// Compute-phase exit code of the internal message delivered to `dest` (repo pattern; toHaveTransaction is not
// wired into this vitest setup).
function codeOf(res: any, dest: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage?.info?.dest?.toString() === dest.toString(),
  );
  return Number(tx?.description?.computePhase?.exitCode ?? -1);
}

async function deployKeyRegistry(blockchain: Blockchain, controller: TreasuryContract, sealed = false) {
  const keyReg = blockchain.openContract(
    await KeyRegistry.fromInit(controller.address, MANIFEST_HASH, CONFIG_HASH, sealed),
  );
  await keyReg.send(controller.getSender(), { value: toNano('1') }, null);
  return keyReg;
}

async function sealKeyRegistry(keyReg: SandboxContract<KeyRegistry>, controller: TreasuryContract) {
  return keyReg.send(controller.getSender(), { value: toNano('0.1') }, {
    $$type: 'KeyRegSealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  });
}

interface Identity {
  encPubkey: bigint;
  signPubkey: bigint;
  scanPubkey: bigint;
  authKeyPair: { publicKey: Buffer; secretKey: Buffer };
}

function makeIdentity(seed: number, encOverride?: bigint, signOverride?: bigint, scanOverride?: bigint): Identity {
  const enc = keyPairFromSeed(Buffer.alloc(32, seed));
  const sig = keyPairFromSeed(Buffer.alloc(32, seed + 1));
  const scan = keyPairFromSeed(Buffer.alloc(32, seed + 2));
  const auth = keyPairFromSeed(Buffer.alloc(32, seed + 3));
  return {
    encPubkey: encOverride ?? BigInt('0x' + enc.publicKey.toString('hex')),
    signPubkey: signOverride ?? BigInt('0x' + sig.publicKey.toString('hex')),
    scanPubkey: scanOverride ?? BigInt('0x' + scan.publicKey.toString('hex')),
    authKeyPair: auth,
  };
}

function registerMessage(id: Identity, authPubkeyOverride?: bigint) {
  return {
    $$type: 'KeyRegRegisterMessagingKeys' as const,
    enc_pubkey: id.encPubkey,
    sign_pubkey: id.signPubkey,
    scan_pubkey: id.scanPubkey,
    auth_pubkey: authPubkeyOverride ?? BigInt('0x' + id.authKeyPair.publicKey.toString('hex')),
    pq_kem_pubkey_hash: HYBRID_PQ_HASH,
    pq_kem_pubkey_len: HYBRID_PQ_LEN,
    pq_kem_pubkey: HYBRID_PQ_CELL,
    crypto_suite_mask: HYBRID_CRYPTO_SUITE_MASK,
  };
}

async function register(keyReg: SandboxContract<KeyRegistry>, user: TreasuryContract, id: Identity, value = REGISTER_VALUE) {
  return keyReg.send(user.getSender(), { value }, registerMessage(id));
}

function buildRotationExternal(
  keyReg: SandboxContract<KeyRegistry>,
  owner: Address,
  rotationNonce: bigint,
  authSecretKey: Buffer,
  next: Identity,
  pqCell: Cell = HYBRID_PQ_CELL,
  domain = KEYREG_REPLACE_KEYS_SIGNING_DOMAIN,
) {
  const actionPayload = beginCell()
    .storeUint(next.encPubkey, 256)
    .storeUint(next.signPubkey, 256)
    .storeUint(next.scanPubkey, 256)
    .storeUint(HYBRID_PQ_LEN, 16)
    .storeUint(HYBRID_CRYPTO_SUITE_MASK, 16)
    .storeRef(pqCell)
    .storeRef(beginCell().storeUint(HYBRID_PQ_HASH, 256).endCell())
    .endCell();

  const signedPayload = beginCell()
    .storeUint(domain, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeUint(addrHash(keyReg.address), 256)
    .storeUint(addrHash(owner), 256)
    .storeUint(rotationNonce, 64)
    .storeRef(actionPayload)
    .endCell();

  return beginCell()
    .storeUint(OP_KEYREG_REPLACE, 32)
    .storeAddress(owner)
    .storeBuffer(sign(signedPayload.hash(), authSecretKey))
    .storeRef(signedPayload)
    .endCell();
}

describe('KeyRegistry — clean-16 Durable-Core (B1)', () => {
  let blockchain: Blockchain;
  let controller: TreasuryContract;
  let alice: TreasuryContract;
  let bob: TreasuryContract;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    controller = await blockchain.treasury('controller');
    alice = await blockchain.treasury('alice');
    bob = await blockchain.treasury('bob');
  });

  describe('KEYREG-LIFECYCLE', () => {
    it('starts unsealed; register is rejected before seal (requireSealed)', async () => {
      const keyReg = await deployKeyRegistry(blockchain, controller);
      expect((await keyReg.getGetGlobal()).sealed).toBe(false);
      const res = await register(keyReg, alice, makeIdentity(10));
      expect(codeOf(res, keyReg.address)).toBe(20100);
      expect((await keyReg.getGetAccount(alice.address)).exists).toBe(false);
    });

    it('only the genesis controller can seal', async () => {
      const keyReg = await deployKeyRegistry(blockchain, controller);
      const bad = await keyReg.send(alice.getSender(), { value: toNano('0.1') }, {
        $$type: 'KeyRegSealGenesis',
        deployment_manifest_hash: MANIFEST_HASH,
      });
      expect(codeOf(bad, keyReg.address)).toBe(20033);
      expect((await keyReg.getGetGlobal()).sealed).toBe(false);
    });

    it('seal requires the matching manifest hash and is one-shot', async () => {
      const keyReg = await deployKeyRegistry(blockchain, controller);
      const wrong = await keyReg.send(controller.getSender(), { value: toNano('0.1') }, {
        $$type: 'KeyRegSealGenesis',
        deployment_manifest_hash: MANIFEST_HASH + 1n,
      });
      expect(codeOf(wrong, keyReg.address)).toBe(20041);

      await sealKeyRegistry(keyReg, controller);
      expect((await keyReg.getGetGlobal()).sealed).toBe(true);

      const again = await sealKeyRegistry(keyReg, controller);
      expect(codeOf(again, keyReg.address)).toBe(20000);
    });
  });

  describe('KEYREG-REGISTER', () => {
    let keyReg: SandboxContract<KeyRegistry>;
    beforeEach(async () => {
      keyReg = await deployKeyRegistry(blockchain, controller);
      await sealKeyRegistry(keyReg, controller);
    });

    it('registers a first identity (sender-auth) and resolves it', async () => {
      const id = makeIdentity(20);
      const res = await register(keyReg, alice, id);
      expect(codeOf(res, keyReg.address)).toBe(0);

      const account = await keyReg.getGetAccount(alice.address);
      expect(account.exists).toBe(true);
      expect(account.key_generation).toBe(0n);
      expect(account.rotation_nonce).toBe(0n);
      expect(account.current_key_id).not.toBe(0n);

      const rec = await keyReg.getGetCurrentKeyRecord(alice.address);
      expect(rec.exists).toBe(true);
      expect(rec.enc_pubkey).toBe(id.encPubkey);
      expect(rec.sign_pubkey).toBe(id.signPubkey);
      expect(rec.scan_pubkey).toBe(id.scanPubkey);
      expect(rec.pq_kem_pubkey_len).toBe(HYBRID_PQ_LEN);
      expect(rec.revoked_lt).toBe(0n);
      expect((await keyReg.getGetGlobal()).account_count).toBe(1n);
      expect((await keyReg.getGetGlobal()).key_record_count).toBe(1n);
    });

    it('rejects auth_pubkey == 0, auth_pubkey == sign_pubkey, and zero scan_pubkey', async () => {
      const id = makeIdentity(21);
      // auth == sign
      const r1 = await keyReg.send(alice.getSender(), { value: REGISTER_VALUE }, registerMessage(id, id.signPubkey));
      expect(codeOf(r1, keyReg.address)).toBe(20119);
      // auth == 0
      const r2 = await keyReg.send(bob.getSender(), { value: REGISTER_VALUE }, registerMessage(makeIdentity(22), 0n));
      expect(codeOf(r2, keyReg.address)).toBe(20118);
      // scan == 0
      const r3 = await keyReg.send(bob.getSender(), { value: REGISTER_VALUE }, registerMessage(makeIdentity(23, undefined, undefined, 0n)));
      expect(codeOf(r3, keyReg.address)).toBe(20103);
    });

    it('rejects a double registration for the same wallet', async () => {
      await register(keyReg, alice, makeIdentity(24));
      const dup = await register(keyReg, alice, makeIdentity(25));
      expect(codeOf(dup, keyReg.address)).toBe(20111);
    });

    it('rejects an underfunded registration (below endowment)', async () => {
      const res = await register(keyReg, alice, makeIdentity(26), 10_000_000n);
      expect(codeOf(res, keyReg.address)).toBe(20110);
      expect((await keyReg.getGetAccount(alice.address)).exists).toBe(false);
    });
  });

  describe('KEYREG-ROTATE', () => {
    let keyReg: SandboxContract<KeyRegistry>;
    let id0: Identity;
    beforeEach(async () => {
      keyReg = await deployKeyRegistry(blockchain, controller);
      await sealKeyRegistry(keyReg, controller);
      id0 = makeIdentity(30);
      await register(keyReg, alice, id0);
    });

    it('rotates keys: old record deleted, new generation resolves, nonce advances', async () => {
      const before = await keyReg.getGetAccount(alice.address);
      const oldKeyId = before.current_key_id;
      const id1 = makeIdentity(40);

      await blockchain.sendMessage(external({
        to: keyReg.address,
        body: buildRotationExternal(keyReg, alice.address, 0n, id0.authKeyPair.secretKey, id1),
      }));

      const after = await keyReg.getGetAccount(alice.address);
      expect(after.key_generation).toBe(1n);
      expect(after.rotation_nonce).toBe(1n);
      expect(after.current_key_id).not.toBe(oldKeyId);

      // old record deleted
      expect((await keyReg.getGetKeyRecord(oldKeyId)).exists).toBe(false);
      // new record resolves with the rotated keys
      const rec = await keyReg.getGetCurrentKeyRecord(alice.address);
      expect(rec.exists).toBe(true);
      expect(rec.enc_pubkey).toBe(id1.encPubkey);
      expect(rec.scan_pubkey).toBe(id1.scanPubkey);
      expect(rec.key_generation).toBe(1n);
      // exactly one live record per account
      expect((await keyReg.getGetGlobal()).key_record_count).toBe(1n);
    });

    it('rejects a rotation signed by the wrong key', async () => {
      const wrong = makeIdentity(41).authKeyPair;
      // A rejected external (checkSignature fails pre-accept) is never accepted -> sandbox throws.
      await expect(blockchain.sendMessage(external({
        to: keyReg.address,
        body: buildRotationExternal(keyReg, alice.address, 0n, wrong.secretKey, makeIdentity(42)),
      }))).rejects.toThrow();
      expect((await keyReg.getGetAccount(alice.address)).key_generation).toBe(0n);
    });

    it('rejects a replayed rotation (stale nonce)', async () => {
      const id1 = makeIdentity(43);
      await blockchain.sendMessage(external({
        to: keyReg.address,
        body: buildRotationExternal(keyReg, alice.address, 0n, id0.authKeyPair.secretKey, id1),
      }));
      // resend with nonce 0 again -> stale
      await expect(blockchain.sendMessage(external({
        to: keyReg.address,
        body: buildRotationExternal(keyReg, alice.address, 0n, id0.authKeyPair.secretKey, makeIdentity(44)),
      }))).rejects.toThrow();
      expect((await keyReg.getGetAccount(alice.address)).key_generation).toBe(1n);
    });

    it('rejects rotation with a wrong signing domain', async () => {
      await expect(blockchain.sendMessage(external({
        to: keyReg.address,
        body: buildRotationExternal(keyReg, alice.address, 0n, id0.authKeyPair.secretKey, makeIdentity(45), HYBRID_PQ_CELL, 0xDEADBEEFn),
      }))).rejects.toThrow();
    });
  });

  describe('KEYREG-RESOLVE (privacy invariant)', () => {
    it('never exposes auth_pubkey in any getter view', async () => {
      const keyReg = await deployKeyRegistry(blockchain, controller);
      await sealKeyRegistry(keyReg, controller);
      await register(keyReg, alice, makeIdentity(50));

      const account = await keyReg.getGetAccount(alice.address);
      const record = await keyReg.getGetCurrentKeyRecord(alice.address);
      expect('auth_pubkey' in account).toBe(false);
      expect('auth_pubkey' in record).toBe(false);
    });
  });
});
