import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// THE PAPER THE OPERATOR FOLLOWS DURING AN IRREVERSIBLE CEREMONY.
//
// Found 2026-07-31, one step before the ceremony. MAINNET_RELEASE_CHECKLIST.md — the sheet PRODUCTION_READINESS.md
// itself calls "the operational go/no-go checklist" — told the operator to pre-fund "the official Vault ATH wallet"
// and to verify getters on `Vault` and `CapsuleHub`. Both contracts were deleted in clean-17. And two lines in
// PRODUCTION_READINESS.md asserted that irreversible genesis steps were ALREADY COMPLETE:
//
//   "The one-shot ATHMaster.DeployTreasurySupply transaction is complete"   — it is ceremony step D02, unperformed
//   "Vault activity airdrop backing is complete"                            — the custodian is AirdropPool, unfunded
//
// Both sentences were true of the clean-15 deployment and false of the release they gate. A reader checking
// readiness would have concluded the supply mint was done and skipped it — and D02 is what creates every ATH that
// will ever exist.
//
// preprod_guard reads PRODUCTION_READINESS.md, but only greps it for the literal phrase "Hard blockers", so a
// checklist describing a system that no longer exists passed that gate without comment. This is the check that was
// missing: an operator document may mention a deleted contract only where it says, on the same line, that the thing
// is gone. Anywhere else it reads as a live instruction.

const OPERATOR_DOCS = ['MAINNET_RELEASE_CHECKLIST.md', 'PRODUCTION_READINESS.md', 'DEPLOYMENT_RUNBOOK.md'];

/** Contracts clean-17 removed. Naming one as if it still existed is an instruction the operator cannot follow. */
const REMOVED = /\b(Vault|CapsuleHub|KeyRegistry|CreditIssuer|NullifierShard|CreditSale)\b/;

/** A line may name a removed contract when it is explaining that it is gone. */
const MARKS_IT_GONE = /DELETED|no longer exists?|removed|replaces?|CORRECTED|retired|clean-1[56]\b|obsolete/i;

describe('operator documents describe the contracts that exist', () => {
  it('OPDOC-01: no live line in a ceremony document names a removed contract', () => {
    // Judged over a THREE-LINE window, not one line. Prose wraps: the runbook's "It replaces `Vault`, which no
    // longer / exists (neither does `CapsuleHub` ...)" puts the name and the disclaimer on different lines, and a
    // per-line rule flags a sentence that is already saying exactly the right thing. The question this asks is
    // "does the surrounding sentence mark it as gone", which is what a reader actually sees.
    const live: string[] = [];
    for (const doc of OPERATOR_DOCS) {
      const lines = readFileSync(doc, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!REMOVED.test(line)) return;
        const window = lines.slice(Math.max(0, i - 1), i + 2).join(' ');
        if (MARKS_IT_GONE.test(window)) return;
        live.push(`${doc}:${i + 1}: ${line.trim().slice(0, 150)}`);
      });
    }
    expect(live, 'these lines instruct the operator about contracts that do not exist. During the ceremony they are '
      + `followed literally:\n${live.join('\n')}`).toEqual([]);
  });

  it('OPDOC-02: no ceremony step is described as already complete', () => {
    // The sharper half. A stale "is complete" does not merely confuse — it removes a step. Both offenders named an
    // irreversible one, and the checklist exists precisely so that no irreversible step is decided from memory.
    const claims: string[] = [];
    const CEREMONY_STEP = /(DeployTreasurySupply|airdrop backing|activity airdrop|SealGenesis|reserve funding)/i;
    const ALREADY_DONE = /\bis complete\b|\bwas completed\b|\bhas been (?:funded|deployed|sealed|performed)\b/i;
    for (const doc of OPERATOR_DOCS) {
      readFileSync(doc, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (!CEREMONY_STEP.test(line) || !ALREADY_DONE.test(line)) return;
        if (MARKS_IT_GONE.test(line)) return;              // a note about a PAST generation is allowed to say so
        claims.push(`${doc}:${i + 1}: ${line.trim().slice(0, 150)}`);
      });
    }
    expect(claims, 'a ceremony step is documented as already done. For clean-17 none of them has been performed, and '
      + `an operator reading this would skip it:\n${claims.join('\n')}`).toEqual([]);
  });

  it('OPDOC-03: the release checklist still names every contract the ceremony deploys', () => {
    // The inverse blind spot — the one that let the Vault rows survive: a document can be free of dead names and
    // still be missing the live ones. Derived from the deploy packet, so a contract added to the ceremony must
    // appear on the sheet the operator verifies.
    const packet = JSON.parse(readFileSync('artifacts/local/mainnet_deploy_packet.json', 'utf8'));
    const deployed: string[] = (packet.phase_1_deploy_contracts ?? [])
      .map((s: any) => String(s.action ?? '').replace(/^Deploy /, ''))
      .filter((name: string) => name && !name.startsWith('Call '));
    expect(deployed.length, 'the packet must list its deploy steps').toBeGreaterThan(6);

    const checklist = readFileSync('MAINNET_RELEASE_CHECKLIST.md', 'utf8');
    const missing = deployed.filter((name) => !checklist.includes(name));
    expect(missing, `the ceremony deploys these, and the go/no-go checklist never mentions them:\n${missing.join('\n')}`)
      .toEqual([]);
  });
});
