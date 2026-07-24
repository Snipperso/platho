import { describe, expect, it } from 'vitest';
import { Address, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AIRDROP TICKET — the per-publisher credit accumulator that makes batched delivery possible.
//
// A payout costs the caller 60,368,203 whether it carries one credit or a thousand, and none of it returns
// (neither ATHWallet nor AirdropPool has any TON exit path). Per-capsule delivery would immure ~90,000 GRAM
// across the airdrop against the 15,000 GRAM those capsules collect. This contract batches the DELIVERY without
// touching the RATE — 10 ATH per capsule, unchanged.
//
// What these tests guard is the two ways a ticket could betray its holder: minting credits nobody paid for, and
// losing credits that were paid for.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

// Must equal AT_FEE_SINK in contracts/AirdropTicket.tact — the same address RecordShard names as RS_FEE_SINK.
// [CORRECTED 2026-07-21] This mirror was left at the PRE-REBAKE address when the three contract-side
// constants were rebaked on 2026-07-20. Rebaking a constant in the contracts and not in the tests that
// mirror it turns the whole suite red for a reason that looks like a protocol defect and is not one.
const FEE_SINK = Address.parse('EQCpZjky6GPpte-242B_1Hw-Py1lcPcUZk63p6bvzsXQUHy-');
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

/** Credit a ticket n times, as FeeAccumulator would after authenticating n published capsules. */
async function credit(bc: Blockchain, ticket: any, n: number) {
  for (let i = 0; i < n; i += 1) {
    await ticket.send(bc.sender(FEE_SINK), { value: toNano('0.01') }, { $$type: 'TicketCredit' } as any);
  }
}

/**
 * A live account at FEE_SINK that accepts the redeem instead of bouncing it.
 * Without this the redeem bounces (nothing is deployed there), the bounce handler restores the credits, and
 * every claim test would silently measure the BOUNCE path rather than the claim path — which is exactly what
 * the first run of this file did. AirdropTicket's own code is reused as the stub purely because its
 * `receive(_: Slice)` catch-all tolerates an unknown body.
 */
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

    // A stranger crediting would be free ATH: the credit is the whole authorisation chain condensed to one hop.
    await ticket.send(stranger.getSender(), { value: toNano('0.05') }, { $$type: 'TicketCredit' } as any);
    expect((await ticket.getGetTicket()).credits, 'a stranger must not mint a credit').toBe(0n);

    await credit(bc, ticket, 3);
    expect((await ticket.getGetTicket()).credits, 'the fee sink may').toBe(3n);

    // Identity is structural, not stored-and-trusted: a different owner is a different account entirely, so a
    // ticket can never be pointed at someone else's payout.
    const other = await deployTicket(bc, stranger.address);
    expect(other.address.toString()).not.toBe(ticket.address.toString());
    expect((await ticket.getGetTicket()).owner.toString()).toBe(owner.address.toString());
  });

  it('TICKET-02: only the owner may claim', async () => {
    const { bc, owner, stranger, ticket } = await setup();
    await credit(bc, ticket, 64);

    // A stranger forcing claims is not theft — the payout still goes to the owner — but it burns the delivery
    // cost this contract exists to amortise, one minimum batch at a time, for free.
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
    // AirdropPool gate 26112 refuses credits_k > 1000. Asking for more would bounce the whole delivery, so the
    // ticket clamps instead — and the leftover 100 must still be there to claim again, not rounded away.
    expect(view.in_flight, 'exactly the pool\'s maximum goes out').toBe(AT_MAX_CREDITS_PER_CLAIM);
    expect(view.credits, 'the remainder is kept, not discarded').toBe(100n);
  });

  it('TICKET-05: an underfunded claim moves NOTHING — fail-closed in compute, not in action', async () => {
    const { bc, owner, ticket } = await setup();
    await credit(bc, ticket, 200);

    // The failure this guards is the repo's worst class: a claim that debits credits, then fails in the ACTION
    // phase, where compute still reports exit 0 and the credits are simply gone.
    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE - 1n }, { $$type: 'TicketClaim' } as any);
    const view = await ticket.getGetTicket();
    expect(view.credits, 'credits stay put').toBe(200n);
    expect(view.in_flight, 'and nothing is marked in flight').toBe(0n);
  });

  it('TICKET-06: a bounced redeem returns the credits exactly once, and a second claim is blocked until it settles', async () => {
    // Deliberately NO live fee sink here: the redeem to a dead address bounces, which is precisely the case
    // that must not eat a publisher's airdrop.
    const { bc, owner, ticket } = await setup(false);
    await credit(bc, ticket, 64);

    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    const after = await ticket.getGetTicket();

    // Either the bounce already landed (credits restored, nothing in flight) or it is still in flight — but
    // credits must never be BOTH gone and not in flight, which is the shape of a silent loss.
    expect(after.credits + after.in_flight, 'no credit may evaporate').toBe(64n);

    expect(after.in_flight, 'a bounced delivery leaves nothing in flight').toBe(0n);
    expect(after.credits, 'and every credit is back').toBe(64n);
  });

  it('TICKET-08: a second claim is refused while one delivery is still in flight', async () => {
    // THE GATE MUTATION TESTING FOUND UNCOVERED. Disabling 27011 broke nothing in the first version of this
    // file, because every claim test either settled or bounced inside the same chain — so the one state the
    // gate exists for, an UNSETTLED delivery, was never actually reached. It is reachable here because the fee
    // sink stub accepts the redeem and never acks, which is exactly what a slow or stuck settlement looks like.
    //
    // Without the gate the same credits go out twice: the pool pays 1000 credits, then pays 1000 again for a
    // delivery that has already been dispatched.
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
    // The reason this is a contract per publisher and not a map in a singleton. If the ticket ever grew per
    // credit it would rebuild the ~65536-cell account ceiling one user at a time.
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

  // ─── W1-007: migration export. A bug-fix redeploy keeps the permanent pool (ADR9) but repoints the distributor,
  // after which THIS ticket's claims bounce (26110) and its unclaimed credits would strand. The owner moves them.
  // [OWNER INVARIANT 2026-07-24: a redeploy must lose neither the undistributed pool nor already-credited coins.]

  it('TICKET-09: the owner exports unclaimed credits to a clean-18 successor — consumed here, delivered there, dust included', async () => {
    const { bc, owner, ticket } = await setup();
    const successor = await bc.treasury('clean18-successor');
    await credit(bc, ticket, 5);   // BELOW the 10 claim threshold on purpose: dust must migrate, never strand

    const r = await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);

    const view = await ticket.getGetTicket();
    expect(view.credits, 'the credits are consumed here so they cannot also be claimed').toBe(0n);
    expect(view.in_flight, 'and held in flight, which is what blocks a re-spend').toBe(5n);
    expect(findTransaction(r.transactions, { from: ticket.address, to: successor.address, op: OP_CREDITS_MIGRATED }),
      'the successor receives exactly the credits and owner to adopt').toBeDefined();
  });

  it('TICKET-10: an exported ticket cannot double-spend — neither a claim nor a second export moves the credits again', async () => {
    const { bc, owner, ticket } = await setup();
    const successor = await bc.treasury('clean18-successor');
    await credit(bc, ticket, 100);
    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);
    expect((await ticket.getGetTicket()).in_flight, 'the export is genuinely in flight').toBe(100n);

    // A claim is refused by the same 27011 interlock that stops a double-delivery; a second export by 27031.
    await ticket.send(owner.getSender(), { value: AT_CLAIM_MIN_VALUE }, { $$type: 'TicketClaim' } as any);
    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: successor.address } as any);

    const after = await ticket.getGetTicket();
    expect(after.credits, 'nothing re-appeared to spend a second time').toBe(0n);
    expect(after.in_flight, 'the credits stay accounted exactly once').toBe(100n);
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

  it('TICKET-12: a bounced export returns the credits exactly once — a mistimed migration loses nothing', async () => {
    const { bc, owner, stranger, ticket } = await setup();
    await credit(bc, ticket, 90);

    // A successor that is not deployed: the bounceable export bounces back, exactly the case that must not eat an
    // airdrop. Basechain (so 27033 passes) but uninitialised (so it bounces).
    const deadSuccessor = contractAddress(0, await AirdropTicket.init(stranger.address));

    await ticket.send(owner.getSender(), { value: AT_EXPORT_MIN_VALUE },
      { $$type: 'TicketExportCredits', to: deadSuccessor } as any);

    const view = await ticket.getGetTicket();
    expect(view.credits + view.in_flight, 'no credit may evaporate').toBe(90n);
    expect(view.in_flight, 'a bounced export leaves nothing in flight').toBe(0n);
    expect(view.credits, 'and every credit is back').toBe(90n);
  });
});
