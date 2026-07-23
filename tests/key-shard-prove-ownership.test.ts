import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { ed25519 } from '@noble/curves/ed25519.js';
import { KeyShard, loadKeyShardOwnershipProof } from '../build/KeyShard/KeyShard_KeyShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// KEY-SHARD PROVE-OWNERSHIP — the migration hook (variant A, mirrors UsernameNFTItem.ProveUsernameOwnership).
//
// A redeploy moves ProfileRegistry to a new address, which moves every KeyShard's address (it is init'd with the
// registry), so without a self-attestation hook a wallet's published key bundle + avatar pointer are orphaned and
// the wallet must re-register to be reachable again. KeyShardProveOwnership lets the shard state its own PUBLIC
// identity to the next generation so it can adopt it with no wallet action. auth_pubkey is NEVER exported.
//
// The load-bearing test is KS-PROVE-01: a THIRD PARTY triggers it and the proof still names the CURRENT owner and
// carries the exact registered bundle + avatar pointer. Verified by mutation (name sender() instead of owner and
// the owner assertion goes red).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const PROOF_FORWARD_RESERVE = 5_000_000n;
const BASE_ENDOWMENT = 45_000_000n;

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
  return BigInt('0x' + Buffer.from(pub).toString('hex'));
};

const avatarWrite = (owner: Address) => ({
  $$type: 'KeyShardSetAvatarPointer' as const,
  write_id: 77n,
  owner_wallet: owner,
  avatar_hash: BigInt('0xabc123'),
  avatar_entry_id: 4242n,
  avatar_stream_id: 987654321n,
  avatar_part_count: 3n,
  media_format: 2n,
});

/** Pull the single KeyShardOwnershipProof the shard forwarded to `dest` out of the sandbox result. */
const findProofTo = (result: any, dest: Address) => {
  for (const tx of result.transactions as any[]) {
    for (const out of (tx.outMessages as Map<number, any>).values()) {
      if (out.info?.dest?.equals?.(dest)) {
        return { proof: loadKeyShardOwnershipProof((out.body as Cell).beginParse()), value: out.info.value.coins as bigint };
      }
    }
  }
  return null;
};

async function registered(bc: Blockchain, owner: Address, registry: Address, ownerSender: any, registrySender: any) {
  const shard = bc.openContract(await KeyShard.fromInit(owner, registry));
  await shard.send(ownerSender, { value: toNano('0.1') }, bundle(9, authKey(0x11)) as any);
  await shard.send(registrySender, { value: toNano('0.02') }, avatarWrite(owner) as any);
  return shard;
}

describe('KEY-SHARD PROVE-OWNERSHIP — migration self-attestation', () => {
  it('KS-PROVE-01: a THIRD PARTY triggers it, and the proof names the CURRENT owner and carries the full bundle + avatar', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const alice = await bc.treasury('ks-alice');
    const registry = await bc.treasury('ks-registry');
    const mallory = await bc.treasury('ks-mallory');       // permissionless: a stranger, not the owner
    const newRegistry = new Address(0, Buffer.alloc(32, 7)); // the next-generation registry to adopt into

    const shard = await registered(bc, alice.address, registry.address, alice.getSender(), registry.getSender());
    const view = await shard.getGetView();

    const res = await shard.send(mallory.getSender(), { value: toNano('0.01') },
      { $$type: 'KeyShardProveOwnership', query_id: 555n, to: newRegistry } as any);

    // The prove itself must NOT throw for a stranger — it is permissionless by design.
    const proveTx = (res.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(proveTx?.description?.computePhase?.exitCode, 'permissionless: a stranger triggers it cleanly').toBe(0);

    const hit = findProofTo(res, newRegistry);
    expect(hit, 'a proof was forwarded to the next-generation registry').not.toBeNull();
    const p = hit!.proof;

    // NAMES THE CURRENT OWNER — not the stranger who triggered it. This is the whole safety property.
    expect(p.owner_wallet.equals(alice.address), 'proof names the current owner, never the triggerer').toBe(true);
    expect(p.owner_wallet.equals(mallory.address), 'and definitely not the stranger').toBe(false);

    // The full public bundle survives the round-trip, byte for byte (the mlkem snake included).
    expect(p.key_id).toBe(view.key_id);
    expect(p.key_generation).toBe(view.key_generation);
    expect(p.enc_pubkey).toBe(view.enc_pubkey);
    expect(p.sign_pubkey).toBe(view.sign_pubkey);
    expect(p.scan_pubkey).toBe(view.scan_pubkey);
    expect(p.pq_kem_pubkey_hash).toBe(view.pq_kem_pubkey_hash);
    expect(p.pq_kem_pubkey_len).toBe(view.pq_kem_pubkey_len);
    expect(p.pq_kem_pubkey.hash().toString('hex'), 'mlkem snake survives as a ref, no overflow').toBe(view.pq_kem_pubkey.hash().toString('hex'));
    expect(p.crypto_suite_mask).toBe(view.crypto_suite_mask);

    // The avatar pointer rides along so the identity's avatar is not lost either.
    expect(p.avatar_version).toBe(view.avatar_version);
    expect(p.avatar_hash).toBe(view.avatar_hash);
    expect(p.avatar_entry_id).toBe(view.avatar_entry_id);
    expect(p.avatar_stream_id).toBe(view.avatar_stream_id);
    expect(p.avatar_part_count).toBe(view.avatar_part_count);
    expect(p.avatar_media_format).toBe(view.avatar_media_format);

    // Pin EVERY exported field's round-trip (not just the discovery-critical ones) so a future rebuild that
    // reorders the message body cannot silently corrupt these three metadata axes — the serialization-lens note.
    expect(p.rotation_nonce).toBe(view.rotation_nonce);
    expect(p.created_at).toBe(view.created_at);
    expect(p.avatar_updated_at).toBe(view.avatar_updated_at);
  }, 120_000);

  it('KS-PROVE-02: value is bounded — too little is refused (22222), and it can never be a value relay (22223)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const alice = await bc.treasury('ks-alice');
    const registry = await bc.treasury('ks-registry');
    const newRegistry = new Address(0, Buffer.alloc(32, 7));
    const shard = await registered(bc, alice.address, registry.address, alice.getSender(), registry.getSender());

    const low = await shard.send(alice.getSender(), { value: 8_000_000n },   // < FORWARD(5M)+EXEC(4M)=9M
      { $$type: 'KeyShardProveOwnership', query_id: 1n, to: newRegistry } as any);
    expect((low.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address))
      ?.description?.computePhase?.exitCode, 'below the 9M minimum is refused (pins exec=4M, not 2M)').toBe(22222);

    const high = await shard.send(alice.getSender(), { value: 21_000_000n }, // > MAX(20M): a value-relay attempt
      { $$type: 'KeyShardProveOwnership', query_id: 2n, to: newRegistry } as any);
    expect((high.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address))
      ?.description?.computePhase?.exitCode, 'over the cap is refused so the shard is never a relay').toBe(22223);
  }, 120_000);

  it('KS-PROVE-03: an unregistered shard has nothing to prove (22220)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const alice = await bc.treasury('ks-alice');
    const registry = await bc.treasury('ks-registry');
    const newRegistry = new Address(0, Buffer.alloc(32, 7));
    // Deploy the shard (a bare top-up) but never register a bundle.
    const shard = bc.openContract(await KeyShard.fromInit(alice.address, registry.address));
    await shard.send(alice.getSender(), { value: toNano('0.05') }, null as any);

    const res = await shard.send(alice.getSender(), { value: toNano('0.01') },
      { $$type: 'KeyShardProveOwnership', query_id: 1n, to: newRegistry } as any);
    expect((res.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address))
      ?.description?.computePhase?.exitCode, 'nothing registered => nothing to prove').toBe(22220);
  }, 120_000);

  it('KS-PROVE-04: a non-basechain target is refused (22221)', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const alice = await bc.treasury('ks-alice');
    const registry = await bc.treasury('ks-registry');
    const shard = await registered(bc, alice.address, registry.address, alice.getSender(), registry.getSender());
    const masterchain = new Address(-1, Buffer.alloc(32, 7)); // workchain -1: value must not be forwarded there

    const res = await shard.send(alice.getSender(), { value: toNano('0.01') },
      { $$type: 'KeyShardProveOwnership', query_id: 1n, to: masterchain } as any);
    expect((res.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address))
      ?.description?.computePhase?.exitCode, 'a non-basechain target is refused').toBe(22221);
  }, 120_000);

  it('KS-PROVE-05: the shard forwards exactly the reserve and never dips into its storage endowment', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const alice = await bc.treasury('ks-alice');
    const registry = await bc.treasury('ks-registry');
    const mallory = await bc.treasury('ks-mallory');
    const newRegistry = new Address(0, Buffer.alloc(32, 7));
    const shard = await registered(bc, alice.address, registry.address, alice.getSender(), registry.getSender());

    const before = (await bc.getContract(shard.address)).balance;
    // Send EXACTLY the minimum the gate allows (FORWARD 5M + EXEC 4M = 9M) — the tightest legal trigger, where the
    // "never pays from endowment" invariant is under the most pressure.
    const res = await shard.send(mallory.getSender(), { value: 9_000_000n },
      { $$type: 'KeyShardProveOwnership', query_id: 9n, to: newRegistry } as any);

    const hit = findProofTo(res, newRegistry);
    expect(hit!.value, 'forwards exactly the fixed reserve, nothing more').toBe(PROOF_FORWARD_RESERVE);

    const after = (await bc.getContract(shard.address)).balance;
    // The forward + fees are paid out of the INCOMING value, never the shard's balance. At the minimum-value
    // boundary the shard must still net a HEALTHY margin (exec 4M vs measured cost ~2.0M) — not the +3331 nanoton
    // razor's edge that exec=2M left, which any mainnet gas/fwd drift would push negative on an immutable contract.
    expect(after - before >= 1_500_000n, 'nets a comfortable margin at the tightest legal value, not a hair').toBe(true);
    expect(after >= BASE_ENDOWMENT, 'and stays above its base endowment').toBe(true);
  }, 120_000);
});
