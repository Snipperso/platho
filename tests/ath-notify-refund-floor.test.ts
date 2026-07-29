import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  BindProfileOfficialAthWallet,
  ProfileRegistry,
  SealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import {
  ATHWallet,
  ATHTransferRequestRegistryProfileAvatar,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE REFUND FLOOR — how much notify_value a registry purchase must carry for its REFUND to survive.
//
// A registry purchase that the registry refuses must give the ATH back. The refund travels as an
// ATHInternalTransfer funded by SendRemainingValue out of the bounced notification, and the PAYER'S wallet gates
// that arrival at 14212 (EXEC 2M + ACK 3M + SOURCE_ACK 1M + NOTIFY_STORAGE_ENDOWMENT 20M = 26M).
//
// The sender-side gate on the same money, 14335, only demands 12M. So there is a window where the refund is
// ATTEMPTED, is under-funded on arrival, and throws at the destination — and the ATH ends up stranded on the
// registry's official wallet with the buyer paid and empty-handed. ATH_TRANSFER_NOTIFY_MIN_VALUE is the only
// thing standing between a user and that window, so it must be MEASURED against the arrival, not modelled.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const OP_ATH_INTERNAL_TRANSFER = 0x41544812;
const OP_PROFILE_AVATAR_NOTIFICATION = 0xA11A7002;

/** The declared floor in ATHWallet.tact — the whole point of this file is that it is high enough. */
const ATH_TRANSFER_NOTIFY_MIN_VALUE = 45_000_000n;
/** What gate 14212 demands on arrival at the payer's wallet. Mirrors the contract: EXEC 2M + ACK 3M + SOURCE_ACK
 *  4M + NOTIFY_STORAGE_ENDOWMENT 20M. Was 26M until SOURCE_ACK was raised 1M -> 4M on 2026-07-29 (it funds the only
 *  path that clears pending_outgoing_transfers, and at 1M that path silently ran out of gas past ~4 000 entries).
 *  14212 composes that constant, so this floor moves with it — and the notify floor above must still clear it. */
const REFUND_ARRIVAL_FLOOR = 29_000_000n;

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.REFUNDFLOOR.${label}`).digest());
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

async function deployAthWallet(blockchain: Blockchain, owner: Address, athMaster: Address, tokenBalance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(tokenBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address, code: zeroInit.code, data: dataInit.data, balance: toNano('3'), workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

/**
 * Drives ONE refused avatar purchase at the given notify_value and reports what happened to the money.
 * The refusal is a duplicate pointer (21115) — the cheapest way to make a sealed registry throw on a
 * fully-formed, fully-paid purchase, which is exactly the case whose refund must work.
 */
async function refusedPurchaseAt(notifyValue: bigint, prefillProfiles = 0) {
  const blockchain = await Blockchain.create();
  // Mainnet config-18 rate era (post-Apr-2026): the sandbox default is 2023, where a cell costs 7.5x more and
  // every value measurement drifts. See sandbox-clock-decides-storage-rate.
  blockchain.now = 1_790_000_000;

  const deployer = await blockchain.treasury('refund-floor-deployer');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const init = await ProfileRegistry.init(
    fixtureAddress('PLACEHOLDER'), athMasterAddress, fixtureAddress('TREASURY'),
    false, 0n, 0n, deployer.address,
  );
  const registryAddress = contractAddress(0, init);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress, code: init.code, data: init.data, balance: toNano('2'), workchain: 0,
  }));
  const registry = blockchain.openContract(new ProfileRegistry(registryAddress, init));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
  await deployAthWallet(blockchain, registryAddress, athMasterAddress, 0n);
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindProfileOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  // Fill the registry so the refusal walks a DEEP dictionary. The refusing transaction's gas is paid out of the
  // notification's value, so a deeper registry leaves LESS for the refund — the floor must hold at scale, not
  // just on an empty contract. Prefilled by impersonating the official wallet: same state, none of the ATH path.
  for (let i = 0; i < prefillProfiles; i += 1) {
    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, {
      $$type: 'AthTransferNotificationRegistryProfileAvatar',
      query_id: BigInt(100_000 + i),
      amount: PROFILE_AVATAR_PRICE_ATH,
      sender_key: BigInt(500_000 + i),
      payer_wallet: fixtureAddress(`FILL_${i}`),
      owner_wallet: fixtureAddress(`FILL_${i}`),
      avatar_hash: BigInt(0x700000 + i),
      avatar_entry_id: BigInt(i),
      avatar_stream_id: BigInt('0x70000000000000000000000000000000') + BigInt(i),
      avatar_part_count: 2n,
      media_format: 1n,
    });
  }

  const payer = await blockchain.treasury('refund-floor-payer');
  const sourceWallet = await deployAthWallet(blockchain, payer.address, athMasterAddress, PROFILE_AVATAR_PRICE_ATH * 2n);

  const buy = (queryId: bigint) => sourceWallet.send(payer.getSender(), { value: toNano('1') }, {
    $$type: 'ATHTransferRequestRegistryProfileAvatar',
    query_id: queryId,
    amount: PROFILE_AVATAR_PRICE_ATH,
    recipient: registryAddress,
    response_destination: payer.address,
    notify_value: notifyValue,
    owner_wallet: payer.address,
    avatar_hash: 0x9001n,
    avatar_entry_id: 9n,
    avatar_stream_id: 0x90019001900190019001900190019001n,
    avatar_part_count: 2n,
    media_format: 1n,
  } as ATHTransferRequestRegistryProfileAvatar);

  // [REPOINTED 2026-07-21] This used to provoke the refusal with a DUPLICATE pointer, refused by the registry at
  // gate 21115. The avatar pointer has since moved into the buyer's KeyShard, so a duplicate is now refused one
  // hop later by the SHARD (22205) and refunded by an explicit AthTransferNotificationRefund carrying a fixed
  // 45,000,000 — a different mechanism that does NOT come out of notify_value and therefore does not measure
  // what ATH_TRANSFER_NOTIFY_MIN_VALUE funds.
  //
  // What that constant funds is still live and still reachable: a refusal the REGISTRY performs itself, in
  // COMPUTE, which bounces the notification so ATHWallet.refund_bounced_notification pays the refund out of what
  // bounced. A malformed pointer (avatar_part_count 3 > PROFILE_AVATAR_MAX_PARTS, gate 21124) is exactly such a
  // refusal, and unlike the duplicate it needs no landed first purchase to set up.
  const first = await buy(9001n);                // lands (if funded)
  const result = await sourceWallet.send(payer.getSender(), { value: toNano('1') }, {
    $$type: 'ATHTransferRequestRegistryProfileAvatar',
    query_id: 9002n,
    amount: PROFILE_AVATAR_PRICE_ATH,
    recipient: registryAddress,
    response_destination: payer.address,
    notify_value: notifyValue,
    owner_wallet: payer.address,
    avatar_hash: 0x9002n,
    avatar_entry_id: 10n,
    avatar_stream_id: 0x90029002900290029002900290029002n,
    avatar_part_count: 3n,                       // > PROFILE_AVATAR_MAX_PARTS -> refused in COMPUTE at 21124
    media_format: 1n,
  } as ATHTransferRequestRegistryProfileAvatar);

  // Refusal by ANY code, not just the duplicate gate: below ~49M the registry cannot even fund a FIRST avatar
  // record and refuses at 21112, so the purchase that must be refunded is the first one, not the second.
  const firstRefusal = findTransaction(first.transactions, {
    to: registryAddress, op: OP_PROFILE_AVATAR_NOTIFICATION, success: false,
  });
  const refused = findTransaction(result.transactions, {
    to: registryAddress, op: OP_PROFILE_AVATAR_NOTIFICATION, success: false,
  });
  const refusalExit = refused?.description.type === 'generic'
    && refused.description.computePhase.type === 'vm'
    ? refused.description.computePhase.exitCode : null;
  const firstLanded = firstRefusal === undefined;
  // The refund leg as it ARRIVES at the payer's own wallet — the hop gate 14212 guards.
  const refundArrival = findTransaction(result.transactions, {
    from: officialAthWalletAddress, to: sourceWallet.address, op: OP_ATH_INTERNAL_TRANSFER,
  });
  const arrivedValue = refundArrival?.inMessage?.info.type === 'internal'
    ? refundArrival.inMessage.info.value.coins
    : null;

  return {
    refused: refused !== undefined,
    refusalExit,
    firstLanded,
    refundAttempted: refundArrival !== undefined,
    refundSucceeded: refundArrival?.description.type === 'generic'
      && refundArrival.description.computePhase.type === 'vm'
      && refundArrival.description.computePhase.success,
    refundExitCode: refundArrival?.description.type === 'generic'
      && refundArrival.description.computePhase.type === 'vm'
      ? refundArrival.description.computePhase.exitCode : null,
    arrivedValue,
    payerAthBalance: (await sourceWallet.getGetWalletData()).balance,
    officialAthBalance: (await officialAthWallet.getGetWalletData()).balance,
    pendingLeft: (await officialAthWallet.getGetPendingNotification(9002n, senderKey(payer.address, 9002n))).exists,
  };
}

describe('ATH refund floor — a refused registry purchase must reach the payer', () => {
  it('REFUND-FLOOR-00: a notify_value inside the stranding window never leaves the payer wallet', async () => {
    // The OLD floor, 30M, was inside the window: it bought a purchase whose refund arrived with 24,037,796
    // against the 26M gate 14212 demands, so a refused purchase cost the buyer their ATH. The fix is that such a
    // value is now refused up front by the payer's own wallet (14656) — the money never leaves, so the stranding
    // path is unreachable rather than merely unlikely.
    const r = await refusedPurchaseAt(30_000_000n);
    expect(r.refused, 'nothing reaches the registry at all').toBe(false);
    expect(r.refundAttempted, 'and no refund leg is needed, because no ATH moved').toBe(false);
    expect(r.payerAthBalance, 'the payer keeps every token').toBe(PROFILE_AVATAR_PRICE_ATH * 2n);
    expect(r.officialAthBalance, 'and the registry wallet received nothing').toBe(0n);
  }, 600_000);

  it('REFUND-FLOOR-01: measure what actually arrives, across the legal notify_value range', async () => {
    const probes = [ATH_TRANSFER_NOTIFY_MIN_VALUE, 50_000_000n, 66_000_000n, 100_000_000n];
    const rows: string[] = [];
    let firstSurviving: bigint | null = null;

    for (const notifyValue of probes) {
      const r = await refusedPurchaseAt(notifyValue);
      expect(r.refused, `a refusal must occur at notify_value=${notifyValue}`).toBe(true);
      rows.push([
        `  notify_value=${notifyValue.toString().padStart(11)}`,
        `1st_landed=${String(r.firstLanded).padEnd(5)}`,
        `refused_by=${String(r.refusalExit).padStart(5)}`,
        `arrived=${(r.arrivedValue ?? -1n).toString().padStart(11)}`,
        `refund_ok=${String(r.refundSucceeded).padEnd(5)}`,
        `exit=${String(r.refundExitCode).padStart(5)}`,
        `payer_ath=${r.payerAthBalance}`,
      ].join('  '));
      if (r.refundSucceeded && firstSurviving === null) firstSurviving = notifyValue;
    }

    // eslint-disable-next-line no-console
    console.log([
      '[REFUND-FLOOR-01] refund of a REFUSED registry purchase',
      `  gate 14212 demands ${REFUND_ARRIVAL_FLOOR} on arrival; sender-side 14335 only demands 12000000`,
      ...rows,
      `  lowest notify_value whose refund survives: ${firstSurviving}`,
      `  declared ATH_TRANSFER_NOTIFY_MIN_VALUE:    ${ATH_TRANSFER_NOTIFY_MIN_VALUE}`,
    ].join('\n'));

    expect(firstSurviving, 'EVERY legal notify_value must produce a surviving refund, starting at the floor itself')
      .toBe(ATH_TRANSFER_NOTIFY_MIN_VALUE);
  }, 600_000);

  it('REFUND-FLOOR-03: the refusal overhead is now FLAT in the number of profiles', async () => {
    // [PREMISE INVERTED BY MEASUREMENT 2026-07-21 — read this before trusting the name it used to carry.]
    //
    // This test was written to measure a SLOPE. The refusing transaction's gas comes out of the notification's
    // value and dictionary gas grows with depth, so a floor calibrated on an empty registry would decay into the
    // stranding window as the product grew — silently, and unfixable after the seal. Measured then:
    //     0 profiles 6,236,737 | 200 profiles 6,336,737 | 800 profiles 6,383,404   (~+46,667 per doubling)
    //
    // The slope is GONE, because the dictionary is gone: ProfileRegistry's per-profile maps were removed on
    // 2026-07-21 when the avatar pointer moved into the buyer's KeyShard (they cost 5.0000 cells each and capped
    // the product at 13,076 profiles). There is nothing left for the refusal to walk, so the overhead is a
    // constant. Measured now: identical to the nanoton at 0, 200 and 800 profiles.
    //
    // That is worth more than the margin it buys. The floor no longer has to be sized against a future the seal
    // cannot revisit — it is sized against a number that cannot move. The assertion below therefore checks
    // FLATNESS, which is the property that must never silently regress: if per-profile state ever returns here,
    // the slope returns with it and this goes red.
    const NOTIFY = 66_000_000n;
    const rows: string[] = [];
    let worstOverhead = 0n;
    const overheads: bigint[] = [];

    for (const profiles of [0, 200, 800]) {
      const r = await refusedPurchaseAt(NOTIFY, profiles);
      expect(r.arrivedValue, `a refund must be attempted with ${profiles} profiles`).not.toBeNull();
      const overhead = NOTIFY - (r.arrivedValue ?? 0n);
      if (overhead > worstOverhead) worstOverhead = overhead;
      overheads.push(overhead);
      rows.push(`  profiles=${String(profiles).padStart(5)}  refused_by=${String(r.refusalExit).padStart(5)}  arrived=${(r.arrivedValue ?? 0n).toString().padStart(11)}  overhead=${overhead.toString().padStart(9)}`);
    }

    // eslint-disable-next-line no-console
    console.log([
      '[REFUND-FLOOR-03] refusal overhead vs registry depth',
      ...rows,
      `  worst overhead measured: ${worstOverhead}`,
      `  implied floor (26000000 + overhead): ${26_000_000n + worstOverhead}`,
      `  declared ATH_TRANSFER_NOTIFY_MIN_VALUE: ${ATH_TRANSFER_NOTIFY_MIN_VALUE}`,
    ].join('\n'));

    // THE PROPERTY. Not "the slope is small" — that is a number that drifts — but "there is no slope at all",
    // which is only true while the registry holds no per-profile state.
    expect(new Set(overheads.map(String)).size,
      'the refusal overhead must be IDENTICAL at every profile count; a spread means per-profile state is back')
      .toBe(1);
    expect(ATH_TRANSFER_NOTIFY_MIN_VALUE - worstOverhead,
      'the declared floor must still leave 14212 its 26M after the DEEPEST measured refusal').toBeGreaterThanOrEqual(REFUND_ARRIVAL_FLOOR);
  }, 900_000);

  it('REFUND-FLOOR-02: at the DECLARED legal minimum, the payer gets their ATH back', async () => {
    // The contract lets a user send exactly ATH_TRANSFER_NOTIFY_MIN_VALUE. Whatever that constant is, this is the
    // promise attached to it: pay the legal minimum, get refused, get your money back. If this goes red the
    // constant is too low and users at the floor are silently losing ATH to the registry's official wallet.
    const r = await refusedPurchaseAt(ATH_TRANSFER_NOTIFY_MIN_VALUE);

    expect(r.refused, 'the purchase is refused').toBe(true);
    expect(r.refundAttempted, 'and a refund leg is sent').toBe(true);
    expect(r.arrivedValue ?? 0n, 'the refund must arrive with at least what 14212 demands').toBeGreaterThanOrEqual(REFUND_ARRIVAL_FLOOR);
    expect(r.refundSucceeded, `the refund must be ACCEPTED by the payer's wallet (exit ${r.refundExitCode})`).toBe(true);
    expect(r.pendingLeft, 'no pending residue is left behind').toBe(false);

    // NOT A BUG, and worth naming so nobody "fixes" it later: at the floor the refusal is 21112, not the
    // duplicate gate. The floor is a WALLET-level constant shared by every lane (plain transfer, TEP-74 forward,
    // username mint, avatar), while a first avatar record needs ~49M of its own (RECORD_ENDOWMENT 36M +
    // OWNER_VERSION 9M + ACK 1M + GROWTH 3M) — so the avatar lane simply refuses a floor-sized purchase. Raising
    // the shared floor to cover the most expensive lane would tax plain transfers for nothing. What matters is
    // that the refusal is FREE: both purchases come home whole.
    expect(r.payerAthBalance, 'every refused token comes back to the payer').toBe(PROFILE_AVATAR_PRICE_ATH * 2n);
    expect(r.officialAthBalance, 'and nothing at all is stranded on the registry wallet').toBe(0n);
  }, 600_000);
});
