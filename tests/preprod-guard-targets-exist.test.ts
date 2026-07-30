import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// THE LAST PRODUCTION GATE, and it was aimed at two contracts that no longer exist.
//
// preprod_guard requires the publish-reserve-pricing report to carry code hashes matching CURRENT_CODE_HASHES.txt.
// The list it compared against named `vault` and `capsulehub` — both DELETED in clean-17. Neither key is in
// CURRENT_CODE_HASHES.txt any more, so both lookups returned undefined and the comparison failed unconditionally:
// no report, however carefully produced, could have satisfied it. The gate was unpassable by construction, and the
// discovery would have happened at seal time, on the last step before a production deploy.
//
// This is the third time in this repo that a guard has been left pointing at something that was removed. So the fix
// is not just the list — it is this test, which fails whenever the guard names a contract the hash file does not
// carry. A guard aimed at a deleted thing is an ABSENT guard, and it looks exactly like a working one.

const GUARD = readFileSync('scripts/preprod_guard.mjs', 'utf8');
const HASHES = readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8');

/** Keys the hash artefact actually carries. */
function hashKeys(): Set<string> {
  return new Set(HASHES.split(/\r?\n/).map((l) => l.split('=')[0].trim()).filter(Boolean));
}

describe('preprod guard targets exist', () => {
  it('PREPROD-HASH-01: every code hash the guard compares against is one the hash artefact carries', () => {
    const keys = hashKeys();
    expect(keys.size, 'the hash artefact must list the built contracts').toBeGreaterThan(10);

    // Every `['name', 'SOME_CODE_HASH']` pair in the guard.
    const pairs = [...GUARD.matchAll(/\[\s*'(\w+)'\s*,\s*'(\w+_CODE_HASH)'\s*\]/g)]
      .map((m) => ({ reportKey: m[1], hashKey: m[2] }));
    expect(pairs.length, 'the sweep must find the guard code-hash pairs').toBeGreaterThan(2);

    const dead = pairs.filter((p) => !keys.has(p.hashKey));
    expect(dead, `the guard compares against hashes CURRENT_CODE_HASHES.txt does not have, so the check can NEVER `
      + `pass:\n${dead.map((d) => `  ${d.reportKey} -> ${d.hashKey}`).join('\n')}`).toEqual([]);
  });

  it('PREPROD-HASH-03: the guard compares every code hash the final manifest actually carries', () => {
    // PREPROD-HASH-01 catches a guard aimed at something DELETED. It does not catch the opposite, and the opposite
    // had already happened: CURRENT_CODE_HASH_TO_MANIFEST_KEY listed nine contracts while the manifest carried
    // fourteen, so record_shard, intro_shard, public_shard, airdrop_pool and airdrop_ticket — every user message and
    // the whole 15M ATH airdrop — were never compared against the manifest by the last production gate. It also
    // rejected them as "extra" keys, making the gate blind and unpassable at the same time.
    //
    // A guard that only asks "does the target exist?" misses "is anything untargeted?". This asks the second.
    const draftPath = 'artifacts/local/mainnet_final_manifest_draft.json';
    if (!existsSync(draftPath)) {
      // eslint-disable-next-line no-console
      console.warn(`[PREPROD-HASH-03] ${draftPath} absent — run npm run mainnet:manifest:draft`);
      return;
    }
    const manifestKeys = Object.keys(JSON.parse(readFileSync(draftPath, 'utf8')).manifest?.code_hashes ?? {});
    expect(manifestKeys.length, 'the manifest must carry the deployed code hashes').toBeGreaterThan(10);

    const compared = new Set(
      [...GUARD.matchAll(/^\s*(\w+_CODE_HASH):\s*'(\w+)',$/gm)].map((m) => m[2]),
    );
    expect(compared.size, 'the sweep must find the guard manifest map').toBeGreaterThan(8);

    const untargeted = manifestKeys.filter((k) => !compared.has(k));
    expect(untargeted, 'the final production gate never compares these manifest code hashes against anything, so a '
      + `drifted contract would ship unnoticed:\n${untargeted.join('\n')}`).toEqual([]);
  });

  it('PREPROD-HASH-02: no removed contract is still named anywhere in the guard', () => {
    // Vault and CapsuleHub were deleted wholesale in clean-17. A live reference to either in the gate that blocks
    // production is, by construction, a comparison against nothing.
    const removed = ['VAULT_CODE_HASH', 'CAPSULEHUB_CODE_HASH'];
    const alive = removed.filter((name) => new RegExp(`'${name}'`).test(GUARD));
    expect(alive, `these name contracts clean-17 deleted:\n${alive.join('\n')}`).toEqual([]);
  });
});
