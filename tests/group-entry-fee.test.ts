import { describe, expect, it } from 'vitest';
import {
  ATH_BURN_NOTIFICATION_OP, ATH_INTERNAL_TRANSFER_OP, GROUP_ENTRY_BURN_BPS, GROUP_ENTRY_QUERY_DOMAIN,
  groupEntryPaymentMessages, groupEntryQueryId, groupEntryShares, readAthRowBody, verifyGroupEntryPayment, BOUNCED_OP,
} from '../web/group-entry-fee.mjs';
import { ATH_WALLET_OPS, buildAthWalletMessageBody, tonCell } from '../web/pwa-contract-transactions.mjs';
import { sha256Sync } from '../web/crypto/platho-crypto.mjs';


const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const PAYER = `0:${'11'.repeat(32)}`;
const OWNER = `0:${'22'.repeat(32)}`;
const ATH_WALLET = `0:${'33'.repeat(32)}`;
const GROUP = bytes(0x44);
const KEY = bytes(0x55);

const rowOf = (op: number, queryId: bigint, amount: bigint, payer: string, createdAt: number, response = payer) => ({
  message_content: {
    body: tonCell.beginCell().uint(BigInt(op), 32, 'op').uint(queryId, 64, 'query_id').uint(amount, 128, 'amount')
      .address(payer, 'payer').address(response, 'response').toBocBase64(),
  },
  created_at: createdAt,
});

describe('GROUP-ENTRY-FEE — the price of the public door', () => {
  it('FEE-01: the split is the protocol\'s, not the owner\'s — half burned, rounded down, the owner keeps the rest', () => {
    expect(GROUP_ENTRY_BURN_BPS).toBe(5000n);
    expect(groupEntryShares('1000000001')).toEqual({ owner: 500000001n, burn: 500000000n, total: 1000000001n });
    expect(groupEntryShares(2n)).toEqual({ owner: 1n, burn: 1n, total: 2n });
    expect(groupEntryShares(0)).toEqual({ owner: 0n, burn: 0n, total: 0n });
    expect(groupEntryShares(null)).toEqual({ owner: 0n, burn: 0n, total: 0n });
  });

  it('FEE-02: both legs carry ONE query id — a uint64 cut from sha-256 over the domain, the room and the payer\'s key — so the admitting device finds them from the token alone', () => {
    const id = groupEntryQueryId(GROUP, KEY);
    expect(id).toBe(groupEntryQueryId(GROUP, KEY));
    expect(id).toBeLessThan(1n << 64n);
    const material = new Uint8Array([...new TextEncoder().encode(GROUP_ENTRY_QUERY_DOMAIN), ...GROUP, ...KEY]);
    const digest = sha256Sync(material);
    expect(id.toString(16).padStart(16, '0')).toBe(Buffer.from(digest.subarray(0, 8)).toString('hex'));
    expect(groupEntryQueryId(GROUP, bytes(0x56))).not.toBe(id);
    expect(groupEntryQueryId(bytes(0x45), KEY)).not.toBe(id);
    expect(() => groupEntryQueryId(bytes(0x44, 31), KEY)).toThrow(/32 bytes/);
    expect(() => groupEntryQueryId(GROUP, bytes(0x55, 33))).toThrow(/32 bytes/);
  });

  it('FEE-03: the payment is two operations of the payer\'s ATH wallet in one transaction — the owner\'s half as a transfer, the other half the protocol\'s own ATHBurn — both under the query id', () => {
    const queryId = groupEntryQueryId(GROUP, KEY);
    const messages = groupEntryPaymentMessages({ athWalletAddress: ATH_WALLET, payerWallet: PAYER, ownerWallet: OWNER, entryFee: '5000000001', queryId });
    expect(messages.length).toBe(2);
    expect(messages.map((m: any) => m.address)).toEqual([ATH_WALLET, ATH_WALLET]);
    expect(messages[0].payload).toBe(buildAthWalletMessageBody('ATHTransferRequest', {
      query_id: queryId, amount: 2500000001n, recipient: OWNER, response_destination: PAYER,
    }));
    expect(messages[1].payload).toBe(buildAthWalletMessageBody('ATHBurn', { query_id: queryId, amount: 2500000000n, response_destination: PAYER }));
    expect(ATH_WALLET_OPS.ATHBurn).toBe(0x41544801);
    expect(readAthRowBody(tonCell.parseBocBase64(messages[0].payload)).op).toBe(ATH_WALLET_OPS.ATHTransferRequest);
    for (const message of messages) expect(BigInt(message.amount)).toBeGreaterThan(0n);
    expect(() => groupEntryPaymentMessages({ athWalletAddress: ATH_WALLET, payerWallet: PAYER, ownerWallet: OWNER, entryFee: 1n, queryId })).toThrow(/both above zero/);
    expect(() => groupEntryPaymentMessages({ athWalletAddress: ATH_WALLET, payerWallet: PAYER, ownerWallet: '', entryFee: 10n, queryId })).toThrow(/owner and the payer/);
  });

  it('FEE-05: a bounced leg is subtracted — a refused message is indexed like an accepted one — and a payment may be one leg', () => {
    const queryId = groupEntryQueryId(GROUP, KEY);
    const shares = groupEntryShares('5000000000');
    const transfer = rowOf(ATH_INTERNAL_TRANSFER_OP, queryId, shares.owner, PAYER, 1_800_000_100);
    const burn = rowOf(ATH_BURN_NOTIFICATION_OP, queryId, shares.burn, PAYER, 1_800_000_110);
    const bounceOf = (op: number, amount: bigint, createdAt: number, id: bigint = queryId) => ({
      message_content: { body: tonCell.beginCell().uint(BigInt(BOUNCED_OP), 32, 'b').uint(BigInt(op), 32, 'op').uint(id, 64, 'q').uint(amount, 128, 'a').toBocBase64() },
      created_at: createdAt,
    });
    const check = (over: any = {}) => verifyGroupEntryPayment({ transferRows: [transfer], burnRows: [burn], queryId, payer: PAYER, shares, ...over });
    expect(check().paid).toBe(true);
    expect(check({ transferBounces: [bounceOf(ATH_INTERNAL_TRANSFER_OP, shares.owner, 1_800_000_120)] })).toMatchObject({ paid: false, ownerPaid: false, burnPaid: true, ownerSum: 0n });
    expect(check({ burnBounces: [bounceOf(ATH_BURN_NOTIFICATION_OP, shares.burn, 1_800_000_120)] })).toMatchObject({ paid: false, burnPaid: false });
    expect(check({ transferBounces: [bounceOf(ATH_BURN_NOTIFICATION_OP, shares.owner, 1_800_000_120)] }).paid).toBe(true);
    expect(check({ transferBounces: [bounceOf(ATH_INTERNAL_TRANSFER_OP, shares.owner, 1_800_000_120, queryId ^ 1n)] }).paid, 'another id\'s bounce is somebody else\'s').toBe(true);
    expect(check({ transferBounces: [{ message_content: { body: transfer.message_content.body }, created_at: 1_800_000_120 }] }).paid, 'a plain row is not a bounce').toBe(true);
    const ownerOnly = groupEntryPaymentMessages({ athWalletAddress: ATH_WALLET, payerWallet: PAYER, ownerWallet: OWNER, entryFee: '5000000001', queryId, legs: { owner: true, burn: false } });
    expect(ownerOnly.length).toBe(1);
    expect(readAthRowBody(tonCell.parseBocBase64(ownerOnly[0].payload)).op).toBe(ATH_WALLET_OPS.ATHTransferRequest);
    const burnOnly = groupEntryPaymentMessages({ athWalletAddress: ATH_WALLET, payerWallet: PAYER, ownerWallet: OWNER, entryFee: '5000000001', queryId, legs: { owner: false, burn: true } });
    expect(burnOnly.length).toBe(1);
    expect(Number(tonCell.parseBocBase64(burnOnly[0].payload).data[3] | (tonCell.parseBocBase64(burnOnly[0].payload).data[2] << 8))).toBe(ATH_WALLET_OPS.ATHBurn & 0xffff);
    expect(() => groupEntryPaymentMessages({ athWalletAddress: ATH_WALLET, payerWallet: PAYER, ownerWallet: OWNER, entryFee: '5000000001', queryId, legs: { owner: false, burn: false } })).toThrow(/at least one leg/);
  });

  it('FEE-04: the check reads the ATHInternalTransfer at the owner\'s ATH wallet and the ATHBurnNotification at the master — both legs, under the id, from the payer, after the floor', () => {
    const queryId = groupEntryQueryId(GROUP, KEY);
    const shares = groupEntryShares('5000000000');
    const transfer = rowOf(ATH_INTERNAL_TRANSFER_OP, queryId, shares.owner, PAYER, 1_800_000_100);
    const burn = rowOf(ATH_BURN_NOTIFICATION_OP, queryId, shares.burn, PAYER, 1_800_000_110);
    const check = (over: any = {}) => verifyGroupEntryPayment({ transferRows: [transfer], burnRows: [burn], queryId, payer: PAYER, shares, ...over });
    expect(check()).toMatchObject({ paid: true, ownerPaid: true, burnPaid: true, ownerSum: shares.owner, burnSum: shares.burn, at: 1_800_000_110 });
    expect(check({ burnRows: [] })).toMatchObject({ paid: false, ownerPaid: true, burnPaid: false });
    expect(check({ transferRows: [] })).toMatchObject({ paid: false, ownerPaid: false, burnPaid: true });
    expect(check({ queryId: queryId ^ 1n }).paid).toBe(false);
    expect(check({ payer: OWNER }).paid).toBe(false);
    expect(check({ burnRows: [transfer] }).burnPaid).toBe(false);
    expect(check({ shares: { owner: shares.owner + 1n, burn: shares.burn } }).paid).toBe(false);
    const half = rowOf(ATH_INTERNAL_TRANSFER_OP, queryId, shares.owner / 2n, PAYER, 1_800_000_050);
    expect(check({ transferRows: [half, rowOf(ATH_INTERNAL_TRANSFER_OP, queryId, shares.owner - shares.owner / 2n, PAYER, 1_800_000_060)] }).ownerPaid).toBe(true);
    expect(check({ since: 1_800_000_105 })).toMatchObject({ paid: false, ownerPaid: false, burnPaid: true });
    expect(check({ since: 1_800_000_100 }).paid, 'the floor is inclusive').toBe(true);
    expect(check({ transferRows: [{ message_content: { body: 'not a boc' }, created_at: 1 }, transfer] }).paid).toBe(true);
    expect(check({ transferRows: [{ message_content: null }, transfer] }).paid).toBe(true);
    expect(() => readAthRowBody(tonCell.parseBocBase64(tonCell.beginCell().uint(1n, 32, 'op').uint(1n, 64, 'q').uint(1n, 128, 'a').uint(0n, 2, 'addr_none').toBocBase64()))).toThrow(/addr_std|underflow/);
    expect(readAthRowBody(tonCell.parseBocBase64(transfer.message_content.body))).toEqual({
      op: ATH_INTERNAL_TRANSFER_OP, queryId, amount: shares.owner, payer: PAYER, response: PAYER,
    });
  });
});
