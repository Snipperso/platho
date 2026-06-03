import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  Vault,
  AthTransferNotification,
  BindProfileRegistry,
  BindUsernameRegistry,
  BindOfficialAthWallet,
  storeDepositTon,
  storeMintUsernameFromVaultBalance,
  RegisterMessagingKeys,
  SealGenesis,
  storeRegisterMessagingKeys,
  storeSetProfileAvatarFromVaultBalance,
  WithdrawAth,
} from '../build/Vault/Vault_Vault';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
  PruneStaleNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockRegistryNotificationNoAck } from '../build/MockRegistryNotificationNoAck/MockRegistryNotificationNoAck_MockRegistryNotificationNoAck';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';
import {
  BindProfileOfficialAthWallet,
  BindProfileVault,
  ProfileRegistry,
  SealGenesis as ProfileSealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import {
  BindOfficialAthWallet as UsernameBindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis as UsernameSealGenesis,
  UsernameItemDeployedAck,
  UsernameRegistry,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const ATH_PENDING_NOTIFICATION_TTL = 86_400;
const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1_000_000n;
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1_000_000n;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7_000_000n;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2_000_000n;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10_000_000n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const PROFILE_AVATAR_TON_CHARGE = 61_000_000n;
const PROFILE_AVATAR_LOCAL_EXEC_RESERVE = 6_000_000n;
const VAULT_PROFILE_AVATAR_SIGNING_DOMAIN = 0x56504131n;
const USERNAME_PRICE_6_PLUS = 100_000_000_000n;
const USERNAME_MINT_TON_CHARGE = 63_000_000n;
const USERNAME_MINT_LOCAL_EXEC_RESERVE = 6_000_000n;
const VAULT_USERNAME_MINT_SIGNING_DOMAIN = 0x56554E31n;
const USERNAME_NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const OP_ATH_TRANSFER_REQUEST_VAULT_PROFILE_AVATAR = 0x4154481A;
const OP_ATH_TRANSFER_ACK = 0x41544811;
const OP_PROFILE_AVATAR_VAULT_NOTIFICATION = 0xA11A7002;
const OP_PROFILE_AVATAR_TON_EXCESS_REFUND = 0x50A61121;
const OP_ATH_TRANSFER_REQUEST_VAULT_MINT_USERNAME = 0x4154481C;
const OP_USERNAME_VAULT_NOTIFICATION = 0x89129D60;
const OP_ATH_TRANSFER_FAILED = 0x41544813;
const VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE = 2_000_000n;
const ATH_OWNER_NOTIFY_MIN_VALUE = ATH_TRANSFER_NOTIFY_MIN_VALUE
  + ATH_TRANSFER_NOTIFY_ACK_VALUE
  + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
  + ATH_TRANSFER_NOTIFY_EXEC_RESERVE
  + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT
  + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE;

function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function senderKey(senderOwner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function usernameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(USERNAME_NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
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

async function installRejectingContractAt(blockchain: Blockchain, address: Address, balance: bigint) {
  const init = await MockUsernameNFTItemNoAck.init();
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance,
    workchain: address.workChain,
  }));
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

function inboundInternalValue(tx: any): bigint {
  const info = tx?.inMessage?.info;
  if (info?.type !== 'internal') {
    throw new Error('expected an inbound internal message');
  }
  return info.value.coins;
}

function profileAvatarExcessCredit(tx: any): bigint {
  const value = inboundInternalValue(tx);
  if (value <= VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE) {
    return 0n;
  }
  return value - VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE;
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
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: fixtureAddress('VAULT_ATH_PROFILE_REGISTRY'),
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress('VAULT_ATH_USERNAME_REGISTRY'),
  } as BindUsernameRegistry);
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

async function setupProfileAvatarRoute() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-avatar-controller');
  const user = await blockchain.treasury('vault-avatar-user');
  const capsuleHub = await blockchain.treasury('vault-avatar-capsulehub');
  const athMaster = fixtureAddress('VAULT_AVATAR_ATH_MASTER');
  const profileTreasury = fixtureAddress('VAULT_AVATAR_PROFILE_TREASURY');

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

  const profileInit = await ProfileRegistry.init(
    fixtureAddress('VAULT_AVATAR_PROFILE_PLACEHOLDER'),
    athMaster,
    profileTreasury,
    false,
    0n,
    0n,
    controller.address,
  );
  const profileAddress = contractAddress(0, profileInit);
  const officialProfileAthWallet = await athWalletAddress(profileAddress, athMaster);

  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('3'),
    workchain: vaultAddress.workChain,
  }));
  await blockchain.setShardAccount(profileAddress, createShardAccount({
    address: profileAddress,
    code: profileInit.code,
    data: profileInit.data,
    balance: toNano('3'),
    workchain: profileAddress.workChain,
  }));

  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));
  const profileRegistry = blockchain.openContract(new ProfileRegistry(profileAddress, profileInit));

  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialVaultAthWallet,
  } as BindOfficialAthWallet);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: profileAddress,
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress('VAULT_AVATAR_USERNAME_REGISTRY'),
  } as BindUsernameRegistry);
  await profileRegistry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialProfileAthWallet,
  } as BindProfileOfficialAthWallet);
  await profileRegistry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindProfileVault);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);
  await profileRegistry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as ProfileSealGenesis);

  const userAthWallet = await deployAthWallet(
    blockchain,
    user.address,
    athMaster,
    PROFILE_AVATAR_PRICE_ATH * 3n,
    toNano('3'),
  );

  return {
    blockchain,
    vault,
    profileRegistry,
    user,
    userAthWallet,
    officialVaultAthWallet,
    officialProfileAthWallet,
  };
}

async function setupProfileAvatarNoAckRoute() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-avatar-noack-controller');
  const user = await blockchain.treasury('vault-avatar-noack-user');
  const capsuleHub = await blockchain.treasury('vault-avatar-noack-capsulehub');
  const athMaster = fixtureAddress('VAULT_AVATAR_NOACK_ATH_MASTER');

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

  const noAckInit = await MockRegistryNotificationNoAck.init();
  const profileAddress = contractAddress(0, noAckInit);
  const officialProfileAthWallet = await athWalletAddress(profileAddress, athMaster);

  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('3'),
    workchain: vaultAddress.workChain,
  }));
  await blockchain.setShardAccount(profileAddress, createShardAccount({
    address: profileAddress,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('3'),
    workchain: profileAddress.workChain,
  }));

  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));
  const profileRegistry = blockchain.openContract(new MockRegistryNotificationNoAck(profileAddress, noAckInit));

  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialVaultAthWallet,
  } as BindOfficialAthWallet);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: profileAddress,
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress('VAULT_AVATAR_NOACK_USERNAME_REGISTRY'),
  } as BindUsernameRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  const userAthWallet = await deployAthWallet(
    blockchain,
    user.address,
    athMaster,
    PROFILE_AVATAR_PRICE_ATH * 3n,
    toNano('3'),
  );

  return {
    blockchain,
    vault,
    profileRegistry,
    user,
    userAthWallet,
    officialVaultAthWallet,
    officialProfileAthWallet,
  };
}

async function setupUsernameMintRoute() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-username-controller');
  const user = await blockchain.treasury('vault-username-user');
  const capsuleHub = await blockchain.treasury('vault-username-capsulehub');
  const athMaster = fixtureAddress('VAULT_USERNAME_ATH_MASTER');
  const usernameTreasury = fixtureAddress('VAULT_USERNAME_TREASURY');

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

  const usernameInit = await UsernameRegistry.init(
    fixtureAddress('VAULT_USERNAME_PLACEHOLDER'),
    athMaster,
    usernameTreasury,
    false,
    0n,
    0n,
    controller.address,
  );
  const usernameAddress = contractAddress(0, usernameInit);
  const officialUsernameAthWallet = await athWalletAddress(usernameAddress, athMaster);

  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('3'),
    workchain: vaultAddress.workChain,
  }));
  await blockchain.setShardAccount(usernameAddress, createShardAccount({
    address: usernameAddress,
    code: usernameInit.code,
    data: usernameInit.data,
    balance: toNano('3'),
    workchain: usernameAddress.workChain,
  }));

  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));
  const usernameRegistry = blockchain.openContract(new UsernameRegistry(usernameAddress, usernameInit));

  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialVaultAthWallet,
  } as BindOfficialAthWallet);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: usernameAddress,
  } as BindUsernameRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: fixtureAddress('VAULT_USERNAME_PROFILE_REGISTRY'),
  } as BindProfileRegistry);
  await usernameRegistry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialUsernameAthWallet,
  } as UsernameBindOfficialAthWallet);
  await usernameRegistry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);
  await usernameRegistry.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as UsernameSealGenesis);

  const userAthWallet = await deployAthWallet(
    blockchain,
    user.address,
    athMaster,
    USERNAME_PRICE_6_PLUS * 3n,
    toNano('3'),
  );

  return {
    blockchain,
    vault,
    usernameRegistry,
    user,
    userAthWallet,
    officialVaultAthWallet,
    officialUsernameAthWallet,
  };
}

async function setupUsernameMintNoAckRoute() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-username-noack-controller');
  const user = await blockchain.treasury('vault-username-noack-user');
  const capsuleHub = await blockchain.treasury('vault-username-noack-capsulehub');
  const athMaster = fixtureAddress('VAULT_USERNAME_NOACK_ATH_MASTER');

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

  const noAckInit = await MockRegistryNotificationNoAck.init();
  const usernameAddress = contractAddress(0, noAckInit);
  const officialUsernameAthWallet = await athWalletAddress(usernameAddress, athMaster);

  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('3'),
    workchain: vaultAddress.workChain,
  }));
  await blockchain.setShardAccount(usernameAddress, createShardAccount({
    address: usernameAddress,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('3'),
    workchain: usernameAddress.workChain,
  }));

  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));
  const usernameRegistry = blockchain.openContract(new MockRegistryNotificationNoAck(usernameAddress, noAckInit));

  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialVaultAthWallet,
  } as BindOfficialAthWallet);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: usernameAddress,
  } as BindUsernameRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: fixtureAddress('VAULT_USERNAME_NOACK_PROFILE_REGISTRY'),
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  const userAthWallet = await deployAthWallet(
    blockchain,
    user.address,
    athMaster,
    USERNAME_PRICE_6_PLUS * 3n,
    toNano('3'),
  );

  return {
    blockchain,
    vault,
    usernameRegistry,
    user,
    userAthWallet,
    officialVaultAthWallet,
    officialUsernameAthWallet,
  };
}

async function registerAvatarRouteKeys(vault: any, user: any) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, 13));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, 83));
  await vault.send(user.getSender(), { value: toNano('0.05') }, {
    $$type: 'RegisterMessagingKeys',
    ...hybridMessagingKeyFields(
      1n,
      BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
      BigInt('0x' + authKeyPair.publicKey.toString('hex')),
    ),
  } as RegisterMessagingKeys);
  return authKeyPair;
}

async function registerSharedAvatarRouteKeys(vault: any, users: any[]) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, 13));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, 83));
  for (const user of users) {
    await vault.send(user.getSender(), { value: toNano('0.05') }, {
      $$type: 'RegisterMessagingKeys',
      ...hybridMessagingKeyFields(
        1n,
        BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
        BigInt('0x' + authKeyPair.publicKey.toString('hex')),
      ),
    } as RegisterMessagingKeys);
  }
  return authKeyPair;
}

async function registerKeysFromAddress(blockchain: Blockchain, vault: any, owner: Address, seedByte: number) {
  const messagingKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte));
  const authKeyPair = keyPairFromSeed(Buffer.alloc(32, seedByte + 64));
  await blockchain.sendMessage(internal({
    from: owner,
    to: vault.address,
    value: toNano('0.05'),
    body: beginCell().store(storeRegisterMessagingKeys({
      $$type: 'RegisterMessagingKeys',
      ...hybridMessagingKeyFields(
        1n,
        BigInt('0x' + messagingKeyPair.publicKey.toString('hex')),
        BigInt('0x' + authKeyPair.publicKey.toString('hex')),
      ),
    } as RegisterMessagingKeys)).endCell(),
  }));
  return authKeyPair;
}

async function depositTonFromAddress(blockchain: Blockchain, vault: any, owner: Address, amount: bigint) {
  await blockchain.sendMessage(internal({
    from: owner,
    to: vault.address,
    value: amount + 12_000_000n,
    body: beginCell().store(storeDepositTon({
      $$type: 'DepositTon',
      amount,
    })).endCell(),
  }));
}

function signedVaultProfileAvatarBody(params: {
  vault: any;
  owner: Address;
  outerOwner?: Address;
  profileRegistry: any;
  clientNonce: bigint;
  secretKey: Buffer;
  maxTonCharge?: bigint;
  signedVault?: Address;
  avatarHash: bigint;
  avatarEntryId: bigint;
  avatarStreamId: bigint;
  avatarPartCount: bigint;
  trailingPayloadBit?: boolean;
}) {
  const avatarPayloadBuilder = beginCell()
    .storeAddress(params.profileRegistry.address)
    .storeUint(params.avatarHash, 256)
    .storeUint(params.avatarEntryId, 64)
    .storeUint(params.avatarStreamId, 128)
    .storeUint(params.avatarPartCount, 16)
    .storeUint(1n, 8);
  if (params.trailingPayloadBit) {
    avatarPayloadBuilder.storeBit(true);
  }
  const avatarPayload = avatarPayloadBuilder.endCell();
  const signedPayload = beginCell()
    .storeUint(VAULT_PROFILE_AVATAR_SIGNING_DOMAIN, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeAddress(params.owner)
    .storeUint(params.clientNonce, 64)
    .storeUint(params.maxTonCharge ?? PROFILE_AVATAR_TON_CHARGE, 128)
    .storeAddress(params.signedVault ?? params.vault.address)
    .storeRef(avatarPayload)
    .endCell();
  return beginCell().store(storeSetProfileAvatarFromVaultBalance({
    $$type: 'SetProfileAvatarFromVaultBalance',
    owner_wallet: params.outerOwner ?? params.owner,
    signature: sign(signedPayload.hash(), params.secretKey),
    signed_payload: signedPayload,
  })).endCell();
}

function signedVaultUsernameMintBody(params: {
  vault: any;
  owner: Address;
  outerOwner?: Address;
  usernameRegistry: any;
  clientNonce: bigint;
  secretKey: Buffer;
  maxTonCharge?: bigint;
  signedVault?: Address;
  username: string;
  trailingPayloadBit?: boolean;
}) {
  const usernamePayloadBuilder = beginCell()
    .storeAddress(params.usernameRegistry.address)
    .storeUint(Buffer.from(params.username, 'ascii').length, 8)
    .storeSlice(usernameSlice(params.username));
  if (params.trailingPayloadBit) {
    usernamePayloadBuilder.storeBit(true);
  }
  const usernamePayload = usernamePayloadBuilder.endCell();
  const signedPayload = beginCell()
    .storeUint(VAULT_USERNAME_MINT_SIGNING_DOMAIN, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeAddress(params.owner)
    .storeUint(params.clientNonce, 64)
    .storeUint(params.maxTonCharge ?? USERNAME_MINT_TON_CHARGE, 128)
    .storeAddress(params.signedVault ?? params.vault.address)
    .storeRef(usernamePayload)
    .endCell();
  return beginCell().store(storeMintUsernameFromVaultBalance({
    $$type: 'MintUsernameFromVaultBalance',
    owner_wallet: params.outerOwner ?? params.owner,
    signature: sign(signedPayload.hash(), params.secretKey),
    signed_payload: signedPayload,
  })).endCell();
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

    await vault.send(user.getSender(), { value: toNano('0.04') }, {
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
    expect(afterUser.ton_balance - beforeUser.ton_balance).toBeLessThanOrEqual(toNano('0.04'));
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
        + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE
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

  it('VAULT-ATH-06: Vault-funded profile avatar registration spends internal Vault ATH, not the user ATH wallet', async () => {
    const ctx = await setupProfileAvatarRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: PROFILE_AVATAR_PRICE_ATH * 2n,
      queryId: 601n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    const beforeSourceWallet = await ctx.userAthWallet.getGetWalletData();
    expect(beforeUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH * 2n);
    expect(beforeSourceWallet.balance).toBe(PROFILE_AVATAR_PRICE_ATH);

    const avatarHash = 0x661122n;
    const body = signedVaultProfileAvatarBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: beforeUser.publish_nonce,
      secretKey: keyPair.secretKey,
      avatarHash,
      avatarEntryId: 71n,
      avatarStreamId: 0x11223344556677889900aabbccddeeffn,
      avatarPartCount: 2n,
    });
    const result = await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body,
    }));

    const avatar = await ctx.profileRegistry.getGetAvatar(ctx.user.address);
    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    const afterSourceWallet = await ctx.userAthWallet.getGetWalletData();
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const profileOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialProfileAthWallet));
    const rawAfterFirst = await contractBalance(ctx.blockchain, ctx.vault.address);

    expect(avatar.exists).toBe(true);
    expect(avatar.owner_wallet.equals(ctx.user.address)).toBe(true);
    expect(avatar.avatar_hash).toBe(avatarHash);
    expect(afterUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(afterUser.publish_nonce).toBe(beforeUser.publish_nonce + 1n);
    expect(afterGlobal.pending_profile_avatar_payment_count).toBe(0n);
    expect(afterSourceWallet.balance).toBe(beforeSourceWallet.balance);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await profileOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(findTransaction(result.transactions, {
      from: ctx.vault.address,
      to: ctx.officialVaultAthWallet,
      op: OP_ATH_TRANSFER_REQUEST_VAULT_PROFILE_AVATAR,
      success: true,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.officialProfileAthWallet,
      to: ctx.profileRegistry.address,
      op: OP_PROFILE_AVATAR_VAULT_NOTIFICATION,
      success: true,
    })).toBeDefined();
    const firstExcessRefundTx = findTransaction(result.transactions, {
      from: ctx.profileRegistry.address,
      to: ctx.vault.address,
      op: OP_PROFILE_AVATAR_TON_EXCESS_REFUND,
      success: true,
    });
    expect(firstExcessRefundTx).toBeDefined();
    const firstExcessCredit = profileAvatarExcessCredit(firstExcessRefundTx);
    expect(firstExcessCredit).toBeGreaterThan(0n);
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance - PROFILE_AVATAR_TON_CHARGE + firstExcessCredit);
    expect(findTransaction(result.transactions, {
      from: ctx.userAthWallet.address,
    })).toBeUndefined();

    await expect(ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body,
    }))).rejects.toMatchObject({ exitCode: 16611 });
    const afterReplay = await ctx.vault.getGetUser(ctx.user.address);
    const rawAfterReplay = await contractBalance(ctx.blockchain, ctx.vault.address);
    expect(afterReplay.ton_balance).toBe(afterUser.ton_balance);
    expect(afterReplay.ath_balance).toBe(afterUser.ath_balance);
    expect(afterReplay.publish_nonce).toBe(afterUser.publish_nonce);
    expect(rawAfterReplay).toBe(rawAfterFirst);

    const secondAvatarHash = 0x661133n;
    const secondBody = signedVaultProfileAvatarBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: afterReplay.publish_nonce,
      secretKey: keyPair.secretKey,
      avatarHash: secondAvatarHash,
      avatarEntryId: 72n,
      avatarStreamId: 0x21223344556677889900aabbccddeeffn,
      avatarPartCount: 3n,
    });
    const secondResult = await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: secondBody,
    }));
    const secondExcessRefundTx = findTransaction(secondResult.transactions, {
      from: ctx.profileRegistry.address,
      to: ctx.vault.address,
      op: OP_PROFILE_AVATAR_TON_EXCESS_REFUND,
      success: true,
    });
    expect(secondExcessRefundTx).toBeDefined();
    const secondExcessCredit = profileAvatarExcessCredit(secondExcessRefundTx);
    expect(secondExcessCredit).toBeGreaterThan(firstExcessCredit);

    const secondAvatar = await ctx.profileRegistry.getGetAvatar(ctx.user.address);
    const afterSecond = await ctx.vault.getGetUser(ctx.user.address);
    expect(secondAvatar.exists).toBe(true);
    expect(secondAvatar.version).toBe(2n);
    expect(secondAvatar.avatar_hash).toBe(secondAvatarHash);
    expect(afterSecond.ath_balance).toBe(0n);
    expect(afterSecond.ton_balance).toBe(afterReplay.ton_balance - PROFILE_AVATAR_TON_CHARGE + secondExcessCredit);
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n);
  });

  it('VAULT-ATH-06B: Vault-funded profile avatar stale nonce and unpaid invalid charge reject without raw spend', async () => {
    const ctx = await setupProfileAvatarRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });

    async function expectRejectedWithoutRawSpend(owner: Address, body: any, exitCode: number) {
      const before = await ctx.vault.getGetUser(owner);
      const rawBefore = await contractBalance(ctx.blockchain, ctx.vault.address);
      await expect(ctx.blockchain.sendMessage(external({
        to: ctx.vault.address,
        body,
      }))).rejects.toMatchObject({ exitCode });
      const after = await ctx.vault.getGetUser(owner);
      const rawAfter = await contractBalance(ctx.blockchain, ctx.vault.address);
      expect(after.ton_balance).toBe(before.ton_balance);
      expect(after.ath_balance).toBe(before.ath_balance);
      expect(after.publish_nonce).toBe(before.publish_nonce);
      expect(rawAfter).toBe(rawBefore);
    }
    async function expectAcceptedReturnChargesLocalReserve(owner: Address, body: any, localReserve: bigint) {
      const before = await ctx.vault.getGetUser(owner);
      const rawBefore = await contractBalance(ctx.blockchain, ctx.vault.address);
      const result = await ctx.blockchain.sendMessage(external({
        to: ctx.vault.address,
        body,
      }));
      const after = await ctx.vault.getGetUser(owner);
      const rawAfter = await contractBalance(ctx.blockchain, ctx.vault.address);
      const tx = result.transactions[0];
      expect(tx.description.type).toBe('generic');
      if (tx.description.type === 'generic' && tx.description.computePhase.type === 'vm') {
        expect(tx.description.computePhase.exitCode).toBe(0);
      }
      expect(after.ton_balance).toBe(before.ton_balance - localReserve);
      expect(after.ath_balance).toBe(before.ath_balance);
      expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
      expect(rawAfter).toBeLessThan(rawBefore);
    }
    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await expectRejectedWithoutRawSpend(ctx.user.address, signedVaultProfileAvatarBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: beforeUser.publish_nonce + 1n,
      secretKey: keyPair.secretKey,
      avatarHash: 0x661123n,
      avatarEntryId: 72n,
      avatarStreamId: 0x11223344556677889900aabbccddee01n,
      avatarPartCount: 1n,
    }), 16611);

    await expectAcceptedReturnChargesLocalReserve(ctx.user.address, signedVaultProfileAvatarBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: beforeUser.publish_nonce,
      secretKey: keyPair.secretKey,
      maxTonCharge: PROFILE_AVATAR_LOCAL_EXEC_RESERVE - 1n,
      avatarHash: 0x661124n,
      avatarEntryId: 73n,
      avatarStreamId: 0x11223344556677889900aabbccddee02n,
      avatarPartCount: 1n,
    }), PROFILE_AVATAR_LOCAL_EXEC_RESERVE);

    const afterBadMax = await ctx.vault.getGetUser(ctx.user.address);
    await expectAcceptedReturnChargesLocalReserve(ctx.user.address, signedVaultProfileAvatarBody({
      vault: ctx.vault,
      signedVault: ctx.profileRegistry.address,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: afterBadMax.publish_nonce,
      secretKey: keyPair.secretKey,
      avatarHash: 0x661127n,
      avatarEntryId: 76n,
      avatarStreamId: 0x11223344556677889900aabbccddee05n,
      avatarPartCount: 1n,
    }), PROFILE_AVATAR_LOCAL_EXEC_RESERVE);

    const afterBadVault = await ctx.vault.getGetUser(ctx.user.address);
    await expectAcceptedReturnChargesLocalReserve(ctx.user.address, signedVaultProfileAvatarBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: afterBadVault.publish_nonce,
      secretKey: keyPair.secretKey,
      avatarHash: 0n,
      avatarEntryId: 77n,
      avatarStreamId: 0x11223344556677889900aabbccddee06n,
      avatarPartCount: 1n,
    }), PROFILE_AVATAR_LOCAL_EXEC_RESERVE);

    const underfunded = await ctx.blockchain.treasury('vault-avatar-underfunded');
    const underfundedKeyPair = await registerAvatarRouteKeys(ctx.vault, underfunded);
    const underfundedBefore = await ctx.vault.getGetUser(underfunded.address);
    await expectRejectedWithoutRawSpend(underfunded.address, signedVaultProfileAvatarBody({
      vault: ctx.vault,
      owner: underfunded.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: underfundedBefore.publish_nonce,
      secretKey: underfundedKeyPair.secretKey,
      avatarHash: 0x661125n,
      avatarEntryId: 74n,
      avatarStreamId: 0x11223344556677889900aabbccddee03n,
      avatarPartCount: 1n,
    }), 16614);

    const beforeMalformed = await ctx.vault.getGetUser(ctx.user.address);
    const rawBeforeMalformed = await contractBalance(ctx.blockchain, ctx.vault.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultProfileAvatarBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        profileRegistry: ctx.profileRegistry,
        clientNonce: beforeMalformed.publish_nonce,
        secretKey: keyPair.secretKey,
        avatarHash: 0x661126n,
        avatarEntryId: 75n,
        avatarStreamId: 0x11223344556677889900aabbccddee04n,
        avatarPartCount: 1n,
        trailingPayloadBit: true,
      }),
    }));
    const afterMalformed = await ctx.vault.getGetUser(ctx.user.address);
    const rawAfterMalformed = await contractBalance(ctx.blockchain, ctx.vault.address);
    const globalAfterMalformed = await ctx.vault.getGetGlobal();
    expect(afterMalformed.ton_balance).toBe(beforeMalformed.ton_balance - PROFILE_AVATAR_LOCAL_EXEC_RESERVE);
    expect(afterMalformed.ath_balance).toBe(beforeMalformed.ath_balance);
    expect(afterMalformed.publish_nonce).toBe(beforeMalformed.publish_nonce + 1n);
    expect(globalAfterMalformed.pending_profile_avatar_payment_count).toBe(0n);
    expect(rawAfterMalformed - afterMalformed.ton_balance).toBeGreaterThanOrEqual(rawBeforeMalformed - beforeMalformed.ton_balance);

  });

  it('VAULT-ATH-06B2: same-auth two-wallet profile avatar replay is owner-domain separated', async () => {
    const ctx = await setupProfileAvatarRoute();
    const attacker = await ctx.blockchain.treasury('vault-avatar-same-auth-attacker');
    const keyPair = await registerSharedAvatarRouteKeys(ctx.vault, [ctx.user, attacker]);
    const attackerBefore = await ctx.vault.getGetUser(attacker.address);
    const rawBefore = await contractBalance(ctx.blockchain, ctx.vault.address);

    await expect(ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultProfileAvatarBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        outerOwner: attacker.address,
        profileRegistry: ctx.profileRegistry,
        clientNonce: attackerBefore.publish_nonce,
        secretKey: keyPair.secretKey,
        avatarHash: 0x661127n,
        avatarEntryId: 76n,
        avatarStreamId: 0x11223344556677889900aabbccddee05n,
        avatarPartCount: 1n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16618 });

    const attackerAfter = await ctx.vault.getGetUser(attacker.address);
    const rawAfter = await contractBalance(ctx.blockchain, ctx.vault.address);
    expect(attackerAfter.ton_balance).toBe(attackerBefore.ton_balance);
    expect(attackerAfter.ath_balance).toBe(attackerBefore.ath_balance);
    expect(attackerAfter.publish_nonce).toBe(attackerBefore.publish_nonce);
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n);
    expect(rawAfter).toBe(rawBefore);
  });

  it('VAULT-ATH-06C: Vault-funded profile notification prune cannot refund after registry acceptance', async () => {
    const ctx = await setupProfileAvatarNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: PROFILE_AVATAR_PRICE_ATH * 2n,
      queryId: 661n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    const avatarHash = 0x6611ffn;
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultProfileAvatarBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        profileRegistry: ctx.profileRegistry,
        clientNonce: beforeUser.publish_nonce,
        secretKey: keyPair.secretKey,
        avatarHash,
        avatarEntryId: 81n,
        avatarStreamId: 0x21223344556677889900aabbccddeeffn,
        avatarPartCount: 2n,
      }),
    }));

    const pendingState = await ctx.profileRegistry.getGetState();
    const midUser = await ctx.vault.getGetUser(ctx.user.address);
    const midGlobal = await ctx.vault.getGetGlobal();
    const profileOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialProfileAthWallet));
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const key = senderKey(ctx.vault.address, pendingState.last_query_id);

    expect(pendingState.profile_count).toBe(1n);
    expect(midUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(midGlobal.pending_profile_avatar_payment_count).toBe(1n);
    expect((await profileOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await profileOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    const prune = await profileOfficialWallet.send(ctx.user.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleNotification',
      query_id: pendingState.last_query_id,
      sender_key: key,
    } as PruneStaleNotification);

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    expect(afterUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(afterGlobal.pending_profile_avatar_payment_count).toBe(1n);
    expect((await profileOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await profileOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);
    expect(findTransaction(prune.transactions, {
      from: ctx.user.address,
      to: ctx.officialProfileAthWallet,
      success: false,
    })).toBeDefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
    })).toBeUndefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialProfileAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
    })).toBeUndefined();
  });

  it('VAULT-ATH-06D: Vault-funded profile stale prune keeps pending even if refund wallet would reject', async () => {
    const ctx = await setupProfileAvatarNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: PROFILE_AVATAR_PRICE_ATH * 2n,
      queryId: 662n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultProfileAvatarBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        profileRegistry: ctx.profileRegistry,
        clientNonce: beforeUser.publish_nonce,
        secretKey: keyPair.secretKey,
        avatarHash: 0x6612ffn,
        avatarEntryId: 82n,
        avatarStreamId: 0x31223344556677889900aabbccddeeffn,
        avatarPartCount: 2n,
      }),
    }));

    const pendingState = await ctx.profileRegistry.getGetState();
    const midUser = await ctx.vault.getGetUser(ctx.user.address);
    const midGlobal = await ctx.vault.getGetGlobal();
    const profileOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialProfileAthWallet));
    const key = senderKey(ctx.vault.address, pendingState.last_query_id);

    expect(midUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(midGlobal.pending_profile_avatar_payment_count).toBe(1n);
    expect((await profileOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await profileOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);

    const vaultWalletRawBalance = await contractBalance(ctx.blockchain, ctx.officialVaultAthWallet);
    await installRejectingContractAt(ctx.blockchain, ctx.officialVaultAthWallet, vaultWalletRawBalance);

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    const prune = await profileOfficialWallet.send(ctx.user.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleNotification',
      query_id: pendingState.last_query_id,
      sender_key: key,
    } as PruneStaleNotification);

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    expect(afterUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(afterGlobal.pending_profile_avatar_payment_count).toBe(1n);
    expect((await profileOfficialWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await profileOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);
    expect(findTransaction(prune.transactions, {
      from: ctx.user.address,
      to: ctx.officialProfileAthWallet,
      success: false,
    })).toBeDefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
    })).toBeUndefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialProfileAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
    })).toBeUndefined();
  });

  it('VAULT-ATH-07: Vault-funded username mint spends internal Vault ATH, not the user ATH wallet', async () => {
    const ctx = await setupUsernameMintRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: USERNAME_PRICE_6_PLUS * 2n,
      queryId: 701n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    const beforeSourceWallet = await ctx.userAthWallet.getGetWalletData();
    expect(beforeUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS * 2n);
    expect(beforeSourceWallet.balance).toBe(USERNAME_PRICE_6_PLUS);

    const username = 'platho_1-x';
    const hash = usernameHash(username);
    const body = signedVaultUsernameMintBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: beforeUser.publish_nonce,
      secretKey: keyPair.secretKey,
      username,
    });
    const result = await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body,
    }));

    const record = await ctx.usernameRegistry.getGetNameRecord(hash);
    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    const afterSourceWallet = await ctx.userAthWallet.getGetWalletData();
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));
    const rawAfterFirst = await contractBalance(ctx.blockchain, ctx.vault.address);

    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(ctx.user.address)).toBe(true);
    expect(afterUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(afterUser.publish_nonce).toBe(beforeUser.publish_nonce + 1n);
    expect(afterGlobal.pending_username_mint_payment_count).toBe(0n);
    expect(afterSourceWallet.balance).toBe(beforeSourceWallet.balance);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(findTransaction(result.transactions, {
      from: ctx.vault.address,
      to: ctx.officialVaultAthWallet,
      op: OP_ATH_TRANSFER_REQUEST_VAULT_MINT_USERNAME,
      success: true,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.officialUsernameAthWallet,
      to: ctx.usernameRegistry.address,
      op: OP_USERNAME_VAULT_NOTIFICATION,
      success: true,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.userAthWallet.address,
    })).toBeUndefined();

    await expect(ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body,
    }))).rejects.toMatchObject({ exitCode: 16711 });
    const afterReplay = await ctx.vault.getGetUser(ctx.user.address);
    const rawAfterReplay = await contractBalance(ctx.blockchain, ctx.vault.address);
    expect(afterReplay.ton_balance).toBe(afterUser.ton_balance);
    expect(afterReplay.ath_balance).toBe(afterUser.ath_balance);
    expect(afterReplay.publish_nonce).toBe(afterUser.publish_nonce);
    expect(rawAfterReplay).toBe(rawAfterFirst);
  });

  it('VAULT-ATH-07B: Vault-funded username stale nonce and unpaid invalid charge reject without raw spend', async () => {
    const ctx = await setupUsernameMintRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });

    async function expectRejectedWithoutRawSpend(owner: Address, body: any, exitCode: number) {
      const before = await ctx.vault.getGetUser(owner);
      const rawBefore = await contractBalance(ctx.blockchain, ctx.vault.address);
      await expect(ctx.blockchain.sendMessage(external({
        to: ctx.vault.address,
        body,
      }))).rejects.toMatchObject({ exitCode });
      const after = await ctx.vault.getGetUser(owner);
      const rawAfter = await contractBalance(ctx.blockchain, ctx.vault.address);
      expect(after.ton_balance).toBe(before.ton_balance);
      expect(after.ath_balance).toBe(before.ath_balance);
      expect(after.publish_nonce).toBe(before.publish_nonce);
      expect(rawAfter).toBe(rawBefore);
    }
    async function expectAcceptedReturnChargesLocalReserve(owner: Address, body: any, localReserve: bigint) {
      const before = await ctx.vault.getGetUser(owner);
      const rawBefore = await contractBalance(ctx.blockchain, ctx.vault.address);
      const result = await ctx.blockchain.sendMessage(external({
        to: ctx.vault.address,
        body,
      }));
      const after = await ctx.vault.getGetUser(owner);
      const rawAfter = await contractBalance(ctx.blockchain, ctx.vault.address);
      const tx = result.transactions[0];
      expect(tx.description.type).toBe('generic');
      if (tx.description.type === 'generic' && tx.description.computePhase.type === 'vm') {
        expect(tx.description.computePhase.exitCode).toBe(0);
      }
      expect(after.ton_balance).toBe(before.ton_balance - localReserve);
      expect(after.ath_balance).toBe(before.ath_balance);
      expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
      expect(rawAfter).toBeLessThan(rawBefore);
    }
    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await expectRejectedWithoutRawSpend(ctx.user.address, signedVaultUsernameMintBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: beforeUser.publish_nonce + 1n,
      secretKey: keyPair.secretKey,
      username: 'platho',
    }), 16711);

    await expectAcceptedReturnChargesLocalReserve(ctx.user.address, signedVaultUsernameMintBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: beforeUser.publish_nonce,
      secretKey: keyPair.secretKey,
      maxTonCharge: USERNAME_MINT_LOCAL_EXEC_RESERVE - 1n,
      username: 'platho',
    }), USERNAME_MINT_LOCAL_EXEC_RESERVE);

    const afterBadMax = await ctx.vault.getGetUser(ctx.user.address);
    await expectAcceptedReturnChargesLocalReserve(ctx.user.address, signedVaultUsernameMintBody({
      vault: ctx.vault,
      signedVault: ctx.usernameRegistry.address,
      owner: ctx.user.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: afterBadMax.publish_nonce,
      secretKey: keyPair.secretKey,
      username: 'platho',
    }), USERNAME_MINT_LOCAL_EXEC_RESERVE);

    const underfunded = await ctx.blockchain.treasury('vault-username-underfunded');
    const underfundedKeyPair = await registerAvatarRouteKeys(ctx.vault, underfunded);
    const underfundedBefore = await ctx.vault.getGetUser(underfunded.address);
    await expectRejectedWithoutRawSpend(underfunded.address, signedVaultUsernameMintBody({
      vault: ctx.vault,
      owner: underfunded.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: underfundedBefore.publish_nonce,
      secretKey: underfundedKeyPair.secretKey,
      username: 'platho',
    }), 16714);

    const beforeMalformed = await ctx.vault.getGetUser(ctx.user.address);
    const rawBeforeMalformed = await contractBalance(ctx.blockchain, ctx.vault.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: beforeMalformed.publish_nonce,
        secretKey: keyPair.secretKey,
        username: 'platho',
        trailingPayloadBit: true,
      }),
    }));
    const afterMalformed = await ctx.vault.getGetUser(ctx.user.address);
    const rawAfterMalformed = await contractBalance(ctx.blockchain, ctx.vault.address);
    const globalAfterMalformed = await ctx.vault.getGetGlobal();
    expect(afterMalformed.ton_balance).toBe(beforeMalformed.ton_balance - USERNAME_MINT_LOCAL_EXEC_RESERVE);
    expect(afterMalformed.ath_balance).toBe(beforeMalformed.ath_balance);
    expect(afterMalformed.publish_nonce).toBe(beforeMalformed.publish_nonce + 1n);
    expect(globalAfterMalformed.pending_username_mint_payment_count).toBe(0n);
    expect(rawAfterMalformed - afterMalformed.ton_balance).toBeGreaterThanOrEqual(rawBeforeMalformed - beforeMalformed.ton_balance);

  });

  it('VAULT-ATH-07B2: same-auth two-wallet username mint replay is owner-domain separated', async () => {
    const ctx = await setupUsernameMintRoute();
    const attacker = await ctx.blockchain.treasury('vault-username-same-auth-attacker');
    const keyPair = await registerSharedAvatarRouteKeys(ctx.vault, [ctx.user, attacker]);
    const attackerBefore = await ctx.vault.getGetUser(attacker.address);
    const rawBefore = await contractBalance(ctx.blockchain, ctx.vault.address);

    await expect(ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        outerOwner: attacker.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: attackerBefore.publish_nonce,
        secretKey: keyPair.secretKey,
        username: 'platho_3',
      }),
    }))).rejects.toMatchObject({ exitCode: 16716 });

    const attackerAfter = await ctx.vault.getGetUser(attacker.address);
    const rawAfter = await contractBalance(ctx.blockchain, ctx.vault.address);
    expect(attackerAfter.ton_balance).toBe(attackerBefore.ton_balance);
    expect(attackerAfter.ath_balance).toBe(attackerBefore.ath_balance);
    expect(attackerAfter.publish_nonce).toBe(attackerBefore.publish_nonce);
    expect((await ctx.vault.getGetGlobal()).pending_username_mint_payment_count).toBe(0n);
    expect(rawAfter).toBe(rawBefore);
  });

  it('VAULT-ATH-07B3: Vault-funded username mint requires bound username registry before accepting', async () => {
    const blockchain = await Blockchain.create();
    const controller = await blockchain.treasury('vault-username-unbound-controller');
    const user = await blockchain.treasury('vault-username-unbound-user');
    const capsuleHub = await blockchain.treasury('vault-username-unbound-capsulehub');
    const athMaster = fixtureAddress('VAULT_USERNAME_UNBOUND_ATH_MASTER');
    const vaultInit = await Vault.init(
      controller.address,
      athMaster,
      capsuleHub.address,
      addressHash(controller.address),
      true,
      true,
      MANIFEST_HASH,
    );
    const vaultAddress = contractAddress(0, vaultInit);
    await blockchain.setShardAccount(vaultAddress, createShardAccount({
      address: vaultAddress,
      code: vaultInit.code,
      data: vaultInit.data,
      balance: toNano('1'),
      workchain: vaultAddress.workChain,
    }));
    const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));
    const keyPair = keyPairFromSeed(Buffer.alloc(32, 83));
    const rawBefore = await contractBalance(blockchain, vault.address);

    await expect(blockchain.sendMessage(external({
      to: vault.address,
      body: signedVaultUsernameMintBody({
        vault,
        owner: user.address,
        usernameRegistry: { address: fixtureAddress('VAULT_USERNAME_UNBOUND_REGISTRY') },
        clientNonce: 0n,
        secretKey: keyPair.secretKey,
        username: 'platho',
      }),
    }))).rejects.toMatchObject({ exitCode: 16700 });

    expect(await contractBalance(blockchain, vault.address)).toBe(rawBefore);
  });

  it('VAULT-ATH-07C: Vault-funded username notification prune cannot refund before registry finality', async () => {
    const ctx = await setupUsernameMintNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: USERNAME_PRICE_6_PLUS * 2n,
      queryId: 771n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: beforeUser.publish_nonce,
        secretKey: keyPair.secretKey,
        username: 'platho_2',
      }),
    }));

    const pendingState = await ctx.usernameRegistry.getGetState();
    const midUser = await ctx.vault.getGetUser(ctx.user.address);
    const midGlobal = await ctx.vault.getGetGlobal();
    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const key = senderKey(ctx.vault.address, pendingState.last_query_id);

    expect(pendingState.username_count).toBe(1n);
    expect(midUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(midGlobal.pending_username_mint_payment_count).toBe(1n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    const prune = await usernameOfficialWallet.send(ctx.user.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleNotification',
      query_id: pendingState.last_query_id,
      sender_key: key,
    } as PruneStaleNotification);

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    expect(afterUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(afterGlobal.pending_username_mint_payment_count).toBe(1n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);
    expect(findTransaction(prune.transactions, {
      from: ctx.user.address,
      to: ctx.officialUsernameAthWallet,
      success: false,
    })).toBeDefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
    })).toBeUndefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialUsernameAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
    })).toBeUndefined();
  });

  it('VAULT-ATH-07D: Vault-funded username stale prune keeps pending even if refund wallet would reject', async () => {
    const ctx = await setupUsernameMintNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: USERNAME_PRICE_6_PLUS * 2n,
      queryId: 772n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: beforeUser.publish_nonce,
        secretKey: keyPair.secretKey,
        username: 'platho_3',
      }),
    }));

    const pendingState = await ctx.usernameRegistry.getGetState();
    const midUser = await ctx.vault.getGetUser(ctx.user.address);
    const midGlobal = await ctx.vault.getGetGlobal();
    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));
    const key = senderKey(ctx.vault.address, pendingState.last_query_id);

    expect(midUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(midGlobal.pending_username_mint_payment_count).toBe(1n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);

    const vaultWalletRawBalance = await contractBalance(ctx.blockchain, ctx.officialVaultAthWallet);
    await installRejectingContractAt(ctx.blockchain, ctx.officialVaultAthWallet, vaultWalletRawBalance);

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    const prune = await usernameOfficialWallet.send(ctx.user.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleNotification',
      query_id: pendingState.last_query_id,
      sender_key: key,
    } as PruneStaleNotification);

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    expect(afterUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(afterGlobal.pending_username_mint_payment_count).toBe(1n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingState.last_query_id, key)).exists).toBe(true);
    expect(findTransaction(prune.transactions, {
      from: ctx.user.address,
      to: ctx.officialUsernameAthWallet,
      success: false,
    })).toBeDefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
    })).toBeUndefined();
    expect(findTransaction(prune.transactions, {
      from: ctx.officialUsernameAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
    })).toBeUndefined();
  });

  it('VAULT-ATH-07E: delayed username item ACK after stale prune attempt finalizes without refunding Vault', async () => {
    const ctx = await setupUsernameMintRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    const username = 'platho_4';
    const hash = usernameHash(username);
    const itemAddress = await ctx.usernameRegistry.getGetUsernameItemAddress(hash);

    await installRejectingContractAt(ctx.blockchain, itemAddress, toNano('0.05'));
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: USERNAME_PRICE_6_PLUS * 2n,
      queryId: 773n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: beforeUser.publish_nonce,
        secretKey: keyPair.secretKey,
        username,
      }),
    }));

    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));

    const pendingMint = await ctx.usernameRegistry.getGetPendingMint(hash);
    expect(pendingMint.exists).toBe(true);
    expect((await ctx.usernameRegistry.getGetNameRecord(hash)).exists).toBe(false);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingMint.query_id, pendingMint.sender_key)).exists).toBe(true);

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + ATH_PENDING_NOTIFICATION_TTL + 1;
    const prune = await usernameOfficialWallet.send(ctx.user.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleNotification',
      query_id: pendingMint.query_id,
      sender_key: pendingMint.sender_key,
    } as PruneStaleNotification);

    expect(findTransaction(prune.transactions, {
      from: ctx.user.address,
      to: ctx.officialUsernameAthWallet,
      success: false,
    })).toBeDefined();
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await ctx.vault.getGetGlobal()).pending_username_mint_payment_count).toBe(1n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingMint.query_id, pendingMint.sender_key)).exists).toBe(true);

    const lateAck = await ctx.usernameRegistry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.05') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ctx.user.address,
    } as UsernameItemDeployedAck);

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterVaultGlobal = await ctx.vault.getGetGlobal();
    const afterRegistryGlobal = await ctx.usernameRegistry.getGetGlobal();
    const record = await ctx.usernameRegistry.getGetNameRecord(hash);

    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(ctx.user.address)).toBe(true);
    expect(record.item_address.equals(itemAddress)).toBe(true);
    expect((await ctx.usernameRegistry.getGetPendingMint(hash)).exists).toBe(false);
    expect(afterUser.ath_balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(afterVaultGlobal.pending_username_mint_payment_count).toBe(0n);
    expect(afterRegistryGlobal.treasury_due_ath + afterRegistryGlobal.burn_due_ath).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect((await usernameOfficialWallet.getGetPendingNotification(pendingMint.query_id, pendingMint.sender_key)).exists).toBe(false);
    expect(findTransaction(lateAck.transactions, {
      from: ctx.officialUsernameAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
      success: true,
    })).toBeDefined();
  });

  it('VAULT-ATH-08: duplicate Vault-funded username restores internal Vault ATH instead of creating registry refund due', async () => {
    const ctx = await setupUsernameMintRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.42') }, {
      $$type: 'DepositTon',
      amount: toNano('0.4'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: USERNAME_PRICE_6_PLUS * 3n,
      queryId: 801n,
    });

    const username = 'platho';
    const hash = usernameHash(username);
    const firstUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: firstUser.publish_nonce,
        secretKey: keyPair.secretKey,
        username,
      }),
    }));

    const afterFirst = await ctx.vault.getGetUser(ctx.user.address);
    expect((await ctx.usernameRegistry.getGetNameRecord(hash)).exists).toBe(true);
    expect(afterFirst.ath_balance).toBe(USERNAME_PRICE_6_PLUS * 2n);

    const second = await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: afterFirst.publish_nonce,
        secretKey: keyPair.secretKey,
        username,
      }),
    }));

    const afterSecond = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    const record = await ctx.usernameRegistry.getGetNameRecord(hash);
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));

    expect(record.exists).toBe(true);
    expect(record.owner_wallet.equals(ctx.user.address)).toBe(true);
    expect(afterSecond.ath_balance).toBe(afterFirst.ath_balance);
    expect(afterSecond.publish_nonce).toBe(afterFirst.publish_nonce + 1n);
    expect(afterGlobal.pending_username_mint_payment_count).toBe(0n);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS * 2n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(findTransaction(second.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
      success: true,
    })).toBeDefined();
    expect(findTransaction(second.transactions, {
      from: ctx.officialUsernameAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
    })).toBeUndefined();
  });
});
