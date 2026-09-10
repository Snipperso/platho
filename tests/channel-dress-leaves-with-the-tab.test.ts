import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// THE CHANNEL'S DRESS FOLLOWS THE TAB [owner, 2026-09-10: opened a dressed channel, switched to Private or Wallet,
// and the channel's background stayed]. The channel view and the post detail keep their state while another tab is
// shown (so the reader lands back where they were), which is exactly why "on screen" must be asked of the TAB.

const app = readFileSync('web/app.js', 'utf8');

function fn(name: string): string {
  const header = new RegExp(`\\n(?:async )?function ${name}\\(`);
  const match = header.exec(app);
  if (!match) throw new Error(`function ${name} not found`);
  const start = match.index + 1;
  const open = app.indexOf('{', app.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < app.length; i += 1) {
    if (app[i] === '{') depth += 1;
    else if (app[i] === '}') { depth -= 1; if (depth === 0) return app.slice(start, i + 1); }
  }
  throw new Error(`function ${name} never closes`);
}

describe("The channel's dress leaves with the Public tab", () => {
  it('DRESS-TAB-01: channelOnScreen answers null unless the Public tab is the one shown', () => {
    const onScreen = fn('channelOnScreen');
    const gate = onScreen.indexOf('if (!isPublicViewActive()) return null;');
    expect(gate, 'the tab gate exists').toBeGreaterThan(0);
    expect(gate, 'after the card guard').toBeGreaterThan(onScreen.indexOf('if (profileCardDialog && !profileCardDialog.hidden) return null;'));
    expect(gate, 'before the channel view or the post detail is consulted').toBeLessThan(onScreen.indexOf('const wallet = publicChannelViewOpen'));
    // The preview (the description dialog, openable from any tab) still comes first.
    expect(onScreen.indexOf('if (channelLookPreview) return channelLookPreview;')).toBeLessThan(gate);
    expect(fn('isPublicViewActive')).toContain("return appShell?.dataset?.view === 'public';");
  });

  it('DRESS-TAB-02: switching tabs re-applies the dress, after the view is written', () => {
    const setView = fn('setView');
    const written = setView.indexOf('appShell.dataset.view = view;');
    const applied = setView.indexOf('if (globalThis.__plathoGiftRuntimeReady) applyGiftAppearance();');
    expect(written).toBeGreaterThan(0);
    expect(applied, 'the switch re-dresses, GUARDED: setView runs at boot before the gift runtime\'s let-state exists').toBeGreaterThan(written);
    expect(setView, 'no unguarded call').not.toMatch(/\n\s*applyGiftAppearance\(\);/);
  });

  it('DRESS-TAB-03: the dress comes and goes in the view\'s own frame — no theme cross-fade on the dress paths', () => {
    // [owner, 2026-09-10: on a tab switch the first frame still wore the channel's look, then it repainted.] The
    // cross-fade (.theme-anim, 0.35s) is for the theme the user picks; a channel's palette follows the view.
    const forced = fn('applyForcedTheme');
    expect(forced).toContain('function applyForcedTheme(next, { animate = true } = {})');
    expect(forced, 'a fade still running is cut, not carried').toMatch(/clearTimeout\(themeAnimTimer\);\s*\n\s*if \(animate && document\.visibilityState === 'visible'\) \{\s*\n\s*root\.classList\.add\('theme-anim'\);\s*\n\s*\} else \{\s*\n\s*root\.classList\.remove\('theme-anim'\);/);
    expect(fn('applyChannelLook')).toContain('applyForcedTheme(look.theme, { animate: false });');
    const end = fn('endChannelDress');
    expect(end).toContain('applyForcedTheme(back, { animate: false });');
    expect(end).toMatch(/root\.classList\.remove\('theme-anim'\);[^\n]*\n\s*root\.removeAttribute\('data-theme'\);/);
    expect(fn('applyGiftAppearance'), "a channel's palette with the view; one's own keeps the cross-fade").toContain('applyForcedTheme(palette, { animate: !presented.channel });');
  });

  it("DRESS-TAB-04: the unlock prompt is the app's own door — no channel dress while it is awaited", () => {
    // [owner, 2026-09-10: locked on somebody's channel, the unlock button came up in that channel's colour.]
    const onScreen = fn('channelOnScreen');
    const gate = onScreen.indexOf('if (walletUnlockPromise) return null;');
    expect(gate).toBeGreaterThan(0);
    expect(gate, 'after the preview, before the card guard').toBeGreaterThan(onScreen.indexOf('if (channelLookPreview) return channelLookPreview;'));
    expect(gate).toBeLessThan(onScreen.indexOf('if (profileCardDialog && !profileCardDialog.hidden) return null;'));
    const load = fn('loadPlathoWallet');
    expect(load, 'undressed once the prompt is awaited, guarded for boot').toMatch(/\}\)\(\);\s*\n[\s\S]{0,600}?if \(globalThis\.__plathoGiftRuntimeReady\) applyGiftAppearance\(\);\s*\n\s*try \{\s*\n\s*return await walletUnlockPromise;/);
    expect(load, 'dressed again with the answer, whichever it is').toMatch(/finally \{\s*\n\s*walletUnlockPromise = null;\s*\n\s*if \(globalThis\.__plathoGiftRuntimeReady\) applyGiftAppearance\(\);/);
  });

  it('DRESS-TAB-05: a re-apply that finds everything in place touches the document not at all', () => {
    // [owner, 2026-09-10: switching between Private and Wallet — two tabs with the same background — "reloaded" the
    // background every time.] The tab switch re-applies the dress; the re-apply must be a true no-op when nothing
    // moved: tokens and flags written only on change, the theme not re-forced to itself.
    expect(fn('setRootToken')).toContain('if (style.getPropertyValue(name) === value) return;');
    expect(fn('dropRootToken')).toContain("if (style.getPropertyValue(name) === '') return;");
    expect(fn('setRootFlag')).toContain('if (root.getAttribute(name) !== value) root.setAttribute(name, value);');
    expect(fn('dropRootFlag')).toContain('if (root.hasAttribute(name)) root.removeAttribute(name);');
    for (const name of ['applyGiftAppearance', 'applyGiftPatternWallpaper']) {
      const body = fn(name);
      expect(body, `${name}: no raw root write`).not.toMatch(/root\.style\.(set|remove)Property\(|root\.(set|remove)Attribute\(/);
      expect(body, `${name}: writes go through the helpers`).toMatch(/setRootToken\(|setRootFlag\(/);
    }
    const forced = fn('applyForcedTheme');
    const early = forced.indexOf("if (root.getAttribute('data-theme') === next) {");
    expect(early, 'the same theme returns before any class or attribute is touched').toBeGreaterThan(0);
    expect(early).toBeLessThan(forced.indexOf('clearTimeout(themeAnimTimer);'));
    expect(forced.slice(early, forced.indexOf('return;', early)), 'the persisted key is still written').toContain('localStorage.setItem(THEME_STORAGE_KEY, next);');
  });
});
