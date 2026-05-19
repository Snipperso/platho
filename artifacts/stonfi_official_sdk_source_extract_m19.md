# STON.fi Official SDK Source Extract for M19A

Source package inspected:

```text
@ston-fi/sdk@2.7.0
repository: https://github.com/ston-fi/sdk/tree/main/packages/sdk
export used for route semantics: @ston-fi/sdk/dex/v2_1
```

The source below was extracted from the official npm package tarball source maps.

## `src/contracts/dex/v2_1/constants.ts`

```ts
export const DEX_OP_CODES = {
  SWAP: 0x6664de2a,
  CROSS_SWAP: 0x69cf1a5b,
  PROVIDE_LP: 0x37c096df,
  DIRECT_ADD_LIQUIDITY: 0xff8bfc6,
  REFUND_ME: 0x132b9a2c,
  RESET_GAS: 0x29d22935,
  COLLECT_FEES: 0x1ee4911e,
  BURN: 0x595f07bc,
  WITHDRAW_FEE: 0x354bcdf4,
} as const;

export const TX_DEADLINE = 15 * 60; // 15 minutes
```

## `src/contracts/pTON/v2_1/constants.ts`

```ts
export const pTON_OP_CODES = {
  TON_TRANSFER: 0x01f3835d,
  DEPLOY_WALLET: 0x4f5f4313,
} as const;
```

## `src/contracts/dex/v2_1/router/BaseRouterV2_1.ts` relevant constants

```ts
public static readonly gasConstants = {
  swapJettonToJetton: {
    gasAmount: toNano("0.3"),
    forwardGasAmount: toNano("0.24"),
  },
  swapJettonToTon: {
    gasAmount: toNano("0.3"),
    forwardGasAmount: toNano("0.24"),
  },
  swapTonToJetton: {
    forwardGasAmount: toNano("0.3"),
  },
  provideLpJetton: {
    gasAmount: toNano("0.3"),
    forwardGasAmount: toNano("0.235"),
  },
  provideLpTon: {
    forwardGasAmount: toNano("0.3"),
  },
  singleSideProvideLpJetton: {
    gasAmount: toNano("1"),
    forwardGasAmount: toNano("0.8"),
  },
  singleSideProvideLpTon: {
    forwardGasAmount: toNano("0.8"),
  },
};
```

## `BaseRouterV2_1.createSwapBody(...)`

```ts
return beginCell()
  .storeUint(DEX_OP_CODES.SWAP, 32)
  .storeAddress(toAddress(params.askJettonWalletAddress))
  .storeAddress(toAddress(params.refundAddress))
  .storeAddress(toAddress(params.excessesAddress ?? params.refundAddress))
  .storeUint(params.deadline ?? this.defaultDeadline, 64)
  .storeRef(
    beginCell()
      .storeCoins(BigInt(params.minAskAmount))
      .storeAddress(toAddress(params.receiverAddress))
      .storeCoins(BigInt(params.dexCustomPayloadForwardGasAmount ?? 0))
      .storeMaybeRef(params.dexCustomPayload)
      .storeCoins(BigInt(params.refundForwardGasAmount ?? 0))
      .storeMaybeRef(params.refundPayload)
      .storeUint(BigInt(params.referralValue ?? 10), 16)
      .storeAddress(this.maybeReferralAddress(params.referralAddress))
      .endCell(),
  )
  .endCell();
```

## `BaseRouterV2_1.getSwapTonToJettonTxParams(...)`

```ts
const forwardPayload = await this.createSwapBody({
  askJettonWalletAddress: askJettonWalletAddress,
  receiverAddress: params.receiverAddress ?? params.userWalletAddress,
  minAskAmount: params.minAskAmount,
  refundAddress: params.refundAddress ?? params.userWalletAddress,
  excessesAddress: params.excessesAddress,
  referralAddress: params.referralAddress,
  referralValue: params.referralValue,
  dexCustomPayload: params.dexCustomPayload,
  dexCustomPayloadForwardGasAmount: params.dexCustomPayloadForwardGasAmount,
  refundPayload: params.refundPayload,
  refundForwardGasAmount: params.refundForwardGasAmount,
  deadline: params.deadline,
});

const forwardTonAmount = BigInt(
  params.forwardGasAmount ??
    this.gasConstants.swapTonToJetton.forwardGasAmount,
);

return await provider.open(params.proxyTon).getTonTransferTxParams({
  queryId: params.queryId ?? 0,
  tonAmount: params.offerAmount,
  destinationAddress: contractAddress,
  destinationWalletAddress: params.offerJettonWalletAddress,
  refundAddress: params.userWalletAddress,
  forwardPayload,
  forwardTonAmount,
});
```

## `src/contracts/pTON/v2_1/PtonV2_1.ts`

```ts
public static override readonly gasConstants = {
  tonTransfer: toNano("0.01"),
  deployWallet: toNano("0.1"),
};

public async createTonTransferBody(params: {
  tonAmount: AmountType;
  refundAddress: AddressType;
  forwardPayload?: Cell;
  queryId?: QueryIdType;
}): Promise<Cell> {
  const builder = beginCell();

  builder.storeUint(pTON_OP_CODES.TON_TRANSFER, 32);
  builder.storeUint(params.queryId ?? 0, 64);
  builder.storeCoins(BigInt(params.tonAmount));
  builder.storeAddress(toAddress(params.refundAddress));

  if (params.forwardPayload) {
    builder.storeBit(true);
    builder.storeRef(params.forwardPayload);
  } else {
    builder.storeBit(false);
  }

  return builder.endCell();
}

public override async getTonTransferTxParams(...) {
  const value =
    BigInt(params.tonAmount) +
    BigInt(params.forwardTonAmount ?? 0) +
    BigInt(this.gasConstants.tonTransfer);

  return { to, value, body };
}
```
