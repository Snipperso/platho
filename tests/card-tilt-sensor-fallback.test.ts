import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const iife = (start: string) => {
  const at = app.indexOf(start);
  const end = app.indexOf('\n})();\n', at);
  return app.slice(at, end + 6);
};

function world({ telegram = true, permission = null as null | (() => Promise<string>) } = {}) {
  const windowListeners = new Map<string, any>();
  const cardListeners = new Map<string, any>();
  const tgListeners = new Map<string, any>();
  const posted: string[] = [];
  const timers: Array<{ at: number; run: () => void; id: number }> = [];
  let now = 0;
  let nextId = 1;
  const written: Array<[string, string]> = [];
  const frames: Array<() => void> = [];
  const orientation: any = {
    beta: 0, gamma: 0,
    start: () => { posted.push('start'); }, stop: () => { posted.push('stop'); },
  };
  const tg = { DeviceOrientation: orientation, onEvent: (name: string, handler: any) => tgListeners.set(name, handler), offEvent: (name: string) => tgListeners.delete(name) };
  const DeviceOrientationEvent: any = function DeviceOrientationEvent() {};
  if (permission) DeviceOrientationEvent.requestPermission = permission;
  const card = {
    style: { setProperty: (name: string, value: string) => written.push([name, value]) },
    addEventListener: (name: string, handler: any) => cardListeners.set(name, handler),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 50 }),
  };
  const env: Record<string, any> = {
    globalThis: { matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)', addEventListener() {} }), DeviceOrientationEvent },
    window: { addEventListener: (name: string, handler: any) => windowListeners.set(name, handler), removeEventListener: (name: string) => windowListeners.delete(name) },
    document: { visibilityState: 'visible', addEventListener: () => {} },
    requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; },
    setTimeout: (run: () => void, ms: number) => { const id = nextId++; timers.push({ at: now + ms, run, id }); return id; },
    clearTimeout: (id: number) => { const at = timers.findIndex((one) => one.id === id); if (at >= 0) timers.splice(at, 1); },
    isTelegramEnv: () => telegram, telegramWebApp: () => (telegram ? tg : null), telegramSupports: () => telegram,
    WALLET_CARD_TILT_FULL_DEG: 30, cardTiltOff: () => false, cardTiltRests: new Set(),
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, [iife('const cardTiltSensor = (() => {'), fn('function pageOnScreen() {'), fn('function installCardTilt(card, shown) {'),
    'return { cardTiltSensor, installCardTilt };'].join(NL))(...names.map((n) => env[n]));
  const advance = (ms: number) => {
    now += ms;
    for (let due = timers.filter((one) => one.at <= now); due.length; due = timers.filter((one) => one.at <= now)) {
      for (const one of due) { timers.splice(timers.indexOf(one), 1); one.run(); }
    }
  };
  const run = () => { for (let i = 0; i < 400 && frames.length; i += 1) frames.shift()!(); };
  const leaning = () => Number(Object.fromEntries(written)['--tilt-x'] ?? 0);
  const telegramSays = (beta: number, gamma: number) => { orientation.beta = beta * Math.PI / 180; orientation.gamma = gamma * Math.PI / 180; tgListeners.get('deviceOrientationChanged')?.(); };
  const phoneSays = (beta: number, gamma: number) => windowListeners.get('deviceorientation')?.({ beta, gamma });
  return { api, card, windowListeners, cardListeners, tgListeners, posted, advance, run, leaning, telegramSays, phoneSays };
}

describe('the card\'s sensor', () => {
  it('TILTSENSOR-01: Telegram\'s sensor silent for 2 s — the page\'s own is listened to, and the card leans by it', () => {
    const w = world();
    w.api.installCardTilt(w.card, () => true).setActive(true);
    expect([w.posted, w.windowListeners.has('deviceorientation')], 'Telegram\'s first, inside the Mini App').toEqual([['start'], false]);
    w.advance(1_999);
    expect(w.windowListeners.has('deviceorientation')).toBe(false);
    w.advance(1);
    expect([w.posted, w.tgListeners.has('deviceOrientationChanged'), w.windowListeners.has('deviceorientation')], 'stopped, let go, the page\'s own taken').toEqual([['start', 'stop'], false, true]);
    w.phoneSays(40, 0);
    w.phoneSays(40, 15);
    w.run();
    expect(w.leaning()).toBeGreaterThan(0.3);
  });

  it('TILTSENSOR-02: Telegram\'s sensor failing — the page\'s own at once; speaking — kept, and no fallback', () => {
    const failed = world();
    failed.api.installCardTilt(failed.card, () => true).setActive(true);
    failed.tgListeners.get('deviceOrientationFailed')();
    expect(failed.windowListeners.has('deviceorientation')).toBe(true);
    const speaking = world();
    speaking.api.installCardTilt(speaking.card, () => true).setActive(true);
    speaking.advance(500);
    speaking.telegramSays(40, 0);
    speaking.telegramSays(40, 15);
    speaking.advance(10_000);
    speaking.run();
    expect([speaking.posted, speaking.windowListeners.has('deviceorientation')]).toEqual([['start'], false]);
    expect(speaking.leaning()).toBeGreaterThan(0.3);
    const cardTilt = speaking.api.installCardTilt(speaking.card, () => true);
    cardTilt.setActive(true);
    expect(speaking.posted).toEqual(['start']);
  });

  it('TILTSENSOR-03: iOS is asked from a tap\'s click, not its pointerdown; a refusal for want of a gesture asks again; granted, the sensor restarts', async () => {
    const answers = [() => Promise.reject(new Error('NotAllowedError: requires a user gesture')), () => Promise.resolve('granted')];
    let asked = 0;
    const w = world({ telegram: false, permission: () => { asked += 1; return answers[Math.min(asked, answers.length) - 1](); } });
    w.api.installCardTilt(w.card, () => true).setActive(true);
    const onCard = { target: { closest: () => null } };
    w.cardListeners.get('pointerdown')(onCard);
    expect(asked, 'a pointerdown asks nothing').toBe(0);
    w.cardListeners.get('click')(onCard);
    await new Promise((resolve) => setTimeout(resolve, 0));
    w.cardListeners.get('click')(onCard);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked, 'refused for want of a gesture: asked again on the next tap').toBe(2);
    w.cardListeners.get('click')(onCard);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked, 'answered: not asked again').toBe(2);
    w.cardListeners.get('click')({ target: { closest: () => ({}) } });
    expect(asked, 'a button on the card asks nothing').toBe(2);
    expect(w.windowListeners.has('deviceorientation')).toBe(true);
  });
});
