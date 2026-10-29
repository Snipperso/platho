import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';

export const USERNAME_NFT_TRANSFER_OPCODE = 0x5FCC3D14n;

export const USERNAME_ITEM_TRANSFER_EXEC_RESERVE_NANOTONS = 2_000_000n;
export const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE_NANOTONS = 10_000_000n;
export const USERNAME_ITEM_EXCESSES_MIN_VALUE_NANOTONS = 100_000n;

export const USERNAME_NFT_TRANSFER_VALUE_NANOTONS = 20_000_000n;

export function buildUsernameNftTransferBody({ queryId, newOwner, responseDestination }) {
  const query = BigInt(queryId ?? 0n);
  if (query < 0n) throw new Error('username nft transfer: query_id must not be negative');
  const recipient = parseTonAddress(newOwner);
  if (recipient.workchain !== 0) throw new Error('username nft transfer: recipient must be a basechain address');
  const builder = beginCell()
    .uint(USERNAME_NFT_TRANSFER_OPCODE, 32, 'op')
    .uint(query, 64, 'query_id')
    .address(newOwner, 'new_owner');
  if (responseDestination) builder.address(responseDestination, 'response_destination');
  else builder.uint(0n, 2, 'response_destination.none');
  return builder
    .uint(0n, 1, 'custom_payload.none')
    .coins(0n, 'forward_amount')
    .uint(0n, 1, 'forward_payload.either')
    .endCell();
}

export function nextUsernameNftTransferQueryId(now = Date.now()) {
  const raw = typeof now === 'bigint' ? now : BigInt(Math.floor(Number(now) || 0));
  return raw > 0n ? raw : 1n;
}
