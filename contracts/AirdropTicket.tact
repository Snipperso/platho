
const AT_FEE_SINK: Address = address("EQAgWSAucibv2D3SOIhL1wKFwg27wIRkeiObu5uxgOfNpO6E");


const AT_MIN_CLAIM_CREDITS: Int = 10;

const AT_MAX_CREDITS_PER_CLAIM: Int = 1000;

const AT_CLAIM_MIN_VALUE: Int = 63000000;

const AT_INFLIGHT_DEADMAN_GRACE_SECONDS: Int = 604800;

const AT_EXPORT_MIN_VALUE: Int = 20000000;

message(0x41544331) TicketCredit {}

message(0x41544332) TicketClaim {}

message(0x41544335) TicketExportCredits {
    to: Address;
}

message(0x41544336) TicketCreditsMigrated {
    credits_k: Int as uint32;
    owner: Address;
}

message(0x41544333) TicketRedeem {
    credits_k: Int as uint32;
    owner: Address;
}

message(0x41544337) TicketUnjam {}

struct AirdropTicketView {
    owner: Address;
    credits: Int;
    in_flight: Int;
    in_flight_at: Int;
    unjam_grace_seconds: Int;
    min_claim_credits: Int;
    max_credits_per_claim: Int;
    claim_min_value: Int;
}

contract AirdropTicket {
    owner: Address;
    credits: Int as uint32;
    in_flight: Int as uint32;
    in_flight_at: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.credits = 0;
        self.in_flight = 0;
        self.in_flight_at = 0;
    }

    fun isBasechainAddress(a: Address): Bool {
        let s: Slice = a.asSlice();
        return s.loadUint(11) == 1024;
    }

    receive(_: TicketCredit) {
        throwUnless(27001, sender() == AT_FEE_SINK);
        throwUnless(27003, self.isBasechainAddress(self.owner));
        throwUnless(27002, self.credits < 4294967295);
        self.credits += 1;
    }

    receive(_: TicketClaim) {
        throwUnless(27010, sender() == self.owner);
        throwUnless(27011, self.in_flight == 0);
        throwUnless(27012, self.credits >= AT_MIN_CLAIM_CREDITS);
        throwUnless(27013, context().value >= AT_CLAIM_MIN_VALUE);

        let k: Int = self.credits;
        if (k > AT_MAX_CREDITS_PER_CLAIM) {
            k = AT_MAX_CREDITS_PER_CLAIM;
        }
        self.credits -= k;
        self.in_flight = k;
        self.in_flight_at = now();

        message(MessageParameters {
            to: AT_FEE_SINK,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TicketRedeem{ credits_k: k, owner: self.owner }.toCell(),
        });
    }

    bounced(msg: bounced<TicketRedeem>) {
        self.credits += msg.credits_k;
        self.in_flight = 0;
        self.in_flight_at = 0;
    }

    receive(msg: TicketExportCredits) {
        throwUnless(27030, sender() == self.owner);
        throwUnless(27031, self.in_flight == 0);
        throwUnless(27032, self.credits > 0);
        throwUnless(27033, self.isBasechainAddress(msg.to));
        throwUnless(27035, msg.to != myAddress());
        throwUnless(27034, context().value >= AT_EXPORT_MIN_VALUE);

        let k: Int = self.credits;
        self.credits = 0;

        message(MessageParameters {
            to: msg.to,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TicketCreditsMigrated{ credits_k: k, owner: self.owner }.toCell(),
        });
    }

    bounced(msg: bounced<TicketCreditsMigrated>) {
        self.credits += msg.credits_k;
    }

    receive(_: TicketRedeemAck) {
        throwUnless(27020, sender() == AT_FEE_SINK);
        self.in_flight = 0;
        self.in_flight_at = 0;
    }

    receive(_: TicketUnjam) {
        throwUnless(27040, sender() == self.owner);
        throwUnless(27041, self.in_flight > 0);
        throwUnless(27042, now() > self.in_flight_at + AT_INFLIGHT_DEADMAN_GRACE_SECONDS);
        self.in_flight = 0;
        self.in_flight_at = 0;
    }

    receive() {}
    receive(_: Slice) {}

    get fun get_ticket(): AirdropTicketView {
        return AirdropTicketView {
            owner: self.owner,
            credits: self.credits,
            in_flight: self.in_flight,
            in_flight_at: self.in_flight_at,
            unjam_grace_seconds: AT_INFLIGHT_DEADMAN_GRACE_SECONDS,
            min_claim_credits: AT_MIN_CLAIM_CREDITS,
            max_credits_per_claim: AT_MAX_CREDITS_PER_CLAIM,
            claim_min_value: AT_CLAIM_MIN_VALUE,
        };
    }
}

message(0x41544334) TicketRedeemAck {
    credits_k: Int as uint32;
}
