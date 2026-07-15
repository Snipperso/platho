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

export type AthTransferNotificationVaultMintUsername = {
    $$type: 'AthTransferNotificationVaultMintUsername';
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeAthTransferNotificationVaultMintUsername(src: AthTransferNotificationVaultMintUsername) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2299698528, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.payer_wallet);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.username_len, 8);
        b_0.storeBuilder(src.username.asBuilder());
    };
}

export function loadAthTransferNotificationVaultMintUsername(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2299698528) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _amount = sc_0.loadUintBig(128);
    const _payer_wallet = sc_0.loadAddress();
    const _owner_wallet = sc_0.loadAddress();
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0;
    return { $$type: 'AthTransferNotificationVaultMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleAthTransferNotificationVaultMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'AthTransferNotificationVaultMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleAthTransferNotificationVaultMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'AthTransferNotificationVaultMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleAthTransferNotificationVaultMintUsername(source: AthTransferNotificationVaultMintUsername) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.payer_wallet);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserAthTransferNotificationVaultMintUsername(): DictionaryValue<AthTransferNotificationVaultMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationVaultMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationVaultMintUsername(src.loadRef().beginParse());
        }
    }
}

export type AthTransferNotificationVaultProfileAvatar = {
    $$type: 'AthTransferNotificationVaultProfileAvatar';
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

export function storeAthTransferNotificationVaultProfileAvatar(src: AthTransferNotificationVaultProfileAvatar) {
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

export function loadAthTransferNotificationVaultProfileAvatar(slice: Slice) {
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
    return { $$type: 'AthTransferNotificationVaultProfileAvatar' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleAthTransferNotificationVaultProfileAvatar(source: TupleReader) {
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
    return { $$type: 'AthTransferNotificationVaultProfileAvatar' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleAthTransferNotificationVaultProfileAvatar(source: TupleReader) {
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
    return { $$type: 'AthTransferNotificationVaultProfileAvatar' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleAthTransferNotificationVaultProfileAvatar(source: AthTransferNotificationVaultProfileAvatar) {
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

export function dictValueParserAthTransferNotificationVaultProfileAvatar(): DictionaryValue<AthTransferNotificationVaultProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotificationVaultProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotificationVaultProfileAvatar(src.loadRef().beginParse());
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

export type ATHTransferRequestVaultProfileAvatar = {
    $$type: 'ATHTransferRequestVaultProfileAvatar';
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

export function storeATHTransferRequestVaultProfileAvatar(src: ATHTransferRequestVaultProfileAvatar) {
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

export function loadATHTransferRequestVaultProfileAvatar(slice: Slice) {
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
    return { $$type: 'ATHTransferRequestVaultProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleATHTransferRequestVaultProfileAvatar(source: TupleReader) {
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
    return { $$type: 'ATHTransferRequestVaultProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleATHTransferRequestVaultProfileAvatar(source: TupleReader) {
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
    return { $$type: 'ATHTransferRequestVaultProfileAvatar' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleATHTransferRequestVaultProfileAvatar(source: ATHTransferRequestVaultProfileAvatar) {
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

export function dictValueParserATHTransferRequestVaultProfileAvatar(): DictionaryValue<ATHTransferRequestVaultProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestVaultProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestVaultProfileAvatar(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferRequestVaultMintUsername = {
    $$type: 'ATHTransferRequestVaultMintUsername';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
    notify_value: bigint;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeATHTransferRequestVaultMintUsername(src: ATHTransferRequestVaultMintUsername) {
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

export function loadATHTransferRequestVaultMintUsername(slice: Slice) {
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
    return { $$type: 'ATHTransferRequestVaultMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleATHTransferRequestVaultMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHTransferRequestVaultMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleATHTransferRequestVaultMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHTransferRequestVaultMintUsername' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleATHTransferRequestVaultMintUsername(source: ATHTransferRequestVaultMintUsername) {
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

export function dictValueParserATHTransferRequestVaultMintUsername(): DictionaryValue<ATHTransferRequestVaultMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequestVaultMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequestVaultMintUsername(src.loadRef().beginParse());
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

export type ATHInternalTransferVaultProfileAvatar = {
    $$type: 'ATHInternalTransferVaultProfileAvatar';
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

export function storeATHInternalTransferVaultProfileAvatar(src: ATHInternalTransferVaultProfileAvatar) {
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

export function loadATHInternalTransferVaultProfileAvatar(slice: Slice) {
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
    return { $$type: 'ATHInternalTransferVaultProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadTupleATHInternalTransferVaultProfileAvatar(source: TupleReader) {
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
    return { $$type: 'ATHInternalTransferVaultProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function loadGetterTupleATHInternalTransferVaultProfileAvatar(source: TupleReader) {
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
    return { $$type: 'ATHInternalTransferVaultProfileAvatar' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, avatar_hash: _avatar_hash, avatar_entry_id: _avatar_entry_id, avatar_stream_id: _avatar_stream_id, avatar_part_count: _avatar_part_count, media_format: _media_format };
}

export function storeTupleATHInternalTransferVaultProfileAvatar(source: ATHInternalTransferVaultProfileAvatar) {
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

export function dictValueParserATHInternalTransferVaultProfileAvatar(): DictionaryValue<ATHInternalTransferVaultProfileAvatar> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferVaultProfileAvatar(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferVaultProfileAvatar(src.loadRef().beginParse());
        }
    }
}

export type ATHInternalTransferVaultMintUsername = {
    $$type: 'ATHInternalTransferVaultMintUsername';
    query_id: bigint;
    amount: bigint;
    sender_owner: Address;
    response_destination: Address;
    notify_value: bigint;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeATHInternalTransferVaultMintUsername(src: ATHInternalTransferVaultMintUsername) {
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

export function loadATHInternalTransferVaultMintUsername(slice: Slice) {
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
    return { $$type: 'ATHInternalTransferVaultMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleATHInternalTransferVaultMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHInternalTransferVaultMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleATHInternalTransferVaultMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _notify_value = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'ATHInternalTransferVaultMintUsername' as const, query_id: _query_id, amount: _amount, sender_owner: _sender_owner, response_destination: _response_destination, notify_value: _notify_value, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleATHInternalTransferVaultMintUsername(source: ATHInternalTransferVaultMintUsername) {
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

export function dictValueParserATHInternalTransferVaultMintUsername(): DictionaryValue<ATHInternalTransferVaultMintUsername> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHInternalTransferVaultMintUsername(src)).endCell());
        },
        parse: (src) => {
            return loadATHInternalTransferVaultMintUsername(src.loadRef().beginParse());
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
    processed_notifications: Dictionary<bigint, bigint>;
    pending_outgoing_transfers: Dictionary<bigint, PendingAthOutgoingTransfer>;
}

export function storeATHWallet$Data(src: ATHWallet$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.balance, 128);
        b_0.storeAddress(src.owner_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeDict(src.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification());
        b_0.storeDict(src.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_0.storeDict(src.pending_outgoing_transfers, Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer());
    };
}

export function loadATHWallet$Data(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _pending_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), sc_0);
    const _processed_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    const _pending_outgoing_transfers = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), sc_0);
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function loadTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_outgoing_transfers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function loadGetterTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_outgoing_transfers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function storeTupleATHWallet$Data(source: ATHWallet$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeCell(source.pending_notifications.size > 0 ? beginCell().storeDictDirect(source.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification()).endCell() : null);
    builder.writeCell(source.processed_notifications.size > 0 ? beginCell().storeDictDirect(source.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
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

export type BindProfileRegistry = {
    $$type: 'BindProfileRegistry';
    deployment_manifest_hash: bigint;
    profile_registry_address: Address;
}

export function storeBindProfileRegistry(src: BindProfileRegistry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060611, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.profile_registry_address);
    };
}

export function loadBindProfileRegistry(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060611) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _profile_registry_address = sc_0.loadAddress();
    return { $$type: 'BindProfileRegistry' as const, deployment_manifest_hash: _deployment_manifest_hash, profile_registry_address: _profile_registry_address };
}

export function loadTupleBindProfileRegistry(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _profile_registry_address = source.readAddress();
    return { $$type: 'BindProfileRegistry' as const, deployment_manifest_hash: _deployment_manifest_hash, profile_registry_address: _profile_registry_address };
}

export function loadGetterTupleBindProfileRegistry(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _profile_registry_address = source.readAddress();
    return { $$type: 'BindProfileRegistry' as const, deployment_manifest_hash: _deployment_manifest_hash, profile_registry_address: _profile_registry_address };
}

export function storeTupleBindProfileRegistry(source: BindProfileRegistry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.profile_registry_address);
    return builder.build();
}

export function dictValueParserBindProfileRegistry(): DictionaryValue<BindProfileRegistry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindProfileRegistry(src)).endCell());
        },
        parse: (src) => {
            return loadBindProfileRegistry(src.loadRef().beginParse());
        }
    }
}

export type BindUsernameRegistry = {
    $$type: 'BindUsernameRegistry';
    deployment_manifest_hash: bigint;
    username_registry_address: Address;
}

export function storeBindUsernameRegistry(src: BindUsernameRegistry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1353060612, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.username_registry_address);
    };
}

export function loadBindUsernameRegistry(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1353060612) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _username_registry_address = sc_0.loadAddress();
    return { $$type: 'BindUsernameRegistry' as const, deployment_manifest_hash: _deployment_manifest_hash, username_registry_address: _username_registry_address };
}

export function loadTupleBindUsernameRegistry(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _username_registry_address = source.readAddress();
    return { $$type: 'BindUsernameRegistry' as const, deployment_manifest_hash: _deployment_manifest_hash, username_registry_address: _username_registry_address };
}

export function loadGetterTupleBindUsernameRegistry(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _username_registry_address = source.readAddress();
    return { $$type: 'BindUsernameRegistry' as const, deployment_manifest_hash: _deployment_manifest_hash, username_registry_address: _username_registry_address };
}

export function storeTupleBindUsernameRegistry(source: BindUsernameRegistry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.username_registry_address);
    return builder.build();
}

export function dictValueParserBindUsernameRegistry(): DictionaryValue<BindUsernameRegistry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindUsernameRegistry(src)).endCell());
        },
        parse: (src) => {
            return loadBindUsernameRegistry(src.loadRef().beginParse());
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

export type RegisterMessagingKeys = {
    $$type: 'RegisterMessagingKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    auth_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
}

export function storeRegisterMessagingKeys(src: RegisterMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1383096026, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        b_0.storeUint(src.auth_pubkey, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.pq_kem_pubkey_hash, 256);
        b_1.storeUint(src.pq_kem_pubkey_len, 16);
        b_1.storeRef(src.pq_kem_pubkey);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRegisterMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1383096026) { throw Error('Invalid prefix'); }
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const _auth_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleRegisterMessagingKeys(source: RegisterMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
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
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeReplaceMessagingKeys(src: ReplaceMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2312521915, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadReplaceMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2312521915) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'ReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleReplaceMessagingKeys(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'ReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleReplaceMessagingKeys(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'ReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleReplaceMessagingKeys(source: ReplaceMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
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

export type WithdrawTonFromVaultBalance = {
    $$type: 'WithdrawTonFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeWithdrawTonFromVaultBalance(src: WithdrawTonFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981368, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadWithdrawTonFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981368) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'WithdrawTonFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleWithdrawTonFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'WithdrawTonFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleWithdrawTonFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'WithdrawTonFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleWithdrawTonFromVaultBalance(source: WithdrawTonFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserWithdrawTonFromVaultBalance(): DictionaryValue<WithdrawTonFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeWithdrawTonFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadWithdrawTonFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type WithdrawAthFromVaultBalance = {
    $$type: 'WithdrawAthFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeWithdrawAthFromVaultBalance(src: WithdrawAthFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981369, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadWithdrawAthFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981369) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'WithdrawAthFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleWithdrawAthFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'WithdrawAthFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleWithdrawAthFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'WithdrawAthFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleWithdrawAthFromVaultBalance(source: WithdrawAthFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserWithdrawAthFromVaultBalance(): DictionaryValue<WithdrawAthFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeWithdrawAthFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadWithdrawAthFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type SetProfileAvatarFromVaultBalance = {
    $$type: 'SetProfileAvatarFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeSetProfileAvatarFromVaultBalance(src: SetProfileAvatarFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981363, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadSetProfileAvatarFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981363) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'SetProfileAvatarFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleSetProfileAvatarFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'SetProfileAvatarFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleSetProfileAvatarFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'SetProfileAvatarFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleSetProfileAvatarFromVaultBalance(source: SetProfileAvatarFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserSetProfileAvatarFromVaultBalance(): DictionaryValue<SetProfileAvatarFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSetProfileAvatarFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadSetProfileAvatarFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type MintUsernameFromVaultBalance = {
    $$type: 'MintUsernameFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeMintUsernameFromVaultBalance(src: MintUsernameFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981364, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadMintUsernameFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981364) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'MintUsernameFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleMintUsernameFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'MintUsernameFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleMintUsernameFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'MintUsernameFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleMintUsernameFromVaultBalance(source: MintUsernameFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserMintUsernameFromVaultBalance(): DictionaryValue<MintUsernameFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMintUsernameFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadMintUsernameFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type PublishBatchFromVaultBalance = {
    $$type: 'PublishBatchFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storePublishBatchFromVaultBalance(src: PublishBatchFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981377, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadPublishBatchFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981377) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'PublishBatchFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTuplePublishBatchFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'PublishBatchFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTuplePublishBatchFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'PublishBatchFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTuplePublishBatchFromVaultBalance(source: PublishBatchFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserPublishBatchFromVaultBalance(): DictionaryValue<PublishBatchFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishBatchFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadPublishBatchFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type PublishBatchToHub = {
    $$type: 'PublishBatchToHub';
    bounce_id: bigint;
    bounce_tag: bigint;
    publish_id: bigint;
    publish_kind: bigint;
    part_count: bigint;
    protocol_fee_total: bigint;
    author_wallet: Address;
    parts: Cell;
    marketing: Cell | null;
}

export function storePublishBatchToHub(src: PublishBatchToHub) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2767741649, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.publish_kind, 8);
        b_0.storeUint(src.part_count, 8);
        b_0.storeUint(src.protocol_fee_total, 128);
        b_0.storeAddress(src.author_wallet);
        b_0.storeRef(src.parts);
        if (src.marketing !== null && src.marketing !== undefined) { b_0.storeBit(true).storeRef(src.marketing); } else { b_0.storeBit(false); }
    };
}

export function loadPublishBatchToHub(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2767741649) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _publish_kind = sc_0.loadUintBig(8);
    const _part_count = sc_0.loadUintBig(8);
    const _protocol_fee_total = sc_0.loadUintBig(128);
    const _author_wallet = sc_0.loadAddress();
    const _parts = sc_0.loadRef();
    const _marketing = sc_0.loadBit() ? sc_0.loadRef() : null;
    return { $$type: 'PublishBatchToHub' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, publish_kind: _publish_kind, part_count: _part_count, protocol_fee_total: _protocol_fee_total, author_wallet: _author_wallet, parts: _parts, marketing: _marketing };
}

export function loadTuplePublishBatchToHub(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _protocol_fee_total = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _parts = source.readCell();
    const _marketing = source.readCellOpt();
    return { $$type: 'PublishBatchToHub' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, publish_kind: _publish_kind, part_count: _part_count, protocol_fee_total: _protocol_fee_total, author_wallet: _author_wallet, parts: _parts, marketing: _marketing };
}

export function loadGetterTuplePublishBatchToHub(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _protocol_fee_total = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _parts = source.readCell();
    const _marketing = source.readCellOpt();
    return { $$type: 'PublishBatchToHub' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, publish_kind: _publish_kind, part_count: _part_count, protocol_fee_total: _protocol_fee_total, author_wallet: _author_wallet, parts: _parts, marketing: _marketing };
}

export function storeTuplePublishBatchToHub(source: PublishBatchToHub) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.publish_kind);
    builder.writeNumber(source.part_count);
    builder.writeNumber(source.protocol_fee_total);
    builder.writeAddress(source.author_wallet);
    builder.writeCell(source.parts);
    builder.writeCell(source.marketing);
    return builder.build();
}

export function dictValueParserPublishBatchToHub(): DictionaryValue<PublishBatchToHub> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishBatchToHub(src)).endCell());
        },
        parse: (src) => {
            return loadPublishBatchToHub(src.loadRef().beginParse());
        }
    }
}

export type CapsuleHubBatchAck = {
    $$type: 'CapsuleHubBatchAck';
    publish_id: bigint;
    first_entry_id: bigint;
    part_count: bigint;
    batch_uid: bigint;
}

export function storeCapsuleHubBatchAck(src: CapsuleHubBatchAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2270058353, 32);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.first_entry_id, 64);
        b_0.storeUint(src.part_count, 8);
        b_0.storeUint(src.batch_uid, 256);
    };
}

export function loadCapsuleHubBatchAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2270058353) { throw Error('Invalid prefix'); }
    const _publish_id = sc_0.loadUintBig(256);
    const _first_entry_id = sc_0.loadUintBig(64);
    const _part_count = sc_0.loadUintBig(8);
    const _batch_uid = sc_0.loadUintBig(256);
    return { $$type: 'CapsuleHubBatchAck' as const, publish_id: _publish_id, first_entry_id: _first_entry_id, part_count: _part_count, batch_uid: _batch_uid };
}

export function loadTupleCapsuleHubBatchAck(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _first_entry_id = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _batch_uid = source.readBigNumber();
    return { $$type: 'CapsuleHubBatchAck' as const, publish_id: _publish_id, first_entry_id: _first_entry_id, part_count: _part_count, batch_uid: _batch_uid };
}

export function loadGetterTupleCapsuleHubBatchAck(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _first_entry_id = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _batch_uid = source.readBigNumber();
    return { $$type: 'CapsuleHubBatchAck' as const, publish_id: _publish_id, first_entry_id: _first_entry_id, part_count: _part_count, batch_uid: _batch_uid };
}

export function storeTupleCapsuleHubBatchAck(source: CapsuleHubBatchAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.first_entry_id);
    builder.writeNumber(source.part_count);
    builder.writeNumber(source.batch_uid);
    return builder.build();
}

export function dictValueParserCapsuleHubBatchAck(): DictionaryValue<CapsuleHubBatchAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsuleHubBatchAck(src)).endCell());
        },
        parse: (src) => {
            return loadCapsuleHubBatchAck(src.loadRef().beginParse());
        }
    }
}

export type PruneBatchPublish = {
    $$type: 'PruneBatchPublish';
    publish_id: bigint;
}

export function storePruneBatchPublish(src: PruneBatchPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1913380206, 32);
        b_0.storeUint(src.publish_id, 256);
    };
}

export function loadPruneBatchPublish(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1913380206) { throw Error('Invalid prefix'); }
    const _publish_id = sc_0.loadUintBig(256);
    return { $$type: 'PruneBatchPublish' as const, publish_id: _publish_id };
}

export function loadTuplePruneBatchPublish(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    return { $$type: 'PruneBatchPublish' as const, publish_id: _publish_id };
}

export function loadGetterTuplePruneBatchPublish(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    return { $$type: 'PruneBatchPublish' as const, publish_id: _publish_id };
}

export function storeTuplePruneBatchPublish(source: PruneBatchPublish) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    return builder.build();
}

export function dictValueParserPruneBatchPublish(): DictionaryValue<PruneBatchPublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePruneBatchPublish(src)).endCell());
        },
        parse: (src) => {
            return loadPruneBatchPublish(src.loadRef().beginParse());
        }
    }
}

export type PruneStuckAthPending = {
    $$type: 'PruneStuckAthPending';
    kind: bigint;
    query_id: bigint;
}

export function storePruneStuckAthPending(src: PruneStuckAthPending) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1913380207, 32);
        b_0.storeUint(src.kind, 8);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadPruneStuckAthPending(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1913380207) { throw Error('Invalid prefix'); }
    const _kind = sc_0.loadUintBig(8);
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'PruneStuckAthPending' as const, kind: _kind, query_id: _query_id };
}

export function loadTuplePruneStuckAthPending(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _query_id = source.readBigNumber();
    return { $$type: 'PruneStuckAthPending' as const, kind: _kind, query_id: _query_id };
}

export function loadGetterTuplePruneStuckAthPending(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _query_id = source.readBigNumber();
    return { $$type: 'PruneStuckAthPending' as const, kind: _kind, query_id: _query_id };
}

export function storeTuplePruneStuckAthPending(source: PruneStuckAthPending) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.kind);
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserPruneStuckAthPending(): DictionaryValue<PruneStuckAthPending> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePruneStuckAthPending(src)).endCell());
        },
        parse: (src) => {
            return loadPruneStuckAthPending(src.loadRef().beginParse());
        }
    }
}

export type AnnounceSuccessorManifest = {
    $$type: 'AnnounceSuccessorManifest';
    successor_manifest_hash: bigint;
    successor_vault: Address;
}

export function storeAnnounceSuccessorManifest(src: AnnounceSuccessorManifest) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1398096717, 32);
        b_0.storeUint(src.successor_manifest_hash, 256);
        b_0.storeAddress(src.successor_vault);
    };
}

export function loadAnnounceSuccessorManifest(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1398096717) { throw Error('Invalid prefix'); }
    const _successor_manifest_hash = sc_0.loadUintBig(256);
    const _successor_vault = sc_0.loadAddress();
    return { $$type: 'AnnounceSuccessorManifest' as const, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault };
}

export function loadTupleAnnounceSuccessorManifest(source: TupleReader) {
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    return { $$type: 'AnnounceSuccessorManifest' as const, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault };
}

export function loadGetterTupleAnnounceSuccessorManifest(source: TupleReader) {
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    return { $$type: 'AnnounceSuccessorManifest' as const, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault };
}

export function storeTupleAnnounceSuccessorManifest(source: AnnounceSuccessorManifest) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.successor_manifest_hash);
    builder.writeAddress(source.successor_vault);
    return builder.build();
}

export function dictValueParserAnnounceSuccessorManifest(): DictionaryValue<AnnounceSuccessorManifest> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAnnounceSuccessorManifest(src)).endCell());
        },
        parse: (src) => {
            return loadAnnounceSuccessorManifest(src.loadRef().beginParse());
        }
    }
}

export type TopUpStorageReserve = {
    $$type: 'TopUpStorageReserve';
}

export function storeTopUpStorageReserve(src: TopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(840283645, 32);
    };
}

export function loadTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 840283645) { throw Error('Invalid prefix'); }
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

export type EvictDormantUser = {
    $$type: 'EvictDormantUser';
    owner_wallet: Address;
}

export function storeEvictDormantUser(src: EvictDormantUser) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1163281492, 32);
        b_0.storeAddress(src.owner_wallet);
    };
}

export function loadEvictDormantUser(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1163281492) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    return { $$type: 'EvictDormantUser' as const, owner_wallet: _owner_wallet };
}

export function loadTupleEvictDormantUser(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    return { $$type: 'EvictDormantUser' as const, owner_wallet: _owner_wallet };
}

export function loadGetterTupleEvictDormantUser(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    return { $$type: 'EvictDormantUser' as const, owner_wallet: _owner_wallet };
}

export function storeTupleEvictDormantUser(source: EvictDormantUser) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    return builder.build();
}

export function dictValueParserEvictDormantUser(): DictionaryValue<EvictDormantUser> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictDormantUser(src)).endCell());
        },
        parse: (src) => {
            return loadEvictDormantUser(src.loadRef().beginParse());
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

export type PendingAthWithdrawal = {
    $$type: 'PendingAthWithdrawal';
    owner_wallet: Address;
    tombstone: boolean;
    recipient: Address;
    recipient_ath_wallet: Address;
    amount: bigint;
    refundable_ton_amount: bigint;
    created_at: bigint;
}

export function storePendingAthWithdrawal(src: PendingAthWithdrawal) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBit(src.tombstone);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeUint(src.amount, 128);
        const b_1 = new Builder();
        b_1.storeUint(src.refundable_ton_amount, 128);
        b_1.storeUint(src.created_at, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingAthWithdrawal(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _tombstone = sc_0.loadBit();
    const _recipient = sc_0.loadAddress();
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _refundable_ton_amount = sc_1.loadUintBig(128);
    const _created_at = sc_1.loadUintBig(64);
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, refundable_ton_amount: _refundable_ton_amount, created_at: _created_at };
}

export function loadTuplePendingAthWithdrawal(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _refundable_ton_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, refundable_ton_amount: _refundable_ton_amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthWithdrawal(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _refundable_ton_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, refundable_ton_amount: _refundable_ton_amount, created_at: _created_at };
}

export function storeTuplePendingAthWithdrawal(source: PendingAthWithdrawal) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.tombstone);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.refundable_ton_amount);
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

export type PendingBatchPublish = {
    $$type: 'PendingBatchPublish';
    owner_wallet: Address;
    tombstone: boolean;
    refund_to_vault: boolean;
    nonce: bigint;
    publish_kind: bigint;
    part_count: bigint;
    publish_id: bigint;
    refundable_amount: bigint;
    created_at: bigint;
}

export function storePendingBatchPublish(src: PendingBatchPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBit(src.tombstone);
        b_0.storeBit(src.refund_to_vault);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.publish_kind, 8);
        b_0.storeUint(src.part_count, 8);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.refundable_amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingBatchPublish(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _tombstone = sc_0.loadBit();
    const _refund_to_vault = sc_0.loadBit();
    const _nonce = sc_0.loadUintBig(64);
    const _publish_kind = sc_0.loadUintBig(8);
    const _part_count = sc_0.loadUintBig(8);
    const _publish_id = sc_0.loadUintBig(256);
    const _refundable_amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingBatchPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, refund_to_vault: _refund_to_vault, nonce: _nonce, publish_kind: _publish_kind, part_count: _part_count, publish_id: _publish_id, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function loadTuplePendingBatchPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _refund_to_vault = source.readBoolean();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _refundable_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingBatchPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, refund_to_vault: _refund_to_vault, nonce: _nonce, publish_kind: _publish_kind, part_count: _part_count, publish_id: _publish_id, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function loadGetterTuplePendingBatchPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _refund_to_vault = source.readBoolean();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _refundable_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingBatchPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, refund_to_vault: _refund_to_vault, nonce: _nonce, publish_kind: _publish_kind, part_count: _part_count, publish_id: _publish_id, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function storeTuplePendingBatchPublish(source: PendingBatchPublish) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.tombstone);
    builder.writeBoolean(source.refund_to_vault);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.publish_kind);
    builder.writeNumber(source.part_count);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.refundable_amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingBatchPublish(): DictionaryValue<PendingBatchPublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingBatchPublish(src)).endCell());
        },
        parse: (src) => {
            return loadPendingBatchPublish(src.loadRef().beginParse());
        }
    }
}

export type PendingProfileAvatarPayment = {
    $$type: 'PendingProfileAvatarPayment';
    owner_wallet: Address;
    tombstone: boolean;
    amount: bigint;
    created_at: bigint;
}

export function storePendingProfileAvatarPayment(src: PendingProfileAvatarPayment) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBit(src.tombstone);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingProfileAvatarPayment(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _tombstone = sc_0.loadBit();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingProfileAvatarPayment' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingProfileAvatarPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarPayment' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingProfileAvatarPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarPayment' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingProfileAvatarPayment(source: PendingProfileAvatarPayment) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.tombstone);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingProfileAvatarPayment(): DictionaryValue<PendingProfileAvatarPayment> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingProfileAvatarPayment(src)).endCell());
        },
        parse: (src) => {
            return loadPendingProfileAvatarPayment(src.loadRef().beginParse());
        }
    }
}

export type PendingUsernameMintPayment = {
    $$type: 'PendingUsernameMintPayment';
    owner_wallet: Address;
    tombstone: boolean;
    amount: bigint;
    created_at: bigint;
}

export function storePendingUsernameMintPayment(src: PendingUsernameMintPayment) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBit(src.tombstone);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingUsernameMintPayment(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _tombstone = sc_0.loadBit();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingUsernameMintPayment' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingUsernameMintPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintPayment' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingUsernameMintPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintPayment' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingUsernameMintPayment(source: PendingUsernameMintPayment) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.tombstone);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingUsernameMintPayment(): DictionaryValue<PendingUsernameMintPayment> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingUsernameMintPayment(src)).endCell());
        },
        parse: (src) => {
            return loadPendingUsernameMintPayment(src.loadRef().beginParse());
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
    pq_kem_pubkey: Cell;
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
        b_1.storeRef(src.pq_kem_pubkey);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_1.storeUint(src.created_at, 64);
        b_1.storeUint(src.created_lt, 64);
        b_1.storeUint(src.revoked_at, 64);
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
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    const _created_at = sc_1.loadUintBig(64);
    const _created_lt = sc_1.loadUintBig(64);
    const _revoked_at = sc_1.loadUintBig(64);
    const _revoked_lt = sc_1.loadUintBig(64);
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadTupleKeyRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadGetterTupleKeyRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function storeTupleKeyRecord(source: KeyRecord) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
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

export type ReceiptSlot = {
    $$type: 'ReceiptSlot';
    nonce: bigint;
    action: bigint;
    result: bigint;
    aux: bigint;
    part_count: bigint;
    at: bigint;
}

export function storeReceiptSlot(src: ReceiptSlot) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.action, 8);
        b_0.storeUint(src.result, 8);
        b_0.storeUint(src.aux, 64);
        b_0.storeUint(src.part_count, 8);
        b_0.storeUint(src.at, 64);
    };
}

export function loadReceiptSlot(slice: Slice) {
    const sc_0 = slice;
    const _nonce = sc_0.loadUintBig(64);
    const _action = sc_0.loadUintBig(8);
    const _result = sc_0.loadUintBig(8);
    const _aux = sc_0.loadUintBig(64);
    const _part_count = sc_0.loadUintBig(8);
    const _at = sc_0.loadUintBig(64);
    return { $$type: 'ReceiptSlot' as const, nonce: _nonce, action: _action, result: _result, aux: _aux, part_count: _part_count, at: _at };
}

export function loadTupleReceiptSlot(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _action = source.readBigNumber();
    const _result = source.readBigNumber();
    const _aux = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _at = source.readBigNumber();
    return { $$type: 'ReceiptSlot' as const, nonce: _nonce, action: _action, result: _result, aux: _aux, part_count: _part_count, at: _at };
}

export function loadGetterTupleReceiptSlot(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _action = source.readBigNumber();
    const _result = source.readBigNumber();
    const _aux = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _at = source.readBigNumber();
    return { $$type: 'ReceiptSlot' as const, nonce: _nonce, action: _action, result: _result, aux: _aux, part_count: _part_count, at: _at };
}

export function storeTupleReceiptSlot(source: ReceiptSlot) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.action);
    builder.writeNumber(source.result);
    builder.writeNumber(source.aux);
    builder.writeNumber(source.part_count);
    builder.writeNumber(source.at);
    return builder.build();
}

export function dictValueParserReceiptSlot(): DictionaryValue<ReceiptSlot> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeReceiptSlot(src)).endCell());
        },
        parse: (src) => {
            return loadReceiptSlot(src.loadRef().beginParse());
        }
    }
}

export type UserState = {
    $$type: 'UserState';
    ton_balance: bigint;
    ath_balance: bigint;
    current_key_id: bigint;
    auth_pubkey: bigint;
    publish_nonce: bigint;
    last_active: bigint;
    receipts: Dictionary<number, ReceiptSlot>;
}

export function storeUserState(src: UserState) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.ton_balance, 128);
        b_0.storeUint(src.ath_balance, 128);
        b_0.storeUint(src.current_key_id, 256);
        b_0.storeUint(src.auth_pubkey, 256);
        b_0.storeUint(src.publish_nonce, 64);
        b_0.storeUint(src.last_active, 64);
        b_0.storeDict(src.receipts, Dictionary.Keys.Uint(8), dictValueParserReceiptSlot());
    };
}

export function loadUserState(slice: Slice) {
    const sc_0 = slice;
    const _ton_balance = sc_0.loadUintBig(128);
    const _ath_balance = sc_0.loadUintBig(128);
    const _current_key_id = sc_0.loadUintBig(256);
    const _auth_pubkey = sc_0.loadUintBig(256);
    const _publish_nonce = sc_0.loadUintBig(64);
    const _last_active = sc_0.loadUintBig(64);
    const _receipts = Dictionary.load(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), sc_0);
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, last_active: _last_active, receipts: _receipts };
}

export function loadTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    const _last_active = source.readBigNumber();
    const _receipts = Dictionary.loadDirect(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), source.readCellOpt());
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, last_active: _last_active, receipts: _receipts };
}

export function loadGetterTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    const _last_active = source.readBigNumber();
    const _receipts = Dictionary.loadDirect(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), source.readCellOpt());
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, last_active: _last_active, receipts: _receipts };
}

export function storeTupleUserState(source: UserState) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.publish_nonce);
    builder.writeNumber(source.last_active);
    builder.writeCell(source.receipts.size > 0 ? beginCell().storeDictDirect(source.receipts, Dictionary.Keys.Uint(8), dictValueParserReceiptSlot()).endCell() : null);
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

export type VaultKeyRecordView = {
    $$type: 'VaultKeyRecordView';
    exists: boolean;
    owner_wallet: Address;
    key_generation: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
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
        b_1.storeRef(src.pq_kem_pubkey);
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
    const _pq_kem_pubkey = sc_1.loadRef();
    const sc_2 = sc_1.loadRef().beginParse();
    const _crypto_suite_mask = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const _created_lt = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _revoked_at = sc_3.loadIntBig(257);
    const _revoked_lt = sc_3.loadIntBig(257);
    return { $$type: 'VaultKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadTupleVaultKeyRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'VaultKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadGetterTupleVaultKeyRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'VaultKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
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
    builder.writeCell(source.pq_kem_pubkey);
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
    current_key_id: bigint;
    auth_pubkey: bigint;
    publish_nonce: bigint;
    last_active: bigint;
}

export function storeVaultUserView(src: VaultUserView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.ton_balance, 257);
        b_0.storeInt(src.ath_balance, 257);
        b_0.storeInt(src.current_key_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.auth_pubkey, 257);
        b_1.storeInt(src.publish_nonce, 257);
        b_1.storeInt(src.last_active, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultUserView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _ton_balance = sc_0.loadIntBig(257);
    const _ath_balance = sc_0.loadIntBig(257);
    const _current_key_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _auth_pubkey = sc_1.loadIntBig(257);
    const _publish_nonce = sc_1.loadIntBig(257);
    const _last_active = sc_1.loadIntBig(257);
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, last_active: _last_active };
}

export function loadTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    const _last_active = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, last_active: _last_active };
}

export function loadGetterTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    const _last_active = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, last_active: _last_active };
}

export function storeTupleVaultUserView(source: VaultUserView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.publish_nonce);
    builder.writeNumber(source.last_active);
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

export type VaultStorageHealthView = {
    $$type: 'VaultStorageHealthView';
    balance: bigint;
    storage_reserve: bigint;
    user_count: bigint;
    key_record_count: bigint;
    surplus: bigint;
}

export function storeVaultStorageHealthView(src: VaultStorageHealthView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.balance, 257);
        b_0.storeInt(src.storage_reserve, 257);
        b_0.storeInt(src.user_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.key_record_count, 257);
        b_1.storeInt(src.surplus, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultStorageHealthView(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadIntBig(257);
    const _storage_reserve = sc_0.loadIntBig(257);
    const _user_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _key_record_count = sc_1.loadIntBig(257);
    const _surplus = sc_1.loadIntBig(257);
    return { $$type: 'VaultStorageHealthView' as const, balance: _balance, storage_reserve: _storage_reserve, user_count: _user_count, key_record_count: _key_record_count, surplus: _surplus };
}

export function loadTupleVaultStorageHealthView(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _storage_reserve = source.readBigNumber();
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _surplus = source.readBigNumber();
    return { $$type: 'VaultStorageHealthView' as const, balance: _balance, storage_reserve: _storage_reserve, user_count: _user_count, key_record_count: _key_record_count, surplus: _surplus };
}

export function loadGetterTupleVaultStorageHealthView(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _storage_reserve = source.readBigNumber();
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _surplus = source.readBigNumber();
    return { $$type: 'VaultStorageHealthView' as const, balance: _balance, storage_reserve: _storage_reserve, user_count: _user_count, key_record_count: _key_record_count, surplus: _surplus };
}

export function storeTupleVaultStorageHealthView(source: VaultStorageHealthView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeNumber(source.storage_reserve);
    builder.writeNumber(source.user_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.surplus);
    return builder.build();
}

export function dictValueParserVaultStorageHealthView(): DictionaryValue<VaultStorageHealthView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultStorageHealthView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultStorageHealthView(src.loadRef().beginParse());
        }
    }
}

export type VaultUserReceiptsView = {
    $$type: 'VaultUserReceiptsView';
    exists: boolean;
    publish_nonce: bigint;
    receipts: Dictionary<number, ReceiptSlot>;
}

export function storeVaultUserReceiptsView(src: VaultUserReceiptsView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.publish_nonce, 257);
        b_0.storeDict(src.receipts, Dictionary.Keys.Uint(8), dictValueParserReceiptSlot());
    };
}

export function loadVaultUserReceiptsView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _publish_nonce = sc_0.loadIntBig(257);
    const _receipts = Dictionary.load(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), sc_0);
    return { $$type: 'VaultUserReceiptsView' as const, exists: _exists, publish_nonce: _publish_nonce, receipts: _receipts };
}

export function loadTupleVaultUserReceiptsView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _publish_nonce = source.readBigNumber();
    const _receipts = Dictionary.loadDirect(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), source.readCellOpt());
    return { $$type: 'VaultUserReceiptsView' as const, exists: _exists, publish_nonce: _publish_nonce, receipts: _receipts };
}

export function loadGetterTupleVaultUserReceiptsView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _publish_nonce = source.readBigNumber();
    const _receipts = Dictionary.loadDirect(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), source.readCellOpt());
    return { $$type: 'VaultUserReceiptsView' as const, exists: _exists, publish_nonce: _publish_nonce, receipts: _receipts };
}

export function storeTupleVaultUserReceiptsView(source: VaultUserReceiptsView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.publish_nonce);
    builder.writeCell(source.receipts.size > 0 ? beginCell().storeDictDirect(source.receipts, Dictionary.Keys.Uint(8), dictValueParserReceiptSlot()).endCell() : null);
    return builder.build();
}

export function dictValueParserVaultUserReceiptsView(): DictionaryValue<VaultUserReceiptsView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultUserReceiptsView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultUserReceiptsView(src.loadRef().beginParse());
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

export type VaultSuccessorView = {
    $$type: 'VaultSuccessorView';
    announced: boolean;
    successor_manifest_hash: bigint;
    successor_vault: Address;
    announced_at: bigint;
}

export function storeVaultSuccessorView(src: VaultSuccessorView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.announced);
        b_0.storeInt(src.successor_manifest_hash, 257);
        b_0.storeAddress(src.successor_vault);
        b_0.storeInt(src.announced_at, 257);
    };
}

export function loadVaultSuccessorView(slice: Slice) {
    const sc_0 = slice;
    const _announced = sc_0.loadBit();
    const _successor_manifest_hash = sc_0.loadIntBig(257);
    const _successor_vault = sc_0.loadAddress();
    const _announced_at = sc_0.loadIntBig(257);
    return { $$type: 'VaultSuccessorView' as const, announced: _announced, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault, announced_at: _announced_at };
}

export function loadTupleVaultSuccessorView(source: TupleReader) {
    const _announced = source.readBoolean();
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    const _announced_at = source.readBigNumber();
    return { $$type: 'VaultSuccessorView' as const, announced: _announced, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault, announced_at: _announced_at };
}

export function loadGetterTupleVaultSuccessorView(source: TupleReader) {
    const _announced = source.readBoolean();
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    const _announced_at = source.readBigNumber();
    return { $$type: 'VaultSuccessorView' as const, announced: _announced, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault, announced_at: _announced_at };
}

export function storeTupleVaultSuccessorView(source: VaultSuccessorView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.announced);
    builder.writeNumber(source.successor_manifest_hash);
    builder.writeAddress(source.successor_vault);
    builder.writeNumber(source.announced_at);
    return builder.build();
}

export function dictValueParserVaultSuccessorView(): DictionaryValue<VaultSuccessorView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultSuccessorView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultSuccessorView(src.loadRef().beginParse());
        }
    }
}

export type VaultPendingBatchPublishView = {
    $$type: 'VaultPendingBatchPublishView';
    exists: boolean;
    owner_wallet: Address;
    nonce: bigint;
    publish_kind: bigint;
    part_count: bigint;
    created_at: bigint;
    tombstone: boolean;
}

export function storeVaultPendingBatchPublishView(src: VaultPendingBatchPublishView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.nonce, 257);
        b_0.storeInt(src.publish_kind, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.part_count, 257);
        b_1.storeInt(src.created_at, 257);
        b_1.storeBit(src.tombstone);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVaultPendingBatchPublishView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _nonce = sc_0.loadIntBig(257);
    const _publish_kind = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _part_count = sc_1.loadIntBig(257);
    const _created_at = sc_1.loadIntBig(257);
    const _tombstone = sc_1.loadBit();
    return { $$type: 'VaultPendingBatchPublishView' as const, exists: _exists, owner_wallet: _owner_wallet, nonce: _nonce, publish_kind: _publish_kind, part_count: _part_count, created_at: _created_at, tombstone: _tombstone };
}

export function loadTupleVaultPendingBatchPublishView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _tombstone = source.readBoolean();
    return { $$type: 'VaultPendingBatchPublishView' as const, exists: _exists, owner_wallet: _owner_wallet, nonce: _nonce, publish_kind: _publish_kind, part_count: _part_count, created_at: _created_at, tombstone: _tombstone };
}

export function loadGetterTupleVaultPendingBatchPublishView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _tombstone = source.readBoolean();
    return { $$type: 'VaultPendingBatchPublishView' as const, exists: _exists, owner_wallet: _owner_wallet, nonce: _nonce, publish_kind: _publish_kind, part_count: _part_count, created_at: _created_at, tombstone: _tombstone };
}

export function storeTupleVaultPendingBatchPublishView(source: VaultPendingBatchPublishView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.publish_kind);
    builder.writeNumber(source.part_count);
    builder.writeNumber(source.created_at);
    builder.writeBoolean(source.tombstone);
    return builder.build();
}

export function dictValueParserVaultPendingBatchPublishView(): DictionaryValue<VaultPendingBatchPublishView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVaultPendingBatchPublishView(src)).endCell());
        },
        parse: (src) => {
            return loadVaultPendingBatchPublishView(src.loadRef().beginParse());
        }
    }
}

export type VaultGlobalView = {
    $$type: 'VaultGlobalView';
    sealed: boolean;
    capsule_hub_bound: boolean;
    profile_registry_bound: boolean;
    username_registry_bound: boolean;
    deployment_manifest_hash: bigint;
    capsule_hub_address: Address;
    profile_registry_address: Address;
    username_registry_address: Address;
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    user_count: bigint;
    key_record_count: bigint;
    pending_ath_withdrawal_count: bigint;
    pending_publish_count: bigint;
    pending_profile_avatar_payment_count: bigint;
    pending_username_mint_payment_count: bigint;
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
        b_0.storeBit(src.profile_registry_bound);
        b_0.storeBit(src.username_registry_bound);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeAddress(src.capsule_hub_address);
        b_0.storeAddress(src.profile_registry_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.username_registry_address);
        b_1.storeAddress(src.vault_ath_wallet_address);
        b_1.storeAddress(src.ath_master_address);
        const b_2 = new Builder();
        b_2.storeInt(src.user_count, 257);
        b_2.storeInt(src.key_record_count, 257);
        b_2.storeInt(src.pending_ath_withdrawal_count, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.pending_publish_count, 257);
        b_3.storeInt(src.pending_profile_avatar_payment_count, 257);
        b_3.storeInt(src.pending_username_mint_payment_count, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.processed_ath_deposit_count, 257);
        b_4.storeInt(src.pending_publish_stale_ttl, 257);
        b_4.storeInt(src.airdrop_remaining_ath, 257);
        const b_5 = new Builder();
        b_5.storeInt(src.airdrop_distributed_ath, 257);
        b_5.storeInt(src.airdrop_reward_per_message_ath, 257);
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
    const _profile_registry_bound = sc_0.loadBit();
    const _username_registry_bound = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _capsule_hub_address = sc_0.loadAddress();
    const _profile_registry_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _username_registry_address = sc_1.loadAddress();
    const _vault_ath_wallet_address = sc_1.loadAddress();
    const _ath_master_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _user_count = sc_2.loadIntBig(257);
    const _key_record_count = sc_2.loadIntBig(257);
    const _pending_ath_withdrawal_count = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_publish_count = sc_3.loadIntBig(257);
    const _pending_profile_avatar_payment_count = sc_3.loadIntBig(257);
    const _pending_username_mint_payment_count = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _processed_ath_deposit_count = sc_4.loadIntBig(257);
    const _pending_publish_stale_ttl = sc_4.loadIntBig(257);
    const _airdrop_remaining_ath = sc_4.loadIntBig(257);
    const sc_5 = sc_4.loadRef().beginParse();
    const _airdrop_distributed_ath = sc_5.loadIntBig(257);
    const _airdrop_reward_per_message_ath = sc_5.loadIntBig(257);
    const _airdrop_total_allocation_ath = sc_5.loadIntBig(257);
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, profile_registry_bound: _profile_registry_bound, username_registry_bound: _username_registry_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, pending_profile_avatar_payment_count: _pending_profile_avatar_payment_count, pending_username_mint_payment_count: _pending_username_mint_payment_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function loadTupleVaultGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _capsule_hub_bound = source.readBoolean();
    const _profile_registry_bound = source.readBoolean();
    const _username_registry_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _profile_registry_address = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    source = source.readTuple();
    const _pending_profile_avatar_payment_count = source.readBigNumber();
    const _pending_username_mint_payment_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_publish_stale_ttl = source.readBigNumber();
    const _airdrop_remaining_ath = source.readBigNumber();
    const _airdrop_distributed_ath = source.readBigNumber();
    const _airdrop_reward_per_message_ath = source.readBigNumber();
    const _airdrop_total_allocation_ath = source.readBigNumber();
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, profile_registry_bound: _profile_registry_bound, username_registry_bound: _username_registry_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, pending_profile_avatar_payment_count: _pending_profile_avatar_payment_count, pending_username_mint_payment_count: _pending_username_mint_payment_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function loadGetterTupleVaultGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _capsule_hub_bound = source.readBoolean();
    const _profile_registry_bound = source.readBoolean();
    const _username_registry_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _profile_registry_address = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _pending_profile_avatar_payment_count = source.readBigNumber();
    const _pending_username_mint_payment_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_publish_stale_ttl = source.readBigNumber();
    const _airdrop_remaining_ath = source.readBigNumber();
    const _airdrop_distributed_ath = source.readBigNumber();
    const _airdrop_reward_per_message_ath = source.readBigNumber();
    const _airdrop_total_allocation_ath = source.readBigNumber();
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, profile_registry_bound: _profile_registry_bound, username_registry_bound: _username_registry_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, pending_profile_avatar_payment_count: _pending_profile_avatar_payment_count, pending_username_mint_payment_count: _pending_username_mint_payment_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function storeTupleVaultGlobalView(source: VaultGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.capsule_hub_bound);
    builder.writeBoolean(source.profile_registry_bound);
    builder.writeBoolean(source.username_registry_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.capsule_hub_address);
    builder.writeAddress(source.profile_registry_address);
    builder.writeAddress(source.username_registry_address);
    builder.writeAddress(source.vault_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeNumber(source.user_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.pending_ath_withdrawal_count);
    builder.writeNumber(source.pending_publish_count);
    builder.writeNumber(source.pending_profile_avatar_payment_count);
    builder.writeNumber(source.pending_username_mint_payment_count);
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
    profile_registry_address: Address;
    username_registry_address: Address;
    binding_flags: bigint;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    users: Dictionary<Address, UserState>;
    key_records: Dictionary<bigint, KeyRecord>;
    processed_ath_deposits: Dictionary<bigint, bigint>;
    pending_ath_withdrawals: Dictionary<bigint, PendingAthWithdrawal>;
    pending_batch_publishes: Dictionary<bigint, PendingBatchPublish>;
    pending_profile_avatar_payments: Dictionary<bigint, PendingProfileAvatarPayment>;
    pending_username_mint_payments: Dictionary<bigint, PendingUsernameMintPayment>;
    user_count: bigint;
    key_record_count: bigint;
    processed_ath_deposit_count: bigint;
    pending_ath_withdrawal_count: bigint;
    pending_publish_count: bigint;
    genesis_ext: Cell;
}

export function storeVault$Data(src: Vault$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.vault_ath_wallet_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.capsule_hub_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.profile_registry_address);
        b_1.storeAddress(src.username_registry_address);
        b_1.storeUint(src.binding_flags, 8);
        b_1.storeBit(src.sealed);
        b_1.storeUint(src.deployment_manifest_hash, 256);
        const b_2 = new Builder();
        b_2.storeUint(src.genesis_config_hash, 256);
        b_2.storeDict(src.users, Dictionary.Keys.Address(), dictValueParserUserState());
        b_2.storeDict(src.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord());
        b_2.storeDict(src.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        const b_3 = new Builder();
        b_3.storeDict(src.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal());
        b_3.storeDict(src.pending_batch_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish());
        b_3.storeDict(src.pending_profile_avatar_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment());
        const b_4 = new Builder();
        b_4.storeDict(src.pending_username_mint_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment());
        b_4.storeUint(src.user_count, 64);
        b_4.storeUint(src.key_record_count, 64);
        b_4.storeUint(src.processed_ath_deposit_count, 64);
        b_4.storeUint(src.pending_ath_withdrawal_count, 64);
        b_4.storeUint(src.pending_publish_count, 64);
        b_4.storeRef(src.genesis_ext);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadVault$Data(slice: Slice) {
    const sc_0 = slice;
    const _vault_ath_wallet_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _capsule_hub_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _profile_registry_address = sc_1.loadAddress();
    const _username_registry_address = sc_1.loadAddress();
    const _binding_flags = sc_1.loadUintBig(8);
    const _sealed = sc_1.loadBit();
    const _deployment_manifest_hash = sc_1.loadUintBig(256);
    const sc_2 = sc_1.loadRef().beginParse();
    const _genesis_config_hash = sc_2.loadUintBig(256);
    const _users = Dictionary.load(Dictionary.Keys.Address(), dictValueParserUserState(), sc_2);
    const _key_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), sc_2);
    const _processed_ath_deposits = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_2);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_ath_withdrawals = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), sc_3);
    const _pending_batch_publishes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish(), sc_3);
    const _pending_profile_avatar_payments = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), sc_3);
    const sc_4 = sc_3.loadRef().beginParse();
    const _pending_username_mint_payments = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), sc_4);
    const _user_count = sc_4.loadUintBig(64);
    const _key_record_count = sc_4.loadUintBig(64);
    const _processed_ath_deposit_count = sc_4.loadUintBig(64);
    const _pending_ath_withdrawal_count = sc_4.loadUintBig(64);
    const _pending_publish_count = sc_4.loadUintBig(64);
    const _genesis_ext = sc_4.loadRef();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_batch_publishes: _pending_batch_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, genesis_ext: _genesis_ext };
}

export function loadTupleVault$Data(source: TupleReader) {
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _capsule_hub_address = source.readAddress();
    const _profile_registry_address = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _binding_flags = source.readBigNumber();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _users = Dictionary.loadDirect(Dictionary.Keys.Address(), dictValueParserUserState(), source.readCellOpt());
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_batch_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish(), source.readCellOpt());
    source = source.readTuple();
    const _pending_profile_avatar_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), source.readCellOpt());
    const _pending_username_mint_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _genesis_ext = source.readCell();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_batch_publishes: _pending_batch_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, genesis_ext: _genesis_ext };
}

export function loadGetterTupleVault$Data(source: TupleReader) {
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _capsule_hub_address = source.readAddress();
    const _profile_registry_address = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _binding_flags = source.readBigNumber();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _users = Dictionary.loadDirect(Dictionary.Keys.Address(), dictValueParserUserState(), source.readCellOpt());
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_batch_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish(), source.readCellOpt());
    const _pending_profile_avatar_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), source.readCellOpt());
    const _pending_username_mint_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _genesis_ext = source.readCell();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_batch_publishes: _pending_batch_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, genesis_ext: _genesis_ext };
}

export function storeTupleVault$Data(source: Vault$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.vault_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.capsule_hub_address);
    builder.writeAddress(source.profile_registry_address);
    builder.writeAddress(source.username_registry_address);
    builder.writeNumber(source.binding_flags);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeCell(source.users.size > 0 ? beginCell().storeDictDirect(source.users, Dictionary.Keys.Address(), dictValueParserUserState()).endCell() : null);
    builder.writeCell(source.key_records.size > 0 ? beginCell().storeDictDirect(source.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord()).endCell() : null);
    builder.writeCell(source.processed_ath_deposits.size > 0 ? beginCell().storeDictDirect(source.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_ath_withdrawals.size > 0 ? beginCell().storeDictDirect(source.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal()).endCell() : null);
    builder.writeCell(source.pending_batch_publishes.size > 0 ? beginCell().storeDictDirect(source.pending_batch_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish()).endCell() : null);
    builder.writeCell(source.pending_profile_avatar_payments.size > 0 ? beginCell().storeDictDirect(source.pending_profile_avatar_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment()).endCell() : null);
    builder.writeCell(source.pending_username_mint_payments.size > 0 ? beginCell().storeDictDirect(source.pending_username_mint_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment()).endCell() : null);
    builder.writeNumber(source.user_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.processed_ath_deposit_count);
    builder.writeNumber(source.pending_ath_withdrawal_count);
    builder.writeNumber(source.pending_publish_count);
    builder.writeCell(source.genesis_ext);
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
    const __code = Cell.fromHex('b5ee9c72410251010019fe000114ff00f4a413f4bcf2c80b01020162024a04f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba030d0f1004cc058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544815bae3022082104154481dba0408050600e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54015c30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540804f88eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e02082104154481bba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0208210178d4519bae302208210472d9d7dba0808070a015c30d33ffa00593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540802ea81378c21c200f2f4f84210685e34103748705280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305167a0f8285220c705b3941028375be30d104555124509006e7080400a7f0ac8598210415448135003cb1fcb3fcb7fc9134a4019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104503fc8eb830d33fd39f5932813800f84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821089129d60ba8eb830d33fd39f59328138eaf84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e00c0c0b01868210a11a7002ba8eb7d33fd39f593281394ef84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f070c03a655515376db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2813801216eb3f2f46f25135f0355512981380209db3c29ba18f2f4104810374614403305db3c4d473f01fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa020e0052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103555123a043ce30221821041544814bae3022182104154481cbae3022182104154481aba1113171b04d25b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f4820adc6c0081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1555029db3c705410b5db3c5551547a9b2f2341501201fedb3c5159a17f541ba5700fc855308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c47b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010354044c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed544404fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4555129db3c705410b523144115003082080f4240a082080f4240a082086acfc0a08209312d00a003fedb3c5551547dcb2ddb3c515ca150dc7f7126544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104d103e4a80103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f03504416014e01a11047104610354440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed542104fe5b05d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422cc705f2f48138d7535bc705f2f4105b104a103948cd53badb3c55408138d85169db3c17f2f48138d927c200f2f48138da2ac200f2f48138db5357bef2f48138dc2a8209c9c380bef2f4550429db3c208208989680a08138ddf8416f24135f0322bef2f455512d23371d1804f4db3c705410f5db3c5551547baf5611db3c515aa1103b102a7f7126045611040311110302111002011114011115c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc9106c105c104a10394a90103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf814150441902668ae2f400c901fb00f8416f24135f035006a146505e21db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed541a21001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba1c22252704fc5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422fc705f2f481393b538ec705f2f4105e104d103c102b1110541f0828db3c554081393c516fdb3c17f2f481393d2ac200f2f481393e27c200f2f481393f535abef2f4813940278209c9c380bef2f4550426db3c208208989680a081394123371d1e003c82082dc6c0a082080f4240a082086acfc0a08209312d00a082081e8480a00486f8416f24135f0322bef2f455512adb3c705410c5db3c5551547edc2edb3c515da1106e105d7f71536d07106e05111605041115040311140302111302011117011118c84150441f02e055a0db3cc91035104a10394180103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110471045103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed542021005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe5b05d33ffa00fa40fa40f40431fa0081396cf8422ac705f2f410591048103746ab5376db3c81396d29c200f2f481396e5369bef2f481396f2bc000917f972b8209c9c380bee2f2f48209c9c3802ba08209406f40a082081e8480a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1555028db3c705410a5234124035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f4550437373703f0db3c5551547cba2cdb3c515ba14cb07f70264c13011110011111c855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec9106810581047103b4870103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0055200450443a02fe5b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382098cba80bef2f45134a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407107704126009e07c8598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010455512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba282c313404c65b05d33ffa00fa40fa40fa0081397625c200f2f4813977f842105b104a103948cd2bdb3c1ec7051cf2f455030a81397851cadb3c1df2f427c2008e1a363881397df8416f24135f0382095ef3c0bef2f45128a0074414e30df842107846504a405441aa4137292a00cc813979288209c9c380bef2f481397af8416f24135f032982080f4240a082086acfc0a0bef2f4514aa0717027544d3a1dc8553082107362d09c5005cb1f13cb3f01fa02cecec9245139034c9c441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001e8db3cf8416f24135f030982080f4240a082080f4240a019be8e3782080f4240717009c8018210d53276db58cb1fcb3fc91048413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001034923535e245334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed542b006c82080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0004fa5b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a08209312d00a0bef2f410354014503b541a0a2adb3c555053b6db3c8137eb2441474d2d01fc8101012359f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da081010182080f4240f8232e544e30561201c855405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544d9052fec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec910492e02fc10384b70441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053abc8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407109700bc8598210415448115003cb1fcb3fcb7fc9443049a0441359c8cf8580ca00892f30000110005acf16ce01fa02806acf40f400c901fb004430c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404f45b05d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842105d104c103b4aef27db3c01111001c7051ef2f48138e22cc200f2f48138e3f8416f24135f032d82082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030c8138e451ebdb3c1ff2f45504543d7ddb3c555053864137473202f8db3c8138e5248101012359f40c6fa131b3f2f48138e62e8209c9c380bef2f48138e7238101012359f40c6fa131b3f2f45168a081010182082dc6c0f823561203021112020111120152c01113c855405045ce12cecb3fcb7fcb3fc910344f70206e953059f45a30944133f415e2717f295159105904031111034edcc84d3301f05560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07cec9544114103a4c99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00400305043a04f8e30221821041544811ba8f6e5b05d33fd37f308137a021c200f2f4f84210671056104510344880db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137a1216eb3f2f46f2430318137a20aba19f2f48137a3f8425009c70518f2f416810101f45a30104510344130e02135453a3b02fe5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f84205111005104f103e102d0111110111122adb3c01111301c70501111101f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030f813948111126413604fcdb3c01111201f2f45504111053a8db3c555053b6db3c813949248101012359f40c6fa131b3f2f481394a298209c9c380bef2f481394b238101012359f40c6fa131b3f2f4516ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb3fc910344a70206e953059f45a30944133f415e2717f2c08517c0737474d38000afa4430c00001fe106c05111405041113040311120302111102011110010fc855908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc92643144a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430390072441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0044145053c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404c48210472d9d7ebae3022182104154481eba8ebb5b05d33fd37fd39f3081380af84227c705f2f41068105710461035103401db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0218210504e5052bae3023720821041544807ba3c3f464904f65b05d33fd37fd39f30813804f84227c705f2f481380522c200f2f410561046103646785368db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206ee3026f2530813807511dbaf2f410591048103746982a81380808db3c500dba16f2f48101015415005467c04d3d473e0090303738810101530150884133f40c6fa19401d70030925b6de2813806216eb3f2f481380907ba16f2f445334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400dc216e955b59f45a3098c801cf004133f442e25054810101f45a307108700ac8598210415448115003cb1fcb3fcb7fc9104710364890441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003444405c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403f68137fa21c200f2f455525387db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53bcbef2f48137fd511cbaf2f455448137fe543ad8db3c2dba1bf2f4514aa150888101014d474004f2f45a3010574014541386db3c705385db3c10685e3410374870545ee9db3c539b82082dc6c0ba955b3839f8288e3d717011112fc8598210415448135003cb1fcb3fcb7fc9104d103e1201111101441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00090c0807e21046103544304970546cb052b041504243016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0500030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01c4db3c707f541db680400bc855308210415448125005cb1f13cb3fcb7fcecec91069105c104a103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb004105044401901069105810471039487927db3c813796228101012359f40c6fa131b3f2f4810101f82310394ba0c855305034cececb7fcb3fc910364780206e953059f45a30944133f415e2454012450026c8821041544f4701cb1f12cb3f01cf16c9f90003f65b05d33fd39f3081380df8416f24135f0382081e8480bef2f454167628db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e281380e216eb3f2f46f2533106a1059104810374a9b81380f08db3c500cba16f2f4813810f8230982015180a019be18f2f4813811064d4748002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f009882082dc6c0bd16f2f48101012010345445135099216e955b59f45a3098c801cf004133f442e25024810101f45a30403305c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ae8e21303510355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0c00006c12116b08e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c0820201484b4e017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c6584c0178db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e983070705456002802e06f25327f0443134d0002310179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c6484f0116705354db3c305466605260500026f82ac87001ca0055215023810101cf00cecec948051fdc');
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
    {"name":"AthTransferNotification","header":1194171773,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AthTransferNotificationAck","header":1194171774,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}}]},
    {"name":"AthTransferNotificationRefund","header":1096042526,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}}]},
    {"name":"PruneStaleNotification","header":1347309650,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}}]},
    {"name":"AthTransferNotificationVaultMintUsername","header":2299698528,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"payer_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"AthTransferNotificationVaultProfileAvatar","header":2702864386,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"payer_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHTransferRequest","header":1096042512,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHTransferRequestWithNotify","header":1096042516,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferRequestVaultProfileAvatar","header":1096042522,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHTransferRequestVaultMintUsername","header":1096042524,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHInternalTransfer","header":1096042514,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ATHInternalTransferWithNotify","header":1096042517,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHInternalTransferVaultProfileAvatar","header":1096042523,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"avatar_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"avatar_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"avatar_stream_id","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"avatar_part_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"media_format","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"ATHInternalTransferVaultMintUsername","header":1096042525,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"notify_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ATHTransferAck","header":1096042513,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ATHTransferFailed","header":1096042515,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"JettonTransfer","header":260734629,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"custom_payload","type":{"kind":"simple","type":"cell","optional":true}},{"name":"forward_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonInternalTransfer","header":395134233,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"from","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"forward_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonTransferNotification","header":1935855772,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"JettonExcesses","header":3576854235,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ATHWalletTopUpStorageReserve","header":1096042503,"fields":[]},
    {"name":"ATHWalletDataView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"jetton_wallet_code","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PendingAthTransferNotificationView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_ack_value","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthOutgoingTransfer","header":null,"fields":[{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"processed_notifications","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_outgoing_transfers","type":{"kind":"dict","key":"int","value":"PendingAthOutgoingTransfer","valueFormat":"ref"}}]},
    {"name":"BindDeploymentManifest","header":2430787787,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"counterpart_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindOfficialAthWallet","header":417017035,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindProfileRegistry","header":1353060611,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindUsernameRegistry","header":1353060612,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"DepositTon","header":716160408,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"RegisterMessagingKeys","header":1383096026,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"ReplaceMessagingKeys","header":2312521915,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"WithdrawTonFromVaultBalance","header":2115981368,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"WithdrawAthFromVaultBalance","header":2115981369,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"SetProfileAvatarFromVaultBalance","header":2115981363,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"MintUsernameFromVaultBalance","header":2115981364,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"PublishBatchFromVaultBalance","header":2115981377,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"PublishBatchToHub","header":2767741649,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"protocol_fee_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"parts","type":{"kind":"simple","type":"cell","optional":false}},{"name":"marketing","type":{"kind":"simple","type":"cell","optional":true}}]},
    {"name":"CapsuleHubBatchAck","header":2270058353,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"first_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"batch_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PruneBatchPublish","header":1913380206,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PruneStuckAthPending","header":1913380207,"fields":[{"name":"kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"AnnounceSuccessorManifest","header":1398096717,"fields":[{"name":"successor_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"successor_vault","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TopUpStorageReserve","header":840283645,"fields":[]},
    {"name":"EvictDormantUser","header":1163281492,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ProfileAvatarTonExcessRefund","header":1353060641,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PendingAthWithdrawal","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingBatchPublish","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"refund_to_vault","type":{"kind":"simple","type":"bool","optional":false}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"refundable_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingProfileAvatarPayment","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingUsernameMintPayment","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ReceiptSlot","header":null,"fields":[{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"action","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"result","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"aux","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UserState","header":null,"fields":[{"name":"ton_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_active","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receipts","type":{"kind":"dict","key":"uint","keyFormat":8,"value":"ReceiptSlot","valueFormat":"ref"}}]},
    {"name":"VaultKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"ton_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"auth_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_active","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultStorageHealthView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"storage_reserve","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"surplus","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserReceiptsView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"publish_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receipts","type":{"kind":"dict","key":"uint","keyFormat":8,"value":"ReceiptSlot","valueFormat":"ref"}}]},
    {"name":"VaultPendingAthWithdrawalView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultSuccessorView","header":null,"fields":[{"name":"announced","type":{"kind":"simple","type":"bool","optional":false}},{"name":"successor_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"successor_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"announced_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultPendingBatchPublishView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_kind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"part_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"profile_registry_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"username_registry_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_profile_avatar_payment_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_username_mint_payment_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_distributed_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_reward_per_message_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_total_allocation_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"Vault$Data","header":null,"fields":[{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"binding_flags","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"users","type":{"kind":"dict","key":"address","value":"UserState","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}},{"name":"processed_ath_deposits","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_ath_withdrawals","type":{"kind":"dict","key":"int","value":"PendingAthWithdrawal","valueFormat":"ref"}},{"name":"pending_batch_publishes","type":{"kind":"dict","key":"int","value":"PendingBatchPublish","valueFormat":"ref"}},{"name":"pending_profile_avatar_payments","type":{"kind":"dict","key":"int","value":"PendingProfileAvatarPayment","valueFormat":"ref"}},{"name":"pending_username_mint_payments","type":{"kind":"dict","key":"int","value":"PendingUsernameMintPayment","valueFormat":"ref"}},{"name":"user_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_publish_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"genesis_ext","type":{"kind":"simple","type":"cell","optional":false}}]},
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
    "AthTransferNotificationRefund": 1096042526,
    "PruneStaleNotification": 1347309650,
    "AthTransferNotificationVaultMintUsername": 2299698528,
    "AthTransferNotificationVaultProfileAvatar": 2702864386,
    "ATHTransferRequest": 1096042512,
    "ATHTransferRequestWithNotify": 1096042516,
    "ATHTransferRequestVaultProfileAvatar": 1096042522,
    "ATHTransferRequestVaultMintUsername": 1096042524,
    "ATHInternalTransfer": 1096042514,
    "ATHInternalTransferWithNotify": 1096042517,
    "ATHInternalTransferVaultProfileAvatar": 1096042523,
    "ATHInternalTransferVaultMintUsername": 1096042525,
    "ATHTransferAck": 1096042513,
    "ATHTransferFailed": 1096042515,
    "JettonTransfer": 260734629,
    "JettonInternalTransfer": 395134233,
    "JettonTransferNotification": 1935855772,
    "JettonExcesses": 3576854235,
    "ATHWalletTopUpStorageReserve": 1096042503,
    "BindDeploymentManifest": 2430787787,
    "BindOfficialAthWallet": 417017035,
    "BindProfileRegistry": 1353060611,
    "BindUsernameRegistry": 1353060612,
    "SealGenesis": 974311853,
    "DepositTon": 716160408,
    "RegisterMessagingKeys": 1383096026,
    "ReplaceMessagingKeys": 2312521915,
    "WithdrawTonFromVaultBalance": 2115981368,
    "WithdrawAthFromVaultBalance": 2115981369,
    "SetProfileAvatarFromVaultBalance": 2115981363,
    "MintUsernameFromVaultBalance": 2115981364,
    "PublishBatchFromVaultBalance": 2115981377,
    "PublishBatchToHub": 2767741649,
    "CapsuleHubBatchAck": 2270058353,
    "PruneBatchPublish": 1913380206,
    "PruneStuckAthPending": 1913380207,
    "AnnounceSuccessorManifest": 1398096717,
    "TopUpStorageReserve": 840283645,
    "EvictDormantUser": 1163281492,
    "ProfileAvatarTonExcessRefund": 1353060641,
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
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferRequestVaultMintUsername"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferRequestVaultProfileAvatar"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonTransfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"JettonInternalTransfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransferWithNotify"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransferVaultMintUsername"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHInternalTransferVaultProfileAvatar"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotificationAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotificationRefund"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PruneStaleNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHWalletTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_VAULT_RESPONSE_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1000000n;
export const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 21000000n;
export const ATH_VAULT_PROFILE_AVATAR_FWD_FEE_ALLOWANCE = 2000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30000000n;
export const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 20000000n;
export const ATH_INTERNAL_TRANSFER_EXEC_RESERVE = 2000000n;
export const ATH_BURN_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_TRANSFER_NOTIFY_EXEC_RESERVE = 7000000n;
export const ATH_PRUNE_NOTIFICATION_EXEC_RESERVE = 2000000n;
export const ATH_OWNER_REQUEST_EXEC_RESERVE = 2000000n;
export const ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE = 10000000n;
export const ATH_OWNER_EXCESS_REFUND_MIN_VALUE = 100000n;
export const ATH_GENESIS_SUPPLY_EXEC_RESERVE = 2000000n;
export const ATH_GENESIS_SUPPLY_ACK_VALUE = 1000000n;
export const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 1096044105n;
export const ATH_OUTGOING_TRANSFER_ID_DOMAIN = 1096044359n;
export const ATH_NOTIFY_REFUND_QUERY_DOMAIN = 1096045126n;
export const ATH_QUERY_ID_MOD = 18446744073709551616n;
export const ATH_SENDER_KEY_MOD = 1461501637330902918203684832716283019655932542976n;
export const ATH_PENDING_NOTIFICATION_TTL = 86400n;
export const JETTON_EXCESSES_VALUE = 1000000n;
export const VAULT_USER_STATE_STORAGE_ENDOWMENT = 10000000n;
export const VAULT_KEY_RECORD_STANDARD_STORAGE_ENDOWMENT = 5000000n;
export const VAULT_KEY_RECORD_LONG_TERM_STORAGE_ENDOWMENT = 30000000n;
export const VAULT_PENDING_PUBLISH_STALE_TTL = 86400n;
export const VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL = 86400n;
export const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE = 2000000n;
export const VAULT_DEPOSIT_TON_EXEC_RESERVE = 2000000n;
export const VAULT_STATE_GROWTH_EXEC_RESERVE = 2000000n;
export const VAULT_ATH_NOTIFICATION_ACK_VALUE = 1000000n;
export const VAULT_ATH_WITHDRAW_MIN_VALUE = 58000000n;
export const VAULT_WITHDRAW_TON_EXEC_RESERVE = 2000000n;
export const VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE = 2000000n;
export const ASSET_TON = 1n;
export const ASSET_ATH = 2n;
export const VAULT_WITHDRAW_TON_SIGNING_DOMAIN = 1448367921n;
export const VAULT_WITHDRAW_ATH_SIGNING_DOMAIN = 1448558897n;
export const VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN = 1448233777n;
export const VAULT_PENDING_PUBLISH_COUNT_UNIT = 1n;
export const VAULT_PENDING_PROFILE_COUNT_UNIT = 4294967296n;
export const VAULT_PENDING_USERNAME_COUNT_UNIT = 281474976710656n;
export const VAULT_PENDING_PROFILE_COUNT_MOD = 65536n;
export const VAULT_PENDING_PROFILE_COUNT_MAX = 65535n;
export const VAULT_PENDING_USERNAME_COUNT_MAX = 65535n;
export const CRYPTO_SUITE_HYBRID = 2n;
export const MLKEM768_PUBKEY_LEN = 1184n;
export const MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES = 127n;
export const MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES = 41n;
export const MLKEM768_PUBKEY_SNAKE_CELLS = 10n;
export const MLKEM768_PUBKEY_SNAKE_BITS = 9472n;
export const MLKEM768_PUBKEY_SNAKE_REFS = 9n;
export const UINT64_MAX = 18446744073709551615n;
export const UINT64_MOD = 18446744073709551616n;
export const UINT128_MOD = 340282366920938463463374607431768211456n;
export const UINT160_MOD = 1461501637330902918203684832716283019655932542976n;
export const UINT32_MAX = 4294967295n;
export const ATH_DEPOSIT_ID_DOMAIN = 1094996041n;
export const ATH_WITHDRAWAL_ID_DOMAIN = 1096239428n;
export const KEY_ID_DOMAIN = 1262836041n;
export const PUBLISH_KIND_PRIVATE = 1n;
export const PUBLISH_KIND_PUBLIC = 2n;
export const PUBLISH_KIND_INTRO = 3n;
export const PUBLISH_KIND_RECOVERY = 4n;
export const RECOVERY_MAX_SIZE_CLASS = 8n;
export const VAULT_BATCH_PUBLISH_SIGNING_DOMAIN = 1448100402n;
export const VAULT_BATCH_PUBLISH_ID_DOMAIN = 1112557873n;
export const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN = 1162889521n;
export const VAULT_PROFILE_AVATAR_SIGNING_DOMAIN = 1448100145n;
export const VAULT_PROFILE_AVATAR_PAYMENT_ID_DOMAIN = 1448100169n;
export const VAULT_USERNAME_MINT_SIGNING_DOMAIN = 1448431153n;
export const VAULT_USERNAME_MINT_PAYMENT_ID_DOMAIN = 1448431177n;
export const SIZE_CLASS_1K = 1n;
export const SIZE_CLASS_2K = 2n;
export const SIZE_CLASS_4K = 4n;
export const SIZE_CLASS_8K = 8n;
export const SIZE_CLASS_16K = 16n;
export const SIZE_CLASS_32K = 32n;
export const CRYPTO_SUITE_PUBLIC_NONE = 0n;
export const PLATO_MIN_PROTOCOL_FEE_TON = 0n;
export const PLATHO_PUBLIC_MARKETING_NOTE_ASCII = 2573421624129493433291659589718684717235138672n;
export const ATH_FULL_DISCOUNT_AMOUNT = 10000000000000n;
export const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH = 15000000000000000n;
export const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH = 0n;
export const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10000000000n;
export const CAPSULEHUB_CONV_HEADER0_BITS = 320n;
export const CAPSULEHUB_INTRO_HEADER0_BITS = 336n;
export const CAPSULEHUB_PRIVATE_HEADER1_BITS = 240n;
export const CAPSULEHUB_PRIVATE_HEADER0_CELLS = 1n;
export const CAPSULEHUB_PRIVATE_HEADER0_REFS = 0n;
export const CAPSULEHUB_PRIVATE_HEADER1_CELLS = 1n;
export const CAPSULEHUB_PRIVATE_HEADER1_REFS = 0n;
export const CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES = 1204n;
export const CAPSULEHUB_INTRO_HYBRID_BODY_OVERHEAD_BYTES = 2388n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS = 576n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS = 1n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS = 0n;
export const PROFILE_AVATAR_PRICE_ATH = 100000000000n;
export const PROFILE_AVATAR_NOTIFY_VALUE = 66000000n;
export const PROFILE_AVATAR_MAX_PARTS = 2n;
export const PROFILE_AVATAR_MEDIA_FORMAT_WEBP = 1n;
export const VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE = 6000000n;
export const VAULT_PROFILE_AVATAR_ATH_WALLET_REQUEST_VALUE = 109000000n;
export const VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE = 2000000n;
export const USERNAME_PRICE_4_CHARS = 10000000000000n;
export const USERNAME_PRICE_5_CHARS = 1000000000000n;
export const USERNAME_PRICE_6_PLUS_CHARS = 100000000000n;
export const USERNAME_NOTIFY_VALUE = 951000000n;
export const USERNAME_MAX_LENGTH = 16n;
export const USERNAME_NAME_HASH_DOMAIN = 3318512854n;
export const VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE = 6000000n;
export const VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE = 994000000n;
export const VAULT_BINDING_CAPSULE_HUB = 1n;
export const VAULT_BINDING_PROFILE_REGISTRY = 2n;
export const VAULT_BINDING_USERNAME_REGISTRY = 4n;
export const OP_BIND_DEPLOYMENT_MANIFEST = 2430787787n;
export const OP_BIND_OFFICIAL_ATH_WALLET = 417017035n;
export const OP_BIND_PROFILE_REGISTRY = 1353060611n;
export const OP_BIND_USERNAME_REGISTRY = 1353060612n;
export const OP_SEAL_GENESIS = 974311853n;
export const RECEIPT_RING_K = 20n;
export const ACT_WITHDRAW_TON = 1n;
export const ACT_WITHDRAW_ATH = 2n;
export const ACT_REPLACE_KEYS = 3n;
export const ACT_PUBLISH_BATCH = 7n;
export const ACT_SET_AVATAR = 8n;
export const ACT_MINT_USERNAME = 9n;
export const RES_PROCESSING = 0n;
export const RES_CONFIRMED = 1n;
export const RES_BOUNCED_REFUNDED = 2n;
export const RES_TOMBSTONED = 3n;
export const AUX_BATCH_LEVEL = 18446744073709551615n;
export const MAX_BATCH_PARTS = 8n;
export const VPB2_VERSION = 1n;
export const EXT_HARD_CELLS = 8192n;
export const EXT_HARD_BITS = 524280n;
export const HUB_BATCH_MSG_ROOT_BITS = 924n;
export const ACK_MIN_FORWARD = 30000000n;
export const BATCH_FLOOR_BASE_PIN = 92700000n;
export const BATCH_FLOOR_PER_PART_PIN = 6200000n;
export const PROTOCOL_FEE_TON_BATCH = 10000000n;
export const STORAGE_RESERVE_PRIVATE = 4300000n;
export const STORAGE_RESERVE_PUBLIC = 10400000n;
export const STORAGE_RESERVE_INTRO = 3000000n;
export const STORAGE_RESERVE_RECOVERY = 201000000n;
export const VAULT_DORMANT_EVICTION_SECONDS = 63072000n;
export const VAULT_BATCH_BASE_GAS = 50000n;
export const VAULT_PART_GAS_PRIVATE = 90000n;
export const VAULT_PART_GAS_PUBLIC = 90000n;
export const VAULT_PART_GAS_INTRO = 90000n;
export const VAULT_PART_GAS_RECOVERY = 90000n;
export const HUB_BATCH_BASE_GAS = 14000n;
export const HUB_PART_GAS_PRIVATE = 170000n;
export const HUB_PART_GAS_PUBLIC = 180000n;
export const HUB_PART_GAS_INTRO = 120000n;
export const HUB_PART_GAS_RECOVERY = 150000n;
export const WALK_GAS_PER_PART_MAX = 90000n;
export const REJECT_BASE_GAS = 10000n;
export const ACK_GAS = 9000n;
export const RJ_PART_SHAPE = 17n;
export const RJ_CLASS_OR_SUITE = 18n;
export const RJ_HASH_MISMATCH = 19n;
export const RJ_PAYLOAD_SHAPE = 20n;
export const RJ_DUPLICATE_ADJACENT = 21n;
export const RJ_UNDERPRICED = 22n;
export const RJ_BINDING = 23n;
export const RJ_ID_ZERO = 24n;
export const RJ_PENDING_COLLISION = 25n;

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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: ATHBurn | ATHGenesisSupplyCredit | ATHTransferRequest | ATHTransferRequestWithNotify | ATHTransferRequestVaultMintUsername | ATHTransferRequestVaultProfileAvatar | JettonTransfer | ATHInternalTransfer | JettonInternalTransfer | ATHInternalTransferWithNotify | ATHInternalTransferVaultMintUsername | ATHInternalTransferVaultProfileAvatar | ATHTransferAck | AthTransferNotificationAck | AthTransferNotificationRefund | PruneStaleNotification | ATHWalletTopUpStorageReserve | null) {
        
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferRequestVaultMintUsername') {
            body = beginCell().store(storeATHTransferRequestVaultMintUsername(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferRequestVaultProfileAvatar') {
            body = beginCell().store(storeATHTransferRequestVaultProfileAvatar(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'JettonTransfer') {
            body = beginCell().store(storeJettonTransfer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransfer') {
            body = beginCell().store(storeATHInternalTransfer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'JettonInternalTransfer') {
            body = beginCell().store(storeJettonInternalTransfer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransferWithNotify') {
            body = beginCell().store(storeATHInternalTransferWithNotify(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransferVaultMintUsername') {
            body = beginCell().store(storeATHInternalTransferVaultMintUsername(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHInternalTransferVaultProfileAvatar') {
            body = beginCell().store(storeATHInternalTransferVaultProfileAvatar(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferAck') {
            body = beginCell().store(storeATHTransferAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotificationAck') {
            body = beginCell().store(storeAthTransferNotificationAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotificationRefund') {
            body = beginCell().store(storeAthTransferNotificationRefund(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PruneStaleNotification') {
            body = beginCell().store(storePruneStaleNotification(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHWalletTopUpStorageReserve') {
            body = beginCell().store(storeATHWalletTopUpStorageReserve(message)).endCell();
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