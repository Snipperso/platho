import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';


const WALLET_SRC = readFileSync('contracts/ATHWallet.tact', 'utf8');

function intConst(src: string, name: string): number {
  const m = src.match(new RegExp(`^const ${name}: Int = (\\d+);`, 'm'));
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
}

function walletRequiredValue(): number {
  return [
    'ATH_INTERNAL_TRANSFER_EXEC_RESERVE',
    'ATH_INTERNAL_TRANSFER_ACK_VALUE',
    'ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT',
    'ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE',
    'ATH_OWNER_REQUEST_EXEC_RESERVE',
  ].reduce((sum, name) => sum + intConst(WALLET_SRC, name), 0);
}

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

  it('ATHLEG-03: no caller sits exactly on the wallet gate any more', () => {
    const required = walletRequiredValue();
    const zeroMargin = CALLERS
      .filter((c) => c.deliver(readFileSync(`contracts/${c.contract}.tact`, 'utf8')) === required)
      .map((c) => c.contract)
      .sort();
    expect(zeroMargin, 'a caller is funding the wallet gate to the nanoton again. That is not wrong today, but it '
      + 'leaves no room, and the next change to any term in 14204 breaks it with no warning').toEqual([]);
  });
});


type Pair = { from: string; to: string; message: string; leg: number; required: number };

function fileConsts(src: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of src.matchAll(/^const (\w+): Int = (\d+);/gm)) out.set(m[1], Number(m[2]));
  return out;
}

function resolvableGates(sources: Map<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  const RECEIVER = /^ {4}receive\((?:msg|_): (\w+)\) \{([\s\S]*?)^ {4}\}/gm;
  for (const [name, src] of sources) {
    const cs = fileConsts(src);
    for (const m of src.matchAll(RECEIVER)) {
      const [, message, body] = m;
      const gate = body.match(/context\(\)\.value >= ([^;)]+)\)/);
      if (!gate) continue;
      const expr = gate[1].trim();
      if (!/^[A-Z_0-9\s+]+$/.test(expr)) continue;
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
        if (leg === undefined) continue;
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
