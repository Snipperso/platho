import { describe, expect, it } from 'vitest';
import { Address, contractAddress } from '@ton/core';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';
import {
  createKeyShardTonRpcProvider,
  decodeKeyShardViewStack,
  avatarRecordFromKeyShardView,
  deriveKeyShardRawAddress,
} from '../web/key-shard-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc, decodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// KEY-SHARD RPC PROVIDER — the read side of the 2026-07-21 pointer move.
//
// Two things here can fail SILENTLY and neither raises an error at the call site:
//   * reading the wrong ACCOUNT — the address is derived, not looked up, so a wrong derivation is a live empty
//     account and every user simply appears to have no keys and no avatar (KSRPC-01);
//   * reading the wrong FIELD — the view is 24 flat stack items, so a decoder that drifted by one would hand
//     callers an encryption key where a nonce belongs (KSRPC-02).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const REGISTRY = Address.parse('EQDG8kf4ikGQRyTZcZ2POIWEqwqAaZWbi9Y6qPp3EXTa_Pq7');
const OWNER = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');

const num = (value: bigint) => ({
  type: 'num',
  value: value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`,
});
const addr = (address: string) => ['slice', encodeTonAddressSliceBoc(address)];

/** A registered shard that has bought an avatar. Every value is distinct so a decoder that drifted by one slot
 *  produces visibly wrong output rather than something that still typechecks and still looks plausible. */
const fullViewStack = (avatarVersion: bigint) => [
  num(-1n),
  addr(OWNER.toRawString()),
  num(0x1111n),                                   //  2 key_id
  num(3n),                                        //  3 key_generation
  num(4n),                                        //  4 rotation_nonce
  num(0x5555n),                                   //  5 enc_pubkey
  num(0x6666n),                                   //  6 sign_pubkey
  num(0x7777n),                                   //  7 scan_pubkey
  num(0x8888n),                                   //  8 pq_kem_pubkey_hash
  num(1184n),                                     //  9 pq_kem_pubkey_len
  ['cell', 'te6ccgEBAQEAAgAAAA=='],               // 10 pq_kem_pubkey
  num(2n),                                        // 11 crypto_suite_mask
  num(1_700_000_000n),                            // 12 created_at
  num(12345n),                                    // 13 created_lt
  num(57_000_000n),                               // 14 min_register_value
  num(12_000_000n),                               // 15 min_replace_value
  addr(REGISTRY.toRawString()),                   // 16 profile_registry
  num(avatarVersion),                             // 17 avatar_version
  num(0xabc123n),                                 // 18 avatar_hash
  num(101n),                                      // 19 avatar_entry_id
  num(0x1234567890abcdef1234567890abcdefn),       // 20 avatar_stream_id
  num(2n),                                        // 21 avatar_part_count
  num(1n),                                        // 22 avatar_media_format
  num(1_700_000_777n),                            // 23 avatar_updated_at
];

describe('KeyShard TON RPC provider', () => {
  it('KSRPC-01: the provider reads the SAME account @ton/core derives from the compiled wrapper', async () => {
    // A wrong address here does not throw. It is a real, empty account, so the app would report "this user has no
    // identity" for every user — which is why the derivation is compared against the reference rather than
    // asserted to be self-consistent.
    const reference = contractAddress(0, await KeyShard.init(OWNER, REGISTRY)).toRawString();
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
    // auth_pubkey is deliberately absent from the view: it authorises rotation, and advertising it would hand an
    // observer the exact key to attack. If it ever appears, the arity check below goes red first.
    expect((view as any).auth_pubkey).toBeUndefined();

    expect(() => decodeKeyShardViewStack({ stack: fullViewStack(5n).slice(0, 16) }, decodeTonAddressSliceBoc))
      .toThrow(/expected 24 stack items/);
  });

  it('KSRPC-03: a wallet that never bought an avatar reports no avatar, not a zeroed one', async () => {
    // avatar_version 0 is the "never bought" marker, and it must map to exists:false — the app treats a record
    // with exists:true as a pointer worth fetching capsule bytes for, and a zeroed pointer fetches nothing
    // forever while looking like a real avatar that failed to load.
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
    // ProfileRegistry deleted the previous record on every update, so get_avatar_version already returned
    // exists:false for anything but the current version. Preserving that exactly is what makes this a move of the
    // data rather than a loss of it.
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
