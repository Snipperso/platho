import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';


type Verdict = 'caller-funds-own-request' | 'fixed-destination-deadman' | 'in-flight-record'
  | 'pays-the-caller-by-design' | 'change-returned' | 'harmless-subsidy';

const REVIEWED: Record<string, Verdict> = {
  'UsernameNFTItem.ProveUsernameOwnership': 'caller-funds-own-request',
  'KeyShard.KeyShardProveOwnership': 'caller-funds-own-request',
  'UsernameNFTItem.GetStaticData': 'caller-funds-own-request',
  'RecordShard.CapsulePublish': 'caller-funds-own-request',
  'IntroShard.IntroPublish': 'caller-funds-own-request',
  'PublicShard.PublicPublish': 'caller-funds-own-request',
  'ATHVesting.ClaimAthVesting': 'caller-funds-own-request',
  'RecoveryShard.RecoveryStore': 'caller-funds-own-request',
  'MarketStabilitySeller.BuyMarketStabilityAth': 'caller-funds-own-request',

  'AirdropPool.AirdropSweepResidualToTreasury': 'fixed-destination-deadman',
  'AirdropPool.AirdropSweepUnaccountedTon': 'fixed-destination-deadman',
  'BuybackBurn.SweepStuckReserveToTreasury': 'fixed-destination-deadman',
  'ATHWallet.ATHRecoverStuckOutgoing': 'fixed-destination-deadman',
  'RecoveryShard.EvictRecovery': 'fixed-destination-deadman',

  'UsernameRegistry.FlushTreasuryAthDue': 'in-flight-record',
  'UsernameRegistry.FlushBurnAthDue': 'in-flight-record',
  'ProfileRegistry.FlushProfileTreasuryAthDue': 'in-flight-record',
  'ProfileRegistry.FlushProfileBurnAthDue': 'in-flight-record',
  'UsernameRegistry.bounced<InitializeUsernameItem>': 'in-flight-record',

  'RecordShard.RetireShard': 'pays-the-caller-by-design',
  'IntroShard.RetireShard': 'pays-the-caller-by-design',
  'PublicShard.RetirePublicShard': 'pays-the-caller-by-design',

  'MarketStabilitySeller.FlushMarketStabilityTreasuryTon': 'change-returned',
  'FeeAccumulator.FlushTreasuryDue': 'change-returned',
  'FeeAccumulator.FlushBuybackDue': 'change-returned',
  'FeeAccumulator.SweepUnaccounted': 'change-returned',

  'BuybackBurn.ExecuteBuybackChunk': 'harmless-subsidy',
};

function permissionlessSenders(): string[] {
  const out: string[] = [];
  for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
    const name = file.replace(/\.tact$/, '');
    if (/^Mock|^M20T/.test(name)) continue;
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
    expect(found.length, 'the sweep must find the permissionless senders').toBeGreaterThan(20);

    const unreviewed = found.filter((k) => !(k in REVIEWED));
    expect(unreviewed, `NEW permissionless value sender(s). Read each one and ask the question this class is about:\n`
      + `can the CALLER's inbound value stand in for the contract's own outgoing value, so an accounting bucket falls\n`
      + `while the balance does not? Then add it to REVIEWED with its verdict.\n${unreviewed.join('\n')}`).toEqual([]);
  });

  it('PVS-02: the reviewed list has not drifted away from the contracts', () => {
    const found = new Set(permissionlessSenders());
    const stale = Object.keys(REVIEWED).filter((k) => !found.has(k));
    expect(stale, `REVIEWED names receivers that are no longer permissionless value senders — delete them:\n${stale.join('\n')}`)
      .toEqual([]);
  });
});
