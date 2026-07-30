import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// CEREMONY AUDIT. The packet is 36 steps, several of them one-shot, and it declared ordering constraints on exactly
// two of them (F01/F02). Every one of the five seals has REAL preconditions — `*_bound` flags a Bind step sets — and
// not one of those was written down anywhere. The listed order happens to satisfy them; nothing said it had to.
//
// The concrete hazard is not theoretical: BuybackBurn's binds are SPLIT across the file. B01 and B02 sit at the top
// with the other BuybackBurn work, B12 (BindBuybackTreasury) is ten lines further down among other contracts' steps,
// and S04 refuses without it at gate 22509. An operator working contract-by-contract rather than line-by-line signs
// B01, B02, then S04 — and hits a refusal mid-ceremony on a one-shot controller path.
//
// So this derives the dependencies FROM THE CONTRACTS — which Bind sets which flag, which Seal demands which flag —
// and checks the packet lists them in an order that can actually be signed. A new bind, a renamed flag or a reordered
// packet all surface here rather than during the ceremony.

const PACKET = 'artifacts/local/mainnet_tx_dry_run_packet.json';

const CONTRACTS = [
  'AirdropPool', 'UsernameRegistry', 'ProfileRegistry', 'BuybackBurn', 'MarketStabilitySeller',
] as const;

/** For one contract: which receiver sets each `*_bound` flag, and which flags its Seal receiver demands. */
function bindGraph(contract: string) {
  const src = readFileSync(`contracts/${contract}.tact`, 'utf8');
  const setters = new Map<string, string>();      // flag -> receiver message name
  const sealNeeds: string[] = [];

  let current = '';
  let inSeal = false;
  for (const raw of src.split('\n')) {
    const recv = raw.match(/^ {4}receive\(msg: (\w+)\)/);
    if (recv) {
      current = recv[1];
      inSeal = /Seal/.test(current);
    }
    const set = raw.match(/^\s*self\.(\w*_bound) = true;/);
    if (set && current && !inSeal) setters.set(set[1], current);
    if (inSeal) {
      const need = raw.match(/throwUnless\(\d+, self\.(\w*_bound)\)/);
      if (need) sealNeeds.push(need[1]);
      // [WIDENED 2026-07-30, tier-4 HIGH] `*_bound` was too narrow, and the gap was live. UsernameRegistry's seal now
      // also demands `art_sealed` and `meta_sealed` — a precondition of exactly the same shape (a boolean another
      // controller step must set first) that this sweep did not see, because the flag happens to be named otherwise.
      // A guard that recognises a hazard only by its NAME misses the next instance by construction.
      const needFlag = raw.match(/throwUnless\(\d+, self\.(\w+)\);/);
      if (needFlag && !/_bound$/.test(needFlag[1])) sealNeeds.push(needFlag[1]);
    }
  }
  return { setters, sealNeeds };
}

/**
 * Preconditions satisfied OUTSIDE the signed packet, each pointing at the tool that satisfies it.
 *
 * The art and metadata locks are 59 separate uploads — far too many to carry as packet steps — so they run from
 * their own ceremony tools. That makes them exactly the kind of dependency an operator can skip, which is why the
 * seal's own order_note has to name them and why this list is checked rather than assumed: an entry here must still
 * prove the packet TELLS the operator, and an unlisted new flag fails CEREMONY-ORDER-01 outright.
 */
const EXTERNAL_PRECONDITIONS: Record<string, { tool: RegExp }> = {
  'UsernameRegistry.art_sealed': { tool: /mainnet_upload_username_art/ },
  'UsernameRegistry.meta_sealed': { tool: /mainnet_upload_collection_meta/ },
};

describe('ceremony order satisfies the on-chain gates', () => {
  it('CEREMONY-ORDER-01: every seal is preceded in the packet by the binds its own gates demand', () => {
    if (!existsSync(PACKET)) {
      // eslint-disable-next-line no-console
      console.warn(`[CEREMONY-ORDER-01] ${PACKET} absent — run scripts/mainnet_tx_dry_run_packet.ts`);
      return;
    }
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const steps: Array<{ id: string; body?: { label?: string } }> = packet.control_messages ?? [];
    expect(steps.length, 'the packet must carry its control messages').toBeGreaterThan(15);

    /** Position of the step whose body label is `Contract.Message`, or -1. */
    const indexOf = (contract: string, message: string) =>
      steps.findIndex((s) => (s.body?.label ?? '').startsWith(`${contract}.${message}`));

    const problems: string[] = [];
    let checkedSeals = 0;

    for (const contract of CONTRACTS) {
      const { setters, sealNeeds } = bindGraph(contract);
      expect(sealNeeds.length, `${contract}: the sweep must find the seal's bound-gates`).toBeGreaterThan(0);

      const sealName = [...new Set(readFileSync(`contracts/${contract}.tact`, 'utf8')
        .split('\n')
        .map((l) => l.match(/^ {4}receive\(msg: (\w*Seal\w*)\)/)?.[1])
        .filter(Boolean))][0] as string;
      const sealAt = indexOf(contract, sealName);
      if (sealAt < 0) { problems.push(`${contract}: no seal step in the packet`); continue; }
      checkedSeals += 1;

      for (const flag of sealNeeds) {
        const external = EXTERNAL_PRECONDITIONS[`${contract}.${flag}`];
        if (external) {
          // Satisfied by a ceremony tool rather than a packet step — so what this must prove is that the operator is
          // TOLD. An unsigned precondition nobody wrote down is precisely how art_sealed nearly shipped unlocked.
          const note = (steps[sealAt] as any).order_note ?? '';
          if (!external.tool.test(note)) {
            problems.push(`${contract}: ${sealName} refuses without ${flag}, which no packet step sets — and `
              + `${steps[sealAt].id}'s order_note does not tell the operator to run ${external.tool.source} first`);
          }
          continue;
        }
        const setter = setters.get(flag);
        if (!setter) { problems.push(`${contract}: nothing sets ${flag}, but ${sealName} demands it`); continue; }
        const bindAt = indexOf(contract, setter);
        if (bindAt < 0) { problems.push(`${contract}: ${setter} (sets ${flag}) is not in the packet at all`); continue; }
        if (bindAt > sealAt) {
          problems.push(`${contract}: ${steps[bindAt].id} ${setter} sets ${flag}, but it is listed AFTER `
            + `${steps[sealAt].id} ${sealName}, which refuses without it`);
        }
      }
    }

    expect(checkedSeals, 'the sweep must have checked every sealed contract').toBe(CONTRACTS.length);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('CEREMONY-ORDER-02: a contract whose binds are SPLIT in the packet says so, because that is how one gets missed', () => {
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const steps: Array<{ id: string; body?: { label?: string }; order_note?: string }> = packet.control_messages ?? [];

    // Group each contract's bind steps and see whether they are contiguous. BuybackBurn's are not — B01/B02 then B12 —
    // and an operator working contract-by-contract is exactly who signs S04 without B12.
    const positions = new Map<string, number[]>();
    steps.forEach((s, i) => {
      const m = (s.body?.label ?? '').match(/^(\w+)\.(\w*Bind\w*)/);
      if (!m) return;
      positions.set(m[1], [...(positions.get(m[1]) ?? []), i]);
    });

    for (const [contract, idx] of positions) {
      const contiguous = idx.every((v, k) => k === 0 || v === idx[k - 1] + 1);
      if (contiguous) continue;
      const gapped = idx.map((i) => steps[i].id).join(', ');
      const noted = idx.some((i) => typeof steps[i].order_note === 'string' && /seal|bind/i.test(steps[i].order_note!));
      expect(noted, `${contract} binds are split across the packet (${gapped}) and none of them carries an `
        + 'order_note saying so. Either group them or write the constraint down — a seal that refuses mid-ceremony '
        + 'is the expensive way to discover it.').toBe(true);
    }
  });
});
