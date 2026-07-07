# Промпт для Ларисы: focused audit Vault + CapsuleHub

Ты аудируешь свежий архив Platho как новый focused re-audit. Используй приложенный zip-архив; точное имя архива и SHA256 должны быть указаны в сообщении отправителя вместе с архивом.

## Scope

Аудит строго ограничен двумя контрактами и их прямыми швами:

1. `contracts/Vault.tact`
2. `contracts/CapsuleHub.tact`
3. Vault <-> CapsuleHub seam
4. PWA/RPC/local-storage paths только там, где они строят, подписывают, отправляют, читают или восстанавливают Vault/CapsuleHub сообщения.
5. Deploy/genesis/config/artifacts только там, где они фиксируют Vault/CapsuleHub addresses, code hashes, bindings, seal state или PWA Vault/CapsuleHub config.

Не проводи полный аудит остальных контрактов. ATHMaster, ATHWallet, ProfileRegistry, UsernameRegistry, UsernameNFTItem, FeeAccumulator, BuybackBurn, MarketStabilitySeller и ATHVesting можно смотреть только как внешние зависимости Vault/CapsuleHub flow. Finding по ним допустим только если это прямо ломает Vault/CapsuleHub invariant или делает Vault/CapsuleHub under-backed, unrecoverable, unsafe или unreadable.

Контекст: предыдущие настоящие protocol-threatening находки в этом раунде были именно в Vault и CapsuleHub. Поэтому цель этого прохода - глубоко проверить, что Vault/CapsuleHub теперь не имеют theft/loss/DoS/accounting/privacy/finality проблем, а не заново распыляться на весь проект.

## Главные вопросы

Проверь, может ли реалистичный attacker, обычный пользователь, злонамеренный counterparty, сбой RPC/PWA или bounce/ack race:

- украсть, вывести, заблокировать или подменить чужие TON/ATH через Vault;
- сделать Vault under-backed относительно внутренних TON/ATH obligations;
- заставить Vault принять signed external request с неправильным owner, nonce, session, vault address/hash, payload hash, amount или replay;
- изменить nonce, user balances, receive intents, pending publishes или raw Vault TON balance в reject-before-accept сценариях;
- создать receive intent, claim, cancel или payment-check state, который нельзя безопасно завершить или восстановить;
- вызвать двойной claim/refund/cancel/finality bug;
- потерять средства или user balance при Vault -> CapsuleHub ACK/bounce/partial-submit сценариях;
- опубликовать private/public capsule с payload/body/header shape, отличающимся от того, что PWA и CapsuleHub потом читают;
- записать CapsuleHub entry без достаточного fee/storage/ack reserve;
- сломать CapsuleHub indexes, pagination, body-history recovery или sender/recipient lookup так, что валидные сообщения системно не читаются;
- раскрыть приватность вопреки текущей модели anonymous/shared sender address и recipient key routing;
- позволить не-Vault sender публиковать в CapsuleHub или подделать Vault-origin publish;
- зафиксировать неправильный immutable Vault/CapsuleHub binding/seal/deploy graph.

## Vault audit focus

Проверь особенно:

- signed external auth, session, nonce, replay protection;
- `vault address` / `vault hash` binding inside signed payloads;
- TON deposit/withdraw and internal TON balance accounting;
- ATH deposit/withdraw and pending ATH withdrawal accounting;
- `CreateReceiveIntent`, `ClaimReceiveIntent`, `CancelReceiveIntent`;
- payment-check happy path and all reject-before-accept paths;
- `PublishPrivateFromVaultBalance` and `PublishPublicFromVaultBalance`;
- pending publish lifecycle: enqueue, ACK, bounce, pruning, duplicate publish prevention;
- local reserve charge/refund accounting;
- profile avatar and username mint only as Vault outgoing value-flow surfaces, not as registry audits;
- storage top-up / reserve-only messages;
- bind/seal with CapsuleHub;
- getter truth: `get_user`, `get_key_record`, `get_receive_intent`, `get_global`, pending publish/withdraw views;
- code-size hygiene inside Vault: dead branches, duplicate validators/builders, legacy direct-user-wallet paths, unnecessary pre-accept work.

Особо перепроверь свежие Vault receive-intent fixes:

- ClaimReceiveIntent with missing `intent_id` rejects before `acceptMessage`.
- ClaimReceiveIntent from wrong recipient rejects before `acceptMessage`.
- ClaimReceiveIntent with wrong secret rejects before `acceptMessage`.
- CancelReceiveIntent from non-sender rejects before `acceptMessage`.
- CancelReceiveIntent with missing `intent_id` rejects before `acceptMessage`.
- In every reject-before-accept case, nonce, internal balances, receive_intents and raw Vault TON balance must not change.
- Happy-path claim/cancel must still work.

## CapsuleHub audit focus

Проверь особенно:

- only bound Vault can publish private/public entries;
- bind/seal state cannot be bypassed or rebound incorrectly;
- private publish shape: header_0, header_1, body, hashes, size class, crypto suite;
- public publish shape: header, body, byte alignment, hashes, size class;
- entry UID computation and getter recomputation;
- body/hash/header consistency between stored entry and accepted publish body;
- private sender/recipient indexes and lookup privacy;
- public/private pagination boundaries;
- pruning lifecycle and index cleanup;
- fee accounting, accrued protocol fee, flush to FeeAccumulator only as CapsuleHub handoff;
- storage keepalive, entry endowment, protected reserve, sweep reserve;
- ACK value and ACK message correctness back to Vault;
- bounce/liveness assumptions around ACK delivery;
- code-size hygiene inside CapsuleHub: dead branches, duplicate shape checks, unused state/getters, legacy compatibility paths.

## Vault <-> CapsuleHub seam

Compare both sides field-by-field:

- opcodes and message structs;
- size-class constants;
- public/private body cell shape;
- header bit/ref/cell constraints;
- protocol fee and reserve constants;
- `publish_id`, `entry_id`, `entry_uid`, `body_hash`, `header_hash` semantics;
- ACK path and pending publish finalization;
- bounce recovery path and user balance restoration;
- deploy-time binding: Vault knows CapsuleHub and CapsuleHub knows Vault;
- PWA builder output must match what Vault validates and what CapsuleHub stores.

If there is a mismatch, classify it by real impact:

- funds loss / under-backed;
- message accepted but unreadable;
- privacy leak;
- liveness failure;
- only cosmetic or UX issue.

## PWA/RPC/local-storage scope

Look only at PWA/RPC/storage code that touches Vault/CapsuleHub:

- `web/app.js`
- `web/pwa-contract-transactions.mjs`
- `web/vault-ton-rpc-provider.mjs`
- `web/capsulehub-ton-rpc-provider.mjs`
- `web/vault-chain-provider.mjs`
- `web/public-channel-subscriptions.mjs`
- `web/encrypted-message-store.mjs`
- `web/message-pricing-policy.mjs`
- `web/platho-config.mjs`
- `web/crypto/platho-crypto.mjs`

Focus:

- send flow and duplicate-send prevention;
- fresh nonce and just-in-time BOC construction;
- private/public capsule assembly;
- multi-capsule messages with images/checks;
- sender/recipient key selection;
- anonymous vs shared sender address behavior;
- private/public message sync and recovery after local data wipe;
- pending payment-check local ledger and retry/recovery behavior;
- RPC verification/disagreement behavior for Vault/CapsuleHub critical reads;
- whether local encrypted cache labels or recovery paths can make the user believe local-only data is chain truth.

Do not audit username/avatar/profile UI except where Vault signs/sends value for those flows.

## Relevant tests and artifacts

Use these as evidence, but do not blindly trust them:

- `tests/vault-*.test.ts`
- `tests/capsulehub*.test.ts`
- `tests/pwa-contract-transactions.test.ts`
- `tests/encrypted-message-history.test.ts`
- `tests/public-channel-subscriptions.test.ts`
- `tests/pwa-runtime-config.test.ts`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/CURRENT_PRODUCTION_CODE_HASHES.txt`
- `artifacts/mainnet_genesis_verify_report.json`
- `artifacts/MAINNET_GENESIS_VERIFY.md`
- `artifacts/local/mainnet_final_manifest_draft.json`
- `artifacts/local/mainnet_deploy_packet.json`
- `artifacts/local/mainnet_tx_dry_run_packet.json`
- `PRODUCTION_READINESS.md`
- `MAINNET_RELEASE_CHECKLIST.md`

Important current-state note: `MAINNET_GENESIS_VERIFIED=false` and production deploy prep is blocked by `MAINNET_GENESIS_NOT_VERIFIED`. Treat this as intentional predeploy state, not a Vault/CapsuleHub finding, unless you find a new Vault/CapsuleHub-specific reason why regenerated genesis evidence would still be unsafe.

## What counts as a finding

Count as findings:

- theft, unauthorized withdrawal, unauthorized balance mutation;
- under-backed accounting;
- irreversible stuck funds or unrecoverable pending state;
- replay, nonce, session, signature or owner binding bug;
- ACK/bounce/finality race with loss or double credit;
- Vault/CapsuleHub message shape mismatch with loss, unreadability, or privacy impact;
- CapsuleHub stores entries that PWA/RPC cannot reliably retrieve or verify;
- privacy leak contradicting the intended anonymous/private messaging model;
- immutable deploy/bind/seal graph bug involving Vault or CapsuleHub;
- dead/duplicate/legacy Vault/CapsuleHub code that materially increases contract size/gas/audit surface or can be accidentally invoked.

Do not count as production-blocker findings:

- full-project production is still blocked because final mainnet genesis evidence is not verified;
- buyback/seller/pool stages are not live;
- other contracts have unrelated staged gates;
- user manually sends arbitrary garbage or excess funds with a custom client and pays for their own mistake;
- PWA could show nicer copy;
- "add another contract check just in case" without concrete attack/loss/DoS/accounting/privacy scenario;
- contract bloat to protect from impossible or purely self-inflicted user errors;
- a problem safely solvable in PWA without changing protocol-critical contract invariants.

If you recommend a contract-level fix, prove:

1. concrete scenario;
2. why it can happen in normal/adversarial use;
3. impact;
4. why PWA-only check is insufficient;
5. expected contract size/gas/audit-surface cost;
6. minimal regression tests required.

## Output format

1. Severity table.
2. Findings first, ordered by severity.
3. For each finding:
   - ID
   - Severity
   - Title
   - Exact files/functions
   - Scenario
   - Impact
   - Recommended minimal fix direction
   - Fix belongs in contract, PWA/RPC, deploy/config, docs, or tests
   - Required regression tests
4. Separate `Dead / duplicate / legacy code` section.
5. Separate `Non-findings` section for important things reviewed and considered safe.
6. Final verdict:
   - Vault readiness
   - CapsuleHub readiness
   - Vault <-> CapsuleHub seam readiness
   - PWA/RPC readiness for Vault/CapsuleHub flows
   - deploy/genesis readiness for Vault/CapsuleHub only
   - whether any Vault/CapsuleHub redeploy is required

Do not assume previous audits are correct. Audit the archive as fresh code, but keep the scope focused: Vault, CapsuleHub, and their direct seams only.

Приступай к секции 1: Vault.
