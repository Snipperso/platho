import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { readFileSync } from 'node:fs';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';


const CLOCK = 1_790_000_000;
const SIGN_DOMAIN = 0x4b534b31;
const REGISTRY = Address.parse('EQDG8kf4ikGQRyTZcZ2POIWEqwqAaZWbi9Y6qPp3EXTa_Pq7');
const BASE_ENDOWMENT = 45_000_000n;

const mlkemSnake = (fill: number): Cell => {
  const buf = Buffer.alloc(1184, fill);
  const chunks: Buffer[] = [buf.subarray(0, 41)];
  for (let o = 41; o < 1184; o += 127) chunks.push(buf.subarray(o, Math.min(o + 127, 1184)));
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  return cell;
};

const oversizedSnake = (fill: number): Cell => {
  const buf = Buffer.alloc(1184, fill);
  const chunks: Buffer[] = [buf.subarray(0, 41)];
  for (let o = 41; o < 1184 - 127; o += 127) chunks.push(buf.subarray(o, o + 127));
  chunks.push(buf.subarray(1184 - 127, 1184 - 63));
  chunks.push(buf.subarray(1184 - 63, 1184));
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  return cell;
};

const bundle = (fill: number, authPub: bigint) => ({
  $$type: 'KeyShardRegisterKeys' as const,
  enc_pubkey: BigInt(0x1000 + fill),
  sign_pubkey: BigInt(0x2000 + fill),
  scan_pubkey: BigInt(0x3000 + fill),
  auth_pubkey: authPub,
  pq_kem_pubkey_hash: BigInt(0x4000 + fill),
  pq_kem_pubkey_len: 1184n,
  pq_kem_pubkey: mlkemSnake(fill),
  crypto_suite_mask: 2n,
});

const authKey = (fill: number) => {
  const secret = new Uint8Array(32).fill(fill);
  return { secret, pub: BigInt('0x' + Buffer.from(ed25519.getPublicKey(secret)).toString('hex')) };
};

function rotation(shardAddr: Address, auth: { secret: Uint8Array }, snake: Cell, nonce: bigint, fill = 0xAA) {
  const action = beginCell()
    .storeUint(BigInt(0x1000 + fill), 256).storeUint(BigInt(0x2000 + fill), 256).storeUint(BigInt(0x3000 + fill), 256)
    .storeUint(1184n, 16).storeUint(2n, 16)
    .storeRef(snake)
    .storeRef(beginCell().storeUint(BigInt(0x4000 + fill), 256).endCell())
    .endCell();
  const signed = beginCell().storeUint(SIGN_DOMAIN, 32)
    .storeUint(BigInt('0x' + shardAddr.hash.toString('hex')), 256)
    .storeUint(nonce, 64).storeRef(action).endCell();
  return {
    $$type: 'KeyShardReplaceKeys',
    signature: Buffer.from(ed25519.sign(new Uint8Array(signed.hash()), auth.secret)),
    signed_payload: signed,
    envelope_padding: beginCell().endCell().beginParse(),
  } as any;
}

const balanceOf = async (bc: Blockchain, addr: Address) => (await bc.getContract(addr)).balance;

async function starve(bc: Blockchain, addr: Address, balance: bigint) {
  const live = await bc.getContract(addr);
  const st: any = live.accountState;
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: st.state.code, data: st.state.data, balance, workchain: 0,
  }));
}

describe('KEY-SHARD ROTATION SAFETY — a throw after commit() must be unreachable', () => {
  it('KS-COMMIT-00: the pre-accept balance floor exists in the CONTRACT and is published to clients', () => {
    const src = readFileSync('contracts/KeyShard.tact', 'utf8');
    const m = /const KS_ROTATION_MIN_BALANCE: Int = (\d+);/.exec(src);
    expect(m, 'the floor must exist under this name').not.toBeNull();
    expect(BigInt(m![1]), 'and be a real multiple of the accepted path, not a token value').toBeGreaterThan(5_000_000n);
    const idx = src.indexOf('throwUnless(22138');
    const accept = src.indexOf('acceptMessage();', src.indexOf('external(msg: KeyShardReplaceKeys)'));
    expect(idx, 'the floor gate must be present').toBeGreaterThan(0);
    expect(idx, 'and must come BEFORE acceptMessage').toBeLessThan(accept);
    const bodyStart = src.indexOf('fun isValidPqPubkeyCell');
    expect(bodyStart, 'the function this gate names must exist').toBeGreaterThan(-1);
    const rest = src.slice(bodyStart + 1);
    const nextFun = rest.search(/^\s{4}fun /m);
    const pqBody = nextFun >= 0 ? src.slice(bodyStart, bodyStart + 1 + nextFun) : src.slice(bodyStart);
    expect(pqBody.length, 'and the slice must be that function, not a fixed distance into it')
      .toBeGreaterThan(600);
    expect(pqBody.length).toBeLessThan(4000);
    expect(pqBody, 'the deleted CDATASIZE must not come back into the Bool path')
      .not.toContain('computeDataSize');
  });

  it('KS-COMMIT-01: an oversized ML-KEM tree is REFUSED silently — no throw, and the nonce really burns', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = await bc.treasury('ks-cmt-owner');
    const auth = authKey(0x71);
    const shard = bc.openContract(await KeyShard.fromInit(owner.address, REGISTRY));
    await shard.send(owner.getSender(), { value: toNano('0.1') }, bundle(21, auth.pub) as any);
    const before = await balanceOf(bc, shard.address);

    const ext = rotation(shard.address, auth, oversizedSnake(0xAA), 0n);
    await shard.sendExternal(ext);

    const view = await shard.getGetView();
    expect(view.key_generation, 'a malformed key must not rotate anything').toBe(0n);
    expect(view.rotation_nonce, 'but the nonce MUST burn, or the payload stays replayable').toBe(1n);

    await expect(shard.sendExternal(ext), 'a replay must be refused by the nonce').rejects.toThrow();
    expect(await balanceOf(bc, shard.address), 'and one attempt cost one attempt, not the endowment')
      .toBeGreaterThan(before - 10_000_000n);
  });

  it('KS-COMMIT-02: a starved shard REFUSES the rotation before accepting it, instead of burning its remainder', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = await bc.treasury('ks-starve-owner');
    const auth = authKey(0x72);
    const shard = bc.openContract(await KeyShard.fromInit(owner.address, REGISTRY));
    await shard.send(owner.getSender(), { value: toNano('0.1') }, bundle(22, auth.pub) as any);

    await starve(bc, shard.address, 5_000_000n);
    const ext = rotation(shard.address, auth, mlkemSnake(0xBB), 0n);
    await expect(shard.sendExternal(ext), 'too poor to finish the work, so it must not start it').rejects.toThrow();
    expect(await balanceOf(bc, shard.address), 'and the remainder is untouched').toBe(5_000_000n);
    expect((await shard.getGetView()).rotation_nonce, 'nothing happened at all').toBe(0n);

    await owner.send({ to: shard.address, value: toNano('0.1'), bounce: false });
    await shard.sendExternal(ext);
    const view = await shard.getGetView();
    expect(view.key_generation, 'the honest rotation lands once the shard can pay for it').toBe(1n);
    expect(view.rotation_nonce).toBe(1n);
  });

  it('KS-ENDOW-01: re-registering a DEPLETED shard refills it instead of handing the money straight back', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = await bc.treasury('ks-endow-owner');
    const auth = authKey(0x73);
    const shard = bc.openContract(await KeyShard.fromInit(owner.address, REGISTRY));
    await shard.send(owner.getSender(), { value: toNano('0.1') }, bundle(23, auth.pub) as any);

    await starve(bc, shard.address, 5_000_000n);
    await shard.send(owner.getSender(), { value: toNano('1') }, bundle(24, auth.pub) as any);

    const after = await balanceOf(bc, shard.address);
    expect(after, 'a depleted shard must come back up to its endowment').toBeGreaterThanOrEqual(BASE_ENDOWMENT - 1_000_000n);
    expect(after, 'and no further — the surplus is still returned').toBeLessThan(BASE_ENDOWMENT + 5_000_000n);
    expect((await shard.getGetView()).key_generation, 'and it really was a re-registration').toBe(1n);
  });

  it('KS-ENDOW-02: a HEALTHY shard still accretes nothing on rotation — the old invariant is intact', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const owner = await bc.treasury('ks-healthy-owner');
    const auth = authKey(0x74);
    const shard = bc.openContract(await KeyShard.fromInit(owner.address, REGISTRY));
    await shard.send(owner.getSender(), { value: toNano('0.1') }, bundle(25, auth.pub) as any);
    const healthy = await balanceOf(bc, shard.address);
    expect(healthy, 'the fixture must actually be healthy or this proves nothing').toBeGreaterThan(BASE_ENDOWMENT - 1_000_000n);

    await shard.send(owner.getSender(), { value: toNano('1') }, bundle(26, auth.pub) as any);
    expect(await balanceOf(bc, shard.address), 'a replacement adds no state, so it must add no endowment')
      .toBeLessThan(healthy + 1_000_000n);
  });
});
