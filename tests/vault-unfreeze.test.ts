import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import {
  ACCOUNT_ACTIVE, ACCOUNT_FROZEN, ACCOUNT_NONEXIST, ACCOUNT_UNINIT, ACCOUNT_UNKNOWN, FROZEN_ACCOUNT_STORAGE, UNFREEZE_LANDING_SECONDS,
  accountStateRow, accountStatusOf, buildUnfreezeMessage, cellToBoc, freezingTransaction, frozenAccountDebtNanotons, hashHex,
  matchFrozenState, preFreezeStateFromArchive, stateInitCellFromBocs, stateInitHashHex,
} from '../web/frozen-account.mjs';
import {
  planEmergencyExit, planRecovery, planStake, planUnstake, planUnstakeUnjam, planVaultRestore, planWithdrawFloat, frozenRefusal,
  vaultSnapshot, VAULT_ABSENT, VAULT_FROZEN, VAULT_LIVE, VAULT_UNKNOWN, FV_CUSTODY_TOPUP,
} from '../web/vault-account.mjs';
import { FV_DEPLOY_FUNDING, feeVaultInitializedDataCell } from '../web/fee-vault.mjs';
import { ATH_WALLET_TOP_UP_OPCODE } from '../web/ath-request-reserve.mjs';
import { createAccountHistoryReader, createAccountStateAtReader } from '../web/shard-rpc.mjs';
import { STORAGE_PRICE, storageFeeNanotons } from '../web/shard-debt.mjs';
import { beginCell, parseBocBase64, tonCell } from '../web/pwa-contract-transactions.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
const en = (I18N_STRINGS as any).en;
const t = (key: string, params: Record<string, string> = {}) => String(en[key] ?? key).replace(/\{(\w+)\}/g, (_m, k) => params[k] ?? `{${k}}`);
const OWNER = `0:${'0b'.repeat(32)}`;
const VAULT = `0:${'0c'.repeat(32)}`;
const CUSTODY = `0:${'0d'.repeat(32)}`;
const cellsOf = (tag: number) => {
  const codeCell = beginCell(); codeCell.uint(0xc0de, 16, 'code'); codeCell.uint(tag, 8, 'tag');
  const dataCell = beginCell(); dataCell.uint(0xda7a, 16, 'data'); dataCell.uint(tag, 8, 'tag');
  return { codeBoc: cellToBoc(codeCell.endCell()), dataBoc: cellToBoc(dataCell.endCell()) };
};
const b64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64');

describe('a frozen account, in the module that revives it', () => {
  it('UNFREEZE-MOD-01: statuses and hashes in every spelling the doors print are folded to one', async () => {
    expect(['active', 'frozen', 'uninit', 'uninitialized', 'nonexist', 'Frozen', 'what'].map(accountStatusOf))
      .toEqual([ACCOUNT_ACTIVE, ACCOUNT_FROZEN, ACCOUNT_UNINIT, ACCOUNT_UNINIT, ACCOUNT_NONEXIST, ACCOUNT_FROZEN, ACCOUNT_UNKNOWN]);
    const hex = 'ab'.repeat(32);
    expect(hashHex(b64(hex)), 'base64, as both toncenter doors print it').toBe(hex);
    expect(hashHex(b64(hex).replace(/\+/g, '-').replace(/\//g, '_')), 'base64url').toBe(hex);
    expect(hashHex(`0x${hex.toUpperCase()}`)).toBe(hex);
    expect(hashHex(BigInt(`0x${hex}`)), 'the sandbox\'s bigint').toBe(hex);
    expect(hashHex(b64('ab'.repeat(31))), 'not 32 bytes: no hash').toBeNull();
    expect(hashHex(null)).toBeNull();
    expect(accountStateRow({ status: 'frozen', frozen_hash: b64(hex), balance: '5', last_transaction_lt: '9' }))
      .toEqual({ status: ACCOUNT_FROZEN, frozenHash: hex, balance: 5n, code: null, data: null, lastLt: '9' });
    expect(accountStateRow({ ok: true, result: { state: 'uninitialized', balance: '0', code: '', data: '', last_transaction_id: { lt: '0' } } }).status)
      .toBe(ACCOUNT_UNINIT);
  });

  it('UNFREEZE-MOD-02: the freezing transaction is the NEWEST that went in active and came out frozen — pokes after it are passed over', () => {
    const rows = [
      { lt: '5', orig_status: 'frozen', end_status: 'frozen' },
      { lt: '4', orig_status: 'active', end_status: 'frozen', mc_block_seqno: 40 },
      { lt: '3', orig_status: 'active', end_status: 'active' },
      { lt: '2', orig_status: 'active', end_status: 'frozen', mc_block_seqno: 20 },
    ];
    expect(freezingTransaction(rows)?.lt).toBe('4');
    expect(freezingTransaction(rows.slice(0, 1))).toBeNull();
    expect(freezingTransaction(null as any)).toBeNull();
  });

  it('UNFREEZE-MOD-03: the archive search — paged past later pokes, the state one block before, and nothing found unless it hashes to the frozen hash', async () => {
    const real = cellsOf(1);
    const other = cellsOf(2);
    const frozenHash = await stateInitHashHex(real.codeBoc, real.dataBoc);
    const pokes = Array.from({ length: 64 }, (_, i) => ({ lt: String(1000 - i), orig_status: 'frozen', end_status: 'frozen', mc_block_seqno: 900 }));
    const pages: any[] = [];
    const listTransactions = async (address: string, page: any) => {
      pages.push(page);
      return page.offset === 0 ? pokes : [{ lt: '10', orig_status: 'active', end_status: 'frozen', mc_block_seqno: 500,
        account_state_after: { frozen_hash: b64(frozenHash) } }, { lt: '9', orig_status: 'active', end_status: 'active' }];
    };
    const asked: any[] = [];
    const stateAt = (cells: any, status = 'active') => async (address: string, seqno: number) => {
      asked.push(seqno);
      return { status, code: cells.codeBoc, data: cells.dataBoc };
    };
    const found = await preFreezeStateFromArchive({ address: VAULT, frozenHash, listTransactions, readStateAt: stateAt(real) });
    expect(found.found?.via).toBe('archive');
    expect(found.found?.dataBoc).toBe(real.dataBoc);
    expect(pages, 'a second page when the first was full of pokes').toEqual([{ limit: 64, offset: 0 }, { limit: 64, offset: 64 }]);
    expect(asked, 'the state ONE block before the freezing one').toEqual([499]);
    expect((await preFreezeStateFromArchive({ address: VAULT, frozenHash, listTransactions, readStateAt: stateAt(other) })),
      'cells that do not hash to it are not the answer — nothing is built').toEqual({ found: null, reason: 'hash-mismatch' });
    expect((await preFreezeStateFromArchive({ address: VAULT, frozenHash, listTransactions, readStateAt: stateAt(real, 'frozen') })).reason)
      .toBe('no-state-before');
    expect((await preFreezeStateFromArchive({ address: VAULT, frozenHash: null, listTransactions, readStateAt: stateAt(real) })).found?.via).toBe('archive');
    const short: any[] = [];
    expect((await preFreezeStateFromArchive({ address: VAULT, frozenHash,
      listTransactions: async (_a: string, page: any) => { short.push(page); return [{ orig_status: 'active', end_status: 'active' }]; },
      readStateAt: stateAt(real) })).reason).toBe('no-freezing-transaction');
    expect(short).toHaveLength(1);
    expect(await matchFrozenState(frozenHash, [other, real])).toBe(real);
    expect(await matchFrozenState(frozenHash, [other])).toBeNull();
  });

  it('UNFREEZE-MOD-04: the debt is the carried due plus one cell\'s rent since, and the hour ahead — and nothing is guessed without a transaction', () => {
    const now = 1_800_000_000;
    expect(frozenAccountDebtNanotons({ dueCarried: 123_456_789n, lastTransactionAt: now - 3 * 31_536_000, nowSec: now }))
      .toBe(123_456_789n + storageFeeNanotons(FROZEN_ACCOUNT_STORAGE, 3 * 31_536_000 + UNFREEZE_LANDING_SECONDS, STORAGE_PRICE));
    expect(frozenAccountDebtNanotons({ dueCarried: 1n, lastTransactionAt: null, nowSec: now })).toBeNull();
    expect(FROZEN_ACCOUNT_STORAGE).toEqual({ cells: 1n, bits: 327n });
  });

  it('UNFREEZE-MOD-05: the message — non-bounceable, the given cells as its StateInit, and never empty-handed', async () => {
    const real = cellsOf(3);
    const message = buildUnfreezeMessage({ address: VAULT, ...real, amount: 7n, payload: null });
    expect(message.bounce, 'credit before storage: the debt is paid in the same transaction').toBe(false);
    expect(message.amount).toBe(7n);
    const { hash } = await tonCell.computeCellHashAndDepth(message.stateInit);
    expect(tonCell.bytesToHex(hash)).toBe(await stateInitHashHex(real.codeBoc, real.dataBoc));
    expect(message.stateInit.refs.map((ref: any) => cellToBoc(ref))).toEqual([real.codeBoc, real.dataBoc]);
    expect(() => buildUnfreezeMessage({ address: VAULT, ...real, amount: 0n })).toThrow();
    expect(cellToBoc(stateInitCellFromBocs(real.codeBoc, real.dataBoc))).toBe(cellToBoc(message.stateInit));
  });
});

describe('a frozen vault, in the plans', () => {
  const live = (extra: any = {}) => ({ ...vaultSnapshot({ staked: 5_000_000_000_000n, pending: 0n, pending_at: 0n, discount_bps: 5000n, fee_due: 5_000_000n,
    balance: 60_000_000n, exited: 0n, exited_at: 0n, accrued_fee: 0n }, { nowSec: 100, state: VAULT_LIVE }), ...extra });
  const frozen = vaultSnapshot(null, { nowSec: 100, state: VAULT_FROZEN, frozenHash: 'ab'.repeat(32) });

  it('UNFREEZE-PLAN-01: the snapshot keeps what the chain said — frozen with its hash, or live over a frozen custody wallet', () => {
    expect(frozen.state).toBe(VAULT_FROZEN);
    expect(frozen.frozenHash).toBe('ab'.repeat(32));
    expect(frozen.staked, 'a frozen view cannot be read; nothing is claimed about it').toBe(0n);
    const overFrozen = vaultSnapshot({ staked: 1n, pending: 0n }, { nowSec: 1, state: VAULT_LIVE, custodyFrozen: { address: CUSTODY, hash: 'cd'.repeat(32) } });
    expect(overFrozen.custodyFrozen).toEqual({ address: CUSTODY, hash: 'cd'.repeat(32) });
    expect(vaultSnapshot(null, { state: VAULT_UNKNOWN }).state).toBe(VAULT_UNKNOWN);
    expect(vaultSnapshot(null, {}).state).toBe(VAULT_ABSENT);
  });

  it('UNFREEZE-PLAN-02: nothing the chain would refuse is planned — every vault message under a frozen vault, every ATH move under a frozen custody wallet', () => {
    const custodyFrozen = live({ custodyFrozen: { address: CUSTODY, hash: 'cd'.repeat(32) } });
    expect(frozenRefusal(frozen)).toBe('vault-frozen');
    expect(frozenRefusal(custodyFrozen)).toBeNull();
    expect(frozenRefusal(custodyFrozen, { custody: true })).toBe('custody-frozen');
    const stakeArgs = { ownerWallet: OWNER, vaultAddress: VAULT, athWalletAddress: CUSTODY, ath: 500, queryId: 1n };
    expect(planStake({ ...stakeArgs, snapshot: frozen }).reason, 'MEASURED before: a deploy into the frozen vault and the ATH uncounted in custody').toBe('vault-frozen');
    expect(planStake({ ...stakeArgs, snapshot: custodyFrozen }).reason).toBe('custody-frozen');
    expect(planUnstake({ vaultAddress: VAULT, ath: 1n, snapshot: custodyFrozen }).reason, 'MEASURED before: planned, and bounced at custody').toBe('custody-frozen');
    expect(planUnstake({ vaultAddress: VAULT, ath: 1n, snapshot: frozen }).reason).toBe('vault-frozen');
    expect(planEmergencyExit({ vaultAddress: VAULT, atoms: 1n, snapshot: custodyFrozen }).reason).toBe('custody-frozen');
    expect(planRecovery({ vaultAddress: VAULT, snapshot: custodyFrozen, realAtoms: 9n }).reason).toBe('custody-frozen');
    expect(planWithdrawFloat({ vaultAddress: VAULT, snapshot: frozen }).reason).toBe('vault-frozen');
    expect(planUnstakeUnjam({ vaultAddress: VAULT, snapshot: frozen }).reason).toBe('vault-frozen');
    expect(planWithdrawFloat({ vaultAddress: VAULT, snapshot: live({ custodyFrozen: { address: CUSTODY, hash: 'cd'.repeat(32) }, balance: 90_000_000n }) }).ok).toBe(true);
    expect(planUnstake({ vaultAddress: VAULT, ath: 1n, snapshot: live() }).ok).toBe(true);
  });

  it('UNFREEZE-PLAN-03: the restore — one message per frozen account, its own cells, its debt plus what its first funding gave it; the custody wallet runs the no-authority top-up', async () => {
    const vaultCells = cellsOf(4);
    const custodyCells = cellsOf(5);
    const plan = planVaultRestore({ vaultAddress: VAULT, vault: { frozen: vaultCells, debt: 130_000_000n },
      custody: { address: CUSTODY, frozen: custodyCells, debt: 440_000_000n } });
    expect(plan.ok).toBe(true);
    expect(plan.messages.map((m: any) => m.address)).toEqual([VAULT, CUSTODY]);
    expect(plan.messages.map((m: any) => m.bounce)).toEqual([false, false]);
    expect(plan.messages.map((m: any) => m.amount)).toEqual([130_000_000n + FV_DEPLOY_FUNDING, 440_000_000n + FV_CUSTODY_TOPUP]);
    expect(plan.messages[0].payload, 'the vault\'s plain receiver').toBeNull();
    expect(BigInt(`0x${tonCell.bytesToHex(parseBocBase64(plan.messages[1].payload).data.slice(0, 4))}`), 'an ATH wallet\'s empty receiver throws; the op does not')
      .toBe(BigInt(ATH_WALLET_TOP_UP_OPCODE));
    expect(plan.messages.map((m: any) => m.stateInit.refs.map((ref: any) => cellToBoc(ref)))).toEqual([
      [vaultCells.codeBoc, vaultCells.dataBoc], [custodyCells.codeBoc, custodyCells.dataBoc]]);
    expect([plan.debt, plan.kept, plan.total]).toEqual([570_000_000n, FV_DEPLOY_FUNDING + FV_CUSTODY_TOPUP, 570_000_000n + FV_DEPLOY_FUNDING + FV_CUSTODY_TOPUP]);
    expect(planVaultRestore({ vaultAddress: VAULT, custody: { address: CUSTODY, frozen: custodyCells, debt: 1n } }).messages).toHaveLength(1);
    expect(planVaultRestore({ vaultAddress: VAULT, vault: { frozen: null, debt: 1n } }).reason).toBe('state-unfound');
    expect(planVaultRestore({ vaultAddress: VAULT, vault: { frozen: vaultCells, debt: null } }).reason).toBe('debt-unread');
    expect(planVaultRestore({ vaultAddress: VAULT }).reason).toBe('nothing-frozen');
    const built = feeVaultInitializedDataCell(OWNER);
    expect(built.bitLength).toBe(412);
    expect(() => feeVaultInitializedDataCell('EQ-not-raw')).toThrow();
  });
});

describe('the archive\'s two readers', () => {
  const answer = (status: number, body: any) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => null },
    async json() { return body; }, async text() { return JSON.stringify(body); } });

  it('UNFREEZE-RPC-01: the state at a past block is asked of the v2 door with its seqno; the history of the v3 door, newest first, a page at a time', async () => {
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(String(url));
      if (String(url).includes('/api/v2/getAddressInformation')) return answer(200, { ok: true, result: { state: 'active', code: 'C', data: 'D' } });
      return answer(200, { transactions: [{ lt: '1' }] });
    };
    const endpoint = 'https://door.invalid/api/v3/runGetMethod';
    const at = await createAccountStateAtReader({ endpoint, fetch })(VAULT, 4242);
    expect(at).toEqual({ state: 'active', code: 'C', data: 'D' });
    const history = await createAccountHistoryReader({ endpoint, fetch })(VAULT, { limit: 64, offset: 128 });
    expect(history).toEqual([{ lt: '1' }]);
    const [stateUrl, historyUrl] = urls.map((u) => new URL(u));
    expect(stateUrl.pathname).toBe('/api/v2/getAddressInformation');
    expect(Object.fromEntries(stateUrl.searchParams)).toEqual({ address: VAULT, seqno: '4242' });
    expect(historyUrl.pathname).toBe('/api/v3/transactions');
    expect(Object.fromEntries(historyUrl.searchParams)).toEqual({ account: VAULT, limit: '64', offset: '128', sort: 'desc' });
    await expect(createAccountStateAtReader({ endpoint, fetch: async () => answer(200, { ok: false, error: 'no' }) })(VAULT, 1))
      .rejects.toThrow(/refused/);
  });
});

describe('a frozen vault, in the app', () => {
  const freezeDoor = (status: string, hash: string | null = null) => {
    const calls: any[] = [];
    return { calls, getAccountState: async (input: any, options: any) => { calls.push({ input, options }); return { status, frozen_hash: hash ? b64(hash) : null }; } };
  };

  it('UNFREEZE-APP-01: a vault whose get-method finds nothing is asked whether it froze — frozen is said, absent is asked once a session', async () => {
    const make = (door: any, view: any = null) => {
      const env: any = {
        plathoWallet: { address: OWNER }, vaultSupported: () => true, feeVaultState: { wallet: null, address: null, snapshot: null },
        vaultAddressFor: async () => VAULT, globalThis: { plathoTonRpcTransport: { runGetMethod: async () => null, ...door } },
        CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8000, withVaultReadLock: (task: any) => task(),
        createFeeVaultReader: () => async () => view, VAULT_DEPLOY_SETTLE_MS: 120_000, renderFeeDiscountRows: () => {},
        vaultSnapshot, VAULT_LIVE, VAULT_FROZEN, VAULT_UNKNOWN, rememberVaultReading: () => {}, settleOwnVaultExit: () => {},
        accountStateRow, ACCOUNT_FROZEN, ACCOUNT_UNINIT, ACCOUNT_NONEXIST, feeVaultAbsenceConfirmed: new Set(), feeVaultFreezeAskedAt: new Map(), VAULT_FREEZE_REASK_MS: 600_000,
        isTonRpcRateLimitError: () => false, noteTonRpcRateLimit: () => false, console: { warn() {} },
        vaultClock: () => ({ nowSec: Math.floor(Date.now() / 1000) }),
      };
      return lift(env, [fn('async function readAccountFreeze(transport, address, readOptions = {}) {'),
        'const VAULT_RESTORE_LANDING_MS = 390000;', fn('function inheritVaultMarks(snapshot, prior, { custodyAnswered = false } = {}) {'), fn('async function refreshFeeVaultState({ critical = false } = {}) {'),
      app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {')], 'refreshFeeVaultState');
    };
    const hex = 'ef'.repeat(32);
    const frozenDoor = freezeDoor('frozen', hex);
    const state = await make(frozenDoor)({ critical: true });
    expect(state.snapshot.state, 'MEASURED before: ABSENT — every private message carried a deploy into it').toBe(VAULT_FROZEN);
    expect(state.snapshot.frozenHash).toBe(hex);
    expect(frozenDoor.calls[0].options.priority, 'at the send\'s own tier when a send waits on it').toBe('critical');
    const absentDoor = freezeDoor('uninit');
    const refresh = make(absentDoor);
    expect((await refresh()).snapshot.state).toBe(VAULT_ABSENT);
    expect((await refresh()).snapshot.state).toBe(VAULT_ABSENT);
    expect(absentDoor.calls, 'an account that does not exist cannot freeze inside a session: asked once').toHaveLength(1);
    const unsure = await make({ getAccountState: async () => ({ status: 'active' }) })();
    expect(unsure.snapshot.state, 'an account that reads active a moment after its get-method found nothing').toBe(VAULT_UNKNOWN);
  });

  it('UNFREEZE-APP-02: a get-method that fails on a frozen vault with an error of its own is asked about too — and a busy network is not', async () => {
    const make = (error: any, door: any, busy = false) => lift({
      plathoWallet: { address: OWNER }, vaultSupported: () => true, feeVaultState: { wallet: null, address: null, snapshot: null },
      vaultAddressFor: async () => VAULT, globalThis: { plathoTonRpcTransport: { runGetMethod: async () => null, ...door } },
      CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8000, withVaultReadLock: (task: any) => task(),
      createFeeVaultReader: () => async () => { throw error; }, VAULT_DEPLOY_SETTLE_MS: 120_000, renderFeeDiscountRows: () => {},
      vaultSnapshot, VAULT_LIVE, VAULT_FROZEN, VAULT_UNKNOWN, rememberVaultReading: () => {}, settleOwnVaultExit: () => {},
      accountStateRow, ACCOUNT_FROZEN, ACCOUNT_UNINIT, ACCOUNT_NONEXIST, feeVaultAbsenceConfirmed: new Set(), feeVaultFreezeAskedAt: new Map(), VAULT_FREEZE_REASK_MS: 600_000,
      isTonRpcRateLimitError: () => busy, noteTonRpcRateLimit: () => busy, console: { warn() {} },
      vaultClock: () => ({ nowSec: Math.floor(Date.now() / 1000) }),
    }, [fn('async function readAccountFreeze(transport, address, readOptions = {}) {'),
      'const VAULT_RESTORE_LANDING_MS = 390000;', fn('function inheritVaultMarks(snapshot, prior, { custodyAnswered = false } = {}) {'), fn('async function refreshFeeVaultState({ critical = false } = {}) {'),
      app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {')], 'refreshFeeVaultState');
    const door = freezeDoor('frozen', 'aa'.repeat(32));
    expect((await make(new Error('account is frozen'), door)()).snapshot.state, 'MEASURED before: UNKNOWN for good').toBe(VAULT_FROZEN);
    const quiet = freezeDoor('frozen', 'aa'.repeat(32));
    expect((await make(Object.assign(new Error('429'), { status: 429 }), quiet, true)()).snapshot.state).toBe(VAULT_UNKNOWN);
    expect(quiet.calls, 'a busy network is not asked a second question').toHaveLength(0);
  });

  it('UNFREEZE-APP-03: a staker\'s custody wallet that answers like one never funded is asked whether it froze — a non-staker\'s is not', async () => {
    const make = (staked: bigint, door: any) => lift({
      plathoWallet: { address: OWNER }, vaultSupported: () => true, feeVaultState: { wallet: null, address: null, snapshot: null },
      vaultAddressFor: async () => VAULT, globalThis: { plathoTonRpcTransport: { runGetMethod: async () => null, ...door } },
      CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8000, withVaultReadLock: (task: any) => task(),
      createFeeVaultReader: () => async () => ({ staked, pending: 0n, pending_at: 0n, discount_bps: 0n, fee_due: 10_000_000n, balance: 60_000_000n,
        exited: 0n, exited_at: 0n, accrued_fee: 0n }),
      VAULT_DEPLOY_SETTLE_MS: 120_000, renderFeeDiscountRows: () => {}, vaultSnapshot, VAULT_LIVE, VAULT_FROZEN, VAULT_UNKNOWN,
      rememberVaultReading: () => {}, settleOwnVaultExit: () => {}, accountStateRow, ACCOUNT_FROZEN, ACCOUNT_UNINIT, ACCOUNT_NONEXIST,
      feeVaultAbsenceConfirmed: new Set(), feeVaultFreezeAskedAt: new Map(), VAULT_FREEZE_REASK_MS: 600_000, isTonRpcRateLimitError: () => false, noteTonRpcRateLimit: () => false, console: { warn() {} },
      resolveAthMasterProvider: async () => ({ getWalletAddress: async () => CUSTODY }), requireAthMasterAddress: () => 'M',
      criticalChainReadOptions: () => ({}), nonNegativeBigInt: (v: any) => BigInt(v),
      createAthWalletTonRpcProvider: () => ({ getWalletData: async () => { throw Object.assign(new Error('exit -13'), { notDeployed: true }); } }),
      isAthWalletNotDeployedError: (error: any) => error?.notDeployed === true,
      vaultClock: () => ({ nowSec: Math.floor(Date.now() / 1000) }),
    }, [fn('async function readAccountFreeze(transport, address, readOptions = {}) {'),
      'const VAULT_RESTORE_LANDING_MS = 390000;', fn('function inheritVaultMarks(snapshot, prior, { custodyAnswered = false } = {}) {'), fn('async function refreshFeeVaultState({ critical = false } = {}) {'),
      app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {')], 'refreshFeeVaultState');
    const door = freezeDoor('frozen', 'bb'.repeat(32));
    const state = await make(5_000_000_000_000n, door)();
    expect(state.snapshot.state).toBe(VAULT_LIVE);
    expect(state.snapshot.custodyFrozen, 'MEASURED before: "0 ATH" in custody and an unstake the chain would bounce').toEqual({ address: CUSTODY, hash: 'bb'.repeat(32) });
    expect(state.realAtoms, 'what the frozen wallet holds is not claimed to be zero').toBeNull();
    const notStaked = freezeDoor('frozen', 'bb'.repeat(32));
    const plain = await make(0n, notStaked)();
    expect(plain.snapshot.custodyFrozen).toBeNull();
    expect(plain.realAtoms).toBe(0n);
    expect(notStaked.calls, 'a wallet with nothing staked in it is not asked').toHaveLength(0);
  });

  it('UNFREEZE-APP-04: a private send to a frozen vault is refused by name before anything is signed, and not retried; the composer says it with the unfreeze as its button', async () => {
    const frozenState = { wallet: OWNER, address: VAULT, snapshot: vaultSnapshot(null, { nowSec: Math.floor(Date.now() / 1000), state: VAULT_FROZEN, frozenHash: 'ab'.repeat(32) }) };
    const reads: any[] = [];
    const routing = lift({
      vaultSupported: () => true, plathoWallet: { address: OWNER }, feeVaultState: frozenState, VAULT_LIVE, VAULT_ABSENT, VAULT_FROZEN,
      vaultSnapshotOutdated: () => false, boundedFeeVaultRoutingRead: async () => { reads.push(1); },
      settleUnconfirmedVaultDeploy: async () => {},
    }, [fn('function convVaultStateUnknownError() {'), fn('function convVaultFrozenError() {'), fn('async function convVaultRouting() {')], 'convVaultRouting');
    await expect(routing(), 'MEASURED before: routed as ABSENT, a deploy riding every message into the frozen vault').rejects.toMatchObject({ code: 'CONV_VAULT_FROZEN' });
    expect(reads, 'a fresh frozen answer is an answer: no re-read at every send').toEqual([]);
    const isFatal = lift({ isPublishPriceChangeCancelled: () => false, RECIPIENT_NOT_ACTIVATED: 'RNA', isVaultPublishPartialError: () => false },
      [fn('function isFatalPrivateSendError(error) {')], 'isFatalPrivateSendError');
    expect(isFatal({ code: 'CONV_VAULT_FROZEN' })).toBe(true);
    expect(code(fn('function privateSendPreflightStatusText(error) {'))).toContain("if (error?.code === 'CONV_VAULT_FROZEN') return t('send.vaultFrozen');");
    const own = lift({ feeVaultState: frozenState, plathoWallet: { address: OWNER }, VAULT_FROZEN, VAULT_LIVE }, [fn('function ownVaultFreeze() {')], 'ownVaultFreeze');
    expect(own()).toEqual({ vault: true, custody: false });
    const reason = lift({
      groupSelfIsBanned: () => false, groupSelfIsMuted: () => false, plathoWallet: { address: OWNER }, walletNeededReason: () => 'x',
      pendingServiceWorkerAppShellReload: false, isPublicGroupThread: (thread: any) => thread.publicRoom === true, localIdentity: {}, localRecipientKeyPair: {},
      localSignedPublicBundle: {}, hasActivePlathoAccount: () => true, accountActivationInFlight: () => false, activationAnswerKnownFor: () => true,
      t, writeGenerationNow: () => 18, ownVaultFreeze: own, privateComposerSendPlan: () => [], messageInput: null, privateImageAttachments: [],
      currentPrivateSenderOptions: () => ({}), privateComposerPartLimitMessage: () => null, privateComposerKnownVaultTonShortfall: () => false,
      activeThread: () => null,
      vaultRestoreLanding: () => false, feeVaultState: frozenState,
    }, [fn('function vaultRestoreLostNow() {'),
      fn('function vaultFrozenComposerReason() {'), fn('function privateSendBlockReason(thread = activeThread(), options = {}) {')], 'privateSendBlockReason',
    'let vaultRestoreInFlight = false; let vaultRestoreChecking = false; let vaultRestoreLost = null;');
    expect(reason({ id: 'p' }), 'MEASURED before: a price under a send the chain would refuse').toBe(t('send.vaultFrozen'));
    expect(reason({ id: 'r', publicRoom: true }), 'a public room is paid from the wallet, not the vault').not.toBe(t('send.vaultFrozen'));
    const opened: any[] = [];
    const action = lift({ t, walletUnlockAction: () => null, openVaultRestoreDialog: async () => { opened.push(1); } },
      [fn('function activationComposerAction(reason) {')], 'activationComposerAction');
    const button = action(t('send.vaultFrozen'));
    expect(button.label).toBe(t('profile.vaultRestoreAction'));
    button.run();
    expect(opened).toEqual([1]);
  });

  it('UNFREEZE-APP-05: the rows — the frozen row with its action, and nothing offered that the chain would refuse', () => {
    const node = () => ({ hidden: false, textContent: '', disabled: false });
    const make = (snapshot: any) => {
      const els: any = { feeDiscountStatus: node(), unstakeAthButton: node(), unstakeAthStatus: node(), recoverAthButton: node(), recoverAthStatus: node(),
        vaultFloatButton: node(), vaultFloatStatus: node(), vaultRestoreButton: { ...node(), hidden: true }, vaultRestoreStatus: node() };
      const feeVaultState = { wallet: OWNER, address: VAULT, snapshot, realAtoms: 0n };
      lift({ ...els, vaultSupported: () => true, plathoWallet: { address: OWNER }, feeVaultState, t, setText: (n: any, v: string) => { if (n) n.textContent = v; },
        VAULT_UNKNOWN, VAULT_FROZEN, VAULT_LIVE, vaultRestoreInFlight: false, stakedAthOf: (s: any) => (s?.staked ?? 0n) / 1_000_000_000n,
        groupDecimalText: (v: string) => v, planRecovery, planWithdrawFloat, FV_ATOMIC_PER_ATH: 1_000_000_000n, formatGramNanotons: (v: any) => String(v),
        vaultRestoreLanding: () => false,
        vaultRestoreLost: null,
      }, [fn('function ownVaultFreeze() {'), fn('function vaultRestoreLostNow() {'), fn('function renderFeeDiscountRows() {')], 'renderFeeDiscountRows')();
      return els;
    };
    const frozenRows = make(vaultSnapshot(null, { nowSec: 1, state: VAULT_FROZEN, frozenHash: 'ab'.repeat(32) }));
    expect(frozenRows.vaultRestoreButton.hidden, 'MEASURED before: no row at all — "not staked" over a frozen stake').toBe(false);
    expect(frozenRows.vaultRestoreStatus.textContent).toBe(t('profile.vaultRestoreAction'));
    expect(frozenRows.feeDiscountStatus.textContent).toBe(t('profile.vaultFrozenStatus'));
    expect([frozenRows.unstakeAthButton.hidden, frozenRows.recoverAthButton.hidden, frozenRows.vaultFloatButton.hidden]).toEqual([true, true, true]);
    const custodyRows = make({ ...vaultSnapshot({ staked: 5_000_000_000_000n, pending: 0n, balance: 60_000_000n, discount_bps: 5000n, fee_due: 5_000_000n },
      { nowSec: 1, state: VAULT_LIVE }), custodyFrozen: { address: CUSTODY, hash: 'cd'.repeat(32) } });
    expect(custodyRows.vaultRestoreButton.hidden).toBe(false);
    expect(custodyRows.unstakeAthButton.hidden, 'the withdrawal would bounce at the frozen wallet').toBe(true);
    const healthy = make(vaultSnapshot({ staked: 5_000_000_000_000n, pending: 0n, balance: 60_000_000n, discount_bps: 5000n, fee_due: 5_000_000n }, { nowSec: 1, state: VAULT_LIVE }));
    expect(healthy.vaultRestoreButton.hidden).toBe(true);
    expect(healthy.unstakeAthButton.hidden).toBe(false);
  });

  it('UNFREEZE-APP-06: a frozen answer ages like the others, and one an unfreeze was sent against is asked again at every look', () => {
    const now = Math.floor(Date.now() / 1000);
    const outdated = (snapshot: any) => lift({ feeVaultState: { wallet: OWNER, snapshot }, plathoWallet: { address: OWNER }, VAULT_LIVE, VAULT_ABSENT, VAULT_FROZEN,
      VAULT_DEPLOY_SETTLE_MS: 120_000, VAULT_SNAPSHOT_MAX_AGE_S: 600 }, [fn('function vaultSnapshotOutdated() {')], 'vaultSnapshotOutdated')();
    expect(outdated({ state: VAULT_FROZEN, nowSec: now - 5 })).toBe(false);
    expect(outdated({ state: VAULT_FROZEN, nowSec: now - 601 }), 'MEASURED before: never — an unfreeze from another device was never seen').toBe(true);
    expect(outdated({ state: VAULT_FROZEN, nowSec: now, restoreSentAt: Date.now() }), 'the first message after an unfreeze is not refused on the old answer').toBe(true);
  });

  it('UNFREEZE-APP-07: the press — what the freeze costs is read, named in the dialog, and only then the one transfer is signed; an archive that cannot find the state refuses before anything is signed', async () => {
    const make = (restore: any) => {
      const sent: any[] = [];
      const notices: string[] = [];
      const status = { textContent: '' };
      const dialogs: any[] = [];
      const env: any = {
        vaultSupported: () => true, plathoWallet: { address: OWNER }, vaultRestoreInFlight: false, vaultRestoreStatus: status, vaultRestoreButton: { disabled: false },
        vaultRestoreChecking: false, vaultRestoreLost: null,
        walletSessionGeneration: 1,
        setText: (n: any, v: string) => { if (n) n.textContent = v; }, t, readVaultAtPress: async () => {},
        ownVaultFreeze: () => ({ vault: true, custody: false }),
        feeVaultState: { wallet: OWNER, address: VAULT, snapshot: { state: VAULT_FROZEN, frozenHash: 'ab'.repeat(32) } },
        renderFeeDiscountRows: () => {}, readFrozenAccountRestore: restore, frozenVaultCustody: async () => null,
        feeVaultCodeBoc: () => 'CODE', cellToBoc: () => 'DATA', feeVaultInitializedDataCell: () => ({}), planVaultRestore,
        noteTonRpcRateLimit: () => false, console: { warn() {} }, showAppNotice: (text: string) => notices.push(text),
        formatGramNanotonsUp: (v: any) => String(v), walletSendFeeReserveNanotons: () => 10n, balanceNeededText: (v: any) => `need ${v}`,
        openActionDialog: async (config: any) => { dialogs.push(config); return true; }, requirePlathoWallet: () => ({ address: OWNER }),
        vaultAddressFor: async () => VAULT, assertWalletGramAtLeast: async () => {}, globalThis: {},
        sendPlathoWalletTransaction: async (_w: any, { messages }: any) => { sent.push(messages); return {}; }, requireSameWallet: (w: any) => w,
        noteVaultRestoreSent: () => {}, queueAthPostTransactionRefresh: () => {}, broadcastMayHaveLanded: () => false,
        vaultRestoreLanding: () => false, withVaultReadLock: (task: any) => task(), criticalChainReadOptions: () => ({}),
        readAccountFreeze: async () => ({ hash: 'ab'.repeat(32) }), walletTransferNotRun: () => false,
        tonCell,
        privateComposerCostStatus: null, publicComposerCostStatus: null, loadConnectedTonWalletBalance: async () => null,
        releaseHeldStatus: () => {}, refreshComposerCostStatus: () => {}, joinHintSentences: (...parts: string[]) => parts.join(' '),
        rememberedVaultReading: null, FV_PROTOCOL_FEE: 10_000_000n,
      };
      const lostReasons = app.slice(app.indexOf('const VAULT_ARCHIVE_LOST_REASONS'), app.indexOf(String.fromCharCode(10), app.indexOf('const VAULT_ARCHIVE_LOST_REASONS')));
      return { run: lift(env, [lostReasons, fn('function vaultRestoreRefusalText(plan) {'), fn('function vaultRestoreNeed(plan) {'), fn('function vaultRestoreSay(text, line = null, lineText = text) {'),
        fn('async function openVaultRestoreDialog({ line = null } = {}) {'), fn('async function signVaultRestore(plan, need, wallet, vaultAddress, { line = null } = {}) {')],
      'openVaultRestoreDialog'), sent, notices, status, dialogs };
    };
    const cells = cellsOf(6);
    const ok = make(async (address: string) => ({ frozen: cells, debt: 130_000_000n, reason: null }));
    await ok.run();
    expect(ok.dialogs).toHaveLength(1);
    expect(ok.dialogs[0].submitLabel).toBe(t('profile.vaultRestoreSubmit', { amount: String(130_000_000n + FV_DEPLOY_FUNDING) }));
    expect(ok.dialogs[0].summary().map((row: any) => row.label)).toEqual([t('profile.vaultRestoreDebt'), t('profile.vaultRestoreKept'), t('common.balanceNeeded')]);
    expect(ok.sent).toHaveLength(1);
    expect(ok.sent[0].map((m: any) => [m.address, m.bounce])).toEqual([[VAULT, false]]);
    const lost = make(async () => ({ frozen: null, debt: 1n, reason: 'hash-mismatch' }));
    await lost.run();
    expect(lost.dialogs, 'nothing is offered on a state that was not found').toHaveLength(0);
    expect(lost.sent).toHaveLength(0);
    expect(lost.notices).toEqual([t('profile.vaultRestoreLost')]);
  });

  it('UNFREEZE-APP-08: the reads behind the press — the never-used form first (no archive), the archive otherwise, and the debt off the newest transaction', async () => {
    const real = cellsOf(7);
    const frozenHash = await stateInitHashHex(real.codeBoc, real.dataBoc);
    const make = (archiveFound: any) => {
      const archive: any[] = [];
      const read = lift({
        CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8000, matchFrozenState, accountStateRow, console: { warn() {} },
        createAccountStateAtReader: () => async () => ({ state: 'active' }),
        createAccountHistoryReader: () => async () => [],
        preFreezeStateFromArchive: async (args: any) => { archive.push(args.address); return { found: archiveFound, reason: archiveFound ? null : 'hash-mismatch' }; },
        createShardLastTransactionReader: (options: any) => async () => { archive.push(options.requestOptions.priority); return { now: 1_000, storageFeesDue: 90n }; },
        frozenAccountDebtNanotons, chainNowSec: () => 1_000,
      }, [fn('async function readFrozenAccountRestore(address, frozenHash, { candidates = [], alive = () => true } = {}) {')], 'readFrozenAccountRestore');
      return { read, archive };
    };
    const squat = make(null);
    const fromCandidate = await squat.read(VAULT, frozenHash, { candidates: [cellsOf(8), real] });
    expect(fromCandidate.frozen, 'a vault nobody used: rebuilt, the archive never asked').toBe(real);
    expect(squat.archive, 'only the debt is read, at the press\'s own tier').toEqual(['critical']);
    expect(fromCandidate.debt).toBe(frozenAccountDebtNanotons({ dueCarried: 90n, lastTransactionAt: 1_000, nowSec: 1_000 }));
    const used = make({ ...real, via: 'archive' });
    const fromArchive = await used.read(VAULT, frozenHash, { candidates: [cellsOf(9)] });
    expect(fromArchive.frozen?.via).toBe('archive');
    expect(used.archive).toEqual([VAULT, 'critical']);
  });

  it('UNFREEZE-APP-09: a public post under a frozen vault takes the direct door at once — a frozen answer is not re-read at every post', async () => {
    let reads = 0;
    const routing = lift({
      vaultSupported: () => true, plathoWallet: { address: OWNER }, writeGenerationNow: () => 18, VAULT_LIVE, VAULT_ABSENT, VAULT_FROZEN,
      vaultSnapshotOutdated: () => false, refreshFeeVaultState: async () => { reads += 1; }, PUBLIC_ROUTING_READ_DEADLINE_MS: 20,
      ownVaultFeeDue: () => 0n, messageNetworkPrices: async () => null, VAULT_UNKNOWN,
      __state: { wallet: OWNER, address: VAULT, snapshot: { state: VAULT_FROZEN, frozenHash: 'ab'.repeat(32) } },
    }, ['let feeVaultState = __state;', 'const VAULT_ROUTING_FAILURE_MEMORY_MS = 60_000;', 'let feeVaultRoutingRead = null;', 'let feeVaultRoutingFailedAt = 0;',
      fn('function readFeeVaultForRouting('), fn('async function boundedFeeVaultRoutingRead('), fn('async function publicPublishRouting(')], 'publicPublishRouting');
    expect(await routing()).toEqual({});
    expect(reads, 'MEASURED before: read again (up to 8 s) before every post').toBe(0);
  });
});
