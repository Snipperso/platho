Лариса, это свежий predeploy-аудит Platho V1 по новому архиву проекта. Нужен максимально внимательный аудит, но с важной поправкой: не надо заново спорить с уже принятыми продуктово-экономическими решениями. Проверяй, что код, PWA, docs, config и artifacts честно реализуют эти решения. Если решение реализовано последовательно и не создаёт реального accounting/security/liveness бага, не превращай его в finding.

## Контекст проекта

Platho V1 — immutable набор TON/Tact контрактов плюс static PWA. После mainnet-деплоя контракты нельзя будет “потом чуть поправить”, поэтому protocol-critical ошибки должны быть закрыты до деплоя.

Цель V1 — production-продукт без admin/backdoor/scam levers. Не предлагай “сделаем в V1.1/V2” для того, что обязательно должно быть безопасным в текущих immutable контрактах.

## Принятые решения, которые НЕ являются findings

### Pricing / protocol fee

Текущая полная Platho protocol fee для public/private publish:

```text
0.010 TON = 10,000,000 nanotons
```

Это базовая protocol-fee component, а не вся пользовательская цена.

ATH discount НЕ удалять. Это принятое V1-решение:

- до полного распределения activity airdrop скидки на publish protocol fee заблокированы;
- после `airdrop_remaining_ath == 0` внутренний ATH balance пользователя в Vault может снижать именно Platho protocol-fee component;
- при `10,000 ATH` пользователь достигает full protocol-fee discount tier;
- maximum reduction is `0.010 TON` per capsule;
- network costs, storage reserves, execution reserves, hold, surcharge и non-protocol components всё равно оплачиваются;
- ATH reward/discount не является refund/cashback/reimbursement/investment return.

Не ругайся на сам факт, что protocol-fee component может стать `0` после unlock. Это текущая продуктовая логика. Ругайся только если:

- скидка применяется до `airdrop_remaining_ath == 0`;
- скидка применяется к network/storage/reserve/surcharge, а не только к protocol fee;
- docs обещают компенсацию стоимости сообщения или инвестиционный доход;
- contract/PWA/docs расходятся между собой;
- скидка ломает raw backing, refund, accrued fee или accounting.

### User-facing price wording

Публичная UX/business формулировка:

```text
messages start from 0.0337 TON
```

Это принято как продуктовый label. Технические docs/tables могут и должны показывать точные текущие canonical examples, например:

```text
public 1K exact current net example: 0.0337 TON
hybrid private 1K exact current net example: 0.0347 TON
larger public or private size classes cost more
```

Не считай конфликтом, если public copy говорит `from 0.0337 TON`, а technical pricing table показывает `0.0337/0.0347 TON`, при условии что docs ясно различают product label и exact canonical examples.

### Current release state

Mainnet genesis может уже быть verified. Не считай staged post-pool buyback/seller readiness блокером самого contract deploy или production PWA, если эти flows on-chain fail-closed до route/pricing/funding evidence.

Ожидаемые open gates до production static package могут быть только конкретными release/config inputs, например:

- `TESTNET_ENV_PRESENT`, если в workspace лежит testnet env;
- missing/insufficient approved production RPC provider configuration;
- missing TON DNS root/provider config, если `.ton` routing включён;
- production static deploy blocked by preprod guard for a real current gate.

Не повторяй это как новый кодовый blocker в каждой секции. Отмечай один раз в SECTION 0 и SECTION 14 как release gate. Ругайся только если:

- artifact/config claims production-ready while these gates are still false;
- PWA production config points to stale/mismatched manifest;
- production static package passes despite failed preprod guard;
- docs announce mainnet readiness while genesis evidence is missing or production config is stale.

### Buyback / MarketStability

Buyback route, STON.fi route evidence, MarketStabilitySeller pricing/reserve readiness могут быть intentionally staged.

Не считай это core contract deploy blocker, если:

- contracts deploy safely with buyback inactive;
- buyback execution is blocked until route evidence/freeze;
- seller activation is blocked until pricing/reserve readiness.

Считай blocker только если buyback/seller can execute prematurely, lose funds, bypass route freeze, or docs claim activation-ready while readiness is false.

### Body storage model

CapsuleHub state НЕ должен хранить heavy message body.

Правильная V1 модель:

- CapsuleHub stores compact metadata/hash/header/index/created_at;
- private/public body is in accepted Vault -> CapsuleHub publish transaction body;
- PWA retrieves body from TON message/transaction history;
- PWA verifies body/header hashes against CapsuleHub entry state;
- availability depends on provider history and local encrypted cache;
- compact entries can be pruned after one-year retention.

Не требуй body-in-state. Ругайся только если docs/code говорят, что heavy body stored in CapsuleHub state, or PWA trusts off-chain/static body without verified CapsuleHub hashes.

### Direct/custom-client misuse

Не перегружай контракты защитой от всего, что может сделать custom client “с кривыми руками”.

Не contract blocker:

- custom client intentionally sends too much TON;
- direct contract use bypasses PWA UX warnings;
- user overpays while contract accounting remains backed and no other user/protocol state breaks;
- policy/taste issues that only affect the sender’s own bad transaction.

Такие вещи можно рекомендовать как PWA/docs/test hardening.

Contract finding нужен только если realistic official flow or plausible malicious flow can cause:

- loss/stuck TON/ATH;
- under-backed internal ledger;
- unauthorized state mutation;
- wrong refund/due/treasury/buyback accounting;
- permanent griefing of other users;
- replay/gas drain beyond bounded charged reserve;
- storage/rent insolvency;
- broken immutable deploy state.

### Already-fixed stale classes

Перед тем как повторить finding, проверь current code, not memory from old audit.

Не повторяй как active finding, если current archive proves fixed:

- ATHWallet notification `sender_key` is `uint160` and derived from domain/query_id/sender_owner, not old 32-bit key;
- PWA publish flow does `quote -> balance check -> user confirmations -> sign BOC -> send`, not send/sign before confirmation;
- Profile/Username/CapsuleHub critical provider methods forward `verify/priority/cacheTtlMs`;
- `get_private_entry` / `get_public_entry` are in critical RPC methods and used with verified reads in import/finality paths;
- public body-history gaps are persisted and retried outside the default read window;
- storage economics reports show required margins >= 1,000,000 nanotons and code hashes match;
- active public docs distinguish `from 0.0337 TON` product label from exact canonical examples;
- Russian draft docs are not included in the public static web package.

If any of these are not true in the current archive, then report it with exact current evidence.

## Main audit objective

Ищи только реальные проблемы, которые могут привести к:

- loss of TON/ATH;
- under-backed internal ledger;
- stuck funds;
- replay/gas drain;
- wrong debit/refund/fee/treasury/buyback accounting;
- auth/owner/admin/seal/genesis bypass;
- broken nonce/idempotency;
- inability to retrieve/read/verify messages in normal product use;
- storage rent / reserve insolvency;
- PWA sending/reading something contracts do not actually support;
- incorrect pricing/hold/final-cost display that can mislead normal users;
- deploy/config/hash/manifest mismatch;
- docs/web copy promising something materially false about the actual system.

Do not spend findings on code beauty, style, refactoring preferences, naming taste, or “could be more elegant”. Do not inflate contracts for purely metaphysical safety. If the right fix is a PWA warning, production gate, or docs wording, say that instead of demanding a contract change.

## Work format

Unpack the archive and build an inventory:

- contracts;
- tests;
- web/PWA;
- docs/specs;
- deploy/config/artifacts;
- pricing/economics artifacts.

Audit one section per session. After report, wait for “дальше”.

For every section:

- read current code carefully;
- check invariants;
- build concrete attack/failure scenarios;
- compare contract ↔ tests ↔ PWA ↔ docs ↔ artifacts;
- do not trust PASS artifacts blindly; verify what they actually prove;
- if tests cannot be run, say clearly: static audit + artifact review, not runtime test run.

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
- MEDIUM: real production risk or important UX/release safety issue, but not immediate catastrophic contract failure.
- LOW: small edge, self-inflicted direct-use issue, docs polish with limited user harm.
- INFO: limitation/accepted risk; do not block release unless docs falsely claim otherwise.

Do not repeat old findings if fixed. If the same risk class reappears in a new form, report it as a new current finding with fresh evidence.

## Required sections

### SECTION 0 — Inventory, Architecture Map, Deploy State

Check:

- contract list;
- PWA module list;
- current code hashes / manifest hash / config mode;
- preview vs production;
- stale artifacts;
- gates not yet closed.

Important: preview mode, `MAINNET_GENESIS_VERIFIED=false`, blocked production static package, and open preprod gates are expected before final deployment. Report them as release gates, not as code bugs, unless something falsely claims production readiness.

### SECTION 1 — Vault

Check:

- deposit/withdraw/internal balances;
- TON ledger backing;
- ATH ledger backing;
- external signed publish flows;
- nonce/replay protection;
- acceptMessage placement;
- pre-accept gates;
- sizeClass/cryptoSuite validation before accept;
- maxCharge/hold/final-cost accounting;
- pending publish locks;
- ACK/refund handling;
- profile/avatar/username from Vault balance;
- admin/genesis/seal/bind rules;
- basechain checks;
- raw balance vs internal ledger invariants;
- failed paths bounded by charged reserve.

Special attention:

- large private 16/32 KiB invalid/underfunded/under-maxCharge payloads;
- stale nonce/replay raw Vault balance unchanged;
- accepted-then-return paths must not undercharge raw TON;
- no path should make user ledger richer than raw Vault backing.

ATH discount policy is accepted. Check that discount affects only protocol-fee component after unlock and does not break backing/accounting.

### SECTION 2 — CapsuleHub

Check:

- publish private/public;
- body off-state model;
- body_hash/header integrity;
- created_at = now;
- one-year prune;
- live_count;
- protected reserve;
- SweepExcessReserve;
- storage/rent economics;
- ACK generation;
- bounce handling;
- index consistency;
- private/public retrieval assumptions;
- no heavy body stored in state accidentally;
- no prune before retention;
- no storage insolvency.

Do not require heavy body in state.

### SECTION 3 — ATHMaster / ATHWallet

Check:

- mint/burn/supply invariants;
- master auth;
- wallet auth;
- transfer/notification/ACK;
- pending notifications;
- pruned notification/tombstone growth;
- duplicate/replay;
- bounce/refund;
- Vault-funded ATH flows;
- Profile/Username ATH payment flows;
- treasury/burn split;
- activity rewards;
- no unauthorized mint;
- total supply consistency.

Check current sender_key width/identity. Do not repeat old 32-bit collision finding if current code uses uint160 domain/query/sender-derived identity.

### SECTION 4 — FeeAccumulator / BuybackBurn / Liquidity/Burn Flow

Check:

- fee intake;
- treasury_due;
- buyback_due;
- split enable rules;
- no premature buyback execution before pool configured;
- STON.fi/router/external pool assumptions;
- failure/bounce handling;
- no stuck TON;
- no double split;
- no underflow/overflow;
- no silent fallback;
- accounting between CapsuleHub/Vault/FeeAccumulator/BuybackBurn.

Buyback activation can remain gated. Do not call inactive staged buyback a core deploy blocker unless execution/flush can bypass readiness.

### SECTION 5 — ProfileRegistry

Check:

- set avatar direct/vault-funded;
- ATH exact payment;
- payer wallet auth;
- Vault integration;
- treasury/burn split;
- versioning;
- excess/refund path;
- duplicate/update behavior;
- basechain/bind/seal rules;
- no unauthorized profile mutation.

Do not demand contract protection for bad custom clients setting bad self-owned treasury roles if deploy verifier/manifest gates already reject them. If gates do not reject them, report as deploy/config invariant, not runtime profile bug.

### SECTION 6 — UsernameRegistry / UsernameNFTItem

Check:

- username validation policy;
- allowed chars `a-z 0-9 _ -`;
- whether leading/trailing/consecutive separators are intentionally accepted;
- pricing;
- mint direct/vault-funded;
- duplicate name;
- pending mint;
- NFT item deploy/init;
- bounce/refund;
- owner assignment;
- current owner authority;
- basechain/bind/seal rules;
- no stuck ATH/TON on deploy failure.

Current design: registry record gives authoritative name-to-item anchor; UsernameNFTItem state gives current owner after transfer. Do not flag stale registry `owner_wallet` as a bug if PWA/docs resolve through item owner.

### SECTION 7 — Deployment / Genesis / Seal / Manifest

Check:

- all contracts bind correct counterparts;
- no self-bind where it matters;
- basechain only;
- manifest hash matches deployed state;
- code hashes match artifacts;
- production config only after final verification;
- one-shot genesis funding;
- ATH allocations;
- vesting/activity/liquidity buckets;
- no stale `MAINNET_GENESIS_VERIFIED=true`;
- deploy scripts idempotency and safety.

Do not demand mainnet production mode before final genesis. The expected result before deploy is: gates honestly block production. Report false green, stale hash, or mismatch as blocker.

### SECTION 8 — Pricing / Economics / Reserve Math

Check:

- `get_canonical_publish_charge`;
- PWA pricing-policy;
- hold vs final cost;
- protocol fee values;
- ACK refund reserve;
- Vault local reserve;
- storage/index reserve;
- network surcharge;
- size classes 1/2/4/8/16/32 KiB;
- expected price tables;
- whether price labels match contract reality;
- raw-backing invariant under success/failure/replay;
- no hidden subsidy;
- surcharge cap/confirmation.

Accepted economics:

- full Platho protocol fee is `0.010 TON`;
- ATH may discount the protocol-fee component after unlock;
- product label may be `from 0.0337 TON`;
- exact no-discount examples may be `0.0337/0.0347 TON`;
- larger public or private classes cost more.

Do not propose removing ATH publish discounts or lowering/raising protocol fee unless current code/docs contradict this accepted model or create real accounting risk.

### SECTION 9 — PWA Composer / Send Flow

Check:

- private text split into capsule size classes;
- 2 KiB -> one 2K capsule;
- 32 KiB -> one 32K capsule;
- 33 KiB -> 32K + 1K;
- attachment/image chunking;
- public vs private routes;
- composer price estimate;
- fresh price before send;
- modal if fresh price > quoted price;
- cancel flow;
- signed BOC creation after final confirmation;
- sendBoc after confirm only;
- local pending UI rollback;
- Vault balance checks;
- ATH discount/reward display;
- no old 1 KiB-only path shadowing new logic.

If current code signs only after balance/confirm and sends only after confirm, do not repeat old signing-order finding.

### SECTION 10 — PWA Transport / RPC / Toncenter Dependency

Check:

- provider abstraction;
- Toncenter hardcoding;
- fallback/custom RPC;
- cache TTL;
- confirmation polling;
- request dedup;
- stale data handling;
- disagreement handling;
- service worker cache/version bump;
- app.js query version;
- production RPC config;
- no stale frontend after deploy.

Production RPC not fully configured is a release gate while app is preview. Treat it as production PWA blocker only if production package/config claims ready.

### SECTION 11 — Message Retrieval / Body History Availability

Check:

- how PWA finds body from transaction/message history;
- body_hash verification;
- header verification;
- behavior if RPC does not return old history;
- behavior after 1 year / pruned entry;
- local cache;
- durable retry for body-history gaps;
- error UX;
- no trust in off-chain body without hash;
- no reliance on client-created timestamp for canonical retention.

If public/private body-history gaps are persisted and retried and `chainVerified` requires verified CapsuleHub metadata, do not repeat earlier gap/static-feed findings.

### SECTION 12 — Docs / Spec / Web Copy Consistency

Check:

- specs match actual contracts;
- no obsolete `message_budget`;
- no obsolete `0.01/0.02` message-price model;
- no “ATH compensates message cost” language;
- correct `from 0.0337 TON` wording;
- exact technical examples remain allowed;
- larger capsules cost more;
- hold vs final cost explained;
- body off-state model explained;
- one-year prune described accurately;
- RPC/provider limitation described honestly;
- no false decentralization claims.

Do not flag ATH publish discounts as invalid; only flag misleading discount/refund/investment wording or mismatch with current code.

### SECTION 13 — Full Seam Audit

Check seams:

- Vault ↔ CapsuleHub;
- Vault ↔ ATHWallet / ATHMaster;
- Vault ↔ ProfileRegistry;
- Vault ↔ UsernameRegistry;
- UsernameRegistry ↔ UsernameNFTItem;
- CapsuleHub ↔ FeeAccumulator;
- FeeAccumulator ↔ BuybackBurn;
- BuybackBurn ↔ STON.fi/router/pool;
- PWA ↔ Vault;
- PWA ↔ CapsuleHub;
- PWA ↔ Profile/Username registries;
- PWA ↔ RPC provider;
- Docs/config ↔ deployed contracts.

For each seam:

- auth source;
- value source;
- bounce behavior;
- idempotency;
- replay;
- exact amount where exactness matters;
- refund destination;
- pending cleanup;
- raw backing;
- mismatch between sender expectation and receiver validation.

Do not mark accepted staged release gates as seam bugs unless a false-ready artifact/config/docs claim contradicts them.

### SECTION 14 — Final Predeploy Checklist

Produce final table:

- BLOCKER;
- HIGH;
- MEDIUM;
- LOW;
- INFO;
- fixed / needs fix / accepted risk;
- required tests;
- required docs/config updates;
- can deploy contracts?;
- can deploy PWA?;
- can activate buyback/seller?;
- can announce tokenomics/pricing?

Expected before final deployment: contracts/PWA may still be NOT READY because final genesis/preprod gates are intentionally open. The useful question is whether any new code/accounting/security blocker remains beyond those known gates.

Start with SECTION 0: inventory and architecture map. Do not edit code. Audit and report only. If you find a real BLOCKER, stop on it and explain it precisely.

