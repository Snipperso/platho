import { describe, expect, it } from 'vitest';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { parseCapsulePublishBody, CAPSULE_PUBLISH_OPCODE } from '../web/conv-lane-read.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';


const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

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
    for (const seq of [0n, 1n, 4096n, BigInt(Number.MAX_SAFE_INTEGER)]) {
      const parsed: any = parseCapsulePublishBody(bodyForSeq(seq));
      expect(parsed, `seq ${seq} must still parse`).toBeTruthy();
      expect(Number(parsed.seq)).toBe(Number(seq));
    }
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

    expect(await store.nextOutgoingSeq(A, B, epoch, 1_000_000)).toBe(1_000_001);
    expect(await store.nextOutgoingSeq(A, B, epoch, 1_000_000)).toBe(1_000_002);

    const poisoned = await store.nextOutgoingSeq(A, B, 20_801, Number.MAX_SAFE_INTEGER)
      .then(() => null, (error: any) => error);
    expect(poisoned, 'it must refuse rather than return a doomed seq').toBeTruthy();
    expect(poisoned.code).toBe('CONV_SEQ_EXHAUSTED');
    expect(await store.nextOutgoingSeq(A, B, 20_802, Number.MAX_SAFE_INTEGER - 1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('CONVSEQ-03: the refusal is FATAL — no retry ladder against a chain verdict', () => {
    const app = require('node:fs').readFileSync('web/app.js', 'utf8');
    const start = app.indexOf('function isFatalPrivateSendError(');
    expect(start, 'the fatal classifier must still be there').toBeGreaterThan(-1);
    const body = app.slice(start, app.indexOf('\n}', start));
    expect(body).toContain("error?.code === 'CONV_SEQ_EXHAUSTED'");
  });
});
