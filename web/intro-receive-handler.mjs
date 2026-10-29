
import { openIntroCapsuleFromChainCells } from './crypto/platho-crypto.mjs?v=31';
import { INTRO_UNSIGNED_REFUSED_FROM } from './crypto/intro-handshake.mjs?v=8';

function introReplayError(message) {
  const error = new Error(`INTRO replay detected (${message})`);
  error.code = 'INTRO_REPLAY';
  return error;
}

export function introEpochVerdict(signedEpoch, readEpoch) {
  const read = Number(readEpoch);
  if (!Number.isInteger(read) || read < 0) return null;
  if (signedEpoch === null || signedEpoch === undefined) {
    return read >= INTRO_UNSIGNED_REFUSED_FROM ? 'an unsigned INTRO past the day it was retired' : null;
  }
  return Number(signedEpoch) === read ? null : `signed for epoch ${Number(signedEpoch)}, read in ${read}`;
}
import { readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=59';

const asBytes = (value, name) => (value instanceof Uint8Array ? value : readSnakeCellBytes(value, { name }));

const nonceHex = (value) => (value instanceof Uint8Array ? Array.from(value, (b) => b.toString(16).padStart(2, '0')).join('')
  : String(value ?? '').toLowerCase().replace(/^0x/, ''));
function sameIntroNonce(held, nonce) {
  const a = nonceHex(held);
  return a.length > 0 && a === nonceHex(nonce);
}

function adoptionOf(opened, capsule, createdAt) {
  return {
    kRoot: opened.kRoot,
    createdAt,
    introNonce: opened.introNonce,
    peerEncPublicKey: opened.senderEncPublicKey,
    peerWallet: capsule.source ?? null,
    peerWalletCandidates: Array.isArray(capsule.sourceCandidates) ? capsule.sourceCandidates.map((s) => String(s)) : [],
  };
}

export function createIntroReceiveHandler({
  recipientKeyPair,
  convKeyStore,
  introReplayGuard = null,
  onFirstContact = null,
  keptDurably = null,
} = {}) {
  if (!recipientKeyPair?.keyId) throw new Error('createIntroReceiveHandler requires recipientKeyPair with a keyId');
  if (typeof convKeyStore?.upsertConversationKRoot !== 'function') throw new Error('createIntroReceiveHandler requires a conv key store');

  return async function onIntro(delivery) {
    if (delivery && typeof delivery === 'object' && 'capsule' in delivery && delivery.capsule == null) {
      throw new Error('intro capsule was not fetched — nothing to open (the body is not in the shard window yet)');
    }
    const capsule = delivery?.capsule ?? delivery;
    let nonceToRecord = null;
    let seenBefore = false;
    let guardFailure = null;
    const checkOnlyGuard = introReplayGuard
      ? {
        has: async (key) => {
          try { seenBefore = await introReplayGuard.has(key); } catch (error) { guardFailure = error; }
          return false;
        },
        add: async (key) => { nonceToRecord = key; },
      }
      : undefined;
    let opened;
    try {
      const header0Bytes = asBytes(capsule.header0, 'intro header0');
      const bodyBytes = asBytes(capsule.body, 'intro body');
      opened = await openIntroCapsuleFromChainCells(header0Bytes, bodyBytes, recipientKeyPair, {
        introReplayGuard: checkOnlyGuard,
        enforceExpiry: false,
      });
    } catch (error) {
      if (error && /INTRO replay detected/i.test(String(error.message ?? ''))) {
        try { error.code = 'INTRO_REPLAY'; } catch { }
      } else if (error && typeof error === 'object' && guardFailure === null) {
        const notMine = /view_tag\/decrypt mismatch/.test(String(error.message ?? ''));
        try { error.code = notMine ? 'INTRO_NOT_MINE' : 'INTRO_UNOPENABLE'; } catch { }
      }
      throw error;
    }
    if (guardFailure) throw guardFailure;
    const misplaced = introEpochVerdict(opened.introEpoch ?? null, delivery?.epoch);
    if (misplaced) throw introReplayError(misplaced);
    const createdAt = Number(capsule.created_at ?? capsule.createdAt ?? 0) || 0;
    if (seenBefore) {
      const held = typeof convKeyStore.getConversation === 'function' ? convKeyStore.getConversation(recipientKeyPair.keyId, opened.senderKeyId) : null;
      if (held && sameIntroNonce(held.adoptedIntroNonce, opened.introNonce)) {
        await convKeyStore.upsertConversationKRoot(recipientKeyPair.keyId, opened.senderKeyId, adoptionOf(opened, capsule, createdAt));
      }
      throw introReplayError('introNonce already seen');
    }

    const adoption = await convKeyStore.upsertConversationKRoot(recipientKeyPair.keyId, opened.senderKeyId, adoptionOf(opened, capsule, createdAt));
    if (typeof keptDurably === 'function' && !(await keptDurably())) {
      throw new Error('the conversation key is not on disk yet; this first contact is read again at the next pass');
    }

    const result = { ...opened, adoption };
    if (typeof onFirstContact === 'function' && adoption !== 'replayed') await onFirstContact(result, capsule);
    if (introReplayGuard && nonceToRecord !== null) await introReplayGuard.add(nonceToRecord);
    return result;
  };
}
