// Test-only ATH wallet sink that accepts transfer requests without ACKing.
// Not part of Platho v1 production contracts.

message(0x41544810) ATHTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

contract MockAthWalletNoAck {
    receive(msg: ATHTransferRequest) {
        // Intentionally accept and do not reply, to keep caller pending state open in tests.
    }

    receive() {
        throw(18000);
    }
}
