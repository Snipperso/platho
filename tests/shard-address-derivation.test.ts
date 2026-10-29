import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';


function deriveShardData(writePubkey: bigint, epoch: bigint) {
  return beginCell()
    .storeUint(0, 1)
    .storeInt(writePubkey, 257)
    .storeInt(epoch, 257)
    .endCell();
}

describe('SHARD ADDRESS DERIVATION — rebuilt by hand must equal what Tact computes', () => {
  it('SHARDDERIV-01: the hand-built init data and address match RecordShard.init() across the value range', async () => {
    const cases: Array<[bigint, bigint, string]> = [
      [1n, 0n, 'smallest non-trivial'],
      [0n, 20_000n, 'zero pubkey, real epoch'],
      [(1n << 255n) + 7n, (1n << 32n) - 1n, 'top of the signed range and max uint32 epoch'],
      [(1n << 256n) - 1n, 1n, 'all-ones pubkey — the case that breaks a naive storeUint(256)'],
      [0x9f2b_1c04_dead_beefn, 20_290n, 'a realistic key and today-ish epoch'],
    ];

    for (const [pubkey, epoch, label] of cases) {
      const real = await RecordShard.init(pubkey, epoch);
      const mine = deriveShardData(pubkey, epoch);

      expect(mine.hash().toString('hex'), `init DATA must match for: ${label}`)
        .toBe(real.data.hash().toString('hex'));
      expect(contractAddress(0, { code: real.code, data: mine }).toString(), `ADDRESS must match for: ${label}`)
        .toBe(contractAddress(0, real).toString());
    }
  });

  it('SHARDDERIV-02: the derivation is sensitive — a wrong pubkey or epoch lands somewhere else', async () => {
    const base = contractAddress(0, { code: (await RecordShard.init(5n, 100n)).code, data: deriveShardData(5n, 100n) });
    const otherKey = contractAddress(0, { code: (await RecordShard.init(5n, 100n)).code, data: deriveShardData(6n, 100n) });
    const otherEpoch = contractAddress(0, { code: (await RecordShard.init(5n, 100n)).code, data: deriveShardData(5n, 101n) });

    expect(otherKey.toString(), 'a different write_pubkey must be a different shard').not.toBe(base.toString());
    expect(otherEpoch.toString(), 'a different epoch must be a different shard').not.toBe(base.toString());
  });
});
