import "./derive.tact";

const FS_SINK_COUNT: Int = 64;

const FS_TREASURY: Address = address("UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH");

const FS_CODE_HASH: Int = 0x01e71a9c9f0696882330a6cc03b19eb01b3a8ff36bcaf18f8a975a58a151fe3d;
const FS_CODE_DEPTH: Int = 4;

message(0xFF775609) DepositProtocolFee {
    amount: Int as uint128;
}

fun sinkAddressOf(index: Int): Address {
    let data: Cell = beginCell().storeUint(0, 1).storeAddress(FS_TREASURY).storeInt(index, 257).endCell();
    return lazyInitAddress(FS_CODE_HASH, FS_CODE_DEPTH, data);
}
