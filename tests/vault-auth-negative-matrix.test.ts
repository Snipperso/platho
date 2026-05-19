import { describe, expect, it } from 'vitest';
import { contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  CapsuleHubPublishAck,
} from '../build/Vault/Vault_Vault';
import {
  AthTransferNotification,
  ATHTransferAck,
  ATHTransferFailed,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const officialAthWallet = await blockchain.treasury('vault-auth-official-ath-wallet');
  const capsuleHub = await blockchain.treasury('vault-auth-capsulehub');
  const attacker = await blockchain.treasury('vault-auth-attacker');
  const user = await blockchain.treasury('vault-auth-user');

  const init = await Vault.init(officialAthWallet.address, officialAthWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));

  return {
    vault: blockchain.openContract(new Vault(address, init)),
    officialAthWallet,
    capsuleHub,
    attacker,
    user,
  };
}

describe('Vault negative authorization matrix', () => {
  it('VAULT-AUTH-NEG-01: forged ATH and CapsuleHub callbacks cannot mutate Vault state', async () => {
    const { vault, attacker, user } = await setup();

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotification',
      query_id: 1n,
      amount: 1_000n,
      sender_key: 0n,
      sender_wallet: user.address,
    } as AthTransferNotification);
    expect((await vault.getGetUser(user.address)).exists).toBe(false);
    expect((await vault.getGetGlobal()).processed_ath_deposit_count).toBe(0n);

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 2n,
      amount: 1_000n,
    } as ATHTransferAck);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 3n,
      amount: 1_000n,
    } as ATHTransferFailed);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await vault.getGetUser(user.address)).exists).toBe(false);

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'CapsuleHubPublishAck',
      publish_id: 4n,
      entry_id: 1n,
      entry_uid: 2n,
    } as CapsuleHubPublishAck);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await vault.getGetGlobal()).airdrop_distributed_ath).toBe(0n);
  });
});
