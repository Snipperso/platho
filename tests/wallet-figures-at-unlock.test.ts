import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);

describe('the wallet\'s figures', () => {
  it('WFIG-01: the buy window says "—" for a balance not read, the balance itself once read; nothing reads an unknown balance as zero', () => {
    const buy = code(fn('async function openBuyAthDialog('));
    const row = buy.slice(buy.indexOf("{ label: t('profile.buyAthSummaryBalance'), value: "));
    const value = row.slice(0, row.indexOf(' },') + 3);
    expect(value).toBe("{ label: t('profile.buyAthSummaryBalance'), value: typeof vaultPocketState.wallet?.ton_balance === 'bigint'\n        ? `${formatGramNanotons(nonNegativeBigInt(vaultPocketState.wallet.ton_balance))} GRAM` : '—' },");
    const shown = (wallet: any) => new Function('vaultPocketState', 'formatGramNanotons', 'nonNegativeBigInt',
      `return ${value.slice(value.indexOf('value: ') + 7, -3)};`)({ wallet }, (v: bigint) => String(v), (v: bigint) => (v < 0n ? 0n : v));
    expect(shown({ ton_balance: null })).toBe('—');
    expect(shown(null)).toBe('—');
    expect(shown({ ton_balance: 12_345n })).toBe('12345 GRAM');
    expect(shown({ ton_balance: 0n })).toBe('0 GRAM');
    expect(code(app)).not.toContain('ton_balance ?? 0n');
  });

  it('WFIG-02: the unlock asks for the wallet\'s balances before the message sync and the avatar, not after them', () => {
    const boot = code(fn('async function bootCrypto() {'));
    const ask = boot.indexOf('void refreshVaultNavBalanceInBackground().catch(() => {});');
    expect(ask).toBeGreaterThan(boot.indexOf('markBootAppReady();'));
    expect(ask).toBeLessThan(boot.indexOf('beginMessageSyncUi();'));
    expect(ask).toBeLessThan(boot.indexOf("await syncPrivateCapsulesFromChainOnce({ mode: 'auto' })"));
    expect(ask).toBeLessThan(boot.indexOf('await refreshOwnProfileAvatar()'));
  });
});
