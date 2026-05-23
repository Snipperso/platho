import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  DepositTon,
  WithdrawTon,
} from '../build/Vault/Vault_Vault';

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('vault-user');
  const athWallet = await blockchain.treasury('vault-ath-wallet');
  const recipient = await blockchain.treasury('recipient');
  const attacker = await blockchain.treasury('attacker');
  const capsuleHub = await blockchain.treasury('capsule-hub');

  const genesisHash = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, genesisHash, true, true, 0n);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('1'),
      workchain: address.workChain,
    }),
  );

  const vault = blockchain.openContract(new Vault(address, init));
  return { vault, user, recipient, attacker };
}

async function deposit(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + toNano('0.1') }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

describe('Vault milestone 1: direct balances without publish sessions', () => {
  it('VAULT-HAPPY-01/02: first TON deposit creates UserState, later deposit does not create another user', async () => {
    const { vault, user } = await setup();
    const amount = toNano('1');

    await deposit(vault, user, amount);
    let state = await vault.getGetUser(user.address);
    expect(state.exists).toBe(true);
    expect(state.ton_balance).toBe(amount);
    expect(state.ath_balance).toBe(0n);
    expect(state.current_key_id).toBe(0n);
    expect((await vault.getGetGlobal()).user_count).toBe(1n);

    await deposit(vault, user, amount);
    state = await vault.getGetUser(user.address);
    expect(state.ton_balance).toBe(amount * 2n);
    expect((await vault.getGetGlobal()).user_count).toBe(1n);
  });

  it('VAULT-HAPPY-04/REJECT-02B: TON withdrawal debits balance and rejected overdraw cannot leave negative state', async () => {
    const { vault, user, recipient } = await setup();
    await deposit(vault, user, toNano('1'));

    const beforeRecipient = await recipient.getBalance();
    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'WithdrawTon',
      amount: toNano('0.4'),
      recipient: recipient.address,
    } as WithdrawTon);

    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('0.6'));
    expect(await recipient.getBalance()).toBeGreaterThan(beforeRecipient);

    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'WithdrawTon',
      amount: toNano('2'),
      recipient: recipient.address,
    } as WithdrawTon);

    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('0.6'));
  });

  it('NO-ADMIN: empty fallback is rejected and cannot mutate Vault accounting', async () => {
    const { vault, attacker } = await setup();
    await vault.send(attacker.getSender(), { value: toNano('0.1') }, null);
    expect((await vault.getGetGlobal()).user_count).toBe(0n);
  });
});
