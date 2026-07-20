import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount, internal } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  ATHWallet,
  storeATHInternalTransferRegistryMintUsername,
} from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// ATHWALLET PENDING GRIEF — who can be frozen by an unprunable pending entry, and who cannot.
//
// The registry lanes (username mint / profile avatar) mark their pending entries with ATH_REGISTRY_RESPONSE_ACK_VALUE,
// and gate 14353 refuses to prune anything carrying that marker — forever, with no TTL escape. So an attacker who
// can make a victim's ATH wallet hold registry-lane pendings can grow its state without bound until it hits the
// ~65536-cell account ceiling, after which writes fail SILENTLY (compute exit 0, ACTION code 50).
//
// THE DECIDING QUESTION IS WHAT THE VICTIM'S OWNER DOES WITH THE NOTIFICATION. The wallet forwards it to its owner
// with bounce:true, and there is a bounced handler (14570) that calls refund_bounced_notification, which CLEARS the
// pending and refunds the ATH. So:
//   - an owner that THROWS on an unexpected message bounces the notification and self-heals;
//   - an owner that accepts silently — which is what an ordinary TON wallet does with an inbound internal message —
//     leaves the pending in place forever.
// That splits the exposure in a way worth pinning: the system contracts are safe and ordinary users are not, which
// is the opposite of the intuition that big system wallets are the attractive target.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544e49n;
const ATH_SENDER_KEY_MOD = 1461501637330902918203684832716283019655932542976n;
// The registry lane's value gate (14563): notify_value + REGISTRY_ACK(3M) + SOURCE_ACK(1M) + EXEC(7M) + ENDOWMENT(20M).
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

/** One registry-lane mint notification aimed at `victimWallet`, sent from `attackerOwner`'s own derived ATH wallet. */
async function attack(bc: Blockchain, victimAddress: Address, attackerOwner: Address, master: Address, queryId: bigint) {
  const attackerWalletAddr = contractAddress(0, await ATHWallet.init(0n, attackerOwner, master));
  const username = Buffer.from('victim', 'ascii');
  return bc.sendMessage(internal({
    from: attackerWalletAddr,          // gate 14561 requires the sender be the attacker's OWN derived wallet
    to: victimAddress,
    value: ATTACK_VALUE,
    bounce: true,
    body: beginCell().store(storeATHInternalTransferRegistryMintUsername({
      $$type: 'ATHInternalTransferRegistryMintUsername',
      query_id: queryId,
      amount: 1n,                      // one nanoATH — the attack costs TON, not ATH
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
    // A treasury stands in for an ordinary user's TON wallet: it accepts an inbound internal message with an
    // unfamiliar body without throwing, which is exactly what v4/v5 wallets do.
    const victimOwner = await bc.treasury('grief-victim-owner');
    const attackerOwner = await bc.treasury('grief-attacker-owner');
    const { address: victimAddress, wallet: victim } = await provisionWallet(bc, victimOwner.address, master, 0n);

    const queryId = 7001n;
    await attack(bc, victimAddress, attackerOwner.address, master, queryId);

    const key = senderKey(attackerOwner.address, queryId);
    expect((await victim.getGetPendingNotification(queryId, key)).exists,
      'the notification was accepted silently, so the pending stays').toBe(true);

    // [UPDATED with the TTL fix.] This used to assert the entry was stuck FOREVER — gate 14353 refused to prune a
    // registry-lane pending at any age, which is what made the grief permanent and unfixable after seal. Now it is
    // merely protected for the week (GRIEF-04 pins both sides of that boundary). What remains true, and is what
    // this case exists to record, is the asymmetry: an owner that accepts silently never bounces the notification,
    // so the entry opens and stays open on its own. A day — the PLAIN lane's whole TTL — is still far too early.
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
    // The system wallets (MarketStabilitySeller, ATHVesting, UsernameRegistry, ProfileRegistry) all throw on an
    // unexpected message — 23999 / 24999 / 19099 / 21400 respectively — so the notification bounces and 14570's
    // refund_bounced_notification clears the pending. ATHMaster stands in here: it likewise has no receiver for a
    // registry mint notification, so it throws in exactly the same way.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_2');
    const attackerOwner = await bc.treasury('grief-attacker-owner-2');
    const deployer = await bc.treasury('grief-deployer');

    const ownerContract = bc.openContract(await ATHMaster.fromInit(deployer.address, beginCell().endCell()));
    await ownerContract.send(deployer.getSender(), { value: toNano('1') }, null as any);

    const { address: victimAddress, wallet: victim } = await provisionWallet(bc, ownerContract.address, master, 0n);

    const queryId = 7002n;
    await attack(bc, victimAddress, attackerOwner.address, master, queryId);

    const key = senderKey(attackerOwner.address, queryId);
    expect((await victim.getGetPendingNotification(queryId, key)).exists,
      'the owner threw, the notification bounced, and the pending was cleared').toBe(false);
  }, 300_000);

  it('GRIEF-03: what freezing an ordinary user actually costs, measured', async () => {
    // The cost is what decides whether this is a real threat or a curiosity, so it is measured rather than
    // estimated: cells per stuck pending, times the account ceiling, times the value gate 14563 demands per message.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_3');
    const victimOwner = await bc.treasury('grief-cost-victim');
    const attackerOwner = await bc.treasury('grief-cost-attacker');
    const { address: victimAddress } = await provisionWallet(bc, victimOwner.address, master, 0n);

    const cells: number[] = [];
    const N = 20;
    for (let i = 0; i < N; i += 1) {
      bc.now = 1_790_000_000 + i * 61;      // vary created_at so entries cannot deduplicate and understate the cost
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
    const VALUE_GATE = 61_000_000;        // 14563 minimum: 30M notify + 3M vault ack + 1M source ack + 7M exec + 20M endowment
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

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE FIX [OWNER 2026-07-19]: the registry lanes are no longer unprunable. They carry a 7-day TTL instead of a
  // permanent block, so stuck junk can be swept and the attacker has to pay again every week rather than once.
  // ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

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

    // A day is the PLAIN lane's TTL. A registry pending must still be protected then — pruning a live one would
    // strand a buyer who has already paid, which is exactly what the old permanent block was defending.
    bc.now = 1_790_000_000 + 86_400 + 60;
    expect(await tryPrune(), 'one day is far too early for a registry pending -> 14352').toBe(14352);
    expect((await victim.getGetPendingNotification(queryId, key)).exists).toBe(true);

    // Just before the week — still refused. This is the boundary check: without it the test would also pass against
    // a gate that had no TTL at all.
    bc.now = 1_790_000_000 + 604_800 - 60;
    expect(await tryPrune(), 'a minute short of the week is still refused').toBe(14352);

    // Just after the week — swept, and the wallet actually shrinks.
    bc.now = 1_790_000_000 + 604_800 + 60;
    expect(await tryPrune(), 'past the week it sweeps').toBe(0);
    expect((await victim.getGetPendingNotification(queryId, key)).exists, 'the griefed entry is gone').toBe(false);
  }, 300_000);

  it('GRIEF-05: a real settlement finishes in SECONDS, so the week can never eat a live purchase', async () => {
    // The whole risk of a TTL is pruning a pending the registry was still going to act on: the balance is credited
    // on the inbound message, so an entry that vanishes early leaves a buyer who has paid with no mint. This pins
    // the actual margin — a legitimate flow settles immediately, six orders of magnitude inside the window.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const master = fixtureAddress('GRIEF_MASTER_5');
    const registryOwner = await bc.treasury('grief-settle-registry');
    const buyerOwner = await bc.treasury('grief-settle-buyer');
    const { address: walletAddress, wallet } = await provisionWallet(bc, registryOwner.address, master, 0n);

    const queryId = 9200n;
    const startedAt = bc.now!;
    await attack(bc, walletAddress, buyerOwner.address, master, queryId);   // same shape as a real registry payment
    const key = senderKey(buyerOwner.address, queryId);
    expect((await wallet.getGetPendingNotification(queryId, key)).exists, 'pending is open').toBe(true);

    // The owner settles — this is what a registry does on the very next transaction, accept or refuse.
    await wallet.send(registryOwner.getSender(), { value: toNano('0.05') }, {
      $$type: 'AthTransferNotificationAck', query_id: queryId, amount: 1n, sender_key: key,
    } as any);

    const settledAt = bc.now!;
    expect((await wallet.getGetPendingNotification(queryId, key)).exists, 'settled, so nothing is left to prune').toBe(false);
    expect(settledAt - startedAt, 'a real settlement takes no meaningful time at all').toBeLessThan(60);
  }, 300_000);
});
