import { describe, expect, it } from 'vitest';
import { Cell } from '@ton/core';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildImplementedSubsetManifest, computeManifestCell } from '../scripts/deployment_manifest_m15';

const productionContracts = [
  'ATHMaster.tact',
  'ATHWallet.tact',
  'BuybackBurn.tact',
  'CapsuleHub.tact',
  'FeeAccumulator.tact',
  'MarketStabilitySeller.tact',
  'ProfileRegistry.tact',
  'UsernameNFTItem.tact',
  'UsernameRegistry.tact',
  'Vault.tact',
];

const storageTopUpReceivers: Array<[string, string]> = [
  ['BuybackBurn.tact', 'TopUpStorageReserve'],
  ['CapsuleHub.tact', 'TopUpStorageReserve'],
  ['FeeAccumulator.tact', 'TopUpStorageReserve'],
  ['MarketStabilitySeller.tact', 'MarketStabilityTopUpStorageReserve'],
  ['ProfileRegistry.tact', 'ProfileRegistryTopUpStorageReserve'],
  ['UsernameNFTItem.tact', 'TopUpStorageReserve'],
  ['UsernameRegistry.tact', 'UsernameRegistryTopUpStorageReserve'],
  ['Vault.tact', 'TopUpStorageReserve'],
];

function file(path: string): string {
  return readFileSync(path, 'utf8');
}

function stripLineComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function contractSource(name: string): string {
  return stripLineComments(file(join('contracts', name)));
}

function builtCodeHash(contractDir: string, artifactName: string): string {
  const boc = readFileSync(join('build', contractDir, `${artifactName}.code.boc`));
  return Cell.fromBoc(boc)[0].hash().toString('hex');
}

function artifactHash(name: string): string {
  return file(join('artifacts', name)).trim();
}

describe('M16 production conformance static checks', () => {
  it('M16-CONF-01: production contracts contain no ignored-error send mode, session-spender contract, or rescue/governance/admin-control message surface', () => {
    const forbidden = [
      /SendIgnoreErrors/,
      /ignored[-_ ]error/i,
      /MessageSession/,
      /SessionSpender/,
      /session[-_ ]spender/i,
      /message\s*\([^)]*\)\s*(Admin|OwnerOverride|Pause|Upgrade|Governance|Rescue|Fallback)/,
      /const\s+OP_(ADMIN|OWNER_OVERRIDE|PAUSE|UPGRADE|GOVERNANCE|RESCUE|FALLBACK)\b/,
    ];

    for (const contract of productionContracts) {
      const source = contractSource(contract);
      for (const pattern of forbidden) {
        expect(source, `${contract} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('M16-CONF-02: all production contracts reject empty fallback explicitly', () => {
    for (const contract of productionContracts) {
      const source = contractSource(contract);
      expect(source, `${contract} must define an empty receive fallback`).toMatch(/receive\s*\(\s*\)\s*\{/);
      expect(source, `${contract} empty fallback must throw`).toMatch(/receive\s*\(\s*\)\s*\{[\s\S]*?throw\s*\(/);
    }
  });

  it('M16-CONF-02A: storage top-up ABI is explicit on v1 contracts that pin a top-up opcode', () => {
    for (const [contract, messageName] of storageTopUpReceivers) {
      const source = contractSource(contract);
      expect(source, `${contract} must expose ${messageName}`).toMatch(new RegExp(`receive\\s*\\(\\s*msg:\\s*${messageName}\\s*\\)`));
    }
  });

  it('M16-CONF-03: built code hashes match the pinned artifacts exactly', () => {
    const checks: Array<[string, string, string]> = [
      ['ATHMaster', 'ATHMaster_ATHMaster', 'ATHMASTER_CODE_HASH.txt'],
      ['ATHWallet', 'ATHWallet_ATHWallet', 'ATH_WALLET_CODE_HASH.txt'],
      ['BuybackBurn', 'BuybackBurn_BuybackBurn', 'BUYBACKBURN_CODE_HASH.txt'],
      ['MarketStabilitySeller', 'MarketStabilitySeller_MarketStabilitySeller', 'MARKET_STABILITY_SELLER_CODE_HASH.txt'],
      ['CapsuleHub', 'CapsuleHub_CapsuleHub', 'CAPSULEHUB_CODE_HASH.txt'],
      ['FeeAccumulator', 'FeeAccumulator_FeeAccumulator', 'FEEACCUMULATOR_CODE_HASH.txt'],
      ['ProfileRegistry', 'ProfileRegistry_ProfileRegistry', 'PROFILE_REGISTRY_CODE_HASH.txt'],
      ['UsernameNFTItem', 'UsernameNFTItem_UsernameNFTItem', 'USERNAME_NFT_ITEM_CODE_HASH.txt'],
      ['UsernameRegistry', 'UsernameRegistry_UsernameRegistry', 'USERNAME_REGISTRY_CODE_HASH.txt'],
      ['Vault', 'Vault_Vault', 'VAULT_CODE_HASH.txt'],
    ];

    for (const [dir, artifactName, hashArtifact] of checks) {
      expect(builtCodeHash(dir, artifactName), hashArtifact).toBe(artifactHash(hashArtifact));
    }
    expect(artifactHash('FEE_ACCUMULATOR_CODE_HASH.txt')).toBe(artifactHash('FEEACCUMULATOR_CODE_HASH.txt'));
  });

  it('M16-CONF-04: implemented-subset manifest remains canonical and explicitly non-final while blockers remain', async () => {
    const { manifest } = await buildImplementedSubsetManifest();
    const recomputed = computeManifestCell({
      addresses: manifest.addresses,
      code_hashes: manifest.code_hashes,
      state_init_hashes: manifest.state_init_hashes,
      constants: manifest.constants,
      blockers_before_final_genesis: manifest.blockers_before_final_genesis,
    }).hash().toString('hex');

    expect(manifest.status).toBe('IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS');
    expect(manifest.manifest_hash_hex).toBe(recomputed);
    expect(manifest.blockers_before_final_genesis.length).toBeGreaterThan(0);
    expect(manifest.blockers_before_final_genesis.join('\n')).toMatch(/STONFI/);
    expect(manifest.constants.vault_pending_publish_stale_ttl_seconds).toBe('86400');
    expect(manifest.constants.vault_activity_airdrop_total_atomic).toBe('30000000000000000');
    expect(manifest.constants.vault_activity_airdrop_reward_per_message_atomic).toBe('10000000000');
    expect(manifest.constants.vault_activity_airdrop_per_wallet_cap_atomic).toBe('0');
    expect(manifest.constants.profile_avatar_price_ath_atomic).toBe('100000000000');
    expect(manifest.constants.profile_avatar_max_parts).toBe('16');
    expect(manifest.constants.username_pending_mint_stale_ttl_seconds).toBe('86400');
    expect(manifest.constants.username_item_ack_forward_reserve_nanotons).toBe('3000000');
  });

  it('M16-CONF-05: source tree contains no extra production routes/adapters/migration hooks beyond the implemented subset', () => {
    const contractFiles = readdirSync('contracts').filter((name) => name.endsWith('.tact')).sort();
    expect(contractFiles).toEqual([
      'ATHMaster.tact',
      'ATHWallet.tact',
      'BuybackBurn.tact',
      'CapsuleHub.tact',
      'FeeAccumulator.tact',
      'M20TBuybackBurnHarness.tact',
      'M20TFeeAccumulatorHarness.tact',
      'MarketStabilitySeller.tact',
      'MockAthWalletNoAck.tact',
      'MockUsernameNFTItemNoAck.tact',
      'MockUsernameRegistryAckSink.tact',
      'MockVaultAckSink.tact',
      'MockVaultAthWallet.tact',
      'ProfileRegistry.tact',
      'UsernameNFTItem.tact',
      'UsernameRegistry.tact',
      'Vault.tact',
    ]);
    expect(file(join('contracts', 'M20TBuybackBurnHarness.tact'))).toMatch(/Testnet-only M20T/);
    expect(file(join('contracts', 'M20TFeeAccumulatorHarness.tact'))).toMatch(/Testnet-only M20T/);
  });
});
