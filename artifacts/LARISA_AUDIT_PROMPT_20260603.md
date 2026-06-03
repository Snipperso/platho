Лариса, нужен свежий predeploy-аудит Platho V1 по приложенному архиву.

Не исходи из того, что прошлые раунды что-то доказали. Проверь текущий архив заново, по коду и артефактам. Но не раздувай findings за счёт нереалистичных ручных ошибок пользователя или вкусовых претензий. Нас интересуют реальные риски уровня: кто угодно украл/заморозил средства, кто угодно сломал контракты, ledger стал under-backed, контракты умерли из-за storage/reserve/gas, PWA подписывает не то, что поддерживают контракты, deploy evidence врёт.

## Цель аудита

Platho V1 — immutable TON/Tact contracts + static PWA. После mainnet-деплоя контрактные ошибки нельзя будет “потом поправить”, поэтому проверяй строго.

Ищи только реальные проблемы, которые могут привести к:

- theft/loss/stuck TON or ATH;
- under-backed internal Vault/Profile/Username/ATH ledger;
- unauthorized state mutation;
- replay, nonce bypass, duplicate debit, duplicate claim;
- wrong refund/due/treasury/burn/buyback accounting;
- permanent griefing of other users or protocol state;
- unbounded gas/raw-balance drain beyond an explicitly charged reserve;
- storage/rent/reserve insolvency;
- broken immutable genesis/seal/bind/deploy state;
- PWA signing/sending/claiming flows that contradict contract semantics;
- message unavailability or unverifiable content in normal product use;
- docs/web copy materially promising something false about protocol behavior.

Do not spend contract findings on:

- custom client intentionally sending too much value;
- user manually sending funds to the wrong address;
- direct contract use that bypasses official PWA warnings and only harms the sender;
- “would be cleaner if” refactors;
- purely cosmetic naming/style issues;
- adding contract checks for impossible official-flow states when a PWA/predeploy guard is the right boundary.

If the right fix is PWA UX, docs, deploy gate, or regression test, say that. Do not demand contract bloat for metaphysical safety.

## Accepted Product / Protocol Decisions

These are intentional. Audit consistency and safety, not whether the decision is aesthetically ideal.

### Protocol Fee / Pricing

Current Platho publish protocol-fee component:

```text
0.010 TON = 10,000,000 nanotons
```

This is only the Platho protocol fee component. It is not the whole user price.

ATH discount logic is accepted:

- before `airdrop_remaining_ath == 0`, publish protocol-fee discounts are locked;
- after unlock, internal ATH balance in Vault can discount only the Platho protocol-fee component;
- at `10,000 ATH`, the user reaches full protocol-fee discount tier;
- maximum protocol-fee reduction is `0.010 TON` per capsule;
- network fee, storage reserve, execution reserve, hold, surcharge and non-protocol components are still paid;
- ATH reward/discount is not refund, cashback, reimbursement, investment return, or price guarantee.

Report a finding only if discount:

- unlocks before `airdrop_remaining_ath == 0`;
- discounts network/storage/reserve/surcharge instead of protocol fee;
- creates under-backed accounting;
- makes CapsuleHub accrued fee inconsistent;
- conflicts between contract/PWA/docs/tests/artifacts.

Do not report “old 0.005 TON protocol-fee floor missing” as a bug. There is no accepted 0.005 TON Platho fee floor now. If `0.005 TON` appears, check whether it is the included network-fee allowance, not the Platho fee.

### User Price Copy

Public/product copy may say messages start around:

```text
from 0.0337 TON
```

Technical pricing artifacts may show exact examples, currently expected around:

```text
public 1K net: 0.0337 TON
private hybrid 1K net: 0.0347 TON
larger private classes cost more
```

This is not a conflict if docs distinguish product label from exact canonical examples.

### Body Storage Model

CapsuleHub must not store heavy message bodies in state.

Correct model:

- CapsuleHub state stores compact metadata/hash/header/index/created_at;
- heavy public/private body is in accepted Vault -> CapsuleHub transaction body;
- PWA retrieves body from TON message/transaction history;
- PWA verifies body/header hashes against CapsuleHub state;
- availability depends on provider history and local encrypted cache;
- compact entries can be pruned after retention.

Do not require body-in-state. Report only if PWA trusts unverified off-chain/static body as chain-backed content, or docs falsely promise permanent archival recovery.

### Privacy / Wallet Sender Boundary

Official product direction:

- primary account activation can use the embedded Platho wallet as the initial wallet ownership anchor;
- routine product actions should go through Vault-auth-signed external flows where the contract supports it;
- payment checks must not require the recipient wallet to claim through Tonkeeper;
- key rotation after activation should not require a wallet-sender transaction;
- deposit/withdraw and explicit wallet TON transfers naturally involve the external wallet.

Audit whether the current contracts/PWA respect that boundary. Contract finding only if an official flow leaks or requires wallet-sender use unnecessarily where Vault-auth external flow exists and should be used.

### Mainnet / Production Gates

If the archive is still preview or `MAINNET_GENESIS_VERIFIED=false`, report that once as a release gate. Do not repeat it as a code bug in every section unless some artifact falsely claims production-ready.

Production/static deploy must not pass while real preprod gates are false.

### Buyback / Market Stability

Buyback route and MarketStabilitySeller can be staged. Not a core deploy blocker if:

- contracts deploy fail-closed with buyback/seller inactive;
- buyback execution requires route freeze/evidence;
- seller execution requires pricing/reserve readiness.

Report only if execution can happen prematurely, route/pricing/funding evidence can be bypassed, funds can be lost/stuck, or docs claim readiness while gates are false.

### Russian/Internal Docs

Russian drafts/internal docs may exist in artifacts. They must not be included in public static web package unless explicitly intended. Report if public package ships internal/RU draft docs or stale product promises.

## Method

Unpack the archive and build an inventory:

- contracts;
- generated build bindings;
- tests;
- PWA modules;
- docs/specs;
- deploy/config/artifacts;
- pricing/economics artifacts.

Audit one section per session. After each section report, wait for “дальше”.

For each section:

- read current code carefully;
- compare contract ↔ tests ↔ PWA ↔ docs ↔ artifacts;
- do not trust PASS artifacts blindly; verify what they prove;
- build concrete failure scenarios;
- state whether this is static audit/artifact review or runtime test run;
- if a finding depends on an assumption, say so explicitly.

Finding format:

- Scope;
- Invariants checked;
- Findings;
- Severity: BLOCKER / HIGH / MEDIUM / LOW / INFO;
- exact file/function;
- scenario;
- impact;
- recommended fix direction;
- required regression tests;
- итог: PASS / PASS with notes / NOT READY.

Severity calibration:

- BLOCKER: realistic deploy/product path can lose funds, under-back ledger, break immutable genesis, or make production unsafe now.
- HIGH: serious security/accounting/availability bug in normal or plausible adversarial use.
- MEDIUM: real production risk or important release/UX safety issue, but not immediate catastrophic contract failure.
- LOW: small edge, mostly self-inflicted or docs/test hardening with limited harm.
- INFO: accepted limitation; not a blocker unless docs claim otherwise.

## Required Sections

### SECTION 0 — Inventory / Architecture / Release State

Check contract list, PWA module list, code hashes, manifest hash, config mode, preview vs production, stale artifacts, archive hygiene, production gates, public static package contents.

### SECTION 1 — Vault

Check deposit/withdraw, internal TON/ATH balances, raw backing, auth key vs messaging key, register/replace messaging keys, receive intents/payment checks, external signed publish/profile/username flows, nonce/replay, acceptMessage placement, pre-accept gas, pending maps, ACK/refund/bounce handling, failed path bounds, pricing/discount, seal/bind/genesis/basechain.

Special attention:

- payment check create/claim/cancel credits correct internal Vault balances;
- claim does not require recipient wallet sender transaction;
- key rotation does not require wallet sender transaction;
- stale nonce and invalid maxCharge paths cannot drain raw Vault unexpectedly;
- 16/32 KiB private paths validate size/crypto before unsafe accepts;
- no path makes user internal balance richer than raw backing.

### SECTION 2 — CapsuleHub

Check private/public publish auth, fee accrual, body/header/hash verification, off-state body model, created_at, prune, storage reserve, fee flush, body lookup assumptions, ACK/bounce to Vault, excess reserve behavior.

### SECTION 3 — ATHMaster / ATHWallet

Check supply, owner wallet derivation, transfer/burn/notification/ACK/refund/tombstone/prune semantics, Vault-funded registry flows, notification sender_key uniqueness, bounce/failure proof, no under-backed registry/Vault accounting, no premature refund.

### SECTION 4 — FeeAccumulator / BuybackBurn / MarketStabilitySeller

Check protocol fee deposits, split/flush/bounce restore, buyback route freeze, reserve acceptance, STON.fi route/refund/burn state machine, MarketStability pricing/reserve gates, treasury receiver safety, staged inactive behavior.

### SECTION 5 — ProfileRegistry

Check direct and Vault-funded avatar update, exact ATH price, official ATH wallet auth, Vault payer auth, treasury/burn split, due flush/failure restore, typed TON excess refund to Vault, avatar pointer validity, storage economics, bind/seal/basechain/treasury receiver negative checks.

### SECTION 6 — UsernameRegistry / UsernameNFTItem

Check username validation policy, pricing tiers, direct/Vault-funded mint, pending duplicate/finalized duplicate, NFT item deploy/init/ACK/resend/bounce, owner assignment, registry record vs item ownership, transfer, refund due, treasury/burn split, non-destructive stale pending behavior, storage economics, bind/seal/basechain/treasury receiver negative checks.

### SECTION 7 — Deployment / Genesis / Seal / Manifest

Check final manifest, current code hashes, StateInit hashes, reciprocal bind graph, seal requirements, funding-before-usability, treasury role graph, official ATH wallet ownership/backing, local vs final artifacts, preprod guard, production static package gate.

### SECTION 8 — Pricing / Economics / Reserve Math

Check canonical publish charge, network fee allowance, protocol fee, ATH discount, hold vs final net, ACK refund reserve, Vault/CapsuleHub reserves, surcharge cap, size classes 1/2/4/8/16/32 KiB, pricing artifacts, storage/rent margins, raw-backing invariants.

### SECTION 9 — PWA Composer / Send Flow

Check private split policy, public split policy, text/images/checks, anonymous/share-address metadata, recipient key freshness, fresh price before send, confirmation/cancel ordering, sendBoc ordering, retry behavior, partial publish state, balance checks, local encrypted recovery before payment checks.

### SECTION 10 — PWA Transport / RPC / TON DNS

Check provider abstraction, concrete providers, critical read verification, cache bypass, request dedup, stale reads, recipient key lookup, message history body retrieval, sendBoc cache invalidation, service worker/versioning, TON DNS behavior, production RPC config.

### SECTION 11 — Message Retrieval / Body History / Local Cache

Check private/public sync, body history pagination, missing body UX, cursor advancement, private catch-up, public all-time/recent wording, static feed verification, local encrypted cache limits, post-prune behavior, retry stores.

### SECTION 12 — Docs / Spec / Web Copy Consistency

Check active public docs, web copy, pricing wording, ATH reward/discount wording, body off-state model, retention/prune/provider limitations, no obsolete message_budget/session specs as current truth, no false production readiness.

### SECTION 13 — Full Seam Audit

Check cross-contract seams:

- Vault ↔ CapsuleHub;
- Vault ↔ ATHWallet/ATHMaster;
- Vault ↔ ProfileRegistry;
- Vault ↔ UsernameRegistry;
- UsernameRegistry ↔ UsernameNFTItem;
- CapsuleHub ↔ FeeAccumulator;
- FeeAccumulator ↔ BuybackBurn;
- BuybackBurn ↔ STON.fi;
- PWA ↔ Vault;
- PWA ↔ CapsuleHub;
- PWA ↔ Profile/Username;
- PWA ↔ RPC;
- docs/config ↔ deployed contracts.

Prioritize auth source, value source, bounce/failure behavior, idempotency, replay, exact amounts, refund destination, pending cleanup, raw backing, finality mismatch.

### SECTION 14 — Final Predeploy Checklist

Summarize only current blockers and accepted risks. Distinguish:

- contract code blocker;
- deploy/genesis blocker;
- production PWA blocker;
- staged buyback/seller gate;
- docs/spec blocker;
- PWA UX/test-hardening note.

Do not say “ready” unless current archive evidence supports it. Do not say “not ready” because of intentionally staged future operations that fail-closed and are honestly documented.

## Output Tone

Be blunt and concrete. Avoid abstract “could be better” findings. Every serious finding must include a current-code scenario that actually breaks security/accounting/liveness/recoverability or materially lies to users.
