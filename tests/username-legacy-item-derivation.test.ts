import { describe, expect, it } from 'vitest';
import { Address, contractAddress } from '@ton/core';
import { UsernameNFTItem } from '../build/UsernameRegistry/UsernameRegistry_UsernameNFTItem';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// USERNAME-LEGACY-ITEM-DERIVATION — the one assumption the cross-generation username bridge rests on.
//
// The redeploy gives the new UsernameRegistry an empty name map, so on seal day every name from the previous
// generation looks free and any observer can take it. The fix needs no infrastructure: a username NFT item's
// address is deterministic in (registry, name_hash), gate 18031 lets only the owner move it, and the item sends
// NftOwnershipAssigned{previous_owner} FROM ITS OWN ADDRESS. So the new registry can authenticate a legacy
// claim by deriving the legacy item address and requiring sender() to equal it. Contract to contract.
//
// That derivation uses `initOf UsernameNFTItem`, which compiles the CURRENT build's item code. The deployed
// generation's item code is whatever was built back then. If the two differ by a single cell, every derived
// address points at an account that does not exist, every legacy claim is refused, and the names are lost —
// silently, because a refused claim is indistinguishable from a wrong claimant.
//
// A code-hash comparison would be suggestive. Reproducing a LIVE address is proof: the address commits to the
// code cell and the init data layout together. These five items were read off mainnet through toncenter from
// the live clean-15 collection (index == name_hash for this collection).
//
// If this ever goes red, the bridge cannot use `initOf` and must carry the legacy code hash explicitly.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Live clean-15 UsernameRegistry — the generation clean-17 supersedes. */
const LEGACY_REGISTRY = Address.parse('EQBhlvF4qNpc6PLN2-X9hgVqlq-6k2DJRtxkGbrgBkZL-i7N');

/** Item code hash observed on mainnet: toncenter reported 7MvqUAsTUFmhpGuuXIM7KK0mOq4CWKFG6fmNj3uEORA=. */
const LIVE_ITEM_CODE_HASH = Buffer.from('7MvqUAsTUFmhpGuuXIM7KK0mOq4CWKFG6fmNj3uEORA=', 'base64').toString('hex');

const LIVE_ITEMS = [
  { address: '0:db240907ca44e01649d6d642fc31edb7959af6f5d0343f15e15578a08514d51d', nameHash: '15205585544061986651086221487659093413391133053899926244906889345052289455174' },
  { address: '0:4591db9b0ae6c50ec014ba8199b1b9fc9eaadf8fa323de01f273d519d1d5c44d', nameHash: '16473466649923421812236513011894518767977612558292267712599194096342559720785' },
  { address: '0:270d1655ddd9de2e5a7f2e021a7767d80884f7ca56e158f098a9a7459222d670', nameHash: '19613553423615128483945941292897858115517742503161253343743220636878219610435' },
  { address: '0:0de793f08c58f96fb97aab15306c762b543dd1b76d5709c1e372ce4bc8c6be1b', nameHash: '28890561998516781285645355268325451993158052403000090160861433496995084062751' },
  { address: '0:3de984409782d84f0645bfc547e57ba8a2178cb83d1e5f15861dc613aa1a57c1', nameHash: '38727074583398786652116050918357833757195958149428510585904048867330815148543' },
];

describe('USERNAME-LEGACY-ITEM-DERIVATION — the current build reproduces live clean-15 item addresses', () => {
  it('LEGACY-ITEM-01: every live item address is reproduced from (legacy registry, name_hash)', async () => {
    for (const live of LIVE_ITEMS) {
      const init = await UsernameNFTItem.init(LEGACY_REGISTRY, BigInt(live.nameHash));
      const derived = contractAddress(0, init);
      expect(derived.toRawString(), `live item ${live.address}`).toBe(live.address);
    }
  }, 60_000);

  it('LEGACY-ITEM-02: the item code the current build emits is the code running on mainnet', async () => {
    // Pinned separately from the addresses: if the item source is ever edited, this names the cause directly
    // instead of leaving five address mismatches to be diagnosed.
    const init = await UsernameNFTItem.init(LEGACY_REGISTRY, 1n);
    expect(init.code.hash().toString('hex'), 'UsernameNFTItem code hash vs. mainnet').toBe(LIVE_ITEM_CODE_HASH);
  }, 60_000);

  it('LEGACY-ITEM-03: the derivation is bound to the registry, so a wrong registry cannot forge a claim', async () => {
    // The bridge authenticates by address equality. If the address did not depend on the registry, anyone could
    // deploy an item under their own collection and claim a name from it.
    const other = Address.parseRaw(`0:${'ab'.repeat(32)}`);
    const live = LIVE_ITEMS[0];
    const derived = contractAddress(0, await UsernameNFTItem.init(other, BigInt(live.nameHash)));
    expect(derived.toRawString(), 'a different registry must derive a different item').not.toBe(live.address);
  }, 60_000);
});
