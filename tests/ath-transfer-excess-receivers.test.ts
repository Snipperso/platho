import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// EVERY CONTRACT THAT NAMES ITSELF AS response_destination MUST BE ABLE TO TAKE ITS CHANGE BACK.
//
// Found 2026-08-01, by measurement rather than by reading. When ATHWallet's custom lane began returning the true
// surplus instead of burying it on the recipient's wallet, that surplus started arriving at whatever the sender put
// in response_destination — and for every protocol payout that is the sending CONTRACT itself. None of them had a
// receiver for the new message, so Tact threw 130 on it. MEASURED on ATHVesting: exit 130, 26,784,866 still
// credited, because the message is sent bounce:false and a failed compute phase keeps the coins.
//
// So nothing was lost — and every vesting claim, every MSS sale, every airdrop delivery and every registry purchase
// left a FAILED transaction behind. Money arriving through a failure is not a property to build on, and on an
// immutable contract it cannot be repaired later.

const CONTRACT_DIR = 'contracts';

/** Contracts that send an ATH transfer naming THEMSELVES as the response destination. Derived, not listed. */
function payoutContracts(): string[] {
  const found: string[] = [];
  for (const file of readdirSync(CONTRACT_DIR)) {
    if (!file.endsWith('.tact') || file.startsWith('Mock')) continue;
    const src = readFileSync(`${CONTRACT_DIR}/${file}`, 'utf8');
    // An ATHTransferRequest body whose response_destination is myAddress() — the shape that makes the change land
    // back on the sender. Matched across lines because the body is written as a multi-line struct literal.
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
    // THE LESSON THAT COST THREE PASSES. ATHWallet has FIVE receivers that accept an inbound transfer and credit the
    // balance, and the change fix reached them one at a time as each was rediscovered:
    //
    //     JettonInternalTransfer                       standard TEP-74, wallets and DEX routers
    //     ATHInternalTransfer                          every protocol payout: vesting, MSS, airdrop, registries
    //     ATHInternalTransferWithNotify                notify lane
    //     ATHInternalTransferRegistryMintUsername      name purchases — ~53,000,000 buried per mint
    //     ATHInternalTransferRegistryProfileAvatar     avatar purchases
    //
    // Listing them here would rot the moment a sixth appears, so they are derived: a receiver that credits
    // self.balance is a lane, and a lane must hand back what it does not need.
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
    // AirdropPool does not import ATHWallet.tact, so it carries its own copy of the message. A mirrored opcode whose
    // field WIDTH drifted is a defect this project has already had, and it surfaces as a silent wrong-receiver run
    // rather than a compile error.
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
    // The first number that looked free, 0x41544809, is ATHMaster.DeployTreasurySupply. Collisions are invisible
    // until the wrong receiver runs, so the whole space is checked rather than the one new number.
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
