import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  encodeCompactPayload,
  decodeCompactPayload,
  compactPayloadReservedTailBytes,
  createEncryptedConvCapsule,
  openEncryptedPrivateCapsule,
  createMessagingIdentity,
  exportPublicKeyBundle,
  randomBytes,
  PLATHO_COMPACT_IDENTITY_BYTES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES,
  PLATHO_COMPACT_SENDER_USERNAME_METADATA_PREFIX_BYTES,
} from '../web/crypto/platho-crypto.mjs';
import { splitBytesToCapsuleParts, MAX_CAPSULE_USEFUL_BYTES } from '../web/capsule-part-policy.mjs';
import {
  parseRecipientIdentity,
  preferredInboundIdentity,
  primaryThreadIdentity,
  threadIdentityVariants,
  identityKey,
  RECIPIENT_IDENTITY_TYPES,
} from '../web/recipient-identities.mjs';

const APP = readFileSync('web/app.js', 'utf8');

function convPayloadBytes(senderUsername?: string) {
  return encodeCompactPayload({
    type: 'document',
    bytes: new TextEncoder().encode('hello'),
    streamId: randomBytes(16),
    partIndex: 0,
    partCount: 1,
    senderUsername,
    reservedTailBytes: compactPayloadReservedTailBytes({ senderRecovery: true }),
  }, {});
}

describe('PEERNAME-WIRE — the name must survive the SEAL, not just the codec', () => {
  it('PEERNAME-WIRE-01: a sealed CONV capsule opens with the sender .ath the send path put in', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built = await createEncryptedConvCapsule('', bundle, sender, randomBytes(32), {
      payloadBytes: convPayloadBytes('platho'), senderRecovery: true,
    });
    const opened: any = await openEncryptedPrivateCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.payload.senderUsername).toBe('platho.ath');
  });

  it('PEERNAME-WIRE-02: anonymous mode seals NO name — the toggle survives the seal too', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built = await createEncryptedConvCapsule('', bundle, sender, randomBytes(32), {
      payloadBytes: convPayloadBytes(undefined), senderRecovery: true,
    });
    const opened: any = await openEncryptedPrivateCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.payload.senderUsername).toBeUndefined();
  });

  it('PEERNAME-WIRE-04: a MULTIPART message with a name still lands on a valid size class', async () => {
    const overhead = PLATHO_COMPACT_IDENTITY_BYTES
      + PLATHO_COMPACT_SENDER_RECOVERY_BYTES
      + PLATHO_COMPACT_RECIPIENT_WALLET_METADATA_BYTES
      + PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES
      + PLATHO_COMPACT_SENDER_USERNAME_METADATA_PREFIX_BYTES + 'platho.ath'.length;
    const document = randomBytes(MAX_CAPSULE_USEFUL_BYTES * 2);
    const parts = splitBytesToCapsuleParts(document, MAX_CAPSULE_USEFUL_BYTES, { perPartOverheadBytes: overhead });
    expect(parts.length, 'the fixture must actually be multipart').toBeGreaterThan(1);

    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const streamId = randomBytes(16);
    for (const [index, part] of parts.entries()) {
      const payloadBytes = encodeCompactPayload({
        type: 'document', bytes: part.bytes, sizeClass: part.sizeClass,
        streamId, partIndex: index, partCount: parts.length,
        senderUsername: 'platho',
        reservedTailBytes: compactPayloadReservedTailBytes({ senderRecovery: true }),
      }, {});
      const built = await createEncryptedConvCapsule('', bundle, sender, randomBytes(32), {
        payloadBytes, sizeClass: part.sizeClass, senderRecovery: true,
      });
      const opened: any = await openEncryptedPrivateCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
      expect(opened.payload.senderUsername).toBe('platho.ath');
      expect(opened.payload.partCount).toBe(parts.length);
    }
  });

  it('PEERNAME-WIRE-03: the send path actually passes the name to the encoder', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const send = app.slice(
      app.indexOf('async function attemptConvMessagePublishDirect'),
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    expect(send).toContain('senderUsername: privateSenderUsernameMetadataLabel(senderOptions) ?? undefined,');
    expect(send, 'the sender wallet must never enter a CONV payload').not.toMatch(/senderWallet/);
  });
});

describe('PEERNAME — the peer .ath travels on the wire and is verified before display', () => {
  it('PEERNAME-01: senderUsername survives encode -> decode as payload.senderUsername', () => {
    const encoded = encodeCompactPayload(
      { type: 'text', text: 'hi' },
      { usefulBytes: 512, senderUsername: 'glasnost' },
    );
    const payload = decodeCompactPayload(encoded);
    expect(payload.senderUsername).toBe('glasnost.ath');
    expect(payload.sender_username).toBe('glasnost.ath');
  });

  it('PEERNAME-02: a payload with no username decodes without one — absence must not read as a name', () => {
    const payload = decodeCompactPayload(encodeCompactPayload({ type: 'text', text: 'hi' }, { usefulBytes: 512 }));
    expect(payload.senderUsername).toBeUndefined();
    const reader = APP.slice(APP.indexOf('function claimedPeerUsernameFromOpened(opened) {'));
    expect(reader).toContain("typeof claim === 'string' && claim.trim().length > 0 ? claim : null");
  });

  it('PEERNAME-03: the claim is checked against the wallet before it can become the label', () => {
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    expect(fn.length).toBeGreaterThan(400);
    const verifyAt = fn.indexOf('verifiedPlathoUsernameIdentityForWallet(claimedUsername, peerWallet)');
    const applyAt = fn.indexOf('refreshThreadIdentityFromVariants(thread, variants)');
    expect(verifyAt, 'the .ath claim is not verified against the wallet').toBeGreaterThan(-1);
    expect(applyAt).toBeGreaterThan(-1);
    expect(verifyAt, 'the claim is applied before it is verified').toBeLessThan(applyAt);
    expect(fn).toContain('catch { usernameIdentity = null; }');
  });

  it('PEERNAME-04: name and address go over in ONE call, so the address cannot freeze the dialog', () => {
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    expect(fn).toContain('const variants = [...(usernameIdentity ? [usernameIdentity] : []), ...privateWalletIdentityVariants(peerWallet)];');
    expect((fn.match(/refreshThreadIdentityFromVariants\(/g) ?? []).length, 'exactly one apply call').toBe(1);
    expect(fn).toContain('if (usernameIdentity && !anonymous) {');
    expect(fn).toContain('thread.identity = usernameIdentity;');
  });

  it('PEERNAME-05: the resolution re-runs for a name but not once the dialog already wears it', () => {
    const queue = APP.slice(
      APP.indexOf('function queueInboundPeerIdentityResolution(thread, claimedUsername = null) {'),
      APP.indexOf('// onFirstContact:'),
    );
    expect(queue).toContain('if (!isAnonymousPeerThread(thread) && (!claimedUsername || threadWearsUsername(thread, claimedUsername))) return;');
    const wears = APP.slice(APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'));
    expect(wears).toContain('variant.value === claimed.value');
    expect(wears).toContain('plathoUsernameIdentity(claimedUsername)');
  });

  it('PEERNAME-06: both the single-part and multipart receive paths pass the claim along', () => {
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(opened));");
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(parts[0]?.opened));");
  });

  it('PEERNAME-07: the display-as chevron is not gated on having TWO identities to choose between', () => {
    expect(APP, 'the two-identity gate is back').not.toContain('identityDisplayOptions(thread).length <= 1');
    expect(APP).toContain('function identityMenuHidden(thread) {');
    expect((APP.match(/identityMenuButton\.hidden = identityMenuHidden\(thread\);/g) ?? []).length).toBe(2);
    const rest = APP.slice(APP.indexOf('function identityMenuHidden(thread) {'));
    const fn = rest.slice(0, rest.indexOf('\n}') + 2);
    expect(fn.length, 'the slice really spans the function').toBeGreaterThan(80);
    expect(fn).toContain('isSavedMessagesThread(thread)');
    const popover = APP.slice(
      APP.indexOf('function showIdentityPopover(thread, anchor) {'),
      APP.indexOf('function showPublicChannelDisplayPopover('),
    );
    expect(popover.length, 'the slice really spans the popover').toBeGreaterThan(600);
    expect(popover).toContain('onSetLocalName:');
  });
});

function loadNameSelection() {
  const cutAt = (start: string, end: string, min: number) => {
    const a = APP.indexOf(start);
    const b = APP.indexOf(end);
    expect(a, start + ' must exist').toBeGreaterThan(-1);
    expect(b, end + ' must exist').toBeGreaterThan(a);
    const src = APP.slice(a, b);
    expect(src.length, 'slice ' + start + ' looks truncated').toBeGreaterThan(min);
    return src;
  };
  const source = [
    cutAt('function threadSelectedIdentity', 'function threadDisplayLabel', 900),
    cutAt('function plathoUsernameIdentity', 'async function verifiedPlathoUsernameIdentityForWallet', 100),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(
    'parseRecipientIdentity', 'preferredInboundIdentity', 'primaryThreadIdentity',
    'threadIdentityVariants', 'identityKey', 'RECIPIENT_IDENTITY_TYPES',
    'function renderThreads() {}\n' + source + '\nreturn threadSelectedIdentity;',
  )(parseRecipientIdentity, preferredInboundIdentity, primaryThreadIdentity,
    threadIdentityVariants, identityKey, RECIPIENT_IDENTITY_TYPES);
}

const nameIdentity = (label: string) => {
  const parsed = parseRecipientIdentity(label);
  if (!parsed.ok || parsed.identity.type !== RECIPIENT_IDENTITY_TYPES.PLATHO_NFT) throw new Error('not a name: ' + label);
  return parsed.identity;
};
const walletIdentityOf = (value: string) => {
  const parsed = parseRecipientIdentity(value);
  if (!parsed.ok || parsed.identity.type !== RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS) throw new Error('not a wallet: ' + value);
  return parsed.identity;
};

describe('PEERNAME-SEL — the automatic pick reads everything known for the wallet', () => {
  const WALLET = 'UQ' + 'a'.repeat(46);

  it('PEERNAME-SEL-01: one screen — sticky address identity, two proven names, last claim wins', () => {
    const select = loadNameSelection();
    const thread = {
      identity: walletIdentityOf(WALLET),
      identityVariants: [nameIdentity('other.ath'), nameIdentity('scaming.ath')],
      claimedSenderUsername: 'scaming.ath',
    };
    const selected = select(thread);
    expect(selected?.type).toBe(RECIPIENT_IDENTITY_TYPES.PLATHO_NFT);
    expect(selected?.value).toBe(nameIdentity('scaming.ath').value);
  });

  it('PEERNAME-SEL-02: no remembered claim — any proven name still beats the raw address', () => {
    const select = loadNameSelection();
    const thread = { identity: walletIdentityOf(WALLET), identityVariants: [nameIdentity('other.ath')] };
    expect(select(thread)?.type).toBe(RECIPIENT_IDENTITY_TYPES.PLATHO_NFT);
  });

  it('PEERNAME-SEL-03: an UNPROVEN claim never surfaces — it only picks among proven variants', () => {
    const select = loadNameSelection();
    const thread = {
      identity: walletIdentityOf(WALLET),
      identityVariants: [nameIdentity('other.ath')],
      claimedSenderUsername: 'ghost.ath',
    };
    const selected = select(thread);
    expect(selected?.type).toBe(RECIPIENT_IDENTITY_TYPES.PLATHO_NFT);
    expect(selected?.value).not.toBe(nameIdentity('ghost.ath').value);
  });

  it('PEERNAME-SEL-04: an EXPLICIT address pick is the user speaking — it is respected over every name', () => {
    const select = loadNameSelection();
    const thread = {
      displayIdentity: walletIdentityOf(WALLET),
      identity: walletIdentityOf(WALLET),
      identityVariants: [nameIdentity('scaming.ath')],
      claimedSenderUsername: 'scaming.ath',
    };
    expect(select(thread)?.type).toBe(RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS);
  });

  it('PEERNAME-SEL-05: a local label still silences the identity pick, and a nameless wallet stays an address', () => {
    const select = loadNameSelection();
    expect(select({ localLabel: 'my buddy', identity: walletIdentityOf(WALLET), identityVariants: [nameIdentity('scaming.ath')] })).toBe(null);
    expect(select({ identity: walletIdentityOf(WALLET) })?.type).toBe(RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS);
  });
});

