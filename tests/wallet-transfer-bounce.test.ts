import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const constLine = (name: string) => {
  const match = app.match(new RegExp(`^const ${name} = .*$`, 'm'));
  if (!match) throw new Error(`${name} not found`);
  return match[0];
};
const RECIPIENT = `0:${'ab'.repeat(32)}`;

function build(getAccountState: any, hooks: { sendThrows?: any } = {}) {
  const calls: any = { reads: [], built: [], sent: [], flashes: [], vault: [] };
  const src = [
    constLine('TRANSFER_BOUNCE_ACCOUNT_STATUSES'), constLine('TRANSFER_NO_BOUNCE_ACCOUNT_STATUSES'),
    fn('async function transferRecipientAccountStatus(address) {'), fn('function transferBounceForStatus(status) {'), fn('async function submitWalletTonTransfer(hold = null) {'),
    'return { submitWalletTonTransfer, transferRecipientAccountStatus, transferBounceForStatus };',
  ].join('\n');
  const env: Record<string, any> = {
    globalThis: { plathoTonRpcTransport: getAccountState === null ? {} : { getAccountState: async (call: any, options: any) => { calls.reads.push({ call, options }); return getAccountState(call, options); } } },
    requestWalletTonTransferDetails: async () => ({ recipient: RECIPIENT, amount: 1_000_000_000n }),
    setVaultStatus: (status: string) => calls.vault.push(status),
    createWalletTransaction: (message: any) => { calls.built.push(message); return { messages: [message] }; },
    assertWalletGramAtLeast: async () => {},
    walletSendFeeReserveNanotons: () => 0n,
    sendPlathoWalletTransaction: async (_wallet: any, transaction: any) => { calls.sent.push(transaction); if (hooks.sendThrows) throw hooks.sendThrows; return { ok: true }; },
    requirePlathoWallet: () => ({ address: 'me' }),
    requireSameWallet: (signer: any) => signer,
    composerNetworkPrices: () => null,
    broadcastMayHaveLanded: (error: any) => typeof error?.builtBoc === 'string',
    flashWalletIdentityStatus: (key: string) => calls.flashes.push(key),
    t: (key: string) => key,
    queueVaultPostTransactionRefresh: () => {},
    setText: () => {}, sendWalletTonStatus: null,
    watchWalletTonTransfer: () => {},
    plathoWallet: { address: 'me' }, sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
    speakToScreenReader: () => {},
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, src)(...names.map((name) => env[name]));
  return { api, calls, env };
}

describe('GRAM transfer — the bounce flag', () => {
  it('TRANSFER-BOUNCE-01: an active recipient is sent to bounceable, and the read is one that waits out a rate-limit park', async () => {
    const { api, calls, env } = build(async () => ({ status: 'active', balance: '1' }));
    await api.submitWalletTonTransfer();
    expect(calls.reads).toHaveLength(1);
    expect(calls.reads[0].call).toEqual({ address: RECIPIENT });
    expect(calls.reads[0].options, 'a send is not dropped by a park; it waits').toMatchObject({ skipIfRateLimited: false, priority: 'critical' });
    expect(calls.built).toEqual([{ address: RECIPIENT, amount: '1000000000', bounce: true }]);
    expect(calls.sent).toHaveLength(1);
    expect(calls.flashes).toEqual(['wallet.gramTransferSending', 'wallet.gramTransferSubmitted']);
    expect(env.globalThis.plathoLastWalletTonTransfer).toMatchObject({ recipientStatus: 'active', message: { bounce: true } });
    expect(calls.vault[0], 'the reader is told what is happening first').toBe('reading the recipient account');
  });

  it('TRANSFER-BOUNCE-02: a frozen recipient is bounceable too — a message to it bounces unless it can be unfrozen', async () => {
    const { api, calls } = build(async () => ({ status: 'frozen' }));
    await api.submitWalletTonTransfer();
    expect(calls.built[0].bounce).toBe(true);
    expect(calls.flashes).toEqual(['wallet.gramTransferSending', 'wallet.gramTransferSubmitted']);
  });

  it('TRANSFER-BOUNCE-03: a recipient not yet deployed is sent to non-bounceable — the only form that arrives — and the sender is told', async () => {
    for (const answer of [{ status: 'uninit' }, { state: 'uninitialized' }, { result: { status: 'nonexist' } }, { account_state: 'nonexistent' }, { status: 'NonExist ' }]) {
      const { api, calls, env } = build(async () => answer);
      await api.submitWalletTonTransfer();
      expect(calls.built[0].bounce, JSON.stringify(answer)).toBe(false);
      expect(calls.sent).toHaveLength(1);
      expect(calls.flashes, 'the status line says the wallet is new, not that something failed').toEqual(['wallet.gramTransferSending', 'wallet.gramTransferRecipientNew']);
      expect(env.globalThis.plathoLastWalletTonTransfer.message.bounce).toBe(false);
    }
  });

  it('TRANSFER-BOUNCE-04: no answer, no transfer — a read that fails or a status nobody recognises stops the send before anything is built', async () => {
    const failing = build(async () => { throw new Error('429'); });
    await expect(failing.api.submitWalletTonTransfer()).rejects.toThrow(/429/);
    expect(failing.calls.built).toEqual([]);
    expect(failing.calls.sent).toEqual([]);
    expect(failing.calls.flashes).toEqual([]);
    for (const answer of [{ status: 'unknown' }, {}, { status: null }, 'active']) {
      const odd = build(async () => answer);
      await expect(odd.api.submitWalletTonTransfer(), JSON.stringify(answer)).rejects.toThrow(/could not be read/);
      expect(odd.calls.sent).toEqual([]);
    }
    const noTransport = build(null);
    await expect(noTransport.api.submitWalletTonTransfer()).rejects.toThrow(/account state is required/);
    expect(noTransport.calls.sent).toEqual([]);
  });

  it('TRANSFER-BOUNCE-05: an ambiguous broadcast keeps the recipient state in the diagnostic and reports by the flag that was sent', async () => {
    const error: any = new Error('lost mid-flight');
    error.builtBoc = 'te6ccg';
    const { api, calls, env } = build(async () => ({ status: 'uninit' }), { sendThrows: error });
    expect(await api.submitWalletTonTransfer()).toBeNull();
    expect(env.globalThis.plathoLastWalletTonTransfer).toMatchObject({ ambiguous: true, boc: 'te6ccg', recipientStatus: 'uninit', message: { bounce: false } });
    expect(calls.flashes).toEqual(['wallet.gramTransferSending', 'wallet.gramTransferRecipientNew']);
  });

  it('TRANSFER-BOUNCE-06: the pure rule, and what the file no longer says', () => {
    const { api } = build(async () => ({ status: 'active' }));
    expect(api.transferBounceForStatus('active')).toBe(true);
    expect(api.transferBounceForStatus('frozen')).toBe(true);
    expect(api.transferBounceForStatus('uninit')).toBe(false);
    expect(api.transferBounceForStatus('nonexist')).toBe(false);
    expect(api.transferBounceForStatus(undefined)).toBe(false);
    const submit = fn('async function submitWalletTonTransfer(hold = null) {');
    expect(submit, 'the flat flag is gone').not.toContain('bounce: false');
    expect(submit.indexOf('await transferRecipientAccountStatus(details.recipient)'), 'the state is read before anything is built').toBeLessThan(submit.indexOf('createWalletTransaction(message)'));
    const locales = Object.keys(I18N_STRINGS);
    expect(locales.length).toBe(10);
    for (const locale of locales) expect(typeof (I18N_STRINGS as any)[locale]['wallet.gramTransferRecipientNew'], locale).toBe('string');
  });
});
