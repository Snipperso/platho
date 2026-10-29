const QR_VERSION = 5;
const QR_SIZE = 17 + 4 * QR_VERSION;
const QR_QUIET_ZONE = 4;
const QR_DATA_CODEWORDS = 86;
const QR_BLOCK_DATA_CODEWORDS = 43;
const QR_BLOCK_COUNT = 2;
const QR_ECC_CODEWORDS = 24;
const QR_MASK_PATTERN = 0;
const QR_ECL_FORMAT_BITS = 0;
const QR_FORMAT_MASK = 0x5412;
const QR_FORMAT_GENERATOR = 0x537;

function appendBits(bits, value, length) {
  const number = Number(value);
  for (let bit = length - 1; bit >= 0; bit -= 1) {
    bits.push((number >>> bit) & 1);
  }
}

function buildDataCodewords(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text ?? '')));
  const capacityBits = QR_DATA_CODEWORDS * 8;
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);
  if (bits.length > capacityBits) {
    throw new Error('QR payload is too long');
  }
  const terminator = Math.min(4, capacityBits - bits.length);
  appendBits(bits, 0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      byte = (byte << 1) | bits[index + offset];
    }
    data.push(byte);
  }
  for (let pad = 0; data.length < QR_DATA_CODEWORDS; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }
  return data;
}

function buildGfTables() {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < exp.length; index += 1) {
    exp[index] = exp[index - 255];
  }
  return { exp, log };
}

const GF = buildGfTables();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}

function reedSolomonGenerator(degree) {
  let poly = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF.exp[index]);
    }
    poly = next;
  }
  return poly;
}

const RS_GENERATOR = reedSolomonGenerator(QR_ECC_CODEWORDS);

function reedSolomonRemainder(data) {
  const result = new Array(QR_ECC_CODEWORDS).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[QR_ECC_CODEWORDS - 1] = 0;
    for (let index = 0; index < QR_ECC_CODEWORDS; index += 1) {
      result[index] ^= gfMul(RS_GENERATOR[index + 1], factor);
    }
  }
  return result;
}

function buildCodewords(text) {
  const data = buildDataCodewords(text);
  const blocks = [];
  const eccBlocks = [];
  for (let block = 0; block < QR_BLOCK_COUNT; block += 1) {
    const start = block * QR_BLOCK_DATA_CODEWORDS;
    const chunk = data.slice(start, start + QR_BLOCK_DATA_CODEWORDS);
    blocks.push(chunk);
    eccBlocks.push(reedSolomonRemainder(chunk));
  }
  const result = [];
  for (let index = 0; index < QR_BLOCK_DATA_CODEWORDS; index += 1) {
    for (const block of blocks) result.push(block[index]);
  }
  for (let index = 0; index < QR_ECC_CODEWORDS; index += 1) {
    for (const block of eccBlocks) result.push(block[index]);
  }
  return result;
}

function makeGrid() {
  return {
    modules: Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false)),
    reserved: Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false)),
  };
}

function setFunction(grid, x, y, dark) {
  if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return;
  grid.modules[y][x] = Boolean(dark);
  grid.reserved[y][x] = true;
}

function drawFinder(grid, x, y) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const inPattern = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inPattern && (
        dx === 0 || dx === 6 || dy === 0 || dy === 6
        || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
      );
      setFunction(grid, xx, yy, dark);
    }
  }
}

function drawAlignment(grid, cx, cy) {
  if (grid.reserved[cy]?.[cx]) return;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(grid, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function formatBits() {
  const data = (QR_ECL_FORMAT_BITS << 3) | QR_MASK_PATTERN;
  let rem = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((rem >>> bit) & 1) !== 0) {
      rem ^= QR_FORMAT_GENERATOR << (bit - 10);
    }
  }
  return ((data << 10) | rem) ^ QR_FORMAT_MASK;
}

function drawFormatBits(grid, bits) {
  const get = (index) => ((bits >>> index) & 1) !== 0;
  for (let index = 0; index <= 5; index += 1) setFunction(grid, 8, index, get(index));
  setFunction(grid, 8, 7, get(6));
  setFunction(grid, 8, 8, get(7));
  setFunction(grid, 7, 8, get(8));
  for (let index = 9; index < 15; index += 1) setFunction(grid, 14 - index, 8, get(index));
  for (let index = 0; index < 8; index += 1) setFunction(grid, QR_SIZE - 1 - index, 8, get(index));
  for (let index = 8; index < 15; index += 1) setFunction(grid, 8, QR_SIZE - 15 + index, get(index));
  setFunction(grid, 8, QR_SIZE - 8, true);
}

function drawFunctionPatterns(grid) {
  drawFinder(grid, 0, 0);
  drawFinder(grid, QR_SIZE - 7, 0);
  drawFinder(grid, 0, QR_SIZE - 7);
  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    const dark = index % 2 === 0;
    setFunction(grid, index, 6, dark);
    setFunction(grid, 6, index, dark);
  }
  drawAlignment(grid, 30, 30);
  drawFormatBits(grid, 0);
}

function shouldMask(x, y) {
  return (x + y) % 2 === 0;
}

function drawData(grid, codewords) {
  const bits = [];
  for (const codeword of codewords) appendBits(bits, codeword, 8);
  let bitIndex = 0;
  let upward = true;
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = upward ? QR_SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (grid.reserved[y][x]) continue;
        let dark = bits[bitIndex] === 1;
        bitIndex += 1;
        if (shouldMask(x, y)) dark = !dark;
        grid.modules[y][x] = dark;
      }
    }
    upward = !upward;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function createQrSvg(text, options = {}) {
  const grid = makeGrid();
  drawFunctionPatterns(grid);
  drawData(grid, buildCodewords(text));
  drawFormatBits(grid, formatBits());
  const size = QR_SIZE + QR_QUIET_ZONE * 2;
  const title = options.title ?? 'TON wallet address QR';
  const rects = [];
  for (let y = 0; y < QR_SIZE; y += 1) {
    let runStart = -1;
    for (let x = 0; x <= QR_SIZE; x += 1) {
      const dark = x < QR_SIZE && grid.modules[y][x];
      if (dark && runStart < 0) runStart = x;
      if ((!dark || x === QR_SIZE) && runStart >= 0) {
        rects.push(`<rect x="${runStart + QR_QUIET_ZONE}" y="${y + QR_QUIET_ZONE}" width="${x - runStart}" height="1"/>`);
        runStart = -1;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(title)}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects.join('')}</g></svg>`;
}

export function createQrSvgDataUrl(text, options = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createQrSvg(text, options))}`;
}
