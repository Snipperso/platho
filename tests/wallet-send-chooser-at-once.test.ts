import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);

function world() {
  const events: string[] = [];
  const reads: Record<string, () => void> = {};
  const state: any = { tokens: null, nfts: null, at: new Map(), stored: {} };
  let dialog: any = null;
  let closeDialog: (value: any) => void = () => {};
  const node = (tag: string): any => ({ tag, className: '', textContent: '', children: [] as any[], isConnected: false,
    append(...more: any[]) { this.children.push(...more); }, replaceChildren() { this.children = []; } });
  const env: Record<string, any> = {
    plathoWallet: { address: 'W' }, walletTransferOnItsWay: () => false,
    loadWalletAssets: (tab: string) => { events.push(`read ${tab}`); return new Promise<void>((resolve) => { reads[tab] = () => { state.at.set(tab, 1); resolve(); }; }); },
    walletAssetsState: state, document: { createElement: node }, actionSubmitButton: null, sendWalletTonButton: { click: () => events.push('send gram') },
    walletAssetRow: ({ title }: any) => ({ tag: 'row', title }), gramPicture: () => '', walletBalanceRowText: (asset: string) => asset, assetPicture: () => '',
    walletAthToken: () => ({ master: 'ATH', balance: '5' }), walletHiddenAssets: () => new Set(), formatUnits: (v: string) => v, shortAddress: (v: string) => v,
    t: (key: string) => key, runWalletAssetSend: async () => {},
    openActionDialog: (config: any) => new Promise((resolve) => {
      events.push('dialog open');
      dialog = config;
      dialog.list = config.fields[0].render();
      dialog.list.isConnected = true;
      closeDialog = (value: any) => { dialog.list.isConnected = false; resolve(value); };
    }),
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const open = new Function(...names, [fn('async function openWalletSendChooser() {'), 'return openWalletSendChooser;'].join(NL))(...names.map((n) => env[n]));
  const titles = () => dialog.list.children.map((one: any) => one.title ?? one.textContent);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { open, env, events, reads, state, titles, settle, close: (value: any) => closeDialog(value) };
}

describe('the Send chooser opens at once', () => {
  it('SENDNOW-01: the window opens before any read lands; the tokens read, then the NFT read; each landing draws the rows again', async () => {
    const w = world();
    const done = w.open();
    await w.settle();
    expect(w.events, 'open at once — no read waited for').toEqual(['read tokens', 'dialog open']);
    expect(w.titles()).toEqual(['GRAM', 'ATH', 'wallet.tokensStillReading']);
    w.state.tokens = [{ master: 'USDT', name: 'Tether USD', symbol: 'USDT', verified: true, balance: '7', decimals: 6 }];
    w.reads.tokens();
    await w.settle();
    expect(w.events, 'the NFT read after the tokens read, never beside it').toEqual(['read tokens', 'dialog open', 'read nft']);
    expect(w.titles()).toEqual(['GRAM', 'ATH', 'Tether USD', 'wallet.tokensStillReading']);
    w.state.nfts = [{ address: 'N', name: 'myname.ton', verified: true }];
    w.reads.nft();
    await w.settle();
    expect(w.titles(), 'both read: no "still reading"').toEqual(['GRAM', 'ATH', 'Tether USD', 'myname.ton']);
    w.close(null);
    await done;
  });

  it('SENDNOW-02: a read that lands after the window closed, or for another wallet, draws nothing', async () => {
    const w = world();
    const done = w.open();
    await w.settle();
    const drawn = w.titles();
    w.close(null);
    await done;
    w.state.tokens = [{ master: 'USDT', name: 'Tether USD', symbol: 'USDT', verified: true, balance: '7', decimals: 6 }];
    w.reads.tokens();
    await w.settle();
    expect(w.titles(), 'closed: left as it was').toEqual(drawn);
    const other = world();
    const pending = other.open();
    await other.settle();
    other.env.plathoWallet.address = 'X';
    other.state.tokens = [{ master: 'USDT', name: 'Tether USD', symbol: 'USDT', verified: true, balance: '7', decimals: 6 }];
    other.reads.tokens();
    await other.settle();
    expect(other.titles(), 'another wallet unlocked: not drawn').toEqual(['GRAM', 'ATH', 'wallet.tokensStillReading']);
    other.close(null);
    await pending;
  });
});
