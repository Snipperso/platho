
import { beginCell, bytesToBase64, serializeBoc } from './pwa-contract-transactions.mjs?v=59';
import { readInt, readCell, cellReader, extractStack } from './public-shard-ton-rpc-provider.mjs?v=44';

export const PUBLIC_REACT_OPCODE = 0x50535034;
export const PUBLIC_REACTION_COUNT = 16;
export const PUBLIC_REACTION_PAGE_CAP = 32;

export const PUBLIC_REACT_GAS = 2_500_000n;
export const PUBLIC_REACT_LEAF_ENDOWMENT = 250_000n;
export const PUBLIC_REACT_VALUE = PUBLIC_REACT_GAS + PUBLIC_REACT_LEAF_ENDOWMENT;

export const PUBLIC_REACTION_GLYPHS = Object.freeze([
  '❤️', '👍', '👎', '🔥', '😂', '😮', '😢', '🙏',
  '👏', '🤔', '🎉', '💯', '😍', '🤯', '😡', '💩',
]);

export function reactionGlyph(index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= PUBLIC_REACTION_COUNT) throw new RangeError(`no reaction at index ${index}`);
  return PUBLIC_REACTION_GLYPHS[i];
}

export function buildReactMessage({ shardAddress, target, emoji, value = PUBLIC_REACT_VALUE, extra = 0n }) {
  if (!shardAddress) throw new Error('buildReactMessage requires the shard address');
  const t = BigInt(target);
  const e = Number(emoji);
  if (t < 0n || t > 0xffffffffn) throw new RangeError(`target ${target} is not a uint32 entry id`);
  if (!Number.isInteger(e) || e < 0 || e >= PUBLIC_REACTION_COUNT) throw new RangeError(`no reaction at index ${emoji}`);
  const body = beginCell().uint(BigInt(PUBLIC_REACT_OPCODE), 32, 'op').uint(t, 32, 'target').uint(BigInt(e), 8, 'emoji').endCell();
  return {
    address: shardAddress,
    amount: BigInt(value) + BigInt(extra),
    payload: bytesToBase64(serializeBoc(body)),
    stateInit: null,
    bounce: true,
  };
}

export function decodePublicReactions(result) {
  const stack = extractStack(result);
  if (stack.length !== 4) {
    throw new Error(`PublicShard get_reactions ABI mismatch: expected 4 stack items, got ${stack.length}`);
  }
  const fromTarget = readInt(stack, 0, 'from_target');
  const count = Number(readInt(stack, 1, 'count'));
  const entryCount = readInt(stack, 2, 'entry_count');
  let cell = readCell(stack, 3);
  const rows = [];
  for (let i = 0; i < count && cell; i += 1) {
    const reader = cellReader(cell);
    const counters = [];
    for (let e = 0; e < PUBLIC_REACTION_COUNT; e += 1) counters.push(Number(reader.loadUint(32)));
    rows.push({ target: fromTarget + BigInt(i), counters });
    cell = reader.refs() > 0 ? reader.loadRef() : null;
  }
  return { from_target: fromTarget, count, entry_count: entryCount, rows };
}

export function reactionsGetterCall(shardAddress, fromTarget, count = PUBLIC_REACTION_PAGE_CAP) {
  const n = Math.max(1, Math.min(Number(count) || 1, PUBLIC_REACTION_PAGE_CAP));
  return {
    address: shardAddress,
    method: 'get_reactions',
    stack: [
      { type: 'num', value: `0x${BigInt(fromTarget).toString(16)}` },
      { type: 'num', value: `0x${BigInt(n).toString(16)}` },
    ],
  };
}

export function reactionsTotal(counters) {
  return (counters ?? []).reduce((sum, c) => sum + (Number(c) || 0), 0);
}

export function reactionsShown(counters, limit = 6) {
  return (counters ?? [])
    .map((count, index) => ({ index, count: Number(count) || 0, glyph: PUBLIC_REACTION_GLYPHS[index] }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, limit);
}

export function createOwnReactionStore({ storage = null, wallet = null } = {}) {
  const key = `platho.public.reactions.v1:${String(wallet ?? '').toLowerCase()}`;
  const pendingKey = `platho.public.reactions.pending.v1:${String(wallet ?? '').toLowerCase()}`;
  const PENDING_MAX = 64;
  const PENDING_SINCE_SKEW_MS = 60_000;
  const PENDING_SETTLE_MAX_MS = 10 * 60_000;
  const pressIdShape = /^[^|]+\|\d+\|(?:\d|1[0-5])$/;
  const rawOf = (name) => { if (!storage) return undefined; try { return storage.getItem(name); } catch { return undefined; } };
  const load = (raw = rawOf(key)) => {
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch { return new Set(); }
  };
  const loadPending = (raw = rawOf(pendingKey)) => {
    let rows = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      rows = Array.isArray(parsed) ? parsed : [null];
    } catch { rows = [null]; }
    const now = Date.now();
    const kept = rows
      .filter((row) => Array.isArray(row) && typeof row[0] === 'string' && pressIdShape.test(row[0])
        && Number(row[1]?.since) > 0 && Number(row[1].since) <= now + PENDING_SINCE_SKEW_MS
        && Number.isSafeInteger(Number(row[1]?.floor)) && Number(row[1].floor) >= 0)
      .map(([pressId, press]) => [pressId, {
        since: Number(press.since), floor: Number(press.floor),
        ...(Number(press.settleAfter) > 0 && Number(press.settleAfter) <= Number(press.since) + PENDING_SETTLE_MAX_MS ? { settleAfter: Number(press.settleAfter) } : {}),
        ...(Number.isSafeInteger(Number(press.chainUntil)) && Number(press.chainUntil) > 0
          && Math.abs(Number(press.chainUntil) - Number(press.since)) <= PENDING_SETTLE_MAX_MS + 86_400_000 ? { chainUntil: Number(press.chainUntil) } : {}),
      }]);
    return { pending: new Map(kept), dropped: kept.length !== rows.length };
  };
  let heldRaw = rawOf(key);
  let pendingRaw = rawOf(pendingKey);
  const held = load(heldRaw);
  const { pending, dropped } = loadPending(pendingRaw);
  const MARKS_MAX = 4_096;
  const byTarget = new Map();
  const targetOf = (k) => k.slice(0, k.lastIndexOf('|') + 1);
  const indexAdd = (k) => {
    const prefix = targetOf(k);
    if (!byTarget.has(prefix)) byTarget.set(prefix, new Set());
    byTarget.get(prefix).add(Number(k.slice(prefix.length)));
  };
  const indexDelete = (k) => {
    const prefix = targetOf(k);
    const set = byTarget.get(prefix);
    if (!set) return;
    set.delete(Number(k.slice(prefix.length)));
    if (set.size === 0) byTarget.delete(prefix);
  };
  const trim = () => {
    while (held.size > MARKS_MAX) { const oldest = held.values().next().value; held.delete(oldest); indexDelete(oldest); }
  };
  for (const k of held) indexAdd(k);
  const overHeld = held.size > MARKS_MAX;
  trim();
  const notedHere = new Set();
  const forgotHere = new Set();
  const pendingNoted = new Map();
  const pendingSettled = new Set();
  const save = () => {
    const raw = JSON.stringify([...held]);
    try {
      storage?.setItem(key, raw);
      heldRaw = raw;
      notedHere.clear();
      forgotHere.clear();
    } catch { }
  };
  const savePending = () => {
    const raw = JSON.stringify([...pending]);
    try {
      storage?.setItem(pendingKey, raw);
      pendingRaw = raw;
      pendingNoted.clear();
      pendingSettled.clear();
    } catch { }
  };
  if (dropped) savePending();
  if (overHeld) save();
  const reload = () => {
    const raw = rawOf(key);
    if (raw === undefined || raw === heldRaw) return;
    heldRaw = raw;
    const fresh = load(raw);
    for (const k of forgotHere) fresh.delete(k);
    for (const k of notedHere) { fresh.delete(k); fresh.add(k); }
    held.clear();
    byTarget.clear();
    for (const k of fresh) { held.add(k); indexAdd(k); }
    trim();
  };
  const reloadPending = () => {
    const raw = rawOf(pendingKey);
    if (raw === undefined || raw === pendingRaw) return;
    pendingRaw = raw;
    const { pending: fresh } = loadPending(raw);
    for (const pressId of pendingSettled) fresh.delete(pressId);
    for (const [pressId, press] of pendingNoted) { fresh.delete(pressId); fresh.set(pressId, press); }
    pending.clear();
    for (const [pressId, press] of fresh) pending.set(pressId, press);
    while (pending.size > PENDING_MAX) pending.delete(pending.keys().next().value);
  };
  const id = (shardAddress, target, emoji) => `${String(shardAddress).toLowerCase()}|${BigInt(target)}|${Number(emoji)}`;
  return {
    has(shardAddress, target, emoji) { reload(); return held.has(id(shardAddress, target, emoji)); },
    note(shardAddress, target, emoji) {
      reload();
      const k = id(shardAddress, target, emoji);
      held.delete(k);
      held.add(k);
      indexAdd(k);
      notedHere.add(k);
      forgotHere.delete(k);
      trim();
      save();
    },
    forget(shardAddress, target, emoji) {
      reload();
      const k = id(shardAddress, target, emoji);
      held.delete(k);
      indexDelete(k);
      forgotHere.add(k);
      notedHere.delete(k);
      save();
    },
    mine(shardAddress, target) {
      return [...(byTarget.get(`${String(shardAddress).toLowerCase()}|${BigInt(target)}|`) ?? [])];
    },
    size() { return held.size; },
    notePending(shardAddress, target, emoji, { since, floor, settleAfter = null, chainUntil = null }) {
      reloadPending();
      const pressId = id(shardAddress, target, emoji);
      const press = { since: Number(since), floor: Number(floor), ...(Number(settleAfter) > 0 ? { settleAfter: Number(settleAfter) } : {}),
        ...(Number(chainUntil) > 0 ? { chainUntil: Number(chainUntil) } : {}) };
      pending.delete(pressId);
      pending.set(pressId, press);
      pendingNoted.set(pressId, press);
      pendingSettled.delete(pressId);
      while (pending.size > PENDING_MAX) pending.delete(pending.keys().next().value);
      savePending();
    },
    settlePending(shardAddress, target, emoji) {
      reloadPending();
      const pressId = id(shardAddress, target, emoji);
      pendingNoted.delete(pressId);
      pendingSettled.add(pressId);
      if (pending.delete(pressId)) savePending();
    },
    pendingPresses() {
      return [...pending].map(([pressId, press]) => {
        const [shard, target, emoji] = pressId.split('|');
        return { shard, target, emoji: Number(emoji), since: press.since, floor: press.floor, ...(press.settleAfter ? { settleAfter: press.settleAfter } : {}),
          ...(press.chainUntil ? { chainUntil: press.chainUntil } : {}) };
      });
    },
  };
}
