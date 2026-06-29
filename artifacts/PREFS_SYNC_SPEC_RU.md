# Spec: синхронизация подписок через приватную капсулу себе (Phase 2, v1)

Статус: ФИНАЛ, готов к реализации. Решения владельца зафиксированы. Редеплой контрактов НЕ требуется
(проверено по `contracts/CapsuleHub.tact`: тело хранится по хешу, тип не инспектируется; получатель==отправитель
разрешён; kind PRIVATE уже есть).

## Зафиксированные решения владельца
1. Формат снимка — **JSON**.
2. **Piggyback — следующим шагом** (не в v1). v1 = только кнопка + чтение/восстановление + UI.
3. Кнопка «Save subscriptions» **неактивна, когда сохранять нечего** (`prefsDirty === false`).
4. **Никакого тихого/фонового flush** — запись только по явной кнопке.
5. Bootstrap-граница: RPC-ключ остаётся в backup-файле (pre-bootstrap), подписки уходят на цепочку (post-bootstrap).

## Модель данных — полный снимок (не дельта), JSON → bytes
```
{ "v": 1, "writtenAt": <unix sec>,
  "channels": [
    { "id": "wallet:<addr>", "w": "<authorWallet>", "sub": true|false,
      "name": "<custom name|null>", "ts": <unix sec> } ] }
```
- Полный снимок (append-only: перезаписи нет, мерж/последний — истина).
- Отписки пишем явно (`sub:false` + `ts`) — иначе воскреснут.
- per-channel `ts` — для LWW при мультиустройстве.
- Свой и официальный канал в снимок НЕ входят (implicit, всегда есть — v578).

## Транспорт — приватная капсула себе (БЕЗ редеплоя)
- Получатель = свой messaging-ключ (`header0.recipientKeyId` = own). Крипто открывает как recipient.
- Тело — `document`-payload c новым блоком `PLATHO_DOCUMENT_BLOCK_TYPES.PREFS = 0x03`, content = байты снимка.
- Приватный декодер строгий → добавить PREFS в известные типы. Старые клиенты пропустят (forward-compat).
- Идёт по существующему приватному пути (kind `CAPSULEHUB_ENTRY_KIND_PRIVATE`), новых контрактных методов нет.

## Подтверждённые точки интеграции (по коду web/app.js)
- Self peer entry: по образцу `resolveRecipientPeerEntry` (16872) для СВОЕГО кошелька →
  `{ walletAddress, user, keyRecord, currentKeyId, publicBundle }`. publicBundle = `publicKeyBundleFromVaultKeyRecord(own keyRecord)`.
- Сборка капсулы: новый `createPrivatePrefsCapsules(snapshotBytes, selfEntry, options)` по образцу
  `createPrivateComposerCapsules` (20829), но documentBytes = `encodeMessageDocumentBlocks([{type:'prefs', bytes}])`
  вместо `messageDocumentBytesFromDraft` (изолирует риск от чат-билдера). type payload остаётся 'document'.
- Публикация: `publishCapsuleThroughVault` / `publishCapsulesThroughVault` (вся nonce/double-spend защита внутри).
- Приём/divert: `appendOpenedCapsuleMessage` (8008) + `messageFromOpenedCapsule` (7766) — если открытая капсула =
  document с единственным PREFS-блоком → НЕ сообщение: отдать снимок в prefs-apply, в тред/историю/непрочитанные НЕ класть.
- Кодек блоков: `encodeMessageDocumentBlocks` (14434) / `decodeMessageDocumentBlocks` (14474), типы
  `PLATHO_DOCUMENT_BLOCK_TYPES`.

## Публикация (v1 — только кнопка)
- follow/unfollow локально мгновенно и бесплатно → `prefsDirty = true`, `writePrefsDirty()`.
- Кнопка «Save subscriptions» (профиль): собрать снимок из локального состояния → `createPrivatePrefsCapsules` →
  `publishCapsuleThroughVault`. На успехе: `prefsDirty=false`, `prefsLastSyncedAt = writtenAt`. In-flight-лок (как
  `messageSyncManualInFlight`), статусы saving…/saved/failed. Стоимость ≈ 0.03–0.05 GRAM.
- Кнопка `disabled` когда `prefsDirty===false` (статус «saved»).

## Чтение / восстановление
- Recipient-walk (тот же приём, что и входящие N личек) surfaces prefs-капсулы → divert (см. выше) → собрать живые снимки.
- Мерж per-channel LWW по `ts` (union всех живых снимков, по каналу максимальный ts).
- Применить к `publicChannelSubscriptions` + `customPublicChannels` → `rebuildPublicChannelRegistry` +
  `rebuildThreadsFromPublicSubscriptions` + `resyncPublicForNewSubscription`.
- Слияние с локальным: если локально не пусто — тот же per-channel LWW (импорт не затирает свежие локальные).

## UI (профиль)
- Строка-кнопка «Save subscriptions» рядом с Import/Export wallet key.
- `<strong>`-статус = дата последней синхронизации (`prefsLastSyncedAt`); «not saved» если ни разу;
  saving…/saved/save failed/RPC busy по ходу.

## Edge cases
- Вытеснение: нужна только последняя капсула; retention 1 год; refresh не авто (кнопка). Если всё вытеснилось —
  остаются implicit-каналы (свой + офиц.).
- Мультиустройство: per-channel LWW по `ts`.
- Приватность: капсула неотличима от обычной лички себе на уровне контракта.
- Forward-compat: prefs-блок добавляется в известные типы строгого декодера; старые клиенты пропускают капсулу.

## Миграция существующих
- Первый запуск с этой версией: есть локальные подписки, `prefsLastSyncedAt` пуст → `prefsDirty=true` + мягкий нодж
  на кнопке (без авто-записи — не списываем тихо). Решение за пользователем.

## Каскад версий + тест-гарды
- Бамп app.js/index.html/sw (+styles если CSS кнопки).
- Гарды: PWA-PREFS-CAPSULE-01 (PREFS block + to-self publish + декодер знает PREFS),
  PWA-PREFS-RESTORE-01 (recipient-walk + per-channel LWW + apply),
  PWA-PREFS-CHAT-FILTER-01 (prefs не попадает в чат),
  PWA-PREFS-BUTTON-01 (кнопка + дата + disabled-когда-нечего + in-flight-лок),
  PWA-PREFS-NO-SILENT-FLUSH-01 (нет фонового/idle flush; запись только из кнопки).

## Phase 2.1 (следующий шаг, не сейчас)
- Piggyback: при отправке ЛИЧНОГО сообщения (тот же PRIVATE-батч) доклеивать prefs-часть, если `prefsDirty` (бесплатно).
