import {
    Cell,
    Slice,
    Address,
    Builder,
    beginCell,
    ComputeError,
    TupleItem,
    TupleReader,
    Dictionary,
    contractAddress,
    address,
    ContractProvider,
    Sender,
    Contract,
    ContractABI,
    ABIType,
    ABIGetter,
    ABIReceiver,
    TupleBuilder,
    DictionaryValue
} from '@ton/core';

export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
}

export function storeDataSize(src: DataSize) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}

export function loadDataSize(slice: Slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadGetterTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function storeTupleDataSize(source: DataSize) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}

export function dictValueParserDataSize(): DictionaryValue<DataSize> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    }
}

export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
}

export function storeSignedBundle(src: SignedBundle) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}

export function loadSignedBundle(slice: Slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadGetterTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function storeTupleSignedBundle(source: SignedBundle) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}

export function dictValueParserSignedBundle(): DictionaryValue<SignedBundle> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    }
}

export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
}

export function storeStateInit(src: StateInit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}

export function loadStateInit(slice: Slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadGetterTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function storeTupleStateInit(source: StateInit) {
    const builder = new TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserStateInit(): DictionaryValue<StateInit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    }
}

export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
}

export function storeContext(src: Context) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}

export function loadContext(slice: Slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadGetterTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function storeTupleContext(source: Context) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}

export function dictValueParserContext(): DictionaryValue<Context> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    }
}

export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeSendParameters(src: SendParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        if (src.code !== null && src.code !== undefined) { b_0.storeBit(true).storeRef(src.code); } else { b_0.storeBit(false); }
        if (src.data !== null && src.data !== undefined) { b_0.storeBit(true).storeRef(src.data); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadSendParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleSendParameters(source: SendParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    }
}

export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeMessageParameters(src: MessageParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadMessageParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleMessageParameters(source: MessageParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserMessageParameters(): DictionaryValue<MessageParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    }
}

export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
}

export function storeDeployParameters(src: DeployParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}

export function loadDeployParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadGetterTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function storeTupleDeployParameters(source: DeployParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}

export function dictValueParserDeployParameters(): DictionaryValue<DeployParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    }
}

export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
}

export function storeStdAddress(src: StdAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}

export function loadStdAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleStdAddress(source: StdAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}

export function dictValueParserStdAddress(): DictionaryValue<StdAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    }
}

export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
}

export function storeVarAddress(src: VarAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}

export function loadVarAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleVarAddress(source: VarAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}

export function dictValueParserVarAddress(): DictionaryValue<VarAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    }
}

export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
}

export function storeBasechainAddress(src: BasechainAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) { b_0.storeBit(true).storeInt(src.hash, 257); } else { b_0.storeBit(false); }
    };
}

export function loadBasechainAddress(slice: Slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadGetterTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function storeTupleBasechainAddress(source: BasechainAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}

export function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    }
}

export type RecordStore = {
    $$type: 'RecordStore';
    serial: bigint;
    frame_commit: bigint;
}

export function storeRecordStore(src: RecordStore) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191729, 32);
        b_0.storeUint(src.serial, 256);
        b_0.storeUint(src.frame_commit, 256);
    };
}

export function loadRecordStore(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191729) { throw Error('Invalid prefix'); }
    const _serial = sc_0.loadUintBig(256);
    const _frame_commit = sc_0.loadUintBig(256);
    return { $$type: 'RecordStore' as const, serial: _serial, frame_commit: _frame_commit };
}

export function loadTupleRecordStore(source: TupleReader) {
    const _serial = source.readBigNumber();
    const _frame_commit = source.readBigNumber();
    return { $$type: 'RecordStore' as const, serial: _serial, frame_commit: _frame_commit };
}

export function loadGetterTupleRecordStore(source: TupleReader) {
    const _serial = source.readBigNumber();
    const _frame_commit = source.readBigNumber();
    return { $$type: 'RecordStore' as const, serial: _serial, frame_commit: _frame_commit };
}

export function storeTupleRecordStore(source: RecordStore) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.serial);
    builder.writeNumber(source.frame_commit);
    return builder.build();
}

export function dictValueParserRecordStore(): DictionaryValue<RecordStore> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecordStore(src)).endCell());
        },
        parse: (src) => {
            return loadRecordStore(src.loadRef().beginParse());
        }
    }
}

export type CapsuleRecordView = {
    $$type: 'CapsuleRecordView';
    exists: boolean;
    frame_commit: bigint;
}

export function storeCapsuleRecordView(src: CapsuleRecordView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.frame_commit, 257);
    };
}

export function loadCapsuleRecordView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _frame_commit = sc_0.loadIntBig(257);
    return { $$type: 'CapsuleRecordView' as const, exists: _exists, frame_commit: _frame_commit };
}

export function loadTupleCapsuleRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _frame_commit = source.readBigNumber();
    return { $$type: 'CapsuleRecordView' as const, exists: _exists, frame_commit: _frame_commit };
}

export function loadGetterTupleCapsuleRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _frame_commit = source.readBigNumber();
    return { $$type: 'CapsuleRecordView' as const, exists: _exists, frame_commit: _frame_commit };
}

export function storeTupleCapsuleRecordView(source: CapsuleRecordView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.frame_commit);
    return builder.build();
}

export function dictValueParserCapsuleRecordView(): DictionaryValue<CapsuleRecordView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsuleRecordView(src)).endCell());
        },
        parse: (src) => {
            return loadCapsuleRecordView(src.loadRef().beginParse());
        }
    }
}

export type RecordShardView = {
    $$type: 'RecordShardView';
    bucket_key: bigint;
    epoch: bigint;
    record_count: bigint;
    lane_count: bigint;
    safe_cap: bigint;
}

export function storeRecordShardView(src: RecordShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.bucket_key, 257);
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.record_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.lane_count, 257);
        b_1.storeInt(src.safe_cap, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecordShardView(slice: Slice) {
    const sc_0 = slice;
    const _bucket_key = sc_0.loadIntBig(257);
    const _epoch = sc_0.loadIntBig(257);
    const _record_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _lane_count = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    return { $$type: 'RecordShardView' as const, bucket_key: _bucket_key, epoch: _epoch, record_count: _record_count, lane_count: _lane_count, safe_cap: _safe_cap };
}

export function loadTupleRecordShardView(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _record_count = source.readBigNumber();
    const _lane_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    return { $$type: 'RecordShardView' as const, bucket_key: _bucket_key, epoch: _epoch, record_count: _record_count, lane_count: _lane_count, safe_cap: _safe_cap };
}

export function loadGetterTupleRecordShardView(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _record_count = source.readBigNumber();
    const _lane_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    return { $$type: 'RecordShardView' as const, bucket_key: _bucket_key, epoch: _epoch, record_count: _record_count, lane_count: _lane_count, safe_cap: _safe_cap };
}

export function storeTupleRecordShardView(source: RecordShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bucket_key);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.record_count);
    builder.writeNumber(source.lane_count);
    builder.writeNumber(source.safe_cap);
    return builder.build();
}

export function dictValueParserRecordShardView(): DictionaryValue<RecordShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecordShardView(src)).endCell());
        },
        parse: (src) => {
            return loadRecordShardView(src.loadRef().beginParse());
        }
    }
}

export type RecordShard$Data = {
    $$type: 'RecordShard$Data';
    bucket_key: bigint;
    epoch: bigint;
    records: Dictionary<bigint, bigint>;
    record_count: bigint;
}

export function storeRecordShard$Data(src: RecordShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.bucket_key, 256);
        b_0.storeUint(src.epoch, 32);
        b_0.storeDict(src.records, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_0.storeUint(src.record_count, 32);
    };
}

export function loadRecordShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _bucket_key = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    const _records = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    const _record_count = sc_0.loadUintBig(32);
    return { $$type: 'RecordShard$Data' as const, bucket_key: _bucket_key, epoch: _epoch, records: _records, record_count: _record_count };
}

export function loadTupleRecordShard$Data(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _record_count = source.readBigNumber();
    return { $$type: 'RecordShard$Data' as const, bucket_key: _bucket_key, epoch: _epoch, records: _records, record_count: _record_count };
}

export function loadGetterTupleRecordShard$Data(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _record_count = source.readBigNumber();
    return { $$type: 'RecordShard$Data' as const, bucket_key: _bucket_key, epoch: _epoch, records: _records, record_count: _record_count };
}

export function storeTupleRecordShard$Data(source: RecordShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bucket_key);
    builder.writeNumber(source.epoch);
    builder.writeCell(source.records.size > 0 ? beginCell().storeDictDirect(source.records, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeNumber(source.record_count);
    return builder.build();
}

export function dictValueParserRecordShard$Data(): DictionaryValue<RecordShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecordShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadRecordShard$Data(src.loadRef().beginParse());
        }
    }
}

export type IntroStore = {
    $$type: 'IntroStore';
    serial: bigint;
    r: bigint;
    view_tag: bigint;
    body_commit: bigint;
}

export function storeIntroStore(src: IntroStore) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1230196786, 32);
        b_0.storeUint(src.serial, 256);
        b_0.storeUint(src.r, 256);
        b_0.storeUint(src.view_tag, 16);
        b_0.storeUint(src.body_commit, 256);
    };
}

export function loadIntroStore(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1230196786) { throw Error('Invalid prefix'); }
    const _serial = sc_0.loadUintBig(256);
    const _r = sc_0.loadUintBig(256);
    const _view_tag = sc_0.loadUintBig(16);
    const _body_commit = sc_0.loadUintBig(256);
    return { $$type: 'IntroStore' as const, serial: _serial, r: _r, view_tag: _view_tag, body_commit: _body_commit };
}

export function loadTupleIntroStore(source: TupleReader) {
    const _serial = source.readBigNumber();
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _body_commit = source.readBigNumber();
    return { $$type: 'IntroStore' as const, serial: _serial, r: _r, view_tag: _view_tag, body_commit: _body_commit };
}

export function loadGetterTupleIntroStore(source: TupleReader) {
    const _serial = source.readBigNumber();
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _body_commit = source.readBigNumber();
    return { $$type: 'IntroStore' as const, serial: _serial, r: _r, view_tag: _view_tag, body_commit: _body_commit };
}

export function storeTupleIntroStore(source: IntroStore) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.serial);
    builder.writeNumber(source.r);
    builder.writeNumber(source.view_tag);
    builder.writeNumber(source.body_commit);
    return builder.build();
}

export function dictValueParserIntroStore(): DictionaryValue<IntroStore> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroStore(src)).endCell());
        },
        parse: (src) => {
            return loadIntroStore(src.loadRef().beginParse());
        }
    }
}

export type EvictIntros = {
    $$type: 'EvictIntros';
    max_count: bigint;
}

export function storeEvictIntros(src: EvictIntros) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1230196787, 32);
        b_0.storeUint(src.max_count, 16);
    };
}

export function loadEvictIntros(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1230196787) { throw Error('Invalid prefix'); }
    const _max_count = sc_0.loadUintBig(16);
    return { $$type: 'EvictIntros' as const, max_count: _max_count };
}

export function loadTupleEvictIntros(source: TupleReader) {
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictIntros' as const, max_count: _max_count };
}

export function loadGetterTupleEvictIntros(source: TupleReader) {
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictIntros' as const, max_count: _max_count };
}

export function storeTupleEvictIntros(source: EvictIntros) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.max_count);
    return builder.build();
}

export function dictValueParserEvictIntros(): DictionaryValue<EvictIntros> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictIntros(src)).endCell());
        },
        parse: (src) => {
            return loadEvictIntros(src.loadRef().beginParse());
        }
    }
}

export type IntroEntry = {
    $$type: 'IntroEntry';
    r: bigint;
    view_tag: bigint;
    body_commit: bigint;
    created_at: bigint;
}

export function storeIntroEntry(src: IntroEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.r, 257);
        b_0.storeInt(src.view_tag, 257);
        b_0.storeInt(src.body_commit, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadIntroEntry(slice: Slice) {
    const sc_0 = slice;
    const _r = sc_0.loadIntBig(257);
    const _view_tag = sc_0.loadIntBig(257);
    const _body_commit = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'IntroEntry' as const, r: _r, view_tag: _view_tag, body_commit: _body_commit, created_at: _created_at };
}

export function loadTupleIntroEntry(source: TupleReader) {
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'IntroEntry' as const, r: _r, view_tag: _view_tag, body_commit: _body_commit, created_at: _created_at };
}

export function loadGetterTupleIntroEntry(source: TupleReader) {
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'IntroEntry' as const, r: _r, view_tag: _view_tag, body_commit: _body_commit, created_at: _created_at };
}

export function storeTupleIntroEntry(source: IntroEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.r);
    builder.writeNumber(source.view_tag);
    builder.writeNumber(source.body_commit);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserIntroEntry(): DictionaryValue<IntroEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroEntry(src)).endCell());
        },
        parse: (src) => {
            return loadIntroEntry(src.loadRef().beginParse());
        }
    }
}

export type IntroEntryView = {
    $$type: 'IntroEntryView';
    exists: boolean;
    r: bigint;
    view_tag: bigint;
    body_commit: bigint;
    created_at: bigint;
}

export function storeIntroEntryView(src: IntroEntryView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.r, 257);
        b_0.storeInt(src.view_tag, 257);
        b_0.storeInt(src.body_commit, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadIntroEntryView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _r = sc_0.loadIntBig(257);
    const _view_tag = sc_0.loadIntBig(257);
    const _body_commit = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'IntroEntryView' as const, exists: _exists, r: _r, view_tag: _view_tag, body_commit: _body_commit, created_at: _created_at };
}

export function loadTupleIntroEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'IntroEntryView' as const, exists: _exists, r: _r, view_tag: _view_tag, body_commit: _body_commit, created_at: _created_at };
}

export function loadGetterTupleIntroEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'IntroEntryView' as const, exists: _exists, r: _r, view_tag: _view_tag, body_commit: _body_commit, created_at: _created_at };
}

export function storeTupleIntroEntryView(source: IntroEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.r);
    builder.writeNumber(source.view_tag);
    builder.writeNumber(source.body_commit);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserIntroEntryView(): DictionaryValue<IntroEntryView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroEntryView(src)).endCell());
        },
        parse: (src) => {
            return loadIntroEntryView(src.loadRef().beginParse());
        }
    }
}

export type IntroShardView = {
    $$type: 'IntroShardView';
    epoch: bigint;
    bucket: bigint;
    live_count: bigint;
    next_id: bigint;
    evict_cursor: bigint;
    retention: bigint;
    safe_cap: bigint;
}

export function storeIntroShardView(src: IntroShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.bucket, 257);
        b_0.storeInt(src.live_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.next_id, 257);
        b_1.storeInt(src.evict_cursor, 257);
        b_1.storeInt(src.retention, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.safe_cap, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadIntroShardView(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadIntBig(257);
    const _bucket = sc_0.loadIntBig(257);
    const _live_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _next_id = sc_1.loadIntBig(257);
    const _evict_cursor = sc_1.loadIntBig(257);
    const _retention = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _safe_cap = sc_2.loadIntBig(257);
    return { $$type: 'IntroShardView' as const, epoch: _epoch, bucket: _bucket, live_count: _live_count, next_id: _next_id, evict_cursor: _evict_cursor, retention: _retention, safe_cap: _safe_cap };
}

export function loadTupleIntroShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _next_id = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    return { $$type: 'IntroShardView' as const, epoch: _epoch, bucket: _bucket, live_count: _live_count, next_id: _next_id, evict_cursor: _evict_cursor, retention: _retention, safe_cap: _safe_cap };
}

export function loadGetterTupleIntroShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _next_id = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    return { $$type: 'IntroShardView' as const, epoch: _epoch, bucket: _bucket, live_count: _live_count, next_id: _next_id, evict_cursor: _evict_cursor, retention: _retention, safe_cap: _safe_cap };
}

export function storeTupleIntroShardView(source: IntroShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.bucket);
    builder.writeNumber(source.live_count);
    builder.writeNumber(source.next_id);
    builder.writeNumber(source.evict_cursor);
    builder.writeNumber(source.retention);
    builder.writeNumber(source.safe_cap);
    return builder.build();
}

export function dictValueParserIntroShardView(): DictionaryValue<IntroShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroShardView(src)).endCell());
        },
        parse: (src) => {
            return loadIntroShardView(src.loadRef().beginParse());
        }
    }
}

export type IntroShard$Data = {
    $$type: 'IntroShard$Data';
    epoch: bigint;
    bucket: bigint;
    intros: Dictionary<bigint, IntroEntry>;
    next_id: bigint;
    live_count: bigint;
    evict_cursor: bigint;
}

export function storeIntroShard$Data(src: IntroShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.bucket, 32);
        b_0.storeDict(src.intros, Dictionary.Keys.BigInt(257), dictValueParserIntroEntry());
        b_0.storeUint(src.next_id, 32);
        b_0.storeUint(src.live_count, 32);
        b_0.storeUint(src.evict_cursor, 32);
    };
}

export function loadIntroShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadUintBig(32);
    const _bucket = sc_0.loadUintBig(32);
    const _intros = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserIntroEntry(), sc_0);
    const _next_id = sc_0.loadUintBig(32);
    const _live_count = sc_0.loadUintBig(32);
    const _evict_cursor = sc_0.loadUintBig(32);
    return { $$type: 'IntroShard$Data' as const, epoch: _epoch, bucket: _bucket, intros: _intros, next_id: _next_id, live_count: _live_count, evict_cursor: _evict_cursor };
}

export function loadTupleIntroShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _intros = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIntroEntry(), source.readCellOpt());
    const _next_id = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    return { $$type: 'IntroShard$Data' as const, epoch: _epoch, bucket: _bucket, intros: _intros, next_id: _next_id, live_count: _live_count, evict_cursor: _evict_cursor };
}

export function loadGetterTupleIntroShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _intros = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIntroEntry(), source.readCellOpt());
    const _next_id = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    return { $$type: 'IntroShard$Data' as const, epoch: _epoch, bucket: _bucket, intros: _intros, next_id: _next_id, live_count: _live_count, evict_cursor: _evict_cursor };
}

export function storeTupleIntroShard$Data(source: IntroShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.bucket);
    builder.writeCell(source.intros.size > 0 ? beginCell().storeDictDirect(source.intros, Dictionary.Keys.BigInt(257), dictValueParserIntroEntry()).endCell() : null);
    builder.writeNumber(source.next_id);
    builder.writeNumber(source.live_count);
    builder.writeNumber(source.evict_cursor);
    return builder.build();
}

export function dictValueParserIntroShard$Data(): DictionaryValue<IntroShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadIntroShard$Data(src.loadRef().beginParse());
        }
    }
}

export type NullifierSpend = {
    $$type: 'NullifierSpend';
    spend_pubkey: bigint;
    epoch: bigint;
    nonce: bigint;
    subkey_pubkey: bigint;
    valid_from: bigint;
    valid_to: bigint;
    root_idx_a: bigint;
    root_idx_b: bigint;
    kind: bigint;
    bucket_key: bigint;
    frame_commit: bigint;
    intro_bucket: bigint;
    intro_r: bigint;
    intro_view_tag: bigint;
    issuer_sig: Cell;
    cert_sig_a: Cell;
    cert_sig_b: Cell;
}

export function storeNullifierSpend(src: NullifierSpend) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1314082866, 32);
        b_0.storeUint(src.spend_pubkey, 256);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.subkey_pubkey, 256);
        b_0.storeUint(src.valid_from, 32);
        b_0.storeUint(src.valid_to, 32);
        b_0.storeUint(src.root_idx_a, 8);
        b_0.storeUint(src.root_idx_b, 8);
        b_0.storeUint(src.kind, 8);
        b_0.storeUint(src.bucket_key, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.frame_commit, 256);
        b_1.storeUint(src.intro_bucket, 32);
        b_1.storeUint(src.intro_r, 256);
        b_1.storeUint(src.intro_view_tag, 16);
        b_1.storeRef(src.issuer_sig);
        b_1.storeRef(src.cert_sig_a);
        b_1.storeRef(src.cert_sig_b);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadNullifierSpend(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1314082866) { throw Error('Invalid prefix'); }
    const _spend_pubkey = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    const _nonce = sc_0.loadUintBig(64);
    const _subkey_pubkey = sc_0.loadUintBig(256);
    const _valid_from = sc_0.loadUintBig(32);
    const _valid_to = sc_0.loadUintBig(32);
    const _root_idx_a = sc_0.loadUintBig(8);
    const _root_idx_b = sc_0.loadUintBig(8);
    const _kind = sc_0.loadUintBig(8);
    const _bucket_key = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _frame_commit = sc_1.loadUintBig(256);
    const _intro_bucket = sc_1.loadUintBig(32);
    const _intro_r = sc_1.loadUintBig(256);
    const _intro_view_tag = sc_1.loadUintBig(16);
    const _issuer_sig = sc_1.loadRef();
    const _cert_sig_a = sc_1.loadRef();
    const _cert_sig_b = sc_1.loadRef();
    return { $$type: 'NullifierSpend' as const, spend_pubkey: _spend_pubkey, epoch: _epoch, nonce: _nonce, subkey_pubkey: _subkey_pubkey, valid_from: _valid_from, valid_to: _valid_to, root_idx_a: _root_idx_a, root_idx_b: _root_idx_b, kind: _kind, bucket_key: _bucket_key, frame_commit: _frame_commit, intro_bucket: _intro_bucket, intro_r: _intro_r, intro_view_tag: _intro_view_tag, issuer_sig: _issuer_sig, cert_sig_a: _cert_sig_a, cert_sig_b: _cert_sig_b };
}

export function loadTupleNullifierSpend(source: TupleReader) {
    const _spend_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _subkey_pubkey = source.readBigNumber();
    const _valid_from = source.readBigNumber();
    const _valid_to = source.readBigNumber();
    const _root_idx_a = source.readBigNumber();
    const _root_idx_b = source.readBigNumber();
    const _kind = source.readBigNumber();
    const _bucket_key = source.readBigNumber();
    const _frame_commit = source.readBigNumber();
    const _intro_bucket = source.readBigNumber();
    const _intro_r = source.readBigNumber();
    const _intro_view_tag = source.readBigNumber();
    source = source.readTuple();
    const _issuer_sig = source.readCell();
    const _cert_sig_a = source.readCell();
    const _cert_sig_b = source.readCell();
    return { $$type: 'NullifierSpend' as const, spend_pubkey: _spend_pubkey, epoch: _epoch, nonce: _nonce, subkey_pubkey: _subkey_pubkey, valid_from: _valid_from, valid_to: _valid_to, root_idx_a: _root_idx_a, root_idx_b: _root_idx_b, kind: _kind, bucket_key: _bucket_key, frame_commit: _frame_commit, intro_bucket: _intro_bucket, intro_r: _intro_r, intro_view_tag: _intro_view_tag, issuer_sig: _issuer_sig, cert_sig_a: _cert_sig_a, cert_sig_b: _cert_sig_b };
}

export function loadGetterTupleNullifierSpend(source: TupleReader) {
    const _spend_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _subkey_pubkey = source.readBigNumber();
    const _valid_from = source.readBigNumber();
    const _valid_to = source.readBigNumber();
    const _root_idx_a = source.readBigNumber();
    const _root_idx_b = source.readBigNumber();
    const _kind = source.readBigNumber();
    const _bucket_key = source.readBigNumber();
    const _frame_commit = source.readBigNumber();
    const _intro_bucket = source.readBigNumber();
    const _intro_r = source.readBigNumber();
    const _intro_view_tag = source.readBigNumber();
    const _issuer_sig = source.readCell();
    const _cert_sig_a = source.readCell();
    const _cert_sig_b = source.readCell();
    return { $$type: 'NullifierSpend' as const, spend_pubkey: _spend_pubkey, epoch: _epoch, nonce: _nonce, subkey_pubkey: _subkey_pubkey, valid_from: _valid_from, valid_to: _valid_to, root_idx_a: _root_idx_a, root_idx_b: _root_idx_b, kind: _kind, bucket_key: _bucket_key, frame_commit: _frame_commit, intro_bucket: _intro_bucket, intro_r: _intro_r, intro_view_tag: _intro_view_tag, issuer_sig: _issuer_sig, cert_sig_a: _cert_sig_a, cert_sig_b: _cert_sig_b };
}

export function storeTupleNullifierSpend(source: NullifierSpend) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.spend_pubkey);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.subkey_pubkey);
    builder.writeNumber(source.valid_from);
    builder.writeNumber(source.valid_to);
    builder.writeNumber(source.root_idx_a);
    builder.writeNumber(source.root_idx_b);
    builder.writeNumber(source.kind);
    builder.writeNumber(source.bucket_key);
    builder.writeNumber(source.frame_commit);
    builder.writeNumber(source.intro_bucket);
    builder.writeNumber(source.intro_r);
    builder.writeNumber(source.intro_view_tag);
    builder.writeCell(source.issuer_sig);
    builder.writeCell(source.cert_sig_a);
    builder.writeCell(source.cert_sig_b);
    return builder.build();
}

export function dictValueParserNullifierSpend(): DictionaryValue<NullifierSpend> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullifierSpend(src)).endCell());
        },
        parse: (src) => {
            return loadNullifierSpend(src.loadRef().beginParse());
        }
    }
}

export type NullifierShardView = {
    $$type: 'NullifierShardView';
    epoch: bigint;
    lane: bigint;
    spent_count: bigint;
    lane_count: bigint;
    safe_cap: bigint;
    root_threshold: bigint;
    max_cert_epochs: bigint;
}

export function storeNullifierShardView(src: NullifierShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.lane, 257);
        b_0.storeInt(src.spent_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.lane_count, 257);
        b_1.storeInt(src.safe_cap, 257);
        b_1.storeInt(src.root_threshold, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.max_cert_epochs, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadNullifierShardView(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadIntBig(257);
    const _lane = sc_0.loadIntBig(257);
    const _spent_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _lane_count = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    const _root_threshold = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _max_cert_epochs = sc_2.loadIntBig(257);
    return { $$type: 'NullifierShardView' as const, epoch: _epoch, lane: _lane, spent_count: _spent_count, lane_count: _lane_count, safe_cap: _safe_cap, root_threshold: _root_threshold, max_cert_epochs: _max_cert_epochs };
}

export function loadTupleNullifierShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent_count = source.readBigNumber();
    const _lane_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _root_threshold = source.readBigNumber();
    const _max_cert_epochs = source.readBigNumber();
    return { $$type: 'NullifierShardView' as const, epoch: _epoch, lane: _lane, spent_count: _spent_count, lane_count: _lane_count, safe_cap: _safe_cap, root_threshold: _root_threshold, max_cert_epochs: _max_cert_epochs };
}

export function loadGetterTupleNullifierShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent_count = source.readBigNumber();
    const _lane_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _root_threshold = source.readBigNumber();
    const _max_cert_epochs = source.readBigNumber();
    return { $$type: 'NullifierShardView' as const, epoch: _epoch, lane: _lane, spent_count: _spent_count, lane_count: _lane_count, safe_cap: _safe_cap, root_threshold: _root_threshold, max_cert_epochs: _max_cert_epochs };
}

export function storeTupleNullifierShardView(source: NullifierShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.lane);
    builder.writeNumber(source.spent_count);
    builder.writeNumber(source.lane_count);
    builder.writeNumber(source.safe_cap);
    builder.writeNumber(source.root_threshold);
    builder.writeNumber(source.max_cert_epochs);
    return builder.build();
}

export function dictValueParserNullifierShardView(): DictionaryValue<NullifierShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullifierShardView(src)).endCell());
        },
        parse: (src) => {
            return loadNullifierShardView(src.loadRef().beginParse());
        }
    }
}

export type NullifierShard$Data = {
    $$type: 'NullifierShard$Data';
    epoch: bigint;
    lane: bigint;
    spent: Dictionary<bigint, boolean>;
    spent_count: bigint;
}

export function storeNullifierShard$Data(src: NullifierShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.lane, 32);
        b_0.storeDict(src.spent, Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
        b_0.storeUint(src.spent_count, 32);
    };
}

export function loadNullifierShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadUintBig(32);
    const _lane = sc_0.loadUintBig(32);
    const _spent = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), sc_0);
    const _spent_count = sc_0.loadUintBig(32);
    return { $$type: 'NullifierShard$Data' as const, epoch: _epoch, lane: _lane, spent: _spent, spent_count: _spent_count };
}

export function loadTupleNullifierShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), source.readCellOpt());
    const _spent_count = source.readBigNumber();
    return { $$type: 'NullifierShard$Data' as const, epoch: _epoch, lane: _lane, spent: _spent, spent_count: _spent_count };
}

export function loadGetterTupleNullifierShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), source.readCellOpt());
    const _spent_count = source.readBigNumber();
    return { $$type: 'NullifierShard$Data' as const, epoch: _epoch, lane: _lane, spent: _spent, spent_count: _spent_count };
}

export function storeTupleNullifierShard$Data(source: NullifierShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.lane);
    builder.writeCell(source.spent.size > 0 ? beginCell().storeDictDirect(source.spent, Dictionary.Keys.BigInt(257), Dictionary.Values.Bool()).endCell() : null);
    builder.writeNumber(source.spent_count);
    return builder.build();
}

export function dictValueParserNullifierShard$Data(): DictionaryValue<NullifierShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullifierShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadNullifierShard$Data(src.loadRef().beginParse());
        }
    }
}

 type NullifierShard_init_args = {
    $$type: 'NullifierShard_init_args';
    epoch: bigint;
    lane: bigint;
}

function initNullifierShard_init_args(src: NullifierShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.lane, 257);
    };
}

async function NullifierShard_init(epoch: bigint, lane: bigint) {
    const __code = Cell.fromHex('b5ee9c72410218010005d9000114ff00f4a413f4bcf2c80b01020162021203d8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d401f863d200019cd31fd31ff404d31f55306c148e10810101d700810101d7005902d1016d70e205e3027024d74920c21f953104d31f05de2182104e535032bae30235c00004c12114b0e3025f04f2c08203041100be038020d7217021d749c21f9430d31f309131e220821052535031ba8e1b304003c8f84301cc7f01ca0055305034cb1fcb1ff400cb1fc9ed54e0821049535032ba8e1a4003c8f84301cc7f01ca0055305034cb1fcb1ff400cb1fc9ed54e05f0402fe5b03d3ffd31fd33fd3ffd31fd31fd307d307d307d3ffd430d0d3ffd31fd3ffd30fd4d4d430f82382015180a90481352021a6fc561201be9701a604561101bb923170e2f2f481353929c001917f9329c002e2f2f481353556105614baf2f4051112050411110403111303021114020111100152ffdb3c81353621a9381325ba05060028c882104253493101cb1f13cbffcb1fcb3fc9f90004dcf2f481353e53fcbe9351fbbb923f70e21ff2f48135442b810226a052b0bbf2f481353f5398b9f2f4550308db3c07db3c8135405381bdf2f4104510344130544bbadb3c8135410ed0544118f9101df2f48135420ad04508f91018f2f48135210dd0544817f9101cf2f410344aa6250707080900f081354321c103f2f4208e233082f0884b8857f4eaa1613c61504db34d4beaf346517a0e31de3cddd4d9b4201d9d0be1c0018e2282f0a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0e082f074f85cda34d1c27c4621484731e91579c3d9c6cfc0d94b281aa11e9162058aa90028c882104341433101cb1f13cbffcb1fcb1fc9f90004fedb3c8135242381010123714133f40c6fa19401d70030925b6de26ef2f481353722830bb9f2f4813538f8416f24135f03820875a530bef2f412810101017f71216e955b59f45a3098c801cf004133f442e201a482080f424021812710a8a072fb0204c001e30ff8427081008270136d6d50436d03c8cf8580ca00cf8440ce01170a0c1002f63636365165db3c705920f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d082082932e071037f05c8598210525350315003cb1fcbffcbffc944301210246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c901fb000b0e00a4f843d0f40430208200cdaf018010f40f6fa1f2e0876d8200875cf82a028010f417028200d40d018010f40f6fa1f2e087128200d40d01028010f417c801c8f400cd7001ca005a02810101cf00810101cf00c903fc395217db3c705920f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d00382082644e07150797f07c855308210495350325005cb1f13cbffcbffcb0fcbffc910341035475010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae20d0e0f00a4f843d0f40430208200d40d018010f40f6fa1f2e0876d8200875cf82a028010f417028200cdaf018010f40f6fa1f2e087128200cdaf01028010f417c801c8f400cd7001ca005a02810101cf00810101cf00c9001a58cf8680cf8480f400f400cf810010f400c901fb004013007efa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb005502c8f84301cc7f01ca0055305034cb1fcb1ff400cb1fc9ed5400344003c8f84301cc7f01ca0055305034cb1fcb1ff400cb1fc9ed5402012013150161bd4a976a2686a00fc31e90000ce698fe98ffa02698faa98360a4708408080eb80408080eb802c816880b6b8716d9e3623c14001c8313830b722651365135038102260165bf524f6a2686a00fc31e90000ce698fe98ffa02698faa98360a4708408080eb80408080eb802c816880b6b8712a81ed9e3620c16014022553181010106db3c4560714133f40c6fa19401d70030925b6de26eb344301217001ec88210424e4c3101cb1fcbffc9f90080f267f9');
    const builder = beginCell();
    const __system = Cell.fromHex('b5ee9c72410220010005b6000101c001020276020f0105b36be0030114ff00f4a413f4bcf2c80b04020162050a02dcd001d072d721d200d200fa4021103450666f04f86102f862ed44d0d401f863d200019cd3ffd31ff404d31f55306c148e10810101d700810101d7005902d1016d70e205925f05e07024d74920c21f953104d31f05de21821052535031bae30235c00004c12114b0e3025f04f2c082060902da5b03d3ffd3ff3001a938135220db3c705920f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0813552f84258c705f2f481355325830bb9f2f4810101201035544633216e955b59f45a3098c801cf004133f442e203a413070800a4f843d0f40430208200875c018010f40f6fa1f2e0876d8200cdaff82a028010f417028200d40d018010f40f6fa1f2e087128200d40d01028010f417c801c8f400cd7001ca005a02810101cf00810101cf00c90030c8f84301cc7f01ca0055305034cbffcb1ff400cb1fc9ed5400344003c8f84301cc7f01ca0055305034cbffcb1ff400cb1fc9ed540201200b0d0161bd4a976a2686a00fc31e90000ce69ffe98ffa02698faa98360a4708408080eb80408080eb802c816880b6b8716d9e3622c0c00148313830b2554453024590165be200f6a2686a00fc31e90000ce69ffe98ffa02698faa98360a4708408080eb80408080eb802c816880b6b8712a81ed9e362140e003e810101530350334133f40c6fa19401d70030925b6de2206e93307070e07f010105b10360100114ff00f4a413f4bcf2c80b11020162121b04f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d401f863d200018e10d31fd31ff404d31fd31fd31f55506c168e12810101d700810101d7005902d1016d705300e207925f07e07026d74920c21f953106d31f07de21821049535032bae30221821049535033bae30237c00006c12116b0e3025f061316191a02f65b05d3ffd3ffd30fd3ff3003a93813813571f8425293db3c705920f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d012c705f2f481357028811f40b9f2f4810101f82314c855305034810101cf00810101cf00810101cf0001c8810101cf00cdc922103401141500a4f843d0f40430208200875c018010f40f6fa1f2e0876d028200cdaf018010f40f6fa1f2e087128200cdaf01028010f4178200d40df82a028010f417c801c8f400cd7001ca005a02810101cf00810101cf00c90066206e953059f45a30944133f415e201a404a410354403c8f84301cc7f01ca0055505056cb1f13cb1ff400cb1fcb1fcb1fc9ed5402d05b05d30f30708e115301b99320c1409170e2935372b99170e28ec7238101012959f40d6fa192306ddf206e92306d8e20d0810101d700810101d700810101d700d401d0810101d700301443306c146f04e2206eb3973007a410670306e30d10371036e85b10355512171800ba6f246c318208093a80a0f823b98e468101016dc8216e925b6d8e21016f24550355305034810101cf00810101cf00810101cf0001c8810101cf00cdc9e229103601206e953059f45a30944133f415e206a507a403a496302010671036e2003ac8f84301cc7f01ca0055505056cb1f13cb1ff400cb1fcb1fcb1fc9ed54004210355512c8f84301cc7f01ca0055505056cb1f13cb1ff400cb1fcb1fcb1fc9ed540006f2c0820202711c1e016fb254bb513435007e18f48000638434c7f4c7fd0134c7f4c7f4c7d5541b05a384a0404075c020404075c01640b4405b5c14c038b6cf1b19e01d00248208093a80811f40275447302554473026590173b23dbb513435007e18f48000638434c7f4c7fd0134c7f4c7f4c7d5541b05a384a0404075c020404075c01640b4405b5c14c038954176cf1b19601f008a810101250259f40d6fa192306ddf206e92306d8e20d0810101d700810101d700810101d700d401d0810101d700301443306c146f04e2206e96307070547000e06f247f55302c2ce726');
    builder.storeRef(__system);
    builder.storeUint(0, 1);
    initNullifierShard_init_args({ $$type: 'NullifierShard_init_args', epoch, lane })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const NullifierShard_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
} as const

export const NullifierShard_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
} as const

const NullifierShard_types: ABIType[] = [
    {"name":"DataSize","header":null,"fields":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"SignedBundle","header":null,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signedData","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"StateInit","header":null,"fields":[{"name":"code","type":{"kind":"simple","type":"cell","optional":false}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"Context","header":null,"fields":[{"name":"bounceable","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"raw","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"SendParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"data","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"MessageParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"DeployParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}},{"name":"init","type":{"kind":"simple","type":"StateInit","optional":false}}]},
    {"name":"StdAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":8}},{"name":"address","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VarAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":32}},{"name":"address","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"BasechainAddress","header":null,"fields":[{"name":"hash","type":{"kind":"simple","type":"int","optional":true,"format":257}}]},
    {"name":"RecordStore","header":1381191729,"fields":[{"name":"serial","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"frame_commit","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CapsuleRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"frame_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"RecordShardView","header":null,"fields":[{"name":"bucket_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"lane_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"RecordShard$Data","header":null,"fields":[{"name":"bucket_key","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"records","type":{"kind":"dict","key":"int","value":"int"}},{"name":"record_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"IntroStore","header":1230196786,"fields":[{"name":"serial","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"r","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"view_tag","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"body_commit","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"EvictIntros","header":1230196787,"fields":[{"name":"max_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"IntroEntry","header":null,"fields":[{"name":"r","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"view_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"r","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"view_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroShardView","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bucket","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"evict_cursor","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retention","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroShard$Data","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"bucket","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"intros","type":{"kind":"dict","key":"int","value":"IntroEntry","valueFormat":"ref"}},{"name":"next_id","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"live_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"evict_cursor","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"NullifierSpend","header":1314082866,"fields":[{"name":"spend_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"subkey_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"valid_from","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"valid_to","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"root_idx_a","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"root_idx_b","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"bucket_key","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"frame_commit","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"intro_bucket","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"intro_r","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"intro_view_tag","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"issuer_sig","type":{"kind":"simple","type":"cell","optional":false}},{"name":"cert_sig_a","type":{"kind":"simple","type":"cell","optional":false}},{"name":"cert_sig_b","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"NullifierShardView","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"lane","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"spent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"lane_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"root_threshold","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_cert_epochs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"NullifierShard$Data","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"lane","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"spent","type":{"kind":"dict","key":"int","value":"bool"}},{"name":"spent_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const NullifierShard_opcodes = {
    "RecordStore": 1381191729,
    "IntroStore": 1230196786,
    "EvictIntros": 1230196787,
    "NullifierSpend": 1314082866,
}

const NullifierShard_getters: ABIGetter[] = [
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"NullifierShardView","optional":false}},
    {"name":"is_spent","methodId":125513,"arguments":[{"name":"serial","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"bool","optional":false}},
]

export const NullifierShard_getterMapping: { [key: string]: string } = {
    'get_view': 'getGetView',
    'is_spent': 'getIsSpent',
}

const NullifierShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"NullifierSpend"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const RS_LANE_COUNT = 1048576n;
export const RS_SAFE_CAP = 4096n;
export const IS_LANE_COUNT = 1048576n;
export const IS_INTRO_RETENTION = 604800n;
export const IS_SAFE_CAP = 8000n;
export const IS_EVICT_CAP = 64n;
export const NS_ISSUER_SIG_DOMAIN = 1112754481n;
export const NS_NULL_DOMAIN = 1112427569n;
export const NS_CERT_DOMAIN = 1128350513n;
export const NS_EPOCH_SECONDS = 86400n;
export const NS_EPOCH_ACCEPT_PAST = 4n;
export const NS_EPOCH_ACCEPT_FUTURE = 4n;
export const NS_LANE_COUNT = 1048576n;
export const NS_SAFE_CAP = 4096n;
export const NS_MAX_CERT_EPOCHS = 550n;
export const NS_RECORD_ENDOWMENT = 200000n;
export const NS_INTRO_ENDOWMENT = 8000n;
export const NS_RECORD_GAS = 2500000n;
export const NS_NULLIFIER_ENDOWMENT = 10000n;
export const NS_BASE_ENDOWMENT = 1000000n;
export const NS_PATH_GAS = 5000000n;
export const NS_FORWARD_VALUE = 7710000n;
export const NS_ROOT_THRESHOLD = 2n;
export const NS_ROOT_0 = 61648001945993851713387341017509757467197514600518013224456945346175643262219n;
export const NS_ROOT_1 = 72643295600563315702315007365945353005398927859637280636436839326056233411824n;
export const NS_ROOT_2 = 52907109351218747841695970573523340373205112110913690393551713332454347868841n;

export class NullifierShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = NullifierShard_errors_backward;
    public static readonly opcodes = NullifierShard_opcodes;
    
    static async init(epoch: bigint, lane: bigint) {
        return await NullifierShard_init(epoch, lane);
    }
    
    static async fromInit(epoch: bigint, lane: bigint) {
        const __gen_init = await NullifierShard_init(epoch, lane);
        const address = contractAddress(0, __gen_init);
        return new NullifierShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new NullifierShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  NullifierShard_types,
        getters: NullifierShard_getters,
        receivers: NullifierShard_receivers,
        errors: NullifierShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: NullifierSpend | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'NullifierSpend') {
            body = beginCell().store(storeNullifierSpend(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTupleNullifierShardView(source);
        return result;
    }
    
    async getIsSpent(provider: ContractProvider, serial: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(serial);
        const source = (await provider.get('is_spent', builder.build())).stack;
        const result = source.readBoolean();
        return result;
    }
    
}