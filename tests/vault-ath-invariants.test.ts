import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  BindOfficialAthWallet,
  BindProfileRegistry,
  BindUsernameRegistry,
  SealGenesis,
  DepositTon,
  WithdrawAth,
} from '../build/Vault/Vault_Vault';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  registerVaultSigningKeys,
  sendVaultReceiveIntentExternal,
} from './helpers/vault-receive-intent-external';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const RECEIVE_INTENT_CREATE_RESERVE = 9_000_000n;

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.INVARIANT.${label}`).digest());
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
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

async function setup(userCount = 3) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-inv-controller');
  const capsuleHub = await blockchain.treasury('vault-inv-capsulehub');
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
    balance: toNano('3'),
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
    profile_registry_address: fixtureAddress('VAULT_INV_PROFILE_REGISTRY'),
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress('VAULT_INV_USERNAME_REGISTRY'),
  } as BindUsernameRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  const users = [];
  const userAthWallets = [];
  const recipients = [];
  for (let i = 0; i < userCount; i += 1) {
    const user = await blockchain.treasury(`vault-inv-user-${i}`);
    users.push(user);
    userAthWallets.push(await deployAthWallet(blockchain, user.address, athMaster, 10_000n));
    recipients.push(await blockchain.treasury(`vault-inv-recipient-${i}`));
  }

  return {
    blockchain,
    vault,
    users,
    userAthWallets,
    recipients,
    athMaster,
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
  await params.userAthWallet.send(params.user.getSender(), { value: params.requestValue ?? toNano('0.25') }, {
    $$type: 'ATHTransferRequestWithNotify',
    query_id: params.queryId,
    amount: params.amount,
    recipient: params.vault.address,
    response_destination: params.user.address,
    notify_destination: params.vault.address,
    notify_value: params.notifyValue ?? toNano('0.03'),
  } as ATHTransferRequestWithNotify);
}

async function depositTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + toNano('0.05') }, {
    $$type: 'DepositTon',
    amount,
  } as DepositTon);
}

describe('Vault ATH accounting invariants', () => {
  it('VAULT-INV-ATH-01: deterministic deposit/withdraw walks preserve ATH accounting after every step', async () => {
    for (const seed of [0x51a7cafe, 0x9e3779b9, 0xdecafbad, 0x13579bdf]) {
      const { blockchain, vault, users, userAthWallets, recipients, athMaster, officialVaultAthWallet } = await setup(3);
      const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));
      const rng = makeRng(seed);
      const expectedInternal = [0n, 0n, 0n];
      const expectedSource = [10_000n, 10_000n, 10_000n];
      const expectedRecipient = [0n, 0n, 0n];
      const processedDeposits = new Set<string>();
      let withdrawQuery = BigInt(seed & 0xffff) + 10_000n;
      let debugContext = `seed ${seed} initial`;

      async function assertInvariants() {
        let sumInternal = 0n;
        for (let i = 0; i < users.length; i += 1) {
          const userState = await vault.getGetUser(users[i].address);
          const sourceState = await userAthWallets[i].getGetWalletData();
          expect(userState.ath_balance).toBe(expectedInternal[i]);
          expect(sourceState.balance).toBe(expectedSource[i]);
          sumInternal += expectedInternal[i];

          const recipientWalletAddress = await athWalletAddress(recipients[i].address, athMaster);
          const recipientWallet = blockchain.openContract(new ATHWallet(recipientWalletAddress));
          if (expectedRecipient[i] > 0n) {
            try {
              expect((await recipientWallet.getGetWalletData()).balance).toBe(expectedRecipient[i]);
            } catch (error) {
              throw new Error(`${debugContext}: recipient ${i} wallet mismatch/non-active, expected=${expectedRecipient[i]}, cause=${(error as Error).message}`);
            }
          }
        }

        let officialBalance = 0n;
        try {
          officialBalance = (await officialWallet.getGetWalletData()).balance;
        } catch (error) {
          if (sumInternal !== 0n) {
            throw new Error(`${debugContext}: official wallet non-active with expected backing=${sumInternal}, cause=${(error as Error).message}`);
          }
        }
        const global = await vault.getGetGlobal();
        expect(officialBalance).toBe(sumInternal);
        expect(global.pending_ath_withdrawal_count).toBe(0n);
        expect(global.processed_ath_deposit_count).toBe(BigInt(processedDeposits.size));
      }

      for (let step = 0; step < 45; step += 1) {
        const userIndex = rng() % users.length;
        const op = rng() % 5;
        if (op <= 1) {
          const queryId = BigInt(rng() % 8);
          const amount = BigInt(100 + (rng() % 500));
          debugContext = `seed ${seed} step ${step} deposit user=${userIndex} amount=${amount} query=${queryId}`;
          const key = `${userIndex}:${queryId}`;
          const shouldCredit = !processedDeposits.has(key) && expectedSource[userIndex] >= amount;
          await depositAth({
            vault,
            user: users[userIndex],
            userAthWallet: userAthWallets[userIndex],
            amount,
            queryId,
          });
          if (shouldCredit) {
            processedDeposits.add(key);
            expectedInternal[userIndex] += amount;
            expectedSource[userIndex] -= amount;
          }
        } else if (op === 2) {
          const queryId = BigInt(100 + step);
          const amount = BigInt(100 + (rng() % 400));
          debugContext = `seed ${seed} step ${step} underfunded-deposit user=${userIndex} amount=${amount} query=${queryId}`;
          await depositAth({
            vault,
            user: users[userIndex],
            userAthWallet: userAthWallets[userIndex],
            amount,
            queryId,
            notifyValue: toNano('0.001'),
          });
        } else {
          const amount = BigInt(50 + (rng() % 300));
          const underfunded = op === 3;
          debugContext = `seed ${seed} step ${step} withdraw user=${userIndex} amount=${amount} underfunded=${underfunded}`;
          await vault.send(users[userIndex].getSender(), { value: underfunded ? toNano('0.003') : toNano('0.04') }, {
            $$type: 'WithdrawAth',
            query_id: withdrawQuery,
            amount,
            recipient: recipients[userIndex].address,
          } as WithdrawAth);
          if (!underfunded && expectedInternal[userIndex] >= amount) {
            expectedInternal[userIndex] -= amount;
            expectedRecipient[userIndex] += amount;
          }
          withdrawQuery += 1n;
        }

        await assertInvariants();
      }
    }
  }, 60_000);

  it('VAULT-INV-ATH-02: ATH receive intent claim and cancel preserve total internal ATH and official backing', async () => {
    const { blockchain, vault, users, userAthWallets, officialVaultAthWallet } = await setup(2);
    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));
    const senderKey = await registerVaultSigningKeys(vault, users[0], 61);
    const recipientKey = await registerVaultSigningKeys(vault, users[1], 62);
    await depositAth({ vault, user: users[0], userAthWallet: userAthWallets[0], amount: 1_200n, queryId: 501n });
    await depositAth({ vault, user: users[1], userAthWallet: userAthWallets[1], amount: 300n, queryId: 502n });
    await depositTon(vault, users[0], RECEIVE_INTENT_CREATE_RESERVE * 2n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(1_500n);

    const claimNonce = (await vault.getGetUser(users[0].address)).publish_nonce;
    const claimIntentId = await vault.getGetReceiveIntentId(users[0].address, users[1].address, 2n, 500n, claimNonce);
    const claimSecret = 0xabcdefn;
    const claimCommitment = await vault.getGetReceiveIntentCommitment(claimIntentId, users[1].address, claimSecret);
    await sendVaultReceiveIntentExternal(blockchain, vault, 'CreateReceiveIntent', users[0], senderKey, MANIFEST_HASH, {
      asset: 2n,
      amount: 500n,
      recipient_wallet: users[1].address,
      commitment: claimCommitment,
    });
    expect((await vault.getGetUser(users[0].address)).ath_balance).toBe(700n);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(1n);

    await sendVaultReceiveIntentExternal(blockchain, vault, 'ClaimReceiveIntent', users[1], recipientKey, MANIFEST_HASH, {
      intent_id: claimIntentId,
      secret32: claimSecret,
    });
    expect((await vault.getGetUser(users[0].address)).ath_balance).toBe(700n);
    expect((await vault.getGetUser(users[1].address)).ath_balance).toBe(800n);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(1_500n);

    const cancelNonce = (await vault.getGetUser(users[0].address)).publish_nonce;
    const cancelIntentId = await vault.getGetReceiveIntentId(users[0].address, users[1].address, 2n, 250n, cancelNonce);
    const cancelCommitment = await vault.getGetReceiveIntentCommitment(cancelIntentId, users[1].address, 0x1234n);
    await sendVaultReceiveIntentExternal(blockchain, vault, 'CreateReceiveIntent', users[0], senderKey, MANIFEST_HASH, {
      asset: 2n,
      amount: 250n,
      recipient_wallet: users[1].address,
      commitment: cancelCommitment,
    });
    expect((await vault.getGetUser(users[0].address)).ath_balance).toBe(450n);

    await sendVaultReceiveIntentExternal(blockchain, vault, 'CancelReceiveIntent', users[0], senderKey, MANIFEST_HASH, {
      intent_id: cancelIntentId,
    });
    expect((await vault.getGetUser(users[0].address)).ath_balance).toBe(700n);
    expect((await vault.getGetUser(users[1].address)).ath_balance).toBe(800n);
    expect((await vault.getGetGlobal()).receive_intent_count).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(1_500n);
  });
});
