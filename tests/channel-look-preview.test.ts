import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A LOOK IS PREVIEWED BY THE APP ITSELF [owner, 2026-09-10: "the result of all these knobs and settings can only be
// seen after publishing — it would be nice to see a preview"]. There is no second renderer: while the description
// dialog is open, channelOnScreen answers with the look the editor holds, so the code that dresses a visitor dresses
// the author. These pins keep that one path — and its exit — in place.

const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const i18n = readFileSync('web/i18n-strings.mjs', 'utf8');

/** A top-level function's source, brace-balanced from its header (string literals are not braces-aware; fine here). */
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

describe('The channel look is previewed by the app behind the dialog', () => {
  it('PREVIEW-01: channelOnScreen answers the preview first — before the card guard, before the channel view', () => {
    const onScreen = fn('channelOnScreen');
    const firstLine = onScreen.split('\n')[1];
    expect(firstLine.trim(), 'the very first statement').toMatch(/^if \(channelLookPreview\) return channelLookPreview;/);
    expect(onScreen.indexOf('channelLookPreview')).toBeLessThan(onScreen.indexOf('profileCardDialog'));
    // Both readers of the channel on screen go through that one answer — the look and the gift alike.
    expect(app).toContain("return channelOnScreen()?.verifiedGift ?? null;");
    expect(app).toContain("const appearance = channelOnScreen()?.appearance ?? null;");
  });

  it('PREVIEW-02: the preview is the editor\'s own record — the look as read(), the worn gift only when its row asks', () => {
    const preview = fn('previewChannelLook');
    expect(preview).toContain('const gift = editor.wantsGift() && wornGiftTheme?.itemAddress');
    expect(preview).toContain('{ itemAddress: wornGiftTheme.itemAddress, slug: wornGiftTheme.slug, number: wornGiftTheme.number, verifiedAt: 0 }');
    expect(preview).toContain('channelLookPreview = { appearance: editor.read(), verifiedGift: gift };');
    expect(preview, 'the stylesheet keys the veil and the glass on this attribute').toContain("document.documentElement.setAttribute('data-look-preview', 'true');");
    expect(preview, 'the same apply as a visit').toContain('applyGiftAppearance();');
    // No renderer of its own: nothing in the preview paints a token or a theme directly.
    expect(preview).not.toMatch(/style\.setProperty|applyForcedTheme|applyChannelLook\(/);
  });

  it('PREVIEW-03: the end of the preview is the same apply with nothing to answer — and nothing persisted', () => {
    const end = fn('endChannelLookPreview');
    expect(end).toContain('if (!channelLookPreview) return;');
    expect(end).toContain('channelLookPreview = null;');
    expect(end).toContain("document.documentElement.removeAttribute('data-look-preview');");
    expect(end).toContain('applyGiftAppearance();');
    expect(end).not.toMatch(/localStorage|writeGiftThemeChoice|writeWornGiftTheme/);
    // A channel's dress is never persisted: applyForcedTheme skips the key while channelDressActive.
    expect(fn('applyForcedTheme')).toContain('if (!channelDressActive) {');
  });

  it('PREVIEW-04: the editor reports every knob, and the dialog wears the look from its first frame to its close', () => {
    const editor = fn('buildChannelLookEditor');
    expect(editor).toContain('function buildChannelLookEditor({ preset = null, current = null, onEdit = null } = {})');
    expect(editor, 'every select').toContain("select.addEventListener('change', () => { onChange(select.value); sync(); refreshCost(); onEdit?.(); });");
    expect(editor, 'every slider, on input — not on change').toContain("range.addEventListener('input', () => { onInput(Math.max(min, Math.min(max, Math.round(Number(range.value) || 0)))); onEdit?.(); });");
    expect(editor, 'one line tells the user where the preview is').toContain("previewHint.textContent = t('public.channelLookPreviewHint');");
    expect(editor, 'hidden with the look off: nothing to preview').toContain('previewHint.hidden = !state.enabled;');
    const dialog = fn('openEditChannelProfileDialog');
    expect(dialog).toContain('const editor = buildChannelLookEditor({ preset: presetAppearance, current: current?.appearance ?? null, onEdit: () => previewChannelLook(editor) });');
    expect(dialog, 'worn before the dialog opens').toMatch(/previewChannelLook\(editor\);\s*\n\s*const result = await openActionDialog\(\{/);
    expect(dialog, 'taken off whichever way the dialog closes').toContain('}).finally(() => endChannelLookPreview());');
  });

  it('PREVIEW-05: the Settings row replaces the settings with the dialog — a second dimmed card would hide the preview', () => {
    expect(app).toMatch(/const wanted = channelAppearanceSelect\.value === 'custom' \? 'custom' : 'none';[\s\S]{0,600}?closeProfileSettings\(\);\s*\n\s*openEditChannelProfileDialog\(\{ appearance: wanted \}\)/);
  });

  it('PREVIEW-06: for the dialog\'s life the backdrop is a veil and the card is glass, keyed on the one attribute', () => {
    expect(css).toMatch(/html\[data-look-preview\] \.modal-backdrop \{\s*\n\s*background: rgba\(4, 10, 12, 0\.14\);\s*\n\s*backdrop-filter: none;\s*\n\}/);
    expect(css).toMatch(/html\[data-look-preview\] \.action-dialog \{\s*\n\s*background: color-mix\(in srgb, var\(--panel\) 76%, transparent\);\s*\n\s*backdrop-filter: blur\(14px\);\s*\n\}/);
  });

  it('PREVIEW-07: the hint exists in every locale', () => {
    const starts = [...i18n.matchAll(/^  (en|ru|zh|es|pt|fr|de|hi|id|ja): \{$/gm)];
    expect(starts).toHaveLength(10);
    starts.forEach((match, index) => {
      const block = i18n.slice(match.index ?? 0, starts[index + 1]?.index ?? i18n.length);
      expect(block, `${match[1]} carries the preview hint`).toContain('"public.channelLookPreviewHint":');
    });
  });
});
