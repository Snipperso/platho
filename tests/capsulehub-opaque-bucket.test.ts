import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// clean-16 Фаза 4 · ИНК1 — opaque-bucket refactor (tests-first).
//
// GOAL: the on-chain private-lane index must stop exposing the directed who-to-whom graph. The
// pre-clean-16 contract kept TWO open, scrapeable indexes keyed by 256-bit identity keyIds read
// straight out of header_0: private_sender_index (senderKeyId @bits[64,320)) and
// private_recipient_index (recipientKeyId @bits[320,576)), each with a public getter. The recipient
// index is exactly what was scraped. ИНК1 deletes the recipient graph entirely and re-labels the
// sender index as an OPAQUE bucket index keyed by the client's HKDF bucketKey (same byte window
// [64,320), but the contract now treats it as an opaque map key — no sender/recipient/directionality
// meaning, per the D7-override: the contract stores NO sender label and infers NO directionality).
//
// This increment does NOT change the wire (header0 stays its current size; the 320/336 fork is ИНК2).
// It is a pure internal refactor of index naming/semantics + deletion of the recipient graph, plus a
// defense-in-depth privateHeaderPublishKind extractor (byte@5) that ИНК3's meta-assert will use.

const CAPSULEHUB = readFileSync(join('contracts', 'CapsuleHub.tact'), 'utf8');

describe('CapsuleHub opaque-bucket refactor (clean-16 Фаза 4 ИНК1)', () => {
  it('OPAQUE-BUCKET-01: the open recipient graph is entirely deleted from CapsuleHub', () => {
    // No recipient index map, extractor, push/prune helpers, struct link, or public getter may survive.
    // If ANY of these reaches immutable genesis, the directed who-to-whom graph leaks forever.
    for (const forbidden of [
      'private_recipient_index',
      'privateHeaderRecipientKeyId',
      'pushPrivateRecipientIndex',
      'prunePrivateRecipientIndex',
      'recipient_prev_link',
      'get_private_recipient_index',
    ]) {
      expect(CAPSULEHUB, `recipient-graph symbol must be gone: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('OPAQUE-BUCKET-02: the sender index is renamed to an opaque bucket index (no sender label)', () => {
    // The whole point of the D7-override: the surviving CONV index is keyed by the opaque bucketKey
    // and carries NO sender-derived label. The old sender-named symbols must be gone; the opaque
    // bucket-named symbols must be present.
    for (const forbidden of [
      'private_sender_index',
      'privateHeaderSenderKeyId',
      'pushPrivateSenderIndex',
      'prunePrivateSenderIndex',
      'get_private_sender_index',
      'sender_prev_link',
    ]) {
      expect(CAPSULEHUB, `sender-named symbol must be renamed away: ${forbidden}`).not.toContain(forbidden);
    }
    for (const present of [
      'private_bucket_index',
      'privateHeaderBucketKey',
      'pushPrivateBucketIndex',
      'prunePrivateBucketIndex',
      'get_private_bucket_index',
      'bucket_prev_link',
    ]) {
      expect(CAPSULEHUB, `opaque bucket symbol must exist: ${present}`).toContain(present);
    }
  });

  it('OPAQUE-BUCKET-03: D7-override — no sender-directional metadata is stored or exposed', () => {
    // The contract must never reintroduce a sender label / first-publisher / directional reject code.
    for (const forbidden of ['first_publisher_key', 'RJ_BUCKET_PUBLISHER', '13531']) {
      expect(CAPSULEHUB, `D7-override forbids: ${forbidden}`).not.toContain(forbidden);
    }
    // The public index view is renamed to a bucket view exposing bucket_key (opaque), not key_id.
    expect(CAPSULEHUB, 'bucket index view').toContain('PrivateBucketIndexView');
    expect(CAPSULEHUB, 'bucket view exposes opaque bucket_key').toMatch(/bucket_key:\s*Int/);
  });

  it('OPAQUE-BUCKET-04: privateHeaderBucketKey reads the same header0 window the sender extractor did', () => {
    // Byte-identical extraction: loadUint(64) meta skip, then loadUint(256) = bits[64,320). The window
    // must not drift — the client emits the opaque bucketKey there, and a one-field drift mis-routes
    // every CONV message irreversibly on immutable genesis.
    const fn = CAPSULEHUB.match(/fun privateHeaderBucketKey\(header0: Cell\): Int \{[\s\S]*?\n {4}\}/);
    expect(fn, 'privateHeaderBucketKey must exist').not.toBeNull();
    expect(fn![0]).toMatch(/loadUint\(64\)/);
    expect(fn![0]).toMatch(/loadUint\(256\)/);
  });

  it('OPAQUE-BUCKET-05: privateHeaderPublishKind extractor exists (byte@5, defense for ИНК3 meta-assert)', () => {
    // CONV and (later) RECOVERY share an identical header0 length; the only on-chain discriminator is the
    // batch publish_kind cross-checked against header0 byte@5. Introduce the extractor now so ИНК3 can
    // wire the meta-assert. Layout: skip 40 bits (magic32+version8), then loadUint(8) = publishKind.
    const fn = CAPSULEHUB.match(/fun privateHeaderPublishKind\(header0: Cell\): Int \{[\s\S]*?\n {4}\}/);
    expect(fn, 'privateHeaderPublishKind must exist').not.toBeNull();
    expect(fn![0]).toMatch(/loadUint\(40\)/);
    expect(fn![0]).toMatch(/loadUint\(8\)/);
  });
});
