import { describe, expect, it } from 'vitest';
import { Cell, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  Vault,
  RegisterMessagingKeys,
} from '../build/Vault/Vault_Vault';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const OP_REPLACE_MESSAGING_KEYS = 0x89D648BBn;
const VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN = 0x56524B31n;
const AUTH_KEY_PAIR = keyPairFromSeed(Buffer.alloc(32, 0x66));

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('vault-key-user');
  const athWallet = await blockchain.treasury('vault-ath-wallet');
  const attacker = await blockchain.treasury('vault-key-attacker');

  const capsuleHub = await blockchain.treasury('capsule-hub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('1'),
      workchain: address.workChain,
    }),
  );

  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user, attacker };
}

const ENC_0 = 0x1000000000000000000000000000000000000000000000000000000000000001n;
const SIG_0 = 0x2000000000000000000000000000000000000000000000000000000000000002n;
const ENC_1 = 0x3000000000000000000000000000000000000000000000000000000000000003n;
const SIG_1 = 0x4000000000000000000000000000000000000000000000000000000000000004n;
const AUTH_0 = BigInt('0x' + AUTH_KEY_PAIR.publicKey.toString('hex'));
const PQ_HASH = 0x5000000000000000000000000000000000000000000000000000000000000005n;

function snakeCell(byteLength: number, fill = 0x5a): Cell {
  let tail: Cell | null = null;
  for (let offset = byteLength; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(Buffer.alloc(offset - start, fill));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

const PQ_CELL = snakeCell(1184);

async function registerHybrid(vault: any, user: any, value = toNano('0.1')) {
  await vault.send(user.getSender(), { value }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: ENC_0,
    sign_pubkey: SIG_0,
    auth_pubkey: AUTH_0,
    pq_kem_pubkey_hash: PQ_HASH,
    pq_kem_pubkey_len: 1184n,
    pq_kem_pubkey: PQ_CELL,
    crypto_suite_mask: 2n,
  } as RegisterMessagingKeys);
}

function addressHash(address: any): bigint {
  return BigInt('0x' + address.hash.toString('hex'));
}

function replaceMessagingKeysExternalBody(vault: any, owner: any, nonce: bigint, fields: any = {}) {
  const payload = beginCell()
    .storeUint(fields.enc_pubkey ?? ENC_1, 256)
    .storeUint(fields.sign_pubkey ?? SIG_1, 256)
    .storeUint(fields.pq_kem_pubkey_hash ?? PQ_HASH, 256)
    .storeUint(fields.pq_kem_pubkey_len ?? 1184n, 16)
    .storeRef(fields.pq_kem_pubkey ?? PQ_CELL)
    .storeUint(fields.crypto_suite_mask ?? 2n, 16)
    .endCell();
  const signedPayload = beginCell()
    .storeUint(VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN, 32)
    .storeUint(GENESIS_HASH, 256)
    .storeUint(addressHash(vault.address), 256)
    .storeUint(addressHash(owner.address), 256)
    .storeUint(nonce, 64)
    .storeRef(payload)
    .endCell();
  return beginCell()
    .storeUint(OP_REPLACE_MESSAGING_KEYS, 32)
    .storeAddress(owner.address)
    .storeBuffer(sign(signedPayload.hash(), AUTH_KEY_PAIR.secretKey))
    .storeRef(signedPayload)
    .endCell();
}

async function replaceHybrid(blockchain: Blockchain, vault: any, user: any, fields: any = {}) {
  const userState = await vault.getGetUser(user.address);
  await blockchain.sendMessage(external({
    to: vault.address,
    body: replaceMessagingKeysExternalBody(vault, user, userState.publish_nonce, fields),
  }));
}

async function depositTon(vault: any, user: any, amount = toNano('0.1')) {
  await vault.send(user.getSender(), { value: amount + 2_000_000n }, {
    $$type: 'DepositTon',
    amount,
  } as any);
}

describe('Vault milestone 2: KeyRecord + key_generation lifecycle', () => {
  it('VAULT-HAPPY-06: first key registration creates UserState and key_generation 0 record', async () => {
    const { vault, user } = await setup();

    await registerHybrid(vault, user);

    const userState = await vault.getGetUser(user.address);
    expect(userState.exists).toBe(true);
    expect(userState.current_key_id).not.toBe(0n);
    expect(userState.auth_pubkey).toBe(AUTH_0);
    expect((await vault.getGetGlobal()).user_count).toBe(1n);
    expect((await vault.getGetGlobal()).key_record_count).toBe(1n);

    const record = await vault.getGetKeyRecord(userState.current_key_id);
    expect(record.exists).toBe(true);
    expect(record.owner_wallet.toString()).toBe(user.address.toString());
    expect(record.key_generation).toBe(0n);
    expect(record.enc_pubkey).toBe(ENC_0);
    expect(record.sign_pubkey).toBe(SIG_0);
    expect(record.crypto_suite_mask).toBe(2n);
    expect(record.pq_kem_pubkey_hash).toBe(PQ_HASH);
    expect(record.pq_kem_pubkey_len).toBe(1184n);
    expect(record.pq_kem_pubkey.hash().toString('hex')).toBe(PQ_CELL.hash().toString('hex'));
    expect(record.revoked_lt).toBe(0n);
  });

  it('VAULT-REJECT: Vault auth key must be separate from messaging signing key', async () => {
    const { vault, user } = await setup();

    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'RegisterMessagingKeys',
      enc_pubkey: ENC_0,
      sign_pubkey: SIG_0,
      auth_pubkey: SIG_0,
      pq_kem_pubkey_hash: PQ_HASH,
      pq_kem_pubkey_len: 1184n,
      pq_kem_pubkey: PQ_CELL,
      crypto_suite_mask: 2n,
    } as RegisterMessagingKeys);

    expect((await vault.getGetUser(user.address)).exists).toBe(false);
    expect((await vault.getGetGlobal()).key_record_count).toBe(0n);
  });

  it('VAULT-HAPPY-07: key replacement revokes previous key and creates generation 1', async () => {
    const { blockchain, vault, user } = await setup();

    await registerHybrid(vault, user);
    await depositTon(vault, user);
    const oldKeyId = (await vault.getGetUser(user.address)).current_key_id;
    const oldRecordBefore = await vault.getGetKeyRecord(oldKeyId);

    await replaceHybrid(blockchain, vault, user);

    const userState = await vault.getGetUser(user.address);
    const newKeyId = userState.current_key_id;
    expect(newKeyId).not.toBe(oldKeyId);
    expect(userState.auth_pubkey).toBe(AUTH_0);

    const oldRecord = await vault.getGetKeyRecord(oldKeyId);
    const newRecord = await vault.getGetKeyRecord(newKeyId);

    expect(oldRecord.exists).toBe(true);
    expect(oldRecord.key_generation).toBe(0n);
    expect(oldRecord.revoked_lt).toBeGreaterThan(0n);
    expect(oldRecord.revoked_at).toBeGreaterThan(0n);
    expect(oldRecord.created_lt).toBe(oldRecordBefore.created_lt);

    expect(newRecord.exists).toBe(true);
    expect(newRecord.key_generation).toBe(1n);
    expect(newRecord.enc_pubkey).toBe(ENC_1);
    expect(newRecord.sign_pubkey).toBe(SIG_1);
    expect(newRecord.crypto_suite_mask).toBe(2n);
    expect(newRecord.pq_kem_pubkey_hash).toBe(PQ_HASH);
    expect(newRecord.pq_kem_pubkey_len).toBe(1184n);
    expect(newRecord.pq_kem_pubkey.hash().toString('hex')).toBe(PQ_CELL.hash().toString('hex'));
    expect(newRecord.revoked_lt).toBe(0n);
    expect(userState.ton_balance).toBe(toNano('0.1') - 32_000_000n);
    expect(userState.publish_nonce).toBe(1n);
    expect((await vault.getGetGlobal()).key_record_count).toBe(2n);
  });

  it('VAULT-REJECT: cannot register twice and cannot replace before registration', async () => {
    const { blockchain, vault, user, attacker } = await setup();

    await expect(replaceHybrid(blockchain, vault, attacker)).rejects.toThrow(/External message not accepted|exit code 16120/i);
    expect((await vault.getGetUser(attacker.address)).exists).toBe(false);

    await registerHybrid(vault, user);
    const firstKeyId = (await vault.getGetUser(user.address)).current_key_id;
    await registerHybrid(vault, user);
    expect((await vault.getGetUser(user.address)).current_key_id).toBe(firstKeyId);
    expect((await vault.getGetGlobal()).key_record_count).toBe(1n);
  });

  it('VAULT-REJECT: invalid suite/key profile is rejected without mutating current key', async () => {
    const { blockchain, vault, user } = await setup();

    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'RegisterMessagingKeys',
      enc_pubkey: ENC_0,
      sign_pubkey: SIG_0,
      auth_pubkey: AUTH_0,
      pq_kem_pubkey_hash: PQ_HASH,
      pq_kem_pubkey_len: 1184n,
      pq_kem_pubkey: PQ_CELL,
      crypto_suite_mask: 1n,
    } as RegisterMessagingKeys);
    expect((await vault.getGetUser(user.address)).exists).toBe(false);

    await registerHybrid(vault, user);
    await depositTon(vault, user);
    const keyId = (await vault.getGetUser(user.address)).current_key_id;

    await replaceHybrid(blockchain, vault, user, {
      enc_pubkey: ENC_1,
      sign_pubkey: SIG_1,
      pq_kem_pubkey_hash: 0n,
      pq_kem_pubkey_len: 0n,
      pq_kem_pubkey: beginCell().endCell(),
      crypto_suite_mask: 2n,
    });

    expect((await vault.getGetUser(user.address)).current_key_id).toBe(keyId);
    expect((await vault.getGetGlobal()).key_record_count).toBe(1n);

    await replaceHybrid(blockchain, vault, user, {
      enc_pubkey: ENC_1,
      sign_pubkey: SIG_1,
      pq_kem_pubkey_hash: PQ_HASH,
      pq_kem_pubkey_len: 1184n,
      pq_kem_pubkey: beginCell().storeBuffer(Buffer.alloc(32, 0x99)).endCell(),
      crypto_suite_mask: 2n,
    });

    expect((await vault.getGetUser(user.address)).current_key_id).toBe(keyId);
    expect((await vault.getGetGlobal()).key_record_count).toBe(1n);
  });
});
