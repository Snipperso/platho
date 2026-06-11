import { describe, expect, it } from 'vitest';
import { createProfileRegistryTonRpcProvider } from '../web/profile-registry-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/vault-ton-rpc-provider.mjs';

const REGISTRY = `0:${'11'.repeat(32)}`;
const OWNER = `0:${'22'.repeat(32)}`;
const OFFICIAL = `0:${'33'.repeat(32)}`;
const ATH_MASTER = `0:${'44'.repeat(32)}`;
const TREASURY = `0:${'55'.repeat(32)}`;
const CONTROLLER = `0:${'66'.repeat(32)}`;
const ATH_WALLET = `0:${'77'.repeat(32)}`;
const VAULT = `0:${'88'.repeat(32)}`;

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

function stackAddr(address: string, type = 'slice') {
  return [type, encodeTonAddressSliceBoc(address)];
}

describe('ProfileRegistry TON RPC provider', () => {
  it('PROFILE-RPC-01: reads avatar pointers, globals, and derived ATH wallet', async () => {
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_avatar' || call.method === 'get_avatar_version') {
          return {
            stack: [
              num(-1n),
              stackAddr(OWNER),
              num(7n),
              num(0xabc123n),
              num(101n),
              num(0x1234567890abcdef1234567890abcdefn),
              num(8n),
              num(1n),
              num(1_700_000_000n),
            ],
          };
        }
        if (call.method === 'get_ath_wallet_address') return { stack: [stackAddr(ATH_WALLET, 'cell')] };
        if (call.method === 'get_global') {
          return {
            stack: [
              num(-1n),
              num(-1n),
              num(-1n),
              num(1n),
              num(2n),
              stackAddr(OFFICIAL),
              stackAddr(VAULT),
              stackAddr(ATH_MASTER, 'cell'),
              stackAddr(TREASURY),
              stackAddr(CONTROLLER, 'cell'),
              num(3n),
              num(4n),
              num(50n),
              num(60n),
              num(1n),
              num(2n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport });

    await expect(provider.getAvatar(OWNER)).resolves.toMatchObject({
      exists: true,
      owner_wallet: OWNER,
      version: 7n,
      avatar_hash: 0xabc123n,
      avatar_entry_id: 101n,
      avatar_part_count: 8n,
      media_format: 1n,
    });
    await expect(provider.getAvatarVersion(OWNER, 7n)).resolves.toMatchObject({
      exists: true,
      avatar_stream_id: 0x1234567890abcdef1234567890abcdefn,
    });
    await expect(provider.getAthWalletAddress(OWNER)).resolves.toBe(ATH_WALLET);
    await expect(provider.getGlobal()).resolves.toMatchObject({
      sealed: true,
      official_ath_wallet_bound: true,
      vault_bound: true,
      official_ath_wallet_address: OFFICIAL,
      vault_address: VAULT,
      ath_master_address: ATH_MASTER,
      treasury_ath_receiver_address: TREASURY,
      profile_count: 3n,
      avatar_record_count: 4n,
      treasury_due_ath: 50n,
      burn_due_ath: 60n,
    });

    expect(calls.every((call) => call.address === REGISTRY)).toBe(true);
    expect(calls[1].stack).toEqual([
      { type: 'slice', value: encodeTonAddressSliceBoc(OWNER) },
      { type: 'num', value: '0x7' },
    ]);
  });

  it('PROFILE-RPC-02: get_global requires the current vault-bound ABI and forwards fresh critical options', async () => {
    let seenCall: any = null;
    const currentGlobalStack = [
      num(-1n),
      num(-1n),
      num(-1n),
      num(1n),
      num(2n),
      stackAddr(OFFICIAL),
      stackAddr(VAULT),
      stackAddr(ATH_MASTER),
      stackAddr(TREASURY),
      stackAddr(CONTROLLER),
      num(3n),
      num(4n),
      num(50n),
      num(60n),
      num(1n),
      num(2n),
    ];
    const transport = {
      async runGetMethod(call: any) {
        seenCall = call;
        return { stack: currentGlobalStack };
      },
    };
    const provider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport });

    await expect(provider.getGlobal({
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toMatchObject({
      vault_bound: true,
      vault_address: VAULT,
      official_ath_wallet_address: OFFICIAL,
    });
    expect(seenCall).toMatchObject({
      method: 'get_global',
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });

    const oldAbiTransport = {
      async runGetMethod() {
        return { stack: currentGlobalStack.slice(0, 14) };
      },
    };
    const oldAbiProvider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport: oldAbiTransport });
    await expect(oldAbiProvider.getGlobal()).rejects.toThrow(/expected 16 stack items/);
  });

  it('PROFILE-RPC-03: avatar getters forward critical read options to the transport', async () => {
    const seenCalls: any[] = [];
    const transport = {
      async runGetMethod(call: any) {
        seenCalls.push(call);
        return {
          stack: [
            num(-1n),
            stackAddr(OWNER),
            num(7n),
            num(0xabc123n),
            num(101n),
            num(0x1234567890abcdef1234567890abcdefn),
            num(8n),
            num(1n),
            num(1_700_000_000n),
          ],
        };
      },
    };
    const provider = createProfileRegistryTonRpcProvider({ profileRegistryAddress: REGISTRY, transport });
    const critical = { verify: false, allowUnverifiedCriticalRead: true, priority: 'critical', cacheTtlMs: 0 };

    await expect(provider.getAvatar(OWNER, critical)).resolves.toMatchObject({ exists: true });
    await expect(provider.getAvatarVersion(OWNER, 7n, critical)).resolves.toMatchObject({ version: 7n });

    expect(seenCalls[0]).toMatchObject({ method: 'get_avatar', ...critical });
    expect(seenCalls[1]).toMatchObject({ method: 'get_avatar_version', ...critical });
  });
});
