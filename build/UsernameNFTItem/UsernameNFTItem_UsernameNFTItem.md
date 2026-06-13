# Tact compilation report
Contract: UsernameNFTItem
BoC Size: 1352 bytes

## Structures (Structs and Messages)
Total structures: 21

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
TL-B: `initialize_username_item#554e494e owner_wallet:address username_len:uint8 username:remainder<slice> = InitializeUsernameItem`
Signature: `InitializeUsernameItem{owner_wallet:address,username_len:uint8,username:remainder<slice>}`

### ResendDeployedAck
TL-B: `resend_deployed_ack#639cfc6c  = ResendDeployedAck`
Signature: `ResendDeployedAck{}`

### TopUpStorageReserve
TL-B: `top_up_storage_reserve#27acdf8b  = TopUpStorageReserve`
Signature: `TopUpStorageReserve{}`

### UsernameItemDeployedAck
TL-B: `username_item_deployed_ack#bba3ec19 name_hash:uint256 owner_wallet:address = UsernameItemDeployedAck`
Signature: `UsernameItemDeployedAck{name_hash:uint256,owner_wallet:address}`

### NftTransfer
TL-B: `nft_transfer#5fcc3d14 query_id:uint64 new_owner:address response_destination:address custom_payload:Maybe ^cell forward_amount:coins forward_payload:remainder<slice> = NftTransfer`
Signature: `NftTransfer{query_id:uint64,new_owner:address,response_destination:address,custom_payload:Maybe ^cell,forward_amount:coins,forward_payload:remainder<slice>}`

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
TL-B: `_ initialized:bool owner_wallet:address username_registry_address:address name_hash:uint256 username_len:uint8 username:^cell = UsernameNFTItem`
Signature: `UsernameNFTItem{initialized:bool,owner_wallet:address,username_registry_address:address,name_hash:uint256,username_len:uint8,username:^cell}`

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