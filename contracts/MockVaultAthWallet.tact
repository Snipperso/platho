// Test-only mock for Vault ATH integration milestone.
// Not part of Platho v1 production contracts.

message(0x472D9D7D) AthTransferNotification {
    query_id: Int as uint64;
    amount: Int as uint128;
    sender_wallet: Address;
}

message(0x41544810) VaultAthTransferRequest {
    query_id: Int as uint64;
    amount: Int as uint128;
    recipient: Address;
    response_destination: Address;
}

message(0x41544811) VaultAthTransferAck {
    query_id: Int as uint64;
    amount: Int as uint128;
}

message(0x4D415444) MockSendAthDeposit { // "MATD"
    query_id: Int as uint64;
    vault: Address;
    sender_wallet: Address;
    amount: Int as uint128;
}

contract MockVaultAthWallet(reject_transfers: Bool) {
    receive(msg: MockSendAthDeposit) {
        message(MessageParameters {
            to: msg.vault,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            body: AthTransferNotification {
                query_id: msg.query_id,
                amount: msg.amount,
                sender_wallet: msg.sender_wallet
            }.toCell()
        });
    }

    receive(msg: VaultAthTransferRequest) {
        if (self.reject_transfers) {
            throw(17000);
        }

        message(MessageParameters {
            to: msg.response_destination,
            value: 0,
            bounce: true,
            mode: SendRemainingValue,
            body: VaultAthTransferAck {
                query_id: msg.query_id,
                amount: msg.amount
            }.toCell()
        });
    }

    receive() {
        throw(17001);
    }
}
