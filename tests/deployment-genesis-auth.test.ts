import { describe, expect, it } from 'vitest';
import { ART_KEYS, sealArtAndCollectionMeta } from './helpers/username-registry-genesis';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet as RegistryBindAth,
  SealGenesis as RegistrySeal,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  ProfileRegistry,
  BindProfileOfficialAthWallet as ProfileBindAth,
  SealGenesis as ProfileSeal,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';

const MANIFEST_HASH = 0x67656e657369735f617574685f6d616e69666573745f763100000000000001n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}




/** Compute-phase exit codes of every transaction a send produced, so a refusal can be asserted by CODE. */
function exitCodes(res: any): number[] {
  return (res?.transactions ?? [])
    .map((t: any) => t?.description?.computePhase?.exitCode)
    .filter((c: any) => typeof c === 'number');
}

async function deployUnsealedUsernameRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const genesisController = await blockchain.treasury('registry-genesis-controller');
  const attacker = await blockchain.treasury('registry-genesis-attacker');
  const placeholderAthWallet = fixtureAddress('GENESIS_AUTH_REGISTRY_ATH_PLACEHOLDER');
  const athMasterAddress = fixtureAddress('GENESIS_AUTH_REGISTRY_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('GENESIS_AUTH_REGISTRY_TREASURY');

  const registryInit = await UsernameRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    genesisController.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));

  return { blockchain, genesisController, attacker, registry, registryAddress, placeholderAthWallet };
}

async function deployUnsealedProfileRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const genesisController = await blockchain.treasury('profile-registry-genesis-controller');
  const attacker = await blockchain.treasury('profile-registry-genesis-attacker');
  const placeholderAthWallet = fixtureAddress('GENESIS_AUTH_PROFILE_ATH_PLACEHOLDER');
  const athMasterAddress = fixtureAddress('GENESIS_AUTH_PROFILE_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('GENESIS_AUTH_PROFILE_TREASURY');

  const registryInit = await ProfileRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    genesisController.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new ProfileRegistry(registryAddress, registryInit));

  return { genesisController, attacker, registry, placeholderAthWallet };
}

describe('Deployment genesis controller auth', () => {

  it('DEPLOY-AUTH-05/06/07: arbitrary sender cannot bind/seal UsernameRegistry and controller has no post-seal authority', async () => {
    const { genesisController, attacker, registry, placeholderAthWallet } = await deployUnsealedUsernameRegistry();
    const officialAthWallet = await registry.getGetAthWalletAddress(registry.address);
    const attackerAthWallet = fixtureAddress('GENESIS_AUTH_REGISTRY_ATTACKER_ATH_WALLET');

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as RegistryBindAth);
    let global = await registry.getGetGlobal();
    expect(global.official_ath_wallet_bound).toBe(false);
    expect(global.official_ath_wallet_address.equals(placeholderAthWallet)).toBe(true);
    expect(global.deployment_manifest_hash).toBe(0n);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as RegistryBindAth);

    await sealArtAndCollectionMeta(registry, genesisController);

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    expect((await registry.getGetGlobal()).sealed).toBe(false);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
    expect(global.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as RegistryBindAth);
    const afterPostSealAttempt = await registry.getGetGlobal();
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(attackerAthWallet)).toBe(false);

    // [ADDED 2026-07-30, tier-4 HIGH] This test claimed "controller has no post-seal authority" while checking exactly
    // one path — the ATH wallet binding. Two others were wide open: requireGenesisController compares sender() to an
    // init field the seal never clears, and UploadArt / UploadCollectionMeta were gated ONLY on their own art_sealed /
    // meta_sealed flags. Skip SealArt at the ceremony and this hot wallet could rewrite the SVG every .ath NFT renders,
    // forever, in a contract advertised as immutable. SealGenesis now demands both locks (19045 / 19046), which makes
    // the two flags permanently true before the seal — and since nothing ever unsets them, the upload paths are dead.
    //
    // Asserted on the EXIT CODE rather than on unchanged state: an upload to an already-present key leaves art_count
    // at 56 whether it was refused or silently applied, so a count check would pass either way and prove nothing.
    const artRes = await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'UploadArt', key: BigInt(ART_KEYS[0]), data: beginCell().storeUint(0xDEAD, 16).endCell(),
    });
    expect(exitCodes(artRes), 'UploadArt must be refused with 19061 after the seal, not applied').toContain(19061);

    const metaRes = await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'UploadCollectionMeta', key: 1n, data: beginCell().storeUint(0xDEAD, 16).endCell(),
    });
    expect(exitCodes(metaRes), 'UploadCollectionMeta must be refused with 19071 after the seal').toContain(19071);
  });

  it('DEPLOY-AUTH-07B: the genesis seal is refused while the art or the collection metadata is still unlocked', async () => {
    const { genesisController, registry, registryAddress } = await deployUnsealedUsernameRegistry();
    const officialAthWallet = await registry.getGetAthWalletAddress(registryAddress);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as RegistryBindAth);

    // Nothing uploaded yet: the seal must refuse on the art lock.
    const noArt = await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    expect(exitCodes(noArt)).toContain(19045);
    expect((await registry.getGetGlobal()).sealed).toBe(false);

    // Art locked, metadata still open: the seal must refuse on the metadata lock. Proves 19046 is reachable on its
    // own rather than shadowed by 19045 — a second gate that only ever fires behind the first is not a gate.
    for (const key of ART_KEYS) {
      await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
        $$type: 'UploadArt', key: BigInt(key), data: beginCell().endCell(),
      });
    }
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, { $$type: 'SealArt' });
    const noMeta = await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    expect(exitCodes(noMeta)).toContain(19046);
    expect((await registry.getGetGlobal()).sealed).toBe(false);

    // Both locked: the seal goes through. Without this the two gates above could be satisfied by a contract that
    // simply never seals.
    for (const key of [1n, 2n, 3n]) {
      await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
        $$type: 'UploadCollectionMeta', key, data: beginCell().endCell(),
      });
    }
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, { $$type: 'SealCollectionMeta' });
    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH,
    } as RegistrySeal);
    expect((await registry.getGetGlobal()).sealed).toBe(true);
  });

  it('DEPLOY-AUTH-08: arbitrary sender cannot bind/seal ProfileRegistry and controller has no post-seal authority', async () => {
    const { genesisController, attacker, registry, placeholderAthWallet } = await deployUnsealedProfileRegistry();
    const officialAthWallet = await registry.getGetAthWalletAddress(registry.address);
    const attackerAthWallet = fixtureAddress('GENESIS_AUTH_PROFILE_ATTACKER_ATH_WALLET');

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as ProfileBindAth);
    let global = await registry.getGetGlobal();
    expect(global.official_ath_wallet_bound).toBe(false);
    expect(global.official_ath_wallet_address.equals(placeholderAthWallet)).toBe(true);
    expect(global.deployment_manifest_hash).toBe(0n);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as ProfileBindAth);

    await registry.send(attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);
    expect((await registry.getGetGlobal()).sealed).toBe(false);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as ProfileSeal);
    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
    expect(global.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);

    await registry.send(genesisController.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerAthWallet,
    } as ProfileBindAth);
    const afterPostSealAttempt = await registry.getGetGlobal();
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(afterPostSealAttempt.official_ath_wallet_address.equals(attackerAthWallet)).toBe(false);
  });
});
