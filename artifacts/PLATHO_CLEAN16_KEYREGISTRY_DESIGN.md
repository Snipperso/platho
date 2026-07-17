# KeyRegistry — дизайн (clean-16 Durable-Core, Vault-elimination B1)

Собрано 2026-07-16. Статус: **ДИЗАЙН, до tests-first реализации.** Immutable → чекпойнт до кода.
Источники: живой Vault 13e073c7 (key-record модель), рабочий Vault (clean-16 WIP), UsernameRegistry (freeze-mirror, committed 69614515), CLOSED_SPEC (scan_pubkey/Q5), master-roadmap воркстрим 4.

## 1. Роль и вердикт

KeyRegistry = **новый 4-й Durable-Core контракт** (замораживается на genesis, переживает редеплои как юзернеймы/аватары). Публичный директорий messaging-идентичностей: любой резолвит `owner_wallet → текущие ключи` чтобы зашифровать/верифицировать; старые generations остаются резолвимыми (чтение до-ротационной истории + верификация старых подписей).

**Вердикт `SHRINK_VAULT_TO_KEYREGISTRY`:** НЕ пишем с нуля. Берём key-record подсистему Vault и:
- оборачиваем в freeze-паттерн UsernameRegistry (sealed/requireSealed, controller-bind, SealGenesis),
- **срезаем ВСЮ custody** (ton_balance/ath_balance, Deposit/Withdraw, publish-оркестрацию, ATH-плечо, receive-intents, receipts),
- **добавляем scan_pubkey** (X25519, для INTRO view_tag + CONV-bucket),
- добавляем storage-экономику (#3 revoked-TTL-del, #19 base-rent, per-record эндаумент, reserve-флор),
- **KILLS таймбомбы #1-#6** (все были custody).

## 2. Модель данных

Два стора (как Vault: account-указатель + key-records):

```
struct KeyAccount {                 // per owner_wallet (ключ = addressHash)
    owner_wallet: Address;
    current_key_id: uint256;        // указатель на актуальный KeyRecord
    auth_pubkey: uint256;           // ed25519 action-ключ (rotation-auth). НЕ рекламируется.
    key_generation: uint32;         // счётчик ротаций (монотонный)
    registered_at: uint64;
}

struct KeyRecord {                  // per keyId (все generations, current+old)
    owner_wallet: Address;
    key_generation: uint32;
    enc_pubkey: uint256;            // X25519 encryption
    sign_pubkey: uint256;           // ed25519 signing (advertised)
    scan_pubkey: uint256;           // X25519 scan (НОВЫЙ; INTRO view_tag + CONV bucket)
    pq_kem_pubkey_hash: uint256;
    pq_kem_pubkey_len: uint16;      // == MLKEM768_PUBKEY_LEN
    pq_kem_pubkey: Cell;            // ML-KEM-768 (~1184 байт, ref-цепь)
    crypto_suite_mask: uint16;      // == CRYPTO_SUITE_HYBRID
    created_at: uint64; created_lt: uint64;
    revoked_at: uint64; revoked_lt: uint64;   // 0 = активный; ставится при ротации
}
```

- `accounts: map<Int, KeyAccount>` (ключ = hash(owner) или addr как Int).
- `key_records: map<Int, KeyRecord>`.
- `account_count`, `key_record_count`.
- **keyId** = как в Vault `computeKeyId`, РАСШИРИТЬ включением scan_pubkey в keyFields-хеш (ротация scan меняет keyId — желаемо: scan часть identity-generation).

## 3. Интерфейс сообщений + auth

| Сообщение | Тип | Auth | Действие |
|---|---|---|---|
| `RegisterMessagingKeys` | internal | **sender-auth** (`sender()==owner_wallet`, basechain) | первичная регистрация identity: создать KeyAccount + первый KeyRecord, `current_key_id=keyId`, `auth_pubkey` из payload (≠sign_pubkey, ≠0) |
| `ReplaceMessagingKeys` | external | **signature-auth** (`checkSignature(payload, sig, account.auth_pubkey)`) | ротация: пометить старый record `revoked_*`, создать новый generation+keyId, сдвинуть `current_key_id`. Relay-friendly (любой relay шлёт, подпись авторизует → кошелёк-отправитель развязан). |
| `BindController` / `BindConsumers` | internal | controller-only, unsealed | привязать genesis-controller + (опц.) consumer-адреса |
| `SealGenesis` | internal | controller-only, one-shot | заморозить (`sealed=true`), требует bindings |
| `TopUpStorageReserve` | internal | permissionless | долить эндаумент (self-financing) |
| `PruneRevokedKeyRecord` | internal | permissionless, fail-closed | #3: удалить revoked-record после TTL, оставить compact-tombstone (owner, gen, sign_pubkey, revoked_lt) для верификации старых подписей |

**Почему register=sender-auth, rotate=signature-auth:** первичная привязка не имеет предыдущего auth_pubkey для проверки → якорь = `sender()==owner_wallet` (identity↔wallet связка по определению публична — это цель директория). Ротация имеет auth_pubkey → external+подпись развязывает отправителя (приватность: ротация не требует tx с identity-кошелька). Зеркалит Vault (Register internal / Replace external) — проверенный код.

## 4. Геттеры (что рекламируется)

```
get_key_record(keyId) -> KeyRecordView         // enc/sign/scan/PQ/gen/suite/timestamps/revoked. БЕЗ auth_pubkey.
get_account(owner_wallet) -> KeyAccountView     // current_key_id, key_generation, registered_at. БЕЗ auth_pubkey.
get_current_key_record(owner_wallet) -> KeyRecordView   // удобный резолв «текущий ключ кошелька X»
get_global() -> GlobalView                      // sealed, bindings, counts, эндаумент-конфиг
```

**auth_pubkey НЕ в геттерах** (роадмап): action-ключ приватен; закрывает durability-blocker (seed-детерминирован → recovery из seed) + defence-in-depth против деанона. Реестр хранит его для проверки rotation-подписей, наружу не отдаёт.

## 5. Freeze / durable lifecycle (зеркало UsernameRegistry)

`init` unsealed → controller `BindController`/`BindConsumers` (unsealed) → `SealGenesis` (one-shot, требует bindings + basechain-guards) → post-seal `requireSealed()` на всех операциях. Durable: адрес = f(code, deployment_id) — фиксируется, переживает редеплой Shell (Vault/CapsuleHub). Successor-указатель — как у прочих Durable-Core (announce-only, out-of-band верификация).

## 6. Ротация / версионирование (Q5 — несущий инвариант) — СОГЛАСОВАНО с решением Vault

⚠️ РЕВИЗИЯ (2026-07-16, реализация): согласовано с УЖЕ-ПРИНЯТЫМ решением clean-16 Vault (комменты Vault.tact:1899-1906). Модель = **один живой record на аккаунт, DELETE-ON-ROTATE, net-zero storage** (НЕ retention-окно старых генераций):
- Ротация УДАЛЯЕТ старый record (`key_records.del(current_key_id)`) и пишет новый generation → ровно ОДИН live record/аккаунт → O(1), bounded, net-zero (это ТАКЖЕ решает funding value-less external: новых ячеек нет).
- До-ротационную историю читает КЛИЕНТ из seed-производного versioned-per-keyId контакт-стора (воркстрим 2), НЕ из on-chain старого record. Отправители ре-резолвят текущий ключ здесь.
- Триггер ре-INTRO при ротации у любой стороны — клиентский (иначе CONV тихо промахивается).
- **Client historical revoked_lt message-time чек НЕ реализован** (тот же остаток, что флагнул Vault) → на внешний аудит до seal; при необходимости добавить compact revocation-ledger (keyId→revoked_lt) там.
- Следствие: `PruneRevokedKeyRecord` и `RECORD_RETENTION` из первого среза УБРАНЫ (не нужны при delete-on-rotate).

## 7. Storage-экономика (#3/#7/#19 — sized at G8)

- KeyRecord ≈ 1184б ML-KEM + поля ≈ **~1.4КБ ≈ несколько ячеек** → рента значима. Эндаумент per-record на retention-горизонт @ 64962 nanoton/cell/год из измеренного `computeDataSize`.
- #3: revoked-накопление → `PruneRevokedKeyRecord` (TTL-del + hash-tombstone).
- #19: base code-rent синглтона → эндаумент в genesis + assert.
- reserve-флор: `nativeReserve` пол + инвариант `myBalance ≥ Σэндаументов + base-rent`, fail-closed на операциях.
- #4 dormant-эвикция (опц. пере-хостинг): ключи seed-детерминированы → эвикция спящих аккаунтов = 0 крипто-потерь (re-register из seed). Держим как опцию, решается на G8.

## 8. Что ДРОПАЕТСЯ из Vault (custody — KILLS #1-6)

ton_balance/ath_balance, DepositTon, WithdrawTon/Ath, VPB2 publish-оркестрация, ATH-плечо (ATHTransferRequest/Ack/Failed, vault_ath_wallet), receive-intents (Create/Claim/Cancel), receipt-ring, airdrop, pending-* мапы (username-mint/avatar/withdrawal), PruneStuckAthPending (#18 — moot без custody). Остаётся ТОЛЬКО identity/key-подсистема.

## 9. Точки реконсиляции + OPEN-решения

**Реконсиляция (до реализации свести):**
- **scan_pubkey ↔ recipient-privacy**: CONV/INTRO в CapsuleHub потребляют scan_pubkey; сейчас в контракте его НЕТ (только advertised клиентом по CLOSED_SPEC). KeyRegistry — канонический источник. Свести деривацию/info-строку `messaging.hybrid-v1.scan.x25519` (заморожена).
- **auth_pubkey seed-derive + RECOVERY**: auth_pubkey = seed-HKDF+version (роадмап RECOVERY-auth); versioned взаимодействует с Q5.
- **anon-publish coupling**: publish уходит из Vault в rebuilt-CapsuleHub (author_wallet выброшен). KeyRegistry не участвует в publish-пути — только identity-резолв для INTRO/verify. Развязка чистая.

**👤 OPEN (genesis-пины, вшиваются навсегда):**
1. `RECORD_RETENTION` (сколько держать revoked-record полным до prune) + tombstone-состав — sized at G8/economics.
2. Эндаумент-подход: per-record предоплата на фикс-горизонт vs refresh-top-up. Реком.: предоплата на retention + permissionless top-up (self-financing).
3. Auth-модель подтвердить: register=sender-auth / rotate=signature-auth (реком., зеркалит Vault).
4. scan_pubkey в keyId-хеше (реком. да: scan часть identity-generation).
5. #4 dormant-эвикция аккаунтов — включать или нет (0 крипто-потерь; решается на G8).

## 10. План tests-first (следующий шаг)

1. `KEYREG-LIFECYCLE`: init→bind→seal; операции до seal отвергнуты (requireSealed), controller-only гейты.
2. `KEYREG-REGISTER`: sender-auth first register; validateKeyProfile (enc/sign/scan≠0, PQ len/hash, suite=hybrid); auth_pubkey≠sign≠0; keyId детерминизм; двойная регистрация отвергнута.
3. `KEYREG-ROTATE`: external signature-auth; старый record→revoked но резолвим; новый generation; current_key_id сдвинут; неверная подпись/чужой auth отвергнуты; scan-ротация меняет keyId.
4. `KEYREG-RESOLVE`: get_key_record/get_account/get_current_key_record; auth_pubkey НЕ в выводе (privacy-инвариант тест).
5. `KEYREG-PRUNE`: revoked-TTL-del + tombstone; permissionless fail-closed; старая подпись верифицируется по tombstone-hash.
6. `KEYREG-ECON`: эндаумент/reserve-флор инвариант (провизорные пины, финал на G8).
```
