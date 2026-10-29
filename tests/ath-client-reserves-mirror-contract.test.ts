import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ATH_WALLET_RESERVES_NANOTONS, estimateAthWalletAttachedValueNanotons }
  from '../web/pwa-contract-transactions.mjs';


const SRC = readFileSync('contracts/ATHWallet.tact', 'utf8');

function contractConst(name: string): bigint {
  const m = SRC.match(new RegExp(`const\\s+${name}\\s*:\\s*Int\\s*=\\s*(\\d+)\\s*;`));
  if (!m) throw new Error(`contract constant ${name} not found — it was renamed or removed, and the client mirror `
    + 'is now pointing at nothing');
  return BigInt(m[1]);
}

const MIRROR: Record<string, string> = {
  transferNotifyAckValue: 'ATH_TRANSFER_NOTIFY_ACK_VALUE',
  internalTransferAckValue: 'ATH_INTERNAL_TRANSFER_ACK_VALUE',
  internalTransferSourceAckValue: 'ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE',
  internalTransferFwdFeeAllowance: 'ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE',
  transferNotifyMinValue: 'ATH_TRANSFER_NOTIFY_MIN_VALUE',
  transferNotifyStorageEndowment: 'ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT',
  internalTransferExec: 'ATH_INTERNAL_TRANSFER_EXEC_RESERVE',
  burnNotificationExec: 'ATH_BURN_NOTIFICATION_EXEC_RESERVE',
  transferNotifyExec: 'ATH_TRANSFER_NOTIFY_EXEC_RESERVE',
  ownerRequestExec: 'ATH_OWNER_REQUEST_EXEC_RESERVE',
  notifyOwnerRequestExec: 'ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE',
};

describe('the client quotes what the contract actually demands', () => {
  it('ATH-MIRROR-01: every mirrored reserve equals the contract constant it copies', () => {
    const drift: string[] = [];
    for (const [field, constant] of Object.entries(MIRROR)) {
      const mirrored = (ATH_WALLET_RESERVES_NANOTONS as any)[field];
      expect(typeof mirrored, `the client must still declare ${field}`).toBe('bigint');
      const declared = contractConst(constant);
      if (mirrored !== declared) drift.push(`${field}=${mirrored} but ${constant}=${declared}`);
    }
    expect(drift, 'the client would attach the wrong value, and the contract would refuse it on arrival:\n'
      + drift.join('\n')).toEqual([]);
  });

  it('ATH-MIRROR-02: every reserve the client keeps is one the contract still has', () => {
    const unmapped = Object.keys(ATH_WALLET_RESERVES_NANOTONS).filter((k) => !(k in MIRROR));
    expect(unmapped, 'these client reserves are not mapped to a contract constant, so nothing checks them:\n'
      + unmapped.join('\n')).toEqual([]);
  });

  it('ATH-MIRROR-04: the plain transfer quote clears gate 14204, computed from the contract', () => {
    const required = contractConst('ATH_OWNER_REQUEST_EXEC_RESERVE')
      + contractConst('ATH_INTERNAL_TRANSFER_EXEC_RESERVE')
      + contractConst('ATH_INTERNAL_TRANSFER_ACK_VALUE')
      + contractConst('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE')
      + contractConst('ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT')
      + contractConst('ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE');

    const gate = SRC.match(/receive\(msg: ATHTransferRequest\)[\s\S]*?let required_value: Int = ([^;]+);/);
    expect(gate, 'ATHTransferRequest must still compute a required_value').toBeTruthy();
    for (const term of ['ATH_OWNER_REQUEST_EXEC_RESERVE', 'ATH_INTERNAL_TRANSFER_ARRIVAL_MIN',
      'ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE']) {
      expect(gate![1], `gate 14204 must still be composed from ${term}`).toContain(term);
    }
    const arrival = SRC.match(/const ATH_INTERNAL_TRANSFER_ARRIVAL_MIN: Int = ([^;]+);/);
    expect(arrival, 'the arrival floor must still be a named quantity').toBeTruthy();
    expect(arrival![1], 'and it must still include the source ack — the term the client copy once dropped')
      .toContain('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE');

    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequest'),
      'the app attaches this for an ordinary ATH transfer; below gate 14204 every one of them is refused')
      .toBe(required);
  });

  it('ATH-MIRROR-03: the notify quote clears gate 14307, computed from the contract', () => {
    const notify = contractConst('ATH_TRANSFER_NOTIFY_MIN_VALUE');
    const required = notify
      + contractConst('ATH_TRANSFER_NOTIFY_ACK_VALUE')
      + contractConst('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE')
      + contractConst('ATH_TRANSFER_NOTIFY_EXEC_RESERVE')
      + contractConst('ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT')
      + contractConst('ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE');

    const helper = SRC.match(/fun notify_transfer_value\(notify_value: Int\): Int \{\s*return ([^;]+);/);
    expect(helper, 'notify_transfer_value must still exist').toBeTruthy();
    for (const term of ['ATH_TRANSFER_NOTIFY_ACK_VALUE', 'ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE',
      'ATH_TRANSFER_NOTIFY_EXEC_RESERVE', 'ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT']) {
      expect(helper![1], `notify_transfer_value must still include ${term}`).toContain(term);
    }

    expect(estimateAthWalletAttachedValueNanotons('ATHTransferRequestWithNotify', { notify_value: notify }),
      'the client quote must reach what gate 14307 demands').toBe(required);
  });
});
