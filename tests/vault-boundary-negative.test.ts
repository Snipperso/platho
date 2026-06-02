import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { findTransaction } from '@ton/test-utils';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import {
  Vault,
  BindOfficialAthWallet,
  BindProfileRegistry,
  BindUsernameRegistry,
  SealGenesis,
  DepositTon,
  WithdrawTon,
  RegisterMessagingKeys,
  CreateReceiveIntent,
  ClaimReceiveIntent,
  WithdrawAth,
  AthTransferNotification,
} from '../build/Vault/Vault_Vault';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const USER_STATE_STORAGE_ENDOWMENT = 10_000_000n;
const DEPOSIT_TON_EXEC_RESERVE = 2_000_000n;
const WITHDRAW_TON_EXEC_RESERVE = 2_000_000n;
const STATE_GROWTH_EXEC_RESERVE = 2_000_000n;
const KEY_RECORD_STANDARD_STORAGE_ENDOWMENT = 30_000_000n;
const RECEIVE_INTENT_STORAGE_ENDOWMENT = 5_000_000n;
const VAULT_ATH_WITHDRAW_MIN_VALUE = 40_000_000n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;
const ASSET_TON = 1n;

const ENC = 0x1000000000000000000000000000000000000000000000000000000000000001n;
const SIG = 0x2000000000000000000000000000000000000000000000000000000000000002n;

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.BOUNDARY.${label}`).digest());
}

async function athWalletAddress(owner: Address, athMaster: Address): Promise<Address> {
  const init = await ATHWallet.init(0n, owner, athMaster);
  return contractAddress(owner.workChain, init);
}

async function deployAthWallet(
  blockchain: Blockchain,
  owner: Address,
  athMaster: Address,
  athBalance: bigint,
  tonBalance = toNano('1'),
) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(athBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: tonBalance,
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function setupPlain() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const user = await blockchain.treasury('vault-boundary-user');
  const recipient = await blockchain.treasury('vault-boundary-recipient');
  const athWallet = await blockchain.treasury('vault-boundary-ath-wallet');
  const capsuleHub = await blockchain.treasury('vault-boundary-capsulehub');
  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  return { blockchain, vault: blockchain.openContract(new Vault(address, init)), user, recipient, athWallet };
}

async function setupAth() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const controller = await blockchain.treasury('vault-boundary-ath-controller');
  const user = await blockchain.treasury('vault-boundary-ath-user');
  const recipient = await blockchain.treasury('vault-boundary-ath-recipient');
  const capsuleHub = await blockchain.treasury('vault-boundary-ath-capsulehub');
  const athMaster = fixtureAddress('VAULT_ATH_MASTER');
  const vaultInit = await Vault.init(
    controller.address,
    athMaster,
    capsuleHub.address,
    addressHash(controller.address),
    true,
    false,
    0n,
  );
  const vaultAddress = contractAddress(0, vaultInit);
  const officialVaultAthWallet = await athWalletAddress(vaultAddress, athMaster);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('2'),
    workchain: vaultAddress.workChain,
  }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialVaultAthWallet,
  } as BindOfficialAthWallet);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: fixtureAddress('VAULT_BOUNDARY_PROFILE_REGISTRY'),
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress('VAULT_BOUNDARY_USERNAME_REGISTRY'),
  } as BindUsernameRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);
  const userAthWallet = await deployAthWallet(blockchain, user.address, athMaster, 5_000n);
  return { blockchain, vault, user, recipient, athMaster, userAthWallet, officialVaultAthWallet };
}

async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + USER_STATE_STORAGE_ENDOWMENT + DEPOSIT_TON_EXEC_RESERVE }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function inboundValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') throw new Error('missing inbound internal value');
  return info.value.coins;
}

async function depositAth(params: {
  vault: any;
  user: any;
  userAthWallet: any;
  amount: bigint;
  queryId: bigint;
  notifyValue: bigint;
}) {
  await params.userAthWallet.send(params.user.getSender(), { value: toNano('0.25') }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: params.queryId,
    amount: params.amount,
    recipient: params.vault.address,
    response_destination: params.user.address,
    notify_destination: params.vault.address,
    notify_value: params.notifyValue,
  } as ATHTransferRequestWithNotify);
}

describe('Vault value/storage boundary negative matrix', () => {
  it('VAULT-BND-01: DepositTon rejects exactly below storage/value thresholds and accepts exact thresholds', async () => {
    const { vault, user } = await setupPlain();
    const amount = 1_000_000n;

    await vault.send(user.getSender(), { value: amount + USER_STATE_STORAGE_ENDOWMENT + DEPOSIT_TON_EXEC_RESERVE - 1n }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    expect((await vault.getGetUser(user.address)).exists).toBe(false);

    await vault.send(user.getSender(), { value: amount + USER_STATE_STORAGE_ENDOWMENT + DEPOSIT_TON_EXEC_RESERVE }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount);

    await vault.send(user.getSender(), { value: amount + DEPOSIT_TON_EXEC_RESERVE - 1n }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount);

    await vault.send(user.getSender(), { value: amount + DEPOSIT_TON_EXEC_RESERVE }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount * 2n);
  });

  it('VAULT-BND-01B: DepositTon caller-funded reserve keeps credited TON liability backed', async () => {
    const { blockchain, vault, user } = await setupPlain();
    const amount = 1_000_000n;

    let before = await contractBalance(blockchain, vault.address);
    await vault.send(user.getSender(), { value: amount + USER_STATE_STORAGE_ENDOWMENT + DEPOSIT_TON_EXEC_RESERVE }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    let after = await contractBalance(blockchain, vault.address);
    expect(after - before).toBeGreaterThanOrEqual(amount);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount);

    await vault.send(user.getSender(), { value: amount }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount);

    before = await contractBalance(blockchain, vault.address);
    await vault.send(user.getSender(), { value: amount + DEPOSIT_TON_EXEC_RESERVE }, {
      $$type: 'DepositTon',
      amount,
    } as DepositTon);
    after = await contractBalance(blockchain, vault.address);
    expect(after - before).toBeGreaterThanOrEqual(amount);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount * 2n);
  });

  it('VAULT-BND-01C: WithdrawTon requires caller-funded reserve and does not spend Vault backing on fees', async () => {
    const { blockchain, vault, user, recipient } = await setupPlain();
    const amount = 50_000_000n;
    await depositTon(vault, user, amount);

    await vault.send(user.getSender(), { value: WITHDRAW_TON_EXEC_RESERVE - 1n }, {
      $$type: 'WithdrawTon',
      amount,
      recipient: recipient.address,
    } as WithdrawTon);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount);

    const beforeVaultBalance = await contractBalance(blockchain, vault.address);
    const withdraw = await vault.send(user.getSender(), { value: WITHDRAW_TON_EXEC_RESERVE }, {
      $$type: 'WithdrawTon',
      amount,
      recipient: recipient.address,
    } as WithdrawTon);
    const afterVaultBalance = await contractBalance(blockchain, vault.address);
    const recipientTx = findTransaction(withdraw.transactions, {
      from: vault.address,
      to: recipient.address,
      success: true,
    });

    expect(recipientTx).toBeDefined();
    expect(inboundValue(recipientTx)).toBe(amount);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(0n);
    expect(beforeVaultBalance - afterVaultBalance).toBeLessThanOrEqual(amount);
  });

  it('VAULT-BND-01D: WithdrawTon to the Vault itself is rejected before debiting internal TON', async () => {
    const { vault, user } = await setupPlain();
    const amount = 50_000_000n;
    await depositTon(vault, user, amount);

    await vault.send(user.getSender(), { value: WITHDRAW_TON_EXEC_RESERVE }, {
      $$type: 'WithdrawTon',
      amount,
      recipient: vault.address,
    } as WithdrawTon);

    expect((await vault.getGetUser(user.address)).ton_balance).toBe(amount);
  });

  it('VAULT-BND-02: RegisterMessagingKeys honors exact storage boundaries', async () => {
    const lowKeys = await setupPlain();
    const keyRequired = USER_STATE_STORAGE_ENDOWMENT + KEY_RECORD_STANDARD_STORAGE_ENDOWMENT + STATE_GROWTH_EXEC_RESERVE;
    await lowKeys.vault.send(lowKeys.user.getSender(), { value: keyRequired - 1n }, {
      $$type: 'RegisterMessagingKeys',
      ...hybridMessagingKeyFields(ENC, SIG),
    } as RegisterMessagingKeys);
    expect((await lowKeys.vault.getGetGlobal()).key_record_count).toBe(0n);
    expect((await lowKeys.vault.getGetUser(lowKeys.user.address)).exists).toBe(false);

    const exactKeys = await setupPlain();
    await exactKeys.vault.send(exactKeys.user.getSender(), { value: keyRequired }, {
      $$type: 'RegisterMessagingKeys',
      ...hybridMessagingKeyFields(ENC, SIG),
    } as RegisterMessagingKeys);
    expect((await exactKeys.vault.getGetGlobal()).key_record_count).toBe(1n);
    expect((await exactKeys.vault.getGetUser(exactKeys.user.address)).current_key_id).not.toBe(0n);
  });

  it('VAULT-BND-03: ReceiveIntent create and new-recipient claim reject min-1 and accept exact storage values', async () => {
    const { vault, user, recipient } = await setupPlain();
    const amount = toNano('0.2');
    await depositTon(vault, user, toNano('1'));

    const intentId = await vault.getGetReceiveIntentId(user.address, recipient.address, ASSET_TON, amount, 7n);
    const secret = 0x7777n;
    const commitment = await vault.getGetReceiveIntentCommitment(intentId, recipient.address, secret);

    const createIntentRequired = RECEIVE_INTENT_STORAGE_ENDOWMENT + STATE_GROWTH_EXEC_RESERVE;
    await vault.send(user.getSender(), { value: createIntentRequired - 1n }, {
      $$type: 'CreateReceiveIntent',
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment,
      client_nonce: 7n,
    } as CreateReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('1'));

    await vault.send(user.getSender(), { value: createIntentRequired }, {
      $$type: 'CreateReceiveIntent',
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment,
      client_nonce: 7n,
    } as CreateReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('0.8'));

    const claimNewUserRequired = USER_STATE_STORAGE_ENDOWMENT + STATE_GROWTH_EXEC_RESERVE;
    await vault.send(recipient.getSender(), { value: claimNewUserRequired - 1n }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: secret,
    } as ClaimReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(recipient.address)).exists).toBe(false);

    await vault.send(recipient.getSender(), { value: claimNewUserRequired }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: secret,
    } as ClaimReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetUser(recipient.address)).ton_balance).toBe(amount);
  });

  it('VAULT-BND-04: ATH notify and withdraw reject min-1 and accept exact value boundaries', async () => {
    const { blockchain, vault, user, recipient, athMaster, userAthWallet, officialVaultAthWallet } = await setupAth();
    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));

    await depositAth({
      vault,
      user,
      userAthWallet,
      amount: 1_000n,
      queryId: 10n,
      notifyValue: ATH_TRANSFER_NOTIFY_MIN_VALUE - 1n,
    });
    expect((await vault.getGetUser(user.address)).exists).toBe(false);
    expect((await userAthWallet.getGetWalletData()).balance).toBe(5_000n);

    await depositAth({
      vault,
      user,
      userAthWallet,
      amount: 2_000n,
      queryId: 11n,
      notifyValue: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    });
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(2_000n);

    await vault.send(user.getSender(), { value: VAULT_ATH_WITHDRAW_MIN_VALUE - 1n }, {
      $$type: 'WithdrawAth',
      query_id: 20n,
      amount: 750n,
      recipient: recipient.address,
    } as WithdrawAth);
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    expect((await vault.getGetPendingAthWithdrawal(20n)).exists).toBe(false);
    expect((await officialWallet.getGetWalletData()).balance).toBe(2_000n);

    await vault.send(user.getSender(), { value: VAULT_ATH_WITHDRAW_MIN_VALUE }, {
      $$type: 'WithdrawAth',
      query_id: 21n,
      amount: 750n,
      recipient: recipient.address,
    } as WithdrawAth);
    const recipientAthWalletAddress = await athWalletAddress(recipient.address, athMaster);
    const recipientAthWallet = blockchain.openContract(new ATHWallet(recipientAthWalletAddress));
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(1_250n);
    expect((await vault.getGetPendingAthWithdrawal(21n)).exists).toBe(false);
    expect((await officialWallet.getGetWalletData()).balance).toBe(1_250n);
    expect((await recipientAthWallet.getGetWalletData()).balance).toBe(750n);
    expect((await vault.getGetUser(user.address)).ton_balance).toBeGreaterThan(0n);
  });

  it('VAULT-BND-04B: WithdrawAth to the Vault itself is rejected before debiting internal ATH', async () => {
    const { blockchain, vault, user, userAthWallet, officialVaultAthWallet } = await setupAth();
    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));

    await depositAth({
      vault,
      user,
      userAthWallet,
      amount: 2_000n,
      queryId: 30n,
      notifyValue: ATH_TRANSFER_NOTIFY_MIN_VALUE,
    });
    const beforeUser = await vault.getGetUser(user.address);
    const beforeOfficial = await officialWallet.getGetWalletData();

    await vault.send(user.getSender(), { value: VAULT_ATH_WITHDRAW_MIN_VALUE }, {
      $$type: 'WithdrawAth',
      query_id: 31n,
      amount: 750n,
      recipient: vault.address,
    } as WithdrawAth);

    const afterUser = await vault.getGetUser(user.address);
    const afterOfficial = await officialWallet.getGetWalletData();
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect(afterOfficial.balance).toBe(beforeOfficial.balance);
    expect((await vault.getGetPendingAthWithdrawalFor(user.address, 31n)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
  });

  it('VAULT-BND-05: ATH withdrawals scope pending ids by owner wallet, not only client query_id', async () => {
    const { blockchain, vault, user, recipient, athWallet } = await setupPlain();
    const user2 = await blockchain.treasury('vault-boundary-ath-user-2');
    const clientQueryId = 777n;

    await vault.send(athWallet.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotification',
      query_id: 1n,
      amount: 1_000n,
      sender_key: 0n,
      sender_wallet: user.address,
    } as AthTransferNotification);
    await vault.send(athWallet.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotification',
      query_id: 2n,
      amount: 1_000n,
      sender_key: 0n,
      sender_wallet: user2.address,
    } as AthTransferNotification);

    await vault.send(user.getSender(), { value: VAULT_ATH_WITHDRAW_MIN_VALUE }, {
      $$type: 'WithdrawAth',
      query_id: clientQueryId,
      amount: 100n,
      recipient: recipient.address,
    } as WithdrawAth);
    await vault.send(user2.getSender(), { value: VAULT_ATH_WITHDRAW_MIN_VALUE }, {
      $$type: 'WithdrawAth',
      query_id: clientQueryId,
      amount: 100n,
      recipient: recipient.address,
    } as WithdrawAth);

    const pending1 = await vault.getGetPendingAthWithdrawalFor(user.address, clientQueryId);
    const pending2 = await vault.getGetPendingAthWithdrawalFor(user2.address, clientQueryId);
    expect(pending1.exists).toBe(true);
    expect(pending2.exists).toBe(true);
    expect(pending1.owner_wallet.toString()).toBe(user.address.toString());
    expect(pending2.owner_wallet.toString()).toBe(user2.address.toString());
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(2n);
  });

  it('VAULT-BND-06: packed profile/username pending counters are capped before lane overflow', () => {
    const source = readFileSync('contracts/Vault.tact', 'utf8').replace(/\s+/g, ' ');

    expect(source).toContain('const VAULT_PENDING_PROFILE_COUNT_MAX: Int = 65535;');
    expect(source).toContain('const VAULT_PENDING_USERNAME_COUNT_MAX: Int = 65535;');
    expect(source).toMatch(/fun incrementPendingProfileAvatarPaymentCount\(\) \{ throwUnless\(16690, self\.pendingProfileAvatarPaymentCount\(\) < VAULT_PENDING_PROFILE_COUNT_MAX\); self\.pending_publish_count \+= VAULT_PENDING_PROFILE_COUNT_UNIT; \}/);
    expect(source).toMatch(/fun incrementPendingUsernameMintPaymentCount\(\) \{ throwUnless\(16790, self\.pendingUsernameMintPaymentCount\(\) < VAULT_PENDING_USERNAME_COUNT_MAX\); self\.pending_publish_count \+= VAULT_PENDING_USERNAME_COUNT_UNIT; \}/);
  });
});
