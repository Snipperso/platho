import { runPlathoCryptoSelfTest } from '../web/crypto/platho-crypto.mjs';

const result = await runPlathoCryptoSelfTest();

console.log(JSON.stringify(result, null, 2));
