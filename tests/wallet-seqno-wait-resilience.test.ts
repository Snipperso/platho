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
import { testMnemonic } from './helpers/test-mnemonic';

const TEST_WALLET_MNEMONIC = await testMnemonic('wallet-a');


const MNEMONIC = TEST_WALLET_MNEMONIC;
const MESSAGE = { address: `0:${'11'.repeat(32)}`, amount: '19100000', payload: null };
const validUntil = () => Math.floor(Date.now() / 1000) + 300;

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
    const chain = flakyReadTransport(7, { failFrom: 1, failFor: 2 });
    const result: any = await sendPlathoWalletTransaction(
      wallet,
      { messages: [MESSAGE, MESSAGE], validUntil: validUntil() },
      { transport: chain.transport, maxMessagesPerTransfer: 1, seqnoPollMs: 0, seqnoCatchupMs: 0 },
    );
    expect(chain.sent.length, 'both chunks must reach the network').toBe(2);
    expect(result.batchCount).toBe(2);
    expect(chain.reads(), 'and the failed polls were retried rather than thrown').toBeGreaterThan(3);
  });

  it('WALLETSEQ-02: a wait that gives up still reports that bytes LEFT THE DEVICE', async () => {
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
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
    expect(error.builtBoc, 'the signed external must ride out on the error').toBe(chain.sent[0].boc);
    expect(error.builtSeqno, 'bound to the seqno those bytes were signed for').toBe(7);
    expect(error.seqnoReadFailed, 'the reads are what failed, not the chain').toBe(true);
    expect(error.cause?.code).toBe('PLATHO_WALLET_SEQNO_UNAVAILABLE');
  });

  it('WALLETSEQ-03: both seqno-read failures are classified TRANSIENT, so the retry ladder runs', () => {
    const isTonRpcTransientError: any = loadTransientClassifier();
    expect(isTonRpcTransientError({ code: 'PLATHO_WALLET_SEQNO_UNAVAILABLE' }),
      'an unreadable seqno is the transport failing to answer').toBe(true);
    expect(isTonRpcTransientError({ message: 'Wallet seqno did not reach 8', seqnoReadFailed: true }),
      'a wait that gave up on dark reads is retryable').toBe(true);
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
    expect(calls[0].priority, 'the read a send is blocked on rides the send\u2019s tier').toBe('critical');
    expect(calls[0].skipIfRateLimited, 'a signing input may not be dropped by a rate-limit park').toBe(false);
    expect(calls[0].cacheTtlMs, 'and still never from cache').toBe(0);
  });
  it('WALLETSEQ-05: bytes whose validity has EXPIRED do not ride out as still-in-flight', async () => {
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = flakyReadTransport(7, { failFrom: 99, failFor: 0, advanceOnSend: false });
    const error: any = await sendPlathoWalletTransaction(
      wallet,
      { messages: [MESSAGE, MESSAGE], validUntil: Math.floor(Date.now() / 1000) - 1 },
      { transport: chain.transport, maxMessagesPerTransfer: 1, seqnoPollMs: 0, seqnoCatchupMs: 0, rebroadcastIntervalMs: -1, deathGraceMs: 0 },
    ).then(() => null, (e: any) => e);

    expect(error, 'the send must fail').toBeTruthy();
    expect(error.walletExternalExpired, 'and fail because the external expired').toBe(true);
    expect(chain.sent.length, 'chunk 0 was still broadcast and paid').toBe(1);
    expect(error.builtBoc, 'expired bytes may not be offered for re-broadcast').toBeUndefined();
    expect(error.builtSeqno).toBeUndefined();
  });

  it('WALLETSEQ-05B: bytes that expired while EVERY seqno read failed do ride out — their outcome was never observed [audit 2026-09-06, round 3]', async () => {
    __resetWalletSeqnoFloorsForTests();
    __resetWalletSendLanesForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = flakyReadTransport(7, { failFrom: 1, failFor: 999, advanceOnSend: false });
    const error: any = await sendPlathoWalletTransaction(
      wallet,
      { messages: [MESSAGE, MESSAGE], validUntil: Math.floor(Date.now() / 1000) - 1 },
      { transport: chain.transport, maxMessagesPerTransfer: 1, seqnoPollMs: 0, seqnoCatchupMs: 0, rebroadcastIntervalMs: -1, deathGraceMs: 0 },
    ).then(() => null, (e: any) => e);
    expect(error, 'the send must fail').toBeTruthy();
    expect(error.walletExternalExpired).toBe(true);
    expect(error.seqnoReadFailed, 'and say that the chain was never read').toBe(true);
    expect(chain.sent.length, 'chunk 0 was broadcast and paid').toBe(1);
    expect(typeof error.builtBoc, 'so the bytes ride along as an outcome unknown').toBe('string');
    expect(error.builtSeqno).toBe(7);
  });

  it('WALLETSEQ-06: the send allows for a queue wait as long as one can legitimately be', () => {
    const transport = readFileSync('web/ton-rpc-transport.mjs', 'utf8');
    const ladder = transport.match(/TONCENTER_RATE_LIMIT_BACKOFF_STEPS_MS = Object\.freeze\(\[([^\]]+)\]\)/)?.[1];
    expect(ladder, 'the backoff ladder must still be there').toBeTruthy();
    const lastRung = Number(String(ladder).split(',').pop()!.replace(/[^0-9]/g, ''));
    expect(TON_RPC_MAX_QUEUE_WAIT_MS, 'the allowance must cover the longest park plus one in-flight request')
      .toBe(lastRung + TON_RPC_REQUEST_TIMEOUT_MS);
    expect(transport, 'and be derived from them, not restated')
      .toContain('TONCENTER_RATE_LIMIT_BACKOFF_MS + TON_RPC_REQUEST_TIMEOUT_MS');
    const walletSource = readFileSync('web/platho-wallet.mjs', 'utf8');
    expect(walletSource.split('queueTimeoutMs: TON_RPC_MAX_QUEUE_WAIT_MS').length - 1,
      'the first broadcast and the re-broadcast both need the allowance').toBe(2);
    expect(TON_RPC_REQUEST_TIMEOUT_MS).toBe(15_000);
  });
});
