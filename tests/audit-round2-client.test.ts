import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AUDIT WEEK, ROUND 2 — the client fixes that are lines a refactor can drop without a behaviour test noticing
// [audit 2026-09-05, round 2]. Each gate names the defect it closes; the reasoning lives beside the code.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const between = (start: string, end: string) => {
  const a = app.indexOf(start);
  expect(a, `anchor present: ${start}`).toBeGreaterThan(-1);
  const b = app.indexOf(end, a + start.length);
  expect(b, `end anchor present after ${start}: ${end}`).toBeGreaterThan(a);
  return app.slice(a, b);
};
const fn = (name: string) => between(`${name}(`, '\n}\n');

describe('AUDIT ROUND 2 — the client', () => {
  it('AR2-01: a throw that carries the signed external is never reported as "failed" on a lane that moves money and has no confirm of its own', () => {
    expect(app).toContain('function broadcastMayHaveLanded(error) {');
    // round 3: the predicate reads the door's chain verdict and whether the wait watched the chain
    expect(app).toContain("if (error.broadcastVerdict === 'rejected' && error.tonRpcPriorDeliveryAmbiguous !== true) return false;");
    expect(app).toContain("if (error.walletExternalExpired === true && error.seqnoReadFailed !== true) return false;");
    // GRAM transfer: submitted, the bytes kept, no second signature invited
    const gram = fn('async function submitWalletTonTransfer');
    expect(gram).toContain('if (!broadcastMayHaveLanded(error)) throw error;');
    expect(gram).toContain("ambiguous: true, boc: error.builtBoc, seqno: error.builtSeqno ?? null");
    // buy ATH: sent, and the ladder reads the balance back
    const buy = between('async function submitBuyAth(amountAtomic, quotedMultiplier = null) {', 'async function refreshAthProtocolStatsRun()');
    expect(buy.indexOf('if (broadcastMayHaveLanded(error)) {')).toBeLessThan(buy.indexOf("setText(buyAthStatus, t('profile.buyAthFailed'));"));
    // the stake family: every catch consults it before "failed"
    for (const name of ['async function submitStakeAth', 'async function submitUnstakeAth', 'async function submitRecoverAth', 'async function openVaultFloatDialog', 'async function openUnstakeAthDialog']) {
      const body = fn(name);
      expect(body.indexOf('broadcastMayHaveLanded(error)'), `${name} consults the predicate`).toBeGreaterThan(-1);
      expect(body.indexOf('broadcastMayHaveLanded(error)'), `${name}: before it says failed`).toBeLessThan(body.indexOf("t('profile.stakeFailed')"));
    }
    // reactions and reports: an ambiguous send is handed to the confirm, not to the failure path
    expect(fn('async function reactTo')).toContain('if (!broadcastMayHaveLanded(error)) throw error;');
    expect(fn('async function submitReport')).toContain('if (!broadcastMayHaveLanded(error)) throw error;');
    // activation: the marker is written with the signed bytes instead of the button coming back
    const activation = between('async function submitKeyShardRegisterDirect(', 'async function submitVaultRegisterMessagingKeys(');
    expect(activation).toContain('rememberPlathoActivationInFlight(ownerWallet, error.builtBoc, error.builtSeqno ?? null);');
    expect(activation.indexOf('if (!broadcastMayHaveLanded(error)) throw error;')).toBeLessThan(activation.indexOf('forcePlathoActivationDelivery();'));
  });

  it('AR2-02: the buy pays the price the user confirmed, at a balance checked against the fresh multiplier', () => {
    expect(app).toContain('await submitBuyAth(amountAtomic, state.currentMultiplier);');
    const buy = between('async function submitBuyAth(amountAtomic, quotedMultiplier = null) {', 'async function refreshAthProtocolStatsRun()');
    expect(buy).toContain('if (quotedMultiplier !== null && Number(ready.currentMultiplier) !== Number(quotedMultiplier)) {');
    expect(buy).toContain("setText(buyAthStatus, t('profile.buyAthPriceChanged'));");
    expect(buy).toContain('const total = buyValueNanotons(amountAtomic, ready.currentMultiplier);');
    expect(buy.indexOf("await assertWalletGramAtLeast(total + walletSendFeeReserveNanotons(), 'buy');")).toBeLessThan(buy.indexOf('await publishMarketStabilityBuy({'));
  });

  it('AR2-03: one report in flight per target — the shard keeps no per-reporter dedup, so a second press paid twice', () => {
    expect(app).toContain('const reportsInFlight = new Set();');
    const report = fn('async function submitReport');
    expect(report).toContain("if (reportsInFlight.has(reportFlightKey(target))) { showModerationStatus(t('moderation.sending'), { ttlMs: 6000 }); return; }");
    expect(report).toContain('reportsInFlight.add(flight);');
    expect(report).toMatch(/\} finally \{\s*\n\s*if \(flight\) reportsInFlight\.delete\(flight\);/);
  });

  it('AR2-04: the vault snapshot ages — routing re-reads past ten minutes, and the public routing awaits the read', () => {
    expect(app).toContain('const VAULT_SNAPSHOT_MAX_AGE_S = 600;');
    const outdated = fn('function vaultSnapshotOutdated');
    expect(outdated).toContain('return Math.floor(Date.now() / 1000) - Number(snapshot.nowSec ?? 0) > VAULT_SNAPSHOT_MAX_AGE_S;');
    const routing = between('async function publicPublishRouting() {', 'async function convVaultRouting() {');
    expect(routing).toContain('if (vaultSnapshotOutdated()) { try { await refreshFeeVaultState(); }');
    expect(routing).toContain('if (snapshot.stale || snapshot.assumed) return {};');
    expect(fn('async function convVaultRouting')).toContain('|| vaultSnapshotOutdated()) {');
    // every public send awaits the routing, so a stale snapshot is read before the door is chosen
    expect(app.match(/\.\.\.\(await publicPublishRouting\(\)\) \}/g)?.length).toBe(4);
    expect(app).not.toContain('...publicPublishRouting() }');
  });

  it('AR2-05: the stake surface — a guessed snapshot does not open a dialog, the deploy it carries is noted, the one-time funding is named, the float row reads first', () => {
    const stake = between('async function openStakeAthDialog() {', 'function vaultPlanRefusalText(plan) {');
    expect(stake).toContain('if (snapshot?.state === VAULT_UNKNOWN || !snapshot || snapshot.stale || snapshot.assumed) {');
    // round 3: the row also shows for a live vault below its rent float (a stranger's under-funded deploy gets topped up)
    expect(stake).toContain("...((snapshot?.state !== VAULT_LIVE || BigInt(snapshot.balance ?? 0n) < FV_RENT_FLOAT)");
    expect(stake).toContain("? [{ label: t('profile.stakeSummarySetup'), value: `${formatGramNanotons(FV_DEPLOY_FUNDING)} GRAM` }] : []),");
    expect(fn('async function openUnstakeAthDialog')).toContain("if (snapshot.stale || snapshot.assumed) { setText(unstakeAthStatus, t('profile.statusChecking')); return; }");
    const submit = fn('async function submitStakeAth');
    expect(submit).toContain('if (plan.deploys) noteFeeVaultDeployed(owner, vaultAddress);');
    expect(submit).toContain('if (plan?.deploys && owner && vaultAddress) noteFeeVaultDeployed(owner, vaultAddress);');
    const float = fn('async function openVaultFloatDialog');
    expect(float.indexOf('await refreshFeeVaultState();')).toBeLessThan(float.indexOf('const plan = planWithdrawFloat('));
    expect(readFileSync(new URL('../web/vault-account.mjs', import.meta.url), 'utf8')).toContain('return { ok: true, reason: verdict.reason, verdict, messages, deploys: state !== VAULT_LIVE || lowFloat, topsUp: lowFloat };');   // round 3: a live vault below its float is topped up too
  });

  it('AR2-06: green means the chain on the self lanes — fresh seq reads, and the slot\'s seq as the receipt before anything says saved', () => {
    const fresh = "createRecoveryViewReader((call) => transport.runGetMethod({ ...call, cacheTtlMs: 0, priority: 'critical' }))";
    const prefs = between('async function submitPrefsSnapshotDirect() {', 'async function publishPrefsSnapshot() {');
    expect(prefs).toContain(fresh);
    expect(prefs.indexOf('await confirmRecoverySlotWrite({ readView, address: built.to, seq: built.seq, h1: built.h1 ?? null })')).toBeLessThan(prefs.indexOf('setPrefsLastSyncedAt(snapshot.writtenAt);'));
    expect(prefs).toContain("setText(savePrefsStatus, t('sync.notConfirmed'));");
    const backup = between('async function runRecoveryBackupUnguarded() {', '// W1-009 freeze-prevention sweep');
    expect(backup).toContain(fresh);
    // round 3: every slot of the run is sent first and confirmed in ONE ladder, content-matched by h1; one run at a time
    expect(backup).toContain("sent.push({ slot, address: built.to, seq: built.seq, h1: built.h1 ?? null });");
    expect(backup.indexOf('const receipt = await confirmRecoverySlotWrites({ readView, writes: sent });')).toBeLessThan(backup.lastIndexOf('convRecoveryDirtySlots.delete(write.slot);'));
    expect(app).toContain('if (recoveryBackupInFlight) { recoveryBackupRearm = true; return; }');
    const notes = between('async function publishSelfNotesSnapshotForThread(thread) {', '/** The note list a thread carries');
    expect(notes).toContain(fresh);
    // round 3: the receipt leaves the outgoing lane — the writes (with their h1) go back to the caller, which arms it
    expect(notes).toContain("writes: built.publishes.map((publish) => ({ address: publish.to, seq: publish.seq, h1: publish.h1 ?? null })),");
    expect(notes).not.toContain('await confirmRecoverySlotWrites(');
    const armed = fn('function armSelfNoteReceipt');
    expect(armed).toContain("error.code = 'PLATHO_NOTES_NOT_CONFIRMED';");
    expect(armed).toContain('return settlePrivateComposerSendError(context, error);');
    expect(fn('async function publishSelfNoteSnapshot')).toContain('armSelfNoteReceipt(context, outcome);');
    expect(fn('function isRecoverablePrivateSendError')).toContain("if (error?.code === 'PLATHO_NOTES_NOT_CONFIRMED') return true;");
    // the three lanes hand an ambiguous throw to the receipt as well
    for (const [name, slice] of [['prefs', prefs], ['backup', backup], ['notes', notes]] as const) {
      expect(slice, `${name}: ambiguous broadcast goes to the receipt`).toContain('if (!broadcastMayHaveLanded(error)) throw error;');
    }
  });

  it('AR2-07: the new strings exist in every locale', () => {
    for (const key of ['profile.buyAthPriceChanged', 'profile.stakeSummarySetup', 'sync.notConfirmed']) {
      for (const locale of Object.keys(I18N_STRINGS)) {
        expect(typeof (I18N_STRINGS as any)[locale]?.[key], `${locale} ${key}`).toBe('string');
      }
    }
  });
});
