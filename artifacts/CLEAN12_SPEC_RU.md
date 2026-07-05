# clean-12 — стандартный TEP-74 ATH + on-chain social_links (рабочий спек)

**Цель:** ре-генезис clean-12, при котором ATH становится полностью TEP-74-совместимым (виден в Tonkeeper, индексируется tonapi, торгуется на STON.fi/DeDust), а кастомный протокол ATH* (106 ссылок в 11 файлах) сохраняется как **внутренний канал (Lane B)** без изменений. Плюс дешёвый бандл: on-chain `social_links` в метаданных коллекции → GetGems авто-подтягивает ссылки.

**Причина:** clean-11 (immutable, live в проде) держит ATH как ЗАКРЫТЫЙ протокольный джеттон — невидим кошелькам и несовместим с DEX. Корневые причины: (1) `ATHWallet.get_wallet_data` отдаёт 3-tuple вместо TEP-74 4-tuple; (2) на входящем с `forward_ton_amount>0` эмитит кастомный `AthTransferNotification`+escrow вместо стандартного `0x7362D09C`. См. [[ath-jetton-nonstandard-wallet-discovery]]. In-place не чинится (immutable) → нужен ре-генезис.

**Статус clean-11:** airdrop не распределён, реальных пользователей ~нет → **осиротить приемлемо**.

---

## 0. Принцип: dual-channel маршрутизация по опкоду (= по контрагенту)

Кастомные опкоды умеют эмитить ТОЛЬКО системные кошельки Platho, поэтому входящий ATH роутится по опкоду:

- **Lane A (стандарт TEP-74, fire-and-forget):** вход `0x178D4519 JettonInternalTransfer`. Любой ATH извне (retail, DEX-роутер, системный контракт без отката). При `forward_ton_amount>0` → настоящий `0x7362D09C JettonTransferNotification` получателю + `0xD53276DB JettonExcesses`. Без escrow/ack/pending.
- **Lane B (кастом two-phase escrow+refund):** вход только через `ATHInternalTransferWithNotify 0x41544815`, `…VaultMintUsername 0x89129D60`, `…VaultProfileAvatar 0xA11A7002`. Эмитятся ТОЛЬКО из `ATHTransferRequest*`-пути системного кошелька (guard `sender()==self.owner_address`). Внешний DEX/пользователь физически не достигает Lane B. **Сохраняется байт-в-байт.**

Аутентификация Lane A = стандартный паттерн: consumer проверяет `sender()==deriveAthWalletAddress(myAddress())` (доказательство прибытия) + собственная idempotency-карта (replay-safety).

---

## 1. Контракты

### 1.1 `ATHWallet.tact` — 4 правки (HIGH-VALUE, точность обязательна)

**(1) `get_wallet_data` → 4-tuple** [getter ~1063, struct ~250]. Порядок+ТИПЫ строго `{int, slice, slice, cell}`:
```tact
struct ATHWalletDataView { balance: Int; owner: Address; jetton: Address; jetton_wallet_code: Cell; }
get fun get_wallet_data(): ATHWalletDataView {
  return ATHWalletDataView {
    balance: self.balance, owner: self.owner_address, jetton: self.ath_master_address,
    jetton_wallet_code: (initOf ATHWallet(0, self.owner_address, self.ath_master_address)).code };
}
```
Селектор строго `get_wallet_data`. Чинит `holders:0` и невидимость. GET-методы off-chain → нулевой on-chain gas.

**(2) Стандартная нотификация на внешнем входящем** [`receive(JettonInternalTransfer)`, ветка `forward_ton_amount>0`, строки 763-791]. Убрать escrow (`pending_notifications.set`) + кастом-emit; вместо:
```tact
self.balance += msg.amount;
message(MessageParameters { to: self.owner_address, value: msg.forward_ton_amount,
  mode: SendPayFwdFeesSeparately, bounce: false,   // bounce:false ОБЯЗАТЕЛЬНО
  body: JettonTransferNotification { query_id: msg.query_id, amount: msg.amount,
    sender: msg.from, forward_payload: msg.forward_payload }.toCell() });
```
`forward_payload` — вербатим (`Slice as remaining`, без re-wrap; DEX swap/LP-op внутри не искажать). Ветка `==0` без изменений. Пере-пинить value-guard (14714): больше нет `ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT` (нет tombstone); новый пол inlined-константой, `getForwardFee` в runtime НЕ звать (правило [[tact-preaccept-gas-budget]]).

**(3) `JettonExcesses` (799-808)** — конформен, оставить. Опц.: `SendRemainingValue` вместо фикс. `1e6` (каноничнее) — owner-decision.

**(4) Lane B surface — БЕЗ изменений** (`ATHInternalTransferWithNotify` :812, VaultMint :869, VaultAvatar :918, ack/refund/prune :981/:1010/:1015, все `bounced()`). Кастом-декларации остаются объявленными.

### 1.2 `ATHMaster.tact` — ноль правок исходника, build-order + верификация

`get_jetton_data` :121 (5-tuple) и `get_wallet_address` :132 уже стандартны. Правка struct'а меняет code-hash кошелька → **собирать ATHMaster в lockstep с новым ATHWallet** (встраивает `jetton_wallet_code` через `initOf`). Burn-путь (`ATHBurnNotification 0x41544802`) — оставить кастомным (не влияет на видимость). **Add assert:** `get_jetton_data.jetton_wallet_code`-hash == задеплоенный ATHWallet-hash (иначе индексатор выводит неправильный адрес = тихая невидимость).

### 1.3 Входящие consumers (шипятся в том же clean-12 — атомарно)

| Контракт | Изменение | Обязательность |
|---|---|---|
| **BuybackBurn** :456 | ADD `receive(JettonTransferNotification)`: `sender()==official_ath_wallet`; `msg.sender==stonfi_ath_source_owner`; `phase==PENDING_STONFI_SWAP`; query_id; `amount>=pending_dex_min_out` → `sendAthBurn`. Убрать ack. | **ОБЯЗАТЕЛЬНО** — единственный вход от реального STON.fi-роутера (plain jetton transfer → 0x7362D09C). |
| **Vault** :1329 | ADD `receive(JettonTransferNotification)` (зеркало `AthTransferNotification`): `sender()==vault_ath_wallet`; `msg.sender`/amount/query_id; dedupe `processed_ath_deposits`+`computeAthDepositId`; кредит `ath_balance`. Убрать ack. Outbound withdrawal/paid-mint — Lane B. | Обязательно, если депозит-путь юзается. Migrate vs dual-accept — owner-decision. |
| **MarketStabilitySeller** :358 | SPLIT: inbound reserve-funding → ADD `receive(JettonTransferNotification)` (`sender()==official_ath_wallet`; `msg.sender==reserve_funder`; supply-cap; опц. query_id-dedupe). Outbound priced-sale :383/:426 — Lane B без изменений. | Обязательно, если reserve-funding юзается (funder-тулинг шлёт стандартный JettonTransfer). |
| **UsernameRegistry** :568 | БЕЗ изменений — Lane B (async NFT-deploy 2-я фаза может упасть ПОСЛЕ движения ATH → нужен refund-канал). `payer_wallet==vault_address` сохранён. | — |
| **ProfileRegistry** :372 | БЕЗ изменений — Lane B. | — |
| **ATHVesting** :154 | БЕЗ изменений — sender-only outbound `ATHTransferRequest→Ack/Failed/bounced` (стандарт даёт только best-effort excesses, не типизированный ack). | — |

**Сохранение auth:** (A) `sender()==own-derived-wallet` на 0x7362D09C = arrival-auth; (B) replay-safety в собственной карте consumer'а (Vault `processed_ath_deposits`; BuybackBurn `phase+query_id`; MSS supply-cap ± query_id-set); (C) обе платные реестра + все outbound-леги = Lane B.

### 1.4 Пересборка
`build ATHWallet` → `build ATHMaster` (lockstep) → `BuybackBurn`/`Vault`/`MSS`. Обновить `build/*` TS-биндинги. Прогнать suite.

---

## 2. Форк через `deployment_id`
`PLATHO_ATH_DEPLOYMENT_ID=platho-mainnet-20260705-clean-12` (валидатор `^[a-z0-9._-]{8,80}$`) → `generate_ath_metadata_content.ts` (новый contentHash) → `mainnet_ath_master_derivation.ts` (новый master + новый wallet-code-hash) → каскадный пере-вывод всех ролей на ТЕХ ЖЕ vanity-кошельках (форк через контент-хеш, не новые кошельки — [[genesis-redeploy-deployment-id-fork]]). Collision-gate: пересечение с live clean-11/clean-10 = ∅.

---

## 3. Соц-ссылки на GetGems — ВЕРДИКТ: on-chain НЕ работает, путь = OFF-CHAIN JSON

**ПРОБНИК ПРОВЕДЁН 2026-07-05 (коллекция `EQAz4_KYXm…lylZKvct9`, on-chain social_links в TEP-64 dict):** tonapi забрал `raw_collection_content`, но распарсенные `metadata` = {name, description, image} — `social_links` ОТСУТСТВУЕТ. **On-chain social_links индексаторы/GetGems НЕ читают. В clean-12 в ончейн НЕ зашивать.** (Воркфлоу ранее заявил «читает, high confidence» — это был ошибочный вывод агента; первоисточник `getgems-io/nft-contracts/docs/metadata.md` документирует social_links ТОЛЬКО для off-chain JSON.)

**РАБОЧИЙ ПУТЬ = off-chain collection JSON.** GetGems-редактор метаданных доступен ТОЛЬКО коллекциям, заминченным через GetGems (helpscout) — нашу их формой не отредактировать. Решение: в clean-12 `UsernameRegistry.collectionContent()` возвращает `0x01 + URL` (напр. `https://platho.app/collection.json`) ВМЕСТО on-chain dict. GetGems тянет JSON и показывает name/description/image + **social_links** оттуда; владелец правит СВОЙ JSON на platho.app в любой момент (полный контроль, не через форму GetGems).

**Развилка (owner-decision, отдельная от токен-фикса):**
- **Off-chain JSON (platho.app):** соц-ссылки работают+редактируются; церемония ПРОЩЕ (нет UploadCollectionMeta×N+Seal — collection_content = крошечный URL-cell); ЦЕНА — страница коллекции на GetGems зависит от platho.app (лёгкий конфликт с «no backend», но это витрина маркетплейса; NFT-айтемы остаются fully on-chain, individual_content не трогается).
- **Fully on-chain (как сейчас):** страница полностью децентрализована, но соц-ссылок на GetGems НЕТ.

Проверить off-chain-путь на тест-коллекции до clean-12 seal (документирован, но эмпирику снять). `sha256("social_links")=0xf090cb12…` и uint16 META_KEY нужны ТОЛЬКО если выбран (отвергнутый) on-chain путь. Формат значения: **строка-текст JSON-массива до 10 plain-URL** (`["https://x.com/…","https://t.me/…"]`), GetGems сам детектит платформу по домену.

**Как контракт строит ключи (проверено, `UsernameRegistry.tact:327-330`):** `collectionContent()` кладёт части под `sha256(имя)`, а uint16 (1/2/3) — внутренние индексы хранения. Значит:
- **Контракт:** добавить `USERNAME_COLLECTION_METADATA_KEY_SOCIAL_LINKS = 0xf090cb124d6197b2b03070d0332882727b19fa9197248f770bf4f085e466ade5` (= sha256("social_links")) + `USERNAME_META_KEY_SOCIAL_LINKS = 4` + `USERNAME_META_PART_COUNT: 3→4` + строка `metadata.set(KEY_SOCIAL_LINKS, self.metaCell(4))` в `collectionContent()`.
- **Аплоадер** `mainnet_upload_collection_meta.ts`: `META_KEY_SOCIAL_LINKS = 4n` + 4-я часть = `snake(JSON.stringify(urls))`.
- `SealCollectionMeta` теперь 4 части; `mainnet_genesis_verify.ts` — учесть новое число.
- **Верифицировать на TEST-коллекции ДО seal** ([[no-premature-impossible-verify-empirically]]).
- Опц. `marketplace` = `sha256("marketplace")=0xdfd76b3e…` → `snake("getgems.io")`.

(Примечание: это метаданные **коллекции username-NFT**, не jetton — ортогонально токен-фиксу, бандлится в ту же церемонию.)

**Стопгэп на clean-11 СЕЙЧАС:** ссылки можно просто вбить в GetGems edit-UI (off-chain, в базе GetGems) — покажутся, но НЕ из ончейна. On-chain-подтяжка — только clean-12.

---

## 4. Cutover клиента + версии
`web/platho-config.mjs` → clean-12-адреса (vault+`deploymentManifestHash`, capsuleHub, feeAccumulator, **ath.master — критично**, usernameRegistry, profileRegistry; publicChannels[].authorWallet если ролевой). `tonDns.rootAddress` не меняется. Version-bump lockstep ([[send-latency-diagnosis]] app.js?v=): `web/index.html` app.js?v=668, `web/sw.js` app.js?v=668 + SW-кэш. Depos/paid-mint client-путь: Lane B custom для платных реестров/Vault-mint без изменений; обычный top-up — по owner-decision migrate/dual-accept.

---

## 5. Тесты + release-evidence
Contract unit: ATHWallet (4-tuple типы; 0x7362D09C эмит + вербатим payload + bounce:false; Lane B зелёный); consumer (BuybackBurn/Vault/MSS принимают 0x7362D09C + self-dedupe отвергает повтор). **STON.fi-shape-тест** BuybackBurn (реальная форма router-payload → burn). Full `npm test` (canonical: `vitest.all.config.ts` 30000ms single-worker — [[canonical-test-command]]). Release-evidence rebaseline ([[release-evidence-rebaseline]]): deploy-prep + release-truth + m18/m20f + все хардкоды `deploymentManifestHash`.

---

## 6. Церемония (owner-gated, tonapi-транспорт)
`D09 deploy → DeployTreasurySupply (100M) → Bind* → Fund → [UploadArt×56+SealArt] → [UploadCollectionMeta×4+SealCollectionMeta (вкл. SOCIAL_LINKS)] → SealGenesis`. Каждый шаг: dry-run (byte-round-trip) → owner go → `--broadcast`. tonapi send (toncenter роняет крупные externals — [[clean11-ceremony-live]]). **НЕ seal до 4/4 Раздела 7.**

---

## 7. Post-seal acceptance (НЕ доверять до 4/4 PASS)
1. tonapi `holders>0` + treasury `get_wallet_data` парсится 4-tuple + round-trip (`get_wallet_address(owner)`→derive из `jetton_wallet_code`→совпадает).
2. **Tonkeeper** показывает баланс ATH (реальное устройство).
3. **Реальный STON.fi micro-pool:** создать пул + swap → ATH кредитуется, 0x7362D09C доходит до роутера, BuybackBurn корректно потребляет свою нотификацию + burn; forward_payload не искажён.
4. **GetGems** авто-рендерит social_links.
Плюс: code-hash lockstep assert; meta_sealed; genesis_sealed; все байнды.

---

## 8. Осиротение clean-11
Зафиксировать в церемониальной записи: «clean-11 orphaned, superseded by clean-12; airdrop не распределён; состояние не мигрируется». Обновить [[clean11-ceremony-live]] → superseded.

---

## Риски (ранжированы)
1. **ROOT-CAUSE INTERLOCK:** wallet-fix меняет вход Vault/BuybackBurn/MSS → их хендлеры шипятся АТОМАРНО в том же clean-12, иначе fund-путь тихо ломается (unhandled opcode).
2. **bounce:false** на 0x7362D09C обязателен.
3. **Replay на migrated inbound:** Vault self-dedupe safe; BuybackBurn — дубль после смены phase = no-op (проверить, не double-burn); MSS — supply-cap bounded ± query_id-set.
4. **Code-hash lockstep** master↔wallet (assert-gate).
5. **DEX forward_payload** вербатим; `sender` в 0x7362D09C = from-OWNER (`msg.from`), не адрес кошелька.
6. **Empirical verify before seal** — immutable.
7. **Adversarial review MANDATORY** для send/credit-path ([[send-latency-diagnosis]]).

---

## Owner-decisions
1. Подтвердить ре-генезис clean-12 + осиротение clean-11. **[ВЛАДЕЛЕЦ СКАЗАЛ ДА — вариант 3]**
2. Точный `deployment_id` (реком. `platho-mainnet-20260705-clean-12`).
3. Vault+MSS inbound: migrate-only (реком., чистая поверхность) vs dual-accept.
4. MSS reserve replay: добавить query_id-dedupe-set (реком. да).
5. Платные реестры: оставить Lane B (реком. да).
6. Burn-путь: оставить кастомным (реком. да).
7. **social_links: финальный список URL (max 10) — НУЖЕН ОТ ВЛАДЕЛЬЦА** + нужен ли `marketplace`.
8. Excesses `SendRemainingValue` vs фикс — да/нет.

## Оценка усилий
~4-5 инженерных дней до готовности к церемонии (контракты ~1-1.5д + adversarial review; social_links ~0.5д; cutover+версии+evidence ~0.5д; тесты ~1д) + церемония owner-gated ~1-2 календарных дня (гейты + on-chain финализации + tonapi-индексация + 4/4 acceptance).
