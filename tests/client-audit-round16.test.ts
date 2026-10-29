import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import {
  createPlathoWallet, walletExternalSignedFields, awaitWalletExternalOutcome,
  __resetWalletSeqnoFloorsForTests, __resetWalletSendLanesForTests, __resetWalletPendingExternalsForTests,
} from '../web/platho-wallet.mjs';
import { createTonCenterV3Transport } from '../web/ton-rpc-transport.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf('\n', at)); };

function answer(status: number, body: any) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const response: any = {
    status, ok: status >= 200 && status < 300, headers: { get: () => null },
    async json() { return JSON.parse(text); }, async text() { return text; },
  };
  response.clone = () => response;
  return response;
}
const reject133 = () => answer(500, {
  ok: false,
  error: 'LITE_SERVER_UNKNOWN: cannot apply external message to current state : External message was not accepted\n'
    + 'Cannot run message on account: inbound external message rejected by transaction 1234:\nexitcode=133, steps=29, gas_used=0',
  code: 500,
});

function chainWithMempool(startSeqno: number, { runAfterMs = 40 } = {}) {
  const chain: any = { seqno: startSeqno, executed: [] as any[], dropped: [] as any[], posts: [] as any[], mempool: [] as any[] };
  const runSoon = async () => {
    await delay(runAfterMs);
    while (chain.mempool.length) {
      const item = chain.mempool.shift();
      if (item.seqno === chain.seqno) { chain.executed.push(item); chain.seqno += 1; } else chain.dropped.push(item);
    }
  };
  const fetchFor = (window: string) => async (url: string, init: any) => {
    const u = String(url);
    if (u.endsWith('/runGetMethod')) {
      const call = JSON.parse(init.body);
      if (call.method === 'seqno') return answer(200, { ok: true, exit_code: 0, stack: [['num', `0x${chain.seqno.toString(16)}`]] });
      return answer(200, { ok: true, exit_code: 0, stack: [] });
    }
    if (u.endsWith('/message')) {
      const signed = walletExternalSignedFields(JSON.parse(init.body).boc);
      chain.posts.push({ window, seqno: signed?.seqno });
      if (signed?.seqno !== chain.seqno) return reject133();
      if (!chain.mempool.some((item: any) => item.window === window && item.seqno === signed.seqno)) chain.mempool.push({ window, seqno: signed.seqno });
      void runSoon();
      return answer(200, { ok: true });
    }
    return answer(404, 'not found');
  };
  return { chain, fetchFor };
}
const transportFor = (fetch: any, key: string) => createTonCenterV3Transport({
  endpoint: 'https://gate.invalid/api/v3/runGetMethod', sendBocEndpoint: 'https://gate.invalid/api/v3/message',
  fetch, requestSpacingMs: 0, rateLimitKey: key,
});

function sharedLockManager() {
  const queues = new Map<string, Array<{ run: () => void }>>();
  const held = new Set<string>();
  const pending: Array<{ name: string }> = [];
  const grantNext = (name: string) => {
    const queue = queues.get(name) ?? [];
    const next = queue.shift();
    if (next) next.run(); else held.delete(name);
  };
  return {
    async request(name: string, options: any, callback: () => Promise<any>) {
      const signal = options?.signal;
      if (options?.steal) { held.delete(name); }
      return new Promise((resolve, reject) => {
        const entry = { name };
        const run = () => {
          const at = pending.indexOf(entry);
          if (at >= 0) pending.splice(at, 1);
          held.add(name);
          Promise.resolve().then(callback).then(resolve, reject).finally(() => grantNext(name));
        };
        if (!held.has(name)) { run(); return; }
        pending.push(entry);
        const queue = queues.get(name) ?? [];
        queue.push({ run });
        queues.set(name, queue);
        signal?.addEventListener?.('abort', () => {
          const at = queue.findIndex((item) => item.run === run);
          if (at >= 0) queue.splice(at, 1);
          const p = pending.indexOf(entry);
          if (p >= 0) pending.splice(p, 1);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    },
    async query() { return { held: [...held].map((name) => ({ name })), pending: pending.map((item) => ({ name: item.name })) }; },
  };
}

let sharedWallet: any = null;
beforeAll(async () => { sharedWallet = await createPlathoWallet(); }, 120_000);

const windowModules = async () => {
  const A: any = await import('../web/platho-wallet.mjs?window=r16a');
  const B: any = await import('../web/platho-wallet.mjs?window=r16b');
  return { A, B };
};
const resetAll = (...modules: any[]) => {
  for (const m of modules) {
    m.__resetWalletSeqnoFloorsForTests(); m.__resetWalletSendLanesForTests(); m.__resetWalletPendingExternalsForTests();
    m.__setWalletLockManagerForTests?.(undefined);
  }
};
afterEach(async () => {
  __resetWalletSeqnoFloorsForTests(); __resetWalletSendLanesForTests(); __resetWalletPendingExternalsForTests();
  const { A, B } = await windowModules();
  resetAll(A, B);
});

const OWN_VAULT = `0:${'33'.repeat(32)}`;
const RECIPIENT = `0:${'22'.repeat(32)}`;

describe('R16 — two windows of one wallet are one signer [A1 / F3-1]', () => {
  it('R16-SIGNER-01: two windows sending in the same second both land, at consecutive seqnos — none is dropped', async () => {
    const { A, B } = await windowModules();
    const twoWindows = async (locks: any) => {
      resetAll(A, B);
      A.__setWalletLockManagerForTests(locks);
      B.__setWalletLockManagerForTests(locks);
      const { chain, fetchFor } = chainWithMempool(7);
      const options = (window: string) => ({ transport: transportFor(fetchFor(window), `r16-${window}-${Math.random()}`), seqnoCatchupMs: 20, signerIdleHoldMs: 2_000 });
      const sendB = B.sendPlathoWalletTransaction(sharedWallet, { messages: [{ address: OWN_VAULT, amount: '20000000', bounce: true }] }, options('B'));
      const sendA = A.sendPlathoWalletTransaction(sharedWallet, { messages: [{ address: RECIPIENT, amount: '1000000000', bounce: false }] }, options('A'));
      const outcomes = await Promise.all([sendA.then(() => 'sent', (e: any) => e.message), sendB.then(() => 'sent', (e: any) => e.message)]);
      await delay(400);
      return { chain, outcomes };
    };
    const before = await twoWindows(null);
    expect(before.outcomes, 'both are told "sent"').toEqual(['sent', 'sent']);
    expect(before.chain.dropped.length, 'MEASURED before: one of the two was dropped — a Send GRAM "submitted" that never ran').toBe(1);
    const after = await twoWindows(sharedLockManager());
    expect(after.outcomes).toEqual(['sent', 'sent']);
    expect(after.chain.dropped, 'one signer across the windows: nothing dropped').toEqual([]);
    expect(after.chain.executed.map((item: any) => item.seqno)).toEqual([7, 8]);
  });

  it('R16-SIGNER-02: the window that broadcast holds the lock while another waits — re-offering its bytes — and lets go idle', async () => {
    const { A, B } = await windowModules();
    resetAll(A, B);
    const locks = sharedLockManager();
    A.__setWalletLockManagerForTests(locks);
    B.__setWalletLockManagerForTests(locks);
    const { chain, fetchFor } = chainWithMempool(30, { runAfterMs: 20 });
    let swallowed = false;
    const lossyA = async (url: string, init: any) => {
      if (String(url).endsWith('/message') && !swallowed) { swallowed = true; chain.posts.push({ window: 'A', seqno: 30, lost: true }); return answer(200, { ok: true }); }
      return fetchFor('A')(url, init);
    };
    const optionsA = { transport: transportFor(lossyA, `r16-hold-A-${Math.random()}`), seqnoCatchupMs: 20, rebroadcastIntervalMs: 50, signerIdleHoldMs: 5_000 };
    const optionsB = { transport: transportFor(fetchFor('B'), `r16-hold-B-${Math.random()}`), seqnoCatchupMs: 20, signerIdleHoldMs: 200 };
    await A.sendPlathoWalletTransaction(sharedWallet, { messages: [{ address: RECIPIENT, amount: '1000000000', bounce: false }] }, optionsA);
    expect(chain.executed, 'A told "sent" while its external was lost').toEqual([]);
    await B.sendPlathoWalletTransaction(sharedWallet, { messages: [{ address: OWN_VAULT, amount: '20000000', bounce: true }] }, optionsB);
    await delay(300);
    expect(chain.executed.map((item: any) => `${item.window}${item.seqno}`), 'B waited for A\'s re-offered external, then signed the next seqno').toEqual(['A30', 'B31']);
    expect(chain.dropped).toEqual([]);
    const reads = chain.posts.length;
    await delay(400);
    expect(chain.posts.length).toBe(reads);
    expect((await locks.query()).held, 'no lock held once B\'s idle hold ended').toEqual([]);
  });
});

function externalFor(seqno: number, salt: number) {
  const body = tonCell.beginCell().uint(0x7369676en, 32).uint(0n, 32).uint(BigInt(Math.floor(Date.now() / 1000) + 300), 32).uint(BigInt(seqno), 32)
    .uint(BigInt(salt), 32).endCell();
  const root = tonCell.beginCell().uint(2n, 2).ref(body).endCell();
  return { boc: tonCell.bytesToBase64(tonCell.serializeBoc(root)), body: tonCell.bytesToBase64(tonCell.serializeBoc(body)), cell: body };
}

describe('R16 — "consumed" is our external, not the seqno moving [A1 / F3-1]', () => {
  it('R16-OWN-01: the wallet\'s transaction at that seqno tells ours ("consumed"), another\'s ("replaced"), or nothing ("unverified")', async () => {
    const W = { address: `0:${'ab'.repeat(32)}` };
    const ours = externalFor(7, 1);
    const theirs = externalFor(7, 2);
    const hashOf = async (cell: any) => tonCell.bytesToBase64((await tonCell.computeCellHashAndDepth(cell)).hash);
    const transportWith = (inMsgs: any[] | null) => ({
      runGetMethod: async () => ({ stack: [{ type: 'num', value: '0x8' }] }), sendBoc: async () => ({ ok: true }),
      ...(inMsgs ? { getAccountTransactions: async () => ({ transactions: inMsgs }) } : {}),
    });
    const tx = async (external: any, lt: string) => ({ lt, in_msg: { source: null, message_content: { body: external.body, hash: await hashOf(external.cell) } } });
    const validUntil = Math.floor(Date.now() / 1000) + 300;
    expect(await awaitWalletExternalOutcome(W, transportWith([await tx(ours, '100')]), { seqno: 7, validUntil, boc: ours.boc }, { seqnoPollMs: 0 })).toBe('consumed');
    expect(await awaitWalletExternalOutcome(W, transportWith([await tx(theirs, '100')]), { seqno: 7, validUntil, boc: ours.boc }, { seqnoPollMs: 0 }),
      'MEASURED before: "consumed" — a dropped deploy trusted, two minutes of messages into an absent vault').toBe('replaced');
    expect(await awaitWalletExternalOutcome(W, transportWith(null), { seqno: 7, validUntil, boc: ours.boc }, { seqnoPollMs: 0 }), 'no reader').toBe('unverified');
    expect(await awaitWalletExternalOutcome(W, transportWith([await tx(ours, '100')]), { seqno: 7, validUntil }, { seqnoPollMs: 0 }), 'no bytes to compare').toBe('unverified');
  }, 30_000);

  it('R16-OWN-03: the transports read an account\'s transactions — never from a cache, at the money tier — through the fallback too', async () => {
    const { createFallbackTonRpcTransport } = await import('../web/ton-rpc-transport.mjs');
    const asked: string[] = [];
    const v3 = createTonCenterV3Transport({
      endpoint: 'https://gate.invalid/api/v3/runGetMethod', sendBocEndpoint: 'https://gate.invalid/api/v3/message', requestSpacingMs: 0,
      rateLimitKey: `r16-tx-${Math.random()}`,
      fetch: async (url: string) => { asked.push(String(url)); return answer(200, { transactions: [{ lt: '5' }] }); },
    });
    const fallback = createFallbackTonRpcTransport({ transports: [v3] });
    const first = await fallback.getAccountTransactions({ account: '0:ab', limit: 16, sort: 'desc' });
    const second = await fallback.getAccountTransactions({ account: '0:ab', limit: 16, sort: 'desc' });
    expect([first.transactions[0].lt, second.transactions[0].lt]).toEqual(['5', '5']);
    expect(asked.length, 'asked twice: nothing cached').toBe(2);
    expect(asked[0]).toMatch(/^https:\/\/gate\.invalid\/api\/v3\/transactions\?/);
    expect(asked[0]).toContain('account=0%3Aab');
  });

  it('R16-OWN-02: the settle trusts only our deploy — another external there deploys again, an answer that cannot tell asks the vault', async () => {
    const run = async (outcome: string, readAnswers: 'absent' | 'live') => {
      const box: any = { s: { wallet: 'W', address: 'V', snapshot: { state: 'live', assumed: true, assumedAt: Date.now(), assumedFrom: { seqno: 9, validUntil: Math.floor(Date.now() / 1000) + 200, boc: 'x' } } } };
      const reads: string[] = [];
      const settle = lift({
        box, plathoWallet: { address: 'W' }, globalThis: {}, walletChainNowMs: () => Date.now(),
        awaitWalletExternalOutcome: async () => outcome,
        convVaultStateUnknownError: () => Object.assign(new Error('vault state unknown'), { code: 'VAULT_UNKNOWN' }),
        vaultSnapshot: () => ({ state: 'absent' }), VAULT_DEPLOY_SETTLE_MS: 120_000,
        vaultClock: () => ({ nowSec: Math.floor(Date.now() / 1000) }),
        boundedFeeVaultRoutingRead: async () => { reads.push('read'); box.s = { ...box.s, snapshot: { state: readAnswers } }; },
      }, [fn('async function settleUnconfirmedVaultDeploy(wallet) {').replaceAll('feeVaultState', 'box.s')],
      'settleUnconfirmedVaultDeploy', 'let unconfirmedVaultDeploy = null;');
      await settle('W');
      return { state: box.s.snapshot.state, assumed: box.s.snapshot.assumed === true, reads };
    };
    expect(await run('consumed', 'absent'), 'ours ran: trusted for its window, no read').toEqual({ state: 'live', assumed: true, reads: [] });
    expect((await run('replaced', 'live')).state, 'another external took its seqno: the deploy is dead, the vault absent').toBe('absent');
    expect(await run('unverified', 'absent'), 'cannot tell: the vault itself is asked').toEqual({ state: 'absent', assumed: false, reads: ['read'] });
    expect(await run('unverified', 'live'), 'cannot tell, and the vault answers').toEqual({ state: 'live', assumed: false, reads: ['read'] });
    expect(code(fn('function noteFeeVaultDeployed('))).toContain('boc: unconfirmed.boc ?? null');
    expect(code(fn('function lockPlathoWallet('))).toContain('assumedFrom: { ...feeVaultState.snapshot.assumedFrom, boc: null }');
  });
});

function scriptedChain(startSeqno: number, script: (chain: any, signed: any, boc: string) => any) {
  const chain: any = { seqno: startSeqno, executed: [] as number[], posts: [] as any[] };
  const fetch = async (url: string, init: any) => {
    const u = String(url);
    if (u.endsWith('/runGetMethod')) {
      const call = JSON.parse(init.body);
      if (call.method === 'seqno') return answer(200, { ok: true, exit_code: 0, stack: [['num', `0x${chain.seqno.toString(16)}`]] });
      return answer(200, { ok: true, exit_code: 0, stack: [] });
    }
    if (u.endsWith('/message')) {
      const boc = JSON.parse(init.body).boc;
      const signed = walletExternalSignedFields(boc);
      chain.posts.push({ seqno: signed?.seqno, boc });
      if (signed?.seqno !== chain.seqno) return reject133();
      return script(chain, signed, boc);
    }
    return answer(404, 'not found');
  };
  return { chain, fetch };
}
const runIt = (chain: any, signed: any) => { chain.executed.push(signed.seqno); chain.seqno += 1; return answer(200, { ok: true }); };
const PART = { address: RECIPIENT, amount: '19100000', bounce: true, payload: null };

describe('R16 — a transfer of several externals is finished, not abandoned [A2 / F1-2, F3-3]', () => {
  it('R16-PARTIAL-01: an external whose POST came back ambiguous is waited out — taken, the transfer goes on to its end', async () => {
    const { sendPlathoWalletTransaction } = await import('../web/platho-wallet.mjs');
    let gatewayLied = false;
    const { chain, fetch } = scriptedChain(7, (c, signed) => {
      if (signed.seqno === 8 && !gatewayLied) { gatewayLied = true; runIt(c, signed); return answer(502, 'Bad Gateway'); }
      return runIt(c, signed);
    });
    const result: any = await sendPlathoWalletTransaction(sharedWallet, { messages: [PART, PART, PART] }, {
      transport: transportFor(fetch, `r16-amb-${Math.random()}`), maxMessagesPerTransfer: 1, seqnoPollMs: 10, seqnoCatchupMs: 10, rebroadcastIntervalMs: 10,
    }).then((r: any) => r, (e: any) => e);
    expect(result instanceof Error, 'MEASURED before: thrown with the second external\'s bytes, the third never signed').toBe(false);
    expect(chain.executed, 'every part ran, each once').toEqual([7, 8, 9]);
    expect(result.batchCount).toBe(3);
  });

  it('R16-PARTIAL-02: an external the chain dropped is signed again once it is dead — at the seqno the chain waits for — and the rest follows', async () => {
    const { sendPlathoWalletTransaction } = await import('../web/platho-wallet.mjs');
    let dropped: string | null = null;
    const { chain, fetch } = scriptedChain(7, (c, signed, boc) => {
      if (signed.seqno === 8 && (dropped === null || dropped === boc)) { dropped = boc; return answer(200, { ok: true }); }
      return runIt(c, signed);
    });
    const result: any = await sendPlathoWalletTransaction(sharedWallet, { messages: [PART, PART, PART] }, {
      transport: transportFor(fetch, `r16-drop-${Math.random()}`), maxMessagesPerTransfer: 1, seqnoPollMs: 20, seqnoCatchupMs: 20,
      rebroadcastIntervalMs: 200, externalValiditySeconds: 2, deathGraceMs: 0,
    }).then((r: any) => r, (e: any) => e);
    expect(result instanceof Error, 'MEASURED before: thrown when the dropped copy died, the third part never signed').toBe(false);
    expect(chain.executed).toEqual([7, 8, 9]);
    const resigned = chain.posts.filter((post: any) => post.seqno === 8 && post.boc !== dropped);
    expect(resigned.length, 'the dead copy was replaced by a new signature').toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('R16-PARTIAL-03: a tail refused for good says what never left — the messages, for the caller to send and nothing more', async () => {
    const { sendPlathoWalletTransaction } = await import('../web/platho-wallet.mjs');
    const tooManyNow = () => { const response = answer(429, { ok: false, error: 'Ratelimit exceed', code: 429 }); response.headers = { get: (name: string) => (String(name).toLowerCase() === 'retry-after' ? '0' : null) }; return response; };
    const { chain, fetch } = scriptedChain(7, (c, signed) => (c.executed.length === 0 ? runIt(c, signed) : tooManyNow()));
    const tail = { ...PART, amount: '23400000' };
    const error: any = await sendPlathoWalletTransaction(sharedWallet, { messages: [PART, tail] }, {
      transport: transportFor(fetch, `r16-tail-${Math.random()}`), maxMessagesPerTransfer: 1, seqnoPollMs: 10, seqnoCatchupMs: 10, tailRetryDelaysMs: [0, 0],
    }).then(() => null, (e: any) => e);
    expect(chain.executed).toEqual([7]);
    expect(error?.partialSend?.uncertainMessages, 'nothing of the tail may land').toBeNull();
    expect(error.partialSend.unsentMessages.map((m: any) => m.amount), 'exactly the refused part').toEqual(['23400000']);
  });
});

describe('R16 — what never left is sent, and only that [A2 / F1-2, F3-3]', () => {
  const wallet16 = async () => import('../web/platho-wallet.mjs');
  const recordOf = async (amount: string, payload: string | null = null) => (await wallet16()).walletMessageToRecord({ address: RECIPIENT, amount: BigInt(amount), bounce: true, payload, stateInit: null });

  it('R16-PARTIAL-04: a wallet message survives being kept on a record — the same internal message comes back', async () => {
    const { walletMessageToRecord, walletMessageFromRecord, storeInternalMessage } = await wallet16();
    const init = tonCell.beginCell().uint(5n, 8).ref(tonCell.beginCell().uint(9n, 16).endCell()).endCell();
    const body = tonCell.bytesToBase64(tonCell.serializeBoc(tonCell.beginCell().uint(0xabcdn, 16).endCell()));
    const original = { address: OWN_VAULT, amount: 73142478n, bounce: true, payload: body, stateInit: init };
    const kept = JSON.parse(JSON.stringify(walletMessageToRecord(original)));
    const hash = async (message: any) => tonCell.bytesToBase64((await tonCell.computeCellHashAndDepth(storeInternalMessage(message))).hash);
    expect(await hash(walletMessageFromRecord(kept))).toBe(await hash(original));
    expect(kept.amount).toBe('73142478');
  });

  it('R16-RESUME-01: a private message whose tail never left sends that tail — the uncertain external settles first', async () => {
    const { walletMessageToRecord, walletMessageFromRecord } = await wallet16();
    const run = async (tail: any, { consumed = false, alive = true, fails = null as any, switchTo = null as any } = {}) => {
      const sent: any[] = [];
      const rebroadcasts: string[] = [];
      const marks: string[] = [];
      const asked: bigint[] = [];
      const env: any = {
        walletMessageToRecord, walletMessageFromRecord, walletChainNowMs: () => Date.now(),
        walletChainClockKnown: true, walletClockInDoubt: () => false, walletChainClockOffsetMs: () => 0,
        walletSendFeeReserveNanotons: (classes: number[]) => 1_000n * BigInt(classes.length),
        assertWalletGramAtLeast: async (need: bigint) => { asked.push(need); },
        walletChangedBeforeSigningError: () => Object.assign(new Error('changed'), { code: 'PLATHO_WALLET_CHANGED' }),
        walletExternalOutcomeNow: async () => { if (switchTo) env.unlock(switchTo); return consumed ? 'consumed' : alive ? 'pending' : 'expired'; },
        rebroadcastSignedExternal: async (boc: string) => { rebroadcasts.push(boc); return { verdict: 'accepted' }; },
        sendPlathoWalletTransaction: async (_w: any, { messages }: any, options: any) => {
          sent.push({ amounts: messages.map((m: any) => String(m.amount)), required: options.requiredBalance });
          if (fails) throw fails;
          return { pendingBoc: 'TAILBOC', pendingSeqno: 12, pendingValidUntil: 999 };
        },
        markDirectSendBroadcast: () => marks.push('broadcast'), armConvDeliveryConfirm: () => marks.push('confirm'),
        sameWalletAddress: (a: any, b: any) => a === b,
      };
      env.broadcastMayHaveLanded = lift({}, [fn('function broadcastMayHaveLanded(error) {')], 'broadcastMayHaveLanded');
      env.chainNowSec = () => Math.floor(Date.now() / 1000);
      const api = lift(env, [fn('function requireSameWallet('), fn('function walletOfSend('), fn('function noOtherWalletThan('), fn('function convLaterSendOnShard('), fn('function partialTailOf(error, name = null) {'), fn('function convTailNameOf(record) {'),
        line('const CONV_TAIL_INCLUSION_MARGIN_SEC = '), fn('function convTailWithinShardDay(captured, nowSec) {'), fn('function convTailPendingError(text) {'),
        fn('function walletRecordSizeClass(record) {'), fn('async function resumeConvPartialTail(')],
        '{ resume: resumeConvPartialTail, unlock: (w) => { plathoWallet = w; } }', "let plathoWallet = { address: 'W' };");
      env.unlock = api.unlock;
      const message: any = { convDirectSend: { address: 'S', commits: ['ab'], epoch: Math.floor(Date.now() / 86_400_000), boc: 'FIRSTBOC', seqno: 7, validUntil: Math.floor(Date.now() / 1000) + (alive ? 200 : -10), at: 1, partialTail: tail } };
      const outcome = await api.resume({ thread: {}, message }, message.convDirectSend, {}).then((r: any) => r, (e: any) => e);
      return { outcome, sent, rebroadcasts, marks, asked, send: message.convDirectSend };
    };
    const A = await recordOf('11100000');
    const B = await recordOf('23400000');
    const tailOnly = await run({ messages: [B], uncertainMessages: null });
    expect(tailOnly.sent, 'MEASURED before: nothing — the confirm said "not delivered — resend", and the resend paid both parts').toEqual([{ amounts: ['23400000'], required: 23_401_000n }]);
    expect([tailOnly.send.partialTail, tailOnly.send.boc, tailOnly.marks]).toEqual([null, 'TAILBOC', ['broadcast', 'confirm']]);
    expect(tailOnly.asked, 'the balance is asked for what the rest costs, before it is signed').toEqual([23_401_000n]);
    const switched = await run({ messages: [B], uncertainMessages: [A] }, { consumed: true, switchTo: { address: 'X' } });
    expect([switched.outcome?.code, switched.sent, switched.send.partialTail?.messages?.length], 'MEASURED before: signed by whichever wallet was unlocked')
      .toEqual(['PLATHO_WALLET_CHANGED', [], 1]);
    const waiting = await run({ messages: [B], uncertainMessages: [A] }, { alive: true });
    expect([waiting.outcome?.code, waiting.sent, waiting.rebroadcasts], 'its fate unknown and alive: re-offered, the rest waits').toEqual(['CONV_PARTIAL_TAIL_PENDING', [], ['FIRSTBOC']]);
    expect((await run({ messages: [B], uncertainMessages: [A] }, { alive: false })).sent[0].amounts, 'dead: it goes with the rest').toEqual(['11100000', '23400000']);
    expect((await run({ messages: [B], uncertainMessages: [A] }, { consumed: true })).sent[0].amounts, 'taken: only the rest').toEqual(['23400000']);
    const again = Object.assign(new Error('refused again'), { builtBoc: 'X', builtSeqno: 12, partialSend: { sentChunks: 0, chunks: 2, unsentMessages: [walletMessageFromRecord(B)], uncertainMessages: [walletMessageFromRecord(A)] } });
    const twice = await run({ messages: [A, B], uncertainMessages: null }, { fails: again });
    expect([twice.outcome, twice.send.partialTail.messages.map((m: any) => m.amount), twice.send.partialTail.uncertainMessages.map((m: any) => m.amount)], 'what is still owed stays on the record')
      .toEqual([again, ['23400000'], ['11100000']]);
  });

  it('R16-RESUME-02: the confirm waits for the tail, a reload does not arm one over it, and a give-up says part of it went', async () => {
    expect(code(fn('async function runConvDeliveryConfirm('))).toContain('if (send.partialTail) return;');
    expect(code(fn('function rearmConvDeliveryConfirm(thread, message) {'))).toContain('if (send.partialTail) return;');
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain('if (captured?.partialTail) return resumeConvPartialTail(context, captured, transport, signer?.address ?? null);');
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).not.toContain('releaseRestLane');
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain('if (message.convDirectSend) message.convDirectSend.partialTail = partialTailOf(error, (item) => convTailMark(item, error.preparedParts, parts));');
    expect(code(fn('function stopPrivateSendRetry('))).toContain("message.meta = message.convDirectSend?.partialTail ? 'partly sent: retry sends the rest' : privateSendRetryExhaustedStatusText(error);");
    const metaKey = lift({}, [fn('function messageMetaTextKey(raw) {')], 'messageMetaTextKey');
    expect(metaKey('partly sent: retry sends the rest')).toBe('messageMeta.partlySent');
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
    for (const [locale, strings] of Object.entries(I18N_STRINGS as any)) expect(typeof (strings as any)['messageMeta.partlySent'], locale).toBe('string');
    const recoverable = lift({ isTonRpcTransientError: () => false, isFatalPrivateSendError: () => false }, [fn('function isRecoverablePrivateSendError(error) {')], 'isRecoverablePrivateSendError');
    expect(recoverable({ code: 'CONV_PARTIAL_TAIL_PENDING' })).toBe(true);
  });

  it('R16-RESUME-03: a public post whose tail never left sends the tail — not the post again — and is failed only an hour on', async () => {
    const { walletMessageToRecord, walletMessageFromRecord } = await wallet16();
    const run = async (retained: any, { consumed = false } = {}) => {
      const patches: any[] = [];
      const sent: any[] = [];
      const rebroadcasts: string[] = [];
      const env: any = {
        walletMessageToRecord, walletMessageFromRecord, plathoWallet: { address: 'W' }, walletChainNowMs: () => Date.now(), globalThis: {},
        PUBLIC_REBROADCAST_MIN_INTERVAL_MS: 20_000, walletSendFeeReserveNanotons: () => 0n, noteTonRpcRateLimit: () => false, console,
        assertWalletGramAtLeast: async () => {}, requireSameWallet: (signer: any) => signer,
        persistPublicPublishProgress: (_job: any, patch: any) => patches.push(patch),
        walletExternalOutcomeNow: async (_w: any, _t: any, send: any) => (consumed ? 'consumed' : Number(send?.validUntil) * 1000 > Date.now() ? 'pending' : 'expired'),
        nobleSha256: (bytes: Uint8Array) => bytes.slice(0, 32), TextEncoder,
        rebroadcastSignedExternal: async (boc: string) => { rebroadcasts.push(boc); return { verdict: 'accepted' }; },
        sendPlathoWalletTransaction: async (_w: any, { messages }: any) => { sent.push(messages.map((m: any) => String(m.amount))); return { pendingBoc: 'TAIL', pendingSeqno: 5, pendingValidUntil: 9 }; },
        publicRetainedExternalFromSend: (result: any) => ({ boc: result.result.pendingBoc, seqno: result.result.pendingSeqno, validUntil: result.result.pendingValidUntil, at: 1, rebroadcastAt: null }),
      };
      env.broadcastMayHaveLanded = lift({}, [fn('function broadcastMayHaveLanded(error) {')], 'broadcastMayHaveLanded');
      const resume = lift(env, [line('const PUBLIC_PARTIAL_TAIL_MAX_AGE_MS = '), line('const publicPartialTailsInFlight = new Set();'),
        fn('async function withPublicTailClaim(job, retained, task) {'),
        fn('function partialTailOf(error, name = null) {'), fn('function walletRecordSizeClass(record) {'), fn('async function resumePublicPartialTail(')], 'resumePublicPartialTail');
      await resume({ channelId: 'c', localId: 'p', publishState: null }, retained, 'public publish failed');
      return { patches, sent, rebroadcasts };
    };
    const B = await recordOf('5100000');
    const fresh = await run({ boc: 'FIRST', seqno: 3, validUntil: Math.floor(Date.now() / 1000) + 200, at: Date.now(), partialTail: { messages: [B], uncertainMessages: null } });
    expect(fresh.sent, 'MEASURED before: the record failed on the consumed seqno, a re-post paid every part').toEqual([['5100000']]);
    expect(fresh.patches.at(-1).publicDirectSend).toMatchObject({ boc: 'TAIL', seqno: 5 });
    const old = await run({ boc: 'FIRST', seqno: 3, at: Date.now() - 2 * 60 * 60 * 1000, partialTail: { messages: [B], uncertainMessages: null } });
    expect([old.sent, old.patches[0].publishStatus], 'an hour without the rest: failed').toEqual([[], 'public publish failed']);
    const pending = await run({ boc: 'MAYBE', seqno: 3, validUntil: Math.floor(Date.now() / 1000) + 200, at: Date.now(), partialTail: { messages: [B], uncertainMessages: [B] } });
    expect([pending.sent, pending.rebroadcasts]).toEqual([[], ['MAYBE']]);
    expect(code(fn('function resumePendingPublicPublishConfirmations() {'))).toContain('if (retained?.partialTail) {');
    expect(code(fn('function publicAmbiguousPublishPatch(error, status) {'))).toContain('partialTail: partialTailOf(error),');
  });

  it('R16-RESUME-04: a room\'s transfer the chain took part of is finished at once — an uncertain one, or a refused finish, stays the first error', async () => {
    const { walletMessageToRecord, walletMessageFromRecord } = await wallet16();
    const run = async (error: any, { finishFails = false } = {}) => {
      const sent: any[] = [];
      const W = { address: 'W' };
      const finish = lift({
        walletMessageToRecord, walletMessageFromRecord, plathoWallet: W, globalThis: {}, walletSendFeeReserveNanotons: () => 0n, noteTonRpcRateLimit: () => false, console,
        assertWalletGramAtLeast: async () => {}, requireSameWallet: (signer: any) => signer,
        sendPlathoWalletTransaction: async (_w: any, { messages }: any) => { sent.push(messages.map((m: any) => String(m.amount))); if (finishFails) throw new Error('refused'); return { pendingSeqno: 4 }; },
        awaitWalletExternalOutcome: async () => { throw new Error('the chain could not be watched until the deadline'); },
      }, [fn('function walletRecordSizeClass(record) {'), fn('async function finishGroupPartialSend(wallet, error) {')], 'finishGroupPartialSend');
      return { outcome: await finish(W, error).then((r: any) => r, (e: any) => e), sent };
    };
    const msg = (amount: string) => ({ address: RECIPIENT, amount: BigInt(amount), bounce: true, payload: null, stateInit: null });
    const definitive = Object.assign(new Error('tail refused'), { builtBoc: 'B', partialSend: { sentChunks: 1, chunks: 2, unsentMessages: [msg('7000000')], uncertainMessages: null } });
    const done = await run(definitive);
    expect([done.sent, done.outcome.resumedAfterPartial], 'MEASURED before: read as landed, the fold took it back, a redo paid every capsule').toEqual([[['7000000']], true]);
    const uncertain = Object.assign(new Error('unknown'), { builtBoc: 'B', partialSend: { sentChunks: 1, chunks: 3, unsentMessages: [msg('7000000')], uncertainMessages: [msg('1')] } });
    expect((await run(uncertain)).outcome).toBe(uncertain);
    const refused = await run(definitive, { finishFails: true });
    expect(refused.outcome).toBe(definitive);
    expect(code(app)).toContain('.catch((error) => finishGroupPartialSend(wallet, error));');
    const unconfirmed = lift({ walletExternalSignedFields }, [fn('function unconfirmedExternalOf(source) {')], 'unconfirmedExternalOf');
    expect(unconfirmed({ resumedAfterPartial: true, pendingSeqno: 4, batchCount: 1 }), 'the deploy rode the first external, which ran').toBeNull();
    expect(unconfirmed({ partialSend: { sentChunks: 0 }, builtSeqno: 6, builtValidUntil: 9, builtBoc: 'Q' }), 'the first external\'s fate unknown: asked about').toEqual({ seqno: 6, validUntil: 9, boc: 'Q' });
  });
});

describe('R16 — two windows of one wallet keep each other\'s follows [A3 / F1-1]', () => {
  const SUBS = 'public:platho.publicSubscriptions.v1';
  const CURSORS = 'public:platho.publicReadCursors.v1';
  const windowOver = (data: Map<string, string>, pings: string[]) => {
    const W = { address: 'W' };
    const store = { type: 'sealed-indexeddb', get: async (record: string) => (data.has(record) ? { url: data.get(record) } : null), put: async (record: string, text: string) => { data.set(record, text); } };
    const state: any = { refreshed: 0 };
    const api = lift({
      plathoWallet: W, plathoLocalDataClearing: false, deviceCacheStore: async () => store, console, globalThis: {},
      setTimeout: (callback: () => void) => { callback(); return 1; }, clearTimeout: () => {}, WALLET_LOCAL_WRITE_DELAY_MS: 0,
      WALLET_LOCAL_RECORD: 'local', PUBLIC_CHANNEL_FEED_CACHE_KEY: 'platho.publicChannelFeeds.v1', PUBLIC_CHANNEL_PROFILE_CACHE_KEY: 'platho.publicChannelProfiles.v1',
      localStorageOrNull: () => ({ setItem: (key: string) => pings.push(key), removeItem: () => {} }), bytesToHex: () => 'ab', randomBytes: () => new Uint8Array(8),
      refreshPersonalPublicFromMap: () => { state.refreshed += 1; }, plainWalletLocalRecords: () => [],
      noteLegacyStorageMoved: () => {}, markStorageResecureDue: () => {}, WALLET_LOCAL_PUBLIC_ROOMS_KEY: 'publicRoomIds',
      scopedStorageKey: (key: string) => key, EXTERNAL_LINK_TRUSTED_DOMAINS_KEY: 'links', SELF_SLOT_MARKERS_KEY: 'slots',
    }, [line('const PERSONAL_PUBLIC_SEALED_PREFIX = '), line('const WALLET_LOCAL_CONTENT_RECORD = '), fn('function walletLocalRecordOf(key) {'),
      fn('function walletLocalStorage() {'), line('const WALLET_LOCAL_TOMBSTONE_KEEP_MS = '), line('const WALLET_LOCAL_CHANGED_PING_KEY = '), line('let walletLocalLastStamp = 0;'),
      fn('function stampWalletLocalKey(key) {'), fn('function walletLocalRecordEntries(record) {'), fn('function parseWalletLocalEntries(text) {'),
      fn('function foldWalletLocalEntries(stored, ours) {'), fn('function adoptNewerWalletLocalEntries(stored) {'), fn('async function withWalletLocalWriteLock(task) {'),
      fn('function pingWalletLocalWindows() {'), fn('async function writeWalletLocalRecords(store, wallet, records) {'), line('let walletLocalRefreshInFlight = null;'),
      fn('function refreshWalletLocalFromStore() {'), fn('async function readWalletLocalFromStore() {'), fn('function noteWalletLocalAdopted(keys) {'),
      fn('function noteWalletLocalChanged(key) {'), fn('function persistWalletLocalSoon(delayMs = WALLET_LOCAL_WRITE_DELAY_MS) {'),
      fn('function mergeWalletLocalValue(kind, stored, written) {'), fn('function walletLocalMergeKind(key) {'), fn('async function loadWalletLocal(wallet) {')],
    '{ storage: walletLocalStorage(), load: () => loadWalletLocal(plathoWallet), refresh: refreshWalletLocalFromStore, walletLocal }',
    'const walletLocal = { wallet: null, values: new Map(), stamps: new Map(), touched: new Set(), timer: null, dirty: new Set() }; let publicRoomIdsKnown = null;');
    return { ...api, state };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
  const storedValue = (data: Map<string, string>, key: string) => {
    const entry = JSON.parse(data.get('local') ?? '[]').find((item: any) => item[0] === key);
    return entry ? entry[1] : undefined;
  };

  it('R16-WINDOWS-01: a follow made in one window survives the other window\'s next write, a removal is not brought back, and the other window learns', async () => {
    const data = new Map<string, string>([['local', JSON.stringify([[SUBS, '{"channels":[]}']])]]);
    const pings: string[] = [];
    const a = windowOver(data, pings);
    const b = windowOver(data, pings);
    await a.load();
    await b.load();
    a.storage.setItem(SUBS, '{"channels":["X"]}');
    await settle();
    expect(storedValue(data, SUBS)).toBe('{"channels":["X"]}');
    expect(pings.length, 'the other windows are told').toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 2));
    b.storage.setItem(CURSORS, '{"post":1}');
    await settle();
    expect(storedValue(data, SUBS), 'MEASURED before: {"channels":[]} — B wrote its whole record over A\'s follow').toBe('{"channels":["X"]}');
    expect(storedValue(data, CURSORS)).toBe('{"post":1}');
    expect([b.walletLocal.values.get(SUBS), b.state.refreshed], 'B took A\'s follow, and its screen followed').toEqual(['{"channels":["X"]}', 1]);
    await new Promise((resolve) => setTimeout(resolve, 2));
    a.storage.removeItem(SUBS);
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 2));
    b.storage.setItem(CURSORS, '{"post":2}');
    await settle();
    expect(storedValue(data, SUBS), 'a removal stays removed: B\'s older copy does not bring it back').toBeNull();
    expect(b.walletLocal.values.has(SUBS)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 2));
    a.storage.setItem(SUBS, '{"channels":["Y"]}');
    await settle();
    await b.refresh();
    expect(b.walletLocal.values.get(SUBS)).toBe('{"channels":["Y"]}');
    expect(code(app)).toContain("if (event?.key === WALLET_LOCAL_CHANGED_PING_KEY) void refreshWalletLocalFromStore()");
  });

  it('R16-WINDOWS-02: the lock and a page going away write what they owe folded — the later change standing', async () => {
    const stored = [[SUBS, '{"channels":["X"]}', 200], [CURSORS, '{"post":1}', 50]];
    const fold = lift({}, [fn('function parseWalletLocalEntries(text) {'), fn('function foldWalletLocalEntries(stored, ours) {')], '{ parseWalletLocalEntries, foldWalletLocalEntries }');
    const folded = fold.foldWalletLocalEntries(fold.parseWalletLocalEntries(JSON.stringify(stored)), [[SUBS, '{"channels":[]}', 100], [CURSORS, '{"post":9}', 90]]);
    expect(Object.fromEntries(folded.map((entry: any) => [entry[0], entry[1]])), 'MEASURED before: the owed copy written over a newer follow').toEqual({ [SUBS]: '{"channels":["X"]}', [CURSORS]: '{"post":9}' });
    const data = new Map<string, string>([['local', JSON.stringify(stored)]]);
    const owe = lift({ globalThis: {}, localStorageOrNull: () => null, bytesToHex: () => 'ab', randomBytes: () => new Uint8Array(8) },
      [line('const WALLET_LOCAL_CHANGED_PING_KEY = '), fn('function parseWalletLocalEntries(text) {'), fn('function foldWalletLocalEntries(stored, ours) {'),
        fn('async function withWalletLocalWriteLock(task) {'), fn('function pingWalletLocalWindows() {'), fn('async function writeOwedWalletLocal(store, records) {')], 'writeOwedWalletLocal');
    await owe({ get: async (record: string) => ({ url: data.get(record) }), put: async (record: string, text: string) => { data.set(record, text); } },
      [['local', [[SUBS, '{"channels":[]}', 100], [CURSORS, '{"post":9}', 90]]]]);
    expect(Object.fromEntries(JSON.parse(data.get('local')!).map((entry: any) => [entry[0], entry[1]]))).toEqual({ [SUBS]: '{"channels":["X"]}', [CURSORS]: '{"post":9}' });
    const switched = new Map<string, string>([['local', JSON.stringify(stored)]]);
    const walletLocalState: any = { wallet: { address: 'B' }, values: new Map([['k', 'v']]), stamps: new Map([['k', 999]]) };
    const write = lift({ walletLocal: walletLocalState, globalThis: {}, localStorageOrNull: () => null, bytesToHex: () => 'ab', randomBytes: () => new Uint8Array(8),
      WALLET_LOCAL_RECORD: 'local', PUBLIC_CHANNEL_FEED_CACHE_KEY: 'f', PUBLIC_CHANNEL_PROFILE_CACHE_KEY: 'p' },
    [line('const PERSONAL_PUBLIC_SEALED_PREFIX = '), line('const WALLET_LOCAL_CONTENT_RECORD = '), fn('function walletLocalRecordOf(key) {'),
      line('const WALLET_LOCAL_TOMBSTONE_KEEP_MS = '), line('const WALLET_LOCAL_CHANGED_PING_KEY = '), line('let walletLocalLastStamp = 0;'),
      fn('function walletLocalRecordEntries(record) {'), fn('function parseWalletLocalEntries(text) {'), fn('function adoptNewerWalletLocalEntries(stored) {'),
      fn('async function withWalletLocalWriteLock(task) {'), fn('function pingWalletLocalWindows() {'), fn('async function writeWalletLocalRecords(store, wallet, records) {')],
    'writeWalletLocalRecords');
    await write({ get: async (record: string) => ({ url: switched.get(record) }), put: async (record: string, text: string) => { switched.set(record, text); } }, { address: 'A' }, ['local']);
    expect(JSON.parse(switched.get('local')!), 'the first wallet\'s record untouched by the second wallet\'s map').toEqual(stored);
    expect(code(fn('function forgetDeviceCaches() {'))).toContain('await writeOwedWalletLocal(opened?.stores?.walletSets, owed.records)');
    expect(code(fn('function flushWalletLocalNow() {'))).toContain('writeOwedWalletLocal(opened?.stores?.walletSets, records)');
    expect(fold.parseWalletLocalEntries(JSON.stringify([['k', 'v']])), 'an older build\'s record reads, its keys the oldest').toEqual([['k', 'v', 0]]);
  });
});

describe('R16 — a mark is never newer than what was kept [A4 / F1-3]', () => {
  it('R16-MARKS-01: a history write that failed, or a history in memory, leaves the pass\'s marks unsealed — and a room record not saved, the rooms\'', async () => {
    const env: any = { encryptedMessageStore: { putMessage: async () => { throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' }); } },
      ensureMessageOrderFields: () => {}, messageCreatedAtMs: () => 1, serializeThreadForHistory: () => ({}), serializeMessageForHistory: () => ({}),
      historyWindowState: new Map(), setText: () => {}, localStateLabel: null, historyStatusLabel: () => '', t: (k: string) => k, console: { error() {} } };
    const api = lift({ ...env, historyWritesInFlight: new WeakMap(), historyStoreFor: () => env.encryptedMessageStore, historyStoreOfMessage: new WeakMap() },
      [fn('async function writeMessageToEncryptedHistory(thread, message) {'), fn('async function writeMessageToEncryptedHistoryNow(thread, message) {')],
      '{ write: writeMessageToEncryptedHistory, kept: historyKeptSince, setDurable: (v) => { encryptedMessageStoreDurable = v; }, failures: () => historyWriteFailures }',
      'let historyWriteFailures = 0; let encryptedMessageStoreDurable = false; ' + fn('function historyKeptSince(failuresAtStart) {'));
    api.setDurable(true);
    const start = api.failures();
    expect(api.kept(start)).toBe(true);
    expect(await api.write({ id: 't' }, { id: 'm' })).toBeNull();
    expect(api.kept(start), 'MEASURED before: the pass stayed clean and sealed marks over a message never kept').toBe(false);
    api.setDurable(false);
    expect(api.kept(api.failures()), 'a history in memory keeps nothing past the page').toBe(false);
    expect(code(fn('async function syncConvCapsulesFromShards(options = {}) {'))).toContain('historyKeptSince(historyFailuresAtStart)');
    expect(code(fn('async function bootEncryptedMessageHistory() {'))).toContain("encryptedMessageStoreDurable = opened?.type !== 'memory';");
    const keptMarks = code(fn('async function syncPrivateGroupsFromChainUnguarded() {'));
    expect(keptMarks.indexOf('if (groupPersistFailures === persistFailuresAtStart) {')).toBeGreaterThan(-1);
    expect(keptMarks.indexOf('if (groupPersistFailures === persistFailuresAtStart) {')).toBeLessThan(keptMarks.indexOf('persistLaneMarksSoon(GROUP_LANE_MARKS_RECORD,'));
    expect(code(fn('function noteGroupPersistFailure() {'))).toContain('groupPersistFailures += 1;');
  });
});

describe('R16 — a copy of an INTRO never takes the peer on its stamp [A6 / F2-2]', () => {
  const GENUINE = `0:${'a1'.repeat(32)}`;
  const COPIER = `0:${'c0'.repeat(32)}`;
  const adoptionFor = (source: string, createdAt: number, root: any) => ({
    kRoot: root.kRoot, introNonce: root.nonce, createdAt, peerEncPublicKey: null, peerWallet: source, peerWalletCandidates: [source],
  });

  it('R16-INTRO-01: a copy executed in the same second — or before — joins the candidates; the peer is the wallet whose keys answer', async () => {
    const { adoptKRoot } = await import('../web/conv-key-store.mjs');
    const root = { kRoot: new Uint8Array(32).fill(7), nonce: new Uint8Array(16).fill(9) };
    const peerKeyId = new Uint8Array(32).fill(3);
    const first = adoptKRoot(null, { ...adoptionFor(COPIER, 1_791_100_000, root), peerKeyId });
    const sameSecond = adoptKRoot(first.record, { ...adoptionFor(GENUINE, 1_791_100_000, root), peerKeyId });
    expect(sameSecond.outcome).toBe('duplicate');
    expect(sameSecond.record.peerWalletCandidates, 'MEASURED before: [the copier] alone — every reply refused for good').toEqual(expect.arrayContaining([COPIER, GENUINE]));
    const genuineFirst = adoptKRoot(null, { ...adoptionFor(GENUINE, 1_791_100_000, root), peerKeyId });
    const olderCopy = adoptKRoot(genuineFirst.record, { ...adoptionFor(COPIER, 1_791_099_997, root), peerKeyId });
    expect(olderCopy.outcome).toBe('resourced');
    expect(olderCopy.record.peerWallet, 'MEASURED before: the copier — handed the peer on a stamp 3 s older').toBe(GENUINE);
    const { createMemoryConvKeyStore } = await import('../web/conv-key-store.mjs');
    const store = createMemoryConvKeyStore();
    const self = new Uint8Array(32).fill(1);
    await store.upsertConversationKRoot(self, peerKeyId, adoptionFor(COPIER, 1_791_100_000, root));
    expect(await store.upsertConversationKRoot(self, peerKeyId, adoptionFor(GENUINE, 1_791_100_000, root))).toBe('duplicate');
    expect(store.getConversation(self, peerKeyId).peerWalletCandidates, 'kept, though the root moved nothing').toEqual(expect.arrayContaining([GENUINE]));
    expect(await store.settlePeerWallet(self, peerKeyId, GENUINE)).toBe(true);
    expect([store.getConversation(self, peerKeyId).peerWallet, store.getConversation(self, peerKeyId).peerWalletVerified]).toEqual([GENUINE, true]);
  });

  it('R16-INTRO-02: the reply and the naming ask every publisher and keep the one that answered; windows and the backup keep it', async () => {
    const { resolvePeerReplyBundle } = await import('../web/conv-reply-bundle.mjs');
    const { createMessagingIdentity } = await import('../web/crypto/platho-crypto.mjs');
    const { beginCell } = await import('@ton/core');
    const { createHash } = await import('node:crypto');
    const big = (b: Uint8Array): bigint => BigInt('0x' + Buffer.from(b).toString('hex'));
    const snake = (buf: Uint8Array) => {
      const chunks: Buffer[] = [Buffer.from(buf.subarray(0, 41))];
      for (let o = 41; o < buf.length; o += 127) chunks.push(Buffer.from(buf.subarray(o, Math.min(o + 127, buf.length))));
      let cursor = beginCell().storeBuffer(chunks[chunks.length - 1]);
      for (let i = chunks.length - 2; i >= 0; i -= 1) cursor = beginCell().storeBuffer(chunks[i]).storeRef(cursor.endCell());
      return cursor.endCell().toBoc().toString('base64');
    };
    const viewFor = (identity: any) => ({
      exists: true, enc_pubkey: big(identity.encryptionKeyPair.x25519PublicKey), sign_pubkey: big(identity.signingPublicKey), scan_pubkey: big(identity.scanPublicKey),
      pq_kem_pubkey_hash: BigInt('0x' + createHash('sha256').update(Buffer.from(identity.encryptionKeyPair.mlKem768PublicKey)).digest('hex')),
      pq_kem_pubkey_len: 1184n, pq_kem_pubkey: snake(identity.encryptionKeyPair.mlKem768PublicKey), crypto_suite_mask: 2n,
    });
    const peer: any = await createMessagingIdentity();
    const copier: any = await createMessagingIdentity();
    const verified: string[] = [];
    await resolvePeerReplyBundle({
      provider: { getView: async (wallet: string) => (wallet === GENUINE ? viewFor(peer) : viewFor(copier)) },
      peerWallet: COPIER, peerKeyId: peer.encryptionKeyPair.keyId, peerWalletCandidates: [GENUINE], onVerifiedWallet: (wallet: string) => { verified.push(wallet); },
    });
    expect(verified, 'the copier recorded first is refused; the wallet whose keys answer is reported').toEqual([GENUINE]);
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain('onVerifiedWallet: async (wallet) => { verifiedWallet = wallet; await settleVerifiedPeerWallet(selfKeyId, peerKeyId, rec, wallet, keyStore); },');
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain('followPeerChannelOnFirstReply(thread, verifiedWallet);');
    expect(code(fn('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'))).toContain('peerWalletCandidates: rec?.peerWalletCandidates ?? [],');
    const { mergeConvKeyMaps } = await import('../web/conv-key-persist.mjs');
    const record = (over: any) => ({ adoptedCreatedAt: 5, outgoingSeq: {}, kRootsForRead: [], retiredIntroNonces: [], ...over });
    const merged = mergeConvKeyMaps(
      new Map([['c', record({ peerWallet: GENUINE, peerWalletVerified: true, peerWalletCandidates: [GENUINE, COPIER] })]]),
      new Map([['c', record({ adoptedCreatedAt: 6, peerWallet: COPIER, peerWalletCandidates: [COPIER] })]]),
    ).get('c');
    expect([merged.peerWallet, merged.peerWalletVerified], 'MEASURED before: the newer record\'s copier stood').toEqual([GENUINE, true]);
    expect(merged.peerWalletCandidates).toEqual(expect.arrayContaining([GENUINE, COPIER]));
    const { serializeRecoveryMap, deserializeRecoveryMap } = await import('../web/recovery-blob.mjs');
    const kept = new Map([['c', { kRootCurrent: new Uint8Array(32).fill(2), peerKeyId: new Uint8Array(32).fill(3), peerWallet: COPIER,
      peerWalletCandidates: [COPIER, GENUINE], adoptedCreatedAt: 5, adoptedIntroNonce: new Uint8Array(16).fill(4), lastScannedEpoch: null }]]);
    const back = deserializeRecoveryMap(JSON.parse(JSON.stringify(serializeRecoveryMap(kept)))).get('c');
    expect(back.peerWalletCandidates, 'MEASURED before: [] — a restored device tried the copier alone').toEqual([GENUINE]);
  });

  it('R16-SEQDAYS-02: the outgoing counters a window pruned are not brought back by the other window\'s merge [F1-6]', async () => {
    const { mergeConvKeyMaps } = await import('../web/conv-key-persist.mjs');
    const merged = mergeConvKeyMaps(
      new Map([['c', { adoptedCreatedAt: 5, outgoingSeq: { 20700: 3, 20720: 2 }, kRootsForRead: [], retiredIntroNonces: [] }]]),
      new Map([['c', { adoptedCreatedAt: 5, outgoingSeq: { 20730: 1, 20725: 4 }, kRootsForRead: [], retiredIntroNonces: [] }]]),
    ).get('c');
    expect(Object.keys(merged.outgoingSeq).map(Number).sort(), 'MEASURED before: every day back on each write').toEqual([20725, 20730]);
  });
});

describe('R16 — the chain\'s clock where a stamp is judged [A5 / F2-1]', () => {
  it('R16-CLOCK-01: a private capsule\'s stamp is judged on the chain\'s clock — a reader minutes slow opens what a sender stamped on it', () => {
    const pass = code(fn('async function syncConvCapsulesFromShards(options = {}) {'));
    expect(pass, 'MEASURED before: a reader a day slow refused every incoming message as created in the future')
      .toContain('{ enforceExpiry: false, openAsSenderKeyId: introKeyIdString(selfKeyId), now: walletChainNowMs() }');
    expect(pass).toContain(': { enforceExpiry: false, now: walletChainNowMs() };');
    expect(pass).toContain('opened = await openPrivateCapsuleChainEntry(found.entry, keyPair, openOptions);');
  });
});

describe('R16 — a reaction is held while its signed bytes can land [A7 / F2-3, F2-8]', () => {
  it('R16-REACT-01: a press is not forgotten before its external is dead — no second paid press — and a lock during the send leaves its wait', async () => {
    const { createOwnReactionStore, buildReactMessage, PUBLIC_REACTION_COUNT } = await import('../web/public-reactions.mjs');
    const SHARD = '0:' + 'ab'.repeat(32);
    const WALLET = '0:' + '11'.repeat(32);
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
    const clock = { now: 7_000_000 };
    const statuses: string[] = [];
    const env: Record<string, any> = {
      plathoWallet: { address: WALLET },
      createOwnReactionStore, localStorageOrNull: () => storage, latchedLocalStorage: () => storage,
      queueReactionHydration: () => {}, setTimeout: () => {}, Date: { now: () => clock.now },
      showModerationStatus: (text: string) => { statuses.push(text); }, t: (key: string) => key, noteTonRpcRateLimit: () => false,
      buildReactMessage, squatCushionNanotons: () => 0n, LANE_PUBLIC: 'public', reactDirectLiveExtraNanotons: () => 0n, messageNetworkPrices: async () => null,
      assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 10_000_000n,
      sendPlathoWalletTransaction: async () => { env.lockNow(); return { pendingValidUntil: Math.floor(clock.now / 1000) + 300 }; },
      broadcastMayHaveLanded: () => false, requireSameWallet: (signer: any) => signer,
      reactionCounts: new Map(), PUBLIC_REACTION_COUNT, refreshReactionBars: () => {}, globalThis: {},
      walletChainClockOffsetMs: () => 0, DIRECT_SEND_EXPIRY_GRACE_MS: 30_000, console: { warn() {} },
      walletChainNowMs: () => clock.now, walletClockInDoubt: () => false,
    };
    const names = Object.keys(env);
    const sources = [
      'let ownReactionState = null;', fn('function reactionKey('), line('const REACTION_SETTLE_MS = '), line('const REACTION_REREAD_DELAYS_MS = '),
      'const reactionsUnsettled = new Map();', 'const reactionsInFlight = new Map();',
      fn('function reactionSettleAt('), fn('function reactionSignedDeadlineMs('), fn('function reactionChainDeadlineMs('), fn('function reactionHeld('),
      fn('function ownReactions('), fn('function resumePendingReactions('), fn('function reconcileUnsettledReactions('), fn('async function reactTo('),
    ];
    // eslint-disable-next-line no-new-func
    const api = new Function(...names, `${sources.join('\n')}\nreturn { reactTo, reconcileUnsettledReactions, lockNow: () => { plathoWallet = null; }, unlock: (w) => { plathoWallet = w; }, unsettled: reactionsUnsettled };`)(...names.map((n) => env[n]));
    env.lockNow = api.lockNow;
    await api.reactTo({ dataset: { shard: SHARD, target: '12' } }, 5);
    expect(statuses, 'MEASURED before: a TypeError after the send — "reaction failed", a mark with no wait').toEqual([]);
    const stored = createOwnReactionStore({ storage, wallet: WALLET });
    expect(stored.has(SHARD, 12n, 5)).toBe(true);
    expect(stored.pendingPresses()[0].settleAfter, 'held to the signed deadline and its grace').toBe(clock.now + 330_000);
    api.unlock({ address: WALLET });
    const counters = new Array(PUBLIC_REACTION_COUNT).fill(0);
    clock.now += 160_000;
    expect(api.reconcileUnsettledReactions(SHARD, 12n, counters)[5], 'MEASURED before: forgotten at 150 s while the bytes lived to 300 s').toBe(1);
    expect(createOwnReactionStore({ storage, wallet: WALLET }).has(SHARD, 12n, 5), 'still pressed: a second press is not offered').toBe(true);
    clock.now += 200_000;
    expect(api.reconcileUnsettledReactions(SHARD, 12n, counters)[5], 'past its deadline, never shown: withdrawn').toBe(0);
    expect(statuses).toEqual(['public.reactionFailed']);
  });
});

describe('R16 — the stake dialog never shows less than the press signs [A8 / F3-2]', () => {
  it('R16-STAKE-01: the custody balance is read at the money\'s tier, and an unread one is quoted with its top-up', async () => {
    const { planStake, FV_CUSTODY_TOPUP } = await import('../web/vault-account.mjs');
    const { FV_STAKE_MIN_ATH, FV_STAKE_MAX_ATH, FV_DEPLOY_FUNDING } = await import('../web/fee-vault.mjs');
    let asked: any = null;
    const read = lift({
      resolveVaultCustodyWallet: async () => '0:cc', withVaultReadLock: (task: any) => task(),
      createShardStatesRequest: (options: any) => { asked = options; return {}; },
      readAccountStates: async () => { throw Object.assign(new Error('TON RPC rate limit backoff active'), { code: 'RATE_LIMITED' }); },
      noteTonRpcRateLimit: () => true, console, CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8_000,
    }, [fn('async function readVaultCustodyBalance(vaultAddress) {')], 'readVaultCustodyBalance');
    expect(await read('0:vv')).toEqual({ custodyWallet: '0:cc', custodyBalance: null });
    expect(asked.requestOptions, 'MEASURED before: the scan tier — skipped outright in a park').toEqual({ priority: 'critical', skipIfRateLimited: false, queueTimeoutMs: 8_000 });
    const OWNER = `0:${'0b'.repeat(32)}`;
    const quote = lift({
      FV_STAKE_MIN_ATH, FV_STAKE_MAX_ATH, FV_DEPLOY_FUNDING, FV_CUSTODY_TOPUP, planStake,
      stakedAthOf: () => 0n, requirePlathoWalletAddress: () => OWNER, loadConnectedAthWalletAddress: async () => `0:${'0d'.repeat(32)}`,
      vaultAddressFor: async () => `0:${'0e'.repeat(32)}`, readVaultCustodyBalance: async () => ({ custodyWallet: `0:${'0f'.repeat(32)}`, custodyBalance: null }),
      priceVaultStakeForSend: async (plan: any) => ({ ...plan, ownerTopUp: 0n }), walletSendFeeReserveNanotons: () => 0n,
    }, [fn('async function quoteStakeGram(snapshot) {')], 'quoteStakeGram');
    const { VAULT_ABSENT } = await import('../web/vault-account.mjs');
    const shown = await quote({ state: VAULT_ABSENT, balance: 0n, staked: 0n, feeDue: 10_000_000n, nowSec: 0 });
    expect(shown.kept, 'MEASURED before: 0.05 shown kept, 0.10 signed — the custody\'s rent never back').toBe(FV_DEPLOY_FUNDING + FV_CUSTODY_TOPUP);
  });
});

describe('R16 — the vault obligations of 2026-09-29 [A9 / E2-A, FL-1]', () => {
  it('R16-VAULTDEPLOY-01: the vault\'s deploy is bounceable — created by its StateInit, its 0.05 GRAM sent back by an account that cannot take it', async () => {
    const { buildVaultDeployMessage } = await import('../web/fee-vault.mjs');
    const { FEEVAULT_CODE_BOC_18 } = await import('../web/shard-code-18.mjs');
    const message = buildVaultDeployMessage(FEEVAULT_CODE_BOC_18, `0:${'0b'.repeat(32)}`, `0:${'0c'.repeat(32)}`);
    expect(message.bounce, 'MEASURED before: false — a deploy into a frozen vault kept its value').toBe(true);
    expect(message.stateInit, 'the StateInit rides: an account that does not exist is created by it').toBeTruthy();
  });
});

describe('R16 — a face costs no read it has had [B1 / F6-1]', () => {
  it('R16-FACES-01: the one serial lane runs what is looked at first — a background task waits, a promoted one goes ahead of the backlog — and a lane that marks nothing is the FIFO it was', async () => {
    const createSerialLane = lift({}, [fn('function createSerialLane() {')], 'createSerialLane');
    const lane = createSerialLane();
    const order: string[] = [];
    const gate: any = {};
    const first = lane(() => new Promise((resolve) => { gate.open = resolve; order.push('first'); }));
    const backlog = ['b1', 'b2', 'b3'].map((name) => lane(async () => { order.push(name); }, { background: true, key: name }));
    const looked = lane(async () => { order.push('looked'); });
    lane.promote('b3');
    await delay(0);
    gate.open();
    await Promise.all([first, looked, ...backlog]);
    expect(order, 'MEASURED before: one FIFO — a face looked at waited behind the whole restore').toEqual(['first', 'b3', 'looked', 'b1', 'b2']);
    const plain = createSerialLane();
    const seen: number[] = [];
    const runs = [1, 2, 3].map((n) => plain(async () => { if (n === 2) throw new Error('two'); seen.push(n); }));
    await expect(runs[1], 'a rejection stays its caller\'s').rejects.toThrow('two');
    await Promise.all([runs[0], runs[2]]);
    expect(seen, 'in order, and one failure wedges nothing').toEqual([1, 3]);
    expect(app).toContain('const enqueueAvatarChainRead = createSerialLane();');
    expect(code(fn('function requestThreadFace(thread) {'))).toContain('wanted.pointer, { background: thread.id !== activeThreadId, stillWanted })');
  });

  it('R16-FACES-02: "no face" is believed a day, and never over a pointer — a message carrying one says the peer wears a face now; one asked again where the person looks goes ahead', async () => {
    const make = (enqueue: any, absent: Map<string, number>) => lift({
      rawWalletAddress: (w: string) => w, avatarPointerFromFields: (v: number, h: string) => (v ? { profileVersion: v, avatarHash: h } : null),
      readProfileAvatarMediaCache: async () => null, readStoredProfileAvatarPointer: () => null, profileAvatarPointerIsStale: () => false,
      profileAvatarAbsentUntil: absent, walletLockedOnDevice: () => false, profileAvatarLoadPromises: new Map(), profileAvatarVersionMissUntil: new Map(),
      profileAvatarLoadsLookedAt: new Set(),
      enqueueAvatarChainRead: enqueue, globalThis: {}, noteTonRpcRateLimit: () => false, console,
      walletSessionGeneration: 0,
    }, [fn('async function loadProfileAvatarImage(ownerWallet, pointer = null, { background = false, stillWanted = null, requestClass = \'profile\' } = {}) {')], 'loadProfileAvatarImage');
    const asked: any[] = [];
    const load = make(Object.assign((_task: any, options: any) => { asked.push(options); return Promise.resolve('data:face'); }, { promote() {} }),
      new Map([['P', Date.now() + 3_600_000]]));
    expect(await load('P'), 'no pointer: the note answers, nothing is read').toBeNull();
    expect(asked).toEqual([]);
    expect(await load('P', { profileVersion: 2, avatarHash: '0xab' }), 'MEASURED before: refused on the note — a new face waited the note out').toBe('data:face');
    expect(asked).toHaveLength(1);
    const lanes: any[] = [];
    let release: any = null;
    const later = make(Object.assign((_task: any, options: any) => { lanes.push(options); return new Promise((resolve) => { release = () => resolve('data:q'); }); },
      { promote: (key: string) => lanes.push({ promoted: key }) }), new Map());
    const pointer = { profileVersion: 3, avatarHash: '0xcd' };
    const background = later('Q', pointer, { background: true });
    await delay(0);
    const looked = later('Q', pointer);
    await delay(0);
    expect(lanes).toEqual([{ background: true, key: 'Q:3:0xcd' }, { promoted: 'Q:3:0xcd' }]);
    release();
    expect(await Promise.all([background, looked])).toEqual(['data:q', 'data:q']);
    expect(line('const PROFILE_AVATAR_ABSENT_TTL_MS = ')).toContain('24 * 60 * 60_000');
  });

  it('R16-FACES-03: a face read keeps its place in the sealed cache — the faces a restore asks for outlive the restore', async () => {
    const { IDBFactory } = await import('fake-indexeddb');
    const { generateRandomAtRestKeys } = await import('../web/at-rest-seal.mjs');
    const { openSealedCacheStores } = await import('../web/sealed-cache.mjs');
    const keys = (await generateRandomAtRestKeys()).caches;
    const { stores, close } = await openSealedCacheStores({ dbName: 'r16-faces', keys, namespaces: { avatarMedia: 4 }, indexedDB: new IDBFactory() });
    const media = stores.avatarMedia;
    for (const face of ['f1', 'f2', 'f3', 'f4']) await media.put(face, `data:${face}`);
    expect(await media.get('f1')).toEqual({ hash: 'f1', url: 'data:f1' });
    await media.touch('f1');
    await media.put('f5', 'data:f5');
    expect(await media.get('f1'), 'MEASURED before: evicted by its write count — read from the chain again at every unlock').toEqual({ hash: 'f1', url: 'data:f1' });
    expect(await media.get('f2'), 'the one nobody asked for goes').toBeNull();
    await close();
    expect(code(fn('async function readProfileAvatarMediaCache(avatarHash) {'))).toContain('void store?.touch?.(hash)?.catch?.(() => {});');
    expect(line('  avatarMedia: Object.freeze(')).toContain('cap: () => 1_000');
  });
});

describe('R16 — the private pass past 8,192 conversations [B2 / F6-2]', () => {
  it('R16-PLANNER-01: a pass is given the room for what it asks — nothing derived twice — each shard carries its address key, and the sealed copy keeps the newest, without it', async () => {
    const { createRecordShardPlanner } = await import('../web/conv-discovery.mjs');
    const { addrKey } = await import('../web/shard-discovery.mjs');
    const bytes = (seed: number) => Uint8Array.from({ length: 32 }, (_, i) => (seed * 31 + i * 7) & 0xff);
    const conv = (n: number) => ({ kRoot: bytes(n), selfKeyId: bytes(200), peerKeyId: bytes(n + 100), epochNow: 20690, windowW: 2 });
    const planner = createRecordShardPlanner({ limit: 4, ceiling: 64 });
    const pass = async () => {
      planner.beginPass({ expected: 2 * 10 });
      for (let n = 1; n <= 10; n += 1) { await planner.incoming(conv(n)); await planner.outgoing(conv(n)); }
    };
    await pass();
    const derived = planner.stats.misses;
    await pass();
    expect(planner.stats.misses - derived, 'MEASURED before: past the cap 3,616 plans derived again every pass at 10,000').toBe(0);
    expect(planner.stats.bypassed).toBe(0);
    const shards = await planner.incoming(conv(1));
    expect(shards.length).toBeGreaterThan(0);
    for (const shard of shards) expect(shard.addrKey, 'derived once, with the plan').toBe(addrKey(shard.address));
    planner.beginPass({ expected: 1_000 });
    expect(planner.limit, 'never past the ceiling').toBe(64);
    const kept = planner.exportEntries({ epochNow: 20690, maxWindow: 2, maxEntries: 5 });
    expect(kept, 'the newest, when the cache grew past what a record should hold').toHaveLength(5);
    expect(JSON.stringify(kept), 'derived again at the load: not worth its bytes sealed').not.toContain('addrKey');
    const again = createRecordShardPlanner({ limit: 8 });
    expect(again.importEntries(kept)).toBe(5);
    const back = await again.incoming(conv(1));
    expect(again.stats.hits, 'the plan used last is among the newest').toBe(1);
    expect(back.map((shard: any) => shard.addrKey)).toEqual(shards.map((shard: any) => shard.addrKey));
    expect(line('const CONV_SHARD_PLAN_CEILING = ')).toContain('65_536');
    const syncPass = code(fn('async function syncConvCapsulesFromShards(options = {}) {'));
    expect(syncPass).toContain('convShardPlanner.beginPass({ expected: 2 * conversationRecords.size + 64 });');
    expect(syncPass, 'MEASURED before: 1.4 s a pass parsing addresses again at 10,000').toContain('root.shards.map((shard) => shard.addrKey ?? publicAddrKey(shard.address))');
    expect(code(fn('function persistConvShardPlansSoon(epochNow) {'))).toContain('maxEntries: convShardPlanner.limit');
  });
});

describe('R16 — the quiet ones beside the pass, and the rooms on a clock [B3 / F6-3, B9 / F6-11]', () => {
  it('R16-QUIET-01: the pass reads the awake ones; the quiet ones are probed by a task of their own, each once a minute — one found written wakes, one found empty is closed by the next pass', async () => {
    const reads: string[][] = [];
    const holder: any = { read: async () => new Map() };
    const api = lift({
      currentStatesBatchCeiling: () => 1, introKeyIdString: (k: string) => String(k), publicAddrKey: (a: string) => a,
      readConvShardStates: async (plans: any[]) => { reads.push(plans.map((p: any) => p.peerKeyId)); return holder.read(); },
      noteTonRpcRateLimit: () => false, console,
      quietAddressesPerMinute: () => Infinity,
    }, [fn('function convPlansDueThisPass(plans, { forceFull = false, epochNow = null } = {}) {'), fn('function noteConvQuiet(plans, states, now = Date.now()) {'),
      line('const quietSpent = '), line('const QUIET_BOOK_STALE_MS = '), fn('function quietDueEveryMs(cost, quietAddresses, quietMs) {'), fn('function takeQuietWithinShare('), 'function currentStatesBatchCeiling() { return 0; }' ,
      fn('function probeQuietConversations(plans, { epochNow, now = Date.now(), quietAddresses = quietAddressesPerMinute() } = {}) {')],
    '{ split: convPlansDueThisPass, note: noteConvQuiet, probe: probeQuietConversations, quiet: convQuietAt, clean: convQuietProbedClean, lock: () => { walletSessionGeneration += 1; } }',
    'const CONV_QUIET_PROBE_MS = 60_000; const CONV_QUIET_MAX = 65_536; const convQuietAt = new Map(); const convQuietProbedClean = new Map(); let convQuietProbeRun = null; let walletSessionGeneration = 0; const convQuietSpent = { since: -Infinity, addresses: 0 };');
    const plan = (peer: string) => ({ peerKeyId: peer, cold: false, rootShards: [{ shards: [{ address: `${peer}-1`, addrKey: `${peer}-1` }] }] });
    const all = [plan('A'), plan('B'), plan('C')];
    const ids = (list: any[]) => list.map((p: any) => p.peerKeyId);
    const T = Date.now();
    let split = api.split(all, { epochNow: 20_000 });
    expect([ids(split.due), split.settled, split.left], 'nothing known: the pass reads every one').toEqual([['A', 'B', 'C'], [], []]);
    api.note(split.due, new Map([['A-1', { lastLt: '1' }]]), T - 61_000);
    split = api.split(all, { epochNow: 20_000 });
    expect(ids(split.due), 'MEASURED before: the quiet ones probed in front of the awake one — p50 66 s at 10,000').toEqual(['A']);
    expect(ids(split.left)).toEqual(['B', 'C']);
    holder.read = async () => new Map([['C-1', { lastLt: '2' }]]);
    const probing = api.probe(split.left, { epochNow: 20_000, now: T });
    expect(api.probe(split.left, { epochNow: 20_000, now: T }), 'one probe at a time').toBe(probing);
    expect(await probing, 'one woke').toBe(1);
    expect(reads.at(-1), 'one batch of their own').toEqual(['B', 'C']);
    split = api.split(all, { epochNow: 20_000 });
    expect(ids(split.due), 'C woke for this pass').toEqual(['A', 'C']);
    expect(ids(split.settled), 'B\'s window is closed by this pass — nothing to read, the cursor moves').toEqual(['B']);
    split = api.split(all, { epochNow: 20_000 });
    expect([split.settled, ids(split.left)], 'closed once').toEqual([[], ['B']]);
    expect(api.probe(split.left, { epochNow: 20_000, now: T + 30_000 }), 'its minute not up: not probed').toBeNull();
    expect(api.split(all, { epochNow: 20_000, forceFull: true }).due, 'a manual sync reads every one').toHaveLength(3);
    let release: any = null;
    holder.read = () => new Promise((resolve) => { release = () => resolve(new Map()); });
    const late = api.probe(split.left, { epochNow: 20_000, now: T + 61_000 });
    await delay(0);
    api.lock();
    release();
    expect(await late).toBe(0);
    expect([api.quiet.get('B'), api.clean.has('B')], 'the stamp it had, nothing closed').toEqual([T, false]);
    const syncPass = code(fn('async function syncConvCapsulesFromShards(options = {}) {'));
    expect(syncPass).toContain('const { due: plans, settled, left } = convPlansDueThisPass(allPlans, { forceFull, epochNow });');
    expect(syncPass).toContain('if (left.length > 0) void probeQuietConversations(left, { epochNow });');
    expect(syncPass.indexOf('if (left.length > 0) void probeQuietConversations(left, { epochNow });'), 'beside the pass, never awaited ahead of its reads')
      .toBeLessThan(syncPass.indexOf('const shardStates = await readConvShardStates(plans);'));
    expect(syncPass).toContain('for (const plan of settled.length > 0 ? [...plans, ...settled] : plans) {');
  });

  it('R16-ROOMS-01: a room whose pass brought nothing is read once a minute — the awake ones every time, every room after a save that failed — and the batch asks only what the rooms read asked', async () => {
    const calls: string[][] = [];
    const syncs: any[] = [];
    const lanes: Record<string, string[]> = { aa: ['a1', 'a2'], bb: ['b1', 'b2'] };
    const loud = new Set<string>(['bb']);
    const clock = { now: 1_000_000 };
    const awake = new Set<string>();
    const failNext = { on: false };
    let api: any = null;
    const runtime: any = {
      list: () => [{ groupId: Uint8Array.from([0xaa]) }, { groupId: Uint8Array.from([0xbb]) }],
      async sync({ deliver, groupIds = null }: any) {
        syncs.push(groupIds);
        const out: any[] = [];
        for (const id of ['aa', 'bb']) {
          if (groupIds && !groupIds.includes(id)) continue;
          await api.readGroupLaneStates(lanes[id]);
          if (failNext.on) api.fail();
          const pass = { groupId: id, record: {}, messages: loud.has(id) ? [{}] : [] };
          await deliver(pass);
          out.push(pass);
        }
        failNext.on = false;
        return out;
      },
    };
    api = lift({
      ensureGroupRuntime: async () => runtime, groupRuntimeInstance: runtime, deliverPrivateGroupPass: async () => ({ added: 0, stored: true }),
      ageLeftGroupEchoes: () => 0, renderThreads: () => {}, renderConversation: () => {}, noteTonRpcRateLimit: () => false, console,
      readAccountStates: async (addresses: string[]) => { calls.push([...addresses]); return new Map(addresses.map((a) => [a, { lastLt: '1' }])); },
      createShardStatesRequest: () => null, publicAddrKey: (address: string) => address, drainGroupAccessOwed: () => {},
      persistLaneMarksSoon: () => {}, GROUP_LANE_MARKS_RECORD: 'rooms', groupRuntimeLanes: new WeakMap(), epochFromCreatedAtSeconds: () => 0, chainNowSec: () => 0,
      persistLaneRecordSoon: () => {}, GROUP_LANE_ASKED_RECORD: 'roomsAsked', PLATHO_APP_BUILD_ID: 'b',
      bytesToHex: (bytes: Uint8Array) => Buffer.from(bytes).toString('hex'), groupRoomsAwake: () => awake, Date: { now: () => clock.now },
      quietAddressesPerMinute: () => Infinity,
    }, [line('const quietSpent = '), line('const QUIET_BOOK_STALE_MS = '), fn('function quietDueEveryMs(cost, quietAddresses, quietMs) {'), fn('function takeQuietWithinShare('), 'function currentStatesBatchCeiling() { return 0; }' , fn('function groupPassIsQuiet(pass) {'), fn('function createRoomPassBook('),
      fn('async function readGroupLaneStates(addresses) {'), fn('async function syncPrivateGroupsFromChainUnguarded() {')],
    '{ readGroupLaneStates, pass: syncPrivateGroupsFromChainUnguarded, fail: () => { groupPersistFailures += 1; }, book: privateRoomBook }',
    'let groupStatesPass = null; let groupPersistFailures = 0; const GROUP_QUIET_PROBE_MS = 60_000; const privateRoomBook = createRoomPassBook();');
    const at = async (ms: number) => { clock.now = 1_000_000 + ms; calls.length = 0; await api.pass(); return { asked: [...calls], synced: syncs.at(-1) }; };
    expect(await at(0), 'the first pass: every room, each asking its own').toEqual({ asked: [['a1', 'a2'], ['b1', 'b2']], synced: null });
    expect(await at(12_000), 'MEASURED before: every room, every pass — a quiet room waits its minute, and its lanes are not asked').toEqual({ asked: [['b1', 'b2']], synced: ['bb'] });
    loud.delete('bb');
    expect(await at(61_000), 'a minute on: both again, in one batch').toEqual({ asked: [['a1', 'a2', 'b1', 'b2']], synced: null });
    awake.add('aa');
    expect((await at(70_000)).synced, 'the open room every time').toEqual(['aa']);
    failNext.on = true;
    expect((await at(71_000)).synced).toEqual(['aa']);
    awake.clear();
    expect((await at(72_000)).synced, 'a pass that could not save a room stamps none of its rooms: read again at once').toEqual(['aa']);
    expect((await at(73_000)).synced, 'and quiet again once saved').toEqual([]);
    const book = lift({}, [line('const quietSpent = '), line('const QUIET_BOOK_STALE_MS = '), fn('function quietDueEveryMs(cost, quietAddresses, quietMs) {'), fn('function takeQuietWithinShare('), 'function currentStatesBatchCeiling() { return 0; }' , fn('function groupPassIsQuiet(pass) {'), fn('function createRoomPassBook(')], 'createRoomPassBook()', 'const GROUP_QUIET_PROBE_MS = 60_000;');
    book.seed(['s1']);
    expect(book.hint(['x']), 'the sealed record\'s asks, for the first pass').toEqual(['s1']);
    book.begin(); book.asked(['x1']); book.claim('x'); book.asked(['y1']); book.end(['x']);
    expect([book.hint(['x']), book.hint([])], 'its own, and the unclaimed once').toEqual([['y1', 'x1'], ['y1']]);
    book.seed(['s2']);
    expect(book.hint([]), 'a seed never over what this session learned').toEqual(['y1']);
    book.clear();
    expect([book.hint(['x']), book.askedAll().size, book.due(['x'])]).toEqual([[], 0, ['x']]);
    expect(code(fn('function groupRoomsAwake() {'))).toContain("(thread.messages ?? []).some((message) => message.type === 'out' && message.meta === 'sending')");
    const publicPass = code(fn('async function syncPublicGroupsFromChainUnguarded() {'));
    expect(publicPass, 'the public twin on the same clock').toContain('const due = publicRoomBook.due(roomIds, { now: passedAt, awake: groupRoomsAwake(), quietAddresses: quietAddressesPerMinute() });');
    expect(publicPass).toContain('publicRoomBook.note(due, passes, { at: passedAt });');
    expect(code(fn('async function syncPrivateGroupsFromChainUnguarded() {')), 'what the rooms asked is kept [B9]').toContain('if (askedNow) persistLaneRecordSoon(GROUP_LANE_ASKED_RECORD, JSON.stringify({ recipe: PLATHO_APP_BUILD_ID, asked: askedNow }));');
    expect(code(fn('async function buildGroupRuntime() {')), 'seeded at the unlock [B9]').toContain('await loadGroupAskedAddresses(wallet);');
    expect(code(fn('async function loadGroupAskedAddresses(wallet) {'))).toContain('privateRoomBook.seed(held.asked);');
    for (const reset of ["function clearWalletScopedRuntimeState(reason = 'wallet changed') {", "function lockPlathoWallet(status = t('wallet.locked'), options = {}) {"]) {
      const body = code(fn(reset));
      for (const cleared of ['convQuietProbedClean.clear();', 'privateRoomBook.clear();', 'publicRoomBook.clear();', 'publicClosedErasReadAt.clear();']) {
        expect(body, `MEASURED before: the rooms' lane addresses and the follows' clock outlived the wallet [F6-11] — ${reset.slice(9, 40)}`).toContain(cleared);
      }
    }
  });

  it('R16-MARKS-02: the lane marks are written when they changed, and read back whatever the day — never across builds', async () => {
    const written: any[] = [];
    const held = new Map<string, any>();
    const W = { address: 'W' };
    const store = { type: 'sealed-indexeddb', put: async (record: string, text: string) => { written.push([record, JSON.parse(text)]); }, get: async (record: string) => held.get(record) ?? null };
    const api = lift({ plathoWallet: W, PLATHO_APP_BUILD_ID: 'b2', CONV_SHARD_PLANS_SAVE_DELAY_MS: 0, console, deviceCacheStore: async () => store,
      LANE_MARKS_SAVE_DELAY_MS: 0 },
      [fn('function persistLaneMarksSoon(record, lane, askedKeys, epochNow, { extra = null } = {}) {'), fn('function persistLaneRecordSoon(record, text) {'),
        fn('async function loadLaneMarks(wallet, record, lane, { onHeld = null } = {}) {')],
      '{ persist: persistLaneMarksSoon, load: loadLaneMarks }', 'const laneMarksOwed = new Map(); const laneMarksWritten = new Map();');
    const lane = (marks: any[]) => ({ exportMarks: () => marks, importMarks: (entries: any[]) => entries.length });
    api.persist('conv', lane([['a', '1']]), new Set(['a']), 20_000);
    await delay(5);
    api.persist('conv', lane([['a', '1']]), new Set(['a']), 20_000);
    await delay(5);
    expect(written.length, 'MEASURED before: the same marks re-sealed after every clean pass — 0.92 MB every 12 s at 10,000').toBe(1);
    api.persist('conv', lane([['a', '2']]), new Set(['a']), 20_000);
    await delay(5);
    expect(written.map(([, text]) => text.marks)).toEqual([[['a', '1']], [['a', '2']]]);
    api.persist('rooms', lane([['r', '5']]), new Set(['r']), 20_000, { extra: { asked: ['r'] } });
    await delay(5);
    expect(written.at(-1)).toEqual(['rooms', { recipe: 'b2', epoch: 20_000, marks: [['r', '5']], asked: ['r'] }]);
    held.set('conv', { url: JSON.stringify({ recipe: 'b2', epoch: 19_999, marks: [['a', '2'], ['b', '3']] }) });
    expect(await api.load(W, 'conv', lane([])), 'MEASURED before: a day old — thrown away, every written window shard read again').toBe(2);
    const seeded: any[] = [];
    held.set('rooms', { url: JSON.stringify({ recipe: 'b1', epoch: 20_000, marks: [['r', '1']], asked: ['r'] }) });
    expect(await api.load(W, 'rooms', lane([]), { onHeld: (h: any) => seeded.push(h.asked) }), 'another build\'s marks are not this build\'s').toBe(0);
    held.set('rooms', { url: JSON.stringify({ recipe: 'b2', epoch: 19_000, marks: [['r', '1']], asked: ['r1', 'r2'] }) });
    expect(await api.load(W, 'rooms', lane([]), { onHeld: (h: any) => seeded.push(h.asked) })).toBe(1);
    expect(seeded, 'the rooms\' asks come back with them [B9]').toEqual([['r1', 'r2']]);
  });
});

describe('R16 — the follows that never posted, the INTRO pass, the unlock, the writes [B4-B8 / F6-4, F6-5, F6-6, F6-9, F6-10]', () => {
  it('R16-CHANNELS-01: a followed channel that never posted is read every five minutes, its first wait phased by its wallet; its closed eras take their place in the period after the first probe', () => {
    const make = (open: boolean) => {
      const env: any = {
        publicChannelFeedCache: { held: { feed: { posts: [{ id: 'p' }] } } }, publicSilentChannelAt: new Map(), publicClosedErasReadAt: new Map(),
        PUBLIC_CLOSED_ERAS_PERIOD_MS: 600_000, PUBLIC_SILENT_CHANNEL_PERIOD_MS: 300_000, publicChannelViewOpen: open, publicChannelViewChannelId: 'viewed',
      };
      return { env, api: lift(env, [fn('function publicWalletSpread(wallet) {'), fn('function publicChannelReadThisPass(wallet, channel = null, now = Date.now()) {'),
        fn('function notePublicPassClocks({')], '{ read: publicChannelReadThisPass, note: notePublicPassClocks, spread: publicWalletSpread }') };
    };
    const { env, api } = make(false);
    const T = 1_000_000_000;
    const SILENT = '0:aaaa8000';
    const POSTER = '0:bbbb0000';
    const FAILED = '0:cccc0000';
    const channels = new Map<string, any>([[SILENT, { id: 'silent' }], [POSTER, { id: 'poster' }], [FAILED, { id: 'failed' }], ['0:dddd0000', { id: 'held' }]]);
    const pass = (readNow: string[], at: number, posted: string[] = [], failed: string[] = []) => api.note({
      readNow, closedErasRead: new Set(readNow), failedWallets: new Set(failed), walletOfChannel: channels, readAt: at,
      postsByWallet: new Map(readNow.map((wallet) => [wallet, posted.includes(wallet) ? [{ id: 'post' }] : []])),
    });
    expect([SILENT, POSTER, FAILED].map((wallet) => api.read(wallet, channels.get(wallet), T)), 'never read: every one').toEqual([true, true, true]);
    pass([SILENT, POSTER, FAILED, '0:dddd0000'], T, [POSTER], [FAILED]);
    expect(env.publicSilentChannelAt.get(SILENT), 'its first wait phased by its wallet').toBe(T - 150_000);
    expect(env.publicSilentChannelAt.has(POSTER), 'one that posts is read every pass').toBe(false);
    expect(env.publicSilentChannelAt.has('0:dddd0000'), 'nor one this device holds posts of').toBe(false);
    expect(env.publicSilentChannelAt.has(FAILED), 'nor one whose read failed').toBe(false);
    expect(env.publicClosedErasReadAt.get(SILENT), 'MEASURED before: stamped with the pass\'s moment — 750 contacts in step, 54 requests every 10 minutes').toBe(T - 300_000);
    expect(env.publicClosedErasReadAt.has(FAILED), 'a failed probe is probed again').toBe(false);
    expect(api.read(SILENT, channels.get(SILENT), T + 30_000), 'MEASURED before: read every 30-s pass').toBe(false);
    expect(api.read(SILENT, channels.get(SILENT), T + 150_000)).toBe(true);
    pass([SILENT], T + 150_000);
    expect([env.publicSilentChannelAt.get(SILENT), env.publicClosedErasReadAt.get(SILENT)], 'from then on, once a period from its probe').toEqual([T + 150_000, T + 150_000]);
    expect(api.read(SILENT, channels.get(SILENT), T + 400_000)).toBe(false);
    pass([SILENT], T + 450_000, [SILENT]);
    expect(env.publicSilentChannelAt.has(SILENT), 'its first post: read every pass').toBe(false);
    const viewed = make(true);
    viewed.env.publicSilentChannelAt.set(SILENT, T);
    expect(viewed.api.read(SILENT, { id: 'viewed' }, T + 1), 'the channel on screen is read every time').toBe(true);
    const shards = code(fn('async function syncPublicChannelFromShards('));
    expect(shards).toContain('postsByWallet = await lane.readChannelPostsMany(readNow, {');
    expect(shards).toContain('notePublicPassClocks({ readNow, closedErasRead, failedWallets, postsByWallet, walletOfChannel, readAt });');
    expect(shards, 'a channel not asked keeps what it holds').toContain('if (!readThisPass.has(String(channel.authorWallet))) continue;');
  });

  it('R16-INTROBUDGET-01: the INTRO hot pass takes at most a fifth of the keyless pump — at today\'s volume nothing changes', async () => {
    const { planIntroScan, liveBucketsFor, DEFAULT_POLICY } = await import('../web/intro-scan-policy.mjs');
    const { INTRO_READ_SPACE } = await import('../web/shard-discovery.mjs');
    const at = (perDay: number, policy: any = {}) => {
      const live = liveBucketsFor(perDay);
      return planIntroScan({ distinctLiveBuckets: live, liveBuckets: live * 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0, policy });
    };
    const perMinute = (plan: any, perDay: number) => (1 + liveBucketsFor(perDay)) * 60_000 / plan.intervalMs;
    expect(at(8_000).intervalMs, 'today: the minute floor binds').toBe(DEFAULT_POLICY.minIntervalMs);
    for (const perDay of [100_000, 200_000, 350_000]) {
      const plan = at(perDay);
      expect(perMinute(plan, perDay), `MEASURED before: 14 / 21 / 13.7 requests a minute at ${perDay} — up to half the pump`).toBeLessThanOrEqual(43.5 * 0.2 + 0.01);
    }
    expect(at(100_000).intervalMs).toBe(Math.ceil(14 * 1_380 / 0.2));
    expect(at(100_000, { requestShare: 0.5 }).intervalMs, 'a larger requestShare: sooner').toBeLessThan(at(100_000).intervalMs);
    expect(at(8_200_000).intervalMs, 'never past the ceiling').toBe(DEFAULT_POLICY.maxIntervalMs);
    expect(DEFAULT_POLICY.requestShare).toBe(0.2);
  });

  it('R16-RESTORE-01: the unlock waits for the open conversation and a screenful; the rest lands behind the screen, and what the boot owes after all of it — the seq marks, the resumed sends — runs once the last is in', async () => {
    const calls: string[] = [];
    const store = {
      listThreadSummaries: async () => ['open', 'n1', 'n2', 'n3', 'n4'].map((threadId, i) => ({ threadId, count: 3, newestCreatedAt: Date.now() - i * 1_000 })),
      listMessagesDetailed: async ({ threadId }: any) => { calls.push(threadId); await delay(5); return { messages: [{ id: `${threadId}-1`, createdAt: 1, message: { type: 'in' } }], failed: [] }; },
    };
    const seen: any = { seeded: [], rearmed: 0, applied: [] };
    const env: any = {
      encryptedMessageStore: store, activeThreadId: 'open', historyWindowState: new Map(), PRIVATE_HISTORY_WINDOW: 96, PRIVATE_HISTORY_QUIET_WINDOW: 8, CONV_RECV_WINDOW_W: 2,
      PRIVATE_HISTORY_FIRST_SCREEN: 2, console,
      applyRestoredHistoryItems: (items: any[]) => { seen.applied.push(items.map((item: any) => item.id)); return items.length > 0; },
      healCrossWalletIdentityBleed: () => false, seedConvSeqMarksFromHistory: (messages: any[]) => { seen.seeded.push(messages.length); return messages.length; },
      currentMessageHistoryDbName: () => 'db', plathoWallet: { address: 'W' }, historyStatusLabel: () => 'h', t: (k: string) => k, setText: () => {}, localStateLabel: null,
      renderThreads: () => {}, renderConversation: () => {}, resumePendingPublicPublishConfirmations: () => {}, resumePendingPrivateSendRetries: () => {},
      rearmConvDeliveryConfirms: () => { seen.rearmed += 1; }, requestAnimationFrame: (cb: any) => setTimeout(cb, 0), globalThis: {},
      settleInterruptedSends: () => {},
      RESTORE_BEHIND_PAINT_MS: 1_000,
      threadListOnScreen: () => true, refreshChatsRailBadge: () => {},
    };
    const api = lift(env, [fn('async function restoreHistoryWindows('), fn('async function restoreEncryptedMessageHistory() {')],
      '{ restore: restoreEncryptedMessageHistory, behind: () => historyRestoreBehind, lock: () => { walletSessionGeneration += 1; } }',
      'let historyApplyFailures = []; let historyDuplicateRecordIds = new Set(); let historyRestoreBehind = null; let historyRestoreReadWindow = null; let walletSessionGeneration = 0;');
    await api.restore();
    expect(calls.slice(0, 2), 'the open one, then the newest').toEqual(['open', 'n1']);
    expect(calls.length, 'MEASURED before: the screen waited for every conversation — 22.5 s at 10,000 in the harness').toBeLessThan(5);
    expect([seen.seeded, seen.rearmed], 'what the boot owes after all of them waits for the last').toEqual([[], 0]);
    expect(api.behind(), 'a pass waits on this').not.toBeNull();
    await api.behind();
    expect(calls).toEqual(['open', 'n1', 'n2', 'n3', 'n4']);
    expect([seen.seeded, seen.rearmed], 'the seq marks from every conversation').toEqual([[5, 5], 1]);
    expect(api.behind(), 'and the wait is over').toBeNull();
    calls.length = 0;
    seen.seeded.length = 0;
    await api.restore();
    const behind = api.behind();
    api.lock();
    await behind;
    expect(calls.length, 'stopped at the lock').toBeLessThan(5);
    expect(seen.seeded, 'nothing seeded for a session that ended').toEqual([]);
    const pass = code(fn('async function syncConvCapsulesFromShards(options = {}) {'));
    expect(pass.indexOf('if (historyRestoreReadWindow) await historyRestoreReadWindow;'), 'the pass waits for it, before it takes its store and keys').toBeGreaterThan(-1);
    expect(pass.indexOf('if (historyRestoreReadWindow) await historyRestoreReadWindow;')).toBeLessThan(pass.indexOf('const store = convKeyStore;'));
    expect(code(fn('async function syncGroupsFromChainUnguarded() {'))).toContain('if (historyRestoreReadWindow) await historyRestoreReadWindow;');
    expect(code(fn('async function syncGroupsFromChainUnguarded() {'))).not.toContain('await historyRestoreBehind');
    for (const reset of ["function clearWalletScopedRuntimeState(reason = 'wallet changed') {", "function lockPlathoWallet(status = t('wallet.locked'), options = {}) {"]) {
      expect(code(fn(reset))).toContain('historyRestoreBehind = null;');
      expect(code(fn(reset))).toContain('publicSilentChannelAt.clear();');
    }
  });

  it('R16-WRITES-01: the sealed map writes nothing that did not change — a value set again, a channel whose posts did not move — and the comment positions keep the newest 2,000', () => {
    const stamps: string[] = [];
    const storage = lift({
      walletLocal: { values: new Map(), stamps: new Map() }, plathoLocalDataClearing: false,
      stampWalletLocalKey: (key: string) => stamps.push(key), noteWalletLocalChanged: () => {},
    }, [fn('function walletLocalStorage() {')], 'walletLocalStorage()');
    storage.setItem('feed', 'A');
    storage.setItem('feed', 'A');
    expect(stamps, 'MEASURED before: the same 2.9 MB re-sealed after every pass, ~300 MB an hour').toEqual(['feed']);
    storage.setItem('feed', 'B');
    expect(stamps).toEqual(['feed', 'feed']);
    const unchanged = lift({}, [fn('function publicFeedPostsUnchanged(held, next) {')], 'publicFeedPostsUnchanged');
    const posts = [{ id: 'p1', text: 'one' }, { id: 'p2', text: 'two' }];
    expect(unchanged(posts, posts.map((post) => ({ ...post })))).toBe(true);
    expect(unchanged(posts, [posts[0], { ...posts[1], text: 'edited' }])).toBe(false);
    expect(unchanged(posts, posts.slice(0, 1))).toBe(false);
    expect(unchanged(undefined, [])).toBe(true);
    const shards = code(fn('async function syncPublicChannelFromShards('));
    expect(shards.indexOf('if (publicFeedPostsUnchanged(cachedFeed?.posts, withPending)) continue;'), 'a channel that did not move is not stamped again')
      .toBeGreaterThan(shards.indexOf('publicSyncInvalidationEpoch !== invalidationEpochAtStart'));
    expect(shards.indexOf('if (publicFeedPostsUnchanged(cachedFeed?.posts, withPending)) continue;')).toBeLessThan(shards.indexOf('publicChannelFeedCache = {'));
    const keep = lift({ PUBLIC_COMMENT_READ_CURSORS_MAX: 3 }, [fn('function withCommentReadCursor(cursors, postKey, value) {')], 'withCommentReadCursor');
    let cursors: any = {};
    for (const key of ['a', 'b', 'c', 'd']) cursors = keep(cursors, key, `${key}-mark`);
    expect(Object.keys(cursors), 'MEASURED before: one for every thread ever opened — past ~12,000 every later write refused').toEqual(['b', 'c', 'd']);
    cursors = keep(cursors, 'b', 'b-later');
    expect(Object.entries(cursors), 'the one just moved is the newest').toEqual([['c', 'c-mark'], ['d', 'd-mark'], ['b', 'b-later']]);
    expect(line('const PUBLIC_COMMENT_READ_CURSORS_MAX = ')).toContain('2_000');
  });
});

describe('R16 — what the person sees [C1-C5 / F4-1, F4-2, F4-3, F2-6]', () => {
  const node = (tag: string): any => {
    const el: any = { tag, children: [] as any[], listeners: {} as Record<string, any>, dataset: {}, className: '', textContent: '', type: '', disabled: false, clicks: 0 };
    el.append = (...items: any[]) => { el.children.push(...items); };
    el.replaceChildren = (...items: any[]) => { el.children = [...items]; };
    el.addEventListener = (type: string, run: any) => { el.listeners[type] = run; };
    el.click = () => { el.clicks += 1; };
    return el;
  };
  const doc = { createElement: (tag: string) => node(tag) };
  const textOf = (el: any): string[] => [el.textContent, ...(el.children ?? []).flatMap((child: any) => (typeof child === 'object' ? textOf(child) : [String(child)]))].filter(Boolean);

  it('R16-LOCKED-01: locked, Subscriptions says where the follows are, with the unlock as a button; the composers say "Unlock" and offer it; a contact waits for the unlock', () => {
    const unlockButton = node('button');
    const make = (locked: boolean) => lift({
      t: (key: string) => key, document: doc, walletLockedOnDevice: () => locked, unlockWalletButton: unlockButton,
      publicFeed: node('section'), publicChannelSearchQuery: '', publicItemVisibleUnderModeration: () => true, requestAnimationFrame: () => 0,
      updatePublicJumpDownVisibility: () => {}, publicSyncPhase: 'synced', renderPublicEmpty: (title: string) => { throw new Error(`the old card: ${title}`); },
      publicFeedRetryButton: () => node('button'),
    }, [fn('function walletNeededReason() {'), fn('function walletUnlockAction() {'), fn('function buildPublicAllFeedNote('), fn('function publicLockedCard('),
      fn('function renderPublicFeed(')], '{ renderPublicFeed, publicFeed, walletNeededReason, walletUnlockAction }');
    const locked = make(true);
    locked.renderPublicFeed([]);
    const card = locked.publicFeed.children[0];
    expect(textOf(card), 'MEASURED before: "No public posts — Follow a channel or publish the first post", twice false')
      .toEqual(['public.followingLockedTitle', 'public.followingLockedHint', 'wallet.unlock']);
    card.children.at(-1).listeners.click();
    expect(unlockButton.clicks, 'the unlock, as a button').toBe(1);
    expect(locked.walletNeededReason(), 'MEASURED before: "Wallet required" to a person whose wallet was one password away').toBe('chat.unlockToSend');
    expect(locked.walletUnlockAction()?.label).toBe('wallet.unlock');
    const open = make(false);
    expect(open.walletNeededReason(), 'no wallet stored: it is required').toBe('common.walletRequired');
    expect(open.walletUnlockAction(), 'nothing to unlock').toBeNull();
    expect(code(fn('function privateSendBlockReason('))).toContain('if (!plathoWallet) return walletNeededReason();');
    expect(code(fn('function publicComposerBlockReason() {'))).toContain('if (!plathoWallet) return walletNeededReason();');
    expect(code(fn('function composerCostPrecondition('))).toContain('const text = walletNeededReason(); return { text, state: \'short\', parts, action: activationComposerAction(text) };');
    expect(code(fn('function activationComposerAction(reason) {'))).toContain("if (reason === t('chat.unlockToSend')) return walletUnlockAction();");
    const notices: string[] = [];
    const dialog = node('dialog');
    dialog.hidden = true;
    dialog.classList = { remove() {} };
    const openNew = lift({ t: (key: string) => key, newChatDialog: dialog, recipientInput: node('input'), recipientHint: node('p'), recipientLocalLabel: null,
      walletUnlockAction: () => ({ label: 'wallet.unlock', run: () => unlockButton.click() }), showAppNotice: (text: string) => notices.push(text),
      dialogReturnFocusTarget: () => null, requestAnimationFrame: () => 0, focusComposerField: () => {} },
    [fn('function openNewChatDialog() {')], 'openNewChatDialog', 'let newChatReturnFocus = null;');
    openNew();
    expect([dialog.hidden, notices, unlockButton.clicks], 'MEASURED before: a dead conversation, and a toast about subscriptions').toEqual([true, ['chat.unlockToAddContact'], 2]);
    const all = code(fn('function renderPublicDiscovery('));
    expect(all).toContain('const working = !locked && allSectionLoading({ loading });');
    expect(all).toContain("build: () => publicLockedCard(t('public.allLockedTitle'), '')");
    const article = code(fn('function appendPublicItemActions(article, item, options = {}) {'));
    expect(article).toContain('const followsKnown = !walletLockedOnDevice() && options.headerFollows !== true;');
    expect(article).toContain('if (followsKnown && !isOwnPost && isPublicChannelSubscribed(item.channelId)) {');
    expect(article).toContain('} else if (followsKnown && options.offerFollow === true && !isOwnPost && authorWallet) {');
  });

  it('R16-SYNCWORD-01: a visitor\'s loop is not cleared at boot, a locked wallet\'s waits for its unlock, and the corner says "Synced" only after a pass', () => {
    const boot = code(fn('async function bootCrypto() {'));
    expect(boot, 'MEASURED before: cleared 5 ms after it was armed, and nothing armed it again').toContain('if (hasStoredWallet) clearMessageAutoSyncTimer();');
    expect(boot).toContain('else scheduleMessageAutoSync(2_000);');
    const indicators = [node('button')];
    const corner = lift({
      isGlobalSyncActive: () => false, globalSyncIndicators: indicators, t: (key: string) => key, publicSyncPhase: 'idle', messageAutoSyncPhase: 'idle',
      messageAutoSyncFailed: false, messageAutoSyncLastErrorLabel: null, allSectionStaleOnScreen: () => false, globalThis: {},
      setAttribute: () => {},
    }, [fn('function refreshGlobalSyncIndicator() {')], '{ refresh: refreshGlobalSyncIndicator, settle: () => { syncPassSettledThisSession = true; } }',
    'let globalSyncSpinnerSince = 0; let globalSyncSpinnerHeldBy = null; let syncPassSettledThisSession = false; let pendingServiceWorkerAppShellReload = false;');
    indicators[0].setAttribute = (name: string, value: string) => { indicators[0][name] = value; };
    corner.refresh();
    expect([indicators[0].title, indicators[0].dataset.synced], 'MEASURED before: "Synced - tap to sync now" over no pass at all').toEqual(['sync.notSyncedYet', 'false']);
    corner.settle();
    corner.refresh();
    expect([indicators[0].title, indicators[0].dataset.synced]).toEqual(['sync.syncNow', 'true']);
    expect(code(fn('function setPublicSyncPhase(phase) {'))).toContain("if (phase === 'synced' || phase === 'delayed') syncPassSettledThisSession = true;");
  });

  it('R16-ACTIVATE-01: an Activate pressed on a composer\'s line says its failure there, the line says "Activating…" while one is on its way, and the button is a 24-px target', async () => {
    const vaultDraftStatus = node('p');
    const privateLine = node('p');
    const held: any[] = [];
    const run = lift({
      t: (key: string) => key, registerVaultKeysButton: node('button'), vaultDraftStatus, privateComposerCostStatus: privateLine, publicComposerCostStatus: node('p'),
      plathoWallet: { address: 'W' }, activeThreadId: 'thread-1', publicComposerHoldScope: () => 'post',
      submitVaultRegisterMessagingKeys: async () => { throw new Error('read failed'); }, noteTonRpcRateLimit: () => false, gramShortfallText: () => null,
      holdStatusText: (line: any, text: string, options: any) => held.push([line === privateLine ? 'composer' : 'row', text, options.scope]),
      refreshMessagingControls: () => {}, refreshComposerCostStatus: () => {}, console: { error() {} },
      speakToScreenReader: () => {}, document: doc, showReceiveWalletTonDialog: () => {},
      appendLineButton: (line: any, button: any) => line.append(' ', button),
    }, [fn('async function runAccountActivation({ line = null } = {}) {')], 'runAccountActivation');
    await run({ line: privateLine });
    expect(held, 'MEASURED before: 30 s of silence where it was pressed, the reason on the Wallet tab').toEqual([
      ['row', 'vault.activationBlocked', 'W'], ['composer', 'send.activationFailed', 'thread-1'],
    ]);
    expect(code(fn('function privateSendBlockReason('))).toContain("if (accountActivationInFlight()) return t('send.activating');");
    expect(code(fn('function publicComposerBlockReason() {'))).toContain("if (accountActivationInFlight()) return t('send.activating');");
    const inFlight = lift({ plathoWallet: { address: 'W' }, plathoAccountActivationPending: false, plathoActivationInFlightForCurrentWallet: () => true },
      [fn('function accountActivationInFlight() {')], 'accountActivationInFlight');
    expect(inFlight(), 'one a reload found written down counts').toBe(true);
    const css = readFileSync('web/styles.css', 'utf8');
    const rule = css.slice(css.indexOf('.composer-cost-action {'), css.indexOf('}', css.indexOf('.composer-cost-action {')));
    expect(rule, 'MEASURED before: 139 x 18 px').toContain('min-height: 24px;');
  });

  it('R16-HIDDENSIG-01: a hide or an unhide changes both render signatures — the author\'s own card repaints with its badge, and its React bar goes', () => {
    const feedSig = lift({ currentLocale: () => 'en', feedTimestampMode: () => 'datetime', isUnreadPublicItem: () => false, publicFeedExpandedPosts: new Set(),
      publishStateMeta: () => '', publicAvatarUrlForWallet: () => '', isPublicChannelSubscribed: () => false, walletLockedOnDevice: () => false },
    [fn('function publicFeedItemRenderSignature(')], 'publicFeedItemRenderSignature');
    const post = { id: 'p1', meta: [], blocks: [] };
    expect(feedSig({ ...post, hidden: true }, new Map()), 'MEASURED before: unchanged by a hide — the card reused, no badge, a live bar').not.toBe(feedSig(post, new Map()));
    const commentSig = lift({ currentLocale: () => 'en', feedTimestampMode: () => 'datetime', publishStateMeta: () => '', publicAvatarUrlForWallet: () => '',
      publicItemContentSignature: () => 'c', plathoWallet: null }, [fn('function publicCommentRenderSignature(')], 'publicCommentRenderSignature');
    const comment = { id: 'c1', author: 'a', createdAt: '1', entryId: 'e' };
    expect(commentSig({ ...comment, hidden: true }, new Map())).not.toBe(commentSig(comment, new Map()));
    const lockedSig = lift({ currentLocale: () => 'en', feedTimestampMode: () => 'datetime', isUnreadPublicItem: () => false, publicFeedExpandedPosts: new Set(),
      publishStateMeta: () => '', publicAvatarUrlForWallet: () => '', isPublicChannelSubscribed: () => false, walletLockedOnDevice: () => true },
    [fn('function publicFeedItemRenderSignature(')], 'publicFeedItemRenderSignature');
    expect(lockedSig(post, new Map()), 'the follow buttons come and go with the lock').not.toBe(feedSig(post, new Map()));
  });
});

describe('R16 — a hidden original inside a repost [C4 / F2-4]', () => {
  it('R16-REPOST-01: the original of a repost, kept under a channel nothing reads again, is believed half an hour — then the chain is asked, and the hide reaches the repost', async () => {
    const P = { entryId: '20733.0.5', bodyHash: `0x${'ab'.repeat(32)}`, authorWallet: `0:${'aa'.repeat(32)}`, hidden: false, text: 'the original' };
    const asked: string[] = [];
    const make = (syncedAt: string, followed: boolean) => lift({
      publicChannelFeedCache: { 'ch-a': { feed: { posts: [P] }, syncedAt } },
      feedSourcePublicChannels: () => (followed ? [{ id: 'ch-a' }] : [{ id: 'ch-c' }]),
      findCachedPublicPostByEntryId: () => P, findAllFeedPostByEntryId: () => null,
      normalizeBodyHashHex: (h: string) => String(h ?? '').replace(/^0x/, '').toLowerCase(), rawWalletAddress: (w: string) => w,
      fetchSharedPostFromChain: async (entry: string) => { asked.push(entry); return { ...P, hidden: true }; },
      sharedPostChainReads: new Map(), SHARED_POST_CHAIN_READ_LIMIT: 64, SHARED_POST_READ_RETRY_MS: 1_000, noteTonRpcRateLimit: () => false, console,
    }, [fn('function sharedOriginalCopyCurrent(post, now = Date.now()) {'), fn('function resolveSharedPostOriginal(')], 'resolveSharedPostOriginal',
    'const SHARED_ORIGINAL_FRESH_MS = 30 * 60_000;');
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const stale = await make(twoHoursAgo, false)(P.entryId, P.bodyHash, P.authorWallet);
    expect([stale.hidden, asked], 'MEASURED before: "resolved from the device cache; hidden bit seen: false; the embed draws THE POST"').toEqual([true, [P.entryId]]);
    expect((await make(new Date().toISOString(), false)(P.entryId, P.bodyHash, P.authorWallet)).hidden, 'read moments ago: believed').toBe(false);
    expect((await make(twoHoursAgo, true)(P.entryId, P.bodyHash, P.authorWallet)).hidden, 'a followed channel\'s hides come with every pass').toBe(false);
    expect(asked, 'the chain asked once').toHaveLength(1);
  });
});

describe('R16 — the words and the small doors [C6 / F4-4..F4-10, F2-11, F3-6]', () => {
  const node = (tag: string): any => {
    const el: any = { tag, children: [] as any[], listeners: {} as Record<string, any>, dataset: {}, className: '', textContent: '', disabled: false, title: '' };
    el.append = (...items: any[]) => { el.children.push(...items); };
    el.addEventListener = (type: string, run: any) => { el.listeners[type] = run; };
    el.setAttribute = (name: string, value: string) => { el[name] = value; };
    return el;
  };
  const doc = { createElement: (tag: string) => node(tag) };

  it('R16-WORDS-01: a step a dialog names is a button; Send GRAM, the queue, the entry fee and a row\'s flag speak to the person', async () => {
    const closed: any[] = [];
    const taken: string[] = [];
    const append = lift({ document: doc, closeActionDialog: (result: any) => closed.push(result), console }, [fn('function appendDialogActionButton(node, action) {')], 'appendDialogActionButton');
    const hint = node('p');
    append(hint, { label: 'wallet.receiveGram', run: () => taken.push('receive') });
    const button = hint.children.at(-1);
    expect(button.textContent, 'MEASURED before: "Receive GRAM first", a plate over a submit that could not succeed').toBe('wallet.receiveGram');
    button.listeners.click();
    await delay(0);
    expect([closed, taken]).toEqual([[null], ['receive']]);
    expect(code(fn('async function confirmPlathoAccountActivation(user, { needsKeyBackup = true } = {}) {'))).toContain("hintAction = { label: t('wallet.receiveGram'), run: () => showReceiveWalletTonDialog() };");
    const parse = lift({ t: (key: string, vars: any) => `${key}:${JSON.stringify(vars)}` }, [fn('function parseDecimalAmount(input, decimals, symbol) {')], 'parseDecimalAmount');
    expect(() => parse('abc', 9, 'GRAM'), 'MEASURED before: "GRAM amount must be a positive decimal…" in every language').toThrow('wallet.amountFormatInvalid:{"symbol":"GRAM","decimals":9}');
    expect(() => parse('0', 9, 'GRAM')).toThrow('wallet.amountNotPositive');
    expect(parse('1.5', 9, 'GRAM')).toBe(1_500_000_000n);
    expect(code(app)).toContain("lines.push({ label: t('wallet.recipient'), value: t('wallet.recipientNotBasechain') });");
    const label = lift({ t: (key: string, vars: any) => (vars?.count !== undefined ? `${key}(${vars.count})` : key), tPlural: (key: string, n: number) => `${n} ${key}`, currentLocale: () => 'en' },
      [fn('function moderationKindLabel(kind) {'), fn('function moderationRowLabel(row) {')], 'moderationRowLabel');
    const text = label({ target: { kind: 0, epochTag: 20733, shardSeq: 0, entryId: 5, generation: 18 }, count: 3, unreviewed: 2, lastAt: 1_791_200_000 });
    expect(text, 'MEASURED before: "Post 20733.0.5.18 — 3 reports · 2 new"').not.toContain('20733.0.5');
    expect(text).toContain('moderation.kindPost · ');
    expect(text).toContain('3 moderation.queueReports · moderation.queueNew(2)');
    const row = node('div');
    const flag = lift({ document: doc, t: (key: string) => key, moderationSupported: () => true, publicPostDetailItem: { id: 'p' }, isOwnPublicAuthor: () => false,
      publicItemAuthor: () => 'A', publicItemReportable: () => true, plathoWallet: null, rowActionsCluster: () => row, openReportDialog: () => {} },
    [fn('function appendRowReportButton(row, comment) {')], 'appendRowReportButton');
    flag(row, { id: 'c' });
    expect([row.children[0].disabled, row.children[0].title], 'MEASURED before: a visitor read the prices and picked a reason before being told').toEqual([true, 'moderation.walletRequired']);
    const dialog = code(fn('async function setGroupEntryFeeDialog(groupId, record) {'));
    expect(dialog, 'MEASURED before: "1,000" saved as 1 ATH, seen only on the card afterwards').toContain("value: `${formatDecimalAmount(parseDecimalAmount(text, 9, 'ATH'), 9, 9)} ATH`");
    expect(dialog).toContain("return [{ label: t('group.entryFeeLabel'), value: t('group.entryFeeNone') }];");
    expect(code(fn('function renderPublicDiscovery('))).toContain("else line.append(' ', publicFeedRetryButton(() => { void requestPublicAllFeedPass({ force: true }); }));");
    expect(code(fn('async function openVaultFloatDialog() {'))).toContain('await readVaultAtPress(vaultFloatStatus);');
    expect(code(fn('async function openStakeAthDialog() {'))).toContain("snapshot?.assumed && !snapshot.stale ? t('profile.statusChecking') : t('profile.vaultReadUnanswered')");
    expect(code(app)).toContain('  refreshComposerPublishPolicy();\n  updatePublicCommentsToggleUi();');
  });

  it('R16-WORDS-02: the strings — no internal names, one word for one thing, the download\'s whole way, a typo gone', async () => {
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
    const S: any = I18N_STRINGS;
    for (const key of ['common.rpcBusyRetrying', 'chat.rpcBusy', 'sync.rpcBusy', 'username.rpcVerificationUnavailable']) {
      for (const locale of Object.keys(S)) expect(S[locale][key], `${locale} ${key}: MEASURED before: "RPC busy"`).not.toMatch(/RPC/);
    }
    expect(S.en['dialog.telegramDownloadHint'], 'MEASURED before: a browser with no wallet, and no word of it').toContain('import this wallet there');
    expect(S.en['public.feedUnavailableHint'], 'the card has its Retry').not.toMatch(/sync button/);
    expect(S.en['public.allFeedStale']).not.toMatch(/sync button/);
    expect(S.zh['quickstart.backupNeedsOne'], 'MEASURED before: \u62c4\u5199').toContain('\u6284\u5199');
    expect(JSON.stringify(S.es), 'MEASURED before: "cartera" in 12 strings beside "billetera" in 60').not.toMatch(/cartera/i);
    for (const locale of ['es', 'pt', 'de']) expect(S[locale]['profile.vaultFloatHint'], locale).not.toMatch(/stake/i);
    expect(S.ja['dialog.openInBrowser']).toBe('\u30d6\u30e9\u30a6\u30b6\u3067\u958b\u304f');
    expect(S.id['dialog.downloadInBrowserTitle']).toBe('Unduh di peramban');
    for (const locale of Object.keys(S)) expect(S[locale]['profile.stakeFootBand'], `${locale}: one grouping in one sentence`).toContain('{threshold}');
    expect(code(app)).toContain("threshold: groupDecimalText('1000')");
    expect(S.en['wallet.seedStoreSummary']).not.toMatch(/PWA/);
    expect(S.en['wallet.recoveryPhraseEncryptedSummary']).not.toMatch(/WebCrypto/);
    expect(S.en['wallet.importWalletSummary']).not.toMatch(/protocol transactions/);
    expect(S.en['quickstart.keyFilePlateNote'], 'told to everyone, though only a person who added one has one').not.toMatch(/TON Center/);
    expect(S.en['vault.activationLowBalanceFeedback'], 'the step is the button beside it').not.toMatch(/Receive GRAM first/);
  });
});

describe('R16 — what the device keeps and draws [D1-D4 / F5-1, F5-2, F5-3, F5-I2]', () => {
  it('R16-PRIVACY-02: the lock takes the reply and share being drafted and the maps keyed by the same wallets; a received picture that is not a WebP is not drawn; no plain replay database', async () => {
    const lock = code(fn("function lockPlathoWallet(status = t('wallet.locked'), options = {}) {"));
    for (const line of ['setPrivateReplyDraft(null);', 'setPrivateShareDraft(null);', 'publicChannelAvatarUrlByWallet.clear();', 'publicAvatarFreshThisSession.clear();',
      'telegramGiftListCache.clear();', 'verifiedPlathoUsernameOwnerCache.clear();']) {
      expect(lock, `MEASURED before: after the lock the strip still read "Alice: meet me at five…", the followed wallets in memory — ${line}`).toContain(line);
    }
    const draw = lift({ bytesToBase64: (b: Uint8Array) => Buffer.from(b).toString('base64') }, [fn('function webpCanvasSize(bytes) {'), fn("function bytesToImageDataUrl(bytes, mime = 'image/webp') {")],
      'bytesToImageDataUrl', `const DRAWN_IMAGE_MAX_SIDE = 4096; const DRAWN_IMAGE_MAX_PIXELS = 16 * 1024 * 1024; ${line('const EMPTY_WEBP_DATA_URL = ')}`);
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x3f, 0xff, 0, 0, 0x3f, 0xff, 1, 0, 0, 0, 0, 0, 0, 0]);
    const empty = line('const EMPTY_WEBP_DATA_URL = ').match(/'([^']+)'/)![1];
    expect(draw(png, 'image/webp'), 'MEASURED before: a 16383² PNG handed over as WebP — +347 MB of the renderer').toBe(empty);
    const webp = new Uint8Array(30);
    webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    webp.set([...'WEBPVP8L'].map((c) => c.charCodeAt(0)), 8);
    webp[20] = 0x2f;
    expect(draw(webp, 'image/webp'), 'a WebP within the bounds is drawn').toMatch(/^data:image\/webp;base64,UklGR/);
    const deleted: string[] = [];
    const boot = lift({ createMemoryReplayStore: () => ({ memory: true }), plathoWallet: { address: 'W' }, currentReplayDbName: () => 'platho-local-security-v1.W',
      deleteIndexedDbDatabase: async (name: string) => { deleted.push(name); return true; } },
    [fn('async function bootReplayStore() {')], '{ boot: bootReplayStore, store: () => localReplayStore }', 'let localReplayStore = null;');
    await boot.boot();
    expect([boot.store(), deleted], 'MEASURED before: opened in clear at every unlock under the wallet\'s name, read by nothing').toEqual([{ memory: true }, ['platho-local-security-v1.W']]);
    expect(app).not.toContain('createIndexedDbReplayStore');
  });
});

describe('R16 — the rest [E / F1-4, F1-9, F2-5, F2-7, F2-9, F2-10, F3-4]', () => {
  it('R16-REST-01: one re-read mark for one interruption; a verdict judged on the chain\'s year and never on an old standing; an outdated vault reading priced as the send pays it', async () => {
    const store = new Map<string, string>([['attempts', '1'], ['recover', '1791203600000']]);
    const note = lift({ globalThis: { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } }, document: {} },
      RESECURE_ATTEMPTS_KEY: 'attempts', RESECURE_RECOVER_KEY: 'recover', resecureWasInterrupted: () => false, resecureInterruptedHeldWallet: () => false, clearResecureCookie: () => {} },
    [fn('function noteInterruptedResecure() {')], 'noteInterruptedResecure');
    note();
    expect(store.get('recover'), 'MEASURED before: a new mark at every start — five starts, five drops, never settled').toBe('1791203600000');
    store.delete('recover');
    note();
    expect(store.get('recover'), 'a mark when there is none').toMatch(/^\d+$/);
    const standingOf = (read: number) => lift({ sanctionShardAddressFor: async () => 'S', walletHashOf: () => 1n, persistModerationStandings: () => {}, t: (k: string) => k },
      [fn('async function moderationWalletStanding(runtime, wallet) {')], 'moderationWalletStanding')({
      sanctions: { lookup: async () => ({ asked: 1, read, changed: false }), get: () => ({ exists: true, warnings: 2 }) }, gateAddress: 'G' }, 'W');
    await expect(standingOf(0), 'MEASURED before: "forced read failed; the verdict is judged on: {…warnings: 2…}"').rejects.toThrow('moderation.standingUnreadable');
    await expect(standingOf(1)).resolves.toMatchObject({ standing: { warnings: 2 } });
    expect(code(app)).toContain('const standing = sanctionStandingForVerdict(stored, chainNowSec());');
    const refreshed: string[] = [];
    const routes = lift({ vaultSupported: () => true, feeVaultState: { wallet: 'W', address: 'V', snapshot: { state: 'live' } }, plathoWallet: { address: 'W' },
      VAULT_LIVE: 'live', vaultSnapshotOutdated: () => true, composerChainFact: (name: string) => refreshed.push(name), refreshFeeVaultState: () => {} },
    [fn('function composerPublicRoutes(kind, parts, first, generation, nowUnix) {')], 'composerPublicRoutes');
    expect(routes(0, [{ bytes: 100 }], true, 18, 1_791_200_000).routes, 'MEASURED before: the vault door priced, the direct door paid when the re-read failed').toEqual(['direct']);
    expect(refreshed).toEqual(['vault']);
    expect(code(fn('async function buildPublicGroupRuntime() {')), 'MEASURED: 3 days slow — foundedEra 690 against the chain\'s 691, "say" refused PRICES_MOVED').toContain('now: chainNowSec,');
  });

  it('R16-REST-02: an epoch-bound write waits for the chain\'s clock once; a view-tag collision is passed for good, and the cross-build retry backs off', async () => {
    let release: any = null;
    const reads: string[] = [];
    const api = lift({ walletClockInDoubt: () => false,
      walletChainClockOffsetMs: () => 0,
      plathoWallet: { address: 'W' }, refreshWalletChainClock: () => { reads.push('read'); return new Promise((resolve) => { release = () => { api.know(); resolve(undefined); }; }); },
      setTimeout: (run: any) => { void run; return 0; } },
    [fn('async function awaitWalletChainClock({ timeoutMs = 4_000, requireSettled = false } = {}) {')], '{ wait: awaitWalletChainClock, know: () => { walletChainClockKnown = true; } }',
    'let walletChainClockKnown = false; let walletChainClockRead = null; let walletChainClockReadAt = -Infinity;');
    let waited = false;
    const pending = api.wait().then(() => { waited = true; });
    await delay(0);
    expect(waited, 'MEASURED before: a day fast, the write signed into a shard the ±1 gate refuses').toBe(false);
    release();
    await pending;
    expect(waited).toBe(true);
    await api.wait();
    expect(reads, 'known: not asked again').toEqual(['read']);
    const conv = code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    expect(conv, 'the CONV and INTRO writes wait for it').toContain('await awaitWalletChainClock({ requireSettled: true });');
    expect(conv.indexOf('await awaitWalletChainClock({ requireSettled: true });')).toBeGreaterThan(conv.indexOf('return { rebroadcast: true };'));
    expect(code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'))).toContain('await awaitWalletChainClock({ requireSettled: true });');
    const room = code(fn('async function sendGroupMessageFromComposer(thread, text) {'));
    expect(room, 'and a room\'s, before its runtime picks the day').toContain('await awaitWalletChainClock({ requireSettled: true, timeoutMs: 20_000 });');
    expect(room.indexOf('await awaitWalletChainClock({ requireSettled: true, timeoutMs: 20_000 });')).toBeLessThan(room.indexOf('const sent = await runtime.say(groupId, text, { onSealed: stampEcho });'));
    const handler = code(readFileSync('web/intro-receive-handler.mjs', 'utf8'));
    expect(handler, 'MEASURED before: re-fetched at every build — ~274 requests a deploy').toContain("try { error.code = notMine ? 'INTRO_NOT_MINE' : 'INTRO_UNOPENABLE'; }");
    const runner = code(readFileSync('web/intro-scan-runner.mjs', 'utf8'));
    expect(runner).toContain("if (error?.code === 'INTRO_NOT_MINE') {\n            delivered.set(key, hit.epoch);");
    expect(runner).toContain('if (pending && passIndex < pending.notBeforePass) { delivered.set(ledgerKey, ledgerEpoch); continue; }');
  });
});
