// Platho v1 ATH long-term vesting contract.
// Scope: immutable beneficiary, fixed 100-year ATH unlock schedule, and
// bounce-safe claims through the canonical ATHWallet transfer flow.

import "./ATHWallet.tact";

const ATH_VESTING_TOTAL_AMOUNT: Int = 10000000000000000; // 10,000,000 ATH atomic units
const ATH_VESTING_PERIOD_UNLOCK_AMOUNT: Int = 100000000000000; // 100,000 ATH atomic units
const ATH_VESTING_PERIOD_COUNT: Int = 100;
const ATH_VESTING_PERIOD_SECONDS: Int = 31536000;
// [COMMENT CORRECTED 2026-08-01] The arithmetic quoted here described gate 14204 as EXEC(2M)+ACK(3M)+ENDOWMENT(20M)
// +FWD(21M)+OWNER_EXEC(2M) = 48M with 10M of margin. That gate is now ATH_OWNER_REQUEST_EXEC_RESERVE(2M) +
// ATH_INTERNAL_TRANSFER_ARRIVAL_MIN(29M) + ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE(8M) = 39,000,000, so this leg
// now carries 19,000,000 of margin. Left at 58M on purpose: this is the vesting payout, it runs for years on an
// immutable contract, and margin against a future rise in config-25 forward fees is worth more than the saving.
const ATH_VESTING_TRANSFER_REQUEST_VALUE: Int = 58000000;
// [RAISED 2026-07-29, wave-8 MED: 2M -> 10M] This is what a claim LEAVES BEHIND, and it is the only inflow this
// contract has. MEASURED from build/ATHVesting/ATHVesting_ATHVesting.code.boc: 113 distinct code cells plus a data
// cell that spills at 1321 bits of fields, so ~115 account cells; at the project's frozen 64,962 nanoton per cell-year
// that is ~7,470,000 nanoton of rent PER YEAR, i.e. ~747,000,000 over the 100-year schedule. At 2,000,000 a claim,
// net of gas and two forward fees, the schedule funded almost none of its own rent. At 10,000,000 an annual claim
// retains roughly one year of it. This is a belt, not the trousers: a beneficiary who claims once a decade retains
// once a decade, so the DEPLOY value must still pre-fund the century on its own — see the D06 note in
// scripts/mainnet_tx_dry_run_packet.ts, raised in the same change.
const ATH_VESTING_LOCAL_EXEC_RESERVE: Int = 10000000;
const ATH_VESTING_PHASE_IDLE: Int = 0;
const ATH_VESTING_PHASE_PENDING_TRANSFER: Int = 1;
const UINT64_MAX: Int = 18446744073709551615;

message(0x41545643) ClaimAthVesting { // "ATVC"
    query_id: Int as uint64;
    amount: Int as uint128;
}

message(0x41545654) ATHVestingTopUpStorageReserve {} // "ATVT"

struct ATHVestingConfigView {
    ath_master_address: Address;
    beneficiary_address: Address;
    official_ath_wallet_address: Address;
    start_time: Int;
    period_seconds: Int;
    period_count: Int;
    period_unlock_amount: Int;
    total_amount: Int;
}

struct ATHVestingStateView {
    phase: Int;
    claimed_ath: Int;
    vested_ath: Int;
    claimable_ath: Int;
    pending_query_id: Int;
    pending_amount: Int;
    pending_recipient_ath_wallet: Address;
    pending_created_at: Int;
    last_terminal_query_id: Int;
}

contract ATHVesting {
    ath_master_address: Address;
    beneficiary_address: Address;
    start_time: Int as uint64;
    claimed_ath: Int as uint128;
    phase: Int as uint8;
    pending_query_id: Int as uint64;
    pending_amount: Int as uint128;
    pending_recipient_ath_wallet: Address;
    pending_created_at: Int as uint64;
    last_terminal_query_id: Int as uint64;

    init(ath_master_address: Address, beneficiary_address: Address, start_time: Int) {
        let masterStd: StdAddress = parseStdAddress(ath_master_address.asSlice());
        let beneficiaryStd: StdAddress = parseStdAddress(beneficiary_address.asSlice());
        throwUnless(24000, masterStd.workchain == 0);
        throwUnless(24001, beneficiaryStd.workchain == 0);
        throwUnless(24002, start_time > 0);
        // [ADDED 2026-07-29, wave-8 LOW] The master's and the beneficiary's workchains were checked; this contract's
        // own was not — even though deriveAthWalletAddress takes the workchain for the OFFICIAL wallet straight out of
        // myAddress(). Deployed off basechain, the vesting wallet derives into that same foreign workchain while
        // ATHWallet's own gate 14600 demands a basechain owner, so the wallet refuses every request and the entire
        // 10,000,000 ATH is unspendable on an immutable contract. A helper isBasechainAddress() sat here written for
        // exactly this check and called nowhere — the gate was designed and then not installed — so the check is now
        // inlined (init cannot call contract methods) and the helper is deleted rather than left looking like a guard.
        let selfStd: StdAddress = parseStdAddress(myAddress().asSlice());
        throwUnless(24003, selfStd.workchain == 0);
        self.ath_master_address = ath_master_address;
        self.beneficiary_address = beneficiary_address;
        self.start_time = start_time;
        self.claimed_ath = 0;
        self.phase = ATH_VESTING_PHASE_IDLE;
        self.pending_query_id = 0;
        self.pending_amount = 0;
        self.pending_recipient_ath_wallet = beneficiary_address;
        self.pending_created_at = 0;
        self.last_terminal_query_id = 0;
    }

    fun deriveAthWalletAddress(owner: Address): Address {
        let ownerStd: StdAddress = parseStdAddress(owner.asSlice());
        let walletInit: StateInit = initOf ATHWallet(0, owner, self.ath_master_address);
        return contractAddressExt(ownerStd.workchain, walletInit.code, walletInit.data);
    }

    fun ownAthWalletAddress(): Address {
        return self.deriveAthWalletAddress(myAddress());
    }

    fun beneficiaryAthWalletAddress(): Address {
        return self.deriveAthWalletAddress(self.beneficiary_address);
    }

    fun elapsedPeriods(atTime: Int): Int {
        if (atTime < self.start_time + ATH_VESTING_PERIOD_SECONDS) {
            return 0;
        }

        let periods: Int = (atTime - self.start_time) / ATH_VESTING_PERIOD_SECONDS;
        if (periods > ATH_VESTING_PERIOD_COUNT) {
            return ATH_VESTING_PERIOD_COUNT;
        }
        return periods;
    }

    fun vestedAt(atTime: Int): Int {
        return self.elapsedPeriods(atTime) * ATH_VESTING_PERIOD_UNLOCK_AMOUNT;
    }

    fun claimableNow(): Int {
        let vested: Int = self.vestedAt(now());
        if (vested <= self.claimed_ath) {
            return 0;
        }
        let unlocked: Int = vested - self.claimed_ath;
        if (self.phase == ATH_VESTING_PHASE_PENDING_TRANSFER) {
            if (unlocked <= self.pending_amount) {
                return 0;
            }
            return unlocked - self.pending_amount;
        }
        return unlocked;
    }

    fun clearPending() {
        self.phase = ATH_VESTING_PHASE_IDLE;
        self.pending_query_id = 0;
        self.pending_amount = 0;
        self.pending_recipient_ath_wallet = self.beneficiary_address;
        self.pending_created_at = 0;
    }

    fun recordTerminalQuery(queryId: Int) {
        self.last_terminal_query_id = queryId;
    }

    receive(msg: ClaimAthVesting) {
        throwUnless(24100, self.phase == ATH_VESTING_PHASE_IDLE);
        throwUnless(24101, msg.query_id > 0);
        throwUnless(24102, msg.query_id < UINT64_MAX);
        throwUnless(24103, msg.query_id == self.last_terminal_query_id + 1);
        throwUnless(24104, msg.amount > 0);
        throwUnless(24105, msg.amount == self.claimableNow());
        let requiredValue: Int = ATH_VESTING_TRANSFER_REQUEST_VALUE + ATH_VESTING_LOCAL_EXEC_RESERVE;
        throwUnless(24106, context().value >= requiredValue);

        let recipientWallet: Address = self.beneficiaryAthWalletAddress();
        self.phase = ATH_VESTING_PHASE_PENDING_TRANSFER;
        self.pending_query_id = msg.query_id;
        self.pending_amount = msg.amount;
        self.pending_recipient_ath_wallet = recipientWallet;
        self.pending_created_at = now();

        // [CHANGED 2026-07-29, wave-8 MED] The downstream budget used to be the flat ATH_VESTING_TRANSFER_REQUEST_VALUE
        // with every nanoton above requiredValue refunded to the caller, which meant OVERPAYING COULD NOT PUSH A CLAIM
        // THROUGH. On a contract that is immutable for a hundred years that is the wrong default: gas and forward fees
        // are voted by validators (configs 20/21/24/25) and every floor downstream — the wallet's 48,000,000 request
        // floor, gate 14212's arrival minimum — is a frozen literal. ATHWallet itself takes the opposite approach one
        // hop later (downstream_value = context().value - ATH_OWNER_REQUEST_EXEC_RESERVE), so the owner there can
        // always force an operation through by paying more. This lane now behaves the same way, and the constant stays
        // as the FLOOR that gate 24106 enforces rather than as a ceiling.
        //
        // Nothing is lost by not refunding: surplus travels to the beneficiary's wallet, which returns its own excess
        // to response_destination — this contract — where it lands on the balance and pays rent. (That inbound refund
        // has a null body and so hits receive() and throws 24999, but it is non-bounceable, so the value is credited
        // before compute runs and stays. Documented, not relied upon for correctness.)
        message(MessageParameters {
            to: self.ownAthWalletAddress(),
            value: context().value - ATH_VESTING_LOCAL_EXEC_RESERVE,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            body: ATHTransferRequest {
                query_id: msg.query_id,
                amount: msg.amount,
                recipient: self.beneficiary_address,
                response_destination: myAddress()
            }.toCell()
        });
    }

    receive(msg: ATHTransferAck) {
        throwUnless(24200, self.phase == ATH_VESTING_PHASE_PENDING_TRANSFER);
        throwUnless(24201, msg.query_id == self.pending_query_id);
        throwUnless(24202, msg.amount == self.pending_amount);
        throwUnless(24203, sender() == self.pending_recipient_ath_wallet);
        let queryId: Int = self.pending_query_id;
        let amount: Int = self.pending_amount;
        self.claimed_ath += amount;
        throwUnless(24204, self.claimed_ath <= ATH_VESTING_TOTAL_AMOUNT);
        self.clearPending();
        self.recordTerminalQuery(queryId);
    }

    receive(msg: ATHTransferFailed) {
        throwUnless(24210, sender() == self.ownAthWalletAddress());
        throwUnless(24211, self.phase == ATH_VESTING_PHASE_PENDING_TRANSFER);
        throwUnless(24212, msg.query_id == self.pending_query_id);
        throwUnless(24213, msg.amount == self.pending_amount);
        let queryId: Int = self.pending_query_id;
        self.clearPending();
        self.recordTerminalQuery(queryId);
    }

    bounced(msg: bounced<ATHTransferRequest>) {
        throwUnless(24220, sender() == self.ownAthWalletAddress());
        throwUnless(24221, self.phase == ATH_VESTING_PHASE_PENDING_TRANSFER);
        throwUnless(24222, msg.query_id == self.pending_query_id);
        throwUnless(24223, msg.amount == self.pending_amount);
        let queryId: Int = self.pending_query_id;
        self.clearPending();
        self.recordTerminalQuery(queryId);
    }

    receive(msg: ATHVestingTopUpStorageReserve) {
        // Accept TON for storage reserve only. Vesting schedule and beneficiary are immutable.
    }

    // [ADDED 2026-08-01] Its own change coming home. This contract names ITSELF as response_destination on every
    // claim, so once ATHWallet started returning the surplus instead of burying it, that surplus arrives here — and
    // without a receiver Tact threw 130 on it. MEASURED: exit 130, value still credited (the message is sent
    // bounce:false, so a failed compute phase keeps the coins), which means nothing was lost but every single claim
    // left a FAILED transaction on the vesting contract. Money arriving through a failure is not a property to rely
    // on. No auth and no state change: value is the entire point, exactly like the top-up above.
    receive(_: ATHTransferExcess) {
    }

    receive() {
        throw(24999);
    }

    get fun get_vesting_config(): ATHVestingConfigView {
        return ATHVestingConfigView {
            ath_master_address: self.ath_master_address,
            beneficiary_address: self.beneficiary_address,
            official_ath_wallet_address: self.ownAthWalletAddress(),
            start_time: self.start_time,
            period_seconds: ATH_VESTING_PERIOD_SECONDS,
            period_count: ATH_VESTING_PERIOD_COUNT,
            period_unlock_amount: ATH_VESTING_PERIOD_UNLOCK_AMOUNT,
            total_amount: ATH_VESTING_TOTAL_AMOUNT
        };
    }

    get fun get_vesting_state(): ATHVestingStateView {
        return ATHVestingStateView {
            phase: self.phase,
            claimed_ath: self.claimed_ath,
            vested_ath: self.vestedAt(now()),
            claimable_ath: self.claimableNow(),
            pending_query_id: self.pending_query_id,
            pending_amount: self.pending_amount,
            pending_recipient_ath_wallet: self.pending_recipient_ath_wallet,
            pending_created_at: self.pending_created_at,
            last_terminal_query_id: self.last_terminal_query_id
        };
    }

    get fun get_vested_amount(at_time: Int): Int {
        return self.vestedAt(at_time);
    }

    get fun get_claimable_amount(): Int {
        return self.claimableNow();
    }

    get fun get_ath_wallet_address(owner: Address): Address {
        return self.deriveAthWalletAddress(owner);
    }
}
