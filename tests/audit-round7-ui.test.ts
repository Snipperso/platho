import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';
import { t, tPlural, setLocale } from '../web/i18n.mjs';
import {
  encodeReplyBlockContent,
  decodeReplyBlockContent,
  encodeFileBlockContent,
  decodeFileBlockContent,
  encodeProfileBlockContent,
  decodeProfileBlockContent,
  encodeShareBlockContent,
  decodeShareBlockContent,
  REPLY_BLOCK_CONTENT_VERSION,
  REPLY_BLOCK_CONTENT_VERSION_TEXT_ID,
  REPLY_ENTRY_ID_MAX_BYTES,
} from '../web/capsule-part-policy.mjs';
import { privateCapsuleFromChainEntry, PLATHO_CAPSULE_UNREADABLE_CODE, PLATHO_CAPSULE_CLOCK_SKEW_CODE, PLATHO_COMPACT_IMAGE_FORMATS } from '../web/crypto/platho-crypto.mjs';
import { walletSendFeeNanotons, WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS } from '../web/wallet-send-fee.mjs';
import { KEYSHARD_REGISTER_VALUE } from '../web/publish-price.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const S = I18N_STRINGS as Record<string, Record<string, string>>;
const LOCALES = (I18N_LOCALES as Array<{ code: string }>).map((l) => l.code);

const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  if (app.indexOf(declaration, at + 1) >= 0) throw new Error(`${declaration} is not unique`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const listener = (head: string, name: string) => {
  const at = app.indexOf(head);
  if (at < 0 || app.indexOf(head, at + 1) >= 0) throw new Error(`${head} not found once`);
  const open = app.indexOf('=> {', at) + 4;
  const close = app.indexOf('\n}', at);
  return `async function ${name}() {${app.slice(open, close)}\n}`;
};

const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis));
function inert(): any {
  const self: any = new Proxy(function () { }, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () { };
      if (key === 'then') return undefined;
      return self;
    },
    apply() { return self; },
    construct() { return self; },
    set() { return true; },
  });
  return self;
}
function inAppScope(sources: string[], exported: string, overrides: Record<string, any>) {
  const scope = new Proxy(overrides, {
    has(target, key) { return typeof key === 'string' && (key in target || !GLOBALS.has(key)); },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (typeof key === 'string' && key in target) return (target as any)[key];
      return inert();
    },
    set(target, key, value) { (target as any)[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
}
const node = (extra: Record<string, any> = {}) => ({
  textContent: '', title: '', hidden: false, disabled: false, dataset: {} as Record<string, string>,
  attrs: {} as Record<string, string>,
  setAttribute(k: string, v: string) { this.attrs[k] = v; },
  getAttribute(k: string) { return this.attrs[k] ?? null; },
  classes: new Set<string>(),
  classList: {
    add(this: any, c: string) { (this as any).owner.classes.add(c); },
    remove(this: any, c: string) { (this as any).owner.classes.delete(c); },
    toggle(this: any, c: string, on?: boolean) { const s = (this as any).owner.classes; const want = on ?? !s.has(c); if (want) s.add(c); else s.delete(c); return want; },
    contains(this: any, c: string) { return (this as any).owner.classes.has(c); },
  } as any,
  ...extra,
});
const el = (extra: Record<string, any> = {}) => { const n: any = node(extra); n.classList.owner = n; return n; };
const setText = (n: any, v: any) => { if (n) n.textContent = String(v ?? ''); };
const holdSources = [
  'const STATUS_HOLD_MS = 12_000;',
  'const heldStatusText = new WeakMap();',
  fn('function holdStatusText('),
  fn('function statusHeld('),
  fn('function releaseHeldStatus('),
];

describe('AUDIT ROUND 7 — the status line under a private message', () => {
  const sources = [
    fn('function messageMetaTextKey('),
    fn('function messageMetaReasonKey('),
    fn('function messageMetaReasonDisplayText('),
    fn('function messageMetaDisplayText('),
    fn('function publishStatusDisplayText('),
    fn('function messageSenderLabel('),
    fn('function messageMetaLine('),
    fn('function privateSendPreflightStatusText('),
    fn('function privateSendBlockedStatusText('),
    fn('function privateSendRetryMeta('),
    fn('function privateSendRetryExhaustedStatusText('),
    fn('function privatePublishConfirmStoppedStatusText('),
  ];
  const build = (overrides: Record<string, any> = {}) => inAppScope(sources, `{ messageMetaDisplayText, messageMetaReasonDisplayText, messageMetaLine,
    privateSendPreflightStatusText, privateSendBlockedStatusText, privateSendRetryMeta, privateSendRetryExhaustedStatusText,
    privatePublishConfirmStoppedStatusText, messageMetaTextKey }`, {
    t, tPlural,
    shortUiErrorText: (error: any, fallback: string) => String(error?.message ?? '') || fallback,
    isTonRpcVerificationSoftReadError: (e: any) => e?.soft === true,
    isTonRpcVerificationUnavailableError: (e: any) => e?.unavailable === true,
    isTonRpcRateLimitError: (e: any) => e?.rate === true,
    RECIPIENT_NOT_ACTIVATED: 'RECIPIENT_NOT_ACTIVATED',
    formatMessageClock: () => '14:03',
    messageCreatedAtMs: () => 1,
    ...overrides,
  });
  const ERRORS = [
    null, {}, { code: 'RECIPIENT_OWNER_CHANGED' }, { code: 'STALE_PRIVATE_PUBLISH' },
    { code: 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED', message: 'partial publish retry limit reached' },
    { code: 'PARTIAL_PRIVATE_PUBLISH_RETRY_EXPIRED', message: 'partial publish retry window expired' },
    { soft: true }, { rate: true }, { unavailable: true }, { code: 'BROADCAST_REJECTED' }, { code: 'CONFIRM_RETRY_EXHAUSTED' },
    { message: 'persistent encrypted local history is unavailable' }, { message: 'activate platho account first' },
  ];

  it('UI7-01: every status a private lane writes is painted in the reader\'s language', () => {
    setLocale('ru');
    try {
      const x = build();
      const written = new Set<string>();
      for (const error of ERRORS) {
        written.add(x.privateSendRetryExhaustedStatusText(error));
        written.add(x.privatePublishConfirmStoppedStatusText(error));
        written.add(x.privateSendRetryMeta(error));
        written.add(x.privateSendBlockedStatusText(error));
      }
      for (const m of app.matchAll(/\bmeta(?:\s*=|:)\s*'([^']+)'/g)) written.add(m[1]);
      for (const m of app.matchAll(/\bmeta\s*=\s*[^;\n]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) { written.add(m[1]); written.add(m[2]); }
      for (const text of ['received', 'received parts', 'sending', 'published', 'confirming']) written.add(text);
      written.delete('');
      expect(written.size, 'the enumeration found the lanes\' words').toBeGreaterThan(30);
      const untranslated = [...written].filter((text) => {
        const shown = x.messageMetaDisplayText(text);
        return shown === text || /\b(not sent|not confirmed|received|retrying|resend|Send blocked|RPC verification|chain lookup)\b/i.test(shown);
      });
      expect(untranslated, untranslated.join('\n')).toEqual([]);
    } finally { setLocale('en'); }
  });

  it('UI7-01B: a fixed give-up the ladders can write always has its own key — a new sentence cannot slip through as English', () => {
    const x = build();
    const literals = [fn('function privateSendRetryExhaustedStatusText('), fn('function privatePublishConfirmStoppedStatusText('), fn('function privateSendRetryMeta(')]
      .flatMap((source) => [...source.matchAll(/'((?:not sent|not confirmed): [^']+|retrying send|retrying after RPC busy|checking RPC, retrying)'/g)].map((m) => m[1]));
    expect(literals.length, 'the three ladders hold 7 + 8 + 3 fixed sentences today; fewer means the reader went blind').toBeGreaterThanOrEqual(18);
    const unkeyed = literals.filter((text) => x.messageMetaTextKey(text) === null);
    expect(unkeyed, unkeyed.join('\n')).toEqual([]);
  });

  it('UI7-01C: the line keeps a sender\'s name as written, keeps English for the status logic, and translates only the paint', () => {
    setLocale('ru');
    try {
      const line = (message: any, text: string) => build({ messageMetaText: () => text }).messageMetaLine(message);
      expect(line({ type: 'out', meta: 'sent, not verified' }, 'sent, not verified')).toBe(`${S.ru['messageMeta.sentNotVerified']} · 14:03`);
      expect(line({ type: 'in', senderLabel: 'received.ath' }, 'received.ath'), 'a name that happens to be a status word stays a name').toBe('received.ath · 14:03');
      expect(line({ type: 'system' }, 'Group created'), 'a system row is untouched').toBe('Group created');
      expect(build().messageMetaDisplayText('not sent: RPC verification pending'))
        .toBe(t('messageMeta.notSent', { reason: S.ru['messageMeta.reason.networkCheckPending'] }));
    } finally { setLocale('en'); }
    expect(fn('function messageStatusKey(')).toMatch(/const text = messageMetaText\(message\)\.toLowerCase\(\);/);
    expect(fn('function messageMetaText(')).not.toMatch(/messageMetaDisplayText|\bt\(/);
  });
});

describe('AUDIT ROUND 7 — the transfer dialogs and the words on screen', () => {
  const TRANSFER_KEYS = ['username.transferName', 'username.transferNameTitle', 'username.transferIrreversible', 'username.recipientInvalid',
    'username.recipientIsSelf', 'username.transferSubmittedTitle', 'username.transferSubmittedHint', 'username.transferFailed',
    'username.transferCostNote', 'username.transferLosesName', 'username.listMayBeIncomplete', 'username.noNamesFound'];

  it('UI7-02: the .ath name and gift transfer dialogs — "cannot be undone" included — are translated in every locale', () => {
    const english: string[] = [];
    for (const code of LOCALES.filter((c) => c !== 'en')) {
      for (const key of [...TRANSFER_KEYS, 'gift.transferTitle']) if (S[code][key] === S.en[key]) english.push(`${code}:${key}`);
    }
    expect(english, english.join('\n')).toEqual([]);
    expect(S.en['username.transferFailed']).toBe('The name transfer did not go through');
  });

  it('UI7-11: the register, the plurals and the words are right', () => {
    const du = Object.entries(S.de).filter(([, v]) => /\b(versuche|erstelle|starte|tippe|teile (sie|ihn)|Finde)\b/.test(v)).map(([k]) => k);
    expect(du, du.join(', ')).toEqual([]);
    expect(S.es['common.updateReadyReload']).toMatch(/\btoca\b/);
    expect(Object.entries(S.zh).filter(([, v]) => v.includes('您')).map(([k]) => k)).toEqual([]);
    const kamu = Object.entries(S.id).filter(([, v]) => /\bkamu\b|\b\w+mu\b/i.test(v) && !/\b(ilmu|jamu|temu|bertemu|menemu\w*)\b/i.test(v)).map(([k]) => k);
    expect(kamu, kamu.join(', ')).toEqual([]);
    for (const code of LOCALES.filter((c) => c !== 'en')) expect(S[code]['install.bodyIos'], code).not.toMatch(/Home Screen/);
    const form = (category: string, n: number) => S.ru[`publish.sendingParts#${category}`].replace('{count}', String(n));
    expect(S.ru['publish.sendingParts#one'], 'the "one" form (21, 31…) is its own word').not.toBe(S.ru['publish.sendingParts#many']);
    setLocale('ru');
    try {
      expect([1, 2, 5, 21].map((n) => tPlural('publish.sendingParts', n))).toEqual([form('one', 1), form('few', 2), form('many', 5), form('one', 21)]);
    } finally { setLocale('en'); }
    expect(tPlural('moderation.queueReports', 1)).toBe('1 report');
    expect(tPlural('moderation.queueReports', 3)).toBe('3 reports');
    expect(app).not.toMatch(/t\('(publish\.sendingParts|moderation\.queueReports)'/);
    for (const code of LOCALES) {
      const word = new Intl.NumberFormat(code, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(1).replace(/[\d\s.,]/g, '');
      const stem = word.slice(0, Math.max(1, word.length - 1)).toLowerCase();
      expect(S[code]['moderation.unconfirmed'].toLowerCase(), `${code}: ${stem}`).not.toContain(stem);
    }
    expect(S.en['username.mintHint']).toMatch(/GRAM/);
    expect(S.en['username.mintHint']).not.toMatch(/TON network fees/);
    for (const code of LOCALES) expect(S[code]['avatar.uploadHint'], code).not.toMatch(/ProfileRegistry/);
    expect(html).toMatch(/<section class="profile-section" aria-label="Language" data-i18n-aria-label="profile\.language\.title">/);
    expect(fn('async function confirmClearLocalData(')).toMatch(/label: t\('profile\.clearConfirmLabel', \{ word: 'CLEAR' \}\)/);
    for (const code of LOCALES) expect(S[code]['profile.clearConfirmLabel'], code).toContain('{word}');
  });

  it('UI7-11B: the activation figure in the protocol doc is the one the pre-flight demands, in all ten languages', () => {
    const headroom = BigInt(/const WALLET_FEE_HEADROOM_NANOTONS = ([\d_]+)n;/.exec(app)![1].replaceAll('_', ''));
    const measured = walletSendFeeNanotons([4]) + WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS;
    expect(/const KEYSHARD_REGISTER_SIZE_CLASS = 4;/.test(app), 'the register size class the doc figure is computed for').toBe(true);
    const need = KEYSHARD_REGISTER_VALUE + (measured > headroom ? measured : headroom);
    const gram = (n: bigint, sep: string) => `0${sep}${String(n / 10_000_000n).padStart(2, '0')}`;
    expect(need % 10_000_000n, 'the doc can state it in two decimals').toBe(0n);
    for (const suffix of ['', '.ru', '.zh', '.es', '.pt', '.fr', '.de', '.hi', '.id', '.ja']) {
      const doc = readFileSync(`web/docs/crypto-protocol${suffix}.md`, 'utf8');
      const sep = /0,06 GRAM/.test(doc) ? ',' : '.';
      expect(doc, suffix || 'en').toContain(`${gram(need, sep)} GRAM`);
      expect(doc, suffix || 'en').toContain(`${gram(KEYSHARD_REGISTER_VALUE, sep)} GRAM`);
    }
  });
});

describe('AUDIT ROUND 7 — a failed sync is not "synced"', () => {
  const indicator = (state: Record<string, any>) => {
    const target = el();
    const x = inAppScope([fn('function refreshGlobalSyncIndicator(')], 'refreshGlobalSyncIndicator', {
      t, globalSyncIndicators: [target], globalSyncSpinnerSince: 0, globalSyncSpinnerHeldBy: null,
      messageAutoSyncPhase: 'idle', publicSyncPhase: 'idle', prefsSyncInFlight: false, messageAutoSyncFailed: false,
      messageAutoSyncLastErrorLabel: null,
      isGlobalSyncActive: () => state.active === true,
      allSectionStaleOnScreen: () => false,
      ...state,
    });
    x();
    return target;
  };

  it('UI7-03: the header turns amber after a failed pass of either lane — and only after a failure', () => {
    const failedPrivate = indicator({ messageAutoSyncPhase: 'delayed', messageAutoSyncFailed: true });
    expect(failedPrivate.dataset.delayed).toBe('true');
    expect(failedPrivate.attrs['aria-label']).toBe(t('sync.delayedTapRetry'));
    expect(failedPrivate.title).toBe(t('sync.delayedTapRetry'));
    expect(indicator({ publicSyncPhase: 'delayed' }).dataset.delayed, 'the public lane got no chain answer').toBe('true');
    const catchingUp = indicator({ messageAutoSyncPhase: 'delayed', messageAutoSyncFailed: false });
    expect(catchingUp.dataset.delayed, 'a pass that stopped short on purpose is not a failure').toBe('false');
    expect(catchingUp.attrs['aria-label']).toBe(t('sync.syncNow'));
    expect(indicator({ active: true, publicSyncPhase: 'delayed' }).dataset.delayed, 'a running sync shows the spinner').toBe('false');
    const named = indicator({ messageAutoSyncPhase: 'delayed', messageAutoSyncFailed: true, messageAutoSyncLastErrorLabel: t('sync.incomplete') });
    expect(named.attrs['aria-label']).toBe(`${t('sync.incomplete')} · ${t('sync.delayedTapRetry')}`);
    expect(css).toMatch(/\.global-sync-indicator\[data-syncing="false"\]\[data-delayed="true"\]::before \{[^}]*background: var\(--amber\);[^}]*mask: url\("\.\/assets\/icons\/refresh\.svg"\)/);
  });

  it('UI7-03B: the private flag is a failure — a thrown pass or a refused one — never a pass that stopped short', () => {
    const x = inAppScope([fn('function completeMessageSyncUi('), fn('function failMessageSyncUi(')],
      '{ completeMessageSyncUi, failMessageSyncUi, get failed() { return messageAutoSyncFailed; }, get phase() { return messageAutoSyncPhase; } }', {
        t, messageAutoSyncPhase: 'syncing', messageAutoSyncFailed: false, messageAutoSyncLastResult: null, messageAutoSyncLastErrorLabel: null,
        privateSyncStatusText: () => 'status', refreshConversationSubtitle: () => {},
      });
    x.completeMessageSyncUi({ ok: true, scanComplete: false, reason: 'catch_up_pending' });
    expect([x.phase, x.failed]).toEqual(['delayed', false]);
    x.completeMessageSyncUi({ ok: false });
    expect([x.phase, x.failed]).toEqual(['delayed', true]);
    x.completeMessageSyncUi({ ok: true, scanComplete: true });
    expect([x.phase, x.failed]).toEqual(['synced', false]);
    x.completeMessageSyncUi({ ok: true, scanComplete: false, rateLimited: true });
    expect(x.failed).toBe(true);
    x.completeMessageSyncUi({ ok: true, scanComplete: true });
    x.failMessageSyncUi('boom');
    expect([x.phase, x.failed]).toEqual(['delayed', true]);
  });

  it('UI7-03C: an empty feed after a sync with no answer says the feed is unavailable, not that there are no posts', () => {
    const shown: string[][] = [];
    const render = (phase: string, query = '') => {
      shown.length = 0;
      inAppScope([fn('function renderPublicFeed(')], 'renderPublicFeed', {
        t, publicFeed: el({ replaceChildren() {}, append() {} }), publicSyncPhase: phase, publicChannelSearchQuery: query,
        walletLockedOnDevice: () => false,
        publicItemVisibleUnderModeration: () => true, buildSkeletonNodes: () => [],
        renderPublicEmpty: (a: string, b: string) => shown.push([a, b]), requestAnimationFrame: () => 0,
      })([]);
      return shown[0];
    };
    expect(render('delayed')).toEqual([t('public.feedUnavailable'), t('public.feedUnavailableHint')]);
    expect(render('synced')).toEqual([t('public.noPosts'), t('public.followOrPublishFirst')]);
    expect(render('syncing')).toEqual([t('public.previewWaitingFeed'), t('common.checking')]);
    expect(render('delayed', 'cats'), 'a search keeps its own empty state').toEqual([t('public.noPostsFound'), t('public.tryAnotherSearch')]);
  });
});

describe('AUDIT ROUND 7 — a refusal keeps its reason on screen', () => {
  const controls = (facts: Record<string, any>) => {
    const button = el({ hidden: true });
    const status = el();
    const scope: Record<string, any> = {
      t, setText, registerVaultKeysButton: button, vaultDraftStatus: status,
      plathoWallet: { address: 'EQwallet' }, hasActivePlathoAccount: () => false, activationAnswerKnownFor: () => false,
      plathoAccountActivationPending: false, plathoActivationInFlightForCurrentWallet: () => false,
      pendingServiceWorkerAppShellReload: false, plathoAccountActivationFeeLabel: () => 'up to 0.07 GRAM',
      refreshPlathoActivationArrear: async () => false, railItems: [],
      ...facts,
    };
    const x = inAppScope([...holdSources, fn('function refreshMessagingControls(')], '{ refreshMessagingControls, holdStatusText }', scope);
    return { x, button, status, scope };
  };

  it('UI7-04: the Activate row waits for the chain\'s answer before it offers a paid activation', () => {
    const unknown = controls({});
    unknown.x.refreshMessagingControls();
    expect(unknown.button.hidden).toBe(false);
    expect(unknown.button.disabled, 'no Activate before the KeyShard read answered').toBe(true);
    expect(unknown.status.textContent).toBe(t('send.checkingActivation'));
    const known = controls({ activationAnswerKnownFor: () => true });
    known.x.refreshMessagingControls();
    expect(known.button.disabled).toBe(false);
    expect(known.status.textContent).toBe('up to 0.07 GRAM');
  });

  it('UI7-04B: a held line survives the refresh that follows every attempt, and only in the place it was said', () => {
    const { x, status, scope } = controls({ activationAnswerKnownFor: () => true });
    x.holdStatusText(status, 'Wallet needs ~0.07 GRAM', { scope: 'EQwallet' });
    x.refreshMessagingControls();
    expect(status.textContent, 'the fee did not paint over the reason').toBe('Wallet needs ~0.07 GRAM');
    expect(status.dataset.state).toBe('short');
    scope.plathoWallet = { address: 'EQother' };
    x.refreshMessagingControls();
    expect(status.textContent, 'another wallet does not inherit the words').toBe('up to 0.07 GRAM');
  });

  it('UI7-04C: an Activate failure is said with its figure, held, and a registered account is said to be active', async () => {
    const status = el();
    const refreshed: string[] = [];
    const run = (error: any) => inAppScope([...holdSources, fn('async function runAccountActivation({ line = null } = {}) {')], 'runAccountActivation', {
      t, registerVaultKeysButton: el(), vaultDraftStatus: status, plathoWallet: { address: 'EQwallet' },
      submitVaultRegisterMessagingKeys: async () => { throw error; },
      noteTonRpcRateLimit: (e: any) => e?.rate === true,
      gramShortfallText: (e: any) => (e?.code === 'PLATHO_WALLET_GRAM_REQUIRED' ? 'Wallet needs ~0.07 GRAM' : null),
      refreshMessagingControls: () => refreshed.push(status.textContent),
      console: { error() {} },
      setTimeout: () => 0,
    })();
    await run({ code: 'PLATHO_WALLET_GRAM_REQUIRED' });
    expect(status.textContent).toBe('Wallet needs ~0.07 GRAM');
    await run({ rate: true });
    expect(status.textContent).toBe(t('errors.networkNotNow'));
    await run(new Error('boom'));
    expect(status.textContent).toBe(t('vault.activationBlocked'));
    expect(refreshed, 'the refresh after each attempt ran over the held words, and they stayed').toEqual([
      'Wallet needs ~0.07 GRAM', t('errors.networkNotNow'), t('vault.activationBlocked'),
    ]);
    const submit = fn('async function submitKeyShardRegisterDirect(');
    expect(submit).toMatch(/if \(registeredMine\) \{\s*\n[\s\S]{0,400}?holdStatusText\(vaultDraftStatus, t\('vault\.active'\)/);
  });

  const statusLine = () => el({ appended: [] as any[], append(this: any, ...items: any[]) { this.appended.push(...items); }, querySelector: () => null });
  const composer = (facts: Record<string, any>) => {
    const privateStatus = statusLine();
    const publicStatus = statusLine();
    const scope: Record<string, any> = {
      t, privateComposerCostStatus: privateStatus, publicComposerCostStatus: publicStatus, activeThreadId: 't1',
      privateComposerSendPlan: () => [], privateComposerPartLimitMessage: () => null, privateSendBlockReason: () => null,
      isPublicGroupThread: () => false, isRealSavedThread: () => false, publicComposerSendPlan: () => [], publicComposerPartLimitMessage: () => null,
      composerCostPrecondition: () => null,
      privateComposerFinalCostLine: () => ({ text: 'Cost 0.02 GRAM', state: 'ready' }),
      publicComposerFinalCostLine: () => ({ text: 'Cost 0.02 GRAM', state: 'ready' }),
      plathoWallet: { address: 'EQwallet' }, hasActivePlathoAccount: () => true, activationAnswerKnownFor: () => true,
      pendingServiceWorkerAppShellReload: false, tonRpcLimited: () => false, publicCommentTarget: null,
      TON_RPC_CONNECTING_STATUS: 'RPC busy - retrying', publicMessageInput: { value: '' }, publicImageAttachments: [],
      gramShortfallText: (e: any) => (e?.code === 'PLATHO_WALLET_GRAM_REQUIRED' ? 'Wallet needs ~0.05 GRAM' : null),
      setTimeout: () => 0,
      composerPricesMovedNotice: new Map(), writeGenerationNow: () => 18, speakToScreenReader: () => {},
      registerVaultKeysButton: el({ clicks: 0, click(this: any) { this.clicks += 1; } }),
      document: { createElement: () => el({ listeners: {} as Record<string, any>, addEventListener(this: any, type: string, run: any) { this.listeners[type] = run; } }) },
      walletLockedOnDevice: () => false, accountActivationInFlight: () => false, unlockWalletButton: null,
      runAccountActivation: async function (this: any) { scope.registerVaultKeysButton.clicks += 1; },
      ...facts,
    };
    const x = inAppScope([...holdSources, fn('function walletNeededReason('), fn('function walletUnlockAction('), fn('function activationComposerAction('), fn('function paintComposerCostLine('), fn('function refreshComposerCostStatus('), fn('function publicComposerBlockReason('),
      fn('function publicComposerHoldScope('), fn('function messageMetaReasonKey('), fn('function messageMetaReasonDisplayText('),
      fn('async function settlePrivateComposerSendError(')],
    '{ refreshComposerCostStatus, holdStatusText, releaseHeldStatus, settlePrivateComposerSendError, publicComposerBlockReason, publicComposerHoldScope }', scope);
    return { x, privateStatus, publicStatus, scope };
  };

  it('UI7-05: a private refusal stays under the composer through the controls refresh, in that chat only, until the person types', async () => {
    const { x, privateStatus, scope } = composer({
      noteTonRpcRateLimit: () => false, isRecoverablePrivateSendError: () => false,
      markPrivateMessageManualRecovery: () => {}, privateSendBlockedStatusText: () => 'not sent: Send blocked',
      privateSendPreflightStatusText: () => 'Send blocked', console: { error() {} },
    });
    scope.refreshMessagingControls = () => x.refreshComposerCostStatus();
    setLocale('ru');
    try {
      await x.settlePrivateComposerSendError({ thread: { id: 't1' }, message: { meta: 'sending' } }, new Error('Send blocked'));
      expect(privateStatus.textContent, 'translated, and not erased by the refresh').toBe(S.ru['messageMeta.reason.sendBlocked']);
    } finally { setLocale('en'); }
    await x.settlePrivateComposerSendError({ thread: { id: 't1' }, message: { meta: 'sending' } }, { code: 'PLATHO_WALLET_GRAM_REQUIRED' });
    expect(privateStatus.textContent, 'a shortfall is said with its figure, as the public twin says it').toBe('Wallet needs ~0.05 GRAM');
    scope.activeThreadId = 't2';
    x.refreshComposerCostStatus();
    expect(privateStatus.textContent, 'another chat gets its own price').toBe('Cost 0.02 GRAM');
    scope.activeThreadId = 't1';
    x.holdStatusText(privateStatus, 'refused', { scope: 't1' });
    x.releaseHeldStatus(privateStatus);
    x.refreshComposerCostStatus();
    expect(privateStatus.textContent).toBe('Cost 0.02 GRAM');
    for (const [head, holder] of [["messageInput?.addEventListener('input', (event) => {", 'privateComposerCostStatus'],
      ["publicMessageInput?.addEventListener('input', (event) => {", 'publicComposerCostStatus']]) {
      const body = listener(head, 'onInput');
      expect(body.indexOf(`releaseHeldStatus(${holder});`), head).toBeGreaterThan(0);
      expect(body.indexOf(`releaseHeldStatus(${holder});`), head).toBeLessThan(body.indexOf('refreshComposerCostStatus();'));
    }
  });

  it('UI7-06: the public composer says why it cannot publish — instead of a price under a dead button', () => {
    const unknown = composer({ hasActivePlathoAccount: () => false, activationAnswerKnownFor: () => false });
    unknown.x.refreshComposerCostStatus();
    expect(unknown.publicStatus.textContent).toBe(t('send.checkingActivation'));
    expect(unknown.publicStatus.dataset.state).toBe('short');
    expect(unknown.publicStatus.appended, 'nothing to press while the answer is unknown').toEqual([]);
    const inactive = composer({ hasActivePlathoAccount: () => false });
    inactive.x.refreshComposerCostStatus();
    expect(inactive.publicStatus.textContent).toBe(t('chat.activateBeforeSending'));
    const offered = inactive.publicStatus.appended.find((item: any) => item?.className === 'composer-cost-action');
    expect(offered?.textContent).toBe(t('wallet.activateAccount'));
    offered.listeners.click();
    expect(inactive.scope.registerVaultKeysButton.clicks).toBe(1);
    const busy = composer({ hasActivePlathoAccount: () => false, registerVaultKeysButton: el({ disabled: true }) });
    busy.x.refreshComposerCostStatus();
    expect(busy.publicStatus.appended, 'a button already busy is not offered twice').toEqual([]);
    expect(composer({ plathoWallet: null }).x.publicComposerBlockReason()).toBe(t('common.walletRequired'));
    expect(composer({ tonRpcLimited: () => true }).x.publicComposerBlockReason()).toBe('RPC busy - retrying');
    const button = el();
    inAppScope([fn('function refreshPublicSendButtonState(')], 'refreshPublicSendButtonState', {
      t, publicComposerSendBlocked: () => true, publicComposerHasSendableContent: () => true,
      publicComposer: { querySelector: () => button }, publicComposerBlockReason: () => 'why',
    })();
    expect([button.disabled, button.title]).toEqual([true, 'why']);
    const scopeOf = composer({}).x.publicComposerHoldScope;
    expect([scopeOf(null), scopeOf({ id: 'p1' })]).toEqual(['post', 'comment:p1']);
    const submit = listener("publicComposer?.addEventListener('submit', async (event) => {", 'onPublish');
    expect(submit).toMatch(/holdStatusText\(publicComposerCostStatus, rateLimited \? TON_RPC_CONNECTING_STATUS\s*\n\s*: \(gramShortfallText\(error\) \?\? messageMetaReasonDisplayText\(privateSendPreflightStatusText\(error\)\)\), \{\s*\n\s*scope: publicComposerHoldScope\(draftCommentTarget\),/);
  });

  it('UI7-13: wallet create, import and key-file failures are said where they are seen', () => {
    expect(listener("createWalletButton?.addEventListener('click', walletFlowOnce(async () => {", 'onCreate')).toMatch(/showAppNotice\(walletDeviceFaultWords\(error\) \?\? t\('wallet\.createFailed'\)\)/);
    expect(listener("importWalletButton?.addEventListener('click', walletFlowOnce(async () => {", 'onImport')).toMatch(/showAppNotice\(walletDeviceFaultWords\(error\) \?\? t\('wallet\.importFailed'\)\)/);
    expect(listener("walletKeyBackupInput?.addEventListener('change', walletFlowOnce(async () => {", 'onKeyFile')).toMatch(/showAppNotice\(walletDeviceFaultWords\(error\) \?\? t\('wallet\.keyFileImportFailed'\)\)/);
    expect(app, 'nothing lands in the export row any more').not.toMatch(/setText\(walletAddressStatus, t\('wallet\.importBlocked'\)\)/);
  });
});

describe('AUDIT ROUND 7 — notices, dialogs, times, toggles, targets', () => {
  const notice = () => {
    const frames: Array<() => void> = [];
    const timers: number[] = [];
    const target = el({ hidden: true });
    const x = inAppScope(['let appNoticeHideTimer = null;', 'let appNoticeFillToken = 0;', fn('function noticeReadingMs('), fn('function showAppNotice(')], 'showAppNotice', {
      appNotice: target, setText, requestAnimationFrame: (cb: () => void) => frames.push(cb),
      setTimeout: (_cb: any, ms: number) => { timers.push(ms); return timers.length; }, clearTimeout: () => {},
    });
    return { x, frames, timers, target };
  };

  it('UI7-07: a notice stays long enough to read, and is shown before it is filled', () => {
    const { x, frames, timers, target } = notice();
    const long = 'x'.repeat(100);
    x(long);
    expect(target.hidden, 'visible first').toBe(false);
    expect(target.textContent, 'filled a frame later, when the live region is in the tree').toBe('');
    frames.splice(0).forEach((f) => f());
    expect(target.textContent).toBe(long);
    expect(timers.at(-1)).toBe(2_000 + 55 * 100);
    x('Copied');
    expect(timers.at(-1)).toBe(2_000 + 55 * 6);
    x('y'.repeat(400));
    expect(timers.at(-1), 'the floor is capped').toBe(10_000);
    x('short', 15_000);
    expect(timers.at(-1), 'a caller asking for longer gets it').toBe(15_000);
    frames.length = 0;
    x('first');
    x('second');
    frames.splice(0).forEach((f) => f());
    expect(target.textContent).toBe('second');
    target.textContent = '';
    target.classes.clear();
    x('stale');
    x('');
    frames.splice(0).forEach((f) => f());
    expect([target.hidden, target.textContent, target.classes.has('is-visible')]).toEqual([true, '', false]);
    expect(fn('function flashWalletIdentityStatus(')).toMatch(/\}, noticeReadingMs\(status, durationMs\)\);/);
  });

  it('UI7-08: focus comes back to what opened a dialog — not to a text field, not after a chat took it', () => {
    class FakeElement { focused = 0; isConnected = true; isContentEditable = false; constructor(private sel = '') {}
      matches(s: string) { return this.sel !== '' && s.includes(this.sel); } closest() { return null; } focus() { this.focused += 1; } }
    const opener = new FakeElement();
    const documentStub: any = { activeElement: opener, body: {} };
    const x = inAppScope(['let newChatReturnFocus = null;', fn('function dialogReturnFocusTarget('), fn('function restoreDialogFocus('),
      fn('function openNewChatDialog('), fn('function closeNewChatDialog(')], '{ openNewChatDialog, closeNewChatDialog, restoreDialogFocus }', {
      t, HTMLElement: FakeElement, document: documentStub, newChatDialog: el(), recipientInput: el(), recipientHint: el(),
      recipientLocalLabel: el(), hideDialogAnimated: () => {}, requestAnimationFrame: () => 0, focusComposerField: () => {},
      walletUnlockAction: () => null,
    });
    x.openNewChatDialog();
    x.closeNewChatDialog({ restoreFocus: true });
    expect(opener.focused, 'the ✕ gives focus back').toBe(1);
    x.openNewChatDialog();
    x.closeNewChatDialog();
    expect(opener.focused, 'a chat that opened owns focus next').toBe(1);
    const field = new FakeElement('textarea');
    x.restoreDialogFocus(field);
    expect(field.focused, 'no keyboard raised by itself').toBe(0);
    expect(app).toMatch(/closeNewChatButton\?\.addEventListener\('click', \(\) => closeNewChatDialog\(\{ restoreFocus: true \}\)\);/);
    const open = fn('async function openActionDialog(');
    const captured = open.indexOf('const returnFocus = activeActionDialog?.returnFocus ?? (config.returnFocus instanceof HTMLElement ? config.returnFocus : null) ?? dialogReturnFocusTarget();');
    expect(captured, 'the line itself, not a line long gone').toBeGreaterThan(0);
    expect(captured).toBeLessThan(open.indexOf('if (activeActionDialog) closeActionDialog(null);'));
    const close = fn('function closeActionDialog(');
    expect(close.indexOf('restoreDialogFocus(returnFocus);')).toBeGreaterThan(0);
    expect(close.indexOf('restoreDialogFocus(returnFocus);')).toBeLessThan(close.indexOf('resolve(result);'));
    expect(html).toMatch(/<form class="recipient-dialog" id="newChatForm" role="dialog" aria-modal="true" aria-labelledby="newChatTitle" aria-describedby="recipientHint">/);
    expect(html).toMatch(/<h2 id="newChatTitle" data-i18n="dialog\.newChat">/);
    expect(html).toMatch(/<p id="recipientHint" aria-live="polite"/);
  });

  it('UI7-09: message clocks and the "saved" stamp use the reader\'s calendar and local time', () => {
    const clock = (locale: string) => inAppScope([fn('function threadListFormatOptions('), fn('function threadListFormatter('),
      'const threadListFormatters = new Map();', fn('function formatMessageClock('), fn('function prefsSyncedDateLabel(')],
    '{ formatMessageClock, prefsSyncedDateLabel }', { currentLocale: () => locale });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 3);
    const earlier = new Date(now.getFullYear(), now.getMonth(), now.getDate() === 1 ? 2 : 1, 9, 5);
    const lastYear = new Date(now.getFullYear() - 1, 8, 24, 9, 5);
    for (const locale of ['en', 'ru', 'ja']) {
      const f = clock(locale);
      expect(f.formatMessageClock(today.getTime())).toBe(new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(today));
      if (earlier.getDate() !== now.getDate()) {
        expect(f.formatMessageClock(earlier.getTime())).toBe(new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(earlier));
      }
      expect(f.formatMessageClock(lastYear.getTime())).toBe(new Intl.DateTimeFormat(locale, { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(lastYear));
      const sec = Math.floor(today.getTime() / 1000);
      expect(f.prefsSyncedDateLabel(sec), 'local, in the reader\'s format').toBe(new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(sec * 1000)));
    }
    expect(app, 'no UTC stamp without a zone').not.toMatch(/toISOString\(\)\.slice\(0, 16\)\.replace\('T', ' '\)/);
  });

  it('UI7-10: the comments toggle looks on when it is on, without :has() — and its rules survive a browser without it', () => {
    const toggle = el();
    const checkbox = { checked: true };
    const update = inAppScope([fn('function updatePublicCommentsToggleUi(')], 'updatePublicCommentsToggleUi', {
      t, publicPostCommentsToggle: toggle, publicComposerCommentsCheckbox: checkbox,
    });
    update();
    expect(toggle.classes.has('is-checked')).toBe(true);
    checkbox.checked = false;
    update();
    expect(toggle.classes.has('is-checked')).toBe(false);
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*\.composer-post-option\.is-checked[^{}]*)\{([^}]*)\}/g)];
    expect(rules.map((r) => r[1].trim())).toEqual(['.composer-post-option.is-checked::after', '.composer-post-option.is-checked']);
    for (const r of rules) expect(r[1]).not.toMatch(/:has\(/);
    expect(rules[0][2]).toMatch(/opacity: 0;/);
    expect(rules[1][2]).toMatch(/background: var\(--a16\);/);
  });

  it('UI7-12: Retry and Cancel under a failed message have a finger-sized target without overlapping each other', () => {
    const gap = Number(/\.message-actions \{[^}]*gap: (\d+)px;/.exec(css)![1]);
    const hit = /\.message-actions button::after \{[^}]*inset: -(\d+)px -(\d+)px;/.exec(css)!;
    expect(/\.message-actions button \{\s*position: relative;\s*\}/.test(css)).toBe(true);
    const lineBox = 20;
    expect(lineBox + 2 * Number(hit[1]), 'WCAG 2.5.8 asks for 24').toBeGreaterThanOrEqual(40);
    expect(2 * Number(hit[2]), 'two neighbours never share a pixel').toBeLessThanOrEqual(gap);
    expect(html, 'the saved-subscriptions status wraps at 375 px').toMatch(/<strong id="savePrefsStatus" class="profile-action-status"/);
  });

  it('UI7-16: a quick start closed before activation does not say "Setup complete"', () => {
    const flashed: string[] = [];
    const finish = (facts: Record<string, any>) => inAppScope([fn('function finishQuickStart(')], 'finishQuickStart', {
      t, clearQuickStartProgress: () => {}, closeQuickStart: () => {}, flashWalletIdentityStatus: (s: string) => flashed.push(s),
      hasActivePlathoAccount: () => false, plathoAccountActivationPending: false, plathoActivationInFlightForCurrentWallet: () => false,
      ...facts,
    })();
    finish({});
    finish({ hasActivePlathoAccount: () => true });
    finish({ plathoAccountActivationPending: true });
    expect(flashed).toEqual([t('quickstart.setupLater'), t('quickstart.setupComplete'), t('quickstart.setupComplete')]);
  });
});

describe('AUDIT ROUND 7 — CapsuleHub does not exist', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (path.replaceAll('\\', '/').startsWith('web/vendor')) continue;
      if (statSync(path).isDirectory()) walk(path, out); else out.push(path);
    }
    return out;
  };

  it('UI7-14: the shipped client never names it — not in copy, code, comments or docs', () => {
    const offenders: string[] = [];
    for (const path of walk('web')) {
      if (!/\.(m?js|html|css|md|json|webmanifest|txt)$/.test(path)) continue;
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => { if (/capsule[\s_-]*hub/i.test(line)) offenders.push(`${path}:${i + 1}`); });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
    for (const code of LOCALES) {
      for (const [key, value] of Object.entries(S[code])) expect(/capsule[\s_-]*hub/i.test(value), `${code}:${key}`).toBe(false);
    }
  });

  it('UI7-14B: the decoder renamed with it still reads as unreadable to the classifier — nothing moved from permanent to transient', async () => {
    const classify = inAppScope([fn('function isPrivateUnreadableCapsuleError(')], 'isPrivateUnreadableCapsuleError', {
      PLATHO_CAPSULE_CLOCK_SKEW_CODE, PLATHO_CAPSULE_UNREADABLE_CODE, isPrivateOpenKeyMismatchError: () => false,
    });
    const missing = await privateCapsuleFromChainEntry({ exists: false }).catch((e: any) => e);
    expect(String(missing.message)).toBe('Private chain entry does not exist');
    expect(classify(missing)).toBe(true);
    for (const message of ['Private chain entry size class mismatch', 'Private chain entry crypto suite mismatch', 'Private chain entry body hash mismatch',
      'Private entry header0 is not a Platho snake byte cell', 'Private capsule size class and crypto suite do not match the protocol rules']) {
      expect(classify(new Error(message)), message).toBe(true);
    }
    expect(classify(new Error('Private entry body is not a Platho snake byte cell')), 'the body label kept its old (transient) reading').toBe(false);
  });
});

describe('AUDIT ROUND 7 — a reply to a comment can be sent', () => {
  const commentId = `c-${'3fa9'.repeat(16)}`;

  it('UI7-15: a text entry id travels as v2, a decimal one stays v1, both round-trip', () => {
    const v1 = encodeReplyBlockContent({ refEntryId: '42', author: 'a', snippet: 's' });
    expect(v1[0]).toBe(REPLY_BLOCK_CONTENT_VERSION);
    expect(decodeReplyBlockContent(v1)).toEqual({ refEntryId: '42', author: 'a', snippet: 's' });
    for (const id of [commentId, '688.0.1']) {
      const v2 = encodeReplyBlockContent({ refEntryId: id, author: 'Zoë 🌍', snippet: 'ok' });
      expect(v2[0]).toBe(REPLY_BLOCK_CONTENT_VERSION_TEXT_ID);
      expect(decodeReplyBlockContent(v2)).toEqual({ refEntryId: id, author: 'Zoë 🌍', snippet: 'ok' });
    }
    expect(encodeReplyBlockContent({ refEntryId: commentId })[0]).not.toBe(REPLY_BLOCK_CONTENT_VERSION);
    for (const bad of ['-1', '', '18446744073709551616', 'a'.repeat(REPLY_ENTRY_ID_MAX_BYTES + 1), 'x"]', 'c-1 2']) {
      expect(() => encodeReplyBlockContent({ refEntryId: bad }), bad).toThrow();
    }
    const hostile = new Uint8Array([2, 3, 0x61, 0x22, 0x5d, 0, 0x68, 0x69]);
    expect(decodeReplyBlockContent(hostile)).toBe(null);
    expect(decodeReplyBlockContent(new Uint8Array([2, 90, 0x61]))).toBe(null);
  });

  it('UI7-15B: the real document path carries a reply to a comment — it threw BigInt(\'c-…\') before', () => {
    const start = app.indexOf('const PLATHO_DOCUMENT_MAGIC');
    const end = app.indexOf('\n}\n', app.indexOf('function decodeMessageDocumentBlocks(')) + 3;
    const codec = inAppScope([app.slice(start, end)], '{ encodeMessageDocumentBlocks, decodeMessageDocumentBlocks }', {
      encodeReplyBlockContent, decodeReplyBlockContent, encodeFileBlockContent, decodeFileBlockContent,
      encodeProfileBlockContent, decodeProfileBlockContent, encodeShareBlockContent, decodeShareBlockContent,
      PLATHO_COMPACT_IMAGE_FORMATS, canonicalUsernameDisplay: (s: string) => s,
    });
    const blocks = [{ type: 'reply', refEntryId: commentId, author: 'Zoë 🌍', snippet: 'ok' }, { type: 'text', text: 'and me' }];
    const bytes = codec.encodeMessageDocumentBlocks(blocks);
    const back = codec.decodeMessageDocumentBlocks(bytes, { tolerateUnknownBlocks: true });
    expect(back.find((b: any) => b.type === 'reply')).toEqual({ type: 'reply', refEntryId: commentId, author: 'Zoë 🌍', snippet: 'ok' });
    expect(fn('function composerBlocksFromDraft(')).toMatch(/blocks\.unshift\(\{ type: 'reply', refEntryId: String\(replyDraft\.refEntryId\)/);
  });
});

describe('AUDIT ROUND 7 — the private list opens with two buttons', () => {
  it('UI7-22: Add contact and New group, one row — nothing to read before them, one line where both fit and a line each where they do not', () => {
    const calls: string[] = [];
    const make = (tag: string) => {
      const n: any = el({ tag, children: [] as any[], listeners: {} as Record<string, () => void> });
      n.append = (...kids: any[]) => { n.children.push(...kids); };
      n.addEventListener = (type: string, listener: () => void) => { n.listeners[type] = listener; };
      return n;
    };
    const ensure = inAppScope(['let privateListActions = null;', fn('function ensurePrivateListActions(')], 'ensurePrivateListActions', {
      document: { createElement: (tag: string) => make(tag) },
      t: (key: string) => `<${key}>`,
      openNewChatDialog: () => { calls.push('new chat'); },
      openCreateGroupDialog: async (kind: string) => { calls.push(`new group ${kind}`); },
    });
    const row = ensure();
    expect(ensure(), 'one node, kept across renders — its listeners survive').toBe(row);
    expect(row.className).toBe('private-list-actions');
    expect(row.children.map((b: any) => [b.tag, b.type, b.className, b.attrs['data-i18n'], b.textContent])).toEqual([
      ['button', 'button', 'discovery-cta-action', 'chat.contactCtaAction', '<chat.contactCtaAction>'],
      ['button', 'button', 'discovery-cta-action', 'group.createAction', '<group.createAction>'],
    ]);
    row.children[0].listeners.click();
    row.children[1].listeners.click();
    expect(calls).toEqual(['new chat', 'new group private']);
    const render = fn('function renderThreadsNow(');
    expect(render).toMatch(/const entries = walletLockedOnDevice\(\) \? \[\{[\s\S]{0,300}?\}\] : \[\];\s*\n\s*entries\.push\(\{\s*\n(?:\s*\/\/[^\n]*\n)*\s*key: 'cta',\s*\n\s*sig: 'cta',\s*\n\s*build: \(\) => ensurePrivateListActions\(\),\s*\n\s*adopt: \(\) => \{\},\s*\n\s*\}\);/);
    expect(render).toContain('ensurePrivateListActions().hidden = q.length > 0;');
    expect(app).not.toMatch(/ensureContactCtaCard|ensureGroupCtaCard|chat\.contactCtaTitle|chat\.contactCtaBody/);
    for (const locale of LOCALES) {
      expect(S[locale]['chat.contactCtaTitle'], locale).toBeUndefined();
      expect(S[locale]['chat.contactCtaBody'], locale).toBeUndefined();
      expect(S[locale]['chat.contactCtaAction'], locale).toBeTruthy();
      expect(S[locale]['group.createAction'], locale).toBeTruthy();
    }
    const rule = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf('}', at) + 1);
    };
    expect(rule('.private-list-actions')).toMatch(/display: flex;\s*flex-wrap: wrap;/);
    expect(rule('.private-list-actions[hidden]')).toContain('display: none;');
    const button = rule('.private-list-actions .discovery-cta-action');
    expect(button).toContain('flex: 1 1 0;');
    expect(button).toMatch(/min-width: max-content;\s*min-width: fit-content;/);
    expect(button).toContain('white-space: normal;');
    expect(css, 'the plates\' own glow went with them').not.toMatch(/\.contact-cta|ctaDriftAlt/);
  });
});

describe('AUDIT ROUND 7 — what a screen reader hears', () => {
  const recorder = () => {
    const writes: string[] = [];
    const node: any = { _text: '', writes };
    Object.defineProperty(node, 'textContent', { get() { return node._text; }, set(value: string) { writes.push(String(value)); node._text = String(value); } });
    return node;
  };
  const tagOf = (id: string) => {
    const match = html.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`));
    if (!match) throw new Error(`#${id} is not in the page`);
    return match[0];
  };

  it('UI7-17: no painted list is a live region — the strip, the card\'s lists and the document are quiet; short lines speak', () => {
    for (const id of ['messageStrip', 'profileCardNames', 'profileCardGifts', 'docsContent']) {
      expect(tagOf(id), `#${id} is repainted whole — as a live region every paint was read aloud`).not.toMatch(/aria-live|role="(log|status|alert)"/);
    }
    expect(tagOf('chatAnnouncer')).toMatch(/class="sr-only"/);
    expect(tagOf('chatAnnouncer')).toMatch(/role="status"/);
    expect(tagOf('chatAnnouncer')).toMatch(/aria-live="polite"/);
    expect(tagOf('chatAnnouncer')).toMatch(/aria-atomic="true"/);
    expect(tagOf('docsAnnouncer')).toMatch(/class="sr-only"/);
    expect(tagOf('docsAnnouncer')).toMatch(/role="status"/);
    expect(tagOf('profileCardMeta'), 'the card\'s one status line').toMatch(/role="status"/);
    const live = [...html.matchAll(/<[a-z]+\b[^>]*(?:aria-live="[a-z]+"|role="(?:status|log|alert)")[^>]*>/g)].map((m) => (m[0].match(/\bid="([^"]+)"/) ?? [])[1] ?? '(no id)');
    expect(live.sort()).toEqual(['appNotice', 'bootElsewhereStatus', 'chatAnnouncer', 'docsAnnouncer', 'profileCardMeta', 'quickStartStepStatus', 'recipientHint']);
    expect(css).toMatch(/\.sr-only \{[^}]*clip: rect\(0, 0, 0, 0\);/);
    expect(css).not.toMatch(/\.sr-only \{[^}]*display: none/);
    expect(app).toContain("const chatAnnouncer = document.querySelector('#chatAnnouncer');");
    expect(app).toContain("const docsAnnouncer = document.querySelector('#docsAnnouncer');");
  });

  it('UI7-18: a message arriving in the dialog on screen is said — one sentence, or a count for a burst; elsewhere it is unread, and a dialog left meanwhile hears nothing', () => {
    const announcer = recorder();
    let visible = true;
    const thread: any = { id: 'dm:a', messages: [], unreadCount: 0 };
    const other: any = { id: 'dm:b', messages: [], unreadCount: 0 };
    const saved: any = { id: 'saved', messages: [], unreadCount: 0 };
    let onScreen: any = thread;
    const timers: Array<() => void> = [];
    const run = () => { while (timers.length > 0) timers.shift()!(); };
    const scope: any = {
      chatAnnouncer: announcer, threads: [thread, other, saved],
      isSavedMessagesThread: (t: any) => t === saved, isThreadMuted: (t: any) => t.muted === true,
      isThreadConversationVisible: (t: any) => Boolean(t) && (t === onScreen || t === saved) && visible,
      threadUnreadCount: (t: any) => t.unreadCount ?? 0,
      messageSenderLabel: (m: any) => (m?.type === 'in' && typeof m?.senderLabel === 'string' ? m.senderLabel : ''), threadDisplayLabel: () => 'Alice',
      groupTokenPreviewText: () => '', messagePreviewFromBlocks: () => '', messagePreviewText: (text: string) => text,
      t: (key: string, params: any) => `${key}${params ? ` ${JSON.stringify(params)}` : ''}`, tPlural: (key: string, n: number) => `${key}#${n}`,
      setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; }, clearTimeout: () => {},
      plathoWallet: null, walletSessionGeneration: 0,
    };
    const api = inAppScope([
      'const CHAT_SPOKEN_GATHER_MS = 1500;', 'const CHAT_SPOKEN_TEXT_MAX = 280;', 'let chatSpokenArrivals = null;',
      fn('function markIncomingThreadMessage('), fn('function speakToScreenReader('), fn('function noteArrivalSpoken('), fn('function sayArrivals('), fn('function messagePreviewLine('),
    ], '{ markIncomingThreadMessage }', scope);
    api.markIncomingThreadMessage(thread, { type: 'in', text: 'hello there' });
    expect(thread.unreadCount).toBe(0);
    expect(announcer.writes, 'gathered first, said after').toEqual([]);
    run();
    expect(announcer.writes).toEqual(['', 'chat.spokenIncoming {"name":"Alice","text":"hello there"}']);
    for (const text of ['a', 'b', 'c']) api.markIncomingThreadMessage(thread, { type: 'in', text });
    run();
    expect(announcer.textContent).toBe('chat.spokenIncomingMany#3');
    api.markIncomingThreadMessage(thread, { type: 'in', text: '', senderLabel: 'Bob' });
    run();
    expect(announcer.textContent).toBe('chat.spokenIncomingNoText {"name":"Bob"}');
    api.markIncomingThreadMessage(thread, { type: 'in', text: 'x'.repeat(1000) });
    run();
    expect(JSON.parse(announcer.textContent.slice('chat.spokenIncoming '.length)).text).toHaveLength(280);
    const heard = announcer.writes.length;
    api.markIncomingThreadMessage(other, { type: 'in', text: 'psst' });
    run();
    expect(other.unreadCount).toBe(1);
    expect(announcer.writes).toHaveLength(heard);
    other.muted = true;
    api.markIncomingThreadMessage(other, { type: 'in', text: 'quiet' });
    expect(other.unreadCount).toBe(1);
    thread.muted = true;
    api.markIncomingThreadMessage(thread, { type: 'in', text: 'still news' });
    run();
    expect(announcer.textContent).toBe('chat.spokenIncoming {"name":"Alice","text":"still news"}');
    const before = announcer.writes.length;
    api.markIncomingThreadMessage(saved, { type: 'in', text: 'a note' });
    run();
    expect(announcer.writes).toHaveLength(before);
    expect(saved.unreadCount).toBe(0);
    api.markIncomingThreadMessage(thread, { type: 'in', text: 'from a' });
    onScreen = other;
    api.markIncomingThreadMessage(other, { type: 'in', text: 'from b' });
    run();
    expect(announcer.textContent).toBe('chat.spokenIncoming {"name":"Alice","text":"from b"}');
    onScreen = thread;
    const beforeLeaving = announcer.writes.length;
    api.markIncomingThreadMessage(thread, { type: 'in', text: 'late' });
    visible = false;
    run();
    expect(announcer.writes).toHaveLength(beforeLeaving);
  });

  it('UI7-19: a send of one\'s own that failed is said once — not when the dialog opens on it, not on the next paint, not for anybody else\'s row', () => {
    const announcer = recorder();
    let visible = true;
    const api = inAppScope([
      'const CHAT_SPOKEN_STATUS_TAIL = 50;', 'const spokenSendStatus = new WeakMap();', fn('function speakToScreenReader('), fn('function sayFailedSends('),
      fn('function messageIsPartlySent('),
    ], '{ sayFailedSends }', {
      chatAnnouncer: announcer, isThreadConversationVisible: () => visible, messageStatusKey: (m: any) => m.status,
      tPlural: (key: string, n: number) => `${key}#${n}`, setTimeout: (callback: () => void) => { callback(); return 1; },
      plathoWallet: null, walletSessionGeneration: 0,
    });
    const failedBefore = { type: 'out', status: 'failed' };
    const sending: any = { type: 'out', status: 'sending' };
    const theirs: any = { type: 'in', status: 'sending' };
    const thread = { messages: [failedBefore, sending, theirs] as any[] };
    api.sayFailedSends(thread, true);
    expect(announcer.writes, 'the dialog opens on a red row: not news').toEqual([]);
    api.sayFailedSends(thread, false);
    expect(announcer.writes, 'a paint that changed nothing').toEqual([]);
    theirs.status = 'failed';
    sending.status = 'failed';
    api.sayFailedSends(thread, false);
    expect(announcer.writes, 'said once, and only for one\'s own').toEqual(['', 'chat.spokenNotSent#1']);
    api.sayFailedSends(thread, false);
    expect(announcer.writes).toHaveLength(2);
    const a: any = { type: 'out', status: 'sending' };
    const b: any = { type: 'out', status: 'sending' };
    thread.messages.push(a, b);
    api.sayFailedSends(thread, false);
    a.status = 'failed';
    b.status = 'failed';
    sending.status = 'sending';
    api.sayFailedSends(thread, false);
    expect(announcer.textContent).toBe('chat.spokenNotSent#2');
    sending.status = 'failed';
    api.sayFailedSends(thread, false);
    expect(announcer.textContent).toBe('chat.spokenNotSent#1');
    thread.messages.push({ type: 'out', status: 'failed' });
    const quiet = announcer.writes.length;
    api.sayFailedSends(thread, false);
    expect(announcer.writes).toHaveLength(quiet);
    const away: any = { type: 'out', status: 'sending' };
    thread.messages.push(away);
    api.sayFailedSends(thread, false);
    away.status = 'failed';
    api.sayFailedSends(thread, true);
    expect(announcer.writes, 'the dialog reopened on it').toHaveLength(quiet);
    const c: any = { type: 'out', status: 'sending' };
    thread.messages.push(c);
    api.sayFailedSends(thread, false);
    c.status = 'failed';
    visible = false;
    const heard = announcer.writes.length;
    api.sayFailedSends(thread, false);
    expect(announcer.writes).toHaveLength(heard);
    visible = true;
    const old: any = { type: 'out', status: 'sending' };
    const long = { messages: [old, ...Array.from({ length: 60 }, () => ({ type: 'out', status: 'confirmed' }))] as any[] };
    api.sayFailedSends(long, false);
    old.status = 'failed';
    api.sayFailedSends(long, false);
    expect(announcer.writes).toHaveLength(heard);
    expect(fn('function renderConversation(')).toContain(`  const stripDelta = reconcileKeyedRows(messageStrip, stripEntries);
  sayFailedSends(thread, conversationThreadChanged);`);
  });

  it('UI7-20: a document is read when reached, not as it paints — only a failure to load one is said', () => {
    const docsAnnouncer = recorder();
    const setDocsStatus = inAppScope([fn('function setDocsStatus(')], 'setDocsStatus', {
      docsContent: { replaceChildren: () => {} }, docsAnnouncer, document: { createElement: () => el() },
    });
    setDocsStatus('Loading');
    expect(docsAnnouncer.textContent).toBe('');
    setDocsStatus('Unavailable', 'error');
    expect(docsAnnouncer.textContent).toBe('Unavailable');
    setDocsStatus('Loading');
    expect(docsAnnouncer.textContent).toBe('');
    expect(fn('async function openDocsDialog(')).toContain('requestAnimationFrame(() => docsContent?.focus());');
  });

  it('UI7-21: every arrival hands its message to the marker, and the words are there in every language', () => {
    const calls = [...app.matchAll(/markIncomingThreadMessage\(([^)]*)\)/g)].map((m) => m[1]).filter((args) => args !== 'thread, message = null');
    expect(calls.length, 'the two private lanes, the first contact, both room folds').toBeGreaterThanOrEqual(5);
    for (const args of calls) expect(args.split(',').map((a) => a.trim()), args).toHaveLength(2);
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(S[locale])) if (key.startsWith('chat.spoken') && key.includes('#')) expect(value, `${locale}:${key}`).toContain('{count}');
      expect(S[locale]['chat.spokenIncoming'], locale).toMatch(/\{name\}[\s\S]*\{text\}|\{text\}[\s\S]*\{name\}/);
      expect(S[locale]['chat.spokenIncomingNoText'], locale).toContain('{name}');
      expect(S[locale]['chat.spokenIncomingMany#other'], locale).toContain('{count}');
      expect(S[locale]['chat.spokenNotSent#other'], locale).toContain('{count}');
    }
    try {
      setLocale('ru');
      expect(tPlural('chat.spokenIncomingMany', 3)).toBe(S.ru['chat.spokenIncomingMany#few'].replace('{count}', '3'));
      expect(tPlural('chat.spokenIncomingMany', 5)).toBe(S.ru['chat.spokenIncomingMany#many'].replace('{count}', '5'));
      expect(tPlural('chat.spokenNotSent', 21)).toBe(S.ru['chat.spokenNotSent#one'].replace('{count}', '21'));
      setLocale('en');
      expect(tPlural('chat.spokenNotSent', 1)).toBe('1 message not sent');
      expect(t('chat.spokenIncoming', { name: 'Alice', text: 'hi' })).toBe('New message from Alice: hi');
    } finally { setLocale('en'); }
  });
});
