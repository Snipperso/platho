import { Address, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import {
  computeUsernameNameHash,
  createUsernameNftItemTonRpcProvider,
  createUsernameRegistryTonRpcProvider,
  resolveAuthoritativeUsernameItemOwnership,
} from '../web/username-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';

const REGISTRY = `0:${'11'.repeat(32)}`;
const OWNER = `0:${'22'.repeat(32)}`;
const ITEM = `0:${'33'.repeat(32)}`;
const OFFICIAL = `0:${'44'.repeat(32)}`;
const CONTROLLER = `0:${'55'.repeat(32)}`;
const ATH_WALLET = `0:${'66'.repeat(32)}`;
const IMPOSTOR_ITEM = `0:${'77'.repeat(32)}`;

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

// The 12 fields UsernameRegistry.get_global returns since name_records was deleted (2026-07-20), in contract
// order. Every value is DISTINCT on purpose: this fixture is the tripwire for a silent off-by-one in the decoder,
// and it can only trip if no two neighbouring fields can be swapped without changing the decoded object.
const GLOBAL_STACK = [
  num(-1n),            //  0 sealed
  num(-1n),            //  1 official_ath_wallet_bound
  num(0xAA1n),         //  2 deployment_manifest_hash
  num(0xBB2n),         //  3 genesis_config_hash
  addr(OFFICIAL),      //  4 official_ath_wallet_address
  addr(CONTROLLER),    //  5 genesis_controller_address
  num(10n),            //  6 pending_mint_count
  num(111n),           //  7 treasury_due_ath
  num(222n),           //  8 burn_due_ath
  num(33n),            //  9 pending_treasury_flush_count
  num(44n),            // 10 pending_burn_flush_count
  num(86_400n),        // 11 pending_mint_stale_ttl
];

const GLOBAL_DECODED = {
  sealed: true,
  official_ath_wallet_bound: true,
  deployment_manifest_hash: 0xAA1n,
  genesis_config_hash: 0xBB2n,
  official_ath_wallet_address: OFFICIAL,
  genesis_controller_address: CONTROLLER,
  pending_mint_count: 10n,
  treasury_due_ath: 111n,
  burn_due_ath: 222n,
  pending_treasury_flush_count: 33n,
  pending_burn_flush_count: 44n,
  pending_mint_stale_ttl: 86_400n,
};

describe('Username TON RPC providers', () => {
  it('USERNAME-RPC-00: default registry provider exposes the current PWA interface only', () => {
    const provider: any = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport: { async runGetMethod() { return { stack: [] }; } } });

    // Exact-set pin, not a spot check: adding a getter back (or dropping one) has to fail here.
    expect(Object.keys(provider).sort()).toEqual([
      'getAthWalletAddress',
      'getGlobal',
      'getPendingBurnFlush',
      'getPendingMint',
      'getPendingTreasuryFlush',
      'getUsernameItemAddress',
      'getUsernamePrice',
      'kind',
    ]);

    expect(provider.getUsernamePrice).toBeTypeOf('function');
    expect(provider.getUsernameItemAddress).toBeTypeOf('function');
    expect(provider.getGlobal).toBeTypeOf('function');
    expect(provider.getAthWalletAddress).toBeTypeOf('function');
    expect(provider.getPendingMint).toBeTypeOf('function');
    // Deleted 2026-07-20 with the registry's name_records map. A name's record is its ITEM: derive the address
    // from the name hash and read the item, which is the only source that follows a TEP-62 transfer.
    expect(provider.getNameRecord).toBeUndefined();
    expect(provider.getNameRecordByUsername).toBeUndefined();
    expect(provider.getRefundDue).toBeUndefined();
    expect(provider.getRefundFlushId).toBeUndefined();
    expect(provider.getPendingRefundFlushFor).toBeUndefined();

    // The item provider surface is pinned too: RT-UNAMEITEM-004 below asserts get_nft_data is never consulted for
    // authority, which is only meaningful while the default provider does not quietly grow that read.
    const itemProvider: any = createUsernameNftItemTonRpcProvider({ usernameNftItemAddress: ITEM, transport: { async runGetMethod() { return { stack: [] }; } } });
    expect(Object.keys(itemProvider).sort()).toEqual(['getState', 'kind']);
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

  it('USERNAME-RPC-02: reads registry price, item derivation, flush state, and globals', async () => {
    const hash = 0x1234n;
    const calls: Array<{ method: string; address: string; stack: any[] }> = [];
    const transport = {
      async runGetMethod(call: { method: string; address: string; stack: any[] }) {
        calls.push(call);
        if (call.method === 'get_username_price') return { stack: [num(-1n), num(100_000_000_000n)] };
        if (call.method === 'get_username_item_address') return { stack: [addr(ITEM)] };
        if (call.method === 'get_pending_mint') {
          return { stack: [num(-1n), num(911n), num(7n), addr(OWNER), num(hash), num(100n), addr(ITEM), num(20_000_000n), num(2n)] };
        }
        if (call.method === 'get_pending_treasury_flush') {
          return { stack: [num(-1n), num(77n), addr(ATH_WALLET), num(4n)] };
        }
        if (call.method === 'get_pending_burn_flush') return { stack: [num(-1n), num(88n), num(5n)] };
        if (call.method === 'get_ath_wallet_address') return { stack: [addr(ATH_WALLET)] };
        if (call.method === 'get_global') return { stack: GLOBAL_STACK };
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getUsernamePrice(6n)).resolves.toMatchObject({ valid_length: true, price_ath_atomic: 100_000_000_000n });
    await expect(provider.getUsernameItemAddress(hash)).resolves.toBe(ITEM);
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
    // Full equality, not toMatchObject: treasury_due and burn_due are adjacent and a shift between them reports
    // money that is not there, so every field is checked rather than the two ends of the stack.
    await expect(provider.getGlobal()).resolves.toEqual(GLOBAL_DECODED);

    // The registry has no per-name read left at all — get_name_record must never be dialled.
    expect(calls.some((call) => call.method === 'get_name_record')).toBe(false);
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

  it('USERNAME-RPC-02B: get_global requires the current 12-item ABI arity and forwards fresh critical options', async () => {
    let seenCall: any = null;
    const transport = {
      async runGetMethod(call: any) {
        seenCall = call;
        return { stack: GLOBAL_STACK };
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    await expect(provider.getGlobal({
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    })).resolves.toEqual(GLOBAL_DECODED);
    expect(seenCall).toMatchObject({
      method: 'get_global',
      verify: false,
      allowUnverifiedCriticalRead: true,
      priority: 'critical',
      cacheTtlMs: 0,
    });

    const withStack = (stack: any[]) => createUsernameRegistryTonRpcProvider({
      usernameRegistryAddress: REGISTRY,
      transport: { async runGetMethod() { return { stack }; } },
    });

    // Both directions, because the arity guard only earns its keep if it is an equality and not a floor: a short
    // stack is the pre-2026-07-20 registry, and a 13-item stack is name_record_count coming back and shifting
    // every field after index 5 — which is how treasury_due gets read as burn_due.
    await expect(withStack(GLOBAL_STACK.slice(0, 11)).getGlobal()).rejects.toThrow(/expected 12 stack items, got 11/);
    await expect(withStack([...GLOBAL_STACK, num(1n)]).getGlobal()).rejects.toThrow(/expected 12 stack items, got 13/);
    // The exact shape of the old 13-item stack (name_record_count re-inserted at index 6) must not decode.
    const oldAbiStack = [...GLOBAL_STACK.slice(0, 6), num(21_500n), ...GLOBAL_STACK.slice(6)];
    expect(oldAbiStack).toHaveLength(13);
    await expect(withStack(oldAbiStack).getGlobal()).rejects.toThrow(/UsernameRegistry get_global ABI mismatch/);
  });

  it('USERNAME-RPC-02C: identity and price getters forward critical read options', async () => {
    const hash = 0x1234n;
    const seenCalls: any[] = [];
    const registryTransport = {
      async runGetMethod(call: any) {
        seenCalls.push(call);
        if (call.method === 'get_username_price') return { stack: [num(-1n), num(100_000_000_000n)] };
        if (call.method === 'get_username_item_address') return { stack: [addr(ITEM)] };
        if (call.method === 'get_ath_wallet_address') return { stack: [addr(ATH_WALLET)] };
        throw new Error(`unexpected method ${call.method}`);
      },
    };
    const registryProvider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport: registryTransport });
    const critical = { verify: false, allowUnverifiedCriticalRead: true, priority: 'critical', cacheTtlMs: 0 };

    await expect(registryProvider.getUsernamePrice(6n, critical)).resolves.toMatchObject({ valid_length: true });
    await expect(registryProvider.getUsernameItemAddress(hash, critical)).resolves.toBe(ITEM);
    await expect(registryProvider.getAthWalletAddress(OWNER, critical)).resolves.toBe(ATH_WALLET);

    expect(seenCalls[0]).toMatchObject({ method: 'get_username_price', ...critical });
    expect(seenCalls[1]).toMatchObject({ method: 'get_username_item_address', ...critical });
    expect(seenCalls[2]).toMatchObject({ method: 'get_ath_wallet_address', ...critical });
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
        if (call.method === 'get_username_item_address') {
          expect(call).toEqual({ address: REGISTRY, method: 'get_username_item_address', stack: [{ type: 'num', value: '0x1234' }] });
          return { stack: [tupleAddr(ITEM)] };
        }
        expect(call).toEqual({ address: REGISTRY, method: 'get_pending_mint', stack: [{ type: 'num', value: '0x1234' }] });
        return {
          stack: [
            ['num', '-0x1'],
            ['num', '0x38f'],
            ['num', '0x7'],
            tupleAddr(OWNER),
            ['num', '0x1234'],
            ['num', '0x64'],
            tupleAddr(ITEM),
            ['num', '0x1312d00'],
            ['num', '0x6553f100'],
          ],
        };
      },
    };
    const provider = createUsernameRegistryTonRpcProvider({ usernameRegistryAddress: REGISTRY, transport });

    // Was pinned on get_name_record until 2026-07-20; the tuple-form decoding it exercised is the same code, so
    // it is re-pinned on the two reads that replaced it — one bare address, one mixed num/address stack.
    await expect(provider.getUsernameItemAddress(hash)).resolves.toBe(ITEM);
    await expect(provider.getPendingMint(hash)).resolves.toMatchObject({
      exists: true,
      query_id: 911n,
      sender_key: 7n,
      owner_wallet: OWNER,
      name_hash: hash,
      price_paid: 100n,
      item_address: ITEM,
      item_deploy_value: 20_000_000n,
      created_at: 1_700_000_000n,
    });
  });

  it('USERNAME-RPC-03C: a failed item read is an error, never a decoded "uninitialized" item', async () => {
    // The whole availability story downstream rests on this: app.js reads `initialized === false` as "this name is
    // free" and only falls back to the account state when getState THROWS. If a transport hiccup were ever decoded
    // into a state object, the fallback would never run and a buyer would be sent into a mint that bounces.
    const failing = createUsernameNftItemTonRpcProvider({
      usernameNftItemAddress: ITEM,
      transport: { async runGetMethod() { throw new Error('toncenter is having a bad minute'); } },
    });
    await expect(failing.getState()).rejects.toThrow(/bad minute/);

    const empty = createUsernameNftItemTonRpcProvider({
      usernameNftItemAddress: ITEM,
      transport: { async runGetMethod() { return { stack: [] }; } },
    });
    await expect(empty.getState()).rejects.toThrow(/initialized/);

    const missingStack = createUsernameNftItemTonRpcProvider({
      usernameNftItemAddress: ITEM,
      transport: { async runGetMethod() { return {}; } },
    });
    await expect(missingStack.getState()).rejects.toThrow(/did not include a stack/);

    // Only a real chain answer of "false" may decode as an uninitialized item.
    const genuinelyEmptyItem = createUsernameNftItemTonRpcProvider({
      usernameNftItemAddress: ITEM,
      transport: {
        async runGetMethod() {
          return { stack: [num(0n), addr(REGISTRY), addr(REGISTRY), num(0n), num(0n), cell(), num(0n)] };
        },
      },
    });
    await expect(genuinelyEmptyItem.getState()).resolves.toMatchObject({ initialized: false });
  });

  it('USERNAME-RPC-04: accepts user-friendly addresses in fixtures', () => {
    expect(Address.parse(OWNER).toRawString()).toBe(OWNER);
  });

  it('USERNAME-RPC-05: item ownership is authoritative only when the name hash derives to the exact item read', async () => {
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
    // The registry no longer stores anything per name; the only thing it is asked is the pure derivation
    // deriveItemAddress(name_hash) -> address.
    const makeRegistryProvider = (derived = ITEM, onCall?: (hash: bigint, options: any) => void) => ({
      async getUsernameItemAddress(nameHash: bigint, callOptions: any) {
        expect(nameHash).toBe(hash);
        onCall?.(nameHash, callOptions);
        return derived;
      },
    });

    const authoritative = await resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider(),
      itemProvider: makeItemProvider(),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    });
    expect(authoritative).toMatchObject({
      authoritative: true,
      reason: 'registry_item',
      owner_wallet: OWNER,
      item_address: ITEM,
      name_hash: hash,
      derived_item_address: ITEM,
    });
    // No stale copy of the name may reappear in the proof: the item state is the record.
    expect(authoritative).not.toHaveProperty('record');

    // The item claims a name whose address derives somewhere else — it is an impostor sitting at ITEM.
    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider(IMPOSTOR_ITEM),
      itemProvider: makeItemProvider(),
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).resolves.toMatchObject({
      authoritative: false,
      reason: 'registry_item_mismatch',
      owner_wallet: null,
      derived_item_address: IMPOSTOR_ITEM,
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

    // Call options reach both providers — the derivation is a critical read like the state read it validates.
    let seenRegistryOptions: any = null;
    let seenItemOptions: any = null;
    const itemProvider = {
      async getState(callOptions: any) {
        seenItemOptions = callOptions;
        return {
          owner_wallet: OWNER,
          username_registry_address: REGISTRY,
          name_hash: hash,
          initialized: true,
          username_len: 6n,
          username_cell: '',
          tier: 3n,
        };
      },
    };
    await resolveAuthoritativeUsernameItemOwnership({
      registryProvider: makeRegistryProvider(ITEM, (_hash, options) => { seenRegistryOptions = options; }),
      itemProvider,
      itemAddress: ITEM,
      registryAddress: REGISTRY,
      registryCallOptions: { address: REGISTRY, priority: 'critical' },
      itemCallOptions: { address: ITEM, priority: 'critical' },
    });
    expect(seenRegistryOptions).toMatchObject({ address: REGISTRY, priority: 'critical' });
    expect(seenItemOptions).toMatchObject({ address: ITEM, priority: 'critical' });
  });

  it('USERNAME-RPC-05A: a provider that can only read the deleted record is rejected, not silently trusted', async () => {
    const itemProvider = {
      async getState() {
        return {
          owner_wallet: OWNER,
          username_registry_address: REGISTRY,
          name_hash: 0x1234n,
          initialized: true,
          username_len: 6n,
          username_cell: '',
          tier: 3n,
        };
      },
    };

    // Pre-2026-07-20 shape: knows get_name_record, cannot derive. Accepting it would mean resolving ownership
    // with no proof that the item read is the item the name maps to.
    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: { async getNameRecord() { return { exists: true, owner_wallet: OWNER, item_address: ITEM }; } },
      itemProvider,
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).rejects.toThrow(/cannot derive item addresses/);

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: { async getUsernameItemAddress() { return ITEM; } },
      itemProvider: {},
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).rejects.toThrow(/cannot read item state/);

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: { async getUsernameItemAddress() { return ITEM; } },
      itemProvider,
      itemAddress: null,
      registryAddress: REGISTRY,
    })).rejects.toThrow(/address is required/);
  });

  it('USERNAME-RPC-05B: an unreadable chain rejects — it never degrades into "not registered"', async () => {
    // app.js maps reason 'item_not_initialized' to UsernameNotRegisteredError, i.e. "this name does not exist".
    // A read that failed must therefore never come back wearing that reason, or a toncenter hiccup would tell a
    // user their correspondent's .ath name is unregistered — and, on the mint path, that the name is free.
    const registryProvider = { async getUsernameItemAddress() { return ITEM; } };

    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider,
      itemProvider: { async getState() { throw new Error('toncenter is having a bad minute'); } },
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).rejects.toThrow(/bad minute/);

    // The derivation failing is likewise an error, not a non-authoritative answer.
    await expect(resolveAuthoritativeUsernameItemOwnership({
      registryProvider: { async getUsernameItemAddress() { throw new Error('derivation read failed'); } },
      itemProvider: {
        async getState() {
          return {
            owner_wallet: OWNER,
            username_registry_address: REGISTRY,
            name_hash: 0x1234n,
            initialized: true,
            username_len: 6n,
            username_cell: '',
            tier: 3n,
          };
        },
      },
      itemAddress: ITEM,
      registryAddress: REGISTRY,
    })).rejects.toThrow(/derivation read failed/);
  });

  it('RT-USER-003: authoritative username ownership comes from the current NFT item owner, never from a stored record', async () => {
    const hash = 0x7711n;
    const transferredOwner = `0:${'bb'.repeat(32)}`;
    const registryProvider = {
      async getUsernameItemAddress(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return ITEM;
      },
      // The map that used to answer this named the MINTER and never followed a TEP-62 transfer. It is gone; if a
      // record read ever creeps back into this path, this test fails loudly instead of quietly reporting the
      // original owner of a name that has since been sold.
      async getNameRecord() {
        throw new Error('ownership must not be read from a stored registry record');
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
      derived_item_address: ITEM,
    });
  });

  it('RT-UNFT-003: an initialized item is not authoritative for a name whose hash derives elsewhere', async () => {
    const hash = 0x7722n;
    const squatterOwner = `0:${'cc'.repeat(32)}`;
    const registryProvider = {
      async getUsernameItemAddress(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return IMPOSTOR_ITEM;
      },
    };
    const itemProvider = {
      async getState() {
        return {
          initialized: true,
          owner_wallet: squatterOwner,
          username_registry_address: REGISTRY,
          name_hash: hash,
          username_len: 7n,
          username_cell: '',
          tier: 3n,
        };
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
      reason: 'registry_item_mismatch',
      derived_item_address: IMPOSTOR_ITEM,
    });
    // Self-declared ownership must not leak out of a non-authoritative proof.
    expect(proof.owner_wallet).toBeNull();
  });

  it('RT-UNAMEITEM-001: predeployed uninitialized item cannot become authoritative, and short-circuits the registry read', async () => {
    const hash = 0x7733n;
    const registryProvider = {
      async getUsernameItemAddress() {
        throw new Error('the registry must not be consulted for an uninitialized item');
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

  it('RT-UNAMEITEM-004: get_nft_data-style owner is not authority without the derivation proof', async () => {
    const hash = 0x7744n;
    const victimOwner = `0:${'dd'.repeat(32)}`;
    let nftDataRead = false;
    const registryProvider = {
      async getUsernameItemAddress(nameHash: bigint) {
        expect(nameHash).toBe(hash);
        return IMPOSTOR_ITEM;
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
      reason: 'registry_item_mismatch',
      derived_item_address: IMPOSTOR_ITEM,
    });
    expect(proof.owner_wallet).toBeNull();
    expect(nftDataRead).toBe(false);
  });
});
