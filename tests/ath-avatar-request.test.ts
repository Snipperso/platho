import { describe, expect, it } from 'vitest';
import { beginCell as coreCell, Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import { storeATHTransferRequestRegistryProfileAvatar } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ProfileRegistry, BindProfileOfficialAthWallet, SealGenesis } from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { buildAthWalletMessageBody, parseBocBase64, computeCellHashAndDepth } from '../web/pwa-contract-transactions.mjs';

const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const OP_PROFILE_AVATAR_NOTIFICATION = 0xA11A7002;
const OP_KEYSHARD_SET_AVATAR_POINTER = 0x4B534735;
const fixtureAddress = (label: string) => new Address(0, createHash('sha256').update(`PLATHO.V1.AAR.${label}`).digest());

async function deployAthWallet(bc: Blockchain, owner: Address, athMaster: Address, tokenBalance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(tokenBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await bc.setShardAccount(address, createShardAccount({ address, code: zeroInit.code, data: dataInit.data, balance: toNano('3'), workchain: address.workChain }));
  return bc.openContract(new ATHWallet(address, zeroInit));
}


const raw = (h: string) => '0:' + h;
const A = (h: string) => Address.parseRaw(raw(h));

describe('ATH avatar request (direct-pay)', () => {
  it('AAR-01: the browser ATHTransferRequestRegistryProfileAvatar == the compiled Tact store, byte-for-byte', async () => {
    const recip = 'ab'.repeat(32);
    const resp = 'cd'.repeat(32);
    const owner = 'ef'.repeat(32);
    const p = {
      query_id: 12345n,
      amount: 100_000_000_000n,
      notify_value: 45_000_000n,
      avatar_hash: (1n << 255n) + 7n,
      avatar_entry_id: 0n,
      avatar_stream_id: 0x1234n,
      avatar_part_count: 3n,
      media_format: 1n,
    };
    const reference = coreCell().store(storeATHTransferRequestRegistryProfileAvatar({
      $$type: 'ATHTransferRequestRegistryProfileAvatar',
      recipient: A(recip), response_destination: A(resp), owner_wallet: A(owner), ...p,
    })).endCell();
    const browser = parseBocBase64(buildAthWalletMessageBody('ATHTransferRequestRegistryProfileAvatar', {
      recipient: raw(recip), response_destination: raw(resp), owner_wallet: raw(owner), ...p,
    }));
    const browserHash = Buffer.from((await computeCellHashAndDepth(browser)).hash);
    expect(browserHash, 'browser body == compiled store (payment path must be byte-exact)').toEqual(reference.hash());
  });

  it('AAR-02: the BROWSER-built request drives a SUCCESSFUL 100-ATH avatar payment through the real stack', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const deployer = await bc.treasury('aar-deployer');
    const athMaster = fixtureAddress('ATH_MASTER');

    const init = await ProfileRegistry.init(fixtureAddress('PLACEHOLDER'), athMaster, fixtureAddress('TREASURY'), false, 0n, 0n, deployer.address);
    const registryAddress = contractAddress(0, init);
    await bc.setShardAccount(registryAddress, createShardAccount({ address: registryAddress, code: init.code, data: init.data, balance: toNano('2'), workchain: 0 }));
    const registry = bc.openContract(new ProfileRegistry(registryAddress, init));
    const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
    await deployAthWallet(bc, registryAddress, athMaster, 0n);
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'BindProfileOfficialAthWallet', deployment_manifest_hash: MANIFEST_HASH, official_ath_wallet_address: officialAthWalletAddress } as BindProfileOfficialAthWallet);
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as SealGenesis);

    const payer = await bc.treasury('aar-payer');
    const sourceWallet = await deployAthWallet(bc, payer.address, athMaster, PROFILE_AVATAR_PRICE_ATH);

    const body = Cell.fromBase64(buildAthWalletMessageBody('ATHTransferRequestRegistryProfileAvatar', {
      query_id: 42n,
      amount: PROFILE_AVATAR_PRICE_ATH,
      recipient: registryAddress.toRawString(),
      response_destination: payer.address.toRawString(),
      notify_value: 66_000_000n,
      owner_wallet: payer.address.toRawString(),
      avatar_hash: 0xA0A0n,
      avatar_entry_id: 0n,
      avatar_stream_id: 0xB0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0n,
      avatar_part_count: 2n,
      media_format: 1n,
    }));
    const res = await payer.send({ to: sourceWallet.address, value: 200_000_000n, body, bounce: true } as any);

    const acceptance = findTransaction(res.transactions, { to: registryAddress, op: OP_PROFILE_AVATAR_NOTIFICATION, success: true });
    expect(acceptance, 'the registry ACCEPTED the browser-built avatar payment (funding sufficient)').toBeDefined();
    const pointerWrite = findTransaction(res.transactions, { from: registryAddress, op: OP_KEYSHARD_SET_AVATAR_POINTER });
    expect(pointerWrite, 'and emitted KeyShardSetAvatarPointer to the buyer\'s shard').toBeDefined();
    expect((await sourceWallet.getGetWalletData()).balance, 'shard absent -> the 100 ATH is refunded whole').toBe(PROFILE_AVATAR_PRICE_ATH);
  }, 300_000);
});
