import { beginCell, Cell } from '@ton/core';

export const FINAL_PRIVATE_HEADER0_BYTES = 140;
export const FINAL_PRIVATE_HEADER1_BYTES = 30;
export const FINAL_PRIVATE_STANDARD_BODY_BYTES = 1140;
export const FINAL_PRIVATE_HYBRID_BODY_BYTES = 2228;
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

export function finalPrivateBodyCell(sizeClass: bigint | number = 1, fill = 0x62): Cell {
  const size = typeof sizeClass === 'bigint' ? Number(sizeClass) : sizeClass;
  return snakeCell(size === 2 ? FINAL_PRIVATE_HYBRID_BODY_BYTES : FINAL_PRIVATE_STANDARD_BODY_BYTES, fill);
}

export function finalPublicBodyCell(fill = 0x70, byteLength = FINAL_PUBLIC_BODY_MAX_BYTES): Cell {
  return snakeCell(byteLength, fill);
}

export function finalPublicHeaderCell(fill = 0x50, byteLength = 8): Cell {
  return snakeCell(byteLength, fill);
}
