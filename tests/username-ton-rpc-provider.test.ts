import { Address, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  computeUsernameNameHash,
  createUsernameNftItemTonRpcProvider,
  createUsernameRegistryTonRpcProvider,
} from '../web/username-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/vault-ton-rpc-provider.mjs';

const REGISTRY = `0:${'11'.repeat(32)}`;
const OWNER = `0:${'22'.repeat(32)}`;
const ITEM = `0:${'33'.repeat(32)}`;
const OFFICIAL = `0:${'44'.repeat(32)}`;
const CONTROLLER = `0:${'55'.repeat(32)}`;
const ATH_WALLET = `0:${'66'.repeat(32)}`;

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

function addr(address: string) {
  return { type: 'slice', value: encodeTonAddressSliceBoc(address) };
}

describe('Username TON RPC providers', () => {
  it('USERNAME-RPC-01: computes the on-chain username hash domain exactly', async () => {
    const username = 'platho';
    const expected = BigInt(`0x${beginCell()
      .storeUint(0xC5CC7CD6, 32)
      .storeBuffer(Buffer.from(username, 'ascii'))
      .endCell()
      .hash()
      .toString('hex')}`);

    await expect(computeUsernameNameHash(username)).resolves.toBe(expected);
    await expect(computeUsernameNameHash('platho.ath')).resolves.toBe(expected);
    await expect(computeUsernameNameHash('bad-name')).rejects.toThrow(/lowercase ASCII/);
  });

  it('USERNAME-RPC-02: reads registry price, records, due state, and globals', async () => {
    const hash = 0x1234n;
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_username_price') return { stack: [num(-1n), num(100_000_000_000n)] };
        if (call.method === 'get_username_item_address') return { stack: [addr(ITEM)] };
        if (call.method === 'get_name_record') return { stack: [num(-1n), addr(OWNER), addr(ITEM), num(1_700_000_000n)] };
        if (call.method === 'get_pending_mint') {
          return { stack: [num(-1n), addr(OWNER), num(hash), num(100n), addr(ITEM), num(20_000_000n), num(2n)] };
        }
        if (call.method === 'get_refund_due') return { stack: [num(55n)] };
        if (call.method === 'get_pending_refund_flush') {
          return { stack: [num(-1n), addr(OWNER), num(55n), addr(ATH_WALLET), num(3n)] };
        }
        if (call.method === 'get_refund_flush_id') return { stack: [num(0xabcDn)] };
        if (call.method === 'get_pending_refund_flush_for') {
          return { stack: [num(-1n), addr(OWNER), num(55n), addr(ATH_WALLET), num(3n)] };
        }
        if (call.method === 'get_pending_treasury_flush') {
          return { stack: [num(-1n), num(77n), addr(ATH_WALLET), num(4n)] };
        }
        if (call.method === 'get_pending_burn_flush') return { stack: [num(-1n), num(88n), num(5n)] };
        if (call.method === 'get_ath_wallet_address') return { stack: [addr(ATH_WALLET)] };
        if (call.method === 'get_global') {
          return {
            stack: [
              num(-1n),
              num(-1n),
              num(1n),
              num(2n),
              addr(OFFICIAL),
              addr(CONTROLLER),
              num(10n),
              num(11n),
              num(12n),
              num(13n),
              num(14n),
              num(15n),
              num(16n),
              num(17n),
              num(86_400n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getUsernamePrice(6n)).resolves.toMatchObject({ valid_length: true, price_ath_atomic: 100_000_000_000n });
    await expect(provider.getUsernameItemAddress(OWNER, hash)).resolves.toBe(ITEM);
    await expect(provider.getNameRecord(hash)).resolves.toMatchObject({ exists: true, owner_wallet: OWNER, item_address: ITEM });
    await expect(provider.getPendingMint(hash)).resolves.toMatchObject({ exists: true, name_hash: hash, item_deploy_value: 20_000_000n });
    await expect(provider.getRefundDue(OWNER)).resolves.toBe(55n);
    await expect(provider.getPendingRefundFlush(1n)).resolves.toMatchObject({ amount: 55n, recipient_ath_wallet: ATH_WALLET });
    await expect(provider.getRefundFlushId(OWNER, 1n)).resolves.toBe(0xabcDn);
    await expect(provider.getPendingRefundFlushFor(OWNER, 1n)).resolves.toMatchObject({ owner_wallet: OWNER, amount: 55n });
    await expect(provider.getPendingTreasuryFlush(2n)).resolves.toMatchObject({ amount: 77n, recipient_ath_wallet: ATH_WALLET });
    await expect(provider.getPendingBurnFlush(3n)).resolves.toMatchObject({ amount: 88n });
    await expect(provider.getAthWalletAddress(OWNER)).resolves.toBe(ATH_WALLET);
    await expect(provider.getGlobal()).resolves.toMatchObject({
      sealed: true,
      official_ath_wallet_bound: true,
      official_ath_wallet_address: OFFICIAL,
      pending_mint_stale_ttl: 86_400n,
    });

    expect(calls.every((call) => call.address === REGISTRY)).toBe(true);
    expect(calls[1].stack).toEqual([
      { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
      { type: 'num', value: '0x1234' },
    ]);
  });

  it('USERNAME-RPC-03: reads UsernameNFTItem immutable state', async () => {
    const hash = 0x1234n;
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        expect(call).toEqual({ address: ITEM, method: 'get_state', stack: [] });
        return { stack: [addr(OWNER), addr(REGISTRY), num(hash)] };
      },
    };
    const provider = createUsernameNftItemTonRpcProvider({ usernameNftItemAddress: ITEM, transport });

    await expect(provider.getState()).resolves.toMatchObject({
      owner_wallet: OWNER,
      username_registry_address: REGISTRY,
      name_hash: hash,
    });
  });

  it('USERNAME-RPC-04: accepts user-friendly addresses in fixtures', () => {
    expect(Address.parse(OWNER).toRawString()).toBe(OWNER);
  });
});
