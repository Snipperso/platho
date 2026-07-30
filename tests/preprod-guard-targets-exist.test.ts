import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  CONTRACT_TO_CURRENT_CODE_HASH_KEY,
  CURRENT_CODE_HASH_TO_MANIFEST_KEY,
  DEPLOY_ACTION_TO_CONTRACT,
} from '../scripts/release-gate-contract-map.mjs';

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

    // The map now lives in the single source both the gate and release-truth import; scanning the gate itself
    // would find nothing and pass vacuously — which is the failure this whole file exists to catch.
    const compared = new Set(Object.values(CURRENT_CODE_HASH_TO_MANIFEST_KEY as Record<string, string>));
    expect(compared.size, 'the shared map must carry the manifest keys').toBeGreaterThan(8);

    const untargeted = manifestKeys.filter((k) => !compared.has(k));
    expect(untargeted, 'the final production gate never compares these manifest code hashes against anything, so a '
      + `drifted contract would ship unnoticed:\n${untargeted.join('\n')}`).toEqual([]);
  });

  it('PREPROD-HASH-04: every deploy step that carries a code hash is one the gate recognises', () => {
    // The gate's deploy loop skipped unrecognised actions with a bare `continue`, and one WAS unrecognised:
    // D07 'Deploy AirdropPool' — the contract holding the entire 15M ATH airdrop — had its packet code hash
    // compared against nothing, silently, on the last check before a production deploy. Both the gate's map and
    // this test file's copy of it were missing the entry, so nothing anywhere noticed.
    //
    // Derived from the PACKET, so the next contract added to the ceremony fails here rather than being skipped.
    const packetPath = 'artifacts/local/mainnet_deploy_packet.json';
    if (!existsSync(packetPath)) {
      // eslint-disable-next-line no-console
      console.warn(`[PREPROD-HASH-04] ${packetPath} absent — run npm run mainnet:deploy:packet`);
      return;
    }
    const steps: any[] = JSON.parse(readFileSync(packetPath, 'utf8')).phase_1_deploy_contracts ?? [];
    const withHash = steps.filter((s) => s?.code_hash);
    expect(withHash.length, 'the packet must carry deploy steps with code hashes').toBeGreaterThan(6);

    const unmapped = withHash
      .filter((s) => !(s.action in (DEPLOY_ACTION_TO_CONTRACT as Record<string, string>)))
      .map((s) => `${s.id} ${s.action}`);
    expect(unmapped, 'these deploy steps carry a code hash the production gate never compares:\n'
      + unmapped.join('\n')).toEqual([]);

    // And each mapped contract must reach a real hash key, or the comparison silently reads undefined.
    const unreachable = withHash
      .map((s) => (DEPLOY_ACTION_TO_CONTRACT as Record<string, string>)[s.action])
      .filter((c) => c && !hashKeys().has((CONTRACT_TO_CURRENT_CODE_HASH_KEY as Record<string, string>)[c]));
    expect(unreachable, `these contracts map to a hash key CURRENT_CODE_HASHES.txt does not carry:\n${unreachable.join('\n')}`)
      .toEqual([]);
  });

  it('PREPROD-HASH-05: the gate and this suite read ONE copy of the contract maps, not two', () => {
    // What actually caused the blind spot: scripts/preprod_guard.mjs and tests/release-truth-single-source.test.ts
    // each declared the same six constants. The test's manifest map listed fourteen contracts, the gate's listed
    // nine, and the suite was green throughout because each side checked its own copy. Re-introducing a local
    // declaration in either file re-opens exactly that, so it fails here.
    const sources: Array<[string, string]> = [
      ['scripts/preprod_guard.mjs', GUARD],
      ['tests/release-truth-single-source.test.ts', readFileSync('tests/release-truth-single-source.test.ts', 'utf8')],
    ];
    const shared = ['CURRENT_CODE_HASH_TO_MANIFEST_KEY', 'PRODUCTION_ONLY_CODE_HASH_KEYS',
      'CONTRACT_TO_CURRENT_CODE_HASH_KEY', 'DEPLOY_ACTION_TO_CONTRACT', 'POST_POOL_COMMANDS',
      'TEST_DEPLOY_TARGET_RE'];

    const redeclared: string[] = [];
    for (const [file, text] of sources) {
      for (const name of shared) {
        if (new RegExp(`^\\s*const ${name}\\b`, 'm').test(text)) redeclared.push(`${file}: ${name}`);
      }
      if (!/release-gate-contract-map\.mjs/.test(text)) redeclared.push(`${file}: does not import the shared map`);
    }
    expect(redeclared, `these re-declare a constant that must have exactly one source:\n${redeclared.join('\n')}`)
      .toEqual([]);
  });

  it('PREPROD-HASH-02: no removed contract is still named anywhere in the guard', () => {
    // Vault and CapsuleHub were deleted wholesale in clean-17. A live reference to either in the gate that blocks
    // production is, by construction, a comparison against nothing.
    const removed = ['VAULT_CODE_HASH', 'CAPSULEHUB_CODE_HASH'];
    const alive = removed.filter((name) => new RegExp(`'${name}'`).test(GUARD));
    expect(alive, `these name contracts clean-17 deleted:\n${alive.join('\n')}`).toEqual([]);
  });
});
