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
    seq: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    sig: Cell;
}

export function storeCapsulePublish(src: CapsulePublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191729, 32);
        b_0.storeUint(src.seq, 64);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
        const b_1 = new Builder();
        b_1.storeRef(src.body);
        b_1.storeRef(src.sig);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCapsulePublish(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191729) { throw Error('Invalid prefix'); }
    const _seq = sc_0.loadUintBig(64);
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    const sc_1 = sc_0.loadRef().beginParse();
    const _body = sc_1.loadRef();
    const _sig = sc_1.loadRef();
    return { $$type: 'CapsulePublish' as const, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body, sig: _sig };
}

export function loadTupleCapsulePublish(source: TupleReader) {
    const _seq = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _sig = source.readCell();
    return { $$type: 'CapsulePublish' as const, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body, sig: _sig };
}

export function loadGetterTupleCapsulePublish(source: TupleReader) {
    const _seq = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _sig = source.readCell();
    return { $$type: 'CapsulePublish' as const, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body, sig: _sig };
}

export function storeTupleCapsulePublish(source: CapsulePublish) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.seq);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    builder.writeCell(source.sig);
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

export type RetireShard = {
    $$type: 'RetireShard';
}

export function storeRetireShard(src: RetireShard) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191731, 32);
    };
}

export function loadRetireShard(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191731) { throw Error('Invalid prefix'); }
    return { $$type: 'RetireShard' as const };
}

export function loadTupleRetireShard(source: TupleReader) {
    return { $$type: 'RetireShard' as const };
}

export function loadGetterTupleRetireShard(source: TupleReader) {
    return { $$type: 'RetireShard' as const };
}

export function storeTupleRetireShard(source: RetireShard) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserRetireShard(): DictionaryValue<RetireShard> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRetireShard(src)).endCell());
        },
        parse: (src) => {
            return loadRetireShard(src.loadRef().beginParse());
        }
    }
}

export type DepositProtocolFee = {
    $$type: 'DepositProtocolFee';
    amount: bigint;
}

export function storeDepositProtocolFee(src: DepositProtocolFee) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4286010889, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadDepositProtocolFee(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4286010889) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'DepositProtocolFee' as const, amount: _amount };
}

export function loadTupleDepositProtocolFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'DepositProtocolFee' as const, amount: _amount };
}

export function loadGetterTupleDepositProtocolFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'DepositProtocolFee' as const, amount: _amount };
}

export function storeTupleDepositProtocolFee(source: DepositProtocolFee) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserDepositProtocolFee(): DictionaryValue<DepositProtocolFee> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDepositProtocolFee(src)).endCell());
        },
        parse: (src) => {
            return loadDepositProtocolFee(src.loadRef().beginParse());
        }
    }
}

export type DepositCapsuleFee = {
    $$type: 'DepositCapsuleFee';
    amount: bigint;
    lane: bigint;
    init_arg0: bigint;
    init_arg1: bigint;
    publisher: Address;
}

export function storeDepositCapsuleFee(src: DepositCapsuleFee) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191750, 32);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.lane, 8);
        b_0.storeInt(src.init_arg0, 257);
        b_0.storeInt(src.init_arg1, 257);
        b_0.storeAddress(src.publisher);
    };
}

export function loadDepositCapsuleFee(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191750) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    const _lane = sc_0.loadUintBig(8);
    const _init_arg0 = sc_0.loadIntBig(257);
    const _init_arg1 = sc_0.loadIntBig(257);
    const _publisher = sc_0.loadAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, lane: _lane, init_arg0: _init_arg0, init_arg1: _init_arg1, publisher: _publisher };
}

export function loadTupleDepositCapsuleFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _init_arg0 = source.readBigNumber();
    const _init_arg1 = source.readBigNumber();
    const _publisher = source.readAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, lane: _lane, init_arg0: _init_arg0, init_arg1: _init_arg1, publisher: _publisher };
}

export function loadGetterTupleDepositCapsuleFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _init_arg0 = source.readBigNumber();
    const _init_arg1 = source.readBigNumber();
    const _publisher = source.readAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, lane: _lane, init_arg0: _init_arg0, init_arg1: _init_arg1, publisher: _publisher };
}

export function storeTupleDepositCapsuleFee(source: DepositCapsuleFee) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeNumber(source.lane);
    builder.writeNumber(source.init_arg0);
    builder.writeNumber(source.init_arg1);
    builder.writeAddress(source.publisher);
    return builder.build();
}

export function dictValueParserDepositCapsuleFee(): DictionaryValue<DepositCapsuleFee> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDepositCapsuleFee(src)).endCell());
        },
        parse: (src) => {
            return loadDepositCapsuleFee(src.loadRef().beginParse());
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
    write_pubkey: bigint;
    epoch: bigint;
    last_seq: bigint;
    record_count: bigint;
    safe_cap: bigint;
    retention: bigint;
    min_value: bigint;
    deploy_min_value: bigint;
    protocol_fee: bigint;
    retire_at: bigint;
    fee_sink: Address;
}

export function storeRecordShardView(src: RecordShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.write_pubkey, 257);
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.last_seq, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.record_count, 257);
        b_1.storeInt(src.safe_cap, 257);
        b_1.storeInt(src.retention, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.min_value, 257);
        b_2.storeInt(src.deploy_min_value, 257);
        b_2.storeInt(src.protocol_fee, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.retire_at, 257);
        b_3.storeAddress(src.fee_sink);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecordShardView(slice: Slice) {
    const sc_0 = slice;
    const _write_pubkey = sc_0.loadIntBig(257);
    const _epoch = sc_0.loadIntBig(257);
    const _last_seq = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _record_count = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    const _retention = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _min_value = sc_2.loadIntBig(257);
    const _deploy_min_value = sc_2.loadIntBig(257);
    const _protocol_fee = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _retire_at = sc_3.loadIntBig(257);
    const _fee_sink = sc_3.loadAddress();
    return { $$type: 'RecordShardView' as const, write_pubkey: _write_pubkey, epoch: _epoch, last_seq: _last_seq, record_count: _record_count, safe_cap: _safe_cap, retention: _retention, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function loadTupleRecordShardView(source: TupleReader) {
    const _write_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _last_seq = source.readBigNumber();
    const _record_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _min_value = source.readBigNumber();
    const _deploy_min_value = source.readBigNumber();
    const _protocol_fee = source.readBigNumber();
    const _retire_at = source.readBigNumber();
    const _fee_sink = source.readAddress();
    return { $$type: 'RecordShardView' as const, write_pubkey: _write_pubkey, epoch: _epoch, last_seq: _last_seq, record_count: _record_count, safe_cap: _safe_cap, retention: _retention, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function loadGetterTupleRecordShardView(source: TupleReader) {
    const _write_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _last_seq = source.readBigNumber();
    const _record_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _min_value = source.readBigNumber();
    const _deploy_min_value = source.readBigNumber();
    const _protocol_fee = source.readBigNumber();
    const _retire_at = source.readBigNumber();
    const _fee_sink = source.readAddress();
    return { $$type: 'RecordShardView' as const, write_pubkey: _write_pubkey, epoch: _epoch, last_seq: _last_seq, record_count: _record_count, safe_cap: _safe_cap, retention: _retention, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function storeTupleRecordShardView(source: RecordShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.write_pubkey);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.last_seq);
    builder.writeNumber(source.record_count);
    builder.writeNumber(source.safe_cap);
    builder.writeNumber(source.retention);
    builder.writeNumber(source.min_value);
    builder.writeNumber(source.deploy_min_value);
    builder.writeNumber(source.protocol_fee);
    builder.writeNumber(source.retire_at);
    builder.writeAddress(source.fee_sink);
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
    write_pubkey: bigint;
    epoch: bigint;
    last_seq: bigint;
    records: Dictionary<bigint, RecordEntry>;
    record_count: bigint;
}

export function storeRecordShard$Data(src: RecordShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.write_pubkey, 256);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.last_seq, 64);
        b_0.storeDict(src.records, Dictionary.Keys.BigInt(257), dictValueParserRecordEntry());
        b_0.storeUint(src.record_count, 32);
    };
}

export function loadRecordShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _write_pubkey = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    const _last_seq = sc_0.loadUintBig(64);
    const _records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserRecordEntry(), sc_0);
    const _record_count = sc_0.loadUintBig(32);
    return { $$type: 'RecordShard$Data' as const, write_pubkey: _write_pubkey, epoch: _epoch, last_seq: _last_seq, records: _records, record_count: _record_count };
}

export function loadTupleRecordShard$Data(source: TupleReader) {
    const _write_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _last_seq = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserRecordEntry(), source.readCellOpt());
    const _record_count = source.readBigNumber();
    return { $$type: 'RecordShard$Data' as const, write_pubkey: _write_pubkey, epoch: _epoch, last_seq: _last_seq, records: _records, record_count: _record_count };
}

export function loadGetterTupleRecordShard$Data(source: TupleReader) {
    const _write_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _last_seq = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserRecordEntry(), source.readCellOpt());
    const _record_count = source.readBigNumber();
    return { $$type: 'RecordShard$Data' as const, write_pubkey: _write_pubkey, epoch: _epoch, last_seq: _last_seq, records: _records, record_count: _record_count };
}

export function storeTupleRecordShard$Data(source: RecordShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.write_pubkey);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.last_seq);
    builder.writeCell(source.records.size > 0 ? beginCell().storeDictDirect(source.records, Dictionary.Keys.BigInt(257), dictValueParserRecordEntry()).endCell() : null);
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

 type RecordShard_init_args = {
    $$type: 'RecordShard_init_args';
    write_pubkey: bigint;
    epoch: bigint;
}

function initRecordShard_init_args(src: RecordShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.write_pubkey, 257);
        b_0.storeInt(src.epoch, 257);
    };
}

async function RecordShard_init(write_pubkey: bigint, epoch: bigint) {
    const __code = Cell.fromHex('b5ee9c7241021101000436000114ff00f4a413f4bcf2c80b01020162020c04dcd001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019ed3ffd31fd33ff404d31f55406c158e11810101d700810101d7005902d101706d21e206e3027025d74920c21f953105d31f06de21821052535031bae3023620821052535033bae302c00005c12115b003040a0b00e4048020d7217021d749c21f9430d31f01de821052535046ba8e55d37fd307593031813559f8428d0860023e56458533236ac84b83f2443cf2b354072b55fc5bf1f451180fe68224aa233cc705f2f481355a01c200f2f44034c87f01ca0055405045cbff12cb1fcb3ff400cb1fc9ed54e05f0602fa5b04d33fd4d4d430d0d4d430f82382015180a90481355828a55220be9428a412bb923170e2f2f4813554f8416f24135f032bc000958209237160958208ee0980e2bef2f48135532a830bb9f2f48135555356bcf2f41048095520db3c33c882105253574401cb1f5260cb3f5230cbffc9f90081355608d026f91017f2f405060040c882105253464301cb1f03f9005003cbff01f90001cbff01f90001cbffc9f90001fe810101f82313c85902810101cf00810101cf00c9542260206e953059f45a30944133f415e204a48d0860023e56458533236ac84b83f2443cf2b354072b55fc5bf1f451180fe68224aa233c8208c042c07f71820898968070f842546990c855408210525350465006cb1f14cb7f12cb07810101cf00810101cf00cec94343c80702d889cf16ca00cf8440ce01fa02806acf40f400c901fb0082080493e021c0019582083567e09170e2a076fb02f8427081008270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb004430120809000160002ec87f01ca0055405045cbff12cb1fcb3ff400cb1fc9ed5400e85b3333813557f82324a60282015180a88209e13380a0bcf2f46d70f842218100a270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010241023c87f01ca0055405045cbff12cb1fcb3ff400cb1fc9ed5400428e194034c87f01ca0055405045cbff12cb1fcb3ff400cb1fc9ed54e05f05f2c0820201200d0f015fbd4a976a268690000cf69ffe98fe99ffa02698faaa0360ac708c08080eb80408080eb802c816880b83690f16d9e362dc0e009e830b8209e133808208ee0980820923716027a60282015180a823a082089896808d0860023e56458533236ac84b83f2443cf2b354072b55fc5bf1f451180fe68224aa233c2b517b517b517a075523120163be200f6a268690000cf69ffe98fe99ffa02698faaa0360ac708c08080eb80408080eb802c816880b83690f12a826d9e3629c100064810101230259f40d6fa192306ddf206e92306d8e10d0810101d700810101d700596c126f02e2206e9430707020e06f227f59d7a7eb5e');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initRecordShard_init_args({ $$type: 'RecordShard_init_args', write_pubkey, epoch })(builder);
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
    {"name":"CapsulePublish","header":1381191729,"fields":[{"name":"seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"sig","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"RetireShard","header":1381191731,"fields":[]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"DepositCapsuleFee","header":1381191750,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"lane","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"init_arg0","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"init_arg1","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publisher","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"RecordEntry","header":null,"fields":[{"name":"frame_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"frame_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"RecordShardView","header":null,"fields":[{"name":"write_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_seq","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retention","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"deploy_min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"protocol_fee","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retire_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_sink","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"RecordShard$Data","header":null,"fields":[{"name":"write_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"last_seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"records","type":{"kind":"dict","key":"int","value":"RecordEntry","valueFormat":"ref"}},{"name":"record_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const RecordShard_opcodes = {
    "CapsulePublish": 1381191729,
    "RetireShard": 1381191731,
    "DepositProtocolFee": 4286010889,
    "DepositCapsuleFee": 1381191750,
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
    {"receiver":"internal","message":{"kind":"typed","type":"RetireShard"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const RS_SAFE_CAP = 4096n;
export const RS_RETENTION = 31536000n;
export const RS_FRAME_DOMAIN = 1381189187n;
export const RS_WRITE_DOMAIN = 1381193540n;
export const RS_RECORD_ENDOWMENT = 300000n;
export const RS_BASE_ENDOWMENT = 3500000n;
export const RS_PUBLISH_GAS = 2500000n;
export const RS_PROTOCOL_FEE = 10000000n;
export const RS_FEE_SINK = address("EQBHysiwpmRtWQlwfkiHnlZqgOVqv4t-PoojAfzQRJVEZ5rE");
export const RS_FEE_SINK_DEPOSIT_RESERVE = 2600000n;
export const RS_FEE_SINK_FWD_RESERVE = 200000n;
export const RS_FEE_TRANSPORT = 2800000n;
export const RS_MIN_VALUE = 15600000n;
export const RS_DEPLOY_MIN_VALUE = 19100000n;

export class RecordShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = RecordShard_errors_backward;
    public static readonly opcodes = RecordShard_opcodes;
    
    static async init(write_pubkey: bigint, epoch: bigint) {
        return await RecordShard_init(write_pubkey, epoch);
    }
    
    static async fromInit(write_pubkey: bigint, epoch: bigint) {
        const __gen_init = await RecordShard_init(write_pubkey, epoch);
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: CapsulePublish | RetireShard | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CapsulePublish') {
            body = beginCell().store(storeCapsulePublish(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RetireShard') {
            body = beginCell().store(storeRetireShard(message)).endCell();
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