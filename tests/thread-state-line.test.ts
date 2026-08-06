import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

// THE STATE LINE UNDER EACH PRIVATE DIALOG SAID THE WRONG THING, IN THE WRONG LANGUAGE.
//
// Owner, 2026-08-06, looking at the private list: "смущают надписи LOCAL, SEALED, ROUTE. Как-то неинтуитивно и
// неоднородно."
//
// `thread.state` is an INTERNAL token and it was printed raw. Read against refreshThreadAfterMessageChange, its three
// everyday values decode to: `sealed` = the last message is INCOMING (only an opened chain capsule carries
// `capsule`), `local` = the last message is MINE, `route` = no messages. So a security vocabulary was being used to
// announce who wrote last — and `local` reads as "never left this device" about messages that were sent and
// confirmed. None of the three was translated in any of the ten locales.
//
// The rule now: a line appears only for a state the user can act on.
const APP = readFileSync('web/app.js', 'utf8');

describe('THREADSTATE — the private list says only what it can back up', () => {
  it('THREADSTATE-01: the raw internal token never reaches the DOM', () => {
    // The old line, verbatim. If it ever comes back, so does SEALED/LOCAL/ROUTE.
    expect(APP).not.toContain('state.textContent = thread.state;');
    expect(APP).toContain('const stateLabel = threadStateLabel(thread);');
    expect(APP).toContain('state.textContent = stateLabel;');
    // Hidden rather than blank: `.thread-state` carries a top margin, so an empty line still spaces the row out.
    expect(APP).toContain("state.hidden = stateLabel === '';");
  });

  it('THREADSTATE-02: only actionable states are labelled — the three noise words map to nothing', () => {
    const map = APP.slice(APP.indexOf('const THREAD_STATE_LABEL_KEYS'), APP.indexOf('function threadStateLabel'));
    const keys = [...map.matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1]);
    expect(keys.sort()).toEqual(['blocked', 'pending', 'sending']);
    // Stated as an exclusion too, because THAT is the complaint being fixed: these are states of the plumbing, and
    // the plumbing has nothing to tell the user. A private dialog is encrypted by construction — a word on every row
    // is noise that hides the one row that needs attention.
    for (const noise of ['sealed', 'local', 'route']) {
      expect(keys, `${noise} must not be labelled`).not.toContain(noise);
    }
  });

  it('THREADSTATE-03: every label the map can ask for exists in EVERY locale', () => {
    // Executed, not pinned: a missing key would render the raw key id in that language, which is how the untranslated
    // tokens looked in the first place. I18N_LOCALES is the shipped set, so this covers whatever it grows into.
    const map = APP.slice(APP.indexOf('const THREAD_STATE_LABEL_KEYS'), APP.indexOf('function threadStateLabel'));
    const referenced = [...new Set([...map.matchAll(/'(chat\.[A-Za-z]+)'/g)].map((match) => match[1]))];
    expect(referenced.length).toBeGreaterThan(0);
    const codes = (I18N_LOCALES as Array<{ code: string }>).map((locale) => locale.code);
    expect(codes.length).toBeGreaterThanOrEqual(10);
    const missing: string[] = [];
    for (const locale of codes) {
      for (const key of referenced) {
        const value = (I18N_STRINGS as Record<string, Record<string, string>>)[locale]?.[key];
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${locale}:${key}`);
      }
    }
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('THREADSTATE-04: a failure is red in the list, the same red the open dialog uses', () => {
    expect(APP).toContain("state.dataset.tone = thread.state === 'blocked' ? 'failed' : 'sending';");
    const css = readFileSync('web/styles.css', 'utf8');
    expect(css).toContain('.thread-state[data-tone="failed"]');
    // Matched to .message[data-status="failed"] .message-meta — one idea of "wrong", one colour.
    const failedRow = css.slice(css.indexOf('.thread-state[data-tone="failed"]'));
    expect(failedRow.slice(0, 120)).toContain('#ff8f8f');
  });

  it('THREADSTATE-05: search matches what the row SHOWS, not the internal token', () => {
    expect(APP).toContain('${threadStateLabel(thread)} ${threadIdentitySearchText(thread)}');
    expect(APP).not.toContain('${thread.state} ${threadIdentitySearchText(thread)}');
  });
});
