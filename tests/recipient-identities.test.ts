import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RECIPIENT_IDENTITY_TYPES,
  createInboundPeerThread,
  createRecipientThread,
  findThreadByIdentityVariants,
  identityKey,
  identityTone,
  parseRecipientIdentity,
  plathoUsernameTier,
  PLATHO_USERNAME_TIERS,
  preferredInboundIdentity,
  primaryThreadIdentity,
  recipientIdentityFromThreadId,
  threadIdentitySearchText,
  threadIdentityVariants,
} from '../web/recipient-identities.mjs';

const FRIENDLY_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

describe('PWA recipient identity routing', () => {
  it('RECIPIENT-ID-01: accepts wallet, explicit .ton, and bare or explicit Platho routes', () => {
    expect(parseRecipientIdentity(FRIENDLY_ADDRESS)).toMatchObject({
      ok: true,
      identity: { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, label: FRIENDLY_ADDRESS },
    });
    expect(parseRecipientIdentity('Alice.TON')).toMatchObject({
      ok: true,
      identity: { type: RECIPIENT_IDENTITY_TYPES.TON_DNS, label: 'alice.ton' },
    });
    expect(parseRecipientIdentity('alice.ath')).toMatchObject({
      ok: true,
      identity: { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, label: 'alice.ath' },
    });
    expect(parseRecipientIdentity('alice')).toMatchObject({
      ok: true,
      identity: {
        type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT,
        value: 'alice.ath',
        label: 'alice.ath',
        entered: 'alice',
      },
    });
    expect(parseRecipientIdentity('Alice_1-X.ATH')).toMatchObject({
      ok: true,
      identity: { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, label: 'alice_1-x.ath' },
    });
    expect(parseRecipientIdentity('@alice')).toMatchObject({ ok: false });
    expect(parseRecipientIdentity('alice.platho')).toMatchObject({ ok: false });
    expect(parseRecipientIdentity('bad.name.ath')).toMatchObject({ ok: false });
  });

  it('RECIPIENT-ID-02: new threads keep the route the user typed as the primary chat label', () => {
    const byAddress = createRecipientThread(FRIENDLY_ADDRESS);
    const byTonDns = createRecipientThread('alice.ton');
    const byPlathoNft = createRecipientThread('alice.ath');
    const byBarePlathoNft = createRecipientThread('alice');

    expect(byAddress).toMatchObject({
      ok: true,
      thread: { name: FRIENDLY_ADDRESS, subtitle: 'Wallet address' },
    });
    expect(byTonDns).toMatchObject({
      ok: true,
      thread: { name: 'alice.ton', subtitle: 'TON DNS' },
    });
    expect(byPlathoNft).toMatchObject({
      ok: true,
      thread: { name: 'alice.ath', subtitle: 'Platho NFT' },
    });
    expect(byBarePlathoNft).toMatchObject({
      ok: true,
      thread: {
        id: 'dm:platho_nft:alice.ath',
        name: 'alice.ath',
        subtitle: 'Platho NFT',
      },
    });

    const labeled = createRecipientThread(FRIENDLY_ADDRESS, { localLabel: 'Anonymous' });
    expect(labeled).toMatchObject({
      ok: true,
      thread: {
        name: 'Anonymous',
        localLabel: 'Anonymous',
        subtitle: `Wallet address - ${FRIENDLY_ADDRESS}`,
      },
    });
  });

  it('RECIPIENT-ID-03: identity variants remain visible without replacing the primary route', () => {
    const thread = {
      id: 'dm:wallet_address:EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
      name: FRIENDLY_ADDRESS,
      identity: { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: FRIENDLY_ADDRESS, label: FRIENDLY_ADDRESS },
      identityVariants: [
        { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, value: 'alice.ath', label: 'alice.ath' },
        { type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'alice.ton', label: 'alice.ton' },
      ],
    };

    expect(primaryThreadIdentity(thread)?.label).toBe(FRIENDLY_ADDRESS);
    expect(threadIdentityVariants(thread).map((item) => item.label)).toEqual([
      FRIENDLY_ADDRESS,
      'alice.ath',
      'alice.ton',
    ]);
    expect(threadIdentitySearchText(thread)).toContain('alice.ton');
    expect(recipientIdentityFromThreadId(thread.id)?.label).toBe(FRIENDLY_ADDRESS);
    expect(recipientIdentityFromThreadId('dm:ton_dns:%E0%A4%A')).toBeNull();
  });

  it('RECIPIENT-ID-04: inbound peer threads prefer Platho NFT, then TON DNS, then wallet address', () => {
    const withPlatho = createInboundPeerThread({
      senderKeyId: 'sender-alpha',
      ownerWallet: FRIENDLY_ADDRESS,
      identityVariants: [
        { type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'alice.ton', label: 'alice.ton' },
        { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, value: 'alice.ath', label: 'alice.ath' },
      ],
    });
    const withTon = createInboundPeerThread({
      senderKeyId: 'sender-beta',
      ownerWallet: FRIENDLY_ADDRESS,
      identityVariants: [{ type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'alice.ton', label: 'alice.ton' }],
    });
    const withWallet = createInboundPeerThread({
      senderKeyId: 'sender-gamma',
      ownerWallet: FRIENDLY_ADDRESS,
    });

    expect(primaryThreadIdentity(withPlatho)?.label).toBe('alice.ath');
    expect(withPlatho.name).toBe('alice.ath');
    expect(primaryThreadIdentity(withTon)?.label).toBe('alice.ton');
    expect(withTon.name).toBe('alice.ton');
    expect(primaryThreadIdentity(withWallet)?.label).toBe(FRIENDLY_ADDRESS);
    expect(withWallet.name).toBe(FRIENDLY_ADDRESS);
    expect(preferredInboundIdentity(threadIdentityVariants(withPlatho))?.type).toBe(RECIPIENT_IDENTITY_TYPES.PLATHO_NFT);
    expect(identityKey(primaryThreadIdentity(withPlatho))).toBe('platho_nft:alice.ath');
  });

  it('RECIPIENT-ID-04A: inbound anonymous peer fallback stays per sender key', () => {
    const thread = createInboundPeerThread({ senderKeyId: 'sender-alpha' });
    const second = createInboundPeerThread({ senderKeyId: 'sender-alpha-2' });

    expect(thread.id).toBe('peer:sender-alpha');
    expect(second.id).toBe('peer:sender-alpha-2');
    expect(thread.name).toBe('Anonymous sender-a');
    expect(thread.subtitle).toBe('Anonymous sender');
  });

  it('RECIPIENT-ID-05: existing typed-route chats are reused without replacing their label', () => {
    const byAddress = createRecipientThread(FRIENDLY_ADDRESS);
    expect(byAddress.ok).toBe(true);
    byAddress.thread.identityVariants.push(
      { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, value: 'alice.ath', label: 'alice.ath' },
      { type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'alice.ton', label: 'alice.ton' },
    );

    const found = findThreadByIdentityVariants([byAddress.thread], [
      { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, value: 'alice.ath', label: 'alice.ath' },
      { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: FRIENDLY_ADDRESS, label: FRIENDLY_ADDRESS },
    ]);

    expect(found).toBe(byAddress.thread);
    expect(primaryThreadIdentity(found)?.label).toBe(FRIENDLY_ADDRESS);
  });

  it('RECIPIENT-ID-06: display identity can be chosen without losing known routes', () => {
    const thread = {
      id: 'dm:wallet_address:EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
      name: FRIENDLY_ADDRESS,
      identity: { type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: FRIENDLY_ADDRESS, label: FRIENDLY_ADDRESS },
      displayIdentity: { type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'alice.ton', label: 'alice.ton' },
      identityVariants: [
        { type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, value: 'alice.ath', label: 'alice.ath' },
        { type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'alice.ton', label: 'alice.ton' },
      ],
    };

    expect(primaryThreadIdentity(thread)?.label).toBe('alice.ton');
    expect(threadIdentityVariants(thread).map(identityKey)).toEqual([
      'ton_dns:alice.ton',
      `wallet_address:${FRIENDLY_ADDRESS}`,
      'platho_nft:alice.ath',
    ]);
  });
});

describe('.ath name tiers', () => {
  // [OWNER 2026-08-24: "we have ordinary usernames (6+ letters), rare (5) and epic (4). On the NFT picture we mark
  // that with colours — gold, silver. Maybe we should mark 4-5 letter usernames with gold and silver in the app
  // too?"] Yes — and from ONE definition of where a tier begins, because the mint price already had those same
  // boundaries written out separately. Two copies is how the price and the colour end up disagreeing.
  it('ATHTIER-01: four characters is epic, five is rare, six and up is common', () => {
    expect(plathoUsernameTier('nova')).toBe(PLATHO_USERNAME_TIERS.EPIC);
    expect(plathoUsernameTier('atlas')).toBe(PLATHO_USERNAME_TIERS.RARE);
    expect(plathoUsernameTier('platho')).toBe(PLATHO_USERNAME_TIERS.COMMON);
    expect(plathoUsernameTier('sixteencharacter')).toBe(PLATHO_USERNAME_TIERS.COMMON);
    // The .ath suffix is stripped before counting, and stripped as a LITERAL — an unescaped dot in that regex
    // would eat the last four characters of any name, making "xxath" (a genuine 5-letter name) look like a 1.
    expect(plathoUsernameTier('nova.ath')).toBe(PLATHO_USERNAME_TIERS.EPIC);
    expect(plathoUsernameTier('xxath')).toBe(PLATHO_USERNAME_TIERS.RARE);
    // Not a mintable name at all — no tier, rather than a wrong one.
    expect(plathoUsernameTier('abc')).toBeNull();
    expect(plathoUsernameTier('seventeencharacte')).toBeNull();
    expect(plathoUsernameTier('')).toBeNull();
    expect(plathoUsernameTier(null)).toBeNull();
  });

  it('ATHTIER-02: the tone carries the tier, and only for a .ath name', () => {
    const ath = (value: string) => ({ type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT, value });
    expect(identityTone(ath('nova.ath'))).toBe('platho-epic');
    expect(identityTone(ath('atlas.ath'))).toBe('platho-rare');
    // COMMON keeps the plain tone: it is the default case, and colouring it too would say nothing.
    expect(identityTone(ath('platho.ath'))).toBe('platho');
    // Other identity kinds are untouched — a wallet is not scarce and a .ton name is not ours to grade.
    expect(identityTone({ type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS, value: 'UQabc' })).toBe('wallet');
    expect(identityTone({ type: RECIPIENT_IDENTITY_TYPES.TON_DNS, value: 'foo.ton' })).toBe('ton');
    expect(identityTone(null)).toBe('wallet');
  });

  it('ATHTIER-03: every tone the tier can produce has a colour, in all three theme blocks', () => {
    // A tone with no rule renders as inherited text — the name would silently lose its colour instead of gaining
    // one, which is the failure this feature is most likely to have.
    const css = readFileSync('web/styles.css', 'utf8');
    for (const tone of ['platho-epic', 'platho-rare']) {
      expect(css, `${tone} needs a rule`).toContain(`.identity-label-${tone} {\n  color: var(--id-${tone});\n}`);
    }
    // dark, system-light and toggled-light — a token defined once would leave one theme with no colour at all.
    expect((css.match(/--id-platho-epic:/g) ?? []).length).toBe(3);
    expect((css.match(/--id-platho-rare:/g) ?? []).length).toBe(3);
    // And the price reads the same tier function rather than repeating the lengths.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/function localUsernameMintPriceAtomic\(username\) \{\s*\n\s*const tier = plathoUsernameTier\(username\);/);
    expect(app, 'the old length ladder must be gone, not merely bypassed').not.toMatch(/if \(length === 4\) return USERNAME_PRICE_4_CHARS_ATOMIC;/);
  });
});

describe('.ath tier on the avatar', () => {
  it('ATHTIER-04: the icon wears the tier too, from the SAME tone as the name', () => {
    // [OWNER 2026-08-24: "let's colour the icon for silver and gold too. Make the background so it's immediately
    // clear it's silver."] A flat fill reads as "some yellow square"; metal is read from the band of light across
    // it, so each tier is a three-stop diagonal — bright, dark, bright.
    const app = readFileSync('web/app.js', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    // ONE mapping from tone to tier, so a name and its avatar cannot disagree about what a name is worth.
    expect(app).toMatch(/function applyAvatarTier\(node, tone\) \{[\s\S]{0,240}?const tier = tone === 'platho-epic' \? 'epic' : tone === 'platho-rare' \? 'rare' : null;/);
    expect(app, 'and it CLEARS the mark, or a reused row keeps another contact\'s metal').toMatch(/if \(tier\) node\.dataset\.tier = tier;\s*\n\s*else delete node\.dataset\.tier;/);
    // Applied where every thread avatar routes through — list, conversation header, share sheet — and on the
    // public author's, whose title is already painted in the same tone.
    expect(app).toMatch(/applyAvatarTier\(node, threadDisplayTone\(thread\)\);/);
    expect(app).toMatch(/applyAvatarTier\(publicPostDetailAvatar, authorTone\);/);
    for (const tier of ['epic', 'rare']) {
      expect(css).toContain(`.avatar[data-tier="${tier}"] {`);
      // With a photo the fill is hidden, so the tier moves to a ring — the one case where it matters most.
      expect(css).toContain(`.avatar.has-image[data-tier="${tier}"] {`);
    }
  });
});
