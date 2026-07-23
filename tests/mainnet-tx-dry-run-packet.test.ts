import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const OFFICIAL_ATH_WALLET_KEYS = [
  'ath_treasury_owner_ath_wallet',
  'ath_long_term_vesting_official_ath_wallet',
  'airdrop_pool_official_ath_wallet',
  'buyback_burn_official_ath_wallet',
  'market_stability_seller_official_ath_wallet',
  'username_registry_official_ath_wallet',
  'profile_registry_official_ath_wallet',
];

const TEST_DEPLOY_TARGET_RE = /(?:Mock|Harness|M20T)/i;

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('mainnet transaction dry-run packet', () => {
  it('H-DEP-DRYRUN-00: generated local packet is a production-only pre-execution template', () => {
    if (!existsSync('artifacts/local/mainnet_tx_dry_run_packet.json')) return;

    const packet = readJson('artifacts/local/mainnet_tx_dry_run_packet.json');
    const deployedTargets = (packet.deploy_contracts ?? []).map((step: any) => [
      step.id,
      step.action,
      step.contract,
      step.message,
    ].filter(Boolean).join(' '));

    expect(packet.production_deploy_executed).toBe(false);
    expect(packet.lifecycle_stage).toBe('pre_execution_tx_dry_run_template');
    expect(packet.lifecycle_note).toMatch(/pre-execution template/);
    expect(packet.lifecycle_note).toMatch(/mainnet_genesis_verify_report\.json/);
    expect(deployedTargets).not.toEqual(expect.arrayContaining([expect.stringMatching(TEST_DEPLOY_TARGET_RE)]));
  });

  // W1-001 / W1-002 (audit 2026-07-24). Two pre-seal binds were absent from the executable packet for the whole of
  // clean-17 and NOTHING noticed: BuybackBurn.BindBuybackTreasury (seal S04 then throws 22509 and the contract can
  // never be sealed) and the four FeeAccumulator lane/ticket code binds (every capsule fee then bounces at 15055 and
  // the 15M ATH airdrop is unreachable). The manifest-level validator only checks the DRAFT's binding list; nothing
  // checked that the packet actually BUILDS a message for each. This guard closes that gap at the source level.
  it('H-DEP-DRYRUN-04: packet builds a message for every pre-seal bind genesis requires', () => {
    const script = readFileSync('scripts/mainnet_tx_dry_run_packet.ts', 'utf8');
    const required = [
      'storeBindBuybackFeeAccumulator',
      'storeBindBuybackOfficialAthWallet',
      'storeBindBuybackTreasury',
      'storeBindMarketStabilityReserveFunder',
      'storeBindMarketStabilityOfficialAthWallet',
      'storeBindMarketStabilityTreasury',
      'storeAirdropBindAthMaster',
      'storeAirdropBindCreditIssuer',
      'storeAirdropBindTreasury',
      'storeBindAirdropPool',
      'storeBindShardCode',
      'storeBindIntroShardCode',
      'storeBindPublicShardCode',
      'storeBindTicketCode',
      'storeUsernameBindOfficialAthWallet',
      'storeBindProfileOfficialAthWallet',
    ];
    const missing = required.filter((fn) => !script.includes(`${fn}(`));
    expect(missing, 'every pre-seal bind must be BUILT by the packet, not merely listed in the manifest').toEqual([]);

    // The four FeeAccumulator code binds are guarded by requireTreasury (gate 15050) exactly like BindAirdropPool:
    // a genesis-controller signature bounces and the lane stays unbound. Pin the signer next to each of them.
    for (const fn of ['storeBindShardCode', 'storeBindIntroShardCode', 'storeBindPublicShardCode', 'storeBindTicketCode']) {
      const at = script.indexOf(`${fn}(`);
      const block = script.slice(Math.max(0, at - 700), at);
      expect(block, `${fn} must be signed by ton_treasury_receiver (gate 15050), not the genesis controller`)
        .toMatch(/signer_role: 'ton_treasury_receiver'/);
    }
  });

  it('H-DEP-DRYRUN-01: script derives every official ATHWallet StateInit used by final genesis', () => {
    const script = readFileSync('scripts/mainnet_tx_dry_run_packet.ts', 'utf8');

    for (const key of OFFICIAL_ATH_WALLET_KEYS) {
      expect(script).toContain(key);
      expect(script).toContain(`draft.manifest.state_init_hashes.${key}`);
    }
    expect(script).toContain('owner_address');
    expect(script).toContain('ath_master_address');
  });

  it('H-DEP-DRYRUN-02: generated local packet exposes StateInit for every official ATHWallet', () => {
    if (!existsSync('artifacts/local/mainnet_tx_dry_run_packet.json') || !existsSync('artifacts/local/mainnet_final_manifest_draft.json')) {
      return;
    }

    const packet = readJson('artifacts/local/mainnet_tx_dry_run_packet.json');
    const draft = readJson('artifacts/local/mainnet_final_manifest_draft.json');
    const walletStateInits = packet.official_wallet_state_inits ?? {};

    expect(Object.keys(walletStateInits).sort()).toEqual([...OFFICIAL_ATH_WALLET_KEYS].sort());

    for (const key of OFFICIAL_ATH_WALLET_KEYS) {
      expect(walletStateInits[key]?.address).toBe(draft.manifest.addresses[key]);
      expect(walletStateInits[key]?.ath_master_address).toBe(draft.manifest.addresses.ath_master);
      expect(walletStateInits[key]?.owner_address).toMatch(/^UQ/);
      expect(walletStateInits[key]?.state_init?.cell_hash_hex).toBe(draft.manifest.state_init_hashes[key]);
    }
  });

  it('H-DEP-DRYRUN-03: Tonkeeper console live preflight allows safe deploy resume only for expected targets', () => {
    const script = readFileSync('scripts/mainnet_tonkeeper_console.mjs', 'utf8');

    expect(script).toContain('const ok = clean || inactiveFunded || expectedActive;');
    expect(script).toContain('active with expected deploy code/state; resume allowed');
    expect(script).toContain('active target has unexpected deploy code/state');
    expect(script).toContain('All deploy targets are fresh.');
    expect(script).toContain('LIVE_PREFLIGHT_RESUME');
    expect(script).toContain('LIVE_PREFLIGHT_DEPLOYED');
  });
});
