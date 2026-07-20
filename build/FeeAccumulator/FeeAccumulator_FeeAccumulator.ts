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

export type SplitAccumulated = {
    $$type: 'SplitAccumulated';
}

export function storeSplitAccumulated(src: SplitAccumulated) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2066016771, 32);
    };
}

export function loadSplitAccumulated(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2066016771) { throw Error('Invalid prefix'); }
    return { $$type: 'SplitAccumulated' as const };
}

export function loadTupleSplitAccumulated(source: TupleReader) {
    return { $$type: 'SplitAccumulated' as const };
}

export function loadGetterTupleSplitAccumulated(source: TupleReader) {
    return { $$type: 'SplitAccumulated' as const };
}

export function storeTupleSplitAccumulated(source: SplitAccumulated) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserSplitAccumulated(): DictionaryValue<SplitAccumulated> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSplitAccumulated(src)).endCell());
        },
        parse: (src) => {
            return loadSplitAccumulated(src.loadRef().beginParse());
        }
    }
}

export type EnableBuybackSplit = {
    $$type: 'EnableBuybackSplit';
}

export function storeEnableBuybackSplit(src: EnableBuybackSplit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2374970392, 32);
    };
}

export function loadEnableBuybackSplit(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2374970392) { throw Error('Invalid prefix'); }
    return { $$type: 'EnableBuybackSplit' as const };
}

export function loadTupleEnableBuybackSplit(source: TupleReader) {
    return { $$type: 'EnableBuybackSplit' as const };
}

export function loadGetterTupleEnableBuybackSplit(source: TupleReader) {
    return { $$type: 'EnableBuybackSplit' as const };
}

export function storeTupleEnableBuybackSplit(source: EnableBuybackSplit) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserEnableBuybackSplit(): DictionaryValue<EnableBuybackSplit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEnableBuybackSplit(src)).endCell());
        },
        parse: (src) => {
            return loadEnableBuybackSplit(src.loadRef().beginParse());
        }
    }
}

export type FlushTreasuryDue = {
    $$type: 'FlushTreasuryDue';
    amount: bigint;
}

export function storeFlushTreasuryDue(src: FlushTreasuryDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3718989377, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadFlushTreasuryDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3718989377) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'FlushTreasuryDue' as const, amount: _amount };
}

export function loadTupleFlushTreasuryDue(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushTreasuryDue' as const, amount: _amount };
}

export function loadGetterTupleFlushTreasuryDue(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushTreasuryDue' as const, amount: _amount };
}

export function storeTupleFlushTreasuryDue(source: FlushTreasuryDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserFlushTreasuryDue(): DictionaryValue<FlushTreasuryDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushTreasuryDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushTreasuryDue(src.loadRef().beginParse());
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

export type TopUpStorageReserve = {
    $$type: 'TopUpStorageReserve';
}

export function storeTopUpStorageReserve(src: TopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2275594951, 32);
    };
}

export function loadTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2275594951) { throw Error('Invalid prefix'); }
    return { $$type: 'TopUpStorageReserve' as const };
}

export function loadTupleTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'TopUpStorageReserve' as const };
}

export function loadGetterTupleTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'TopUpStorageReserve' as const };
}

export function storeTupleTopUpStorageReserve(source: TopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserTopUpStorageReserve(): DictionaryValue<TopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type SweepUnaccounted = {
    $$type: 'SweepUnaccounted';
}

export function storeSweepUnaccounted(src: SweepUnaccounted) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1398232398, 32);
    };
}

export function loadSweepUnaccounted(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1398232398) { throw Error('Invalid prefix'); }
    return { $$type: 'SweepUnaccounted' as const };
}

export function loadTupleSweepUnaccounted(source: TupleReader) {
    return { $$type: 'SweepUnaccounted' as const };
}

export function loadGetterTupleSweepUnaccounted(source: TupleReader) {
    return { $$type: 'SweepUnaccounted' as const };
}

export function storeTupleSweepUnaccounted(source: SweepUnaccounted) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserSweepUnaccounted(): DictionaryValue<SweepUnaccounted> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSweepUnaccounted(src)).endCell());
        },
        parse: (src) => {
            return loadSweepUnaccounted(src.loadRef().beginParse());
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

export type DepositCapsuleFee = {
    $$type: 'DepositCapsuleFee';
    amount: bigint;
    write_pubkey: bigint;
    epoch: bigint;
    publisher: Address;
}

export function storeDepositCapsuleFee(src: DepositCapsuleFee) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191750, 32);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.write_pubkey, 256);
        b_0.storeUint(src.epoch, 32);
        b_0.storeAddress(src.publisher);
    };
}

export function loadDepositCapsuleFee(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191750) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    const _write_pubkey = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    const _publisher = sc_0.loadAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, write_pubkey: _write_pubkey, epoch: _epoch, publisher: _publisher };
}

export function loadTupleDepositCapsuleFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _write_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _publisher = source.readAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, write_pubkey: _write_pubkey, epoch: _epoch, publisher: _publisher };
}

export function loadGetterTupleDepositCapsuleFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _write_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _publisher = source.readAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, write_pubkey: _write_pubkey, epoch: _epoch, publisher: _publisher };
}

export function storeTupleDepositCapsuleFee(source: DepositCapsuleFee) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeNumber(source.write_pubkey);
    builder.writeNumber(source.epoch);
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

export type TicketCredit = {
    $$type: 'TicketCredit';
}

export function storeTicketCredit(src: TicketCredit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041265, 32);
    };
}

export function loadTicketCredit(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041265) { throw Error('Invalid prefix'); }
    return { $$type: 'TicketCredit' as const };
}

export function loadTupleTicketCredit(source: TupleReader) {
    return { $$type: 'TicketCredit' as const };
}

export function loadGetterTupleTicketCredit(source: TupleReader) {
    return { $$type: 'TicketCredit' as const };
}

export function storeTupleTicketCredit(source: TicketCredit) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserTicketCredit(): DictionaryValue<TicketCredit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketCredit(src)).endCell());
        },
        parse: (src) => {
            return loadTicketCredit(src.loadRef().beginParse());
        }
    }
}

export type TicketRedeem = {
    $$type: 'TicketRedeem';
    credits_k: bigint;
    owner: Address;
}

export function storeTicketRedeem(src: TicketRedeem) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041267, 32);
        b_0.storeUint(src.credits_k, 32);
        b_0.storeAddress(src.owner);
    };
}

export function loadTicketRedeem(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041267) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(32);
    const _owner = sc_0.loadAddress();
    return { $$type: 'TicketRedeem' as const, credits_k: _credits_k, owner: _owner };
}

export function loadTupleTicketRedeem(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _owner = source.readAddress();
    return { $$type: 'TicketRedeem' as const, credits_k: _credits_k, owner: _owner };
}

export function loadGetterTupleTicketRedeem(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _owner = source.readAddress();
    return { $$type: 'TicketRedeem' as const, credits_k: _credits_k, owner: _owner };
}

export function storeTupleTicketRedeem(source: TicketRedeem) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeAddress(source.owner);
    return builder.build();
}

export function dictValueParserTicketRedeem(): DictionaryValue<TicketRedeem> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketRedeem(src)).endCell());
        },
        parse: (src) => {
            return loadTicketRedeem(src.loadRef().beginParse());
        }
    }
}

export type TicketRedeemAck = {
    $$type: 'TicketRedeemAck';
    credits_k: bigint;
}

export function storeTicketRedeemAck(src: TicketRedeemAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041268, 32);
        b_0.storeUint(src.credits_k, 32);
    };
}

export function loadTicketRedeemAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041268) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(32);
    return { $$type: 'TicketRedeemAck' as const, credits_k: _credits_k };
}

export function loadTupleTicketRedeemAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    return { $$type: 'TicketRedeemAck' as const, credits_k: _credits_k };
}

export function loadGetterTupleTicketRedeemAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    return { $$type: 'TicketRedeemAck' as const, credits_k: _credits_k };
}

export function storeTupleTicketRedeemAck(source: TicketRedeemAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    return builder.build();
}

export function dictValueParserTicketRedeemAck(): DictionaryValue<TicketRedeemAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketRedeemAck(src)).endCell());
        },
        parse: (src) => {
            return loadTicketRedeemAck(src.loadRef().beginParse());
        }
    }
}

export type AirdropAccrue = {
    $$type: 'AirdropAccrue';
    purchase_id: bigint;
    buyer: Address;
    credits_k: bigint;
}

export function storeAirdropAccrue(src: AirdropAccrue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996496, 32);
        b_0.storeUint(src.purchase_id, 64);
        b_0.storeAddress(src.buyer);
        b_0.storeUint(src.credits_k, 32);
    };
}

export function loadAirdropAccrue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996496) { throw Error('Invalid prefix'); }
    const _purchase_id = sc_0.loadUintBig(64);
    const _buyer = sc_0.loadAddress();
    const _credits_k = sc_0.loadUintBig(32);
    return { $$type: 'AirdropAccrue' as const, purchase_id: _purchase_id, buyer: _buyer, credits_k: _credits_k };
}

export function loadTupleAirdropAccrue(source: TupleReader) {
    const _purchase_id = source.readBigNumber();
    const _buyer = source.readAddress();
    const _credits_k = source.readBigNumber();
    return { $$type: 'AirdropAccrue' as const, purchase_id: _purchase_id, buyer: _buyer, credits_k: _credits_k };
}

export function loadGetterTupleAirdropAccrue(source: TupleReader) {
    const _purchase_id = source.readBigNumber();
    const _buyer = source.readAddress();
    const _credits_k = source.readBigNumber();
    return { $$type: 'AirdropAccrue' as const, purchase_id: _purchase_id, buyer: _buyer, credits_k: _credits_k };
}

export function storeTupleAirdropAccrue(source: AirdropAccrue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.purchase_id);
    builder.writeAddress(source.buyer);
    builder.writeNumber(source.credits_k);
    return builder.build();
}

export function dictValueParserAirdropAccrue(): DictionaryValue<AirdropAccrue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropAccrue(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropAccrue(src.loadRef().beginParse());
        }
    }
}

export type BindShardCode = {
    $$type: 'BindShardCode';
    shard_code: Cell;
}

export function storeBindShardCode(src: BindShardCode) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4195418113, 32);
        b_0.storeRef(src.shard_code);
    };
}

export function loadBindShardCode(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4195418113) { throw Error('Invalid prefix'); }
    const _shard_code = sc_0.loadRef();
    return { $$type: 'BindShardCode' as const, shard_code: _shard_code };
}

export function loadTupleBindShardCode(source: TupleReader) {
    const _shard_code = source.readCell();
    return { $$type: 'BindShardCode' as const, shard_code: _shard_code };
}

export function loadGetterTupleBindShardCode(source: TupleReader) {
    const _shard_code = source.readCell();
    return { $$type: 'BindShardCode' as const, shard_code: _shard_code };
}

export function storeTupleBindShardCode(source: BindShardCode) {
    const builder = new TupleBuilder();
    builder.writeCell(source.shard_code);
    return builder.build();
}

export function dictValueParserBindShardCode(): DictionaryValue<BindShardCode> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindShardCode(src)).endCell());
        },
        parse: (src) => {
            return loadBindShardCode(src.loadRef().beginParse());
        }
    }
}

export type BindTicketCode = {
    $$type: 'BindTicketCode';
    ticket_code: Cell;
}

export function storeBindTicketCode(src: BindTicketCode) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4195418114, 32);
        b_0.storeRef(src.ticket_code);
    };
}

export function loadBindTicketCode(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4195418114) { throw Error('Invalid prefix'); }
    const _ticket_code = sc_0.loadRef();
    return { $$type: 'BindTicketCode' as const, ticket_code: _ticket_code };
}

export function loadTupleBindTicketCode(source: TupleReader) {
    const _ticket_code = source.readCell();
    return { $$type: 'BindTicketCode' as const, ticket_code: _ticket_code };
}

export function loadGetterTupleBindTicketCode(source: TupleReader) {
    const _ticket_code = source.readCell();
    return { $$type: 'BindTicketCode' as const, ticket_code: _ticket_code };
}

export function storeTupleBindTicketCode(source: BindTicketCode) {
    const builder = new TupleBuilder();
    builder.writeCell(source.ticket_code);
    return builder.build();
}

export function dictValueParserBindTicketCode(): DictionaryValue<BindTicketCode> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindTicketCode(src)).endCell());
        },
        parse: (src) => {
            return loadBindTicketCode(src.loadRef().beginParse());
        }
    }
}

export type BindAirdropPool = {
    $$type: 'BindAirdropPool';
    airdrop_pool_address: Address;
}

export function storeBindAirdropPool(src: BindAirdropPool) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4195418115, 32);
        b_0.storeAddress(src.airdrop_pool_address);
    };
}

export function loadBindAirdropPool(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4195418115) { throw Error('Invalid prefix'); }
    const _airdrop_pool_address = sc_0.loadAddress();
    return { $$type: 'BindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function loadTupleBindAirdropPool(source: TupleReader) {
    const _airdrop_pool_address = source.readAddress();
    return { $$type: 'BindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function loadGetterTupleBindAirdropPool(source: TupleReader) {
    const _airdrop_pool_address = source.readAddress();
    return { $$type: 'BindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function storeTupleBindAirdropPool(source: BindAirdropPool) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.airdrop_pool_address);
    return builder.build();
}

export function dictValueParserBindAirdropPool(): DictionaryValue<BindAirdropPool> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindAirdropPool(src)).endCell());
        },
        parse: (src) => {
            return loadBindAirdropPool(src.loadRef().beginParse());
        }
    }
}

export type FeeAccumulatorStateView = {
    $$type: 'FeeAccumulatorStateView';
    accumulated_ton: bigint;
    treasury_due_ton: bigint;
    buyback_due_ton: bigint;
    buyback_split_enabled: boolean;
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    storage_reserve_ton: bigint;
}

export function storeFeeAccumulatorStateView(src: FeeAccumulatorStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.accumulated_ton, 257);
        b_0.storeInt(src.treasury_due_ton, 257);
        b_0.storeInt(src.buyback_due_ton, 257);
        b_0.storeBit(src.buyback_split_enabled);
        const b_1 = new Builder();
        b_1.storeAddress(src.treasury_receiver_address);
        b_1.storeAddress(src.buyback_burn_address);
        b_1.storeInt(src.storage_reserve_ton, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadFeeAccumulatorStateView(slice: Slice) {
    const sc_0 = slice;
    const _accumulated_ton = sc_0.loadIntBig(257);
    const _treasury_due_ton = sc_0.loadIntBig(257);
    const _buyback_due_ton = sc_0.loadIntBig(257);
    const _buyback_split_enabled = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _treasury_receiver_address = sc_1.loadAddress();
    const _buyback_burn_address = sc_1.loadAddress();
    const _storage_reserve_ton = sc_1.loadIntBig(257);
    return { $$type: 'FeeAccumulatorStateView' as const, accumulated_ton: _accumulated_ton, treasury_due_ton: _treasury_due_ton, buyback_due_ton: _buyback_due_ton, buyback_split_enabled: _buyback_split_enabled, treasury_receiver_address: _treasury_receiver_address, buyback_burn_address: _buyback_burn_address, storage_reserve_ton: _storage_reserve_ton };
}

export function loadTupleFeeAccumulatorStateView(source: TupleReader) {
    const _accumulated_ton = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _buyback_due_ton = source.readBigNumber();
    const _buyback_split_enabled = source.readBoolean();
    const _treasury_receiver_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _storage_reserve_ton = source.readBigNumber();
    return { $$type: 'FeeAccumulatorStateView' as const, accumulated_ton: _accumulated_ton, treasury_due_ton: _treasury_due_ton, buyback_due_ton: _buyback_due_ton, buyback_split_enabled: _buyback_split_enabled, treasury_receiver_address: _treasury_receiver_address, buyback_burn_address: _buyback_burn_address, storage_reserve_ton: _storage_reserve_ton };
}

export function loadGetterTupleFeeAccumulatorStateView(source: TupleReader) {
    const _accumulated_ton = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _buyback_due_ton = source.readBigNumber();
    const _buyback_split_enabled = source.readBoolean();
    const _treasury_receiver_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _storage_reserve_ton = source.readBigNumber();
    return { $$type: 'FeeAccumulatorStateView' as const, accumulated_ton: _accumulated_ton, treasury_due_ton: _treasury_due_ton, buyback_due_ton: _buyback_due_ton, buyback_split_enabled: _buyback_split_enabled, treasury_receiver_address: _treasury_receiver_address, buyback_burn_address: _buyback_burn_address, storage_reserve_ton: _storage_reserve_ton };
}

export function storeTupleFeeAccumulatorStateView(source: FeeAccumulatorStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.accumulated_ton);
    builder.writeNumber(source.treasury_due_ton);
    builder.writeNumber(source.buyback_due_ton);
    builder.writeBoolean(source.buyback_split_enabled);
    builder.writeAddress(source.treasury_receiver_address);
    builder.writeAddress(source.buyback_burn_address);
    builder.writeNumber(source.storage_reserve_ton);
    return builder.build();
}

export function dictValueParserFeeAccumulatorStateView(): DictionaryValue<FeeAccumulatorStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFeeAccumulatorStateView(src)).endCell());
        },
        parse: (src) => {
            return loadFeeAccumulatorStateView(src.loadRef().beginParse());
        }
    }
}

export type FeeAccumulator$Data = {
    $$type: 'FeeAccumulator$Data';
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
    accumulated_ton: bigint;
    treasury_due_ton: bigint;
    buyback_due_ton: bigint;
    buyback_split_enabled: boolean;
    storage_reserve_ton: bigint;
    shard_code: Cell | null;
    ticket_code: Cell | null;
    airdrop_pool_address: Address | null;
    accrual_seq: bigint;
}

export function storeFeeAccumulator$Data(src: FeeAccumulator$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.treasury_receiver_address);
        b_0.storeAddress(src.buyback_burn_address);
        b_0.storeUint(src.accumulated_ton, 128);
        b_0.storeUint(src.treasury_due_ton, 128);
        b_0.storeUint(src.buyback_due_ton, 128);
        b_0.storeBit(src.buyback_split_enabled);
        const b_1 = new Builder();
        b_1.storeCoins(src.storage_reserve_ton);
        if (src.shard_code !== null && src.shard_code !== undefined) { b_1.storeBit(true).storeRef(src.shard_code); } else { b_1.storeBit(false); }
        if (src.ticket_code !== null && src.ticket_code !== undefined) { b_1.storeBit(true).storeRef(src.ticket_code); } else { b_1.storeBit(false); }
        b_1.storeAddress(src.airdrop_pool_address);
        b_1.storeUint(src.accrual_seq, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadFeeAccumulator$Data(slice: Slice) {
    const sc_0 = slice;
    const _treasury_receiver_address = sc_0.loadAddress();
    const _buyback_burn_address = sc_0.loadAddress();
    const _accumulated_ton = sc_0.loadUintBig(128);
    const _treasury_due_ton = sc_0.loadUintBig(128);
    const _buyback_due_ton = sc_0.loadUintBig(128);
    const _buyback_split_enabled = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _storage_reserve_ton = sc_1.loadCoins();
    const _shard_code = sc_1.loadBit() ? sc_1.loadRef() : null;
    const _ticket_code = sc_1.loadBit() ? sc_1.loadRef() : null;
    const _airdrop_pool_address = sc_1.loadMaybeAddress();
    const _accrual_seq = sc_1.loadUintBig(64);
    return { $$type: 'FeeAccumulator$Data' as const, treasury_receiver_address: _treasury_receiver_address, buyback_burn_address: _buyback_burn_address, accumulated_ton: _accumulated_ton, treasury_due_ton: _treasury_due_ton, buyback_due_ton: _buyback_due_ton, buyback_split_enabled: _buyback_split_enabled, storage_reserve_ton: _storage_reserve_ton, shard_code: _shard_code, ticket_code: _ticket_code, airdrop_pool_address: _airdrop_pool_address, accrual_seq: _accrual_seq };
}

export function loadTupleFeeAccumulator$Data(source: TupleReader) {
    const _treasury_receiver_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _accumulated_ton = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _buyback_due_ton = source.readBigNumber();
    const _buyback_split_enabled = source.readBoolean();
    const _storage_reserve_ton = source.readBigNumber();
    const _shard_code = source.readCellOpt();
    const _ticket_code = source.readCellOpt();
    const _airdrop_pool_address = source.readAddressOpt();
    const _accrual_seq = source.readBigNumber();
    return { $$type: 'FeeAccumulator$Data' as const, treasury_receiver_address: _treasury_receiver_address, buyback_burn_address: _buyback_burn_address, accumulated_ton: _accumulated_ton, treasury_due_ton: _treasury_due_ton, buyback_due_ton: _buyback_due_ton, buyback_split_enabled: _buyback_split_enabled, storage_reserve_ton: _storage_reserve_ton, shard_code: _shard_code, ticket_code: _ticket_code, airdrop_pool_address: _airdrop_pool_address, accrual_seq: _accrual_seq };
}

export function loadGetterTupleFeeAccumulator$Data(source: TupleReader) {
    const _treasury_receiver_address = source.readAddress();
    const _buyback_burn_address = source.readAddress();
    const _accumulated_ton = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _buyback_due_ton = source.readBigNumber();
    const _buyback_split_enabled = source.readBoolean();
    const _storage_reserve_ton = source.readBigNumber();
    const _shard_code = source.readCellOpt();
    const _ticket_code = source.readCellOpt();
    const _airdrop_pool_address = source.readAddressOpt();
    const _accrual_seq = source.readBigNumber();
    return { $$type: 'FeeAccumulator$Data' as const, treasury_receiver_address: _treasury_receiver_address, buyback_burn_address: _buyback_burn_address, accumulated_ton: _accumulated_ton, treasury_due_ton: _treasury_due_ton, buyback_due_ton: _buyback_due_ton, buyback_split_enabled: _buyback_split_enabled, storage_reserve_ton: _storage_reserve_ton, shard_code: _shard_code, ticket_code: _ticket_code, airdrop_pool_address: _airdrop_pool_address, accrual_seq: _accrual_seq };
}

export function storeTupleFeeAccumulator$Data(source: FeeAccumulator$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.treasury_receiver_address);
    builder.writeAddress(source.buyback_burn_address);
    builder.writeNumber(source.accumulated_ton);
    builder.writeNumber(source.treasury_due_ton);
    builder.writeNumber(source.buyback_due_ton);
    builder.writeBoolean(source.buyback_split_enabled);
    builder.writeNumber(source.storage_reserve_ton);
    builder.writeCell(source.shard_code);
    builder.writeCell(source.ticket_code);
    builder.writeAddress(source.airdrop_pool_address);
    builder.writeNumber(source.accrual_seq);
    return builder.build();
}

export function dictValueParserFeeAccumulator$Data(): DictionaryValue<FeeAccumulator$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFeeAccumulator$Data(src)).endCell());
        },
        parse: (src) => {
            return loadFeeAccumulator$Data(src.loadRef().beginParse());
        }
    }
}

 type FeeAccumulator_init_args = {
    $$type: 'FeeAccumulator_init_args';
    treasury_receiver_address: Address;
    buyback_burn_address: Address;
}

function initFeeAccumulator_init_args(src: FeeAccumulator_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.treasury_receiver_address);
        b_0.storeAddress(src.buyback_burn_address);
    };
}

async function FeeAccumulator_init(treasury_receiver_address: Address, buyback_burn_address: Address) {
    const __code = Cell.fromHex('b5ee9c7241021d0100094e000114ff00f4a413f4bcf2c80b01020162021b03f2d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e31fa40fa40d37fd37fd37fd200d401d0fa00f404f404d72c01916d93fa4001e201d33f30105b105a10591058105710566c1b8e18fa40fa405902d1016d6d6d70547000201037461340057005e20ce302702bd74920c21fe3002103040500ec0a8020d7217021d749c21f9430d31f01de8210594ba505ba8e59d37f0131813ab8f8422ac705f2f4813ab921c200f2f415a0108a1079106810570610354430c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54e05f0c000a310bd31f0c02fe8210ff775609ba8e645b0ad37f30813a9921c200f2f4813a9af8416f24135f03228208061a80a0bef2f417a0108a1079081057104610354430c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54e0218210fa110001bae302218210fa110002060701c25b0ad430109a108910781067105610451034413bdb3c813acb046e14f2f4109a10891078106710561045103458c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed540904f6ba8ee25b0ad430109a108910781067105610451034413bdb3c813acc036e13f2f4109a1089107810671056104510344300c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54e0218210fa110003bae30221821052535046bae3022109080a0d01c65b0afa4030109a108910781067105610451034413bdb3c813acd026e12f2f4109a1089107810671056104510344130c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54090014813acaf8422cc705f2f403ea5b0ad37fd3ffd31ffa4030813ace24c200f2f4813acf266eb38e9ff84210ce5e3a109d108e107d106e105d104e103f0211100250efdb3c1ec7059d6c2250db4ac948174615443370e21cf2f4813ad0f8416f24135f032b8208124f80a0bef2f45069a0286eb3913be30d106a5e35103746145520050b0c19012ac87001cb0012810101cf00810101cf00c95240db3c1001fcc87001cb002ccf16c9108b107a19105810471036453c4440db3c82080927c071706f00c8013082104154433101cb1fc9104510344130270211110110464515504403c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00107a107908451550440706030f044a821041544333bae3022182107b24ea03bae3022182108d8f2c18bae302218210ddab4641ba0e12141502fe5b0ad31ffa4030813ad4236eb3932c6eb39170e2f2f4813ad5f84210ac5e38107b106c105b104c103b4cde2cdb3c1fc7051df2f4813ad62ac200f2f4813ad7f8416f24135f03820bb20b80bef2f40ca4820b93870071227f51edc855208210414452105004cb1f12cb3fcecb1fc92e0450ee441359c8cf8580ca00cf8440ce0f11011ac87001cb0001cf16c95230db3c10005a705920f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d000fa01fa02806acf40f400c901fb00f842708040700cc80182104154433458cb1fcb1fc9103441301c441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00106a105910485533c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed5401fc5b3a813aa227c200f2f4813aa3f8416f24135f0382081e8480bef2f4238e46057007a0108a107910680710461035440302c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54e126811388a8812710a9045177a1067008a05056a0108a107913007a106810570610354430c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed5400e85b3a813aa4f8422ac705f2f4813aa504b314f2f4813aa6f8416f24135f0382081e8480bef2f425c200965045a0705045de107910681057104610357f44554313c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed5404fe8ee05b0ad37f30813aac21c200f2f4813aad5317bbf2f4813aaf2182084c4b40be917f935317bae2f2f4813aaef8416f24135f0382084c4b40bef2f45166a170544a88716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00108a5517e0218210b3d2c52dbae3023c20821087a2d2c7bae3022082105357554e1916171801e25b0ad37f30813ab621c200f2f4813aba2182180be2d12e80baf2f4813ab75316bbf2f4813abbf8416f24135f0382086acfc0bef2f45155a12582081e8480a07f7108c8018210594ba50558cb1fcb7fc92b0450994343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00108a551719009a303af8416f24135f0313a0108a107910681057104610355034c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed5402feba8ef5303af8276f10f8416f24135f03a15376a026a024a0813ac02182080f4240a05230bcf2f45210a182080f4240a118a00772fb02f8427081008270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00108a5517e0c0000bc1211b191a0068c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54008cb08e3d813afbf2f0108a5517c87f01ca0055a050abce18ce16cb7f14cb7f12cb7fca00c858fa0212f40012f40058206e9430cf84809201cee212cb3fcdc9ed54e05f0bf2c08201b5a0a75bda89a1a400031c63f481f481a6ffa6ffa6ffa401a803a1f401e809e809ae580322db27f48003c403a67e6020b620b420b220b020ae20acd8371c31f481f480b205a202dadadae0a8e00040206e8c26800ae00bc5b678d96f1c000e5478765478dc2afbe3b130');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initFeeAccumulator_init_args({ $$type: 'FeeAccumulator_init_args', treasury_receiver_address, buyback_burn_address })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const FeeAccumulator_errors = {
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

export const FeeAccumulator_errors_backward = {
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

const FeeAccumulator_types: ABIType[] = [
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
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"SplitAccumulated","header":2066016771,"fields":[]},
    {"name":"EnableBuybackSplit","header":2374970392,"fields":[]},
    {"name":"FlushTreasuryDue","header":3718989377,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"FlushBuybackDue","header":3016934701,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"TopUpStorageReserve","header":2275594951,"fields":[]},
    {"name":"SweepUnaccounted","header":1398232398,"fields":[]},
    {"name":"AcceptBurnReserve","header":1498129669,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"DepositCapsuleFee","header":1381191750,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"write_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"publisher","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TicketCredit","header":1096041265,"fields":[]},
    {"name":"TicketRedeem","header":1096041267,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TicketRedeemAck","header":1096041268,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"AirdropAccrue","header":1094996496,"fields":[{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"BindShardCode","header":4195418113,"fields":[{"name":"shard_code","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"BindTicketCode","header":4195418114,"fields":[{"name":"ticket_code","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"BindAirdropPool","header":4195418115,"fields":[{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"FeeAccumulatorStateView","header":null,"fields":[{"name":"accumulated_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"buyback_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"buyback_split_enabled","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"buyback_burn_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"storage_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"FeeAccumulator$Data","header":null,"fields":[{"name":"treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"buyback_burn_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"accumulated_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"treasury_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"buyback_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"buyback_split_enabled","type":{"kind":"simple","type":"bool","optional":false}},{"name":"storage_reserve_ton","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"shard_code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"ticket_code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":true}},{"name":"accrual_seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const FeeAccumulator_opcodes = {
    "DepositProtocolFee": 4286010889,
    "SplitAccumulated": 2066016771,
    "EnableBuybackSplit": 2374970392,
    "FlushTreasuryDue": 3718989377,
    "FlushBuybackDue": 3016934701,
    "TopUpStorageReserve": 2275594951,
    "SweepUnaccounted": 1398232398,
    "AcceptBurnReserve": 1498129669,
    "DepositCapsuleFee": 1381191750,
    "TicketCredit": 1096041265,
    "TicketRedeem": 1096041267,
    "TicketRedeemAck": 1096041268,
    "AirdropAccrue": 1094996496,
    "BindShardCode": 4195418113,
    "BindTicketCode": 4195418114,
    "BindAirdropPool": 4195418115,
}

const FeeAccumulator_getters: ABIGetter[] = [
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"FeeAccumulatorStateView","optional":false}},
]

export const FeeAccumulator_getterMapping: { [key: string]: string } = {
    'get_state': 'getGetState',
}

const FeeAccumulator_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"DepositProtocolFee"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindShardCode"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindTicketCode"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindAirdropPool"}},
    {"receiver":"internal","message":{"kind":"typed","type":"DepositCapsuleFee"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TicketRedeem"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SplitAccumulated"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EnableBuybackSplit"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushTreasuryDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushBuybackDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SweepUnaccounted"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const SPLIT_BASE_BPS = 10000n;
export const TREASURY_SHARE_BPS = 5000n;
export const FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 400000n;
export const FEEACCUMULATOR_STORAGE_FLOOR = 1000000n;
export const FEEACCUMULATOR_SPLIT_EXEC_RESERVE = 2000000n;
export const FEEACCUMULATOR_FLUSH_EXEC_RESERVE = 5000000n;
export const FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON = 5000000n;
export const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE = 2000000n;
export const BUYBACK_FUNDING_ENVELOPE_NANOTONS = 51050000000n;
export const FEEACCUMULATOR_CAPSULE_FEE_EXEC_RESERVE = 1200000n;
export const FEEACCUMULATOR_TICKET_CREDIT_VALUE = 600000n;
export const FEEACCUMULATOR_ACCRUE_LEG_VALUE = 60000000n;
export const FEEACCUMULATOR_REDEEM_EXEC_RESERVE = 2000000n;

export class FeeAccumulator implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = FeeAccumulator_errors_backward;
    public static readonly opcodes = FeeAccumulator_opcodes;
    
    static async init(treasury_receiver_address: Address, buyback_burn_address: Address) {
        return await FeeAccumulator_init(treasury_receiver_address, buyback_burn_address);
    }
    
    static async fromInit(treasury_receiver_address: Address, buyback_burn_address: Address) {
        const __gen_init = await FeeAccumulator_init(treasury_receiver_address, buyback_burn_address);
        const address = contractAddress(0, __gen_init);
        return new FeeAccumulator(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new FeeAccumulator(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  FeeAccumulator_types,
        getters: FeeAccumulator_getters,
        receivers: FeeAccumulator_receivers,
        errors: FeeAccumulator_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: DepositProtocolFee | BindShardCode | BindTicketCode | BindAirdropPool | DepositCapsuleFee | TicketRedeem | SplitAccumulated | EnableBuybackSplit | FlushTreasuryDue | FlushBuybackDue | TopUpStorageReserve | SweepUnaccounted | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'DepositProtocolFee') {
            body = beginCell().store(storeDepositProtocolFee(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindShardCode') {
            body = beginCell().store(storeBindShardCode(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindTicketCode') {
            body = beginCell().store(storeBindTicketCode(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindAirdropPool') {
            body = beginCell().store(storeBindAirdropPool(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'DepositCapsuleFee') {
            body = beginCell().store(storeDepositCapsuleFee(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TicketRedeem') {
            body = beginCell().store(storeTicketRedeem(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SplitAccumulated') {
            body = beginCell().store(storeSplitAccumulated(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EnableBuybackSplit') {
            body = beginCell().store(storeEnableBuybackSplit(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushTreasuryDue') {
            body = beginCell().store(storeFlushTreasuryDue(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushBuybackDue') {
            body = beginCell().store(storeFlushBuybackDue(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpStorageReserve') {
            body = beginCell().store(storeTopUpStorageReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SweepUnaccounted') {
            body = beginCell().store(storeSweepUnaccounted(message)).endCell();
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
        const result = loadGetterTupleFeeAccumulatorStateView(source);
        return result;
    }
    
}