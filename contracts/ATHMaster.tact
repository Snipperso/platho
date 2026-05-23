// Platho v1 ATH Master milestone-2 implementation.
// Scope: fixed supply metadata/getters, deterministic wallet derivation, and authenticated burn finalization.
// No mint/admin/pause/blacklist/tax/force-transfer/fallback behavior is implemented.

import "./ATHWallet.tact";

const ATH_TOTAL_SUPPLY_ATOMIC: Int = 100000000000000000;
const ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE: Int = 2000000;
const ATH_MASTER_EXCESS_REFUND_MIN_VALUE: Int = 100000;

message(0x41544807) DeployTreasurySupply {
    query_id: Int as uint64;
    response_destination: Address;
}

struct ATHJettonDataView {
    total_supply: Int;
    mintable: Bool;
    admin_address: Address;
    jetton_content: Cell;
    jetton_wallet_code: Cell;
}

contract ATHMaster {
    total_supply: Int as uint128;
    treasury_owner: Address;
    content: Cell;
    treasury_supply_deployed: Bool;

    init(treasury_owner: Address, content: Cell) {
        self.total_supply = ATH_TOTAL_SUPPLY_ATOMIC;
        self.treasury_owner = treasury_owner;
        self.content = content;
        self.treasury_supply_deployed = false;
    }

    fun derive_wallet_address(owner_address: Address): Address {
        let owner_std: StdAddress = parseStdAddress(owner_address.asSlice());
        let wallet_init: StateInit = initOf ATHWallet(0, owner_address, myAddress());
        return contractAddressExt(owner_std.workchain, wallet_init.code, wallet_init.data);
    }

    receive(msg: ATHBurnNotification) {
        throwUnless(14100, msg.amount > 0);
        throwUnless(14101, sender() == self.derive_wallet_address(msg.owner_address));
        throwUnless(14102, self.total_supply >= msg.amount);
        throwUnless(14103, context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE);

        self.total_supply -= msg.amount;

        message(MessageParameters {
            to: msg.response_destination,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: ATHBurnFinalized {
                query_id: msg.query_id,
                amount: msg.amount,
                owner_address: msg.owner_address
            }.toCell()
        });
    }

    receive(msg: DeployTreasurySupply) {
        throwUnless(14120, sender() == self.treasury_owner);
        throwUnless(14121, !self.treasury_supply_deployed);
        throwUnless(14122, msg.response_destination == self.treasury_owner);
        throwUnless(14123, self.total_supply == ATH_TOTAL_SUPPLY_ATOMIC);
        let downstream_value: Int = ATH_GENESIS_SUPPLY_EXEC_RESERVE + ATH_GENESIS_SUPPLY_ACK_VALUE;
        let required_value: Int = downstream_value + ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE;
        throwUnless(14124, context().value >= required_value);

        self.treasury_supply_deployed = true;

        let wallet_init: StateInit = initOf ATHWallet(0, self.treasury_owner, myAddress());
        let treasury_wallet: Address = self.derive_wallet_address(self.treasury_owner);
        send(SendParameters {
            to: treasury_wallet,
            value: downstream_value,
            bounce: true,
            mode: SendPayFwdFeesSeparately,
            code: wallet_init.code,
            data: wallet_init.data,
            body: ATHGenesisSupplyCredit {
                query_id: msg.query_id,
                amount: self.total_supply,
                response_destination: msg.response_destination
            }.toCell()
        });

        let excess: Int = context().value - required_value;
        if (excess >= ATH_MASTER_EXCESS_REFUND_MIN_VALUE) {
            message(MessageParameters {
                to: msg.response_destination,
                value: excess,
                bounce: false,
                mode: SendDefaultMode,
                body: null
            });
        }
    }

    bounced(msg: bounced<ATHGenesisSupplyCredit>) {
        throwUnless(14130, sender() == self.derive_wallet_address(self.treasury_owner));
        throwUnless(14131, msg.amount == self.total_supply);
        self.treasury_supply_deployed = false;

        if (context().value >= ATH_MASTER_EXCESS_REFUND_MIN_VALUE) {
            message(MessageParameters {
                to: self.treasury_owner,
                value: 0,
                bounce: false,
                mode: SendRemainingValue,
                body: null
            });
        }
    }

    get fun get_jetton_data(): ATHJettonDataView {
        let wallet_init: StateInit = initOf ATHWallet(0, self.treasury_owner, myAddress());
        return ATHJettonDataView {
            total_supply: self.total_supply,
            mintable: false,
            admin_address: self.treasury_owner,
            jetton_content: self.content,
            jetton_wallet_code: wallet_init.code
        };
    }

    get fun get_wallet_address(owner_address: Address): Address {
        return self.derive_wallet_address(owner_address);
    }

    receive() {
        // No fallback behavior. Empty inbound messages are rejected.
        throw(13001);
    }
}
