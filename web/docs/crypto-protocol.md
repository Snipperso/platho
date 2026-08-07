# Platho Cryptography

## Keys and identity

Everything is derived from a single seed phrase: the wallet key, the signing key, the encryption key and the scanning key. The secret halves never leave your device — they are known neither to a server, because there is no server, nor to the network.

Only the public halves go on chain. They live in your KeyShard, whose address is bound to your wallet address, so the shard can only hold what that wallet registered — the address binding is the whole authorisation. Four fields are stored: the encryption key, the signing key, the scanning key and the key generation number.

A key identifier is not assigned but **computed**: `keyId = H(encryption key, hash of the ML-KEM key)`. To present someone else's keyId you would need their encryption key.

Activation is the first publication of your own public keys. It costs 0.06 GRAM, paid from your wallet.

## First contact

A first letter to a stranger cannot refer to a shared secret — there is none yet. It travels on its own lane.

**How the recipient finds it.** The public part of the capsule is 42 bytes: a random point `R` and a two-byte `view_tag`. The tag is computed from `R` and the recipient's **scanning** key. The recipient walks the recent entries and checks the tag with their own key; an outsider sees only random bytes and cannot tell who the letter is addressed to. The recipient's address is not in the public part at all.

**How the recipient learns who is writing.** The encrypted body carries a handshake: the sender's signature over a transcript that binds both keyIds, the sender's static encryption key, the hash of their ML-KEM key, both KEM ciphertexts, `R`, the `view_tag` and a one-time nonce. The signature is verified **before** any field is taken on trust — otherwise an attacker could graft someone else's signature onto their own key material.

Two checks are enough, and neither needs a chain read:

1. the `keyId` is recomputed from the presented keys and must equal the claimed one;
2. a confirmation tag proves the sender **derived the same root key**, which requires the secret behind the encryption key.

The first forces a forger to use the victim's key; the second catches them there — they cannot derive the root, the tag will not match, and the letter is rejected.

A byte-identical replay is caught by the handshake's one-time nonce.

First-contact entries live on chain for a week — long enough to be read, not long enough to become an archive.

## An established conversation

After the first contact the two sides share a root key, and all further correspondence moves to a second lane, which says nothing whatsoever about the participants.

```
K_root  = HKDF( X25519(a,B) ‖ ML-KEM-768 shared secret,  info = ROOT ‖ lower keyId ‖ higher keyId )
K_epoch = HKDF( K_root,  info = RATCHET ‖ epoch number )
bucket  = HKDF( K_epoch, info = BUCKET ‖ direction ‖ epoch number )
```

The root is hybrid: it takes in both classical X25519 and a genuine randomised ML-KEM-768 encapsulation. That is what post-quantum strength means here — the root cannot be broken by a quantum computer aimed at X25519 alone.

An epoch is one UTC day. Each direction of a conversation writes into **its own** opaque `bucket`, which can only be computed by someone who knows the root. The public part of the capsule is 40 bytes and holds that `bucket` and nothing else: no sender, no recipient, no reference to a previous message. An observer building an index sees uniformly random 32 bytes and cannot tie them to anyone.

## The capsule

The body is encrypted with a hybrid of X25519 and ML-KEM-768, under authenticated encryption. The sender's identity (signing key, profile version, avatar fingerprint) sits **inside** the ciphertext, not in the public part.

A capsule has a fixed size class, from 1 to 32 KB. The size is rounded up, so the length of an entry says nothing about the length of the message. Anything larger is split across several capsules.

## The public feed

Public posts and comments are **not encrypted** — that is their purpose. They sit in a PublicShard in clear text, and the contract treats the transaction's sender as the author, so the author's wallet is visible.

Comments live in a separate shard whose address is derived from the post's coordinates.

## Payment

There is no intermediary: the client signs the external message itself and pays from its own wallet. No relayer, no internal balances, no trusted party that could refuse to publish.

The protocol fee is 0.01 GRAM per capsule, the same for a first contact and for a conversation. The rest of a publication's price is what the network charges for gas and storage.

## Recovery

Conversation keys are stored on the device under a key that never leaves it. That survives a reload and is useless after a reinstall, so there is a second copy: the map of root keys is sealed **under a key derived from the seed phrase** and placed in your RecoveryShard slot. A fresh device that has only the seed finds the slot, reads it and decrypts it — and the conversations come back.

Only what cannot be derived again is placed in the slot.

## What is protected and what is visible

An honest list — without one, any promise is worth little.

**Protected:**

- the content of private correspondence: only you and the person you write to can read it;
- who a private message is addressed to: the recipient is hidden by stealth addressing and by the opaque `bucket`;
- the graph of who corresponds with whom: the two directions cannot be linked to each other without the root key.

**Visible to everyone:**

- that a wallet published a private capsule, when, and of what size class;
- everything public — text, images, comments and the author's wallet.

## On-chain retention

| What | How long |
|---|---|
| First contact | 1 week |
| Private correspondence | 1 year |
| Public posts and comments | 1 year |

Once the term expires the entry is swept out of its shard. The transaction that published it remains in the chain's history indefinitely: deleting data in a blockchain is not possible.
