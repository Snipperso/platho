// Test-only: exposes the raw TVM checkSignature opcode so a sandbox test can prove that a clause-blind-Schnorr
// signature (the clean-16 anonymous-publish token) is accepted by the ACTUAL on-chain ed25519 verifier — the
// crypto gate's belt-and-suspenders confirmation (JS noble RFC-8032 verify already passed 300/300).
// Not part of Platho production contracts.
contract MockCheckSig {
    receive() {}

    get fun check(hash: Int, signature: Slice, public_key: Int): Bool {
        return checkSignature(hash, signature, public_key);
    }
}
