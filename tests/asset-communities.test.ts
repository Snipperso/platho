import { describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import {
  ASSET_KIND, COMMUNITY_ACTION, COMMUNITY_POINTER, assetCommunitiesUid, assetRawAddress, decodeCommunityRow, encodeCommunityRow,
  foldAssetCommunities, officialCommunitiesIn, profileGroupsWithAbout, readCommunityPointer,
} from '../web/asset-communities.mjs';
import {
  PROFILE_GROUP_ABOUT_MAX, decodeProfileBlockContent, encodeProfileBlockContent, normalizeProfileGroups,
} from '../web/capsule-part-policy.mjs';
import { encodeGroupAskToken } from '../web/group-protocol.mjs';
import { encodePublicGroupJoinToken } from '../web/public-group-protocol.mjs';
import { decodeProfileBlockContentOf1526 } from './fixtures/profile-block-decoder-1.5.26.mjs';
import { decodeProfileBlockContentOf1424 } from './fixtures/profile-block-decoder-1.4.24.mjs';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { code, sourceBlock } from './helpers/source';

const app = readFileSync('web/app.js', 'utf8');


const raw = (fill: string) => `0:${fill.repeat(64).slice(0, 64)}`;
const friendly = (address: string) => Address.parse(address).toString({ bounceable: false, urlSafe: true });
const hash = (address: string) => address.slice(2);

const TOKEN = raw('a1');
const OTHER = raw('b2');
const FOUNDER = raw('c3');
const STRANGER = raw('d4');
const ADMIN = raw('e5');
const AUTHORITY = raw('f6');
const groupId = (n: number) => new Uint8Array(32).fill(n);
const hexOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const publicToken = encodePublicGroupJoinToken({ groupId: groupId(1), founder: Buffer.from(hash(FOUNDER), 'hex'), name: 'Lantern Club' });
const privateToken = encodeGroupAskToken({ groupId: hexOf(groupId(2)), wallet: friendly(ADMIN), name: 'Quiet Harbour' });

const row = (action: number, pointerKind: number, token: string, asset = TOKEN) =>
  decodeCommunityRow(encodeCommunityRow({ action, assetKind: ASSET_KIND.JETTON, asset, pointerKind, token }));
let order = 0;
const at = (publisher: string, createdAt: number, decoded: any, hidden = false) => ({ publisher, createdAt, order: order++, hidden, row: decoded });

describe('the thread and the row', () => {
  it('COMM-01: one thread per address, whatever spelling of it, and another for another address', () => {
    expect(assetCommunitiesUid(TOKEN)).toBe(assetCommunitiesUid(friendly(TOKEN)));
    expect(assetCommunitiesUid(TOKEN)).not.toBe(assetCommunitiesUid(OTHER));
    expect(assetCommunitiesUid(TOKEN) < (1n << 256n)).toBe(true);
    expect(assetRawAddress(`-1:${'a1'.repeat(32)}`), 'masterchain is no asset').toBe(null);
  });

  it('COMM-02: a row reads back exactly, and anything not exactly one reads as nothing', () => {
    const bytes = encodeCommunityRow({ action: COMMUNITY_ACTION.ATTACH, assetKind: ASSET_KIND.COLLECTION, asset: friendly(TOKEN), pointerKind: COMMUNITY_POINTER.PUBLIC, token: publicToken });
    const back = decodeCommunityRow(bytes);
    expect([back.action, back.assetKind, back.asset, back.pointer.groupId, back.pointer.founder, back.pointer.name])
      .toEqual([COMMUNITY_ACTION.ATTACH, ASSET_KIND.COLLECTION, TOKEN, hexOf(groupId(1)), hash(FOUNDER), 'Lantern Club']);
    const priv = row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PRIVATE, privateToken).pointer;
    expect([priv.kind, priv.groupId, priv.name]).toEqual([COMMUNITY_POINTER.PRIVATE, hexOf(groupId(2)), 'Quiet Harbour']);
    for (const broken of [
      Uint8Array.from([2, ...bytes.subarray(1)]),
      Uint8Array.from([1, 9, ...bytes.subarray(2)]),
      Uint8Array.from([1, 1, 7, ...bytes.subarray(3)]),
      bytes.subarray(0, bytes.length - 1),
      Uint8Array.from([...bytes, 0]),
    ]) expect(decodeCommunityRow(broken)).toBe(null);
    expect(readCommunityPointer(COMMUNITY_POINTER.PRIVATE, publicToken)).toBe(null);
    expect(readCommunityPointer(COMMUNITY_POINTER.PUBLIC, privateToken)).toBe(null);
    expect(() => encodeCommunityRow({ action: COMMUNITY_ACTION.ATTACH, assetKind: ASSET_KIND.JETTON, asset: TOKEN, pointerKind: COMMUNITY_POINTER.PUBLIC, token: 'nonsense' })).toThrow();
  });
});

describe('the community list', () => {
  it('COMM-03: a group is attached by the wallet that speaks for it — a public group\'s founder, a private group\'s request wallet — and by nobody else', () => {
    const list = foldAssetCommunities([
      at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(ADMIN, 110, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PRIVATE, privateToken)),
    ], { asset: TOKEN });
    expect(list.map((one) => one.groupId), 'the longest-standing first [round 145]').toEqual([hexOf(groupId(1)), hexOf(groupId(2))]);
    const strangers = foldAssetCommunities([
      at(STRANGER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(STRANGER, 101, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PRIVATE, privateToken)),
    ], { asset: TOKEN });
    expect(strangers).toEqual([]);
    const kept = foldAssetCommunities([
      at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(STRANGER, 120, row(COMMUNITY_ACTION.DETACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
    ], { asset: TOKEN });
    expect(kept.map((one) => one.groupId)).toEqual([hexOf(groupId(1))]);
  });

  it('COMM-04: the speaker\'s last row decides; a detached group is gone; a re-attach keeps its first place and its newer pointer', () => {
    const detached = foldAssetCommunities([
      at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(FOUNDER, 200, row(COMMUNITY_ACTION.DETACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
    ], { asset: TOKEN });
    expect(detached).toEqual([]);
    const shuffled = foldAssetCommunities([
      at(FOUNDER, 300, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(FOUNDER, 200, row(COMMUNITY_ACTION.DETACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
    ], { asset: TOKEN });
    expect(shuffled.map((one) => one.groupId)).toEqual([hexOf(groupId(1))]);
    const renamed = encodePublicGroupJoinToken({ groupId: groupId(1), founder: Buffer.from(hash(FOUNDER), 'hex'), name: 'Lantern Hall' });
    const twice = foldAssetCommunities([
      at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(FOUNDER, 400, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, renamed)),
    ], { asset: TOKEN });
    expect([twice.length, twice[0].attachedAt, twice[0].renewedAt, twice[0].pointer.name]).toEqual([1, 100, 400, 'Lantern Hall']);
  });

  it('COMM-05: only the asset\'s authority hides and shows; a row the moderators hid, or one about another asset, counts for nothing', () => {
    const rows = [
      at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken)),
      at(STRANGER, 150, row(COMMUNITY_ACTION.HIDE, COMMUNITY_POINTER.PUBLIC, publicToken)),
    ];
    expect(foldAssetCommunities(rows, { asset: TOKEN, authority: AUTHORITY })[0].hiddenByAuthority).toBe(false);
    rows.push(at(AUTHORITY, 160, row(COMMUNITY_ACTION.HIDE, COMMUNITY_POINTER.PUBLIC, publicToken)));
    expect(foldAssetCommunities(rows, { asset: TOKEN, authority: AUTHORITY })[0].hiddenByAuthority).toBe(true);
    expect(foldAssetCommunities(rows, { asset: TOKEN, authority: ADMIN })[0].hiddenByAuthority, 'a former authority\'s hide lapses').toBe(false);
    rows.push(at(AUTHORITY, 170, row(COMMUNITY_ACTION.SHOW, COMMUNITY_POINTER.PUBLIC, publicToken)));
    expect(foldAssetCommunities(rows, { asset: TOKEN, authority: AUTHORITY })[0].hiddenByAuthority).toBe(false);
    expect(foldAssetCommunities([at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken), true)], { asset: TOKEN })).toEqual([]);
    expect(foldAssetCommunities([at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken, OTHER))], { asset: TOKEN }), 'a row copied from another asset\'s thread').toEqual([]);
  });
});

describe('the official layer: the authority\'s own profile', () => {
  const pins = [
    { groupId: hexOf(groupId(1)), name: 'Lantern Club', founder: hash(FOUNDER), about: [{ kind: ASSET_KIND.JETTON, address: TOKEN }] },
    { groupId: hexOf(groupId(2)), name: 'Quiet Harbour' },
  ];
  const profile = { description: 'Ours.', tags: ['tokens'], ownerUsername: '', appearance: null, wornGift: null, groups: pins, balanceCard: true };

  it('COMM-06: the pin names its asset through the block\'s ABOUT trailer and back; every republish carries it', () => {
    const back = decodeProfileBlockContent(encodeProfileBlockContent(profile));
    expect(back.groups[0].about).toEqual([{ kind: ASSET_KIND.JETTON, address: TOKEN }]);
    expect(back.groups[1].about, 'a room that names nothing gets nothing').toBe(undefined);
    expect([back.balanceCard, back.groups[0].founder]).toEqual([true, hash(FOUNDER)]);
    expect(officialCommunitiesIn(back, friendly(TOKEN)).map((room: any) => room.name)).toEqual(['Lantern Club']);
    expect(officialCommunitiesIn(back, OTHER)).toEqual([]);
    expect(normalizeProfileGroups(back.groups)[0].about).toEqual([{ kind: ASSET_KIND.JETTON, address: TOKEN }]);
    const plain = { ...profile, balanceCard: false, groups: [{ groupId: hexOf(groupId(3)), name: 'Plain', about: [{ kind: ASSET_KIND.ITEM, address: OTHER }] }] };
    expect(decodeProfileBlockContent(encodeProfileBlockContent(plain)).groups[0].about).toEqual([{ kind: ASSET_KIND.ITEM, address: OTHER }]);
  });

  it('COMM-07: production\'s readers (1.5.26, 1.4.24) read a block with the trailer as the same profile they always read', () => {
    const bytes = encodeProfileBlockContent(profile);
    const without = encodeProfileBlockContent({ ...profile, groups: pins.map(({ about, ...rest }: any) => rest) });
    expect(decodeProfileBlockContentOf1526(bytes)).toEqual(decodeProfileBlockContentOf1526(without));
    expect(decodeProfileBlockContentOf1424(bytes)).toEqual(decodeProfileBlockContentOf1424(without));
    const noFlags = { ...profile, balanceCard: false };
    expect(decodeProfileBlockContentOf1526(encodeProfileBlockContent(noFlags)))
      .toEqual(decodeProfileBlockContentOf1526(encodeProfileBlockContent({ ...noFlags, groups: pins.map(({ about, ...rest }: any) => rest) })));
  });

  it('COMM-08: making a room official adds the asset to its list and taking it off removes only that asset; the list is bounded', () => {
    const on = profileGroupsWithAbout(pins, hexOf(groupId(2)), friendly(OTHER), ASSET_KIND.COLLECTION, true);
    expect(on[1].about).toEqual([{ kind: ASSET_KIND.COLLECTION, address: OTHER }]);
    expect(on[0]).toBe(pins[0]);
    const off = profileGroupsWithAbout(on, hexOf(groupId(1)), TOKEN, ASSET_KIND.JETTON, false);
    expect('about' in off[0]).toBe(false);
    const many = Array.from({ length: PROFILE_GROUP_ABOUT_MAX + 2 }, (_, n) => ({ kind: ASSET_KIND.ITEM, address: raw((n + 10).toString(16)) }));
    expect(normalizeProfileGroups([{ groupId: hexOf(groupId(4)), name: 'Full', about: many }])[0].about).toHaveLength(PROFILE_GROUP_ABOUT_MAX);
  });
});

describe('the windows and the list', () => {
  const node = (): any => {
    const self: any = {
      className: '', textContent: '', children: [] as any[], parent: null as any, attrs: {} as Record<string, string>,
      setAttribute(name: string, value: string) { self.attrs[name] = value; },
      append(...more: any[]) { for (const one of more) { one.parent = self; self.children.push(one); } },
      insertBefore(one: any, before: any) { one.parent = self; const at = self.children.indexOf(before); self.children.splice(at < 0 ? self.children.length : at, 0, one); },
      remove() { if (self.parent) self.parent.children.splice(self.parent.children.indexOf(self), 1); self.parent = null; },
      get isConnected() { let at = self; while (at.parent) at = at.parent; return at.root === true; },
    };
    return self;
  };

  const run = async (source = app) => {
    const page = node();
    page.root = true;
    let close: () => void = () => {};
    const env: Record<string, any> = {
      document: { createElement: () => node() },
      t: (key: string) => key,
      openActionDialog: (config: any) => new Promise<void>((resolve) => {
        close = resolve;
        setTimeout(() => page.append(config.fields[0].render()), 0);
      }),
      loadAssetCommunities: async () => ({ authority: null, official: [], community: [], complete: true }),
      assetCommunitySection: (target: any) => { const section = node(); section.className = `section:${target.label}`; return section; },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const open = new Function(...names, `${sourceBlock(source, 'async function openAssetCommunitiesDialog(targets) {')}\nreturn openAssetCommunitiesDialog;`)(...names.map((n) => env[n]));
    void open([{ kind: 1, address: '0:00', label: 'A' }, { kind: 2, address: '0:01', label: 'B' }]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const box = page.children[0];
    close();
    return box.children.map((child: any) => child.className);
  };

  it('COMM-09: a list read from memory is drawn although it lands before the dialog has drawn its box', async () => {
    expect(await run()).toEqual(['section:A', 'section:B']);
    const unfixed = app.replace('if (closed) return shown;', 'if (!box.isConnected) return shown;');
    expect(unfixed).not.toBe(app);
    expect(await run(unfixed), 'MEASURED before: the reading line stayed alone').toEqual(['asset-communities-note']);
  });

  it('COMM-10: every asset window offers the list — a verified token, the market\'s token, a verified NFT with its collection, a lot, a collection', () => {
    expect(code(sourceBlock(app, 'function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain('...(token.verified && !token.scam ? [walletCardCommunities([{ kind: ASSET_KIND.JETTON, address: token.master,');
    expect(code(sourceBlock(app, 'function walletMarketTokenParts(item, route, { wide = false, tradesShown = 20, onBuy, onSell }) {'))).toContain('walletCardCommunities([{ kind: ASSET_KIND.JETTON, address: friendly, label: item.symbol }])');
    const nft = code(sourceBlock(app, 'function openWalletNftCard(item, { refill = false } = {}) {'));
    expect(nft).toContain('...(item.verified === true ? [walletCardCommunities([');
    expect(nft).toContain('{ kind: ASSET_KIND.COLLECTION, address: item.collection,');
    expect(code(sourceBlock(app, 'function openWalletNftListing(listing, { back = null } = {}) {'))).toContain('{ kind: ASSET_KIND.ITEM, address: listing.nft, label: title }');
    expect(code(sourceBlock(app, 'function walletNftViewParts(key) {'))).toContain('walletCardCommunities([{ kind: ASSET_KIND.COLLECTION, address: key,');
    expect(app).toMatch(/from '\.\/asset-communities\.mjs\?v=\d+';/);
    expect(readFileSync('scripts/prepare_static_web_deploy.mjs', 'utf8')).toContain("'asset-communities.mjs',");
    expect(readFileSync('web/sw.js', 'utf8')).toMatch(/'\.\/asset-communities\.mjs\?v=\d+',/);
  });

  it('COMM-11: an attach, a detach, a hide is a spend window — password first, the price of what is chosen', () => {
    for (const start of ['async function openAssetCommunityAttachDialog(target, loaded) {', 'async function setOfficialCommunity(target, groupId, on) {', 'async function publishAssetCommunityRow(target, action, pointer) {']) {
      const body = code(sourceBlock(app, start));
      expect(body, start).toContain('...spendPasswordFields()');
      expect(body, start).toContain('const passwordRefusal = await spendPasswordRefusal(values);');
    }
    const attach = code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'));
    expect(attach, 'the price line names itself — a label before it read «Cost: Cost …» [round 146 — C7-2]').toContain('summary: (values) => [price(values)],');
    expect(attach).toContain('publicGroupPriceLine(rowBlocks(group), { uid: assetCommunitiesUid(target.address) })');
  });
});

describe('round 144\'s fixes', () => {
  it('COMM-12: a stranger\'s pointer with the victim\'s id is the stranger\'s own entry — it cannot detach, replace or have the victim\'s hidden [C1-1, C11-1]', () => {
    const forged = encodePublicGroupJoinToken({ groupId: groupId(1), founder: Buffer.from(hash(STRANGER), 'hex'), name: 'Lantern Club' });
    const real = at(FOUNDER, 100, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, publicToken));
    const detached = foldAssetCommunities([real,
      at(STRANGER, 110, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, forged)),
      at(STRANGER, 120, row(COMMUNITY_ACTION.DETACH, COMMUNITY_POINTER.PUBLIC, forged))], { asset: TOKEN });
    expect(detached.map((one) => [one.groupId, one.speaker]), 'MEASURED before: the victim\'s entry gone').toEqual([[hexOf(groupId(1)), hash(FOUNDER)]]);
    const replaced = foldAssetCommunities([real, at(STRANGER, 110, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, forged))], { asset: TOKEN });
    expect(replaced.map((one) => one.pointer.founder).sort(), 'MEASURED before: one entry, the stranger\'s founder in the victim\'s place')
      .toEqual([hash(FOUNDER), hash(STRANGER)].sort());
    const hidden = foldAssetCommunities([real, at(STRANGER, 110, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, forged)),
      at(AUTHORITY, 130, row(COMMUNITY_ACTION.HIDE, COMMUNITY_POINTER.PUBLIC, forged))], { asset: TOKEN, authority: AUTHORITY });
    expect(hidden.map((one) => [one.speaker, one.hiddenByAuthority]).sort()).toEqual([[hash(FOUNDER), false], [hash(STRANGER), true]].sort());
  });

  it('COMM-13: a fifth asset is not added to a pin — the window refuses it before anything is signed [C11-2]', () => {
    const four = Array.from({ length: PROFILE_GROUP_ABOUT_MAX }, (_, n) => ({ kind: ASSET_KIND.ITEM, address: raw((n + 20).toString(16)) }));
    const rooms = [{ groupId: hexOf(groupId(5)), name: 'Four', about: four }];
    const next = profileGroupsWithAbout(rooms, hexOf(groupId(5)), TOKEN, ASSET_KIND.JETTON, true);
    expect(next[0].about.map((entry: any) => entry.address), 'MEASURED before: five in the list, four in the block').not.toContain(TOKEN);
    expect(next[0].about).toHaveLength(PROFILE_GROUP_ABOUT_MAX);
    expect(code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'))).toContain("return { ok: false, error: t('community.aboutFull') };");
  });

  it('COMM-14: the authority\'s profile is read again when older than the card\'s minute [C1-2]', async () => {
    const asked: any[] = [];
    const lift = (cachedAt: number | null, hasContent = true) => {
      const env: Record<string, any> = {
        assetCommunitiesRead: new Map(), console: { warn() {} }, noteTonRpcRateLimit: () => false,
        readAssetAuthority: async () => AUTHORITY,
        cachedChannelProfile: () => (cachedAt === null ? null : { fetchedAt: cachedAt, description: hasContent ? 'x' : '' }),
        nowSec: () => 10_000, PROFILE_CARD_REREAD_AFTER_SEC: 60, channelProfileHasContent: (p: any) => Boolean(p?.description),
        resolveChannelProfile: async (_wallet: string, options: any) => { asked.push(options); return { groups: [] }; },
        officialCommunitiesIn: () => [], readAssetCommunityRows: async () => ({ rows: [], complete: true }), foldAssetCommunities: () => [],
        ASSET_COMMUNITIES_TTL_MS: 120_000,
      };
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      return new Function(...names, `${sourceBlock(app, 'async function readAssetCommunities({ kind, address }) {')}\nreturn readAssetCommunities;`)(...names.map((n) => env[n]));
    };
    await lift(10_000 - 30)({ kind: 1, address: TOKEN });
    await lift(10_000 - 300)({ kind: 1, address: TOKEN });
    await lift(10_000 - 300, false)({ kind: 1, address: TOKEN });
    expect(asked.map((options) => options?.force), 'fresh: the cache; a minute old with content: read again (MEASURED before: never); empty: the resolver\'s own window')
      .toEqual([false, true, false]);
    expect(asked.map((options) => options?.requestClass), 'at the list\'s own class [round 145 — C11-3]').toEqual(['focus', 'focus', 'focus']);
  });

  it('COMM-15: the list and «nothing to attach» keep their ✕ and close on Back [C11-3]', () => {
    for (const start of ['async function openAssetCommunitiesDialog(targets) {', 'async function openAssetCommunityAttachDialog(target, loaded) {']) {
      expect(code(sourceBlock(app, start)), start).not.toContain('cancellable: false');
    }
  });
});

describe('round 145\'s fixes', () => {
  it('COMM-16: a flood of invented groups cannot empty a list — the standing ones first, three a speaker, the hidden cut apart [C1-1, C11-2]', () => {
    const legit = [1, 2, 3].map((n) => at(raw((n + 40).toString(16)), 100 + n,
      row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, encodePublicGroupJoinToken({ groupId: groupId(n), founder: Buffer.from(hash(raw((n + 40).toString(16))), 'hex'), name: `Real ${n}` }))));
    const flood = Array.from({ length: 64 }, (_, n) => at(STRANGER, 1000 + n,
      row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC, encodePublicGroupJoinToken({ groupId: groupId(100 + n), founder: Buffer.from(hash(STRANGER), 'hex'), name: `Spam ${n}` }))));
    const list = foldAssetCommunities([...legit, ...flood], { asset: TOKEN });
    expect(list.slice(0, 3).map((one) => one.pointer.name), 'MEASURED before: the three real ones cut by 64 newer rows of one wallet').toEqual(['Real 1', 'Real 2', 'Real 3']);
    expect(list.filter((one) => one.speaker === hash(STRANGER)), 'one speaker, three places').toHaveLength(3);
    const wallets = Array.from({ length: 70 }, (_, n) => raw((n + 120).toString(16)));
    const many = wallets.map((w, n) => at(w, 2000 + n, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC,
      encodePublicGroupJoinToken({ groupId: groupId(200 + (n % 50)), founder: Buffer.from(hash(w), 'hex'), name: `Spam ${n}` }))));
    const late = at(ADMIN, 9000, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PRIVATE, privateToken));
    const hides = many.map((one, n) => at(AUTHORITY, 9100 + n, row(COMMUNITY_ACTION.HIDE, COMMUNITY_POINTER.PUBLIC, one.row.pointer.token)));
    const before = foldAssetCommunities([...legit, ...many, late], { asset: TOKEN, authority: AUTHORITY }).filter((one) => !one.hiddenByAuthority);
    expect(before.map((one) => one.pointer.name).indexOf('Quiet Harbour'), 'behind the flood, not cut [round 146 — C1-2]').toBe(3 + many.length);
    const after = foldAssetCommunities([...legit, ...many, late, ...hides], { asset: TOKEN, authority: AUTHORITY }).filter((one) => !one.hiddenByAuthority);
    expect(after.map((one) => one.pointer.name), 'MEASURED before: hidden rows kept their places, the list stayed empty').toEqual(['Real 1', 'Real 2', 'Real 3', 'Quiet Harbour']);
  });

  it('COMM-17: the profile cache keeps the assets a room is official for — every read of a profile, and every republish built from it [C11-1]', async () => {
    const { normalizeChannelProfile } = await import('../web/public-channel-subscriptions.mjs') as any;
    const cached = normalizeChannelProfile({ description: 'x', tags: [], groups: [{ groupId: hexOf(groupId(1)), name: 'Lantern Club', founder: hash(FOUNDER), about: [{ kind: ASSET_KIND.JETTON, address: TOKEN }] }] });
    expect(cached.groups[0].about, 'MEASURED before: dropped — the official layer never showed').toEqual([{ kind: ASSET_KIND.JETTON, address: TOKEN }]);
    expect(officialCommunitiesIn(cached, TOKEN).map((room: any) => room.name)).toEqual(['Lantern Club']);
  });

  it('COMM-18: the attach window\'s group starts on the first group [C7-1]', () => {
    expect(code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'))).toContain('value: groups[0].groupId },');
  });
});

describe('round 146\'s fixes', () => {
  const ownGroup = (n: number, wallet = FOUNDER) => row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PUBLIC,
    encodePublicGroupJoinToken({ groupId: groupId(n), founder: Buffer.from(hash(wallet), 'hex'), name: `Own ${n}` }));

  it('COMM-19: groups written first stand above the later ones and push none out — a squat of every place leaves the real one in the list [C1-2, C11-3]', () => {
    const squatters = Array.from({ length: 22 }, (_, n) => raw((n + 60).toString(16)));
    const squat = squatters.flatMap((w, n) => [0, 1, 2].map((k) => at(w, 100 + n * 3 + k, ownGroup(150 + n * 3 + k, w))));
    const honest = at(ADMIN, 5000, row(COMMUNITY_ACTION.ATTACH, COMMUNITY_POINTER.PRIVATE, privateToken));
    const list = foldAssetCommunities([...squat, honest], { asset: TOKEN });
    expect(squat).toHaveLength(66);
    expect(list.map((one) => one.pointer.name).indexOf('Quiet Harbour'), 'MEASURED before: cut at 64 — absent for good on an asset with no authority').toBe(66);
  });

  it('COMM-20: the attach window shows the group before it is paid for — a speaker\'s fourth is refused, a renewal of one held passes [C1-1, C11-1, C7-1]', () => {
    const held = [1, 2, 3].map((n) => at(FOUNDER, 100 + n, ownGroup(n)));
    const shows = (candidate: any) => foldAssetCommunities([...held, { publisher: FOUNDER, createdAt: Number.MAX_SAFE_INTEGER, row: candidate }], { asset: TOKEN })
      .some((one) => one.groupId === candidate.pointer.groupId && one.speaker === hash(FOUNDER));
    expect(shows(ownGroup(4)), 'MEASURED before: signed, paid, «sent» — and never drawn').toBe(false);
    expect(shows(ownGroup(2)), 'a renewal keeps its place').toBe(true);
    const attach = code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'));
    const check = attach.indexOf("return { ok: false, error: t('community.speakerFull') };");
    expect(check, 'the window refuses').toBeGreaterThan(0);
    expect(attach.indexOf('try { read = await readAssetCommunityRows(target.address); }'), 'on the list as the chain holds it now').toBeGreaterThan(0);
    expect(check, 'before anything is signed').toBeLessThan(attach.indexOf('await publishPublicGroupDocument('));
  });

  it('COMM-21: the list draws a page of rows at a time, the rest behind «Show more»', () => {
    const section = code(sourceBlock(app, 'function assetCommunitySection(target, loaded, { titled }) {'));
    expect(section).toContain('shown.slice(drawn, drawn + ASSET_COMMUNITIES_ROWS_PAGE)');
    expect(section).toContain("more.textContent = t('wallet.historyMore');");
    expect(app).toContain('const ASSET_COMMUNITIES_ROWS_PAGE = 40;');
  });
});

describe('round 146\'s easy LOWs', () => {
  const reader = (env: Record<string, any>) => {
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    return new Function(...names, `${sourceBlock(app, 'async function readAssetCommunities({ kind, address }) {')}\nreturn readAssetCommunities;`)(...names.map((n) => env[n]));
  };
  const base = (over: Record<string, any> = {}) => ({
    assetCommunitiesRead: new Map(), console: { warn() {} }, noteTonRpcRateLimit: () => false,
    readAssetAuthority: async () => AUTHORITY, cachedChannelProfile: () => ({ fetchedAt: 9_000, description: 'x' }),
    nowSec: () => 10_000, PROFILE_CARD_REREAD_AFTER_SEC: 60, channelProfileHasContent: (p: any) => Boolean(p?.description),
    resolveChannelProfile: async () => ({ groups: [] }), officialCommunitiesIn: () => [],
    readAssetCommunityRows: async () => ({ rows: [], complete: true }), foldAssetCommunities: () => [], ...over,
  });

  it('COMM-22: an authority read that failed is not «no authority», and a re-read that failed is not kept as fresh [r144 C1-3, C11-6; r145 C11-4]', async () => {
    const failedAuthority = await reader(base({ readAssetAuthority: async () => { throw new Error('429'); } }))({ kind: 1, address: TOKEN });
    expect([failedAuthority.authority, failedAuthority.authorityKnown, failedAuthority.complete]).toEqual([null, false, false]);
    const stale = base({ resolveChannelProfile: async (_w: string, options: any) => { options.onReadFailed?.(); return { groups: [] }; } });
    const kept = await reader(stale)({ kind: 1, address: TOKEN });
    expect([kept.complete, stale.assetCommunitiesRead.size], 'MEASURED before: the old copy handed back unflagged, kept 2 min').toEqual([false, 0]);
    let fetchedAt = 9_000;
    const fresh = base({ cachedChannelProfile: () => ({ fetchedAt, description: 'x' }), resolveChannelProfile: async () => { fetchedAt = 10_000; return { groups: [] }; } });
    expect((await reader(fresh)({ kind: 1, address: TOKEN })).complete).toBe(true);
    const long = base({ cachedChannelProfile: () => ({ fetchedAt: 9_990, description: 'x' }), readAssetCommunityRows: async () => ({ rows: [], complete: false }) });
    const longRead = await reader(long)({ kind: 1, address: TOKEN });
    expect([longRead.complete, long.assetCommunitiesRead.size]).toEqual([false, 1]);
    const attach = code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'));
    expect(attach).toContain('if (!loaded?.authorityKnown) loaded = await loadAssetCommunities(target, { force: true });');
    expect(attach.indexOf("hint: t('errors.networkNotNow')")).toBeGreaterThan(0);
    expect(attach.indexOf("hint: t('errors.networkNotNow')")).toBeLessThan(attach.indexOf('const official = '));
  });

  it('COMM-23: one read of one asset at a time; a forced read starts its own [r144 C11-7]', async () => {
    let reads = 0;
    const env: Record<string, any> = {
      assetCommunitiesRead: new Map(), assetCommunitiesReading: new Map(), ASSET_COMMUNITIES_TTL_MS: 120_000,
      readAssetCommunities: () => { reads += 1; return new Promise((resolve) => setTimeout(() => resolve({ complete: true }), 5)); },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const load = new Function(...names, `${sourceBlock(app, 'async function loadAssetCommunities(target, { force = false } = {}) {')}\nreturn loadAssetCommunities;`)(...names.map((n) => env[n]));
    await Promise.all([load({ address: TOKEN }), load({ address: TOKEN })]);
    expect(reads, 'MEASURED before: two opens, two reads').toBe(1);
    await Promise.all([load({ address: TOKEN }), load({ address: TOKEN }, { force: true })]);
    expect(reads).toBe(3);
    expect(env.assetCommunitiesReading.size, 'nothing left behind').toBe(0);
  });

  it('COMM-24: the thread\'s pages reuse the shards\' states [r145 C11-5]', () => {
    const rows = code(sourceBlock(app, 'async function readAssetCommunityRows(address) {'));
    expect(rows).toContain('...(states ? { states } : {}) });');
    expect(rows).toContain('if (read?.states instanceof Map) states = read.states;');
  });

  it('COMM-25: the windows say what a press ends — an unpin its official assets, an official detach its asset [r144 C1-4, C1-5]', () => {
    for (const locale of Object.keys(I18N_STRINGS)) {
      expect((I18N_STRINGS as any)[locale]['community.unpinEndsOfficial'], locale).toBeTruthy();
      expect((I18N_STRINGS as any)[locale]['community.detachOfficialHint'], locale).toMatch(/\{group\}[\s\S]*\{name\}|\{name\}[\s\S]*\{group\}/);
    }
    const pin = code(sourceBlock(app, 'async function togglePinnedProfileGroup(groupId, record) {'));
    expect(pin).toContain("endsOfficial ? t('community.unpinEndsOfficial') : ''");
    expect(code(sourceBlock(app, 'async function setOfficialCommunity(target, groupId, on) {'))).toContain("t('community.detachOfficialHint', {");
  });

  it('COMM-26: rows and doors are named for a screen reader; a hidden row is dashed, not faded; two groups of one name are told apart [r144 C7-1..C7-4; r146 C7-3]', () => {
    expect(code(sourceBlock(app, "function assetCommunityRow({ name, isPublic, groupId, claim, onOpen, side = [], dimmed = false, note = '', by = '' }) {")))
      .toContain("button.setAttribute('aria-label', `${action.label}: ${strong.textContent}`);");
    const section = code(sourceBlock(app, 'function assetCommunitySection(target, loaded, { titled }) {'));
    expect(section).toContain("section.setAttribute('aria-label', target.label);");
    expect(section).toContain("const node = document.createElement('h4');");
    expect(section).toContain("if (titled) attach.setAttribute('aria-label', `${attach.textContent}: ${target.label}`);");
    const css = code(readFileSync('web/styles.css', 'utf8'));
    expect(css, 'MEASURED before: 2.15:1').not.toMatch(/\.asset-community-row\.is-hidden \{\s*opacity/);
    expect(css).toMatch(/\.asset-community-row\.is-hidden \.asset-community-open \{\s*border-style: dashed;/);
    expect(css, 'the action line wraps').toMatch(/\.asset-community-open span \{\s*overflow-wrap: anywhere;\s*\}/);
    expect(code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'))).toContain('label: optionLabel(group) }))');
  });
});

describe('the mint\'s steps are read on the pill [2026-11-08]', () => {
  it('COMM-27: inside the pill the note keeps the pill\'s ink — no green step, no red refusal on the accent fill', () => {
    const css = code(readFileSync('web/styles.css', 'utf8'));
    expect(css, 'MEASURED before: «checking availability» green on the green pill, hardly readable').not.toMatch(/\.discovery-cta-action-note\[data-state="(busy|error)"\][^{]*\{\s*color/);
    expect(css).not.toMatch(/,\s*\.discovery-cta-action-note\[data-state="(busy|error)"\]/);
    expect(css).toMatch(/\.discovery-cta-action-note\[data-state\] \{\s*opacity: 1;\s*\}/);
    expect(css).toMatch(/\.discovery-cta-action-note\[data-state="error"\] \{\s*font-weight: 700;\s*\}/);
  });
});

describe('round 147\'s fixes', () => {
  const reader147 = (env: Record<string, any>) => {
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    return new Function(...names, `${sourceBlock(app, 'async function readAssetCommunities({ kind, address }) {')}\nreturn readAssetCommunities;`)(...names.map((n) => env[n]));
  };
  const env147 = (resolve: (options: any) => any, cached: any) => ({
    assetCommunitiesRead: new Map(), console: { warn() {} }, noteTonRpcRateLimit: () => false,
    readAssetAuthority: async () => AUTHORITY, cachedChannelProfile: () => cached,
    nowSec: () => 10_000, PROFILE_CARD_REREAD_AFTER_SEC: 60, channelProfileHasContent: (p: any) => Boolean(p?.description),
    resolveChannelProfile: async (_wallet: string, options: any) => resolve(options),
    officialCommunitiesIn: (profile: any) => (profile?.groups ?? []),
    readAssetCommunityRows: async () => ({ rows: [], complete: true }), foldAssetCommunities: () => [],
  });

  it('COMM-28: a profile read that failed is told by the resolver itself — a cold miss is no «no official groups», a re-read of the same profile no failure [C1-1, C11-1]', async () => {
    const cold = env147((options) => { options.onReadFailed?.(); return null; }, null);
    const coldRead = await reader147(cold)({ kind: 1, address: TOKEN });
    expect([coldRead.official, coldRead.complete, cold.assetCommunitiesRead.size], 'MEASURED before: complete, no official section, kept 2 min').toEqual([[], false, 0]);
    const profile = { fetchedAt: 9_000, description: 'x', groups: [{ groupId: 'aa', name: 'Official' }] };
    const same = env147(() => { profile.fetchedAt = 10_000; return profile; }, profile);
    const sameRead = await reader147(same)({ kind: 1, address: TOKEN });
    expect([sameRead.official.length, sameRead.complete, same.assetCommunitiesRead.size], 'MEASURED before: «may be incomplete», never kept').toEqual([1, true, 1]);
    const resolver = code(sourceBlock(app, 'async function resolveChannelProfile(authorWallet, options = {}) {'));
    expect(resolver).toContain('const readFailed = () => { options.onReadFailed?.(); return cachedChannelProfile(key); };');
    expect(resolver.split('return readFailed();').length - 1).toBe(3);
  });

  it('COMM-29: the speaker sees its own hidden group and may detach it; a tile that drew its art lends it to the next read of the list [C1-4, C7-2; C1-2, C11-2]', async () => {
    expect(code(sourceBlock(app, 'function assetCommunitySection(target, loaded, { titled }) {')))
      .toContain('const shown = loaded.community.filter((entry) => !entry.hiddenByAuthority || iAmAuthority || (meHash && entry.speaker === meHash));');
    const NAME = raw('77');
    const art = 'data:image/svg+xml;base64,PHN2Zy8+';
    const asked: string[] = [];
    const state: any = { owner: 'me', nfts: null, stored: {}, tab: 'nft' };
    const nfts = [{ address: NAME, collection: TOKEN, picture: '' }];
    state.nfts = nfts;
    const names = ['walletAssetsState', 'rawAccount', 'safeInlineImage', 'inlinePictureOf', 'readStoredUsernameNftList', 'walletNftTiles', 'walletNftAthArtOf', 'isVaultViewActive', 'renderWalletAssets'];
    const values = [state, (a: string) => a, (i: string) => i, () => '', async () => null, new Map([[NAME, { picture: art }]]),
      ({ nft }: any) => { asked.push(nft); return []; }, () => true, () => {}];
    // eslint-disable-next-line no-new-func
    const dress = new Function(...names, `${sourceBlock(app, 'async function dressWalletNamesFromProfileList(owner, registry, nfts) {')}\nreturn dressWalletNamesFromProfileList;`)(...values);
    await dress('me', TOKEN, nfts);
    expect([nfts[0].picture, asked], 'MEASURED before: asked of tonapi again at every read past the 200 kept').toEqual([art, []]);
  });

  it('COMM-30: a name at 320 px takes two lines before it is cut; the mint\'s steps are said', () => {
    const css = code(readFileSync('web/styles.css', 'utf8'));
    expect(css).toMatch(/\.asset-community-open strong \{[^}]*-webkit-line-clamp: 2;/);
    expect(css).not.toMatch(/\.asset-community-open strong \{[^}]*white-space: nowrap;/);
    expect(code(sourceBlock(app, "function setUsernameMintStatus(text, state = 'busy') {"))).toContain('speakToScreenReader(text);');
  });
});

describe('a room is its own only when the pointer is [2026-11-09]', () => {
  const ROOM = hexOf(groupId(9));
  const bytes = (fill: string) => Uint8Array.from(Buffer.from(hash(fill), 'hex'));
  const held = (records: { private?: any; public?: any }, self: any = null) => {
    const names = ['groupRecordOf', 'publicGroupRuntimeInstance', 'bytesToHex', 'groupSelfIsAdmin', 'plathoWallet', 'sameWalletAddress', 'groupPeopleOf'];
    const values = [
      (id: string) => (id === ROOM ? records.public ?? records.private ?? null : null),
      { get: (id: string) => (id === ROOM ? records.public ?? null : null) },
      (b: Uint8Array) => Buffer.from(b).toString('hex'),
      () => self !== null,
      self ? { address: self } : null,
      (a: string, b: string) => hash(a) === hash(b),
      (record: any) => record?.members ?? [],
    ];
    // eslint-disable-next-line no-new-func
    return new Function(...names, `${sourceBlock(app, 'function heldGroupFor(groupId, { founder = null, wallet = null } = {}) {')}\nreturn heldGroupFor;`)(...values);
  };

  it('COMM-31: a public room is its own pointer\'s by its founder, a private room\'s by its admins\' wallets; another wallet\'s pointer is not the room', () => {
    const pub = held({ public: { name: 'Lantern Club', founder: bytes(FOUNDER), members: [1, 2, 3] } });
    expect(pub(ROOM, { founder: hash(FOUNDER) })).toMatchObject({ matches: true, people: 3 });
    expect(pub(ROOM, { founder: hash(STRANGER) }), 'MEASURED before: drawn under «Lantern Club» with «Open»').toMatchObject({ matches: false });
    const adminKey = Uint8Array.of(1);
    const memberKey = Uint8Array.of(2);
    const priv = held({ private: { name: 'Quiet Harbour', admins: [adminKey], members: [{ groupKey: adminKey, wallet: ADMIN }, { groupKey: memberKey, wallet: STRANGER }] } });
    expect(priv(ROOM, { wallet: ADMIN })).toMatchObject({ matches: true, people: 2 });
    expect(priv(ROOM, { wallet: STRANGER }), 'a member who is no admin is not the room\'s door').toMatchObject({ matches: false });
    expect(priv(ROOM, { wallet: AUTHORITY })).toMatchObject({ matches: false });
    const unseated = held({ private: { name: 'Quiet Harbour', admins: [adminKey, Uint8Array.of(3)], members: [{ groupKey: adminKey, wallet: ADMIN }] } });
    expect(unseated(ROOM, { wallet: AUTHORITY })).toMatchObject({ matches: true });
    expect(held({})(ROOM, { wallet: ADMIN }), 'a room this device does not hold').toBe(null);
  });

  it('COMM-32: every door to a room asks it — the community row, its press, the profile card\'s rooms; another wallet\'s pointer opens nothing and says whose room it copies', () => {
    const row = code(sourceBlock(app, "function assetCommunityRow({ name, isPublic, groupId, claim, onOpen, side = [], dimmed = false, note = '', by = '' }) {"));
    expect(row).toContain('const held = heldGroupFor(groupId, claim);');
    expect(row).toContain("strong.textContent = (held?.matches ? held.record.name : '') || name || t('group.untitled');");
    expect(row).toContain("if (foreign) open.setAttribute('aria-disabled', 'true');");
    expect(row).toContain("line.textContent = t('community.attachedBy', { who: by });");
    const door = code(sourceBlock(app, 'function openOrJoinCommunity(groupId, { room = null, pointer = null, askAt = null } = {}) {'));
    expect(door.indexOf('if (held && !held.matches) return;'), 'the guard is there').toBeGreaterThan(0);
    expect(door.indexOf('if (held && !held.matches) return;'), 'before the room opens').toBeLessThan(door.indexOf('openGroupThread('));
    expect(code(sourceBlock(app, 'function showProfileCardGroupsMenu(raw, rooms, anchor) {'))).toContain('if (held && !held.matches) return;');
    const section = code(sourceBlock(app, 'function assetCommunitySection(target, loaded, { titled }) {'));
    expect(section).toContain('by: communityAttacherLabel(entry.pointer),');
    expect(section).toContain('claim: roomPinClaim(room, loaded.authority),');
    for (const locale of Object.keys(I18N_STRINGS)) {
      const strings = (I18N_STRINGS as any)[locale];
      expect(strings['group.notYours'], locale).toContain('{name}');
      expect(strings['group.openCount'], locale).toContain('{count}');
      expect(strings['community.attachedBy'], locale).toContain('{who}');
      expect(strings['community.groupOption'], locale).toMatch(/\{name\}[\s\S]*\{kind\}[\s\S]*\{count\}/);
      expect(strings['community.open'], `${locale}: no text left unused`).toBeUndefined();
    }
  });

  it('COMM-33: the attach window lists each group with its kind and its count; the room pin asks the password as the official windows do', () => {
    const attach = code(sourceBlock(app, 'async function openAssetCommunityAttachDialog(target, loaded) {'));
    expect(attach).toContain("const optionLabel = (group) => t('community.groupOption', {");
    const pin = code(sourceBlock(app, 'async function togglePinnedProfileGroup(groupId, record) {'));
    expect(pin, 'MEASURED before: fields: [] — no password').toContain('fields: [...spendPasswordFields()],');
    expect(pin.indexOf('const passwordRefusal = await spendPasswordRefusal(values);')).toBeLessThan(pin.indexOf('await publishProfileGroups(current, next);'));
  });
});

describe('round 149\'s fixes', () => {
  it('COMM-34: the profile card\'s rooms menu — a room left reads as a door again, another wallet\'s pin says why it opens nothing [C11-1, C7-1]', () => {
    const rows: any[] = [];
    const popover: any = { setAttribute() {}, replaceChildren() {}, append(node: any) { rows.push(node); } };
    const element = () => {
      const node: any = { attrs: {} as Record<string, string>, children: [] as any[], textContent: '', className: '', type: '', listeners: [] as any[],
        setAttribute(k: string, v: string) { this.attrs[k] = v; }, append(...nodes: any[]) { this.children.push(...nodes); }, addEventListener(_e: string, f: any) { this.listeners.push(f); } };
      return node;
    };
    const verdicts: Record<string, any> = {
      left: { record: { name: 'Left Room', leftAt: 123 }, matches: true, people: 4 },
      foreign: { record: { name: 'Lantern Club' }, matches: false, people: 9 },
      ours: { record: { name: 'Quiet Harbour' }, matches: true, people: 7 },
    };
    const names = ['ensureIdentityPopover', 'document', 't', 'heldGroupFor', 'roomPinClaim', 'hideIdentityPopover', 'closeProfileCardDialog', 'openGroupThread',
      'ensureGroupThread', 'joinOrAskGroup', 'showPopoverAt', 'settleProfileCardPalette'];
    const values = [() => popover, { createElement: element }, (key: string, vars?: any) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
      (id: string) => verdicts[id] ?? null, () => ({}), () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}];
    // eslint-disable-next-line no-new-func
    const menu = new Function(...names, `${sourceBlock(app, 'function showProfileCardGroupsMenu(raw, rooms, anchor) {')}\nreturn showProfileCardGroupsMenu;`)(...values);
    menu('0:raw', [{ groupId: 'left', founder: 'aa' }, { groupId: 'foreign', founder: 'bb' }, { groupId: 'ours' }, { groupId: 'none' }], {});
    const hints = rows.slice(1).map((row) => row.children[1].textContent);
    expect(hints[0], 'MEASURED before: «Not your group» over one\'s own room, left').toBe('group.joinLabel');
    expect(hints[1]).toContain('group.notYours');
    expect(hints[2]).toBe('group.openCount:{"count":7}');
    expect(hints[3]).toBe('group.askLabel');
    expect(rows.slice(1).map((row) => row.attrs['aria-disabled'] ?? '')).toEqual(['', 'true', '', '']);
  });

  it('COMM-35: a foreign community row says why even when the owner hid it; a foreign row reads inactive [C7-2, C7-3]', () => {
    const row = code(sourceBlock(app, "function assetCommunityRow({ name, isPublic, groupId, claim, onOpen, side = [], dimmed = false, note = '', by = '' }) {"));
    expect(row).toContain("hint.textContent = foreign ? t('group.notYours', { name: held.record.name || t('group.untitled') })");
    expect(row, 'the owner\'s hide still said, on its own line [round 150 — C7-1]').toContain('if (foreign && note) {');
    const css = code(readFileSync('web/styles.css', 'utf8'));
    expect(css).toMatch(/\.identity-variant\[aria-disabled="true"\]:hover,\s*\.asset-community-open\[aria-disabled="true"\]:hover \{\s*background: transparent;/);
    expect(css).toMatch(/\.identity-variant\[aria-disabled="true"\] span \{\s*overflow-wrap: anywhere;\s*white-space: normal;/);
  });
});
