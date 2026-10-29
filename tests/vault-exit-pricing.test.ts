import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FV_EXIT_FIXED_NEED, FV_EXIT_INBOUND, FV_EXIT_LEG_BITS, FV_EXIT_LEG_CELLS, FV_MSG_FORWARD_PRICES, FV_STAKE_FIXED_NEED,
  FV_STAKE_LEG_BITS, FV_STAKE_LEG_CELLS, forwardFeeNanotons, vaultExitInboundNanotons, vaultStakeAttachNanotons,
} from '../web/fee-vault.mjs';
import {
  ATH_TOP_UP_RECEIVE_GAS, ATH_TRANSFER_EXEC_RESERVE, ATH_TRANSFER_GAS, ATH_WALLET_TOP_UP_OPCODE, athTransferTopUpNanotons,
  athTransferTopUpPossible, gasFeeNanotons,
} from '../web/ath-request-reserve.mjs';
import {
  planEmergencyExit, planStake, planUnstake, priceVaultExit, priceVaultStake, VAULT_ABSENT, VAULT_LIVE,
} from '../web/vault-account.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { code, sourceBlock } from './helpers/source';


const TODAY = Object.freeze({
  gas: Object.freeze({ flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n }),
  fwd: Object.freeze({ lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n }),
});
const scaled = (kg: bigint, kf: bigint) => ({
  gas: { flatLimit: 100n, flatPrice: TODAY.gas.flatPrice * kg, gasPrice: TODAY.gas.gasPrice * kg },
  fwd: { lump: TODAY.fwd.lump * kf, bit: TODAY.fwd.bit * kf, cell: TODAY.fwd.cell * kf },
});
const VAULT = '0:' + 'a1'.repeat(32);
const OWNER = '0:' + 'b2'.repeat(32);
const ATHW = '0:' + 'c3'.repeat(32);
const CUSTODY = '0:' + 'd4'.repeat(32);
const LIVE = { state: VAULT_LIVE, staked: 5_000n * 10n ** 9n, pending: 0n, exitWindow: { open: false, exited: 0n, secondsLeft: 0 }, balance: 49_700_000n };
const opOf = (payload: string) => {
  const cell: any = parseBocBase64(payload);
  const bytes: Uint8Array = cell.bytes ?? cell.data;
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
};

describe('PRICES-1 — the client prices the vault\'s exits and stakes at the network\'s live prices', () => {
  it('PRICES1-C01: today\'s prices change nothing — the attaches are today\'s and no wallet balance can matter', () => {
    expect(vaultExitInboundNanotons(TODAY.fwd)).toBe(FV_EXIT_INBOUND);
    expect(vaultExitInboundNanotons(FV_MSG_FORWARD_PRICES), 'the default table is today\'s').toBe(FV_EXIT_INBOUND);
    expect(vaultStakeAttachNanotons(59_000_000n, 10_000_000n, TODAY.fwd)).toBe(59_000_000n);
    expect([athTransferTopUpPossible('custodyExit', TODAY), athTransferTopUpPossible('stake', TODAY)]).toEqual([false, false]);
    expect(athTransferTopUpNanotons({ lane: 'custodyExit', prices: TODAY, walletTon: 0n, rentOwed: 10n ** 9n })).toBe(0n);
    expect(athTransferTopUpNanotons({ lane: 'stake', prices: TODAY, walletTon: 0n, rentOwed: 10n ** 9n })).toBe(0n);
    expect(ATH_TRANSFER_EXEC_RESERVE).toBe(2_000_000n);
    expect(ATH_TRANSFER_GAS).toEqual({ custodyExit: 14_799n, stake: 15_319n });
  });

  it('PRICES1-C02: above them the figures move exactly as the measured model says', () => {
    const ten = scaled(1n, 10n);
    const leg10 = forwardFeeNanotons({ cells: FV_EXIT_LEG_CELLS, bits: FV_EXIT_LEG_BITS }, ten.fwd);
    expect(leg10).toBe(42_429_340n);
    expect(vaultExitInboundNanotons(ten.fwd)).toBe(FV_EXIT_FIXED_NEED + (leg10 * 125n + 99n) / 100n);
    expect(vaultExitInboundNanotons(scaled(1n, 8n).fwd), 'still today\'s at 8x').toBe(FV_EXIT_INBOUND);
    const two = scaled(1n, 2n);
    const stakeLeg2 = forwardFeeNanotons({ cells: FV_STAKE_LEG_CELLS, bits: FV_STAKE_LEG_BITS }, two.fwd);
    expect(forwardFeeNanotons({ cells: FV_STAKE_LEG_CELLS, bits: FV_STAKE_LEG_BITS }, TODAY.fwd)).toBe(4_244_534n);
    expect(vaultStakeAttachNanotons(59_000_000n, 10_000_000n, two.fwd))
      .toBe(FV_STAKE_FIXED_NEED + 10_000_000n + ((2n * stakeLeg2 + 1n) * 125n + 99n) / 100n);
    expect(vaultStakeAttachNanotons(59_000_000n, 10_000_000n, two.fwd) > 59_000_000n, 'at 2x the fixed attach no longer credits (PRICES1-05)').toBe(true);
    const three = scaled(3n, 1n);
    const need = (gasFeeNanotons(14_799n, three.gas) * 125n + 99n) / 100n;
    expect(athTransferTopUpNanotons({ lane: 'custodyExit', prices: three, walletTon: 0n }))
      .toBe(need - 2_000_000n + gasFeeNanotons(ATH_TOP_UP_RECEIVE_GAS, three.gas));
    expect(athTransferTopUpNanotons({ lane: 'custodyExit', prices: three, walletTon: 1_000_000n, rentOwed: 1_000_000n }))
      .toBe(athTransferTopUpNanotons({ lane: 'custodyExit', prices: three, walletTon: 0n }));
    expect(athTransferTopUpNanotons({ lane: 'custodyExit', prices: three, walletTon: need })).toBe(0n);
    expect(() => athTransferTopUpNanotons({ lane: 'nope', prices: three })).toThrow(RangeError);
  });

  it('PRICES1-C03: the plans say what to re-price, and pricing re-prices exactly that — the top-up rides first, non-bounceable', () => {
    const unstake = planUnstake({ vaultAddress: VAULT, ath: 1000n, snapshot: LIVE });
    expect(unstake.exit).toEqual({ door: 'unstake', vaultAddress: VAULT, atoms: 1000n * 10n ** 9n });
    const hatch = planEmergencyExit({ vaultAddress: VAULT, atoms: 7n, snapshot: LIVE });
    expect(hatch.exit).toEqual({ door: 'hatch', vaultAddress: VAULT, atoms: 7n });
    expect(priceVaultExit(unstake, { prices: TODAY }).messages).toEqual(unstake.messages);
    expect(priceVaultExit(hatch, { prices: TODAY }).messages).toEqual(hatch.messages);
    const six = scaled(6n, 1n);
    const priced = priceVaultExit(unstake, { prices: six, custodyWallet: CUSTODY, custodyTon: 0n });
    expect(priced.messages).toHaveLength(2);
    expect(priced.messages[0]).toMatchObject({ address: CUSTODY, amount: priced.custodyTopUp, bounce: false });
    expect(opOf(priced.messages[0].payload)).toBe(ATH_WALLET_TOP_UP_OPCODE);
    expect(priced.messages[1]).toEqual(unstake.messages[0]);
    expect(() => priceVaultExit(unstake, { prices: six })).toThrow(/custody wallet was not read/);
    const refused = planUnstake({ vaultAddress: VAULT, ath: 0n, snapshot: LIVE });
    expect(priceVaultExit(refused, { prices: six })).toBe(refused);
  });

  it('PRICES1-C04: a stake is re-priced in place — the ATH message\'s attach, and the owner wallet\'s top-up ahead of it', () => {
    const plan = planStake({ ownerWallet: OWNER, vaultAddress: VAULT, athWalletAddress: ATHW, ath: '100',
      snapshot: { ...LIVE, state: VAULT_LIVE }, queryId: 5n });
    expect(plan.ok).toBe(true);
    expect(plan.transfer).toMatchObject({ type: 'JettonTransfer', athWalletAddress: ATHW, index: 0, attach: 59_000_000n });
    expect(priceVaultStake(plan, { prices: TODAY }).messages).toEqual(plan.messages);
    const hot = scaled(6n, 3n);
    const priced = priceVaultStake(plan, { prices: hot, athWalletTon: 0n });
    expect(priced.messages).toHaveLength(plan.messages.length + 1);
    expect(priced.messages[0]).toMatchObject({ address: ATHW, amount: priced.ownerTopUp, bounce: false });
    expect(opOf(priced.messages[0].payload)).toBe(ATH_WALLET_TOP_UP_OPCODE);
    expect(BigInt(priced.messages[1].amount)).toBe(vaultStakeAttachNanotons(59_000_000n, 10_000_000n, hot.fwd));
    expect(priced.messages[1].payload, 'the same transfer, only the attach moved').toBe(plan.messages[0].payload);
    const first = planStake({ ownerWallet: OWNER, vaultAddress: VAULT, athWalletAddress: ATHW, ath: '100',
      snapshot: { state: VAULT_ABSENT, staked: 0n, pending: 0n }, queryId: 6n });
    expect(first.transfer.index).toBe(1);
    const firstPriced = priceVaultStake(first, { prices: hot, athWalletTon: 0n });
    expect(firstPriced.messages[1]).toEqual(first.messages[0]);
  });

  it('PRICES1-C05: the app prices every exit and every stake right before it sums and signs, and says so when it cannot', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const unstake = code(sourceBlock(app, 'async function submitUnstakeAth('));
    expect(unstake).toContain('const plan = await priceVaultExitForSend(unpriced, feeVaultState.address);');
    expect(unstake.indexOf('priceVaultExitForSend(')).toBeLessThan(unstake.indexOf('broadcastOwnVaultExit('));
    expect(unstake).toContain("await broadcastOwnVaultExit(plan.messages, unpriced.remainingFeeDue, 'withdraw stake', { signer: requireSameWallet(signer) });");
    const recover = code(sourceBlock(app, 'async function submitRecoverAth('));
    expect(recover).toContain('const priced = await priceVaultExitForSend(plan, vaultAddress);');
    expect(recover.indexOf('priceVaultExitForSend(')).toBeLessThan(recover.indexOf('broadcastOwnVaultExit('));
    const broadcast = code(sourceBlock(app, 'async function broadcastOwnVaultExit('));
    expect(broadcast.indexOf('assertWalletGramAtLeast(need + walletSendFeeReserveNanotons(), purpose);'), 'asked before it is signed')
      .toBeLessThan(broadcast.indexOf('sendPlathoWalletTransaction('));
    expect(broadcast).toContain('const need = messages.reduce((sum, message) => sum + BigInt(message.amount), 0n);');
    expect(recover).toContain("await broadcastOwnVaultExit(priced.messages, FV_PROTOCOL_FEE, 'recover ATH', { signer: requireSameWallet(signer) });");
    const stake = code(sourceBlock(app, 'async function submitStakeAth('));
    expect(stake).toContain('plan = await priceVaultStakeForSend(plan);');
    expect(stake.indexOf('priceVaultStakeForSend(')).toBeLessThan(stake.indexOf('assertWalletGramAtLeast('));
    for (const body of [unstake, recover, stake]) expect(body).toContain('vaultSendErrorSaysWhatToDo(error)');
    expect(code(sourceBlock(app, 'function vaultSendErrorSaysWhatToDo('))).toContain("error?.code === 'ATH_REQUEST_UNPRICED'");
  });

  it('PRICES1-C06: the app\'s helpers (lifted) read custody only when its balance can matter, and refuse before signing when a read fails', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const lift = (env: Record<string, any>) => {
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      return new Function(...names, `${sourceBlock(app, 'async function priceVaultExitForSend(')}\n${sourceBlock(app, 'async function priceVaultStakeForSend(')}\n${sourceBlock(app, 'function athUnpricedRefusal(')}\nreturn { priceVaultExitForSend, priceVaultStakeForSend };`)(...names.map((n) => env[n]));
    };
    const calls: string[] = [];
    const env = (prices: any, funding: any = { ton: 0n, rentOwed: 0n }) => ({
      readNetworkPrices: async () => { calls.push('prices'); if (prices instanceof Error) throw prices; return prices; },
      resolveVaultCustodyWallet: async () => { calls.push('custody'); return CUSTODY; },
      readAthWalletFunding: async (address: string) => { calls.push(`funding:${address}`); if (funding instanceof Error) throw funding; return funding; },
      withVaultReadLock: (fn: () => any) => fn(), CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8_000,
      athTransferTopUpPossible, priceVaultExit, priceVaultStake,
      noteTonRpcRateLimit: () => true,
      t: (key: string) => `<${key}>`,
    });
    const unstake = planUnstake({ vaultAddress: VAULT, ath: 1000n, snapshot: LIVE });
    let helpers = lift(env(TODAY));
    const today = await helpers.priceVaultExitForSend(unstake, VAULT);
    expect(calls).toEqual(['prices']);
    expect(today.messages).toEqual(unstake.messages);
    calls.length = 0;
    helpers = lift(env(scaled(6n, 1n)));
    const hot = await helpers.priceVaultExitForSend(unstake, VAULT);
    expect(calls).toEqual(['prices', 'custody', `funding:${CUSTODY}`]);
    expect(hot.messages[0]).toMatchObject({ address: CUSTODY, bounce: false });
    calls.length = 0;
    const stakePlan = planStake({ ownerWallet: OWNER, vaultAddress: VAULT, athWalletAddress: ATHW, ath: '100', snapshot: LIVE, queryId: 1n });
    const stakeHot = await helpers.priceVaultStakeForSend(stakePlan);
    expect(calls).toEqual(['prices', `funding:${ATHW}`]);
    expect(stakeHot.messages[0]).toMatchObject({ address: ATHW, bounce: false });
    for (const broken of [lift(env(new Error('429'))), lift(env(scaled(6n, 1n), new Error('timeout')))]) {
      const refusal = await broken.priceVaultExitForSend(unstake, VAULT).then(() => null, (e: any) => e);
      expect(refusal?.code).toBe('ATH_REQUEST_UNPRICED');
      expect(refusal?.message).toBe('<wallet.balanceUnreadNothingSent>');
    }
    const stakeRefusal = await lift(env(new Error('429'))).priceVaultStakeForSend(stakePlan).then(() => null, (e: any) => e);
    expect(stakeRefusal?.code).toBe('ATH_REQUEST_UNPRICED');
  });
});
