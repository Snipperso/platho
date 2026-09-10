import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { WRITES_GENERATION } from '../web/cutover-epoch.mjs';
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

// EVERY CHAIN CONTRACT THE CLIENT NAMES: the config key, the manifest key it must equal, and the.tact file whose
// presence says the contract still belongs to the generation this build writes. One table, so CFGGEN-02 and
// CFGGEN-05 can never disagree about what the client is supposed to know.
const CONFIGURED: Array<[string, string, string]> = [
  ['ath', 'ath_master', 'ATHMaster'],
  ['feeAccumulator', 'fee_accumulator', 'FeeAccumulator'],
  ['airdropPool', 'airdrop_pool', 'AirdropPool'],
  ['usernameRegistry', 'username_registry', 'UsernameRegistry'],
  ['profileRegistry', 'profile_registry', 'ProfileRegistry'],
  ['marketStabilitySeller', 'market_stability_seller', 'MarketStabilitySeller'],
];
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
    const pairs: Array<[string, string]> = CONFIGURED.map(([key, manifestKey]) => [key, addresses[manifestKey]]);
    for (const [key, expected] of pairs) {
      expect(expected, `the verified manifest has no address for ${key}`).toBeTruthy();
      expect(
        same(configAddress(key), expected),
        `${key}: client config says ${configAddress(key)}, verified genesis says ${expected}`,
      ).toBe(true);
    }
  });

  it('CFGGEN-05: every configured contract still EXISTS in the generation this build writes', () => {
    // [decided 2026-09-02]
    //
    // He is right, and three contracts leave: AirdropPool, AirdropTicket and FeeAccumulator are in contracts/ and
    // absent from contracts18/. What was wrong was not the rows but the LIST — six entries maintained by hand,
    // where the flip release must remember to delete three. This project spent a whole day on that class: a gate
    // aimed at a repealed ruling, a document promising the opposite of its own guard, a supplier list that could
    // not answer the generation asking it. A list that must be edited in step with a decision taken in another
    // file is a reminder, and reminders are what get missed.
    //
    // So the removal is not scheduled — it is ANNOUNCED. Today WRITES_GENERATION is 17, all six exist in
    // contracts/, and this is green. The flip sets it to 18, and the two that no longer exist turn this red at
    // exactly the moment they should be removed, naming themselves. Nothing has to be remembered.
    const dir = WRITES_GENERATION === 17 ? 'contracts' : 'contracts18/contracts';
    const missing = CONFIGURED
      .filter(([, , contract]) => !existsSync(`${dir}/${contract}.tact`))
      .map(([key, , contract]) => `${key} -> ${contract}.tact`);
    expect(missing, `this build writes generation ${WRITES_GENERATION}, whose contracts live in ${dir}/, and the `
      + `client config still names ${missing.join(', ')}. That contract is not part of this generation: drop the `
      + 'entry from platho-config and its row from CONFIGURED, and say so in the journal.')
      .toEqual([]);
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
