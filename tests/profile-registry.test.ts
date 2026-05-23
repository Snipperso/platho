import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  AthTransferNotificationProfileAvatar,
  BindProfileOfficialAthWallet,
  ProfileRegistry,
  SealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';

const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.PROFILE.${label}`).digest());
}

async function deploySealedProfileRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('profile-registry-deployer');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_PROFILE_ATH_WALLET');
  const athMasterAddress = fixtureAddress('PROFILE_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('PROFILE_TREASURY_ATH_RECEIVER');

  const init = await ProfileRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    deployer.address,
  );
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  const registry = blockchain.openContract(new ProfileRegistry(address, init));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(address);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindProfileOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWalletAddress };
}

function avatarNotification(owner: Address, overrides: Partial<AthTransferNotificationProfileAvatar> = {}): AthTransferNotificationProfileAvatar {
  return {
    $$type: 'AthTransferNotificationProfileAvatar',
    query_id: overrides.query_id ?? 1n,
    amount: overrides.amount ?? PROFILE_AVATAR_PRICE_ATH,
    sender_key: overrides.sender_key ?? 77n,
    owner_wallet: overrides.owner_wallet ?? owner,
    avatar_hash: overrides.avatar_hash ?? 0xabc123n,
    avatar_entry_id: overrides.avatar_entry_id ?? 0n,
    avatar_stream_id: overrides.avatar_stream_id ?? 0x11223344556677889900aabbccddeeffn,
    avatar_part_count: overrides.avatar_part_count ?? 8n,
    media_format: overrides.media_format ?? 1n,
  };
}

describe('ProfileRegistry wallet avatar pointers', () => {
  it('PROFILE-01: accepts paid official avatar notification, stores version, and splits ATH due', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('OWNER_ONE');

    const result = await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner));

    const avatar = await registry.getGetAvatar(owner);
    const global = await registry.getGetGlobal();
    expect(avatar.exists).toBe(true);
    expect(avatar.owner_wallet.equals(owner)).toBe(true);
    expect(avatar.version).toBe(1n);
    expect(avatar.avatar_hash).toBe(0xabc123n);
    expect(avatar.avatar_part_count).toBe(8n);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(50_000_000_000n);
    expect(global.burn_due_ath).toBe(50_000_000_000n);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWalletAddress,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
    })).toBeDefined();
  });

  it('PROFILE-02: rejects wrong ATH amount before mutating avatar state', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('WRONG_AMOUNT_OWNER');

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
      amount: PROFILE_AVATAR_PRICE_ATH - 1n,
    }));

    const avatar = await registry.getGetAvatar(owner);
    const global = await registry.getGetGlobal();
    expect(avatar.exists).toBe(false);
    expect(global.profile_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });

  it('PROFILE-03: increments avatar versions without increasing profile count', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('VERSION_OWNER');

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
      query_id: 11n,
      avatar_hash: 0x11n,
    }));
    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
      query_id: 12n,
      avatar_hash: 0x22n,
      avatar_stream_id: 0x22223333444455556666777788889999n,
    }));

    const current = await registry.getGetAvatar(owner);
    const first = await registry.getGetAvatarVersion(owner, 1n);
    const global = await registry.getGetGlobal();
    expect(current.version).toBe(2n);
    expect(current.avatar_hash).toBe(0x22n);
    expect(first.exists).toBe(true);
    expect(first.avatar_hash).toBe(0x11n);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(2n);
  });
});
