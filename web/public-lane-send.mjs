
import { buildPublicPublishBrowser } from './public-publish-browser.mjs?v=84';
import {
  buildVaultInternalPublishMessage, vaultInternalPublishValue, publicPublishRoute, FV_PUBLIC_SHARD_PUBLISH_GAS_MAX,
  directWriteLiveSurchargeNanotons, DIRECT_WRITE_GAS_MAX,
} from './fee-vault.mjs?v=39';
import { publicShardCodeCellFor, publicShardDataCellFor } from './shard-address.mjs?v=47';
import { CUTOVER_EPOCH } from './cutover-epoch.mjs?v=7';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=94';
import { applyShardSurcharge, surchargeExtraNanotons, LANE_PUBLIC } from './shard-debt.mjs?v=83';

export async function buildPublicPublishWalletMessage({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag, nowUnix, boundary = CUTOVER_EPOCH, attachStateInit = true, prices = null }) {
  const live = BigInt(value) + directWriteLiveSurchargeNanotons({ prices, receiverGas: DIRECT_WRITE_GAS_MAX.public });
  const built = await buildPublicPublishBrowser({ kind, keyArg, shardSeq, header, body, value: live, partitionKey, epochTag, nowUnix, boundary });
  return {
    to: built.to,
    value: built.value,
    generation: built.generation,
    partitionKey: built.partitionKey,
    commit: built.commit,
    init: built.init,
    body: built.body,
    message: {
      address: built.to,
      amount: built.value,
      payload: tonCell.bytesToBase64(serializeBoc(built.body)),
      stateInit: attachStateInit ? built.init : null,
      bounce: true,
    },
  };
}

export async function buildPublicPublishRoutedMessage({
  kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag, nowUnix,
  vaultAddress = null, capsuleBytes, feeDue, boundary = CUTOVER_EPOCH, attachStateInit = true, prices = null,
}) {
  const directLive = () => buildPublicPublishWalletMessage({
    kind, keyArg, shardSeq, header, body, value, partitionKey, epochTag, nowUnix, boundary, attachStateInit, prices,
  });
  const direct = await buildPublicPublishWalletMessage({
    kind, keyArg, shardSeq, header, body, value, partitionKey, epochTag, nowUnix, boundary, attachStateInit,
  });
  if (!vaultAddress) return { ...(await directLive()), route: 'direct', reason: 'no-vault' };

  const bytes = capsuleBytes ?? serializeBoc(direct.body).length;
  if (direct.generation < 18) return { ...(await directLive()), route: 'direct', reason: 'generation-has-no-vault-door' };

  const generation = direct.generation;
  const halves = attachStateInit
    ? { shardCode: publicShardCodeCellFor(generation), shardData: publicShardDataCellFor(direct.partitionKey, epochTag) }
    : { shardCode: null, shardData: null };
  const stateInit = halves.shardCode ? { code: halves.shardCode, data: halves.shardData } : null;
  const decision = publicPublishRoute({ kind, capsuleBytes: bytes, feeDue, stateInit, prices });
  if (decision.route !== 'vault') return { ...(await directLive()), ...decision };
  const message = buildVaultInternalPublishMessage(vaultAddress, {
    shard: direct.to,
    record: direct.body,
    ...halves,
    value: vaultInternalPublishValue({ directValue: direct.value, capsuleBytes: bytes, feeDue, stateInit, prices, shardGas: FV_PUBLIC_SHARD_PUBLISH_GAS_MAX }),
  });
  return {
    to: message.address, value: message.amount, commit: direct.commit, shard: direct.to,
    message, ...decision,
  };
}

export async function publishPublicLane({ wallet, transport, ...args }, options = {}) {
  if (!wallet) throw new Error('publishPublicLane requires a wallet');
  const prepared = await buildPublicPublishWalletMessage(args);
  const result = await sendPlathoWalletTransaction(wallet, { messages: [prepared.message] }, { ...options, transport });
  return { ...prepared, result };
}

export async function publishPublicLaneParts({ wallet, transport, vaultAddress = null, feeDue = null, prices = null },
  parts, options = {}) {
  if (!wallet) throw new Error('publishPublicLaneParts requires a wallet');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('publishPublicLaneParts requires at least one part');
  const prepared = [];
  const deploying = new Set();
  for (const part of parts) {
    const shardKey = `${Number(part.kind)}.${BigInt(part.keyArg ?? 0n)}.${BigInt(part.partitionKey ?? 0n)}.${BigInt(part.epochTag ?? 0n)}`;
    const attachStateInit = !deploying.has(shardKey) && part.shardLive !== true;
    deploying.add(shardKey);
    prepared.push(vaultAddress
      ? await buildPublicPublishRoutedMessage({ ...part, vaultAddress, feeDue, attachStateInit, prices })
      : await buildPublicPublishWalletMessage({ ...part, attachStateInit, prices }));
  }
  const { extraMessages, shardDebt, strictShardDebt, assertAffordable, ...sendOptions } = options;
  const { cushion } = await applyShardSurcharge(LANE_PUBLIC, prepared, { resolver: shardDebt, strict: strictShardDebt === true });
  const aboveBudget = surchargeExtraNanotons({ prepared, budgeted: parts.map((part) => part.value), cushion });
  if (aboveBudget > 0n && typeof assertAffordable === 'function') await assertAffordable(aboveBudget);
  const extra = Array.isArray(extraMessages) ? extraMessages : [];
  let result;
  try {
    result = await sendPlathoWalletTransaction(wallet, { messages: [...prepared.map((p) => p.message), ...extra] }, { ...sendOptions, transport });
  } catch (error) {
    if (error && typeof error === 'object' && !error.preparedParts) error.preparedParts = prepared;
    throw error;
  }
  return { parts: prepared, result };
}

export const BEACON_READABLE_ENTRIES = 192;

export function chooseBeaconBucket({ home, candidates = [], roomOf, entriesOf = null, readableEntries = BEACON_READABLE_ENTRIES, margin = 8 } = {}) {
  const houseHome = Number(home);
  if (!Number.isInteger(houseHome) || houseHome < 0) throw new Error('chooseBeaconBucket requires a home bucket');
  const room = (bucket) => {
    try {
      const value = roomOf(bucket);
      return value === null || value === undefined ? null : Number(value);
    } catch { return null; }
  };
  const entries = (bucket) => {
    if (typeof entriesOf !== 'function') return null;
    try {
      const value = entriesOf(bucket);
      return value === null || value === undefined ? null : Number(value);
    } catch { return null; }
  };
  const usable = (bucket) => {
    const seen = entries(bucket);
    if (seen !== null && Number.isFinite(seen)) return seen < readableEntries;
    const free = room(bucket);
    if (free === null || Number.isNaN(free)) return null;
    return free > margin;
  };
  const homeUsable = usable(houseHome);
  if (homeUsable === null || homeUsable) {
    return { bucket: houseHome, rolled: false, reason: homeUsable === null ? 'unknown' : 'home' };
  }
  for (const candidate of candidates) {
    const bucket = Number(candidate);
    if (!Number.isInteger(bucket) || bucket < 0 || bucket === houseHome) continue;
    if (usable(bucket) === true) return { bucket, rolled: true, reason: 'home-full' };
  }
  return { bucket: houseHome, rolled: false, reason: 'no-room-anywhere' };
}
