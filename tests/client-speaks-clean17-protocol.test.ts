import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';


const CONFIG = readFileSync('web/platho-config.mjs', 'utf8');
const APP = readFileSync('web/app.js', 'utf8');

describe('the client speaks the clean-17 protocol', () => {
  it('CLIENT-PROTO-01: the protocol flag is GONE — direct pay is not a mode, it is the only protocol', () => {
    expect(APP).not.toContain('privateLaneDirectPayEnabled');
    expect(APP).not.toMatch(/appConfig\.(privateLane|publicLane)/);
    expect(CONFIG).not.toMatch(/directPay\s*:/);
  });

  it('CLIENT-PROTO-02: no Vault builder exists anywhere in the shipped client', () => {
    const deadNames = [
      'buildVaultReplaceMessagingKeysExternalBoc',
      'buildVaultWithdrawAthExternalBoc',
      'buildVaultWithdrawTonExternalBoc',
      'buildVaultUsernameMintExternalBoc',
      'buildVaultBalancePublishExternalBoc',
      'buildBatchPublishExternalBoc',
      'buildBatchPublishPartsRoot',
      'createVaultWalletMessage',
      'computeVaultMessagingKeyId',
      'estimateVaultAttachedValueNanotons',
      'batchHoldNanotons',
      'MAX_BATCH_PARTS',
      'publish-batch-orchestration',
    ];
    const offenders: string[] = [];
    for (const file of readdirSync('web').filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))) {
      const src = readFileSync(`web/${file}`, 'utf8');
      for (const name of deadNames) {
        const lines = src.split('\n').filter((l) => l.includes(name) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
        if (lines.length) offenders.push(`web/${file}: ${name}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('CLIENT-PROTO-03: every opcode the client writes names a message some contract declares — no known-dead list left', () => {
    const declared = new Set<number>();
    for (const dir of ['contracts', 'contracts18/contracts']) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.tact'))) {
        const src = readFileSync(`${dir}/${file}`, 'utf8');
        for (const m of src.matchAll(/^message\((0x[0-9A-Fa-f]+)\)\s+\w+/gm)) declared.add(Number(m[1]));
      }
    }
    expect(declared.size, 'the sweep must find the declared messages').toBeGreaterThan(50);

    const NAMES = /(?:const|let)\s+([A-Z_0-9]*_OPCODE|OP_[A-Z_0-9]+)\s*=\s*(0x[0-9A-Fa-f]+)n?/g;
    const matches = (line: string) => { NAMES.lastIndex = 0; return NAMES.test(line); };
    expect(matches('const CAPSULE_PUBLISH_OPCODE = 0x52535031;'), 'a _OPCODE suffix is an opcode').toBe(true);
    expect(matches('const OP_PUBLISH_BATCH = 0x7e1f5041;'), 'and so is the historical OP_ prefix').toBe(true);
    expect(matches('const KEYSHARD_REGISTER_POP_DOMAIN = 0x4B535031;'),
      'a signing domain is not an opcode — it lives inside a signed cell and never prefixes a message').toBe(false);
    expect(matches('const TOPUP_VALUE = 0x1234;'), 'nor is every constant with those two letters in it').toBe(false);

    const FOREIGN = new Map<number, { name: string; proof: string; code: string }>([
      [0x6664DE2A, { name: 'STONFI_SWAP_OPCODE', proof: 'tests/wallet-swap.test.ts', code: 'tests/fixtures/stonfi-v2/' }],
      [0x01F3835D, { name: 'PTON_TON_TRANSFER_OPCODE', proof: 'tests/wallet-swap.test.ts', code: 'tests/fixtures/stonfi-v2/' }],
      [0xEA06185D, { name: 'DEDUST_NATIVE_SWAP_OPCODE', proof: 'tests/wallet-swap-dedust.test.ts', code: 'tests/fixtures/dedust-v2/' }],
      [0xE3A0D482, { name: 'DEDUST_JETTON_SWAP_OPCODE', proof: 'tests/wallet-swap-dedust.test.ts', code: 'tests/fixtures/dedust-v2/' }],
    ]);
    for (const [value, { name, proof, code }] of FOREIGN) {
      const test = readFileSync(proof, 'utf8');
      expect(test, `${name} (0x${value.toString(16)}) is proven where it is allowed`).toContain(name);
      expect(test).toContain(code);
    }
    const unmatched: string[] = [];
    for (const file of readdirSync('web').filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))) {
      const src = readFileSync(`web/${file}`, 'utf8');
      for (const m of src.matchAll(/(?:const|let)\s+([A-Z_0-9]*_OPCODE|OP_[A-Z_0-9]+)\s*=\s*(0x[0-9A-Fa-f]+)n?/g)) {
        const value = Number(m[2]);
        if (FOREIGN.get(value)?.name === m[1]) continue;
        if (declared.has(value)) continue;
        unmatched.push(`web/${file}: ${m[1]} = ${m[2]} matches no message declared in contracts/`);
      }
    }
    expect(unmatched, unmatched.join('\n')).toEqual([]);
  });
});
