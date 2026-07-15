# GetGems · Edit collection — что вставлять

Файлы для загрузки лежат рядом:
- **Upload Banner** → `platho-usernames-banner-2500x650.svg`
- **Upload Collection Avatar** → `platho-usernames-avatar-512.svg` (заменяет старый синий логотип на корректный)

---

## Display Name
```
Platho Usernames
```

## Description  (вставить ровно этот текст, EN — публичная витрина)
```
Platho Usernames are your identity on Platho — a fully decentralized, post-quantum encrypted messenger that lives entirely on the TON blockchain. No backend, no central server, no platform permission.

Each NFT is a unique .ath username: a human-readable name bound to your wallet and your chats. Own it, move it, sell it — your identity travels with you, on-chain. Shorter names are scarcer: 4-letter names are the rarest, 5-letter rare, and 6+ characters common.

Mint and use your name right inside the app at platho.app. One name, one wallet, your keys.
```
(≈680 символов — в лимит 700 укладывается.)

## Royalties for the Creator
`0%` — оставить как есть, если не планируешь брать комиссию с вторички.
(Можно поставить 5–10%, тогда с каждой перепродажи на Royalty Address будет капать процент. На твоё усмотрение.)

## Royalty Address
Уже стоит `EQC-TQBTQoIXC-feDjb78omYJ40B1w4qq8P4nV2JhHxLFeBr` — проверь, что это нужный кошелёк для роялти.

## Show rarity
Оставить **OFF**. Тумблер заставляет GetGems считать редкость по **атрибутам** NFT ("Rarity will be
calculated automatically according to an NFT's attributes"), а наших атрибутов GetGems не видит (доказано
probe — "Нет атрибутов"). COMMON/RARE/EPIC у нас нарисованы на самой картинке (пиксели), считать GetGems
не из чего → включать бессмысленно.

---

> ⚠️ ВАЖНО (выяснено probe'ом на mainnet 2026-06-30): этот диалог "Edit collection" для НАШЕЙ коллекции
> НЕ работает — GetGems выдаёт "cant get commonContentUrl" (коллекция полностью on-chain + immutable,
> их редактор её не тянет). Поэтому баннер/описание/аватар/ссылки ставятся НЕ здесь, а через **саппорт
> GetGems** (off-chain, они проставляют вручную на верифицированной коллекции). Трейты недостижимы без
> бэкенда — редкость остаётся на картинках. Полный разбор — в памяти final-redeploy-nft-attributes-collection-meta.
