import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Two things the owner saw from a phone [2026-09-10]: the logo in the corner looked gigantic, and the tab bar's
// balance plate appeared late — the three tabs took the whole width, then moved when the balance landed.

const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');

describe('The corner logo and the balance slot', () => {
  it('LOGO-01: the logo is half the corner; the button and a worn gift keep their 58px', () => {
    // The button owns its size now — the picture inside no longer decides the corner's geometry.
    expect(css).toMatch(/\.brand-mark-button \{[^}]*width: 58px;\s*\n\s*height: 58px;/);
    // The one-size rule for the mark stands (gift or no gift, 58) …
    expect(css).toMatch(/\.brand-mark \{\s*\n\s*width: 58px;\s*\n\s*height: 58px;/);
    // … and only the NO-gift state draws the logo at half, in the middle of the same button.
    expect(css).toMatch(/\.brand\[data-brand-gift="false"\] \.brand-mark \{\s*\n\s*width: 29px;\s*\n\s*height: 29px;/);
    expect(css, 'a second size for the GIFT is what once made the corner move').not.toMatch(/\.brand\[data-brand-gift="true"\] \.brand-mark/);
    // No mobile override of the corner: the desktop sizes are the sizes.
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).not.toMatch(/\.brand-mark(-button)? \{[^}]*width: (?!58px)/);
  });

  it('SLOT-01: the mobile balance plate cell is ALWAYS there — wallet or no wallet — and empty until the balance is known', () => {
    // [owner, 2026-09-10, from a phone with no wallet yet: "the room for the balance is not reserved".] The cell is
    // the stylesheet's, at all times; app.js no longer adds or drops it, so nothing can move when a balance lands.
    const mobile = css.slice(css.indexOf('@media (max-width: 900px)'));
    expect(mobile).toMatch(/\.rail \{[\s\S]{0,800}?grid-template-columns: minmax\(58px, 0\.72fr\) repeat\(3, minmax\(0, 1fr\)\);/);
    expect(mobile).toMatch(/\.rail-vault-balance \{\s*\n\s*display: grid;/);
    expect(mobile, 'never display:none — a hidden cell is the move').not.toMatch(/\.rail-vault-balance \{[^}]*display: none/);
    expect(css).not.toContain('.has-vault-balance');
    expect(app).not.toContain('has-vault-balance');
    // Empty while pending: invisible, still in layout.
    expect(css).toMatch(/\.rail-vault-balance\.is-pending \{\s*opacity: 0;/);
  });
});
