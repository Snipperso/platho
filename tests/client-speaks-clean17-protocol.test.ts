import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// ONE CONFIG FLAG USED TO DECIDE WHICH PROTOCOL THE CLIENT SPEAKS — AND THEN THE OTHER PROTOCOL WAS DELETED.
//
// History, in three acts. Act one: web/app.js gated fifteen paths on privateLane.directPay; the false branch
// built externals for the Vault, a contract clean-17 deleted, and NOTHING watched the flag — flipping it made
// users pay GRAM for messages no contract receives while the client reported success. Act two (2026-07-31): this
// file pinned the flag to its one legal value and called deleting the dead branches "the real cure and scheduled
// cleanup". Act three (2026-08-29, owner's order): the cure. The fifteen branches, the flag, its config keys, the
// six never-called Vault builders app.js still imported, the whole batch-publish machinery
// (publish-batch-orchestration.mjs and its builders in pwa-contract-transactions.mjs) and the Vault half of the
// pricing tables were deleted outright — 1,900+ lines of dead freight that shipped to every user.
//
// So the guards flip polarity: they no longer hold a flag to its safe value, they hold the DELETION. Resurrection
// arrives innocently — a revert, a cherry-pick from an old branch, a helper someone finds in git history — and
// every one of these names coming back is a path to a deleted contract.

const CONFIG = readFileSync('web/platho-config.mjs', 'utf8');
const APP = readFileSync('web/app.js', 'utf8');

describe('the client speaks the clean-17 protocol', () => {
  it('CLIENT-PROTO-01: the protocol flag is GONE — direct pay is not a mode, it is the only protocol', () => {
    // The reader and the keys must both stay dead: a revived reader with `?.` reads a missing key as false —
    // the dangerous direction, a silent fallback to a deleted contract.
    expect(APP).not.toContain('privateLaneDirectPayEnabled');
    expect(APP).not.toMatch(/appConfig\.(privateLane|publicLane)/);
    // The KEY form, not the word: the config's own retirement note is allowed to say what used to live there.
    expect(CONFIG).not.toMatch(/directPay\s*:/);
  });

  it('CLIENT-PROTO-02: no Vault builder exists anywhere in the shipped client', () => {
    // 2026-07-31 measured app.js importing six of these and calling none; 2026-08-29 deleted them and the rest
    // of the family at the source. The pin is on EVERY shipped web file, not on app.js's call sites: an export
    // nobody imports is exactly how the last resurrection would start.
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
        // MAX_MESSAGE_PARTS's comment in capsule-part-policy NAMES its ancestor on purpose — history is not a
        // resurrection. Only non-comment lines count.
        const lines = src.split('\n').filter((l) => l.includes(name) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
        if (lines.length) offenders.push(`web/${file}: ${name}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('CLIENT-PROTO-03: every opcode the client writes names a message some contract declares — no known-dead list left', () => {
    // The client hand-writes wire opcodes rather than importing generated bindings, so a contract-side rename or
    // a deleted message leaves a live constant pointing at nothing. This gate once carried a KNOWN_DEAD entry for
    // OP_PUBLISH_BATCH (0x7e1f5041, the Vault external op); that constant is deleted, so the allowance is empty
    // and any unmatched opcode — including that one coming back — fails outright.
    const declared = new Set<number>();
    for (const dir of ['contracts', 'contracts18/contracts']) {
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.tact'))) {
        const src = readFileSync(`${dir}/${file}`, 'utf8');
        for (const m of src.matchAll(/^message\((0x[0-9A-Fa-f]+)\)\s+\w+/gm)) declared.add(Number(m[1]));
      }
    }
    expect(declared.size, 'the sweep must find the declared messages').toBeGreaterThan(50);

    // THE DETECTOR ITSELF, both directions. A pattern that stopped matching real opcodes would leave this gate
    // green over a dead constant, which is the failure it exists to prevent; one that matches ordinary words
    // sends a correct constant to the offenders list, which is how it went red on a signing domain.
    const NAMES = /(?:const|let)\s+([A-Z_0-9]*_OPCODE|OP_[A-Z_0-9]+)\s*=\s*(0x[0-9A-Fa-f]+)n?/g;
    const matches = (line: string) => { NAMES.lastIndex = 0; return NAMES.test(line); };
    expect(matches('const CAPSULE_PUBLISH_OPCODE = 0x52535031;'), 'a _OPCODE suffix is an opcode').toBe(true);
    expect(matches('const OP_PUBLISH_BATCH = 0x7e1f5041;'), 'and so is the historical OP_ prefix').toBe(true);
    expect(matches('const KEYSHARD_REGISTER_POP_DOMAIN = 0x4B535031;'),
      'a signing domain is not an opcode — it lives inside a signed cell and never prefixes a message').toBe(false);
    expect(matches('const TOPUP_VALUE = 0x1234;'), 'nor is every constant with those two letters in it').toBe(false);

    const unmatched: string[] = [];
    for (const file of readdirSync('web').filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))) {
      const src = readFileSync(`web/${file}`, 'utf8');
      // AN OPCODE IS NAMED, NOT MERELY SPELLED [audit 2026-09-02]. This matched any constant whose name CONTAINED
      // the letters OP anywhere, so `KEYSHARD_REGISTER_POP_DOMAIN` — a signing domain that lives inside a signed
      // payload cell and never touches the wire as a prefix — was demanded to be a declared message, and the gate
      // went red on a correct constant. The two forms this project actually uses are a `_OPCODE` suffix (all ten
      // live ones) and the historical `OP_` prefix the note above names (OP_PUBLISH_BATCH); anything else is a
      // constant that merely has those two letters in the middle of a word.
      for (const m of src.matchAll(/(?:const|let)\s+([A-Z_0-9]*_OPCODE|OP_[A-Z_0-9]+)\s*=\s*(0x[0-9A-Fa-f]+)n?/g)) {
        const value = Number(m[2]);
        if (declared.has(value)) continue;
        unmatched.push(`web/${file}: ${m[1]} = ${m[2]} matches no message declared in contracts/`);
      }
    }
    expect(unmatched, unmatched.join('\n')).toEqual([]);
  });
});
