
const AIRDROP_TOTAL_POOL: Int = 15000000000000000;
const AIRDROP_ATH_PER_CREDIT: Int = 10000000000;
const AIRDROP_MAX_CREDITS_PER_ACCRUAL: Int = 1000;
const AIRDROP_BASE_STORAGE_ENDOWMENT: Int = 100000000;
const AIRDROP_NOTIFICATION_ACK_VALUE: Int = 1000000;
const AIRDROP_ATHWALLET_LEG_GAS: Int = 50000000;
const AIRDROP_PAYOUT_PATH_GAS: Int = 60000000;
const AIRDROP_SWEEP_GRACE: Int = 315360000;
const AIRDROP_SWEEP_INACTIVITY: Int = 31536000;

message(0x41445201) AirdropBindAthMaster {
    ath_master_address: Address;
    pool_ath_wallet_address: Address;
}

message(0x41445202) AirdropBindCreditIssuer {
    credit_issuer_address: Address;
}

message(0x41445239) AirdropRebindCreditIssuer {
    deployment_manifest_hash: Int as uint256;
    credit_issuer_address: Address;
}

message(0x41445203) AirdropBindTreasury {
    treasury_address: Address;
}

message(0x41445204) AirdropSealGenesis {
    deployment_manifest_hash: Int as uint256;
}

message(0x41445210) AirdropAccrue {
    purchase_id: Int as uint64;
    buyer: Address;
    credits_k: Int as uint32;
}

message(0x41445211) AirdropTopUpStorageReserve {}

message(0x41445212) AirdropSweepResidualToTreasury {}

message(0x41445213) AirdropSweepUnaccountedTon {}

message(0x4154481F) ATHTransferExcess {
    query_id: Int as uint64;
}

message(0x41544810) ATHTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

message(0x472D9D7D) AthTransferNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    sender_wallet: Address;
}

message(0x472D9D7E) AthTransferNotificationAck {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_key: Int as uint160;
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
    funded_amount: Int;
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
    deployment_id: Int as uint32;

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
    last_accrual_at: Int as uint64;

    init(genesis_controller_address: Address, deployment_manifest_hash: Int, genesis_config_hash: Int, sealed: Bool, deployment_id: Int) {
        self.sealed = sealed;
        self.genesis_controller_address = genesis_controller_address;
        self.deployment_manifest_hash = deployment_manifest_hash;
        self.genesis_config_hash = genesis_config_hash;
        self.deployment_id = deployment_id;
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
        self.last_accrual_at = 0;
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

    fun isBasechainAddress(a: Address): Bool {
        let s: Slice = a.asSlice();
        return s.loadUint(11) == 1024;
    }

    fun protectedReserve(): Int {
        return AIRDROP_BASE_STORAGE_ENDOWMENT;
    }


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

    receive(msg: AirdropRebindCreditIssuer) {
        self.requireSealed();
        self.requireController();
        throwUnless(26013, msg.deployment_manifest_hash == self.deployment_manifest_hash);
        throwUnless(26014, self.credit_issuer_bound);
        throwUnless(26015, self.isBasechainAddress(msg.credit_issuer_address));
        throwUnless(26016, msg.credit_issuer_address != myAddress());
        self.credit_issuer_address = msg.credit_issuer_address;
    }

    receive(msg: AthTransferNotification) {
        self.requireUnsealed();
        throwUnless(26011, self.ath_master_bound);
        throwUnless(26019, sender() == self.pool_ath_wallet_address);
        self.funded_amount = self.funded_amount + msg.amount;
        self.remaining_budget = self.remaining_budget + msg.amount;

        message(MessageParameters {
            to: sender(),
            value: AIRDROP_NOTIFICATION_ACK_VALUE,
            bounce: false,
            mode: SendDefaultMode,
            body: AthTransferNotificationAck {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_key: msg.sender_key
            }.toCell()
        });
    }

    receive(msg: AirdropSealGenesis) {
        self.requireUnsealed();
        self.requireController();
        throwUnless(26040, msg.deployment_manifest_hash > 1);
        throwUnless(26041, self.ath_master_bound);
        throwUnless(26042, self.credit_issuer_bound);
        throwUnless(26043, self.treasury_bound);
        throwUnless(26044, self.funded_amount >= AIRDROP_TOTAL_POOL);
        if (self.remaining_budget > AIRDROP_TOTAL_POOL) {
            self.remaining_budget = AIRDROP_TOTAL_POOL;
        }
        self.deployment_manifest_hash = msg.deployment_manifest_hash;
        self.sealed = true;
        self.sealed_at = now();
    }


    receive(msg: AirdropAccrue) {
        self.requireSealed();
        throwUnless(26110, sender() == self.credit_issuer_address);
        throwUnless(26111, self.isBasechainAddress(msg.buyer));
        throwUnless(26112, (msg.credits_k >= 1) && (msg.credits_k <= AIRDROP_MAX_CREDITS_PER_ACCRUAL));

        let payout: Int = msg.credits_k * AIRDROP_ATH_PER_CREDIT;
        if (self.remaining_budget < payout) {
            payout = (self.remaining_budget / AIRDROP_ATH_PER_CREDIT) * AIRDROP_ATH_PER_CREDIT;
            if (payout == 0) {
                return;
            }
        }
        throwUnless(26114, context().value >= AIRDROP_PAYOUT_PATH_GAS);

        self.remaining_budget = self.remaining_budget - payout;
        self.distributed_total = self.distributed_total + payout;
        self.claim_count = self.claim_count + 1;
        self.payout_seq = self.payout_seq + 1;
        self.last_accrual_at = now();

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
    }

    receive(_: ATHTransferExcess) {
    }

    receive(_: AirdropSweepResidualToTreasury) {
        self.requireSealed();
        throwUnless(26140, now() >= (self.sealed_at + AIRDROP_SWEEP_GRACE));
        throwUnless(26143, now() >= (self.last_accrual_at + AIRDROP_SWEEP_INACTIVITY));
        throwUnless(26141, self.remaining_budget > 0);
        let residual: Int = self.remaining_budget;
        self.remaining_budget = 0;
        self.payout_seq = self.payout_seq + 1;

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

    receive(_: AirdropSweepUnaccountedTon) {
        self.requireSealed();
        throwUnless(26150, self.treasury_bound);
        let floor: Int = AIRDROP_BASE_STORAGE_ENDOWMENT;
        let bal: Int = myBalance();
        throwUnless(26151, bal > floor);
        message(MessageParameters {
            to: self.treasury_address,
            value: bal - floor,
            bounce: false,
            mode: SendPayFwdFeesSeparately,
            body: "airdrop-unaccounted-ton-sweep".asComment()
        });
    }

    bounced(_: bounced<ATHTransferRequest>) {}

    receive() {}
    receive(_: Slice) {}


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
