import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

const APP = readFileSync('web/app.js', 'utf8');
const HTML = readFileSync('web/index.html', 'utf8');

function functionBody(name: string): string {
  const start = APP.indexOf(name);
  if (start < 0) return '';
  const end = APP.indexOf('\n}', start);
  return APP.slice(start, end < 0 ? APP.length : end + 2);
}

describe('ACTWELCOME — the welcome fires on chain truth, once, and never over the quick-start', () => {
  it('ACTWELCOME-01: the trigger is the KeyShard read, not the activation broadcast', () => {
    const refresh = APP.slice(APP.indexOf('async function refreshVaultActivationStatus'), APP.indexOf('} catch (error) {\n    // A transient read must NOT flip'));
    expect(refresh).toContain("setText(vaultRecordStatus, t('vault.activated'));");
    expect(refresh).toContain('maybeShowActivationWelcome(forWallet);');
    expect(refresh.indexOf('globalThis.plathoVaultBinding = { walletAddress: forWallet, user, keyRecord: null };'))
      .toBeLessThan(refresh.indexOf('maybeShowActivationWelcome(forWallet);'));
    expect((APP.match(/maybeShowActivationWelcome\(/g) ?? []).length, 'one trigger, plus the definition').toBe(2);
    const send = functionBody('async function submitKeyShardRegisterDirect(');
    expect(send).not.toContain('maybeShowActivationWelcome');
    expect(send).not.toContain('openActivationWelcomeDialog');
  });

  it('ACTWELCOME-02: once per WALLET, and once per session even without storage', () => {
    const shown = functionBody('function activationWelcomeAlreadyShown(');
    expect(APP).toContain("const ACTIVATION_WELCOME_SHOWN_KEY_PREFIX = 'platho.activationWelcome.v1.';");
    expect(functionBody('function activationWelcomeStorageKey(')).toContain('rawWalletAddress(walletAddress)');
    expect(shown).toContain('if (activationWelcomeShownThisSession.has(key)) return true;');
    expect(functionBody('function markActivationWelcomeShown(')).toContain('activationWelcomeShownThisSession.add(key);');
    expect(shown).toContain('if (!key) return true;');
  });

  it('ACTWELCOME-03: it never stacks on the quick-start — it becomes its last screen', () => {
    const maybe = functionBody('function maybeShowActivationWelcome(');
    expect(maybe).toContain('if (quickStartDialog && !quickStartDialog.hidden) { pendingActivationWelcomeWallet = walletAddress; return; }');
    expect(functionBody('function closeQuickStart(')).toContain('flushPendingActivationWelcome();');
    expect(functionBody('function finishQuickStart(')).toContain('closeQuickStart();');
    const flush = functionBody('function flushPendingActivationWelcome(');
    expect(flush).toContain('pendingActivationWelcomeWallet = null;');
    expect(flush).toContain('if (!wallet || activationWelcomeAlreadyShown(wallet)) return;');
  });

  it('ACTWELCOME-04: every warning is in the markup, and every string exists in EVERY locale', () => {
    const dialog = HTML.slice(HTML.indexOf('id="activationWelcomeDialog"'), HTML.indexOf('id="quickStartDialog"'));
    expect(dialog.length).toBeGreaterThan(0);
    for (const key of ['welcome.irreversibleBody', 'welcome.publicBody', 'welcome.privateBody', 'welcome.responsibilityBody']) {
      expect(dialog, `${key} missing from the dialog`).toContain(`data-i18n="${key}"`);
    }
    const referenced = [...new Set([...dialog.matchAll(/data-i18n="(welcome\.[A-Za-z]+)"/g)].map((m) => m[1]))];
    expect(referenced.length).toBeGreaterThanOrEqual(12);
    const missing: string[] = [];
    for (const { code } of I18N_LOCALES as Array<{ code: string }>) {
      for (const key of referenced) {
        const value = (I18N_STRINGS as Record<string, Record<string, string>>)[code]?.[key];
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${code}:${key}`);
      }
    }
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('ACTWELCOME-05: it closes by ✕ or Start, and by nothing else', () => {
    expect(HTML).toContain('id="activationWelcomeCloseButton"');
    expect(HTML).toContain('id="activationWelcomeStartButton"');
    expect(APP).toContain("activationWelcomeCloseButton?.addEventListener('click', () => closeActivationWelcomeDialog());");
    expect(APP).toContain("activationWelcomeStartButton?.addEventListener('click', () => closeActivationWelcomeDialog());");
    expect(APP).not.toMatch(/activationWelcomeDialog\?\.addEventListener\('click'/);
  });
});
