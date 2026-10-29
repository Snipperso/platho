import { describe, expect, it } from 'vitest';
import { Address, Cell } from '@ton/core';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { encodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';
import {
  JETTON_TRANSFER_OPCODE, NFT_TRANSFER_OPCODE, TRANSFER_COMMENT_MAX_BYTES, buildJettonTransferBody, buildNftTransferBody, parseUnits,
  readJettonWalletAddress, readNftOwner,
} from '../web/wallet-transfers.mjs';


const ME = '0:' + '11'.repeat(32);
const YOU = '0:' + '22'.repeat(32);
const MASTER = '0:' + '33'.repeat(32);
const JW = '0:' + '44'.repeat(32);
const parsed = (cell: any) => Cell.fromBoc(Buffer.from(serializeBoc(cell)))[0].beginParse();

describe('the messages', () => {
  it('SEND-01: a jetton transfer is TEP-74\'s, field by field — the comment a text comment in a cell of its own, the notification 1 nanoGRAM', () => {
    const slice = parsed(buildJettonTransferBody({ queryId: 7n, amount: 6_296_726n, destination: YOU, responseDestination: ME, comment: '\u0441\u043f\u0430\u0441\u0438\u0431\u043e' }));
    expect(BigInt(slice.loadUint(32))).toBe(JETTON_TRANSFER_OPCODE);
    expect(slice.loadUintBig(64)).toBe(7n);
    expect(slice.loadCoins()).toBe(6_296_726n);
    expect(slice.loadAddress()!.equals(Address.parse(YOU))).toBe(true);
    expect(slice.loadAddress()!.equals(Address.parse(ME))).toBe(true);
    expect(slice.loadBit(), 'no custom payload').toBe(false);
    expect(slice.loadCoins(), 'the notification').toBe(1n);
    expect(slice.loadBit(), 'the comment by reference').toBe(true);
    const comment = slice.loadRef().beginParse();
    expect(comment.loadUint(32)).toBe(0);
    expect(comment.loadStringTail()).toBe('\u0441\u043f\u0430\u0441\u0438\u0431\u043e');
    expect(slice.remainingBits).toBe(0);
    const bare = parsed(buildJettonTransferBody({ queryId: 1n, amount: 1n, destination: YOU, responseDestination: ME }));
    bare.skip(32 + 64); bare.loadCoins(); bare.loadAddress(); bare.loadAddress(); bare.loadBit(); bare.loadCoins();
    expect([bare.loadBit(), bare.remainingBits, bare.remainingRefs], 'no comment: an empty inline payload').toEqual([false, 0, 0]);
  });

  it('SEND-02: an NFT transfer is TEP-62\'s; addresses off the basechain and comments too long are refused before anything is signed', () => {
    const slice = parsed(buildNftTransferBody({ queryId: 9n, newOwner: YOU, responseDestination: ME, comment: 'gift' }));
    expect(BigInt(slice.loadUint(32))).toBe(NFT_TRANSFER_OPCODE);
    expect(slice.loadUintBig(64)).toBe(9n);
    expect(slice.loadAddress()!.equals(Address.parse(YOU))).toBe(true);
    expect(slice.loadAddress()!.equals(Address.parse(ME))).toBe(true);
    expect([slice.loadBit(), slice.loadCoins(), slice.loadBit()]).toEqual([false, 1n, true]);
    expect(slice.loadRef().beginParse().skip(32).loadStringTail()).toBe('gift');
    expect(() => buildNftTransferBody({ queryId: 1n, newOwner: '-1:' + '22'.repeat(32), responseDestination: ME })).toThrow(/basechain/);
    expect(() => buildJettonTransferBody({ queryId: 1n, amount: 1n, destination: YOU, responseDestination: ME, comment: 'x'.repeat(TRANSFER_COMMENT_MAX_BYTES + 1) }))
      .toThrow(expect.objectContaining({ code: 'COMMENT_TOO_LONG' }));
    expect(() => buildJettonTransferBody({ queryId: 1n, amount: 0n, destination: YOU, responseDestination: ME })).toThrow();
  });

  it('SEND-03: an amount as a person types it, in the token\'s own decimals — never more places than the token has, never zero', () => {
    expect([parseUnits('1.5', 6), parseUnits('0,25', 9), parseUnits('100', 0), parseUnits(' 1 000.5 ', 2), parseUnits('.5', 1)]).toEqual([1_500_000n, 250_000_000n, 100n, 100_050n, 5n]);
    for (const [input, decimals, code] of [['1.234', 2, 'AMOUNT_TOO_PRECISE'], ['0', 9, 'AMOUNT_ZERO'], ['abc', 9, 'AMOUNT_INVALID'], ['1.2.3', 9, 'AMOUNT_INVALID'], ['-1', 9, 'AMOUNT_INVALID']] as const) {
      expect(() => parseUnits(input, decimals), `${input} at ${decimals}`).toThrow(expect.objectContaining({ code }));
    }
  });
});

describe('the chain reads', () => {
  it('SEND-04: the jetton wallet is the one the master names on chain — refused where the index named another', async () => {
    const asked: any[] = [];
    const transport = { runGetMethod: async (call: any) => { asked.push(call); return { stack: [{ type: 'slice', value: encodeTonAddressSliceBoc(JW) }] }; } };
    expect(await readJettonWalletAddress({ transport, master: MASTER, owner: ME, expected: JW, callOptions: { priority: 'critical' } })).toBe(JW);
    expect([asked[0].method, asked[0].address, asked[0].cacheTtlMs, asked[0].priority]).toEqual(['get_wallet_address', MASTER, 0, 'critical']);
    await expect(readJettonWalletAddress({ transport, master: MASTER, owner: ME, expected: YOU }))
      .rejects.toMatchObject({ code: 'JETTON_WALLET_DISAGREES' });
  });

  it('SEND-05: an NFT\'s owner is what its item says now (get_nft_data\'s fourth value)', async () => {
    const transport = { runGetMethod: async () => ({ stack: [
      { type: 'num', value: '-0x1' }, { type: 'num', value: '0x5' }, { type: 'slice', value: encodeTonAddressSliceBoc(MASTER) },
      { type: 'slice', value: encodeTonAddressSliceBoc(ME) }, { type: 'cell', value: 'te6' },
    ] }) };
    expect(await readNftOwner({ transport, item: JW })).toBe(ME);
    await expect(readNftOwner({ transport: { runGetMethod: async () => ({ stack: [] }) }, item: JW })).rejects.toThrow();
  });
});
