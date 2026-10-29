import { readFileSync } from 'node:fs';
import { sourceBlock } from './source';


const app = readFileSync('web/app.js', 'utf8');
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const viaG = (text: string) => text.split('globalThis.').join('G.').split('new BroadcastChannel(').join('new G.BroadcastChannel(');

export const GATE = 'platho-active-window.v1';

export const originLocks = () => {
  const held = new Map<string, Array<{ mode: string; release: () => void }>>();
  const queues = new Map<string, Array<{ grant: () => void; mode: string }>>();
  const holders = (name: string) => held.get(name) ?? [];
  const free = (name: string, mode: string) => holders(name).length === 0 || (mode === 'shared' && holders(name).every((x) => x.mode === 'shared'));
  const pump = (name: string) => { const queue = queues.get(name) ?? []; while (queue.length && free(name, queue[0].mode)) queue.shift()!.grant(); };
  const manager = {
    request(name: string, optionsOrCallback: any, maybeCallback?: (lock: any) => any) {
      const options = typeof optionsOrCallback === 'function' ? {} : (optionsOrCallback ?? {});
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!;
      const mode = options.mode ?? 'exclusive';
      return new Promise((resolve, reject) => {
        const grant = () => {
          const entry = { mode, release: () => {} };
          let done = false;
          entry.release = () => { if (done) return; done = true; held.set(name, holders(name).filter((x) => x !== entry)); pump(name); };
          held.set(name, [...holders(name), entry]);
          Promise.resolve(callback({ name, mode })).then((value) => { entry.release(); resolve(value); }, (error) => { entry.release(); reject(error); });
        };
        if (free(name, mode) && !(queues.get(name)?.length)) { grant(); return; }
        if (options.ifAvailable) { Promise.resolve(callback(null)).then(resolve, reject); return; }
        const item = { grant, mode };
        const queue = queues.get(name) ?? [];
        queues.set(name, queue);
        queue.push(item);
        options.signal?.addEventListener?.('abort', () => {
          const at = queue.indexOf(item);
          if (at >= 0) { queue.splice(at, 1); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }
        });
      });
    },
    query: async () => ({
      held: [...held.entries()].flatMap(([name, list]) => list.map((x) => ({ name, mode: x.mode }))),
      pending: [...queues.entries()].flatMap(([name, queue]) => queue.map((x) => ({ name, mode: x.mode }))),
    }),
  };
  return {
    manager, unload: (name: string) => { for (const x of holders(name)) x.release(); },
    holding: (name: string) => holders(name).length > 0, waiting: (name: string) => queues.get(name)?.length ?? 0,
  };
};

export const bootPage = ({ shellChildren = 0, focused = true }: { shellChildren?: number; focused?: boolean } = {}) => {
  const attrs = new Map<string, string>();
  const clicks: Array<() => void> = [];
  const docListeners = new Map<string, Array<() => void>>();
  const focusLog: string[] = [];
  const el = (extra: Record<string, any> = {}) => ({ hidden: true, disabled: false, textContent: '', dataset: {} as Record<string, string>, ...extra });
  const button = el({ addEventListener: (_type: string, cb: () => void) => { clicks.push(cb); }, removeEventListener: (_type: string, cb: () => void) => { const at = clicks.indexOf(cb); if (at >= 0) clicks.splice(at, 1); },
    focus: () => { focusLog.push('button'); } });
  const title = el();
  const hint = el();
  const panel = el({ querySelector: (sel: string) => (sel === '.boot-elsewhere-title' ? title : sel === '.boot-elsewhere-hint' ? hint : null) });
  const status = el({ focus: () => { focusLog.push('status'); } });
  const nodes: Record<string, any> = { bootScreen: el({ dataset: { phase: 'idle' } }), bootElsewhere: panel, bootUseHere: button, bootElsewhereStatus: status };
  const inert = new Set<number>();
  const shell = shellChildren > 0 ? {
    children: Array.from({ length: shellChildren }, (_, index) => ({
      hasAttribute: (name: string) => name === 'inert' && inert.has(index),
      setAttribute: (name: string) => { if (name === 'inert') inert.add(index); },
      removeAttribute: (name: string) => { if (name === 'inert') inert.delete(index); },
    })),
  } : null;
  const documentElement = { dataset: {} as Record<string, string>, setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k), getAttribute: (k: string) => attrs.get(k) ?? null };
  let dialog: any = null;
  const document: any = {
    documentElement, visibilityState: 'visible', hasFocus: () => focused, getElementById: (id: string) => nodes[id] ?? null,
    querySelector: (sel: string) => (sel === '.app-shell' ? shell : sel === '#actionDialog:not([hidden])' ? dialog : null),
    addEventListener: (type: string, cb: () => void) => { docListeners.set(type, [...(docListeners.get(type) ?? []), cb]); },
    removeEventListener: (type: string, cb: () => void) => { docListeners.set(type, (docListeners.get(type) ?? []).filter((x) => x !== cb)); },
  };
  return {
    document, nodes, attrs, title, hint, focusLog, inert,
    setFocused: (value: boolean) => { focused = value; },
    showDialog: (fields: any[] | null) => { dialog = fields ? { querySelectorAll: () => fields } : null; },
    press: () => { for (const cb of [...clicks]) cb(); },
    fire: (type: string) => { for (const cb of [...(docListeners.get(type) ?? [])]) cb(); },
  };
};

export const GATE_SOURCES = ['function holdActiveWindow() {', 'function showOpenElsewhere({ locks, onUseHere, takeIfFree }) {', 'function letGoWhenFrozen(locks) {',
  'function noteActiveWindowTurn() {', 'function activeWindowTurnTaken() {', 'function activeWindowSigningHeld() {', 'function askActiveWindowToLetGo() {',
  'function listenForActiveWindowAsk() {', 'async function letGoOfActiveWindow() {', 'function activeWindowHoldsWork() {', 'function sendWorkInHand() {', 'function pageHoldsTyping() {'];

export const windowOf = (locks: any, hub: any, store = new Map<string, string>(), { turnWrites = true, telegram = false, page = bootPage() } = {}) => {
  const reloads: number[] = [];
  const log: string[] = [];
  const work = { history: false, transfers: new Set<any>(), composer: false, signer: false, vaultDeploy: null as any, inHand: 0 };
  const G: any = {
    navigator: { locks: locks.manager }, document: page.document, BroadcastChannel: hub.Channel, plathoConvSendInFlight: 0,
    location: { reload: () => { reloads.push(Date.now()); log.push('reload'); } },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { if (!turnWrites) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); store.set(k, String(v)); } },
    ...(telegram ? { Telegram: { WebApp: { initData: 'query_id=1', ready: () => {}, expand: () => {} } } } : {}),
  };
  const env = {
    G, t: (key: string) => key, RESECURE_WINDOW_LOCK: 'platho.storage.windows', historyHeld: () => work.history, watchWalletTonTransfer: { live: work.transfers },
    composerHoldsContent: () => work.composer, walletSignerHeld: () => work.signer, acquireVaultDeployLock: { get held() { return work.vaultDeploy; } },
    walletWorkInHand: () => work.inHand > 0, lockPlathoWallet: () => { log.push('locked'); },
  };
  const api = lift(env, GATE_SOURCES.map((start) => viaG(sourceBlock(app, start))), '{ gate: holdActiveWindow, signingHeld: activeWindowSigningHeld, holdsWork: activeWindowHoldsWork }');
  const ready = () => { page.document.documentElement.dataset.plathoAppJs = 'ready'; };
  return { api, page, G, reloads, work, ready, log };
};
