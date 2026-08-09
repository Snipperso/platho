// username-nft-transfer — hand a .ath name to another wallet, from inside Platho.
//
// The names are TEP-62 NFTs and always were, so moving one has never needed anything Platho does not already have:
// the item obeys a standard transfer from its owner, and Platho IS the owner's wallet. What was missing was only the
// button. Until now the owner of a name had to connect the same seed to Tonkeeper to move it — a wallet asking its
// user to go find another wallet.
//
// THE BODY IS TEP-62 AND NOTHING MORE:
//   op(32) | query_id(64) | new_owner(Address) | response_destination(MsgAddress) | custom_payload(Maybe ^Cell)
//   | forward_amount(Coins) | forward_payload(Either)
// UsernameNFTItem parses exactly this shape by hand (receive(msg: NftTransfer) reads the payload as a raw slice), so
// the layout here is pinned field-for-field against that receiver rather than against a marketplace's habits.
//
// forward_amount is ZERO, deliberately. A non-zero amount makes the item send NftOwnershipAssigned to the recipient,
// which is what a marketplace wants (its contract must be TOLD it now owns something). A person's wallet needs no
// such notification — it reads its own contents — and the amount would be leaving the sender's pocket for a message
// nobody reads. Recipients who DO need the notification are marketplaces, and they build their own transfer.
//
// response_destination is the SENDER, so the unspent remainder comes back as NftExcesses instead of settling into the
// item's balance. That is also why the value below is comfortable rather than trimmed: the item refuses at 18035 if
// the inbound value cannot cover execution plus the forward-fee allowance, and the allowance SCALES with the network
// fee schedule (`max(10M, readForwardFee() * 2)`), so a figure computed to the nanoton today would start bouncing the
// day fees rise. Over-provide and take the change back.
import { beginCell } from './pwa-contract-transactions.mjs?v=37';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=15';

/** TEP-62 transfer. Mirrored from UsernameNFTItem's `message(0x5FCC3D14) NftTransfer`. */
export const USERNAME_NFT_TRANSFER_OPCODE = 0x5FCC3D14n;

// Mirrors of UsernameNFTItem's own budget constants. tests/username-nft-transfer.test.ts re-derives each from the
// .tact, because a mirror that drifts is how a send starts bouncing with a number nobody can read.
export const USERNAME_ITEM_TRANSFER_EXEC_RESERVE_NANOTONS = 2_000_000n;
export const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE_NANOTONS = 10_000_000n;
export const USERNAME_ITEM_EXCESSES_MIN_VALUE_NANOTONS = 100_000n;

/**
 * What to attach. The item's floor is exec + allowance (= 12M with today's fee schedule) and the remainder only
 * returns if it clears the excesses minimum, so the floor alone would send the change into the item's balance
 * instead of back. 0.02 GRAM covers the floor, keeps a real refund on the way out, and leaves room for the
 * fee-scaled allowance to grow without a client release.
 */
export const USERNAME_NFT_TRANSFER_VALUE_NANOTONS = 20_000_000n;

/**
 * The body the item will accept.
 *
 * `newOwner` must be a basechain address — the item refuses anything else at 18032, and refusing here first turns a
 * typo into a sentence instead of a bounce. Both addresses are normalised through the wallet's own parser, which is
 * the same one the send path uses, so a friendly-form address pasted from anywhere is accepted on equal terms.
 */
export function buildUsernameNftTransferBody({ queryId, newOwner, responseDestination }) {
  const query = BigInt(queryId ?? 0n);
  if (query < 0n) throw new Error('username nft transfer: query_id must not be negative');
  const recipient = parseTonAddress(newOwner);
  if (recipient.workchain !== 0) throw new Error('username nft transfer: recipient must be a basechain address');
  const builder = beginCell()
    .uint(USERNAME_NFT_TRANSFER_OPCODE, 32, 'op')
    .uint(query, 64, 'query_id')
    .address(newOwner, 'new_owner');
  // MsgAddress: addr_std when there is somewhere to send the change, addr_none (two zero bits) when there is not.
  // The item distinguishes them by preloading those two bits, so this is the one field that is NOT always an address.
  if (responseDestination) builder.address(responseDestination, 'response_destination');
  else builder.uint(0n, 2, 'response_destination.none');
  return builder
    .uint(0n, 1, 'custom_payload.none')
    .coins(0n, 'forward_amount')
    // Either-bit for an inline, empty forward payload. The item never reads it while forward_amount is zero; it is
    // here so the message is well-formed for every OTHER reader of a TEP-62 transfer, explorers included.
    .uint(0n, 1, 'forward_payload.either')
    .endCell();
}

/**
 * A query id for the transfer. Unlike the seller and the buyback, the item does not compare this against anything —
 * it only echoes the id into NftOwnershipAssigned and NftExcesses. So a timestamp is not a workaround here, it is
 * simply a correlation handle, and no id can be raced out from under a sender.
 */
export function nextUsernameNftTransferQueryId(now = Date.now()) {
  const raw = typeof now === 'bigint' ? now : BigInt(Math.floor(Number(now) || 0));
  return raw > 0n ? raw : 1n;
}
