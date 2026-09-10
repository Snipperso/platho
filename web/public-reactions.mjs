// PLATHO — reactions on public posts and comments: the client half of PublicShard's `React` [decided 2026-09-05].
//
// A REACTION IS A COUNTER, NOT AN ENTRY. The shard keeps one uint32 per (target, emoji) in its slot map; a reaction
// is a small message that turns one of them up. Nothing about the reactor is stored on chain, so a reaction cannot
// be withdrawn, and this device remembers its own presses locally so the button refuses a second one. Sixteen
// indices are frozen in the contract; the GLYPH each index shows is decided here and may change without a
// redeploy — but an index once used keeps its meaning, or history is rewritten.
//
// Where a target lives: a POST's counters sit in the CHANNEL shard that holds the post (the feed reads them with
// one getter per shard, for the posts on screen); a COMMENT's sit in the THREAD shard of its post.

import { beginCell, bytesToBase64, serializeBoc } from './pwa-contract-transactions.mjs?v=47';
import { readInt, readCell, cellReader, extractStack } from './public-shard-ton-rpc-provider.mjs?v=28';

/** "PSP4" — mirrors `message(0x50535034) React` in contracts18/contracts/PublicShard.tact. */
export const PUBLIC_REACT_OPCODE = 0x50535034;
/** PS_REACTION_EMOJIS: indices 0..15. */
export const PUBLIC_REACTION_COUNT = 16;
/** PS_REACTION_PAGE_CAP: targets one get_reactions answers (MEASURED 411,811 gas at a full page). */
export const PUBLIC_REACTION_PAGE_CAP = 32;

// The receiver's own demand, mirrored constant by constant: PS_REACT_GAS + PS_REACT_FEE + PS_FEE_TRANSPORT +
// PS_REACT_LEAF_ENDOWMENT. The leaf endowment is asked only for the FIRST reaction of its kind on a target; the
// client cannot cheaply know whether it is first, so it always brings it — the shard returns the difference as change.
export const PUBLIC_REACT_GAS = 2_500_000n;   // 2.0M until audit round 3 (2026-09-06): the hidden index shares the slot map
export const PUBLIC_REACT_FEE = 1_000_000n;
export const PUBLIC_REACT_FEE_TRANSPORT = 600_000n;
export const PUBLIC_REACT_LEAF_ENDOWMENT = 250_000n;
export const PUBLIC_REACT_VALUE = PUBLIC_REACT_GAS + PUBLIC_REACT_FEE + PUBLIC_REACT_FEE_TRANSPORT + PUBLIC_REACT_LEAF_ENDOWMENT;   // 4,350,000

/**
 * The sixteen glyphs, BY INDEX. The order is the contract's forever: index 3 has meant 🔥 since the first reaction
 * was published, and a client that showed something else there would be lying about every past count. Two rows
 * of eight in the picker.
 */
export const PUBLIC_REACTION_GLYPHS = Object.freeze([
  '❤️', '👍', '👎', '🔥', '😂', '😮', '😢', '🙏',
  '👏', '🤔', '🎉', '💯', '😍', '🤯', '😡', '💩',
]);

export function reactionGlyph(index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= PUBLIC_REACTION_COUNT) throw new RangeError(`no reaction at index ${index}`);
  return PUBLIC_REACTION_GLYPHS[i];
}

/**
 * The wallet message that reacts: `React{ target, emoji }` to the shard that holds the target, with the receiver's
 * demand attached. `shardAddress` is raw ("0:hex64"); `target` is the entry id in THAT shard.
 */
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

/**
 * get_reactions -> { from_target, count, entry_count, rows } with rows[i] = the sixteen counters of target
 * from_target + i. Walks the ref-chained 512-bit cells (tail first in the contract, so the chain is in order).
 */
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

/** The getter call for a page of targets — `stack` in the wire shape runGetMethod takes. */
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

/** Sum of a target's counters — what a card shows when there is no room for sixteen numbers. */
export function reactionsTotal(counters) {
  return (counters ?? []).reduce((sum, c) => sum + (Number(c) || 0), 0);
}

/** The non-zero counters, highest first — the row a card shows. */
export function reactionsShown(counters, limit = 6) {
  return (counters ?? [])
    .map((count, index) => ({ index, count: Number(count) || 0, glyph: PUBLIC_REACTION_GLYPHS[index] }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, limit);
}

/**
 * WHAT THIS DEVICE PRESSED. The chain keeps no name, so this is the only memory there is of "my" reactions — kept
 * per wallet, so another wallet on the same device starts clean. A press is remembered as soon as the message is
 * signed; the button refuses a second press on the same (shard, target, emoji) from then on.
 */
export function createOwnReactionStore({ storage = null, wallet = null } = {}) {
  const key = `platho.public.reactions.v1:${String(wallet ?? '').toLowerCase()}`;
  const load = () => {
    try {
      const raw = storage?.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch { return new Set(); }
  };
  const held = load();
  const save = () => { try { storage?.setItem(key, JSON.stringify([...held])); } catch { /* best effort */ } };
  const id = (shardAddress, target, emoji) => `${String(shardAddress).toLowerCase()}|${BigInt(target)}|${Number(emoji)}`;
  return {
    has(shardAddress, target, emoji) { return held.has(id(shardAddress, target, emoji)); },
    note(shardAddress, target, emoji) { held.add(id(shardAddress, target, emoji)); save(); },
    forget(shardAddress, target, emoji) { held.delete(id(shardAddress, target, emoji)); save(); },
    mine(shardAddress, target) {
      const prefix = `${String(shardAddress).toLowerCase()}|${BigInt(target)}|`;
      return [...held].filter((k) => k.startsWith(prefix)).map((k) => Number(k.slice(prefix.length)));
    },
    size() { return held.size; },
  };
}
