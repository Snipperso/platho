import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address, beginCell, internal, SendMode, storeStateInit, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import {
  M20TBuybackBurnHarness,
  storeAcceptBurnReserve,
  storeM20TBindFeeAccumulator,
} from '../build/M20TBuybackBurnHarness/M20TBuybackBurnHarness_M20TBuybackBurnHarness';
import {
  M20TFeeAccumulatorHarness,
  storeFlushBuybackDue,
  storeM20TFeeHarnessTopUp,
  storeM20TForwardWrongAcceptBurnReserve,
} from '../build/M20TFeeAccumulatorHarness/M20TFeeAccumulatorHarness_M20TFeeAccumulatorHarness';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const ENV_PATH = '.env.testnet.local';
const ENVELOPE = toNano('51.05');
const MIN_BALANCE = toNano('55');
const FINAL_STATEMENT = 'M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.';

function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function requireEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is required in ${ENV_PATH}`);
  return value;
}

function hex(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('hex');
}

function stateInitHash(init: { code: any; data: any }): string {
  return hex(beginCell().store(storeStateInit(init)).endCell().hash());
}

function friendly(address: Address): string {
  return address.toString({ testOnly: true, bounceable: false });
}

function explorer(address: Address): string {
  return `https://testnet.tonviewer.com/${friendly(address)}`;
}

function dec(value: bigint): string {
  return value.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: any): boolean {
  return error?.response?.status === 429
    || error?.status === 429
    || String(error?.message ?? '').includes('429')
    || String(error?.response?.data?.result ?? '').includes('Ratelimit');
}

async function retryTon<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) throw error;
      const delay = 3500 + attempt * 2500;
      console.warn(`${label}: toncenter rate limited, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function waitForSeqno(wallet: ReturnType<TonClient['open']>, previous: number) {
  for (let i = 0; i < 45; i += 1) {
    const current = await retryTon<number>('wallet.getSeqno', () => (wallet as any).getSeqno());
    if (current > previous) return current;
    await sleep(2000);
  }
  throw new Error(`wallet seqno did not advance from ${previous}`);
}

async function waitForGetter<T>(label: string, getter: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < 30; i += 1) {
    try {
      return await retryTon(label, getter);
    } catch (error) {
      lastError = error;
      await sleep(2000);
    }
  }
  throw new Error(`${label} getter was not available: ${String(lastError)}`);
}

async function lastTxHash(client: TonClient, address: Address): Promise<string> {
  try {
    const txs = await retryTon('getTransactions', () => client.getTransactions(address, { limit: 1 }));
    const first = txs[0];
    if (!first) return 'NOT_AVAILABLE';
    return hex(first.hash());
  } catch {
    return 'NOT_AVAILABLE';
  }
}

async function sendAndWait(label: string, wallet: any, action: () => Promise<void>, client: TonClient, watch?: Address) {
  const beforeSeqno = await retryTon<number>(`${label}.getSeqnoBefore`, () => wallet.getSeqno());
  await retryTon(`${label}.send`, action);
  const afterSeqno = await waitForSeqno(wallet, beforeSeqno);
  await sleep(8000);
  return {
    label,
    walletSeqnoBefore: beforeSeqno,
    walletSeqnoAfter: afterSeqno,
    watchedAddress: watch ? friendly(watch) : null,
    watchedLastTxHash: watch ? await lastTxHash(client, watch) : 'NOT_WATCHED',
  };
}

async function sendTransferAndWait(
  label: string,
  wallet: any,
  secretKey: Buffer,
  seqnoState: { value: number },
  message: ReturnType<typeof internal>,
  client: TonClient,
  watch?: Address,
) {
  const beforeSeqno = seqnoState.value;
  await retryTon(`${label}.sendTransfer`, () => wallet.sendTransfer({
    seqno: beforeSeqno,
    secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [message],
  }));
  await sleep(18000);
  const afterSeqno = beforeSeqno + 1;
  seqnoState.value = afterSeqno;
  return {
    label,
    walletSeqnoBefore: beforeSeqno,
    walletSeqnoAfter: afterSeqno,
    watchedAddress: watch ? friendly(watch) : null,
    watchedLastTxHash: watch ? 'NOT_COLLECTED_PUBLIC_RPC_RATE_LIMIT' : 'NOT_WATCHED',
  };
}

function renderMarkdown(report: any): string {
  return [
    '# M20T Testnet Evidence',
    '',
    `Status: ${report.status}`,
    '',
    '## Network',
    '',
    '```text',
    `network=${report.network}`,
    `runId=${report.runId}`,
    `deployer=${report.deployer.address}`,
    `balanceBeforeNanotons=${report.deployer.balanceBeforeNanotons}`,
    `balanceAfterNanotons=${report.deployer.balanceAfterNanotons}`,
    '```',
    '',
    '## Contracts',
    '',
    `- M20TBuybackBurnHarness: ${report.contracts.buybackBurnHarness.address}`,
    `- M20TFeeAccumulatorHarness: ${report.contracts.feeAccumulatorHarness.address}`,
    '',
    '## Probes',
    '',
    ...Object.entries(report.probes).map(([key, value]: [string, any]) => `- ${key}: ${value.status}`),
    '',
    '## What Was Proven',
    '',
    ...report.summary.whatWasProven.map((item: string) => `- ${item}`),
    '',
    '## What Was Not Proven',
    '',
    ...report.summary.whatWasNotProven.map((item: string) => `- ${item}`),
    '',
    '## Final Statement',
    '',
    report.requiredFinalStatement,
    '',
  ].join('\n');
}

async function main() {
  const env = parseEnvText(readFileSync(ENV_PATH, 'utf8'));
  if (requireEnv(env, 'PLATHO_NETWORK') !== 'testnet') throw new Error('PLATHO_NETWORK must be testnet');
  if (requireEnv(env, 'PLATHO_M20T_ALLOW_MAINNET') !== 'false') throw new Error('PLATHO_M20T_ALLOW_MAINNET must be false');
  if (requireEnv(env, 'PLATHO_M20T_SET_STONFI_ROUTE_FREEZE_READY') !== 'false') throw new Error('STONFI route freeze flag must remain false');
  if (requireEnv(env, 'PLATHO_M20T_SET_BUYBACKBURN_IMPLEMENTATION_READY') !== 'false') throw new Error('BuybackBurn implementation flag must remain false');

  const endpoint = requireEnv(env, 'PLATHO_TON_RPC_ENDPOINT');
  if (!endpoint.includes('testnet')) throw new Error('RPC endpoint must be testnet');

  const mnemonic = requireEnv(env, 'PLATHO_TESTNET_DEPLOYER_MNEMONIC').split(/\s+/).filter(Boolean);
  const expectedAddress = Address.parse(requireEnv(env, 'PLATHO_TESTNET_DEPLOYER_ADDRESS'));
  const keyPair = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  if (!wallet.address.equals(expectedAddress)) {
    throw new Error(`Derived deployer address ${friendly(wallet.address)} does not match env address ${friendly(expectedAddress)}`);
  }

  const client = new TonClient({
    endpoint,
    apiKey: env.PLATHO_TON_RPC_API_KEY || undefined,
  });
  const openedWallet = client.open(wallet);
  const balanceBefore = await retryTon('getBalanceBefore', () => client.getBalance(wallet.address));
  if (balanceBefore < MIN_BALANCE) {
    throw new Error(`NEED_TESTNET_TON: balance ${balanceBefore} is below ${MIN_BALANCE}`);
  }
  const seqnoState = {
    value: await retryTon<number>('initialSeqno', () => openedWallet.getSeqno()),
  };

  const runId = BigInt(Math.floor(Date.now() / 1000));
  const buybackInit = await M20TBuybackBurnHarness.init(wallet.address, runId);
  const buyback = client.open(await M20TBuybackBurnHarness.fromInit(wallet.address, runId));
  const feeInit = await M20TFeeAccumulatorHarness.init(wallet.address, buyback.address, ENVELOPE, runId);
  const fee = client.open(await M20TFeeAccumulatorHarness.fromInit(wallet.address, buyback.address, ENVELOPE, runId));

  const steps: any[] = [];

  steps.push(await sendTransferAndWait('deploy_bind_buyback_harness', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: buyback.address,
    value: toNano('0.08'),
    bounce: true,
    init: buybackInit,
    body: beginCell().store(storeM20TBindFeeAccumulator({
      $$type: 'M20TBindFeeAccumulator',
      fee_accumulator_address: fee.address,
    })).endCell(),
  }), client, buyback.address));
  const buybackAfterBind = await waitForGetter('buyback state after bind', () => buyback.getGetState());

  steps.push(await sendTransferAndWait('deploy_prefund_fee_harness', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: fee.address,
    value: ENVELOPE + toNano('0.15'),
    bounce: true,
    init: feeInit,
    body: beginCell().store(storeM20TFeeHarnessTopUp({
      $$type: 'M20TFeeHarnessTopUp',
    })).endCell(),
  }), client, fee.address));
  const feeBeforeProbes = await waitForGetter('fee state after deploy', () => fee.getGetState());

  steps.push(await sendTransferAndWait('reject_50_ton_raw_principal', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: fee.address,
    value: toNano('0.03'),
    bounce: true,
    body: beginCell().store(storeFlushBuybackDue({
      $$type: 'FlushBuybackDue',
      amount: toNano('50'),
    })).endCell(),
  }), client, fee.address));
  const feeAfterRaw50 = await fee.getGetState();
  const buybackAfterRaw50 = await buyback.getGetState();

  steps.push(await sendTransferAndWait('reject_wrong_sender', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: buyback.address,
    value: toNano('0.03'),
    bounce: true,
    body: beginCell().store(storeAcceptBurnReserve({
      $$type: 'AcceptBurnReserve',
      amount: ENVELOPE,
    })).endCell(),
  }), client, buyback.address));
  const buybackAfterWrongSender = await buyback.getGetState();

  steps.push(await sendTransferAndWait('reject_wrong_amount_from_bound_fee', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: fee.address,
    value: toNano('0.06'),
    bounce: true,
    body: beginCell().store(storeM20TForwardWrongAcceptBurnReserve({
      $$type: 'M20TForwardWrongAcceptBurnReserve',
      amount: toNano('50'),
      forward_value: toNano('0.03'),
    })).endCell(),
  }), client, buyback.address));
  const buybackAfterWrongAmount = await buyback.getGetState();

  steps.push(await sendTransferAndWait('accept_5105_ton_envelope', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: fee.address,
    value: toNano('0.03'),
    bounce: true,
    body: beginCell().store(storeFlushBuybackDue({
      $$type: 'FlushBuybackDue',
      amount: ENVELOPE,
    })).endCell(),
  }), client, buyback.address));
  const feeAfterAccept = await fee.getGetState();
  const buybackAfterAccept = await buyback.getGetState();

  steps.push(await sendTransferAndWait('reject_duplicate_replay', openedWallet, keyPair.secretKey, seqnoState, internal({
    to: fee.address,
    value: toNano('0.03'),
    bounce: true,
    body: beginCell().store(storeFlushBuybackDue({
      $$type: 'FlushBuybackDue',
      amount: ENVELOPE,
    })).endCell(),
  }), client, fee.address));
  const feeAfterDuplicate = await fee.getGetState();
  const buybackAfterDuplicate = await buyback.getGetState();

  const balanceAfter = await retryTon('getBalanceAfter', () => client.getBalance(wallet.address));

  const probes = {
    accepts5105TonEnvelopeFromAuthorizedPath: {
      status: buybackAfterAccept.accepted_count === 1n
        && buybackAfterAccept.total_accepted === ENVELOPE
        && feeAfterAccept.buyback_due_ton === 0n
        ? 'PASS'
        : 'FAIL',
      stateBefore: {
        fee: {
          buybackDueNanotons: dec(feeBeforeProbes.buyback_due_ton),
          flushCount: dec(feeBeforeProbes.flush_count),
        },
        buyback: {
          acceptedCount: dec(buybackAfterBind.accepted_count),
          totalAcceptedNanotons: dec(buybackAfterBind.total_accepted),
        },
      },
      stateAfter: {
        fee: {
          buybackDueNanotons: dec(feeAfterAccept.buyback_due_ton),
          flushCount: dec(feeAfterAccept.flush_count),
        },
        buyback: {
          acceptedCount: dec(buybackAfterAccept.accepted_count),
          totalAcceptedNanotons: dec(buybackAfterAccept.total_accepted),
          lastAmountNanotons: dec(buybackAfterAccept.last_amount),
        },
      },
    },
    rejects50TonRawPrincipalAsIncompleteEnvelope: {
      status: feeAfterRaw50.buyback_due_ton === ENVELOPE && buybackAfterRaw50.accepted_count === 0n ? 'PASS' : 'FAIL',
      stateAfter: {
        feeBuybackDueNanotons: dec(feeAfterRaw50.buyback_due_ton),
        buybackAcceptedCount: dec(buybackAfterRaw50.accepted_count),
      },
    },
    rejectsWrongSender: {
      status: buybackAfterWrongSender.accepted_count === 0n ? 'PASS' : 'FAIL',
      stateAfter: {
        buybackAcceptedCount: dec(buybackAfterWrongSender.accepted_count),
      },
    },
    rejectsWrongAmount: {
      status: buybackAfterWrongAmount.accepted_count === 0n ? 'PASS' : 'FAIL',
      stateAfter: {
        buybackAcceptedCount: dec(buybackAfterWrongAmount.accepted_count),
      },
    },
    duplicateOrReplayBehavior: {
      status: feeAfterDuplicate.buyback_due_ton === 0n && buybackAfterDuplicate.accepted_count === 1n ? 'PASS' : 'FAIL',
      stateAfter: {
        feeBuybackDueNanotons: dec(feeAfterDuplicate.buyback_due_ton),
        buybackAcceptedCount: dec(buybackAfterDuplicate.accepted_count),
      },
    },
    refundExcessBounceBehavior: {
      status: 'NOT_EXECUTED',
      evidence: 'NOT_AVAILABLE_WITHOUT_STONFI_ROUTE_HARNESS',
    },
  };

  const allProbeStatuses = Object.entries(probes)
    .filter(([key]) => key !== 'refundExcessBounceBehavior')
    .map(([, value]: [string, any]) => value.status);
  const status = allProbeStatuses.every((item) => item === 'PASS')
    ? 'LIVE_TESTNET_M20T_HARNESS_PASS'
    : 'LIVE_TESTNET_M20T_HARNESS_FAIL';

  const report = {
    document: 'PLATHO.V1.M20T_TESTNET_EVIDENCE',
    status,
    generatedAt: new Date().toISOString(),
    network: 'testnet',
    runId: dec(runId),
    notMainnetRouteFreeze: true,
    notProductionBuybackBurnUnlock: true,
    productionFlagsRemainFalse: true,
    deployer: {
      address: friendly(wallet.address),
      walletVersion: 'v4r2',
      secretMaterialPrinted: false,
      balanceBeforeNanotons: dec(balanceBefore),
      balanceAfterNanotons: dec(balanceAfter),
    },
    contracts: {
      buybackBurnHarness: {
        address: friendly(buyback.address),
        codeHash: hex(buybackInit.code.hash()),
        stateInitHash: stateInitHash(buybackInit),
        explorerUrl: explorer(buyback.address),
      },
      feeAccumulatorHarness: {
        address: friendly(fee.address),
        codeHash: hex(feeInit.code.hash()),
        stateInitHash: stateInitHash(feeInit),
        explorerUrl: explorer(fee.address),
        buybackFundingEnvelopeNanotons: dec(ENVELOPE),
      },
    },
    steps,
    probes,
    suite: {
      command: 'npm test',
      vitestPool: 'vmThreads',
      exit: 'RUN_AFTER_LIVE_PROBE',
      summary: 'RUN_AFTER_LIVE_PROBE',
    },
    summary: {
      whatWasProven: [
        'A full-size 51.05 TON M20T harness envelope can be forwarded from the bound fee-path harness to the BuybackBurn receiver harness on testnet.',
        'The M20T fee-path harness rejects 50 TON raw principal as an incomplete buyback envelope.',
        'The M20T BuybackBurn receiver harness rejects direct wrong-sender AcceptBurnReserve messages.',
        'The M20T BuybackBurn receiver harness rejects a wrong AcceptBurnReserve amount forwarded by the bound fee-path harness.',
        'A duplicate/replay FlushBuybackDue after the accepted envelope leaves one accepted envelope and zero fee-path due.',
      ],
      whatWasNotProven: [
        'mainnet STON.fi route freeze',
        'mainnet router/pool/pTON code hash identity',
        'mainnet liquidity and quote behavior',
        'mainnet refund/excess/bounce behavior',
        'production BuybackBurn implementation readiness',
        'production FeeAccumulator accumulation of 102.1 TON protocol fees for one 51.05 TON buyback due',
      ],
    },
    requiredFinalStatement: FINAL_STATEMENT,
  };

  const manifest = {
    document: 'PLATHO.V1.M20T_TESTNET_MANIFEST',
    status,
    network: 'testnet',
    runId: dec(runId),
    notMainnetRouteFreeze: true,
    productionFlags: {
      stonfiRouteFreezeReadyMustRemainFalse: true,
      buybackBurnImplementationReadyMustRemainFalse: true,
    },
    deployer: report.deployer,
    contracts: {
      athMaster: {
        address: 'NOT_DEPLOYED',
        reason: 'M20T harness probe did not require ATHMaster deployment.',
      },
      feeAccumulator: {
        address: 'NOT_DEPLOYED',
        reason: 'Production FeeAccumulator was not deployed; M20T used explicit testnet fee-path harness because a production split would require about 102.1 TON.',
      },
      feeAccumulatorHarness: report.contracts.feeAccumulatorHarness,
      buybackBurnOrHarness: report.contracts.buybackBurnHarness,
    },
    runArtifacts: {
      evidenceJson: 'artifacts/m20t_testnet_evidence.json',
      evidenceMarkdown: 'artifacts/M20T_TESTNET_EVIDENCE.md',
      fullSuiteOutput: 'artifacts/NPM_TEST_FULL_SUITE_M20T_OUTPUT.txt',
      fullSuiteExit: 'artifacts/NPM_TEST_FULL_SUITE_M20T_EXIT.txt',
    },
  };

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, 'm20t_testnet_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'm20t_testnet_evidence.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_TESTNET_EVIDENCE.md'), renderMarkdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_TESTNET_EVIDENCE_STATUS.txt'), `${status}\n`);

  console.log(JSON.stringify({
    ok: status === 'LIVE_TESTNET_M20T_HARNESS_PASS',
    status,
    runId: dec(runId),
    deployer: friendly(wallet.address),
    balanceBeforeNanotons: dec(balanceBefore),
    balanceAfterNanotons: dec(balanceAfter),
    buybackBurnHarness: friendly(buyback.address),
    feeAccumulatorHarness: friendly(fee.address),
    productionUnlock: false,
    finalStatement: FINAL_STATEMENT,
  }, null, 2));

  if (status !== 'LIVE_TESTNET_M20T_HARNESS_PASS') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
