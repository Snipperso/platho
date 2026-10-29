import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

const APP = readFileSync('web/app.js', 'utf8');

describe('THREADSTATE — the private list says only what it can back up', () => {
  it('THREADSTATE-01: the raw internal token never reaches the DOM', () => {
    expect(APP).not.toContain('state.textContent = thread.state;');
    expect(APP).toContain('const stateLabel = threadStateLabel(thread);');
    expect(APP).toContain('setTextIfChanged(state, stateLabel);');
    expect(APP).toContain("if (state.hidden !== (stateLabel === '')) state.hidden = stateLabel === '';");
    expect(APP).toMatch(/const line = document\.createElement\('div'\);\s*line\.className = 'thread-line';\s*line\.append\(state, preview\);\s*main\.append\(top, line\);/);
    const css = readFileSync('web/styles.css', 'utf8');
    expect(css).toMatch(/\.thread-line \{[\s\S]*?display: flex;/);
    expect(css, 'the preview takes what is left and ellipsises').toMatch(/\.thread-preview \{\s*flex: 1 1 auto;\s*min-width: 0;/);
    expect(css, 'the state keeps its width and never wraps').toMatch(/\.thread-state \{\s*flex: 0 0 auto;/);
    expect(css, 'and no rule puts the state back on a line of its own').not.toMatch(/\.thread-state \{[^}]*margin-top:/);
  });

  it('THREADSTATE-02: only actionable states are labelled — the three noise words map to nothing', () => {
    const map = APP.slice(APP.indexOf('const THREAD_STATE_LABEL_KEYS'), APP.indexOf('function threadStateLabel'));
    const keys = [...map.matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1]);
    expect(keys.sort()).toEqual(['blocked', 'pending', 'sending']);
    for (const noise of ['sealed', 'local', 'route']) {
      expect(keys, `${noise} must not be labelled`).not.toContain(noise);
    }
  });

  it('THREADSTATE-03: every label the map can ask for exists in EVERY locale', () => {
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
    expect(APP).toContain("const tone = thread.state === 'blocked' ? 'failed' : 'sending';");
    expect(APP).toContain('if (state.dataset.tone !== tone) state.dataset.tone = tone;');
    const css = readFileSync('web/styles.css', 'utf8');
    expect(css).toContain('.thread-state[data-tone="failed"]');
    const colourOf = (selector: string) => /color:\s*([^;]+);/.exec(css.slice(css.indexOf(selector)).slice(0, 160))?.[1]?.trim() ?? null;
    const listFailed = colourOf('.thread-state[data-tone="failed"]');
    expect(listFailed, 'the list row names a colour').toBeTruthy();
    expect(colourOf('.message[data-status="failed"] .message-meta'), 'the open dialog uses the SAME red').toBe(listFailed);
  });

  it('THREADSTATE-05: search matches what the row SHOWS, not the internal token', () => {
    expect(APP).toContain('${threadStateLabel(thread)} ${threadIdentitySearchText(thread)}');
    expect(APP).not.toContain('${thread.state} ${threadIdentitySearchText(thread)}');
  });
});
