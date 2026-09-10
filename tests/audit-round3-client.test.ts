import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AUDIT WEEK, ROUND 3 — the client fixes that are lines a refactor can drop without a behaviour test noticing
// [audit 2026-09-06, round 3]. Each gate names the defect it closes; the reasoning lives beside the code.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const between = (text: string, start: string, end: string) => {
  const a = text.indexOf(start);
  expect(a, `anchor present: ${start}`).toBeGreaterThan(-1);
  const b = text.indexOf(end, a + start.length);
  expect(b, `end anchor present after ${start}: ${end}`).toBeGreaterThan(a);
  return text.slice(a, b);
};
const fn = (name: string) => between(app, `${name}(`, '\n}\n');

describe('AUDIT ROUND 3 — the client', () => {
  it('AR3-01: a deploy in flight is not absent — the assumed snapshot is stamped, trusted for the hop, and an absent read inside it is dropped', () => {
    expect(app).toContain('const VAULT_DEPLOY_SETTLE_MS = 120_000;');
    const note = fn('function noteFeeVaultDeployed');
    expect(note).toContain("snapshot: { ...vaultSnapshot(null, { nowSec: Math.floor(Date.now() / 1000) }), state: VAULT_LIVE, assumed: true, assumedAt: Date.now() },");
    const outdated = fn('function vaultSnapshotOutdated');
    expect(outdated).toContain('if (snapshot.assumed === true) return Date.now() - Number(snapshot.assumedAt ?? 0) > VAULT_DEPLOY_SETTLE_MS;');
    expect(outdated, 'absent ages too — a stake on another device created the vault').toContain('if (snapshot.state !== VAULT_LIVE && snapshot.state !== VAULT_ABSENT) return false;');
    const refresh = between(app, 'async function refreshFeeVaultState() {', 'function renderFeeDiscountRows() {');
    expect(refresh).toContain("if (view === null && feeVaultState.wallet === wallet && feeVaultState.snapshot?.assumed === true");
    expect(refresh).toContain('&& Date.now() - Number(feeVaultState.snapshot.assumedAt ?? 0) < VAULT_DEPLOY_SETTLE_MS) {');
  });

  it('AR3-02: a live vault below its rent float is topped up like a deploy — by the stake plan and by the private funnel', () => {
    const vault = src('web/vault-account.mjs');
    expect(vault).toContain('const lowFloat = state === VAULT_LIVE && BigInt(snapshot?.balance ?? 0n) < FV_RENT_FLOAT;');
    expect(vault).toContain('if (state !== VAULT_LIVE || lowFloat) {');
    expect(vault).toContain('return { ok: true, reason: verdict.reason, verdict, messages, deploys: state !== VAULT_LIVE || lowFloat, topsUp: lowFloat };');
    const routing = fn('async function convVaultRouting');
    expect(routing).toContain("|| (snapshot?.state === VAULT_LIVE && snapshot.assumed !== true && BigInt(snapshot.balance ?? 0n) < FV_RENT_FLOAT),");
    expect(app).toContain("import { FV_DEPLOY_FUNDING, FV_PROTOCOL_FEE, FV_RENT_FLOAT, buildVaultDeployMessage, vaultTakeFor } from './fee-vault.mjs");
  });

  it('AR3-03: the moderation client — every kind labelled, no hide door offered for a picture, a full sanction shard said before signing, the queue sweeps the shard\'s whole life', () => {
    const label = fn('function moderationRowLabel');
    expect(label).toContain("row.target.kind === 2 ? t('moderation.kindChannel')");
    expect(label).toContain("row.target.kind === 3 ? t('moderation.kindAvatar')");
    const queue = between(app, 'function renderModerationQueue() {', '\nfunction ');
    expect(queue).toContain('const canHide = row.target.generation >= MODERATION_GENERATION && row.target.kind !== 3;');
    expect(queue).toContain("t(row.target.kind === 3 ? 'moderation.cannotHideAvatar' : 'moderation.cannotHideOld')");
    const wallet = fn('async function sendWalletVerdict');
    expect(wallet).toContain('if (!standing.exists && (action === VERDICT_ACTION.WARN_WALLET || action === VERDICT_ACTION.RESTRICT_WALLET)) {');
    expect(wallet).toContain("if (room.live && room.safeCap > 0 && room.count >= room.safeCap) { showModerationStatus(t('moderation.sanctionShardFull'), { ttlMs: 15_000 }); return; }");
    expect(src('web/moderation.mjs')).toContain('export async function sanctionShardRoom(runGetMethod, shardAddress) {');
    expect(app).toContain('...(await sweep(era - 3)), ...(await sweep(era - 4))]');
  });

  it('AR3-04: the hidden index and the catalogue — a page walk under a moving index is not complete, and a delisted publisher stays delisted on every seq', () => {
    const provider = src('web/public-shard-ton-rpc-provider.mjs');
    const pager = between(provider, 'async getHiddenIds(shardAddress, { maxPages = 16, callOptions = {} } = {}) {', 'async getPage(');
    expect(pager).toContain('else if (count !== firstCount) drifted = true;');
    expect(pager).toContain('return { count, hidden, complete: !drifted && hidden.size >= count };');
    const lane = src('web/public-lane.mjs');
    const sweep = between(lane, 'async sweepChannelCatalog(', 'async readChannelPosts(');
    expect(sweep).toContain('const delisted = new Set();');
    expect(sweep).toContain('if (post.hidden === true) { delisted.add(wallet); byWallet.delete(wallet); continue; }');
    expect(sweep).toContain('if (delisted.has(wallet)) continue;');
  });

  it('AR3-05: group rows reach the encrypted history, one pass runs at a time, a token card copies its caption, an unreadable stored room is said', () => {
    const apply = fn('function applyGroupMessagesToThread');
    expect(apply).toContain("persistMessageToEncryptedHistory(thread, message).catch((error) => console.warn('[groups] history', error));");
    expect(apply).toContain("updateMessageInEncryptedHistory(thread, held).catch((error) => console.warn('[groups] history', error));");
    expect(fn('async function sendGroupMessageFromComposer')).toContain('persistMessageToEncryptedHistory(thread, echo)');
    const serialize = fn('function serializeMessageForHistory');
    expect(serialize).toContain('groupChainKey: message.groupChainKey ?? null,');
    expect(serialize).toContain('groupSentAtMs: message.groupSentAtMs ?? null,');
    expect(app).toContain('let groupSyncInFlight = false;');
    expect(fn('async function syncGroupsFromChain')).toContain('if (groupSyncInFlight) return [];');
    expect(fn('async function syncGroupsFromChainUnguarded')).toContain("flashWalletIdentityStatus(t('group.controlNotDelivered'));");
    const copy = fn('function copyTextFromContent');
    expect(copy.indexOf('const tokenPreview = groupTokenPreviewText(item);')).toBeLessThan(copy.indexOf('const blocks = Array.isArray(item?.blocks)'));
    expect(app).toContain("onUnreadable: (id) => console.warn('[groups] a stored room cannot be opened under this device key', id),");
  });

  it('AR3-06: money paths — fresh market reads where the price decides, the activation marker lives as long as the external, a wallet change forgets its presses, the float dialog says why it waits', () => {
    expect(app).toContain('async function refreshMarketStabilityState({ fresh = false } = {}) {');
    expect(app).toContain('transport.runGetMethod(fresh ? { ...call, cacheTtlMs: 0 } : call)');
    expect(fn('async function awaitMarketStabilityIdle')).toContain('await refreshMarketStabilityState({ fresh: true });');
    expect(between(app, 'async function openBuyAthDialog() {', 'async function submitBuyAth(')).toContain('await refreshMarketStabilityState({ fresh: true });');
    expect(app).toContain('const releaseDelayMs = PLATHO_ACTIVATION_IN_FLIGHT_TTL_MS + 5_000;');
    expect(fn('function resetReactionRuntimeState')).toContain('reactionsInFlight.clear(); reactionsUnsettled.clear(); reactionCounts.clear(); reactionReadAt.clear();');
    expect(fn('function clearWalletScopedRuntimeState')).toContain('try { resetReactionRuntimeState(); } catch {');
    expect(fn('async function openVaultFloatDialog')).toContain("if (feeVaultStakeInFlight) { setText(vaultFloatStatus, t('profile.stakeSending')); return; }");
  });

  it('AR3-07: the new strings exist in every locale', () => {
    for (const key of ['group.controlNotDelivered', 'moderation.kindChannel', 'moderation.kindAvatar', 'moderation.cannotHideAvatar', 'moderation.sanctionShardFull']) {
      for (const locale of Object.keys(I18N_STRINGS)) {
        expect(typeof (I18N_STRINGS as any)[locale]?.[key], `${locale} ${key}`).toBe('string');
      }
    }
  });
});
