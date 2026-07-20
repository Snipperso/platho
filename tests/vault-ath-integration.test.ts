import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  Vault,
  AthTransferNotification,
  ATHTransferAck,
  ATHTransferFailed,
  BindProfileRegistry,
  BindUsernameRegistry,
  BindOfficialAthWallet,
  ProfileAvatarTonExcessRefund,
  PruneStuckAthPending,
  storeDepositTon,
  storeMintUsernameFromVaultBalance,
  RegisterMessagingKeys,
  SealGenesis,
  storeRegisterMessagingKeys,
  storeSetProfileAvatarFromVaultBalance,
} from '../build/Vault/Vault_Vault';
import {
  ATHWallet,
  ATHTransferRequestWithNotify,
  PruneStaleNotification,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { MockRegistryNotificationNoAck } from '../build/MockRegistryNotificationNoAck/MockRegistryNotificationNoAck_MockRegistryNotificationNoAck';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';
import {
  BindProfileOfficialAthWallet,
  ProfileRegistry,
  SealGenesis as ProfileSealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import {
  BindOfficialAthWallet as UsernameBindOfficialAthWallet,
  SealGenesis as UsernameSealGenesis,
  UsernameItemDeployedAck,
  UsernameRegistry,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';
import { sendVaultWithdrawAthExternal } from './helpers/vault-external';

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
// Mirrors ATH_TRANSFER_NOTIFY_MIN_VALUE in ATHWallet.tact, raised 30M -> 45M in clean-17 ("a refused registry
// purchase now actually reaches the payer"). The mirror here was stale at 30M, which is BELOW gate 14306, so every
// deposit in this file was refused at the wallet and 19 of 30 tests died before reaching what they meant to test.
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 45_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const ATH_PENDING_NOTIFICATION_TTL = 86_400;
// clean-16 L6/#18: Vault-side stuck-pending prune windows (must match VAULT_PENDING_PUBLISH_STALE_TTL /
// VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL in Vault.tact).
const VAULT_PENDING_STALE_TTL = 86_400;
const VAULT_PRUNED_TOMBSTONE_TTL = 86_400;
function vaultInternalExitCode(res: any, vaultAddress: Address): number {
  const tx: any = res.transactions.find(
    (t: any) => t.inMessage?.info?.type === 'internal'
      && t.inMessage?.info?.dest?.toString() === vaultAddress.toString(),
  );
  return Number(tx?.description?.computePhase?.exitCode ?? -1);
}
const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1_000_000n;
const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1_000_000n;
const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7_000_000n;
const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 20_000_000n;
const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10_000_000n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const PROFILE_AVATAR_TON_CHARGE = 115_000_000n;
const PROFILE_AVATAR_LOCAL_EXEC_RESERVE = 6_000_000n;
const VAULT_PROFILE_AVATAR_SIGNING_DOMAIN = 0x56504131n;
const USERNAME_PRICE_6_PLUS = 100_000_000_000n;
const USERNAME_MINT_TON_CHARGE = 1_000_000_000n; // clean-16 L2/#14 (owner): EXACTLY 1 TON (6M local exec + 994M ATH-wallet request); storage funded centuries at the real 64962/cell/yr rate
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

// clean-17: UsernameRegistry.name_records is DELETED — THE ITEM IS THE RECORD. There is no get_name_record getter
// and no name_record_count any more. "Is this name minted?" is answered by the chain itself: the item address is a
// pure function of (registry, name_hash), and the account there is either an active UsernameNFTItem whose
// get_state().initialized is true, or the name is free. owner_wallet read from the item is the LIVE owner — it
// tracks TEP-62 transfers, which the deleted record never did. (registered_at has no holder any more at all.)
async function deriveUsernameItemAddress(registry: Address, name: string): Promise<Address> {
  return contractAddress(0, await UsernameNFTItem.init(registry, usernameHash(name)));
}

async function readUsernameItem(blockchain: Blockchain, registry: Address, name: string): Promise<{
  address: Address;
  initialized: boolean;
  owner_wallet: Address | null;
}> {
  const address = await deriveUsernameItemAddress(registry, name);
  const account = await blockchain.getContract(address);
  if (account.accountState?.type !== 'active') {
    return { address, initialized: false, owner_wallet: null };
  }
  try {
    const state = await blockchain.openContract(new UsernameNFTItem(address)).getGetState();
    return { address, initialized: state.initialized, owner_wallet: state.owner_wallet };
  } catch {
    // The account exists but is not a UsernameNFTItem (some tests deliberately park a rejecting stub at the
    // derived address). Not an initialized name.
    return { address, initialized: false, owner_wallet: null };
  }
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
    athMaster,
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

async function setupUsernameMintRoute(options: { registryAthMaster?: Address } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const controller = await blockchain.treasury('vault-username-controller');
  const user = await blockchain.treasury('vault-username-user');
  const capsuleHub = await blockchain.treasury('vault-username-capsulehub');
  const athMaster = fixtureAddress('VAULT_USERNAME_ATH_MASTER');
  const registryAthMaster = options.registryAthMaster ?? athMaster;
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
    registryAthMaster,
    usernameTreasury,
    false,
    0n,
    0n,
    controller.address,
  );
  const usernameAddress = contractAddress(0, usernameInit);
  const officialUsernameAthWallet = await athWalletAddress(usernameAddress, registryAthMaster);
  const recipientUsernameAthWallet = await athWalletAddress(usernameAddress, athMaster);

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
    recipientUsernameAthWallet,
    athMaster,
    registryAthMaster,
  };
}

async function deploySiblingVaultForSignedValueFlow(options: {
  blockchain: Blockchain;
  label: string;
  athMaster: Address;
  profileRegistryAddress: Address;
  usernameRegistryAddress: Address;
}) {
  const controller = await options.blockchain.treasury(`${options.label}-controller`);
  const capsuleHub = await options.blockchain.treasury(`${options.label}-capsulehub`);
  const vaultInit = await Vault.init(
    controller.address,
    options.athMaster,
    capsuleHub.address,
    addressHash(controller.address),
    true,
    false,
    0n,
  );
  const vaultAddress = contractAddress(0, vaultInit);
  const officialVaultAthWallet = await athWalletAddress(vaultAddress, options.athMaster);
  await options.blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('3'),
    workchain: vaultAddress.workChain,
  }));
  const vault = options.blockchain.openContract(new Vault(vaultAddress, vaultInit));
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialVaultAthWallet,
  } as BindOfficialAthWallet);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: options.profileRegistryAddress,
  } as BindProfileRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: options.usernameRegistryAddress,
  } as BindUsernameRegistry);
  await vault.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);
  return vault;
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

function signedRegistryProfileAvatarBody(params: {
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
    envelope_padding: beginCell().endCell().asSlice(),
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
    envelope_padding: beginCell().endCell().asSlice(),
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
    notify_value: params.notifyValue ?? ATH_TRANSFER_NOTIFY_MIN_VALUE,
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
    // Official Vault ATH wallet legitimately retains the +18M endowment (ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT 2M->20M); threshold raised by the 18M delta.
    expect(await contractBalance(blockchain, officialVaultAthWallet)).toBeLessThan(toNano('0.028'));
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
    const signingKey = await registerAvatarRouteKeys(vault, user);
    await depositTonFromAddress(blockchain, vault, user.address, toNano('0.06'));
    const beforeUser = await vault.getGetUser(user.address);

    await sendVaultWithdrawAthExternal(blockchain, vault, user, signingKey, MANIFEST_HASH, 750n, recipient.address);

    const recipientAthWalletAddress = await athWalletAddress(recipient.address, athMaster);
    const recipientAthWallet = blockchain.openContract(new ATHWallet(recipientAthWalletAddress));
    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));
    const afterUser = await vault.getGetUser(user.address);

    expect(afterUser.ath_balance).toBe(1_250n);
    expect(afterUser.ton_balance).toBeLessThanOrEqual(beforeUser.ton_balance);
    expect((await vault.getGetPendingAthWithdrawalFor(user.address, 0n)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await recipientAthWallet.getGetWalletData()).balance).toBe(750n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(1_250n);
  });

  it('VAULT-ATH-03B: underfunded withdrawal is rejected before debiting internal ATH or creating pending state', async () => {
    const { blockchain, vault, user, recipient, userAthWallet, officialVaultAthWallet } = await setup();

    await depositAth({ vault, user, userAthWallet, amount: 2_000n, queryId: 31n });
    const signingKey = await registerAvatarRouteKeys(vault, user);
    await expect(sendVaultWithdrawAthExternal(blockchain, vault, user, signingKey, MANIFEST_HASH, 750n, recipient.address))
      .rejects.toThrow(/Unable to execute get method|not accepted|16027/);

    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));

    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    expect((await vault.getGetPendingAthWithdrawalFor(user.address, 0n)).exists).toBe(false);
    expect((await vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await officialWallet.getGetWalletData()).balance).toBe(2_000n);
  });

  it('VAULT-ATH-03C: non-basechain withdrawal recipient is rejected before debit or pending state', async () => {
    const { blockchain, vault, user, userAthWallet, officialVaultAthWallet } = await setup();
    const masterchainRecipient = fixtureAddress('VAULT_ATH_MASTERCHAIN_RECIPIENT', -1);

    await depositAth({ vault, user, userAthWallet, amount: 2_000n, queryId: 33n });
    const signingKey = await registerAvatarRouteKeys(vault, user);
    await depositTonFromAddress(blockchain, vault, user.address, toNano('0.06'));
    await sendVaultWithdrawAthExternal(blockchain, vault, user, signingKey, MANIFEST_HASH, 750n, masterchainRecipient);

    const officialWallet = blockchain.openContract(new ATHWallet(officialVaultAthWallet));

    expect((await vault.getGetUser(user.address)).ath_balance).toBe(2_000n);
    expect((await vault.getGetPendingAthWithdrawalFor(user.address, 0n)).exists).toBe(false);
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
    // KEPT FAILING DELIBERATELY. It is a REAL loss, it is on the VAULT lane only, and the resolution is to remove
    // Vault rather than to patch it — so this stays red as the evidence for that, and must not be relaxed.
    //
    // What happens, measured: source 3_300 (not 4_000), official 1_700 (not 1_000), vault credits 1_000. The
    // clean-17 deletion of ATHWallet's `processed_notifications` tombstone means a replayed query_id is no longer
    // refused at the wallet, so the duplicate reaches the consumer. ATHWallet's own note argues that is safe
    // because "a resend is paid for by a SECOND debit, so it is a second genuine purchase" — true wherever the
    // consumer's semantic key REFUSES and refunds (UsernameRegistry via the item's 18011 + bounce; ProfileRegistry
    // via 21115), and FALSE here: the Vault dedupes on its own ledger and replies ACK, so the second debit buys
    // nothing and the ATH is stranded on the official wallet, credited to no one. ATHWallet.tact now records that
    // narrowing next to the deletion.
    //
    // Vault is cancelled in clean-17 but the deploy scripts still ship it (one of the two "cancelled but still
    // deployed" mines in the ceiling sweep). This failure is one more reason that removal is real work and not
    // bookkeeping. Any FUTURE consumer of ATHTransferNotification must refund a duplicate, never ACK it.
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
    // Official Vault ATH wallet legitimately retains the +18M endowment (ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT 2M->20M); threshold raised by the 18M delta.
    expect(await contractBalance(blockchain, officialVaultAthWallet)).toBeLessThan(toNano('0.028'));
  });

  it('VAULT-ATH-06: clean-16 direct-pay — the Vault-funded avatar path is RETIRED (registry rejects payer=Vault!=owner); custodial ATH is refunded, no avatar set, no loss', async () => {
    const ctx = await setupProfileAvatarRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.42') }, {
      $$type: 'DepositTon',
      amount: toNano('0.4'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: PROFILE_AVATAR_PRICE_ATH * 2n,
      queryId: 601n,
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    expect(beforeUser.ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH * 2n);

    // The legacy Vault-mediated avatar external still exists but is now INERT: the ProfileRegistry authenticates on
    // payer==owner (direct-pay), and the Vault stamps payer=Vault != owner, so the registry rejects it (21163). The
    // ATH round-trips back and the user's custodial balance is made whole. Real avatar-set now runs direct-pay
    // (user's OWN ATH wallet) — covered by PROFILE-12/12B in tests/profile-registry.test.ts.
    const body = signedRegistryProfileAvatarBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      profileRegistry: ctx.profileRegistry,
      clientNonce: beforeUser.publish_nonce,
      secretKey: keyPair.secretKey,
      avatarHash: 0x661122n,
      avatarEntryId: 71n,
      avatarStreamId: 0x11223344556677889900aabbccddeeffn,
      avatarPartCount: 2n,
    });
    await ctx.blockchain.sendMessage(external({ to: ctx.vault.address, body }));

    expect((await ctx.profileRegistry.getGetAvatar(ctx.user.address)).exists).toBe(false); // rejected -> no avatar
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH * 2n); // refunded in full
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n); // pending settled via reject/bounce
  });

  it('VAULT-ATH-06A: Profile avatar TON excess refund is bound to ProfileRegistry and capped by declared amount', async () => {
    const ctx = await setupProfileAvatarRoute();
    const attacker = await ctx.blockchain.treasury('vault-avatar-excess-attacker');

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.05') }, {
      $$type: 'DepositTon',
      amount: toNano('0.02'),
    });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    const beforeBacking = await contractBalance(ctx.blockchain, ctx.vault.address) - beforeUser.ton_balance;
    const declaredCredit = 1_000_000n;
    const deliveredCredit = 5_000_000n;

    const forged = await ctx.vault.send(attacker.getSender(), {
      value: VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE + deliveredCredit,
    }, {
      $$type: 'ProfileAvatarTonExcessRefund',
      query_id: 6061n,
      owner_wallet: ctx.user.address,
      amount: declaredCredit,
    } as ProfileAvatarTonExcessRefund);

    expect(findTransaction(forged.transactions, {
      from: attacker.address,
      to: ctx.vault.address,
      success: false,
      exitCode: 16681,
    })).toBeDefined();
    expect((await ctx.vault.getGetUser(ctx.user.address)).ton_balance).toBe(beforeUser.ton_balance);

    await ctx.vault.send(ctx.blockchain.sender(ctx.profileRegistry.address), {
      value: VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE + deliveredCredit,
    }, {
      $$type: 'ProfileAvatarTonExcessRefund',
      query_id: 6062n,
      owner_wallet: ctx.user.address,
      amount: declaredCredit,
    } as ProfileAvatarTonExcessRefund);

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterBacking = await contractBalance(ctx.blockchain, ctx.vault.address) - afterUser.ton_balance;
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance + declaredCredit);
    expect(afterBacking).toBeGreaterThanOrEqual(beforeBacking);
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
    await expectRejectedWithoutRawSpend(ctx.user.address, signedRegistryProfileAvatarBody({
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

    await expectRejectedWithoutRawSpend(ctx.user.address, signedRegistryProfileAvatarBody({
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
    }), 16615);

    const afterBadMax = await ctx.vault.getGetUser(ctx.user.address);
    await expectRejectedWithoutRawSpend(ctx.user.address, signedRegistryProfileAvatarBody({
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
    }), 16619);

    const afterBadVault = await ctx.vault.getGetUser(ctx.user.address);
    await expectAcceptedReturnChargesLocalReserve(ctx.user.address, signedRegistryProfileAvatarBody({
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
    await expectRejectedWithoutRawSpend(underfunded.address, signedRegistryProfileAvatarBody({
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
      body: signedRegistryProfileAvatarBody({
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
      body: signedRegistryProfileAvatarBody({
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

  it('VLT-02A: profile avatar signed externals are bound to the target Vault before accept', async () => {
    const ctx = await setupProfileAvatarRoute();
    const otherVault = await deploySiblingVaultForSignedValueFlow({
      blockchain: ctx.blockchain,
      label: 'vault-avatar-wrong-target',
      athMaster: ctx.athMaster,
      profileRegistryAddress: ctx.profileRegistry.address,
      usernameRegistryAddress: fixtureAddress('VAULT_AVATAR_WRONG_TARGET_USERNAME_REGISTRY'),
    });
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    await registerAvatarRouteKeys(otherVault, ctx.user);
    await otherVault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    const beforeOther = await otherVault.getGetUser(ctx.user.address);
    const rawBeforeOther = await contractBalance(ctx.blockchain, otherVault.address);

    await expect(ctx.blockchain.sendMessage(external({
      to: otherVault.address,
      body: signedRegistryProfileAvatarBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        profileRegistry: ctx.profileRegistry,
        clientNonce: beforeOther.publish_nonce,
        secretKey: keyPair.secretKey,
        avatarHash: 0x661128n,
        avatarEntryId: 77n,
        avatarStreamId: 0x11223344556677889900aabbccddee07n,
        avatarPartCount: 1n,
      }),
    }))).rejects.toMatchObject({ exitCode: 16619 });

    const afterOther = await otherVault.getGetUser(ctx.user.address);
    const rawAfterOther = await contractBalance(ctx.blockchain, otherVault.address);
    expect(afterOther.ton_balance).toBe(beforeOther.ton_balance);
    expect(afterOther.ath_balance).toBe(beforeOther.ath_balance);
    expect(afterOther.publish_nonce).toBe(beforeOther.publish_nonce);
    expect((await otherVault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n);
    expect(rawAfterOther).toBe(rawBeforeOther);
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
      body: signedRegistryProfileAvatarBody({
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
      body: signedRegistryProfileAvatarBody({
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

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
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

    // THE ITEM IS THE RECORD (clean-17): the mint is proven finalised by the item at the derived address being
    // live and initialized, and its owner_wallet naming the buyer. That is strictly stronger than the deleted
    // NameRecord — owner_wallet stays correct after a TEP-62 transfer, minter_wallet never did.
    const item = await readUsernameItem(ctx.blockchain, ctx.usernameRegistry.address, username);
    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    const afterSourceWallet = await ctx.userAthWallet.getGetWalletData();
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));
    const rawAfterFirst = await contractBalance(ctx.blockchain, ctx.vault.address);

    // The registry's own derivation must agree with the client-side one (this replaces NameRecord.item_address,
    // which stored what both sides can recompute for free).
    expect(item.address.equals(await ctx.usernameRegistry.getGetUsernameItemAddress(hash))).toBe(true);
    expect(item.initialized).toBe(true);
    expect(item.owner_wallet!.equals(ctx.user.address)).toBe(true);
    // NameRecord.registered_at had no other holder and is simply gone — nothing on chain records the mint time.
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

  it('RT-USER-002: broken recipient ATH wallet route refunds Vault username mint and leaves registry empty', async () => {
    const ctx = await setupUsernameMintRoute({
      registryAthMaster: fixtureAddress('VAULT_USERNAME_WRONG_REGISTRY_ATH_MASTER'),
    });
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    expect(ctx.recipientUsernameAthWallet.equals(ctx.officialUsernameAthWallet)).toBe(false);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
    });
    await depositAth({
      vault: ctx.vault,
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      amount: USERNAME_PRICE_6_PLUS * 2n,
      queryId: 712n,
    });

    const username = 'platho_2-y';
    const hash = usernameHash(username);
    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    const result = await ctx.blockchain.sendMessage(external({
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

    const afterUser = await ctx.vault.getGetUser(ctx.user.address);
    const afterGlobal = await ctx.vault.getGetGlobal();
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const recipientUsernameWallet = ctx.blockchain.openContract(new ATHWallet(ctx.recipientUsernameAthWallet));

    // "registry empty" now means: no item was ever brought to life at the name's derived address (clean-17 —
    // the item IS the record; there is no name_records map left to inspect).
    expect((await readUsernameItem(ctx.blockchain, ctx.usernameRegistry.address, username)).initialized).toBe(false);
    expect((await ctx.usernameRegistry.getGetPendingMint(hash)).exists).toBe(false);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect(afterUser.publish_nonce).toBe(beforeUser.publish_nonce + 1n);
    expect(afterGlobal.pending_username_mint_payment_count).toBe(0n);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS * 2n);
    expect((await recipientUsernameWallet.getGetWalletData()).balance).toBe(0n);
    expect(findTransaction(result.transactions, {
      from: ctx.vault.address,
      to: ctx.officialVaultAthWallet,
      op: OP_ATH_TRANSFER_REQUEST_VAULT_MINT_USERNAME,
      success: true,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.recipientUsernameAthWallet,
      to: ctx.usernameRegistry.address,
      op: OP_USERNAME_VAULT_NOTIFICATION,
      success: false,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
      success: true,
    }) ?? findTransaction(result.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
      success: true,
    })).toBeDefined();
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

    await expectRejectedWithoutRawSpend(ctx.user.address, signedVaultUsernameMintBody({
      vault: ctx.vault,
      owner: ctx.user.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: beforeUser.publish_nonce,
      secretKey: keyPair.secretKey,
      maxTonCharge: USERNAME_MINT_LOCAL_EXEC_RESERVE - 1n,
      username: 'platho',
    }), 16715);

    const afterBadMax = await ctx.vault.getGetUser(ctx.user.address);
    await expectRejectedWithoutRawSpend(ctx.user.address, signedVaultUsernameMintBody({
      vault: ctx.vault,
      signedVault: ctx.usernameRegistry.address,
      owner: ctx.user.address,
      usernameRegistry: ctx.usernameRegistry,
      clientNonce: afterBadMax.publish_nonce,
      secretKey: keyPair.secretKey,
      username: 'platho',
    }), 16717);

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

  it('VLT-02B: username mint signed externals are bound to the target Vault before accept', async () => {
    const ctx = await setupUsernameMintRoute();
    const otherVault = await deploySiblingVaultForSignedValueFlow({
      blockchain: ctx.blockchain,
      label: 'vault-username-wrong-target',
      athMaster: ctx.athMaster,
      profileRegistryAddress: fixtureAddress('VAULT_USERNAME_WRONG_TARGET_PROFILE_REGISTRY'),
      usernameRegistryAddress: ctx.usernameRegistry.address,
    });
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    await registerAvatarRouteKeys(otherVault, ctx.user);
    await otherVault.send(ctx.user.getSender(), { value: toNano('0.22') }, {
      $$type: 'DepositTon',
      amount: toNano('0.2'),
    });
    const beforeOther = await otherVault.getGetUser(ctx.user.address);
    const rawBeforeOther = await contractBalance(ctx.blockchain, otherVault.address);

    await expect(ctx.blockchain.sendMessage(external({
      to: otherVault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault,
        owner: ctx.user.address,
        usernameRegistry: ctx.usernameRegistry,
        clientNonce: beforeOther.publish_nonce,
        secretKey: keyPair.secretKey,
        username: 'platho_5',
      }),
    }))).rejects.toMatchObject({ exitCode: 16717 });

    const afterOther = await otherVault.getGetUser(ctx.user.address);
    const rawAfterOther = await contractBalance(ctx.blockchain, otherVault.address);
    expect(afterOther.ton_balance).toBe(beforeOther.ton_balance);
    expect(afterOther.ath_balance).toBe(beforeOther.ath_balance);
    expect(afterOther.publish_nonce).toBe(beforeOther.publish_nonce);
    expect((await otherVault.getGetGlobal()).pending_username_mint_payment_count).toBe(0n);
    expect(rawAfterOther).toBe(rawBeforeOther);
  });

  it('VAULT-ATH-07B3: Vault-funded username mint without bound username registry cannot send ATH', async () => {
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
    const keyPair = await registerKeysFromAddress(blockchain, vault, user.address, 83);
    await depositTonFromAddress(blockchain, vault, user.address, toNano('0.1'));
    const beforeUser = await vault.getGetUser(user.address);

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedVaultUsernameMintBody({
        vault,
        owner: user.address,
        usernameRegistry: { address: fixtureAddress('VAULT_USERNAME_UNBOUND_REGISTRY') },
        clientNonce: 0n,
        secretKey: keyPair.secretKey,
        username: 'platho',
      }),
    }));

    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.publish_nonce).toBe(beforeUser.publish_nonce + 1n);
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance - USERNAME_MINT_LOCAL_EXEC_RESERVE);
    expect((await vault.getGetGlobal()).pending_username_mint_payment_count).toBe(0n);
  });

  it('VAULT-ATH-07C: Vault-funded username notification prune cannot refund before registry finality', async () => {
    const ctx = await setupUsernameMintNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
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

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
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
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, {
      $$type: 'DepositTon',
      amount: toNano('1'),
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
    // Not finalised: nothing at the derived address is a live, initialized UsernameNFTItem. (This test deliberately
    // parked a rejecting stub there, so the name is un-minted in the only sense the chain now records.)
    expect((await readUsernameItem(ctx.blockchain, ctx.usernameRegistry.address, username)).initialized).toBe(false);
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

    // clean-17: name_records is gone, and in THIS test the item address is deliberately occupied by a rejecting
    // stub (that is the whole scenario — the real item never deployed, a late ACK is replayed from its address),
    // so there is no initialized item to read here. Finalisation is proven by what the registry actually did:
    //   * the ACK transaction SUCCEEDED, which means gate 19136 passed — i.e. the pending mint's owner_wallet
    //     really was this user (this is what NameRecord.minter_wallet used to assert, enforced rather than copied);
    //   * the pending mint cleared and the price landed in the treasury/burn due split;
    //   * the ATH ACK was forwarded to the Vault.
    // NameRecord.item_address is replaced by the derivation itself, checked against the registry's own getter.
    expect(itemAddress.equals(await deriveUsernameItemAddress(ctx.usernameRegistry.address, username))).toBe(true);
    expect(findTransaction(lateAck.transactions, {
      from: itemAddress,
      to: ctx.usernameRegistry.address,
      success: true,
    })).toBeDefined();
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

    await ctx.vault.send(ctx.user.getSender(), { value: toNano('2.05') }, {
      $$type: 'DepositTon',
      amount: toNano('2'),
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
    expect((await readUsernameItem(ctx.blockchain, ctx.usernameRegistry.address, username)).initialized).toBe(true);
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
    const afterRegistryGlobal = await ctx.usernameRegistry.getGetGlobal();
    const itemAfterSecond = await readUsernameItem(ctx.blockchain, ctx.usernameRegistry.address, username);
    const vaultOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialVaultAthWallet));
    const usernameOfficialWallet = ctx.blockchain.openContract(new ATHWallet(ctx.officialUsernameAthWallet));

    // BEHAVIOURAL CHANGE (clean-17): the duplicate is no longer refused synchronously in COMPUTE at gate 19172 —
    // that gate is retired with name_records. The registry now takes the payment into a pending mint and deploys
    // to the ALREADY-ACTIVE item; the StateInit is ignored but the body is still delivered, so the item refuses at
    // ITS gate 18011, the message BOUNCES, and bounced<InitializeUsernameItem> clears the pending and refunds the
    // buyer. The first owner is untouched, and the money is supposed to come back.
    expect(itemAfterSecond.initialized).toBe(true);
    expect(itemAfterSecond.owner_wallet!.equals(ctx.user.address)).toBe(true);

    // ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
    // │ KEPT FAILING ON PURPOSE — the refund does NOT arrive. The buyer loses the price of the duplicate.     │
    // │                                                                                                      │
    // │ Measured trace of the second mint:                                                                   │
    // │   vault -> vaultWallet 0x4154481C ok -> regWallet 0x4154481D ok -> registry 0x89129D60 ok (accepted,  │
    // │   no 19172 any more) -> item 0x554E494E exit 18011 -> BOUNCE back to registry ok                      │
    // │   -> registry sends AthTransferNotificationRefund 0x4154481E to its own ATH wallet, funded by          │
    // │      USERNAME_ATH_NOTIFICATION_REFUND_VALUE = 12_000_000                                              │
    // │   -> regWallet -> vaultWallet 0x41544812 arrives with 6_971_064 and THROWS 14212.                      │
    // │                                                                                                      │
    // │ Gate 14212 requires 2M + 3M + 1M + 20M = 26M. ATHWallet.tact's own comment describes exactly this      │
    // │ stranding window and says the 45M notify floor is what keeps a refused registry purchase refundable —  │
    // │ but that floor only protects the path where the NOTIFICATION bounces and the refund rides              │
    // │ SendRemainingValue out of the 45M. The item-bounce path does not: it mints a FRESH message at a         │
    // │ hard-coded 12M, which is inside the documented window ("the sender-side gate on the same money, 14335,  │
    // │ only demands 12M").                                                                                   │
    // │                                                                                                      │
    // │ Before name_records was deleted, a duplicate never reached this path — 19172 refused it in COMPUTE and  │
    // │ the refund travelled the protected notification-bounce route. Deleting the map moved the duplicate      │
    // │ refund onto the unprotected one. Fix belongs in UsernameRegistry.tact (raise                            │
    // │ USERNAME_ATH_NOTIFICATION_REFUND_VALUE above the 26M arrival gate, with the same margin reasoning as    │
    // │ the 45M floor), not here — so this assertion stays red rather than being relaxed.                       │
    // └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
    expect(afterSecond.ath_balance).toBe(afterFirst.ath_balance);
    expect(afterSecond.publish_nonce).toBe(afterFirst.publish_nonce + 1n);
    expect(afterGlobal.pending_username_mint_payment_count).toBe(0n);
    // The refunded duplicate must NOT have credited the registry's treasury/burn due a second time.
    expect(afterRegistryGlobal.treasury_due_ath + afterRegistryGlobal.burn_due_ath).toBe(USERNAME_PRICE_6_PLUS);
    expect((await ctx.usernameRegistry.getGetPendingMint(hash)).exists).toBe(false);
    expect((await vaultOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS * 2n);
    expect((await usernameOfficialWallet.getGetWalletData()).balance).toBe(USERNAME_PRICE_6_PLUS);
    expect(findTransaction(second.transactions, {
      from: ctx.officialVaultAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_ACK,
      success: true,
    })).toBeDefined();
    // RESOLVED 2026-07-20. This assertion was inverted to toBeDefined() while the bug below was live, precisely
    // so it could not go green for the wrong reason — and that is what surfaced the regression:
    //
    // Deleting name_records moved a duplicate mint off the 19172-refuses-in-COMPUTE path (where the ATH went home
    // as a NOTIFICATION bounce, riding SendRemainingValue out of the payer's 45M floor) and onto the item-bounce
    // path, where the registry mints a FRESH refund message carrying only USERNAME_ATH_NOTIFICATION_REFUND_VALUE.
    // At 12M that landed inside the window ATHWallet.tact documents — sender gate 14335 wants 12M, recipient gate
    // 14212 wants 26M — so the refund was sent, arrived with a measured 6,971,064, threw, and the buyer's ATH was
    // stranded on the registry's official wallet. The constant is now 45M and the buyer is made whole, which is
    // what the balance assertion above proves.
    //
    // So the refund no longer travels as a FAILED to the Vault at all: it settles cleanly one hop earlier. Back
    // to toBeUndefined(), now for the right reason.
    expect(findTransaction(second.transactions, {
      from: ctx.officialUsernameAthWallet,
      to: ctx.vault.address,
      op: OP_ATH_TRANSFER_FAILED,
      success: true,
    })).toBeUndefined();
  });

  // clean-16 L6/#18: PruneStuckAthPending — fail-closed tombstone lifecycle for a STUCK ATH-settlement pending
  // (frozen downstream never sent an ACK/bounce). Mirrors PruneBatchPublish: prune NEVER refunds; a late in-window
  // ACK/bounce is the only refund path; the tombstone flag makes the count decrement exactly-once.
  async function stuckProfileAvatarPending(ctx: any, keyPair: any, opts: { queryId: bigint; avatarHash: bigint; entryId: bigint; streamId: bigint }) {
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('0.22') }, { $$type: 'DepositTon', amount: toNano('0.2') });
    await depositAth({ vault: ctx.vault, user: ctx.user, userAthWallet: ctx.userAthWallet, amount: PROFILE_AVATAR_PRICE_ATH * 2n, queryId: opts.queryId });
    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedRegistryProfileAvatarBody({
        vault: ctx.vault, owner: ctx.user.address, profileRegistry: ctx.profileRegistry,
        clientNonce: beforeUser.publish_nonce, secretKey: keyPair.secretKey,
        avatarHash: opts.avatarHash, avatarEntryId: opts.entryId, avatarStreamId: opts.streamId, avatarPartCount: 2n,
      }),
    }));
    const pendingState = await ctx.profileRegistry.getGetState();
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(1n);
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH); // debited by the mint
    return pendingState.last_query_id as bigint;
  }

  function prune(ctx: any, kind: bigint, queryId: bigint, value = '0.05') {
    return ctx.vault.send(ctx.user.getSender(), { value: toNano(value) },
      { $$type: 'PruneStuckAthPending', kind, query_id: queryId } as PruneStuckAthPending);
  }

  it('PRUNE-ATH-01: a stuck profile-avatar pending prunes stale -> tombstone -> delete after the window (kind=2)', async () => {
    const ctx = await setupProfileAvatarNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    const queryId = await stuckProfileAvatarPending(ctx, keyPair, { queryId: 6611n, avatarHash: 0x18a1ffn, entryId: 91n, streamId: 0x41223344556677889900aabbccddeeffn });

    // before STALE_TTL -> reject 16571, pending untouched
    expect(vaultInternalExitCode(await prune(ctx, 2n, queryId), ctx.vault.address)).toBe(16571);
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(1n);

    // after STALE_TTL -> tombstone: count freed, NO ath refund (fail-closed)
    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + VAULT_PENDING_STALE_TTL + 10;
    expect(vaultInternalExitCode(await prune(ctx, 2n, queryId), ctx.vault.address)).toBe(0);
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n);
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH); // not refunded

    // still inside the tombstone window -> a second prune rejects 16574 (not yet deletable)
    expect(vaultInternalExitCode(await prune(ctx, 2n, queryId), ctx.vault.address)).toBe(16574);

    // after the tombstone window -> deletes cleanly; a further prune then hits not-found (16570)
    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + VAULT_PRUNED_TOMBSTONE_TTL + 10;
    expect(vaultInternalExitCode(await prune(ctx, 2n, queryId), ctx.vault.address)).toBe(0);
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n);
    expect(vaultInternalExitCode(await prune(ctx, 2n, queryId), ctx.vault.address)).toBe(16570);
  });

  it('PRUNE-ATH-02: a late FAILED inside the tombstone window still REFUNDS and never double-decrements (kind=2)', async () => {
    const ctx = await setupProfileAvatarNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    const queryId = await stuckProfileAvatarPending(ctx, keyPair, { queryId: 6621n, avatarHash: 0x18a2ffn, entryId: 92n, streamId: 0x42223344556677889900aabbccddeeffn });

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + VAULT_PENDING_STALE_TTL + 10;
    await prune(ctx, 2n, queryId); // tombstone (count 0, no refund)
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n);

    // downstream un-freezes late (still in window) and reports FAILED: the user is REFUNDED, count stays 0 (no -1).
    await ctx.vault.send(ctx.blockchain.sender(ctx.officialVaultAthWallet), { value: toNano('0.1') },
      { $$type: 'ATHTransferFailed', query_id: queryId, amount: PROFILE_AVATAR_PRICE_ATH } as ATHTransferFailed);

    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH * 2n); // refunded
    expect((await ctx.vault.getGetGlobal()).pending_profile_avatar_payment_count).toBe(0n); // exactly-once
    // pending is gone -> a further prune hits not-found
    expect(vaultInternalExitCode(await prune(ctx, 2n, queryId), ctx.vault.address)).toBe(16570);
  });

  it('PRUNE-ATH-03: a late SUCCESS ACK inside the tombstone window deletes without refunding and never double-decrements (kind=1)', async () => {
    const ctx = await setupUsernameMintNoAckRoute();
    const keyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, { $$type: 'DepositTon', amount: toNano('1') });
    await depositAth({ vault: ctx.vault, user: ctx.user, userAthWallet: ctx.userAthWallet, amount: USERNAME_PRICE_6_PLUS * 2n, queryId: 6631n });

    const beforeUser = await ctx.vault.getGetUser(ctx.user.address);
    await ctx.blockchain.sendMessage(external({
      to: ctx.vault.address,
      body: signedVaultUsernameMintBody({
        vault: ctx.vault, owner: ctx.user.address, usernameRegistry: ctx.usernameRegistry,
        clientNonce: beforeUser.publish_nonce, secretKey: keyPair.secretKey, username: 'platho_9',
      }),
    }));
    const queryId = (await ctx.usernameRegistry.getGetState()).last_query_id as bigint;
    expect((await ctx.vault.getGetGlobal()).pending_username_mint_payment_count).toBe(1n);
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(USERNAME_PRICE_6_PLUS);

    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + VAULT_PENDING_STALE_TTL + 10;
    expect(vaultInternalExitCode(await prune(ctx, 1n, queryId), ctx.vault.address)).toBe(0); // tombstone
    expect((await ctx.vault.getGetGlobal()).pending_username_mint_payment_count).toBe(0n);

    // the mint actually SUCCEEDED late: the registry ATH wallet ACKs. Delete, NO refund (ath consumed), count stays 0.
    await ctx.vault.send(ctx.blockchain.sender(ctx.officialUsernameAthWallet), { value: toNano('0.1') },
      { $$type: 'ATHTransferAck', query_id: queryId, amount: USERNAME_PRICE_6_PLUS } as ATHTransferAck);

    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(USERNAME_PRICE_6_PLUS); // NOT refunded
    expect((await ctx.vault.getGetGlobal()).pending_username_mint_payment_count).toBe(0n); // exactly-once
    expect(vaultInternalExitCode(await prune(ctx, 1n, queryId), ctx.vault.address)).toBe(16570); // pending gone
  });

  it('PRUNE-ATH-04: prune rejects an unknown kind (16572), a missing pending (16570), and an underfunded call (16573)', async () => {
    const ctx = await setupProfileAvatarNoAckRoute();
    expect(vaultInternalExitCode(await prune(ctx, 5n, 0n), ctx.vault.address)).toBe(16572);      // unknown kind
    expect(vaultInternalExitCode(await prune(ctx, 2n, 999999n), ctx.vault.address)).toBe(16570); // no such pending
    expect(vaultInternalExitCode(await prune(ctx, 2n, 999999n, '0.0015'), ctx.vault.address)).toBe(16573); // < exec reserve
  });

  it('PRUNE-ATH-05: a stuck ath-withdrawal prunes stale -> tombstone; a late FAILED in-window still refunds and never double-decrements (kind=3)', async () => {
    const ctx = await setupProfileAvatarNoAckRoute();
    const authKeyPair = await registerAvatarRouteKeys(ctx.vault, ctx.user);
    // fund the user's INTERNAL ath balance (this also deploys a real Vault ATH wallet at officialVaultAthWallet)...
    await depositAth({ vault: ctx.vault, user: ctx.user, userAthWallet: ctx.userAthWallet, amount: PROFILE_AVATAR_PRICE_ATH * 2n, queryId: 6641n });
    await ctx.vault.send(ctx.user.getSender(), { value: toNano('1.05') }, { $$type: 'DepositTon', amount: toNano('1') });

    // ...then FREEZE the downstream: overwrite the Vault's OWN ATH wallet with a no-ACK sink so the outbound
    // ATHTransferRequest is accepted but never ACKs/bounces -> the withdrawal pending is stuck open.
    const noAck = await MockAthWalletNoAck.init();
    await ctx.blockchain.setShardAccount(ctx.officialVaultAthWallet, createShardAccount({
      address: ctx.officialVaultAthWallet, code: noAck.code, data: noAck.data,
      balance: toNano('1'), workchain: ctx.officialVaultAthWallet.workChain,
    }));

    const amount = PROFILE_AVATAR_PRICE_ATH;
    const before = await ctx.vault.getGetUser(ctx.user.address);
    const withdrawalId = await ctx.vault.getGetAthWithdrawalId(ctx.user.address, before.publish_nonce);
    await sendVaultWithdrawAthExternal(ctx.blockchain, ctx.vault, ctx.user, authKeyPair, MANIFEST_HASH, amount, ctx.user.address);

    expect((await ctx.vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(1n);
    expect((await ctx.vault.getGetPendingAthWithdrawal(withdrawalId)).exists).toBe(true);
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH); // 2*PRICE debited by PRICE

    // before STALE_TTL -> reject 16571
    expect(vaultInternalExitCode(await prune(ctx, 3n, withdrawalId), ctx.vault.address)).toBe(16571);

    // after STALE_TTL -> tombstone: count freed, NO ath refund (fail-closed)
    ctx.blockchain.now = (ctx.blockchain.now ?? 0) + VAULT_PENDING_STALE_TTL + 10;
    expect(vaultInternalExitCode(await prune(ctx, 3n, withdrawalId), ctx.vault.address)).toBe(0);
    expect((await ctx.vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH); // not refunded

    // downstream un-freezes late (still in window) reporting FAILED: user REFUNDED, count stays 0 (exactly-once).
    await ctx.vault.send(ctx.blockchain.sender(ctx.officialVaultAthWallet), { value: toNano('0.2') },
      { $$type: 'ATHTransferFailed', query_id: withdrawalId, amount } as ATHTransferFailed);
    expect((await ctx.vault.getGetUser(ctx.user.address)).ath_balance).toBe(PROFILE_AVATAR_PRICE_ATH * 2n); // refunded
    expect((await ctx.vault.getGetGlobal()).pending_ath_withdrawal_count).toBe(0n);
    expect((await ctx.vault.getGetPendingAthWithdrawal(withdrawalId)).exists).toBe(false);
  });
});
