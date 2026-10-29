import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';


type Finding = { contract: string; receiver: string; spent: string };

const REVIEWED_BALANCE_FUNDED = new Set([
  'FeeAccumulator.FlushTreasuryDue:msg.amount',
  'FeeAccumulator.FlushBuybackDue:msg.amount',
  'FeeAccumulator.FlushBuybackDue:BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE',
  'MarketStabilitySeller.FlushMarketStabilityTreasuryTon:msg.amount',
  'BuybackBurn.ExecuteBuybackChunk:BUYBACK_FUNDING_ENVELOPE_NANOTONS',
  'BuybackBurn.SweepStuckReserveToTreasury:payable',
  'AirdropPool.AirdropSweepUnaccountedTon:bal',
  'AirdropPool.AirdropAccrue:AIRDROP_ATHWALLET_LEG_GAS',
  'AirdropPool.AirdropSweepResidualToTreasury:AIRDROP_ATHWALLET_LEG_GAS',
  'FeeAccumulator.DepositCapsuleFee:FEEACCUMULATOR_TICKET_CREDIT_VALUE',
]);

const SKIP_CONTRACT = /^Mock|^M20T/;
const SPLIT_LINES = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n');

function scan(contract: string, src: string, consts: Map<string, string>): Finding[] {
  const out: Finding[] = [];
  const lines = src.split(SPLIT_LINES);

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
    if (gateLines.length === 0) continue;

    const locals = new Map<string, string>();
    for (const l of body.lines) {
      const m = l.match(/^\s*let (\w+):\s*Int = (.+);$/);
      if (m) locals.set(m[1], m[2]);
    }

    const reached = new Set<string>();
    const queue = gateLines.flatMap((l) => l.match(/[A-Za-z_][\w.]*/g) ?? []);
    while (queue.length) {
      const t = queue.pop()!;
      if (reached.has(t)) continue;
      reached.add(t);
      const bare = t.replace(/^self\./, '');
      const expansion = locals.get(t) ?? consts.get(t) ?? locals.get(bare) ?? consts.get(bare);
      if (expansion) queue.push(...(expansion.match(/[A-Za-z_][\w.]*/g) ?? []));
    }
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

    expect(scanned, 'the sweep must read the deployed contracts').toBeGreaterThan(12);

    const report = findings.map((f) => `${f.contract}.${f.receiver} sends ${f.spent}, but its context().value gate `
      + 'never names it — either add the term to the gate, or add the leg to REVIEWED_BALANCE_FUNDED with the reason '
      + 'it is paid from the contract\'s own balance').join('\n');
    expect(findings, report).toEqual([]);
  });
});
