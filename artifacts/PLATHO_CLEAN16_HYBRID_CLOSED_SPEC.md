# PLATHO clean-16 ГИБРИД — DECISION-CLOSED спец + план (проход wkx7snxw3)

> ready_for_implementation = **false**. Все 3 red-team линзы: breaks_index_scraper=TRUE. funds_safe требует газ-калибровок (не дизайн-флоу). 1 within-boundary БЛОКЕР (durability recovery) + 6 owner-вопросов.

---

## ✅ ФИНАЛЬНЫЕ РЕШЕНИЯ (sign-off владельца, 2026-07-14) — ПЕРЕОПРЕДЕЛЯЮТ спец ниже

Реализация ведётся по спецу §0-12 + план Фаза0-7 НИЖЕ, но с ДВУМЯ override'ами:

1. **D7 → УБРАТЬ `first_publisher` целиком (override §5).** Контракт трактует bucketKey ОПАКОВО и НЕ хранит НИКАКОЙ sender-метки. Направленность (dir по лексикографике keyId) = ЧИСТО КЛИЕНТСКИЙ замороженный инвариант + conformance-тест. Удалить из плана/спека: поле `first_publisher_key` в `PrivateCapsuleKeyIndex`, код `13531 RJ_BUCKET_PUBLISHER` и его bounce-refund-тест, `+256-бит` довесок к `CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT` (endowment пере-мерить БЕЗ него). `PrivateCapsuleKeyIndex` = `{ latest_entry_link; entry_count; }`. Push без publisher-сравнения. Причина: on-chain sender→bucket детерминизм несмываем на immutable, польза маргинальна (коллизия и так тайминг-линкуема).

2. **DURABILITY → ВАРИАНТ B (override §12 «durability open»).** recovery/PREFS-капсула живёт в ОТДЕЛЬНОМ пуле с ~10-летним retention (НЕ 1-год private-пул). Эндаумент оплачен НАПЕРЁД, ОСВЕЖАЕТСЯ на каждой recovery-публикации (новый контакт auto-рефрешит окно). **Вшит в стоимость СТАРТА БЕСЕДЫ** (первая recovery-публикация — на первой беседе, НЕ на активации). НЕ вариант A (ленивое списание ренты из `ton_balance` ОТВЕРГНУТО: неоднозначный тратимый баланс + сюрприз-fail отправки). Инвариант B: `баланс показанный = тратимый`, отправка заряжается ТОЛЬКО за сообщение. Масштаб эндаумента ≈ 10-летняя рента ≈ 0.4-2.6 GRAM за 50-300 контактов, пагинация → инкрементально. Нужны genesis-пины: `RECOVERY_POOL_RETENTION` (~10 лет), `RECOVERY_ENTRY_STORAGE_ENDOWMENT`, отдельный пул `recovery_entries` + триплет счётчиков + эвикция + `protectedReserve/indexStorageReserve += recovery`. Self-lane bootstrap (§12 пп.1-6: seed-детерм K_root_self, epoch-сентинел-0 self-bucketKey, UNION-merge, аддитивный restore, пагинация, scan-key-from-seed) ОСТАЁТСЯ.

Прочее: Q3/Q4 остатки приняты; Q5 ротация → версионный contact-store (в дизайне, не развилка); Q6 внешний аудит key-privacy ОБЯЗАТЕЛЕН до ceremony.

---

## RED-TEAM ВЕРДИКТЫ
- **КРИПТО-ДЕАНОН (разрыв recipient-index скрейпера)**: breaks_scraper=true, funds_safe=false, verdict=sound-with-fixes, findings=5
- **Контракт-безопасность immutable genesis**: breaks_scraper=true, funds_safe=false, verdict=sound-with-fixes, findings=8
- **Доступность/Восстановление (D2 K_root recovery, D5 intro-эви**: breaks_scraper=true, funds_safe=true, verdict=flawed, findings=8

## БЛОКЕР (within-boundary, не закрыт дизайном)
1. DURABILITY recovery-стора K_root против FIFO-эвикции (within_boundary, availability blocker #2 — НЕ закрыт дизайном, требует ГЕНЕЗИС-immutable решения). Дизайн закрыл bootstrap-ЦИКЛ (self-lane §12: seed-детерминированный K_root_self + epoch-независимый self-bucketKey + UNION-merge + аддитивный restore + пагинация), НО сама PREFS/recovery-капсула живёт в пуле с 1-год retention + FIFO. Сценарий: пользователь неактивен >retention → переустановка → self-bucketKey вычислен, но капсула ЭВИКТНУТА → список контактов и ВСЕ peer-K_root потеряны НАВСЕГДА (fallback re-scan intro-хвоста тоже требует живого intro <1год). Retention пула ВШИВАЕТСЯ в genesis, постфактум не тюнится. Требуется до seal: либо выделить recovery-лейну отдельный пул с существенно бОльшим/неистекающим retention, либо хранить контакт-стор/K_root в НЕэвиктируемом Vault-поле на владельца. Это owner-решение (см. user_questions[0]) + реализация нового пула/поля — пока не принято, immutable seal невозможен.

## ВОПРОСЫ ВЛАДЕЛЬЦУ
1. DURABILITY RECOVERY (immutable, БЛОКЕР): готов ли владелец вшить в genesis ОТДЕЛЬНЫЙ пул для PREFS/recovery-капсулы с существенно бОльшим или НЕистекающим retention (или неэвиктируемое Vault-поле контакт-стора на владельца), чтобы неактивность >1 года + переустановка НЕ означала необратимую потерю ВСЕЙ переписки? Либо явно принять 1-год FIFO как задокументированную необратимую потерю с предупреждением пользователю? Retention пула постфактум не тюнится — решение нужно ДО seal.
2. РАТИФИКАЦИЯ D1↔D7: подтвердить разрешение — CONV author_wallet=РЕАЛЬНЫЙ owner_wallet (используется только для first_publisher_key, НЕ хранится в entry, НЕ в геттере), INTRO=клиентский sentinel без Vault-ветки. Альтернатива: полностью отказаться от контрактного D7 (first_publisher целиком) в пользу чисто клиентской направленности — red-team аргументирует, что это СТРОГО ЛУЧШЕ по приватности (CONV-бакет в стейте не несёт НИКАКОЙ sender-метки даже в дорогом дампе), а цена D7 (защита лишь от собственного багнутого клиента, чья коллизия и так линкуется таймингом) не окупает on-chain sender→bucket детерминизм на immutable. Какой вариант?
3. ОСОЗНАННОЕ ПРИНЯТИЕ sender-видимости: подтвердить, что on-chain отображение opaque-bucketKey→publicAuthorKeyId(sender) во ВНУТРЕННЕМ индексе (не в геттере) + out-degree cardinality по стейт-дампу — принятый residual (#3/#5). На immutable необратимо.
4. КВАНТОВЫЙ РЕТРО-ГРАФ ЗНАКОМСТВ: подтвердить принятие view_tag=классический X25519 (S_scan открыт в Vault) → квантовый деаноним ПОЛУЧАТЕЛЯ каждого первого контакта, локализованный ребром первого контакта. Требует явного owner-подтверждения до ceremony (+ версионный хук согласован).
5. ПОВЕДЕНИЕ ПРИ РОТАЦИИ КЛЮЧЕЙ (ReplaceMessagingKeys уже в контракте): смена гибридного keyId меняет lo/hi→K_root/bucketKey/dir mid-conversation + старые intro адресованы прежнему scan_pubkey. Определить до genesis: триггер ре-intro/переустановления K_root при ротации у любой стороны + versioned-per-keyId хранение старых K_root/scan-секретов в контакт-сторе (иначе до-ротационная история нечитаема, беседа тихо промахивается).
6. ВНЕШНИЙ КРИПТО-АУДИТ key-privacy (ANO-CCA гибридного конверта тела) — НЕСУЩИЙ гейт всей recipient-приватности: opacity bucketKey необходима, но НЕ достаточна (body_KEM_ct в клиртексте). Подтвердить заказ аудита ДО ceremony; если noble-ML-KEM не даёт key-privacy — заложить бюджет/время на key-blinding обёртку KEM-ct до immutable.

## ПРИНЯТЫЕ ОСТАТКИ
1. ТАЙМИНГ-КОРРЕЛЯЦИЯ ДИАЛОГА: ответ N≈сообщение N+1, два направленных бакета тикают в лок-степе; пассивный чейн-аналитик по co-occurrence связывает bucket X↔Y ⇒ wallet A↔B. Направленность/first_publisher/stealth НЕ закрывают. Закрытие только mix/задержки — отвергнуто владельцем ради скорости отправки. Вне границы заявленной угрозы (скрейпер recipient-индекса).
2. RPC-ВИДИМОСТЬ ГРАФА CONV: RPC-эндпойнт видит {IP → входящие bucketKey}. Смягчено get_private_bucket_index_batch (все контакты×эпохи+decoy в ОДНОМ запросе) + ротацией toncenter-эндпойнтов + keyless fallback. НЕ устранено. RPC документируется как party, видящая граф при сговоре с чейн-анализом.
3. КВАНТОВЫЙ РЕТРО-ГРАФ ЗНАКОМСТВ: view_tag=HKDF(X25519(r,S_scan),R)[:2] чисто классический, S_scan открыт в Vault; Shor восстанавливает s_scan → деаноним ПОЛУЧАТЕЛЯ каждого ПЕРВОГО контакта (harvest-now). Локализовано ребром первого контакта; CONV-лейн PQ-граф-приватен. Версионный хук (version@4/suite@7, контракт трактует непрозрачно) под PQ-discovery без редеплоя.
4. OUT-DEGREE/ОБЪЁМ ОТПРАВИТЕЛЯ: кошелёк публикатора виден на каждом исходящем CONV-бакете (author_wallet в транзитной tx + first_publisher_key ВНУТРИ индекса, но НЕ в геттере) → кластеризация по дорогому стейт-дампу выдаёт число собеседников/суточный объём/расписание. Псевдонимность частична (скрыт ПОЛУЧАТЕЛЬ, не форма соц-графа отправителя). Это НЕ recipient-leak (цель раунда). Смягчение только padding/cover-traffic — вне baseline.
5. FS ЭФФЕКТИВНО НУЛЕВАЯ против компрометации K_root/сида: прямая по-эпоховая деривация даёт лишь изоляцию K_epoch. Утечка K_root ⇒ весь граф маршрутов пары за все эпохи. Осознанный trade-off recoverability↔FS (D2 требует восстановимости на immutable). forward-chain overlay маргинален, в baseline не включён.
6. RJ_BUCKET_PUBLISHER (13531): клиентский баг dir_byte/K деградирует CONV-батч в full-batch-BOUNCE (не тихий дроп). Реальная потеря = measuredImport+vaultCompute+hubFwd (нормальная bounce-стоимость), НЕ пинованный reject-floor. Для честного клиента недостижимо (bucketKey опакостен). Явный аудит-инвариант + тест.
7. self-беседа НЕ граф-приватна (self-пара обходит genuine-KEM, K_root_self детерминирован из сида) — приемлемо: self=self не создаёт межпользовательского графа, PQ там нечего защищать.
8. Контакты старше retention, чей intro эвиктнут И которых нет в живом PREFS-снапшоте — невосстановимы (редко при регулярном re-publish; частный случай blocker durability).

---

# СПЕЦ

# PLATHO clean-16 «ГИБРИД» — decision-closed спец для immutable genesis (Вариант 1)

## 0. Цель и граница угрозы
Разорвать ДЕТЕРМИНИРОВАННЫЙ on-chain индекс «кто-кому» против индекс-скрейпера (скрипт, читающий recipient-индекс) и подобных пассивных читателей состояния. Достигается: recipient-индекс уже удалён (PH0C-база), CONV едет по НЕПРОЗРАЧНОМУ направленному bucketKey (PQ-граф-приватному через ML-KEM ss в K_root), INTRO — по stealth-скану (ephemeral_R + view_tag). Тайминг-корреляция диалога, RPC-видимость графа при сговоре с чейн-анализом, квантовый ретро-граф ПЕРВЫХ контактов — ПРИНЯТЫЕ задокументированные остатки, НЕ закрываемые в этом раунде (см. accepted_residuals).

## 1. Архитектура: два лейна, батч-уровневый дискриминатор
- **CONV** (publishKind=1, ~весь трафик): O(1) выборка по opaque bucketKey. Пул `private_entries` + непрозрачный `private_bucket_index`.
- **INTRO** (publishKind=3, 1 раз/новый контакт): отдельный пул `intro_entries` БЕЗ индекса, stealth-скан.
- **PUBLIC** — без изменений.
Дискриминатор — `publish_kind` НА УРОВНЕ БАТЧА (весь батч однороден), НЕ per-part. Ветка exact-bit пинов выбирается один раз.

## 2. D1 (author_wallet) + D7 (направленность) — РАТИФИЦИРОВАННОЕ разрешение коллизии
`author_wallet` ОСТАЁТСЯ fixed-width `Address` в `PublishBatchToHub` для ВСЕХ трёх kind → пин `HUB_BATCH_MSG_ROOT_BITS=924` (Vault:348) и `hubMsgBits` (Vault:2281) НЕ трогаем, gate G2 стабилен. Дроп/`Address?` запрещён (необратимо ломает 924).
- **CONV**: `author_wallet = РЕАЛЬНЫЙ msg.owner_wallet`. Используется Hub-ом ТОЛЬКО для `first_publisher_key = publicAuthorKeyId(author_wallet)` (D7-энфорсмент), НЕ хранится в `PrivateCapsuleEntry` (там его и не было; `get_private_entry` уже отдаёт vault_address-заглушку). Гол D1 («убрать метку отправителя из ХРАНИМОЙ капсулы + отдаваемого header0») выполнен: stored entry и served header0 без sender-метки.
- **INTRO**: `author_wallet = SENTINEL` — **чисто КЛИЕНТСКОЕ** решение (клиент кладёт sentinel-адрес). Hub поле ИГНОРИРУЕТ (у INTRO нет индекса, `IntroCapsuleEntry` не хранит author_wallet). **НЕ вводим отдельную kind-ветку форварда в Vault** (Vault:2352 безусловно шлёт `msg.owner_wallet`-поле; для INTRO клиент заранее подставил sentinel). Это снимает контрактную сложность (red-team contract-lens minor: sentinel — privacy-only, НЕ safety-требование).

## 3. D6 + пины: раздвоение header0 (НОВЫЙ форк, НЕ правка 592)
Удалить `CAPSULEHUB_PRIVATE_HEADER0_BITS=592`. Ввести:
- `CAPSULEHUB_CONV_HEADER0_BITS = 320` (40 байт, 1 cell, 0 refs)
- `CAPSULEHUB_INTRO_HEADER0_BITS = 336` (42 байта, 1 cell, 0 refs)

**CONV header0 (320 бит, big-endian, byte-aligned):**
- [0:32] magic 'PH0C'; [32:40] version=1; [40:48] publishKind=1; [48:56] sizeClass; [56:64] cryptoSuite=2 HYBRID → фикс-мета 64 бита
- [64:320] bucketKey (256, RAW HKDF-выход, НЕ base64)
Экстрактор `privateHeaderBucketKey(header0)` = переименованный текущий `privateHeaderSenderKeyId` (CapsuleHub:508-512): `header.loadUint(64); return header.loadUint(256);` — байт-в-байт та же операция. sender_key_id / ephemeral_scan_pub / view_tag из CONV ПОЛНОСТЬЮ УДАЛЕНЫ; `privateHeaderEphemeralScanPub`/`privateHeaderViewTag` над private_entries УДАЛЯЮТСЯ (переезжают в INTRO).

**INTRO header0 (336 бит):**
- [0:64] meta (та же шапка, publishKind=3); [64:320] ephemeral_R (256, R=r·G); [320:336] view_tag (u16 BE)
Экстракторы над intro-пулом: `introHeaderEphemeralR` (`loadUint(64); return loadUint(256)`), `introHeaderViewTag` (`loadUint(64); loadUint(256); return loadUint(16)`). sender_key_id в INTRO НЕТ (личность в теле, verify-after-decrypt).

**НЕ трогать:** `_HEADER0_CELLS=1`/`_HEADER0_REFS=0` (общие), header1 240/1cell/0refs, `part.bits()==784` + refs 3/4 (единый фрейм CONV/INTRO/PUBLIC), 924, `hubMsgBits` (measuredBits авто-учитывает +16 бит INTRO header0-ref; marketing +152 ТОЛЬКО PUBLIC). Зеркало Vault.tact:78-81 идентично раздваивается; `isPrivateCapsuleShapeValid`(L968) → `isConvCapsuleShapeValid`(320)/`isIntroCapsuleShapeValid`(336). requireExactPayloadCell fail-closed: 336-битный header0 в CONV-ветке → 13514.

**Gate G2 перепинивается на ТРИ header0-шейпа из компилированного ABI: PUBLIC 576 / CONV 320 / INTRO 336; один генератор, assert на все три, зеркало Hub↔Vault, БЕЗ остаточного 592.**

## 4. Разводка publish_kind
Ввести `CAPSULEHUB_ENTRY_KIND_INTRO=3` (CapsuleHub) и `PUBLISH_KIND_INTRO=3` (Vault). Vault external `PublishBatchFromVaultBalance` kind-гейт (L2155) += INTRO; walk (L2183) перестроить в 3-way (INTRO-ветка = копия PRIVATE с `isIntroCapsuleShapeValid`336 + `isPublishProfileValid(INTRO)`=header0≠0&&header1≠0&&allowedPrivateSizeClass&&suite==HYBRID). Hub receive (L798) Phase-A гейт += INTRO; `isPrivate` bool → 3-way isConv/isIntro/isPublic; INTRO берёт СВОЁ id-пространство `intro_latest_id`, `intro_entries.set` вместо pushPrivateBucketIndex, `intro_live_count += 1`. PUBLIC без изменений.

## 5. D7 (bucket-индекс) — направленность + defense-in-depth, БЕЗ утечки через геттер
`private_sender_index` → `private_bucket_index: map<Int as uint256, PrivateCapsuleKeyIndex>`, ключ = bucketKey (opaque).
```
struct PrivateCapsuleKeyIndex { latest_entry_link: uint64; entry_count: uint64; first_publisher_key: Int as uint256; }
```
`first_publisher_key = publicAuthorKeyId(msg.author_wallet)` (hash(storeAddress), CapsuleHub:573 — НЕ сырой Address).
- push (`pushPrivateBucketIndex`): при первом push (indexOpt==null) фиксируем first_publisher_key; при последующих `throwUnless(13531 RJ_BUCKET_PUBLISHER, existing.first_publisher_key == publicAuthorKeyId(msg.author_wallet))`. Несовпадение → throw → весь батч BOUNCE на Vault → `bounced<PublishBatchToHub>` (Vault:2624) рефандит refundable_amount=callValue. Это НЕ Vault-side RJ-receipt (у Vault нет индекса).
- backward-link: `PrivateCapsuleEntry.sender_prev_link` → `bucket_prev_link: uint64` (тот же слот). push возвращает prevLink до апдейта.
- **КРИТИЧНО (red-team crypto major, within_boundary): `first_publisher_key` НЕ ЭКСПОНИРУЕТСЯ геттером.** Хранится только во внутреннем `PrivateCapsuleKeyIndex` для push-сравнения. `PrivateBucketIndexView` его НЕ содержит. Иначе publicAuthorKeyId обратим (кошельки перечислимы) → дешёвая on-chain sender-атрибуция + out-degree cardinality по одному стейт-снапшоту. Убираем из view → остаётся только дорогой полный стейт-дамп.
- эвикция `evictExpiredPrivate` (L690) парсит bucketKey через `privateHeaderBucketKey` → `prunePrivateBucketIndex` (del-at-zero). private_entries теперь ТОЛЬКО CONV → нет kind-неоднозначности.
- Направленность (клиентский инвариант, контракт держит opaque): bucketKey=HKDF(K_epoch‖dir_byte‖epoch_u32_BE); first_publisher_key = defense-in-depth против двунаправленной коллизии. Заморозить деривацию + conformance + тест 13531.

## 6. D5 (эвикция INTRO) — граница intro не слабее бесед, с ЗАЩИЩЁННОЙ калибровкой
```
intro_entries: map<Int as uint64, IntroCapsuleEntry>;
struct IntroCapsuleEntry { publish_id: uint256; created_at: uint64; body_hash: uint256; header_0: Cell; header_1: Cell; }
```
Триплет `intro_latest_id`/`intro_oldest_live_id`/`intro_live_count`, init=0.
`evictExpiredIntro` — scan-only FIFO (нет index-un-push): стоп на первом непротухшем (created_at+RETENTION), del + count-=1 + oid+=1; defensive skip на дырке.
**D5-механика с капом (red-team contract major, within_boundary):** intro-sweep вызывается на КАЖДОМ publish-kind, НО с `min(msg.part_count, INTRO_SWEEP_CAP)` где `INTRO_SWEEP_CAP` — небольшой пин (baseline 4), ДЕКУПЛИРОВАННЫЙ от part_count. Это локализует мис-оценку газа intro-del и не даёт стоимости эвикции масштабироваться с размером PUBLIC-батча (чтобы самая частая PUBLIC-операция не стала заложником оценки intro-полосы). G8 обязан доказать, что sweep с капом ДОГОНЯЕТ максимальный intro-inflow (intro низкообъёмный по допущению). В конце receive: own-kind sweep (CONV→evictExpiredPrivate, PUBLIC→evictExpiredPublic) + БЕЗУСЛОВНЫЙ capped intro-sweep для всех трёх.
entry_uid: `ENTRY_UID_DOMAIN_VAULT_INTRO=0xD1190203` (хелпер по образцу computeVaultPrivateEntryUid). Структуры PrivateScanRecord/PageView/BoundsView → Intro* над intro_entries.

## 7. Газ/сторидж по ТРЁМ kind (провизорные числа → финал после G8)
STORAGE: `CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT` (CONV, пере-измерить под +256 бит first_publisher_key в worst-case «fresh-bucket-per-entry», ориентир 3.3-3.6M); ввести `CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT` (нет index-слота, ~1.8-2.2M). Vault `STORAGE_RESERVE_PRIVATE`(CONV) оставить; ввести `STORAGE_RESERVE_INTRO`. batchStorageReserve* += INTRO-ветка.
**БЛОКЕР funds-safety (red-team contract blocker, within_boundary): `indexStorageReserve()` (CapsuleHub:360) ОБЯЗАН добавить `intro_live_count * introIndexStorageReservePerEntry()`** (=keepalive + INTRO endowment). Иначе intro-эндаумент классифицируется как excess → SweepExcessReserve/FlushFees выведут TON, бэкающий живой intro-сторидж → необратимый дренаж на immutable. `protectedReserve()` должна расти на все ТРИ пула.
GAS: `HUB_PART_GAS_PRIVATE`(CONV, коммент «2 index pushes» устарел: 1 bucket-push + first_publisher-сравнение + auto-evict-1 + capped intro-sweep-del); `HUB_PART_GAS_PUBLIC` (+ capped intro-sweep, поднять); ввести `HUB_PART_GAS_INTRO` (0 index-push, дешевле). Vault:372-373 ЗЕРКАЛИТЬ по трём kind; `batchHubPartGas`/`batchVaultPartGas` += INTRO (`VAULT_PART_GAS_INTRO`). **Любой рассинхрон Hub-константа↔Vault batchHubPartGas → Vault недодержит → throw 13530 → bounce → permanent liveness-break на immutable.** Пин каждого HUB_PART_GAS_* делает ОДИН генератор из ABI (G2). BATCH_FLOOR_* kind-независим — OK.

## 8. Геттеры (формы ВШИТЫ в genesis)
1. `get fun get_private_bucket_index(bucketKey: Int): PrivateBucketIndexView` где `struct PrivateBucketIndexView { exists: Bool; bucket_key: Int; latest_entry_id: Int; latest_entry_link: Int; entry_count: Int; }` — **БЕЗ first_publisher_key** (§5). miss → exists:false, нули.
2. `get fun get_private_bucket_index_batch(keys: map<Int as uint16, Int as uint256>): map<Int as uint16, PrivateBucketIndexView>` — foreach, cap `BUCKET_BATCH_MAX_KEYS=32`. Клиент тянет все входящие бакеты (контакты×окно эпох) + decoy одним запросом (D3 RPC-приватность).
3. Intro-скан (переименование Private*→Intro*, над intro_entries): `get_intro_scan_bounds()`→{oldest_live_id, latest_id}; `get_intro_scan_page(fromEntryId, count)` count clamp≤64, `struct IntroScanRecord { entry_id:uint64; created_at:uint64; view_tag:uint16; ephemeral_R:uint256; }`, читает ТОЛЬКО header_0.
УДАЛИТЬ: get_private_scan_bounds/page, get_private_sender_index. `get_state` += intro_latest_id/intro_live_count/intro_oldest_live_id (мониторинг дренажа).

## 9. КЛИЕНТ — деривация K_root / K_epoch / bucketKey
**K_root establishment (гибрид, ГЕНУИННАЯ ML-KEM — НЕ дерандомизированная §5):** A→B: DH_ss=X25519(A.enc_sec,B.enc_pub) ‖ mlkem_ss из СВЕЖЕЙ `ml_kem768.encapsulate(B.mlKem768_pub)` (ct_root 1088Б в intro-теле ОТДЕЛЬНОЙ секцией, НЕ переиспользуя body_KEM_ct). `K_root = HKDF(DH_ss‖mlkem_ss, salt='PLATHO.CONV.ROOT.SALT.V1', info='PLATHO.CONV.ROOT.V1'‖lo_keyId(32)‖hi_keyId(32))`. Пер-ПАРНЫЙ. §5 (coin=HKDF(DH_ss)) ОТКЛОНЁН: в noble ss=HASH512(m‖HASH256(pk))[:32] публична из (coin,pk) → coin из классического DH_ss коллапсирует ML-KEM-вклад к стойкости X25519 → CONV НЕ был бы PQ.
**K_epoch (прямая по-эпоховая деривация, НЕ одноходовая цепочка):** `K_epoch = HKDF(K_root, salt='PLATHO.CONV.RATCHET.SALT.V1', info='PLATHO.CONV.RATCHET.V1'‖uint32BE(epoch))`. O(1) для любой эпохи (нужно для чтения истории после reinstall). FS-модель честная: только изоляция K_epoch друг от друга; утечка K_root ⇒ весь граф маршрутов пары (осознанный trade-off recoverability↔FS по D2). Double-ratchet ОТЛОЖЕН.
**bucketKey (D7 направленный):** keyId=сырые 32Б (base64urlDecode). compare32 big-endian: lo=min, hi=max. dir_byte: 0x00=lo→hi, 0x01=hi→lo; исходящий dir_out=(self==lo?0x00:0x01), входящий dir_in инвертирован. epoch=floor(header1.createdAtSec/86400) из ВЛОЖЕННОГО createdAt (не now). `bucketKey = HKDF(K_epoch, salt='PLATHO.CONV.BUCKET.SALT.V1', info='PLATHO.CONV.BUCKET.V1'‖dir_byte‖uint32BE(epoch))[:32]` → RAW в CONV header0@64..320. Приём: окно W baseline=2 суток [epoch_now-W..epoch_now], W чисто клиентский (тюнится post-genesis). Обе стороны СТРОЯТ keyId по ОДНОМУ гибридному Vault-бандлу — заморожённый аудит-инвариант (расхождение lo/hi → тихая потеря). Клиентский санити-бонд `header1.createdAt≈now` (иначе бэкдейт толкает бакет вне окна получателя).

## 10. INTRO-хендшейк (D4)
A: fetch аутентифицированного Vault-бандла B; r=random32, R=r·G, e=X25519(r,B.scan_pub), view_tag=`deriveStealthViewTagForRecipient` (существующий примитив, platho-crypto.mjs:231, НЕ трогать). header0 publishKind=3: meta+R+view_tag, author_wallet=SENTINEL (клиент). Тело = гибрид-конверт к B (та же r → body-эфемера E=R): identity-секция + крипто-бандл A (keyId_A + A.enc_x25519_pub) + kroot-секция (ct_root ГЕНУИННОЙ инкапсуляции) + introNonce(16Б) + опц. первое сообщение. ed25519-подпись A над ПОЛНЫМ транскриптом `'PLATHO.INTRO.TRANSCRIPT.V1'‖keyId_A‖keyId_B‖R‖sha256(body_KEM_ct)‖sha256(ct_root)‖view_tag_BE‖introNonce`, кладётся ВНУТРЬ шифр-тела (verify ПОСЛЕ decrypt).
B (строгий порядок, header0 до decrypt НЕ доверять): bulk get_intro_scan_page → e'=X25519(scan_sec,R), tag'==view_tag кандидат → полный decrypt (X25519(B.enc_sec,E)+ML-KEM decaps) → парс identity/бандл → VERIFY подписи над реконструированным транскриптом → привязка keyId_A/sign_pub/enc_pub к ЖИВОМУ Vault KeyRecord → anti-replay дедуп по introNonce (per-sender) → decapsulate(ct_root)→mlkem_ss, DH_ss → K_root → персист {keyId_A, wallet, kr, anchorEpoch} локально + PREFS-синк. Дальше CONV O(1), скан контакта прекращается.

## 11. scan-ключ из сида — ОБЯЗАТЕЛЬНЫЙ ФИКС до genesis (подтверждён в коде)
`platho-wallet.mjs:340` зовёт `createMessagingIdentity({ encryptionKeyPair, signingSecretKey })` БЕЗ scanSecretKey → fallback `randomBytes(32)` (platho-crypto.mjs:1815). scan_pubkey рекламируется в bundle и регистрируется в Vault → расходится с зарегистрированным УЖЕ между сессиями → ни один intro не примется. ФИКС (L321-340): `const scanSecretKey = await hkdfBytes(wallet.seed, 'messaging.hybrid-v1.scan.x25519', 32);` + прокинуть в `createMessagingIdentity({ encryptionKeyPair, signingSecretKey, scanSecretKey })`. info-строка `'messaging.hybrid-v1.scan.x25519'` ЗАМОРОЗИТЬ (смена осиротит все опубликованные scan_pubkey). info-only-сепарация при общей соли — существующая практика проекта (siblings x25519/ed25519/ml-kem768), RFC5869 допускает; пометить для аудита.

## 12. D2 K_root recovery — self-PREFS лейн ПИНИТСЯ (закрытие bootstrap-цикла)
Восстановление держится на self-encrypted PREFS-капсуле, хранящей ВСЕ per-contact K_root. Проблема (integ check #3 fail + availability blockers #1/#3): в гибриде scan-геттеры над private_entries удалены, sender_key_id выброшен из CONV → (а) sender-recovery-открытие prefs (platho-crypto.mjs:1482, keyed на senderKeyId) для CONV ЛОМАЕТСЯ; (б) genuine-ML-KEM делает K_root_self невосстановимым из сида, ct_root для self лежал бы в самой же капсуле → ЦИКЛ; (в) окно W=2 не находит месячный keep-alive снапшот.
**РЕШЕНИЕ (закрыто дизайном):**
1. **SELF-пара обходит genuine-KEM.** self=self не даёт граф-приватности, PQ там нечего терять. `K_root_self = HKDF-SHA256(seed, salt='PLATHO.CONV.ROOT.SELF.SALT.V1', info='PLATHO.CONV.ROOT.SELF.V1')` ДЕТЕРМИНИРОВАННО из мнемоника. Заморозить info-строку.
2. **self-bucketKey EPOCH-НЕЗАВИСИМ:** для self-recovery info использует epoch-сентинел 0 (фиксированный): `bucketKey_self = HKDF(K_epoch_self0, info='PLATHO.CONV.BUCKET.V1'‖0x00‖uint32BE(0))`. PREFS находится ОДНИМ lookup независимо от давности последнего re-publish (закрывает W=2-узость).
3. **Ретрив prefs ПЕРЕПИСАТЬ** с удалённого recipient-index/scan-walk (app.js:9737) на bucket-scan self-ключа через get_private_bucket_index_batch + backward-walk bucket_prev_link. Открытие — recipient-ветка на своих секретах (не sender-recovery-путь).
4. **contacts merge = UNION по peerKeyId** (НЕ whole-snapshot latest-wins clobber): локально-известный K_root НИКОГДА не удаляется из-за более старого remote-снапшота; удаление только явным tombstone-флагом. Отделить merge контактов от latest-wins скаляр-префов.
5. **Восстановление contacts/K_root — АДДИТИВНО и БЕЗУСЛОВНО** (модель restoreKnownUsernamesFromSnapshot, app.js:9758), отдельно от subscription-auto-apply гейта (app.js:9753), иначе reinstall с непустыми local follows не подтянет K_root.
6. **Пагинация contacts** на несколько latest-wins снапшотов по page-index (клиент-only): single-snapshot жёстко ограничен PREFS_TOO_LARGE (~200-300 контактов при {k,w,kr,a,ts}≈120-160Б), проект таргетит сотни контактов. Baseline — пагинация, НЕ single.
A персистит K_root СРАЗУ на отправке intro; B — сразу после accept. Оба пишут в свою PREFS-капсулу + периодический keep-alive re-publish + re-publish на каждый новый контакт.
**Остаётся open (см. blockers_remaining): durability recovery-стора против FIFO-эвикции (retention 1 год) — это ГЕНЕЗИС-immutable параметр, требующий owner-ратификации отдельного пула.**

## Учтённые within_boundary находки red-team (folded)
- first_publisher_key НЕ в геттере (§5, §8) — crypto major.
- self-lane pinning закрывает bootstrap-цикл (§12) — crypto/availability blocker.
- key-privacy (ANO-CCA) конверта тела = НЕСУЩИЙ гейт → обязательный внешний аудит (§13 impl audit) — crypto major.
- r-reuse: заморозить инвариант независимости ML-KEM-случайности от r/DH_ss + conformance — crypto minor.
- indexStorageReserve += intro (§7) — contract blocker.
- gas-mirroring 3 kind + G8 combo (§7) — contract blocker.
- INTRO_SWEEP_CAP декуплирован от part_count (§6) — contract major.
- RJ_BUCKET_PUBLISHER conformance + bounce-refund тест — contract major.
- G2 три header0-шейпа без остаточного 592 (§3) — contract major.
- endowment re-measure worst-case fresh-bucket-per-entry (§7) — contract major.
- D1 INTRO sentinel = client-only, без Vault-ветки (§2) — contract minor.
- UNION merge + additive restore + pagination + scan-key-from-seed (§11,§12) — availability majors.
- view_tag НЕ классический оракул — зафиксировано как не-находка.

---

# ПЛАН РЕАЛИЗАЦИИ

# План реализации clean-16 гибрид — tests-first, пофайлово

## Фаза 0. Заморозка инвариантов + conformance-скелет (ДО любого контракт-кода)
Заморозить как аудит-критичные строки/значения (conformance-тесты пишутся ПЕРВЫМИ, красные):
- info/salt: `PLATHO.CONV.ROOT.{SALT.,}V1`, `PLATHO.CONV.RATCHET.{SALT.,}V1`, `PLATHO.CONV.BUCKET.{SALT.,}V1`, `PLATHO.CONV.ROOT.SELF.{SALT.,}V1`, `PLATHO.INTRO.TRANSCRIPT.V1`, `messaging.hybrid-v1.scan.x25519`.
- header0-шейпы: PUBLIC 576 / CONV 320 / INTRO 336. Пины `BUCKET_BATCH_MAX_KEYS=32`, `INTRO_SWEEP_CAP=4`, `ENTRY_UID_DOMAIN_VAULT_INTRO=0xD1190203`, коды 13531/13543/13544, W=2.
- Деривация bucketKey/K_root/K_epoch (сырые 32Б keyId, dir 0x00=lo→hi, epoch_u32_BE), lo/hi по compare32.

## Фаза 1. КЛИЕНТ-крипто (изолированно, самый дешёвый feedback)
Файлы: `web/platho-wallet.mjs`, `web/crypto/platho-crypto.mjs`.
1. **scan-key-from-seed фикс** (platho-wallet.mjs:321-340): добавить scanSecretKey=hkdfBytes(...,'messaging.hybrid-v1.scan.x25519',32) + прокинуть. Тесты: (а) один мнемоник → две деривации → идентичный scanPublicKey; (б) advertised scanPublicKey == Vault scan_pubkey. **Красные ДО фикса.**
2. **K_root/K_epoch/bucketKey деривация** — новый модуль (напр. `web/crypto/conv-routing.mjs`): computeConvKRoot (genuine ML-KEM encapsulate/decapsulate), computeKEpoch, computeBucketKey (dir/epoch), compare32/lo-hi. Тесты: A.encapsulate ↔ B.decapsulate → идентичный mlkem_ss → идентичный K_root; direction-инвариант (dir_out одной стороны == dir_in другой); epoch из header1.createdAt; conformance-вектора.
3. **Доменная сепарация** conformance: kroot-KEM ct_root != body_KEM_ct, ss_root независим от ss_body; coin ML-KEM НЕ выводится из r/DH_ss (assert). §5 мёртв — grep тестов/кода на дерандомизацию.
4. **self-lane** (conv-routing + prefs): K_root_self из сида, self-bucketKey epoch-сентинел 0. Тест: reinstall из мнемоника → self-bucketKey совпадает без локального стора.
5. **INTRO-хендшейк** (platho-crypto.mjs): build/parse intro-тела (identity+бандл+kroot-секция+introNonce), transcript-подпись, verify-after-decrypt, anti-replay дедуп. Тесты: happy-path A→B→K_root; tamper (R/view_tag/ct подмена) → verify fail; replay → игнор.

## Фаза 2. КЛИЕНТ-приложение (prefs/recovery/retrieve)
Файлы: `web/app.js`.
1. Расширить buildPrefsSnapshot (app.js:9653) секцией contacts [{k,w,kr,a,ts}]; сериализация/шифр self-конвертом.
2. **UNION-merge contacts** по peerKeyId (отдельно от latest-wins скаляров); tombstone-удаление. Тест межустройственной гонки: A+X, B+Y → итог содержит оба.
3. **Аддитивное безусловное восстановление** contacts/K_root (модель restoreKnownUsernamesFromSnapshot, отдельно от drainRestoredPrefsSnapshots гейта L9753). Тест: reinstall с непустыми local follows подтягивает K_root.
4. **Пагинация** contacts по page-index. Тест: 500 контактов round-trip без PREFS_TOO_LARGE.
5. **Переписать ретрив prefs** (L9737) с recipient-index/scan-walk на self-bucket-scan. Тест: reinstall из мнемоника → prefs найдена → все K_root восстановлены (закрытие bootstrap-цикла).
6. CONV send/receive: computeBucketKey в header0-сериализацию (см. Фаза 3 клиент-часть), окно W чтение через batch-геттер + decoy + ротация эндпойнтов.
7. INTRO send: author_wallet=SENTINEL (клиент), publishKind=3.

## Фаза 3. Клиент↔контракт бинарная граница
Файл: `web/crypto/platho-crypto.mjs` (privateCapsuleHeader0Bytes:2299).
- Раздвоить на convCapsuleHeader0Bytes(40Б: meta+bucketKey) / introCapsuleHeader0Bytes(42Б: meta+R+view_tag). Два НОВЫХ бинарных пина `PLATHO_BINARY_HEADER0_BYTES_CONV=40`/`_INTRO=42` вместо PLATHO_BINARY_HEADER0_BYTES. Тест: длины 320/336 бит точны; экстракторы контракта над теми же байтами дают bucketKey/R/view_tag.

## Фаза 4. КОНТРАКТ (Tact) — tests-first по каждому пункту
Файлы: `CapsuleHub.tact`, `Vault.tact`.
1. **Пины/шейпы** (§3): удалить 592, ввести CONV 320/INTRO 336 в обоих контрактах; requireExactPayloadCell раздвоить; isConv/isIntroCapsuleShapeValid. Тест fail-closed: 336 в CONV-ветке→13514, 320 в INTRO→INTRO-код.
2. **publish_kind разводка** (§4): ENTRY_KIND_INTRO/PUBLISH_KIND_INTRO, kind-гейты, 3-way walk (Vault) + receive (Hub), intro id-пространство.
3. **bucket-индекс** (§5): PrivateCapsuleKeyIndex{+first_publisher_key}, pushPrivateBucketIndex + 13531, bucket_prev_link, prunePrivateBucketIndex. Тесты: (а) повторный push тем же wallet проходит, entry_count++/prev_link цепляется; (б) чужой wallet в бакет → 13531 → bounce → refund callValue (точная сумма); (в) многочастный CONV-батч в один bucketKey одним wallet НЕ триггерит 13531.
4. **intro-пул + D5** (§6): intro_entries/триплет, evictExpiredIntro capped INTRO_SWEEP_CAP, безусловный intro-sweep на всех kind. Тест: высокообъёмный CONV/PUBLIC подметает intro-хвост; только что добавленные intro не тронуты; sweep догоняет max inflow.
5. **Геттеры** (§8): get_private_bucket_index (БЕЗ first_publisher_key), get_private_bucket_index_batch (cap 32), get_intro_scan_*; удалить get_private_scan_*/get_private_sender_index; get_state += intro-счётчики. Тест: batch-геттер возвращает по uint16-индексу, cap игнорит лишнее; PrivateBucketIndexView НЕ содержит first_publisher.
6. **Cleanup**: private_sender_index/sender_prev_link/pushPrivateSenderIndex/prunePrivateSenderIndex/get_private_sender_index удалить; privateHeaderEphemeralScanPub/ViewTag над private → intro.

## Фаза 5. Газ/сторидж калибровка (GAS-GATE-G8) — БЛОКИРУЕТ seal
1. `indexStorageReserve()` += intro_live_count*introIndexStorageReservePerEntry(); protectedReserve растёт на ТРИ пула. Тест: SweepExcessReserve/FlushFees НЕ опускают баланс ниже суммы трёх пулов.
2. Пере-измерить CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT под worst-case «fresh-bucket-per-entry batch» (+256 бит). Ввести INTRO endowment/STORAGE_RESERVE_INTRO.
3. HUB_PART_GAS_* по трём kind, ЗЕРКАЛО Hub↔Vault одним генератором (G2); batchHubPartGas/batchVaultPartGas/VAULT_PART_GAS_INTRO. Тест недодержания на 1 газ-юнит → детерминированный 13530-bounce-refund.
4. **G8 combo worst-case ОТДЕЛЬНО по трём kind:** PUBLIC 8×32K + intro-sweep, CONV 8×32K + intro-sweep, INTRO 8×32K. canonicalTotal(Vault:2294) покрывает INTRO; BATCH_FLOOR kind-независим (проверить).

## Фаза 6. Gate G2 генератор
Один генератор ре-пинит из компилированного ABI: три header0-шейпа (576/320/336), HUB_PART_GAS_* по трём kind, зеркало Hub↔Vault, assert БЕЗ остаточного 592. Красный тест если где-то 592 или рассинхрон.

## Фаза 7. Регрессия + полный прогон
`npm test` (vitest.all.config.ts, single-worker — НЕ bare vitest). Проверить не сломаны: ReceiveIntent (commitment-only, НЕ трогать), балансы, батч-заряд/возврат, bounced-путь, PUBLIC-лейн, subscription-sync.

## Чек-лист ВНЕШНЕГО крипто-аудита (ОБЯЗАТЕЛЕН до ceremony)
1. **Key-privacy / ANO-CCA гибридного конверта тела** (НЕСУЩИЙ гейт): пассивный наблюдатель, знающий все публичные enc/mlkem-ключи, НЕ должен по body_KEM_ct в клиртексте отличить получателя. noble-ML-KEM не заявляет key-privacy из коробки — если не даёт, добавить key-blinding/обёртку KEM-ct ДО immutable, иначе цель провалена независимо от контракта.
2. **PQ-граф-приватность CONV**: подтвердить, что genuine-инкапсуляция (не §5) реально даёт PQ; ss_root независим от ss_body; coin ML-KEM не выводим из любого DH.
3. **Доменная сепарация**: mlkem_ss_det(K_root) vs ML-KEM ss(body); все salt/info изолированы; ct_root != body_KEM_ct.
4. **INTRO transcript-подпись** покрывает оба keyId (анти-UKS/misbinding), обе KEM-инкапсуляции, view_tag, nonce; verify-after-decrypt; anti-replay.
5. **Концентрация графа в PREFS-капсуле**: self-снапшот держит ВСЕ K_root в одном PQ-блобе → его key-privacy failure = тотальная утечка. Отдельный аудит-пункт.
6. **info-only сепарация при общей соли** (scan/x25519/ed25519/ml-kem) — RFC5869-корректность.
7. Immutable-необратимость каждого пина; корректность bounce-refund всех новых throw-путей (13530/13531).

---

# RED-TEAM НАХОДКИ (детально)

## Линза: КРИПТО-ДЕАНОН (разрыв recipient-index скрейпера) (verdict=sound-with-fixes)

**1) [major] first_publisher_key = hash(wallet) обратим и ЭКСПОНИРУЕТСЯ геттером — возвращает on-chain sender-метку на КАЖДЫЙ бакет + оценку out-degree по количеству бакетов с одним first_publisher.**

publicAuthorKeyId(w)=beginCell().storeAddress(w).endCell().hash() (CapsuleHub:573) — не соль, не HMAC. Все кошельки перечислимы (публичный ончейн-реестр), значит скрейпер строит таблицу hash(storeAddress(w))→w и обращает first_publisher для ЛЮБОГО бакета из get_private_bucket_index / стейт-дампа БЕЗ ноды, БЕЗ тайминга, из ОДНОГО снапшота. Recipient не раскрывается (bucketKey непрозрачен), поэтому цель «кто-кому/recipient» НЕ ломается — это в границе принятого sender-residual. НО есть заострение: в отличие от текущего single-key private_sender_index (один keyId→одна цепочка = только суммарный объём), гибрид раскидывает исходящие по многим бакетам (per-partner×epoch×dir); число различных бакетов с общим first_publisher ≈ КАРДИНАЛЬНОСТЬ собеседников (out-degree cardinality) — более гранулярная утечка формы соц-графа, чем сегодня. И это ИЗБЫТОЧНО: для D7-энфорсмента first_publisher нужен только на push-сравнение внутри контракта, геттеру его отдавать не требуется.

_FIX:_ (1) Убрать first_publisher_key из PrivateBucketIndexView (и из get_private_bucket_index_batch) — хранить только во внутреннем PrivateCapsuleKeyIndex для сравнения при push; это снимает дешёвую геттер-жатву, оставляя лишь дорогой стейт-дамп. (2) Серьёзно рассмотреть ОТКАЗ от контрактного D7 (first_publisher целиком) в пользу чисто клиентской направленности: тогда CONV-бакет в стейте не несёт НИКАКОЙ sender-метки — строго ЛУЧШЕ и текущего pure-stealth (где sender_key_id открыт), и предлагаемого гибрида. Цена D7 (защита от собственного багнутого клиента, создающего двунаправленную коллизию, которая и так линкуется лишь таймингом) не окупает постоянную on-chain sender-атрибуцию на immutable.

**2) [blocker] D2: восстановление K_root циклично — генуинная ML-KEM делает K_root_self невосстановимым из сида, а ct_root для self лежал бы в САМОЙ prefs-капсуле; плюс sender-recovery-open путь prefs ломается (scan-геттеры над private_entries удалены, sender_key_id выброшен из CONV).**

kroot_establishment МАНДАТИТ свежую случайность ML-KEM (иначе не PQ — верно). Значит K_root нельзя пересчитать из статиков — только ПЕРСИСТ через PREFS. Но PREFS-капсула сама публикуется как self-CONV (sender==recipient). Чтобы найти/открыть её после переустановки с нуля, нужен self-bucketKey и self-K_root, который по той же логике невосстановим из сида без ct_root, а ct_root для self сидел бы внутри этой же капсулы = ЦИКЛ. Дополнительно: crypto.mjs:1590 sender-recovery-open keyed на senderKeyId, которого в CONV header0 больше нет; app.js:9737 ретрив висит на удалённом recipient-index walk. На immutable недостижимая prefs-капсула = потеря K_root = потеря ВСЕЙ переписки НАВСЕГДА. Это state-safety блокер (отсюда funds_state_safe=false).

_FIX:_ Явно запинить self-prefs-лейн, НЕ использующий genuine-KEM: self-паре граф-приватность не нужна (self=self), поэтому self-bucketKey = HKDF(seed-производный K_root_self, ...) ЧИСТО из сида (обходя ML-KEM для self-пары) — тогда prefs находится/открывается детерминированно из мнемоника. Альтернатива: возить prefs по INTRO-стелс-лейну с seed-детерминированным scan-ключом. Переписать ретрив prefs с recipient-index walk на выбранный лейн. Заморозить conformance-тест «переустановка из мнемоника → prefs найдена → все K_root восстановлены».

**3) [major] ГЕЙТ: recipient-приватность CONV/INTRO сводится ЦЕЛИКОМ к key-privacy (ANO-CCA) конверта тела (KEM-ct в открытом виде) — opacity bucketKey НЕОБХОДИМА, но НЕ достаточна.**

Каждая гибрид-капсула несёт body_KEM_ct в клиртексте (нужен для decaps). Если ML-KEM/X25519-конверт НЕ key-private, скрейпер читает body_KEM_ct из хранимых тел и тестирует против публичных mlKem768_pub всех зарегистрированных → деанон ПОЛУЧАТЕЛЯ напрямую, В ОБХОД непрозрачного bucketKey. noble ml-kem не заявляет анонимность/key-privacy из коробки (key-privacy Kyber/ML-KEM — отдельный исследовательский результат с оговорками про implicit-rejection и pk-binding). Это и есть задокументированный «ГЕЙТ всей приватности» — подтверждаю, что он несущий: без него весь редизайн bucketKey косметичен для recipient-дименжна.

_FIX:_ ОБЯЗАТЕЛЬНЫЙ внешний крипто-аудит key-privacy (ANO-CCA) гибридного конверта тела ДО ceremony, с явной моделью: пассивный наблюдатель, знающий все публичные enc/mlkem-ключи, не должен отличать получателя капсулы. Если noble-ML-KEM не даёт key-privacy — добавить key-blinding/анонимизирующую обёртку KEM-ct до immutable, иначе цель провалена независимо от контракта.

**4) [minor] D4: один эфемерал r переиспользуется под body-эфемеру E=R, view_tag-ECDH и discovery-R — безопасно классически, но требует ЗАМОРОЗКИ инварианта независимости ML-KEM-случайности от r.**

Переиспользование r в трёх DH-контекстах с разными peer-ключами классически безопасно (DH односторонен, разные пиры). Реальный риск — регресс к отклонённому §5: если БУДУЩИЙ рефактор засеет coin ML-KEM-инкапсуляций (body или kroot) из r/DH_ss, ML-KEM-вклад коллапсирует к стойкости X25519 (ss=HASH512(m‖HASH256(pk)) публична от (coin,pk)) → CONV перестаёт быть PQ-граф-приватным, а S_scan/статики открыты в Vault → квантовый деанон. Сейчас код использует genuine encapsulate — верно, но это не заморожено.

_FIX:_ Заморозить аудит-инвариант + тест: kroot-KEM и body-KEM используют НЕЗАВИСИМУЮ свежую случайность, НЕ производную от r/DH_ss; ct_root != body_KEM_ct; ss_root независим от ss_body. Ассертить в conformance, что coin ML-KEM не выводится ни из какого DH.

**5) [minor] intro view_tag 16-бит — проверено, НЕ является классическим оракулом деанона (не блокер, фиксирую как не-находку).**

Тест «адресована ли intro получателю U» требует HKDF(X25519(r,S_U),R): скрейпер имеет R=r·G и S_U=s_U·G, но не r и не s_U → CDH-задача, классически стойка. 16 бит дают лишь ложноположительные при СОБСТВЕННОМ скане получателя (~1/65536, доп. decrypt), а не оракул для внешнего. Квантово (Shor по S_scan) — деанон первого контакта, но это ПРИНЯТЫЙ residual, локализованный ребром первого контакта; CONV PQ.

_FIX:_ Действий не требуется; оставить как задокументированный квантовый residual знакомств + версионный хук под PQ-discovery. Не засчитывать как блокер.

## Линза: Контракт-безопасность immutable genesis (verdict=sound-with-fixes)

**1) [blocker] indexStorageReserve() не учитывает intro-пул → sweepable средства, реально бэкающие живой intro-сторидж (immutable дренаж)**

protectedReserve() (CapsuleHub:365-372) = accrued_plato_fee_ton + indexStorageReserve(), где indexStorageReserve() (L360-363) = private_live_count*perEntry + public_live_count*perEntry. И FlushFees (L972) и SweepExcessReserve (L1004-1006) гейтят вывод именно по protectedReserve(). Гибрид добавляет третий пул intro_entries с СВОИМ эндаументом, но если intro_live_count*(keepalive+introEndowment) НЕ добавить в indexStorageReserve(), то TON, эндауменнный под intro-сторидж, классифицируется как excess → владелец (или любой вызов SweepExcessReserve) выведет средства, которые обязаны держать intro-записи их retention-год. На immutable = необратимый медленный дренаж резерва Hub, intro-записи теряют бэкинг storage-fee → risk сбора Hub по storage. Это прямое НАРУШЕНИЕ funds-safety, а не только 'недофинанс'.

_FIX:_ Ввести introIndexStorageReservePerEntry() = CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT и добавить слагаемое intro_live_count*introIndexStorageReservePerEntry() в indexStorageReserve(). Conformance-тест G8: после N intro-паблишей protectedReserve() растёт на N*introPerEntry; SweepExcessReserve НЕ может опустить effectiveBalance ниже суммы всех трёх пулов.

**2) [blocker] D5 (безусловный intro-sweep на КАЖДОМ publish) требует поднять HUB_PART_GAS_PUBLIC/_PRIVATE И зеркалить в Vault batchHubPartGas; любой рассинхрон → Hub throw 13530 → bounce → permanent liveness-break на immutable**

D5 добавляет evictExpiredIntro(part_count) во все три kind. Значит CONV и PUBLIC теперь фондируют ДОП. intro-sweep-del. Vault держит hub-газ через getComputeFee(totalHubGas) где totalHubGas += batchHubPartGas(kind) (Vault:2245/2298), а Hub требует requiredValue += getComputeFee(HUB_PART_GAS_*) (CapsuleHub:866/922) и гейтит throwUnless(13530, context().value>=requiredValue) L929. Если поднять HUB_PART_GAS_PUBLIC в Hub, но забыть зеркалить HUB_PART_GAS_PUBLIC в Vault (L373) → Vault недодержит → 13530 → весь батч bounce. Средства пользователю возвращаются (bounce refund callValue — funds ок), НО КАЖДЫЙ public/conv-пабл得 этого размера навсегда падает. Худший комбо: PUBLIC 8×32K, эвиктящий И public-хвост И intro-хвост в одной tx — самый тяжёлый, обязателен G8 ОТДЕЛЬНО по трём kind + комбо.

_FIX:_ Зеркалить HUB_PART_GAS_* Hub↔Vault по трём kind в одном генераторе (gate G2). Прогнать GAS-GATE-G8 для PUBLIC-8×32K+intro-sweep, CONV-8×32K+intro-sweep, INTRO-8×32K раздельно, с измеренным intro-del-per-part. Пин каждого HUB_PART_GAS_* >= measured. Conformance: недодержанный на 1 газ-юнит batch → детерминированный 13530-bounce-refund тест.

**3) [major] D5 НЕОБРАТИМО связывает liveness высокообъёмной PUBLIC-полосы с оценкой стоимости intro-эвикции**

После seal HUB_PART_GAS_PUBLIC фиксирован навсегда. Он теперь включает стоимость intro-sweep-del (map-del + счётчик). Если эта стоимость недоизмерена (напр. intro map delete дороже под фрагментацией, или будущий рост intro-пула меняет газ-профиль del), КАЖДЫЙ публичный пост — самая частая операция — недофинансирован НАВСЕГДА, хотя сам public-путь корректен. Полоса с наибольшим трафиком становится заложником оценки эвикции наименее нагруженной полосы. Это архитектурная хрупкость, введённая именно D5.

_FIX:_ Оспорить связку part_count: вместо evictExpiredIntro(part_count) на каждом kind — ввести отдельный явный INTRO_SWEEP_PER_PART_GAS и/или ограничить sweep фиксированным малым капом INTRO_SWEEP_CAP (напр. 2), декуплированным от part_count, чтобы мис-оценка была локализована и не масштабировалась с размером public-батча. Заложить ЗАПАС в HUB_PART_GAS_PUBLIC явно под intro-del (не растворять в общем пине).

**4) [major] RJ_BUCKET_PUBLISHER (13531) вводит Hub-side content-throw для приватного батча — ломает инвариант 'Vault пре-валидирует всё, Hub не отвергает по содержимому' и бунсит ВЕСЬ батч**

Сейчас приватный путь: Vault пре-валидирует shape/hash/value (L2190-2255), Hub только повторяет форму+value — НИКОГДА не отвергает по семантике содержимого. first_publisher-энфорсмент (13531) — ПЕРВЫЙ Hub-side content-зависимый throw, который Vault НЕ может задетектить до форварда (индекса у него нет). Срабатывание бунсит все части батча (part 1-4 тоже теряются, реальная import-стоимость measuredImport+vaultCompute+hubFwd). Для честного клиента недостижимо (bucketKey опакостен; один-публикатор-на-направленный-бакет; мультидевайс=тот же wallet=passes), но путь необратимо добавлен и расширяет bounce-поверхность.

_FIX:_ Conformance-тест: доказать, что НИ ОДИН честный многочастный CONV-батч (в т.ч. несколько частей в один bucketKey одним wallet) не триггерит 13531. Отдельный тест bounce-refund пути 13531 (refundable_amount кредитуется, receipt корректен). Задокументировать, что клиентский баг dir_byte/K деградирует в full-batch-bounce (не тихий дроп) — это приемлемо, но должно быть явным аудит-инвариантом.

**5) [major] Форк header0-пинов CONV=320/INTRO=336 поверх ЖИВОГО 592-бит PH0C дерева — immutable-футган смешения трёх шейпов**

Дерево сейчас несёт единый CAPSULEHUB_PRIVATE_HEADER0_BITS=592 (CapsuleHub:35, Vault:78), а redesign — НОВЫЙ форк на 320/336 с зеркалом Hub↔Vault и раздвоением requireExactPayloadCell/isPrivateCapsuleShapeValid. Высокий риск на immutable-сборке оставить где-то 592, или рассинхронить Hub vs Vault, или спутать CONV/INTRO ветку. requireExactPayloadCell fail-closed (336-битный header0 в CONV-ветке → 13514), но только если КАЖДАЯ точка пина обновлена согласованно.

_FIX:_ Gate G2 обязан ассертить ТРИ header0-шейпа из компилированного ABI (public 576 / conv 320 / intro 336), Hub↔Vault зеркально, БЕЗ остаточного 592. Conformance fail-closed: 336-битный header0 в CONV-батче → 13514; 320-битный в INTRO-батче → его INTRO exit-код. Один генератор ре-пинит все три из ABI, assert на все три.

**6) [major] first_publisher_key (+256 бит в PrivateCapsuleKeyIndex) требует пере-измерения CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT=3.3M под worst-case 'один-entry-на-бакет'**

PrivateCapsuleKeyIndex растёт со 128 бит (latest_entry_link+entry_count) до 384 бит (+first_publisher_key u256). Слот бакета ШАРИТСЯ между записями, а эндаумент заряжается ПЕР-ЗАПИСЬ — при многих записях в бакете модель перефинансирована (безопасно). Но worst-case = каждая запись в СВОЙ свежий бакет (batch к разным эпохам/направлениям) → каждая запись создаёт свежий 384-бит слот. 3.3M мог стать недостаточным именно в этом случае. На immutable недофинанс = дренаж.

_FIX:_ Пере-измерить endowment под worst-case 'fresh-bucket-per-entry batch' (part_count различных bucketKey). Подтвердить, что CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT (или новое _CONV_) покрывает 2×header-cell + entry-скаляры + первый push нового 384-бит index-слота. Часть G8-пере-калибровки.

**7) [minor] D1 INTRO author_wallet=sentinel — чисто приватностная косметика, НЕ load-bearing для контракт-безопасности; не усложнять контракт ради неё**

Оспариваю рамку D1: для INTRO Hub не пушит индекс и не хранит author_wallet (IntroCapsuleEntry его нет), поле мёртвое. Vault forward L2352 сейчас безусловно шлёт msg.owner_wallet. Слать РЕАЛЬНЫЙ owner_wallet для INTRO БЕЗВРЕДНО для state/funds (924-пин держится любой Address, никакой индекс не задет). Отправитель и так виден в транзитной tx (принятый residual). Значит sentinel — приватностный нюанс, а НЕ контракт-требование, и добавлять ветку форварда в Vault ради него не обязательно для безопасности.

_FIX:_ Если sentinel нужен для чистоты хранимой капсулы — держать его КЛИЕНТСКИМ (клиент кладёт sentinel в author_wallet для INTRO, Hub поле игнорирует). НЕ вводить контрактную kind-ветку в Vault forward как safety-мера. Явно снять пункт из contract-safety чек-листа или пометить как privacy-only.

**8) [minor] Неточность в open_risks: конфликт бакета стоит НЕ 'полного import-worst-case floor', а measuredImport+vaultCompute+hubFwd**

open_risks[2] утверждает, что 13531-bounce стоит пользователю полный import-worst-case как reject-floor. Но 13531 — это Hub-throw→bounce, а не Vault-side RJ-reject. Bounce-хендлер (Vault:2636) кредитует refundable_amount=callValue, а не maxCharge-floor. Реальная потеря = maxCharge-callValue = measuredImport+vaultCompute+hubFwd (нормальная bounce-стоимость), НЕ пинованный floor. Для честного клиента путь недостижим, так что это только документная неточность.

_FIX:_ Исправить формулировку остатка: потеря при 13531 = реальный import+compute+hubFwd (bounce), покрыть тестом на точную возвращаемую сумму. Кода не требует.

## Линза: Доступность/Восстановление (D2 K_root recovery, D5 intro-эвикция, scan-ключ из с (verdict=flawed)

**1) [blocker] Бутстрап self-PREFS-капсулы не запинен + криптографический цикл: K_root_self через genuine ML-KEM невосстановим из сида, а ct_root лежит в самой же капсуле.**

D2-восстановление держится на self-encrypted PREFS-капсуле, хранящей ВСЕ K_root. В гибриде CONV header0 не несёт ни scan-полей, ни sender_key_id, а get_private_scan_* над private_entries удаляются. После reinstall клиент не может НАЙТИ свою PREFS-капсулу: чтобы вычислить её bucketKey нужен K_root_self; kroot_establishment мандатит genuine ML-KEM (свежая случайность), значит K_root_self невыводим из статиков без ct_root, а ct_root для self-пары хранился бы В САМОЙ prefs-капсуле → цикл. Открыть её после нахождения можно (recipient-ветка на своих секретах, platho-crypto.mjs:1596-1610), но открывать нечего — она не найдена. Проверено: sender-recovery ветка выбирается по hashes.senderKeyId (platho-crypto.mjs:1591), которого в CONV больше нет. Без явно запиненного seed-bootstrappable лейна D2 не стартует ⇒ на immutable потеря переписки НАВСЕГДА.

_FIX:_ Запинить SELF-лейн ДО genesis: для self-пары деривировать K_root_self = HKDF-SHA256(seed, 'PLATHO.CONV.ROOT.SELF.V1') ДЕТЕРМИНИРОВАННО, минуя genuine-KEM (self-беседа не даёт граф-приватности, PQ там не нужен — терять нечего). Тогда self-bucketKey seed-восстановим, PREFS находится через get_private_bucket_index_batch по self-ключам. Плюс переписать ретрив prefs с удалённого index/scan-walk на bucket-scan. Заморозить info-строку + conformance-тест: тот же сид на 2-м устройстве находит и открывает свою PREFS.

**2) [blocker] Необратимая потеря K_root при истечении retention: PREFS-капсула FIFO-эвиктится через 1 год, seed-дериватор даёт КЛЮЧ, но не БАЙТЫ капсулы.**

K_root пер-пары установлен genuine ML-KEM → НЕвосстановим никаким детерминизмом. Единственный durable стор — PREFS-капсула, но она живёт в том же пуле с 1-год retention + FIFO (fallback 're-scan живого хвоста intro-пула' тоже требует ЖИВОГО intro <1год). Даже с seed-восстановимым self-bucketKey (finding #1) reinstall после >retention даёт ПУСТОЙ бакет: ключ вычислен, капсула эвиктнута ⇒ список контактов и все peer-K_root потеряны НАВСЕГДА. Сценарий: пользователь неактивен >1 года, переустанавливает — теряет весь граф маршрутов и возможность читать любую старую переписку. 'Редко при регулярном re-publish' предполагает, что приложение периодически запускается; долгий офлайн этого не гарантирует. На immutable необратимо.

_FIX:_ Genesis-решение (требует ратификации владельцем ДО ceremony): выделить PREFS/recovery-лейну ОТДЕЛЬНЫЙ пул с СУЩЕСТВЕННО большим (или неистекающим) retention, ЛИБО хранить контакт-стор/K_root вне FIFO-эвиктируемого пула (напр. в неэвиктируемом Vault-поле на владельца). Retention пула вшивается в genesis — это НЕ тюнится постфактум. Если оставляем 1-год FIFO — явно задокументировать как принятую необратимую потерю и предупреждать пользователя.

**3) [blocker] Окно восстановления W=2 эпохи слишком узкое, чтобы найти self-PREFS периодической (ежемесячной) кадансности после reinstall.**

bucketkey_derivation применяет epoch=floor(createdAt/86400) РАВНОМЕРНО, включая self-PREFS. keep-alive re-publish предложен ежемесячным. На reinstall клиент сканирует self-bucketKey за окно [epoch_now-W..epoch_now], baseline W=2 (сутки), настроенное под latency доставки сообщений. Последний PREFS-снапшот при месячном кадансе лежит в epoch now-20..now-30 — ВНЕ окна W=2 ⇒ НЕ НАЙДЕН, хотя капсула ЖИВА. backward-walk по bucket_prev_link не спасает: нет anchor-записи в окне, чтобы начать walk. Восстановление тихо проваливается на живых данных.

_FIX:_ Для self-recovery-лейна использовать ФИКСИРОВАННЫЙ, epoch-НЕзависимый bucketKey (напр. epoch-сентинел 0 в info деривации self-root), чтобы PREFS находилась одним lookup независимо от давности последнего re-publish. Альтернатива хуже: широкий backward-скан до retention (до 365 ключей) через несколько get_private_bucket_index_batch (BUCKET_BATCH_MAX_KEYS=32). Запинить стратегию + тест: PREFS, опубликованная N дней назад (N до retention), находится после reinstall.

**4) [major] Слияние contacts обязано быть UNION по peerKeyId; текущая PREFS-модель — whole-snapshot latest-wins, которая КЛОББЕРИТ контакты между устройствами.**

Проверено: drainRestoredPrefsSnapshots (app.js:9746-9755) берёт НОВЕЙШИЙ снапшот по writtenAt и applyPrefsSnapshot (9699) заменяет состояние ЦЕЛИКОМ. Если устройство A офлайн добавляет контакт X (K_root_X), а устройство B позже сохраняет свой снапшот БЕЗ X — B-снапшот новее и затирает A ⇒ K_root_X потерян ⇒ беседа с X необратимо недоступна на immutable. Дизайн ЗНАЕТ (говорит UNION по peerKeyId, никогда не удалять по более старому remote), но это НЕреализовано, а baseline-механика — whole-replace.

_FIX:_ Реализовать per-contact UNION-слияние ДО genesis: contacts мержатся по peerKeyId (per-contact latest ts для метаданных), локально-известный K_root НИКОГДА не удаляется из-за более старого remote-снапшота; удаление только через явный tombstone. Отделить merge контактов от latest-wins скаляр-префов. Тест на межустройственную гонку: A+X, B+Y, оба сейва → итог содержит и X, и Y.

**5) [major] Одно-частный жёсткий кап PREFS (PREFS_TOO_LARGE) ограничивает восстановимый контакт-стор ~200-450 контактами; 'тысячи' завышены.**

Проверено: createPrivatePrefsCapsules (app.js:30440) БРОСАЕТ PREFS_TOO_LARGE при totalParts>1 — снапшот структурно ОБЯЗАН влезть в ОДНУ часть. Макс size-class = 32768 useful (platho-crypto.mjs:39), минус identity(68B)+sender-recovery(64B)+overhead, И этот бюджет делится с секцией subscriptions. Реалистичный JSON-контакт {k,w,kr,a,ts} ≈ 120-160Б ⇒ ~200-300 контактов потолок, не 'тысячи'. При превышении K_root НЕ персистится ВООБЩЕ (весь блоб — один снапшот) ⇒ у активного пользователя с сотнями бесед граф маршрутов тихо перестаёт сохраняться ⇒ на reinstall потеря. Цель проекта — десятки тысяч пользователей, сотни контактов реалистичны.

_FIX:_ Реализовать пагинацию contacts на несколько latest-wins снапшотов по page-index ДО массового роста (клиент-only, вне genesis-заморозки, т.к. лейн находится тем же bucket-scan). Не оставлять baseline single-snapshot. Тест: 500 контактов сериализуются/восстанавливаются без PREFS_TOO_LARGE.

**6) [major] Фикс scan-ключа из сида ОБЯЗАТЕЛЕН и корректен: сейчас scan-ключ случаен на КАЖДЫЙ вызов — ломает intro не только на reinstall, но и между сессиями на ТОМ ЖЕ устройстве.**

Проверено: deriveMessagingIdentityFromWallet (platho-wallet.mjs:340) зовёт createMessagingIdentity БЕЗ scanSecretKey → fallback randomBytes (platho-crypto.mjs:1815). scanPublicKey рекламируется в bundle (1846) и регистрируется в Vault KeyRecord. x25519/ed25519/mlkem — seed-HKDF (детерминированы), но scan — random КАЖДЫЙ вызов. Если identity деривируется на каждый загруз приложения, scan_pubkey расходится с зарегистрированным в Vault уже между сессиями ⇒ view_tag не совпадёт ⇒ ни один intro не примется, а не только после reinstall. 2-е устройство/reinstall гарантированно не примет intro.

_FIX:_ Применить предложенный фикс: scanSecretKey = await hkdfBytes(wallet.seed, 'messaging.hybrid-v1.scan.x25519', 32) и прокинуть в createMessagingIdentity({..., scanSecretKey}) (platho-wallet.mjs:340). ЗАМОРОЗИТЬ info-строку до genesis (её смена осиротит все опубликованные scan_pubkey) + conformance-тесты: (1) один мнемоник, две деривации → идентичный scanPublicKey; (2) advertised scanPublicKey == Vault scan_pubkey.

**7) [major] Гейт авто-применения PREFS (только 'свежее устройство') заблокирует восстановление K_root на любом НЕ-свежем reinstall.**

Проверено: drainRestoredPrefsSnapshots (app.js:9753) авто-применяет снапшот ТОЛЬКО при prefsLastSyncedAt===null && !prefsDirty && !hasLocalFollows — консервативный гейт для SUBSCRIPTIONS (не клоббнуть локальные правки). Применённый к контакт/K_root-стору тот же гейт НЕ восстановит K_root, если у reinstall-устройства есть хоть какие-то локальные follows или dirty-флаг ⇒ K_root не подгрузится ⇒ беседы нечитаемы, хотя капсула найдена и открыта. Восстановление .ath-имён (restoreKnownUsernamesFromSnapshot, 9758) уже сделано БЕЗУСЛОВНО-аддитивным — контакты должны следовать этой модели, не subscriptions-гейту.

_FIX:_ Восстанавливать contacts/K_root АДДИТИВНО и БЕЗУСЛОВНО (модель restoreKnownUsernamesFromSnapshot), отдельно от subscription-auto-apply гейта. K_root — union, никогда не клоббер локального. Тест: reinstall с непустыми local follows всё равно подтягивает peer-K_root.

**8) [minor] Ротация messaging-ключей (ReplaceMessagingKeys) меняет keyId и scan_pubkey → инвалидирует K_root/bucketKey/dir mid-conversation + делает старые intro нескан-восстановимыми; триггер ре-intro/восстановления не описан.**

ReplaceMessagingKeys уже в контракте. Смена гибридного keyId меняет lo/hi и K_root-деривацию ⇒ существующие bucketKey перестают совпадать у сторон, беседа тихо промахивается. Старые intro-капсулы адресованы прежнему scan_pubkey — новый scan-секрет их не рескан. С точки зрения восстановления: после ротации даже валидный seed не восстановит доступ к до-ротационным беседам без явной логики. Частично вне заявленного раунда (скрейпер), но прямо влияет на доступность.

_FIX:_ Определить поведение при ротации ДО genesis: триггер ре-intro/переустановления K_root при смене ключей у любой стороны, и сохранение СТАРЫХ K_root/scan-секретов в контакт-сторе (versioned per keyId), чтобы до-ротационная история оставалась читаемой. Задокументировать как аудит-инвариант + тест на ротацию mid-conversation.


---

# ИНТЕГРАЦИЯ — проверки связности

- [OK] (1) header0 биты CONV/INTRO в контракте == сериализация клиента — Дизайн внутренне связен: CONV=320 (meta64+bucketKey256), INTRO=336 (meta64+R256+viewTag16). Контрактные экстракторы точны: CONV loadUint(64)+loadUint(256)=320; INTRO 64+256+16=336. Клиентская раскладка совпадает (CONV @8..40=32B bucketKey; INTRO meta8+R@8..40+viewTag@40..42). НО это НЕреализованный план: дерево сейчас на ЕДИНОМ 592-бит PH0C (CapsuleHub.tact:35, Vault.tact:78), а privateCapsuleHeader0Bytes (platho-crypto.mjs:2299) всё ещё жёстко эмитит 74 байта с senderKeyId+ephemeralScanPub+viewTag и пином PLATHO_BINARY_HEADER0_BYTES. Требуется: раздвоить пин на _CONV=320/_INTRO=336 (зеркало Hub<->Vault), раздвоить privateCapsuleHeader0Bytes на conv(40B)/intro(42B) + два новых бинарных пина, gate G2 на три значения. requireExactPayloadCell/part.bits()==784/refs 3-4 не трогаются — совпадает с дизайном.
- [OK] (2) газ по 3 kind сходится с maxCharge/hubFwd-удержанием Vault — Структурно сходится. Ключевое: hubFwd авто-подстраивается — hubMsgBits=(measuredBits-1016)+HUB_BATCH_MSG_ROOT_BITS(924) (Vault:2281), а measuredBits через computeDataSize ВКЛЮЧАЕТ header0-ref (INTRO +16 бит/часть) — отдельная правка формулы не нужна; marketing +152 корректно ТОЛЬКО для PUBLIC (2282-2285); author_wallet остаётся fixed Address => 924 стабилен для всех kind. canonicalTotal (2294) складывает totalFee/totalHubGas(batchHubPartGas)/totalStorage(batchStorageReserve)/vaultCompute(batchVaultPartGas) — все берут kind, надо добавить INTRO-ветку в каждый. РИСК СХОДИМОСТИ (не структурный, калибровочный): D5-intro-sweep-на-КАЖДОМ-publish связывает Vault-hold PUBLIC/CONV с поднятыми HUB_PART_GAS_PUBLIC/_PRIVATE — если поднять Hub-константу и ЗАБЫТЬ зеркалить batchHubPartGas в Vault, hold недофинансирует Hub => throw 13530 => bounce => permanent liveness-break на immutable. Числа провизорны; ОБЯЗАТЕЛЕН G8 для комбо worst-case (PUBLIC 8x32K + подмётка intro-хвоста в той же tx). first_publisher +256б в PrivateCapsuleKeyIndex => пере-измерить CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT(3.3M); indexStorageReserve обязан добавить intro_live_count*introEndowment.
- [FAIL] (3) K_root lifecycle: intro-установление -> CONV bucketKey -> reinstall -> PREFS-restore без потери переписки — РАЗРЫВ СВЯЗНОСТИ (крупнейший). D2-восстановление держится на PREFS-капсуле, хранящей ВСЕ K_root. Но сама PREFS-капсула публикуется как приватная капсула К СЕБЕ (createPrivatePrefsCapsules, app.js:30428-30467, recipientWallet=self, senderRecovery:true). В ГИБРИДЕ scan-геттеры над private_entries УДАЛЯЮТСЯ, а sender_key_id выброшен из CONV header0 => (а) путь sender-recovery-open (crypto.mjs:1590-1592, keyed на hashes.senderKeyId) для CONV ЛОМАЕТСЯ; (б) текущая ретрив-логика ссылается на УДАЛЁННЫЙ recipient-index walk (app.js:9737 коммент, prefsBytesFromOpenedCapsule). ЗАГРУЗ ИЗ СИДА: единственные seed-bootstrap-able лейны — INTRO (стелс-скан по seed-детерминированному scan-ключу) ЛИБО self-CONV-бакет с ДЕТЕРМИНИРОВАННЫМ-из-сида K_root_self. Но kroot_establishment МАНДАТИТ ГЕНУИННУЮ ML-KEM (свежая случайность, ct_root персистится) => K_root_self НЕвосстановим из сида без ct_root, а ct_root для self лежал бы в САМОЙ prefs-капсуле => ЦИКЛ. Дизайн НЕ пинит, каким лейном едет prefs-капсула и как она находится после reinstall с нуля. Без явного разрешения (prefs на INTRO-лейн ИЛИ детерминированный-из-сида self-CONV-бакет, минуя genuine-KEM для self-пары) D2-recovery не бутстрапится => на immutable потеря K_root = потеря переписки НАВСЕГДА.
- [OK] (4) epoch берётся из header1.createdAt согласованно клиент<->контракт — Пере-фрейминг: контракт НАМЕРЕННО не является party к epoch — bucketKey непрозрачен (map-ключ), контракт хранит created_at=now() (Hub-время) для эвикции, epoch не парсит. Реальная согласованность — ОТПРАВИТЕЛЬ<->ПОЛУЧАТЕЛЬ через header1.createdAt (поле есть: crypto.mjs:2335 uint32 createdAtSec), оба floor(sec/86400). АСИММЕТРИЯ: отправитель кладёт epoch из ВЛОЖЕННОГО createdAt; получатель НЕ читает createdAt (не может до нахождения бакета) — гадает epoch по НАСТЕННЫМ часам в окне [now-W..now], W=2 baseline. Сходится только внутри W. Дыры: (а) header1.createdAt НЕ ограничен on-chain => скьюнутый/бэкдейтнутый timestamp толкает бакет вне окна получателя => тихая потеря (self-inflicted для честного клиента, createdAt≈now — ОК); (б) получатель офлайн > W суток пропустит бакеты эпох, выпавших из окна (backward-walk bucket_prev_link спасает ВНУТРИ найденного бакета/эпохи, но не находит невидимые эпохи). W чисто клиентский/тюнимый — верно. Рекомендация: санити-бонд createdAt клиентом + документировать sender-embedded-epoch vs recipient-wallclock-window как аудит-инвариант.
- [OK] (5) ml_kem_ss доменно разделён body vs K_root — Разделено чисто. BODY: свежая ml_kem768.encapsulate(recipient.mlKem768PublicKey) (crypto.mjs:1517-1519), ключ через deriveAesGcmKeyFromTranscriptHash (MESSAGE-домен salt/info). K_root: ОТДЕЛЬНАЯ ГЕНУИННАЯ ml_kem768.encapsulate -> ct_root (1088Б) отдельной секцией intro-тела, независимая случайность/ct, HKDF salt='PLATHO.CONV.ROOT.SALT.V1'/info='...ROOT.V1'‖lo‖hi. Две независимые инкапсуляции => естественная доменная сепарация, нет verifiable cross-relation. ВАЖНО: клиентский дизайн ЯВНО ОТКЛОНЯЕТ старый design-doc §5 (дерандомизированная инкапсуляция coin=HKDF(DH_ss)) — и он ПРАВ: в noble ss=HASH512(msg‖HASH256(pk))[:32] публично из (coin,pk), coin из классического DH_ss коллапсировал бы ML-KEM-вклад к стойкости X25519 (не PQ). Реализация genuine encapsulate уже в коде. Остаток: одна r переиспользуется для body-эфемеры E=R И view_tag — это X25519-эфемера, НЕ ML-KEM; независимость KEM-инкапсуляций аудит подтвердить. Старый §5 — МЁРТВ, проверить что тесты/контракт на него не ссылаются.
- [OK] (6) first_publisher enforcement не ломает легитимный повторный CONV-паблиш того же отправителя — Не ломает. Повторный push тем же кошельком: throwUnless(13531, existing.first_publisher_key==publicAuthorKeyId(msg.author_wallet)) проходит (тот же wallet). bucketKey per-пара (K_root несёт lo/hi keyId) => ложных коллизий между разными контактами нет; исходящие бакеты пользователя к разным контактам различны. Много частей в одном epoch/батче в один bucketKey — все один wallet => проходят, entry_count++/bucket_prev_link цепляется. Мульти-девайс = тот же сид => тот же wallet => тот же author_wallet. Отвергается ТОЛЬКО чужой кошелёк в чужой бакет (для честного клиента невозможно — bucketKey опакостен). D1<->D7 разрешён верно: CONV author_wallet=РЕАЛЬНЫЙ owner_wallet (Vault:2352 уже форвардит msg.owner_wallet), НЕ хранится в PrivateCapsuleEntry. Мелочь: INTRO-sentinel требует ОТДЕЛЬНОЙ ветки форварда в Vault (2352 сейчас безусловно шлёт owner_wallet) — косметика (IntroCapsuleEntry не хранит author_wallet, sender и так виден в tx), но должна быть явно прописана или снята. GAP: ротация messaging-ключей (ReplaceMessagingKeys) меняет keyId => новый K_root/bucketKey/dir mid-conversation; триггер ре-intro не описан.
- [OK] (7) intro-эвикция D5 держит границу состояния — Держит. evictExpiredIntro(msg.part_count) БЕЗУСЛОВНО на ВСЕХ трёх publish-kind: высокообъёмный CONV/PUBLIC подметает низкообъёмный intro-хвост; только что добавленные intro-записи на now() не протухли => строгий FIFO-стоп их не тронет. Требует изменить текущую L941-945 (эвиктит ТОЛЬКО own-kind) на: own-kind sweep + БЕЗУСЛОВНЫЙ intro-sweep. Каждый kind фондирует доп. intro-sweep-del в HUB_PART_GAS_* (см. check 2 — источник калибровочного риска). Граница intro не слабее бесед — цель D5 достигнута. Остаток (не блокер): глобальная тишина >1 год затем всплеск дренит только <=part_count(<=8) протухших/батч — ограничено и самозалечивается, live-окно временно > retention.

### Дыры интеграции
1. ГЛАВНАЯ ДЫРА (блокер связности) — бутстрап PREFS-капсулы, хранящей все K_root. Пост-гибрид scan-геттеры над private_entries удалены и sender_key_id выброшен из CONV header0 => (а) sender-recovery-open prefs-капсулы (crypto.mjs:1590) для CONV ломается; (б) ретрив всё ещё висит на удалённом recipient-index walk (app.js:9737). Из сида бутстрапится ТОЛЬКО INTRO-скан или ДЕТЕРМИНИРОВАННЫЙ-из-сида self-CONV-бакет; genuine-ML-KEM self-K_root из сида НЕвосстановим (ct_root в самой же капсуле = цикл). НЕОБХОДИМО до genesis: явно запинить лейн self-prefs-капсулы (рекомендую INTRO-стелс-скан по seed-детерминированному scan-ключу, ЛИБО чистый seed-HKDF self-bucketKey минуя genuine-KEM для self-пары, т.к. self-беседа не даёт граф-приватности) + переписать ретрив с recipient-index walk на скан. Без этого D2-recovery не работает => потеря переписки навсегда на immutable.
2. Газ-мирроринг: D5-intro-sweep-на-каждом-publish связывает Vault-hold PUBLIC/CONV (batchHubPartGas) с поднятыми HUB_PART_GAS_PUBLIC/_PRIVATE. Любой пропуск зеркала Hub-константа<->Vault batchHubPartGas => hold недофинансирует Hub => throw 13530 => bounce => permanent liveness-break на immutable. Обязателен G8 для комбо worst-case (PUBLIC 8x32K + подмётка intro-хвоста в одной tx) по ВСЕМ трём kind ОТДЕЛЬНО. first_publisher_key +256 бит => пере-измерить CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT(3.3M); indexStorageReserve обязан добавить слагаемое intro_live_count*introEndowment (легко пропустить при копипасте).
3. author_wallet=SENTINEL для INTRO требует ЯВНОЙ ветки форварда в Vault (Vault.tact:2352 сейчас безусловно шлёт author_wallet: msg.owner_wallet). Косметика (IntroCapsuleEntry не хранит author_wallet; отправитель виден в tx и так — принятый residual), но должна быть прописана в плане работ или явно снята, иначе INTRO поедет с реальным owner_wallet (безвредно, но расходится с D1).
4. header1.createdAt не ограничен on-chain: скьюнутый/бэкдейтнутый timestamp толкает CONV bucketKey-epoch вне настенного окна получателя W => тихая потеря; получатель офлайн > W суток пропускает бакеты выпавших эпох. W корректно клиентский/тюнимый, но асимметрию sender-embedded-epoch vs recipient-wallclock-window надо задокументировать + добавить клиентский санити-бонд createdAt как аудит-инвариант.
5. Ротация messaging-ключей (ReplaceMessagingKeys уже в контракте) меняет hybrid keyId => новый K_root/bucketKey/dir mid-conversation; дизайн не описывает триггер ре-intro/переустановления при ротации — беседа тихо промахивается после ротации у любой стороны.
6. Весь редизайн — НЕреализованный план поверх ПРОМЕЖУТОЧНОГО 592-бит PH0C дерева, которое ВСЁ ЕЩЁ несёт sender_key_id в header0. Переход на CONV(320)/INTRO(336) — НОВЫЙ форк пинов (не правка 592) с зеркалом Hub<->Vault; высокий риск смешать 592 vs 320/336 при immutable-сборке. Gate G2 обязан ассертить ТРИ значения из ABI.
7. Кросс-док рассинхрон: старый design-doc §5 (дерандомизированная ML-KEM, coin=HKDF(DH_ss)) МЁРТВ — клиентский дизайн заменил его genuine-encapsulation+PREFS-sync (согласовано с D2). Убедиться, что ни контракт, ни тесты, ни конформанс не кодируют семантику §5.
8. ПРИНЯТЫЕ ОСТАТКИ (НЕ блокеры, зафиксированы верно, вне границы раунда): (1) тайминг-корреляция диалога (ответ N≈сообщение N+1, лок-степ бакетов); (2) RPC-видимость {IP->входящие bucketKey} (batch-геттер+decoy+ротация смягчают); (3) квантовый ретро-граф ЗНАКОМСТВ (view_tag классический X25519, S_scan открыт в Vault) — локализован ребром первого контакта, CONV PQ-граф-приватен. Adversarial-фаза НЕ должна засчитывать их как блокеры. ГЕЙТ всей CONV-приватности = ANO-CCA/key-privacy гибрида ML-KEM => ОБЯЗАТЕЛЬНЫЙ внешний крипто-аудит key-privacy + доменной сепарации до ceremony.
