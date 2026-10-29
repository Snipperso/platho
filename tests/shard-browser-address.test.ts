import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address, contractAddress, beginCell, toNano } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { recordShardAddressBytes, introShardAddressBytes, introShardAddressBytesFor, recoveryShardAddressBytes, keyShardAddressBytes, publicShardAddressBytes, rawAddress, keyShardStateInit } from '../web/shard-address.mjs';
import { renderShardCodeModule } from '../scripts/generate_shard_code.mjs';
import { stripComments } from '../scripts/lib/strip-comments.mjs';
import { recoveryOwnerSlotKey, RECOVERY_MAX_SLOTS, addrKey } from '../web/shard-discovery.mjs';
import { selfRecoveryShardSpace } from '../web/conv-discovery.mjs';
import { buildRecoveryPublish } from '../web/publish-builder.mjs';
import { recoveryOwnerPublicKey } from '../web/crypto/conv-routing.mjs';


const referenceIntro = async (epoch: number, bucket: number) =>
  contractAddress(0, await IntroShard.init(BigInt(epoch), BigInt(bucket))).toRawString();
const referenceRecord = async (key: bigint, epoch: number) =>
  contractAddress(0, await RecordShard.init(key, BigInt(epoch))).toRawString();
const referenceRecovery = async (slot: bigint) =>
  contractAddress(0, await RecoveryShard.init(slot)).toRawString();
const referenceKeyShard = async (owner: Address, registry: Address) =>
  contractAddress(0, await KeyShard.init(owner, registry)).toRawString();
const referencePublic = async (partitionKey: bigint, epochTag: bigint) =>
  contractAddress(0, await PublicShard.init(partitionKey, epochTag)).toRawString();

describe('SHARD-BROWSER-ADDRESS — two implementations, one address', () => {
  it('ADDR-01: INTRO shard addresses match the reference for a wide spread of arguments', async () => {
    const cases: Array<[number, number]> = [
      [0, 0], [1, 0], [20718, 0], [20718, 1], [20718, 1023],
      [20718, 4095], [65535, 65535], [1, 999983], [20000, 7], [2 ** 31 - 1, 2 ** 20],
    ];
    for (const [epoch, bucket] of cases) {
      const reference = await referenceIntro(epoch, bucket);
      const browser = rawAddress(await introShardAddressBytesFor(17, epoch, bucket));
      expect(browser, `INTRO(${epoch}, ${bucket})`).toBe(reference);
    }
    for (const [epoch, bucket] of cases.filter(([e]) => e < 20_730)) {
      expect(rawAddress(await introShardAddressBytes(epoch, bucket)), `INTRO(${epoch}, ${bucket}) via the wrapper`)
        .toBe(await referenceIntro(epoch, bucket));
    }
  }, 120_000);

  it('ADDR-02: CONV shard addresses match, including full-width 256-bit write keys', async () => {
    const keys = [
      0n,
      1n,
      0xdeadbeefn,
      (1n << 255n),
      (1n << 256n) - 1n,
      BigInt('0x' + 'a3'.repeat(32)),
    ];
    for (const key of keys) {
      for (const epoch of [0, 20718]) {
        const reference = await referenceRecord(key, epoch);
        const browser = rawAddress(await recordShardAddressBytes(key, epoch));
        expect(browser, `CONV(${key.toString(16)}, ${epoch})`).toBe(reference);
      }
    }
  }, 120_000);

  it('ADDR-03: RECOVERY slot addresses match', async () => {
    for (const slot of [0n, 7n, (1n << 255n) + 12345n, (1n << 256n) - 1n]) {
      const reference = await referenceRecovery(slot);
      const browser = rawAddress(await recoveryShardAddressBytes(slot));
      expect(browser, `RECOVERY(${slot.toString(16)})`).toBe(reference);
    }
  }, 120_000);

  it('ADDR-06: the READ path and the WRITE path derive the SAME recovery slot key, at every index', async () => {
    const seed = new Uint8Array(32).fill(0x77);
    const seenPubkeys = new Set<string>();

    for (const slotIndex of [0, 1, 2, 7, 42, 128, 255]) {
      const ownerPub = await recoveryOwnerPublicKey(seed, slotIndex);
      seenPubkeys.add(Buffer.from(ownerPub).toString('hex'));
      const read = await recoveryOwnerSlotKey(ownerPub, slotIndex);
      const write = (await buildRecoveryPublish({
        seed, slotIndex, seq: 1, h0: 0x1n, h1: 0x2n,
        body: beginCell().storeUint(0xAB, 8).endCell(), value: toNano('0.05'),
      })).slotKey;
      expect(read, `slot ${slotIndex}: read path == write path`).toBe(write);
    }
    expect(seenPubkeys.size, 'each slot must carry an independent owner key (no enumeration handle)').toBe(7);

    const space = await selfRecoveryShardSpace(seed);
    expect(space.slots.length, 'the probe covers the whole legal range').toBe(RECOVERY_MAX_SLOTS);
    for (const idx of [0, 99, RECOVERY_MAX_SLOTS - 1]) {
      const built = await buildRecoveryPublish({
        seed, slotIndex: idx, seq: 1, h0: 0x1n, h1: 0x2n,
        body: beginCell().storeUint(0xAB, 8).endCell(), value: toNano('0.05'),
      });
      expect(space.slots[idx].slotKey, `probe slot ${idx} is where the writer writes`).toBe(built.slotKey);
      expect(addrKey(space.slots[idx].address)).toBe(addrKey(built.to));
    }
  }, 180_000);

  it('ADDR-07: KEY shard addresses match — the first shard whose init arguments are ADDRESSES', async () => {
    const owners = [
      Address.parse('EQDG8kf4ikGQRyTZcZ2POIWEqwqAaZWbi9Y6qPp3EXTa_Pq7'),
      Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH'),
      new Address(0, Buffer.alloc(32, 0)),
      new Address(0, Buffer.alloc(32, 0xff)),
    ];
    const registries = [
      Address.parse('UQBZ8Lh9AuO1e9XcFBJ0NmE10IY9FoVpQeoABd9V5ninPATH'),
      new Address(0, Buffer.alloc(32, 0x5a)),
    ];
    const seen = new Set<string>();
    for (const owner of owners) {
      for (const registry of registries) {
        const reference = await referenceKeyShard(owner, registry);
        const browser = rawAddress(await keyShardAddressBytes(owner.toRawString(), registry.toRawString(), 17));
        expect(browser, `KEY(${owner.toRawString()}, ${registry.toRawString()})`).toBe(reference);
        seen.add(browser);
      }
    }
    expect(seen.size, 'every (wallet, registry) pair must be its OWN address').toBe(owners.length * registries.length);
  }, 120_000);

  it('ADDR-08: PUBLIC shard addresses match, across all four kinds and full-width partition keys', async () => {
    const partitionKeys = [
      0n,
      1n,
      0xdeadbeefn,
      (1n << 255n),
      (1n << 256n) - 1n,
      BigInt('0x' + 'c3'.repeat(32)),
    ];
    const eras = [0, 1, 20718, 2 ** 31 - 1];
    const seen = new Set<string>();
    for (const kind of [0, 1, 2, 3]) {
      for (const era of eras) {
        const epochTag = (BigInt(kind) << 32n) | BigInt(era);
        const pk = partitionKeys[(kind + era) % partitionKeys.length];
        const reference = await referencePublic(pk, epochTag);
        const browser = rawAddress(await publicShardAddressBytes(pk, epochTag));
        expect(browser, `PUBLIC(kind=${kind}, era=${era}, pk=${pk.toString(16)})`).toBe(reference);
        seen.add(browser);
      }
    }
    const era = 20718;
    const pk = 0xabcn;
    const addrs = await Promise.all([0, 1, 2, 3].map((k) =>
      referencePublic(pk, (BigInt(k) << 32n) | BigInt(era))));
    expect(new Set(addrs).size, 'each kind must occupy its own address at the same era and partition key').toBe(4);
  }, 120_000);

  it('ADDR-04: the browser refuses arguments it cannot encode instead of producing a wrong address', async () => {
    await expect(introShardAddressBytes(-1, 0)).rejects.toThrow();
    await expect(recoveryShardAddressBytes(1n << 256n)).rejects.toThrow();
    await expect(keyShardAddressBytes('EQDG8kf4ikGQRyTZcZ2POIWEqwqAaZWbi9Y6qPp3EXTa_Pq7', '0:' + '11'.repeat(32), 17))
      .rejects.toThrow();
    await expect(keyShardAddressBytes('0:' + '11'.repeat(32), undefined as any, 17)).rejects.toThrow();

    expect(() => keyShardAddressBytes('0:' + '11'.repeat(32), '0:' + '22'.repeat(32), 19),
      'asking for a generation this build has no cell for must THROW, not answer with the other one')
      .toThrow(/no key shard code cell for generation 19|name the generation \(17 or 18\)/);

    expect(() => keyShardAddressBytes('0:' + '11'.repeat(32), '0:' + '22'.repeat(32)))
      .toThrow(/name the generation/);
    expect(() => keyShardStateInit('0:' + '11'.repeat(32), '0:' + '22'.repeat(32)))
      .toThrow(/name the generation/);
    const explicit = rawAddress(await keyShardAddressBytes('0:' + '11'.repeat(32), '0:' + '22'.repeat(32), 17));
    expect(explicit.startsWith('0:'), 'and a named seventeen still answers').toBe(true);
  }, 60_000);

  it('ADDR-05: the checked-in code constants are exactly what build/ produces', () => {
    const shipped = (text: string) => stripComments(text, 'web/shard-code.mjs').trim();
    const onDisk = readFileSync('web/shard-code.mjs', 'utf8');
    expect(shipped(onDisk), 'run: node scripts/generate_shard_code.mjs').toBe(shipped(renderShardCodeModule()));
  });
});
