import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// "DON'T SHOW THIS AGAIN" ON THE OPEN-COMMENTS WARNING.
//
// Owner, 2026-08-13: the warning fires on every post published with comments open, and by the tenth time it is
// noise rather than information.
//
// The two ways a dismissable warning goes wrong, both pinned here:
//
//   1. IT BECOMES A GATE. Dialog checkboxes are `required` BY DEFAULT in createActionField, so an unticked
//      "don't show again" would refuse to let the author publish until they agreed to stop being warned —
//      precisely backwards, and it would have shipped silently because the dialog just sits there.
//
//   2. IT REMEMBERS A DECISION THAT WAS NOT MADE. Ticking the box and then CLOSING the dialog means "I changed
//      my mind about publishing". It must not also mean "never warn me again".
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const strings = readFileSync('web/i18n-strings.mjs', 'utf8');

// The NEXT definition, not some function fifteen thousand lines below: a slice that wide passes on almost
// anything and reported green while a deliberate break was in the tree (2026-08-13).
const confirm = app.slice(
  app.indexOf('async function confirmPublicCommentsRisk()'),
  app.indexOf('function renderConfiguredShell()'),
);

describe('open-comments warning dismissal', () => {
  it('CMTRISK-01: the checkbox is NOT required — it can never block publishing', () => {
    expect(confirm.length).toBeGreaterThan(0);
    expect(confirm).toMatch(/id: 'dismissCommentsRisk',\s*type: 'checkbox',\s*required: false,/);
    // The default really is "required", which is why the explicit false above is load-bearing rather than noise.
    const field = app.slice(app.indexOf("if (field.type === 'checkbox') {"), app.indexOf("if (field.type === 'checkbox') {") + 400);
    expect(field).toContain('input.required = field.required !== false;');
  });

  it('CMTRISK-02: dismissal is remembered only on SUBMIT, never on cancel', () => {
    // The cancel path returns before anything is written.
    expect(confirm).toMatch(/if \(result === null\) return false;\s*if \(result\.dismissCommentsRisk === true\) rememberPublicCommentsRiskDismissed\(\);/);
    const beforeSubmitCheck = confirm.slice(0, confirm.indexOf('if (result === null) return false;'));
    expect(beforeSubmitCheck).not.toContain('rememberPublicCommentsRiskDismissed(');
  });

  it('CMTRISK-03: once dismissed the warning is skipped, and publishing still proceeds', () => {
    // Short-circuits to TRUE — the caller reads a false as "the author refused", which would silently stop the
    // publish instead of skipping the warning.
    expect(confirm).toMatch(/if \(publicCommentsRiskDismissed\(\)\) return true;/);
    // And the caller still gates on it, so the flag is the only thing that changed.
    expect(app).toContain("if (!publicCommentTarget && commentsAllowed && !(await confirmPublicCommentsRisk()))");
  });

  it('CMTRISK-04: storage failure keeps the warning, it does not swallow it', () => {
    const read = app.slice(app.indexOf('function publicCommentsRiskDismissed()'), app.indexOf('function rememberPublicCommentsRiskDismissed()'));
    // An unreadable store must not read as "already dismissed" — that would silence the warning on every device
    // with storage disabled.
    expect(read).toMatch(/catch \{ return false; \}/);
    expect(app).toContain("const PUBLIC_COMMENTS_RISK_DISMISSED_KEY = 'platho.publicCommentsRisk.dismissed.v1';");
  });

  it('CMTRISK-05: the label exists in every locale', () => {
    expect(strings.match(/"public\.openCommentsRiskDontShow":/g)?.length).toBe(10);
  });
});
