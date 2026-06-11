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
  return { blockchain, vault: blockchain.openContract(new Vault(address, init)), user, recipient };
}

describe('Vault TON accounting invariants without publish sessions', () => {
  it('VAULT-INV-TON-01: deterministic deposit/withdraw walk preserves internal TON accounting', async () => {
    const { blockchain, vault, user, recipient } = await setup();
    const signingKey = await registerVaultSigningKeys(vault, user, 41);
    let expected = 0n;

    for (const amount of [toNano('0.1'), toNano('0.2'), toNano('0.05')]) {
      await vault.send(user.getSender(), { value: amount + toNano('0.05') }, {
        $$type: 'DepositTon',
        amount,
      } as DepositTon);
      expected += amount;
      expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);
    }

    await sendVaultWithdrawTonExternal(blockchain, vault, user, signingKey, GENESIS_HASH, toNano('0.12'), recipient.address);
    expected -= toNano('0.12') + WITHDRAW_TON_EXEC_RESERVE;
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);

    await sendVaultWithdrawTonExternal(blockchain, vault, user, signingKey, GENESIS_HASH, toNano('1'), recipient.address);
    expected -= WITHDRAW_TON_EXEC_RESERVE;
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(expected);
  });
});
