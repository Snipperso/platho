// Platho v1 ATH Master milestone-2 implementation.
// Scope: fixed supply metadata/getters, deterministic wallet derivation, and authenticated burn finalization.
// No mint/admin/pause/blacklist/tax/force-transfer/fallback behavior is implemented.

import "./ATHWallet.tact";

const ATH_TOTAL_SUPPLY_ATOMIC: Int = 100000000000000000;
// [RAISED 2026-07-29, wave-8 HIGH: 2M -> 8M] What this transaction keeps to pay for ITSELF. The genesis credit is
// sent with SendPayFwdFeesSeparately and carries a FULL ATHWallet StateInit — MEASURED at 77 cells / 47,218 bits —
// so its forward fee is charged to the master's BALANCE on top of the value, not out of it. MEASURED for that
// transaction: 754,268 of gas and 3,826,734 of action-phase forward fees, about 4,580,000 against a 2,000,000 gate.
// The shortfall used to be met only by whatever the master happened to be holding from its own deploy, and paying
// more did not help because every nanoton above required_value was refunded. Worse, an ACTION-phase failure (rc37)
// carries NO exit code, so nothing in the ceremony's checks would have shown why the 100,000,000 ATH mint failed.
// At 8,000,000 the inbound message funds the whole transaction on its own, with the measured cost covered ~1.75x.
const ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE: Int = 8000000;
const ATH_MASTER_EXCESS_REFUND_MIN_VALUE: Int = 100000; // still used by the bounced genesis leg below

// "ATH"+0x09 — [CHANGED 2026-07-29, wave-8 LOW] was 0x41544807, which is ALSO ATHWalletTopUpStorageReserve. Both
// declarations reach one compilation module through the ATHWallet import above, and Tact did not object: the built
// ABI shows header 1096042503 for both. The collision is asymmetric and the dangerous direction is silent — a genesis
// mint aimed by mistake at an ATH wallet is accepted by that wallet's field-less top-up receiver, which never checks
// the body is exhausted, and reports SUCCESS. (The other direction is caught: parsing query_id+Address off an empty
// body runs out of bits.) Moving this one is free — DeployTreasurySupply is sent once, by our own ceremony.
message(0x41544809) DeployTreasurySupply {
    query_id: Int as uint64;
    response_destination: Address;
}

// "ATH"+0x0A — [ADDED 2026-07-29, wave-8 MED] the master had no way to be topped up at all.
//
// After genesis not one handler leaves value behind: ATHBurnNotification and the bounced leg both forward the
// remainder with SendRemainingValue, and 14121 closes DeployTreasurySupply forever. The fallback throws 13001, so an
// ordinary BOUNCEABLE transfer bounces straight back instead of funding the account — only the non-bounceable form
// happened to work, and by accident rather than design. Meanwhile rent runs regardless: MEASURED 6,236,368 a year
// for the account plus 93 code cells plus data. This contract is never to be redeployed under any circumstance, so
// the deficit is unrecoverable by construction. Permissionless, like every other top-up receiver in this codebase.
message(0x4154480A) ATHMasterTopUpStorageReserve {}

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
    // [ADDED 2026-08-02] THE ONLY THING THAT MAKES A GENESIS FORK POSSIBLE.
    //
    // An abandoned ceremony leaves live contracts holding state that must never be inherited: a spent one-shot
    // supply mint, a FeeAccumulator permanently bound to a dead AirdropPool. A restart therefore needs FRESH
    // addresses for everything — and an address here is a pure function of code and init data, with no
    // discriminator to turn.
    //
    // Three times in one day the addresses moved anyway, because the wallet's code happened to change and the
    // wallet's code is embedded in almost everything. The fourth time it did not: a change confined to AirdropPool
    // moved AirdropPool and nothing else, and the redeploy would have skipped seven live contracts as "already
    // ACTIVE" and inherited exactly the state the restart existed to escape. Relying on an incidental code edit to
    // fork a genesis is relying on a side effect that is invisible until it is absent.
    //
    // ATHMaster and AirdropPool are the two roots: everything else derives from one of them (ATHVesting,
    // BuybackBurn, MarketStabilitySeller and both registries take ath_master; FeeAccumulator takes BuybackBurn),
    // and AirdropPool depends on nothing. So the id lives in exactly those two, and one number forks the whole set.
    //
    // It is init data, never read by any handler, and it has no authority. That is the point: it changes the
    // address and nothing else.
    deployment_id: Int as uint32;

    init(treasury_owner: Address, content: Cell, deployment_id: Int) {
        let treasury_std: StdAddress = parseStdAddress(treasury_owner.asSlice());
        throwUnless(14104, treasury_std.workchain == 0);
        self.total_supply = ATH_TOTAL_SUPPLY_ATOMIC;
        self.treasury_owner = treasury_owner;
        self.content = content;
        self.treasury_supply_deployed = false;
        self.deployment_id = deployment_id;
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
        let required_value: Int = ATH_GENESIS_SUPPLY_EXEC_RESERVE + ATH_GENESIS_SUPPLY_ACK_VALUE
            + ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE;
        throwUnless(14124, context().value >= required_value);
        // [CHANGED 2026-07-29, wave-8 MED] Was pinned to 3,000,000 with everything above required_value refunded to
        // the owner, which made it IMPOSSIBLE to endow the treasury wallet through the only path that creates it.
        // That wallet holds 100% of the supply and is never redeployable, and its rent is MEASURED at 5,132,011 a
        // year — against the 1,624,999 it was left with after paying its own gas and ack. It would have gone into
        // storage debt inside the first year, with the entire 100,000,000 ATH inside it.
        //
        // Scaling instead of refunding turns the ceremony's own send value into the wallet's endowment: the wallet's
        // gate 14403 accepts anything at or above the floor and keeps the remainder, so a century of rent is funded
        // by sending it, with no second mechanism to build and nothing extra to remember after the seal. See
        // DEPLOY_TREASURY_SUPPLY_VALUE_RECOMMENDED_NANOTONS, raised in the same change.
        let downstream_value: Int = context().value - ATH_GENESIS_SUPPLY_OWNER_EXEC_RESERVE;

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

    }

    receive(_: ATHMasterTopUpStorageReserve) {
        // Accept TON for storage reserve only. Supply, treasury owner and content are immutable.
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
