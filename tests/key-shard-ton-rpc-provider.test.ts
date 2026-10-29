import { describe, expect, it } from 'vitest';
import { Address, Cell, contractAddress } from '@ton/core';
import { KEYSHARD_CODE_BOC_18 } from '../web/shard-code-18.mjs';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';
import {
  createKeyShardTonRpcProvider,
  decodeKeyShardViewStack,
  avatarRecordFromKeyShardView,
  deriveKeyShardRawAddress,
} from '../web/key-shard-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc, decodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';


const REGISTRY = Address.parse('EQDG8kf4ikGQRyTZcZ2POIWEqwqAaZWbi9Y6qPp3EXTa_Pq7');
const OWNER = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');

const num = (value: bigint) => ({
  type: 'num',
  value: value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`,
});
const addr = (address: string) => ['slice', encodeTonAddressSliceBoc(address)];

const fullViewStack = (avatarVersion: bigint) => [
  num(-1n),
  addr(OWNER.toRawString()),
  num(0x1111n),
  num(3n),
  num(4n),
  num(0x5555n),
  num(0x6666n),
  num(0x7777n),
  num(0x8888n),
  num(1184n),
  ['cell', 'te6ccgEBAQEAAgAAAA=='],
  num(2n),
  num(1_700_000_000n),
  num(12345n),
  num(57_000_000n),
  num(12_000_000n),
  addr(REGISTRY.toRawString()),
  num(avatarVersion),
  num(0xabc123n),
  num(101n),
  num(0x1234567890abcdef1234567890abcdefn),
  num(2n),
  num(1n),
  num(1_700_000_777n),
  num(20_000_000n),
];

describe('KeyShard TON RPC provider', () => {
  it('KSRPC-01: the provider reads the SAME account @ton/core derives from the compiled wrapper', async () => {
    const init17 = await KeyShard.init(OWNER, REGISTRY);
    await expect(deriveKeyShardRawAddress(OWNER.toRawString(), REGISTRY.toRawString(), 17))
      .resolves.toBe(contractAddress(0, init17).toRawString());
    const code18 = Cell.fromBoc(Buffer.from(KEYSHARD_CODE_BOC_18, 'base64'))[0];
    const reference = contractAddress(0, { code: code18, data: init17.data }).toRawString();
    await expect(deriveKeyShardRawAddress(OWNER.toRawString(), REGISTRY.toRawString())).resolves.toBe(reference);

    const seen: any[] = [];
    const provider = createKeyShardTonRpcProvider({
      profileRegistryAddress: REGISTRY.toRawString(),
      decodeAddressSliceBoc: decodeTonAddressSliceBoc,
      transport: {
        async runGetMethod(call: any) {
          seen.push(call);
          return { stack: fullViewStack(5n) };
        },
      },
    });

    await provider.getView(OWNER.toRawString());
    expect(seen[0]).toMatchObject({ method: 'get_view', address: reference, stack: [] });
  });

  it('KSRPC-02: the 24-item view decodes field for field, and a drifted arity is refused', async () => {
    const view = decodeKeyShardViewStack({ stack: fullViewStack(5n) }, decodeTonAddressSliceBoc);
    expect(view).toMatchObject({
      exists: true,
      key_id: 0x1111n,
      key_generation: 3n,
      rotation_nonce: 4n,
      enc_pubkey: 0x5555n,
      sign_pubkey: 0x6666n,
      scan_pubkey: 0x7777n,
      pq_kem_pubkey_hash: 0x8888n,
      pq_kem_pubkey_len: 1184n,
      crypto_suite_mask: 2n,
      avatar_version: 5n,
      avatar_hash: 0xabc123n,
      avatar_entry_id: 101n,
      avatar_stream_id: 0x1234567890abcdef1234567890abcdefn,
      avatar_part_count: 2n,
      avatar_media_format: 1n,
      avatar_updated_at: 1_700_000_777n,
    });
    expect(view.owner_wallet).toBe(OWNER.toRawString());
    expect(view.profile_registry).toBe(REGISTRY.toRawString());
    expect((view as any).auth_pubkey).toBeUndefined();

    expect(() => decodeKeyShardViewStack({ stack: fullViewStack(5n).slice(0, 16) }, decodeTonAddressSliceBoc))
      .toThrow(/expected 25 stack items/);
  });

  it('KSRPC-03: a wallet that never bought an avatar reports no avatar, not a zeroed one', async () => {
    const none = avatarRecordFromKeyShardView(
      decodeKeyShardViewStack({ stack: fullViewStack(0n) }, decodeTonAddressSliceBoc), OWNER.toRawString(),
    );
    expect(none.exists).toBe(false);
    expect(none.version).toBe(0n);
    expect(none.avatar_hash).toBe(0n);

    const bought = avatarRecordFromKeyShardView(
      decodeKeyShardViewStack({ stack: fullViewStack(5n) }, decodeTonAddressSliceBoc), OWNER.toRawString(),
    );
    expect(bought).toMatchObject({
      exists: true,
      version: 5n,
      avatar_hash: 0xabc123n,
      avatar_entry_id: 101n,
      avatar_part_count: 2n,
      media_format: 1n,
      updated_at: 1_700_000_777n,
    });
  });

  it('KSRPC-04: getAvatarVersion answers only for the CURRENT version, which is all the registry ever did', async () => {
    const provider = createKeyShardTonRpcProvider({
      profileRegistryAddress: REGISTRY.toRawString(),
      decodeAddressSliceBoc: decodeTonAddressSliceBoc,
      transport: { async runGetMethod() { return { stack: fullViewStack(5n) }; } },
    });

    await expect(provider.getAvatarVersion(OWNER.toRawString(), 5n)).resolves.toMatchObject({ exists: true, version: 5n });
    await expect(provider.getAvatarVersion(OWNER.toRawString(), 4n)).resolves.toMatchObject({ exists: false, version: 4n });
  });

  it('KSRPC-05: critical read options reach the transport', async () => {
    const seen: any[] = [];
    const provider = createKeyShardTonRpcProvider({
      profileRegistryAddress: REGISTRY.toRawString(),
      decodeAddressSliceBoc: decodeTonAddressSliceBoc,
      transport: {
        async runGetMethod(call: any) {
          seen.push(call);
          return { stack: fullViewStack(5n) };
        },
      },
    });
    const critical = { verify: false, allowUnverifiedCriticalRead: true, priority: 'critical', cacheTtlMs: 0 };
    await provider.getAvatar(OWNER.toRawString(), critical);
    expect(seen[0]).toMatchObject({ method: 'get_view', ...critical });
  });
});
