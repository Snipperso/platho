import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { encodeGroupAskToken, groupAskLink, parseGroupAskLink } from '../web/group-protocol.mjs';
import { encodePublicGroupJoinToken, publicGroupJoinLink, parsePublicGroupJoinLink } from '../web/public-group-protocol.mjs';


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
const ORIGIN = 'https://platho.app';
const WALLET = `0:${'ab'.repeat(32)}`;

function build({ startParam = null, telegram = false, miniAppLink = null, pathname = '/' }: { startParam?: string | null; telegram?: boolean; miniAppLink?: string | null; pathname?: string } = {}) {
  const replaced: string[] = [];
  const src = [
    constLine('TELEGRAM_START_PARAM_MAX'), constLine('TELEGRAM_START_PARAM_RE'),
    constLine('PERMALINK_RESERVED_SEGMENTS'), constLine('PUBLIC_POST_PERMALINK_RE'), constLine('PUBLIC_CHANNEL_PERMALINK_USERNAME_RE'),
    fn('function bytesToBase64Url(bytes) {'), fn('function base64UrlToBytes(value) {'),
    fn('function parsePublicPostPermalink(pathname) {'), fn('function parsePublicChannelPermalink(pathname) {'),
    fn('function telegramStartParamForPath(path) {'), fn('function pathFromTelegramStartParam(param) {'),
    fn('function applyTelegramStartParamToLocation() {'), fn('function telegramMiniAppLinkFor(url) {'), fn('function telegramSharedLinkFor(url) {'),
    'return { telegramStartParamForPath, pathFromTelegramStartParam, applyTelegramStartParamToLocation, telegramMiniAppLinkFor, telegramSharedLinkFor };',
  ].join('\n');
  const env: Record<string, any> = {
    parseGroupAskLink, parsePublicGroupJoinLink,
    rawWalletAddress: (value: any) => (/^0:[0-9a-f]{64}$/i.test(String(value ?? '')) ? String(value).toLowerCase() : null),
    telegramWebApp: () => (telegram ? { initDataUnsafe: startParam === null ? {} : { start_param: startParam } } : null),
    isTelegramEnv: () => telegram,
    location: { pathname, origin: ORIGIN },
    history: { replaceState: (_state: any, _title: string, path: string) => { replaced.push(path); } },
    appConfig: { telegram: { miniAppLink } },
    console: { warn: () => {} },
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, src)(...names.map((name) => env[name]));
  return { api, replaced };
}

const friendly = new Address(0, Buffer.alloc(32, 0xab)).toString({ bounceable: false, urlSafe: true });
const askPath = new URL(groupAskLink(ORIGIN, encodeGroupAskToken({ groupId: 'cd'.repeat(32), wallet: friendly, name: 'the kitchen' }))).pathname;
const joinPath = new URL(publicGroupJoinLink(ORIGIN, encodePublicGroupJoinToken({ groupId: new Uint8Array(32).fill(0x11), founder: new Uint8Array(32).fill(0x22), foundedEra: 694, name: 'the square' }))).pathname;

describe('TELEGRAM DEEP LINKS — one router, whatever the door', () => {
  it('TG-LINK-01: every shape the address bar accepts survives the round trip through start_param', () => {
    const { api } = build();
    for (const path of ['/alice~k9f2/688.0.1', `/${WALLET}/688.0.1.18`, '/alice', `/${WALLET}`, askPath, joinPath]) {
      const param = api.telegramStartParamForPath(path);
      expect(param, path).toMatch(/^[A-Za-z0-9_-]{1,512}$/);
      expect(api.pathFromTelegramStartParam(param), path).toBe(path);
    }
  });

  it('TG-LINK-02: anything that is not one of the four shapes is refused — another bot\'s parameter, an asset, a query, noise', () => {
    const { api } = build();
    const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64url');
    for (const param of ['ref123', encode('app.js'), encode('favicon.ico'), encode('alice?x=1'), encode('alice#frag'), encode('a b'), encode(''), encode('privacy'), encode('/alice'), 'not base64url!', '', encode('x'.repeat(2000))]) {
      expect(api.pathFromTelegramStartParam(param), JSON.stringify(param).slice(0, 40)).toBeNull();
    }
    expect(api.pathFromTelegramStartParam(null)).toBeNull();
    expect(api.pathFromTelegramStartParam(42)).toBeNull();
    expect(api.telegramStartParamForPath(`/join/${'A'.repeat(600)}`)).toBeNull();
    expect(api.telegramStartParamForPath('/')).toBeNull();
    expect(api.telegramStartParamForPath('alice')).toBeNull();
    expect(api.telegramStartParamForPath('/alice?x=1')).toBeNull();
  });

  it('TG-LINK-03: on boot the parameter becomes the address bar — only at the root, only in Telegram, only for a known shape', () => {
    const param = build().api.telegramStartParamForPath('/alice~k9f2/688.0.1');
    const routed = build({ telegram: true, startParam: param });
    expect(routed.api.applyTelegramStartParamToLocation()).toBe(true);
    expect(routed.replaced).toEqual(['/alice~k9f2/688.0.1']);
    const explicit = build({ telegram: true, startParam: param, pathname: '/bob' });
    expect(explicit.api.applyTelegramStartParamToLocation(), 'an explicit path in the bar wins').toBe(false);
    expect(explicit.replaced).toEqual([]);
    const outside = build({ telegram: false, startParam: param });
    expect(outside.api.applyTelegramStartParamToLocation()).toBe(false);
    expect(outside.replaced).toEqual([]);
    const noise = build({ telegram: true, startParam: 'ref123' });
    expect(noise.api.applyTelegramStartParamToLocation()).toBe(false);
    expect(noise.replaced).toEqual([]);
    const none = build({ telegram: true });
    expect(none.api.applyTelegramStartParamToLocation()).toBe(false);
  });

  it('TG-LINK-04: outbound, the mini-app form appears only inside Telegram and only once the app has its own t.me link', () => {
    const unconfigured = build({ telegram: true });
    expect(unconfigured.api.telegramMiniAppLinkFor(`${ORIGIN}/alice`)).toBeNull();
    expect(unconfigured.api.telegramSharedLinkFor(`${ORIGIN}/alice`), 'nothing configured: the https link, unchanged').toBe(`${ORIGIN}/alice`);
    const configured = build({ telegram: true, miniAppLink: 'https://t.me/PlathoBot/app/' });
    const shared = configured.api.telegramSharedLinkFor(`${ORIGIN}/alice~k9f2/688.0.1`);
    expect(shared).toMatch(/^https:\/\/t\.me\/PlathoBot\/app\?startapp=[A-Za-z0-9_-]+$/);
    expect(configured.api.pathFromTelegramStartParam(new URL(shared).searchParams.get('startapp')), 'and it decodes back to the same path').toBe('/alice~k9f2/688.0.1');
    expect(configured.api.telegramMiniAppLinkFor('https://evil.example/alice'), 'only this app\'s own links').toBeNull();
    expect(configured.api.telegramMiniAppLinkFor('not a url')).toBeNull();
    expect(configured.api.telegramMiniAppLinkFor(`${ORIGIN}/`)).toBeNull();
    const browser = build({ telegram: false, miniAppLink: 'https://t.me/PlathoBot/app' });
    expect(browser.api.telegramSharedLinkFor(`${ORIGIN}/alice`), 'outside Telegram a link is the link').toBe(`${ORIGIN}/alice`);
  });

  it('TG-LINK-05: the wiring — the boot reads the parameter before the four readers, every outbound link passes through, and the config slot exists', () => {
    const boot = app.slice(app.indexOf('applyTelegramStartParamToLocation();'), app.indexOf('applyTelegramStartParamToLocation();') + 900);
    expect(boot).toContain('const ask = parseGroupAskLink(location.pathname) ?? parsePublicGroupJoinLink(location.pathname);');
    expect(boot).toContain('const link = parsePublicPostPermalink(location.pathname);');
    expect(boot).toContain('const channelLink = parsePublicChannelPermalink(location.pathname);');
    expect(app.split('applyTelegramStartParamToLocation();').length - 1, 'called once, at boot').toBe(1);
    const share = fn('async function shareLinkOutOfPlatho(url, title = \'\') {');
    expect(share).toContain('const link = telegramSharedLinkFor(url);');
    expect(share).toContain('await navigator.share(heading ? { title: heading, url: link } : { url: link });');
    expect(share).toContain('await copyTextToClipboard(link);');
    expect(share, 'the raw url is never the one shared').not.toMatch(/navigator\.share\([^)]*\burl \}/);
    expect(app.split('link = telegramSharedLinkFor(link);').length - 1, 'both group link dialogs').toBe(2);
    expect(PLATHO_APP_CONFIG.telegram).toEqual({ miniAppLink: 'https://t.me/PlathoBot', botId: PLATHO_APP_CONFIG.telegram.botId });
    expect(PLATHO_APP_CONFIG.telegram.botId).toMatch(/^[1-9][0-9]{0,19}$/);
    const live = build({ telegram: true, miniAppLink: PLATHO_APP_CONFIG.telegram.miniAppLink });
    const shared = live.api.telegramSharedLinkFor(`${ORIGIN}/platho`);
    expect(shared).toMatch(/^https:\/\/t\.me\/PlathoBot\?startapp=[A-Za-z0-9_-]+$/);
    expect(new URL(shared).searchParams.get('startapp')).toBe(Buffer.from('platho', 'utf8').toString('base64url'));
  });
});
