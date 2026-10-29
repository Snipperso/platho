import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');

describe('The corner logo and the balance slot', () => {
  it('LOGO-01: the logo is half the corner; the button and a worn gift keep their 58px', () => {
    expect(css).toMatch(/\.brand-mark-button \{[^}]*width: 58px;\s*\n\s*height: 58px;/);
    expect(css).toMatch(/\.brand-mark \{\s*\n\s*width: 58px;\s*\n\s*height: 58px;/);
    expect(css).toMatch(/\.brand\[data-brand-gift="false"\] \.brand-mark \{\s*\n\s*width: 29px;\s*\n\s*height: 29px;/);
    expect(css, 'a second size for the GIFT is what once made the corner move').not.toMatch(/\.brand\[data-brand-gift="true"\] \.brand-mark/);
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).not.toMatch(/\.brand-mark(-button)? \{[^}]*width: (?!58px)/);
  });

  it('SLOT-01: the mobile balance plate is ALWAYS there — wallet or no wallet — and empty until the balance is known; it is the wallet tab\'s own', () => {
    const html = readFileSync('web/index.html', 'utf8');
    const rail = html.slice(html.indexOf('<nav class="rail"'), html.indexOf('</nav>', html.indexOf('<nav class="rail"')));
    expect(rail).toMatch(/<button class="rail-item rail-item-wallet is-active" type="button" data-tab="wallet"[\s\S]*?<span class="rail-vault-balance is-pending"[^>]*data-nav-vault-balance>[\s\S]*?icon-wallet[\s\S]*?<\/button>\s*<button class="rail-item" type="button" data-tab="public"[\s\S]*data-tab="chats"/);
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).toMatch(/\.rail \{[\s\S]{0,800}?grid-template-columns: minmax\(0, 1\.7fr\) repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css, 'the line after the balance is gone').not.toMatch(/\.rail-vault-balance \{[^}]*border-(right|bottom): 1px/);
    expect(mobile).toMatch(/\.rail-vault-balance \{\s*\n\s*display: grid;/);
    expect(mobile, 'never display:none — a hidden cell is the move').not.toMatch(/\.rail-vault-balance \{[^}]*display: none/);
    expect(css).not.toContain('.has-vault-balance');
    expect(app).not.toContain('has-vault-balance');
    expect(css).toMatch(/\.rail-vault-balance\.is-pending \{\s*opacity: 0;/);
  });
});
