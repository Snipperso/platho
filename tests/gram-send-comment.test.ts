import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';
import { Cell } from '@ton/core';
import { TRANSFER_COMMENT_MAX_BYTES, buildJettonTransferBody, buildTextCommentBody } from '../web/wallet-transfers.mjs';
import { serializeBoc, tonCell } from '../web/pwa-contract-transactions.mjs';
import { walletSendSizeClassForPayloadBytes } from '../web/wallet-send-fee.mjs';
import { FINAL_COST_REFERENCE_PRICES, walletTransferFeeFinalCost } from '../web/publish-final-cost.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const tKey = (key: string) => key;
const commentOf = (base64: string) => {
  const slice = Cell.fromBase64(base64).beginParse();
  const op = slice.loadUint(32);
  return { op, text: slice.loadBuffer(slice.remainingBits / 8).toString('utf8') };
};

describe('a GRAM send carries a comment', () => {
  it('GRAMMEMO-01: the text comment — op 0 and the UTF-8 bytes in one cell; none for nothing; refused past the limit; the token send still rides it', () => {
    expect(buildTextCommentBody('')).toBeNull();
    expect(buildTextCommentBody(undefined)).toBeNull();
    const memo = commentOf(tonCell.bytesToBase64(serializeBoc(buildTextCommentBody('MEMO 42 — ü€'))));
    expect(memo).toEqual({ op: 0, text: 'MEMO 42 — ü€' });
    expect(() => buildTextCommentBody('x'.repeat(TRANSFER_COMMENT_MAX_BYTES + 1))).toThrow(/too long/);
    expect(buildTextCommentBody('x'.repeat(TRANSFER_COMMENT_MAX_BYTES))).not.toBeNull();
    const token = Cell.fromBase64(tonCell.bytesToBase64(serializeBoc(buildJettonTransferBody({ queryId: 1n, amount: 5n,
      destination: `0:${'11'.repeat(32)}`, responseDestination: `0:${'22'.repeat(32)}`, comment: 'hi' }))));
    const forward = token.refs[token.refs.length - 1].beginParse();
    expect([forward.loadUint(32), forward.loadBuffer(2).toString('utf8')]).toEqual([0, 'hi']);
  });

  it('GRAMMEMO-02: what a comment adds to the cost — the sandbox measurement of the app\'s own bytes, 1 nanoton over and never under', () => {
    expect(walletTransferFeeFinalCost()).toBe(513_003n);
    expect(walletTransferFeeFinalCost({ commentBytes: 0 })).toBe(513_003n);
    const measured: Array<[number, bigint]> = [[1, 531_670n], [8, 539_136n], [32, 564_736n], [60, 594_604n], [100, 637_270n], [120, 658_604n]];
    for (const [bytes, fee] of measured) expect(walletTransferFeeFinalCost({ commentBytes: bytes }) - fee, `${bytes} bytes`).toBe(1n);
    const twice = { gas: { gasPrice: FINAL_COST_REFERENCE_PRICES.gasPrice }, fwd: { bit: FINAL_COST_REFERENCE_PRICES.bit * 2n } };
    const added = walletTransferFeeFinalCost({ commentBytes: 120 }) - walletTransferFeeFinalCost();
    expect(walletTransferFeeFinalCost({ commentBytes: 120, prices: twice }) - walletTransferFeeFinalCost({ prices: twice })).toBe(added * 2n);
  });

  const submitWith = (details: any) => {
    const calls: any = { sent: [], reserves: [], asserted: [] };
    const api = lift({
      requestWalletTonTransferDetails: async () => details,
      setVaultStatus: () => {}, transferRecipientAccountStatus: async () => 'active', TRANSFER_BOUNCE_ACCOUNT_STATUSES: new Set(['active', 'frozen']),
      createWalletTransaction: (m: any) => ({ messages: [m] }),
      assertWalletGramAtLeast: async (need: bigint) => { calls.asserted.push(need); },
      walletSendFeeReserveNanotons: (classes: number[] = []) => { calls.reserves.push(classes); return 7n + BigInt(classes.length) * 1000n; },
      buildTextCommentBody, serializeBoc, tonCell, walletSendSizeClassForPayloadBytes,
      requirePlathoWallet: () => ({ address: 'W' }), requireSameWallet: (signer: any) => signer, plathoWallet: { address: 'W' },
      sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
      sendPlathoWalletTransaction: async (_w: any, tx: any, options: any) => { calls.sent.push({ tx, options }); return { outcome: 'consumed' }; },
      broadcastMayHaveLanded: () => false, globalThis: {}, flashWalletIdentityStatus: () => {}, t: tKey, queueVaultPostTransactionRefresh: () => {},
      setText: () => {}, sendWalletTonStatus: null, watchWalletTonTransfer: () => {}, speakToScreenReader: () => {},
    }, [fn('function transferBounceForStatus(status) {'), fn('async function submitWalletTonTransfer(hold = null) {')], 'submitWalletTonTransfer');
    return { api, calls };
  };

  it('GRAMMEMO-03: the comment is the signed message\'s body, and what the balance must hold is priced by it; none, and the message is bare', async () => {
    const memo = submitWith({ recipient: `0:${'77'.repeat(32)}`, amount: 50n, comment: '100500 deposit' });
    await memo.api();
    const message = memo.calls.sent[0].tx.messages[0];
    expect(commentOf(message.payload)).toEqual({ op: 0, text: '100500 deposit' });
    expect(memo.calls.reserves).toEqual([[1]]);
    expect(memo.calls.asserted).toEqual([1057n]);
    expect(memo.calls.sent[0].options.requiredBalance).toBe(1057n);
    const bare = submitWith({ recipient: `0:${'77'.repeat(32)}`, amount: 50n });
    await bare.api();
    expect('payload' in bare.calls.sent[0].tx.messages[0], 'no body for no comment').toBe(false);
    expect(bare.calls.reserves).toEqual([[]]);
    expect(bare.calls.sent[0].options.requiredBalance).toBe(57n);
  });

  it('GRAMMEMO-04: the dialog asks for it, optional; says the cost with it; refuses one past the limit; and hands it on trimmed', async () => {
    let dialog: any = null;
    const costs: any[] = [];
    const details = lift({
      requirePlathoWallet: () => ({ address: 'W', networkGlobalId: -239 }), walletAddressForCopy: () => 'W', shortAddress: (a: string) => a,
      openActionDialog: (config: any) => new Promise((resolve) => { dialog = { ...config, answer: resolve }; }), t: tKey, spendPasswordFields: () => [], spendPasswordRefusal: async () => '',
      parseRecipientIdentity: () => ({ ok: false }), parseTonAmountNanotons: (text: string) => BigInt(text),
      formatDecimalAmount: (v: bigint) => String(v), formatGramNanotonsUp: (v: bigint) => String(v), composerNetworkPrices: () => null,
      walletTransferFeeFinalCost: (options: any) => { costs.push(options); return 0n; }, walletSendFeeReserveNanotons: () => 0n,
      balanceNeededText: (v: bigint) => String(v),
      resolveTransferRecipient: async () => ({ wallet: `0:${'77'.repeat(32)}` }), transferRecipientRefusal: async () => '', transferRecipientError: () => 'x',
      walletCommentRefusal: (comment: string) => (new TextEncoder().encode(comment).length > TRANSFER_COMMENT_MAX_BYTES ? 'wallet.commentTooLong' : ''),
      requireBasechainAddress: (a: string) => a,
    }, [fn('async function requestWalletTonTransferDetails() {')], 'requestWalletTonTransferDetails');
    const pending = details();
    await Promise.resolve();
    const field = dialog.fields.find((one: any) => one.id === 'comment');
    expect(field).toMatchObject({ label: 'wallet.commentOptional', type: 'text', required: false });
    dialog.summary({ recipient: '', amount: '5', comment: '  ab  ' });
    expect(costs.at(-1)).toEqual({ prices: null, commentBytes: 2 });
    dialog.summary({ recipient: '', amount: '5' });
    expect(costs.at(-1)).toEqual({ prices: null, commentBytes: 0 });
    expect(await dialog.validateSubmit({ recipient: 'r', amount: '5', comment: 'x'.repeat(TRANSFER_COMMENT_MAX_BYTES + 1) })).toEqual({ ok: false, error: 'wallet.commentTooLong' });
    const ok = await dialog.validateSubmit({ recipient: 'r', amount: '5', comment: '  42  ' });
    expect(ok).toEqual({ ok: true, result: { recipient: `0:${'77'.repeat(32)}`, amount: '5', comment: '42' } });
    dialog.answer(ok.result);
    expect(await pending).toEqual({ recipient: `0:${'77'.repeat(32)}`, amount: 5n, comment: '42' });
  });
});
