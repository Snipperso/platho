# Privacy Policy

Last updated: 22 October 2026

Platho is a messenger with no backend. This document is short because there is
very little to disclose — and specific where something genuinely leaves your
device.

## What we collect

Nothing.

There is no Platho server. The application is a static page that runs entirely
in your browser. We operate no account system, no user database, no analytics,
no crash reporting and no advertising. We cannot see your messages, your
contacts, your balance or your activity, because none of it is sent to us.

We do not ask for an email address, a phone number or a name.

## What stays on your device

- Your 24-word recovery phrase, and the wallet and messaging keys derived from it.
- Your message history. (A draft you have not sent is kept in memory only, and goes when the page closes.)
- The names you give your contacts, and which of them you pinned or stopped marking as unread.
- The names you give your wallets — kept as ordinary text, so that the lock screen can show them before any password.
- Your settings, including an optional API key for a public GRAM node provider.

None of it reaches us, and what protects each of them is not the same — so this
names them one by one rather than making a single claim for all of them:

- **The recovery phrase and the keys derived from it** are encrypted with a
  password you choose (AES-GCM-256, key derivation PBKDF2-SHA-256). Without that
  password they cannot be read, by us or by anyone holding the device.
  If a password manager keeps that password for you, the wallet on this device is only as
  well protected as that manager — usually your account on the device, and its cloud if it
  syncs.
- **Message history, the keys of your conversations and groups, the names you give your contacts and the record of who first wrote to you**
  are encrypted with keys derived from your recovery phrase. Those keys exist
  only while your wallet is unlocked and are never written to the device, so a
  copy of the browser's files — a backup, a disk image, another account on the
  same computer — reads none of it without your password: not the messages, not
  the keys, not the names. On a device that holds your wallet, the same goes for what the app keeps so that it can show pictures, profiles and posts quickly, and for the public channels you follow and how far you have read them.
- **Settings** — a theme, a language — are stored as ordinary text, and none of it reaches us. So are the public channels
  you follow and how far you have read them on a device that holds no wallet, until one is created or restored there.
  The one secret among them, the optional API key for a node provider, is sealed
  with a key your browser keeps on this device rather than stored as plain text.

Clearing your browser data deletes all of it from the device. What your recovery
phrase can bring back comes from the chain: your messages are published there, and
the keys that open your conversations and groups, your notes and your
subscriptions are kept there too, encrypted with a key derived from the phrase —
without it nobody, us included, can read or restore them. Inside Telegram you
can keep one more copy, described under Telegram Mini App below: an encrypted
copy of your wallet that clearing the browser data does not reach.

## What is public by design

**Private messages are encrypted on your device** before they are published, and
only the intended recipient can read their contents.

**Public posts are not encrypted.** They are written to the TON blockchain in
plain text, and they are permanent: neither we, nor an administrator, nor a
government, nor you as their author can remove them. Do not publish anything
publicly that you would need to withdraw later.

The blockchain is a public ledger. Even for encrypted messages, the fact that a
transaction occurred, its time and its cost are visible to anyone. Wallet
addresses are public. If you link an address to your identity elsewhere, the
activity of that address can be associated with you.

**Reports and reactions are public transactions from your wallet.** When you
report a post or react to one, the transaction is sent by your wallet to an
address that anyone can compute from the post, so anyone — including the author
of that post — can see which wallet reported or reacted. A dismissed report and a
lifted sanction undo their effect, not the record: the transaction stays on the
chain for ever.

## Third parties your device contacts

The application has no server of ours to talk to, so it talks to public GRAM
infrastructure directly. When you use Platho, your browser sends requests to:

- `toncenter.com`
- `tonapi.io`
- `nft.fragment.com`

These providers necessarily see your IP address and the requests your device
makes, and they operate under their own privacy policies, which we do not
control. Apart from what you choose to keep in Telegram (see Telegram Mini App
below), this is the one place where information about you leaves your device to a
party other than the blockchain itself. If you use a VPN or the Tor network,
these providers see that instead.

If you supply your own API key for one of these providers, it is stored on your
device and sent only to that provider — and, if you keep your wallet in
Telegram, also kept beside the wallet's copy there, encrypted (see below).

## Telegram Mini App

Platho can also run inside Telegram as a Mini App. In that mode Telegram itself
governs what it provides to the application and what it records about your use
of Telegram; that is covered by Telegram's own privacy policy, not this one.

In that mode your wallet lives in one of two places, and you choose which in
Settings → "Where the wallet is kept". **By default it lives on this device
only**: no copy of it is sent to Telegram (only the small marks described below
are), and if the device's data is lost — Telegram may clear an application's
storage, on iPhone especially — only its 24 words or its key file bring it back.

**If you choose to keep it in Telegram, an encrypted copy of your wallet is kept
in Telegram's cloud storage** (CloudStorage), so that any device signed in to
your Telegram account can open it with your password. The copy is the same
password-encrypted record your device holds: the recovery phrase and the wallet
address are inside the encryption. Beside them are the parameters needed to
decrypt it and an identifier derived from the recovery phrase, by which the app
recognises its own copy; without the phrase it cannot be linked to your address
(your key file carries it beside the address). Telegram keeps the copy on its
servers and associates it with your Telegram account; without your password it
cannot be decrypted, so choose a strong password that you use nowhere else. If
you supplied an API key for a node provider, it is kept beside the copy,
encrypted with a key derived from your recovery phrase. Each copy also carries a version number, by which the app tells which copy is newer, and a signature made with a key derived from the recovery phrase, by which the app checks that the copy and its version come from your wallet.

Each wallet you keep in Telegram has its own copy there, encrypted with that wallet's password; making or choosing another wallet on a device deletes none of them. Every device signed in to your Telegram account lists the wallets kept there — on its lock screen and under Settings → "Other wallets" — and each opens with its own password. When a wallet's password changes, its copy in Telegram takes the new one. Wallets used on a device before are kept on it the same way.

A few small values are kept in Telegram's cloud as well: a note that you closed the quick start, a mark that you
confirmed a wallet's 24 words, and, while a wallet's key file has not been saved yet, a marker; the mark and the
marker can be recognised only by that wallet. None of them contains an address. The app writes to Telegram's
cloud only when Telegram confirms that it was opened from the official @PlathoBot. When Telegram keeps a copy of
a wallet, a name you give that wallet is kept beside it, encrypted with a key derived from that wallet's
recovery phrase — Telegram cannot read it — and it goes when the last copy there does.

"Delete the copy in Telegram" deletes your wallet's copy there and the API key kept beside it; "Forget this wallet" deletes a wallet under "Other wallets" from this device and its copy from Telegram. The application's own "Clear local data" clears this device only — it deletes nothing from Telegram — and clearing Telegram's cache or the browser data leaves the copies in Telegram in place. Outside Telegram the wallet is not copied anywhere.

## Children

Platho is not directed at children under 13.

## Changes

If this policy changes, the date at the top changes with it. The current version
is always the one published in the application and at platho.app.

## Language

This document is published in several languages. The translations are provided for convenience;
if they differ, the English version is the one that governs.

## Contact

Questions about this policy: https://t.me/plathoapp
