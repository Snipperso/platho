import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { AirdropPool } from '../build/AirdropPool/AirdropPool_AirdropPool';

// DOES THE CEREMONY'S FUNDING STEP ACTUALLY FUND THE POOL?
//
// Written 2026-08-02, on mainnet, after S01 was refused. F01 had landed: the pool's official ATH wallet held exactly
// 15,000,000 ATH, every bind was set, and get_global still read funded_amount = 0, so gate 26044 refused the seal.
//
// The cause was the LANE. F01 was built as a plain ATHTransferRequest, which credits the recipient wallet and acks
// the RESPONSE DESTINATION. AirdropPool receives no message in that flow at all, and funded_amount rises only from
// AthTransferNotification, which only the notify lane makes the wallet emit.
//
// WHY THE REHEARSAL MISSED IT. clean17-genesis-full-phase.test.ts replays the whole arc — and funds the pool by
// sending AthTransferNotification straight from a stand-in account. It proves "if a notification arrives, the pool
// credits it". It cannot prove "the ceremony's funding message makes one arrive", because it never sends that
// message. A stub on the wire proves nothing about the wire.
//
// So this file refuses to hand-deliver anything. It builds the real ATHMaster, mints the real supply into the real
// treasury wallet, and sends the funding request the way the packet does — then asks the pool what it thinks.

const TOTAL_POOL = 15_000_000_000_000_000n;
const NOTIFY_VALUE = 45_000_000n;

// Same derivation ATHWallet.compute_sender_key uses, so the pending lookup asks about the entry the funding
// actually created rather than about a key of the test's own invention.
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
function senderKeyOf(queryId: bigint, senderOwner: Address): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

async function genesis() {
  const bc = await Blockchain.create();
  bc.now = 1_790_000_000;
  const treasuryOwner = await bc.treasury('fund-treasury-owner');
  const controller = await bc.treasury('fund-controller');

  const master = bc.openContract(await ATHMaster.fromInit(
    treasuryOwner.address, beginCell().storeBuffer(Buffer.from('ATH')).endCell(), 0n));
  await master.send(treasuryOwner.getSender(), { value: toNano('1') }, null);
  await master.send(treasuryOwner.getSender(), { value: toNano('0.62') },
    { $$type: 'DeployTreasurySupply', query_id: 1n, response_destination: treasuryOwner.address } as any);

  const treasuryWallet = contractAddress(0, await ATHWallet.init(0n, treasuryOwner.address, master.address));
  const pool = bc.openContract(await AirdropPool.fromInit(controller.address, 0n, 0n, false, 0n));
  await pool.send(controller.getSender(), { value: toNano('1') }, null);

  // B06: the pool learns its own master and its own wallet. Both are DERIVED, exactly as the ceremony derives them.
  const poolWallet = contractAddress(0, await ATHWallet.init(0n, pool.address, master.address));
  await pool.send(controller.getSender(), { value: toNano('0.05') }, {
    $$type: 'AirdropBindAthMaster', ath_master_address: master.address, pool_ath_wallet_address: poolWallet,
  } as any);

  return { bc, treasuryOwner, controller, master, treasuryWallet, pool, poolWallet };
}

describe('the ceremony funding step, end to end', () => {
  it('FUND-01: the NOTIFY lane makes the pool see its own money — nobody hands it a notification', async () => {
    const { bc, treasuryOwner, treasuryWallet, pool, poolWallet } = await genesis();

    expect((await pool.getGetGlobal()).funded_amount, 'precondition: the pool starts unfunded').toBe(0n);

    // The packet's F01, as the treasury owner signs it. No shortcut: this is a message to the owner's OWN wallet,
    // and every hop after it is the contracts talking to each other.
    await bc.openContract(ATHWallet.fromAddress(treasuryWallet)).send(
      treasuryOwner.getSender(), { value: 110_000_000n }, {
        $$type: 'ATHTransferRequestWithNotify',
        query_id: 1001n,
        amount: TOTAL_POOL,
        recipient: pool.address,
        response_destination: treasuryOwner.address,
        notify_destination: pool.address,
        notify_value: NOTIFY_VALUE,
      } as any);

    const walletBalance = (await bc.openContract(ATHWallet.fromAddress(poolWallet)).getGetWalletData()).balance;
    expect(walletBalance, 'the ATH must reach the pool official wallet').toBe(TOTAL_POOL);

    const g = await pool.getGetGlobal();
    expect(g.funded_amount, 'and the POOL must know it — this is what gate 26044 reads at seal time')
      .toBe(TOTAL_POOL);
    expect(g.remaining_budget, 'the whole budget is available to pay out').toBe(TOTAL_POOL);

    // And the handshake must CLOSE. The wallet writes an escrow entry before delivering a notification and clears it
    // on the owner's ack; the pool used to credit the deposit and say nothing, leaving the one deposit that funds
    // the whole airdrop sitting behind an open pending that only a stranger's prune would free.
    const pending = await bc.openContract(ATHWallet.fromAddress(poolWallet))
      .getGetPendingNotification(1001n, senderKeyOf(1001n, treasuryOwner.address));
    expect(pending.exists, 'the funding notification must be acknowledged, not left pending').toBe(false);
  }, 300_000);

  it('FUND-04: the counter-case — a recipient that never acks DOES leave the entry open', async () => {
    // Without this, FUND-01's pending check proves nothing: `exists: false` is also what an absent key returns, so
    // a wrong derivation or a wrong address would read as success. Here the recipient is a plain account that
    // accepts the notification and answers nothing, which is exactly what AirdropPool did until today.
    const { bc, treasuryOwner, treasuryWallet, master } = await genesis();
    const silent = await bc.treasury('fund-silent-recipient');
    const silentWallet = contractAddress(0, await ATHWallet.init(0n, silent.address, master.address));

    await bc.openContract(ATHWallet.fromAddress(treasuryWallet)).send(
      treasuryOwner.getSender(), { value: 110_000_000n }, {
        $$type: 'ATHTransferRequestWithNotify',
        query_id: 2002n,
        amount: 1_000n,
        recipient: silent.address,
        response_destination: treasuryOwner.address,
        notify_destination: silent.address,
        notify_value: NOTIFY_VALUE,
      } as any);

    const pending = await bc.openContract(ATHWallet.fromAddress(silentWallet))
      .getGetPendingNotification(2002n, senderKeyOf(2002n, treasuryOwner.address));
    expect(pending.exists, 'an unanswered notification must still be visible as pending — otherwise FUND-01 is '
      + 'reading a key that never existed and its success means nothing').toBe(true);
  }, 300_000);

  it('FUND-02: the PLAIN lane delivers the ATH and leaves the pool blind — the defect, pinned', async () => {
    // The exact failure that stopped the mainnet ceremony. Kept as a test rather than a comment: the money arrives,
    // every balance looks right, and the only thing that gives it away is asking the POOL what it believes.
    const { bc, treasuryOwner, treasuryWallet, pool, poolWallet } = await genesis();

    await bc.openContract(ATHWallet.fromAddress(treasuryWallet)).send(
      treasuryOwner.getSender(), { value: 58_000_000n }, {
        $$type: 'ATHTransferRequest',
        query_id: 1001n,
        amount: TOTAL_POOL,
        recipient: pool.address,
        response_destination: treasuryOwner.address,
      } as any);

    const walletBalance = (await bc.openContract(ATHWallet.fromAddress(poolWallet)).getGetWalletData()).balance;
    expect(walletBalance, 'the plain lane DOES deliver the ATH — this is why it looked fine').toBe(TOTAL_POOL);
    expect((await pool.getGetGlobal()).funded_amount,
      'and the pool is none the wiser, which is what made S01 impossible').toBe(0n);
  }, 300_000);

  it('FUND-03: the packet ships the lane that works', () => {
    // Ties the two measurements above to the artefact an operator actually signs. Without this the file proves a
    // property of the contracts and says nothing about what the ceremony will send.
    const { existsSync, readFileSync } = require('node:fs');
    const path = 'artifacts/local/mainnet_tx_dry_run_packet.json';
    if (!existsSync(path)) return;
    const packet = JSON.parse(readFileSync(path, 'utf8'));
    const f01 = (packet.funding_messages ?? []).find((f: any) => f.id === 'F01');
    expect(f01, 'the packet must carry F01').toBeTruthy();
    expect(f01.body.label, 'F01 must be built on the notify lane, or the pool cannot be funded at all')
      .toContain('ATHTransferRequestWithNotify');
    expect(BigInt(f01.value_nanotons_recommended), 'and must attach enough to clear gate 14307')
      .toBeGreaterThanOrEqual(NOTIFY_VALUE + 42_000_000n);
  });
});
