import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { CAPSULE_PUBLISH_OPCODE } from '../web/conv-lane-read.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A PRIVATE CONVERSATION MUST NOT BE BLANKABLE BY MESSAGES THE SHARD REFUSED.
//
// This is the PUBLIC lane's round-14 defect, in the lane where it costs more. The fix there aimed the
// /messages window at the shard's OWN ROWS' time (web/public-shard-ton-rpc-provider.mjs); CONV reads its bodies
// through the same createShardMessagesWithSourceReader and never got it.
//
// WHY IT WAS BELIEVED SAFE, and why that belief is refuted IN THIS REPOSITORY. web/app.js says of this reader:
// "A RecordShard address is derived from the conversation's K_root, so a stranger cannot address it and cannot
// grief this window". contracts/RecordShard.tact answers, in capitals, having learned it by measurement:
// "the address is public the instant anyone publishes (it is the destination of that transaction). A stranger
// who had only observed one publish appended junk to a private conversation. ADDRESS PRIVACY IS NOT
// AUTHORIZATION." The contract's own gates are correct — a forged capsule is refused 13654 and stores nothing.
// The READER is what trusts the window.
//
// And a refused message is still an inbound message of the account: MEASURED on live toncenter v3 in round 14,
// of 40 transactions on a real mainnet address 19 failed in COMPUTE and ALL 19 of their inbound messages came
// back from /api/v3/messages. The opcode filter cannot help — the opcode is chosen by the sender.
//
// The loss is worse here than on PUBLIC in three ways: the message is private and there is no second copy; the
// SENDER sees a green tick, because delivery is confirmed against the shard's STATE and not its history; and
// the descent that should page past the junk is stopped by the junk itself.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const PAGE = 128;                                  // CONV_SHARD_MESSAGE_PAGE_LIMIT
const SHARD_ADDRESS = `0:${'cd'.repeat(32)}`;
const KROOT = new Uint8Array(32).fill(0x5a);
const SELF = new Uint8Array(32).fill(0x11);
const PEER = new Uint8Array(32).fill(0x22);
const EPOCH = Math.floor(1_790_000_000 / 86400);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

/** A body parseCapsulePublishBody accepts, carrying one seq — a genuine publish's shape. */
function bodyForSeq(seq: number) {
  const sig = beginCell().bytesValue(new Uint8Array(64), 64, 'sig').endCell();
  const bodySig = beginCell().ref(beginCell().endCell()).ref(sig).endCell();
  return onWire(beginCell()
    .uint(CAPSULE_PUBLISH_OPCODE, 32)
    .uint(BigInt(seq), 64)
    .ref(beginCell().endCell())
    .ref(beginCell().endCell())
    .ref(bodySig)
    .endCell());
}

/**
 * THE GRIEFER'S MESSAGE: the reader's own opcode and nothing behind it. The shard REFUSES this — there is no
 * capsule to store — but the message is delivered, so the indexer returns it in the account's history like any
 * other. Deliberately unparseable, so it can never be mistaken for a record: the only thing measured here is
 * whether the REAL capsules survive it.
 */
function junkBody() {
  return onWire(beginCell().uint(CAPSULE_PUBLISH_OPCODE, 32).uint(0n, 64).endCell());
}

describe('CONV read window under refused-message flooding', () => {
  /** `real` genuine capsules, then `junk` refused messages sent after them. Returns what the lane reads back. */
  async function scene(real: number, junk: number, opts: { known: number; fullWalk: boolean }) {
    const rows: Array<{ body: any; createdLt: bigint }> = [];
    for (let seq = 1; seq <= real; seq += 1) rows.push({ body: bodyForSeq(seq), createdLt: BigInt(seq) });
    for (let i = 0; i < junk; i += 1) rows.push({ body: junkBody(), createdLt: BigInt(1000 + i) });

    const lane = createConvReadLane({
      verifyWriteSig: false,
      readMessagesWithSource: async (_address: string, options: any = {}) => {
        const endLt = options?.endLt == null ? null : BigInt(options.endLt);
        const visible = endLt === null ? rows : rows.filter((r) => r.createdLt <= endLt);
        // toncenter serves newest-first under a limit — reproduce both, or the window under test is not the one
        // that ships.
        return visible.slice(-PAGE).reverse().map((r) => ({ bodyCell: r.body, createdLt: String(r.createdLt) }));
      },
    });

    const gaps: any[] = [];
    const failures: any[] = [];
    const out = await lane.readIncoming({
      kRoot: KROOT, selfKeyId: SELF, peerKeyId: PEER, epochNow: EPOCH, windowW: 0,
      shards: [{ epoch: EPOCH, dir: 0, bucketKey: 1n, writePublicKey: new Uint8Array(32), address: SHARD_ADDRESS }],
      knownSeqOf: () => opts.known,
      onShardFailed: (address: string, error: any) => failures.push({ address, error }),
      onShardGap: (address: string, info: any) => gaps.push({ address, info }),
      fullWalk: opts.fullWalk,
    });
    return { seqs: out.map((e: any) => Number(e.seq)).sort((a: number, b: number) => a - b), gaps, failures };
  }

  it('CONV-POISON-01: three paid capsules survive a flood that fills the whole window', async () => {
    const clean = await scene(3, 0, { known: 0, fullWalk: false });
    expect(clean.seqs, 'the control: with no flood the conversation reads back whole').toEqual([1, 2, 3]);

    const flooded = await scene(3, PAGE, { known: 0, fullWalk: false });
    // eslint-disable-next-line no-console
    console.log(`[CONV-POISON-01] clean ${clean.seqs.length}/3 | after ${PAGE} refused messages `
      + `${flooded.seqs.length}/3 | gaps ${flooded.gaps.length} | failures ${flooded.failures.length}`);
    expect(flooded.seqs, 'a private message that is on chain and paid for must not vanish because a stranger '
      + 'paid gas to have messages refused at its shard').toEqual([1, 2, 3]);
  });

  it('CONV-POISON-02: the MANUAL full rescan reaches them too — the walk a user asks for must finish', async () => {
    // knownSeqOf: => 0 with fullWalk is what app.js lends a manual Sync. If even that cannot see past the
    // junk, the user is told the conversation is up to date over a hole they explicitly asked to fill.
    const deep = await scene(3, PAGE, { known: 0, fullWalk: true });
    // eslint-disable-next-line no-console
    console.log(`[CONV-POISON-02] manual full rescan: ${deep.seqs.length}/3 read, `
      + `gaps ${deep.gaps.length}, failures ${deep.failures.length}`);
    expect(deep.seqs, 'a full rescan must reach the capsules under the flood').toEqual([1, 2, 3]);
    // And if it ever cannot, it must at least SAY so rather than report a clean pass.
    if (deep.seqs.length < 3) {
      expect(deep.gaps.length, 'a short read must be reported, never returned as a clean pass').toBeGreaterThan(0);
    }
  });

  it('CONV-POISON-03: the premise the reader was built on is refuted by the contract it reads', () => {
    // A source pin, deliberately: this is the belief that made the unbounded window look safe, and the contract
    // wrote down the measurement that refutes it. If the client's sentence ever comes back, this goes red.
    const shard = readFileSync('contracts/RecordShard.tact', 'utf8');
    expect(shard, 'the contract records what it learned by measurement')
      .toContain('ADDRESS PRIVACY IS NOT AUTHORIZATION');
    const app = readFileSync('web/app.js', 'utf8');
    expect(app, 'and the client may not claim the opposite of it')
      .not.toContain('a stranger cannot address it and cannot grief');
  });
});
