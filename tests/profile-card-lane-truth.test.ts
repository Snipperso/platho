import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock as block } from './helpers/source';

const RAW = readFileSync('web/app.js', 'utf8');
const APP = code(RAW);


describe('PROFILE CARD — the profile lane', () => {
  const card = () => code(block(RAW, 'async function openProfileCardDialog('));

  it('LANE-01: "done" is earned — a copy the read did not move is partial, a copy the resolver was not asked to move is the answer', () => {
    const c = card();
    expect(c).toContain("const before = { fetchedAt: Number(cachedProfile?.fetchedAt ?? 0), entryId: String(cachedProfile?.entryId ?? '') };");
    expect(c).toContain("const advanced = Number(after?.fetchedAt ?? 0) > before.fetchedAt || String(after?.entryId ?? '') !== before.entryId;");
    expect(c).toContain("if (asksChain && !advanced) markProfileCardLaneDone(raw, 'profile', { partial: true });");
    expect(c).toContain("else markProfileCardLaneDone(raw, 'profile');");
    expect(c).toMatch(/\.then\(\(\) => \{\s*\n\s*if \(profileCardSubject !== raw\) return;[\s\S]{0,700}const after = cachedChannelProfile\(raw\);/);
  });

  it('LANE-02: a copy WITHOUT content is re-read on the resolver\'s own absent TTL, not forced on every open', () => {
    const c = card();
    expect(c).toContain('const forceRead = Boolean(cachedProfile?.fetchedAt) && channelProfileHasContent(cachedProfile);');
    expect(c).toContain('resolveChannelProfile(raw, { force: forceRead })');
    expect(c).toContain('const asksChain = forceRead || !cachedProfile?.fetchedAt');
    expect(c).toContain('|| (nowSec() - Number(cachedProfile.fetchedAt)) >= PUBLIC_CHANNEL_PROFILE_ABSENT_TTL_SEC;');
    expect(c, 'the one-minute window for a copy WITH content still stands').toContain('|| (nowSec() - Number(cachedProfile.fetchedAt)) > PROFILE_CARD_REREAD_AFTER_SEC;');
  });

  it('LANE-03: an "absent" answer keeps the names the registry verified, and a content copy\'s empty walk still counts as read', () => {
    const absent = code(block(RAW, 'function markChannelProfileAbsent('));
    expect(absent).toContain('publicChannelProfileCache = { ...publicChannelProfileCache, [key]: { ...prev, fetchedAt: nowSec() } };');
    expect(absent).not.toContain('if (channelProfileHasContent(prev)) return;');
    expect(absent).toContain("...(prev?.ownerUsername ? { ownerUsername: prev.ownerUsername } : {}),");
    expect(absent).toContain("...(prev?.verifiedUsername ? { verifiedUsername: prev.verifiedUsername } : {}),");
    expect(absent).toMatch(/if \(pendingChannelProfileOverlay\.has\(key\)\) return;[\s\S]*if \(channelProfileHasContent\(prev\)\) \{/);
  });

  it('LANE-04: the previous card\'s gift list is not this subject\'s', () => {
    const c = card();
    expect(c).toMatch(/profileCardSubject = raw;\s*\n\s*profileCardLanesPartial = new Set\(\);\s*\n\s*profileCardLanesDone = new Set\(\);\s*\n\s*profileCardGiftsLastRender = null;/);
  });

  it('LANE-05: two copies that differ only in their rooms are two profiles, and the rooms are priced with the rest', () => {
    const same = code(block(RAW, 'function sameChannelProfileContent('));
    expect(same).toMatch(/&& groups\(a\) === groups\(b\)\s/);
    expect(same).toContain("const groups = (profile) => (Array.isArray(profile?.groups) ? profile.groups : [])");
    expect(same, 'id, name, founder and owner — the fields the card carries').toContain("`${room?.groupId ?? ''}:${room?.name ?? ''}:${room?.founder ?? ''}:${room?.owner ?? ''}`");
    expect(APP, 'the description dialog').toContain('channelProfilePriceLine(values.description, values.tags, appearanceOf(values), normalizeProfileWornGift(current?.wornGift ?? null), current?.groups ?? [])');
    expect(APP, 'the wear dialog').toContain('channelProfilePriceLine(description, tags, appearance, wornGift, current?.groups ?? [], card)');
    const priceLine = code(block(RAW, 'function channelProfilePriceLine('));
    expect(priceLine).toContain('estimatedChannelProfileChargeNanotons(description, tags, appearance, wornGift, groups, balanceCard)');
    expect(priceLine).toContain('groups: normalizeProfileGroups(groups), balanceCard: balanceCard === true,');
  });
});
