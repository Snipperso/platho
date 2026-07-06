# Testnet-проверка refund-топологии STON.fi — гейт перед FreezeBuybackRoute (и перед genesis-seal)

Статус: READY_TO_EXECUTE_PENDING_TESTNET_FUNDING_AND_POOL
Дата: 2026-07-06
Связано с: F11-hardening (BuybackBurn dead-man + ATHWallet top-up + MSS-флор #3), redeploy-v2-design.

---

## 1. Зачем эта проверка

Провальный STON.fi-swap (не набрался `min_out` / истёк deadline) возвращает TON.
BuybackBurn зачитывает этот возврат в `route_refund_due_ton` **только** если отправитель —
один из ТРЁХ whitelisted-адресов (пустой fallback, `BuybackBurn.tact:602`):

```
if (sender() == self.stonfi_pton_wallet_address
 || sender() == self.stonfi_router_address
 || sender() == self.stonfi_pool_address_ton_ath) {
    self.creditRouteRefundValue(context().value);
}
```

Если реальный STON.fi вернёт TON с **другого** адреса:
- возврат НЕ зачтётся в `route_refund_due_ton` → primary-recycle (`RecoverStonfiRouteRefund` → `RecycleRouteRefundReserve`) недоступен;
- но TON **не потерян** — он остаётся в балансе контракта и идёт в будущие циклы;
- фаза всё равно расстопоривается **dead-man**'ом `RecoverStuckStonfiSwap` (F11) через grace-период.

То есть dead-man убирает **экзистенциальный** риск (кирпич невозможен). Эта testnet-проверка
валидирует **primary-путь** — чтобы в штатной работе не приходилось полагаться на backstop.

## 2. Почему проверять НАДО ДО genesis-seal, а не только до freeze

Whitelist рефанда — это **ровно 3 фиксированных слота** в схеме `FreezeBuybackRoute`
(`stonfi_pton_wallet_address` / `stonfi_router_address` / `stonfi_pool_address_ton_ath`).
Их значения задаются при заморозке маршрута (post-pool), но **количество слотов** зашито в код.

- Если возврат приходит с одного из 3 адресов → всё ок, ничего менять не надо.
- Если возврат приходит с **4-го** адреса (напр., router-excess-wallet или jetton-wallet пула) →
  добавить 4-й слот в whitelist можно **только правкой контракта**, а контракт после genesis-seal
  неизменяем. Значит эту проверку надо провести, **пока схема ещё правится — до genesis-seal.**

Это и есть точная причина «проверить сейчас, пока можем безболезненно передеплоить».

## 3. Почему testnet даёт валидный ответ

Refund-топология — это свойство **кода** роутера/пула/pTON STON.fi v2.1, а не сети.
Code-hash роутера/pTON на testnet и mainnet идентичны (одни и те же контракты STON.fi).
Поэтому «с какого адреса приходит возврат при провале min_out» — воспроизводится на testnet
один-в-один. Сумма не влияет на топологию → достаточно **scaled-swap** (1–2 TON), 55 TON НЕ нужны.

(Существующий гейт `validateStonfiRouteFreezeCandidateV21` дополнительно требует mainnet-evidence
через STON.fi API-симуляцию для пиннинга конкретных mainnet-адресов и live-quote — это отдельно;
здесь мы проверяем именно код-детерминированную refund-топологию.)

## 4. Предпосылки (то, что блокирует запуск сейчас)

- [ ] `.env.testnet.local` с funded одноразовым testnet-деплоером (сейчас файла нет — только `.env.testnet.example`).
      Для scaled-варианта хватит ~10–15 testnet TON (faucet), НЕ 55.
- [ ] Testnet ATH-jetton (деплой testnet ATHMaster/ATHWallet — тот же код, deployment_id для testnet).
- [ ] STON.fi **testnet** TON/ATH-пул с небольшой ликвидностью (через STON.fi testnet router/pTON v2.1).
      Это единственный шаг, требующий интерактивной работы с STON.fi (LP-provision).
- [ ] Адреса STON.fi testnet v2.1: router / pTON-master (из @ston-fi/sdk, `dex/v2_1`).

## 5. Процедура

1. Задеплоить testnet ATH-jetton (production-код ATHMaster/ATHWallet, testnet deployment_id).
2. Создать STON.fi testnet TON/ATH-пул с малой ликвидностью; зафиксировать адреса:
   `router`, `pool(TON/ATH)`, `pton_wallet(BuybackBurn)`, `ath_source_owner`, `ask_jetton_wallet`.
3. Задеплоить **production** `BuybackBurn` на testnet (не harness — у него есть `FreezeBuybackRoute`+`ExecuteBuyback`).
4. `FreezeBuybackRoute` на testnet-топологию. Для форс-провала выставить
   `evidence_dex_min_out_atomic_ath` заведомо ВЫШЕ, чем пул может выдать за offer
   (контракт требует `dexMinOut == self.evidence_dex_min_out_atomic_ath`, `BuybackBurn.tact:258`).
5. Профинансировать цикл и `ExecuteBuyback` (scaled offer, напр. 1–2 TON вместо 50) →
   swap уходит в pTON→router→pool → `min_out` не набирается → **refund**.
6. Собрать swap-body тем же валидированным билдером `buildStonfiTonToJettonTxParamsV21`
   (`scripts/stonfi_v2_1_route_lib.ts`) — не переизобретать.

## 6. Наблюдение

- На `testnet.tonviewer.com/<BuybackBurn>` найти входящую value-несущую tx возврата;
  зафиксировать её **source-адрес**.
- Прочитать `BuybackBurn.getGetState()`:
  - `route_refund_due_ton` **увеличился** ⇔ fallback `:602` признал отправителя whitelisted (PASS-сигнал);
  - `phase` вернулась в IDLE (через `RecoverStonfiRouteRefund` при +49 TON, либо через dead-man).

## 7. Критерий PASS

Source-адрес возврата ∈ { `stonfi_pton_wallet_address`, `stonfi_router_address`, `stonfi_pool_address_ton_ath` }
**И** `route_refund_due_ton` зачтён. Тогда:
- в кандидате route-freeze `liveProofs.minOutFailureRefundObservedAsBuybackBurn = true`
  и `ptonRefundObservedAsBuybackBurn = true` (см. `validateStonfiRouteFreezeCandidateV21`);
- никаких правок контракта не нужно, genesis-seal с текущей 3-слотовой схемой безопасен.

## 8. Критерий FAIL и что делать

Source-адрес возврата ∉ whitelist (4-й адрес):
- **До genesis-seal**: добавить 4-й whitelist-слот в `FreezeBuybackRoute` + в fallback `:602`,
  пересобрать, снять новый code-hash, прогнать полный набор тестов, обновить evidence.
- Кирпич при этом невозможен в любом случае (dead-man `RecoverStuckStonfiSwap`), но primary-recycle
  восстанавливается только добавлением слота — а это возможно лишь пока код мутабелен.

## 9. Статический анализ (2026-07-06, 10-агентный воркфлоу, HIGH confidence) — PASS-предсказание

Многоагентная трассировка исходников STON.fi v2.1 (router/pool/pTON FunC + @ston-fi/sdk + docs),
3 линзы + adversarial-скептики (1/3 refute = меньшинство), синтез effort=high:

**Source возврата при провале `min_out` = router-owned pTON jetton-wallet = `ptonMaster.get_wallet_address(router)`
= ровно whitelist слот #1 `stonfi_pton_wallet_address`.** НЕ пул, НЕ роутер напрямую, НЕ BuybackBurn-owned.

Механизм: BuybackBurn кладёт нативный TON прямо в router-owned pTON-wallet ([BuybackBurn.tact:457](../contracts/BuybackBurn.tact));
тот же слот — ожидаемый source bounce ([tact:578](../contracts/BuybackBurn.tact)) → deposit-counterparty == refund-counterparty ==
один router-owned pTON-wallet. При провале он детокенизирует и шлёт нативный TON назад в BuybackBurn
(op 0x01f3835d, single-message ветка, т.к. response_address==to_owner==BuybackBurn). Pool→router `pay_to`(0x657b54f5),
router→свой pTON-wallet std-transfer; сами router/pool нативный TON НЕ эмитят.

**Пред-вычислено на testnet (read-call, без фандинга):** router-owned pTON-wallet =
`kQBbJjnahBMGbMUJwhAXLn8BiigcGXMJhSC0l7DBhdYABhG7` (raw `0:5b2639da8413066cc509c210172e7f018a281c1973098520b497b0c185d60006`),
active, баланс 930 TON, код есть. **Это ОЖИДАЕМЫЙ src эмпирики** — прогон должен показать refund src == этот адрес.

**Вывод: схему НЕ менять** — 3 слота корректны. Риск сместился с «whitelist неверен» на «freeze-ВХОД слота #1
может быть неверно выведен»: freeze-гейт проверяет лишь basechain ([tact:394](../contracts/BuybackBurn.tact)), но НЕ пересчитывает
слот #1 как `getWalletAddress(router)`. **Safeguard (мутабельный tooling, не контракт): добавить в freeze-preflight
ассерт `frozen_slot1 == ptonMaster.get_wallet_address(frozen_router)`.** Эмпирика §5-8 остаётся как подтверждение
кода-истины + валидация вывода слота #1 + отлов маловероятного 2-wallet-detokenization сюрприза.

Остаточные неопределённости (из анализа): STON.fi не открыла точный deployed v2.1 pool/router бинарь (топология
корроборирована из v1 dex-core + v2 docs + SDK); referral-путь через v2.1 Vault вне min_out-refund пути (только если
referral сконфигурен); эмпирика ещё не гонялась.

## 10. Тайминг относительно redeploy

- Genesis-redeploy (dead-man + ATHWallet top-up + MSS-флор #3) технически НЕ замораживает маршрут
  (`FreezeBuybackRoute` — отдельный post-pool owner-call). Формально redeploy не блокируется этой проверкой.
- НО (см. §2): 4-й-адрес-сюрприз лечится только до genesis-seal. Поэтому рекомендуемый порядок:
  **сначала testnet-проверка refund-топологии → потом genesis-seal нового набора.**
- Единственный внешний анблок для исполнения: funded testnet-деплоер + STON.fi testnet-пул (§4).
