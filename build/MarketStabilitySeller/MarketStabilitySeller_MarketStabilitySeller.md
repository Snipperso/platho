# Tact compilation report
Contract: MarketStabilitySeller
BoC Size: 11596 bytes

## Structures (Structs and Messages)
Total structures: 47

### DataSize
TL-B: `_ cells:int257 bits:int257 refs:int257 = DataSize`
Signature: `DataSize{cells:int257,bits:int257,refs:int257}`

### SignedBundle
TL-B: `_ signature:fixed_bytes64 signedData:remainder<slice> = SignedBundle`
Signature: `SignedBundle{signature:fixed_bytes64,signedData:remainder<slice>}`

### StateInit
TL-B: `_ code:^cell data:^cell = StateInit`
Signature: `StateInit{code:^cell,data:^cell}`

### Context
TL-B: `_ bounceable:bool sender:address value:int257 raw:^slice = Context`
Signature: `Context{bounceable:bool,sender:address,value:int257,raw:^slice}`

### SendParameters
TL-B: `_ mode:int257 body:Maybe ^cell code:Maybe ^cell data:Maybe ^cell value:int257 to:address bounce:bool = SendParameters`
Signature: `SendParameters{mode:int257,body:Maybe ^cell,code:Maybe ^cell,data:Maybe ^cell,value:int257,to:address,bounce:bool}`

### MessageParameters
TL-B: `_ mode:int257 body:Maybe ^cell value:int257 to:address bounce:bool = MessageParameters`
Signature: `MessageParameters{mode:int257,body:Maybe ^cell,value:int257,to:address,bounce:bool}`

### DeployParameters
TL-B: `_ mode:int257 body:Maybe ^cell value:int257 bounce:bool init:StateInit{code:^cell,data:^cell} = DeployParameters`
Signature: `DeployParameters{mode:int257,body:Maybe ^cell,value:int257,bounce:bool,init:StateInit{code:^cell,data:^cell}}`

### StdAddress
TL-B: `_ workchain:int8 address:uint256 = StdAddress`
Signature: `StdAddress{workchain:int8,address:uint256}`

### VarAddress
TL-B: `_ workchain:int32 address:^slice = VarAddress`
Signature: `VarAddress{workchain:int32,address:^slice}`

### BasechainAddress
TL-B: `_ hash:Maybe int257 = BasechainAddress`
Signature: `BasechainAddress{hash:Maybe int257}`

### ATHBurn
TL-B: `ath_burn#41544801 query_id:uint64 amount:uint128 response_destination:address = ATHBurn`
Signature: `ATHBurn{query_id:uint64,amount:uint128,response_destination:address}`

### ATHBurnNotification
TL-B: `ath_burn_notification#41544802 query_id:uint64 amount:uint128 owner_address:address response_destination:address = ATHBurnNotification`
Signature: `ATHBurnNotification{query_id:uint64,amount:uint128,owner_address:address,response_destination:address}`

### ATHBurnFinalized
TL-B: `ath_burn_finalized#41544803 query_id:uint64 amount:uint128 owner_address:address = ATHBurnFinalized`
Signature: `ATHBurnFinalized{query_id:uint64,amount:uint128,owner_address:address}`

### ATHBurnFailed
TL-B: `ath_burn_failed#41544804 query_id:uint64 amount:uint128 = ATHBurnFailed`
Signature: `ATHBurnFailed{query_id:uint64,amount:uint128}`

### ATHGenesisSupplyCredit
TL-B: `ath_genesis_supply_credit#41544805 query_id:uint64 amount:uint128 response_destination:address = ATHGenesisSupplyCredit`
Signature: `ATHGenesisSupplyCredit{query_id:uint64,amount:uint128,response_destination:address}`

### ATHGenesisSupplyAck
TL-B: `ath_genesis_supply_ack#41544806 query_id:uint64 amount:uint128 owner_address:address = ATHGenesisSupplyAck`
Signature: `ATHGenesisSupplyAck{query_id:uint64,amount:uint128,owner_address:address}`

### AthTransferNotification
TL-B: `ath_transfer_notification#472d9d7d query_id:uint64 amount:uint128 sender_key:uint32 sender_wallet:address = AthTransferNotification`
Signature: `AthTransferNotification{query_id:uint64,amount:uint128,sender_key:uint32,sender_wallet:address}`

### AthTransferNotificationAck
TL-B: `ath_transfer_notification_ack#472d9d7e query_id:uint64 amount:uint128 sender_key:uint32 = AthTransferNotificationAck`
Signature: `AthTransferNotificationAck{query_id:uint64,amount:uint128,sender_key:uint32}`

### PruneStaleNotification
TL-B: `prune_stale_notification#504e5052 query_id:uint64 sender_key:uint32 = PruneStaleNotification`
Signature: `PruneStaleNotification{query_id:uint64,sender_key:uint32}`

### AthTransferNotificationMintUsername
TL-B: `ath_transfer_notification_mint_username#89129d5f query_id:uint64 amount:uint128 sender_key:uint32 owner_wallet:address username_len:uint8 username:remainder<slice> = AthTransferNotificationMintUsername`
Signature: `AthTransferNotificationMintUsername{query_id:uint64,amount:uint128,sender_key:uint32,owner_wallet:address,username_len:uint8,username:remainder<slice>}`

### AthTransferNotificationProfileAvatar
TL-B: `ath_transfer_notification_profile_avatar#a11a7001 query_id:uint64 amount:uint128 sender_key:uint32 owner_wallet:address avatar_hash:uint256 avatar_entry_id:uint64 avatar_stream_id:uint128 avatar_part_count:uint16 media_format:uint8 = AthTransferNotificationProfileAvatar`
Signature: `AthTransferNotificationProfileAvatar{query_id:uint64,amount:uint128,sender_key:uint32,owner_wallet:address,avatar_hash:uint256,avatar_entry_id:uint64,avatar_stream_id:uint128,avatar_part_count:uint16,media_format:uint8}`

### ATHTransferRequest
TL-B: `ath_transfer_request#41544810 query_id:uint64 amount:uint128 recipient:address response_destination:address = ATHTransferRequest`
Signature: `ATHTransferRequest{query_id:uint64,amount:uint128,recipient:address,response_destination:address}`

### ATHTransferRequestWithNotify
TL-B: `ath_transfer_request_with_notify#41544814 query_id:uint64 amount:uint128 recipient:address response_destination:address notify_destination:address notify_value:uint128 = ATHTransferRequestWithNotify`
Signature: `ATHTransferRequestWithNotify{query_id:uint64,amount:uint128,recipient:address,response_destination:address,notify_destination:address,notify_value:uint128}`

### ATHTransferRequestMintUsername
TL-B: `ath_transfer_request_mint_username#41544816 query_id:uint64 amount:uint128 recipient:address response_destination:address notify_value:uint128 username_len:uint8 username:remainder<slice> = ATHTransferRequestMintUsername`
Signature: `ATHTransferRequestMintUsername{query_id:uint64,amount:uint128,recipient:address,response_destination:address,notify_value:uint128,username_len:uint8,username:remainder<slice>}`

### ATHTransferRequestProfileAvatar
TL-B: `ath_transfer_request_profile_avatar#41544818 query_id:uint64 amount:uint128 recipient:address response_destination:address notify_value:uint128 avatar_hash:uint256 avatar_entry_id:uint64 avatar_stream_id:uint128 avatar_part_count:uint16 media_format:uint8 = ATHTransferRequestProfileAvatar`
Signature: `ATHTransferRequestProfileAvatar{query_id:uint64,amount:uint128,recipient:address,response_destination:address,notify_value:uint128,avatar_hash:uint256,avatar_entry_id:uint64,avatar_stream_id:uint128,avatar_part_count:uint16,media_format:uint8}`

### ATHInternalTransfer
TL-B: `ath_internal_transfer#41544812 query_id:uint64 amount:uint128 sender_owner:address response_destination:address = ATHInternalTransfer`
Signature: `ATHInternalTransfer{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address}`

### ATHInternalTransferWithNotify
TL-B: `ath_internal_transfer_with_notify#41544815 query_id:uint64 amount:uint128 sender_owner:address response_destination:address notify_destination:address notify_value:uint128 = ATHInternalTransferWithNotify`
Signature: `ATHInternalTransferWithNotify{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address,notify_destination:address,notify_value:uint128}`

### ATHInternalTransferMintUsername
TL-B: `ath_internal_transfer_mint_username#41544817 query_id:uint64 amount:uint128 sender_owner:address response_destination:address notify_value:uint128 username_len:uint8 username:remainder<slice> = ATHInternalTransferMintUsername`
Signature: `ATHInternalTransferMintUsername{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address,notify_value:uint128,username_len:uint8,username:remainder<slice>}`

### ATHInternalTransferProfileAvatar
TL-B: `ath_internal_transfer_profile_avatar#41544819 query_id:uint64 amount:uint128 sender_owner:address response_destination:address notify_value:uint128 avatar_hash:uint256 avatar_entry_id:uint64 avatar_stream_id:uint128 avatar_part_count:uint16 media_format:uint8 = ATHInternalTransferProfileAvatar`
Signature: `ATHInternalTransferProfileAvatar{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address,notify_value:uint128,avatar_hash:uint256,avatar_entry_id:uint64,avatar_stream_id:uint128,avatar_part_count:uint16,media_format:uint8}`

### ATHTransferAck
TL-B: `ath_transfer_ack#41544811 query_id:uint64 amount:uint128 = ATHTransferAck`
Signature: `ATHTransferAck{query_id:uint64,amount:uint128}`

### ATHTransferFailed
TL-B: `ath_transfer_failed#41544813 query_id:uint64 amount:uint128 = ATHTransferFailed`
Signature: `ATHTransferFailed{query_id:uint64,amount:uint128}`

### ATHWalletDataView
TL-B: `_ balance:int257 owner_address:address ath_master_address:address = ATHWalletDataView`
Signature: `ATHWalletDataView{balance:int257,owner_address:address,ath_master_address:address}`

### PendingAthTransferNotificationView
TL-B: `_ exists:bool sender_owner:address amount:int257 created_at:int257 = PendingAthTransferNotificationView`
Signature: `PendingAthTransferNotificationView{exists:bool,sender_owner:address,amount:int257,created_at:int257}`

### PendingAthTransferNotification
TL-B: `_ sender_owner:address amount:uint128 created_at:uint32 = PendingAthTransferNotification`
Signature: `PendingAthTransferNotification{sender_owner:address,amount:uint128,created_at:uint32}`

### ATHWallet$Data
TL-B: `_ balance:uint128 owner_address:address ath_master_address:address pending_notifications:dict<int, ^PendingAthTransferNotification{sender_owner:address,amount:uint128,created_at:uint32}> processed_notifications:dict<int, int> pruned_notification_acks:dict<int, int> = ATHWallet`
Signature: `ATHWallet{balance:uint128,owner_address:address,ath_master_address:address,pending_notifications:dict<int, ^PendingAthTransferNotification{sender_owner:address,amount:uint128,created_at:uint32}>,processed_notifications:dict<int, int>,pruned_notification_acks:dict<int, int>}`

### BindMarketStabilityReserveFunder
TL-B: `bind_market_stability_reserve_funder#4d535246 deployment_manifest_hash:uint256 reserve_funder_address:address = BindMarketStabilityReserveFunder`
Signature: `BindMarketStabilityReserveFunder{deployment_manifest_hash:uint256,reserve_funder_address:address}`

### BindMarketStabilityOfficialAthWallet
TL-B: `bind_market_stability_official_ath_wallet#4d534157 deployment_manifest_hash:uint256 official_ath_wallet_address:address = BindMarketStabilityOfficialAthWallet`
Signature: `BindMarketStabilityOfficialAthWallet{deployment_manifest_hash:uint256,official_ath_wallet_address:address}`

### BindMarketStabilityTreasury
TL-B: `bind_market_stability_treasury#4d535452 deployment_manifest_hash:uint256 ton_treasury_receiver_address:address = BindMarketStabilityTreasury`
Signature: `BindMarketStabilityTreasury{deployment_manifest_hash:uint256,ton_treasury_receiver_address:address}`

### FreezeMarketStabilityPricing
TL-B: `freeze_market_stability_pricing#4d535046 deployment_manifest_hash:uint256 base_tranche_price_nanotons:uint128 evidence_x1_tranche_quote_nanotons:uint128 pricing_evidence_hash:uint256 = FreezeMarketStabilityPricing`
Signature: `FreezeMarketStabilityPricing{deployment_manifest_hash:uint256,base_tranche_price_nanotons:uint128,evidence_x1_tranche_quote_nanotons:uint128,pricing_evidence_hash:uint256}`

### SealMarketStabilityGenesis
TL-B: `seal_market_stability_genesis#4d53534c deployment_manifest_hash:uint256 = SealMarketStabilityGenesis`
Signature: `SealMarketStabilityGenesis{deployment_manifest_hash:uint256}`

### BuyMarketStabilityAth
TL-B: `buy_market_stability_ath#4d534558 query_id:uint64 amount:uint128 recipient:address = BuyMarketStabilityAth`
Signature: `BuyMarketStabilityAth{query_id:uint64,amount:uint128,recipient:address}`

### FlushMarketStabilityTreasuryTon
TL-B: `flush_market_stability_treasury_ton#4d534654 amount:uint128 = FlushMarketStabilityTreasuryTon`
Signature: `FlushMarketStabilityTreasuryTon{amount:uint128}`

### MarketStabilityTopUpStorageReserve
TL-B: `market_stability_top_up_storage_reserve#906182d3  = MarketStabilityTopUpStorageReserve`
Signature: `MarketStabilityTopUpStorageReserve{}`

### MarketStabilitySellerConfigView
TL-B: `_ sealed:bool reserve_funder_bound:bool official_ath_wallet_bound:bool treasury_bound:bool pricing_frozen:bool deployment_manifest_hash:int257 genesis_config_hash:int257 ath_master_address:address reserve_funder_address:address official_ath_wallet_address:address ton_treasury_receiver_address:address base_tranche_price_nanotons:int257 evidence_x1_tranche_quote_nanotons:int257 pricing_evidence_hash:int257 = MarketStabilitySellerConfigView`
Signature: `MarketStabilitySellerConfigView{sealed:bool,reserve_funder_bound:bool,official_ath_wallet_bound:bool,treasury_bound:bool,pricing_frozen:bool,deployment_manifest_hash:int257,genesis_config_hash:int257,ath_master_address:address,reserve_funder_address:address,official_ath_wallet_address:address,ton_treasury_receiver_address:address,base_tranche_price_nanotons:int257,evidence_x1_tranche_quote_nanotons:int257,pricing_evidence_hash:int257}`

### MarketStabilitySellerStateView
TL-B: `_ phase:int257 reserve_due_ath:int257 treasury_due_ton:int257 pending_query_id:int257 pending_amount_ath:int257 pending_paid_ton:int257 pending_buyer:address pending_recipient:address pending_recipient_ath_wallet:address completed_tranche_count:int257 current_tranche_sold_ath:int257 current_multiplier:int257 current_tranche_remaining_ath:int257 last_terminal_query_id:int257 = MarketStabilitySellerStateView`
Signature: `MarketStabilitySellerStateView{phase:int257,reserve_due_ath:int257,treasury_due_ton:int257,pending_query_id:int257,pending_amount_ath:int257,pending_paid_ton:int257,pending_buyer:address,pending_recipient:address,pending_recipient_ath_wallet:address,completed_tranche_count:int257,current_tranche_sold_ath:int257,current_multiplier:int257,current_tranche_remaining_ath:int257,last_terminal_query_id:int257}`

### MarketStabilitySellerTotalsView
TL-B: `_ reserve_funded_total_ath:int257 sold_ath_total:int257 treasury_flushed_ton_total:int257 = MarketStabilitySellerTotalsView`
Signature: `MarketStabilitySellerTotalsView{reserve_funded_total_ath:int257,sold_ath_total:int257,treasury_flushed_ton_total:int257}`

### MarketStabilitySeller$Data
TL-B: `_ genesis_config_hash:uint256 deployment_manifest_hash:uint256 ath_master_address:address reserve_funder_address:address official_ath_wallet_address:address ton_treasury_receiver_address:address reserve_funder_bound:bool official_ath_wallet_bound:bool treasury_bound:bool pricing_frozen:bool sealed:bool base_tranche_price_nanotons:uint128 evidence_x1_tranche_quote_nanotons:uint128 pricing_evidence_hash:uint256 phase:uint8 reserve_due_ath:uint128 treasury_due_ton:uint128 pending_query_id:uint64 pending_amount_ath:uint128 pending_paid_ton:uint128 pending_buyer:address pending_recipient:address pending_recipient_ath_wallet:address completed_tranche_count:uint8 current_tranche_sold_ath:uint128 last_terminal_query_id:uint64 reserve_funded_total_ath:uint128 sold_ath_total:uint128 treasury_flushed_ton_total:uint128 = MarketStabilitySeller`
Signature: `MarketStabilitySeller{genesis_config_hash:uint256,deployment_manifest_hash:uint256,ath_master_address:address,reserve_funder_address:address,official_ath_wallet_address:address,ton_treasury_receiver_address:address,reserve_funder_bound:bool,official_ath_wallet_bound:bool,treasury_bound:bool,pricing_frozen:bool,sealed:bool,base_tranche_price_nanotons:uint128,evidence_x1_tranche_quote_nanotons:uint128,pricing_evidence_hash:uint256,phase:uint8,reserve_due_ath:uint128,treasury_due_ton:uint128,pending_query_id:uint64,pending_amount_ath:uint128,pending_paid_ton:uint128,pending_buyer:address,pending_recipient:address,pending_recipient_ath_wallet:address,completed_tranche_count:uint8,current_tranche_sold_ath:uint128,last_terminal_query_id:uint64,reserve_funded_total_ath:uint128,sold_ath_total:uint128,treasury_flushed_ton_total:uint128}`

## Get methods
Total get methods: 5

## get_market_stability_seller_config
No arguments

## get_market_stability_seller_state
No arguments

## get_market_stability_seller_totals
No arguments

## get_official_ath_wallet_address
No arguments

## get_quote_ton_for_amount
Argument: amount

## Exit codes
* 2: Stack underflow
* 3: Stack overflow
* 4: Integer overflow
* 5: Integer out of expected range
* 6: Invalid opcode
* 7: Type check error
* 8: Cell overflow
* 9: Cell underflow
* 10: Dictionary error
* 11: 'Unknown' error
* 12: Fatal error
* 13: Out of gas error
* 14: Virtualization error
* 32: Action list is invalid
* 33: Action list is too long
* 34: Action is invalid or not supported
* 35: Invalid source address in outbound message
* 36: Invalid destination address in outbound message
* 37: Not enough Toncoin
* 38: Not enough extra currencies
* 39: Outbound message does not fit into a cell after rewriting
* 40: Cannot process a message
* 41: Library reference is null
* 42: Library change action error
* 43: Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree
* 50: Account state size exceeded limits
* 128: Null reference exception
* 129: Invalid serialization prefix
* 130: Invalid incoming message
* 131: Constraints error
* 132: Access denied
* 133: Contract stopped
* 134: Invalid argument
* 135: Code of a contract was not found
* 136: Invalid standard address
* 138: Not a basechain address

## Trait inheritance diagram

```mermaid
graph TD
MarketStabilitySeller
MarketStabilitySeller --> BaseTrait
```

## Contract dependency diagram

```mermaid
graph TD
MarketStabilitySeller
MarketStabilitySeller --> ATHWallet
```