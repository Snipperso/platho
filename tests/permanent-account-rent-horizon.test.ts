import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Cell } from '@ton/core';

// TIER-1 GUARD. Three accounts in this system are PERMANENT in the strongest sense: they can never be redeployed
// because doing so would change the token itself or orphan the value inside them. Their deploy value is therefore not
// an operational choice but a commitment, and the commitment horizon is fixed by ATHVesting: 100 periods of one year.
//
// This is a class that has now bitten twice in one week, both times found by measurement rather than by reading:
//   * ATHVesting was funded for ~67 years of a 100-year schedule, with 10,000,000 ATH inside.
//   * ATHMaster was funded for ~77 years. Past that the jetton master goes into storage debt: burns stop being
//     recorded and get_jetton_data stops answering, so every explorer, wallet and DEX loses the token's identity.
//
// Both were single numbers in a script, and nothing tied them to the code whose rent they pay. Code grows — this
// session alone added a dead-man to one contract and a publisher tag to another — so a number fixed by hand goes
// stale silently and the failure arrives decades after the seal. This derives the requirement from the compiled BOC
// instead, so growing a contract past its funding reddens here.

const STORAGE_RATE_PER_CELL_YEAR = 64_962;      // frozen project rate; bits are free
const HORIZON_YEARS = 100;                       // ATH_VESTING_PERIOD_COUNT x ATH_VESTING_PERIOD_SECONDS
const PACKET = 'artifacts/local/mainnet_tx_dry_run_packet.json';

/** Distinct cells in a compiled code tree — what the storage rate actually charges for. */
function codeCells(project: string): number {
  const boc = readFileSync(`build/${project}/${project}_${project}.code.boc`);
  const root = Cell.fromBoc(boc)[0];
  const seen = new Set<string>();
  const walk = (c: Cell) => {
    const h = c.hash().toString('hex');
    if (seen.has(h)) return;                     // storage deduplicates identical cells, so the counter must too
    seen.add(h);
    for (const r of c.refs) walk(r);
  };
  walk(root);
  return seen.size;
}

/** Code cells + the account itself + a small allowance for the data cell(s). */
function rentPerYear(project: string): number {
  return (codeCells(project) + 3) * STORAGE_RATE_PER_CELL_YEAR;
}

describe('permanent account rent horizon', () => {
  it('RENT-HORIZON-01: the never-redeployable contracts are funded past the 100-year commitment', () => {
    if (!existsSync(PACKET)) {
      // eslint-disable-next-line no-console
      console.warn(`[RENT-HORIZON-01] ${PACKET} absent — run scripts/mainnet_tx_dry_run_packet.ts to check this`);
      return;
    }
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const deploys: Array<{ contract: string; value_nanotons_recommended: string }> =
      packet.deploy_contracts ?? packet.phase_1_deploy_contracts ?? [];
    expect(deploys.length, 'the packet must list its deploy steps').toBeGreaterThan(5);

    // [WIDENED 2026-07-30] Every contract that can NEVER be redeployed, not the three that had already been measured.
    // Listing only the measured ones is precisely how ATHMaster was missed until it was measured by hand, and then
    // MarketStabilitySeller (48 years, holding 60% of supply) and BuybackBurn (35 years) after that.
    //   ATHMaster    — the jetton master; a redeploy is a different token.
    //   ATHWallet    — its code IS the wallet; covered by RENT-HORIZON-02 through the treasury endowment.
    //   ATHVesting   — 10,000,000 ATH on the 100-year schedule that DEFINES this horizon.
    //   MSS          — 60,000,000 ATH, no clock, and no administrative command after the seal.
    //   AirdropPool  — 15,000,000 ATH, permanent by ADR9.
    //   BuybackBurn  — the buyback envelope behind a frozen route.
    //   FeeAccumulator — its address is baked into four immutable contracts, so moving it orphans every shard.
    for (const project of ['ATHMaster', 'ATHVesting', 'MarketStabilitySeller', 'AirdropPool', 'BuybackBurn',
      'FeeAccumulator']) {
      const step = deploys.find((d) => d.contract === project);
      expect(step, `${project} must be deployed by the ceremony packet`).toBeTruthy();
      const funded = BigInt(step!.value_nanotons_recommended);
      const required = BigInt(rentPerYear(project) * HORIZON_YEARS);
      expect(funded, `${project}: ${codeCells(project)} code cells => ${rentPerYear(project)}/year, so `
        + `${required} for ${HORIZON_YEARS} years, but the packet funds ${funded}. Raise the override in `
        + 'scripts/mainnet_tx_dry_run_packet.ts — this contract can NEVER be redeployed.').toBeGreaterThanOrEqual(required);
    }
  });

  it('RENT-HORIZON-03: the four official ATH wallets are endowed by the ceremony, not left on their transfer float', () => {
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const steps: Array<{ id: string; target_address: string; value_nanotons_recommended: string }> =
      packet.wallet_endowment_messages ?? [];

    // MEASURED (MSTAB-09): the genesis funding transfer leaves the wallet holding 60% of supply with 24,832,861 —
    // four and a half years. Overpaying the transfer cannot help, because everything above
    // ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT is refunded to the sender. So the endowment has to be its own ceremony
    // step, and a step nobody checks is a step that gets dropped.
    expect(steps.length, 'W01..W04 must endow the four protocol-owned official ATH wallets').toBe(4);

    const required = BigInt(rentPerYear('ATHWallet') * HORIZON_YEARS);
    for (const step of steps) {
      expect(BigInt(step.value_nanotons_recommended),
        `${step.id} (${step.target_address}) must carry ${HORIZON_YEARS} years of ATHWallet rent`)
        .toBeGreaterThanOrEqual(required);
    }
  });

  it('RENT-HORIZON-02: the treasury ATH wallet — which holds 100% of supply — outlives the horizon too', () => {
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    // DeployTreasurySupply both mints the supply and creates the wallet that holds it; everything above the master's
    // own exec reserve is forwarded to that wallet as its permanent endowment.
    const step = (packet.control_messages ?? []).find((s: any) => {
      const text = `${s?.action ?? ''} ${s?.id ?? ''} ${s?.body?.message ?? ''} ${s?.note ?? ''}`;
      return /DeployTreasurySupply/i.test(text) || /treasury_supply/i.test(JSON.stringify(s ?? {}));
    });
    expect(step, 'the packet must carry the DeployTreasurySupply step').toBeTruthy();

    const sent = BigInt(step.value_nanotons_recommended ?? step.value_nanotons_min);
    const masterReserve = 8_000_000n;                        // ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE
    const endowment = sent - masterReserve;
    const required = BigInt(rentPerYear('ATHWallet') * HORIZON_YEARS);
    expect(endowment, `the treasury wallet is left ${endowment} against ${required} of rent for ${HORIZON_YEARS} `
      + 'years — raise DEPLOY_TREASURY_SUPPLY_VALUE_RECOMMENDED_NANOTONS').toBeGreaterThanOrEqual(required);
  });
});
