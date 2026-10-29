fun lazyInitAddress(code_hash: Int, code_depth: Int, data: Cell): Address {
    let preimage: Slice = beginCell()
        .storeUint(0x02, 8)
        .storeUint(0x01, 8)
        .storeUint(0x34, 8)
        .storeUint(code_depth, 16)
        .storeUint(0, 16)
        .storeUint(code_hash, 256)
        .storeUint(data.hash(), 256)
        .endCell().asSlice();
    return newAddress(0, sha256(preimage));
}
