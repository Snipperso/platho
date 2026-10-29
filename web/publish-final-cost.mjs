
import { FV_PROTOCOL_FEE, vaultTakeFor } from './fee-vault.mjs?v=39';

export const FINAL_COST_MEASURED_AT = '2026-09-30';

export const FINAL_COST_REFERENCE_PRICES = Object.freeze({ gasPrice: 4_369_067n, bit: 4_369_067n });

export const FINAL_COST_TABLE = Object.freeze({
  'activation18': Object.freeze([45_000_004n, 2_467_267n, 5_559_868n]),
  'avatar.request': Object.freeze([43_000_009n, 8_465_337n, 1_017_204n]),
  'conv17.first.c1': Object.freeze([16_400_006n, 1_204_067n, 4_628_867n]),
  'conv17.first.c16': Object.freeze([16_400_004n, 1_204_067n, 22_626_203n]),
  'conv17.first.c2': Object.freeze([16_400_006n, 1_204_067n, 5_827_801n]),
  'conv17.first.c32': Object.freeze([16_400_004n, 1_204_067n, 41_822_471n]),
  'conv17.first.c4': Object.freeze([16_400_004n, 1_204_067n, 8_225_669n]),
  'conv17.first.c8': Object.freeze([16_400_006n, 1_204_067n, 13_021_401n]),
  'conv17.ordinary.c1': Object.freeze([12_900_005n, 1_272_801n, 4_628_867n]),
  'conv17.ordinary.c16': Object.freeze([12_900_003n, 1_272_801n, 22_626_203n]),
  'conv17.ordinary.c2': Object.freeze([12_900_005n, 1_272_801n, 5_827_801n]),
  'conv17.ordinary.c32': Object.freeze([12_900_003n, 1_272_801n, 41_822_471n]),
  'conv17.ordinary.c4': Object.freeze([12_900_003n, 1_272_801n, 8_225_669n]),
  'conv17.ordinary.c8': Object.freeze([12_900_005n, 1_272_801n, 13_021_401n]),
  'conv17.ordinary.two': Object.freeze([25_800_007n, 2_264_135n, 8_455_135n]),
  'conv18.first.c1': Object.freeze([13_802_007n, 2_357_334n, 7_170_601n]),
  'conv18.first.c16': Object.freeze([13_802_006n, 2_357_334n, 34_166_603n]),
  'conv18.first.c2': Object.freeze([13_802_005n, 2_357_334n, 8_969_002n]),
  'conv18.first.c32': Object.freeze([13_802_006n, 2_357_334n, 62_961_005n]),
  'conv18.first.c4': Object.freeze([13_802_006n, 2_357_334n, 12_565_802n]),
  'conv18.first.c8': Object.freeze([13_802_007n, 2_357_334n, 19_759_402n]),
  'conv18.firstever.c1': Object.freeze([63_802_006n, 2_405_134n, 10_041_269n]),
  'conv18.halves.c1': Object.freeze([10_302_007n, 2_426_067n, 7_170_601n]),
  'conv18.ordinary.c1': Object.freeze([10_302_006n, 2_426_067n, 4_624_001n]),
  'conv18.ordinary.c16': Object.freeze([10_302_005n, 2_426_067n, 31_620_004n]),
  'conv18.ordinary.c2': Object.freeze([10_302_007n, 2_426_067n, 6_422_401n]),
  'conv18.ordinary.c32': Object.freeze([10_302_005n, 2_426_067n, 60_414_406n]),
  'conv18.ordinary.c4': Object.freeze([10_302_004n, 2_426_067n, 10_019_203n]),
  'conv18.ordinary.c8': Object.freeze([10_302_006n, 2_426_067n, 17_212_802n]),
  'conv18.ordinary.two': Object.freeze([20_604_010n, 4_570_667n, 9_146_669n]),
  'intro17.born': Object.freeze([15_110_004n, 1_148_467n, 5_943_802n]),
  'intro17.live': Object.freeze([12_610_004n, 1_216_667n, 5_943_802n]),
  'intro18.born': Object.freeze([12_912_004n, 1_341_201n, 6_113_068n]),
  'intro18.live': Object.freeze([10_412_004n, 1_409_401n, 6_113_068n]),
  'pub17.avatar.first.long': Object.freeze([36_800_004n, 1_432_201n, 7_316_535n]),
  'pub17.avatar.first.short': Object.freeze([36_800_004n, 1_432_201n, 2_977_868n]),
  'pub17.avatar.halves.long': Object.freeze([15_000_005n, 1_443_667n, 7_316_535n]),
  'pub17.avatar.halves.short': Object.freeze([15_000_005n, 1_443_667n, 2_977_868n]),
  'pub17.avatar.ordinary.long': Object.freeze([15_000_005n, 1_443_667n, 5_058_201n]),
  'pub17.avatar.ordinary.short': Object.freeze([15_000_006n, 1_443_667n, 719_534n]),
  'pub17.beacon.first.short': Object.freeze([28_700_005n, 1_415_467n, 2_977_868n]),
  'pub17.beacon.ordinary.short': Object.freeze([14_200_006n, 1_421_067n, 719_534n]),
  'pub17.channel.first.long': Object.freeze([17_600_005n, 1_432_734n, 7_316_535n]),
  'pub17.channel.first.short': Object.freeze([17_600_005n, 1_432_734n, 2_977_868n]),
  'pub17.channel.ordinary.long': Object.freeze([13_100_005n, 1_438_334n, 5_058_201n]),
  'pub17.channel.ordinary.short': Object.freeze([13_100_006n, 1_438_334n, 719_534n]),
  'pub17.channel.ordinary.two': Object.freeze([26_200_010n, 2_595_201n, 1_365_735n]),
  'pub17.thread.first.long': Object.freeze([17_600_004n, 1_406_001n, 7_316_535n]),
  'pub17.thread.first.short': Object.freeze([17_600_004n, 1_406_001n, 2_977_868n]),
  'pub17.thread.ordinary.long': Object.freeze([13_100_004n, 1_411_601n, 5_058_201n]),
  'pub17.thread.ordinary.short': Object.freeze([13_100_005n, 1_411_601n, 719_534n]),
  'pub18.avatar.first.long': Object.freeze([49_300_004n, 1_868_601n, 10_209_668n]),
  'pub18.avatar.first.short': Object.freeze([49_300_003n, 1_868_601n, 5_871_002n]),
  'pub18.avatar.halves.long': Object.freeze([12_800_005n, 1_877_134n, 10_209_668n]),
  'pub18.avatar.halves.short': Object.freeze([12_800_004n, 1_877_134n, 5_871_002n]),
  'pub18.avatar.ordinary.long': Object.freeze([12_800_005n, 1_877_134n, 5_005_601n]),
  'pub18.avatar.ordinary.short': Object.freeze([12_800_006n, 1_877_134n, 666_934n]),
  'pub18.avatar.vault.first.long': Object.freeze([38_900_004n, 2_758_934n, 15_175_803n]),
  'pub18.avatar.vault.first.short': Object.freeze([38_900_006n, 2_758_934n, 8_667_802n]),
  'pub18.avatar.vault.halves.long': Object.freeze([2_400_004n, 2_767_467n, 15_175_803n]),
  'pub18.avatar.vault.halves.short': Object.freeze([2_400_006n, 2_767_467n, 8_667_802n]),
  'pub18.avatar.vault.ordinary.long': Object.freeze([2_400_007n, 2_767_467n, 7_380_801n]),
  'pub18.avatar.vault.ordinary.short': Object.freeze([2_400_005n, 2_767_467n, 872_802n]),
  'pub18.beacon.first.short': Object.freeze([35_100_003n, 1_984_601n, 5_871_002n]),
  'pub18.beacon.ordinary.short': Object.freeze([10_400_005n, 1_839_001n, 666_934n]),
  'pub18.channel.first.long': Object.freeze([19_300_005n, 1_869_934n, 10_209_668n]),
  'pub18.channel.first.short': Object.freeze([19_300_004n, 1_869_934n, 5_871_002n]),
  'pub18.channel.ordinary.long': Object.freeze([10_900_004n, 1_872_601n, 5_005_601n]),
  'pub18.channel.ordinary.short': Object.freeze([10_900_005n, 1_872_601n, 666_934n]),
  'pub18.channel.ordinary.two': Object.freeze([21_800_008n, 3_463_735n, 1_260_535n]),
  'pub18.channel.vault.first.long': Object.freeze([8_900_004n, 2_760_267n, 15_175_803n]),
  'pub18.channel.vault.first.short': Object.freeze([8_900_006n, 2_760_267n, 8_667_802n]),
  'pub18.channel.vault.ordinary.long': Object.freeze([500_007n, 2_762_934n, 7_380_801n]),
  'pub18.channel.vault.ordinary.short': Object.freeze([500_005n, 2_762_934n, 872_802n]),
  'pub18.thread.first.long': Object.freeze([19_300_004n, 1_834_001n, 10_209_668n]),
  'pub18.thread.first.short': Object.freeze([19_300_003n, 1_834_001n, 5_871_002n]),
  'pub18.thread.ordinary.long': Object.freeze([10_900_005n, 1_836_667n, 5_005_601n]),
  'pub18.thread.ordinary.short': Object.freeze([10_900_006n, 1_836_667n, 666_934n]),
  'react18.channel.leaf': Object.freeze([3n, 1_018_534n, 254_668n]),
  'react18.channel.newleaf': Object.freeze([250_002n, 1_022_401n, 254_668n]),
  'react18.thread.leaf': Object.freeze([3n, 1_019_067n, 254_668n]),
  'react18.thread.newleaf': Object.freeze([250_003n, 1_022_934n, 254_668n]),
  'recovery.new.n1': Object.freeze([30_400_005n, 1_153_867n, 2_455_334n]),
  'recovery.new.n20': Object.freeze([30_400_004n, 1_540_534n, 11_186_002n]),
  'recovery.new.n8': Object.freeze([30_400_004n, 1_293_867n, 5_662_268n]),
  'recovery.rewrite.n1': Object.freeze([4n, 1_056_801n, 2_455_334n]),
  'recovery.rewrite.n20': Object.freeze([4n, 1_443_467n, 11_186_002n]),
  'recovery.rewrite.n8': Object.freeze([3n, 1_196_801n, 5_662_268n]),
  'report18.first': Object.freeze([8_350_006n, 1_687_134n, 3_655_801n]),
  'report18.fresh': Object.freeze([5_650_006n, 1_808_534n, 3_655_801n]),
  'report18.repeat': Object.freeze([5_400_006n, 1_552_267n, 3_655_801n]),
  'wallet.transfer.1gram': Object.freeze([1_000_000_002n, 329_267n, 183_734n]),
});

export const FINAL_COST_PUBLIC_BYTES = Object.freeze({ short: 195, long: 3900 });
export const FINAL_COST_RECOVERY_CONVERSATIONS = Object.freeze([1, 8, 20]);
export const FINAL_COST_RECOVERY_BYTES = Object.freeze([763, 3570, 8397]);

const SIZE_CLASSES = Object.freeze([1, 2, 4, 8, 16, 32]);

function entry(key) {
  const split = FINAL_COST_TABLE[key];
  if (!split) throw new RangeError(`publish-final-cost: no measured case ${key}`);
  return split;
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

function roundDiv(num, den) {
  const half = den / 2n;
  return num >= 0n ? (num + half) / den : -((-num + half) / den);
}

function lerp(a, b, x0, x1, x) {
  const dx = BigInt(x1 - x0);
  const at = BigInt(Math.max(0, Math.round(Number(x))) - x0);
  return [0, 1, 2].map((i) => a[i] + roundDiv((b[i] - a[i]) * at, dx));
}

function ceilDiv(num, den) {
  return num <= 0n ? 0n : (num + den - 1n) / den;
}

function rates(prices) {
  const gas = BigInt(prices?.gas?.gasPrice ?? FINAL_COST_REFERENCE_PRICES.gasPrice);
  const bit = BigInt(prices?.fwd?.bit ?? FINAL_COST_REFERENCE_PRICES.bit);
  if (gas <= 0n || bit <= 0n) throw new RangeError('publish-final-cost: a price must be positive');
  return { gas, bit };
}

export function settleFinalCostSplit(split, prices = null) {
  const { gas, bit } = rates(prices);
  const [fixed, gasPart, forwardPart] = split;
  return fixed + ceilDiv(gasPart * gas, FINAL_COST_REFERENCE_PRICES.gasPrice)
    + ceilDiv(forwardPart * bit, FINAL_COST_REFERENCE_PRICES.bit);
}

function generationKey(generation) {
  const g = Number(generation);
  if (g !== 17 && g !== 18) throw new RangeError(`publish-final-cost: no measured generation ${generation}`);
  return g;
}

function sizeClassOf(value) {
  const c = Number(value ?? 1);
  if (!SIZE_CLASSES.includes(c)) throw new RangeError(`publish-final-cost: ${value} is not a size class`);
  return c;
}

function walletOnce(g) {
  return sub(times(entry(`pub${g}.channel.ordinary.short`), 2n), entry(`pub${g}.channel.ordinary.two`));
}

export function walletOnceFinalCost({ generation, prices = null } = {}) {
  return settleFinalCostSplit(walletOnce(generationKey(generation)), prices);
}
const convSharedIn = (g) => sub(sub(times(entry(`conv${g}.ordinary.c1`), 2n), entry(`conv${g}.ordinary.two`)), walletOnce(g));
const SHARED_HEADER = convSharedIn(18);
const SHARED_STATE_INIT_17 = sub(convSharedIn(17), SHARED_HEADER);

export const FINAL_COST_DEPTH_GAS = 40_000n;
export function finalCostDepthLevels(index) {
  let before = BigInt(Math.max(1, Math.floor(Number(index) || 1)) - 1);
  let bits = 0n;
  while (before > 0n) { bits += before & 1n; before >>= 1n; }
  return bits > 1n ? bits - 1n : 0n;
}
function depthGas(start, count) {
  let levels = 0n;
  for (let i = 0; i < count; i += 1) levels += finalCostDepthLevels(start + i);
  return [0n, FINAL_COST_DEPTH_GAS * levels, 0n];
}

export function convMessageFinalCost({ generation, sizeClasses = [1], first = false, halves = false, recordIndex = null, feeDue = null, vaultDeposit = false, prices = null } = {}) {
  const g = generationKey(generation);
  const classes = (Array.isArray(sizeClasses) && sizeClasses.length > 0 ? sizeClasses : [1]).map(sizeClassOf);
  const ordinary = (c) => entry(`conv${g}.ordinary.c${c}`);
  const carried = g >= 18 ? sub(entry('conv18.halves.c1'), ordinary(1)) : [0n, 0n, 0n];
  let split = first ? entry(`conv${g}.first.c${classes[0]}`) : halves ? add(ordinary(classes[0]), carried) : ordinary(classes[0]);
  const seen = new Set([classes[0]]);
  for (const c of classes.slice(1)) {
    let part = sub(ordinary(c), walletOnce(g));
    if (g === 17) part = sub(part, SHARED_STATE_INIT_17);
    if (seen.has(c)) part = sub(part, SHARED_HEADER);
    seen.add(c);
    split = add(split, part);
  }
  split = add(split, depthGas(recordIndex ?? (first ? 1 : 2), classes.length));
  let cost = settleFinalCostSplit(split, prices);
  let deposit = 0n;
  if (g >= 18) {
    const discount = vaultTakeFor(FV_PROTOCOL_FEE) - vaultTakeFor(feeDue ?? FV_PROTOCOL_FEE);
    cost -= discount * BigInt(classes.length);
    if (vaultDeposit) {
      const deploy = sub(entry('conv18.firstever.c1'), entry('conv18.first.c1'));
      deposit = deploy[0];
      cost += settleFinalCostSplit([0n, deploy[1], deploy[2]], prices);
    }
  }
  return { cost, deposit };
}

function publicSplit(g, lane, route, phase, bytes) {
  if (lane === 'beacon') return beaconSplit(g, route, phase, bytes);
  const key = (l) => `pub${g}.${l}${route === 'vault' ? '.vault' : ''}.${phase}`;
  const at = (l) => lerp(entry(`${key(l)}.short`), entry(`${key(l)}.long`),
    FINAL_COST_PUBLIC_BYTES.short, FINAL_COST_PUBLIC_BYTES.long, bytes);
  if (route === 'vault' && lane === 'thread') {
    const direct = (l) => lerp(entry(`pub${g}.${l}.${phase}.short`), entry(`pub${g}.${l}.${phase}.long`),
      FINAL_COST_PUBLIC_BYTES.short, FINAL_COST_PUBLIC_BYTES.long, bytes);
    return add(at('channel'), sub(direct('thread'), direct('channel')));
  }
  return at(lane);
}

const PUBLIC_LANES = Object.freeze({ 0: 'channel', 1: 'thread', 2: 'beacon', 3: 'avatar' });

function beaconSplit(g, route, phase, bytes) {
  const channelAt = (ph, door = '') => lerp(entry(`pub${g}.channel${door}.${ph}.short`), entry(`pub${g}.channel${door}.${ph}.long`),
    FINAL_COST_PUBLIC_BYTES.short, FINAL_COST_PUBLIC_BYTES.long, bytes);
  const own = phase === 'first' ? 'first' : 'ordinary';
  let split = add(entry(`pub${g}.beacon.${own}.short`), sub(channelAt(own), entry(`pub${g}.channel.${own}.short`)));
  if (phase === 'halves') {
    const avatarAt = (ph) => lerp(entry(`pub${g}.avatar.${ph}.short`), entry(`pub${g}.avatar.${ph}.long`),
      FINAL_COST_PUBLIC_BYTES.short, FINAL_COST_PUBLIC_BYTES.long, bytes);
    split = add(split, sub(avatarAt('halves'), avatarAt('ordinary')));
  }
  if (route === 'vault') split = add(split, sub(channelAt(own, '.vault'), channelAt(own)));
  return split;
}

export function publicPostFinalCost({ generation, kind = 0, parts = [{ bytes: 0 }], first = false, halves = false, entryIndex = null, route = 'direct', feeDue = null, prices = null } = {}) {
  const g = generationKey(generation);
  const lane = PUBLIC_LANES[Number(kind)];
  if (!lane) throw new RangeError(`publish-final-cost: public kind ${kind} is not measured`);
  const door = route === 'vault' && g >= 18 ? 'vault' : 'direct';
  const list = Array.isArray(parts) && parts.length > 0 ? parts : [{ bytes: 0 }];
  const phase = first ? 'first' : halves && (lane === 'avatar' || lane === 'beacon') ? 'halves' : 'ordinary';
  let split = publicSplit(g, lane, door, phase, Number(list[0]?.bytes ?? 0));
  for (const part of list.slice(1)) {
    split = add(split, sub(publicSplit(g, lane, door, 'ordinary', Number(part?.bytes ?? 0)), walletOnce(g)));
  }
  split = add(split, depthGas(entryIndex ?? (first ? 1 : 2), list.length));
  let cost = settleFinalCostSplit(split, prices);
  if (door === 'vault') cost += vaultTakeFor(feeDue ?? FV_PROTOCOL_FEE) * BigInt(list.length);
  return cost;
}

export function avatarRequestFinalCost({ prices = null, withParts = false, generation = 18 } = {}) {
  const split = entry('avatar.request');
  return settleFinalCostSplit(withParts ? sub(split, walletOnce(generationKey(generation))) : split, prices);
}

export function reactionFinalCost({ lane = 'channel', newLeaf = true, prices = null } = {}) {
  return settleFinalCostSplit(entry(`react18.${lane === 'thread' ? 'thread' : 'channel'}.${newLeaf ? 'newleaf' : 'leaf'}`), prices);
}

export function reportFinalCost({ row = 'first', prices = null } = {}) {
  const which = row === 'repeat' ? 'repeat' : row === 'fresh' ? 'fresh' : 'first';
  return settleFinalCostSplit(entry(`report18.${which}`), prices);
}

export const FINAL_COST_TRANSFER_AMOUNT = 1_000_000_000n;
const FINAL_COST_REFERENCE_CELL_PRICE = 436_906_667n;
export function walletTransferFeeFinalCost({ prices = null, commentBytes = 0 } = {}) {
  const bytes = BigInt(Math.max(0, Math.floor(Number(commentBytes) || 0)));
  const comment = bytes > 0n ? 2n * ceilDiv(FINAL_COST_REFERENCE_PRICES.bit * (32n + 8n * bytes) + FINAL_COST_REFERENCE_CELL_PRICE, 65_536n) : 0n;
  return settleFinalCostSplit(add(entry('wallet.transfer.1gram'), [0n, 0n, comment]), prices) - FINAL_COST_TRANSFER_AMOUNT;
}

export function activationFinalCost({ prices = null } = {}) {
  return settleFinalCostSplit(entry('activation18'), prices);
}

export function introFinalCost({ generation, born = true, entryIndex = null, prices = null } = {}) {
  const split = add(entry(`intro${generationKey(generation)}.${born ? 'born' : 'live'}`), depthGas(entryIndex ?? (born ? 1 : 2), 1));
  return settleFinalCostSplit(split, prices);
}

export function recoveryWriteFinalCost({ newSlot = true, conversations = 1, blobBytes = null, prices = null } = {}) {
  const [n1, n8, n20] = FINAL_COST_RECOVERY_CONVERSATIONS;
  const [b1, b8, b20] = FINAL_COST_RECOVERY_BYTES;
  const kind = newSlot ? 'new' : 'rewrite';
  const low = [entry(`recovery.${kind}.n${n1}`), entry(`recovery.${kind}.n${n8}`)];
  const high = [entry(`recovery.${kind}.n${n8}`), entry(`recovery.${kind}.n${n20}`)];
  let split;
  if (blobBytes !== null && blobBytes !== undefined) {
    const bytes = Math.max(0, Math.round(Number(blobBytes) || 0));
    split = bytes <= b8 ? lerp(...low, b1, b8, bytes) : lerp(...high, b8, b20, bytes);
  } else {
    const n = Math.max(1, Math.round(Number(conversations) || 1));
    split = n <= n8 ? lerp(...low, n1, n8, n) : lerp(...high, n8, n20, n);
  }
  return settleFinalCostSplit(split, prices);
}

