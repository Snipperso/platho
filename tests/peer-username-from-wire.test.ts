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

// A dialog must show the peer's .ath, not their raw address — when the peer has one and it is REALLY theirs.
//
// OBSERVED 2026-08-03 on the owner's phone, build v811: the wallet address finally appeared (the previous fix), but
// the .ath linked to that same wallet did not. The name was never missing from the wire — the sender attaches it as
// `senderUsername` compact-payload metadata (currentPrivateSenderOptions), and the receiver decodes it into
// `payload.senderUsername`. Nothing on the private receive path ever read it. Only public posts did.
//
// Two things had to hold for the fix, and both are pinned here rather than argued:
//   1. the claim really does survive the codec into `payload.senderUsername` — asserted by a ROUND TRIP below, not by
//      reading the encoder and the decoder and believing they agree (they are declared in separate places, which is
//      exactly the shape that has silently diverged in this codebase before);
//   2. the claim is VERIFIED against the dialog's wallet before it becomes a label — the sender types this string, so
//      an unverified claim would let anyone wear anyone's name.
const APP = readFileSync('web/app.js', 'utf8');

/** The payload the live CONV send builds, byte for byte: same encoder, same options, same reserved tail. */
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
  // THE MISTAKE THIS EXISTS TO PREVENT, made 2026-08-03 and caught by the owner within the hour.
  //
  // The first version of this fix shipped with a test that proved encodeCompactPayload -> decodeCompactPayload
  // round-trips `senderUsername`, and concluded the name was "on the wire". It was not. attemptConvMessagePublishDirect
  // computed `senderOptions` and used it ONLY for the size budget — it never handed it to the encoder, so the field the
  // receive path read was never written by the send path. The codec test passed the whole time.
  //
  // A round trip through a codec proves a codec. These go through createEncryptedConvCapsule and out the other side
  // via openEncryptedPrivateCapsule, so what is asserted is what a recipient can actually read.
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
    // Counter-case. currentPrivateSenderOptions leaves senderUsername undefined when the eye is on, and this proves
    // the omission reaches the recipient rather than being a UI-only promise.
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
    // The known landmine. Adding metadata grows the encoded payload, and a part sized without room for it throws
    // "Compact payload must use a supported useful slot size" — which is exactly how the 68-byte identity section
    // broke every message after first contact. The split reserves privateCompactPayloadOverhead, which has ALWAYS
    // included the username bytes (that over-reservation is the evidence the omission was an oversight), so this
    // asserts the reservation is real rather than assuming it.
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
      // createEncryptedConvCapsule throws "CONV capsule payload size class mismatch" if the encoded payload landed
      // on a different class than the split assigned — the seal is the assertion.
      const built = await createEncryptedConvCapsule('', bundle, sender, randomBytes(32), {
        payloadBytes, sizeClass: part.sizeClass, senderRecovery: true,
      });
      const opened: any = await openEncryptedPrivateCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
      expect(opened.payload.senderUsername).toBe('platho.ath');
      expect(opened.payload.partCount).toBe(parts.length);
    }
  });

  it('PEERNAME-WIRE-03: the send path actually passes the name to the encoder', () => {
    // The line whose absence caused all of the above. Pinned at the call site, not at the helper.
    const app = readFileSync('web/app.js', 'utf8');
    const send = app.slice(
      app.indexOf('async function attemptConvMessagePublishDirect'),
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
    );
    expect(send).toContain('senderUsername: privateSenderUsernameMetadataLabel(senderOptions) ?? undefined,');
    // The sender WALLET stays out — that omission IS deliberate and must not be undone by this change.
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
    // The exact property the receive path now reads. A rename on either side breaks this, which is the point.
    expect(payload.senderUsername).toBe('glasnost.ath');
    expect(payload.sender_username).toBe('glasnost.ath');
  });

  it('PEERNAME-02: a payload with no username decodes without one — absence must not read as a name', () => {
    // Counter-case: PEERNAME-01 alone would also pass against a decoder that hard-coded the string.
    const payload = decodeCompactPayload(encodeCompactPayload({ type: 'text', text: 'hi' }, { usefulBytes: 512 }));
    expect(payload.senderUsername).toBeUndefined();
    // …and the reader treats that as "no claim", not as an empty name to verify.
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
    // A transient read must keep the address rather than clear the dialog's name.
    expect(fn).toContain('catch { usernameIdentity = null; }');
  });

  it('PEERNAME-04: name and address go over in ONE call, so the address cannot freeze the dialog', () => {
    // refreshThreadIdentityFromVariants never REPLACES thread.identity once set, and preferredInboundIdentity ranks
    // PLATHO_NFT above WALLET_ADDRESS. Handing them over separately would permanently pin whichever landed first —
    // the address, since the KeyShard read returns before the username read.
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    expect(fn).toContain('const variants = [...(usernameIdentity ? [usernameIdentity] : []), ...privateWalletIdentityVariants(peerWallet)];');
    expect((fn.match(/refreshThreadIdentityFromVariants\(/g) ?? []).length, 'exactly one apply call').toBe(1);
    // And an ALREADY-named dialog (address landed in an earlier build) is upgraded to the verified name.
    expect(fn).toContain('if (usernameIdentity && !anonymous) {');
    expect(fn).toContain('thread.identity = usernameIdentity;');
  });

  it('PEERNAME-05: the resolution re-runs for a name but not once the dialog already wears it', () => {
    // Without the second half this fires a chain read on EVERY incoming message for the life of the dialog.
    const queue = APP.slice(
      APP.indexOf('function queueInboundPeerIdentityResolution(thread, claimedUsername = null) {'),
      APP.indexOf('// onFirstContact:'),
    );
    expect(queue).toContain('if (!isAnonymousPeerThread(thread) && (!claimedUsername || threadWearsUsername(thread, claimedUsername))) return;');
    // Canonical comparison — "name", "name.ath" and "NAME" must not each trigger their own read.
    const wears = APP.slice(APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'));
    expect(wears).toContain('variant.value === claimed.value');
    expect(wears).toContain('plathoUsernameIdentity(claimedUsername)');
  });

  it('PEERNAME-06: both the single-part and multipart receive paths pass the claim along', () => {
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(opened));");
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(parts[0]?.opened));");
  });

  it('PEERNAME-07: the display-as chevron is not gated on having TWO identities to choose between', () => {
    // OBSERVED 2026-08-03: a dialog named by its wallet address had no chevron at all, so there was no way to rename
    // it. The gate was `identityDisplayOptions(thread).length <= 1` — "hide unless there are at least two identities"
    // — which is true of every inbound dialog, since it has exactly one: the peer's address. But the popover's FIRST
    // item is "Set local name", an action that never depends on how many identities exist, so the button was hiding
    // the only way to reach it.
    expect(APP, 'the two-identity gate is back').not.toContain('identityDisplayOptions(thread).length <= 1');
    expect(APP).toContain('function identityMenuHidden(thread) {');
    // Both header branches (identity resolved and not) must use the same rule — they disagreed before, which is how
    // the stricter one went unnoticed.
    expect((APP.match(/identityMenuButton\.hidden = identityMenuHidden\(thread\);/g) ?? []).length).toBe(2);
    // Saved messages keeps no chevron: re-labelling your own notes as your own address is not a choice.
    // Bounded by the function's own end, for the same reason as the window below: a character count is a window
    // that rots the moment a comment is added above the line it watches.
    const rest = APP.slice(APP.indexOf('function identityMenuHidden(thread) {'));
    const fn = rest.slice(0, rest.indexOf('\n}') + 2);
    expect(fn.length, 'the slice really spans the function').toBeGreaterThan(80);
    expect(fn).toContain('isSavedMessagesThread(thread)');
    // …and the popover really does always offer the action the button now exposes. Cut to the NEXT function, not to
    // a character count: this window was 1,400 wide and every row added since (the pin, the mute, the shared
    // identity view) pushed the line it was looking for further down until it fell out and the gate failed on an
    // unrelated change.
    const popover = APP.slice(
      APP.indexOf('function showIdentityPopover(thread, anchor) {'),
      APP.indexOf('function showPublicChannelDisplayPopover('),
    );
    expect(popover.length, 'the slice really spans the popover').toBeGreaterThan(600);
    expect(popover).toContain('onSetLocalName:');
  });
});
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PEERNAME-SEL — a name once PROVEN for the wallet stays on the dialog; only a proven transfer takes it off.
//
// [OWNER 2026-08-26] "even if he sent anonymously, the name must not fall off — I still see his wallet; he
// wrote to me non-anonymously before." The reported screen: the header and the thread row wore the raw address
// while the "Display as" menu listed TWO proven names for that very wallet. Mechanics: thread.identity latches
// onto the FIRST history snapshot applied at rebirth (an address-era one), and only a LIVE verified claim could
// re-dress it — which a peer who unlinked, toggled anonymity, or linked a name held by their other wallet never
// sends again. The claim is how a name is LEARNED, never how it is kept.
//
// Real code, real identity module: threadSelectedIdentity + claimedThreadIdentityFromVariants +
// plathoUsernameIdentity are lifted from app.js and run against the reported state.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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
    source + '\nreturn threadSelectedIdentity;',
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

  it('PEERNAME-SEL-01: the reported screen — sticky address identity, two proven names, last claim wins', () => {
    const select = loadNameSelection();
    const thread = {
      identity: walletIdentityOf(WALLET),                                   // the address-era snapshot latch
      identityVariants: [nameIdentity('other.ath'), nameIdentity('scaming.ath')],
      claimedSenderUsername: 'scaming.ath',                                 // what the peer last called themselves
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
      claimedSenderUsername: 'ghost.ath',                                   // typed by the sender, never verified
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

