import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import { createScaledBuybackBurnHarnessM20T } from './m20t_scaled_buybackburn_harness';
import { createBuybackBurnImplementationReadinessM20U } from './buybackburn_contract_readiness_m20u';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

export type M20TFundingReadinessStatus =
  | 'NEED_TESTNET_TON'
  | 'READY_FOR_SCALED_HARNESS_ONLY'
  | 'READY_FOR_FULL_SIZE_M20T';

export interface M20TLocalEnvPublic {
  network: string;
  rpcEndpoint: string;
  deployerAddress: string;
  deployerWalletVersion: string;
  minBalanceNanotons: string;
  allowMainnet: string;
  setStonfiRouteFreezeReady: string;
  setBuybackBurnImplementationReady: string;
}

export interface M20TFundingReadinessInput {
  observedBalanceNanotons: bigint;
  env: M20TLocalEnvPublic;
}

function dec(value: bigint): string {
  return value.toString();
}

export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function readPublicM20TEnv(envPath = '.env.testnet.local'): M20TLocalEnvPublic {
  const env = parseEnvText(readFileSync(envPath, 'utf8'));
  return {
    network: env.PLATHO_NETWORK ?? '',
    rpcEndpoint: env.PLATHO_TON_RPC_ENDPOINT ?? '',
    deployerAddress: env.PLATHO_TESTNET_DEPLOYER_ADDRESS ?? '',
    deployerWalletVersion: env.PLATHO_TESTNET_DEPLOYER_WALLET_VERSION ?? '',
    minBalanceNanotons: env.PLATHO_TESTNET_MIN_BALANCE_NANOTONS ?? '',
    allowMainnet: env.PLATHO_M20T_ALLOW_MAINNET ?? '',
    setStonfiRouteFreezeReady: env.PLATHO_M20T_SET_STONFI_ROUTE_FREEZE_READY ?? '',
    setBuybackBurnImplementationReady: env.PLATHO_M20T_SET_BUYBACKBURN_IMPLEMENTATION_READY ?? '',
  };
}

export function createM20TFundingReadiness(input: M20TFundingReadinessInput) {
  const scaled = createScaledBuybackBurnHarnessM20T();
  const implementationGate = createBuybackBurnImplementationReadinessM20U();
  const scaledMin = BigInt(scaled.nextLiveStep.minimumUsefulTopUpNanotons);
  const fullMin = toNano('55');
  const balance = input.observedBalanceNanotons;

  const guardrails = {
    networkIsTestnet: input.env.network === 'testnet',
    rpcEndpointIsTestnet: input.env.rpcEndpoint.includes('testnet'),
    mainnetDisabled: input.env.allowMainnet === 'false',
    stonfiRouteFreezeFlagRemainsFalse: input.env.setStonfiRouteFreezeReady === 'false',
    buybackBurnImplementationFlagRemainsFalse: input.env.setBuybackBurnImplementationReady === 'false',
    hasPublicDeployerAddress: input.env.deployerAddress.length > 0,
    minBalanceMatchesFullSizeM20T: input.env.minBalanceNanotons === fullMin.toString(),
    implementationGateStillBlocked: implementationGate.productionBuybackBurnImplementationReady === false,
  };

  let status: M20TFundingReadinessStatus = 'NEED_TESTNET_TON';
  if (balance >= fullMin) {
    status = 'READY_FOR_FULL_SIZE_M20T';
  } else if (balance >= scaledMin) {
    status = 'READY_FOR_SCALED_HARNESS_ONLY';
  }

  return {
    document: 'PLATHO.V1.M20T_TESTNET_FUNDING_READINESS',
    status,
    generatedAt: new Date().toISOString(),
    network: input.env.network,
    deployer: {
      address: input.env.deployerAddress,
      walletVersion: input.env.deployerWalletVersion,
      secretMaterialPrinted: false,
    },
    funding: {
      observedBalanceNanotons: dec(balance),
      scaledHarnessMinimumNanotons: dec(scaledMin),
      fullSizeM20TMinimumNanotons: dec(fullMin),
      remainingForScaledHarnessNanotons: dec(balance >= scaledMin ? 0n : scaledMin - balance),
      remainingForFullSizeM20TNanotons: dec(balance >= fullMin ? 0n : fullMin - balance),
    },
    scaledHarness: {
      status: scaled.status,
      scaledTotalFundingEnvelopeNanotons: scaled.values.scaledTotalFundingEnvelopeNanotons,
      productionUnlock: false,
      finalStatement: 'M20T scaled harness evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.',
    },
    fullSizeM20T: {
      productionEnvelopeNanotons: scaled.values.productionTotalFundingEnvelopeNanotons,
      minimumBalanceIncludesReserveNanotons: dec(fullMin),
      allowedNow: status === 'READY_FOR_FULL_SIZE_M20T',
    },
    productionReadiness: {
      productionBuybackBurnImplementationReady: implementationGate.productionBuybackBurnImplementationReady,
      canImplementProductionContractNow: implementationGate.canImplementProductionContractNow,
      blockedBy: implementationGate.blockedBy,
    },
    guardrails,
    allGuardrailsPass: Object.values(guardrails).every(Boolean),
    nextAction:
      status === 'READY_FOR_FULL_SIZE_M20T'
        ? 'Run full-size M20T testnet probe; production BuybackBurn remains locked until M20F mainnet route freeze too.'
        : status === 'READY_FOR_SCALED_HARNESS_ONLY'
          ? 'Run scaled M20T harness only, or keep accumulating testnet TON for full-size M20T.'
          : 'Top up the disposable testnet wallet and rerun funding readiness.',
  };
}

function renderMarkdown(report: ReturnType<typeof createM20TFundingReadiness>): string {
  return [
    '# M20T Testnet Funding Readiness',
    '',
    `Status: ${report.status}`,
    '',
    '## Wallet',
    '',
    '```text',
    `address=${report.deployer.address}`,
    `walletVersion=${report.deployer.walletVersion}`,
    `secretMaterialPrinted=${report.deployer.secretMaterialPrinted}`,
    '```',
    '',
    '## Funding',
    '',
    '```text',
    `observedBalanceNanotons=${report.funding.observedBalanceNanotons}`,
    `scaledHarnessMinimumNanotons=${report.funding.scaledHarnessMinimumNanotons}`,
    `fullSizeM20TMinimumNanotons=${report.funding.fullSizeM20TMinimumNanotons}`,
    `remainingForScaledHarnessNanotons=${report.funding.remainingForScaledHarnessNanotons}`,
    `remainingForFullSizeM20TNanotons=${report.funding.remainingForFullSizeM20TNanotons}`,
    '```',
    '',
    '## Guardrails',
    '',
    ...Object.entries(report.guardrails).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Next Action',
    '',
    report.nextAction,
    '',
    '## Final Statement',
    '',
    'M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.',
    '',
  ].join('\n');
}

function parseObservedBalanceArg(argv: string[]): bigint {
  const idx = argv.indexOf('--observed-balance-nanotons');
  if (idx >= 0 && argv[idx + 1]) {
    return BigInt(argv[idx + 1]);
  }
  throw new Error('Missing --observed-balance-nanotons <decimal nanotons>');
}

function main() {
  const observedBalanceNanotons = parseObservedBalanceArg(process.argv.slice(2));
  const env = readPublicM20TEnv();
  const report = createM20TFundingReadiness({ observedBalanceNanotons, env });
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, 'm20t_testnet_funding_readiness.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_TESTNET_FUNDING_READINESS.md'), renderMarkdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_TESTNET_FUNDING_STATUS.txt'), `${report.status}\n`);
  console.log(JSON.stringify({
    ok: report.allGuardrailsPass,
    status: report.status,
    address: report.deployer.address,
    observedBalanceNanotons: report.funding.observedBalanceNanotons,
    remainingForFullSizeM20TNanotons: report.funding.remainingForFullSizeM20TNanotons,
    productionUnlock: false,
  }, null, 2));
  if (!report.allGuardrailsPass) {
    process.exit(1);
  }
}

if (require.main === module) main();
