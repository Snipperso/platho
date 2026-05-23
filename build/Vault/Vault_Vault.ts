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

export type RegisterMessagingKeys = {
    $$type: 'RegisterMessagingKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
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
        b_0.storeUint(src.pq_kem_pubkey_hash, 256);
        b_0.storeUint(src.pq_kem_pubkey_len, 16);
        b_0.storeRef(src.pq_kem_pubkey);
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
    const _pq_kem_pubkey = sc_0.loadRef();
    const _crypto_suite_mask = sc_0.loadUintBig(16);
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'RegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleRegisterMessagingKeys(source: RegisterMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
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
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
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
        b_0.storeRef(src.pq_kem_pubkey);
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
    const _pq_kem_pubkey = sc_0.loadRef();
    const _crypto_suite_mask = sc_0.loadUintBig(16);
    return { $$type: 'ReplaceMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleReplaceMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'ReplaceMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleReplaceMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'ReplaceMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleReplaceMessagingKeys(source: ReplaceMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
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
    const _client_nonce = sc_0.loadUintBig(64);
    return { $$type: 'CreateReceiveIntent' as const, asset: _asset, amount: _amount, recipient_wallet: _recipient_wallet, commitment: _commitment, client_nonce: _client_nonce };
}

export function loadTupleCreateReceiveIntent(source: TupleReader) {
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient_wallet = source.readAddress();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    return { $$type: 'CreateReceiveIntent' as const, asset: _asset, amount: _amount, recipient_wallet: _recipient_wallet, commitment: _commitment, client_nonce: _client_nonce };
}

export function loadGetterTupleCreateReceiveIntent(source: TupleReader) {
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient_wallet = source.readAddress();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    return { $$type: 'CreateReceiveIntent' as const, asset: _asset, amount: _amount, recipient_wallet: _recipient_wallet, commitment: _commitment, client_nonce: _client_nonce };
}

export function storeTupleCreateReceiveIntent(source: CreateReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.commitment);
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

export type PublishPrivateFromWallet = {
    $$type: 'PublishPrivateFromWallet';
    client_nonce: bigint;
    max_charge: bigint;
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

export function storePublishPrivateFromWallet(src: PublishPrivateFromWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1751553222, 32);
        b_0.storeUint(src.client_nonce, 64);
        b_0.storeUint(src.max_charge, 128);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        b_0.storeUint(src.header_1_hash, 256);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
        b_0.storeRef(src.body);
    };
}

export function loadPublishPrivateFromWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1751553222) { throw Error('Invalid prefix'); }
    const _client_nonce = sc_0.loadUintBig(64);
    const _max_charge = sc_0.loadUintBig(128);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const _header_1_hash = sc_0.loadUintBig(256);
    const _body_hash = sc_0.loadUintBig(256);
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'PublishPrivateFromWallet' as const, client_nonce: _client_nonce, max_charge: _max_charge, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadTuplePublishPrivateFromWallet(source: TupleReader) {
    const _client_nonce = source.readBigNumber();
    const _max_charge = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'PublishPrivateFromWallet' as const, client_nonce: _client_nonce, max_charge: _max_charge, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadGetterTuplePublishPrivateFromWallet(source: TupleReader) {
    const _client_nonce = source.readBigNumber();
    const _max_charge = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'PublishPrivateFromWallet' as const, client_nonce: _client_nonce, max_charge: _max_charge, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body };
}

export function storeTuplePublishPrivateFromWallet(source: PublishPrivateFromWallet) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.client_nonce);
    builder.writeNumber(source.max_charge);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserPublishPrivateFromWallet(): DictionaryValue<PublishPrivateFromWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPrivateFromWallet(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPrivateFromWallet(src.loadRef().beginParse());
        }
    }
}

export type PublishPublicFromWallet = {
    $$type: 'PublishPublicFromWallet';
    client_nonce: bigint;
    max_charge: bigint;
    header_hash: bigint;
    body_hash: bigint;
    header: Cell;
    body: Cell;
}

export function storePublishPublicFromWallet(src: PublishPublicFromWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2416888070, 32);
        b_0.storeUint(src.client_nonce, 64);
        b_0.storeUint(src.max_charge, 128);
        b_0.storeUint(src.header_hash, 256);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeRef(src.header);
        b_0.storeRef(src.body);
    };
}

export function loadPublishPublicFromWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2416888070) { throw Error('Invalid prefix'); }
    const _client_nonce = sc_0.loadUintBig(64);
    const _max_charge = sc_0.loadUintBig(128);
    const _header_hash = sc_0.loadUintBig(256);
    const _body_hash = sc_0.loadUintBig(256);
    const _header = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'PublishPublicFromWallet' as const, client_nonce: _client_nonce, max_charge: _max_charge, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body };
}

export function loadTuplePublishPublicFromWallet(source: TupleReader) {
    const _client_nonce = source.readBigNumber();
    const _max_charge = source.readBigNumber();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    return { $$type: 'PublishPublicFromWallet' as const, client_nonce: _client_nonce, max_charge: _max_charge, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body };
}

export function loadGetterTuplePublishPublicFromWallet(source: TupleReader) {
    const _client_nonce = source.readBigNumber();
    const _max_charge = source.readBigNumber();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    return { $$type: 'PublishPublicFromWallet' as const, client_nonce: _client_nonce, max_charge: _max_charge, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body };
}

export function storeTuplePublishPublicFromWallet(source: PublishPublicFromWallet) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.client_nonce);
    builder.writeNumber(source.max_charge);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserPublishPublicFromWallet(): DictionaryValue<PublishPublicFromWallet> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPublicFromWallet(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPublicFromWallet(src.loadRef().beginParse());
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
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        b_0.storeUint(src.header_1_hash, 256);
        const b_1 = new Builder();
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
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const _header_1_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _body_hash = sc_1.loadUintBig(256);
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
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
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
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
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
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
    const _publish_id = sc_0.loadUintBig(256);
    const _marketing_note = sc_0.loadUintBig(152);
    const _author_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicFromVault(source: PublishPublicFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
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
    const _nonce = sc_0.loadUintBig(64);
    const _publish_kind = sc_0.loadUintBig(8);
    const _body_hash = sc_0.loadUintBig(256);
    const _refundable_amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function loadTuplePendingPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _refundable_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function loadGetterTuplePendingPublish(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _tombstone = source.readBoolean();
    const _nonce = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _refundable_amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingPublish' as const, owner_wallet: _owner_wallet, tombstone: _tombstone, nonce: _nonce, publish_kind: _publish_kind, body_hash: _body_hash, refundable_amount: _refundable_amount, created_at: _created_at };
}

export function storeTuplePendingPublish(source: PendingPublish) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.tombstone);
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

export type ReceiveIntent = {
    $$type: 'ReceiveIntent';
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: bigint;
    amount: bigint;
    commitment: bigint;
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
        b_0.storeUint(src.client_nonce, 64);
        b_0.storeUint(src.created_at, 32);
        const b_1 = new Builder();
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
    const _created_at = sc_0.loadUintBig(32);
    const sc_1 = sc_0.loadRef().beginParse();
    const _claimed = sc_1.loadBit();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadTupleReceiveIntent(source: TupleReader) {
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadGetterTupleReceiveIntent(source: TupleReader) {
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'ReceiveIntent' as const, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function storeTupleReceiveIntent(source: ReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sender_wallet);
    builder.writeAddress(source.recipient_wallet);
    builder.writeNumber(source.asset);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.commitment);
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
}

export function storeUserState(src: UserState) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.ton_balance, 128);
        b_0.storeUint(src.ath_balance, 128);
        b_0.storeUint(src.current_key_id, 256);
    };
}

export function loadUserState(slice: Slice) {
    const sc_0 = slice;
    const _ton_balance = sc_0.loadUintBig(128);
    const _ath_balance = sc_0.loadUintBig(128);
    const _current_key_id = sc_0.loadUintBig(256);
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id };
}

export function loadTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id };
}

export function loadGetterTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id };
}

export function storeTupleUserState(source: UserState) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
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

export type VaultReceiveIntentView = {
    $$type: 'VaultReceiveIntentView';
    exists: boolean;
    sender_wallet: Address;
    recipient_wallet: Address;
    asset: bigint;
    amount: bigint;
    commitment: bigint;
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
        b_1.storeInt(src.client_nonce, 257);
        const b_2 = new Builder();
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
    const _created_at = sc_2.loadIntBig(257);
    const _claimed = sc_2.loadBit();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadTupleVaultReceiveIntentView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
}

export function loadGetterTupleVaultReceiveIntentView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _sender_wallet = source.readAddress();
    const _recipient_wallet = source.readAddress();
    const _asset = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _commitment = source.readBigNumber();
    const _client_nonce = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _claimed = source.readBoolean();
    return { $$type: 'VaultReceiveIntentView' as const, exists: _exists, sender_wallet: _sender_wallet, recipient_wallet: _recipient_wallet, asset: _asset, amount: _amount, commitment: _commitment, client_nonce: _client_nonce, created_at: _created_at, claimed: _claimed };
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
}

export function storeVaultUserView(src: VaultUserView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.ton_balance, 257);
        b_0.storeInt(src.ath_balance, 257);
        b_0.storeInt(src.current_key_id, 257);
    };
}

export function loadVaultUserView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _ton_balance = sc_0.loadIntBig(257);
    const _ath_balance = sc_0.loadIntBig(257);
    const _current_key_id = sc_0.loadIntBig(257);
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id };
}

export function loadTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id };
}

export function loadGetterTupleVaultUserView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    return { $$type: 'VaultUserView' as const, exists: _exists, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id };
}

export function storeTupleVaultUserView(source: VaultUserView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
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
        b_1.storeInt(src.key_record_count, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.receive_intent_count, 257);
        b_2.storeInt(src.pending_ath_withdrawal_count, 257);
        b_2.storeInt(src.pending_publish_count, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.processed_ath_deposit_count, 257);
        b_3.storeInt(src.pending_publish_stale_ttl, 257);
        b_3.storeInt(src.airdrop_remaining_ath, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.airdrop_distributed_ath, 257);
        b_4.storeInt(src.airdrop_reward_per_message_ath, 257);
        b_4.storeInt(src.airdrop_total_allocation_ath, 257);
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
    const _key_record_count = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _receive_intent_count = sc_2.loadIntBig(257);
    const _pending_ath_withdrawal_count = sc_2.loadIntBig(257);
    const _pending_publish_count = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _processed_ath_deposit_count = sc_3.loadIntBig(257);
    const _pending_publish_stale_ttl = sc_3.loadIntBig(257);
    const _airdrop_remaining_ath = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _airdrop_distributed_ath = sc_4.loadIntBig(257);
    const _airdrop_reward_per_message_ath = sc_4.loadIntBig(257);
    const _airdrop_total_allocation_ath = sc_4.loadIntBig(257);
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function loadTupleVaultGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _capsule_hub_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_publish_stale_ttl = source.readBigNumber();
    const _airdrop_remaining_ath = source.readBigNumber();
    source = source.readTuple();
    const _airdrop_distributed_ath = source.readBigNumber();
    const _airdrop_reward_per_message_ath = source.readBigNumber();
    const _airdrop_total_allocation_ath = source.readBigNumber();
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
}

export function loadGetterTupleVaultGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _capsule_hub_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _vault_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _user_count = source.readBigNumber();
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
    return { $$type: 'VaultGlobalView' as const, sealed: _sealed, capsule_hub_bound: _capsule_hub_bound, deployment_manifest_hash: _deployment_manifest_hash, capsule_hub_address: _capsule_hub_address, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_publish_stale_ttl: _pending_publish_stale_ttl, airdrop_remaining_ath: _airdrop_remaining_ath, airdrop_distributed_ath: _airdrop_distributed_ath, airdrop_reward_per_message_ath: _airdrop_reward_per_message_ath, airdrop_total_allocation_ath: _airdrop_total_allocation_ath };
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
    key_records: Dictionary<bigint, KeyRecord>;
    receive_intents: Dictionary<bigint, ReceiveIntent>;
    processed_ath_deposits: Dictionary<bigint, bigint>;
    pending_ath_withdrawals: Dictionary<bigint, PendingAthWithdrawal>;
    pending_publishes: Dictionary<bigint, PendingPublish>;
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
        b_0.storeBit(src.capsule_hub_bound);
        b_0.storeBit(src.sealed);
        const b_1 = new Builder();
        b_1.storeUint(src.deployment_manifest_hash, 256);
        b_1.storeUint(src.genesis_config_hash, 256);
        b_1.storeDict(src.users, Dictionary.Keys.Address(), dictValueParserUserState());
        b_1.storeDict(src.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord());
        b_1.storeDict(src.receive_intents, Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent());
        const b_2 = new Builder();
        b_2.storeDict(src.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_2.storeDict(src.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal());
        b_2.storeDict(src.pending_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingPublish());
        b_2.storeUint(src.user_count, 64);
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
    const _key_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), sc_1);
    const _receive_intents = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), sc_1);
    const sc_2 = sc_1.loadRef().beginParse();
    const _processed_ath_deposits = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_2);
    const _pending_ath_withdrawals = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), sc_2);
    const _pending_publishes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), sc_2);
    const _user_count = sc_2.loadUintBig(64);
    const _key_record_count = sc_2.loadUintBig(64);
    const _receive_intent_count = sc_2.loadUintBig(64);
    const _processed_ath_deposit_count = sc_2.loadUintBig(64);
    const _pending_ath_withdrawal_count = sc_2.loadUintBig(64);
    const _pending_publish_count = sc_2.loadUintBig(64);
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, capsule_hub_bound: _capsule_hub_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
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
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    source = source.readTuple();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, capsule_hub_bound: _capsule_hub_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
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
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPublish(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, capsule_hub_bound: _capsule_hub_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_publishes: _pending_publishes, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count };
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
    builder.writeCell(source.key_records.size > 0 ? beginCell().storeDictDirect(source.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord()).endCell() : null);
    builder.writeCell(source.receive_intents.size > 0 ? beginCell().storeDictDirect(source.receive_intents, Dictionary.Keys.BigInt(257), dictValueParserReceiveIntent()).endCell() : null);
    builder.writeCell(source.processed_ath_deposits.size > 0 ? beginCell().storeDictDirect(source.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_ath_withdrawals.size > 0 ? beginCell().storeDictDirect(source.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal()).endCell() : null);
    builder.writeCell(source.pending_publishes.size > 0 ? beginCell().storeDictDirect(source.pending_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingPublish()).endCell() : null);
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
    const __code = Cell.fromHex('b5ee9c724102eb01004b56000114ff00f4a413f4bcf2c80b0102016202b904f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e4cfa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d70547000530010ef10cde30d1114e302705613d74920c21fe300de030d0e036611128020d7217021d749c21f9430d31f01de20821041544810bae302208210a4f862c0bae30282108c2a76b7bae3025f0f5f0504070902f430d33fd37f5932011113011114db3c813ebcf8425614c705f2f4813ebd5614c200f2f427810101561659f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813ebe216eb3f2f46f2622813ebf111bba01111a01f2f4111211171112111111161111b10502fa1110111511100f11140f0e11130e0d11170d0c11160c0b11150b0a11140a09111309081117080711160706111506051114050411130403111703021116020111150111145613db3c015618a081010b4313c855205023cb7fcb7fcbffc9102d561501206e953059f45930944133f413e2f8416f24135f03111311191113e80602e61112111811121111111711111110111611100f11150f0e11140e0d11130d011112010b11110b0a11100a109f108e107d106c105b104a1039102810674650144330db3c0111130107810101f45a301112a51111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107855056eb704fa30d33f01311111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3c81407ef8425612c705f2f426810101561559f40d6fa192306ddf206e92306d8e15d0fa40d200d33fd307d3ffd37fd31f55606c176f07e281407f216eb3f2f46f2725e30f111111121111b1080b0c014a814080f82322bbf2f481408124c001f2f4f8416f24135f03db3c0111130106810101f45a30a904f8d33f01311111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3c814088f8425612c705f2f426810101561559f40d6fa192306ddf206e92306d8e15d0fa40d200d33fd307d3ffd37fd31f55606c176f07e2814089216eb3f2f46f2725e30f111111121111b10a0b0c014a81408af82322bbf2f481408b24c002f2f4f8416f24135f03db3c0111130106810101f45a30a9012ef8416f24135f03db3c0111130106810101f45a3005a505a900e21110111111100f11100f10ef10de10cd10bc10ab109a1089107806075504c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54000e311113d31f111404d421821090e2e0cbba8fd75b1112d3fffa4030011113011114db3cdb3c5710813aa20fb31ff2f4813aa35612c300f2f4813aa42cc000923c7f940c5612bae21cf2f40f11110f0e11100e7f0f10ce0d10ac109b108a10791068105710461035440302e021821018db2ccbba1314b70f04fe8ffd5b1112d3fffa4030011113011114db3cdb3c813aa5f842561401c705f2f4813aa65614c201f2f4813aa72ec000917f942e5615bae2f2f4813aa8f842561601c705b3f2f4813aa9f8281113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114091314101102860811140807111407061114060511140504111404031114030211140201111401db3c3e57125614500dc70501111201f2f40e11110e0d11100d10cf10be10bd109c552829b7044ee02182103a12d1adbae3022182102aafbd98bae302218210472d9d7dbae302218210484c1d72ba1216192103fc5b1112d3ff301111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3cdb3c813aac5614c201f2f42d813aad1115ba01111401f2f4813aae2ff2f4813aaff842561301c705b3f2f4813ab05612f828111311141113111211141112111111141111111011141110131415000e813a992fb3f2f4002e813ab62dc300f2f4813ab7c8f842cf16c9f9002ebaf2f402ea0f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114090811140807111407061114060511140504111404031114030211140201111501db3c3d3e011113010bc70501111101f2f40e11100e10df10ce10bd82286a94d74f4300007f0e10bd1c109b108a10791068105710461035404429b704fa5b1112d37f301111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3c813e8a5614c200f2f481010bf8422d5959f40a6fa1318e1e813e8bf8416f24135f0356158208989680a082081e8480a0bef2f405a405e30df842db3c111612a081010bf842111713c8b117e818002a813e8cf8416f24135f03561582081e8480a0bef2f4019055205023cb7fcb7fcbffc9103d1201111501206e953059f45930944133f413e21111111211111110111111100f11100f10ef10de10cd0b0c109a1089107810671056104510344130b702fc5b1112d33fd37fd31ffa40301112111411121111111311111110111411100f11130f0e11140e0d11130d0c11140c0b11130b0a11140a0911130908111408071113070611140605111305041114040311130302111402011115011116db3c813e8df8425614c705f2f4813e8e5615c200f2f4111111121111111011121110b11a04c60f11120f0e11120e0d11120d0c11120c0b11120b0a11120a0911120911120807065540813eca11135617db3c01111401f2f41111111211111110111111100f11100f550e56165614db3c298101012259f40c6fa131e3022c81010b561959f40a6fa1319a1b1c1e0024c882104144504901cb1f58cf16cb3fc9f90001fc305716f8416f24135f0382080f4240be8e55f84282080f4240111470111770111701c855208210472d9d7e5004cb1f12cb3fcb7fcb1fc9140311140302111602011115014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001110111111100f11100f99021114025712571230e20e11120e0d11110d0c11100c1d00b210bf10ae5539c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402fa8e12813e90f8416f24135f0382080f4240bef2f48e15813e8ff8416f24135f038208c65d40bef2f406a406e21112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309111308070655405617db3c015618a081010b4313c855205023cb7fcb7fcbffc9103d12e81f01fe01111901206e953059f45930944133f413e28101012010391201111401561601216e955b59f45a3098c801cf004133f442e206a4f84282080f4240111470111770111701c855208210472d9d7e5004cb1f12cb3fcb7fcb1fc9140311140302111602011115014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb002000e60d11120d0c11110c0b11100b10af109e108d107c109b105a1049103847155063c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5403fe8f7b5b1112d37ffa4030011113011114db3c813e945614c200f2f4813e92f828561601c705b3f2f4813e93f8416f24135f0382081e8480bef2f481010bf8422d5959f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e2813e95216eb3f2f46f23813e96235618bef2f4025616a181010bf8425034c8e021b1222301ac55205023cb7fcb7fcbffc9103e12206e953059f45930944133f413e201111401111370716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001110111211100f11110f0e11100e10df10ce10bd10ac5518b7044a8210f9a44834bae30221821041544811bae30221821041544813bae3022182103215b5fdba24696b7002fa5b1112d33fd37ffa40301112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a0911130908111308071113070611130605111305041113040311130302111302011114011115db3c813e975615c200f2f4813e91f828561701c705b3f2f4813ecbf842111311141113b12503fc1112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114090811140807111407061114060511140504111404031114030211140201111401db3c01111401f2f4813ecc11135616db3c01111401f2f4813e9bf8416f24135f038209c9c380bef2f481010bf8422c599a9a2601f859f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e2813e98216eb3f2f46f23813e99225619bef2f4f8421114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509081115080711150706111506051115052702fe041115040311150302111602011117db3c813e9a298101012359f40c6fa131b3f2f411155617a181010bf84202111602011116011118c855205023cb7fcb7fcbffc9103c0211140201111601206e953059f45930944133f413e21110111211100f11110f0e11100e10df10ce10bd10ac0b108a107910681057104610354403d52802fe0211135615db3c810101f842f8416f24135f03f8231023561a4513561a5062c855505056ce13cececb7f01c8cb7f12cb1fcdc91029561501206e953059f45a30944133f415e201a4707f8040f828031117030211180201111901c855308210415448105005cb1f13cb3fcb7fcecec9561304031115030211160211170143432968016a20fa443070585614db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d02a012488c87001ca0055215023810101cf00cecec92b0114ff00f4a413f4bcf2c80b2c0201622d6204f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba2e383a3b046e058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812bae30220821041544815bae30220821041544817ba2f30313200e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ce30d33fd37f593281378c22c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ce30d33fd37f59328137f022c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403fe8e6730d33fd37f59328138b822c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544819bae302208210472d9d7dbae3022033343500ce30d33fd37f593281392622c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54016430d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed543602f2821089129d5fba8eb230d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e08210a11a7001ba8eb1d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f07363603f68137fa21c200f2f48137fff8416f24135f038208895440bef2f48137fb5391bef2f455525387db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e28137fc216eb3f2f46f23308137fd511abaf2f41047103645768137fe5167db3c500bba16f2f45137a15063810101f45a30655f3702d840155033045177db3c705395db3c707f541db980400ec855308210415448125005cb1f13cb3fcb7fcecec91036105c104a103b103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00552212565701fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa02390052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103555125a043ce30221821041544814bae30221821041544816bae30221821041544818ba3c3e414404da5b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f482083d090081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a15167a1554029db3c705410b5db3c7f541ba7710fc84656573d00e455308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c41a0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00505503c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4517aa1554129db3c704647563f02fc5410b5db3c50dc7f7128544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1057104d103e4cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110371615135740013e4440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed544b04ea5b05d33fd37ffa40fa40d37fd3078138a4f8422bc705f2f48138a5534ac705f2f4105a1049103847bc5398db3c8138a62bc200f2f48138a728c200f2f48138a8536bbef2f48138a9288209c9c380bef2f427db3c208208989680a08138aaf8416f24135f0322bef2f4517ca155412bdb3c705410d54647564202fcdb3c4ae07f7128513f4f13011113011114c855608210415448175008cb1f16cb3f14cb7f12cececb7fcb07cec9106b105b104e10394cd0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0301a110471046415014135743013adb3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed544b043ce30221821041544812bae30221821041544815bae30221821041544817ba454c4d5104fc5b05d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd30730813912f8422ec705f2f4813913537dc705f2f4105d104c103b4aef5376db3c81391429c200f2f48139152ec200f2f48139165369bef2f48139172e8209c9c380bef2f42ddb3c208208989680a0813918f8416f24135f0322bef2f4517aa1554129db3c7046475648035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f455049a9a9a002482080f4240a082086acfc0a082081e8480a003fe5410b5db3c105d104c7f7128516d0605111505041114040311130302111202011116011117c85590821041544819500bcb1f19cb3f17cb7f15ce13cecb7f01c8cbff12cb3f12cb7f12cb0f12cb07cdc91035104a10394cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c90157494a001a58cf8680cf8480f400f400cf810162fb00f8416f24135f035004a11057104615103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed544b004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002f05b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382081e8480bef2f45134a0708040077f07c8598210415448115003cb1fcb3fcb7fc91049473016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00405503565a04f45b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082086acfc0a082081e8480a0bef2f410354014503b541a09db3c555053b6db3c8137eb2481010123565f654e02fc59f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da0810101f82352d0561001c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f544d9052fe12c855308210472d9d7d5005cb1f13cb3fcb7fcb1fcec9104910384b70441359c8cf8580ca00894f5000011000cacf16ce01fa02806acf40f400c901fb0082080f42407009700bc8598210415448115003cb1fcb3fcb7fc9104749301a441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0013c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544819bae302218210472d9d7ebae302218210504e5052ba52555b5e04fe5b05d33fd37ffa40fa40d37fd3078138ae26c200f2f48138aff842105c104b103a49de26db3c1fc7051df2f48138b02ac200f2f48138b1f8416f24135f032b82080f4240a082086acfc0a082081e8480a0bef2f410354014503c541b0cdb3c55505376db3c8138b2248101012359f40c6fa131b3f2f48138b32c8209c9c380565f655301fcbef2f48138b4238101012359f40c6fa131b3f2f4516da0810101f823561001561001c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f29514f104a030211110250dc1034c85550821089129d5f5007cb1f15cb3f13cb7fcb1fcecb07cec923103a48dd441359c8cf8580ca00cf8440ce01fa025400c8806acf40f400c901fb0082080f42407004700ac8598210415448115003cb1fcb3fcb7fc91048483019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103510341023c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fa5b05d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd3073081391c29c200f2f481391df842105f104e103d102c01111001111129db3c01111201c70501111001f2f481391e26c200f2f481391ff8416f24135f032782080f4240a082086acfc0a082081e8480a0bef2f410354014503f541e07db3c555053a6db3c565f6558016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0570026f82ac87001ca0055215023810101cf00cecec901ea813920248101012359f40c6fa131b3f2f481392156118209c9c380bef2f4813922238101012359f40c6fa131b3f2f4516aa0810101f823546bd0c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f2c517c107a06105c041114040311120302111102011110010f1067c85901fe55808210a11a7001500acb1f18cb3f16cb7f14cb1f12cecbffcb3fcb7fcb0fcb07c92804103c4baa441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f424070047004c8598210415448115003cb1fcb3fcb7fc910474730441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010351443305a0036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fc5b05d33fd37fd31f30813804f84227c705f2f481380522c200f2f4478727db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206ee3026f2330813807511bbaf2f4555181380807db3c5009ba16f2f481010120103654471350aa216e955b59f45a3098c801cf004133f442e25046655c5f5d008a3037810101530150994133f40c6fa19401d70030925b6de2813806216eb3f2f481380908ba17f2f45513c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54004c810101f45a301510344013c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fe8ffd5b05d33fd31f30105610451034437727db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e281380e216eb3f2f46f23105910481037469881380f07db3c500bba16f2f4813810f8230882015180a018be17f2f4810101541400546690216e955b59f45a3098c801cf004133f442e2655f60610026c8821041544e4901cb1f01cf16c9f900a9381f008a8101012010395446135099216e955b59f45a3098c801cf004133f442e25034810101f45a304015504403c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54006ae037c00006c12116b08e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c0820201486366017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c648640166db3c810101240259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206e96307070545600e06f237f552065000a01aa1f01a00179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c638670006547543016ac8cf8580ca00cf8440ce01fa02806acf40f400c901fb000f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910585523b702fc5b1112d33fd37f30011113011114db3c27810101561559f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813e9c216eb3f2f46f2622813e9d111cba01111b01f2f4813e9ef84224c705f2f4f8416f24135f03111811191118111711181117111611171116b16a02f01115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001111a01db3c0111130107810101f45a301112a51111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107855056eb702f65b1112d33fd37f30011113011114db3c813ec6f8425614c705f2f4813ec75615c200f2f427810101561559f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813ec8216eb3f2f46f2622813ec9111cba01111b01f2f4111211171112111111161111b16c02fa1110111511100f11140f0e11130e0d11170d0c11160c0b11150b0a11140a09111309081117080711160706111506051114050411130403111703021116020111150111145613db3c015618a081010b4313c855205023cb7fcb7fcbffc9102d561501206e953059f45930944133f413e2f8416f24135f03111311191113e86d02ee1112111811121111111711111110111611100f11150f0e11140e0d11130d011112010b11110b0a11100a109f108e107d106c105b104a103910281067465014433001111a01db3c0111130107810101f45a301112a51111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107855056eb702f4316c2232702282081e8480bc99300182081e8480a1019132e25cbc91319130e220c101915be01112111411121111111311111110111411100f11130f0e11140e0d11130d0c11140c0b11130b0a11140a09111309081114080711130706111406051113050411140403111303021114020111130111145613db3ce86f00a8111712a081010b111712c855205023cb7fcb7fcbffc9103c0211150201111401206e953059f45930944133f413e21110111211100f11110f0e11100e10df10ce10bd10ac0b108a1079106810571046103544301203fc8e665b57121110111211100f11110f0e11100e551dc87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54e021821052705edabae30221821089d648bbbae3022171758103f85b1112d3ffd3ffd3ffd30fd4d30f301112111611121111111511111110111411100f11130f0e11160e0d11150d0c11140c0b11130b0a11160a0911150908111408071113070611160605111505041114040311130302111602011117011118db3c5615561556155619561b561ddb3c81010bf8422d5959f40a6fa131b1767203fc1112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309111308070655405619db3c5614968208989680a0df82081e8480a0813eeef8416f24135f0358bef2f4f842db3c813eef01c000f2f470f8421113111611131112111511121111111411111110111611107be87302f80f11150f0e11140e0d11160d0c11150c0b11140b0a11160a0911150908111408071116070611150605111405041116040311150302111402011116015616561b561b561b561f5622db3c813ef02c8101012359f40c6fa131b3f2f411179305a405df810101f842f823f825561920104b0a111b0a09111f0908111e087d7402e207111d07061120060511210504112204c855b0db3cc9102501111601561101206e953059f45a30944133f415e20ea481010bf842102f11111ec855205023cb7fcb7fcbffc910344cf0206e953059f45930944133f413e2081112080711110706111006105f104e103d4c1b487a456440337fb703fe5b1112d3ffd3ffd3ffd30fd4d30f301112111611121111111511111110111411100f11130f0e11160e0d11150d0c11140c0b11130b0a11160a0911150908111408071113070611160605111505041114040311130302111602011117011118db3c5615561556155619561b561ddb3c81010bf8422d5959f40b6fa192306ddfb17679019c813ee506c30016f2f4813ee604c30014f2f423c0018e11813ee702c00012f2f4813ee821c000f2f48e2023c0028e13813ee902c30012f2f4813eea218104a0baf2f49631813eebf2f0e2e259db3c77015021c0018e176c21d0813eec21d749c000f2f4813eed01d74ac000f2f4e001c002e3025b813eebf2f07800d6207af941813eec03c00a13f2f4813eed01812500baf2f4813ef101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d0813ef221d74923aa02baf2f45331bc9e32813ef322d74ac001f2f401d4309b813ef401d74ac000f2f401e259a101e85b02f8206e92306d9dd0d37fd37fd3ff55206c136f03e2813ef8216eb3f2f46f23813ef921c300f2f42d8101012259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2813efa216eb3f2f46f2c31813efbf84252c0c705f2f4813efc01c000f2f4813efd29841fb9f2f41112111f11121111111e11111110111d1110c57a02fa0f111c0f0e111b0e0d111a0d0c11190c0b11180b0a11170a0911160908111508071114070611130605111f0504111e0403111d0302111c0201111b01111a5625db3c82081e8480a0813efef8416f24135f0358bef2f4f823f82509111809810101c856190b0a11190a09111809081124080711230706112206051121057b7c003a813ee421c001917f9321c002e2f2f4c0019582084c4b40e08209c9c38003fe0411200403111f0302112002111f0155b0db3cc90211140201111001206e953059f45a30944133f415e20ba4f84209111309081112080711110706111006105f104e103d102c102b108a104910385e32041116040311150302111402011116015616561a561a561a561e5621db3c813eff2c8101012359f40c6fa131b3f2f47f7d7e0048c815cbff13cbffcbffc9c882104b45594901cb1f5005cf1613cb1f12cb0fcb0fccc9f90002f8810101f842f823f8257020104b0a111c0a09111f0908111e0807111d07061120060511210504112204c855b0db3cc9102601111601561501206e953059f45a30944133f415e21115a481010bf842102f011110011115c855205023cb7fcb7fcbffc91035102e01111301206e953059f45930944133f413e2091112097f80004850bcce19cb1f17cbff15cbff03c8cbff12cb0fcc12cb0f12cb1f12cb3f12cb1f12cb3fcd00da0811110807111007106f105e104d103c0b109a49185055461604c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54044a8210f780f913bae30221821099ecccfcbae30221821032289374bae302218210686694c6ba82888c8f03fa5b1112d307d37ffa40d3ffd33f301112111511121111111411111110111311100f11150f0e11140e0d11130d0c11150c0b11140b0a11130a0911150908111408071113070611150605111405041113040311150302111402011116011117db3c5613db3c813f525616c200f2f4813f535617c300f2f481010bf8422d59b183840020813f4821c00192317f9301c002e2f2f401fe59f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e2813f56216eb3f2f46f235616c0019d813f5723561abef2f4025618a19e813f5822561abef2f4015618a158e2f8421113111611131112111511121111111411111110111611100f11150f0e11140e0d11160d0c11150c0b11140b0a11160a091115098502e4081114080711160706111506051114050411160403111503021114020111160156185618561b561edb3c813f592b8101012359f40c6fa131b3f2f4813f5af8416f24135f0382086acfc0bef2f481010bf84202111802011116011117c855205023cb7fcb7fcbffc9103c0211140201111501be8601fe206e953059f45930944133f413e2810101f842f8231605111805041117040311190302111a0201111b0170c855705078ce15ce13cb07cb7fcbffcb3fcb1f01c8ca00cdc910340211140201111001206e953059f45a30944133f415e20ea40a11120a0911110908111008107f106e105d104c108b102a1069181067105610258700ac441302c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402f65b1112d3ffd3ff30011113011114db3c29810101561559f40d6fa192306ddf206e92306d8e20d0fa40fa40d307d37fd3ffd33fd31fd401d0d20030181716151443306c186f08e2813f66216eb3f2f46f286c21813f6736b315f2f4813f68f8425004c70513f2f4f842111411161114111311151113111211161112b18902fc1111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a09111509081116080711150706111606051115050411160403111503021116025617021119db3c813f6a1115ba01111401f2f481010bf8422c5959f40a6fa1318e15813f6bf8416f24135f038208b71b00bef2f404a404dff842cc8a02fe1112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130db3c1118c001931115a096011115a01114e281010bf842011116011118c855205023cb7fcb7fcbffc9103c0211140201111601206e953059f45930944133f413e20111120107810101f45a301111a5e88b00de0f11120f0e11110e0d11100d10cf10be10ad109c106b107a10695525c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402fe5b1112d3ff301111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3c29810101561559f40d6fa192306ddf206e92306d8e20d0fa40fa40d307d37fd3ffd33fd31fd401d0d20030181716151443306c186f08e2813f7a216eb3f2f46f285f0432813f7bf8425004b18d02f2c70513f2f4f8421113111511131112111411121111111511111110111411100f11150f0e11140e0d11150d0c11140c0b11150b0a11140a091115090811140807111507061114060511150504111404031115030211140201111501db3c1116c001931116a096011116a01115e281010bf842011117011116c8e88e01a455205023cb7fcb7fcbffc9103c0211150201111401206e953059f45930944133f413e20111130107810101f45a301112a50f11120f0e11110e0d11100d10cf10be10ad109c106b107a105810471036453304b7043ce302218210900ec906bae302218210874e576abae302218210720bdd6dba9098a4af02fc5b1112d33fd37fd307d307d3ffd3ffd3ffd4d4d4301112111a11121111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a111a0a0911190908111808071117070611160605111505041114040311130302111a0201111b01111cdb3c81401af842111311141113111211141112111111141111b19102fe1110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114090811140807111407061114060511140504111404031114030211140201111401db3c01111401f2f481010bf8422c5959f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e281401b216eb3f2f46f233181401c32c3009a9203faf2f481401d11138210686694c671561a561a561a561adb3c01111401f2f481401e561bf9005617baf2f481401f561cf9005616baf2f4814020561df9005615baf2f4f8421112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441307156195619db3c56199ce19303fc81402102bef2f4814022f8416f24135f03561abef2f4f8427156195619db3c1119db3cf8421113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114090811140807111407061114060511140504111404031114030211140201111401561b5616719e9f9403d8db3c81402321c300f2f41112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309111308070655405613db3c814024288101012359f40c6fa131b3f2f4810101f8427071f8231034102302112102561b01561b01c8b4b29502fe55605067ce14ca0012cb3fcb07cbffcb7fcb1fc9102801111d01561d01206e953059f45a30944133f415e206a408111b0807111307061119060511180504111704031116030211150201111c01111d7f111f71111cc855a0db3cc92804103d021117021113014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00969700528210a4f862c0500ccb1f1acb3f18cbff16cb0714cb0712cbffcbff01c8cbff12cc12cc12cc12cb7fcd00dc061112060511110504111004103f4edc102b108a10691038466514c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402fa5b1112d33fd37fd3ffd3ffd4d4301112111611121111111511111110111411100f11130f0e11160e0d11150d0c11140c0b11130b0a11160a0911150908111408071113070611160605111505041114040311130302111602011117011118db3c81402ef842111311141113111211141112111111141111111011141110b19902fc0f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114090811140807111407061114060511140504111404031114030211140201111401db3c01111401f2f481010bf8422c5959f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e281402f216eb3f2f46f233181403032c300f2f48140319a9b000afa4430c00003fc8210900ec9067271702005111805561901db3c01111401f2f48140325618f9005615baf2f48140335619f9005618baf2f4f8421112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130727170db3c561581403402bef2f4814035f8416f24135f035616be9ce19d00b4258210686694c6ba8e253503c301935f0470e002935f0370e102925b70e121c0019331c001e001c00292c002e03070e0058210900ec906ba8e1c03c302935f0470e001c301935f0370e0925b70e0923070e19170e07fe05f057004fcf2f4f842727170db3c1115db3cf8421113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a0911140908111408071114070611140605111405041114040311140302111402011114015617561972db3c81403621c300f2f41112111311121111111311119e9fb4a003a822c0028e9832813fde01c001f2f4813fdf01c000f2f482084c4b40db3ce0813fe003c00113f2f420c0018e9030813fe101c001f2f482084c4b40db3ce0813fe201c002f2f4813fe301c002f2f48208989680db3ce7e7e70024813fd42182085b8d80bef2f482085b8d80a102e61110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309111308070655405613db3c814037288101012359f40c6fa131b3f2f4810101f8427072f8231034102302111d02561e01561b01c855605067ce14ca0012cb3fcb07cbffcb7fcb1fc9102801111901561901b2a102fc206e953059f45a30944133f415e206a47f71828873656e742076696120506c6174686f2e417070f84208111b080711170750650411190403111c0302111d0201111e01111ac8558082108c2a76b7500acb1f18cb3f16cbff14cb9712ce01c8cbff12cbff12cc12cc12cb7fcdc92c0403111103021115021116014343c889a2a300016000f6cf16ca00cf8440ce01fa02806acf40f400c901fb000a11120a091111090811100855771710465045c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5403fc5b1112d3ff301111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3c814074f8425612c705f2f45613db3c278101012259f40d6fa192306ddf206e92306d8e15d0fa40d200d33fd307d3ffd37fd31f55606c176f07e2814075216eb3f2f46f271112111a1112b1b2a504fc1111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a111a0a0911190908111808071117070611160605111505041114040311130302111a0201111901111856165615561c5616db3c814076111dba01111c01f2f45614e30f1111111211111110111111100f11100f10ef10de10cd10bc10abb4a6a8ae02fe814077f8235619bbf2f4f8416f24135f031112111911121111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e106d105c104b103a498007111b0754411706111c060504111c0403111b0302111c01db3c1112111311121111111211111110111111100f11100f550ea9a7011e1114db3c0111130106810101f45a30ab03fcf8416f24135f031112111911121111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e106d105c104b103a498007111b0754411706111c060504111c0403111b0302111c01db3c1112111311121111111211111110111111100f11100f550e1114db3c0111130106a9abad010a316c42db3caa007a702182081e8480bc973082081e8480a19131e25301bc91309131e220c101915be070716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002f62dc1019130e081409c2d81010b2359f40a6fa131f2f48212540be400530ebc92302dde1112111411121111111311111110111411100f11130f0e11140e0d11130d0c11140c0b11130b0a11140a09111309081114080711130706111406051113050411140403111303021114020111130111145613db3c015617a0e8ac009e11171fa1111681010b0fc855205023cb7fcb7fcbffc9103c102d01111401206e953059f45930944133f413e21110111211100f11110f0e11100e10df10ce0b0d108a107910681057104610354430120012810101f45a3005a50500ba109a1089107806075504c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402fce3025714c0001113c12101111301b08e68813ee3f2f01110111211100f11110f0e11100e551dc87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54e05f0f5f04b0b803fe5b1112d3ff301111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411134130db3c814095f8416f24135f0382081e8480bef2f45613db3c278101012259f40d6fa192306ddf206e92306d8e15d0fa40d200d33fd307d3ffd37fd31f55606c176f07e2814092216eb3f2f46f27b1b2b3000c813a982ff2f40006a9383f03fe1112111a11121111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a111a0a0911190908111808071117070611160605111505041114040311130302111a0201111901111856165615561c5616db3c814093111dba01111c01f2f41114e302814094f823111882015180a001111801be01111701b4b5b60028c8561201cbff5004cf1612cb3fcbffcb07c9f900017c57115711571257145714814096f823011113be01111201f2f411121f810101f45a30091112090811110807111007106f105e104d103c4ba0105906074135b701fef2f4f82382015180a020841fbc9330841fde041114048101017f05041114040311130302111a0201111901111ac855605067ce14ca0012cb3fcb07cbffcb7fcb1fc9031110030211130201111101206e953059f45a30944133f415e21112a5091112090811110807111007106f105e104d103c4ba010491078105710464430b700a6c87f01ca00111311121111111055e0011112011113ce01111001ce1ece1cca001aca0008c8cbff17cbff15f40013f400f40001c8f40012f40012f40013cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed540006f2c082020120bac1020120bbbf02f5b9bc8ed44d0d200018e4cfa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d70547000530010ef10cde30d1112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c8debc01240b11100b10af55495503db3c57105f0f6c31bd0104db3cbe0036c882105243494401cb1f5005cf165003cf16cb07cb7fcb3fc9f90002edba689ed44d0d200018e4cfa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d70547000530010ef10cde30d1112111311121111111211111110111111100f11100f550edb3c6cc46c748dec0006081010b2d0259f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e2206e953070705300e06f237f5520020120c2ce020166c3c702edafd276a268690000c7267d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a98981c70919104899c89871014114354a6ba7a1800000c89a7136b6b6b6b6b6b82a3800298008778866f18688890889888908888889088888880888888807888807aa876d9e366eb636c0dec4026c8101012c0259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206e8e8f3070f8287054700020885471115300e06f2c7f55b0c5c60046fa40d31fd3ffd3ffd401d0d3ffd30fd4d30fd31fd33fd31fd33f30108c108b108a10890000020162c8ca02f7a127b513434800063933e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154c4c0e3848c88244ce44c3880a08a1aa535d3d0c00000644d389b5b5b5b5b5b5c151c0014c0043bc43378c344448445044484444444c44444440444844403c44443c38444038437d54736cf1b319b1dadec90208db3cdb3cd5d903f7a25bb513434800063933e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154c4c0e3848c88244ce44c3880a08a1aa535d3d0c00000644d389b5b5b5b5b5b5c151c0014c0043bc43378c344448445444484444445044444440444c44403c44483c384444383444403554b36cf15c42decbcd0104db3ccc002ac882105243434d01cb1f13cbff01cf16cbffc9f90000085f0f6c31020120cfd102edb5c69da89a1a400031c99f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadae0a8e000a60021de219bc61a2224222622242222222422222220222222201e22201eaa1db678d932d9530ded000968101012b0259f40d6fa192306ddf206e92306d8e20d0fa40fa40d307d37fd3ffd33fd31fd401d0d20030181716151443306c186f08e2206e9c3070f828f828705470002070e06f287f5570020120d2dd020120d3d703f9acd376a268690000c7267d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a98981c70919104899c89871014114354a6ba7a1800000c89a7136b6b6b6b6b6b82a3800298008778866f1868889088a08890888888988888888088908880788888787088807086faa8e6d9e2b882f87c0ded4d60104db3cd5002ac882104157494401cb1f58cf16cb3fc9f900a9383f00046c31020120d8da02e9f5da89a1a400031c99f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadae0a8e000a60021de219bc61a2224222622242222222422222220222222201e22201eaa1db678d98cd8edded9008e810101290259f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2206e9a3070f828f828f8287020e06f26317f554003f8abb3ed44d0d200018e4cfa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d70547000530010ef10cde30ddb3c57115711571157115711571157115711571157115711571157115711571157115711dedbdc0090702f92302cde8201518082286a94d74f43000022a18212540be40082286a94d74f430000561305561505561405561805561b05561b055610055610055610515f515f0556120544340018571157110e11100e10df551c02f9b2173b513434800063933e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154c4c0e3848c88244ce44c3880a08a1aa535d3d0c00000644d389b5b5b5b5b5b5c151c0014c0043bc43378c344448445844484444445444444440445044403c444c3c38444838344444343044403042fe0dedf00a6fa40fa40fa40d200d200d401d0d3ffd3fff404f404f404d430d0f404f404f404d33fd33fd33fd33fd33fd33f300e11130e0e11120e0e11110e0e11100e10ef57131111111211111110111111100f11100f550e0114553adb3c57105f0f6c31e00104db3ce103f222c002e302813fc203c00113f2f420c001e302813fc401c002f2f4813fc501c002f2f41112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309081113080711130706111306051113050411130403111303021113020111130182085b8d80111401e2e4e602fe32813fc001c001f2f4813fc101c000f2f41112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309081113080711130706111306051113050411130403111303021113020111130182085b8d8011140182084c4b40db3c01111401a082082dc6c0a082080f4240a0e7e3007882080f4240a08209c9c380a01112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413002fa30813fc301c001f2f41112111311121111111311111110111311100f11130f0e11130e0d11130d0c11130c0b11130b0a11130a09111309081113080711130706111306051113050411130403111303021113020111130182085b8d8011140182084c4b40db3c01111401a082082dc6c0a082080f4240a082083d0900a0e7e5006c8209c9c380a01112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001a88208989680db3c01111401a082083d0900a082080f4240a082083d0900a08209c9c380a01112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130e702f61113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a0911140911140807065540db3c303120822009184e72a000be8e163057131111111211111110111111100f11100f550e70e0822009184e72a00001a101111401a8822009184e72a000a0a5e8ea015881010b2d0259f40b6fa192306ddf206e92306d9dd0d37fd37fd3ff55206c136f03e2206e8e8330db3ce06f23e900067053000074822009184e72a000a9041112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413086bf729e');
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
    {"name":"BindDeploymentManifest","header":2430787787,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"counterpart_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindOfficialAthWallet","header":417017035,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"DepositTon","header":716160408,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"WithdrawTon","header":1212947826,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"WithdrawAth","header":4188293172,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"RegisterMessagingKeys","header":1383096026,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"ReplaceMessagingKeys","header":2312521915,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"CreateReceiveIntent","header":4152424723,"fields":[{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ClaimReceiveIntent","header":2582433020,"fields":[{"name":"intent_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"secret32","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CancelReceiveIntent","header":841519988,"fields":[{"name":"intent_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PublishPrivateFromWallet","header":1751553222,"fields":[{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"max_charge","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublishPublicFromWallet","header":2416888070,"fields":[{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"max_charge","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PrunePendingPublish","header":1913380205,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"TopUpStorageReserve","header":840283645,"fields":[]},
    {"name":"PendingAthWithdrawal","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingPublish","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"refundable_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ReceiveIntent","header":null,"fields":[{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UserState","header":null,"fields":[{"name":"ton_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VaultReceiveIntentView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"commitment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"client_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"ton_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultPendingAthWithdrawalView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receive_intent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_distributed_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_reward_per_message_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_total_allocation_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"Vault$Data","header":null,"fields":[{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"users","type":{"kind":"dict","key":"address","value":"UserState","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}},{"name":"receive_intents","type":{"kind":"dict","key":"int","value":"ReceiveIntent","valueFormat":"ref"}},{"name":"processed_ath_deposits","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_ath_withdrawals","type":{"kind":"dict","key":"int","value":"PendingAthWithdrawal","valueFormat":"ref"}},{"name":"pending_publishes","type":{"kind":"dict","key":"int","value":"PendingPublish","valueFormat":"ref"}},{"name":"user_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receive_intent_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_publish_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
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
    "BindDeploymentManifest": 2430787787,
    "BindOfficialAthWallet": 417017035,
    "SealGenesis": 974311853,
    "DepositTon": 716160408,
    "WithdrawTon": 1212947826,
    "WithdrawAth": 4188293172,
    "RegisterMessagingKeys": 1383096026,
    "ReplaceMessagingKeys": 2312521915,
    "CreateReceiveIntent": 4152424723,
    "ClaimReceiveIntent": 2582433020,
    "CancelReceiveIntent": 841519988,
    "PublishPrivateFromWallet": 1751553222,
    "PublishPublicFromWallet": 2416888070,
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "PrunePendingPublish": 1913380205,
    "TopUpStorageReserve": 840283645,
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
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"DepositTon"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"WithdrawTon"}},
    {"receiver":"internal","message":{"kind":"typed","type":"WithdrawAth"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RegisterMessagingKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ReplaceMessagingKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreateReceiveIntent"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ClaimReceiveIntent"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CancelReceiveIntent"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPrivateFromWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPublicFromWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CapsuleHubPublishAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PrunePendingPublish"}},
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
export const VAULT_ATH_WITHDRAW_MIN_VALUE = 30000000n;
export const VAULT_WITHDRAW_TON_EXEC_RESERVE = 2000000n;
export const VAULT_ATH_WITHDRAW_REFUND_EXEC_RESERVE = 2000000n;
export const VAULT_PRUNE_PENDING_PUBLISH_EXEC_RESERVE = 2000000n;
export const ASSET_TON = 1n;
export const ASSET_ATH = 2n;
export const RECEIVE_INTENT_ID_DOMAIN = 1380141380n;
export const RECEIVE_INTENT_COMMITMENT_DOMAIN = 1380139853n;
export const CRYPTO_SUITE_CLASSICAL = 1n;
export const CRYPTO_SUITE_HYBRID = 2n;
export const MLKEM768_PUBKEY_LEN = 1184n;
export const MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES = 127n;
export const MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES = 41n;
export const MLKEM768_PUBKEY_SNAKE_CELLS = 10n;
export const MLKEM768_PUBKEY_SNAKE_BITS = 9472n;
export const MLKEM768_PUBKEY_SNAKE_REFS = 9n;
export const UINT64_MAX = 18446744073709551615n;
export const UINT64_MOD = 18446744073709551616n;
export const UINT32_MAX = 4294967295n;
export const ATH_DEPOSIT_ID_DOMAIN = 1094996041n;
export const ATH_WITHDRAWAL_ID_DOMAIN = 1096239428n;
export const KEY_ID_DOMAIN = 1262836041n;
export const OP_PUBLISH_PRIVATE_BY_WALLET = 1751553222n;
export const OP_PUBLISH_PUBLIC_BY_WALLET = 2416888070n;
export const PUBLISH_KIND_PRIVATE = 1n;
export const PUBLISH_KIND_PUBLIC = 2n;
export const SIZE_CLASS_STANDARD = 1n;
export const SIZE_CLASS_LONG_TERM = 2n;
export const CRYPTO_SUITE_PUBLIC_NONE = 0n;
export const PLATO_PRIVATE_STANDARD_FEE_TON = 5000000n;
export const PLATO_PRIVATE_LONG_TERM_FEE_TON = 10000000n;
export const PLATO_PUBLIC_POST_FEE_TON = 5000000n;
export const PLATHO_PUBLIC_MARKETING_NOTE_ASCII = 2573421624129493433291659589718684717235138672n;
export const ATH_FULL_DISCOUNT_AMOUNT = 10000000000000n;
export const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH = 30000000000000000n;
export const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10000000000n;
export const VAULT_PUBLISH_LOCAL_EXEC_RESERVE = 6000000n;
export const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE = 4000000n;
export const CAPSULEHUB_PUBLIC_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_PRIVATE_STANDARD_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PUBLIC_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 4000000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 1000000n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const OP_BIND_DEPLOYMENT_MANIFEST = 2430787787n;
export const OP_BIND_OFFICIAL_ATH_WALLET = 417017035n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | BindOfficialAthWallet | SealGenesis | DepositTon | AthTransferNotification | WithdrawTon | WithdrawAth | ATHTransferAck | ATHTransferFailed | TopUpStorageReserve | RegisterMessagingKeys | ReplaceMessagingKeys | CreateReceiveIntent | ClaimReceiveIntent | CancelReceiveIntent | PublishPrivateFromWallet | PublishPublicFromWallet | CapsuleHubPublishAck | PrunePendingPublish | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindDeploymentManifest') {
            body = beginCell().store(storeBindDeploymentManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindOfficialAthWallet') {
            body = beginCell().store(storeBindOfficialAthWallet(message)).endCell();
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpStorageReserve') {
            body = beginCell().store(storeTopUpStorageReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RegisterMessagingKeys') {
            body = beginCell().store(storeRegisterMessagingKeys(message)).endCell();
        }
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPrivateFromWallet') {
            body = beginCell().store(storePublishPrivateFromWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPublicFromWallet') {
            body = beginCell().store(storePublishPublicFromWallet(message)).endCell();
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