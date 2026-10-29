export const POOL_STATES_MAX = 100;

function bytesOf(base64) {
  const text = atob(String(base64));
  const out = new Uint8Array(text.length);
  for (let at = 0; at < text.length; at += 1) out[at] = text.charCodeAt(at);
  return out;
}
const popcount = (value) => { let count = 0; for (let rest = value; rest; rest >>= 1) count += rest & 1; return count; };

export function bocRootCell(base64) {
  const b = bytesOf(base64);
  if (b.length < 6 || b[0] !== 0xb5 || b[1] !== 0xee || b[2] !== 0x9c || b[3] !== 0x72) throw new Error('pool data: not a BoC');
  const hasIndex = (b[4] & 0x80) !== 0;
  const size = b[4] & 0x07;
  const offsetBytes = b[5];
  let at = 6;
  const read = (width) => { let value = 0; for (let i = 0; i < width; i += 1) value = value * 256 + b[at + i]; at += width; return value; };
  const cells = read(size);
  const roots = read(size);
  read(size);
  read(offsetBytes);
  const root = read(size);
  at += (roots - 1) * size;
  if (hasIndex) at += cells * offsetBytes;
  for (let index = 0; index < cells && at + 2 <= b.length; index += 1) {
    const d1 = b[at];
    const d2 = b[at + 1];
    at += 2;
    if (d1 & 16) at += (popcount(d1 >> 5) + 1) * 34;
    const length = Math.ceil(d2 / 2);
    const data = b.subarray(at, at + length);
    at += length + (d1 & 7) * size;
    if (index !== root) continue;
    let bitLength = length * 8;
    if (d2 % 2 === 1) {
      let trailing = 0;
      while (trailing < 8 && ((data[length - 1] >> trailing) & 1) === 0) trailing += 1;
      bitLength -= trailing + 1;
    }
    return { data, bitLength };
  }
  throw new Error('pool data: the root cell is missing');
}

function bitReader({ data, bitLength }) {
  let bit = 0;
  const loadUint = (width) => {
    if (bit + width > bitLength) throw new Error('pool data: read past its end');
    let value = 0n;
    for (let i = 0; i < width; i += 1, bit += 1) value = (value << 1n) | BigInt((data[bit >> 3] >> (7 - (bit & 7))) & 1);
    return value;
  };
  const coins = () => { const bytes = Number(loadUint(4)); return bytes ? loadUint(bytes * 8) : 0n; };
  return { loadUint, coins };
}

export function poolReservesFromData(dex, dataBoc) {
  const reader = bitReader(bocRootCell(dataBoc));
  if (dex === 'stonfi') reader.loadUint(1);
  else if (dex === 'dedust') { reader.loadUint(32); reader.coins(); } else throw new Error(`pool data: no layout for ${dex}`);
  return [reader.coins(), reader.coins()];
}

async function readAccountStates(fetchImpl, origin, addresses, includeBoc) {
  const response = await fetchImpl(`${origin}/api/v3/accountStates?${addresses.map((address) => `address=${encodeURIComponent(address)}`).join('&')}&include_boc=${includeBoc ? 'true' : 'false'}`);
  if (!response?.ok) throw Object.assign(new Error(`pool states: HTTP ${response?.status}`), { status: response?.status });
  const body = await response.json();
  return new Map((Array.isArray(body?.accounts) ? body.accounts : []).map((account) => [String(account.address).toLowerCase(), account]));
}
function reservesInto(out, batch, byAddress) {
  for (const pool of batch) {
    const account = byAddress.get(String(pool.address).toLowerCase());
    if (!account?.data_boc || account.status !== 'active') continue;
    try { out.set(String(pool.address).toLowerCase(), poolReservesFromData(pool.dex, account.data_boc)); } catch { }
  }
}

export async function readPoolReserves({ fetchImpl, origin, pools }) {
  const out = new Map();
  for (let at = 0; at < pools.length; at += POOL_STATES_MAX) {
    const batch = pools.slice(at, at + POOL_STATES_MAX);
    reservesInto(out, batch, await readAccountStates(fetchImpl, origin, batch.map((pool) => pool.address), true));
  }
  return out;
}

export async function readBalanceAndReserves({ fetchImpl, origin, account, pools = [] }) {
  const batch = pools.slice(0, POOL_STATES_MAX - 1);
  const byAddress = await readAccountStates(fetchImpl, origin, [account, ...batch.map((pool) => pool.address)], batch.length > 0);
  const mine = byAddress.get(String(account).toLowerCase());
  let balance = null;
  if (mine) { try { balance = BigInt(String(mine.balance ?? '0')); } catch { balance = null; } }
  const reserves = new Map();
  reservesInto(reserves, batch, byAddress);
  return { balance, reserves };
}
