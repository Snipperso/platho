import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');

describe('the visible half waits for the module', () => {
  it('VISBOOT-01: the visible half returns while the module evaluates; the flag is the module\'s last statement, after every await', () => {
    const at = app.indexOf("document.addEventListener('visibilitychange', () => {\n  if (document.hidden) {\n    notePageAway();");
    expect(at).toBeGreaterThan(0);
    const handler = code(app.slice(at, app.indexOf('\n});', at)));
    const visible = handler.slice(handler.indexOf('} else {'));
    expect(visible.replace(/\s+/g, ' ')).toMatch(/^\} else \{ if \(!installPromptUiReady\) return; checkForServiceWorkerUpdate\(\);/);
    const flag = app.lastIndexOf('installPromptUiReady = true;');
    expect(flag, 'the handler is registered before the flag flips').toBeGreaterThan(at);
    const lastAwait = Math.max(...[...app.matchAll(/^await |^const [^\n]*= await /gm)].map((m) => m.index ?? 0));
    expect(flag, 'after the last top-level await').toBeGreaterThan(lastAwait);
    expect(app.indexOf('const quickStartDialog = '), 'what the visible half reaches is declared before the flag').toBeLessThan(flag);
  });
});
