import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  DepositTon,
} from '../build/Vault/Vault_Vault';
import {
  registerVaultSigningKeys,
  sendVaultWithdrawTonExternal,
} from './helpers/vault-receive-intent-external';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const WITHDRAW_TON_EXEC_RESERVE = 2_000_000n;

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('vault-user');
  const athWallet = await blockchain.treasury('vault-ath-wallet');
  const recipient = await blockchain.treasury('recipient');
  const attacker = await blockchain.treasury('attacker');
  const capsuleHub = await blockchain.treasury('capsule-hub');

  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
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
  return { blockchain, vault, user, recipient, attacker };
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
    const { blockchain, vault, user, recipient } = await setup();
    const signingKey = await registerVaultSigningKeys(vault, user, 31);
    await deposit(vault, user, toNano('1'));

    const beforeRecipient = await recipient.getBalance();
    await sendVaultWithdrawTonExternal(blockchain, vault, user, signingKey, GENESIS_HASH, toNano('0.4'), recipient.address);

    let expected = toNano('1') - toNano('0.4') - WITHDRAW_TON_EXEC_RESERVE;
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);
    expect(await recipient.getBalance()).toBeGreaterThan(beforeRecipient);

    await sendVaultWithdrawTonExternal(blockchain, vault, user, signingKey, GENESIS_HASH, toNano('2'), recipient.address);
    expected -= WITHDRAW_TON_EXEC_RESERVE;

    expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);
  });

  it('NO-ADMIN: empty fallback is rejected and cannot mutate Vault accounting', async () => {
    const { vault, attacker } = await setup();
    await vault.send(attacker.getSender(), { value: toNano('0.1') }, null);
    expect((await vault.getGetGlobal()).user_count).toBe(0n);
  });
});
