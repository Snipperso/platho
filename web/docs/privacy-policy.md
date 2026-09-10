# Privacy Policy

Last updated: 29 August 2026

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
- Your message history and drafts.
- Your settings, including an optional API key for a public GRAM node provider.

None of it reaches us, and what protects each of them is not the same — so this
names them one by one rather than making a single claim for all three:

- **The recovery phrase and the keys derived from it** are encrypted with a
  password you choose (AES-GCM-256, key derivation PBKDF2-SHA-256). Without that
  password they cannot be read, by us or by anyone holding the device.
- **Message history and drafts** are encrypted with a key your browser generates
  on this device and keeps in a form that cannot be exported — not with your
  password. Copying the stored data to another machine therefore yields nothing
  readable; it is not a defence against someone already using your unlocked
  browser.
- **Settings** — a theme, a language, what you follow — are stored as ordinary
  text; nothing among them is secret, and none of it reaches us. The one value
  that is, the optional API key for a node provider, is sealed with the same kind
  of device key as the message history rather than written in the clear.

Clearing your browser data deletes all of it, and without your recovery phrase it
cannot be restored by us or by anyone else.

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

## Third parties your device contacts

The application has no server of ours to talk to, so it talks to public GRAM
infrastructure directly. When you use Platho, your browser sends requests to:

- `toncenter.com`
- `tonapi.io`
- `mainnet-v4.tonhubapi.com`
- `nft.fragment.com`

These providers necessarily see your IP address and the requests your device
makes, and they operate under their own privacy policies, which we do not
control. This is the one place where information about you leaves your device to
a party other than the blockchain itself. If you use a VPN or the Tor network,
these providers see that instead.

If you supply your own API key for one of these providers, it is stored locally
on your device and sent only to that provider.

## Telegram Mini App

Platho can also run inside Telegram as a Mini App. In that mode Telegram itself
governs what it provides to the application and what it records about your use
of Telegram; that is covered by Telegram's own privacy policy, not this one.

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
