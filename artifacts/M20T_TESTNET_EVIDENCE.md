# M20T Testnet Evidence

Status: LIVE_TESTNET_M20T_HARNESS_PASS

## Network

```text
network=testnet
runId=1779138215
deployer=0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
balanceBeforeNanotons=57918803740
balanceAfterNanotons=6543486764
```

## Contracts

- M20TBuybackBurnHarness: 0QCLIkyGFLpVOma-6gXY5ZxZYz7LJvDRQzGrSTrtyeQ3t1IJ
- M20TFeeAccumulatorHarness: 0QBTgjaEzbq9Aai76uPB7RoHtLCY3FJ4OO4nCJ-LzhWaOxVR

## Probes

- accepts5105TonEnvelopeFromAuthorizedPath: PASS
- rejects50TonRawPrincipalAsIncompleteEnvelope: PASS
- rejectsWrongSender: PASS
- rejectsWrongAmount: PASS
- duplicateOrReplayBehavior: PASS
- refundExcessBounceBehavior: NOT_EXECUTED

## Suite

- npm.cmd test: 56 test files passed; 214 tests passed

## What Was Proven

- A full-size 51.05 TON M20T harness envelope can be forwarded from the bound fee-path harness to the BuybackBurn receiver harness on testnet.
- The M20T fee-path harness rejects 50 TON raw principal as an incomplete buyback envelope.
- The M20T BuybackBurn receiver harness rejects direct wrong-sender AcceptBurnReserve messages.
- The M20T BuybackBurn receiver harness rejects a wrong AcceptBurnReserve amount forwarded by the bound fee-path harness.
- A duplicate/replay FlushBuybackDue after the accepted envelope leaves one accepted envelope and zero fee-path due.

## What Was Not Proven

- mainnet STON.fi route freeze
- mainnet router/pool/pTON code hash identity
- mainnet liquidity and quote behavior
- mainnet refund/excess/bounce behavior
- production BuybackBurn implementation readiness
- production FeeAccumulator accumulation of 102.1 TON protocol fees for one 51.05 TON buyback due

## Final Statement

M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.
