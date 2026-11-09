import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');

describe('PROFILE-PW — the profile\'s publish is passworded wherever it is signed', () => {
  it('PROFILE-PW-01: each window takes the spend password, and checks it before anything is published', () => {
    const windows: Array<[string, string]> = [
      ['async function openEditChannelProfileDialog({ appearance: presetAppearance = null } = {}) {', 'await publishChannelProfile('],
      ['async function offerProfileBlockPublish({ title, hint, submitLabel, failure, balanceCard = null, changesWornGift = false }) {', 'await publishChannelProfile('],
      ['async function togglePinnedProfileGroup(groupId, record) {', 'await publishProfileGroups('],
      ['async function setOfficialCommunity(target, groupId, on) {', 'await publishProfileGroups('],
    ];
    for (const [start, publish] of windows) {
      const body = code(sourceBlock(app, start));
      expect(body, `${start}: the field (MEASURED before: fields: [] in the first three)`).toContain('...spendPasswordFields()');
      expect(body, start).toContain("formAutocomplete: 'on',");
      const check = body.indexOf('const passwordRefusal = await spendPasswordRefusal(values);');
      expect(check, `${start}: the check`).toBeGreaterThan(0);
      expect(check, `${start}: before the publish`).toBeLessThan(body.indexOf(publish));
    }
    const edit = code(sourceBlock(app, 'async function openEditChannelProfileDialog({ appearance: presetAppearance = null } = {}) {'));
    expect(edit.indexOf("return { ok: false, error: t('public.channelAppearanceNeedsGift') };")).toBeLessThan(edit.indexOf('const passwordRefusal = await spendPasswordRefusal(values);'));
    expect(edit).toMatch(/id: 'description',[\s\S]{0,300}?autocomplete: 'off',/);
  });

  it('PROFILE-PW-02: a refusal is scrolled into sight — a long window\'s form scrolls, and a wrong password\'s line sat above it [round 151 — C7-1]', () => {
    const submit = code(app.slice(app.indexOf("actionHint.textContent = (outcome && outcome.error) || t('dialog.invalidInput');") - 200,
      app.indexOf("actionHint.textContent = (outcome && outcome.error) || t('dialog.invalidInput');") + 900));
    expect(submit).toContain('revealInActionDialog(actionHint);');
    expect(submit.indexOf('speakToScreenReader(actionHint.textContent);')).toBeLessThan(submit.indexOf('revealInActionDialog(actionHint);'));
    expect(code(sourceBlock(app, 'function revealInActionDialog(node) {'))).toContain("node?.scrollIntoView?.({ block: 'nearest' });");
    expect(app).toContain('requestAnimationFrame(() => revealInActionDialog(actionFields?.querySelector(\'input[type="radio"]:checked\')));');
    expect(app.split("scrollIntoView?.({ block: 'nearest' })").length - 1, 'no window brings things into sight another way').toBe(1);
    expect(app).toMatch(/speakToScreenReader\(t\('dialog\.pricesMoved'\)\);[^\n]*\n\s+revealInActionDialog\(actionHint\);/);
  });
});
