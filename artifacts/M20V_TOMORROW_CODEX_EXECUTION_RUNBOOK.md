# M20V — Tomorrow Codex Execution Runbook

Status: **offline runbook only**  
Network required for execution: **yes, tomorrow**  
Secrets required in repo: **never**

## Purpose

M20V is the single execution runbook for the next live step: **M20T testnet deployment/probe with Codex**.

It does not deploy anything by itself, does not enable production BuybackBurn, and does not turn testnet evidence into mainnet route freeze. Its job is to make tomorrow's Codex run boring, linear, and hard to misunderstand. A thrilling ambition, apparently.

## Starting archive

Use the latest archive that includes M20T and M20U:

```text
platho-m20u-buybackburn-readiness.zip
```

After applying M20V, the runbook-bearing archive is expected to be:

```text
platho-m20v-tomorrow-codex-runbook.zip
```

## Non-negotiable invariants

Codex must not violate any of these:

```text
Do not change production tokenomics.
Do not change FeeAccumulator 51.05 TON buyback envelope semantics.
Do not implement or enable production BuybackBurn.
Do not set STONFI_ROUTE_FREEZE_READY=true.
Do not set BUYBACKBURN_IMPLEMENTATION_READY=true.
Do not treat testnet evidence as mainnet route freeze.
Do not mix mainnet and testnet addresses in the same manifest.
Do not commit mnemonic/seed/private key/.env.testnet.local.
Do not add admin rescue, fallback route, route switch, pause, owner override, governance surface, or ignored-error money send.
```

M20T can prove live testnet behavior. It cannot prove mainnet STON.fi route freeze. This sentence exists because humans keep discovering new ways to confuse environments.

## Files Codex must read first

```text
.env.testnet.example
artifacts/M20T_CODEX_TESTNET_DEPLOYMENT_PROMPT.md
artifacts/M20T_TESTNET_DEPLOYMENT_CHECKLIST.md
artifacts/m20t_testnet_manifest_template.json
artifacts/m20t_testnet_evidence_template.json
artifacts/platho_v1_open_values_v0_20t_testnet_deployment_probe_preflight.md
artifacts/platho_v1_open_values_v0_20u_buybackburn_implementation_readiness.md
```

## Local preflight commands

Run from repository root:

```bash
npm ci
npm run build
npm test
npm run m20t:preflight -- --observed-balance-nanotons <BALANCE>
```

Expected full-suite shape inherited from M19I Step 19:

```text
32 test files passed
134 tests passed
EXIT=0
```

If the sandbox-heavy suite prints the final summary but hangs during Vitest teardown, verify that `vitest.all.config.ts` still uses:

```ts
pool: 'vmThreads'
fileParallelism: false
maxWorkers: 1
minWorkers: 1
```

Do not mislabel a worker-pool teardown issue as a failing test suite. The tests have suffered enough slander.

## Testnet wallet workflow

1. Create `.env.testnet.local` from `.env.testnet.example`.
2. Generate a disposable testnet wallet only for this probe.
3. Store the mnemonic/secret only in `.env.testnet.local` or another ignored local file.
4. Print the testnet deployer address.
5. Check balance.
6. Run `npm run m20t:preflight -- --observed-balance-nanotons <BALANCE>`.

If balance is below the configured requirement:

```text
STATUS=NEED_TESTNET_TON
```

Then stop before pretending deployment evidence exists. Fake evidence is how protocols become folklore.

If preflight reports blockers, stop before sending transactions. Warnings may be recorded, but blockers must not be ignored.

## Funding expectation

For a production-sized envelope probe, the deployer side needs enough testnet TON for:

```text
51.05 TON envelope
+ deploy fees
+ message fees
+ retries / bounce probes
```

If the faucet cannot provide enough immediately, record:

```text
funding_status = NEED_TESTNET_TON
required_balance_nano = <value>
current_balance_nano = <value>
deployer_address = <testnet address>
```

## Execution phases

### Phase 0 — Environment sanity

Record:

```text
node version
npm version
git commit or archive hash
network = testnet
rpc endpoint host, without leaking api key
```

### Phase 1 — Build and tests

Run:

```bash
npm run build
npm test
```

Record outputs into artifacts if the run proceeds beyond local preflight:

```text
artifacts/NPM_BUILD_M20T_TESTNET_OUTPUT.txt
artifacts/NPM_BUILD_M20T_TESTNET_EXIT.txt
artifacts/NPM_TEST_M20T_TESTNET_OUTPUT.txt
artifacts/NPM_TEST_M20T_TESTNET_EXIT.txt
```

### Phase 2 — Deploy/probe readiness

Before sending transactions, confirm:

```text
network = testnet
mainnet address fields are empty or explicitly NOT_APPLICABLE
production readiness flags remain false
no production BuybackBurn is enabled
```

### Phase 3 — Testnet deploy

Deploy only what is needed for M20T. Capture:

```text
deployer address
deployer balance before/after
contract addresses
state init hashes, if available
transaction hashes
explorer links
account states
```

### Phase 4 — Behavioral probes

Where the current harness/contracts support the path, capture:

```text
51.05 TON envelope accepted from authorized path
50 TON raw principal rejected as incomplete envelope
wrong sender rejected
wrong amount rejected
duplicate/replay behavior observed
refund/excess/bounce behavior observed or explicitly NOT_EXECUTED with reason
```

If a path requires production STON.fi route freeze, mark it as:

```text
NOT_EXECUTED_REQUIRES_M20F_MAINNET_ROUTE_FREEZE
```

Do not invent route behavior. The blockchain is annoyingly specific about reality.

### Phase 5 — Evidence files

Codex must create or fill:

```text
artifacts/m20t_testnet_manifest.json
artifacts/m20t_testnet_evidence.json
artifacts/M20T_TESTNET_EVIDENCE.md
artifacts/m20t_execution_preflight.json
artifacts/M20T_EXECUTION_PREFLIGHT.md
```

Each proof item must contain either:

```text
REAL_TX_HASH + explorer link + observed result
```

or:

```text
NOT_EXECUTED + exact reason
```

No blank placeholders in final evidence.

## Required manifest labels

Every M20T evidence file must include:

```text
NETWORK = testnet
EVIDENCE_SCOPE = TESTNET_BEHAVIORAL_PROBE
NOT_MAINNET_ROUTE_FREEZE = true
STONFI_ROUTE_FREEZE_READY = false
BUYBACKBURN_IMPLEMENTATION_READY = false
```

## Exact result labels

Use these labels so later audit scripts and tired humans can parse the result:

```text
M20T_READY_FOR_FUNDING
NEED_TESTNET_TON
M20T_DEPLOY_EXECUTED
M20T_DEPLOY_PARTIAL
M20T_PROBE_COMPLETE
M20T_PROBE_INCOMPLETE
M20T_BLOCKED_BY_ENVIRONMENT
M20T_BLOCKED_BY_MISSING_ROUTE_FREEZE
```

## What to send back to Larisa

Return this compact report:

```text
M20T status: <label>
Deployer testnet address: <address or NOT_CREATED>
Balance before: <nanoTON or NOT_CHECKED>
Balance after: <nanoTON or NOT_CHECKED>
Contracts deployed: <list or NOT_DEPLOYED>
Successful tx hashes: <list>
Failed tx hashes: <list>
Evidence files created: <list>
Full suite: <PASS/FAIL/NOT_RUN + reason>
Production flags: <must remain false>
Secrets committed: <must be no>
Mainnet route freeze: <must be no>
Next blocker: <funding / route freeze / implementation / none>
```

## Stop conditions

Stop immediately and do not continue if:

```text
Codex detects mainnet network while running M20T.
A mainnet address is about to be written into testnet manifest.
A seed/private key would be committed.
A production readiness flag would be flipped.
The route evidence requires mainnet STON.fi freeze.
The deployer balance is below required threshold.
```

## Acceptance criteria for tomorrow

M20T is considered complete only if:

```text
full suite is green or any non-green result is explained with exact failure output
all evidence files are filled
all executed probes have tx hashes/explorer links
all non-executed probes have exact NOT_EXECUTED reasons
production flags remain false
testnet/mainnet separation is explicit
no secrets are committed
```

M20T completion still leaves M20F required:

```text
M20F_MAINNET_STONFI_ROUTE_FREEZE_READY = false
BUYBACKBURN_IMPLEMENTATION_READY = false
```

## Next step after successful M20T

After M20T evidence is reviewed, proceed to M20F mainnet STON.fi route freeze:

```text
mainnet router address
mainnet pool address
mainnet pTON address
mainnet code hashes
official SDK/API tx params
live quote
refund/excess/bounce evidence
min_out policy
```

Only after both M20T and M20F are complete can M20U readiness allow production BuybackBurn implementation.
