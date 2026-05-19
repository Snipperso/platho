// Test-only sink that accepts UsernameNFTItem.ResendDeployedAck and intentionally emits no ACK.
// It is used only to simulate a non-bounced but stuck pending username mint in sandbox tests.

message(0x639CFC6C) ResendDeployedAck {}
message(0x27ACDF8B) TopUpStorageReserve {}

contract MockUsernameNFTItemNoAck {
    accepted_count: Int as uint64;

    init() {
        self.accepted_count = 0;
    }

    receive(msg: ResendDeployedAck) {
        self.accepted_count += 1;
    }

    receive(msg: TopUpStorageReserve) {
        // Accept storage top-ups only.
    }

    get fun get_accepted_count(): Int {
        return self.accepted_count;
    }

    receive() {
        throw(18998);
    }
}
