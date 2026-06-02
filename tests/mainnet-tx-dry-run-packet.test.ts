import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const OFFICIAL_ATH_WALLET_KEYS = [
  'ath_treasury_owner_ath_wallet',
  'ath_long_term_vesting_official_ath_wallet',
  'vault_official_ath_wallet',
  'buyback_burn_official_ath_wallet',
  'market_stability_seller_official_ath_wallet',
  'username_registry_official_ath_wallet',
  'profile_registry_official_ath_wallet',
];

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('mainnet transaction dry-run packet', () => {
  it('H-DEP-DRYRUN-01: script derives every official ATHWallet StateInit used by final genesis', () => {
    const script = readFileSync('scripts/mainnet_tx_dry_run_packet.ts', 'utf8');

    for (const key of OFFICIAL_ATH_WALLET_KEYS) {
      expect(script).toContain(key);
      expect(script).toContain(`draft.manifest.state_init_hashes.${key}`);
    }
    expect(script).toContain('owner_address');
    expect(script).toContain('ath_master_address');
  });

  it('H-DEP-DRYRUN-02: generated local packet exposes StateInit for every official ATHWallet', () => {
    if (!existsSync('artifacts/local/mainnet_tx_dry_run_packet.json') || !existsSync('artifacts/local/mainnet_final_manifest_draft.json')) {
      return;
    }

    const packet = readJson('artifacts/local/mainnet_tx_dry_run_packet.json');
    const draft = readJson('artifacts/local/mainnet_final_manifest_draft.json');
    const walletStateInits = packet.official_wallet_state_inits ?? {};

    expect(Object.keys(walletStateInits).sort()).toEqual([...OFFICIAL_ATH_WALLET_KEYS].sort());

    for (const key of OFFICIAL_ATH_WALLET_KEYS) {
      expect(walletStateInits[key]?.address).toBe(draft.manifest.addresses[key]);
      expect(walletStateInits[key]?.ath_master_address).toBe(draft.manifest.addresses.ath_master);
      expect(walletStateInits[key]?.owner_address).toMatch(/^UQ/);
      expect(walletStateInits[key]?.state_init?.cell_hash_hex).toBe(draft.manifest.state_init_hashes[key]);
    }
  });
});
