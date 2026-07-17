import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { webcrypto } from 'crypto';
import { beginCell, toNano } from '@ton/core';
import { KeyPair, keyPairFromSeed, sign } from '@ton/crypto';
import {
  finalPrivateHeader1Cell,
  finalPrivateBodyCell,
  snakeCellFromBytes,
  FINAL_PRIVATE_HEADER0_BYTES,
} from './helpers/capsule-cells';
import { cellHash, SIZE_1K, SUITE_HYBRID, hubTxExit } from './helpers/vpb2';
import { RECOVERY_SLOT_DOMAIN, NONZERO_PUBLISH_ID, bufToInt, deployAnonReady } from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 B3 migration · ИНК6 — RECOVERY durability lane, Variant-B. The old Vault-forwarded PublishBatchToHub path
// (op 0xA4F862D1) is GONE; RECOVERY now has its OWN self-funded, owner_sig-authorized receiver: receive(PublishRecovery)
// (op 0x50415243 "PARC"). RECOVERY does NOT ride the prepaid spend-token pool (it stores the owner's own K_root, already
// in the tx), so it is not part of the anon-token lanes — it brings its endowment directly in msg.value (toNano('1')) and
// is authorized by an ed25519 owner_sig over the recoveryDigest (binds slotKey + monotonic seq + the three frame hashes).
//
// RECOVERY (publish_kind=4) is the K_root self-recovery lane: after a reinstall a user restores their seed, derives a
// deterministic self-bucketKey (slotKey), and fetches their recovery capsule from a dedicated on-chain pool to recover
// K_root (+ the contact list). Because a user can only ever have ONE current recovery blob per page, the pool is a KEYED
// LATEST-WINS slot map (not a FIFO append): re-publishing the same slotKey OVERWRITES and does NOT grow the live count.
// The body is stored ON-CHAIN for the full retention (3 years) so recovery survives even if archive nodes drop history.
// RECOVERY reuses the CONV 784-bit/320-bit-header0 frame shape, so the ONLY frame discriminator vs CONV is byte@5 of
// header0 (publishKind) — a CONV-labelled header0 (byte@5=1) under this receiver fails closed (13559). Variant-B binds
// the slot to its FIRST publisher's owner_pubkey (13563) with a monotonic seq (13564) so a third party who reads the
// on-chain slotKey cannot destroy or roll back the victim's K_root blob. Eviction is PERMISSIONLESS
// (EvictExpiredRecoverySlot) — anyone can reclaim an expired slot's reserve once its 3-year retention has lapsed (13561).

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');
const VAULT = readFileSync(join('contracts', 'Vault.tact'), 'utf8');

// The two owner identities the slot is authorized against. RECOVERY authorization is by ed25519 owner_pubkey (Variant-B),
// NOT by the relay/payer wallet — the relay is sender-anonymous.
const OWNER = keyPairFromSeed(Buffer.alloc(32, 0x21));
const ATTACKER = keyPairFromSeed(Buffer.alloc(32, 0x22));
const SLOT_FILL = 0x35; // header0 fill byte → slotKey = 0x3535..35 (bytes[8,40)); byte@5 is overwritten with publishKind.

// Local PublishRecovery builder. anon.ts's recoveryMessage couples the header0 (→ slotKey) AND the body to ONE `fill`,
// so it cannot express "same slotKey, DIFFERENT body" (needed to prove an overwrite actually replaced the blob) nor a
// byte@5-tampered header0 for the 13559 negative. This mirrors recoveryMessage exactly but decouples slotFill from
// bodyFill and exposes a publishKind override — the on-chain PublishRecovery message it produces is byte-identical in
// shape to the anon.ts one, so it exercises the SAME contract receiver. (Only this test file is edited; anon.ts is not.)
function buildRecovery(opts: {
  owner: KeyPair; slotFill: number; bodyFill: number; h1Fill?: number;
  seq?: bigint; publishId?: bigint; publishKind?: number;
}): { msg: any; slotKey: bigint } {
  const seq = opts.seq ?? 1n;
  const h0Bytes = Buffer.alloc(FINAL_PRIVATE_HEADER0_BYTES, opts.slotFill);
  h0Bytes[5] = opts.publishKind ?? 4; // byte@5 = embedded publishKind (RECOVERY = 4)
  const h0 = snakeCellFromBytes(h0Bytes);
  const h1 = finalPrivateHeader1Cell(opts.h1Fill ?? 0x31);
  const body = finalPrivateBodyCell(SIZE_1K, opts.bodyFill);
  const h0h = cellHash(h0);
  const h1h = cellHash(h1);
  const bh = cellHash(body);
  const part = beginCell()
    .storeUint(SIZE_1K, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256)
    .storeRef(h0).storeRef(h1).storeRef(body)
    .endCell();
  // slotKey = bytes[8,40) of header0, exactly what the Hub's privateHeaderBucketKey extracts (skip 64 bits, load 256).
  const slotKey = bufToInt(h0Bytes.subarray(8, FINAL_PRIVATE_HEADER0_BYTES));
  const recoveryDigest = beginCell()
    .storeUint(RECOVERY_SLOT_DOMAIN, 32).storeUint(slotKey, 256).storeUint(seq, 64)
    .storeRef(beginCell().storeUint(h0h, 256).storeUint(h1h, 256).storeUint(bh, 256).endCell())
    .endCell().hash();
  const ownerSig = sign(recoveryDigest, opts.owner.secretKey);
  const msg = {
    $$type: 'PublishRecovery',
    bounce_id: 3n,
    bounce_tag: 4n,
    publish_id: opts.publishId ?? NONZERO_PUBLISH_ID,
    part,
    owner_pubkey: bufToInt(opts.owner.publicKey),
    seq,
    owner_sig: beginCell().storeBuffer(ownerSig).endCell(),
  } as any;
  return { msg, slotKey };
}

async function setup() {
  // A bound + sealed Hub (deployAnonReady). RECOVERY is self-funded and pool-independent, but the shared setup gives the
  // same sealed Hub the anon lanes use. The relay is ANY treasury — PublishRecovery has no sender restriction.
  const env: any = await deployAnonReady();
  env.relay = await env.blockchain.treasury('recovery-relay');
  return env;
}

// Publish a RECOVERY capsule from the (permissionless) relay, self-funded with toNano('1').
async function publishRecovery(env: any, built: { msg: any }, value: bigint = toNano('1')) {
  return env.hub.send(env.relay.getSender(), { value }, built.msg);
}

describe('CapsuleHub RECOVERY durability lane (clean-16 Фаза 4 ИНК6 · B3 anon path)', () => {
  it('RECOVERY-SRC-01: the RECOVERY lane surface exists (kind=4, slot map, getter, permissionless evict, meta-assert, 3yr retention, owner_sig+seq bind)', () => {
    for (const sym of [
      'CAPSULEHUB_ENTRY_KIND_RECOVERY',
      'CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS: Int = 94608000',
      'recovery_slots',
      'recovery_live_count',
      'struct RecoveryCapsuleRecord',
      'get fun get_recovery_capsule',
      'EvictExpiredRecoverySlot',
      'recoveryIndexStorageReservePerEntry',
      '13559', // RECOVERY meta-assert (CONV-labelled header0 under kind=RECOVERY)
      '13561', // EvictExpiredRecoverySlot not-yet-expired guard
      '13563', // Variant-B first-publisher bind: overwrite-by-non-owner reject (owner_pubkey mismatch)
      '13564', // Variant-B anti-rollback: an overwrite requires STRICTLY increasing owner-signed seq
      '13571', // owner_sig verify over the recoveryDigest
    ]) {
      expect(HUB, `RECOVERY surface must include: ${sym}`).toContain(sym);
    }
    // The recovery term must be inside the dynamic index storage reserve (funds-backing, like intro at ИНК5).
    expect(HUB).toMatch(/recovery_live_count \* self\.recoveryIndexStorageReservePerEntry\(\)/);
    // Vault mirror: kind=4 + reuse of the CONV shape validator for RECOVERY.
    expect(VAULT, 'Vault PUBLISH_KIND_RECOVERY').toMatch(/PUBLISH_KIND_RECOVERY: Int = 4/);
    // B3/ИНК6 (adversarial review): the RecoveryCapsuleRecord binds its first publisher by ed25519 owner_pubkey
    // (Variant-B) — NOT an author_wallet Address (the payer/relay is sender-anonymous). A third party who reads the
    // on-chain slotKey cannot overwrite the victim's K_root blob without that pubkey's owner_sig.
    expect(HUB, 'RecoveryCapsuleRecord binds owner_pubkey').toMatch(/struct RecoveryCapsuleRecord[\s\S]*owner_pubkey: Int/);
    // [G8 CANONICAL 2026-07-17] The endowment is now MEASURED, not estimated: 79.1 cells (the 8K cap, worst case)
    // x 64962/cell/yr (the frozen 135/0 schedule) x 3yr x 1.5 rate-risk margin -> 23_200_000.
    // This pin previously demanded 200000000 — a number derived on the DEAD pre-Apr-2026 schedule (500/1 with
    // billed bits), which over-charged conversation start ~13x (0.25 GRAM instead of ~0.023). The test was pinning
    // the bug. Assert the CEILING, not a literal: the derivation itself is owned by HUB-G8-CANON-04.
    const recoveryEndowment = Number(HUB.match(/CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT: Int = (\d+)/)![1]);
    expect(recoveryEndowment, 'RECOVERY endowment covers the measured 3yr rent').toBeGreaterThanOrEqual(
      Math.ceil(79.1 * 64962 * 3 * 1.5));
    // ...and is nowhere near the dead-rate figure. A regression back to 500/1 math would blow this.
    expect(recoveryEndowment, 'RECOVERY endowment is not back on the dead rate').toBeLessThan(200000000 / 8);
    // ИНК6-fix: the Vault mirrors the Hub RECOVERY size cap, so an oversize recovery batch rejects cheaply
    // pre-forward instead of being charged then bounced by the Hub (13560).
    expect(VAULT, 'Vault mirrors RECOVERY_MAX_SIZE_CLASS').toContain('RECOVERY_MAX_SIZE_CLASS');
  });

  it('RECOVERY-01: a RECOVERY batch stores the body on-chain in a keyed slot; get_recovery_capsule returns it', async () => {
    const env = await setup();
    const built = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x62 });
    expect(hubTxExit(await publishRecovery(env, built), env.hub)).toBe(0);

    const state = await env.hub.getGetState();
    expect(state.recovery_live_count).toBe(1n);
    // RECOVERY does NOT touch the CONV/INTRO/PUBLIC pools (it is a keyed map, no sequential id).
    expect(state.private_latest_id).toBe(0n);
    expect(state.intro_latest_id).toBe(0n);

    const rec = await env.hub.getGetRecoveryCapsule(built.slotKey);
    expect(rec.exists).toBe(true);
    expect(rec.slot_key).toBe(built.slotKey);
    expect(rec.owner_pubkey).toBe(bufToInt(OWNER.publicKey));
    // The body is stored on-chain (Variant-B durability): the getter returns the full body cell.
    expect(rec.body.bits.length + rec.body.refs.length).toBeGreaterThan(0);
  });

  it('RECOVERY-02: re-publishing the SAME slotKey overwrites (latest-wins) and does NOT grow the live count', async () => {
    const env = await setup();
    const first = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x61, seq: 1n });
    expect(hubTxExit(await publishRecovery(env, first), env.hub)).toBe(0);
    const firstRec = await env.hub.getGetRecoveryCapsule(first.slotKey);

    // Same slotKey (same slotFill), DIFFERENT body (bodyFill), STRICTLY-greater seq (13564 anti-rollback).
    const second = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x63, seq: 2n });
    expect(second.slotKey).toBe(first.slotKey);
    expect(hubTxExit(await publishRecovery(env, second), env.hub)).toBe(0);

    const state = await env.hub.getGetState();
    expect(state.recovery_live_count).toBe(1n); // overwrite, not a second entry
    const secondRec = await env.hub.getGetRecoveryCapsule(first.slotKey);
    expect(secondRec.exists).toBe(true);
    expect(secondRec.body_hash).not.toBe(firstRec.body_hash); // the blob was replaced
  });

  it('RECOVERY-03: a CONV-labelled header0 (byte@5=1) under the RECOVERY receiver fails closed (13559)', async () => {
    const env = await setup();
    const bad = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x62, publishKind: 1 });
    expect(hubTxExit(await publishRecovery(env, bad), env.hub)).toBe(13559);
    expect((await env.hub.getGetState()).recovery_live_count).toBe(0n);
  });

  it('RECOVERY-04: EvictExpiredRecoverySlot rejects a not-yet-expired slot (13561)', async () => {
    const env = await setup();
    const built = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x62 });
    expect(hubTxExit(await publishRecovery(env, built), env.hub)).toBe(0);
    // The slot was just stored (updated_at = now), so it is far from the 3-year expiry -> eviction must reject.
    const res = await env.hub.send(env.relay.getSender(), { value: toNano('0.05') },
      { $$type: 'EvictExpiredRecoverySlot', slot_key: built.slotKey } as any);
    expect(hubTxExit(res, env.hub)).toBe(13561);
    expect((await env.hub.getGetState()).recovery_live_count).toBe(1n);
  });

  it('RECOVERY-05: a DIFFERENT owner_pubkey cannot overwrite an existing slot → 13563 (Variant-B first-publisher bind)', async () => {
    const env = await setup();
    // Victim publishes their recovery capsule (slot bound to OWNER's pubkey).
    const victim = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x61, seq: 1n });
    expect(hubTxExit(await publishRecovery(env, victim), env.hub)).toBe(0);
    const before = await env.hub.getGetRecoveryCapsule(victim.slotKey);

    // Attacker reads the victim's slotKey from chain and tries to overwrite it with garbage under THEIR OWN owner key
    // (a valid self-signature, so it passes 13571 and reaches the ownership check). Before the fix this destroyed the
    // victim's K_root blob permanently; now the first-publisher owner_pubkey bind must reject it.
    const attack = buildRecovery({ owner: ATTACKER, slotFill: SLOT_FILL, bodyFill: 0x99, seq: 2n });
    expect(attack.slotKey).toBe(victim.slotKey);
    expect(hubTxExit(await publishRecovery(env, attack), env.hub)).toBe(13563);

    // The victim's capsule is untouched: live count unchanged, body preserved.
    const after = await env.hub.getGetRecoveryCapsule(victim.slotKey);
    expect((await env.hub.getGetState()).recovery_live_count).toBe(1n);
    expect(after.body_hash).toBe(before.body_hash);

    // The legitimate owner CAN still overwrite their own slot (same owner_pubkey, higher seq, new body).
    const owned = buildRecovery({ owner: OWNER, slotFill: SLOT_FILL, bodyFill: 0x62, seq: 2n });
    expect(hubTxExit(await publishRecovery(env, owned), env.hub)).toBe(0);
    const ownedRec = await env.hub.getGetRecoveryCapsule(victim.slotKey);
    expect(ownedRec.body_hash).not.toBe(before.body_hash);
    expect((await env.hub.getGetState()).recovery_live_count).toBe(1n);
  });
});
