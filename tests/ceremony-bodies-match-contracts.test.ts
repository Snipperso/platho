import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { Cell } from '@ton/core';

// CEREMONY AUDIT, last surface: what an operator actually SIGNS versus what the contract is waiting for.
//
// Every control step carries a body as raw BOC, and Tonkeeper shows a hash, not a meaning. If a step were built with
// the wrong store* helper, or a message opcode moved in a contract without the packet being regenerated, the signed
// cell would be a different message than the label claims — and this session moved two opcodes already
// (DeployTreasurySupply off the 0x41544807 collision, and the new ATHMaster top-up). The failure is either a refusal
// mid-ceremony on a one-shot path, or — against a receiver that tolerates unknown bodies — silent acceptance.
//
// So: decode each signed body, read its opcode, and compare it to the opcode the named contract declares for the
// named message. Derived from the contract sources, so a moved opcode surfaces here instead of during the ceremony.

const PACKET = 'artifacts/local/mainnet_tx_dry_run_packet.json';

/** Every `message(0x..) Name` in contracts/, as Contract.Name -> opcode. */
function declaredOpcodes(): Map<string, number> {
  const out = new Map<string, number>();
  for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
    const contract = file.replace(/\.tact$/, '');
    const src = readFileSync(`contracts/${file}`, 'utf8');
    for (const m of src.matchAll(/^message\((0x[0-9A-Fa-f]+)\)\s+(\w+)/gm)) {
      out.set(`${contract}.${m[2]}`, Number(m[1]));
    }
  }
  return out;
}

describe('ceremony bodies match the contracts', () => {
  it('CEREMONY-BODY-01: every signed control body carries the opcode its label claims', () => {
    if (!existsSync(PACKET)) {
      // eslint-disable-next-line no-console
      console.warn(`[CEREMONY-BODY-01] ${PACKET} absent — run scripts/mainnet_tx_dry_run_packet.ts`);
      return;
    }
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const opcodes = declaredOpcodes();
    expect(opcodes.size, 'the sweep must find the declared messages').toBeGreaterThan(50);

    const steps = [
      ...(packet.control_messages ?? []),
      ...(packet.funding_messages ?? []),
      ...(packet.wallet_endowment_messages ?? []),
    ].filter((s: any) => s?.body?.boc_base64);
    expect(steps.length, 'the packet must carry signable bodies').toBeGreaterThan(20);

    const problems: string[] = [];
    for (const step of steps as any[]) {
      const label: string = step.body.label ?? '';
      // Labels are `Contract.Message` or `Contract.Message.STEPID`.
      const parts = label.split('.');
      const key = `${parts[0]}.${parts[1]}`;
      const declared = opcodes.get(key);
      if (declared === undefined) {
        problems.push(`${step.id}: label "${label}" names no message declared in contracts/`);
        continue;
      }
      const cell = Cell.fromBase64(step.body.boc_base64);
      const slice = cell.beginParse();
      if (slice.remainingBits < 32) {
        problems.push(`${step.id}: signed body is shorter than an opcode`);
        continue;
      }
      const actual = slice.loadUint(32);
      if (actual !== declared) {
        problems.push(`${step.id} ${label}: signs opcode 0x${actual.toString(16).toUpperCase()} but the contract `
          + `declares 0x${declared.toString(16).toUpperCase()} — the packet is stale against the contract`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('CEREMONY-BODY-02: the declared body hash is the hash of the body actually carried', () => {
    if (!existsSync(PACKET)) return;
    const packet = JSON.parse(readFileSync(PACKET, 'utf8'));
    const steps = [
      ...(packet.control_messages ?? []),
      ...(packet.funding_messages ?? []),
      ...(packet.wallet_endowment_messages ?? []),
    ].filter((s: any) => s?.body?.boc_base64 && s?.body?.cell_hash_hex);

    // The operator compares a hash in Tonkeeper against the one in this file. If the two fields in the file itself
    // disagree, that comparison proves nothing — and it is the only check standing between a correct packet and a
    // substituted body.
    const problems: string[] = [];
    for (const step of steps as any[]) {
      const actual = Cell.fromBase64(step.body.boc_base64).hash().toString('hex');
      if (actual !== step.body.cell_hash_hex) {
        problems.push(`${step.id}: declared ${step.body.cell_hash_hex} but the carried body hashes to ${actual}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
