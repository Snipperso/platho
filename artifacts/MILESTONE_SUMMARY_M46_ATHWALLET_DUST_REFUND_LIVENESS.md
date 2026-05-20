# M46 ATHWallet Dust Refund Liveness

Status: **PASS**

Scope: minimal local ATHWallet liveness fix for owner-facing notify and
mint-notify requests.

## Addressed Finding

- ATHW-01: tiny owner excess, such as `required_value + 1` nanotON, could make
  an otherwise valid notify or mint-notify transfer fail in action phase because
  `refund_owner_excess()` attempted a separate dust TON refund.

## Resolution

- `refund_owner_excess()` now returns early when `amount < 100_000` nanotons.
- Notify and mint-notify owner requests still forward only the bounded canonical
  downstream envelope.
- Non-dust owner excess is still refunded to `response_destination`.
- Dust excess remains in the source ATHWallet as storage reserve instead of
  cancelling the token transfer.

## Regression Coverage

- `ATH-BND-07`: `ATHTransferRequestWithNotify` with `required_value + 1`
  succeeds and credits the recipient wallet.
- `ATH-BND-08`: `ATHTransferRequestMintUsername` with `required_value + 1`
  succeeds and credits the recipient wallet.

## Verification

- `npm.cmd run build`: PASS.
- Focused ATHWallet suite: PASS, 4 files / 25 tests.
- `npm.cmd test`: PASS, 70 files / 304 tests.
- M16 conformance: PASS.
- M18 artifact integrity: PASS.

## Hashes

- `ATH_WALLET_CODE_HASH=5c0cf65ee7b44b239a87d181b9167a406b935ac0d0879e8727e96c2e4d68064a`
- `ATHMASTER_CODE_HASH=f9b151cedf35b20bc2a5b85986e2f98f5068cb22f7669b773ef3c145fe4b0d4b`
- `BUYBACKBURN_CODE_HASH=23eaae1747dbde64a98d55095ce3715f56fbec15fb3fc80c0fe3af3eb45c6c42`
- `VAULT_CODE_HASH=419273f08cbb6036894a10a505bff41a0bef19eedbaec4281620fcc0912058d4`
- `USERNAME_REGISTRY_CODE_HASH=f56f018c96332f480437578cd55c3b9501e06129e75f4c81700ebe9bc7be880e`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=3bfbfcde97348358427a77e9485c85e3aee7d34630f18fbc43888954dd280bca`

## Production Note

This is a liveness hardening patch, not a supply/accounting change. Production
remains blocked by the existing mainnet genesis, route, address, and final
evidence gates.
