# Промпт для Ларисы: финальный аудит Platho RC

Проведи свежий аудит приложенного архива как нового release candidate. Не опирайся на прошлые PASS-отчёты и не считай, что старые находки уже закрыты корректно. Проверяй код, тесты, артефакты, PWA и швы заново.

Формат аудита:

1. Один контракт за одну сессию:
   - Vault
   - CapsuleHub
   - ATHMaster
   - ATHWallet
   - ProfileRegistry
   - UsernameRegistry
   - UsernameNFTItem
   - FeeAccumulator
   - BuybackBurn
   - MarketStabilitySeller
   - ATHVesting

2. Потом отдельными сессиями проверь швы:
   - Vault <-> CapsuleHub
   - Vault <-> ATHWallet / ATHMaster
   - Vault <-> ProfileRegistry
   - Vault <-> UsernameRegistry
   - UsernameRegistry <-> UsernameNFTItem
   - CapsuleHub <-> FeeAccumulator
   - FeeAccumulator <-> BuybackBurn
   - BuybackBurn <-> STON.fi/router/pool
   - PWA <-> Vault
   - PWA <-> CapsuleHub
   - PWA <-> Profile/Username registries
   - PWA <-> RPC providers
   - docs/config/artifacts <-> deployed-contract truth

3. Потом отдельной сессией проверь PWA:
   - composer/send flow
   - private/public capsules
   - message sync/recovery
   - receive-intent checks
   - username/avatar UI flows
   - RPC verification/fallback routing
   - local storage/privacy assumptions

Что считать настоящими findings:

- Кто угодно может украсть, вывести, заблокировать или подменить чужие средства.
- Кто угодно может сломать контракт, загнать его в unrecoverable/liveness-dead состояние или выжечь общий reserve.
- Контракт может стать under-backed: внутренние балансы/обязательства больше raw TON/ATH backing.
- Неправильная finality между контрактами может привести к двойному зачёту, раннему refund, зависшим обязательствам или необратимой потере средств.
- Deploy/genesis/seal/manifest может зафиксировать неправильный immutable graph.
- PWA может подписать или отправить транзакцию, которая нарушает протокольный invariant, раскрывает приватность вопреки модели или теряет деньги не по вине пользователя.
- RPC/PWA может системно не доставлять сообщения пользователю при нормальном использовании мессенджера.

Что НЕ считать production-blocker finding:

- Пользователь вручную через кастомный клиент отправил не тот payload, слишком много денег, не туда, не тот amount, и сам оплатил свой мусор.
- PWA могла бы красивее объяснять ошибку, если контрактный invariant не нарушен.
- "Можно добавить ещё одну проверку на всякий случай", если она защищает только от несуществующего сценария и раздувает контракт.
- Метафизические edge cases без реалистичного adversarial path.
- Защита от дурака ценой роста контрактов, если это не закрывает реальный theft/DoS/under-backed/liveness риск.

Отдельно проверь code-size hygiene:

- мёртвый код;
- дублирующиеся helpers;
- legacy/fallback ветки без текущей необходимости;
- поля state/getter, которые больше не участвуют в логике;
- старые product paths, которые больше не должны существовать;
- тесты, которые проверяют уже удалённую модель.

Но не превращай hygiene в BLOCKER, если это не влияет на безопасность, деньги, liveness или immutable deploy truth. Для hygiene используй отдельный раздел "Dead / duplicate / legacy code" и указывай, можно ли безопасно удалить без ABI/contract-surface churn.

Особо проверь свежий Vault receive-intent fix:

- ClaimReceiveIntent с несуществующим intent_id должен reject до acceptMessage.
- ClaimReceiveIntent от wrong recipient должен reject до acceptMessage.
- ClaimReceiveIntent с wrong secret должен reject до acceptMessage.
- CancelReceiveIntent от non-sender должен reject до acceptMessage.
- CancelReceiveIntent с несуществующим intent_id должен reject до acceptMessage.
- Во всех reject-before-accept случаях nonce, internal user balances, receive_intents и raw Vault TON balance не должны меняться.
- Happy-path claim/cancel должен продолжать работать.

В отчёте:

- сначала findings по severity;
- для каждого finding: exact file/function, scenario, impact, recommended minimal fix direction, required regression tests;
- отдельно non-findings, чтобы не возвращаться к уже проверенным тревогам;
- отдельно dead/duplicate/legacy code notes;
- финальный verdict: contracts, seams, PWA, deploy readiness.

Не пиши "всё хорошо", если не проверила. Не добавляй косметические требования к контрактам. Нас интересует жёсткая надёжность протокола, а не бесконечное украшательство.
