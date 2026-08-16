import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// CLASS GUARD 2 of 3. The defect: a constant lives in BOTH a contract (or a send path) and a client copy, the two drift
// apart, and nothing notices because contract tests stay green while production diverges.
//
// Caught three times in one week before this sweep — RS_MIN_VALUE, PUBLIC_AVATAR_PUBLISH_VALUE, FA_BUYBACK — each time
// by accident, each time fixed as an instance. The sweep then found a fourth and different shape: the two fee
// ESTIMATORS in app.js were reading Vault-era constants for a contract clean-17 had DELETED, while the live direct-pay
// send paths attached entirely different values. The user was shown 0.617 GRAM for a name and handed a 1.1 GRAM
// signing request (78% off), and 0.115 against 0.2 for an avatar (74% off). Nobody loses funds to that, but it is the
// number a user reads on the screen where they decide whether to trust the app.
//
// So: the estimator and the send must read the SAME exported constant. This asserts they do, by source, because there
// is no runtime in a test that can observe the wallet-signing dialog.

const APP = readFileSync('web/app.js', 'utf8');
const TX = readFileSync('web/pwa-contract-transactions.mjs', 'utf8');

/** The value of an exported bigint constant, read out of the module that owns it. */
function exported(name: string): bigint {
  // `\\d` is doubled deliberately: inside a template literal a single backslash collapses and the pattern silently
  // becomes `(d+)`, matching nothing — a trap this repo has hit three times.
  const m = TX.match(new RegExp(`export const ${name} = ([0-9_]+)n;`));
  if (!m) throw new Error(`${name} is not exported from web/pwa-contract-transactions.mjs`);
  return BigInt(m[1].replace(/_/g, ''));
}

describe('fee estimate matches the send', () => {
  it('PVSEND-01: the username mint estimator returns exactly what the mint asks the wallet to sign', () => {
    const request = exported('USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS');
    expect(request).toBeGreaterThan(0n);

    // The estimator must return the exported constant itself, not a copy of its digits. Since 2026-08-16 it also adds
    // walletSendFeeNanotons — what the network charges the wallet to SEND the request, which no quote in this app used
    // to count (tests/wallet-send-fee.test.ts). The constant must still be the base it builds on.
    expect(APP).toMatch(/function estimatedUsernameMintTonFeeNanotons\(\) \{\n(?:.*\n)*?\s*return USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS \+ walletSendFeeNanotons\(\[\]\);/);
    // And the send path must attach that same constant.
    expect(APP).toContain('const USERNAME_MINT_DIRECT_REQUEST_VALUE = USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS;');
    expect(APP).toContain('valueNanotons: USERNAME_MINT_DIRECT_REQUEST_VALUE');
  });

  it('PVSEND-02: the avatar estimator adds exactly what the avatar write asks the wallet to sign', () => {
    const request = exported('PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS');
    expect(request).toBeGreaterThan(0n);

    expect(APP).toContain('+ PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS;');
    expect(APP).toContain('const PROFILE_AVATAR_DIRECT_REQUEST_VALUE = PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS;');
    expect(APP).toContain('valueNanotons: PROFILE_AVATAR_DIRECT_REQUEST_VALUE');
  });

  it('PVSEND-03: no client constant still describes itself in terms of the deleted Vault', () => {
    // The Vault was removed from clean-17 entirely. A live constant named after it is, by construction, a copy of a
    // number nobody can check any more — which is exactly how the two estimators came to be wrong.
    const live = readFileSync('web/pwa-contract-transactions.mjs', 'utf8')
      .split('\n')
      .filter((l) => /^export const \w*VAULT\w*_(TON_CHARGE|NOTIFY_VALUE)\w*\s*=/.test(l));
    expect(live, `these name a contract that no longer exists:\n${live.join('\n')}`).toEqual([]);
  });
});
