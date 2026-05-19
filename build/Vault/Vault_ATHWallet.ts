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

export type PendingAthTransferNotification = {
    $$type: 'PendingAthTransferNotification';
    sender_owner: Address;
    amount: bigint;
}

export function storePendingAthTransferNotification(src: PendingAthTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.sender_owner);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadPendingAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    const _sender_owner = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, amount: _amount };
}

export function loadTuplePendingAthTransferNotification(source: TupleReader) {
    const _sender_owner = source.readAddress();
    const _amount = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, amount: _amount };
}

export function loadGetterTuplePendingAthTransferNotification(source: TupleReader) {
    const _sender_owner = source.readAddress();
    const _amount = source.readBigNumber();
    return { $$type: 'PendingAthTransferNotification' as const, sender_owner: _sender_owner, amount: _amount };
}

export function storeTuplePendingAthTransferNotification(source: PendingAthTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sender_owner);
    builder.writeNumber(source.amount);
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

export type BindDeploymentManifest = {
    $$type: 'BindDeploymentManifest';
    deployment_manifest_hash: bigint;
    counterpart_address: Address;
}

export function storeBindDeploymentManifest(src: BindDeploymentManifest) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2430787787, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.counterpart_address);
    };
}

export function loadBindDeploymentManifest(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2430787787) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _counterpart_address = sc_0.loadAddress();
    return { $$type: 'BindDeploymentManifest' as const, deployment_manifest_hash: _deployment_manifest_hash, counterpart_address: _counterpart_address };
}

export function loadTupleBindDeploymentManifest(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _counterpart_address = source.readAddress();
    return { $$type: 'BindDeploymentManifest' as const, deployment_manifest_hash: _deployment_manifest_hash, counterpart_address: _counterpart_address };
}

export function loadGetterTupleBindDeploymentManifest(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _counterpart_address = source.readAddress();
    return { $$type: 'BindDeploymentManifest' as const, deployment_manifest_hash: _deployment_manifest_hash, counterpart_address: _counterpart_address };
}

export function storeTupleBindDeploymentManifest(source: BindDeploymentManifest) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.counterpart_address);
    return builder.build();
}

export function dictValueParserBindDeploymentManifest(): DictionaryValue<BindDeploymentManifest> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindDeploymentManifest(src)).endCell());
        },
        parse: (src) => {
            return loadBindDeploymentManifest(src.loadRef().beginParse());
        }
    }
}

export type BindOfficialAthWallet = {
    $$type: 'BindOfficialAthWallet';
    deployment_manifest_hash: bigint;
    official_ath_wallet_address: Address;
}

export function storeBindOfficialAthWallet(src: BindOfficialAthWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(417017035, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.official_ath_wallet_address);
    };
}

export function loadBindOfficialAthWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 417017035) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _official_ath_wallet_address = sc_0.loadAddress();
    return { $$type: 'BindOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadTupleBindOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function loadGetterTupleBindOfficialAthWallet(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    return { $$type: 'BindOfficialAthWallet' as const, deployment_manifest_hash: _deployment_manifest_hash, official_ath_wallet_address: _official_ath_wallet_address };
}

export function storeTupleBindOfficialAthWallet(source: BindOfficialAthWallet) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.official_ath_wallet_address);
    return builder.build();
}

export function dictValueParserBindOfficialAthWallet(): DictionaryValue<BindOfficialAthWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindOfficialAthWallet(src)).endCell());
        },
        parse: (src) => {
            return loadBindOfficialAthWallet(src.loadRef().beginParse());
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

export type DepositTon = {
    $$type: 'DepositTon';
    amount: bigint;
}

export function storeDepositTon(src: DepositTon) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(716160408, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadDepositTon(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 716160408) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'DepositTon' as const, amount: _amount };
}

export function loadTupleDepositTon(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'DepositTon' as const, amount: _amount };
}

export function loadGetterTupleDepositTon(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'DepositTon' as const, amount: _amount };
}

export function storeTupleDepositTon(source: DepositTon) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserDepositTon(): DictionaryValue<DepositTon> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDepositTon(src)).endCell());
        },
        parse: (src) => {
            return loadDepositTon(src.loadRef().beginParse());
        }
    }
}

export type WithdrawTon = {
    $$type: 'WithdrawTon';
    amount: bigint;
    recipient: Address;
}

export function storeWithdrawTon(src: WithdrawTon) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1212947826, 32);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
    };
}

export function loadWithdrawTon(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1212947826) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    return { $$type: 'WithdrawTon' as const, amount: _amount, recipient: _recipient };
}

export function loadTupleWithdrawTon(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    return { $$type: 'WithdrawTon' as const, amount: _amount, recipient: _recipient };
}

export function loadGetterTupleWithdrawTon(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    return { $$type: 'WithdrawTon' as const, amount: _amount, recipient: _recipient };
}

export function storeTupleWithdrawTon(source: WithdrawTon) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    return builder.build();
}

export function dictValueParserWithdrawTon(): DictionaryValue<WithdrawTon> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeWithdrawTon(src)).endCell());
        },
        parse: (src) => {
            return loadWithdrawTon(src.loadRef().beginParse());
        }
    }
}

export type WithdrawAth = {
    $$type: 'WithdrawAth';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
}

export function storeWithdrawAth(src: WithdrawAth) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4188293172, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
    };
}

export function loadWithdrawAth(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4188293172) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    return { $$type: 'WithdrawAth' as const, query_id: _query_id, amount: _amount, recipient: _recipient };
}

export function loadTupleWithdrawAth(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    return { $$type: 'WithdrawAth' as const, query_id: _query_id, amount: _amount, recipient: _recipient };
}

export function loadGetterTupleWithdrawAth(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    return { $$type: 'WithdrawAth' as const, query_id: _query_id, amount: _amount, recipient: _recipient };
}

export function storeTupleWithdrawAth(source: WithdrawAth) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    return builder.build();
}

export function dictValueParserWithdrawAth(): DictionaryValue<WithdrawAth> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeWithdrawAth(src)).endCell());
        },
        parse: (src) => {
            return loadWithdrawAth(src.loadRef().beginParse());
        }
    }
}

export type TopUpMessageBudget = {
    $$type: 'TopUpMessageBudget';
    amount: bigint;
}

export function storeTopUpMessageBudget(src: TopUpMessageBudget) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2258722706, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadTopUpMessageBudget(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2258722706) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'TopUpMessageBudget' as const, amount: _amount };
}

export function loadTupleTopUpMessageBudget(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'TopUpMessageBudget' as const, amount: _amount };
}

export function loadGetterTupleTopUpMessageBudget(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'TopUpMessageBudget' as const, amount: _amount };
}

export function storeTupleTopUpMessageBudget(source: TopUpMessageBudget) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserTopUpMessageBudget(): DictionaryValue<TopUpMessageBudget> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTopUpMessageBudget(src)).endCell());
        },
        parse: (src) => {
            return loadTopUpMessageBudget(src.loadRef().beginParse());
        }
    }
}

export type SetSession = {
    $$type: 'SetSession';
    session_pubkey: bigint;
    expires_at: bigint;
}

export function storeSetSession(src: SetSession) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4282367168, 32);
        b_0.storeUint(src.session_pubkey, 256);
        b_0.storeUint(src.expires_at, 32);
    };
}

export function loadSetSession(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4282367168) { throw Error('Invalid prefix'); }
    const _session_pubkey = sc_0.loadUintBig(256);
    const _expires_at = sc_0.loadUintBig(32);
    return { $$type: 'SetSession' as const, session_pubkey: _session_pubkey, expires_at: _expires_at };
}

export function loadTupleSetSession(source: TupleReader) {
    const _session_pubkey = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    return { $$type: 'SetSession' as const, session_pubkey: _session_pubkey, expires_at: _expires_at };
}

export function loadGetterTupleSetSession(source: TupleReader) {
    const _session_pubkey = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    return { $$type: 'SetSession' as const, session_pubkey: _session_pubkey, expires_at: _expires_at };
}

export function storeTupleSetSession(source: SetSession) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.session_pubkey);
    builder.writeNumber(source.expires_at);
    return builder.build();
}

export function dictValueParserSetSession(): DictionaryValue<SetSession> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSetSession(src)).endCell());
        },
        parse: (src) => {
            return loadSetSession(src.loadRef().beginParse());
        }
    }
}

export type RevokeSession = {
    $$type: 'RevokeSession';
}

export function storeRevokeSession(src: RevokeSession) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3676097982, 32);
    };
}

export function loadRevokeSession(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3676097982) { throw Error('Invalid prefix'); }
    return { $$type: 'RevokeSession' as const };
}

export function loadTupleRevokeSession(source: TupleReader) {
    return { $$type: 'RevokeSession' as const };
}

export function loadGetterTupleRevokeSession(source: TupleReader) {
    return { $$type: 'RevokeSession' as const };
}

export function storeTupleRevokeSession(source: RevokeSession) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserRevokeSession(): DictionaryValue<RevokeSession> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRevokeSession(src)).endCell());
        },
        parse: (src) => {
            return loadRevokeSession(src.loadRef().beginParse());
        }
    }
}

export type RegisterMessagingKeys = {
    $$type: 'RegisterMessagingKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    crypto_suite_mask: bigint;
}

export function storeRegisterMessagingKeys(src: RegisterMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1383096026, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        b_0.storeUint(src.pq_kem_pubkey_hash, 256);
        b_0.storeUint(src.pq_kem_pubkey_len, 16);
        b_0.storeUint(src.crypto_suite_mask, 16);
    };
}

export function loadRegisterMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1383096026) { throw Error('Invalid prefix'); }
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_0.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_0.loadUintBig(16);
    const _crypto_suite_mask = sc_0.loadUintBig(16);
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleRegisterMessagingKeys(source: RegisterMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeNumber(source.crypto_suite_mask);
    return builder.build();
}

export function dictValueParserRegisterMessagingKeys(): DictionaryValue<RegisterMessagingKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRegisterMessagingKeys(src)).endCell());
        },
        parse: (src) => {
            return loadRegisterMessagingKeys(src.loadRef().beginParse());
        }
    }
}

export type ReplaceMessagingKeys = {
    $$type: 'ReplaceMessagingKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    crypto_suite_mask: bigint;
}

export function storeReplaceMessagingKeys(src: ReplaceMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2312521915, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        b_0.storeUint(src.pq_kem_pubkey_hash, 256);
        b_0.storeUint(src.pq_kem_pubkey_len, 16);
        b_0.storeUint(src.crypto_suite_mask, 16);
    };
}

export function loadReplaceMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2312521915) { throw Error('Invalid prefix'); }
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_0.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_0.loadUintBig(16);
    const _crypto_suite_mask = sc_0.loadUintBig(16);
    return { $$type: 'ReplaceMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleReplaceMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'ReplaceMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleReplaceMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'ReplaceMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleReplaceMessagingKeys(source: ReplaceMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeNumber(source.crypto_suite_mask);
    return builder.build();
}

export function dictValueParserReplaceMessagingKeys(): DictionaryValue<ReplaceMessagingKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeReplaceMessagingKeys(src)).endCell());
        },
        parse: (src) => {
            return loadReplaceMessagingKeys(src.loadRef().beginParse());
        }
    }
}

export type CreateReceiveIntent = {
    $$type: 'CreateReceiveIntent';
    asset: bigint;
    amount: bigint;
    recipient_wallet: Address;
    commitment: bigint;
    expires_at: bigint;
    client_nonce: bigint;
}

export function storeCreateReceiveIntent(src: CreateReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4152424723, 32);
        b_0.storeUint(src.asset, 8);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient_wallet);
        b_0.storeUint(src.commitment, 256);
        b_0.storeUint(src.expires_at, 32);
        b_0.storeUint(src.client_nonce, 64);
    };
}

export function loadCreateReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4152424723) { throw Error('Invalid prefix'); }
    const _asset = sc_0.loadUintBig(8);
    const _amount = sc_0.loadUintBig(128);
    const _recipient_wallet = sc_0.loadAddress();
    const _commitment = sc_0.loadUintBig(256);
    const _expires_at = sc_0.loadUintBig(32);
    const _client_nonce = sc_0.loadUintBig(64);
    return { $$type: 'CreateReceiveIntent' as const, asset: _asset, amount: _amount, recipient_wallet: _recipient_wallet, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce };
}

export function loadTupleCreateReceiveIntent(source: TupleReader) {
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient_wallet = source.readAddress();
    const _commitment = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    return { $$type: 'CreateReceiveIntent' as const, asset: _asset, amount: _amount, recipient_wallet: _recipient_wallet, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce };
}

export function loadGetterTupleCreateReceiveIntent(source: TupleReader) {
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient_wallet = source.readAddress();
    const _commitment = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    return { $$type: 'CreateReceiveIntent' as const, asset: _asset, amount: _amount, recipient_wallet: _recipient_wallet, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce };
}

export function storeTupleCreateReceiveIntent(source: CreateReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.commitment);
    builder.writeNumber(source.expires_at);
    builder.writeNumber(source.client_nonce);
    return builder.build();
}

export function dictValueParserCreateReceiveIntent(): DictionaryValue<CreateReceiveIntent> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreateReceiveIntent(src)).endCell());
        },
        parse: (src) => {
            return loadCreateReceiveIntent(src.loadRef().beginParse());
        }
    }
}

export type ClaimReceiveIntent = {
    $$type: 'ClaimReceiveIntent';
    intent_id: bigint;
    secret32: bigint;
}

export function storeClaimReceiveIntent(src: ClaimReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2582433020, 32);
        b_0.storeUint(src.intent_id, 256);
        b_0.storeUint(src.secret32, 256);
    };
}

export function loadClaimReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2582433020) { throw Error('Invalid prefix'); }
    const _intent_id = sc_0.loadUintBig(256);
    const _secret32 = sc_0.loadUintBig(256);
    return { $$type: 'ClaimReceiveIntent' as const, intent_id: _intent_id, secret32: _secret32 };
}

export function loadTupleClaimReceiveIntent(source: TupleReader) {
    const _intent_id = source.readBigNumber();
    const _secret32 = source.readBigNumber();
    return { $$type: 'ClaimReceiveIntent' as const, intent_id: _intent_id, secret32: _secret32 };
}

export function loadGetterTupleClaimReceiveIntent(source: TupleReader) {
    const _intent_id = source.readBigNumber();
    const _secret32 = source.readBigNumber();
    return { $$type: 'ClaimReceiveIntent' as const, intent_id: _intent_id, secret32: _secret32 };
}

export function storeTupleClaimReceiveIntent(source: ClaimReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.intent_id);
    builder.writeNumber(source.secret32);
    return builder.build();
}

export function dictValueParserClaimReceiveIntent(): DictionaryValue<ClaimReceiveIntent> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeClaimReceiveIntent(src)).endCell());
        },
        parse: (src) => {
            return loadClaimReceiveIntent(src.loadRef().beginParse());
        }
    }
}

export type CancelReceiveIntent = {
    $$type: 'CancelReceiveIntent';
    intent_id: bigint;
}

export function storeCancelReceiveIntent(src: CancelReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(841519988, 32);
        b_0.storeUint(src.intent_id, 256);
    };
}

export function loadCancelReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 841519988) { throw Error('Invalid prefix'); }
    const _intent_id = sc_0.loadUintBig(256);
    return { $$type: 'CancelReceiveIntent' as const, intent_id: _intent_id };
}

export function loadTupleCancelReceiveIntent(source: TupleReader) {
    const _intent_id = source.readBigNumber();
    return { $$type: 'CancelReceiveIntent' as const, intent_id: _intent_id };
}

export function loadGetterTupleCancelReceiveIntent(source: TupleReader) {
    const _intent_id = source.readBigNumber();
    return { $$type: 'CancelReceiveIntent' as const, intent_id: _intent_id };
}

export function storeTupleCancelReceiveIntent(source: CancelReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.intent_id);
    return builder.build();
}

export function dictValueParserCancelReceiveIntent(): DictionaryValue<CancelReceiveIntent> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCancelReceiveIntent(src)).endCell());
        },
        parse: (src) => {
            return loadCancelReceiveIntent(src.loadRef().beginParse());
        }
    }
}

export type PublishPrivateFromVault = {
    $$type: 'PublishPrivateFromVault';
    bounce_id: bigint;
    publish_id: bigint;
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    protocol_fee_paid: bigint;
}

export function storePublishPrivateFromVault(src: PublishPrivateFromVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2767741632, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        b_0.storeUint(src.header_1_hash, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.body_hash, 256);
        b_1.storeUint(src.protocol_fee_paid, 128);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublishPrivateFromVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2767741632) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const _header_1_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _body_hash = sc_1.loadUintBig(256);
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPrivateFromVault(source: PublishPrivateFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.protocol_fee_paid);
    return builder.build();
}

export function dictValueParserPublishPrivateFromVault(): DictionaryValue<PublishPrivateFromVault> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPrivateFromVault(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPrivateFromVault(src.loadRef().beginParse());
        }
    }
}

export type PublishPublicFromVault = {
    $$type: 'PublishPublicFromVault';
    bounce_id: bigint;
    publish_id: bigint;
    author_wallet: Address;
    body_hash: bigint;
    protocol_fee_paid: bigint;
}

export function storePublishPublicFromVault(src: PublishPublicFromVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2351593143, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeAddress(src.author_wallet);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.protocol_fee_paid, 128);
    };
}

export function loadPublishPublicFromVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2351593143) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _publish_id = sc_0.loadUintBig(256);
    const _author_wallet = sc_0.loadAddress();
    const _body_hash = sc_0.loadUintBig(256);
    const _protocol_fee_paid = sc_0.loadUintBig(128);
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicFromVault(source: PublishPublicFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.protocol_fee_paid);
    return builder.build();
}

export function dictValueParserPublishPublicFromVault(): DictionaryValue<PublishPublicFromVault> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPublicFromVault(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPublicFromVault(src.loadRef().beginParse());
        }
    }
}

export type CapsuleHubPublishAck = {
    $$type: 'CapsuleHubPublishAck';
    publish_id: bigint;
    entry_id: bigint;
    entry_uid: bigint;
}

export function storeCapsuleHubPublishAck(src: CapsuleHubPublishAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2270058346, 32);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.entry_id, 64);
        b_0.storeUint(src.entry_uid, 256);
    };
}

export function loadCapsuleHubPublishAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2270058346) { throw Error('Invalid prefix'); }
    const _publish_id = sc_0.loadUintBig(256);
    const _entry_id = sc_0.loadUintBig(64);
    const _entry_uid = sc_0.loadUintBig(256);
    return { $$type: 'CapsuleHubPublishAck' as const, publish_id: _publish_id, entry_id: _entry_id, entry_uid: _entry_uid };
}

export function loadTupleCapsuleHubPublishAck(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    return { $$type: 'CapsuleHubPublishAck' as const, publish_id: _publish_id, entry_id: _entry_id, entry_uid: _entry_uid };
}

export function loadGetterTupleCapsuleHubPublishAck(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    return { $$type: 'CapsuleHubPublishAck' as const, publish_id: _publish_id, entry_id: _entry_id, entry_uid: _entry_uid };
}

export function storeTupleCapsuleHubPublishAck(source: CapsuleHubPublishAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    return builder.build();
}

export function dictValueParserCapsuleHubPublishAck(): DictionaryValue<CapsuleHubPublishAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsuleHubPublishAck(src)).endCell());
        },
        parse: (src) => {
            return loadCapsuleHubPublishAck(src.loadRef().beginParse());
        }
    }
}

export type PrunePendingPublish = {
    $$type: 'PrunePendingPublish';
    publish_id: bigint;
}

export function storePrunePendingPublish(src: PrunePendingPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1913380205, 32);
        b_0.storeUint(src.publish_id, 256);
    };
}

export function loadPrunePendingPublish(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1913380205) { throw Error('Invalid prefix'); }
    const _publish_id = sc_0.loadUintBig(256);
    return { $$type: 'PrunePendingPublish' as const, publish_id: _publish_id };
}

export function loadTuplePrunePendingPublish(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    return { $$type: 'PrunePendingPublish' as const, publish_id: _publish_id };
}

export function loadGetterTuplePrunePendingPublish(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    return { $$type: 'PrunePendingPublish' as const, publish_id: _publish_id };
}

export function storeTuplePrunePendingPublish(source: PrunePendingPublish) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    return builder.build();
}

export function dictValueParserPrunePendingPublish(): DictionaryValue<PrunePendingPublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrunePendingPublish(src)).endCell());
        },
        parse: (src) => {
            return loadPrunePendingPublish(src.loadRef().beginParse());
        }
    }
}

export type PendingAthWithdrawal = {
    $$type: 'PendingAthWithdrawal';
    owner_wallet: Address;
    recipient: Address;
    recipient_ath_wallet: Address;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthWithdrawal(src: PendingAthWithdrawal) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthWithdrawal(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _recipient = sc_0.loadAddress();
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthWithdrawal(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthWithdrawal(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthWithdrawal(source: PendingAthWithdrawal) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthWithdrawal(): DictionaryValue<PendingAthWithdrawal> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthWithdrawal(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthWithdrawal(src.loadRef().beginParse());
        }
    }
}

export type PendingPublish = {
    $$type: 'PendingPublish';
    owner_wallet: Address;
    session_id: bigint;
    budget_epoch: bigint;
    nonce: bigint;
    publish_kind: bigint;
    body_hash: bigint;
    protocol_fee_paid: bigint;
    capsulehub_call_value: bigint;
    refundable_budget_amount: bigint;
    created_at: bigint;
}

export function storePendingPublish(src: PendingPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.session_id, 256);
        b_0.storeUint(src.budget_epoch, 64);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.publish_kind, 8);
        b_0.storeUint(src.body_hash, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.protocol_fee_paid, 128);
        b_1.storeUint(src.capsulehub_call_value, 128);
        b_1.storeUint(src.refundable_budget_amount, 128);
        b_1.storeUint(src.created_at, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingPublish(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _session_id = sc_0.loadUintBig(256);
    const _budget_epoch = sc_0.loadUintBig(64);
    const _nonce = sc_0.loadUintBig(64);
    const _publish_kind = sc_0.loadUintBig(8);
    const _body_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    const _capsulehub_call_value = sc_1.loadUintBig(128);
    const _refundable_budget_amount = sc_1.loadUintBig(128);
    const _created_at = sc_1.loadUintBig(32);
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, session_id: _session_id, budget_epoch: _budget_epoch, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid, capsulehub_call_value: _capsulehub_call_value, refundable_budget_amount: _refundable_budget_amount, created_at: _created_at };
}

export function loadTuplePendingPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _session_id = source.readBigNumber();
    const _budget_epoch = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    const _capsulehub_call_value = source.readBigNumber();
    const _refundable_budget_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, session_id: _session_id, budget_epoch: _budget_epoch, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid, capsulehub_call_value: _capsulehub_call_value, refundable_budget_amount: _refundable_budget_amount, created_at: _created_at };
}

export function loadGetterTuplePendingPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _session_id = source.readBigNumber();
    const _budget_epoch = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    const _capsulehub_call_value = source.readBigNumber();
    const _refundable_budget_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, session_id: _session_id, budget_epoch: _budget_epoch, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid, capsulehub_call_value: _capsulehub_call_value, refundable_budget_amount: _refundable_budget_amount, created_at: _created_at };
}

export function storeTuplePendingPublish(source: PendingPublish) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.session_id);
    builder.writeNumber(source.budget_epoch);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.publish_kind);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.protocol_fee_paid);
    builder.writeNumber(source.capsulehub_call_value);
    builder.writeNumber(source.refundable_budget_amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingPublish(): DictionaryValue<PendingPublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingPublish(src)).endCell());
        },
        parse: (src) => {
            return loadPendingPublish(src.loadRef().beginParse());
        }
    }
}

export type ReceiveIntent = {
    $$type: 'ReceiveIntent';
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: bigint;
    amount: bigint;
    commitment: bigint;
    expires_at: bigint;
    client_nonce: bigint;
    created_at: bigint;
    claimed: boolean;
}

export function storeReceiveIntent(src: ReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.sender_wallet);
        b_0.storeAddress(src.recipient_wallet);
        b_0.storeUint(src.asset, 8);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.commitment, 256);
        b_0.storeUint(src.expires_at, 32);
        b_0.storeUint(src.client_nonce, 64);
        const b_1 = new Builder();
        b_1.storeUint(src.created_at, 32);
        b_1.storeBit(src.claimed);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    const _sender_wallet = sc_0.loadAddress();
    const _recipient_wallet = sc_0.loadAddress();
    const _asset = sc_0.loadUintBig(8);
    const _amount = sc_0.loadUintBig(128);
    const _commitment = sc_0.loadUintBig(256);
    const _expires_at = sc_0.loadUintBig(32);
    const _client_nonce = sc_0.loadUintBig(64);
    const sc_1 = sc_0.loadRef().beginParse();
    const _created_at = sc_1.loadUintBig(32);
    const _claimed = sc_1.loadBit();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadTupleReceiveIntent(source: TupleReader) {
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadGetterTupleReceiveIntent(source: TupleReader) {
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function storeTupleReceiveIntent(source: ReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sender_wallet);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.commitment);
    builder.writeNumber(source.expires_at);
    builder.writeNumber(source.client_nonce);
    builder.writeNumber(source.created_at);
    builder.writeBoolean(source.claimed);
    return builder.build();
}

export function dictValueParserReceiveIntent(): DictionaryValue<ReceiveIntent> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeReceiveIntent(src)).endCell());
        },
        parse: (src) => {
            return loadReceiveIntent(src.loadRef().beginParse());
        }
    }
}

export type KeyRecord = {
    $$type: 'KeyRecord';
    owner_wallet: Address;
    key_generation: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    revoked_at: bigint;
    revoked_lt: bigint;
}

export function storeKeyRecord(src: KeyRecord) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.key_generation, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.pq_kem_pubkey_hash, 256);
        b_1.storeUint(src.pq_kem_pubkey_len, 16);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_1.storeUint(src.created_at, 32);
        b_1.storeUint(src.created_lt, 64);
        b_1.storeUint(src.revoked_at, 32);
        b_1.storeUint(src.revoked_lt, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyRecord(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _key_generation = sc_0.loadUintBig(32);
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    const _created_at = sc_1.loadUintBig(32);
    const _created_lt = sc_1.loadUintBig(64);
    const _revoked_at = sc_1.loadUintBig(32);
    const _revoked_lt = sc_1.loadUintBig(64);
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadTupleKeyRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadGetterTupleKeyRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function storeTupleKeyRecord(source: KeyRecord) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.revoked_at);
    builder.writeNumber(source.revoked_lt);
    return builder.build();
}

export function dictValueParserKeyRecord(): DictionaryValue<KeyRecord> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRecord(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRecord(src.loadRef().beginParse());
        }
    }
}

export type UserState = {
    $$type: 'UserState';
    ton_balance: bigint;
    ath_balance: bigint;
    message_budget_ton: bigint;
    budget_epoch: bigint;
    current_key_id: bigint;
}

export function storeUserState(src: UserState) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.ton_balance, 128);
        b_0.storeUint(src.ath_balance, 128);
        b_0.storeUint(src.message_budget_ton, 128);
        b_0.storeUint(src.budget_epoch, 64);
        b_0.storeUint(src.current_key_id, 256);
    };
}

export function loadUserState(slice: Slice) {
    const sc_0 = slice;
    const _ton_balance = sc_0.loadUintBig(128);
    const _ath_balance = sc_0.loadUintBig(128);
    const _message_budget_ton = sc_0.loadUintBig(128);
    const _budget_epoch = sc_0.loadUintBig(64);
    const _current_key_id = sc_0.loadUintBig(256);
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, message_budget_ton: _message_budget_ton, budget_epoch: _budget_epoch, current_key_id: _current_key_id };
}

export function loadTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _message_budget_ton = source.readBigNumber();
    const _budget_epoch = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, message_budget_ton: _message_budget_ton, budget_epoch: _budget_epoch, current_key_id: _current_key_id };
}

export function loadGetterTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _message_budget_ton = source.readBigNumber();
    const _budget_epoch = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, message_budget_ton: _message_budget_ton, budget_epoch: _budget_epoch, current_key_id: _current_key_id };
}

export function storeTupleUserState(source: UserState) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.message_budget_ton);
    builder.writeNumber(source.budget_epoch);
    builder.writeNumber(source.current_key_id);
    return builder.build();
}

export function dictValueParserUserState(): DictionaryValue<UserState> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUserState(src)).endCell());
        },
        parse: (src) => {
            return loadUserState(src.loadRef().beginParse());
        }
    }
}

export type SessionState = {
    $$type: 'SessionState';
    session_pubkey: bigint;
    session_id: bigint;
    nonce: bigint;
    expires_at: bigint;
    message_budget_ton: bigint;
    active: boolean;
}

export function storeSessionState(src: SessionState) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.session_pubkey, 256);
        b_0.storeUint(src.session_id, 256);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.expires_at, 32);
        b_0.storeUint(src.message_budget_ton, 128);
        b_0.storeBit(src.active);
    };
}

export function loadSessionState(slice: Slice) {
    const sc_0 = slice;
    const _session_pubkey = sc_0.loadUintBig(256);
    const _session_id = sc_0.loadUintBig(256);
    const _nonce = sc_0.loadUintBig(64);
    const _expires_at = sc_0.loadUintBig(32);
    const _message_budget_ton = sc_0.loadUintBig(128);
    const _active = sc_0.loadBit();
    return { $$type: 'SessionState' as const, session_pubkey: _session_pubkey, session_id: _session_id, nonce: _nonce, expires_at: _expires_at, message_budget_ton: _message_budget_ton, active: _active };
}

export function loadTupleSessionState(source: TupleReader) {
    const _session_pubkey = source.readBigNumber();
    const _session_id = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _message_budget_ton = source.readBigNumber();
    const _active = source.readBoolean();
    return { $$type: 'SessionState' as const, session_pubkey: _session_pubkey, session_id: _session_id, nonce: _nonce, expires_at: _expires_at, message_budget_ton: _message_budget_ton, active: _active };
}

export function loadGetterTupleSessionState(source: TupleReader) {
    const _session_pubkey = source.readBigNumber();
    const _session_id = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _message_budget_ton = source.readBigNumber();
    const _active = source.readBoolean();
    return { $$type: 'SessionState' as const, session_pubkey: _session_pubkey, session_id: _session_id, nonce: _nonce, expires_at: _expires_at, message_budget_ton: _message_budget_ton, active: _active };
}

export function storeTupleSessionState(source: SessionState) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.session_pubkey);
    builder.writeNumber(source.session_id);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.expires_at);
    builder.writeNumber(source.message_budget_ton);
    builder.writeBoolean(source.active);
    return builder.build();
}

export function dictValueParserSessionState(): DictionaryValue<SessionState> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSessionState(src)).endCell());
        },
        parse: (src) => {
            return loadSessionState(src.loadRef().beginParse());
        }
    }
}

export type VaultReceiveIntentView = {
    $$type: 'VaultReceiveIntentView';
    exists: boolean;
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: bigint;
    amount: bigint;
    commitment: bigint;
    expires_at: bigint;
    client_nonce: bigint;
    created_at: bigint;
    claimed: boolean;
}

export function storeVaultReceiveIntentView(src: VaultReceiveIntentView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.sender_wallet);
        b_0.storeAddress(src.recipient_wallet);
        b_0.storeInt(src.asset, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.amount, 257);
        b_1.storeInt(src.commitment, 257);
        b_1.storeInt(src.expires_at, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.client_nonce, 257);
        b_2.storeInt(src.created_at, 257);
        b_2.storeBit(src.claimed);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultReceiveIntentView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _sender_wallet = sc_0.loadAddress();
    const _recipient_wallet = sc_0.loadAddress();
    const _asset = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _amount = sc_1.loadIntBig(257);
    const _commitment = sc_1.loadIntBig(257);
    const _expires_at = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _client_nonce = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const _claimed = sc_2.loadBit();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadTupleVaultReceiveIntentView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadGetterTupleVaultReceiveIntentView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, expires_at: _expires_at, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function storeTupleVaultReceiveIntentView(source: VaultReceiveIntentView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.sender_wallet);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.commitment);
    builder.writeNumber(source.expires_at);
    builder.writeNumber(source.client_nonce);
    builder.writeNumber(source.created_at);
    builder.writeBoolean(source.claimed);
    return builder.build();
}

export function dictValueParserVaultReceiveIntentView(): DictionaryValue<VaultReceiveIntentView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultReceiveIntentView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultReceiveIntentView(src.loadRef().beginParse());
        }
    }
}

export type VaultKeyRecordView = {
    $$type: 'VaultKeyRecordView';
    exists: boolean;
    owner_wallet: Address;
    key_generation: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    revoked_at: bigint;
    revoked_lt: bigint;
}

export function storeVaultKeyRecordView(src: VaultKeyRecordView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.key_generation, 257);
        b_0.storeInt(src.enc_pubkey, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.sign_pubkey, 257);
        b_1.storeInt(src.pq_kem_pubkey_hash, 257);
        b_1.storeInt(src.pq_kem_pubkey_len, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.crypto_suite_mask, 257);
        b_2.storeInt(src.created_at, 257);
        b_2.storeInt(src.created_lt, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.revoked_at, 257);
        b_3.storeInt(src.revoked_lt, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultKeyRecordView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _key_generation = sc_0.loadIntBig(257);
    const _enc_pubkey = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _sign_pubkey = sc_1.loadIntBig(257);
    const _pq_kem_pubkey_hash = sc_1.loadIntBig(257);
    const _pq_kem_pubkey_len = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _crypto_suite_mask = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const _created_lt = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _revoked_at = sc_3.loadIntBig(257);
    const _revoked_lt = sc_3.loadIntBig(257);
    return { $$type: 'VaultKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadTupleVaultKeyRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'VaultKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadGetterTupleVaultKeyRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'VaultKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function storeTupleVaultKeyRecordView(source: VaultKeyRecordView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.revoked_at);
    builder.writeNumber(source.revoked_lt);
    return builder.build();
}

export function dictValueParserVaultKeyRecordView(): DictionaryValue<VaultKeyRecordView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultKeyRecordView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultKeyRecordView(src.loadRef().beginParse());
        }
    }
}

export type VaultUserView = {
    $$type: 'VaultUserView';
    exists: boolean;
    ton_balance: bigint;
    ath_balance: bigint;
    message_budget_ton: bigint;
    budget_epoch: bigint;
    current_key_id: bigint;
}

export function storeVaultUserView(src: VaultUserView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.ton_balance, 257);
        b_0.storeInt(src.ath_balance, 257);
        b_0.storeInt(src.message_budget_ton, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.budget_epoch, 257);
        b_1.storeInt(src.current_key_id, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultUserView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _ton_balance = sc_0.loadIntBig(257);
    const _ath_balance = sc_0.loadIntBig(257);
    const _message_budget_ton = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _budget_epoch = sc_1.loadIntBig(257);
    const _current_key_id = sc_1.loadIntBig(257);
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, message_budget_ton: _message_budget_ton, budget_epoch: _budget_epoch, current_key_id: _current_key_id };
}

export function loadTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _message_budget_ton = source.readBigNumber();
    const _budget_epoch = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, message_budget_ton: _message_budget_ton, budget_epoch: _budget_epoch, current_key_id: _current_key_id };
}

export function loadGetterTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _message_budget_ton = source.readBigNumber();
    const _budget_epoch = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, message_budget_ton: _message_budget_ton, budget_epoch: _budget_epoch, current_key_id: _current_key_id };
}

export function storeTupleVaultUserView(source: VaultUserView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.message_budget_ton);
    builder.writeNumber(source.budget_epoch);
    builder.writeNumber(source.current_key_id);
    return builder.build();
}

export function dictValueParserVaultUserView(): DictionaryValue<VaultUserView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultUserView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultUserView(src.loadRef().beginParse());
        }
    }
}

export type VaultSessionView = {
    $$type: 'VaultSessionView';
    exists: boolean;
    session_pubkey: bigint;
    session_id: bigint;
    nonce: bigint;
    expires_at: bigint;
    active: boolean;
}

export function storeVaultSessionView(src: VaultSessionView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.session_pubkey, 257);
        b_0.storeInt(src.session_id, 257);
        b_0.storeInt(src.nonce, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.expires_at, 257);
        b_1.storeBit(src.active);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultSessionView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _session_pubkey = sc_0.loadIntBig(257);
    const _session_id = sc_0.loadIntBig(257);
    const _nonce = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _expires_at = sc_1.loadIntBig(257);
    const _active = sc_1.loadBit();
    return { $$type: 'VaultSessionView' as const, exists: _exists, session_pubkey: _session_pubkey, session_id: _session_id, nonce: _nonce, expires_at: _expires_at, active: _active };
}

export function loadTupleVaultSessionView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _session_pubkey = source.readBigNumber();
    const _session_id = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _active = source.readBoolean();
    return { $$type: 'VaultSessionView' as const, exists: _exists, session_pubkey: _session_pubkey, session_id: _session_id, nonce: _nonce, expires_at: _expires_at, active: _active };
}

export function loadGetterTupleVaultSessionView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _session_pubkey = source.readBigNumber();
    const _session_id = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _expires_at = source.readBigNumber();
    const _active = source.readBoolean();
    return { $$type: 'VaultSessionView' as const, exists: _exists, session_pubkey: _session_pubkey, session_id: _session_id, nonce: _nonce, expires_at: _expires_at, active: _active };
}

export function storeTupleVaultSessionView(source: VaultSessionView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.session_pubkey);
    builder.writeNumber(source.session_id);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.expires_at);
    builder.writeBoolean(source.active);
    return builder.build();
}

export function dictValueParserVaultSessionView(): DictionaryValue<VaultSessionView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultSessionView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultSessionView(src.loadRef().beginParse());
        }
    }
}

export type VaultPendingAthWithdrawalView = {
    $$type: 'VaultPendingAthWithdrawalView';
    exists: boolean;
    owner_wallet: Address;
    recipient: Address;
    recipient_ath_wallet: Address;
    amount: bigint;
    created_at: bigint;
}

export function storeVaultPendingAthWithdrawalView(src: VaultPendingAthWithdrawalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.recipient_ath_wallet);
        const b_1 = new Builder();
        b_1.storeInt(src.amount, 257);
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultPendingAthWithdrawalView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _recipient = sc_0.loadAddress();
    const _recipient_ath_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _amount = sc_1.loadIntBig(257);
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'VaultPendingAthWithdrawalView' as const, exists: _exists, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, created_at: _created_at };
}

export function loadTupleVaultPendingAthWithdrawalView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'VaultPendingAthWithdrawalView' as const, exists: _exists, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, created_at: _created_at };
}

export function loadGetterTupleVaultPendingAthWithdrawalView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'VaultPendingAthWithdrawalView' as const, exists: _exists, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, created_at: _created_at };
}

export function storeTupleVaultPendingAthWithdrawalView(source: VaultPendingAthWithdrawalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserVaultPendingAthWithdrawalView(): DictionaryValue<VaultPendingAthWithdrawalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultPendingAthWithdrawalView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultPendingAthWithdrawalView(src.loadRef().beginParse());
        }
    }
}

export type VaultGlobalView = {
    $$type: 'VaultGlobalView';
    sealed: boolean;
    capsule_hub_bound: boolean;
    deployment_manifest_hash: bigint;
    capsule_hub_address: Address;
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    user_count: bigint;
    session_count: bigint;
    key_record_count: bigint;
    receive_intent_count: bigint;
    pending_ath_withdrawal_count: bigint;
    pending_publish_count: bigint;
    processed_ath_deposit_count: bigint;
    pending_publish_stale_ttl: bigint;
    airdrop_remaining_ath: bigint;
    airdrop_distributed_ath: bigint;
    airdrop_reward_per_message_ath: bigint;
    airdrop_total_allocation_ath: bigint;
}

export function storeVaultGlobalView(src: VaultGlobalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeBit(src.capsule_hub_bound);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeAddress(src.capsule_hub_address);
        b_0.storeAddress(src.vault_ath_wallet_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.ath_master_address);
        b_1.storeInt(src.user_count, 257);
        b_1.storeInt(src.session_count, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.key_record_count, 257);
        b_2.storeInt(src.receive_intent_count, 257);
        b_2.storeInt(src.pending_ath_withdrawal_count, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.pending_publish_count, 257);
        b_3.storeInt(src.processed_ath_deposit_count, 257);
        b_3.storeInt(src.pending_publish_stale_ttl, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.airdrop_remaining_ath, 257);
        b_4.storeInt(src.airdrop_distributed_ath, 257);
        b_4.storeInt(src.airdrop_reward_per_message_ath, 257);
        const b_5 = new Builder();
        b_5.storeInt(src.airdrop_total_allocation_ath, 257);
        b_4.storeRef(b_5.endCell());
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultGlobalView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _capsule_hub_bound = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _capsule_hub_address = sc_0.loadAddress();
    const _vault_ath_wallet_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _ath_master_address = sc_1.loadAddress();
    const _user_count = sc_1.loadIntBig(257);
    const _session_count = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _key_record_count = sc_2.loadIntBig(257);
    const _receive_intent_count = sc_2.loadIntBig(257);
    const _pending_ath_withdrawal_count = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_publish_count = sc_3.loadIntBig(257);
    const _processed_ath_deposit_count = sc_3.loadIntBig(257);
    const _pending_publish_stale_ttl = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _airdrop_remaining_ath = sc_4.loadIntBig(257);
    const _airdrop_distributed_ath = sc_4.loadIntBig(257);
    const _airdrop_reward_per_message_ath = sc_4.loadIntBig(257);
    const sc_5 = sc_4.loadRef().beginParse();
    const _airdrop_total_allocation_ath = sc_5.loadIntBig(257);
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, session_count: _session_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function loadTupleVaultGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _capsule_hub_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _user_count = source.readBigNumber();
    const _session_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_publish_stale_ttl = source.readBigNumber();
    source = source.readTuple();
    const _airdrop_remaining_ath = source.readBigNumber();
    const _airdrop_distributed_ath = source.readBigNumber();
    const _airdrop_reward_per_message_ath = source.readBigNumber();
    const _airdrop_total_allocation_ath = source.readBigNumber();
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, session_count: _session_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function loadGetterTupleVaultGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _capsule_hub_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _user_count = source.readBigNumber();
    const _session_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_publish_stale_ttl = source.readBigNumber();
    const _airdrop_remaining_ath = source.readBigNumber();
    const _airdrop_distributed_ath = source.readBigNumber();
    const _airdrop_reward_per_message_ath = source.readBigNumber();
    const _airdrop_total_allocation_ath = source.readBigNumber();
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, session_count: _session_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function storeTupleVaultGlobalView(source: VaultGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.capsule_hub_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.capsule_hub_address);
    builder.writeAddress(source.vault_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeNumber(source.user_count);
    builder.writeNumber(source.session_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.receive_intent_count);
    builder.writeNumber(source.pending_ath_withdrawal_count);
    builder.writeNumber(source.pending_publish_count);
    builder.writeNumber(source.processed_ath_deposit_count);
    builder.writeNumber(source.pending_publish_stale_ttl);
    builder.writeNumber(source.airdrop_remaining_ath);
    builder.writeNumber(source.airdrop_distributed_ath);
    builder.writeNumber(source.airdrop_reward_per_message_ath);
    builder.writeNumber(source.airdrop_total_allocation_ath);
    return builder.build();
}

export function dictValueParserVaultGlobalView(): DictionaryValue<VaultGlobalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultGlobalView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultGlobalView(src.loadRef().beginParse());
        }
    }
}

export type Vault$Data = {
    $$type: 'Vault$Data';
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    capsule_hub_address: Address;
    capsule_hub_bound: boolean;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    users: Dictionary<Address, UserState>;
    sessions: Dictionary<Address, SessionState>;
    key_records: Dictionary<bigint, KeyRecord>;
    receive_intents: Dictionary<bigint, ReceiveIntent>;
    processed_ath_deposits: Dictionary<bigint, bigint>;
    pending_ath_withdrawals: Dictionary<bigint, PendingAthWithdrawal>;
    pending_publishes: Dictionary<bigint, PendingPublish>;
    user_count: bigint;
    session_count: bigint;
    key_record_count: bigint;
    receive_intent_count: bigint;
    processed_ath_deposit_count: bigint;
    pending_ath_withdrawal_count: bigint;
    pending_publish_count: bigint;
}

export function storeVault$Data(src: Vault$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.vault_ath_wallet_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.capsule_hub_address);
        b_0.storeBit(src.capsule_hub_bound);
        b_0.storeBit(src.sealed);
        const b_1 = new Builder();
        b_1.storeUint(src.deployment_manifest_hash, 256);
        b_1.storeUint(src.genesis_config_hash, 256);
        b_1.storeDict(src.users, Dictionary.Keys.Address(), dictValueParserUserState());
        b_1.storeDict(src.sessions, Dictionary.Keys.Address(), dictValueParserSessionState());
        b_1.storeDict(src.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord());
        const b_2 = new Builder();
        b_2.storeDict(src.receive_intents, Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent());
        b_2.storeDict(src.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_2.storeDict(src.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal());
        b_2.storeDict(src.pending_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingPublish());
        b_2.storeUint(src.user_count, 64);
        b_2.storeUint(src.session_count, 64);
        b_2.storeUint(src.key_record_count, 64);
        b_2.storeUint(src.receive_intent_count, 64);
        b_2.storeUint(src.processed_ath_deposit_count, 64);
        b_2.storeUint(src.pending_ath_withdrawal_count, 64);
        b_2.storeUint(src.pending_publish_count, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVault$Data(slice: Slice) {
    const sc_0 = slice;
    const _vault_ath_wallet_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _capsule_hub_address = sc_0.loadAddress();
    const _capsule_hub_bound = sc_0.loadBit();
    const _sealed = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _deployment_manifest_hash = sc_1.loadUintBig(256);
    const _genesis_config_hash = sc_1.loadUintBig(256);
    const _users = Dictionary.load(Dictionary.Keys.Address(), dictValueParserUserState(), sc_1);
    const _sessions = Dictionary.load(Dictionary.Keys.Address(), dictValueParserSessionState(), sc_1);
    const _key_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), sc_1);
    const sc_2 = sc_1.loadRef().beginParse();
    const _receive_intents = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), sc_2);
    const _processed_ath_deposits = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_2);
    const _pending_ath_withdrawals = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), sc_2);
    const _pending_publishes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), sc_2);
    const _user_count = sc_2.loadUintBig(64);
    const _session_count = sc_2.loadUintBig(64);
    const _key_record_count = sc_2.loadUintBig(64);
    const _receive_intent_count = sc_2.loadUintBig(64);
    const _processed_ath_deposit_count = sc_2.loadUintBig(64);
    const _pending_ath_withdrawal_count = sc_2.loadUintBig(64);
    const _pending_publish_count = sc_2.loadUintBig(64);
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, capsule_hub_bound: _capsule_hub_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, sessions: _sessions, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, user_count: _user_count, session_count: _session_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
}

export function loadTupleVault$Data(source: TupleReader) {
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _capsule_hub_address = source.readAddress();
    const _capsule_hub_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _users = Dictionary.loadDirect(Dictionary.Keys.Address(), dictValueParserUserState(), source.readCellOpt());
    const _sessions = Dictionary.loadDirect(Dictionary.Keys.Address(), dictValueParserSessionState(), source.readCellOpt());
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), source.readCellOpt());
    source = source.readTuple();
    const _user_count = source.readBigNumber();
    const _session_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, capsule_hub_bound: _capsule_hub_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, sessions: _sessions, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, user_count: _user_count, session_count: _session_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
}

export function loadGetterTupleVault$Data(source: TupleReader) {
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _capsule_hub_address = source.readAddress();
    const _capsule_hub_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _users = Dictionary.loadDirect(Dictionary.Keys.Address(), dictValueParserUserState(), source.readCellOpt());
    const _sessions = Dictionary.loadDirect(Dictionary.Keys.Address(), dictValueParserSessionState(), source.readCellOpt());
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _session_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, capsule_hub_bound: _capsule_hub_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, sessions: _sessions, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, user_count: _user_count, session_count: _session_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
}

export function storeTupleVault$Data(source: Vault$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.vault_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.capsule_hub_address);
    builder.writeBoolean(source.capsule_hub_bound);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeCell(source.users.size > 0 ? beginCell().storeDictDirect(source.users, Dictionary.Keys.Address(), dictValueParserUserState()).endCell() : null);
    builder.writeCell(source.sessions.size > 0 ? beginCell().storeDictDirect(source.sessions, Dictionary.Keys.Address(), dictValueParserSessionState()).endCell() : null);
    builder.writeCell(source.key_records.size > 0 ? beginCell().storeDictDirect(source.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord()).endCell() : null);
    builder.writeCell(source.receive_intents.size > 0 ? beginCell().storeDictDirect(source.receive_intents, Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent()).endCell() : null);
    builder.writeCell(source.processed_ath_deposits.size > 0 ? beginCell().storeDictDirect(source.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_ath_withdrawals.size > 0 ? beginCell().storeDictDirect(source.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal()).endCell() : null);
    builder.writeCell(source.pending_publishes.size > 0 ? beginCell().storeDictDirect(source.pending_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingPublish()).endCell() : null);
    builder.writeNumber(source.user_count);
    builder.writeNumber(source.session_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.receive_intent_count);
    builder.writeNumber(source.processed_ath_deposit_count);
    builder.writeNumber(source.pending_ath_withdrawal_count);
    builder.writeNumber(source.pending_publish_count);
    return builder.build();
}

export function dictValueParserVault$Data(): DictionaryValue<Vault$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVault$Data(src)).endCell());
        },
        parse: (src) => {
            return loadVault$Data(src.loadRef().beginParse());
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
    const __code = Cell.fromHex('b5ee9c7241022901000c8a000114ff00f4a413f4bcf2c80b01020162022704dad001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019ed37ffa40fa40f404f40455406c158e10810101d700fa40fa40552003d1586d6de206e3027025d74920c21f953105d31f06de21821041544801bae30221821041544805bae30221821041544810ba030c0e0f046e048020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812bae30220821041544815bae30220821041544817ba0405060700d230d33fd37f59328136b3f84224c705f2f48136b422c200f2f45141a0708040067f04c8598210415448045003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5400be30d33fd37f593281378c22c200f2f45141a0708040067f04c8598210415448135003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5400be30d33fd37f59328137f022c200f2f45141a0708040067f04c8598210415448135003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed5402ee8e5f30d33fd37f59328138b822c200f2f45141a0708040067f04c8598210415448135003cb1fcb3fcb7fc92543144700441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004034c87f01ca0055405045cb7f12cecef400f400c9ed54e0208210472d9d7dbae302821089129d5fbae3025f060809015030d33fd37fd31f55203310571046103512db3cc87f01ca0055405045cb7f12cecef400f400c9ed540a014ed33fd37fd31f55203310571046103512db3cc87f01ca0055405045cb7f12cecef400f400c9ed540a04e08137fa21c200f2f48137fb5381bef2f41047103645765357db3c228101012259f40d6fa192306ddf206e92306d9ad0fa40d37f596c126f02e28137fc216eb3f2f46f228137fd511abaf2f4103645468137fe5167db3c500bba16f2f45127a15034810101f45a3055035177db3c70539423241e0b01bedb3c707f541ab880400ec855308210415448125005cb1f13cb3fcb7fcecec910361059104a103b103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0044431f01fc5b04d33fd37ffa40308136b0f84226c705f2f48136b122c200f2f48136b25362bef2f48136b55315c705f2f48136b6f8416f24135f0382081e8480bef2f45151a17080405414367f09c855308210415448025005cb1f13cb3fcb7fcecec9240443135077441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000d002e4034c87f01ca0055405045cb7f12cecef400f400c9ed5401ec5b04d33fd37ffa4030813840f84225c705f2f481384122c200f2f481384226c000f2f4813843f8416f24135f0382082dc6c0bef2f45151a082080f42407004705147c855208210415448065004cb1f12cb3fcb7fcec910474730441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00403418043ce30221821041544814bae30221821041544816bae30221821041544812ba1013151704fc5b04d33fd37ffa40fa4030813778f84227c705f2f48137795316c705f2f481377a23c200f2f481377b5373bef2f481377cf8416f24135f0382081e8480bef2f45162a1041035407827db3c70541094db3c707f5419c780400cc855308210415448125005cb1f13cb3fcb7fcecec9106a1058104b1039103645155034c8891e1f1112000160008acf16ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb004144c87f01ca0055405045cb7f12cecef400f400c9ed5403fe5b04d33fd37ffa40fa40d430d0fa40d37f308137dcf84229c705f2f48137dd5338c705f2f48137de5324c705f2f48137df25c200f2f48137e021c200f2f48137e15395bef2f48137e2218209c9c380bef2f48137e3f8416f24135f032282080f4240a082081e8480a0bef2f45184a1041037469a27db3c70541094db3c507c1e1f1400f8707f8040284c1350fec855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc95e351047103a48b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00441302c87f01ca0055405045cb7f12cecef400f400c9ed5403f85b04d33fd37ffa40fa40d37fd3078138a4f8422ac705f2f48138a55349c705f2f48138a626c200f2f48138a723c200f2f48138a853a6bef2f48138a9238209c9c380bef2f48138aaf8416f24135f032482080f4240a082081e8480a0bef2f45195a104103847ab2bdb3c705410d4db3c4870707f80402804103e102d1e1f1600f0011110010fc855608210415448175008cb1f16cb3f14cb7f12cececb7fcb07cec9106b10581047103a4890103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb005024c87f01ca0055405045cb7f12cecef400f400c9ed5403f48f765b04d33fd37ffa40fa403081378223c200f2f4813783f84210581047103649a6db3c16c70519f2f4813784f8416f24135f0382081e8480bef2f45124a0708040077f07c8598210415448115003cb1fcb3fcb7fc91048473016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00443012e0211e1819002ac87f01ca0055405045cb7f12cecef400f400c9ed540392821041544815bae30221821041544817bae302218210472d9d7ebae30236c00005c12115b08e1c8132c8f2f04034c87f01ca0055405045cb7f12cecef400f400c9ed54e05f05f2c0821a1d2204fa5b04d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842104a103948bc25db3c1dc7051bf2f48137e85382c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082081e8480a0bef2f44014503a541909db3c55405365db3c8137eb238101012359f40c6fa131b3f2f48137ec291e24231b02fa8209c9c380bef2f4554053b7db3c8137ed81010154431359f40c6fa131b3f2f4514ca081010153cdc85902cecb7fc94170206e953059f45a30944133f415e2707f54488052ee12c855308210472d9d7d5005cb1f13cb3fcb7fcb1fcec9104910384b60441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00251c00a282080f42407004700ac8598210415448115003cb1fcb3fcb7fc91047473019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00441359c87f01ca0055405045cb7f12cecef400f400c9ed5404f85b04d33fd37ffa40fa40d37fd3078138ae26c200f2f48138aff842104b103a49cd26db3c1ec7051cf2f48138b02ac200f2f48138b1f8416f24135f032b82080f4240a082081e8480a0bef2f44014503b541a0bdb3c55405375db3c8138b2238101012359f40c6fa131b3f2f48138b32c8209c9c380bef2f4554053d81e242320016820fa4430705825db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d01f0026f82ac87001ca0055215023810101cf00cecec902fcdb3c8138b481010154431359f40c6fa131b3f2f45147a081010153e8c85902cecb7fc94170206e953059f45a30944133f415e2707f2951491049030211100250dc1034c85550821089129d5f5007cb1f15cb3f13cb7fcb1fcecb07cec9544114103a48cc441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb002521009e82080f424070047004c8598210415448115003cb1fcb3fcb7fc910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004133c87f01ca0055405045cb7f12cecef400f400c9ed5404ea5b04d33fd37fd31f30813804f84226c705f2f481380522c200f2f41045103545675357db3c228101012259f40d6fa192306ddf206e92306d9ad0fa40d37f596c126f02e2813806216eb3f2f46f22813807511abaf2f4103645468138085167db3c500bba16f2f44614034858db3c8101015122141823242526000a01aa1f01a00026c8821041544e4901cb1f01cf16c9f900a9381f0024c8821041544e4901cb1f58cf16cb3fc9f9000062216e955b59f45a3098c801cf004133f442e25054810101f45a304403c87f01ca0055405045cb7f12cecef400f400c9ed54015da0f605da89a1a400033da6fff481f481e809e808aa80d82b1c21020203ae01f481f480aa4007a2b0dadbc5b678d8a728000654743223a85220');
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
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"processed_notifications","type":{"kind":"dict","key":"int","value":"int"}}]},
    {"name":"BindDeploymentManifest","header":2430787787,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"counterpart_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindOfficialAthWallet","header":417017035,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"DepositTon","header":716160408,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"WithdrawTon","header":1212947826,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"WithdrawAth","header":4188293172,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TopUpMessageBudget","header":2258722706,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"SetSession","header":4282367168,"fields":[{"name":"session_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"expires_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"RevokeSession","header":3676097982,"fields":[]},
    {"name":"RegisterMessagingKeys","header":1383096026,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"ReplaceMessagingKeys","header":2312521915,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"CreateReceiveIntent","header":4152424723,"fields":[{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"expires_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ClaimReceiveIntent","header":2582433020,"fields":[{"name":"intent_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"secret32","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CancelReceiveIntent","header":841519988,"fields":[{"name":"intent_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PrunePendingPublish","header":1913380205,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PendingAthWithdrawal","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingPublish","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"session_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"budget_epoch","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"capsulehub_call_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_budget_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ReceiveIntent","header":null,"fields":[{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"expires_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UserState","header":null,"fields":[{"name":"ton_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"message_budget_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"budget_epoch","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"SessionState","header":null,"fields":[{"name":"session_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"session_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"expires_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"message_budget_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultReceiveIntentView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"commitment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"expires_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"client_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"ton_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"message_budget_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"budget_epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultSessionView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"session_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"session_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"expires_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultPendingAthWithdrawalView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"session_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receive_intent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_distributed_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_reward_per_message_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_total_allocation_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"Vault$Data","header":null,"fields":[{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"users","type":{"kind":"dict","key":"address","value":"UserState","valueFormat":"ref"}},{"name":"sessions","type":{"kind":"dict","key":"address","value":"SessionState","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}},{"name":"receive_intents","type":{"kind":"dict","key":"int","value":"ReceiveIntent","valueFormat":"ref"}},{"name":"processed_ath_deposits","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_ath_withdrawals","type":{"kind":"dict","key":"int","value":"PendingAthWithdrawal","valueFormat":"ref"}},{"name":"pending_publishes","type":{"kind":"dict","key":"int","value":"PendingPublish","valueFormat":"ref"}},{"name":"user_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"session_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receive_intent_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_publish_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
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
    "AthTransferNotificationMintUsername": 2299698527,
    "ATHTransferRequest": 1096042512,
    "ATHTransferRequestWithNotify": 1096042516,
    "ATHTransferRequestMintUsername": 1096042518,
    "ATHInternalTransfer": 1096042514,
    "ATHInternalTransferWithNotify": 1096042517,
    "ATHInternalTransferMintUsername": 1096042519,
    "ATHTransferAck": 1096042513,
    "ATHTransferFailed": 1096042515,
    "BindDeploymentManifest": 2430787787,
    "BindOfficialAthWallet": 417017035,
    "SealGenesis": 974311853,
    "DepositTon": 716160408,
    "WithdrawTon": 1212947826,
    "WithdrawAth": 4188293172,
    "TopUpMessageBudget": 2258722706,
    "SetSession": 4282367168,
    "RevokeSession": 3676097982,
    "RegisterMessagingKeys": 1383096026,
    "ReplaceMessagingKeys": 2312521915,
    "CreateReceiveIntent": 4152424723,
    "ClaimReceiveIntent": 2582433020,
    "CancelReceiveIntent": 841519988,
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "PrunePendingPublish": 1913380205,
}

const ATHWallet_getters: ABIGetter[] = [
    {"name":"get_wallet_data","methodId":97026,"arguments":[],"returnType":{"kind":"simple","type":"ATHWalletDataView","optional":false}},
]

export const ATHWallet_getterMapping: { [key: string]: string } = {
    'get_wallet_data': 'getGetWalletData',
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
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30000000n;
export const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2000000n;
export const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 1096044105n;
export const ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD = 4294967296n;
export const VAULT_USER_STATE_STORAGE_ENDOWMENT = 10000000n;
export const VAULT_SESSION_STATE_STORAGE_ENDOWMENT = 5000000n;
export const VAULT_KEY_RECORD_STANDARD_STORAGE_ENDOWMENT = 5000000n;
export const VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT = 30000000n;
export const VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT = 5000000n;
export const VAULT_PENDING_PUBLISH_STORAGE_ENDOWMENT = 3000000n;
export const VAULT_PENDING_PUBLISH_STALE_TTL = 86400n;
export const VAULT_DEPOSIT_TON_EXEC_RESERVE = 2000000n;
export const VAULT_ATH_NOTIFICATION_ACK_VALUE = 1000000n;
export const VAULT_ATH_WITHDRAW_MIN_VALUE = 30000000n;
export const ASSET_TON = 1n;
export const ASSET_ATH = 2n;
export const RECEIVE_INTENT_ID_DOMAIN = 1380141380n;
export const RECEIVE_INTENT_COMMITMENT_DOMAIN = 1380139853n;
export const MAX_RECEIVE_INTENT_TTL = 2592000n;
export const CRYPTO_SUITE_CLASSICAL = 1n;
export const CRYPTO_SUITE_HYBRID = 2n;
export const MLKEM768_PUBKEY_LEN = 1184n;
export const MAX_SESSION_TTL = 2592000n;
export const UINT64_MAX = 18446744073709551615n;
export const UINT64_MOD = 18446744073709551616n;
export const UINT32_MAX = 4294967295n;
export const ATH_DEPOSIT_ID_DOMAIN = 1094996041n;
export const SESSION_ID_DOMAIN = 1397967172n;
export const KEY_ID_DOMAIN = 1262836041n;
export const COMPACT_MAGIC = 1347179346n;
export const COMPACT_VERSION = 1n;
export const SIGN_DOMAIN_SESSION_PUBLISH = 1448105282n;
export const OP_PUBLISH_PRIVATE_BY_SESSION_EXTERNAL = 1751553222n;
export const OP_PUBLISH_PUBLIC_BY_SESSION_EXTERNAL = 2416888070n;
export const PUBLISH_KIND_PRIVATE = 1n;
export const PUBLISH_KIND_PUBLIC = 2n;
export const SIZE_CLASS_STANDARD = 1n;
export const SIZE_CLASS_LONG_TERM = 2n;
export const CRYPTO_SUITE_PUBLIC_NONE = 0n;
export const PLATO_PRIVATE_STANDARD_FEE_TON = 5000000n;
export const PLATO_PRIVATE_LONG_TERM_FEE_TON = 10000000n;
export const PLATO_PUBLIC_POST_FEE_TON = 5000000n;
export const ATH_FULL_DISCOUNT_AMOUNT = 10000000000000n;
export const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH = 30000000000000000n;
export const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10000000000n;
export const VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE = 3000000n;
export const INVALID_SESSION_REQUEST_CHARGE_TON = 2000000n;
export const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE = 4000000n;
export const CAPSULEHUB_PUBLIC_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_PRIVATE_STANDARD_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 4000000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 3000000n;
export const CAPSULEHUB_PAGE_STORAGE_ENDOWMENT = 10000000n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const OP_BIND_DEPLOYMENT_MANIFEST = 2430787787n;
export const OP_BIND_OFFICIAL_ATH_WALLET = 417017035n;
export const OP_SEAL_GENESIS = 974311853n;

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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: ATHBurn | ATHGenesisSupplyCredit | ATHTransferRequest | ATHTransferRequestWithNotify | ATHTransferRequestMintUsername | ATHInternalTransfer | ATHInternalTransferWithNotify | ATHInternalTransferMintUsername | AthTransferNotificationAck | null) {
        
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
    
}