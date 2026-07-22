import { describe, expect, it } from 'vitest';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  openPrivateCapsuleChainEntry,
  randomBytes,
} from '../web/crypto/platho-crypto.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { buildConvPublishBody } from '../web/conv-publish-browser.mjs';
import { parseCapsulePublishBody, convChainEntryFromParsed, verifyConvWriteSignature } from '../web/conv-lane-read.mjs';
import { parseBocBase64, serializeBoc, computeCellHashAndDepth, beginCell } from '../web/pwa-contract-transactions.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-LANE-READ — a RecordShard stores only a frame_commit, so the recipient recovers the capsule from the PUBLISHED
// message body. This module is the exact inverse of buildConvPublishBody: parse wrong and the recipient reads garbage
// (or nothing) while the sender saw a green send — the silent-loss failure this whole lane exists to prevent. So the
// tests drive a REAL sealed CONV capsule the whole way — seal → wallet body → on-wire BoC → parse → decrypt — and
// prove it comes back to the same plaintext, plus the write signature verifies under the conversation write key.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
const EPOCH = Math.floor(CLOCK / 86400);
const WRITE_SECRET = new Uint8Array(32).fill(0x5a);
const WRITE_PUB = ed25519.getPublicKey(WRITE_SECRET);
const hexHash = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash).toString('hex');
// what the transport reader hands the parser in production: a client cell freshly parsed from the tx BoC.
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

describe('CONV-LANE-READ', () => {
  it('CLR-ROUNDTRIP: parseCapsulePublishBody is the exact inverse of buildConvPublishBody', async () => {
    const header0 = beginCell().bytesValue(new Uint8Array(40).fill(0x11), 40, 'h0').endCell();
    const header1 = beginCell().bytesValue(new Uint8Array(32).fill(0x12), 32, 'h1').endCell();
    const body = beginCell().bytesValue(new Uint8Array(120).fill(0x13), 120, 'b').endCell();
    const sig = new Uint8Array(64).fill(0x77);

    const parsed = parseCapsulePublishBody(onWire(buildConvPublishBody({ seq: 42, header0, header1, body, sig })));
    expect(parsed, 'a CapsulePublish body parses').toBeTruthy();
    expect(Number(parsed!.seq)).toBe(42);
    expect(await hexHash(parsed!.header0), 'header0 recovered').toBe(await hexHash(header0));
    expect(await hexHash(parsed!.header1), 'header1 recovered').toBe(await hexHash(header1));
    expect(await hexHash(parsed!.body), 'body recovered').toBe(await hexHash(body));
    expect(Buffer.from(parsed!.sig).toString('hex'), 'the 64-byte write sig recovered').toBe(Buffer.from(sig).toString('hex'));
  });

  it('CLR-E2E: a real sealed CONV capsule published then read back decrypts to the same plaintext + verifies the write sig', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const capsule = await createEncryptedConvCapsule('привет из RecordShard', recipientBundle, sender, randomBytes(32), {});

    const prepared = await buildConvPublishWalletMessage({
      writePublicKey: WRITE_PUB, writeSecret: WRITE_SECRET, seq: 7, epoch: EPOCH, capsule, value: CONV_PUBLISH_VALUE,
    });
    const parsed = parseCapsulePublishBody(onWire(prepared.body));
    expect(parsed, 'the published body parses').toBeTruthy();
    expect(Number(parsed!.seq)).toBe(7);

    // transport-level auth: the write sig verifies under the conversation write key, and a wrong key is refused.
    expect(await verifyConvWriteSignature(parsed, WRITE_PUB), 'write sig verifies under the conversation write key').toBe(true);
    expect(await verifyConvWriteSignature(parsed, ed25519.getPublicKey(new Uint8Array(32).fill(0x09))), 'a wrong write key is refused').toBe(false);

    // crypto-level: reconstruct the chain-entry and open it to the recipient's keys.
    const entry = convChainEntryFromParsed(parsed, { createdAtSec: CLOCK });
    const opened = await openPrivateCapsuleChainEntry(entry, recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext, 'decrypts to the original plaintext').toBe('привет из RecordShard');
    expect(Buffer.from(opened.senderSigningPublicKey).toString('hex'), 'recovers the sender signing key').toBe(
      Buffer.from(sender.signingPublicKey).toString('hex'));
    expect(opened.openedAs).toBe('recipient');
  }, 120_000);

  it('CLR-JUNK: a foreign / malformed body parses to null (a mixed shard history is skipped cleanly)', async () => {
    const foreign = beginCell().uint(0xdeadbeefn, 32, 'op').uint(1n, 64, 'x').endCell();
    expect(parseCapsulePublishBody(onWire(foreign)), 'wrong opcode → null').toBeNull();
    expect(parseCapsulePublishBody(null), 'no cell → null').toBeNull();
  });
});
