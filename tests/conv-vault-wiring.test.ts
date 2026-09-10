import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-VAULT-WIRING — the one door past the flip reaches the app [CUTOVER item 11, 2026-09-03].
//
// clean-18's RecordShard opens only to the payer's own FeeVault. The funnel (web/conv-lane-send.mjs,
// prepareConvLaneParts) routes by generation and is pinned in tests/conv-lane-send.test.ts (shapes) and
// contracts18/tests/conv-vault-door.test.ts (the real contracts). What this file holds is the last inch: that the
// app hands the funnel the three facts it cannot derive — the vault, the fee, whether to deploy — in the SAFE
// direction, and that a deploy just sent is remembered so the next message does not deploy again.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const between = (from: string, to: string) => {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start);
  expect(start, `anchor present: ${from}`).toBeGreaterThan(-1);
  expect(end, `anchor present after it: ${to}`).toBeGreaterThan(start);
  return app.slice(start, end);
};

describe('CONV-VAULT-WIRING — the app hands the funnel the vault, the fee and the deploy decision', () => {
  it('CVW-01: convVaultRouting derives the vault from the SIGNING wallet, charges the full fee unless the read is fresh, deploys only an account the chain says is absent', () => {
    const fn = between('async function convVaultRouting()', 'function noteFeeVaultDeployed(');
    expect(fn).toContain('if (!vaultSupported() || !plathoWallet?.address) return {};');
    expect(fn).toContain('let mine = feeVaultState.wallet === plathoWallet.address ? feeVaultState : null;');   // re-read below when the state is not yet known [audit 2026-09-05]
    expect(fn).toContain('const fresh = snapshot?.state === VAULT_LIVE && !snapshot.stale && !snapshot.assumed;');
    expect(fn).toContain('vaultAddress: mine?.address ?? await vaultAddressFor(plathoWallet.address)');
    expect(fn).toContain('feeDue: fresh ? snapshot.feeDue : FV_PROTOCOL_FEE');
    expect(fn).toContain('deployVault: snapshot?.state === VAULT_ABSENT');   // only an account the chain says is missing [audit 2026-09-05]
  });

  it('CVW-02: the CONV send routes through it, remembers a deploy, and tells the funnel what it knows about the shard', () => {
    const send = between('const routing = await convVaultRouting();', 'globalThis.plathoLastConvSend = {');
    expect(send).toContain('publishConvLaneParts({ wallet: plathoWallet, transport, ...routing }, parts,');
    expect(send).toContain("assertAffordable: (extra) => assertWalletGramAtLeast(convNeed + extra, 'send')");
    expect(send).toContain('if (result?.deploy) noteFeeVaultDeployed(plathoWallet?.address, routing.vaultAddress);');
    expect(app).toContain('const shardLive = Math.max(coldFloor, convBucketSeqHighWater(route.address)) > 0;');
    expect(app).toContain('value: CONV_PUBLISH_VALUE, shardLive });');
  });

  it('CVW-03: a vault ASSUMED after a deploy is remembered as live at the full fee, and never routes a PUBLIC post through the discount door', () => {
    const note = between('function noteFeeVaultDeployed(', 'async function refreshFeeVaultState');
    expect(note).toContain('if (!wallet || plathoWallet?.address !== wallet) return;');
    // round 3: stamped, so an absent read inside the deploy's hop is dropped instead of undoing the note
    expect(note).toContain("snapshot: { ...vaultSnapshot(null, { nowSec: Math.floor(Date.now() / 1000) }), state: VAULT_LIVE, assumed: true, assumedAt: Date.now() },");
    const publicRouting = between('async function publicPublishRouting()', 'async function convVaultRouting()');
    expect(publicRouting).toContain('if (snapshot.stale || snapshot.assumed) return {};');
  });
});
