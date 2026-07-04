import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { CapsuleHub } from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { KIND_PUBLIC, marketingCell, publicPartCustom } from './helpers/vpb2';

// clean-11 profile-pointer G8 GAS GATE + threading invariants. The mainnet seal is immutable, so the profile
// publish path (reserved bit0 = is_profile -> extra public_profile_index.set + public_profile_head store +
// profile_prev_link thread) MUST fit HUB_PART_GAS_PUBLIC (180000) with margin, and the on-chain threading must
// be exactly what the client discovery/resolve walk expects. This runs in the sandbox (faithful TVM gas) in lieu
// of the (owner-declined) mainnet probe-fork.

const HUB_PART_GAS_PUBLIC = 180000n; // must stay in lockstep with contracts/CapsuleHub.tact
const PUBLIC_FEE = 10_000_000n;
const FUNDED_VALUE = toNano('0.2');
const MANIFEST_HASH = BigInt('0x' + createHash('sha256').update('PLATHO.V1.CAPSULE.PROFILE.manifest').digest('hex'));

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.CAPSULE.PROFILE.${label}`).digest());
}

function authorKeyId(addr: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(addr).endCell().hash().toString('hex'));
}

function hubGasUsed(res: any, addr: Address): bigint {
  const cp: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === addr.toString())?.description?.computePhase;
  return cp?.gasUsed ?? -1n;
}

function hubExit(res: any, addr: Address): number {
  const cp: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.toString() === addr.toString())?.description?.computePhase;
  return cp?.exitCode ?? -1;
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const boundVault = await blockchain.treasury('capsule-profile-bound-vault');
  const author = await blockchain.treasury('capsule-profile-author');
  const init = await CapsuleHub.init(
    fixtureAddress('MISSING_FEE_ACCUMULATOR'),
    boundVault.address,
    true,  // vault_bound
    true,  // sealed
    MANIFEST_HASH,
    fixtureAddress('GENESIS_CONTROLLER'),
  );
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
  }));
  const capsule = blockchain.openContract(new CapsuleHub(address, init));
  return { blockchain, capsule, boundVault, author };
}

function publicBatch(opts: { step: number; parts: Cell; authorWallet: Address }) {
  return {
    $$type: 'PublishBatchToHub',
    bounce_id: BigInt(10_000 + opts.step),
    bounce_tag: BigInt(30_000 + opts.step),
    publish_id: BigInt('0x' + createHash('sha256').update(`PLATHO.V1.CAPSULE.PROFILE.batch-${opts.step}`).digest('hex')),
    publish_kind: KIND_PUBLIC,
    part_count: 1n,
    protocol_fee_total: PUBLIC_FEE,
    author_wallet: opts.authorWallet,
    parts: opts.parts,
    marketing: marketingCell(),
  } as any;
}

describe('CapsuleHub clean-11 profile-pointer', () => {
  it('CAPHUB-PROFILE-GAS-01: a profile (reserved=1) publish is clean, fits HUB_PART_GAS_PUBLIC, and costs ~the same as a normal post', async () => {
    const { capsule, boundVault, author } = await setup();
    // Same frame for both; differ ONLY in the reserved byte, so the gas delta isolates the is_profile threading.
    const normalRes = await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 1, parts: publicPartCustom({ reserved: 0n }), authorWallet: author.address }));
    const profileRes = await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 2, parts: publicPartCustom({ reserved: 1n }), authorWallet: author.address }));

    const gNormal = hubGasUsed(normalRes, capsule.address);
    const gProfile = hubGasUsed(profileRes, capsule.address);
    // eslint-disable-next-line no-console
    console.log(`[CAPHUB-PROFILE-GAS-01] normal=${gNormal} profile=${gProfile} delta=${gProfile - gNormal} budget=${HUB_PART_GAS_PUBLIC}`);

    expect(hubExit(normalRes, capsule.address)).toBe(0);
    expect(hubExit(profileRes, capsule.address)).toBe(0);            // profile publish did NOT abort/OOG
    expect(gProfile).toBeGreaterThan(0n);
    expect(gProfile).toBeLessThanOrEqual(HUB_PART_GAS_PUBLIC);       // fits the immutable per-part budget
    expect(gProfile - gNormal).toBeLessThan(15_000n);               // the extra dict.set + head store is cheap
  });

  it('CAPHUB-PROFILE-THREAD-02: profile publishes thread the global chain + per-author index exactly as the client walk expects', async () => {
    const { capsule, boundVault, author } = await setup();
    const key = authorKeyId(author.address);

    // First profile -> entry id 0, link 1. head=1, index[author]=1, profile_prev_link=0 (first ever).
    await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 1, parts: publicPartCustom({ reserved: 1n }), authorWallet: author.address }));
    expect(await capsule.getGetPublicProfileHead()).toBe(1n);
    const idx1 = await capsule.getGetPublicProfileIndex(key);
    expect(idx1.exists).toBe(true);
    expect(idx1.latest_entry_link).toBe(1n);
    const e0 = await capsule.getGetPublicEntry(0n);
    expect(e0.exists).toBe(true);
    expect(e0.profile_prev_link).toBe(0n);

    // A NORMAL post in between (id 1) must NOT touch the profile chain.
    await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 2, parts: publicPartCustom({ reserved: 0n }), authorWallet: author.address }));
    expect(await capsule.getGetPublicProfileHead()).toBe(1n);       // unchanged
    expect((await capsule.getGetPublicEntry(1n)).profile_prev_link).toBe(0n);

    // Second profile -> entry id 2, link 3. head=3, index[author]=3, profile_prev_link=1 (points back to the 1st).
    await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 3, parts: publicPartCustom({ reserved: 1n }), authorWallet: author.address }));
    expect(await capsule.getGetPublicProfileHead()).toBe(3n);
    expect((await capsule.getGetPublicProfileIndex(key)).latest_entry_link).toBe(3n);
    const e2 = await capsule.getGetPublicEntry(2n);
    expect(e2.exists).toBe(true);
    expect(e2.profile_prev_link).toBe(1n);                          // global chain: newest (link 3) -> prev (link 1)
  });

  it('CAPHUB-PROFILE-REJECT-03: is_profile on a COMMENT (parent_link != 0) is rejected (13529), reserved high bits rejected (13521)', async () => {
    const { capsule, boundVault, author } = await setup();
    // is_profile + parent_link=2 (a comment) -> fail-closed 13529.
    const commentProfile = await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 1, parts: publicPartCustom({ reserved: 1n, parentLink: 2n }), authorWallet: author.address }));
    expect(hubExit(commentProfile, capsule.address)).toBe(13529);
    // reserved with a high bit set (2 = bit1) -> fail-closed 13521.
    const badReserved = await capsule.send(boundVault.getSender(), { value: FUNDED_VALUE }, publicBatch({ step: 2, parts: publicPartCustom({ reserved: 2n }), authorWallet: author.address }));
    expect(hubExit(badReserved, capsule.address)).toBe(13521);
    // Nothing stored.
    expect(await capsule.getGetPublicProfileHead()).toBe(0n);
  });
});
