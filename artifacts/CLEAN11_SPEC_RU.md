# clean-11 — спецификация (готова к owner-gated церемонии)

Одна immutable genesis-церемония (deployment_id fork всего набора на тех же vanity-кошельках) бандлит **две** owner-одобренные правки:

- **CHANGE-1 — CapsuleHub «profile-pointer»:** чтобы описание канала не терялось в discovery (полное обнаружение, не recency-scoped). Затрагивает `CapsuleHub.tact` **И** `Vault.tact` (общий wire-фрейм).
- **CHANGE-2 — UsernameRegistry метаданные коллекции:** аватар + баннер + описание + royalty 0% ончейн (доказано на mainnet 2026-07-04, рендерится на GetGems).

Оба — правки СУЩЕСТВУЮЩИХ контрактов (никаких новых `.tact`-файлов — иначе рвётся M16-CONF-05 роестр + release-truth). Всё immutable → право на ошибку нулевое: перед seal обязательны газ-калибровка, byte-exact проверки и probe-fork рендера.

Источники дизайна: заземлённые агенты + адверсариальная верификация (workflow 2026-07-04). Все якоря — против фактического кода.

---

## ЧАСТЬ 1 — CapsuleHub profile-pointer (+ Vault lockstep)

**Идея.** Профиль канала — это публичный top-level пост (`parentLink==0`) с единственным PDC1-блоком `PROFILE=7` в теле. Контракт тело не видит (хранит по хешу), поэтому «профильность» приходит по WIRE — бит в байте `reserved`. Контракт ведёт: (a) per-author указатель `hash(author)→последний профиль` (чтение профиля канала за O(1)); (b) **глобальную цепочку профилей** (`head` + `profile_prev_link` в записи) → клиент обходит ВСЕ описанные каналы newest-first. Это и делает discovery полным.

### 1.1 WIRE — бит `is_profile` в `reserved` (ДВА контракта!)

`reserved` (uint8) сейчас обязан быть `0` и в Hub, и в Vault. Забираем бит0 (`0x01`) под `is_profile`, биты 1..7 остаются нулевыми.

**`contracts/CapsuleHub.tact:854`:**
```tact
// БЫЛО:  throwUnless(13521, reserved == 0);
// СТАЛО:
throwUnless(13521, (reserved & 254) == 0);   // 254 = 0b11111110; bit0 = is_profile
let isProfile: Bool = (reserved & 1) == 1;
```

**`contracts/Vault.tact:2192` (КРИТИЧНО — иначе профиль бонсится на Vault до Hub):**
```tact
// БЫЛО:  if (!(reserved == 0)) { rejectCode = RJ_PART_SHAPE; failIdx = i; }
// СТАЛО:
if (!((reserved & 254) == 0)) { rejectCode = RJ_PART_SHAPE; failIdx = i; }  // bit0 = is_profile allowed
```
Vault только форвардит `partsRoot` целиком (не читает бит) — ему достаточно перестать отвергать `reserved==1`. Битность части (592) не меняется. Это pre-accept путь — правка `& 254` вместо `== 0` = одна AND-операция, в бюджет M16-CONF-01B4/B5 укладывается (перепроверить калибровкой).

**Почему безопасно:** множество принимаемых значений расширяется ровно на `{1}`; `reserved==0` (все текущие посты) → `isProfile=false`, поведение идентично; `reserved∈{2..255}` по-прежнему bounce. Флаг живёт в преамбуле части, НЕ в ячейке `header` → `h0`/`header_hash`/`entry_uid`/`body_hash`/подписи байт-в-байт прежние. `reserved` входит в `partsRoot`/`batchPublishId` — это корректно (клиент подписывает флаг, Vault ре-валидирует тот же root).

### 1.2 STATE — `CapsuleHub.tact`

**Поле в `PublicCapsuleEntry` (после `prev_link`, ~строка 162):**
```tact
    prev_link: Int as uint64;
    profile_prev_link: Int as uint64;   // clean-11: backward link in the GLOBAL profile chain (0 for non-profile)
    header: Cell;
```

**Поля состояния (после `public_oldest_live_id`/`private_oldest_live_id`, ~строка 251):**
```tact
    public_profile_index: map<Int as uint256, Int as uint64>;  // hash(author) -> latest profile entryLink (O(1))
    public_profile_head: Int as uint64;                        // newest profile entryLink globally (0 = none)
```
Значение per-author указателя — просто `entryLink` (не структура): нужен лишь «последний профиль автора».

**`init(...)` (после строки 272):**
```tact
    self.public_profile_index = emptyMap();
    self.public_profile_head = 0;
```

### 1.3 PUBLISH HANDLER — `CapsuleHub.tact` (ветка `parentLink==0`, строки 856-879)

```tact
    throwUnless(13523, (h0 != 0) && (bh != 0));
    throwUnless(13529, (!isProfile) || (parentLink == 0));  // is_profile valid ONLY on a top-level post
    throwUnless(13528, (parentLink == 0) || (parentLink <= entryId));
    self.requirePublicHeaderCell(header, h0, 13524, 13525);
    self.requirePublicPayloadCell(body, bh, sizeClass, 13526, 13527);
    let uid: Int = self.computeVaultPublicEntryUid(entryId, entryPublishId, msg.author_wallet, h0, bh);
    let entryLink: Int = self.entryLink(entryId);
    let publicPrevLink: Int = 0;
    let profilePrevLink: Int = 0;
    let authorKey: Int = 0;
    if (parentLink == 0) {
        authorKey = self.publicAuthorKeyId(msg.author_wallet);
        publicPrevLink = self.pushPublicAuthorIndex(authorKey, entryLink);
        if (isProfile) {
            self.public_profile_index.set(authorKey, entryLink);   // per-author pointer
            profilePrevLink = self.public_profile_head;            // global chain: link back to old head
            self.public_profile_head = entryLink;                  // head advances to this entry
        }
    } else {
        publicPrevLink = self.pushPublicParentIndex(self.entryIdFromLink(parentLink), entryLink);
    }
    self.public_entries.set(entryId, PublicCapsuleEntry {
        publish_id: entryPublishId, created_at: now(), author_wallet: msg.author_wallet,
        body_hash: bh, parent_link: parentLink, prev_link: publicPrevLink,
        profile_prev_link: profilePrevLink, header: header
    });
```
`authorKey` вычисляется один раз (снимает повторный `CELLHASH` из старой строки 867). Непрофили пишут `profile_prev_link=0`.

### 1.4 ЭВИКЦИЯ — БЕЗ ИЗМЕНЕНИЙ (доказательство корректности)

`evictExpiredPublic` (632-659) и prune-функции **НЕ трогаем**. Обоснование (проверено адверсариально):

- **Глобальная цепочка:** эвикция строго FIFO oldest-first; `created_at`/`entryId` монотонны ⇒ эвиктится всегда ХВОСТ profile-цепочки (наименьший живой profile-id). Обход от головы по `profile_prev_link` (в сторону убывания) никогда не достигает эвикнутого хвоста раньше, чем упрётся в него. Живая часть цепочки НЕПРЕРЫВНА (между головой и первым эвиктнутым нет удалённых средних звеньев). Клиентский обход останавливается на первом `get_public_entry(...).exists == false`. **Рерайтинг не нужен** — как у author/parent индексов.
- **Per-author указатель:** может «висеть» на эвикнутую запись. Читатель делает `get_public_entry(...).exists` cross-check и падает на bounded author-walk fallback. Параллельный prune НЕ добавляем — он был бы (i) дорогим (нужно читать `is_profile` при эвикции → лишнее поле+branch) и (ii) НЕКОРРЕКТНЫМ (нет ссылки на предыдущий профиль автора — откатить указатель не на что; `del` стёр бы указатель у канала, чей предыдущий профиль ещё жив). Dangling + exists-check — самое корректное.
- Следствие: `is_profile` НЕ храним в записи (только `profile_prev_link`). Флаг живёт лишь в момент публикации.

### 1.5 GETTERS — `CapsuleHub.tact`

**После `get_public_author_index` (~1081):**
```tact
    get fun get_public_profile_index(keyId: Int): PublicCapsuleKeyIndexView {
        let linkOpt: Int? = self.public_profile_index.get(keyId);
        if (linkOpt == null) { return PublicCapsuleKeyIndexView { exists: false, key_id: keyId, latest_entry_id: 0, latest_entry_link: 0, entry_count: 0 }; }
        let link: Int = linkOpt!!;
        return PublicCapsuleKeyIndexView { exists: true, key_id: keyId, latest_entry_id: self.entryIdFromLink(link), latest_entry_link: link, entry_count: 1 };
    }
    get fun get_public_profile_head(): Int { return self.public_profile_head; }
```
Переиспользует `PublicCapsuleKeyIndexView` (клиентский `decodePublicCapsuleKeyIndexStack` не меняется).

**`profile_prev_link` в `PublicCapsuleEntryView` (после `prev_link`, ~209)** + обе ветки `get_public_entry` (1107 not-exists: `profile_prev_link: 0`; 1125 exists: `profile_prev_link: entry.profile_prev_link`). Вставлять `profile_prev_link` ПЕРЕД `header` (ref остаётся хвостовым).

⚠️ **ABI-breaking:** `PublicCapsuleEntryView` растёт 13→14 полей → клиентский декодер обязан обновиться лок-степом (см. 1.6).

### 1.6 КЛИЕНТ

- **`web/pwa-contract-transactions.mjs:1189`** — `buildBatchPublishPartCell` публичная ветка: `.uint(0n, 8, 'reserved')` → `.uint(publishPublicReservedByte(part), 8, 'reserved')`; хелпер `publishPublicReservedByte(part) = (part.is_profile === true) ? 1n : 0n`.
- **`web/publish-batch-orchestration.mjs:~122`** — в `publishItemToBatchPart` вернуть `is_profile: item?.is_profile === true || publish.is_profile === true`.
- **`web/app.js`** — `publishChannelProfile` (~24594): `createPublicPayloadParts({ type:'post', commentsAllowed:false, documentBytes, isProfile:true })`; `createPublicPayloadParts` пробрасывает `is_profile` в payload **только при `partCount===1`**. Обычные посты/комменты флаг не ставят → `reserved=0`.
- **`web/capsulehub-ton-rpc-provider.mjs`** — `decodePublicCapsuleEntryStack` (753): `stack.length !== 14`, `header_boc` индекс 13, `profile_prev_link` индекс 12; batch-декодер (408): сохранить `is_profile: (reserved & 1n) === 1n`; новые методы `getPublicProfileIndex(keyId)` (через `decodePublicCapsuleKeyIndexStack`) + `getPublicProfileHead()`.
- **`web/app.js:resolveChannelProfile` (~7816)** — O(1) fast-path: `getPublicProfileIndex(authorKeyId)` → `get_public_entry(link-1)` → если `exists`, resolve+decode профиль; иначе fall through на существующий bounded author-walk (dangling-tolerant). Убирает зависимость от `PUBLIC_CHANNEL_PROFILE_WALK_LIMIT`.
- **`web/app.js:discoverChannels` (~7876)** — заменить head-of-log сэмпл на обход глобальной profile-цепочки: `getPublicProfileHead()` → идти по `entry.profile_prev_link` newest-first, дедуп по автору, skip own/subscribed, брать описание напрямую (каждый узел уже профиль). Границы `PUBLIC_DISCOVERY_WINDOW`/`MAX_CANDIDATES` остаются как cost-bound (масштаб-безопасно). «Показать ещё» = продолжить обход от сохранённого `link` (курсор). Discovery становится ПОЛНЫМ, не recency-scoped.

### 1.7 GAS/STORAGE (обязательная калибровка перед seal)

Профильная публикация добавляет: 1 map-set (`public_profile_index`) + 1 read/write скаляра (`public_profile_head`) + `profile_prev_link` (+64 бита) в запись (пишется всегда). Всё в существующем `HUB_PART_GAS_PUBLIC=180000` (приватный путь `170000` уже держит ДВА index-push, так что public+profile строго дешевле). **Перед seal:** прогнать worst-case профильный part через газ-генератор; при необходимости поднять `HUB_PART_GAS_PUBLIC` и/или `CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT` (учесть +64 бита записи). Immutable → **завышать, не занижать** (over-hold рефандится mode-128 ACK).

### 1.8 ТЕСТЫ (VPB2-хелпер + sandbox)

Обязательно: (i) `reserved=1` профиль → `public_profile_index`/`public_profile_head` заполнены, `profile_prev_link`-цепочка растёт; (ii) `reserved=2` → bounce 13521 (Hub) и RJ_PART_SHAPE (Vault); (iii) `is_profile` на комментарии → bounce 13529; (iv) эвикция хвостового профиля → head-walk доходит до `exists=false`, живая часть цела; (v) непрофиль → `profile_prev_link=0`, голова/индекс не тронуты; (vi) `tests/helpers/vpb2.ts` — прогнать `reserved=1` через shape-валидатор Vault (`isPublicCapsuleShapeValid` + accept).

---

## ЧАСТЬ 2 — UsernameRegistry метаданные коллекции

**Идея.** `collectionContent()` (сейчас только `name`, `UsernameRegistry.tact:287-294`) расширяем до 0x00-dict `{name, description, image, cover_image}` + добавляем TEP-66 royalty 0%. Ключевое ограничение: ~9.5KB base64-SVG нельзя литералами (D09-деплой уже близко к 64KB) → грузим через **отдельный sealable meta-dict** (зеркало art/UploadArt/SealArt), который деплоится ПУСТЫМ (0 байт к D09), чанки приходят после деплоя.

**Доказанный рецепт** (mainnet, GetGems-скрин 2026-07-04): `image`/`cover_image` = `data:image/svg+xml;base64,<svg>` СТРОКА (не `image_data`-байты, не utf8). base64 выбран, т.к. наши SVG используют `#`-цвета/`url(#id)` (utf8-форма рискует обрезкой на `#`).

### 2.1 Константы (`UsernameRegistry.tact`, рядом с существующими ключами ~27)
```tact
const USERNAME_COLLECTION_METADATA_KEY_DESCRIPTION: Int = 0xc9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104; // sha256("description")
const USERNAME_COLLECTION_METADATA_KEY_IMAGE: Int       = 0x6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d; // sha256("image")  — совпадает с probe KEY_IMAGE
const USERNAME_COLLECTION_METADATA_KEY_COVER_IMAGE: Int = 0x5ef8ba599c69728c698d4cdca2040e121acb2aa9b6d4a2c8af02dd0b91398ce7; // sha256("cover_image")
const USERNAME_META_KEY_DESCRIPTION: Int = 1;  // meta-dict namespace: 1=description, 2=image(avatar), 3=cover_image(banner)
const USERNAME_META_KEY_IMAGE: Int = 2;
const USERNAME_META_KEY_COVER_IMAGE: Int = 3;
const USERNAME_META_PART_COUNT: Int = 3;
```
⚠️ Перед seal сверить `sha256("cover_image")` вторым независимым импл. (у probe этого ключа не было — banner GetGems-only).

### 2.2 Sealable meta-dict (ОТДЕЛЬНЫЙ, не в art-dict)

art-dict: uint16-ключи 45..307, seal ровно после 56 частей (throwUnless 19060) — сворачивать meta туда сломает инвариант. Отдельный dict + флаг зеркалит `art_sealed`.

**Поля (после `art_sealed`, ~195):**
```tact
    meta: map<Int as uint16, Cell>;
    meta_count: Int as uint16;
    meta_sealed: Bool;
```
**`init` (после ~215):** `self.meta_count = 0; self.meta_sealed = false;`

**Сообщения (рядом с UploadArt/SealArt, ~161):**
```tact
message UploadCollectionMeta { key: Int as uint16; data: Cell; }  // data = plain-snake (asString-compatible), как UploadArt
message SealCollectionMeta {}
```
**Ресиверы (после SealArt, ~497):**
```tact
receive(msg: UploadCollectionMeta) {
    self.requireGenesisController();
    throwUnless(19071, !self.meta_sealed);
    throwUnless(19072, msg.key >= 1 && msg.key <= USERNAME_META_PART_COUNT);
    if (self.meta.get(msg.key) == null) { self.meta_count += 1; }
    self.meta.set(msg.key, msg.data);
}
receive(msg: SealCollectionMeta) {
    self.requireGenesisController();
    throwUnless(19070, self.meta_count == USERNAME_META_PART_COUNT);
    self.meta_sealed = true;
}
```
Как UploadArt — decoupled от SealGenesis; полноту гарантирует VERIFY-шаг (meta_sealed==true).

### 2.3 `collectionContent()` (REPLACE 287-294)
```tact
fun collectionContent(): Cell {
    throwUnless(19360, self.meta_sealed);  // не отдаём полусобранные метаданные (это get-метод, не в mint-пути)
    let metadata: map<Int as uint256, Cell> = emptyMap();
    metadata.set(USERNAME_COLLECTION_METADATA_KEY_NAME, self.collectionNameCell());
    metadata.set(USERNAME_COLLECTION_METADATA_KEY_DESCRIPTION, self.metaCell(USERNAME_META_KEY_DESCRIPTION));
    metadata.set(USERNAME_COLLECTION_METADATA_KEY_IMAGE,       self.metaCell(USERNAME_META_KEY_IMAGE));
    metadata.set(USERNAME_COLLECTION_METADATA_KEY_COVER_IMAGE, self.metaCell(USERNAME_META_KEY_COVER_IMAGE));
    return UsernameCollectionOnchainContent { marker: 0, metadata: metadata }.toCell();
}
// stored part is ALREADY a complete TEP-64 snake value (0x00 marker + snake, built client-side) — serve verbatim.
fun metaCell(key: Int): Cell {
    let c: Cell? = self.meta.get(key);
    throwUnless(19361, c != null);
    return c!!;
}
```
🔴 **0x00 marker — #1 render-killer** (баг пустого рендера clean-07, память `username-nft-render-tep64-marker`): значения TEP-64 snake обязаны нести 0x00-маркер. **ОТСТУПЛЕНИЕ ОТ ПЕРВОНАЧАЛЬНОГО ДИЗАЙНА (безопаснее, реализовано так):** `UploadCollectionMeta.data` — это УЖЕ полная snake-ячейка (0x00-маркер + snake, собранная клиентом ТОЧНО как в mainnet-проверенном probe через `snakeStringCell`), а не plain-snake. Контракт отдаёт её **verbatim** (`metaCell`), БЕЗ пере-оборота `beginTailString`+`asString`. Причина: `asString` может НЕ следовать по ref'ам → многоячеечный баннер (~6KB, 50 ячеек) обрезался бы на первой ячейке. Прямая отдача байт-идентична probe-раскладке (проверено — рендерится на GetGems). **Обязателен byte-for-byte round-trip тест перед immutable-деплоем.**

### 2.4 Royalty 5% (TEP-66, сейчас НЕТ)
**View (~150) + геттер рядом с get_collection_data (~1144):**
```tact
struct RoyaltyParamsView { numerator: Int; denominator: Int; destination: Address; }
get fun royalty_params(): RoyaltyParamsView {   // ИМЯ БЕЗ get_ (TEP-66), см. ниже
    return RoyaltyParamsView { numerator: 5, denominator: 100,
        destination: address("UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH") };
}
```
**5%** (5/100) с каждой вторичной продажи → на фикс royalty-кошелёк. Получатель — **обычный `wallet_v5r1`** (проверено на чейне 2026-07-04: `is_wallet`, active, принимает TON без бонса, вывод свободный). Адрес зашит литералом `address(...)` (immutable). 🔴 **Имя метода строго `royalty_params` — БЕЗ префикса `get_`** (TEP-66 резолвит роялти по method_id этого имени; `get_royalty_params` дал бы другой id и GetGems/tonapi роялти НЕ увидели бы — поймано аудитом 2026-07-04, method_id `royalty_params`=**85719** проверен по .fif/.abi). Перед seal сверить `address("UQByyT…OATH")` резолвится в тот же raw-account (Tact хранит workchain+hash; UQ/EQ-префикс = только bounce-флаг сообщения, в Address не входит).

**Геттеры полла (зеркало get_art_count/get_art_sealed ~1119):**
```tact
get fun get_meta_count(): Int { return self.meta_count; }
get fun get_meta_sealed(): Bool { return self.meta_sealed; }
```

**Коды ошибок (свободны, проверено grep):** 19070/19071/19072/19360/19361.

### 2.5 Genesis tooling + порядок
- **Новый скрипт `scripts/mainnet_upload_collection_meta.ts`** (клон `mainnet_upload_username_art.ts`): части = `{1: <описание из FIELDS.md>, 2: 'data:image/svg+xml;base64,'+avatar.toString('base64'), 3: 'data:image/svg+xml;base64,'+banner.toString('base64')}`; каждую часть → ПОЛНАЯ TEP-64 snake-ячейка `snakeStringCell(Buffer.from(part))` (0x00-маркер + snake, ТОЧНО как probe-builder `probe_collection_meta_input.ts` — НЕ `plainSnake`); тела `UploadCollectionMeta{ key, data: <ячейка> }`; polling `get_meta_count`→3 → `SealCollectionMeta` → `get_meta_sealed`. 3 части влезают в ОДИН external (banner ~6.5KB BoC << 65535).
- **VERIFY (`scripts/mainnet_genesis_verify.ts`):** добавить `meta_sealed==true` + `meta_count==3` рядом с `art_sealed`.
- **init-сигнатура НЕ меняется** (meta post-deploy, как art) → форк драйвится `deployment_id` bump. Код-хеш registry изменится → регенерить build/ + манифест.

### 2.6 Размер (проходит с запасом)
D09 stateInit ~39.8KB / 65535 (перемерить свежий пакет). meta-dict деплоится пустым → **0 байт к D09**. Новый код (~3 ресивера + collectionContent + royalty + геттеры) ≈ сотни байт. Чанки после деплоя (замерено: avatar 24 ячейки/~3.0KB, banner 50/~6.5KB, description 5/~0.6KB) — каждый далеко под 65535. Runtime: `collectionContent` — get-метод, в mint-пути не исполняется → 0 газа на hot-path.

### 2.7 Caveats (перед seal)
- **[HIGH] Описание — точные байты из `FIELDS.md:16-21`** (канон ~680 симв., 3 абзаца, НЕ 555). Извлечь verbatim в plain `.txt`, сверить char-count, без smart-quotes/CRLF. Immutable seal фиксит байты навсегда. (У меня точный текст уже в probe-builder — он и рендерился на GetGems.)
- **GetGems-рендер ДОКАЗАН** (probe 2026-07-04, твой скрин): аватар+баннер+описание отрисовались полностью ончейн. Старая заметка FIELDS.md про «cant get commonContentUrl» — про РЕДАКТОР, не про ДИСПЛЕЙ; отдельный саппорт-реквест не нужен.
- **cover_image** — GetGems-only (tonapi/Tonkeeper дропают, это ожидаемо).
- **Royalty 5% → `UQByyT…OATH`** (owner-выбран; wallet_v5r1, проверен: принимает TON + свободный вывод). Зашит литералом. GetGems энфорсит TEP-66 на вторичке → 5% с каждой перепродажи капает на этот кошелёк.
- **TEP-66 shape** — проверить `royalty_params` реальным ридером на probe-fork перед seal.
- **Immutable** — dry-run upload + открыть на tonapi/GetGems на probe-fork ПЕРЕД mainnet-seal.

### 2.8 Тесты
Собрать meta-dict (3 plain-snake части) → `collectionContent` через wrapper/sandbox → assert 0x00-dict имеет KEY_NAME+DESCRIPTION+IMAGE+COVER_IMAGE, KEY_IMAGE начинается с `data:image/svg+xml;base64,`, byte-for-byte round-trip описания, `collectionContent` throws 19360 до seal, `royalty_params`=(5,100,`UQByyT…OATH`).

---

## ЧАСТЬ 3 — Церемония clean-11 (owner-gated, irreversible)

### 3.1 Форк
`PLATHO_ATH_DEPLOYMENT_ID = 'platho-mainnet-20260622-clean-10'` → новое (напр. `...-20260704-clean-11`) → регенерит `ath_metadata_content.json` (новый contentHash) → `ATHMaster.init(...)` меняет athMasterAddress → каскад (athMaster — init-арг у Vault:214, CapsuleHub:217, UsernameRegistry:220, ProfileRegistry:223, ATHVesting, BuybackBurn, MSS, FeeAccumulator, все ATHWallet) → весь набор форкается на свежие адреса, **те же vanity role-кошельки** (`mainnet_roles.local.json` не трогаем).

### 3.2 Порядок сборки
1. Правки контрактов (CHANGE-1: CapsuleHub+Vault; CHANGE-2: UsernameRegistry) → `npm run build`.
2. `node scripts/hash_codes.js` (CURRENT_CODE_HASHES).
3. Харнес/тесты (vpb2-хелпер кейсы, meta round-trip, profile-chain).
4. Клиент (wire/read лок-степ: провайдер 14-поле, is_profile, discovery/resolve; **`pwa-contract-transactions.mjs:115` USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS 581M→617M** — clean-11 поднял mint-пол на +36M name-record endowment, старый charge отобьётся 19122; сейчас держим 581M под ЖИВОЙ clean-10; `?v=` бамп модулей).
5. `npm test` — весь набор зелёный.
6. Release-evidence rebaseline (16-шаговый порядок; **`artifact_integrity_m18` — ПОСЛЕДНИМ**): hash_codes → storage-economics → vectors → m15 → conformance_m16 → manifest draft/packet/dry-run → (post-seal) snapshot + genesis:verify + VERIFIED.txt → m18.
7. `MAINNET_GENESIS_VERIFIED.txt` → **FALSE** (сейчас true для clean-10) до re-verify.
8. `npm run mainnet:manifest:draft` → **COLLISION-GATE:** пересечение новых адресов с `mainnet_genesis_verify_input.json` (живой clean-10) должно быть ПУСТЫМ (проверить вручную — встроенного guard'а нет).
9. Пакет + **DRY-RUN каждой фазы БЕЗ --broadcast**.
10. 🔴 **OWNER-GATED broadcast:** deploy → treasury-supply → bind (Vault↔Hub, Registry) → **[UploadArt×56 + SealArt] + [UploadCollectionMeta×3 + SealCollectionMeta]** → SealGenesis (0x3A12D1AD, необратимо).
11. Post-seal: свежий snapshot → `mainnet:genesis:verify` (issue_codes:[]) → VERIFIED.txt=**true** → m18 в FINAL_GENESIS-ветке.
12. PWA cutover: `platho-config.mjs` (все адреса + `deploymentManifestHash` + `publicChannels[0].authorWallet` — старый orphaned) → `?v=` бамп → deploy.

### 3.3 RED-by-design (ожидаемо между правкой и re-verify)
`M16-CONF-03` (код-хеш vs *_CODE_HASH.txt) — RED до шага 2+conformance_m16; `M18-ARTIFACT-01` — RED до шага 6 (последним); `release-truth` guards — RED до ребейзлайна+VERIFIED-flip. Зелёная последовательность в 3.2.6. **VERIFIED.txt=true ставить ТОЛЬКО после того, как новый snapshot совпал с новым манифестом** (иначе false-verified уедет в прод).

### 3.4 D09 — деплой через tonapi (решено)
`mainnet_deploy_d09_username_registry.mjs:34` по умолчанию бьёт в мёртвый `rpc.platho.app`, читает через `?api_key=` query + v2-пути (gateway-измы). Плюс: **toncenter `/message` молча дропает крупные (>~16KB) external даже с ключом** (доказано 2026-07-04). Решение: слать через **`tonapi /v2/blockchain/message`** (провёл 18KB probe), а balance/seqno читать через toncenter с `X-API-Key` **header** (не query). В обязательном D09-dry-run прогнать ВСЕ три вызова (getAddressInformation, runGetMethod, message) против выбранного эндпоинта. Патч скрипта — client-only, immutability не трогает.

### 3.5 Прочее
- **Vesting gate:** `mainnet_final_manifest_draft.ts:163` бросает, если `ath_long_term_vesting_start_time_unix` (1796515200 = 2026-12-04) не в будущем на момент draft. На 2026-07-04 в будущем; перепроверить на момент церемонии.
- **Throwaway-data:** форк стирает clean-10 public/private/NFT + ATH-токен/DeFi; pre-launch приемлемо (RECEREMONY_PLAN §8). Перед orphan подтвердить `airdrop_distributed_ath=0`. ~5.6 TON rent-эндаументов — sunk cost.
- **CURRENT_FULL_TEST_SUMMARY.json** (120 файлов/1112 тестов) — вручную обновить после зелёного прогона (новые тест-файлы двигают release-truth:177). web/ правки двигают web_static_deploy_prep — перегенерить оба режима.
- **Irreversible:** после SealGenesis re-bind обязан падать; «откат» = держать PWA на старом clean-10 (deploy-key rollback).

---

## Открытые вопросы к owner (перед церемонией)
1. ✅ **Royalty — РЕШЕНО:** 5% на `UQByyTVrBTugc5Hqc8Teo3jr0u21x3m9MADQV5bc9yfDOATH` (wallet_v5r1, проверен).
2. ✅ **Описание — РЕШЕНО:** канон = `FIELDS.md:16-21` (3 абзаца), owner-подтверждён по GetGems-рендеру probe 2026-07-04 — это точный текст, что рендерился. На церемонии: извлечь БАЙТ-В-БАЙТ в plain `.txt` (em-dash `—`, без smart-quotes, LF) + round-trip тест (immutable).
3. **Тайминг** (ЕДИНСТВЕННЫЙ открытый): делаем clean-11 сейчас (данные throwaway) или ближе к запуску, накопив ещё контрактных хотелок в этот же форк?

## Порядок работ (по твоему go)
1. Правки контрактов (CHANGE-1+2) + харнес/тесты локально.
2. Probe-fork (не mainnet): залить meta + профиль-цепочку, проверить рендер коллекции на tonapi/GetGems + discovery-обход.
3. Полный `npm test` + release-evidence rebaseline (VERIFIED→false).
4. Manifest draft + collision-gate + dry-run всех фаз.
5. **Только после этого** — owner-gated broadcast (по явному «да», по фазам, каждая с dry-run).

---

## СТАТУС РЕАЛИЗАЦИИ + АУДИТ (2026-07-04)

**Контрактные правки ВНЕСЕНЫ и собраны (exit 0):** CapsuleHub (profile-pointer + F1), Vault (reserved-bit relax), UsernameRegistry (collection meta + royalty). `npm test` = 1114 passed, красное = ровно 4 хеш-ребейзлайна by-design (m16/m18/2×econ), новых регрессий нет; M9-03A починен (фикстура грузит+пекёт 3 meta-части).

**Аудит (5-мерный adversarial-review воркфлоу, 15 агентов, 10 кандидатов → 9 REFUTED, 1 CONFIRMED):**
- **F1 (эвикция чистит `public_profile_index`)** — ДОБАВЛЕНО в `evictExpiredPublic` (ветка `parent_link==0`): если выселяемый пост = текущий профиль-указатель автора, `del`. Закрывает неограниченный рост состояния (симметрия с `prunePublicAuthorIndex` del-at-zero). Корректность доказана по всем векторам (мульти-редакт, кросс-автор, non-profile-пост, defensive-skip). Глобальную цепочку `profile_prev_link`/`public_profile_head` НЕ трогает — dangling-tolerant walk безопасен (FIFO-монотонность id).
- **F2 (роялти)** — геттер переименован `get_royalty_params`→**`royalty_params`** (TEP-66 method_id **85719** = crc16 проверен по .fif/.abi; со `get_`-префиксом маркетплейс роялти НЕ видел бы). Возврат (5,100,`UQByyT…OATH`), workchain0 hash `72c9356b…c338` = UQ-форме байт-в-байт.
- **Гейт `collectionContent` 19360** — оставлен throw-до-seal (fail-closed); минт НЕ бричит (`collectionContent` зовётся только из `get_collection_data`, item-путь строит метадату сам). Тест-фикстура усилена: pin `/19360/` + round-trip 4 ключей.
- **Storage** — профиль-пост НЕ андерфандит: маржа публичного поста **12.6M nanoTON** vs гейт 1M, лишний profile-index слот (~2M) финансируется самим паблишем автора и реклеймится при эвикции (F1). Бамп endowment НЕ нужен.
- **Газ** — HUB_PART_GAS_PUBLIC=180000 покрывает новые dict-операции (комментарий обновлён); G8-подтверждение профиль-пути — формальность на церемонии.

**Единственная CONFIRMED-находка (HIGH, НЕ блокер печати):** клиентский `decodePublicCapsuleEntryStack` (`web/capsulehub-ton-rpc-provider.mjs:755`) ждёт 13 полей → против clean-11 (14) сломается. Client-lockstep, уже в порядке сборки §3.2.4; в байткод не запекается, чинится JS-деплоем в лок-степ с cutover.

**Осталось до seal (сужено аудитом):** client wire/read лок-степ (14-поле провайдер + is_profile + discovery global-chain walk + **mint charge 581M→617M**), G8-подтверждение профиль-пути, харнес-кейсы (vpb2 is_profile, meta round-trip), probe-fork рендер+discovery, release-evidence rebaseline. Логика контрактов — чистая, готова к твоей ре-проверке.

## ЭКОНОМИЧЕСКИЙ АУДИТ + name-record endowment (2026-07-04)

Всесистемный custody/longevity аудит (6 измерений × ревьюер+скептик): деньги текут ЧИСТО — TON-комиссия + ATH-50% юзернеймов/аватаров + вестинг → `UQDoCopn…OATH`; роялти 5% + MSS-фандер + ATHMaster-админ → `UQByyT…OATH`; выводится через permissionless-flush с full-remainder escape (нет admin-бэкдора = trustless, а НЕ «нельзя вывести»); нет кражи/редиректа (получатели зашиты в state), нет двойного кредита на баунсе, нет дедлока вестинга, нет форжа/инфляции ATH, у ATHMaster нет раг-власти. 0 CONFIRMED-находок.

**ОДИН longevity-фикс ВНЕСЁН** (переопределил слишком оптимистичное авто-снятие своей проверкой магнитуд): `name_records` (never-evicted, ~2 ячейки) был недофинансирован рентой vs sibling ProfileRegistry (36M). Добавлена `USERNAME_NAME_RECORD_STORAGE_ENDOWMENT=36000000`, вложена в `retainedValue` → mint-пол 511M→547M, гарантирует ~250лет само-финансируемой ренты ОТ ПОЛА (не от щедрости клиента). **Кросс-контрактный локстеп (поймал полный прогон):** Vault `USERNAME_NOTIFY_VALUE` 532M→568M, `VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE` 575M→611M (client charge 581M→617M) — иначе Vault-минт отбивается 19122. Тесты обновлены, полный прогон 1114 pass (красное = 4 by-design хеша). LOW ops: пре-фандить 100-TON fee-floor Hub на старте; запинить genesis TON-эндаумент вестинга (D06).
