
import { sha256Sync } from './crypto/platho-crypto.mjs?v=31';
import { tonCell, createAthWalletMessage, estimateAthWalletAttachedValueNanotons } from './pwa-contract-transactions.mjs?v=59';

export const GROUP_ENTRY_BURN_BPS = 5000n;
export const GROUP_ENTRY_QUERY_DOMAIN = 'PLATHO.GROUP.ENTRY.V1';
export const ATH_INTERNAL_TRANSFER_OP = 0x41544812;
export const ATH_BURN_NOTIFICATION_OP = 0x41544802;

const encoder = new TextEncoder();

export function groupEntryShares(entryFee) {
  const fee = BigInt(entryFee ?? 0);
  if (fee <= 0n) return { owner: 0n, burn: 0n, total: 0n };
  const burn = (fee * GROUP_ENTRY_BURN_BPS) / 10000n;
  return { owner: fee - burn, burn, total: fee };
}

export function groupEntryQueryId(groupId, groupKey) {
  if (!(groupId instanceof Uint8Array) || groupId.length !== 32) throw new TypeError('a group id is 32 bytes');
  if (!(groupKey instanceof Uint8Array) || groupKey.length !== 32) throw new TypeError('a group key is 32 bytes');
  const domain = encoder.encode(GROUP_ENTRY_QUERY_DOMAIN);
  const material = new Uint8Array(domain.length + 64);
  material.set(domain, 0);
  material.set(groupId, domain.length);
  material.set(groupKey, domain.length + 32);
  const digest = sha256Sync(material);
  let id = 0n;
  for (let i = 0; i < 8; i += 1) id = (id << 8n) | BigInt(digest[i]);
  return id;
}

export function groupEntryPaymentMessages({ athWalletAddress, payerWallet, ownerWallet, entryFee, queryId, legs = { owner: true, burn: true }, values = null }) {
  const shares = groupEntryShares(entryFee);
  if (shares.total <= 0n || shares.owner <= 0n || shares.burn <= 0n) throw new RangeError('an entry fee splits into two shares, both above zero');
  if (String(ownerWallet ?? '') === '' || String(payerWallet ?? '') === '') throw new TypeError('a payment names the owner and the payer');
  if (legs?.owner !== true && legs?.burn !== true) throw new RangeError('a payment has at least one leg');
  const id = BigInt(queryId);
  const valueOf = (type, priced) => {
    const floor = estimateAthWalletAttachedValueNanotons(type);
    const value = priced === null || priced === undefined ? floor : BigInt(priced);
    return value > floor ? value : floor;
  };
  return [
    ...(legs.owner === true ? [createAthWalletMessage('ATHTransferRequest', {
      query_id: id, amount: shares.owner, recipient: ownerWallet, response_destination: payerWallet,
    }, { athWalletAddress, valueNanotons: valueOf('ATHTransferRequest', values?.owner) })] : []),
    ...(legs.burn === true ? [createAthWalletMessage('ATHBurn', {
      query_id: id, amount: shares.burn, response_destination: payerWallet,
    }, { athWalletAddress, valueNanotons: valueOf('ATHBurn', values?.burn) })] : []),
  ];
}


class CellBits {
  constructor(cell) {
    if (!cell || !(cell.data instanceof Uint8Array)) throw new TypeError('not a cell');
    this.data = cell.data;
    this.bits = Number(cell.bitLength ?? cell.data.length * 8);
    this.at = 0;
  }

  uint(n) {
    if (this.at + n > this.bits) throw new RangeError('cell underflow');
    let value = 0n;
    for (let i = 0; i < n; i += 1) {
      const bit = (this.data[this.at >> 3] >> (7 - (this.at & 7))) & 1;
      value = (value << 1n) | BigInt(bit);
      this.at += 1;
    }
    return value;
  }

  address() {
    if (this.uint(2) !== 2n) throw new RangeError('not addr_std');
    if (this.uint(1) !== 0n) throw new RangeError('anycast is not used');
    const workchain = Number(BigInt.asIntN(8, this.uint(8)));
    const hash = this.uint(256).toString(16).padStart(64, '0');
    return `${workchain}:${hash}`;
  }
}

export function readAthRowBody(cell) {
  const bits = new CellBits(cell);
  const op = Number(bits.uint(32));
  const queryId = bits.uint(64);
  const amount = bits.uint(128);
  const payer = bits.address();
  const response = bits.address();
  return { op, queryId, amount, payer, response };
}

const rawLower = (address) => String(address ?? '').trim().toLowerCase();

export const BOUNCED_OP = 0xffffffff;
export function readBouncedAthRowBody(cell) {
  const bits = new CellBits(cell);
  if (Number(bits.uint(32)) !== BOUNCED_OP) throw new RangeError('not a bounce');
  return { op: Number(bits.uint(32)), queryId: bits.uint(64), amount: bits.uint(128) };
}

function bouncedSum(rows, op, wanted, floor) {
  let sum = 0n;
  for (const row of Array.isArray(rows) ? rows : []) {
    const body = row?.message_content?.body ?? row?.body ?? null;
    const createdAt = Number(row?.created_at ?? row?.createdAt ?? 0) || 0;
    if (!body || createdAt < floor) continue;
    let fields;
    try { fields = readBouncedAthRowBody(tonCell.parseBocBase64(body)); } catch { continue; }
    if (fields.op !== op || fields.queryId !== wanted) continue;
    sum += fields.amount;
  }
  return sum;
}

export function verifyGroupEntryPayment({ transferRows = [], burnRows = [], transferBounces = [], burnBounces = [], queryId, payer, shares, since = 0 }) {
  const wanted = BigInt(queryId);
  const payerRaw = rawLower(payer);
  const floor = Number(since ?? 0) || 0;
  const leg = (rows, op) => {
    let sum = 0n;
    let at = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
      const body = row?.message_content?.body ?? row?.body ?? null;
      const createdAt = Number(row?.created_at ?? row?.createdAt ?? 0) || 0;
      if (!body || createdAt < floor) continue;
      let fields;
      try { fields = readAthRowBody(tonCell.parseBocBase64(body)); } catch { continue; }
      if (fields.op !== op || fields.queryId !== wanted || rawLower(fields.payer) !== payerRaw) continue;
      sum += fields.amount;
      if (createdAt > at) at = createdAt;
    }
    return { sum, at };
  };
  const transfer = leg(transferRows, ATH_INTERNAL_TRANSFER_OP);
  const burn = leg(burnRows, ATH_BURN_NOTIFICATION_OP);
  const ownerSum = transfer.sum - bouncedSum(transferBounces, ATH_INTERNAL_TRANSFER_OP, wanted, floor);
  const burnSum = burn.sum - bouncedSum(burnBounces, ATH_BURN_NOTIFICATION_OP, wanted, floor);
  const ownerPaid = ownerSum >= BigInt(shares?.owner ?? 0n);
  const burnPaid = burnSum >= BigInt(shares?.burn ?? 0n);
  return { paid: ownerPaid && burnPaid, ownerPaid, burnPaid, ownerSum, burnSum, at: Math.max(transfer.at, burn.at) };
}
