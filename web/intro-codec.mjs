// intro-codec — read INTRO shard data in the BROWSER, without @ton/core and without build/*.ts.
//
// The live client only ever WRITES cells: it builds outgoing messages and never parses an incoming one. The
// clean-17 receive path has to do the opposite — recover a capsule from a shard's transaction history and check
// it against the commitment the contract stored — so this module adds the reading half.
//
// It is deliberately tiny and total: every parse either returns the exact structure or throws. There is no
// "best effort" path, because the caller is verifying data from an endpoint nobody trusts, and a parser that
// guesses would hand it a plausible-looking capsule.
//
// tests/intro-codec.test.ts pins every function against the compiled Tact wrapper on real published messages.
// Two independent implementations agreeing is the only evidence worth having — see shard-address.mjs for why
// that standard applies to this whole client path.

import { stackNum } from './ton-stack-num.mjs?v=1';

/** Message opcode of IntroPublish — mirrors `message(0x49535031) IntroPublish` in contracts/IntroShard.tact. */
export const INTRO_PUBLISH_OPCODE = 0x49535031;

/** A read cursor over a parsed cell: `{ data: Uint8Array, bitLength: number, refs: Cell[] }`. */
export function readerOf(cell) {
  return { cell, bit: 0, ref: 0 };
}

function bitAt(data, index) {
  return (data[index >> 3] >> (7 - (index & 7))) & 1;
}

export function readUint(reader, bits, name = 'uint') {
  if (!Number.isInteger(bits) || bits < 0 || bits > 256) throw new RangeError(`${name}: bad width ${bits}`);
  if (reader.bit + bits > reader.cell.bitLength) {
    throw new Error(`${name}: cell has ${reader.cell.bitLength - reader.bit} bits left, needed ${bits}`);
  }
  let value = 0n;
  for (let i = 0; i < bits; i += 1) {
    value = (value << 1n) | BigInt(bitAt(reader.cell.data, reader.bit + i));
  }
  reader.bit += bits;
  return value;
}

export function readRef(reader, name = 'ref') {
  const cell = reader.cell.refs[reader.ref];
  if (!cell) throw new Error(`${name}: cell has no ref at index ${reader.ref}`);
  reader.ref += 1;
  return cell;
}

/**
 * Parse an IntroPublish message body.
 *
 * Layout, straight from the contract:
 *   op:uint32 = 0x49535031 | r:uint256 | view_tag:uint16 | ^header_0 | ^body
 *
 * Throws on anything else — including a body that is well-formed but carries a different opcode, which is exactly
 * what a shard's history is full of (evictions, plain top-ups) and must not be mistaken for a capsule.
 */
export function parseIntroPublish(cell) {
  const reader = readerOf(cell);
  const opcode = Number(readUint(reader, 32, 'opcode'));
  if (opcode !== INTRO_PUBLISH_OPCODE) {
    throw new Error(`not an IntroPublish (opcode 0x${opcode.toString(16)})`);
  }
  const r = readUint(reader, 256, 'r');
  const viewTag = Number(readUint(reader, 16, 'view_tag'));
  const header0 = readRef(reader, 'header_0');
  const body = readRef(reader, 'body');
  return { r, viewTag, header0, body };
}

/** True when a cell is an IntroPublish, without throwing — for walking a history full of other messages. */
export function isIntroPublish(cell) {
  try { parseIntroPublish(cell); return true; } catch { return false; }
}

/**
 * IntroEntryView, as get_entry returns it: exists, r, view_tag, body_commit, created_at.
 * The stack comes from toncenter as `[{type, value}, ...]`; numeric values arrive as hex strings.
 */
export function parseIntroEntryStack(stack) {
  if (!Array.isArray(stack) || stack.length < 5) {
    throw new Error(`get_entry returned ${stack?.length ?? 0} stack items, expected 5`);
  }
  // `exists` is a Tact Bool, so a TRUE one arrives as the string "-0x1" — see ton-stack-num.mjs. BigInt() refuses it,
  // which threw on every entry that DID exist and broke first contact on the live chain.
  const num = (i, name) => stackNum(stack[i]?.value, `get_entry: ${name}`);
  return {
    exists: num(0, 'exists') !== 0n,
    r: num(1, 'r'),
    view_tag: Number(num(2, 'view_tag')),
    body_commit: num(3, 'body_commit'),
    created_at: Number(num(4, 'created_at')),
  };
}
