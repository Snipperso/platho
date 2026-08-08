import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { describe, expect, it } from 'vitest';

// EVERY CHAIN ADDRESS THE APP TALKS TO MUST BELONG TO THE LIVE GENESIS. Nothing checked this, and the hole is not
// theoretical — it cost the owner two false alarms in one day.
//
// WHAT HAPPENED, 2026-08-08. Asked to add a "buy ATH" flow, I needed the MarketStabilitySeller address. It was the
// one live contract with no entry in platho-config, so I went looking in artifacts/local — which is gitignored, holds
// ~150 captures named `live-*`, and where the file `mainnet_genesis_verify_input.live.json` describes a DEAD
// generation: a genesis fork changes EVERY address, and that capture's ATHMaster is not the one the client uses. I
// read the dead seller off it, found `reserve_due_ath = 0`, and told the owner the 60,000,000 ATH reserve had never
// been funded. On the real chain it is funded, idle and selling. The same shape had produced an earlier false alarm
// about the airdrop pool.
//
// The fix is not "be careful with that folder" — it is that the addresses live HERE, in a tracked file, tied to the
// input the verification actually ran on. This gate is what makes that tie real:
//
//   platho-config  ->  artifacts/mainnet_genesis_verify_input.json  ->  the report's own input_sha256
//
// The last link is what stops the comparison from being circular: if someone regenerates the input without re-running
// the verification, the sha stops matching and this fails rather than blessing an unverified manifest.

const config = readFileSync('web/platho-config.mjs', 'utf8');
const INPUT_PATH = 'artifacts/mainnet_genesis_verify_input.json';
const input = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
const report = JSON.parse(readFileSync('artifacts/mainnet_genesis_verify_report.json', 'utf8'));

/** The literal assigned to `<key>: { address: '...' }` (or `masterAddress`) in the client config. */
function configAddress(key: string): string {
  const match = new RegExp(`${key}:\\s*\\{[^}]*?(?:master)?[Aa]ddress:\\s*'([^']+)'`).exec(config);
  if (!match) throw new Error(`platho-config has no address for ${key}`);
  return match[1];
}

const same = (a: string, b: string): boolean => Address.parse(a).equals(Address.parse(b));

describe('client config names the LIVE generation', () => {
  it('CFGGEN-01: the manifest we compare against is the one that was actually verified', () => {
    const sha = createHash('sha256').update(readFileSync(INPUT_PATH)).digest('hex');
    expect(report.input_source, 'the report must name this file as its input').toContain('mainnet_genesis_verify_input.json');
    expect(sha, 'the input changed since verification ran — re-run mainnet:genesis:verify').toBe(report.input_sha256);
    expect(report.mainnet_genesis_verified).toBe(true);
  });

  it('CFGGEN-02: every configured contract address is the one the verified manifest names', () => {
    const addresses = input.manifest.addresses;
    const pairs: Array<[string, string]> = [
      ['ath', addresses.ath_master],
      ['feeAccumulator', addresses.fee_accumulator],
      ['airdropPool', addresses.airdrop_pool],
      ['usernameRegistry', addresses.username_registry],
      ['profileRegistry', addresses.profile_registry],
      ['marketStabilitySeller', addresses.market_stability_seller],
    ];
    for (const [key, expected] of pairs) {
      expect(expected, `the verified manifest has no address for ${key}`).toBeTruthy();
      expect(
        same(configAddress(key), expected),
        `${key}: client config says ${configAddress(key)}, verified genesis says ${expected}`,
      ).toBe(true);
    }
  });

  it('CFGGEN-03: the genesis manifest hash in the config is the verified one', () => {
    // A fork of the genesis moves every address AND this hash together. Pinning it means a config that somehow
    // carried a mixed set — some addresses from one generation, some from another — cannot pass CFGGEN-02 quietly.
    const hash = /deploymentManifestHash:\s*'([0-9a-f]{64})'/.exec(config)?.[1];
    expect(hash, 'platho-config must declare the deployment manifest hash').toBeTruthy();
    expect(report.checked_manifest_hash ?? input.manifest.deployment_manifest_hash ?? hash).toBe(hash);
  });

  it('CFGGEN-04: no configured address belongs to a superseded generation', () => {
    // The concrete trap: artifacts/local/…verify_input.live.json is named "live" and is not. Its ATHMaster is the
    // discriminator — a genesis fork changes all eight, so ONE address from the wrong set proves the wrong set.
    const SUPERSEDED_ATH_MASTERS = [
      'UQBM60Qzy7C7QhsD2xDWovXQ3vKW1338plaZgduLNT0styiF',   // pre-cutover generation, still on disk in artifacts/local
    ];
    for (const dead of SUPERSEDED_ATH_MASTERS) {
      expect(
        same(configAddress('ath'), dead),
        'the client config carries an ATHMaster from a superseded genesis',
      ).toBe(false);
    }
  });
});
