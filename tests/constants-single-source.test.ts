import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONST-SOURCE — the spec documents must not contradict the contracts.
//
// Owner, 2026-07-17: "надо свести всё к одним цифрам везде... а то ты вечно то одни цифры найдёшь, то другие
// из-за этого выдаёшь мне постоянно разные цифры."
//
// Every wrong number this project shipped came from the same mechanic, not from carelessness in any one place: a
// constant gets corrected in the contract, and the prose that quotes it does not move. The stale copy then reads
// as authoritative — the roadmap kept quoting a WITHDRAWN gas justification ("62% of the limit, ~38% headroom")
// long after measurement disproved it, and a spec kept quoting a RECOVERY endowment that had already changed.
// Both survived people trying hard not to let them survive. Discipline does not fix this; a failing test does.
//
// So: the contract is the single source of truth, and this test fails the build when prose drifts from it.
// It deliberately reads the SOURCE TEXT rather than the compiled ABI — the point is to police the human-readable
// copies that a reader (or the next model) will believe.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const HUB = read('contracts/CapsuleHub.tact');
const VAULT = read('contracts/Vault.tact');
const CREDIT = read('contracts/CreditIssuer.tact');
const PLAN = read('artifacts/PLATHO_CLEAN16_CONTRACT_PLAN.md');
const ROADMAP = read('artifacts/PLATHO_CLEAN16_MASTER_ROADMAP.md');

function constOf(src: string, name: string): number {
  const m = src.match(new RegExp(`^const ${name}: Int = (\\d+);`, 'm'));
  if (!m) throw new Error(`constant ${name} not found in source`);
  return Number(m[1]);
}

// Numbers that are DEAD and must never reappear in a live derivation. Each one shipped a real, wrong constant.
const DEAD_NUMBERS: Array<{ n: string; why: string }> = [
  { n: '240631', why: 'basechain storage rate BEFORE Apr-2026 (500/1 schedule)' },
  { n: '240600', why: 'same dead rate, per-cell-year form' },
  { n: '315360000', why: '10-year RECOVERY retention, superseded by the owner (3 years) on 2026-07-15' },
  { n: '200000000', why: 'RECOVERY endowment computed on the dead rate — over-charged ~13x' },
];

describe('CONST-SOURCE — the docs may not contradict the contracts', () => {
  it('CONST-SOURCE-01: the RECOVERY endowment is identical in CapsuleHub, Vault and the spec', () => {
    const hub = constOf(HUB, 'CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT');
    const vault = constOf(VAULT, 'STORAGE_RESERVE_RECOVERY');
    expect(vault, 'Vault mirrors the Hub RECOVERY endowment').toBe(hub);
    // The spec quotes it too — that copy is what a human reads.
    const inPlan = PLAN.match(/RECOVERY_ENTRY_STORAGE_ENDOWMENT=(\d+)/);
    expect(inPlan, 'the spec must quote the RECOVERY endowment').not.toBeNull();
    expect(Number(inPlan![1]), 'CONTRACT_PLAN quotes the current RECOVERY endowment').toBe(hub);
  });

  it('CONST-SOURCE-02: the prepaid unit is identical in CapsuleHub and CreditIssuer (G-PREPAID, source level)', () => {
    // A drift here is fatal at runtime: CI < Hub -> every FundAnonPool bounces; CI > Hub -> surplus leaks to sweep.
    // creditissuer.test.ts already pins this from the COMPILED getters; this catches it at review time, in the text.
    expect(constOf(CREDIT, 'CREDIT_PREPAID_UNIT')).toBe(constOf(HUB, 'CAPSULEHUB_PREPAID_UNIT'));
  });

  it('CONST-SOURCE-03: RECOVERY retention is 3 years everywhere — the 10-year figure is gone', () => {
    const hub = constOf(HUB, 'CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS');
    expect(hub, 'owner decision 2026-07-15: 3 years').toBe(3 * 31536000);
    expect(PLAN, 'the spec quotes the 3-year retention').toContain(String(hub));
  });

  it('CONST-SOURCE-04: dead numbers appear only as documented history, never in a live derivation', () => {
    // A dead number may be MENTIONED — the comments explaining why 200000000 was wrong are load-bearing, they stop
    // someone "restoring" it. What it may not do is sit in a `const X: Int = <dead>;` line.
    for (const { n, why } of DEAD_NUMBERS) {
      for (const [label, src] of [['CapsuleHub', HUB], ['Vault', VAULT], ['CreditIssuer', CREDIT]] as const) {
        const live = src.match(new RegExp(`^const \\w+: Int = ${n};`, 'm'));
        expect(live, `${label} must not define a constant as ${n} (${why})`).toBeNull();
      }
    }
  });

  it('CONST-SOURCE-05: the withdrawn "62% / 38% headroom" gas claim is not asserted anywhere as fact', () => {
    // The empty-Hub measurement is fine to cite WITH its scope. What must not survive is the bare claim of
    // headroom that does not exist — the roadmap repeated it for a day after it was disproved.
    // The retraction may sit on either side of the number ("ОБОСНОВАНИЕ ОТОЗВАНО: «...запас ~38%»" reads with the
    // marker BEFORE the claim), so check a window around each occurrence rather than a one-sided lookahead.
    for (const [label, doc] of [['roadmap', ROADMAP], ['plan', PLAN]] as const) {
      const needle = 'запас ~38%';
      for (let i = doc.indexOf(needle); i !== -1; i = doc.indexOf(needle, i + 1)) {
        const window = doc.slice(Math.max(0, i - 400), i + 400);
        expect(/ОТОЗВАН|отозван/i.test(window), `${label} asserts the withdrawn ~38% gas headroom without marking it withdrawn`).toBe(true);
      }
    }
  });

  it('CONST-SOURCE-06: the frozen storage rate is stated identically wherever it is derived from', () => {
    // 64962 = 135 * 31536000 / 65536, the config-18 schedule in force since Apr-2026. Verified against mainnet.
    expect(Math.floor((135 * 31536000) / 65536)).toBe(64962);
    expect(HUB, 'the endowment block states the one rate').toContain('64962');
  });
});
