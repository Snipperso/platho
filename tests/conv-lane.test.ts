import { describe, expect, it } from 'vitest';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  openPrivateCapsuleChainEntry,
} from '../web/crypto/platho-crypto.mjs';
import { outgoingRecordShard } from '../web/conv-discovery.mjs';
import { buildConvPublishWalletMessage } from '../web/conv-lane-send.mjs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { CONV_PUBLISH_VALUE } from '../web/publish-price.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-LANE — the read assembly, end-to-end against a STUB transport: A publishes into its outgoing RecordShard, B
// scans that same shard as "incoming" (the conv-discovery invariant), and the lane returns exactly A's capsule —
// verified under the conversation write key and openable to B's plaintext — while junk and a forged-signature body at
// the same address are dropped. If the assembly wired the wrong direction or skipped the write-sig gate, B would read
// nothing (silent loss) or accept a forgery. Runs with no chain, the way public-lane/intro-lane tests do.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const kRoot = new Uint8Array(32).fill(0x5a);
const keyIdA = new Uint8Array(32).fill(0x11);
const keyIdB = new Uint8Array(32).fill(0x22);
const CREATED = 1_790_000_000;
const EPOCH = Math.floor(CREATED / 86400);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

describe('CONV-LANE (read assembly)', () => {
  it('CONV-LANE-01: A publishes; B reads its incoming shard, finds+verifies+opens A\'s capsule, drops junk+forgery', async () => {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const bBundle = exportPublicKeyBundle(B.encryptionKeyPair);

    // A publishes into its outgoing direction (A=self, B=peer).
    const routeA = await outgoingRecordShard({ kRoot, selfKeyId: keyIdA, peerKeyId: keyIdB, createdAtSec: CREATED });
    const capsule = await createEncryptedConvCapsule('доставлено через RecordShard', bBundle, A, routeA.bucketKey, {});
    const good = await buildConvPublishWalletMessage({
      writePublicKey: routeA.writePublicKey, writeSecret: routeA.writeSecret, seq: 1, epoch: routeA.epoch, capsule, value: CONV_PUBLISH_VALUE,
    });

    // A FORGED body: a structurally-valid CapsulePublish signed by a DIFFERENT write secret, dumped at the same shard
    // address (anyone can send a message there). Its write sig must fail under A's write pubkey.
    const forgedSecret = new Uint8Array(32).fill(0x99);
    const forgedCapsule = await createEncryptedConvCapsule('forgery', bBundle, A, routeA.bucketKey, {});
    const forged = await buildConvPublishWalletMessage({
      writePublicKey: ed25519.getPublicKey(forgedSecret), writeSecret: forgedSecret, seq: 2, epoch: routeA.epoch, capsule: forgedCapsule, value: CONV_PUBLISH_VALUE,
    });
    const junk = beginCell().uint(0xdeadbeefn, 32, 'op').uint(0n, 64, 'x').endCell();

    // Stub transport: A's shard address holds the good body + a forged body + junk; every other address is empty.
    const byAddress = new Map<string, any[]>();
    byAddress.set(addrKey(good.to), [
      { bodyCell: onWire(good.body), source: null },
      { bodyCell: onWire(forged.body), source: null },
      { bodyCell: onWire(junk), source: null },
    ]);
    const lane = createConvReadLane({
      readMessagesWithSource: async (address: string) => byAddress.get(addrKey(address)) ?? [],
    });

    // B receives (B=self, A=peer), scanning a window that covers the epoch.
    const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });

    expect(entries.length, 'exactly the one authentic capsule survives (junk + forgery dropped)').toBe(1);
    expect(addrKey(entries[0].address), 'it came from A\'s outgoing shard = B\'s incoming shard').toBe(addrKey(good.to));
    expect(entries[0].seq).toBe('1');

    const opened = await openPrivateCapsuleChainEntry(entries[0].entry, B.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext, 'B decrypts A\'s message').toBe('доставлено через RecordShard');
    expect(opened.openedAs).toBe('recipient');
  }, 120_000);

  it('CONV-LANE-02: a conversation with no published messages reads back empty (clean, not an error)', async () => {
    const lane = createConvReadLane({ readMessagesWithSource: async () => [] });
    const entries = await lane.readIncoming({ kRoot, selfKeyId: keyIdB, peerKeyId: keyIdA, epochNow: EPOCH, windowW: 2 });
    expect(entries).toEqual([]);
  });
});
