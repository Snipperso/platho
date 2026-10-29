import "./derive.tact";

const FV_CODE_HASH: Int = 0x518d5ea091aa39845a1c4c9acac5da5d886ccf87823d796b19cb6ccca16f8b5b;
const FV_CODE_DEPTH: Int = 10;

message(0x4D323143) VaultPublish {
    fee_memo: Int as coins;
    payer: Address;
    record: Cell;
}

fun vaultAddressOf(payer: Address): Address {
    let data: Cell = beginCell().storeUint(0, 1).storeAddress(payer).endCell();
    return lazyInitAddress(FV_CODE_HASH, FV_CODE_DEPTH, data);
}
