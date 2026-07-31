import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// FIVE CONTRACTS ENCODE A SUM THAT LIVES IN A SIXTH, AND NOTHING CHECKS IT.
//
// ATHWallet.ATHTransferRequest refuses at gate 14204 unless the incoming value covers
//   ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
//   + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE + ATH_OWNER_REQUEST_EXEC_RESERVE
// which is 48,000,000 today. Every protocol contract that moves ATH sends that message with a leg value of its own,
// and each of those leg values is a hand-copied restatement of that sum plus a margin.
//
// This coupling has ALREADY broken twice, and both repairs are recorded in the constants themselves: the registries
// went 30M -> 48M and ATHVesting 40M -> 58M when ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT was raised 2M -> 20M. Both
// were caught by hand. Nothing would catch the third.
//
// WHAT AN UNDERPAID LEG COSTS, per caller — the reason this is not merely tidiness:
//   * AirdropPool sends its payout leg bounce:false and decrements remaining_budget BEFORE the send, so a refusal
//     is SILENT: the ATH stays in the pool's wallet, the books say the budget shrank, and nothing can reach it
//     again. Its own comment records this as accepted precisely because "the leg value is a fixed constant the
//     26114 gate guarantees" — a guarantee that holds only as long as this relationship does.
//   * UsernameRegistry and ProfileRegistry sit at EXACTLY 48,000,000, margin zero. They work because a message sent
//     with fees paid separately arrives whole; they have nothing left to absorb any change to any of the five terms.
//
// So the requirement is DERIVED from ATHWallet here, never restated. Raise the endowment (see the measured note at
// ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT) and this test names every caller that must move with it.

const WALLET_SRC = readFileSync('contracts/ATHWallet.tact', 'utf8');

/** A file-level `const NAME: Int = <digits>;` from a contract source. */
function intConst(src: string, name: string): number {
  const m = src.match(new RegExp(`^const ${name}: Int = (\\d+);`, 'm'));
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
}

/** Gate 14204's demand, summed from ATHWallet itself. */
function walletRequiredValue(): number {
  return [
    'ATH_INTERNAL_TRANSFER_EXEC_RESERVE',
    'ATH_INTERNAL_TRANSFER_ACK_VALUE',
    'ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT',
    'ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE',
    'ATH_OWNER_REQUEST_EXEC_RESERVE',
  ].reduce((sum, name) => sum + intConst(WALLET_SRC, name), 0);
}

/**
 * How much each caller actually delivers to the wallet.
 *
 * ATHVesting is the one that does not send a flat constant: it forwards `context().value - LOCAL_EXEC_RESERVE`
 * behind gate 24106, which demands TRANSFER_REQUEST_VALUE + LOCAL_EXEC_RESERVE. The delivered floor is therefore
 * TRANSFER_REQUEST_VALUE, and writing that out is the point — a scaled leg is still a leg with a floor.
 */
const CALLERS: Array<{ contract: string; describe: string; consequence: string; deliver: (src: string) => number }> = [
  { contract: 'AirdropPool', consequence: 'SILENT: the leg is bounce:false and remaining_budget is decremented before the send, so the ATH stays in the pool wallet while the books say it left, unreachable for ever', describe: 'AIRDROP_ATHWALLET_LEG_GAS (payout and residual sweep)',
    deliver: (s) => intConst(s, 'AIRDROP_ATHWALLET_LEG_GAS') },
  { contract: 'MarketStabilitySeller', consequence: 'the buyer paid GRAM and the ATH leg is refused; MSS parks a PENDING that only a terminal can clear', describe: 'MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE',
    deliver: (s) => intConst(s, 'MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE') },
  { contract: 'ProfileRegistry', consequence: 'the treasury/burn due flush cannot settle, so the ATH stays booked as due and never moves', describe: 'PROFILE_ATH_TRANSFER_EXEC_RESERVE',
    deliver: (s) => intConst(s, 'PROFILE_ATH_TRANSFER_EXEC_RESERVE') },
  { contract: 'UsernameRegistry', consequence: 'the treasury/burn due flush cannot settle, so the ATH stays booked as due and never moves', describe: 'USERNAME_ATH_TRANSFER_EXEC_RESERVE',
    deliver: (s) => intConst(s, 'USERNAME_ATH_TRANSFER_EXEC_RESERVE') },
  { contract: 'ATHVesting', consequence: 'the claim parks in PENDING and the beneficiary is blocked until a terminal or the stuck-recovery unwinds it', describe: 'gate 24106 floor minus ATH_VESTING_LOCAL_EXEC_RESERVE',
    deliver: (s) => intConst(s, 'ATH_VESTING_TRANSFER_REQUEST_VALUE') },
];

describe('every ATH transfer leg covers the wallet gate it is aimed at', () => {
  it('ATHLEG-01: no caller sends less than ATHWallet gate 14204 demands', () => {
    const required = walletRequiredValue();
    expect(required, 'the sweep must read the wallet requirement').toBeGreaterThan(1_000_000);

    const short: string[] = [];
    for (const caller of CALLERS) {
      const src = readFileSync(`contracts/${caller.contract}.tact`, 'utf8');
      const delivered = caller.deliver(src);
      if (delivered < required) {
        short.push(`${caller.contract}: ${caller.describe} delivers ${delivered}, gate 14204 demands ${required} `
          + `(short by ${required - delivered}). The transfer is REFUSED — ${caller.consequence}.`);
      }
    }
    expect(short, short.join('\n')).toEqual([]);
  });

  it('ATHLEG-02: every contract that sends ATHTransferRequest is in the list above', () => {
    // The half that matters more than the comparison: a NEW protocol contract that moves ATH must be measured
    // against the gate, not silently omitted. Today's sweep of the release gate found exactly this shape one layer
    // up — a map that listed nine of fourteen contracts and skipped the rest without a word.
    // `body: ATHTransferRequest{` is how a sender BUILDS one. Matching the bare type name instead would also hit
    // ATHWallet, which declares the message and receives it — the counterparty, not a caller.
    const senders = readdirSync('contracts')
      .filter((f) => f.endsWith('.tact') && !/^(Mock|M20T)/.test(f))
      .filter((f) => /body:\s*ATHTransferRequest\s*\{/.test(readFileSync(`contracts/${f}`, 'utf8')))
      .map((f) => f.replace(/\.tact$/, ''));
    expect(senders.length, 'the sweep must find the ATH senders').toBeGreaterThan(3);

    const listed = new Set(CALLERS.map((c) => c.contract));
    const unlisted = senders.filter((s) => !listed.has(s));
    expect(unlisted, `these send ATHTransferRequest but no one checks their leg against gate 14204:\n${unlisted.join('\n')}`)
      .toEqual([]);
  });

  it('ATHLEG-03: the two zero-margin callers are still exactly the two this file expects', () => {
    // UsernameRegistry and ProfileRegistry deliver EXACTLY the requirement. That is legal — a message with fees paid
    // separately arrives whole — but it means they have no room at all, so their names are worth stating out loud
    // rather than leaving to be rediscovered. If a third caller joins them, or one of these gains margin, the note
    // above stops being true and this fails so the note gets corrected.
    const required = walletRequiredValue();
    const zeroMargin = CALLERS
      .filter((c) => c.deliver(readFileSync(`contracts/${c.contract}.tact`, 'utf8')) === required)
      .map((c) => c.contract)
      .sort();
    expect(zeroMargin, 'the zero-margin set changed — re-read the note at the top of this file')
      .toEqual(['ProfileRegistry', 'UsernameRegistry']);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// THE SAME HAZARD, PROTOCOL-WIDE.
//
// ATHTransferRequest is not the only message whose caller restates the receiver's funding gate by hand. Measuring
// every cross-contract leg found a second one on a money path, with NO margin at all:
//
//   FeeAccumulator -> AirdropPool.AirdropAccrue : leg 60,000,000, gate 26114 demands exactly 60,000,000.
//
// And both ends justify a silent-loss path by pointing at that equality without being able to see it. AirdropPool
// accepts an unreachable bounce handler because "the leg value is a fixed constant the 26114 gate guarantees";
// FeeAccumulator's bounced<AirdropAccrue> comment states "26114 is impossible". Both are true today and true only
// because two numbers in two files happen to match. If they ever stop matching, AirdropTicket has already zeroed
// the claimant's credits before the accrual leaves, so the loss is silent and the user's airdrop is simply gone.
//
// So the sweep below derives BOTH sides from source for every cross-contract send it can resolve, rather than
// checking the pairs someone remembered.

type Pair = { from: string; to: string; message: string; leg: number; required: number };

function fileConsts(src: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of src.matchAll(/^const (\w+): Int = (\d+);/gm)) out.set(m[1], Number(m[2]));
  return out;
}

/** Receiver gates that are a plain sum of file-level constants: (contract, message) -> required value. */
function resolvableGates(sources: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  // Literal regex on purpose. Written as a new RegExp(...) string this collapsed to nonsense the first time — the
  // escapes did not survive being generated — and a sweep that matches nothing passes every check it makes.
  const RECEIVER = /^ {4}receive\((?:msg|_): (\w+)\) \{([\s\S]*?)^ {4}\}/gm;
  for (const [name, src] of sources) {
    const cs = fileConsts(src);
    for (const m of src.matchAll(RECEIVER)) {
      const [, message, body] = m;
      const gate = body.match(/context\(\)\.value >= ([^;)]+)\)/);
      if (!gate) continue;
      const expr = gate[1].trim();
      if (!/^[A-Z_0-9\s+]+$/.test(expr)) continue;          // not a plain sum of named constants
      const terms = expr.match(/[A-Z][A-Z_0-9]{3,}/g) ?? [];
      if (terms.length === 0 || !terms.every((t) => cs.has(t))) continue;
      out.set(`${name}.${message}`, terms.reduce((s, t) => s + cs.get(t)!, 0));
    }
  }
  return out;
}

describe('every cross-contract leg covers the gate it is aimed at', () => {
  it('LEGGATE-01: no resolvable send is short of its receiver requirement', () => {
    const names = readdirSync('contracts').filter((f) => f.endsWith('.tact') && !/^(Mock|M20T)/.test(f));
    const sources = new Map(names.map((f) => [f.replace(/\.tact$/, ''), readFileSync(`contracts/${f}`, 'utf8')]));
    const gates = resolvableGates(sources);
    expect(gates.size, 'the sweep must resolve some receiver gates').toBeGreaterThan(4);

    const pairs: Pair[] = [];
    const SEND = /value:\s*([A-Za-z_]\w*)\s*,(?:[^{}]|\{[^{}]*\}){0,400}?body:\s*(\w+)\s*[{(]/gs;
    for (const [from, src] of sources) {
      const cs = fileConsts(src);
      for (const m of src.matchAll(SEND)) {
        const leg = cs.get(m[1]);
        if (leg === undefined) continue;                    // computed leg (e.g. context().value - reserve)
        for (const [key, required] of gates) {
          const [to, message] = key.split('.');
          if (to === from || message !== m[2]) continue;
          pairs.push({ from, to, message, leg, required });
        }
      }
    }
    expect(pairs.length, 'the sweep must find cross-contract sends to gated receivers').toBeGreaterThan(0);

    const short = pairs.filter((p) => p.leg < p.required).map((p) =>
      `${p.from} -> ${p.to}.${p.message}: sends ${p.leg}, gate demands ${p.required} (short by ${p.required - p.leg})`);
    expect(short, short.join('\n')).toEqual([]);
  });

  it('LEGGATE-02: the zero-margin money legs are still exactly the ones documented above', () => {
    // A leg equal to its gate is legal and works — but it is the state in which the receiving contract's own
    // comments ("26114 is impossible", "a fixed constant the gate guarantees") stop being safe assumptions and
    // become coincidences. Naming them means a NEW one cannot appear quietly, and an OLD one gaining margin makes
    // the prose above stale and fails here so it gets corrected.
    const names = readdirSync('contracts').filter((f) => f.endsWith('.tact') && !/^(Mock|M20T)/.test(f));
    const sources = new Map(names.map((f) => [f.replace(/\.tact$/, ''), readFileSync(`contracts/${f}`, 'utf8')]));
    const gates = resolvableGates(sources);

    const zero: string[] = [];
    const SEND = /value:\s*([A-Za-z_]\w*)\s*,(?:[^{}]|\{[^{}]*\}){0,400}?body:\s*(\w+)\s*[{(]/gs;
    for (const [from, src] of sources) {
      const cs = fileConsts(src);
      for (const m of src.matchAll(SEND)) {
        const leg = cs.get(m[1]);
        if (leg === undefined) continue;
        for (const [key, required] of gates) {
          const [to, message] = key.split('.');
          if (to === from || message !== m[2] || leg !== required) continue;
          const entry = `${from} -> ${to}.${message}`;
          if (!zero.includes(entry)) zero.push(entry);
        }
      }
    }
    expect(zero.sort(), 'the zero-margin set changed — re-read the note above this describe block')
      .toEqual(['FeeAccumulator -> AirdropPool.AirdropAccrue']);
  });
});
