import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  AthTransferNotification,
  BindOfficialAthWallet,
  SealGenesis,
  WithdrawAth,
} from '../build/Vault/Vault_Vault';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;
const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1_000_000n;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7_000_000n;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2_000_000n;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10_000_000n;
const ATH_OWNER_NOTIFY_MIN_VALUE = ATH_TRANSFER_NOTIFY_MIN_VALUE
  + ATH_TRANSFER_NOTIFY_ACK_VALUE
  + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
  + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
  + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
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

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-ath-controller');
  const user = await blockchain.treasury('vault-ath-user');
  const recipient = await blockchain.treasury('vault-ath-recipient');
  const capsuleHub = await blockchain.treasury('vault-ath-capsulehub');
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

  return {
    blockchain,
    vault,
    user,
    recipient,
    athMaster,
    userAthWallet,
    officialVaultAthWallet,
  };
}

async function depositAth(params: {
  vault: any;
  user: any;
  userAthWallet: any;
  amount: bigint;
  queryId: bigint;
  notifyValue?: bigint;
  requestValue?: bigint;
}) {
  return await params.userAthWallet.send(params.user.getSender(), { value: params.requestValue ?? toNano('0.25') }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: params.queryId,
    amount: params.amount,
    recipient: params.vault.address,
    response_destination: params.user.address,
    notify_destination: params.vault.address,
    notify_value: params.notifyValue ?? toNano('0.03'),
  } as ATHTransferRequestWithNotify);
}

describe('Vault ATH integration with production ATHWallet', () => {
  it('VAULT-ATH-01: production ATHWallet transfer-with-notify credits Vault internal ath_balance', async () => {
    const { blockchain, vault, user, userAthWallet, officialVaultAthWallet } = await setup();

    await depositAth({ vault, user, userAthWallet, amount: 1_000n, queryId: 1n });

    const state = await vault.getGetUser(user.address);
    const source = await userAthWallet.getGetWalletData();
    expect(state.exists).toBe(true);
    expect(state.ath_balance).toBe(1_000n);
    expect(source.balance).toBe(4_000n);
    expect((await vault.getGetGlobal()).user_count).toBe(1n);
    expect((await vault.getGetGlobal()).processed_ath_deposit_count).toBe(1n);
    expect(await contractBalance(blockchain, officialVaultAthWallet)).toBeLessThan(toNano('0.01'));
  });

  it('VAULT-ATH-02: insufficient notification value is rejected before debiting the source wallet', async () => {
    const { vault, user, userAthWallet } = await setup();

    await depositAth({
      vault,
      user,
      userAthWallet,
      amount: 1_000n,
      queryId: 2n,
      notifyValue: toNano('0.001'),
      requestValue: toNano('0.25'),
    });

    const state = await vault.getGetUser(user.address);
    const source = await userAthWallet.getGetWalletData();
    expect(state.exists).toBe(false);
    expect(source.balance).toBe(5_000n);
    expect((await vault.getGetGlobal()).processed_ath_deposit_count).toBe(0n);
  });

  it('VAULT-ATH-03: withdrawal clears pending only after recipient ATH wallet ACK', async () => {
    const { blockchain, vault, user, recipient, userAthWallet, athMaster, officialVaultAthWallet } = await setup();

    await depositAth({ vault, user, userAthWallet, amount: 2_000n, queryId: 3n });
    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    const beforeUser = await vault.getGetUser(user.address);

    await vault.send(user.getSender(), { value: toNano('0.03') }, {
      $$type: 'WithdrawAth',
      query_id: 10n,
      amount: 750n,
      recipient: recipient.address,
    } as WithdrawAth);

    const recipientAthWalletAddress = await athWalletAddress(recipient.address, athMaster);
    const recipientAthWallet = blockchain.openContract(new ATHWallet(recipientAthWalletAddress));
    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));
    const afterUser = await vault.getGetUser(user.address);

    expect(afterUser.ath_balance).toBe(1_250n);
    expect(afterUser.ton_balance).toBeGreaterThan(beforeUser.ton_balance);
    expect(afterUser.ton_balance - beforeUser.ton_balance).toBeLessThanOrEqual(toNano('0.03'));
    expect((await vault.getGetPendingAthWithdrawal(10n)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await recipientAthWallet.getGetWalletData()).balance).toBe(750n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(1_250n);
  });

  it('VAULT-ATH-03B: underfunded withdrawal is rejected before debiting internal ATH or creating pending state', async () => {
    const { blockchain, vault, user, recipient, userAthWallet, officialVaultAthWallet } = await setup();

    await depositAth({ vault, user, userAthWallet, amount: 2_000n, queryId: 31n });
    await vault.send(user.getSender(), { value: toNano('0.003') }, {
      $$type: 'WithdrawAth',
      query_id: 32n,
      amount: 750n,
      recipient: recipient.address,
    } as WithdrawAth);

    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));

    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    expect((await vault.getGetPendingAthWithdrawal(32n)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(2_000n);
  });

  it('VAULT-ATH-03C: non-basechain withdrawal recipient is rejected before debit or pending state', async () => {
    const { blockchain, vault, user, userAthWallet, officialVaultAthWallet } = await setup();
    const masterchainRecipient = fixtureAddress('VAULT_ATH_MASTERCHAIN_RECIPIENT', -1);

    await depositAth({ vault, user, userAthWallet, amount: 2_000n, queryId: 33n });
    await vault.send(user.getSender(), { value: toNano('0.25') }, {
      $$type: 'WithdrawAth',
      query_id: 34n,
      amount: 750n,
      recipient: masterchainRecipient,
    } as WithdrawAth);

    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));

    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    expect((await vault.getGetPendingAthWithdrawal(34n)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(2_000n);
  });

  it('VAULT-ATH-03D: non-basechain deposit notification sender is rejected before ledger credit', async () => {
    const { blockchain, vault, officialVaultAthWallet } = await setup();
    const masterchainSource = fixtureAddress('VAULT_ATH_MASTERCHAIN_SOURCE', -1);

    await vault.send(blockchain.sender(officialVaultAthWallet), { value: toNano('0.1') }, {
      $$type: 'AthTransferNotification',
      query_id: 35n,
      amount: 1_000n,
      sender_key: 0n,
      sender_wallet: masterchainSource,
    } as AthTransferNotification);

    expect((await vault.getGetUser(masterchainSource)).exists).toBe(false);
    expect((await vault.getGetGlobal()).user_count).toBe(0n);
    expect((await vault.getGetGlobal()).processed_ath_deposit_count).toBe(0n);
  });

  it('VAULT-ATH-04: repeated deposit query_id is rejected before creating uncredited official-wallet balance', async () => {
    const { blockchain, vault, user, userAthWallet, officialVaultAthWallet } = await setup();

    await depositAth({ vault, user, userAthWallet, amount: 1_000n, queryId: 42n });
    await depositAth({ vault, user, userAthWallet, amount: 700n, queryId: 42n });

    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));
    const state = await vault.getGetUser(user.address);
    const source = await userAthWallet.getGetWalletData();
    const official = await officialWallet.getGetWalletData();

    expect(state.ath_balance).toBe(1_000n);
    expect(source.balance).toBe(4_000n);
    expect(official.balance).toBe(1_000n);
    expect((await vault.getGetGlobal()).processed_ath_deposit_count).toBe(1n);
  });

  it('VAULT-ATH-05: canonical owner notify value reaches Vault without trapping large official-wallet TON excess', async () => {
    const { blockchain, vault, user, userAthWallet, officialVaultAthWallet } = await setup();

    await depositAth({
      vault,
      user,
      userAthWallet,
      amount: 1_000n,
      queryId: 50n,
      notifyValue: ATH_TRANSFER_NOTIFY_MIN_VALUE,
      requestValue: ATH_TRANSFER_NOTIFY_MIN_VALUE
        + ATH_TRANSFER_NOTIFY_ACK_VALUE
        + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
        + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT,
    });

    expect((await vault.getGetUser(user.address)).exists).toBe(false);
    expect((await userAthWallet.getGetWalletData()).balance).toBe(5_000n);

    await depositAth({
      vault,
      user,
      userAthWallet,
      amount: 1_000n,
      queryId: 51n,
      notifyValue: ATH_TRANSFER_NOTIFY_MIN_VALUE,
      requestValue: ATH_OWNER_NOTIFY_MIN_VALUE,
    });

    const userState = await vault.getGetUser(user.address);
    const source = await userAthWallet.getGetWalletData();

    expect(userState.exists).toBe(true);
    expect(userState.ath_balance).toBe(1_000n);
    expect(source.balance).toBe(4_000n);
    expect(await contractBalance(blockchain, officialVaultAthWallet)).toBeLessThan(toNano('0.01'));
  });
});
