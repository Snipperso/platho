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
const MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE: Int = 58000000; // F11/#3: 48M->58M (+10M) to match the ATHVesting/Vault ATH-transfer lanes' margin, widening the DOWNSTREAM recipient-hop slack (was ~20M-fwd_fee) so a multi-decade rise in config-25 forward fees cannot bounce the market-stability SELL leg. [CORRECTED 2026-08-01] The wallet's ATHTransferRequest floor is no longer 48M: gate 14204 is now ATH_OWNER_REQUEST_EXEC_RESERVE(2M)+ATH_INTERNAL_TRANSFER_ARRIVAL_MIN(29M)+ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE(8M) = 39,000,000, so the 58M forward satisfies it with 19M of headroom rather than 10M. Left at 58M deliberately, for the same reason it was raised: this leg sells the 60,000,000 ATH reserve over many years on an immutable contract. Buyers over-provide and are refunded the excess (no client lockstep; no PWA MSS-buy flow exists). Strict margin increase on an already fail-safe (bounce+refund) path.
const MARKET_STABILITY_BUY_EXEC_RESERVE: Int = 2000000;
const MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE: Int = 2000000;
const MARKET_STABILITY_MIN_TREASURY_FLUSH_TON: Int = MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE;
const MARKET_STABILITY_EXCESS_REFUND_MIN_VALUE: Int = 100000;
// THE SALE PRICE IS A CONSTANT, not a genesis input. The schedule was always in the code — 20 tranches of 3M ATH at
// multipliers x2..x21 — so the only free number was this anchor, and it is DERIVED, not chosen: the liquidity pool is
// 15M ATH against 15k GRAM, i.e. a 0.001 GRAM/ATH start price, so one tranche at x1 is 3M x 0.001 = 3000 GRAM.
// Check: the first tranche (x2) then costs base x 2 = 6000 GRAM for 3M ATH = 0.002 GRAM/ATH = exactly 2x start.
// Total across the schedule = base x (2+3+...+21) = 3000 x 230 = 690_000 GRAM.
//
// It used to be a one-shot runtime input from the genesis controller, and the checks meant to protect it were
// decorative: 23136 accepted any positive number and 23137 compared the caller's own two fields TO EACH OTHER (the
// "independent quote" was supplied by the same sender), so the contract would have accepted base = 1 — collapsing
// all 20 tranches to 230 nanotons for 60M ATH, 60% of supply. It was also symmetric: losing the single key meant the
// price could never be frozen and the 60M could never be sold at all, since sales gate on the freeze.
// As a constant there is no ceremony, no typo, no key, and no way to lock the reserve by losing one.
const MARKET_STABILITY_BASE_TRANCHE_PRICE: Int = 3000000000000;   // 3000 GRAM per tranche at multiplier x1

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
    pricing_frozen: Bool;          // always true: the price is frozen by being a constant
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    ath_master_address: Address;
    reserve_funder_address: Address;
    official_ath_wallet_address: Address;
    ton_treasury_receiver_address: Address;
    base_tranche_price_nanotons: Int;   // the constant, exposed so the ceremony can still verify it externally
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
    // no pricing_frozen field: the price is a constant, so there is no ceremony to record and no state that a
    // single key could ever set wrong. The views still report pricing_frozen = true, which is now simply the truth.
    sealed: Bool;
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
        self.sealed = false;
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
        throwUnless(23009, amount > 0);
        let remaining: Int = self.currentTrancheRemaining();
        throwUnless(23010, remaining > 0);
        throwUnless(23011, amount <= remaining);
        let numerator: Int = MARKET_STABILITY_BASE_TRANCHE_PRICE * self.currentMultiplier() * amount;
        return self.ceilDiv(numerator, MARKET_STABILITY_TRANCHE_ATH);
    }

    // [CHANGED 2026-07-29, wave-8 MED] Was `queryId == last_terminal_query_id + 1` — an EXACT number the buyer had to
    // read with a getter and then win a race to use. With the buy lane permissionless and only one sale in flight,
    // that made the whole 690,000 GRAM lane grievable for 60,000,001 nanoton a cycle: an observer watches for a
    // terminal, takes the one next number with a 1-unit dust buy (ceilDiv prices it at 1 nanoton), and every honest
    // buyer in that round bounces on 23013. Nobody lost money, but the lane was unusable for ~0.06 GRAM a turn.
    //
    // Monotonicity is what the sequence was actually FOR — it is what stops a terminal from being replayed against a
    // later sale — and `>` preserves it exactly. What it drops is the requirement to guess the number, so a buyer may
    // pick anything ahead of the last terminal (a timestamp, say) and no longer has an exact slot to be raced out of.
    // The single in-flight slot still exists, so a dust buy can still occupy it for one round trip; that costs the
    // attacker the same 60,000,001 and delays an honest buyer by seconds instead of bouncing them.
    fun requireNextQueryId(queryId: Int) {
        throwUnless(23012, queryId < UINT64_MAX);
        throwUnless(23013, queryId > self.last_terminal_query_id);
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

    receive(msg: SealMarketStabilityGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(23140, self.reserve_funder_bound);
        throwUnless(23141, self.official_ath_wallet_bound);
        throwUnless(23142, self.treasury_bound);
        // pricing needs no ceremony any more, so the config is complete the moment the binds are done
        self.genesis_config_hash = 0;
        self.sealed = true;
    }

    // clean-12: MSS reserve funding stays on Lane B (custom AthTransferNotification) — an INTERNAL, reserve_funder-driven
    // flow (custom ATHTransferRequestWithNotify), NOT DEX-facing, keeping the custom escrow's at-most-once/refund safety.
    // Only BuybackBurn (external STON.fi router) is on Lane A.
    //
    // clean-12 GENESIS-LOCK: funding NO LONGER requires pricing_frozen. The 60M market-maker reserve is committed +
    // locked at genesis (before the pool exists / the price is known), so it never sits under the owner's unilateral
    // control. It is cap-bounded (23205 = MARKET_STABILITY_TOTAL_RESERVE_ATH) + reserve_funder-gated (23203), and the
    // ONLY exit is BuyMarketStabilityAth — there is NO owner-withdrawal path, so
// [CORRECTED 2026-07-30, tier-2 audit] this used to say "itself gated on pricing_frozen, :388". There is no such
// gate and no such field any more: the price became a compile-time constant, so the check it named cannot exist.
// A stale line in a contract that can never be redeployed is read as the specification years later, so it is fixed
// rather than left; the PROPERTY it describes is unchanged and stronger — no ceremony can set the price wrong.
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

        // [ADDED 2026-07-29, wave-8 LOW] Give the caller's own value back, so it cannot fund the leg above.
        //
        // Flushing is permissionless, and 23262 only ever required the caller to SEND 2,000,000 while 23263 allowed
        // flushing exactly 2,000,000. At that ratio the inbound value covered the outbound leg exactly: the treasury
        // received its 2,000,000, treasury_due_ton fell by 2,000,000, and the contract's own nanotons never moved.
        // Repeat until the due hits zero, 23261 then forbids every further flush, and the real sale proceeds are
        // sealed inside a contract that has no other outgoing TON path at all. Nobody profits — the griefer pays the
        // treasury exactly what they strand — which is why looking for a motive would have missed it entirely.
        //
        // A balance check cannot catch this: money is fungible, so a contract that is over-funded relative to its due
        // looks identical to one that is correctly funded. Bounding the inbound value with a hard cap would catch it,
        // but a hard cap on an immutable contract is the more dangerous bug — one validator vote raising gas past the
        // cap and the entire proceeds are stranded for good, which is the very outcome being prevented. Returning the
        // change needs no cap and no ratio: what the caller sends, the caller gets back, so subsidy is not expressible.
        //
        // MEASURED, not assumed — SendRemainingValue after an explicit leg has drained a balance elsewhere in this
        // codebase (FeeAccumulator) and behaved correctly in another (ATHWallet), so MSTAB-07 asserts the contract's
        // balance falls by the flushed amount and no more, with the caller made whole.
        message(MessageParameters {
            to: sender(),
            value: 0,
            bounce: false,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: null
        });
    }

    receive(msg: MarketStabilityTopUpStorageReserve) {
        // Accept TON for storage reserve only. It is not buyer payment or treasury due.
    }

    // [ADDED 2026-08-01] Change from the sale leg. This contract is its own response_destination, so the surplus
    // ATHWallet now returns lands here; without a receiver every sale left a failed transaction behind (exit 130,
    // value still credited). Deliberately NOT counted as treasury due or buyer payment — it is unspent gas coming
    // back, and FlushMarketStabilityTreasuryTon is what moves the contract's TON on.
    receive(_: ATHTransferExcess) {
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
            pricing_frozen: true,   // frozen by construction: the price is a constant, not a stored input
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            ath_master_address: self.ath_master_address,
            reserve_funder_address: self.reserve_funder_address,
            official_ath_wallet_address: self.official_ath_wallet_address,
            ton_treasury_receiver_address: self.ton_treasury_receiver_address,
            base_tranche_price_nanotons: MARKET_STABILITY_BASE_TRANCHE_PRICE
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
