// CreditSale — clean-17 credit sale (CARRY/CAC model). Supersedes CreditIssuer's pool/issuer-key machinery.
//
// In the monolith, CreditIssuer did three things: managed issuer keys (issuer_mirror), funded the Hub pool
// (FundAnonPool), and collected the protocol fee. Sharding removes the first two: token AUTHORITY is now CAC (root
// keys frozen in the shard code, an off-chain subkey blind-signs), and there is no pool — the endowment is CARRIED
// per message by the relay. So the on-chain credit sale collapses to its essence:
//   1. sell credits for the protocol fee,
//   2. accrue the airdrop (10 ATH per credit),
//   3. route the collected fee to the DeFi pool (FeeAccumulator).
// The off-chain issuer service watches BuyCredits payments (visible on-chain) and blind-signs one token per credit.
//
// WHY ACCRUING ON THE BUY IS SAFE HERE (it was FATAL in the monolith). The design doc rejected accruing airdrop at
// purchase time because the monolith's purchase forwarded FundAnonPool, which could BOUNCE (bad epoch at the Hub),
// and CreditIssuer refunded the buyer in full — so an attacker took the ATH and got their TON back, looped. In the
// sharded model there is NO pool, NO forward, NO bounce, NO refund path: BuyCredits is ATOMIC. It either succeeds
// (the buyer paid, irreversibly) or reverts. So the ATH can accrue directly on a successful buy — the exploit that
// forced the ack-deferral in AirdropPool does not exist here.
//
// OWNER MATH, UNCHANGED: credit fee = 10_000_000 nanoTON/credit; 1.5M credits -> 15_000 GRAM to the DeFi pool.
// Airdrop = 10 ATH/credit; 1.5M credits -> 15M ATH. One capsule = one credit = 10 ATH.

const CS_CREDIT_FEE_DEFAULT: Int = 10000000;    // protocol fee per credit (owner: 10M nanoTON -> 15k GRAM at 1.5M)
const CS_MAX_CREDITS_PER_BUY: Int = 1000;       // bounds one accrue/payout (mirrors the monolith)
const CS_AIRDROP_ACCRUE_GAS: Int = 80000000;    // forwarded to the AirdropPool (it does a full ATH payout leg) [G8]
const CS_BUY_EXEC_RESERVE: Int = 10000000;      // gas for the BuyCredits tx itself
const CS_BASE_STORAGE_ENDOWMENT: Int = 100000000; // #19 singleton base code-rent (mirrors the other Durable-Core singletons)
const CS_FEEACC_DEPOSIT_EXEC_RESERVE: Int = 2000000; // must cover the FeeAccumulator's own exec reserve on a deposit

message(0x43533031) CsBindAirdropPool {         // "CS01" — genesis (controller, unsealed, one-shot)
    airdrop_pool_address: Address;
}

message(0x43533032) CsBindFeeReceiver {         // "CS02" — genesis: the DeFi-pool feeder (FeeAccumulator)
    fee_receiver_address: Address;
}

message(0x43533033) CsSetCreditFee {            // "CS03" — genesis: the per-credit protocol fee
    credit_fee: Int as uint128;
}

message(0x43533034) CsSealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x43533035) CsBuyCredits {              // "CS05" — permissionless credit purchase
    credits_k: Int as uint16;
    redeem_pubkey: Int as uint256;              // binds the off-chain blind issuance to the payer (anti-front-run)
}

message(0x43533036) CsFlushFees {}              // "CS06" — permissionless: push collected fees to the DeFi pool

message(0x43533037) CsTopUpStorageReserve {}    // "CS07" — permissionless self-financing top-up

// Mirror of AirdropPool's AirdropAccrue (op + layout MUST match).
message(0x41445210) AirdropAccrue {
    purchase_id: Int as uint64;
    buyer: Address;
    credits_k: Int as uint64;
}

// Mirror of FeeAccumulator's DepositProtocolFee (op + layout MUST match).
message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

struct CreditSaleView {
    sealed: Bool;
    genesis_controller_address: Address;
    deployment_manifest_hash: Int;
    airdrop_pool_address: Address;
    airdrop_pool_bound: Bool;
    fee_receiver_address: Address;
    fee_receiver_bound: Bool;
    credit_fee: Int;
    fees_collected: Int;
    credits_sold: Int;
    purchase_seq: Int;
}

contract CreditSale {
    sealed: Bool;
    genesis_controller_address: Address;
    deployment_manifest_hash: Int as uint256;
    airdrop_pool_address: Address;
    airdrop_pool_bound: Bool;
    fee_receiver_address: Address;
    fee_receiver_bound: Bool;
    credit_fee: Int as uint128;
    fees_collected: Int as uint128;
    credits_sold: Int as uint64;
    purchase_seq: Int as uint64;

    init(genesis_controller_address: Address, deployment_manifest_hash: Int, sealed: Bool) {
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.airdrop_pool_address = genesis_controller_address;
        self.airdrop_pool_bound = false;
        self.fee_receiver_address = genesis_controller_address;
        self.fee_receiver_bound = false;
        self.credit_fee = CS_CREDIT_FEE_DEFAULT;
        self.fees_collected = 0;
        self.credits_sold = 0;
        self.purchase_seq = 0;
    }

    fun requireController() { throwUnless(27033, sender() == self.genesis_controller_address); }
    fun requireUnsealed() { throwUnless(27034, !self.sealed); }
    fun requireSealed() { throwUnless(27100, self.sealed); }

    // ===== GENESIS (controller, pre-seal, each one-shot) =====

    receive(msg: CsBindAirdropPool) {
        self.requireUnsealed(); self.requireController();
        throwUnless(27010, !self.airdrop_pool_bound);
        self.airdrop_pool_address = msg.airdrop_pool_address;
        self.airdrop_pool_bound = true;
    }

    receive(msg: CsBindFeeReceiver) {
        self.requireUnsealed(); self.requireController();
        throwUnless(27012, !self.fee_receiver_bound);
        self.fee_receiver_address = msg.fee_receiver_address;
        self.fee_receiver_bound = true;
    }

    receive(msg: CsSetCreditFee) {
        self.requireUnsealed(); self.requireController();
        throwUnless(27014, msg.credit_fee > 0);
        self.credit_fee = msg.credit_fee;
    }

    receive(msg: CsSealGenesis) {
        self.requireUnsealed(); self.requireController();
        throwUnless(27040, msg.deployment_manifest_hash == self.deployment_manifest_hash);
        throwUnless(27041, self.airdrop_pool_bound);
        throwUnless(27042, self.fee_receiver_bound);
        throwUnless(27043, self.credit_fee > 0);
        self.sealed = true;
    }

    // ===== SEALED =====

    receive(msg: CsBuyCredits) {
        self.requireSealed();
        throwUnless(27101, (msg.credits_k >= 1) && (msg.credits_k <= CS_MAX_CREDITS_PER_BUY));
        let fee: Int = msg.credits_k * self.credit_fee;
        // fail-closed: the buyer must fund the fee (kept) + the airdrop payout leg (forwarded) + this tx's gas.
        throwUnless(27102, context().value >= fee + CS_AIRDROP_ACCRUE_GAS + CS_BUY_EXEC_RESERVE);

        // The purchase is atomic and irreversible: collect the fee and accrue the airdrop in the same breath. No
        // ack-deferral is needed because there is no downstream bounce (see the header) — this is the safety the
        // monolith could not have.
        self.fees_collected = self.fees_collected + fee;
        self.credits_sold = self.credits_sold + msg.credits_k;
        self.purchase_seq = self.purchase_seq + 1;

        send(SendParameters{
            to: self.airdrop_pool_address,
            value: CS_AIRDROP_ACCRUE_GAS,
            mode: SendPayGasSeparately,
            bounce: false,   // an unfunded/exhausted pool must never bounce back into the settled purchase
            body: AirdropAccrue{
                purchase_id: self.purchase_seq,
                buyer: sender(),
                credits_k: msg.credits_k,
            }.toCell(),
        });
        // The fee stays on balance; CsFlushFees pushes it to the DeFi pool. The buyer's excess value stays as
        // reserve (there is no per-message endowment to size against here — this is a singleton, not a shard).
    }

    // Permissionless: push the accumulated protocol fee to the DeFi pool (FeeAccumulator). Keeps the base storage
    // endowment on balance so the singleton stays alive.
    receive(_: CsFlushFees) {
        self.requireSealed();
        let due: Int = self.fees_collected;
        throwUnless(27110, due > 0);
        // Only flush what the balance can back beyond the base endowment + the deposit's exec reserve.
        throwUnless(27111, myBalance() >= CS_BASE_STORAGE_ENDOWMENT + due + CS_FEEACC_DEPOSIT_EXEC_RESERVE);
        self.fees_collected = 0;
        send(SendParameters{
            to: self.fee_receiver_address,
            value: due + CS_FEEACC_DEPOSIT_EXEC_RESERVE,
            mode: SendPayGasSeparately,
            bounce: false,
            body: DepositProtocolFee{ amount: due }.toCell(),
        });
    }

    receive(_: CsTopUpStorageReserve) {}
    receive() {}
    receive(_: Slice) {}

    get fun get_global(): CreditSaleView {
        return CreditSaleView{
            sealed: self.sealed,
            genesis_controller_address: self.genesis_controller_address,
            deployment_manifest_hash: self.deployment_manifest_hash,
            airdrop_pool_address: self.airdrop_pool_address,
            airdrop_pool_bound: self.airdrop_pool_bound,
            fee_receiver_address: self.fee_receiver_address,
            fee_receiver_bound: self.fee_receiver_bound,
            credit_fee: self.credit_fee,
            fees_collected: self.fees_collected,
            credits_sold: self.credits_sold,
            purchase_seq: self.purchase_seq,
        };
    }
}
