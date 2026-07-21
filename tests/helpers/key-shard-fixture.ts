import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { createShardAccount, type Blockchain } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { KeyShard } from '../../build/KeyShard/KeyShard_KeyShard';

// Shared KeyShard fixtures. This lives in one place on purpose: an avatar purchase is refused at gate 22202
// unless the buyer's shard is REGISTERED, so every avatar test now depends on producing a valid key bundle. Three
// private copies of the ML-KEM snake builder would be three chances for one of them to drift into a shape the
// contract rejects for a reason unrelated to what the test is actually asserting.

/** The ML-KEM-768 public key as the contract requires it: a 41-byte head then 127-byte links, 10 cells, 9472 bits. */
export function mlkemSnake(fill: number): Cell {
  const buf = Buffer.alloc(1184, fill);
  const chunks: Buffer[] = [buf.subarray(0, 41)];
  for (let offset = 41; offset < buf.length; offset += 127) {
    chunks.push(buf.subarray(offset, Math.min(offset + 127, buf.length)));
  }
  let cursor = beginCell().storeBuffer(chunks[chunks.length - 1]);
  for (let i = chunks.length - 2; i >= 0; i--) cursor = beginCell().storeBuffer(chunks[i]).storeRef(cursor.endCell());
  return cursor.endCell();
}

export function authKey(fill: number) {
  const secret = new Uint8Array(32).fill(fill);
  const pub = ed25519.getPublicKey(secret);
  return { secret, pub: BigInt('0x' + Buffer.from(pub).toString('hex')) };
}

export function keyBundle(fill: number, authPub: bigint) {
  return {
    $$type: 'KeyShardRegisterKeys' as const,
    enc_pubkey: BigInt(fill) * 0x1111n + 1n,
    sign_pubkey: BigInt(fill) * 0x2222n + 2n,
    scan_pubkey: BigInt(fill) * 0x3333n + 3n,
    auth_pubkey: authPub,
    pq_kem_pubkey_hash: BigInt(fill) * 0x4444n + 4n,
    pq_kem_pubkey_len: 1184n,
    pq_kem_pubkey: mlkemSnake(fill),
    crypto_suite_mask: 2n,
  };
}

/**
 * A registered KeyShard for `owner`, against `registry`.
 *
 * The registry address is the shard's SECOND init argument, so it is part of the address: pass the wrong one and
 * the shard is deployed somewhere the registry will never write to and no client will ever read. Registration is
 * authorised by sender() == owner_wallet, which is why this sends as the owner itself rather than from a funder.
 */
export async function registerKeyShard(
  blockchain: Blockchain,
  owner: Address,
  registry: Address,
  fill = 9,
) {
  // The account is placed FIRST, at zero balance, rather than relying on the wrapper to attach StateInit. A
  // message from blockchain.sender() carries no init, and a message to an uninitialised account runs with its
  // COMPUTE PHASE SKIPPED — no error, no bounce, and the registration silently does not happen. Zero balance
  // keeps the endowment arithmetic honest: everything the account holds afterwards came from the register message.
  const init = await KeyShard.init(owner, registry);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: 0n, workchain: 0,
  }));
  const shard = blockchain.openContract(new KeyShard(address, init));
  await shard.send(blockchain.sender(owner), { value: toNano('0.1') }, keyBundle(fill, authKey(fill).pub) as any);
  return shard;
}
