# Platho Deployment Runbook

Внутренний runbook для testnet rehearsal и mainnet genesis. Это не маркетинговый документ и не замена аудиту. Его задача проще: не дать запуску превратиться в набор ручных действий "по памяти".

## Текущее правило стопа

До ответа по свежему архиву от Ларисы контракты не трогаем, кроме критического аудиторского фикса.

Запуск можно двигать дальше только если одновременно верны все условия:

- свежий audit archive соответствует текущему `HEAD`;
- `npm test` зелёный;
- `scripts/artifact_integrity_m18.ts` возвращает `PASS`;
- final manifest использует текущие code hashes;
- секреты, seed phrases, vanity candidates и локальные `.env` не попадают в git и архивы.

Последний собранный архив на момент создания runbook:

```text
artifacts/platho_external_audit_slim_20260525-181000_c81192e.zip
sha256 02fd28101d14d17c348b0ad1ae2c894857542061d28598dff277c8fdbd58bdd7
```

## Секреты и локальные файлы

Vanity candidates лежат локально:

```text
artifacts/local/vanity-wallet-candidates.jsonl
```

Этот файл содержит sensitive material. Его нельзя коммитить, архивировать для внешнего аудита, отправлять в чат или использовать как "удобный список адресов" в публичных документах.

В репозитории допустимы только шаблоны вроде `.env.testnet.example`. Реальные env-файлы, mnemonics, deployer keys, seed phrases и RPC secrets должны жить вне git.

## Роли запуска

Перед деплоем должны быть назначены и зафиксированы в final manifest:

| Роль | Назначение |
| --- | --- |
| `genesis_controller_one_shot` | Pre-seal bind/seal для staged contracts. После post-seal route/pricing freeze соответствующие controller hashes должны быть сожжены. |
| `ath_treasury_owner` | Владелец treasury ATH wallet и единственный sender для `ATHMaster.DeployTreasurySupply`. |
| `ton_treasury_receiver` | Получатель TON protocol/treasury buckets из `FeeAccumulator` и MarketStabilitySeller treasury flush. |
| `username_treasury_ath_receiver` | Получатель ATH treasury share от username mint. |
| `profile_treasury_ath_receiver` | Получатель ATH treasury share от profile avatar fees. |
| `market_stability_reserve_funder` | Источник 45M ATH reserve для `MarketStabilitySeller`. |
| `buyback_burn` official ATH wallet | Derived ATHWallet с owner = `BuybackBurn`. Используется для ATH output и burn. |
| `vault` official ATH wallet | Derived ATHWallet с owner = `Vault`. Должен быть funded на весь activity airdrop allocation перед final genesis. |

Отдельного privileged buyback executor в текущей модели нет. `ExecuteBuybackChunk`, recovery/recycle и retry являются permissionless, но зажаты route freeze, frozen quote/minOut, phase и value guards.

## Локальный release gate

Перед любым testnet/mainnet rehearsal:

```powershell
npm.cmd run build
npm.cmd test
node scripts\hash_codes.js
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_ath_wallet_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_deployment_ath_binding_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_username_registry_foundation_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_username_registry_mint_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\generate_username_nft_item_vectors.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\deployment_manifest_m15.ts
$env:TS_NODE_COMPILER_OPTIONS='{ "module": "CommonJS" }'; npx.cmd ts-node scripts\artifact_integrity_m18.ts
```

Стоп, если:

- изменились code hashes без regenerated artifacts;
- artifact integrity не `PASS`;
- `git status` показывает неожиданные tracked modifications;
- audit archive не соответствует `HEAD`.

## Phase 1: финальные адреса и manifest

1. Выбрать финальные mainnet addresses и роли.
2. Проверить, что vanity wallets взяты из локального secure файла, а не из старого чата или скриншота.
3. Собрать final deployment manifest со статусом `FINAL_GENESIS`.
4. Заполнить:
   - все final addresses;
   - current code hashes;
   - `vault_activity_airdrop_total_atomic`;
   - `ath_market_stability_reserve_allocation_atomic`;
   - пустой `blockers_before_final_genesis`.
5. Проверить derived official ATH wallets:
   - owner = соответствующий contract address;
   - master = final ATHMaster;
   - address совпадает с manifest.

Полезные артефакты и шаблоны:

```text
artifacts/deployment_manifest_implemented_subset_m15.json
artifacts/deployment_ath_wallet_binding_vectors.json
artifacts/mainnet_genesis_verify_input_template.json
scripts/mainnet_genesis_verify.ts
```

## Phase 2: deploy and pre-seal binding

Порядок деплоя держим простым и проверяемым.

1. Deploy `ATHMaster`.
2. `ATHMaster.DeployTreasurySupply` от `ath_treasury_owner`.
3. Verify:
   - `treasury_supply_deployed == true`;
   - `total_supply == 100_000_000 ATH atomic`;
   - treasury ATH wallet credited.
4. Deploy immutable `FeeAccumulator` with:
   - `treasury_receiver_address`;
   - `buyback_burn_address`.
5. Deploy staged contracts with final init parameters/placeholders:
   - `BuybackBurn`;
   - `MarketStabilitySeller`;
   - `CapsuleHub`;
   - `Vault`;
   - `UsernameRegistry`;
   - `ProfileRegistry`.
6. Pre-seal bindings by `genesis_controller_one_shot`:
   - `BuybackBurn.BindBuybackFeeAccumulator`;
   - `BuybackBurn.BindBuybackOfficialAthWallet`;
   - `MarketStabilitySeller.BindMarketStabilityReserveFunder`;
   - `MarketStabilitySeller.BindMarketStabilityOfficialAthWallet`;
   - `MarketStabilitySeller.BindMarketStabilityTreasury`;
   - `Vault.BindDeploymentManifest`;
   - `Vault.BindOfficialAthWallet`;
   - `CapsuleHub.BindDeploymentManifest`;
   - `UsernameRegistry.BindOfficialAthWallet`;
   - `ProfileRegistry.BindProfileOfficialAthWallet`.
7. Seal staged contracts:
   - `Vault.SealGenesis`;
   - `CapsuleHub.SealGenesis`;
   - `UsernameRegistry.SealGenesis`;
   - `ProfileRegistry.SealGenesis`;
   - `BuybackBurn.SealBuybackBurnGenesis`;
   - `MarketStabilitySeller.SealMarketStabilityGenesis`.

Стоп, если post-seal любой bind всё ещё проходит. Это не "потом поправим", это немедленный rollback rehearsal и разбор.

## Phase 3: final genesis funding and verification

До final genesis verification должны быть выполнены только разрешённые genesis actions. Никаких user publishes, profile updates, username mints, public posts, buyback reserve accepts или market sales.

Обязательное funding:

- official Vault ATH wallet funded at least на `vault_activity_airdrop_total_atomic`;
- MarketStabilitySeller official ATH wallet на final genesis ещё должен быть empty;
- MarketStability reserve на этом этапе ещё не funding-ready для public sale;
- FeeAccumulator buckets zero;
- BuybackBurn route not frozen and all due/pending/totals zero.

Заполнить snapshot из live getters по шаблону:

```text
artifacts/mainnet_genesis_verify_input_template.json
```

Запустить:

```powershell
npm.cmd run mainnet:genesis:verify
```

`MAINNET_GENESIS_VERIFIED` допустим только если verifier проверяет clean state:

- ATHMaster supply;
- Vault counters and full airdrop remaining;
- CapsuleHub latest ids and accrued fee;
- Username/Profile records, dues and pending flushes;
- FeeAccumulator buckets;
- BuybackBurn route/pending/due/totals;
- MarketStability pricing/reserve/sold/tranche/pending state.

## Phase 4: pool launch and route/pricing freeze

После clean final genesis:

1. Создать initial ATH/TON pool с целевой стартовой cap `100_000 TON`.
2. Начальная модель:
   - total supply `100_000_000 ATH`;
   - стартовая цена `1 ATH = 0.001 TON`;
   - activity reward за обычное сообщение: `10 ATH` при publish price `0.01 TON`;
   - post-quantum publish платит `0.02 TON`, но reward остаётся `10 ATH`.
3. Собрать STON.fi route evidence.
4. Заполнить:

```text
artifacts/m20f_mainnet_route_freeze_input_template.json
```

5. Запустить:

```powershell
npm.cmd run m20f:preflight
```

6. Если M20F готов, вызвать `BuybackBurn.FreezeBuybackRoute`.
7. Проверить:
   - `route_frozen == true`;
   - `genesis_config_hash == 0`;
   - frozen route actors match evidence;
   - frozen quote/minOut match evidence.
8. Freeze MarketStability pricing:
   - `base_tranche_price_nanotons == evidence_x1_tranche_quote_nanotons`;
   - `pricing_evidence_hash != 0`;
   - post-freeze `genesis_config_hash == 0`.

Потом заполнить и запустить:

```text
artifacts/market_stability_seller_readiness_input_template.json
npm.cmd run market-stability:readiness
```

Readiness должен блокировать:

- underpriced или overpriced base/evidence mismatch;
- malformed decimal evidence;
- partial reserve backing;
- previous sale/tranche/pending state;
- wrong official wallet.

## Phase 5: market stability reserve

MarketStabilitySeller нужен не как PWA feature, а как staged distribution surface: он выпускает reserve в рынок постепенно, чтобы не убить прикладное использование ATH резким ростом цены при маленьком сообществе.

Порядок:

1. После pricing freeze reserve funder переводит `45M ATH` через production ATHWallet notify path в official MarketStabilitySeller ATH wallet.
2. Readiness проверяет:
   - `reserve_due_ath == 45M ATH`;
   - `reserve_funded_total_ath == 45M ATH`;
   - official wallet balance == `45M ATH`;
   - no sale state.
3. PWA не обязана иметь экран покупки MarketStability ATH. Это protocol/market mechanism, не пользовательский core flow.

После `x16` tranche цена больше не регулируется Seller-ом. Дальше цена живёт рынком.

## Phase 6: enable buyback split

EnableBuybackSplit является one-way action. Его нельзя нажимать "потому что вроде пора".

Перед enable заполнить input для:

```text
scripts/enable_buyback_split_preflight.ts
npm.cmd run buyback:enable-preflight
```

Preflight обязан проверить:

- Vault activity airdrop remaining `<= 15M ATH`;
- FeeAccumulator split ещё disabled;
- `buyback_due_ton == 0`;
- BuybackBurn sealed;
- BuybackBurn route frozen;
- BuybackBurn launch controller burned;
- FeeAccumulator <-> BuybackBurn binding;
- BuybackBurn live state clean;
- BuybackBurn totals zero;
- M20F evidence ready.

Только после PASS treasury receiver вызывает `FeeAccumulator.EnableBuybackSplit`.

## Phase 7: operations after launch

Разрешённые регулярные операции:

- `CapsuleHub.FlushFees` to FeeAccumulator;
- `FeeAccumulator.SplitAccumulated`;
- `FeeAccumulator.FlushTreasuryDue`;
- `FeeAccumulator.FlushBuybackDue` только complete `51.05 TON` envelope;
- `BuybackBurn.ExecuteBuybackChunk` with frozen quote/minOut;
- `BuybackBurn.RecoverStonfiRouteRefund` only after deadline/grace and large current refund;
- `BuybackBurn.RecycleRouteRefundReserve` only after route freeze;
- `BuybackBurn.RetryAthBurnDue` only for full retry due;
- Username/Profile due flushes;
- MarketStability treasury flush.

Не добавлять emergency rescue/pause/admin drain без отдельного audit cycle. Если operations застряли, сначала доказываем конкретный stuck path, потом проектируем narrow fix. Не наоборот.

## PWA deployment

Перед публикацией PWA:

```powershell
npm.cmd run web:deploy:prepare:prod
```

Проверить:

- production static bundle содержит `web/docs/*.md`;
- PWA runtime config указывает на final mainnet addresses;
- нет русских draft documents в published bundle;
- нет testnet addresses в production config;
- service worker cache version bumped;
- docs viewer открывает:
  - About Platho;
  - ATH Whitepaper;
  - Crypto Protocol.

## Что не тащим в PWA

В PWA нужны user flows:

- wallet create/import/export;
- Vault TON/ATH deposit/withdraw;
- key activation/rotation/sync;
- private/public messages;
- images;
- public channels/comments;
- `.ath` mint and failed mint refund claim;
- profile avatar upload/update;
- ATH stats/burn.

В PWA не тащим:

- MarketStabilitySeller tranche buyer screen;
- generic ATH transfer UI;
- keeper-only prune/recycle/recovery panels;
- genesis/freeze/preflight controls.

Эти операции остаются deployment/ops scripts, иначе пользовательский интерфейс превратится в шкаф с проводами.

## Финальный go/no-go

Mainnet go возможен только если:

- fresh audit pass не содержит open C/H/M;
- текущий `HEAD` совпадает с audit archive;
- CI зелёный;
- final genesis verifier PASS;
- M20F route freeze preflight PASS;
- MarketStability readiness PASS после pool/pricing/reserve;
- EnableBuybackSplit preflight PASS перед one-way enable;
- deployment artifacts, tx hashes, code hashes and getter snapshots сохранены immutable.

Любой FAIL здесь означает остановку. Не "пропустить и вернуться позже". Позже обычно приходит с адвокатом.
