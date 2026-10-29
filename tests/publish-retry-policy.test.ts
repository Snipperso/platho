import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';


describe('publish double-spend gate — direct pay', () => {
  const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');

  it('PUBLISH-RETRY-01: a wallet external is bound to a seqno and its BOC is handed back on an ambiguous send', () => {
    expect(wallet).toMatch(/seqno = options\.seqno \?\? await resolveWalletSendSeqno\(wallet, transport, options\)/);
    expect(wallet).toMatch(/error\.builtBoc = built\.boc; error\.builtSeqno = seqno;/);
    expect(wallet).toMatch(/if \(!definitivelyRejected && error && typeof error === 'object' && built\?\.boc/);
    expect(wallet).toMatch(/if \(seqnoMismatch\) resetWalletSeqnoFloor\(wallet\)/);
  });
});
