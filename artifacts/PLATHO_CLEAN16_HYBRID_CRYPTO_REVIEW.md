# Platho гибрид-крипта — adversarial review (wabhobjzv)

> verdict: **sound-with-fixes**, ready_for_contract=false. Крипто-брейков НЕТ. 4 must_fix ПРИМЕНЕНЫ (52+10 тестов зелёных).

## SUMMARY
Крипто-ядро гибрида (ML-KEM + X25519 → K_root, conv/intro-лейны, stealth-адресация, детерминированные бакеты) в целом ЗДОРОВОЕ: секретность K_root, доменная сепарация, low-order-guard, направленность бакетов и нелинкуемость view_tag'ов проверены и держатся; ML-KEM-половина K_root закоммичена ct_root, активная подмена тела ломает GCM-тег. Итог по 5 линзам: 2×sound, 3×sound-with-fixes. Реальных крипто-брейков нет.

Главный содержательный риск — ОДИН major (линза «хендшейк»): привязка keyId_A → зарегистрированные в Vault sign/enc/mlkem-ключи НЕ форсится ВНУТРИ крипто-границы; openIntroHandshake аутентифицирует лишь владение in-body sign-ключом, который отправитель сам вложил и сам подписал (self-consistent). Если интегратор Фазы 3/4 забудет обязательную сверку с Vault-KeyRecord, незнакомец M публикует INTRO «от жертвы» (keyId_A=жертвы, подпись своим ключом — все GCM/hash/капсульная+транскрипт-подписи проходят) и получает подмену первого контакта + K_root под своим контролем. Ревьюеры единогласно пометили это within_scope=false (делегировано app-layer/контракту), поэтому по правилам это НЕ within_scope-блокер, но это самый важный пункт — вынесен в accepted_residuals как ОБЯЗАТЕЛЬНЫЙ гейт до запуска first-contact.

within_scope-находки все severity=minor, но на immutable-деплое их стоит закрыть до контракта: (1) транскрипт коммитит keyId_A, но НЕ senderEncPublicKey — классическая DH-половина K_root подписью не покрыта, а хедер-коммент это overclaim'ит; (2) легаси private-путь не валидирует publish_kind (можно опубликовать 74B-header, помеченный INTRO → засорение пула); (3) introNonce подписан, но нигде не сверяется, replayCache опционален → дублированный first-contact при повторе; (4) capsule.kind vs header0.kind не сверяются на равенство. Все четыре — дешёвые фиксы, реальные дефекты, не раздутые. Плюс два функциональных nice-to-have (диспетчер парса CONV/INTRO из чейна — иначе retrieve Фазы 2/4 не заработает; вывод bucketKey внутри seal против epoch↔createdAt-скью).

Принятые остатки (traffic-analysis на O(1)-бакетах, статичный self-bucket-fingerprint, 16-бит view_tag, тайминг-граф диалогов, зависимость от ANO-CCA/key-privacy ML-KEM) — осознанные, не блокеры, но требуют внешнего аудита перед immutable clean-16.

## MUST-FIX (все применены 2026-07-14)
- [x] Транскрипт INTRO должен коммитить senderEncPublicKey рядом с keyId_A (intro-handshake.mjs:122-133 buildIntroTranscript): статический X25519-ключ A образует классическую половину K_root (dhShared=X25519(a,B)), но подписью НЕ покрыт — аутентичность encPub целиком висит на app-layer. Добавить 32B A-enc-pub в FROZEN-транскрипт И убрать overclaim из хедер-коммента модуля (стр.13-16), ложно заявляющего привязку обоих KEM/всех ключевых материалов против misbinding. Закрывает крипто-половину major-риска подмены первого контакта.
- [x] Зеркалить валидацию publish_kind в легаси private-пути (platho-crypto.mjs:2316 privateCapsuleHeader0Bytes / :2360-2368 ...ObjectFromBytes): в отличие от CONV(=1)/INTRO(=3) сериализаторов и парсеров, легаси 74B-путь пишет и читает header0.publishKind БЕЗ проверки ==PRIVATE. Отправитель может опубликовать самосогласованно подписанный 74B legacy-header с publish_kind=3(INTRO) → мисмаршрутизация в INTRO-пул / спам-DoS. Добавить throw при publishKind!=CAPSULE_PUBLISH_KIND.PRIVATE и на запись, и на парс.
- [x] Анти-реплей INTRO (intro-handshake.mjs:237 openIntroHandshake / platho-crypto.mjs:3143): introNonce вшит в транскрипт и подписан, но НИГДЕ не сверяется на свежесть; единственная защита — опциональный replayCache по capsule.id (дефолт OFF). Байт-идентичный повтор капсулы даёт валидный транскрипт+подпись+nonce → повторный K_root (идемпотентно) и ПОВТОРНАЯ выдача firstMessageBytes = дублированный first-contact. Сделать replayCache обязательным (fail-closed) в open-пути INTRO ЛИБО убрать заявление «anti-replay nonce» (nonce даёт только freshness при наличии seen-set на приёме).
- [x] Добавить assert capsule.kind === capsule.header0.kind в verifyEncryptedPrivateCapsule (platho-crypto.mjs:2967-2974): сейчас top-level kind и header0.kind валидируются на принадлежность {private,conv,intro} НЕЗАВИСИМО, равенство не требуется — капсула kind='conv'/header0.kind='intro' пройдёт verify. Криптографически не эксплойтится (вся маршрутизация ключуется по header0.kind), но на immutable-деплое это копеечное закрытие инварианта, способное ввести app-диспетчер в заблуждение.

## NICE-TO-HAVE
1. Диспетчер parse-from-bytes по длине header0 (40→CONV / 42→INTRO / 74→private, с проверкой магии) в privateCapsuleFromChainEntry (platho-crypto.mjs:3080): сейчас жёстко зовётся только 74B legacy-парсер → любая CONV/INTRO-капсула, поднятая из CapsuleHub, падает на 'header0 binary size drift'. Не крипто/приватность (fail-closed), но БЕЗ этого retrieve Фазы 2/4 для CONV/INTRO функционально не заработает; in-memory юнит-тесты дыру не ловят (открывают уже собранный объект, минуя парс из BOC).
2. Выводить bucketKey ВНУТРИ createEncryptedConvCapsule (platho-crypto.mjs:2781) из (kRoot, selfKeyId, peerKeyId, header1.createdAt) через outgoingBucketKey вместо приёма непроверяемым 32B-аргументом: устраняет по конструкции рассинхрон epoch↔createdAt (клиентский скью/баг → публикация под бакетом, который получатель не сканирует → тихая потеря сообщения). Availability, не линкуемость.
3. В openIntroHandshake ассертить keyIdA==computeHybridKeyId(senderEncPublicKey, senderMlKemPub) при наличии in-body mlKem pub: расхождение encPub↔keyId упадёт явной ошибкой вместо тихого K_root-divergence (весь последующий CONV-трафик не расшифруется).

## ПРИНЯТЫЕ ОСТАТКИ / ГЕЙТЫ
1. ОБЯЗАТЕЛЬНЫЙ гейт до запуска first-contact (не крипто-ядро, помечен within_scope=false, но НЕ проглатывать): keyId_A→Vault-биндинг sign/enc/mlkem-ключей не форсится внутри крипто-границы — openIntroHandshake/openEncryptedIntroCapsule (platho-crypto.mjs:3155-3162) аутентифицируют лишь владение in-body sign-ключом. Без обязательной app-layer сверки hs.senderSigningPublicKey И hs.senderEncPublicKey с живой Vault-KeyRecord незнакомец M выдаёт INTRO «от жертвы» → полная подмена первого контакта + K_root под контролем M (это единственный major по всем 5 линзам). must_fix №1 закрывает лишь крипто-половину (подпись encPub). Перед контрактом сделать Vault-cross-check обязательным (fail-closed / callback-резолвер) в open-пути.
2. Traffic-analysis, присущий O(1)-дизайну: bucketKey детерминирован per (K_root,dir,epoch)=HKDF(K_epoch,BUCKET||dir||epoch) → пассивный скрейпер без K видит непрозрачный бакет, кластеризует и СЧИТАЕТ объём на анонимную пару-направление-сутки + оценивает степень графа отправителя (author_wallet виден), НЕ раскрывая получателя (два направления и эпохи взаимно нелинкуемы). Принято, эквивалент тайминг/RPC-видимости; рандомизация соли per-message ломает O(1) и отклонена дизайном.
3. self-lane bucket статичен навсегда (CONV_SELF_EPOCH_SENTINEL, epoch 0, отдельный keyspace) → отличимый per-wallet fingerprint 'у W есть recovery-снапшот', обновляемый годами без ротации. Это who-to-SELF, пир не раскрывается. Принято (дизайн выбрал 1 lookup).
4. view_tag INTRO 16 бит: для пассивного скрейпера псевдослучаен и НЕ оракул (нужен scan_secret); разные эфемералы e → нелинкуемые тэги; ephemeralR переиспользован для scan≠enc без кросс-протокольной утечки. Единственный эффект — ~1/65536 ложных совпадений → лишний дешёвый ML-KEM decap у получателя. Проверено чисто, фикс не нужен.
5. Тайминг-граф диалогов (получатель N ≈ отправитель N+1) stealth-редизайном НЕ закрывается — известный принятый остаток (MEMORY: metadata-graph-stealth-redesign).
6. Квантовый/внешний гейт: весь разрыв графа «кто-кому» держится на ANO-CCA / key-privacy гибрида ML-KEM (иначе граф не рвётся) — внешнее криптографическое допущение; требуется внешний аудит перед immutable clean-16 редеплоем.

---

## RED-TEAM ПО ЛИНЗАМ

### PQ/KEM/K_root — генуинность ML-KEM, доменная сепарация ct_root vs body_KEM_ct, деривация K — sound

**[minor, ОСТАТОК] K_root на стороне ответчика зависит от dhShared = X25519(b_sk, parsed.senderEncPublicKey), но транскрипт НЕ коммитит senderEncPublicKey напрямую. Он коммитит keyId_A, а keyId_A = sha256(x25519PubA ‖ H(mlKemPubA)) (computeHybridKeyId, platho-crypto.mjs:1768) — т.е. x25519-ключ A ВНУТРИ keyId_A, но openIntroHandshake нигде не проверяет, что parsed.senderEncPublicKey совпадает с ключом, вшитым в keyId_A. Ядро крипто самостоятельно эту проверку сделать не может (mlKemPubA в intro-payload не передаётся, keyId_A не пересчитывается), поэтому единственный барьер — документированное app-layer связывание {keyIdA, senderEncPublicKey} с Vault-KeyRecord (комментарий :235-236).** (web/crypto/intro-handshake.mjs:237-266 (openIntroHandshake) + :122-133 (buildIntroTranscript))

Не MITM (тело запечатано AES-GCM под ML-KEM к B, подменить senderEncPublicKey в теле нельзя без секрета B). Реальный остаточный риск: если интегратор Фазы 3/4 забудет обязательную Vault-сверку senderEncPublicKey, ответчик B заведёт K_root/диалог с enc-ключом, не привязанным к подписанной идентичности A (UKS/misattribution окно). Подпись транскрипта при этом валидна, т.к. поле senderEncPublicKey ею не покрыто.

_fix:_ Defense-in-depth: включить senderEncPublicKey (32B A-enc pub) в FROZEN-транскрипт buildIntroTranscript рядом с keyId_A, чтобы подпись A связывала именно тот enc-ключ, из которого выводится dhShared/K_root. Так связывание перестаёт целиком висеть на app-layer Vault-гейте.

### ХЕНДШЕЙК/АУТЕНТИФИКАЦИЯ (INTRO transcript, verify-after-decrypt, UKS/misbinding, anti-repl — sound-with-fixes

**[major, ОСТАТОК] openIntroHandshake/openEncryptedIntroCapsule аутентифицируют ТОЛЬКО владение in-body подписным ключом (он же встроен в тело отправителем и им же подписан транскрипт — self-consistent). Привязки keyId_A -> зарегистрированные в Vault sign/enc/mlkem-ключи внутри крипто-границы НЕТ; она делегирована app-layer и ничем не форсится в open-пути.** (web/crypto/platho-crypto.mjs:3155-3162 (openEncryptedIntroCapsule) + intro-handshake.mjs:237-266 (openIntroHandshake))

Незнакомец M публикует INTRO-капсулу к B: в теле (identity-секция) кладёт СВОЙ ed25519 sign-pubkey, в intro payload ставит keyId_A = keyId жертвы, подписывает транскрипт своим секретом. Все крипто-проверки (GCM-тег, bodyHash, капсульная подпись, transcript-подпись) проходят. Если приложение при открытии не сверит hs.senderKeyId с живой Vault-записью (sign==hs.senderSigningPublicKey и enc==hs.senderEncPublicKey), B принимает первый контакт и firstMessageBytes 'от жертвы' + K_root, который контролирует M → полная подмена первого контакта.

_fix:_ Сделать Vault-cross-check обязательным в open-пути (или требовать callback-резолвер): до отдачи контакта проверять, что hs.senderSigningPublicKey И hs.senderEncPublicKey == ключи, зарегистрированные для hs.senderKeyId. Не полагаться на то, что каждый вызывающий помнит про биндинг.

**[minor] Подписанный транскрипт коммитит keyId_A, но НЕ senderEncPublicKey — статический X25519-ключ A, образующий классическую половину K_root (dhShared = X25519(a,B)). При этом хедер-коммент модуля (стр.13-16) заявляет, что транскрипт связывает ОБА KEM + все ключевые материалы против misbinding — это overclaim.** (web/crypto/intro-handshake.mjs:122-133 (buildIntroTranscript) + 153 (serializeIntroPayload))

Не ломает секретность K_root (ML-KEM-половина остаётся секретной, т.к. ct_root закоммичен и ss знает только A/B), поэтому не clean break. Но классическая DH-половина не аутентифицирована подписью: если app свяжет keyId_A только с sign-ключом, а enc-ключ не сверит с Vault, нет подписного доказательства, что encPub принадлежит A — вся классическая PFS-компонента держится исключительно на app-layer enc-биндинге (см. finding #1).

_fix:_ Добавить senderEncPublicKey в транскрипт (рядом с keyId_A) — дёшево и закрывает разрыв на крипто-уровне; либо явно задокументировать в коде, что encPub-аутентичность на 100% app-layer, и убрать overclaim из коммента.

**[minor] introNonce коммитится в транскрипт и возвращается, но НИГДЕ в крипто-слое не сверяется с seen-set. Единственная защита от повтора — опциональный options.replayCache по capsule.id (по умолчанию отсутствует). Коммент 'MITM cannot ... replay' завышает: байт-идентичный повтор капсулы даёт валидный транскрипт+подпись+nonce.** (web/crypto/intro-handshake.mjs:13-16 (заявление) + 237-274; web/crypto/platho-crypto.mjs:3143-3162)

Атакующий переотправляет валидную INTRO-капсулу A→B. Без переданного replayCache B заново открывает её, переустанавливает тот же K_root (идемпотентно, безвредно) и ПОВТОРНО отдаёт firstMessageBytes → дублированный первый контакт/сообщение и повторный триггер 'новый контакт'.

_fix:_ Требовать replayCache (или вести введённый introNonce seen-set) в open-пути INTRO; перестать описывать сам nonce как защиту от replay — он даёт только freshness при наличии состояния на приёме.

**[minor] Ослабленный kind-чек: capsule.kind и capsule.header0.kind проверяются на принадлежность {private,conv,intro} НЕЗАВИСИМО, равенство между ними не требуется. Капсула с kind='conv' и header0.kind='intro' (или наоборот) пройдёт верификацию.** (web/crypto/platho-crypto.mjs:2967-2974 (verifyEncryptedPrivateCapsule))

Низкий риск на крипто-уровне: вся защищённая маршрутизация (подписной payload, header0-байты, publish-draft) ключуется по header0.kind, а top-level kind лишь косметический. Но app-код, диспетчеризующий по capsule.kind, может быть введён в заблуждение относительно лейна.

_fix:_ Добавить assert capsule.kind === capsule.header0.kind в начало verifyEncryptedPrivateCapsule.

### Линкуемость / направленность (пассивный on-chain индекс-скрейпер без K) — sound

**[minor, ОСТАТОК] bucketKey ДЕТЕРМИНИРОВАН per (K_root, dir, epoch): HKDF(K_epoch, BUCKET||dir||u32be(epoch)). Все сообщения A→B за одни UTC-сутки в одном направлении публикуются под ОДИН И ТОТ ЖЕ 32-байтный bucketKey (это и есть цель O(1)). Направленность корректна: A.outgoingDir==B.incomingDir, две стороны = РАЗНЫЕ бакеты (тест CONV-ROUTE-04/05), lo/hi канонична по compareBytes всей длины — коллизии направлений нет.** (web/crypto/conv-routing.mjs:233 (computeBucketKey) + :242 (outgoingBucketKey))

Скрейпер без K_root видит бакет с N капсулами и знает: это одно направление одной пары за одни сутки; author_wallet отправителя виден. Он может кластеризовать и СЧИТАТЬ (объём трафика на анонимную пару-направление-сутки) и оценить степень графа отправителя (сколько разных бакетов-получателей за день). Это НЕ раскрывает получателя (бакет непрозрачен, HKDF-PRF; два направления и разные эпохи взаимно нелинкуемы) — это остаточный traffic-analysis, присущий O(1)-дизайну.

_fix:_ Ничего не менять по крипте — это принятый остаток, эквивалентный тайминг/RPC-видимости. Если критично: рандомизировать соль бакета per-message (ломает O(1)) — отклонено дизайном.

**[minor, ОСТАТОК] self-lane использует ОТДЕЛЬНЫЙ корневой keyspace (CONV_ROOT_SELF_* → computeConvKRootSelf(seed)), поэтому self-recovery bucketKey НЕ линкуется с обычными беседами (пары идут через X25519+ML-KEM K_root, self — через seed). Концерн (5) чист: коллизии (dir=0x00, epoch=0) между self и реальной беседой нет — у реального сообщения epoch=floor(createdAt/86400)!=0, и K_epoch другой. НО self-bucket СТАТИЧЕН навсегда (sentinel epoch 0).** (web/crypto/conv-routing.mjs:276 (selfRecoveryBucketKey), :39 (CONV_SELF_EPOCH_SENTINEL))

Владелец переиздаёт recovery-снапшот под один и тот же неизменный bucketKey со своего же author_wallet. Скрейпер видит стабильный непрозрачный бакет, привязанный к кошельку W, который обновляется годами и НЕ ротируется (в отличие от суточных conv-бакетов) → отличимый per-wallet fingerprint 'у W есть recovery-снапшот'. Это who-to-SELF, НЕ who-to-whom; никакого пира не раскрывает.

_fix:_ Принятый остаток. При желании скрыть сам факт — ротировать self-bucket по грубой эпохе (напр. по месяцам) ценой окна повторного поиска; дизайн выбрал 1 lookup, это осознанно.

**[minor, ОСТАТОК] CONV-капсула принимает bucketKey как НЕПРОВЕРЯЕМЫЙ 32-байтный аргумент от вызывающего кода — нет связи с header1.createdAt-эпохой, направлением или получателем внутри seal. Эпоха бакета (outgoingBucketKey(createdAtSec)) и header1.createdAt заданы РАЗДЕЛЬНО; получатель сканирует по своему wall-clock окну [now-W..now], W=2, а НЕ по createdAt капсулы.** (web/crypto/platho-crypto.mjs:2781 (createEncryptedConvCapsule, аргумент bucketKey))

Клиентский баг/скью (передан bucketKey не той эпохи или не той пары) → сообщение публикуется под бакетом, который целевой получатель никогда не сканирует → тихая ПОТЕРЯ (или при оффлайне получателя >2 суток — то же). Утечки к скрейперу нет: бакет остаётся непрозрачным, а чужой получатель не расшифрует (KEM привязан к правильному получателю). Это availability/консистентность, не линкуемость.

_fix:_ Выводить bucketKey ВНУТРИ createEncryptedConvCapsule из (kRoot, selfKeyId, peerKeyId, header1.createdAt) через outgoingBucketKey, а не принимать готовым — устраняет рассинхрон epoch↔createdAt по конструкции. Строго не обязательно для immutable-гейта (не влияет на приватность графа).

**[minor, ОСТАТОК] view_tag INTRO — 16 бит, HKDF(ECDH(эфемерал e, scan_pub))[:2] с доменной сепарацией и включён в подписанный транскрипт. Проверил на оракул получателя: для пассивного скрейпера view_tag псевдослучаен и НЕ является оракулом (нужен scan_secret, а scan_pub публичен, но secret детерминирован из сида — platho-wallet.mjs:328). Два INTRO одному получателю используют РАЗНЫЕ e → нелинкуемые view_tag'и (stealth-нелинкуемость держится). ephemeralR переиспользован для scan и body-x25519 (scan_pub != enc_pub) — кросс-протокольной утечки нет.** (web/crypto/intro-handshake.mjs:122 (buildIntroTranscript) / :237 (openIntroHandshake))

Единственный эффект 16-битного тега — ~1/65536 ложных совпадений при скане → лишние ML-KEM decap у получателя (дёшево). Утечки получателя скрейперу нет. Отмечаю как проверенный чистый пункт (концерн 4).

_fix:_ Не требуется.

### СБОРКА/ИНТЕГРАЦИЯ — склейка header0-диспетчера, AAD-связывания тела, sender-recovery, lane — sound-with-fixes

**[minor] Асимметрия валидации publishKind между лейнами. CONV-сериализатор (:2394) и INTRO-сериализатор (:2439), а также их парсеры (:2419/:2465) ЖЁСТКО проверяют publishKind==1/3. Легаси 74-байтный private-сериализатор пишет header0.publishKind БЕЗ проверки ==PRIVATE, а парсер (:2368) читает bytes[5] и вообще не валидирует его, всегда выставляя kind:'private'. Значит отправитель может опубликовать 74-байтный legacy-header, помеченный publish_kind=3 (INTRO) или любым значением; клиентский verify это НЕ ловит (publishKind входит в header0Hash → id/подпись самосогласованы).** (web/crypto/platho-crypto.mjs:2316 (privateCapsuleHeader0Bytes) + :2360 (privateCapsuleHeader0ObjectFromBytes))

Отправитель конструирует легаси private-капсулу с header0.publishKind=CAPSULE_PUBLISH_KIND.INTRO(3). id/hashes/подпись считаются консистентно, publish_kind=3 уходит в publish-draft (privateCapsulePublishDraft :2626 берёт header0.publishKind как есть). Контракт (Фаза 4) маршрутизирует её в INTRO-пул по тегу 3, хотя форма header0 — 74B legacy, а не 42B intro. Получатель, сканирующий intro-пул, зовёт introCapsuleHeader0ObjectFromBytes(74B)→'size drift' (fail-closed), но пул засоряется мисмаршрутизированными капсулами (spam/DoS), и единственный барьер — ещё не написанная проверка формы в контракте.

_fix:_ Зеркалить CONV/INTRO: в privateCapsuleHeader0Bytes добавить `if (header0.publishKind !== CAPSULE_PUBLISH_KIND.PRIVATE) throw`, и в privateCapsuleHeader0ObjectFromBytes валидировать `if (publishKind !== CAPSULE_PUBLISH_KIND.PRIVATE) throw` (либо явно принять CONV=1 как единственный дополнительный допуск, раз CONV делит publish_kind=1). Контракт Фазы 4 всё равно обязан отвергать несоответствие длины header0 ↔ publish_kind.

**[minor, ОСТАТОК] privateCapsuleFromChainEntry жёстко зовёт ТОЛЬКО legacy 74-байтный privateCapsuleHeader0ObjectFromBytes — нет диспетчеризации по длине (40B CONV / 42B INTRO / 74B private). Любой chain-entry CONV/INTRO упрётся в `bytes.length !== PLATHO_BINARY_HEADER0_BYTES(74)` → 'size drift'.** (web/crypto/platho-crypto.mjs:3080 (privateCapsuleFromChainEntry))

Получатель, поднимающий CONV/INTRO-капсулу из CapsuleHub через этот путь, всегда получает throw — CONV/INTRO нельзя открыть из цепочки этим кодом. Не утечка и не подмена (fail-closed), но функциональный разрыв двух-лейновой сборки. Для intro фактический open идёт через in-memory capsule-объект (openEncryptedIntroCapsule←openEncryptedPrivateCapsule), не через chain-entry, поэтому дыра не всплывает в юнит-тестах.

_fix:_ Ввести диспетчер capsuleHeader0ObjectFromBytes(bytes), выбирающий парсер по bytes.length (40→conv, 42→intro, 74→private) с проверкой магии, и использовать его в privateCapsuleFromChainEntry. Иначе Фаза 2/4 (retrieve) не заработает для CONV/INTRO.

**[minor, ОСТАТОК] Транскрипт связывает keyIdA, но НЕ связывает senderEncPublicKey напрямую; при этом openIntroHandshake использует parsed.senderEncPublicKey для DH в establishConvKRootResponder и не перевычисляет keyIdA==computeHybridKeyId(senderEncPublicKey, senderMlKemPub). keyId связывает enc-ключ лишь транзитивно и только если приложение сверит его с Vault KeyRecord.** (web/crypto/intro-handshake.mjs:122 (buildIntroTranscript) / :259 (establishConvKRootResponder via openIntroHandshake))

Подставить чужой senderEncPublicKey нельзя пассивно (он лежит ВНУТРИ AEAD-запечатанного intro-body, AAD=header0Hash+header1Hash), поэтому активная подмена ломает GCM-тег. Самоинфликт: если отправитель кладёт senderEncPublicKey, не соответствующий keyIdA, responder выведет иной dhShared → K_root разойдётся → весь последующий CONV-трафик не расшифруется (DoS), без потери конфиденциальности/имперсонации. Реальная привязка снимается app-layer Vault-якорем (задокументировано в :235-236).

_fix:_ Опционально: в openIntroHandshake, при наличии in-body mlKem pub, ассертить keyIdA==computeHybridKeyId(senderEncPublicKey, senderMlKemPub) до establishConvKRootResponder — чтобы расхождение падало явной ошибкой, а не тихим K_root-divergence. Иначе оставить как явный app-layer гейт.

### РЕАЛИЗАЦИЯ (byte-offsets, fail-open, assertBytes coverage, edge/determinism) — sound-with-fixes

**[minor, ОСТАТОК] Путь ретрива из чейна жёстко зовёт privateCapsuleHeader0ObjectFromBytes, который требует РОВНО 74 байта (legacy 'private'). Диспетчера на 40B CONV / 42B INTRO нет — в отличие от сериализующего capsuleHeader0Bytes (2529), где диспетч по kind есть. Асимметрия: пишем три формы, читаем с чейна только одну.** (web/crypto/platho-crypto.mjs:3080 (privateCapsuleFromChainEntry))

CONV/INTRO-капсула, прочитанная из CapsuleHub (не in-memory built-объект), падает на 'Private capsule header0 binary size drift' в privateCapsuleHeader0ObjectFromBytes → openPrivateCapsuleChainEntry не может открыть ни одну реальную CONV/INTRO-капсулу. In-memory тесты (conv-capsule/intro-capsule) это не ловят, т.к. открывают уже собранный объект, минуя парс из BOC.

_fix:_ Ввести диспетчер parse-from-bytes по publishKind (байт[5]) / длине, как сделано для сериализации: 40→conv, 42→intro, 74→private; вызвать его в privateCapsuleFromChainEntry.

**[minor] introNonce вшит в транскрипт и подписан, но нигде не проверяется на свежесть. Реальная защита от повтора — ТОЛЬКО опциональный replayCache по capsule.id в open-путях; сам 'anti-replay nonce' самостоятельной защиты не даёт (при идентичном повторе id тот же, при отсутствии кэша — не ловится).** (web/crypto/intro-handshake.mjs:237 (openIntroHandshake) + platho-crypto.mjs:3045/3143)

Вызыватель без options.replayCache (кэш опционален, дефолт отсутствует) повторно принимает переигранную первую-контакт INTRO-капсулу: заново выводит тот же K_root и заново показывает first message. Эффект идемпотентный (не компрометация ключа), но дублирующий first-contact против явного заявления дизайна 'anti-replay nonce'.

_fix:_ Либо сделать replayCache обязательным в open-путях (fail-closed без кэша), либо документировать, что nonce — freshness-токен, а анти-реплей = id+replayCache, и вынести проверку введённых nonce в стойкое хранилище на app-слое.

**[minor] Ослабленный kind-чек: capsule.kind и capsule.header0.kind проверяются на принадлежность множеству ['private','conv','intro'] НЕЗАВИСИМО, но их равенство между собой не утверждается.** (web/crypto/platho-crypto.mjs:2969-2973 (verifyEncryptedPrivateCapsule))

Капсулу можно пометить верхним capsule.kind='conv' при header0.kind='private' (или наоборот) и verify пройдёт. Криптографически не эксплойтится (все ключи/подпись/ячейки берутся из header0.kind через capsuleHeader0Bytes и privateCapsuleSignaturePayload, а openEncryptedIntroCapsule сверяет именно header0.kind==='intro'), но на immutable-деплое это лишняя щель, снимающая инвариант согласованности.

_fix:_ Добавить `if (capsule.kind !== capsule.header0.kind) throw` в verifyEncryptedPrivateCapsule.

