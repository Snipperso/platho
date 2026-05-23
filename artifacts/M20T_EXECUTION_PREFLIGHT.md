# M20T Execution Preflight

Status: BALANCE_NOT_CHECKED

## Wallet

```text
address=0QCDGghF7J5InXzzOmJPjZp6i8kxPdji2mwV5TDnc5VXE9i6
walletVersion=v4r2
secretMaterialPrinted=false
mnemonicPresent=true
rpcApiKeyPresent=false
```

## Funding

```text
observedBalanceNanotons=NOT_CHECKED
fullSizeM20TMinimumNanotons=55000000000
remainingForFullSizeM20TNanotons=NOT_CHECKED
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
- observedBalanceProvided: false
- fullSizeBalanceReady: false

## Blockers

None

## Warnings

- M20T_BALANCE_NOT_CHECKED
- M20T_RPC_API_KEY_NOT_SET_OR_NOT_DETECTED

## Final Statement

M20T testnet evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.
