import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  BindOfficialAthWallet,
  SealGenesis,
  DepositTon,
  SetSession,
  RegisterMessagingKeys,
  CreateReceiveIntent,
  ClaimReceiveIntent,
  WithdrawAth,
} from '../build/Vault/Vault_Vault';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const USER_STATE_STORAGE_ENDOWMENT = 10_000_000n;
const DEPOSIT_TON_EXEC_RESERVE = 2_000_000n;
const SESSION_STATE_STORAGE_ENDOWMENT = 5_000_000n;
const KEY_RECORD_STANDARD_STORAGE_ENDOWMENT = 5_000_000n;
const RECEIVE_INTENT_STORAGE_ENDOWMENT = 5_000_000n;
const VAULT_ATH_WITHDRAW_MIN_VALUE = 30_000_000n;
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
  return { blockchain, vault: blockchain.openContract(new Vault(address, init)), user, recipient };
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

  it('VAULT-BND-02: SetSession and RegisterMessagingKeys honor exact storage boundaries', async () => {
    const lowSession = await setupPlain();
    const sessionRequired = USER_STATE_STORAGE_ENDOWMENT + SESSION_STATE_STORAGE_ENDOWMENT;
    await lowSession.vault.send(lowSession.user.getSender(), { value: sessionRequired - 1n }, {
      $$type: 'SetSession',
      session_pubkey: 0x1234n,
      expires_at: BigInt((lowSession.blockchain.now ?? 0) + 1000),
    } as SetSession);
    expect((await lowSession.vault.getGetUser(lowSession.user.address)).exists).toBe(false);
    expect((await lowSession.vault.getGetSession(lowSession.user.address)).exists).toBe(false);

    const exactSession = await setupPlain();
    await exactSession.vault.send(exactSession.user.getSender(), { value: sessionRequired }, {
      $$type: 'SetSession',
      session_pubkey: 0x1234n,
      expires_at: BigInt((exactSession.blockchain.now ?? 0) + 1000),
    } as SetSession);
    expect((await exactSession.vault.getGetUser(exactSession.user.address)).exists).toBe(true);
    expect((await exactSession.vault.getGetSession(exactSession.user.address)).exists).toBe(true);

    const lowKeys = await setupPlain();
    const keyRequired = USER_STATE_STORAGE_ENDOWMENT + KEY_RECORD_STANDARD_STORAGE_ENDOWMENT;
    await lowKeys.vault.send(lowKeys.user.getSender(), { value: keyRequired - 1n }, {
      $$type: 'RegisterMessagingKeys',
      enc_pubkey: ENC,
      sign_pubkey: SIG,
      pq_kem_pubkey_hash: 0n,
      pq_kem_pubkey_len: 0n,
      crypto_suite_mask: 1n,
    } as RegisterMessagingKeys);
    expect((await lowKeys.vault.getGetGlobal()).key_record_count).toBe(0n);
    expect((await lowKeys.vault.getGetUser(lowKeys.user.address)).exists).toBe(false);

    const exactKeys = await setupPlain();
    await exactKeys.vault.send(exactKeys.user.getSender(), { value: keyRequired }, {
      $$type: 'RegisterMessagingKeys',
      enc_pubkey: ENC,
      sign_pubkey: SIG,
      pq_kem_pubkey_hash: 0n,
      pq_kem_pubkey_len: 0n,
      crypto_suite_mask: 1n,
    } as RegisterMessagingKeys);
    expect((await exactKeys.vault.getGetGlobal()).key_record_count).toBe(1n);
    expect((await exactKeys.vault.getGetUser(exactKeys.user.address)).current_key_id).not.toBe(0n);
  });

  it('VAULT-BND-03: ReceiveIntent create and new-recipient claim reject min-1 and accept exact storage values', async () => {
    const { vault, user, recipient, blockchain } = await setupPlain();
    const amount = toNano('0.2');
    const now = blockchain.now ?? 0;
    await depositTon(vault, user, toNano('1'));

    const intentId = await vault.getGetReceiveIntentId(user.address, recipient.address, ASSET_TON, amount, 7n);
    const secret = 0x7777n;
    const commitment = await vault.getGetReceiveIntentCommitment(intentId, recipient.address, secret);

    await vault.send(user.getSender(), { value: RECEIVE_INTENT_STORAGE_ENDOWMENT - 1n }, {
      $$type: 'CreateReceiveIntent',
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment,
      expires_at: BigInt(now + 1000),
      client_nonce: 7n,
    } as CreateReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(false);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('1'));

    await vault.send(user.getSender(), { value: RECEIVE_INTENT_STORAGE_ENDOWMENT }, {
      $$type: 'CreateReceiveIntent',
      asset: ASSET_TON,
      amount,
      recipient_wallet: recipient.address,
      commitment,
      expires_at: BigInt(now + 1000),
      client_nonce: 7n,
    } as CreateReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(user.address)).ton_balance).toBe(toNano('0.8'));

    await vault.send(recipient.getSender(), { value: USER_STATE_STORAGE_ENDOWMENT - 1n }, {
      $$type: 'ClaimReceiveIntent',
      intent_id: intentId,
      secret32: secret,
    } as ClaimReceiveIntent);
    expect((await vault.getGetReceiveIntent(intentId)).exists).toBe(true);
    expect((await vault.getGetUser(recipient.address)).exists).toBe(false);

    await vault.send(recipient.getSender(), { value: USER_STATE_STORAGE_ENDOWMENT }, {
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
  });
});
