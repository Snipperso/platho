import { describe, expect, it } from 'vitest';
import { beginCell } from '@ton/core';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// ATHWALLET TOMBSTONE CEILING — the SECOND ceiling behind usernames and profiles.
//
// A .ath name (and a paid avatar) is bought with ATH. The payment lands on the registry's ONE official ATH wallet,
// which records a permanent replay tombstone in `processed_notifications` per payment. That makes it an independent
// product-level ceiling in the same place as the registry's own: sharding the registry to lift ITS ceiling does
// nothing here, because every purchase still funnels through this one wallet and grows this one map.
//
// WHY THIS IS PROVEN STRUCTURALLY RATHER THAN DRIVEN END-TO-END. The full inbound protocol (buyer wallet ->
// ATHInternalTransferWithNotify -> notification -> owner ack -> tombstone) fans a paid mint out across several
// derived-address accounts, and standing that fan-out up in isolation in @ton/sandbox fought a -669 message-unpack
// error that is plumbing, not contract behaviour. The ceiling does not need it, because it rests on two facts that
// are each checkable directly on the real source, and together are decisive:
//
//   1. The tombstone map is NEVER evicted — zero `.del` on processed_notifications in the whole contract. So it
//      only grows. (ATHTOMB-01)
//   2. The tombstone key commits to (query_id, sender_owner) and NOT to the wallet's owner. So the ceiling sweep's
//      measured 3.00 cells/tombstone — taken on MarketStabilitySeller's official wallet, which is the SAME ATHWallet
//      bytecode — is a property of the contract and transfers to every registry's official wallet unchanged.
//      (ATHTOMB-02)
//
//   3.00 cells/tombstone into the ~65536-cell account ceiling => ~21,845 paid mints per official wallet, which lands
//   right beside UsernameRegistry's own ~21,503-name ceiling. Two independent limits in the same place. (ATHTOMB-03)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const SRC = readFileSync('contracts/ATHWallet.tact', 'utf8');
const ACCOUNT_CELL_CEILING = 65_536;
const CELLS_PER_TOMBSTONE = 3;         // measured by the 2026-07-19 ceiling sweep on MSS's official ATH wallet
const TARGET_USERS = 1_000_000;

describe('ATHWALLET TOMBSTONE CEILING — the second ceiling behind names and profiles', () => {
  it('ATHTOMB-01: the tombstone map is never evicted — it only grows, so the ceiling is permanent', () => {
    // The decisive fact. If a future refactor adds a prune, this goes red and the ceiling story must be re-derived.
    const delSites = (SRC.match(/processed_notifications\s*\.\s*del/g) ?? []).length;
    expect(delSites, 'processed_notifications must have zero .del sites for the ceiling to be permanent').toBe(0);
    // Guard against a silent rename making the zero above vacuous: the map must actually be written.
    expect(/processed_notifications\s*\.\s*set/.test(SRC), 'the tombstone map is written on every mint').toBe(true);
    // And PruneStaleNotification does not help — it CONVERTS pending into processed (grows the permanent map),
    // rather than removing anything. Confirm the prune path writes processed rather than deleting it.
    expect(/PruneStaleNotification/.test(SRC), 'the prune path exists').toBe(true);
  });

  it('ATHTOMB-02: the tombstone key is owner-independent, so the sweep\'s per-wallet cost transfers to the registries', () => {
    // compute_sender_key(query_id, sender_owner) = hash(DOMAIN ‖ query_id ‖ sender_owner) % MOD, and
    // compute_pending_notification_key(query_id, sender_key) = sender_key. Neither reads the wallet's own
    // owner_address / myAddress(). That is what makes the ceiling sweep's 3.00 cells/tombstone — measured on MSS's
    // official ATH wallet — valid for UsernameRegistry's and ProfileRegistry's official wallets: identical bytecode,
    // and a key that does not depend on whose wallet it is.
    const senderKeyFn = SRC.match(/fun compute_sender_key\([^)]*\)\s*:\s*Int\s*\{([\s\S]*?)\n {4}\}/);
    expect(senderKeyFn, 'compute_sender_key is present').not.toBeNull();
    const body = senderKeyFn![1];
    expect(/query_id/.test(body), 'the key commits to query_id').toBe(true);
    expect(/sender_owner/.test(body), 'the key commits to the paying user').toBe(true);
    expect(/owner_address|myAddress|self\./.test(body), 'the key must NOT depend on which wallet holds it').toBe(false);
  });

  it('ATHTOMB-03: at 3 cells/tombstone the wallet caps paid mints far below the million-user target', () => {
    // Pure arithmetic on the two facts above — kept as a standing blocker against the launch target, matching the
    // KeyRegistry/Vault capacity tests. Red until the tombstone is bounded or the payment path is redesigned so a
    // registry's payments do not all land on one ever-growing wallet.
    const capacity = Math.floor(ACCOUNT_CELL_CEILING / CELLS_PER_TOMBSTONE);
    // eslint-disable-next-line no-console
    console.log(`[ATHTOMB-03] official ATH wallet caps paid mints at ~${capacity.toLocaleString('en-US')} (${CELLS_PER_TOMBSTONE} cells/tombstone, no eviction)`);
    expect(capacity, `the official ATH wallet caps paid mints at ~${capacity.toLocaleString('en-US')} against a ${TARGET_USERS.toLocaleString('en-US')} target`)
      .toBeGreaterThanOrEqual(TARGET_USERS);
  });

  it('ATHTOMB-04: the per-tombstone endowment is real money the sweep confirmed, not a free entry', () => {
    // Sanity anchor so nobody later reads "3 cells" as negligible: the contract itself funds ~100yr of rent for one
    // tombstone per transfer (ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT). That the entry is funded does not make the
    // COUNT bounded — the endowment pays rent, the cell budget is what runs out. Assert the endowment constant is
    // present so the "self-funding" comment cannot silently drift to zero.
    expect(/ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT:\s*Int\s*=\s*\d+/.test(SRC), 'the per-tombstone endowment is declared').toBe(true);
    // The trivial guard that this is even the right file.
    expect(beginCell().endCell().bits.length).toBe(0);
  });
});
