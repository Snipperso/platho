# Tact compilation report
Contract: UsernameNFTItem
BoC Size: 2132 bytes

## Structures (Structs and Messages)
Total structures: 78

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

### InitializeUsernameItem
TL-B: `initialize_username_item#554e494e owner_wallet:address mint_nonce:uint64 username_len:uint8 username:remainder<slice> = InitializeUsernameItem`
Signature: `InitializeUsernameItem{owner_wallet:address,mint_nonce:uint64,username_len:uint8,username:remainder<slice>}`

### ResendDeployedAck
TL-B: `resend_deployed_ack#639cfc6c  = ResendDeployedAck`
Signature: `ResendDeployedAck{}`

### TopUpStorageReserve
TL-B: `top_up_storage_reserve#27acdf8b  = TopUpStorageReserve`
Signature: `TopUpStorageReserve{}`

### ProveUsernameOwnership
TL-B: `prove_username_ownership#554e5052 query_id:uint64 to:address = ProveUsernameOwnership`
Signature: `ProveUsernameOwnership{query_id:uint64,to:address}`

### UsernameOwnershipProof
TL-B: `username_ownership_proof#554e504f query_id:uint64 name_hash:uint256 owner_wallet:address username_len:uint8 username:remainder<slice> = UsernameOwnershipProof`
Signature: `UsernameOwnershipProof{query_id:uint64,name_hash:uint256,owner_wallet:address,username_len:uint8,username:remainder<slice>}`

### UsernameItemDeployedAck
TL-B: `username_item_deployed_ack#bba3ec19 name_hash:uint256 owner_wallet:address mint_nonce:uint64 = UsernameItemDeployedAck`
Signature: `UsernameItemDeployedAck{name_hash:uint256,owner_wallet:address,mint_nonce:uint64}`

### NftTransfer
TL-B: `nft_transfer#5fcc3d14 query_id:uint64 payload:remainder<slice> = NftTransfer`
Signature: `NftTransfer{query_id:uint64,payload:remainder<slice>}`

### NftOwnershipAssigned
TL-B: `nft_ownership_assigned#05138d91 query_id:uint64 previous_owner:address forward_payload:remainder<slice> = NftOwnershipAssigned`
Signature: `NftOwnershipAssigned{query_id:uint64,previous_owner:address,forward_payload:remainder<slice>}`

### NftExcesses
TL-B: `nft_excesses#d53276db query_id:uint64 = NftExcesses`
Signature: `NftExcesses{query_id:uint64}`

### UsernameNFTItemStateView
TL-B: `_ initialized:bool owner_wallet:address username_registry_address:address name_hash:int257 username_len:int257 username:^cell tier:int257 = UsernameNFTItemStateView`
Signature: `UsernameNFTItemStateView{initialized:bool,owner_wallet:address,username_registry_address:address,name_hash:int257,username_len:int257,username:^cell,tier:int257}`

### UsernameNftDataView
TL-B: `_ initialized:bool index:int257 collection_address:address owner_address:address individual_content:^cell = UsernameNftDataView`
Signature: `UsernameNftDataView{initialized:bool,index:int257,collection_address:address,owner_address:address,individual_content:^cell}`

### UsernameNftOnchainContent
TL-B: `_ marker:uint8 metadata:dict<uint256, ^cell> = UsernameNftOnchainContent`
Signature: `UsernameNftOnchainContent{marker:uint8,metadata:dict<uint256, ^cell>}`

### UsernameNFTItem$Data
TL-B: `_ initialized:bool owner_wallet:address username_registry_address:address name_hash:uint256 username_len:uint8 username:^cell init_owner_wallet:address init_mint_nonce:uint64 = UsernameNFTItem`
Signature: `UsernameNFTItem{initialized:bool,owner_wallet:address,username_registry_address:address,name_hash:uint256,username_len:uint8,username:^cell,init_owner_wallet:address,init_mint_nonce:uint64}`

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
TL-B: `ath_transfer_notification#472d9d7d query_id:uint64 sender_key:uint160 amount:uint128 sender_wallet:address = AthTransferNotification`
Signature: `AthTransferNotification{query_id:uint64,sender_key:uint160,amount:uint128,sender_wallet:address}`

### AthTransferNotificationAck
TL-B: `ath_transfer_notification_ack#472d9d7e query_id:uint64 amount:uint128 sender_key:uint160 = AthTransferNotificationAck`
Signature: `AthTransferNotificationAck{query_id:uint64,amount:uint128,sender_key:uint160}`

### AthTransferNotificationRefund
TL-B: `ath_transfer_notification_refund#4154481e query_id:uint64 amount:uint128 sender_key:uint160 = AthTransferNotificationRefund`
Signature: `AthTransferNotificationRefund{query_id:uint64,amount:uint128,sender_key:uint160}`

### PruneStaleNotification
TL-B: `prune_stale_notification#504e5052 query_id:uint64 sender_key:uint160 = PruneStaleNotification`
Signature: `PruneStaleNotification{query_id:uint64,sender_key:uint160}`

### AthTransferNotificationRegistryMintUsername
TL-B: `ath_transfer_notification_registry_mint_username#89129d60 query_id:uint64 sender_key:uint160 amount:uint128 payer_wallet:address owner_wallet:address username_len:uint8 username:^cell = AthTransferNotificationRegistryMintUsername`
Signature: `AthTransferNotificationRegistryMintUsername{query_id:uint64,sender_key:uint160,amount:uint128,payer_wallet:address,owner_wallet:address,username_len:uint8,username:^cell}`

### AthTransferNotificationRegistryProfileAvatar
TL-B: `ath_transfer_notification_registry_profile_avatar#a11a7002 query_id:uint64 sender_key:uint160 amount:uint128 payer_wallet:address owner_wallet:address avatar_hash:uint256 avatar_entry_id:uint64 avatar_stream_id:uint128 avatar_part_count:uint16 media_format:uint8 = AthTransferNotificationRegistryProfileAvatar`
Signature: `AthTransferNotificationRegistryProfileAvatar{query_id:uint64,sender_key:uint160,amount:uint128,payer_wallet:address,owner_wallet:address,avatar_hash:uint256,avatar_entry_id:uint64,avatar_stream_id:uint128,avatar_part_count:uint16,media_format:uint8}`

### ATHTransferRequest
TL-B: `ath_transfer_request#41544810 query_id:uint64 amount:uint128 recipient:address response_destination:address = ATHTransferRequest`
Signature: `ATHTransferRequest{query_id:uint64,amount:uint128,recipient:address,response_destination:address}`

### ATHTransferRequestWithNotify
TL-B: `ath_transfer_request_with_notify#41544814 query_id:uint64 amount:uint128 recipient:address response_destination:address notify_destination:address notify_value:uint128 = ATHTransferRequestWithNotify`
Signature: `ATHTransferRequestWithNotify{query_id:uint64,amount:uint128,recipient:address,response_destination:address,notify_destination:address,notify_value:uint128}`

### ATHTransferRequestRegistryProfileAvatar
TL-B: `ath_transfer_request_registry_profile_avatar#4154481a query_id:uint64 amount:uint128 recipient:address response_destination:address notify_value:uint128 owner_wallet:address avatar_hash:uint256 avatar_entry_id:uint64 avatar_stream_id:uint128 avatar_part_count:uint16 media_format:uint8 = ATHTransferRequestRegistryProfileAvatar`
Signature: `ATHTransferRequestRegistryProfileAvatar{query_id:uint64,amount:uint128,recipient:address,response_destination:address,notify_value:uint128,owner_wallet:address,avatar_hash:uint256,avatar_entry_id:uint64,avatar_stream_id:uint128,avatar_part_count:uint16,media_format:uint8}`

### ATHTransferRequestRegistryMintUsername
TL-B: `ath_transfer_request_registry_mint_username#4154481c query_id:uint64 amount:uint128 recipient:address response_destination:address notify_value:uint128 owner_wallet:address username_len:uint8 username:remainder<slice> = ATHTransferRequestRegistryMintUsername`
Signature: `ATHTransferRequestRegistryMintUsername{query_id:uint64,amount:uint128,recipient:address,response_destination:address,notify_value:uint128,owner_wallet:address,username_len:uint8,username:remainder<slice>}`

### ATHInternalTransfer
TL-B: `ath_internal_transfer#41544812 query_id:uint64 amount:uint128 sender_owner:address response_destination:address = ATHInternalTransfer`
Signature: `ATHInternalTransfer{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address}`

### ATHInternalTransferWithNotify
TL-B: `ath_internal_transfer_with_notify#41544815 query_id:uint64 amount:uint128 sender_owner:address response_destination:address notify_destination:address notify_value:uint128 = ATHInternalTransferWithNotify`
Signature: `ATHInternalTransferWithNotify{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address,notify_destination:address,notify_value:uint128}`

### ATHInternalTransferRegistryProfileAvatar
TL-B: `ath_internal_transfer_registry_profile_avatar#4154481b query_id:uint64 amount:uint128 sender_owner:address response_destination:address notify_value:uint128 owner_wallet:address avatar_hash:uint256 avatar_entry_id:uint64 avatar_stream_id:uint128 avatar_part_count:uint16 media_format:uint8 = ATHInternalTransferRegistryProfileAvatar`
Signature: `ATHInternalTransferRegistryProfileAvatar{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address,notify_value:uint128,owner_wallet:address,avatar_hash:uint256,avatar_entry_id:uint64,avatar_stream_id:uint128,avatar_part_count:uint16,media_format:uint8}`

### ATHInternalTransferRegistryMintUsername
TL-B: `ath_internal_transfer_registry_mint_username#4154481d query_id:uint64 amount:uint128 sender_owner:address response_destination:address notify_value:uint128 owner_wallet:address username_len:uint8 username:remainder<slice> = ATHInternalTransferRegistryMintUsername`
Signature: `ATHInternalTransferRegistryMintUsername{query_id:uint64,amount:uint128,sender_owner:address,response_destination:address,notify_value:uint128,owner_wallet:address,username_len:uint8,username:remainder<slice>}`

### ATHTransferAck
TL-B: `ath_transfer_ack#41544811 query_id:uint64 amount:uint128 = ATHTransferAck`
Signature: `ATHTransferAck{query_id:uint64,amount:uint128}`

### ATHTransferFailed
TL-B: `ath_transfer_failed#41544813 query_id:uint64 amount:uint128 = ATHTransferFailed`
Signature: `ATHTransferFailed{query_id:uint64,amount:uint128}`

### JettonTransfer
TL-B: `jetton_transfer#0f8a7ea5 query_id:uint64 amount:coins destination:address response_destination:address custom_payload:Maybe ^cell forward_ton_amount:coins forward_payload:remainder<slice> = JettonTransfer`
Signature: `JettonTransfer{query_id:uint64,amount:coins,destination:address,response_destination:address,custom_payload:Maybe ^cell,forward_ton_amount:coins,forward_payload:remainder<slice>}`

### JettonInternalTransfer
TL-B: `jetton_internal_transfer#178d4519 query_id:uint64 amount:coins from:address response_address:address forward_ton_amount:coins forward_payload:remainder<slice> = JettonInternalTransfer`
Signature: `JettonInternalTransfer{query_id:uint64,amount:coins,from:address,response_address:address,forward_ton_amount:coins,forward_payload:remainder<slice>}`

### JettonTransferNotification
TL-B: `jetton_transfer_notification#7362d09c query_id:uint64 amount:coins sender:address forward_payload:remainder<slice> = JettonTransferNotification`
Signature: `JettonTransferNotification{query_id:uint64,amount:coins,sender:address,forward_payload:remainder<slice>}`

### JettonExcesses
TL-B: `jetton_excesses#d53276db query_id:uint64 = JettonExcesses`
Signature: `JettonExcesses{query_id:uint64}`

### ATHWalletTopUpStorageReserve
TL-B: `ath_wallet_top_up_storage_reserve#41544807  = ATHWalletTopUpStorageReserve`
Signature: `ATHWalletTopUpStorageReserve{}`

### ATHRecoverStuckOutgoing
TL-B: `ath_recover_stuck_outgoing#41544808 query_id:uint64 recipient_wallet:address = ATHRecoverStuckOutgoing`
Signature: `ATHRecoverStuckOutgoing{query_id:uint64,recipient_wallet:address}`

### ATHWalletDataView
TL-B: `_ balance:int257 owner_address:address ath_master_address:address jetton_wallet_code:^cell = ATHWalletDataView`
Signature: `ATHWalletDataView{balance:int257,owner_address:address,ath_master_address:address,jetton_wallet_code:^cell}`

### PendingAthTransferNotificationView
TL-B: `_ exists:bool sender_owner:address response_destination:address amount:int257 created_at:int257 = PendingAthTransferNotificationView`
Signature: `PendingAthTransferNotificationView{exists:bool,sender_owner:address,response_destination:address,amount:int257,created_at:int257}`

### PendingAthTransferNotification
TL-B: `_ sender_owner:address response_destination:address response_ack_value:uint64 amount:uint128 created_at:uint64 = PendingAthTransferNotification`
Signature: `PendingAthTransferNotification{sender_owner:address,response_destination:address,response_ack_value:uint64,amount:uint128,created_at:uint64}`

### PendingAthOutgoingTransfer
TL-B: `_ recipient_wallet:address response_destination:address amount:uint128 created_at:uint64 = PendingAthOutgoingTransfer`
Signature: `PendingAthOutgoingTransfer{recipient_wallet:address,response_destination:address,amount:uint128,created_at:uint64}`

### ATHWallet$Data
TL-B: `_ balance:uint128 owner_address:address ath_master_address:address pending_notifications:dict<int, ^PendingAthTransferNotification{sender_owner:address,response_destination:address,response_ack_value:uint64,amount:uint128,created_at:uint64}> pending_outgoing_transfers:dict<int, ^PendingAthOutgoingTransfer{recipient_wallet:address,response_destination:address,amount:uint128,created_at:uint64}> = ATHWallet`
Signature: `ATHWallet{balance:uint128,owner_address:address,ath_master_address:address,pending_notifications:dict<int, ^PendingAthTransferNotification{sender_owner:address,response_destination:address,response_ack_value:uint64,amount:uint128,created_at:uint64}>,pending_outgoing_transfers:dict<int, ^PendingAthOutgoingTransfer{recipient_wallet:address,response_destination:address,amount:uint128,created_at:uint64}>}`

### BindOfficialAthWallet
TL-B: `bind_official_ath_wallet#663df03d deployment_manifest_hash:uint256 official_ath_wallet_address:address = BindOfficialAthWallet`
Signature: `BindOfficialAthWallet{deployment_manifest_hash:uint256,official_ath_wallet_address:address}`

### SealGenesis
TL-B: `seal_genesis#3a12d1ad deployment_manifest_hash:uint256 = SealGenesis`
Signature: `SealGenesis{deployment_manifest_hash:uint256}`

### FlushTreasuryAthDue
TL-B: `flush_treasury_ath_due#60a9bddb query_id:uint64 = FlushTreasuryAthDue`
Signature: `FlushTreasuryAthDue{query_id:uint64}`

### FlushBurnAthDue
TL-B: `flush_burn_ath_due#e9a2c2cb query_id:uint64 = FlushBurnAthDue`
Signature: `FlushBurnAthDue{query_id:uint64}`

### PrunePendingUsernameMint
TL-B: `prune_pending_username_mint#3796df2d name_hash:uint256 = PrunePendingUsernameMint`
Signature: `PrunePendingUsernameMint{name_hash:uint256}`

### UsernameRegistryTopUpStorageReserve
TL-B: `username_registry_top_up_storage_reserve#0aba5f1d  = UsernameRegistryTopUpStorageReserve`
Signature: `UsernameRegistryTopUpStorageReserve{}`

### PendingUsernameMint
TL-B: `_ query_id:uint64 sender_key:uint160 owner_wallet:address name_hash:uint256 price_paid:uint128 item_address:address item_deploy_value:uint128 created_at:uint64 mint_nonce:uint64 = PendingUsernameMint`
Signature: `PendingUsernameMint{query_id:uint64,sender_key:uint160,owner_wallet:address,name_hash:uint256,price_paid:uint128,item_address:address,item_deploy_value:uint128,created_at:uint64,mint_nonce:uint64}`

### UsernameRegistryGlobalView
TL-B: `_ sealed:bool official_ath_wallet_bound:bool deployment_manifest_hash:int257 genesis_config_hash:int257 official_ath_wallet_address:address genesis_controller_address:address pending_mint_count:int257 treasury_due_ath:int257 burn_due_ath:int257 pending_treasury_flush_count:int257 pending_burn_flush_count:int257 pending_mint_stale_ttl:int257 = UsernameRegistryGlobalView`
Signature: `UsernameRegistryGlobalView{sealed:bool,official_ath_wallet_bound:bool,deployment_manifest_hash:int257,genesis_config_hash:int257,official_ath_wallet_address:address,genesis_controller_address:address,pending_mint_count:int257,treasury_due_ath:int257,burn_due_ath:int257,pending_treasury_flush_count:int257,pending_burn_flush_count:int257,pending_mint_stale_ttl:int257}`

### UsernamePriceView
TL-B: `_ valid_length:bool price_ath_atomic:int257 = UsernamePriceView`
Signature: `UsernamePriceView{valid_length:bool,price_ath_atomic:int257}`

### PendingUsernameMintView
TL-B: `_ exists:bool query_id:int257 sender_key:int257 owner_wallet:address name_hash:int257 price_paid:int257 item_address:address item_deploy_value:int257 created_at:int257 = PendingUsernameMintView`
Signature: `PendingUsernameMintView{exists:bool,query_id:int257,sender_key:int257,owner_wallet:address,name_hash:int257,price_paid:int257,item_address:address,item_deploy_value:int257,created_at:int257}`

### PendingAthTreasuryFlush
TL-B: `_ amount:uint128 recipient_ath_wallet:address created_at:uint64 = PendingAthTreasuryFlush`
Signature: `PendingAthTreasuryFlush{amount:uint128,recipient_ath_wallet:address,created_at:uint64}`

### PendingAthBurnFlush
TL-B: `_ amount:uint128 created_at:uint64 = PendingAthBurnFlush`
Signature: `PendingAthBurnFlush{amount:uint128,created_at:uint64}`

### PendingAthTreasuryFlushView
TL-B: `_ exists:bool amount:int257 recipient_ath_wallet:address created_at:int257 = PendingAthTreasuryFlushView`
Signature: `PendingAthTreasuryFlushView{exists:bool,amount:int257,recipient_ath_wallet:address,created_at:int257}`

### PendingAthBurnFlushView
TL-B: `_ exists:bool amount:int257 created_at:int257 = PendingAthBurnFlushView`
Signature: `PendingAthBurnFlushView{exists:bool,amount:int257,created_at:int257}`

### UsernameCollectionDataView
TL-B: `_ next_item_index:int257 collection_content:^cell owner_address:address = UsernameCollectionDataView`
Signature: `UsernameCollectionDataView{next_item_index:int257,collection_content:^cell,owner_address:address}`

### RoyaltyParamsView
TL-B: `_ numerator:int257 denominator:int257 destination:address = RoyaltyParamsView`
Signature: `RoyaltyParamsView{numerator:int257,denominator:int257,destination:address}`

### UsernameCollectionOnchainContent
TL-B: `_ marker:uint8 metadata:dict<uint256, ^cell> = UsernameCollectionOnchainContent`
Signature: `UsernameCollectionOnchainContent{marker:uint8,metadata:dict<uint256, ^cell>}`

### UploadArt
TL-B: `upload_art#589f1b98 key:uint16 data:^cell = UploadArt`
Signature: `UploadArt{key:uint16,data:^cell}`

### SealArt
TL-B: `seal_art#d1689e5a  = SealArt`
Signature: `SealArt{}`

### UploadCollectionMeta
TL-B: `upload_collection_meta#bbd93625 key:uint16 data:^cell = UploadCollectionMeta`
Signature: `UploadCollectionMeta{key:uint16,data:^cell}`

### SealCollectionMeta
TL-B: `seal_collection_meta#73631e46  = SealCollectionMeta`
Signature: `SealCollectionMeta{}`

### UsernameRegistry$Data
TL-B: `_ official_ath_wallet_address:address ath_master_address:address treasury_ath_receiver_address:address official_ath_wallet_bound:bool sealed:bool deployment_manifest_hash:uint256 genesis_config_hash:uint256 pending_mint_count:uint64 mint_seq:uint64 treasury_due_ath:uint128 burn_due_ath:uint128 pending_mints:dict<int, ^PendingUsernameMint{query_id:uint64,sender_key:uint160,owner_wallet:address,name_hash:uint256,price_paid:uint128,item_address:address,item_deploy_value:uint128,created_at:uint64,mint_nonce:uint64}> pending_item_to_name_hash:dict<address, int> pending_treasury_flushes:dict<int, ^PendingAthTreasuryFlush{amount:uint128,recipient_ath_wallet:address,created_at:uint64}> pending_treasury_flush_count:uint64 pending_burn_flushes:dict<int, ^PendingAthBurnFlush{amount:uint128,created_at:uint64}> pending_burn_flush_count:uint64 genesis_controller_address:address art:dict<uint16, ^cell> art_count:uint16 art_sealed:bool meta:dict<uint16, ^cell> meta_count:uint16 meta_sealed:bool = UsernameRegistry`
Signature: `UsernameRegistry{official_ath_wallet_address:address,ath_master_address:address,treasury_ath_receiver_address:address,official_ath_wallet_bound:bool,sealed:bool,deployment_manifest_hash:uint256,genesis_config_hash:uint256,pending_mint_count:uint64,mint_seq:uint64,treasury_due_ath:uint128,burn_due_ath:uint128,pending_mints:dict<int, ^PendingUsernameMint{query_id:uint64,sender_key:uint160,owner_wallet:address,name_hash:uint256,price_paid:uint128,item_address:address,item_deploy_value:uint128,created_at:uint64,mint_nonce:uint64}>,pending_item_to_name_hash:dict<address, int>,pending_treasury_flushes:dict<int, ^PendingAthTreasuryFlush{amount:uint128,recipient_ath_wallet:address,created_at:uint64}>,pending_treasury_flush_count:uint64,pending_burn_flushes:dict<int, ^PendingAthBurnFlush{amount:uint128,created_at:uint64}>,pending_burn_flush_count:uint64,genesis_controller_address:address,art:dict<uint16, ^cell>,art_count:uint16,art_sealed:bool,meta:dict<uint16, ^cell>,meta_count:uint16,meta_sealed:bool}`

## Get methods
Total get methods: 2

## get_state
No arguments

## get_nft_data
No arguments

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
UsernameNFTItem
UsernameNFTItem --> BaseTrait
```

## Contract dependency diagram

```mermaid
graph TD
UsernameNFTItem
```