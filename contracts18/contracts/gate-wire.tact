import "./derive.tact";
import "./moderation-wire.tact";

const SS_CODE_HASH: Int = 0x521771ffefc4927a2a9c0f5557ed61846f585c646d6fd408d14540b39c98c6c7;

const MG_CODE_HASH: Int = 0x4a38c6d1b1265baf9ccc3da0f750d66b27c3f313eb3386838c560dc5b5fc94cc;
const MG_CODE_DEPTH: Int = 5;
const MG_DEPLOYER: Address = address("UQBrx78fC53CS-IRF4-fYgIUlwCgcfWZ3RKano9eGFXHe08H");

fun moderationGateAddress(): Address {
    let data: Cell = beginCell().storeUint(0, 1).storeAddress(MG_DEPLOYER).endCell();
    return lazyInitAddress(MG_CODE_HASH, MG_CODE_DEPTH, data);
}
