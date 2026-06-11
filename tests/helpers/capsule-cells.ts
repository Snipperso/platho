import { beginCell, Cell } from '@ton/core';

export const FINAL_PRIVATE_HEADER0_BYTES = 140;
export const FINAL_PRIVATE_HEADER1_BYTES = 30;
export const FINAL_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES = 1204;
export const FINAL_PRIVATE_HYBRID_BODY_BYTES = FINAL_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES + 1024;
export const FINAL_PUBLIC_HEADER_MAX_BYTES = 72;
export const FINAL_PUBLIC_1K_BODY_BYTES = 1024;
export const FINAL_PUBLIC_32K_BODY_BYTES = 32 * 1024;

export function snakeCell(byteLength: number, fill = 0x61): Cell {
  const bytes = Buffer.alloc(byteLength, fill);
  return snakeCellFromBytes(bytes);
}

export function snakeCellFromBytes(bytes: Buffer | Uint8Array): Cell {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < bytes.length; offset += 127) {
    chunks.push(Buffer.from(bytes.subarray(offset, offset + 127)));
  }
  let tail: Cell | null = null;
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const builder = beginCell().storeBuffer(chunks[index]);
    if (tail) builder.storeRef(tail);
    tail = builder.endCell();
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

export function finalPublicBodyCell(fill = 0x70, byteLength = FINAL_PUBLIC_1K_BODY_BYTES): Cell {
  return snakeCell(byteLength, fill);
}

export function finalPublicHeaderCell(fill = 0x50, byteLength = 8): Cell {
  return snakeCell(byteLength, fill);
}
