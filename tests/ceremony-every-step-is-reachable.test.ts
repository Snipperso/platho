import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// CAN THE CEREMONY ACTUALLY PERFORM EVERY STEP IT GENERATES?
//
// Found 2026-07-31, while preparing the clean-17 ceremony. The packet carried four wallet_endowment_messages
// (W01..W04), tests/ceremony-endowment-before-deploy.test.ts measured that they buy the four protocol-owned ATHWallets
// roughly a century of rent instead of the ~3.7 years their ATH transfer leg pays for — and NOTHING COULD SEND THEM:
//
//   * packet.execution_order listed six steps and the endowment was not one of them;
//   * mainnet_ceremony_broadcast.mjs offered five --phase values, none selecting wallet_endowment_messages;
//   * no operator document mentioned W01..W04 at all.
//
// Every existing check aimed at whether the step was CORRECT. None asked whether anyone would ever run it. That is
// the same blind spot the release gate had when it verified 9 of 16 contract hashes: the question to ask of a guard
// is not only "is what it checks true" but "what does it not aim at at all".
//
// The second half here is the bounce flag, which is the same failure one layer down: the broadcaster inferred
// `bounce: !isDeploy`, correct for the 32 control/funding steps and wrong for exactly the 4 endowment steps, whose
// targets need not exist yet. CEREMONY-W-02 measures that a bounceable endowment to an uninit wallet returns
// immediately while the send still prints OK.

const PACKET = 'artifacts/local/mainnet_tx_dry_run_packet.json';
const BROADCASTER = 'scripts/mainnet_ceremony_broadcast.mjs';

/** The arrays of signable steps, identified by shape rather than by a hand-kept list. */
function messageArrays(packet: any): Array<[string, any[]]> {
  return Object.entries(packet).filter(([, v]) => Array.isArray(v) && v.length > 0
    && v.every((m: any) => m && typeof m === 'object' && 'target_address' in m)) as Array<[string, any[]]>;
}

describe('every generated ceremony step is reachable and fully specified', () => {
  it('CEREMONY-REACH-01: the broadcaster has a --phase for every message array the packet generates', () => {
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));

    // Read the selector itself, not a restatement of it. A phase list written out here would be one more copy to
    // drift, and drift between the packet and its only sender is precisely the defect this test exists for.
    const src = readFileSync(BROADCASTER, 'utf8');
    const selector = src.slice(src.indexOf('function selectMessages'));
    const body = selector.slice(0, selector.indexOf('\n}\n'));
    expect(body, 'selectMessages must be findable in the broadcaster').toContain('phase ===');

    const sendable = new Set(Array.from(body.matchAll(/packet\.([a-z_]+)/g), (m) => m[1]));
    const generated = messageArrays(packet).map(([name]) => name);
    expect(generated.length, 'the packet must generate signable steps').toBeGreaterThan(3);

    const unreachable = generated.filter((name) => !sendable.has(name));
    expect(unreachable, 'the packet generates these steps and no --phase of the broadcaster selects them, so a '
      + `ceremony run as documented performs everything except them, in silence:\n${unreachable.join('\n')}`)
      .toEqual([]);
  });

  it('CEREMONY-REACH-02: every phase the broadcaster can send is placed in the packet execution order', () => {
    // The mirror. Reachable is not the same as ordered: a step the operator can send but that no order mentions is
    // a step performed whenever someone happens to remember it.
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const order: string[] = (packet.execution_order ?? []).map((s: any) => s.phase);

    const unordered: string[] = [];
    for (const [name, msgs] of messageArrays(packet)) {
      const phases = new Set(msgs.map((m: any) => m.phase).filter(Boolean));
      // deploy_contracts carry no per-message phase; the order names the array itself.
      if (phases.size === 0) { if (!order.includes(name)) unordered.push(name); continue; }
      for (const p of phases) if (!order.includes(p)) unordered.push(`${name}: ${p}`);
    }
    expect(unordered, `these steps exist but the packet's own execution_order never places them:\n${unordered.join('\n')}`)
      .toEqual([]);
  });

  it('CEREMONY-REACH-03: every step declares its bounce flag, and the endowment declares non-bounceable', () => {
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));

    const missing: string[] = [];
    for (const [name, msgs] of messageArrays(packet)) {
      for (const m of msgs) if (typeof m.bounce !== 'boolean') missing.push(`${name}/${m.id}`);
    }
    expect(missing, `these steps do not say how they must be signed, so the sender has to guess:\n${missing.join('\n')}`)
      .toEqual([]);

    for (const m of packet.wallet_endowment_messages ?? []) {
      expect(m.bounce, `${m.id} must be non-bounceable: its target may not be deployed yet, and CEREMONY-W-02 `
        + 'measures that the bounceable form returns the endowment while the ceremony reports success').toBe(false);
    }
    for (const m of packet.control_messages ?? []) {
      expect(m.bounce, `${m.id} targets a live contract; a rejected one-shot must come back rather than burn`)
        .toBe(true);
    }
  });

  it('CEREMONY-REACH-05: the broadcaster reads chain state from a live endpoint, and refuses to act when it cannot', () => {
    // Found by running the dry run, 2026-07-31: the very first state check aborted with "fetch failed". gwState read
    // ONLY rpc.platho.app, decommissioned months earlier — the same file's transport note said so and had already
    // rerouted the SENDS to toncenter, while the READS were left behind. Half a migration, on the script that
    // performs an irreversible ceremony.
    //
    // The second half is what the failure would have been if the endpoint had answered softly instead of throwing:
    // an unreadable target fell through to 'unreachable', which is not 'active', which means a deploy proceeds as if
    // the address were empty. Every endpoint being down is not evidence that a contract is not there.
    const src = readFileSync(BROADCASTER, 'utf8');
    const gwState = src.slice(src.indexOf('async function gwState'), src.indexOf('async function gwSeqno'));
    expect(gwState, 'state reads must go through toncenter, not only the retired gateway').toContain('toncenter.com');
    expect(gwState.indexOf('toncenter.com'), 'and toncenter must be tried BEFORE the gateway')
      .toBeLessThan(gwState.indexOf('${GATEWAY}') >= 0 ? gwState.indexOf('${GATEWAY}') : Number.MAX_SAFE_INTEGER);
    expect(src, 'an unreadable target must stop the phase, never be treated as an empty address')
      .toMatch(/if \(!st\) die\(/);
    // The pattern, not the word: the original was `st ? (st.state || st.account_state) : 'unreachable'`, and the
    // comment recording that defect naturally contains the word too. Matching prose would make this pass the day
    // someone deletes the explanation.
    expect(src, 'the unreachable-as-not-active fallthrough must be gone').not.toMatch(/:\s*'unreachable'/);
  });

  it('CEREMONY-REACH-04: the broadcaster obeys the declared flag instead of inferring it', () => {
    // Pins the fix itself. The inference read `bounce: !m.isDeploy` — a single expression, in the one place that
    // could not see which targets exist, deciding the property the endowment depends on.
    const src = readFileSync(BROADCASTER, 'utf8');
    expect(src.includes('bounce: !m.isDeploy'), 'the broadcaster must not infer the bounce flag from isDeploy')
      .toBe(false);
    expect(src, 'it must send the flag the packet declares').toContain('bounce: m.bounce');
    expect(src, 'and refuse a packet that omits it rather than falling back to a default')
      .toMatch(/typeof m\.bounce !== 'boolean'\)\s*die\(/);
  });
});
