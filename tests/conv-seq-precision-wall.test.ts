import { describe, expect, it } from 'vitest';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { parseCapsulePublishBody, CAPSULE_PUBLISH_OPCODE } from '../web/conv-lane-read.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A CONVERSATION SEQ IS A uint64 ON CHAIN AND A Number IN THIS CLIENT — and past 2^53 those are not the same
// thing.
//
// [audit 2026-09-01, round 9.] RecordShard stores `seq: Int as uint64` and enforces only `seq > last_seq`
// (gate 13653): no upper bound. And the peer derives BOTH directions' write secrets from the shared K_root, so it
// can publish into the very shard this device writes its OWN outgoing messages into. Every seq on the client's
// read and write paths becomes a Number, so one record at 9007199254740992 does two things at once:
//
//   • the next honest record, at...93, reads back as the SAME number, so the pre-decrypt gate skips it unseen;
//   • `base + 1` stops advancing, so the client hands back a seq the chain has already seen, gate 13653 refuses
//     it, and EVERY message to that peer bounces for the rest of the UTC day — while the client believes it
//     advanced and shows no reason.
//
// The contract's own header prices a shard-day denial (filling SAFE_CAP) at ~11 TON. One capsule achieved it.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

/** A record body carrying one seq — the shape parseCapsulePublishBody accepts. */
function bodyForSeq(seq: bigint) {
  const sig = beginCell().bytesValue(new Uint8Array(64), 64, 'sig').endCell();
  const bodySig = beginCell().ref(beginCell().endCell()).ref(sig).endCell();
  return onWire(beginCell()
    .uint(CAPSULE_PUBLISH_OPCODE, 32)
    .uint(seq, 64)
    .ref(beginCell().endCell())
    .ref(beginCell().endCell())
    .ref(bodySig)
    .endCell());
}

describe('CONVSEQ — the precision wall is refused, not walked into', () => {
  it('CONVSEQ-01: a record whose seq a Number cannot carry is not a record', () => {
    // Everything inside the safe range still parses, including the largest legitimate value.
    for (const seq of [0n, 1n, 4096n, BigInt(Number.MAX_SAFE_INTEGER)]) {
      const parsed: any = parseCapsulePublishBody(bodyForSeq(seq));
      expect(parsed, `seq ${seq} must still parse`).toBeTruthy();
      expect(Number(parsed.seq)).toBe(Number(seq));
    }
    // Past it, the row is refused outright — so it can never raise the seq high-water and make its neighbours
    // indistinguishable. Refusing costs nothing real: no client of this protocol writes such a seq.
    for (const seq of [BigInt(Number.MAX_SAFE_INTEGER) + 1n, 2n ** 63n, 2n ** 64n - 1n]) {
      expect(parseCapsulePublishBody(bodyForSeq(seq)), `seq ${seq} must be refused`).toBeNull();
    }
  });

  it('CONVSEQ-02: the outgoing counter refuses to hand back a seq the chain will reject', async () => {
    const store: any = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(A, B, {
      kRoot: new Uint8Array(32).fill(0x5a), createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: null,
    });
    const epoch = 20_800;

    // The ordinary case is untouched: each call advances by one, above whatever the chain says.
    expect(await store.nextOutgoingSeq(A, B, epoch, 1_000_000)).toBe(1_000_001);
    expect(await store.nextOutgoingSeq(A, B, epoch, 1_000_000)).toBe(1_000_002);

    // A chain floor at the wall cannot be advanced past. Before this fix `base + 1` silently returned `base`,
    // the send went out with a seq the shard had already stored, and gate 13653 dropped it — every time.
    const poisoned = await store.nextOutgoingSeq(A, B, 20_801, Number.MAX_SAFE_INTEGER)
      .then(() => null, (error: any) => error);
    expect(poisoned, 'it must refuse rather than return a doomed seq').toBeTruthy();
    expect(poisoned.code).toBe('CONV_SEQ_EXHAUSTED');
    // …and one step below the wall still works, so the refusal is exactly at the boundary and not before it.
    expect(await store.nextOutgoingSeq(A, B, 20_802, Number.MAX_SAFE_INTEGER - 1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('CONVSEQ-03: the refusal is FATAL — no retry ladder against a chain verdict', () => {
    // The shard-day really is denied: gate 13653 refuses any seq that does not increase, and nothing the client
    // does produces one until UTC midnight rolls the day over. Retrying eight times would burn RPC budget and
    // leave the message churning instead of failing once, visibly.
    const app = require('node:fs').readFileSync('web/app.js', 'utf8');
    const start = app.indexOf('function isFatalPrivateSendError(');
    expect(start, 'the fatal classifier must still be there').toBeGreaterThan(-1);
    const body = app.slice(start, app.indexOf('\n}', start));
    expect(body).toContain("error?.code === 'CONV_SEQ_EXHAUSTED'");
  });
});
