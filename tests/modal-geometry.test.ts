import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// HOW WIDE IS A DIALOG? ONE ANSWER.
//
// Owner, 2026-08-07, looking at a freshly added modal: "есть ощущение, что эта модалка шире, чем остальные" — and
// then, once the numbers were on the table, "сделай стандарт ширины для модалок, а то смотрю куча разных цифр".
// MEASURED across all eight modals that day: 440 for the forms, 460 for the quick start, 520 for the install sheet,
// 980 for the docs reader, and the new one had copied the 520. Nothing enforced any of it; the widths agreed only
// where somebody had remembered to type the same digits.
//
// Same treatment the header geometry got after the owner saw three button heights on one device: the value lives in
// :root, every card reads it, and this pins it so a literal cannot creep back.
// Comments stripped before anything is scanned: this reads DECLARATIONS, and prose that happens to mention a width
// (an explanation of a past overflow bug, for instance) is not one. A gate that trips on its own documentation gets
// worked around rather than obeyed.
const CSS = readFileSync('web/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const HTML = readFileSync('web/index.html', 'utf8');

/** The card element of every modal: a <section> for most, a <form> for the two that submit. */
function modalCards(): Array<{ id: string; classes: string[]; body: string }> {
  return [...HTML.matchAll(/<div class="modal-backdrop[^"]*" id="([A-Za-z]+)"[^>]*>\s*<(?:section|form) class="([^"]+)"/g)]
    .map(([, id, classAttr]) => {
      const start = HTML.indexOf(`id="${id}"`);
      const end = HTML.indexOf('\n      </div>', start);
      return { id, classes: classAttr.trim().split(/\s+/), body: HTML.slice(start, end < 0 ? HTML.length : end) };
    });
}

/** Every CSS declaration block whose selector list mentions `.name` (not `.name something`). */
function blocksForClass(name: string): string {
  let out = '';
  const pattern = new RegExp(`(^|[,\\s])\\.${name}\\s*(,[^{]*)?\\{([^}]*)\\}`, 'gm');
  for (let match = pattern.exec(CSS); match; match = pattern.exec(CSS)) out += match[3];
  return out;
}

describe('MODALGEO — every dialog is the same width because it reads the same value', () => {
  it('MODALGEO-01: the width lives in :root, once', () => {
    const root = CSS.slice(0, CSS.indexOf('}'));
    expect(root).toContain('--modal-card-width: 460px;');
    // The docs reader is a document viewer rather than a dialog card — a different KIND of surface, not a different
    // taste, so it gets a named token instead of a stray literal.
    expect(root).toContain('--modal-reader-width: 980px;');
  });

  it('MODALGEO-02: no modal card carries a literal width — the numbers cannot drift apart again', () => {
    const cards = modalCards();
    expect(cards.length, 'the markup scan must find every modal').toBeGreaterThanOrEqual(7);
    const offenders: string[] = [];
    for (const { id, classes } of cards) {
      // The lightbox is full-viewport and not a card; it sizes itself to the image.
      if (id === 'imageLightboxDialog') continue;
      const declarations = classes.map((name) => blocksForClass(name)).join('\n');
      const literal = /width:\s*min\(\s*\d+px/.exec(declarations);
      if (literal) offenders.push(`#${id} (.${classes.join('.')}) hardcodes ${literal[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('MODALGEO-03: every modal with a header lays that header out — the list must not forget a newcomer', () => {
    // SHIPPED BROKEN AND THE OWNER SAW IT FIRST (v876): the header row is produced by a rule that ENUMERATES dialog
    // classes, and the new dialog was not in the list. With no flex row its ✕ dropped below the title onto its own
    // line. A list of known members that a new member silently misses — so this checks the SET, not one dialog.
    const offenders: string[] = [];
    for (const { id, classes, body } of modalCards()) {
      if (!body.includes('<header>')) continue;
      // Its own rule (.quick-start-dialog header) or a place in the shared list — either is fine, absence is not.
      if (classes.some((name) => new RegExp(`\\.${name} header\\b`).test(CSS))) continue;
      offenders.push(`#${id} (.${classes.join('.')}) has a <header> with no header layout rule`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
