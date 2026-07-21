// AirdropPool — clean-16 Durable-Core (6th frozen contract).
//
// Holds the 15M ATH airdrop budget in its OWN ATHWallet and pays it out as ATH accrues to credit buyers.
// Design: artifacts/PLATHO_CLEAN16_AIRDROP_POOL_DESIGN.md, with the owner's later decision overriding §0:
// the trigger is CREDIT PURCHASE, not a username claim ("да, хорошая идея перевести эйрдроп на покупку
// кредитов, одобряю. Но математику оставляем прежней").
//
// THE OWNER'S MATH, UNCHANGED: 1.5M credits x 10 ATH = 15M ATH distributed; 1.5M x 10_995_000 nanoTON of credit
// price collects ~16.5k TON of protocol fee -> the DeFi pool. One capsule = one credit = 10 ATH on every lane.
//
// ── WHY THE ACK, AND NOT THE PURCHASE ──────────────────────────────────────────────────────────────────────
// The design doc rated this trigger FATAL, and it was right about the version it examined: accruing inside
// CreditBuyCredits pays ATH BEFORE the purchase settles. An attacker buys with an out-of-window epoch, collects
// the ATH, and CreditIssuer's own bounce path (13617 -> CreditPurchaseRefund) hands their TON back in full —
// free ATH, looped until the 15M is gone. That defeats the only premise the whole scheme rests on.
//
// So the trigger here is FundAnonPoolAck, not the purchase. The Hub emits that ack only after the funding has
// LANDED in its pool; a bounced FundAnonPool produces no ack, so it produces no ATH. The refund path and the
// accrual path are mutually exclusive by construction rather than by ordering luck. CreditIssuer already knows
// the exact payer for a purchase_id (pending_purchases, added for the AAA+ refund), so no new trust is needed:
// this contract authenticates ONE sender and inherits the settlement proof.
//
// NOT here: custody (no user balances), no per-claim nullifier map (each purchase is a distinct settled event —
// the ack cannot be replayed because CreditIssuer clears the pending purchase when it fires). State is therefore
// O(1) in the number of claims, which matters: see [[capsulehub-account-state-cell-ceiling]] — a per-claim map
// would have put this contract on the same 65536-cell collision course as the Hub.

const AIRDROP_TOTAL_POOL: Int = 15000000000000000;      // 15M ATH at 9 decimals — the frozen budget
const AIRDROP_ATH_PER_CREDIT: Int = 10000000000;        // 10 ATH per credit (owner's fixed math)
const AIRDROP_MAX_CREDITS_PER_ACCRUAL: Int = 1000;      // mirrors CREDIT_MAX_CREDITS_PER_BUY — bounds one payout
const AIRDROP_BASE_STORAGE_ENDOWMENT: Int = 100000000;  // #19 singleton base code-rent (mirrors CreditIssuer)
// [G8 MEASURED 2026-07-17] The value the ATHWallet payout leg is sent with, and the minimum incoming value that
// makes emitting it safe. These are MEASURED, and the first cut of them was wrong in the nastiest possible way:
// the payout used nativeReserve(base, ReserveAtMost|ReserveAddOriginalBalance) + SendRemainingBalance, which
// reserves original_balance + base and therefore forwards (incoming - base). At incoming = 65M that is negative,
// so the ACTION phase failed while compute.exit stayed 0 — no accrual, no bounce, no trace. Exactly the silent
// class this codebase exists to hunt (see the SAFE-CAP block in CapsuleHub.tact). Measured wall: 100M fails,
// 110M succeeds.
// The shape below cannot fail that way: a FIXED leg value, and a COMPUTE-phase gate that refuses (and therefore
// bounces) anything that could not pay for it.
const AIRDROP_ATHWALLET_LEG_GAS: Int = 50000000;        // value forwarded to the pool's ATHWallet for one payout
const AIRDROP_PAYOUT_PATH_GAS: Int = 60000000;          // min incoming: leg + this contract's exec + fwd + margin
const AIRDROP_SWEEP_GRACE: Int = 315360000;             // 10 years dead-man before residual may sweep to treasury

message(0x41445201) AirdropBindAthMaster {              // "ADR1" — genesis (controller, unsealed, one-shot)
    ath_master_address: Address;
    pool_ath_wallet_address: Address;
}

message(0x41445202) AirdropBindCreditIssuer {           // "ADR2" — the SOLE authenticator of accruals
    credit_issuer_address: Address;
}

// "ADR9" — POST-SEAL rebind of the distributor. [OWNER APPROVED 2026-07-18.]
// This is the migration hook the whole clean-17 round exists for, and the reason it is needed is concrete: the
// airdrop allocation used to live inside Vault, so abandoning Vault stranded it with no way out. AirdropPool was
// split off precisely so a redeploy could not destroy the token allocation again — but that is only half the
// problem. The coins survive a redeploy; the MECHANISM that hands them out does not, because the distributor is a
// contract that gets redeployed with everything else. Bound one-shot and unsealed-only, the pool would sit after
// the next redeploy holding 15M ATH it could never distribute.
//
// A contract is IMMUTABLE after seal, so this hook cannot be added later. Its scope is deliberately the narrowest
// thing that solves the problem: it repoints the distributor and NOTHING else. It cannot move coins, cannot change
// the accrual rate, cannot touch the treasury or the ATH master. The worst a compromised controller achieves is
// directing future accruals to a distributor of its choosing — which is bad, and is strictly less bad than the
// alternative of the allocation being unreachable forever.
message(0x41445239) AirdropRebindCreditIssuer {
    deployment_manifest_hash: Int as uint256;
    credit_issuer_address: Address;
}

message(0x41445203) AirdropBindTreasury {               // "ADR3" — frozen residual sink
    treasury_address: Address;
}

message(0x41445204) AirdropSealGenesis {
    deployment_manifest_hash: Int as uint256;
}

// Sent by the bound distributor when a claim is redeemed. In clean-17 that is FeeAccumulator (TicketRedeem ->
// AirdropAccrue); it was CreditIssuer under the deleted anonymous-payment layer.
//
// [WIDTH FIXED 2026-07-21, MEASURED] credits_k was uint64 here and uint32 in FeeAccumulator's local mirror of
// this same opcode. Since credits_k is the LAST field, the sender wrote 32 bits and this receiver tried to load
// 64: every accrual died in COMPUTE with exit 9 (cell underflow), MEASURED in
// tests/airdrop-accrue-wire.test.ts. The loss is silent — AirdropTicket debits the credits and FeeAccumulator
// acks the redeem BEFORE this contract ever runs, so the publisher's credits are consumed, the ticket reports
// success, and the ATH never moves. That is the whole 15,000,000 ATH airdrop, on every claim.
//
// FIXED HERE RATHER THAN IN FeeAccumulator ON PURPOSE. FeeAccumulator's address is baked into the code of
// RecordShard (RS_FEE_SINK), IntroShard (IS_FEE_SINK) and AirdropTicket (AT_FEE_SINK), so moving its code moves
// its address and invalidates all three. This contract's address is BOUND at genesis (BindAirdropPool) and
// derived by nobody, so narrowing it here costs nothing. uint32 is ample: gate 26112 caps a single accrual at
// AIRDROP_MAX_CREDITS_PER_ACCRUAL (1000).
//
// Nothing enforced the mirror before; ACCRUE-WIRE-02 now does, and ACCRUE-WIRE-01 puts a real FeeAccumulator and
// a real AirdropPool in one sandbox — every prior test of this path stubbed one side with a treasury.
message(0x41445210) AirdropAccrue {
    purchase_id: Int as uint64;
    buyer: Address;
    credits_k: Int as uint32;
}

message(0x41445211) AirdropTopUpStorageReserve {}       // permissionless self-financing top-up

message(0x41445212) AirdropSweepResidualToTreasury {}   // permissionless dead-man after AIRDROP_SWEEP_GRACE

// Mirror of ATHWallet's interface (op + layout MUST match).
message(0x41544810) ATHTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

message(0x472D9D7D) AthTransferNotification {           // genesis funding lands here
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    sender_wallet: Address;
}

struct AirdropGlobalView {
    sealed: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    genesis_controller_address: Address;
    ath_master_address: Address;
    pool_ath_wallet_address: Address;
    credit_issuer_address: Address;
    treasury_address: Address;
    ath_per_credit: Int;
    total_pool: Int;
    funded_amount: Int;          // MUST be exposed: the ceremony verifies funded == 15M BEFORE sealing
    remaining_budget: Int;
    distributed_total: Int;
    claim_count: Int;
    sealed_at: Int;
    ath_master_bound: Bool;
    credit_issuer_bound: Bool;
    treasury_bound: Bool;
}

contract AirdropPool {
    sealed: Bool;
    genesis_controller_address: Address;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;

    ath_master_address: Address;
    pool_ath_wallet_address: Address;
    ath_master_bound: Bool;

    credit_issuer_address: Address;
    credit_issuer_bound: Bool;

    treasury_address: Address;
    treasury_bound: Bool;

    funded_amount: Int as uint128;
    remaining_budget: Int as uint128;
    distributed_total: Int as uint128;
    claim_count: Int as uint64;
    sealed_at: Int as uint64;
    payout_seq: Int as uint64;

    init(genesis_controller_address: Address, deployment_manifest_hash: Int, genesis_config_hash: Int, sealed: Bool) {
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.ath_master_address = genesis_controller_address;
        self.pool_ath_wallet_address = genesis_controller_address;
        self.ath_master_bound = false;
        self.credit_issuer_address = genesis_controller_address;
        self.credit_issuer_bound = false;
        self.treasury_address = genesis_controller_address;
        self.treasury_bound = false;
        self.funded_amount = 0;
        self.remaining_budget = 0;
        self.distributed_total = 0;
        self.claim_count = 0;
        self.sealed_at = 0;
        self.payout_seq = 0;
    }

    fun requireController() {
        throwUnless(26033, sender() == self.genesis_controller_address);
    }

    fun requireUnsealed() {
        throwUnless(26034, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(26100, self.sealed);
    }

    // Std-address basechain prefix check — the same shape sister contracts use (Vault.isBasechainAddress).
    // A masterchain recipient would make the ATHWallet leg unpayable at basechain gas.
    fun isBasechainAddress(a: Address): Bool {
        let s: Slice = a.asSlice();
        return s.loadUint(11) == 1024;
    }

    // The floor the sweep may never dip into: base code rent only. There is no per-claim state, so unlike the Hub
    // this term does not grow with usage.
    fun protectedReserve(): Int {
        return AIRDROP_BASE_STORAGE_ENDOWMENT;
    }

    // ===== GENESIS (controller, pre-seal, each one-shot) =====

    receive(msg: AirdropBindAthMaster) {
        self.requireUnsealed();
        self.requireController();
        throwUnless(26010, !self.ath_master_bound);
        self.ath_master_address = msg.ath_master_address;
        self.pool_ath_wallet_address = msg.pool_ath_wallet_address;
        self.ath_master_bound = true;
    }

    receive(msg: AirdropBindCreditIssuer) {
        self.requireUnsealed();
        self.requireController();
        throwUnless(26012, !self.credit_issuer_bound);
        self.credit_issuer_address = msg.credit_issuer_address;
        self.credit_issuer_bound = true;
    }

    receive(msg: AirdropBindTreasury) {
        self.requireUnsealed();
        self.requireController();
        throwUnless(26017, !self.treasury_bound);
        self.treasury_address = msg.treasury_address;
        self.treasury_bound = true;
    }

    // THE MIGRATION HOOK. Post-seal, controller-only, and it repoints the distributor and nothing else.
    // Gated on `sealed` rather than `unsealed` on purpose: before the seal the ordinary one-shot bind above is the
    // right path, and allowing both would give genesis two ways to set the same field. The manifest hash is
    // checked so a rebind cannot be replayed against a different deployment.
    receive(msg: AirdropRebindCreditIssuer) {
        self.requireSealed();
        self.requireController();
        throwUnless(26013, msg.deployment_manifest_hash == self.deployment_manifest_hash);
        throwUnless(26014, self.credit_issuer_bound);                              // nothing to rebind otherwise
        throwUnless(26015, self.isBasechainAddress(msg.credit_issuer_address));
        throwUnless(26016, msg.credit_issuer_address != myAddress());
        self.credit_issuer_address = msg.credit_issuer_address;
    }

    // Genesis funding: the treasury wallet sends 15M ATH to THIS pool's wallet, which notifies us.
    // payer-auth (26019): only OUR OWN bound ATHWallet may report a deposit — a forged notification from any other
    // address would otherwise let anyone declare the pool funded and unlock the seal over an empty budget.
    receive(msg: AthTransferNotification) {
        self.requireUnsealed();
        throwUnless(26011, self.ath_master_bound);
        throwUnless(26019, sender() == self.pool_ath_wallet_address);
        self.funded_amount = self.funded_amount + msg.amount;
        self.remaining_budget = self.remaining_budget + msg.amount;
    }

    receive(msg: AirdropSealGenesis) {
        self.requireUnsealed();
        self.requireController();
        throwUnless(26040, msg.deployment_manifest_hash == self.deployment_manifest_hash);
        throwUnless(26041, self.ath_master_bound);
        throwUnless(26042, self.credit_issuer_bound);
        throwUnless(26043, self.treasury_bound);
        // The budget must be REAL before the door closes. The contract cannot read its jetton balance synchronously,
        // so the ceremony's read-only verify (get_wallet_data(pool_wallet).balance == 15M) pairs with this gate:
        // fund -> verify -> seal, never seal-then-fund.
        throwUnless(26044, self.funded_amount == AIRDROP_TOTAL_POOL);
        self.sealed = true;
        self.sealed_at = now();
    }

    // ===== SEALED =====

    // The ONLY accrual path. Authenticated by exactly one sender: the bound credit_issuer (the 26110 gate below).
    // The invariant is that accrual fires ONLY downstream of REAL, non-bounced funding — the credit_issuer enforces
    // that on its side before it ever emits AirdropAccrue, so the refund-and-keep-the-ATH loop cannot exist. Two
    // callers have filled that role, and this pool is agnostic to which:
    //   * clean-16 caller = CreditIssuer, which emits this only from its FundAnonPoolAck handler — i.e. only after
    //     the Hub confirmed the pool funding landed (a bounced FundAnonPool yields no ack, hence no accrual).
    //   * clean-17 caller = FeeAccumulator, which emits this from TicketRedeem — i.e. only after a shard's capsule
    //     fee has actually been deposited and credited to that publisher's AirdropTicket (gate 15055 proves the
    //     depositor IS a shard). [CORRECTED 2026-07-21: this line named CreditSale, a contract deleted with the
    //     anonymous-payment layer. The stale name mattered — it described an accrual "atomic on a settled buy",
    //     which is not how the live path works and would have misled anyone sizing the value legs.]
    // Either way the accrual is gated on confirmed value, never on a mere request.
    receive(msg: AirdropAccrue) {
        self.requireSealed();
        throwUnless(26110, sender() == self.credit_issuer_address);
        throwUnless(26111, self.isBasechainAddress(msg.buyer));
        throwUnless(26112, (msg.credits_k >= 1) && (msg.credits_k <= AIRDROP_MAX_CREDITS_PER_ACCRUAL));

        let payout: Int = msg.credits_k * AIRDROP_ATH_PER_CREDIT;
        // Budget exhaustion is NOT an error: the 15M is finite by design, and once it is gone the messenger must
        // keep working. Accrue nothing and let the purchase stand.
        if (self.remaining_budget < payout) {
            return;
        }
        // fail-closed BEFORE mutating: a payout we cannot afford to deliver must not decrement the budget.
        throwUnless(26114, context().value >= AIRDROP_PAYOUT_PATH_GAS);

        self.remaining_budget = self.remaining_budget - payout;
        self.distributed_total = self.distributed_total + payout;
        self.claim_count = self.claim_count + 1;
        self.payout_seq = self.payout_seq + 1;

        // Fixed leg value, paid out of the incoming value the 26114 gate already verified. No RESERVE here: the
        // gate makes incoming > outgoing, so the base endowment is never the thing being spent.
        send(SendParameters{
            to: self.pool_ath_wallet_address,
            value: AIRDROP_ATHWALLET_LEG_GAS,
            mode: SendPayGasSeparately,
            bounce: false,
            body: ATHTransferRequest{
                query_id: self.payout_seq,
                amount: payout,
                recipient: msg.buyer,
                response_destination: myAddress(),
            }.toCell(),
        });
    }

    receive(_: AirdropTopUpStorageReserve) {
        // Permissionless: anyone may keep this contract alive. No auth, no state change — value is the point.
    }

    // Dead-man residual sweep. Only the UNDISTRIBUTED budget moves, and only to the frozen treasury bound at
    // genesis — there is no governance here and no address a caller can influence.
    receive(_: AirdropSweepResidualToTreasury) {
        self.requireSealed();
        throwUnless(26140, now() >= (self.sealed_at + AIRDROP_SWEEP_GRACE));
        throwUnless(26141, self.remaining_budget > 0);
        let residual: Int = self.remaining_budget;
        self.remaining_budget = 0;
        self.payout_seq = self.payout_seq + 1;

        // Same shape as the accrual: a fixed leg out of the caller's value, gated in COMPUTE. A sweep that failed
        // in ACTION would zero remaining_budget while the ATH never moved — the residual would be unreachable.
        throwUnless(26142, context().value >= AIRDROP_PAYOUT_PATH_GAS);
        send(SendParameters{
            to: self.pool_ath_wallet_address,
            value: AIRDROP_ATHWALLET_LEG_GAS,
            mode: SendPayGasSeparately,
            bounce: false,
            body: ATHTransferRequest{
                query_id: self.payout_seq,
                amount: residual,
                recipient: self.treasury_address,
                response_destination: myAddress(),
            }.toCell(),
        });
    }

    // A bounced payout leaves budget/counters as they were on purpose: the ATH never left, so re-crediting here
    // would double-count. The value simply returns.
    bounced(_: bounced<ATHTransferRequest>) {}

    receive() {}           // empty body = plain TON top-up (also how the contract is deployed)
    receive(_: Slice) {}   // tolerate unknown bodies instead of bouncing them

    // ===== GETTERS =====

    get fun get_global(): AirdropGlobalView {
        return AirdropGlobalView{
            sealed: self.sealed,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            genesis_controller_address: self.genesis_controller_address,
            ath_master_address: self.ath_master_address,
            pool_ath_wallet_address: self.pool_ath_wallet_address,
            credit_issuer_address: self.credit_issuer_address,
            treasury_address: self.treasury_address,
            ath_per_credit: AIRDROP_ATH_PER_CREDIT,
            total_pool: AIRDROP_TOTAL_POOL,
            funded_amount: self.funded_amount,
            remaining_budget: self.remaining_budget,
            distributed_total: self.distributed_total,
            claim_count: self.claim_count,
            sealed_at: self.sealed_at,
            ath_master_bound: self.ath_master_bound,
            credit_issuer_bound: self.credit_issuer_bound,
            treasury_bound: self.treasury_bound,
        };
    }
}
