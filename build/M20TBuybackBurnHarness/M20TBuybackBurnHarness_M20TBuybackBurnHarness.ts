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

export type M20TBindFeeAccumulator = {
    $$type: 'M20TBindFeeAccumulator';
    fee_accumulator_address: Address;
}

export function storeM20TBindFeeAccumulator(src: M20TBindFeeAccumulator) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1295134786, 32);
        b_0.storeAddress(src.fee_accumulator_address);
    };
}

export function loadM20TBindFeeAccumulator(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1295134786) { throw Error('Invalid prefix'); }
    const _fee_accumulator_address = sc_0.loadAddress();
    return { $$type: 'M20TBindFeeAccumulator' as const, fee_accumulator_address: _fee_accumulator_address };
}

export function loadTupleM20TBindFeeAccumulator(source: TupleReader) {
    const _fee_accumulator_address = source.readAddress();
    return { $$type: 'M20TBindFeeAccumulator' as const, fee_accumulator_address: _fee_accumulator_address };
}

export function loadGetterTupleM20TBindFeeAccumulator(source: TupleReader) {
    const _fee_accumulator_address = source.readAddress();
    return { $$type: 'M20TBindFeeAccumulator' as const, fee_accumulator_address: _fee_accumulator_address };
}

export function storeTupleM20TBindFeeAccumulator(source: M20TBindFeeAccumulator) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.fee_accumulator_address);
    return builder.build();
}

export function dictValueParserM20TBindFeeAccumulator(): DictionaryValue<M20TBindFeeAccumulator> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TBindFeeAccumulator(src)).endCell());
        },
        parse: (src) => {
            return loadM20TBindFeeAccumulator(src.loadRef().beginParse());
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

export type M20TBuybackHarnessTopUp = {
    $$type: 'M20TBuybackHarnessTopUp';
}

export function storeM20TBuybackHarnessTopUp(src: M20TBuybackHarnessTopUp) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1295144011, 32);
    };
}

export function loadM20TBuybackHarnessTopUp(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1295144011) { throw Error('Invalid prefix'); }
    return { $$type: 'M20TBuybackHarnessTopUp' as const };
}

export function loadTupleM20TBuybackHarnessTopUp(source: TupleReader) {
    return { $$type: 'M20TBuybackHarnessTopUp' as const };
}

export function loadGetterTupleM20TBuybackHarnessTopUp(source: TupleReader) {
    return { $$type: 'M20TBuybackHarnessTopUp' as const };
}

export function storeTupleM20TBuybackHarnessTopUp(source: M20TBuybackHarnessTopUp) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserM20TBuybackHarnessTopUp(): DictionaryValue<M20TBuybackHarnessTopUp> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TBuybackHarnessTopUp(src)).endCell());
        },
        parse: (src) => {
            return loadM20TBuybackHarnessTopUp(src.loadRef().beginParse());
        }
    }
}

export type M20TBuybackBurnHarnessStateView = {
    $$type: 'M20TBuybackBurnHarnessStateView';
    run_id: bigint;
    fee_bound: boolean;
    fee_accumulator_address: Address;
    accepted_count: bigint;
    total_accepted: bigint;
    last_amount: bigint;
}

export function storeM20TBuybackBurnHarnessStateView(src: M20TBuybackBurnHarnessStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.run_id, 257);
        b_0.storeBit(src.fee_bound);
        b_0.storeAddress(src.fee_accumulator_address);
        b_0.storeInt(src.accepted_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.total_accepted, 257);
        b_1.storeInt(src.last_amount, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadM20TBuybackBurnHarnessStateView(slice: Slice) {
    const sc_0 = slice;
    const _run_id = sc_0.loadIntBig(257);
    const _fee_bound = sc_0.loadBit();
    const _fee_accumulator_address = sc_0.loadAddress();
    const _accepted_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _total_accepted = sc_1.loadIntBig(257);
    const _last_amount = sc_1.loadIntBig(257);
    return { $$type: 'M20TBuybackBurnHarnessStateView' as const, run_id: _run_id, fee_bound: _fee_bound, fee_accumulator_address: _fee_accumulator_address, accepted_count: _accepted_count, total_accepted: _total_accepted, last_amount: _last_amount };
}

export function loadTupleM20TBuybackBurnHarnessStateView(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _fee_bound = source.readBoolean();
    const _fee_accumulator_address = source.readAddress();
    const _accepted_count = source.readBigNumber();
    const _total_accepted = source.readBigNumber();
    const _last_amount = source.readBigNumber();
    return { $$type: 'M20TBuybackBurnHarnessStateView' as const, run_id: _run_id, fee_bound: _fee_bound, fee_accumulator_address: _fee_accumulator_address, accepted_count: _accepted_count, total_accepted: _total_accepted, last_amount: _last_amount };
}

export function loadGetterTupleM20TBuybackBurnHarnessStateView(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _fee_bound = source.readBoolean();
    const _fee_accumulator_address = source.readAddress();
    const _accepted_count = source.readBigNumber();
    const _total_accepted = source.readBigNumber();
    const _last_amount = source.readBigNumber();
    return { $$type: 'M20TBuybackBurnHarnessStateView' as const, run_id: _run_id, fee_bound: _fee_bound, fee_accumulator_address: _fee_accumulator_address, accepted_count: _accepted_count, total_accepted: _total_accepted, last_amount: _last_amount };
}

export function storeTupleM20TBuybackBurnHarnessStateView(source: M20TBuybackBurnHarnessStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.run_id);
    builder.writeBoolean(source.fee_bound);
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeNumber(source.accepted_count);
    builder.writeNumber(source.total_accepted);
    builder.writeNumber(source.last_amount);
    return builder.build();
}

export function dictValueParserM20TBuybackBurnHarnessStateView(): DictionaryValue<M20TBuybackBurnHarnessStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TBuybackBurnHarnessStateView(src)).endCell());
        },
        parse: (src) => {
            return loadM20TBuybackBurnHarnessStateView(src.loadRef().beginParse());
        }
    }
}

export type M20TBuybackBurnHarness$Data = {
    $$type: 'M20TBuybackBurnHarness$Data';
    run_id: bigint;
    genesis_controller_address: Address;
    fee_accumulator_address: Address;
    fee_bound: boolean;
    accepted_count: bigint;
    total_accepted: bigint;
    last_amount: bigint;
}

export function storeM20TBuybackBurnHarness$Data(src: M20TBuybackBurnHarness$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.run_id, 64);
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeAddress(src.fee_accumulator_address);
        b_0.storeBit(src.fee_bound);
        b_0.storeUint(src.accepted_count, 64);
        b_0.storeUint(src.total_accepted, 128);
        b_0.storeUint(src.last_amount, 128);
    };
}

export function loadM20TBuybackBurnHarness$Data(slice: Slice) {
    const sc_0 = slice;
    const _run_id = sc_0.loadUintBig(64);
    const _genesis_controller_address = sc_0.loadAddress();
    const _fee_accumulator_address = sc_0.loadAddress();
    const _fee_bound = sc_0.loadBit();
    const _accepted_count = sc_0.loadUintBig(64);
    const _total_accepted = sc_0.loadUintBig(128);
    const _last_amount = sc_0.loadUintBig(128);
    return { $$type: 'M20TBuybackBurnHarness$Data' as const, run_id: _run_id, genesis_controller_address: _genesis_controller_address, fee_accumulator_address: _fee_accumulator_address, fee_bound: _fee_bound, accepted_count: _accepted_count, total_accepted: _total_accepted, last_amount: _last_amount };
}

export function loadTupleM20TBuybackBurnHarness$Data(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _fee_accumulator_address = source.readAddress();
    const _fee_bound = source.readBoolean();
    const _accepted_count = source.readBigNumber();
    const _total_accepted = source.readBigNumber();
    const _last_amount = source.readBigNumber();
    return { $$type: 'M20TBuybackBurnHarness$Data' as const, run_id: _run_id, genesis_controller_address: _genesis_controller_address, fee_accumulator_address: _fee_accumulator_address, fee_bound: _fee_bound, accepted_count: _accepted_count, total_accepted: _total_accepted, last_amount: _last_amount };
}

export function loadGetterTupleM20TBuybackBurnHarness$Data(source: TupleReader) {
    const _run_id = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _fee_accumulator_address = source.readAddress();
    const _fee_bound = source.readBoolean();
    const _accepted_count = source.readBigNumber();
    const _total_accepted = source.readBigNumber();
    const _last_amount = source.readBigNumber();
    return { $$type: 'M20TBuybackBurnHarness$Data' as const, run_id: _run_id, genesis_controller_address: _genesis_controller_address, fee_accumulator_address: _fee_accumulator_address, fee_bound: _fee_bound, accepted_count: _accepted_count, total_accepted: _total_accepted, last_amount: _last_amount };
}

export function storeTupleM20TBuybackBurnHarness$Data(source: M20TBuybackBurnHarness$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.run_id);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeBoolean(source.fee_bound);
    builder.writeNumber(source.accepted_count);
    builder.writeNumber(source.total_accepted);
    builder.writeNumber(source.last_amount);
    return builder.build();
}

export function dictValueParserM20TBuybackBurnHarness$Data(): DictionaryValue<M20TBuybackBurnHarness$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeM20TBuybackBurnHarness$Data(src)).endCell());
        },
        parse: (src) => {
            return loadM20TBuybackBurnHarness$Data(src.loadRef().beginParse());
        }
    }
}

 type M20TBuybackBurnHarness_init_args = {
    $$type: 'M20TBuybackBurnHarness_init_args';
    genesis_controller_address: Address;
    run_id: bigint;
}

function initM20TBuybackBurnHarness_init_args(src: M20TBuybackBurnHarness_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeInt(src.run_id, 257);
    };
}

async function M20TBuybackBurnHarness_init(genesis_controller_address: Address, run_id: bigint) {
    const __code = Cell.fromHex('b5ee9c72410209010001dd000114ff00f4a413f4bcf2c80b01020162020703f2d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e12d33ffa40fa40d200d33fd37fd37f55606c178e1cfa40810101d7005902d10181520c21c200f2f4217070530010561045e208925f08e07027d74920c21f953107d31f08de2182104d323042bae3022182104d32544bbae3022103040500865b3305fa4030815208f84225c705f2f481520902b312f2f481520a5313c705b3f2f4103544137f5520c87f01ca0055605067cb3f14ce12ceca00cb3fcb7fcb7fc9ed5400545b3681520bf84225c705f2f410465513c87f01ca0055605067cb3f14ce12ceca00cb3fcb7fcb7fc9ed5401d28210594ba505ba8e505f033604d37f3081521225f2f4815213f84223c705f2f48152142182180be2d12e80baf2f481521506c00016f2f42410351024714014c87f01ca0055605067cb3f14ce12ceca00cb3fcb7fcb7fc9ed54e038c00007c12117b0e3025f07f2c08206004681526bf2f010465513c87f01ca0055605067cb3f14ce12ceca00cb3fcb7fcb7fc9ed54017fa0a75bda89a1a400031c25a67ff481f481a401a67fa6ffa6feaac0d82f1c39f481020203ae00b205a20302a418438401e5e842e0e0a60020ac208bc5b678d8ed08000c547634547543f980489e');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initM20TBuybackBurnHarness_init_args({ $$type: 'M20TBuybackBurnHarness_init_args', genesis_controller_address, run_id })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const M20TBuybackBurnHarness_errors = {
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

export const M20TBuybackBurnHarness_errors_backward = {
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

const M20TBuybackBurnHarness_types: ABIType[] = [
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
    {"name":"M20TBindFeeAccumulator","header":1295134786,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AcceptBurnReserve","header":1498129669,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"M20TBuybackHarnessTopUp","header":1295144011,"fields":[]},
    {"name":"M20TBuybackBurnHarnessStateView","header":null,"fields":[{"name":"run_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"accepted_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"total_accepted","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_amount","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"M20TBuybackBurnHarness$Data","header":null,"fields":[{"name":"run_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"accepted_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"total_accepted","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"last_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
]

const M20TBuybackBurnHarness_opcodes = {
    "M20TBindFeeAccumulator": 1295134786,
    "AcceptBurnReserve": 1498129669,
    "M20TBuybackHarnessTopUp": 1295144011,
}

const M20TBuybackBurnHarness_getters: ABIGetter[] = [
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"M20TBuybackBurnHarnessStateView","optional":false}},
]

export const M20TBuybackBurnHarness_getterMapping: { [key: string]: string } = {
    'get_state': 'getGetState',
}

const M20TBuybackBurnHarness_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"M20TBindFeeAccumulator"}},
    {"receiver":"internal","message":{"kind":"typed","type":"M20TBuybackHarnessTopUp"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AcceptBurnReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const M20T_BUYBACK_ENVELOPE_NANOTONS = 51050000000n;

export class M20TBuybackBurnHarness implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = M20TBuybackBurnHarness_errors_backward;
    public static readonly opcodes = M20TBuybackBurnHarness_opcodes;
    
    static async init(genesis_controller_address: Address, run_id: bigint) {
        return await M20TBuybackBurnHarness_init(genesis_controller_address, run_id);
    }
    
    static async fromInit(genesis_controller_address: Address, run_id: bigint) {
        const __gen_init = await M20TBuybackBurnHarness_init(genesis_controller_address, run_id);
        const address = contractAddress(0, __gen_init);
        return new M20TBuybackBurnHarness(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new M20TBuybackBurnHarness(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  M20TBuybackBurnHarness_types,
        getters: M20TBuybackBurnHarness_getters,
        receivers: M20TBuybackBurnHarness_receivers,
        errors: M20TBuybackBurnHarness_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: M20TBindFeeAccumulator | M20TBuybackHarnessTopUp | AcceptBurnReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'M20TBindFeeAccumulator') {
            body = beginCell().store(storeM20TBindFeeAccumulator(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'M20TBuybackHarnessTopUp') {
            body = beginCell().store(storeM20TBuybackHarnessTopUp(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AcceptBurnReserve') {
            body = beginCell().store(storeAcceptBurnReserve(message)).endCell();
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
        const result = loadGetterTupleM20TBuybackBurnHarnessStateView(source);
        return result;
    }
    
}