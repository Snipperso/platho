import "./moderation-wire.tact";

const SS_WARNINGS_TO_RESTRICT: Int = 3;
const SS_RETENTION: Int = 31536000;
const SS_GAS: Int = 1000000;
const SS_ENDOWMENT: Int = 1800000;
const SS_RETIRE_GAS: Int = 530000;

struct SanctionShardView {
    exists: Bool;
    wallet: Int;
    warnings: Int;
    restricted: Bool;
    auto: Bool;
    since: Int;
    reason: Int;
    updated_at: Int;
    retention: Int;
    min_value: Int;
    lift_value: Int;
    retire_at: Int;
    gate: Address;
}

message(0x4D535258) RetireSanction {}

contract SanctionShard {
    gate: Address;
    wallet: Int as uint256;
    warnings: Int as uint8;
    restricted: Bool;
    auto: Bool;
    since: Int as uint32;
    reason: Int as uint8;
    updated_at: Int as uint32;

    init(gate: Address, wallet: Int) {
        self.gate = gate;
        self.wallet = wallet;
        self.warnings = 0;
        self.restricted = false;
        self.auto = false;
        self.since = 0;
        self.reason = 0;
        self.updated_at = 0;
    }

    receive(msg: SetWalletSanction) {
        throwUnless(29201, sender() == self.gate);
        throwUnless(29202, msg.wallet == self.wallet);
        throwUnless(29203, (msg.action >= MS_ACTION_WARN_WALLET && msg.action <= MS_ACTION_UNRESTRICT_WALLET) || msg.action == MS_ACTION_UNWARN_WALLET);
        if (self.updated_at > 0 && now() > self.updated_at + SS_RETENTION) {
            self.warnings = 0;
            self.restricted = false;
            self.auto = false;
            self.since = 0;
            self.updated_at = 0;
        }
        let fresh: Bool = self.updated_at == 0;
        let lifts: Bool = msg.action == MS_ACTION_UNRESTRICT_WALLET || msg.action == MS_ACTION_UNWARN_WALLET;
        throwUnless(29208, !(lifts && fresh));
        throwUnless(29210, msg.refund_to.asSlice().preloadUint(11) == 1024);
        let unwarnWarnings: Int = 0;
        let unwarnRestricted: Bool = false;
        let unwarnKeeps: Bool = false;
        if (msg.action == MS_ACTION_UNWARN_WALLET) {
            throwUnless(29209, self.warnings > 0);
            unwarnWarnings = self.warnings - 1;
            unwarnRestricted = self.restricted && !(self.auto && unwarnWarnings < SS_WARNINGS_TO_RESTRICT);
            unwarnKeeps = unwarnWarnings > 0 || unwarnRestricted;
        }
        let keeps: Bool = !lifts || unwarnKeeps;
        let before: Int = myBalance() - context().value;
        let topUp: Int = keeps ? max(0, SS_ENDOWMENT - before) : 0;
        let demand: Int = topUp + SS_GAS;
        throwUnless(29204, context().value >= demand);
        throwUnless(29205, context().value >= demand + myStorageDue());
        if (!keeps) {
            send(SendParameters{ to: msg.refund_to, value: 0, mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors, bounce: false });
            return;
        }
        if (msg.action == MS_ACTION_UNWARN_WALLET) {
            self.warnings = unwarnWarnings;
            self.auto = self.auto && unwarnRestricted;
            self.since = unwarnRestricted ? self.since : 0;
            self.restricted = unwarnRestricted;
        } else {
            let warnings: Int = msg.action == MS_ACTION_WARN_WALLET ? min(self.warnings + 1, 255) : self.warnings;
            let byWarnings: Bool = msg.action == MS_ACTION_WARN_WALLET && warnings >= SS_WARNINGS_TO_RESTRICT;
            let restricted: Bool = self.restricted || msg.action == MS_ACTION_RESTRICT_WALLET || byWarnings;
            self.auto = msg.action == MS_ACTION_RESTRICT_WALLET ? false : (self.restricted ? self.auto : byWarnings);
            self.since = restricted ? (self.restricted ? self.since : now()) : 0;
            self.warnings = warnings;
            self.restricted = restricted;
        }
        self.reason = msg.reason;
        self.updated_at = now();
        nativeReserve(max(SS_ENDOWMENT, before) + myStorageDue(), ReserveAtMost);
        send(SendParameters{ to: msg.refund_to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: RetireSanction) {
        throwUnless(29220, now() > self.updated_at + SS_RETENTION);
        throwUnless(29221, context().value >= SS_RETIRE_GAS);
        throwUnless(29222, sender().asSlice().preloadUint(11) == 1024);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendDestroyIfZero | SendIgnoreErrors, bounce: false });
    }

    receive() {}

    get fun get_view(): SanctionShardView {
        return SanctionShardView{
            exists: self.updated_at > 0,
            wallet: self.wallet,
            warnings: self.warnings,
            restricted: self.restricted,
            auto: self.auto,
            since: self.since,
            reason: self.reason,
            updated_at: self.updated_at,
            retention: SS_RETENTION,
            min_value: SS_ENDOWMENT + SS_GAS,
            lift_value: SS_GAS,
            retire_at: self.updated_at + SS_RETENTION,
            gate: self.gate,
        };
    }
}
