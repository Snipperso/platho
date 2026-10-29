import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHWallet, ATHTransferRequestWithNotify } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockGasBurnNotifyOwner } from '../build/MockGasBurnNotifyOwner/MockGasBurnNotifyOwner_MockGasBurnNotifyOwner';


const MASTER = new Address(0, createHash('sha256').update('PLATHO.W1004.MASTER').digest());
const N = 1_000_000_000n;
const NOTIFY_MIN = 45_000_000n;

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

  const mockInit = await MockGasBurnNotifyOwner.init(BigInt(burnIters));
  const mockAddr = contractAddress(0, mockInit);
  await bc.setShardAccount(mockAddr, createShardAccount({
    address: mockAddr, code: mockInit.code, data: mockInit.data, balance: toNano('1'), workchain: 0,
  }));

  const aliceWallet = await deployWallet(bc, alice, N);
  const malloryWallet = await deployWallet(bc, mockAddr, 0n);

  await aliceWallet.send(bc.sender(alice), { value: toNano('0.5') }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: 1n,
    amount: N,
    recipient: mockAddr,
    response_destination: alice,
    notify_destination: mockAddr,
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
    expect(rows.length).toBe(12);
    // eslint-disable-next-line no-console
    console.log(`[W1004-SWEEP] theft window observed: ${theftSeen}`);
  }, 300_000);
});
