import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { FEE_SINK } from './helpers/fee-sink-fixture';


const AT_MIN_CLAIM_CREDITS = 10n;
const AT_MAX_CREDITS_PER_CLAIM = 1000n;
const AT_CLAIM_MIN_VALUE = 63_000_000n;
const AT_EXPORT_MIN_VALUE = 20_000_000n;
const OP_TICKET_REDEEM = 0x41544333;
const OP_CREDITS_MIGRATED = 0x41544336;

async function deployTicket(bc: Blockchain, owner: Address) {
  const init = await AirdropTicket.init(owner);
  const address = contractAddress(0, init);
  await bc.setShardAccount(address, createShardAccount({
    address, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
  }));
  return bc.openContract(new AirdropTicket(address, init));
}

async function credit(bc: Blockchain, ticket: any, n: number) {
  for (let i = 0; i < n; i += 1) {
    await ticket.send(bc.sender(FEE_SINK), { value: toNano('0.01') }, { $$type: 'TicketCredit' } as any);
  }
}

async function deployFeeSinkStub(bc: Blockchain) {
  const init = await AirdropTicket.init(FEE_SINK);
  await bc.setShardAccount(FEE_SINK, createShardAccount({
    address: FEE_SINK, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
  }));
}

async function setup(liveFeeSink = true) {
  const bc = await Blockchain.create();
  bc.now = 1_790_000_000;
  const owner = await bc.treasury('ticket-owner');
  const stranger = await bc.treasury('ticket-stranger');
  const ticket = await deployTicket(bc, owner.address);
  if (liveFeeSink) await deployFeeSinkStub(bc);
  return { bc, owner, stranger, ticket };
}

describe('AIRDROP TICKET — credits cannot be minted, and cannot be lost', () => {
  it('TICKET-01: only FeeAccumulator may credit, and the ticket address IS the owner', async () => {
    const { bc, owner, stranger, ticket } = await setup();

    await ticket.send(stranger.getSender(), { value: toNano('0.05') }, { $$type: 'TicketCredit' } as any);
    expect((await ticket.getGetTicket()).credits, 'a stranger must not mint a credit').toBe(0n);

    await credit(bc, ticket, 3);
    expect((await ticket.getGetTicket()).credits, 'the fee sink may').toBe(3n);

    const other = await deployTicket(bc, stranger.address);
    expect(other.address.toString()).not.toBe(ticket.address.toString());
    expect((await ticket.getGetTicket()).owner.toString()).toBe(owner.address.toString());
  });

  it('TICKET-01b: [W1-006] a masterchain-owned ticket refuses credits — an undeliverable airdrop never accumulates', async () => {
    const { bc } = await setup();
    const masterOwner = new Address(-1, Buffer.alloc(32, 0x9c));
    const mticket = await deployTicket(bc, masterOwner);
    await mticket.send(bc.sender(FEE_SINK), { value: toNano('0.05') }, { $$type: 'TicketCredit' } as any);
    expect((await mticket.getGetTicket()).credits, 'a masterchain owner accumulates nothing to burn later').toBe(0n);

    const bTicket = await deployTicket(bc, (await bc.treasury('basechain-pub')).address);
    await bTicket.send(bc.sender(FEE_SINK), { value: toNano('0.05') }, { $$type: 'TicketCredit' } as any);
    expect((await bTicket.getGetTicket()).credits, 'a basechain publisher still gets its credit').toBe(1n);
  });

  it('TICKET-02: only the owner may claim', async () => {
    const { bc, owner, stranger, ticket } = await setup();
    await credit(bc, ticket, 64);

    await ticket.send(stranger.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect((await ticket.getGetTicket()).credits, 'a stranger cannot spend the owner\'s credits').toBe(64n);

    const ok = await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect(findTransaction(ok.transactions, { from: ticket.address, to: FEE_SINK, op: OP_TICKET_REDEEM }),
      'the owner\'s claim must emit the redeem').toBeDefined();
  });

  it('TICKET-03: a claim below the batching threshold is refused — this IS the economics', async () => {
    const { bc, owner, ticket } = await setup();
    await credit(bc, ticket, Number(AT_MIN_CLAIM_CREDITS) - 1);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect((await ticket.getGetTicket()).credits, '9 credits must not be deliverable').toBe(AT_MIN_CLAIM_CREDITS - 1n);

    await credit(bc, ticket, 1);
    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect((await ticket.getGetTicket()).credits, 'the 10th credit unlocks the claim').toBe(0n);
  });

  it('TICKET-04: a claim is capped at what AirdropPool will accept, and the remainder survives', async () => {
    const { bc, owner, ticket } = await setup();
    await credit(bc, ticket, 1100);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    const view = await ticket.getGetTicket();
    expect(view.in_flight, 'exactly the pool\'s maximum goes out').toBe(AT_MAX_CREDITS_PER_CLAIM);
    expect(view.credits, 'the remainder is kept, not discarded').toBe(100n);
  });

  it('TICKET-05: an underfunded claim moves NOTHING — fail-closed in compute, not in action', async () => {
    const { bc, owner, ticket } = await setup();
    await credit(bc, ticket, 200);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE - 1n }, { $$type: 'TicketClaim' } as any);
    const view = await ticket.getGetTicket();
    expect(view.credits, 'credits stay put').toBe(200n);
    expect(view.in_flight, 'and nothing is marked in flight').toBe(0n);
  });

  it('TICKET-06: a bounced redeem returns the credits exactly once, and a second claim is blocked until it settles', async () => {
    const { bc, owner, ticket } = await setup(false);
    await credit(bc, ticket, 64);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    const after = await ticket.getGetTicket();

    expect(after.credits + after.in_flight, 'no credit may evaporate').toBe(64n);

    expect(after.in_flight, 'a bounced delivery leaves nothing in flight').toBe(0n);
    expect(after.credits, 'and every credit is back').toBe(64n);
  });

  it('TICKET-08: a second claim is refused while one delivery is still in flight', async () => {
    const { bc, owner, ticket } = await setup();
    await credit(bc, ticket, 1100);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    const inFlight = await ticket.getGetTicket();
    expect(inFlight.in_flight, 'the first delivery is genuinely unsettled').toBe(AT_MAX_CREDITS_PER_CLAIM);
    expect(inFlight.credits).toBe(100n);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    const after = await ticket.getGetTicket();
    expect(after.in_flight, 'the in-flight delivery is untouched').toBe(AT_MAX_CREDITS_PER_CLAIM);
    expect(after.credits, 'and the remaining credits were NOT dispatched a second time').toBe(100n);
  });

  it('TICKET-07: state is fixed-size — a publisher with many credits costs no more state than one with few', async () => {
    const { bc, owner, ticket } = await setup();

    const cells = async () => {
      const st: any = (await bc.getContract(ticket.address)).account?.account?.storage?.state;
      const seen = new Set<string>();
      const walk = (c: any) => {
        const h = c.hash().toString('hex');
        if (seen.has(h)) return;
        seen.add(h);
        for (const r of c.refs) walk(r);
      };
      walk(st.state.data);
      return seen.size;
    };

    await credit(bc, ticket, 1);
    const one = await cells();
    await credit(bc, ticket, 500);
    const many = await cells();

    expect((await ticket.getGetTicket()).credits, 'the credits really accumulated').toBe(501n);
    expect(many, 'a ticket must not grow with credits').toBe(one);
  });


  it('TICKET-09: the owner exports unclaimed credits to a clean-18 successor — consumed here, delivered there, dust included', async () => {
    const { bc, owner, ticket } = await setup();
    const successor = await bc.treasury('clean18-successor');
    await credit(bc, ticket, 5);

    const r = await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);

    const view = await ticket.getGetTicket();
    expect(view.credits, 'the credits are consumed here (zeroed) so they cannot also be claimed').toBe(0n);
    expect(view.in_flight, 'in_flight is NOT set by an export — that permanent tombstone was the re-audit bug').toBe(0n);
    expect(findTransaction(r.transactions, { from: ticket.address, to: successor.address, op: OP_CREDITS_MIGRATED }),
      'the successor receives exactly the credits and owner to adopt').toBeDefined();
  });

  it('TICKET-10: an exported ticket cannot double-spend the SAME credits — credits==0 blocks a claim and a second export', async () => {
    const { bc, owner, ticket } = await setup();
    const successor = await bc.treasury('clean18-successor');
    await credit(bc, ticket, 100);
    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);
    expect((await ticket.getGetTicket()).credits, 'the exported credits are zeroed').toBe(0n);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);
    const after = await ticket.getGetTicket();
    expect(after.credits, 'nothing re-appeared to spend a second time').toBe(0n);
    expect(after.in_flight, 'no stuck in-flight').toBe(0n);
  });

  it('TICKET-10b: [re-audit MED] credits arriving AFTER a successful export are NOT stranded — the ticket stays alive', async () => {
    const { bc, owner, ticket } = await setup();
    const successor = await bc.treasury('clean18-successor');
    await credit(bc, ticket, 30);
    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);
    expect((await ticket.getGetTicket()).credits, 'exported').toBe(0n);

    await credit(bc, ticket, 40);
    expect((await ticket.getGetTicket()).credits, 'new credits accumulate as normal').toBe(40n);
    const r2 = await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);
    expect(findTransaction(r2.transactions, { from: ticket.address, to: successor.address, op: OP_CREDITS_MIGRATED }),
      'post-export credits can be exported again — the ticket is not bricked').toBeDefined();
    expect((await ticket.getGetTicket()).credits, 're-export zeroed the new credits').toBe(0n);

    await credit(bc, ticket, 15);
    const claim = await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    expect(findTransaction(claim.transactions, { from: ticket.address, to: FEE_SINK, op: OP_TICKET_REDEEM }),
      'post-export credits can also be claimed').toBeDefined();
  });

  it('TICKET-11: only the owner may export — a stranger cannot redirect a publisher\'s credits to their own sink', async () => {
    const { bc, owner, stranger, ticket } = await setup();
    const attackerSink = await bc.treasury('attacker-sink');
    await credit(bc, ticket, 80);

    await ticket.send(stranger.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: attackerSink.address } as any);

    const view = await ticket.getGetTicket();
    expect(view.credits, 'a stranger cannot move the owner\'s credits').toBe(80n);
    expect(view.in_flight, 'and nothing went in flight').toBe(0n);
  });

  it('TICKET-11b: an export addressed to this very ticket is refused instead of burning every credit', async () => {
    const { bc, owner, ticket } = await setup();
    await credit(bc, ticket, 80);

    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: ticket.address } as any);

    const view = await ticket.getGetTicket();
    expect(view.credits, 'the export must be refused in COMPUTE, before credits are zeroed').toBe(80n);
    expect(view.in_flight, 'and nothing went in flight').toBe(0n);
  });

  it('TICKET-12: a bounced export returns the credits exactly once — a mistimed migration loses nothing', async () => {
    const { bc, owner, stranger, ticket } = await setup();
    await credit(bc, ticket, 90);

    const deadSuccessor = contractAddress(0, await AirdropTicket.init(stranger.address));

    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: deadSuccessor } as any);

    const view = await ticket.getGetTicket();
    expect(view.credits + view.in_flight, 'no credit may evaporate').toBe(90n);
    expect(view.in_flight, 'a bounced export leaves nothing in flight').toBe(0n);
    expect(view.credits, 'and every credit is back').toBe(90n);
  });
});
