import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Two things the owner saw on the light theme [2026-09-10]: the hero's name was hard to read and its close mark
// vanished — "the hero should look the same on every theme" — and, on any theme, the card's foot sometimes said
// "Reading the chain…" forever, with closing and reopening the card as the only way out.

const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const i18n = readFileSync('web/i18n-strings.mjs', 'utf8');

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

describe('The hero reads with the tones of its own ink', () => {
  it('HERO-INK-01: the two ink sets are the palettes\' single source', () => {
    for (const token of ['ink', 'text', 'muted', 'id-platho', 'id-platho-epic', 'id-platho-rare']) {
      expect(css, `${token} on dark`).toMatch(new RegExp(`--${token}-on-dark: [^;]+;`));
      expect(css, `${token} on light`).toMatch(new RegExp(`--${token}-on-light: [^;]+;`));
    }
    // The dark palette points at the dark set …
    expect(css).toMatch(/--hero-ink: var\(--ink-on-dark\);\s*\n\s*--text: var\(--text-on-dark\);\s*\n\s*--muted: var\(--muted-on-dark\);/);
    expect(css).toMatch(/--id-platho: var\(--id-platho-on-dark\);/);
    // … and BOTH light palettes (the media block and the attribute block) at the light one.
    expect((css.match(/^    --hero-ink: var\(--ink-on-light\);\r?\n    --text: var\(--text-on-light\);\r?\n    --muted: var\(--muted-on-light\);/gm) ?? []).length).toBe(2);
    expect((css.match(/^    --id-platho: var\(--id-platho-on-light\);$/gm) ?? []).length).toBe(2);
    // No palette carries a literal tone of its own any more — one source, no drift.
    expect(css).not.toMatch(/^\s+--text: #[0-9a-f]{6};/m);
    expect(css).not.toMatch(/^\s+--id-platho: #[0-9a-f]{6};/m);
  });

  it('HERO-INK-02: the hero picks its set by the ink measured against the gift, and reads with the theme\'s ink undressed', () => {
    expect(css).toMatch(/\.profile-card-hero \{\s*\n\s*--gift-hero-ink: var\(--hero-ink\);\s*\n\s*color: var\(--text\);\s*\n\}/);
    expect(css).toMatch(/\.profile-card-hero\[data-gift-hero-ink="light"\] \{\s*\n\s*--text: var\(--text-on-dark\);\s*\n\s*--muted: var\(--muted-on-dark\);\s*\n\s*--id-platho: var\(--id-platho-on-dark\);\s*\n\s*--id-platho-epic: var\(--id-platho-epic-on-dark\);\s*\n\s*--id-platho-rare: var\(--id-platho-rare-on-dark\);/);
    expect(css).toMatch(/\.profile-card-hero\[data-gift-hero-ink="dark"\] \{\s*\n\s*--text: var\(--text-on-light\);/);
    const tokens = fn('applyGiftHeroTokens');
    expect(tokens, 'the attribute follows the measured ink').toContain("node.setAttribute('data-gift-hero-ink', heroInk[0] === 255 ? 'light' : 'dark');");
    expect(tokens, 'and comes off with the dress').toContain("node.removeAttribute('data-gift-hero-ink');");
    // The name's tier colour is still the app's tone tokens — resolved inside the hero, they take the hero's set.
    expect(css).toMatch(/\.identity-label-platho\s*\{\s*color:\s*var\(--id-platho\);/);
  });
});

describe('Dialog chrome reads like its title', () => {
  it('CHROME-INK-01: the dialog close mark and the settings headings wear the title\'s ink, not the muted grey', () => {
    // [owner, 2026-09-10, light theme: "the cross is still barely visible — write it the way the word Settings is".]
    // The settings pane has no plate: its chrome lies on the dimmed backdrop, mid-grey on the light theme.
    expect(css).toMatch(/\.modal-backdrop header \.icon-button \{\s*\n\s*width: var\(--header-button-size\);\s*\n\s*height: var\(--header-button-size\);\s*\n\s*color: var\(--text\);\s*\n\}/);
    expect(css).toMatch(/\.modal-backdrop header \.icon-button:hover \{\s*\n\s*color: var\(--accent\);\s*\n\}/);
    // The settings pane has no plate and lies on the backdrop, dark on every theme: its title, lead, section headings
    // and close mark read with the ink for dark ground [owner: "make it white — the headings and the subheadings"].
    expect(css).toMatch(/\.profile-settings-dialog \.pane-header h1,\s*\n\.profile-settings-dialog header \.icon-button \{\s*\n\s*color: var\(--text-on-dark\);\s*\n\}/);
    expect(css).toMatch(/\.profile-settings-dialog \.pane-header p,\s*\n\.profile-settings-dialog \.profile-section h2 \{\s*\n\s*color: var\(--text-on-dark\);\s*\n\s*opacity: 0\.85;\s*\n\}/);
    // Outside that pane the section heading keeps the palette's muted grey.
    expect(css).toMatch(/\.profile-section h2 \{\s*\n\s*color: var\(--muted\);/);
  });
});

describe("The card's foot settles", () => {
  it('CARD-STATUS-01: a read that keeps coming back incomplete gives up after the ladder and the lane settles as partial', () => {
    expect(app).toContain('const PROFILE_CARD_MAX_ATTEMPTS = PROFILE_CARD_RETRY_LADDER_MS.length + 1;');
    const drive = fn('driveProfileCardRead');
    expect(drive).toContain('const retrying = incomplete && attempt + 1 < PROFILE_CARD_MAX_ATTEMPTS;');
    expect(drive).toContain("else if (incomplete) markProfileCardLaneDone(subject, lane.name, { partial: true });");
    expect(drive, 'a throwing read gives up the same way').toMatch(/const retrying = attempt \+ 1 < PROFILE_CARD_MAX_ATTEMPTS;\s*\n\s*lane\.render\(null, \{ retrying \}\);[^\n]*\n\s*if \(retrying\) scheduleProfileCardRetry\(subject, lane, attempt\);\s*\n\s*else markProfileCardLaneDone\(subject, lane\.name, \{ partial: true \}\);/);
    // Both lanes name themselves for the report.
    expect(app).toMatch(/driveProfileCardRead\(raw, \{\s*\n\s*name: 'names',\s*\n\s*load: \(\) => loadUsernameNftsForWallet\(raw, own\),/);
    expect(app).toMatch(/driveProfileCardRead\(raw, \{\s*\n\s*name: 'gifts',\s*\n\s*load: \(\) => loadTelegramGiftsForWallet\(raw\),/);
  });

  it('CARD-STATUS-02: the foot has three honest states — reading, synced, partly read', () => {
    const meta = fn('renderProfileCardMeta');
    expect(meta).toContain('const partial = synced && profileCardLanesPartial.size > 0;');
    expect(meta).toContain("const status = synced ? t(partial ? 'profileCard.readPartial' : 'sync.synced') : t('profileCard.giftsLoading');");
    const mark = fn('markProfileCardLaneDone');
    expect(mark).toContain('function markProfileCardLaneDone(wallet, lane, { partial = false } = {})');
    expect(mark).toContain('if (partial) profileCardLanesPartial.add(lane);');
    // Reset per card, next to the done set.
    expect(app).toMatch(/profileCardLanesPartial = new Set\(\);\s*\n\s*profileCardLanesDone = new Set\(\);\s*\n\s*renderProfileCardMeta\(\);/);
    const starts = [...i18n.matchAll(/^  (en|ru|zh|es|pt|fr|de|hi|id|ja): \{$/gm)];
    expect(starts).toHaveLength(10);
    starts.forEach((match, index) => {
      const block = i18n.slice(match.index ?? 0, starts[index + 1]?.index ?? i18n.length);
      expect(block, `${match[1]} carries the partial state`).toContain('"profileCard.readPartial":');
    });
  });
});
