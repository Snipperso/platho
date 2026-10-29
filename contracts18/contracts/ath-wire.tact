import "./derive.tact";

const ATH_CODE_HASH: Int = 0x8ab0003bb57c01a359cb9d7642a3c15d7a1550d989fcf8bca6677f7da874e077;
const ATH_CODE_DEPTH: Int = 13;

fun athWalletOf(owner: Address, master: Address): Address {
    let data: Cell = beginCell()
        .storeUint(0, 1)
        .storeInt(0, 257)
        .storeAddress(owner)
        .storeAddress(master)
        .endCell();
    return lazyInitAddress(ATH_CODE_HASH, ATH_CODE_DEPTH, data);
}
