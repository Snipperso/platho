import { Address, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  computeUsernameNameHash,
  createUsernameNftItemTonRpcProvider,
  createUsernameRegistryTonRpcProvider,
  resolveAuthoritativeUsernameItemOwnership,
} from '../web/username-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/vault-ton-rpc-provider.mjs';

const REGISTRY = `0:${'11'.repeat(32)}`;
const OWNER = `0:${'22'.repeat(32)}`;
const ITEM = `0:${'33'.repeat(32)}`;
const OFFICIAL = `0:${'44'.repeat(32)}`;
const CONTROLLER = `0:${'55'.repeat(32)}`;
const ATH_WALLET = `0:${'66'.repeat(32)}`;
const VAULT = `0:${'77'.repeat(32)}`;

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

function tupleAddr(address: string) {
  return ['slice', encodeTonAddressSliceBoc(address)];
}

function cell(value = 'te6ccgEBAQEAAgAAAA==') {
  return { type: 'cell', value };
}

describe('Username TON RPC providers', () => {
  it('USERNAME-RPC-00: default registry provider exposes the current PWA interface only', () => {
    const provider: any = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport: { async runGetMethod() { return { stack: [] }; } } });

    expect(provider.getUsernamePrice).toBeTypeOf('function');
    expect(provider.getNameRecordByUsername).toBeTypeOf('function');
    expect(provider.getNameRecord).toBeTypeOf('function');
    expect(provider.getUsernameItemAddress).toBeTypeOf('function');
    expect(provider.getGlobal).toBeTypeOf('function');
    expect(provider.getAthWalletAddress).toBeTypeOf('function');
    expect(provider.getPendingMint).toBeTypeOf('function');
    expect(provider.getRefundDue).toBeUndefined();
    expect(provider.getRefundFlushId).toBeUndefined();
    expect(provider.getPendingRefundFlushFor).toBeUndefined();
  });

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
    await expect(computeUsernameNameHash('bad-name')).resolves.toBe(BigInt(`0x${beginCell()
      .storeUint(0xC5CC7CD6, 32)
      .storeBuffer(Buffer.from('bad-name', 'ascii'))
      .endCell()
      .hash()
      .toString('hex')}`));
    await expect(computeUsernameNameHash('----.ath')).resolves.toBe(BigInt(`0x${beginCell()
      .storeUint(0xC5CC7CD6, 32)
      .storeBuffer(Buffer.from('----', 'ascii'))
      .endCell()
      .hash()
      .toString('hex')}`));
    await expect(computeUsernameNameHash('Bad_Name.ATH')).resolves.toBe(BigInt(`0x${beginCell()
      .storeUint(0xC5CC7CD6, 32)
      .storeBuffer(Buffer.from('bad_name', 'ascii'))
      .endCell()
      .hash()
      .toString('hex')}`));
    await expect(computeUsernameNameHash('abcdefghijklmnopq')).rejects.toThrow(/4-16 ASCII/);
    await expect(computeUsernameNameHash('bad.name')).rejects.toThrow(/lowercase ASCII/);
  });

  it('USERNAME-RPC-02: reads registry price, records, flush state, and globals', async () => {
    const hash = 0x1234n;
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_username_price') return { stack: [num(-1n), num(100_000_000_000n)] };
        if (call.method === 'get_username_item_address') return { stack: [addr(ITEM)] };
        if (call.method === 'get_name_record') return { stack: [num(-1n), addr(OWNER), addr(ITEM), num(1_700_000_000n)] };
        if (call.method === 'get_pending_mint') {
          return { stack: [num(-1n), num(911n), num(7n), addr(OWNER), num(hash), num(100n), addr(ITEM), num(20_000_000n), num(2n)] };
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
              num(-1n),
              num(1n),
              num(2n),
              addr(OFFICIAL),
              addr(VAULT),
              addr(CONTROLLER),
              num(10n),
              num(11n),
              num(12n),
              num(13n),
              num(14n),
              num(15n),
              num(86_400n),
            ],
          };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getUsernamePrice(6n)).resolves.toMatchObject({ valid_length: true, price_ath_atomic: 100_000_000_000n });
    await expect(provider.getUsernameItemAddress(hash)).resolves.toBe(ITEM);
    await expect(provider.getNameRecord(hash)).resolves.toMatchObject({ exists: true, owner_wallet: OWNER, item_address: ITEM });
    await expect(provider.getPendingMint(hash)).resolves.toMatchObject({
      exists: true,
      query_id: 911n,
      sender_key: 7n,
      name_hash: hash,
      item_deploy_value: 20_000_000n,
    });
    await expect(provider.getPendingTreasuryFlush(2n)).resolves.toMatchObject({ amount: 77n, recipient_ath_wallet: ATH_WALLET });
    await expect(provider.getPendingBurnFlush(3n)).resolves.toMatchObject({ amount: 88n });
    await expect(provider.getAthWalletAddress(OWNER)).resolves.toBe(ATH_WALLET);
    await expect(provider.getGlobal()).resolves.toMatchObject({
      sealed: true,
      official_ath_wallet_bound: true,
      vault_bound: true,
      official_ath_wallet_address: OFFICIAL,
      vault_address: VAULT,
      pending_mint_stale_ttl: 86_400n,
    });

    expect(calls.every((call) => call.address === REGISTRY)).toBe(true);
    expect(calls[1].stack).toEqual([
      { type: 'num', value: '0x1234' },
    ]);
  });

  it('USERNAME-RPC-02A: get_pending_mint forwards fresh critical options', async () => {
    const hash = 0x1234n;
    let seenCall: any = null;
    const transport = {
      async runGetMethod(call: any) {
        seenCall = call;
        return { stack: [num(0n), num(0n), num(0n), addr(OWNER), num(hash), num(0n), addr(ITEM), num(0n), num(0n)] };
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getPendingMint(hash, {
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
      allowUnverifiedCriticalRead: true,
    })).resolves.toMatchObject({ exists: false });

    expect(seenCall).toMatchObject({
      address: REGISTRY,
      method: 'get_pending_mint',
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
      allowUnverifiedCriticalRead: true,
    });
  });

  it('USERNAME-RPC-02D: pending flush reads forward fresh critical options', async () => {
    const calls: any[] = [];
    const transport = {
      async runGetMethod(call: any) {
        calls.push(call);
        if (call.method === 'get_pending_treasury_flush') {
          return { stack: [num(-1n), num(77n), addr(ATH_WALLET), num(4n)] };
        }
        if (call.method === 'get_pending_burn_flush') {
          return { stack: [num(-1n), num(88n), num(5n)] };
        }
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });
    const readOptions = {
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
      allowUnverifiedCriticalRead: true,
    };

    await expect(provider.getPendingTreasuryFlush(2n, readOptions)).resolves.toMatchObject({
      amount: 77n,
      recipient_ath_wallet: ATH_WALLET,
    });
    await expect(provider.getPendingBurnFlush(3n, readOptions)).resolves.toMatchObject({ amount: 88n });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      address: REGISTRY,
      method: 'get_pending_treasury_flush',
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
      allowUnverifiedCriticalRead: true,
    });
    expect(calls[1]).toMatchObject({
      address: REGISTRY,
      method: 'get_pending_burn_flush',
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
      allowUnverifiedCriticalRead: true,
    });
  });

  it('USERNAME-RPC-02B: get_global requires the current vault-bound ABI and forwards fresh critical options', async () => {
    const currentGlobalStack = [
      num(-1n),
      num(-1n),
      num(-1n),
      num(1n),
      num(2n),
      addr(OFFICIAL),
      addr(VAULT),
      addr(CONTROLLER),
      num(10n),
      num(11n),
      num(12n),
      num(13n),
      num(14n),
      num(15n),
      num(86_400n),
    ];
    let seenCall: any = null;
    const transport = {
      async runGetMethod(call: any) {
        seenCall = call;
        return { stack: currentGlobalStack };
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getGlobal({
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toMatchObject({
      vault_bound: true,
      vault_address: VAULT,
      official_ath_wallet_address: OFFICIAL,
      pending_mint_stale_ttl: 86_400n,
    });
    expect(seenCall).toMatchObject({
      method: 'get_global',
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });

    const oldAbiProvider = createUsernameRegistryTonRpcProvider({
      usernameRegistryAddress: REGISTRY,
      transport: {
        async runGetMethod() {
          return { stack: currentGlobalStack.slice(0, 13) };
        },
      },
    });
    await expect(oldAbiProvider.getGlobal()).rejects.toThrow(/expected 15 stack items/);
  });

  it('USERNAME-RPC-02C: identity and price getters forward critical read options', async () => {
    const hash = 0x1234n;
    const seenCalls: any[] = [];
    const registryTransport = {
      async runGetMethod(call: any) {
        seenCalls.push(call);
        if (call.method === 'get_username_price') return { stack: [num(-1n), num(100_000_000_000n)] };
        if (call.method === 'get_username_item_address') return { stack: [addr(ITEM)] };
        if (call.method === 'get_name_record') return { stack: [num(-1n), addr(OWNER), addr(ITEM), num(1_700_000_000n)] };
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const registryProvider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport: registryTransport });
    const critical = { verify: false, allowUnverifiedCriticalRead: true, priority: 'critical', cacheTtlMs: 0 };

    await expect(registryProvider.getUsernamePrice(6n, critical)).resolves.toMatchObject({ valid_length: true });
    await expect(registryProvider.getUsernameItemAddress(hash, critical)).resolves.toBe(ITEM);
    await expect(registryProvider.getNameRecord(hash, critical)).resolves.toMatchObject({ exists: true });

    expect(seenCalls[0]).toMatchObject({ method: 'get_username_price', ...critical });
    expect(seenCalls[1]).toMatchObject({ method: 'get_username_item_address', ...critical });
    expect(seenCalls[2]).toMatchObject({ method: 'get_name_record', ...critical });
  });

  it('USERNAME-RPC-03: reads UsernameNFTItem immutable state', async () => {
    const hash = 0x1234n;
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        expect(call).toEqual({ address: ITEM, method: 'get_state', stack: [] });
        return { stack: [num(-1n), addr(OWNER), addr(REGISTRY), num(hash), num(6n), cell(), num(3n)] };
      },
    };
    const provider = createUsernameNftItemTonRpcProvider({ usernameNftItemAddress: ITEM, transport });

    await expect(provider.getState()).resolves.toMatchObject({
      owner_wallet: OWNER,
      username_registry_address: REGISTRY,
      name_hash: hash,
      initialized: true,
      username_len: 6n,
      tier: 3n,
    });
  });

  it('USERNAME-RPC-03A: UsernameNFTItem get_state forwards critical read options', async () => {
    const hash = 0x1234n;
    let seenCall: any = null;
    const transport = {
      async runGetMethod(call: any) {
        seenCall = call;
        return { stack: [num(-1n), addr(OWNER), addr(REGISTRY), num(hash), num(6n), cell(), num(3n)] };
      },
    };
    const provider = createUsernameNftItemTonRpcProvider({ usernameNftItemAddress: ITEM, transport });

    await expect(provider.getState({ verify: true, priority: 'critical', cacheTtlMs: 0 })).resolves.toMatchObject({
      owner_wallet: OWNER,
      initialized: true,
    });
    expect(seenCall).toMatchObject({
      address: ITEM,
      method: 'get_state',
      verify: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });
  });

  it('USERNAME-RPC-03B: accepts tuple-form address stack items returned by TON RPC', async () => {
    const hash = 0x1234n;
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        expect(call).toEqual({ address: REGISTRY, method: 'get_name_record', stack: [{ type: 'num', value: '0x1234' }] });
        return { stack: [['num', '-0x1'], tupleAddr(OWNER), tupleAddr(ITEM), ['num', '0x6553f100']] };
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getNameRecord(hash)).resolves.toMatchObject({
      exists: true,
      owner_wallet: OWNER,
      item_address: ITEM,
      registered_at: 1_700_000_000n,
    });
  });

  it('USERNAME-RPC-04: accepts user-friendly addresses in fixtures', () => {
    expect(Address.parse(OWNER).toRawString()).toBe(OWNER);
  });

  it('USERNAME-RPC-05: item ownership is authoritative only when registry record points to the exact item', async () => {
    const hash = 0x1234n;
    const makeItemProvider = (state = {}) => ({
      async getState() {
        return {
          owner_wallet: OWNER,
          username_registry_address: REGISTRY,
          name_hash: hash,
          initialized: true,
          username_len: 6n,
          username_cell: '',
          tier: 3n,
          ...state,
        };
      },
    });
    const makeRegistryProvider = (record = {}) => ({
      async getNameRecord(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return {
          exists: true,
          owner_wallet: OWNER,
          item_address: ITEM,
          registered_at: 1_700_000_000n,
          ...record,
        };
      },
    });

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider(),
      itemProvider: makeItemProvider(),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: true,
      reason: 'registry_item',
      owner_wallet: OWNER,
      item_address: ITEM,
      name_hash: hash,
    });

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider({ exists: false }),
      itemProvider: makeItemProvider(),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'missing_registry_record',
    });

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider({ item_address: `0:${'77'.repeat(32)}` }),
      itemProvider: makeItemProvider(),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'registry_item_mismatch',
      owner_wallet: null,
    });

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider({ owner_wallet: `0:${'88'.repeat(32)}` }),
      itemProvider: makeItemProvider(),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: true,
      reason: 'registry_item',
      owner_wallet: OWNER,
    });

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider(),
      itemProvider: makeItemProvider({ initialized: false }),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'item_not_initialized',
      record: null,
    });

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider(),
      itemProvider: makeItemProvider({ username_registry_address: `0:${'99'.repeat(32)}` }),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'item_registry_mismatch',
      record: null,
    });
  });

  it('RT-USER-003: authoritative username ownership comes from the current NFT item owner, not stale registry owner', async () => {
    const hash = 0x7711n;
    const originalOwner = `0:${'aa'.repeat(32)}`;
    const transferredOwner = `0:${'bb'.repeat(32)}`;
    const registryProvider = {
      async getNameRecord(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return {
          exists: true,
          owner_wallet: originalOwner,
          item_address: ITEM,
          registered_at: 1_700_000_123n,
        };
      },
    };
    const itemProvider = {
      async getState() {
        return {
          initialized: true,
          owner_wallet: transferredOwner,
          username_registry_address: REGISTRY,
          name_hash: hash,
          username_len: 7n,
          username_cell: '',
          tier: 3n,
        };
      },
    };

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider,
      itemProvider,
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: true,
      reason: 'registry_item',
      owner_wallet: transferredOwner,
      item_address: ITEM,
      name_hash: hash,
    });
  });

  it('RT-UNFT-003: transferred item-only state is not authoritative before Registry record exists', async () => {
    const hash = 0x7722n;
    const transferredOwner = `0:${'cc'.repeat(32)}`;
    const registryProvider = {
      async getNameRecord(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return {
          exists: false,
          owner_wallet: OWNER,
          item_address: ITEM,
          registered_at: 0n,
        };
      },
    };
    const itemProvider = {
      async getState() {
        return {
          initialized: true,
          owner_wallet: transferredOwner,
          username_registry_address: REGISTRY,
          name_hash: hash,
          username_len: 7n,
          username_cell: '',
          tier: 3n,
        };
      },
    };

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider,
      itemProvider,
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'missing_registry_record',
      record: { exists: false },
    });
  });

  it('RT-UNAMEITEM-001: predeployed uninitialized item cannot become authoritative before Registry record', async () => {
    const hash = 0x7733n;
    const registryProvider = {
      async getNameRecord() {
        throw new Error('Registry record must not be trusted or read for an uninitialized item');
      },
    };
    const itemProvider = {
      async getState() {
        return {
          initialized: false,
          owner_wallet: REGISTRY,
          username_registry_address: REGISTRY,
          name_hash: hash,
          username_len: 0n,
          username_cell: '',
          tier: 3n,
        };
      },
    };

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider,
      itemProvider,
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'item_not_initialized',
      record: null,
    });
  });

  it('RT-UNAMEITEM-004: get_nft_data-style owner is not authority without a Registry record', async () => {
    const hash = 0x7744n;
    const victimOwner = `0:${'dd'.repeat(32)}`;
    let nftDataRead = false;
    const registryProvider = {
      async getNameRecord(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return {
          exists: false,
          owner_wallet: victimOwner,
          item_address: ITEM,
          registered_at: 0n,
        };
      },
    };
    const itemProvider = {
      async getState() {
        return {
          initialized: true,
          owner_wallet: victimOwner,
          username_registry_address: REGISTRY,
          name_hash: hash,
          username_len: 7n,
          username_cell: '',
          tier: 3n,
        };
      },
      async getNftData() {
        nftDataRead = true;
        return { owner_address: victimOwner };
      },
    };

    const proof = await resolveAuthoritativeUsernameItemOwnership({
      registryProvider,
      itemProvider,
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    });
    expect(proof).toMatchObject({
      authoritative: false,
      reason: 'missing_registry_record',
      record: { exists: false },
    });
    expect(proof).not.toHaveProperty('owner_wallet');
    expect(nftDataRead).toBe(false);
  });
});
