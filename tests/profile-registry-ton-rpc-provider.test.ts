import { describe, expect, it } from 'vitest';
import { createProfileRegistryTonRpcProvider } from '../web/profile-registry-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';

// The avatar getters that used to live here RETIRED 2026-07-21 along with the maps behind them: the pointer is in
// the buyer's own KeyShard now, and its provider is covered by tests/key-shard-ton-rpc-provider.test.ts. What this
// registry provider still answers is the registry's own state and WHERE a wallet's shard is.

const REGISTRY = `0:${'11'.repeat(32)}`;
const OWNER = `0:${'22'.repeat(32)}`;
const OFFICIAL = `0:${'33'.repeat(32)}`;
const ATH_MASTER = `0:${'44'.repeat(32)}`;
const TREASURY = `0:${'55'.repeat(32)}`;
const CONTROLLER = `0:${'66'.repeat(32)}`;
const ATH_WALLET = `0:${'77'.repeat(32)}`;
const KEY_SHARD = `0:${'88'.repeat(32)}`;

function num(value: bigint | number | string) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return {
    type: 'num',
    value: bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`,
  };
}

function stackAddr(address: string, type = 'slice') {
  return [type, encodeTonAddressSliceBoc(address)];
}

/** get_global as the current contract returns it: 15 items, avatar_record_count replaced by the two in-flight
 *  counters that clear on settlement instead of growing with the number of profiles. */
const globalStack = () => [
  num(-1n),
  num(-1n),
  num(1n),
  num(2n),
  stackAddr(OFFICIAL),
  stackAddr(ATH_MASTER),
  stackAddr(TREASURY),
  stackAddr(CONTROLLER),
  num(3n),   // profile_count
  num(1n),   // pending_avatar_write_count
  num(9n),   // next_avatar_write_id
  num(50n),  // treasury_due_ath
  num(60n),  // burn_due_ath
  num(1n),
  num(2n),
];

describe('ProfileRegistry TON RPC provider', () => {
  it('PROFILE-RPC-01: reads globals, the derived ATH wallet, and the wallet KeyShard address', async () => {
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_ath_wallet_address') return { stack: [stackAddr(ATH_WALLET, 'cell')] };
        if (call.method === 'get_key_shard_address') return { stack: [stackAddr(KEY_SHARD, 'cell')] };
        if (call.method === 'get_global') return { stack: globalStack() };
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport });

    await expect(provider.getAthWalletAddress(OWNER)).resolves.toBe(ATH_WALLET);
    await expect(provider.getKeyShardAddress(OWNER)).resolves.toBe(KEY_SHARD);
    await expect(provider.getGlobal()).resolves.toMatchObject({
      sealed: true,
      official_ath_wallet_bound: true,
      official_ath_wallet_address: OFFICIAL,
      ath_master_address: ATH_MASTER,
      treasury_ath_receiver_address: TREASURY,
      profile_count: 3n,
      pending_avatar_write_count: 1n,
      next_avatar_write_id: 9n,
      treasury_due_ath: 50n,
      burn_due_ath: 60n,
    });

    expect(calls.every((call) => call.address === REGISTRY)).toBe(true);
    expect(calls[1].stack).toEqual([{ type: 'slice', value: encodeTonAddressSliceBoc(OWNER) }]);
  });

  it('PROFILE-RPC-02: get_global requires the current ABI arity and forwards fresh critical options', async () => {
    // The arity check is the only thing standing between a contract change and a decoder that silently reads
    // burn_due out of the slot where treasury_due now lives. It went from 14 to 15 when the per-profile record
    // count was replaced.
    let seenCall: any = null;
    const transport = {
      async runGetMethod(call: any) {
        seenCall = call;
        return { stack: globalStack() };
      },
    };
    const provider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport });

    await expect(provider.getGlobal({
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toMatchObject({
      official_ath_wallet_address: OFFICIAL,
    });
    expect(seenCall).toMatchObject({
      method: 'get_global',
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });

    const oldAbiProvider = createProfileRegistryTonRpcProvider({
      profileRegistryAddress: REGISTRY,
      transport: { async runGetMethod() { return { stack: globalStack().slice(0, 14) }; } },
    });
    await expect(oldAbiProvider.getGlobal()).rejects.toThrow(/expected 15 stack items/);
  });

  it('PROFILE-RPC-03: the retired avatar getters are gone, not merely unused', async () => {
    // A provider that still exposed getAvatar would call a get-method the contract no longer has, and the failure
    // would surface as an RPC error indistinguishable from an outage rather than as a missing capability.
    const provider = createProfileRegistryTonRpcProvider({
      profileRegistryAddress: REGISTRY,
      transport: { async runGetMethod() { throw new Error('must not be called'); } },
    });
    expect((provider as any).getAvatar).toBeUndefined();
    expect((provider as any).getAvatarVersion).toBeUndefined();
  });

  it('PROFILE-RPC-04: the KeyShard address getter forwards critical read options', async () => {
    const seenCalls: any[] = [];
    const transport = {
      async runGetMethod(call: any) {
        seenCalls.push(call);
        return { stack: [stackAddr(KEY_SHARD, 'cell')] };
      },
    };
    const provider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport });
    const critical = { verify: false, allowUnverifiedCriticalRead: true, priority: 'critical', cacheTtlMs: 0 };

    await expect(provider.getKeyShardAddress(OWNER, critical)).resolves.toBe(KEY_SHARD);
    expect(seenCalls[0]).toMatchObject({ method: 'get_key_shard_address', ...critical });
  });
});
