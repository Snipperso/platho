import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  SealGenesis as VaultSeal,
} from '../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}


function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

async function deriveAthWallet(owner: Address, athMasterAddress: Address): Promise<Address> {
  const walletInit = await ATHWallet.init(0n, owner, athMasterAddress);
  return contractAddress(owner.workChain, walletInit);
}

describe('Deployment ATH wallet binding profile', () => {
  it('DEPLOY-ATH-BIND-00: storing final official ATH wallet in Vault StateInit creates a self-address circularity', async () => {
    const treasuryOwner = fixtureAddress('ATH_TREASURY_OWNER');
    const athMasterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const athMasterAddress = contractAddress(0, athMasterInit);
    const capsulePlaceholder = fixtureAddress('DEPLOY_ATH_CAPSULE_PLACEHOLDER');
    const placeholderAthWallet = fixtureAddress('DEPLOY_ATH_PLACEHOLDER_WALLET');

    const genesisController = fixtureAddress('DEPLOY_ATH_GENESIS_CONTROLLER');
    const initialVaultInit = await Vault.init(genesisController, athMasterAddress, capsulePlaceholder, addressHash(genesisController), false, false, 0n);
    const initialVaultAddress = contractAddress(0, initialVaultInit);
    const officialAthWallet = await deriveAthWallet(initialVaultAddress, athMasterAddress);

    const circularVaultInit = await Vault.init(officialAthWallet, athMasterAddress, capsulePlaceholder, addressHash(genesisController), false, false, 0n);
    const circularVaultAddress = contractAddress(0, circularVaultInit);

    expect(circularVaultAddress.equals(initialVaultAddress)).toBe(false);
  });

  it('DEPLOY-04A/Vault: official ATH wallet is derived after Vault address exists, bound before seal, and frozen after seal', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;

    const deployer = await blockchain.treasury('deploy-ath-binder');
    const feeAccumulator = await blockchain.treasury('deploy-ath-fee-accumulator');
    const treasuryOwner = fixtureAddress('ATH_TREASURY_OWNER');
    const placeholderAthWallet = fixtureAddress('DEPLOY_ATH_PLACEHOLDER_WALLET');
    const capsulePlaceholder = fixtureAddress('DEPLOY_ATH_CAPSULE_PLACEHOLDER');
    const vaultPlaceholder = fixtureAddress('DEPLOY_ATH_VAULT_PLACEHOLDER');

    const athMasterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const athMasterAddress = contractAddress(0, athMasterInit);

    const vaultInit = await Vault.init(deployer.address, athMasterAddress, capsulePlaceholder, addressHash(deployer.address), false, false, 0n);
    const vaultAddress = contractAddress(0, vaultInit);
    const officialAthWallet = await deriveAthWallet(vaultAddress, athMasterAddress);

    await blockchain.setShardAccount(vaultAddress, createShardAccount({
      address: vaultAddress,
      code: vaultInit.code,
      data: vaultInit.data,
      balance: toNano('2'),
      workchain: vaultAddress.workChain,
    }));
    const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

    const capsuleInit = await CapsuleHub.init(feeAccumulator.address, vaultPlaceholder, false, false, 0n, deployer.address);
    const capsuleAddress = contractAddress(0, capsuleInit);
    await blockchain.setShardAccount(capsuleAddress, createShardAccount({
      address: capsuleAddress,
      code: capsuleInit.code,
      data: capsuleInit.data,
      balance: toNano('2'),
      workchain: capsuleAddress.workChain,
    }));
    const capsule = blockchain.openContract(new CapsuleHub(capsuleAddress, capsuleInit));

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: capsuleAddress,
    } as VaultBind);
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as VaultBindAth);
    await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindDeploymentManifest',
      deployment_manifest_hash: MANIFEST_HASH,
      counterpart_address: vaultAddress,
    } as CapsuleBind);

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);
    await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as CapsuleSeal);

    const sealed = await vault.getGetGlobal();
    expect(sealed.sealed).toBe(true);
    expect(sealed.vault_ath_wallet_address.equals(officialAthWallet)).toBe(true);

    const wrong = fixtureAddress('POST_SEAL_WRONG_ATH_WALLET');
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: wrong,
    } as VaultBindAth);

    const afterRebindAttempt = await vault.getGetGlobal();
    expect(afterRebindAttempt.vault_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(afterRebindAttempt.vault_ath_wallet_address.equals(wrong)).toBe(false);
  });

  it('DEPLOY-04A/Vault: pre-seal binding rejects a non-derived official ATH wallet', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;

    const deployer = await blockchain.treasury('audit-f007-vault-binder');
    const treasuryOwner = fixtureAddress('AUDIT_F007_ATH_TREASURY_OWNER');
    const capsulePlaceholder = fixtureAddress('AUDIT_F007_CAPSULE_PLACEHOLDER');
    const wrongOfficialAthWallet = fixtureAddress('AUDIT_F007_WRONG_ATH_WALLET');

    const athMasterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell());
    const athMasterAddress = contractAddress(0, athMasterInit);
    const vaultInit = await Vault.init(deployer.address, athMasterAddress, capsulePlaceholder, addressHash(deployer.address), true, false, MANIFEST_HASH);
    const vaultAddress = contractAddress(0, vaultInit);
    const derivedOfficialAthWallet = await deriveAthWallet(vaultAddress, athMasterAddress);

    await blockchain.setShardAccount(vaultAddress, createShardAccount({
      address: vaultAddress,
      code: vaultInit.code,
      data: vaultInit.data,
      balance: toNano('2'),
      workchain: vaultAddress.workChain,
    }));
    const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: wrongOfficialAthWallet,
    } as VaultBindAth);
    await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as VaultSeal);

    const state = await vault.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.vault_ath_wallet_address.equals(deployer.address)).toBe(true);
    expect(state.vault_ath_wallet_address.equals(wrongOfficialAthWallet)).toBe(false);
    expect(state.vault_ath_wallet_address.equals(derivedOfficialAthWallet)).toBe(false);
  });
});
