import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// ONE CONFIG FLAG DECIDES WHICH PROTOCOL THE CLIENT SPEAKS, AND NOTHING WATCHED IT.
//
// web/app.js gates fifteen paths on privateLaneDirectPayEnabled(), which is `appConfig.privateLane?.directPay ===
// true`. On the true branch the client talks to the clean-17 shards. On the false branch it falls back to building
// Vault externals — for a contract that was DELETED. It is true in web/platho-config.mjs today, and before this file
// there was not one test, script or guard anywhere in the repository that mentioned `privateLane`.
//
// Flip it, rename the key in a config refactor, or drop the block while moving something else out of it (that has
// already happened once to a neighbouring field — see the comment under `privateLane` about `genesis` moving out of
// the old `vault` block), and the app starts signing externals no contract on chain receives. The user pays the
// GRAM; nothing happens; the client reports a send.
//
// The client is redeployable, so this is repairable — but only if somebody notices, and a silent protocol fallback
// is exactly the kind of thing nobody notices until users are already paying for it.
//
// Deleting the dead branches outright is the real cure and is scheduled cleanup. Until then the flag is not a
// feature toggle: it has exactly one legal value.

const CONFIG = readFileSync('web/platho-config.mjs', 'utf8');
const APP = readFileSync('web/app.js', 'utf8');

describe('the client speaks the clean-17 protocol', () => {
  it('CLIENT-PROTO-01: privateLane.directPay is true, because the other branch targets deleted contracts', () => {
    // BOTH lanes, not just the private one. The first draft of this guard matched `privateLane` alone and would
    // have passed while publicLane.directPay was anything at all — checking one of two identically-named flags is
    // the same half-blindness this file exists to prevent, so the sweep takes every directPay in the config.
    const flags = [...CONFIG.matchAll(/(\w+Lane):\s*\{([\s\S]*?)\}/g)]
      .map(([, lane, body]) => ({ lane, value: /directPay:\s*true/.test(body) }));
    expect(flags.length, 'web/platho-config.mjs must still carry the lane blocks').toBeGreaterThanOrEqual(2);

    const off = flags.filter((f) => !f.value).map((f) => f.lane);
    expect(off, `${off.join(', ')}: directPay must be true. The false branch builds Vault externals, and Vault does `
      + 'not exist in clean-17: every send down that path is GRAM spent on a message no contract receives.')
      .toEqual([]);

    // Measured 2026-07-31: privateLane.directPay gates fifteen paths in app.js; publicLane.directPay is read by
    // NOTHING, because the public lane was cut over wholesale and the flag is vestigial. Recorded rather than
    // trimmed to a single check, so that if the live one ever stops being read — which would mean the gate quietly
    // stopped applying — this stops being true and says so.
    expect((APP.match(/privateLaneDirectPayEnabled\(\)/g) ?? []).length,
      'privateLane.directPay is no longer gating the private lane paths').toBeGreaterThan(5);

    // And the reader must still be reading that key. A rename on either side re-opens the same hole from the
    // other end, and `?.` makes a missing key read as false — the dangerous value — rather than throwing.
    expect(/appConfig\.privateLane\?\.directPay === true/.test(APP),
      'app.js no longer reads privateLane.directPay the way this guard checks it').toBe(true);
  });

  it('CLIENT-PROTO-02: no Vault external builder is reachable from the app', () => {
    // Measured 2026-07-31: app.js still IMPORTS six of these and calls none. An unused import is debt; a call is a
    // live path to a contract that was deleted. Pinning zero call sites is what stops the debt turning back into a
    // path when someone re-wires a screen and finds a conveniently-named helper still exported.
    const deadBuilders = [
      'buildVaultReplaceMessagingKeysExternalBoc',
      'buildVaultWithdrawAthExternalBoc',
      'buildVaultWithdrawTonExternalBoc',
      'buildVaultUsernameMintExternalBoc',
      'createVaultWalletMessage',
      'computeVaultMessagingKeyId',
    ];
    const called = deadBuilders.filter((name) => new RegExp(`${name}\\s*\\(`).test(APP));
    expect(called, `these build messages for the deleted Vault and are CALLED from app.js:\n${called.join('\n')}`)
      .toEqual([]);
  });

  it('CLIENT-PROTO-03: every opcode the client writes names a message some contract declares', () => {
    // The client hand-writes wire opcodes rather than importing generated bindings, so a contract-side rename or a
    // deleted message leaves a live constant pointing at nothing. This repo already has one: OP_PUBLISH_BATCH
    // (0x7e1f5041), the Vault external op, still exported from pwa-contract-transactions.mjs. It is listed below as
    // known-dead precisely so a NEW unmatched opcode fails instead of joining it quietly.
    const declared = new Set<number>();
    for (const file of readdirSync('contracts').filter((f) => f.endsWith('.tact'))) {
      const src = readFileSync(`contracts/${file}`, 'utf8');
      for (const m of src.matchAll(/^message\((0x[0-9A-Fa-f]+)\)\s+\w+/gm)) declared.add(Number(m[1]));
    }
    expect(declared.size, 'the sweep must find the declared messages').toBeGreaterThan(50);

    /** Opcodes that deliberately match no contract message, each with why it is harmless. */
    const KNOWN_DEAD = new Map<number, string>([
      [0x7e1f5041, 'Vault PublishBatchFromVaultBalance — Vault is deleted; the only caller, '
        + 'buildBatchPublishExternalBody, is unreachable from app.js (CLIENT-PROTO-02 pins that)'],
    ]);

    const unmatched: string[] = [];
    for (const file of readdirSync('web').filter((f) => f.endsWith('.mjs') || f.endsWith('.js'))) {
      const src = readFileSync(`web/${file}`, 'utf8');
      for (const m of src.matchAll(/(?:const|let)\s+([A-Z_0-9]*(?:OPCODE|OP)[A-Z_0-9]*)\s*=\s*(0x[0-9A-Fa-f]+)n?/g)) {
        const value = Number(m[2]);
        if (declared.has(value) || KNOWN_DEAD.has(value)) continue;
        unmatched.push(`web/${file}: ${m[1]} = ${m[2]} matches no message declared in contracts/`);
      }
    }
    expect(unmatched, unmatched.join('\n')).toEqual([]);
  });
});
