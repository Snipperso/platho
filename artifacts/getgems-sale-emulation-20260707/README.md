# GetGems put-on-sale failure for username NFTs — root cause (2026-07-07)

## Symptom
GetGems "Put on Sale" for `support.ath` (UsernameNFTItem `0:50f4a53514cdfce329f7f587ff236568a5f5635ca02cbc0b8106beeac2b303fe`)
fails in the GetGems UI pre-flight with:

> Unexpected NFT behavior: throw error on transfer, exit code: 0 with balance 0.050495715

## Root cause (confirmed bit-exact in @ton/sandbox)
`UsernameNFTItem.NftTransfer` sends the excesses message with `SendRemainingValue` (mode 64).
TVM mode 64 carries the *full* remaining inbound value and does NOT subtract the
`ownership_assigned` message (value = `forward_amount`) already emitted in the same action list.
The two outgoing messages therefore total `forward_amount + (msg_value - fees)`, and the
`forward_amount` shortfall is paid **out of the NFT item's own balance**.

GetGems' put-on-sale transfer uses `forward_amount = 0.2 TON` (observed live: transfer value
0.213, forward 0.2, new_owner = GG deployer `0:39d6…7e0e`). So the item needs ≥ ~0.21 TON of
its own balance for the action phase to succeed.

GetGems' UI pre-flight emulates the transfer against a **normalized item balance of
~0.0505 TON** (the "balance 0.050495715" in the toast; the real item balance was 0.4959 TON
the whole time). With 0.0505 the action phase fails with result code 37 (not enough TON)
while the compute phase exits 0 — exactly "throw error on transfer, exit code: 0".

## Reproduction (scripts in this folder, run from repo root)
- `emulate_getgems_sale.mjs` — full real put-on-sale chain (live code+data of the NFT and the
  GG deployer, real T1 body from a successful TON DNS sale with addresses rewritten):
  passes cleanly at the live balance 0.4959; NFT ends owned by the freshly deployed sale
  contract; item balance drops 0.4959 → 0.2945 (the mode-64 overpayment goes back to the
  owner as excesses, so the owner loses nothing on a self-listing).
- `emulate_matrix.mjs` — synthetic transfer matrix + the exact GetGems T1 at balance
  0.050495715 → `compute=0 action=37 aborted` (the observed error), and at 0.4959 → success.
  Also shows: TEP-62-legal `response_destination = addr_none` makes the item throw exit 9
  (Tact strict Address parse) — a second, independent standard-compliance gap.

## Consequences (contract is sealed — cannot fix on-chain)
1. Any transfer with `forward_amount = F` silently drains ~F from the item balance
   (returned to `response_destination` inside excesses). Transfers with
   `F > item_balance - ~0.01` hard-fail in the action phase (code 37).
2. GetGems UI listing is blocked by their pre-flight (which uses ~0.05 balance), regardless
   of the real item balance — unless their emulation actually uses live state that was
   merely stale at the time (item was minted minutes before the attempt).
3. Real, direct on-chain listing DOES work at the current balance: sending the same T1
   transaction from the owner wallet deploys the GG fix-price sale and moves the NFT to it;
   GetGems indexes such sales normally.
4. Keep every username NFT item balance ≥ ~0.25 TON (top-up via `TopUpStorageReserve`
   op `0x27ACDF8B`) or transfers/sales with meaningful forward amounts will start failing.

## clean-15 fix status (2026-07-07)
`UsernameNFTItem.NftTransfer` rewritten to reference TEP-62 semantics for the clean-15 redeploy:
explicit rest excesses (never mode 64), addr_none response_destination accepted (manual body
parse), fee allowance = max(10M, inbound readForwardFee()*2) per the reference nft-item.fc
pattern. Adversarially reviewed (4 lenses + empirical verifiers, 9 agents): SOUND, 0 critical.
`emulate_fixed_item.ts` proves the full GetGems flow on the fixed code: listing at the 0.0505
synthetic pre-flight balance passes (their Sell button goes green), buy and cancel pass, the
item balance never drops on marketplace flows.
Known accepted limitation (reference-parity, owner-only, rollback-safe): a sender-crafted
multi-thousand-cell forward_payload can out-run the fee allowance ONLY when the inbound message
under-reports its forward fee — impossible for real network traffic (validators price the
inbound fee by payload size, which scales the allowance), reproducible only by direct sandbox
injection with forwardFee=0 (`repro_fwdfee_claimcheck.ts` cases C/E; E shows the fail-closed
rollback).
