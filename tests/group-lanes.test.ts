import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { encodeGroupAskToken, groupAskLink, parseGroupAskLink, parseGroupAskToken, GROUP_ASK_PREFIX } from '../web/group-protocol.mjs';
import { encodePublicGroupJoinToken, parsePublicGroupJoinLink, parsePublicGroupJoinToken, publicGroupJoinLink } from '../web/public-group-protocol.mjs';


const RAW = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const S = I18N_STRINGS as Record<string, Record<string, string>>;
const LOCALES = Object.keys(S);
const fn = (starts: string) => sourceBlock(RAW, starts);

const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis));
function inert(): any {
  const self: any = new Proxy(function () { }, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () { };
      if (key === 'then') return undefined;
      return self;
    },
    apply() { return self; },
    construct() { return self; },
    set() { return true; },
  });
  return self;
}
function inAppScope(sources: string[], exported: string, overrides: Record<string, any>) {
  const scope = new Proxy(overrides, {
    has(target, key) { return typeof key === 'string' && (key in target || !GLOBALS.has(key)); },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (typeof key === 'string' && key in target) return (target as any)[key];
      return inert();
    },
    set(target, key, value) { (target as any)[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
}
const t = (key: string, params?: any) => `<${key}${params ? ` ${JSON.stringify(params)}` : ''}>`;

describe('GROUP LANES — a room says which kind it is', () => {
  it('LANE-01: a room opened from anywhere is shown — the view follows the room, and its kind picks the tab', () => {
    const calls: string[] = [];
    const scope: any = {
      appShell: { dataset: { view: 'public', chatOpen: 'false' } },
      activeThreadId: null,
      isPublicRoomThread: (thread: any) => thread.lane === 'public',
      openPublicRoom: (thread: any) => { calls.push(`public room ${thread.id}`); },
      setView: (view: string) => { calls.push(`view ${view}`); scope.appShell.dataset.view = view; },
      renderThreads: () => { calls.push('threads'); }, renderConversation: () => { calls.push('conversation'); },
    };
    const open = inAppScope([fn('function openGroupThread(')], 'openGroupThread', scope);
    open({ id: 'group:aa' });
    expect(scope.activeThreadId).toBe('group:aa');
    expect(calls, 'from the Public tab the Private view is brought up first').toEqual(['view chats', 'threads', 'conversation']);
    expect(scope.appShell.dataset.chatOpen).toBe('true');
    calls.length = 0;
    open({ id: 'group:bb' });
    expect(calls, 'already there: nothing to switch').toEqual(['threads', 'conversation']);
    calls.length = 0;
    open({ id: 'group:cc', lane: 'public' });
    expect(calls).toEqual(['public room group:cc']);
    expect(scope.activeThreadId, 'the Private selection is not taken by a public room').toBe('group:bb');
    expect(fn('async function openCreateGroupDialog(')).toContain('openGroupThread(thread);');
  });

  it('LANE-02: the door that makes a group decides its kind — no question inside the dialog', async () => {
    const run = async (kind: any, { privateRuntime = true, publicRuntime = true } = {}) => {
      const calls: string[] = [];
      const dialogs: any[] = [];
      const scope: any = {
        t,
        ensureGroupRuntime: async () => { calls.push('private runtime asked'); return privateRuntime ? { create: async ({ name }: any) => { calls.push(`private create ${name}`); return { groupId: new Uint8Array(32) }; } } : null; },
        ensurePublicGroupRuntime: async () => { calls.push('public runtime asked'); return publicRuntime ? { create: async ({ name }: any) => { calls.push(`public create ${name}`); return { groupId: new Uint8Array(32) }; } } : null; },
        openActionDialog: async (options: any) => {
          dialogs.push(options);
          const values = { name: ' Cooks ' };
          const outcome = options.validateSubmit ? await options.validateSubmit(values) : { ok: true };
          return outcome?.ok ? (outcome.result ?? values) : null;
        },
        flashWalletIdentityStatus: (text: string) => { calls.push(`flash ${text}`); },
        ensureGroupThread: () => ({ id: 'group:new' }), refreshThreadAfterMessageChange: () => {},
        openGroupThread: (thread: any) => { calls.push(`open ${thread.id}`); }, console: { warn: () => {} },
        publicGroupControlPriceLine: () => '<price>', PUBLIC_GROUP_KIND: { FOUND: 1 },
        joinHintSentences: (...parts: any[]) => parts.filter(Boolean).join(' '),
        walletUnlockAction: () => null,
      };
      const create = inAppScope([fn('async function openCreateGroupDialog(')], 'openCreateGroupDialog', scope);
      await create(kind);
      return { calls, dialog: dialogs[0] };
    };
    const priv = await run('private');
    expect(priv.calls).toEqual(['private runtime asked', 'private create Cooks', 'open group:new']);
    expect(priv.dialog.title).toBe('<group.createPrivateTitle>');
    expect(priv.dialog.hint(), 'a private group writes nothing: no price').toBe('<group.privateHint> <group.kindHint>');
    expect(priv.dialog.fields.map((f: any) => f.id), 'the name, and nothing to choose').toEqual(['name']);
    const pub = await run('public');
    expect(pub.calls).toEqual(['public runtime asked', 'public create Cooks', 'open group:new']);
    expect(pub.dialog.title).toBe('<group.createPublicTitle>');
    expect(pub.dialog.hint(), 'a public group is founded by a row: priced').toBe('<group.publicHint> <group.kindHint> <price>');
    expect((await run(undefined)).calls[0], 'a door that names no kind makes the sealed one').toBe('private runtime asked');
    expect((await run('private', { privateRuntime: false })).calls, 'no runtime of this kind: said, nothing made').toEqual(['private runtime asked', 'flash <group.walletRequired>']);
    expect(fn('function ensurePrivateListActions(')).toContain("create.addEventListener('click', () => { void openCreateGroupDialog('private'); });");
    expect(RAW).toMatch(/for \(const button of \[publicNewGroupButton, publicNavNewGroupButton\]\) \{\s*button\?\.addEventListener\('click', \(\) => \{ void openCreateGroupDialog\('public'\); \}\);\s*\}/);
    expect(RAW.split('openCreateGroupDialog(').length - 1, 'the two doors and the declaration, nothing else').toBe(3);
  });

  it('LANE-03: a room is stamped with its kind when it is drawn; the kind is read from the stamp first', () => {
    const known = new Set<string>();
    const lane = inAppScope([fn('function groupLaneOfThread(')], 'groupLaneOfThread', {
      isGroupThread: (thread: any) => String(thread?.id ?? '').startsWith('group:'),
      isPublicGroupThread: (thread: any) => thread.runtimeSaysPublic === true,
      knownPublicRoomIds: () => known,
    });
    expect(lane({ id: 'dm:1' })).toBeNull();
    expect(lane(null)).toBeNull();
    expect(lane({ id: 'group:a', groupLane: 'public' })).toBe('public');
    expect(lane({ id: 'group:a', groupLane: 'private', runtimeSaysPublic: true }), 'the stamp wins over a runtime that is not up yet').toBe('private');
    expect(lane({ id: 'group:a', runtimeSaysPublic: true }), 'unstamped: the runtime answers').toBe('public');
    expect(lane({ id: 'group:a' })).toBe('private');
    known.add('group:a');
    expect(lane({ id: 'group:a' }), 'unstamped, runtime not up: the list of this wallet\'s public rooms answers').toBe('public');
    expect(lane({ id: 'group:a', groupLane: 'private' }), 'the stamp still wins').toBe('private');
    expect(fn('function ensureGroupThread(')).toContain("thread.groupLane = isPublicGroupRecord(record) ? 'public' : 'private';");
    expect(fn('function ensureGroupThread(')).toContain('rememberGroupThreadLane(thread.id, thread.groupLane);');
  });

  it('LANE-04: the header says the kind in words; a dialog header stays empty', () => {
    const records: Record<string, any> = { aa: { members: [1, 2, 3, 4, 5] } };
    const subtitle = inAppScope([fn('function groupPeopleOf('), fn('function conversationSubtitleText(')], 'conversationSubtitleText', {
      t,
      groupLaneOfThread: (thread: any) => thread?.lane ?? null,
      groupIdOfThread: (thread: any) => thread?.gid ?? null,
      groupRecordOf: (id: string) => records[id] ?? null,
    });
    expect(subtitle({ lane: 'public', gid: 'aa' })).toBe('<group.publicLabel> · <group.membersCount {"count":5}>');
    expect(subtitle({ lane: 'private', gid: 'aa' })).toBe('<group.privateLabel> · <group.membersCount {"count":5}>');
    expect(subtitle({ lane: 'public', gid: 'unknown' }), 'no record yet: the kind alone').toBe('<group.publicLabel>');
    expect(subtitle({}), 'a dialog').toBe('');
    expect(subtitle(), 'nothing open').toBe('');
    expect(RAW).toContain('activeSubtitle.textContent = conversationSubtitleText(thread);');
  });

  it('LANE-05: the field and the button name what a press does, by the kind', () => {
    const placeholder = inAppScope([fn('function privateComposerPlaceholder(')], 'privateComposerPlaceholder', { t, plathoWallet: { address: '0:aa' } });
    expect(placeholder({ group: 'public' })).toBe('<composer.publicGroupMessage>');
    expect(placeholder({ group: 'private' })).toBe('<composer.privateGroupMessage>');
    expect(placeholder({ group: null })).toBe('<composer.privateMessage>');
    expect(placeholder({ group: 'public', muted: true }), 'a muted member is told that first').toBe('<composer.mutedInGroup>');
    expect(RAW.split('group: groupLaneOfThread(').length - 1, 'both writers of the placeholder pass the kind').toBe(2);
    expect(RAW).not.toMatch(/group: isGroupThread\(/);
    const send = fn('function refreshPrivateSendButtonState(');
    expect(send).toContain("const sendWords = lane === 'public' ? t('send.sendPublicly') : lane === 'private' ? t('send.sendToGroup') : t('send.sendPrivateMessage');");
    expect(send).toContain("sendButton.title = reason ?? (nothingToSend ? t('composer.nothingToSend') : sendWords);");
  });

  it('LANE-06: no room offers "send pseudonymously" — nothing it sends can hide its writer', () => {
    const button: any = { hidden: false, attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; }, querySelector: () => null, title: '' };
    let thread: any = { id: 'group:aa' };
    const update = inAppScope([fn('function updatePrivateSenderModeUi(')], 'updatePrivateSenderModeUi', {
      t, privateAnonymousButton: button, privateSenderModeSelect: null, plathoWallet: { address: '0:aa' },
      currentPrivateSenderMode: () => 'share', PRIVATE_SENDER_MODES: { ANONYMOUS: 'anonymous', SHARE: 'share' },
      privateSenderModeToggleBlockReason: () => null, privateSendBlockReason: () => null,
      activeThread: () => thread, isGroupThread: (x: any) => String(x?.id ?? '').startsWith('group:'),
    });
    update(null);
    expect(button.hidden).toBe(true);
    thread = { id: 'dm:1' };
    update(null);
    expect(button.hidden, 'a dialog keeps it').toBe(false);
    expect(css).toMatch(/\.composer \.private-anonymous-button\[hidden\] \{\s*display: none;\s*\}/);
  });

  it('LANE-07: a public room wears the Public tab\'s mark in the corner, a private group the people mark', () => {
    const avatar = fn('function setThreadAvatarNode(');
    expect(avatar).toContain("mark.dataset.lane = groupLaneOfThread(thread) ?? 'private';");
    const blocks = [...css.matchAll(/--group-badge-icon: url\("data:image\/svg\+xml,[^"]*fill='(%23[0-9a-fA-F]{6})'[^"]*"\);\n(\s*)--group-public-badge-icon: url\("data:image\/svg\+xml,[^"]*fill='(%23[0-9a-fA-F]{6})'[^"]*"\);/g)];
    expect(blocks.length).toBe(3);
    for (const b of blocks) expect(b[3], 'the same colour as the people mark beside it').toBe(b[1]);
    expect(css).toContain("--group-public-badge-icon: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='");
    expect(css).toMatch(/\.avatar > \.avatar-group-badge\[data-lane="public"\],\n\.share-target-avatar > \.avatar-group-badge\[data-lane="public"\] \{\n  background-image: var\(--group-public-badge-icon\);\n\}/);
    const railGlyph = readFileSync('web/assets/icons/broadcast.svg', 'utf8').match(/ d="([^"]+)"/)![1];
    expect(css).toContain(`d='${railGlyph}'`);
  });

  it('LANE-08: joining and asking are different words in every language, and a public room\'s pin says anyone can read it', () => {
    for (const locale of LOCALES) {
      const d = S[locale];
      expect(d['group.joinLabel'], locale).not.toBe(d['group.askLabel']);
      expect(d['group.profilePinHintPublic'], locale).not.toBe(d['group.profilePinHint']);
      expect(d['group.profileUnpinHintPublic'], locale).not.toBe(d['group.profileUnpinHint']);
      for (const key of ['group.createPublicTitle', 'group.createPrivateTitle', 'send.sendPublicly', 'send.sendToGroup', 'composer.publicGroupMessage', 'composer.privateGroupMessage']) {
        expect(d[key], `${locale}:${key}`).toBeTruthy();
      }
      for (const gone of ['group.createTitle', 'group.createHint', 'group.kindLabel', 'composer.groupMessage']) expect(d[gone], `${locale}:${gone}`).toBeUndefined();
    }
    const hint = inAppScope([fn('function groupProfilePinHint(')], 'groupProfilePinHint', {
      t, publicGroupRuntimeInstance: { get: (id: string) => (id === 'pub' ? {} : null) },
    });
    expect(hint('pub', false)).toBe('<group.profilePinHintPublic>');
    expect(hint('pub', true)).toBe('<group.profileUnpinHintPublic>');
    expect(hint('priv', false)).toBe('<group.profilePinHint>');
    expect(hint('priv', true)).toBe('<group.profileUnpinHint>');
    expect(RAW.split('hint: groupProfilePinHint(groupId, groupIsPinnedToProfile(groupId)),').length - 1).toBe(2);
    expect(RAW).toContain("groupActions.profilePin.hint ?? (groupActions.profilePin.pinned ? t('group.profileUnpinHint') : t('group.profilePinHint')),");
    expect(fn('async function togglePinnedProfileGroup(')).toContain('hint: () => joinHintSentences(groupProfilePinHint(groupId, pinned), channelProfilePriceLine(description, tags, appearance, worn, next)),');
  });
});

describe('GROUP LANES — a join link is read as the door it is', () => {
  const friendly = (hash: Uint8Array, bounceable = false) => new Address(0, Buffer.from(hash)).toString({ bounceable, urlSafe: true });
  const founder = ed25519.getPublicKey(new Uint8Array(32).fill(7));
  const route = (path: string) => parseGroupAskLink(path) ?? parsePublicGroupJoinLink(path);

  it('LANE-09: a public room whose name fits the private layout is still a public room', () => {
    const name = 'Photography and film club, northern district';
    expect(Buffer.byteLength(name)).toBe(44);
    expect(name[11]).toBe(' ');
    const token = encodePublicGroupJoinToken({ groupId: new Uint8Array(32).fill(9), founder, name });
    const bytes = Buffer.from(token, 'base64url');
    expect(bytes[0], 'the same first byte as a priced private pointer').toBe(2);
    expect(bytes.length, 'the private layout fits it exactly').toBe(114 + bytes[113]);
    expect(bytes.readBigUInt64BE(105) > 0n, 'and its "price" reads as one').toBe(true);
    const link = new URL(publicGroupJoinLink('https://example.invalid', token)).pathname;
    expect(parseGroupAskToken(`${GROUP_ASK_PREFIX}${token}`), 'the letters of a name are not two wallets').toBeNull();
    const read = route(link) as any;
    expect(read?.public).toBe(true);
    expect(read?.name).toBe(name);
    expect(parsePublicGroupJoinToken(token)?.public).toBe(true);
  });

  it('LANE-10: a priced private pointer this app writes reads as itself — even one whose bytes also fit the public layout', () => {
    const nameLength = 4;
    const ownerHash = new Uint8Array(32).fill(0x33);
    ownerHash[30] = 12 + nameLength;
    const wallet = friendly(new Uint8Array(32).fill(0x44));
    const owner = friendly(ownerHash, true);
    const token = encodeGroupAskToken({ groupId: 'cd'.repeat(32), wallet, name: 'room', ownerWallet: owner, entryFee: '5000000000' });
    const body = token.slice(GROUP_ASK_PREFIX.length);
    expect(parsePublicGroupJoinToken(body), 'the public reader would take it too').not.toBeNull();
    const path = new URL(groupAskLink('https://example.invalid', token)).pathname;
    expect(route(path)).toEqual({ groupId: 'cd'.repeat(32), wallet, name: 'room', ownerWallet: owner, entryFee: '5000000000' });
    const broken = Buffer.from(body, 'base64url');
    broken[1 + 32 + 35] ^= 0x01;
    expect(parseGroupAskToken(`${GROUP_ASK_PREFIX}${broken.toString('base64url')}`)).toBeNull();
    const badOwner = Buffer.from(body, 'base64url');
    badOwner[69 + 5] ^= 0x10;
    expect(parseGroupAskToken(`${GROUP_ASK_PREFIX}${badOwner.toString('base64url')}`)).toBeNull();
    const crc16 = (bytes: Uint8Array) => {
      let crc = 0;
      for (const byte of bytes) { crc ^= byte << 8; for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; }
      return crc;
    };
    const resealed = (at: number, value: number) => {
      const copy = Buffer.from(body, 'base64url');
      copy[at] = value;
      const start = at === 33 || at === 34 ? 33 : 69;
      copy.writeUInt16BE(crc16(copy.subarray(start, start + 34)), start + 34);
      return `${GROUP_ASK_PREFIX}${copy.toString('base64url')}`;
    };
    expect(parseGroupAskToken(resealed(33, 0x51)), 'the same tag, resealed: still a door').not.toBeNull();
    expect(parseGroupAskToken(resealed(33, 0x22)), 'not a tag this chain uses').toBeNull();
    expect(parseGroupAskToken(resealed(34, 0x05)), 'not a workchain').toBeNull();
    expect(parseGroupAskToken(resealed(70, 0x05)), 'the owner\'s too').toBeNull();
    for (const reader of [RAW.slice(RAW.indexOf('const ask = parseGroupAskLink(location.pathname)'), RAW.indexOf('const ask = parseGroupAskLink(location.pathname)') + 120)]) {
      expect(reader).toContain('parseGroupAskLink(location.pathname) ?? parsePublicGroupJoinLink(location.pathname)');
    }
  });
});
