// CreditIssuer — clean-16 Durable-Core (Phase B2, Vault-elimination).
//
// Two narrow on-chain functions for the sender-anonymous publish system:
//   1. A frozen registry of issuer public keys (8..16 slots) — the ed25519 keys under which CapsuleHub verifies a
//      token's issuer signature at SPEND time (via native checkSignature; feasibility proved in
//      tests/blind-schnorr-checksig.test.ts).
//   2. Credit sale into a pool — "buy N credits" = one on-chain payment of N*credit_price. The paying wallet is
//      visible (the accepted enumerable-roster residual). An off-chain issuer service watches these payments and
//      performs the interactive clause-blind issuance of N unlinkable tokens over Tor (the issuer SECRET is NEVER
//      on-chain; blinding unlinks the issued tokens from the purchase).
//
// NOT here (that is CapsuleHub, the spend point, B3): issuer-sig + spend-sig verification, epoch-nullifier.
// NOT here: the blind signing itself (off-chain). NOT here: custody (no user balances).
//
// Compromise recovery (owner decision 2026-07-16): a multisig controller (#9) may Replace/Revoke a compromised issuer
// slot POST-seal — governance-managed, consistent with the replaceable trust-root philosophy of #9. Tokens signed by
// a replaced/revoked key become invalid (the accepted cost of recovery).
//
// Design: artifacts/PLATHO_CLEAN16_CREDITISSUER_DESIGN.md. Purchases are NOT stored on-chain (they live in the
// BuyCredits tx body, read from history by the off-chain issuer) -> contract state is fixed-size, O(1).

const CREDIT_MIN_ISSUER_SLOTS: Int = 8;
const CREDIT_MAX_ISSUER_SLOTS: Int = 16;
const CREDIT_MAX_CREDITS_PER_BUY: Int = 1000;
const CREDIT_BUY_EXEC_RESERVE: Int = 10000000;        // gas allowance for the BuyCredits tx itself
const CREDIT_BASE_STORAGE_ENDOWMENT: Int = 100000000; // #19 singleton base code-rent (G8-provisional)

// SEAL-GATE G-PREPAID [IRREVERSIBLE, §5.6]: this MUST equal CapsuleHub's CAPSULEHUB_PREPAID_UNIT bit-for-bit. A drift
// is fatal — CI < Hub → every FundAnonPool bounces (total liveness break); CI > Hub → surplus leaks to owner-sweep,
// not backing. A cross-contract equality test pins it from BOTH compiled contracts. [G8] finalize @64962 before seal.
// Priced at the PRIVATE (CONV) lane — G8-CANONICAL measured as the WORST lane (8.02 cells vs PUBLIC 6.02 /
// INTRO 5.02), so one credit over-covers every lane and no lane tops up at publish. See the
// matching comment on CapsuleHub's CAPSULEHUB_PREPAID_UNIT — these two MUST stay equal (G-PREPAID, test CREDIT-RECON-03).
const CREDIT_PREPAID_UNIT: Int = 10995000;
// Value added on top of credits_k×prepaidUnit when forwarding FundAnonPool: covers the Hub's local exec reserve
// (CAPSULEHUB_FUND_LOCAL_EXEC_RESERVE = 2M) + the forward message fee, with margin. [G8].
const CREDIT_HUB_FUND_GAS: Int = 10000000;
// Value forwarded with AirdropAccrue. MUST stay >= AirdropPool's AIRDROP_PAYOUT_PATH_GAS (60M): that gate is
// fail-closed in COMPUTE, so an under-funded accrual bounces instead of silently skipping. Pinned from both
// compiled contracts by test AIRDROP-GAS-01. [G8 MEASURED]
const CREDIT_AIRDROP_ACCRUE_GAS: Int = 80000000;

message(0x43524431) CreditUploadIssuerKey {    // "CRD1" — genesis fill (unsealed, controller)
    slot: Int as uint8;
    pubkey: Int as uint256;
}

message(0x43524432) CreditSetPrice {           // "CRD2" — genesis price set (unsealed, controller)
    credit_price: Int as uint128;
}

message(0x3A12D1AD) CreditSealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x43524433) CreditReplaceIssuerKey {   // "CRD3" — compromise recovery (controller): fresh key into an existing slot
    slot: Int as uint8;
    new_pubkey: Int as uint256;
}

message(0x43524434) CreditRevokeIssuerKey {    // "CRD4" — deactivate a slot (controller)
    slot: Int as uint8;
}

message(0x43524435) CreditBuyCredits {         // "CRD5" — permissionless credit purchase
    credits_k: Int as uint16;
    redeem_pubkey: Int as uint256;             // binds the off-chain issuance to the payer (anti-front-run)
    epoch: Int as uint32;                      // Variant B (§5.4): the epoch bucket these credits fund/will be spent in
}

message(0x43524436) CreditBindHub {            // "CRD6" — genesis bind of the CapsuleHub address (controller, unsealed)
    capsule_hub_address: Address;
}

message(0x43524437) CreditTopUpStorageReserve {}  // "CRD7" — permissionless self-financing top-up

message(0x43524439) CreditBindAirdropPool {    // "CRD9" — genesis bind of the AirdropPool (controller, unsealed)
    airdrop_pool_address: Address;
}

// Mirror of AirdropPool's accrual message (op + layout MUST match). Emitted ONLY from the FundAnonPoolAck handler:
// the ack proves the funding LANDED in the Hub, so a bounced FundAnonPool can never mint ATH. Accruing at purchase
// time instead would be a free-ATH loop (buy with a bad epoch -> collect ATH -> bounce refunds the TON in full).
message(0x41445210) AirdropAccrue {
    purchase_id: Int as uint64;
    buyer: Address;
    credits_k: Int as uint64;
}

message(0x43524438) CreditPurchaseRefund {     // "CRD8" — sent to the buyer when their pool funding bounced (full refund)
    purchase_id: Int as uint64;
    credits_k: Int as uint64;
}

// Mirror of CapsuleHub's FundAnonPool (op + layout MUST match, §5.1). The CreditIssuer FORWARDS this to the Hub on a
// purchase, carrying credits_k×prepaidUnit of backing + a purchase_id correlation tag. bounce:true → a rejected forward
// returns to bounced(FundAnonPool); purchase_id (within the first 224 bits) survives the bounce → the exact buyer is
// refunded. The Hub echoes purchase_id in FundAnonPoolAck on success, which clears the pending purchase.
message(0x46414E50) FundAnonPool {
    credits_k: Int as uint64;
    epoch: Int as uint32;
    purchase_id: Int as uint64;
}

message(0x46414E41) FundAnonPoolAck {          // "FANA" — the Hub's success ack; clears the pending purchase
    credits_k: Int as uint64;
    epoch: Int as uint32;
    purchase_id: Int as uint64;
}

struct IssuerSlot {
    pubkey: Int as uint256;
    active: Bool;
    version: Int as uint32;
}

// An in-flight purchase whose FundAnonPool forward has not yet been settled by an ack (success) or a bounce (failure).
// Bounded by in-flight purchases only: TON guarantees exactly one response (ack or the guaranteed bounce of a
// bounce:true message) per forward, and each response clears its entry — so the map drains within a couple of blocks.
struct PendingPurchase {
    payer: Address;
    credits_k: Int as uint64;
    refund_amount: Int as uint128;   // the full price the buyer paid (creditCost) — refunded verbatim on bounce
}

struct PendingPurchaseView {
    exists: Bool;
    payer: Address;
    credits_k: Int;
    refund_amount: Int;
}

struct CreditIssuerSlotView {
    exists: Bool;
    pubkey: Int;
    active: Bool;
    version: Int;
}

struct CreditIssuerGlobalView {
    sealed: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    genesis_controller_address: Address;
    issuer_slot_count: Int;
    active_slot_count: Int;
    credit_price: Int;
    pool_collected: Int;
    credits_sold: Int;
    min_issuer_slots: Int;
    max_issuer_slots: Int;
    max_credits_per_buy: Int;
    base_storage_endowment: Int;
    hub_bound: Bool;
    capsule_hub_address: Address;
    prepaid_unit: Int;                // == CapsuleHub CAPSULEHUB_PREPAID_UNIT (G-PREPAID equality, §5.6)
    hub_fund_gas: Int;
    airdrop_pool_address: Address;
    airdrop_pool_bound: Bool;
}

contract CreditIssuer {
    sealed: Bool;
    genesis_controller_address: Address;
    deployment_manifest_hash: Int as uint256;
    genesis_config_hash: Int as uint256;
    issuer_slot_count: Int as uint8;      // filled slots (never decremented; revoked slots stay filled+inactive)
    active_slot_count: Int as uint8;
    issuer_slots: map<Int, IssuerSlot>;
    credit_price: Int as uint128;
    pool_collected: Int as uint128;
    credits_sold: Int as uint64;
    // clean-16 B3: the bound CapsuleHub the pool forwards into (§5.1). Genesis-bound (unsealed), required at seal.
    capsule_hub_address: Address;
    hub_bound: Bool;
    // In-flight purchases awaiting the Hub's ack/bounce, so a bounced forward refunds the exact buyer (§5.5 true refund).
    pending_purchases: map<Int, PendingPurchase>;
    purchase_seq: Int as uint64;
    // clean-16 airdrop: the pool that pays 10 ATH per settled credit. Optional — an unbound pool simply means no
    // airdrop (the owner may DROP it), and the messenger works identically either way.
    airdrop_pool_address: Address;
    airdrop_pool_bound: Bool;

    init(genesis_controller_address: Address, deployment_manifest_hash: Int, genesis_config_hash: Int, sealed: Bool) {
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.issuer_slot_count = 0;
        self.active_slot_count = 0;
        self.credit_price = 0;
        self.pool_collected = 0;
        self.credits_sold = 0;
        self.capsule_hub_address = genesis_controller_address;  // placeholder until CreditBindHub
        self.hub_bound = false;
        self.pending_purchases = emptyMap();
        self.purchase_seq = 0;
        self.airdrop_pool_address = genesis_controller_address;
        self.airdrop_pool_bound = false;
    }

    fun requireUnsealed() {
        throwUnless(21000, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(21100, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(21033, sender() == self.genesis_controller_address);
    }

    fun isBasechainAddress(address: Address): Bool {
        let a: StdAddress = parseStdAddress(address.asSlice());
        return a.workchain == 0;
    }

    // ---- genesis fill ----

    receive(msg: CreditBindHub) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21070, self.isBasechainAddress(msg.capsule_hub_address));
        throwUnless(21071, msg.capsule_hub_address != myAddress());
        self.capsule_hub_address = msg.capsule_hub_address;
        self.hub_bound = true;
    }

    receive(msg: CreditUploadIssuerKey) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21010, msg.slot < CREDIT_MAX_ISSUER_SLOTS);
        throwUnless(21011, msg.pubkey != 0);
        throwUnless(21012, !self.issuer_slots.exists(msg.slot));
        self.issuer_slots.set(msg.slot, IssuerSlot { pubkey: msg.pubkey, active: true, version: 0 });
        self.issuer_slot_count += 1;
        self.active_slot_count += 1;
    }

    receive(msg: CreditSetPrice) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21013, msg.credit_price > 0);
        self.credit_price = msg.credit_price;
    }

    receive(msg: CreditSealGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        throwUnless(21040, msg.deployment_manifest_hash > 1);
        throwUnless(21041, self.deployment_manifest_hash == msg.deployment_manifest_hash);
        throwUnless(21042, self.issuer_slot_count >= CREDIT_MIN_ISSUER_SLOTS);
        throwUnless(21043, self.issuer_slot_count <= CREDIT_MAX_ISSUER_SLOTS);
        throwUnless(21044, self.active_slot_count >= CREDIT_MIN_ISSUER_SLOTS);
        throwUnless(21045, self.credit_price > 0);
        // clean-16 B3: the pool sink must be bound before seal (BindHub needs unsealed; a post-seal bind is impossible),
        // and the price must cover the forwarded backing + fund gas so even a 1-credit buy funds the Hub pool (§5.1/§5.6).
        throwUnless(21046, self.hub_bound);
        // clean-16 B3 (cost fix): the per-credit price covers ONLY the per-credit backing (prepaidUnit). CREDIT_HUB_FUND_GAS
        // is the cost of the SINGLE FundAnonPool forward per PURCHASE — charging it per credit made a 10-credit buy overpay
        // 9×fund_gas (~0.09 TON of pure waste). It is now required once, in the BuyCredits value gate (21063).
        throwUnless(21047, self.credit_price >= CREDIT_PREPAID_UNIT);
        self.genesis_config_hash = msg.deployment_manifest_hash;
        self.sealed = true;
    }

    // ---- compromise recovery (controller, any seal state) ----

    receive(msg: CreditReplaceIssuerKey) {
        self.requireGenesisController();
        throwUnless(21050, msg.new_pubkey != 0);
        let slotOpt: IssuerSlot? = self.issuer_slots.get(msg.slot);
        throwUnless(21051, slotOpt != null);
        let slot: IssuerSlot = slotOpt!!;
        if (!slot.active) {
            self.active_slot_count += 1;
        }
        self.issuer_slots.set(msg.slot, IssuerSlot { pubkey: msg.new_pubkey, active: true, version: slot.version + 1 });
    }

    receive(msg: CreditRevokeIssuerKey) {
        self.requireGenesisController();
        let slotOpt: IssuerSlot? = self.issuer_slots.get(msg.slot);
        throwUnless(21055, slotOpt != null);
        let slot: IssuerSlot = slotOpt!!;
        throwUnless(21056, slot.active);
        self.active_slot_count -= 1;
        // clean-16 B3: BUMP the version on revoke too. The Hub's issuer_mirror requires a STRICTLY increasing version
        // (HubMirrorIssuerKey 13615); if revoke kept the same version, the deactivation could NOT be propagated to the
        // Hub — leaving a compromised slot ACTIVE at the spend point (tokens of the leaked key keep verifying), which
        // would defeat compromise recovery. Every slot state change (Replace OR Revoke) is a monotone, mirror-able event.
        self.issuer_slots.set(msg.slot, IssuerSlot { pubkey: slot.pubkey, active: false, version: slot.version + 1 });
    }

    // ---- credit sale (permissionless) ----

    receive(msg: CreditBuyCredits) {
        self.requireSealed();
        throwUnless(21060, msg.credits_k >= 1);
        throwUnless(21061, msg.credits_k <= CREDIT_MAX_CREDITS_PER_BUY);
        throwUnless(21062, msg.redeem_pubkey != 0);
        let creditCost: Int = msg.credits_k * self.credit_price;
        // fund_gas is charged ONCE per purchase (one FundAnonPool forward), NOT per credit — so buying k credits
        // amortizes it instead of paying k×fund_gas. Seal-gate 21047 guarantees credit_price >= prepaidUnit, so
        // creditCost alone always covers the k×prepaidUnit backing; fund_gas is the extra forward cost on top.
        let required: Int = creditCost + CREDIT_HUB_FUND_GAS + CREDIT_BUY_EXEC_RESERVE;
        throwUnless(21063, context().value >= required);
        self.pool_collected += creditCost;
        self.credits_sold += msg.credits_k;
        // Record the in-flight purchase so a bounced forward refunds THIS exact buyer (§5.5). {redeem_pubkey} still lives
        // only in the tx body for the off-chain issuer; the pending entry holds just what a refund needs.
        let pid: Int = self.purchase_seq;
        self.purchase_seq += 1;
        self.pending_purchases.set(pid, PendingPurchase { payer: sender(), credits_k: msg.credits_k, refund_amount: creditCost });

        // Forward the storage backing into the Hub's prepaid pool (§5.1). Value = credits_k×prepaidUnit + fund gas;
        // credit_price >= prepaidUnit + fund_gas (seal-gate 21047) guarantees the incoming payment covers it. bounce:true
        // → a rejected forward returns to bounced(FundAnonPool), which refunds the buyer via the pending entry.
        let backing: Int = msg.credits_k * CREDIT_PREPAID_UNIT + CREDIT_HUB_FUND_GAS;
        message(MessageParameters {
            to: self.capsule_hub_address,
            value: backing,
            bounce: true,
            mode: SendDefaultMode,
            body: FundAnonPool { credits_k: msg.credits_k, epoch: msg.epoch, purchase_id: pid }.toCell()
        });
    }

    // Success: the Hub funded the pool and echoed purchase_id. Clear the pending entry (no refund).
    receive(msg: FundAnonPoolAck) {
        throwUnless(21080, sender() == self.capsule_hub_address);
        // Read the payer BEFORE clearing: this ack is the ONLY moment both facts are known at once — WHO paid
        // (pending_purchases, kept for the refund path) and THAT the funding settled (the Hub said so). The airdrop
        // accrual has to ride exactly here, or it rides on an unsettled purchase and becomes a free-ATH loop.
        let pending: PendingPurchase? = self.pending_purchases.get(msg.purchase_id);
        self.pending_purchases.set(msg.purchase_id, null);
        if (self.airdrop_pool_bound && (pending != null)) {
            send(SendParameters{
                to: self.airdrop_pool_address,
                value: CREDIT_AIRDROP_ACCRUE_GAS,
                mode: SendPayGasSeparately,
                bounce: false,   // an unfunded/exhausted pool must never bounce back into the settled purchase
                body: AirdropAccrue{
                    purchase_id: msg.purchase_id,
                    buyer: pending!!.payer,
                    credits_k: pending!!.credits_k,
                }.toCell(),
            });
        }
    }

    // Failure: the Hub rejected the forward (bounce:true guarantees this fires). purchase_id survives the bounce (within
    // the first 224 bits) → refund the exact buyer their FULL price, reverse the sale accounting, and clear the entry.
    // A double-fire is impossible (TON delivers exactly one ack OR one bounce per forward), and the missing-entry guard
    // makes a stray bounce a no-op.
    bounced(msg: bounced<FundAnonPool>) {
        let pOpt: PendingPurchase? = self.pending_purchases.get(msg.purchase_id);
        if (pOpt != null) {
            let p: PendingPurchase = pOpt!!;
            self.pending_purchases.set(msg.purchase_id, null);
            if (self.credits_sold >= p.credits_k) { self.credits_sold -= p.credits_k; }
            if (self.pool_collected >= p.refund_amount) { self.pool_collected -= p.refund_amount; }
            message(MessageParameters {
                to: p.payer,
                value: p.refund_amount,
                bounce: false,
                mode: SendDefaultMode,
                body: CreditPurchaseRefund { purchase_id: msg.purchase_id, credits_k: p.credits_k }.toCell()
            });
        }
    }

    receive(msg: CreditBindAirdropPool) {
        throwUnless(21100, !self.sealed);
        throwUnless(21033, sender() == self.genesis_controller_address);
        throwUnless(21048, !self.airdrop_pool_bound);
        self.airdrop_pool_address = msg.airdrop_pool_address;
        self.airdrop_pool_bound = true;
    }

    receive(msg: CreditTopUpStorageReserve) {
        // Accept value into the pool; no state change.
    }

    receive() {}

    // ---- getters ----

    get fun get_issuer_slot(slot: Int): CreditIssuerSlotView {
        let slotOpt: IssuerSlot? = self.issuer_slots.get(slot);
        if (slotOpt == null) {
            return CreditIssuerSlotView { exists: false, pubkey: 0, active: false, version: 0 };
        }
        let s: IssuerSlot = slotOpt!!;
        return CreditIssuerSlotView { exists: true, pubkey: s.pubkey, active: s.active, version: s.version };
    }

    get fun get_pending_purchase(purchaseId: Int): PendingPurchaseView {
        let pOpt: PendingPurchase? = self.pending_purchases.get(purchaseId);
        if (pOpt == null) {
            return PendingPurchaseView { exists: false, payer: myAddress(), credits_k: 0, refund_amount: 0 };
        }
        let p: PendingPurchase = pOpt!!;
        return PendingPurchaseView { exists: true, payer: p.payer, credits_k: p.credits_k, refund_amount: p.refund_amount };
    }

    get fun get_global(): CreditIssuerGlobalView {
        return CreditIssuerGlobalView {
            sealed: self.sealed,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            genesis_controller_address: self.genesis_controller_address,
            issuer_slot_count: self.issuer_slot_count,
            active_slot_count: self.active_slot_count,
            credit_price: self.credit_price,
            pool_collected: self.pool_collected,
            credits_sold: self.credits_sold,
            min_issuer_slots: CREDIT_MIN_ISSUER_SLOTS,
            max_issuer_slots: CREDIT_MAX_ISSUER_SLOTS,
            max_credits_per_buy: CREDIT_MAX_CREDITS_PER_BUY,
            base_storage_endowment: CREDIT_BASE_STORAGE_ENDOWMENT,
            hub_bound: self.hub_bound,
            capsule_hub_address: self.capsule_hub_address,
            prepaid_unit: CREDIT_PREPAID_UNIT,
            hub_fund_gas: CREDIT_HUB_FUND_GAS,
            airdrop_pool_address: self.airdrop_pool_address,
            airdrop_pool_bound: self.airdrop_pool_bound
        };
    }
}
