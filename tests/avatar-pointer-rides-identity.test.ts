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
    // A FIXED bucketKey, not a random one. The wire assertion below scans the 40 bytes for the pointer's marker
    // byte, and 32 random bytes contain any given value about 12% of the time — a test that fails one run in eight
    // for a reason unrelated to what it is checking teaches people to re-run until green. (Caught 2026-08-04, in a
    // test written the same day: the scan is the right check, the random fixture was not.)
    const bucketKey = new Uint8Array(32).fill(0x11);
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built: any = await createEncryptedConvCapsule('hi', bundle, sender, bucketKey, {
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

  it('AVPTR-04: the MEDIA FETCH is fed from the opened capsule too — the twin reader', () => {
    // v824 fixed the message RECORD and the dialog still showed no avatar, because a SECOND reader feeds the fetch
    // and it was still handed header0. Two readers of one wrong source; fixing one and shipping is the "fix one lane,
    // check the twin" failure this project has hit before.
    expect(APP, 'the header0-only pointer reader is back').not.toContain('function avatarPointerFromPrivateHeader(');
    expect(APP).toContain('function avatarPointerFromOpenedCapsule(opened) {');
    expect(APP).toContain('opened?.profileVersion ?? header0?.profileVersion ?? header0?.profile_version,');
    // Both hydration sites — single-part and multipart — pass the OPENED capsule, never its header.
    expect(APP).toContain('avatarPointerFromOpenedCapsule(opened),');
    expect(APP).toContain('avatarPointerFromOpenedCapsule(firstOpened),');
    expect((APP.match(/avatarPointerFromOpenedCapsule\(/g) ?? []).length, 'a hydration site was missed').toBe(3);
  });

  it('AVPTR-05: every way the media load can give up is LABELLED', () => {
    // Six returns hand back the same null, and from outside they are one symptom: the letter tile stays. Three
    // rounds were spent proving the chain healthy link by link because nothing said WHICH step gave up. Each exit
    // now names itself, and the shard read reports the three counts that separate its own gates.
    for (const step of ["note('no-provider')", "note('no-record'", "note('hash-mismatch'", "note('threw'", "note(url ? 'ok' : 'shard-empty')"]) {
      expect(APP, `an unlabelled avatar-load exit: ${step}`).toContain(step);
    }
    for (const step of ["noteShard('no-lane')", "noteShard('read-failed'", "noteShard(assembled?.imageUrl ? 'ok' : 'not-assembled'"]) {
      expect(APP, `an unlabelled avatar-shard exit: ${step}`).toContain(step);
    }
    // A load that FAILED must overwrite a previous success, or the dump reports the last good own-avatar load as the
    // outcome of a peer load that returned nothing — which is what the first instrumented dump actually showed.
    expect(APP).toContain("note(url ? 'ok' : 'shard-empty');");
    // The three drop points inside the loop are counted separately: all three merely left `parts` empty, and a live
    // reproduction in node had all three PASSING on the same chain data, so only the device can say which one fires.
    expect(APP).toContain('const drop = { unparsed: 0, undecodable: 0, unmatched: 0 };');
    for (const counter of ['drop.unparsed += 1;', 'drop.undecodable += 1;', 'drop.unmatched += 1;']) {
      expect(APP, `a drop point is not counted: ${counter}`).toContain(counter);
    }
    // …and the rejected gate NAMES itself: four conditions collapse into one `false` otherwise.
    expect(APP).toContain('why: lastMismatch,');
    expect(APP).toContain('drop,');
    // messages -> matched -> assembled: which number collapses says which gate rejected the parts.
    expect(APP).toContain('messages: messages?.length ?? 0,');
    expect(APP).toContain('matched: parts.length,');
    expect(APP).toContain('want: Number(pointer.avatarPartCount ?? 0),');
    // …and both records reach the dump, or labelling them changes nothing.
    expect(APP).toContain('avatarLoad: globalThis.plathoLastAvatarLoad ?? null,');
    expect(APP).toContain('avatarShard: globalThis.plathoLastAvatarShard ?? null,');
  });

  it('AVPTR-06: the public payload stream id is read as the STRING key, not the byte array', () => {
    // readPublicPostPayloadV2 emits BOTH `stream_id` (hex string) and `streamId` (raw 16 bytes). Only the string can
    // be compared against the pointer. I briefly "fixed" this to prefer camelCase on the strength of reading the
    // INNER header parser instead of the outer payload reader — String(Uint8Array) is "172,12,187,…", which would
    // have broken a comparison that worked. Measured before shipping; pinned so it cannot be modernised back.
    expect(APP).toContain("String(payload.stream_id ?? '').toLowerCase()");
    expect(APP, 'the byte-array key is being compared as a string').not.toContain('String(payload.streamId ??');
  });
});
