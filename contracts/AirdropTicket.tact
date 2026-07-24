// AirdropTicket — one account per publisher, holding that publisher's unredeemed capsule credits.
//
// WHY THIS CONTRACT EXISTS AT ALL, in one measured number. Delivering an airdrop payout costs the caller
// 60,368,203 nanoton (tests/airdrop-delivery-cost.test.ts), and the caller pays exactly that whether the payout
// carries ONE credit or a THOUSAND — the cost is per DELIVERY, not per credit. None of it comes back: ATHWallet
// has no TON exit path at all (no myBalance, no nativeReserve, no SendRemainingBalance, no mode 128 in any of
// its receivers) and neither has AirdropPool, so every nanoton over-attached is immured for the life of the
// contract. Paying out per capsule would therefore immure ~90,000 GRAM across the 1.5M-capsule airdrop against
// the 15,000 GRAM those same capsules collect in protocol fees.
//
// Batching removes that entirely and — this is the point — WITHOUT touching the owner's frozen arithmetic. The
// accrual rate stays 10 ATH per capsule, 1.5M capsules, 15M ATH. Only the delivery granularity moves. At 1000
// credits per delivery the cost falls to ~16,635 per capsule, 0.17% of the fee.
//
// WHY A CONTRACT PER PUBLISHER rather than a map in a singleton: a per-publisher map is a permanent entry per
// user on one account, and an account dies at ~65536 cells — silently, with compute reporting exit 0 while the
// write fails in ACTION with code 50. That ceiling has already killed a monolith and capped this product's
// names and profiles once. A contract per entity is the clean-17 answer everywhere else and it is the answer
// here; the state below is fixed-size and never grows.

// The one address allowed to credit a ticket, and the one this ticket redeems through: FeeAccumulator. It is a
// compile-time constant, exactly as RecordShard names the same contract in RS_FEE_SINK, so no binding ceremony
// can capture it and no controller can repoint it.
//
// THE BUILD ORDER THIS DEPENDS ON, and why it does not cycle: FeeAccumulator.init takes only
// (treasury_receiver, buyback_burn) — it does not embed this contract's code, it BINDS it at genesis as runtime
// data. So FeeAccumulator's address is fixed before this contract is compiled, this contract can name it, and
// FeeAccumulator can still authenticate a ticket by rebuilding its address from the bound code plus the owner.
// Had FeeAccumulator embedded ticket code instead, its address would depend on ticket code, which depends on
// its address — the same cycle that stops AirdropPool from simply importing RecordShard.
const AT_FEE_SINK: Address = address("EQCpZjky6GPpte-242B_1Hw-Py1lcPcUZk63p6bvzsXQUHy-");

// ~100 years of config-18 basechain rent for this account (1 + code + data cells at 64,962 nanoton/cell/year)
// plus cushion. Charged once, on the deploy that the first credit performs.
const AT_BASE_ENDOWMENT: Int = 40000000;

// The batching threshold, and the whole economic argument in one constant. Below this a claim would spend more
// on delivery than the credits are worth collecting: 64 credits carry 640 ATH and cost one 60,368,203 delivery,
// i.e. ~943,253 per capsule — still under the 10,000,000 fee that capsule paid, with ~10x margin. Anything
// lower starts eating the pool's own funding.
const AT_MIN_CLAIM_CREDITS: Int = 64;

// AirdropPool gate 26112 refuses credits_k > 1000, so a claim may never ask for more than that in one delivery.
// A publisher with more simply claims repeatedly; nothing is lost, only batched again.
const AT_MAX_CREDITS_PER_CLAIM: Int = 1000;

// What a claim must carry: the redeem hop, FeeAccumulator's own execution, the AirdropAccrue leg (AirdropPool
// gate 26114 demands 60,000,000 and REFUSES at 59,000,000 — measured), and forward fees for both hops.
const AT_CLAIM_MIN_VALUE: Int = 63000000;

// What an ExportCredits must carry to fund the one hop to the clean-18 successor plus the successor's own
// adoption. The successor funds its own DEPLOY at migration time (this ticket cannot know clean-18's code cell,
// so it attaches no StateInit); this is the forward hop plus a generous cushion for the adopt receiver's compute.
const AT_EXPORT_MIN_VALUE: Int = 20000000;

// "ATC1" — the credit. Carries nothing: the ticket's own address already commits to its owner, and the amount
// is always exactly one capsule. A field would only be something to forge.
message(0x41544331) TicketCredit {}

// "ATC2" — the owner asks for their credits to be delivered.
message(0x41544332) TicketClaim {}

// "ATC5" — the owner moves their unclaimed credits to the next generation. WHY THIS EXISTS: the permanent
// AirdropPool survives a bug-fix redeploy holding the undistributed 15M (that is the whole point of ADR9,
// AirdropPool.tact:54), but a redeploy that changes FeeAccumulator's CODE moves its address and repoints the
// pool's distributor — after which THIS ticket's claims bounce at the pool's 26110 and its unclaimed credits are
// stranded. This hook moves them to the owner's clean-18 ticket instead of losing them. [OWNER INVARIANT
// 2026-07-24: a redeploy must lose neither the undistributed pool nor already-credited user coins.]
//
// It is NOT the read-only KeyShard prove-hook: credits are SPENDABLE, so exporting must CONSUME them here (move to
// in_flight, credits -> 0) to make a double-claim structurally impossible — the same in_flight interlock TicketClaim
// uses. Owner-gated so no one else can redirect a publisher's credits. Consumed-and-forwarded with bounce-restore
// so a mistimed export can never lose them. Works below the 64 claim threshold too, so dust credits migrate rather
// than strand.
message(0x41544335) TicketExportCredits {
    to: Address;          // the clean-18 successor ticket that will adopt these credits
}

// "ATC6" — this ticket -> its clean-18 successor: the credits to adopt and the owner they belong to. The successor
// authenticates it by rebuilding THIS ticket's address from the clean-17 ticket code plus `owner` (the same
// derive-and-compare FeeAccumulator uses at gate 15055), so no forged message can inject credits it never earned.
// credits_k is FIRST so a bounce preserves it — only the first 224 bits of a bounced body survive — exactly as
// TicketRedeem is ordered for its own bounce handler.
message(0x41544336) TicketCreditsMigrated {
    credits_k: Int as uint32;
    owner: Address;
}

// "ATC3" — the redeem, sent to FeeAccumulator, which authenticates this ticket by rebuilding its address from
// the bound ticket code and `owner`, then emits AirdropAccrue to AirdropPool.
//
// FIELD ORDER IS LOAD-BEARING. A bounced message preserves only the first 224 bits of the body, so anything the
// bounce handler must read has to fit there: opcode (32) + credits_k (32) = 64 bits, comfortably inside.
// `owner` is an Address (267 bits) and would NOT survive, which is why credits_k comes first and why the bounce
// handler below needs nothing else. FeeAccumulator applies the same reasoning to bounced<AcceptBurnReserve>.
message(0x41544333) TicketRedeem {
    credits_k: Int as uint32;
    owner: Address;
}

struct AirdropTicketView {
    owner: Address;
    credits: Int;
    in_flight: Int;
    min_claim_credits: Int;
    max_credits_per_claim: Int;
    claim_min_value: Int;
}

contract AirdropTicket {
    owner: Address;
    credits: Int as uint32;
    // Credits handed to a redeem that has not yet settled. Held OUT of `credits` so a second claim cannot
    // deliver the same credits twice, and restored on bounce. Deliberately a plain counter and not a map: a
    // claim is settled or bounced within the same chain of transactions, so there is never more than one.
    in_flight: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.credits = 0;
        self.in_flight = 0;
    }

    // Byte-for-byte AirdropPool.isBasechainAddress (AirdropPool.tact:201). A masterchain successor would be
    // unpayable at basechain gas, the same reason the pool refuses a masterchain buyer.
    fun isBasechainAddress(a: Address): Bool {
        let s: Slice = a.asSlice();
        return s.loadUint(11) == 1024;
    }

    // The ONLY way credits come into existence. FeeAccumulator emits this after it has authenticated that a real
    // RecordShard forwarded a real protocol fee for a signed, non-replayed capsule — so one credit exists if and
    // only if 0.01 GRAM actually reached the fee pool for a published capsule.
    receive(_: TicketCredit) {
        throwUnless(27001, sender() == AT_FEE_SINK);
        // uint32 holds 4.29e9; the whole airdrop is 1.5e6 capsules, so this cannot be reached by publishing.
        // Gated anyway, in COMPUTE, because an overflow here would wrap a publisher's balance to zero silently.
        throwUnless(27002, self.credits < 4294967295);
        self.credits += 1;
    }

    // The owner pulls. Permissioned to the owner alone: a stranger triggering claims could otherwise force a
    // publisher's credits out in wasteful 64-credit dribbles, burning the delivery cost this contract exists to
    // amortise.
    receive(_: TicketClaim) {
        throwUnless(27010, sender() == self.owner);
        throwUnless(27011, self.in_flight == 0);
        throwUnless(27012, self.credits >= AT_MIN_CLAIM_CREDITS);
        // Fail-closed in COMPUTE, before any state change: a claim that cannot fund its own delivery must bounce
        // rather than move credits into flight and then fail in ACTION, where the failure is invisible.
        throwUnless(27013, context().value >= AT_CLAIM_MIN_VALUE);

        let k: Int = self.credits;
        if (k > AT_MAX_CREDITS_PER_CLAIM) {
            k = AT_MAX_CREDITS_PER_CLAIM;
        }
        self.credits -= k;
        self.in_flight = k;

        message(MessageParameters {
            to: AT_FEE_SINK,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TicketRedeem{ credits_k: k, owner: self.owner }.toCell(),
        });
    }

    // The redeem could not be delivered or was refused. The credits were never paid out, so they come back —
    // exactly once, because in_flight is cleared here and a second bounce for the same claim cannot exist.
    bounced(msg: bounced<TicketRedeem>) {
        self.credits += msg.credits_k;
        self.in_flight = 0;
    }

    // Migration export — move unclaimed credits to the owner's clean-18 ticket. See TicketExportCredits above.
    // Double-claim is structurally impossible: this CONSUMES the credits into in_flight, and the 27011 interlock on
    // TicketClaim plus 27031 here mean the same credits can never be both exported and claimed. A successful export
    // leaves in_flight set (credits already gone), which is exactly what keeps the dead ticket from re-spending; a
    // bounce restores both, so a mistimed export loses nothing.
    receive(msg: TicketExportCredits) {
        throwUnless(27030, sender() == self.owner);
        throwUnless(27031, self.in_flight == 0);
        throwUnless(27032, self.credits > 0);
        throwUnless(27033, self.isBasechainAddress(msg.to));
        // Fail-closed in COMPUTE, before any state change, exactly as TicketClaim does.
        throwUnless(27034, context().value >= AT_EXPORT_MIN_VALUE);

        let k: Int = self.credits;
        self.credits = 0;
        self.in_flight = k;

        message(MessageParameters {
            to: msg.to,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TicketCreditsMigrated{ credits_k: k, owner: self.owner }.toCell(),
        });
    }

    // The successor could not adopt (uninitialised, refused, or a wrong-generation ticket). The credits were never
    // adopted, so they come back — exactly once, symmetric with bounced<TicketRedeem>.
    bounced(msg: bounced<TicketCreditsMigrated>) {
        self.credits += msg.credits_k;
        self.in_flight = 0;
    }

    // Settlement: FeeAccumulator confirms the accrual left for AirdropPool. Only it may say so.
    receive(_: TicketRedeemAck) {
        throwUnless(27020, sender() == AT_FEE_SINK);
        self.in_flight = 0;
    }

    receive() {}           // plain TON top-up — also how anyone may keep this account alive
    receive(_: Slice) {}   // tolerate unknown bodies instead of bouncing them

    get fun get_ticket(): AirdropTicketView {
        return AirdropTicketView {
            owner: self.owner,
            credits: self.credits,
            in_flight: self.in_flight,
            min_claim_credits: AT_MIN_CLAIM_CREDITS,
            max_credits_per_claim: AT_MAX_CREDITS_PER_CLAIM,
            claim_min_value: AT_CLAIM_MIN_VALUE,
        };
    }
}

// "ATC4" — declared locally with FeeAccumulator's opcode, the same way RecordShard declares DepositProtocolFee
// rather than importing it. Importing would drag that contract's code into this one's, and with it the build
// cycle this whole design is shaped to avoid.
message(0x41544334) TicketRedeemAck {
    credits_k: Int as uint32;
}
