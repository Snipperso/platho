import { describe, expect, it } from 'vitest';
import {
  RECIPIENT_IDENTITY_TYPES,
  createInboundPeerThread,
  createRecipientThread,
  findThreadByIdentityVariants,
  identityKey,
  parseRecipientIdentity,
  preferredInboundIdentity,
  primaryThreadIdentity,
  recipientIdentityFromThreadId,
  threadIdentitySearchText,
  threadIdentityVariants,
} from '../web/recipient-identities.mjs';

const FRIENDLY_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';

describe('PWA recipient identity routing', () => {
  it('RECIPIENT-ID-01: accepts only explicit wallet, .ton, or .ath routes', () => {
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
    expect(parseRecipientIdentity('@alice')).toMatchObject({ ok: false });
    expect(parseRecipientIdentity('alice')).toMatchObject({ ok: false });
    expect(parseRecipientIdentity('alice.platho')).toMatchObject({ ok: false });
  });

  it('RECIPIENT-ID-02: new threads keep the route the user typed as the primary chat label', () => {
    const byAddress = createRecipientThread(FRIENDLY_ADDRESS);
    const byTonDns = createRecipientThread('alice.ton');
    const byPlathoNft = createRecipientThread('alice.ath');

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
