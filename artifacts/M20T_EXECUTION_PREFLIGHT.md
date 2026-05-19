# M20T Execution Preflight

Status: READY_FOR_FULL_SIZE_M20T

## Wallet

```text
address=0QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
walletVersion=v4r2
secretMaterialPrinted=false
mnemonicPresent=true
rpcApiKeyPresent=false
```

## Funding

```text
observedBalanceNanotons=57999999813
fullSizeM20TMinimumNanotons=55000000000
remainingForFullSizeM20TNanotons=0
```

## Checks

- envExampleExists: true
- envLocalExists: true
- networkIsTestnet: true
- rpcEndpointIsTestnet: true
- mainnetDisabled: true
- stonfiRouteFreezeFlagFalse: true
- buybackBurnImplementationFlagFalse: true
- minBalanceIsFullSizeM20T: true
- deployerAddressPresent: true
- deployerAddressShape: true
- walletVersionPinned: true
- vitestVmThreads: true
- localEnvIgnored: true
- secretArtifactsIgnored: true
- manifestTemplateReady: true
- evidenceTemplateReady: true
- evidenceFinalStatementPinned: true
- observedBalanceProvided: true
- fullSizeBalanceReady: true

## Blockers

None

## Warnings

- M20T_RPC_API_KEY_NOT_SET_OR_NOT_DETECTED

## Final Statement

M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.
