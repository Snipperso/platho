// Platho v1 MarketStabilitySeller.
// Scope: immutable milestone-gated ATH reserve sales at x2..x21 price floors,
// official ATH wallet custody, TON treasury due accounting, and bounce/fail recovery.
// No DEX route, admin sale override, pause, upgrade, governance, rescue, or
// post-freeze pricing mutation is implemented.

import "./ATHWallet.tact";

const MARKET_STABILITY_TOTAL_RESERVE_ATH: Int = 60000000000000000;
const MARKET_STABILITY_TRANCHE_ATH: Int = 3000000000000000;
const MARKET_STABILITY_TRANCHE_COUNT: Int = 20;
const MARKET_STABILITY_START_MULTIPLIER: Int = 2;
const MARKET_STABILITY_END_MULTIPLIER: Int = 21;
const MARKET_STABILITY_ATH_NOTIFY_ACK_VALUE: Int = 1000000;
const MARKET_STABILITY_LOCAL_EXEC_RESERVE: Int = 2000000;
const MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE: Int = 58000000; // F11/#3: 48M->58M (+10M) to match the ATHVesting/Vault ATH-transfer lanes' margin, widening the DOWNSTREAM recipient-hop slack (was ~20M-fwd_fee) so a multi-decade rise in config-25 forward fees cannot bounce the market-stability SELL leg. The wallet's ATHTransferRequest required_value floor stays EXEC_RESERVE(2M)+INTERNAL_TRANSFER_ACK(3M)+STORAGE_ENDOWMENT(20M)+FWD_FEE_ALLOWANCE(21M)+OWNER_REQUEST_EXEC(2M) = 48M; the 58M forward satisfies it with 10M headroom. Buyers over-provide and are refunded the excess (no client lockstep; no PWA MSS-buy flow exists). Strict margin increase on an already fail-safe (bounce+refund) path.
const MARKET_STABILITY_BUY_EXEC_RESERVE: Int = 2000000;
const MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE: Int = 2000000;
const MARKET_STABILITY_MIN_TREASURY_FLUSH_TON: Int = MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE;
const MARKET_STABILITY_EXCESS_REFUND_MIN_VALUE: Int = 100000;
const MARKET_STABILITY_PHASE_IDLE: Int = 0;
const MARKET_STABILITY_PHASE_PENDING_ATH_TRANSFER: Int = 1;
const UINT64_MAX: Int = 18446744073709551615;

message(0x4D535246) BindMarketStabilityReserveFunder { // "MSRF"
    deployment_manifest_hash: Int as uint256;
    reserve_funder_address: Address;
}

message(0x4D534157) BindMarketStabilityOfficialAthWallet { // "MSAW"
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x4D535452) BindMarketStabilityTreasury { // "MSTR"
    deployment_manifest_hash: Int as uint256;
    ton_treasury_receiver_address: Address;
}

message(0x4D535046) FreezeMarketStabilityPricing { // "MSPF"
    deployment_manifest_hash: Int as uint256;
    base_tranche_price_nanotons: Int as uint128;
    evidence_x1_tranche_quote_nanotons: Int as uint128;
    pricing_evidence_hash: Int as uint256;
}

message(0x4D53534C) SealMarketStabilityGenesis { // "MSSL"
    deployment_manifest_hash: Int as uint256;
}

message(0x4D534558) BuyMarketStabilityAth { // "MSEX"
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
}

message(0x4D534654) FlushMarketStabilityTreasuryTon { // "MSFT"
    amount: Int as uint128;
}

message(0x906182D3) MarketStabilityTopUpStorageReserve {}

struct MarketStabilitySellerConfigView {
    sealed: Bool;
    reserve_funder_bound: Bool;
    official_ath_wallet_bound: Bool;
    treasury_bound: Bool;
    pricing_frozen: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    ath_master_address: Address;
    reserve_funder_address: Address;
    official_ath_wallet_address: Address;
    ton_treasury_receiver_address: Address;
    base_tranche_price_nanotons: Int;
    evidence_x1_tranche_quote_nanotons: Int;
    pricing_evidence_hash: Int;
}

struct MarketStabilitySellerStateView {
    phase: Int;
    reserve_due_ath: Int;
    treasury_due_ton: Int;
    pending_query_id: Int;
    pending_amount_ath: Int;
    pending_paid_ton: Int;
    pending_buyer: Address;
    pending_recipient: Address;
    pending_recipient_ath_wallet: Address;
    completed_tranche_count: Int;
    current_tranche_sold_ath: Int;
    current_multiplier: Int;
    current_tranche_remaining_ath: Int;
    last_terminal_query_id: Int;
}

struct MarketStabilitySellerTotalsView {
    reserve_funded_total_ath: Int;
    sold_ath_total: Int;
    treasury_flushed_ton_total: Int;
}

contract MarketStabilitySeller {
    genesis_config_hash: Int as uint256;
    deployment_manifest_hash: Int as uint256;
    ath_master_address: Address;
    reserve_funder_address: Address;
    official_ath_wallet_address: Address;
    ton_treasury_receiver_address: Address;
    reserve_funder_bound: Bool;
    official_ath_wallet_bound: Bool;
    treasury_bound: Bool;
    pricing_frozen: Bool;
    sealed: Bool;
    base_tranche_price_nanotons: Int as uint128;
    evidence_x1_tranche_quote_nanotons: Int as uint128;
    pricing_evidence_hash: Int as uint256;
    phase: Int as uint8;
    reserve_due_ath: Int as uint128;
    treasury_due_ton: Int as uint128;
    pending_query_id: Int as uint64;
    pending_amount_ath: Int as uint128;
    pending_paid_ton: Int as uint128;
    pending_buyer: Address;
    pending_recipient: Address;
    pending_recipient_ath_wallet: Address;
    completed_tranche_count: Int as uint8;
    current_tranche_sold_ath: Int as uint128;
    last_terminal_query_id: Int as uint64;
    reserve_funded_total_ath: Int as uint128;
    sold_ath_total: Int as uint128;
    treasury_flushed_ton_total: Int as uint128;

    init(genesis_config_hash: Int, ath_master_address: Address) {
        throwUnless(23000, genesis_config_hash != 0);
        self.genesis_config_hash = genesis_config_hash;
        self.deployment_manifest_hash = 0;
        self.ath_master_address = ath_master_address;
        self.reserve_funder_address = ath_master_address;
        self.official_ath_wallet_address = ath_master_address;
        self.ton_treasury_receiver_address = ath_master_address;
        self.reserve_funder_bound = false;
        self.official_ath_wallet_bound = false;
        self.treasury_bound = false;
        self.pricing_frozen = false;
        self.sealed = false;
        self.base_tranche_price_nanotons = 0;
        self.evidence_x1_tranche_quote_nanotons = 0;
        self.pricing_evidence_hash = 0;
        self.phase = MARKET_STABILITY_PHASE_IDLE;
        self.reserve_due_ath = 0;
        self.treasury_due_ton = 0;
        self.pending_query_id = 0;
        self.pending_amount_ath = 0;
        self.pending_paid_ton = 0;
        self.pending_buyer = ath_master_address;
        self.pending_recipient = ath_master_address;
        self.pending_recipient_ath_wallet = ath_master_address;
        self.completed_tranche_count = 0;
        self.current_tranche_sold_ath = 0;
        self.last_terminal_query_id = 0;
        self.reserve_funded_total_ath = 0;
        self.sold_ath_total = 0;
        self.treasury_flushed_ton_total = 0;
    }

    fun requireUnsealed() {
        throwUnless(23001, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(23002, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(23003, self.genesis_config_hash != 0);
        throwUnless(23004, beginCell().storeAddress(sender()).endCell().hash() == self.genesis_config_hash);
    }

    fun acceptManifestHash(hash: Int) {
        throwUnless(23005, hash > 1);
        throwUnless(23006, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == hash);
        self.deployment_manifest_hash = hash;
    }

    fun is_basechain_address(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun deriveAthWalletAddress(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun deriveOwnAthWalletAddress(): Address {
        return self.deriveAthWalletAddress(myAddress());
    }

    fun ceilDiv(numerator: Int, denominator: Int): Int {
        throwUnless(23007, denominator > 0);
        if (numerator == 0) {
            return 0;
        }
        return ((numerator - 1) / denominator) + 1;
    }

    fun currentMultiplier(): Int {
        return MARKET_STABILITY_START_MULTIPLIER + self.completed_tranche_count;
    }

    fun currentTrancheRemaining(): Int {
        if (self.completed_tranche_count >= MARKET_STABILITY_TRANCHE_COUNT) {
            return 0;
        }
        return MARKET_STABILITY_TRANCHE_ATH - self.current_tranche_sold_ath;
    }

    fun quoteTonForAmount(amount: Int): Int {
        throwUnless(23008, self.pricing_frozen);
        throwUnless(23009, amount > 0);
        let remaining: Int = self.currentTrancheRemaining();
        throwUnless(23010, remaining > 0);
        throwUnless(23011, amount <= remaining);
        let numerator: Int = self.base_tranche_price_nanotons * self.currentMultiplier() * amount;
        return self.ceilDiv(numerator, MARKET_STABILITY_TRANCHE_ATH);
    }

    fun requireNextQueryId(queryId: Int) {
        throwUnless(23012, queryId < UINT64_MAX);
        throwUnless(23013, queryId == self.last_terminal_query_id + 1);
    }

    fun recordTerminalQueryId(queryId: Int) {
        self.last_terminal_query_id = queryId;
    }

    fun clearPending() {
        self.phase = MARKET_STABILITY_PHASE_IDLE;
        self.pending_query_id = 0;
        self.pending_amount_ath = 0;
        self.pending_paid_ton = 0;
        self.pending_buyer = self.ath_master_address;
        self.pending_recipient = self.ath_master_address;
        self.pending_recipient_ath_wallet = self.ath_master_address;
    }

    fun refundTon(destination: Address, amount: Int) {
        if (amount < MARKET_STABILITY_EXCESS_REFUND_MIN_VALUE) {
            return;
        }

        message(MessageParameters {
            to: destination,
            value: amount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });
    }

    fun failPendingSale() {
        let queryId: Int = self.pending_query_id;
        let amount: Int = self.pending_amount_ath;
        let paid: Int = self.pending_paid_ton;
        let buyer: Address = self.pending_buyer;
        self.reserve_due_ath += amount;
        self.clearPending();
        self.recordTerminalQueryId(queryId);
        self.refundTon(buyer, paid);
    }

    fun finalizePendingSale() {
        let queryId: Int = self.pending_query_id;
        let amount: Int = self.pending_amount_ath;
        let paid: Int = self.pending_paid_ton;
        self.treasury_due_ton += paid;
        self.sold_ath_total += amount;
        self.current_tranche_sold_ath += amount;
        if (self.current_tranche_sold_ath == MARKET_STABILITY_TRANCHE_ATH) {
            self.completed_tranche_count += 1;
            self.current_tranche_sold_ath = 0;
        }
        self.clearPending();
        self.recordTerminalQueryId(queryId);
    }

    receive(msg: BindMarketStabilityReserveFunder) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(23100, !self.reserve_funder_bound);
        throwUnless(23101, msg.reserve_funder_address != myAddress());
        throwUnless(23102, self.is_basechain_address(msg.reserve_funder_address));
        self.reserve_funder_address = msg.reserve_funder_address;
        self.reserve_funder_bound = true;
    }

    receive(msg: BindMarketStabilityOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(23110, !self.official_ath_wallet_bound);
        throwUnless(23111, msg.official_ath_wallet_address == self.deriveOwnAthWalletAddress());
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: BindMarketStabilityTreasury) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(23120, !self.treasury_bound);
        throwUnless(23121, msg.ton_treasury_receiver_address != myAddress());
        throwUnless(23122, self.is_basechain_address(msg.ton_treasury_receiver_address));
        self.ton_treasury_receiver_address = msg.ton_treasury_receiver_address;
        self.treasury_bound = true;
    }

    receive(msg: FreezeMarketStabilityPricing) {
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(23130, !self.pricing_frozen);
        if (self.sealed) {
            throwUnless(23131, self.phase == MARKET_STABILITY_PHASE_IDLE);
            // clean-12 genesis-lock: the 60M reserve is funded + locked BEFORE the pricing freeze, so reserve_due_ath and
            // reserve_funded_total_ath are already at the cap here — the old 23132/23134 "reserve == 0 at freeze" checks
            // are intentionally dropped. Sales are gated on pricing_frozen (BuyMarketStabilityAth:388), so NO sale can
            // occur before this freeze regardless; the remaining checks confirm no sale/treasury/tranche activity ran
            // pre-freeze (always true pre-freeze, kept as belt-and-suspenders).
            throwUnless(23133, self.treasury_due_ton == 0);
            throwUnless(23135, self.sold_ath_total == 0);
            throwUnless(23139, self.completed_tranche_count == 0 && self.current_tranche_sold_ath == 0);
        }
        throwUnless(23136, msg.base_tranche_price_nanotons > 0);
        throwUnless(23137, msg.evidence_x1_tranche_quote_nanotons == msg.base_tranche_price_nanotons);
        throwUnless(23138, msg.pricing_evidence_hash != 0);
        self.base_tranche_price_nanotons = msg.base_tranche_price_nanotons;
        self.evidence_x1_tranche_quote_nanotons = msg.evidence_x1_tranche_quote_nanotons;
        self.pricing_evidence_hash = msg.pricing_evidence_hash;
        self.pricing_frozen = true;
        if (self.sealed) {
            self.genesis_config_hash = 0;
        }
    }

    receive(msg: SealMarketStabilityGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(23140, self.reserve_funder_bound);
        throwUnless(23141, self.official_ath_wallet_bound);
        throwUnless(23142, self.treasury_bound);
        if (self.pricing_frozen) {
            self.genesis_config_hash = 0;
        }
        self.sealed = true;
    }

    // clean-12: MSS reserve funding stays on Lane B (custom AthTransferNotification) — an INTERNAL, reserve_funder-driven
    // flow (custom ATHTransferRequestWithNotify), NOT DEX-facing, keeping the custom escrow's at-most-once/refund safety.
    // Only BuybackBurn (external STON.fi router) is on Lane A.
    //
    // clean-12 GENESIS-LOCK: funding NO LONGER requires pricing_frozen. The 60M market-maker reserve is committed +
    // locked at genesis (before the pool exists / the price is known), so it never sits under the owner's unilateral
    // control. It is cap-bounded (23205 = MARKET_STABILITY_TOTAL_RESERVE_ATH) + reserve_funder-gated (23203), and the
    // ONLY exit is BuyMarketStabilityAth (itself gated on pricing_frozen, :388) — there is NO owner-withdrawal path, so
    // once funded the reserve can only ever be sold via the rising-price tranche mechanism, never dumped.
    receive(msg: AthTransferNotification) {
        self.requireSealed();
        throwUnless(23201, sender() == self.official_ath_wallet_address);
        throwUnless(23202, msg.amount > 0);
        throwUnless(23203, msg.sender_wallet == self.reserve_funder_address);
        throwUnless(23204, context().value >= MARKET_STABILITY_ATH_NOTIFY_ACK_VALUE + MARKET_STABILITY_LOCAL_EXEC_RESERVE);
        throwUnless(23205, self.reserve_funded_total_ath + msg.amount <= MARKET_STABILITY_TOTAL_RESERVE_ATH);

        self.reserve_due_ath += msg.amount;
        self.reserve_funded_total_ath += msg.amount;

        message(MessageParameters {
            to: sender(),
            value: MARKET_STABILITY_ATH_NOTIFY_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: msg.query_id,
                sender_key: msg.sender_key,
                amount: msg.amount
            }.toCell()
        });
    }

    receive(msg: BuyMarketStabilityAth) {
        self.requireSealed();
        throwUnless(23210, self.pricing_frozen);
        throwUnless(23211, self.phase == MARKET_STABILITY_PHASE_IDLE);
        throwUnless(23212, msg.query_id > 0);
        self.requireNextQueryId(msg.query_id);
        throwUnless(23213, msg.amount > 0);
        throwUnless(23214, self.completed_tranche_count < MARKET_STABILITY_TRANCHE_COUNT);
        throwUnless(23215, msg.amount <= self.currentTrancheRemaining());
        throwUnless(23216, msg.amount <= self.reserve_due_ath);
        throwUnless(23217, self.is_basechain_address(msg.recipient));
        throwUnless(23219, msg.recipient != myAddress());

        let price: Int = self.quoteTonForAmount(msg.amount);
        let requiredValue: Int = price + MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE + MARKET_STABILITY_BUY_EXEC_RESERVE;
        throwUnless(23218, context().value >= requiredValue);

        let recipientWallet: Address = self.deriveAthWalletAddress(msg.recipient);
        self.reserve_due_ath -= msg.amount;
        self.phase = MARKET_STABILITY_PHASE_PENDING_ATH_TRANSFER;
        self.pending_query_id = msg.query_id;
        self.pending_amount_ath = msg.amount;
        self.pending_paid_ton = price;
        self.pending_buyer = sender();
        self.pending_recipient = msg.recipient;
        self.pending_recipient_ath_wallet = recipientWallet;

        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: ATHTransferRequest {
                query_id: msg.query_id,
                amount: msg.amount,
                recipient: msg.recipient,
                response_destination: myAddress()
            }.toCell()
        });

        self.refundTon(sender(), context().value - requiredValue);
    }

    receive(msg: ATHTransferAck) {
        self.requireSealed();
        throwUnless(23230, self.phase == MARKET_STABILITY_PHASE_PENDING_ATH_TRANSFER);
        throwUnless(23231, msg.query_id == self.pending_query_id);
        throwUnless(23232, msg.amount == self.pending_amount_ath);
        throwUnless(23233, sender() == self.pending_recipient_ath_wallet);
        self.finalizePendingSale();
    }

    receive(msg: ATHTransferFailed) {
        self.requireSealed();
        throwUnless(23240, sender() == self.official_ath_wallet_address);
        throwUnless(23241, self.phase == MARKET_STABILITY_PHASE_PENDING_ATH_TRANSFER);
        throwUnless(23242, msg.query_id == self.pending_query_id);
        throwUnless(23243, msg.amount == self.pending_amount_ath);
        self.failPendingSale();
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        self.requireSealed();
        throwUnless(23250, sender() == self.official_ath_wallet_address);
        throwUnless(23251, self.phase == MARKET_STABILITY_PHASE_PENDING_ATH_TRANSFER);
        throwUnless(23252, msg.query_id == self.pending_query_id);
        throwUnless(23253, msg.amount == self.pending_amount_ath);
        self.failPendingSale();
    }

    receive(msg: FlushMarketStabilityTreasuryTon) {
        self.requireSealed();
        throwUnless(23260, msg.amount > 0);
        throwUnless(23261, msg.amount <= self.treasury_due_ton);
        throwUnless(23263, msg.amount >= MARKET_STABILITY_MIN_TREASURY_FLUSH_TON || msg.amount == self.treasury_due_ton);
        throwUnless(23262, context().value >= MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE);
        self.treasury_due_ton -= msg.amount;
        self.treasury_flushed_ton_total += msg.amount;

        message(MessageParameters {
            to: self.ton_treasury_receiver_address,
            value: msg.amount,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: null
        });
    }

    receive(msg: MarketStabilityTopUpStorageReserve) {
        // Accept TON for storage reserve only. It is not buyer payment or treasury due.
    }

    receive() {
        throw(23999);
    }

    get fun get_market_stability_seller_config(): MarketStabilitySellerConfigView {
        return MarketStabilitySellerConfigView {
            sealed: self.sealed,
            reserve_funder_bound: self.reserve_funder_bound,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            treasury_bound: self.treasury_bound,
            pricing_frozen: self.pricing_frozen,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            ath_master_address: self.ath_master_address,
            reserve_funder_address: self.reserve_funder_address,
            official_ath_wallet_address: self.official_ath_wallet_address,
            ton_treasury_receiver_address: self.ton_treasury_receiver_address,
            base_tranche_price_nanotons: self.base_tranche_price_nanotons,
            evidence_x1_tranche_quote_nanotons: self.evidence_x1_tranche_quote_nanotons,
            pricing_evidence_hash: self.pricing_evidence_hash
        };
    }

    get fun get_market_stability_seller_state(): MarketStabilitySellerStateView {
        return MarketStabilitySellerStateView {
            phase: self.phase,
            reserve_due_ath: self.reserve_due_ath,
            treasury_due_ton: self.treasury_due_ton,
            pending_query_id: self.pending_query_id,
            pending_amount_ath: self.pending_amount_ath,
            pending_paid_ton: self.pending_paid_ton,
            pending_buyer: self.pending_buyer,
            pending_recipient: self.pending_recipient,
            pending_recipient_ath_wallet: self.pending_recipient_ath_wallet,
            completed_tranche_count: self.completed_tranche_count,
            current_tranche_sold_ath: self.current_tranche_sold_ath,
            current_multiplier: self.currentMultiplier(),
            current_tranche_remaining_ath: self.currentTrancheRemaining(),
            last_terminal_query_id: self.last_terminal_query_id
        };
    }

    get fun get_market_stability_seller_totals(): MarketStabilitySellerTotalsView {
        return MarketStabilitySellerTotalsView {
            reserve_funded_total_ath: self.reserve_funded_total_ath,
            sold_ath_total: self.sold_ath_total,
            treasury_flushed_ton_total: self.treasury_flushed_ton_total
        };
    }

    get fun get_official_ath_wallet_address(): Address {
        return self.deriveOwnAthWalletAddress();
    }

    get fun get_quote_ton_for_amount(amount: Int): Int {
        return self.quoteTonForAmount(amount);
    }
}
