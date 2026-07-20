import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD ADDRESS DERIVATION — the pin the airdrop accrual's authentication rests on.
//
// AirdropPool cannot IMPORT RecordShard to use `initOf`: RecordShard's code embeds FeeAccumulator's address, so
// a pool whose code embedded shard code would make its own address depend on shard code, which in turn depends
// on the pool's address. That is a build cycle. The escape is to bind the shard CODE CELL at genesis as runtime
// data and rebuild the address by hand:
//
//     data = beginCell().storeUint(0, 1).storeInt(write_pubkey, 257).storeInt(epoch, 257).endCell()
//     addr = contractAddress(0, { code: bound_shard_code, data })
//
// Hand-rebuilding another contract's init layout is exactly the kind of hidden coupling that rots silently, in
// a contract that can NEVER be fixed after seal. So it is not left to trust: this test is the guard. If a
// compiler upgrade or a field change ever moves that layout, this goes red BEFORE the mismatch becomes an
// airdrop that authenticates nothing.
//
// Note WHY the formula is short: only the init ARGUMENTS enter the data cell (behind a one-bit lazy-init flag),
// not the contract's state fields. RecordShard's state is uint256/uint32/uint64/dict/uint32, which does NOT
// appear here — so adding state fields to RecordShard would not change this derivation at all. Only its code
// cell moves, and the code cell is bound, not computed.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The derivation AirdropPool will perform in Tact, written here in the same shape. */
function deriveShardData(writePubkey: bigint, epoch: bigint) {
  return beginCell()
    .storeUint(0, 1)                 // Tact's lazy-init flag
    .storeInt(writePubkey, 257)      // init arg 1, widened to signed 257
    .storeInt(epoch, 257)            // init arg 2
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
    // A derivation that quietly ignored one of its inputs would authenticate ANY shard, which is the whole
    // failure this guard exists to prevent. So prove both inputs actually move the address.
    const base = contractAddress(0, { code: (await RecordShard.init(5n, 100n)).code, data: deriveShardData(5n, 100n) });
    const otherKey = contractAddress(0, { code: (await RecordShard.init(5n, 100n)).code, data: deriveShardData(6n, 100n) });
    const otherEpoch = contractAddress(0, { code: (await RecordShard.init(5n, 100n)).code, data: deriveShardData(5n, 101n) });

    expect(otherKey.toString(), 'a different write_pubkey must be a different shard').not.toBe(base.toString());
    expect(otherEpoch.toString(), 'a different epoch must be a different shard').not.toBe(base.toString());
  });
});
