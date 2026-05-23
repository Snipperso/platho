import { beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { createCapsuleHubTonRpcProvider } from '../web/capsulehub-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/vault-ton-rpc-provider.mjs';

const CAPSULE = `0:${'11'.repeat(32)}`;
const AUTHOR = `0:${'22'.repeat(32)}`;
const FEE = `0:${'33'.repeat(32)}`;
const VAULT = `0:${'44'.repeat(32)}`;
const GENESIS = `0:${'55'.repeat(32)}`;
const CELL_BOC = beginCell().storeUint(0x504c, 16).endCell().toBoc({ idx: false, crc32: false }).toString('base64');

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

describe('CapsuleHub TON RPC provider', () => {
  it('CAPHUB-RPC-01: reads private/public entries and state for PWA chain history', async () => {
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_private_entry') {
          return {
            stack: [
              num(-1n),
              num(7n),
              num(0x777n),
              num(0xaaaan),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(1n),
              num(2n),
              num(0x11n),
              num(0x22n),
              num(0x33n),
              { type: 'cell', value: CELL_BOC },
              { type: 'cell', value: CELL_BOC },
              { type: 'cell', value: CELL_BOC },
              num(1_700_000_000n),
            ],
          };
        }
        if (call.method === 'get_public_entry') {
          return {
            stack: [
              num(-1n),
              num(3n),
              num(0x333n),
              num(0xbbbbn),
              { type: 'slice', value: encodeTonAddressSliceBoc(AUTHOR) },
              num(0x44n),
              num(0x55n),
              { type: 'cell', value: CELL_BOC },
              { type: 'cell', value: CELL_BOC },
              num(1_700_000_001n),
            ],
          };
        }
        if (call.method === 'get_state') {
          return {
            stack: [
              num(-1n),
              num(-1n),
              num(0x999n),
              num(8n),
              num(4n),
              num(5_000_000n),
              { type: 'slice', value: encodeTonAddressSliceBoc(FEE) },
              { type: 'slice', value: encodeTonAddressSliceBoc(VAULT) },
              { type: 'slice', value: encodeTonAddressSliceBoc(GENESIS) },
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createCapsuleHubTonRpcProvider({ capsuleHubAddress: CAPSULE, transport });

    await expect(provider.getPrivateEntry(7n)).resolves.toMatchObject({
      exists: true,
      entry_id: 7n,
      author_wallet: AUTHOR,
      body_boc: CELL_BOC,
      created_at: 1_700_000_000n,
    });
    await expect(provider.getPublicEntry(3n)).resolves.toMatchObject({
      exists: true,
      entry_id: 3n,
      author_wallet: AUTHOR,
      header_boc: CELL_BOC,
      body_boc: CELL_BOC,
    });
    await expect(provider.getState()).resolves.toMatchObject({
      sealed: true,
      vault_bound: true,
      private_latest_id: 8n,
      public_latest_id: 4n,
      fee_accumulator_address: FEE,
      vault_address: VAULT,
    });

    expect(calls.map((call) => call.method)).toEqual(['get_private_entry', 'get_public_entry', 'get_state']);
    expect(calls.every((call) => call.address === CAPSULE)).toBe(true);
    expect(calls[0].stack).toEqual([{ type: 'num', value: '0x7' }]);
  });
});
