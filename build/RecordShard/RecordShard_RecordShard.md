# Tact compilation report
Contract: RecordShard
BoC Size: 915 bytes

## Structures (Structs and Messages)
Total structures: 16

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

### CapsulePublish
TL-B: `capsule_publish#52535031 seq:uint64 header_0:^cell header_1:^cell body:^cell sig:^cell = CapsulePublish`
Signature: `CapsulePublish{seq:uint64,header_0:^cell,header_1:^cell,body:^cell,sig:^cell}`

### EvictRecords
TL-B: `evict_records#52535032 max_count:uint16 = EvictRecords`
Signature: `EvictRecords{max_count:uint16}`

### RecordEntry
TL-B: `_ frame_commit:int257 created_at:int257 = RecordEntry`
Signature: `RecordEntry{frame_commit:int257,created_at:int257}`

### CapsuleRecordView
TL-B: `_ exists:bool frame_commit:int257 created_at:int257 = CapsuleRecordView`
Signature: `CapsuleRecordView{exists:bool,frame_commit:int257,created_at:int257}`

### RecordShardView
TL-B: `_ write_pubkey:int257 epoch:int257 last_seq:int257 record_count:int257 live_count:int257 evict_cursor:int257 safe_cap:int257 retention:int257 min_value:int257 protocol_fee:int257 accrued_fee:int257 = RecordShardView`
Signature: `RecordShardView{write_pubkey:int257,epoch:int257,last_seq:int257,record_count:int257,live_count:int257,evict_cursor:int257,safe_cap:int257,retention:int257,min_value:int257,protocol_fee:int257,accrued_fee:int257}`

### RecordShard$Data
TL-B: `_ write_pubkey:uint256 epoch:uint32 last_seq:uint64 records:dict<int, ^RecordEntry{frame_commit:int257,created_at:int257}> record_count:uint32 live_count:uint32 evict_cursor:uint32 accrued_fee:coins = RecordShard`
Signature: `RecordShard{write_pubkey:uint256,epoch:uint32,last_seq:uint64,records:dict<int, ^RecordEntry{frame_commit:int257,created_at:int257}>,record_count:uint32,live_count:uint32,evict_cursor:uint32,accrued_fee:coins}`

## Get methods
Total get methods: 2

## get_record
Argument: entry_id

## get_view
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
RecordShard
RecordShard --> BaseTrait
```

## Contract dependency diagram

```mermaid
graph TD
RecordShard
```