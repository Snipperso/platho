import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import { webcrypto } from 'crypto';
import { hubTxExit } from './helpers/vpb2';
import { convPartToken, anonBatch, deployAnonReady, spendKey, KIND_INTRO } from './helpers/anon';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

// clean-16 Фаза 4 · ИНК5 — funds-safety for the INTRO (and, at ИНК6, RECOVERY) lane.
//
// clean-16 B3 migration: the old Vault-forwarded PublishBatchToHub path is gone; the SOLE publish path is now the
// permissionless PublishAnonBatch (per-part spend-token + prepaid pool credit). FUNDS-01 now drives an INTRO publish
// over that anon path (deployAnonReady + convPartToken({kind: KIND_INTRO}) + anonBatch, sent by any relay treasury).
// The two invariants a mistake would bake into immutable genesis are unchanged and still asserted:
//  (1) The INTRO entries' storage endowment MUST be counted inside indexStorageReserve()/protectedReserve(), or
//      that TON is classified as excess and SweepExcessReserve/FlushFees drain it out from under the live storage
//      -> slow irreversible reserve drain, entries collected by storage fee.
//  (2) The per-kind reserve/gas helpers MUST be EXHAUSTIVE with a throw on an unknown kind (no silent PRIVATE/
//      PUBLIC fall-through), so a future kind cannot be under/over-reserved by a forgotten branch.

const HUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');
const VAULT = readFileSync(join('contracts', 'Vault.tact'), 'utf8');

describe('CapsuleHub INTRO funds-safety (clean-16 Фаза 4 ИНК5)', () => {
  it('FUNDS-SRC-01: indexStorageReserve counts the INTRO live entries', () => {
    // The dynamic reserve base must include an intro term (per-entry keepalive + INTRO endowment).
    expect(HUB, 'introIndexStorageReservePerEntry helper').toMatch(/fun introIndexStorageReservePerEntry\(\)/);
    expect(HUB, 'indexStorageReserve includes the intro live count').toMatch(
      /intro_live_count \* self\.introIndexStorageReservePerEntry\(\)/,
    );
  });

  it('FUNDS-SRC-02: the per-kind reserve/gas helpers are exhaustive (throw on unknown kind, no fail-open default)', () => {
    // Hub reserve helper + Vault reserve/gas helpers must throw on an unrecognized kind rather than silently
    // returning a PRIVATE/PUBLIC default.
    const hubReserve = HUB.match(/fun batchStorageReserveWithBuffer\(kind: Int\): Int \{[\s\S]*?\n {4}\}/);
    expect(hubReserve, 'Hub batchStorageReserveWithBuffer').not.toBeNull();
    expect(hubReserve![0], 'Hub reserve helper throws on unknown kind').toMatch(/throw\(/);
    for (const name of ['batchStorageReserve', 'batchHubPartGas', 'batchVaultPartGas']) {
      const fn = VAULT.match(new RegExp(`fun ${name}\\(kind: Int\\): Int \\{[\\s\\S]*?\\n {4}\\}`));
      expect(fn, `Vault ${name}`).not.toBeNull();
      // Exhaustive: an unknown kind hits the throwUnless(16360, kind == PRIVATE) fail-closed guard instead of a
      // silent default. (The last known kind returns after the guard, so all recognized kinds still resolve.)
      expect(fn![0], `Vault ${name} fails closed on unknown kind`).toMatch(/throwUnless\(16360,/);
    }
  });

  it('FUNDS-01: an INTRO publish raises the dynamic index storage reserve (endowment is backed, not sweepable)', async () => {
    // B3 anon path: deploy the bound+sealed pair, mirror an issuer slot, fund the pool for nowEpoch.
    const env: any = await deployAnonReady({ credits: 1n });
    const relay = await env.blockchain.treasury('intro-funds-relay');

    const before = await env.hub.getGetState();
    expect(before.intro_live_count).toBe(0n);
    // With no live entries the dynamic reserve base is 0 (the poolTerm/floor are applied separately in
    // protectedReserve, NOT in indexStorageReserve — so funding the pool does not move this getter).
    expect(before.index_storage_reserve_ton).toBe(0n);

    // One permissionless INTRO part, authorized by its parallel spend-token, spending one prepaid credit.
    const pt = convPartToken({
      issuer: env.issuer, spend: spendKey(0), slot: env.slot, epoch: env.nowEpoch, nonce: 121n, kind: KIND_INTRO,
    });
    const res = await env.hub.send(relay.getSender(), { value: toNano('0.3') },
      anonBatch({ parts: pt.part, tokens: pt.tok, partCount: 1n, kind: KIND_INTRO }));
    expect(hubTxExit(res, env.hub)).toBe(0);

    const after = await env.hub.getGetState();
    expect(after.intro_live_count).toBe(1n);
    // The intro entry's endowment now sits INSIDE the dynamic reserve (before ИНК5 it was uncounted -> 0).
    expect(after.index_storage_reserve_ton).toBeGreaterThan(0n);
    // protectedReserve (fee + max(dynamic, floor)) always covers the dynamic index reserve.
    expect(after.protected_reserve_ton).toBeGreaterThanOrEqual(after.index_storage_reserve_ton);
  });
});
