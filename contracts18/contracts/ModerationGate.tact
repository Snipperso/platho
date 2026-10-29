import "./moderation-wire.tact";

const MG_FLOAT: Int = 100000000;

contract ModerationGate {
    deployer: Address;
    ledger: Address?;
    pending: Address?;

    init(deployer: Address) {
        throwUnless(29100, deployer.asSlice().preloadUint(11) == 1024);
        self.deployer = deployer;
        self.ledger = null;
        self.pending = null;
    }

    fun isCurrent(a: Address): Bool {
        let current: Address? = self.ledger;
        return current != null && a == current!!;
    }

    fun settle() {
        nativeReserve(myStorageDue(), ReserveAtMost | ReserveAddOriginalBalance);
        send(SendParameters{ to: sender(), value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    receive(msg: SetLedger) {
        let current: Address? = self.ledger;
        throwUnless(29101, current == null ? sender() == self.deployer : sender() == current!!);
        throwUnless(29102, msg.ledger.asSlice().preloadUint(11) == 1024);
        self.pending = msg.ledger;
        self.settle();
    }

    receive(msg: AcceptLedger) {
        let named: Address? = self.pending;
        throwUnless(29103, named != null && sender() == named!!);
        self.ledger = named;
        self.pending = null;
        self.settle();
    }

    receive(msg: Forward) {
        throwUnless(29110, self.isCurrent(sender()));
        send(SendParameters{
            to: msg.to,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            code: msg.code,
            data: msg.data,
            body: msg.body,
        });
    }

    receive(msg: SweepGate) {
        throwUnless(29120, self.isCurrent(sender()));
        throwUnless(29121, msg.to.asSlice().preloadUint(11) == 1024);
        nativeReserve(MG_FLOAT + myStorageDue(), ReserveAtMost);
        send(SendParameters{ to: msg.to, value: 0, mode: SendRemainingBalance | SendIgnoreErrors, bounce: false });
    }

    bounced(msg: Slice) {}

    receive() {}

    get fun get_ledger(): Address? { return self.ledger; }
    get fun get_pending(): Address? { return self.pending; }
    get fun get_deployer(): Address { return self.deployer; }
}
