// airdrop-ticket-read — a wallet's own activity-credit ticket, read from chain.
//
// WHY IT EXISTS. Publishing accrues credits: a shard's capsule fee reaches FeeAccumulator, which forwards a
// TicketCredit to the publisher's own AirdropTicket (lazily deployed on the first one). The mechanism has worked
// since genesis — MEASURED 2026-08-03, the owner's ticket held 8 credits — but the client had no way to SEE it. The
// wallet screen rendered a dash, and the code there said why: "the 'issued' figure has NO client source yet … the
// address only exists after the genesis ceremony". The ceremony has happened; this is the reader it was waiting for.
//
// The address is DERIVED, not asked for: FeeAccumulator computes it internally and the sealed contract exposes no
// getter. Absence of the account is a normal state, not an error — it means the user has not published yet.
import { airdropTicketAddressBytes, rawAddress } from './shard-address.mjs?v=4';
import { formatTonUserFriendlyAddress } from './platho-wallet.mjs?v=18';
import { stackNumOr0 } from './ton-stack-num.mjs?v=1';

/** Friendly, bounceable address of `ownerWallet`'s ticket. `ownerWallet` is a raw `workchain:hex` address. */
export async function airdropTicketAddress(ownerWallet) {
  const { workchain, hash } = await airdropTicketAddressBytes(ownerWallet);
  return formatTonUserFriendlyAddress(rawAddress({ workchain, hash }), { bounceable: true });
}

/**
 * Decode an AirdropTicketView getter stack. Field order mirrors the struct in contracts/AirdropTicket.tact and an
 * arity check guards the silent field-shift drift the other lanes learned the hard way — a getter that grew a field
 * would hand every later value to the wrong name.
 *
 * Index 0 is the owner ADDRESS (a slice), skipped here: the caller already knows whose ticket it asked for, and
 * decoding an address from a stack cell would drag the BOC parser into this module for nothing.
 */
export function decodeAirdropTicketStack(stack) {
  if (!Array.isArray(stack) || stack.length < 8) {
    throw new Error(`get_ticket returned ${stack?.length ?? 0} stack items, expected 8`);
  }
  const num = (i, name) => stackNumOr0(stack[i]?.value, `get_ticket: ${name}`);
  return {
    credits: num(1, 'credits'),
    inFlight: num(2, 'in_flight'),
    inFlightAt: num(3, 'in_flight_at'),
    unjamGraceSeconds: num(4, 'unjam_grace_seconds'),
    minClaimCredits: num(5, 'min_claim_credits'),
    maxCreditsPerClaim: num(6, 'max_credits_per_claim'),
    claimMinValue: num(7, 'claim_min_value'),
  };
}

/**
 * Read `ownerWallet`'s ticket. Returns `{ exists: false }` when the account is not deployed — the state EVERY wallet
 * is in until its first publish, so it must be an ordinary answer rather than a thrown error.
 *
 * `runGetMethod` is the app's transport call. A ticket only ever grows, so this read is cache-eligible; it is not a
 * "has my write landed" question and deliberately does not force freshness.
 */
export function createAirdropTicketReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createAirdropTicketReader requires runGetMethod');
  return async (ownerWallet) => {
    const address = await airdropTicketAddress(ownerWallet);
    const raw = await runGetMethod({ address, method: 'get_ticket', stack: [] });
    // An uninitialised account aborts the get-method run; the transport surfaces that as a non-zero exit code.
    if (!raw || raw.exit_code !== 0) return { exists: false, address };
    return { exists: true, address, ...decodeAirdropTicketStack(raw.stack) };
  };
}
