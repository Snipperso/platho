import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Cell } from '@ton/core';

// THE ONE PIN THAT IS NOT DERIVED FROM ANOTHER DERIVED THING.
//
// Six contracts are never deployed by the ceremony. Clients create them lazily at addresses derived from their own
// code, so a change to that code does not break anything loudly — it silently relocates EVERY existing user's data.
// The old data stays where it is; the new client looks somewhere else and finds an empty account.
//
// Four of the six are protected by the chain itself: the ceremony binds record_shard, intro_shard, public_shard and
// airdrop_ticket code hashes into the immutable FeeAccumulator, so a drifted shard's publish is rejected on-chain at
// gate 15055 / 15060. Loud, immediate, unmissable.
//
// KeyShard and RecoveryShard have NO such bind, and no manifest entry either — the final genesis manifest carries
// fourteen code hashes and neither of theirs is among them, because the ceremony neither deploys nor binds them.
// They hold, respectively, every user's identity keys plus their avatar pointer, and the K_root blobs that exist in
// exactly one place on earth.
//
// AND EVERY EXISTING CHECK COMPARES A GENERATED THING TO A GENERATED THING:
//   * shard-code-hash-evidence EVID-01 checks CURRENT_CODE_HASHES.txt against build/  — both regenerate together
//   * shard-browser-address ADDR-05 checks web/shard-code.mjs against build/          — both regenerate together
//   * the preprod family check compares artifacts/*.txt against CURRENT_CODE_HASHES   — all regenerate together
// So if the code itself changes, every one of them moves in lockstep and stays green. A Tact patch release that
// alters codegen is enough, and nothing in the repository would say a word.
//
// This file is the only fixed point: LITERAL hashes, written down once. Changing a contract is allowed — updating
// this list is how you say you meant to. After the genesis seal, updating it for KeyShard or RecoveryShard means
// abandoning live user data, so treat a diff here as a migration decision, not a chore.

/** Frozen 2026-07-31, against the tier-4 audit build. */
const FROZEN: Array<{ name: string; boc: string; hash: string; pinnedOnChain: string | null }> = [
  {
    name: 'RecordShard',
    boc: 'build/RecordShard/RecordShard_RecordShard.code.boc',
    hash: '00600cbb9377330a78afbcf5b9c87b23d9c465a136691a13d67d35e4a1537916',
    pinnedOnChain: 'FeeAccumulator.BindShardCode (publish rejected at 15055 on drift)',
  },
  {
    name: 'IntroShard',
    boc: 'build/IntroShard/IntroShard_IntroShard.code.boc',
    hash: 'd91e7b658543b441516d6145d9852e1340ab168d4de3db9e4b130bbd53a3021b',
    pinnedOnChain: 'FeeAccumulator.BindIntroShardCode (publish rejected at 15055 on drift)',
  },
  {
    name: 'PublicShard',
    boc: 'build/PublicShard/PublicShard_PublicShard.code.boc',
    hash: '55cbb05ffdc1c92c23441cefd9f4674619b59f822cff949464f761196c19f398',
    pinnedOnChain: 'FeeAccumulator.BindPublicShardCode (publish rejected at 15055 on drift)',
  },
  {
    name: 'AirdropTicket',
    boc: 'build/AirdropTicket/AirdropTicket_AirdropTicket.code.boc',
    hash: '30d603d0d74faa83f876e1bd71dc7309c6bf64cdd148a3dacfd3dfc12f3b8a48',
    pinnedOnChain: 'FeeAccumulator.BindTicketCode (redeem rejected at 15060 on drift)',
  },
  {
    name: 'KeyShard',
    boc: 'build/KeyShard/KeyShard_KeyShard.code.boc',
    hash: '81761197119847160003106cbbe7d9751f80d6683e0f5f609a61c9c8f9857dbd',
    // NOTHING. This line is the entire protection.
    pinnedOnChain: null,
  },
  {
    name: 'RecoveryShard',
    boc: 'build/RecoveryShard/RecoveryShard_RecoveryShard.code.boc',
    hash: 'a73538d916df635a126354bfa8f53c9f43c75085002977911f4c7e4228d4e0d3',
    pinnedOnChain: null,
  },
];

function codeHash(path: string): string {
  return Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
}

describe('lazily-deployed shard code is frozen', () => {
  it('SHARD-FREEZE-01: every user-address-determining contract still hashes to its pinned value', () => {
    const drifted: string[] = [];
    for (const entry of FROZEN) {
      const actual = codeHash(entry.boc);
      if (actual === entry.hash) continue;
      drifted.push(`${entry.name}: pinned ${entry.hash} but build/ now produces ${actual}. `
        + (entry.pinnedOnChain
          ? `Drift here is caught on-chain by ${entry.pinnedOnChain}, so a live network fails loudly — but every `
            + 'client-derived address for this contract still moves. Update the pin only with that in mind.'
          : 'NOTHING ELSE PINS THIS CONTRACT — no ceremony bind, no manifest entry, no on-chain check. Every '
            + 'existing user\'s account for it moves to a new address and the old one is simply never read again. '
            + 'Before the genesis seal, update the pin. After the seal, this is data loss, not a rebaseline.'));
    }
    expect(drifted, drifted.join('\n')).toEqual([]);
  });

  it('SHARD-FREEZE-02: the two contracts with no other pin are still the two this file says they are', () => {
    // Guards the GUARD's premise. If a future ceremony step starts binding KeyShard's code — or stops binding
    // RecordShard's — the severity text above becomes a lie, and a wrong severity is how a real warning gets
    // waved through. Derived from the packet, not from this file's own list.
    const packet = JSON.parse(readFileSync('artifacts/local/mainnet_tx_dry_run_packet.json', 'utf8'));
    const labels: string[] = [
      ...(packet.control_messages ?? []),
      ...(packet.funding_messages ?? []),
    ].map((s: any) => s?.body?.label ?? '');

    const boundByCeremony = new Set(
      labels.filter((l) => /^FeeAccumulator\.Bind\w*(Shard|Ticket)Code/.test(l)).map((l) => l.split('.')[1]),
    );
    expect(boundByCeremony.size, 'the ceremony must still bind the four shard/ticket code hashes').toBe(4);

    const unpinned = FROZEN.filter((e) => e.pinnedOnChain === null).map((e) => e.name).sort();
    expect(unpinned, 'exactly KeyShard and RecoveryShard are meant to have no on-chain pin')
      .toEqual(['KeyShard', 'RecoveryShard']);
  });
});
