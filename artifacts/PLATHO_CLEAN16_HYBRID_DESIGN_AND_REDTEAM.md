# Platho clean-16 ГИБРИД — дизайн-спец + red-team (проход wmw09rt6v)

> Статус: ДИЗАЙН НЕ ГОТОВ. crypto-deanon verdict=flawed (graph_broken=false); contract-safety verdict=sound-with-fixes (graph_broken=true). 2 блокера + majors. НЕ деплоить. 1 design-агент и 1 review-линза упали на схеме — покрытие частичное.

---

## ДИЗАЙН (архитектор)

# Platho clean-16 — ГИБРИДНАЯ приватность: единый дизайн-спец (архитектор)

Цель: скрыть ПОЛУЧАТЕЛЯ и разорвать детерминированный он-чейн граф «кто-кому» (именно его скрейпил скрипт), масштабируясь как старая индексная модель. Отправитель осознанно виден (принятый констрейнт). Деплой — immutable genesis (bump `deployment_id`, те же vanity-кошельки), поэтому все решения консервативны и снабжены гейтами внешнего аудита.

Ключевой архитектурный принцип этого пересмотра: **разделить PQ-приватность двух лейнов**. БЕСЕДА (основной объём) делается PQ-граф-приватной; ЗНАКОМСТВО остаётся классически-приватным по discovery, но с версионным хуком для будущего PQ-апгрейда БЕЗ редеплоя.

---

## 0. Два лейна доставки (суть гибрида)

| | БЕСЕДА (CONV) | ЗНАКОМСТВО (INTRO) |
|---|---|---|
| Когда | установившийся диалог, ~весь трафик | первый контакт от незнакомца, 1 раз на собеседника |
| Механизм чтения | O(1) выборка по непрозрачному бакет-ключу | bulk stealth-скан отдельного intro-пула |
| Ключ header0 | `bucketKey=HKDF(K_epoch‖dir‖epoch)` 32Б | `ephemeral_R` 32Б + `view_tag` u16 |
| PQ-граф-приватность | **ДА** (bucketKey = HKDF от гибридного K с ML-KEM) | **НЕТ по discovery** (view_tag классический X25519) — задокументированный гейт |
| Индекс в контракте | `private_bucket_index` (непрозрачный) | нет индекса, только пул + скан |
| Идентичность отправителя | в шифр-теле | в шифр-теле |

---

## 1. Точная раскладка header0 (развод по THIRD publish_kind)

Дискриминатор лейна — **отдельный `publish_kind`** (чище exact-bit пины, чем флаг в meta-байте). Вводим `CAPSULEHUB_ENTRY_KIND_INTRO=3` / `PUBLISH_KIND_INTRO=3` рядом с `PRIVATE=1`/`PUBLIC=2`. Оба header0 = 1 cell, 0 refs. `header1` (240 бит / 30Б) НЕ меняется в обоих лейнах. Магик остаётся `PH0C`, `PROTOCOL_VERSION=1`.

**Байт `@5` = publish_kind` — это одновременно discovery-lane-дискриминатор. Байт `@4` = version, байт `@7` = crypto_suite — версионный хук (см. §9, миграция discovery без редеплоя).**

### CONV header0 — 40 байт = 320 бит (publishKind=1)
```
[0:4]  magic 'PH0C'
[4]    version=1
[5]    publishKind=1 (PRIVATE/CONV)
[6]    sizeClass
[7]    cryptoSuite=2 (HYBRID)
[8:40] bucketKey (32Б, RAW HKDF-выход — НЕ base64)
```
Контракт: `skip 64` (meta), `load 256` = непрозрачный ключ бакет-индекса. **Выброшены** относительно текущего PH0C: `sender_key_id` (@8..40), `ephemeral_scan_pub` (@40..72), `view_tag` (@72..74) — идентичность ушла в шифр-тело, скан не нужен установившейся беседе.

### INTRO header0 — 42 байта = 336 бит (publishKind=3)
```
[0:8]  meta (та же раскладка, publishKind=3)
[8:40] ephemeral_R (32Б, R=r·G)
[40:42] view_tag (u16 BE)
```
Контракт: `skip 64`, `load 256` = R, `load 16` = view_tag. `sender_key_id` выброшен и здесь (личность внутри intro-тела).

### Пины
- Раздвоить `CAPSULEHUB_PRIVATE_HEADER0_BITS`(592) → `_CONV=320` / `_INTRO=336`; `_CELLS=1`, `_REFS=0` для обоих. Зеркалить в `Vault.tact:78-81`.
- `part.bits()==784` и refs 3/4 **НЕ меняются** (header0 идёт ref-ом; 784 = sizeClass8+suite8+h0hash256+h1hash256+bodyhash256). Меняется только `expectedBits` в `requireExactPayloadCell(header0,...)` per-kind (exit 13513/13514).
- Перепин gate G2 на ТРИ значения корня/шейпа.

---

## 2. БЕСЕДА — pairwise направленные бакеты + epoch

### Бакет-ключ
`bucketKey = HKDF-SHA256(ikm=K_epoch, salt='PLATHO.CONV.BUCKET.SALT.V1', info='PLATHO.CONV.BUCKET.V1' ‖ dir_byte ‖ epoch_u32_BE)[:32]`.

### Направленность — КАНОНИЧНА и ОБЯЗАТЕЛЬНА
Направление задаётся лексикографическим порядком 32Б `keyId` сторон (НЕ ролью в конкретном сообщении):
- `lo = min(keyId_A, keyId_B)`, `hi = max(...)`.
- `dir_byte = 0x00` для `lo→hi`, `0x01` для `hi→lo`.
- Отправитель кладёт СВОЙ исходящий бакет: `dir = (я==lo? 0x00 : 0x01)`.
- Получатель читает ВСТРЕЧНЫЙ: если я==lo, входящий = `hi→lo` = dir `0x01`.

**Почему несвязываемо (против скрейпера индекса):** в каждом направленном бакете ровно ОДИН видимый публикатор. Общий bidirectional-бакет с двумя видимыми публикаторами выдал бы пару A↔B — направленность это исключает. `bucketKey` = HKDF от секретного гибридного K → для чужого это равномерно-случайные 32Б без связи с идентичностями и без вычислимости (в т.ч. квантово — K содержит ML-KEM ss, см. §5).

### DEFENSE-IN-DEPTH: один-публикатор-на-бакет ЭНФОРСИТСЯ КОНТРАКТОМ
(Устраняет major «вся направленность держится только на клиенте».) Запись `PrivateCapsuleKeyIndex` расширяется полем `first_publisher: Address`. При первом push в бакет контракт запоминает кошелёк публикатора; последующие push от ДРУГОГО кошелька в тот же `bucketKey` — **reject-with-refund** (новый код `RJ_BUCKET_PUBLISHER`). Это контрактно гарантирует «один видимый публикатор на бакет» даже при багнутом/злонамеренном клиенте, т.е. самый разрушительный сценарий (двунаправленная коллизия → утечка пары) невозможен on-chain. Утечки нет: публикатор виден и так (sender visible), а `bucketKey` непрозрачен (нужен K, чтобы его знать).

### epoch и окно проверки
- `epoch = floor(createdAtSec / 86400)` как u32 (UTC-сутки), берётся из `header1.createdAt`. **Длина эпохи 86400 запечена в клиентском suite; ОКНО проверки W — клиентское, тюнится пост-genesis свободно.**
- Приём: `epoch_now = floor(now/86400)`; проверять `[epoch_now-W .. epoch_now]`, baseline `W=2` (3 бакета на направление) — покрывает clock-skew 5мин + межсуточную задержку + краткий офлайн. W помечен open-tunable (сверить с P99 доставки toncenter; узко → потеря поздних сообщений, широко → больше геттер-вызовов).
- На каждый epoch: свой `K_epoch` из окна ратчета → `deriveConversationBucketKey` → `get_private_bucket_index(bucketKey)` → exists/miss O(1) → backward-walk цепочки бакета (`bucket_prev_link`).
- Свой outbox отправитель читает тем же геттером по СОБСТВЕННЫМ исходящим `bucketKey` (он единственный публикатор) → **отдельный `sender_index` не нужен, убирается** (см. cleanup).

### RPC-приватность запроса (устранение major «RPC видит граф»)
Точечный `get_private_bucket_index(key)` иначе выдал бы toncenter пару {IP клиента → его входящие бакеты}, а публикатор пишет в те же ключи открыто. Меры (все ДО genesis, т.к. форма геттера вшита):
1. **Batch-геттер `get_private_bucket_index_batch(keys[≤K])`** — клиент за один запрос тянет ВСЕ входящие бакеты по всем активным собеседникам и по всему окну эпох, перемешивая их с несколькими decoy-ключами, чтобы одиночный контакт не изолировался.
2. **Ротация RPC**: чтение распределяется по нескольким независимым toncenter-эндпойнтам + keyless fallback, разные от того, что наблюдает публикацию.
3. **Явно задокументировать RPC-провайдера как party, способную видеть граф при collusion с чейн-анализом.** Против заявленной угрозы (сын-скрейпер, не оператор RPC) это уже за границей модели; мера снижает деанон-множество до «мажоритарный сговор RPC + чейн-анализ».

---

## 3. ЗНАКОМСТВО — отдельный intro-пул, stealth-скан, bulk-геттеры

Использует ГОТОВЫЙ примитив (`deriveStealthViewTag/ForRecipient/computePrivateScanViewTag`, `platho-crypto.mjs:214-248`) — БЕЗ изменений, но применяется ТОЛЬКО к intro-пулу.

### Отправитель A
`r=randomBytes(32)`, `R=r·G`. `e=X25519(r, S_B_scan)`. `view_tag=HKDF-SHA256(ikm=e, salt='PLATHO.STEALTH.VIEWTAG.SALT.V1', info='PLATHO.STEALTH.VIEWTAG.V1'‖R)[:2]` BE u16. header0 INTRO: `R@8..40`, `view_tag@40..42`, `publishKind=3`. Тело — обычный гибрид-конверт (`encryptCompactPayloadBytes`) к enc+ml-kem бандлу B (та же `r` сеет body-эфемеру E=R — один keygen для discovery и body-KEM). Плейнтекст тела: identity section (68Б: `A.sign_pubkey / profile_version / avatar_hash`) + **полный крипто-бандл A** (`keyId_A`, `A.enc_x25519_pub`, чтобы B не делал лишний Vault-round-trip для деривации K) + опц. первое сообщение + **anti-replay nonce** (см. §6).

### Получатель B (скан-модель)
Bulk: `get_intro_scan_bounds() → {oldest_live_id, latest_id}` + `get_intro_scan_page(from, count≤64) → {from_entry_id, next_entry_id, returned, oldest_live_id, latest_id, records: map<u16, IntroScanRecord{entry_id, created_at, view_tag, ephemeral_R}>}`. На каждую запись: `e'=X25519(s_B_scan, R)`; `tag'=HKDF(e', info‖R)[:2]`; `tag'==view_tag` → кандидат (ложноположит. ~1/65536, полный decrypt только на совпадении). Кандидат: fetch полной intro-энтри → decrypt тела enc+ml-kem секретами B → парс identity → **verify подписи ПОСЛЕ decrypt** → привязка к Vault KeyRecord A → детерминированная деривация `K_root` (§5) → запись беседы в локальный стор + anti-replay-дедуп по nonce. Дальше — CONV-лейн, скан для этого собеседника больше не нужен.

### Эвикция intro-пула (устранение major «intro низкообъёмный → слабая граница»)
`intro_entries: map<u64, IntroCapsuleEntry{publish_id, created_at, body_hash, header_0, header_1}>` + параллельный триплет `intro_latest_id / intro_oldest_live_id / intro_live_count`. `evictExpiredIntro` — scan-only (БЕЗ index-un-push), строгий FIFO по entry_id (удаляем только TAIL). **КЛЮЧЕВОЕ: `evictExpiredIntro` запускается на ЛЮБОМ publish (private/public/intro батчи все подметают хвост intro-пула)**, а не только на intro-publish. Иначе редкие intro-publish не выталкивали бы протухшие записи, и live-окно скана росло бы сверх 1-года retention. Так граница intro-пула держится за счёт высокообъёмного conv/public-трафика. `HUB_PART_GAS_*` каждого kind фондирует доп. intro-sweep.

`get_private_scan_*` поверх общего `private_entries` **УДАЛЯЮТСЯ** (беседа теперь через бакет-геттер, скан не масштабируется по всему потоку бесед).

---

## 4. Клиентская крипта — деривация из сида

### 4.1. Детерминированный scan-ключ (устранение подтверждённого бага, ПРЕДУСЛОВИЕ корректности intro)
`platho-wallet.mjs:340` сейчас: `createMessagingIdentity({ encryptionKeyPair, signingSecretKey })` БЕЗ `scanSecretKey` → внутри `randomBytes(32)` → после переустановки `S=s·G` невосстановим, клиент НЕ примет ни одного intro. Фикс: `scanSecretKey = hkdfBytes(wallet.seed, 'messaging.hybrid-v1.scan.x25519', 32)` (salt `'PLATHO.WALLET.SEED.V1'`, SHA-256, как остальные messaging-ключи), прокинуть в `createMessagingIdentity({..., scanSecretKey})`. Детерминированно → S ре-деривируется из сида на любом устройстве.

### 4.2. Ключи из сида (все через `hkdfBytes(seed, info, len)`, salt `'PLATHO.WALLET.SEED.V1'`)
`messaging.hybrid-v1.x25519`(32) enc, `.ed25519`(32) sign, `.ml-kem768`(64→keygen) KEM, **новый** `.scan.x25519`(32) scan.

---

## 5. Хендшейк установления K — ДЕТЕРМИНИРОВАННЫЙ гибридный K_root

Пересмотр относительно исходного дизайна: **K_root выводится ДЕТЕРМИНИРОВАННО из статиков обеих сторон, БЕЗ эфемерного вклада.** Это одновременно закрывает три находки: (major) невосстановимость K_root на реинсталле/втором устройстве; (major) иллюзорность FS через архив публичного intro; и делает CONV-лейн PQ-граф-приватным.

### Почему PQ-обязательно ML-KEM в K_root
Если бы K_root был только X25519-static-static, квантовый противник (Shor) восстановил бы K_root из публичных enc-ключей → все `bucketKey=HKDF(K_epoch)` → ретроактивный граф БЕСЕД. Чтобы CONV-лейн (основной объём) был PQ-граф-приватным, K_root ОБЯЗАН включать PQ-секрет.

### Деривация (симметрична, обе стороны получают байт-идентичный K_root)
`K_root = HKDF-SHA256( ikm = DH_ss ‖ mlkem_ss_det, salt='PLATHO.CONV.ROOT.SALT.V1', info='PLATHO.CONV.ROOT.V1' ‖ min(keyId_A,keyId_B) ‖ max(keyId_A,keyId_B) )[:32]`, где:
- `DH_ss = X25519(enc_self_sec, enc_peer_pub)` — статик-статик (взаимная аутентификация; симметричен по построению X25519).
- `mlkem_ss_det` — ML-KEM-768 shared secret с **ДЕРАНДОМИЗИРОВАННОЙ инкапсуляцией** к KEM-ключу лексикографически-МЛАДШЕЙ стороны (`lo`), с coin `= HKDF(DH_ss ‖ sorted(keyId) ‖ 'PLATHO.CONV.KEM.COIN.V1', 32)`. Обе стороны получают одинаковый `mlkem_ss_det`: `hi` инкапсулирует к `lo.kem_pub` детерминированным coin; `lo` либо ре-инкапсулирует к своему же pub тем же coin, либо декапсулирует — результат тот же ss. Восстановление на любом устройстве: обе стороны пересчитывают из сида + публичного бандла пира (Vault) **БЕЗ хранения какого-либо шифртекста и без зависимости от живости intro**.

### Recovery — РЕШЕНО (устранение major)
K_root детерминирован из сид-производных статиков + `keyId` пира → любое устройство с сидом пере-деривирует K_root для любого известного контакта. Список контактов (их `keyId`) синкается через существующий **self-encrypted PREFS-капсула паттерн** (как subscription-sync, latest-wins) — это НЕ секрет K, а лишь перечень собеседников; при потере списка возможен best-effort re-scan живого intro-хвоста. Конверсация НИКОГДА не становится нечитаемой навсегда из-за эвикции intro.

### Домен-сепарация (аудит-критично)
`mlkem_ss_det` для K_root и ML-KEM ss для BODY-шифра — это ДВЕ РАЗНЫЕ инкапсуляции с разными coin/domain/info; они НЕ переиспользуются. Body-ключ: `HKDF(salt=sha256('PLATHO.MESSAGE.SALT.V1'‖transcriptHash), info='PLATHO.MESSAGE.KEY.V1'‖transcriptHash)`, `AAD='PLATHO.COMPACT_BODY.AAD.V1'‖bodyPrefix‖header0Hash‖header1Hash`. Разные salt/info изолируют K_root от body-ключа → нет verifiable cross-relation (пункт внешнего аудита).

---

## 6. Верификация подписи ПОСЛЕ decrypt + полный транскрипт (устранение minor UKS/misbinding + replay)

Строгий порядок (header0 — атакер-контролируемые байты, до decrypt не доверять):
1. INTRO: match view_tag / CONV: локализация бакета.
2. AES-256-GCM decrypt тела (AAD связывает целостность header0/header1).
3. Парс identity section → `sign_pubkey`.
4. **Verify ed25519-подписи над ПОЛНЫМ транскриптом первого контакта:** `(keyId_A, keyId_B, R, sha256(KEM_ct), view_tag)` — не только `R+view_tag` (иначе UKS/misbinding). CONV: подпись покрывает `(bucketKey, epoch, keyId_sender)`.
5. Привязка `sign_pubkey`/enc `keyId` к живому Vault KeyRecord (аутентификация автора → кошелёк).
6. Только тогда accept K / рендер.
- **Anti-replay:** nonce в intro-теле + клиентский дедуп по nonce (повторную/ретранслированную intro от того же A B игнорирует, K_root не путается — он и так детерминирован).

---

## 7. Форвард-секретность — epoch-хеш-ратчет (честная узкая гарантия)

`K_epoch = HKDF(K_root_chain, salt='PLATHO.CONV.RATCHET.SALT.V1', info='PLATHO.CONV.RATCHET.V1'‖epoch_u32_BE)[:32]`; корень продвигается однонаправленно `K_root_{n+1}=HKDF(K_root_n, ...‖epoch)` с УДАЛЕНИЕМ `K_root_n`. Клиент держит: текущий корень + скользящее окно N=3 эпох-ключей; старше — удаляет. Размер состояния на беседу O(N)=константа.

**ЧЕСТНАЯ модель угроз (устранение major «FS иллюзорна»):** т.к. K_root ДЕТЕРМИНИРОВАН из сида, компрометация СИДА ретроактивно вскрывает всю историю независимо от ратчета (сид = game over). Ратчет даёт FS ТОЛЬКО в узком сценарии: утёк локальный стор эпох-ключей, а сид цел → прошлые эпохи защищены one-way хешем. Это дешёвый defense-in-depth, но НЕ заявляем «FS через сутки» как сильную гарантию. Double-ratchet ОТЛОЖЕН: (а) требует ratchet-pubkey на сообщение, (б) skipped-keys-стор ломается FIFO-эвикцией пула (дыра в цепочке), (в) большая аудит-поверхность перед immutable; PCS-выгода слаба (детерминированные статики). Версионный хук (suite/version байт) оставляет апгрейд на будущее без редеплоя.

---

## 8. Границы состояния

ОН-ЧЕЙН: беседа-пул (`private_entries`+`private_bucket_index`) и intro-пул (`intro_entries`) FIFO-эвиктятся независимо (параллельные триплеты latest/oldest_live/live_count), стоп на первом не-протухшем, retention 1 год, строгий FIFO по entry_id, эвикция свёрнута в publish-путь; intro-хвост подметается на ЛЮБОМ publish. КЛИЕНТ: на контакт — только корень ратчета + окно N=3 эпох-ключей (старше удаляется) → O(1) на беседу, стор = O(число собеседников). Intro-скан — курсорный пейджинг (from/next, count≤64), без накопления. Окно эпох на приёме ≤ W+1 бакет-геттеров на направление.

---

## 9. Версионный хук discovery (смягчение квантового блокера БЕЗ редеплоя)

Контракт трактует INTRO discovery-поля (`R@8..40`, `view_tag@40..42`) НЕПРОЗРАЧНО. Байты `version@4` / `crypto_suite@7` в header0 позволяют БУДУЩЕМУ клиентскому suite переинтерпретировать эти 34 байта под PQ-стойкую сканируемую метку (если появится практичная конструкция) БЕЗ нового immutable-редеплоя. Т.о. immutable контракт НЕ запечатывает классическое допущение discovery — только текущий клиентский suite v1, и он версионирован.


## Изменения контракта
1. ВЕРНУТЬ private_recipient_index как НЕПРОЗРАЧНЫЙ private_bucket_index: map<uint256 bucketKey → PrivateCapsuleKeyIndex{latest_entry_link:uint64, entry_count:uint64, first_publisher:Address}>. Ключ = client-supplied 32Б из CONV header0@8..40, трактуется непрозрачно (как раньше sender-индекс). Восстановить push/prune/del-at-zero + get_private_bucket_index(keyId)->view (exists=false при промахе, дешёвый для окна эпох).
2. НОВОЕ поле first_publisher в бакет-индексе + проверка: первый push фиксирует кошелёк публикатора, push от ДРУГОГО кошелька в тот же bucketKey = reject-with-refund (новый код RJ_BUCKET_PUBLISHER). Контрактно энфорсит «один видимый публикатор на бакет» = двунаправленная коллизия невозможна on-chain (defense-in-depth к клиентской направленности).
3. ВЕРНУТЬ второй линк в PrivateCapsuleEntry как bucket_prev_link:uint64 (backward-walk внутри бакета), привязанный к бакет-индексу, НЕ к recipient_key_id-семантике.
4. ЗАВЕСТИ отдельный intro-пул: intro_entries map<uint64,IntroCapsuleEntry{publish_id,created_at,body_hash,header_0,header_1}> + триплет intro_latest_id/intro_oldest_live_id/intro_live_count + evictExpiredIntro (scan-only, БЕЗ index-un-push). КРИТИЧНО: evictExpiredIntro вызывается на ЛЮБОМ publish-kind (private/public батчи тоже подметают intro-хвост), иначе низкообъёмное знакомство не выталкивает протухшие записи.
5. BULK скан-геттеры на intro_entries: get_intro_scan_bounds()->{oldest_live_id,latest_id}; get_intro_scan_page(from,count clamp<=64)->{from_entry_id,next_entry_id,returned,oldest_live_id,latest_id,records:map<uint16,IntroScanRecord{entry_id,created_at,view_tag,ephemeral_R}>}. Переименовать PrivateScanRecord/PageView/BoundsView → Intro*. УДАЛИТЬ get_private_scan_* поверх private_entries.
6. BATCH-геттер бакет-индекса get_private_bucket_index_batch(keys[<=K])->map — клиент тянет все входящие бакеты по всем контактам/эпохам + decoy-ключи в одном запросе (RPC-приватность запроса; K подобрать под газ read-геттера/размер ответа).
7. Ввести CAPSULEHUB_ENTRY_KIND_INTRO=3 (Hub) / PUBLISH_KIND_INTRO=3 (Vault) + третью ветку в receive PublishBatchToHub и external PublishBatchFromVaultBalance. CONV-ветка: header0 exact 320 бит, push бакет-индекса. INTRO-ветка: header0 exact 336 бит, БЕЗ index-push, store в intro_entries. PUBLIC — без изменений.
8. Раздвоить header0 exact-bit пины: CAPSULEHUB_PRIVATE_HEADER0_BITS(592)→_CONV=320/_INTRO=336, _CELLS=1,_REFS=0 оба; зеркало в Vault.tact:78-81 (isExactCapsuleCell/isPrivateCapsuleShapeValid под ОБА приватных лейна); перепин gate G2 на три значения. part.bits()==784 и refs 3/4 НЕ трогать.
9. Раздвоить газ/сторидж по ТРЁМ kind: HUB_PART_GAS_PRIVATE(CONV: 1 бакет-push+эвикт-1 un-push) / новый HUB_PART_GAS_INTRO(0 push, только store+эвикт-del) / PUBLIC. Раздвоить storage-endowment: CONV несёт index-слот (оставить CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT), INTRO без индекс-слота → отдельный меньший CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT + свой STORAGE_RESERVE_INTRO в Vault. batchStorageReserveWithBuffer/indexStorageReserve/batchHubPartGas учесть третий kind + intro_live_count. Прогнать G8-worst-case для всех трёх kind (иначе недофинанс intro-эндаумента = медленный дренаж резерва Hub на immutable).
10. author_wallet: ОТКЛОНИТЬ смену на Address? (ломает единый пин HUB_BATCH_MSG_ROOT_BITS=924 и делает корень kind-зависимым необратимо). ОСТАВИТЬ FIXED-width Address для ВСЕХ kind; для private/intro Hub его ИГНОРИРУЕТ, клиент шлёт sentinel (собственный Vault-адрес — виден как публикатор и так, нового leak нет). Пин 924 и hubMsgBits/gate G2 не трогать.
11. Vault KeyRecord scan_pubkey:uint256 ОСТАЁТСЯ (нужен intro); layout-долг УЖЕ ЗАКРЫТ в дереве (action-payload 1056 бит, throwUnless 16117 scan_pubkey!=0) — исходный пункт дизайна снять как ложно-открытый.

## Изменения клиента
1. ФИКС-ПРЕДУСЛОВИЕ (platho-wallet.mjs:340): добавить scanSecretKey=hkdfBytes(wallet.seed,'messaging.hybrid-v1.scan.x25519',32) и прокинуть в createMessagingIdentity({encryptionKeyPair,signingSecretKey,scanSecretKey}). Детерминированный scan из сида — иначе intro невосстановим после переустановки.
2. Новая deriveConversationRootKey: K_root=HKDF(X25519(enc_self,enc_peer) ‖ mlkem_ss_det, salt='PLATHO.CONV.ROOT.SALT.V1', info='PLATHO.CONV.ROOT.V1'‖min(keyId)‖max(keyId))[:32]. ДЕТЕРМИНИРОВАННЫЙ (без эфемеры): mlkem_ss_det через дерандомизированную ML-KEM-768 инкапсуляцию к KEM-ключу lo-стороны, coin=HKDF(DH_ss‖sorted(keyId)‖'PLATHO.CONV.KEM.COIN.V1',32). Восстанавливается на любом устройстве из сида + Vault-бандла пира.
3. Новая deriveConversationEpochKey (ратчет) + deriveConversationBucketKey(K_epoch,dir,epoch): bucketKey=HKDF(K_epoch,salt='PLATHO.CONV.BUCKET.SALT.V1',info='PLATHO.CONV.BUCKET.V1'‖dir_byte‖epoch_u32_BE)[:32]. dir канонично по лексикографике keyId (lo→hi=0x00). epoch=floor(createdAtSec/86400) u32.
4. Развести privateCapsuleHeader0Bytes на convHeader0Bytes(40Б: meta+bucketKey) и introHeader0Bytes(42Б: meta+R+view_tag); parser и подпись переразвести по лейну. Убрать senderKeyId/ephemeralScanPub/viewTag из CONV header0; убрать senderKeyId из INTRO header0.
5. buildEncryptedPrivateCapsule: развести INTRO-lane (stealth R+view_tag, текущий примитив) и CONV-lane (bucketKey, БЕЗ свежей эфемеры/keygen на каждое сообщение). Установившаяся беседа НЕ минтит intro-эфемеру.
6. Подпись капсулы (privateCapsuleSignaturePayload): CONV подписывает (bucketKey,epoch,keyId_sender); INTRO — ПОЛНЫЙ транскрипт (keyId_A,keyId_B,R,sha256(KEM_ct),view_tag). Verify строго ПОСЛЕ decrypt + привязка к Vault KeyRecord.
7. Intro-тело: класть полный крипто-бандл A (keyId+enc_pub, чтобы B избежал Vault round-trip для K_root) + anti-replay nonce; клиентский дедуп intro по nonce.
8. Приём CONV: считать epoch_now, проверять окно [epoch_now-W..epoch_now] (W=2 baseline, tunable), собирать все входящие bucketKey по всем контактам+decoy и звать get_private_bucket_index_batch; читать outbox через собственные исходящие bucketKey.
9. Синк списка контактов (keyId собеседников) через self-encrypted PREFS-капсулу (паттерн subscription-sync) для восстановления бесед на новом устройстве; best-effort re-scan intro-хвоста как fallback.
10. Ротация read-RPC по нескольким независимым toncenter + keyless fallback для CONV bucket-запросов; клиентский send-jitter (рандом-задержка публикации) как best-effort против тайминг-корреляции.
11. publish-строитель (pwa-contract-transactions.mjs ~1197-1206): не слать author_wallet-семантику для private/intro (слать sentinel=свой Vault-адрес, поле игнорируется Hub); ветка по третьему publish_kind=3 для intro.

## Чистка (cleanup)
1. УБРАТЬ private_sender_index + sender_prev_link + pushPrivateSenderIndex/prunePrivateSenderIndex + get_private_sender_index: отправитель читает outbox через собственные исходящие bucketKey(A→B,epoch) (он единственный публикатор). Освобождает второй линк в PrivateCapsuleEntry под bucket_prev_link — минус одна он-чейн запись/индекс на сообщение.
2. Вычистить остатки PH0C-заголовка для CONV: recipient_key_id уже удалён; дополнительно выкинуть sender_key_id (ушёл в шифр-тело), ephemeral_scan_pub и view_tag (не нужны установившейся беседе). privateHeaderSenderKeyId/EphemeralScanPub/ViewTag переразвести: bucket-экстрактор для CONV; view_tag+ephemeral_R экстракторы ТОЛЬКО для INTRO.
3. author_wallet для private/intro — оставить как FIXED Address, но Hub игнорирует (НЕ делать Address?/дроп — это ломает пин 924). Клиент перестаёт нести осмысленный author_wallet для приватных kind (шлёт sentinel).
4. sender-recovery outbox-копия (encryptSenderRecoverySection/decryptSenderRecoveryPayloadKey, platho-crypto.mjs:1467-1493) становится избыточной: outbox находится через собственные исходящие bucketKey. Предложено убрать целиком (минус одна секция в теле/запись).
5. buildEncryptedPrivateCapsule перестаёт минтить свежую эфемеру+view_tag на КАЖДОЕ приватное сообщение (сейчас stealth всегда) — только для intro-капсулы первого контакта.
6. Перекалибровать/переименовать HUB_PART_GAS_PRIVATE (коммент про 2 index pushes уже неверен) под CONV=1 бакет-push; ввести HUB_PART_GAS_INTRO=0-push; зеркалить в Vault по трём kind.
7. Снять устаревший пункт про scan_pubkey 800→1056 бит layout-долг — уже закрыт в дереве (Vault.tact:1787 требует 1056, throwUnless 16117).

## Остаточные утечки (residual)
1. ТАЙМИНГ-ГРАФ диалога (главный остаток): отправитель ВИДЕН, ответ N публикуется через секунды после сообщения N+1 → два направленных бакета тикают в лок-степе весь epoch; пассивный чейн-аналитик по co-occurrence/latency связывает bucket X↔bucket Y ⇒ wallet A↔B, повторно каждую эпоху. Направленность/stealth НЕ закрывают. Для живой переписки восстанавливает БОЛЬШИНСТВО активных пар. Заявление «несвязываемо» верно ТОЛЬКО против скрейпера индекса (заявленная угроза — сын со скриптом), НЕ против сетевого/чейн-тайминг-аналитика. Смягчение (client send-jitter/батч-окна) частично; полное закрытие требует mix/задержек ВНЕ контрактной схемы.
2. КВАНТОВЫЙ РЕТРО-ГРАФ ЗНАКОМСТВ: view_tag = HKDF(X25519(r,S_scan),R)[:2] — чисто классический, а S_scan лежит открыто в Vault. Квантовый противник (Shor) восстанавливает s_scan, для каждой заархивированной intro-записи считает e'=r·s_scan, матчит view_tag → ретроактивно деанонимизирует ПОЛУЧАТЕЛЯ каждого первого контакта (publisher=A виден → полное ребро A→B). Harvest-now-deanon-later. Компактной сканируемой PQ-метки под no-backend/дешёвый-скан НЕ существует. ЛОКАЛИЗАЦИЯ: утечка ограничена ребром ПЕРВОГО КОНТАКТА; CONV-лейн (основной объём) PQ-граф-приватен (bucketKey=HKDF от K с ML-KEM). Версионный хук (version/suite байт, поля контракт трактует непрозрачно) позволяет добавить PQ-discovery в будущем клиентском suite БЕЗ редеплоя. Требует явного owner-гейта до ceremony.
3. ПСЕВДОНИМНОСТЬ БЕСЕД ЧАСТИЧНА: получатель скрыт, но кошелёк отправителя виден на каждом исходящем бакете → кластеризация бакетов по публикатору выдаёт out-degree A (число разных собеседников), суточный объём на беседу и расписание активности. Топливо для поведенческой ре-идентификации/пересечения по эпохам. Смягчение только padding/cover-traffic (стоит газ, вне baseline).
4. ФОРВАРД-СЕКРЕТНОСТЬ УЗКАЯ: K_root детерминирован из сида → компрометация СИДА ретроактивно вскрывает всю историю независимо от ратчета. Epoch-ратчет защищает ТОЛЬКО сценарий «утёк локальный стор эпох-ключей, сид цел». НЕТ PCS. Это осознанный trade-off recoverability↔FS (детерминированность нужна для восстановления бесед на immutable-контракте).
5. RPC-ПРИВАТНОСТЬ ЗАПРОСА CONV: точечное чтение бакета выдаёт RPC пару {IP→входящие бакеты}; при collusion RPC с чейн-анализом публикаторов граф восстановим на стороне RPC. Смягчено batch-геттером+decoy+ротацией RPC, но не устранено. Задокументировать toncenter как party, видящую граф при сговоре. Intro-скан этого не имеет (bulk-пейджинг общий для всех).
6. ФАКТ intro-публикации: наблюдатель видит, что A положил что-то в intro-пул (новый контакт с кем-то) и объём intro-активности A — метаданные (но НЕ к кому).
7. ГЕЙТ ВСЕЙ ПРИВАТНОСТИ: разрыв графа держится на ANO-CCA/key-privacy гибрида ML-KEM. Если KEM-шифртекст/уровень выдаёт recipient enc-ключ, направленность бакетов не спасает — обязателен внешний крипто-аудит key-privacy до genesis.
8. ЗАДЕРЖКА ПЕРВОГО КОНТАКТА: intro читается только через периодический bulk-скан хвоста intro-пула → первое сообщение доходит с лагом скан-цикла (не мгновенно, как CONV O(1)). Принятая деградация.

## Гейты аудита
1. G2 (переразвести на ТРИ значения): exact-bit пины корня и header0-шейпа для PUBLIC/PRIVATE(CONV=320)/INTRO(336) — ре-пин из ABI генератором, зеркало Hub↔Vault, gate assert на все три; HUB_BATCH_MSG_ROOT_BITS=924 держать пином по публичному худшему случаю (author_wallet fixed Address).
2. G8-подобная газ-калибровка worst-case для ВСЕХ трёх kind: HUB_PART_GAS_PRIVATE(CONV)/HUB_PART_GAS_INTRO/PUBLIC + storage-endowment intro без индекс-слота + STORAGE_RESERVE_INTRO; conformance-тест на тройной набор пинов (иначе недофинанс intro-эндаумента = дренаж резерва Hub на immutable).
3. ВНЕШНИЙ крипто-аудит key-privacy/ANO-CCA гибрида ML-KEM — ОБЯЗАТЕЛЬНЫЙ пункт перед ceremony (гейт всей приватности).
4. Аудит домен-сепарации: mlkem_ss_det (K_root) vs ML-KEM ss (body) — разные coin/salt/info, отсутствие verifiable cross-relation; корректность дерандомизированной инкапсуляции (обе стороны получают идентичный ss).
5. Owner-гейт + документирование: квантовый ретро-деанон ЗНАКОМСТВ принят как явный residual; подтвердить, что цель «разорвать кто-кому» достигается против скрейпера индекса, не против тайминг/квантового противника.
6. Conformance-тесты направленной деривации bucketKey (лексикографический dir по keyId, epoch_u32_BE) — заморозить как аудит-критичный инвариант; тест на контрактный RJ_BUCKET_PUBLISHER (второй публикатор в бакет отвергается).
7. Тест верификации: подпись покрывает полный транскрипт (UKS/misbinding), verify строго ПОСЛЕ decrypt, anti-replay дедуп intro по nonce.
8. Регресс funds/state: ReceiveIntent, балансы, receipt-ring, canonicalTotal/reject-with-refund/mode-128 ACK не затронуты редизайном header/индексов; отдельный тест-прогон.
9. Тест интеграции эвикции: evictExpiredIntro запускается на private/public/intro publish; строгий FIFO (только TAIL, backward-walk без дыр) для обоих пулов.

## Миграция / версионные хуки
"Форвард-миграция, immutable genesis = bump deployment_id (форк ATHMaster каскадом на все контракты, ТЕ ЖЕ vanity-кошельки, не просить свежие). БАЗА = текущее дерево на ЕДИНОМ 592-бит PH0C (CapsuleHub.tact:35, Vault.tact:78) — этот пересмотр НАКЛАДЫВАЕТСЯ поверх незавершённого первого stealth-редизайна; критично НЕ смешать пины: переход на CONV(320)/INTRO(336) — это НОВЫЙ форк header0-пинов с зеркалом Hub↔Vault, а не правка 592. Клиенты клин-16 режут cleartext PH0C на два лейна одновременно с деплоем. Старый clean-15 остаётся живым для ЧТЕНИЯ истории (его сообщения раскрыты по старой модели — принятая необратимая деградация, новые ключи/бакеты их не защищают). Восстановление бесед на новом устройстве: детерминированный K_root из сида + синк списка keyId через PREFS-капсулу (не требует живости intro). Долг scan_pubkey layout УЖЕ закрыт в дереве — не переделывать. Порядок работ: (1) фикс детерминированного scan-ключа (предусловие intro); (2) вернуть bucket-индекс+bucket_prev_link+first_publisher; (3) завести intro-пул+эвикт-на-любом-publish+bulk-геттеры, удалить старые private_scan; (4) развод header0 CONV/INTRO + третий publish_kind + пины/gate G2; (5) убрать sender_index/sender-recovery; (6) клиентская крипта K_root/ратчет/bucketKey/подпись; (7) газ/сторидж калибровка трёх kind (G8); (8) внешний аудит ML-KEM key-privacy + домен-сепарация ПЕРЕД ceremony. Версионный хук (version/crypto_suite байт, контракт непрозрачен к discovery-полям) оставляет апгрейд PQ-discovery и double-ratchet на будущее БЕЗ нового immutable-редеплоя."

---

## RED-TEAM НАХОДКИ

### Линза: crypto-deanon | graph_broken=false | funds_safe=true | verdict=flawed

**1) [blocker] КВАНТОВЫЙ РЕТРО-ГРАФ: intro-дискавери (view_tag) чисто классический X25519, тело — гибрид. Асимметрия вскрывает ВЕСЬ граф первых контактов постфактум.**

Подтверждено в коде (platho-crypto.mjs:214-247): view_tag = HKDF(X25519(r, S_scan), R)[:2]. Тело шифруется гибридом enc+ML-KEM (PQ-стойко), НО поле, раскрывающее ПОЛУЧАТЕЛЯ (view_tag), выведено только из X25519. S_scan лежит в открытую в Vault KeyRecord. Квантовый противник (Shor) восстанавливает s_scan из публичного S_scan, затем для каждой заархивированной intro-записи считает e'=r·s_scan и матчит view_tag → деанонимизирует получателя КАЖДОГО первого контакта ретроактивно. intro-пул публичен и дёшево архивируется непрерывно (harvest-now-deanon-later). Так восстанавливаются все рёбра-«знакомства», а дальше тайминг достраивает беседы. residual-список упоминает только ANO-CCA ML-KEM, но ПРОПУСКАЕТ, что сам discovery-примитив не гибридный. Гибридизировать нельзя view_tag тривиально (KEM не даёт компактной сканируемой метки) — это архитектурная, а не патч-правка, на IMMUTABLE genesis.

_FIX:_ До genesis: либо принять, что intro-получатель НЕ PQ-приватен (задокументировать как явный gate и, возможно, отказаться от долгосрочного скрытия получателя знакомства), либо спроектировать PQ-стойкую сканируемую метку (например метка на симметричном PQ-KEM shared-secret, а не на X25519). Нельзя выпускать immutable, пока graph-раскрывающее поле слабее тела.

**2) [blocker] ТАЙМИНГ-КОРРЕЛЯЦИЯ направленных бакетов реконструирует пары в реальном мессенджере. Заявление «две стороны несвязываемы» верно лишь против наблюдателя, игнорирующего время.**

Структурно направленные opaque-бакеты корректны: общего bidirectional-остатка НЕТ, каждый бакет = один видимый публикатор, ключ = HKDF(K_epoch) неотличим от случайного для чужого. НО отправитель ВИДЕН (кошелёк), и в диалоге ответ N публикуется через секунды после сообщения N+1: два направленных бакета тикают в лок-степе весь epoch. Пассивный чейн-аналитик видит wallet A → bucket X в t, wallet B → bucket Y в t+δ, повторяемо → co-occurrence/latency-корреляция связывает X↔Y ⇒ A↔B. epoch-ротация не спасает: противник ре-коррелирует по кошелькам A,B каждую эпоху. Для чат-приложения с диалоговой каденцией это восстанавливает БОЛЬШИНСТВО активных пар. Дизайн честно помечает это residual, но недооценивает вес: для основного юзкейса (живая переписка) граф реконструируем. Именно поэтому graph_broken=false: против наивного индекс-скрейпера (заявленная угроза — сын со скриптом) граф рвётся, против реалистичного тайминг-противника — нет.

_FIX:_ Вне контрактной схемы (mix/рандом-задержки публикации/батч-окна) граф от тайминга не закрыть. Минимум — не заявлять «несвязываемо» без оговорки; рассмотреть клиентский джиттер отправки и развязку времени ответа. Признать, что цель «разорвать кто-кому» достигается лишь против скрейпера индекса, не против сетевого/чейн-тайминг-аналитика.

**3) [major] RPC-УТЕЧКА ГРАФА (CONV-лейн): точечные get_private_bucket_index(bucketKey) выдают toncenter пару {IP клиента → его входящие бакеты}, а отправитель публикует в те же бакеты видимо → RPC реконструирует кто-кому.**

Ради O(1)-масштаба CONV читается таргетированным геттером по СОБСТВЕННЫМ входящим bucketKey. Чтобы посмотреть бакет, клиент обязан отправить сам ключ на RPC (toncenter — по политике проекта transport = toncenter-only). RPC-эндпойнт (или колабящийся с ним) видит для каждого IP набор запрашиваемых bucketKey = входящие бакеты этого пользователя; отправитель публикует в те же ключи открыто → join publisher-wallet ↔ querier-IP восстанавливает граф на стороне RPC. intro-лейн этого НЕ имеет (bulk-пейджинг всего хвоста — все тянут одно и то же). Асимметрия: дизайн выбрал масштаб для CONV ценой query-privacy и это НИГДЕ не отмечено. Против конкретной угрозы (сын-скрейпер, не оператор toncenter) не критично, но расширяет деанон-множество на доверенную RPC-сторону и подрывает общий тезис «no-backend, граф разорван».

_FIX:_ Либо CONV через bulk/страничный фетч (жертвуя O(1)), либо PIR/oblivious-lookup, либо явно задокументировать RPC-провайдера как party, видящую граф, и распределить запросы по нескольким независимым RPC + рандомизация. Решить до genesis, т.к. выбор геттера вшит в контракт.

**4) [major] ФОРВАРД-СЕКРЕТНОСТЬ epoch-ратчета иллюзорна: K_root ре-выводим из СИДА + публично-архивируемой intro-капсулы, значит компрометация сида ретроактивно вскрывает ВСЮ историю, обнуляя FS.**

K_root_0 = HKDF(DH_stat_stat || DH(r,enc_B) || ml_kem_ss). Получатель B выводит все три слагаемых из своих статиков (enc_B_sec, ML-KEM decaps — детерминированы из сида) + R и KEM-шифртекста, которые лежат в ОТКРЫТОЙ intro-капсуле. intro-пул публичен и дёшево архивируется. Значит противник, снявший снапшот intro-пула, при последующей компрометации сида B пересчитывает K_root_0, а one-way epoch-ратчет K_root_{n+1}=HKDF(K_root_n) детерминирован → разворачивает всю прямую цепочку → читает всю историю. «FS через сутки» реально защищает лишь узкий сценарий: локальный K_root-стор утёк, а сид цел — что нетипично (сид — более чувствительный секрет на том же устройстве). Дизайн признаёт «сид = game over», но НЕ проговаривает, что это ретроактивно убивает и заявленную FORWARD-секретность через архив публичных intro. Выгода ратчета маргинальна.

_FIX:_ Не переоценивать FS в модели угроз (детерминированная деривация из сида + публичный intro ⇒ FS≈0 против seed-компрометации). Если FS реально нужна — эфемерный вклад в K_root должен быть НЕвосстановим из сида и не лежать в открытом intro (что противоречит recoverability на переустановке — это фундаментальный trade-off, зафиксировать явно).

**5) [major] УТЕЧКА OUT-DEGREE и объёма: кошелёк отправителя виден на каждом исходящем бакете, поэтому за epoch тривиально кластеризуются ВСЕ исходящие бакеты A по публикатору = число активных бесед A + суточный объём на беседу.**

Направленность прячет КОНТРАГЕНТА, но не форму соц-графа видимого отправителя. Наблюдатель группирует бакеты по публикатору (это же кошелёк A) → out-degree A (сколько разных людей) и per-conversation дневной объём/часы активности. Дизайн упоминает «размер бакета» и «объём intro», но НЕ выделяет кластеризацию out-degree по публикатору как самостоятельную метадату-утечку. Эти сигналы (степень, объём, тайминг-паттерн) — топливо для тайминг/поведенческой ре-идентификации и пересечения по эпохам.

_FIX:_ Признать псевдонимность частичной: скрыт получатель, но степень/объём/расписание отправителя открыты. Рассмотреть padding/cover-traffic или ограничение видимости объёма, если out-degree чувствителен.

**6) [minor] ХЕНДШЕЙК: intro-подпись покрывает только R+view_tag, не полный транскрипт (оба keyId + KEM-шифртекст) → риск unknown-key-share/misbinding; нет anti-replay nonce → дубли-контакты.**

Аутентификация статиков B (Vault, привязка к кошельку) и verify-after-decrypt подписи A — в целом здраво, MITM подмены бандла нет (Vault wallet-authenticated). НО если ed25519-подпись A не коммитит к ПОЛНОМУ транскрипту (keyId_A, keyId_B, R, KEM-ct), возможна misbinding/UKS: identity-секция внутри тела защищена только GCM телесным ключом, а не подписью A над транскриптом. Реплей intro (дизайн помечает дедуп как open question) даёт дублирующийся контакт / потенциальную путаницу K_root. ml_kem_ss переиспользуется в body-ключе и K_root — при РАЗНЫХ salt/info изолировано, но это аудит-критично проверить на verifiable cross-relation.

_FIX:_ Подписывать полный транскрипт первого контакта (оба keyId, R, хеш KEM-ct, view_tag). Добавить anti-replay nonce в intro-тело + клиентский дедуп по nonce. Формально проверить доменную сепарацию ml_kem_ss (body vs K_root).

**7) [minor] scan-ключ всё ещё randomBytes (подтверждено в коде): deriveMessagingIdentityFromWallet НЕ выводит scanSecretKey из сида → intro невосстановим после переустановки/на втором устройстве.**

platho-wallet.mjs:318-341: createMessagingIdentity вызывается БЕЗ scanSecretKey ⇒ внутри генерится случайный scan-секрет. S=s·G тогда не ре-деривируется из сида → после переустановки клиент не примет ни одного intro, и multidevice-восстановление K_root (open question) ломается. Это не деанон ЧУЖИХ, а availability/recoverability-баг, но он подрывает всю intro-модель. Дизайн правильно планирует фикс (hkdfBytes 'messaging.hybrid-v1.scan.x25519'); подтверждаю, что в дереве он ещё НЕ сделан и является предусловием корректности лейна знакомства.

_FIX:_ Как в дизайне: scanSecretKey = hkdfBytes(seed, 'messaging.hybrid-v1.scan.x25519', 32), прокинуть в createMessagingIdentity, детерминированно из сида. Обязательно до genesis (иначе intro-приём нестабилен).

### Линза: contract-safety | graph_broken=true | funds_safe=true | verdict=sound-with-fixes

**1) [major] Очистка author_wallet -> Address? для private/intro ломает ЕДИНЫЙ пин HUB_BATCH_MSG_ROOT_BITS и делает ширину корневой ячейки PublishBatchToHub kind-зависимой.**

Vault.tact:348 пин HUB_BATCH_MSG_ROOT_BITS=924 включает author_wallet(267). hubMsgBits считается ОДНОЙ формулой (Vault.tact:2281: (measuredBits-1016)+HUB_BATCH_MSG_ROOT_BITS) и используется для hubFwd, который Vault УДЕРЖИВАЕТ из maxCharge (2320) и платит SendPayGasSeparately из своего баланса. Если author_wallet становится Address?, для public добавляется 1 Maybe-бит (268), для private/intro поле = null (1 бит) — корневые биты расходятся на ~266 бит между лейнами. Один константный пин больше не корректен ни для одного kind; на immutable-деплое неверный per-kind пин необратим, а gate G2 (assert ABI==пин) должен быть переразведён на три значения. Практический вред ограничен (для private — переоценка hubFwd => небольшая переплата пользователя, не дренаж; для public — недооценка на 1 бит, пренебрежимо), но это лишняя необратимая fee-сложность.

_FIX:_ Либо оставить author_wallet как FIXED-width Address для ВСЕХ kind (для private/intro класть sentinel/owner — поле всё равно мёртво на стороне Hub для private), сохраняя единый пин 924; либо развести HUB_BATCH_MSG_ROOT_BITS на _PUBLIC/_PRIVATE/_INTRO и ветвить hubMsgBits по kind + тройной gate G2. Выгода от экономии 267 бит на форвард приватной капсулы не оправдывает необратимый per-kind fee-риск — рекомендую оставить фиксированный Address.

**2) [major] Восстановление K_root на реинсталле/втором устройстве НЕ решено — на immutable genesis это риск безвозвратной потери всех бесед.**

Статики детерминированы из сида (это в дизайне закрыто, включая фикс scan-ключа из сида), но K_root выводится на ПЕРВОМ контакте из эфемеры и хранится ТОЛЬКО локально. После переустановки intro-капсула может быть уже FIFO-эвиктнута из intro-пула (retention 1 год, но эвикция intro-пула завязана на НИЗКИЙ трафик знакомств — см. отдельную находку), тогда re-scan невозможен и беседа нечитаема навсегда. Это open_question в дизайне, но НЕ решено, а деплой необратим. Не влияет на средства, но влияет на сохранность пользовательских данных под immutable-контрактом.

_FIX:_ Зафиксировать механизм ДО genesis: либо синк K_root через self-encrypted PREFS-капсулу (модель уже есть — subscription-sync), либо детерминировать K_root чисто из статиков (жертвуя эфемерным FS-вкладом). Заложить версионный хук (crypto_suite/version) чтобы не требовался новый immutable-редеплой при апгрейде.

**3) [major] Эвикция intro-пула завязана на publish-путь intro-kind, а intro по построению НИЗКО-объёмный — ослабленная граница состояния и дорогой первичный скан.**

Модель CapsuleHub эвиктит до part_count самых старых просроченных записей СВОЕГО kind на каждый publish (CapsuleHub.tact:941-945). Для private/public это ОК (высокий трафик => быстрая эвикция). Intro-пул платится 'один раз на нового собеседника' => низкий поток publish => просроченные intro-записи висят далеко за retention, пока не придёт достаточно новых intro чтобы их вытолкнуть. Рост не безграничен (ограничен суммарным числом intro за всё время), но 'live'-окно, которое получатель обязан пропейджить скан-геттером чтобы поймать свой view_tag, растёт сильнее, чем подразумевает 1-год retention. Первый контакт требует скана от oldest_live до latest по ВСЕМ intro всех пользователей.

_FIX:_ Разрешить evictExpiredIntro запускаться на ЛЮБОМ publish-kind (private/public батчи тоже подметают хвост intro-пула), либо ввести permissionless prune-op для intro-пула. Иначе граница состояния intro честно слабее, чем у бесед.

**4) [major] Непрозрачный bucketKey => контракт НЕ может обеспечить направленность бакетов; вся неразрываемость графа держится ТОЛЬКО на клиенте, без defense-in-depth, необратимо.**

Дизайн верно требует, чтобы контракт трактовал ключ бакета непрозрачно (skip64/load256, CapsuleHub не валидирует recipient-семантику) — это КОРРЕКТНО для приватности. Но следствие: контракт не имеет никакой защиты, если клиент (или будущая версия клиента) выведет БИНАПРАВЛЕННЫЙ или переиспользованный bucketKey — тогда два видимых публикатора попадут в один бакет и граф A<->B утечёт, а контракт immutable и пропатчить нельзя. Старый sender_index хотя бы ключевался на СОБСТВЕННЫЙ верифицируемый ключ отправителя. Полностью клиент-контролируемый ключ также лишает контракт возможности per-identity дедупа/рейт-лимита. Граф РВЁТСЯ на уровне явного on-chain who-received индекса (именно его скрейпил скрипт), но гарантия целиком клиент-энфорсимая.

_FIX:_ Явно принять владельцем как клиент-энфорсимую границу; закрепить деривацию направленного bucketKey как аудит-критичный инвариант с тестами (лексикографический dir по keyId, epoch_u32_BE), и заморозить её до genesis. Рассмотреть контрактный анти-повтор по (bucketKey,body_hash) для дешёвого defense-in-depth против случайного двунаправленного пуша.

**5) [minor] ReceiveIntent и учёт средств НЕ затрагиваются редизайном — funds_state_safe подтверждён, но с оговоркой по per-kind газ/сторидж пинам.**

receive_intents (Vault.tact:522) — отдельная map; батч-путь трогает users.ton_balance + pending_batch_publishes; пересечений с интентами нет. Модель заряда/возврата (canonicalTotal, reject-with-refund 2306-2316, mode-128 ACK) структурно не меняется. Заголовок header0, индексы и author_wallet не разделяют состояние с интентами/балансами. Поэтому средства и состояние безопасны ПРИ УСЛОВИИ, что новые per-kind пины (batchStorageReserve/HUB_PART_GAS_INTRO, storage-endowment intro без индекс-слота) выведены корректно — иначе недофинансирование сторидж-эндаумента intro-энтри даёт медленный дренаж резерва Hub на immutable-контракте.

_FIX:_ Перед genesis прогнать газ-калибровку для всех ТРЁХ kind (G8-подобный worst-case) и пин-гейты (G2) для intro-storage-endowment и HUB_PART_GAS_INTRO; добавить conformance-тест на тройной набор пинов.

**6) [minor] Дизайн-заметка про долг scan_pubkey (клиент шлёт 800-бит layout, привести к 1056) УСТАРЕЛА — уже закрыта в рабочем дереве.**

contract_changes[0] дизайна называет открытым долг: перевести action-payload RegisterMessagingKeys/ReplaceMessagingKeys на 1056 бит и scan_pubkey!=0. В текущем дереве это УЖЕ сделано: Vault.tact:1787 требует actionPayloadPreview.bits()==1056, RegisterMessagingKeys throwUnless(16117, scan_pubkey!=0) (1708), scan_pubkey в KeyRecord (309). Пункт дизайна ложно-открытый — при планировании работ его надо снять, чтобы не переделать уже сделанное. Также дизайн описывает CONV(320)/INTRO(336) header0, тогда как дерево сейчас на ЕДИНОМ 592-бит PH0C (CapsuleHub.tact:35) — редизайн идёт поверх незавершённого первого редизайна; важно не смешать пины при immutable-сборке.

_FIX:_ Снять contract_changes[0] как закрытый; явно зафиксировать, что база — текущий 592-бит PH0C tree, и переход на CONV/INTRO раздвоение — это НОВЫЙ форк header0-пинов (CAPSULEHUB_PRIVATE_HEADER0_BITS раздвоить на _CONV=320/_INTRO=336 и зеркалить в Vault:78).

**7) [minor] Граф «кто-кому» структурно рвётся, но остаточные каналы (тайминг диалога, key-privacy ML-KEM) честно НЕ закрыты и являются гейтом всей приватности.**

На уровне детерминированного on-chain индекса граф разрывается: recipient_key_id и recipient-индекс удалены (CapsuleHub.tact:272), получатель скрыт (stealth view_tag / непрозрачный бакет), направленные бакеты дают одного публикатора на бакет. Это адресует ровно тот вектор, что эксплуатировал скрипт (открытый recipient-индекс). Но residual_leaks дизайна корректны и существенны: (1) тайминг-корреляция ответ N ~ N+1 может статистически реконструировать пару — вне контрактной схемы; (2) ВСЯ неразрываемость держится на ANO-CCA/key-privacy гибрида ML-KEM — если KEM-шифртекст выдаёт recipient enc-ключ, направленность не спасает. Это ГЕЙТ, требующий внешнего крипто-аудита ML-KEM key-privacy до immutable genesis.

_FIX:_ Пометить ML-KEM key-privacy как обязательный пункт внешнего аудита ПЕРЕД ceremony; тайминг-остаток задокументировать как принятую деградацию (нужен mix/задержки вне контракта).

