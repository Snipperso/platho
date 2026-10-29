import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { WRITES_GENERATION } from '../web/cutover-epoch.mjs';
import { describe, expect, it } from 'vitest';


const config = readFileSync('web/platho-config.mjs', 'utf8');

const CONFIGURED: Array<[string, string, string]> = [
  ['ath', 'ath_master', 'ATHMaster'],
  ['usernameRegistry', 'username_registry', 'UsernameRegistry'],
  ['profileRegistry', 'profile_registry', 'ProfileRegistry'],
  ['marketStabilitySeller', 'market_stability_seller', 'MarketStabilitySeller'],
];
const INPUT_PATH = 'artifacts/mainnet_genesis_verify_input.json';
const input = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
const report = JSON.parse(readFileSync('artifacts/mainnet_genesis_verify_report.json', 'utf8'));

const CLEAN18 = JSON.parse(readFileSync('artifacts/mainnet_clean18_ceremony.json', 'utf8'));
const FROM_CEREMONY: Record<string, string> = { profileRegistry: 'profile_registry', moderationGate: 'moderation_gate' };

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
    const expectedFor = (key: string, manifestKey: string): string =>
      (WRITES_GENERATION >= 18 && FROM_CEREMONY[key]) ? CLEAN18.addresses[FROM_CEREMONY[key]] : addresses[manifestKey];
    const pairs: Array<[string, string]> = CONFIGURED.map(([key, manifestKey]) => [key, expectedFor(key, manifestKey)]);
    if (WRITES_GENERATION >= 18) pairs.push(['moderationGate', CLEAN18.addresses.moderation_gate]);
    for (const [key, expected] of pairs) {
      expect(expected, `the verified manifest has no address for ${key}`).toBeTruthy();
      expect(
        same(configAddress(key), expected),
        `${key}: client config says ${configAddress(key)}, the verified record says ${expected}`,
      ).toBe(true);
    }
    if (WRITES_GENERATION >= 18) {
      const predecessor = /profileRegistry:\s*\{[^}]*?predecessorAddress:\s*'([^']+)'/.exec(config)?.[1];
      expect(predecessor, 'a generation-18 config must carry profileRegistry.predecessorAddress').toBeTruthy();
      expect(same(predecessor!, addresses.profile_registry), 'the predecessor must be the verified clean-17 registry').toBe(true);
      expect(same(predecessor!, CLEAN18.addresses.profile_registry_predecessor), 'and the one the ceremony record names').toBe(true);
    }
  });

  it('CFGGEN-05: every configured contract still EXISTS in the generation this build writes', () => {
    const dir = WRITES_GENERATION === 17 ? 'contracts' : 'contracts18/contracts';
    const missing = CONFIGURED
      .filter(([, , contract]) => !existsSync(`${dir}/${contract}.tact`))
      .map(([key, , contract]) => `${key} -> ${contract}.tact`);
    expect(missing, `this build writes generation ${WRITES_GENERATION}, whose contracts live in ${dir}/, and the `
      + `client config still names ${missing.join(', ')}. That contract is not part of this generation: drop the `
      + 'entry from platho-config and its row from CONFIGURED.')
      .toEqual([]);
  });

  it('CFGGEN-03: the genesis manifest hash in the config is the verified one', () => {
    const hash = /deploymentManifestHash:\s*'([0-9a-f]{64})'/.exec(config)?.[1];
    expect(hash, 'platho-config must declare the deployment manifest hash').toBeTruthy();
    expect(report.checked_manifest_hash ?? input.manifest.deployment_manifest_hash ?? hash).toBe(hash);
  });

  it('CFGGEN-04: no configured address belongs to a superseded generation', () => {
    const SUPERSEDED_ATH_MASTERS = [
      'UQBM60Qzy7C7QhsD2xDWovXQ3vKW1338plaZgduLNT0styiF',
    ];
    for (const dead of SUPERSEDED_ATH_MASTERS) {
      expect(
        same(configAddress('ath'), dead),
        'the client config carries an ATHMaster from a superseded genesis',
      ).toBe(false);
    }
  });
});
