import { runPlathoCryptoSelfTest } from '../web/crypto/platho-crypto.mjs';

// clean-17: the Vault chain-binding self-test went with the Vault (identity now binds through KeyShard, whose
// address-derivation binding is covered by the KeyShard suite, not by a crypto-primitive self-test).
const result = await runPlathoCryptoSelfTest();

console.log(JSON.stringify(result, null, 2));
