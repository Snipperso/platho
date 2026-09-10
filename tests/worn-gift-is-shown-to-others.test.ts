import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WEARING A GIFT IS FOR OTHERS TO SEE.
//
// [decided 2026-09-09] "Wear" used to be a private pleasure: the worn gift stood in the corner and tinted this
// device's app, and nobody else could tell. The point of wearing is showing. So a worn gift is PUBLISHED — the
// profile block carries the claim, the same claim the channel look carried — and on the reader's side only a claim
// the chain PROVED (verifyChannelGiftClaim) dresses anything: the hero of the profile card, a ring of light around
// the avatar in chats, in the feed and on the channel. Publishing costs a profile publish, so wearing OFFERS it,
// priced, and never publishes on its own.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const i18n = readFileSync('web/i18n-strings.mjs', 'utf8');
const codec = readFileSync('web/capsule-part-policy.mjs', 'utf8');

/**
 * One whole function, by brace balance — never a fixed-length window. The body's brace is the first one AFTER the
 * parameter list closes: a destructured default like `{ remove = false } = {}` would otherwise end the walk early.
 */
function fn(name: string, source: string = app.includes(`function ${name}(`) ? app : codec): string {
  const at = source.indexOf(`function ${name}(`);
  expect(at, `${name} must still be there`).toBeGreaterThan(-1);
  let parens = 0;
  let i = source.indexOf('(', at);
  for (; i < source.length; i += 1) {
    if (source[i] === '(') parens += 1;
    else if (source[i] === ')') { parens -= 1; if (parens === 0) break; }
  }
  let depth = 0;
  for (i = source.indexOf('{', i); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) return source.slice(at, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
}

describe('WORN — a worn gift is published, proven, and shown to others', () => {
  it('WORN-01: wearing offers the publication, priced, and never publishes on its own', () => {
    // ONE publish for everything worn: the gift's and the name's offers are words around one block publisher.
    const offer = fn('offerProfileBlockPublish');
    expect(offer, 'no wallet, no account: nothing to offer').toContain('if (!wallet || !hasActivePlathoAccount()) return false;');
    // TWO CLAIMS, NOT ONE [owner, 2026-09-09: "wearing a gift does not have to show on the channel"]: the worn gift
    // is the block's own field; the channel's look stays exactly as it stands on chain.
    expect(offer, 'the look on chain, untouched').toContain('const appearance = normalizeProfileAppearance(current?.appearance ?? null);');
    expect(offer, 'the worn gift as its own claim').toContain('const wornGift = wornGiftClaimAddress();');
    expect(offer, 'priced with the same estimate the profile dialog shows')
      .toContain('estimatedChannelProfileChargeNanotons(description, tags, appearance, wornGift)');
    expect(offer).toContain("summary: cost ? [{ label: t('common.cost'), value: cost }] : []");
    expect(offer, 'the submit IS the publish').toContain('const published = await publishChannelProfile(description, tags, appearance, wornGift);');
    // Once the write has left the wallet the dialog simply goes away [owner, 2026-09-09: a notice with a greyed
    // button was not intuitive — "just hide the window once it is sent"]; the tile behind it says what happened.
    expect(offer).toContain("return { ok: true, result: { status: 'submitted' } };");
    expect(app, 'no dialog stays open on a notice any more').not.toContain('keepOpen');
    const giftOffer = fn('offerWornGiftPublish');
    expect(giftOffer).toContain("title: remove ? t('gift.unpublishTitle') : t('gift.publishTitle', { name: gift.name }),");
    expect(giftOffer).toContain('return offerProfileBlockPublish({');
    // Wearing itself stays local: the publish happens in the dialog's submit and nowhere else.
    const wear = fn('wearTelegramGift');
    expect(wear).not.toContain('publishChannelProfile(');
    expect(wear).not.toContain('offerWornGiftPublish(');
    // The card's tap: wear, repaint, THEN offer; taking off offers the reverse only while the chain still shows it.
    expect(app).toContain('const wasPublished = worn && wornGiftPublished(gift.itemAddress);');
    expect(app).toContain('.then(() => (worn ? (wasPublished ? offerWornGiftPublish(gift, { remove: true }) : false) : offerWornGiftPublish(gift)))');
  });

  it("WORN-02: the worn gift is the block's own claim; the channel's gift is the look editor's own choice", () => {
    // [owner, 2026-09-09, on seeing the look editor without a gift row: "wearing a gift does not have to show on
    // the channel — maybe I only wanted it on the profile".] So the profile block carries the WORN gift apart from
    // the channel's look, and the look editor has its gift row back: none, or the worn gift.
    const claim = fn('profileWornGiftClaim');
    expect(claim, 'the worn-gift field first, the old appearance claim as the fallback for blocks from before it')
      .toContain('return normalizeProfileWornGift(profile?.wornGift ?? null) ?? claimedGiftAddress(profile?.appearance ?? null);');
    const editor = fn('buildChannelLookEditor');
    expect(editor).toContain("wantsGift: () => state.enabled && state.gift === 'gift',");
    expect(editor).toContain("[['none', 'public.channelAppearanceNone'], ['gift', 'public.channelAppearanceGift']]");
    expect(editor, 'the channel wears the worn gift only when its row asks').toContain("itemAddress: state.gift === 'gift' ? wornGiftClaimAddress() : null,");
    expect(editor, 'the look off means no channel gift at all').toContain('}) : null),');
    const dialog = fn('openEditChannelProfileDialog');
    expect(dialog, 'a look that asks for a gift with none worn is refused in the dialog').toContain("if (editor.wantsGift() && !wornGiftClaimAddress()) {");
    expect(dialog, 'and the description save carries the worn gift along, whatever the channel chose')
      .toContain('const published = await publishChannelProfile(description, tags, appearanceOf(values), wornGiftClaimAddress());');
    // The block itself: a trailer of its own, behind an appearance trailer that is written empty when there is none.
    expect(fn('encodeProfileBlockContent')).toContain('else if (wornGift.length > 0) total += 1;');
    expect(fn('decodeProfileBlockContent')).toContain('wornGift = normalizeProfileWornGift(decoder.decode(bytes.subarray(offset, offset + wornGiftLength)));');
    expect(app).toContain('wornGift: normalizeProfileWornGift(profile.wornGift ?? null),');
    expect(app).toContain("&& String(a?.wornGift ?? '') === String(b?.wornGift ?? '');");
  });

  it("WORN-03: a contact's card wears the gift they PUBLISHED, if the chain holds it — never the first of the list", () => {
    const among = fn('wornGiftAmong');
    expect(among, "off while this reader hides others' appearances").toContain('if (!channelAppearancesVisible()) return null;');
    expect(among, 'the claim is the published worn gift').toContain('const claimed = profileWornGiftClaim(cachedChannelProfile(wallet));');
    expect(among, 'and the list is what the chain proved').toContain('return (gifts ?? []).find((gift) => sameGiftItem(gift.itemAddress, claimed)) ?? null;');
    expect(app).toContain('if (!own) dressProfileCardPeerHero(profileCardSubject, wornGiftAmong(profileCardSubject, gifts));');
    expect(app, 'the first gift of the list was a guess about somebody else\'s choice').not.toContain('dressProfileCardPeerHero(profileCardSubject, gifts[0]');
    // A profile never seen in the feed is read once when the card opens; the same list is re-dressed when it lands.
    const open = fn('openProfileCardDialog');
    expect(open).toContain('if (!own && !cachedChannelProfile(raw)?.fetchedAt) {');
    expect(open).toContain('renderProfileCardGifts(last.result, last.own, last.flags);');
  });

  it("WORN-04: a contact's hero is painted by the SAME path as one's own — one record, one painter, no parallel renderer", () => {
    // [owner, 2026-09-09: what is shown locally looks right — show a contact's gift the same way, with the same
    // code, rather than a second renderer.] The record differs (one's own worn gift, or the contact's published and
    // proven one); the painting does not: tokens, the cut-out on the hero, the motion.
    const hero = fn('dressProfileCardHero');
    expect(hero).toContain('const theme = own ? wornGiftTheme : profileCardPeerGiftTheme;');
    expect(hero).toContain('applyGiftHeroTokens(profileCardHero, theme);');
    expect(hero).toContain('const art = theme ? theme.subjectArt ?? telegramGiftArtCache.get(`${theme.slug}-${theme.number}`) ?? null : null;');
    expect(hero).toContain('syncHeroGiftMotion(theme);');
    expect(hero, 'nothing in the painter is keyed on OWN any more').not.toMatch(/own && wornGiftTheme|own \? [^:]*subjectArt/);
    // The contact's record is built by the builders that already exist — the channel dress and the subject cut —
    // and handed to that same painter.
    const build = fn('buildHeroGiftTheme');
    expect(build).toContain('const dress = await buildChannelGiftDress(gift);');
    expect(build).toContain('const subject = await buildGiftSubjectArt(gift).catch(() => null);');
    const peer = fn('dressProfileCardPeerHero');
    expect(peer).toContain('void buildHeroGiftTheme(gift).then((theme) => {');
    expect(peer).toContain('profileCardPeerGiftTheme = theme;');
    expect(peer).toContain('dressProfileCardHero(false);');
    expect(peer, 'no second token painter for contacts').not.toContain('applyGiftHeroTokens(');
    // The motion plays whatever record the hero wears, not only one's own.
    expect(fn('syncHeroGiftMotion')).toContain('mountGiftMotion(canvas, theme, heroGiftMotion, {');
    // And no ring renderer exists beside it: a gift is shown the way it is shown locally, nowhere else.
    expect(app).not.toContain('applyAvatarGiftRing');
    expect(css).not.toContain('data-gift="true"');
  });

  it('WORN-06: wearing a NAME offers the same block publication — chats prove it already, the feed and the card read the block', () => {
    // [owner, 2026-09-09: "usernames — bound properly, or visual only again?"] Private messages carry the worn name
    // as a claim proven on every message; the feed, the channel and the card read the profile block. So wearing a
    // name offers the block's publication, exactly as wearing a gift does, and the block carries both at once.
    const name = fn('offerWornNamePublish');
    expect(name).toContain("title: remove ? t('username.unpublishTitle') : t('username.publishTitle', { name }),");
    expect(name).toContain('return offerProfileBlockPublish({');
    expect(fn('wornNamePublished')).toContain('cachedChannelProfile(own)?.ownerUsername');
    // The card's name tap: wear, repaint, THEN offer; taking off offers the reverse only while the chain still shows it.
    expect(app).toContain('const wasPublished = worn && wornNamePublished(nft.label);');
    expect(app).toContain('(worn ? (wasPublished ? offerWornNamePublish(nft.label, { remove: true }) : Promise.resolve(false)) : offerWornNamePublish(nft.label))');
    // A worn name the chain does not show yet carries the same "Show to others" button as a gift.
    expect(app).toContain("showName.textContent = t('profileCard.showOthers');");
    // wearPlathoUsername itself stays local — the offer is the card's, like the gift's.
    expect(fn('wearPlathoUsername')).not.toContain('offerWornNamePublish(');
    for (const key of ['username.publishTitle', 'username.publishHint', 'username.unpublishTitle', 'username.unpublishHint', 'username.publishFailed']) {
      expect(i18n.split(`"${key}":`).length - 1, `${key} in all ten locales`).toBe(10);
    }
  });

  it("WORN-07: the profile card steps out of the channel's dress — a card wears the viewer's own palette", () => {
    // [owner, 2026-09-09: opened his own card from inside my channel and found its buttons in MY gift's colours.]
    const onScreen = fn('channelOnScreen');
    expect(onScreen).toContain('if (profileCardDialog && !profileCardDialog.hidden) return null;');
    expect(onScreen.indexOf('profileCardDialog.hidden'), 'the card check comes before any channel is named')
      .toBeLessThan(onScreen.indexOf('publicChannelViewOpen'));
    expect(fn('openProfileCardDialog')).toMatch(/profileCardDialog\.hidden = false;\s*\n\s*applyGiftAppearance\(\);/);
    expect(fn('closeProfileCardDialog')).toContain('hideDialogAnimated(profileCardDialog, () => applyGiftAppearance());');
  });

  it("WORN-08: the pattern's subject is the artwork's ramp, thinned along the object's contours, within its own alpha", () => {
    // [owner, 2026-09-09: "go from the texture, not from the silhouette" — after two pure-vector recipes were turned
    // down.] The ramp ("how far from the backdrop") is what makes a cone's waffle an engraving; a book on indigo is
    // equally far everywhere, so its contours (Sobel of luminance, against the object's own strongest edge) thin the
    // ink instead, and the object's own vectors take the rays of light away. Factors, not cuts; one rule for all.
    const mask = fn('cutGiftSubjectMask');
    expect(mask).toContain('contours = false, objectAlpha = null');
    expect(mask, 'contours are read from the colours, before they are whitened').toContain('if (contours && !keepColour) {');
    expect(mask, 'against the object\'s own strongest edge, square-rooted').toContain('contour[index] = strongest > 0 ? 1 - Math.pow(grad[index] / strongest, GIFT_SUBJECT_CONTOUR_GAMMA) : 1;');
    expect(mask).toContain('if (contour) alpha *= contour[index];');
    expect(mask).toContain('if (objectAlpha) alpha *= objectAlpha[index];');
    const cut = fn('cutGiftSubjectForDrawing');
    expect(cut, 'the tile asks the vectors for the object\'s alpha; the hero\'s colour cut does not')
      .toContain('const objectAlpha = keepColour ? null : await giftObjectAlphaFromLottie(gift, drawing.units).catch(() => null);');
    expect(cut).toContain('{ keepColour, solid: keepColour, contours: !keepColour, objectAlpha }');
    const alpha = fn('giftObjectAlphaFromLottie');
    expect(alpha, 'the Gift layer the hero motion plays').toContain('unclipLottiePrecomps(giftOnlyLottie(await readTelegramGiftLottie(gift)))');
    expect(alpha, 'a ramp, not a cut').toContain('(px[(index * 4) + 3] - GIFT_SUBJECT_OBJECT_EDGE_FROM) / (GIFT_SUBJECT_OBJECT_EDGE_TO - GIFT_SUBJECT_OBJECT_EDGE_FROM)');
    expect(alpha, 'the player is torn down either way').toContain("try { anim.destroy(); } catch { /* already gone */ }");
    expect(app).toMatch(/const GIFT_SUBJECT_CONTOUR_GAMMA = 0\.5;/);
    expect(app).toMatch(/const GIFT_SUBJECT_OBJECT_EDGE_FROM = 191;/);
    expect(app).toMatch(/const GIFT_SUBJECT_OBJECT_EDGE_TO = 230;/);
    expect(app, 'no per-gift setting anywhere in the rule').not.toMatch(/slug === '(starnotepad|vicecream|spicedwine|chillflame)'/);
    // A changed recipe is a new version, so every stored tile is built again (cached-derivative rule).
    expect(app).toMatch(/const GIFT_PATTERN_TILE_VERSION = 3;/);
  });

  it('WORN-05: the worn mark stays a plain "Worn", the way out to others is a button, and every string exists in every locale', () => {
    // [owner, 2026-09-09: "make it as before, just Worn"] — no "· shown to others" suffix on the mark.
    expect(app).toContain("state.textContent = t('profileCard.worn');");
    expect(app).not.toContain('profileCard.wornShown');
    expect(app).toContain("show.textContent = t('profileCard.showOthers');");
    for (const key of [
      'gift.publishTitle', 'gift.publishHint', 'gift.publishSubmit',
      'gift.unpublishTitle', 'gift.unpublishHint', 'gift.unpublishSubmit', 'gift.publishFailed',
      'profileCard.showOthers',
    ]) {
      expect(i18n.split(`"${key}":`).length - 1, `${key} in all ten locales`).toBe(10);
    }
  });
});
