
message(0x4D475331) SetLedger {
    ledger: Address;
}

message(0x4D474132) AcceptLedger {}

message(0x4D475731) SweepGate {
    to: Address;
}

message(0x4D474631) Forward {
    to: Address;
    code: Cell?;
    data: Cell?;
    body: Cell;
}

message(0x4D534548) SetEntryHidden {
    entry_id: Int as uint32;
    hidden: Bool;
    reason: Int as uint8;
    refund_to: Address;
}

message(0x4D535753) SetWalletSanction {
    wallet: Int as uint256;
    action: Int as uint8;
    reason: Int as uint8;
    refund_to: Address;
}

message(0x4D525256) MarkReviewed {
    row_key: Int as uint256;
    refund_to: Address;
}


const MS_ACTION_HIDE_ENTRY: Int = 1;
const MS_ACTION_UNHIDE_ENTRY: Int = 2;
const MS_ACTION_WARN_WALLET: Int = 3;
const MS_ACTION_RESTRICT_WALLET: Int = 4;
const MS_ACTION_UNRESTRICT_WALLET: Int = 5;
const MS_ACTION_REVIEW_REPORT: Int = 6;
const MS_ACTION_UNWARN_WALLET: Int = 7;
