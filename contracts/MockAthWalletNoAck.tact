
message(0x41544810) ATHTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

message(0x41544801) ATHBurn {
    query_id: Int as uint64;
    amount: Int as uint128;
    response_destination: Address;
}

message(0x41544812) ATHInternalTransfer {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_owner: Address;
    response_destination: Address;
}

contract MockAthWalletNoAck {
    receive(msg: ATHTransferRequest) {
    }

    receive(msg: ATHInternalTransfer) {
    }

    receive(msg: ATHBurn) {
    }

    receive() {
        throw(18000);
    }
}
