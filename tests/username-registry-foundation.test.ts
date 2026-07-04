import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, Dictionary, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  UsernameRegistryTopUpStorageReserve,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(0xC5CC7CD6, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function metadataKey(field: string): bigint {
  return BigInt('0x' + createHash('sha256').update(field).digest('hex'));
}

function readSnakeText(cell: any): string {
  const slice = cell.beginParse();
  expect(slice.loadUint(8)).toBe(0);
  return slice.loadBuffer(Math.floor(slice.remainingBits / 8)).toString('utf8');
}

async function deployRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('username-registry-deployer');
  const caller = await blockchain.treasury('username-registry-caller');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));

  return { blockchain, deployer, caller, registry, registryAddress, placeholderAthWallet, treasuryAthReceiver };
}

async function deployRegistryReadyToSeal(options: {
  treasuryAthReceiver: Address;
  vaultAddress?: Address;
  athMasterAddress?: Address;
  forcedRegistryAddress?: Address;
}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-registry-seal-deployer');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_SEAL_PLACEHOLDER');
  const athMasterAddress = options.athMasterAddress ?? fixtureAddress('USERNAME_REGISTRY_SEAL_ATH_MASTER');
  const vaultAddress = options.vaultAddress ?? fixtureAddress('USERNAME_REGISTRY_SEAL_VAULT');

  const registryInit = await UsernameRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    options.treasuryAthReceiver,
    false,
    0n,
    0n,
    deployer.address,
  );
  const registryAddress = options.forcedRegistryAddress ?? contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('2'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWallet = await registry.getGetAthWalletAddress(registryAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWallet,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);

  return { registry, deployer, registryAddress, officialAthWallet, athMasterAddress, vaultAddress };
}

describe('UsernameRegistry foundation milestone', () => {
  it('USERNAME-REG-M9-01: price getter enforces pinned name length tiers without accepting 1-3 char names', async () => {
    const { registry } = await deployRegistry();

    const p1 = await registry.getGetUsernamePrice(1n);
    const p3 = await registry.getGetUsernamePrice(3n);
    const p4 = await registry.getGetUsernamePrice(4n);
    const p5 = await registry.getGetUsernamePrice(5n);
    const p6 = await registry.getGetUsernamePrice(6n);
    const p12 = await registry.getGetUsernamePrice(12n);
    const p16 = await registry.getGetUsernamePrice(16n);
    const p17 = await registry.getGetUsernamePrice(17n);

    expect(p1.valid_length).toBe(false);
    expect(p3.valid_length).toBe(false);
    expect(p17.valid_length).toBe(false);
    expect(p1.price_ath_atomic).toBe(0n);
    expect(p3.price_ath_atomic).toBe(0n);
    expect(p17.price_ath_atomic).toBe(0n);
    expect(p4.valid_length).toBe(true);
    expect(p16.valid_length).toBe(true);
    expect(p4.price_ath_atomic).toBe(10_000_000_000_000n);
    expect(p5.price_ath_atomic).toBe(1_000_000_000_000n);
    expect(p6.price_ath_atomic).toBe(100_000_000_000n);
    expect(p12.price_ath_atomic).toBe(100_000_000_000n);
    expect(p16.price_ath_atomic).toBe(100_000_000_000n);
  });

  it('USERNAME-REG-M9-02: get_username_item_address equals local UsernameNFTItem StateInit derivation', async () => {
    const { registry, registryAddress } = await deployRegistry();
    const usernameHash = nameHash('platho');

    const fromGetter = await registry.getGetUsernameItemAddress(usernameHash);
    const itemInit = await UsernameNFTItem.init(registryAddress, usernameHash);
    const local = contractAddress(registryAddress.workChain, itemInit);

    expect(fromGetter.equals(local)).toBe(true);
  });

  it('USERNAME-REG-M9-03: item derivation is stable for a username hash and does not take an owner wallet', async () => {
    const { registry, registryAddress } = await deployRegistry();
    const usernameHash = nameHash('larisa');

    const fromGetter = await registry.getGetUsernameItemAddress(usernameHash);
    const itemInit = await UsernameNFTItem.init(registryAddress, usernameHash);
    const local = contractAddress(registryAddress.workChain, itemInit);

    expect(fromGetter.workChain).toBe(registryAddress.workChain);
    expect(fromGetter.equals(local)).toBe(true);
  });

  it('USERNAME-REG-M9-03A: collection getter exposes TEP-64 on-chain collection metadata', async () => {
    const { registry, deployer, treasuryAthReceiver } = await deployRegistry();

    // clean-11: collection metadata (description + avatar + banner data-URIs) is genesis-uploaded as COMPLETE
    // TEP-64 snake value cells then sealed, exactly like `art`. collectionContent() throws 19360 until meta_sealed,
    // so the getter is only conformant once the 3 parts are present and locked.
    const snake = (s: string) => beginCell().storeUint(0, 8).storeBuffer(Buffer.from(s, 'utf8')).endCell();
    const metaDescription = 'Platho usernames — on-chain, post-quantum identity.';
    const metaImage = 'data:image/svg+xml;base64,PHN2Zy8+';
    const metaCover = 'data:image/png;base64,iVBORw0KGgo=';
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'UploadCollectionMeta', key: 1n, data: snake(metaDescription) });
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'UploadCollectionMeta', key: 2n, data: snake(metaImage) });
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'UploadCollectionMeta', key: 3n, data: snake(metaCover) });
    expect(await registry.getGetMetaCount()).toBe(3n);
    expect(await registry.getGetMetaSealed()).toBe(false);
    // getter must revert with 19360 until sealed (fail-closed: never expose half-built collection metadata)
    await expect(registry.getGetCollectionData()).rejects.toThrow(/19360/);
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'SealCollectionMeta' });
    expect(await registry.getGetMetaSealed()).toBe(true);

    const collection = await registry.getGetCollectionData();
    const content = collection.collection_content.beginParse();
    expect(content.loadUint(8)).toBe(0);
    const metadata = content.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

    expect(collection.next_item_index).toBe(-1n);
    expect(collection.owner_address.equals(treasuryAthReceiver)).toBe(true);
    expect(readSnakeText(metadata.get(metadataKey('name')))).toBe('Platho usernames');
    expect(readSnakeText(metadata.get(metadataKey('description')))).toBe(metaDescription);
    expect(readSnakeText(metadata.get(metadataKey('image')))).toBe(metaImage);
    expect(readSnakeText(metadata.get(metadataKey('cover_image')))).toBe(metaCover);
  });

  it('USERNAME-REG-M9-03B: unordered collection sentinel is not accepted as an item index', async () => {
    const { registry } = await deployRegistry();

    await expect(registry.getGetNftAddressByIndex(-1n)).rejects.toThrow();
    await expect(registry.getGetNftAddressByIndex(0n)).rejects.toThrow();
  });

  it('USERNAME-REG-M9-04: official ATH wallet binds before seal and cannot be changed after seal', async () => {
    const { deployer, registry, registryAddress } = await deployRegistry();
    const officialAthWallet = await registry.getGetAthWalletAddress(registryAddress);
    const attackerWallet = fixtureAddress('USERNAME_REGISTRY_ATTACKER_ATH_WALLET');
    const vaultAddress = fixtureAddress('USERNAME_REGISTRY_BOUND_VAULT');

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWallet,
    } as BindOfficialAthWallet);

    let state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(true);
    expect(state.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(state.deployment_manifest_hash).toBe(MANIFEST_HASH);
    expect(state.genesis_config_hash).toBe(1n);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindUsernameVault',
      deployment_manifest_hash: MANIFEST_HASH,
      vault_address: vaultAddress,
    } as BindUsernameVault);
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    state = await registry.getGetGlobal();
    expect(state.sealed).toBe(true);
    expect(state.genesis_config_hash).toBe(MANIFEST_HASH);
    expect(state.vault_bound).toBe(true);
    expect(state.vault_address.equals(vaultAddress)).toBe(true);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: attackerWallet,
    } as BindOfficialAthWallet);

    state = await registry.getGetGlobal();
    expect(state.official_ath_wallet_address.equals(officialAthWallet)).toBe(true);
    expect(state.official_ath_wallet_address.equals(attackerWallet)).toBe(false);
  });

  it('USERNAME-REG-M9-04B: SealGenesis rejects protocol-owned treasury ATH receivers', async () => {
    const forcedSelfAddress = fixtureAddress('USERNAME_REGISTRY_SEAL_TREASURY_SELF');
    const selfTreasury = await deployRegistryReadyToSeal({
      treasuryAthReceiver: forcedSelfAddress,
      forcedRegistryAddress: forcedSelfAddress,
    });
    await selfTreasury.registry.send(selfTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await selfTreasury.registry.getGetGlobal()).sealed).toBe(false);

    const forcedOfficialOwner = fixtureAddress('USERNAME_REGISTRY_SEAL_TREASURY_OFFICIAL_OWNER');
    const officialMaster = fixtureAddress('USERNAME_REGISTRY_SEAL_TREASURY_OFFICIAL_MASTER');
    const officialWalletInit = await ATHWallet.init(0n, forcedOfficialOwner, officialMaster);
    const officialTreasuryReceiver = contractAddress(forcedOfficialOwner.workChain, officialWalletInit);
    const officialTreasury = await deployRegistryReadyToSeal({
      treasuryAthReceiver: officialTreasuryReceiver,
      athMasterAddress: officialMaster,
      forcedRegistryAddress: forcedOfficialOwner,
    });
    await officialTreasury.registry.send(officialTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await officialTreasury.registry.getGetGlobal()).sealed).toBe(false);

    const vaultAddress = fixtureAddress('USERNAME_REGISTRY_SEAL_TREASURY_AS_VAULT');
    const vaultTreasury = await deployRegistryReadyToSeal({
      treasuryAthReceiver: vaultAddress,
      vaultAddress,
    });
    await vaultTreasury.registry.send(vaultTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await vaultTreasury.registry.getGetGlobal()).sealed).toBe(false);

    const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_SEAL_TREASURY_AS_ATH_MASTER');
    const masterTreasury = await deployRegistryReadyToSeal({
      treasuryAthReceiver: athMasterAddress,
      athMasterAddress,
    });
    await masterTreasury.registry.send(masterTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await masterTreasury.registry.getGetGlobal()).sealed).toBe(false);
  });

  it('USERNAME-REG-M9-04A: pre-seal binding rejects a non-derived official ATH wallet', async () => {
    const { deployer, registry, registryAddress } = await deployRegistry();
    const wrongOfficialAthWallet = fixtureAddress('USERNAME_REGISTRY_AUDIT_F007_WRONG_ATH_WALLET');
    const derivedOfficialAthWallet = await registry.getGetAthWalletAddress(registryAddress);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: wrongOfficialAthWallet,
    } as BindOfficialAthWallet);
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    const state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(false);
    expect(state.official_ath_wallet_address.equals(wrongOfficialAthWallet)).toBe(false);
    expect(state.official_ath_wallet_address.equals(derivedOfficialAthWallet)).toBe(false);
  });

  it('USERNAME-REG-M9-05: seal fails without official ATH wallet binding and storage top-up grants no authority', async () => {
    const { deployer, caller, registry, placeholderAthWallet } = await deployRegistry();

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    let state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(false);
    expect(state.official_ath_wallet_address.equals(placeholderAthWallet)).toBe(true);

    await registry.send(caller.getSender(), { value: toNano('0.05') }, {
      $$type: 'UsernameRegistryTopUpStorageReserve',
    } as UsernameRegistryTopUpStorageReserve);

    state = await registry.getGetGlobal();
    expect(state.sealed).toBe(false);
    expect(state.official_ath_wallet_bound).toBe(false);
    expect(state.name_record_count).toBe(0n);
    expect(state.pending_mint_count).toBe(0n);
    expect(state.treasury_due_ath).toBe(0n);
    expect(state.burn_due_ath).toBe(0n);
  });
});
