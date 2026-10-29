import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createMessagingIdentity, exportPublicKeyBundle, createEncryptedConvCapsule,
  openEncryptedPrivateCapsule, convCapsuleHeader0Bytes, randomBytes,
} from '../web/crypto/platho-crypto.mjs';

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
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bucketKey = new Uint8Array(32).fill(0x11);
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built: any = await createEncryptedConvCapsule('hi', bundle, sender, bucketKey, {
      profileVersion: 7, avatarHash: `0x${'ab'.repeat(32)}`,
    });

    expect(built.header0.profileVersion, 'header0 never carried the pointer').toBeUndefined();
    expect(built.header0.avatarHash).toBeUndefined();
    expect(Object.keys(built.header0).sort())
      .toEqual(['bucketKey', 'cryptoSuite', 'kind', 'publishKind', 'sizeClass', 'suite', 'version']);
    const wire = convCapsuleHeader0Bytes(built.header0);
    expect(wire.length).toBe(40);
    expect(wire).not.toContain(0xab);
  });

  it('AVPTR-03: both receive builders read the identity first, header0 only as a fallback', () => {
    expect(APP).toContain('profileVersion: opened.profileVersion ?? opened.capsule?.header0?.profileVersion ?? 0,');
    expect(APP).toContain('avatarHash: opened.avatarHash ?? opened.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),');
    expect(APP).toContain('profileVersion: first?.profileVersion ?? first?.capsule?.header0?.profileVersion ?? 0,');
    expect(APP).toContain('avatarHash: first?.avatarHash ?? first?.capsule?.header0?.avatarHash ?? zeroAvatarHashHex(),');
    expect(APP, 'a header0-only pointer read is back').not.toContain('profileVersion: opened.capsule?.header0?.profileVersion ?? 0,');
    expect(APP, 'a header0-only pointer read is back').not.toContain('profileVersion: first?.capsule?.header0?.profileVersion ?? 0,');
  });

  it('AVPTR-04: the MEDIA FETCH is fed from the opened capsule too — the twin reader', () => {
    expect(APP, 'the header0-only pointer reader is back').not.toContain('function avatarPointerFromPrivateHeader(');
    expect(APP).toContain('function avatarPointerFromOpenedCapsule(opened) {');
    expect(APP).toContain('opened?.profileVersion ?? header0?.profileVersion ?? header0?.profile_version,');
    expect(APP).toContain('noteThreadFace(targetThread, avatarPointerFromOpenedCapsule(opened));');
    expect(APP).toContain('noteThreadFace(targetThread, avatarPointerFromOpenedCapsule(firstOpened));');
    expect((APP.match(/avatarPointerFromOpenedCapsule\(/g) ?? []).length, 'a hydration site was missed').toBe(3);
  });

  it('AVPTR-05: every way the media load can give up is LABELLED', () => {
    for (const step of ["note('no-provider')", "note('no-record'", "note('hash-mismatch'", "note('threw'", "note(url ? 'ok' : 'shard-empty')"]) {
      expect(APP, `an unlabelled avatar-load exit: ${step}`).toContain(step);
    }
    for (const step of ["noteShard('no-lane')", "noteShard('read-failed'", "noteShard(assembled?.imageUrl ? 'ok' : 'not-assembled'"]) {
      expect(APP, `an unlabelled avatar-shard exit: ${step}`).toContain(step);
    }
    expect(APP).toContain("note(url ? 'ok' : 'shard-empty');");
    expect(APP).toContain('const drop = { undecodable: 0, unmatched: 0 };');
    for (const counter of ['drop.undecodable += 1;', 'drop.unmatched += 1;']) {
      expect(APP, `a drop point is not counted: ${counter}`).toContain(counter);
    }
    expect(APP).toContain('why: lastMismatch,');
    expect(APP).toContain('drop,');
    expect(APP).toContain('entries: posts?.length ?? 0,');
    expect(APP).toContain('matched: parts.length,');
    expect(APP).toContain('want: Number(pointer.avatarPartCount ?? 0),');
    expect(APP).toContain('avatarLoad: globalThis.plathoLastAvatarLoad ?? null,');
    expect(APP).toContain('avatarShard: globalThis.plathoLastAvatarShard ?? null,');
  });

  it('AVPTR-06: the public payload stream id is read as the STRING key, not the byte array', () => {
    expect(APP).toContain("String(payload.stream_id ?? '').toLowerCase()");
    expect(APP, 'the byte-array key is being compared as a string').not.toContain('String(payload.streamId ??');
  });
});
