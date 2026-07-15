import { beginCell, Cell } from '@ton/core';

// clean-16 ИНК2: the CONV (publish_kind=PRIVATE) header0 is now 40 bytes (320 bits, one cell, zero refs) =
// meta(8) + opaque bucketKey(32). Was 140 bytes (1120 bits, 2 cells) with sender+recipient keyIds pre-clean-16.
export const FINAL_PRIVATE_HEADER0_BYTES = 40;
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
  // clean-16 ИНК3: byte@5 = the embedded publishKind must equal the batch publish_kind (PRIVATE/CONV = 1),
  // or the Hub meta-assert (13519) rejects the capsule. The rest is uniform fill; the bucketKey lives at
  // bytes 8..40, so a per-part fill still yields a distinct bucketKey.
  const bytes = Buffer.alloc(FINAL_PRIVATE_HEADER0_BYTES, fill);
  bytes[5] = 1;
  return snakeCellFromBytes(bytes);
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

// clean-16 ИНК4 INTRO lane fixtures. header0 = 42 bytes (336 bits, 1 cell, 0 refs) = meta(8) + ephemeral_R(32)
// + view_tag(2). byte@5 = publishKind = INTRO(3), to satisfy the Hub meta-assert (13549). The INTRO body carries
// the ML-KEM ct_root + handshake fields, so its overhead (G8-provisional) is larger than the CONV 1204.
export const FINAL_INTRO_HEADER0_BYTES = 42;
export const FINAL_INTRO_HYBRID_BODY_OVERHEAD_BYTES = 2388;

export function finalIntroHeader0Cell(fill = 0x33): Cell {
  const bytes = Buffer.alloc(FINAL_INTRO_HEADER0_BYTES, fill);
  bytes[5] = 3; // publishKind = INTRO
  return snakeCellFromBytes(bytes);
}

export function finalIntroBodyBytes(sizeClass: bigint | number = 1): number {
  const size = typeof sizeClass === 'bigint' ? Number(sizeClass) : sizeClass;
  return FINAL_INTRO_HYBRID_BODY_OVERHEAD_BYTES + size * 1024;
}

export function finalIntroBodyCell(sizeClass: bigint | number = 1, fill = 0x64): Cell {
  return snakeCellFromBytes(Buffer.alloc(finalIntroBodyBytes(sizeClass), fill));
}
