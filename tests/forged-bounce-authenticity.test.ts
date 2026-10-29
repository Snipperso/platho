import { describe, expect, it } from 'vitest';
import { beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { MockForgedBounceSender } from '../build/MockForgedBounceSender/MockForgedBounceSender_MockForgedBounceSender';
import { FEE_SINK } from './helpers/fee-sink-fixture';


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

    expect(deliveredBounced, 'no contract-emitted message may reach the ticket carrying the bounced bit').toBe(false);
  }, 120_000);

  it('FORGE-02: the identical body DOES credit when it arrives as a real bounce, so FORGE-01 is not vacuous', async () => {
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
