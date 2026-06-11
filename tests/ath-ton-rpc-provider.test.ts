import { beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  createAthMasterTonRpcProvider,
  createAthWalletTonRpcProvider,
} from '../web/ath-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/vault-ton-rpc-provider.mjs';

const MASTER = `0:${'10'.repeat(32)}`;
const OWNER = `0:${'20'.repeat(32)}`;
const WALLET = `0:${'30'.repeat(32)}`;
const RESPONSE_DESTINATION = `0:${'40'.repeat(32)}`;
const CELL_BOC = beginCell().storeUint(1, 1).endCell().toBoc({ idx: false, crc32: false }).toString('base64');

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

describe('ATH TON RPC providers', () => {
  it('ATH-RPC-01: reads ATHMaster jetton data and derived wallet address', async () => {
    const calls: Array<{ method: string; address: string; stack: any[]; verify?: boolean; priority?: string; cacheTtlMs?: number }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[]; verify?: boolean; priority?: string; cacheTtlMs?: number }) {
        calls.push(call);
        if (call.method === 'get_jetton_data') {
          return {
            stack: [
              num(1000n),
              num(0n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'cell', value: CELL_BOC },
              { type: 'cell', value: CELL_BOC },
            ],
          };
        }
        if (call.method === 'get_wallet_address') {
          return { stack: [{ type: 'cell', value: encodeTonAddressSliceBoc(WALLET) }] };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createAthMasterTonRpcProvider({ athMasterAddress: MASTER, transport });

    await expect(provider.getJettonData()).resolves.toMatchObject({
      total_supply: 1000n,
      mintable: false,
      admin_address: OWNER,
      jetton_content_boc: CELL_BOC,
    });
    await expect(provider.getWalletAddress(OWNER, {
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toBe(WALLET);

    expect(calls.map((call) => call.method)).toEqual(['get_jetton_data', 'get_wallet_address']);
    expect(calls.every((call) => call.address === MASTER)).toBe(true);
    expect(calls[1]).toMatchObject({ verify: true, priority: 'critical', cacheTtlMs: 0 });
  });

  it('ATH-RPC-02: reads ATHWallet balance and pending notification', async () => {
    const calls: Array<{ method: string; address: string; stack: any[]; verify?: boolean; priority?: string; cacheTtlMs?: number }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[]; verify?: boolean; priority?: string; cacheTtlMs?: number }) {
        calls.push(call);
        if (call.method === 'get_wallet_data') {
          return {
            stack: [
              num(777n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'slice', value: encodeTonAddressSliceBoc(MASTER) },
            ],
          };
        }
        if (call.method === 'get_pending_notification') {
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              { type: 'slice', value: encodeTonAddressSliceBoc(RESPONSE_DESTINATION) },
              num(55n),
              num(1_700_000_000n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createAthWalletTonRpcProvider({ athWalletAddress: WALLET, transport });

    await expect(provider.getWalletData({
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toMatchObject({
      balance: 777n,
      owner_address: OWNER,
      ath_master_address: MASTER,
    });
    await expect(provider.getPendingNotification(9n, 10n)).resolves.toMatchObject({
      exists: true,
      sender_owner: OWNER,
      response_destination: RESPONSE_DESTINATION,
      amount: 55n,
    });

    expect(calls.map((call) => call.method)).toEqual(['get_wallet_data', 'get_pending_notification']);
    expect(calls[0]).toMatchObject({ verify: true, priority: 'critical', cacheTtlMs: 0 });
    expect(calls[1].stack).toEqual([{ type: 'num', value: '0x9' }, { type: 'num', value: '0xa' }]);
  });

  it('ATH-RPC-02B: rejects stale four-field pending notification fixtures', async () => {
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        if (call.method === 'get_pending_notification') {
          return {
            stack: [
              num(-1n),
              { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
              num(55n),
              num(1_700_000_000n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createAthWalletTonRpcProvider({ athWalletAddress: WALLET, transport });

    await expect(provider.getPendingNotification(9n, 10n)).rejects.toThrow(
      'ATH pending response destination is not an address stack item',
    );
  });
});
