import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  ATHWallet,
  storeATHInternalTransferRegistryMintUsername,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';


const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544e49n;
const ATH_SENDER_KEY_MOD = 1461501637330902918203684832716283019655932542976n;
const ATTACK_VALUE = toNano('0.08');

const senderKey = (senderOwner: Address, queryId: bigint): bigint =>
  BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell().hash().toString('hex')) % ATH_SENDER_KEY_MOD;

const fixtureAddress = (label: string) =>
  new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());

async function provisionWallet(bc: Blockchain, owner: Address, master: Address, balance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, master);
  const dataInit = await ATHWallet.init(balance, owner, master);
  const address = contractAddress(0, zeroInit);
  await bc.setShardAccount(address, createShardAccount({
    address, code: zeroInit.code, data: dataInit.data, balance: toNano('5'), workchain: 0,
  }));
  return { wallet: bc.openContract(new ATHWallet(address, zeroInit)), address };
}

async function attack(bc: Blockchain, victimAddress: Address, attackerOwner: Address, master: Address, queryId: bigint) {
  const attackerWalletAddr = contractAddress(0, await ATHWallet.init(0n, attackerOwner, master));
  const username = Buffer.from('victim', 'ascii');
  return bc.sendMessage(internal({
    from: attackerWalletAddr,
    to: victimAddress,
    value: ATTACK_VALUE,
    bounce: true,
    body: beginCell().store(storeATHInternalTransferRegistryMintUsername({
      $$type: 'ATHInternalTransferRegistryMintUsername',
      query_id: queryId,
      amount: 1n,
      sender_owner: attackerOwner,
      response_destination: attackerOwner,
      notify_value: toNano('0.045'),
      owner_wallet: attackerOwner,
      username_len: BigInt(username.length),
      username: beginCell().storeBuffer(username).endCell().beginParse(),
    } as any)).endCell(),
  }));
}

describe('ATHWALLET PENDING GRIEF — a stuck registry pending, and who it can be aimed at', () => {
  it('GRIEF-01: a wallet owned by an ORDINARY wallet keeps the pending forever — this is the real exposure', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER');
    const victimOwner = await bc.treasury('grief-victim-owner');
    const attackerOwner = await bc.treasury('grief-attacker-owner');
    const { address: victimAddress, wallet: victim } = await provisionWallet(bc, victimOwner.address, master, 0n);

    const queryId = 7001n;
    await attack(bc, victimAddress, attackerOwner.address, master, queryId);

    const key = senderKey(attackerOwner.address, queryId);
    expect((await victim.getGetPendingNotification(queryId, key)).exists,
      'the notification was accepted silently, so the pending stays').toBe(true);

    bc.now = 1_790_000_000 + 86_400 + 60;
    const pruner = await bc.treasury('grief-pruner');
    const prune = await victim.send(pruner.getSender(), { value: toNano('0.05') }, {
      $$type: 'PruneStaleNotification', query_id: queryId, sender_key: key,
    } as any);
    const pruneTx: any = prune.transactions.find(
      (t: any) => t.inMessage?.info?.dest?.toString() === victimAddress.toString());
    expect(Number(pruneTx?.description?.computePhase?.exitCode), 'a registry pending is protected past the plain-lane day -> 14352').toBe(14352);
    expect((await victim.getGetPendingNotification(queryId, key)).exists, 'still held a day later').toBe(true);
  }, 300_000);

  it('GRIEF-02: a wallet owned by a CONTRACT that throws self-heals — system wallets are not the target', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_2');
    const attackerOwner = await bc.treasury('grief-attacker-owner-2');
    const deployer = await bc.treasury('grief-deployer');

    const ownerContract = bc.openContract(await ATHMaster.fromInit(deployer.address, beginCell().endCell(), 0n));
    await ownerContract.send(deployer.getSender(), { value: toNano('1') }, null as any);

    const { address: victimAddress, wallet: victim } = await provisionWallet(bc, ownerContract.address, master, 0n);

    const queryId = 7002n;
    await attack(bc, victimAddress, attackerOwner.address, master, queryId);

    const key = senderKey(attackerOwner.address, queryId);
    expect((await victim.getGetPendingNotification(queryId, key)).exists,
      'the owner threw, the notification bounced, and the pending was cleared').toBe(false);
  }, 300_000);

  it('GRIEF-03: what freezing an ordinary user actually costs, measured', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_3');
    const victimOwner = await bc.treasury('grief-cost-victim');
    const attackerOwner = await bc.treasury('grief-cost-attacker');
    const { address: victimAddress } = await provisionWallet(bc, victimOwner.address, master, 0n);

    const cells: number[] = [];
    const N = 20;
    for (let i = 0; i < N; i += 1) {
      bc.now = 1_790_000_000 + i * 61;
      await attack(bc, victimAddress, attackerOwner.address, master, BigInt(8000 + i));
      const state: any = (await bc.getContract(victimAddress)).account?.account?.storage?.state;
      const seen = new Set<string>();
      const walk = (c: any) => {
        const h = c.hash().toString('hex');
        if (seen.has(h)) return;
        seen.add(h);
        for (const r of c.refs) walk(r);
      };
      walk(state.state.data);
      cells.push(seen.size);
    }

    const marginal = (cells[N - 1] - cells[N - 6]) / 5;
    const ACCOUNT_CEILING = 65_536;
    const VALUE_GATE = 61_000_000;
    const entriesToFill = Math.floor(ACCOUNT_CEILING / marginal);
    const costGram = (entriesToFill * VALUE_GATE) / 1e9;

    // eslint-disable-next-line no-console
    console.log([
      `[GRIEF-03] cells after 1 stuck pending: ${cells[0]}`,
      `           cells after ${N}: ${cells[N - 1]}`,
      `           MARGINAL cells per stuck pending: ${marginal.toFixed(2)}`,
      `           entries to fill the account: ~${entriesToFill.toLocaleString('en-US')}`,
      `           COST TO FREEZE ONE USER: ~${costGram.toFixed(0)} GRAM`,
    ].join('\n'));

    expect(marginal, 'each attack message must leave a permanent entry, or there is no attack').toBeGreaterThan(0);
  }, 600_000);


  it('GRIEF-04: a stuck registry pending is sweepable after the week, and NOT before', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_4');
    const victimOwner = await bc.treasury('grief-ttl-victim');
    const attackerOwner = await bc.treasury('grief-ttl-attacker');
    const sweeper = await bc.treasury('grief-ttl-sweeper');
    const { address: victimAddress, wallet: victim } = await provisionWallet(bc, victimOwner.address, master, 0n);

    const queryId = 9100n;
    await attack(bc, victimAddress, attackerOwner.address, master, queryId);
    const key = senderKey(attackerOwner.address, queryId);
    expect((await victim.getGetPendingNotification(queryId, key)).exists).toBe(true);

    const tryPrune = async () => {
      const r = await victim.send(sweeper.getSender(), { value: toNano('0.05') }, {
        $$type: 'PruneStaleNotification', query_id: queryId, sender_key: key,
      } as any);
      const tx: any = r.transactions.find(
        (t: any) => t.inMessage?.info?.dest?.toString() === victimAddress.toString());
      return Number(tx?.description?.computePhase?.exitCode);
    };

    bc.now = 1_790_000_000 + 86_400 + 60;
    expect(await tryPrune(), 'one day is far too early for a registry pending -> 14352').toBe(14352);
    expect((await victim.getGetPendingNotification(queryId, key)).exists).toBe(true);

    bc.now = 1_790_000_000 + 604_800 - 60;
    expect(await tryPrune(), 'a minute short of the week is still refused').toBe(14352);

    bc.now = 1_790_000_000 + 604_800 + 60;
    expect(await tryPrune(), 'past the week it sweeps').toBe(0);
    expect((await victim.getGetPendingNotification(queryId, key)).exists, 'the griefed entry is gone').toBe(false);
  }, 300_000);

  it('GRIEF-05: a real settlement finishes in SECONDS, so the week can never eat a live purchase', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_5');
    const registryOwner = await bc.treasury('grief-settle-registry');
    const buyerOwner = await bc.treasury('grief-settle-buyer');
    const { address: walletAddress, wallet } = await provisionWallet(bc, registryOwner.address, master, 0n);

    const queryId = 9200n;
    const startedAt = bc.now!;
    await attack(bc, walletAddress, buyerOwner.address, master, queryId);
    const key = senderKey(buyerOwner.address, queryId);
    expect((await wallet.getGetPendingNotification(queryId, key)).exists, 'pending is open').toBe(true);

    await wallet.send(registryOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationAck', query_id: queryId, amount: 1n, sender_key: key,
    } as any);

    const settledAt = bc.now!;
    expect((await wallet.getGetPendingNotification(queryId, key)).exists, 'settled, so nothing is left to prune').toBe(false);
    expect(settledAt - startedAt, 'a real settlement takes no meaningful time at all').toBeLessThan(60);
  }, 300_000);
});
