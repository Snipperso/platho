import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// CLASS SWEEP 4 — the last unexamined surface: does a `context().value >=` gate actually cover what its handler spends?
//
// This class is PROVEN, four times in this session, and every instance had the same shape: a term the handler really
// pays was missing from the sum the gate demands.
//   * gate 14124 (ATHMaster genesis) — understated by ~2,600,000; the mint failed in ACTION with COMPUTE reporting 0.
//   * gate 14714 (JettonInternalTransfer) — ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT simply absent from the sum.
//   * gate 18015 (UsernameNFTItem init) — 56,602 short of the measured cost.
//   * ATHVesting's downstream budget — pinned to a literal instead of scaling with what arrived.
//
// Measuring 63 gates end to end is not affordable. Matching their SHAPE is: for each receiver, collect the constants
// the gate sums and the constants its outgoing legs spend, and flag any leg whose funding constant the gate never
// mentions. That is exactly what 14714 looked like, statically.
//
// Legs deliberately paid from the contract's own balance are legitimate and listed below with the reason — the list
// is the review, and a NEW unlisted mismatch fails until somebody writes down which side is wrong.

type Finding = { contract: string; receiver: string; spent: string };

// Reviewed 2026-07-30. Each entry is a leg funded from the contract's OWN balance on purpose, not from the caller's
// message — so its constant is correctly absent from the gate.
const REVIEWED_BALANCE_FUNDED = new Set([
  // Flush legs move money the contract already holds; that is the whole operation. The caller funds only execution,
  // and the change above that reserve is returned (see the tier-3 audit).
  'FeeAccumulator.FlushTreasuryDue:msg.amount',
  'FeeAccumulator.FlushBuybackDue:msg.amount',
  'FeeAccumulator.FlushBuybackDue:BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE',
  'MarketStabilitySeller.FlushMarketStabilityTreasuryTon:msg.amount',
  // The buyback envelope is protocol-owned reserve leaving for STON.fi; the caller funds only the pTON transfer gas.
  'BuybackBurn.ExecuteBuybackChunk:BUYBACK_FUNDING_ENVELOPE_NANOTONS',
  // Dead-man sweeps send a computed residual of the balance by definition.
  'BuybackBurn.SweepStuckReserveToTreasury:payable',
  'AirdropPool.AirdropSweepUnaccountedTon:bal',
  // The pool pays airdrop deliveries out of its own funded budget.
  'AirdropPool.AirdropAccrue:AIRDROP_ATHWALLET_LEG_GAS',
  // Same, for the dead-man that returns the undistributed remainder: it moves the pool's OWN ATH through the wallet,
  // so the leg gas is the pool's to pay. The caller funds only the sweep's execution.
  'AirdropPool.AirdropSweepResidualToTreasury:AIRDROP_ATHWALLET_LEG_GAS',
  // COVERED, but through a differently-named constant, which is why it shows up here at all: the gate demands
  // FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE (2,600,000), whose own comment states it is sized as "deposit exec + the
  // ticket credit leg" and whose measurement includes the 600,000 this leg carries. Left as an explicit entry rather
  // than silenced: a sum that covers a term it does not NAME is exactly the coupling that rots unnoticed, and PT-04c
  // is what actually measures the margin end to end.
  'FeeAccumulator.DepositCapsuleFee:FEEACCUMULATOR_TICKET_CREDIT_VALUE',
]);

const SKIP_CONTRACT = /^Mock|^M20T/;
// Built through RegExp() so the newline escape cannot collapse while this file is edited by tooling — it already
// did, four separate times in this session, turning a pattern into a literal line break.
const SPLIT_LINES = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n');

/**
 * Per receiver: the terms its `context().value >=` gate names, and the terms its outgoing legs spend.
 *
 * A leg counts as INBOUND-FUNDED — and so correctly absent from the gate — when it pays with a local derived from the
 * inbound value or from a gate term. That covers the ordinary shape `let downstream = context().value - RESERVE`, and
 * the shape where the gate names a helper (`minValue()`, `requiredValue`) that already sums the leg's constant. The
 * first version of this scan lacked that resolution and produced 18 hits, all but three of them this pattern.
 */
function scan(contract: string, src: string, consts: Map<string, string>): Finding[] {
  const out: Finding[] = [];
  const lines = src.split(SPLIT_LINES);

  // Buffer each receiver whole, then resolve. A single forward pass cannot work: the gate is often expressed through a
  // local declared BEFORE it (`let requiredValue = ...; throwUnless(.., context().value >= requiredValue)`), so the
  // local's terms are only known to belong to the gate once the gate line has been read.
  const bodies: Array<{ name: string; lines: string[] }> = [];
  let cur: { name: string; lines: string[] } | null = null;
  for (const raw of lines) {
    const recv = raw.match(/^ {4}(?:receive|bounced)\((?:msg|_)\s*:\s*(?:bounced<)?(\w+)/);
    if (recv) { cur = { name: recv[1], lines: [] }; bodies.push(cur); continue; }
    if (!cur) continue;
    if (raw === '    }') { cur = null; continue; }
    cur.lines.push(raw);
  }

  for (const body of bodies) {
    const gateLines = body.lines.filter((l) => /context\(\)\.value >=/.test(l));
    if (gateLines.length === 0) continue;      // no funding claim to contradict; the permissionless sweep covers those

    const locals = new Map<string, string>();
    for (const l of body.lines) {
      const m = l.match(/^\s*let (\w+):\s*Int = (.+);$/);
      if (m) locals.set(m[1], m[2]);
    }

    // Everything the gate reaches, expanding locals and file-level Int constants until nothing new appears.
    const reached = new Set<string>();
    const queue = gateLines.flatMap((l) => l.match(/[A-Za-z_][\w.]*/g) ?? []);
    while (queue.length) {
      const t = queue.pop()!;
      if (reached.has(t)) continue;
      reached.add(t);
      // Gate lines name helpers as `self.minValue`, while the definition map is keyed on the bare name — the dot is
      // part of the token, so a lookup without stripping it silently finds nothing and the leg looks unfunded.
      const bare = t.replace(/^self\./, '');
      const expansion = locals.get(t) ?? consts.get(t) ?? locals.get(bare) ?? consts.get(bare);
      if (expansion) queue.push(...(expansion.match(/[A-Za-z_][\w.]*/g) ?? []));
    }
    // A local built from the inbound value is inbound-funded whatever it is called.
    for (const [name, expr] of locals) {
      if (/context\(\)\.value/.test(expr)) reached.add(name);
    }

    for (const l of body.lines) {
      const leg = l.match(/^\s*value:\s*([A-Za-z_][\w.]*)\s*[,+]/);
      if (!leg) continue;
      const term = leg[1];
      if (reached.has(term) || /^my|^context/.test(term)) continue;
      if (REVIEWED_BALANCE_FUNDED.has(`${contract}.${body.name}:${term}`)) continue;
      out.push({ contract, receiver: body.name, spent: term });
    }
  }
  return out;
}

/**
 * Definitions a gate can reach through: file-level `const NAME: Int = expr;` AND single-expression
 * `fun name(): Int { return expr; }`. Both forms appear as gate terms — RecordShard names a const (RS_MIN_VALUE),
 * PublicShard names a function (minValue()) that sums the very fee its leg sends. Covering only consts left the
 * PublicShard publish looking unfunded when it is not.
 */
function intConstants(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/^const (\w+): Int = (.+);$/gm)) out.set(m[1], m[2]);
  for (const m of src.matchAll(/^ {4}fun (\w+)\(\): Int \{ return (.+); \}$/gm)) out.set(m[1], m[2]);
  return out;
}

describe('value gate covers what the handler spends', () => {
  it('VGATE-01: no outgoing leg is funded by a constant its own gate never mentions', () => {
    const findings: Finding[] = [];
    let scanned = 0;
    for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
      const contract = file.replace(/\.tact$/, '');
      if (SKIP_CONTRACT.test(contract)) continue;
      scanned += 1;
      const src = readFileSync(`contracts/${file}`, 'utf8');
      findings.push(...scan(contract, src, intConstants(src)));
    }

    // Aimed at something real: a sweep that reads nothing passes silently, and this repo has shipped two such guards.
    expect(scanned, 'the sweep must read the deployed contracts').toBeGreaterThan(12);

    const report = findings.map((f) => `${f.contract}.${f.receiver} sends ${f.spent}, but its context().value gate `
      + 'never names it — either add the term to the gate, or add the leg to REVIEWED_BALANCE_FUNDED with the reason '
      + 'it is paid from the contract\'s own balance').join('\n');
    expect(findings, report).toEqual([]);
  });
});
