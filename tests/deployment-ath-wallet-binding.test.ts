import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  ProfileRegistry,
  BindProfileOfficialAthWallet as ProfileBindAth,
  SealGenesis as ProfileSeal,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}



async function deriveAthWallet(owner: Address, athMasterAddress: Address): Promise<Address> {
  const walletInit = await ATHWallet.init(0n, owner, athMasterAddress);
  return contractAddress(owner.workChain, walletInit);
}

describe('Deployment ATH wallet binding profile', () => {
  it('DEPLOY-04A/ProfileRegistry: official ATH wallet is derived after ProfileRegistry address exists and frozen after seal', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;

    const deployer = await blockchain.treasury('deploy-profile-ath-binder');
    const treasuryOwner = fixtureAddress('PROFILE_DEPLOY_ATH_TREASURY_OWNER');
    const placeholderAthWallet = fixtureAddress('PROFILE_DEPLOY_ATH_PLACEHOLDER_WALLET');
    const treasuryAthReceiver = fixtureAddress('PROFILE_DEPLOY_TREASURY_RECEIVER');

    const athMasterInit = await ATHMaster.init(treasuryOwner, beginCell().storeBuffer(Buffer.from('ATH')).endCell(), 0n);
    const athMasterAddress = contractAddress(0, athMasterInit);

    const profileInit = await ProfileRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
    const profileAddress = contractAddress(0, profileInit);
    const officialAthWallet = await deriveAthWallet(profileAddress, athMasterAddress);

    await blockchain.setShardAccount(profileAddress, createShardAccount({
      address: profileAddress,
      code: profileInit.code,
      data: profileInit.data,
      balance: toNano('2'),
      workchain: profileAddress.workChain,
    }));
    const profile = blockchain.openContract(new ProfileRegistry(profileAddress, profileInit));

    await profile.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as ProfileBindAth);
    await profile.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);

    let sealed = await profile.getGetGlobal();
    expect(sealed.sealed).toBe(true);

    await profile.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);

    sealed = await profile.getGetGlobal();
    expect(sealed.sealed).toBe(true);
    expect(sealed.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);

    const wrong = fixtureAddress('PROFILE_POST_SEAL_WRONG_ATH_WALLET');
    await profile.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: wrong,
    } as ProfileBindAth);

    const afterRebindAttempt = await profile.getGetGlobal();
    expect(afterRebindAttempt.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(afterRebindAttempt.official_ath_wallet_address.equals(wrong)).toBe(false);
  });
});
