# Спецификация: ончейн-индекс публичных постов по автору (симметрия с приватным)

Дата: 2026-06-22. Статус: ПРОЕКТ (контракт ещё не трогаем — immutable, сначала ревью).

## 1. Цель и ограничения

- **Ноль серверов, навсегда.** Клиент скачивает статическую страницу и работает напрямую с чейном.
- Пользователь видит **только подписанные каналы**. Что пишут остальные — не нужно; глобальная лента не требуется.
- Масштаб — десятки тысяч пользователей и постов.

## 2. Корень проблемы (подтверждено по контракту)

Приватные масштабируются, потому что контракт ведёт **ончейн-индекс по получателю**:
`private_recipient_index: map<uint256 keyId, {latest_entry_link, entry_count}>` + у каждой
`PrivateCapsuleEntry` есть `recipient_prev_link` (обратный связный список). Клиент идёт по
`recipient_prev_link` от головы своего ключа — трогает только свои сообщения.

У публичных такого нет: `PublicCapsuleEntry{publish_id,created_at,author_wallet,body_hash,header}`
без `prev_link`, и нет `public_author_index`. Поэтому «посты автора W» можно достать только
глобальным обходом. Это асимметрия на уровне контракта.

## 3. Правка контракта — индекс по автору (Фаза A)

Зеркало приватного индекса получателя, но в одном экземпляре (у публичного поста один
заинтересованный — автор канала).

### 3.1 Состояние
```
+ public_author_index: map<Int as uint256, PublicCapsuleKeyIndex>;   // новый
struct PublicCapsuleKeyIndex { latest_entry_link: Int as uint64; entry_count: Int as uint64; }  // = PrivateCapsuleKeyIndex
```

### 3.2 Запись (в PublicCapsuleEntry)
```
struct PublicCapsuleEntry {
    publish_id, created_at, author_wallet, body_hash, header,
+   author_prev_link: Int as uint64;   // новый — обратная ссылка на предыдущий пост этого автора
}
```

### 3.3 authorKeyId из адреса автора
`author_wallet` уже batch-level поле `PublishBatchToHub` (используется на [CapsuleHub.tact:688](../contracts/CapsuleHub.tact:688)),
поэтому **формат wire-сообщения менять не нужно**. Ключ индекса выводим из адреса:
`authorKeyId = beginCell().storeAddress(msg.author_wallet).endCell().hash()` (256 бит).
Клиент обязан считать тот же ключ — уже есть прецедент байт-совместимого хэша адреса автора
(`computeVaultPublicEntryUid`). Пинить тест-вектор. (Альтернатива — сырой account-id адреса при
гарантии workchain==0; хэш безопаснее и workchain-агностичен.)

### 3.4 Публикация (публичная ветка, [CapsuleHub.tact:672-699](../contracts/CapsuleHub.tact:672))
Перед `public_entries.set(...)`:
```
let authorKeyId = <hash(author_wallet)>;
let entryLink = self.entryLink(entryId);
let authorPrevLink = self.pushPublicAuthorIndex(authorKeyId, entryLink);  // = pushPrivateRecipientIndex
... PublicCapsuleEntry{ ..., author_prev_link: authorPrevLink }
```
`pushPublicAuthorIndex` — точная копия `pushPrivateRecipientIndex` ([:465](../contracts/CapsuleHub.tact:465)).
Прунинг по истечении ретеншена — копия `prunePrivateRecipientIndex` ([:500](../contracts/CapsuleHub.tact:500)),
с тем же контрактом «середину не перешиваем».

### 3.5 Геттеры / View
```
+ get fun get_public_author_index(authorKeyId: Int): PublicCapsuleKeyIndexView   // = get_private_recipient_index (:879)
  PublicCapsuleEntryView += author_prev_link   // чтобы клиент читал ссылку при обходе
```

### 3.6 Газ и хранилище (рекалибровать как у приватного)
- `HUB_PART_GAS_PUBLIC` поднять на стоимость одного `.get`+`.set` индекса (как `HUB_PART_GAS_PRIVATE`, у которого их два).
- `CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT` поднять на размер `author_prev_link` + амортизованный слот `public_author_index`; `batchStorageReserveWithBuffer` публичной ветки это уже разнесёт на публикатора ([:589](../contracts/CapsuleHub.tact:589), [:697](../contracts/CapsuleHub.tact:697)).
- `indexStorageReserve` ([:289](../contracts/CapsuleHub.tact:289)) уже суммирует public_live_count — формула не меняется, меняется только endowment-константа.

## 4. Комментарии — СИММЕТРИЧНЫЙ подводный камень (Фаза B, решение нужно)

Комментарии — это тоже публичные записи, но авторов у них РАЗНЫЕ, а привязаны они к родительскому
посту (`parentEntryId`). Индекс по автору даёт ленту канала, но **«покажи комментарии к посту X»**
по нему не построить: комментаторы — чужие авторы, ты на них не подписан. Если сделать только Фазу A,
комментарии к посту перестанут подтягиваться при масштабе — это ровно тот же класс бага, что и лента.

Симметричное решение — **индекс по родителю**:
```
+ public_parent_index: map<Int as uint64 parentEntryId, PublicCapsuleKeyIndex>;
  comment entry += comment_prev_link
```
Но `parentEntryId` сейчас лежит в теле/заголовке и контрактом не парсится → нужно **добавить
parent_entry_id явным полем в публичную part** (это уже изменение wire-формата и харнесса vpb2).

**Решение владельца:** комментарии должны масштабироваться в v1 (делаем Фазу B сразу) или для
старта хватает ленты каналов (Фаза A), а треды комментариев — позже?

## 5. Клиент (без сервера)

- `syncPublicChannelFromChain` (глобальный обход [app.js:5553](../web/app.js:5553)) заменяется на **обход по каждому подписанному автору**: `get_public_author_index(authorKeyId).latest_entry_link` → идём по `author_prev_link` назад. Прямая калька `walkIndexedRole` ([app.js:7730](../web/app.js:7730)) + курсор-персистентность на автора.
- Баг **автоподписки исчезает сам по себе**: ходим только по тем, на кого подписаны явно. `ensurePublicChannelForAuthorWallet` больше не подписывает при синке.
- Дискавери новых каналов — вне глобальной ленты (ссылка, упоминание, приватный чат, официальный platho.app). Это согласуется с «вижу только подписки».
- Прямой page-scan канала остаётся break-glass-фолбэком (как keyless toncenter) — на случай цензуры узла.

## 6. План передеплоя

Правка кода контракта меняет code hash → **новый адрес CapsuleHub** → требуется пере-церемония
(как clean-06→09, см. genesis-redeploy-deployment-id-fork):
1. Перекомпилировать CapsuleHub + Vault (ребайнд `vault_address` ↔ новый Hub).
2. Прогнать генезис-церемонию (clean-10), пере-сила, ребайнд Vault↔Hub.
3. Обновить адреса в web-конфиге.
4. Обновить харнесс: `tests/helpers/vpb2.ts` (новое поле/инвариант author-индекса; при Фазе B — parent поле), новые газ/хранилище-константы, инвариант «у каждого public-поста author_prev_link корректно связан».
5. Полный прогон тестов + ребейзлайн release-evidence.

Старые ончейн-данные публичной/приватной части — выбрасываемые (реальных юзеров нет).

## 7. Решения, нужные от владельца

1. **Комментарии**: Фаза B сразу (индекс по родителю + wire-поле parent) или позже?
2. **authorKeyId**: хэш адреса (рекомендую) или сырой account-id с guard workchain==0?
3. Подтвердить готовность к пере-церемонии CapsuleHub (новый адрес, clean-10).
