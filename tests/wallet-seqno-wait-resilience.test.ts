import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TON_RPC_MAX_QUEUE_WAIT_MS, TON_RPC_REQUEST_TIMEOUT_MS } from '../web/ton-rpc-transport.mjs';
import {
  createPlathoWallet,
  getPlathoWalletSeqno,
  sendPlathoWalletTransaction,
  __resetWalletSeqnoFloorsForTests,
  __resetWalletSendLanesForTests,
} from '../web/platho-wallet.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A FAILED SEQNO READ IS NOT A VERDICT ON THE SEND — and a send that already broadcast must say so.
//
// [audit 2026-08-31, round 8.] The wait between the externals of a multi-part message polled the wallet seqno
// through one BARE await. The re-broadcast a few lines below it is wrapped, with a comment saying "the seqno
// read is the verdict here, not this POST" — while the verdict mechanism itself aborted the entire send on a
// single transient read. That read rides the BACKGROUND priority tier with skipIfRateLimited on, so a 429 park
// DROPS it without a fetch and raises PLATHO_WALLET_SEQNO_UNAVAILABLE: ordinary production conditions.
//
// What it cost. A ~48KB photo is two CONV capsules = two externals. Chunk 0 is signed, broadcast and PAID;
// the wait then threw, and because `builtBoc` was attached ONLY in the catch around sendBoc, the error reached
// the caller with builtBoc undefined. All three consumers read its absence as "we failed before anything left
// the device": CONV shed the pre-broadcast (shard, seq) claim and offered a Retry that REBUILT the message
// with fresh seqs, while the wallet still held chunk 0 in walletPendingExternals and kept re-broadcasting it.
// The parts that landed are published twice and paid for twice, and a send that did happen is reported as
// never sent. On top of that the error was classified NON-transient, so the 8-attempt retry ladder built for
// exactly this class never ran.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

// The same throwaway test mnemonic the wallet suite uses — never a real wallet.
const MNEMONIC = [
  'hospital', 'stove', 'relief', 'fringe', 'tongue', 'always', 'charge', 'angry',
  'urge', 'sentence', 'again', 'match', 'nerve', 'inquiry', 'senior', 'coconut',
  'label', 'tumble', 'carry', 'category', 'beauty', 'bean', 'road', 'solution',
];
const MESSAGE = { address: `0:${'11'.repeat(32)}`, amount: '19100000', payload: null };
// The wait's deadline IS validUntil, so it has to be in the future or every wait ends at attempt 0 as expired —
// which would exercise the wrong branch of both tests below.
const validUntil = () => Math.floor(Date.now() / 1000) + 300;

/**
 * A chain that answers honestly but whose READS fail for a stretch — the 429-park shape. `failFrom`/`failFor`
 * count seqno reads: the send's own read succeeds, the wait's reads are the ones that go dark.
 */
function flakyReadTransport(startSeqno: number, opts: { failFrom: number; failFor: number; advanceOnSend?: boolean }) {
  const sent: any[] = [];
  let seqno = startSeqno;
  let reads = 0;
  return {
    sent,
    reads: () => reads,
    transport: {
      async runGetMethod() {
        reads += 1;
        if (reads > opts.failFrom && reads <= opts.failFrom + opts.failFor) {
          const error: any = new Error('wallet seqno unavailable');
          error.code = 'PLATHO_WALLET_SEQNO_UNAVAILABLE';
          throw error;
        }
        return { stack: [{ type: 'num', value: `0x${seqno.toString(16)}` }] };
      },
      async sendBoc(input: any) {
        sent.push(input);
        if (opts.advanceOnSend !== false) seqno += 1;
        return { ok: true };
      },
    },
  };
}

/** isTonRpcTransientError, lifted out of app.js so the classification is DRIVEN, not read. */
function loadTransientClassifier() {
  const app = readFileSync('web/app.js', 'utf8');
  const start = app.indexOf('function isTonRpcTransientError(');
  expect(start, 'the classifier must still be there').toBeGreaterThan(-1);
  const end = app.indexOf('\n}', start) + 2;
  // eslint-disable-next-line no-new-func
  return new Function(`
    const isTonRpcRateLimitError = (e) => e?.code === 'RATE_LIMITED';
    ${app.slice(start, end)}
    return isTonRpcTransientError;
  `)();
}

describe('WALLETSEQ — the wait survives a dark transport, and never lies about what left the device', () => {
  it('WALLETSEQ-01: a transient read failure mid-wait does not abort a multi-part send', async () => {
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    // Read 1 is the send's own; reads 2 and 3 (the wait's first two polls) go dark; read 4 answers.
    const chain = flakyReadTransport(7, { failFrom: 1, failFor: 2 });
    const result: any = await sendPlathoWalletTransaction(
      wallet,
      { messages: [MESSAGE, MESSAGE], validUntil: validUntil() },
      { transport: chain.transport, maxMessagesPerTransfer: 1, seqnoPollMs: 0, seqnoCatchupMs: 0 },
    );
    // Both externals went out: the dark stretch delayed the wait, it did not end the send.
    expect(chain.sent.length, 'both chunks must reach the network').toBe(2);
    expect(result.batchCount).toBe(2);
    expect(chain.reads(), 'and the failed polls were retried rather than thrown').toBeGreaterThan(3);
  });

  it('WALLETSEQ-02: a wait that gives up still reports that bytes LEFT THE DEVICE', async () => {
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    // The transport goes dark from the wait's first poll and never comes back.
    const chain = flakyReadTransport(7, { failFrom: 1, failFor: 9_999, advanceOnSend: false });
    const error: any = await sendPlathoWalletTransaction(
      wallet,
      { messages: [MESSAGE, MESSAGE], validUntil: validUntil() },
      {
        transport: chain.transport, maxMessagesPerTransfer: 1,
        seqnoPollMs: 0, seqnoCatchupMs: 0, seqnoPollAttempts: 3, rebroadcastIntervalMs: -1,
      },
    ).then(() => null, (e: any) => e);

    expect(error, 'the send must fail — the chunk after this one was never signed').toBeTruthy();
    expect(chain.sent.length, 'chunk 0 was broadcast and paid before the wait began').toBe(1);
    // THE LOAD-BEARING ASSERTION. Absent, every consumer concludes nothing was sent: the CONV catch sheds the
    // (shard, seq) claim and Retry rebuilds with fresh seqs, double-publishing the parts that landed.
    expect(error.builtBoc, 'the signed external must ride out on the error').toBe(chain.sent[0].boc);
    expect(error.builtSeqno, 'bound to the seqno those bytes were signed for').toBe(7);
    // And why we stopped asking, so the caller can tell an RPC blackout from a chain that refused.
    expect(error.seqnoReadFailed, 'the reads are what failed, not the chain').toBe(true);
    expect(error.cause?.code).toBe('PLATHO_WALLET_SEQNO_UNAVAILABLE');
  });

  it('WALLETSEQ-03: both seqno-read failures are classified TRANSIENT, so the retry ladder runs', () => {
    const isTonRpcTransientError: any = loadTransientClassifier();
    expect(isTonRpcTransientError({ code: 'PLATHO_WALLET_SEQNO_UNAVAILABLE' }),
      'an unreadable seqno is the transport failing to answer').toBe(true);
    expect(isTonRpcTransientError({ message: 'Wallet seqno did not reach 8', seqnoReadFailed: true }),
      'a wait that gave up on dark reads is retryable').toBe(true);
    // A chain that answered and simply had not consumed the external is NOT this class: those bytes carry a
    // validity deadline, and the retry path decides re-broadcast vs rebuild on that deadline, not on a ladder.
    expect(isTonRpcTransientError({ message: 'Wallet seqno did not reach 8', walletExternalExpired: true }))
      .toBe(false);
  });
  it('WALLETSEQ-04: the seqno read carries the SEND\u2019s posture, not a background sweep\u2019s', async () => {
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const calls: any[] = [];
    await getPlathoWalletSeqno(wallet, {
      async runGetMethod(call: any) {
        calls.push(call);
        return { stack: [{ type: 'num', value: '0x7' }] };
      },
    } as any);
    expect(calls).toHaveLength(1);
    // MEASURED before this: `seqno` is absent from the transport's per-method priority table, so it resolved to
    // 'background' \u2014 with six background scan reads and one critical read queued it dispatched 8th of 8, while
    // sendBoc itself defaults to 'critical'. On the shared serial pump that is queue-depth x request spacing
    // (1100 ms each without an API key) before a user's send can be signed.
    expect(calls[0].priority, 'the read a send is blocked on rides the send\u2019s tier').toBe('critical');
    // And a 429 park DROPPED it: get-method reads took skipIfRateLimited from a transport-wide switch defaulting
    // to true, so a rate limit turned "wait" into "the send failed".
    expect(calls[0].skipIfRateLimited, 'a signing input may not be dropped by a rate-limit park').toBe(false);
    expect(calls[0].cacheTtlMs, 'and still never from cache').toBe(0);
  });
  it('WALLETSEQ-05: bytes whose validity has EXPIRED do not ride out as still-in-flight', async () => {
    // THE OTHER HALF OF WALLETSEQ-02 [audit 2026-09-01, round 9]. Round 8 taught the chunk wait to attach the
    // signed external so a caller stops reading a mid-send failure as "nothing left the device". It attached
    // unconditionally — including when the wait gave up because the external ran past its validUntil, at which
    // point those bytes can never execute. The CONV retry then re-broadcast a corpse on every attempt for the
    // whole DIRECT_SEND_REBROADCAST_WINDOW_MS (330 s), building nothing, while the message stayed red; the public
    // resume path stored them with validUntil: null and could not learn otherwise. The sendBoc catch has always
    // guarded its own attach (`!definitivelyRejected`) — this is the same guard on the twin.
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = flakyReadTransport(7, { failFrom: 99, failFor: 0, advanceOnSend: false });
    const error: any = await sendPlathoWalletTransaction(
      wallet,
      // A validity window that has already closed: the wait's first check gives up as expired.
      { messages: [MESSAGE, MESSAGE], validUntil: Math.floor(Date.now() / 1000) - 1 },
      { transport: chain.transport, maxMessagesPerTransfer: 1, seqnoPollMs: 0, seqnoCatchupMs: 0, rebroadcastIntervalMs: -1 },
    ).then(() => null, (e: any) => e);

    expect(error, 'the send must fail').toBeTruthy();
    expect(error.walletExternalExpired, 'and fail because the external expired').toBe(true);
    expect(chain.sent.length, 'chunk 0 was still broadcast and paid').toBe(1);
    expect(error.builtBoc, 'expired bytes may not be offered for re-broadcast').toBeUndefined();
    expect(error.builtSeqno).toBeUndefined();
  });

  it('WALLETSEQ-05B: bytes that expired while EVERY seqno read failed do ride out — their outcome was never observed [audit 2026-09-06, round 3]', async () => {
    // The twin of WALLETSEQ-05 with the chain unreadable throughout: the external can no longer execute in the
    // future, but it may have executed in the past, and a caller that reads the missing bytes as "nothing left the
    // device" rebuilds every part with fresh seqs — the parts chunk 0 published are then paid for twice.
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = flakyReadTransport(7, { failFrom: 1, failFor: 999, advanceOnSend: false });
    const error: any = await sendPlathoWalletTransaction(
      wallet,
      { messages: [MESSAGE, MESSAGE], validUntil: Math.floor(Date.now() / 1000) - 1 },
      { transport: chain.transport, maxMessagesPerTransfer: 1, seqnoPollMs: 0, seqnoCatchupMs: 0, rebroadcastIntervalMs: -1 },
    ).then(() => null, (e: any) => e);
    expect(error, 'the send must fail').toBeTruthy();
    expect(error.walletExternalExpired).toBe(true);
    expect(error.seqnoReadFailed, 'and say that the chain was never read').toBe(true);
    expect(chain.sent.length, 'chunk 0 was broadcast and paid').toBe(1);
    expect(typeof error.builtBoc, 'so the bytes ride along as an outcome unknown').toBe('string');
    expect(error.builtSeqno).toBe(7);
  });

  it('WALLETSEQ-06: the send allows for a queue wait as long as one can legitimately be', () => {
    // Round 8 allowed ONE request timeout, reasoning that a 'critical' send is taken next off the queue so only
    // the one request already in flight can precede it. Equal-weight tasks are FIFO by sequence, and a rate-limit
    // park delays every one of them: MEASURED, under a 40 s park the broadcast was rejected QUEUE_TIMEOUT at
    // 15,008 ms where the pre-round-8 posture waited the park out and LANDED. So the allowance must cover what a
    // wait can legitimately be — the ladder's last rung plus one in-flight request — and be DERIVED from those
    // two, not restated as a literal that can drift away from them.
    const transport = readFileSync('web/ton-rpc-transport.mjs', 'utf8');
    const ladder = transport.match(/TONCENTER_RATE_LIMIT_BACKOFF_STEPS_MS = Object\.freeze\(\[([^\]]+)\]\)/)?.[1];
    expect(ladder, 'the backoff ladder must still be there').toBeTruthy();
    const lastRung = Number(String(ladder).split(',').pop()!.replace(/[^0-9]/g, ''));
    expect(TON_RPC_MAX_QUEUE_WAIT_MS, 'the allowance must cover the longest park plus one in-flight request')
      .toBe(lastRung + TON_RPC_REQUEST_TIMEOUT_MS);
    expect(transport, 'and be derived from them, not restated')
      .toContain('TONCENTER_RATE_LIMIT_BACKOFF_MS + TON_RPC_REQUEST_TIMEOUT_MS');
    // Both wallet broadcasts must carry it — the first send and the re-broadcast inside the wait.
    const walletSource = readFileSync('web/platho-wallet.mjs', 'utf8');
    expect(walletSource.split('queueTimeoutMs: TON_RPC_MAX_QUEUE_WAIT_MS').length - 1,
      'the first broadcast and the re-broadcast both need the allowance').toBe(2);
    // The fetch bound is untouched, so a hung door cannot hold longer than it ever could.
    expect(TON_RPC_REQUEST_TIMEOUT_MS).toBe(15_000);
  });
});
