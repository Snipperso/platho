import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// THE CLASS GUARD, written because closing instances did not close the class.
//
// The defect: a permissionless receiver where the CALLER's inbound value can substitute for the contract's own
// outgoing value, so an accounting bucket falls while the balance does not. Found in MarketStabilitySeller during
// wave-8 and fixed there; found again in FeeAccumulator's two flush legs days later — the same shape, in a contract
// wave-8 had already audited, because the fix had been applied to the instance rather than swept across the tree.
//
// So this enumerates every permissionless receiver that sends value and requires each to be listed with the reason it
// is safe. A NEW one reddens here until somebody writes that reason down. The list is the review, and the test is
// what makes the review mandatory rather than remembered.
//
// SWEPT 2026-07-30 — every entry below was read, not assumed.

type Verdict = 'caller-funds-own-request' | 'fixed-destination-deadman' | 'in-flight-record'
  | 'pays-the-caller-by-design' | 'change-returned' | 'harmless-subsidy';

const REVIEWED: Record<string, Verdict> = {
  // The caller pays for the thing they asked for, and the outgoing is exactly what they funded. Both proof lanes are
  // bounded on BOTH sides — a floor and a ceiling on context().value — which is stricter than any flush lane.
  'UsernameNFTItem.ProveUsernameOwnership': 'caller-funds-own-request',
  'KeyShard.KeyShardProveOwnership': 'caller-funds-own-request',
  'UsernameNFTItem.GetStaticData': 'caller-funds-own-request',
  'RecordShard.CapsulePublish': 'caller-funds-own-request',
  'IntroShard.IntroPublish': 'caller-funds-own-request',
  'PublicShard.PublicPublish': 'caller-funds-own-request',
  'ATHVesting.ClaimAthVesting': 'caller-funds-own-request',
  'RecoveryShard.RecoveryStore': 'caller-funds-own-request',
  'MarketStabilitySeller.BuyMarketStabilityAth': 'caller-funds-own-request',

  // Destination is bound at genesis and never caller-chosen, and a time gate stands in front. Subsidising these
  // simply hands the protocol money; there is nothing to divert.
  'AirdropPool.AirdropSweepResidualToTreasury': 'fixed-destination-deadman',
  'AirdropPool.AirdropSweepUnaccountedTon': 'fixed-destination-deadman',
  'BuybackBurn.SweepStuckReserveToTreasury': 'fixed-destination-deadman',
  'ATHWallet.ATHRecoverStuckOutgoing': 'fixed-destination-deadman',
  'RecoveryShard.EvictRecovery': 'fixed-destination-deadman',

  // The bucket decrement is matched by a PENDING RECORD, not by the caller's value: the amount is held in flight and
  // restored on failure or bounce. The caller funds transport only, which is unavoidable and correct.
  'UsernameRegistry.FlushTreasuryAthDue': 'in-flight-record',
  'UsernameRegistry.FlushBurnAthDue': 'in-flight-record',
  'ProfileRegistry.FlushProfileTreasuryAthDue': 'in-flight-record',
  'ProfileRegistry.FlushProfileBurnAthDue': 'in-flight-record',
  'UsernameRegistry.bounced<InitializeUsernameItem>': 'in-flight-record',

  // Retiring a shard pays its residual to whoever did the work. That IS the mechanism — it replaced a per-entry
  // eviction bounty — and it is time-gated with the account destroyed.
  'RecordShard.RetireShard': 'pays-the-caller-by-design',
  'IntroShard.RetireShard': 'pays-the-caller-by-design',
  'PublicShard.RetirePublicShard': 'pays-the-caller-by-design',

  // Had the defect; fixed by returning everything the caller sent above the execution reserve the gate collects.
  'MarketStabilitySeller.FlushMarketStabilityTreasuryTon': 'change-returned',
  'FeeAccumulator.FlushTreasuryDue': 'change-returned',
  'FeeAccumulator.FlushBuybackDue': 'change-returned',
  // Excludes the caller's own value from the surplus it computes and returns the change under nativeReserve.
  'FeeAccumulator.SweepUnaccounted': 'change-returned',

  // A caller CAN cover the 51.05 GRAM envelope and leave the contract's own in place. It is not an attack: their
  // money executes a real buyback, ATH is bought and burned, and the stranded envelope reaches the treasury through
  // the dead-man sweep above. Recorded rather than "fixed", because the honest description is a donation.
  'BuybackBurn.ExecuteBuybackChunk': 'harmless-subsidy',
};

/** Receivers that send value and have no sender() check — i.e. anyone may invoke them. */
function permissionlessSenders(): string[] {
  const out: string[] = [];
  for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
    const name = file.replace(/\.tact$/, '');
    if (/^Mock|^M20T/.test(name)) continue;                       // harnesses, not deployed
    const src = readFileSync(`contracts/${file}`, 'utf8');
    const lines = src.split('\n');
    let header = '';
    let sends = false;
    let authed = false;
    for (const line of lines) {
      if (/^ {4}(receive|bounced)\(/.test(line)) { header = line.trim(); sends = false; authed = false; }
      if (/sender\(\) ==/.test(line)) authed = true;
      if (/message\(MessageParameters|send\(SendParameters/.test(line)) sends = true;
      if (line === '    }' && header && sends && !authed) {
        const m = header.match(/^(?:receive|bounced)\((?:msg|_)\s*:\s*(?:bounced<)?(\w+)/);
        if (m) out.push(`${name}.${/^bounced/.test(header) ? `bounced<${m[1]}>` : m[1]}`);
        header = '';
      }
    }
  }
  return out;
}

describe('permissionless value senders', () => {
  it('PVS-01: every permissionless receiver that sends value has been reviewed for caller-funded substitution', () => {
    const found = permissionlessSenders();
    // Aimed at something real: a sweep that quietly matches nothing is an ABSENT guard, and this repo has shipped two.
    expect(found.length, 'the sweep must find the permissionless senders').toBeGreaterThan(20);

    const unreviewed = found.filter((k) => !(k in REVIEWED));
    expect(unreviewed, `NEW permissionless value sender(s). Read each one and ask the question this class is about:\n`
      + `can the CALLER's inbound value stand in for the contract's own outgoing value, so an accounting bucket falls\n`
      + `while the balance does not? Then add it to REVIEWED with its verdict.\n${unreviewed.join('\n')}`).toEqual([]);
  });

  it('PVS-02: the reviewed list has not drifted away from the contracts', () => {
    // The mirror failure mode: entries left behind for receivers that no longer exist make the list look thorough
    // while covering nothing.
    const found = new Set(permissionlessSenders());
    const stale = Object.keys(REVIEWED).filter((k) => !found.has(k));
    expect(stale, `REVIEWED names receivers that are no longer permissionless value senders — delete them:\n${stale.join('\n')}`)
      .toEqual([]);
  });
});
