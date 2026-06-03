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
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    const _sender_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _response_ack_value = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
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
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthOutgoingTransfer(slice: Slice) {
    const sc_0 = slice;
    const _recipient_wallet = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
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
}

export function storeReplaceMessagingKeys(src: ReplaceMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2312521915, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadReplaceMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2312521915) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'ReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTupleReplaceMessagingKeys(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'ReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTupleReplaceMessagingKeys(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'ReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTupleReplaceMessagingKeys(source: ReplaceMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
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
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
}

export function storeCreateReceiveIntent(src: CreateReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981365, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadCreateReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981365) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'CreateReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTupleCreateReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'CreateReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTupleCreateReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'CreateReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTupleCreateReceiveIntent(source: CreateReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
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
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
}

export function storeClaimReceiveIntent(src: ClaimReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981366, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadClaimReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981366) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'ClaimReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTupleClaimReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'ClaimReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTupleClaimReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'ClaimReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTupleClaimReceiveIntent(source: ClaimReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
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
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
}

export function storeCancelReceiveIntent(src: CancelReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981367, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadCancelReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981367) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'CancelReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTupleCancelReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'CancelReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTupleCancelReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'CancelReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTupleCancelReceiveIntent(source: CancelReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
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

export type PublishPrivateFromVaultBalance = {
    $$type: 'PublishPrivateFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
}

export function storePublishPrivateFromVaultBalance(src: PublishPrivateFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981361, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadPublishPrivateFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981361) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'PublishPrivateFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTuplePublishPrivateFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'PublishPrivateFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTuplePublishPrivateFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'PublishPrivateFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTuplePublishPrivateFromVaultBalance(source: PublishPrivateFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    return builder.build();
}

export function dictValueParserPublishPrivateFromVaultBalance(): DictionaryValue<PublishPrivateFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPrivateFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPrivateFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type PublishPublicFromVaultBalance = {
    $$type: 'PublishPublicFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
}

export function storePublishPublicFromVaultBalance(src: PublishPublicFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981362, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadPublishPublicFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981362) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'PublishPublicFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTuplePublishPublicFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'PublishPublicFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTuplePublishPublicFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'PublishPublicFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTuplePublishPublicFromVaultBalance(source: PublishPublicFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    return builder.build();
}

export function dictValueParserPublishPublicFromVaultBalance(): DictionaryValue<PublishPublicFromVaultBalance> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPublicFromVaultBalance(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPublicFromVaultBalance(src.loadRef().beginParse());
        }
    }
}

export type SetProfileAvatarFromVaultBalance = {
    $$type: 'SetProfileAvatarFromVaultBalance';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
}

export function storeSetProfileAvatarFromVaultBalance(src: SetProfileAvatarFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981363, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadSetProfileAvatarFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981363) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'SetProfileAvatarFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTupleSetProfileAvatarFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'SetProfileAvatarFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTupleSetProfileAvatarFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'SetProfileAvatarFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTupleSetProfileAvatarFromVaultBalance(source: SetProfileAvatarFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
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
}

export function storeMintUsernameFromVaultBalance(src: MintUsernameFromVaultBalance) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981364, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
    };
}

export function loadMintUsernameFromVaultBalance(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981364) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    return { $$type: 'MintUsernameFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadTupleMintUsernameFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'MintUsernameFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function loadGetterTupleMintUsernameFromVaultBalance(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    return { $$type: 'MintUsernameFromVaultBalance' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload };
}

export function storeTupleMintUsernameFromVaultBalance(source: MintUsernameFromVaultBalance) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
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

export type PublishPrivateFromVault = {
    $$type: 'PublishPrivateFromVault';
    bounce_id: bigint;
    bounce_tag: bigint;
    publish_id: bigint;
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    protocol_fee_paid: bigint;
}

export function storePublishPrivateFromVault(src: PublishPrivateFromVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2767741632, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.header_1_hash, 256);
        b_1.storeUint(src.body_hash, 256);
        b_1.storeRef(src.header_0);
        b_1.storeRef(src.header_1);
        b_1.storeRef(src.body);
        b_1.storeUint(src.protocol_fee_paid, 128);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublishPrivateFromVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2767741632) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_1_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPrivateFromVault(source: PublishPrivateFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
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
    bounce_tag: bigint;
    publish_id: bigint;
    marketing_note: bigint;
    author_wallet: Address;
    header_hash: bigint;
    body_hash: bigint;
    header: Cell;
    body: Cell;
    protocol_fee_paid: bigint;
}

export function storePublishPublicFromVault(src: PublishPublicFromVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2351593143, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.marketing_note, 152);
        b_0.storeAddress(src.author_wallet);
        const b_1 = new Builder();
        b_1.storeUint(src.header_hash, 256);
        b_1.storeUint(src.body_hash, 256);
        b_1.storeRef(src.header);
        b_1.storeRef(src.body);
        b_1.storeUint(src.protocol_fee_paid, 128);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublishPublicFromVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2351593143) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _marketing_note = sc_0.loadUintBig(152);
    const _author_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicFromVault(source: PublishPublicFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.marketing_note);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header);
    builder.writeCell(source.body);
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
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeUint(src.amount, 128);
        const b_1 = new Builder();
        b_1.storeUint(src.refundable_ton_amount, 128);
        b_1.storeUint(src.created_at, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingAthWithdrawal(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _recipient = sc_0.loadAddress();
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _refundable_ton_amount = sc_1.loadUintBig(128);
    const _created_at = sc_1.loadUintBig(32);
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, refundable_ton_amount: _refundable_ton_amount, created_at: _created_at };
}

export function loadTuplePendingAthWithdrawal(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _refundable_ton_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, refundable_ton_amount: _refundable_ton_amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthWithdrawal(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _recipient = source.readAddress();
    const _recipient_ath_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _refundable_ton_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthWithdrawal' as const, owner_wallet: _owner_wallet, recipient: _recipient, recipient_ath_wallet: _recipient_ath_wallet, amount: _amount, refundable_ton_amount: _refundable_ton_amount, created_at: _created_at };
}

export function storeTuplePendingAthWithdrawal(source: PendingAthWithdrawal) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
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

export type PendingPublish = {
    $$type: 'PendingPublish';
    owner_wallet: Address;
    tombstone: boolean;
    refund_to_vault: boolean;
    nonce: bigint;
    publish_kind: bigint;
    body_hash: bigint;
    refundable_amount: bigint;
    created_at: bigint;
}

export function storePendingPublish(src: PendingPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBit(src.tombstone);
        b_0.storeBit(src.refund_to_vault);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.publish_kind, 8);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.refundable_amount, 128);
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingPublish(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _tombstone = sc_0.loadBit();
    const _refund_to_vault = sc_0.loadBit();
    const _nonce = sc_0.loadUintBig(64);
    const _publish_kind = sc_0.loadUintBig(8);
    const _body_hash = sc_0.loadUintBig(256);
    const _refundable_amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, refund_to_vault: _refund_to_vault, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function loadTuplePendingPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _refund_to_vault = source.readBoolean();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _refundable_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, refund_to_vault: _refund_to_vault, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function loadGetterTuplePendingPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _refund_to_vault = source.readBoolean();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _refundable_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, refund_to_vault: _refund_to_vault, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function storeTuplePendingPublish(source: PendingPublish) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.tombstone);
    builder.writeBoolean(source.refund_to_vault);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.publish_kind);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.refundable_amount);
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

export type PendingProfileAvatarPayment = {
    $$type: 'PendingProfileAvatarPayment';
    owner_wallet: Address;
    amount: bigint;
    created_at: bigint;
}

export function storePendingProfileAvatarPayment(src: PendingProfileAvatarPayment) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingProfileAvatarPayment(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingProfileAvatarPayment' as const, owner_wallet: _owner_wallet, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingProfileAvatarPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarPayment' as const, owner_wallet: _owner_wallet, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingProfileAvatarPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingProfileAvatarPayment' as const, owner_wallet: _owner_wallet, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingProfileAvatarPayment(source: PendingProfileAvatarPayment) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
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
    amount: bigint;
    created_at: bigint;
}

export function storePendingUsernameMintPayment(src: PendingUsernameMintPayment) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingUsernameMintPayment(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingUsernameMintPayment' as const, owner_wallet: _owner_wallet, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingUsernameMintPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintPayment' as const, owner_wallet: _owner_wallet, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingUsernameMintPayment(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintPayment' as const, owner_wallet: _owner_wallet, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingUsernameMintPayment(source: PendingUsernameMintPayment) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
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

export type ReceiveIntent = {
    $$type: 'ReceiveIntent';
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: bigint;
    amount: bigint;
    commitment: bigint;
    client_nonce: bigint;
    settlement_reserve_ton: bigint;
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
        b_0.storeUint(src.client_nonce, 64);
        const b_1 = new Builder();
        b_1.storeUint(src.settlement_reserve_ton, 128);
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
    const _client_nonce = sc_0.loadUintBig(64);
    const sc_1 = sc_0.loadRef().beginParse();
    const _settlement_reserve_ton = sc_1.loadUintBig(128);
    const _created_at = sc_1.loadUintBig(32);
    const _claimed = sc_1.loadBit();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, settlement_reserve_ton: _settlement_reserve_ton, created_at: _created_at, claimed: _claimed };
}

export function loadTupleReceiveIntent(source: TupleReader) {
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _settlement_reserve_ton = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, settlement_reserve_ton: _settlement_reserve_ton, created_at: _created_at, claimed: _claimed };
}

export function loadGetterTupleReceiveIntent(source: TupleReader) {
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _settlement_reserve_ton = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, settlement_reserve_ton: _settlement_reserve_ton, created_at: _created_at, claimed: _claimed };
}

export function storeTupleReceiveIntent(source: ReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sender_wallet);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.commitment);
    builder.writeNumber(source.client_nonce);
    builder.writeNumber(source.settlement_reserve_ton);
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
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    const _created_at = sc_1.loadUintBig(32);
    const _created_lt = sc_1.loadUintBig(64);
    const _revoked_at = sc_1.loadUintBig(32);
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

export type UserState = {
    $$type: 'UserState';
    ton_balance: bigint;
    ath_balance: bigint;
    current_key_id: bigint;
    auth_pubkey: bigint;
    publish_nonce: bigint;
}

export function storeUserState(src: UserState) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.ton_balance, 128);
        b_0.storeUint(src.ath_balance, 128);
        b_0.storeUint(src.current_key_id, 256);
        b_0.storeUint(src.auth_pubkey, 256);
        b_0.storeUint(src.publish_nonce, 64);
    };
}

export function loadUserState(slice: Slice) {
    const sc_0 = slice;
    const _ton_balance = sc_0.loadUintBig(128);
    const _ath_balance = sc_0.loadUintBig(128);
    const _current_key_id = sc_0.loadUintBig(256);
    const _auth_pubkey = sc_0.loadUintBig(256);
    const _publish_nonce = sc_0.loadUintBig(64);
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce };
}

export function loadTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce };
}

export function loadGetterTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce };
}

export function storeTupleUserState(source: UserState) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.publish_nonce);
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

export type VaultReceiveIntentView = {
    $$type: 'VaultReceiveIntentView';
    exists: boolean;
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: bigint;
    amount: bigint;
    commitment: bigint;
    client_nonce: bigint;
    settlement_reserve_ton: bigint;
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
        b_1.storeInt(src.client_nonce, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.settlement_reserve_ton, 257);
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
    const _client_nonce = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _settlement_reserve_ton = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const _claimed = sc_2.loadBit();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, settlement_reserve_ton: _settlement_reserve_ton, created_at: _created_at, claimed: _claimed };
}

export function loadTupleVaultReceiveIntentView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _settlement_reserve_ton = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, settlement_reserve_ton: _settlement_reserve_ton, created_at: _created_at, claimed: _claimed };
}

export function loadGetterTupleVaultReceiveIntentView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _settlement_reserve_ton = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, settlement_reserve_ton: _settlement_reserve_ton, created_at: _created_at, claimed: _claimed };
}

export function storeTupleVaultReceiveIntentView(source: VaultReceiveIntentView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.sender_wallet);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.commitment);
    builder.writeNumber(source.client_nonce);
    builder.writeNumber(source.settlement_reserve_ton);
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
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce };
}

export function loadTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce };
}

export function loadGetterTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce };
}

export function storeTupleVaultUserView(source: VaultUserView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.publish_nonce);
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
    receive_intent_count: bigint;
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
        b_2.storeInt(src.receive_intent_count, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.pending_ath_withdrawal_count, 257);
        b_3.storeInt(src.pending_publish_count, 257);
        b_3.storeInt(src.pending_profile_avatar_payment_count, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.pending_username_mint_payment_count, 257);
        b_4.storeInt(src.processed_ath_deposit_count, 257);
        b_4.storeInt(src.pending_publish_stale_ttl, 257);
        const b_5 = new Builder();
        b_5.storeInt(src.airdrop_remaining_ath, 257);
        b_5.storeInt(src.airdrop_distributed_ath, 257);
        b_5.storeInt(src.airdrop_reward_per_message_ath, 257);
        const b_6 = new Builder();
        b_6.storeInt(src.airdrop_total_allocation_ath, 257);
        b_5.storeRef(b_6.endCell());
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
    const _receive_intent_count = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_ath_withdrawal_count = sc_3.loadIntBig(257);
    const _pending_publish_count = sc_3.loadIntBig(257);
    const _pending_profile_avatar_payment_count = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _pending_username_mint_payment_count = sc_4.loadIntBig(257);
    const _processed_ath_deposit_count = sc_4.loadIntBig(257);
    const _pending_publish_stale_ttl = sc_4.loadIntBig(257);
    const sc_5 = sc_4.loadRef().beginParse();
    const _airdrop_remaining_ath = sc_5.loadIntBig(257);
    const _airdrop_distributed_ath = sc_5.loadIntBig(257);
    const _airdrop_reward_per_message_ath = sc_5.loadIntBig(257);
    const sc_6 = sc_5.loadRef().beginParse();
    const _airdrop_total_allocation_ath = sc_6.loadIntBig(257);
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, profile_registry_bound: _profile_registry_bound, username_registry_bound: _username_registry_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, pending_profile_avatar_payment_count: _pending_profile_avatar_payment_count, pending_username_mint_payment_count: _pending_username_mint_payment_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
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
    const _receive_intent_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    source = source.readTuple();
    const _pending_publish_count = source.readBigNumber();
    const _pending_profile_avatar_payment_count = source.readBigNumber();
    const _pending_username_mint_payment_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_publish_stale_ttl = source.readBigNumber();
    const _airdrop_remaining_ath = source.readBigNumber();
    const _airdrop_distributed_ath = source.readBigNumber();
    const _airdrop_reward_per_message_ath = source.readBigNumber();
    const _airdrop_total_allocation_ath = source.readBigNumber();
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, profile_registry_bound: _profile_registry_bound, username_registry_bound: _username_registry_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, pending_profile_avatar_payment_count: _pending_profile_avatar_payment_count, pending_username_mint_payment_count: _pending_username_mint_payment_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
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
    const _receive_intent_count = source.readBigNumber();
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
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, profile_registry_bound: _profile_registry_bound, username_registry_bound: _username_registry_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, pending_profile_avatar_payment_count: _pending_profile_avatar_payment_count, pending_username_mint_payment_count: _pending_username_mint_payment_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
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
    builder.writeNumber(source.receive_intent_count);
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
    receive_intents: Dictionary<bigint, ReceiveIntent>;
    processed_ath_deposits: Dictionary<bigint, bigint>;
    pending_ath_withdrawals: Dictionary<bigint, PendingAthWithdrawal>;
    pending_publishes: Dictionary<bigint, PendingPublish>;
    pending_profile_avatar_payments: Dictionary<bigint, PendingProfileAvatarPayment>;
    pending_username_mint_payments: Dictionary<bigint, PendingUsernameMintPayment>;
    user_count: bigint;
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
        b_2.storeDict(src.receive_intents, Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent());
        const b_3 = new Builder();
        b_3.storeDict(src.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_3.storeDict(src.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal());
        b_3.storeDict(src.pending_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingPublish());
        const b_4 = new Builder();
        b_4.storeDict(src.pending_profile_avatar_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment());
        b_4.storeDict(src.pending_username_mint_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment());
        b_4.storeUint(src.user_count, 64);
        b_4.storeUint(src.key_record_count, 64);
        b_4.storeUint(src.receive_intent_count, 64);
        b_4.storeUint(src.processed_ath_deposit_count, 64);
        b_4.storeUint(src.pending_ath_withdrawal_count, 64);
        b_4.storeUint(src.pending_publish_count, 64);
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
    const _receive_intents = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), sc_2);
    const sc_3 = sc_2.loadRef().beginParse();
    const _processed_ath_deposits = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_3);
    const _pending_ath_withdrawals = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), sc_3);
    const _pending_publishes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), sc_3);
    const sc_4 = sc_3.loadRef().beginParse();
    const _pending_profile_avatar_payments = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), sc_4);
    const _pending_username_mint_payments = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), sc_4);
    const _user_count = sc_4.loadUintBig(64);
    const _key_record_count = sc_4.loadUintBig(64);
    const _receive_intent_count = sc_4.loadUintBig(64);
    const _processed_ath_deposit_count = sc_4.loadUintBig(64);
    const _pending_ath_withdrawal_count = sc_4.loadUintBig(64);
    const _pending_publish_count = sc_4.loadUintBig(64);
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
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
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    source = source.readTuple();
    const _pending_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), source.readCellOpt());
    const _pending_profile_avatar_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), source.readCellOpt());
    const _pending_username_mint_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
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
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), source.readCellOpt());
    const _pending_profile_avatar_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), source.readCellOpt());
    const _pending_username_mint_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
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
    builder.writeCell(source.receive_intents.size > 0 ? beginCell().storeDictDirect(source.receive_intents, Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent()).endCell() : null);
    builder.writeCell(source.processed_ath_deposits.size > 0 ? beginCell().storeDictDirect(source.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_ath_withdrawals.size > 0 ? beginCell().storeDictDirect(source.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal()).endCell() : null);
    builder.writeCell(source.pending_publishes.size > 0 ? beginCell().storeDictDirect(source.pending_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingPublish()).endCell() : null);
    builder.writeCell(source.pending_profile_avatar_payments.size > 0 ? beginCell().storeDictDirect(source.pending_profile_avatar_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment()).endCell() : null);
    builder.writeCell(source.pending_username_mint_payments.size > 0 ? beginCell().storeDictDirect(source.pending_username_mint_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment()).endCell() : null);
    builder.writeNumber(source.user_count);
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

 type Vault_init_args = {
    $$type: 'Vault_init_args';
    vault_ath_wallet_address: Address;
    ath_master_address: Address;
    capsule_hub_address: Address;
    genesis_config_hash: bigint;
    capsule_hub_bound: boolean;
    sealed: boolean;
    deployment_manifest_hash: bigint;
}

function initVault_init_args(src: Vault_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.vault_ath_wallet_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.capsule_hub_address);
        const b_1 = new Builder();
        b_1.storeInt(src.genesis_config_hash, 257);
        b_1.storeBit(src.capsule_hub_bound);
        b_1.storeBit(src.sealed);
        b_1.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeRef(b_1.endCell());
    };
}

async function Vault_init(vault_ath_wallet_address: Address, ath_master_address: Address, capsule_hub_address: Address, genesis_config_hash: bigint, capsule_hub_bound: boolean, sealed: boolean, deployment_manifest_hash: bigint) {
    const __code = Cell.fromHex('b5ee9c72420201d500010000a3d700000114ff00f4a413f4bcf2c80b000102012000020103020148000300d20130d001d072d721d200d200fa4021103450666f04f86102f862000403fced44d0d200018e6afa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de5335058e1434229135923214e210248228354a6ba7a18000039136e26d6d6d6d6d6d6d6d7054700053000f11140f0e11130e0f11120f0f11110f0e11100e10efe30d1118e302705617d7492001040005001a047011168020d7217021d749c21f9430d31f01de20821041544810bae3022082104154481abae3022082104154481cbae302208210a4f862c0ba0006000a000c000e02f430d33fd37f5932011117011118db3c813ebcf8425618c705f2f4813ebd5618c200f2f429810101561a59f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813ebe216eb3f2f46f2622813ebf111fba01111e01f2f41116111b11161115111a1115019d000702fe1114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d11170d0c111b0c0b111a0b0a11190a091118090811170807111b0706111a0605111905041118040311170302111b0201111a0111195618db3c03561fa010340281010b5025c855405045cb7f12cb7fcbffcbffcb3fc9102f018d000802fe561a01206e953059f45930944133f413e2f8416f24135f031117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f011114010d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a10394180171615db3c0111170109810101f45a00ae00090174301116a51115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a550701d402f630d33fd37f5932011117011118db3c8140fbf8425618c705f2f48140fc5618c200f2f427810101561a59f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e28140fd216eb3f2f46f23218140fe111cba01111b01f2f41118111a1118111711191117111611181116111511171115111411161114019d000b02761113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035410403db3c00a801d402f630d33fd37f5932011117011118db3c814123f8425618c705f2f48141245618c200f2f426810101561a59f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2814125216eb3f2f46f2321814126111cba01111b01f2f41118111a1118111711191117111611181116111511171115111411161114019d000d02761113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035410403db3c00a401d403fe8f7c30d33fd39f5932011117011118db3c81407ef8425616c705f2f428810101561a59f40d6fa192306ddf206e92306d8e17d0fa40d200d200d33fd307d3ffd37fd31f55706c186f08e281407f216eb3f2f46f281116111e11161115111d11151114111c11141113111b11131112111a1112111111191111111011181110e0019d000f001202fc0f11170f0e111e0e0d111d0d0c111c0c0b111b0b0a111a0a09111909081118080711170706111e0605111d0504111c0403111b0302111a020111190111185617561d561c561edb3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0193001004c80c11170c0b11170b0a11170a09111709111708070655408140821118db3c011121ba01111701f2f4561de30f1115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a0809550601970011001801d402fe814080f8235619bbf2f4814081561bc001f2f4f8416f24135f031115111f11151114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb04a90103847601035443012db3c0111170100c20017011a82108c2a76b7bae3025f0f5f09001302fed33fd39f5932011117011118db3c814088f8425616c705f2f428810101561a59f40d6fa192306ddf206e92306d8e17d0fa40d200d200d33fd307d3ffd37fd31f55706c186f08e2814089216eb3f2f46f281116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f019d001402fc0e111e0e0d111d0d0c111c0c0b111b0b0a111a0a09111909081118080711170706111e0605111d0504111c0403111b0302111a020111190111185617561d561c561edb3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0193001504c00b11170b0a11170a091117091117080706554081408c1118db3c011121ba01111701f2f4561de30f1115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a0809550601970016001801d402fe81408af8235619bbf2f481408b561bc002f2f4f8416f24135f031115111f11151114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb04a90103847601035443012db3c0111170100c20017000e08810101f45a3002fef8416f24135f031115111f11151114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb04a90103847601035443012db3c0111170108810101f45a3011151116111511141115111400c2001901aa1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a08095506db3c011116010111150101111401011113010111120101111101011110011f1e1d50c755500b0a090800d00462c21f97311117d31f1118de21821090e2e0cbbae30221821018db2ccbbae30221821050a61103bae30221821050a61104ba001b001d001f002204fc5b1116d3fffa4030011117011118db3cdb3c1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540813aa21117db3cb301111801f2f4813aa35618c300f2f4813aa42fc000917f942f5619bae20026002700f7001c02baf2f4813aaa11175619db3c57105714011116010ef2f4813aabf828561801c705b3f2f40ea41113111611131112111511121113111411131110111311100f11120f11110d11100d10be10ad109c108b107a10691058104710364540413001ae01d403fe5b1116d3fffa4030011117011118db3cdb3c813aa5f842561801c705f2f4813aa65618c201f2f4813aa75610c000917f9556105619bae2f2f4813aa8f842561a01c705b3f2f4813aa9f8281117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f00260027001e02fa0e11180e0d11180d0c11180c0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111801db3c571057165618500fc70501111601f2f41112111511121111111411111110111311100f11120f0e11110e0d11100d10be10ad109c108b107a1069105810471036453304004901d404fa5b1116d3fffa4030011117011118db3cdb3c813ab15618c201f2f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540813ab21117db3cb301111801f2f42e813ab31119ba01111801f2f400260027019f002002fe1114111511141113111411131112111311121111111211111110111111100f11100f550e1116813ab411175618db3c5714011117011113f2f4813ab5f828561801c705b3f2f40fa60211141116111411131115111311121114111211121113111211101112111011110e11100e10df10ce10bd10ac109b108a10791068105701ae002100ee10461035443012c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ce1110c8ce1fce1dcb071bca0019cbff07c8cbff16f40014f40012f40001c8f40012f40012f40003c8f40014f40014cb3f14cb3f15cb3f15cb3f15cb3f15cb3f13cd12cdcdcdc9ed54043ce3022182103a12d1adbae3022182102aafbd98bae302218210472d9d7dba00230025002b002e04fa5b1116d3fffa4030011117011118db3cdb3c813ab85618c201f2f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540813ab91117db3cb301111801f2f42e813aba1119ba01111801f2f40026002701a3002402f81114111511141113111411131112111311121111111211111110111111100f11100f550e1116813abb11175618db3c5713011117011112f2f4813abcf828561801c705b3f2f40fa604111411161114111311151113111211141112111111130e11100e10df10ce10bd10ac109b108a1079106810571046103544030201ae01d404fc5b1116d3ff301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3cdb3c813aac5618c201f2f42f813aad1119ba01111801f2f4813aae1117db3c01111801f2f4813aaff842561701c705b3f2f40026002700f700280010813a995611b3f2f40030813ab62fc300f2f4813ab7c8f842cf16c9f9005610baf2f402fe813ab05616f8281117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111901db3c01111901c705011117010049002904b4f2f41114111511141113111411131112111311121111111211111110111111100f11100f550e813abd1117db3c01111801f2f4813abe1117db3c01111801f2f4813abf561301111801db3c01111801f2f4813ac0561201111801019f01a301ae002a02d0db3c3f5710011116010df2f4813ac1f828561201c705b3f2f4813ac2f828561101c705b3f2f41113111411131112111311121111111211111110111111100f11100f10ef8228354a6ba7a180007f11101e1f10cd10bc10ab109a108910781067105610451034403301ae01d404fe5b1116d37f301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c813e8a5618c200f2f481010bf8422f5959f40a6fa1318e15813e8cf8416f24135f03561982081e8480a0bef2f4e30ef842db3c019d002c018d002d003c813e8bf8416f24135f0356198208989680a082081e8480a0bef2f405a40501ec111c14a081010bf84210241023111d15c855405045cb7f12cb7fcbffcbffcb3fc9103f1201111901206e953059f45930944133f413e21115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef0d0e10bc10ab109a108910781067105610451034413001d4043ce302218210484c1d72bae302218210f9a44834bae30221821041544811ba002f0038003a004102fe5b1116d33fd39fd37ffa40301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a091117090811180807111707061118060511170504111804031117030211180201111901111adb3c813e8df8425618c705019d003002fef2f4813e8e561ac200f2f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540813eca1117561bdb3c01111801f2f411151116111511141115111411131114111311121113111211111112111101ae003103f61110111111100f11100f550e561a5618db3c2b8101012259f40c6fa131e3022e81010b561d59f40a6fa1318e12813e90f8416f24135f0382080f4240bef2f48e15813e8ff8416f24135f038208c65d40bef2f406a406e21116111711161115111711151114111711141113111711131112111711121111111711110032003300350024c882104144504901cb1f58cf16cb3fc9f90001f430571af8416f24135f0382080f4240be8e51f84282080f4240111870111a70111c01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc914031118030211190201111a014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0011131114111399021118025716571630e2111211161112111111151111003401381110111411100f11130f0e11120e0d11110d0c11100c10bf10ae553901d402fe1110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540561bdb3c03561fa010340281010b5025c855405045cb7f12cb7fcbffcbffcb3fc9103f1201111d01206e953059f45930944133f413e281010120103b1201111801561b01216e955b59f45a3098c801cf004133f442e2018d003601fe08a4f84282080f4240111870111a70111c01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc914031118030211190201111a014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e107c106b105a1049103847155062003700e41413c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ce1110c8ce1fce1dcb071bca0019cbff07c8cbff16f40014f40012f40001c8f40012f40012f40003c8f40014f40014cb3f14cb3f15cb3f15cb3f15cb3f15cb3f13cd12cdcdcdc9ed5402fe5b1116d37ffa4030011117011118db3c813e945618c200f2f4813e92f828561a01c705b3f2f4813e93f8416f24135f0382081e8480bef2f481010bf8422f5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2813e95216eb3f2f46f25813e9625561ebef2f404561ca181010bf8425e50019d003901e613c855405045cb7f12cb7fcbffcbffcb3fc90311100312206e953059f45930944133f413e201111801111770716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce551a01d402fa5b1116d33fd37ffa40301116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170908111708071117070611170605111705041117040311170302111702011118011119db3c813e975619c200f2f4019d003b01fc813e91f828561b01c705b3f2f4813ecbf8421117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111801003c03fedb3c01111801f2f4813ecc1117561adb3c01111801f2f4813e9bf8416f24135f03820a625a00bef2f481010bf8422e5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2813e98216eb3f2f46f25813e9924561fbef2f4f8421118111b11181117111a11171116111911161115111b111501ae01ae003d02f81114111a11141113111911131112111b11121111111a11111110111911100f111b0f0e111a0e0d11190d0c111b0c0b111a0b0a11190a09111b0908111a080711190706111b0605111a050411190403111b0302111c0201111ddb3c813e9a2b8101012359f40c6fa131b3f2f41118561da181010bf84204111b04102300f0003e02fc02111c0201111d01111ec855405045cb7f12cb7fcbffcbffcb3fc9103c0211190201111a01206e953059f45930944133f413e21112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae0d108c107b106a10591048103746505e21021117025619db3c810101f842f8416f24135f030049003f01fef8231023561e4513561e5062c855505056ce13cececb7f01c8cb7f12cb1fcdc9102b561901206e953059f45a30944133f415e201a4707f8040f82803111b0302111c0201111d01c855308210415448105005cb1f13cb3fcb7fcecec95617040311190302111a02111b014343c8cf8580ca00cf8440ce01fa02806acf40f4000040016ec901fb001113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b5e2755251201d4043ce30221821041544813bae30221821050a61121bae3022182103215b5fdba004200a200b200b604d05b1116d33fd37f30011117011118db3c26810101561959f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206eb3e3023027810101561959f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206eb3e30230f8425617c705019d00430047009f02fe6f2321814114111dba01111c01f2f4f8421116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a0911180908111708071119070611180605111705041119040311180302111702011119011118db3c011119010044004501085612db3c004903c2c7058edb814115f8425617c705f2f41115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a10491038471503504406db3ce30d00a4004601d401945716571757180111160102810101f45a301111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a1049103847164515503304db3c00a602fe6f23218140ec111dba01111c01f2f4f8421116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a0911180908111708071119070611180605111705041119040311180302111702011119011118db3c011119010048009d01085613db3c0049016a20fa443070585618db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0004a012488c87001ca0055215023810101cf00cecec9004b0114ff00f4a413f4bcf2c80b004c020162004d009704f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba004e0058005a005b04cc058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544815bae3022082104154481dba004f00530050005100e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54015c30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54005304f88eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e02082104154481bba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0208210178d4519bae302208210472d9d7dba0053005300520055015c30d33ffa00593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54005302ea81378c21c200f2f4f84210685e34103748705280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd31f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305167a0f8285220c705b3941028375be30d1045551200920054006e7080400a7f0ac8598210415448135003cb1fcb3fcb7fc9134a4019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104503fc8eb830d33fd39f5932813800f84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821089129d60ba8eb830d33fd39f59328138eaf84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e000570057005601868210a11a7002ba8eb7d33fd39f593281394ef84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f07005703a655515376db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd31f55406c156f05e2813801216eb3f2f46f25135f0355512981380209db3c29ba18f2f4104810374614403305db3c009a0094008b01fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa0200590052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103555120086043ce30221821041544814bae3022182104154481cbae3022182104154481aba005c005e0062006604d25b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f48209c9c38081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1555029db3c705410b5db3c5551547a9b2f006e008d008e005d01fedb3c5159a17f541ba5700fc855308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c47b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010354044c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54009104fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4555129db3c705410b5006e005f008d0060003082080f4240a082080f4240a082086acfc0a082081e8480a003fedb3c5551547dcb2ddb3c515ca150dc7f7126544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104d103e4a80103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f03008e00910061014e01a11047104610354440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54006c04fe5b05d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422cc705f2f48138d7535bc705f2f4105b104a103948cd53badb3c55408138d85169db3c17f2f48138d927c200f2f48138da2ac200f2f48138db5357bef2f48138dc2a8209c9c380bef2f4550429db3c208208989680a08138ddf8416f24135f0322bef2f455512d006e00830068006304f4db3c705410f5db3c5551547baf5611db3c515aa1103b102a7f7126045611040311110302111002011114011115c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc9106c105c104a10394a90103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf81008d008e0091006402668ae2f400c901fb00f8416f24135f035006a146505e21db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540065006c001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba0067006d0070007204fc5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422fc705f2f481393b538ec705f2f4105e104d103c102b1110541f0828db3c554081393c516fdb3c17f2f481393d2ac200f2f481393e27c200f2f481393f535abef2f4813940278209c9c380bef2f4550426db3c208208989680a0813941006e008300680069003c82082dc6c0a082080f4240a082086acfc0a082081e8480a082081e8480a00486f8416f24135f0322bef2f455512adb3c705410c5db3c5551547edc2edb3c515da1106e105d7f71536d07106e05111605041115040311140302111302011117011118c8008d008e0091006a02e055a0db3cc91035104a10394180103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110471045103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54006b006c005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe5b05d33ffa00fa40fa40f40431fa0081396cf8422ac705f2f410591048103746ab5376db3c81396d29c200f2f481396e5369bef2f481396f2bc000917f972b8209c9c380bee2f2f48208b71b002ba08209406f40a082081e8480a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1555028db3c705410a5006e008d006f035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f4550400830083008303f0db3c5551547cba2cdb3c515ba14cb07f70264c13011110011111c855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec9106810581047103b4870103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00552004008e0091008602fe5b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382087a1200bef2f45134a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f4240710770008d0071009e07c8598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010455512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba00730078007d008004ce5b05d33ffa00fa40fa40fa003081397624c200f2f4813977f842105a1049103847bc29db3c1dc7051bf2f455030981397851b8db3c1cf2f425c2008e1b3781397df8416f24135f0382084c4b40bef2f45137a01049030604e30df8421047103641505449145099008d00830074007603ea813979268209c9c380bef2f481397af8416f24135f032782080f4240a082080f4240a082086acfc0a082081e8480a0bef2f45504543a97db3c555053a6db3c81397b248101012359f40c6fa131b3f2f481397c238101012359f40c6fa131b3f2f4516aa081010182080f4240f8232c544c3052f0c80094009a007500ba55405045ce12cecb3fcb7fcb1fc910354180206e953059f45a30944133f415e2717f544c9052ccc855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec925513d034b9b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001e8db3cf8416f24135f030982080f4240a082080f4240a019be8e3782080f4240717009c8018210d53276db58cb1fcb3fc91048413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001034923535e245334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540077006c82080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0004fa5b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a082081e8480a0bef2f410354014503b541a0a2adb3c555053b6db3c8137eb24008d0094009a007901fc8101012359f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da081010182080f4240f8232e544e30561201c855405045ce12cecb3fcb7fcb1fc910354180206e953059f45a30944133f415e2717f544d9052fec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec91049007a02fc10384b70441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053abc8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407109700bc8598210415448115003cb1fcb3fcb7fc9443049a0441359c8cf8580ca0089007b007c000110005acf16ce01fa02806acf40f400c901fb004430c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404f45b05d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842105d104c103b4aef27db3c01111001c7051ef2f48138e22cc200f2f48138e3f8416f24135f032d82082dc6c0a082080f4240a082086acfc0a082081e8480a0bef2f455030c8138e451ebdb3c1ff2f45504543d7ddb3c55505386008d00830094007e02f8db3c8138e5248101012359f40c6fa131b3f2f48138e62e8209c9c380bef2f48138e7238101012359f40c6fa131b3f2f45168a081010182082dc6c0f823561203021112020111120152c01113c855405045ce12cecb3fcb7fcb1fc910344f70206e953059f45a30944133f415e2717f295159105904031111034edcc8009a007f01f05560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07cec9544114103a4c99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0040030504008604f8e30221821041544811ba8f6e5b05d33fd37f308137a021c200f2f4f84210671056104510344880db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd31f55306c146f04e28137a1216eb3f2f46f2430318137a20aba19f2f48137a3f8425009c70518f2f416810101f45a30104510344130e021008100920086008702fe5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f84205111005104f103e102d0111110111122adb3c01111301c70501111101f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082080f4240a082086acfc0a082081e8480a0bef2f455030f813948111126008d008204fcdb3c01111201f2f45504111053a8db3c555053b6db3c813949248101012359f40c6fa131b3f2f481394a298209c9c380bef2f481394b238101012359f40c6fa131b3f2f4516ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb1fc910344a70206e953059f45a30944133f415e2717f2c08517c0700830094009a0084000afa4430c00001fe106c05111405041113040311120302111102011110010fc855908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc92643144a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc9443000850072441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0044145053c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404c28210472d9d7ebae3022182104154481eba8ebb5b05d33fd37fd39f3081380af84227c705f2f41068105710461035103401db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0218210504e5052bae30237c00006c12116b00088008b0093009604f65b05d33fd37fd39f30813804f84227c705f2f481380522c200f2f410561046103646785368db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd31f55406c156f05e2206ee3026f2530813807511dbaf2f410591048103746982a81380808db3c500dba16f2f48101015415005467c0009a00890094008a0090303738810101530150884133f40c6fa19401d70030925b6de2813806216eb3f2f481380907ba16f2f445334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400dc216e955b59f45a3098c801cf004133f442e25054810101f45a307108700ac8598210415448115003cb1fcb3fcb7fc9104710364890441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003444405c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403f68137fa21c200f2f455525387db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd31f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53bcbef2f48137fd511cbaf2f455448137fe543ad8db3c2dba1bf2f4514aa15088810101009a0094008c04f2f45a3010574014541386db3c705385db3c10685e3410374870545ee9db3c539b82082dc6c0ba955b3839f8288e3d717011112fc8598210415448135003cb1fcb3fcb7fc9104d103e1201111101441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00090c0807e21046103544304970546cb052b0008d008e008f0090016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0008e0026f82ac87001ca0055215023810101cf00cecec90030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01c4db3c707f541db680400bc855308210415448125005cb1f13cb3fcb7fcecec91069105c104a103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00410504009101901069105810471039487927db3c813796228101012359f40c6fa131b3f2f4810101f82310394ba0c855305034cececb7fcb1fc910364780206e953059f45a30944133f415e245401200920026c8821041544f4701cb1f12cb3f01cf16c9f90003f65b05d33fd39f3081380df8416f24135f0382081e8480bef2f454167628db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd31f55406c156f05e281380e216eb3f2f46f2533106a1059104810374a9b81380f08db3c500cba16f2f4813810f8230982015180a019be18f2f481381106009a00940095002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f009882082dc6c0bd16f2f48101012010345445135099216e955b59f45a3098c801cf004133f442e25024810101f45a30403305c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400588e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c0820201480098009b017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c65800990178db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd31f55406c156f05e2206e983070705456002802e06f25327f044313009a0002310179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c638009c000654754303c2c7058edb8140edf8425617c705f2f41115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a10491038471503504406db3ce30d00a8009e01d401905716571757180111160103810101f45a301111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a104910385067445358db3c00aa02fe8eae571757171114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce029810101561959f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813e9c216eb3f2f46f2622813e9d1120ba01111f01f2f4813e9e01d400a001fcf84224c705f2f4f8416f24135f03111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001111e0100a1028cdb3c0111170109810101f45a301116a51115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a550700ae01d404f85b1116d33fd37f30011117011118db3c26810101561959f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206eb3e3023027810101561959f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206eb3e30230813ec6f8425618c705f2f4813ec75619c200f2f4298101015619019d00a300a700ab02e46f232181411e111dba01111c01f2f481411ff842561ac705f2f41118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354104db3c00a401d402f0301116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a09111809081117080711190706111806051117050411190403111803021117020111190111185619db3c111d13a081010b111d13c8018d00a501e055405045cb7f12cb7fcbffcbffcb3fc9103e0211190201111a01206e953059f45930944133f413e20111150104810101f45a301113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be103d109c108b107a1069105810474566441403db3c00a60006832fa102e46f23218140f6111dba01111c01f2f48140f7f842561ac705f2f41118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354104db3c00a801d402f0301116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a09111809081117080711190706111806051117050411190403111803021117020111190111185619db3c111d13a081010b111d13c8018d00a901e255405045cb7f12cb7fcbffcbffcb3fc9103e0211190201111a01206e953059f45930944133f413e20111150105810101f45a301113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be104d109c108b107a106910580710364015503304db3c00aa0006831fa101fe59f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813ec8216eb3f2f46f2622813ec91120ba01111f01f2f41116111b11161115111a11151114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d11170d0c111b0c00ac02f60b111a0b0a11190a091118090811170807111b0706111a0605111905041118040311170302111b0201111a0111195618db3c03561fa010340281010b5025c855405045cb7f12cb7fcbffcbffcb3fc9102f561a01206e953059f45930944133f413e2f8416f24135f031117111d11171116111c11161115111b1115018d00ad02f61114111a11141113111911131112111811121111111711111110111611100f11150f011114010d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a1039418017161501111e01db3c0111170109810101f45a301116a511151116111511141115111411131114111311121113111211111112111100ae00b101f0316c2232702282081e8480bc99300182081e8480a1019132e25cbc91319130e220c101915be01116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180600af02fc051117050411180403111703021118020111170111185617db3c111d14a081010b111d14c855405045cb7f12cb7fcbffcbffcb3fc9103e0211190201111801206e953059f45930944133f413e21114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce0d10ac109b108a018d00b0001a1079106810571046103544301201301110111111100f11100f10ef10de10cd10bc10ab109a550701d404fe5b1116d33f31fa40d37f30011117011118db3c1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609111608070655408141281117db3c01111801f2f4814129f8425614c705f2f481412a11175618db3c01111801019d019f01ae00b302fcf2f481412b5619c200f2f42c81010b561959f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e281412c216eb3f2f4f8416f24135f0382081e8480bb8eaf30571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae0f8416f2401d400b402fc135f0382081e8480a120561bbc913092571ae25619c1018eaf30571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae06f25111d14a081010b111d14c855405045cb7f12cb7fcbffcbffcb3fc9103d0211190201111801206e953059f45930944133f413e201d400b501741113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be0d109c108b107a106910581047103640451301d404948eab5b57161114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de021821052705edabae302218210874e576abae302218210720bdd6dba01d400b700bc00cb02fc5b1116d3ffd3ffd3ffd430d0d3ffd30fd4d30f301116111b11161115111a11151114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d11170d0c111b0c0b111a0b0a11190a091118090811170807111b0706111a0605111905041118040311170302111b0201111c01111ddb3c019d00b803fe561a561a5619561e56205622db3c813ef65619c300f2f4813ef75619561bbdf2f481010bf8422f5959f40a6fa1311116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540561edb3c010b010900b902fe5618968208989680a0df82081e8480a0813eeef8416f24135f0358bef2f4f842db3c31813eef02c00012f2f470f8421117111b11171116111a11161115111911151114111811141113111b11131112111a11121111111911111110111811100f111b0f0e111a0e0d11190d0c11180c0b111b0b0a111a0a0911190908111808018d00ba03f607111b0706111a06051119050411180403111b0302111a0201111901561956215621562056255628db3c813ef02e8101012359f40c6fa131b3f2f4111c9305a405df810101f842f823f825561c20104b0a111e0a091125090811240807112207061126060511270504112804c855b0db3cc9102701111c015616010110011100bb01f8206e953059f45a30944133f415e21111a481010bf842041112040311150302111602011118011114c855405045cb7f12cb7fcbffcbffcb3fc910340211140201111001206e953059f45930944133f413e20a11160a091115090811140807111307061112060511110504111004103f4e1d105b0a105948154676131401d403d25b1116d3ff301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c814074f8425616c705f2f45617db3c298101012259f40d6fa192306ddf019d019500bd01fe206e92306d8e17d0fa40d200d200d33fd307d3ffd37fd31f55706c186f08e2814075216eb3f2f46f281116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061118060511170500be04c804111f0403111e0302111d0201111c01111b56195620561f5621db3c8140761122ba01112101f2f45617e30f1115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a08095506019300bf00c101d401f8814077f823561cbbf2f4f8416f24135f031116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a11120a0911110908111008107f106e105d104c103b4a9008112008544118071121070605112005041121040300c0028c02112002112101db3c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c0111170108810101f45a3000c200c702f6f8416f24135f031116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a11120a0911110908111008107f106e105d104c103b4a9008112008544118071121070605112005041121040302112002112101db3c00c200c602f23134355b018e82db3ce170218208401640bc97308208401640a19131e25301bc91309131e220c101915be01116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a09111709081118080711170700c300c4007a70218208401640bc97308208401640a19131e25301bc91309131e220c101915be070716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002fc06111806051117050411180403111703021118020111170111185617db3c111d14a081010b111d14c855405045cb7f12cb7fcbffcbffcb3fc9103e0211190201111801206e953059f45930944133f413e21114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce0d10ac018d00c50022109b108a1079106810571046103544301203fe1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c0111170108810101f45a301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a08095506db3c011116010111150100c700d000ca01f42fc1019130e081409c2f81010b2359f40a6fa131f2f48212540be400205611bc92302fde1116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a091117090811180807111707061118060511170500c802fe0411180403111703021118020111170111185617db3c03561da001111301111da102111c02111281010b111dc855405045cb7f12cb7fcbffcbffcb3fc9103e0211190201111801206e953059f45930944133f413e21114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce018d00c900280d10ac109b108a10791068105710461035443012003e01111401011113010111120101111101011110011f1e1d50c755500b0a090804fe8ff05b1116d3ff301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c814095f8416f24135f0382081e8480bef2f45617db3c298101012259f40d6fa192306ddfe05718c0001117c12101111701019d019500cc00d101fe206e92306d8e17d0fa40d200d200d33fd307d3ffd37fd31f55706c186f08e2814092216eb3f2f46f281116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061118060511170500cd03e604111f0403111e0302111d0201111c01111b56195620561f5621db3c8140931122ba01112101f2f41117e302814094f823111b82015180a001111b01be01111a01f2f4f82382015180a020841fbc9330841fde051117058101017f060511170504111f0403111e0302111d0201111c01111dc8019300ce00cf01a8571557165718571857185718814096f823011115be01111401f2f4011111011112810101f45a300c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb05e360850440705431301d402ba55705078ce15ca0013ca00cb3fcb07cbffcb7fcb1fc9130211150201111301206e953059f45a30944133f415e20c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb0106a0809105706034545db3c00d001d40002a50170b08ead813ee3f2f01114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de05f0f5f08f2c08201d402012000d300da02012000d400d702f9b9bc8ed44d0d200018e6afa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de5335058e1434229135923214e210248228354a6ba7a18000039136e26d6d6d6d6d6d6d6d7054700053000f11140f0e11130e0f11120f0f11110f0e11100e10efe30d1116111b11168010400d501901115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d5547db3c57105f0f6c7100d60104db3c012102f9ba689ed44d0d200018e6afa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de5335058e1434229135923214e210248228354a6ba7a18000039136e26d6d6d6d6d6d6d6d7054700053000f11140f0e11130e0f11120f0f11110f0e11100e10efe30d1116111711168010400d801601115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cc66cb600d9006e81010b2f0259f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2206e9730707054700020e06f257f554002012000db00e702016600dc00e002f9afd276a268690000c7357d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299a82c70a1a11489ac9190a71081241141aa535d3d0c00001c89b7136b6b6b6b6b6b6b6b82a3800298007888a07870889870788890787888887870888070877f186888b088b888b40010400dd01741115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cdd3d3d3d3d3d3d3d3d3d3d559200de026c8101012e0259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206e8e8f3070f8287054700020885471115300e06f2c7f55b0010e00df000002016200e100e402f7a127b5134348000639abe903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd4163850d08a44d648c85388409208a0d529ae9e8600000e44db89b5b5b5b5b5b5b5b5c151c0014c003c44503c38444c383c44483c3c44443c3844403843bf8c3444584460445a010400e2016c1115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c6cc66cb600e30208db3cdb3c00f000f402f7a25bb5134348000639abe903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd4163850d08a44d648c85388409208a0d529ae9e8600000e44db89b5b5b5b5b5b5b5b5c151c0014c003c44503c38444c383c44483c3c44443c3844403843bf8c3444584464445a010400e5017c1115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552adb3c57105f0f6c7100e60104db3c013202012000e800eb02f9b5c69da89a1a400031cd5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa688e00b24e26bbca66a0b1c286845226b246429c4204904506a94d74f43000007226dc4dadadadadadadadae0a8e000a6001e22281e1c22261c1e22241e1e22221e1c22201c21dfc61a222c222e222d0010400e901641115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6caa6caa6c3a00ea00a68101012d0259f40d6fa192306ddf206e92306d8e27d0fa40fa40d307d37fd3ffd33fd401d0d37fd31fd200301039103810371036103510346c196f09e2206e9d3070f828f82870547000530070e06f297f558002012000ec010002012000ed00f102f9acd376a268690000c7357d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299a82c70a1a11489ac9190a71081241141aa535d3d0c00001c89b7136b6b6b6b6b6b6b6b82a3800298007888a07870889870788890787888887870888070877f186888b088c088b40010400ee01701115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c57105f0f6c7100ef0104db3c00f0002ac882104157494401cb1f58cf16cb3fc9f900a9383f02012000f200f502f5f5da89a1a400031cd5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa688e00b24e26bbca66a0b1c286845226b246429c4204904506a94d74f43000007226dc4dadadadadadadadae0a8e000a6001e22281e1c22261c1e22241e1e22221e1c22201c21dfc61a222c222e222d010400f301601115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cc66cb600f4008e8101012b0259f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2206e9a3070f828f828f8287020e06f26317f554003f8abb3ed44d0d200018e6afa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de5335058e1434229135923214e210248228354a6ba7a18000039136e26d6d6d6d6d6d6d6d7054700053000f11140f0e11130e0f11120f0f11110f0e11100e10efe30ddb3c57175717010400f600ff02f270561192302ede56111116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011118db3c11161117111600f700f8010671db3c01a402fe1115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d019f00f902fe0c11170c0b11170b0a11170a0911170911170807065540db3c5610561656165616561b561b547cba2b1116112111161115112011151114111f11141113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11180d0c11170c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0501a300fa03f604111a040311190302111802011117011121db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540db3c11161117111611151117111511141117111411131117111300fb01b800fc000820a9381f02fe1112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540db3c820151808228354a6ba7a180005629a11113112a11131112112811121111112711111110112511100f11240f0e11230e0d11220d0c11210c0b11200b0a111f0a09111e0908111d0801d100fd01f607111c070611260605111b0504111a041023561b03112a018212540be4008228354a6ba7a18000111c112d111c111b112c111b111a112b111a1119112a1119111811291118111711281117111c1127111c111a1126111a111911251119111711241117111c1123111c111a1122111a11191121111911171120111700fe0054111c111f111c111a111e111a1119111d11191117111c11171117111b11171118111a1118111811191118005457175717571757175717571757175717571757175717571757175717571757175717571757175717571702f9b2173b5134348000639abe903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd4163850d08a44d648c85388409208a0d529ae9e8600000e44db89b5b5b5b5b5b5b5b5c151c0014c003c44503c38444c383c44483c3c44443c3844403843bf8c3444584468445a00104010101801115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf553adb3c57105f0f6c7101020104db3c017702f6f2eda2edfbed44d0d200018e6afa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de5335058e1434229135923214e210248228354a6ba7a18000039136e26d6d6d6d6d6d6d6d7054700053000f11140f0e11130e0f11120f0f11110f0e11100e10efe30d11170104010500f2fa40fa40fa40d401d0fa40fa40d307d200d3ffd430d0d3fff404f404f404d430d0f404f404f404d430d0f404f404d33fd33fd33fd33fd33fd33f3011141117111411141116111411141115111457171115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e0458d70d1ff2e08221821089d648bbbae3022182107e1f5035bae3022182107e1f5036bae3022182107e1f5037ba010601130125013501fc31fa408308d718d4302f81010b2459f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2813ef8216eb3f2f46f25813ef923c300f2f4813f0022c300f2f4813f0226f900541083f91017f2f404d0d31f813f0302821056524b31ba12f2f4d3ff813f04025617ba12f2f4d3fff828813f0501010701fcd30a018309ba12f2f4813f0501d3ff3013ba12f2f4d3ff27813f0601d30a018309ba12f2f4813f0601d3ff3013ba12f2f4d33f813f075127ba12f2f4813f0821d749c000f2f4813f0921d74ac001f2f41116111c11161115111b11151114111a11141113111911131112111811121111111711111110111c11100f111b0f010802fc0e111a0e0d11190d0c11180c0b11170b0a111c0a09111b0908111a0807111907061118060511170504111c0403111b0302111a0201111901111d72db3c82081e8480a0813efe561d22bef2f4f800111ed430d0d3ffd3ffd3ffd30fd4d30f813f0a21d749c000f2f4813f0b01d74ac000f2f41116111c11161115111b11150109010a001a813ee401c002f2f48209c9c38002f41114111a11141113111911131112111811121111111711111110111c11100f111b0f0e111a0e0d11190d0c11180c0b11170b0a111c0a09111b0908111a0807111907061118060511170504111c0403111b0302111a020111190111185617561d561d561d561d561ddb3c813f01561d5624bdf2f42c8101015621010b010d0160813ee506c30016f2f4813ee604c30014f2f4813eeb24c002f2f4813ee902c30012f2f4813eea218104a0baf2f459db3c010c00e8813eeb02c00212f2f4207af941813eec03c00a13f2f4813eed01812500baf2f4813ef101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d0813ef221d74923aa02baf2f45331bc9e32813ef322d74ac001f2f401d4309b813ef401d74ac000f2f401e259a101e85b03fc59f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2813efa216eb3f2f46f2c31813efb2b562bc705f2f4813efc01c000f2f4813efd29841fb9f2f4f823f825109b8101012b0a109d08107d06105d04103d50d2c855b0db3cc9103f01112201206e953059f45a30944133f415e2111fa4111f0c561e56205619561f010e0111010f0046fa40d31fd3ffd3ffd401d0d3ffd30fd4d30fd31fd33fd31fd33f30108c108b108a108903fc561f561f561edb3c813eff2e8101012359f40c6fa131b3f2f4810101f823f825702056240b0a11260a09111e0908112308071122070611210605112005111f5530c855b0db3cc9102801111501561601206e953059f45a30944133f415e21112a401111b01111da11116a403111603021119020111130181010b111c01c80110011101120048c815cbff13cbffcbffc9c882104b45594901cb1f5005cf1613cb1f12cb0fcb0fccc9f900004850bcce19cb1f17cbff15cbff03c8cbff12cb0fcc12cb0f12cb1f12cb3f12cb1f12cb3fcd01a455405045cb7f12cb7fcbffcbffcb3fc90211180201111401206e953059f45930944133f413e2091116090811150807111407061113060511120504111104031110034fed10bc104b103a106908060405552001d402f231fa408308d718d4301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011119db3c2d81010b561a019d011401fe59f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2813f56216eb3f2f46f25813f5d22c300f2f4813f5e561ff90001111e23f91001111d01f2f4111dd0d31f813f5f02821056524331ba12f2f4d3ff813f60025615ba12f2f4d3fff828813f6101d30a018309ba12f2f4813f6101d3ff3013011503feba12f2f4d307813f6202c00112f2f4d3ff561d813f6301d30a018309ba12f2f4813f6301d3ff3013ba12f2f4d33f813f6922561ebaf2f4f800111ca481010b547543562225c855405045cb7f12cb7fcbffcbffcb3fc902111402561f01206e953059f45930944133f413e2f80f561cd749c000e303561cd74ac001e303111c011601160117016857125f045717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d404d4d430d0d307d37ffa40d3ff20d749c0008ec25f093d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e1d74ac000e30323c001917f9323c002e2e30322c20001d401190119011803a08ec25f083d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e120e303820889544024c00101d40119011a01845f083d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a106910581047103645330401d403fc8ed05330a05290be8ec25f093d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e15230a018a1e30e1116111e11161115111d11151114111c11141113111b11131112111a1112111111191111111011181110012f011b012004e41116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d11200d0c111e0c0b111d0b0a111c0a09111b0908111a080711190706111806051117050411200403111e0302111d0201111c01111b5621db3ce303561ddb3c01ae011c01ae011d01745717571757175717571757175717571757175717571757170a11160a091115090811140807111307061112060511110504111004103f4edc550a012f03fe8eba5717571757175717571757175717571757175717571757170a11160a091115090811140807111307061112060511110504111004103f4edc550ae15619561fbe8eba5717571757175717571757175717571757175717571757170a11160a091115090811140807111307061112060511110504111004103f4edc550ae1012f012f011e02fc561a561cbe8eba5717571757175717571757175717571757175717571757170a11160a091115090811140807111307061112060511110504111004103f4edc550ae11119561ea101111a01111ba10c111f0c1115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e012f011f004c0d11160d0b11140b0a11130a091112090811110807111007106f105e104d103c4ba01079106803fa0f11170f0e111e0e0d111f0d0c111c0c0b111b0b0a111a0a09111909081118080711170706111e0605111f0504111c0403111b0302111a020111190111185620561a561d561d5620db3c2c8101012259f40c6fa131e3020311190302111f0201112001112281010b111fc855405045cb7f12cb7fcbffcbffcb3fc9102b0121012201230036c882105243494401cb1f5005cf165003cf16cb07cb7fcb3fc9f900017830571757175717571757175717571757175717571757170b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b55900c01d401fe01111b01561e01206e953059f45930944133f413e281010182081e8480f82307111f070611180605111a05041119040311160302111b0270c855805089ce16ce14cb0712cb7fcbffcb3f01c8cb7f12cb1f12ca00cdc90211140201111901206e953059f45a30944133f415e21112a40b11160b0a11150a091114090811130801240140071112070611110605111005104f103e1c1d107b5e361068103710561045414301d402f231fa408308d718d4301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011119db3c2d81010b561a019d012601fe59f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2813f6f216eb3f2f46f25813f7022c300f2f4813f71561ff90001111e23f91001111d01f2f4111dd0d31f813f7202821056524331ba12f2f4d3ff813f73025615ba12f2f4d3fff828813f7401d30a018309ba12f2f4813f7401d3ff3013012703fcba12f2f4d307813f7502c00212f2f4d3ff561d813f7601d30a018309ba12f2f4813f7601d3ff3013ba12f2f4d33f813f7902561dba12f2f4f800111ba481010b547432562125c855405045cb7f12cb7fcbffcbffcb3fc902111302561e01206e953059f45930944133f413e2f80f561bd749c000e303561bd74ac001e30301380138012803d0111bd430d0d3ffd3ff20d749c0008ec25f063d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e1d74ac000e30356108101012359f40d6fa192306ddf01d40129012a01845f053d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a106910581047103645330401d403fc206e92306d8e27d0fa40fa40d307d37fd3ffd33fd401d0d37fd31fd200301039103810371036103510346c196f09e2206e8ec25f063d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e06f29385f0304e30201d4012b012c01845f093d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a106910581047103645330401d403f456215003c7058ec25f083d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e120c002e3001117111e11171116111d11161115111c11151114111b11141113111a111311121119111211111118111101d4012d013103fc1116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e111e0e0d111f0d0c111c0c0b111b0b0a111a0a09111909081118080711170706111e0605111f0504111c0403111b0302111a020111190111185620db3ce3030d111f0d1116111e11161115111d111501ae012e01300176571757175717571757175717571757175717571757170b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b55900c012f00e4c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ce1110c8ce1fce1dcb071bca0019cbff07c8cbff16f40014f40012f40001c8f40012f40012f40003c8f40014f40014cb3f14cb3f15cb3f15cb3f15cb3f15cb3f13cd12cdcdcdc9ed54db3100781114111c11141113111b11131112111a11121111111911111110111811100f11170f0e11160e0c11140c0b11130b0a11120a0911110908111008557703f81110111e11100f111d0f0e111f0e0d111b0d0c111a0c0b11190b0a11180a09111e0908111d0807111f0706111b0605111a05041119040311180302111e0201111d01561901562101111adb3c01111ebae3031116c0019701111c01111aa09b01111801111aa01117111be2030211170201111601111d81010b1119c8013201330134002ac882105243434d01cb1f13cbff01cf16cbffc9f900017e5716571657165716571657165717571757170c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cba49170550330806441401d401ca55405045cb7f12cb7fcbffcbffcb3fc910370211150201111901206e953059f45930944133f413e250f2810101f45a301114a50c11160c0b11150b0a11140a09111309081112080711110706111006105f104e4cd010ab104a10391078104710261025441301d403fa8f7931fa408308d718d4301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011119db3c2d81010b561ae021019d0136013e01fe59f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2813f7c216eb3f2f46f25813f7d22c300f2f4813f7e561ff90001111e23f91001111d01f2f4111dd0d31f813f7f02821056524331ba12f2f4d3ff813f80025615ba12f2f4d3fff828813f8101d30a018309ba12f2f4813f8101d3ff3013013703fcba12f2f4d307813f8202c00312f2f4d3ff561d813f8301d30a018309ba12f2f4813f8301d3ff3013ba12f2f4d33f813f8602561dba12f2f4f800111ba481010b547432562125c855405045cb7f12cb7fcbffcbffcb3fc902111302561e01206e953059f45930944133f413e2f80f561bd749c000e303561bd74ac001e303013801380139016857115f035717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d403ca111bd430d0d3ff20d749c0008ec25f053d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e1d74ac000e3032f8101012259f40d6fa192306ddf01d4013a013b01845f043d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a106910581047103645330401d402fe206e92306d8e27d0fa40fa40d307d37fd3ffd33fd401d0d37fd31fd200301039103810371036103510346c196f09e2206e8ec25f053d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e06f295f0532561f500301d4013c02ecc7058ec25f063d571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10bd109c108b107a1069105810471036453304e101c0019214a09413a04013e203111d81010b1112c855405045cb7f12cb7fcbffcbffcb3fc903111803102e0111190101d4013d0194206e953059f45930944133f413e20111170109810101f45a301116a51113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be108d109c552801d4044a82107e1f5031bae3022182107e1f5032bae3022182107e1f5033bae3020182107e1f5034ba013f0165019c01bb02f231fa408308d718d4301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011119db3c2d81010b561a019d014001fe59f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2814043216eb3f2f46f2581404622c300f2f4814049561ff90001111e23f91001111d01f2f4111dd0d31f81405002821056504231ba12f2f4d3ff814051025615ba12f2f4d3fff82881405201d30a018309ba12f2f481405201d3ff3013014102faba12f2f4d30781405302c00112f2f4d3ffd33fd37fd307d307562181404201d30a018309ba12f2f481405601d3ff3017ba16f2f4814045245621baf2f481405821c002f2f47022c00196308208b71b00e30e81405721c200f2f481404e5341bef2f481404f5394bef2f4f8005188a11120a481010b56215398562625c801420143007e22c00296308208d292408e3222c0049630820907fa208e2522c008963082097450808e1822c0109630820a5191209c22c0209730821004077e80dee2e2e2e204f855405045cb7f12cb7fcbffcbffcb3fc902111802562301206e953059f45930944133f413e2f80f25d749c0008eb457165f085717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae125d74ac001e30305d43020d020d749810310bae303d74ac00301d4014401450146016857165f085717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d4016a10695f093e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d404fc8eb510585f083e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae1d0d307d3075225ba8eb510695f093e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae15203bae3030201d401d401470148016a10585f083e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d403fcd3ffd3ffd3ffd4d4d420d749c0008eb510be5f0e3e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae1d74ac000e3031116112411161115112311151114112211141113112111131112112011121111111f11111110111e11100f111d0f0e111c0e01d40149014a016a10ad5f0d3e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d404a210ad0c111a0c0b11190b0a11180a09111709081124080711230706112206051121050411200403111f0302111e0201111d01111c715624562456245624db3ce303561ef9005622bae303561df9005621ba016d015c015c014b04b88ec4571757175717571757175717571757175717571757175717571757175717571757170511160504111504031114030211130201111201111105111005104f103e4dcb5545e1561cf9005620bae30356235623562056205620db3c01d4015c014c015b03ee1117111b11171116111a11161115111911151114111811141113111b11131112111a11121111111911111110111811100f111b0f0e111a0e0d11190d0c11180c0b111b0b0a111a0a091119090811180807111b0706111a06051119050411180403111b0302111a0201111901111a7281046071db3ce303015a014d014e005e57175717571757171112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf553a7002fe1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1118718100f070db3c8e315717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a70e1561656165616561656165616561656165616015a014f01fc561656165616561656165616561656165616561656165616561656161116112d11161115112c11151114112b11141113112a11131112112911121111112811111110112711100f11260f0e11250e0d11240d0c11230c0b11220b0a11210a0911200908111f0807111e0706111d0605111c0504111b0403111a0302111902015003fa011118011117562e5631db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540562f5632db3c1117111811171116111711161115111611151114111511141113111411130154015101520108db3caa02015502fc1112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130011130011132db3c57105f0f6c711117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be015301590106db3ca501540110db3ca67e807fa904015503ee1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111801db3c1118db3c01111801a001560157016f0016813fc701c002f2f48104b402f61115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a0911170908111608071117070611160605111705041116040311170302111602011117011116813fc611185617db3c01111901f2f41116aa09111511171115018a0158007c1114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354430012c10ad109c108b107a106910581047103645404330db3c015a00f68e74eda2edfb561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561aed41ed43ed44ed45ed47985b70db315f0f5f09ed67ed65ed64ed63ed6180177fed118e175132f9415024ba9201ba925b70e29201ba925b70e2db31ed41edf101f2ff801b7fdb3804ba8ec4571757175717571757175717571757175717571757175717571757175717571757170511160504111504031114030211130201111201111105111005104f103e4dcb5545e156267156255625db3c562501bee3035626715625562501d40177015c015d0188571757175717571757175717571757175717571757175717571757175717571757170511160504111504031114030211130201111201111105111005104f103e4dcb554501d403fedb3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405625561adb3c11161117111611151117111511141117111411131117111311121117111211111117111111101117111001880191015e03f40f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405628561a562371db3c208ec430571757175717571757175717571757175717571757175717571757175717571757175717571703111603021115020111140111130311120302111102011110010f55a3e1111611171116019301d4015f02fa1115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405617db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0195016003fe0d11170d0c11170c0b11170b0a11170a09111709111708070655405618db3c29810101561a59f40c6fa1318ec430571757175717571757175717571757175717571757175717571757175717571757175717571757175717011116011115011114011113011112011111011110010f55c1e001112901111da101112901a103019701d4016101fa02111d0201111c01112a81010b111fc855405045cb7f12cb7fcbffcbffcb3fc9102901111b01562601206e953059f45930944133f413e2810101707f71f823051129051034102302111a02562201561901c855705078ce15ca0013ca00cb3fcb07cbffcb7fcb1fc901111501561101206e953059f45a30944133f415e2016203f80e11160e0d11150d0c11140c0b11130b0a11120a0911110908111008107f106e0d11220d104c103b4a981037105605111705041123040311170302112202011121011120db3cf80f09111709081123080711200706111f0605111e0504111d0403111c0302111b0201111a0111197f1119711124c855b0db3cc92b04019a0163016400588210a4f862c0500dcb1f1bcb3f19cb9f17cbff15cb0713cb07cbff01c8cbff12cbff12cc12cc12cc12cb7fcd01980311190302111002111a014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00091116090811150807111407061113060511120504111104031110034fed108c107b107a1079550701d402f231fa408308d718d4301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011119db3c2d81010b561a019d016601fc59f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2814061216eb3f2f46f2581406422c300f2f4814067561ff90001111e23f91001111d01f2f4111dd0d31f81406d02821056504231ba12f2f4d3ff81406e025615ba12f2f4fa4081406ff82813c70512f2f4d30781407002c00212f2f4016702fefa40d33fd37f814073045620c70514f2f4561e81406001d30a308309baf2f481406322561fbaf2f4820884c06081406b5321bef2f481406c5372bef2f4f8005166a1111ea481010b561f5376562425c855405045cb7f12cb7fcbffcbffcb3fc902111602562101206e953059f45930944133f413e2f80f23d749c000e3032301680169016857145f065717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d403fcd74ac0018eb457145f065717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae103d43020d020d7498308ba8eb510475f073e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae101d401d4016a03fed74ac0028eb510365f063e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae1d0d3ffd3ffd4d420d749c0008eb5107a5f0a3e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552a01d401d4016b02f6e1d74ac0008eb510695f093e5717571757171113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be552ae172717020111a1124111a1119112311191118112211181117112111171116112011161115111f11151114111e11141113111d11131112111c11120a11110a01d4016c03fe1110112411100f11230f0e11220e0d11210d0c11200c0b111f0b0a111e0a09111d0908111c0807111e07061124060511230504112204561e01db3c8eba5717571757175717571757175717571757175717571757175717091116090811150807111407061113060511120504111104031110034fed5529e1561ff900561bba016d01d40170014424c001e30204c0028e1402c301935f0370e0925b70e0923070e19170e07fe05f0470016e03fe34935f0370e102925b70e11117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111801db3ce3031117c002018a0172016f00901116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413004988eba5717571757175717571757175717571757175717571757175717091116090811150807111407061113060511120504111104031110034fed5529e1561ef9005621bae303561f561fdb3c01d401860171017603f41117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180908111808071118070611180611180504035971810240707fdb3ce303111611171116111511161115111411151114017401720173005a57171115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e70014a1113111411131112111311121111111211111110111111100f11100f550e79830c787fdb3c017401c68edceda2edfb561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561bed41ed43ed44ed45ed47985b70db315f0f5f09ed67ed65ed64ed63ed6180177fed118aed41edf101f2ff801c7fdb380175007c5143f9415025bb955f0570db31e120c200955f0570db31e15203bb955f0470db31e112bb945b70db31e10196a93802c000b3923070e29370db31e07fdb31049e8eba5717571757175717571757175717571757175717571757175717091116090811150807111407061113060511120504111104031110034fed5529e15622727170db3c561901bee303562272717001d401770186018703f61116111a11161115111911151114111811141113111711131112111a11121111111911111110111811100f11170f0e111a0e0d11190d0c11180c0b11170b0a111a0a09111909081118080711170706111a0605111905041118040311170302111a02011119011118561a561a561adb3c111bc002e302813fc856190178017e017f015022c0028e1632813fc001c001f2f4813fc101c000f2f4820884c060e0813fc203c00113f2f401db3c017902f01115111811151114111711141113111611131112111811121111111711111110111611100f11180f0e11170e0d11160d0c11180c0b11170b0a11160a0911180908111708071116070611180605111705041116040311180302111702011116011118813fc311185617db3c01111901f2f4813fc41119c002018a017a03fc01111901f2f45615c0018e2f57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208b71b00e05615c0028e2f57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208d29240e05615c004e3025615c008e302017b017c017d005e57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b820907fa20005e57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b820974508000c41115c0108e2d1113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b820a519120e01113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b821004077e8002f4571857181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208989680db3c01111801a08208249f00a082080f4240a0820870ea40a08209c9c380a0111611171116111511161115111411151114111311141113111211131112111111121111018b01d202fcc002f2f41116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e8208989680db3c01111a01a01116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a018b018001e210791068105710461035102411194003db3c01111801a082080f4240a08208325aa0a08209c9c380a01116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130018102f01115111811151114111711141113111611131112111811121111111711111110111611100f11180f0e11170e0d11160d0c11180c0b11170b0a11160a0911180908111708071116070611180605111705041116040311180302111702011116011118813fc911185617db3c01111901f2f4813fc51119c002018a018203fc01111901f2f45615c0018e2f57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208401640e05615c0028e2f57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208419ce0e05615c004e3025615c008e302018301840185005e57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b820844aa20005e57151113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b82084c4b4000c21115c0108e2d1113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208588040e01113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b820873f78001745717571757175717571757175717571757175717571757175717091116090811150807111407061113060511120504111104031110034fed552901d403fedb3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405619561fdb3c11161117111611151117111511141117111411131117111311121117111211111117111111101117111001880191019202f222c0028e9832813fde01c001f2f4813fdf01c000f2f48208989680db3ce0813fe003c00113f2f41116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a09111809081117080711190706111806018b018902ca05111705041119040311180302111702011119011118813fe11119db3c01111901f2f4813fe31119c00201111901f2f41114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b8208989680db3c018a018b004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e201f056129131e15610c2009131e07021c100923020de1117111911171116111811161115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a09111909081118080711190706111806051119050411180403111903018c03fe02111802011119011118db3c10345f0420822009184e72a000be8e313057181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0822009184e72a00001a101111901a8822009184e72a000a0a5822009184e72a000a904205618b9e3025717111511171115018d018f0190016281010b2f0259f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e2206e8e8330db3ce06f25018e000a7054700020005e301115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d00501114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d0012813fd45321bef2f4a103f40f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405624561c562472db3c208ebe30571757175717571757175717571757175717571757175717571757175717071116070611150605111405041113040311120302111102011110010f5567e1111611171116111511171115019301d401940028c8561401cbff5004cf1612cb3fcbffcb07c9f90002fe1114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405617db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c019501960006a9383f03f80b11170b0a11170a09111709111708070655405618db3c29810101561a59f40c6fa1318ec530571757175717571757175717571757175717571757175717571757175717571757170511160504111504031114030211130201111201111105111005104f103e4dcb5545e001111d011122a101112501a10302111f02019701d401980012c8cbffc9f900a9389f01f801111e01112681010b111bc855405045cb7f12cb7fcbffcbffcb3fc9102901111701562201206e953059f45930944133f413e2810101707f72f82356250502111d0201111d01562401561a01111fc855705078ce15ca0013ca00cb3fcb07cbffcb7fcb1fc9102301111801561201206e953059f45a30944133f415e2019902f40f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e108d105c104b103a49185075041120040311190302111802111e01db3cf80f0611180605111a05041119047f71828873656e742076696120506c6174686f2e417070060511220504111a040311200302111f0201111e011121c8019a019b0002a401fe559082108c2a76b7500bcb1f19cb3f17cb9f15cbff13cb97ce01c8cbff12cbff12cc12cc12cb7fcdc92e0403111b03021117021116014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cba10791028102710461045413301d402fe31fa408308d718d4301116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011119db3c111511161115111411161114019d019e000e813a985611f2f402fc1113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609111608070655408140d81117db3c01111801f2f42c81010b561a59f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e28140d9216eb3f2f46f258140da22019f01a0010672db3c01a401f8c300f2f48140dc561ff90001111e23f91001111d01f2f4111dd0d31f8140dd02821056504131ba12f2f4d3ff8140de025614ba12f2f4fa408140dff82813c70512f2f4fa40d33fd37f8140e2045620c70514f2f48140e322561fbaf2f4f800111da481010b547654562325c855405045cb7f12cb7fcbffcbffcb3fc901a102fe02111402562001206e953059f45930944133f413e2f80f56158eb057125f055717571757171112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf553ae11116111b11161115111a11151114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d01d401a204ee0c111b0c0b111a0b0a11190a091118090807111b0706111a0605111905041118040302111b0201111a01111cdb3c8eb45717571757175717571757175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e5584e1561ed30a308309bae303561d82085b8d80be01a301d401a501a6010674db3c01a40014561201a904a93800c00101685717571757175717571757175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e558401d403fc8eb45717571757175717571757175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e5584e1561982085b8d80be8eb45717571757175717571757175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e5584e1111982085b8d80a101d401d401a702fc81010b21561a561f5623561cc855405045cb7f12cb7fcbffcbffcb3fc9102f562001206e953059f45930944133f413e2f80f561bd749c0008ebf3d571657165717571757175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e104d103c4ba91048103746145053e1561bd74a01d401a804d8c0018ebf3d571657165717571757175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e104d103c4ba91048103746145053e1111bd43020d020d7498102e3bae303d74ac000e303d0fa40d3ffd33fd37fd30fd30730055618c70501d401a901aa01ab01785b3c57155715571657175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e109d103c4b1950a81037553201d40178303c57155715571657175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e109d103c4b1950a81037553201d402fc8ebd5f053c57155715571657175717571757170d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e109d103c4b1950a810375532e11116111a11161115111911151114111811141113111711131112111a11121111111911111110111811100f11170f0e111a0e0d111f0d0c11180c0b11170b01d401ac04f80a111a0a09111f09081118080711170706111a0605111f05041118040311170302111a0201111f01111d5622561856215620561cdb3cdb3c11225622be8eba5717571757175717571757175717571757175717571757175717091116090811150807111407061113060511120504111104031110034fed5529e1112101ad01b001d401b102f41116111b11161115111a11151114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d11170d0c111b0c0b111a0b0a11190a091118090811170807111b0706111a0605111905041118040311170302111b0201111a0111198141001119db3c01111901f2f4814101111701ae01af000cd30a308309ba00dac30001111701f2f4814102111ac30001111a01f2f48141035618c200f2f48141041118c11101111801f2f48141051116c00101111601f2f41111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a104910384715506413000a820ba2c94003fe82085b8d80a1561921be8ec830571657165716571657165716571657165716571657175717091116090811150807111407061113060511120504111104031110034fed109c108b106a1059104810374614400503e1561c8218174876e800bee30311161117111611151116111511141115111411131114111311121113111201d401b201b3019030571657165716571657165716571657165716571657175717091116090811150807111407061113060511120504111104031110034fed109c108b106a105910481037461440050301d403fe1111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001112101562201111f5622db3c288101012259f40c6fa1318ebb305717571757175717571757175717571757175717571757170a11160a091115090811140807111307061112060511110504111004103f4edc550a01b401d401b50030c882105650414901cb1f5003cf16cb3fcbffc9f900a9383f01fae001111901111ea1111b8218174876e800a103111b030201111f01112281010b111bc855405045cb7f12cb7fcbffcbffcb3fc9102a01111701561e01206e953059f45930944133f413e28101018218174876e800f823561f59c855205023cecb7fcb1fc91024561a01206e953059f45a30944133f415e211111116111101b603fe1110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e102d107c106b105a10491038070350651402111d02111a01db3cf80f820b473bc07f718218174876e800f82808111d08178209c9c380561947680511230504112204031121030211200201111e011124c855a0db3cc95613040311150302111a0201b701b901ba02f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609111608070655408141321117db3c840fb901111801f2f41116831fa011151116111511141115111411131114111311121113111211111112111101b801d2000c20ab1fa9380f005482104154481a500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd01801119014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e5566451401d40112e3025f0f5f09f2c08201bc01fcfa408308d718d4302f81010b2459f40b6fa192306ddf206e92306d8e11d0d37fd37fd3ffd3ffd33f55406c156f05e281413d216eb3f2f46f2581413e22c300f2f481414026f900541083f91017f2f404d0d31f81414102821056554e31ba12f2f4d3ff814142025617ba12f2f4fa40814143f82813c70512f2f4fa40d33f01bd02fed37f814146514ac70514f2f48141475328baf2f4f80007a481010b54765453a4c855405045cb7f12cb7fcbffcbffcb3fc90211170252a0206e953059f45930944133f413e2f80f28d30a308309ba8eae57155f081115111611151114111511141113111411131112111311121111111211111110111111100f11100f550ee101d401be03fc2782085b8d80be8eae57155f081115111611151114111511141113111411131112111311121111111211111110111111100f11100f550ee12582085b8d80be8eae57155f081115111611151114111511141113111411131112111311121111111211111110111111100f11100f550ee10582085b8d80a181010b5471542a01d401d401bf04ec561ac855405045cb7f12cb7fcbffcbffcb3fc92a103801206e953059f45930944133f413e2f80f22d749c0008eae57155f081115111611151114111511141113111411131112111311121111111211111110111111100f11100f550ee122d74ac001e30302d43020d020d749810113bee303d74ac00001d401c001c101c2015c57155f081115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e01d4015e10395f093d1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e01d403f48eaf10285f083d1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550ee1d0fa40d30702561cc7058eaf10395f093d1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550ee11116111f11161115111e111501d401d401c304f81114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e103d0c111e0c0b111d0b0a111c0a09111b0908111a08071119070611180605111705103403111e0302111d0201111c0111205620561ddb3ce3035620db3c11161117111611151117111511141117111411131117111301c401c501c601c700d0eda2edfb21c104917f9321c210e2925b70e020d74922aa02bd925b70e020c702925b70e170935302b98e3801d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e2955f0370db31e101a4e83031c700017057175717571757175717571757175717571757170c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d559201d4006081410a21c203f2f481410b21c111f2f420c0049930822009184e72a000e0c005978218e8d4a51000e08218174876e80003f81112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540db3c111c561cbe8ebb571757175717571757175717571757175717571757170b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b55900ce1111b01c801d401c9000a820bc14dc004f882085b8d80a1561921be8ebe3057165716571657165717571757175717571757170b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b0a0908070650c5e156185618bee303111b561ddb3c11171118111711161117111611151116111511141115111411131114111311121113111201d401ca01cb01cc017c3057165716571657165717571757175717571757170b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b0a0908070650c501d40020c88210c5cc7cd601cb1f01cf16c9f90003fe1111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130561d02112001db3c278101012259f40c6fa1318eb93057175717571757175717571757175717571757170c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d5592e001111901111b01cd01d401ce0030c8821056554e4901cb1f5003cf16cb3fcbffc9f900a9383f01fea11117561da1031117030201111e01111981010b1120c855405045cb7f12cb7fcbffcbffcb3fc9102a01111c01561801206e953059f45930944133f413e2810101f823561801561b01c855205023cecb7fcb1fc91023561701206e953059f45a30944133f415e21111111611111110111511100f11140f0e11130e0d11120d01cf02fe0c11110c0b11100b10af109e1d107c106b105a104910384716103504111a04433001111901111adb3cf80f820b65c0407f71f82805111e0504111c048209e848005617443502111f0201112101111dc8557082104154481c5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc95615040311170302111902111b0101d001d302f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609111608070655408141961117db3c840fb901111801f2f41116832fa011151116111511141115111411131114111311121113111211111112111101d101d2000620ab2f00481110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130019a4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a104910384715406401d400e0c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ce1110c8ce1fce1dcb071bca0019cbff07c8cbff16f40014f40012f40001c8f40012f40012f40003c8f40014f40014cb3f14cb3f15cb3f15cb3f15cb3f15cb3f13cd12cdcdcdc9ed546f183aa2');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initVault_init_args({ $$type: 'Vault_init_args', vault_ath_wallet_address, ath_master_address, capsule_hub_address, genesis_config_hash, capsule_hub_bound, sealed, deployment_manifest_hash })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const Vault_errors = {
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

export const Vault_errors_backward = {
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

const Vault_types: ABIType[] = [
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
    {"name":"ATHWalletDataView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PendingAthTransferNotificationView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_ack_value","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingAthOutgoingTransfer","header":null,"fields":[{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"processed_notifications","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_outgoing_transfers","type":{"kind":"dict","key":"int","value":"PendingAthOutgoingTransfer","valueFormat":"ref"}}]},
    {"name":"BindDeploymentManifest","header":2430787787,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"counterpart_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindOfficialAthWallet","header":417017035,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindProfileRegistry","header":1353060611,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindUsernameRegistry","header":1353060612,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"DepositTon","header":716160408,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"WithdrawTon","header":1212947826,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"WithdrawAth","header":4188293172,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"RegisterMessagingKeys","header":1383096026,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"ReplaceMessagingKeys","header":2312521915,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"CreateReceiveIntent","header":2115981365,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"ClaimReceiveIntent","header":2115981366,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"CancelReceiveIntent","header":2115981367,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublishPrivateFromVaultBalance","header":2115981361,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublishPublicFromVaultBalance","header":2115981362,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"SetProfileAvatarFromVaultBalance","header":2115981363,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"MintUsernameFromVaultBalance","header":2115981364,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PrunePendingPublish","header":1913380205,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"TopUpStorageReserve","header":840283645,"fields":[]},
    {"name":"ProfileAvatarTonExcessRefund","header":1353060641,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PendingAthWithdrawal","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingPublish","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"refund_to_vault","type":{"kind":"simple","type":"bool","optional":false}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"refundable_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingProfileAvatarPayment","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingUsernameMintPayment","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ReceiveIntent","header":null,"fields":[{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"settlement_reserve_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UserState","header":null,"fields":[{"name":"ton_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"VaultReceiveIntentView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"commitment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"client_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"settlement_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"ton_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"auth_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultPendingAthWithdrawalView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"profile_registry_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"username_registry_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receive_intent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_profile_avatar_payment_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_username_mint_payment_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_distributed_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_reward_per_message_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_total_allocation_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"Vault$Data","header":null,"fields":[{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"binding_flags","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"users","type":{"kind":"dict","key":"address","value":"UserState","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}},{"name":"receive_intents","type":{"kind":"dict","key":"int","value":"ReceiveIntent","valueFormat":"ref"}},{"name":"processed_ath_deposits","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_ath_withdrawals","type":{"kind":"dict","key":"int","value":"PendingAthWithdrawal","valueFormat":"ref"}},{"name":"pending_publishes","type":{"kind":"dict","key":"int","value":"PendingPublish","valueFormat":"ref"}},{"name":"pending_profile_avatar_payments","type":{"kind":"dict","key":"int","value":"PendingProfileAvatarPayment","valueFormat":"ref"}},{"name":"pending_username_mint_payments","type":{"kind":"dict","key":"int","value":"PendingUsernameMintPayment","valueFormat":"ref"}},{"name":"user_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receive_intent_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_publish_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const Vault_opcodes = {
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
    "BindDeploymentManifest": 2430787787,
    "BindOfficialAthWallet": 417017035,
    "BindProfileRegistry": 1353060611,
    "BindUsernameRegistry": 1353060612,
    "SealGenesis": 974311853,
    "DepositTon": 716160408,
    "WithdrawTon": 1212947826,
    "WithdrawAth": 4188293172,
    "RegisterMessagingKeys": 1383096026,
    "ReplaceMessagingKeys": 2312521915,
    "CreateReceiveIntent": 2115981365,
    "ClaimReceiveIntent": 2115981366,
    "CancelReceiveIntent": 2115981367,
    "PublishPrivateFromVaultBalance": 2115981361,
    "PublishPublicFromVaultBalance": 2115981362,
    "SetProfileAvatarFromVaultBalance": 2115981363,
    "MintUsernameFromVaultBalance": 2115981364,
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "PrunePendingPublish": 1913380205,
    "TopUpStorageReserve": 840283645,
    "ProfileAvatarTonExcessRefund": 1353060641,
}

const Vault_getters: ABIGetter[] = [
    {"name":"get_user","methodId":91785,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultUserView","optional":false}},
    {"name":"get_key_record","methodId":104356,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultKeyRecordView","optional":false}},
    {"name":"get_receive_intent","methodId":118324,"arguments":[{"name":"intentId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultReceiveIntentView","optional":false}},
    {"name":"get_receive_intent_id","methodId":72648,"arguments":[{"name":"senderWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipientWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"clientNonce","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_receive_intent_commitment","methodId":104854,"arguments":[{"name":"intentId","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipientWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"secret32","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_ath_withdrawal","methodId":125951,"arguments":[{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_ath_withdrawal_id","methodId":123302,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_ath_withdrawal_for","methodId":104521,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_canonical_publish_charge","methodId":129116,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"publishKind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sizeClass","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"cryptoSuite","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"VaultGlobalView","optional":false}},
]

export const Vault_getterMapping: { [key: string]: string } = {
    'get_user': 'getGetUser',
    'get_key_record': 'getGetKeyRecord',
    'get_receive_intent': 'getGetReceiveIntent',
    'get_receive_intent_id': 'getGetReceiveIntentId',
    'get_receive_intent_commitment': 'getGetReceiveIntentCommitment',
    'get_pending_ath_withdrawal': 'getGetPendingAthWithdrawal',
    'get_ath_withdrawal_id': 'getGetAthWithdrawalId',
    'get_pending_ath_withdrawal_for': 'getGetPendingAthWithdrawalFor',
    'get_canonical_publish_charge': 'getGetCanonicalPublishCharge',
    'get_global': 'getGetGlobal',
}

const Vault_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindOfficialAthWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindProfileRegistry"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindUsernameRegistry"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"DepositTon"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"WithdrawTon"}},
    {"receiver":"internal","message":{"kind":"typed","type":"WithdrawAth"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ProfileAvatarTonExcessRefund"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RegisterMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"ReplaceMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"CreateReceiveIntent"}},
    {"receiver":"external","message":{"kind":"typed","type":"ClaimReceiveIntent"}},
    {"receiver":"external","message":{"kind":"typed","type":"CancelReceiveIntent"}},
    {"receiver":"external","message":{"kind":"typed","type":"PublishPrivateFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"PublishPublicFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"SetProfileAvatarFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"MintUsernameFromVaultBalance"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CapsuleHubPublishAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PrunePendingPublish"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_VAULT_RESPONSE_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1000000n;
export const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 21000000n;
export const ATH_VAULT_PROFILE_AVATAR_FWD_FEE_ALLOWANCE = 2000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 30000000n;
export const ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT = 2000000n;
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
export const VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT = 5000000n;
export const VAULT_PENDING_PUBLISH_STORAGE_ENDOWMENT = 3000000n;
export const VAULT_PENDING_PUBLISH_STALE_TTL = 86400n;
export const VAULT_PRUNED_PUBLISH_TOMBSTONE_TTL = 86400n;
export const VAULT_DEPOSIT_TON_EXEC_RESERVE = 2000000n;
export const VAULT_STATE_GROWTH_EXEC_RESERVE = 2000000n;
export const VAULT_ATH_NOTIFICATION_ACK_VALUE = 1000000n;
export const VAULT_ATH_WITHDRAW_MIN_VALUE = 40000000n;
export const VAULT_WITHDRAW_TON_EXEC_RESERVE = 2000000n;
export const VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE = 2000000n;
export const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE = 2000000n;
export const ASSET_TON = 1n;
export const ASSET_ATH = 2n;
export const RECEIVE_INTENT_ID_DOMAIN = 1380141380n;
export const RECEIVE_INTENT_COMMITMENT_DOMAIN = 1380139853n;
export const VAULT_RECEIVE_INTENT_SIGNING_DOMAIN = 1448231729n;
export const VAULT_RECEIVE_INTENT_ACTION_CREATE = 1n;
export const VAULT_RECEIVE_INTENT_ACTION_CLAIM = 2n;
export const VAULT_RECEIVE_INTENT_ACTION_CANCEL = 3n;
export const VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN = 1448233777n;
export const VAULT_RECEIVE_INTENT_SETTLEMENT_EXEC_RESERVE = 2000000n;
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
export const UINT160_MOD = 1461501637330902918203684832716283019655932542976n;
export const UINT32_MAX = 4294967295n;
export const ATH_DEPOSIT_ID_DOMAIN = 1094996041n;
export const ATH_WITHDRAWAL_ID_DOMAIN = 1096239428n;
export const KEY_ID_DOMAIN = 1262836041n;
export const PUBLISH_KIND_PRIVATE = 1n;
export const PUBLISH_KIND_PUBLIC = 2n;
export const VAULT_PUBLISH_SIGNING_DOMAIN = 1448100401n;
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
export const SIZE_CLASS_STANDARD = 1n;
export const CRYPTO_SUITE_PUBLIC_NONE = 0n;
export const PLATO_PRIVATE_LONG_TERM_FEE_TON = 10000000n;
export const PLATO_PUBLIC_POST_FEE_TON = 10000000n;
export const PLATO_MIN_PROTOCOL_FEE_TON = 0n;
export const PLATHO_PUBLIC_MARKETING_NOTE_ASCII = 2573421624129493433291659589718684717235138672n;
export const ATH_FULL_DISCOUNT_AMOUNT = 10000000000000n;
export const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH = 15000000000000000n;
export const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH = 0n;
export const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10000000000n;
export const VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE = 8700000n;
export const VAULT_PUBLISH_PRIVATE_HYBRID_1K_LOCAL_EXEC_RESERVE = 12000000n;
export const VAULT_PUBLISH_PRIVATE_HYBRID_2K_LOCAL_EXEC_RESERVE = 13800000n;
export const VAULT_PUBLISH_PRIVATE_HYBRID_4K_LOCAL_EXEC_RESERVE = 17300000n;
export const VAULT_PUBLISH_PRIVATE_HYBRID_8K_LOCAL_EXEC_RESERVE = 24400000n;
export const VAULT_PUBLISH_PRIVATE_HYBRID_16K_LOCAL_EXEC_RESERVE = 38900000n;
export const VAULT_PUBLISH_PRIVATE_HYBRID_32K_LOCAL_EXEC_RESERVE = 67600000n;
export const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE = 4200000n;
export const CAPSULEHUB_PRIVATE_HYBRID_1K_EXEC_RESERVE = 4200000n;
export const CAPSULEHUB_PRIVATE_HYBRID_2K_EXEC_RESERVE = 4300000n;
export const CAPSULEHUB_PRIVATE_HYBRID_4K_EXEC_RESERVE = 4500000n;
export const CAPSULEHUB_PRIVATE_HYBRID_8K_EXEC_RESERVE = 5000000n;
export const CAPSULEHUB_PRIVATE_HYBRID_16K_EXEC_RESERVE = 5800000n;
export const CAPSULEHUB_PRIVATE_HYBRID_32K_EXEC_RESERVE = 7600000n;
export const CAPSULEHUB_PUBLIC_EXEC_RESERVE = 2400000n;
export const CAPSULEHUB_PRIVATE_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 3300000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 7400000n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const CAPSULEHUB_PRIVATE_HEADER0_BITS = 1120n;
export const CAPSULEHUB_PRIVATE_HEADER1_BITS = 240n;
export const CAPSULEHUB_PRIVATE_HEADER0_CELLS = 2n;
export const CAPSULEHUB_PRIVATE_HEADER0_REFS = 1n;
export const CAPSULEHUB_PRIVATE_HEADER1_CELLS = 1n;
export const CAPSULEHUB_PRIVATE_HEADER1_REFS = 0n;
export const CAPSULEHUB_PRIVATE_HYBRID_BODY_OVERHEAD_BYTES = 1204n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS = 576n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS = 1n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS = 0n;
export const CAPSULEHUB_PUBLIC_BODY_MAX_BITS = 8192n;
export const CAPSULEHUB_PUBLIC_BODY_MAX_CELLS = 9n;
export const CAPSULEHUB_PUBLIC_BODY_MAX_REFS = 8n;
export const PROFILE_AVATAR_PRICE_ATH = 100000000000n;
export const PROFILE_AVATAR_NOTIFY_VALUE = 30000000n;
export const PROFILE_AVATAR_MAX_PARTS = 16n;
export const PROFILE_AVATAR_MEDIA_FORMAT_WEBP = 1n;
export const VAULT_PROFILE_AVATAR_LOCAL_EXEC_RESERVE = 6000000n;
export const VAULT_PROFILE_AVATAR_ATH_WALLET_REQUEST_VALUE = 55000000n;
export const VAULT_PROFILE_AVATAR_EXCESS_REFUND_EXEC_RESERVE = 2000000n;
export const USERNAME_PRICE_4_CHARS = 10000000000000n;
export const USERNAME_PRICE_5_CHARS = 1000000000000n;
export const USERNAME_PRICE_6_PLUS_CHARS = 100000000000n;
export const USERNAME_NOTIFY_VALUE = 32000000n;
export const USERNAME_MAX_LENGTH = 16n;
export const USERNAME_NAME_HASH_DOMAIN = 3318512854n;
export const VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE = 6000000n;
export const VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE = 57000000n;
export const VAULT_BINDING_CAPSULE_HUB = 1n;
export const VAULT_BINDING_PROFILE_REGISTRY = 2n;
export const VAULT_BINDING_USERNAME_REGISTRY = 4n;
export const OP_BIND_DEPLOYMENT_MANIFEST = 2430787787n;
export const OP_BIND_OFFICIAL_ATH_WALLET = 417017035n;
export const OP_BIND_PROFILE_REGISTRY = 1353060611n;
export const OP_BIND_USERNAME_REGISTRY = 1353060612n;
export const OP_SEAL_GENESIS = 974311853n;

export class Vault implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = Vault_errors_backward;
    public static readonly opcodes = Vault_opcodes;
    
    static async init(vault_ath_wallet_address: Address, ath_master_address: Address, capsule_hub_address: Address, genesis_config_hash: bigint, capsule_hub_bound: boolean, sealed: boolean, deployment_manifest_hash: bigint) {
        return await Vault_init(vault_ath_wallet_address, ath_master_address, capsule_hub_address, genesis_config_hash, capsule_hub_bound, sealed, deployment_manifest_hash);
    }
    
    static async fromInit(vault_ath_wallet_address: Address, ath_master_address: Address, capsule_hub_address: Address, genesis_config_hash: bigint, capsule_hub_bound: boolean, sealed: boolean, deployment_manifest_hash: bigint) {
        const __gen_init = await Vault_init(vault_ath_wallet_address, ath_master_address, capsule_hub_address, genesis_config_hash, capsule_hub_bound, sealed, deployment_manifest_hash);
        const address = contractAddress(0, __gen_init);
        return new Vault(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new Vault(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  Vault_types,
        getters: Vault_getters,
        receivers: Vault_receivers,
        errors: Vault_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | BindOfficialAthWallet | BindProfileRegistry | BindUsernameRegistry | SealGenesis | DepositTon | AthTransferNotification | WithdrawTon | WithdrawAth | ATHTransferAck | ATHTransferFailed | ProfileAvatarTonExcessRefund | TopUpStorageReserve | RegisterMessagingKeys | CapsuleHubPublishAck | PrunePendingPublish | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindDeploymentManifest') {
            body = beginCell().store(storeBindDeploymentManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindOfficialAthWallet') {
            body = beginCell().store(storeBindOfficialAthWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindProfileRegistry') {
            body = beginCell().store(storeBindProfileRegistry(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindUsernameRegistry') {
            body = beginCell().store(storeBindUsernameRegistry(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'DepositTon') {
            body = beginCell().store(storeDepositTon(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotification') {
            body = beginCell().store(storeAthTransferNotification(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'WithdrawTon') {
            body = beginCell().store(storeWithdrawTon(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'WithdrawAth') {
            body = beginCell().store(storeWithdrawAth(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferAck') {
            body = beginCell().store(storeATHTransferAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferFailed') {
            body = beginCell().store(storeATHTransferFailed(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ProfileAvatarTonExcessRefund') {
            body = beginCell().store(storeProfileAvatarTonExcessRefund(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpStorageReserve') {
            body = beginCell().store(storeTopUpStorageReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RegisterMessagingKeys') {
            body = beginCell().store(storeRegisterMessagingKeys(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CapsuleHubPublishAck') {
            body = beginCell().store(storeCapsuleHubPublishAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PrunePendingPublish') {
            body = beginCell().store(storePrunePendingPublish(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async sendExternal(provider: ContractProvider, message: ReplaceMessagingKeys | CreateReceiveIntent | ClaimReceiveIntent | CancelReceiveIntent | PublishPrivateFromVaultBalance | PublishPublicFromVaultBalance | SetProfileAvatarFromVaultBalance | MintUsernameFromVaultBalance) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ReplaceMessagingKeys') {
            body = beginCell().store(storeReplaceMessagingKeys(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreateReceiveIntent') {
            body = beginCell().store(storeCreateReceiveIntent(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ClaimReceiveIntent') {
            body = beginCell().store(storeClaimReceiveIntent(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CancelReceiveIntent') {
            body = beginCell().store(storeCancelReceiveIntent(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPrivateFromVaultBalance') {
            body = beginCell().store(storePublishPrivateFromVaultBalance(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPublicFromVaultBalance') {
            body = beginCell().store(storePublishPublicFromVaultBalance(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SetProfileAvatarFromVaultBalance') {
            body = beginCell().store(storeSetProfileAvatarFromVaultBalance(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'MintUsernameFromVaultBalance') {
            body = beginCell().store(storeMintUsernameFromVaultBalance(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.external(body);
        
    }
    
    async getGetUser(provider: ContractProvider, owner: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner);
        const source = (await provider.get('get_user', builder.build())).stack;
        const result = loadGetterTupleVaultUserView(source);
        return result;
    }
    
    async getGetKeyRecord(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_key_record', builder.build())).stack;
        const result = loadGetterTupleVaultKeyRecordView(source);
        return result;
    }
    
    async getGetReceiveIntent(provider: ContractProvider, intentId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(intentId);
        const source = (await provider.get('get_receive_intent', builder.build())).stack;
        const result = loadGetterTupleVaultReceiveIntentView(source);
        return result;
    }
    
    async getGetReceiveIntentId(provider: ContractProvider, senderWallet: Address, recipientWallet: Address, asset: bigint, amount: bigint, clientNonce: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(senderWallet);
        builder.writeAddress(recipientWallet);
        builder.writeNumber(asset);
        builder.writeNumber(amount);
        builder.writeNumber(clientNonce);
        const source = (await provider.get('get_receive_intent_id', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetReceiveIntentCommitment(provider: ContractProvider, intentId: bigint, recipientWallet: Address, secret32: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(intentId);
        builder.writeAddress(recipientWallet);
        builder.writeNumber(secret32);
        const source = (await provider.get('get_receive_intent_commitment', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetPendingAthWithdrawal(provider: ContractProvider, queryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(queryId);
        const source = (await provider.get('get_pending_ath_withdrawal', builder.build())).stack;
        const result = loadGetterTupleVaultPendingAthWithdrawalView(source);
        return result;
    }
    
    async getGetAthWithdrawalId(provider: ContractProvider, ownerWallet: Address, queryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(ownerWallet);
        builder.writeNumber(queryId);
        const source = (await provider.get('get_ath_withdrawal_id', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetPendingAthWithdrawalFor(provider: ContractProvider, ownerWallet: Address, queryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(ownerWallet);
        builder.writeNumber(queryId);
        const source = (await provider.get('get_pending_ath_withdrawal_for', builder.build())).stack;
        const result = loadGetterTupleVaultPendingAthWithdrawalView(source);
        return result;
    }
    
    async getGetCanonicalPublishCharge(provider: ContractProvider, owner: Address, publishKind: bigint, sizeClass: bigint, cryptoSuite: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner);
        builder.writeNumber(publishKind);
        builder.writeNumber(sizeClass);
        builder.writeNumber(cryptoSuite);
        const source = (await provider.get('get_canonical_publish_charge', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetGlobal(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_global', builder.build())).stack;
        const result = loadGetterTupleVaultGlobalView(source);
        return result;
    }
    
}