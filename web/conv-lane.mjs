// conv-lane — the READ assembly of the clean-17 private CONV lane, wired together in one place (mirror of public-lane).
//
// The pieces exist on their own: conv-discovery derives the incoming RecordShard addresses for a conversation from its
// K_root (A's outgoing direction == B's incoming direction, address = f(bucketKey, epoch), zero on-chain lookups), and
// conv-lane-read parses a shard's published CapsulePublish bodies back into openable chain-entries and verifies the
// write signature. What did not exist was anything that put them together for one conversation. This is that seam.
//
// IT STOPS AT AUTHENTICATED-TRANSPORT ENTRIES. Decrypt is the app's job (it holds the recipient key), exactly as
// public-lane stops at authenticated posts: this returns parsed capsule chain-entries whose write signature verified
// under the conversation-direction write key, and app.js opens each with openPrivateCapsuleChainEntry (which does the
// recipient-key decrypt + in-body sender-signature check). A body that fails the write-sig gate is dropped here (junk
// sent to a public shard address); a body encrypted to someone else fails to open downstream. Neither ever surfaces.
//
// WHY ITS OWN MODULE rather than lines in app.js: app.js cannot be tested without a browser; here the whole read lane
// runs against a stub transport and fixed key-ids, the way the public and intro lanes do.

import { incomingRecordShards } from './conv-discovery.mjs?v=1';
import { parseCapsulePublishBody, convChainEntryFromParsed, verifyConvWriteSignature } from './conv-lane-read.mjs?v=1';

/**
 * Build the CONV read lane.
 *
 * `readMessagesWithSource` is createShardMessagesWithSourceReader(rpc) — `async (address) -> [{ bodyCell, source }]`,
 * the SAME reader the public and intro lanes use (a friendly shard address is accepted as the toncenter destination,
 * as the intro lane already relies on in production). `verifyWriteSig` (default true) re-checks each body's write
 * signature under the bucket's write public key before accepting it — the same gate RecordShard enforces.
 */
export function createConvReadLane({ readMessagesWithSource, verifyWriteSig = true } = {}) {
  if (typeof readMessagesWithSource !== 'function') throw new Error('createConvReadLane requires readMessagesWithSource');
  return {
    /**
     * Every incoming CONV capsule chain-entry for one conversation across the acceptance window [epochNow-windowW ..
     * epochNow]. Each entry is ready for openPrivateCapsuleChainEntry. Foreign/malformed/wrong-signature bodies are
     * dropped. A shard whose read throws is skipped (its conversation window is best-effort, never fatal to the rest).
     */
    async readIncoming({ kRoot, selfKeyId, peerKeyId, epochNow, windowW }) {
      const buckets = await incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
      const out = [];
      for (const bucket of buckets) {
        let messages;
        try { messages = await readMessagesWithSource(bucket.address); } catch { continue; }
        for (const { bodyCell } of messages ?? []) {
          const parsed = parseCapsulePublishBody(bodyCell);
          if (!parsed) continue;
          if (verifyWriteSig && !(await verifyConvWriteSignature(parsed, bucket.writePublicKey))) continue;
          out.push({
            epoch: bucket.epoch,
            dir: bucket.dir,
            address: bucket.address,
            seq: parsed.seq === undefined || parsed.seq === null ? null : String(parsed.seq),
            entry: convChainEntryFromParsed(parsed),
          });
        }
      }
      return out;
    },
  };
}
