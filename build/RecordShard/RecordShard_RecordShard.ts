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

export type CapsulePublish = {
    $$type: 'CapsulePublish';
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

export function storeCapsulePublish(src: CapsulePublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191729, 32);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
        b_0.storeRef(src.body);
    };
}

export function loadCapsulePublish(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191729) { throw Error('Invalid prefix'); }
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'CapsulePublish' as const, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadTupleCapsulePublish(source: TupleReader) {
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'CapsulePublish' as const, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadGetterTupleCapsulePublish(source: TupleReader) {
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'CapsulePublish' as const, header_0: _header_0, header_1: _header_1, body: _body };
}

export function storeTupleCapsulePublish(source: CapsulePublish) {
    const builder = new TupleBuilder();
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserCapsulePublish(): DictionaryValue<CapsulePublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsulePublish(src)).endCell());
        },
        parse: (src) => {
            return loadCapsulePublish(src.loadRef().beginParse());
        }
    }
}

export type EvictRecords = {
    $$type: 'EvictRecords';
    max_count: bigint;
}

export function storeEvictRecords(src: EvictRecords) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191730, 32);
        b_0.storeUint(src.max_count, 16);
    };
}

export function loadEvictRecords(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191730) { throw Error('Invalid prefix'); }
    const _max_count = sc_0.loadUintBig(16);
    return { $$type: 'EvictRecords' as const, max_count: _max_count };
}

export function loadTupleEvictRecords(source: TupleReader) {
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictRecords' as const, max_count: _max_count };
}

export function loadGetterTupleEvictRecords(source: TupleReader) {
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictRecords' as const, max_count: _max_count };
}

export function storeTupleEvictRecords(source: EvictRecords) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.max_count);
    return builder.build();
}

export function dictValueParserEvictRecords(): DictionaryValue<EvictRecords> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictRecords(src)).endCell());
        },
        parse: (src) => {
            return loadEvictRecords(src.loadRef().beginParse());
        }
    }
}

export type RecordEntry = {
    $$type: 'RecordEntry';
    frame_commit: bigint;
    created_at: bigint;
}

export function storeRecordEntry(src: RecordEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.frame_commit, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadRecordEntry(slice: Slice) {
    const sc_0 = slice;
    const _frame_commit = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'RecordEntry' as const, frame_commit: _frame_commit, created_at: _created_at };
}

export function loadTupleRecordEntry(source: TupleReader) {
    const _frame_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'RecordEntry' as const, frame_commit: _frame_commit, created_at: _created_at };
}

export function loadGetterTupleRecordEntry(source: TupleReader) {
    const _frame_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'RecordEntry' as const, frame_commit: _frame_commit, created_at: _created_at };
}

export function storeTupleRecordEntry(source: RecordEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.frame_commit);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserRecordEntry(): DictionaryValue<RecordEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecordEntry(src)).endCell());
        },
        parse: (src) => {
            return loadRecordEntry(src.loadRef().beginParse());
        }
    }
}

export type CapsuleRecordView = {
    $$type: 'CapsuleRecordView';
    exists: boolean;
    frame_commit: bigint;
    created_at: bigint;
}

export function storeCapsuleRecordView(src: CapsuleRecordView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.frame_commit, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadCapsuleRecordView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _frame_commit = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'CapsuleRecordView' as const, exists: _exists, frame_commit: _frame_commit, created_at: _created_at };
}

export function loadTupleCapsuleRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _frame_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'CapsuleRecordView' as const, exists: _exists, frame_commit: _frame_commit, created_at: _created_at };
}

export function loadGetterTupleCapsuleRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _frame_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'CapsuleRecordView' as const, exists: _exists, frame_commit: _frame_commit, created_at: _created_at };
}

export function storeTupleCapsuleRecordView(source: CapsuleRecordView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.frame_commit);
    builder.writeNumber(source.created_at);
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
    live_count: bigint;
    evict_cursor: bigint;
    safe_cap: bigint;
    retention: bigint;
    min_value: bigint;
}

export function storeRecordShardView(src: RecordShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.bucket_key, 257);
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.record_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.live_count, 257);
        b_1.storeInt(src.evict_cursor, 257);
        b_1.storeInt(src.safe_cap, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.retention, 257);
        b_2.storeInt(src.min_value, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecordShardView(slice: Slice) {
    const sc_0 = slice;
    const _bucket_key = sc_0.loadIntBig(257);
    const _epoch = sc_0.loadIntBig(257);
    const _record_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _live_count = sc_1.loadIntBig(257);
    const _evict_cursor = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _retention = sc_2.loadIntBig(257);
    const _min_value = sc_2.loadIntBig(257);
    return { $$type: 'RecordShardView' as const, bucket_key: _bucket_key, epoch: _epoch, record_count: _record_count, live_count: _live_count, evict_cursor: _evict_cursor, safe_cap: _safe_cap, retention: _retention, min_value: _min_value };
}

export function loadTupleRecordShardView(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _record_count = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _min_value = source.readBigNumber();
    return { $$type: 'RecordShardView' as const, bucket_key: _bucket_key, epoch: _epoch, record_count: _record_count, live_count: _live_count, evict_cursor: _evict_cursor, safe_cap: _safe_cap, retention: _retention, min_value: _min_value };
}

export function loadGetterTupleRecordShardView(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _record_count = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _min_value = source.readBigNumber();
    return { $$type: 'RecordShardView' as const, bucket_key: _bucket_key, epoch: _epoch, record_count: _record_count, live_count: _live_count, evict_cursor: _evict_cursor, safe_cap: _safe_cap, retention: _retention, min_value: _min_value };
}

export function storeTupleRecordShardView(source: RecordShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bucket_key);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.record_count);
    builder.writeNumber(source.live_count);
    builder.writeNumber(source.evict_cursor);
    builder.writeNumber(source.safe_cap);
    builder.writeNumber(source.retention);
    builder.writeNumber(source.min_value);
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
    records: Dictionary<bigint, RecordEntry>;
    record_count: bigint;
    live_count: bigint;
    evict_cursor: bigint;
}

export function storeRecordShard$Data(src: RecordShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.bucket_key, 256);
        b_0.storeUint(src.epoch, 32);
        b_0.storeDict(src.records, Dictionary.Keys.BigInt(257), dictValueParserRecordEntry());
        b_0.storeUint(src.record_count, 32);
        b_0.storeUint(src.live_count, 32);
        b_0.storeUint(src.evict_cursor, 32);
    };
}

export function loadRecordShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _bucket_key = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    const _records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserRecordEntry(), sc_0);
    const _record_count = sc_0.loadUintBig(32);
    const _live_count = sc_0.loadUintBig(32);
    const _evict_cursor = sc_0.loadUintBig(32);
    return { $$type: 'RecordShard$Data' as const, bucket_key: _bucket_key, epoch: _epoch, records: _records, record_count: _record_count, live_count: _live_count, evict_cursor: _evict_cursor };
}

export function loadTupleRecordShard$Data(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserRecordEntry(), source.readCellOpt());
    const _record_count = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    return { $$type: 'RecordShard$Data' as const, bucket_key: _bucket_key, epoch: _epoch, records: _records, record_count: _record_count, live_count: _live_count, evict_cursor: _evict_cursor };
}

export function loadGetterTupleRecordShard$Data(source: TupleReader) {
    const _bucket_key = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserRecordEntry(), source.readCellOpt());
    const _record_count = source.readBigNumber();
    const _live_count = source.readBigNumber();
    const _evict_cursor = source.readBigNumber();
    return { $$type: 'RecordShard$Data' as const, bucket_key: _bucket_key, epoch: _epoch, records: _records, record_count: _record_count, live_count: _live_count, evict_cursor: _evict_cursor };
}

export function storeTupleRecordShard$Data(source: RecordShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bucket_key);
    builder.writeNumber(source.epoch);
    builder.writeCell(source.records.size > 0 ? beginCell().storeDictDirect(source.records, Dictionary.Keys.BigInt(257), dictValueParserRecordEntry()).endCell() : null);
    builder.writeNumber(source.record_count);
    builder.writeNumber(source.live_count);
    builder.writeNumber(source.evict_cursor);
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

 type RecordShard_init_args = {
    $$type: 'RecordShard_init_args';
    bucket_key: bigint;
    epoch: bigint;
}

function initRecordShard_init_args(src: RecordShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.bucket_key, 257);
        b_0.storeInt(src.epoch, 257);
    };
}

async function RecordShard_init(bucket_key: bigint, epoch: bigint) {
    const __code = Cell.fromHex('b5ee9c7241020e01000324000114ff00f4a413f4bcf2c80b01020162020903f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e10d3ffd31ff404d31fd31fd31f55506c168e12810101d700810101d7005902d1016d705300e207925f07e07026d74920c21f953106d31f07de21821052535031bae30221821052535032bae30237c00006c12116b0e3025f06f2c08203060802fe5b05d4d4d430813554f8416f24135f0382082932e0bef2f481355328830bb9f2f424810101251089107910691059104a103b49abdb3c34f82314c85902810101cf00810101cf00c910364780206e953059f45a30944133f415e204a405a482081e84802182030d40a8a072fb02f8427081008270136d6d50436d03c8cf858004050040c882105253464301cb1f03f9005003cbff01f90001cbff01f90001cbffc9f9000090ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00450403c87f01ca0055505056cbff13cb1ff400cb1fcb1fcb1fc9ed5401e25b05d30f30708e115301b99320c1409170e2935372b99170e28eb7238101012959f40d6fa192306ddf206e92306d8e10d0810101d700810101d700596c126f02e2206eb3973007a410670306e30d10371036e85b10355512c87f01ca0055505056cbff13cb1ff400cb1fcb1fcb1fc9ed540700986f22318209e13380a0f823b98e368101016dc8216e925b6d8e11016f22585902810101cf00810101cf00c9e229103601206e953059f45a30944133f415e206a507a403a496302010671036e2003a10355512c87f01ca0055505056cbff13cb1ff400cb1fcb1fcb1fc9ed540201200a0c0167bd4a976a268690000c70869ffe98ffa02698fe98fe98faaa8360b4709408080eb80408080eb802c816880b6b82980716d9e363440b002e830b8209e1338082082932e02851385137513751374133016bbe200f6a268690000c70869ffe98ffa02698fe98fe98faaa8360b4709408080eb80408080eb802c816880b6b82980712a82ed9e3631c0d0064810101250259f40d6fa192306ddf206e92306d8e10d0810101d700810101d700596c126f02e2206e9430707020e06f227f597236d31c');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initRecordShard_init_args({ $$type: 'RecordShard_init_args', bucket_key, epoch })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const RecordShard_errors = {
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

export const RecordShard_errors_backward = {
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

const RecordShard_types: ABIType[] = [
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
    {"name":"CapsulePublish","header":1381191729,"fields":[{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"EvictRecords","header":1381191730,"fields":[{"name":"max_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"RecordEntry","header":null,"fields":[{"name":"frame_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"frame_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"RecordShardView","header":null,"fields":[{"name":"bucket_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"evict_cursor","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retention","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"RecordShard$Data","header":null,"fields":[{"name":"bucket_key","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"records","type":{"kind":"dict","key":"int","value":"RecordEntry","valueFormat":"ref"}},{"name":"record_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"live_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"evict_cursor","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const RecordShard_opcodes = {
    "CapsulePublish": 1381191729,
    "EvictRecords": 1381191730,
}

const RecordShard_getters: ABIGetter[] = [
    {"name":"get_record","methodId":115713,"arguments":[{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"CapsuleRecordView","optional":false}},
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"RecordShardView","optional":false}},
]

export const RecordShard_getterMapping: { [key: string]: string } = {
    'get_record': 'getGetRecord',
    'get_view': 'getGetView',
}

const RecordShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"CapsulePublish"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EvictRecords"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const RS_SAFE_CAP = 4096n;
export const RS_RETENTION = 31536000n;
export const RS_EVICT_CAP = 64n;
export const RS_FRAME_DOMAIN = 1381189187n;
export const RS_RECORD_ENDOWMENT = 200000n;
export const RS_BASE_ENDOWMENT = 2000000n;
export const RS_PUBLISH_GAS = 2500000n;
export const RS_MIN_VALUE = 2700000n;

export class RecordShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = RecordShard_errors_backward;
    public static readonly opcodes = RecordShard_opcodes;
    
    static async init(bucket_key: bigint, epoch: bigint) {
        return await RecordShard_init(bucket_key, epoch);
    }
    
    static async fromInit(bucket_key: bigint, epoch: bigint) {
        const __gen_init = await RecordShard_init(bucket_key, epoch);
        const address = contractAddress(0, __gen_init);
        return new RecordShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new RecordShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  RecordShard_types,
        getters: RecordShard_getters,
        receivers: RecordShard_receivers,
        errors: RecordShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: CapsulePublish | EvictRecords | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CapsulePublish') {
            body = beginCell().store(storeCapsulePublish(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EvictRecords') {
            body = beginCell().store(storeEvictRecords(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetRecord(provider: ContractProvider, entry_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entry_id);
        const source = (await provider.get('get_record', builder.build())).stack;
        const result = loadGetterTupleCapsuleRecordView(source);
        return result;
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTupleRecordShardView(source);
        return result;
    }
    
}