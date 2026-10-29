import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const APP = readFileSync('web/app.js', 'utf8');
const TX = readFileSync('web/pwa-contract-transactions.mjs', 'utf8');

function exported(name: string): bigint {
  const m = TX.match(new RegExp(`export const ${name} = ([0-9_]+)n;`));
  if (!m) throw new Error(`${name} is not exported from web/pwa-contract-transactions.mjs`);
  return BigInt(m[1].replace(/_/g, ''));
}

describe('fee estimate matches the send', () => {
  it('PVSEND-01: the username mint estimator returns exactly what the mint asks the wallet to sign', () => {
    const request = exported('USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS');
    expect(request).toBeGreaterThan(0n);

    expect(APP).toMatch(/function estimatedUsernameMintTonFeeNanotons\(\) \{\n(?:.*\n)*?\s*return USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS \+ topUp \+ walletSendFeeReserveNanotons\(topUp > 0n \? \[1, 1\] : \[\]\);/);
    expect(APP).toContain("const topUp = athRequestTopUpBoundNanotons('mint');");
    expect(APP).toContain('const USERNAME_MINT_DIRECT_REQUEST_VALUE = USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS;');
    expect(APP).toContain('valueNanotons: USERNAME_MINT_DIRECT_REQUEST_VALUE');
  });

  it('PVSEND-02: the avatar estimator adds exactly what the avatar write asks the wallet to sign', () => {
    const request = exported('PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS');
    expect(request).toBeGreaterThan(0n);

    const body = (name: string) => { const from = APP.indexOf(`function ${name}(`); return APP.slice(from, APP.indexOf('\n}\n', from)); };
    expect(body('estimatedProfileAvatarTonFeeNanotons')).toContain('+ PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS');
    expect(body('profileAvatarFloorNanotons')).toContain('+ PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS');
    expect(APP).toContain('const PROFILE_AVATAR_DIRECT_REQUEST_VALUE = PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS;');
    expect(APP).toContain('valueNanotons: PROFILE_AVATAR_DIRECT_REQUEST_VALUE');
  });

  it('PVSEND-03: no client constant still describes itself in terms of the deleted Vault', () => {
    const live = readFileSync('web/pwa-contract-transactions.mjs', 'utf8')
      .split('\n')
      .filter((l) => /^export const \w*VAULT\w*_(TON_CHARGE|NOTIFY_VALUE)\w*\s*=/.test(l));
    expect(live, `these name a contract that no longer exists:\n${live.join('\n')}`).toEqual([]);
  });
});
