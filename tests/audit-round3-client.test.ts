import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


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
    expect(note).toContain("snapshot: { ...vaultSnapshot(null, vaultClock()), state: VAULT_LIVE, assumed: true, assumedAt: Date.now(), assumedFrom: from },");
    const outdated = fn('function vaultSnapshotOutdated');
    expect(outdated).toContain('if (snapshot.assumed === true) return Date.now() - Number(snapshot.assumedAt ?? 0) > VAULT_DEPLOY_SETTLE_MS;');
    expect(outdated, 'absent ages too — a stake on another device created the vault').toContain('if (snapshot.state !== VAULT_LIVE && snapshot.state !== VAULT_ABSENT && snapshot.state !== VAULT_FROZEN) return false;');
    const refresh = between(app, 'async function refreshFeeVaultState({ critical = false } = {}) {', 'function renderFeeDiscountRows() {');
    expect(refresh).toContain("if (view === null && feeVaultState.wallet === wallet && feeVaultState.snapshot?.assumed === true");
    expect(refresh).toContain('&& Date.now() - Number(feeVaultState.snapshot.assumedAt ?? 0) < VAULT_DEPLOY_SETTLE_MS) {');
  });

  it('AR3-02: a live vault below its rent float is topped up like a deploy — by the stake plan and by the private funnel', () => {
    const vault = src('web/vault-account.mjs');
    expect(vault).toContain('const lowFloat = state === VAULT_LIVE && BigInt(snapshot?.balance ?? 0n) < FV_FLOAT_TOPUP_BELOW;');
    expect(vault).toContain('if (state !== VAULT_LIVE || lowFloat) {');
    expect(vault).toContain('return { ok: true, reason: verdict.reason, verdict, messages, deploys: state !== VAULT_LIVE || lowFloat,');
    expect(vault).toContain('topsUp: lowFloat, fundsCustody: Boolean(custodyLow),');
    const routing = fn('async function convVaultRouting');
    expect(routing).toContain("|| (snap?.state === VAULT_LIVE && snap.assumed !== true && BigInt(snap.balance ?? 0n) < FV_FLOAT_TOPUP_BELOW);");
    expect(routing).toContain('deployVault = !carried && wantsDeploy(after);');
    const feeVaultImport = app.match(/import \{([^}]*)\} from '\.\/fee-vault\.mjs/)?.[1] ?? '';
    for (const name of ['FV_DEPLOY_FUNDING', 'FV_PROTOCOL_FEE', 'FV_FLOAT_TOPUP_BELOW', 'buildVaultDeployMessage', 'vaultTakeFor']) {
      expect(feeVaultImport.split(',').map((part) => part.trim()), name).toContain(name);
    }
  });

  it('AR3-03: the moderation client — every kind labelled, no hide door offered for a picture, the wallet\'s standing read fresh before signing, the queue sweeps the shard\'s whole life', () => {
    const label = fn('function moderationKindLabel');
    expect(fn('function moderationRowLabel')).toContain('const kindLabel = moderationKindLabel(row.target.kind);');
    expect(label).toContain("kind === 2 ? t('moderation.kindChannel')");
    expect(label).toContain("kind === 3 ? t('moderation.kindAvatar')");
    expect(label, 'no ACCOUNT label').not.toContain('kindAccount');
    expect(app, 'and no wallet-report builder anywhere in the app').not.toContain('REPORT_KIND_WALLET');
    const queue = between(app, 'function moderationCardNode(row, eager) {', '\nfunction ') + between(app, 'function renderModerationQueue() {', '\nfunction ');
    expect(queue + app.slice(app.indexOf('function moderationCardNode(row, eager) {'), app.indexOf('function renderModerationQueue() {'))).toContain('const canHide = row.target.generation >= MODERATION_GENERATION && row.target.kind !== 3;');
    expect(fn('async function sendWalletVerdict')).toContain('const publisher = (await moderationEntryOf(row))?.publisher;');
    expect(queue).toContain("t(row.target.kind === 3 ? 'moderation.cannotHideAvatar' : 'moderation.cannotHideOld');");
    const wallet = fn('async function sendWalletVerdict');
    expect(fn('async function moderationWalletStanding')).toContain("const fold = await runtime.sanctions.lookup([wallet], { force: true, requestClass: 'focus' });");
    expect(wallet).toContain("|| (action === VERDICT_ACTION.UNWARN_WALLET && standing.warnings === 0)) { showModerationStatus(t('moderation.alreadySo')); return; }");
    expect(wallet).not.toContain('action === VERDICT_ACTION.RESTRICT_WALLET && standing.restricted');
    expect(fn('async function moderationWalletStanding')).toContain("if (!standing || !(Number(fold?.read) > 0)) throw new Error(t('moderation.standingUnreadable'));");
    expect(wallet).toContain('const extra = await shardArrearOf(shardAddress, LANE_SANCTION, { strict: true });');
    expect(wallet).toContain("if (extra === null) { showModerationStatus(t('moderation.arrearUnreadable'), { ttlMs: 12_000 }); return; }");
    expect(src('web/moderation.mjs')).not.toContain('sanctionShardRoom');
    expect(src('web/moderation.mjs'), 'no getter is called for a standing any more').not.toMatch(/'get_many'|'get_wallet'/);
    expect(app).toContain('for (let back = 0; back < 5; back += 1) {\n      const rows = await sweep(era - back);');
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
    expect(apply).toContain('writes?.push(writeGroupRowToHistory(thread, message));');
    const write = fn('function writeGroupRowToHistory');
    expect(write).toContain('return persistMessageToEncryptedHistory(thread, message)');
    expect(write).toContain(".catch((error) => { console.warn('[groups] history', error); return false; })");
    expect(apply).toContain("updateMessageInEncryptedHistory(thread, held).catch((error) => console.warn('[groups] history', error));");
    expect(fn('async function sendGroupMessageFromComposer')).toContain('persistMessageToEncryptedHistory(thread, echo)');
    const serialize = fn('function serializeMessageForHistory');
    expect(serialize).toContain('groupChainKey: message.groupChainKey ?? null,');
    expect(serialize).toContain('groupSentAtMs: message.groupSentAtMs ?? null,');
    expect(app).toContain('let groupSyncInFlight = false;');
    expect(fn('async function syncGroupsFromChain')).toContain('if (groupSyncInFlight) return [];');
    expect(fn('async function deliverPrivateGroupPass')).toContain("flashWalletIdentityStatus(t('group.controlNotDelivered'));");
    const copy = fn('function copyTextFromContent');
    expect(copy.indexOf('const tokenPreview = groupTokenPreviewText(item);')).toBeLessThan(copy.indexOf('const blocks = Array.isArray(item?.blocks)'));
    expect(app).toContain("onUnreadable: (id) => console.warn('[groups] a stored room cannot be opened under this wallet\\'s key', id),");
  });

  it('AR3-09: a group token is recognised in both shapes, the echo and the chain copy', () => {
    const body = fn('function groupTokenTextOf') + '}';
    const tokenTextOf = new Function(body + '; return groupTokenTextOf;')() as (message: unknown) => string;
    const TOKEN = 'platho.group.invite.v1:abc';
    expect(tokenTextOf({ text: TOKEN }), 'the echo keeps it in text').toBe(TOKEN);
    expect(tokenTextOf({ blocks: [{ type: 'text', text: TOKEN }] }), 'the chain copy is a lone text block').toBe(TOKEN);
    expect(tokenTextOf({ blocks: [{ type: 'reply' }, { type: 'text', text: TOKEN }] }), 'a reply quote is not content').toBe(TOKEN);
    expect(tokenTextOf({ text: TOKEN, blocks: [{ type: 'text', text: TOKEN }, { type: 'image', url: 'u' }] }), 'a token beside a picture keeps the picture').toBe('');
    expect(fn('function groupTokenPreviewText')).toContain('const text = groupTokenTextOf(message);');
    expect(app.split('} else if (blocks.length > 0 || message.text) {'), 'one block branch, or this ordering check is blind').toHaveLength(2);
    expect(app.indexOf('const tokenText = groupTokenTextOf(message);'), 'the bubble asks about the token BEFORE the blocks')
      .toBeLessThan(app.indexOf('} else if (blocks.length > 0 || message.text) {'));
    const refresh = fn('function refreshThreadAfterMessageChange')
      .split(String.fromCharCode(10)).map((line) => line.replace(/\/\/.*$/, '')).join(String.fromCharCode(10));
    expect(refresh).toContain("thread.preview = last ? messagePreviewLine(last) : t('chat.previewNoMessages');");
    const line = fn('function messagePreviewLine');
    expect(line.indexOf('groupTokenPreviewText(message)'), 'the token is asked at all').toBeGreaterThan(-1);
    expect(line.indexOf('groupTokenPreviewText(message)'), 'the row asks about the token BEFORE the blocks')
      .toBeLessThan(line.indexOf('messagePreviewFromBlocks(message.blocks)'));
  });


  it('AR3-10: a room is not re-fetched for what the device already holds', () => {
    expect(fn('async function bootWalletScopedLocalStores')).toContain('await hydrateGroupThreadsFromStore();');
    const hydrate = fn('async function hydrateGroupThreadsFromStore');
    const hydrateCode = hydrate.split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    expect(hydrateCode, 'the boot path must not wait on the messaging identity').not.toContain('ensureGroupRuntime');
    expect(hydrate).toContain('await createGroupRecordStore({');
    expect(hydrate).toContain('ensureGroupThread(parseGroupRecord(row));');
    const boot = fn('async function bootWalletScopedLocalStores');
    expect(boot.indexOf('await bootEncryptedMessageHistory();'))
      .toBeLessThan(boot.indexOf('await hydrateGroupThreadsFromStore();'));
  });

  it('AR3-11: groupIdOfThread is never handed an id — it reads one', () => {
    expect(app.match(/groupIdOfThread\([^)]*\.id\)/g) ?? [],
      'a call site is handing groupIdOfThread an id where it wants the thread').toEqual([]);
    expect(fn('async function hydrateGroupAvatar')).toContain('runtime?.avatar(groupIdOfThread(thread))');
  });

  it('AR3-12: an invite asks for everybody at once', () => {
    const picker = fn('async function openGroupInvitePicker');
    expect(picker).toContain('const chosen = new Set();');
    expect(picker).toContain('if (chosen.has(thread)) { chosen.delete(thread); row.classList.remove(\'is-selected\'); }');
    expect(picker).toContain('setActiveActionSubmitEnabled(chosen.size > 0);');
    expect(picker).toContain('for (const thread of chosen) {');
    expect(picker).toContain('try { await inviteContactToGroup(groupId, thread, { pricedGeneration: invitePricedGeneration }); } catch (error) {');
  });

  it('AR3-13: a member is named the way this device names that wallet everywhere else', () => {
    expect(fn('function knownNameForWallet')).toContain('resolveWalletChannelDisplay(wallet)?.name ?? null');
    expect(fn('function groupMemberLabel')).toContain('return groupPersonLabel(member?.wallet ?? null, member?.name ?? null, key);');
    expect(fn('function groupPersonLabel')).toContain('const proven = knownNameForWallet(wallet);');
    expect(app).toContain('name.textContent = groupPersonLabel(member.wallet ?? null, member.name ?? null, key);');
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
    for (const key of ['group.controlNotDelivered', 'moderation.kindChannel', 'moderation.kindAvatar', 'moderation.cannotHideAvatar']) {
      for (const locale of Object.keys(I18N_STRINGS)) {
        expect(typeof (I18N_STRINGS as any)[locale]?.[key], `${locale} ${key}`).toBe('string');
      }
    }
  });

  it('AR3-08: round 9, the small items — the activation quote carries the shard arrear the send demands, the vault top-up line is half the float', () => {
    expect(app).toContain('let plathoActivationArrear = { wallet: null, nanotons: 0n };');
    expect(fn('function plathoAccountActivationFeeNanotons')).toContain('return KEYSHARD_REGISTER_VALUE + arrear + walletSendFeeReserveNanotons([KEYSHARD_REGISTER_SIZE_CLASS]);');
    const refresh = fn('async function refreshPlathoActivationArrear');
    expect(refresh).toContain('const verdict = await defaultShardDebtResolver()(keyShardRaw, LANE_KEY, chainNowSec());');
    expect(refresh, 'nothing is priced before the generation whose gate asks, and nothing for an account already active').toContain('if (WRITES_GENERATION >= 18 && wallet && !hasActivePlathoAccount()) {');
    expect(fn('function buildQuickStartActivateBody')).toContain('void refreshPlathoActivationArrear().then((changed) => { if (changed && generation0 === quickStartActivationGeneration) applyGate(); })');
    expect(fn('async function confirmPlathoAccountActivation')).toContain('await refreshPlathoActivationArrear();');
    expect(fn('function refreshMessagingControls')).toContain('void refreshPlathoActivationArrear().then((changed) => { if (changed) refreshMessagingControls(); })');
    expect(fn('function clearWalletScopedRuntimeState')).toContain('plathoActivationArrear = { wallet: null, nanotons: 0n };');
    expect(src('web/fee-vault.mjs')).toContain('export const FV_FLOAT_TOPUP_BELOW = FV_RENT_FLOAT / 2n;');
    expect(app).not.toContain('< FV_RENT_FLOAT)');
  });
});
