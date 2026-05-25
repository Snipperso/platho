import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, toNano, type Address } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  CapsuleHubPublishAck,
  WithdrawAth,
} from '../build/Vault/Vault_Vault';
import {
  AthTransferNotification,
  ATHTransferAck,
  ATHTransferFailed,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const ATH_WITHDRAWAL_ID_DOMAIN = 0x41574944n; // "AWID"
const UINT64_MOD = 1n << 64n;

function computeAthWithdrawalId(owner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_WITHDRAWAL_ID_DOMAIN, 32)
    .storeAddress(owner)
    .storeUint(queryId, 64)
    .endCell()
    .hash()
    .toString('hex')) % UINT64_MOD;
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const officialAthWallet = await blockchain.treasury('vault-auth-official-ath-wallet');
  const capsuleHub = await blockchain.treasury('vault-auth-capsulehub');
  const attacker = await blockchain.treasury('vault-auth-attacker');
  const user = await blockchain.treasury('vault-auth-user');
  const recipient = await blockchain.treasury('vault-auth-recipient');

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
    recipient,
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

  it('VAULT-AUTH-NEG-02: forged ATH withdrawal callbacks cannot clear or restore a live pending withdrawal', async () => {
    const { vault, officialAthWallet, attacker, user, recipient } = await setup();
    const clientQueryId = 77n;
    const withdrawalId = computeAthWithdrawalId(user.address, clientQueryId);

    await vault.send(officialAthWallet.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotification',
      query_id: 11n,
      amount: 1_000n,
      sender_key: 0n,
      sender_wallet: user.address,
    } as AthTransferNotification);
    await vault.send(user.getSender(), { value: toNano('0.04') }, {
      $$type: 'WithdrawAth',
      query_id: clientQueryId,
      amount: 400n,
      recipient: recipient.address,
    } as WithdrawAth);

    const afterWithdraw = await vault.getGetUser(user.address);
    expect(afterWithdraw.ath_balance).toBe(600n);
    expect((await vault.getGetPendingAthWithdrawal(withdrawalId)).exists).toBe(true);

    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: withdrawalId,
      amount: 400n,
    } as ATHTransferAck);
    await vault.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: withdrawalId,
      amount: 400n,
    } as ATHTransferFailed);
    await vault.send(officialAthWallet.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: withdrawalId,
      amount: 401n,
    } as ATHTransferFailed);

    expect((await vault.getGetPendingAthWithdrawal(withdrawalId)).exists).toBe(true);
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(600n);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(1n);

    await vault.send(officialAthWallet.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: withdrawalId,
      amount: 400n,
    } as ATHTransferFailed);

    expect((await vault.getGetPendingAthWithdrawal(withdrawalId)).exists).toBe(false);
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(1_000n);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
  });
});
