// Platho v1 production BuybackBurn address-stable candidate.
// Scope: pre-seal FeeAccumulator / official ATH wallet binding, one-time STON.fi route binding,
// exact M19H funding envelope intake, route execution state, ATH receipt auth,
// and ATH burn finalization through ATHMaster.
// No admin/owner override/pause/upgrade/governance/rescue behavior is implemented.
// Empty fallback only records authenticated STON.fi route refund/excess senders.

import "./ATHWallet.tact";

const BUYBACK_OFFER_AMOUNT_NANOTONS: Int = 50000000000;
const BUYBACK_ROUTE_FORWARD_GAS_NANOTONS: Int = 1000000000;
const BUYBACK_PTON_TRANSFER_GAS_NANOTONS: Int = 50000000;
const BUYBACK_FUNDING_ENVELOPE_NANOTONS: Int = 51050000000;
const BUYBACK_ATH_NOTIFY_ACK_VALUE: Int = 1000000;
const BUYBACK_ATH_BURN_REQUEST_VALUE: Int = 30000000;
const BUYBACK_ROUTE_NOTIFY_MIN_VALUE: Int = 35000000;
const BUYBACK_ROUTE_ATH_NOTIFY_FORWARD_GAS_NANOTONS: Int = 40000000;
const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE: Int = 2000000;
const BUYBACK_ACCOUNTING_RECYCLE_EXEC_RESERVE: Int = 2000000;
const BUYBACK_ROUTE_REFUND_EXEC_RESERVE: Int = 2000000;
const BUYBACK_ROUTE_REFUND_RECOVERY_EXEC_RESERVE: Int = 2000000;
const BUYBACK_DEADLINE_MAX_AHEAD_SECONDS: Int = 900;
const BUYBACK_ROUTE_REFUND_RECOVERY_GRACE_SECONDS: Int = 900;
const BUYBACK_ROUTE_REFUND_RECOVERY_MIN_NANOTONS: Int = 49000000000;
const BUYBACK_PHASE_IDLE: Int = 0;
const BUYBACK_PHASE_PENDING_STONFI_SWAP: Int = 1;
const BUYBACK_PHASE_PENDING_ATH_BURN: Int = 2;
const UINT64_MAX: Int = 18446744073709551615;
const STONFI_V2_1_DEX_OP_SWAP: Int = 0x6664de2a;
const STONFI_V2_1_PTON_OP_TON_TRANSFER: Int = 0x01f3835d;
const BUYBACK_ROUTE_NOTIFY_PAYLOAD_DOMAIN: Int = 0x42594E46; // "BYNF"

message(0x594BA505) AcceptBurnReserve {
    amount: Int as uint128;
}

message(0x42594641) BindBuybackFeeAccumulator { // "BYFA"
    deployment_manifest_hash: Int as uint256;
    fee_accumulator_address: Address;
}

message(0x42594157) BindBuybackOfficialAthWallet { // "BYAW"
    deployment_manifest_hash: Int as uint256;
    official_ath_wallet_address: Address;
}

message(0x42595246) FreezeBuybackRoute { // "BYRF"
    deployment_manifest_hash: Int as uint256;
    stonfi_router_address: Address;
    stonfi_pool_address_ton_ath: Address;
    stonfi_pton_wallet_address: Address;
    ask_jetton_wallet_address: Address;
    stonfi_referral_address: Address;
    referral_value_bps: Int as uint16;
    buyback_min_ath_out_per_50_ton_atomic: Int as uint128;
    evidence_quote_out_atomic_ath: Int as uint128;
    evidence_dex_min_out_atomic_ath: Int as uint128;
    route_evidence_hash: Int as uint256;
}

message(0x4259534C) SealBuybackBurnGenesis { // "BYSL"
    deployment_manifest_hash: Int as uint256;
}

message(0x42594558) ExecuteBuybackChunk { // "BYEX"
    query_id: Int as uint64;
    quote_out_atomic_ath: Int as uint128;
    dex_min_out_atomic_ath: Int as uint128;
}

message(0x42595254) RetryAthBurnDue { // "BYRT"
    query_id: Int as uint64;
    amount: Int as uint128;
}

message(0x42595243) RecoverStonfiRouteRefund { // "BYRC"
    query_id: Int as uint64;
}

message(0x42595252) RecycleRouteRefundReserve {} // "BYRR"

message(0x906182D2) TopUpStorageReserve {}

// Prefix-compatible with STON.fi pTON v2.1 TON transfer body for bounce recovery.
message(0x01f3835d) StonfiPtonTonTransferBounce {
    query_id: Int as uint64;
    ton_amount: Int as coins;
}

struct BuybackBurnConfigView {
    sealed: Bool;
    fee_bound: Bool;
    official_ath_wallet_bound: Bool;
    route_frozen: Bool;
    deployment_manifest_hash: Int;
    genesis_config_hash: Int;
    ath_master_address: Address;
    fee_accumulator_address: Address;
    official_ath_wallet_address: Address;
    stonfi_router_address: Address;
    stonfi_pool_address_ton_ath: Address;
    stonfi_pton_wallet_address: Address;
    ask_jetton_wallet_address: Address;
    stonfi_referral_address: Address;
    referral_value_bps: Int;
    buyback_min_ath_out_per_50_ton_atomic: Int;
    evidence_quote_out_atomic_ath: Int;
    evidence_dex_min_out_atomic_ath: Int;
    route_evidence_hash: Int;
}

struct BuybackBurnStateView {
    phase: Int;
    reserve_due_ton: Int;
    pending_query_id: Int;
    pending_deadline: Int;
    pending_route_refund_start_ton: Int;
    pending_dex_min_out_atomic_ath: Int;
    pending_received_ath_atomic: Int;
    route_refund_due_ton: Int;
    ath_burn_retry_due_atomic: Int;
    last_terminal_query_id: Int;
}

struct BuybackBurnTotalsView {
    accepted_reserve_count: Int;
    executed_buyback_count: Int;
    burned_ath_total_atomic: Int;
}

contract BuybackBurn {
    genesis_config_hash: Int as uint256;
    deployment_manifest_hash: Int as uint256;
    ath_master_address: Address;
    fee_accumulator_address: Address;
    official_ath_wallet_address: Address;
    stonfi_router_address: Address;
    stonfi_pool_address_ton_ath: Address;
    stonfi_pton_wallet_address: Address;
    ask_jetton_wallet_address: Address;
    stonfi_referral_address: Address;
    fee_bound: Bool;
    official_ath_wallet_bound: Bool;
    route_frozen: Bool;
    sealed: Bool;
    referral_value_bps: Int as uint16;
    buyback_min_ath_out_per_50_ton_atomic: Int as uint128;
    evidence_quote_out_atomic_ath: Int as uint128;
    evidence_dex_min_out_atomic_ath: Int as uint128;
    route_evidence_hash: Int as uint256;
    phase: Int as uint8;
    reserve_due_ton: Int as uint128;
    pending_query_id: Int as uint64;
    pending_deadline: Int as uint64;
    pending_route_refund_start_ton: Int as uint128;
    pending_dex_min_out_atomic_ath: Int as uint128;
    pending_received_ath_atomic: Int as uint128;
    route_refund_due_ton: Int as uint128;
    ath_burn_retry_due_atomic: Int as uint128;
    last_terminal_query_id: Int as uint64;
    accepted_reserve_count: Int as uint64;
    executed_buyback_count: Int as uint64;
    burned_ath_total_atomic: Int as uint128;

    init(genesis_config_hash: Int, ath_master_address: Address) {
        throwUnless(22000, genesis_config_hash != 0);
        self.genesis_config_hash = genesis_config_hash;
        self.deployment_manifest_hash = 0;
        self.ath_master_address = ath_master_address;
        self.fee_accumulator_address = ath_master_address;
        self.official_ath_wallet_address = ath_master_address;
        self.stonfi_router_address = ath_master_address;
        self.stonfi_pool_address_ton_ath = ath_master_address;
        self.stonfi_pton_wallet_address = ath_master_address;
        self.ask_jetton_wallet_address = ath_master_address;
        self.stonfi_referral_address = ath_master_address;
        self.fee_bound = false;
        self.official_ath_wallet_bound = false;
        self.route_frozen = false;
        self.sealed = false;
        self.referral_value_bps = 0;
        self.buyback_min_ath_out_per_50_ton_atomic = 0;
        self.evidence_quote_out_atomic_ath = 0;
        self.evidence_dex_min_out_atomic_ath = 0;
        self.route_evidence_hash = 0;
        self.phase = BUYBACK_PHASE_IDLE;
        self.reserve_due_ton = 0;
        self.pending_query_id = 0;
        self.pending_deadline = 0;
        self.pending_route_refund_start_ton = 0;
        self.pending_dex_min_out_atomic_ath = 0;
        self.pending_received_ath_atomic = 0;
        self.route_refund_due_ton = 0;
        self.ath_burn_retry_due_atomic = 0;
        self.last_terminal_query_id = 0;
        self.accepted_reserve_count = 0;
        self.executed_buyback_count = 0;
        self.burned_ath_total_atomic = 0;
    }

    fun requireUnsealed() {
        throwUnless(22001, !self.sealed);
    }

    fun requireSealed() {
        throwUnless(22002, self.sealed);
    }

    fun requireGenesisController() {
        throwUnless(22003, self.genesis_config_hash != 0);
        throwUnless(22004, beginCell().storeAddress(sender()).endCell().hash() == self.genesis_config_hash);
    }

    fun deriveAthWalletAddress(owner: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    fun deriveOwnAthWalletAddress(): Address {
        return self.deriveAthWalletAddress(myAddress());
    }

    fun isBasechainAddress(address: Address): Bool {
        let std: StdAddress = parseStdAddress(address.asSlice());
        return std.workchain == 0;
    }

    fun acceptManifestHash(hash: Int) {
        throwUnless(22005, hash > 1);
        throwUnless(22006, self.deployment_manifest_hash == 0 || self.deployment_manifest_hash == hash);
        self.deployment_manifest_hash = hash;
    }

    fun validateMinOut(quoteOut: Int, dexMinOut: Int) {
        throwUnless(22040, quoteOut > 0);
        throwUnless(22041, dexMinOut >= self.buyback_min_ath_out_per_50_ton_atomic);
        throwUnless(22042, dexMinOut >= (quoteOut * 95) / 100);
        throwUnless(22043, dexMinOut <= quoteOut);
    }

    fun requireFrozenExecutionQuote(quoteOut: Int, dexMinOut: Int) {
        self.validateMinOut(quoteOut, dexMinOut);
        throwUnless(22046, quoteOut == self.evidence_quote_out_atomic_ath);
        throwUnless(22047, dexMinOut == self.evidence_dex_min_out_atomic_ath);
    }

    fun requireNextQueryId(queryId: Int) {
        throwUnless(22045, queryId < UINT64_MAX);
        throwUnless(22044, queryId == self.last_terminal_query_id + 1);
    }

    fun recordTerminalQueryId(queryId: Int) {
        self.last_terminal_query_id = queryId;
    }

    fun stonfiRouteNotifyPayload(queryId: Int): Cell {
        return beginCell()
            .storeUint(BUYBACK_ROUTE_NOTIFY_PAYLOAD_DOMAIN, 32)
            .storeUint(queryId, 64)
            .endCell();
    }

    fun stonfiSwapPayload(queryId: Int, deadline: Int, dexMinOut: Int): Cell {
        let details: Cell = beginCell()
            .storeCoins(dexMinOut)
            .storeAddress(self.official_ath_wallet_address)
            .storeCoins(BUYBACK_ROUTE_ATH_NOTIFY_FORWARD_GAS_NANOTONS)
            .storeBit(true)
            .storeRef(self.stonfiRouteNotifyPayload(queryId))
            .storeCoins(0)
            .storeBit(false)
            .storeUint(self.referral_value_bps, 16)
            .storeAddress(self.stonfi_referral_address)
            .endCell();

        return beginCell()
            .storeUint(STONFI_V2_1_DEX_OP_SWAP, 32)
            .storeAddress(self.ask_jetton_wallet_address)
            .storeAddress(myAddress())
            .storeAddress(myAddress())
            .storeUint(deadline, 64)
            .storeRef(details)
            .endCell();
    }

    fun ptonTonTransferBody(queryId: Int, deadline: Int, dexMinOut: Int): Cell {
        let payload: Cell = self.stonfiSwapPayload(queryId, deadline, dexMinOut);
        return beginCell()
            .storeUint(STONFI_V2_1_PTON_OP_TON_TRANSFER, 32)
            .storeUint(queryId, 64)
            .storeCoins(BUYBACK_OFFER_AMOUNT_NANOTONS)
            .storeAddress(myAddress())
            .storeBit(true)
            .storeRef(payload)
            .endCell();
    }

    fun clearPending() {
        self.phase = BUYBACK_PHASE_IDLE;
        self.pending_query_id = 0;
        self.pending_deadline = 0;
        self.pending_route_refund_start_ton = 0;
        self.pending_dex_min_out_atomic_ath = 0;
        self.pending_received_ath_atomic = 0;
    }

    fun finishPendingCycle() {
        let queryId: Int = self.pending_query_id;
        self.clearPending();
        self.recordTerminalQueryId(queryId);
    }

    fun creditRouteRefundValue(value: Int) {
        if (value <= BUYBACK_ROUTE_REFUND_EXEC_RESERVE) {
            return;
        }
        self.route_refund_due_ton += value - BUYBACK_ROUTE_REFUND_EXEC_RESERVE;
    }

    fun creditRouteNotifySurplus(value: Int, reservedValue: Int) {
        if (value <= reservedValue) {
            return;
        }
        self.route_refund_due_ton += value - reservedValue;
    }

    fun sendAthBurn(queryId: Int, amount: Int) {
        message(MessageParameters {
            to: self.official_ath_wallet_address,
            value: BUYBACK_ATH_BURN_REQUEST_VALUE,
            bounce: true,
            mode: SendDefaultMode,
            body: ATHBurn {
                query_id: queryId,
                amount,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: BindBuybackFeeAccumulator) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(22100, !self.fee_bound);
        throwUnless(22101, msg.fee_accumulator_address != myAddress());
        self.fee_accumulator_address = msg.fee_accumulator_address;
        self.fee_bound = true;
    }

    receive(msg: BindBuybackOfficialAthWallet) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(22110, !self.official_ath_wallet_bound);
        throwUnless(22111, msg.official_ath_wallet_address == self.deriveOwnAthWalletAddress());
        self.official_ath_wallet_address = msg.official_ath_wallet_address;
        self.official_ath_wallet_bound = true;
    }

    receive(msg: FreezeBuybackRoute) {
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(22120, !self.route_frozen);
        if (self.sealed) {
            throwUnless(22125, self.phase == BUYBACK_PHASE_IDLE);
            throwUnless(22126, self.reserve_due_ton == 0);
            throwUnless(22127, self.route_refund_due_ton == 0);
            throwUnless(22128, self.ath_burn_retry_due_atomic == 0);
            throwUnless(22129, self.accepted_reserve_count == 0);
        }
        throwUnless(22121, msg.buyback_min_ath_out_per_50_ton_atomic > 0);
        throwUnless(22122, msg.route_evidence_hash != 0);
        throwUnless(22123, msg.referral_value_bps <= 100);
        throwUnless(22124, self.isBasechainAddress(msg.ask_jetton_wallet_address));
        self.buyback_min_ath_out_per_50_ton_atomic = msg.buyback_min_ath_out_per_50_ton_atomic;
        self.validateMinOut(msg.evidence_quote_out_atomic_ath, msg.evidence_dex_min_out_atomic_ath);
        self.stonfi_router_address = msg.stonfi_router_address;
        self.stonfi_pool_address_ton_ath = msg.stonfi_pool_address_ton_ath;
        self.stonfi_pton_wallet_address = msg.stonfi_pton_wallet_address;
        self.ask_jetton_wallet_address = msg.ask_jetton_wallet_address;
        self.stonfi_referral_address = msg.stonfi_referral_address;
        self.referral_value_bps = msg.referral_value_bps;
        self.evidence_quote_out_atomic_ath = msg.evidence_quote_out_atomic_ath;
        self.evidence_dex_min_out_atomic_ath = msg.evidence_dex_min_out_atomic_ath;
        self.route_evidence_hash = msg.route_evidence_hash;
        self.route_frozen = true;
        if (self.sealed) {
            self.genesis_config_hash = 0;
        }
    }

    receive(msg: SealBuybackBurnGenesis) {
        self.requireUnsealed();
        self.requireGenesisController();
        self.acceptManifestHash(msg.deployment_manifest_hash);
        throwUnless(22130, self.fee_bound);
        throwUnless(22131, self.official_ath_wallet_bound);
        if (self.route_frozen) {
            self.genesis_config_hash = 0;
        }
        self.sealed = true;
    }

    receive(msg: AcceptBurnReserve) {
        self.requireSealed();
        throwUnless(22200, self.route_frozen);
        throwUnless(22201, sender() == self.fee_accumulator_address);
        throwUnless(22202, msg.amount == BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        throwUnless(22203, context().value >= msg.amount + BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE);
        self.reserve_due_ton += msg.amount;
        self.accepted_reserve_count += 1;
    }

    receive(msg: ExecuteBuybackChunk) {
        self.requireSealed();
        throwUnless(22210, self.route_frozen);
        throwUnless(22211, self.phase == BUYBACK_PHASE_IDLE);
        throwUnless(22212, self.reserve_due_ton >= BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        throwUnless(22213, msg.query_id > 0);
        self.requireNextQueryId(msg.query_id);
        throwUnless(22216, context().value >= BUYBACK_PTON_TRANSFER_GAS_NANOTONS);
        self.requireFrozenExecutionQuote(msg.quote_out_atomic_ath, msg.dex_min_out_atomic_ath);
        // Permissionless callers cannot choose a near-expired STON.fi route deadline.
        let routeDeadline: Int = now() + BUYBACK_DEADLINE_MAX_AHEAD_SECONDS;

        self.reserve_due_ton -= BUYBACK_FUNDING_ENVELOPE_NANOTONS;
        self.phase = BUYBACK_PHASE_PENDING_STONFI_SWAP;
        self.pending_query_id = msg.query_id;
        self.pending_deadline = routeDeadline;
        self.pending_route_refund_start_ton = self.route_refund_due_ton;
        self.pending_dex_min_out_atomic_ath = msg.dex_min_out_atomic_ath;
        self.pending_received_ath_atomic = 0;

        message(MessageParameters {
            to: self.stonfi_pton_wallet_address,
            value: BUYBACK_FUNDING_ENVELOPE_NANOTONS,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: self.ptonTonTransferBody(msg.query_id, routeDeadline, msg.dex_min_out_atomic_ath)
        });
    }

    receive(msg: AthTransferNotification) {
        self.requireSealed();
        throwUnless(22300, sender() == self.official_ath_wallet_address);
        throwUnless(22301, self.phase == BUYBACK_PHASE_PENDING_STONFI_SWAP);
        throwUnless(22302, msg.query_id == self.pending_query_id);
        throwUnless(22303, msg.amount >= self.pending_dex_min_out_atomic_ath);
        throwUnless(22304, msg.sender_wallet == self.stonfi_pool_address_ton_ath);
        throwUnless(22305, context().value >= BUYBACK_ATH_NOTIFY_ACK_VALUE);

        if (context().value < BUYBACK_ROUTE_NOTIFY_MIN_VALUE) {
            message(MessageParameters {
                to: sender(),
                value: BUYBACK_ATH_NOTIFY_ACK_VALUE,
                bounce: false,
                mode: SendDefaultMode,
                body: AthTransferNotificationAck {
                    query_id: msg.query_id,
                    sender_key: msg.sender_key,
                    amount: msg.amount
                }.toCell()
            });

            self.creditRouteNotifySurplus(
                context().value,
                BUYBACK_ATH_NOTIFY_ACK_VALUE + BUYBACK_ROUTE_REFUND_EXEC_RESERVE
            );
            self.ath_burn_retry_due_atomic += msg.amount;
            self.finishPendingCycle();
            return;
        }

        self.phase = BUYBACK_PHASE_PENDING_ATH_BURN;
        self.pending_received_ath_atomic = msg.amount;
        self.creditRouteNotifySurplus(context().value, BUYBACK_ROUTE_NOTIFY_MIN_VALUE);

        message(MessageParameters {
            to: sender(),
            value: BUYBACK_ATH_NOTIFY_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: msg.query_id,
                sender_key: msg.sender_key,
                amount: msg.amount
            }.toCell()
        });

        self.sendAthBurn(msg.query_id, msg.amount);
    }

    receive(msg: ATHBurnFinalized) {
        self.requireSealed();
        throwUnless(22320, sender() == self.ath_master_address);
        throwUnless(22321, self.phase == BUYBACK_PHASE_PENDING_ATH_BURN);
        throwUnless(22322, msg.query_id == self.pending_query_id);
        throwUnless(22323, msg.amount == self.pending_received_ath_atomic);
        throwUnless(22324, msg.owner_address == myAddress());

        self.burned_ath_total_atomic += msg.amount;
        self.executed_buyback_count += 1;
        self.finishPendingCycle();
    }

    receive(msg: ATHBurnFailed) {
        self.requireSealed();
        throwUnless(22330, sender() == self.official_ath_wallet_address);
        throwUnless(22331, self.phase == BUYBACK_PHASE_PENDING_ATH_BURN);
        throwUnless(22332, msg.query_id == self.pending_query_id);
        throwUnless(22333, msg.amount == self.pending_received_ath_atomic);

        self.ath_burn_retry_due_atomic += msg.amount;
        self.finishPendingCycle();
    }

    receive(msg: RetryAthBurnDue) {
        self.requireSealed();
        throwUnless(22340, self.phase == BUYBACK_PHASE_IDLE);
        throwUnless(22341, msg.query_id > 0);
        self.requireNextQueryId(msg.query_id);
        throwUnless(22342, msg.amount > 0);
        throwUnless(22343, msg.amount == self.ath_burn_retry_due_atomic);
        throwUnless(22344, context().value >= BUYBACK_ATH_BURN_REQUEST_VALUE + BUYBACK_ROUTE_REFUND_EXEC_RESERVE);

        self.ath_burn_retry_due_atomic -= msg.amount;
        self.phase = BUYBACK_PHASE_PENDING_ATH_BURN;
        self.pending_query_id = msg.query_id;
        self.pending_dex_min_out_atomic_ath = msg.amount;
        self.pending_received_ath_atomic = msg.amount;
        self.sendAthBurn(msg.query_id, msg.amount);
    }

    receive(msg: RecoverStonfiRouteRefund) {
        self.requireSealed();
        throwUnless(22354, context().value >= BUYBACK_ROUTE_REFUND_RECOVERY_EXEC_RESERVE);
        throwUnless(22350, self.phase == BUYBACK_PHASE_PENDING_STONFI_SWAP);
        throwUnless(22351, msg.query_id == self.pending_query_id);
        throwUnless(22352, self.route_refund_due_ton >= self.pending_route_refund_start_ton + BUYBACK_ROUTE_REFUND_RECOVERY_MIN_NANOTONS);
        throwUnless(22353, now() > self.pending_deadline + BUYBACK_ROUTE_REFUND_RECOVERY_GRACE_SECONDS);
        self.finishPendingCycle();
    }

    receive(msg: RecycleRouteRefundReserve) {
        self.requireSealed();
        throwUnless(22363, self.route_frozen);
        throwUnless(22360, self.phase == BUYBACK_PHASE_IDLE);
        throwUnless(22362, context().value >= BUYBACK_ACCOUNTING_RECYCLE_EXEC_RESERVE);
        let callerTopUp: Int = context().value - BUYBACK_ACCOUNTING_RECYCLE_EXEC_RESERVE;
        let recycleAvailable: Int = self.route_refund_due_ton + callerTopUp;
        throwUnless(22361, recycleAvailable >= BUYBACK_FUNDING_ENVELOPE_NANOTONS);
        self.route_refund_due_ton = recycleAvailable - BUYBACK_FUNDING_ENVELOPE_NANOTONS;
        self.reserve_due_ton += BUYBACK_FUNDING_ENVELOPE_NANOTONS;
    }

    bounced(msg: bounced<StonfiPtonTonTransferBounce>) {
        self.requireSealed();
        throwUnless(22400, sender() == self.stonfi_pton_wallet_address);
        throwUnless(22401, self.phase == BUYBACK_PHASE_PENDING_STONFI_SWAP);
        throwUnless(22402, msg.query_id == self.pending_query_id);
        throwUnless(22403, msg.ton_amount == BUYBACK_OFFER_AMOUNT_NANOTONS);
        self.creditRouteRefundValue(context().value);
        self.finishPendingCycle();
    }

    bounced(msg: bounced<ATHBurn>) {
        self.requireSealed();
        throwUnless(22410, sender() == self.official_ath_wallet_address);
        throwUnless(22411, self.phase == BUYBACK_PHASE_PENDING_ATH_BURN);
        throwUnless(22412, msg.query_id == self.pending_query_id);
        throwUnless(22413, msg.amount == self.pending_received_ath_atomic);
        self.ath_burn_retry_due_atomic += msg.amount;
        self.finishPendingCycle();
    }

    receive(msg: TopUpStorageReserve) {
        // Accept TON for BuybackBurn storage reserve only. It is not route refund or protocol reserve.
    }

    receive() {
        if (self.sealed && self.route_frozen) {
            if (sender() == self.stonfi_pton_wallet_address || sender() == self.stonfi_router_address || sender() == self.stonfi_pool_address_ton_ath) {
                self.creditRouteRefundValue(context().value);
                return;
            }
        }
        throw(22999);
    }

    get fun get_buyback_burn_config(): BuybackBurnConfigView {
        return BuybackBurnConfigView {
            sealed: self.sealed,
            fee_bound: self.fee_bound,
            official_ath_wallet_bound: self.official_ath_wallet_bound,
            route_frozen: self.route_frozen,
            deployment_manifest_hash: self.deployment_manifest_hash,
            genesis_config_hash: self.genesis_config_hash,
            ath_master_address: self.ath_master_address,
            fee_accumulator_address: self.fee_accumulator_address,
            official_ath_wallet_address: self.official_ath_wallet_address,
            stonfi_router_address: self.stonfi_router_address,
            stonfi_pool_address_ton_ath: self.stonfi_pool_address_ton_ath,
            stonfi_pton_wallet_address: self.stonfi_pton_wallet_address,
            ask_jetton_wallet_address: self.ask_jetton_wallet_address,
            stonfi_referral_address: self.stonfi_referral_address,
            referral_value_bps: self.referral_value_bps,
            buyback_min_ath_out_per_50_ton_atomic: self.buyback_min_ath_out_per_50_ton_atomic,
            evidence_quote_out_atomic_ath: self.evidence_quote_out_atomic_ath,
            evidence_dex_min_out_atomic_ath: self.evidence_dex_min_out_atomic_ath,
            route_evidence_hash: self.route_evidence_hash
        };
    }

    get fun get_buyback_burn_state(): BuybackBurnStateView {
        return BuybackBurnStateView {
            phase: self.phase,
            reserve_due_ton: self.reserve_due_ton,
            pending_query_id: self.pending_query_id,
            pending_deadline: self.pending_deadline,
            pending_route_refund_start_ton: self.pending_route_refund_start_ton,
            pending_dex_min_out_atomic_ath: self.pending_dex_min_out_atomic_ath,
            pending_received_ath_atomic: self.pending_received_ath_atomic,
            route_refund_due_ton: self.route_refund_due_ton,
            ath_burn_retry_due_atomic: self.ath_burn_retry_due_atomic,
            last_terminal_query_id: self.last_terminal_query_id
        };
    }

    get fun get_buyback_burn_totals(): BuybackBurnTotalsView {
        return BuybackBurnTotalsView {
            accepted_reserve_count: self.accepted_reserve_count,
            executed_buyback_count: self.executed_buyback_count,
            burned_ath_total_atomic: self.burned_ath_total_atomic
        };
    }

    get fun get_official_ath_wallet_address(): Address {
        return self.deriveOwnAthWalletAddress();
    }
}
