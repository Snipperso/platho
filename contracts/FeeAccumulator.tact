// Platho v1 FeeAccumulator milestone implementation.
// Scope: immutable Treasury/BuybackBurn addresses, permissionless protocol fee deposit,
// bootstrap treasury/liquidity reserve split, exact buyback split after one-way enable,
// treasury due flush, buyback due flush with bounce recovery.
// No override/pause/upgrade/governance/rescue/fallback behavior is implemented.

const SPLIT_BASE_BPS: Int = 10000;
const TREASURY_SHARE_BPS: Int = 5000;
// What a depositor must bring ON TOP of the principal, to fund this contract's own execution.
//
// WAS 2_000_000, AND THAT NUMBER DECIDED AN ARCHITECTURE. It was sized for CapsuleHub, which flushes rarely and
// in large amounts, where 2 TON of slack is noise. The clean-17 shards deposit PER CAPSULE — 1.5M times over the
// airdrop — and at that rate the reserve is not slack, it is 18% of the fee. That is the only reason the shards
// were built to ACCUMULATE the fee and remit it once per shard: the accumulation existed purely to pay this
// constant once instead of a million times. [OWNER 2026-07-19: the fee must not sit in a shard at all — "в шарде
// должна быть только его рента, а моя комиссия это моя комиссия".] Fixing the constant removes the reason.
//
// MEASURED 2026-07-19 against the LIVE mainnet config, not from memory (a recalled "400 nanoton per gas unit"
// nearly caused the correct measurement to be discarded — see below):
//   config-21 basechain: flat_gas_limit 100, flat_gas_price 6667, gas_price 4369067/65536 = 66.667 nanoton/unit
//   one DepositProtocolFee: gasUsed 2986  ->  6667 + 2886 * 66.667 = 199_067 predicted
//   sandbox measurement:                                              199_068 actual
// Agreement to one nanoton, which also proves @ton/sandbox prices gas at the live mainnet rate.
//
// SIZED HIGH, WITH THE SURPLUS MADE RECOVERABLE. I first reasoned the opposite — err low, because a shortfall
// only drains this contract gradually while a surplus strands forever — and the owner corrected the premise:
//   [OWNER 2026-07-19] "Если мы ошибаемся вниз, то пользователь просто меньше платит за сообщение, а потом мне
//   из своего кармана надо оплачивать ошибку? Если так, то пусть лучше пользователь платит с запасом."
// That is right, and my version had the payer wrong. The publisher's cost is the deposit message's value, so a
// smaller reserve means the USER pays less while accumulated_ton is still credited in full — the shortfall
// lands on the owner at flush time. Erring low spends the owner's money to save the user a rounding error.
//
// So: 400_000 against a measured 199_068 (2x margin against any plausible gas repricing), and SweepUnaccounted
// below makes the leftover recoverable instead of immured. The asymmetry that made a thin margin look prudent
// is gone once the surplus has an exit.
const FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE: Int = 400000;

// A last-resort cushion the sweep never touches. Deliberate funding is now COUNTED (storage_reserve_ton) rather
// than defended by a guessed floor, so this is not the storage budget — it only guarantees the contract can still
// execute its own next transaction if genesis ever under-funded it. Kept small deliberately: an oversized floor
// silently makes small surpluses unsweepable, which is how the first attempt at this failed its own test.
const FEEACCUMULATOR_STORAGE_FLOOR: Int = 1000000;
const FEEACCUMULATOR_SPLIT_EXEC_RESERVE: Int = 2000000;
const FEEACCUMULATOR_FLUSH_EXEC_RESERVE: Int = 5000000;
const FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON: Int = FEEACCUMULATOR_FLUSH_EXEC_RESERVE;
const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE: Int = 2000000;
// M19H BuybackBurn funding envelope: exact 50 TON offer + 1.05 TON route funding.
// FeeAccumulator must only flush complete buyback execution envelopes, not raw 50 TON offer chunks.
const BUYBACK_FUNDING_ENVELOPE_NANOTONS: Int = 51050000000;

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

message(0x7B24EA03) SplitAccumulated {}

message(0x8D8F2C18) EnableBuybackSplit {}

message(0xDDAB4641) FlushTreasuryDue {
    amount: Int as uint128;
}

message(0xB3D2C52D) FlushBuybackDue {
    amount: Int as uint128;
}

message(0x87A2D2C7) TopUpStorageReserve {}

message(0x5357554E) SweepUnaccounted {}   // "SWUN"

// Message body sent to BuybackBurn. Opcode matches Platho.V1.BuybackBurn.AcceptBurnReserve.
// Field order is intentional so bounced<AcceptBurnReserve> can recover amount.
message(0x594BA505) AcceptBurnReserve {
    amount: Int as uint128;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AIRDROP ACCRUAL — this contract is the hub, because it is already the one place every published capsule
// touches exactly once.
//
// The problem it solves: AirdropPool must pay 10 ATH per published capsule, but nothing could authenticate a
// publish. AirdropPool cannot derive a shard address, because doing so would put shard code inside its own
// code, and shard code embeds THIS contract's address — a build cycle. FeeAccumulator escapes it by BINDING
// the shard code cell at genesis as runtime data instead of compiling it in: this contract's address is fixed
// before the shard is built, the shard names it as a constant, and the derivation still works.
//
// Build order, and it is not optional:
//   FeeAccumulator -> its address -> RecordShard.RS_FEE_SINK and AirdropTicket.AT_FEE_SINK -> their code cells
//   -> bound back into FeeAccumulator at genesis, before the seal.
// WHAT RECEIVING A CAPSULE FEE ACTUALLY COSTS. MEASURED 2026-07-20 against the live mainnet gas config, by
// running the same publish with the ticket code bound and unbound, and reading the sink's balance delta rather
// than summing fee fields:
//     deposit alone (gate 15055's address derivation + booking)   9,542 gas =   636,134
//     deposit + the ticket credit leg                            15,302 gas = 1,020,134
//       + action fees 161,797 + forwarding 323,604 + the 600,000 the credit carries
//     => the sink spends 2,105,535 per capsule, of which 1,469,401 is the credit
//
// The first figure alone already exceeded the 400,000 this was sized from before the derivation existed: proving
// a sender IS a shard is real work, and 199,068 was the cost of the OLD permissionless deposit that did no such
// proof. Carrying that number forward is what made the airdrop credit look nearly free.
//
// Sized at 2,600,000 — 23% above measurement, and deliberately generous rather than tight, because the asymmetry
// is total: surplus returns to the owner through SweepUnaccounted (PT-09), while a shortfall is paid silently
// out of the sink's storage float on every one of 1.5M capsules. PT-04c measures the margin end to end and fails
// if it ever goes negative again.
const FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE: Int = 2600000;   // deposit exec + the ticket credit leg
// What a TicketCredit carries. The ticket's own execution measured 189,001, so this is ~3x covered — and the
// margin is not waste: the ticket holds it and returns it with SendRemainingValue when the credits are claimed,
// where it goes straight into funding the airdrop delivery. Under-sizing it, by contrast, would make the credit
// fail in the ticket's COMPUTE phase, and the credit is sent bounce:false — a lost airdrop, silently.
const FEEACCUMULATOR_TICKET_CREDIT_VALUE: Int = 600000;         // what a TicketCredit carries
const FEEACCUMULATOR_ACCRUE_LEG_VALUE: Int = 60000000;          // AirdropPool gate 26114 demands exactly this
const FEEACCUMULATOR_REDEEM_EXEC_RESERVE: Int = 2000000;

// The shard's fee deposit, carrying what the pool needs and the shard alone can prove: its own identity
// (write_pubkey, epoch — stamped from the shard's state, never from a message body) and the publisher it
// took the value from (sender(), stamped by the VM).
// CAUGHT 2026-07-20, before it shipped: the first version of this named the fields (write_pubkey, epoch) and
// derived every shard with RecordShard's layout. IntroShard's init is (epoch, bucket) — DIFFERENT ARGUMENTS in
// a DIFFERENT order — so that derivation would have compiled, typechecked, and quietly authenticated the wrong
// address for the entire INTRO lane. Both lanes happen to take exactly two Int init args, so the honest form is
// to carry them POSITIONALLY and let `lane` choose which bound code they belong to. Naming them write_pubkey
// and epoch was the bug: it made a CONV-shaped assumption look like a fact.
//   lane 0 = CONV  -> RecordShard.init(write_pubkey, epoch)
//   lane 1 = INTRO -> IntroShard.init(epoch, bucket)
message(0x52535046) DepositCapsuleFee {
    amount: Int as uint128;
    lane: Int as uint8;
    init_arg0: Int as int257;
    init_arg1: Int as int257;
    publisher: Address;
}

message(0x41544331) TicketCredit {}

// Mirrors AirdropTicket.TicketRedeem. credits_k FIRST so a bounce (first 224 bits only) can restore it.
message(0x41544333) TicketRedeem {
    credits_k: Int as uint32;
    owner: Address;
}

message(0x41544334) TicketRedeemAck {
    credits_k: Int as uint32;
}

// Mirrors AirdropPool.AirdropAccrue — declared locally with its opcode rather than imported, the same way
// RecordShard declares DepositProtocolFee. Importing would drag AirdropPool's code in and rebuild the cycle.
// Mirrors AIRDROP_MAX_CREDITS_PER_ACCRUAL in AirdropPool.tact and AT_MAX_CREDITS_PER_CLAIM in AirdropTicket.tact.
// Three copies of one number across three immutable contracts is exactly the shape that has already drifted once in
// this codebase, so it is named here rather than written as a literal, and ACCRUE-WIRE pins the three together.
const AIRDROP_MAX_CREDITS_PER_ACCRUAL_MIRROR: Int = 1000;
// A year with no inbound value at all on the buyback lane before its unspendable remainder may be reclassified.
const FEEACCUMULATOR_BUYBACK_REMAINDER_INACTIVITY: Int = 31536000;

message(0x41445214) ReclassifyStuckBuybackRemainder {}

message(0x41445210) AirdropAccrue {
    purchase_id: Int as uint64;
    buyer: Address;
    credits_k: Int as uint32;
}

// Genesis binds. Authority is the treasury receiver — an immutable init parameter, the same authority
// EnableBuybackSplit already uses (15012). Each is one-shot, so nothing here can be repointed later.
message(0xFA110001) BindShardCode { shard_code: Cell }
message(0xFA110002) BindTicketCode { ticket_code: Cell }
message(0xFA110004) BindIntroShardCode { intro_shard_code: Cell }
message(0xFA110003) BindAirdropPool { airdrop_pool_address: Address }
message(0xFA110005) BindPublicShardCode { public_shard_code: Cell }   // lane 2, added 2026-07-21 with PublicShard

struct FeeAccumulatorStateView {
    accumulated_ton: Int;
    treasury_due_ton: Int;
    buyback_due_ton: Int;
    buyback_split_enabled: Bool;
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    storage_reserve_ton: Int;   // deliberate top-ups, tracked so SweepUnaccounted cannot mistake them for surplus
    // APPENDED, never inserted: a positional decoder reads this struct by slot, so a field added anywhere but the end
    // silently hands every later reader the wrong value.
    buyback_due_last_increase_at: Int;
    failed_accrual_count: Int;
    last_failed_accrual_purchase_id: Int;
}

contract FeeAccumulator {
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    accumulated_ton: Int as uint128;
    treasury_due_ton: Int as uint128;
    buyback_due_ton: Int as uint128;
    buyback_split_enabled: Bool;
    storage_reserve_ton: Int as coins;
    buyback_due_last_increase_at: Int as uint64;
    failed_accrual_count: Int as uint32;
    last_failed_accrual_purchase_id: Int as uint64;
    // Airdrop accrual wiring, all bound at genesis. Nullable rather than flagged: an unbound code cell is
    // exactly the "accrual is off" state, and the deposit path below simply skips crediting — so a genesis
    // that never binds them yields a working fee accumulator with no airdrop, not a broken one.
    shard_code: Cell?;
    intro_shard_code: Cell?;
    ticket_code: Cell?;
    airdrop_pool_address: Address?;
    // lane 2, the PUBLIC lane. Same nullable-is-off treatment as the CONV/INTRO codes above; a genesis that never
    // binds it yields a fee accumulator that simply refuses public deposits at gate 15055, not a broken one.
    public_shard_code: Cell?;
    accrual_seq: Int as uint64;

    init(treasury_receiver_address: Address, buyback_burn_address: Address) {
        self.shard_code = null;
        self.intro_shard_code = null;
        self.ticket_code = null;
        self.airdrop_pool_address = null;
        self.public_shard_code = null;
        self.accrual_seq = 0;
        self.treasury_receiver_address = treasury_receiver_address;
        self.buyback_burn_address = buyback_burn_address;
        self.accumulated_ton = 0;
        self.treasury_due_ton = 0;
        self.buyback_due_ton = 0;
        self.buyback_split_enabled = false;
        self.storage_reserve_ton = 0;
        self.buyback_due_last_increase_at = 0;
        self.failed_accrual_count = 0;
        self.last_failed_accrual_purchase_id = 0;
    }

    receive(msg: DepositProtocolFee) {
        // Deposits are permissionless: any sender may donate protocol-fee principal.
        // Only the declared amount is credited; surplus is execution/storage reserve.
        throwUnless(15001, msg.amount > 0);
        // The declared protocol fee amount is the accounted principal.
        // Execution must be caller-funded so principal buckets remain backed after gas/fees.
        throwUnless(15002, context().value >= msg.amount + FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE);

        self.accumulated_ton += msg.amount;
    }

    fun requireTreasury() {
        throwUnless(15050, sender() == self.treasury_receiver_address);
    }

    receive(msg: BindShardCode) {
        self.requireTreasury();
        throwUnless(15051, self.shard_code == null);
        self.shard_code = msg.shard_code;
    }

    receive(msg: BindIntroShardCode) {
        self.requireTreasury();
        throwUnless(15057, self.intro_shard_code == null);
        self.intro_shard_code = msg.intro_shard_code;
    }

    receive(msg: BindTicketCode) {
        self.requireTreasury();
        throwUnless(15052, self.ticket_code == null);
        self.ticket_code = msg.ticket_code;
    }

    receive(msg: BindAirdropPool) {
        self.requireTreasury();
        throwUnless(15053, self.airdrop_pool_address == null);
        self.airdrop_pool_address = msg.airdrop_pool_address;
    }

    receive(msg: BindPublicShardCode) {
        self.requireTreasury();
        throwUnless(15059, self.public_shard_code == null);
        self.public_shard_code = msg.public_shard_code;
    }

    // The address a contract occupies IS the hash of its code and data, so rebuilding that hash and comparing
    // it to sender() proves the sender runs exactly the bound bytecode. Only init ARGUMENTS enter the data
    // cell, behind a one-bit lazy-init flag — pinned against the real builder output by
    // tests/shard-address-derivation.test.ts, so a compiler change cannot silently turn this into a check that
    // passes for everyone.
    fun deriveFromBoundCode(code: Cell, data: Cell): Address {
        return contractAddressExt(0, code, data);
    }

    // One derivation for ALL THREE lanes, because every shard takes exactly two Int init args — the difference is
    // only WHICH code cell they belong to, never the layout. Positional on purpose: see DepositCapsuleFee.
    // PublicShard's init is deliberately (partition_key: Int, epoch_tag: Int) — two int257 — so this same builder
    // reproduces its address (contracts/PublicShard.tact, the note on its state fields explains why).
    fun laneShardAddress(lane: Int, arg0: Int, arg1: Int): Address {
        let code: Cell = lane == 0 ? self.shard_code!! : (lane == 1 ? self.intro_shard_code!! : self.public_shard_code!!);
        return self.deriveFromBoundCode(code, beginCell()
            .storeUint(0, 1)
            .storeInt(arg0, 257)
            .storeInt(arg1, 257)
            .endCell());
    }

    fun laneCodeBound(lane: Int): Bool {
        return lane == 0 ? self.shard_code != null : (lane == 1 ? self.intro_shard_code != null : self.public_shard_code != null);
    }

    fun ticketAddress(owner: Address): Address {
        return self.deriveFromBoundCode(self.ticket_code!!, beginCell()
            .storeUint(0, 1)
            .storeAddress(owner)
            .endCell());
    }

    // THE ACCRUAL ENTRY POINT. Unlike DepositProtocolFee below, this one is NOT permissionless: it credits an
    // airdrop, so an open door here would mint 10 ATH per call to anyone. 15055 is what closes it.
    receive(msg: DepositCapsuleFee) {
        throwUnless(15054, msg.amount > 0);
        throwUnless(15058, msg.lane >= 0 && msg.lane <= 2);
        throwUnless(15055, self.laneCodeBound(msg.lane)
            && sender() == self.laneShardAddress(msg.lane, msg.init_arg0, msg.init_arg1));
        throwUnless(15056, context().value >= msg.amount + FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE);

        // The fee is accounted exactly as a plain deposit — the airdrop changes who gets credited, never how
        // much reaches the pool. The owner's arithmetic (1.5M capsules x 0.01 GRAM = 15,000 GRAM) depends on
        // this line staying whole.
        self.accumulated_ton += msg.amount;

        if (self.ticket_code != null) {
            // StateInit is attached on EVERY credit, not just the first. A ticket that does not exist yet
            // would otherwise swallow its credit and silently cost the publisher their airdrop; attaching it
            // to an already-deployed account is simply ignored by the network.
            //
            // MEASURED 2026-07-20 (tests/fee-accumulator-accrual.test.ts), by building this send BOTH ways:
            //     with StateInit     1,295,132 per credit
            //     without StateInit    949,489
            //     => the redundant StateInit costs 345,643 = 3.46% of the 10,000,000 fee
            // A design review had estimated ~1,000,000 (10%) and concluded onboarding must pre-deploy tickets
            // to avoid it. The real figure is 3x smaller, and it buys the guarantee that no publisher can ever
            // lose a credit to a ticket that did not exist yet. Removing the two lines below fails FAACC-01
            // and FAACC-03 — the credits go nowhere.
            let data: Cell = beginCell().storeUint(0, 1).storeAddress(msg.publisher).endCell();
            send(SendParameters {
                to: self.ticketAddress(msg.publisher),
                value: FEEACCUMULATOR_TICKET_CREDIT_VALUE,
                mode: SendPayGasSeparately,
                bounce: false,
                code: self.ticket_code!!,
                data: data,
                body: TicketCredit{}.toCell(),
            });
        }
    }

    // A ticket asks for its accumulated credits to be delivered. Authenticated the same structural way: the
    // ticket's address commits to its owner, so a redeem naming someone else's owner cannot come from an
    // address that derives to it.
    receive(msg: TicketRedeem) {
        throwUnless(15060, self.ticket_code != null && self.airdrop_pool_address != null);
        throwUnless(15061, sender() == self.ticketAddress(msg.owner));
        // [ADDED 2026-07-29, wave-8 HIGH] The upper bound is AirdropPool's (gate 26112) and it is mirrored here so a
        // redeem that the pool would refuse fails in COMPUTE and BOUNCES — restoring the ticket's credits through
        // machinery that already exists — instead of being forwarded and then silently swallowed by the missing
        // bounce path. AirdropTicket already caps k, so this is unreachable today; a gate whose correctness depends
        // on a different immutable contract keeping a promise is the kind that stops holding after one edit.
        throwUnless(15062, msg.credits_k > 0 && msg.credits_k <= AIRDROP_MAX_CREDITS_PER_ACCRUAL_MIRROR);
        // Fail-closed in COMPUTE so an underfunded redeem BOUNCES and the ticket restores the credits, rather
        // than failing in ACTION where the credits would simply be gone.
        throwUnless(15063, context().value >= FEEACCUMULATOR_ACCRUE_LEG_VALUE + FEEACCUMULATOR_REDEEM_EXEC_RESERVE);

        self.accrual_seq += 1;
        message(MessageParameters {
            to: self.airdrop_pool_address!!,
            value: FEEACCUMULATOR_ACCRUE_LEG_VALUE,
            mode: SendPayGasSeparately,
            bounce: true,
            body: AirdropAccrue{ purchase_id: self.accrual_seq, buyer: msg.owner, credits_k: msg.credits_k }.toCell(),
        });
        message(MessageParameters {
            to: sender(),
            // [FIX 2026-07-24, token-cluster audit CRIT] Was `value: 0, mode: SendRemainingValue` (mode 64). Mode 64
            // carries the FULL inbound value and does NOT subtract the explicit ACCRUE_LEG sent above in the SAME
            // transaction, so total out = inbound + 60M and the sink paid the 60M accrue leg out of its OWN balance —
            // ~60M PER redeem, UNCOUNTED (this handler never debits accumulated_ton/treasury_due/buyback_due), silently
            // eroding the backing invariant (balance >= accumulated + treasury_due + buyback_due) until FlushTreasuryDue/
            // FlushBuybackDue become unbackable = permanent loss on this immutable, effectively-unmigratable contract.
            // Now the change is EXPLICIT — inbound minus the accrue leg minus the redeem exec reserve — so total out =
            // inbound - EXEC_RESERVE <= inbound, the claimant funds the 60M leg as gate 15063 intends, and the sink keeps
            // EXEC_RESERVE to pay its own gas. Gate 15063 guarantees context().value >= ACCRUE_LEG + EXEC_RESERVE above,
            // so this subtraction can never go negative. Regression: tests/fee-accumulator-accrual.test.ts FAACC-BACKING.
            value: context().value - FEEACCUMULATOR_ACCRUE_LEG_VALUE - FEEACCUMULATOR_REDEEM_EXEC_RESERVE,
            mode: SendPayGasSeparately,
            bounce: false,
            body: TicketRedeemAck{ credits_k: msg.credits_k }.toCell(),
        });
    }

    receive(msg: SplitAccumulated) {
        throwUnless(15010, self.accumulated_ton > 0);
        throwUnless(15011, context().value >= FEEACCUMULATOR_SPLIT_EXEC_RESERVE);

        let amount: Int = self.accumulated_ton;
        if (!self.buyback_split_enabled) {
            self.accumulated_ton = 0;
            self.treasury_due_ton += amount;
            return;
        }

        let treasury_amount: Int = (amount * TREASURY_SHARE_BPS) / SPLIT_BASE_BPS;
        let buyback_amount: Int = amount - treasury_amount;

        self.accumulated_ton = 0;
        self.treasury_due_ton += treasury_amount;
        self.buyback_due_ton += buyback_amount;
        self.buyback_due_last_increase_at = now();
    }

    receive(msg: EnableBuybackSplit) {
        throwUnless(15012, sender() == self.treasury_receiver_address);
        throwUnless(15013, !self.buyback_split_enabled);
        throwUnless(15014, context().value >= FEEACCUMULATOR_SPLIT_EXEC_RESERVE);

        if (self.accumulated_ton > 0) {
            self.treasury_due_ton += self.accumulated_ton;
            self.accumulated_ton = 0;
        }
        self.buyback_split_enabled = true;
    }

    receive(msg: FlushTreasuryDue) {
        throwUnless(15020, msg.amount > 0);
        throwUnless(15021, msg.amount <= self.treasury_due_ton);
        throwUnless(15023, msg.amount >= FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON || msg.amount == self.treasury_due_ton);
        throwUnless(15022, context().value >= FEEACCUMULATOR_FLUSH_EXEC_RESERVE);

        self.treasury_due_ton -= msg.amount;

        message(MessageParameters {
            to: self.treasury_receiver_address,
            value: msg.amount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });

        // [ADDED 2026-07-30, tier-3 audit] Give the caller's own value back, so it cannot fund the leg above.
        //
        // 15022 only ever required the caller to SEND FEEACCUMULATOR_FLUSH_EXEC_RESERVE while 15023 allowed flushing
        // exactly FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON — the same figure. At that ratio the inbound value covered the
        // outbound leg one for one: the treasury got its 5,000,000, treasury_due_ton fell by 5,000,000, and this
        // contract's own nanotons never moved. Repeat until the due reaches zero and 15021 forbids every further
        // flush. The identical shape was found in MarketStabilitySeller and fixed there first; this lane was not
        // looked at in the same pass, which is why it is here now.
        //
        // Less severe HERE, and the difference is worth naming rather than glossing: SweepUnaccounted reclassifies the
        // stranded proceeds (held stays, accounted drops, so the surplus is real) and SplitAccumulated returns them to
        // treasury_due — so this was recoverable, permissionlessly, by anyone who noticed. Returning the change makes
        // the subsidy inexpressible instead of merely repairable, and makes the two flush lanes read the same way.
        // Return everything ABOVE the execution reserve, and keep the reserve itself. Returning the WHOLE inbound
        // was my first version and it was wrong in the other direction: the contract then paid its own gas out of the
        // backing, ~66,667 a flush, which is the same "shortfall paid silently out of the float" this file warns
        // about elsewhere. Gate 15022 demands the reserve precisely so execution is CALLER-funded; keeping exactly
        // that and returning the rest makes the subsidy inexpressible AND leaves the backing untouched. Caught by
        // FEE-BACKING-02, which measures the balance delta rather than trusting either version.
        let flushChange: Int = context().value - FEEACCUMULATOR_FLUSH_EXEC_RESERVE;
        if (flushChange > 0) {
            message(MessageParameters {
                to: sender(),
                value: flushChange,
                bounce: false,
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
                body: null
            });
        }
    }

    receive(msg: FlushBuybackDue) {
        throwUnless(15030, msg.amount > 0);
        // M19H: one future BuybackBurn execution must be funded as a complete envelope.
        // 50 TON is only the STON.fi offer principal; 1.05 TON route funding is part of the protocol-owned envelope.
        throwUnless(15034, msg.amount == BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        throwUnless(15031, msg.amount <= self.buyback_due_ton);
        throwUnless(15035, context().value >= FEEACCUMULATOR_FLUSH_EXEC_RESERVE + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE);

        self.buyback_due_ton -= msg.amount;

        message(MessageParameters {
            to: self.buyback_burn_address,
            value: msg.amount + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: AcceptBurnReserve { amount: msg.amount }.toCell()
        });

        // Same shape as the treasury leg, with one difference that matters: here BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE
        // rides OUT with the envelope, and gate 15035 makes the caller fund it deliberately. So both that and the
        // execution reserve stay; only what the caller sent beyond them comes back.
        let buybackChange: Int = context().value - FEEACCUMULATOR_FLUSH_EXEC_RESERVE - BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE;
        if (buybackChange > 0) {
            message(MessageParameters {
                to: sender(),
                value: buybackChange,
                bounce: false,
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
                body: null
            });
        }
    }

    bounced(msg: bounced<AcceptBurnReserve>) {
        throwUnless(15032, sender() == self.buyback_burn_address);
        throwUnless(15033, msg.amount > 0);
        self.buyback_due_ton += msg.amount;
        self.buyback_due_last_increase_at = now();
    }

    // [ADDED 2026-07-29, wave-8 MED] The only way a buyback remainder can ever leave this contract.
    //
    // Gate 15034 demands msg.amount == BUYBACK_FUNDING_ENVELOPE_NANOTONS EXACTLY, and it has to: BuybackBurn's own
    // gate 22202 demands the same, because 51.05 GRAM is one complete execution envelope and half an envelope buys
    // nothing. So any buyback_due below that figure is unspendable — and there was no way back either. SplitAccumulated
    // only moves value INTO the bucket, and SweepUnaccounted counts buyback_due as accounted and by construction
    // cannot touch it. The symmetric treasury leg has a remainder escape at 15023; this lane simply lacked one.
    //
    // The naive fix — allow a partial flush — is wrong twice over: BuybackBurn refuses it, and even if it did not,
    // anyone could drain the buyback allocation into the treasury by calling this after every split that happens to
    // land short. So this is a DEAD-MAN, not a valve: the clock is stamped on every increase, and the remainder only
    // becomes reclassifiable after a full year in which the lane received nothing at all. Ordinary operation re-arms
    // it constantly and can never reach it. Permissionless for the usual reason — the destination is the genesis-bound
    // treasury bucket and no caller can point it anywhere.
    receive(_: ReclassifyStuckBuybackRemainder) {
        throwUnless(15070, self.buyback_due_ton > 0);
        throwUnless(15071, self.buyback_due_ton < BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        throwUnless(15072, now() > self.buyback_due_last_increase_at + FEEACCUMULATOR_BUYBACK_REMAINDER_INACTIVITY);
        self.treasury_due_ton += self.buyback_due_ton;
        self.buyback_due_ton = 0;
    }

    // [ADDED 2026-07-29, wave-8 HIGH] AirdropAccrue is sent bounce:true and had NO bounced handler, so the generated
    // router took the unmatched-bounce path and did `return ()` — a refusal at the pool was accepted here as success.
    // TicketRedeemAck goes out in the SAME transaction, unconditionally, so by then the ticket has already debited the
    // publisher's credits and cleared its in-flight interlock; bounced<TicketRedeem> can no longer fire because the
    // redeem itself succeeded. The credits were destroyed WITH NO TRACE ANYWHERE, which is the part that mattered.
    //
    // What this can and cannot do. It cannot restore them: only the first 224 bits of a bounced body survive, which
    // covers the opcode and purchase_id (96 bits) but not `buyer`, an Address at 267 bits — and there is no map from
    // purchase_id to buyer to look it up in, deliberately, because an unbounded one is its own defect. What it does is
    // make the condition OBSERVABLE and countable instead of invisible, and that is worth the two fields.
    //
    // Reachability, measured rather than assumed: of the pool's refusals, 26111/26114 and exhaustion are impossible,
    // and 26112 (credits_k > 1000) is unreachable because AirdropTicket caps k at AT_MAX_CREDITS_PER_CLAIM before
    // sending — gate 15062 below now mirrors that cap anyway, so this contract stops trusting a distant one's
    // discipline. That leaves 26110, the ADR9 distributor rebind, whose ordering obligation — export every ticket's
    // credits BEFORE rebinding — is recorded in AirdropPool.tact and AirdropTicket.tact and enforced by nothing on
    // chain. If this counter is ever non-zero, that obligation was missed and the amount is knowable off-chain.
    bounced(msg: bounced<AirdropAccrue>) {
        self.failed_accrual_count += 1;
        self.last_failed_accrual_purchase_id = msg.purchase_id;
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for FeeAccumulator storage reserve only. Due buckets and receivers are unchanged.
        // COUNTED, because SweepUnaccounted must be able to tell a deliberate top-up from deposit surplus.
        // Leaving it untracked reproduced a defect this project has already made twice: a balance-derived
        // sweep that cannot see intent carries off money somebody meant to leave behind. Caught here by
        // tests/shard-fee-passthrough.test.ts PT-09, where the sweep ate the fixture's own 1 GRAM of funding.
        // It never decreases as rent consumes it, so the figure only ever over-protects — the sweep
        // under-credits rather than over-credits, which is the safe direction.
        self.storage_reserve_ton += context().value;
    }

    // RECLAIM THE UNACCOUNTED BALANCE. Every deposit arrives carrying FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE on top
    // of its principal, and only the principal is booked; the difference between that reserve and the gas
    // actually burnt settles here as raw balance. Before this receiver existed there was no path out of it at
    // all — FlushTreasuryDue can only send what SplitAccumulated moved into treasury_due_ton, which only ever
    // comes from a declared deposit amount. Across the airdrop's 1.5M capsules that would have immured a few
    // hundred GRAM of the owner's own money.
    // [OWNER 2026-07-19, on the surplus: "разве нельзя вывести и излишки, если они будут?"] Now it can: this
    // credits it to accumulated_ton, from which it splits and flushes like any other protocol fee.
    //
    // PERMISSIONLESS ON PURPOSE, and safe because it cannot move value ANYWHERE. It only relabels balance this
    // contract already holds from "unaccounted" to "accumulated" — both of which are the owner's. A caller can
    // only pay gas to do the owner a favour. It also cannot over-credit: the floor is subtracted first and the
    // gate refuses unless there is a genuine surplus above every accounted bucket, so an under-funded contract
    // (the case where deposits cost more gas than their reserve) simply refuses instead of inventing money.
    receive(msg: SweepUnaccounted) {
        let held: Int = myBalance() - context().value;
        let accounted: Int = self.accumulated_ton + self.treasury_due_ton + self.buyback_due_ton
            + self.storage_reserve_ton;
        throwUnless(15040, held > accounted + FEEACCUMULATOR_STORAGE_FLOOR);
        self.accumulated_ton += held - accounted - FEEACCUMULATOR_STORAGE_FLOOR;

        // RETURN THE CALLER'S CHANGE, which also makes the operation IDEMPOTENT. Without this the caller's own
        // attached value stays behind as fresh unaccounted balance, so the very next sweep finds a "surplus"
        // that is really just the previous caller's gas money — the call would never settle, and repeating it
        // would quietly convert callers' funds into the owner's bucket. Reserving exactly what the contract
        // already held before this message means mode-128 hands back the attached value less gas.
        nativeReserve(held, ReserveAtMost);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    get fun get_state(): FeeAccumulatorStateView {
        return FeeAccumulatorStateView {
            accumulated_ton: self.accumulated_ton,
            treasury_due_ton: self.treasury_due_ton,
            buyback_due_ton: self.buyback_due_ton,
            buyback_split_enabled: self.buyback_split_enabled,
            treasury_receiver_address: self.treasury_receiver_address,
            buyback_burn_address: self.buyback_burn_address,
            storage_reserve_ton: self.storage_reserve_ton,
            buyback_due_last_increase_at: self.buyback_due_last_increase_at,
            failed_accrual_count: self.failed_accrual_count,
            last_failed_accrual_purchase_id: self.last_failed_accrual_purchase_id
        };
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(15099);
    }
}
