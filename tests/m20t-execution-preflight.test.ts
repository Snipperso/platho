import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { createM20TExecutionPreflight } from '../scripts/m20t_execution_preflight.mjs';

const baseInput = {
  env: {
    network: 'testnet',
    rpcEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    deployerAddress: '0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    deployerWalletVersion: 'v4r2',
    minBalanceNanotons: toNano('55').toString(),
    allowMainnet: 'false',
    setStonfiRouteFreezeReady: 'false',
    setBuybackBurnImplementationReady: 'false',
  },
  observedBalanceNanotons: toNano('55'),
  envLocalExists: true,
  envExampleExists: true,
  vitestAllConfigText: "export default { test: { pool: 'vmThreads' } }",
  manifestTemplateText: JSON.stringify({ status: 'TEMPLATE_NOT_EXECUTED' }),
  evidenceTemplateText: JSON.stringify({
    status: 'TEMPLATE_NOT_EXECUTED',
    requiredFinalStatement: 'M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.',
  }),
  gitignoreText: '.env.*\n*.mnemonic\n*.seed\n',
  envLocalSecretPresence: {
    mnemonicPresent: true,
    rpcApiKeyPresent: true,
  },
};

describe('M20T execution preflight', () => {
  it('M20T-PREFLIGHT-01: allows full-size execution only with testnet latches and 55 TON balance', () => {
    const report = createM20TExecutionPreflight(baseInput);

    expect(report.status).toBe('READY_FOR_FULL_SIZE_M20T');
    expect(report.allowedToExecuteFullSizeM20T).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.productionUnlock).toBe(false);
    expect(report.deployer.secretMaterialPrinted).toBe(false);
  });

  it('M20T-PREFLIGHT-02: reports accumulation mode below 55 TON without opening production flags', () => {
    const report = createM20TExecutionPreflight({
      ...baseInput,
      observedBalanceNanotons: toNano('40'),
    });

    expect(report.status).toBe('READY_FOR_SCALED_HARNESS_ONLY');
    expect(report.allowedToExecuteFullSizeM20T).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.funding.remainingForFullSizeM20TNanotons).toBe(toNano('15').toString());
  });

  it('M20T-PREFLIGHT-03: blocks if the environment points away from testnet', () => {
    const report = createM20TExecutionPreflight({
      ...baseInput,
      env: {
        ...baseInput.env,
        network: 'mainnet',
        rpcEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
        allowMainnet: 'true',
      },
    });

    expect(report.status).toBe('BLOCKED_BY_PREFLIGHT');
    expect(report.blockers).toContain('M20T_NETWORK_NOT_TESTNET');
    expect(report.blockers).toContain('M20T_RPC_ENDPOINT_NOT_TESTNET');
    expect(report.blockers).toContain('M20T_MAINNET_NOT_DISABLED');
    expect(report.allowedToExecuteFullSizeM20T).toBe(false);
  });

  it('M20T-PREFLIGHT-04: blocks template placeholders and missing evidence final statement', () => {
    const report = createM20TExecutionPreflight({
      ...baseInput,
      env: {
        ...baseInput.env,
        deployerAddress: 'FILL_AFTER_GENERATION',
      },
      evidenceTemplateText: JSON.stringify({
        status: 'TEMPLATE_NOT_EXECUTED',
        requiredFinalStatement: 'wrong',
      }),
    });

    expect(report.status).toBe('BLOCKED_BY_PREFLIGHT');
    expect(report.blockers).toContain('M20T_DEPLOYER_ADDRESS_NOT_SET');
    expect(report.blockers).toContain('M20T_DEPLOYER_ADDRESS_SHAPE_INVALID');
    expect(report.blockers).toContain('M20T_EVIDENCE_FINAL_STATEMENT_MISSING');
  });
});
