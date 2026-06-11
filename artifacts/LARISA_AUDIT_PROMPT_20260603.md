Лариса, нужен свежий predeploy-аудит Platho V1 по приложенному архиву.

Не исходи из того, что прошлые раунды уже всё доказали. Проверь текущий архив заново: код, тесты, PWA, docs, deploy/config и artifacts. Но не раздувай findings за счёт нереалистичных ручных ошибок пользователя или вкусовых претензий. Нас интересуют реальные риски уровня:

- кто угодно украл или заморозил TON/ATH;
- кто угодно сломал контракты или чужое состояние;
- internal ledger стал under-backed;
- контракт умер из-за storage/reserve/gas;
- refund/due/treasury/burn/buyback accounting стал неправильным;
- PWA подписывает или отправляет то, что контракты на самом деле не поддерживают;
- deploy evidence, manifest, hashes или docs врут.

## Цель аудита

Platho V1 — immutable TON/Tact contracts плюс static PWA. После mainnet-деплоя контрактные ошибки нельзя будет “потом чуть поправить”, поэтому protocol-critical проблемы должны быть найдены до деплоя.

Ищи только реальные проблемы, которые могут привести к:

- theft/loss/stuck TON or ATH;
- under-backed internal Vault/Profile/Username/ATH ledger;
- unauthorized state mutation;
- replay, nonce bypass, duplicate debit, duplicate claim;
- wrong refund/due/treasury/burn/buyback accounting;
- permanent griefing of other users or protocol state;
- unbounded gas/raw-balance drain beyond explicitly charged reserve;
- storage/rent/reserve insolvency;
- broken immutable genesis/seal/bind/deploy state;
- PWA signing/sending/claiming flows that contradict contract semantics;
- message unavailability or unverifiable content in normal product use;
- docs/web copy materially promising something false about protocol behavior.

Не трать contract findings на:

- custom client intentionally sending too much value;
- user manually sending funds to the wrong address;
- direct contract use that bypasses official PWA warnings and harms only the sender;
- “would be cleaner if” refactors;
- purely cosmetic naming/style issues;
- добавление contract checks для impossible official-flow states, если правильная граница — PWA/predeploy guard.

Если правильный фикс — PWA UX, docs, deploy gate или regression test, так и пиши. Не требуй раздувать контракты ради метафизической безопасности.

## Принятые продуктовые и протокольные решения

Это намеренные решения. Аудируй последовательность реализации и безопасность, а не спорь с тем, нравится ли решение эстетически.

### Protocol Fee / Pricing

Текущий Platho publish protocol-fee component:

```text
0.010 TON = 10,000,000 nanotons
```

Это только Platho protocol fee component. Это не вся пользовательская цена сообщения.

ATH discount logic принят:

- до `airdrop_remaining_ath == 0` publish protocol-fee discounts заблокированы;
- после unlock внутренний ATH balance пользователя в Vault может снижать только Platho protocol-fee component;
- при `10,000 ATH` пользователь достигает full protocol-fee discount tier;
- maximum protocol-fee reduction is `0.010 TON` per capsule;
- network fee, storage reserve, execution reserve, hold, surcharge и non-protocol components всё равно оплачиваются;
- ATH reward/discount не является refund, cashback, reimbursement, investment return или price guarantee.

Finding нужен только если discount:

- unlocks before `airdrop_remaining_ath == 0`;
- discounts network/storage/reserve/surcharge instead of protocol fee;
- creates under-backed accounting;
- makes CapsuleHub accrued fee inconsistent;
- conflicts between contract/PWA/docs/tests/artifacts.

Не репорти “old 0.005 TON protocol-fee floor missing” как баг. В текущей логике нет принятого `0.005 TON` Platho fee floor. Если `0.005 TON` встречается, сначала проверь, что это: чаще всего это included network-fee allowance, а не Platho fee.

### User Price Copy

Публичная/product copy может говорить:

```text
from 0.0337 TON
```

Технические pricing artifacts могут показывать точные примеры, сейчас ожидаемо примерно:

```text
public 1K net: 0.0337 TON
private hybrid 1K net: 0.0347 TON
larger public or private size classes cost more
```

Это не конфликт, если docs различают product label и exact canonical examples.

### Body Storage Model

CapsuleHub не должен хранить heavy message bodies в state.

Правильная V1-модель:

- CapsuleHub state stores compact metadata/hash/header/index/created_at;
- heavy public/private body is in accepted Vault -> CapsuleHub transaction body;
- PWA retrieves body from TON message/transaction history;
- PWA verifies body/header hashes against CapsuleHub state;
- availability depends on provider history and local encrypted cache;
- compact entries can be pruned after retention.

Не требуй body-in-state. Finding нужен только если PWA trusts unverified off-chain/static body as chain-backed content, или docs falsely promise permanent archival recovery.

### Privacy / Wallet Sender Boundary

Официальная продуктовая граница:

- primary account activation может использовать embedded Platho wallet как initial wallet ownership anchor;
- routine product actions должны идти through Vault-auth-signed external flows там, где контракты это поддерживают;
- payment checks must not require recipient wallet sender transaction through Tonkeeper;
- key rotation after activation must not require wallet sender transaction;
- deposit/withdraw and explicit wallet TON transfers naturally involve external wallet.

Проверь, что текущие contracts/PWA соблюдают эту границу. Contract finding нужен только если official flow unnecessarily leaks or requires wallet-sender use там, где Vault-auth external flow уже существует и должен использоваться.

### Mainnet / Production Gates

Если архив всё ещё preview или `MAINNET_GENESIS_VERIFIED=false`, отметь это один раз как release gate. Не повторяй это как code bug в каждой секции, если только какой-то artifact falsely claims production-ready.

Production/static deploy must not pass while real preprod gates are false.

### Buyback / Market Stability

Buyback route и MarketStabilitySeller могут быть staged.

Это не core deploy blocker, если:

- contracts deploy fail-closed with buyback/seller inactive;
- buyback execution requires route freeze/evidence;
- seller execution requires pricing/reserve readiness.

Finding нужен только если execution can happen prematurely, route/pricing/funding evidence can be bypassed, funds can be lost/stuck, или docs claim readiness while gates are false.

### Russian/Internal Docs

Russian drafts/internal docs могут существовать в artifacts. Они не должны попадать в public static web package, если это явно не задумано. Finding нужен, если public package ships internal/RU draft docs или stale product promises.

## Методика

Распакуй архив и собери inventory:

- contracts;
- generated build bindings;
- tests;
- PWA modules;
- docs/specs;
- deploy/config/artifacts;
- pricing/economics artifacts.

Аудируй one section per session. После каждого section report жди “дальше”.

Для каждой секции:

- читай current code carefully;
- сравни contract ↔ tests ↔ PWA ↔ docs ↔ artifacts;
- не доверяй PASS artifacts blindly; проверь, что именно они доказывают;
- строй concrete failure scenarios;
- явно укажи, это static audit/artifact review или runtime test run;
- если finding зависит от assumptions, скажи это прямо.

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

## Обязательные секции

### SECTION 0 — Inventory / Architecture / Release State

Проверить:

- contract list;
- PWA module list;
- code hashes;
- manifest hash;
- config mode;
- preview vs production;
- stale artifacts;
- archive hygiene;
- production gates;
- public static package contents.

### SECTION 1 — Vault

Проверить:

- deposit/withdraw;
- internal TON/ATH balances;
- raw backing;
- auth key vs messaging key;
- register/replace messaging keys;
- receive intents/payment checks;
- external signed publish/profile/username flows;
- nonce/replay;
- acceptMessage placement;
- pre-accept gas;
- pending maps;
- ACK/refund/bounce handling;
- failed path bounds;
- pricing/discount;
- seal/bind/genesis/basechain.

Special attention:

- payment check create/claim/cancel credits correct internal Vault balances;
- claim does not require recipient wallet sender transaction;
- key rotation does not require wallet sender transaction;
- stale nonce and invalid maxCharge paths cannot drain raw Vault unexpectedly;
- 16/32 KiB private paths validate size/crypto before unsafe accepts;
- no path makes user internal balance richer than raw backing.

### SECTION 2 — CapsuleHub

Проверить:

- private/public publish auth;
- fee accrual;
- body/header/hash verification;
- off-state body model;
- created_at;
- prune;
- storage reserve;
- fee flush;
- body lookup assumptions;
- ACK/bounce to Vault;
- excess reserve behavior.

### SECTION 3 — ATHMaster / ATHWallet

Проверить:

- supply;
- owner wallet derivation;
- transfer/burn/notification/ACK/refund/tombstone/prune semantics;
- Vault-funded registry flows;
- notification sender_key uniqueness;
- bounce/failure proof;
- no under-backed registry/Vault accounting;
- no premature refund.

### SECTION 4 — FeeAccumulator / BuybackBurn / MarketStabilitySeller

Проверить:

- protocol fee deposits;
- split/flush/bounce restore;
- buyback route freeze;
- reserve acceptance;
- STON.fi route/refund/burn state machine;
- MarketStability pricing/reserve gates;
- treasury receiver safety;
- staged inactive behavior.

### SECTION 5 — ProfileRegistry

Проверить:

- direct and Vault-funded avatar update;
- exact ATH price;
- official ATH wallet auth;
- Vault payer auth;
- treasury/burn split;
- due flush/failure restore;
- typed TON excess refund to Vault;
- avatar pointer validity;
- storage economics;
- bind/seal/basechain/treasury receiver negative checks.

### SECTION 6 — UsernameRegistry / UsernameNFTItem

Проверить:

- username validation policy;
- pricing tiers;
- direct/Vault-funded mint;
- pending duplicate/finalized duplicate;
- NFT item deploy/init/ACK/resend/bounce;
- owner assignment;
- registry record vs item ownership;
- transfer;
- refund due;
- treasury/burn split;
- non-destructive stale pending behavior;
- storage economics;
- bind/seal/basechain/treasury receiver negative checks.

### SECTION 7 — Deployment / Genesis / Seal / Manifest

Проверить:

- final manifest;
- current code hashes;
- StateInit hashes;
- reciprocal bind graph;
- seal requirements;
- funding-before-usability;
- treasury role graph;
- official ATH wallet ownership/backing;
- local vs final artifacts;
- preprod guard;
- production static package gate.

### SECTION 8 — Pricing / Economics / Reserve Math

Проверить:

- canonical publish charge;
- network fee allowance;
- protocol fee;
- ATH discount;
- hold vs final net;
- ACK refund reserve;
- Vault/CapsuleHub reserves;
- surcharge cap;
- size classes 1/2/4/8/16/32 KiB;
- pricing artifacts;
- storage/rent margins;
- raw-backing invariants.

### SECTION 9 — PWA Composer / Send Flow

Проверить:

- private split policy;
- public split policy;
- text/images/checks;
- anonymous/share-address metadata;
- recipient key freshness;
- fresh price before send;
- confirmation/cancel ordering;
- sendBoc ordering;
- retry behavior;
- partial publish state;
- balance checks;
- local encrypted recovery before payment checks.

### SECTION 10 — PWA Transport / RPC / TON DNS

Проверить:

- provider abstraction;
- concrete providers;
- critical read verification;
- cache bypass;
- request dedup;
- stale reads;
- recipient key lookup;
- message history body retrieval;
- sendBoc cache invalidation;
- service worker/versioning;
- TON DNS behavior;
- production RPC config.

### SECTION 11 — Message Retrieval / Body History / Local Cache

Проверить:

- private/public sync;
- body history pagination;
- missing body UX;
- cursor advancement;
- private catch-up;
- public all-time/recent wording;
- static feed verification;
- local encrypted cache limits;
- post-prune behavior;
- retry stores.

### SECTION 12 — Docs / Spec / Web Copy Consistency

Проверить:

- active public docs;
- web copy;
- pricing wording;
- ATH reward/discount wording;
- body off-state model;
- retention/prune/provider limitations;
- no obsolete message_budget/session specs as current truth;
- no false production readiness.

### SECTION 13 — Full Seam Audit

Проверить cross-contract seams:

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

Prioritize:

- auth source;
- value source;
- bounce/failure behavior;
- idempotency;
- replay;
- exact amounts;
- refund destination;
- pending cleanup;
- raw backing;
- finality mismatch.

### SECTION 14 — Final Predeploy Checklist

Summarize only current blockers and accepted risks.

Разделяй:

- contract code blocker;
- deploy/genesis blocker;
- production PWA blocker;
- staged buyback/seller gate;
- docs/spec blocker;
- PWA UX/test-hardening note.

Не говори “ready”, если current archive evidence этого не поддерживает. Не говори “not ready” только из-за intentionally staged future operations, которые fail-closed и честно documented.

## Тон ответа

Будь прямой и конкретной. Не пиши абстрактные “could be better” findings. Каждый серьёзный finding должен включать current-code scenario, который реально ломает security/accounting/liveness/recoverability или materially lies to users.
