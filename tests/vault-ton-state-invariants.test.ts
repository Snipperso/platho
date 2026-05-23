import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  DepositTon,
  WithdrawTon,
} from '../build/Vault/Vault_Vault';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vault-ton-invariant-user');
  const recipient = await blockchain.treasury('vault-ton-invariant-recipient');
  const athWallet = await blockchain.treasury('vault-ton-invariant-ath-wallet');
  const capsuleHub = await blockchain.treasury('vault-ton-invariant-capsulehub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  return { vault: blockchain.openContract(new Vault(address, init)), user, recipient };
}

describe('Vault TON accounting invariants without publish sessions', () => {
  it('VAULT-INV-TON-01: deterministic deposit/withdraw walk preserves internal TON accounting', async () => {
    const { vault, user, recipient } = await setup();
    let expected = 0n;

    for (const amount of [toNano('0.1'), toNano('0.2'), toNano('0.05')]) {
      await vault.send(user.getSender(), { value: amount + toNano('0.05') }, {
        $$type: 'DepositTon',
        amount,
      } as DepositTon);
      expected += amount;
      expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);
    }

    await vault.send(user.getSender(), { value: toNano('0.01') }, {
      $$type: 'WithdrawTon',
      amount: toNano('0.12'),
      recipient: recipient.address,
    } as WithdrawTon);
    expected -= toNano('0.12');
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);

    await vault.send(user.getSender(), { value: toNano('0.01') }, {
      $$type: 'WithdrawTon',
      amount: toNano('1'),
      recipient: recipient.address,
    } as WithdrawTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);
  });
});
