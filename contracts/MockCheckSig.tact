contract MockCheckSig {
    receive() {}

    get fun check(hash: Int, signature: Slice, public_key: Int): Bool {
        return checkSignature(hash, signature, public_key);
    }
}
