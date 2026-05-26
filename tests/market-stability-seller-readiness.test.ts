import { createHash } from 'crypto';
import { Address } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  MarketStabilitySellerReadinessInput,
  verifyMarketStabilitySellerReadiness,
} from '../scripts/market_stability_seller_readiness';

function addr(label: string, workchain = 0): string {
  return new Address(workchain, createHash('sha256').update(`PLATHO.MARKET.STABILITY.READINESS.${label}`).digest()).toString();
}

function hash(label: string): string {
  return createHash('sha256').update(`PLATHO.MARKET.STABILITY.READINESS.HASH.${label}`).digest('hex');
}

function readyInput(): MarketStabilitySellerReadinessInput {
  const addresses = {
    ath_master: addr('ath_master'),
    market_stability_seller: addr('market_stability_seller'),
    market_stability_seller_official_ath_wallet: addr('market_stability_seller_official_ath_wallet'),
    market_stability_reserve_funder: addr('market_stability_reserve_funder'),
    market_stability_ton_treasury_receiver: addr('market_stability_ton_treasury_receiver'),
  };
  const code_hashes = {
    ath_wallet: hash('ath_wallet'),
    market_stability_seller: hash('market_stability_seller'),
  };
  const manifestHash = hash('manifest');

  return {
    document: 'PLATHO.V1.MARKET_STABILITY_SELLER_READINESS_INPUT',
    network: 'mainnet',
    manifest: {
      profile: 'PLATHO.V1.FINAL_GENESIS_MANIFEST',
      status: 'FINAL_GENESIS',
      manifest_hash_hex: manifestHash,
      addresses,
      code_hashes,
      constants: {
        ath_market_stability_reserve_allocation_atomic: '60000000000000000',
        ath_market_stability_tranche_atomic: '3000000000000000',
        ath_market_stability_tranche_count: '20',
        ath_market_stability_start_multiplier: '2',
        ath_market_stability_end_multiplier: '21',
      },
      blockers_before_final_genesis: [],
    },
    snapshot: {
      market_stability_seller: {
        address: addresses.market_stability_seller,
        code_hash: code_hashes.market_stability_seller,
        sealed: true,
        deployment_manifest_hash: manifestHash,
        reserve_funder_address: addresses.market_stability_reserve_funder,
        official_ath_wallet_address: addresses.market_stability_seller_official_ath_wallet,
        ton_treasury_receiver_address: addresses.market_stability_ton_treasury_receiver,
        ath_master_address: addresses.ath_master,
        genesis_config_hash: '0'.repeat(64),
        pricing_frozen: true,
        base_tranche_price_nanotons: '1000000000',
        evidence_x1_tranche_quote_nanotons: '1000000000',
        pricing_evidence_hash: hash('pricing_evidence'),
        phase: '0',
        reserve_due_ath: '60000000000000000',
        treasury_due_ton: '0',
        pending_query_id: '0',
        pending_amount_ath: '0',
        pending_paid_ton: '0',
        completed_tranche_count: '0',
        current_tranche_sold_ath: '0',
        current_multiplier: '2',
        current_tranche_remaining_ath: '3000000000000000',
        last_terminal_query_id: '0',
        reserve_funded_total_ath: '60000000000000000',
        sold_ath_total: '0',
        treasury_flushed_ton_total: '0',
      },
      market_stability_seller_official_ath_wallet: {
        address: addresses.market_stability_seller_official_ath_wallet,
        code_hash: code_hashes.ath_wallet,
        owner_address: addresses.market_stability_seller,
        ath_master_address: addresses.ath_master,
        balance_atomic: '60000000000000000',
      },
    },
    evidenceRefs: {
      finalPoolLaunchPriceSource: 'sha256:pool-launch-price-proof',
      pricingFreezeTx: 'tx:freeze-market-stability-pricing',
      reserveFundingTx: 'tx:fund-market-stability-reserve',
      getterSnapshotSource: 'sha256:market-seller-getter-snapshot',
      codeHashProofSource: 'sha256:market-seller-code-hash-proof',
      finalManifestSource: 'sha256:final-genesis-manifest',
    },
  };
}

describe('MarketStabilitySeller post-pool readiness gate', () => {
  it('stays blocked when no post-pool getter snapshot input is supplied', () => {
    const report = verifyMarketStabilitySellerReadiness(null);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.status).toBe('BLOCKED_MISSING_INPUT');
    expect(report.issue_codes).toEqual(['MISSING_INPUT']);
  });

  it('accepts only a frozen, fully funded, sale-zero MarketStabilitySeller snapshot', () => {
    const report = verifyMarketStabilitySellerReadiness(readyInput());

    expect(report.market_stability_seller_ready).toBe(true);
    expect(report.status).toBe('MARKET_STABILITY_SELLER_READY');
    expect(report.issue_codes).toEqual([]);
    expect(report.warning_codes).toEqual([]);
    expect(report.reserve_allocation_atomic).toBe('60000000000000000');
    expect(report.base_tranche_price_nanotons).toBe('1000000000');
  });

  it('rejects a seller whose post-pool pricing was not frozen and controller hash was not cleared', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.pricing_frozen = false;
    input.snapshot.market_stability_seller.genesis_config_hash = hash('still_live_controller');
    input.snapshot.market_stability_seller.base_tranche_price_nanotons = '0';
    input.snapshot.market_stability_seller.pricing_evidence_hash = '0'.repeat(64);

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_PRICING_NOT_FROZEN');
    expect(report.issue_codes).toContain('MARKET_STABILITY_LAUNCH_CONTROLLER_NOT_CLEARED');
    expect(report.issue_codes).toContain('MARKET_STABILITY_BASE_PRICE_NOT_SET');
    expect(report.issue_codes).toContain('MARKET_STABILITY_PRICING_EVIDENCE_HASH_MISSING');
  });

  it('rejects underpriced base tranche snapshots even when x1 evidence is higher', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.base_tranche_price_nanotons = '1';
    input.snapshot.market_stability_seller.evidence_x1_tranche_quote_nanotons = '1000000000';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_BASE_PRICE_EVIDENCE_MISMATCH');
  });

  it('rejects overpriced base tranche snapshots when x1 evidence is lower', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.base_tranche_price_nanotons = '1000000000';
    input.snapshot.market_stability_seller.evidence_x1_tranche_quote_nanotons = '1';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_BASE_PRICE_EVIDENCE_MISMATCH');
  });

  it('rejects malformed x1 evidence decimals without throwing', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.evidence_x1_tranche_quote_nanotons = 'required: launch x1 quote';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('BAD_MARKET_STABILITY_BASE_PRICE_EVIDENCE_DECIMAL');
  });

  it('rejects underfunded or accounting-mismatched reserve backing', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.reserve_due_ath = '59999999999999999';
    input.snapshot.market_stability_seller.reserve_funded_total_ath = '59999999999999999';
    input.snapshot.market_stability_seller_official_ath_wallet.balance_atomic = '59999999999999999';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_DUE_NOT_FULLY_FUNDED');
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDED_TOTAL_MISMATCH');
    expect(report.issue_codes).toContain('MARKET_STABILITY_OFFICIAL_WALLET_BALANCE_UNDERFUNDED');
  });

  it('rejects accounting-underfunded reserve state even when the official wallet balance is full', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.reserve_due_ath = '59999999999999999';
    input.snapshot.market_stability_seller.reserve_funded_total_ath = '59999999999999999';
    input.snapshot.market_stability_seller_official_ath_wallet.balance_atomic = '60000000000000000';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_DUE_NOT_FULLY_FUNDED');
    expect(report.issue_codes).toContain('MARKET_STABILITY_RESERVE_FUNDED_TOTAL_MISMATCH');
    expect(report.issue_codes).not.toContain('MARKET_STABILITY_OFFICIAL_WALLET_BALANCE_UNDERFUNDED');
  });

  it('allows donated ATH dust above the tracked reserve as a non-blocking warning', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller_official_ath_wallet.balance_atomic = '60000000000000001';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(true);
    expect(report.issue_codes).toEqual([]);
    expect(report.warning_codes).toContain('MARKET_STABILITY_OFFICIAL_WALLET_BALANCE_HAS_EXCESS_DONATION');
  });

  it('rejects snapshots with previous sale state before operational readiness is declared', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller.phase = '1';
    input.snapshot.market_stability_seller.pending_query_id = '1';
    input.snapshot.market_stability_seller.completed_tranche_count = '1';
    input.snapshot.market_stability_seller.current_multiplier = '3';
    input.snapshot.market_stability_seller.current_tranche_remaining_ath = '2999999999999999';
    input.snapshot.market_stability_seller.sold_ath_total = '1';
    input.snapshot.market_stability_seller.treasury_due_ton = '1';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_PHASE_NOT_IDLE');
    expect(report.issue_codes).toContain('MARKET_STABILITY_PENDING_QUERY_NOT_ZERO');
    expect(report.issue_codes).toContain('MARKET_STABILITY_COMPLETED_TRANCHE_COUNT_NOT_ZERO');
    expect(report.issue_codes).toContain('MARKET_STABILITY_CURRENT_MULTIPLIER_NOT_START');
    expect(report.issue_codes).toContain('MARKET_STABILITY_CURRENT_TRANCHE_REMAINING_MISMATCH');
    expect(report.issue_codes).toContain('MARKET_STABILITY_SOLD_TOTAL_NOT_ZERO');
    expect(report.issue_codes).toContain('MARKET_STABILITY_TREASURY_DUE_NOT_ZERO');
  });

  it('rejects wrong official ATH wallet identity', () => {
    const input = readyInput();
    input.snapshot.market_stability_seller_official_ath_wallet.owner_address = addr('wrong_owner');
    input.snapshot.market_stability_seller_official_ath_wallet.ath_master_address = addr('wrong_master');

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MARKET_STABILITY_OFFICIAL_WALLET_OWNER_MISMATCH');
    expect(report.issue_codes).toContain('MARKET_STABILITY_OFFICIAL_WALLET_MASTER_MISMATCH');
  });

  it('rejects missing seller getter snapshots without throwing', () => {
    const input = readyInput() as any;
    delete input.snapshot.market_stability_seller;
    delete input.snapshot.market_stability_seller_official_ath_wallet;

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MISSING_MARKET_STABILITY_SELLER_SNAPSHOT');
    expect(report.issue_codes).toContain('MISSING_MARKET_STABILITY_SELLER_OFFICIAL_ATH_WALLET_SNAPSHOT');
  });

  it('rejects placeholder evidence references', () => {
    const input = readyInput();
    input.evidenceRefs.finalPoolLaunchPriceSource = 'required: pool launch price proof';
    input.evidenceRefs.reserveFundingTx = '';

    const report = verifyMarketStabilitySellerReadiness(input);

    expect(report.market_stability_seller_ready).toBe(false);
    expect(report.issue_codes).toContain('MISSING_EVIDENCE_REF_FINALPOOLLAUNCHPRICESOURCE');
    expect(report.issue_codes).toContain('MISSING_EVIDENCE_REF_RESERVEFUNDINGTX');
  });
});
