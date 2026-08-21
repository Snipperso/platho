import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createPlathoWallet,
  sendPlathoWalletTransaction,
  getPlathoWalletSeqno,
  __resetWalletSeqnoFloorsForTests,
  __resetWalletSendLanesForTests,
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
// THAT CAUSE IS NO LONGER OPEN — FOUND 2026-08-04, against the chain rather than by reasoning. The floor itself was
// half of it. A 200 from toncenter /message means "queued", not "executed", and the floor is raised on that 200, so
// it can lead a chain that never actually consumed the external. Signing that lead is not optimism: a validator that
// sees seqno N+1 before N has executed throws exit code 133 and DROPS the external — TON does not hold it for its
// turn. Chain read at seqno 149 while the client signed 150; twelve rejected broadcasts; one image stuck 6.5 minutes
// until the 90s floor grace expired. The image before it had reported "the shard did not store it" — that was the
// dropped predecessor, the same defect seen from the other end, and it is the "two of eight arrived" shape too.
// The exit code was MEASURED in the sandbox against our own wallet code, not looked up: ahead -> 133, behind -> 133,
// expired -> 136 (tests/platho-wallet.test.ts, PLATHO-WALLET-04J/04K/04L).
// The same throwaway test mnemonic tests/platho-wallet.test.ts uses — never a real wallet.
const MNEMONIC = [
  'hospital', 'stove', 'relief', 'fringe', 'tongue', 'always', 'charge', 'angry',
  'urge', 'sentence', 'again', 'match', 'nerve', 'inquiry', 'senior', 'coconut',
  'label', 'tumble', 'carry', 'category', 'beauty', 'bean', 'road', 'solution',
];

/**
 * A chain that is HONEST but SLOW: a broadcast advances the seqno only after `lagReads` further reads.
 *
 * FIXTURE CORRECTED 2026-08-04. It used to never advance at all unless a test called advance() by hand, and
 * BURSTSEQ-02/03 never called it — so they asserted the client's behaviour against a chain frozen FOREVER. That is
 * not the index lag they meant to model, it is a LOST external, and pinning "sign the next seqno anyway" there
 * pinned the wedge: MEASURED on the owner's mainnet wallet, chain at 149, client signing 150, twelve rejected
 * broadcasts and an image stuck 6.5 minutes. `lagReads` is the honest shape — the chain DOES move, our read is
 * merely behind it (toncenter index lag MEASURED 1-5s).
 */
function frozenChainTransport(startSeqno: number, options: { lagReads?: number } = {}) {
  const calls: any[] = [];
  const sent: any[] = [];
  const lagReads = options.lagReads ?? 0;
  let seqno = startSeqno;
  let pending: number[] = [];
  return {
    calls,
    sent,
    advance: () => { seqno += 1; },
    transport: {
      async runGetMethod(call: any) {
        calls.push(call);
        const current = seqno;
        pending = pending.filter((countdown) => {
          if (countdown <= 1) { seqno += 1; return false; }
          return true;
        }).map((countdown) => countdown - 1);
        return { stack: [{ type: 'num', value: `0x${current.toString(16)}` }] };
      },
      async sendBoc(input: any) {
        sent.push(input);
        if (lagReads > 0) pending.push(lagReads);
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

  it('BURSTSEQ-02: two sends against a LAGGING chain seqno still sign different seqnos', async () => {
    // The exact shape of the owner's burst: our READ has not caught up with the first external when the second is
    // signed. The chain itself has — that is the difference between a lag and a loss.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(7, { lagReads: 1 });

    const opts = { transport: chain.transport, seqnoCatchupMs: 0 };
    const first = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts);
    const second = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts);

    expect(first.seqno).toBe(7);
    expect(second.seqno, 'the second message reused the first seqno — the chain drops it').toBe(8);
    expect(chain.sent).toHaveLength(2);
  });

  it('BURSTSEQ-03: a whole burst of eight gets eight distinct seqnos', async () => {
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(100, { lagReads: 1 });
    const seqnos: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, {
        transport: chain.transport, seqnoCatchupMs: 0,
      });
      seqnos.push(res.seqno);
    }
    expect(seqnos).toEqual([100, 101, 102, 103, 104, 105, 106, 107]);
    expect(new Set(seqnos).size, 'a repeated seqno means a silently dropped message').toBe(8);
  });

  it('BURSTSEQ-08: CONCURRENT sends on one wallet never sign the same seqno — one signer at a time', async () => {
    // RECONSTRUCTED FROM THE CHAIN, 2026-08-21: a recovery backup was writing ~35 slots back to back when the owner
    // sent a message. The backup's next item and the message both read seqno N, both took the floor N+1, both sat in
    // awaitWalletSeqnoConsumed — and ONE chain advance released BOTH. Two externals signed against N+1; the message
    // lost (exit 133), the doors refused every re-offer (406/406/500), and the shard never saw seq 1 of that day.
    //
    // BURSTSEQ-02/03 drive sends ONE AFTER ANOTHER and so never meet this; the floor only protects sequential sends
    // against a lagging read, because it is raised AFTER the broadcast. Overlapping senders need a lane, and the lane
    // must live in the wallet — every external in the app leaves through sendPlathoWalletTransaction.
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(7, { lagReads: 1 });
    const opts = { transport: chain.transport, seqnoCatchupMs: 0 };
    const results = await Promise.all([
      sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts),
      sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts),
      sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts),
    ]);
    const seqnos = results.map((r: any) => r.seqno);
    expect(new Set(seqnos).size, `two concurrent sends signed the same seqno: ${seqnos.join(',')}`).toBe(3);
    expect(seqnos.slice().sort((a: number, b: number) => a - b)).toEqual([7, 8, 9]);
    expect(chain.sent, 'three externals, none dropped').toHaveLength(3);

    // A send that THROWS must not poison the lane: the next sender still goes through.
    const broken = { ...chain.transport, sendBoc: async () => { throw new Error('door slammed'); } };
    await expect(sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { ...opts, transport: broken }))
      .rejects.toThrow(/door slammed/);
    const after = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts);
    expect(after.seqno, 'the lane is free again and the floor was not raised by the failed send').toBe(10);
  });

  it('BURSTSEQ-06: a chain that NEVER advances is a LOST external, and must not be signed past', async () => {
    // The counter-case to 02/03, and the one the old frozen fixture accidentally asserted the wrong way round. When
    // the chain genuinely does not move, the previous external was dropped by the network — toncenter answers 200
    // for "queued", not "executed". Leading it by one then produces exit code 133 on every copy, forever.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(200);   // no lagReads: this chain is stuck, not slow
    const seqnos: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, {
        transport: chain.transport, seqnoCatchupAttempts: 3, seqnoCatchupMs: 0,
      });
      seqnos.push(res.seqno);
    }
    expect(seqnos, 'signing past a stuck chain is the 133 wedge').toEqual([200, 200, 200]);
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

  it('BURSTSEQ-07: the send diagnostic reads a field that actually EXISTS on the returned object', async () => {
    // MEASURED 2026-08-04, from the owner's first filled-in dump: `"send": { "ok": true, ..., "seqno": null }`.
    // The diagnostic read `result.seqno`, but publishConvLaneParts returns `{ parts, result }` and the seqno lives on
    // the INNER object (sendPlathoWalletTransaction spreads the first built external, `{ boc, seqno, wallet }`). So
    // it reported null on every send forever — a diagnostic that always answers "nothing" is worse than none,
    // because it looks like a finding. This pins the READ PATH against the REAL shape rather than against my memory
    // of it: drive the wallet, then assert app.js reads exactly where the value turned out to be.
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(77);
    const res: any = await sendPlathoWalletTransaction(
      wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport },
    );
    expect(res.seqno, 'sendPlathoWalletTransaction stopped exposing seqno at the top level').toBe(77);
    expect(res.batchCount, 'sendPlathoWalletTransaction stopped exposing batchCount').toBe(1);

    // publishConvLaneParts wraps THAT object one level down, and the dump must follow it down.
    const lane = readFileSync('web/conv-lane-send.mjs', 'utf8');
    expect(lane).toContain('return { parts: prepared, result };');
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('seqno: result?.result?.seqno ?? null,');
    expect(app).toContain('externals: result?.result?.batchCount ?? 1,');
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
