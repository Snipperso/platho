import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { runAthWalletTombstoneEconomics } from '../scripts/ath_wallet_tombstone_economics';

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function currentCodeHashes(): Record<string, string> {
  return Object.fromEntries(readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const [key, value] = line.split('=', 2);
      return [key, value];
    }));
}

describe('ATHWallet tombstone economics', () => {
  it('ATH-WALLET-STORAGE-01: notification tombstone terminal paths retain their storage endowment', async () => {
    const report = await runAthWalletTombstoneEconomics(false);

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.ath_wallet).toBe(currentCodeHashes().ATH_WALLET_CODE_HASH);
    expect(BigInt(report.required_tombstone_endowment_nanotons)).toBe(2_000_000n);
    expect(report.cases.map((item) => item.label)).toEqual([
      'NORMAL_NOTIFY_ACK',
      'VAULT_USERNAME_NOTIFY_ACK',
      'VAULT_PROFILE_NOTIFY_ACK',
      'JETTON_NOTIFY_ACK',
      'NORMAL_NOTIFY_STALE_PRUNE',
    ]);
    for (const item of report.cases) {
      expect(item.pending_exists_after_terminal, item.label).toBe(false);
      expect(item.wallet_token_balance_atomic, item.label).toBe('100000000');
      expect(BigInt(item.retained_excluding_terminal_value_nanotons), item.label)
        .toBeGreaterThanOrEqual(BigInt(item.required_tombstone_endowment_nanotons));
      expect(BigInt(item.retained_margin_nanotons), item.label).toBeGreaterThanOrEqual(0n);
    }
  }, 30000);

  it('ATH-WALLET-STORAGE-02: checked artifact is tied to the current ATHWallet code hash', () => {
    const report = readJson('artifacts/ath_wallet_tombstone_economics_report.json');

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.ath_wallet).toBe(currentCodeHashes().ATH_WALLET_CODE_HASH);
    expect(BigInt(report.worst_margin_nanotons)).toBeGreaterThanOrEqual(0n);
  });
});
