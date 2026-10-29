import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  FINAL_COST_DEPTH_GAS, FINAL_COST_REFERENCE_PRICES, FINAL_COST_TABLE, avatarRequestFinalCost, convMessageFinalCost, finalCostDepthLevels,
  introFinalCost, publicPostFinalCost, recoveryWriteFinalCost, settleFinalCostSplit, walletOnceFinalCost,
} from '../web/publish-final-cost.mjs';
import { CUTOVER_EPOCH, currentEpochUtc, generationForUnixSeconds } from '../web/cutover-epoch.mjs';
import {
  DIRECT_WRITE_GAS_MAX, FV_DEPLOY_FUNDING, FV_FLOAT_TOPUP_BELOW, FV_PROTOCOL_FEE, FV_PUBLIC_SHARD_PUBLISH_GAS_MAX, directWriteLiveSurchargeNanotons,
  publicPublishRoute, vaultInternalPublishValue,
} from '../web/fee-vault.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { groupCapsulePlan } from '../web/group-protocol.mjs';
import { VAULT_ABSENT, VAULT_LIVE, VAULT_UNKNOWN } from '../web/vault-account.mjs';
import { conversationId } from '../web/conv-key-store.mjs';
import { partitionRecoveryMap, recoverySlotForConversation } from '../web/recovery-lane.mjs';
import { currentGroupEpoch } from '../web/group-store.mjs';
import { publicEpochTag, publicEraOf } from '../web/shard-discovery.mjs';
import { publicShardCodeCellFor, publicShardDataCellFor } from '../web/shard-address.mjs';


const E = CUTOVER_EPOCH * 86_400;
afterEach(() => { vi.useRealTimers(); });

describe('FCOST — the table and its arithmetic', () => {
  it('FCOST-01: the measured figures come back at mainnet prices, and a repricing moves only its own part', () => {
    expect(convMessageFinalCost({ generation: 18 }).cost).toBe(17_352_074n);
    expect(convMessageFinalCost({ generation: 18, first: true }).cost).toBe(23_329_942n);
    expect(convMessageFinalCost({ generation: 17 }).cost).toBe(18_801_673n);
    expect(convMessageFinalCost({ generation: 17, first: true }).cost).toBe(22_232_940n);
    expect(introFinalCost({ generation: 18, born: false })).toBe(17_934_473n);
    expect(introFinalCost({ generation: 18, born: true })).toBe(20_366_273n);
    expect(publicPostFinalCost({ generation: 18, parts: [{ bytes: 195 }] })).toBe(13_439_540n);
    const [fixed, gas, forward] = FINAL_COST_TABLE['conv18.ordinary.c1'];
    expect(fixed + gas + forward).toBe(17_352_074n);
    const doubled = { gas: { gasPrice: FINAL_COST_REFERENCE_PRICES.gasPrice * 2n }, fwd: { bit: FINAL_COST_REFERENCE_PRICES.bit } };
    expect(convMessageFinalCost({ generation: 18, prices: doubled }).cost - 17_352_074n).toBe(gas);
    expect(settleFinalCostSplit([1n, 1n, 1n], null)).toBe(3n);
    expect(() => convMessageFinalCost({ generation: 16 })).toThrow(RangeError);
    expect(() => convMessageFinalCost({ generation: 18, sizeClasses: [3] })).toThrow(RangeError);
  });

  it('FCOST-02: a stake takes its discount off every part, the n-th record walks deeper, parts share what they share', () => {
    expect(convMessageFinalCost({ generation: 18, feeDue: 5_000_000n }).cost).toBe(12_352_074n);
    expect(convMessageFinalCost({ generation: 18, feeDue: 0n }).cost).toBe(17_352_074n - 10_002_000n);
    expect(convMessageFinalCost({ generation: 18, sizeClasses: [1, 1], feeDue: 0n }).cost)
      .toBe(convMessageFinalCost({ generation: 18, sizeClasses: [1, 1] }).cost - 2n * 10_002_000n);
    expect(convMessageFinalCost({ generation: 17, feeDue: 0n }).cost).toBe(18_801_673n);
    expect(finalCostDepthLevels(2)).toBe(0n);
    expect(finalCostDepthLevels(8)).toBe(2n);
    expect(finalCostDepthLevels(9)).toBe(0n);
    expect(finalCostDepthLevels(256)).toBe(7n);
    expect(convMessageFinalCost({ generation: 18, recordIndex: 8 }).cost).toBe(17_352_074n + 2n * FINAL_COST_DEPTH_GAS);
    expect(convMessageFinalCost({ generation: 18, sizeClasses: [1, 1] }).cost).toBe(34_321_346n);
    const mixed = convMessageFinalCost({ generation: 18, sizeClasses: [1, 2] }).cost;
    const same = convMessageFinalCost({ generation: 18, sizeClasses: [1, 1] }).cost;
    expect(mixed - same - (convMessageFinalCost({ generation: 18, sizeClasses: [2] }).cost - 17_352_074n)).toBe(28_000n);
    const firstEver = convMessageFinalCost({ generation: 18, first: true, vaultDeposit: true });
    expect(firstEver.deposit).toBe(49_999_999n);
    expect(firstEver.cost + firstEver.deposit).toBe(76_248_409n);
  });

  it('FCOST-10: an avatar is its image parts — the first carrying the halves of the year-era shard — and its registry request', () => {
    expect(avatarRequestFinalCost()).toBe(52_482_550n);
    const parts = [{ bytes: 16_000 }, { bytes: 16_000 }];
    const born = publicPostFinalCost({ generation: 18, kind: 3, parts, first: true });
    const live = publicPostFinalCost({ generation: 18, kind: 3, parts, halves: true });
    const plain = publicPostFinalCost({ generation: 18, kind: 3, parts });
    expect(born > live && live > plain, 'creating the shard > carrying its halves > neither').toBe(true);
    const once = avatarRequestFinalCost() - avatarRequestFinalCost({ withParts: true });
    expect(once > 300_000n && once < 400_000n, `the wallet once per transfer: ${once}`).toBe(true);
    expect(() => publicPostFinalCost({ generation: 18, kind: 4 })).toThrow(RangeError);
  });

  it('FCOST-03: a recovery slot costs its fee and its year only when it is created', () => {
    expect(recoveryWriteFinalCost({ newSlot: true, conversations: 1 })).toBe(34_009_206n);
    expect(recoveryWriteFinalCost({ newSlot: false, conversations: 1 })).toBe(3_512_139n);
    expect(recoveryWriteFinalCost({ newSlot: false, conversations: 20 })).toBe(12_629_473n);
    const byBytes = recoveryWriteFinalCost({ newSlot: false, blobBytes: 3570 });
    expect(byBytes).toBe(recoveryWriteFinalCost({ newSlot: false, conversations: 8 }));
  });
});

const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  if (app.indexOf(declaration, at + 1) >= 0) throw new Error(`${declaration} is not unique`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
function appFunctions(env: Record<string, any>, sources: string[], exported: string) {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
}
const up4 = (n: bigint) => { const q = (n + 99_999n) / 100_000n; return `${q / 10_000n}.${String(q % 10_000n).padStart(4, '0')}`; };
const down4 = (n: bigint) => { const q = n / 100_000n; return `${q / 10_000n}.${String(q % 10_000n).padStart(4, '0')}`; };
const t = (key: string, params: Record<string, any> = {}) => (key === 'composer.costFinal' ? `Cost ${params.cost} GRAM${params.setup} · sending needs ${params.hold}, the rest comes back`
  : key === 'composer.vaultSetupSuffix' ? ` + ${params.amount} GRAM: ${params.label}`
  : key === 'composer.needHoldStatus' ? `Cost ${params.cost} GRAM${params.setup} · sending needs ${params.hold}, you have ${params.available}`
  : key === 'composer.costStatus' ? `Cost up to ${params.cost} GRAM${params.surcharge} · sending needs ${params.hold}, the rest comes back` : key);
const costLine = (cost: string, hold = '0.0300') => `Cost ${cost} GRAM · sending needs ${hold}, the rest comes back`;

const SELF = new Uint8Array(32).fill(0x11);
const RESERVE_BASE = 5_000_000n;
const PEER = new Uint8Array(32).fill(0x22);

function composer(facts: Record<string, any> = {}) {
  const chainFacts = facts.chainFacts ?? {};
  const env: Record<string, any> = {
    t, formatTonNanotonsUp: up4, formatTonNanotons: down4,
    vaultPocketState: { wallet: { ton_balance: facts.balance ?? 10_000_000_000n } },
    composerEstimatedNetCostNanotons: (_profile: any, _parts: any, { afterDeploy = false } = {}) => (facts.hold ?? 30_000_000n)
      - (afterDeploy && facts.vault?.snapshot?.state === VAULT_ABSENT ? FV_DEPLOY_FUNDING : 0n),
    privateComposerPublishProfilesForPlan: (plan: any) => plan,
    publicComposerPublishProfilesForPlan: (plan: any) => plan,
    privateFirstContactExtraNanotons: () => 0n,
    isGroupThread: (thread: any) => thread?.group === true,
    groupIdOfThread: (thread: any) => thread?.groupId ?? null,
    groupRuntimeInstance: { get: (id: string) => facts.groups?.[id] ?? null, avatarPlan: () => facts.avatarPlan ?? null,
      laneProvenLive: () => facts.provenLive !== false },
    publicGroupRuntimeInstance: facts.publicGroups ? { get: (id: string) => facts.publicGroups[id] ?? null } : null, FV_DEPLOY_FUNDING,
    publicGroupChatUid: () => 9n, publicGroupDocumentBlocks: (blocks: any[]) => blocks,
    encodeMessageDocumentBlocks: (blocks: any[]) => new Uint8Array(blocks.reduce((sum: number, b: any) => sum + (b.bytes?.length ?? 0), 0)),
    publicSendPlanFromDocumentBytes: (bytes: Uint8Array) => [{ bytes }],
    publicGroupChargeFor: () => ({ nanotons: facts.publicHold ?? 25_000_000n, parts: 1 }),
    currentGroupEpoch, generationForUnixSeconds, currentEpochUtc, convMessageFinalCost, introFinalCost,
    chainNowSec: () => Math.floor(Date.now() / 1000), walletChainNowMs: () => Date.now(),
    publicPostFinalCost, recoveryWriteFinalCost, recoverySlotForConversation, conversationId, partitionRecoveryMap,
    publicPublishRoute, publicEpochTag, publicEraOf, publicShardCodeCellFor, publicShardDataCellFor,
    vaultInternalPublishValue, FV_PUBLIC_SHARD_PUBLISH_GAS_MAX, publicPublishValueForKind,
    composerNetworkPrices: () => null,
    directWriteLiveSurchargeNanotons, DIRECT_WRITE_GAS_MAX,
    walletSendFeeReserveNanotons: (classes: number[]) => RESERVE_BASE + 1_000_000n * BigInt(classes.length), walletOnceFinalCost,
    composerChainFact: (key: string) => chainFacts[key] ?? chainFacts[key.split(':')[0]],
    refreshFeeVaultState: async () => {},
    convBucketSeqHighWater: () => facts.highWater ?? -1,
    localRecipientKeyPair: { keyId: SELF },
    convKeyStore: {
      getConversation: () => facts.rec ?? null,
      snapshot: () => facts.map ?? new Map(),
    },
    feeVaultState: facts.vault ?? { wallet: 'W', snapshot: { state: VAULT_LIVE, feeDue: FV_PROTOCOL_FEE, balance: FV_FLOAT_TOPUP_BELOW * 2n }, address: 'V' },
    plathoWallet: { address: 'W' }, VAULT_LIVE, FV_PROTOCOL_FEE, FV_FLOAT_TOPUP_BELOW,
    VAULT_UNKNOWN, rememberedVaultReading: null,
    vaultSupported: () => true, publicCommentTarget: facts.commentTarget ?? null, COMPOSER_INTRO_FACT_TTL_MS: 600_000,
    publicWalletHash: () => 'h', publicChannelPartitionKey: async () => 0n, publicThreadPartitionKey: async () => 0n,
    resolvePublicWriteShard: async () => ({ seq: 0, live: false }), directPublicLaneReader: () => ({}),
    publicPostChainCoordinates: () => null, publicPostUid: async () => 0n, outgoingRecordShard: async () => ({}),
    createRecordShardLastSeqReader: () => async () => 0, globalThis: {},
    VAULT_DEPLOY_SETTLE_MS: 120_000, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    scopedStorageKey: (key: string) => key,
    WALLET_EXTERNAL_VALIDITY_S: 300, walletIndexedDbSuffix: (address: string) => String(address), plathoLocalDataClearing: false,
    vaultSnapshotOutdated: () => false,
  };
  return appFunctions(env, [
    app.slice(app.indexOf('const OWN_VAULT_EXIT_SETTLE_MS'), app.indexOf('function ownVaultExitInFlight(')),
    fn('function ownVaultExitInFlight('), fn('function ownVaultFeeDue('),
    fn('function composerCostAndHoldLine('), fn('function composerVaultTerms('),
    fn('function composerConvShardFact('), fn('function composerPrivateMessageShape('), fn('function groupLaneShape('), fn('function composerGroupLaneShape('),
    fn('function composerFirstContactFact('), fn('function composerFirstContactExtraNanotons('), fn('function privateComposerFinalCostLine('),
    fn('function privateMessagePriceAndHold('),
    fn('function privateMessageFinalCost('),
    fn('function composerChannelShardFact('), fn('function composerThreadShardFact('), fn('function composerPublicRoutes('),
    fn('function publicDirectLiveExtraNanotons('), fn('function composerPublicRoutedHoldExtra('),
    fn('function publicComposerFinalCostLine('), fn('function publicRowFinalCost('), fn('function publicPartsFinalCost('),
    fn('function groupCapsulesFinalCost('), fn('function groupChainPriceLine('), fn('function groupAvatarPrice('),
    fn('function publicGroupUidOf('), fn('function publicGroupRowPrice('), fn('function publicGroupPriceLine('),
  ], '{ privateComposerFinalCostLine, publicComposerFinalCostLine, groupChainPriceLine, groupAvatarPrice, groupCapsulesFinalCost, publicGroupPriceLine }');
}

const afterFlip = () => { vi.useFakeTimers(); vi.setSystemTime((E + 3 * 86_400 + 7_200) * 1000); };
const beforeFlip = () => { vi.useFakeTimers(); vi.setSystemTime((E - 3 * 86_400 + 7_200) * 1000); };
const today = () => currentEpochUtc();
const PLAN = [{ sizeClass: 1 }];

describe('FCOST — the composer says the price of THIS send', () => {
  it('FCOST-04: the first message of a day, and the ones after it, as the send decides which it is', () => {
    afterFlip();
    const rec = { kRootCurrent: new Uint8Array(32), outgoingSeq: {} };
    expect(composer({ rec }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN).text).toBe(costLine('0.0234'));
    const known = { conv: { address: 'A', epoch: today(), coldFloor: 3 } };
    expect(composer({ rec, chainFacts: known }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN).text).toBe(costLine('0.0174'));
    const claimed = { kRootCurrent: new Uint8Array(32), outgoingSeq: { [today()]: 7 } };
    const line = composer({ rec: claimed, highWater: 7, chainFacts: { conv: { address: 'A', epoch: today(), coldFloor: 0 } } })
      .privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN);
    expect(line.text).toBe(costLine(up4(convMessageFinalCost({ generation: 18, recordIndex: 8 }).cost)));
    expect(composer({ rec: claimed, highWater: -1, chainFacts: { conv: { address: 'A', epoch: today(), coldFloor: 0 } } })
      .privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN).text)
      .toBe(costLine(up4(convMessageFinalCost({ generation: 18, halves: true, recordIndex: 8 }).cost)));
    expect(convMessageFinalCost({ generation: 18, halves: true }).cost).toBe(19_898_675n);
  });

  it('FCOST-05: a first contact is its INTRO, its first message and the recovery slot its key is written to', () => {
    afterFlip();
    const thread = { id: 't-new' };
    const nothingKnown = composer().privateComposerFinalCostLine(thread, PLAN);
    const born = introFinalCost({ generation: 18, born: true }) + recoveryWriteFinalCost({ newSlot: true, conversations: 1 })
      + convMessageFinalCost({ generation: 18, first: true }).cost;
    expect(nothingKnown.text).toBe(costLine(up4(born)));
    const slot = recoverySlotForConversation(conversationId(SELF, PEER));
    const neighbours = new Map<string, any>();
    for (let i = 0; neighbours.size < 2 && i < 65_536; i += 1) {
      const key = new Uint8Array(32).fill(0x33);
      key[0] = i >> 8; key[1] = i & 0xff;
      const other = conversationId(SELF, key);
      if (recoverySlotForConversation(other) === slot) neighbours.set(other, {});
    }
    expect(neighbours.size, 'two neighbours in the same slot').toBe(2);
    const line = composer({ map: neighbours, chainFacts: { intro: { peerKeyId: PEER, fill: 4 } } }).privateComposerFinalCostLine(thread, PLAN);
    const rewrite = introFinalCost({ generation: 18, born: false, entryIndex: 5 }) + recoveryWriteFinalCost({ newSlot: false, conversations: 3 })
      + convMessageFinalCost({ generation: 18, first: true }).cost;
    expect(line.text).toBe(costLine(up4(rewrite)));
    expect(rewrite < born, 'an established wallet pays less for a first contact than a new one').toBe(true);
  });

  it('FCOST-06: before the flip clean-17 prices; the first message after it also sets the vault up, shown apart', () => {
    beforeFlip();
    const rec = { kRootCurrent: new Uint8Array(32), outgoingSeq: {} };
    const live = { conv: { address: 'A', epoch: today(), coldFloor: 1 } };
    expect(composer({ rec, chainFacts: live }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN).text).toBe(costLine('0.0189'));
    afterFlip();
    const noVault = { wallet: 'W', snapshot: { state: VAULT_ABSENT }, address: 'V' };
    const line = composer({ rec, vault: noVault }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN);
    const q = convMessageFinalCost({ generation: 18, first: true, vaultDeposit: true });
    expect(line.text).toBe(`Cost ${up4(q.cost)} GRAM + ${up4(q.deposit)} GRAM: profile.stakeSummarySetup · sending needs 0.0300, the rest comes back`);
    const staked = { wallet: 'W', snapshot: { state: VAULT_LIVE, feeDue: 0n, balance: FV_FLOAT_TOPUP_BELOW * 2n }, address: 'V' };
    const liveToday = { conv: { address: 'A', epoch: today(), coldFloor: 1 } };
    expect(composer({ rec, vault: staked, chainFacts: liveToday }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN).text).toBe(costLine('0.0074'));
    const assumed = { wallet: 'W', snapshot: { state: VAULT_LIVE, feeDue: 0n, balance: FV_FLOAT_TOPUP_BELOW * 2n, assumed: true }, address: 'V' };
    expect(composer({ rec, vault: assumed, chainFacts: liveToday }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN).text).toBe(costLine('0.0174'));
  });

  it('FCOST-07: a wallet below the hold is told the price, what the send will ask of it, and what it has', () => {
    afterFlip();
    const rec = { kRootCurrent: new Uint8Array(32), outgoingSeq: {} };
    const short = composer({ rec, balance: 20_000_000n, hold: 30_000_000n }).privateComposerFinalCostLine({ convPeerKeyId: PEER }, PLAN);
    expect(short).toMatchObject({ text: 'Cost 0.0234 GRAM · sending needs 0.0300, you have 0.0200', state: 'short' });
  });

  it('FCOST-08: a group message is priced as its member lane stands today, with no first contact in it', () => {
    afterFlip();
    const groupRecord = (wrote: number) => ({ epochs: [{ epoch: today(), generation: 1 }], seqHighWater: wrote ? { [`${today()}.1`]: wrote } : {} });
    const thread = { group: true, groupId: 'g' };
    expect(composer({ groups: { g: groupRecord(0) } }).privateComposerFinalCostLine(thread, PLAN).text).toBe(costLine('0.0234'));
    expect(composer({ groups: { g: groupRecord(1) } }).privateComposerFinalCostLine(thread, PLAN).text).toBe(costLine('0.0174'));
  });

  it('FCOST-09: a post, a comment and a room row — the era shard as the send probes it, the door as the send picks it', () => {
    afterFlip();
    const plan = [{ bytes: new Uint8Array(195) }];
    const direct = { wallet: 'W', snapshot: null, address: null };
    expect(composer({ vault: direct }).publicComposerFinalCostLine(plan).text).toBe(costLine(up4(publicPostFinalCost({ generation: 18, parts: [{ bytes: 195 }], first: true }))));
    const live = { channel: { seq: 0, live: true, entries: 7 } };
    expect(composer({ vault: direct, chainFacts: live }).publicComposerFinalCostLine(plan).text)
      .toBe(costLine(up4(publicPostFinalCost({ generation: 18, parts: [{ bytes: 195 }], entryIndex: 8 }))));
    const thread = { thread: { seq: 0, live: true, entries: 1 } };
    expect(composer({ vault: direct, chainFacts: thread, commentTarget: { id: 'p' } }).publicComposerFinalCostLine(plan).text)
      .toBe(costLine(up4(publicPostFinalCost({ generation: 18, kind: 1, parts: [{ bytes: 195 }], entryIndex: 2 }))));
    expect(composer({ vault: direct, chainFacts: thread }).publicComposerFinalCostLine(plan, { kind: 1, postUid: 7n }).text)
      .toBe(costLine(up4(publicPostFinalCost({ generation: 18, kind: 1, parts: [{ bytes: 195 }], entryIndex: 2 }))));
    const staked = { wallet: 'W', snapshot: { state: VAULT_LIVE, feeDue: 0n }, address: 'V' };
    expect(composer({ vault: staked, chainFacts: live }).publicComposerFinalCostLine(plan).text)
      .toBe(costLine(up4(publicPostFinalCost({ generation: 18, parts: [{ bytes: 195 }], entryIndex: 8, route: 'vault', feeDue: 0n }))));
  });
});

describe("FCOST — a private group's own writes, after the flip [2026-10-01 — the client audit]", () => {
  const groupRecord = (lanes: Record<string, number> = {}) => ({ epochs: [{ epoch: today(), generation: 1 }], seqHighWater: lanes });
  const ONE = groupCapsulePlan(200);
  const noVault = { wallet: 'W', snapshot: { state: VAULT_ABSENT }, address: 'V' };

  it("FCOST-G1: an admin's control is priced on the roster lane as it stands today — first, or the n-th record of it", () => {
    afterFlip();
    const first = convMessageFinalCost({ generation: 18, first: true, recordIndex: 1 });
    expect(composer({ groups: { g: groupRecord() } }).groupChainPriceLine(ONE, 'g')).toBe(costLine(up4(first.cost)));
    const fourth = convMessageFinalCost({ generation: 18, recordIndex: 4 });
    expect(composer({ groups: { g: groupRecord({ [`r.${today()}.1`]: 3 }) } }).groupChainPriceLine(ONE, 'g')).toBe(costLine(up4(fourth.cost)));
    expect(composer({ groups: { g: groupRecord({ [`${today()}.1`]: 3 }) } }).groupChainPriceLine(ONE, 'g')).toBe(costLine(up4(first.cost)));
    expect(composer({ groups: { g: groupRecord({ [`${today()}.1`]: 3 }) } }).groupChainPriceLine(ONE, 'g', 'daily')).toBe(costLine(up4(fourth.cost)));
    expect(composer({ groups: { g: groupRecord({ [`r.${today()}.1`]: 3 }) } }).groupChainPriceLine(ONE)).toBe(costLine(up4(first.cost)));
  });

  it("FCOST-G2: before the flip a control is clean-17's direct door; after it, with no vault, the vault's setup is named apart", () => {
    beforeFlip();
    expect(composer({ groups: { g: groupRecord() } }).groupChainPriceLine(ONE, 'g'))
      .toBe(costLine(up4(convMessageFinalCost({ generation: 17, first: true, recordIndex: 1 }).cost)));
    afterFlip();
    const q = convMessageFinalCost({ generation: 18, first: true, recordIndex: 1, vaultDeposit: true });
    expect(composer({ groups: { g: groupRecord() }, vault: noVault }).groupChainPriceLine(ONE, 'g'))
      .toBe(`Cost ${up4(q.cost)} GRAM + ${up4(q.deposit)} GRAM: profile.stakeSummarySetup · sending needs 0.0300, the rest comes back`);
  });

  it('FCOST-G3: a picture writes two lanes in ONE transfer — its own new lane and the roster row — the vault set up by the first, the wallet paid once', () => {
    afterFlip();
    const picture = groupCapsulePlan(9_000);
    const profile = groupCapsulePlan(300);
    const avatarPlan = { picture, profile, count: picture.count + profile.count, parts: [...picture.parts, ...profile.parts] };
    const roster = { [`r.${today()}.1`]: 2, [`${today()}.1`]: 5 };
    const price = composer({ groups: { g: groupRecord(roster) }, vault: noVault, avatarPlan, hold: 40_000_000n }).groupAvatarPrice('g', 9_000);
    const pictureCost = convMessageFinalCost({ generation: 18, sizeClasses: picture.parts.map((p: any) => p.sizeClass), first: true, recordIndex: 1, vaultDeposit: true });
    const profileCost = convMessageFinalCost({ generation: 18, sizeClasses: profile.parts.map((p: any) => p.sizeClass), recordIndex: 3 });
    expect(price.cost).toBe(pictureCost.cost + profileCost.cost - walletOnceFinalCost({ generation: 18 }));
    expect(price.deposit).toBe(pictureCost.deposit);
    expect(price.hold, 'the two holds, the deploy once and the reserve base once').toBe(40_000_000n * 2n - FV_DEPLOY_FUNDING - RESERVE_BASE);
    expect(composer({ groups: { g: groupRecord(roster) }, avatarPlan, hold: 40_000_000n }).groupAvatarPrice('g', 9_000).hold).toBe(80_000_000n - RESERVE_BASE);
  });

  it("FCOST-G5: a public room's dialog prices its row into the room's thread, both figures; a room not held is a thread row all the same", () => {
    afterFlip();
    const blocks = [{ type: 'group', bytes: new Uint8Array(120) }];
    const tag = publicEpochTag(1, publicEraOf(1, Math.floor(Date.now() / 1000)));
    const facts = { [`thread:uid:9:${tag}`]: { seq: 0, live: true, entries: 4 }, channel: { seq: 0, live: true, entries: 7 } };
    const roomRow = (entry: any) => costLine(up4(publicPostFinalCost({ generation: 18, kind: 1, parts: [{ bytes: 120 }], ...entry })), '0.0250');
    expect(composer({ chainFacts: facts, publicGroups: { pg: { groupId: 'pg', founder: 'f' } } }).publicGroupPriceLine(blocks, { groupId: 'pg' }))
      .toBe(roomRow({ entryIndex: 5 }));
    expect(composer({ chainFacts: facts }).publicGroupPriceLine(blocks, { uid: 9n })).toBe(roomRow({ entryIndex: 5 }));
    expect(composer({ chainFacts: facts }).publicGroupPriceLine(blocks, null)).toBe(roomRow({ first: true }));
  });

  it('FCOST-G4: every private group dialog says both figures for its own lane, and a removal quotes the removal chosen', () => {
    const calls = app.split(String.fromCharCode(10)).filter((line) => line.includes('groupChainPriceLine(')).map((line) => line.slice(line.indexOf('groupChainPriceLine(')));
    const sites = calls.filter((line) => !line.startsWith('groupChainPriceLine(plan, groupId'));
    expect(sites.length).toBeGreaterThanOrEqual(10);
    for (const line of sites) expect(line, line).toMatch(/, groupId(, '(roster|daily)')?\)/);
    expect(app).toContain("groupChainPriceLine(runtime.controlPlan(groupId, GROUP_KIND.LEAVE), groupId, 'daily')");
    const remove = app.slice(app.indexOf('async function removeGroupMember('), app.indexOf('async function openCreateGroupDialog('));
    expect(remove).toContain('groupChainPriceLine(result.cutReading === true ? plan.capsules : plan.capsulesWithoutRekey, groupId, ');
    expect(remove).toContain('cost: formatTonNanotonsUp(withRekey.cost - withoutRekey.cost), hold: formatTonNanotonsUp(withRekey.hold - withoutRekey.hold),');
    expect(app).toContain('const price = attachment ? groupAvatarPrice(groupId, attachment.bytes.length) : null;');
    expect(app, 'no dialog prices a group capsule at the flat direct door any more').not.toContain('groupCapsulesChargeNanotons');
  });
});
