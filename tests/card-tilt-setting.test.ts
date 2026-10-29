import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const iife = (start: string) => {
  const at = app.indexOf(start);
  const end = app.indexOf('\n})();\n', at);
  return app.slice(at, end + 6);
};

function world({ off = false } = {}) {
  const store = new Map<string, string>(off ? [['platho.cardTilt.v1', 'off']] : []);
  const windowListeners = new Map<string, any>();
  const cardListeners = new Map<string, any>();
  const written: Array<[string, string]> = [];
  const frames: Array<() => void> = [];
  const card = {
    style: { setProperty: (name: string, value: string) => written.push([name, value]) },
    addEventListener: (name: string, handler: any) => cardListeners.set(name, handler),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }),
  };
  const env: Record<string, any> = {
    localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) },
    globalThis: { matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)', addEventListener() {} }), DeviceOrientationEvent: function DeviceOrientationEvent() {} },
    window: { addEventListener: (name: string, handler: any) => windowListeners.set(name, handler), removeEventListener: (name: string) => windowListeners.delete(name) },
    document: { visibilityState: 'visible', addEventListener: () => {} },
    requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; },
    isTelegramEnv: () => false, telegramWebApp: () => null, telegramSupports: () => false, WALLET_CARD_TILT_FULL_DEG: 30,
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, ["const CARD_TILT_KEY = 'platho.cardTilt.v1';", fn('function cardTiltOff() {'), 'const cardTiltRests = new Set();',
    fn('function applyCardTiltSetting() {'), iife('const cardTiltSensor = (() => {'), fn('function pageOnScreen() {'), fn('function installCardTilt(card, shown) {'),
    'return { cardTiltSensor, installCardTilt, applyCardTiltSetting };'].join(NL))(...names.map((n) => env[n]));
  const run = () => { for (let i = 0; i < 400 && frames.length; i += 1) frames.shift()!(); };
  const last = () => Object.fromEntries(written);
  return { api, store, windowListeners, cardListeners, card, run, last, written };
}

describe('Card tilt: off for a slow device', () => {
  it('TILTOFF-01: on, the sensor starts and the card leans; off, the sensor never starts and the mouse leans nothing', () => {
    const on = world();
    const tilt = on.api.installCardTilt(on.card, () => true);
    tilt.setActive(true);
    expect(on.windowListeners.has('deviceorientation'), 'on: the phone is followed').toBe(true);
    on.windowListeners.get('deviceorientation')({ beta: 40, gamma: 0 });
    on.windowListeners.get('deviceorientation')({ beta: 40, gamma: 15 });
    on.run();
    expect(Number(on.last()['--tilt-x'])).toBeGreaterThan(0.3);
    const off = world({ off: true });
    const still = off.api.installCardTilt(off.card, () => true);
    still.setActive(true);
    expect(off.windowListeners.has('deviceorientation'), 'off: no sensor').toBe(false);
    off.cardListeners.get('pointermove')({ pointerType: 'mouse', clientX: 100, clientY: 50, target: { closest: () => null } });
    off.run();
    expect(off.written.every(([, value]) => Number(value) === 0), 'off: the mouse leans nothing').toBe(true);
  });

  it('TILTOFF-02: turned off, a leaning card eases back flat and the sensor stops; turned on again, it starts', () => {
    const w = world();
    const tilt = w.api.installCardTilt(w.card, () => true);
    tilt.setActive(true);
    w.windowListeners.get('deviceorientation')({ beta: 40, gamma: 0 });
    w.windowListeners.get('deviceorientation')({ beta: 40, gamma: 20 });
    w.run();
    expect(Number(w.last()['--tilt-x'])).toBeGreaterThan(0.3);
    w.store.set('platho.cardTilt.v1', 'off');
    w.api.applyCardTiltSetting();
    w.run();
    expect(w.windowListeners.has('deviceorientation'), 'the sensor stopped').toBe(false);
    expect(Math.abs(Number(w.last()['--tilt-x'])), 'flat').toBeLessThan(0.01);
    w.store.delete('platho.cardTilt.v1');
    w.api.applyCardTiltSetting();
    expect(w.windowListeners.has('deviceorientation'), 'on again: followed again').toBe(true);
  });

  it('TILTOFF-03: the row in Appearance, its words in every language, and the choice kept on this device', () => {
    expect(html).toContain('<select id="appearanceCardTiltSelect">');
    expect(html).toContain('<option value="off" data-i18n="appearance.cardTiltOff">');
    for (const [locale, strings] of Object.entries(I18N_STRINGS as any)) {
      for (const key of ['appearance.cardTilt', 'appearance.cardTiltOn', 'appearance.cardTiltOff']) expect((strings as any)[key], `${locale} ${key}`).toBeTruthy();
    }
    const handler = code(app.slice(app.indexOf("appearanceCardTiltSelect?.addEventListener('change', () => {"), app.indexOf("appearanceBackgroundSelect?.addEventListener('change', () => {")));
    expect(handler).toContain("if (appearanceCardTiltSelect.value === 'off') localStorage.setItem(CARD_TILT_KEY, 'off');");
    expect(handler).toContain('else localStorage.removeItem(CARD_TILT_KEY);');
    expect(handler).toContain('applyCardTiltSetting();');
    expect(code(fn('function refreshAppearanceUi() {'))).toContain("if (appearanceCardTiltSelect) appearanceCardTiltSelect.value = cardTiltOff() ? 'off' : 'on';");
  });
});
