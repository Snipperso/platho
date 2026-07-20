import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// KEY-SHARD — the ceiling is REMOVED, not raised.
//
// KeyRegistry held every wallet's identity in maps that never shrink: MEASURED 17.00 cells per wallet, plus 46
// code cells and 1 base data cell, against the ~65536-cell account ceiling => 3852 wallets, for a contract EVERY
// wallet must register in. The refusal would have arrived as ACTION-phase code 50 with COMPUTE reporting exit 0,
// so no exit-code assertion anywhere would have gone red — identities would simply have stopped being recorded.
//
// This suite's job is to prove the cure is structural rather than a bigger number. The load-bearing test is
// KS-CEIL-01: there is no map in this contract, so an account's size must be INDEPENDENT of how many wallets
// exist and of how many times one wallet rotates. If that ever stops being true the ceiling is back.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

// After the Apr-2026 config-18 switch. Before it a cell-year costs 240631 instead of 64962 and every rent
// figure here is ~7.5x wrong — the sandbox default clock is 2023, which is how an under-funded endowment once
// looked healthy.
const CLOCK = 1_790_000_000;
const CELL_YEAR = 64962n;
const YEARS_FUNDED = 10n;
const BASE_ENDOWMENT = 45_000_000n;
const MIN_REGISTER_VALUE = 57_000_000n;   // BASE_ENDOWMENT + KS_REGISTER_GAS
const MIN_REPLACE_VALUE = 12_000_000n;
const SIGN_DOMAIN = 0x4b534b31;

/** A well-formed ML-KEM-768 pubkey: 1184 bytes as a 41 + 127*9 snake, which is what gate 22108 demands. */
const mlkemSnake = (fill: number): Cell => {
  const buf = Buffer.alloc(1184, fill);
  const chunks: Buffer[] = [buf.subarray(0, 41)];
  for (let o = 41; o < 1184; o += 127) chunks.push(buf.subarray(o, Math.min(o + 127, 1184)));
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
  const pub = ed25519.getPublicKey(secret);
  return { secret, pub: BigInt('0x' + Buffer.from(pub).toString('hex')) };
};

/** Unique cells of an account's data, counted by hash — the dedup trap understates any model that does not. */
const dataCells = async (bc: Blockchain, addr: Address): Promise<number> => {
  const acc = await bc.getContract(addr);
  const st: any = (acc.accountState as any);
  if (st?.type !== 'active') return 0;
  const seen = new Set<string>();
  const walk = (c: Cell) => {
    const k = c.hash().toString('hex');
    if (seen.has(k)) return;
    seen.add(k);
    for (const r of c.refs) walk(r);
  };
  walk(st.state.data as Cell);
  return seen.size;
};

async function setup() {
  const bc = await Blockchain.create();
  bc.now = CLOCK;
  return bc;
}

/** The shard of a wallet, at the address a CLIENT computes with nothing but that wallet's address. */
const shardOf = async (owner: Address) => contractAddress(0, await KeyShard.init(owner));

describe('KEY-SHARD — one wallet, one contract, no directory to fill up', () => {
  it('KS-01: the address is a pure function of the wallet — the client needs no directory at all', async () => {
    // This IS the fix. KeyRegistry needed a global map because a sender had no way to find a recipient's record;
    // here the address is derived from the recipient's wallet, so there is nothing to index and nothing to fill.
    const bc = await setup();
    const alice = await bc.treasury('ks-alice');
    const bob = await bc.treasury('ks-bob');

    const a1 = await shardOf(alice.address);
    const a2 = await shardOf(alice.address);
    expect(a1.equals(a2), 'derivation is deterministic').toBe(true);
    expect(a1.equals(await shardOf(bob.address)), 'and distinct per wallet').toBe(false);

    // A shard that was never deployed simply does not exist — which is exactly how a client learns "no identity".
    expect((await bc.getContract(a1)).accountState?.type, 'absent until its owner deploys it').not.toBe('active');
  }, 120_000);

  it('KS-02: only the owning wallet may write into its shard', async () => {
    const bc = await setup();
    const alice = await bc.treasury('ks-alice');
    const mallory = await bc.treasury('ks-mallory');
    const shard = bc.openContract(await KeyShard.fromInit(alice.address));
    const auth = authKey(0x11);

    // The stranger attaches plenty of value and a perfectly valid bundle. The address commits to Alice, so
    // gate 22050 is the whole authorisation — there is no other wallet's shard Mallory could reach.
    const bad = await shard.send(mallory.getSender(), { value: toNano('1') }, bundle(1, auth.pub) as any);
    const badTx = (bad.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(badTx?.description?.computePhase?.exitCode, 'a stranger is refused in COMPUTE').toBe(22050);
    expect((await shard.getGetView()).exists, 'and nothing was written').toBe(false);

    await shard.send(alice.getSender(), { value: toNano('0.1') }, bundle(1, auth.pub) as any);
    const v = await shard.getGetView();
    expect(v.exists, 'the owner registers').toBe(true);
    expect(v.owner_wallet.equals(alice.address)).toBe(true);
    expect(v.key_generation).toBe(0n);
    expect(v.enc_pubkey).toBe(BigInt(0x1001));
  }, 120_000);

  it('KS-CEIL-01: THE CEILING IS GONE — account size is constant in users AND in rotations', async () => {
    // The load-bearing test. KeyRegistry grew 17.00 cells per registered wallet inside ONE account; if this
    // contract ever grows with either axis, the same silent code-50 wall is back.
    const bc = await setup();
    const auth = authKey(0x21);
    const sizes: number[] = [];

    for (let i = 0; i < 8; i += 1) {
      const w = await bc.treasury(`ks-user-${i}`);
      const shard = bc.openContract(await KeyShard.fromInit(w.address));
      // Distinct ML-KEM blob and clock per user so identical cells cannot be deduplicated into a flat count —
      // the trap that once measured Vault at 17 cells when the truth was 76.
      bc.now = CLOCK + i * 97;
      await shard.send(w.getSender(), { value: toNano('0.1') }, bundle(i + 1, auth.pub) as any);
      sizes.push(await dataCells(bc, shard.address));
    }
    // eslint-disable-next-line no-console
    console.log(`[KS-CEIL-01] per-wallet account data cells across 8 wallets: ${sizes.join(', ')}`);
    expect(new Set(sizes).size, 'every wallet costs the same — the size does not depend on how many exist').toBe(1);

    // And rotation must be net-zero, or a chatty user eats their own account instead of the registry's.
    const w = await bc.treasury('ks-rotator');
    const shard = bc.openContract(await KeyShard.fromInit(w.address));
    await shard.send(w.getSender(), { value: toNano('0.1') }, bundle(1, auth.pub) as any);
    const before = await dataCells(bc, shard.address);
    for (let i = 0; i < 6; i += 1) {
      bc.now = CLOCK + 5000 + i * 131;
      await shard.send(w.getSender(), { value: toNano('0.05') }, bundle(i + 40, auth.pub) as any);
    }
    const after = await dataCells(bc, shard.address);
    // eslint-disable-next-line no-console
    console.log(`[KS-CEIL-01] one wallet, 6 replacements: ${before} -> ${after} cells`);
    expect(after, 'six replacements must add nothing').toBe(before);
    expect((await shard.getGetView()).key_generation, 'though the generation advanced').toBe(6n);
  }, 300_000);

  it('KS-RENT-01: the endowment is MEASURED off the storage phase, not off a model of the account', async () => {
    // A cell model left RecoveryShard short by exactly the StateInit wrapper cell, so this reads what the chain
    // actually charges: advance the clock a year and take the storage phase's own figure.
    const bc = await setup();
    const w = await bc.treasury('ks-rent');
    const shard = bc.openContract(await KeyShard.fromInit(w.address));
    await shard.send(w.getSender(), { value: toNano('0.1') }, bundle(7, authKey(0x31).pub) as any);

    const held = (await bc.getContract(shard.address)).balance;
    bc.now = CLOCK + 365 * 86400;
    const r = await shard.send(w.getSender(), { value: toNano('0.05') }, { $$type: 'KeyShardTopUpStorageReserve' } as any);
    const tx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    const yearFees = BigInt(tx?.description?.storagePhase?.storageFeesCollected ?? 0n);

    // eslint-disable-next-line no-console
    console.log([
      '[KS-RENT-01] what a per-wallet identity really costs',
      `  held after register        ${held} (endowment ${BASE_ENDOWMENT})`,
      `  MEASURED rent for 1 year   ${yearFees}  (= ${Number(yearFees) / Number(CELL_YEAR)} cell-years)`,
      `  funds                      ${Number(held) / Number(yearFees)} years`,
    ].join('\n'));

    expect(yearFees, 'the storage phase must actually charge something').toBeGreaterThan(0n);
    expect(held, `the endowment must fund ${YEARS_FUNDED} years of the MEASURED rent`)
      .toBeGreaterThanOrEqual(yearFees * YEARS_FUNDED);
  }, 300_000);

  it('KS-03: the register floor is real, and change comes back', async () => {
    const bc = await setup();
    const w = await bc.treasury('ks-floor');
    const shard = bc.openContract(await KeyShard.fromInit(w.address));
    const auth = authKey(0x41);

    const low = await shard.send(w.getSender(), { value: MIN_REGISTER_VALUE - 1n }, bundle(2, auth.pub) as any);
    const lowTx = (low.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(lowTx?.description?.computePhase?.exitCode, 'one nanoton short is refused in COMPUTE, so it bounces')
      .toBe(22110);

    await shard.send(w.getSender(), { value: toNano('1') }, bundle(2, auth.pub) as any);
    const held = (await bc.getContract(shard.address)).balance;
    expect(held, 'an over-funded register keeps only the endowment').toBeLessThanOrEqual(BASE_ENDOWMENT);

    // A replacement adds no state, so it must NOT be charged a second endowment.
    const before = (await bc.getContract(shard.address)).balance;
    await shard.send(w.getSender(), { value: toNano('1') }, bundle(3, auth.pub) as any);
    const after = (await bc.getContract(shard.address)).balance;
    expect(after - before, 'a replacement must not accrete another endowment').toBeLessThan(BASE_ENDOWMENT);
    const cheap = await shard.send(w.getSender(), { value: MIN_REPLACE_VALUE - 1n }, bundle(4, auth.pub) as any);
    const cheapTx = (cheap.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(cheapTx?.description?.computePhase?.exitCode, 'but it still has a floor').toBe(22110);
  }, 300_000);

  it('KS-BRICK-01: a bogus auth key no longer bricks the identity FOREVER', async () => {
    // THE DEFECT THIS REWRITE FIXES, found while measuring the ceiling. KeyRegistry took auth_pubkey with no
    // proof of possession, allowed exactly ONE registration per wallet (gate 20111) and never deleted an account
    // — so a wallet that registered an auth key it did not hold could never rotate again. Permanently.
    // Here the WALLET outranks the key it delegated to, so recovery costs one transaction.
    const bc = await setup();
    const w = await bc.treasury('ks-brick');
    const shard = bc.openContract(await KeyShard.fromInit(w.address));

    const lost = authKey(0x51);       // an auth key whose secret the user does not actually have
    await shard.send(w.getSender(), { value: toNano('0.1') }, bundle(5, lost.pub) as any);
    expect((await shard.getGetView()).key_generation).toBe(0n);

    const held = authKey(0x52);       // the one they do hold
    await shard.send(w.getSender(), { value: toNano('0.05') }, bundle(6, held.pub) as any);
    const v = await shard.getGetView();
    expect(v.key_generation, 'the wallet re-registered over it').toBe(1n);
    expect(v.enc_pubkey, 'with a fresh bundle').toBe(BigInt(0x1006));

    // And the new auth key is genuinely in force: rotation now verifies against it.
    const payload = (nonce: bigint) => {
      const action = beginCell()
        .storeUint(0x1099n, 256).storeUint(0x2099n, 256).storeUint(0x3099n, 256)
        .storeUint(1184n, 16).storeUint(2n, 16)
        .storeRef(mlkemSnake(9))
        .storeRef(beginCell().storeUint(0x4099n, 256).endCell())
        .endCell();
      const shardHash = BigInt('0x' + shard.address.hash.toString('hex'));
      return beginCell().storeUint(SIGN_DOMAIN, 32).storeUint(shardHash, 256).storeUint(nonce, 64)
        .storeRef(action).endCell();
    };
    const p = payload(0n);
    const sig = ed25519.sign(new Uint8Array(p.hash()), held.secret);
    await shard.sendExternal({
      $$type: 'KeyShardReplaceKeys',
      signature: Buffer.from(sig),
      signed_payload: p,
      envelope_padding: beginCell().endCell().beginParse(),
    } as any);
    const rotated = await shard.getGetView();
    expect(rotated.key_generation, 'the recovered auth key can rotate').toBe(2n);
    expect(rotated.enc_pubkey).toBe(0x1099n);
    expect(rotated.rotation_nonce, 'and the nonce advanced').toBe(1n);
  }, 300_000);

  it('KS-ROT-01: a rotation signed for one shard cannot be replayed against another', async () => {
    // KeyRegistry bound the signature to its ONE address. With a contract per wallet that address is different
    // for every user, so the binding has to be to the shard's own address or a captured payload would rotate
    // somebody else's keys. Gate 22133 is what makes that true; this proves it rather than trusting it.
    const bc = await setup();
    const a = await bc.treasury('ks-rot-a');
    const b = await bc.treasury('ks-rot-b');
    const auth = authKey(0x61);
    const shardA = bc.openContract(await KeyShard.fromInit(a.address));
    const shardB = bc.openContract(await KeyShard.fromInit(b.address));
    await shardA.send(a.getSender(), { value: toNano('0.1') }, bundle(11, auth.pub) as any);
    await shardB.send(b.getSender(), { value: toNano('0.1') }, bundle(12, auth.pub) as any);

    const action = beginCell()
      .storeUint(0x10AAn, 256).storeUint(0x20AAn, 256).storeUint(0x30AAn, 256)
      .storeUint(1184n, 16).storeUint(2n, 16)
      .storeRef(mlkemSnake(0xAA))
      .storeRef(beginCell().storeUint(0x40AAn, 256).endCell())
      .endCell();
    const forA = beginCell().storeUint(SIGN_DOMAIN, 32)
      .storeUint(BigInt('0x' + shardA.address.hash.toString('hex')), 256)
      .storeUint(0n, 64).storeRef(action).endCell();
    const sig = ed25519.sign(new Uint8Array(forA.hash()), auth.secret);
    const ext = {
      $$type: 'KeyShardReplaceKeys',
      signature: Buffer.from(sig),
      signed_payload: forA,
      envelope_padding: beginCell().endCell().beginParse(),
    } as any;

    // Same signature, same auth key, aimed at B's shard: the address inside the payload is A's.
    await expect(shardB.sendExternal(ext), 'the payload names A, so B must refuse it').rejects.toThrow();
    expect((await shardB.getGetView()).key_generation, "B's keys are untouched").toBe(0n);

    await shardA.sendExternal(ext);
    expect((await shardA.getGetView()).key_generation, 'while A accepts its own').toBe(1n);

    // And the nonce burns: the very same external cannot be replayed even where it was valid.
    await expect(shardA.sendExternal(ext), 'a replay is refused by the nonce').rejects.toThrow();
    expect((await shardA.getGetView()).key_generation).toBe(1n);
  }, 300_000);
});
