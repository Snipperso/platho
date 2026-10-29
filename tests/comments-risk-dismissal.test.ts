import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');
const strings = readFileSync('web/i18n-strings.mjs', 'utf8');

const confirm = app.slice(
  app.indexOf('async function confirmPublicCommentsRisk()'),
  app.indexOf('function renderConfiguredShell()'),
);

describe('open-comments warning dismissal', () => {
  it('CMTRISK-01: the checkbox is NOT required — it can never block publishing', () => {
    expect(confirm.length).toBeGreaterThan(0);
    expect(confirm).toMatch(/id: 'dismissCommentsRisk',\s*type: 'checkbox',\s*required: false,/);
    const start = app.indexOf("if (field.type === 'checkbox') {");
    expect(start, 'the checkbox branch is gone or renamed').toBeGreaterThan(0);
    const field = app.slice(start, app.indexOf('    return wrapper;', start))
      .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    expect(field, 'a tick is an option: a gate must ask for it').toContain('input.required = field.required === true;');
    expect(field, 'the opt-OUT default is gone from the code, not merely explained in a comment').not.toContain('field.required !== false');
  });

  it('CMTRISK-02: dismissal is remembered only on SUBMIT, never on cancel', () => {
    expect(confirm).toMatch(/if \(result === null\) return false;\s*if \(result\.dismissCommentsRisk === true\) rememberPublicCommentsRiskDismissed\(\);/);
    const beforeSubmitCheck = confirm.slice(0, confirm.indexOf('if (result === null) return false;'));
    expect(beforeSubmitCheck).not.toContain('rememberPublicCommentsRiskDismissed(');
  });

  it('CMTRISK-03: once dismissed the warning is skipped, and publishing still proceeds', () => {
    expect(confirm).toMatch(/if \(publicCommentsRiskDismissed\(\)\) return true;/);
    expect(app).toContain("if (!publicCommentTarget && commentsAllowed && !(await confirmPublicCommentsRisk()))");
  });

  it('CMTRISK-04: storage failure keeps the warning, it does not swallow it', () => {
    const read = app.slice(app.indexOf('function publicCommentsRiskDismissed()'), app.indexOf('function rememberPublicCommentsRiskDismissed()'));
    expect(read).toMatch(/catch \{ return false; \}/);
    expect(app).toContain("const PUBLIC_COMMENTS_RISK_DISMISSED_KEY = 'platho.publicCommentsRisk.dismissed.v1';");
  });

  it('CMTRISK-05: the label exists in every locale', () => {
    expect(strings.match(/"public\.openCommentsRiskDontShow":/g)?.length).toBe(10);
  });
});
