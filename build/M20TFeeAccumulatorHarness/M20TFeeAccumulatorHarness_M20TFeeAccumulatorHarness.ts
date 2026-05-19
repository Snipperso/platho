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

export type FlushBuybackDue = {
    $$type: 'FlushBuybackDue';
    amount: bigint;
}

export function storeFlushBuybackDue(src: FlushBuybackDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3016934701, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadFlushBuybackDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3016934701) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'FlushBuybackDue' as const, amount: _amount };
}

export function loadTupleFlushBuybackDue(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushBuybackDue' as const, amount: _amount };
}

export function loadGetterTupleFlushBuybackDue(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushBuybackDue' as const, amount: _amount };
}

export function storeTupleFlushBuybackDue(source: FlushBuybackDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserFlushBuybackDue(): DictionaryValue<FlushBuybackDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushBuybackDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushBuybackDue(src.loadRef().beginParse());
        }
    }
}

export type AcceptBurnReserve = {
    $$type: 'AcceptBurnReserve';
    amount: bigint;
}

export function storeAcceptBurnReserve(src: AcceptBurnReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1498129669, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadAcceptBurnReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1498129669) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'AcceptBurnReserve' as const, amount: _amount };
}

export function loadTupleAcceptBurnReserve(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'AcceptBurnReserve' as const, amount: _amount };
}

export function loadGetterTupleAcceptBurnReserve(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'AcceptBurnReserve' as const, amount: _amount };
}

export function storeTupleAcceptBurnReserve(source: AcceptBurnReserve) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserAcceptBurnReserve(): DictionaryValue<AcceptBurnReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAcceptBurnReserve(src)).endCell());
        },
        parse: (src) => {
            return loadAcceptBurnReserve(src.loadRef().beginParse());
        }
    }
}

export type M20TForwardWrongAcceptBurnReserve = {
    $$type: 'M20TForwardWrongAcceptBurnReserve';
    amount: bigint;
    forward_value: bigint;
}

export function storeM20TForwardWrongAcceptBurnReserve(src: M20TForwardWrongAcceptBurnReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1295140439, 32);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.forward_value, 128);
    };
}

export function loadM20TForwardWrongAcceptBurnReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1295140439) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    const _forward_value = sc_0.loadUintBig(128);
    return { $$type: 'M20TForwardWrongAcceptBurnReserve' as const, amount: _amount, forward_value: _forward_value };
}

export function loadTupleM20TForwardWrongAcceptBurnReserve(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _forward_value = source.readBigNumber();
    return { $$type: 'M20TForwardWrongAcceptBurnReserve' as const, amount: _amount, forward_value: _forward_value };
}

export function loadGetterTupleM20TForwardWrongAcceptBurnReserve(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _forward_value = source.readBigNumber();
    return { $$type: 'M20TForwardWrongAcceptBurnReserve' as const, amount: _amount, forward_value: _forward_value };
}

export function storeTupleM20TForwardWrongAcceptBurnReserve(source: M20TForwardWrongAcceptBurnReserve) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeNumber(source.forward_value);
    return builder.build();
}

export function dictValueParserM20TForwardWrongAcceptBurnReserve(): DictionaryValue<M20TForwardWrongAcceptBurnReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TForwardWrongAcceptBurnReserve(src)).endCell());
        },
        parse: (src) => {
            return loadM20TForwardWrongAcceptBurnReserve(src.loadRef().beginParse());
        }
    }
}

export type M20TFeeHarnessTopUp = {
    $$type: 'M20TFeeHarnessTopUp';
}

export function storeM20TFeeHarnessTopUp(src: M20TFeeHarnessTopUp) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1295144006, 32);
    };
}

export function loadM20TFeeHarnessTopUp(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1295144006) { throw Error('Invalid prefix'); }
    return { $$type: 'M20TFeeHarnessTopUp' as const };
}

export function loadTupleM20TFeeHarnessTopUp(source: TupleReader) {
    return { $$type: 'M20TFeeHarnessTopUp' as const };
}

export function loadGetterTupleM20TFeeHarnessTopUp(source: TupleReader) {
    return { $$type: 'M20TFeeHarnessTopUp' as const };
}

export function storeTupleM20TFeeHarnessTopUp(source: M20TFeeHarnessTopUp) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserM20TFeeHarnessTopUp(): DictionaryValue<M20TFeeHarnessTopUp> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TFeeHarnessTopUp(src)).endCell());
        },
        parse: (src) => {
            return loadM20TFeeHarnessTopUp(src.loadRef().beginParse());
        }
    }
}

export type M20TFeeAccumulatorHarnessStateView = {
    $$type: 'M20TFeeAccumulatorHarnessStateView';
    run_id: bigint;
    controller_address: Address;
    buyback_burn_address: Address;
    buyback_due_ton: bigint;
    flush_count: bigint;
    last_flush_amount: bigint;
}

export function storeM20TFeeAccumulatorHarnessStateView(src: M20TFeeAccumulatorHarnessStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.run_id, 257);
        b_0.storeAddress(src.controller_address);
        b_0.storeAddress(src.buyback_burn_address);
        const b_1 = new Builder();
        b_1.storeInt(src.buyback_due_ton, 257);
        b_1.storeInt(src.flush_count, 257);
        b_1.storeInt(src.last_flush_amount, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadM20TFeeAccumulatorHarnessStateView(slice: Slice) {
    const sc_0 = slice;
    const _run_id = sc_0.loadIntBig(257);
    const _controller_address = sc_0.loadAddress();
    const _buyback_burn_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _buyback_due_ton = sc_1.loadIntBig(257);
    const _flush_count = sc_1.loadIntBig(257);
    const _last_flush_amount = sc_1.loadIntBig(257);
    return { $$type: 'M20TFeeAccumulatorHarnessStateView' as const, run_id: _run_id, controller_address: _controller_address, buyback_burn_address: _buyback_burn_address, buyback_due_ton: _buyback_due_ton, flush_count: _flush_count, last_flush_amount: _last_flush_amount };
}

export function loadTupleM20TFeeAccumulatorHarnessStateView(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _controller_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _buyback_due_ton = source.readBigNumber();
    const _flush_count = source.readBigNumber();
    const _last_flush_amount = source.readBigNumber();
    return { $$type: 'M20TFeeAccumulatorHarnessStateView' as const, run_id: _run_id, controller_address: _controller_address, buyback_burn_address: _buyback_burn_address, buyback_due_ton: _buyback_due_ton, flush_count: _flush_count, last_flush_amount: _last_flush_amount };
}

export function loadGetterTupleM20TFeeAccumulatorHarnessStateView(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _controller_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _buyback_due_ton = source.readBigNumber();
    const _flush_count = source.readBigNumber();
    const _last_flush_amount = source.readBigNumber();
    return { $$type: 'M20TFeeAccumulatorHarnessStateView' as const, run_id: _run_id, controller_address: _controller_address, buyback_burn_address: _buyback_burn_address, buyback_due_ton: _buyback_due_ton, flush_count: _flush_count, last_flush_amount: _last_flush_amount };
}

export function storeTupleM20TFeeAccumulatorHarnessStateView(source: M20TFeeAccumulatorHarnessStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.run_id);
    builder.writeAddress(source.controller_address);
    builder.writeAddress(source.buyback_burn_address);
    builder.writeNumber(source.buyback_due_ton);
    builder.writeNumber(source.flush_count);
    builder.writeNumber(source.last_flush_amount);
    return builder.build();
}

export function dictValueParserM20TFeeAccumulatorHarnessStateView(): DictionaryValue<M20TFeeAccumulatorHarnessStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TFeeAccumulatorHarnessStateView(src)).endCell());
        },
        parse: (src) => {
            return loadM20TFeeAccumulatorHarnessStateView(src.loadRef().beginParse());
        }
    }
}

export type M20TFeeAccumulatorHarness$Data = {
    $$type: 'M20TFeeAccumulatorHarness$Data';
    run_id: bigint;
    controller_address: Address;
    buyback_burn_address: Address;
    buyback_due_ton: bigint;
    flush_count: bigint;
    last_flush_amount: bigint;
}

export function storeM20TFeeAccumulatorHarness$Data(src: M20TFeeAccumulatorHarness$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.run_id, 64);
        b_0.storeAddress(src.controller_address);
        b_0.storeAddress(src.buyback_burn_address);
        b_0.storeUint(src.buyback_due_ton, 128);
        b_0.storeUint(src.flush_count, 64);
        b_0.storeUint(src.last_flush_amount, 128);
    };
}

export function loadM20TFeeAccumulatorHarness$Data(slice: Slice) {
    const sc_0 = slice;
    const _run_id = sc_0.loadUintBig(64);
    const _controller_address = sc_0.loadAddress();
    const _buyback_burn_address = sc_0.loadAddress();
    const _buyback_due_ton = sc_0.loadUintBig(128);
    const _flush_count = sc_0.loadUintBig(64);
    const _last_flush_amount = sc_0.loadUintBig(128);
    return { $$type: 'M20TFeeAccumulatorHarness$Data' as const, run_id: _run_id, controller_address: _controller_address, buyback_burn_address: _buyback_burn_address, buyback_due_ton: _buyback_due_ton, flush_count: _flush_count, last_flush_amount: _last_flush_amount };
}

export function loadTupleM20TFeeAccumulatorHarness$Data(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _controller_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _buyback_due_ton = source.readBigNumber();
    const _flush_count = source.readBigNumber();
    const _last_flush_amount = source.readBigNumber();
    return { $$type: 'M20TFeeAccumulatorHarness$Data' as const, run_id: _run_id, controller_address: _controller_address, buyback_burn_address: _buyback_burn_address, buyback_due_ton: _buyback_due_ton, flush_count: _flush_count, last_flush_amount: _last_flush_amount };
}

export function loadGetterTupleM20TFeeAccumulatorHarness$Data(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _controller_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _buyback_due_ton = source.readBigNumber();
    const _flush_count = source.readBigNumber();
    const _last_flush_amount = source.readBigNumber();
    return { $$type: 'M20TFeeAccumulatorHarness$Data' as const, run_id: _run_id, controller_address: _controller_address, buyback_burn_address: _buyback_burn_address, buyback_due_ton: _buyback_due_ton, flush_count: _flush_count, last_flush_amount: _last_flush_amount };
}

export function storeTupleM20TFeeAccumulatorHarness$Data(source: M20TFeeAccumulatorHarness$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.run_id);
    builder.writeAddress(source.controller_address);
    builder.writeAddress(source.buyback_burn_address);
    builder.writeNumber(source.buyback_due_ton);
    builder.writeNumber(source.flush_count);
    builder.writeNumber(source.last_flush_amount);
    return builder.build();
}

export function dictValueParserM20TFeeAccumulatorHarness$Data(): DictionaryValue<M20TFeeAccumulatorHarness$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TFeeAccumulatorHarness$Data(src)).endCell());
        },
        parse: (src) => {
            return loadM20TFeeAccumulatorHarness$Data(src.loadRef().beginParse());
        }
    }
}

 type M20TFeeAccumulatorHarness_init_args = {
    $$type: 'M20TFeeAccumulatorHarness_init_args';
    controller_address: Address;
    buyback_burn_address: Address;
    initial_buyback_due_ton: bigint;
    run_id: bigint;
}

function initM20TFeeAccumulatorHarness_init_args(src: M20TFeeAccumulatorHarness_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.controller_address);
        b_0.storeAddress(src.buyback_burn_address);
        b_0.storeInt(src.initial_buyback_due_ton, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.run_id, 257);
        b_0.storeRef(b_1.endCell());
    };
}

async function M20TFeeAccumulatorHarness_init(controller_address: Address, buyback_burn_address: Address, initial_buyback_due_ton: bigint, run_id: bigint) {
    const __code = Cell.fromHex('b5ee9c7241020a010002c5000114ff00f4a413f4bcf2c80b01020162020802f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e10d33ffa40fa40d37fd33fd37f55506c168e37fa40fa40810101d700d401d0810101d7003014433004d1550281526e21c200f2f481526c2282180be2d12e80baf2f47054140010241023e207e3027026d74920c21f953106d31f07de210304009e058020d7217021d749c21f9430d31f01de8210594ba505ba8e32d37f013181528af84224c705f2f481528b21c200f2f4a010355512c87f01ca0055505056cb3f13cececb7fcb3fcb7fc9ed54e05f0702ea82104d325446ba8e275b3581526df84224c705f2f410355512c87f01ca0055505056cb3f13cececb7fcb3fcb7fc9ed54e0218210b3d2c52dbae3022182104d324657bae30237c00006c12116b08e208152cff2f010355512c87f01ca0055505056cb3f13cececb7fcb3fcb7fc9ed54e05f06f2c082050701f45b3604d37f30815276f84224c705f2f481527721c200f2f48152782182180be2d12e80baf2f48152795315bbf2f481527af8416f24135f0382082dc6c0bef2f45144a105a4247f7027c8018210594ba50558cb1fcb7fc925040955204343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103544030206002ec87f01ca0055505056cb3f13cececb7fcb3fcb7fc9ed5400da5b05d37fd37f30815280f84226c705f2f4815281f8416f24135f032282082dc6c0a0bef2f4707003c8018210594ba50558cb1fcb7fc92550444343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb3f13cececb7fcb3fcb7fc9ed5401b1a0a75bda89a1a400031c21a67ff481f481a6ffa67fa6feaaa0d82d1c6ff481f481020203ae01a803a1020203ae006028866009a2aa0502a4dc438401e5e902a4d845043017c5a25d0175e5e8e0a8280020482047c5b678d8cd09000c54754354754328151505');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initM20TFeeAccumulatorHarness_init_args({ $$type: 'M20TFeeAccumulatorHarness_init_args', controller_address, buyback_burn_address, initial_buyback_due_ton, run_id })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const M20TFeeAccumulatorHarness_errors = {
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

export const M20TFeeAccumulatorHarness_errors_backward = {
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

const M20TFeeAccumulatorHarness_types: ABIType[] = [
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
    {"name":"FlushBuybackDue","header":3016934701,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"AcceptBurnReserve","header":1498129669,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"M20TForwardWrongAcceptBurnReserve","header":1295140439,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"forward_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"M20TFeeHarnessTopUp","header":1295144006,"fields":[]},
    {"name":"M20TFeeAccumulatorHarnessStateView","header":null,"fields":[{"name":"run_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"buyback_burn_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"buyback_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_flush_amount","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"M20TFeeAccumulatorHarness$Data","header":null,"fields":[{"name":"run_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"buyback_burn_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"buyback_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_flush_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
]

const M20TFeeAccumulatorHarness_opcodes = {
    "FlushBuybackDue": 3016934701,
    "AcceptBurnReserve": 1498129669,
    "M20TForwardWrongAcceptBurnReserve": 1295140439,
    "M20TFeeHarnessTopUp": 1295144006,
}

const M20TFeeAccumulatorHarness_getters: ABIGetter[] = [
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"M20TFeeAccumulatorHarnessStateView","optional":false}},
]

export const M20TFeeAccumulatorHarness_getterMapping: { [key: string]: string } = {
    'get_state': 'getGetState',
}

const M20TFeeAccumulatorHarness_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"M20TFeeHarnessTopUp"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushBuybackDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"M20TForwardWrongAcceptBurnReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const M20T_FEE_HARNESS_FLUSH_EXEC_RESERVE = 3000000n;
export const M20T_FEE_HARNESS_BUYBACK_ENVELOPE_NANOTONS = 51050000000n;

export class M20TFeeAccumulatorHarness implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = M20TFeeAccumulatorHarness_errors_backward;
    public static readonly opcodes = M20TFeeAccumulatorHarness_opcodes;
    
    static async init(controller_address: Address, buyback_burn_address: Address, initial_buyback_due_ton: bigint, run_id: bigint) {
        return await M20TFeeAccumulatorHarness_init(controller_address, buyback_burn_address, initial_buyback_due_ton, run_id);
    }
    
    static async fromInit(controller_address: Address, buyback_burn_address: Address, initial_buyback_due_ton: bigint, run_id: bigint) {
        const __gen_init = await M20TFeeAccumulatorHarness_init(controller_address, buyback_burn_address, initial_buyback_due_ton, run_id);
        const address = contractAddress(0, __gen_init);
        return new M20TFeeAccumulatorHarness(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new M20TFeeAccumulatorHarness(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  M20TFeeAccumulatorHarness_types,
        getters: M20TFeeAccumulatorHarness_getters,
        receivers: M20TFeeAccumulatorHarness_receivers,
        errors: M20TFeeAccumulatorHarness_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: M20TFeeHarnessTopUp | FlushBuybackDue | M20TForwardWrongAcceptBurnReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'M20TFeeHarnessTopUp') {
            body = beginCell().store(storeM20TFeeHarnessTopUp(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushBuybackDue') {
            body = beginCell().store(storeFlushBuybackDue(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'M20TForwardWrongAcceptBurnReserve') {
            body = beginCell().store(storeM20TForwardWrongAcceptBurnReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_state', builder.build())).stack;
        const result = loadGetterTupleM20TFeeAccumulatorHarnessStateView(source);
        return result;
    }
    
}