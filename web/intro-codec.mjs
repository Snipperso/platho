
import { stackNum } from './ton-stack-num.mjs?v=2';

export const INTRO_PUBLISH_OPCODE = 0x49535031;

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

export function isIntroPublish(cell) {
  try { parseIntroPublish(cell); return true; } catch { return false; }
}

export const INTRO_ENTRY_VIEW_ARITY = 5;

export function parseIntroEntryStack(stack) {
  if (!Array.isArray(stack) || stack.length !== INTRO_ENTRY_VIEW_ARITY) {
    throw new Error(`get_entry returned ${stack?.length ?? 0} stack items, expected ${INTRO_ENTRY_VIEW_ARITY}`);
  }
  const num = (i, name) => stackNum(stack[i]?.value, `get_entry: ${name}`);
  return {
    exists: num(0, 'exists') !== 0n,
    r: num(1, 'r'),
    view_tag: Number(num(2, 'view_tag')),
    body_commit: num(3, 'body_commit'),
    created_at: Number(num(4, 'created_at')),
  };
}
