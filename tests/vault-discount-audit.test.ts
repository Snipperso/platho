import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import {
  FV_CUSTODY_TOPUP, FV_STAKE_MAX_ATH, FV_STAKE_MIN_ATH, planStake, planUnstake, priceVaultExit, priceVaultStake, vaultSnapshot,
  VAULT_ABSENT, VAULT_LIVE, VAULT_UNKNOWN, VAULT_FROZEN,
} from '../web/vault-account.mjs';
import { ACCOUNT_FROZEN, ACCOUNT_NONEXIST, ACCOUNT_UNINIT, accountStateRow } from '../web/frozen-account.mjs';
import { FV_ATOMIC_PER_ATH, FV_DEPLOY_FUNDING, FV_FLOAT_TOPUP_BELOW, FV_PROTOCOL_FEE, feeDueForStakedAtoms } from '../web/fee-vault.mjs';
import { athTransferTopUpPossible } from '../web/ath-request-reserve.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => sourceBlock(app, declaration);
const OWN_EXIT_DECLARATIONS = app.slice(app.indexOf('const OWN_VAULT_EXIT_SETTLE_MS'), app.indexOf('function ownVaultExitInFlight('));
const CLOCK = 1_800_000_000_000;
const ath = (whole: bigint) => whole * FV_ATOMIC_PER_ATH;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    map,
  };
}

const viewAt = (staked: bigint) => ({
  staked, fee_due: feeDueForStakedAtoms(staked), discount_bps: staked / FV_ATOMIC_PER_ATH, balance: FV_FLOAT_TOPUP_BELOW * 4n,
});

function funnels({ snapshot = null as any, view = null as any, storage = memoryStorage(), wallet = 'W' } = {}) {
  const calls: any[] = [];
  const chain = { view, down: false };
  const sent: any[] = [];
  const hooks: { send: (tx: any) => Promise<void>; balance: bigint | null } = { send: async (tx) => { sent.push(tx); }, balance: null };
  (globalThis as any).plathoWalletRpcTransport = {
    async getAccountState() {
      if (chain.down) throw Object.assign(new Error('every door is down'), { status: 503 });
      return { status: 'uninit' };
    },
    async runGetMethod(call: any) {
      calls.push(call);
      if (chain.down) throw Object.assign(new Error('every door is down'), { status: 503 });
      return chain.view;
    },
  };
  const env: Record<string, any> = {
    vaultSupported: () => true,
    plathoWallet: { address: wallet },
    VAULT_LIVE, VAULT_ABSENT, VAULT_UNKNOWN, vaultSnapshot, FV_PROTOCOL_FEE, FV_FLOAT_TOPUP_BELOW,
    VAULT_FROZEN, accountStateRow, ACCOUNT_FROZEN, ACCOUNT_UNINIT, ACCOUNT_NONEXIST, feeVaultAbsenceConfirmed: new Set(), feeVaultFreezeAskedAt: new Map(), VAULT_FREEZE_REASK_MS: 600_000,
    isTonRpcRateLimitError: (error: any) => error?.status === 429,
    VAULT_SNAPSHOT_MAX_AGE_S: 600, VAULT_DEPLOY_SETTLE_MS: 120_000,
    writeGenerationNow: () => 18, PUBLIC_ROUTING_READ_DEADLINE_MS: 8_000,
    WALLET_EXTERNAL_VALIDITY_S: 300, walletIndexedDbSuffix: (address: string) => String(address), plathoLocalDataClearing: false,
    vaultAddressFor: async () => 'VAULT',
    rememberVaultReading: () => {}, rememberedVaultReading: null,
    withVaultReadLock: (task: any) => task(),
    createFeeVaultReader: (run: any) => async (address: string) => run({ address, method: 'get_vault', stack: [] }),
    resolveAthMasterProvider: async () => ({ getWalletAddress: async () => 'VAULT-ATH' }),
    requireAthMasterAddress: () => 'MASTER',
    criticalChainReadOptions: () => ({}),
    createAthWalletTonRpcProvider: () => ({ getWalletData: async () => ({ balance: 0n }) }),
    nonNegativeBigInt: (value: any) => BigInt(value),
    isAthWalletNotDeployedError: () => false,
    noteTonRpcRateLimit: () => true,
    renderFeeDiscountRows: () => {},
    composerChainFact: () => null,
    messageNetworkPrices: async () => null,
    localStorage: storage,
    scopedStorageKey: (key: string) => `${key}:deployment`,
    requirePlathoWalletAddress: () => env.plathoWallet.address,
    requirePlathoWallet: () => env.plathoWallet,
    sendPlathoWalletTransaction: async (_wallet: any, tx: any) => hooks.send(tx),
    assertWalletGramAtLeast: async (need: bigint) => { if (hooks.balance !== null && hooks.balance < need) throw Object.assign(new Error('short'), { code: 'PLATHO_WALLET_GRAM_REQUIRED' }); },
    walletSendFeeReserveNanotons: () => 10_000_000n,
    broadcastMayHaveLanded: (error: any) => error?.mayHaveLanded === true,
    CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8_000,
    walletChangedBeforeSigningError: () => Object.assign(new Error('the wallet changed'), { code: 'PLATHO_WALLET_CHANGED' }),
    vaultClock: () => ({ nowSec: Math.floor(Date.now() / 1000) }),
    __snapshot: snapshot,
  };
  const names = Object.keys(env);
  const sources = [
    `let feeVaultState = ${JSON.stringify({ wallet, address: 'VAULT' })};`,
    'feeVaultState.snapshot = __snapshot;',
    OWN_EXIT_DECLARATIONS,
    fn('function ownVaultExitInFlight('), fn('function noteOwnVaultExit('), fn('async function broadcastOwnVaultExit('),
    fn('function ownVaultExitReflectedBy('), fn('function settleOwnVaultExit('), fn('function ownVaultFeeDue('),
    fn('function vaultSnapshotOutdated('), fn('async function readAccountFreeze('), 'const VAULT_RESTORE_LANDING_MS = 390000;', fn('function inheritVaultMarks(snapshot, prior, { custodyAnswered = false } = {}) {'), fn('async function refreshFeeVaultState('),
    fn('function convVaultStateUnknownError('), fn('function convVaultFrozenError('), fn('async function convVaultRouting('),
    app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {'),
    app.slice(app.indexOf('const FEE_VAULT_DEPLOY_WAIT_MS'), app.indexOf('function openFeeVaultDeployFlight(')),
    fn('function openFeeVaultDeployFlight('), fn('function settleFeeVaultDeployFlight('), fn('async function feeVaultDeployCarriedElsewhere('),
    fn('async function publicPublishRouting('), fn('function composerVaultTerms('),
    app.slice(app.indexOf('const VAULT_ROUTING_FAILURE_MEMORY_MS'), app.indexOf('function readFeeVaultForRouting(')),
    fn('function readFeeVaultForRouting('), fn('async function boundedFeeVaultRoutingRead('), fn('function requireSameWallet('),
  ];
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, `${sources.join('\n')}
return { convVaultRouting, publicPublishRouting, composerVaultTerms, refreshFeeVaultState, broadcastOwnVaultExit,
  noteOwnVaultExit, ownVaultFeeDue, state: () => feeVaultState };`)(...names.map((n) => env[n]));
  return { api, calls, chain, sent, hooks, storage, env };
}

const at = (ms: number) => { vi.useFakeTimers(); vi.setSystemTime(ms); };
afterEach(() => { vi.useRealTimers(); delete (globalThis as any).plathoWalletRpcTransport; });

describe('DA-1 — the public routing reads a vault it has not read, at the send\'s own tier', () => {
  it('DA1-01: never read -> read now (critical, uncached, never skipped), and the staker\'s discount applies', async () => {
    at(CLOCK);
    const { api, calls } = funnels({ snapshot: null, view: viewAt(ath(5_000n)) });
    const routing = await api.publicPublishRouting();
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatchObject({ priority: 'critical', skipIfRateLimited: false, cacheTtlMs: 0 });
    expect(routing).toEqual({ vaultAddress: 'VAULT', feeDue: feeDueForStakedAtoms(ath(5_000n)), prices: null });
  });

  it('DA1-02: read as UNKNOWN (the unlock\'s read failed) -> read again before the door is chosen', async () => {
    at(CLOCK);
    const { api, calls } = funnels({ snapshot: vaultSnapshot(null, { state: VAULT_UNKNOWN }), view: viewAt(ath(2_000n)) });
    const routing = await api.publicPublishRouting();
    expect(calls.length).toBe(1);
    expect(routing.feeDue).toBe(feeDueForStakedAtoms(ath(2_000n)));
  });

  it('DA1-03: a fresh LIVE read is not asked again; one that still cannot be read sends through the direct door', async () => {
    at(CLOCK);
    const fresh = vaultSnapshot(viewAt(ath(5_000n)), { nowSec: CLOCK / 1000 });
    const quiet = funnels({ snapshot: fresh, view: viewAt(ath(1n)) });
    expect((await quiet.api.publicPublishRouting()).feeDue).toBe(feeDueForStakedAtoms(ath(5_000n)));
    expect(quiet.calls.length, 'a send costs no read while the snapshot is fresh').toBe(0);
    const down = funnels({ snapshot: null });
    down.chain.down = true;
    expect(await down.api.publicPublishRouting(), 'not known: the full fee at the direct door, which every shard accepts').toEqual({});
  });
});

describe('DA-2 — an exit this device signed is priced in before any read can show it', () => {
  const BEFORE = ath(5_000n);
  const AFTER_FEE = feeDueForStakedAtoms(ath(1_000n));

  it('DA2-01: the unstake plan names the fee its position will pay, and it is dearer than the read\'s', () => {
    const snapshot = vaultSnapshot(viewAt(BEFORE), { nowSec: 0 });
    const plan = planUnstake({ vaultAddress: 'VAULT', ath: '4000', snapshot });
    expect(plan.ok).toBe(true);
    expect(plan.remainingFeeDue).toBe(AFTER_FEE);
    expect(AFTER_FEE).toBeGreaterThan(snapshot.feeDue);
  });

  it('DA2-02: inside the hop every funnel carries the post-exit fee, though the snapshot is fresh and says otherwise', async () => {
    at(CLOCK);
    const f = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }), view: viewAt(BEFORE) });
    await f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE);
    expect(f.sent.length).toBe(1);
    vi.setSystemTime(CLOCK + 20_000);
    expect((await f.api.convVaultRouting()).feeDue, 'the private funnel (and the group runtime, handed the same function)').toBe(AFTER_FEE);
    expect((await f.api.publicPublishRouting()).feeDue, 'the public funnel').toBe(AFTER_FEE);
    expect(f.api.composerVaultTerms().feeDue, 'and the price the composer shows').toBe(AFTER_FEE);
    expect(f.calls.length, 'no extra read is needed for any of it').toBe(0);
  });

  it('DA2-03: a read that still shows the old position is not believed while the exit can land; once it cannot, the read is the truth', async () => {
    at(CLOCK);
    const f = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }), view: viewAt(BEFORE) });
    await f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE);
    vi.setSystemTime(CLOCK + 30_000);
    await f.api.refreshFeeVaultState();
    expect(f.api.ownVaultFeeDue(f.api.state().snapshot), 'read 30 s after the send: the exit may still be landing').toBe(AFTER_FEE);
    expect(f.storage.map.size, 'the mark is kept').toBe(1);
    vi.setSystemTime(CLOCK + 130_000);
    await f.api.refreshFeeVaultState();
    expect(f.api.ownVaultFeeDue(f.api.state().snapshot), 'a read at +130 s proves nothing yet').toBe(AFTER_FEE);
    expect(f.storage.map.size, 'and does not clear the mark').toBe(1);
    vi.setSystemTime(CLOCK + 300_000 + 120_000);
    await f.api.refreshFeeVaultState();
    expect(f.api.ownVaultFeeDue(f.api.state().snapshot)).toBe(feeDueForStakedAtoms(BEFORE));
    expect(f.storage.map.size, 'settled: nothing left on the device').toBe(0);
  });

  it('DA2-10: a read that shows the exit settles the mark at once [round 11 - delta-1]', async () => {
    at(CLOCK);
    const f = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }), view: viewAt(BEFORE) });
    await f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE);
    f.chain.view = viewAt(ath(1_000n));
    vi.setSystemTime(CLOCK + 25_000);
    await f.api.refreshFeeVaultState();
    expect(f.storage.map.size, 'the read reflects the exit: nothing left to correct').toBe(0);
    expect(f.api.ownVaultFeeDue(f.api.state().snapshot)).toBe(AFTER_FEE);
  });

  it('DA2-04: a message priced WHILE the exit is being signed sees the mark — it is set before the broadcast', async () => {
    at(CLOCK);
    const f = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }), view: viewAt(BEFORE) });
    let seenMidSend: bigint | null = null;
    f.hooks.send = async () => { seenMidSend = (await f.api.convVaultRouting()).feeDue; };
    await f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE);
    expect(seenMidSend).toBe(AFTER_FEE);
  });

  it('DA2-05: an app closed and reopened inside the hop keeps the mark; another wallet on the device is not touched by it', async () => {
    at(CLOCK);
    const storage = memoryStorage();
    const first = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }), storage });
    await first.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE);
    vi.setSystemTime(CLOCK + 10_000);
    const reopened = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: (CLOCK + 10_000) / 1000 }), storage });
    expect((await reopened.api.convVaultRouting()).feeDue).toBe(AFTER_FEE);
    const other = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: (CLOCK + 10_000) / 1000 }), storage, wallet: 'OTHER' });
    expect((await other.api.convVaultRouting()).feeDue).toBe(feeDueForStakedAtoms(BEFORE));
  });

  it('DA2-06: a second exit inside the first one\'s hop, planned on a snapshot that did not know the first, keeps the dearer fee', async () => {
    at(CLOCK);
    const f = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }) });
    await f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE);
    vi.setSystemTime(CLOCK + 5_000);
    await f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], feeDueForStakedAtoms(ath(4_000n)));
    expect((await f.api.convVaultRouting()).feeDue).toBe(AFTER_FEE);
  });

  it('DA2-07: a send whose answer was lost keeps the mark, stamped again; one that failed outright keeps it too — it only over-attaches', async () => {
    at(CLOCK);
    const lost = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }) });
    lost.hooks.send = async () => { vi.setSystemTime(CLOCK + 50_000); throw Object.assign(new Error('timeout'), { mayHaveLanded: true }); };
    await expect(lost.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE)).rejects.toThrow('timeout');
    const stored = JSON.parse(lost.storage.map.values().next().value as string);
    expect(stored.at).toBe(CLOCK + 50_000);
    expect(lost.api.ownVaultFeeDue(vaultSnapshot(viewAt(BEFORE), { nowSec: (CLOCK + 100_000) / 1000 }))).toBe(AFTER_FEE);
    expect(lost.storage.map.size).toBe(1);
    expect(lost.api.ownVaultFeeDue(vaultSnapshot(viewAt(BEFORE), { nowSec: (CLOCK + 50_000 + 120_000) / 1000 }))).toBe(AFTER_FEE);
    expect(lost.api.ownVaultFeeDue(vaultSnapshot(viewAt(BEFORE), { nowSec: (CLOCK + 50_000 + 420_000) / 1000 })))
      .toBe(feeDueForStakedAtoms(BEFORE));
    const refused = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }) });
    refused.hooks.send = async () => { throw new Error('the wallet refused before broadcasting'); };
    await expect(refused.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE)).rejects.toThrow();
    expect((await refused.api.convVaultRouting()).feeDue, 'the safe direction: change comes home').toBe(AFTER_FEE);
  });

  it('DA2-09: a wallet that cannot pay for the exit is refused before anything is signed, and leaves no mark behind', async () => {
    at(CLOCK);
    const f = funnels({ snapshot: vaultSnapshot(viewAt(BEFORE), { nowSec: CLOCK / 1000 }) });
    f.hooks.balance = 50_000_000n;
    await expect(f.api.broadcastOwnVaultExit([{ to: 'VAULT', amount: '80000000' }], AFTER_FEE, 'withdraw stake')).rejects.toThrow('short');
    expect(f.sent).toHaveLength(0);
    expect(f.storage.map.size, 'no mark').toBe(0);
    expect((await f.api.convVaultRouting()).feeDue).toBe(feeDueForStakedAtoms(BEFORE));
  });

  it('DA2-08: wiring — both exits broadcast under the mark, every money funnel takes its fee through ownVaultFeeDue, the refresh settles it', () => {
    const unstake = code(fn('async function submitUnstakeAth('));
    expect(unstake).toContain("await broadcastOwnVaultExit(plan.messages, unpriced.remainingFeeDue, 'withdraw stake', { signer: requireSameWallet(signer) });");
    expect(unstake, 'no second, unmarked broadcast').not.toContain('sendPlathoWalletTransaction(');
    const recover = code(fn('async function submitRecoverAth('));
    expect(recover).toContain("await broadcastOwnVaultExit(priced.messages, FV_PROTOCOL_FEE, 'recover ATH', { signer: requireSameWallet(signer) });");
    expect(recover).not.toContain('sendPlathoWalletTransaction(');
    for (const name of ['async function convVaultRouting(', 'async function publicPublishRouting(', 'function composerVaultTerms(',
      'function composerPublicRoutes(']) {
      const body = code(fn(name));
      expect(body, `${name} reads the discount past the exit mark`).not.toMatch(/\b(snapshot|mine)\.feeDue\b/);
      expect(body, `${name} takes the fee through ownVaultFeeDue`).toContain('ownVaultFeeDue(');
    }
    expect(code(fn('function composerConvMessageQuoteNanotons('))).toContain('const terms = composerVaultTerms();');
    const refresh = code(fn('async function refreshFeeVaultState('));
    expect(refresh.indexOf('settleOwnVaultExit();')).toBeGreaterThan(refresh.indexOf('feeVaultState = { wallet, address, snapshot, realAtoms };'));
  });
});

describe('DA-3 — a vault dialog says what the send will ask the wallet for, from the send\'s own plan and pricer', () => {
  const VAULT_ADDRESS = '0:' + 'a1'.repeat(32);
  const OWNER = '0:' + 'b2'.repeat(32);
  const ATHW = '0:' + 'c3'.repeat(32);
  const CUSTODY = '0:' + 'd4'.repeat(32);
  const TODAY = {
    gas: { flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n },
    fwd: { lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n },
  };
  const HOT = { gas: { flatLimit: 100n, flatPrice: 6_667n * 6n, gasPrice: 4_369_067n * 6n }, fwd: TODAY.fwd };
  const RESERVE = 10_000_000n;
  const sum = (messages: any[]) => messages.reduce((total: bigint, m: any) => total + BigInt(m.amount), 0n);
  const liveAt = (staked: bigint, balance = FV_FLOAT_TOPUP_BELOW * 4n) => ({
    state: VAULT_LIVE, staked, pending: 0n, exitWindow: { open: false, exited: 0n, secondsLeft: 0 }, balance, feeDue: feeDueForStakedAtoms(staked),
  });

  function quotes({ custody = { status: 'active', balance: 80_000_000n } as any, prices = TODAY as any, reads = [] as string[] } = {}) {
    const env: Record<string, any> = {
      requirePlathoWalletAddress: () => OWNER,
      loadConnectedAthWalletAddress: async () => ATHW,
      vaultAddressFor: async () => VAULT_ADDRESS,
      resolveAthMasterProvider: async () => ({ getWalletAddress: async () => CUSTODY }),
      requireAthMasterAddress: () => 'MASTER',
      criticalChainReadOptions: () => ({}),
      publicAddrKey: (address: string) => address,
      withVaultReadLock: (task: any) => task(),
      createShardStatesRequest: () => ({}),
      readAccountStates: async () => {
        reads.push('custody');
        if (custody === 'throw') throw new Error('429');
        return custody === null ? new Map() : new Map([[CUSTODY, custody]]);
      },
      noteTonRpcRateLimit: () => true,
      readNetworkPrices: async () => { if (!prices) throw new Error('prices unread'); return prices; },
      readAthWalletFunding: async () => ({ ton: 0n, rentOwed: 0n }),
      athTransferTopUpPossible, planStake, priceVaultStake, priceVaultExit,
      FV_CUSTODY_TOPUP, FV_STAKE_MIN_ATH, FV_STAKE_MAX_ATH, FV_DEPLOY_FUNDING, FV_ATOMIC_PER_ATH,
      walletSendFeeReserveNanotons: () => RESERVE,
      t: (key: string) => `<${key}>`,
      formatGramNanotonsUp: (n: bigint) => String(n),
      balanceNeededText: (n: bigint) => `need ${n}`,
      CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 8_000,
    };
    const names = Object.keys(env);
    const stakedAt = app.indexOf('const stakedAthOf');
    const sources = [
      app.slice(stakedAt, app.indexOf('\n', stakedAt)),
      app.slice(app.indexOf('const ATH_WALLET_ADDRESS_FRESH_MS'), app.indexOf('function recentAthWalletAddress(')),
      fn('function recentAthWalletAddress('),
      fn('async function resolveVaultCustodyWallet('), fn('async function readVaultCustodyBalance('),
      fn('async function priceVaultExitForSend('), fn('async function priceVaultStakeForSend('), fn('function athUnpricedRefusal('),
      fn('async function quoteStakeGram('), fn('async function quoteExitGram('), fn('function vaultGramRows('),
    ];
    // eslint-disable-next-line no-new-func
    return new Function(...names, `${sources.join('\n')}\nreturn { quoteStakeGram, quoteExitGram, vaultGramRows };`)(...names.map((n) => env[n]));
  }

  it('DA3-01: a LIVE vault whose custody wallet runs low — the top-up the plan sends is named, and the hold is the plan\'s own sum', async () => {
    const q = quotes({ custody: { status: 'active', balance: 10_000_000n } });
    const gram = await q.quoteStakeGram(liveAt(ath(500n)));
    expect(gram.kept, 'the custody wallet\'s rent top-up, which used to ride unnamed').toBe(FV_CUSTODY_TOPUP);
    const plan = planStake({ ownerWallet: OWNER, vaultAddress: VAULT_ADDRESS, athWalletAddress: ATHW, ath: '2500', snapshot: liveAt(ath(500n)),
      custodyWallet: CUSTODY, custodyBalance: 10_000_000n });
    expect(gram.need).toBe(sum(priceVaultStake(plan, { prices: TODAY }).messages) + RESERVE);
    expect(q.vaultGramRows({ state: 'ready', gram }, '<profile.vaultTopUpKept>')).toEqual([
      { label: '<profile.vaultTopUpKept>', value: `${FV_CUSTODY_TOPUP} GRAM` },
      { label: '<common.balanceNeeded>', value: `need ${gram.need}` },
    ]);
  });

  it('DA3-02: a healthy LIVE vault keeps nothing back — only the hold, which comes home but for the gas', async () => {
    const q = quotes();
    const gram = await q.quoteStakeGram(liveAt(ath(500n)));
    expect(gram.kept).toBe(0n);
    expect(q.vaultGramRows({ state: 'ready', gram }, 'kept').map((row: any) => row.label)).toEqual(['<common.balanceNeeded>']);
  });

  it('DA3-03: a first stake keeps the vault\'s float and the custody wallet\'s top-up; an unread custody wallet is not a low one', async () => {
    const absent = { state: VAULT_ABSENT, staked: 0n, pending: 0n, exitWindow: { open: false, exited: 0n, secondsLeft: 0 }, balance: 0n };
    expect((await quotes({ custody: null }).quoteStakeGram(absent)).kept).toBe(FV_DEPLOY_FUNDING + FV_CUSTODY_TOPUP);
    expect((await quotes({ custody: 'throw' }).quoteStakeGram(absent)).kept, 'the most the press may sign')
      .toBe(FV_DEPLOY_FUNDING + FV_CUSTODY_TOPUP);
  });

  it('DA3-04: at the cap there is nothing to quote; a price that cannot be read rejects, and the dialog keeps what it knows', async () => {
    const reads: string[] = [];
    expect(await quotes({ reads }).quoteStakeGram(liveAt(ath(10_000n)))).toBeNull();
    expect(reads, 'and it costs no read to say so').toEqual([]);
    await expect(quotes({ prices: null }).quoteStakeGram(liveAt(ath(500n)))).rejects.toBeTruthy();
  });

  it('DA3-05: an exit\'s quote is the exit\'s own: at today\'s prices the hold alone, at 6x gas custody\'s top-up named too', async () => {
    const probe = planUnstake({ vaultAddress: VAULT_ADDRESS, ath: 1n, snapshot: liveAt(ath(500n)) });
    const today = await quotes().quoteExitGram(probe, VAULT_ADDRESS);
    expect(today.kept).toBe(0n);
    expect(today.need).toBe(sum(priceVaultExit(probe, { prices: TODAY }).messages) + RESERVE);
    const hot = await quotes({ prices: HOT }).quoteExitGram(probe, VAULT_ADDRESS);
    expect(hot.kept).toBeGreaterThan(0n);
    expect(hot.need).toBeGreaterThan(today.need);
    const plan = planStake({ ownerWallet: OWNER, vaultAddress: VAULT_ADDRESS, athWalletAddress: ATHW, ath: '1', snapshot: liveAt(ath(500n)),
      custodyWallet: CUSTODY, custodyBalance: 80_000_000n });
    const ownerTopUp = priceVaultStake(plan, { prices: HOT, athWalletTon: 0n }).ownerTopUp;
    expect(ownerTopUp).toBeGreaterThan(0n);
    expect((await quotes({ prices: HOT }).quoteStakeGram(liveAt(ath(500n)))).kept).toBe(ownerTopUp);
  });

  it('DA3-06: wiring — the stake reads custody through the shared reader, all three vault dialogs show the rows, the unstake quotes the take', () => {
    const stake = code(fn('async function submitStakeAth('));
    expect(stake).toContain('const { custodyWallet, custodyBalance } = await readVaultCustodyBalance(vaultAddress);');
    const stakeDialog = code(fn('async function openStakeAthDialog('));
    expect(stakeDialog).toContain('quoteStakeGram(snapshot)');
    expect(stakeDialog).toContain("const quote = vaultGramQuote(quoteStakeGram(snapshot), 'stake');");
    expect(stakeDialog).toContain("const keptLabel = t(snapshot?.state === VAULT_LIVE ? 'profile.vaultTopUpKept' : 'profile.stakeSummarySetup');");
    expect(stakeDialog).toContain('...vaultGramRows(quote, keptLabel, { keptBefore }),');
    const unstakeDialog = code(fn('async function openUnstakeAthDialog('));
    expect(unstakeDialog).toContain('quoteExitGram(planUnstake({ vaultAddress: feeVaultState.address, ath: 1n, snapshot }), feeVaultState.address)');
    expect(unstakeDialog).toContain("...vaultGramRows(quote, t('profile.vaultTopUpKept'), { intoVault: true }),");
    expect(unstakeDialog, 'the fee row says what the vault books, as the stake dialog does')
      .toContain('formatGramNanotonsUp(vaultTakeFor(plan.ok ? plan.remainingFeeDue : snapshot.feeDue))');
    const recoverDialog = code(fn('async function openRecoverAthDialog('));
    expect(recoverDialog).toContain('quoteExitGram(plan, feeVaultState.address)');
    expect(recoverDialog).toContain("...vaultGramRows(quote, t('profile.vaultTopUpKept'), { intoVault: true }),");
  });
});
