import { readFileSync } from 'node:fs';
import { sourceBlock } from './source';
import { parseUnits } from '../../web/wallet-transfers.mjs';
import { formatUnits } from '../../web/wallet-assets.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
export const GRAM = 'GRAM';

export class El {
  tag: string; children: El[] = []; attrs = new Map<string, string>(); classes = new Set<string>(); listeners: Record<string, () => void> = {};
  type = ''; inputMode = ''; autocomplete = ''; placeholder = ''; id = ''; value = ''; textContent = ''; focused = false;
  name = ''; hidden = false; checked = false; disabled = false;
  constructor(tag: string) { this.tag = tag; }
  set className(value: string) { this.classes = new Set(value.split(' ').filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  get classList() { const self = this; return { toggle: (name: string, on: boolean) => { if (on) self.classes.add(name); else self.classes.delete(name); }, contains: (name: string) => self.classes.has(name) }; }
  setAttribute(k: string, v: string) { this.attrs.set(k, v); }
  removeAttribute(k: string) { this.attrs.delete(k); }
  getAttribute(k: string) { return this.attrs.get(k) ?? null; }
  append(...more: El[]) { this.children.push(...more); }
  addEventListener(name: string, handler: () => void) { this.listeners[name] = handler; }
  replaceChildren(...more: El[]) { this.children = [...more]; }
  click() { this.listeners.click?.(); }
  focus() { this.focused = true; }
}

export function swapWorld({ offers, pairs = {}, gramBalance = 10_000_000_000n, env: more = {} }: {
  offers: any[]; pairs?: Record<string, any[]>; gramBalance?: bigint | null; env?: Record<string, any>;
}) {
  let dialog: any = null;
  const pickerOpened: string[] = [];
  const notices: string[] = [];
  let picked: (id: string) => void = () => {};
  const env: Record<string, any> = {
    plathoWallet: { address: 'W' }, whileWalletTileBusy: async (_tile: any, work: () => any) => { await work(); return true; }, walletSwapAction: null,
    walletTilePressStands: () => true, walletTransferOnItsWay: () => false, walletSwapOffers: () => offers, showAppNotice: (text: string) => { notices.push(text); },
    loadWalletAssets: async () => {}, requirePlathoWallet: () => ({ address: 'W' }), walletSwapReferral: () => null,
    walletBalanceRowText: () => '10 GRAM', parseUnits, formatUnits, minimumOut: (v: bigint) => v,
    swapRoutes: (offer: string, ask: string) => (pairs[offer] ?? []).filter((pair) => pair.ask.id === ask).map((pair) => ({ key: `stonfi:${pair.ask.id}`, dex: 'stonfi', pair })),
    swapAsksFrom: (offer: string) => (pairs[offer] ?? []).map((pair) => pair.ask),
    readRoutePool: () => new Promise(() => {}), quoteRoute: () => ({ out: 1n, impactBps: 0, platho: 0n }), estimateRoute: async () => ({ out: 1n, impactBps: 0, platho: 0n }),
    routeAmountInFor: () => 1n, routeLocked: () => false, routeAttachedNanotons: () => 300_000_000n, buildRouteMessage: () => ({ body: {} }),
    routePoolFeeBps: () => 30, routePlathoBps: () => 0, STONFI: 'stonfi', DEDUST: 'dedust', SWAP_EXCHANGE_NAMES: { stonfi: 'STON.fi', dedust: 'DeDust' },
    noteTonRpcRateLimit: () => false,
    openWalletSwapPicker: ({ title, onPick }: any) => { pickerOpened.push(title); picked = onPick; }, walletSwapPickerItems: () => [],
    walletSendFeeReserveNanotons: () => 10_000_000n, walletSendSizeClassForPayloadBytes: () => 1,
    serializeBoc: () => new Uint8Array(10), swapDeadline: () => 0, walletChainNowMs: () => 0,
    walletTonTransfersBusy: new Set(), refreshMessagingControls: () => {}, updateActiveActionSummary: () => {},
    t: (key: string) => key, GRAM, vaultPocketState: { wallet: { ton_balance: gramBalance } }, document: { createElement: (tag: string) => new El(tag) },
    actionDialog: null, walletAssetsState: { at: new Map([['tokens', 1]]) },
    openActionDialog: (config: any) => { dialog = config; return new Promise(() => {}); },
    SWAP_DEFAULT_SLIPPAGE_BPS: 100, SWAP_SLIPPAGE_CHOICES_BPS: [50, 100, 300], walletSwapPercent: (bps: number) => `${bps / 100}%`, spendPasswordFields: () => [], spendPasswordRefusal: async () => '',
    walletSwapTileBalance: () => {}, walletAthMaster: () => 'ATH',
    walletPriceChart: (base: string, quote: string, options: any) => ({ chart: [base, quote, options.route?.key, options.intro] }),
    walletSwapTwinTag: (items: any[], item: any) => (items.filter((one) => String(one.symbol).toLowerCase() === String(item.symbol).toLowerCase()).length > 1 ? `tag:${item.id}` : ''),
    ...more,
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const open = new Function(...names, [fn('function walletSwapTile(side) {'), fn('async function openWalletSwapDialog(start, hold, asked = null) {'), 'return openWalletSwapDialog;'].join(NL))(...names.map((n) => env[n]));
  const tiles = () => {
    const box = dialog.fields[0].render();
    const [give, get, dex] = box.children;
    const pick = (card: El) => card.children[0].children[0];
    const amount = (card: El) => card.children.find((one) => one.classes.has('swap-card-amount'))!;
    return { give, get, dex, givePick: pick(give), getPick: pick(get), input: amount(give).children[0], getInput: amount(get).children[0], max: amount(give).children[1], getMax: amount(get).children[1] };
  };
  return { open, env, tiles, dialog: () => dialog, pickerOpened, notices, pick: (id: string) => picked(id), settle: () => new Promise((resolve) => setTimeout(resolve, 0)) };
}
