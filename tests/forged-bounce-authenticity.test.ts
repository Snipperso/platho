import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { MockForgedBounceSender } from '../build/MockForgedBounceSender/MockForgedBounceSender_MockForgedBounceSender';
import { FEE_SINK } from './helpers/fee-sink-fixture';

// CAN A CONTRACT FORGE A BOUNCE?
//
// Every `bounced(...)` receiver in this repo is selected by ONE header bit. Tact routes on that bit; it does not, by
// itself, say who sent the message. Most bounced receivers here re-check sender() against the address the original
// message was addressed to — UsernameRegistry does it in all four, ProfileRegistry derives the KeyShard address and
// compares. AirdropTicket's two do not, and both of them ADD CREDITS:
//
//     bounced(msg: bounced<TicketRedeem>)          { self.credits += msg.credits_k; ... }
//     bounced(msg: bounced<TicketCreditsMigrated>) { self.credits += msg.credits_k; }
//
// If an arbitrary contract can emit a message with `bounced` set, that is minting: forge a bounce naming a large
// credits_k, then claim, and the airdrop pool pays real ATH against credits nobody earned. The whole 15M ATH airdrop
// would be drainable by anyone who can deploy a contract. If instead the network refuses or strips the bit on an
// outgoing message, a bounce is unforgeable and the two receivers are safe as written.
//
// Reading the spec does not settle it, and the answer decides whether an immutable contract ships with a hole. So
// this asks the emulator, through the REAL action phase: MockForgedBounceSender builds the message cell by hand with
// bounced=1 and hands it to SENDRAWMSG. Whatever the network does to that message is what this test records.
//
// MEASURED 2026-07-30, and the answer is NOT the one to guess. The forger's action phase SUCCEEDS and the message IS
// emitted (actionPhase.success = true, resultCode 0, one outbound message). The chain then delivers it with the bit
// CLEARED: the receiving transaction reports inMessage.info.bounced === false. A contract may ask for the bit; the
// network simply refuses to carry it. The ticket therefore saw an ordinary internal message with an unknown opcode
// and swallowed it in `receive(_: Slice) {}` — credits unchanged.
//
// CONSEQUENCE, recorded deliberately: AirdropTicket's two sender-less bounced receivers are SAFE AS WRITTEN, and the
// contract is left alone rather than churned before a seal. A sender check on bounced<TicketCreditsMigrated> is not
// even constructible: the legitimate sender is the export destination, and a bounce preserves 224 bits of fields
// while an Address alone is 267. The guarantee lives in the NETWORK, not in the contract — so this test is what
// holds it. It fails the moment an emulator or protocol change starts letting the bit through, which is the only way
// this could ever become exploitable, and the contract can never be redeployed to react.
//
// Pinned in BOTH directions on purpose: FORGE-01 would pass just as happily against a ticket that ignores every
// bounce, so FORGE-02 requires a genuine network-generated bounce to still credit.

const OP_TICKET_REDEEM = 0x41544333;
const FORGED_CREDITS = 4_000_000;

async function setup() {
  const bc = await Blockchain.create();
  bc.now = 1_790_000_000;

  const ticketOwner = await bc.treasury('forged-bounce-ticket-owner');
  const ticketInit = await AirdropTicket.init(ticketOwner.address);
  const ticketAddr = contractAddress(0, ticketInit);
  await bc.setShardAccount(ticketAddr, createShardAccount({
    address: ticketAddr, code: ticketInit.code, data: ticketInit.data, balance: toNano('1'), workchain: 0,
  }));
  const ticket = bc.openContract(new AirdropTicket(ticketAddr, ticketInit));

  const attackerDeployer = await bc.treasury('forged-bounce-attacker');
  const forgerInit = await MockForgedBounceSender.init();
  const forgerAddr = contractAddress(0, forgerInit);
  await bc.setShardAccount(forgerAddr, createShardAccount({
    address: forgerAddr, code: forgerInit.code, data: forgerInit.data, balance: toNano('10'), workchain: 0,
  }));
  const forger = bc.openContract(new MockForgedBounceSender(forgerAddr, forgerInit));

  return { bc, ticket, ticketAddr, forger, forgerAddr, attackerDeployer };
}

/** A bounced body: 0xFFFFFFFF, then the original opcode, then as much of the original body as survives. */
function bouncedRedeemBody(creditsK: number) {
  return beginCell()
    .storeUint(0xFFFFFFFF, 32)
    .storeUint(OP_TICKET_REDEEM, 32)
    .storeUint(creditsK, 32)
    .endCell();
}

describe('a bounce cannot be forged by an ordinary sender', () => {
  it('FORGE-01: a contract-emitted message with the bounced bit set does not credit the ticket', async () => {
    const { ticket, ticketAddr, forger, forgerAddr, attackerDeployer } = await setup();

    const before = (await ticket.getGetTicket()).credits;
    expect(before, 'the ticket starts with nothing earned').toBe(0n);

    const res = await forger.send(attackerDeployer.getSender(), { value: toNano('1') }, {
      $$type: 'ForgeBounce',
      target: ticketAddr,
      body: bouncedRedeemBody(FORGED_CREDITS),
      attach: toNano('0.05'),
    } as any);

    // Record WHAT the network did with the forged message, not just the end state — the two possible reasons for a
    // clean result are different facts about TON and only one of them is a guarantee worth relying on. Either the
    // action phase refused to emit a message carrying the bit, or it emitted it with the bit cleared, in which case
    // the ticket saw an ordinary internal message and swallowed it in `receive(_: Slice) {}`.
    const forgerTx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(forgerAddr));
    const emitted = forgerTx?.outMessages?.values?.() ?? [];
    const deliveredBounced = res.transactions.some(
      (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage.info.bounced === true
        && t.inMessage.info.dest?.equals?.(ticketAddr),
    );
    const actionSucceeded = forgerTx?.description?.actionPhase?.success;

    const after = (await ticket.getGetTicket()).credits;
    expect(after, 'if this is not 0, ANY deployable contract mints airdrop credits at will: bounced<TicketRedeem> '
      + 'and bounced<TicketCreditsMigrated> both do `self.credits += msg.credits_k` with no sender check, and a '
      + `claim turns those credits into real ATH out of the 15M pool. Diagnostics — action phase success=${actionSucceeded}, `
      + `messages emitted=${emitted.length}, a bounced-flagged message reached the ticket=${deliveredBounced}`).toBe(0n);

    // Pin the MECHANISM, so a future change that starts letting the bit through is caught here rather than in
    // production. Whichever way the network refuses, it must not be by delivering a bounced-flagged message.
    expect(deliveredBounced, 'no contract-emitted message may reach the ticket carrying the bounced bit').toBe(false);
  }, 120_000);

  it('FORGE-02: the identical body DOES credit when it arrives as a real bounce, so FORGE-01 is not vacuous', async () => {
    // Without this half, FORGE-01 would pass just as happily against a ticket that ignores every bounce, a body with
    // the wrong opcode, or a target that holds nothing — a guard aimed at nothing looks exactly like a working one.
    //
    // The control uses a bounce the NETWORK generated: TicketClaim sends TicketRedeem to FEE_SINK with bounce:true,
    // and FEE_SINK is uninitialised in this fixture, so the redeem comes straight back. Same receiver, same opcode,
    // same credits_k field — the only difference from FORGE-01 is who set the bit.
    const { bc, ticket } = await setup();

    const EARNED = 12;
    for (let i = 0; i < EARNED; i++) {
      await ticket.send(bc.sender(FEE_SINK), { value: toNano('0.01') }, { $$type: 'TicketCredit' } as any);
    }
    expect((await ticket.getGetTicket()).credits, 'credits must accrue before the claim').toBe(BigInt(EARNED));

    const owner = await bc.treasury('forged-bounce-ticket-owner');
    const res = await ticket.send(owner.getSender(), { value: toNano('0.1') }, { $$type: 'TicketClaim' } as any);

    const realBounce = res.transactions.some(
      (t: any) => t.inMessage?.info?.type === 'internal' && t.inMessage.info.bounced === true,
    );
    expect(realBounce, 'the redeem must have genuinely bounced off the uninitialised FEE_SINK').toBe(true);

    const after = await ticket.getGetTicket();
    expect(after.credits, 'and the bounced handler must have put the credits back — this is the receiver FORGE-01 '
      + 'proves an attacker cannot reach').toBe(BigInt(EARNED));
    expect(after.in_flight, 'with the interlock released').toBe(0n);
  }, 120_000);
});
