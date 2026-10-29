import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import {
  FV_MSG_FORWARD_PRICES, FV_PROTOCOL_FEE, FV_PUBLIC_SHARD_PUBLISH_GAS_MAX, FV_REFERENCE_GAS_PRICES, networkPricesWithin,
  publicPublishRoute, scaleByNetworkPrices, vaultInternalPublishValue,
} from '../web/fee-vault.mjs';
import { athRequestTopUpNanotons, parseForwardPrices, parseGasPrices } from '../web/ath-request-reserve.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { createOwnReactionStore } from '../web/public-reactions.mjs';
import { GROUP_MAX_CANDIDATES, declineGroupCandidate, noteGroupCandidate, groupCandidatesWaiting } from '../web/group-store.mjs';
import { VAULT_LIVE } from '../web/vault-account.mjs';
import { WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS } from '../web/wallet-send-fee.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (declaration: string) => sourceBlock(app, declaration);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf('\n', at)); };
const tKey = (key: string, params?: any) => (params ? `${key}|${JSON.stringify(params, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}` : key);
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
const today = { gas: { ...FV_REFERENCE_GAS_PRICES }, fwd: { ...FV_MSG_FORWARD_PRICES } };
const scaled = (k: bigint, kf = k) => ({
  gas: { ...FV_REFERENCE_GAS_PRICES, flatPrice: FV_REFERENCE_GAS_PRICES.flatPrice * k, gasPrice: FV_REFERENCE_GAS_PRICES.gasPrice * k },
  fwd: { lump: FV_MSG_FORWARD_PRICES.lump * kf, bit: FV_MSG_FORWARD_PRICES.bit * kf, cell: FV_MSG_FORWARD_PRICES.cell * kf },
});
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    map,
  };
}

describe('R11 money — every figure is the network\'s', () => {
  it('R11-M1: the wallet\'s send reserve follows the tables held — the dearest ratio, never below the measurement', () => {
    const reserve = (prices: any) => lift({
      walletSendFeeNanotons: () => 13_220_000n, hasActivePlathoAccount: () => true, WALLET_SEND_FIRST_EXTERNAL_EXTRA_NANOTONS,
      scaleByNetworkPrices, networkPricesCache: prices ? { at: 0, prices } : null,
    }, [line('const WALLET_FEE_HEADROOM_NANOTONS'), fn('function walletSendFeeReserveNanotons(')], 'walletSendFeeReserveNanotons');
    expect(reserve(null)([1])).toBe(13_220_000n);
    expect(reserve(today)([1]), 'today: the measurement').toBe(13_220_000n);
    expect(reserve(scaled(2n))([1]), '2x: twice').toBe(26_440_000n);
    expect(reserve(scaled(1n, 3n))([1]), 'forwarding alone at 3x: the dearest ratio').toBe(39_660_000n);
  });

  it('R11-M3: past the flip the private send asserts what it sends, not the generation-17 budget; before it, the budget', () => {
    const send = code(fn('async function attemptConvMessagePublishDirect('));
    expect(send).toContain('if (!throughVault) await assertWalletGramAtLeast(convNeed, \'send\');');
    expect(send).toContain('const reserveClasses = [...(routing.deployVault ? [1] : []), ...sendClasses];');
    expect(send).toContain("? { assertSent: (sent) => assertWalletGramAtLeast(sent + walletSendFeeReserveNanotons(reserveClasses), 'send'), onSigned: keepSigned }");
    expect(send).toContain(": { assertAffordable: (extra) => assertWalletGramAtLeast(convNeed + extra, 'send'), onSigned: keepSigned });");
    const funnel = code(readFileSync('web/conv-lane-send.mjs', 'utf8'));
    expect(funnel).toContain('await assertSent(prepared.reduce((sum, item) => sum + BigInt(item?.message?.amount ?? 0), 0n) + BigInt(deploy?.amount ?? 0));');
    expect(funnel).toContain('const { parts, deploy, result } = await publishConvLaneParts({ wallet, transport, vaultAddress, feeDue, deployVault, prices }, [part], options);');
  });

  it('R11-M4: a public part the vault door carries holds what that door attaches above the direct one', () => {
    const nowUnix = 1_792_000_000;
    const extra = (routes: string[]) => lift({
      composerPublicRoutes: () => ({ routes, feeDue: FV_PROTOCOL_FEE }), publicPublishValueForKind, composerNetworkPrices: () => null,
      publicEpochTag: () => 0n, publicEraOf: () => 0, publicShardCodeCellFor: () => null, publicShardDataCellFor: () => null,
      vaultInternalPublishValue, FV_PUBLIC_SHARD_PUBLISH_GAS_MAX, publicDirectLiveExtraNanotons: () => 0n,
    }, [fn('function composerPublicRoutedHoldExtra(')], 'composerPublicRoutedHoldExtra')(0, [{ bytes: 200 }, { bytes: 200 }], false, 18, nowUnix);
    expect(extra(['direct', 'direct']), 'no vault part: nothing').toBe(0n);
    const direct = publicPublishValueForKind(0, 18);
    const attach = vaultInternalPublishValue({
      directValue: direct, capsuleBytes: BigInt(200 + 91 + 3 * Math.ceil(200 / 127)), feeDue: FV_PROTOCOL_FEE, stateInit: null, prices: null,
      shardGas: FV_PUBLIC_SHARD_PUBLISH_GAS_MAX,
    });
    expect(attach > direct, 'the case this gate is about: the door attaches more than the direct figure').toBe(true);
    expect(extra(['vault', 'direct']), 'the vault part alone, its difference whole').toBe(attach - direct);
    expect(code(fn('function publicComposerFinalCostLine('))).toContain('+ composerPublicRoutedHoldExtra(row.kind, row.routedParts, row.first, row.generation, row.nowUnix);');
  });

  it('R11-M5: the public door is chosen at the network\'s forward prices — a discount the dearer crossing eats goes direct', () => {
    const at = (prices: any) => publicPublishRoute({ kind: 0, capsuleBytes: 10_000n, feeDue: 0n, prices }).route;
    expect(at(null)).toBe('vault');
    expect(at(today), 'today: the same answer').toBe('vault');
    expect(at(scaled(1n, 3n)), 'forwarding at 3x: the crossing costs more than the discount saves').toBe('direct');
    expect(code(fn('function composerPublicRoutes('))).toContain('kind, feeDue, prices,');
    expect(code(readFileSync('web/public-lane-send.mjs', 'utf8'))).toContain('publicPublishRoute({ kind, capsuleBytes: bytes, feeDue, stateInit, prices });');
  });

  it('R11-M6: the subscriptions backup shows both figures and asks before it signs', () => {
    const save = code(fn('async function submitPrefsSnapshotDirect('));
    const asked = save.indexOf('const confirmed = await openActionDialog({');
    expect(asked).toBeGreaterThan(-1);
    expect(save.indexOf('const prefsCost = '), 'priced before it asks').toBeLessThan(asked);
    expect(save).toContain('hint: () => composerCostAndHoldLine({ cost: prefsCost, hold: prefsHold, parts: built.length }).text,');
    expect(save.indexOf("await assertWalletGramAtLeast(prefsHold, 'prefs snapshot');"), 'asserted after the yes').toBeGreaterThan(asked);
    expect(save.indexOf('sendPlathoWalletTransaction('), 'and signed after both').toBeGreaterThan(asked);
    expect(save).toContain("if (!confirmed || !stillOurs()) { setText(savePrefsStatus, t('wallet.statusNotSaved')); return; }");
  });

  it('R11-M7: founding a public group prices its FOUND row in the dialog that signs it; a private one writes nothing', () => {
    const create = code(fn('async function openCreateGroupDialog('));
    expect(create).toContain("const foundPrice = () => (wantPublic ? publicGroupControlPriceLine(PUBLIC_GROUP_KIND.FOUND, { name: '' }, null) : '');");
    expect(create).toContain('foundPrice()');
  });

  it('R11-M8: the mint and the avatar figures carry the top-up an empty ATH wallet would need at the held prices — none today', () => {
    const bound = (prices: any) => lift({
      athRequestTopUpNanotons, networkPricesCache: prices ? { prices } : null, REFERENCE_NETWORK_PRICES: today,
    }, [fn('function athRequestTopUpBoundNanotons(')], 'athRequestTopUpBoundNanotons');
    expect(bound(null)('mint')).toBe(0n);
    expect(bound(today)('avatar')).toBe(0n);
    expect(bound(scaled(7n))('avatar'), 'at 7x an empty wallet needs one').toBe(athRequestTopUpNanotons({ lane: 'avatar', prices: scaled(7n), walletTon: 0n, rentOwed: 0n }));
    expect(bound(scaled(7n))('avatar') > 0n).toBe(true);
    expect(code(fn('function estimatedProfileAvatarTonFeeNanotons('))).toContain("const topUp = athRequestTopUpBoundNanotons('avatar');");
  });
});

describe('R11 flip — the figures follow the switch at E', () => {
  it('R11-F1: an open dialog\'s function hint is asked again; an error waits unless the press forces it', () => {
    const hint = { textContent: 'old', hidden: false, dataset: { tone: 'muted' } as any };
    let summaries = 0;
    let generation = 17;
    const dialog: any = { hint: () => `priced at ${generation}`, tone: 'muted', validating: false, paintedGeneration: 17 };
    const repaint = lift({
      activeActionDialog: dialog, actionHint: hint, updateActiveActionSummary: () => { summaries += 1; }, writeGenerationNow: () => generation,
    }, [fn('function repaintActiveActionDialogPrices(')], 'repaintActiveActionDialogPrices');
    generation = 18;
    expect(repaint()).toBe(true);
    expect([hint.textContent, dialog.paintedGeneration, summaries]).toEqual(['priced at 18', 18, 1]);
    hint.dataset.tone = 'error';
    hint.textContent = 'a failure the person is reading';
    dialog.hintOverridden = true;
    expect(repaint(), 'an error on the line waits').toBe(false);
    expect(hint.textContent).toBe('a failure the person is reading');
    expect(repaint({ force: true }), 'the press forces it').toBe(true);
    expect([hint.textContent, hint.dataset.tone]).toEqual(['priced at 18', 'muted']);
    dialog.validating = true;
    expect(repaint({ force: true }), 'nothing while a write runs').toBe(false);
    const submit = code(app.slice(app.indexOf("actionForm?.addEventListener('submit'"), app.indexOf("document.addEventListener('click', (event) => {", app.indexOf("actionForm?.addEventListener('submit'"))));
    expect(submit).toContain('if (dialogAtStart.priced && dialogAtStart.paintedGeneration !== writeGenerationNow()) {');
    expect(submit.indexOf('repaintActiveActionDialogPrices({ force: true });')).toBeLessThan(submit.indexOf('const validate = dialogAtStart.validateSubmit;'));
    expect(code(fn('async function openActionDialog('))).toContain("priced: config.priced ?? typeof config.hint === 'function',");
  });

  it('R11-F2: at the change of generation the profile labels, the composer and the open dialog repaint — and a timer fires at E', () => {
    const calls: string[] = [];
    let generation = 17;
    const tick = lift({
      writeGenerationNow: () => generation, armGenerationBoundaryRepaint: () => calls.push('arm'),
      refreshProfileFeeLabels: () => { calls.push('labels'); return true; }, refreshComposerCostStatus: () => calls.push('composer'),
      repaintActiveActionDialogPrices: () => calls.push('dialog'), renderConversation: () => calls.push('conversation'), console: { warn: () => {} },
    }, [fn('function refreshFeeLabelsAcrossGenerations(')], 'refreshFeeLabelsAcrossGenerations', 'let feeLabelsGeneration = null; let profileFeeLabelsOwed = false;');
    tick();
    tick();
    expect(calls.filter((c) => c !== 'arm'), 'the same generation: nothing').toEqual([]);
    generation = 18;
    tick();
    expect(calls.filter((c) => c !== 'arm')).toEqual(['labels', 'composer', 'dialog', 'conversation']);
    const timers: number[] = [];
    const E_MS = 20730 * 86_400_000;
    const arm = (now: number) => {
      timers.length = 0;
      lift({ CUTOVER_EPOCH: 20730, window: { setTimeout: (_f: any, ms: number) => { timers.push(ms); return 1; } }, refreshFeeLabelsAcrossGenerations: () => {},
        globalThis: { crypto: { getRandomValues: (a: Uint32Array) => { a[0] = 0; return a; } } } },
        [line('const GENERATION_TIMER_MAX_MS'), line('const GENERATION_REPAINT_SPREAD_MS'), fn('function armGenerationBoundaryRepaint(')], 'armGenerationBoundaryRepaint', 'let generationBoundaryTimer = null;')(now);
      return [...timers];
    };
    expect(arm(E_MS - 10_000), 'ten seconds before E: armed for E').toEqual([10_250]);
    expect(arm(E_MS + 1), 'after E: nothing to arm').toEqual([]);
    expect(arm(E_MS - 3_000_000_000), 'beyond what a timer holds: a later tick arms it').toEqual([]);
  });

  it('R11-F3: a composer line priced before E refuses the press after it, repaints and keeps the draft', () => {
    let announced = 0;
    const moved = (painted: number | null, now: number) => lift({
      writeGenerationNow: () => now, announceComposerPricesMoved: () => { announced += 1; },
    }, [fn('function composerPricesMoved(')], 'composerPricesMoved')({ dataset: painted === null ? {} : { pricedGeneration: String(painted) } });
    expect(moved(18, 18)).toBe(false);
    expect(moved(null, 18), 'never painted: nothing to compare').toBe(false);
    expect(moved(17, 18)).toBe(true);
    expect(announced, 'the new figure is painted under the notice (announceComposerPricesMoved, round 12)').toBe(1);
    const submit = code(app.slice(app.indexOf("composer?.addEventListener('submit'"), app.indexOf("composer?.addEventListener('submit'") + 4000));
    expect(submit).toContain('if (composerPricesMoved(privateComposerCostStatus)) return;');
    expect(code(app.slice(app.indexOf("publicComposer?.addEventListener('submit'"), app.indexOf("publicComposer?.addEventListener('submit'") + 2500)))
      .toContain('if (composerPricesMoved(publicComposerCostStatus)) return;');
  });

  it('R11-F4: one deploy at a time — a second routing waits for the first one\'s send and rides the vault it leaves', async () => {
    const make = () => {
      const state: any = { feeVaultState: { wallet: 'W', address: 'V', snapshot: { state: 'absent' } } };
      const env: Record<string, any> = {
        vaultSupported: () => true, plathoWallet: { address: 'W' }, VAULT_LIVE, VAULT_ABSENT: 'absent', FV_PROTOCOL_FEE, FV_FLOAT_TOPUP_BELOW: 1n,
        VAULT_FROZEN: 'frozen', convVaultFrozenError: () => new Error('frozen'),
        vaultSnapshotOutdated: () => false, refreshFeeVaultState: async () => {}, convVaultStateUnknownError: () => new Error('unknown'),
        ownVaultFeeDue: () => 0n, vaultAddressFor: async () => 'V', messageNetworkPrices: async () => null, VAULT_DEPLOY_SETTLE_MS: 120_000,
        __state: state,
      };
      return lift(env, [
        'let feeVaultState = __state.feeVaultState;',
        fn('async function convVaultRouting('),
        app.slice(app.indexOf('const FEE_VAULT_DEPLOY_WAIT_MS'), app.indexOf('function openFeeVaultDeployFlight(')),
        fn('function openFeeVaultDeployFlight('), fn('function settleFeeVaultDeployFlight('), fn('async function feeVaultDeployCarriedElsewhere('),
        app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {'),
      ], '{ convVaultRouting, settleFeeVaultDeployFlight }');
    };
    const landed = make();
    const first = await landed.convVaultRouting();
    expect(first.deployVault, 'the first carries the deploy').toBe(true);
    const second = landed.convVaultRouting();
    landed.settleFeeVaultDeployFlight('W', true);
    expect((await second).deployVault, 'the second rides it').toBe(false);
    const refused = make();
    expect((await refused.convVaultRouting()).deployVault).toBe(true);
    const next = refused.convVaultRouting();
    refused.settleFeeVaultDeployFlight('W', false);
    expect((await next).deployVault, 'the first never left: the second deploys').toBe(true);
    expect(code(fn('function noteFeeVaultDeployed('))).toContain('settleFeeVaultDeployFlight(wallet, true, flight);');
    expect(code(fn('async function attemptConvMessagePublishDirect('))).toContain('else settleFeeVaultDeployFlight(signer?.address, false, routing.deployFlight);');
    expect(code(app)).toContain('else settleFeeVaultDeployFlight(wallet.address, false, route.deployFlight ?? null);');
  });

  it('R11-F5: before E a public post has one door and nothing is read for it; after E a read that hangs is waited for a bounded time', async () => {
    let reads = 0;
    const routing = (generation: number, refresh: () => Promise<any>, outdated: boolean) => lift({
      vaultSupported: () => true, plathoWallet: { address: 'W' }, writeGenerationNow: () => generation, VAULT_LIVE, VAULT_ABSENT: 'absent',
      VAULT_FROZEN: 'frozen',
      vaultSnapshotOutdated: () => outdated, refreshFeeVaultState: () => { reads += 1; return refresh(); }, PUBLIC_ROUTING_READ_DEADLINE_MS: 20,
      ownVaultFeeDue: () => 0n, messageNetworkPrices: async () => null, VAULT_UNKNOWN: 'unknown',
      __state: { wallet: 'W', address: 'V', snapshot: { state: VAULT_LIVE, feeDue: 0n } },
    }, ['let feeVaultState = __state;', line('const VAULT_ROUTING_FAILURE_MEMORY_MS'), 'let feeVaultRoutingRead = null;', 'let feeVaultRoutingFailedAt = 0;',
      fn('function readFeeVaultForRouting('), fn('async function boundedFeeVaultRoutingRead('), fn('async function publicPublishRouting(')], 'publicPublishRouting')();
    expect(await routing(17, async () => {}, false)).toEqual({});
    expect(reads, 'before E: not even asked').toBe(0);
    expect(await routing(18, () => new Promise(() => {}), true), 'an outdated read that never answers: the direct door').toEqual({});
    expect(reads).toBe(1);
    expect(await routing(18, async () => {}, false)).toEqual({ vaultAddress: 'V', feeDue: 0n, prices: null });
  });

  it('R11-F6: a read that ages is read again for the composer; the labels are not painted over a live status', () => {
    expect(code(fn('function composerVaultTerms('))).toContain("if (!mine || mine.state === VAULT_UNKNOWN || vaultSnapshotOutdated()) composerChainFact('vault', () => refreshFeeVaultState());");
    expect(code(fn('function composerConvMessageQuoteNanotons('))).toContain('const terms = composerVaultTerms();');
    const mint = { textContent: 'Minting…', dataset: { state: 'busy' } as any };
    const avatar = { textContent: '', dataset: {} as any };
    const labels = lift({
      profileCardMintNameStatus: mint, setAvatarStatus: avatar, t: tKey, formatTonNanotonsUp: String,
      estimatedUsernameMintTonFeeNanotons: () => 1n, profileAvatarFloorNanotons: () => 2n,
    }, [fn('function refreshProfileFeeLabels(')], 'refreshProfileFeeLabels');
    expect(labels({ overLiveStatus: false }), 'one label owed').toBe(false);
    expect(mint.textContent).toBe('Minting…');
    expect(avatar.textContent).toBe(tKey('avatar.setFee', { amount: '2' }));
    expect(labels(), 'boot and quick start paint over anything').toBe(true);
    expect(mint.textContent).toBe(tKey('username.mintFee', { amount: '1' }));
  });
});

describe('R11 delta — what the device remembers, and for whom', () => {
  const exitMarks = (storage: any) => lift({
    localStorage: storage, scopedStorageKey: (key: string) => `${key}:dep`, walletIndexedDbSuffix: (w: string) => String(w),
    FV_PROTOCOL_FEE, VAULT_LIVE, VAULT_DEPLOY_SETTLE_MS: 120_000, WALLET_EXTERNAL_VALIDITY_S: 300, Date, JSON, BigInt,
  }, [
    app.slice(app.indexOf('const OWN_VAULT_EXIT_SETTLE_MS'), app.indexOf('function ownVaultExitInFlight(')),
    fn('function ownVaultExitInFlight('), fn('function noteOwnVaultExit('), fn('function ownVaultExitReflectedBy('), fn('function ownVaultFeeDue('),
  ], '{ ownVaultExitInFlight, noteOwnVaultExit, ownVaultFeeDue, setWallet: (w) => { plathoWallet = { address: w }; }, setClearing: (v) => { plathoLocalDataClearing = v; } }',
  "let plathoWallet = { address: 'A' }; let plathoLocalDataClearing = false;");

  it('R11-D1: one exit mark per wallet, seen by every tab, and a mark this client could not have written is dropped', () => {
    const storage = memoryStorage();
    const tabOne = exitMarks(storage);
    tabOne.noteOwnVaultExit('A', 5_000_000n);
    tabOne.noteOwnVaultExit('B', 7_000_000n);
    expect(tabOne.ownVaultExitInFlight('A').feeDueAfter, 'wallet A keeps its own').toBe(5_000_000n);
    expect(tabOne.ownVaultExitInFlight('B').feeDueAfter).toBe(7_000_000n);
    const tabTwo = exitMarks(storage);
    expect(tabTwo.ownVaultFeeDue({ feeDue: 1_000_000n, nowSec: Math.floor(Date.now() / 1000) }), 'the open wallet is A').toBe(5_000_000n);
    storage.setItem('platho.vault.ownExit.v2:dep:A', JSON.stringify({ feeDueAfter: String(FV_PROTOCOL_FEE + 1n), at: Date.now() }));
    expect(tabTwo.ownVaultExitInFlight('A')).toBeNull();
    expect(storage.getItem('platho.vault.ownExit.v2:dep:A'), 'and removed').toBeNull();
    storage.setItem('platho.vault.ownExit.v2:dep:B', JSON.stringify({ feeDueAfter: '1', at: Date.now() + 3_600_000 }));
    expect(tabTwo.ownVaultExitInFlight('B')).toBeNull();
    tabTwo.setClearing(true);
    tabTwo.noteOwnVaultExit('A', 5_000_000n);
    expect(storage.getItem('platho.vault.ownExit.v2:dep:A')).toBeNull();
  });

  it('R11-D2: a declined request is never what the cap evicts; only a door of nothing but declined rows gives one up', () => {
    const key = (n: number) => { const k = new Uint8Array(32); k[0] = n & 0xff; k[1] = n >> 8; k[31] = 1; return k; };
    let record: any = { members: [], candidates: [] };
    for (let n = 0; n < GROUP_MAX_CANDIDATES; n += 1) record = noteGroupCandidate(record, { groupKey: key(n) }, { at: n });
    record = declineGroupCandidate(record, key(0));
    record = noteGroupCandidate(record, { groupKey: key(9_000) }, { at: 9_000 });
    expect(record.candidates.length).toBe(GROUP_MAX_CANDIDATES);
    expect(record.candidates.some((c: any) => c.declined === true && c.groupKey[0] === 0 && c.groupKey[1] === 0), 'the declined row stays').toBe(true);
    expect(record.candidates.some((c: any) => c.groupKey[0] === 1 && c.groupKey[1] === 0), 'the oldest waiting one gave way').toBe(false);
    expect(groupCandidatesWaiting(noteGroupCandidate(record, { groupKey: key(0) }, { at: 9_001 })).length).toBe(GROUP_MAX_CANDIDATES - 1);
  });

  it('R11-D3: a group lane is priced as live only when a floor read proved it — this device\'s own count is no proof', () => {
    const shape = (proven: boolean) => lift({
      groupRuntimeInstance: { get: () => ({ id: 'g' }), laneProvenLive: () => proven },
      currentGroupEpoch: () => ({ epoch: 20800, generation: 2 }), currentEpochUtc: () => 20800, walletChainNowMs: () => Date.now(),
    }, [fn('function groupLaneShape(')], 'groupLaneShape', '')('g', 'daily');
    const withCount = (proven: boolean) => lift({
      groupRuntimeInstance: { get: () => ({ seqHighWater: { '20800.2': 2 } }), laneProvenLive: () => proven },
      currentGroupEpoch: () => ({ epoch: 20800, generation: 2 }), currentEpochUtc: () => 20800, walletChainNowMs: () => Date.now(),
    }, [fn('function groupLaneShape(')], 'groupLaneShape')('g', 'daily');
    expect(withCount(false), 'not proven: the dearer first write').toEqual({ first: true, recordIndex: 3 });
    expect(withCount(true)).toEqual({ first: false, recordIndex: 3 });
    expect(shape(true), 'nothing written: first whatever the proof').toEqual({ first: true, recordIndex: 1 });
    const runtime = code(readFileSync('web/group-runtime.mjs', 'utf8'));
    expect(runtime).toContain('proveLiveKey(state);');
    expect(runtime).toContain('laneProvenLive(groupId, lane = \'daily\') {');
  });

  it('R11-D4: the ATH wallets of two fixed addresses are read once a minute, not five times a stake; a failed read is not kept', async () => {
    let reads = 0;
    let now = 1_000_000;
    let fail = false;
    const memo = lift({ requireAthMasterAddress: () => 'M', Date: { now: () => now } }, [
      line('const ATH_WALLET_ADDRESS_FRESH_MS'), line('const recentAthWalletAddresses'), fn('function recentAthWalletAddress('),
    ], 'recentAthWalletAddress');
    const read = () => { reads += 1; return fail ? Promise.reject(new Error('429')) : Promise.resolve(`ath-${reads}`); };
    expect(await memo('owner', read)).toBe('ath-1');
    expect(await memo('owner', read)).toBe('ath-1');
    expect(reads).toBe(1);
    now += 61_000;
    expect(await memo('owner', read), 'a minute on: read fresh').toBe('ath-2');
    fail = true;
    now += 61_000;
    await expect(memo('owner', read)).rejects.toThrow('429');
    fail = false;
    expect(await memo('owner', read), 'the failure was not kept').toBe('ath-4');
  });

  it('R11-D5: a reaction is not reconciled while the wallet is locked, nor into another wallet\'s store', () => {
    const unsettled = new Map<string, any>([['k|1', { since: 0, shard: 's', target: '1', emoji: 1, floor: 3, wallet: 'B' }]]);
    let stores = 0;
    const reconcile = (wallet: string | null) => lift({
      plathoWallet: wallet ? { address: wallet } : null, reactionsUnsettled: unsettled, reactionKey: (s: string, t: string) => `${s}|${t}`,
      ownReactions: () => { stores += 1; return { settlePending() {}, forget() {} }; }, REACTION_SETTLE_MS: 120_000,
      showModerationStatus: () => { throw new Error('nothing to say'); }, t: tKey, Date,
    }, [fn('function reconcileUnsettledReactions(')], 'reconcileUnsettledReactions');
    const counters = [0, 0, 0];
    expect(reconcile(null)('s', '1', counters)).toBe(counters);
    expect(stores, 'locked: no store of no wallet is built').toBe(0);
    reconcile('A')('s', '1', counters);
    expect(unsettled.has('k|1'), "wallet B's press waits for wallet B").toBe(true);
  });

  it('R11-D6: a pending reaction row this store could not have written is dropped and the list written back clean', () => {
    const storage = memoryStorage();
    const key = 'platho.public.reactions.pending.v1:w';
    storage.setItem(key, JSON.stringify([
      ['0:aa|7|3', { since: 1, floor: 2 }],
      ['torn', { since: 1, floor: 2 }],
      ['0:aa|x|3', { since: 1, floor: 2 }],
      ['0:aa|7|16', { since: 1, floor: 2 }],
      ['0:aa|8|1', { since: Date.now() + 3_600_000, floor: 2 }],
      ['0:aa|9|1', { since: 1, floor: -1 }],
    ]));
    const store = createOwnReactionStore({ storage, wallet: 'w' });
    expect(store.pendingPresses()).toEqual([{ shard: '0:aa', target: '7', emoji: 3, since: 1, floor: 2 }]);
    expect(JSON.parse(storage.getItem(key)!)).toEqual([['0:aa|7|3', { since: 1, floor: 2 }]]);
    storage.setItem(key, '{not json');
    createOwnReactionStore({ storage, wallet: 'w' });
    expect(storage.getItem(key), 'an unreadable list is replaced by an empty one').toBe('[]');
  });

  it('R11-D7: after the device\'s data is cleared, a writer still in flight writes nothing', () => {
    const storage = memoryStorage();
    const latched = lift({ localStorageOrNull: () => storage }, [fn('function latchedLocalStorage(')], '{ latchedLocalStorage, raise: () => { plathoLocalDataClearing = true; } }',
      'let plathoLocalDataClearing = false;');
    const writer = latched.latchedLocalStorage();
    writer.setItem('a', '1');
    latched.raise();
    writer.setItem('b', '2');
    writer.removeItem('a');
    expect([...storage.map.entries()]).toEqual([['a', '1']]);
    expect(code(fn('async function clearPlathoLocalData('))).toContain('plathoLocalDataClearing = true;');
    expect(code(fn('function ownReactions('))).toContain('createOwnReactionStore({ storage: latchedLocalStorage(), wallet })');
  });
});

describe('R11 privacy and availability', () => {
  it('R11-P1: a price table more than ten times today\'s is refused like an unread one, and the refusal says the prices were not read', async () => {
    const config = (k: bigint) => {
      const prices = scaled(k);
      return { 21: prices.gas, 25: prices.fwd };
    };
    const read = (k: bigint) => lift({
      globalThis: { plathoTonRpcTransport: { getConfigParam: async (id: number) => (config(k) as any)[id] } },
      parseGasPrices: (x: any) => x, parseForwardPrices: (x: any) => x, networkPricesWithin, Date,
    }, [fn('async function readNetworkPrices('), fn('function networkPricesError('), fn('async function readNetworkPricesOnce(')],
    '{ readNetworkPrices, cache: () => networkPricesCache, failedAt: () => networkPricesFailedAt }',
    'let networkPricesCache = null; const NETWORK_PRICES_TTL_MS = 600000; const NETWORK_PRICES_PLAUSIBLE_RATIO = 10n; const networkPricesInFlight = new Map(); let networkPricesFailedAt = 0;');
    const fine = read(10n);
    expect(await fine.readNetworkPrices()).toEqual(scaled(10n));
    const absurd = read(11n);
    const refused = await absurd.readNetworkPrices().then(() => null, (error: any) => error);
    expect(refused?.code).toBe('NETWORK_PRICES_IMPLAUSIBLE');
    expect(absurd.cache(), 'never cached').toBeNull();
    expect(absurd.failedAt() > 0, 'remembered as a failure').toBe(true);
    const words = lift({ noteTonRpcRateLimit: () => true, t: tKey, console }, [fn('function athUnpricedRefusal(')], 'athUnpricedRefusal');
    expect(words(refused, 'x').message).toBe('wallet.pricesUnreadNothingSent');
    expect(words(new Error('429'), 'x').message).toBe('wallet.balanceUnreadNothingSent');
  });

  it('R11-P2: the counts are asked for every bar laid out, not the viewport\'s; a join link reads nothing before the yes', () => {
    const refresh = code(fn('function refreshReactionCounts('));
    expect(refresh).not.toContain('innerHeight');
    expect(refresh).toContain('for (; visited < bars.length && asked < REACTION_REFRESH_MAX_BARS; visited += 1) {');
    const join = code(fn('async function joinPublicGroup('));
    expect(join).toContain('const price = () => publicGroupControlPriceLine(PUBLIC_GROUP_KIND.JOIN, {}, null, { upTo: true });');
  });

  it('R11-P3: the network\'s prices are read once per tier at a time, and warmed at unlock', () => {
    const reader = code(fn('async function readNetworkPrices('));
    expect(reader).toContain("const tier = priority === 'critical' ? 'critical' : 'background';");
    expect(reader).toContain('networkPricesInFlight.set(tier, readNetworkPricesOnce(priority).finally(() => { networkPricesInFlight.delete(tier); }));');
    expect(code(app)).toContain("readNetworkPrices({ priority: 'background' }).catch(() => {});");
  });
});

describe('R11 ui — what the screen says', () => {
  it('R11-U1: a vault dialog\'s two rows stand from the first paint — reading, failed, nothing to quote, quoted', () => {
    const rows = lift({ t: tKey, formatGramNanotonsUp: String, balanceNeededText: (n: bigint) => `need ${n}` }, [fn('function vaultGramRows(')], 'vaultGramRows');
    expect(rows({ state: 'reading', gram: null }, 'kept', { keptBefore: 50n })).toEqual([
      { label: 'kept', value: '50 GRAM' }, { label: 'common.balanceNeeded', value: 'dialog.checking' },
    ]);
    expect(rows({ state: 'failed', gram: null }, 'kept')).toEqual([{ label: 'common.balanceNeeded', value: 'profile.vaultQuoteUnread' }]);
    expect(rows({ state: 'none', gram: null }, 'kept')).toEqual([]);
    expect(rows({ state: 'ready', gram: { kept: 7n, need: 90n } }, 'kept')).toEqual([
      { label: 'kept', value: '7 GRAM' }, { label: 'common.balanceNeeded', value: 'need 90' },
    ]);
    expect(code(fn('async function openStakeAthDialog('))).toContain("const keptLabel = t(snapshot?.state === VAULT_LIVE ? 'profile.vaultTopUpKept' : 'profile.stakeSummarySetup');");
  });

  it('R11-U2: a control write that is refused for a reason the person can act on says that reason', () => {
    expect(code(fn('async function runGroupControlDialog('))).toContain('|| groupWriteRefusalText(error) };');
    expect(code(fn('function groupWriteRefusalText('))).toContain("return vaultSendErrorSaysWhatToDo(error) ? error.message : t(fallbackKey);");
  });

  it('R11-U5: the reaction picker says which emoji is chosen, sends nothing until one is, and its button is a verb', () => {
    const picker = code(fn('async function openReactionPicker('));
    expect(picker).toContain("cell.setAttribute('aria-pressed', index === chosen ? 'true' : 'false');");
    expect(picker).toContain('fields: [{ type: \'custom\', render: () => { setActiveActionSubmitEnabled(chosen !== null); return grid; } }],');
    expect(picker).toContain("submitLabel: t('public.reactSubmit'),");
    for (const [locale, strings] of Object.entries(I18N_STRINGS as Record<string, any>)) expect(strings['public.reactSubmit'], locale).toBeTruthy();
    expect(I18N_STRINGS.ru['public.reactSubmit']).not.toBe(I18N_STRINGS.ru['public.react']);
  });

  it('R11-U7: the words — a balance said as one, the unit after what is there, one phrase for the change in Russian, the vault strings with their accents', () => {
    for (const [locale, strings] of Object.entries(I18N_STRINGS as Record<string, any>)) {
      expect(strings['composer.needHoldStatus'], locale).toContain('{available} GRAM');
      expect(strings['common.balanceNeededShort'], locale).toContain('{available} GRAM');
      expect(strings['composer.needHoldStatusUpTo'], locale).toContain('{cost}');
      expect(strings['group.removeConfirmCut'], locale).toBeTruthy();
      expect(strings['group.removeConfirmKeep'], locale).toBeTruthy();
    }
    expect(I18N_STRINGS.en['avatar.setFee']).toContain('needed on the balance');
    expect(I18N_STRINGS.ru['common.balanceNeededValue']).toContain('\u043b\u0438\u0448\u043d\u0435\u0435 \u0432\u0435\u0440\u043d\u0451\u0442\u0441\u044f');
    expect(I18N_STRINGS.ja['group.decline']).toBe('拒否する');
    const unaccented: Record<string, RegExp> = {
      fr: /\b(depot|depose|deposes|apres|reseau|recuperer|liberer|reessayez|envoye|echec)\b|non comptes?\b/,
      es: /\b(comision|minimo|maximo|despues|actualizacion|boveda|liquido|estan|aun)\b|\bCuanto\b/,
      pt: /\b(minimo|maximo|voce|atualizacao|nao|apos|emergencia)\b/,
      de: /(Gebuehr|noetig|oeffnet|laeuft|kuerzlich|gezaehlt|zurueck)/,
    };
    for (const [locale, pattern] of Object.entries(unaccented)) {
      const vault = Object.entries((I18N_STRINGS as any)[locale]).filter(([key]) => /^profile\.(feeDiscount|stake|unstake|recover)/.test(key));
      expect(vault.filter(([, value]) => pattern.test(String(value))).map(([key]) => key), `${locale}: the vault strings keep their accents`).toEqual([]);
    }
  });

  it('R11-U9: a hint\'s sentences join as their language joins them, and a bound short of the balance keeps its "up to"', () => {
    const join = lift({}, [fn('function joinHintSentences(')], 'joinHintSentences');
    expect(join('Rename the group.', 'Cost 0.02 GRAM')).toBe('Rename the group. Cost 0.02 GRAM');
    expect(join('グループ名を変更します。', '費用 0.02 GRAM')).toBe('グループ名を変更します。費用 0.02 GRAM');
    expect(join('改名。', '', null, '费用')).toBe('改名。费用');
    const line = lift({
      t: tKey, formatTonNanotonsUp: String, formatTonNanotons: String, vaultPocketState: { wallet: { ton_balance: 5n } },
    }, [fn('function composerCostAndHoldLine(')], 'composerCostAndHoldLine');
    expect(line({ cost: 7n, hold: 10n, upTo: true }).text.startsWith('composer.needHoldStatusUpTo')).toBe(true);
    expect(line({ cost: 7n, hold: 10n }).text.startsWith('composer.needHoldStatus|')).toBe(true);
    expect(code(app)).toContain("hint: () => joinHintSentences(t(result.cutReading === true ? 'group.removeConfirmCut' : 'group.removeConfirmKeep'),");
  });

  it('R11-U10: the RPC key field has a label of its own and a placeholder that fits', () => {
    expect(html).toContain('<label class="rpc-key-label" for="toncenterApiKeyInput" data-i18n="profile.rpcKey">Key</label>');
    expect(html).toContain('data-i18n-placeholder="profile.rpcKeyPlaceholderShort"');
    for (const [locale, strings] of Object.entries(I18N_STRINGS as Record<string, any>)) {
      expect(String(strings['profile.rpcKeyPlaceholderShort']).length, locale).toBeLessThanOrEqual(20);
    }
  });

  it('R11-F7: no comment still calls the flip dormant or the boundary null', () => {
    expect(app).not.toContain('Dormant while CUTOVER_EPOCH is null');
    expect(readFileSync('web/platho-wallet.mjs', 'utf8')).not.toContain('Dormant while CUTOVER_EPOCH is null');
    expect(readFileSync('web/intro-cursor-store.mjs', 'utf8')).not.toContain('a module constant that is null today');
  });
});
