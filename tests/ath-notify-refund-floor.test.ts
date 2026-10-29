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


const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const OP_ATH_INTERNAL_TRANSFER = 0x41544812;
const OP_PROFILE_AVATAR_NOTIFICATION = 0xA11A7002;

const ATH_TRANSFER_NOTIFY_MIN_VALUE = 45_000_000n;
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

async function refusedPurchaseAt(notifyValue: bigint, prefillProfiles = 0) {
  const blockchain = await Blockchain.create();
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

  const first = await buy(9001n);
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
    avatar_part_count: 3n,
    media_format: 1n,
  } as ATHTransferRequestRegistryProfileAvatar);

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

    expect(new Set(overheads.map(String)).size,
      'the refusal overhead must be IDENTICAL at every profile count; a spread means per-profile state is back')
      .toBe(1);
    expect(ATH_TRANSFER_NOTIFY_MIN_VALUE - worstOverhead,
      'the declared floor must still leave 14212 its 26M after the DEEPEST measured refusal').toBeGreaterThanOrEqual(REFUND_ARRIVAL_FLOOR);
  }, 900_000);

  it('REFUND-FLOOR-02: at the DECLARED legal minimum, the payer gets their ATH back', async () => {
    const r = await refusedPurchaseAt(ATH_TRANSFER_NOTIFY_MIN_VALUE);

    expect(r.refused, 'the purchase is refused').toBe(true);
    expect(r.refundAttempted, 'and a refund leg is sent').toBe(true);
    expect(r.arrivedValue ?? 0n, 'the refund must arrive with at least what 14212 demands').toBeGreaterThanOrEqual(REFUND_ARRIVAL_FLOOR);
    expect(r.refundSucceeded, `the refund must be ACCEPTED by the payer's wallet (exit ${r.refundExitCode})`).toBe(true);
    expect(r.pendingLeft, 'no pending residue is left behind').toBe(false);

    expect(r.payerAthBalance, 'every refused token comes back to the payer').toBe(PROFILE_AVATAR_PRICE_ATH * 2n);
    expect(r.officialAthBalance, 'and nothing at all is stranded on the registry wallet').toBe(0n);
  }, 600_000);
});
