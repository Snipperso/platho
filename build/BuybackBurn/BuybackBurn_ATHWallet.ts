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

export type ATHBurn = {
    $$type: 'ATHBurn';
    query_id: bigint;
    amount: bigint;
    response_destination: Address;
}

export function storeATHBurn(src: ATHBurn) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042497, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.response_destination);
    };
}

export function loadATHBurn(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042497) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _response_destination = sc_0.loadAddress();
    return { $$type: 'ATHBurn' as const, query_id: _query_id, amount: _amount, response_destination: _response_destination };
}

export function loadTupleATHBurn(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHBurn' as const, query_id: _query_id, amount: _amount, response_destination: _response_destination };
}

export function loadGetterTupleATHBurn(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHBurn' as const, query_id: _query_id, amount: _amount, response_destination: _response_destination };
}

export function storeTupleATHBurn(source: ATHBurn) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.response_destination);
    return builder.build();
}

export function dictValueParserATHBurn(): DictionaryValue<ATHBurn> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHBurn(src)).endCell());
        },
        parse: (src) => {
            return loadATHBurn(src.loadRef().beginParse());
        }
    }
}

export type ATHBurnNotification = {
    $$type: 'ATHBurnNotification';
    query_id: bigint;
    amount: bigint;
    owner_address: Address;
    response_destination: Address;
}

export function storeATHBurnNotification(src: ATHBurnNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042498, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.response_destination);
    };
}

export function loadATHBurnNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042498) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    return { $$type: 'ATHBurnNotification' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address, response_destination: _response_destination };
}

export function loadTupleATHBurnNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHBurnNotification' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address, response_destination: _response_destination };
}

export function loadGetterTupleATHBurnNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHBurnNotification' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address, response_destination: _response_destination };
}

export function storeTupleATHBurnNotification(source: ATHBurnNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.response_destination);
    return builder.build();
}

export function dictValueParserATHBurnNotification(): DictionaryValue<ATHBurnNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHBurnNotification(src)).endCell());
        },
        parse: (src) => {
            return loadATHBurnNotification(src.loadRef().beginParse());
        }
    }
}

export type ATHBurnFinalized = {
    $$type: 'ATHBurnFinalized';
    query_id: bigint;
    amount: bigint;
    owner_address: Address;
}

export function storeATHBurnFinalized(src: ATHBurnFinalized) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042499, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.owner_address);
    };
}

export function loadATHBurnFinalized(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042499) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    return { $$type: 'ATHBurnFinalized' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address };
}

export function loadTupleATHBurnFinalized(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_address = source.readAddress();
    return { $$type: 'ATHBurnFinalized' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address };
}

export function loadGetterTupleATHBurnFinalized(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_address = source.readAddress();
    return { $$type: 'ATHBurnFinalized' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address };
}

export function storeTupleATHBurnFinalized(source: ATHBurnFinalized) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.owner_address);
    return builder.build();
}

export function dictValueParserATHBurnFinalized(): DictionaryValue<ATHBurnFinalized> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHBurnFinalized(src)).endCell());
        },
        parse: (src) => {
            return loadATHBurnFinalized(src.loadRef().beginParse());
        }
    }
}

export type ATHBurnFailed = {
    $$type: 'ATHBurnFailed';
    query_id: bigint;
    amount: bigint;
}

export function storeATHBurnFailed(src: ATHBurnFailed) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042500, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadATHBurnFailed(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042500) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'ATHBurnFailed' as const, query_id: _query_id, amount: _amount };
}

export function loadTupleATHBurnFailed(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'ATHBurnFailed' as const, query_id: _query_id, amount: _amount };
}

export function loadGetterTupleATHBurnFailed(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'ATHBurnFailed' as const, query_id: _query_id, amount: _amount };
}

export function storeTupleATHBurnFailed(source: ATHBurnFailed) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserATHBurnFailed(): DictionaryValue<ATHBurnFailed> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHBurnFailed(src)).endCell());
        },
        parse: (src) => {
            return loadATHBurnFailed(src.loadRef().beginParse());
        }
    }
}

export type ATHGenesisSupplyCredit = {
    $$type: 'ATHGenesisSupplyCredit';
    query_id: bigint;
    amount: bigint;
    response_destination: Address;
}

export function storeATHGenesisSupplyCredit(src: ATHGenesisSupplyCredit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042501, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.response_destination);
    };
}

export function loadATHGenesisSupplyCredit(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042501) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _response_destination = sc_0.loadAddress();
    return { $$type: 'ATHGenesisSupplyCredit' as const, query_id: _query_id, amount: _amount, response_destination: _response_destination };
}

export function loadTupleATHGenesisSupplyCredit(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHGenesisSupplyCredit' as const, query_id: _query_id, amount: _amount, response_destination: _response_destination };
}

export function loadGetterTupleATHGenesisSupplyCredit(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHGenesisSupplyCredit' as const, query_id: _query_id, amount: _amount, response_destination: _response_destination };
}

export function storeTupleATHGenesisSupplyCredit(source: ATHGenesisSupplyCredit) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.response_destination);
    return builder.build();
}

export function dictValueParserATHGenesisSupplyCredit(): DictionaryValue<ATHGenesisSupplyCredit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHGenesisSupplyCredit(src)).endCell());
        },
        parse: (src) => {
            return loadATHGenesisSupplyCredit(src.loadRef().beginParse());
        }
    }
}

export type ATHGenesisSupplyAck = {
    $$type: 'ATHGenesisSupplyAck';
    query_id: bigint;
    amount: bigint;
    owner_address: Address;
}

export function storeATHGenesisSupplyAck(src: ATHGenesisSupplyAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042502, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.owner_address);
    };
}

export function loadATHGenesisSupplyAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042502) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    return { $$type: 'ATHGenesisSupplyAck' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address };
}

export function loadTupleATHGenesisSupplyAck(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_address = source.readAddress();
    return { $$type: 'ATHGenesisSupplyAck' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address };
}

export function loadGetterTupleATHGenesisSupplyAck(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_address = source.readAddress();
    return { $$type: 'ATHGenesisSupplyAck' as const, query_id: _query_id, amount: _amount, owner_address: _owner_address };
}

export function storeTupleATHGenesisSupplyAck(source: ATHGenesisSupplyAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.owner_address);
    return builder.build();
}

export function dictValueParserATHGenesisSupplyAck(): DictionaryValue<ATHGenesisSupplyAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHGenesisSupplyAck(src)).endCell());
        },
        parse: (src) => {
            return loadATHGenesisSupplyAck(src.loadRef().beginParse());
        }
    }
}

export type AthTransferNotification = {
    $$type: 'AthTransferNotification';
    query_id: bigint;
    amount: bigint;
    sender_key: bigint;
    sender_wallet: Address;
}

export function storeAthTransferNotification(src: AthTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1194171773, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.sender_key, 32);
        b_0.storeAddress(src.sender_wallet);
    };
}

export function loadAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1194171773) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_key = sc_0.loadUintBig(32);
    const _sender_wallet = sc_0.loadAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, sender_wallet: _sender_wallet };
}

export function loadTupleAthTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _sender_wallet = source.readAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, sender_wallet: _sender_wallet };
}

export function loadGetterTupleAthTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _sender_wallet = source.readAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, sender_wallet: _sender_wallet };
}

export function storeTupleAthTransferNotification(source: AthTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.sender_key);
    builder.writeAddress(source.sender_wallet);
    return builder.build();
}

export function dictValueParserAthTransferNotification(): DictionaryValue<AthTransferNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotification(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotification(src.loadRef().beginParse());
        }
    }
}

export type AthTransferNotificationAck = {
    $$type: 'AthTransferNotificationAck';
    query_id: bigint;
    amount: bigint;
    sender_key: bigint;
}

export function storeAthTransferNotificationAck(src: AthTransferNotificationAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1194171774, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.sender_key, 32);
    };
}

export function loadAthTransferNotificationAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1194171774) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_key = sc_0.loadUintBig(32);
    return { $$type: 'AthTransferNotificationAck' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key };
}

export function loadTupleAthTransferNotificationAck(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    return { $$type: 'AthTransferNotificationAck' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key };
}

export function loadGetterTupleAthTransferNotificationAck(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    return { $$type: 'AthTransferNotificationAck' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key };
}

export function storeTupleAthTransferNotificationAck(source: AthTransferNotificationAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.sender_key);
    return builder.build();
}

export function dictValueParserAthTransferNotificationAck(): DictionaryValue<AthTransferNotificationAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationAck(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationAck(src.loadRef().beginParse());
        }
    }
}

export type PruneStaleNotification = {
    $$type: 'PruneStaleNotification';
    query_id: bigint;
    sender_key: bigint;
}

export function storePruneStaleNotification(src: PruneStaleNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1347309650, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 32);
    };
}

export function loadPruneStaleNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1347309650) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(32);
    return { $$type: 'PruneStaleNotification' as const, query_id: _query_id, sender_key: _sender_key };
}

export function loadTuplePruneStaleNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    return { $$type: 'PruneStaleNotification' as const, query_id: _query_id, sender_key: _sender_key };
}

export function loadGetterTuplePruneStaleNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    return { $$type: 'PruneStaleNotification' as const, query_id: _query_id, sender_key: _sender_key };
}

export function storeTuplePruneStaleNotification(source: PruneStaleNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    return builder.build();
}

export function dictValueParserPruneStaleNotification(): DictionaryValue<PruneStaleNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePruneStaleNotification(src)).endCell());
        },
        parse: (src) => {
            return loadPruneStaleNotification(src.loadRef().beginParse());
        }
    }
}

export type AthTransferNotificationMintUsername = {
    $$type: 'AthTransferNotificationMintUsername';
    query_id: bigint;
    amount: bigint;
    sender_key: bigint;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeAthTransferNotificationMintUsername(src: AthTransferNotificationMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2299698527, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.sender_key, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.username_len, 8);
        b_0.storeBuilder(src.username.asBuilder());
    };
}

export function loadAthTransferNotificationMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2299698527) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_key = sc_0.loadUintBig(32);
    const _owner_wallet = sc_0.loadAddress();
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0;
    return { $$type: 'AthTransferNotificationMintUsername' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleAthTransferNotificationMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'AthTransferNotificationMintUsername' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleAthTransferNotificationMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'AthTransferNotificationMintUsername' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleAthTransferNotificationMintUsername(source: AthTransferNotificationMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.sender_key);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserAthTransferNotificationMintUsername(): DictionaryValue<AthTransferNotificationMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationMintUsername(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferRequest = {
    $$type: 'ATHTransferRequest';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
}

export function storeATHTransferRequest(src: ATHTransferRequest) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042512, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
    };
}

export function loadATHTransferRequest(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042512) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    return { $$type: 'ATHTransferRequest' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination };
}

export function loadTupleATHTransferRequest(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHTransferRequest' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination };
}

export function loadGetterTupleATHTransferRequest(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHTransferRequest' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination };
}

export function storeTupleATHTransferRequest(source: ATHTransferRequest) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    return builder.build();
}

export function dictValueParserATHTransferRequest(): DictionaryValue<ATHTransferRequest> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequest(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequest(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferRequestWithNotify = {
    $$type: 'ATHTransferRequestWithNotify';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
    notify_destination: Address;
    notify_value: bigint;
}

export function storeATHTransferRequestWithNotify(src: ATHTransferRequestWithNotify) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042516, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
        const b_1 = new Builder();
        b_1.storeAddress(src.notify_destination);
        b_1.storeUint(src.notify_value, 128);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHTransferRequestWithNotify(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042516) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _notify_destination = sc_1.loadAddress();
    const _notify_value = sc_1.loadUintBig(128);
    return { $$type: 'ATHTransferRequestWithNotify' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_destination: _notify_destination, notify_value: _notify_value };
}

export function loadTupleATHTransferRequestWithNotify(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    return { $$type: 'ATHTransferRequestWithNotify' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_destination: _notify_destination, notify_value: _notify_value };
}

export function loadGetterTupleATHTransferRequestWithNotify(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    return { $$type: 'ATHTransferRequestWithNotify' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_destination: _notify_destination, notify_value: _notify_value };
}

export function storeTupleATHTransferRequestWithNotify(source: ATHTransferRequestWithNotify) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    builder.writeAddress(source.notify_destination);
    builder.writeNumber(source.notify_value);
    return builder.build();
}

export function dictValueParserATHTransferRequestWithNotify(): DictionaryValue<ATHTransferRequestWithNotify> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestWithNotify(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestWithNotify(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferRequestMintUsername = {
    $$type: 'ATHTransferRequestMintUsername';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
    notify_value: bigint;
    username_len: bigint;
    username: Slice;
}

export function storeATHTransferRequestMintUsername(src: ATHTransferRequestMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042518, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        b_0.storeUint(src.username_len, 8);
        b_0.storeBuilder(src.username.asBuilder());
    };
}

export function loadATHTransferRequestMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042518) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0;
    return { $$type: 'ATHTransferRequestMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, username_len: _username_len, username: _username };
}

export function loadTupleATHTransferRequestMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHTransferRequestMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, username_len: _username_len, username: _username };
}

export function loadGetterTupleATHTransferRequestMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHTransferRequestMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, username_len: _username_len, username: _username };
}

export function storeTupleATHTransferRequestMintUsername(source: ATHTransferRequestMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserATHTransferRequestMintUsername(): DictionaryValue<ATHTransferRequestMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestMintUsername(src.loadRef().beginParse());
        }
    }
}

export type ATHInternalTransfer = {
    $$type: 'ATHInternalTransfer';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
}

export function storeATHInternalTransfer(src: ATHInternalTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042514, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
    };
}

export function loadATHInternalTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042514) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    return { $$type: 'ATHInternalTransfer' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination };
}

export function loadTupleATHInternalTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHInternalTransfer' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination };
}

export function loadGetterTupleATHInternalTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHInternalTransfer' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination };
}

export function storeTupleATHInternalTransfer(source: ATHInternalTransfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    return builder.build();
}

export function dictValueParserATHInternalTransfer(): DictionaryValue<ATHInternalTransfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransfer(src.loadRef().beginParse());
        }
    }
}

export type ATHInternalTransferWithNotify = {
    $$type: 'ATHInternalTransferWithNotify';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
    notify_destination: Address;
    notify_value: bigint;
}

export function storeATHInternalTransferWithNotify(src: ATHInternalTransferWithNotify) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042517, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        const b_1 = new Builder();
        b_1.storeAddress(src.notify_destination);
        b_1.storeUint(src.notify_value, 128);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHInternalTransferWithNotify(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042517) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _notify_destination = sc_1.loadAddress();
    const _notify_value = sc_1.loadUintBig(128);
    return { $$type: 'ATHInternalTransferWithNotify' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_destination: _notify_destination, notify_value: _notify_value };
}

export function loadTupleATHInternalTransferWithNotify(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    return { $$type: 'ATHInternalTransferWithNotify' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_destination: _notify_destination, notify_value: _notify_value };
}

export function loadGetterTupleATHInternalTransferWithNotify(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    return { $$type: 'ATHInternalTransferWithNotify' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_destination: _notify_destination, notify_value: _notify_value };
}

export function storeTupleATHInternalTransferWithNotify(source: ATHInternalTransferWithNotify) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    builder.writeAddress(source.notify_destination);
    builder.writeNumber(source.notify_value);
    return builder.build();
}

export function dictValueParserATHInternalTransferWithNotify(): DictionaryValue<ATHInternalTransferWithNotify> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferWithNotify(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferWithNotify(src.loadRef().beginParse());
        }
    }
}

export type ATHInternalTransferMintUsername = {
    $$type: 'ATHInternalTransferMintUsername';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
    notify_value: bigint;
    username_len: bigint;
    username: Slice;
}

export function storeATHInternalTransferMintUsername(src: ATHInternalTransferMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042519, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        b_0.storeUint(src.username_len, 8);
        b_0.storeBuilder(src.username.asBuilder());
    };
}

export function loadATHInternalTransferMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042519) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0;
    return { $$type: 'ATHInternalTransferMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, username_len: _username_len, username: _username };
}

export function loadTupleATHInternalTransferMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHInternalTransferMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, username_len: _username_len, username: _username };
}

export function loadGetterTupleATHInternalTransferMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHInternalTransferMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, username_len: _username_len, username: _username };
}

export function storeTupleATHInternalTransferMintUsername(source: ATHInternalTransferMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserATHInternalTransferMintUsername(): DictionaryValue<ATHInternalTransferMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferMintUsername(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferAck = {
    $$type: 'ATHTransferAck';
    query_id: bigint;
    amount: bigint;
}

export function storeATHTransferAck(src: ATHTransferAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042513, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadATHTransferAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042513) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'ATHTransferAck' as const, query_id: _query_id, amount: _amount };
}

export function loadTupleATHTransferAck(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'ATHTransferAck' as const, query_id: _query_id, amount: _amount };
}

export function loadGetterTupleATHTransferAck(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'ATHTransferAck' as const, query_id: _query_id, amount: _amount };
}

export function storeTupleATHTransferAck(source: ATHTransferAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserATHTransferAck(): DictionaryValue<ATHTransferAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferAck(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferAck(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferFailed = {
    $$type: 'ATHTransferFailed';
    query_id: bigint;
    amount: bigint;
}

export function storeATHTransferFailed(src: ATHTransferFailed) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042515, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadATHTransferFailed(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042515) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'ATHTransferFailed' as const, query_id: _query_id, amount: _amount };
}

export function loadTupleATHTransferFailed(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'ATHTransferFailed' as const, query_id: _query_id, amount: _amount };
}

export function loadGetterTupleATHTransferFailed(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'ATHTransferFailed' as const, query_id: _query_id, amount: _amount };
}

export function storeTupleATHTransferFailed(source: ATHTransferFailed) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserATHTransferFailed(): DictionaryValue<ATHTransferFailed> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferFailed(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferFailed(src.loadRef().beginParse());
        }
    }
}

export type ATHWalletDataView = {
    $$type: 'ATHWalletDataView';
    balance: bigint;
    owner_address: Address;
    ath_master_address: Address;
}

export function storeATHWalletDataView(src: ATHWalletDataView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.balance, 257);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
    };
}

export function loadATHWalletDataView(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadIntBig(257);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    return { $$type: 'ATHWalletDataView' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address };
}

export function loadTupleATHWalletDataView(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    return { $$type: 'ATHWalletDataView' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address };
}

export function loadGetterTupleATHWalletDataView(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    return { $$type: 'ATHWalletDataView' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address };
}

export function storeTupleATHWalletDataView(source: ATHWalletDataView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    return builder.build();
}

export function dictValueParserATHWalletDataView(): DictionaryValue<ATHWalletDataView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHWalletDataView(src)).endCell());
        },
        parse: (src) => {
            return loadATHWalletDataView(src.loadRef().beginParse());
        }
    }
}

export type PendingAthTransferNotificationView = {
    $$type: 'PendingAthTransferNotificationView';
    exists: boolean;
    sender_owner: Address;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthTransferNotificationView(src: PendingAthTransferNotificationView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.sender_owner);
        b_0.storeInt(src.amount, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPendingAthTransferNotificationView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _sender_owner = sc_0.loadAddress();
    const _amount = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PendingAthTransferNotificationView' as const, exists: _exists, sender_owner: _sender_owner, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthTransferNotificationView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_owner = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotificationView' as const, exists: _exists, sender_owner: _sender_owner, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthTransferNotificationView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_owner = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotificationView' as const, exists: _exists, sender_owner: _sender_owner, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthTransferNotificationView(source: PendingAthTransferNotificationView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.sender_owner);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthTransferNotificationView(): DictionaryValue<PendingAthTransferNotificationView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthTransferNotificationView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthTransferNotificationView(src.loadRef().beginParse());
        }
    }
}

export type PendingAthTransferNotification = {
    $$type: 'PendingAthTransferNotification';
    sender_owner: Address;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthTransferNotification(src: PendingAthTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.sender_owner);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    const _sender_owner = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthTransferNotification(source: TupleReader) {
    const _sender_owner = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthTransferNotification(source: TupleReader) {
    const _sender_owner = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthTransferNotification(source: PendingAthTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sender_owner);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthTransferNotification(): DictionaryValue<PendingAthTransferNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthTransferNotification(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthTransferNotification(src.loadRef().beginParse());
        }
    }
}

export type ATHWallet$Data = {
    $$type: 'ATHWallet$Data';
    balance: bigint;
    owner_address: Address;
    ath_master_address: Address;
    pending_notifications: Dictionary<bigint, PendingAthTransferNotification>;
    processed_notifications: Dictionary<bigint, bigint>;
}

export function storeATHWallet$Data(src: ATHWallet$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.balance, 128);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeDict(src.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification());
        b_0.storeDict(src.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
    };
}

export function loadATHWallet$Data(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _pending_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), sc_0);
    const _processed_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications };
}

export function loadTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications };
}

export function loadGetterTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications };
}

export function storeTupleATHWallet$Data(source: ATHWallet$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeCell(source.pending_notifications.size > 0 ? beginCell().storeDictDirect(source.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification()).endCell() : null);
    builder.writeCell(source.processed_notifications.size > 0 ? beginCell().storeDictDirect(source.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    return builder.build();
}

export function dictValueParserATHWallet$Data(): DictionaryValue<ATHWallet$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHWallet$Data(src)).endCell());
        },
        parse: (src) => {
            return loadATHWallet$Data(src.loadRef().beginParse());
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

export type BindBuybackFeeAccumulator = {
    $$type: 'BindBuybackFeeAccumulator';
    deployment_manifest_hash: bigint;
    fee_accumulator_address: Address;
}

export function storeBindBuybackFeeAccumulator(src: BindBuybackFeeAccumulator) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113146945, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.fee_accumulator_address);
    };
}

export function loadBindBuybackFeeAccumulator(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113146945) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _fee_accumulator_address = sc_0.loadAddress();
    return { $$type: 'BindBuybackFeeAccumulator' as const, deployment_manifest_hash: _deployment_manifest_hash, fee_accumulator_address: _fee_accumulator_address };
}

export function loadTupleBindBuybackFeeAccumulator(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _fee_accumulator_address = source.readAddress();
    return { $$type: 'BindBuybackFeeAccumulator' as const, deployment_manifest_hash: _deployment_manifest_hash, fee_accumulator_address: _fee_accumulator_address };
}

export function loadGetterTupleBindBuybackFeeAccumulator(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _fee_accumulator_address = source.readAddress();
    return { $$type: 'BindBuybackFeeAccumulator' as const, deployment_manifest_hash: _deployment_manifest_hash, fee_accumulator_address: _fee_accumulator_address };
}

export function storeTupleBindBuybackFeeAccumulator(source: BindBuybackFeeAccumulator) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.fee_accumulator_address);
    return builder.build();
}

export function dictValueParserBindBuybackFeeAccumulator(): DictionaryValue<BindBuybackFeeAccumulator> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindBuybackFeeAccumulator(src)).endCell());
        },
        parse: (src) => {
            return loadBindBuybackFeeAccumulator(src.loadRef().beginParse());
        }
    }
}

export type BindBuybackOfficialAthWallet = {
    $$type: 'BindBuybackOfficialAthWallet';
    deployment_manifest_hash: bigint;
    official_ath_wallet_address: Address;
}

export function storeBindBuybackOfficialAthWallet(src: BindBuybackOfficialAthWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113145687, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.official_ath_wallet_address);
    };
}

export function loadBindBuybackOfficialAthWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113145687) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _official_ath_wallet_address = sc_0.loadAddress();
    return { $$type: 'BindBuybackOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadTupleBindBuybackOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindBuybackOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadGetterTupleBindBuybackOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindBuybackOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function storeTupleBindBuybackOfficialAthWallet(source: BindBuybackOfficialAthWallet) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.official_ath_wallet_address);
    return builder.build();
}

export function dictValueParserBindBuybackOfficialAthWallet(): DictionaryValue<BindBuybackOfficialAthWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindBuybackOfficialAthWallet(src)).endCell());
        },
        parse: (src) => {
            return loadBindBuybackOfficialAthWallet(src.loadRef().beginParse());
        }
    }
}

export type FreezeBuybackRoute = {
    $$type: 'FreezeBuybackRoute';
    deployment_manifest_hash: bigint;
    stonfi_router_address: Address;
    stonfi_pool_address_ton_ath: Address;
    stonfi_pton_wallet_address: Address;
    ask_jetton_wallet_address: Address;
    stonfi_referral_address: Address;
    referral_value_bps: bigint;
    buyback_min_ath_out_per_50_ton_atomic: bigint;
    evidence_quote_out_atomic_ath: bigint;
    evidence_dex_min_out_atomic_ath: bigint;
    route_evidence_hash: bigint;
}

export function storeFreezeBuybackRoute(src: FreezeBuybackRoute) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113150022, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.stonfi_router_address);
        b_0.storeAddress(src.stonfi_pool_address_ton_ath);
        const b_1 = new Builder();
        b_1.storeAddress(src.stonfi_pton_wallet_address);
        b_1.storeAddress(src.ask_jetton_wallet_address);
        b_1.storeAddress(src.stonfi_referral_address);
        b_1.storeUint(src.referral_value_bps, 16);
        b_1.storeUint(src.buyback_min_ath_out_per_50_ton_atomic, 128);
        const b_2 = new Builder();
        b_2.storeUint(src.evidence_quote_out_atomic_ath, 128);
        b_2.storeUint(src.evidence_dex_min_out_atomic_ath, 128);
        b_2.storeUint(src.route_evidence_hash, 256);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadFreezeBuybackRoute(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113150022) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _stonfi_router_address = sc_0.loadAddress();
    const _stonfi_pool_address_ton_ath = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _stonfi_pton_wallet_address = sc_1.loadAddress();
    const _ask_jetton_wallet_address = sc_1.loadAddress();
    const _stonfi_referral_address = sc_1.loadAddress();
    const _referral_value_bps = sc_1.loadUintBig(16);
    const _buyback_min_ath_out_per_50_ton_atomic = sc_1.loadUintBig(128);
    const sc_2 = sc_1.loadRef().beginParse();
    const _evidence_quote_out_atomic_ath = sc_2.loadUintBig(128);
    const _evidence_dex_min_out_atomic_ath = sc_2.loadUintBig(128);
    const _route_evidence_hash = sc_2.loadUintBig(256);
    return { $$type: 'FreezeBuybackRoute' as const, deployment_manifest_hash: _deployment_manifest_hash, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash };
}

export function loadTupleFreezeBuybackRoute(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _stonfi_router_address = source.readAddress();
    const _stonfi_pool_address_ton_ath = source.readAddress();
    const _stonfi_pton_wallet_address = source.readAddress();
    const _ask_jetton_wallet_address = source.readAddress();
    const _stonfi_referral_address = source.readAddress();
    const _referral_value_bps = source.readBigNumber();
    const _buyback_min_ath_out_per_50_ton_atomic = source.readBigNumber();
    const _evidence_quote_out_atomic_ath = source.readBigNumber();
    const _evidence_dex_min_out_atomic_ath = source.readBigNumber();
    const _route_evidence_hash = source.readBigNumber();
    return { $$type: 'FreezeBuybackRoute' as const, deployment_manifest_hash: _deployment_manifest_hash, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash };
}

export function loadGetterTupleFreezeBuybackRoute(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _stonfi_router_address = source.readAddress();
    const _stonfi_pool_address_ton_ath = source.readAddress();
    const _stonfi_pton_wallet_address = source.readAddress();
    const _ask_jetton_wallet_address = source.readAddress();
    const _stonfi_referral_address = source.readAddress();
    const _referral_value_bps = source.readBigNumber();
    const _buyback_min_ath_out_per_50_ton_atomic = source.readBigNumber();
    const _evidence_quote_out_atomic_ath = source.readBigNumber();
    const _evidence_dex_min_out_atomic_ath = source.readBigNumber();
    const _route_evidence_hash = source.readBigNumber();
    return { $$type: 'FreezeBuybackRoute' as const, deployment_manifest_hash: _deployment_manifest_hash, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash };
}

export function storeTupleFreezeBuybackRoute(source: FreezeBuybackRoute) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.stonfi_router_address);
    builder.writeAddress(source.stonfi_pool_address_ton_ath);
    builder.writeAddress(source.stonfi_pton_wallet_address);
    builder.writeAddress(source.ask_jetton_wallet_address);
    builder.writeAddress(source.stonfi_referral_address);
    builder.writeNumber(source.referral_value_bps);
    builder.writeNumber(source.buyback_min_ath_out_per_50_ton_atomic);
    builder.writeNumber(source.evidence_quote_out_atomic_ath);
    builder.writeNumber(source.evidence_dex_min_out_atomic_ath);
    builder.writeNumber(source.route_evidence_hash);
    return builder.build();
}

export function dictValueParserFreezeBuybackRoute(): DictionaryValue<FreezeBuybackRoute> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFreezeBuybackRoute(src)).endCell());
        },
        parse: (src) => {
            return loadFreezeBuybackRoute(src.loadRef().beginParse());
        }
    }
}

export type SealBuybackBurnGenesis = {
    $$type: 'SealBuybackBurnGenesis';
    deployment_manifest_hash: bigint;
}

export function storeSealBuybackBurnGenesis(src: SealBuybackBurnGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113150284, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadSealBuybackBurnGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113150284) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'SealBuybackBurnGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleSealBuybackBurnGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'SealBuybackBurnGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleSealBuybackBurnGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'SealBuybackBurnGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleSealBuybackBurnGenesis(source: SealBuybackBurnGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserSealBuybackBurnGenesis(): DictionaryValue<SealBuybackBurnGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSealBuybackBurnGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadSealBuybackBurnGenesis(src.loadRef().beginParse());
        }
    }
}

export type ExecuteBuybackChunk = {
    $$type: 'ExecuteBuybackChunk';
    query_id: bigint;
    deadline: bigint;
    quote_out_atomic_ath: bigint;
    dex_min_out_atomic_ath: bigint;
}

export function storeExecuteBuybackChunk(src: ExecuteBuybackChunk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113146712, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.deadline, 64);
        b_0.storeUint(src.quote_out_atomic_ath, 128);
        b_0.storeUint(src.dex_min_out_atomic_ath, 128);
    };
}

export function loadExecuteBuybackChunk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113146712) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _deadline = sc_0.loadUintBig(64);
    const _quote_out_atomic_ath = sc_0.loadUintBig(128);
    const _dex_min_out_atomic_ath = sc_0.loadUintBig(128);
    return { $$type: 'ExecuteBuybackChunk' as const, query_id: _query_id, deadline: _deadline, quote_out_atomic_ath: _quote_out_atomic_ath, dex_min_out_atomic_ath: _dex_min_out_atomic_ath };
}

export function loadTupleExecuteBuybackChunk(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _deadline = source.readBigNumber();
    const _quote_out_atomic_ath = source.readBigNumber();
    const _dex_min_out_atomic_ath = source.readBigNumber();
    return { $$type: 'ExecuteBuybackChunk' as const, query_id: _query_id, deadline: _deadline, quote_out_atomic_ath: _quote_out_atomic_ath, dex_min_out_atomic_ath: _dex_min_out_atomic_ath };
}

export function loadGetterTupleExecuteBuybackChunk(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _deadline = source.readBigNumber();
    const _quote_out_atomic_ath = source.readBigNumber();
    const _dex_min_out_atomic_ath = source.readBigNumber();
    return { $$type: 'ExecuteBuybackChunk' as const, query_id: _query_id, deadline: _deadline, quote_out_atomic_ath: _quote_out_atomic_ath, dex_min_out_atomic_ath: _dex_min_out_atomic_ath };
}

export function storeTupleExecuteBuybackChunk(source: ExecuteBuybackChunk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.deadline);
    builder.writeNumber(source.quote_out_atomic_ath);
    builder.writeNumber(source.dex_min_out_atomic_ath);
    return builder.build();
}

export function dictValueParserExecuteBuybackChunk(): DictionaryValue<ExecuteBuybackChunk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeExecuteBuybackChunk(src)).endCell());
        },
        parse: (src) => {
            return loadExecuteBuybackChunk(src.loadRef().beginParse());
        }
    }
}

export type RetryAthBurnDue = {
    $$type: 'RetryAthBurnDue';
    query_id: bigint;
    amount: bigint;
}

export function storeRetryAthBurnDue(src: RetryAthBurnDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113150036, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadRetryAthBurnDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113150036) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'RetryAthBurnDue' as const, query_id: _query_id, amount: _amount };
}

export function loadTupleRetryAthBurnDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'RetryAthBurnDue' as const, query_id: _query_id, amount: _amount };
}

export function loadGetterTupleRetryAthBurnDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    return { $$type: 'RetryAthBurnDue' as const, query_id: _query_id, amount: _amount };
}

export function storeTupleRetryAthBurnDue(source: RetryAthBurnDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserRetryAthBurnDue(): DictionaryValue<RetryAthBurnDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRetryAthBurnDue(src)).endCell());
        },
        parse: (src) => {
            return loadRetryAthBurnDue(src.loadRef().beginParse());
        }
    }
}

export type RecoverStonfiRouteRefund = {
    $$type: 'RecoverStonfiRouteRefund';
    query_id: bigint;
}

export function storeRecoverStonfiRouteRefund(src: RecoverStonfiRouteRefund) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113150019, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadRecoverStonfiRouteRefund(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113150019) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'RecoverStonfiRouteRefund' as const, query_id: _query_id };
}

export function loadTupleRecoverStonfiRouteRefund(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'RecoverStonfiRouteRefund' as const, query_id: _query_id };
}

export function loadGetterTupleRecoverStonfiRouteRefund(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'RecoverStonfiRouteRefund' as const, query_id: _query_id };
}

export function storeTupleRecoverStonfiRouteRefund(source: RecoverStonfiRouteRefund) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserRecoverStonfiRouteRefund(): DictionaryValue<RecoverStonfiRouteRefund> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecoverStonfiRouteRefund(src)).endCell());
        },
        parse: (src) => {
            return loadRecoverStonfiRouteRefund(src.loadRef().beginParse());
        }
    }
}

export type RecycleRouteRefundReserve = {
    $$type: 'RecycleRouteRefundReserve';
}

export function storeRecycleRouteRefundReserve(src: RecycleRouteRefundReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1113150034, 32);
    };
}

export function loadRecycleRouteRefundReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1113150034) { throw Error('Invalid prefix'); }
    return { $$type: 'RecycleRouteRefundReserve' as const };
}

export function loadTupleRecycleRouteRefundReserve(source: TupleReader) {
    return { $$type: 'RecycleRouteRefundReserve' as const };
}

export function loadGetterTupleRecycleRouteRefundReserve(source: TupleReader) {
    return { $$type: 'RecycleRouteRefundReserve' as const };
}

export function storeTupleRecycleRouteRefundReserve(source: RecycleRouteRefundReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserRecycleRouteRefundReserve(): DictionaryValue<RecycleRouteRefundReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecycleRouteRefundReserve(src)).endCell());
        },
        parse: (src) => {
            return loadRecycleRouteRefundReserve(src.loadRef().beginParse());
        }
    }
}

export type TopUpStorageReserve = {
    $$type: 'TopUpStorageReserve';
}

export function storeTopUpStorageReserve(src: TopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2422309586, 32);
    };
}

export function loadTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2422309586) { throw Error('Invalid prefix'); }
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

export type StonfiPtonTonTransferBounce = {
    $$type: 'StonfiPtonTonTransferBounce';
    query_id: bigint;
    ton_amount: bigint;
}

export function storeStonfiPtonTonTransferBounce(src: StonfiPtonTonTransferBounce) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(32736093, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeCoins(src.ton_amount);
    };
}

export function loadStonfiPtonTonTransferBounce(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 32736093) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _ton_amount = sc_0.loadCoins();
    return { $$type: 'StonfiPtonTonTransferBounce' as const, query_id: _query_id, ton_amount: _ton_amount };
}

export function loadTupleStonfiPtonTonTransferBounce(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _ton_amount = source.readBigNumber();
    return { $$type: 'StonfiPtonTonTransferBounce' as const, query_id: _query_id, ton_amount: _ton_amount };
}

export function loadGetterTupleStonfiPtonTonTransferBounce(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _ton_amount = source.readBigNumber();
    return { $$type: 'StonfiPtonTonTransferBounce' as const, query_id: _query_id, ton_amount: _ton_amount };
}

export function storeTupleStonfiPtonTonTransferBounce(source: StonfiPtonTonTransferBounce) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.ton_amount);
    return builder.build();
}

export function dictValueParserStonfiPtonTonTransferBounce(): DictionaryValue<StonfiPtonTonTransferBounce> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStonfiPtonTonTransferBounce(src)).endCell());
        },
        parse: (src) => {
            return loadStonfiPtonTonTransferBounce(src.loadRef().beginParse());
        }
    }
}

export type BuybackBurnConfigView = {
    $$type: 'BuybackBurnConfigView';
    sealed: boolean;
    fee_bound: boolean;
    official_ath_wallet_bound: boolean;
    route_frozen: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    ath_master_address: Address;
    fee_accumulator_address: Address;
    official_ath_wallet_address: Address;
    stonfi_router_address: Address;
    stonfi_pool_address_ton_ath: Address;
    stonfi_pton_wallet_address: Address;
    ask_jetton_wallet_address: Address;
    stonfi_referral_address: Address;
    referral_value_bps: bigint;
    buyback_min_ath_out_per_50_ton_atomic: bigint;
    evidence_quote_out_atomic_ath: bigint;
    evidence_dex_min_out_atomic_ath: bigint;
    route_evidence_hash: bigint;
}

export function storeBuybackBurnConfigView(src: BuybackBurnConfigView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeBit(src.fee_bound);
        b_0.storeBit(src.official_ath_wallet_bound);
        b_0.storeBit(src.route_frozen);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.ath_master_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.fee_accumulator_address);
        b_1.storeAddress(src.official_ath_wallet_address);
        b_1.storeAddress(src.stonfi_router_address);
        const b_2 = new Builder();
        b_2.storeAddress(src.stonfi_pool_address_ton_ath);
        b_2.storeAddress(src.stonfi_pton_wallet_address);
        b_2.storeAddress(src.ask_jetton_wallet_address);
        const b_3 = new Builder();
        b_3.storeAddress(src.stonfi_referral_address);
        b_3.storeInt(src.referral_value_bps, 257);
        b_3.storeInt(src.buyback_min_ath_out_per_50_ton_atomic, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.evidence_quote_out_atomic_ath, 257);
        b_4.storeInt(src.evidence_dex_min_out_atomic_ath, 257);
        b_4.storeInt(src.route_evidence_hash, 257);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadBuybackBurnConfigView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _fee_bound = sc_0.loadBit();
    const _official_ath_wallet_bound = sc_0.loadBit();
    const _route_frozen = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _ath_master_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _fee_accumulator_address = sc_1.loadAddress();
    const _official_ath_wallet_address = sc_1.loadAddress();
    const _stonfi_router_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _stonfi_pool_address_ton_ath = sc_2.loadAddress();
    const _stonfi_pton_wallet_address = sc_2.loadAddress();
    const _ask_jetton_wallet_address = sc_2.loadAddress();
    const sc_3 = sc_2.loadRef().beginParse();
    const _stonfi_referral_address = sc_3.loadAddress();
    const _referral_value_bps = sc_3.loadIntBig(257);
    const _buyback_min_ath_out_per_50_ton_atomic = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _evidence_quote_out_atomic_ath = sc_4.loadIntBig(257);
    const _evidence_dex_min_out_atomic_ath = sc_4.loadIntBig(257);
    const _route_evidence_hash = sc_4.loadIntBig(257);
    return { $$type: 'BuybackBurnConfigView' as const, sealed: _sealed, fee_bound: _fee_bound, official_ath_wallet_bound: _official_ath_wallet_bound, route_frozen: _route_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, fee_accumulator_address: _fee_accumulator_address, official_ath_wallet_address: _official_ath_wallet_address, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash };
}

export function loadTupleBuybackBurnConfigView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _fee_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _route_frozen = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _fee_accumulator_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _stonfi_router_address = source.readAddress();
    const _stonfi_pool_address_ton_ath = source.readAddress();
    const _stonfi_pton_wallet_address = source.readAddress();
    const _ask_jetton_wallet_address = source.readAddress();
    const _stonfi_referral_address = source.readAddress();
    source = source.readTuple();
    const _referral_value_bps = source.readBigNumber();
    const _buyback_min_ath_out_per_50_ton_atomic = source.readBigNumber();
    const _evidence_quote_out_atomic_ath = source.readBigNumber();
    const _evidence_dex_min_out_atomic_ath = source.readBigNumber();
    const _route_evidence_hash = source.readBigNumber();
    return { $$type: 'BuybackBurnConfigView' as const, sealed: _sealed, fee_bound: _fee_bound, official_ath_wallet_bound: _official_ath_wallet_bound, route_frozen: _route_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, fee_accumulator_address: _fee_accumulator_address, official_ath_wallet_address: _official_ath_wallet_address, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash };
}

export function loadGetterTupleBuybackBurnConfigView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _fee_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _route_frozen = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _fee_accumulator_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _stonfi_router_address = source.readAddress();
    const _stonfi_pool_address_ton_ath = source.readAddress();
    const _stonfi_pton_wallet_address = source.readAddress();
    const _ask_jetton_wallet_address = source.readAddress();
    const _stonfi_referral_address = source.readAddress();
    const _referral_value_bps = source.readBigNumber();
    const _buyback_min_ath_out_per_50_ton_atomic = source.readBigNumber();
    const _evidence_quote_out_atomic_ath = source.readBigNumber();
    const _evidence_dex_min_out_atomic_ath = source.readBigNumber();
    const _route_evidence_hash = source.readBigNumber();
    return { $$type: 'BuybackBurnConfigView' as const, sealed: _sealed, fee_bound: _fee_bound, official_ath_wallet_bound: _official_ath_wallet_bound, route_frozen: _route_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, fee_accumulator_address: _fee_accumulator_address, official_ath_wallet_address: _official_ath_wallet_address, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash };
}

export function storeTupleBuybackBurnConfigView(source: BuybackBurnConfigView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.fee_bound);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.route_frozen);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.stonfi_router_address);
    builder.writeAddress(source.stonfi_pool_address_ton_ath);
    builder.writeAddress(source.stonfi_pton_wallet_address);
    builder.writeAddress(source.ask_jetton_wallet_address);
    builder.writeAddress(source.stonfi_referral_address);
    builder.writeNumber(source.referral_value_bps);
    builder.writeNumber(source.buyback_min_ath_out_per_50_ton_atomic);
    builder.writeNumber(source.evidence_quote_out_atomic_ath);
    builder.writeNumber(source.evidence_dex_min_out_atomic_ath);
    builder.writeNumber(source.route_evidence_hash);
    return builder.build();
}

export function dictValueParserBuybackBurnConfigView(): DictionaryValue<BuybackBurnConfigView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuybackBurnConfigView(src)).endCell());
        },
        parse: (src) => {
            return loadBuybackBurnConfigView(src.loadRef().beginParse());
        }
    }
}

export type BuybackBurnStateView = {
    $$type: 'BuybackBurnStateView';
    phase: bigint;
    reserve_due_ton: bigint;
    pending_query_id: bigint;
    pending_deadline: bigint;
    pending_route_refund_start_ton: bigint;
    pending_dex_min_out_atomic_ath: bigint;
    pending_received_ath_atomic: bigint;
    route_refund_due_ton: bigint;
    ath_burn_retry_due_atomic: bigint;
    last_terminal_query_id: bigint;
}

export function storeBuybackBurnStateView(src: BuybackBurnStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.phase, 257);
        b_0.storeInt(src.reserve_due_ton, 257);
        b_0.storeInt(src.pending_query_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.pending_deadline, 257);
        b_1.storeInt(src.pending_route_refund_start_ton, 257);
        b_1.storeInt(src.pending_dex_min_out_atomic_ath, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.pending_received_ath_atomic, 257);
        b_2.storeInt(src.route_refund_due_ton, 257);
        b_2.storeInt(src.ath_burn_retry_due_atomic, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.last_terminal_query_id, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadBuybackBurnStateView(slice: Slice) {
    const sc_0 = slice;
    const _phase = sc_0.loadIntBig(257);
    const _reserve_due_ton = sc_0.loadIntBig(257);
    const _pending_query_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pending_deadline = sc_1.loadIntBig(257);
    const _pending_route_refund_start_ton = sc_1.loadIntBig(257);
    const _pending_dex_min_out_atomic_ath = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pending_received_ath_atomic = sc_2.loadIntBig(257);
    const _route_refund_due_ton = sc_2.loadIntBig(257);
    const _ath_burn_retry_due_atomic = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _last_terminal_query_id = sc_3.loadIntBig(257);
    return { $$type: 'BuybackBurnStateView' as const, phase: _phase, reserve_due_ton: _reserve_due_ton, pending_query_id: _pending_query_id, pending_deadline: _pending_deadline, pending_route_refund_start_ton: _pending_route_refund_start_ton, pending_dex_min_out_atomic_ath: _pending_dex_min_out_atomic_ath, pending_received_ath_atomic: _pending_received_ath_atomic, route_refund_due_ton: _route_refund_due_ton, ath_burn_retry_due_atomic: _ath_burn_retry_due_atomic, last_terminal_query_id: _last_terminal_query_id };
}

export function loadTupleBuybackBurnStateView(source: TupleReader) {
    const _phase = source.readBigNumber();
    const _reserve_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_deadline = source.readBigNumber();
    const _pending_route_refund_start_ton = source.readBigNumber();
    const _pending_dex_min_out_atomic_ath = source.readBigNumber();
    const _pending_received_ath_atomic = source.readBigNumber();
    const _route_refund_due_ton = source.readBigNumber();
    const _ath_burn_retry_due_atomic = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    return { $$type: 'BuybackBurnStateView' as const, phase: _phase, reserve_due_ton: _reserve_due_ton, pending_query_id: _pending_query_id, pending_deadline: _pending_deadline, pending_route_refund_start_ton: _pending_route_refund_start_ton, pending_dex_min_out_atomic_ath: _pending_dex_min_out_atomic_ath, pending_received_ath_atomic: _pending_received_ath_atomic, route_refund_due_ton: _route_refund_due_ton, ath_burn_retry_due_atomic: _ath_burn_retry_due_atomic, last_terminal_query_id: _last_terminal_query_id };
}

export function loadGetterTupleBuybackBurnStateView(source: TupleReader) {
    const _phase = source.readBigNumber();
    const _reserve_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_deadline = source.readBigNumber();
    const _pending_route_refund_start_ton = source.readBigNumber();
    const _pending_dex_min_out_atomic_ath = source.readBigNumber();
    const _pending_received_ath_atomic = source.readBigNumber();
    const _route_refund_due_ton = source.readBigNumber();
    const _ath_burn_retry_due_atomic = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    return { $$type: 'BuybackBurnStateView' as const, phase: _phase, reserve_due_ton: _reserve_due_ton, pending_query_id: _pending_query_id, pending_deadline: _pending_deadline, pending_route_refund_start_ton: _pending_route_refund_start_ton, pending_dex_min_out_atomic_ath: _pending_dex_min_out_atomic_ath, pending_received_ath_atomic: _pending_received_ath_atomic, route_refund_due_ton: _route_refund_due_ton, ath_burn_retry_due_atomic: _ath_burn_retry_due_atomic, last_terminal_query_id: _last_terminal_query_id };
}

export function storeTupleBuybackBurnStateView(source: BuybackBurnStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.phase);
    builder.writeNumber(source.reserve_due_ton);
    builder.writeNumber(source.pending_query_id);
    builder.writeNumber(source.pending_deadline);
    builder.writeNumber(source.pending_route_refund_start_ton);
    builder.writeNumber(source.pending_dex_min_out_atomic_ath);
    builder.writeNumber(source.pending_received_ath_atomic);
    builder.writeNumber(source.route_refund_due_ton);
    builder.writeNumber(source.ath_burn_retry_due_atomic);
    builder.writeNumber(source.last_terminal_query_id);
    return builder.build();
}

export function dictValueParserBuybackBurnStateView(): DictionaryValue<BuybackBurnStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuybackBurnStateView(src)).endCell());
        },
        parse: (src) => {
            return loadBuybackBurnStateView(src.loadRef().beginParse());
        }
    }
}

export type BuybackBurnTotalsView = {
    $$type: 'BuybackBurnTotalsView';
    accepted_reserve_count: bigint;
    executed_buyback_count: bigint;
    burned_ath_total_atomic: bigint;
}

export function storeBuybackBurnTotalsView(src: BuybackBurnTotalsView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.accepted_reserve_count, 257);
        b_0.storeInt(src.executed_buyback_count, 257);
        b_0.storeInt(src.burned_ath_total_atomic, 257);
    };
}

export function loadBuybackBurnTotalsView(slice: Slice) {
    const sc_0 = slice;
    const _accepted_reserve_count = sc_0.loadIntBig(257);
    const _executed_buyback_count = sc_0.loadIntBig(257);
    const _burned_ath_total_atomic = sc_0.loadIntBig(257);
    return { $$type: 'BuybackBurnTotalsView' as const, accepted_reserve_count: _accepted_reserve_count, executed_buyback_count: _executed_buyback_count, burned_ath_total_atomic: _burned_ath_total_atomic };
}

export function loadTupleBuybackBurnTotalsView(source: TupleReader) {
    const _accepted_reserve_count = source.readBigNumber();
    const _executed_buyback_count = source.readBigNumber();
    const _burned_ath_total_atomic = source.readBigNumber();
    return { $$type: 'BuybackBurnTotalsView' as const, accepted_reserve_count: _accepted_reserve_count, executed_buyback_count: _executed_buyback_count, burned_ath_total_atomic: _burned_ath_total_atomic };
}

export function loadGetterTupleBuybackBurnTotalsView(source: TupleReader) {
    const _accepted_reserve_count = source.readBigNumber();
    const _executed_buyback_count = source.readBigNumber();
    const _burned_ath_total_atomic = source.readBigNumber();
    return { $$type: 'BuybackBurnTotalsView' as const, accepted_reserve_count: _accepted_reserve_count, executed_buyback_count: _executed_buyback_count, burned_ath_total_atomic: _burned_ath_total_atomic };
}

export function storeTupleBuybackBurnTotalsView(source: BuybackBurnTotalsView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.accepted_reserve_count);
    builder.writeNumber(source.executed_buyback_count);
    builder.writeNumber(source.burned_ath_total_atomic);
    return builder.build();
}

export function dictValueParserBuybackBurnTotalsView(): DictionaryValue<BuybackBurnTotalsView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuybackBurnTotalsView(src)).endCell());
        },
        parse: (src) => {
            return loadBuybackBurnTotalsView(src.loadRef().beginParse());
        }
    }
}

export type BuybackBurn$Data = {
    $$type: 'BuybackBurn$Data';
    genesis_config_hash: bigint;
    deployment_manifest_hash: bigint;
    ath_master_address: Address;
    fee_accumulator_address: Address;
    official_ath_wallet_address: Address;
    stonfi_router_address: Address;
    stonfi_pool_address_ton_ath: Address;
    stonfi_pton_wallet_address: Address;
    ask_jetton_wallet_address: Address;
    stonfi_referral_address: Address;
    fee_bound: boolean;
    official_ath_wallet_bound: boolean;
    route_frozen: boolean;
    sealed: boolean;
    referral_value_bps: bigint;
    buyback_min_ath_out_per_50_ton_atomic: bigint;
    evidence_quote_out_atomic_ath: bigint;
    evidence_dex_min_out_atomic_ath: bigint;
    route_evidence_hash: bigint;
    phase: bigint;
    reserve_due_ton: bigint;
    pending_query_id: bigint;
    pending_deadline: bigint;
    pending_route_refund_start_ton: bigint;
    pending_dex_min_out_atomic_ath: bigint;
    pending_received_ath_atomic: bigint;
    route_refund_due_ton: bigint;
    ath_burn_retry_due_atomic: bigint;
    last_terminal_query_id: bigint;
    accepted_reserve_count: bigint;
    executed_buyback_count: bigint;
    burned_ath_total_atomic: bigint;
}

export function storeBuybackBurn$Data(src: BuybackBurn$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.genesis_config_hash, 256);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.ath_master_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.fee_accumulator_address);
        b_1.storeAddress(src.official_ath_wallet_address);
        b_1.storeAddress(src.stonfi_router_address);
        const b_2 = new Builder();
        b_2.storeAddress(src.stonfi_pool_address_ton_ath);
        b_2.storeAddress(src.stonfi_pton_wallet_address);
        b_2.storeAddress(src.ask_jetton_wallet_address);
        const b_3 = new Builder();
        b_3.storeAddress(src.stonfi_referral_address);
        b_3.storeBit(src.fee_bound);
        b_3.storeBit(src.official_ath_wallet_bound);
        b_3.storeBit(src.route_frozen);
        b_3.storeBit(src.sealed);
        b_3.storeUint(src.referral_value_bps, 16);
        b_3.storeUint(src.buyback_min_ath_out_per_50_ton_atomic, 128);
        b_3.storeUint(src.evidence_quote_out_atomic_ath, 128);
        b_3.storeUint(src.evidence_dex_min_out_atomic_ath, 128);
        b_3.storeUint(src.route_evidence_hash, 256);
        b_3.storeUint(src.phase, 8);
        const b_4 = new Builder();
        b_4.storeUint(src.reserve_due_ton, 128);
        b_4.storeUint(src.pending_query_id, 64);
        b_4.storeUint(src.pending_deadline, 64);
        b_4.storeUint(src.pending_route_refund_start_ton, 128);
        b_4.storeUint(src.pending_dex_min_out_atomic_ath, 128);
        b_4.storeUint(src.pending_received_ath_atomic, 128);
        b_4.storeUint(src.route_refund_due_ton, 128);
        b_4.storeUint(src.ath_burn_retry_due_atomic, 128);
        b_4.storeUint(src.last_terminal_query_id, 64);
        const b_5 = new Builder();
        b_5.storeUint(src.accepted_reserve_count, 64);
        b_5.storeUint(src.executed_buyback_count, 64);
        b_5.storeUint(src.burned_ath_total_atomic, 128);
        b_4.storeRef(b_5.endCell());
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadBuybackBurn$Data(slice: Slice) {
    const sc_0 = slice;
    const _genesis_config_hash = sc_0.loadUintBig(256);
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _ath_master_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _fee_accumulator_address = sc_1.loadAddress();
    const _official_ath_wallet_address = sc_1.loadAddress();
    const _stonfi_router_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _stonfi_pool_address_ton_ath = sc_2.loadAddress();
    const _stonfi_pton_wallet_address = sc_2.loadAddress();
    const _ask_jetton_wallet_address = sc_2.loadAddress();
    const sc_3 = sc_2.loadRef().beginParse();
    const _stonfi_referral_address = sc_3.loadAddress();
    const _fee_bound = sc_3.loadBit();
    const _official_ath_wallet_bound = sc_3.loadBit();
    const _route_frozen = sc_3.loadBit();
    const _sealed = sc_3.loadBit();
    const _referral_value_bps = sc_3.loadUintBig(16);
    const _buyback_min_ath_out_per_50_ton_atomic = sc_3.loadUintBig(128);
    const _evidence_quote_out_atomic_ath = sc_3.loadUintBig(128);
    const _evidence_dex_min_out_atomic_ath = sc_3.loadUintBig(128);
    const _route_evidence_hash = sc_3.loadUintBig(256);
    const _phase = sc_3.loadUintBig(8);
    const sc_4 = sc_3.loadRef().beginParse();
    const _reserve_due_ton = sc_4.loadUintBig(128);
    const _pending_query_id = sc_4.loadUintBig(64);
    const _pending_deadline = sc_4.loadUintBig(64);
    const _pending_route_refund_start_ton = sc_4.loadUintBig(128);
    const _pending_dex_min_out_atomic_ath = sc_4.loadUintBig(128);
    const _pending_received_ath_atomic = sc_4.loadUintBig(128);
    const _route_refund_due_ton = sc_4.loadUintBig(128);
    const _ath_burn_retry_due_atomic = sc_4.loadUintBig(128);
    const _last_terminal_query_id = sc_4.loadUintBig(64);
    const sc_5 = sc_4.loadRef().beginParse();
    const _accepted_reserve_count = sc_5.loadUintBig(64);
    const _executed_buyback_count = sc_5.loadUintBig(64);
    const _burned_ath_total_atomic = sc_5.loadUintBig(128);
    return { $$type: 'BuybackBurn$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, fee_accumulator_address: _fee_accumulator_address, official_ath_wallet_address: _official_ath_wallet_address, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, fee_bound: _fee_bound, official_ath_wallet_bound: _official_ath_wallet_bound, route_frozen: _route_frozen, sealed: _sealed, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash, phase: _phase, reserve_due_ton: _reserve_due_ton, pending_query_id: _pending_query_id, pending_deadline: _pending_deadline, pending_route_refund_start_ton: _pending_route_refund_start_ton, pending_dex_min_out_atomic_ath: _pending_dex_min_out_atomic_ath, pending_received_ath_atomic: _pending_received_ath_atomic, route_refund_due_ton: _route_refund_due_ton, ath_burn_retry_due_atomic: _ath_burn_retry_due_atomic, last_terminal_query_id: _last_terminal_query_id, accepted_reserve_count: _accepted_reserve_count, executed_buyback_count: _executed_buyback_count, burned_ath_total_atomic: _burned_ath_total_atomic };
}

export function loadTupleBuybackBurn$Data(source: TupleReader) {
    const _genesis_config_hash = source.readBigNumber();
    const _deployment_manifest_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _fee_accumulator_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _stonfi_router_address = source.readAddress();
    const _stonfi_pool_address_ton_ath = source.readAddress();
    const _stonfi_pton_wallet_address = source.readAddress();
    const _ask_jetton_wallet_address = source.readAddress();
    const _stonfi_referral_address = source.readAddress();
    const _fee_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _route_frozen = source.readBoolean();
    const _sealed = source.readBoolean();
    source = source.readTuple();
    const _referral_value_bps = source.readBigNumber();
    const _buyback_min_ath_out_per_50_ton_atomic = source.readBigNumber();
    const _evidence_quote_out_atomic_ath = source.readBigNumber();
    const _evidence_dex_min_out_atomic_ath = source.readBigNumber();
    const _route_evidence_hash = source.readBigNumber();
    const _phase = source.readBigNumber();
    const _reserve_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_deadline = source.readBigNumber();
    const _pending_route_refund_start_ton = source.readBigNumber();
    const _pending_dex_min_out_atomic_ath = source.readBigNumber();
    const _pending_received_ath_atomic = source.readBigNumber();
    const _route_refund_due_ton = source.readBigNumber();
    const _ath_burn_retry_due_atomic = source.readBigNumber();
    source = source.readTuple();
    const _last_terminal_query_id = source.readBigNumber();
    const _accepted_reserve_count = source.readBigNumber();
    const _executed_buyback_count = source.readBigNumber();
    const _burned_ath_total_atomic = source.readBigNumber();
    return { $$type: 'BuybackBurn$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, fee_accumulator_address: _fee_accumulator_address, official_ath_wallet_address: _official_ath_wallet_address, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, fee_bound: _fee_bound, official_ath_wallet_bound: _official_ath_wallet_bound, route_frozen: _route_frozen, sealed: _sealed, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash, phase: _phase, reserve_due_ton: _reserve_due_ton, pending_query_id: _pending_query_id, pending_deadline: _pending_deadline, pending_route_refund_start_ton: _pending_route_refund_start_ton, pending_dex_min_out_atomic_ath: _pending_dex_min_out_atomic_ath, pending_received_ath_atomic: _pending_received_ath_atomic, route_refund_due_ton: _route_refund_due_ton, ath_burn_retry_due_atomic: _ath_burn_retry_due_atomic, last_terminal_query_id: _last_terminal_query_id, accepted_reserve_count: _accepted_reserve_count, executed_buyback_count: _executed_buyback_count, burned_ath_total_atomic: _burned_ath_total_atomic };
}

export function loadGetterTupleBuybackBurn$Data(source: TupleReader) {
    const _genesis_config_hash = source.readBigNumber();
    const _deployment_manifest_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _fee_accumulator_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _stonfi_router_address = source.readAddress();
    const _stonfi_pool_address_ton_ath = source.readAddress();
    const _stonfi_pton_wallet_address = source.readAddress();
    const _ask_jetton_wallet_address = source.readAddress();
    const _stonfi_referral_address = source.readAddress();
    const _fee_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _route_frozen = source.readBoolean();
    const _sealed = source.readBoolean();
    const _referral_value_bps = source.readBigNumber();
    const _buyback_min_ath_out_per_50_ton_atomic = source.readBigNumber();
    const _evidence_quote_out_atomic_ath = source.readBigNumber();
    const _evidence_dex_min_out_atomic_ath = source.readBigNumber();
    const _route_evidence_hash = source.readBigNumber();
    const _phase = source.readBigNumber();
    const _reserve_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_deadline = source.readBigNumber();
    const _pending_route_refund_start_ton = source.readBigNumber();
    const _pending_dex_min_out_atomic_ath = source.readBigNumber();
    const _pending_received_ath_atomic = source.readBigNumber();
    const _route_refund_due_ton = source.readBigNumber();
    const _ath_burn_retry_due_atomic = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    const _accepted_reserve_count = source.readBigNumber();
    const _executed_buyback_count = source.readBigNumber();
    const _burned_ath_total_atomic = source.readBigNumber();
    return { $$type: 'BuybackBurn$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, fee_accumulator_address: _fee_accumulator_address, official_ath_wallet_address: _official_ath_wallet_address, stonfi_router_address: _stonfi_router_address, stonfi_pool_address_ton_ath: _stonfi_pool_address_ton_ath, stonfi_pton_wallet_address: _stonfi_pton_wallet_address, ask_jetton_wallet_address: _ask_jetton_wallet_address, stonfi_referral_address: _stonfi_referral_address, fee_bound: _fee_bound, official_ath_wallet_bound: _official_ath_wallet_bound, route_frozen: _route_frozen, sealed: _sealed, referral_value_bps: _referral_value_bps, buyback_min_ath_out_per_50_ton_atomic: _buyback_min_ath_out_per_50_ton_atomic, evidence_quote_out_atomic_ath: _evidence_quote_out_atomic_ath, evidence_dex_min_out_atomic_ath: _evidence_dex_min_out_atomic_ath, route_evidence_hash: _route_evidence_hash, phase: _phase, reserve_due_ton: _reserve_due_ton, pending_query_id: _pending_query_id, pending_deadline: _pending_deadline, pending_route_refund_start_ton: _pending_route_refund_start_ton, pending_dex_min_out_atomic_ath: _pending_dex_min_out_atomic_ath, pending_received_ath_atomic: _pending_received_ath_atomic, route_refund_due_ton: _route_refund_due_ton, ath_burn_retry_due_atomic: _ath_burn_retry_due_atomic, last_terminal_query_id: _last_terminal_query_id, accepted_reserve_count: _accepted_reserve_count, executed_buyback_count: _executed_buyback_count, burned_ath_total_atomic: _burned_ath_total_atomic };
}

export function storeTupleBuybackBurn$Data(source: BuybackBurn$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.genesis_config_hash);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.stonfi_router_address);
    builder.writeAddress(source.stonfi_pool_address_ton_ath);
    builder.writeAddress(source.stonfi_pton_wallet_address);
    builder.writeAddress(source.ask_jetton_wallet_address);
    builder.writeAddress(source.stonfi_referral_address);
    builder.writeBoolean(source.fee_bound);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.route_frozen);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.referral_value_bps);
    builder.writeNumber(source.buyback_min_ath_out_per_50_ton_atomic);
    builder.writeNumber(source.evidence_quote_out_atomic_ath);
    builder.writeNumber(source.evidence_dex_min_out_atomic_ath);
    builder.writeNumber(source.route_evidence_hash);
    builder.writeNumber(source.phase);
    builder.writeNumber(source.reserve_due_ton);
    builder.writeNumber(source.pending_query_id);
    builder.writeNumber(source.pending_deadline);
    builder.writeNumber(source.pending_route_refund_start_ton);
    builder.writeNumber(source.pending_dex_min_out_atomic_ath);
    builder.writeNumber(source.pending_received_ath_atomic);
    builder.writeNumber(source.route_refund_due_ton);
    builder.writeNumber(source.ath_burn_retry_due_atomic);
    builder.writeNumber(source.last_terminal_query_id);
    builder.writeNumber(source.accepted_reserve_count);
    builder.writeNumber(source.executed_buyback_count);
    builder.writeNumber(source.burned_ath_total_atomic);
    return builder.build();
}

export function dictValueParserBuybackBurn$Data(): DictionaryValue<BuybackBurn$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuybackBurn$Data(src)).endCell());
        },
        parse: (src) => {
            return loadBuybackBurn$Data(src.loadRef().beginParse());
        }
    }
}

 type ATHWallet_init_args = {
    $$type: 'ATHWallet_init_args';
    balance: bigint;
    owner_address: Address;
    ath_master_address: Address;
}

function initATHWallet_init_args(src: ATHWallet_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.balance, 257);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
    };
}

async function ATHWallet_init(balance: bigint, owner_address: Address, ath_master_address: Address) {
    const __code = Cell.fromHex('b5ee9c7241022e01000da3000114ff00f4a413f4bcf2c80b01020162022804dad001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de206e3027025d74920c21f953105d31f06de21821041544801bae30221821041544805bae30221821041544810ba030c0e0f046e048020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812bae30220821041544815bae30220821041544817ba0405060700d230d33fd37f59328136b3f84224c705f2f48136b422c200f2f45141a0708040067f04c8598210415448045003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5400be30d33fd37f593281378c22c200f2f45141a0708040067f04c8598210415448135003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5400be30d33fd37f59328137f022c200f2f45141a0708040067f04c8598210415448135003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5402ee8e5f30d33fd37f59328138b822c200f2f45141a0708040067f04c8598210415448135003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed54e0208210472d9d7dbae302821089129d5fbae3025f060809015030d33fd37fd31f55203310571046103512db3cc87f01ca0055405045cb7f12cecef400f400c9ed540a014ed33fd37fd31f55203310571046103512db3cc87f01ca0055405045cb7f12cecef400f400c9ed540a04e88137fa21c200f2f48137fb5381bef2f41047103645765357db3c228101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e28137fc216eb3f2f46f23308137fd511abaf2f4103645468137fe5167db3c500bba16f2f45127a15034810101f45a3055035177db3c7053942b271e0b01bedb3c707f541ab880400ec855308210415448125005cb1f13cb3fcb7fcecec910361059104a103b103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0044431f01fc5b04d33fd37ffa40308136b0f84226c705f2f48136b122c200f2f48136b25362bef2f48136b55315c705f2f48136b6f8416f24135f0382081e8480bef2f45151a17080405414367f09c855308210415448025005cb1f13cb3fcb7fcecec9240443135077441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000d002e4034c87f01ca0055405045cb7f12cecef400f400c9ed5401ec5b04d33fd37ffa4030813840f84225c705f2f481384122c200f2f481384226c000f2f4813843f8416f24135f0382082dc6c0bef2f45151a082080f42407004705147c855208210415448065004cb1f12cb3fcb7fcec910474730441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00403418043ce30221821041544814bae30221821041544816bae30221821041544812ba1013151704fc5b04d33fd37ffa40fa4030813778f84227c705f2f48137795316c705f2f481377a23c200f2f481377b5373bef2f481377cf8416f24135f0382081e8480bef2f45162a1041035407827db3c70541094db3c707f5419c780400cc855308210415448125005cb1f13cb3fcb7fcecec9106a1058104b1039103645155034c8891e1f1112000160008acf16ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb004144c87f01ca0055405045cb7f12cecef400f400c9ed5402fc5b04d33fd37ffa40fa40d430d0fa40d37f308137dcf84229c705f2f48137dd5338c705f2f48137de5324c705f2f48137df25c200f2f48137e021c200f2f48137e15395bef2f48137e2218209c9c380bef2f48137e3f8416f24135f032282080f4240a082081e8480a082081e8480a0bef2f45184a1041037469a27db3c701e1402dc541094db3c507c707f8040284c1350fec855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc95e351047103a48b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb004413021f1803fc5b04d33fd37ffa40fa40d37fd3078138a4f8422ac705f2f48138a55349c705f2f48138a626c200f2f48138a723c200f2f48138a853a6bef2f48138a9238209c9c380bef2f48138aaf8416f24135f032482080f4240a082081e8480a082081e8480a0bef2f45195a104103847ab2bdb3c705410d4db3c4870707f804028041e1f1600f8103e102d011110010fc855608210415448175008cb1f16cb3f14cb7f12cececb7fcb07cec9106b10581047103a4890103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb005024c87f01ca0055405045cb7f12cecef400f400c9ed5403f48f765b04d33fd37ffa40fa403081378223c200f2f4813783f84210581047103649a6db3c16c70519f2f4813784f8416f24135f0382081e8480bef2f45124a0708040077f07c8598210415448115003cb1fcb3fcb7fc91048473016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00443012e0211e1819002ac87f01ca0055405045cb7f12cecef400f400c9ed54044a821041544815bae30221821041544817bae302218210472d9d7ebae302218210504e5052ba1a1d222504fe5b04d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842104a103948bc25db3c1dc7051bf2f48137e85382c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082081e8480a082081e8480a0bef2f44014503a541909db3c55405365db3c8137eb238101012359f40c6fa131b3f2f41e272b1b02fc8137ec298209c9c380bef2f4554053b7db3c8137ed81010154431359f40c6fa131b3f2f4514ca0810101f823546df0c855205023cecb7fcb1fc94170206e953059f45a30944133f415e2707f54488052ee12c855308210472d9d7d5005cb1f13cb3fcb7fcb1fcec9104910384b60441359c8cf8580ca00cf8440ce01fa02231c00b6806acf40f400c901fb0082080f42407004700ac8598210415448115003cb1fcb3fcb7fc91047473019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00441359c87f01ca0055405045cb7f12cecef400f400c9ed5404fc5b04d33fd37ffa40fa40d37fd3078138ae26c200f2f48138aff842104b103a49cd26db3c1ec7051cf2f48138b02ac200f2f48138b1f8416f24135f032b82080f4240a082081e8480a082081e8480a0bef2f44014503b541a0bdb3c55405375db3c8138b2238101012359f40c6fa131b3f2f48138b32c8209c9c380bef2f41e272b20016820fa4430705825db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d01f0026f82ac87001ca0055215023810101cf00cecec902fe554053d8db3c8138b481010154431359f40c6fa131b3f2f45147a0810101f823546fa0c855205023cecb7fcb1fc94170206e953059f45a30944133f415e2707f2951491049030211100250dc1034c85550821089129d5f5007cb1f15cb3f13cb7fcb1fcecb07cec9544114103a48cc441359c8cf8580ca00cf8440ce01fa02232100b2806acf40f400c901fb0082080f424070047004c8598210415448115003cb1fcb3fcb7fc910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004133c87f01ca0055405045cb7f12cecef400f400c9ed5404f25b04d33fd37fd31f30813804f84226c705f2f481380522c200f2f41045103545675357db3c228101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2813806216eb3f2f46f2330813807511abaf2f4103645468138085167db3c500bba16f2f44614034858db3c810101512214182b2723240024c8821041544e4901cb1f58cf16cb3fc9f9000062216e955b59f45a3098c801cf004133f442e25054810101f45a304403c87f01ca0055405045cb7f12cecef400f400c9ed54015ce30236c00005c12115b08e1c8132c8f2f04034c87f01ca0055405045cb7f12cecef400f400c9ed54e05f05f2c0822602fc5b04d33fd31f3010451034436626db3c228101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e281380e216eb3f2f46f233110471036457681380f08db3c5009ba17f2f4813810f8230682015180a016be15f2f45024810101f45a305004c87f01ca0055405045cb7f12cecef400f400c9ed542b270026c8821041544e4901cb1f01cf16c9f900a9381f020148292c0161bb1c5ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de25514db3c6c5482a0166db3c810101230259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206e96307070545500e06f237f55202b000a01aa1f01a0015dbbb02ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de2db3c6c5382d00065474326c2290d8');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initATHWallet_init_args({ $$type: 'ATHWallet_init_args', balance, owner_address, ath_master_address })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const ATHWallet_errors = {
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

export const ATHWallet_errors_backward = {
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

const ATHWallet_types: ABIType[] = [
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
    {"name":"ATHBurn","header":1096042497,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHBurnNotification","header":1096042498,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHBurnFinalized","header":1096042499,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHBurnFailed","header":1096042500,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHGenesisSupplyCredit","header":1096042501,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHGenesisSupplyAck","header":1096042502,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AthTransferNotification","header":1194171773,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AthTransferNotificationAck","header":1194171774,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PruneStaleNotification","header":1347309650,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"AthTransferNotificationMintUsername","header":2299698527,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHTransferRequest","header":1096042512,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHTransferRequestWithNotify","header":1096042516,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferRequestMintUsername","header":1096042518,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHInternalTransfer","header":1096042514,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHInternalTransferWithNotify","header":1096042517,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHInternalTransferMintUsername","header":1096042519,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHTransferAck","header":1096042513,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferFailed","header":1096042515,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHWalletDataView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PendingAthTransferNotificationView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"processed_notifications","type":{"kind":"dict","key":"int","value":"int"}}]},
    {"name":"AcceptBurnReserve","header":1498129669,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"BindBuybackFeeAccumulator","header":1113146945,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindBuybackOfficialAthWallet","header":1113145687,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"FreezeBuybackRoute","header":1113150022,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"stonfi_router_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_pool_address_ton_ath","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_pton_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ask_jetton_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_referral_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"referral_value_bps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"buyback_min_ath_out_per_50_ton_atomic","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"evidence_quote_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"evidence_dex_min_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"route_evidence_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"SealBuybackBurnGenesis","header":1113150284,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"ExecuteBuybackChunk","header":1113146712,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"deadline","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"quote_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"dex_min_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"RetryAthBurnDue","header":1113150036,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"RecoverStonfiRouteRefund","header":1113150019,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"RecycleRouteRefundReserve","header":1113150034,"fields":[]},
    {"name":"TopUpStorageReserve","header":2422309586,"fields":[]},
    {"name":"StonfiPtonTonTransferBounce","header":32736093,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}}]},
    {"name":"BuybackBurnConfigView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"fee_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"route_frozen","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_router_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_pool_address_ton_ath","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_pton_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ask_jetton_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_referral_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"referral_value_bps","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"buyback_min_ath_out_per_50_ton_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"evidence_quote_out_atomic_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"evidence_dex_min_out_atomic_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"route_evidence_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"BuybackBurnStateView","header":null,"fields":[{"name":"phase","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_deadline","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_route_refund_start_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_dex_min_out_atomic_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_received_ath_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"route_refund_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_burn_retry_due_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_terminal_query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"BuybackBurnTotalsView","header":null,"fields":[{"name":"accepted_reserve_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"executed_buyback_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"burned_ath_total_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"BuybackBurn$Data","header":null,"fields":[{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_router_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_pool_address_ton_ath","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_pton_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ask_jetton_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"stonfi_referral_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"route_frozen","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"referral_value_bps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"buyback_min_ath_out_per_50_ton_atomic","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"evidence_quote_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"evidence_dex_min_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"route_evidence_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"phase","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"reserve_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_deadline","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_route_refund_start_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_dex_min_out_atomic_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_received_ath_atomic","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"route_refund_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_burn_retry_due_atomic","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"last_terminal_query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accepted_reserve_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"executed_buyback_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"burned_ath_total_atomic","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
]

const ATHWallet_opcodes = {
    "ATHBurn": 1096042497,
    "ATHBurnNotification": 1096042498,
    "ATHBurnFinalized": 1096042499,
    "ATHBurnFailed": 1096042500,
    "ATHGenesisSupplyCredit": 1096042501,
    "ATHGenesisSupplyAck": 1096042502,
    "AthTransferNotification": 1194171773,
    "AthTransferNotificationAck": 1194171774,
    "PruneStaleNotification": 1347309650,
    "AthTransferNotificationMintUsername": 2299698527,
    "ATHTransferRequest": 1096042512,
    "ATHTransferRequestWithNotify": 1096042516,
    "ATHTransferRequestMintUsername": 1096042518,
    "ATHInternalTransfer": 1096042514,
    "ATHInternalTransferWithNotify": 1096042517,
    "ATHInternalTransferMintUsername": 1096042519,
    "ATHTransferAck": 1096042513,
    "ATHTransferFailed": 1096042515,
    "AcceptBurnReserve": 1498129669,
    "BindBuybackFeeAccumulator": 1113146945,
    "BindBuybackOfficialAthWallet": 1113145687,
    "FreezeBuybackRoute": 1113150022,
    "SealBuybackBurnGenesis": 1113150284,
    "ExecuteBuybackChunk": 1113146712,
    "RetryAthBurnDue": 1113150036,
    "RecoverStonfiRouteRefund": 1113150019,
    "RecycleRouteRefundReserve": 1113150034,
    "TopUpStorageReserve": 2422309586,
    "StonfiPtonTonTransferBounce": 32736093,
}

const ATHWallet_getters: ABIGetter[] = [
    {"name":"get_wallet_data","methodId":97026,"arguments":[],"returnType":{"kind":"simple","type":"ATHWalletDataView","optional":false}},
    {"name":"get_pending_notification","methodId":78277,"arguments":[{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sender_key","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthTransferNotificationView","optional":false}},
]

export const ATHWallet_getterMapping: { [key: string]: string } = {
    'get_wallet_data': 'getGetWalletData',
    'get_pending_notification': 'getGetPendingNotification',
}

const ATHWallet_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"ATHBurn"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHGenesisSupplyCredit"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferRequest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferRequestWithNotify"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferRequestMintUsername"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransferWithNotify"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransferMintUsername"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotificationAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PruneStaleNotification"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30000000n;
export const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2000000n;
export const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2000000n;
export const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 1096044105n;
export const ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD = 4294967296n;
export const ATH_PENDING_NOTIFICATION_TTL = 86400n;
export const BUYBACK_OFFER_AMOUNT_NANOTONS = 50000000000n;
export const BUYBACK_ROUTE_FORWARD_GAS_NANOTONS = 1000000000n;
export const BUYBACK_PTON_TRANSFER_GAS_NANOTONS = 50000000n;
export const BUYBACK_FUNDING_ENVELOPE_NANOTONS = 51050000000n;
export const BUYBACK_ATH_NOTIFY_ACK_VALUE = 1000000n;
export const BUYBACK_ATH_BURN_REQUEST_VALUE = 30000000n;
export const BUYBACK_ROUTE_NOTIFY_MIN_VALUE = 35000000n;
export const BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE = 2000000n;
export const BUYBACK_ACCOUNTING_RECYCLE_EXEC_RESERVE = 2000000n;
export const BUYBACK_ROUTE_REFUND_EXEC_RESERVE = 2000000n;
export const BUYBACK_ROUTE_REFUND_RECOVERY_EXEC_RESERVE = 2000000n;
export const BUYBACK_DEADLINE_MAX_AHEAD_SECONDS = 900n;
export const BUYBACK_ROUTE_REFUND_RECOVERY_GRACE_SECONDS = 900n;
export const BUYBACK_ROUTE_REFUND_RECOVERY_MIN_NANOTONS = 49000000000n;
export const BUYBACK_PHASE_IDLE = 0n;
export const BUYBACK_PHASE_PENDING_STONFI_SWAP = 1n;
export const BUYBACK_PHASE_PENDING_ATH_BURN = 2n;
export const STONFI_V2_1_DEX_OP_SWAP = 1717886506n;
export const STONFI_V2_1_PTON_OP_TON_TRANSFER = 32736093n;

export class ATHWallet implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = ATHWallet_errors_backward;
    public static readonly opcodes = ATHWallet_opcodes;
    
    static async init(balance: bigint, owner_address: Address, ath_master_address: Address) {
        return await ATHWallet_init(balance, owner_address, ath_master_address);
    }
    
    static async fromInit(balance: bigint, owner_address: Address, ath_master_address: Address) {
        const __gen_init = await ATHWallet_init(balance, owner_address, ath_master_address);
        const address = contractAddress(0, __gen_init);
        return new ATHWallet(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new ATHWallet(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  ATHWallet_types,
        getters: ATHWallet_getters,
        receivers: ATHWallet_receivers,
        errors: ATHWallet_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: ATHBurn | ATHGenesisSupplyCredit | ATHTransferRequest | ATHTransferRequestWithNotify | ATHTransferRequestMintUsername | ATHInternalTransfer | ATHInternalTransferWithNotify | ATHInternalTransferMintUsername | AthTransferNotificationAck | PruneStaleNotification | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHBurn') {
            body = beginCell().store(storeATHBurn(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHGenesisSupplyCredit') {
            body = beginCell().store(storeATHGenesisSupplyCredit(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferRequest') {
            body = beginCell().store(storeATHTransferRequest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferRequestWithNotify') {
            body = beginCell().store(storeATHTransferRequestWithNotify(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferRequestMintUsername') {
            body = beginCell().store(storeATHTransferRequestMintUsername(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransfer') {
            body = beginCell().store(storeATHInternalTransfer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransferWithNotify') {
            body = beginCell().store(storeATHInternalTransferWithNotify(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransferMintUsername') {
            body = beginCell().store(storeATHInternalTransferMintUsername(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotificationAck') {
            body = beginCell().store(storeAthTransferNotificationAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PruneStaleNotification') {
            body = beginCell().store(storePruneStaleNotification(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetWalletData(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_wallet_data', builder.build())).stack;
        const result = loadGetterTupleATHWalletDataView(source);
        return result;
    }
    
    async getGetPendingNotification(provider: ContractProvider, query_id: bigint, sender_key: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(query_id);
        builder.writeNumber(sender_key);
        const source = (await provider.get('get_pending_notification', builder.build())).stack;
        const result = loadGetterTuplePendingAthTransferNotificationView(source);
        return result;
    }
    
}