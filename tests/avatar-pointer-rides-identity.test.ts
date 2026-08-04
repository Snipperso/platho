import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createMessagingIdentity, exportPublicKeyBundle, createEncryptedConvCapsule,
  openEncryptedPrivateCapsule, convCapsuleHeader0Bytes, randomBytes,
} from '../web/crypto/platho-crypto.mjs';

// THE PEER'S AVATAR POINTER RIDES THE DECRYPTED IDENTITY, NOT header0.
//
// MEASURED 2026-08-04 from the owner's dump: every received message showed `pv: 0, ah: zero`, so a private dialog
// could never paint the peer's avatar — while BOTH wallets had one registered on chain (verified directly:
// platho.ath version 1 / 2 parts, glasnost.ath version 1 / 1 part, stream ids matching their KeyShard pointers).
//
// The cause is structural, not a race: a CONV header0 serialises to EXACTLY 40 bytes — magic(4), version,
// publishKind, sizeClass, cryptoSuite, bucketKey(32) — and has nowhere to put a version plus a 32-byte hash. The
// in-memory header0 OBJECT carries them, the WIRE does not, and a chain-sourced capsule rebuilds header0 from those
// 40 bytes. So `opened.capsule.header0.profileVersion` was always undefined and `?? 0` did the rest.
//
// This is the third instance of one class in a day: reading a field off an object that does not carry it on the wire
// (the others were payload.senderUsername and result.seqno). The test therefore goes through a REAL seal and out the
// other side — comparing two struct definitions would have "proved" the old code too.
const APP = readFileSync('web/app.js', 'utf8');

describe('AVPTR — the avatar pointer survives a CONV seal, and is read where it lands', () => {
  it('AVPTR-01: a sealed CONV capsule opens with the sender profile pointer intact', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const avatarHash = `0x${'ab'.repeat(32)}`;

    const built = await createEncryptedConvCapsule('hi', bundle, sender, randomBytes(32), {
      profileVersion: 7, avatarHash,
    });
    const opened: any = await openEncryptedPrivateCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });

    expect(opened.profileVersion, 'the pointer did not survive the seal').toBe(7);
    expect(String(opened.avatarHash).toLowerCase()).toContain('ab'.repeat(32));
  });

  it('AVPTR-02: header0 on the WIRE is 40 bytes and cannot hold the pointer — the counter-case', async () => {
    // The assertion that makes AVPTR-01 meaningful. If header0 could carry the pointer, reading it from there would
    // have been fine and this whole fix would be noise.
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built: any = await createEncryptedConvCapsule('hi', bundle, sender, randomBytes(32), {
      profileVersion: 7, avatarHash: `0x${'ab'.repeat(32)}`,
    });

    // header0 does not carry the pointer in EITHER form — not on the wire and not even in memory. The CONV sealer
    // builds header0 from six fields (version, kind, publishKind, sizeClass, cryptoSuite, bucketKey) and hands the
    // pointer to privateCapsuleIdentityBytes instead. So `opened.capsule.header0.profileVersion` was reading a
    // property that has never existed on this path, and `?? 0` turned that into a confident zero.
    expect(built.header0.profileVersion, 'header0 never carried the pointer').toBeUndefined();
    expect(built.header0.avatarHash).toBeUndefined();
    expect(Object.keys(built.header0).sort())
      .toEqual(['bucketKey', 'cryptoSuite', 'kind', 'publishKind', 'sizeClass', 'suite', 'version']);
    // …and the wire form is 40 bytes, with no room for a version plus a 32-byte hash even if someone tried.
    const wire = convCapsuleHeader0Bytes(built.header0);
    expect(wire.length).toBe(40);
    expect(wire).not.toContain(0xab);
  });

  it('AVPTR-03: both receive builders read the identity first, header0 only as a fallback', () => {
    // Single-part and multipart. Fixing one and leaving the other is how the reserved-tail defect shipped in July.
    expect(APP).toContain('profileVersion: opened.profileVersion ?? opened.capsule?.header0?.profileVersion ?? 0,');
    expect(APP).toContain('avatarHash: opened.avatarHash ?? opened.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),');
    expect(APP).toContain('profileVersion: first?.profileVersion ?? first?.capsule?.header0?.profileVersion ?? 0,');
    expect(APP).toContain('avatarHash: first?.avatarHash ?? first?.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),');
    // The header0-only read must not come back anywhere.
    expect(APP, 'a header0-only pointer read is back').not.toContain('profileVersion: opened.capsule?.header0?.profileVersion ?? 0,');
    expect(APP, 'a header0-only pointer read is back').not.toContain('profileVersion: first?.capsule?.header0?.profileVersion ?? 0,');
  });
});
