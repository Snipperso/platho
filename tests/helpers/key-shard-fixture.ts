import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { createShardAccount, type Blockchain } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { KeyShard } from '../../build/KeyShard/KeyShard_KeyShard';


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

export async function registerKeyShard(
  blockchain: Blockchain,
  owner: Address,
  registry: Address,
  fill = 9,
) {
  const init = await KeyShard.init(owner, registry);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: 0n, workchain: 0,
  }));
  const shard = blockchain.openContract(new KeyShard(address, init));
  await shard.send(blockchain.sender(owner), { value: toNano('0.1') }, keyBundle(fill, authKey(fill).pub) as any);
  return shard;
}
