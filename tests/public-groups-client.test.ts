import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock as block } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { PUBLIC_GROUP_KIND, encodePublicGroupControl, decodePublicGroupControl } from '../web/public-group-protocol.mjs';

const APP = code(readFileSync('web/app.js', 'utf8'));
const RAW = readFileSync('web/app.js', 'utf8');


describe('PUBLIC GROUPS — the client dispatch', () => {
  it('PGC-01: a group is public or private at birth — the door decides, and the dialog routes by it', () => {
    const create = code(block(RAW, 'async function openCreateGroupDialog('));
    expect(create).toContain("async function openCreateGroupDialog(kind = 'private') {");
    expect(create).toContain("const wantPublic = kind === 'public';");
    expect(create, 'only the runtime of that kind, so a wallet without private keys can still found a public group')
      .toContain('const publicRuntime = wantPublic ? await ensurePublicGroupRuntime() : null;');
    expect(create, 'no question inside the dialog').not.toContain("type: 'radio',");
    expect(create, 'the kind is final, said in the hint').toContain("hint: () => joinHintSentences(t(wantPublic ? 'group.publicHint' : 'group.privateHint'), t('group.kindHint'), foundPrice()),");
    expect(create).toContain("publicGroupControlPriceLine(PUBLIC_GROUP_KIND.FOUND, { name: '' }, null)");
    expect(create, 'and routed once').toContain('return { ok: true, result: { name: typed, record: await publicRuntime.create({ name: typed }) } };');
    expect(create).toContain('const record = result.record ?? (wantPublic ? null : await runtime.create({ name }));');
    expect(create, 'a lane with no runtime is refused with the same line the composer uses').toContain('if (wantPublic ? !publicRuntime : !runtime) {');
  });

  it('PGC-02: the composer sends a public room through the public runtime, keyed by the stream id it minted', () => {
    const send = code(block(RAW, 'async function sendGroupMessageFromComposer('));
    expect(send, 'the record decides the lane').toContain('const publicHeld = publicRuntime?.get(groupId) ?? null;');
    expect(send).toContain('const publicRecord = publicHeld && (!publicHeld.leftAt || !privateHeld) ? publicHeld : null;');
    expect(send).toContain('if (publicHeld && !publicHeld.leftAt && privateHeld && !privateHeld.leftAt) {');
    expect(send).toContain('const sent = await publicRuntime.say(groupId, text, { onSealed: stampEcho });');
    expect(send, 'the echo carries the key the pass will confirm').toContain('echo.groupChainKey = sent.key;');
    expect(send, 'and who wrote it, for the report door').toContain('echo.groupPublic = { senderWallet: rawWalletAddress(plathoWallet?.address), coords: null };');
    expect(send).toContain("const keyOf = ({ epoch, generation, firstSeq }, self) => `${epoch}.${generation}.${self ? [...self].map((b) => b.toString(16).padStart(2, '0')).join('') : 'self'}.${firstSeq}`;");
    expect(send).toContain('echo.groupChainKey = keyOf(sent, sent.record?.self);');
  });

  it('PGC-03: the pass runs both lanes, and the public fold hides what the chain or a ban hid', () => {
    const both = code(block(RAW, 'async function syncGroupsFromChainUnguarded('));
    expect(both).toContain('try { privatePasses = await syncPrivateGroupsFromChainUnguarded(); } catch (error) {');
    expect(both).toContain('try { publicPasses = await syncPublicGroupsFromChainUnguarded(); } catch (error) {');
    const fold = code(block(RAW, 'function applyPublicGroupMessagesToThread('));
    expect(fold, 'keyed by the stream id').toContain('const held = byKey.get(row.key);');
    expect(fold, 'one lookup table, filled from the thread once [round 5]').toContain('for (const message of thread.messages ?? []) if (message?.groupChainKey) byKey.set(message.groupChainKey, message);');
    expect(fold, 'one sort per pass, not one per row [round 5]').toContain('if (fresh.length > 0) { thread.messages.push(...fresh); sortThreadMessages(thread); }');
    expect(fold, 'no per-row sort survives').not.toContain('insertThreadMessage(thread, message);');
    expect(fold, 'a hidden row is taken off the screen').toContain('thread.messages = thread.messages.filter((message) => message !== held);');
    expect(fold, 'and out of the history').toContain('encryptedMessageStore.deleteMessage(held.localHistoryId)');
    expect(fold, 'the chain copy confirms an echo, once').toContain("if (held.type === 'out' && (held.meta === 'sending' || held.meta === 'not delivered')) {");
    expect(fold, 'who and where ride the message').toContain('groupPublic: { senderWallet: row.senderWallet ?? null, coords: row.coords ?? null },');
    expect(APP).toMatch(/await hydrateGroupThreadsFromStore\(\);\s*(if \(gone\(\)\) return;\s*)?await hydratePublicGroupThreadsFromStore\(\);/);
    const boot = code(block(RAW, 'async function hydratePublicGroupThreadsFromStore('));
    expect(boot).toContain('const runtime = await ensurePublicGroupRuntime();');
    expect(boot).toContain('for (const record of runtime.list()) {');
    expect(boot, 'no second store of its own').not.toContain('createGroupRecordStore(');
    const pass = code(block(RAW, 'async function syncPublicGroupsFromChainUnguarded('));
    const delivery = code(block(RAW, 'async function deliverPublicGroupPass('));
    expect(pass).toContain('passes = await runtime.sync({ deliver, ...(due.length < roomIds.length ? { groupIds: due } : {}) });');
    expect(delivery).toContain('added += dropGroupMessagesBySenderKey(thread, pass.bannedNow ?? []);');
    expect(delivery, 'and a hidden row, by its key').toContain('added += dropGroupMessagesByChainKey(thread, pass.hiddenNow ?? []);');
    expect(delivery).toContain('if (pass.chatRead !== false) {');
    expect(delivery).toMatch(/if \(pass\.chatRead !== false\) \{[\s\S]{0,600}message\.meta = 'not delivered';/);
    expect(pass).not.toContain('if (passes.length > 0) renderThreads();');
    expect(pass).toContain('if (touched > 0) { renderThreads(); renderConversation(); }');
    const hide = code(block(RAW, 'function dropGroupMessagesBySenderKey('));
    expect(hide, 'own rows are never hidden by a ban').toContain("message.type === 'out' ||");
    expect(hide).toContain('groupMessageSenderKey(message)');
    const door = code(block(RAW, 'function dropGroupMessagesWhere('));
    expect(door, 'and out of the history').toContain('encryptedMessageStore.deleteMessage(message.localHistoryId)');
    expect(APP, 'the old one-lane helper is gone, not kept beside the new').not.toContain('function hidePublicGroupMessagesByKey(');
    expect(fold).toContain('if (row.coords && !held.groupPublic?.coords) {');
    expect(APP.match(/dropPublicGroupRuntime\(\);/g)?.length, 'both drop sites').toBe(2);
  });

  it('PGC-04: the document codec carries the GROUP block both ways, and the block is the protocol\'s own bytes', () => {
    expect(APP).toContain('GROUP: 10,');
    const encode = code(block(RAW, 'function encodeMessageDocumentBlocks('));
    expect(encode).toContain("} else if (block.type === 'group') {");
    expect(encode).toContain('type = PLATHO_DOCUMENT_BLOCK_TYPES.GROUP;');
    const decode = code(block(RAW, 'function decodeMessageDocumentBlocks('));
    expect(decode).toContain('} else if (type === PLATHO_DOCUMENT_BLOCK_TYPES.GROUP) {');
    expect(decode, 'handed over raw — meaning is the protocol\'s').toContain("blocks.push({ type: 'group', bytes: content });");
    const bytes = encodePublicGroupControl(PUBLIC_GROUP_KIND.BAN, { groupKey: new Uint8Array(32).fill(7), sentAt: 1 });
    expect(decodePublicGroupControl(bytes)).toMatchObject({ kind: PUBLIC_GROUP_KIND.BAN, lift: false });
  });

  it('PGC-05: the publisher is the comment publisher with the uid handed in — same checks, same door, as many parts as it takes', () => {
    const publish = code(block(RAW, 'async function publishPublicGroupDocument('));
    for (const line of [
      "const payloads = await createPublicLanePayloadPartsV2({ type: 'comment', documentBytes, streamId: publicGroupStreamBytes(streamId) });",
      "if (payloads.length === 0) throw new Error(t('group.sendFailed'));",
      'kind: 1, partitionKeyOf: (seq) => publicThreadPartitionKey(postUid, seq), epochTag: threadEpochTag, need: payloads.length, nowUnix,',
      'const value = publicPublishValueForKind(1, generationForUnixSeconds(nowUnix));',
      'kind: 1, keyArg: postUid, header: payload.headerCell, body: payload.bodyCell, value, partitionKey: threadPk, epochTag: threadEpochTag, nowUnix,',
      'await assertNotRestrictedForPublicPublishing();',
      "await assertWalletGramAtLeast(need, 'group');",
      'result = await publishPublicLaneParts({ wallet: requireSameWallet(signer), transport, prices: await messageNetworkPrices(), ...(await publicPublishRouting()) }, parts,',
      'throw forgetUnlandedBroadcast(error);',
      'schedulePublicPublishVisibilityChecks();',
    ]) {
      expect(publish, line.slice(0, 48)).toContain(line);
    }
    const builder = code(block(RAW, 'async function createPublicLanePayloadPartsV2('));
    expect(builder).toContain('const streamId = givenStreamId instanceof Uint8Array && givenStreamId.length === 16 ? givenStreamId : randomBytes(16);');
    expect(publish).toContain('const documentBlocks = publicGroupDocumentBlocks(blocks);');
    expect(code(block(RAW, 'function publicGroupDocumentBlocks('))).toContain("documentBlocks.push({ type: 'sender', username: canonicalUsernameDisplay(linkedLabel) });");
    expect(publish, 'no one-part refusal').not.toMatch(/payloads\.length !== 1/);
    const runtime = readFileSync('web/public-group-runtime.mjs', 'utf8');
    expect(code(runtime), 'a document is shown only whole').toContain('if (group.parts.size === group.expected) {');
    expect(code(runtime), 'and the parts still on their way wait in the record for the next pass').toContain('parts[key] = { expected: group.expected, publisher: group.publisher, streamId: group.streamId, at: group.at,');
  });

  it('PGC-06: one /join route, two pointers — and a public pointer joins where a private one asks', () => {
    const inline = code(block(RAW, 'function appendInlineFormatted('));
    expect(inline).toContain('const asked = safe ? (parseGroupAskLink(safe) ?? parsePublicGroupJoinLink(safe)) : null;');
    expect(inline).toContain('const bareAsk = safe ? (parseGroupAskLink(safe) ?? parsePublicGroupJoinLink(safe)) : null;');
    expect(APP, 'the boot route').toContain('const ask = parseGroupAskLink(location.pathname) ?? parsePublicGroupJoinLink(location.pathname);');
    expect(APP).toContain('return (ask.public ? joinPublicGroup(ask, null) : requestGroupJoin(ask, null, { unprompted: true })).catch((error) => console.error(error));');
    const button = code(block(RAW, 'function buildGroupAskButton('));
    expect(button).toContain("button.addEventListener('click', () => { void (open ? joinPublicGroup(pointer, button) : requestGroupJoin(pointer, button)); });");
    const join = code(block(RAW, 'async function joinPublicGroup('));
    expect(join).toContain('const price = () => publicGroupControlPriceLine(PUBLIC_GROUP_KIND.JOIN, {}, null, { upTo: true });');
    expect(join, 'no read of the room').not.toContain('publicGroupChatUid(');
    expect(join).toContain('const record = await runtime.join(pointer.groupId, {');
    expect(join).toContain('openGroupThread(thread);');
    const copy = code(block(RAW, 'async function copyPublicGroupJoinLink('));
    expect(copy).toContain('const pointer = runtime?.pointerOf(groupId) ?? null;');
    expect(copy).toContain('link = publicGroupJoinLink(location.origin, encodePublicGroupJoinToken(pointer));');
    expect(join).toContain('founder: pointer.founder, owner: pointer.owner ?? null, foundedEra: pointer.foundedEra ?? null, name: pointer.name ?? null,');
    expect(join).toContain('if (!(pointer?.groupId instanceof Uint8Array) || !(pointer?.founder instanceof Uint8Array)) return;');
    const card = code(block(RAW, 'async function joinOrAskGroup('));
    expect(card).toContain('if (room?.founder) {');
    expect(card).toContain('founder: hexToBytes(String(room.founder)),');
    expect(card, 'no probe: without a founder there is no thread to ask').not.toContain('.probe(');
    expect(card).toContain('void requestGroupJoin({ groupId: room.groupId, wallet: displayWalletAddress(raw), name: room.name || null, pinned: true }, null);');
  });

  it('PGC-07: the members card branches by lane, and the public one offers a ban only where the runtime would take it', () => {
    const members = code(block(RAW, 'async function openGroupMembersDialog('));
    expect(members, 'the public record goes to its own card').toContain('if (publicGroupRuntimeInstance?.get(groupId)) return openPublicGroupMembersDialog(groupId);');
    const card = code(block(RAW, 'async function openPublicGroupMembersDialog('));
    expect(card, 'an admin bans a member, only the owner bans an admin, nobody bans the owner')
      .toContain('if (amAdmin && key !== mine && !isOwner && (amOwner || !isAdmin)) {');
    expect(card, 'the owner names admins and hands over').toContain('if (amOwner && key !== mine) {');
    expect(card, 'the banned are listed, and a ban is lifted from where it was given').toContain("sub.textContent = t('group.banned');");
    expect(card, 'a banned wallet is a person the fold noted, not six hex digits').toContain('const known = current.known?.[key] ?? null;');
    expect(card).toContain("await banPublicGroupMember(groupId, { groupKey: banned, wallet: known?.wallet ?? null, name: known?.name ?? null }, { lift: true });");
    const ban = code(block(RAW, 'async function banPublicGroupMember('));
    expect(ban, 'this device knows first — the pass reports only what the chain taught it').toContain('if (!lift) dropGroupMessagesBySenderKey(thread, [');
    expect(ban, 'a lift asks for the next pass; the runtime dropped the chat marks').toContain('if (lift) void syncGroupsFromChain();');
    const menu = code(block(RAW, 'function publicGroupMenuActionsFor('));
    expect(menu).toContain('onInvite: null,');
    expect(menu).toContain("linkLabel: t('group.joinLinkAction'),");
    expect(menu).toContain("onLeave: publicGroupSelfIsOwner(record) ? () => { flashWalletIdentityStatus(t('group.leaveNeedsAdmin'), 3200); } : () => { void leavePublicGroup(groupId, record); },");
    expect(menu).toContain("pictureVisibility: t('group.publicAvatarVisibility'),");
    const dispatch = code(block(RAW, 'function groupMenuActionsFor('));
    expect(dispatch).toContain('if (publicRecord) return publicGroupMenuActionsFor(groupId, publicRecord);');
    const price = code(block(RAW, 'function publicGroupControlPriceLine('));
    expect(price).toContain('bytes = encodePublicGroupControl(kind, { ...payload, sentAt: Math.floor(Date.now() / 1000) });');
    for (const fn of ['renamePublicGroup', 'leavePublicGroup', 'setPublicGroupMemberAdmin', 'transferPublicGroupOwnership', 'banPublicGroupMember']) {
      expect(code(block(RAW, `async function ${fn}(`)), `${fn} shows the price`).toContain('publicGroupControlPriceLine(');
    }
  });

  it('PGC-08: a public group message is public content — reportable from its row by the comment\'s door', () => {
    const row = code(RAW.slice(RAW.indexOf('const buildMessageRow = (message, showMeta, groupStart) => {'), RAW.indexOf('const buildMessageRow = (message, showMeta, groupStart) => {') + 20000));
    expect(row).toContain('appendGroupRowReportButton(row, message);');
    const report = code(block(RAW, 'function appendGroupRowReportButton('));
    expect(report, 'nothing without coordinates, a moderation-capable build, and somebody else\'s words')
      .toContain('if (!coords || !wallet || !moderationSupported() || isOwnPublicAuthor(wallet)) return;');
    expect(report, 'the same rule a comment follows').toContain('if (!publicItemReportable(item, 1)) return;');
    expect(report).toContain('openReportDialog(item, 1);');
    const history = code(block(RAW, 'function serializeMessageForHistory('));
    expect(history).toContain('groupPublic: safeJsonClone(message.groupPublic) ?? null,');
  });

  it('PGC-11: pinning a public room puts its founder and owner on the card, and a row hidden later leaves the screen', () => {
    const pin = code(block(RAW, 'async function togglePinnedProfileGroup('));
    expect(pin).toContain(": [...held, { groupId, name: record?.name ?? '', ...publicGroupPinFields(record) }];");
    const fields = code(block(RAW, 'function publicGroupPinFields('));
    expect(fields, 'a private room adds nothing').toContain('if (!isPublicGroupRecord(record) || !(record?.founder instanceof Uint8Array)) return {};');
    expect(fields).toContain('return { ...(founder ? { founder } : {}), ...(owner ? { owner } : {}) };');
    const pass = code(block(RAW, 'async function deliverPublicGroupPass('));
    expect(pass).toContain('added += dropHiddenPublicGroupMessages(thread, pass.hidden ?? []);');
    const drop = code(block(RAW, 'function dropHiddenPublicGroupMessages('));
    expect(drop, 'by the coordinates a report names').toContain('const coords = message?.groupPublic?.coords;');
    expect(drop, 'and out of the history').toContain('encryptedMessageStore.deleteMessage(message.localHistoryId)');
  });

  it('PGC-09: the wipe names the public store AND the request queue it had been missing', () => {
    const names = RAW.slice(RAW.indexOf('const PLATHO_LOCAL_INDEXED_DB_BASE_NAMES = Object.freeze(['), RAW.indexOf('const PLATHO_LOCAL_INDEXED_DB_PREFIX'));
    expect(names).toContain("'platho-public-groups-v1',");
    expect(names).toContain("'platho-group-requests-v1',");
    expect(readFileSync('web/group-record-store.mjs', 'utf8')).toContain("export const PUBLIC_GROUP_RECORD_DB_NAME = 'platho-public-groups-v1';");
    expect(APP).toContain('dbName: walletScopedIndexedDbName(PUBLIC_GROUP_RECORD_DB_NAME, wallet.address),');
  });

  it('PGC-12: a public room\'s composer needs the wallet alone, takes text alone, and prices the row it sends', () => {
    const publicBranch = APP.indexOf('if (isPublicGroupThread(thread)) {\n    await sendGroupMessageFromComposer(thread, text);');
    const keysGate = APP.indexOf("privateComposerCostStatus.textContent = t('send.preparingKeys');");
    expect(publicBranch, 'the public branch exists').toBeGreaterThan(0);
    expect(publicBranch, 'and comes before the activation gate').toBeLessThan(keysGate);
    const walletGate = APP.lastIndexOf('if (!plathoWallet?.address) {\n    refreshMessagingControls();\n    return;\n  }', publicBranch);
    expect(walletGate, 'but after the wallet gate').toBeGreaterThan(0);
    const reason = code(block(RAW, 'function privateSendBlockReason('));
    expect(reason).toContain('const publicRoom = isPublicGroupThread(thread);');
    expect(reason).toContain('if (!publicRoom && (!localIdentity || !localRecipientKeyPair || !localSignedPublicBundle)) {');
    expect(reason).toContain('if (!publicRoom && !hasActivePlathoAccount()) {');
    expect(reason).toContain('if (!publicRoom && options.includeVaultShortfall !== false && privateComposerKnownVaultTonShortfall()) {');
    expect(reason, 'the wallet is still required').toContain('if (!plathoWallet) return walletNeededReason();');
    const can = code(block(RAW, 'function canAttemptPrivateSend('));
    expect(can).toContain('&& (isPublicGroupThread(thread) || (Boolean(localIdentity && localRecipientKeyPair && localSignedPublicBundle)');
    expect(can, 'a reload pending still blocks').toContain('&& pendingServiceWorkerAppShellReload !== true');
    const button = code(block(RAW, 'function refreshPrivateSendButtonState('));
    expect(button).toContain('const room = isGroupThread(thread);');
    expect(button).toContain('privateComposerAddButton.disabled = blocked || room;');
    expect(button).toContain('if (privateImageButton) privateImageButton.disabled = blocked || room;');
    expect(button).toContain('if (privateFileButton) privateFileButton.disabled = blocked || room;');
    expect(button).toContain('if (blocked || room) hidePrivateComposerAddMenu();');
    const send = code(block(RAW, 'async function sendGroupMessageFromComposer('));
    expect(send).toContain("if (!String(text ?? '').trim()) return;");
    const cost = code(block(RAW, 'function refreshComposerCostStatus('));
    expect(cost).toContain(': isPublicGroupThread(activeThread())');
    expect(cost).toContain("? publicGroupComposerCostLine(messageInput?.value ?? '')");
    const groupLine = code(block(RAW, 'function publicGroupComposerCostLine('));
    expect(groupLine).toContain("encodeMessageDocumentBlocks(publicGroupDocumentBlocks([{ type: 'text', text: String(text ?? '') }]))");
    expect(groupLine).toContain('publicComposerFinalCostLine(plan, uid === null ? null : { kind: 1, postUid: uid },');
    expect(groupLine).toContain("publicGroupChargeFor([{ type: 'text', text: String(text ?? '') }]).nanotons");
    const line = code(block(RAW, 'function composerCostAndHoldLine('));
    expect(line).toContain("return { text: t(upTo ? 'composer.costStatus' : 'composer.costFinal', params), state: 'ready', parts };");
    expect(code(block(RAW, 'function publicComposerFinalCostLine('))).toContain('return composerCostAndHoldLine({ cost: row.cost, hold: need, parts: row.parts });');
    expect(code(block(RAW, 'function publicGroupPriceLine('))).toContain('return composerCostAndHoldLine({ cost, hold, parts, upTo }).text;');
    const rowPrice = code(block(RAW, 'function publicGroupRowPrice('));
    expect(rowPrice).toContain('const row = publicRowFinalCost(plan, uid === null ? { kind: 1 } : { kind: 1, postUid: uid });');
    expect(rowPrice).toContain('hold: publicGroupChargeFor(blocks).nanotons + composerPublicRoutedHoldExtra(row.kind, row.routedParts, row.first, row.generation, row.nowUnix),');
    expect(code(block(RAW, 'function publicGroupChargeNanotonsFor('))).toContain('return publicGroupChargeFor(blocks).nanotons;');
    const isPublic = code(block(RAW, 'function isPublicGroupThread('));
    expect(isPublic, 'synchronous, from the runtime the boot created').toContain('return Boolean(groupId && publicGroupRuntimeInstance?.get(groupId));');
  });

  it('PGC-13: a pointer opened on a locked device waits for the unlock; names are what the registry confirmed', () => {
    const join = code(block(RAW, 'async function joinPublicGroup('));
    expect(join).toContain('pendingPublicGroupJoinPointer = pointer;');
    expect(join, 'kept, not dropped').not.toMatch(/if \(!plathoWallet\?\.address\) \{ flashWalletIdentityStatus/);
    const boot = code(block(RAW, 'async function hydratePublicGroupThreadsFromStore('));
    expect(boot).toContain('const pointer = pendingPublicGroupJoinPointer;');
    expect(boot).toContain('pendingPublicGroupJoinPointer = null;');
    expect(boot).toContain('joinPublicGroup(pointer, null)');
    expect(APP).toContain('let pendingPublicGroupJoinPointer = null;');
    const label = code(block(RAW, 'function publicGroupMemberLabel('));
    expect(label).not.toContain('senderUsername');
    expect(label).toContain('const declared = member?.name ?? (key ? record?.known?.[key]?.name : null) ?? null;');
    expect(label).toContain('groupPersonLabel(row?.senderWallet ?? null, declared, null)');
    const person = code(block(RAW, 'function groupPersonLabel('));
    expect(person).toContain('const proven = knownNameForWallet(wallet);');
    expect(person).toContain('if (name && wallet) return `${name} · ${shortAddress(wallet)}`;');
    const fold = code(block(RAW, 'function applyPublicGroupMessagesToThread('));
    expect(fold, 'the claim goes through the same verification a comment\'s does').toContain('adoptPostSenderUsernameClaim(row.senderWallet, String(row.senderUsername));');
    const menu = code(block(RAW, 'function showProfileCardGroupsMenu('));
    expect(menu).toContain('const known = groupRecordOf(String(room.groupId))?.name ?? null;');
    expect(menu).toContain("hint.textContent = room.founder ? t('group.joinLabel') : t('group.askLabel');");
    const leave = code(block(RAW, 'async function leavePublicGroup('));
    expect(leave).not.toContain('void record;');
  });

  it('PGC-14: the recovery blob carries public rooms as pointers, each lane plants its own, and neither runtime gates the other', () => {
    const restore = code(block(RAW, 'async function restoreGroupsFromRecoveryIfFresh('));
    expect(restore).toContain('const publicEntries = entries.filter(isPublicGroupRecoveryEntry);');
    expect(restore).toContain('const runtime = privateEntries.length > 0 ? await ensureGroupRuntime() : null;');
    expect(restore).toContain('const publicRuntime = publicEntries.length > 0 ? await ensurePublicGroupRuntime() : null;');
    expect(restore).toContain('await publicRuntime.adopt(pointer.groupId, pointer);');
    expect(restore, 'a held room is left as it is').toContain('if (publicRuntime.has(String(entry.g).toLowerCase())) continue;');
    expect(restore, 'the private lane no longer gates the whole restore').not.toContain('if (!runtime) return;');
    expect(restore, 'one planted room of either kind brings the pass').toContain('if (planted > 0) { await syncGroupsFromChain(); renderThreads(); }');
    const backup = code(block(RAW, 'async function backupGroupsIfNeeded('));
    expect(backup).toContain('if (!groupRuntimeInstance && !publicGroupRuntimeInstance) return;');
    expect(backup).toContain("...(groupRuntimeInstance ? groupsRecoveryEntries(groupRuntimeInstance.list(), []) : stored.filter((entry) => !isPublicGroupRecoveryEntry(entry))),");
    expect(backup).toContain('...(publicGroupRuntimeInstance ? groupsRecoveryEntries([], publicGroupRuntimeInstance.list()) : stored.filter(isPublicGroupRecoveryEntry)),');
    expect(backup, 'compared on entries of both kinds').toContain('return { entries, stale: groupsRecoveryIsStale(comparable, groupsRecoveryStored, today) };');
    expect(backup).not.toContain('const runtime = groupRuntimeInstance;');
    expect(code(block(RAW, 'async function syncGroupsFromChain('))).toContain('void backupGroupsIfNeeded().catch((error) => {');
    expect(RAW).toMatch(/import \{[^}]*\bpublicGroupRecoveryPointer\b[^}]*\} from '\.\/group-store\.mjs\?v=\d+';/);
    expect(restore).not.toContain('hexToBytes(');
  });

  it('PGC-15: the dialog factory renders a radio field in full — every option the caller passes is read, and the value collected is the chosen one', () => {
    const factory = code(RAW.slice(RAW.indexOf("if (field.type === 'radio') {"), RAW.indexOf("if (field.type === 'image-preview') {")));
    expect(factory.length).toBeGreaterThan(0);
    expect(factory, 'options').toContain('const options = Array.isArray(field.options) ? field.options : [];');
    expect(factory, 'the default is the value the caller named, else the first option').toContain('const chosen = options.some((option) => option.value === field.value) ? field.value : options[0]?.value;');
    expect(factory, 'each option: its label').toContain('text.textContent = option.label;');
    expect(factory, 'the sentence follows the CHOSEN option').toContain("hint.textContent = String(current?.hint ?? '');");
    expect(factory, 'and follows a change').toContain("input.addEventListener('change', () => { describe(); actionDialogFieldChangeHook?.(field.id, wrapper.querySelector('input:checked')?.value ?? null); });");
    expect(factory, 'the field hint holds whatever is chosen').toContain('note.textContent = field.hint;');
    expect(factory, 'a gate is the exception, as with the tick').toContain('input.required = field.required === true;');
    expect(factory, 'a radio group is named for the reader').toContain("wrapper.setAttribute('role', 'radiogroup');");
    expect(factory).toContain("list.className = 'action-radio-options';");
    expect(factory).toContain('wrapper.append(list, hint);');
    const collect = code(block(RAW, 'function collectActionDialogValues('));
    expect(collect, 'the chosen input, and an unchosen one does not overwrite it').toContain("if (field.type === 'radio') { if (field.checked) values[field.name] = field.value; continue; }");
    const css = readFileSync('web/styles.css', 'utf8');
    expect(css).toContain('.action-radio-field .action-radio-option {');
    expect(css).toMatch(/\.action-radio-field \.action-radio-options \{\s*display: flex;\s*flex-wrap: wrap;/);
    expect(css).toContain('.action-radio-field .action-checkbox-hint {');
    expect(css).toMatch(/\.action-radio-field \{\s*--checkbox-col: 18px;\s*--checkbox-gap: 10px;/);
  });

  it('PGC-16: a room just made or joined sits at the top of the list, like a dialog just opened — from a stamp the record keeps', () => {
    const ensure = code(block(RAW, 'function ensureGroupThread('));
    expect(ensure).toContain('createdAtMs: groupOpenedAtMs(record) };');
    expect(ensure, 'a row drawn again keeps its place; a rejoin moves the stamp').toContain('if (!(Number(thread.createdAtMs) > 0) || groupOpenedAtMs(record) > Number(thread.createdAtMs)) thread.createdAtMs = groupOpenedAtMs(record);');
    const opened = code(block(RAW, 'function groupOpenedAtMs('));
    expect(opened).toContain('const seconds = Number(record?.openedAt ?? 0) || Number(record?.foundedAt ?? 0) || Number(record?.epochs?.[0]?.epoch ?? 0) * 86_400;');
    const activity = code(block(RAW, 'function threadLastActivityMs('));
    expect(activity, 'the fallback the private dialog already uses').toContain('return Number.isFinite(thread?.createdAtMs) ? thread.createdAtMs : 0;');
    for (const file of ['web/group-store.mjs', 'web/public-group-protocol.mjs']) {
      const store = code(readFileSync(file, 'utf8'));
      expect(store, `${file} keeps it`).toContain('openedAt: Number(record.openedAt ?? 0),');
      expect(store, `${file} reads it back`).toContain('openedAt: Number(stored.openedAt ?? 0),');
    }
    expect(code(readFileSync('web/group-runtime.mjs', 'utf8')).match(/openedAt: now\(\)/g)?.length, 'private: create and adopt').toBe(2);
    expect(code(readFileSync('web/public-group-runtime.mjs', 'utf8')).match(/openedAt: now\(\)/g)?.length, 'public: create, a new plant, a rejoin').toBe(3);
  });

  it('PGC-17: a group send asks for its own passes — a ladder, like a comment\'s — and the lane proxy offers the batch', () => {
    expect(APP).toContain('const GROUP_ECHO_CONFIRM_SCHEDULE_MS = Object.freeze([8_000, 20_000, 45_000, 90_000]);');
    expect(APP).toContain('const GROUP_ECHO_CONFIRM_TAIL_MS = 60_000;');
    const ladder = code(block(RAW, 'function scheduleGroupEchoConfirmChecks('));
    expect(ladder, 'stops when nothing is on its way').toContain('if (!anyGroupEchoPending()) return;');
    expect(ladder, 'the group pass, with its own guard').toContain('try { await syncGroupsFromChain(); } catch (error) { noteTonRpcRateLimit(error); }');
    expect(ladder, 'and climbs while an echo is still pending').toContain('if (anyGroupEchoPending()) scheduleGroupEchoConfirmChecks(attempt + 1);');
    const pending = code(block(RAW, 'function anyGroupEchoPending('));
    expect(pending).toContain("message.type === 'out' && message.meta === 'sending'");
    const send = code(block(RAW, 'async function sendGroupMessageFromComposer('));
    expect(send.match(/scheduleGroupEchoConfirmChecks\(\);/g)?.length, 'public and private').toBe(2);
    const ensure = code(block(RAW, 'async function buildPublicGroupRuntime('));
    expect(ensure).toContain("readThreadByUid: (uid, options) => laneNow().readThreadByUid(uid, { ...options, ...(openRoomUids()?.has(String(uid)) ? { requestClass: 'focus' } : {}) }),");
    expect(ensure).toContain('threadCoordsByUid: (uid, options) => laneNow().threadCoordsByUid(uid, options),');
    expect(ensure).toContain("readStates: (addresses) => laneNow().readStates(addresses, openRoomUids() ? 'focus' : null),");
    const placeholder = code(block(RAW, 'function privateComposerPlaceholder('));
    expect(placeholder).toContain("if (group === 'public') return t('composer.publicGroupMessage');");
    expect(placeholder).toContain("if (group) return t('composer.privateGroupMessage');");
    expect(APP).toContain('messageInput.placeholder = privateComposerPlaceholder({ readOnly: isReadOnly, group: groupLaneOfThread(thread), muted: groupSelfIsMuted(thread), banned: groupSelfIsBanned(thread) });');
    for (const locale of Object.keys(I18N_STRINGS)) {
      expect(typeof I18N_STRINGS[locale]['composer.publicGroupMessage'], `${locale}`).toBe('string');
      expect(typeof I18N_STRINGS[locale]['composer.privateGroupMessage'], `${locale}`).toBe('string');
    }
    const preview = code(RAW.slice(RAW.indexOf("if (field.type === 'image-preview') {"), RAW.indexOf("if (field.type === 'note') {")));
    expect(preview).toContain("label.removeAttribute('for');");
    expect(preview).toContain("image.setAttribute('aria-labelledby', label.id);");
  });

  it('PGC-18: a mute and a hide reach both lanes through one dialog each, one drop door, and one hidden list on either card', () => {
    const mute = code(block(RAW, 'async function muteGroupMemberDialog('));
    expect(mute).toContain('? publicGroupControlPriceLine(PUBLIC_GROUP_KIND.MUTE, { groupKey: member.groupKey, lift }, { groupId })');
    expect(mute).toContain(': groupChainPriceLine(groupRuntimeInstance?.controlPlan(groupId, GROUP_KIND.MUTE, { groupKey: member.groupKey }), groupId));');
    expect(mute).toContain('const updated = await runtime.mute(groupId, member.groupKey, { lift });');
    expect(mute, 'this device knows first').toContain('if (!lift) dropGroupMessagesBySenderKey(thread, [');
    expect(mute, 'a lift asks for the next pass').toContain('if (lift) void syncGroupsFromChain();');
    const hide = code(block(RAW, 'async function hideGroupMessageDialog('));
    expect(hide).toContain('const updated = await runtime.hide(groupId, key, { lift, excerpt });');
    expect(hide).toContain('if (!lift) dropGroupMessagesByChainKey(thread, [key]);');
    const sender = code(block(RAW, 'function groupMessageSenderKey('));
    expect(sender, 'the public key form').toContain("if (key.startsWith('stream:')) return key.split(':')[1] ?? null;");
    expect(sender, 'the private key form').toContain('return parts.length === 4 ? parts[2] : null;');
    const privatePass = code(block(RAW, 'async function deliverPrivateGroupPass('));
    expect(privatePass).toContain('added += dropGroupMessagesBySenderKey(thread, pass.silencedNow ?? []);');
    expect(privatePass).toContain('added += dropGroupMessagesByChainKey(thread, pass.hiddenNow ?? []);');
    const fold = code(block(RAW, 'function applyGroupMessagesToThread('));
    expect(fold).toContain('if (row.hidden) {');
    expect(fold).toContain('dropGroupMessagesByChainKey(thread, [chainKey]);');
    const pub = code(block(RAW, 'async function openPublicGroupMembersDialog('));
    expect(pub).toContain("actionButton('eye-off', muted ? t('group.unmute') : t('group.mute'),");
    expect(pub).toContain('appendHiddenMessageRows(list, groupId, current, amAdmin);');
    expect(pub, 'the word on the row').toContain("isPublicGroupMuted(current, member.groupKey) ? t('group.muted') : ''");
    const priv = code(block(RAW, 'async function openGroupMembersDialog('));
    expect(priv).toContain('if (amAdmin && key !== mine && !isOwner && !member.unseated && (amOwner || !isAdmin)) {');
    expect(priv).toContain("actionButton('eye-off', muted ? t('group.unmute') : t('group.mute'),");
    expect(priv).toContain('appendHiddenMessageRows(list, groupId, record, amAdmin);');
    expect(priv, 'the word on the row').toContain("isGroupMuted(record, member.groupKey) ? t('group.muted') : ''");
    const hiddenRows = code(block(RAW, 'function appendHiddenMessageRows('));
    expect(hiddenRows, 'the way back, for an admin, from the card of either lane').toContain("lift.addEventListener('click', async () => { await hideGroupMessageDialog(groupId, key, { lift: true }); void openGroupMembersDialog(groupId); });");
    expect(hiddenRows, 'newest first, by the excerpt the hider cut').toContain("name.textContent = String(entry?.excerpt ?? '').trim() || '…';");
    const rowButton = code(block(RAW, 'function appendGroupRowHideButton('));
    expect(rowButton).toContain('if (!(isPublicGroupRecord(record) ? publicGroupSelfIsAdmin(record) : groupSelfIsAdmin(record))) return;');
    expect(rowButton).toContain('void hideGroupMessageDialog(groupId, message.groupChainKey, { excerpt: groupHideExcerpt(message) });');
    expect(APP).toContain('appendGroupRowHideButton(row, message, thread);');
    expect(code(readFileSync('web/group-runtime.mjs', 'utf8')).match(/return persist\(lift \? await forgetLiftedLanes\(written, \{ (?:members: \[target\]|rows: \[key\]) \}\) : written\);/g)?.length, 'private: mute and hide').toBe(2);
    expect(code(readFileSync('web/public-group-runtime.mjs', 'utf8')).match(/after: lift \? \(r\) => \(\{ \.\.\.r, read: \{ \.\.\.\(r\.read \?\? \{\}\), chat: \{\} \} \}\) : null,/g)?.length, 'public: ban, mute and hide').toBe(3);
    for (const locale of Object.keys(I18N_STRINGS)) {
      for (const key of ['group.mute', 'group.muteHint', 'group.unmute', 'group.unmuteHint', 'group.muted', 'group.hideMessage', 'group.hideMessageHint', 'group.hiddenMessages', 'group.hiddenMessage', 'group.unhide', 'group.unhideHint']) {
        expect(typeof I18N_STRINGS[locale][key], `${locale} ${key}`).toBe('string');
      }
    }
  });

  it('PGC-10: the two modules are registered in all three lists, and every new word exists in every language', () => {
    const prep = readFileSync('scripts/prepare_static_web_deploy.mjs', 'utf8');
    const sw = readFileSync('web/sw.js', 'utf8');
    for (const name of ['public-group-protocol.mjs', 'public-group-runtime.mjs']) {
      expect(prep, `${name} ships`).toContain(`'${name}',`);
      expect(sw, `${name} is precached`).toMatch(new RegExp(`'\\./${name.replace('.', '\\.')}\\?v=\\d+',`));
      expect(RAW, `${name} is imported`).toMatch(new RegExp(`from '\\./${name.replace('.', '\\.')}\\?v=\\d+'`));
    }
    const keys = [...APP.matchAll(/'(group\.(?:public|private|kind|create|join|leave|ban)[A-Za-z]*)'/g)].map((m) => m[1]);
    const checker = readFileSync('scripts/check_i18n_keys.mjs', 'utf8');
    expect(checker, 'the checker reads both arms of a conditional key').toContain("import { collectI18nKeysFromSource } from './lib/i18n-key-scan.mjs';");
    const wanted = [...new Set(keys)];
    expect(wanted.length, 'the client asks for the new words').toBeGreaterThanOrEqual(12);
    for (const locale of Object.keys(I18N_STRINGS)) {
      for (const key of wanted) {
        expect(typeof I18N_STRINGS[locale][key], `${locale} has ${key}`).toBe('string');
      }
    }
  });
});

describe('WHAT IS ON SCREEN IS READ FIRST — the open room and the open post', () => {
  it('PGC-FOCUS-01: a thread read reaches the pump at the class its caller asks; the open post asks \'focus\' only while it is on screen', async () => {
    const { createPublicLane } = await import('../web/public-lane.mjs');
    const fetch = async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ accounts: [], address_book: {} }), text: async () => '{"accounts":[]}' });
    const lane = createPublicLane({ runGetMethod: async () => ({ stack: [] }), fetch, endpoint: 'https://toncenter.com/api/v2/jsonRPC' } as any);
    const version = readFileSync('web/shard-rpc.mjs', 'utf8').match(/ton-rpc-transport\.mjs\?v=(\d+)/)?.[1];
    const { toncenterPumpSnapshot } = await import(/* @vite-ignore */ `../web/ton-rpc-transport.mjs?v=${version}`);
    const classesOf = async (read: () => Promise<unknown>) => {
      const mark = toncenterPumpSnapshot().log.at(-1);
      await read();
      const log = toncenterPumpSnapshot().log;
      return [...new Set(log.slice(log.indexOf(mark) + 1).filter((entry: any) => entry.label === 'v2/accountStates').map((entry: any) => entry.cls))];
    };
    const W = `0:${'ab'.repeat(32)}`;
    expect(await classesOf(() => lane.readThreadComments(W, '0x0000000100000000', 5, { generation: 18 })), 'no class asked: the lane\'s own').toEqual(['background']);
    expect(await classesOf(() => lane.readThreadComments(W, '0x0000000100000000', 5, { generation: 18, requestClass: 'focus' })),
      'MEASURED before: the post\'s thread read at background whatever was asked').toEqual(['focus']);
    expect(await classesOf(() => lane.readThreadByUid(77n, { requestClass: 'focus' })), 'the open room, as since round 63').toEqual(['focus']);
    const load = code(block(RAW, 'async function loadPublicPostCommentsFromShards('));
    expect(load).toContain("...(publicPostDetailStillOn(item) && isPublicViewActive() && pageOnScreen() ? { requestClass: 'focus' } : {}),");
    expect(code(block(RAW, 'function publicPostDetailStillOn('))).toContain('return publicPostDetailOpen && !!publicPostDetailItem && samePublicPost(publicPostDetailItem, item);');
  });
});
