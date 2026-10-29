import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';


const CONTRACT_DIR = 'contracts';

function payoutContracts(): string[] {
  const found: string[] = [];
  for (const file of readdirSync(CONTRACT_DIR)) {
    if (!file.endsWith('.tact') || file.startsWith('Mock')) continue;
    const src = readFileSync(`${CONTRACT_DIR}/${file}`, 'utf8');
    const sends = /body:\s*ATHTransferRequest\s*\{[^}]*response_destination:\s*myAddress\(\)/s.test(src);
    if (sends) found.push(file.replace('.tact', ''));
  }
  return found.sort();
}

describe('the change from a payout has somewhere to land', () => {
  it('EXCESS-01: every self-addressed payout contract accepts ATHTransferExcess', () => {
    const payers = payoutContracts();
    expect(payers.length, 'the derivation must find the payout contracts; if this drops to zero the regex stopped '
      + 'matching and the whole check went quiet').toBeGreaterThan(3);

    const deaf: string[] = [];
    for (const name of payers) {
      const src = readFileSync(`${CONTRACT_DIR}/${name}.tact`, 'utf8');
      if (!/receive\((?:_|msg):\s*ATHTransferExcess\)/.test(src)) deaf.push(name);
    }
    expect(deaf, 'these contracts name themselves as response_destination but have no receiver for the change that '
      + `comes back, so every payout they make ends in a failed transaction:\n${deaf.join('\n')}`).toEqual([]);
  });

  it('EXCESS-04: every inbound lane returns change — there are five, not two', () => {
    const src = readFileSync(`${CONTRACT_DIR}/ATHWallet.tact`, 'utf8');
    const lanes: string[] = [];
    const deaf: string[] = [];
    for (const m of src.matchAll(/receive\(msg: (\w*Internal\w*)\)\s*\{([\s\S]*?)\n    \}/g)) {
      const [, name, body] = m;
      if (!/self\.balance \+= msg\.amount/.test(body)) continue;
      lanes.push(name);
      const returns = /context\(\)\.value - ATH_INTERNAL_TRANSFER_ARRIVAL_MIN/.test(body)
        || /return_notify_lane_excess\(/.test(body)
        || /let excess: Int = context\(\)\.value - consumed/.test(body);
      if (!returns) deaf.push(name);
    }
    expect(lanes.length, 'the derivation must find the inbound lanes; if this collapses the check went quiet')
      .toBeGreaterThan(4);
    expect(deaf, 'these lanes credit a balance and keep the surplus. An ATHWallet has no path that pays TON to its '
      + `owner, so what they keep is buried for good:\n${deaf.join('\n')}`).toEqual([]);
  });

  it('EXCESS-02: the mirrored declaration matches the wallet byte for byte', () => {
    const wallet = readFileSync(`${CONTRACT_DIR}/ATHWallet.tact`, 'utf8');
    const canonical = wallet.match(/message\((0x[0-9A-Fa-f]+)\)\s+ATHTransferExcess\s*\{([^}]*)\}/);
    expect(canonical, 'ATHWallet must declare ATHTransferExcess').toBeTruthy();

    const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();
    for (const file of readdirSync(CONTRACT_DIR)) {
      if (!file.endsWith('.tact') || file === 'ATHWallet.tact') continue;
      const src = readFileSync(`${CONTRACT_DIR}/${file}`, 'utf8');
      const local = src.match(/message\((0x[0-9A-Fa-f]+)\)\s+ATHTransferExcess\s*\{([^}]*)\}/);
      if (!local) continue;
      expect(local[1].toLowerCase(), `${file}: mirrored opcode differs from ATHWallet`)
        .toBe(canonical![1].toLowerCase());
      expect(normalise(local[2]), `${file}: mirrored fields differ from ATHWallet — a width drift here is silent`)
        .toBe(normalise(canonical![2]));
    }
  });

  it('EXCESS-03: the opcode does not collide with anything else in the ATH space', () => {
    const seen = new Map<string, string[]>();
    for (const file of readdirSync(CONTRACT_DIR)) {
      if (!file.endsWith('.tact')) continue;
      const src = readFileSync(`${CONTRACT_DIR}/${file}`, 'utf8');
      for (const m of src.matchAll(/message\((0x415448[0-9A-Fa-f]{2})\)\s+(\w+)/g)) {
        const op = m[1].toLowerCase();
        const names = seen.get(op) ?? [];
        if (!names.includes(m[2])) names.push(m[2]);
        seen.set(op, names);
      }
    }
    const collisions = [...seen.entries()].filter(([, names]) => names.length > 1)
      .map(([op, names]) => `${op}: ${names.join(' / ')}`);
    expect(collisions, `one opcode carries two different messages:\n${collisions.join('\n')}`).toEqual([]);
  });
});
