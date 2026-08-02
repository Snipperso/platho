import { describe, expect, it } from 'vitest';
import { stackNum, stackNumOr0, stackBool } from '../web/ton-stack-num.mjs';
import { parseIntroEntryStack } from '../web/intro-codec.mjs';
import { parseScanPageStack } from '../web/intro-transport.mjs';
import { decodeCapsuleRecordView, decodeRecordShardView } from '../web/conv-lane-read.mjs';
import { decodeRecoveryViewStack } from '../web/recovery-transport.mjs';

// The exact bytes toncenter v3 returned for `get_entry(0)` against the live clean-17 IntroShard
// EQAq5UP0zj03z69XFy8WHv6w0lfgkluzafZVmk9PGKUznia6 on 2026-08-02, transcribed from the response, not invented:
//
//   [0] {"type":"num","value":"-0x1"}                                                        exists  (Tact Bool)
//   [1] {"type":"num","value":"0x2bf0be4a5195b7563f8007dd8941952b365b50c913ee296a756b0239085ba175"}   r
//   [2] {"type":"num","value":"0xd072"}                                                      view_tag
//   [3] {"type":"num","value":"0xf82ca68cad74732b3bef6daf499a02961e0b8cf575daae5b946dc39a544c2c3e"}   body_commit
//   [4] {"type":"num","value":"0x6a6f7879"}                                                  created_at
const LIVE_GET_ENTRY_STACK = [
  { type: 'num', value: '-0x1' },
  { type: 'num', value: '0x2bf0be4a5195b7563f8007dd8941952b365b50c913ee296a756b0239085ba175' },
  { type: 'num', value: '0xd072' },
  { type: 'num', value: '0xf82ca68cad74732b3bef6daf499a02961e0b8cf575daae5b946dc39a544c2c3e' },
  { type: 'num', value: '0x6a6f7879' },
];

const num = (v: bigint) => ({ type: 'num', value: v < 0n ? `-0x${(-v).toString(16)}` : `0x${v.toString(16)}` });

describe('WIRE — a TVM integer as toncenter actually sends it', () => {
  it('STACKNUM-01: BigInt() cannot parse the form toncenter uses for a true Bool', () => {
    // The premise of every fix below, asserted rather than assumed. If a future runtime starts accepting "-0x1",
    // this test goes red and the whole ton-stack-num.mjs indirection can be reconsidered on evidence.
    expect(() => BigInt('-0x1')).toThrow();
    expect(BigInt('-1')).toBe(-1n);   // the DECIMAL form the old test stubs emitted, which is why they passed
  });

  it('STACKNUM-02: stackNum reads every form a transport can hand it', () => {
    expect(stackNum('-0x1')).toBe(-1n);
    expect(stackNum('0x6a6f7879')).toBe(0x6a6f7879n);
    expect(stackNum('-1')).toBe(-1n);
    expect(stackNum('42')).toBe(42n);
    expect(stackNum(42)).toBe(42n);
    expect(stackNum(42n)).toBe(42n);
    expect(() => stackNum(undefined, 'exists')).toThrow(/exists missing/);
    expect(stackNumOr0(undefined)).toBe(0n);
  });

  it('STACKNUM-03: a Tact Bool is -1, so a truth test must compare against zero and not against one', () => {
    expect(stackBool('-0x1')).toBe(true);
    expect(stackBool('0x0')).toBe(false);
    expect(stackBool(undefined)).toBe(false);
    // The mistake this guards: `=== 1n` reads every TRUE boolean on chain as false.
    expect(stackNum('-0x1') === 1n).toBe(false);
  });

  it('WIRE-01: the INTRO entry reader decodes the live stack that broke first contact', () => {
    const entry: any = parseIntroEntryStack(LIVE_GET_ENTRY_STACK);
    expect(entry.exists).toBe(true);
    expect(entry.r).toBe(0x2bf0be4a5195b7563f8007dd8941952b365b50c913ee296a756b0239085ba175n);
    expect(entry.view_tag).toBe(0xd072);
    expect(entry.created_at).toBe(0x6a6f7879);
  });

  it('WIRE-02: every clean-17 lane reader survives a true Bool on the wire', () => {
    // All three direct-pay lanes carried the identical defect, so all three are driven here. A fix applied to one
    // lane and not its twins is the failure this project has repeated most often.
    expect(decodeCapsuleRecordView([num(-1n), num(0x1234n), num(0x6a6f7879n)]))
      .toEqual({ exists: true, frameCommit: 0x1234n, createdAt: 0x6a6f7879 });

    expect(decodeRecordShardView([num(0n), num(20667n), num(7n), num(3n)]))
      .toEqual({ lastSeq: 7, recordCount: 3 });

    const scan: any = parseScanPageStack([num(0n), num(1n), num(1n), { type: 'num', value: '' }]);
    expect(scan.next_id).toBe(1n);

    const recovery: any = decodeRecoveryViewStack([
      num(0x99n), num(-1n), num(0x77n), num(4n), num(0x6a6f7879n), num(604800n),
      num(0n), num(0n), num(0n), num(0n), num(0n), num(0n),
    ]);
    expect(recovery.bound).toBe(true);
    expect(recovery.seq).toBe(4n);
  });

  it('WIRE-03: a FALSE Bool is still false — the fix must not turn absence into presence', () => {
    // Counter-case. Without it, a reader that returned `true` unconditionally would pass every assertion above.
    const absent: any = parseIntroEntryStack([num(0n), num(0n), num(0n), num(0n), num(0n)]);
    expect(absent.exists).toBe(false);
    expect(decodeCapsuleRecordView([num(0n), num(0n), num(0n)]).exists).toBe(false);
  });
});
