# M20Y Local Verification Note

Commands executed in sandbox:

```text
npm ci --ignore-scripts
npm run build
node scripts/hash_codes.js
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/deployment_manifest_m15.ts
npx vitest run tests/vault-m6-publish.test.ts tests/m16-conformance-static.test.ts --testTimeout=30000
```

Results:

- Build: PASS (`artifacts/NPM_BUILD_VAULT_M20Y_EXIT.txt = 0`)
- Hash generation: PASS (`artifacts/HASH_CODES_M20Y_EXIT.txt = 0`)
- Manifest generation: PASS (`artifacts/GENERATE_DEPLOYMENT_MANIFEST_M20Y_EXIT.txt = 0`)
- Targeted M20Y tests: PASS (`artifacts/NPM_TEST_M20Y_TARGETED_EXIT.txt = 0`)
- Vault-key-records retry: PASS (`artifacts/M20Y_FILE_VAULT_KEY_RECORDS_RETRY_EXIT.txt = 0`)

Updated hashes:

```text
VAULT_CODE_HASH=3bb2f05890991151e9bb2dd70a361ed932a24d492e3fbb685c92ff9822b0bfc0
IMPLEMENTED_SUBSET_MANIFEST_HASH=fb1260abe7b47f5c3cc11297d7da0e3c2fed26221e1d77434be89b4a9e980ffb
```

One-shot full-suite still shows the sandbox/Vitest teardown timeout behavior in this environment, so M20Y relies on build + targeted tests + generated artifact integrity/chunk outputs instead of pretending the one-shot command completed cleanly. Humanity endures.
