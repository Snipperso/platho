# CreditIssuer — дизайн (clean-16 Durable-Core, Vault-elimination B2)

Собрано 2026-07-16. Статус: **ДИЗАЙН, до tests-first.** Immutable → чекпойнт до кода.
Источники: доказанный крипто-гейт (`tests/blind-schnorr-checksig.test.ts`, commit 636d0399), master-roadmap воркстрим 4, решения этой сессии (анон-релей после скрейпера сына). KeyRegistry (B1) = соседний Durable-Core, тот же freeze-каркас.

## 1. Роль (узкая — намеренно)

CreditIssuer — **новый frozen Durable-Core**, две функции:
1. **Реестр issuer-ключей (8-16 слотов, заморожены на genesis):** публичные ed25519-ключи, под которыми проверяется issuer-подпись токена. CapsuleHub привязывается к нему (или читает). Клиент читает их, чтобы верифицировать полученные токены до траты.
2. **Сбор оплаты в пул:** «купить N кредитов» = одна on-chain оплата N×PRICE. Оплата видима (кошелёк в ростере — ПРИНЯТЫЙ остаток). Off-chain issuer-сервис видит оплату и слепо выдаёт N токенов над Tor.

**НЕ здесь** (это в CapsuleHub, точка ТРАТЫ): проверка issuer-подписи + spend-подписи + epoch-nullifier. **НЕ здесь**: сама слепая выдача (off-chain, интерактивный clause-blind над Tor; issuer-СЕКРЕТ никогда не on-chain). **НЕ здесь**: custody (нет балансов юзеров).

## 2. Модель токена (из доказанного гейта — контекст, реализуется в Hub)

- Токен = `(serial, issuer_sig)`. `serial` = 256-бит значение, коммитящее spend_pubkey: `serial = H(spend_pubkey ‖ epoch ‖ nonce)`.
- `issuer_sig` = clause-blind-Schnorr issuer'а над `serial` → расслеплённая = стандартный ed25519, принимаемый `checkSignature(serial, issuer_sig, issuer_pubkey[slot])`. Issuer НЕ видит serial (слепо) → выданные токены unlinkable к оплате.
- **Трата (в Hub):** предъявляются `serial, slot, issuer_sig, spend_pubkey, epoch, nonce, spend_sig(body_hash)`. Hub: (a) `serial == H(spend_pubkey‖epoch‖nonce)`; (b) `checkSignature(serial, issuer_sig, issuer_key[slot])` [токен настоящий]; (c) `checkSignature(body_hash, spend_sig, spend_pubkey)` [тратящий знает spend-секрет → анти-кража bearer]; (d) `nullifier(serial) ∉ epoch-set` [анти-double-spend]. Публикация как `sender()==relay`, без author_wallet.
- **Мульти-issuer (N слотов):** токен валиден, если подписан ЛЮБЫМ ОДНИМ из N issuer-ключей (censorship-resilience: упал/цензурит один — выдают другие). Тратящий указывает `slot`.

## 3. Модель данных (крошечная, bounded)

```
contract CreditIssuer {
    sealed: Bool;
    genesis_controller_address: Address;
    deployment_manifest_hash: uint256;
    genesis_config_hash: uint256;
    issuer_slot_count: uint8;                 // сколько слотов реально загружено (8..16)
    issuer_keys: map<Int, Int>;               // slot(uint8) -> issuer_pubkey(uint256), ФРОЗЕН на seal
    credit_price: uint128;                     // цена 1 кредита (nanoton), фрозен на seal (G8-провизорно)
    pool_collected: uint128;                   // всего собрано в пул (учёт)
    credits_sold: uint64;                      // всего продано кредитов (учёт)
}
```
**Покупки НЕ хранятся** (иначе unbounded storage-бомба): детали покупки едут в теле tx `BuyCredits` (payer=`sender()`, credits_k, redeem_pubkey) и читаются off-chain issuer'ом из истории транзакций. Состояние контракта = фиксированные issuer-ключи + счётчики → bounded, O(1).

## 4. Интерфейс сообщений + auth

| Сообщение | Тип | Auth | Действие |
|---|---|---|---|
| `UploadIssuerKey` | internal | controller-only, **unsealed** | загрузить issuer_pubkey в slot (как UploadArt в UsernameRegistry); валидировать ≠0, slot<16, не занят |
| `SetCreditPrice` | internal | controller-only, unsealed | задать credit_price до seal (G8-финал) |
| `SealGenesis` | internal | controller-only, one-shot | требует issuer_slot_count∈[8..16] + credit_price>0; замораживает ключи+цену |
| `BuyCredits` | internal | **permissionless** (sender-auth = плательщик) | value ≥ credits_k×credit_price (+газ); credits_k∈[1..MAX]; несёт redeem_pubkey; pool_collected+=value-reserve; credits_sold+=k. Покупка в теле tx (не в состоянии). |
| `DrainPoolToHub` | internal | controller/bound | перевести накопленный пул в CapsuleHub (фандинг publish-эндаументов) — **МЕХАНИКА ОТЛОЖЕНА на B3-coupling** |
| `TopUpStorageReserve` | internal | permissionless | долить base-rent |

**redeem_pubkey** в `BuyCredits`: фиксирует выдачу за конкретным плательщиком (анти-front-run — иначе любой, увидев tx, заявит N выдач над Tor). Off-chain issuer выдаёт N токенов только предъявителю подписи под redeem_pubkey из on-chain tx. Blinding по-прежнему разрывает связь ТОКЕНОВ с плательщиком.

## 5. Геттеры

```
get_issuer_key(slot) -> {exists, pubkey}          // для Hub/клиента
get_global() -> {sealed, controller, manifest, issuer_slot_count, credit_price, pool_collected, credits_sold, ...}
```
issuer-ключи публичны (это их назначение — верификация токенов). Ничего приватного здесь нет.

## 6. Freeze / durable lifecycle (зеркало KeyRegistry/UsernameRegistry)

init unsealed (controller) → controller `UploadIssuerKey`×N + `SetCreditPrice` (unsealed) → `SealGenesis` (one-shot; требует N∈[8..16] + price>0) → post-seal только `BuyCredits`/`TopUp`/`DrainPoolToHub`. Durable: адрес = f(code, deployment_id), переживает редеплой Shell.

## 7. Off-chain coupling (как оплата → выдача, без хранения)

1. Юзер on-chain: `BuyCredits{credits_k, redeem_pubkey}` value≥k×price. Кошелёк виден (ростер).
2. Юзер над Tor (анонимно) → issuer-сервис(ы): «выдай k токенов, вот подпись под redeem_pubkey из tx <ref>».
3. Issuer читает on-chain tx (payer, k, redeem_pubkey, value), верифицирует redeem-подпись, интерактивно clause-blind подписывает k слепых serial'ов (дедуп по tx-ref, ровно k). Issuer НЕ видит serial'ы (слепо).
4. Юзер расслепляет → k токенов `(serial, issuer_sig)`, unlinkable к его кошельку.
5. Позже: трата в Hub (§2), publish как relay, без author_wallet.

Доверие: issuer-сервис проектный; отказ выдать после оплаты = операционный/репутационный риск (не потеря сверх fee). N issuer'ов = резильентность к цензуре одного.

## 8. Экономика (PRICE — G8-провизорно)

credit_price должна покрывать будущую стоимость публикации: storage-эндаумент капсулы в Hub @64962 + газ релея + маржа пула. Точное число — G8 (после замера Hub publish DataSize). Пул→Hub фандинг-поток = B3-coupling. base-rent #19 контракта — эндаумент в genesis.

## 9. 👤 OPEN-решения (immutable)

1. **Число слотов N** (8..16) + стартовый состав issuer-ключей (генерятся на церемонии; кто держит секреты — как controller-multisig #9?). → влияет на censorship-resilience vs операционную сложность.
2. **issuer-ключи: в CreditIssuer + Hub-bind (реком.)** vs вшить в Hub-код. Реком.: держим здесь, Hub читает/bind (единый источник).
3. **Мульти-issuer семантика: any-1-of-N** (censorship-resilience). ✅ РЕШЕНО (owner 2026-07-16): компрометация issuer'а обрабатывается **controller-gated отзывом/заменой слота** (согласуется с governance-философией #9). Модель слота `IssuerSlot{pubkey, active, version}`: `UploadIssuerKey` (unsealed) заполняет; `ReplaceIssuerKey` (POST-seal, multisig-controller-only) ставит свежий ключ + version++ (токены старого ключа инвалидируются — принятая цена восстановления); `RevokeIssuerKey` (POST-seal) деактивирует. Hub при трате: `slot.active && checkSignature(serial, sig, slot.pubkey)`.
4. **redeem_pubkey** в BuyCredits (реком. да — анти-front-run) vs плательщик подписывает Tor-запрос кошельком.
5. **Покупки не хранить (реком.)** — читать из истории tx; состояние bounded.
6. **credit_price** + MAX_CREDITS_PER_BUY — G8.
7. **Пул→Hub поток** — механика DrainPoolToHub, отложена на B3 (Hub rebuild).
8. **Спам/anon-set:** цена кредита = единственный рычаг; выше цена → меньше покупок → меньше anon-set. Баланс — owner + §роадмап-остаток.

## 10. План tests-first

1. `CREDIT-LIFECYCLE`: init→upload keys→set price→seal; операции до seal reject; seal требует N∈[8..16]+price>0; controller-only гейты; one-shot.
2. `CREDIT-ISSUER-KEYS`: UploadIssuerKey валидирует (≠0, slot<16, не занят); get_issuer_key резолвит; после seal upload reject.
3. `CREDIT-BUY`: BuyCredits value≥k×price (недоплата reject), credits_k границы, pool/credits_sold учёт, покупка НЕ в состоянии (счётчики +, но нет per-purchase записи), redeem_pubkey≠0.
4. `CREDIT-RESOLVE`: get_global/get_issuer_key.
5. `CREDIT-ECON`: base-rent/reserve (провизорно, G8).
```
