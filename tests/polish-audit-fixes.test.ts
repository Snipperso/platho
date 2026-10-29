import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { createInlineFormatRegex } from '../web/message-plain-text.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(NL))(...names.map((n) => env[n]));
};
const PIECE_REACH = app.slice(app.indexOf('const MESSAGE_PREVIEW_PIECE_REACH = '), app.indexOf(NL, app.indexOf('const MESSAGE_PREVIEW_PIECE_REACH = ')));
const BUDGET = [fn('function messagePreviewBudget() {'), 'let messagePreviewGraphemes;', PIECE_REACH, fn('function messagePreviewCutPoint(str, end, allowEmpty = false) {')];
const budgetOf = lift({ createInlineFormatRegex }, BUDGET, 'messagePreviewBudget');
const ruleOf = (selector: string) => {
  const out: string[] = [];
  const head = NL + selector + ' {';
  for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head, at + 1)) out.push(css.slice(at + 1, css.indexOf('}', at) + 1));
  return out.join(NL);
};

describe('the final polish audit\'s fixes', () => {
  it('PAF-01 (P1-3): a block after another may be cut to nothing rather than inside a link, a mention or a bold run; the first block never is', () => {
    const second = (text: string) => { const budget = budgetOf(); budget.take('a'.repeat(1495)); return { shown: budget.take(text), cut: budget.cut }; };
    expect(second('@alex_example hello'), 'MEASURED before: a button for "@alex", someone else').toEqual({ shown: '', cut: true });
    expect(second('https://example.com/a/long/path')).toEqual({ shown: '', cut: true });
    expect(second('   @alex_example hello'), 'nor blank space with a … after it').toEqual({ shown: '', cut: true });
    expect(second('**a bold run** after')).toEqual({ shown: '', cut: true });
    expect(second('[a label](https://example.com/x)')).toEqual({ shown: '', cut: true });
    expect(second('ab cdef gh'), 'plain words are cut as before').toEqual({ shown: 'ab cd', cut: true });
    const first = budgetOf();
    expect(first.take(`https://example.com/${'p'.repeat(3000)}`), 'the first block keeps what it can show').toHaveLength(1500);
  });

  it('PAF-02 (P1-4): the cut point reads at most its reach past the cut — not a 32 KB line to its end', () => {
    const read: number[] = [];
    const counting = () => { const re = createInlineFormatRegex(); return { exec: (s: string) => { read.push(s.length); return re.exec(s); } }; };
    const budget = lift({ createInlineFormatRegex: counting }, BUDGET, 'messagePreviewBudget')();
    budget.take('['.repeat(32_000));
    expect(read.length).toBeGreaterThan(0);
    expect(Math.max(...read), 'MEASURED before: the whole 32,000 — 4.2 ms a cut').toBeLessThanOrEqual(1500 + 2300);
    expect(budgetOf().take(`${'w '.repeat(745)}https://example.com/${'q'.repeat(2000)}`)).toBe('w '.repeat(745).trimEnd());
  });

  it('PAF-03 (P3-2): a letter icon draws a name\'s first character whole', () => {
    const doc = { createElement: () => ({ className: '', textContent: '', setAttribute: () => {} }) };
    const icon = lift({ document: doc, paintWalletAssetIcon: () => {} }, [fn("function walletAssetIcon(picture, letter, className = 'wallet-asset-icon', { shared = false } = {}) {")], 'walletAssetIcon');
    expect(icon('', '\u{1F600}Coin').textContent, 'MEASURED before: half a surrogate pair, drawn as \u{FFFD}').toBe('\u{1F600}');
    expect(icon('', 'major').textContent).toBe('M');
    expect(icon('', '').textContent).toBe('?');
    expect(icon('', '  x').textContent).toBe('X');
  });

  it('PAF-04 (P2-02): the copy row is marked, its label wraps, its short address stays one piece', () => {
    const doc = { createElement: (tag: string) => ({ tag, className: '', textContent: '', dataset: {}, append() {}, addEventListener() {} }) };
    const stat = lift({ document: doc, copyTextToClipboard: async () => {}, showAppNotice: () => {}, t: (k: string) => k },
      [fn("function walletCardStat(label, value, { copy = '', copied = 'dialog.shareCopied', balanceRow = null } = {}) {")], 'walletCardStat');
    expect(stat('Token address', 'UQAR...bvW', { copy: 'UQAR-full' }).className).toBe('profile-stat-row wallet-card-stat-copy');
    expect(stat('Balance', '5 MAJOR').className).toBe('profile-stat-row');
    expect(ruleOf('.wallet-group-dialog .profile-stat-row.wallet-card-stat-copy')).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(ruleOf('.wallet-group-dialog .wallet-card-stat-copy .wallet-card-copy')).toMatch(/white-space: nowrap;\s*overflow-wrap: normal;/);
    expect(css.indexOf('.wallet-group-dialog .wallet-card-stat-copy .wallet-card-copy {'), 'after the rule it overrides')
      .toBeGreaterThan(css.indexOf('.wallet-group-dialog .profile-stat-row strong,'));
  });

  it('PAF-05 (P3-1, P2-01, P2-04, P2-16, P3-4): the rows wrap their right-hand words, notices are as wide as their words', () => {
    expect(ruleOf('.settings-list button.wallet-backup-warning > strong'), 'P3-1').toMatch(/white-space: normal;\s*text-align: right;/);
    expect(ruleOf('.wallet-group-dialog .settings-list button > strong'), 'P2-01').toMatch(/margin-left: auto;\s*white-space: normal;\s*overflow-wrap: normal;\s*text-align: right;/);
    expect(ruleOf('.wallet-group-dialog .settings-list button'), 'P2-01: under its word when the two do not fit').toContain('flex-wrap: wrap;');
    expect(ruleOf('.wallet-group-dialog .settings-select-row.compact-select-row'), 'P2-06: the select as wide as its words').toContain('grid-template-columns: minmax(min-content, 1fr) auto;');
    expect(ruleOf('.wallet-group-dialog .settings-select-row.compact-select-row > span')).toContain('overflow-wrap: break-word;');
    expect(ruleOf('.wallet-group-dialog .settings-list button > span'), 'P2-01: the word keeps its width').toContain('min-width: min-content;');
    expect(css.indexOf('.wallet-group-dialog .settings-list button > span {')).toBeGreaterThan(css.indexOf('.settings-list button > span {'));
    const notice = css.slice(css.indexOf('.app-notice {'), css.indexOf('.app-notice[hidden]'));
    expect(notice, 'P2-04').toMatch(/width: max-content;[^\n]*\n\s*max-width: min\(92vw, 420px\);/);
    expect(ruleOf('.message-show-full'), 'P2-16').toContain('text-wrap: balance;');
    expect(ruleOf('button.wallet-asset-row:focus-visible'), 'P3-4').toContain('outline-offset: -2px;');
  });

  it('PAF-07 (P3-6): the wallet card\'s balance line keeps its box while it is read — the QR door below it never moves', () => {
    expect(css, 'MEASURED before: the QR door 55 px higher until the balance landed').not.toMatch(/\.wallet-headline\.is-pending \{\s*display: none;/);
    expect(ruleOf('.wallet-headline.is-pending')).toMatch(/^\.wallet-headline\.is-pending \{\s*opacity: 0;\s*\}$/);
    expect(ruleOf('.wallet-card-doors'), 'the doors keep their row under the balances [2026-10-23]').toContain('grid-row: 2;');
  });

  it('PAF-06 (P2-05, P2-08/09/10/12/14): the words', () => {
    const S = I18N_STRINGS as any;
    for (const [locale, strings] of Object.entries(S) as Array<[string, any]>) {
      expect(strings['appearance.cardTiltOff'], `${locale}: the option says the plain word`).not.toMatch(/[(（]/);
      expect(strings['appearance.cardTilt'], `${locale}: the reason moved to the label`).toMatch(/[(（]/);
    }
    expect(readFileSync('web/index.html', 'utf8')).toContain('<option value="off" data-i18n="appearance.cardTiltOff">Off</option>');
    expect(S.ru['wallet.actionUnhide'], 'ru: as the groups say it').toBe(S.ru['group.unhide']);
    expect(S.ja['wallet.nftSubmitted'], 'ja: "sent the sending"').not.toContain('送信を送');
    for (const key of ['wallet.tokenSubmitted', 'wallet.nftSubmitted', 'wallet.swapSubmitted']) expect(S.de[key], `de ${key}`).not.toContain('warte auf');
    expect(S.es['wallet.swapRate'], 'es: "Tipo" alone reads "Type"').not.toBe('Tipo');
    expect(S.id['wallet.swapSubmitted'].startsWith('Tukar ')).toBe(false);
    expect(S.id['wallet.burnHint']).not.toContain('Token langsung');
  });
});
