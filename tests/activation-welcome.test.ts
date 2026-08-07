import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

// ACTIVATION USED TO COMPLETE IN SILENCE.
//
// Owner, 2026-08-07: pressing "activate" activated the account and the button simply vanished, which reads as
// nothing having happened. It is also the one moment a user is certain to read something, so this is where the two
// facts they cannot undo afterwards are stated: nothing published can be deleted, and public is public in clear
// text. The wording was drafted and approved by the owner in that session.
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
    // An activation external can be accepted by an RPC and never land. The modal congratulates the user on a fact,
    // so it must come from the read that establishes the fact — the same rule the send lanes were corrected to.
    const refresh = APP.slice(APP.indexOf('async function refreshVaultActivationStatus'), APP.indexOf('} catch (error) {\n    // A transient read must NOT flip'));
    expect(refresh).toContain("setText(vaultRecordStatus, t('vault.activated'));");
    expect(refresh).toContain('maybeShowActivationWelcome(forWallet);');
    // Ordering: it may only fire AFTER the binding is written, or a re-entrant refresh could read a half-state.
    expect(refresh.indexOf('globalThis.plathoVaultBinding = { walletAddress: forWallet, user, keyRecord: null };'))
      .toBeLessThan(refresh.indexOf('maybeShowActivationWelcome(forWallet);'));
    // And nowhere else — in particular not next to the activation SEND.
    expect((APP.match(/maybeShowActivationWelcome\(/g) ?? []).length, 'one trigger, plus the definition').toBe(2);
    const send = functionBody('async function submitKeyShardRegisterDirect(');
    expect(send).not.toContain('maybeShowActivationWelcome');
    expect(send).not.toContain('openActivationWelcomeDialog');
  });

  it('ACTWELCOME-02: once per WALLET, and once per session even without storage', () => {
    const shown = functionBody('function activationWelcomeAlreadyShown(');
    // Keyed by the wallet: a second wallet on the same device is a different account and gets its own briefing.
    expect(APP).toContain("const ACTIVATION_WELCOME_SHOWN_KEY_PREFIX = 'platho.activationWelcome.v1.';");
    expect(functionBody('function activationWelcomeStorageKey(')).toContain('rawWalletAddress(walletAddress)');
    // A browser with no usable localStorage (private mode, quota) must not turn this into a modal on every refresh —
    // refreshVaultActivationStatus runs repeatedly, so a storage failure would otherwise loop it forever.
    expect(shown).toContain('if (activationWelcomeShownThisSession.has(key)) return true;');
    expect(functionBody('function markActivationWelcomeShown(')).toContain('activationWelcomeShownThisSession.add(key);');
    // No wallet to key it to: stay silent rather than pop it blind.
    expect(shown).toContain('if (!key) return true;');
  });

  it('ACTWELCOME-03: it never stacks on the quick-start — it becomes its last screen', () => {
    // Two .modal-backdrop layers at the same z-index is the v473 Telegram trap: the later one paints over the other
    // and swallows the pointer, which wedged the Mini App flow outright.
    const maybe = functionBody('function maybeShowActivationWelcome(');
    expect(maybe).toContain('if (quickStartDialog && !quickStartDialog.hidden) { pendingActivationWelcomeWallet = walletAddress; return; }');
    // Released from closeQuickStart, which EVERY exit runs through — finish, ✕ and skip-out alike.
    expect(functionBody('function closeQuickStart(')).toContain('flushPendingActivationWelcome();');
    expect(functionBody('function finishQuickStart(')).toContain('closeQuickStart();');
    // The deferred wallet is cleared as it is consumed, so a later close cannot re-open it.
    const flush = functionBody('function flushPendingActivationWelcome(');
    expect(flush).toContain('pendingActivationWelcomeWallet = null;');
    expect(flush).toContain('if (!wallet || activationWelcomeAlreadyShown(wallet)) return;');
  });

  it('ACTWELCOME-04: every warning is in the markup, and every string exists in EVERY locale', () => {
    const dialog = HTML.slice(HTML.indexOf('id="activationWelcomeDialog"'), HTML.indexOf('id="quickStartDialog"'));
    expect(dialog.length).toBeGreaterThan(0);
    // The three facts this modal exists to state. Structural, not wording: the copy may be re-edited, but a build
    // that drops one of these blocks is a build that stopped warning people.
    for (const key of ['welcome.irreversibleBody', 'welcome.publicBody', 'welcome.privateBody', 'welcome.responsibilityBody']) {
      expect(dialog, `${key} missing from the dialog`).toContain(`data-i18n="${key}"`);
    }
    // Executed parity over exactly what the markup asks for — a missing key renders the raw key id to the user.
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
    // House rule: modals dismiss on an explicit control, never on a backdrop click — a mis-tap must not throw away
    // the one screen that carries these warnings.
    expect(HTML).toContain('id="activationWelcomeCloseButton"');
    expect(HTML).toContain('id="activationWelcomeStartButton"');
    expect(APP).toContain("activationWelcomeCloseButton?.addEventListener('click', () => closeActivationWelcomeDialog());");
    expect(APP).toContain("activationWelcomeStartButton?.addEventListener('click', () => closeActivationWelcomeDialog());");
    expect(APP).not.toMatch(/activationWelcomeDialog\?\.addEventListener\('click'/);
  });
});
