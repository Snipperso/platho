import { beginCell, Cell } from '@ton/core';

export const FINAL_PRIVATE_HEADER0_BYTES = 140;
export const FINAL_PRIVATE_HEADER1_BYTES = 30;
export const FINAL_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES = 1204;
export const FINAL_PRIVATE_HYBRID_BODY_BYTES = FINAL_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES + 1024;
export const FINAL_PUBLIC_HEADER_MAX_BYTES = 72;
export const FINAL_PUBLIC_BODY_MAX_BYTES = 1024;

export function snakeCell(byteLength: number, fill = 0x61): Cell {
  const bytes = Buffer.alloc(byteLength, fill);
  let tail: Cell | null = null;
  for (let offset = bytes.length; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().storeBuffer(bytes.subarray(start, offset));
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

export function finalPrivateHeader0Cell(fill = 0x30): Cell {
  return snakeCell(FINAL_PRIVATE_HEADER0_BYTES, fill);
}

export function finalPrivateHeader1Cell(fill = 0x31): Cell {
  return snakeCell(FINAL_PRIVATE_HEADER1_BYTES, fill);
}

export function finalPrivateBodyBytes(sizeClass: bigint | number = 1, cryptoSuite: bigint | number = 2): number {
  const size = typeof sizeClass === 'bigint' ? Number(sizeClass) : sizeClass;
  const suite = typeof cryptoSuite === 'bigint' ? Number(cryptoSuite) : cryptoSuite;
  if (suite !== 2) throw new RangeError(`Unsupported private capsule suite ${suite}`);
  return FINAL_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES + (size * 1024);
}

export function finalPrivateBodyCell(sizeClass: bigint | number = 1, fill = 0x62, cryptoSuite: bigint | number = 2): Cell {
  return snakeCell(finalPrivateBodyBytes(sizeClass, cryptoSuite), fill);
}

export function finalPublicBodyCell(fill = 0x70, byteLength = FINAL_PUBLIC_BODY_MAX_BYTES): Cell {
  return snakeCell(byteLength, fill);
}

export function finalPublicHeaderCell(fill = 0x50, byteLength = 8): Cell {
  return snakeCell(byteLength, fill);
}
