import { createHash } from 'node:crypto';
import { TON_MNEMONIC_WORDLIST } from '../../web/ton-mnemonic-wordlist.mjs';
import { validateTonMnemonic } from '../../web/platho-wallet.mjs';

export async function testMnemonic(label: string): Promise<string[]> {
  for (let attempt = 0; ; attempt += 1) {
    const words = Array.from({ length: 24 }, (_unused, i) => {
      const digest = createHash('sha256').update(`${label}:${attempt}:${i}`).digest();
      return TON_MNEMONIC_WORDLIST[digest.readUInt16BE(0) % TON_MNEMONIC_WORDLIST.length];
    });
    if (await validateTonMnemonic(words)) return words;
  }
}
