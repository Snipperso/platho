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
    const __code = Cell.fromHex('b5ee9c7242020118000100005c8200000114ff00f4a413f4bcf2c80b0001020120000200ee020148000300bb03f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e52fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d6d7054700054700011101111111010efe30d1116e30270561500ef0004000d04fe11148020d7217021d749c21f9430d31f01de20821041544810bae302208210a4f862c0ba8f5930d33f01311113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c81407ef8425614c705f2f427810101561759f40d6fa192306ddf000500f00009000a02f430d33fd37f5932011115011116db3c813ebcf8425616c705f2f4813ebd5616c200f2f428810101561859f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813ebe216eb3f2f46f2622813ebf111dba01111c01f2f411141119111411131118111300f0000602ec1112111711121111111611111110111511100f11190f0e11180e0d11170d0c11160c0b11150b0a11190a09111809081117080711160706111506051119050411180403111703021116020111150111195618db3c03561aa010340281010b5025c855405045cb7f12cb7fcb7fcb3fcbffc9102f561a010107000702fa206e953059f45930944133f413e2f8416f24135f031115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f011114010d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a10391028417016151413db3c0111150108810101f45a301114a511131114111300720008014c1112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10895506011703fa206e92306d8e29d0fa40d3ffd33fd33fd307d3ffd401d0d37fd37fd37fd31f30104a104910481047104610456c1a6f0ae281407f216eb3f2f46f2a288e96f8416f24135f03db3c0111150107810101f45a3006a58ea6814080f82322bbf2f481408126c001f2f4f8416f24135f03db3c0111150107810101f45a3006e200ad00ad000c02cee082108c2a76b7ba8f58d33f01311113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c814088f8425614c705f2f427810101561759f40d6fa192306ddfe05f0f5f0700f0000b03fa206e92306d8e29d0fa40d3ffd33fd33fd307d3ffd401d0d37fd37fd37fd31f30104a104910481047104610456c1a6f0ae2814089216eb3f2f46f2a288e96f8416f24135f03db3c0111150107810101f45a3006a58ea681408af82322bbf2f481408b26c002f2f4f8416f24135f03db3c0111150107810101f45a3006e200ad00ad000c016c1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130011704fed74920c21f97311115d31f1116de21821090e2e0cbba8fe65b1114d3fffa4030011115011116db3cdb3c5712813aa21111b301111101f2f4813aa35614c300f2f4813aa42ec000923e7f940e5614bae21ef2f41111111311111110111211107f11110e11100e0f10ce10bd10ac109b108a10791068105710461035440302e0001200130117000e044c21821018db2ccbbae3022182103a12d1adbae3022182102aafbd98bae302218210472d9d7dba000f00110016001903fe5b1114d3fffa4030011115011116db3cdb3c813aa5f842561601c705f2f4813aa65616c201f2f4813aa75610c000917f9556105617bae2f2f4813aa8f842561801c705b3f2f4813aa9f8281115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c00120013001002ac0b11160b0a11160a091116090811160807111607061116060511160504111604031116030211160201111601db3c571057145616500fc70501111401f2f41110111311100f11120f0e11110e0d11100d10df10be552a0029011703fe5b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3cdb3c813aac5616c201f2f42f813aad1117ba01111601f2f4813aae5611f2f4813aaff842561501c705b3f2f4813ab05614f8281115111611151114111611140012001300140010813a995611b3f2f40030813ab62fc300f2f4813ab7c8f842cf16c9f9005610baf2f402fe1113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a091116090811160807111607061116060511160504111604031116030211160201111701db3c3f5710011115010dc70501111301f2f41110111211100f11110f0e11100e10df82286a94d74f4300000029001500f67f111010df1e10bd10ac109b108a107910681057104610354044c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce1eca001cca000ac8cbff19cbff17f40015f40013f40001c8f40012f40012f40012f40012cb3f13cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5404fe5b1114d37f301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c813e8a5616c200f2f481010bf8422f5959f40a6fa1318e1e813e8bf8416f24135f0356178208989680a082081e8480a0bef2f406a406e30df842db3c111a1400f0001701070018002a813e8cf8416f24135f03561782081e8480a0bef2f401cea081010bf84210241023111b15c855405045cb7f12cb7fcb7fcb3fcbffc9103f1201111701206e953059f45930944133f413e21113111411131112111311121111111211111110111111100f11100f10ef0d0e10bc10ab109a10891078106710561045103441300117043ce302218210484c1d72bae302218210f9a44834bae30221821041544811ba001a00220024006b02fc5b1114d33fd37fd31ffa40301114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a0911150908111608071115070611160605111505041116040311150302111602011117011118db3c813e8df8425616c705f2f4813e8e5617c200f2f400f0001b04fe1113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a0911140911140807065540813eca11155619db3c01111601f2f41113111411131112111311121111111211111110111111100f11100f550e56185616db3c2a8101012259f40c6fa131e3022e81010b0047001c001d001f0024c882104144504901cb1f58cf16cb3fc9f90001fc305718f8416f24135f0382080f4240be8e57f84282080f4240111670111970111901c855208210472d9d7e5004cb1f12cb3fcb7fcb1fc9140311160302111802011117014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0011121113111211111112111199021116025714571430e21110111411100f11130f001e00de0e11120e0d11110d0c11100c553bc87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce1eca001cca000ac8cbff19cbff17f40015f40013f40001c8f40012f40012f40012f40012cb3f13cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402fe561b59f40a6fa1318e12813e90f8416f24135f0382080f4240bef2f48e15813e8ff8416f24135f038208c65d40bef2f407a407e21114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405619db3c03561ca010340107002001f80281010b5025c855405045cb7f12cb7fcb7fcb3fcbffc9103f1201111b01206e953059f45930944133f413e281010120103a1201111601561801216e955b59f45a3098c801cf004133f442e207a4f84282080f4240111670111970111901c855208210472d9d7e5004cb1f12cb3fcb7fcb1fc914031116030211180200210184011117014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000f11140f0e11130e0d11120d0c11110c0b11100b10af109e10bd107c106b105a5544444013011702fe5b1114d37ffa4030011115011116db3c813e945616c200f2f4813e92f828561801c705b3f2f4813e93f8416f24135f0382081e8480bef2f481010bf8422f5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2813e95216eb3f2f46f25813e9625561cbef2f404561aa181010bf8425e5000f0002301ce13c855405045cb7f12cb7fcb7fcb3fcbffc90311100312206e953059f45930944133f413e201111601111570716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001112111411121111111311111110111211100f11110f0e11100e10df10ce551a011702fc5b1114d33fd37ffa40301114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150908111508071115070611150605111505041115040311150302111502011116011117db3c813e975617c200f2f4813e91f828561901c705b3f2f400f0002503fe813ecbf8421115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a091116090811160807111607061116060511160504111604031116030211160201111601db3c01111601f2f4813ecc11155618db3c01111601f2f4813e9b00470047002601fef8416f24135f038209c9c380bef2f481010bf8422e5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2813e98216eb3f2f46f25813e9924561dbef2f4f8421116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e002702f60d11190d0c11180c0b11170b0a11190a0911180908111708071119070611180605111705041119040311180302111a0201111bdb3c813e9a2a8101012359f40c6fa131b3f2f41118561ba181010bf8420411180410230211190201111b01111cc855405045cb7f12cb7fcb7fcb3fcbffc9103c021117020111180100e6002802ea206e953059f45930944133f413e21110111411100f11130f0e11120e0d11110d0c11100c10bf10ae0d108c107b106a10591048103746501413021115020111155617db3c810101f842f8416f24135f03f8231023561c4513561c5062c855505056ce13cececb7f01c8cb7f12cb1fcdc9102a56170100290069016a20fa443070585616db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0002a012488c87001ca0055215023810101cf00cecec9002b0114ff00f4a413f4bcf2c80b002c020162002d006304f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba002e0038003a003b046e058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812bae30220821041544815bae30220821041544817ba002f00300031003200e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ce30d33fd37f593281378c22c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ce30d33fd37f59328137f022c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403fe8e6730d33fd37f59328138b822c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544819bae302208210472d9d7dbae3022000330034003500ce30d33fd37f593281392622c200f2f45151a0708040077f04c8598210415448135003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54016430d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54003602f2821089129d5fba8eb230d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e08210a11a7001ba8eb1d33fd37fd31f5520331068105710461035103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f070036003603f68137fa21c200f2f48137fff8416f24135f038208895440bef2f48137fb5391bef2f455525387db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e28137fc216eb3f2f46f23308137fd511abaf2f41047103645768137fe5167db3c500bba16f2f45137a15063810101f45a3000660060003702d840155033045177db3c705395db3c707f541db980400ec855308210415448125005cb1f13cb3fcb7fcecec91036105c104a103b103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb005522120057005801fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa0200390052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512005b043ce30221821041544814bae30221821041544816bae30221821041544818ba003c003e0041004404da5b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f482083d090081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a15167a1554029db3c705410b5db3c7f541ba7710fc8004600570058003d00e455308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c41a0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00505503c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4517aa1554129db3c70004600480057003f02fc5410b5db3c50dc7f7128544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1057104d103e4cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a1103716151300580040013e4440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54004c04ea5b05d33fd37ffa40fa40d37fd3078138a4f8422bc705f2f48138a5534ac705f2f4105a1049103847bc5398db3c8138a62bc200f2f48138a728c200f2f48138a8536bbef2f48138a9288209c9c380bef2f427db3c208208989680a08138aaf8416f24135f0322bef2f4517ca155412bdb3c705410d5004600480057004202fcdb3c4ae07f7128513f4f13011113011114c855608210415448175008cb1f16cb3f14cb7f12cececb7fcb07cec9106b105b104e10394cd0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0301a1104710464150141300580043013adb3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54004c043ce30221821041544812bae30221821041544815bae30221821041544817ba0045004d004e005204fc5b05d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd30730813912f8422ec705f2f4813913537dc705f2f4105d104c103b4aef5376db3c81391429c200f2f48139152ec200f2f48139165369bef2f48139172e8209c9c380bef2f42ddb3c208208989680a0813918f8416f24135f0322bef2f4517aa1554129db3c700046004800570049035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f45504004700470047000afa4430c000002482080f4240a082086acfc0a082081e8480a003fe5410b5db3c105d104c7f7128516d0605111505041114040311130302111202011116011117c85590821041544819500bcb1f19cb3f17cb7f15ce13cecb7f01c8cbff12cb3f12cb7f12cb0f12cb07cdc91035104a10394cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c9010058004a004b001a58cf8680cf8480f400f400cf810162fb00f8416f24135f035004a11057104615103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54004c004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002f05b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382081e8480bef2f45134a0708040077f07c8598210415448115003cb1fcb3fcb7fc91049473016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004055030057005b04f45b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082086acfc0a082081e8480a0bef2f410354014503b541a09db3c555053b6db3c8137eb2481010123005700600066004f02fc59f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da0810101f82352d0561001c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f544d9052fe12c855308210472d9d7d5005cb1f13cb3fcb7fcb1fcec9104910384b70441359c8cf8580ca00890050005100011000cacf16ce01fa02806acf40f400c901fb0082080f42407009700bc8598210415448115003cb1fcb3fcb7fc9104749301a441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0013c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544819bae302218210472d9d7ebae302218210504e5052ba00530056005c005f04fe5b05d33fd37ffa40fa40d37fd3078138ae26c200f2f48138aff842105c104b103a49de26db3c1fc7051df2f48138b02ac200f2f48138b1f8416f24135f032b82080f4240a082086acfc0a082081e8480a0bef2f410354014503c541b0cdb3c55505376db3c8138b2248101012359f40c6fa131b3f2f48138b32c8209c9c380005700600066005401fcbef2f48138b4238101012359f40c6fa131b3f2f4516da0810101f823561001561001c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f29514f104a030211110250dc1034c85550821089129d5f5007cb1f15cb3f13cb7fcb1fcecb07cec923103a48dd441359c8cf8580ca00cf8440ce01fa02005500c8806acf40f400c901fb0082080f42407004700ac8598210415448115003cb1fcb3fcb7fc91048483019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103510341023c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fa5b05d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd3073081391c29c200f2f481391df842105f104e103d102c01111001111129db3c01111201c70501111001f2f481391e26c200f2f481391ff8416f24135f032782080f4240a082086acfc0a082081e8480a0bef2f410354014503f541e07db3c555053a6db3c0057006000660059016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d000580026f82ac87001ca0055215023810101cf00cecec901ea813920248101012359f40c6fa131b3f2f481392156118209c9c380bef2f4813922238101012359f40c6fa131b3f2f4516aa0810101f823546bd0c855205023cecb7fcb1fc910354180206e953059f45a30944133f415e2717f2c517c107a06105c041114040311120302111102011110010f1067c8005a01fe55808210a11a7001500acb1f18cb3f16cb7f14cb1f12cecbffcb3fcb7fcb0fcb07c92804103c4baa441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f424070047004c8598210415448115003cb1fcb3fcb7fc910474730441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001035144330005b0036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fc5b05d33fd37fd31f30813804f84227c705f2f481380522c200f2f4478727db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206ee3026f2330813807511bbaf2f4555181380807db3c5009ba16f2f481010120103654471350aa216e955b59f45a3098c801cf004133f442e250460066005d0060005e008a3037810101530150994133f40c6fa19401d70030925b6de2813806216eb3f2f481380908ba17f2f45513c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54004c810101f45a301510344013c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404fe8ffd5b05d33fd31f30105610451034437727db3c238101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e281380e216eb3f2f46f23105910481037469881380f07db3c500bba16f2f4813810f8230882015180a018be17f2f4810101541400546690216e955b59f45a3098c801cf004133f442e200660060006100620026c8821041544e4901cb1f01cf16c9f900a9381f008a8101012010395446135099216e955b59f45a3098c801cf004133f442e25034810101f45a304015504403c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54006ae037c00006c12116b08e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c08202014800640067017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c64800650166db3c810101240259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206e96307070545600e06f237f55200066000a01aa1f01a00179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c6380068000654754301fc206e953059f45a30944133f415e201a4707f8040f8280311190302111a0201111b01c855308210415448105005cb1f13cb3fcb7fcecec956150403111703021118021119014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c006a00e2108b107a106910681047103645135042c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce1eca001cca000ac8cbff19cbff17f40015f40013f40001c8f40012f40012f40012f40012cb3f13cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54043ce30221821041544813bae302218210ff3fbcc0bae302218210db1ccdbeba006c006f0075007b02fc5b1114d33fd37f30011115011116db3c28810101561759f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813e9c216eb3f2f46f2622813e9d111eba01111d01f2f4813e9ef84224c705f2f4f8416f24135f03111a111b111a1119111a111911181119111800f0006d02fc1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001111c01db3c0111150108810101f45a301114a51113111411131112111311121111111211111110111111100f11100f0072006e00e210ef10de10cd10bc10ab109a10895506c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce1eca001cca000ac8cbff19cbff17f40015f40013f40001c8f40012f40012f40012f40012cb3f13cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed5402f65b1114d33fd37f30011115011116db3c813ec6f8425616c705f2f4813ec75617c200f2f428810101561759f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2813ec8216eb3f2f46f2622813ec9111eba01111d01f2f411141119111411131118111300f0007002ec1112111711121111111611111110111511100f11190f0e11180e0d11170d0c11160c0b11150b0a11190a09111809081117080711160706111506051119050411180403111703021116020111150111195618db3c03561aa010340281010b5025c855405045cb7f12cb7fcb7fcb3fcbffc9102f561a010107007102f6206e953059f45930944133f413e2f8416f24135f031115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f011114010d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a1039102841701615141301111c01db3c0111150108810101f45a301114a50072007401f0316c2232702282081e8480bc99300182081e8480a1019132e25cbc91319130e220c101915be01114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a09111509081116080711150706111606051115050411160403111503007301e6021116020111150111165615db3c111b14a081010b111b14c855405045cb7f12cb7fcb7fcb3fcbffc9103e0211170201111601206e953059f45930944133f413e21112111411121111111311111110111211100f11110f0e11100e10df10ce0d10ac109b108a10791068105710461035443012010701581113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10895506011703fc5b1114d3ffd31f30011115011116db3c813e9e5616c300f2f4813e9ff823561801bcf2f4813ea0f8238208278d00a0561801bbf2f481010bf8422f5959f40a6fa13181010bf8422f5959f40a6fa131702296308208989680df219682084c4b40a0df20c2009682081e8480a0de813ea1f8416f24135f0358bef2f401e30100f00076007802f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540db3c81010bf842104610354656c855405045cb7f12cb7fcb7fcb3fcbffc90311100312206e953059f45930944133f413e206a411141115111401080077005c1113111411131112111311121111111211111110111111100f11100f10ef106e10cd10bc10ab109a10890708550503fc9305a405dff842db3c10245f04f8421115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160908111608071116070611160605111605041116040311160302111602011116015617db3c81010bf84203111903700201070079007a002ec882105353494401cb1f58cf16cbfff82501cb3fc9f90001c001111b0111197fc855505056cbff13cbffcb3fcb1fcb7fca00c9103c0211150201111701206e953059f45930944133f413e21111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad0c108b107a1069105810471036405504011703fe8f7c5b57141112111411121111111311111110111211100f11110f0e11100e551ddb3c81010bf8422e5959f40b6fa192306ddf206e92306d8e13d0d3ffd3ffd33fd31fd37fd20055506c166f06e2813ea8216eb3f2f46f26813ea932f2f4f842111511191115111411181114111311171113111211161112111111191111e000f0007c007f02e01110111811100f11170f0e11160e0d11190d0c11180c0b11170b0a11160a091119090811180807111707061116060511190504111804031117030211160201111901db3c047003a07020813eaa24843fb9f2f403a481010bf8420511200504111f0403111e03021121020111200106c80107007d01fe55505056cbff13cbffcb3fcb1fcb7fca00c90311100302111b02206e953059f45930944133f413e281010bf8420411190403111a030211180201111b010fc855405045cb7f12cb7fcb7fcb3fcbffc9103c021117021b206e953059f45930944133f413e21110111411100f11130f0e11120e0d11110d0c11100c10bf10ae0d007e00e00c107b106a10591048103746534440c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce1eca001cca000ac8cbff19cbff17f40015f40013f40001c8f40012f40012f40012f40012cb3f13cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54048c21821086a15f92bae3022182103215b5fdba8e9f5b57141112111411121111111311111110111211100f11110f0e11100e551de021821052705edabae30221821089d648bbba008001170084008903fc5b1114d37f301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c813eb25616c200f2f4f842db3c81010bf8422f5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2813eb3216eb3f2f400f000810082008c81010b2e0259f40b6fa192306ddf206e92306d8e13d0d3ffd3ffd33fd31fd37fd20055506c166f06e2813e80216eb3f2f46f26316c2232813e8158f2f4813e82f82358bbf2f401fc6f25813eb425561cbef2f404561aa1111a12a081010bf84256125959f40b6fa192306ddf206e92306d8e13d0d3ffd3ffd33fd31fd37fd20055506c166f06e26f26312581010bf84210571046074663c855505056cbff13cbffcb3fcb1fcb7fca00c90311130312206e953059f45930944133f413e281010bf84204111b04008301cc03111b030211120201111b0105c855405045cb7f12cb7fcb7fcb3fcbffc9103f02111702206e953059f45930944133f413e21113111411131112111311121111111211111110111111100f11100f10ef0d0e10bc10ab109a1089107810671056104510344130011703fc5b1114d3ffd3ffd3ffd30fd4d30f301114111811141113111711131112111611121111111511111110111811100f11170f0e11160e0d11150d0c11180c0b11170b0a11160a091115090811180807111707061116060511150504111804031117030211160201111901111adb3c5615561956195619561d561fdb3c81010b00f0008b008503f8f8422f5959f40a6fa1311114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540561bdb3c5616968208989680a0df82081e8480a0813eeef8416f24135f0358bef2f4f842db3c813eef01c000f2f470f84200900107008602fe1115111a11151114111911141113111811131112111711121111111611111110111a11100f11190f0e11180e0d11170d0c11160c0b111a0b0a11190a09111809081117080711160706111a060511190504111804031117030211160201111a01561a561d5621562156215626db3c813ef02d8101012359f40c6fa131b3f2f40093008702fa111b9306a406df810101f842f823f825561d20104b0a111f0a091121090811240807112307061122060511250504112604c855b0db3cc9102601111a01561501206e953059f45a30944133f415e21112a481010bf842041113040311120302111102011110011115c855405045cb7f12cb7fcb7fcb3fcbffc91034102c00940088016801111101206e953059f45930944133f413e20811140807111307061112060511110504111004103f4e1d4acb08509550074616040117043ce302218210f780f913bae30221821099ecccfcbae30221821032289374ba008a0096009c00a103fc5b1114d3ffd3ffd3ffd30fd4d30f301114111811141113111711131112111611121111111511111110111811100f11170f0e11160e0d11150d0c11180c0b11170b0a11160a091115090811180807111707061116060511150504111804031117030211160201111901111adb3c5615561956195619561d561fdb3c81010b00f0008b008e019c813ee506c30016f2f4813ee604c30014f2f423c0018e11813ee702c00012f2f4813ee821c000f2f48e2023c0028e13813ee902c30012f2f4813eea218104a0baf2f49631813eebf2f0e2e259db3c008c015021c0018e176c21d0813eec21d749c000f2f4813eed01d74ac000f2f4e001c002e3025b813eebf2f0008d00d6207af941813eec03c00a13f2f4813eed01812500baf2f4813ef101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d0813ef221d74923aa02baf2f45331bc9e32813ef322d74ac001f2f401d4309b813ef401d74ac000f2f401e259a101e85b02faf8422f5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2813ef8216eb3f2f46f25813ef921c300f2f456108101012259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2813efa216eb3f2f46f2c31813efbf84252c0c705f2f4813efc01c000f2f4813efd29841fb9f2f400d2008f02fe1114112311141113112211131112112111121111112011111110111f11100f111e0f0e111d0e0d111c0d0c111b0c0b111a0b0a11190a091118090811170807111607061115060511230504112204031121030211200201111f01111e5629db3c82081e8480a0813efef8416f24135f0358bef2f4f823f82509111a0981010100900091003a813ee421c001917f9321c002e2f2f4c0019582084c4b40e08209c9c38002f8c8561b0b0a111b0a09111a090811280807112707061126060511250504112404031123030211240211230155b0db3cc910340211180201111201206e953059f45a30944133f415e20da4f8420b11150b0a11140a09111309081112080711110706111006105f104e103d104c102b0a11160a106910585e4204111a040094009203fa0311190302111802011117015617561c5620562056205625db3c813eff2d8101012359f40c6fa131b3f2f4810101f842f823f8257020104b0a111d0a091121090811240807112307061122060511250504112604c855b0db3cc9102701111a01561701206e953059f45a30944133f415e21119a481010bf842041111040093009400950048c815cbff13cbffcbffc9c882104b45594901cb1f5005cf1613cb1f12cb0fcb0fccc9f900004850bcce19cb1f17cbff15cbff03c8cbff12cb0fcc12cb0f12cb1f12cb3f12cb1f12cb3fcd01b60311140302111502011113011117c855405045cb7f12cb7fcb7fcb3fcbffc91035102f01111301206e953059f45930944133f413e20911140908111308071112070611110605111005104f103e50cd109b1a105946875005034414011703fc5b1114d307d37ffa40d3ffd33f301114111711141113111611131112111511121111111711111110111611100f11150f0e11170e0d11160d0c11150c0b11170b0a11160a0911150908111708071116070611150605111705041116040311150302111702011118011119db3c5616db3c813f525616c200f2f4813f53561900f0009700980020813f4821c00192317f9301c002e2f2f401f4c300f2f481010bf8422f5959f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2813f56216eb3f2f46f25561bc0019d813f5725561cbef2f404561aa19f813f5824561cbef2f403561aa10304e2f8421115111a1115111411191114111311181113111211171112111111161111009902f81110111a11100f11190f0e11180e0d11170d0c11160c0b111a0b0a11190a09111809081117080711160706111a060511190504111804031117030211160201111a01561d561d561d5622db3c813f592c8101012359f40c6fa131b3f2f4813f5af8416f24135f0382086acfc0bef2f481010bf84204111c0403111a0300c4009a01fc0211190201111801111bc855405045cb7f12cb7fcb7fcb3fcbffc9103c0211140201111701206e953059f45930944133f413e2810101f842f8231605111b0504111a040311190302111c0201111d0170c855705078ce15ce13cb07cb7fcbffcb3fcb1f01c8ca00cdc9021116021f206e953059f45a30944133f415e20ba4009b01440a11140a09111309081112080711110706111006105f104e106d4cb048a046734454011702f65b1114d3ffd3ff30011115011116db3c2a810101561759f40d6fa192306ddf206e92306d8e20d0fa40fa40d307d37fd3ffd33fd31fd401d0d20030181716151443306c186f08e2813f66216eb3f2f46f286c21813f6736b315f2f4813f68f8425004c70513f2f4f84211161118111611151117111511141118111400f0009d03f41113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802561902111bdb3c813f6a1117ba01111601f2f481010bf8422e5959f40a6fa131e301f84211141115111400da009e009f002a813f6bf8416f24135f038208b71b00bef2f405a40502fc1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130db3c111cc00194111913a095111912a058e281010bf842102401111a01111cc855405045cb7f12cb7fcb7fcb3fcbffc9103e0211160201111801206e953059f45930944133f413e2010700a001640111140108810101f45a301113a51111111411111110111311100f11120f0e11110e0d11100d10cf10be107d109c108b552701170446e302218210874e576abae302218210720bdd6dbae3025716c0001115c12101111501b000a200a700b500ba02fe5b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c2a810101561759f40d6fa192306ddf206e92306d8e20d0fa40fa40d307d37fd3ffd33fd31fd401d0d20030181716151443306c186f08e2813f7a216eb3f2f400f000a304fc6f285f0432813f7bf8425004c70513f2f4f8421115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a091117090811160807111707061116060511170504111604031117030211160201111701db3c111ac001e30f81010b010700a400a500a60008111a13a0000a111a12a05801d2f842102401111b01111ac855405045cb7f12cb7fcb7fcb3fcbffc9103e0211170201111601206e953059f45930944133f413e20111150108810101f45a301114a51111111411111110111311100f11120f0e11110e0d11100d10cf10be107d109c108b108a10695525011703ba5b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c814074f8425614c705f2f45615db3c288101012259f40d6fa192306ddf00f0010e00a801fa206e92306d8e29d0fa40d3ffd33fd33fd307d3ffd401d0d37fd37fd37fd31f30104a104910481047104610456c1a6f0ae2814075216eb3f2f46f2a1114111f11141113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11180d0c11170c0b11160b0a11150a09111f0908111e0807111d0700a904d406111c0605111b0504111a040311190302111802011117011116561f561d561c561edb3c8140761122ba01112101f2f4561de30f1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130010c00aa00ac011702f6f8416f24135f031114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb00a11200a561f0a0911210908071121070605112105040311210302112101db3c11141115111400ad00ab015a1113111411131112111311121111111211111110111111100f11100f550edb3c0111150107810101f45a3006a500b302fe814077f8235617bbf2f4f8416f24135f031114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb00a11200a561f0a0911210908071121070605112105040311210302112101db3c00ad00b201103150865f0612db3c00ae01f0702182081e8480bc973082081e8480a19131e25301bc91309131e220c101925f03e01114111711141113111611131112111511121111111711111110111611100f11150f0e11170e0d11160d0c11150c0b11170b0a11160a091115090811170807111607061115060511170504111604031115030211170200af03e60111160111155617db3c561181010b561e59f40b6fa192306ddf206e92306d8e13d0d3ffd3ffd33fd31fd37fd20055506c166f06e2206eb38e1130571b111913a01118111911180211180fe30d413001111801111981010b1110c855405045cb7f12cb7fcb7fcb3fcbffc9103d102c01111701010700b000b100b06f2631209552601121ba93572070e294111e16a096111e18a00705e22010341023102601111e0181010b1120c855505056cbff13cbffcb3fcb1fcb7fca00c90211110201111b01561c01206e953059f45930944133f413e20078206e953059f45930944133f413e21111111411111110111311100f11120f0e11110e0d11100d10cf10be0d0c108b107a10691058104710364540433001641114111511141113111411131112111311121111111211111110111111100f11100f550edb3c0111150107810101f45a300600b301f42fc1019130e081409c2f81010b2359f40a6fa131f2f48212540be400205611bc92302fde1114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a091115090811160807111507061116060511150504111604031115030211160200b401f60111150111165615db3c03561ba001111301111ba102111a02111281010b111bc855405045cb7f12cb7fcb7fcb3fcbffc9103e0211170201111601206e953059f45930944133f413e21112111411121111111311111110111211100f11110f0e11100e10df10ce0d10ac109b108a10791068105710461035443012010703c85b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c814095f8416f24135f0382081e8480bef2f45615db3c288101012259f40d6fa192306ddf00f0010e00b601fe206e92306d8e29d0fa40d3ffd33fd33fd307d3ffd401d0d37fd37fd37fd31f30104a104910481047104610456c1a6f0ae2814092216eb3f2f46f2a6c221114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d11160d0c11150c0b111d0b0a111c0a09111b0908111a080711190700b703fe0611180605111705041116040311150302111d0201111c01111b56195617561f5618db3c8140931120ba01111f01f2f41117e303814094f823111b82015180a001111b01be01111a01f2f4f82382015180a020841fbc9330841fde81010170530009111b09102807111907061118060511170504111f045a01111e01111fc8010c00b800b90198571357135713571457165716814096f823011115be01111401f2f4011111011114810101f45a300a11140a09111309081112080711110706111006105f104e103d4cb0106a07080610344130011701ce5590509ace17cbff15cb3f13cb3fcb07cbff01c8cb7f12cb7f12cb7f12cb1fcdc9031112030211150201111301206e953059f45a30944133f415e21114a50a11140a09111309081112080711110706111006105f104e103d4cb0105a1089106810571035443012011701568ea1813ee3f2f01112111411121111111311111110111211100f11110f0e11100e551de05f0f5f06f2c082011702012000bc00c802012000bd00c5020379a000be00c102f7a527da89a1a400031ca5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadadae0a8e000a8e00022202222222021dfc61a2228224022282226223e22262224223c22242222223a222222202238222100ef00bf017c0f111b0f0e111a0e0d11190d0c11180c0b11170b0a11160a091115090811140807111307061112060511110504111004103f4edc5528db3c57105f0f6c5100c00116c813cbffcbffcbffc9db3c00f502f7a791da89a1a400031ca5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadadae0a8e000a8e00022202222222021dfc61a2228223222282226223022262224222e22242222222c22222220222a222100ef00c2013c0f11140f0e11130e0d11120d0c11110c0b11100b554adb3c57105f0f6c5100c30104db3c00c40036c882105243494401cb1f5005cf165003cf16cb07cb7fcb3fc9f90002f9ba689ed44d0d200018e52fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d6d7054700054700011101111111010efe30d111411151114111311141113111211131112111111121111111011111110800ef00c601180f11100f550edb3c6cc66c9600c7006e81010b2f0259f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2206e9730707054700020e06f257f554002012000c900de02012000ca00db02015800cb00d302012000cc00cf02f8aa66ed44d0d200018e52fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d6d7054700054700011101111111010efe30d11141115111411131114111311121113111211111112111111101111111000ef00cd01180f11100f550edb3c6cc66c9600ce007481010b2e0259f40b6fa192306ddf206e92306d8e13d0d3ffd3ffd33fd31fd37fd20055506c166f06e2206e9730707054700070e06f26317f554002f8aba4ed44d0d200018e52fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d6d7054700054700011101111111010efe30d11141115111411131114111311121113111211111112111111101111111000ef00d001180f11100f550edb3c6cdd6c8d00d1026c8101012d0259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206e8e8f3070f8287054700020885471115300e06f2c7f55b000d200f20046fa40d31fd3ffd3ffd401d0d3ffd30fd4d30fd31fd33fd31fd33f30108c108b108a108902016200d400d702f7a127b51343480006394be903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154c4c0e3848c88244ce44c3880a08a1aa535d3d0c00000644d389b5b5b5b5b5b5b5c151c00151c00044404444444043bf8c34445044584450444c4454444c4448445044484444444c444444404448444200ef00d501240f11110f0e11100e10df551cdb3c6cc66c9600d60208db3cdb3c00e600ea02f7a25bb51343480006394be903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154c4c0e3848c88244ce44c3880a08a1aa535d3d0c00000644d389b5b5b5b5b5b5b5c151c00151c00044404444444043bf8c344450445c4450444c4458444c4448445444484444445044444440444c444200ef00d801300f11120f0e11110e0d11100d10cf552bdb3c57105f0f6c5100d90104db3c00da002ac882105243434d01cb1f13cbff01cf16cbffc9f90002f9b5ab7da89a1a400031ca5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadadae0a8e000a8e00022202222222021dfc61a2228223022282226222e22262224222c22242222222a2222222022282221000ef00dc01400f11130f0e11120e0d11110d0c11100c10bf10ae109d5538db3c57105f0f6c5100dd0104db3c00fd02012000df00e202f9b5c69da89a1a400031ca5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadadae0a8e000a8e00022202222222021dfc61a2228222a2228222622282226222422262224222222242222222022222221000ef00e001180f11100f550edb3c6c996cc900e100968101012c0259f40d6fa192306ddf206e92306d8e20d0fa40fa40d307d37fd3ffd33fd31fd401d0d20030181716151443306c186f08e2206e9c3070f828f828705470002070e06f287f557002014800e300e702f9acd376a268690000c7297d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a98981c70919104899c89871014114354a6ba7a1800000c89a7136b6b6b6b6b6b6b82a38002a38000888088888880877f186888a088b088a0889888a88898889088a08890888888988888888088908884000ef00e401280f11110f0e11100e10df551cdb3c57105f0f6c5100e50104db3c00e6002ac882104157494401cb1f58cf16cb3fc9f900a9383f02012000e800eb02f5f5da89a1a400031ca5f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa626071c24644122672261c4050450d529ae9e860000032269c4dadadadadadadae0a8e000a8e00022202222222021dfc61a2228222a222822262228222622242226222422222224222222202222222100ef00e901180f11100f550edb3c6cc66c9600ea008e8101012a0259f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd31f3010261025102410236c166f06e2206e9a3070f828f828f8287020e06f26317f554003f8abb3ed44d0d200018e52fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d6d7054700054700011101111111010efe30ddb3c5712571257125712571257125712571257125712571257125712571200ef00ec00ed009e70561192302ede8201518082286a94d74f43000022a18212540be40082286a94d74f430000561505561705561605561a05561d05561d05561105561105561105561105561005561005561345155043003457125712571257125712571257120e11110e0d11100d10cf552b03f8f2ed44d0d200018e52fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d155055313038e12322091339130e20282286a94d74f430000019134e26d6d6d6d6d6d6d7054700054700011101111111010efe30ddb3c8140105616d74981034bbef2f41115d31f814011028210504c5352ba1200ef00f000f100defa40fa40fa40d200d200d401d0d3ffd3fff404f404f404d430d0f404f404f404f404d33fd33fd33fd33fd33fd33fd33f3011101115111011101114111011101113111011101112111011101111111057151113111411131112111311121111111211111110111111100f11100f550e000e813a985611f2f404fcf2f4d30781401202c00112f2f4d31ffa40d3ffd33fd31fd307d307d307d37fd4d488888823d74a81401325d749c000f2f4561b81010b561059f40b6fa192306ddf206e92306d8e13d0d3ffd3ffd33fd31fd37fd20055506c166f06e281401a216eb3f2f46f2681401b21f2f481401c255615baf2f481401d245614baf2f400f200f200f200f3000001fa81401ef82324bbf2f481401ff8235613bbf2f481402024843fb9f2f48140230282085b8d80be12f2f48140242d82085b8d80bef2f41115112811151114112711141113112611131112112511121111112411111110112311100f11220f0e11210e0d11200d0c111f0c0b111e0b0a111d0a09111c0908111b0807111a0700f402fc061119060511180504111704031116030211280201112901562701562701562701562701112756265626562656265626db3c111dd08308d71881402501c700f2f4111d814026111e5618f91001111d01f2f4f8002c81010b562659f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2206e00f500f60086c88210504c535201cb1f7101cb071acb1f5008cf1616cbff14cb3f12cb1fcb07cb07cb07cb7fccc9c882105650554201cb1f561101cbfff828cf165614cf16ccc9f90002fc8ef93057165716571657165716571757175717571757175718571857191119a410384700111a7081010b1116c855505056cbff13cbffcb3fcb1fcb7fca00c9031113030211110201111401206e953059f45930944133f413e21110111411100e11130e11111112111102111102011110014dfc4ab9478645144033e06f25011700f701f8112ba41121d07053007024d749810300bd92307fde24d74a92307fde2091349a6c3101d3ffd3ffd3ff30e222927f34df1115111b11151114111a11141113111911131112111811121111111711111110111611100f111b0f0e111a0e0d11190d0c11180c0b11170b0a11160a09111b0908111a08071119070611180600f803fc051117050411160403111b0302111a0201112301112d56285628562856265631db3c937f571bdf561a94571d57208ecb5627c0018e3f111dc301955719571f7f8e321120d430d020d749937f571ade20d74ac302937f571ade561991308e10571d571e111bd4d43001111e01111c01e2111f1118e2e30d1118111fe2561800f900fa00fb00b4258210686694c6ba8e253503c301935f0470e002935f0370e102925b70e121c0019331c001e001c00292c002e03070e0058210900ec906ba8e1c03c302935f0470e001c301935f0370e0925b70e0923070e19170e07fe05f0570008c111dc301955719571f7f8e391120d430d020d749937f571ade20d74ac303937f571ade561991308e17571d571d571d111ad4d4d43002111e0201111d01111c59e2111f1118e204ec8e455625c0018e24561ef9005621bd937f5719de561df900562bbd937f5719de561cf9005618bd937f5719de8e18561ef9005621bd937f5719de561cf9005618bd937f5719dee2df70547000561ce301561ce301111ce302011117011125a12004111d0403111c030211240201112f0181010b112ac800fc0104010f011102fe1114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a091115090811160807111507061116060511150504111604031115030211160201112301111f562d562a562a562adb3c562701b9937f571dde56185627b9937f571dde01112301111f00fd010303f222c002e302813fc203c00113f2f420c001e302813fc401c002f2f4813fc501c002f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a091115090811150807111507061115060511150504111504031115030211150200fe0100010202fe32813fc001c001f2f4813fc101c000f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509081115080711150706111506051115050411150403111503021115020111150182085b8d8011160182084c4b40db3c01111601a0010600ff00a882082dc6c0a082080f4240a082080f4240a08209c9c380a01114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413002fa30813fc301c001f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509081115080711150706111506051115050411150403111503021115020111150182085b8d8011160182084c4b40db3c01111601a082082dc6c0a001060101009c82080f4240a082083d0900a08209c9c380a01114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001d80111150182085b8d801116018208989680db3c01111601a082083d0900a082080f4240a082083d0900a08209c9c380a01114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441300106007c1114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035102403fe5f041112111411121111111311111110111211100f11110f0e11100e551d01111f01111b5629562656265626db3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405623db3c1114111511141113111511130105010a010b03a822c0028e9832813fde01c001f2f4813fdf01c000f2f482084c4b40db3ce0813fe003c00113f2f420c0018e9030813fe101c001f2f482084c4b40db3ce0813fe201c002f2f4813fe301c002f2f48208989680db3c01060106010602f61115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540db3c10345f0420822009184e72a000be8e223057151113111411131112111311121111111211111110111111100f11100f550e7001070109016281010b2f0259f40b6fa192306ddf206e92306d8e11d0d37fd37fd37fd33fd3ff55406c156f05e2206e8e8330db3ce06f250108000a705470002000c0e0822009184e72a00001a101111601a8822009184e72a000a0a5822009184e72a000a9041114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441300024813fd42182085b8d80bef2f482085b8d80a102fc1112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540562b562a561b562adb3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a091115091115080706010c010d0028c8561401cbff5004cf1612cb3fcbffcb07c9f90001da55405615db3c5616937f571ddf288101012259f40c6fa131937f571dde0211230201111f0101111801021117021115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451314010e0006a9383f01ea5f0357175717571a571a571a571b571c571c571c571c571d571d571e82085b8d805380b9923027de18a120104e103d021115020111200181010b111bc855505056cbff13cbffcb3fcb1fcb7fca00c90211170201111601561901206e953059f45930944133f413e210341024111a0181010b111ac80110018e55405045cb7f12cb7fcb7fcb3fcbffc9031113030211160201111401206e953059f45930944133f413e20f11140f0e11130e0211120201111101091110094efd0b0950c31a1817011701fe55505056cbff13cbffcb3fcb1fcb7fca00c9102901112501562801206e953059f45930944133f413e202111302011112011129561081010b112ac855405045cb7f12cb7fcb7fcb3fcbffc9102601112601562401206e953059f45930944133f413e2810101f82356240403112403102f01112301562101561401561f015613011203d6015614011128c85590509ace17cbff15cb3f13cb3fcb07cbff01c8cb7f12cb7f12cb7f12cb1fcdc94eb0561001206e953059f45a30944133f415e21111a4111bc001e30f0c11140c0b11130b081112080811110809111009106f105e109d10ab106a108910685e330541340113011501170196571e108c0711160706111806051117050411140403111e03102b0111120111117f1111711117c855a0db3cc92c04103549ee4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00011400528210a4f862c0500ccb1f1acb3f18cbff16cb0714cb0712cbffcbff01c8cbff12cc12cc12cc12cb7fcd01fe571257175717571c1059041113047f71828873656e742076696120506c6174686f2e4170700605111d0504111404103b02111202011110011115c8558082108c2a76b7500acb1f18cb3f16cbff14cb9712ce01c8cbff12cbff12cc12cc12cb7fcdc92c0410354b994343c8cf8580ca00cf8440ce01fa02806acf40f400c90101160024fb000411120405111105109c105b1049104600c2c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce1eca001cca000ac8cbff19cbff17f40015f40013f40001c8f40012f40012f40012f40012cb3f13cb3f13cb3f13cb3f13cb3f13cb3f13cb3fcdcdc9ed54a9dfebcb');
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
    {"name":"TopUpMessageBudget","header":2258722706,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"SetSession","header":4282367168,"fields":[{"name":"session_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"expires_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"RevokeSession","header":3676097982,"fields":[]},
    {"name":"RegisterMessagingKeys","header":1383096026,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"ReplaceMessagingKeys","header":2312521915,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"CreateReceiveIntent","header":4152424723,"fields":[{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ClaimReceiveIntent","header":2582433020,"fields":[{"name":"intent_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"secret32","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CancelReceiveIntent","header":841519988,"fields":[{"name":"intent_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PrunePendingPublish","header":1913380205,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"TopUpStorageReserve","header":840283645,"fields":[]},
    {"name":"PendingAthWithdrawal","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingPublish","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"session_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"budget_epoch","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"capsulehub_call_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_budget_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ReceiveIntent","header":null,"fields":[{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UserState","header":null,"fields":[{"name":"ton_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"message_budget_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"budget_epoch","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"SessionState","header":null,"fields":[{"name":"session_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"session_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"expires_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"message_budget_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultReceiveIntentView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"commitment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"client_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"ton_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"message_budget_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"budget_epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultSessionView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"session_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"session_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"expires_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultPendingAthWithdrawalView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"session_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receive_intent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_distributed_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_reward_per_message_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_total_allocation_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"Vault$Data","header":null,"fields":[{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"users","type":{"kind":"dict","key":"address","value":"UserState","valueFormat":"ref"}},{"name":"sessions","type":{"kind":"dict","key":"address","value":"SessionState","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}},{"name":"receive_intents","type":{"kind":"dict","key":"int","value":"ReceiveIntent","valueFormat":"ref"}},{"name":"processed_ath_deposits","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_ath_withdrawals","type":{"kind":"dict","key":"int","value":"PendingAthWithdrawal","valueFormat":"ref"}},{"name":"pending_publishes","type":{"kind":"dict","key":"int","value":"PendingPublish","valueFormat":"ref"}},{"name":"user_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"session_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receive_intent_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_publish_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
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
    "TopUpStorageReserve": 840283645,
}

const Vault_getters: ABIGetter[] = [
    {"name":"get_user","methodId":91785,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultUserView","optional":false}},
    {"name":"get_session","methodId":103014,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultSessionView","optional":false}},
    {"name":"get_key_record","methodId":104356,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultKeyRecordView","optional":false}},
    {"name":"get_receive_intent","methodId":118324,"arguments":[{"name":"intentId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultReceiveIntentView","optional":false}},
    {"name":"get_receive_intent_id","methodId":72648,"arguments":[{"name":"senderWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipientWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"clientNonce","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_receive_intent_commitment","methodId":104854,"arguments":[{"name":"intentId","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipientWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"secret32","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_ath_withdrawal","methodId":125951,"arguments":[{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_ath_withdrawal_id","methodId":123302,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_ath_withdrawal_for","methodId":104521,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_canonical_session_max_charge","methodId":109915,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"publishKind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sizeClass","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"cryptoSuite","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_session_publish_hash","methodId":71827,"arguments":[{"name":"op","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"sessionId","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sessionNonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"validUntil","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publishKind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sizeClass","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"cryptoSuite","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"maxCharge","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bodyHash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header0","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header1","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"VaultGlobalView","optional":false}},
]

export const Vault_getterMapping: { [key: string]: string } = {
    'get_user': 'getGetUser',
    'get_session': 'getGetSession',
    'get_key_record': 'getGetKeyRecord',
    'get_receive_intent': 'getGetReceiveIntent',
    'get_receive_intent_id': 'getGetReceiveIntentId',
    'get_receive_intent_commitment': 'getGetReceiveIntentCommitment',
    'get_pending_ath_withdrawal': 'getGetPendingAthWithdrawal',
    'get_ath_withdrawal_id': 'getGetAthWithdrawalId',
    'get_pending_ath_withdrawal_for': 'getGetPendingAthWithdrawalFor',
    'get_canonical_session_max_charge': 'getGetCanonicalSessionMaxCharge',
    'get_session_publish_hash': 'getGetSessionPublishHash',
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
    {"receiver":"internal","message":{"kind":"typed","type":"SetSession"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RevokeSession"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpMessageBudget"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RegisterMessagingKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ReplaceMessagingKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreateReceiveIntent"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ClaimReceiveIntent"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CancelReceiveIntent"}},
    {"receiver":"external","message":{"kind":"any"}},
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
export const VAULT_SESSION_STATE_STORAGE_ENDOWMENT = 5000000n;
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
export const MAX_SESSION_TTL = 2592000n;
export const UINT64_MAX = 18446744073709551615n;
export const UINT64_MOD = 18446744073709551616n;
export const UINT32_MAX = 4294967295n;
export const ATH_DEPOSIT_ID_DOMAIN = 1094996041n;
export const ATH_WITHDRAWAL_ID_DOMAIN = 1096239428n;
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
export const PLATHO_PUBLIC_MARKETING_NOTE_ASCII = 2573421624129493433291659589718684717235138672n;
export const ATH_FULL_DISCOUNT_AMOUNT = 10000000000000n;
export const VAULT_ACTIVITY_AIRDROP_TOTAL_ATH = 30000000000000000n;
export const VAULT_ACTIVITY_AIRDROP_REWARD_PER_MESSAGE_ATH = 10000000000n;
export const VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE = 6000000n;
export const VAULT_PENDING_PUBLISH_REFUND_EXEC_RESERVE = 2000000n;
export const INVALID_SESSION_REQUEST_CHARGE_TON = 6000000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | BindOfficialAthWallet | SealGenesis | DepositTon | AthTransferNotification | WithdrawTon | WithdrawAth | ATHTransferAck | ATHTransferFailed | SetSession | RevokeSession | TopUpMessageBudget | TopUpStorageReserve | RegisterMessagingKeys | ReplaceMessagingKeys | CreateReceiveIntent | ClaimReceiveIntent | CancelReceiveIntent | CapsuleHubPublishAck | PrunePendingPublish | null) {
        
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SetSession') {
            body = beginCell().store(storeSetSession(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RevokeSession') {
            body = beginCell().store(storeRevokeSession(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpMessageBudget') {
            body = beginCell().store(storeTopUpMessageBudget(message)).endCell();
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
    
    async sendExternal(provider: ContractProvider, message: Slice) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && message instanceof Slice) {
            body = message.asCell();
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
    
    async getGetSession(provider: ContractProvider, owner: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner);
        const source = (await provider.get('get_session', builder.build())).stack;
        const result = loadGetterTupleVaultSessionView(source);
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
    
    async getGetCanonicalSessionMaxCharge(provider: ContractProvider, owner: Address, publishKind: bigint, sizeClass: bigint, cryptoSuite: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner);
        builder.writeNumber(publishKind);
        builder.writeNumber(sizeClass);
        builder.writeNumber(cryptoSuite);
        const source = (await provider.get('get_canonical_session_max_charge', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetSessionPublishHash(provider: ContractProvider, op: bigint, owner: Address, sessionId: bigint, sessionNonce: bigint, validUntil: bigint, publishKind: bigint, sizeClass: bigint, cryptoSuite: bigint, maxCharge: bigint, bodyHash: bigint, header0: bigint, header1: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(op);
        builder.writeAddress(owner);
        builder.writeNumber(sessionId);
        builder.writeNumber(sessionNonce);
        builder.writeNumber(validUntil);
        builder.writeNumber(publishKind);
        builder.writeNumber(sizeClass);
        builder.writeNumber(cryptoSuite);
        builder.writeNumber(maxCharge);
        builder.writeNumber(bodyHash);
        builder.writeNumber(header0);
        builder.writeNumber(header1);
        const source = (await provider.get('get_session_publish_hash', builder.build())).stack;
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