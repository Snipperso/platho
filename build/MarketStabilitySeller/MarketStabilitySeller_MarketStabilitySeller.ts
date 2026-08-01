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
    sender_key: bigint;
    amount: bigint;
    sender_wallet: Address;
}

export function storeAthTransferNotification(src: AthTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1194171773, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_wallet);
    };
}

export function loadAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1194171773) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _amount = sc_0.loadUintBig(128);
    const _sender_wallet = sc_0.loadAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, sender_wallet: _sender_wallet };
}

export function loadTupleAthTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_wallet = source.readAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, sender_wallet: _sender_wallet };
}

export function loadGetterTupleAthTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_wallet = source.readAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, sender_wallet: _sender_wallet };
}

export function storeTupleAthTransferNotification(source: AthTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
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
        b_0.storeUint(src.sender_key, 160);
    };
}

export function loadAthTransferNotificationAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1194171774) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_key = sc_0.loadUintBig(160);
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

export type AthTransferNotificationRefund = {
    $$type: 'AthTransferNotificationRefund';
    query_id: bigint;
    amount: bigint;
    sender_key: bigint;
}

export function storeAthTransferNotificationRefund(src: AthTransferNotificationRefund) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042526, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.sender_key, 160);
    };
}

export function loadAthTransferNotificationRefund(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042526) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_key = sc_0.loadUintBig(160);
    return { $$type: 'AthTransferNotificationRefund' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key };
}

export function loadTupleAthTransferNotificationRefund(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    return { $$type: 'AthTransferNotificationRefund' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key };
}

export function loadGetterTupleAthTransferNotificationRefund(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    return { $$type: 'AthTransferNotificationRefund' as const, query_id: _query_id, amount: _amount, sender_key: _sender_key };
}

export function storeTupleAthTransferNotificationRefund(source: AthTransferNotificationRefund) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.sender_key);
    return builder.build();
}

export function dictValueParserAthTransferNotificationRefund(): DictionaryValue<AthTransferNotificationRefund> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationRefund(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationRefund(src.loadRef().beginParse());
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
        b_0.storeUint(src.sender_key, 160);
    };
}

export function loadPruneStaleNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1347309650) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
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

export type AthTransferNotificationRegistryMintUsername = {
    $$type: 'AthTransferNotificationRegistryMintUsername';
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: bigint;
    username: Cell;
}

export function storeAthTransferNotificationRegistryMintUsername(src: AthTransferNotificationRegistryMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2299698528, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.payer_wallet);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.username_len, 8);
        b_0.storeRef(src.username);
    };
}

export function loadAthTransferNotificationRegistryMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2299698528) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _amount = sc_0.loadUintBig(128);
    const _payer_wallet = sc_0.loadAddress();
    const _owner_wallet = sc_0.loadAddress();
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0.loadRef();
    return { $$type: 'AthTransferNotificationRegistryMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleAthTransferNotificationRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell();
    return { $$type: 'AthTransferNotificationRegistryMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleAthTransferNotificationRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell();
    return { $$type: 'AthTransferNotificationRegistryMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleAthTransferNotificationRegistryMintUsername(source: AthTransferNotificationRegistryMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.payer_wallet);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeCell(source.username);
    return builder.build();
}

export function dictValueParserAthTransferNotificationRegistryMintUsername(): DictionaryValue<AthTransferNotificationRegistryMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationRegistryMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationRegistryMintUsername(src.loadRef().beginParse());
        }
    }
}

export type AthTransferNotificationRegistryProfileAvatar = {
    $$type: 'AthTransferNotificationRegistryProfileAvatar';
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    payer_wallet: Address;
    owner_wallet: Address;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeAthTransferNotificationRegistryProfileAvatar(src: AthTransferNotificationRegistryProfileAvatar) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2702864386, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.payer_wallet);
        b_0.storeAddress(src.owner_wallet);
        const b_1 = new Builder();
        b_1.storeUint(src.avatar_hash, 256);
        b_1.storeUint(src.avatar_entry_id, 64);
        b_1.storeUint(src.avatar_stream_id, 128);
        b_1.storeUint(src.avatar_part_count, 16);
        b_1.storeUint(src.media_format, 8);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadAthTransferNotificationRegistryProfileAvatar(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2702864386) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _amount = sc_0.loadUintBig(128);
    const _payer_wallet = sc_0.loadAddress();
    const _owner_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _avatar_hash = sc_1.loadUintBig(256);
    const _avatar_entry_id = sc_1.loadUintBig(64);
    const _avatar_stream_id = sc_1.loadUintBig(128);
    const _avatar_part_count = sc_1.loadUintBig(16);
    const _media_format = sc_1.loadUintBig(8);
    return { $$type: 'AthTransferNotificationRegistryProfileAvatar' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleAthTransferNotificationRegistryProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'AthTransferNotificationRegistryProfileAvatar' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleAthTransferNotificationRegistryProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'AthTransferNotificationRegistryProfileAvatar' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleAthTransferNotificationRegistryProfileAvatar(source: AthTransferNotificationRegistryProfileAvatar) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.payer_wallet);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserAthTransferNotificationRegistryProfileAvatar(): DictionaryValue<AthTransferNotificationRegistryProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationRegistryProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationRegistryProfileAvatar(src.loadRef().beginParse());
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

export type ATHTransferRequestRegistryProfileAvatar = {
    $$type: 'ATHTransferRequestRegistryProfileAvatar';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
    notify_value: bigint;
    owner_wallet: Address;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeATHTransferRequestRegistryProfileAvatar(src: ATHTransferRequestRegistryProfileAvatar) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042522, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        const b_1 = new Builder();
        b_1.storeAddress(src.owner_wallet);
        b_1.storeUint(src.avatar_hash, 256);
        b_1.storeUint(src.avatar_entry_id, 64);
        b_1.storeUint(src.avatar_stream_id, 128);
        b_1.storeUint(src.avatar_part_count, 16);
        b_1.storeUint(src.media_format, 8);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHTransferRequestRegistryProfileAvatar(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042522) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _owner_wallet = sc_1.loadAddress();
    const _avatar_hash = sc_1.loadUintBig(256);
    const _avatar_entry_id = sc_1.loadUintBig(64);
    const _avatar_stream_id = sc_1.loadUintBig(128);
    const _avatar_part_count = sc_1.loadUintBig(16);
    const _media_format = sc_1.loadUintBig(8);
    return { $$type: 'ATHTransferRequestRegistryProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleATHTransferRequestRegistryProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHTransferRequestRegistryProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleATHTransferRequestRegistryProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHTransferRequestRegistryProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleATHTransferRequestRegistryProfileAvatar(source: ATHTransferRequestRegistryProfileAvatar) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserATHTransferRequestRegistryProfileAvatar(): DictionaryValue<ATHTransferRequestRegistryProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestRegistryProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestRegistryProfileAvatar(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferRequestRegistryMintUsername = {
    $$type: 'ATHTransferRequestRegistryMintUsername';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
    notify_value: bigint;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeATHTransferRequestRegistryMintUsername(src: ATHTransferRequestRegistryMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042524, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        const b_1 = new Builder();
        b_1.storeAddress(src.owner_wallet);
        b_1.storeUint(src.username_len, 8);
        b_1.storeBuilder(src.username.asBuilder());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHTransferRequestRegistryMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042524) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _owner_wallet = sc_1.loadAddress();
    const _username_len = sc_1.loadUintBig(8);
    const _username = sc_1;
    return { $$type: 'ATHTransferRequestRegistryMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleATHTransferRequestRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHTransferRequestRegistryMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleATHTransferRequestRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHTransferRequestRegistryMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleATHTransferRequestRegistryMintUsername(source: ATHTransferRequestRegistryMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserATHTransferRequestRegistryMintUsername(): DictionaryValue<ATHTransferRequestRegistryMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestRegistryMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestRegistryMintUsername(src.loadRef().beginParse());
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

export type ATHInternalTransferRegistryProfileAvatar = {
    $$type: 'ATHInternalTransferRegistryProfileAvatar';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
    notify_value: bigint;
    owner_wallet: Address;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeATHInternalTransferRegistryProfileAvatar(src: ATHInternalTransferRegistryProfileAvatar) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042523, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        const b_1 = new Builder();
        b_1.storeAddress(src.owner_wallet);
        b_1.storeUint(src.avatar_hash, 256);
        b_1.storeUint(src.avatar_entry_id, 64);
        b_1.storeUint(src.avatar_stream_id, 128);
        b_1.storeUint(src.avatar_part_count, 16);
        b_1.storeUint(src.media_format, 8);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHInternalTransferRegistryProfileAvatar(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042523) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _owner_wallet = sc_1.loadAddress();
    const _avatar_hash = sc_1.loadUintBig(256);
    const _avatar_entry_id = sc_1.loadUintBig(64);
    const _avatar_stream_id = sc_1.loadUintBig(128);
    const _avatar_part_count = sc_1.loadUintBig(16);
    const _media_format = sc_1.loadUintBig(8);
    return { $$type: 'ATHInternalTransferRegistryProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleATHInternalTransferRegistryProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHInternalTransferRegistryProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleATHInternalTransferRegistryProfileAvatar(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'ATHInternalTransferRegistryProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleATHInternalTransferRegistryProfileAvatar(source: ATHInternalTransferRegistryProfileAvatar) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserATHInternalTransferRegistryProfileAvatar(): DictionaryValue<ATHInternalTransferRegistryProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferRegistryProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferRegistryProfileAvatar(src.loadRef().beginParse());
        }
    }
}

export type ATHInternalTransferRegistryMintUsername = {
    $$type: 'ATHInternalTransferRegistryMintUsername';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
    notify_value: bigint;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeATHInternalTransferRegistryMintUsername(src: ATHInternalTransferRegistryMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042525, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.notify_value, 128);
        const b_1 = new Builder();
        b_1.storeAddress(src.owner_wallet);
        b_1.storeUint(src.username_len, 8);
        b_1.storeBuilder(src.username.asBuilder());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHInternalTransferRegistryMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042525) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _notify_value = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _owner_wallet = sc_1.loadAddress();
    const _username_len = sc_1.loadUintBig(8);
    const _username = sc_1;
    return { $$type: 'ATHInternalTransferRegistryMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleATHInternalTransferRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHInternalTransferRegistryMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleATHInternalTransferRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHInternalTransferRegistryMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleATHInternalTransferRegistryMintUsername(source: ATHInternalTransferRegistryMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.notify_value);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserATHInternalTransferRegistryMintUsername(): DictionaryValue<ATHInternalTransferRegistryMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferRegistryMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferRegistryMintUsername(src.loadRef().beginParse());
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

export type JettonTransfer = {
    $$type: 'JettonTransfer';
    query_id: bigint;
    amount: bigint;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell | null;
    forward_ton_amount: bigint;
    forward_payload: Slice;
}

export function storeJettonTransfer(src: JettonTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(260734629, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeCoins(src.amount);
        b_0.storeAddress(src.destination);
        b_0.storeAddress(src.response_destination);
        if (src.custom_payload !== null && src.custom_payload !== undefined) { b_0.storeBit(true).storeRef(src.custom_payload); } else { b_0.storeBit(false); }
        b_0.storeCoins(src.forward_ton_amount);
        b_0.storeBuilder(src.forward_payload.asBuilder());
    };
}

export function loadJettonTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 260734629) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadCoins();
    const _destination = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _custom_payload = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _forward_ton_amount = sc_0.loadCoins();
    const _forward_payload = sc_0;
    return { $$type: 'JettonTransfer' as const, query_id: _query_id, amount: _amount, destination: _destination, response_destination: _response_destination, custom_payload: _custom_payload, forward_ton_amount: _forward_ton_amount, forward_payload: _forward_payload };
}

export function loadTupleJettonTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _destination = source.readAddress();
    const _response_destination = source.readAddress();
    const _custom_payload = source.readCellOpt();
    const _forward_ton_amount = source.readBigNumber();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'JettonTransfer' as const, query_id: _query_id, amount: _amount, destination: _destination, response_destination: _response_destination, custom_payload: _custom_payload, forward_ton_amount: _forward_ton_amount, forward_payload: _forward_payload };
}

export function loadGetterTupleJettonTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _destination = source.readAddress();
    const _response_destination = source.readAddress();
    const _custom_payload = source.readCellOpt();
    const _forward_ton_amount = source.readBigNumber();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'JettonTransfer' as const, query_id: _query_id, amount: _amount, destination: _destination, response_destination: _response_destination, custom_payload: _custom_payload, forward_ton_amount: _forward_ton_amount, forward_payload: _forward_payload };
}

export function storeTupleJettonTransfer(source: JettonTransfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.destination);
    builder.writeAddress(source.response_destination);
    builder.writeCell(source.custom_payload);
    builder.writeNumber(source.forward_ton_amount);
    builder.writeSlice(source.forward_payload.asCell());
    return builder.build();
}

export function dictValueParserJettonTransfer(): DictionaryValue<JettonTransfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadJettonTransfer(src.loadRef().beginParse());
        }
    }
}

export type JettonInternalTransfer = {
    $$type: 'JettonInternalTransfer';
    query_id: bigint;
    amount: bigint;
    from: Address;
    response_address: Address;
    forward_ton_amount: bigint;
    forward_payload: Slice;
}

export function storeJettonInternalTransfer(src: JettonInternalTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(395134233, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeCoins(src.amount);
        b_0.storeAddress(src.from);
        b_0.storeAddress(src.response_address);
        b_0.storeCoins(src.forward_ton_amount);
        b_0.storeBuilder(src.forward_payload.asBuilder());
    };
}

export function loadJettonInternalTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 395134233) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadCoins();
    const _from = sc_0.loadAddress();
    const _response_address = sc_0.loadAddress();
    const _forward_ton_amount = sc_0.loadCoins();
    const _forward_payload = sc_0;
    return { $$type: 'JettonInternalTransfer' as const, query_id: _query_id, amount: _amount, from: _from, response_address: _response_address, forward_ton_amount: _forward_ton_amount, forward_payload: _forward_payload };
}

export function loadTupleJettonInternalTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _from = source.readAddress();
    const _response_address = source.readAddress();
    const _forward_ton_amount = source.readBigNumber();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'JettonInternalTransfer' as const, query_id: _query_id, amount: _amount, from: _from, response_address: _response_address, forward_ton_amount: _forward_ton_amount, forward_payload: _forward_payload };
}

export function loadGetterTupleJettonInternalTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _from = source.readAddress();
    const _response_address = source.readAddress();
    const _forward_ton_amount = source.readBigNumber();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'JettonInternalTransfer' as const, query_id: _query_id, amount: _amount, from: _from, response_address: _response_address, forward_ton_amount: _forward_ton_amount, forward_payload: _forward_payload };
}

export function storeTupleJettonInternalTransfer(source: JettonInternalTransfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.from);
    builder.writeAddress(source.response_address);
    builder.writeNumber(source.forward_ton_amount);
    builder.writeSlice(source.forward_payload.asCell());
    return builder.build();
}

export function dictValueParserJettonInternalTransfer(): DictionaryValue<JettonInternalTransfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonInternalTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadJettonInternalTransfer(src.loadRef().beginParse());
        }
    }
}

export type JettonTransferNotification = {
    $$type: 'JettonTransferNotification';
    query_id: bigint;
    amount: bigint;
    sender: Address;
    forward_payload: Slice;
}

export function storeJettonTransferNotification(src: JettonTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1935855772, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeCoins(src.amount);
        b_0.storeAddress(src.sender);
        b_0.storeBuilder(src.forward_payload.asBuilder());
    };
}

export function loadJettonTransferNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1935855772) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadCoins();
    const _sender = sc_0.loadAddress();
    const _forward_payload = sc_0;
    return { $$type: 'JettonTransferNotification' as const, query_id: _query_id, amount: _amount, sender: _sender, forward_payload: _forward_payload };
}

export function loadTupleJettonTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender = source.readAddress();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'JettonTransferNotification' as const, query_id: _query_id, amount: _amount, sender: _sender, forward_payload: _forward_payload };
}

export function loadGetterTupleJettonTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender = source.readAddress();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'JettonTransferNotification' as const, query_id: _query_id, amount: _amount, sender: _sender, forward_payload: _forward_payload };
}

export function storeTupleJettonTransferNotification(source: JettonTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender);
    builder.writeSlice(source.forward_payload.asCell());
    return builder.build();
}

export function dictValueParserJettonTransferNotification(): DictionaryValue<JettonTransferNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonTransferNotification(src)).endCell());
        },
        parse: (src) => {
            return loadJettonTransferNotification(src.loadRef().beginParse());
        }
    }
}

export type JettonExcesses = {
    $$type: 'JettonExcesses';
    query_id: bigint;
}

export function storeJettonExcesses(src: JettonExcesses) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3576854235, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadJettonExcesses(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3576854235) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'JettonExcesses' as const, query_id: _query_id };
}

export function loadTupleJettonExcesses(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'JettonExcesses' as const, query_id: _query_id };
}

export function loadGetterTupleJettonExcesses(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'JettonExcesses' as const, query_id: _query_id };
}

export function storeTupleJettonExcesses(source: JettonExcesses) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserJettonExcesses(): DictionaryValue<JettonExcesses> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeJettonExcesses(src)).endCell());
        },
        parse: (src) => {
            return loadJettonExcesses(src.loadRef().beginParse());
        }
    }
}

export type ATHWalletTopUpStorageReserve = {
    $$type: 'ATHWalletTopUpStorageReserve';
}

export function storeATHWalletTopUpStorageReserve(src: ATHWalletTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042503, 32);
    };
}

export function loadATHWalletTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042503) { throw Error('Invalid prefix'); }
    return { $$type: 'ATHWalletTopUpStorageReserve' as const };
}

export function loadTupleATHWalletTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'ATHWalletTopUpStorageReserve' as const };
}

export function loadGetterTupleATHWalletTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'ATHWalletTopUpStorageReserve' as const };
}

export function storeTupleATHWalletTopUpStorageReserve(source: ATHWalletTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserATHWalletTopUpStorageReserve(): DictionaryValue<ATHWalletTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHWalletTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadATHWalletTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type ATHRecoverStuckOutgoing = {
    $$type: 'ATHRecoverStuckOutgoing';
    query_id: bigint;
    recipient_wallet: Address;
}

export function storeATHRecoverStuckOutgoing(src: ATHRecoverStuckOutgoing) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042504, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.recipient_wallet);
    };
}

export function loadATHRecoverStuckOutgoing(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042504) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _recipient_wallet = sc_0.loadAddress();
    return { $$type: 'ATHRecoverStuckOutgoing' as const, query_id: _query_id, recipient_wallet: _recipient_wallet };
}

export function loadTupleATHRecoverStuckOutgoing(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _recipient_wallet = source.readAddress();
    return { $$type: 'ATHRecoverStuckOutgoing' as const, query_id: _query_id, recipient_wallet: _recipient_wallet };
}

export function loadGetterTupleATHRecoverStuckOutgoing(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _recipient_wallet = source.readAddress();
    return { $$type: 'ATHRecoverStuckOutgoing' as const, query_id: _query_id, recipient_wallet: _recipient_wallet };
}

export function storeTupleATHRecoverStuckOutgoing(source: ATHRecoverStuckOutgoing) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.recipient_wallet);
    return builder.build();
}

export function dictValueParserATHRecoverStuckOutgoing(): DictionaryValue<ATHRecoverStuckOutgoing> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHRecoverStuckOutgoing(src)).endCell());
        },
        parse: (src) => {
            return loadATHRecoverStuckOutgoing(src.loadRef().beginParse());
        }
    }
}

export type ATHWalletDataView = {
    $$type: 'ATHWalletDataView';
    balance: bigint;
    owner_address: Address;
    ath_master_address: Address;
    jetton_wallet_code: Cell;
}

export function storeATHWalletDataView(src: ATHWalletDataView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.balance, 257);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeRef(src.jetton_wallet_code);
    };
}

export function loadATHWalletDataView(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadIntBig(257);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _jetton_wallet_code = sc_0.loadRef();
    return { $$type: 'ATHWalletDataView' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, jetton_wallet_code: _jetton_wallet_code };
}

export function loadTupleATHWalletDataView(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _jetton_wallet_code = source.readCell();
    return { $$type: 'ATHWalletDataView' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, jetton_wallet_code: _jetton_wallet_code };
}

export function loadGetterTupleATHWalletDataView(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _jetton_wallet_code = source.readCell();
    return { $$type: 'ATHWalletDataView' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, jetton_wallet_code: _jetton_wallet_code };
}

export function storeTupleATHWalletDataView(source: ATHWalletDataView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeCell(source.jetton_wallet_code);
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
    response_destination: Address;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthTransferNotificationView(src: PendingAthTransferNotificationView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        b_0.storeInt(src.amount, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingAthTransferNotificationView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _amount = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'PendingAthTransferNotificationView' as const, exists: _exists, sender_owner: _sender_owner, response_destination: _response_destination, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthTransferNotificationView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotificationView' as const, exists: _exists, sender_owner: _sender_owner, response_destination: _response_destination, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthTransferNotificationView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotificationView' as const, exists: _exists, sender_owner: _sender_owner, response_destination: _response_destination, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthTransferNotificationView(source: PendingAthTransferNotificationView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
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
    response_destination: Address;
    response_ack_value: bigint;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthTransferNotification(src: PendingAthTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.sender_owner);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.response_ack_value, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _response_ack_value = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, response_destination: _response_destination, response_ack_value: _response_ack_value, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthTransferNotification(source: TupleReader) {
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _response_ack_value = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, response_destination: _response_destination, response_ack_value: _response_ack_value, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthTransferNotification(source: TupleReader) {
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _response_ack_value = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, response_destination: _response_destination, response_ack_value: _response_ack_value, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthTransferNotification(source: PendingAthTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sender_owner);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.response_ack_value);
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

export type PendingAthOutgoingTransfer = {
    $$type: 'PendingAthOutgoingTransfer';
    recipient_wallet: Address;
    response_destination: Address;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthOutgoingTransfer(src: PendingAthOutgoingTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.recipient_wallet);
        b_0.storeAddress(src.response_destination);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingAthOutgoingTransfer(slice: Slice) {
    const sc_0 = slice;
    const _recipient_wallet = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingAthOutgoingTransfer' as const, recipient_wallet: _recipient_wallet, response_destination: _response_destination, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthOutgoingTransfer(source: TupleReader) {
    const _recipient_wallet = source.readAddress();
    const _response_destination = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthOutgoingTransfer' as const, recipient_wallet: _recipient_wallet, response_destination: _response_destination, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthOutgoingTransfer(source: TupleReader) {
    const _recipient_wallet = source.readAddress();
    const _response_destination = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthOutgoingTransfer' as const, recipient_wallet: _recipient_wallet, response_destination: _response_destination, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthOutgoingTransfer(source: PendingAthOutgoingTransfer) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.recipient_wallet);
    builder.writeAddress(source.response_destination);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthOutgoingTransfer(): DictionaryValue<PendingAthOutgoingTransfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthOutgoingTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthOutgoingTransfer(src.loadRef().beginParse());
        }
    }
}

export type ATHWallet$Data = {
    $$type: 'ATHWallet$Data';
    balance: bigint;
    owner_address: Address;
    ath_master_address: Address;
    pending_notifications: Dictionary<bigint, PendingAthTransferNotification>;
    pending_outgoing_transfers: Dictionary<bigint, PendingAthOutgoingTransfer>;
}

export function storeATHWallet$Data(src: ATHWallet$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.balance, 128);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeDict(src.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification());
        b_0.storeDict(src.pending_outgoing_transfers, Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer());
    };
}

export function loadATHWallet$Data(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _pending_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), sc_0);
    const _pending_outgoing_transfers = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), sc_0);
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function loadTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _pending_outgoing_transfers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function loadGetterTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _pending_outgoing_transfers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function storeTupleATHWallet$Data(source: ATHWallet$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeCell(source.pending_notifications.size > 0 ? beginCell().storeDictDirect(source.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification()).endCell() : null);
    builder.writeCell(source.pending_outgoing_transfers.size > 0 ? beginCell().storeDictDirect(source.pending_outgoing_transfers, Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer()).endCell() : null);
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
    return { $$type: 'MarketStabilitySellerConfigView' as const, sealed: _sealed, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, base_tranche_price_nanotons: _base_tranche_price_nanotons };
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
    return { $$type: 'MarketStabilitySellerConfigView' as const, sealed: _sealed, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, base_tranche_price_nanotons: _base_tranche_price_nanotons };
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
    return { $$type: 'MarketStabilitySellerConfigView' as const, sealed: _sealed, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, pricing_frozen: _pricing_frozen, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, base_tranche_price_nanotons: _base_tranche_price_nanotons };
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
    sealed: boolean;
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
        b_1.storeBit(src.sealed);
        b_1.storeUint(src.phase, 8);
        b_1.storeUint(src.reserve_due_ath, 128);
        const b_2 = new Builder();
        b_2.storeUint(src.treasury_due_ton, 128);
        b_2.storeUint(src.pending_query_id, 64);
        b_2.storeUint(src.pending_amount_ath, 128);
        b_2.storeUint(src.pending_paid_ton, 128);
        b_2.storeAddress(src.pending_buyer);
        b_2.storeAddress(src.pending_recipient);
        const b_3 = new Builder();
        b_3.storeAddress(src.pending_recipient_ath_wallet);
        b_3.storeUint(src.completed_tranche_count, 8);
        b_3.storeUint(src.current_tranche_sold_ath, 128);
        b_3.storeUint(src.last_terminal_query_id, 64);
        b_3.storeUint(src.reserve_funded_total_ath, 128);
        b_3.storeUint(src.sold_ath_total, 128);
        b_3.storeUint(src.treasury_flushed_ton_total, 128);
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
    const _sealed = sc_1.loadBit();
    const _phase = sc_1.loadUintBig(8);
    const _reserve_due_ath = sc_1.loadUintBig(128);
    const sc_2 = sc_1.loadRef().beginParse();
    const _treasury_due_ton = sc_2.loadUintBig(128);
    const _pending_query_id = sc_2.loadUintBig(64);
    const _pending_amount_ath = sc_2.loadUintBig(128);
    const _pending_paid_ton = sc_2.loadUintBig(128);
    const _pending_buyer = sc_2.loadAddress();
    const _pending_recipient = sc_2.loadAddress();
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_recipient_ath_wallet = sc_3.loadAddress();
    const _completed_tranche_count = sc_3.loadUintBig(8);
    const _current_tranche_sold_ath = sc_3.loadUintBig(128);
    const _last_terminal_query_id = sc_3.loadUintBig(64);
    const _reserve_funded_total_ath = sc_3.loadUintBig(128);
    const _sold_ath_total = sc_3.loadUintBig(128);
    const _treasury_flushed_ton_total = sc_3.loadUintBig(128);
    return { $$type: 'MarketStabilitySeller$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, sealed: _sealed, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, last_terminal_query_id: _last_terminal_query_id, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
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
    const _sealed = source.readBoolean();
    const _phase = source.readBigNumber();
    const _reserve_due_ath = source.readBigNumber();
    const _treasury_due_ton = source.readBigNumber();
    const _pending_query_id = source.readBigNumber();
    source = source.readTuple();
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
    return { $$type: 'MarketStabilitySeller$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, sealed: _sealed, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, last_terminal_query_id: _last_terminal_query_id, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
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
    const _sealed = source.readBoolean();
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
    return { $$type: 'MarketStabilitySeller$Data' as const, genesis_config_hash: _genesis_config_hash, deployment_manifest_hash: _deployment_manifest_hash, ath_master_address: _ath_master_address, reserve_funder_address: _reserve_funder_address, official_ath_wallet_address: _official_ath_wallet_address, ton_treasury_receiver_address: _ton_treasury_receiver_address, reserve_funder_bound: _reserve_funder_bound, official_ath_wallet_bound: _official_ath_wallet_bound, treasury_bound: _treasury_bound, sealed: _sealed, phase: _phase, reserve_due_ath: _reserve_due_ath, treasury_due_ton: _treasury_due_ton, pending_query_id: _pending_query_id, pending_amount_ath: _pending_amount_ath, pending_paid_ton: _pending_paid_ton, pending_buyer: _pending_buyer, pending_recipient: _pending_recipient, pending_recipient_ath_wallet: _pending_recipient_ath_wallet, completed_tranche_count: _completed_tranche_count, current_tranche_sold_ath: _current_tranche_sold_ath, last_terminal_query_id: _last_terminal_query_id, reserve_funded_total_ath: _reserve_funded_total_ath, sold_ath_total: _sold_ath_total, treasury_flushed_ton_total: _treasury_flushed_ton_total };
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
    builder.writeBoolean(source.sealed);
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
    const __code = Cell.fromHex('b5ee9c724102a201003065000114ff00f4a413f4bcf2c80b01020162022e0130d001d072d721d200d200fa4021103450666f04f86102f8620303fced44d0d200018e6a810101d700fa405902d1018159d822c300f2f4705471112470707070547888547000547ff054700053001116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067e30d111ae302705619d74920980406013e11188020d7217021d749c21f9430d31f01de821041544810bae3025f0f5f0b0503e2d33fd37f593201111901111adb3c815ad2f8425616c705f2f4815ad32fc001f2f4815ad4111b2cba01111b01f2f4815ad511192aba01111901f2f41116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c29222d0462c21f97311119d31f111ade2182104d535246bae3022182104d534157bae3022182104d535452bae3022182104d53534cba07090b0e04fa5b1118d3fffa403001111901111adb3cdb3c1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c815a3c5613b3f2f4815a3df828561b01c705b3f2f41117111811171116111811161115111811151114111811141011130802fe1113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540815a3e1119561adb3c57135715011118011111f2f41115111711151114111611141113111511131113111411131111111311111110111211107f11120f11110f0e11100e770d04f85b1118d3fffa403001111901111adb3cdb3c1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c815a465612b3f2f41117111811171116111811161115111811151114111811141113111811131112111811121011130a02e41111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540815a471119db3c571257145619011111c70501111801f2f41115111711151114111611141113111511131112111411121110111211100f11110f7f11110e11100e551d3f2d04fa5b1118d3fffa403001111901111adb3cdb3c1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c815a505611b3f2f4815a51f828561b01c705b3f2f41117111811171116111811161115111811151114111811141011130c02fc1113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540815a521119561adb3c57115713011118010ff2f41115111711151114111611141113111511131112111411121111111311111111111211110f11110f0e11100e7f1110770d00f810df551cc87f01ca00111911181117111611151114111311121111111055e0011118011119cbff01111601cbff01111401ce1112c8ce01111101ce1fce1dca001bca0019ca0017ca0015cb0713cb7f01c8cb7f12cb3f12cb7f12cb7f12ce12ce02c8ce13cb0713cb7f14cb3f14cb7f14cb7f14cb7fcd12cdcdc9ed54043ce302218210472d9d7dbae3022182104d534558bae30221821041544811ba0f14171e03fc5b1118d3ff301117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411194130db3cdb3c11181119111811171118111711161117111611151116111511141115111411131114111310111200108159d95610b3f2f400328159db5619c300f2f48159dcc8f842cf16c9f900561abaf2f4026c1112111311121111111211111110111111100f11100f550edb3c3f5717815a645611f2f4815a655610f2f4815a662ff2f47011177f0f132d003e8159dd21c201f2f48159de5619c0009357197f94111921bae201111901f2f401fc5b1118d33fd39fd37ffa40301118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b011502fc111cdb3c815aa1f8425616c705f2f4815aa2561cc200f2f4815aa3111d5616c70501111d01f2f4815aa4f8416f24135f0382082dc6c0bef2f4815aa522561ca08228d529ae9e860000bbf2f40c561aa001561aa0f84282080f4240111a70111c70111e01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc91403111a03291601ae02111b0201111c014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae108c55372d01fc5b1118d33fd37ffa40301118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a091119090811190807111907061119060511190504111904031119030211190201111a01111b1803fcdb3c815aab2fc000f2f4815aac561ac200f2f45619db3c815aad561bc200f2f4815aae26c114f2f41117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540815aaf29191a00228159e421843fb9f2f48159e55115bcf2f404fa1119db3c561c01bb01111a01f2f4815ab0561b2ebbf2f4815ab11119561cdb3c01111a01f2f4815ab3f828561d01c705b3f2f41117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e561adb3c20820b750280a082081e8480a0815ab29d779c1b01fef8416f24135f0322bef2f41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111901111a1c02f8561ddb3c37373737373739075616a17156165618f842561b820b7502807f26f82803111e0302111f0201112001c855308210415448105005cb1f13cb3fcb7fcecec956140403111c0302111d02111e014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f842f8416f24135f03011118a11115111a1115401d02941114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c02111002103f109e4cd0102b109a10391038102710365e221023db3c262d04fe8ff45b1118d33fd37f3001111901111adb3c815abe2fc001f2f4815abf111a2cba01111a01f2f4815ac0111a2aba01111a01f2f4815ac1f84226c705f2f41116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3ce021821041544813ba291f2d2102ec547ba91fa0513ea0506ea02082280aa87bee538000ba953005a40570de1118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d102c102b102a102910281027102645144313111901db3c2320017c1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c2504fe8ff55b1118d33fd37f3001111901111adb3c815ac8f8425616c705f2f4815ac92fc001f2f4815aca111a2cba01111a01f2f4815acb111a2aba01111a01f2f41116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3ce02182104d53465429222d2702ee547ba92b0111110102a01118111b11181117111a11171116111911161115111b11151114111a11141113111911131112111b11121111111a11111110111911100f111b0f0e111a0e0d0c111b0c0b111a0b0a09111b0908111a080706111b0605111a050403111b0302111a0201111bdb3c111811191118232400226c663870547000561356145615106e555502fc1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111adb3c1118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c2526000234004a20820186a0b9915be070716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003b6bae302571a208210906182d3ba8eb73057181116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0c0001119c12101111901b0e3025f0f5f0af2c082282d2c02fe5b1118d37f301117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411194130db3c815adc561ac200f2f4815add561a2ebbf2f4815adf561a82081e8480be917f94561a2ebae2f2f4292a000e8159da5610f2f401fe815adef8416f24135f0382081e8480bef2f40c5619a10c5619a0561301111a70716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f842707080426d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001117111811171116111711161115111611151114111511141113111411131112111311122b01241111111211111110111111100f11100f550e2d0172815dbff2f01116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d2d00f0c87f01ca00111911181117111611151114111311121111111055e0011118011119cbff01111601cbff01111401ce1112c8ce01111101ce1fce1dca001bca0019ca0017ca0015cb0713cb7f01c8cb7f12cb3f12cb7f12cb7f12ce12ce02c8ce13cb0713cb7f14cb3f14cb7f14cb7f14cb7fcd12cdcdc9ed540201202f39020398b8303303f9a0dbb5134348000639aa0404075c03e901640b44060567608b0c03cbd1c151c44491c1c1c1c151e22151c00151ffc151c0014c004458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403c43bc4378433442f042ac4268422441e0419f8c376cf1b330f0f0f2983132004c7f821aba7def3000561102561502561502561502561d01561f01561e01561e01561e01561e0100163c3c3c3c3c3c3c3c3d6c1b03f9a09bb5134348000639aa0404075c03e901640b44060567608b0c03cbd1c151c44491c1c1c1c151e22151c00151ffc151c0014c004458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403c43bc4378433442f042ac4268422441e0419f8c376cf1b3b8f8f8fa98343801f2547edc547edc547edc53ed1118112311181117112211171116112111161115112011151114111f11141113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a0403111903021123023503fe011122011121db3c1118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a0911190911190807065540db3c0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c069f9d3601fc05111b0504112504031124030211230201111a015625111a1126111a1119112511191118112411181117112311171116112211161115112111151114112011141113111f11131112111e11121111111d11111110111c11100f111b0f0e111a0e1117111911171116111811161115111711151114111611141113111511133700381112111411121111111311111110111211100e11110e0e11100e10ef00143e3e3e3e3e3e3e3e55a20201203a970201203b3d02f9b7e5fda89a1a400031cd5020203ae01f480b205a20302b3b0458601e5e8e0a8e22248e0e0e0e0a8f110a8e000a8ffe0a8e000a600222c222e222c222a222c222a2228222a22282226222822262224222622242222222422222220222222201e22201e21de21bc219a217821562134211220f020cfc61bb678d9e6d9470983c000654721003f9b6273da89a1a400031cd5020203ae01f480b205a20302b3b0458601e5e8e0a8e22248e0e0e0e0a8f110a8e000a8ffe0a8e000a600222c222e222c222a222c222a2228222a22282226222822262224222622242222222422222220222222201e22201e21de21bc219a217821562134211220f020cfc61bb678ae20be1f0983e960104db3c3f0108f828db3c40016a20fa443070585619db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d041012488c87001ca0055215023810101cf00cecec9420114ff00f4a413f4bcf2c80b43020162448f04dad001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de206e3027025d74920c21f953105d31f06de21821041544801bae30221821041544805bae30221821041544810ba454e505104f4048020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8ea430d33fd37f5932104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e020821041544815ba8ea430d33fd37f5932104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e0204649494700d230d33fd37f59328136b3f84224c705f2f48136b422c200f2f45141a0708040067f04c8598210415448045003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5404de82104154481dba8ea430d33fd37f5932104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e02082104154481bba8ea430d33fd37f5932104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e0208210178d4519bae302208210472d9d7dba4949484b014830d33ffa005932104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed544902e281378c21c200f2f4f84210575e3346705260db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305157a0f8285220c705b3941027365be30d5a14894a006a708040087f0ac8598210415448135003cb1fcb3fcb7fc913484019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003ea8eae30d33fd39f5932813800f84225c705f2f4104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e020821089129d60ba8eae30d33fd39f59328138eaf84225c705f2f4104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e08210a11a7002bae3025f064d4d4c015ad33fd39f593281394ef84225c705f2f4104610354400db3cc87f01ca0055405045cb7f12cecef400f400c9ed544d03b21046103546565356db3c810101230259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2813801216eb3f2f46f25135f031046103546562781380207db3c29ba16f2f410374614503305db3c928b8301fe5b04d33fd37ffa40308136b0f84226c705f2f48136b122c200f2f48136b25362bef2f48136b55315c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15162a1715414367f04c855308210415448025005cb1f13cb3fcb7fcecec92404075520441359c8cf8580ca00cf8440ce01fa024f0042806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5401ec5b04d33fd37ffa4030813840f84225c705f2f481384122c200f2f481384226c000f2f4813843f8416f24135f0382082dc6c0bef2f45151a082080f42407004705147c855208210415448065004cb1f12cb3fcb7fcec910474730441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0040347f043ce30221821041544814bae3022182104154481cbae3022182104154481aba5254585c04d65b04d33fd37ffa40fa4030813778f84227c705f2f48137795316c705f2f410465e705378db3c81377a27c200f2f481377b5357bef2f4820a5317c081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1554028db3c705410a4db3c10461035465654789a2e6485955301f0db3c5149a17f5419a4700ec855308210415448125005cb1f13cb3fcb7fcecec9106a10571049103b47a0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00504213c87f01ca0055405045cb7f12cecef400f400c9ed548804fc5b04d33fd37ffa40fa40d430d0fa40d37f308137dcf84229c705f2f48137dd5338c705f2f48137de5324c705f2f410481037469a5376db3c8137df29c200f2f48137e02bc200f2f48137e15359bef2f48137e22b820aaea540bef2f42adb3c208208989680a08137e3f8416f24135f0322bef2f410461035465629db3c7064558556003082080f4240a082083d0900a082086acfc0a08209312d00a003fe5410b4db3c1046103546565479cb2ddb3c514ca1509c7f7125544d30011111011112c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a105a104c103d4ca0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00958857014af8416f24135f0301a11046134440db3cc87f01ca0055405045cb7f12cecef400f400c9ed546204fc5b04d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422bc705f2f48138d7535ac705f2f4104a103948bc535adb3c55308138d85159db3c16f2f48138d927c200f2f48138da2ac200f2f48138db5347bef2f48138dc2a820aaea540bef2f4550329db3c208208989680a08138ddf8416f24135f0322bef2f41046103564775e5904fa465627db3c70541094db3c104610354656547ba95611db3c514aa1103b102a7f712d045611040311110302111002011113011114c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc91045104a1913103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818595885a02588ae2f400c901fb00f8416f24135f035004a1151314db3cc87f01ca0055405045cb7f12cecef400f400c9ed545b62001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba5d63676904fe5b04d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422ec705f2f481393b538dc705f2f4104d103c4bef5387db3c553081393c5156db3c16f2f481393d2ac200f2f481393e27c200f2f481393f534abef2f481394027820aaea540bef2f4550326db3c208208989680a0813941f8416f24135f0364775e5f003c82082dc6c0a082083d0900a082086acfc0a08209312d00a082081e8480a0048622bef2f41046103546562adb3c705410c4db3c104610354656547edc2edb3c514da1106e105d7f7125517e07106e105d041115040311140302111302011116011117c88595886002d455a0db3cc915104a10394780103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0301a11046104510341023db3cc87f01ca0055405045cb7f12cecef400f400c9ed546162005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002fc5b04d33ffa00fa40fa40f40431fa0081396cf84229c705f2f410481037469a5376db3c81396d29c200f2f481396e5359bef2f481396ff8416f24135f0352b0b9f2f482098cba802ac2008e2a302982083d0900a082086acfc0a08209312d00a0f8416f24fa40fa0071d721fa00fa00306c6170f83aa0de82081e848001a06465034c251047457381390807db3c17f2f4550481390906db3c16f2f4550381390a06db3c16f2f4550377777704fe82087a1200a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1554028db3c705410a4db3c1046103546565478ba2cdb3c514ba148b07f70254c1311101fc855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec910681047103a4a70103645155034c8cf8580ca00cf8440ce01fa028069cf4085958866006c025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb005023c87f01ca0055405045cb7f12cecef400f400c9ed5402fe5b04d33fd37ffa40fa403081378223c200f2f4813783f84210581047103649a6db3c16c70519f2f4813784f8416f24135f038209ba8140bef2f45124a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104a441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282083d090071077007c88568008a598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001314c87f01ca0055405045cb7f12cecef400f400c9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba6a70737604c45b04d33ffa00fa40fa40fa0081397625c200f2f4813977f842104a103948bc25db3c1dc7051bf2f455020981397851badb3c1cf2f427c2008e1a363881397df8416f24135f0382098cba80bef2f45112a0075044e30df8421068155e2154411a503385776b6d01fe813979f8416f24135f035290b9f2f481397af8416f24135f032982083d0900a082086acfc0a08209312d00a0f8416f24fa40fa0071d721fa00fa00306c6170f83aa0bef2f45134a071702754473a1dc8553082107362d09c5005cb1f13cb3f01fa02cecec9235139034c9c441359c8cf8580ca00cf8440ce01fa02806acf406c000cf400c901fb0002d0db3c82098cba8027c2008e2b300682083d0900a082086acfc0a08209312d00a0f8416f24fa40fa0071d721fa00fa00306c6170f83aa0069137e2f8416f24135f035007a12082080f4240be93303435e30d4443c87f01ca0055405045cb7f12cecef400f400c9ed546e6f006c82083d090071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000064717009c8018210d53276db58cb1fcb3fc91047413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00102404fa5b04d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842104a103948bc25db3c1dc7051bf2f48137e85382c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082083d0900a082086acfc0a08209312d00a0bef2f44014503a5419052adb3c55405365db3c8137eb2381010123858b927101fe59f40c6fa131b3f2f48137ec29820aaea540bef2f4515ca081010182080f4240f8232e544e30561101c855405045ce12cecb3fcb7fcb3fc910344170206e953059f45a30944133f415e2717f54488052eec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec9104910384b60441359c8cf8580ca00cf8440ce01fa02806a7201f2cf40f400c901fb0082080f42407070535ac8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282083d09007104700ac8598210415448115003cb1fcb3fcb7fc9443019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0055127f04ea5b04d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842104c103b4ade27db3c1fc7051df2f48138e224c200f2f48138e3f8416f24135f032582082dc6c0a082083d0900a082086acfc0a08209312d00a0bef2f455020b8138e451dbdb3c1ef2f45503543c75db3c5540538585778b7402d8db3c8138e5238101012359f40c6fa131b3f2f48138e62e820aaea540bef2f45158a081010182082dc6c0f8232a03021112020111120152c01113c855405045ce12cecb3fcb7fcb3fc94f60206e953059f45a30944133f415e2717fc8500bcf16c929515910580410394edec8927501ea5560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07ccc92704103a4077441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282083d090071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0043347f04fe8ffd5b04d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f842104f103e102d0111100111112adb3c01111201c70501111001f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082083d0900a082086acfc0a08209312d00a0bef2f455020e813948111026db3c8577787b000afa4430c00003f801111101f2f45503543fa8db3c554053b5db3c813949238101012359f40c6fa131b3f2f481394a29820aaea540bef2f4515ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb3fc94a60206e953059f45a30944133f415e2717f2c518c07106c15041113040311120302111102011110010fc88b927901fe55908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc95412034a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282083d090071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c9017a0034fb00414403c87f01ca0055405045cb7f12cecef400f400c9ed54044ee021821041544811bae30221821041544808bae302218210472d9d7ebae3022182104154481eba7c7d808201fe5b04d33fd37f308137a021c200f2f4f8421056104510344770db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137a1216eb3f2f46f2430318137a209ba18f2f48137a3f8425008c70517f2f415810101f45a3010344130c87f01ca0055405045cb7f12cecef400f400c9ed548903f85b04d33ffa40308137aaf8416f24135f038208b71b00bef2f41045103443605260db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137ab216eb3f2f46f24338137acf823048208278d00a014bc13f2f45023810101f45a305161a0f8285230c705b392375be30d5502897e7f0066708040097f04c8598210415448135003cb1fcb3fcb7fc94930441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00002ac87f01ca0055405045cb7f12cecef400f400c9ed5402fe5b04d33fd37fd39f30813804f84226c705f2f481380522c200f2f41045103545675357db3c228101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e8e185b6c35c87f01ca0055405045cb7f12cecef400f400c9ed54e06f2530813807511cbaf2f41048103746582981380808928101badb3c500cba16f2f45054810101f45a3071077009c8598210415448115003cb1fcb3fcb7fc9103410364780441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00443302c87f01ca0055405045cb7f12cecef400f400c9ed548b04fc8ec35b04d33fd37fd39f3081380af84226c705f2f481380bf8416f24135f03820a5317c0bef2f410571046103501db3cc87f01ca0055405045cb7f12cecef400f400c9ed54e0218210504e5052bae3023620821041544807ba8e1930344034c87f01ca0055405045cb7f12cecef400f400c9ed54e0c00005c12115b0e302838a8d8e03f68137fa21c200f2f41047103645765357db3c228101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53acbef2f48137fd511cbaf2f4103847658137fe5435a8db3c2dba16f2f4513a928b8404eaa15083810101f45a304430470026db3c705384db3c10575e334670545be7db3c539a82082dc6c0ba955b3838f8288e39717051efc8598210415448135003cb1fcb3fcb7fc9104b103d41e0441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0008090607e21035443048705469b052a085958687016820fa4430705825db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0950030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01badb3c707f541ab5804009c855308210415448125005cb1f13cb3fcb7fcecec95e54103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00410488017e555227db3c813796228101012359f40c6fa131b3f2f4810101f823103948a0c855305034cececb7fcb3fc910364750206e953059f45a30944133f415e24440890026c8821041544f4701cb1f12cb3f01cf16c9f90003fc5b04d33fd39f3081380df8416f24135f0382081e8480bef2f454156527db3c228101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e281380e216eb3f2f46f253132105810471036487981380f09db3c500aba17f2f40682082dc6c0ba958208093a809482015180e2813810f823928b8c002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f004c5062a0be14f2f403810101f45a30440302c87f01ca0055405045cb7f12cecef400f400c9ed5400388132c8f2f04034c87f01ca0055405045cb7f12cecef400f400c9ed54000a5f05f2c08202014890930161bb1c5ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de25514db3c6c558910178db3c810101230259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e983070705455002702e06f25327f04431392000231015dbbb02ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de2db3c6c548940116705343db3c305465505250950026f82ac87001ca0055215023810101cf00cecec900046c9102f9b909fed44d0d200018e6a810101d700fa405902d1018159d822c300f2f4705471112470707070547888547000547ff054700053001116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067e30d1118111911188989a01f4d3ffd3fffa40d401d0fa40fa40fa40d200d200d200d200d307d37fd430d0d37fd33fd37fd37ffa40fa40d430d0fa40d307d37fd33fd37fd37fd37f3011161119111611161118111611161117111657191117111811171116111711161115111611151114111511141113111411131112111311121111111211119900181110111111100f11100f550e017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6c919b0104db3c9c02f48159e121c200f2f41118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a0911190911190807065540db3c8159e221c200f2f4561a8159e302bbf2f41117111811179d9e002225c2139170e082280aa87bee53800025a102fe1116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540821aba7def30001119db3c01111a01a801111aa81117111911171116111811161115111711151114111611141113111511139fa0000625a602017c1112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544301282280aa87bee538000db3ca100268159df21c200f2f421925b70e101a501a904a4c6445a0b');
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
    {"name":"AthTransferNotification","header":1194171773,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AthTransferNotificationAck","header":1194171774,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}}]},
    {"name":"AthTransferNotificationRefund","header":1096042526,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}}]},
    {"name":"PruneStaleNotification","header":1347309650,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}}]},
    {"name":"AthTransferNotificationRegistryMintUsername","header":2299698528,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"payer_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"AthTransferNotificationRegistryProfileAvatar","header":2702864386,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"payer_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHTransferRequest","header":1096042512,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHTransferRequestWithNotify","header":1096042516,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferRequestRegistryProfileAvatar","header":1096042522,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHTransferRequestRegistryMintUsername","header":1096042524,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHInternalTransfer","header":1096042514,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHInternalTransferWithNotify","header":1096042517,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHInternalTransferRegistryProfileAvatar","header":1096042523,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHInternalTransferRegistryMintUsername","header":1096042525,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHTransferAck","header":1096042513,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferFailed","header":1096042515,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"JettonTransfer","header":260734629,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"custom_payload","type":{"kind":"simple","type":"cell","optional":true}},{"name":"forward_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonInternalTransfer","header":395134233,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"from","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"forward_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonTransferNotification","header":1935855772,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonExcesses","header":3576854235,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ATHWalletTopUpStorageReserve","header":1096042503,"fields":[]},
    {"name":"ATHRecoverStuckOutgoing","header":1096042504,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHWalletDataView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"jetton_wallet_code","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PendingAthTransferNotificationView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_ack_value","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthOutgoingTransfer","header":null,"fields":[{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"pending_outgoing_transfers","type":{"kind":"dict","key":"int","value":"PendingAthOutgoingTransfer","valueFormat":"ref"}}]},
    {"name":"BindMarketStabilityReserveFunder","header":1297306182,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"reserve_funder_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindMarketStabilityOfficialAthWallet","header":1297301847,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindMarketStabilityTreasury","header":1297306706,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ton_treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealMarketStabilityGenesis","header":1297306444,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"BuyMarketStabilityAth","header":1297302872,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"FlushMarketStabilityTreasuryTon","header":1297303124,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"MarketStabilityTopUpStorageReserve","header":2422309587,"fields":[]},
    {"name":"MarketStabilitySellerConfigView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"reserve_funder_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pricing_frozen","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"reserve_funder_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ton_treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"base_tranche_price_nanotons","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MarketStabilitySellerStateView","header":null,"fields":[{"name":"phase","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_amount_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_paid_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"completed_tranche_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_tranche_sold_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_multiplier","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_tranche_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_terminal_query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MarketStabilitySellerTotalsView","header":null,"fields":[{"name":"reserve_funded_total_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sold_ath_total","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_flushed_ton_total","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MarketStabilitySeller$Data","header":null,"fields":[{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"reserve_funder_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ton_treasury_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"reserve_funder_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"phase","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"reserve_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"treasury_due_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_amount_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_paid_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"completed_tranche_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"current_tranche_sold_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"last_terminal_query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"reserve_funded_total_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sold_ath_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"treasury_flushed_ton_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
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
    "AthTransferNotificationRefund": 1096042526,
    "PruneStaleNotification": 1347309650,
    "AthTransferNotificationRegistryMintUsername": 2299698528,
    "AthTransferNotificationRegistryProfileAvatar": 2702864386,
    "ATHTransferRequest": 1096042512,
    "ATHTransferRequestWithNotify": 1096042516,
    "ATHTransferRequestRegistryProfileAvatar": 1096042522,
    "ATHTransferRequestRegistryMintUsername": 1096042524,
    "ATHInternalTransfer": 1096042514,
    "ATHInternalTransferWithNotify": 1096042517,
    "ATHInternalTransferRegistryProfileAvatar": 1096042523,
    "ATHInternalTransferRegistryMintUsername": 1096042525,
    "ATHTransferAck": 1096042513,
    "ATHTransferFailed": 1096042515,
    "JettonTransfer": 260734629,
    "JettonInternalTransfer": 395134233,
    "JettonTransferNotification": 1935855772,
    "JettonExcesses": 3576854235,
    "ATHWalletTopUpStorageReserve": 1096042503,
    "ATHRecoverStuckOutgoing": 1096042504,
    "BindMarketStabilityReserveFunder": 1297306182,
    "BindMarketStabilityOfficialAthWallet": 1297301847,
    "BindMarketStabilityTreasury": 1297306706,
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
export const ATH_REGISTRY_RESPONSE_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 4000000n;
export const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 8000000n;
export const ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE = 2000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 45000000n;
export const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 20000000n;
export const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2000000n;
export const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7000000n;
export const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_INTERNAL_TRANSFER_ARRIVAL_MIN = 29000000n;
export const ATH_NOTIFY_REFUND_OWNER_MIN_VALUE = 39000000n;
export const ATH_OWNER_REQUEST_EXEC_RESERVE = 2000000n;
export const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10000000n;
export const ATH_OWNER_EXCESS_REFUND_MIN_VALUE = 100000n;
export const ATH_GENESIS_SUPPLY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 1096044105n;
export const ATH_OUTGOING_TRANSFER_ID_DOMAIN = 1096044359n;
export const ATH_OUTGOING_STUCK_RECOVERY_GRACE_SECONDS = 2592000n;
export const ATH_OUTGOING_STUCK_RECOVERY_MIN_VALUE = 12000000n;
export const ATH_NOTIFY_REFUND_QUERY_DOMAIN = 1096045126n;
export const ATH_QUERY_ID_MOD = 18446744073709551616n;
export const ATH_SENDER_KEY_MOD = 1461501637330902918203684832716283019655932542976n;
export const ATH_PENDING_NOTIFICATION_TTL = 86400n;
export const ATH_REGISTRY_PENDING_TTL = 604800n;
export const JETTON_EXCESSES_VALUE = 1000000n;
export const MARKET_STABILITY_TOTAL_RESERVE_ATH = 60000000000000000n;
export const MARKET_STABILITY_TRANCHE_ATH = 3000000000000000n;
export const MARKET_STABILITY_TRANCHE_COUNT = 20n;
export const MARKET_STABILITY_START_MULTIPLIER = 2n;
export const MARKET_STABILITY_END_MULTIPLIER = 21n;
export const MARKET_STABILITY_ATH_NOTIFY_ACK_VALUE = 1000000n;
export const MARKET_STABILITY_LOCAL_EXEC_RESERVE = 2000000n;
export const MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE = 58000000n;
export const MARKET_STABILITY_BUY_EXEC_RESERVE = 2000000n;
export const MARKET_STABILITY_TREASURY_FLUSH_EXEC_RESERVE = 2000000n;
export const MARKET_STABILITY_MIN_TREASURY_FLUSH_TON = 2000000n;
export const MARKET_STABILITY_EXCESS_REFUND_MIN_VALUE = 100000n;
export const MARKET_STABILITY_BASE_TRANCHE_PRICE = 3000000000000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindMarketStabilityReserveFunder | BindMarketStabilityOfficialAthWallet | BindMarketStabilityTreasury | SealMarketStabilityGenesis | AthTransferNotification | BuyMarketStabilityAth | ATHTransferAck | ATHTransferFailed | FlushMarketStabilityTreasuryTon | MarketStabilityTopUpStorageReserve | null) {
        
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