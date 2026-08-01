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

export type IntroPublish = {
    $$type: 'IntroPublish';
    r: bigint;
    view_tag: bigint;
    header_0: Cell;
    body: Cell;
}

export function storeIntroPublish(src: IntroPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1230196785, 32);
        b_0.storeUint(src.r, 256);
        b_0.storeUint(src.view_tag, 16);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.body);
    };
}

export function loadIntroPublish(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1230196785) { throw Error('Invalid prefix'); }
    const _r = sc_0.loadUintBig(256);
    const _view_tag = sc_0.loadUintBig(16);
    const _header_0 = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'IntroPublish' as const, r: _r, view_tag: _view_tag, header_0: _header_0, body: _body };
}

export function loadTupleIntroPublish(source: TupleReader) {
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _header_0 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'IntroPublish' as const, r: _r, view_tag: _view_tag, header_0: _header_0, body: _body };
}

export function loadGetterTupleIntroPublish(source: TupleReader) {
    const _r = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _header_0 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'IntroPublish' as const, r: _r, view_tag: _view_tag, header_0: _header_0, body: _body };
}

export function storeTupleIntroPublish(source: IntroPublish) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.r);
    builder.writeNumber(source.view_tag);
    builder.writeCell(source.header_0);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserIntroPublish(): DictionaryValue<IntroPublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroPublish(src)).endCell());
        },
        parse: (src) => {
            return loadIntroPublish(src.loadRef().beginParse());
        }
    }
}

export type RetireShard = {
    $$type: 'RetireShard';
}

export function storeRetireShard(src: RetireShard) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1230196787, 32);
    };
}

export function loadRetireShard(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1230196787) { throw Error('Invalid prefix'); }
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

export type IntroScanPage = {
    $$type: 'IntroScanPage';
    from_id: bigint;
    count: bigint;
    next_id: bigint;
    pairs: Cell;
}

export function storeIntroScanPage(src: IntroScanPage) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.from_id, 257);
        b_0.storeInt(src.count, 257);
        b_0.storeInt(src.next_id, 257);
        b_0.storeRef(src.pairs);
    };
}

export function loadIntroScanPage(slice: Slice) {
    const sc_0 = slice;
    const _from_id = sc_0.loadIntBig(257);
    const _count = sc_0.loadIntBig(257);
    const _next_id = sc_0.loadIntBig(257);
    const _pairs = sc_0.loadRef();
    return { $$type: 'IntroScanPage' as const, from_id: _from_id, count: _count, next_id: _next_id, pairs: _pairs };
}

export function loadTupleIntroScanPage(source: TupleReader) {
    const _from_id = source.readBigNumber();
    const _count = source.readBigNumber();
    const _next_id = source.readBigNumber();
    const _pairs = source.readCell();
    return { $$type: 'IntroScanPage' as const, from_id: _from_id, count: _count, next_id: _next_id, pairs: _pairs };
}

export function loadGetterTupleIntroScanPage(source: TupleReader) {
    const _from_id = source.readBigNumber();
    const _count = source.readBigNumber();
    const _next_id = source.readBigNumber();
    const _pairs = source.readCell();
    return { $$type: 'IntroScanPage' as const, from_id: _from_id, count: _count, next_id: _next_id, pairs: _pairs };
}

export function storeTupleIntroScanPage(source: IntroScanPage) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.from_id);
    builder.writeNumber(source.count);
    builder.writeNumber(source.next_id);
    builder.writeCell(source.pairs);
    return builder.build();
}

export function dictValueParserIntroScanPage(): DictionaryValue<IntroScanPage> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroScanPage(src)).endCell());
        },
        parse: (src) => {
            return loadIntroScanPage(src.loadRef().beginParse());
        }
    }
}

export type IntroShardView = {
    $$type: 'IntroShardView';
    epoch: bigint;
    bucket: bigint;
    next_id: bigint;
    retention: bigint;
    safe_cap: bigint;
    min_value: bigint;
    deploy_min_value: bigint;
    protocol_fee: bigint;
    retire_at: bigint;
    fee_sink: Address;
}

export function storeIntroShardView(src: IntroShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.bucket, 257);
        b_0.storeInt(src.next_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.retention, 257);
        b_1.storeInt(src.safe_cap, 257);
        b_1.storeInt(src.min_value, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.deploy_min_value, 257);
        b_2.storeInt(src.protocol_fee, 257);
        b_2.storeInt(src.retire_at, 257);
        const b_3 = new Builder();
        b_3.storeAddress(src.fee_sink);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadIntroShardView(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadIntBig(257);
    const _bucket = sc_0.loadIntBig(257);
    const _next_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _retention = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    const _min_value = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _deploy_min_value = sc_2.loadIntBig(257);
    const _protocol_fee = sc_2.loadIntBig(257);
    const _retire_at = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _fee_sink = sc_3.loadAddress();
    return { $$type: 'IntroShardView' as const, epoch: _epoch, bucket: _bucket, next_id: _next_id, retention: _retention, safe_cap: _safe_cap, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function loadTupleIntroShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _next_id = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _min_value = source.readBigNumber();
    const _deploy_min_value = source.readBigNumber();
    const _protocol_fee = source.readBigNumber();
    const _retire_at = source.readBigNumber();
    const _fee_sink = source.readAddress();
    return { $$type: 'IntroShardView' as const, epoch: _epoch, bucket: _bucket, next_id: _next_id, retention: _retention, safe_cap: _safe_cap, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function loadGetterTupleIntroShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _next_id = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _min_value = source.readBigNumber();
    const _deploy_min_value = source.readBigNumber();
    const _protocol_fee = source.readBigNumber();
    const _retire_at = source.readBigNumber();
    const _fee_sink = source.readAddress();
    return { $$type: 'IntroShardView' as const, epoch: _epoch, bucket: _bucket, next_id: _next_id, retention: _retention, safe_cap: _safe_cap, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function storeTupleIntroShardView(source: IntroShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.bucket);
    builder.writeNumber(source.next_id);
    builder.writeNumber(source.retention);
    builder.writeNumber(source.safe_cap);
    builder.writeNumber(source.min_value);
    builder.writeNumber(source.deploy_min_value);
    builder.writeNumber(source.protocol_fee);
    builder.writeNumber(source.retire_at);
    builder.writeAddress(source.fee_sink);
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
}

export function storeIntroShard$Data(src: IntroShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.bucket, 32);
        b_0.storeDict(src.intros, Dictionary.Keys.BigInt(257), dictValueParserIntroEntry());
        b_0.storeUint(src.next_id, 32);
    };
}

export function loadIntroShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadUintBig(32);
    const _bucket = sc_0.loadUintBig(32);
    const _intros = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserIntroEntry(), sc_0);
    const _next_id = sc_0.loadUintBig(32);
    return { $$type: 'IntroShard$Data' as const, epoch: _epoch, bucket: _bucket, intros: _intros, next_id: _next_id };
}

export function loadTupleIntroShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _intros = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIntroEntry(), source.readCellOpt());
    const _next_id = source.readBigNumber();
    return { $$type: 'IntroShard$Data' as const, epoch: _epoch, bucket: _bucket, intros: _intros, next_id: _next_id };
}

export function loadGetterTupleIntroShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _bucket = source.readBigNumber();
    const _intros = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIntroEntry(), source.readCellOpt());
    const _next_id = source.readBigNumber();
    return { $$type: 'IntroShard$Data' as const, epoch: _epoch, bucket: _bucket, intros: _intros, next_id: _next_id };
}

export function storeTupleIntroShard$Data(source: IntroShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.bucket);
    builder.writeCell(source.intros.size > 0 ? beginCell().storeDictDirect(source.intros, Dictionary.Keys.BigInt(257), dictValueParserIntroEntry()).endCell() : null);
    builder.writeNumber(source.next_id);
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

 type IntroShard_init_args = {
    $$type: 'IntroShard_init_args';
    epoch: bigint;
    bucket: bigint;
}

function initIntroShard_init_args(src: IntroShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.bucket, 257);
    };
}

async function IntroShard_init(epoch: bigint, bucket: bigint) {
    const __code = Cell.fromHex('b5ee9c724102140100050e000114ff00f4a413f4bcf2c80b01020162020a04d6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019cd31fd31ff404d31f55306c148e10810101d700810101d7005902d1016d70e205e3027024d74920c21f953104d31f05de21821049535031bae3023520821049535033bae302c00004c12114b00304080900de038020d7217021d749c21f9430d31f01de821052535046ba8e52d37fd307593031813575f8428d086006004a6e8a76492c8578ff3bca196d91e6d627830cfa35de60201cdc6728234cdcc705f2f481357601c200f2f44003c87f01ca0055305034cb1fcb1ff400cb1fc9ed54e05f0502fc5b03d3ffd30fd4d430f82382015180a90481357427a55220be9427a412bb923170e2f2f4813572f8416f24135f0329c0009582090fc250958208e99cb0e2bef2f481357028811f40b9f2f426810101291058104710394a79db3c32f82310354770c855305034810101cf00810101cf00810101cf0001c8810101cf00cdc905060032c882104953424301cb1f02f90058cbff01f90001cbffc9f90001fe10364650206e953059f45a30944133f415e201a48d086006004a6e8a76492c8578ff3bca196d91e6d627830cfa35de60201cdc6728234cdc8208c042c07f71820898968021f8425469b0c855408210525350465006cb1f14cb7f12cb07810101cf00810101cf00cec94343c8cf8580ca00cf8440ce01fa02806acf40f400c90700d401fb0081271021c0019582082625a09170e2a076fb02f8427081008270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001023c87f01ca0055305034cb1fcb1ff400cb1fc9ed5400e65b6c22813573f82323a60282015180a88208093a80a08208054600a0bcf2f46d70f842218100a270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00c87f01ca0055305034cb1fcb1ff400cb1fc9ed54003c8e164003c87f01ca0055305034cb1fcb1ff400cb1fc9ed54e05f04f2c0820201480b100201580c0e0159b254bb51343480006734c7f4c7fd0134c7d54c1b05238420404075c020404075c01640b4405b5c38b6cf1b12a00d00b08208093a80811f408208e99cb082090fc25027a60282015180a824a08208054600a082089896808d086006004a6e8a76492c8578ff3bca196d91e6d627830cfa35de60201cdc6728234cdc2a517a51794617504445150312015db23dbb51343480006734c7f4c7fd0134c7d54c1b05238420404075c020404075c01640b4405b5c389540f6cf1b11600f008a810101230259f40d6fa192306ddf206e92306d8e20d0810101d700810101d700810101d700d401d0810101d700301443306c146f04e2206e96307070547000e06f247f5530015dbbdd0ed44d0d200019cd31fd31ff404d31f55306c148e10810101d700810101d7005902d1016d70e25513db3c6c4481101520170b6095320bc935320a19170e270038307b60801b60812b60922103645465354db3c103645701047120118c8c97f9322c2008ae8135f031300fc2273b6085343a021a1c870935303b98e5b8101015331a02b5959f40d6fa192306ddf206e92306d8e20d0810101d700810101d700810101d700d401d0810101d700301443306c146f04e2206e917095206f245f03e25003cbff226e92327097026f2410235f03e258cb0f01a4e8303122946c22c9709413ccc901e25aa159804d96b5');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initIntroShard_init_args({ $$type: 'IntroShard_init_args', epoch, bucket })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const IntroShard_errors = {
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

export const IntroShard_errors_backward = {
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

const IntroShard_types: ABIType[] = [
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
    {"name":"IntroPublish","header":1230196785,"fields":[{"name":"r","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"view_tag","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"RetireShard","header":1230196787,"fields":[]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"DepositCapsuleFee","header":1381191750,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"lane","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"init_arg0","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"init_arg1","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publisher","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"IntroEntry","header":null,"fields":[{"name":"r","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"view_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"r","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"view_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroScanPage","header":null,"fields":[{"name":"from_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pairs","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"IntroShardView","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bucket","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retention","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"deploy_min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"protocol_fee","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retire_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_sink","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"IntroShard$Data","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"bucket","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"intros","type":{"kind":"dict","key":"int","value":"IntroEntry","valueFormat":"ref"}},{"name":"next_id","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const IntroShard_opcodes = {
    "IntroPublish": 1230196785,
    "RetireShard": 1230196787,
    "DepositProtocolFee": 4286010889,
    "DepositCapsuleFee": 1381191750,
}

const IntroShard_getters: ABIGetter[] = [
    {"name":"get_scan_page","methodId":97744,"arguments":[{"name":"from_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"IntroScanPage","optional":false}},
    {"name":"get_entry","methodId":80118,"arguments":[{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"IntroEntryView","optional":false}},
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"IntroShardView","optional":false}},
]

export const IntroShard_getterMapping: { [key: string]: string } = {
    'get_scan_page': 'getGetScanPage',
    'get_entry': 'getGetEntry',
    'get_view': 'getGetView',
}

const IntroShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"IntroPublish"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RetireShard"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const IS_INTRO_RETENTION = 604800n;
export const IS_SAFE_CAP = 8000n;
export const IS_RETIRE_SLACK = 345600n;
export const IS_SCAN_PAGE_CAP = 256n;
export const IS_PAIRS_PER_CELL = 3n;
export const IS_BODY_DOMAIN = 1230193219n;
export const IS_INTRO_ENDOWMENT = 10000n;
export const IS_BASE_ENDOWMENT = 2500000n;
export const IS_PUBLISH_GAS = 2500000n;
export const IS_PROTOCOL_FEE = 10000000n;
export const IS_FEE_SINK = address("EQDACU3RTsklkK8f53lDLbI82sTwYZ9Gu8wEA5uM5QRpmzXF");
export const IS_FEE_SINK_DEPOSIT_RESERVE = 2600000n;
export const IS_FEE_SINK_FWD_RESERVE = 200000n;
export const IS_FEE_TRANSPORT = 2800000n;
export const IS_MIN_VALUE = 15310000n;
export const IS_DEPLOY_MIN_VALUE = 17810000n;

export class IntroShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = IntroShard_errors_backward;
    public static readonly opcodes = IntroShard_opcodes;
    
    static async init(epoch: bigint, bucket: bigint) {
        return await IntroShard_init(epoch, bucket);
    }
    
    static async fromInit(epoch: bigint, bucket: bigint) {
        const __gen_init = await IntroShard_init(epoch, bucket);
        const address = contractAddress(0, __gen_init);
        return new IntroShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new IntroShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  IntroShard_types,
        getters: IntroShard_getters,
        receivers: IntroShard_receivers,
        errors: IntroShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: IntroPublish | RetireShard | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'IntroPublish') {
            body = beginCell().store(storeIntroPublish(message)).endCell();
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
    
    async getGetScanPage(provider: ContractProvider, from_id: bigint, max_count: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(from_id);
        builder.writeNumber(max_count);
        const source = (await provider.get('get_scan_page', builder.build())).stack;
        const result = loadGetterTupleIntroScanPage(source);
        return result;
    }
    
    async getGetEntry(provider: ContractProvider, entry_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entry_id);
        const source = (await provider.get('get_entry', builder.build())).stack;
        const result = loadGetterTupleIntroEntryView(source);
        return result;
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTupleIntroShardView(source);
        return result;
    }
    
}