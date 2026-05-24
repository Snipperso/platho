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

export type AthTransferNotificationProfileAvatar = {
    $$type: 'AthTransferNotificationProfileAvatar';
    query_id: bigint;
    amount: bigint;
    sender_key: bigint;
    owner_wallet: Address;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeAthTransferNotificationProfileAvatar(src: AthTransferNotificationProfileAvatar) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2702864385, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.sender_key, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.avatar_hash, 256);
        b_0.storeUint(src.avatar_entry_id, 64);
        b_0.storeUint(src.avatar_stream_id, 128);
        b_0.storeUint(src.avatar_part_count, 16);
        b_0.storeUint(src.media_format, 8);
    };
}

export function loadAthTransferNotificationProfileAvatar(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2702864385) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_key = sc_0.loadUintBig(32);
    const _owner_wallet = sc_0.loadAddress();
    const _avatar_hash = sc_0.loadUintBig(256);
    const _avatar_entry_id = sc_0.loadUintBig(64);
    const _avatar_stream_id = sc_0.loadUintBig(128);
    const _avatar_part_count = sc_0.loadUintBig(16);
    const _media_format = sc_0.loadUintBig(8);
    return { $$type: 'AthTransferNotificationProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleAthTransferNotificationProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'AthTransferNotificationProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleAthTransferNotificationProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'AthTransferNotificationProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleAthTransferNotificationProfileAvatar(source: AthTransferNotificationProfileAvatar) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.sender_key);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserAthTransferNotificationProfileAvatar(): DictionaryValue<AthTransferNotificationProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationProfileAvatar(src.loadRef().beginParse());
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

export type ATHTransferRequestProfileAvatar = {
    $$type: 'ATHTransferRequestProfileAvatar';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
    notify_value: bigint;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeATHTransferRequestProfileAvatar(src: ATHTransferRequestProfileAvatar) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042520, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        const b_1 = new Builder();
        b_1.storeUint(src.avatar_hash, 256);
        b_1.storeUint(src.avatar_entry_id, 64);
        b_1.storeUint(src.avatar_stream_id, 128);
        b_1.storeUint(src.avatar_part_count, 16);
        b_1.storeUint(src.media_format, 8);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHTransferRequestProfileAvatar(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042520) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _avatar_hash = sc_1.loadUintBig(256);
    const _avatar_entry_id = sc_1.loadUintBig(64);
    const _avatar_stream_id = sc_1.loadUintBig(128);
    const _avatar_part_count = sc_1.loadUintBig(16);
    const _media_format = sc_1.loadUintBig(8);
    return { $$type: 'ATHTransferRequestProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleATHTransferRequestProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHTransferRequestProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleATHTransferRequestProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHTransferRequestProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleATHTransferRequestProfileAvatar(source: ATHTransferRequestProfileAvatar) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserATHTransferRequestProfileAvatar(): DictionaryValue<ATHTransferRequestProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestProfileAvatar(src.loadRef().beginParse());
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

export type ATHInternalTransferProfileAvatar = {
    $$type: 'ATHInternalTransferProfileAvatar';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
    notify_value: bigint;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeATHInternalTransferProfileAvatar(src: ATHInternalTransferProfileAvatar) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042521, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        const b_1 = new Builder();
        b_1.storeUint(src.avatar_hash, 256);
        b_1.storeUint(src.avatar_entry_id, 64);
        b_1.storeUint(src.avatar_stream_id, 128);
        b_1.storeUint(src.avatar_part_count, 16);
        b_1.storeUint(src.media_format, 8);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHInternalTransferProfileAvatar(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042521) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _avatar_hash = sc_1.loadUintBig(256);
    const _avatar_entry_id = sc_1.loadUintBig(64);
    const _avatar_stream_id = sc_1.loadUintBig(128);
    const _avatar_part_count = sc_1.loadUintBig(16);
    const _media_format = sc_1.loadUintBig(8);
    return { $$type: 'ATHInternalTransferProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleATHInternalTransferProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHInternalTransferProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleATHInternalTransferProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHInternalTransferProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleATHInternalTransferProfileAvatar(source: ATHInternalTransferProfileAvatar) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserATHInternalTransferProfileAvatar(): DictionaryValue<ATHInternalTransferProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferProfileAvatar(src.loadRef().beginParse());
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
    pruned_notification_acks: Dictionary<bigint, bigint>;
}

export function storeATHWallet$Data(src: ATHWallet$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.balance, 128);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeDict(src.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification());
        b_0.storeDict(src.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_0.storeDict(src.pruned_notification_acks, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
    };
}

export function loadATHWallet$Data(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _pending_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), sc_0);
    const _processed_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    const _pruned_notification_acks = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pruned_notification_acks: _pruned_notification_acks };
}

export function loadTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pruned_notification_acks = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pruned_notification_acks: _pruned_notification_acks };
}

export function loadGetterTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pruned_notification_acks = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pruned_notification_acks: _pruned_notification_acks };
}

export function storeTupleATHWallet$Data(source: ATHWallet$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeCell(source.pending_notifications.size > 0 ? beginCell().storeDictDirect(source.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification()).endCell() : null);
    builder.writeCell(source.processed_notifications.size > 0 ? beginCell().storeDictDirect(source.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pruned_notification_acks.size > 0 ? beginCell().storeDictDirect(source.pruned_notification_acks, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
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

export type BindMarketStabilityReserveFunder = {
    $$type: 'BindMarketStabilityReserveFunder';
    deployment_manifest_hash: bigint;
    reserve_funder_address: Address;
}

export function storeBindMarketStabilityReserveFunder(src: BindMarketStabilityReserveFunder) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297306182, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.reserve_funder_address);
    };
}

export function loadBindMarketStabilityReserveFunder(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297306182) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _reserve_funder_address = sc_0.loadAddress();
    return { $$type: 'BindMarketStabilityReserveFunder' as const, deployment_manifest_hash: _deployment_manifest_hash, reserve_funder_address: _reserve_funder_address };
}

export function loadTupleBindMarketStabilityReserveFunder(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _reserve_funder_address = source.readAddress();
    return { $$type: 'BindMarketStabilityReserveFunder' as const, deployment_manifest_hash: _deployment_manifest_hash, reserve_funder_address: _reserve_funder_address };
}

export function loadGetterTupleBindMarketStabilityReserveFunder(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _reserve_funder_address = source.readAddress();
    return { $$type: 'BindMarketStabilityReserveFunder' as const, deployment_manifest_hash: _deployment_manifest_hash, reserve_funder_address: _reserve_funder_address };
}

export function storeTupleBindMarketStabilityReserveFunder(source: BindMarketStabilityReserveFunder) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.reserve_funder_address);
    return builder.build();
}

export function dictValueParserBindMarketStabilityReserveFunder(): DictionaryValue<BindMarketStabilityReserveFunder> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindMarketStabilityReserveFunder(src)).endCell());
        },
        parse: (src) => {
            return loadBindMarketStabilityReserveFunder(src.loadRef().beginParse());
        }
    }
}

export type BindMarketStabilityOfficialAthWallet = {
    $$type: 'BindMarketStabilityOfficialAthWallet';
    deployment_manifest_hash: bigint;
    official_ath_wallet_address: Address;
}

export function storeBindMarketStabilityOfficialAthWallet(src: BindMarketStabilityOfficialAthWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297301847, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.official_ath_wallet_address);
    };
}

export function loadBindMarketStabilityOfficialAthWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297301847) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _official_ath_wallet_address = sc_0.loadAddress();
    return { $$type: 'BindMarketStabilityOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadTupleBindMarketStabilityOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindMarketStabilityOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadGetterTupleBindMarketStabilityOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindMarketStabilityOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function storeTupleBindMarketStabilityOfficialAthWallet(source: BindMarketStabilityOfficialAthWallet) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.official_ath_wallet_address);
    return builder.build();
}

export function dictValueParserBindMarketStabilityOfficialAthWallet(): DictionaryValue<BindMarketStabilityOfficialAthWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindMarketStabilityOfficialAthWallet(src)).endCell());
        },
        parse: (src) => {
            return loadBindMarketStabilityOfficialAthWallet(src.loadRef().beginParse());
        }
    }
}

export type BindMarketStabilityTreasury = {
    $$type: 'BindMarketStabilityTreasury';
    deployment_manifest_hash: bigint;
    ton_treasury_receiver_address: Address;
}

export function storeBindMarketStabilityTreasury(src: BindMarketStabilityTreasury) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297306706, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.ton_treasury_receiver_address);
    };
}

export function loadBindMarketStabilityTreasury(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297306706) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _ton_treasury_receiver_address = sc_0.loadAddress();
    return { $$type: 'BindMarketStabilityTreasury' as const, deployment_manifest_hash: _deployment_manifest_hash, ton_treasury_receiver_address: _ton_treasury_receiver_address };
}

export function loadTupleBindMarketStabilityTreasury(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _ton_treasury_receiver_address = source.readAddress();
    return { $$type: 'BindMarketStabilityTreasury' as const, deployment_manifest_hash: _deployment_manifest_hash, ton_treasury_receiver_address: _ton_treasury_receiver_address };
}

export function loadGetterTupleBindMarketStabilityTreasury(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _ton_treasury_receiver_address = source.readAddress();
    return { $$type: 'BindMarketStabilityTreasury' as const, deployment_manifest_hash: _deployment_manifest_hash, ton_treasury_receiver_address: _ton_treasury_receiver_address };
}

export function storeTupleBindMarketStabilityTreasury(source: BindMarketStabilityTreasury) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.ton_treasury_receiver_address);
    return builder.build();
}

export function dictValueParserBindMarketStabilityTreasury(): DictionaryValue<BindMarketStabilityTreasury> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindMarketStabilityTreasury(src)).endCell());
        },
        parse: (src) => {
            return loadBindMarketStabilityTreasury(src.loadRef().beginParse());
        }
    }
}

export type FreezeMarketStabilityPricing = {
    $$type: 'FreezeMarketStabilityPricing';
    deployment_manifest_hash: bigint;
    base_tranche_price_nanotons: bigint;
    evidence_x1_tranche_quote_nanotons: bigint;
    pricing_evidence_hash: bigint;
}

export function storeFreezeMarketStabilityPricing(src: FreezeMarketStabilityPricing) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297305670, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeUint(src.base_tranche_price_nanotons, 128);
        b_0.storeUint(src.evidence_x1_tranche_quote_nanotons, 128);
        b_0.storeUint(src.pricing_evidence_hash, 256);
    };
}

export function loadFreezeMarketStabilityPricing(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297305670) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _base_tranche_price_nanotons = sc_0.loadUintBig(128);
    const _evidence_x1_tranche_quote_nanotons = sc_0.loadUintBig(128);
    const _pricing_evidence_hash = sc_0.loadUintBig(256);
    return { $$type: 'FreezeMarketStabilityPricing' as const, deployment_manifest_hash: _deployment_manifest_hash, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash };
}

export function loadTupleFreezeMarketStabilityPricing(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _base_tranche_price_nanotons = source.readBigNumber();
    const _evidence_x1_tranche_quote_nanotons = source.readBigNumber();
    const _pricing_evidence_hash = source.readBigNumber();
    return { $$type: 'FreezeMarketStabilityPricing' as const, deployment_manifest_hash: _deployment_manifest_hash, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash };
}

export function loadGetterTupleFreezeMarketStabilityPricing(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _base_tranche_price_nanotons = source.readBigNumber();
    const _evidence_x1_tranche_quote_nanotons = source.readBigNumber();
    const _pricing_evidence_hash = source.readBigNumber();
    return { $$type: 'FreezeMarketStabilityPricing' as const, deployment_manifest_hash: _deployment_manifest_hash, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash };
}

export function storeTupleFreezeMarketStabilityPricing(source: FreezeMarketStabilityPricing) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.base_tranche_price_nanotons);
    builder.writeNumber(source.evidence_x1_tranche_quote_nanotons);
    builder.writeNumber(source.pricing_evidence_hash);
    return builder.build();
}

export function dictValueParserFreezeMarketStabilityPricing(): DictionaryValue<FreezeMarketStabilityPricing> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFreezeMarketStabilityPricing(src)).endCell());
        },
        parse: (src) => {
            return loadFreezeMarketStabilityPricing(src.loadRef().beginParse());
        }
    }
}

export type SealMarketStabilityGenesis = {
    $$type: 'SealMarketStabilityGenesis';
    deployment_manifest_hash: bigint;
}

export function storeSealMarketStabilityGenesis(src: SealMarketStabilityGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297306444, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadSealMarketStabilityGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297306444) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'SealMarketStabilityGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleSealMarketStabilityGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'SealMarketStabilityGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleSealMarketStabilityGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'SealMarketStabilityGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleSealMarketStabilityGenesis(source: SealMarketStabilityGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserSealMarketStabilityGenesis(): DictionaryValue<SealMarketStabilityGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSealMarketStabilityGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadSealMarketStabilityGenesis(src.loadRef().beginParse());
        }
    }
}

export type BuyMarketStabilityAth = {
    $$type: 'BuyMarketStabilityAth';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
}

export function storeBuyMarketStabilityAth(src: BuyMarketStabilityAth) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297302872, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
    };
}

export function loadBuyMarketStabilityAth(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297302872) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    return { $$type: 'BuyMarketStabilityAth' as const, query_id: _query_id, amount: _amount, recipient: _recipient };
}

export function loadTupleBuyMarketStabilityAth(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    return { $$type: 'BuyMarketStabilityAth' as const, query_id: _query_id, amount: _amount, recipient: _recipient };
}

export function loadGetterTupleBuyMarketStabilityAth(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    return { $$type: 'BuyMarketStabilityAth' as const, query_id: _query_id, amount: _amount, recipient: _recipient };
}

export function storeTupleBuyMarketStabilityAth(source: BuyMarketStabilityAth) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    return builder.build();
}

export function dictValueParserBuyMarketStabilityAth(): DictionaryValue<BuyMarketStabilityAth> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuyMarketStabilityAth(src)).endCell());
        },
        parse: (src) => {
            return loadBuyMarketStabilityAth(src.loadRef().beginParse());
        }
    }
}

export type FlushMarketStabilityTreasuryTon = {
    $$type: 'FlushMarketStabilityTreasuryTon';
    amount: bigint;
}

export function storeFlushMarketStabilityTreasuryTon(src: FlushMarketStabilityTreasuryTon) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1297303124, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadFlushMarketStabilityTreasuryTon(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1297303124) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'FlushMarketStabilityTreasuryTon' as const, amount: _amount };
}

export function loadTupleFlushMarketStabilityTreasuryTon(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushMarketStabilityTreasuryTon' as const, amount: _amount };
}

export function loadGetterTupleFlushMarketStabilityTreasuryTon(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushMarketStabilityTreasuryTon' as const, amount: _amount };
}

export function storeTupleFlushMarketStabilityTreasuryTon(source: FlushMarketStabilityTreasuryTon) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserFlushMarketStabilityTreasuryTon(): DictionaryValue<FlushMarketStabilityTreasuryTon> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushMarketStabilityTreasuryTon(src)).endCell());
        },
        parse: (src) => {
            return loadFlushMarketStabilityTreasuryTon(src.loadRef().beginParse());
        }
    }
}

export type MarketStabilityTopUpStorageReserve = {
    $$type: 'MarketStabilityTopUpStorageReserve';
}

export function storeMarketStabilityTopUpStorageReserve(src: MarketStabilityTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2422309587, 32);
    };
}

export function loadMarketStabilityTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2422309587) { throw Error('Invalid prefix'); }
    return { $$type: 'MarketStabilityTopUpStorageReserve' as const };
}

export function loadTupleMarketStabilityTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'MarketStabilityTopUpStorageReserve' as const };
}

export function loadGetterTupleMarketStabilityTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'MarketStabilityTopUpStorageReserve' as const };
}

export function storeTupleMarketStabilityTopUpStorageReserve(source: MarketStabilityTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserMarketStabilityTopUpStorageReserve(): DictionaryValue<MarketStabilityTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMarketStabilityTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadMarketStabilityTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type MarketStabilitySellerConfigView = {
    $$type: 'MarketStabilitySellerConfigView';
    sealed: boolean;
    reserve_funder_bound: boolean;
    official_ath_wallet_bound: boolean;
    treasury_bound: boolean;
    pricing_frozen: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    ath_master_address: Address;
    reserve_funder_address: Address;
    official_ath_wallet_address: Address;
    ton_treasury_receiver_address: Address;
    base_tranche_price_nanotons: bigint;
    evidence_x1_tranche_quote_nanotons: bigint;
    pricing_evidence_hash: bigint;
}

export function storeMarketStabilitySellerConfigView(src: MarketStabilitySellerConfigView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeBit(src.reserve_funder_bound);
        b_0.storeBit(src.official_ath_wallet_bound);
        b_0.storeBit(src.treasury_bound);
        b_0.storeBit(src.pricing_frozen);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.ath_master_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.reserve_funder_address);
        b_1.storeAddress(src.official_ath_wallet_address);
        b_1.storeAddress(src.ton_treasury_receiver_address);
        const b_2 = new Builder();
        b_2.storeInt(src.base_tranche_price_nanotons, 257);
        b_2.storeInt(src.evidence_x1_tranche_quote_nanotons, 257);
        b_2.storeInt(src.pricing_evidence_hash, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadMarketStabilitySellerConfigView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _reserve_funder_bound = sc_0.loadBit();
    const _official_ath_wallet_bound = sc_0.loadBit();
    const _treasury_bound = sc_0.loadBit();
    const _pricing_frozen = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _ath_master_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _reserve_funder_address = sc_1.loadAddress();
    const _official_ath_wallet_address = sc_1.loadAddress();
    const _ton_treasury_receiver_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _base_tranche_price_nanotons = sc_2.loadIntBig(257);
    const _evidence_x1_tranche_quote_nanotons = sc_2.loadIntBig(257);
    const _pricing_evidence_hash = sc_2.loadIntBig(257);
    return { $$type: 'MarketStabilitySellerConfigView' as const, sealed: _sealed, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash };
}

export function loadTupleMarketStabilitySellerConfigView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _reserve_funder_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _treasury_bound = source.readBoolean();
    const _pricing_frozen = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _reserve_funder_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _ton_treasury_receiver_address = source.readAddress();
    const _base_tranche_price_nanotons = source.readBigNumber();
    const _evidence_x1_tranche_quote_nanotons = source.readBigNumber();
    const _pricing_evidence_hash = source.readBigNumber();
    return { $$type: 'MarketStabilitySellerConfigView' as const, sealed: _sealed, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash };
}

export function loadGetterTupleMarketStabilitySellerConfigView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _reserve_funder_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _treasury_bound = source.readBoolean();
    const _pricing_frozen = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _reserve_funder_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _ton_treasury_receiver_address = source.readAddress();
    const _base_tranche_price_nanotons = source.readBigNumber();
    const _evidence_x1_tranche_quote_nanotons = source.readBigNumber();
    const _pricing_evidence_hash = source.readBigNumber();
    return { $$type: 'MarketStabilitySellerConfigView' as const, sealed: _sealed, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash };
}

export function storeTupleMarketStabilitySellerConfigView(source: MarketStabilitySellerConfigView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.reserve_funder_bound);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.treasury_bound);
    builder.writeBoolean(source.pricing_frozen);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.reserve_funder_address);
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.ton_treasury_receiver_address);
    builder.writeNumber(source.base_tranche_price_nanotons);
    builder.writeNumber(source.evidence_x1_tranche_quote_nanotons);
    builder.writeNumber(source.pricing_evidence_hash);
    return builder.build();
}

export function dictValueParserMarketStabilitySellerConfigView(): DictionaryValue<MarketStabilitySellerConfigView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMarketStabilitySellerConfigView(src)).endCell());
        },
        parse: (src) => {
            return loadMarketStabilitySellerConfigView(src.loadRef().beginParse());
        }
    }
}

export type MarketStabilitySellerStateView = {
    $$type: 'MarketStabilitySellerStateView';
    phase: bigint;
    reserve_due_ath: bigint;
    treasury_due_ton: bigint;
    pending_query_id: bigint;
    pending_amount_ath: bigint;
    pending_paid_ton: bigint;
    pending_buyer: Address;
    pending_recipient: Address;
    pending_recipient_ath_wallet: Address;
    completed_tranche_count: bigint;
    current_tranche_sold_ath: bigint;
    current_multiplier: bigint;
    current_tranche_remaining_ath: bigint;
    last_terminal_query_id: bigint;
}

export function storeMarketStabilitySellerStateView(src: MarketStabilitySellerStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.phase, 257);
        b_0.storeInt(src.reserve_due_ath, 257);
        b_0.storeInt(src.treasury_due_ton, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.pending_query_id, 257);
        b_1.storeInt(src.pending_amount_ath, 257);
        b_1.storeInt(src.pending_paid_ton, 257);
        const b_2 = new Builder();
        b_2.storeAddress(src.pending_buyer);
        b_2.storeAddress(src.pending_recipient);
        b_2.storeAddress(src.pending_recipient_ath_wallet);
        const b_3 = new Builder();
        b_3.storeInt(src.completed_tranche_count, 257);
        b_3.storeInt(src.current_tranche_sold_ath, 257);
        b_3.storeInt(src.current_multiplier, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.current_tranche_remaining_ath, 257);
        b_4.storeInt(src.last_terminal_query_id, 257);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadMarketStabilitySellerStateView(slice: Slice) {
    const sc_0 = slice;
    const _phase = sc_0.loadIntBig(257);
    const _reserve_due_ath = sc_0.loadIntBig(257);
    const _treasury_due_ton = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pending_query_id = sc_1.loadIntBig(257);
    const _pending_amount_ath = sc_1.loadIntBig(257);
    const _pending_paid_ton = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pending_buyer = sc_2.loadAddress();
    const _pending_recipient = sc_2.loadAddress();
    const _pending_recipient_ath_wallet = sc_2.loadAddress();
    const sc_3 = sc_2.loadRef().beginParse();
    const _completed_tranche_count = sc_3.loadIntBig(257);
    const _current_tranche_sold_ath = sc_3.loadIntBig(257);
    const _current_multiplier = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _current_tranche_remaining_ath = sc_4.loadIntBig(257);
    const _last_terminal_query_id = sc_4.loadIntBig(257);
    return { $$type: 'MarketStabilitySellerStateView' as const, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, current_multiplier: _current_multiplier, current_tranche_remaining_ath: _current_tranche_remaining_ath, last_terminal_query_id: _last_terminal_query_id };
}

export function loadTupleMarketStabilitySellerStateView(source: TupleReader) {
    const _phase = source.readBigNumber();
    const _reserve_due_ath = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_amount_ath = source.readBigNumber();
    const _pending_paid_ton = source.readBigNumber();
    const _pending_buyer = source.readAddress();
    const _pending_recipient = source.readAddress();
    const _pending_recipient_ath_wallet = source.readAddress();
    const _completed_tranche_count = source.readBigNumber();
    const _current_tranche_sold_ath = source.readBigNumber();
    const _current_multiplier = source.readBigNumber();
    const _current_tranche_remaining_ath = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    return { $$type: 'MarketStabilitySellerStateView' as const, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, current_multiplier: _current_multiplier, current_tranche_remaining_ath: _current_tranche_remaining_ath, last_terminal_query_id: _last_terminal_query_id };
}

export function loadGetterTupleMarketStabilitySellerStateView(source: TupleReader) {
    const _phase = source.readBigNumber();
    const _reserve_due_ath = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_amount_ath = source.readBigNumber();
    const _pending_paid_ton = source.readBigNumber();
    const _pending_buyer = source.readAddress();
    const _pending_recipient = source.readAddress();
    const _pending_recipient_ath_wallet = source.readAddress();
    const _completed_tranche_count = source.readBigNumber();
    const _current_tranche_sold_ath = source.readBigNumber();
    const _current_multiplier = source.readBigNumber();
    const _current_tranche_remaining_ath = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    return { $$type: 'MarketStabilitySellerStateView' as const, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, current_multiplier: _current_multiplier, current_tranche_remaining_ath: _current_tranche_remaining_ath, last_terminal_query_id: _last_terminal_query_id };
}

export function storeTupleMarketStabilitySellerStateView(source: MarketStabilitySellerStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.phase);
    builder.writeNumber(source.reserve_due_ath);
    builder.writeNumber(source.treasury_due_ton);
    builder.writeNumber(source.pending_query_id);
    builder.writeNumber(source.pending_amount_ath);
    builder.writeNumber(source.pending_paid_ton);
    builder.writeAddress(source.pending_buyer);
    builder.writeAddress(source.pending_recipient);
    builder.writeAddress(source.pending_recipient_ath_wallet);
    builder.writeNumber(source.completed_tranche_count);
    builder.writeNumber(source.current_tranche_sold_ath);
    builder.writeNumber(source.current_multiplier);
    builder.writeNumber(source.current_tranche_remaining_ath);
    builder.writeNumber(source.last_terminal_query_id);
    return builder.build();
}

export function dictValueParserMarketStabilitySellerStateView(): DictionaryValue<MarketStabilitySellerStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMarketStabilitySellerStateView(src)).endCell());
        },
        parse: (src) => {
            return loadMarketStabilitySellerStateView(src.loadRef().beginParse());
        }
    }
}

export type MarketStabilitySellerTotalsView = {
    $$type: 'MarketStabilitySellerTotalsView';
    reserve_funded_total_ath: bigint;
    sold_ath_total: bigint;
    treasury_flushed_ton_total: bigint;
}

export function storeMarketStabilitySellerTotalsView(src: MarketStabilitySellerTotalsView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.reserve_funded_total_ath, 257);
        b_0.storeInt(src.sold_ath_total, 257);
        b_0.storeInt(src.treasury_flushed_ton_total, 257);
    };
}

export function loadMarketStabilitySellerTotalsView(slice: Slice) {
    const sc_0 = slice;
    const _reserve_funded_total_ath = sc_0.loadIntBig(257);
    const _sold_ath_total = sc_0.loadIntBig(257);
    const _treasury_flushed_ton_total = sc_0.loadIntBig(257);
    return { $$type: 'MarketStabilitySellerTotalsView' as const, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
}

export function loadTupleMarketStabilitySellerTotalsView(source: TupleReader) {
    const _reserve_funded_total_ath = source.readBigNumber();
    const _sold_ath_total = source.readBigNumber();
    const _treasury_flushed_ton_total = source.readBigNumber();
    return { $$type: 'MarketStabilitySellerTotalsView' as const, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
}

export function loadGetterTupleMarketStabilitySellerTotalsView(source: TupleReader) {
    const _reserve_funded_total_ath = source.readBigNumber();
    const _sold_ath_total = source.readBigNumber();
    const _treasury_flushed_ton_total = source.readBigNumber();
    return { $$type: 'MarketStabilitySellerTotalsView' as const, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
}

export function storeTupleMarketStabilitySellerTotalsView(source: MarketStabilitySellerTotalsView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.reserve_funded_total_ath);
    builder.writeNumber(source.sold_ath_total);
    builder.writeNumber(source.treasury_flushed_ton_total);
    return builder.build();
}

export function dictValueParserMarketStabilitySellerTotalsView(): DictionaryValue<MarketStabilitySellerTotalsView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMarketStabilitySellerTotalsView(src)).endCell());
        },
        parse: (src) => {
            return loadMarketStabilitySellerTotalsView(src.loadRef().beginParse());
        }
    }
}

export type MarketStabilitySeller$Data = {
    $$type: 'MarketStabilitySeller$Data';
    genesis_config_hash: bigint;
    deployment_manifest_hash: bigint;
    ath_master_address: Address;
    reserve_funder_address: Address;
    official_ath_wallet_address: Address;
    ton_treasury_receiver_address: Address;
    reserve_funder_bound: boolean;
    official_ath_wallet_bound: boolean;
    treasury_bound: boolean;
    pricing_frozen: boolean;
    sealed: boolean;
    base_tranche_price_nanotons: bigint;
    evidence_x1_tranche_quote_nanotons: bigint;
    pricing_evidence_hash: bigint;
    phase: bigint;
    reserve_due_ath: bigint;
    treasury_due_ton: bigint;
    pending_query_id: bigint;
    pending_amount_ath: bigint;
    pending_paid_ton: bigint;
    pending_buyer: Address;
    pending_recipient: Address;
    pending_recipient_ath_wallet: Address;
    completed_tranche_count: bigint;
    current_tranche_sold_ath: bigint;
    last_terminal_query_id: bigint;
    reserve_funded_total_ath: bigint;
    sold_ath_total: bigint;
    treasury_flushed_ton_total: bigint;
}

export function storeMarketStabilitySeller$Data(src: MarketStabilitySeller$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.genesis_config_hash, 256);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.ath_master_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.reserve_funder_address);
        b_1.storeAddress(src.official_ath_wallet_address);
        b_1.storeAddress(src.ton_treasury_receiver_address);
        b_1.storeBit(src.reserve_funder_bound);
        b_1.storeBit(src.official_ath_wallet_bound);
        b_1.storeBit(src.treasury_bound);
        b_1.storeBit(src.pricing_frozen);
        b_1.storeBit(src.sealed);
        b_1.storeUint(src.base_tranche_price_nanotons, 128);
        const b_2 = new Builder();
        b_2.storeUint(src.evidence_x1_tranche_quote_nanotons, 128);
        b_2.storeUint(src.pricing_evidence_hash, 256);
        b_2.storeUint(src.phase, 8);
        b_2.storeUint(src.reserve_due_ath, 128);
        b_2.storeUint(src.treasury_due_ton, 128);
        b_2.storeUint(src.pending_query_id, 64);
        b_2.storeUint(src.pending_amount_ath, 128);
        b_2.storeUint(src.pending_paid_ton, 128);
        const b_3 = new Builder();
        b_3.storeAddress(src.pending_buyer);
        b_3.storeAddress(src.pending_recipient);
        b_3.storeAddress(src.pending_recipient_ath_wallet);
        b_3.storeUint(src.completed_tranche_count, 8);
        b_3.storeUint(src.current_tranche_sold_ath, 128);
        b_3.storeUint(src.last_terminal_query_id, 64);
        const b_4 = new Builder();
        b_4.storeUint(src.reserve_funded_total_ath, 128);
        b_4.storeUint(src.sold_ath_total, 128);
        b_4.storeUint(src.treasury_flushed_ton_total, 128);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadMarketStabilitySeller$Data(slice: Slice) {
    const sc_0 = slice;
    const _genesis_config_hash = sc_0.loadUintBig(256);
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _ath_master_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _reserve_funder_address = sc_1.loadAddress();
    const _official_ath_wallet_address = sc_1.loadAddress();
    const _ton_treasury_receiver_address = sc_1.loadAddress();
    const _reserve_funder_bound = sc_1.loadBit();
    const _official_ath_wallet_bound = sc_1.loadBit();
    const _treasury_bound = sc_1.loadBit();
    const _pricing_frozen = sc_1.loadBit();
    const _sealed = sc_1.loadBit();
    const _base_tranche_price_nanotons = sc_1.loadUintBig(128);
    const sc_2 = sc_1.loadRef().beginParse();
    const _evidence_x1_tranche_quote_nanotons = sc_2.loadUintBig(128);
    const _pricing_evidence_hash = sc_2.loadUintBig(256);
    const _phase = sc_2.loadUintBig(8);
    const _reserve_due_ath = sc_2.loadUintBig(128);
    const _treasury_due_ton = sc_2.loadUintBig(128);
    const _pending_query_id = sc_2.loadUintBig(64);
    const _pending_amount_ath = sc_2.loadUintBig(128);
    const _pending_paid_ton = sc_2.loadUintBig(128);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_buyer = sc_3.loadAddress();
    const _pending_recipient = sc_3.loadAddress();
    const _pending_recipient_ath_wallet = sc_3.loadAddress();
    const _completed_tranche_count = sc_3.loadUintBig(8);
    const _current_tranche_sold_ath = sc_3.loadUintBig(128);
    const _last_terminal_query_id = sc_3.loadUintBig(64);
    const sc_4 = sc_3.loadRef().beginParse();
    const _reserve_funded_total_ath = sc_4.loadUintBig(128);
    const _sold_ath_total = sc_4.loadUintBig(128);
    const _treasury_flushed_ton_total = sc_4.loadUintBig(128);
    return { $$type: 'MarketStabilitySeller$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, sealed: _sealed, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, last_terminal_query_id: _last_terminal_query_id, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
}

export function loadTupleMarketStabilitySeller$Data(source: TupleReader) {
    const _genesis_config_hash = source.readBigNumber();
    const _deployment_manifest_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _reserve_funder_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _ton_treasury_receiver_address = source.readAddress();
    const _reserve_funder_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _treasury_bound = source.readBoolean();
    const _pricing_frozen = source.readBoolean();
    const _sealed = source.readBoolean();
    const _base_tranche_price_nanotons = source.readBigNumber();
    const _evidence_x1_tranche_quote_nanotons = source.readBigNumber();
    const _pricing_evidence_hash = source.readBigNumber();
    source = source.readTuple();
    const _phase = source.readBigNumber();
    const _reserve_due_ath = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_amount_ath = source.readBigNumber();
    const _pending_paid_ton = source.readBigNumber();
    const _pending_buyer = source.readAddress();
    const _pending_recipient = source.readAddress();
    const _pending_recipient_ath_wallet = source.readAddress();
    const _completed_tranche_count = source.readBigNumber();
    const _current_tranche_sold_ath = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    const _reserve_funded_total_ath = source.readBigNumber();
    const _sold_ath_total = source.readBigNumber();
    source = source.readTuple();
    const _treasury_flushed_ton_total = source.readBigNumber();
    return { $$type: 'MarketStabilitySeller$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, sealed: _sealed, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, last_terminal_query_id: _last_terminal_query_id, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
}

export function loadGetterTupleMarketStabilitySeller$Data(source: TupleReader) {
    const _genesis_config_hash = source.readBigNumber();
    const _deployment_manifest_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _reserve_funder_address = source.readAddress();
    const _official_ath_wallet_address = source.readAddress();
    const _ton_treasury_receiver_address = source.readAddress();
    const _reserve_funder_bound = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _treasury_bound = source.readBoolean();
    const _pricing_frozen = source.readBoolean();
    const _sealed = source.readBoolean();
    const _base_tranche_price_nanotons = source.readBigNumber();
    const _evidence_x1_tranche_quote_nanotons = source.readBigNumber();
    const _pricing_evidence_hash = source.readBigNumber();
    const _phase = source.readBigNumber();
    const _reserve_due_ath = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    const _pending_amount_ath = source.readBigNumber();
    const _pending_paid_ton = source.readBigNumber();
    const _pending_buyer = source.readAddress();
    const _pending_recipient = source.readAddress();
    const _pending_recipient_ath_wallet = source.readAddress();
    const _completed_tranche_count = source.readBigNumber();
    const _current_tranche_sold_ath = source.readBigNumber();
    const _last_terminal_query_id = source.readBigNumber();
    const _reserve_funded_total_ath = source.readBigNumber();
    const _sold_ath_total = source.readBigNumber();
    const _treasury_flushed_ton_total = source.readBigNumber();
    return { $$type: 'MarketStabilitySeller$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, sealed: _sealed, base_tranche_price_nanotons: _base_tranche_price_nanotons, evidence_x1_tranche_quote_nanotons: _evidence_x1_tranche_quote_nanotons, pricing_evidence_hash: _pricing_evidence_hash, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, last_terminal_query_id: _last_terminal_query_id, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
}

export function storeTupleMarketStabilitySeller$Data(source: MarketStabilitySeller$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.genesis_config_hash);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.reserve_funder_address);
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.ton_treasury_receiver_address);
    builder.writeBoolean(source.reserve_funder_bound);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.treasury_bound);
    builder.writeBoolean(source.pricing_frozen);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.base_tranche_price_nanotons);
    builder.writeNumber(source.evidence_x1_tranche_quote_nanotons);
    builder.writeNumber(source.pricing_evidence_hash);
    builder.writeNumber(source.phase);
    builder.writeNumber(source.reserve_due_ath);
    builder.writeNumber(source.treasury_due_ton);
    builder.writeNumber(source.pending_query_id);
    builder.writeNumber(source.pending_amount_ath);
    builder.writeNumber(source.pending_paid_ton);
    builder.writeAddress(source.pending_buyer);
    builder.writeAddress(source.pending_recipient);
    builder.writeAddress(source.pending_recipient_ath_wallet);
    builder.writeNumber(source.completed_tranche_count);
    builder.writeNumber(source.current_tranche_sold_ath);
    builder.writeNumber(source.last_terminal_query_id);
    builder.writeNumber(source.reserve_funded_total_ath);
    builder.writeNumber(source.sold_ath_total);
    builder.writeNumber(source.treasury_flushed_ton_total);
    return builder.build();
}

export function dictValueParserMarketStabilitySeller$Data(): DictionaryValue<MarketStabilitySeller$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMarketStabilitySeller$Data(src)).endCell());
        },
        parse: (src) => {
            return loadMarketStabilitySeller$Data(src.loadRef().beginParse());
        }
    }
}

 type MarketStabilitySeller_init_args = {
    $$type: 'MarketStabilitySeller_init_args';
    genesis_config_hash: bigint;
    ath_master_address: Address;
}

function initMarketStabilitySeller_init_args(src: MarketStabilitySeller_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.ath_master_address);
    };
}

async function MarketStabilitySeller_init(genesis_config_hash: bigint, ath_master_address: Address) {
    const __code = Cell.fromHex('b5ee9c7241029701002d40000114ff00f4a413f4bcf2c80b01020162023a04d8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e8d810101d700fa405902d101db3ce30d111e8e9f111c8020d7217021d749c21f9430d31f01de821041544810bae3025f0f5f0fe070561dd74920c21f9731111dd31f111ede2182104d535246ba8b8d030502fad33fd37f593201111d01111edb3c815ad2f842561ac705f2f4815ad32fc001f2f4815ad4111f2cba01111f01f2f4815ad5111d2aba01111d01f2f4111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211103304021c0f11110f0e11100e551ddb3cdb3c2c38043ce3022182104d534157bae3022182104d535452bae3022182104d535046ba06090c0f04fa5b111cd3fffa403001111d01111edb3cdb3c111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c815a3c5617b3f2f4815a3df828561f01c705b3f2f41516180702fc111b111c111b111a111c111a1119111c11191118111c11181117111c11171116111c11161115111c11151114111c11141113111c11131112111c11121111111c11111110111c11100f111c0f0e111c0e0d111c0d0c111c0c0b111c0b0a111c0a09111c09111c0807065540815a3e111d561edb3c5717571901111c0111156808019ef2f41119111b11191118111a11181117111911171117111811171115111711151114111611147f11161113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c3804f85b111cd3fffa403001111d01111edb3cdb3c111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c815a465616b3f2f4111b111c111b111a111c111a1516180a02fa1119111c11191118111c11181117111c11171116111c11161115111c11151114111c11141113111c11131112111c11121111111c11111110111c11100f111c0f0e111c0e0d111c0d0c111c0c0b111c0b0a111c0a09111c09111c0807065540815a47111ddb3c57165718561d011115c70501111c01f2f41119111b1119490b017e1118111a11181117111911171116111811161114111611141113111511137f11151112111411121111111311111110111211100f11110f0e11100e551ddb3c3804fa5b111cd3fffa403001111d01111edb3cdb3c111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c815a505615b3f2f4815a51f828561f01c705b3f2f41516180d02fc111b111c111b111a111c111a1119111c11191118111c11181117111c11171116111c11161115111c11151114111c11141113111c11131112111c11121111111c11111110111c11100f111c0f0e111c0e0d111c0d0c111c0c0b111c0b0a111c0a09111c09111c0807065540815a52111d561edb3c5715571701111c011113680e019ef2f41119111b11191118111a11181117111911171116111811161115111711151115111611151113111511131112111411127f11141111111311111110111211100f11110f0e11100e10df551cdb3c38043ce3022182104d53534cbae302218210472d9d7dbae3022182104d534558ba1014191d01fc5b111cd3ffd37fd37fd3ff30111c111e111c111b111d111b111a111e111a1119111d11191118111e11181117111d11171116111e11161115111d11151114111e11141113111d11131112111e11121111111d11111110111e11100f111d0f0e111e0e0d111d0d0c111e0c0b111d0b0a111e0a09111d0908111e0807111d071103fe06111e0605111d0504111e0403111d0302111e0201111f011120db3c111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c3f3f3f815a5a1111b30111110116181201fcf2f42e8e37815a5b2bc000f2f4815a5c2ac000f2f4815a5d29c000f2f4815a5e2ec000f2f4815a5f2dc000f2f4815a6322c0009321c0009170e2f2f4de815a60561ac200f2f4815a61561b561bbef2f4815a62561cc300f2f47f2f9370571ade1119111c11191118111b11181117111a111711161119111611151118111513014611141117111411131116111311121115111211111114111111130f11121110552bdb3c3803fc5b111cd3ff30111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111d4130db3cdb3c111c111d111c111b111c111b15161700108159d95613b3f2f400328159db561dc300f2f48159dcc8f842cf16c9f900561ebaf2f402da111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c5712815a645616f2f4815a655615f2f4815a665614f2f456129370571cde7f1112db3c1838003e8159dd21c201f2f48159de561dc00093571d7f94111d21bae201111d01f2f401fc5b111cd33fd37fd31ffa4030111c111e111c111b111d111b111a111e111a1119111d11191118111e11181117111d11171116111e11161115111d11151114111e11141113111d11131112111e11121111111d11111110111e11100f111d0f0e111e0e0d111d0d0c111e0c0b111d0b0a111e0a09111d0908111e0807111d071a02fe06111e0605111d0504111e0403111d0302111e0201111f011120db3c815aa05614f2f4815aa1f842561ac705f2f4815aa2561fc200f2f4815aa31121561ac70501112101f2f4815aa4f8416f24135f0382082dc6c0bef2f4815aa522561fa082289fdf42f6e48000bbf2f40c561da001561da0f84282080f4240111e701121331b01fa70112101c855208210472d9d7e5004cb1f12cb3fcb7fcb1fc91403111e030211200201111f014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e1c01280d11110d0c11100c10bf10ae108c55371023db3c3802fe8efc5b111cd33fd37ffa4030111c111d111c111b111d111b111a111d111a1119111d11191118111d11181117111d11171116111d11161115111d11151114111d11141113111d11131112111d11121111111d11111110111d11100f111d0f0e111d0e0d111d0d0c111d0c0b111d0b0a111d0a09111d0908111d0807111d07e01e2503fe06111d0605111d0504111d0403111d0302111d0201111e01111fdb3c815aaa5614f2f4815aab2fc000f2f4815aac561ec200f2f4561ddb3c815aad561fc200f2f4815aae26c10ff2f4111b111c111b111a111c111a1119111c11191118111c11181117111c11171116111c11161115111c11151114111c11141113111c1113331f2000248159e421843fb9f2f48159e525a412baf2f403fa1112111c11121111111c11111110111c11100f111c0f0e111c0e0d111c0d0c111c0c0b111c0b0a111c0a09111c09111c0807065540815aaf111ddb3c562001bb01111e01f2f4815ab0561f2ebbf2f4815ab1111d5620db3c01111e01f2f4815ab3f828562101c705b3f2f4111b111c111b111a111b111a1119111a111992682102fe1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e561edb3c208208b71b00a082081e8480a0815ab2f8416f24135f0322bef2f4111c111e111c111b111d111b111a111e111a1119111d11191118111e11181117111d1117902202fc1116111e11161115111d11151114111e11141113111d11131112111e11121111111d11111110111e11100f111d0f0e111e0e0d111d0d0c111e0c0b111d0b0a111e0a09111d0908111e0807111d0706111e0605111d0504111e0403111d0302111e0201111d01111e5621db3c3737373737373907561aa171561a561cf8424a2301fc561f8208b71b007f70f828031122030211230201112401c855308210415448105005cb1f13cb3fcb7fcecec956180403112003021121021122014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f842f8416f24135f0301111ca11119111e11191118111d11181117111c11171116111b11161115111a111524028c1114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c02111002103f109e1d103c4ba047804560444013db3cdb3c3138045021821041544811bae30221821041544813bae3022182104d534654bae302571e208210906182d3ba262a323602fc5b111cd33fd37f3001111d01111edb3c815abe2fc001f2f4815abf111e2cba01111e01f2f4815ac0111e2aba01111e01f2f4815ac1f84226c705f2f4111a111c111a1119111b11191118111a1118111711191117111611181116111511171115111411161114111311151113111211141112111111131111111011121110332702200f11110f0e11100e10df551cdb3cdb3c283801f6547ba91fa0513ea0506ea02082280aa87bee538000ba953005a40570de111c111d111c111b111d111b111a111d111a1119111d11191118111d11181117111d11171116111d11161115111d11151114111d11141113111d11131112111d11121111111d11111110111d11100f111d0f0e111d0e0d111d0d102c102b2902d2102a102910281027102645144313111d01db3c111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c2e2f02fe5b111cd33fd37f3001111d01111edb3c815ac8f842561ac705f2f4815ac92fc001f2f4815aca111e2cba01111e01f2f4815acb111e2aba01111e01f2f4111a111c111a1119111b11191118111a1118111711191117111611181116111511171115111411161114111311151113111211141112111111131111111011121110332b02200f11110f0e11100e10df551cdb3cdb3c2c3801f6547ba92b0111110102a0111c111f111c111b111e111b111a111d111a1119111f11191118111e11181117111d11171116111f11161115111e11151114111d11141113111f11131112111e11121111111d11111110111f11100f111e0f0e111d0e0d0c111e0c0b111d0b0a09111e0908111d080706111e0605111d052d03f80403111e0302111d0201111edb3c111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c111c111e111c111b111d111b111a111c111a1119111b11192e2f3000226c663870547000561756185619106e555500023401841118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c31004a20820186a0b9915be070716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002fe5b111cd37f30111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111d4130db3c815adc561ec200f2f4815add561e2e3334000e8159da5613f2f401f4bbf2f4815adef8416f24135f0382081e8480bef2f40c561da10c561da0561701111e70716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311123501281111111211111110111111100f11100f550edb3c3802d08ed130571c111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3ce0c000111dc12101111d01b0e3025f0f5f0ef2c082383701a6815dbff2f0111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c380146c87f01ca00111d111c111b111a111911181117111611151114111311121111111055e03900e001111c01111dcbff01111a01cbff01111801ce1116c8ce01111501ce01111301ce01111101ca001fca001dca001bca0019ca0017cb7f05c8cb7f14cbff12cb07cb7fcb7f12cb3f12cb7f12cb7f02c8ce13ce13ce13cb0713cb7f14cb3f04c8cb7f15cb7f15cb7f12cd12cdcdcdc9ed540201203b43020398b83c3e0359a0dbb513434800063a360404075c03e901640b44076cf38c376cf1b3b8f8f8f8f8f8f8f8f8f8f8f8f8f8fdb0768b8d3d003856125617561756175617562056225621562156215621561c561c561c0359a09bb513434800063a360404075c03e901640b44076cf38c376cf1b3b8f8f8f8f8f8f8f8f8f8f8f8f8f8fdb0768b8d3f01f2547edc547edc547edc53ed111c1127111c111b1126111b111a1125111a1119112411191118112311181117112211171116112111161115112011151114111f11141113111e11131112111d11121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e084002fc07111d070611270605112605041125040311240302112302011122011121db3c111c111d111c111b111d111b111a111d111a1119111d11191118111d11181117111d11171116111d11161115111d11151114111d11141113111d11131112111d11121111111d11111110111d11100f111d0f0e111d0e0d111d0d0c111d0c944102fa0b111d0b0a111d0a09111d09111d0807065540db3c0c11220c0b11210b0a11200a09111f090811290807112807061127060511260504112504031124030211230201111e015625111e112a111e111d1129111d111c1128111c111b1127111b111a1126111a111911251119111811241118111711231117111611221116924200bc1115112111151114112011141113111f11131112111e11121111111d11111110111c11100f111b0f0e111a0e1117111911171116111811161115111711151114111611141112111511121111111411111110111311100f11120f5e2e10ef020120448a0201204547033fb7e5fda89a1a400031d1b020203ae01f480b205a203b679c61bb678d9e6d9c708b8d4600065472100343b6273da89a1a400031d1b020203ae01f480b205a203b679c61bb678ae20be1ed9a308b8d480104db3c490108f828db3c4a016a20fa44307058561ddb3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d04b012488c87001ca0055215023810101cf00cecec94c0114ff00f4a413f4bcf2c80b4d0201624e8404f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba4f595b5c046e058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812bae30220821041544815bae30220821041544817ba5051525300e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ce30d33fd37f593281378c22c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ce30d33fd37f59328137f022c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403fe8e6730d33fd37f59328138b822c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544819bae302208210472d9d7dbae3022054555600ce30d33fd37f593281392622c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54016430d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed545702f2821089129d5fba8eb230d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e08210a11a7001ba8eb1d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f07575703f68137fa21c200f2f48137fff8416f24135f038208895440bef2f48137fb5391bef2f455525387db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e28137fc216eb3f2f46f23308137fd511abaf2f41047103645768137fe5167db3c500bba16f2f45137a15063810101f45a3087815802d840155033045177db3c705395db3c707f541db980400ec855308210415448125005cb1f13cb3fcb7fcecec91036105c104a103b103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00552212787901fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa025a0052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103555127c043ce30221821041544814bae30221821041544816bae30221821041544818ba5d5f626504da5b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f482083d090081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a15167a1554029db3c705410b5db3c7f541ba7710fc86778795e00e455308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c41a0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00505503c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4517aa1554129db3c706769786002fc5410b5db3c50dc7f7128544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1057104d103e4cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110371615137961013e4440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed546d04ea5b05d33fd37ffa40fa40d37fd3078138a4f8422bc705f2f48138a5534ac705f2f4105a1049103847bc5398db3c8138a62bc200f2f48138a728c200f2f48138a8536bbef2f48138a9288209c9c380bef2f427db3c208208989680a08138aaf8416f24135f0322bef2f4517ca155412bdb3c705410d56769786302fcdb3c4ae07f7128513f4f13011113011114c855608210415448175008cb1f16cb3f14cb7f12cececb7fcb07cec9106b105b104e10394cd0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0301a110471046415014137964013adb3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed546d043ce30221821041544812bae30221821041544815bae30221821041544817ba666e6f7304fc5b05d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd30730813912f8422ec705f2f4813913537dc705f2f4105d104c103b4aef5376db3c81391429c200f2f48139152ec200f2f48139165369bef2f48139172e8209c9c380bef2f42ddb3c208208989680a0813918f8416f24135f0322bef2f4517aa1554129db3c706769786a035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f45504686868000afa4430c000002482080f4240a082086acfc0a082081e8480a003fe5410b5db3c105d104c7f7128516d0605111505041114040311130302111202011116011117c85590821041544819500bcb1f19cb3f17cb7f15ce13cecb7f01c8cbff12cb3f12cb7f12cb0f12cb07cdc91035104a10394cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c901796b6c001a58cf8680cf8480f400f400cf810162fb00f8416f24135f035004a11057104615103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed546d004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002f05b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382081e8480bef2f45134a0708040077f07c8598210415448115003cb1fcb3fcb7fc91049473016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00405503787c04f45b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082086acfc0a082081e8480a0bef2f410354014503b541a09db3c555053b6db3c8137eb24810101237881877002fc59f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da0810101f82352d0561001c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f544d9052fe12c855308210472d9d7d5005cb1f13cb3fcb7fcb1fcec9104910384b70441359c8cf8580ca0089717200011000cacf16ce01fa02806acf40f400c901fb0082080f42407009700bc8598210415448115003cb1fcb3fcb7fc9104749301a441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0013c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544819bae302218210472d9d7ebae302218210504e5052ba74777d8004fe5b05d33fd37ffa40fa40d37fd3078138ae26c200f2f48138aff842105c104b103a49de26db3c1fc7051df2f48138b02ac200f2f48138b1f8416f24135f032b82080f4240a082086acfc0a082081e8480a0bef2f410354014503c541b0cdb3c55505376db3c8138b2248101012359f40c6fa131b3f2f48138b32c8209c9c3807881877501fcbef2f48138b4238101012359f40c6fa131b3f2f4516da0810101f823561001561001c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f29514f104a030211110250dc1034c85550821089129d5f5007cb1f15cb3f13cb7fcb1fcecb07cec923103a48dd441359c8cf8580ca00cf8440ce01fa027600c8806acf40f400c901fb0082080f42407004700ac8598210415448115003cb1fcb3fcb7fc91048483019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103510341023c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fa5b05d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd3073081391c29c200f2f481391df842105f104e103d102c01111001111129db3c01111201c70501111001f2f481391e26c200f2f481391ff8416f24135f032782080f4240a082086acfc0a082081e8480a0bef2f410354014503f541e07db3c555053a6db3c7881877a016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0790026f82ac87001ca0055215023810101cf00cecec901ea813920248101012359f40c6fa131b3f2f481392156118209c9c380bef2f4813922238101012359f40c6fa131b3f2f4516aa0810101f823546bd0c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f2c517c107a06105c041114040311120302111102011110010f1067c87b01fe55808210a11a7001500acb1f18cb3f16cb7f14cb1f12cecbffcb3fcb7fcb0fcb07c92804103c4baa441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f424070047004c8598210415448115003cb1fcb3fcb7fc910474730441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010351443307c0036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fc5b05d33fd37fd31f30813804f84227c705f2f481380522c200f2f4478727db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206ee3026f2330813807511bbaf2f4555181380807db3c5009ba16f2f481010120103654471350aa216e955b59f45a3098c801cf004133f442e25046877e817f008a3037810101530150994133f40c6fa19401d70030925b6de2813806216eb3f2f481380908ba17f2f45513c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54004c810101f45a301510344013c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fe8ffd5b05d33fd31f30105610451034437727db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e281380e216eb3f2f46f23105910481037469881380f07db3c500bba16f2f4813810f8230882015180a018be17f2f4810101541400546690216e955b59f45a3098c801cf004133f442e2878182830026c8821041544e4901cb1f01cf16c9f900a9381f008a8101012010395446135099216e955b59f45a3098c801cf004133f442e25034810101f45a304015504403c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54006ae037c00006c12116b08e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c0820201488588017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c648860166db3c810101240259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206e96307070545600e06f237f552087000a01aa1f01a00179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c63889000654754303ebb909fed44d0d200018e8d810101d700fa405902d101db3ce30d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6cd188b8d8f01f68159d822c300f2f47054711124707070707054799954700054700056135614547222547000111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910788c0004106701fed3ffd3fffa40d401d0fa40fa40fa40d200d200d200d200d200d37fd430d0d37fd3ffd307d37fd37fd33fd37fd37fd430d0fa40fa40fa40d307d37fd33fd430d0d37fd37fd37f30111a111d111a111a111c111a111a111b111a571d111b111c111b111a111b111a1119111a11191118111911181117111811171116111711168e00541115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e0104db3c9001f68159e05615f2f48159e121c200f2f4111c111d111c111b111d111b111a111d111a1119111d11191118111d11181117111d11171116111d11161115111d11151114111d11141113111d11131112111d11121111111d11111110111d11100f111d0f0e111d0e0d111d0d0c111d0c0b111d0b0a111d0a09111d09111d9102f80807065540db3c8159e221c200f2f4561e8159e302bbf2f45611111c111d111c111b111d111b111a111d111a1119111d11191118111d11181117111d11171116111d11161115111d11151114111d11141113111d11131112111d11121111111d11111110111d11100f111d0f0e111d0e0d111d0d0c111d0c0b111d0b9293002225c20e9170e082280aa87bee53800025a102fc0a111d0a09111d09111d0807065540db3c01111e01a801111ea8111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710469495000625a6020120103544301282280aa87bee538000db3c9600268159df21c200f2f421925b70e101a501a904a4a023e9d6');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initMarketStabilitySeller_init_args({ $$type: 'MarketStabilitySeller_init_args', genesis_config_hash, ath_master_address })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const MarketStabilitySeller_errors = {
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

export const MarketStabilitySeller_errors_backward = {
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

const MarketStabilitySeller_types: ABIType[] = [
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
    {"name":"AthTransferNotificationProfileAvatar","header":2702864385,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHTransferRequest","header":1096042512,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHTransferRequestWithNotify","header":1096042516,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferRequestMintUsername","header":1096042518,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHTransferRequestProfileAvatar","header":1096042520,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHInternalTransfer","header":1096042514,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHInternalTransferWithNotify","header":1096042517,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHInternalTransferMintUsername","header":1096042519,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHInternalTransferProfileAvatar","header":1096042521,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHTransferAck","header":1096042513,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferFailed","header":1096042515,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHWalletDataView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PendingAthTransferNotificationView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"processed_notifications","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pruned_notification_acks","type":{"kind":"dict","key":"int","value":"int"}}]},
    {"name":"BindMarketStabilityReserveFunder","header":1297306182,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"reserve_funder_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindMarketStabilityOfficialAthWallet","header":1297301847,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindMarketStabilityTreasury","header":1297306706,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ton_treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"FreezeMarketStabilityPricing","header":1297305670,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"base_tranche_price_nanotons","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"evidence_x1_tranche_quote_nanotons","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pricing_evidence_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"SealMarketStabilityGenesis","header":1297306444,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"BuyMarketStabilityAth","header":1297302872,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"FlushMarketStabilityTreasuryTon","header":1297303124,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"MarketStabilityTopUpStorageReserve","header":2422309587,"fields":[]},
    {"name":"MarketStabilitySellerConfigView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"reserve_funder_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pricing_frozen","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"reserve_funder_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ton_treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"base_tranche_price_nanotons","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"evidence_x1_tranche_quote_nanotons","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pricing_evidence_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MarketStabilitySellerStateView","header":null,"fields":[{"name":"phase","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_amount_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_paid_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"completed_tranche_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_tranche_sold_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_multiplier","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_tranche_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_terminal_query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MarketStabilitySellerTotalsView","header":null,"fields":[{"name":"reserve_funded_total_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sold_ath_total","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_flushed_ton_total","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MarketStabilitySeller$Data","header":null,"fields":[{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"reserve_funder_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ton_treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"reserve_funder_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pricing_frozen","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"base_tranche_price_nanotons","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"evidence_x1_tranche_quote_nanotons","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pricing_evidence_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"phase","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"reserve_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"treasury_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_amount_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_paid_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"completed_tranche_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"current_tranche_sold_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"last_terminal_query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"reserve_funded_total_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sold_ath_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"treasury_flushed_ton_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
]

const MarketStabilitySeller_opcodes = {
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
    "AthTransferNotificationProfileAvatar": 2702864385,
    "ATHTransferRequest": 1096042512,
    "ATHTransferRequestWithNotify": 1096042516,
    "ATHTransferRequestMintUsername": 1096042518,
    "ATHTransferRequestProfileAvatar": 1096042520,
    "ATHInternalTransfer": 1096042514,
    "ATHInternalTransferWithNotify": 1096042517,
    "ATHInternalTransferMintUsername": 1096042519,
    "ATHInternalTransferProfileAvatar": 1096042521,
    "ATHTransferAck": 1096042513,
    "ATHTransferFailed": 1096042515,
    "BindMarketStabilityReserveFunder": 1297306182,
    "BindMarketStabilityOfficialAthWallet": 1297301847,
    "BindMarketStabilityTreasury": 1297306706,
    "FreezeMarketStabilityPricing": 1297305670,
    "SealMarketStabilityGenesis": 1297306444,
    "BuyMarketStabilityAth": 1297302872,
    "FlushMarketStabilityTreasuryTon": 1297303124,
    "MarketStabilityTopUpStorageReserve": 2422309587,
}

const MarketStabilitySeller_getters: ABIGetter[] = [
    {"name":"get_market_stability_seller_config","methodId":71222,"arguments":[],"returnType":{"kind":"simple","type":"MarketStabilitySellerConfigView","optional":false}},
    {"name":"get_market_stability_seller_state","methodId":71462,"arguments":[],"returnType":{"kind":"simple","type":"MarketStabilitySellerStateView","optional":false}},
    {"name":"get_market_stability_seller_totals","methodId":106287,"arguments":[],"returnType":{"kind":"simple","type":"MarketStabilitySellerTotalsView","optional":false}},
    {"name":"get_official_ath_wallet_address","methodId":110905,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_quote_ton_for_amount","methodId":118943,"arguments":[{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
]

export const MarketStabilitySeller_getterMapping: { [key: string]: string } = {
    'get_market_stability_seller_config': 'getGetMarketStabilitySellerConfig',
    'get_market_stability_seller_state': 'getGetMarketStabilitySellerState',
    'get_market_stability_seller_totals': 'getGetMarketStabilitySellerTotals',
    'get_official_ath_wallet_address': 'getGetOfficialAthWalletAddress',
    'get_quote_ton_for_amount': 'getGetQuoteTonForAmount',
}

const MarketStabilitySeller_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindMarketStabilityReserveFunder"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindMarketStabilityOfficialAthWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindMarketStabilityTreasury"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FreezeMarketStabilityPricing"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealMarketStabilityGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BuyMarketStabilityAth"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushMarketStabilityTreasuryTon"}},
    {"receiver":"internal","message":{"kind":"typed","type":"MarketStabilityTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30000000n;
export const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2000000n;
export const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2000000n;
export const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7000000n;
export const ATH_OWNER_REQUEST_EXEC_RESERVE = 2000000n;
export const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10000000n;
export const ATH_OWNER_EXCESS_REFUND_MIN_VALUE = 100000n;
export const ATH_GENESIS_SUPPLY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 1096044105n;
export const ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD = 4294967296n;
export const ATH_PENDING_NOTIFICATION_TTL = 86400n;
export const MARKET_STABILITY_TOTAL_RESERVE_ATH = 45000000000000000n;
export const MARKET_STABILITY_TRANCHE_ATH = 3000000000000000n;
export const MARKET_STABILITY_TRANCHE_COUNT = 15n;
export const MARKET_STABILITY_START_MULTIPLIER = 2n;
export const MARKET_STABILITY_END_MULTIPLIER = 16n;
export const MARKET_STABILITY_ATH_NOTIFY_ACK_VALUE = 1000000n;
export const MARKET_STABILITY_LOCAL_EXEC_RESERVE = 2000000n;
export const MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE = 12000000n;
export const MARKET_STABILITY_BUY_EXEC_RESERVE = 2000000n;
export const MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE = 2000000n;
export const MARKET_STABILITY_EXCESS_REFUND_MIN_VALUE = 100000n;
export const MARKET_STABILITY_PHASE_IDLE = 0n;
export const MARKET_STABILITY_PHASE_PENDING_ATH_TRANSFER = 1n;
export const UINT64_MAX = 18446744073709551615n;

export class MarketStabilitySeller implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = MarketStabilitySeller_errors_backward;
    public static readonly opcodes = MarketStabilitySeller_opcodes;
    
    static async init(genesis_config_hash: bigint, ath_master_address: Address) {
        return await MarketStabilitySeller_init(genesis_config_hash, ath_master_address);
    }
    
    static async fromInit(genesis_config_hash: bigint, ath_master_address: Address) {
        const __gen_init = await MarketStabilitySeller_init(genesis_config_hash, ath_master_address);
        const address = contractAddress(0, __gen_init);
        return new MarketStabilitySeller(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new MarketStabilitySeller(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  MarketStabilitySeller_types,
        getters: MarketStabilitySeller_getters,
        receivers: MarketStabilitySeller_receivers,
        errors: MarketStabilitySeller_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindMarketStabilityReserveFunder | BindMarketStabilityOfficialAthWallet | BindMarketStabilityTreasury | FreezeMarketStabilityPricing | SealMarketStabilityGenesis | AthTransferNotification | BuyMarketStabilityAth | ATHTransferAck | ATHTransferFailed | FlushMarketStabilityTreasuryTon | MarketStabilityTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindMarketStabilityReserveFunder') {
            body = beginCell().store(storeBindMarketStabilityReserveFunder(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindMarketStabilityOfficialAthWallet') {
            body = beginCell().store(storeBindMarketStabilityOfficialAthWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindMarketStabilityTreasury') {
            body = beginCell().store(storeBindMarketStabilityTreasury(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FreezeMarketStabilityPricing') {
            body = beginCell().store(storeFreezeMarketStabilityPricing(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealMarketStabilityGenesis') {
            body = beginCell().store(storeSealMarketStabilityGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotification') {
            body = beginCell().store(storeAthTransferNotification(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BuyMarketStabilityAth') {
            body = beginCell().store(storeBuyMarketStabilityAth(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferAck') {
            body = beginCell().store(storeATHTransferAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferFailed') {
            body = beginCell().store(storeATHTransferFailed(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushMarketStabilityTreasuryTon') {
            body = beginCell().store(storeFlushMarketStabilityTreasuryTon(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'MarketStabilityTopUpStorageReserve') {
            body = beginCell().store(storeMarketStabilityTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetMarketStabilitySellerConfig(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_market_stability_seller_config', builder.build())).stack;
        const result = loadGetterTupleMarketStabilitySellerConfigView(source);
        return result;
    }
    
    async getGetMarketStabilitySellerState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_market_stability_seller_state', builder.build())).stack;
        const result = loadGetterTupleMarketStabilitySellerStateView(source);
        return result;
    }
    
    async getGetMarketStabilitySellerTotals(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_market_stability_seller_totals', builder.build())).stack;
        const result = loadGetterTupleMarketStabilitySellerTotalsView(source);
        return result;
    }
    
    async getGetOfficialAthWalletAddress(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_official_ath_wallet_address', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getGetQuoteTonForAmount(provider: ContractProvider, amount: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(amount);
        const source = (await provider.get('get_quote_ton_for_amount', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
}