// AirdropTicket — one account per publisher, holding that publisher's unredeemed capsule credits.
//
// WHY THIS CONTRACT EXISTS AT ALL, in measured numbers. A delivery ATTACHES ~60,363,936 nanoton (0.060 GRAM), and
// that attach is per DELIVERY, not per credit — the caller pays the same whether the payout carries ONE credit or
// a THOUSAND. But the ATTACH IS NOT THE COST. Measured through the real pool path (tests/airdrop-delivery-cost.test
// .ts, AIRCOST-02): ~39,255,529 of it lands in the RECIPIENT's OWN ATHWallet — the user's own money, funding their
// wallet, NOT a loss — and only ~16,633,315 (0.0166 GRAM) is truly unrecoverable: ~5,001,852 burned as gas and
// ~11,631,463 immured in AirdropPool, which has no TON exit path (no myBalance / nativeReserve / SendRemainingBalance
// / mode-128 in any receiver), so anything over-attached is stuck for the life of the contract.
// [CORRECTED 2026-07-24: the old comment read "60,368,203, none of it comes back" and kept misleading into quoting
// 0.06 GRAM as THE COST. The attach is 0.06; the unrecoverable cost is 0.017. Most of the attach returns to the user.]
//
// This fixed ~16.6M unrecoverable per delivery is why deliveries are BATCHED. Per-capsule delivery across the
// 1.5M-capsule airdrop would immure ~24,900 GRAM against the ~15,000 GRAM those capsules collect in protocol fees;
// batching amortises the fixed cost over many credits WITHOUT touching the owner's frozen arithmetic — the rate
// stays 10 ATH per capsule, 1.5M capsules, 15M ATH, only the delivery granularity moves.
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

// The minimum batch a claim may deliver. 10 credits = 100 ATH — enough to mint an avatar or a username, which is
// the smallest amount worth one delivery. [OWNER 2026-07-24: minimum 10; 100 ATH is exactly what an avatar/username
// needs, and at the MEASURED ~0.017 GRAM unrecoverable per delivery — NOT the 0.06 attach — that cost is acceptable.]
// The floor is kept deliberately low: the delivery cost is borne by the OWNER who claims (it comes out of their
// claim value, most of which returns to their own wallet), so this is not the pool's money to protect — the floor
// only stops a literal dust delivery that would burn ~0.017 GRAM to move a single credit.
const AT_MIN_CLAIM_CREDITS: Int = 10;

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
        // [W1-006 FIX 2026-07-24] Refuse to accumulate a credit for a MASTERCHAIN owner. AirdropPool pays the airdrop
        // to `buyer` and rejects a masterchain buyer at gate 26111 (with no bounced<AirdropAccrue> to restore it), so a
        // masterchain-owned ticket's credits are UNDELIVERABLE — a claim would debit them into a redeem the pool burns.
        // Refusing here, at the source, means such a ticket never accumulates anything, so there is nothing to burn.
        // The fee still reached the pool (this is downstream of that); only the airdrop credit — which could never be
        // paid to a masterchain address anyway — is declined. Gated at the TICKET, not at FeeAccumulator: the ticket's
        // address is not baked as a constant anywhere (FeeAccumulator binds ticket code at runtime), so unlike a gate
        // on FeeAccumulator this shifts no genesis address. Every real publisher is basechain, so the honest path is
        // untouched. `owner` is fixed at mint, so this can never flip on an existing ticket.
        throwUnless(27003, self.isBasechainAddress(self.owner));
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
