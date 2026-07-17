# Platho clean-16 Фаза 4 — контракт-план (wg1i92lqv)

> ready_to_implement=false (gated на owner-решениях recovery + G8-seal). recovery РАЗРЕШЁН = keyed latest-wins slot-map (FIFO отброшен).

## ИНКРЕМЕНТЫ
1. ИНК1: opaque bucket-рефактор существующего приватного пути (переименования sender→bucket, +privateHeaderPublishKind), wire 592 неизменен, тесты зелёные
2. ИНК2: раздвоение header0-пина CONV=320/INTRO=336, приватный путь→CONV, зеркало Vault, fail-closed на неверную длину, регенерация release-evidence
3. ИНК3: per-kind meta-assert privateHeaderPublishKind==publish_kind на CONV (13519)
4. ИНК4: INTRO-пул kind=3 (intro_entries/триплет id, 336-ветка, evictExpiredIntro 1год, безусловный capped intro-sweep cap4, Vault isIntroCapsuleShapeValid+body-overhead, intro-scan-геттеры)
5. ИНК5: FUNDS-SAFETY — indexStorageReserve+=intro-терм, исчерпывающие fail-closed kind-хелперы резерва/газа обеих сторон, get_state+intro
6. ИНК6: RECOVERY-пул kind=4 keyed latest-wins recovery_slots (тело on-chain, live_count++ только на первой вставке, indexStorageReserve+=recovery-терм, permissionless EvictExpiredRecoverySlot, get_recovery_capsule[_batch], Vault-зеркало)
7. ИНК7: G2-генератор — пин 3 header0-шейпов + 4 gas-констант из ABI зеркально Hub↔Vault, красный тест на остаточный 592/рассинхрон
8. ИНК8: G8-калибровка (seal-gate) — combo worst-case по 4 kind, 13530-bounce детерминизм, финализация всех provisional-пинов

## BLOCKERS (seal-time гейты)
1. Дизайн-конфликт recovery РАЗРЕШЁН в этом плане (принят Recovery-B keyed latest-wins; FIFO recovery_entries/recovery_latest_id/bucket_prev_link/evictExpiredRecovery/get_recovery_bucket_index удалены). Требуется явное письменное подтверждение владельца этого выбора ДО написания Tact — развилка immutable, отдельный пул постфактум не добавить.
2. G8-замер CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT / STORAGE_RESERVE_RECOVERY под 10-лет горизонт ON-CHAIN тела — самый неопределённый storage-пин; недомер = необратимый дренаж резерва Hub и потеря всего графа/K_root; не экстраполируется от 1-год CONV. Seal запрещён без прямого combo-прогона kind=4.
3. G8-замер INTRO body-overhead + endowment + всех HUB_PART_GAS_* с ЯВНЫМ запасом на intro-map-del; безусловный capped intro-sweep связал liveness горячего PUBLIC с газом intro-del — недомер = каждый public-пост этого размера падает 13530-bounce навсегда.
4. funds-safety: indexStorageReserve()/protectedReserve() ОБЯЗАНЫ включать intro+recovery терм (инк5/6) — без этого эндаумент = excess → SweepExcessReserve выведет бэкинг живого сториджа → необратимый дренаж; закрывается crit-тестом до seal.
5. G2: три header0-шейпа (576/320/336) и четыре HUB_PART_GAS_* ре-пинятся ОДНИМ генератором из компилированного ABI зеркально Hub↔Vault, красный тест на любой остаточный 592 — рассинхрон необратим на immutable.
6. ВНЕШНИЙ крипто-аудит key-privacy (ANO-CCA) гибрида ML-KEM ДО ceremony — весь graph-stealth и recovery-блоб держатся на неразличимости получателя в конверте; провал = тотальная утечка recipient-графа в обход opaque bucketKey/slotKey. Несущий гейт.
7. ReplaceMessagingKeys × recovery: до-ротационные peer-K_root должны храниться versioned-per-keyId, иначе до-ротационная переписка нечитаема после восстановления — решить схему хранения до genesis.

## OWNER QUESTIONS
1. ✅ РЕШЕНО (владелец 2026-07-15): RECOVERY_POOL_RETENTION_SECONDS = **94608000 (3 года)**, НЕ 10 лет. Вшивается НАВСЕГДА. Неактивность >3 лет + переустановка = permissionless-эвикция слота = необратимая потеря ВСЕХ K_root и контакт-графа — принятый владельцем остаток.
2. Точный CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT / STORAGE_RESERVE_RECOVERY (из G8): владелец принимает стоимость старта беседы ~0.4–2.6 GRAM (10-лет предоплата ON-CHAIN тела)? Перемер = переплата, недомер = дренаж.
3. RECOVERY_MAX_SIZE_CLASS — кап тела recovery-капсулы (ограничивает worst-case эндаумент и число страниц пагинации при большом контакт-сторе). Какой класс?
4. Тело recovery хранить ON-CHAIN (принято в плане ради durability против архив-нод) — подтвердить против hash-only варианта (дешевле, но durability не гарантирована).
5. Boundedness recovery за 10-лет-горизонтом: принят own-kind sweep + permissionless EvictExpiredRecoverySlot (bounded 1 слот/owner, брошенный owner держит 1 слот до 10 лет). Владелец принимает этот residual вместо безусловного capped recovery-sweep (который грузил бы PUBLIC-газ)?
6. Подтвердить сам вектор Фазы 4: обычные сообщения беседы (CONV) ТЕРЯЮТ per-message ephemeral/view_tag (они только в INTRO), отправитель остаётся видим в транзитной tx (принятый residual metadata-graph redesign). Это ожидаемое поведение?

---

## ПЛАН (детально)

ФИНАЛЬНЫЙ ПЛАН ФАЗЫ 4 (метадата-граф stealth: CONV/INTRO/PUBLIC/RECOVERY, immutable clean-16 редеплой). Разрешаю дизайн-конфликт SAFETY-blocker #1 своей архитектурной властью: recovery-пул реализуется ТОЛЬКО как keyed latest-wins slot-map (Recovery-B). FIFO-вариант (recovery_entries/recovery_latest_id/bucket_prev_link/evictExpiredRecovery/get_recovery_bucket_index из секций CapsuleHub/Vault) ПОЛНОСТЬЮ УДАЛЁН из плана как несовместимый и провоцирующий неограниченный рост state на 10-лет-эндаументе. Все места плана, где recovery описан как FIFO-цепочка с bucket_prev_link, читать как отменённые.

ПРИНЦИП ИСПОЛНЕНИЯ: каждый инкремент компилируется (`tact` без ошибок) и оставляет `npm test` (vitest.all.config.ts, single-worker — канон) ЗЕЛЁНЫМ. Tests-first: сперва красный тест на новое поведение/fail-closed код, затем реализация. Никаких молчаливых kind-дефолтов нигде — незнакомый kind = throw. Пины газа/сториджа на инкрементах 4-6 ПРОВИЗОРНЫЕ (комментарий // G8-provisional), финальные значения проставляет инкремент 8 из прямого замера; seal запрещён до закрытия blockers.

--- ИНК 1. Опаковый bucket-рефактор существующего приватного пути (БЕЗ смены формы, 592 остаётся). ---
Чисто переименование + смена семантики sender→opaque bucket, wire не меняется. Hub: privateHeaderSenderKeyId(508-512)→privateHeaderBucketKey (тело `header.loadUint(64); return header.loadUint(256)` байт-в-байт, биты64..320); private_sender_index(271)→private_bucket_index; PrivateCapsuleEntry.sender_prev_link(148)→bucket_prev_link (тот же 64-бит слот); pushPrivateSenderIndex(532)→pushPrivateBucketIndex (тело идентично, НЕТ publisher-сравнения, кода 13531 RJ_BUCKET_PUBLISHER нет и не появляется); prunePrivateSenderIndex(550)→prunePrivateBucketIndex; вызовы в receive(854)/evictExpiredPrivate(704) переименовать; get_private_sender_index(1059)→get_private_bucket_index, view PrivateCapsuleKeyIndexView→PrivateBucketIndexView (поле key_id→bucket_key, БЕЗ first_publisher_key). Добавить defense-in-depth extractor privateHeaderPublishKind(header0)=`let s=header0.beginParse(); s.loadUint(40); return s.loadUint(8)` (байт@5). Комментарии 508-516 переписать (opaque bucket, не sender). Vault: get-имён нет, правок 0. ТЕСТЫ: существующие private-тесты проходят после обновления имени геттера; новый unit — privateHeaderBucketKey возвращает то же значение что старый extractor на тех же байтах; privateHeaderPublishKind читает байт@5. Exit-коды не меняются.

--- ИНК 2. Раздвоение header0-пина: CONV=320 / INTRO=336, приватный путь становится CONV. ГЕНЕЗИС-WIRE-СМЕНА. ---
Hub: удалить строку 35 (592). Ввести `const CAPSULEHUB_CONV_HEADER0_BITS=320;` (40Б: meta64+bucketKey256) и `const CAPSULEHUB_INTRO_HEADER0_BITS=336;` (42Б: meta64+ephemeral_R256+view_tag16). CAPSULEHUB_PRIVATE_HEADER0_CELLS=1/REFS=0/HEADER1_BITS=240 НЕ трогать. Вызов requireExactPayloadCell в CONV-ветке(850): expectedBits→CAPSULEHUB_CONV_HEADER0_BITS, коды 13513/13514. Переименовать privateHeaderEphemeralScanPub(517)→introHeaderEphemeralR, privateHeaderViewTag(524)→introHeaderViewTag (применяются ТОЛЬКО к intro, в CONV этих полей нет — заготовка для инк4). Vault: L78 592→зеркало CONV=320+INTRO=336; isPrivateCapsuleShapeValid(968)→isConvCapsuleShapeValid (header0 320); walk(2190,2207) вызывает isConvCapsuleShapeValid. Клиент/фикстуры: CONV-капсула теперь 320 бит (ephemeral/view_tag УБРАНЫ из обычных сообщений беседы — они только в INTRO). ТЕСТЫ (fail-closed): 320-бит CONV принимается; 592- или 336-бит в CONV → computeDataSize.bits!=320 → 13514 (Hub) / RJ_PAYLOAD_SHAPE 0x14 (Vault). part.bits()==784, refs 3/4 НЕ трогаются — единый приватный фрейм. Осознать: это реальная смена шифр-wire → регенерировать release-evidence + full suite (правило release-evidence-rebaseline).

--- ИНК 3. Per-kind meta-assert на CONV (закрывает mislabel до появления одинаково-длинных пулов). ---
В CONV-ветке receive: `throwUnless(13519, self.privateHeaderPublishKind(header0)==msg.publish_kind)`. ТЕСТ: CONV-байты (meta@5=1) под корректным kind проходят; подмена meta@5!=publish_kind → 13519. (Полный смысл раскроется на инк6, где RECOVERY той же длины 320 — assert обязателен ЗАРАНЕЕ.)

--- ИНК 4. INTRO-пул (kind=3): отдельное id-пространство, capped sweep, retention=1год (граница не слабее бесед). ---
Hub константы: `CAPSULEHUB_ENTRY_KIND_INTRO=3;` `CAPSULEHUB_INTRO_SWEEP_CAP=4;` `ENTRY_UID_DOMAIN_VAULT_INTRO=0xD1190203;` `CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES=<G8-provisional ~2388>` (INTRO-тело несёт ct_root 1088Б+identity сверх 1204). Структура `struct IntroCapsuleEntry{ publish_id:uint256; created_at:uint64; body_hash:uint256; header_0:Cell; header_1:Cell }` (БЕЗ индекс-линков, БЕЗ author_wallet — личность в теле, verify-after-decrypt). Поля: `intro_entries: map<uint64,IntroCapsuleEntry>` + триплет intro_latest_id/intro_oldest_live_id/intro_live_count(uint64), init=0+emptyMap. Phase-A гейт receive(803): 4-way throwUnless(13502, PRIVATE||PUBLIC||INTRO). firstEntryId/fullFeePerPart(807-812): INTRO→intro_latest_id, fee=privateFullFee(HYBRID). marketing-гейт ТОЛЬКО PUBLIC. Тело цикла: `if(isConv){}else if(isIntro){}else{public}`; INTRO-ветка: frame 784, header0 336 (requireExactPayloadCell 13543/13544), header1 240 (13545/13546), body (13547/13548), isAllowedPrivatePair(13541), nonzero(13542), meta-assert 13549, БЕЗ индекс-пуша; `intro_entries.set(entryId, ...now()...); intro_live_count+=1;` uid через computeVaultIntroEntryUid(домен 0xD1190203). evictExpiredIntro(maxEvict) — scan-only FIFO по образцу evictExpiredPrivate(690), retention=CAPSULEHUB_INDEX_RETENTION_SECONDS(1год), без index-un-push. Финал-коммит(931): 4-way latest_id. Безусловный capped intro-sweep: заменить блок 941-945 на own-kind sweep + ПЛЮС `if(kind!=INTRO){ let sc=msg.part_count; if(sc>CAPSULEHUB_INTRO_SWEEP_CAP){sc=CAPSULEHUB_INTRO_SWEEP_CAP;} self.evictExpiredIntro(sc);}`. Vault: PUBLISH_KIND_INTRO=3; kind-гейты L2155/isPublishProfileValid(873) +INTRO-ветка (идентична PRIVATE); walk(2190) `if PUBLIC{}else{приватно-семейная}` внутри `if INTRO→isIntroCapsuleShapeValid(336) else isConvCapsuleShapeValid`; isIntroCapsuleShapeValid + intro body-overhead параметризация privateBody*(907-926) под INTRO. Геттеры: IntroScanRecord/IntroScanPageView/IntroScanBoundsView, get_intro_scan_bounds/get_intro_scan_page(clamp≤64, читает ТОЛЬКО header_0 через introHeaderViewTag/introHeaderEphemeralR)/get_intro_entry. ТЕСТЫ: INTRO роутится в intro-пул; 320-в-INTRO→13544 (fail-closed); intro 1-год эвикция; PUBLIC-батч подметает intro-хвост капом≤4, свежий intro (now()) не тронут; intro-scan-page отдаёт view_tag+ephemeral без тела.

--- ИНК 5. FUNDS-SAFETY (BLOCKER SAFETY #2/#3): резерв покрывает intro + исчерпывающие fail-closed kind-хелперы. ---
Hub: `introIndexStorageReservePerEntry()=CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE+CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT`. **indexStorageReserve()(360-363): в base ДО *1.25 добавить `+ (self.intro_live_count*self.introIndexStorageReservePerEntry())`** (recovery-терм добавит инк6). protectedReserve(365) авто-растёт. batchStorageReserveWithBuffer(786-791): 4-way endowment (PUBLIC/CONV/INTRO). Ввести `CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT≈1.8-2.2M`(G8-provisional). CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT (CONV) ПЕРЕ-мерить БЕЗ +256 (OVERRIDE-A: PrivateCapsuleKeyIndex 128 бит, first_publisher нет)→≈3.3M. get_state(1299)+CapsuleHubStateView: += intro_latest_id/intro_live_count/intro_oldest_live_id. Vault: STORAGE_RESERVE_INTRO/VAULT_PART_GAS_INTRO/HUB_PART_GAS_INTRO; **batchStorageReserve/batchHubPartGas/batchVaultPartGas(997-1010) сделать ИСЧЕРПЫВАЮЩИМИ: явные ветки PUBLIC/PRIVATE(CONV)/INTRO + `throw(код)` на неизвестный kind — убрать молчаливый `return PRIVATE`-дефолт** (SAFETY #3 fail-open). ТЕСТЫ: intro-эндаумент ВНУТРИ protectedReserve (SweepExcessReserve/FlushFees НЕ выводят intro-бэкинг — попытка → 13206 или excess=0); неизвестный kind в любом резерв-хелпере → throw; N intro-публикаций → indexStorageReserve растёт на N*perEntry.

--- ИНК 6. RECOVERY-пул (kind=4): keyed latest-wins slot-map, тело ON-CHAIN, ~10 лет, permissionless evict. ---
Hub константы: `CAPSULEHUB_ENTRY_KIND_RECOVERY=4;` `CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS=94608000;`(3 года, GENESIS-НАВСЕГДА) `CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT=23200000;`(G8-CANONICAL: 79.1 яч × 64962 × 3 года × 1.5) `RECOVERY_MAX_SIZE_CLASS=<owner, напр SIZE_CLASS_8K>;` `ENTRY_UID_DOMAIN_VAULT_RECOVERY=0xD1190204;`. Структура `struct RecoveryCapsuleRecord{ publish_id:uint256; updated_at:uint64; body_hash:uint256; header_0:Cell; header_1:Cell; body:Cell }` — ТЕЛО ХРАНИТСЯ (durability против архив-нод через десятилетие). Поля: `recovery_slots: map<uint256,RecoveryCapsuleRecord>`(ключ=self_bucketKey epoch-0) + `recovery_live_count:uint64`, init=0+emptyMap. RECOVERY-ветка receive: CONV-форма header0 320 (13553/13554), header1 240 (13555/13556), body(13557/13558)+RECOVERY_MAX_SIZE_CLASS cap, isAllowedPrivatePair(13551), nonzero(13552), meta-assert 13559; slotKey=privateHeaderBucketKey(header0); `let existed=self.recovery_slots.get(slotKey)!=null; self.recovery_slots.set(slotKey, RecoveryCapsuleRecord{...updated_at:now()...}); if(!existed){ self.recovery_live_count+=1; }` (перезапись НЕ инкрементит — иначе резерв раздувается). `recoveryIndexStorageReservePerEntry()=KEEPALIVE+CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT`; **indexStorageReserve() += `self.recovery_live_count*self.recoveryIndexStorageReservePerEntry()`** (4-й терм). batchStorageReserveWithBuffer/Vault-хелперы += RECOVERY-ветка (исчерпывающе). Permissionless эвикция: `message EvictExpiredRecoverySlot{slotKey:uint256}` → `let r=self.recovery_slots.get(slotKey)!!; throwUnless(13561, r.updated_at+CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS<now()); self.recovery_slots.del(slotKey); self.recovery_live_count-=1;` (self-heal резерва, цензуро-устойчиво; рефреш сбрасывает часы → грифинг невозможен до 3 лет). Геттеры: `struct RecoveryCapsuleView{exists:Bool; slot_key:Int; updated_at:Int; body_hash:Int; header_0:Cell; header_1:Cell; body:Cell}`, `get get_recovery_capsule(slotKey):RecoveryCapsuleView`(miss→exists:false), опц `get_recovery_capsule_batch(map<uint16,uint256>)` cap 32 (пагинация+decoy). get_state += recovery_live_count/latest мониторинг. НИКАКОГО get_recovery_bucket_index/get_recovery_entry/recovery_latest_id (это FIFO-остатки — не создавать). Vault: PUBLISH_KIND_RECOVERY=4; kind-гейты+isPublishProfileValid +RECOVERY(идентична PRIVATE); walk использует isConvCapsuleShapeValid(320) для RECOVERY; STORAGE_RESERVE_RECOVERY(=keepalive+recovery endowment)/HUB_PART_GAS_RECOVERY/VAULT_PART_GAS_RECOVERY; author_wallet(2352)=msg.owner_wallet БЕЗУСЛОВНО для всех 4 kind (sentinel INTRO — client-body-only, 924/hubMsgBits неизменны — SAFETY minor #8). Recovery-sweep НЕ безусловен (own-kind при RECOVERY-батче + permissionless evict; 3-летний пул низкочастотен, не грузим горячий PUBLIC). ТЕСТЫ: N перезаписей одного slotKey → recovery_live_count==1 И indexStorageReserve стабилен (SAFETY #1 crit-тест); recovery-эндаумент внутри protectedReserve (нет дренажа); EvictExpiredRecoverySlot до expiry → 13561; после expiry → del+count--; CONV-байты под kind=4 с meta=1 → 13559 (SAFETY #6); 336-в-RECOVERY → 13554.

--- ИНК 7. G2-генератор: единый пин 3 header0-шейпов + 4 gas-констант из компилированного ABI, зеркало Hub↔Vault. ---
Один генератор ассертит из ABI: PUBLIC 576 / CONV 320 / INTRO 336 (RECOVERY 4-го шейпа НЕ добавляет — self-CONV 320) + HUB_PART_GAS_{PRIVATE,PUBLIC,INTRO,RECOVERY} + STORAGE_RESERVE_* зеркально обеим сторонам. Красный тест на ЛЮБОЙ остаточный 592 где-либо и на любой рассинхрон Hub-константа↔Vault batchHubPartGas/batchStorageReserve. ТЕСТ: grep-инвариант «нет 592» + числовое равенство пар.

--- ИНК 8. G8-калибровка (SEAL-GATE): worst-case combo по 4 kind + 13530-bounce детерминизм. ---
Прямые замеры (заменяют все G8-provisional пины): (а) CONV storage БЕЗ +256; (б) INTRO body-overhead + endowment; (в) RECOVERY 10-лет рента RECOVERY_MAX_SIZE_CLASS-тела ON-CHAIN + record-скаляры + слот map — округление вверх с headroom; (г) HUB_PART_GAS_* с ЯВНЫМ измеренным запасом на intro-map-del (не растворять в марже — SAFETY #5). Combo worst-case ОТДЕЛЬНО: PUBLIC 8×32K+intro-sweep, CONV 8×32K+intro-sweep, INTRO 8×32K, RECOVERY 8×RECOVERY_MAX+перезапись существующего слота. ТЕСТ: недодержание на 1 газ-юнит любого kind → детерминированный 13530-bounce-refund; canonicalTotal≥ фактического на всех формах; pre-accept floor(Vault:2131) kind-независимо покрывает INTRO(больший body)/RECOVERY. Инвариант STORAGE_RESERVE_{INTRO,RECOVERY}(Vault) ≥ per-entry эндаумента(Hub). После зелёного combo + внешнего key-privacy аудита (blocker) — genesis-редеплой (bump deployment_id, форк ATHMaster, те же vanity-кошельки — правило genesis-redeploy-deployment-id-fork).

---

## RECOVERY-B ДИЗАЙН

pool_shape:
РЕШЕНИЕ: keyed-per-owner slot (in-place latest-wins overwrite), НЕ FIFO-~10лет.

Новое состояние Hub (отдельный пул, зеркалить в init + genesis):
```
recovery_slots: map<Int as uint256, RecoveryCapsuleRecord>;   // ключ = self_bucket_key (opaque)
recovery_live_count: Int as uint64;                            // число ЖИВЫХ слотов (для indexStorageReserve)
struct RecoveryCapsuleRecord {
    publish_id:  Int as uint256;
    updated_at:  Int as uint64;   // now() последней перезаписи — заряжает retention-окно
    body_hash:   Int as uint256;
    header_0:    Cell;            // CONV-шейп 320 бит: bucketKey в [64:320] == ключ слота
    header_1:    Cell;            // 240 бит
    body:        Cell;           // ТЕЛО ХРАНИТСЯ ON-CHAIN (см. ниже — это определяющий выбор Варианта B)
}
```
Ключ = epoch-0 self-bucketKey (детерминирован из сида, п.«self_bucket_read»). Пул = ОТДЕЛЬНЫЙ publishKind=4 (`PUBLISH_KIND_RECOVERY`/`CAPSULEHUB_ENTRY_KIND_RECOVERY=4`), НЕ подмешивается в `private_entries` (иначе 10-лет-retention-записи неотличимы в 1-год FIFO-эвикции `evictExpiredPrivate` CapsuleHub:690 — фатально на immutable).

LATEST-WINS перезапись: на publish `let existed = recovery_slots.get(slotKey) != null;` → `recovery_slots.set(slotKey, rec)`; `if (!existed) { recovery_live_count += 1; }` (перезапись НЕ инкрементит счётчик — иначе indexStorageReserve раздувается на каждом keep-alive → лок резерва). Один слот на owner НАВСЕГДА → состояние O(#owners × #pages), НЕ O(#republish).

Почему НЕ FIFO-~10лет: FIFO держит КАЖДЫЙ устаревший снапшот 10 лет (keep-alive + новый-контакт публикуются часто; 300 контактов → сотни мёртвых записей × 10-лет эндаумент = абсурдная стоимость и рост state), а reinstalled-клиенту нужен ТОЛЬКО последний → overwrite даёт O(1)-чтение и bounded-storage. FIFO-10лет отвергнут.

ТЕЛО ON-CHAIN (fork, решён): record.body хранится в контракте, НЕ только body_hash как в CONV. Причина: в CONV тело живёт в tx и читается из архива — но 10-лет-durability К_root против длительной неактивности НЕЛЬЗЯ строить на гарантии, что архив-нода отдаст конкретную tx через десятилетие. Оценка спека (0.4–2.6 GRAM за 50–300 контактов = 10-летняя рента) СОГЛАСУЕТСЯ только с on-chain телом (hash-only был бы почти бесплатен). Кап: `RECOVERY_MAX_SIZE_CLASS` (напр. SIZE_CLASS_8K) ограничивает worst-case тело; при переполнении — ПАГИНАЦИЯ: page-index вшит в деривацию slotKey (slotKey_p = HKDF(...‖uint32BE(pageIndex))), каждая страница = свой слот, инкрементально. `get_recovery_state` (или get_state += recovery_live_count/latest) для мониторинга дренажа.

retention_funding:
ПИН: `RECOVERY_POOL_RETENTION_SECONDS = 94608000` (=3 × CAPSULEHUB_INDEX_RETENTION_SECONDS 31536000). Вшивается в genesis, постфактум не тюнится.

ЭНДАУМЕНТ НАПЕРЁД, НЕ ленивое списание: ввести `CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT` (Hub) + `STORAGE_RESERVE_RECOVERY` (Vault, зеркало: keepalive 1M + recovery endowment) + `recoveryIndexStorageReservePerEntry() = CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE + CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT`. Размер = 10-летняя рента RECOVERY_MAX_SIZE_CLASS-тела + record-скаляры + слот map-записи. Каждая recovery-публикация (publishKind=4) НЕСЁТ полный эндаумент в value батча — так резерв всегда покрывает 10 лет ОТ ПОСЛЕДНЕГО рефреша. Вшит в стоимость СТАРТА БЕСЕДЫ: клиент публикует/рефрешит recovery-капсулу при первом INTRO и на КАЖДОМ новом контакте — это отдельный on-chain publishKind=4 батч, чья цена включает 10-лет-эндаумент. Инвариант B держится: показанный баланс = тратимый; отправка CONV-сообщения заряжается ТОЛЬКО за сообщение, recovery-эндаумент отдельным осознанным действием (старт беседы), НЕ фоновым списанием из ton_balance.

РЕФРЕШ: на overwrite `rec.updated_at = now()` (сброс 10-лет-часов) + kept-логика ACK держит `part_count * batchStorageReserveWithBuffer(RECOVERY)` (пополняет реальный баланс под новое 10-лет-окно; т.к. рента списывается сетью из баланса непрерывно, свежий эндаумент восполняет). На overwrite live_count НЕ растёт → indexStorageReserve стабилен, лишний приходящий эндаумент идёт в баланс (не excess).

FUNDS-SAFETY (обязательно, зеркало intro-блокера): `indexStorageReserve()` (CapsuleHub:360) += `recovery_live_count * recoveryIndexStorageReservePerEntry()`; `protectedReserve()` растёт на ЧЕТЫРЕ пула (private/public/intro/recovery). Иначе recovery-эндаумент классифицируется как excess → SweepExcessReserve/FlushFees выведут TON под живым recovery-сторриджем → необратимый дренаж. Vault `batchStorageReserve`(998)/`canonicalTotal`(2294) += RECOVERY-ветка; `BATCH_FLOOR_*`(360-361) kind-независим, проверить покрытие publishKind=4. G8-калибровка HUB_PART_GAS_RECOVERY/VAULT_PART_GAS_RECOVERY обязательна.

ПРИ ИСЧЕРПАНИИ (>10 лет без рефреша): слот становится провабли-expired. Эвикция = PERMISSIONLESS таргетед-оп `EvictExpiredRecoverySlot{slotKey}` (не FIFO — keyed-map не упорядочен по updated_at; ordering в Tact дорог): `throwUnless(code, rec.updated_at + RECOVERY_POOL_RETENTION_SECONDS < now())` → del слот + recovery_live_count -= 1 (освобождает резерв, self-heal). Любой может вызвать → цензуро-устойчиво, резерв самозалечивается. До 10 лет слот НИКОГДА не эвиктится (активный рефреш сбрасывает часы). За 10-летним горизонтом полной заброшенности — ограниченный per-owner дренаж ренты (bounded: ровно 1 слот на owner из-за overwrite), задокументированный residual.

self_bucket_read:
ДЕДИЦИРОВАННЫЙ recovery-геттер (НЕ CONV bucket-геттер), т.к. пул отдельный и форма записи иная (одна latest-wins запись с телом+updated_at, без entry_count/link-цепи):
```
get fun get_recovery_capsule(slotKey: Int): RecoveryCapsuleView
struct RecoveryCapsuleView { exists: Bool; slot_key: Int; updated_at: Int; body_hash: Int; header_0: Cell; header_1: Cell; body: Cell; }
```
miss → exists:false, нули/emptyCell. Отдаёт header_0/header_1/body ЦЕЛИКОМ как BOC (клиент распарсит — ст.находка #1). Опц. `get_recovery_capsule_batch(map<uint16,uint256>)` cap 32 для пагинации+decoy одним RPC (D3 приватность).

REINSTALLED-КЛИЕНТ находит капсулу БЕЗ локального стора, детерминированно из мнемоника:
1. `K_root_self = HKDF-SHA256(seed, salt='PLATHO.CONV.ROOT.SELF.SALT.V1', info='PLATHO.CONV.ROOT.SELF.V1')` — обходит genuine-ML-KEM (self-пара не даёт граф-приватности, PQ терять нечего; закрывает bootstrap-ЦИКЛ §12.1).
2. `K_epoch_self0 = HKDF(K_root_self, RATCHET-info‖uint32BE(0))`, epoch-сентинел 0 (epoch-НЕЗАВИСИМ → находится ОДНИМ lookup независимо от давности рефреша; закрывает узость окна W=2 §12.2).
3. `slotKey_p = HKDF(K_epoch_self0, salt='PLATHO.CONV.BUCKET.SALT.V1', info='PLATHO.CONV.BUCKET.V1'‖0x00‖uint32BE(0)‖uint32BE(pageIndex))[:32]`.
4. Клиент вызывает get_recovery_capsule(slotKey_0), slotKey_1, … пока exists=false; открывает каждую recipient-веткой на своих секретах (НЕ sender-recovery-путь, которого в CONV больше нет), верифицирует resolved body_hash == сохранённого, UNION-merge контактов по peerKeyId (аддитивно, §12.4-5).

ВСЕ info-строки + epoch-0 + page-index-схема ЗАМОРОЖЕНЫ в genesis (смена осиротит ВСЕ опубликованные recovery-капсулы). Форма геттера + RecoveryCapsuleView вшиты в genesis. Клиент публикует recovery под ТЕМ ЖЕ slotKey_p как publishKind=4 (Hub роутит по kind в recovery_slots, ключ = bucketKey из header_0[64:320]).

immutable_gotchas:
ВШИВАЕТСЯ НАВСЕГДА (untunable после seal):
1. `PUBLISH_KIND_RECOVERY=4`/`CAPSULEHUB_ENTRY_KIND_RECOVERY=4` + сам факт отдельного пула recovery_slots (нельзя добавить пул постфактум на immutable). Выбор отдельного пула — потому что 10-лет retention НЕЛЬЗЯ смешать в 1-год FIFO private_entries.
2. `RECOVERY_POOL_RETENTION_SECONDS=94608000` (3 года — решение владельца 2026-07-15, СУПЕРСЕДИТ прежние 10 лет). Почему: баланс durability↔предоплата. Длиннее → больше GRAM при старте беседы; короче → риск необратимой потери всей переписки при неактивности > retention.
3. Эндаумент-пины `CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT`/`STORAGE_RESERVE_RECOVERY`/`HUB_PART_GAS_RECOVERY`/`VAULT_PART_GAS_RECOVERY`/`RECOVERY_MAX_SIZE_CLASS` + `ENTRY_UID_DOMAIN_VAULT_RECOVERY`. Любой недомер → immutable-дренаж (недофинанс ренты) ИЛИ 13530-bounce liveness-break. Обязателен G8 отдельно по publishKind=4 (8×RECOVERY_MAX + перезапись существующего слота) + зеркало Hub↔Vault одним генератором G2.
4. Тело recovery ON-CHAIN (не hash-only). Почему: durability против длительной неактивности не может опираться на архив-ноды. Это увеличивает эндаумент (0.4–2.6 GRAM/10лет — согласуется с оценкой спека), но делает восстановление самодостаточным.
5. Семантика latest-wins overwrite + роутинг по self-bucketKey из header_0; `recovery_live_count` растёт ТОЛЬКО на первой вставке слота (перезапись не инкрементит) — иначе indexStorageReserve раздувается.
6. `indexStorageReserve()`/`protectedReserve()` учитывают recovery-пул (4-й терм). Пропуск = sweepable-дренаж под живым сторриджем (тот же класс, что intro-блокер red-team).
7. Форма `get_recovery_capsule`/RecoveryCapsuleView + permissionless `EvictExpiredRecoverySlot` + его expiry-проверка (updated_at+RETENTION<now).
8. Info-строки self-root/epoch-0-self-bucketKey/page-index (клиент-зеркало) — смена осиротит все recovery-капсулы.

---

## SAFETY findings
- [blocker] План содержит ДВА взаимоисключающих дизайна recovery-пула. Секции CapsuleHub/Vault описывают FIFO-пул записей (recovery_entries: map<uint64,...>, recovery_latest_id, bucket_prev_link, evictExpiredRecovery по образцу evictExpiredPrivate, get_recovery_bucket_index+get_recovery_entry). Секция Recovery-B описывает keyed latest-wins slot-map (recovery_slots: map<uint256,RecoveryCapsuleRecord>, overwrite, recovery_live_count++ только на первой вставке, permissionless EvictExpiredRecoverySlot, get_recovery_capsule). Это разные структуры данных, разные эвикции, разные геттеры — на immutable нельзя реализовать оба.
  why: FIFO-вариант (секции Hub/Vault) хранит КАЖДЫЙ устаревший снапшот 10 лет: keep-alive/новый-контакт публикуются часто, 300 контактов -> сотни мёртвых записей x 10-летний эндаумент -> необратимый неограниченный рост state Hub + экономический self-DoS на баланс пользователя при каждом старте беседы. Именно это Recovery-B и называет фатальным. Выбор неверной ветки нельзя откатить после seal.
  fix: ДО написания Tact зафиксировать ОДИН дизайн — keyed latest-wins recovery_slots (Recovery-B): overwrite по self-bucketKey, recovery_live_count инкрементится только при первой вставке слота, чтение через get_recovery_capsule, эвикция через permissionless EvictExpiredRecoverySlot(updated_at+RETENTION<now). Удалить из плана FIFO recovery_entries/recovery_latest_id/bucket_prev_link/evictExpiredRecovery/get_recovery_bucket_index как несовместимые. Тест: N перезаписей одного слота -> recovery_live_count==1 и indexStorageReserve стабилен.
- [blocker] indexStorageReserve() (CapsuleHub.tact:360-363) суммирует ТОЛЬКО private_live_count и public_live_count. При добавлении intro/recovery пулов их эндаумент не входит в protectedReserve() (:365-372), который используется в SweepExcessReserve (:1003-1007) и FlushFees (:972).
  why: intro/recovery-эндаумент классифицируется как excess -> SweepExcessReserve выведет TON, бэкающий живой intro/recovery-сторридж -> необратимый дренаж. Для recovery это = потеря 10-летнего бэкинга -> контракт со временем уходит в storage-долг -> заморозка/удаление -> потеря ВСЕХ K_root и графа переписки навсегда.
  fix: В indexStorageReserve() добавить + (intro_live_count*introIndexStorageReservePerEntry()) + (recovery_live_count*recoveryIndexStorageReservePerEntry()) ВНУТРЬ base до *1.25. Зеркально в get_state добавить мониторинг. G8 обязан подтвердить protectedReserve растёт на все 4 пула ДО seal. Без этого funds_state_safe=false.
- [blocker] Дефолты kind-хелперов резерва расходятся и fail-OPEN в сторону меньшего резерва. Vault batchStorageReserve (Vault.tact:997-1000): 'if PUBLIC return PUBLIC; return PRIVATE' -> неучтённый RECOVERY получает 4.3M вместо ~40M. Hub batchStorageReserveWithBuffer (:786-791): 'endowment=PUBLIC; if PRIVATE...' -> неучтённый RECOVERY получает 9.4M. Дефолты СТОРОН ещё и разные (Vault->PRIVATE, Hub->PUBLIC).
  why: Если 4-я ветка забыта хотя бы в одном месте: (а) recovery недо-резервируется на порядок -> 10-летняя рента не забэкана -> дренаж -> recovery потеряна необратимо; (б) рассинхрон Vault(4.3M)↔Hub(9.4M) -> Vault недо-форвардит -> Hub throw 13530 -> bounce -> permanent liveness-break этого размера.
  fix: Сделать оба хелпера ИСЧЕРПАЮЩИМИ по kind с fail-closed throw на неизвестный kind (никаких молчаливых дефолтов). Тот же паттерн для batchHubPartGas/batchVaultPartGas (Vault:1002-1010). Один G2-генератор пинит все 4 значения из ABI зеркально.
- ✅ ЗАКРЫТО [G8-CANONICAL 2026-07-17]: RECOVERY_POOL_RETENTION_SECONDS=94608000 (3 года) и CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT=23200000 ЗАМЕРЕНЫ, не оценены: 79.1 яч (8К cap) × 64962 × 3 года × 1.5 запас. Прежние 200M считались по МЁРТВОЙ ставке 500/1 → переплата ×13.
  why: Недомер эндаумента -> баланс Hub истощается за годы континуальной сетевой рентой -> storage-долг -> заморозка контракта -> тотальная необратимая потеря recovery+графа. Перемер -> постоянная переплата за старт каждой беседы. Ни то ни другое не тюнится после seal.
  fix: Прямой G8-замер storage-fee за 10 лет для RECOVERY_MAX_SIZE_CLASS-тела (тело ON-CHAIN, не hash-only) + record-скаляры + слот map-записи, с конфиг-headroom округлением вверх. STORAGE_RESERVE_RECOVERY (Vault) >= CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT (Hub). Отдельный combo-прогон по kind=4 (8xRECOVERY_MAX + перезапись существующего слота).
- [major] Безусловный capped intro-sweep на КАЖДОМ publish (включая самый частый PUBLIC-путь) сворачивается в per-part HUB_PART_GAS_PUBLIC/_PRIVATE, а газ-мирроринг Hub↔Vault расширяется с 2 до 4 kind (Hub:56-57/822/929 vs Vault:369-374/1002-1005/2245).
  why: Любой пропуск зеркала HUB_PART_GAS_* или недомер стоимости intro-map-del -> Vault недодержит hubFwd -> Hub requiredValue-гейт 13530 (CapsuleHub:929) -> bounce -> КАЖДЫЙ publish этого размера падает НАВСЕГДА (permanent liveness-break), причём на самой горячей public-операции.
  fix: Один G2-генератор ре-пинит HUB_PART_GAS_{PRIVATE,PUBLIC,INTRO,RECOVERY} из компилированного ABI зеркально обеим сторонам; красный тест на любой остаточный рассинхрон. G8 combo worst-case ОТДЕЛЬНО по 4 kind (PUBLIC 8x32K+intro-sweep, CONV 8x32K+intro-sweep, INTRO 8x32K, RECOVERY 8x32K) с явным измеренным запасом на intro-del, не растворённым в марже. Рассмотреть own-kind-only sweep для intro, чтобы снять связку с PUBLIC-liveness.
- [major] CONV и RECOVERY имеют ОДИНАКОВУЮ длину header0 (320 бит); Vault-walk (Vault.tact:2190-2212) различает форму ТОЛЬКО по длине и НЕ проверяет meta-байт@5==batch-kind. Единственный дискриминатор CONV↔RECOVERY — batch-level publish_kind + план-предложенный Hub-assert privateHeaderPublishKind(header0)==msg.publish_kind (13519/13559).
  why: Если Hub-assert опущен или meta-байт не совпадает: CONV-сообщение может попасть в 10-летний recovery-пул, а recovery-капсула — в 1-летний CONV-пул, где через год её эвиктнет evictExpiredPrivate (CapsuleHub:690-714) -> необратимая потеря K_root и всего графа после переустановки.
  fix: Обязательный Hub-side assert privateHeaderPublishKind(header0)==msg.publish_kind в КАЖДОЙ из приватных веток (CONV 13519 / INTRO 13549 / RECOVERY 13559), читающий ТОЛЬКО байт@5 (не магик/версию). Пометить load-bearing, запретить удаление. Тест fail-closed: 320-байт под k=4 с meta=1 -> throw 13559 -> bounce+refund.
- [major] INTRO-тело несёт ct_root(1088Б)+identity сверх CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES=1204 (CapsuleHub.tact:41, Vault.tact:84), а shape-валидация тела идёт через privateBody* (Vault:907-926 / Hub:441-460), пиненные на 1204.
  why: Если isIntroCapsuleShapeValid переиспользует 1204-overhead вместо intro-специфичного (~2388): валидные INTRO-тела отвергаются (RJ_PAYLOAD_SHAPE / 13518) -> INTRO-лейн полностью нефункционален -> первый контакт невозможен -> вся stealth-функция мертва и не чинится после seal. Если наоборот недомерить эндаумент под больший body -> дренаж.
  fix: Ввести CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES + отдельные intro-body функции (или kind-параметризация privateBody*), зеркально Hub↔Vault; значение зафиксировать прямым G8-замером реального INTRO-тела; STORAGE_RESERVE_INTRO покрывает его.
- [minor] Пин HUB_BATCH_MSG_ROOT_BITS=924 (Vault.tact:348) и fixed-width author_wallet:Address в PublishBatchToHub. План (верно) решает НЕ вводить Vault kind-ветку форварда: Vault.tact:2352 остаётся безусловным author_wallet:msg.owner_wallet, sentinel INTRO — client-body-only.
  why: Это БЕЗОПАСНЫЙ выбор — пин 924 и hubMsgBits (Vault:2281) сохраняются. Риск только в том, что будущая правка ради sentinel сделает поле Address?/дропнет его -> 924 рассинхронится -> hubMsgBits недооценит -> недофинанс hubFwd -> bounce.
  fix: Зафиксировать аудит-инвариант 'Vault форвардит owner_wallet для ВСЕХ 4 kind; author_wallet всегда fixed-width Address; sentinel INTRO живёт только внутри шифр-тела'. G2 ассертит 924 из ABI. Явно снять 'Vault INTRO sentinel-ветку' из чек-листа.

---

## CapsuleHub план
### header0_pins
РАЗДВОЕНИЕ header0-пинов (реальные строки CapsuleHub.tact:35-44).

УДАЛИТЬ строку 35 `const CAPSULEHUB_PRIVATE_HEADER0_BITS: Int = 592;`. Ввести вместо неё ДВА пина длины + переиспользовать 320 для recovery:
- `const CAPSULEHUB_CONV_HEADER0_BITS: Int = 320;` (40 байт: meta64 + bucketKey256)
- `const CAPSULEHUB_INTRO_HEADER0_BITS: Int = 336;` (42 байта: meta64 + ephemeral_R256 + view_tag16)
- RECOVERY использует CONV-форму 320 (self-CONV-капсула), НЕ отдельный битовый пин.
ОБЩИЕ пины НЕ трогать: `CAPSULEHUB_PRIVATE_HEADER0_CELLS=1` (37), `_HEADER0_REFS=0` (38), `CAPSULEHUB_PRIVATE_HEADER1_BITS=240` (36), header1 CELLS/REFS (39-40). Комментарий 35-36 переписать (PH0C→«CONV/INTRO/RECOVERY split»).

ЭКСТРАКТОРЫ (508-530). `privateHeaderSenderKeyId` (508-512) — ПЕРЕИМЕНОВАТЬ в `privateHeaderBucketKey`; тело `header.loadUint(64); return header.loadUint(256);` БАЙТ-В-БАЙТ то же окно (биты64..320), но семантика теперь opaque bucketKey. `privateHeaderEphemeralScanPub` (517-522) и `privateHeaderViewTag` (524-530) — ПЕРЕИМЕНОВАТЬ в `introHeaderEphemeralR` / `introHeaderViewTag` и применять ТОЛЬКО к intro_entries (в CONV этих полей нет). Добавить defense-in-depth `privateHeaderPublishKind(header0): Int` = `let s=header0.beginParse(); s.loadUint(40); return s.loadUint(8);` (байт@5, publishKind в битах40..48) — см. per-kind assert ниже.

requireExactPayloadCell (379-389) — не менять сам хелпер (он уже параметризован expectedBits/exit). Разводка идёт в вызовах внутри receive:
- CONV-ветка: `requireExactPayloadCell(header0, h0, CAPSULEHUB_PRIVATE_HEADER0_CELLS, CAPSULEHUB_CONV_HEADER0_BITS, CAPSULEHUB_PRIVATE_HEADER0_REFS, 13513, 13514)` (было 592 на строке 850).
- INTRO-ветка: `...CAPSULEHUB_INTRO_HEADER0_BITS..., 13543, 13544`.
- RECOVERY-ветка: `...CAPSULEHUB_CONV_HEADER0_BITS..., 13553, 13554`.
Fail-closed по КОНСТРУКЦИИ: 336-битный header0, пришедший в CONV-ветке → computeDataSize.bits!=320 → throw 13514; 320-битный в INTRO → 13544. Длина = дискриминатор CONV↔INTRO. CONV↔RECOVERY одинаковой длины 320 различаются ТОЛЬКО batch-kind → добавить в каждую из трёх приватных веток `throwUnless(1351x, self.privateHeaderPublishKind(header0) == msg.publish_kind)` (CONV 13519 / INTRO 13549 / RECOVERY 13559), чтобы meta-байт совпадал с batch-kind (закрывает mislabel recovery↔conv на immutable, дёшево).

Gate G2: генератор ре-пинит ТРИ header0-шейпа из компилированного ABI — PUBLIC 576 (строка 42, не трогать) / CONV 320 / INTRO 336 — зеркально Hub↔Vault (Vault.tact:78 несёт тот же 592, раздваивается идентично), assert БЕЗ остаточного 592 нигде. `part.bits()==784` + refs 3/4 (строки 838/871 для private/public) НЕ трогаются — единый приватный фрейм для CONV/INTRO/RECOVERY.

### publish_kind_plumbing
РАЗВОДКА publish_kind (реальные строки).

Константы (после 49-50): добавить `const CAPSULEHUB_ENTRY_KIND_INTRO: Int = 3;` и `const CAPSULEHUB_ENTRY_KIND_RECOVERY: Int = 4;` (RECOVERY нужен для OVERRIDE-B отдельного пула). Vault-зеркало: `PUBLISH_KIND_INTRO=3`, `PUBLISH_KIND_RECOVERY=4` рядом с Vault.tact:56-57.

Phase-A гейт receive (803): `throwUnless(13502, kind==PRIVATE || kind==PUBLIC || kind==INTRO || kind==RECOVERY)` — 4-way. Строку 805 `let isPrivate: Bool = ...` заменить на 4 булевых: `isConv=(kind==PRIVATE)`, `isPublic=(kind==PUBLIC)`, `isIntro=(kind==INTRO)`, `isRecovery=(kind==RECOVERY)`.

firstEntryId / fullFeePerPart (807-812): 4-way выбор счётчика. CONV→private_latest_id, PUBLIC→public_latest_id, INTRO→intro_latest_id, RECOVERY→recovery_latest_id. fullFeePerPart: PUBLIC=PLATO_PUBLIC_POST_FEE_TON; CONV/INTRO/RECOVERY=privateFullFee(HYBRID)=PLATO_PRIVATE_LONG_TERM_FEE_TON (сохраняет 13505/13506 fee-cap логику). marketing-гейт (816-820) — ТОЛЬКО PUBLIC (INTRO/RECOVERY, как и CONV, marketing==null).

Тело цикла (829-927): текущий `if (isPrivate){...}else{public}` → 4-way `if(isConv){...} else if(isIntro){...} else if(isRecovery){...} else {public}`. Приватный фрейм (784 бит, refs 3/4) общий у CONV/INTRO/RECOVERY — загрузка sizeClass/cryptoSuite/h0/h1/bh + 3 ref-а header0/header1/body одинаковая; отличаются только (а) header0-bits в requireExactPayloadCell, (б) индексная работа, (в) целевой пул/счётчик/uid-домен. `isAllowedPrivatePair(sizeClass,cryptoSuite)` (848) применяется к CONV/INTRO/RECOVERY. `(h0!=0)&&(h1!=0)&&(bh!=0)` — ко всем трём.

INTRO берёт СВОЁ id-пространство `intro_latest_id`/`intro_entries.set` (без индекс-пуша), `intro_live_count+=1`, uid через `computeVaultIntroEntryUid` (домен `ENTRY_UID_DOMAIN_VAULT_INTRO=0xD1190203`, хелпер-копия computeVaultPrivateEntryUid 716-730). RECOVERY — `recovery_latest_id`/`recovery_entries.set` + индекс-пуш в recovery_bucket_index, uid-домен `0xD1190204`. PUBLIC-ветка (868-924) БЕЗ изменений.

Финал-коммит (931-945): `if(isConv) private_latest_id+=part_count; else if(isIntro) intro_latest_id+=...; else if(isRecovery) recovery_latest_id+=...; else public_latest_id+=...`. accrued_plato_fee (936) без изменений.

Vault: external `PublishBatchFromVaultBalance` kind-гейт (Vault.tact ~873-879) += INTRO/RECOVERY; walk-валидатор `isPrivateCapsuleShapeValid` (Vault:968) раздвоить на isConv/isIntro/isRecovery-ShapeValid (320/336/320); Vault forward author_wallet (шлёт msg.owner_wallet) — для INTRO клиент подставляет SENTINEL ЗАРАНЕЕ (чисто клиентское, без Vault kind-ветки). batchHubPartGas/batchStorageReserve/batchVaultPartGas (Vault:1002-1008) += INTRO/RECOVERY ветки.

### bucket_index
OVERRIDE-A: private_bucket_index БЕЗ first_publisher, opaque.

СТРУКТУРА. `struct PrivateCapsuleKeyIndex { latest_entry_link: uint64; entry_count: uint64; }` (189-192) — ОСТАЁТСЯ КАК ЕСТЬ (НЕ добавлять first_publisher_key). Поле контракта `private_sender_index: map<Int as uint256, PrivateCapsuleKeyIndex>` (271) → ПЕРЕИМЕНОВАТЬ в `private_bucket_index`, ключ = opaque bucketKey. init (306) `self.private_bucket_index = emptyMap();`.

PrivateCapsuleEntry (142-151): поле `sender_prev_link: Int as uint64` (148) → ПЕРЕИМЕНОВАТЬ в `bucket_prev_link: Int as uint64` (тот же слот, 64 бита — размер не растёт). Комментарий 147-148 обновить. `recipient_prev_link` уже удалён (ничего не добавляем).

PUSH. `pushPrivateSenderIndex` (532-546) → `pushPrivateBucketIndex(bucketKey, entryLink): Int` — тело ИДЕНТИЧНО (get→prevLink/count→set{entryLink,count+1}→return prevLink). БЕЗ publisher-сравнения, БЕЗ кода 13531 RJ_BUCKET_PUBLISHER (OVERRIDE-A убирает его целиком — в текущем дереве его и НЕТ, следим чтобы не появился). Вызов в CONV-ветке (854): `let bucketPrevLink = self.pushPrivateBucketIndex(self.privateHeaderBucketKey(header0), entryLink);` затем store `bucket_prev_link: bucketPrevLink`.

PRUNE. `prunePrivateSenderIndex` (550-567) → `prunePrivateBucketIndex(bucketKey, entryLink, prevLink)` — тело идентично (del-at-zero, rewire latest_entry_link только если ==entryLink). Строка комментария 550-551 обновить (bucket, не sender).

ЭВИКЦИЯ. `evictExpiredPrivate` (690-714) — обслуживает ТОЛЬКО CONV-пул (private_entries теперь чисто CONV). Строка 704: `self.prunePrivateSenderIndex(self.privateHeaderSenderKeyId(entry.header_0), entryLink, entry.sender_prev_link)` → `self.prunePrivateBucketIndex(self.privateHeaderBucketKey(entry.header_0), entryLink, entry.bucket_prev_link)`. Комментарий 688-689 (упоминает recipient) вычистить. FIFO-инвариант тот же: удаляем TAIL цепочки бакета, backward-walk по bucket_prev_link дыр не встречает.

Направленность (dir по лексикографике keyId lo/hi) = ЧИСТО клиентский замороженный инвариант + conformance; контракт держит bucketKey opaque, НЕ сравнивает публикаторов, НЕ хранит sender-метки. Худший «fresh-bucket-per-entry» батч (part_count разных bucketKey) создаёт part_count свежих 128-битных слотов — endowment мерится под это, но БЕЗ +256 (см. gas_storage).

### intro_pool
INTRO-пул (§6, D5) — граница не слабее бесед, capped sweep.

СТРУКТУРЫ (после 151). `struct IntroCapsuleEntry { publish_id: uint256; created_at: uint64; body_hash: uint256; header_0: Cell; header_1: Cell; }` — БЕЗ индекс-линков, БЕЗ author_wallet (личность в теле, verify-after-decrypt). Поля контракта (после 283): `intro_entries: map<Int as uint64, IntroCapsuleEntry>;` + ТРИПЛЕТ `intro_latest_id: uint64`, `intro_oldest_live_id: uint64`, `intro_live_count: uint64`. init все =0 + `intro_entries=emptyMap()`.

Константы: `const CAPSULEHUB_INTRO_SWEEP_CAP: Int = 4;` (декуплирован от part_count).

ПРИЁМ (INTRO-ветка цикла): frame 784/refs, header0 336 бит (13543/13544), header1 240 (13545/13546), body (13547/13548), isAllowedPrivatePair (13541), nonzero (13542), meta-publishKind assert 13549. НЕТ индекс-пуша. `intro_entries.set(entryId, IntroCapsuleEntry{publish_id:entryPublishId, created_at:now(), body_hash:bh, header_0, header_1})`; `intro_live_count+=1`; `requiredValue += getComputeFee(HUB_PART_GAS_INTRO,false) + self.batchStorageReserveWithBuffer(CAPSULEHUB_ENTRY_KIND_INTRO)`.

ЭВИКЦИЯ. `evictExpiredIntro(maxEvict)` — scan-only FIFO по образцу evictExpiredPrivate (690-714), НО без index-un-push: get(oid)→null? oid+=1 (defensive skip); созрел (now()<created_at+CAPSULEHUB_INDEX_RETENTION_SECONDS)? stop; иначе `intro_entries.del(oid); intro_live_count-=1; oid+=1; evicted+=1`. Обновить intro_oldest_live_id в конце. Ретеншн intro = ТОТ ЖЕ 1-год CAPSULEHUB_INDEX_RETENTION_SECONDS (строка 17) — граница intro не слабее бесед.

БЕЗУСЛОВНЫЙ CAPPED intro-sweep. Заменить финальный блок 941-945 (`if isPrivate evictExpiredPrivate(part_count) else evictExpiredPublic(part_count)`) на:
- own-kind sweep: CONV→evictExpiredPrivate(part_count); PUBLIC→evictExpiredPublic(part_count); INTRO→evictExpiredIntro(part_count); RECOVERY→evictExpiredRecovery(part_count).
- ПЛЮС если kind!=INTRO: `self.evictExpiredIntro(min(msg.part_count, CAPSULEHUB_INTRO_SWEEP_CAP))` — самая частая PUBLIC-операция подметает intro-хвост капом (не масштабируется с public-батчем). Только-что добавленные intro на now() не протухли → FIFO-стоп их не трогает. `min` через if (Tact без встроенного min): `let sc=msg.part_count; if(sc>CAPSULEHUB_INTRO_SWEEP_CAP){sc=CAPSULEHUB_INTRO_SWEEP_CAP;} self.evictExpiredIntro(sc);`. G8 обязан доказать: capped sweep ДОГОНЯЕТ max intro-inflow (intro низкообъёмный по допущению) и HUB_PART_GAS_PUBLIC/_PRIVATE/_RECOVERY несут стоимость intro-del.

### recovery_pool_b
OVERRIDE-B: отдельный recovery-пул ~10 лет retention.

КОНСТАНТЫ. `const CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS: Int = 94608000;` (3 года; НЕ 1-год private, НЕ прежние 10 лет). `const CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT: Int = 23200000;` — G8-CANONICAL замер: 79 яч × 64962/яч/год × 3 года × 1.5 запас. `const ENTRY_UID_DOMAIN_VAULT_RECOVERY: Int = 0xD1190204;`.

СТРУКТУРЫ. `struct RecoveryCapsuleEntry { publish_id: uint256; created_at: uint64; body_hash: uint256; bucket_prev_link: uint64; header_0: Cell; header_1: Cell; }` (self-CONV-форма 320, с bucket-линком для backward-walk). Поля контракта: `recovery_entries: map<Int as uint64, RecoveryCapsuleEntry>;` + `recovery_bucket_index: map<Int as uint256, PrivateCapsuleKeyIndex>;` (ключ = self-bucketKey opaque, ПЕРЕИСПОЛЬЗУЕМ PrivateCapsuleKeyIndex) + триплет `recovery_latest_id`/`recovery_oldest_live_id`/`recovery_live_count` (uint64), init=0 + два emptyMap.

ПРИЁМ (RECOVERY-ветка). frame 784/refs, header0 320 (13553/13554), header1 240 (13555/13556), body (13557/13558), isAllowedPrivatePair (13551), nonzero (13552), meta-publishKind assert 13559. `selfBucketKey = self.privateHeaderBucketKey(header0)`; `recPrev = self.pushRecoveryBucketIndex(selfBucketKey, entryLink)` (копия pushPrivateBucketIndex над recovery_bucket_index); store RecoveryCapsuleEntry{...bucket_prev_link:recPrev...}; `recovery_live_count+=1`; `requiredValue += getComputeFee(HUB_PART_GAS_RECOVERY,false)+batchStorageReserveWithBuffer(RECOVERY)`. Клиент вшивает recovery-публикацию в СТАРТ БЕСЕДЫ (первая на первой беседе) — эндаумент оплачен НАПЕРЁД в value батча, НЕ ленивое списание; инвариант «баланс показанный=тратимый» держится.

ЭВИКЦИЯ. `evictExpiredRecovery(maxEvict)` — mirror evictExpiredPrivate, но retention=CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS и un-push через `pruneRecoveryBucketIndex` (копия prunePrivateBucketIndex над recovery_bucket_index). Вызывается own-kind при RECOVERY-батче. РЕШЕНИЕ по boundedness: НЕ добавлять recovery в безусловный capped-sweep (в отличие от intro): recovery низкообъёмный, эндаумент оплачен на 10 лет наперёд, состояние ограничено числом life-time стартов бесед и полностью профинансировано per-entry; own-kind FIFO при следующих recovery-публикациях достаточно. (Альтернатива — unconditional capped recovery-sweep RECOVERY_SWEEP_CAP=2 — в open_risks; она добавляет index-un-push в каждую PUBLIC-tx, что усиливает газ-связку; при 10-лет ретеншне это no-op на декаду.)

ЧТЕНИЕ self-bucketKey — ОТДЕЛЬНЫЙ recovery-геттер (НЕ перегружаем CONV bucket-геттер, т.к. отдельный пул/индекс): `get_recovery_bucket_index(selfBucketKey: Int): PrivateBucketIndexView` (копия get_private_bucket_index над recovery_bucket_index) + `get_recovery_entry(entryId): PrivateCapsuleEntryView`-подобный view (header_0/header_1/body_hash/publish_id/uid recovery-домена) для backward-walk по bucket_prev_link. Клиент: reinstall → self-bucketKey (epoch-сентинел 0, детерминизм из сида) → get_recovery_bucket_index(self) → walk get_recovery_entry(latest→bucket_prev_link) → открывает recipient-веткой на своих секретах. Опц. `get_recovery_bucket_index_batch` (cap 32) для decoy-параллели.

### getters
Формы геттеров, вшиваемые в genesis.

1. `struct PrivateBucketIndexView { exists: Bool; bucket_key: Int; latest_entry_id: Int; latest_entry_link: Int; entry_count: Int; }` — БЕЗ first_publisher_key (OVERRIDE-A: его нет ни в структуре, ни в геттере; sender-метка не отдаётся вообще). `get fun get_private_bucket_index(bucketKey: Int): PrivateBucketIndexView` — ПЕРЕИМЕНОВАНИЕ get_private_sender_index (1059-1078) над private_bucket_index; miss→exists:false,нули. Заменяет PrivateCapsuleKeyIndexView → PrivateBucketIndexView (поле key_id→bucket_key).

2. `const CAPSULEHUB_BUCKET_BATCH_MAX_KEYS: Int = 32;`. `get fun get_private_bucket_index_batch(keys: map<Int as uint16, Int as uint256>): map<Int as uint16, PrivateBucketIndexView>` — foreach по keys, cap 32 (лишние игнор), для каждого ключа кладёт PrivateBucketIndexView по тому же uint16-индексу. Клиент тянет все входящие бакеты (контакты×окно эпох)+decoy одним запросом (D3 RPC-приватность).

3. INTRO-скан (переименование Private*→Intro* над intro_entries). Структуры: `struct IntroScanRecord { entry_id: uint64; created_at: uint64; view_tag: uint16; ephemeral_R: uint256; }`, `IntroScanPageView`/`IntroScanBoundsView` (копии 243-255). `get fun get_intro_scan_bounds(): IntroScanBoundsView` →{intro_oldest_live_id, intro_latest_id}. `get fun get_intro_scan_page(fromEntryId, count): IntroScanPageView` — count clamp≤64 (как 1092-1123), читает ТОЛЬКО header_0 через introHeaderViewTag/introHeaderEphemeralR; тело/header_1 НЕ читаются. Плюс `get fun get_intro_entry(entryId): IntroCapsuleEntryView` (header_0/header_1/body_hash/publish_id/uid intro-домена) — после матча view_tag клиент тянет полную intro-запись для decaps+verify.

4. RECOVERY-геттеры (см. recovery_pool_b): get_recovery_bucket_index, get_recovery_entry (+опц. batch).

УДАЛИТЬ: get_private_sender_index (1059), get_private_scan_bounds (1082), get_private_scan_page (1092) — их место занимают bucket/intro-геттеры. get_private_entry (1018) ОСТАЁТСЯ (CONV-пул), поле author_wallet продолжает отдавать vault_address-заглушку (нет sender-метки).

get_state (1283-1307, CapsuleHubStateView 107-129): += `intro_latest_id`, `intro_live_count`, `intro_oldest_live_id`, `recovery_latest_id`, `recovery_live_count`, `recovery_oldest_live_id` (мониторинг дренажа/бранча трёх+recovery пулов).

### gas_storage
Газ/сторидж по 3 kind + recovery-пул.

STORAGE endowment (20-21). `CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT` (CONV) — ПЕРЕ-мерить БЕЗ +256 (OVERRIDE-A: PrivateCapsuleKeyIndex остаётся 128 бит, first_publisher нет) → остаётся ≈3.3M, worst-case «fresh-bucket-per-entry» = part_count свежих 128-битных bucket-слотов + 2 header-cell + скаляры (НЕ 384-бит слот). Ввести `CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT` ≈1.8-2.2M (нет индекс-слота). `CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT` ≈10× storage-рента (G8; ~20-30M, есть bucket-слот + 10-лет горизонт).

RESERVE-хелперы (352-363). Добавить `introIndexStorageReservePerEntry()=CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE+CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT` и `recoveryIndexStorageReservePerEntry()=KEEPALIVE+RECOVERY_ENDOWMENT`. **БЛОКЕР funds-safety: indexStorageReserve() (360-363) ОБЯЗАН добавить** `+ (self.intro_live_count*self.introIndexStorageReservePerEntry()) + (self.recovery_live_count*self.recoveryIndexStorageReservePerEntry())` внутрь base ДО умножения на 1.25-буфер. Иначе intro/recovery-эндаумент классифицируется как excess → SweepExcessReserve (997-1016)/FlushFees (965-983) выведут TON, бэкающий живой сторидж → необратимый дренаж. protectedReserve() (365-372) авто-растёт на все пулы через indexStorageReserve.

batchStorageReserveWithBuffer(kind) (786-791): текущее `endowment=PUBLIC; if PRIVATE→PRIVATE` → 4-way: PUBLIC/CONV(PRIVATE)/INTRO/RECOVERY endowment. ACK-строка `kept` (949) уже вызывает batchStorageReserveWithBuffer(msg.publish_kind) — заработает 4-way автоматически.

GAS (54-58). `HUB_PART_GAS_PRIVATE` (CONV): коммент «2 index pushes» УСТАРЕЛ (OVERRIDE-A: 1 bucket-push БЕЗ publisher-сравнения + auto-evict-1 (1 bucket un-push+header-parse+del) + доля capped intro-sweep-del); ПЕРЕ-мерить. `HUB_PART_GAS_PUBLIC`: += доля capped intro-sweep-del → поднять. Ввести `HUB_PART_GAS_INTRO` (0 index-push, дешевле; включает own-kind intro-sweep) и `HUB_PART_GAS_RECOVERY` (bucket-push+recovery own-kind sweep, ≈CONV). Все — provisional, финал после G8. Vault batchHubPartGas (Vault:1002-1004) ЗЕРКАЛИТЬ 4-way + VAULT_PART_GAS_INTRO/RECOVERY; STORAGE_RESERVE_PRIVATE (Vault:363) держать + ввести STORAGE_RESERVE_INTRO/RECOVERY; **любой рассинхрон Hub-константа↔Vault → Vault недодержит → throw 13530 (929) → bounce → permanent liveness-break на immutable**. Пин каждого HUB_PART_GAS_* делает ОДИН генератор из ABI (G2). getComputeFee-вызовы в requiredValue (866/922 + новые INTRO/RECOVERY) + Phase-A lower-bound 13509 (822, HUB_MIN_PER_PART_VALUE kind-независим — OK). G8 combo worst-case ОТДЕЛЬНО: PUBLIC 8×32K+intro-sweep, CONV 8×32K+intro-sweep, INTRO 8×32K, RECOVERY 8×32K; недодержание на 1 газ-юнит → детерминированный 13530-bounce-refund тест.

### open_risks
CONV↔RECOVERY одинаковой длины 320: длина header0 их НЕ различает (только batch-kind). Обязательна per-kind assert privateHeaderPublishKind(header0)==msg.publish_kind (13519/13549/13559), иначе багнутый/злой клиент кладёт CONV-байты под kind=4 и наоборот. Абуз recovery-пула (10-лет сторидж) не является дренажом (публикатор платит RECOVERY endowment), но mislabel засоряет пул — assert закрывает дёшево.
RECOVERY boundedness: рекомендован own-kind FIFO sweep ТОЛЬКО (не unconditional capped). Если пользователь перестаёт стартовать беседы, recovery-пул не самоподметается 10 лет — приемлемо (per-entry профинансировано наперёд, состояние = life-time стартов бесед), НО не «bounded-by-construction» как intro. Альтернатива (unconditional capped RECOVERY_SWEEP_CAP=2 на всех kind) добавляет bucket-index-un-push в каждую PUBLIC-tx → усиливает газ-связку HUB_PART_GAS_PUBLIC. Owner-решение до seal.
RECOVERY_ENTRY_STORAGE_ENDOWMENT под 10-лет горизонт — самый неопределённый storage-пин; недомер = необратимый дренаж на immutable, перемер = переплата за старт беседы. Требует прямого G8-замера ренты за 10 лет (не экстраполяция от 1-год CONV).
RECOVERY_POOL_RETENTION_SECONDS=94608000 вшивается в genesis необратимо. Если 3 лет недостаточно (пользователь неактивен >3 лет) — recovery-капсула эвиктится, K_root потерян. Это остаточный, задокументированный BLOCKER-tail; 3 года = owner-принятая граница (2026-07-15).
Газ-мирроринг Hub↔Vault теперь по 4 kind (CONV/PUBLIC/INTRO/RECOVERY) вместо 2 — поверхность рассинхрона выросла. G2-генератор ОБЯЗАН ре-пинить все 4 HUB_PART_GAS_* + 3 header0-шейпа из компилированного ABI, красный тест на любой остаточный 592 или рассинхрон.
Безусловный capped intro-sweep связывает liveness самой частой PUBLIC-операции с оценкой стоимости intro-map-del. INTRO_SWEEP_CAP=4 декуплирует от part_count, но HUB_PART_GAS_PUBLIC несёт этот запас НАВСЕГДА — недомер intro-del-газа = недофинанс каждого public-поста. G8 обязан заложить измеренный запас явно, не растворять.
meta-publishKind assert (privateHeaderPublishKind) — лёгкое расширение opaque-трактовки bucketKey (контракт начинает читать байт@5 header0). Согласовать с клиентским инвариантом «publish_kind confusion закрыт клиентом»: это defense-in-depth дубль, не замена; убедиться, что магик/version не проверяются лишнего (только байт@5).

---

## Vault план
### header0_mirror
ЗЕРКАЛА ПИНОВ + 3(4)-way walk в Vault.tact (привязка к строкам).

(1) Пины header0 (Vault.tact L78–83). Удалить `CAPSULEHUB_PRIVATE_HEADER0_BITS=592` (L78). Ввести зеркала Hub:
- `CAPSULEHUB_CONV_HEADER0_BITS = 320` (40Б, 1 cell, 0 refs)
- `CAPSULEHUB_INTRO_HEADER0_BITS = 336` (42Б, 1 cell, 0 refs)
`_HEADER0_CELLS=1`/`_HEADER0_REFS=0` (L80–81), `_HEADER1_BITS=240` (L79), `_HEADER1_CELLS/REFS` (L82–83), `CAPSULEHUB_PUBLIC_HEADER_MAX_*` (L85–87) — НЕ трогать (общие). RECOVERY отдельного header0-шейпа НЕ вводит: recovery-капсула CONV-формы (320, self-bucketKey epoch-0 в слоте bucketKey), различает её ТОЛЬКО батч-уровневый publish_kind=4.

(2) Kind-константы (L56–57): добавить `const PUBLISH_KIND_INTRO: Int = 3;` и `const PUBLISH_KIND_RECOVERY: Int = 4;` рядом с PUBLISH_KIND_PRIVATE=1/PUBLIC=2. CONV=PUBLISH_KIND_PRIVATE=1 — существующий kind переиспользуется как CONV (переименовать в комментарии, значение НЕ менять).

(3) Шейп-валидаторы (L968–976). Расщепить `isPrivateCapsuleShapeValid`:
- `isConvCapsuleShapeValid(sizeClass,cryptoSuite,h0Cell,h1Cell,body)` = `isExactCapsuleCell(h0Cell,1,CAPSULEHUB_CONV_HEADER0_BITS=320,0)` && header1(1,240,0) && body(privateBody* по sizeClass/HYBRID).
- `isIntroCapsuleShapeValid(...)` = то же, header0 `...INTRO_HEADER0_BITS=336`, body через ОТДЕЛЬНЫЙ overhead (см. п.4).
RECOVERY использует `isConvCapsuleShapeValid` (320).

(4) INTRO body-overhead (L84/L902–926). INTRO-тело несёт ct_root(1088Б)+identity+бандл+introNonce сверх 1204 (L84 `CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES`). Ввести `CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES` (провизорно ≈2388Б, точно — G8) и kind-параметризовать `privateBodyOverheadBytes`/`privateBodyBytes`/`Cells`/`Bits`/`Refs` (L907–926) под INTRO ЛИБО завести intro-специфичные body-функции для `isIntroCapsuleShapeValid`. CONV/RECOVERY остаются на 1204.

(5) isPublishProfileValid (L872–887). Ветки для kind 3 и 4 идентичны PUBLISH_KIND_PRIVATE-ветке (L873–878): `header0!=0 && header1!=0 && isAllowedPrivateSizeClass && cryptoSuite==CRYPTO_SUITE_HYBRID`. Форма 320/336 здесь НЕ проверяется (h0/h1 — скаляр-хэши), различие форм — в шейп-валидаторе walk'а. Практически: `if (publishKind==PRIVATE||publishKind==INTRO||publishKind==RECOVERY) {приватная проверка}`.

(6) Kind-гейт post-accept (L2153–2157). `(kind==PUBLISH_KIND_PRIVATE)||(kind==PUBLISH_KIND_PUBLIC)` → +`||(kind==PUBLISH_KIND_INTRO)||(kind==PUBLISH_KIND_RECOVERY)`.

(7) Walk (L2183–2255). Условие L2190 `if (kind==PUBLISH_KIND_PRIVATE)` перестроить: `if (kind==PUBLISH_KIND_PUBLIC) {публичная ветка L2213–2239} else {приватно-семейная CONV/INTRO/RECOVERY}`. Фрейм части ЕДИН для CONV/INTRO/RECOVERY: `part.bits()==784 && part.refs()==(isLast?3:4)` (L2193) — header0/header1/body суть refs, биты header0 (320 vs 336) фрейма НЕ меняют. Внутри выбрать валидатор: `if (kind==PUBLISH_KIND_INTRO) shapeOk=isIntroCapsuleShapeValid(...) else shapeOk=isConvCapsuleShapeValid(...)` (CONV+RECOVERY). Reject-коды переиспользуются БЕЗ новых: RJ_PART_SHAPE(0x11)/RJ_CLASS_OR_SUITE(0x12)/RJ_HASH_MISMATCH(0x13)/RJ_PAYLOAD_SHAPE(0x14). Fail-closed: 336 в CONV/RECOVERY → isConvCapsuleShapeValid=false → RJ_PAYLOAD_SHAPE(0x14) reject+refund; 320 в INTRO симметрично.

(8) computeBatchPublishId (L1013–1024, L2257) уже включает `kind` (storeUint(kind,8)) → INTRO/RECOVERY получают отдельные publish_id/bounceId-пространства, коллизий с CONV нет.

G2 ассертит из ABI ТРИ header0-шейпа 576/320/336, зеркало Hub↔Vault, БЕЗ остаточного 592 (RECOVERY 4-го шейпа не добавляет).

### author_wallet
author_wallet — fixed-width Address, пин 924 НЕ трогать; sentinel = чисто клиентский, БЕЗ Vault-ветки.

(1) `HUB_BATCH_MSG_ROOT_BITS=924` (L348) и его вывод (L345–347: op32+bounce_id64+bounce_tag160+publish_id256+kind8+part_count8+protocol_fee128+author_wallet267+marketing1=924) — НЕ трогать для ВСЕХ 4 kind. `author_wallet: Address` в `PublishBatchToHub` (L222) остаётся fixed-width. Дроп/`Address?` ЗАПРЕЩЁН (необратимо ломает 924 → рассинхрон hubMsgBits L2281 → недофинанс hubFwd → bounce). G2 стабилен.

(2) hubMsgBits (L2281) `(measuredBits-1016)+HUB_BATCH_MSG_ROOT_BITS` — авто-корректен для INTRO: `measuredBits` через `computeDataSize` (L2275) уже включает +16 бит INTRO header0 (336 vs 320) на часть; правки формулы НЕ требуется. `marketing +152` (L2282–2284) остаётся ТОЛЬКО для PUBLIC.

(3) РЕШЕНИЕ по sentinel (согласуется с OVERRIDE-A + red-team contract-lens minor #7): НЕ вводить kind-ветку форварда в Vault. Строка L2352 `author_wallet: msg.owner_wallet` остаётся БЕЗУСЛОВНОЙ для всех 4 kind:
- CONV (kind 1): author_wallet = РЕАЛЬНЫЙ owner_wallet. При OVERRIDE-A он в Hub НЕ используется вообще (first_publisher_key удалён целиком — ни push-сравнения, ни хранения). Транзитная видимость отправителя — принятый residual #4.
- INTRO (kind 3): «sentinel» = приватностная косметика, НЕ safety-требование. IntroCapsuleEntry author_wallet НЕ хранит, индекса у INTRO нет → поле мёртвое в Hub. Отправитель и так виден в транзитной tx. Sentinel, если нужен для чистоты ХРАНИМОГО тела, кладётся клиентом ВНУТРЬ шифр-тела/identity-секции, а НЕ в поле author_wallet. Vault forward НЕ различает kind → минус одна immutable-ветка на 924.
- RECOVERY (kind 4): self→self, author_wallet = owner_wallet ожидаемо (who-to-SELF уже раскрыт self-bucketKey, принятый residual крипто-ревью #3).

Итог: НИКАКОГО кода author_wallet в Vault не меняется. Явно снять «Vault INTRO sentinel-ветку» из чек-листа (перенесено в client-only). Аудит-инвариант: «Vault форвардит owner_wallet для всех kind; sentinel INTRO — client-body-only».

### charge_model
Батч-заряд/возврат по 4 kind (CONV/INTRO/PUBLIC/RECOVERY); canonicalTotal покрывает всё.

(1) Kind-хелперы (L997–1010) — с 2-way до 4-way:
- `batchStorageReserve(kind)` (L997–1000): +INTRO→STORAGE_RESERVE_INTRO, +RECOVERY→STORAGE_RESERVE_RECOVERY (CONV=STORAGE_RESERVE_PRIVATE fall-through).
- `batchHubPartGas(kind)` (L1002–1005): +INTRO→HUB_PART_GAS_INTRO, +RECOVERY→HUB_PART_GAS_RECOVERY.
- `batchVaultPartGas(kind)` (L1007–1010): +INTRO→VAULT_PART_GAS_INTRO, +RECOVERY→VAULT_PART_GAS_RECOVERY.

(2) Новые/пере-мереные пины (L363–374):
- `STORAGE_RESERVE_PRIVATE` (L363, 4.3M): OVERRIDE-A убрал first_publisher_key → PrivateCapsuleKeyIndex снова 128 бит → endowment пере-мерить БЕЗ +256-довеска (ориентир ~3.3M, фикс G8 worst-case fresh-bucket-per-entry).
- `STORAGE_RESERVE_INTRO` (нов., ~1.8–2.2M+keepalive; нет index-слота, но больше body-overhead — G8).
- `STORAGE_RESERVE_RECOVERY` (нов., 10-летний эндаумент — см. recovery_endowment).
- `VAULT_PART_GAS_INTRO`/`VAULT_PART_GAS_RECOVERY` (нов., у L369–370).
- `HUB_PART_GAS_INTRO`/`HUB_PART_GAS_RECOVERY` (нов., у L372–373). Комментарий L372 («2 index pushes») УСТАРЕЛ при OVERRIDE-A: теперь 1 bucket-push (без publisher-сравнения)+auto-evict-1+capped intro-sweep-del. Поднять HUB_PART_GAS_PUBLIC/_PRIVATE под безусловный capped INTRO_SWEEP.

(3) Walk-аккумуляция (L2244–2246) БЕЗ структурных правок: `totalFee/totalHubGas/totalStorage` уже суммируют `discountedFee`/`batchHubPartGas(kind)`/`batchStorageReserve(kind)` → 4-way хелперы подхватываются.

(4) canonicalTotal (L2294–2301) БЕЗ правки формулы: все kind-зависимые слагаемые (vaultCompute L2287=batchVaultPartGas, hubFwd L2286, totalHubGas, totalStorage) берут kind → INTRO/RECOVERY покрыты. maxCharge-гейт (L2302 `maxCharge<canonicalTotal → RJ_UNDERPRICED 0x16`) держит.

(5) Pre-accept floor (L2131) — kind-НЕЗАВИСИМ, НЕ трогать; reject-путь (L2306–2316, batchChargeFloor L1028) kind-независим. G8 подтверждает kind-независимость floor для новых форм.

(6) Success/refund (L2318–2336) БЕЗ правок: callValue (L2320) несёт totalStorage к Hub; PendingBatchPublish.publish_kind (L266/L2331) хранит kind; ACK (L2601–2617) и bounce (L2624–2643) через creditBatchSettlementRefund (L2579, cap на refundable_amount L2588) корректны для всех kind.

IMMUTABLE: любой рассинхрон HUB_PART_GAS_* Hub↔Vault(batchHubPartGas) → Vault недодержит → Hub throw 13530 → bounce → permanent liveness-break. ОДИН генератор G2 пинит каждый HUB_PART_GAS_{PRIVATE,PUBLIC,INTRO,RECOVERY} из ABI зеркально. STORAGE_RESERVE_{INTRO,RECOVERY} (Vault) >= per-entry эндаумента Hub.

### recovery_endowment
OVERRIDE-B: 10-летний recovery-эндаумент ВШИТ в стоимость старта беседы через ОБЫЧНЫЙ charge-путь (kind=4), НЕ ленивое списание.

МОДЕЛЬ. Recovery/PREFS-капсула = отдельный батч publish_kind=PUBLISH_KIND_RECOVERY=4, CONV-формы (header0 320, self-bucketKey epoch-сентинел-0), Hub маршрутизирует в ОТДЕЛЬНЫЙ пул `recovery_entries` с ~10-летним retention (CapsuleHub-пины RECOVERY_POOL_RETENTION, CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT). Vault различает ТОЛЬКО по батч-kind (header0 опаков/320).

ГДЕ В VAULT CHARGE-ПУТИ (без нового кода списания — переиспользуется батч-заряд):
- `batchStorageReserve(PUBLISH_KIND_RECOVERY)` (L997–1000) → `STORAGE_RESERVE_RECOVERY` = 1M keepalive + 10-летний per-entry эндаумент (ориентир ~10× приватного, ~35–50M; точно — G8-мера storage-fee за 10 лет для recovery-entry + recovery-bucket-index-слота). Пагинация контактов → несколько recovery-entry, каждая инкрементально.
- Слагаемое входит в `totalStorage` (walk L2246) → `canonicalTotal` (L2299 `totalStorage*125/100`) → maxCharge-гейт (L2302) → ЕДИНЫЙ дебет `user.ton_balance -= maxCharge` (L2136). 10-летний эндаумент заряжается НАПЕРЁД одним списанием при публикации recovery-капсулы.
- `callValue` (L2320) несёт totalStorage к Hub (L2341 value=callValue), Hub резервирует в recovery-пуле (indexStorageReserve += recovery). НЕ ленивое: НИГДЕ не добавляется периодическое списание ренты из ton_balance.

«ВШИТ В СТАРТ БЕСЕДЫ» = client-оркестрация (Фаза 2, app.js): при ПЕРВОМ контакте клиент публикует INTRO(kind3) И recovery-снапшот(kind4) в одной операции старта; каждая новая беседа auto-рефрешит recovery-окно (новый recovery-entry с fresh 10-летним эндаументом под тем же self-bucketKey epoch-0). Со стороны Vault recovery — просто ещё один заряжаемый батч; инвариант «баланс показанный = тратимый» держится, т.к. ton_balance трогается ТОЛЬКО явными заряжаемыми publish'ами, а отправка обычного CONV заряжается ТОЛЬКО за это сообщение (STORAGE_RESERVE_PRIVATE, не recovery).

ЧТЕНИЕ: self-bucketKey (epoch-сентинел-0, детерминизм из сида) читается тем же bucket-геттером над recovery-пулом ЛИБО отдельным `get_recovery_bucket_index`/`_batch` (решение CapsuleHub — Vault геттеров публикации не отдаёт). Reinstall из мнемоника → self-bucketKey вычислен → recovery найдена ОДНИМ lookup независимо от давности (epoch-0 фикс закрывает узость окна W=2).

RECOVERY gas-зеркала: `VAULT_PART_GAS_RECOVERY`/`HUB_PART_GAS_RECOVERY` (recovery-pool push + own-kind recovery-sweep; recovery-sweep НЕ безусловен на каждом publish — 10-летний пул низкочастотен, метём own-kind, чтобы не грузить горячий PUBLIC-путь). Мирроринг Hub↔Vault через G2, G8 отдельным worst-case по kind=4.

Инвариант (аудит): recovery-эндаумент НЕ рента из ton_balance; это upfront-заряд kind=4 publish в момент старта беседы; отправка CONV его НЕ трогает. STORAGE_RESERVE_RECOVERY (Vault) >= CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT (Hub) — иначе immutable-дренаж.

### open_risks
G2-ЗЕРКАЛО ПИНОВ (immutable): три header0-шейпа 576/320/336 ре-пинить ОДНИМ генератором из компилированного ABI зеркально Hub↔Vault, БЕЗ остаточного 592 (Vault L78). Смешение шейпов или рассинхрон Hub↔Vault необратим; conformance fail-closed: 336 в CONV/RECOVERY-ветке → RJ_PAYLOAD_SHAPE(0x14).
GAS-МИРРОРИНГ 4 kind (immutable liveness-блокер): каждый HUB_PART_GAS_{PRIVATE,PUBLIC,INTRO,RECOVERY} (Vault L372–373 batchHubPartGas L1002–1005) обязан зеркалить Hub-константу. Безусловный capped INTRO_SWEEP на каждом publish поднимает HUB_PART_GAS_PUBLIC/_PRIVATE; любой пропуск зеркала → Vault недодержит hubFwd → Hub throw 13530 → bounce → каждый publish этого размера навсегда падает. Обязателен G8 combo worst-case ОТДЕЛЬНО по 4 kind (PUBLIC 8×32K+intro-sweep, CONV 8×32K+intro-sweep, INTRO 8×32K, RECOVERY 8×32K).
STORAGE-РЕЗЕРВ >= HUB-ЭНДАУМЕНТ (immutable funds-safety): STORAGE_RESERVE_INTRO и STORAGE_RESERVE_RECOVERY (Vault) >= per-entry эндаумента Hub; Hub indexStorageReserve()/protectedReserve() обязаны расти на ВСЕ пулы включая intro+recovery, иначе эндаумент = excess → SweepExcessReserve выведет бэкинг живого сториджа → необратимый дренаж. Vault-сторона: корректность зеркала резерва; enforcement в CapsuleHub.
INTRO BODY-OVERHEAD: INTRO-тело несёт ct_root(1088Б) сверх 1204 (L84) → нужен CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES + kind-параметризация privateBody* (L907–926), иначе isIntroCapsuleShapeValid отвергнет валидные INTRO или недомерит эндаумент. Значение фиксируется в G8; на immutable недомер → дренаж.
STORAGE_RESERVE_RECOVERY масштаб (immutable, не тюнится): 10-летний эндаумент пере-мерить точно (storage-fee за 10 лет для recovery-entry + recovery-bucket-index-слота). Недооценка → recovery-пул недофинансирован → recovery-капсула собирается Hub по storage → потеря графа/переписки. RECOVERY_POOL_RETENTION вшивается в genesis (CapsuleHub) — постфактум не тюнится.
STORAGE_RESERVE_PRIVATE пере-мера при OVERRIDE-A: first_publisher_key УДАЛЁН → PrivateCapsuleKeyIndex снова 128 бит → endowment пере-мерить БЕЗ +256-довеска (worst-case fresh-bucket-per-entry). НЕ оставлять раздутое значение спека §7.
recovery как 4-й kind — client-оркестрация: «вшитость в старт беседы» держится на том, что клиент публикует recovery(kind4) при первом контакте (Фаза 2, app.js). Если клиент не опубликует — эндаумент не заряжен и recovery-капсулы нет → потеря K_root после reinstall. Vault не может форсить; conformance-тест «первый контакт → recovery-капсула опубликована и заряжена 10-лет-эндаументом» обязателен.
author_wallet client-only sentinel: решение НЕ вводить Vault-ветку (L2352 owner_wallet безусловно). Если позже кто-то добавит kind-ветку/Address? ради sentinel — сломает 924/hubMsgBits. Аудит-инвариант «Vault форвардит owner_wallet для всех kind».
BATCH_FLOOR kind-независимость (L2131): проверить в G8, что pre-accept floor корректен worst-case для INTRO (больший body/hubMsg) и RECOVERY; floor kind-независим по import, но убедиться что не недооценён для новых форм.
ReplaceMessagingKeys (уже в контракте): ротация keyId меняет K_root/bucketKey/self-recovery-дериватор mid-conversation — вне Vault-правок, но open: триггер ре-intro/versioned-per-keyId контакт-стор (крипто-ревью availability #8) решить до genesis, иначе до-ротационная переписка и recovery нечитаемы.