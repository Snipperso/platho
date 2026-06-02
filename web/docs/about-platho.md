# About Platho

Platho is a communication app for people who are done depending on someone else's infrastructure for basic digital life: messages, identity, profile, history, and access to their own funds.

The ordinary internet is built too comfortably for the people who control it. An account can be closed. Access can be limited. History can be deleted. Rules can be changed after users have already moved part of their lives into a platform. The user is not an owner there. The user is a tenant who exists for as long as the platform allows it.

Platho is built against that model.

Core actions in Platho are anchored by the user's wallet and executed through open smart contracts. The wallet remains the root of control, while routine app activity can run through the Vault and signed commands instead of exposing the wallet directly every time. That does not make the system perfect. It removes the central defect of ordinary platforms: the hidden ability to rewrite the rules, cut off access, or take control of what should belong to the user.

Private messages are anchored on-chain as encrypted capsule entries. The heavy encrypted body is carried in the accepted TON transaction body, recovered from accepted TON transaction history, and verified against CapsuleHub hashes, so availability depends on provider history coverage and the user's local encrypted cache. Public messages, profiles, and names use verifiable contract state instead of a closed database. That reduces dependence on a server, an operator, and whatever policy happens to be convenient this week.

Platho does not hide the cost of this architecture. The blockchain is public. Operations cost money. User mistakes can be irreversible. A lost seed phrase cannot be recovered through support, and Platho is not a permanent archive: compact capsule entries can be pruned after the retention window, while old body retrieval depends on provider history or the user's local cache. This is a hard model.

The personal wallet and the Vault are separated. The wallet remains the root of control: it deposits and withdraws funds, and it controls keys. The Vault is a protective contract layer between the wallet and the public network. The user moves a limited amount of TON/ATH into the Vault, and publishing, protocol payments, and other app operations run through internal balances and signed commands. This reduces direct wallet exposure on-chain and limits how much value is exposed to routine app activity.

ATH is the protocol utility token. It is used for usernames, avatar updates, and post-airdrop protocol-fee discounts. Its role is tied to actual use inside the app.

ATH is designed for system participants. A meaningful share of the supply is distributed through user activity rather than through a closed allocation to early addresses. That makes the economy less dependent on a narrow holder set and more connected to real network usage.

Platho has no hidden administrative control over user balances. The contracts do not give anyone a manual switch to seize other people's funds, rewrite balances, stop operations, or change the rules after launch.

The point is simple: digital life should not depend on platform permission. Messages, username, profile, and funds should belong to the user as much as a real system can make that true.

Platho is not trying to be a comfortable cage. It is trying to be a tool where control over basic digital things returns to the person using it, not to whoever controls the server, the database, or the access rules.
