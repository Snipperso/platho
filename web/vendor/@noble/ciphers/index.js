/**
 * Audited & minimal JS implementation of Salsa20, ChaCha and AES. Check out individual modules.
 * @example
```js
import { gcm, aessiv } from '../ciphers/aes.js';
import { xsalsa20poly1305 } from '../ciphers/salsa.js';
import { secretbox } from '../ciphers/salsa.js'; // == xsalsa20poly1305
import { chacha20poly1305, xchacha20poly1305 } from '../ciphers/chacha.js';

// Unauthenticated encryption: make sure to use HMAC or similar
import { ctr, cfb, cbc, ecb } from '../ciphers/aes.js';
import { salsa20, xsalsa20 } from '../ciphers/salsa.js';
import { chacha20, xchacha20, chacha8, chacha12 } from '../ciphers/chacha.js';

// KW
import { aeskw, aeskwp } from '../ciphers/aes.js';

// Utilities
import { managedNonce, randomBytes, bytesToHex, hexToBytes } from '../ciphers/utils.js';
import { poly1305 } from '../ciphers/_poly1305.js';
import { ghash, polyval } from '../ciphers/_polyval.js';
```
 * @module
 */
throw new Error('root module cannot be imported: import submodules instead. Check out README');
export {};
//# sourceMappingURL=index.js.map