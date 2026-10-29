
import "./ATHWallet.tact";
import "./vault-wire.tact";
import "./ath-wire.tact";
import "./sink-wire.tact";

const FV_ATH_MASTER: Address = address("EQCThzitzPXm2dH9psaVkZlkAcHqzCJjcBpD29b5closNeq-");

const FV_PROTOCOL_FEE: Int = 10000000;

const FV_FLUSH_MIN: Int = 1000000000;

const FV_FLUSH_AMORT: Int = 2000;

const FV_BPS_CAP: Int = 10000;
const FV_BPS_FLOOR: Int = 100;
const FV_ATOMIC_PER_ATH: Int = 1000000000;

const FV_PUBLISH_GAS_UNITS: Int = 15000;

const FV_UNSTAKE_LEG_VALUE: Int = 50000000;
const FV_UNSTAKE_MIN_INBOUND: Int = 55000000;
const FV_UNSTAKE_SELF_KEEP: Int = FV_UNSTAKE_MIN_INBOUND - FV_UNSTAKE_LEG_VALUE;

const FV_RENT_FLOAT: Int = 50000000;

const FV_FWD_HEADROOM: Int = 1000000;

const FV_UNSTAKE_UNJAM_GRACE_SECONDS: Int = 3600;

const FV_EXIT_ABSORB_WINDOW: Int = 300;






message(0x4D323144) PublishViaVault {
    shard: Address;
    record: Cell;
    shard_code: Cell?;
    shard_data: Cell?;
}

message(0x4D323145) Unstake {
    amount: Int as coins;
}

message(0x4D323146) UnstakeUnjam {}

message(0x4D323147) EmergencyExit {
    amount: Int as coins;
}

message(0x4D323148) WithdrawFloat {}


message(0x4D32314B) FlushFees {}


contract FeeVault {
    owner: Address;
    staked: Int as coins;
    pending: Int as coins;
    pending_at: Int as uint32;
    unstake_seq: Int as uint64;
    exited: Int as coins;
    exited_at: Int as uint32;
    accrued_fee: Int as coins;

    init(owner: Address) {
        throwUnless(28001, owner.asSlice().preloadUint(11) == 1024);
        self.owner = owner;
        self.staked = 0;
        self.pending = 0;
        self.pending_at = 0;
        self.unstake_seq = 0;
        self.exited = 0;
        self.exited_at = 0;
        self.accrued_fee = 0;
    }


    fun myAthWallet(): Address {
        return athWalletOf(myAddress(), FV_ATH_MASTER);
    }

    fun ownerAthWallet(): Address {
        return athWalletOf(self.owner, FV_ATH_MASTER);
    }

    fun discountBps(): Int {
        let wholeAth: Int = self.staked / FV_ATOMIC_PER_ATH;
        if (wholeAth > FV_BPS_CAP) {
            return FV_BPS_CAP;
        }
        return wholeAth;
    }

    fun feeDue(): Int {
        return FV_PROTOCOL_FEE * (FV_BPS_CAP - self.discountBps()) / FV_BPS_CAP;
    }

    fun feeTake(): Int {
        let fee: Int = self.feeDue();
        return fee > 0 ? fee + FV_FLUSH_AMORT : 0;
    }

    fun flushAccrued(): Bool {
        return self.flushAccruedUpTo(self.accrued_fee);
    }

    fun flushAccruedUpTo(amount: Int): Bool {
        if (amount <= 0) {
            return false;
        }
        if (myBalance() < self.accrued_fee + FV_RENT_FLOAT + FV_FWD_HEADROOM) {
            return false;
        }
        message(MessageParameters {
            to: FS_TREASURY,
            value: amount,
            mode: SendDefaultMode,
            bounce: false,
            body: null,
        });
        self.accrued_fee = self.accrued_fee - amount;
        return true;
    }

    receive(msg: JettonTransferNotification) {
        throwUnless(28010, sender() == self.myAthWallet());
        let debt: Int = (now() - self.exited_at) <= FV_EXIT_ABSORB_WINDOW ? self.exited : 0;
        if (debt >= msg.amount) {
            self.exited = self.exited - msg.amount;
        } else {
            self.staked = self.staked + msg.amount - debt;
            self.exited = 0;
        }
    }

    receive(msg: PublishViaVault) {
        throwUnless(28020, sender() == self.owner);
        let bookedBefore: Int = self.accrued_fee;
        let take: Int = self.feeTake();
        let keepSelf: Int = getComputeFee(FV_PUBLISH_GAS_UNITS, false);
        throwUnless(28021, context().value > take + keepSelf);
        throwUnless(28023, parseStdAddress(msg.shard.asSlice()).workchain == 0);
        throwUnless(28022, context().value > take + keepSelf + context().readForwardFee() + FV_FWD_HEADROOM);
        self.accrued_fee = self.accrued_fee + take;
        send(SendParameters {
            to: msg.shard,
            value: context().value - take - keepSelf,
            mode: SendDefaultMode,
            bounce: true,
            code: msg.shard_code,
            data: msg.shard_data,
            body: VaultPublish{ fee_memo: take, payer: self.owner, record: msg.record }.toCell(),
        });
        if (bookedBefore >= FV_FLUSH_MIN) {
            self.flushAccruedUpTo(bookedBefore);
        }
    }



    bounced(msg: bounced<VaultPublish>) {
        self.accrued_fee = self.accrued_fee > msg.fee_memo ? self.accrued_fee - msg.fee_memo : 0;
        message(MessageParameters {
            to: self.owner,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: null,
        });
    }

    receive(msg: Unstake) {
        throwUnless(28030, sender() == self.owner);
        throwUnless(28031, self.pending == 0);
        throwUnless(28032, msg.amount > 0);
        throwUnless(28033, msg.amount <= self.staked);
        throwUnless(28034, context().value >= FV_UNSTAKE_MIN_INBOUND);
        self.staked -= msg.amount;
        self.pending = msg.amount;
        self.pending_at = now();
        self.unstake_seq = self.unstake_seq + 1;
        message(MessageParameters {
            to: self.myAthWallet(),
            value: context().value - FV_UNSTAKE_SELF_KEEP,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: JettonTransfer{
                query_id: self.unstake_seq,
                amount: msg.amount,
                destination: self.owner,
                response_destination: myAddress(),
                custom_payload: null,
                forward_ton_amount: 0,
                forward_payload: emptySlice(),
            }.toCell(),
        });
    }

    receive(msg: JettonExcesses) {
        throwUnless(28040, sender() == self.ownerAthWallet());
        if (msg.query_id == self.unstake_seq) {
            self.pending = 0;
            self.pending_at = 0;
        }
    }

    bounced(msg: bounced<JettonTransfer>) {
        throwUnless(28060, sender() == self.myAthWallet());
        if (msg.query_id == self.unstake_seq) {
            if (self.pending > 0) {
                self.staked += self.pending;
                self.pending = 0;
                self.pending_at = 0;
            } else {
                self.exited = 0;
                self.exited_at = 0;
            }
        }
    }

    receive(msg: UnstakeUnjam) {
        throwUnless(28050, sender() == self.owner);
        throwUnless(28051, self.pending > 0);
        throwUnless(28052, now() > self.pending_at + FV_UNSTAKE_UNJAM_GRACE_SECONDS);
        self.pending = 0;
        self.pending_at = 0;
    }

    receive(msg: EmergencyExit) {
        throwUnless(28070, sender() == self.owner);
        throwUnless(28071, msg.amount > 0);
        throwUnless(28072, context().value >= FV_UNSTAKE_MIN_INBOUND);
        self.staked = self.staked > msg.amount ? self.staked - msg.amount : 0;
        self.exited = self.exited + msg.amount;
        self.exited_at = now();
        self.pending = 0;
        self.pending_at = 0;
        self.unstake_seq = self.unstake_seq + 1;
        message(MessageParameters {
            to: self.myAthWallet(),
            value: context().value - FV_UNSTAKE_SELF_KEEP,
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: JettonTransfer{
                query_id: self.unstake_seq,
                amount: msg.amount,
                destination: self.owner,
                response_destination: self.owner,
                custom_payload: null,
                forward_ton_amount: 0,
                forward_payload: emptySlice(),
            }.toCell(),
        });
    }

    receive(msg: WithdrawFloat) {
        throwUnless(28080, sender() == self.owner);
        throwUnless(28081, myBalance() - context().value > FV_RENT_FLOAT + self.accrued_fee + FV_FWD_HEADROOM);
        nativeReserve(FV_RENT_FLOAT + self.accrued_fee, ReserveExact);
        send(SendParameters {
            to: self.owner,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
        });
    }

    receive(msg: FlushFees) {
        throwUnless(28130, self.accrued_fee > 0);
        throwUnless(28131, sender() == self.owner || self.accrued_fee >= FV_FLUSH_MIN);
        throwUnless(28133, self.accrued_fee > context().readForwardFee());
        throwUnless(28132, self.flushAccrued());
        message(MessageParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: null,
        });
    }

    receive(msg: ATHTransferFailed) {
        throwUnless(28085, sender() == self.myAthWallet());
        if (msg.query_id == self.unstake_seq) {
            self.staked = self.staked + self.pending;
            self.pending = 0;
            self.pending_at = 0;
        }
    }

    receive() {}
    receive(_: Slice) {
        throw(28090);
    }

    get fun get_vault(): FeeVaultView {
        return FeeVaultView{
            owner: self.owner,
            staked: self.staked,
            pending: self.pending,
            pending_at: self.pending_at,
            discount_bps: self.discountBps(),
            fee_due: self.feeDue(),
            ath_wallet: self.myAthWallet(),
            balance: myBalance(),
            exited: self.exited,
            exited_at: self.exited_at,
            accrued_fee: self.accrued_fee,
            flush_min: FV_FLUSH_MIN,
        };
    }
}


struct FeeVaultView {
    owner: Address;
    staked: Int;
    pending: Int;
    pending_at: Int;
    discount_bps: Int;
    fee_due: Int;
    ath_wallet: Address;
    balance: Int;
    exited: Int;
    exited_at: Int;
    accrued_fee: Int;
    flush_min: Int;
}
