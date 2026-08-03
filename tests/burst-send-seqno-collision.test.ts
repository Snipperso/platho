import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createPlathoWallet,
  sendPlathoWalletTransaction,
  getPlathoWalletSeqno,
  __resetWalletSeqnoFloorsForTests,
} from '../web/platho-wallet.mjs';

// A BURST OF MESSAGES MUST NOT SIGN TWICE AGAINST THE SAME SEQNO.
//
// WHAT THIS IS: hardening of a real defect. A seqno is a SIGNING INPUT — the wallet contract accepts one external per
// seqno and silently drops the rest — and two things made a repeat possible:
//   1. getPlathoWalletSeqno passed NO cacheTtlMs, so it inherited the transport default of 15_000 ms
//      (platho-config runGetMethodCacheTtlMs; `seqno` has no per-method override). A value used to sign must never be
//      served from memory.
//   2. CONCURRENT sends still collide even on fresh reads. Post-April TON includes a transaction in well under a
//      second, so a read taken after the previous send RETURNED will normally see the advance — but two calls that
//      OVERLAP read the same value and the loser is dropped silently. This is the v417 Vault burst wedge — a
//      per-owner monotonic nonce floor solved it there — re-derived for the counter that replaced the nonce.
//
// WHAT THIS IS **NOT**: the explanation of the 2026-08-03 burst, in which ~8 messages all stayed on "sending" and two
// reached the recipient. I claimed it was, and an adversarial review refuted it on three counts I then verified by
// hand:
//   • A seqno collision is a SILENT drop: toncenter answers 200, sendBoc resolves, and app.js reaches
//     markDirectSendPublished which sets meta='published' — OPTIMISTIC GREEN. The observation was the opposite: no
//     green at all.
//   • On the direct lane "sending" does NOT mean "the external has not landed" — that semantics belongs to
//     publishStateMeta, and the direct lane never creates a publishState (web/app.js, "the direct lane never creates
//     one"). It means the publish call has not returned success: still in flight, or thrown and retrying.
//   • THE TWO DELIVERED MESSAGES WERE ALSO ON "sending". Their externals provably landed while the sender never
//     reached markDirectSendPublished — impossible under a collision, and the signature of an ambiguous broadcast.
//   • And the 15-second window does not exist on the send path at all: ton-rpc-transport clears the whole
//     run-get-method cache after every successful sendBoc (twice — scoped at the leaf, unscoped in the fallback
//     wrapper), so the first send of a burst wipes the value before the second reads it.
// The real cause of that burst is still open; it looks like RPC saturation / ambiguous broadcast, and the send path
// carries no diagnostics to tell those apart from one screenshot.
// The same throwaway test mnemonic tests/platho-wallet.test.ts uses — never a real wallet.
const MNEMONIC = [
  'hospital', 'stove', 'relief', 'fringe', 'tongue', 'always', 'charge', 'angry',
  'urge', 'sentence', 'again', 'match', 'nerve', 'inquiry', 'senior', 'coconut',
  'label', 'tumble', 'carry', 'category', 'beauty', 'bean', 'road', 'solution',
];

/** A chain that is HONEST but SLOW: it reports the same seqno until told the block landed. */
function frozenChainTransport(startSeqno: number) {
  const calls: any[] = [];
  const sent: any[] = [];
  let seqno = startSeqno;
  return {
    calls,
    sent,
    advance: () => { seqno += 1; },
    transport: {
      async runGetMethod(call: any) {
        calls.push(call);
        return { stack: [{ type: 'num', value: `0x${seqno.toString(16)}` }] };
      },
      async sendBoc(input: any) {
        sent.push(input);
        return { ok: true };
      },
    },
  };
}

const MESSAGE = { address: `0:${'11'.repeat(32)}`, amount: '19100000', payload: null };

describe('BURSTSEQ — consecutive sends must not collide on one wallet seqno', () => {
  it('BURSTSEQ-01: the seqno read is FRESH — a signing input may never come from cache', async () => {
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(7);
    await getPlathoWalletSeqno(wallet, chain.transport);
    expect(chain.calls).toHaveLength(1);
    expect(chain.calls[0].method).toBe('seqno');
    // The whole defect in one assertion: without this the call inherits the 15s default and a burst signs one value.
    expect(chain.calls[0].cacheTtlMs, 'the seqno read may not be served from cache').toBe(0);
  });

  it('BURSTSEQ-02: two sends against an UNCHANGED chain seqno still sign different seqnos', async () => {
    // The exact shape of the owner's burst: the chain has not included the first external when the second is signed.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(7);

    const first = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
    const second = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });

    expect(first.seqno).toBe(7);
    expect(second.seqno, 'the second message reused the first seqno — the chain drops it').toBe(8);
    expect(chain.sent).toHaveLength(2);
  });

  it('BURSTSEQ-03: a whole burst of eight gets eight distinct seqnos', async () => {
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(100);
    const seqnos: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
      seqnos.push(res.seqno);
    }
    expect(seqnos).toEqual([100, 101, 102, 103, 104, 105, 106, 107]);
    expect(new Set(seqnos).size, 'a repeated seqno means a silently dropped message').toBe(8);
  });

  it('BURSTSEQ-04: the chain WINS when it runs ahead — another device on the same wallet', async () => {
    // The floor must never hold a value BELOW the chain: a second device sending from the same wallet advances the
    // real seqno, and signing under our stale floor would be the same collision from the other side.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(50);
    const first = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
    expect(first.seqno).toBe(50);
    chain.advance(); chain.advance(); chain.advance();   // someone else sent three
    const second = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
    expect(second.seqno, 'the floor must not hold below a chain that ran ahead').toBe(53);
  });

  it('BURSTSEQ-05: an explicit seqno passes through untouched — idempotent re-broadcast', async () => {
    // A re-broadcast re-sends an ALREADY SIGNED external bound to its own seqno. Re-signing it under a new one would
    // double-execute if the first copy had in fact landed, which is the opposite defect.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(400);
    const res = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport, seqno: 399 });
    expect(res.seqno).toBe(399);
  });

  it('BURSTSEQ-06: a lost external does NOT wedge the wallet forever — the floor lead is bounded', async () => {
    // COUNTER-CASE, and the reason a naive floor is worse than none. If a broadcast external is lost, the chain never
    // reaches the floor. Without a bound every later message would sign a seqno the wallet will not accept and the
    // wallet would be permanently unusable — a far worse failure than the burst this fixes.
    const source = readFileSync('web/platho-wallet.mjs', 'utf8');
    const fn = source.slice(source.indexOf('function applyWalletSeqnoFloor('), source.indexOf('function noteWalletSeqnoBroadcast('));
    expect(fn).toContain('WALLET_SEQNO_FLOOR_GRACE_MS');
    expect(fn).toContain('> WALLET_SEQNO_FLOOR_GRACE_MS');
    expect(source).toMatch(/const WALLET_SEQNO_FLOOR_GRACE_MS = 90_000;/);

    // …and drive it: with the grace elapsed, the chain wins even though our floor sits higher.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(10);
    await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
    // The floor now stands at 11 while the chain still says 10 (the external was lost).
    const realNow = Date.now;
    try {
      Date.now = () => realNow.call(Date) + 91_000;
      const after = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
      expect(after.seqno, 'past the grace the chain is the authority, or the wallet is wedged forever').toBe(10);
    } finally {
      Date.now = realNow;
    }
  });
});
