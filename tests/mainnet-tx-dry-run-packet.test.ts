import { existsSync, readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { readBakedFeeSinks } from '../scripts/mainnet_tx_dry_run_packet';
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

  // Wave-7 audit, 2026-07-28. The FeeAccumulator address is baked as a COMPILE-TIME constant into four immutable,
  // lazily-deployed contracts (RecordShard/IntroShard/PublicShard/AirdropTicket) with no bind to correct it. It was
  // rebaked from a TEST FIXTURE's BuybackBurn literal instead of the derived address, so all four pointed at a sink
  // this ceremony would never deploy: every capsule fee to an uninitialised address, every deposit acknowledgement
  // refused by 13657/13685, zero credits minted, the 15M ATH airdrop dead — on contracts that cannot be changed.
  //
  // The existing PT-04b guard was blind BY CALIBRATION: it derived its "expected" sink from the same fixture literal.
  // The only place the truth exists is the generator that reads the real roles, so that is where the check now lives —
  // and it refuses to emit a packet at all on a mismatch (verified: it did refuse, naming all four contracts).
  it('H-DEP-DRYRUN-05: the ceremony refuses to emit a packet whose FeeAccumulator the immutable contracts do not name', () => {
    const script = readFileSync('scripts/mainnet_tx_dry_run_packet.ts', 'utf8');

    expect(script, 'the baked-sink check must run inside packet derivation').toMatch(/assertBakedFeeSinksMatch\(feeAccumulatorAddress\)/);
    // All four immutable carriers, read from the .tact SOURCE — a constant renamed out of this list would otherwise
    // silently drop out of the check, which is the same class of blindness that let the original defect live.
    for (const contract of ['RecordShard', 'IntroShard', 'PublicShard', 'AirdropTicket']) {
      expect(script, `${contract}'s baked FEE SINK must be covered`).toMatch(
        new RegExp(`'${contract}',\\s*'contracts/${contract}\\.tact'`),
      );
    }
    expect(script, 'a missing constant must be a hard failure, never a skip').toMatch(/no baked FEE SINK constant found in/);
    expect(script, 'and the mismatch must throw, not warn').toMatch(/BAKED FEE SINK MISMATCH/);
  });

  it('H-DEP-DRYRUN-06: every sink the packet names is the one the immutable contracts have baked in', () => {
    if (!existsSync('artifacts/local/mainnet_tx_dry_run_packet.json')) return;
    const packet = readJson('artifacts/local/mainnet_tx_dry_run_packet.json');

    // Read the constants out of the .tact sources — the same four the generator checks — and compare RAW, because
    // the packet writes non-bounceable UQ while the contracts carry bounceable EQ. Comparing the friendly strings
    // would fail on the flag byte alone and tempt someone to weaken the check.
    const baked = readBakedFeeSinks();
    expect(baked.length, 'all four immutable carriers are covered').toBe(4);
    const bakedRaw = new Set(baked.map(({ address }) => address.toRawString()));
    expect(bakedRaw.size, 'the four contracts agree on one sink').toBe(1);
    const expectedRaw = [...bakedRaw][0];

    // Two independent places the packet names the sink, and BOTH must be it:
    //  - AirdropBindCreditIssuer: AirdropPool accepts accruals ONLY from credit_issuer_address (gate 26110). Bind it
    //    to anything else and the shards' fees mint credits for nobody.
    //  - BindBuybackFeeAccumulator: the buyback side's view of the same sink.
    const named = (packet.control_messages ?? []).flatMap((m: any) => {
      const p = m?.body?.params ?? {};
      return [p.credit_issuer_address, p.fee_accumulator_address].filter(Boolean);
    });
    expect(named.length, 'the packet names the sink at least once').toBeGreaterThan(0);
    for (const value of named) {
      expect(Address.parse(value).toRawString(), `packet names ${value}, contracts baked ${expectedRaw}`).toBe(expectedRaw);
    }
  });

  // Ceremony STEP ORDER is a seal gate in its own right ("bind treasury before funding; fund -> off-chain verify ->
  // seal, never seal-then-fund"). Audited 2026-07-28. Two things were wrong, and neither was in the contracts:
  //
  //  1. The packet prints funding in its own array AFTER control_messages, which ends with the five seals, and calls
  //     its phase `final_genesis_funding`. Both cues point at "sign these last". The real constraint is a sandwich —
  //     B06 -> funding -> verify -> S01 — with BOTH edges enforced on chain (26011/26019 below, 26044 above).
  //  2. The runbook, the document a human actually follows, still told the operator to deploy and seal `Vault` and
  //     `CapsuleHub`: contracts deleted in clean-17. It also funded `vault_official_ath_wallet`. Seventeen mentions.
  //     The ceremony SCRIPTS were clean-17 already — only the prose had drifted, which is the failure mode where
  //     nothing goes red.
  it('H-DEP-DRYRUN-07: the packet states its own execution order, and funding sits between the binds and the seals', () => {
    if (!existsSync('artifacts/local/mainnet_tx_dry_run_packet.json')) return;
    const packet = readJson('artifacts/local/mainnet_tx_dry_run_packet.json');

    const order: string[] = (packet.execution_order ?? []).map((s: any) => s.phase);
    expect(order, 'the packet must carry an explicit execution order').not.toEqual([]);
    const at = (phase: string) => order.indexOf(phase);
    expect(at('pre_seal_binding'), 'binds come before funding').toBeLessThan(at('final_genesis_funding'));
    expect(at('final_genesis_funding'), 'funding comes before the off-chain verification').toBeLessThan(at('off_chain_verification'));
    expect(at('off_chain_verification'), 'and verification comes before the seals — never seal-then-fund').toBeLessThan(at('seal'));

    // Every phase that real steps use must appear in the stated order, or the order silently omits work.
    const usedPhases = new Set<string>([
      ...(packet.control_messages ?? []).map((m: any) => m.phase),
      ...(packet.funding_messages ?? []).map((m: any) => m.phase),
    ].filter(Boolean));
    for (const phase of usedPhases) expect(order, `phase ${phase} is used but not placed in execution_order`).toContain(phase);

    // The funding steps must name their own prerequisites, since the file layout argues the opposite.
    for (const f of packet.funding_messages ?? []) {
      expect(f.must_be_signed_after, `${f.id} must name the bind it depends on`).toBe('B06');
      expect(f.must_be_signed_before, `${f.id} must name the seal it must precede`).toBe('S01');
    }
  });

  it('H-DEP-DRYRUN-08: the runbook seals exactly the contracts the packet seals, and none that no longer exist', () => {
    if (!existsSync('artifacts/local/mainnet_tx_dry_run_packet.json')) return;
    const packet = readJson('artifacts/local/mainnet_tx_dry_run_packet.json');
    const runbook = readFileSync('DEPLOYMENT_RUNBOOK.md', 'utf8');

    const packetSeals = (packet.control_messages ?? [])
      .filter((m: any) => m.phase === 'seal')
      .map((m: any) => String(m.body?.label ?? ''));
    expect(packetSeals.length, 'the packet seals five staged contracts').toBe(5);

    // Step 10 of Phase 2 is the operator's seal list. Take it verbatim rather than searching the whole document,
    // so historical prose ("replaces Vault, which no longer exists") cannot satisfy or break this check.
    const start = runbook.indexOf('10. Seal staged contracts only after the funding checks above pass');
    expect(start, 'the runbook must still carry the seal step').toBeGreaterThan(0);
    const block = runbook.slice(start, runbook.indexOf('\n\n', start));

    for (const label of packetSeals) {
      expect(block, `the runbook must list ${label} in its seal step`).toContain(label);
    }
    // And nothing extra: a contract named here but absent from the packet is either deleted or unbuilt, and the
    // operator would go looking for a transaction that does not exist.
    // `Seal` is not always the start of the message name: AirdropPool's is `AirdropSealGenesis`.
    const runbookSeals = [...block.matchAll(/`([A-Za-z]+\.[A-Za-z]*Seal[A-Za-z]*)`/g)].map((m) => m[1]);
    expect(new Set(runbookSeals), 'runbook and packet seal sets must be identical').toEqual(new Set(packetSeals));

    // The contracts named must actually exist in this generation.
    for (const label of runbookSeals) {
      const contract = label.split('.')[0];
      expect(existsSync(`contracts/${contract}.tact`), `${contract} is sealed by the runbook but has no contract source`).toBe(true);
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
