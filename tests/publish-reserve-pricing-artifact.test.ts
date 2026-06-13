import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import {
  PUBLIC_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS,
  PUBLIC_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS,
  PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS,
  PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS,
} from '../web/message-pricing-policy.mjs';

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

// NOTE(Session 6 — client pricing rework): the VPB2 redeploy removed the per-message getter
// get_canonical_publish_charge and replaced the single-message charge model with the batch floor-pin +
// post-accept canonicalTotal. The generator (scripts/publish_reserve_pricing.ts) was migrated onto the VPB2
// batch path: it now drives a signed batch external through the bound+sealed Vault + CapsuleHub for evidence
// and sources the per-size hold / net price / protocol fee from web/message-pricing-policy.mjs. The hold/net
// tables pinned here still belong to the OLD per-message client model and are scheduled for re-derivation
// against the batch floor-pin in the Session 6 client pricing rework; the report records the runtime canonical
// total in observed_settled_charge_nanotons so that re-derivation has current-build evidence.
describe('Publish reserve pricing artifacts', () => {
  it('PUBLISH-PRICE-ARTIFACT-01: pricing report is tied to current build code hashes', () => {
    const report = readJson('artifacts/publish_reserve_pricing_report.json');
    const current = currentCodeHashes();

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.vault).toBe(current.VAULT_CODE_HASH);
    expect(report.code_hashes.capsulehub).toBe(current.CAPSULEHUB_CODE_HASH);
    expect(report.code_hashes.ath_wallet).toBe(current.ATH_WALLET_CODE_HASH);
    expect(report.policy.current_code_hash_gate).toMatch(/CURRENT_CODE_HASHES/);
    expect(report.policy.network_fee_basis).toMatch(/2026-06-02 TON mainnet/);
    expect(report.policy.reference_safety_multiplier).toBe('2');
    expect(report.fee_config_snapshot.config_18_latest_utime_since).toBe('1777500000');
    expect(report.fee_config_snapshot.config_18_latest_bit_price_ps).toBe('0');
    expect(report.fee_config_snapshot.config_18_latest_cell_price_ps).toBe('135');
    expect(report.fee_config_snapshot.config_18_latest_mc_bit_price_ps).toBe('1000');
    expect(report.fee_config_snapshot.config_18_latest_mc_cell_price_ps).toBe('500000');
    expect(report.fee_config_snapshot.config_21_flat_gas_price).toBe('6667');
    expect(report.fee_config_snapshot.config_21_gas_price).toBe('4369067');
    expect(report.fee_config_snapshot.config_25_lump_price).toBe('66667');
    expect(report.fee_config_snapshot.config_25_bit_price).toBe('4369067');
    expect(report.fee_config_snapshot.config_25_cell_price).toBe('436906667');
    expect(report.current_constants_nanotons.privateHybridFee).toBe('10000000');
    expect(report.current_constants_nanotons.publicFee).toBe('10000000');
    expect(report.cases.find((item: any) => item.id === 'public_1k')?.user_net_debit_nanotons).toBe('33700000');
    expect(report.cases.find((item: any) => item.id === 'private_hybrid_1k')?.user_net_debit_nanotons).toBe('34700000');
    expect(report.cases.map((item: any) => item.id)).toEqual([
      'public_1k',
      'public_2k',
      'public_4k',
      'public_8k',
      'public_16k',
      'public_32k',
      'private_hybrid_1k',
      'private_hybrid_2k',
      'private_hybrid_4k',
      'private_hybrid_8k',
      'private_hybrid_16k',
      'private_hybrid_32k',
    ]);
  });

  it('PUBLISH-PRICE-ARTIFACT-02: storage economics report is tied to current CapsuleHub hash and margin gate', () => {
    const report = readJson('artifacts/capsulehub_storage_economics_report.json');
    const current = currentCodeHashes();

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.capsulehub).toBe(current.CAPSULEHUB_CODE_HASH);
    expect(BigInt(report.worst_margin_nanotons)).toBeGreaterThanOrEqual(BigInt(report.minimum_retained_margin_nanotons));
  });

  it('PUBLISH-PRICE-CROSSCHECK-01: pricing report matches the PWA public/private hold and net table', () => {
    const report = readJson('artifacts/publish_reserve_pricing_report.json');
    const cases = new Map(report.cases.map((item: any) => [item.id, item]));

    for (const [sizeClass, hold] of Object.entries(PUBLIC_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS)) {
      const publicCase = cases.get(`public_${sizeClass}k`);
      expect(publicCase, `public_${sizeClass}k`).toBeTruthy();
      expect(publicCase.canonical_max_charge_nanotons).toBe(hold.toString());
      expect(publicCase.user_net_debit_nanotons).toBe(PUBLIC_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[sizeClass].toString());
      expect(publicCase.protocol_fee_nanotons).toBe('10000000');
    }

    for (const [sizeClass, hold] of Object.entries(PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS)) {
      const privateCase = cases.get(`private_hybrid_${sizeClass}k`);
      expect(privateCase, `private_hybrid_${sizeClass}k`).toBeTruthy();
      expect(privateCase.canonical_max_charge_nanotons).toBe(hold.toString());
      expect(privateCase.user_net_debit_nanotons).toBe(PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[sizeClass].toString());
      expect(privateCase.protocol_fee_nanotons).toBe('10000000');
    }
  });
});
