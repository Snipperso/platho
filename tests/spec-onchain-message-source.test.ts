import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const SPEC_FILES = [
  'artifacts/platho_v1_spec_v0_3_3_deployment_ath_binding.md',
  'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
  'artifacts/M27_INTERFACE_DECISIONS.md',
  'artifacts/capsulehub_threat_model_checklist.md',
  'web/CRYPTO_PROTOCOL.md',
  'web/NO_BACKEND_ARCHITECTURE.md',
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('v1 on-chain message source of truth', () => {
  it('SPEC-MSG-SOURCE-01: v1 requires retrievable encrypted payload cells, not hash-only delivery', () => {
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/retrievable (encrypted )?(binary )?(on-chain )?payload cells|encrypted payload cells (stored by `CapsuleHub`|on-chain)|body_cell/i);
      expect(text, path).not.toMatch(/intentionally stores counter\/anchor metadata only/i);
    }
  });

  it('SPEC-MSG-SOURCE-02: v1 pins the binary capsule byte layout and useful capacity', () => {
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/PH0B/);
      expect(text, path).toMatch(/PH1B/);
      expect(text, path).toMatch(/140 bytes|140-byte/);
      expect(text, path).toMatch(/30 bytes|30-byte/);
      expect(text, path).toMatch(/1024[- ]byte|1024 useful (text )?bytes|1024-byte user payload slot/);
      expect(text, path).toMatch(/one encrypted 1024-byte|exactly one encrypted 1024-byte|exactly one 1024-byte|one 1024-byte useful payload slot/i);
      expect(text, path).not.toMatch(/14,336|14336|14 blocks|14 content blocks/i);
    }
  });

  it('SPEC-MSG-SOURCE-03: Vault publish surcharge is documented as retained CapsuleHub reserve, not refundable excess', () => {
    const surchargeDocs = [
      'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
    ];

    for (const path of surchargeDocs) {
      const text = read(path);
      expect(text, path).toMatch(/surcharge/i);
      expect(text, path).toMatch(/remain(s)?[\s\S]{0,80}CapsuleHub|retained[\s\S]{0,80}CapsuleHub/i);
      expect(text, path).toMatch(/30,000,000`? nanotons|0\.030 TON/i);
      expect(text, path).toMatch(/28,000,000`? nanotons|credited roughly/i);
      expect(text, path).toMatch(/fixed[\s\S]{0,60}ACK reserve|fixed ACK forward reserve|success(?:ful)? (publish )?ACK returns only/i);
      expect(text, path).toMatch(/not (a )?Vault refund|not returned to Vault|not counted as (`)?accrued_plato_fee_ton(`)?|not counted as protocol fee revenue/i);
      expect(text, path).not.toMatch(/ACK\/excess value to Vault|returns ACK\/excess|return(s)? ACK\/excess|plus true excess/i);
    }
  });

  it('SPEC-MSG-SOURCE-04: username ownership is registry-record authoritative, not item-only', () => {
    const usernameTruthDocs = [
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of usernameTruthDocs) {
      const text = read(path);
      expect(text, path).toMatch(/UsernameRegistry|get_name_record|name record/i);
      expect(text, path).toMatch(/UsernameNFTItem|item/i);
      expect(text, path).toMatch(/points? to that exact item|name_records\[name_hash\]/i);
      expect(text, path).toMatch(/non-authoritative|not (be )?treated as (username )?ownership|ownership is (defined|authoritative) .*registry/i);
      expect(text, path).not.toMatch(/UsernameNFTItem.*alone.*ownership/i);
    }

    const readerCode = read('web/username-ton-rpc-provider.mjs');
    expect(readerCode).toMatch(/resolveAuthoritativeUsernameItemOwnership/);
    expect(readerCode).toMatch(/getNameRecord\(itemState\.name_hash/);
    expect(readerCode).toMatch(/recordItemAddress === parsedItemAddress/);
    expect(readerCode).toMatch(/recordOwnerWallet === itemOwnerWallet/);
    expect(readerCode).toMatch(/missing_registry_record|registry_record_mismatch|item_registry_mismatch/);
  });

  it('SPEC-MSG-SOURCE-05: Vault ATH deposit and withdrawal wording matches notify-flow accounting', () => {
    const vaultAthDocs = [
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'web/CRYPTO_PROTOCOL.md',
      'web/docs/crypto-protocol.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md',
      'artifacts/platho_v1_open_values_v0_6.md',
    ];

    for (const path of vaultAthDocs) {
      const text = read(path);
      expect(text, path).toMatch(/manual\s+ordinary\s+ATH\s+transfer/i);
      expect(text, path).toMatch(/official Vault ATHWallet/i);
      expect(text, path).toMatch(/unsupported/i);
      expect(text, path).toMatch(/ATHTransferRequestWithNotify|transfer-with-notify|notify-flow/i);
      expect(text, path).toMatch(/WithdrawAth/i);
      expect(text, path).toMatch(/not (user |TON )?escrow/i);
      expect(text, path).toMatch(/authenticated ACK\/fail\/bounce/i);
      expect(text, path).toMatch(/capped\s+by\s+the\s+original\s+inbound/i);
      expect(text, path).not.toMatch(/withdraw returns all excess/i);
      expect(text, path).not.toMatch(/returns all excess/i);
      expect(text, path).not.toMatch(/full excess refund/i);
    }
  });

  it('SPEC-MSG-SOURCE-06: buyback split authority is documented as one-time treasury preflight authority', () => {
    const buybackSplitDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/fee_accumulator_threat_model_checklist.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_6.md',
      'artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md',
    ];

    for (const path of buybackSplitDocs) {
      const text = read(path);
      expect(text, path).toMatch(/EnableBuybackSplit|buyback split/i);
      expect(text, path).toMatch(/treasury receiver/i);
      expect(text, path).toMatch(/one-time|one-way/i);
      expect(text, path).toMatch(/preflight/i);
      expect(text, path).toMatch(/not admin\/rescue\/pause|cannot steal funds, pause, rescue/i);
      expect(text, path).toMatch(/permanently changes FeeAccumulator economics|50\/50 treasury\/buyback/i);
      expect(text, path).not.toMatch(/trust us bro/i);
      expect(text, path).not.toMatch(/no authority exists anywhere/i);
    }
  });

  it('SPEC-MSG-SOURCE-07: buyback burn success is ATHMaster finalization received by BuybackBurn', () => {
    const burnFinalizationDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/buybackburn_threat_model_checklist.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_6.md',
      'artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md',
    ];

    for (const path of burnFinalizationDocs) {
      const text = read(path);
      expect(text, path).toMatch(/BuybackBurn/i);
      expect(text, path).toMatch(/ATHMaster/i);
      expect(text, path).toMatch(/ATHBurnFinalized/i);
      expect(text, path).toMatch(/success|completed burn|completed supply reduction/i);
      expect(text, path).toMatch(/received by BuybackBurn|BuybackBurn receives|BuybackBurn receiving/i);
      expect(text, path).toMatch(/ATHBurnNotification|outbound burn request|burn attempt/i);
      expect(text, path).toMatch(/not (a )?success signal|not .*count|must not .*count|not .*clear/i);
    }
  });

  it('SPEC-MSG-SOURCE-08: MarketStabilitySeller readiness requires full reserve and notify-flow funding', () => {
    const sellerDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_50_market_stability_seller.md',
      'artifacts/MILESTONE_SUMMARY_M50_MARKET_STABILITY_SELLER.md',
    ];

    for (const path of sellerDocs) {
      const text = read(path);
      expect(text, path).toMatch(/MarketStabilitySeller/i);
      expect(text, path).toMatch(/reserve_due_ath/i);
      expect(text, path).toMatch(/reserve_funded_total_ath|reserve funded/i);
      expect(text, path).toMatch(/60,000,000 ATH/);
      expect(text, path).toMatch(/official seller ATH wallet|official `?ATHWallet\(owner = MarketStabilitySeller/i);
      expect(text, path).toMatch(/partial reserve funding|partial sales|partial sale/i);
      expect(text, path).toMatch(/not full-launch readiness|not full reserve|not .*readiness/i);
      expect(text, path).toMatch(/notify-flow|ATH notification|authenticated reserve funding/i);
      expect(text, path).toMatch(/manual ordinary ATH transfer|unsolicited ordinary ATH transfer/i);
      expect(text, path).toMatch(/unsupported|not tracked reserve/i);
      expect(text, path).toMatch(/does not (expand|increase) sellable supply|bounded by `?reserve_due_ath`?/i);
    }
  });

  it('SPEC-MSG-SOURCE-09: MarketStabilitySeller readiness is post-pool and does not replace final genesis verification', () => {
    const readinessDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
      'artifacts/platho_v1_open_values_v0_50_market_stability_seller.md',
      'artifacts/MILESTONE_SUMMARY_M50_MARKET_STABILITY_SELLER.md',
    ];

    for (const path of readinessDocs) {
      const text = read(path);
      expect(text, path).toMatch(/MarketStabilitySeller|market-stability:readiness/i);
      expect(text, path).toMatch(/mainnet:genesis:verify|mainnet_genesis_verify|final genesis verifier/i);
      expect(text, path).toMatch(/not (a )?(standalone )?(replacement|substitute)|does not replace|not a standalone/i);
      expect(text, path).toMatch(/post-pool|pricing freeze|FreezeMarketStabilityPricing/i);
      expect(text, path).toMatch(/reserve funding|funding has occurred|funds the seller/i);
      expect(text, path).toMatch(/readiness.*PASS|seller readiness PASS|market-stability:readiness`? PASS/i);
    }
  });

  it('SPEC-MSG-SOURCE-10: release docs name narrow authorities without implying broad admin control', () => {
    const authorityDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'web/docs/ath-whitepaper.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of authorityDocs) {
      const text = read(path);
      expect(text, path).toMatch(/authority|authorities/i);
      expect(text, path).toMatch(/treasury owner|ath_treasury_owner/i);
      expect(text, path).toMatch(/DeployTreasurySupply|initial ATH supply/i);
      expect(text, path).toMatch(/genesis controller|genesis_controller_one_shot/i);
      expect(text, path).toMatch(/pre-seal bind|pre-seal binding|seal actions/i);
      expect(text, path).toMatch(/BuybackBurn[\s\S]{0,120}route freeze|route freeze[\s\S]{0,120}BuybackBurn/i);
      expect(text, path).toMatch(/MarketStabilitySeller[\s\S]{0,140}pricing freeze|pricing freeze[\s\S]{0,140}MarketStabilitySeller/i);
      expect(text, path).toMatch(/treasury receiver[\s\S]{0,160}EnableBuybackSplit|EnableBuybackSplit[\s\S]{0,160}treasury receiver/i);
      expect(text, path).toMatch(/no rescue|not (a )?rescue|rescue, pause|pause, rescue/i);
      expect(text, path).toMatch(/admin drain|admin\/rescue\/pause|arbitrary balance-control|cannot steal funds/i);
      expect(text, path).not.toMatch(/no authority exists anywhere|no authorities exist|no authority at all/i);
    }

    const readinessDocs = [
      'PRODUCTION_READINESS.md',
      'DEPLOYMENT_RUNBOOK.md',
      'artifacts/PWA_CONTRACT_INTERFACE_MATRIX.md',
    ];

    for (const path of readinessDocs) {
      const text = read(path);
      expect(text, path).toMatch(/M20T/i);
      expect(text, path).toMatch(/harness/i);
      expect(text, path).toMatch(/M20F/i);
      expect(text, path).toMatch(/market-stability:readiness|MarketStabilitySeller readiness/i);
      expect(text, path).toMatch(/not .*substitute|not .*replacement|must not .*replace/i);
      expect(text, path).toMatch(/mainnet:genesis:verify|mainnet_genesis_verify/i);
    }
  });
});
