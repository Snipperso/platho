// Test-only. A malicious "recipient owner" for the ATH notify lane (W1-004 measurement). It receives the
// AthTransferNotification its wallet forwards and BURNS a tunable amount of compute gas before rejecting, so the
// notification bounces back to the recipient wallet with a REDUCED value. The question the measurement answers is
// whether that lets the recipient defeat the payer's clawback refund and keep the ATH (theft) or merely strand it.
// Not part of Platho v1 production contracts.

message(0x472D9D7D) AthTransferNotification {
    query_id: Int as uint64;
    sender_key: Int as uint160;
    amount: Int as uint128;
    sender_wallet: Address;
}

contract MockGasBurnNotifyOwner {
    burn_iters: Int as uint32;

    init(burn_iters: Int) {
        self.burn_iters = burn_iters;
    }

    receive(msg: AthTransferNotification) {
        // Burn real compute (a running LCG so the loop cannot be elided), then reject. Because the compute phase
        // fails, the bounceable notification returns with (incoming value − gas consumed), which the attacker tunes
        // via burn_iters. A throw here is what makes the message bounce at all.
        let x: Int = 7;
        repeat (self.burn_iters) {
            x = (x * 1103515245 + 12345) % 2147483647;
        }
        throwUnless(60004, x == -1); // x is never -1, so this always throws; referencing x keeps the loop live
    }

    receive() {}
    receive(_: Slice) {}
}
