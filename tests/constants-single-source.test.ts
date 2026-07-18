import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONST-SOURCE — the docs may not contradict the contracts.
//
// Every wrong number this project shipped came from the same mechanic, not from carelessness in any one place: a
// constant gets corrected in the contract, and the prose that quotes it does not move. The stale copy then reads
// as authoritative — a roadmap kept quoting a WITHDRAWN gas justification long after measurement disproved it,
// and a spec kept quoting a RECOVERY endowment that had already changed. Both survived people trying hard not to
// let them survive. Discipline does not fix this; a failing test does.
//
// So: the contract is the single source of truth, and this test fails the build when prose drifts from it.
// It deliberately reads the SOURCE TEXT rather than the compiled ABI — the point is to police the human-readable
// copies that a reader (or the next model) will believe.
//
// RETARGETED onto clean-17 (2026-07-18). The previous revision policed CapsuleHub / Vault / CreditIssuer against
// the clean-16 plan + roadmap. Those contracts are superseded by the three direct-pay shards and those documents
// were deleted, so the test could not even load its inputs — the drift guard was itself dead. The invariant it
// encodes is unchanged; only its subjects moved.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const RECORD = read('contracts/RecordShard.tact');
const INTRO = read('contracts/IntroShard.tact');
const RECOVERY = read('contracts/RecoveryShard.tact');
const MSS = read('contracts/MarketStabilitySeller.tact');
const SPEC = read('artifacts/PLATHO_CLEAN17_SHARDED_SPEC.md');
const ROADMAP = read('artifacts/PLATHO_CLEAN17_MASTER_ROADMAP.md');

function constOf(src: string, name: string): number {
  const m = src.match(new RegExp(`^const ${name}: Int = (\\d+);`, 'm'));
  if (!m) throw new Error(`constant ${name} not found in source`);
  return Number(m[1]);
}

// Prose groups digits for readability ("23 200 000", and with a non-breaking space too). Join them back up before
// looking for the contract's value, otherwise the guard silently matches nothing and passes on a stale document.
// Zero-width on both sides, so one global pass closes every gap in "23 200 000" rather than every other one.
const digits = (doc: string) => doc.replace(/(?<=\d)[\s  ](?=\d)/g, '');

function quotes(doc: string, n: number): boolean {
  return digits(doc).includes(String(n));
}

// Numbers that are DEAD and must never reappear in a live derivation. Each one shipped a real, wrong constant.
const DEAD_NUMBERS: Array<{ n: string; why: string }> = [
  { n: '240631', why: 'basechain storage rate BEFORE Apr-2026 (500/1 schedule)' },
  { n: '240600', why: 'same dead rate, per-cell-year form' },
  { n: '315360000', why: '10-year RECOVERY retention, superseded by the owner (3 years) on 2026-07-15' },
  { n: '200000000', why: 'RECOVERY endowment computed on the dead rate — over-charged ~13x' },
];

const SOURCES = [
  ['RecordShard', RECORD],
  ['IntroShard', INTRO],
  ['RecoveryShard', RECOVERY],
] as const;

describe('CONST-SOURCE — the docs may not contradict the contracts', () => {
  it('CONST-SOURCE-01: every shard endowment quoted by the spec matches the contract that charges it', () => {
    const cases = [
      ['CONV record', constOf(RECORD, 'RS_RECORD_ENDOWMENT')],
      ['INTRO', constOf(INTRO, 'IS_INTRO_ENDOWMENT')],
      ['RECOVERY', constOf(RECOVERY, 'RS_RECOVERY_ENDOWMENT')],
    ] as const;
    for (const [label, value] of cases) {
      expect(quotes(SPEC, value), `the spec must quote the current ${label} endowment (${value})`).toBe(true);
    }
  });

  it('CONST-SOURCE-02: the protocol fee is one number — the contract charges what the spec promises', () => {
    // The owner states the economics as "0.01 GRAM per message -> 15 000 GRAM of liquidity at 1.5M messages".
    // If the contract constant and that prose ever part, the published economics stop being the shipped ones.
    const fee = constOf(RECORD, 'RS_PROTOCOL_FEE');
    expect(fee, '0.01 GRAM expressed in nanotons').toBe(10_000_000);
    // ONE fee for the whole protocol. INTRO charged nothing until 2026-07-18, which made a first contact a quarter
    // the price of a reply and left the open lane's only anti-spam lever unused.
    expect(constOf(INTRO, 'IS_PROTOCOL_FEE'), 'INTRO charges the same per-message fee as CONV').toBe(fee);
    expect(quotes(SPEC, 15_000), 'the spec quotes the pool total implied by the fee').toBe(true);
    expect((fee * 1_500_000) / 1_000_000_000, '1.5M messages at the contract fee').toBe(15_000);
  });

  it('CONST-SOURCE-03: RECOVERY retention is 3 years, and the spec says so', () => {
    const retention = constOf(RECOVERY, 'RS_RECOVERY_RETENTION');
    expect(retention, 'owner decision 2026-07-15: 3 years').toBe(3 * 31536000);
    expect(SPEC, 'the spec states the 3-year RECOVERY window').toMatch(/3 год|3 лет|3-х лет/);
  });

  it('CONST-SOURCE-04: dead numbers appear only as documented history, never in a live derivation', () => {
    // A dead number may be MENTIONED — the comments explaining why 200000000 was wrong are load-bearing, they stop
    // someone "restoring" it. What it may not do is sit in a `const X: Int = <dead>;` line.
    for (const { n, why } of DEAD_NUMBERS) {
      for (const [label, src] of SOURCES) {
        const live = src.match(new RegExp(`^const \\w+: Int = ${n};`, 'm'));
        expect(live, `${label} must not define a constant as ${n} (${why})`).toBeNull();
      }
    }
  });

  it('CONST-SOURCE-05: the MSS tranche price is a constant, and the spec quotes THAT constant', () => {
    // The price used to be a runtime input frozen by a one-time ceremony. It is now compiled in, which is only
    // an improvement as long as the published figure and the compiled one stay the same number.
    const price = constOf(MSS, 'MARKET_STABILITY_BASE_TRANCHE_PRICE');
    expect(price, '3000 GRAM per x1 tranche, from the 15M ATH / 15k GRAM pool').toBe(3_000_000_000_000);
    expect(quotes(SPEC, 3000), 'the spec quotes the tranche price in GRAM').toBe(true);
    expect(MSS, 'the ceremony message must be gone, not merely unused').not.toContain('FreezeMarketStabilityPricing');
  });

  it('CONST-SOURCE-06: the frozen storage rate is stated identically wherever it is derived from', () => {
    // 64962 = 135 * 31536000 / 65536, the config-18 schedule in force since Apr-2026. Verified against mainnet.
    expect(Math.floor((135 * 31536000) / 65536)).toBe(64962);
    expect(quotes(SPEC, 64962), 'the spec states the one rate it derives endowments from').toBe(true);
  });

  it('CONST-SOURCE-07: the deleted blind-issuance layer is not referenced as live anywhere', () => {
    // This layer was removed because it required an online issuer and an online relay, both forbidden. Its names
    // outliving it is exactly how a reader reconstructs an architecture that no longer exists.
    for (const name of ['NullifierShard', 'CreditSale', 'CAC-подключ', 'слепая выдача'] as const) {
      for (const [label, doc] of [['spec', SPEC], ['roadmap', ROADMAP]] as const) {
        const idx = digits(doc).indexOf(name);
        if (idx === -1) continue;
        const window = digits(doc).slice(Math.max(0, idx - 300), idx + 300);
        expect(
          /удал|снят|больше нет|исчез|не существует/i.test(window),
          `${label} mentions ${name} without marking it removed`,
        ).toBe(true);
      }
    }
  });
});
