import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createPlathoWallet,
  sendPlathoWalletTransaction,
  getPlathoWalletSeqno,
  __resetWalletSeqnoFloorsForTests,
  __resetWalletSendLanesForTests,
} from '../web/platho-wallet.mjs';
import { testMnemonic } from './helpers/test-mnemonic';

const TEST_WALLET_MNEMONIC = await testMnemonic('wallet-a');

const MNEMONIC = TEST_WALLET_MNEMONIC;

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
    expect(chain.calls[0].cacheTtlMs, 'the seqno read may not be served from cache').toBe(0);
  });

  it('BURSTSEQ-02: two sends against a LAGGING chain seqno still sign different seqnos', async () => {
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

    const broken = { ...chain.transport, sendBoc: async () => { throw new Error('door slammed'); } };
    await expect(sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { ...opts, transport: broken }))
      .rejects.toThrow(/door slammed/);
    const after = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, opts);
    expect(after.seqno, 'the lane is free again and the floor was not raised by the failed send').toBe(10);
  });

  it('BURSTSEQ-06: a chain that NEVER advances is a LOST external, and must not be signed past', async () => {
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(200);
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
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(50);
    const first = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
    expect(first.seqno).toBe(50);
    chain.advance(); chain.advance(); chain.advance();
    const second = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
    expect(second.seqno, 'the floor must not hold below a chain that ran ahead').toBe(53);
  });

  it('BURSTSEQ-05: an explicit seqno passes through untouched — idempotent re-broadcast', async () => {
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(400);
    const res = await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport, seqno: 399 });
    expect(res.seqno).toBe(399);
  });

  it('BURSTSEQ-07: the send diagnostic reads a field that actually EXISTS on the returned object', async () => {
    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(77);
    const res: any = await sendPlathoWalletTransaction(
      wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport },
    );
    expect(res.seqno, 'sendPlathoWalletTransaction stopped exposing seqno at the top level').toBe(77);
    expect(res.batchCount, 'sendPlathoWalletTransaction stopped exposing batchCount').toBe(1);

    const lane = readFileSync('web/conv-lane-send.mjs', 'utf8');
    expect(lane).toContain('return { parts: prepared, deploy, result };');
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('seqno: result?.result?.seqno ?? null,');
    expect(app).toContain('externals: result?.result?.batchCount ?? 1,');
  });

  it('BURSTSEQ-06: a lost external does NOT wedge the wallet forever — the floor lead is bounded', async () => {
    const source = readFileSync('web/platho-wallet.mjs', 'utf8');
    const fn = source.slice(source.indexOf('function applyWalletSeqnoFloor('), source.indexOf('function noteWalletSeqnoBroadcast('));
    expect(fn).toContain('WALLET_SEQNO_FLOOR_GRACE_MS');
    expect(fn).toContain('> WALLET_SEQNO_FLOOR_GRACE_MS');
    expect(source).toMatch(/const WALLET_SEQNO_FLOOR_GRACE_MS = 90_000;/);

    __resetWalletSeqnoFloorsForTests();
    const wallet = await createPlathoWallet({ mnemonic: MNEMONIC });
    const chain = frozenChainTransport(10);
    await sendPlathoWalletTransaction(wallet, { messages: [MESSAGE], validUntil: 1_700_000_300 }, { transport: chain.transport });
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
