import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GRAM, swapWorld } from './helpers/swap-window';
import { parseUnits } from '../web/wallet-transfers.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const css = readFileSync('web/styles.css', 'utf8');

const pairOf = (offer: any, ask: any) => ({ offer, ask, offerSide: 0 });
const ATH = { id: 'ATH', symbol: 'ATH', decimals: 9 };
const USDT = { id: 'USDT', symbol: 'USD₮', decimals: 6 };
const G = { id: GRAM, symbol: 'GRAM', decimals: 9 };

describe('the swap window: one choice, and MAX', () => {
  it('SWAPONE-01: a side with one choice has no arrow and opens no list; a side with more keeps both', async () => {
    const w = swapWorld({
      offers: [{ id: 'ATH', symbol: 'ATH', decimals: 9, balance: 1_074_142_835_854n, isAth: true }, { id: GRAM, symbol: 'GRAM', decimals: 9, balance: null }],
      pairs: { ATH: [pairOf(ATH, G)], [GRAM]: [pairOf(G, ATH), pairOf(G, USDT)] },
    });
    void w.open('ATH');
    await w.settle();
    const { givePick, getPick } = w.tiles();
    expect(getPick.classList.contains('is-single'), 'ATH trades for GRAM alone').toBe(true);
    expect(getPick.getAttribute('aria-haspopup')).toBeNull();
    expect([(getPick as any).tabIndex, getPick.getAttribute('aria-disabled')]).toEqual([-1, 'true']);
    expect([(givePick as any).tabIndex, givePick.getAttribute('aria-disabled')], 'two things to give: a button').toEqual([0, null]);
    getPick.click();
    expect(w.pickerOpened, 'no list behind it').toEqual([]);
    expect(givePick.classList.contains('is-single'), 'two things to give').toBe(false);
    expect(givePick.getAttribute('aria-haspopup')).toBe('dialog');
    givePick.click();
    expect(w.pickerOpened).toEqual(['wallet.swapGive']);
    w.pick(GRAM);
    expect([(getPick as any).tabIndex, getPick.getAttribute('aria-disabled'), getPick.classList.contains('is-single')]).toEqual([0, null, false]);
    const lone = swapWorld({ offers: [{ id: GRAM, symbol: 'GRAM', decimals: 9, balance: null }], pairs: { [GRAM]: [pairOf(G, ATH), pairOf(G, USDT)] } });
    void lone.open(GRAM);
    await lone.settle();
    expect(lone.tiles().givePick.classList.contains('is-single')).toBe(true);
    expect(lone.tiles().getPick.classList.contains('is-single'), 'GRAM trades for two').toBe(false);
    expect(css).toMatch(/\.swap-token-button\.is-single > \.icon-chevron-down \{\s*display: none;\s*\}/);
    expect(css).toMatch(/\.swap-token-button\.is-single \{\s*cursor: default;\s*\}/);
  });

  it('SWAPONE-02: MAX — a token\'s whole balance; GRAM\'s less the work attached and the reserve; nothing while GRAM is unread; on the giving side only', async () => {
    const token = swapWorld({ offers: [{ id: 'ATH', symbol: 'ATH', decimals: 9, balance: 1_074_142_835_854n, isAth: true }], pairs: { ATH: [pairOf(ATH, G)] } });
    void token.open('ATH');
    await token.settle();
    const t1 = token.tiles();
    expect(t1.getMax, 'no MAX on the side that receives').toBeUndefined();
    const getInput = t1.get.children.find((one: any) => one.classes.has('swap-card-amount')).children[0];
    getInput.value = '5';
    getInput.listeners.input();
    expect(getInput.value).toBe('5');
    expect([t1.max.className, t1.max.textContent, t1.max.getAttribute('aria-label'), (t1.max as any).title]).toEqual(['swap-max', 'wallet.swapMax', null, 'wallet.swapMaxLabel']);
    t1.max.click();
    expect(t1.input.value).toBe('1074.142835854');
    expect(parseUnits(t1.input.value, 9)).toBe(1_074_142_835_854n);
    expect(t1.input.focused).toBe(true);
    expect(getInput.value, 'recomputed from the side MAX filled (no pool read yet: nothing to show)').toBe('');
    const gram = swapWorld({ offers: [{ id: GRAM, symbol: 'GRAM', decimals: 9, balance: null }], pairs: { [GRAM]: [pairOf(G, ATH)] }, gramBalance: 2_000_000_000n });
    void gram.open(GRAM);
    await gram.settle();
    const t2 = gram.tiles();
    t2.max.click();
    expect(parseUnits(t2.input.value, 9), '2 GRAM less 0.3 attached and 0.01 reserve').toBe(1_690_000_000n);
    const unread = swapWorld({ offers: [{ id: GRAM, symbol: 'GRAM', decimals: 9, balance: null }], pairs: { [GRAM]: [pairOf(G, ATH)] }, gramBalance: null });
    void unread.open(GRAM);
    await unread.settle();
    unread.tiles().max.click();
    expect(unread.tiles().input.value, 'an unread balance fills nothing').toBe('');
    expect(unread.notices, 'and says so [regression check 2026-10-21 — V2-6]').toEqual(['wallet.swapMaxUnread']);
    const short = swapWorld({ offers: [{ id: GRAM, symbol: 'GRAM', decimals: 9, balance: null }], pairs: { [GRAM]: [pairOf(G, ATH)] }, gramBalance: 100_000_000n });
    void short.open(GRAM);
    await short.settle();
    short.tiles().max.click();
    expect(short.tiles().input.value, 'less than the swap needs: nothing to give').toBe('');
    expect(short.notices, 'and says what the wallet holds').toEqual(['wallet.tokenNotEnough']);
    expect([token.notices, gram.notices], 'a MAX that fills says nothing').toEqual([[], []]);
    for (const [locale, strings] of Object.entries(I18N_STRINGS as any)) {
      expect((strings as any)['wallet.swapMax'], locale).toBeTruthy();
      expect((strings as any)['wallet.swapMaxLabel'], locale).toBeTruthy();
    }
    expect(css).toMatch(/\.swap-card-amount \{\s*display: flex;/);
    expect(css).toMatch(/\.swap-card-amount > input\.buy-ath-input \{\s*flex: 1 1 auto;/);
    expect(css).toMatch(/\.swap-max \{\s*flex: none;/);
  });
});
