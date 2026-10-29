import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const RAW = readFileSync('web/app.js', 'utf8');
const HTML = readFileSync('web/index.html', 'utf8');
const S = I18N_STRINGS as Record<string, Record<string, string>>;
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
const t = (key: string) => `<${key}>`;

function elementsOf(html: string) {
  const out: Array<{ tag: string; id: string | null; cls: string[]; owner: string | null }> = [];
  const stack: any[] = [];
  const voids = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const [whole, tagRaw, attrs] = m;
    const tag = tagRaw.toLowerCase();
    if (whole.startsWith('</')) {
      for (let i = stack.length - 1; i >= 0; i -= 1) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const el = {
      tag,
      id: /\bid="([^"]*)"/.exec(attrs)?.[1] ?? null,
      cls: (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean),
      owner: [...stack].reverse().find((e) => e.id)?.id ?? null,
    };
    out.push(el);
    if (!voids.has(tag) && !whole.endsWith('/>')) stack.push(el);
  }
  return out;
}

describe('CLIENT AUDIT ROUND 8 — the batch from prod 1.3.60 to stage', () => {
  it('UNSCOPED-01 (E-01): every page-level class lookup binds exactly the element it means — a reordered page cannot rebind it', () => {
    const elements = elementsOf(HTML);
    const lookups = [...RAW.matchAll(/document\.querySelector\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
    const simple = lookups.filter((selector) => /^([a-z]+)?(\.[A-Za-z0-9_-]+)+$/.test(selector));
    expect(simple.length, 'the check reads the page-level class lookups').toBeGreaterThan(5);
    for (const selector of simple) {
      const tag = /^([a-z]+)/.exec(selector)?.[1] ?? null;
      const classes = [...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
      const matches = elements.filter((e) => (!tag || e.tag === tag) && classes.every((c) => e.cls.includes(c)));
      expect(matches.length, `document.querySelector('${selector}') binds ${matches.length} elements of the page`).toBeLessThanOrEqual(1);
    }
    expect(RAW).toContain("const sendButton = document.querySelector('#composer .send-button');");
    const sends = elements.filter((e) => e.cls.includes('send-button'));
    expect(sends.map((e) => e.owner).sort()).toEqual(['composer', 'publicComposer']);
  });

  describe('GCLASH (G-01): one group id, one lane — a crafted link cannot make a private group publish in the clear', () => {
    const ID = 'ab'.repeat(32);
    const GROUP_ID = new Uint8Array(32).fill(0xab);

    it('GCLASH-01: a public join pointer naming a group the private lane holds is refused — no dialog, no join', async () => {
      const calls: string[] = [];
      let privateHolds = true;
      const scope: any = {
        plathoWallet: { address: 'EQ-reader' },
        ensurePublicGroupRuntime: async () => ({ get: () => null, join: async () => { calls.push('join'); return {}; } }),
        ensureGroupRuntime: async () => ({ get: (id: string) => (privateHolds && id === ID ? { groupId: GROUP_ID } : null) }),
        flashWalletIdentityStatus: (text: string) => { calls.push(`flash ${text}`); },
        runGroupControlDialog: async () => { calls.push('dialog'); return true; },
        openGroupThread: () => { calls.push('open'); },
        ensureGroupThread: (record: any) => record,
        publicGroupControlPriceLine: () => '',
        PUBLIC_GROUP_KIND: { JOIN: 1 },
        t,
      };
      const join = inAppScope([fn('async function joinPublicGroup('), fn('async function groupIdOnOtherLane(')], 'joinPublicGroup', scope);
      const pointer = { groupId: GROUP_ID, founder: new Uint8Array(32).fill(1), name: 'Book club' };
      await join(pointer, null);
      expect(calls, 'a private group of that id: refused, said once').toEqual(['flash <group.laneClash>']);
      privateHolds = false;
      calls.length = 0;
      await join(pointer, null);
      expect(calls, 'an id no lane holds: the join is offered as before').toEqual(['dialog']);
    });

    it('GCLASH-02: a private invite naming a public group this device holds is refused — never adopted', async () => {
      const calls: string[] = [];
      let publicHolds = true;
      const scope: any = {
        activeThreadId: null,
        threads: [],
        ensureGroupRuntime: async () => ({ get: () => null, adopt: async () => { calls.push('adopt'); return { groupId: GROUP_ID }; } }),
        ensurePublicGroupRuntime: async () => ({ get: (id: string) => (publicHolds && id === ID ? { groupId: GROUP_ID } : null) }),
        flashWalletIdentityStatus: (text: string) => { calls.push(`flash ${text}`); },
        isGroupThread: () => false,
        ensureGroupThread: (record: any) => record,
        refreshThreadAfterMessageChange: () => {},
        openGroupThread: () => { calls.push('open'); },
        t,
      };
      const accept = inAppScope([fn('async function acceptGroupInvite('), fn('async function groupIdOnOtherLane(')], 'acceptGroupInvite', scope);
      await accept({ groupId: ID }, null);
      expect(calls).toEqual(['flash <group.laneClash>']);
      publicHolds = false;
      calls.length = 0;
      await accept({ groupId: ID }, null);
      expect(calls).toEqual(['adopt', 'open']);
    });

    it('GCLASH-03: while both lanes hold an id open nothing is sent; otherwise the lane still held open takes the row', async () => {
      const run = async (publicHeld: any, privateHeld: any) => {
        const said: string[] = [];
        const status = { textContent: '' };
        const input = { value: 'hello' };
        const scope: any = {
          groupIdOfThread: () => ID,
          ensurePublicGroupRuntime: async () => ({ get: () => publicHeld, say: async () => { said.push('public'); return { key: 'k' }; } }),
          ensureGroupRuntime: async () => ({ get: () => privateHeld, say: async () => { said.push('private'); return { epoch: 1, generation: 0, firstSeq: 0 }; } }),
          groupSelfIsBanned: () => false,
          groupSelfIsMuted: () => false,
          flashWalletIdentityStatus: (text: string) => { status.textContent = text; },
          messageInput: input,
          persistMessageToEncryptedHistory: () => Promise.resolve(),
          ensureGroupThread: (record: any) => record,
          plathoWallet: { address: 'EQ-reader' },
          t,
        };
        const send = inAppScope([fn('async function sendGroupMessageFromComposer(')], 'sendGroupMessageFromComposer', scope);
        await send({ id: `group:${ID}`, messages: [] }, 'hello');
        return { said, status: status.textContent, input: input.value };
      };
      const open = { groupId: GROUP_ID };
      const left = { groupId: GROUP_ID, leftAt: 1 };
      expect(await run(open, open), 'both open: sent nowhere, the text kept, the reader told')
        .toEqual({ said: [], status: '<group.laneClashSend>', input: 'hello' });
      expect((await run(left, open)).said, 'the public one left: the private group takes it').toEqual(['private']);
      expect((await run(open, left)).said, 'the private one left: the public room takes it').toEqual(['public']);
      expect((await run(open, null)).said).toEqual(['public']);
      expect((await run(null, open)).said).toEqual(['private']);
    });

    it('GCLASH-04: a restore plants no public entry under an id the private lane holds — the private group wins', async () => {
      const planted: string[] = [];
      const OTHER = 'cd'.repeat(32);
      const scope: any = {
        plathoWallet: { seed: new Uint8Array(32), address: 'EQ-reader' },
        globalThis: { plathoWalletRpcTransport: { runGetMethod: () => {} } },
        readSelfSlotLedger: async () => null,
        rawWalletAddress: (value: any) => value,
        criticalRecoveryReaders: () => ({ readView: null, readBody: null }),
        createSelfSlotStatesReader: () => null,
        restoreGroupsEntries: async () => ({ clean: true, entries: [{ g: ID, kind: 'private' }, { g: ID, kind: 'public' }, { g: OTHER, kind: 'public' }] }),
        isPublicGroupRecoveryEntry: (entry: any) => entry.kind === 'public',
        ensureGroupRuntime: async () => ({
          list: () => [{ groupId: GROUP_ID }],
          get: (id: string) => (id === ID ? { groupId: GROUP_ID } : null),
          adopt: async () => { planted.push('private'); },
        }),
        ensurePublicGroupRuntime: async () => ({ has: () => false, adopt: async (groupId: string) => { planted.push(`public ${groupId}`); } }),
        publicGroupRecoveryPointer: (entry: any) => ({ groupId: entry.g }),
        groupsRecoverySecret: (entry: any) => entry,
        syncGroupsFromChain: async () => {},
        renderThreads: () => {},
      };
      const restore = inAppScope([fn('async function restoreGroupsFromRecoveryIfFresh(')], 'restoreGroupsFromRecoveryIfFresh', scope);
      await restore(null);
      expect(planted, 'the id the private lane holds is skipped; another public entry is planted').toEqual([`public ${OTHER}`]);
    });

    it('GCLASH-05: the refusals are said in every language', () => {
      for (const locale of Object.keys(S)) {
        expect(S[locale]['group.laneClash'], locale).toBeTruthy();
        expect(S[locale]['group.laneClashSend'], locale).toBeTruthy();
      }
      expect(S.en['group.laneClash']).toContain('the other kind');
    });
  });

  describe('PREFSNAP (B-01): the follow-list backup carries what the reader chose, not every channel the app drew', () => {
    const A = `0:${'0a'.repeat(32)}`;
    const B = `0:${'0b'.repeat(32)}`;
    const C = `0:${'0c'.repeat(32)}`;

    it('PREFSNAP-01: a followed channel and an unfollowed one are carried; a channel merely drawn (a repost, a post from All) is not', () => {
      const scope: any = {
        publicChannelSubscriptions: { channels: [{ id: `wallet:${A}`, subscribed: true }, { id: `wallet:${B}`, subscribed: false }, { id: `wallet:${C}`, subscribed: false }] },
        customPublicChannels: [A, B, C].map((w) => ({ id: `wallet:${w}`, authorWallet: w, name: 'auto' })),
        readPrefsUnfollowedIds: () => new Set([`wallet:${B}`]),
        plathoWallet: null,
        DEFAULT_PUBLIC_CHANNEL_ID: 'platho.app',
        rawWalletAddress: (value: any) => value ?? null,
        sameWalletAddress: (a: any, b: any) => a === b,
        shortAddress: () => 'auto',
      };
      const build = inAppScope([fn('function buildPrefsSnapshot(')], 'buildPrefsSnapshot', scope);
      const snapshot = build();
      expect(snapshot.channels.map((entry: any) => [entry.w, entry.sub])).toEqual([[A, true], [B, false]]);
    });

    it('PREFSNAP-02: unfollowing a followed channel is remembered for the backup; following again forgets it; a drawn channel never enters', () => {
      const store = new Map<string, string>();
      const scope: any = {
        publicChannelStorage: () => ({ getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } }),
        PREFS_UNFOLLOWED_STORAGE_KEY: 'platho.prefs.unfollowed.v1',
        publicChannelSubscriptions: { activeChannelId: null, channels: [{ id: 'a', subscribed: true }, { id: 'b', subscribed: false }] },
        publicChannelRegistry: [{ id: 'a' }, { id: 'b' }],
        writePublicChannelSubscriptions: () => {},
        rebuildThreadsFromPublicSubscriptions: () => {},
        personalPublicAwaitingSeal: () => false, personalPublicSealed: () => false, personalPublicSealOpen: () => true,
      };
      const set = inAppScope([fn('function readPrefsUnfollowedIds('), fn('function writePrefsUnfollowedIds('), fn('function setPublicChannelsSubscribed(')], 'setPublicChannelsSubscribed', scope);
      const held = () => JSON.parse(store.get('platho.prefs.unfollowed.v1') ?? '[]');
      set(['b'], false);
      expect(held(), 'b was never followed: nothing to tell another device').toEqual([]);
      set(['a'], false);
      expect(held()).toEqual(['a']);
      set(['a'], true);
      expect(held(), 'followed again: the unfollow is moot').toEqual([]);
    });

    it('PREFSNAP-03: the one-slot ceiling this round measured (35 fit, the 36th made 80 cells) is gone — past the last prefs slot the reader is told so by name', async () => {
      const { encodePrefsSnapshotChunks } = await import('../web/public-channel-subscriptions.mjs');
      const { PREFS_CHUNK_PLAINTEXT_MAX } = await import('../web/recovery-lane.mjs');
      const hex = (i: number) => i.toString(16).padStart(64, '0');
      const channels = (n: number) => Array.from({ length: n }, (_, i) => ({ w: `0:${hex(i + 1)}`, sub: true, name: null }));
      expect(encodePrefsSnapshotChunks({ writtenAt: 1, channels: channels(36), usernames: ['someone.ath'], linked: 'someone.ath' }, { chunkBytes: PREFS_CHUNK_PLAINTEXT_MAX, maxChunks: 4 }).chunks).toHaveLength(1);
      expect(RAW).toContain('if (encoded.followedOverflow > 0) {');
      expect(RAW).toMatch(/error\?\.code === 'RECOVERY_BLOB_OVERFLOW' \? t\('sync\.saveTooLarge'\)\s*: \(error\?\.code === 'PLATHO_WALLET_GRAM_REQUIRED' \? String\(error\.message\) : t\('sync\.saveFailed'\)\)/);
      for (const locale of Object.keys(S)) expect(S[locale]['sync.saveTooLarge'], locale).toBeTruthy();
    });
  });

  it('ALLCHAN-01 (B-02/H-05): a post All keeps comes out with its channel; a surface that keeps the original never takes All\'s copy', async () => {
    const WALLET = `0:${'0d'.repeat(32)}`;
    const HASH = `0x${'ee'.repeat(32)}`;
    const kept = { id: 'p1', entryId: '20800.0.1', bodyHash: HASH, authorWallet: WALLET };
    const records = new Map([[WALLET, { channelId: `wallet:${WALLET}`, shards: new Map([['s', { posts: [kept] }]]) }]]);
    const chain: string[] = [];
    const scope: any = {
      publicAllFeedRecords: records,
      rawWalletAddress: (value: any) => value ?? null,
      normalizeBodyHashHex: (value: any) => String(value ?? '').toLowerCase(),
      findCachedPublicPostByEntryId: () => null,
      sharedPostChainReads: new Map(),
      SHARED_POST_CHAIN_READ_LIMIT: 8,
      fetchSharedPostFromChain: async (_entry: string, _hash: string, _wallet: string, options: any) => { chain.push(options.keep ? 'keep' : 'read'); return null; },
    };
    const find = inAppScope([fn('function findAllFeedPostByEntryId(')], 'findAllFeedPostByEntryId', scope);
    const found = find('20800.0.1', WALLET);
    expect(found.channelId, 'the channel rides with the post').toBe(`wallet:${WALLET}`);
    expect(kept).not.toHaveProperty('channelId');
    const resolve = inAppScope([fn('function findAllFeedPostByEntryId('), fn('function resolveSharedPostOriginal(')], 'resolveSharedPostOriginal', scope);
    expect((await resolve('20800.0.1', HASH, WALLET, { keep: false }))?.channelId, 'All reads its own copy').toBe(`wallet:${WALLET}`);
    expect(chain).toEqual([]);
    await resolve('20800.0.1', HASH, WALLET, { keep: true });
    expect(chain, 'a keeping surface reads the chain (or the Following cache), not All\'s copy').toEqual(['keep']);
  });

  it('COMMENTCOUNT-01 (B-02): a comment is counted as placed only when its row was placed — a failed send gives the words back', () => {
    const run = (cached: any[]) => {
      const scope: any = {
        publicOptimisticRecordsPlaced: 0,
        publicChannelFeedCache: { ch: { feed: { version: 1, channelId: 'ch', posts: cached } } },
        sameCachedPublicPost: (post: any, parent: any) => post.id === parent.id,
        currentProfilePointerFields: () => ({}),
        normalizePublicImageAttachments: () => [],
        displayBlocksFromDocumentBlocks: () => [],
        publicDocumentBlocksFromDraft: () => [],
        messagePreviewFromBlocks: () => '',
        publicAuthorLabel: () => 'me',
        plathoWallet: { address: 'EQ-me' },
        commitPublicChannelFeedCache: () => {},
        rebuildThreadsFromPublicSubscriptions: () => {},
        renderPublicSurface: () => {},
      };
      const remember = inAppScope([fn('function rememberLocalPublicComment(')], 'rememberLocalPublicComment', scope);
      remember({ id: 'post', channelId: 'ch', entryId: '1', bodyHash: 'h' }, 'hello', 'h2');
      return scope.publicOptimisticRecordsPlaced;
    };
    expect(run([{ id: 'post', comments: [] }]), 'the parent is held: the row is placed and counted').toBe(1);
    expect(run([]), 'no parent: no row, not counted — the composer gives the text back on a failure').toBe(0);
  });

  it('GROUPOPEN-01 (D-01): a private group opened from inside a public room is the conversation shown — the view first, then the selection', () => {
    const order: string[] = [];
    const scope: any = {
      activeThreadId: 'dialog',
      appShell: { dataset: { view: 'public', chatOpen: 'false', roomOpen: 'true' } },
      isPublicRoomThread: () => false,
      setView: (view: string) => { order.push(`view ${view}`); scope.activeThreadId = 'dialog-set-aside'; scope.appShell.dataset.view = view; },
      renderThreads: () => { order.push(`threads ${scope.activeThreadId}`); },
      renderConversation: () => { order.push(`conversation ${scope.activeThreadId}`); },
    };
    const open = inAppScope([fn('function openGroupThread(')], 'openGroupThread', scope);
    open({ id: 'group:private' });
    expect(scope.activeThreadId).toBe('group:private');
    expect(order).toEqual(['view chats', 'threads group:private', 'conversation group:private']);
    expect(scope.appShell.dataset.chatOpen).toBe('true');
  });

  describe('CLAIMS (A-01/H-04): a stranger\'s claimed name costs the reader nothing it did not ask for', () => {
    it('CLAIMS-01: "not registered" is an answer — cached like another owner, not asked again on the next decode', async () => {
      class UsernameNotRegisteredError extends Error {}
      let asked = 0;
      const scope: any = {
        UsernameNotRegisteredError,
        verifiedPlathoUsernameOwnerCache: new Map(),
        PLATHO_USERNAME_OWNER_CACHE_TTL_MS: 300_000,
        rawWalletAddress: (value: any) => value,
        plathoUsernameIdentity: (label: string) => ({ value: label, label }),
        resolvePlathoUsernameOwner: async () => { asked += 1; throw new UsernameNotRegisteredError('nobody holds it'); },
        noteTonRpcRateLimit: () => false,
        console: { warn: () => {} },
      };
      const verify = inAppScope([fn('async function verifiedPlathoUsernameIdentityForWallet(')], 'verifiedPlathoUsernameIdentityForWallet', scope);
      expect(await verify('ghost', '0:aa')).toBeNull();
      expect(await verify('ghost', '0:aa')).toBeNull();
      expect(asked, 'asked once, then answered from the cache').toBe(1);
      scope.resolvePlathoUsernameOwner = async () => { asked += 1; throw new Error('timeout'); };
      scope.verifiedPlathoUsernameOwnerCache = new Map();
      const verifyAgain = inAppScope([fn('async function verifiedPlathoUsernameIdentityForWallet(')], 'verifiedPlathoUsernameIdentityForWallet', scope);
      await verifyAgain('ghost', '0:aa');
      await verifyAgain('ghost', '0:aa');
      expect(asked).toBe(3);
    });

    it('CLAIMS-02: a channel\'s name is proven at the background class, and not again while the proof is fresh', () => {
      const queued: any[] = [];
      const now = Math.floor(Date.now() / 1000);
      const scope: any = {
        publicChannelProfileCache: { k: { verifiedUsername: 'alice.ath', verifiedUsernameAt: now - 60 } }, pendingChannelProfileOverlay: new Map(),
        channelProfileCacheKey: () => 'k',
        plathoUsernameIdentity: (label: string) => (label ? { value: String(label).replace(/\.ath$/, ''), label } : null),
        rawWalletAddress: (value: any) => value,
        nowSec: () => now,
        CHANNEL_USERNAME_VERIFY_TTL_SEC: 6 * 3600,
        applyVerifiedChannelUsername: () => {},
        queueUsernameHygiene: (job: any) => { queued.push(job); },
      };
      const verify = inAppScope([fn('function channelProfileDeclaresOtherName(key, value) {'), fn('function verifyChannelUsernameClaim(')], 'verifyChannelUsernameClaim', scope);
      verify('0:aa', 'alice');
      expect(queued.length, 'proven a minute ago: not asked').toBe(0);
      scope.publicChannelProfileCache.k.verifiedUsernameAt = now - 7 * 3600;
      verify('0:aa', 'alice');
      expect(queued.length, 'the proof is old: asked again').toBe(1);
      verify('0:aa', 'bob');
      expect(queued.length, 'another claim: asked').toBe(2);
      const src = fn('function verifyChannelUsernameClaim(');
      expect(src).toContain("const readOptions = { ...criticalChainReadOptions(), priority: 'background', skipIfRateLimited: true };");
      expect(src).toContain('verifiedPlathoUsernameIdentityForWallet(identity.value, rawWallet, { readOptions })');
      expect(fn('function applyVerifiedChannelUsername(')).toContain('verifiedUsernameAt: provenAt');
      expect(readFileSync('web/public-channel-subscriptions.mjs', 'utf8')).toContain('verifiedUsernameAt: toInt(value.verifiedUsernameAt),');
    });

    it('ALLDECODE-01: the All pass decodes strangers\' posts without proving their claims or adopting their profiles; every other decode still does', () => {
      const pass = fn('async function publicAllFeedPassBody(');
      expect(pass).toContain('await publicPostPartsFromShardPosts(read.posts, { id: record.channelId, authorWallet: item.wallet }, { adoptProfiles: false }),');
      expect(pass).toContain('{ adoptClaims: false });');
      expect(fn('function assemblePublicParts(')).toContain('if (adoptClaims) adoptPostSenderUsernameClaim(first?.authorWallet, senderClaim);');
      expect(fn('async function publicPostPartsFromShardPosts(')).toContain('if (adoptProfiles) setChannelProfileFromWalk(authorWallet, profileDoc.profileBlock, sp.entry_id, createdAtSec);');
      const quiet = [...RAW.matchAll(/adoptClaims: false|adoptProfiles: false/g)].length;
      expect(quiet, 'the All pass decodes quietly — and the moderators\' window, which takes no name claim from a reported entry, one part or a post in parts, its profiles not adopted either [2026-10-27; round 77 — C9-32; 78 — C9-35]').toBe(5);
    });
  });

  it('MEDIARANK-01 (A-03): the All feed\'s image store evicts the OLDEST POSTS\' pictures, not the ones written longest ago', async () => {
    const { IDBFactory } = await import('fake-indexeddb');
    const { createProfileAvatarMediaStore } = await import('../web/profile-avatar-media-store.mjs');
    const saved = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = new IDBFactory();
    try {
      const store = await createProfileAvatarMediaStore({ dbName: 'mediarank-01', cap: 2 });
      await store.put('newest-post', 'data:a', { rankAt: 3_000 });
      await store.put('oldest-post', 'data:b', { rankAt: 1_000 });
      await store.put('middle-post', 'data:c', { rankAt: 2_000 });
      const kept = await store.getMany(['newest-post', 'oldest-post', 'middle-post']);
      expect([...kept.keys()].sort(), 'the oldest post\'s picture went, though it was not written first').toEqual(['middle-post', 'newest-post']);
      await store.put('plain', 'data:d');
      expect([...(await store.getMany(['plain', 'middle-post', 'newest-post'])).keys()].sort()).toEqual(['newest-post', 'plain']);
    } finally {
      (globalThis as any).indexedDB = saved;
    }
    expect(fn('function persistPublicAllFeedMedia(')).toContain('await store.put(key, JSON.stringify(media), { rankAt });');
    expect(fn('function savePublicAllFeedRecord(')).toContain('store?.put(wallet, text, { rankAt: Number.isFinite(rankAt) ? rankAt : null })');
  });

  it('FEEDGAP-01 (C-01): the Following feed shows no silent hole — posts below a gap the sync could not read leave the feed; the rest stay', () => {
    const post = (entryId: string, id = entryId) => ({ id, entryId });
    const posts = [
      post('20800.0.24'), post('20800.0.119'),
      post('20800.0.174'), post('20800.0.269'),
      post('20800.1.5'),
      post('20800.0.30.18'),
      { id: 'local-1', entryId: null },
    ];
    const drop = inAppScope([fn('function dropPostsBelowFeedGaps('), fn('function sharedPostShardCoordinates(')], 'dropPostsBelowFeedGaps', {});
    const kept = drop(posts, [{ epochTag: '20800', seq: 0, generation: 17, floor: 120, top: 174 }]);
    expect(kept.map((item: any) => item.id)).toEqual(['20800.0.174', '20800.0.269', '20800.1.5', '20800.0.30.18', 'local-1']);
    expect(drop(posts, []), 'no gap: the same list').toBe(posts);
    const sync = RAW.slice(RAW.indexOf('postsByWallet = await lane.readChannelPostsMany('), RAW.indexOf('publicChannelFeedCache = {', RAW.indexOf('postsByWallet = await lane.readChannelPostsMany(')));
    expect(sync).toContain('burstPages: PUBLIC_FEED_BURST_PAGES,');
    expect(sync).toContain('const merged = dropPostsBelowFeedGaps(applyHiddenBitmaps(upsertPublicChainPosts(existing, posts.map((post) => ({ ...post, seeded: false }))),');
    expect(sync).toContain('shardPosts.hidden), shardPosts.gaps);');
  });

  it('EMBEDMOD-01 (B-05): a repost of a muted or restricted author draws nothing of the post; the authors of reposts are asked about', () => {
    const makeEl = (tag: string): any => {
      const el: any = { tagName: tag, children: [] as any[], className: '', textContent: '', dataset: {}, append(...nodes: any[]) { el.children.push(...nodes); },
        setAttribute() {}, addEventListener() {} };
      return el;
    };
    let resolved = 0;
    const scope: any = {
      document: { createElement: makeEl },
      rawWalletAddress: (value: any) => value ?? null,
      publicChannelVisibleUnderModeration: ({ authorWallet }: any) => authorWallet !== 'MUTED',
      t: (key: string) => `<${key}>`,
      resolveSharedPostOriginal: () => { resolved += 1; return Promise.resolve(null); },
    };
    const build = inAppScope([fn('function buildSharedPostEmbed(')], 'buildSharedPostEmbed', scope);
    const hidden = build({ type: 'share', authorWallet: 'MUTED', snippet: 'secret text', hasImage: true, entryId: '1', bodyHash: '0x' });
    expect(hidden.children.map((child: any) => [child.className, child.textContent])).toEqual([['shared-post-embed-hidden', '<public.sharedPostHidden>']]);
    expect(resolved, 'and no chain read of it').toBe(0);
    for (const locale of Object.keys(S)) expect(S[locale]['public.sharedPostHidden'], locale).toBeTruthy();
    const onScreen = inAppScope([fn('function moderationAuthorsOnScreen(')], 'moderationAuthorsOnScreen', {
      rawWalletAddress: (value: any) => value ?? null,
      plathoWallet: null,
      publicSurfaceItems: () => [{ authorWallet: 'F', blocks: [{ type: 'share', authorWallet: 'REPOSTED-IN-FOLLOWING' }] }],
      publicItemAuthor: (item: any) => item.authorWallet,
      publicChannelRegistry: [],
      publicDiscoveryResults: [],
      publicAllFeedRecords: new Map([['A', { shards: new Map([['s', { posts: [{ blocks: [{ type: 'share', authorWallet: 'REPOSTED-IN-ALL' }] }] }]]) }]]),
      publicPostDetailOpen: false,
    });
    expect(onScreen().sort()).toEqual(['A', 'F', 'REPOSTED-IN-ALL', 'REPOSTED-IN-FOLLOWING']);
  });

  it('LATEST-01 (C-03): a card opened again gets its latest post — a wallet already waiting is pumped, and an error is asked again', () => {
    const pumped: string[] = [];
    const states = new Map<string, any>();
    const scope: any = {
      discoveryLatestHasAnAudience: () => true,
      discoveryLatestState: (wallet: string) => states.get(wallet) ?? null,
      publicDiscoveryLatestInFlight: new Set<string>(),
      publicDiscoveryLatestQueue: ['C'],
      publicDiscoveryLatestPosts: states,
      pumpDiscoveryLatestPosts: () => pumped.push('pump'),
    };
    const queue = inAppScope([fn('function queueDiscoveryLatestPost(')], 'queueDiscoveryLatestPost', scope);
    states.set('C', { status: 'loading' });
    queue('C', { retry: true });
    expect(pumped, 'already queued: the pump is started anyway').toEqual(['pump']);
    states.set('E', { status: 'error', attempts: 2 });
    queue('E', { retry: true });
    expect(states.get('E'), 'an error, asked again: loading').toEqual({ status: 'loading', attempts: 2 });
    expect(scope.publicDiscoveryLatestQueue).toEqual(['C', 'E']);
    states.set('P', { status: 'post' });
    queue('P', { retry: true });
    expect(scope.publicDiscoveryLatestQueue, 'an answer held is kept').toEqual(['C', 'E']);
    expect(fn('async function restoreOrQueueLatestPost(')).toContain("if (state && !state.stale && state.status !== 'loading' && state.status !== 'error') {");
  });

  it('AVATARABSENT-01 (F-09): "no avatar" for the current face is remembered, and a wallet known to have none takes no slot', async () => {
    expect(fn('async function loadProfileAvatarImage(')).toContain('else noteProfileAvatarAbsent(ownerWallet);');
    expect(fn('function noteProfileAvatarAbsent(')).toContain('profileAvatarAbsentUntil.set(ownerWallet, until);');
    const asked: string[] = [];
    const scope: any = {
      rawWalletAddress: (value: any) => value,
      publicChannelAvatarUrlByWallet: new Map([['HELD', 'data:x']]),
      profileAvatarAbsentUntil: new Map([['NONE', Date.now() + 60_000], ['EXPIRED', Date.now() - 1]]),
      loadProfileAvatarImage: async (wallet: string) => { asked.push(wallet); return null; },
      noteTonRpcRateLimit: () => false,
      console: { error: () => {} },
    };
    const hydrate = inAppScope([fn('async function hydrateProfileAvatarsForWallets(')], 'hydrateProfileAvatarsForWallets', scope);
    await hydrate(['HELD', 'NONE', 'EXPIRED', 'NEW'], { limit: 2 });
    expect(asked, 'the held face and the known-absent one take no slot; an expired answer is asked again').toEqual(['EXPIRED', 'NEW']);
  });

  it('KINDHINT-01 (C-04/C-05): the create dialog says what is final; All and the notice say what is true', () => {
    expect(S.en['group.kindHint']).toBe('Public or private is for good: it cannot be changed after the group is created.');
    expect(S.en['public.channelNotListedTitle']).toContain('Other readers');
    expect(S.en['public.allFeedEmptyHint']).toContain('description or tags');
    for (const locale of Object.keys(S)) {
      expect(S[locale]['public.channelNotListedTitle'], locale).toContain('{section}');
      if (locale !== 'en') expect(S[locale]['group.kindHint'], `${locale} is translated`).not.toBe(S.en['group.kindHint']);
    }
  });

  it('DRAFTMERGE-01 (H-10): a dialog merged into the one it duplicated keeps the text being typed in it — Send works at once, and no repaint empties the field', () => {
    const world = (drafts: Array<[string, any]>, active: string) => {
      const source = { id: 'thread-by-name', messages: [] as any[] };
      const target = { id: 'thread-by-wallet', messages: [] as any[] };
      const other = { id: 'thread-other', messages: [] as any[] };
      const message = { id: 'm1', type: 'out', text: 'first' };
      source.messages.push(message);
      const scope: any = {
        threads: [source, target, other],
        activeThreadId: active,
        privateThreadId: null,
        composerDraftThreadId: active,
        privateComposerDraftsByThread: new Map(drafts),
        privateImageAttachments: [],
        privateFileAttachments: [],
        privateReplyDraft: null,
        privateShareDraft: null,
        messageInput: { value: 'second, half typed' },
        setPrivateReplyDraft: (value: any) => { scope.privateReplyDraft = value; },
        setPrivateShareDraft: (value: any) => { scope.privateShareDraft = value; },
        isSavedMessagesThread: () => false,
        insertThreadMessage: (thread: any, row: any) => { thread.messages.push(row); },
        threadUnreadCount: () => 0,
        threadIdentityVariants: () => [],
        refreshThreadAfterMessageChange: () => {},
        refreshThreadIdentityFromVariants: () => {},
        applyThreadDisplayFields: () => {},
        syncThreadDisplayToContactStore: () => {},
        persistThreadDisplayPreference: () => {},
        pruneEmptyAnonymousPeerThreads: () => {},
        RECIPIENT_IDENTITY_TYPES: { WALLET_ADDRESS: 'wallet_address' },
      };
      const api = inAppScope([
        fn('function relocateExistingCapsuleMessage('),
        fn('function currentComposerDraftSnapshot('),
        fn('function composerDraftIsEmpty('),
        fn('function syncComposerDraftToActiveThread('),
      ], '{ relocate: relocateExistingCapsuleMessage, repaint: syncComposerDraftToActiveThread }', scope);
      return { scope, api, source, target, message };
    };

    {
      const { scope, api, source, target, message } = world([], 'thread-by-name');
      expect(api.relocate({ thread: source, message }, target)).toBe(true);
      expect(scope.threads.map((thread: any) => thread.id), 'the duplicate is merged away').toEqual(['thread-by-wallet', 'thread-other']);
      expect(scope.activeThreadId).toBe('thread-by-wallet');
      expect(scope.composerDraftThreadId, 'Send is not refused as text typed for another conversation').toBe(scope.activeThreadId);
      api.repaint();
      expect(scope.messageInput.value, 'the repaint leaves the text where it is').toBe('second, half typed');
      expect([...scope.privateComposerDraftsByThread.keys()], 'nothing is stashed under a dialog that no longer exists').toEqual([]);
    }
    {
      const stash = { text: 'kept for later', images: [], files: [], reply: null, share: null };
      const { scope, api, source, target, message } = world([['thread-by-name', stash]], 'thread-other');
      api.relocate({ thread: source, message }, target);
      expect(scope.activeThreadId, 'the dialog on screen is not touched').toBe('thread-other');
      expect(scope.composerDraftThreadId).toBe('thread-other');
      expect(scope.privateComposerDraftsByThread.get('thread-by-wallet')).toBe(stash);
      expect(scope.privateComposerDraftsByThread.has('thread-by-name')).toBe(false);
      expect(scope.messageInput.value, 'the field on screen is its own dialog\'s').toBe('second, half typed');
    }
    {
      const own = { text: 'the survivor\'s own', images: [], files: [], reply: null, share: null };
      const merged = { text: 'the duplicate\'s', images: [], files: [], reply: null, share: null };
      const { scope, api, source, target, message } = world([['thread-by-name', merged], ['thread-by-wallet', own]], 'thread-other');
      api.relocate({ thread: source, message }, target);
      expect(scope.privateComposerDraftsByThread.get('thread-by-wallet')).toBe(own);
      expect(scope.privateComposerDraftsByThread.has('thread-by-name')).toBe(false);
    }
  });

  it('PROFILEKEEP-01 (H-07): a catalogue sweep never evicts the profiles of the channels one follows, the people one talks to, or one\'s own', () => {
    const people: any = {
      plathoWallet: { address: 'OWN' },
      feedSourcePublicChannels: () => [{ id: 'c1', authorWallet: 'FOLLOWED' }, { id: 'c2', authorWallet: null }],
      threads: [{ id: 'dm:wallet_address:CONTACT' }, { id: 'group:room' }],
      channelProfileCacheKey: (wallet: string) => String(wallet),
      threadPrimaryWalletRaw: (thread: any) => /^dm:wallet_address:(.+)$/.exec(thread.id)?.[1] ?? null,
    };
    const keptFirst = inAppScope([fn('function channelProfilesKeptFirst(')], 'channelProfilesKeptFirst', { ...people })();
    expect([...keptFirst].sort()).toEqual(['CONTACT', 'FOLLOWED', 'OWN']);

    const cache: Record<string, any> = {
      FOLLOWED: { fetchedAt: 1, verifiedUsername: 'followed' }, CONTACT: { fetchedAt: 2 }, OWN: { fetchedAt: 3 },
    };
    for (let i = 0; i < 600; i += 1) cache[`S${i}`] = { fetchedAt: 1000 + i };
    const timers: Array<() => void> = [];
    const written: any[] = [];
    const world: any = {
      ...people,
      PUBLIC_CHANNEL_PROFILE_CACHE_MAX: 512, PUBLIC_CHANNEL_PROFILE_KEPT_CEILING: 8192,
      PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS: 2_000_000,
      publicChannelProfileCache: cache,
      profileCachePersistTimer: null,
      setTimeout: (callback: () => void) => { timers.push(callback); return 1; },
      publicChannelStorage: () => ({}),
      writePublicChannelProfileCache: (_storage: any, value: any) => { written.push(value); return true; },
    };
    const persist = inAppScope([
      fn('function channelProfilesKeptFirst('),
      fn('function boundChannelProfileCache('),
      fn('function persistChannelProfileCache('),
    ], 'persistChannelProfileCache', world);
    persist();
    for (const run of timers) run();
    const after = world.publicChannelProfileCache;
    expect(Object.keys(after).length, '[round 20 — A13] the 512 are the strangers\'; the kept three come on top').toBe(515);
    expect(after.FOLLOWED?.verifiedUsername, 'the followed channel keeps its verified name').toBe('followed');
    expect(after.CONTACT && after.OWN).toBeTruthy();
    expect(after.S599, 'the strangers\' places go to the newest').toBeTruthy();
    expect(after.S87).toBeUndefined();
    expect(after.S88).toBeTruthy();
    expect(written.at(-1), 'what is kept is what is written').toBe(after);
  });
});
