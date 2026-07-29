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

export type KeyShardRegisterKeys = {
    $$type: 'KeyShardRegisterKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    auth_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
}

export function storeKeyShardRegisterKeys(src: KeyShardRegisterKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748913, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        b_0.storeUint(src.scan_pubkey, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.auth_pubkey, 256);
        b_1.storeUint(src.pq_kem_pubkey_hash, 256);
        b_1.storeUint(src.pq_kem_pubkey_len, 16);
        b_1.storeRef(src.pq_kem_pubkey);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyShardRegisterKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748913) { throw Error('Invalid prefix'); }
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const _scan_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _auth_pubkey = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    return { $$type: 'KeyShardRegisterKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleKeyShardRegisterKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'KeyShardRegisterKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleKeyShardRegisterKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'KeyShardRegisterKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleKeyShardRegisterKeys(source: KeyShardRegisterKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    return builder.build();
}

export function dictValueParserKeyShardRegisterKeys(): DictionaryValue<KeyShardRegisterKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardRegisterKeys(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardRegisterKeys(src.loadRef().beginParse());
        }
    }
}

export type KeyShardReplaceKeys = {
    $$type: 'KeyShardReplaceKeys';
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeKeyShardReplaceKeys(src: KeyShardReplaceKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748914, 32);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadKeyShardReplaceKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748914) { throw Error('Invalid prefix'); }
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'KeyShardReplaceKeys' as const, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleKeyShardReplaceKeys(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'KeyShardReplaceKeys' as const, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleKeyShardReplaceKeys(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'KeyShardReplaceKeys' as const, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleKeyShardReplaceKeys(source: KeyShardReplaceKeys) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserKeyShardReplaceKeys(): DictionaryValue<KeyShardReplaceKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardReplaceKeys(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardReplaceKeys(src.loadRef().beginParse());
        }
    }
}

export type KeyShardTopUpStorageReserve = {
    $$type: 'KeyShardTopUpStorageReserve';
}

export function storeKeyShardTopUpStorageReserve(src: KeyShardTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748916, 32);
    };
}

export function loadKeyShardTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748916) { throw Error('Invalid prefix'); }
    return { $$type: 'KeyShardTopUpStorageReserve' as const };
}

export function loadTupleKeyShardTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'KeyShardTopUpStorageReserve' as const };
}

export function loadGetterTupleKeyShardTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'KeyShardTopUpStorageReserve' as const };
}

export function storeTupleKeyShardTopUpStorageReserve(source: KeyShardTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserKeyShardTopUpStorageReserve(): DictionaryValue<KeyShardTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type KeyShardSetAvatarPointer = {
    $$type: 'KeyShardSetAvatarPointer';
    write_id: bigint;
    owner_wallet: Address;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    media_format: bigint;
}

export function storeKeyShardSetAvatarPointer(src: KeyShardSetAvatarPointer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748917, 32);
        b_0.storeUint(src.write_id, 64);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.avatar_hash, 256);
        b_0.storeUint(src.avatar_entry_id, 64);
        b_0.storeUint(src.avatar_stream_id, 128);
        b_0.storeUint(src.avatar_part_count, 16);
        b_0.storeUint(src.media_format, 8);
    };
}

export function loadKeyShardSetAvatarPointer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748917) { throw Error('Invalid prefix'); }
    const _write_id = sc_0.loadUintBig(64);
    const _owner_wallet = sc_0.loadAddress();
    const _avatar_hash = sc_0.loadUintBig(256);
    const _avatar_entry_id = sc_0.loadUintBig(64);
    const _avatar_stream_id = sc_0.loadUintBig(128);
    const _avatar_part_count = sc_0.loadUintBig(16);
    const _media_format = sc_0.loadUintBig(8);
    return { $$type: 'KeyShardSetAvatarPointer' as const, write_id: _write_id, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleKeyShardSetAvatarPointer(source: TupleReader) {
    const _write_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'KeyShardSetAvatarPointer' as const, write_id: _write_id, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleKeyShardSetAvatarPointer(source: TupleReader) {
    const _write_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _media_format = source.readBigNumber();
    return { $$type: 'KeyShardSetAvatarPointer' as const, write_id: _write_id, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleKeyShardSetAvatarPointer(source: KeyShardSetAvatarPointer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.write_id);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.media_format);
    return builder.build();
}

export function dictValueParserKeyShardSetAvatarPointer(): DictionaryValue<KeyShardSetAvatarPointer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardSetAvatarPointer(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardSetAvatarPointer(src.loadRef().beginParse());
        }
    }
}

export type KeyShardAvatarPointerAck = {
    $$type: 'KeyShardAvatarPointerAck';
    write_id: bigint;
    version: bigint;
}

export function storeKeyShardAvatarPointerAck(src: KeyShardAvatarPointerAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748918, 32);
        b_0.storeUint(src.write_id, 64);
        b_0.storeUint(src.version, 32);
    };
}

export function loadKeyShardAvatarPointerAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748918) { throw Error('Invalid prefix'); }
    const _write_id = sc_0.loadUintBig(64);
    const _version = sc_0.loadUintBig(32);
    return { $$type: 'KeyShardAvatarPointerAck' as const, write_id: _write_id, version: _version };
}

export function loadTupleKeyShardAvatarPointerAck(source: TupleReader) {
    const _write_id = source.readBigNumber();
    const _version = source.readBigNumber();
    return { $$type: 'KeyShardAvatarPointerAck' as const, write_id: _write_id, version: _version };
}

export function loadGetterTupleKeyShardAvatarPointerAck(source: TupleReader) {
    const _write_id = source.readBigNumber();
    const _version = source.readBigNumber();
    return { $$type: 'KeyShardAvatarPointerAck' as const, write_id: _write_id, version: _version };
}

export function storeTupleKeyShardAvatarPointerAck(source: KeyShardAvatarPointerAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.write_id);
    builder.writeNumber(source.version);
    return builder.build();
}

export function dictValueParserKeyShardAvatarPointerAck(): DictionaryValue<KeyShardAvatarPointerAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardAvatarPointerAck(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardAvatarPointerAck(src.loadRef().beginParse());
        }
    }
}

export type KeyShardProveOwnership = {
    $$type: 'KeyShardProveOwnership';
    query_id: bigint;
    to: Address;
}

export function storeKeyShardProveOwnership(src: KeyShardProveOwnership) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748919, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.to);
    };
}

export function loadKeyShardProveOwnership(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748919) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _to = sc_0.loadAddress();
    return { $$type: 'KeyShardProveOwnership' as const, query_id: _query_id, to: _to };
}

export function loadTupleKeyShardProveOwnership(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _to = source.readAddress();
    return { $$type: 'KeyShardProveOwnership' as const, query_id: _query_id, to: _to };
}

export function loadGetterTupleKeyShardProveOwnership(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _to = source.readAddress();
    return { $$type: 'KeyShardProveOwnership' as const, query_id: _query_id, to: _to };
}

export function storeTupleKeyShardProveOwnership(source: KeyShardProveOwnership) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.to);
    return builder.build();
}

export function dictValueParserKeyShardProveOwnership(): DictionaryValue<KeyShardProveOwnership> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardProveOwnership(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardProveOwnership(src.loadRef().beginParse());
        }
    }
}

export type KeyShardOwnershipProof = {
    $$type: 'KeyShardOwnershipProof';
    query_id: bigint;
    owner_wallet: Address;
    key_id: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    avatar_version: bigint;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    avatar_media_format: bigint;
    avatar_updated_at: bigint;
}

export function storeKeyShardOwnershipProof(src: KeyShardOwnershipProof) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748920, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.key_id, 256);
        b_0.storeUint(src.key_generation, 32);
        b_0.storeUint(src.rotation_nonce, 64);
        b_0.storeUint(src.enc_pubkey, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.sign_pubkey, 256);
        b_1.storeUint(src.scan_pubkey, 256);
        b_1.storeUint(src.pq_kem_pubkey_hash, 256);
        b_1.storeUint(src.pq_kem_pubkey_len, 16);
        b_1.storeRef(src.pq_kem_pubkey);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_1.storeUint(src.created_at, 64);
        b_1.storeUint(src.avatar_version, 32);
        const b_2 = new Builder();
        b_2.storeUint(src.avatar_hash, 256);
        b_2.storeUint(src.avatar_entry_id, 64);
        b_2.storeUint(src.avatar_stream_id, 128);
        b_2.storeUint(src.avatar_part_count, 16);
        b_2.storeUint(src.avatar_media_format, 8);
        b_2.storeUint(src.avatar_updated_at, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyShardOwnershipProof(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748920) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _owner_wallet = sc_0.loadAddress();
    const _key_id = sc_0.loadUintBig(256);
    const _key_generation = sc_0.loadUintBig(32);
    const _rotation_nonce = sc_0.loadUintBig(64);
    const _enc_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _sign_pubkey = sc_1.loadUintBig(256);
    const _scan_pubkey = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    const _created_at = sc_1.loadUintBig(64);
    const _avatar_version = sc_1.loadUintBig(32);
    const sc_2 = sc_1.loadRef().beginParse();
    const _avatar_hash = sc_2.loadUintBig(256);
    const _avatar_entry_id = sc_2.loadUintBig(64);
    const _avatar_stream_id = sc_2.loadUintBig(128);
    const _avatar_part_count = sc_2.loadUintBig(16);
    const _avatar_media_format = sc_2.loadUintBig(8);
    const _avatar_updated_at = sc_2.loadUintBig(64);
    return { $$type: 'KeyShardOwnershipProof' as const, query_id: _query_id, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at };
}

export function loadTupleKeyShardOwnershipProof(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _avatar_version = source.readBigNumber();
    source = source.readTuple();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _avatar_media_format = source.readBigNumber();
    const _avatar_updated_at = source.readBigNumber();
    return { $$type: 'KeyShardOwnershipProof' as const, query_id: _query_id, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at };
}

export function loadGetterTupleKeyShardOwnershipProof(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _avatar_version = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _avatar_media_format = source.readBigNumber();
    const _avatar_updated_at = source.readBigNumber();
    return { $$type: 'KeyShardOwnershipProof' as const, query_id: _query_id, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at };
}

export function storeTupleKeyShardOwnershipProof(source: KeyShardOwnershipProof) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.avatar_version);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.avatar_media_format);
    builder.writeNumber(source.avatar_updated_at);
    return builder.build();
}

export function dictValueParserKeyShardOwnershipProof(): DictionaryValue<KeyShardOwnershipProof> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardOwnershipProof(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardOwnershipProof(src.loadRef().beginParse());
        }
    }
}

export type KeyShardView = {
    $$type: 'KeyShardView';
    exists: boolean;
    owner_wallet: Address;
    key_id: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    min_register_value: bigint;
    min_replace_value: bigint;
    profile_registry: Address;
    avatar_version: bigint;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    avatar_media_format: bigint;
    avatar_updated_at: bigint;
    rotation_min_balance: bigint;
}

export function storeKeyShardView(src: KeyShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.key_id, 257);
        b_0.storeInt(src.key_generation, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.rotation_nonce, 257);
        b_1.storeInt(src.enc_pubkey, 257);
        b_1.storeInt(src.sign_pubkey, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.scan_pubkey, 257);
        b_2.storeInt(src.pq_kem_pubkey_hash, 257);
        b_2.storeInt(src.pq_kem_pubkey_len, 257);
        b_2.storeRef(src.pq_kem_pubkey);
        const b_3 = new Builder();
        b_3.storeInt(src.crypto_suite_mask, 257);
        b_3.storeInt(src.created_at, 257);
        b_3.storeInt(src.created_lt, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.min_register_value, 257);
        b_4.storeInt(src.min_replace_value, 257);
        b_4.storeAddress(src.profile_registry);
        const b_5 = new Builder();
        b_5.storeInt(src.avatar_version, 257);
        b_5.storeInt(src.avatar_hash, 257);
        b_5.storeInt(src.avatar_entry_id, 257);
        const b_6 = new Builder();
        b_6.storeInt(src.avatar_stream_id, 257);
        b_6.storeInt(src.avatar_part_count, 257);
        b_6.storeInt(src.avatar_media_format, 257);
        const b_7 = new Builder();
        b_7.storeInt(src.avatar_updated_at, 257);
        b_7.storeInt(src.rotation_min_balance, 257);
        b_6.storeRef(b_7.endCell());
        b_5.storeRef(b_6.endCell());
        b_4.storeRef(b_5.endCell());
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyShardView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _key_id = sc_0.loadIntBig(257);
    const _key_generation = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _rotation_nonce = sc_1.loadIntBig(257);
    const _enc_pubkey = sc_1.loadIntBig(257);
    const _sign_pubkey = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _scan_pubkey = sc_2.loadIntBig(257);
    const _pq_kem_pubkey_hash = sc_2.loadIntBig(257);
    const _pq_kem_pubkey_len = sc_2.loadIntBig(257);
    const _pq_kem_pubkey = sc_2.loadRef();
    const sc_3 = sc_2.loadRef().beginParse();
    const _crypto_suite_mask = sc_3.loadIntBig(257);
    const _created_at = sc_3.loadIntBig(257);
    const _created_lt = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _min_register_value = sc_4.loadIntBig(257);
    const _min_replace_value = sc_4.loadIntBig(257);
    const _profile_registry = sc_4.loadAddress();
    const sc_5 = sc_4.loadRef().beginParse();
    const _avatar_version = sc_5.loadIntBig(257);
    const _avatar_hash = sc_5.loadIntBig(257);
    const _avatar_entry_id = sc_5.loadIntBig(257);
    const sc_6 = sc_5.loadRef().beginParse();
    const _avatar_stream_id = sc_6.loadIntBig(257);
    const _avatar_part_count = sc_6.loadIntBig(257);
    const _avatar_media_format = sc_6.loadIntBig(257);
    const sc_7 = sc_6.loadRef().beginParse();
    const _avatar_updated_at = sc_7.loadIntBig(257);
    const _rotation_min_balance = sc_7.loadIntBig(257);
    return { $$type: 'KeyShardView' as const, exists: _exists, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, min_register_value: _min_register_value, min_replace_value: _min_replace_value, profile_registry: _profile_registry, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at, rotation_min_balance: _rotation_min_balance };
}

export function loadTupleKeyShardView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    source = source.readTuple();
    const _min_register_value = source.readBigNumber();
    const _min_replace_value = source.readBigNumber();
    const _profile_registry = source.readAddress();
    const _avatar_version = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _avatar_media_format = source.readBigNumber();
    const _avatar_updated_at = source.readBigNumber();
    const _rotation_min_balance = source.readBigNumber();
    return { $$type: 'KeyShardView' as const, exists: _exists, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, min_register_value: _min_register_value, min_replace_value: _min_replace_value, profile_registry: _profile_registry, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at, rotation_min_balance: _rotation_min_balance };
}

export function loadGetterTupleKeyShardView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _min_register_value = source.readBigNumber();
    const _min_replace_value = source.readBigNumber();
    const _profile_registry = source.readAddress();
    const _avatar_version = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _avatar_media_format = source.readBigNumber();
    const _avatar_updated_at = source.readBigNumber();
    const _rotation_min_balance = source.readBigNumber();
    return { $$type: 'KeyShardView' as const, exists: _exists, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, min_register_value: _min_register_value, min_replace_value: _min_replace_value, profile_registry: _profile_registry, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at, rotation_min_balance: _rotation_min_balance };
}

export function storeTupleKeyShardView(source: KeyShardView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.min_register_value);
    builder.writeNumber(source.min_replace_value);
    builder.writeAddress(source.profile_registry);
    builder.writeNumber(source.avatar_version);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.avatar_media_format);
    builder.writeNumber(source.avatar_updated_at);
    builder.writeNumber(source.rotation_min_balance);
    return builder.build();
}

export function dictValueParserKeyShardView(): DictionaryValue<KeyShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardView(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardView(src.loadRef().beginParse());
        }
    }
}

export type KeyShard$Data = {
    $$type: 'KeyShard$Data';
    owner_wallet: Address;
    profile_registry: Address;
    registered: boolean;
    key_id: bigint;
    auth_pubkey: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    avatar_version: bigint;
    avatar_hash: bigint;
    avatar_entry_id: bigint;
    avatar_stream_id: bigint;
    avatar_part_count: bigint;
    avatar_media_format: bigint;
    avatar_updated_at: bigint;
}

export function storeKeyShard$Data(src: KeyShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.profile_registry);
        b_0.storeBit(src.registered);
        b_0.storeUint(src.key_id, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.auth_pubkey, 256);
        b_1.storeUint(src.key_generation, 32);
        b_1.storeUint(src.rotation_nonce, 64);
        b_1.storeUint(src.enc_pubkey, 256);
        b_1.storeUint(src.sign_pubkey, 256);
        const b_2 = new Builder();
        b_2.storeUint(src.scan_pubkey, 256);
        b_2.storeUint(src.pq_kem_pubkey_hash, 256);
        b_2.storeUint(src.pq_kem_pubkey_len, 16);
        b_2.storeRef(src.pq_kem_pubkey);
        b_2.storeUint(src.crypto_suite_mask, 16);
        b_2.storeUint(src.created_at, 64);
        b_2.storeUint(src.created_lt, 64);
        b_2.storeUint(src.avatar_version, 32);
        b_2.storeUint(src.avatar_hash, 256);
        const b_3 = new Builder();
        b_3.storeUint(src.avatar_entry_id, 64);
        b_3.storeUint(src.avatar_stream_id, 128);
        b_3.storeUint(src.avatar_part_count, 16);
        b_3.storeUint(src.avatar_media_format, 8);
        b_3.storeUint(src.avatar_updated_at, 64);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _profile_registry = sc_0.loadAddress();
    const _registered = sc_0.loadBit();
    const _key_id = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _auth_pubkey = sc_1.loadUintBig(256);
    const _key_generation = sc_1.loadUintBig(32);
    const _rotation_nonce = sc_1.loadUintBig(64);
    const _enc_pubkey = sc_1.loadUintBig(256);
    const _sign_pubkey = sc_1.loadUintBig(256);
    const sc_2 = sc_1.loadRef().beginParse();
    const _scan_pubkey = sc_2.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_2.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_2.loadUintBig(16);
    const _pq_kem_pubkey = sc_2.loadRef();
    const _crypto_suite_mask = sc_2.loadUintBig(16);
    const _created_at = sc_2.loadUintBig(64);
    const _created_lt = sc_2.loadUintBig(64);
    const _avatar_version = sc_2.loadUintBig(32);
    const _avatar_hash = sc_2.loadUintBig(256);
    const sc_3 = sc_2.loadRef().beginParse();
    const _avatar_entry_id = sc_3.loadUintBig(64);
    const _avatar_stream_id = sc_3.loadUintBig(128);
    const _avatar_part_count = sc_3.loadUintBig(16);
    const _avatar_media_format = sc_3.loadUintBig(8);
    const _avatar_updated_at = sc_3.loadUintBig(64);
    return { $$type: 'KeyShard$Data' as const, owner_wallet: _owner_wallet, profile_registry: _profile_registry, registered: _registered, key_id: _key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at };
}

export function loadTupleKeyShard$Data(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _profile_registry = source.readAddress();
    const _registered = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    source = source.readTuple();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _avatar_version = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _avatar_media_format = source.readBigNumber();
    const _avatar_updated_at = source.readBigNumber();
    return { $$type: 'KeyShard$Data' as const, owner_wallet: _owner_wallet, profile_registry: _profile_registry, registered: _registered, key_id: _key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at };
}

export function loadGetterTupleKeyShard$Data(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _profile_registry = source.readAddress();
    const _registered = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _avatar_version = source.readBigNumber();
    const _avatar_hash = source.readBigNumber();
    const _avatar_entry_id = source.readBigNumber();
    const _avatar_stream_id = source.readBigNumber();
    const _avatar_part_count = source.readBigNumber();
    const _avatar_media_format = source.readBigNumber();
    const _avatar_updated_at = source.readBigNumber();
    return { $$type: 'KeyShard$Data' as const, owner_wallet: _owner_wallet, profile_registry: _profile_registry, registered: _registered, key_id: _key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, avatar_version: _avatar_version, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, avatar_media_format: _avatar_media_format, avatar_updated_at: _avatar_updated_at };
}

export function storeTupleKeyShard$Data(source: KeyShard$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.profile_registry);
    builder.writeBoolean(source.registered);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.avatar_version);
    builder.writeNumber(source.avatar_hash);
    builder.writeNumber(source.avatar_entry_id);
    builder.writeNumber(source.avatar_stream_id);
    builder.writeNumber(source.avatar_part_count);
    builder.writeNumber(source.avatar_media_format);
    builder.writeNumber(source.avatar_updated_at);
    return builder.build();
}

export function dictValueParserKeyShard$Data(): DictionaryValue<KeyShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShard$Data(src.loadRef().beginParse());
        }
    }
}

export type BindProfileOfficialAthWallet = {
    $$type: 'BindProfileOfficialAthWallet';
    deployment_manifest_hash: bigint;
    official_ath_wallet_address: Address;
}

export function storeBindProfileOfficialAthWallet(src: BindProfileOfficialAthWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060609, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.official_ath_wallet_address);
    };
}

export function loadBindProfileOfficialAthWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060609) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _official_ath_wallet_address = sc_0.loadAddress();
    return { $$type: 'BindProfileOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadTupleBindProfileOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindProfileOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadGetterTupleBindProfileOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindProfileOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function storeTupleBindProfileOfficialAthWallet(source: BindProfileOfficialAthWallet) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.official_ath_wallet_address);
    return builder.build();
}

export function dictValueParserBindProfileOfficialAthWallet(): DictionaryValue<BindProfileOfficialAthWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindProfileOfficialAthWallet(src)).endCell());
        },
        parse: (src) => {
            return loadBindProfileOfficialAthWallet(src.loadRef().beginParse());
        }
    }
}

export type SealGenesis = {
    $$type: 'SealGenesis';
    deployment_manifest_hash: bigint;
}

export function storeSealGenesis(src: SealGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(974311853, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadSealGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 974311853) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'SealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'SealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'SealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleSealGenesis(source: SealGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserSealGenesis(): DictionaryValue<SealGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSealGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadSealGenesis(src.loadRef().beginParse());
        }
    }
}

export type FlushProfileTreasuryAthDue = {
    $$type: 'FlushProfileTreasuryAthDue';
    query_id: bigint;
}

export function storeFlushProfileTreasuryAthDue(src: FlushProfileTreasuryAthDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060624, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadFlushProfileTreasuryAthDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060624) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'FlushProfileTreasuryAthDue' as const, query_id: _query_id };
}

export function loadTupleFlushProfileTreasuryAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushProfileTreasuryAthDue' as const, query_id: _query_id };
}

export function loadGetterTupleFlushProfileTreasuryAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushProfileTreasuryAthDue' as const, query_id: _query_id };
}

export function storeTupleFlushProfileTreasuryAthDue(source: FlushProfileTreasuryAthDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserFlushProfileTreasuryAthDue(): DictionaryValue<FlushProfileTreasuryAthDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushProfileTreasuryAthDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushProfileTreasuryAthDue(src.loadRef().beginParse());
        }
    }
}

export type FlushProfileBurnAthDue = {
    $$type: 'FlushProfileBurnAthDue';
    query_id: bigint;
}

export function storeFlushProfileBurnAthDue(src: FlushProfileBurnAthDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060625, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadFlushProfileBurnAthDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060625) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'FlushProfileBurnAthDue' as const, query_id: _query_id };
}

export function loadTupleFlushProfileBurnAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushProfileBurnAthDue' as const, query_id: _query_id };
}

export function loadGetterTupleFlushProfileBurnAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushProfileBurnAthDue' as const, query_id: _query_id };
}

export function storeTupleFlushProfileBurnAthDue(source: FlushProfileBurnAthDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserFlushProfileBurnAthDue(): DictionaryValue<FlushProfileBurnAthDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushProfileBurnAthDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushProfileBurnAthDue(src.loadRef().beginParse());
        }
    }
}

export type ProfileRegistryTopUpStorageReserve = {
    $$type: 'ProfileRegistryTopUpStorageReserve';
}

export function storeProfileRegistryTopUpStorageReserve(src: ProfileRegistryTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060640, 32);
    };
}

export function loadProfileRegistryTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060640) { throw Error('Invalid prefix'); }
    return { $$type: 'ProfileRegistryTopUpStorageReserve' as const };
}

export function loadTupleProfileRegistryTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'ProfileRegistryTopUpStorageReserve' as const };
}

export function loadGetterTupleProfileRegistryTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'ProfileRegistryTopUpStorageReserve' as const };
}

export function storeTupleProfileRegistryTopUpStorageReserve(source: ProfileRegistryTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserProfileRegistryTopUpStorageReserve(): DictionaryValue<ProfileRegistryTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeProfileRegistryTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadProfileRegistryTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type ProfileAvatarTonExcessRefund = {
    $$type: 'ProfileAvatarTonExcessRefund';
    query_id: bigint;
    owner_wallet: Address;
    amount: bigint;
}

export function storeProfileAvatarTonExcessRefund(src: ProfileAvatarTonExcessRefund) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060641, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadProfileAvatarTonExcessRefund(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060641) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'ProfileAvatarTonExcessRefund' as const, query_id: _query_id, owner_wallet: _owner_wallet, amount: _amount };
}

export function loadTupleProfileAvatarTonExcessRefund(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    return { $$type: 'ProfileAvatarTonExcessRefund' as const, query_id: _query_id, owner_wallet: _owner_wallet, amount: _amount };
}

export function loadGetterTupleProfileAvatarTonExcessRefund(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    return { $$type: 'ProfileAvatarTonExcessRefund' as const, query_id: _query_id, owner_wallet: _owner_wallet, amount: _amount };
}

export function storeTupleProfileAvatarTonExcessRefund(source: ProfileAvatarTonExcessRefund) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserProfileAvatarTonExcessRefund(): DictionaryValue<ProfileAvatarTonExcessRefund> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeProfileAvatarTonExcessRefund(src)).endCell());
        },
        parse: (src) => {
            return loadProfileAvatarTonExcessRefund(src.loadRef().beginParse());
        }
    }
}

export type PruneStaleAvatarWrite = {
    $$type: 'PruneStaleAvatarWrite';
    write_id: bigint;
}

export function storePruneStaleAvatarWrite(src: PruneStaleAvatarWrite) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060643, 32);
        b_0.storeUint(src.write_id, 64);
    };
}

export function loadPruneStaleAvatarWrite(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060643) { throw Error('Invalid prefix'); }
    const _write_id = sc_0.loadUintBig(64);
    return { $$type: 'PruneStaleAvatarWrite' as const, write_id: _write_id };
}

export function loadTuplePruneStaleAvatarWrite(source: TupleReader) {
    const _write_id = source.readBigNumber();
    return { $$type: 'PruneStaleAvatarWrite' as const, write_id: _write_id };
}

export function loadGetterTuplePruneStaleAvatarWrite(source: TupleReader) {
    const _write_id = source.readBigNumber();
    return { $$type: 'PruneStaleAvatarWrite' as const, write_id: _write_id };
}

export function storeTuplePruneStaleAvatarWrite(source: PruneStaleAvatarWrite) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.write_id);
    return builder.build();
}

export function dictValueParserPruneStaleAvatarWrite(): DictionaryValue<PruneStaleAvatarWrite> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePruneStaleAvatarWrite(src)).endCell());
        },
        parse: (src) => {
            return loadPruneStaleAvatarWrite(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileAvatarWrite = {
    $$type: 'PendingProfileAvatarWrite';
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    owner_wallet: Address;
    created_at: bigint;
}

export function storePendingProfileAvatarWrite(src: PendingProfileAvatarWrite) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingProfileAvatarWrite(slice: Slice) {
    const sc_0 = slice;
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _amount = sc_0.loadUintBig(128);
    const _owner_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingProfileAvatarWrite' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, owner_wallet: _owner_wallet, created_at: _created_at };
}

export function loadTuplePendingProfileAvatarWrite(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarWrite' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, owner_wallet: _owner_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingProfileAvatarWrite(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarWrite' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, owner_wallet: _owner_wallet, created_at: _created_at };
}

export function storeTuplePendingProfileAvatarWrite(source: PendingProfileAvatarWrite) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileAvatarWrite(): DictionaryValue<PendingProfileAvatarWrite> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileAvatarWrite(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileAvatarWrite(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileAvatarWriteView = {
    $$type: 'PendingProfileAvatarWriteView';
    exists: boolean;
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    owner_wallet: Address;
    created_at: bigint;
}

export function storePendingProfileAvatarWriteView(src: PendingProfileAvatarWriteView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.query_id, 257);
        b_0.storeInt(src.sender_key, 257);
        b_0.storeInt(src.amount, 257);
        const b_1 = new Builder();
        b_1.storeAddress(src.owner_wallet);
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingProfileAvatarWriteView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _query_id = sc_0.loadIntBig(257);
    const _sender_key = sc_0.loadIntBig(257);
    const _amount = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _owner_wallet = sc_1.loadAddress();
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'PendingProfileAvatarWriteView' as const, exists: _exists, query_id: _query_id, sender_key: _sender_key, amount: _amount, owner_wallet: _owner_wallet, created_at: _created_at };
}

export function loadTuplePendingProfileAvatarWriteView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarWriteView' as const, exists: _exists, query_id: _query_id, sender_key: _sender_key, amount: _amount, owner_wallet: _owner_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingProfileAvatarWriteView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarWriteView' as const, exists: _exists, query_id: _query_id, sender_key: _sender_key, amount: _amount, owner_wallet: _owner_wallet, created_at: _created_at };
}

export function storeTuplePendingProfileAvatarWriteView(source: PendingProfileAvatarWriteView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileAvatarWriteView(): DictionaryValue<PendingProfileAvatarWriteView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileAvatarWriteView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileAvatarWriteView(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileTreasuryFlush = {
    $$type: 'PendingProfileTreasuryFlush';
    amount: bigint;
    recipient_ath_wallet: Address;
    created_at: bigint;
}

export function storePendingProfileTreasuryFlush(src: PendingProfileTreasuryFlush) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingProfileTreasuryFlush(slice: Slice) {
    const sc_0 = slice;
    const _amount = sc_0.loadUintBig(128);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingProfileTreasuryFlush' as const, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadTuplePendingProfileTreasuryFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileTreasuryFlush' as const, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingProfileTreasuryFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileTreasuryFlush' as const, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function storeTuplePendingProfileTreasuryFlush(source: PendingProfileTreasuryFlush) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileTreasuryFlush(): DictionaryValue<PendingProfileTreasuryFlush> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileTreasuryFlush(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileTreasuryFlush(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileBurnFlush = {
    $$type: 'PendingProfileBurnFlush';
    amount: bigint;
    created_at: bigint;
}

export function storePendingProfileBurnFlush(src: PendingProfileBurnFlush) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingProfileBurnFlush(slice: Slice) {
    const sc_0 = slice;
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingProfileBurnFlush' as const, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingProfileBurnFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileBurnFlush' as const, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingProfileBurnFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileBurnFlush' as const, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingProfileBurnFlush(source: PendingProfileBurnFlush) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileBurnFlush(): DictionaryValue<PendingProfileBurnFlush> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileBurnFlush(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileBurnFlush(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileTreasuryFlushView = {
    $$type: 'PendingProfileTreasuryFlushView';
    exists: boolean;
    amount: bigint;
    recipient_ath_wallet: Address;
    created_at: bigint;
}

export function storePendingProfileTreasuryFlushView(src: PendingProfileTreasuryFlushView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.amount, 257);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPendingProfileTreasuryFlushView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _amount = sc_0.loadIntBig(257);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PendingProfileTreasuryFlushView' as const, exists: _exists, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadTuplePendingProfileTreasuryFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileTreasuryFlushView' as const, exists: _exists, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingProfileTreasuryFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileTreasuryFlushView' as const, exists: _exists, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function storeTuplePendingProfileTreasuryFlushView(source: PendingProfileTreasuryFlushView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileTreasuryFlushView(): DictionaryValue<PendingProfileTreasuryFlushView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileTreasuryFlushView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileTreasuryFlushView(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileBurnFlushView = {
    $$type: 'PendingProfileBurnFlushView';
    exists: boolean;
    amount: bigint;
    created_at: bigint;
}

export function storePendingProfileBurnFlushView(src: PendingProfileBurnFlushView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.amount, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPendingProfileBurnFlushView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _amount = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PendingProfileBurnFlushView' as const, exists: _exists, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingProfileBurnFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileBurnFlushView' as const, exists: _exists, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingProfileBurnFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileBurnFlushView' as const, exists: _exists, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingProfileBurnFlushView(source: PendingProfileBurnFlushView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileBurnFlushView(): DictionaryValue<PendingProfileBurnFlushView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileBurnFlushView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileBurnFlushView(src.loadRef().beginParse());
        }
    }
}

export type ProfileRegistryGlobalView = {
    $$type: 'ProfileRegistryGlobalView';
    sealed: boolean;
    official_ath_wallet_bound: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    genesis_controller_address: Address;
    profile_count: bigint;
    pending_avatar_write_count: bigint;
    next_avatar_write_id: bigint;
    treasury_due_ath: bigint;
    burn_due_ath: bigint;
    pending_treasury_flush_count: bigint;
    pending_burn_flush_count: bigint;
}

export function storeProfileRegistryGlobalView(src: ProfileRegistryGlobalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeBit(src.official_ath_wallet_bound);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.official_ath_wallet_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.ath_master_address);
        b_1.storeAddress(src.treasury_ath_receiver_address);
        b_1.storeAddress(src.genesis_controller_address);
        const b_2 = new Builder();
        b_2.storeInt(src.profile_count, 257);
        b_2.storeInt(src.pending_avatar_write_count, 257);
        b_2.storeInt(src.next_avatar_write_id, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.treasury_due_ath, 257);
        b_3.storeInt(src.burn_due_ath, 257);
        b_3.storeInt(src.pending_treasury_flush_count, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.pending_burn_flush_count, 257);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadProfileRegistryGlobalView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _official_ath_wallet_bound = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _official_ath_wallet_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _ath_master_address = sc_1.loadAddress();
    const _treasury_ath_receiver_address = sc_1.loadAddress();
    const _genesis_controller_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _profile_count = sc_2.loadIntBig(257);
    const _pending_avatar_write_count = sc_2.loadIntBig(257);
    const _next_avatar_write_id = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _treasury_due_ath = sc_3.loadIntBig(257);
    const _burn_due_ath = sc_3.loadIntBig(257);
    const _pending_treasury_flush_count = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _pending_burn_flush_count = sc_4.loadIntBig(257);
    return { $$type: 'ProfileRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, genesis_controller_address: _genesis_controller_address, profile_count: _profile_count, pending_avatar_write_count: _pending_avatar_write_count, next_avatar_write_id: _next_avatar_write_id, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count };
}

export function loadTupleProfileRegistryGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _profile_count = source.readBigNumber();
    const _pending_avatar_write_count = source.readBigNumber();
    const _next_avatar_write_id = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    return { $$type: 'ProfileRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, genesis_controller_address: _genesis_controller_address, profile_count: _profile_count, pending_avatar_write_count: _pending_avatar_write_count, next_avatar_write_id: _next_avatar_write_id, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count };
}

export function loadGetterTupleProfileRegistryGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _profile_count = source.readBigNumber();
    const _pending_avatar_write_count = source.readBigNumber();
    const _next_avatar_write_id = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    return { $$type: 'ProfileRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, genesis_controller_address: _genesis_controller_address, profile_count: _profile_count, pending_avatar_write_count: _pending_avatar_write_count, next_avatar_write_id: _next_avatar_write_id, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count };
}

export function storeTupleProfileRegistryGlobalView(source: ProfileRegistryGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.treasury_ath_receiver_address);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.profile_count);
    builder.writeNumber(source.pending_avatar_write_count);
    builder.writeNumber(source.next_avatar_write_id);
    builder.writeNumber(source.treasury_due_ath);
    builder.writeNumber(source.burn_due_ath);
    builder.writeNumber(source.pending_treasury_flush_count);
    builder.writeNumber(source.pending_burn_flush_count);
    return builder.build();
}

export function dictValueParserProfileRegistryGlobalView(): DictionaryValue<ProfileRegistryGlobalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeProfileRegistryGlobalView(src)).endCell());
        },
        parse: (src) => {
            return loadProfileRegistryGlobalView(src.loadRef().beginParse());
        }
    }
}

export type ProfileRegistry$Data = {
    $$type: 'ProfileRegistry$Data';
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: boolean;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    genesis_controller_address: Address;
    profile_count: bigint;
    treasury_due_ath: bigint;
    burn_due_ath: bigint;
    pending_avatar_writes: Dictionary<bigint, PendingProfileAvatarWrite>;
    pending_avatar_write_count: bigint;
    next_avatar_write_id: bigint;
    pending_treasury_flushes: Dictionary<bigint, PendingProfileTreasuryFlush>;
    pending_treasury_flush_count: bigint;
    pending_burn_flushes: Dictionary<bigint, PendingProfileBurnFlush>;
    pending_burn_flush_count: bigint;
}

export function storeProfileRegistry$Data(src: ProfileRegistry$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.official_ath_wallet_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.treasury_ath_receiver_address);
        b_0.storeBit(src.official_ath_wallet_bound);
        b_0.storeBit(src.sealed);
        const b_1 = new Builder();
        b_1.storeUint(src.deployment_manifest_hash, 256);
        b_1.storeUint(src.genesis_config_hash, 256);
        b_1.storeAddress(src.genesis_controller_address);
        b_1.storeUint(src.profile_count, 64);
        b_1.storeUint(src.treasury_due_ath, 128);
        const b_2 = new Builder();
        b_2.storeUint(src.burn_due_ath, 128);
        b_2.storeDict(src.pending_avatar_writes, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarWrite());
        b_2.storeUint(src.pending_avatar_write_count, 64);
        b_2.storeUint(src.next_avatar_write_id, 64);
        b_2.storeDict(src.pending_treasury_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileTreasuryFlush());
        b_2.storeUint(src.pending_treasury_flush_count, 64);
        b_2.storeDict(src.pending_burn_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileBurnFlush());
        b_2.storeUint(src.pending_burn_flush_count, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadProfileRegistry$Data(slice: Slice) {
    const sc_0 = slice;
    const _official_ath_wallet_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _treasury_ath_receiver_address = sc_0.loadAddress();
    const _official_ath_wallet_bound = sc_0.loadBit();
    const _sealed = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _deployment_manifest_hash = sc_1.loadUintBig(256);
    const _genesis_config_hash = sc_1.loadUintBig(256);
    const _genesis_controller_address = sc_1.loadAddress();
    const _profile_count = sc_1.loadUintBig(64);
    const _treasury_due_ath = sc_1.loadUintBig(128);
    const sc_2 = sc_1.loadRef().beginParse();
    const _burn_due_ath = sc_2.loadUintBig(128);
    const _pending_avatar_writes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarWrite(), sc_2);
    const _pending_avatar_write_count = sc_2.loadUintBig(64);
    const _next_avatar_write_id = sc_2.loadUintBig(64);
    const _pending_treasury_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileTreasuryFlush(), sc_2);
    const _pending_treasury_flush_count = sc_2.loadUintBig(64);
    const _pending_burn_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileBurnFlush(), sc_2);
    const _pending_burn_flush_count = sc_2.loadUintBig(64);
    return { $$type: 'ProfileRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, profile_count: _profile_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_avatar_writes: _pending_avatar_writes, pending_avatar_write_count: _pending_avatar_write_count, next_avatar_write_id: _next_avatar_write_id, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count };
}

export function loadTupleProfileRegistry$Data(source: TupleReader) {
    const _official_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _official_ath_wallet_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _profile_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_avatar_writes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarWrite(), source.readCellOpt());
    const _pending_avatar_write_count = source.readBigNumber();
    const _next_avatar_write_id = source.readBigNumber();
    source = source.readTuple();
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    return { $$type: 'ProfileRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, profile_count: _profile_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_avatar_writes: _pending_avatar_writes, pending_avatar_write_count: _pending_avatar_write_count, next_avatar_write_id: _next_avatar_write_id, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count };
}

export function loadGetterTupleProfileRegistry$Data(source: TupleReader) {
    const _official_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _official_ath_wallet_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _profile_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_avatar_writes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarWrite(), source.readCellOpt());
    const _pending_avatar_write_count = source.readBigNumber();
    const _next_avatar_write_id = source.readBigNumber();
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    return { $$type: 'ProfileRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, profile_count: _profile_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_avatar_writes: _pending_avatar_writes, pending_avatar_write_count: _pending_avatar_write_count, next_avatar_write_id: _next_avatar_write_id, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count };
}

export function storeTupleProfileRegistry$Data(source: ProfileRegistry$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.treasury_ath_receiver_address);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.profile_count);
    builder.writeNumber(source.treasury_due_ath);
    builder.writeNumber(source.burn_due_ath);
    builder.writeCell(source.pending_avatar_writes.size > 0 ? beginCell().storeDictDirect(source.pending_avatar_writes, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarWrite()).endCell() : null);
    builder.writeNumber(source.pending_avatar_write_count);
    builder.writeNumber(source.next_avatar_write_id);
    builder.writeCell(source.pending_treasury_flushes.size > 0 ? beginCell().storeDictDirect(source.pending_treasury_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileTreasuryFlush()).endCell() : null);
    builder.writeNumber(source.pending_treasury_flush_count);
    builder.writeCell(source.pending_burn_flushes.size > 0 ? beginCell().storeDictDirect(source.pending_burn_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileBurnFlush()).endCell() : null);
    builder.writeNumber(source.pending_burn_flush_count);
    return builder.build();
}

export function dictValueParserProfileRegistry$Data(): DictionaryValue<ProfileRegistry$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeProfileRegistry$Data(src)).endCell());
        },
        parse: (src) => {
            return loadProfileRegistry$Data(src.loadRef().beginParse());
        }
    }
}

 type KeyShard_init_args = {
    $$type: 'KeyShard_init_args';
    owner_wallet: Address;
    profile_registry: Address;
}

function initKeyShard_init_args(src: KeyShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.profile_registry);
    };
}

async function KeyShard_init(owner_wallet: Address, profile_registry: Address) {
    const __code = Cell.fromHex('b5ee9c7241022a01000d88000114ff00f4a413f4bcf2c80b010201200217020148031504d4d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e9dfa40fa405902d101707054700054700053008854711154700054700020e30d1118945f0f5f09e0705617d74920c21f97311117d31f1118de2182104b534731bae3022182104b534735ba1819040b01fe5b1116d3ffd3ffd3ffd430d0d3ffd3ffd30fd4d30f30815622f842561ec705f2f41116111c11161115111b11151114111a11141113111911131112111811121111111711111110111c11100f111b0f0e111a0e0d11190d0c11180c0b11170b0a111c0a09111b0908111a0807111907061118060511170504111c0403111b030502f602111a0201111d01111e561956195619561e561e56225624db3c815666561dc300f2f4815667561d561abdf2f481565ef8416f24135f035616958208b71b0095820b65c040e2bef2f48156655612841fb9f2f4561420935612a49170e21118111e11181117111d11171116111c11161115111b11151114111a11140608017081565507c30017f2f481565605c30015f2f481565703c30013f2f481565b24c002f2f481565901c300f2f481565a218104a0baf2f459db3c0700e881565b02c00212f2f4207af94181565c03c00a13f2f481565d01812500baf2f481566101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d081566221d74923aa02baf2f45331bc9e3281566322d74ac001f2f401d4309b81566401d74ac000f2f401e259a101e85b03fe1113111911131112111811121111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a1039481710364514401301111f011120db3c5712f8276f10f8416f24135f03a111179a5716820aaea54076fb02e30df8427081008270136d5520c8cf8580ca00cf844027090a002e1116820aaea540b998820aaea54072fb02947076fb02e20160ce01fa02806acf40f400c901fb001114111611141113111511131112111411121111111311110f11110f0e11100e551d25049ee3022182104b534737bae30257182082104b534734ba8eab3057161114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0c0001117c12101111701b00c0f251402fe10235f0357161114d33ffa40d3ffd33fd37fd30fd307308156b8f842561ac705f2f48156b906561ac70516f2f48156ba5617f2f48156bbf8416f24135f0382087a1200bef2f48156be29841fb9f2f428c2009b03111a030211190236365be30d04a4f823f842708042705165c85982104b5347365003cb1fcb3fcb1fc910340d0e005a5173ba9511185618ba93571870e2935144ba923470e294111721ba93571770e28156bd01b3f2f402111502102301b2413016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057060550442502fc5b1116d33ffa40308156cc5615f2f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609081116080711160706111606051116050411160403111603021116020111160111178156cd11195618db3c01111a011011000afa4430c00002fef2f48156cef8416f24135f038208895440bef2f48156cff8416f24135f038209312d00bbf2f482084c4b40717f1119561856165615561556155615561556155615561556155615561456145614561456145614562dc81114111311121111111055e0db3cc904111a04413001111901441359c8cf8580ca00cf8440ce01fa021213009882104b534738011115cb1f01111301cb3f01111101ce1fcbff1dcb1f1bcb3f19cbff07c8cbff16cbff14cbff12cb0fcccb0fcb3f12cb1f02c8cbff13cb3f13cb7f13cb0f13cb0713cb3fcdcd0160806acf40f400c901fb001113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d552c2501648ea81114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de05f0f5f08f2c0822503f1a052a5da89a1a400031d3bf481f480b205a202e0e0a8e000a8e000a60110a8e222a8e000a8e00041c61bb678ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae32ae3202223002222e02222c02222a022228022226022224022222022220021eab8318191600a4820b65c0408208b71b008209312d00561703561a03561803561703561703561703561703561703561703561703561703561703561703561741335626015618015618015618015618015618015618015618010382f2ed44d0d200018e9dfa40fa405902d101707054700054700053008854711154700054700020e30d1117d70d1ff2e0820182104b534732bae3025f0f5f09f2c08218191a000000f6fa40fa40d200d3ffd401d0d3ffd31fd33fd3ffd3ffd430d0d3ffd3ffd30fd4d30fd33fd33fd31fd3ffd430d0d33fd37fd30fd307d33f3011131117111311131116111311131115111311131114111357171115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e01e28308d718d41117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180908111808071118070611180605111805041118040311180302111802011119011b01fc81597421d749c000f2f481597501d74ac000f2f48156685615f2f48156705613c300f2f48156725619f9000111195614f91001111801f2f41117d081567821d749810160baf2f481567921d74ac001f2f4d31f8156730282104b534b31ba12f2f4d3fff82881567501d30a018309ba12f2f481567501d3ff3013ba12f2f41c04f8d33f815677025611ba12f2f481567af8276f108209312d00bef2f4f8000fa4f80f0fd430d020d749810320ba8eab301114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce120d74ac002e303d3ffd3ffd3ffd30fd30fd4d430d020d7498307bae30320d74ac000251d1e1f0156301114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c2501585f071114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c2502f88eac5f071114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce1d3ff301116111b11161115111a11151114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d11170d0c111b0c0b111a0b0a11190a0911180908111708252004d207111b0706111a0605111905041118040311170302111b0201111d01111c561a561a561a561f561b56225621db3c8eac57175717571757175717571757170f11160f0e11150e0d11140d0c11130c0b11120b0a11110a091110095568e156195613bde3035611841fb921252324015806935f0670e104935f0570e102935f0470e123c302935f0470e0935f0370e1208104a0bd935f0370e059db3c2200b8eda2edfb01c302925b70e09321c2008e48807f228104a0ba933080299722c17f923021dee221d020d74922aa02bd955f0470db31e05331bc8e103221d74ac301955f0370db31e001d4309ad74a955f0370db31e001e259a101e85b7f015857175717571757175717571757170f11160f0e11150e0d11140d0c11130c0b11120b0a11110a0911100955682502fc8eac57175717571757175717571757170f11160f0e11150e0d11140d0c11130c0b11120b0a11110a091110095568e15611a41117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009252600e0c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ca0001111001cbff0ec8cbff1dcb1f1bcb3f19cbff17cbff05c8cbff14cbff12cb0fcccb0f12cb3f12cb3f12cb1f12cbff03c8cb3f14cb7f14cb0f14cb0714cb3f12cd12cdcdc9ed5401f4108f107e55664330db3cc87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ca0001111001cbff0ec8cbff1dcb1f1bcb3f19cbff17cbff05c8cbff14cbff12cb0fcccb0f12cb3f12cb3f12cb1f12cbff03c8cb3f14cb7f14cb0f14cb0714cb3f12cd12cdcdc9ed542702f61116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e111e0e0d111d0d0c111c0c0b111b0b0a111a0a09111909081118080711170706111e0605111d0504111c0403111b0302111a020111190111185617561f561f561e561e561ddb3c6c8838393a28290046c815cbff13cbffcbffc9c882104b45594901cb1f561bcf1614cb1fcb0fcb0fccc9f900005a3af823f8250d11150d0c11140c7f1114071113070a11120a0f11110f0811100810ef0d0e107c0a0b1089480702c4a4a7c7');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initKeyShard_init_args({ $$type: 'KeyShard_init_args', owner_wallet, profile_registry })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const KeyShard_errors = {
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

export const KeyShard_errors_backward = {
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

const KeyShard_types: ABIType[] = [
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
    {"name":"KeyShardRegisterKeys","header":1263748913,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"KeyShardReplaceKeys","header":1263748914,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"KeyShardTopUpStorageReserve","header":1263748916,"fields":[]},
    {"name":"KeyShardSetAvatarPointer","header":1263748917,"fields":[{"name":"write_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"KeyShardAvatarPointerAck","header":1263748918,"fields":[{"name":"write_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"version","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"KeyShardProveOwnership","header":1263748919,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"KeyShardOwnershipProof","header":1263748920,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"rotation_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_version","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"avatar_media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"avatar_updated_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"KeyShardView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"rotation_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"scan_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_register_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_replace_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"profile_registry","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_version","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"avatar_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"avatar_part_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"avatar_media_format","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"avatar_updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"rotation_min_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"KeyShard$Data","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"rotation_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_version","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"avatar_media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"avatar_updated_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"BindProfileOfficialAthWallet","header":1353060609,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushProfileTreasuryAthDue","header":1353060624,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FlushProfileBurnAthDue","header":1353060625,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ProfileRegistryTopUpStorageReserve","header":1353060640,"fields":[]},
    {"name":"ProfileAvatarTonExcessRefund","header":1353060641,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PruneStaleAvatarWrite","header":1353060643,"fields":[{"name":"write_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingProfileAvatarWrite","header":null,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingProfileAvatarWriteView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sender_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingProfileTreasuryFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingProfileBurnFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingProfileTreasuryFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingProfileBurnFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"ProfileRegistryGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_ath_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_avatar_write_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_avatar_write_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"burn_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"ProfileRegistry$Data","header":null,"fields":[{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_ath_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"burn_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pending_avatar_writes","type":{"kind":"dict","key":"int","value":"PendingProfileAvatarWrite","valueFormat":"ref"}},{"name":"pending_avatar_write_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"next_avatar_write_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_treasury_flushes","type":{"kind":"dict","key":"int","value":"PendingProfileTreasuryFlush","valueFormat":"ref"}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_burn_flushes","type":{"kind":"dict","key":"int","value":"PendingProfileBurnFlush","valueFormat":"ref"}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const KeyShard_opcodes = {
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
    "KeyShardRegisterKeys": 1263748913,
    "KeyShardReplaceKeys": 1263748914,
    "KeyShardTopUpStorageReserve": 1263748916,
    "KeyShardSetAvatarPointer": 1263748917,
    "KeyShardAvatarPointerAck": 1263748918,
    "KeyShardProveOwnership": 1263748919,
    "KeyShardOwnershipProof": 1263748920,
    "BindProfileOfficialAthWallet": 1353060609,
    "SealGenesis": 974311853,
    "FlushProfileTreasuryAthDue": 1353060624,
    "FlushProfileBurnAthDue": 1353060625,
    "ProfileRegistryTopUpStorageReserve": 1353060640,
    "ProfileAvatarTonExcessRefund": 1353060641,
    "PruneStaleAvatarWrite": 1353060643,
}

const KeyShard_getters: ABIGetter[] = [
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"KeyShardView","optional":false}},
]

export const KeyShard_getterMapping: { [key: string]: string } = {
    'get_view': 'getGetView',
}

const KeyShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"KeyShardRegisterKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"KeyShardSetAvatarPointer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"KeyShardProveOwnership"}},
    {"receiver":"external","message":{"kind":"typed","type":"KeyShardReplaceKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"KeyShardTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_REGISTRY_RESPONSE_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 4000000n;
export const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 21000000n;
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
export const KS_CRYPTO_SUITE_HYBRID = 2n;
export const KS_MLKEM768_PUBKEY_LEN = 1184n;
export const KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES = 127n;
export const KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES = 41n;
export const KS_MLKEM768_PUBKEY_SNAKE_CELLS = 10n;
export const KS_MLKEM768_PUBKEY_SNAKE_BITS = 9472n;
export const KS_MLKEM768_PUBKEY_SNAKE_REFS = 9n;
export const KS_UINT32_MAX = 4294967295n;
export const KS_KEY_ID_DOMAIN = 1262836041n;
export const KS_REPLACE_KEYS_SIGNING_DOMAIN = 1263749937n;
export const KS_YEARS_FUNDED = 10n;
export const KS_BASE_ENDOWMENT = 45000000n;
export const KS_REGISTER_GAS = 12000000n;
export const KS_MIN_REGISTER_VALUE = 57000000n;
export const KS_MIN_REPLACE_VALUE = 12000000n;
export const KS_AVATAR_WRITE_GAS = 8000000n;
export const KS_ROTATION_MIN_BALANCE = 20000000n;
export const KS_PROOF_FORWARD_RESERVE = 5000000n;
export const KS_PROOF_EXEC_RESERVE = 4000000n;
export const KS_PROOF_MAX_VALUE = 20000000n;
export const PROFILE_AVATAR_PRICE_ATH = 100000000000n;
export const PROFILE_STATE_GROWTH_EXEC_RESERVE = 3000000n;
export const PROFILE_KEY_SHARD_WRITE_VALUE = 50000000n;
export const PROFILE_ATH_NOTIFICATION_REFUND_VALUE = 45000000n;
export const PROFILE_AVATAR_SETTLE_EXEC_RESERVE = 5000000n;
export const PROFILE_AVATAR_WRITE_STALE_TTL = 86400n;
export const PROFILE_ATH_NOTIFICATION_ACK_VALUE = 1000000n;
export const PROFILE_AVATAR_EXCESS_REFUND_MIN_VALUE = 100000n;
export const PROFILE_VAULT_EXCESS_REFUND_EXEC_RESERVE = 2000000n;
export const PROFILE_EXCESS_REFUND_FORWARD_RESERVE = 200000n;
export const PROFILE_ATH_TRANSFER_EXEC_RESERVE = 48000000n;
export const PROFILE_ATH_BURN_EXEC_RESERVE = 5000000n;
export const PROFILE_DUE_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const PROFILE_SPLIT_BASE_BPS = 10000n;
export const PROFILE_TREASURY_SHARE_BPS = 5000n;
export const PROFILE_AVATAR_MAX_PARTS = 2n;
export const PROFILE_AVATAR_MEDIA_FORMAT_WEBP = 1n;

export class KeyShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = KeyShard_errors_backward;
    public static readonly opcodes = KeyShard_opcodes;
    
    static async init(owner_wallet: Address, profile_registry: Address) {
        return await KeyShard_init(owner_wallet, profile_registry);
    }
    
    static async fromInit(owner_wallet: Address, profile_registry: Address) {
        const __gen_init = await KeyShard_init(owner_wallet, profile_registry);
        const address = contractAddress(0, __gen_init);
        return new KeyShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new KeyShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  KeyShard_types,
        getters: KeyShard_getters,
        receivers: KeyShard_receivers,
        errors: KeyShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: KeyShardRegisterKeys | KeyShardSetAvatarPointer | KeyShardProveOwnership | KeyShardTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardRegisterKeys') {
            body = beginCell().store(storeKeyShardRegisterKeys(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardSetAvatarPointer') {
            body = beginCell().store(storeKeyShardSetAvatarPointer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardProveOwnership') {
            body = beginCell().store(storeKeyShardProveOwnership(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardTopUpStorageReserve') {
            body = beginCell().store(storeKeyShardTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async sendExternal(provider: ContractProvider, message: KeyShardReplaceKeys) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardReplaceKeys') {
            body = beginCell().store(storeKeyShardReplaceKeys(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.external(body);
        
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTupleKeyShardView(source);
        return result;
    }
    
}