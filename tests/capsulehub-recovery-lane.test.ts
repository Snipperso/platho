import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Cell, toNano } from '@ton/core';
import { finalPrivateBodyCell, finalPrivateHeader1Cell, snakeCellFromBytes } from './helpers/capsule-cells';
import { KIND_RECOVERY, privatePartCustom, publishBatchToHub, setupHub, hubTxExit } from './helpers/vpb2';

// clean-16 Фаза 4 · ИНК6 — RECOVERY durability lane (tests-first). Variant-B.
//
// RECOVERY (publish_kind=4) is the K_root self-recovery lane: after a reinstall a user restores their seed,
// derives a deterministic self-bucketKey (epoch-0), and fetches their recovery capsule from a dedicated on-chain
// pool to recover K_root (+ the contact list) and keep reading the still-on-chain messages. Because a user can
// only ever have ONE current recovery blob per page, the pool is a KEYED LATEST-WINS slot map (not a FIFO append):
// re-publishing the same slotKey OVERWRITES and does NOT grow the live count. The body is stored ON-CHAIN for the
// full retention (3 years) so recovery survives even if archive nodes drop old history. RECOVERY reuses the CONV
// 320-bit header0 shape, so the ONLY discriminator vs CONV is the batch kind + the byte@5 meta-assert (13559).
// Eviction is PERMISSIONLESS (EvictExpiredRecoverySlot) — anyone can reclaim an expired slot's reserve.

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');
const VAULT = readFileSync(join('contracts', 'Vault.tact'), 'utf8');
const FUND = toNano('1');

// A CONV-shape 40-byte header0 with an explicit publishKind at byte@5 and a slotKey (self-bucketKey) at bytes 8..40.
function recoveryHeader0(slotKey: bigint, publishKind = 4): Cell {
  const bytes = Buffer.alloc(40, 0x00);
  bytes.write('PH0C', 0, 'ascii');
  bytes[4] = 1; // version
  bytes[5] = publishKind; // byte@5 = embedded publishKind (RECOVERY = 4)
  bytes[6] = 1; // sizeClass
  bytes[7] = 2; // cryptoSuite = HYBRID
  const key = Buffer.alloc(32);
  let v = slotKey;
  for (let i = 31; i >= 0; i -= 1) { key[i] = Number(v & 0xffn); v >>= 8n; }
  key.copy(bytes, 8);
  return snakeCellFromBytes(bytes);
}

function recoveryPart(slotKey: bigint, publishKind = 4, bodyFill = 0x62) {
  return privatePartCustom({
    h0Cell: recoveryHeader0(slotKey, publishKind),
    h1Cell: finalPrivateHeader1Cell(),
    bodyCell: finalPrivateBodyCell(1, bodyFill),
  });
}

const SLOT = 0x1234567890abcdefn;

describe('CapsuleHub RECOVERY durability lane (clean-16 Фаза 4 ИНК6)', () => {
  it('RECOVERY-SRC-01: the RECOVERY lane surface exists (kind=4, slot map, getter, permissionless evict, meta-assert, 3yr retention)', () => {
    for (const sym of [
      'CAPSULEHUB_ENTRY_KIND_RECOVERY',
      'CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS: Int = 94608000',
      'recovery_slots',
      'recovery_live_count',
      'struct RecoveryCapsuleRecord',
      'get fun get_recovery_capsule',
      'EvictExpiredRecoverySlot',
      'recoveryIndexStorageReservePerEntry',
      '13559', // RECOVERY meta-assert
      '13561', // EvictExpiredRecoverySlot not-yet-expired guard
      '13563', // ИНК6-fix: overwrite-by-non-owner reject (Variant-B first-publisher bind)
    ]) {
      expect(HUB, `RECOVERY surface must include: ${sym}`).toContain(sym);
    }
    // The recovery term must be inside the dynamic index storage reserve (funds-backing, like intro at ИНК5).
    expect(HUB).toMatch(/recovery_live_count \* self\.recoveryIndexStorageReservePerEntry\(\)/);
    // Vault mirror: kind=4 + reuse of the CONV shape validator for RECOVERY.
    expect(VAULT, 'Vault PUBLISH_KIND_RECOVERY').toMatch(/PUBLISH_KIND_RECOVERY: Int = 4/);
    // ИНК6-fix (adversarial review): the RecoveryCapsuleRecord binds its first publisher (Variant-B), so a
    // third party who reads the on-chain slotKey cannot overwrite the victim's K_root blob.
    expect(HUB, 'RecoveryCapsuleRecord binds author_wallet').toMatch(/struct RecoveryCapsuleRecord[\s\S]*author_wallet: Address/);
    // ИНК6-fix: the endowment was recalibrated to the real worst-case 3yr on-chain body rent (G8-provisional,
    // finalized by measured computeDataSize in Фаза-5) — the initial 30M underfunded storage ~4-5x.
    expect(HUB, 'RECOVERY endowment recalibrated').toMatch(/CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT: Int = 200000000/);
    // ИНК6-fix: the Vault mirrors the Hub RECOVERY size cap, so an oversize recovery batch rejects cheaply
    // pre-forward instead of being charged then bounced by the Hub (13560).
    expect(VAULT, 'Vault mirrors RECOVERY_MAX_SIZE_CLASS').toContain('RECOVERY_MAX_SIZE_CLASS');
  });

  it('RECOVERY-01: a RECOVERY batch stores the body on-chain in a keyed slot; get_recovery_capsule returns it', async () => {
    const { hub, vault } = await setupHub();
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT), authorWallet: vault.address, kind: KIND_RECOVERY }));

    const state = await hub.getGetState();
    expect(state.recovery_live_count).toBe(1n);
    // RECOVERY does NOT touch the CONV/INTRO/PUBLIC pools (it is a keyed map, no sequential id).
    expect(state.private_latest_id).toBe(0n);
    expect(state.intro_latest_id).toBe(0n);

    const rec = await hub.getGetRecoveryCapsule(SLOT);
    expect(rec.exists).toBe(true);
    expect(rec.slot_key).toBe(SLOT);
    // The body is stored on-chain (Variant-B durability): the getter returns the full body cell.
    expect(rec.body.bits.length + rec.body.refs.length).toBeGreaterThan(0);
  });

  it('RECOVERY-02: re-publishing the SAME slotKey overwrites (latest-wins) and does NOT grow the live count', async () => {
    const { hub, vault } = await setupHub();
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT, 4, 0x61), authorWallet: vault.address, kind: KIND_RECOVERY }));
    const first = await hub.getGetRecoveryCapsule(SLOT);
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT, 4, 0x63), authorWallet: vault.address, kind: KIND_RECOVERY }));

    const state = await hub.getGetState();
    expect(state.recovery_live_count).toBe(1n); // overwrite, not a second entry
    const second = await hub.getGetRecoveryCapsule(SLOT);
    expect(second.exists).toBe(true);
    expect(second.body_hash).not.toBe(first.body_hash); // the blob was replaced
  });

  it('RECOVERY-03: a CONV-labelled header0 (byte@5=1) under kind=RECOVERY fails closed (13559)', async () => {
    const { hub, vault } = await setupHub();
    const bad = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT, 1), authorWallet: vault.address, kind: KIND_RECOVERY }));
    expect(hubTxExit(bad, hub)).toBe(13559);
    expect((await hub.getGetState()).recovery_live_count).toBe(0n);
  });

  it('RECOVERY-04: EvictExpiredRecoverySlot rejects a not-yet-expired slot (13561)', async () => {
    const { hub, vault } = await setupHub();
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT), authorWallet: vault.address, kind: KIND_RECOVERY }));
    // The slot was just stored (updated_at = now), so it is far from the 3-year expiry -> eviction must reject.
    const res = await hub.send(vault.getSender(), { value: toNano('0.05') },
      { $$type: 'EvictExpiredRecoverySlot', slot_key: SLOT } as any);
    expect(hubTxExit(res, hub)).toBe(13561);
    expect((await hub.getGetState()).recovery_live_count).toBe(1n);
  });

  it('RECOVERY-05: a DIFFERENT wallet cannot overwrite an existing slot → 13563 (Variant-B first-publisher bind)', async () => {
    const { blockchain, hub, vault } = await setupHub();
    // Victim publishes their recovery capsule (author_wallet = the bound vault stand-in).
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT, 4, 0x61), authorWallet: vault.address, kind: KIND_RECOVERY }));
    const before = await hub.getGetRecoveryCapsule(SLOT);
    // Attacker reads the victim's slotKey from chain and tries to overwrite it with garbage under THEIR OWN
    // author_wallet. Before the fix this destroyed the victim's K_root blob permanently; now it must reject.
    const attacker = await blockchain.treasury('recovery-attacker');
    const res = await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT, 4, 0x99), authorWallet: attacker.address, kind: KIND_RECOVERY }));
    expect(hubTxExit(res, hub)).toBe(13563);
    // The victim's capsule is untouched: live count unchanged, body preserved.
    const after = await hub.getGetRecoveryCapsule(SLOT);
    expect((await hub.getGetState()).recovery_live_count).toBe(1n);
    expect(after.body_hash).toBe(before.body_hash);
    // The legitimate owner CAN still overwrite their own slot (same author_wallet).
    await hub.send(vault.getSender(), { value: FUND },
      publishBatchToHub({ parts: recoveryPart(SLOT, 4, 0x62), authorWallet: vault.address, kind: KIND_RECOVERY }));
    const owned = await hub.getGetRecoveryCapsule(SLOT);
    expect(owned.body_hash).not.toBe(before.body_hash);
    expect((await hub.getGetState()).recovery_live_count).toBe(1n);
  });
});
