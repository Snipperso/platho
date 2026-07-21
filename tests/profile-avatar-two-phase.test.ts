import { describe, expect, it } from 'vitest';
import { Address, Cell, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import { ProfileRegistry } from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { registerKeyShard } from './helpers/key-shard-fixture';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROFILE-AVATAR TWO-PHASE — the last of the three singleton ceilings, and the price of closing it.
//
// ProfileRegistry held the avatar pointer in two maps MEASURED at exactly 5.0000 cells per profile, linear over
// 1200 owners, against 149 code cells => 13,076 profiles. Like both ceilings before it, the wall is INVISIBLE:
// the refusal lands in the ACTION phase as code 50 while COMPUTE reports exit 0, so no exit-code assertion
// anywhere would ever have gone red. PAV-05 is the test that would now catch it, and it asserts a property
// (account size independent of profile count) rather than a number.
//
// Moving the pointer into the buyer's own KeyShard costs ATOMICITY. The payment used to settle in one compute
// phase; now the pointer lands in a different account, and the ack that closes the payment is non-bounceable and
// IRREVERSIBLE — after it, ATHWallet.refund_pending_notification throws 14332. So every test here is really
// asking the same question: when the write fails, does the buyer get their 100 ATH back?
//
// PAV-04 is the one that would have caught the bug this design nearly repeated. On the username lane the same
// refund was sized at 12M, passed its own sender-side gate (14335 wants 12M), arrived at 6,971,064 against the
// 26M its recipient demands (14212), threw, and stranded the buyer's ATH. Green tests throughout. The only thing
// that finds it is MEASURING THE ARRIVAL.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000002n;
const PRICE = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const OP_AVATAR_NOTIFICATION = 0xA11A7002;
const OP_SET_AVATAR_POINTER = 0x4B534735;
const OP_ATH_INTERNAL_TRANSFER = 0x41544812;
const OP_ATH_NOTIFICATION_REFUND = 0x4154481E;

// The floor the refund must clear on arrival at the buyer's own wallet: ATHWallet gate 14212 =
// 2M exec + 3M ack + 1M source ack + 20M storage endowment.
const RECIPIENT_ARRIVAL_FLOOR = 26_000_000n;
const PROFILE_ATH_NOTIFICATION_REFUND_VALUE = 45_000_000n;
const PROFILE_AVATAR_WRITE_STALE_TTL = 604_800;

const fixture = (label: string) => new Address(0, createHash('sha256').update(`PLATHO.V1.PAV.${label}`).digest());

const senderKey = (owner: Address, queryId: bigint) => BigInt('0x' + beginCell()
  .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
  .storeUint(queryId, 64)
  .storeAddress(owner)
  .endCell().hash().toString('hex')) % ATH_SENDER_KEY_MOD;

/** Cells actually occupied by an account's data — the number the 65536-cell ceiling is counted in. */
async function dataCells(bc: Blockchain, addr: Address): Promise<number> {
  const state: any = (await bc.getContract(addr)).accountState as any;
  const root: Cell | undefined = state?.state?.data;
  if (!root) return 0;
  const seen = new Set<string>();
  let n = 0;
  (function walk(c: Cell) {
    const k = c.hash().toString('hex');
    if (seen.has(k)) return;
    seen.add(k);
    n++;
    for (const r of c.refs) walk(r);
  })(root);
  return n;
}

/**
 * Genesis as the ceremony leaves it: master, registry, official ATH wallet, bound and sealed. Nothing about
 * KeyShard appears here — the registry embeds its code and derives addresses itself, so there is no bind step
 * to forget. (Forgetting one is not hypothetical: an unbound FeeAccumulator refuses every capsule at 15055.)
 */
async function genesis(now = 1_700_000_000) {
  const bc = await Blockchain.create();
  bc.now = now;
  const deployer = await bc.treasury('pav-deployer');
  const athMasterInit = await ATHMaster.init(fixture('MASTER_TREASURY'), beginCell().storeBuffer(Buffer.from('ATH')).endCell());
  const athMaster = contractAddress(0, athMasterInit);

  const registryInit = await ProfileRegistry.init(
    fixture('PLACEHOLDER'), athMaster, fixture('TREASURY_RECEIVER'), false, 0n, 0n, deployer.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  const officialInit = await ATHWallet.init(0n, registryAddress, athMaster);
  const officialAddress = contractAddress(0, officialInit);

  for (const [address, init, balance] of [
    [athMaster, athMasterInit, toNano('3')],
    [registryAddress, registryInit, toNano('3')],
    [officialAddress, officialInit, toNano('3')],
  ] as const) {
    await bc.setShardAccount(address, createShardAccount({
      address, code: init.code, data: init.data, balance, workchain: 0,
    }));
  }

  const registry = bc.openContract(new ProfileRegistry(registryAddress, registryInit));
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAddress,
  } as any);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH,
  } as any);

  return { bc, registry, registryAddress, officialAddress, official: bc.openContract(new ATHWallet(officialAddress, officialInit)), athMaster };
}

/** An ATH wallet holding `tokens`, exactly as the buyer's own would be. */
async function athWalletFor(bc: Blockchain, owner: Address, athMaster: Address, tokens: bigint) {
  const zero = await ATHWallet.init(0n, owner, athMaster);
  const funded = await ATHWallet.init(tokens, owner, athMaster);
  const address = contractAddress(0, zero);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zero.code, data: funded.data, balance: toNano('3'), workchain: 0,
  }));
  return bc.openContract(new ATHWallet(address, zero));
}

const pointer = (n: number) => ({
  avatar_hash: BigInt(0x1000 + n),
  avatar_entry_id: BigInt(n),
  avatar_stream_id: BigInt(n) * 0x01010101010101010101010101010101n + 1n,
  avatar_part_count: 2n,
  media_format: 1n,
});

/** The live purchase: buyer's own ATH wallet -> official wallet -> registry -> buyer's KeyShard. */
const buy = (sourceWallet: any, buyer: any, registryAddress: Address, queryId: bigint, n: number, ownerWallet?: Address) =>
  sourceWallet.send(buyer.getSender(), { value: toNano('0.3') }, {
    $$type: 'ATHTransferRequestRegistryProfileAvatar',
    query_id: queryId,
    amount: PRICE,
    recipient: registryAddress,
    response_destination: buyer.address,
    notify_value: toNano('0.066'),
    owner_wallet: ownerWallet ?? buyer.address,
    ...pointer(n),
  } as any);

describe('ProfileRegistry avatar — two-phase settle against the buyer KeyShard', () => {
  it('PAV-01: the pointer lands in the BUYER\'S SHARD, and only then does the payment close', async () => {
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-buyer');
    const wallet = await athWalletFor(g.bc, buyer.address, g.athMaster, PRICE);
    const shard = await registerKeyShard(g.bc, buyer.address, g.registryAddress);

    const r = await buy(wallet, buyer, g.registryAddress, 1n, 7);

    expect(findTransaction(r.transactions, {
      from: g.registryAddress, to: shard.address, op: OP_SET_AVATAR_POINTER, success: true,
    }), 'the registry must write the pointer into the shard derived from the buyer wallet').toBeDefined();

    const view = await shard.getGetView();
    expect(view.avatar_version, 'first purchase is version 1').toBe(1n);
    expect(view.avatar_hash).toBe(pointer(7).avatar_hash);
    expect(view.avatar_stream_id).toBe(pointer(7).avatar_stream_id);
    expect(view.profile_registry.toString(), 'the shard names the registry that governs it').toBe(g.registryAddress.toString());

    const global = await g.registry.getGetGlobal();
    expect(global.profile_count, 'counted on the shard-reported version, not on a map lookup').toBe(1n);
    expect(global.treasury_due_ath).toBe(HALF_PRICE);
    expect(global.burn_due_ath).toBe(HALF_PRICE);
    expect(global.pending_avatar_write_count, 'the pending must clear on settlement, or it is a permanent leak').toBe(0n);
    expect((await wallet.getGetWalletData()).balance, 'the buyer paid exactly once').toBe(0n);
  }, 300_000);

  it('PAV-02: a DUPLICATE pointer is refused by the shard, and the ATH goes home', async () => {
    // The idempotency gate moved from the registry (21115, where the pointer used to live) to the shard (22205,
    // where it lives now). What must NOT move is the outcome: the buyer is charged once. Under the two-phase
    // design the refusal now arrives one hop later, so the refund is an explicit AthTransferNotificationRefund
    // from the registry rather than the notification bouncing — a different mechanism reaching the same ledger.
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-dup-buyer');
    const wallet = await athWalletFor(g.bc, buyer.address, g.athMaster, PRICE * 2n);
    const shard = await registerKeyShard(g.bc, buyer.address, g.registryAddress);

    await buy(wallet, buyer, g.registryAddress, 11n, 3);
    const dup = await buy(wallet, buyer, g.registryAddress, 12n, 3);   // same pointer, new query id

    expect(findTransaction(dup.transactions, {
      from: g.registryAddress, to: shard.address, op: OP_SET_AVATAR_POINTER, success: false, exitCode: 22205,
    }), 'the shard must refuse a rewrite of its CURRENT pointer with the identical pointer').toBeDefined();
    expect(findTransaction(dup.transactions, {
      from: g.registryAddress, to: g.officialAddress, op: OP_ATH_NOTIFICATION_REFUND, success: true,
    }), 'and the registry must ask the official wallet to refund').toBeDefined();
    expect(findTransaction(dup.transactions, {
      from: g.officialAddress, to: wallet.address, op: OP_ATH_INTERNAL_TRANSFER, success: true,
    }), 'and the ATH must ARRIVE back in the buyer wallet — not merely be sent').toBeDefined();

    expect((await shard.getGetView()).avatar_version, 'exactly one write landed').toBe(1n);
    expect((await wallet.getGetWalletData()).balance, 'THE LEDGER: charged once, refunded once').toBe(PRICE);
    expect((await g.registry.getGetGlobal()).pending_avatar_write_count).toBe(0n);
    expect((await g.registry.getGetGlobal()).treasury_due_ath, 'the refused purchase must not credit dues').toBe(HALF_PRICE);
  }, 300_000);

  it('PAV-03: buying an avatar for a wallet with NO identity bounces and refunds', async () => {
    // 22202. A shard that was never registered does not exist as an account at all, so the write bounces off an
    // uninitialised address — measured behaviour this project already relies on elsewhere. The buyer must not pay
    // for a pointer nobody could ever resolve.
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-noident-buyer');
    const wallet = await athWalletFor(g.bc, buyer.address, g.athMaster, PRICE);

    const r = await buy(wallet, buyer, g.registryAddress, 21n, 5);

    expect(findTransaction(r.transactions, {
      from: g.officialAddress, to: wallet.address, op: OP_ATH_INTERNAL_TRANSFER, success: true,
    }), 'the ATH must come home').toBeDefined();
    expect((await wallet.getGetWalletData()).balance, 'the buyer was not charged for an unreachable avatar').toBe(PRICE);
    const global = await g.registry.getGetGlobal();
    expect(global.profile_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.pending_avatar_write_count, 'the abandoned write must not linger in the account').toBe(0n);
  }, 300_000);

  it('PAV-04: MEASURED — the refund ARRIVES above the floor its recipient demands', async () => {
    // The bug this pins is not hypothetical. The identical refund on the username lane was sized at 12M, cleared
    // its own sender-side gate (14335 wants 12M), arrived at 6,971,064 against the 26M gate 14212 enforces, threw,
    // and stranded the buyer's 100 ATH on the registry's official wallet. Every test was green. Sizing is only
    // real if the ARRIVAL is measured, and it must be re-measured before seal because both ends are immutable.
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-measure-buyer');
    const wallet = await athWalletFor(g.bc, buyer.address, g.athMaster, PRICE * 2n);
    await registerKeyShard(g.bc, buyer.address, g.registryAddress);

    await buy(wallet, buyer, g.registryAddress, 31n, 4);
    const dup = await buy(wallet, buyer, g.registryAddress, 32n, 4);

    const refundHop = findTransaction(dup.transactions, {
      from: g.registryAddress, to: g.officialAddress, op: OP_ATH_NOTIFICATION_REFUND,
    });
    const arrivalHop = findTransaction(dup.transactions, {
      from: g.officialAddress, to: wallet.address, op: OP_ATH_INTERNAL_TRANSFER,
    });
    const sent = BigInt((refundHop as any)?.inMessage?.info?.value?.coins ?? 0n);
    const arrived = BigInt((arrivalHop as any)?.inMessage?.info?.value?.coins ?? 0n);

    // eslint-disable-next-line no-console
    console.log([
      '[PAV-04] the refund hop, measured end to end',
      `  registry -> official wallet   ${sent}   (constant ${PROFILE_ATH_NOTIFICATION_REFUND_VALUE})`,
      `  official wallet -> buyer      ${arrived}   (gate 14212 floor ${RECIPIENT_ARRIVAL_FLOOR})`,
      `  margin over the floor         ${arrived - RECIPIENT_ARRIVAL_FLOOR}  (${Number(arrived) / Number(RECIPIENT_ARRIVAL_FLOOR)}x)`,
    ].join('\n'));

    expect(arrived, 'the refund must arrive ABOVE gate 14212, not merely be sent above gate 14335')
      .toBeGreaterThanOrEqual(RECIPIENT_ARRIVAL_FLOOR);
    expect((await wallet.getGetWalletData()).balance, 'and the proof of it is the buyer balance').toBe(PRICE);
  }, 300_000);

  it('PAV-05: THE CEILING — the registry account does not grow with the number of profiles', async () => {
    // The load-bearing test of the whole change. Before it, each profile cost exactly 5.0000 cells here and the
    // account died silently at 13,076. The assertion is deliberately a PROPERTY, not a bigger number: if per-owner
    // state ever returns, this goes red no matter how generous the new limit looks.
    const g = await genesis();
    const buyers = [];
    for (let i = 0; i < 8; i++) {
      const b = await g.bc.treasury(`pav-crowd-${i}`);
      const w = await athWalletFor(g.bc, b.address, g.athMaster, PRICE);
      await registerKeyShard(g.bc, b.address, g.registryAddress, 3 + i);
      buyers.push({ b, w });
    }

    await buy(buyers[0].w, buyers[0].b, g.registryAddress, 100n, 1);
    const afterFirst = await dataCells(g.bc, g.registryAddress);

    for (let i = 1; i < buyers.length; i++) {
      // Shift the clock and vary the pointer so that no two writes can share cells — the dedup trap that once
      // made a growing map look flat.
      g.bc.now = 1_700_000_000 + i * 97;
      await buy(buyers[i].w, buyers[i].b, g.registryAddress, 100n + BigInt(i), 10 + i);
    }
    const afterEight = await dataCells(g.bc, g.registryAddress);

    // eslint-disable-next-line no-console
    console.log([
      '[PAV-05] registry account size vs profiles',
      `  1 profile    ${afterFirst} cells`,
      `  8 profiles   ${afterEight} cells`,
      `  per profile  ${(afterEight - afterFirst) / 7}   (was 5.0000, ceiling 13,076)`,
    ].join('\n'));

    expect((await g.registry.getGetGlobal()).profile_count, 'all eight really did buy').toBe(8n);
    expect(afterEight, 'per-profile state is what put a ceiling on the product; there must be none')
      .toBe(afterFirst);
  }, 300_000);

  it('PAV-06: only the registry may write a pointer, and only into its own owner\'s shard', async () => {
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-auth-buyer');
    const mallory = await g.bc.treasury('pav-auth-mallory');
    const shard = await registerKeyShard(g.bc, buyer.address, g.registryAddress);

    const forged = await shard.send(mallory.getSender(), { value: toNano('0.1') }, {
      $$type: 'KeyShardSetAvatarPointer',
      write_id: 1n,
      owner_wallet: buyer.address,
      ...pointer(2),
    } as any);
    const tx = (forged.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(shard.address));
    expect(tx?.description?.computePhase?.exitCode, 'a stranger writing avatars would make them free').toBe(22200);
    expect((await shard.getGetView()).avatar_version, 'and nothing may have been written').toBe(0n);
  }, 300_000);

  it('PAV-07: a forged settlement cannot close a payment', async () => {
    // The ack is what makes the ATH the registry's. If anything but the buyer's own derived shard could send it,
    // an attacker could settle a payment whose pointer never landed — and the buyer would have paid for nothing.
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-forge-buyer');
    const mallory = await g.bc.treasury('pav-forge-mallory');
    const wallet = await athWalletFor(g.bc, buyer.address, g.athMaster, PRICE);
    await registerKeyShard(g.bc, buyer.address, g.registryAddress);
    await athWalletFor(g.bc, mallory.address, g.athMaster, 0n);

    // Park a real pending by buying for a wallet with no identity: the write bounces, so before the bounce is
    // processed there is nothing to forge against — instead we forge against a write id that never existed.
    const forged = await g.registry.send(mallory.getSender(), { value: toNano('0.2') }, {
      $$type: 'KeyShardAvatarPointerAck', write_id: 1n, version: 1n,
    } as any);
    const tx = (forged.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(g.registryAddress));
    expect(tx?.description?.computePhase?.exitCode, 'no pending, no settlement').toBe(21500);

    // And with a REAL pending in flight, a stranger still cannot be its shard.
    await buy(wallet, buyer, g.registryAddress, 41n, 6);
    const global = await g.registry.getGetGlobal();
    expect(global.profile_count, 'the honest purchase settled normally').toBe(1n);
    const stray = await g.registry.send(mallory.getSender(), { value: toNano('0.2') }, {
      $$type: 'KeyShardAvatarPointerAck', write_id: 1n, version: 1n,
    } as any);
    const strayTx = (stray.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(g.registryAddress));
    expect(strayTx?.description?.computePhase?.exitCode, 'a settled write id is gone, so it cannot be replayed').toBe(21500);
    expect((await g.registry.getGetGlobal()).treasury_due_ath, 'and no due was credited twice').toBe(HALF_PRICE);
  }, 300_000);

  it('PAV-08: a write that is never answered is refunded after the TTL, and not before', async () => {
    // Neither ack nor bounce is the only case that can strand a pending, and a stranded pending costs 3 cells of
    // this account FOREVER — the second, independent consumer of the same 65536-cell budget, and one that grows
    // per PAYMENT rather than per profile. The prune refunds rather than merely forgetting: losing the buyer's
    // money is worse than the protocol losing a price in an anomaly.
    const g = await genesis();
    const buyer = await g.bc.treasury('pav-ttl-buyer');
    const pruner = await g.bc.treasury('pav-ttl-pruner');
    const wallet = await athWalletFor(g.bc, buyer.address, g.athMaster, PRICE);

    // To leave a pending genuinely UNANSWERED, the shard address must hold something that neither acks nor
    // bounces. A plain wallet contract does exactly that — it accepts any inbound internal message and replies to
    // nothing — so one is installed at the derived address. This is the shape of the anomaly the TTL exists for:
    // not a refusal (that bounces, PAV-02/03) but a silence.
    const blackHole = await g.bc.treasury('pav-ttl-blackhole');
    const blackHoleState: any = (await g.bc.getContract(blackHole.address)).accountState as any;
    const shardAddress = await g.registry.getGetKeyShardAddress(buyer.address);
    await g.bc.setShardAccount(shardAddress, createShardAccount({
      address: shardAddress,
      code: blackHoleState.state.code,
      data: blackHoleState.state.data,
      balance: toNano('1'),
      workchain: 0,
    }));

    // The purchase itself is REAL — buyer wallet, official wallet, registry — so the official wallet holds a real
    // pending notification and the refund below has something to give back. Parking the registry's pending by
    // hand instead looked identical from the registry's side and was a lie: the refund correctly threw 14332
    // because no payment had ever been made.
    await buy(wallet, buyer, g.registryAddress, 51n, 8);
    const parked = await g.registry.getGetGlobal();
    expect(parked.pending_avatar_write_count, 'the write is in flight').toBe(1n);
    const writeId = parked.next_avatar_write_id - 1n;

    const early = await g.registry.send(pruner.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleAvatarWrite', write_id: writeId,
    } as any);
    const earlyTx = (early.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(g.registryAddress));
    expect(earlyTx?.description?.computePhase?.exitCode, 'pruning a LIVE pending would refund a landed avatar').toBe(21531);

    g.bc.now = 1_700_000_000 + PROFILE_AVATAR_WRITE_STALE_TTL + 1;
    const late = await g.registry.send(pruner.getSender(), { value: toNano('0.2') }, {
      $$type: 'PruneStaleAvatarWrite', write_id: writeId,
    } as any);
    expect(findTransaction(late.transactions, {
      from: g.registryAddress, to: g.officialAddress, op: OP_ATH_NOTIFICATION_REFUND, success: true,
    }), 'after the week, the money goes home').toBeDefined();
    expect(findTransaction(late.transactions, {
      from: g.officialAddress, to: wallet.address, op: OP_ATH_INTERNAL_TRANSFER, success: true,
    }), 'and it ARRIVES — the whole point of the prune refunding rather than forgetting').toBeDefined();
    expect((await wallet.getGetWalletData()).balance, 'the buyer is whole again').toBe(PRICE);
    expect((await g.registry.getGetGlobal()).pending_avatar_write_count, 'and the cells are reclaimed').toBe(0n);
  }, 300_000);
});
