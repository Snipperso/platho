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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// The direct-pay avatar payment is the ONE message this session builds by hand that moves 100 ATH. The ATH wallet
// throws on any prefix/layout mismatch (or worse, forwards to the wrong place), so the browser body MUST serialise
// byte-for-byte as ATHMaster's compiled storeATHTransferRequestRegistryProfileAvatar — including the exact point
// Tact overflows the fields into a ref. Compared by representation hash, the definition of "the same cell".
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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
    // The message is byte-exact (AAR-01); this proves it actually WORKS end-to-end — the buyer's ATH wallet forwards
    // 100 ATH to the registry's ATH wallet, which notifies the sealed ProfileRegistry, which accepts the payment and
    // emits KeyShardSetAvatarPointer to the buyer's shard. If the funding (value / notify_value) were short, the
    // registry notification would fail and no pointer message would be emitted — so a green here validates the
    // funding empirically, not by hand-arithmetic. (KeyShard's acceptance is proven separately in profile-avatar-two-phase.)
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;   // config-18 storage rate era
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

    // THE CLIENT MESSAGE, built by the shipping browser encoder — sent from the buyer's wallet to their own ATH wallet.
    const body = Cell.fromBase64(buildAthWalletMessageBody('ATHTransferRequestRegistryProfileAvatar', {
      query_id: 42n,
      amount: PROFILE_AVATAR_PRICE_ATH,
      recipient: registryAddress.toRawString(),
      response_destination: payer.address.toRawString(),
      notify_value: 66_000_000n,                 // >= the ~49M a FIRST avatar record needs to LAND (not refuse at 21112)
      owner_wallet: payer.address.toRawString(),  // must == payer_wallet the official wallet stamps
      avatar_hash: 0xA0A0n,
      avatar_entry_id: 0n,                         // unused in the shard model (reader matches by streamId + sha256)
      avatar_stream_id: 0xB0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0n,
      avatar_part_count: 2n,
      media_format: 1n,                            // WEBP
    }));
    // The PRODUCTION funding: notify_value + request VALUE are exactly the app.js constants (66M / 200M). Green here
    // proves 200M is enough for the ATH wallet's downstream requirement — the funding is measured, not guessed.
    const res = await payer.send({ to: sourceWallet.address, value: 200_000_000n, body, bounce: true } as any);

    const acceptance = findTransaction(res.transactions, { to: registryAddress, op: OP_PROFILE_AVATAR_NOTIFICATION, success: true });
    expect(acceptance, 'the registry ACCEPTED the browser-built avatar payment (funding sufficient)').toBeDefined();
    const pointerWrite = findTransaction(res.transactions, { from: registryAddress, op: OP_KEYSHARD_SET_AVATAR_POINTER });
    expect(pointerWrite, 'and emitted KeyShardSetAvatarPointer to the buyer\'s shard').toBeDefined();
    // The buyer's KeyShard is NOT deployed here (its registration needs HYBRID ML-KEM keys — proven separately in
    // profile-avatar-two-phase), so the pointer write bounces and the registry refunds the 100 ATH — which also
    // exercises the refund path. The ATH therefore round-trips back to the buyer; the client message + funding are
    // proven correct by the registry ACCEPTING and emitting the pointer write above.
    expect((await sourceWallet.getGetWalletData()).balance, 'shard absent -> the 100 ATH is refunded whole').toBe(PROFILE_AVATAR_PRICE_ATH);
  }, 300_000);
});
