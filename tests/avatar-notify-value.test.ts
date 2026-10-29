import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PROFILE_AVATAR_DIRECT_NOTIFY_VALUE_NANOTONS as NOTIFY,
  PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS as REQUEST,
  PROFILE_AVATAR_MAX_PARTS,
} from '../web/pwa-contract-transactions.mjs';


const ATH_WALLET = readFileSync('contracts/ATHWallet.tact', 'utf8');
const constOf = (name: string) => {
  const m = new RegExp(`const ${name}: Int = (\\d+);`).exec(ATH_WALLET);
  if (!m) throw new Error(`contracts/ATHWallet.tact no longer declares ${name}`);
  return BigInt(m[1]);
};

describe('avatar purchase TON values', () => {
  it('AVNOTIFY-01: the notify value keeps a REFUSED purchase whole to ~10x today\'s prices', () => {
    const overheadAt10x = 66_000_000n - 2_250_000n;
    const payerFloor = constOf('ATH_INTERNAL_TRANSFER_EXEC_RESERVE') + constOf('ATH_INTERNAL_TRANSFER_ACK_VALUE')
      + constOf('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE') + constOf('ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT');
    expect(payerFloor, 'the payer floor is the frozen wallet\'s 14212').toBe(29_000_000n);
    expect(NOTIFY - overheadAt10x >= payerFloor, `notify ${NOTIFY} must leave ${payerFloor} arriving at 10x`).toBe(true);
    expect(NOTIFY >= constOf('ATH_TRANSFER_NOTIFY_MIN_VALUE'), 'and clear the wallet\'s own 14656').toBe(true);
  });

  it('AVNOTIFY-02: the request covers what the buyer\'s own wallet demands for that notify (gate 14657)', () => {
    const required = NOTIFY + constOf('ATH_REGISTRY_RESPONSE_ACK_VALUE') + constOf('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE')
      + constOf('ATH_TRANSFER_NOTIFY_EXEC_RESERVE') + constOf('ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT')
      + constOf('ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE') + constOf('ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE');
    expect(REQUEST >= required, `request ${REQUEST} must cover ${required}`).toBe(true);
  });

  it('AVNOTIFY-03: the client refuses more parts than BOTH registries accept, before anything is signed', () => {
    for (const file of ['contracts/ProfileRegistry.tact', 'contracts18/contracts/ProfileRegistry.tact']) {
      let text: string;
      try { text = readFileSync(file, 'utf8'); } catch { continue; }
      const m = /const PROFILE_AVATAR_MAX_PARTS: Int = (\d+);/.exec(text);
      expect(m, `${file} declares the cap`).not.toBeNull();
      expect(BigInt(m![1]), `${file}'s cap is the client's`).toBe(BigInt(PROFILE_AVATAR_MAX_PARTS));
    }
    const app = readFileSync('web/app.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    expect(app, 'the avatar submit guards on the registries\' cap').toContain('if (parts.length > PROFILE_AVATAR_MAX_PARTS) throw');
    expect(app, 'and no longer on the PUBLIC lane\'s 16').not.toContain('if (parts.length > 16) throw');
  });
});
