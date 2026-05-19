import { describe, expect, it } from 'vitest';

describe('vanity TON wallet script helpers', () => {
  it('normalizes exact suffix candidates and rejects non-address characters', async () => {
    const mod = await import('../scripts/vanity_ton_wallet.mjs');

    expect(mod.normalizeSuffixes('PATH,OATH,MATH,ATHO,PLATHO,PATH')).toEqual(['PATH', 'OATH', 'MATH', 'ATHO', 'PLATHO']);
    expect(() => mod.normalizeSuffixes('ATH!')).toThrow(/outside TON friendly-address alphabet/);
  });

  it('estimates exact 4-character suffix attempts by suffix count', async () => {
    const mod = await import('../scripts/vanity_ton_wallet.mjs');

    expect(mod.expectedAttempts(['PATH'])).toBe(64 ** 4);
    expect(mod.expectedAttempts(['PATH'], 'both')).toBe((64 ** 4) / 2);
    expect(mod.expectedAttempts(['PATH', 'OATH', 'MATH', 'ATHO', 'PLATHO'])).toBe(Math.ceil(1 / ((4 / (64 ** 4)) + (1 / (64 ** 6)))));
  });

  it('parses safe estimate-only command line without secret output', async () => {
    const mod = await import('../scripts/vanity_ton_wallet.mjs');
    const parsed = mod.parseArgs([
      '--suffix',
      'ATHO,PATH',
      '--wallet',
      'both',
      '--workers',
      'max',
      '--estimate-only',
      '--keep-going',
      '--out',
      'artifacts/local/test.jsonl',
    ]);

    expect(parsed.suffixes).toEqual(['ATHO', 'PATH']);
    expect(parsed.walletVersion).toBe('both');
    expect(parsed.workers).toBeGreaterThanOrEqual(1);
    expect(parsed.estimateOnly).toBe(true);
    expect(parsed.keepGoing).toBe(true);
    expect(parsed.outPath).toBe('artifacts/local/test.jsonl');
    expect(parsed.allowSecretOutput).toBe(false);
  });
});
