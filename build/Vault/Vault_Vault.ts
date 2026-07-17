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
    const __code = Cell.fromHex('b5ee9c72420201eb00010000a5c900000114ff00f4a413f4bcf2c80b0001020120000200c0020148000300850130d001d072d721d200d200fa4021103450666f04f86102f862000403feed44d0d200018e70fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de533570c85290cbffca00c9068e133023913693331025e28228354a6ba7a18000069137e26d6d6d6d6d6d6d70547000200e11130e0d11120d0e11110e0e11100e10cf10ce550be30d1117e3027000c100050018046e11158020d7217021d749c21f9430d31f01de20821041544810bae3022082104154481abae3022082104154481cbae3028210a4f862d1ba0006000a000c000e01fa30d33fd37f5932011116011117813a985610f2f4813ebcf8425617c705f2f4813ebd5617c200f2f429810101561959f40d6fa192306ddf206e92306d8e21d0fa40d200fa40fa40d37fd401d0d37fd33f30102710261025102410236c176f07e2813ebe216eb3f2f46f2722813ebf111fba01111e01f2f41115111b1115000702de1114111a11141113111911131112111811121111111711111110111611100f111b0f0e111a0e0d11190d0c11180c0b11170b0a11160a09111b0908111a080711190706111806051117050411160403111b0302111a020111190111185617db3c055620a0105604431381010b5027c80196000801fc55605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9102e561901206e953059f45930944133f413e2f8416f24135f031116111c11161115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e011113010c11120c0b11110b0a11100a109f108e107d106c2b106c105b00090292104a1039111e01db3c0111170109810101f45a30111591a5df1113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10895516005401ea01f830d33fd37f5932011116011117813a985610f2f48140fbf8425617c705f2f48140fc5617c200f2f427810101561959f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e28140fd216eb3f2f46f24218140fe111cba01111b01f2f41118111a1118111711191117111611181116111511171115000b02801114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610355502db3c004e01ea01f830d33fd37f5932011116011117813a985610f2f4814123f8425617c705f2f48141245617c200f2f426810101561959f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e2814125216eb3f2f46f2421814126111cba01111b01f2f41118111a1118111711191117111611181116111511171115000d02801114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610355502db3c004a01ea04fe8ffad33fd39f5932f8425614c705b38ea55b1113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce0288101012259f40d6fa192306ddf206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e2206ee3026f29306c22331116111a1116111511191115e05f0f01ea000f00100017014c5f031113111511131112111411121111111311111110111211100f11110f0e11100e10df551c01ea03fc1114111811141113111711131112111a11121111111911111110111811100f11170f0e111a0e0d11190d0c11180c0b11170b0a111a0a09111909081118080711170706111a0605111905041118040311170302111b0201111c01db3c01111abde3025614561456145614561456145614561456145614561456145614561401b2001100120162571557155715571657160f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c5555103544135901ea02f65614561456145614561456145614562d1115112a11151114112911141113112811131112112711121111112611111110112511100f11240f0e11230e0d11220d0c11210c0b11200b0a111f0a09111e0908111d0807111c0706111b0605111a0504111904031118030211170201111601112e562cdb3c6ce76c77370196001302f8111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107908111f08105755141120db3c111c111d111c111b111c111b111a111b111a006c001402fc1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e112072843fdb3c060504431381010b5027c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103e1201111901206e953059f45930944133f413e201ac001502fe11158ec51113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd109b5518db3c11150c11140c11130c11120c11110c11100c0f10ce0d0b5581df0111160106810101f45a301112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad10ac108b107a0077001600e210690810471036454013c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5400045f08046c5616d74920c21f97311116d31f1117de21821090e2e0cbbae30221821018db2ccbbae30221821050a61103bae30221821050a61104ba0019001b001d001f04fe5b1115d3fffa4030011116011117db3cdb3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540813aa21116db3cb301111701f2f4813aa35617c300f2f4813aa42ec000917f942e5618bae2f2f4813aaa11160023002400b2001a029e5618db3c3f5713011115010df2f4813aabf828561701c705b3f2f40da41112111511121111111411111112111311120f11120f0e11110e111010cf10ad109c108b107a10691058104710364540433001bf01ea03fe5b1115d3fffa4030011116011117db3cdb3c813aa5f842561701c705f2f4813aa65617c201f2f4813aa72fc000917f942f5618bae2f2f4813aa8f842561901c705b3f2f4813aa9f8281116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d00230024001c02c40c11170c0b11170b0a11170a091117090811170807111707061117060511170504111704031117030211170201111701db3c3f57155617500ec70501111501f2f41111111411111110111311100f11120f0e11110e0d11100d10cf10ad109c55281200e201ea04fa5b1115d3fffa4030011116011117db3cdb3c813ab15617c201f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540813ab21116db3cb301111701f2f42d813ab31118ba01111701f2f41113111411130023002401ba001e02e61112111311121111111211111110111111100f11100f550e1115813ab411165617db3c5713011116011112f2f4813ab5f828561701c705b3f2f40ea6021113111511131112111411121111111311111111111211110f11110f111010df10ce10bd10ac109b108a10791068105710461035443001bf01ea043ce3022182103a12d1adbae3022182105355434dbae3022182102aafbd98ba002000220028002a04fa5b1115d3fffa4030011116011117db3cdb3c813ab85617c201f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540813ab91116db3cb301111701f2f42d813aba1118ba01111701f2f41113111411130023002401d5002102d61112111311121111111211111110111111100f11100f550e1115813abb11165617db3c5712011116011111f2f4813abcf828561701c705b3f2f40ea6041113111511131112111411121111111311111110111210df10ce10bd10ac109b108a10791068105710461035440301bf01ea04fe5b1115d3ff301114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411164130db3cdb3c813aac5617c201f2f42e813aad1118ba01111701f2f4813aae1116db3c01111701f2f4813aaff842561601c705b3f2f4813ab05615f8280023002400b200250010813a995610b3f2f4002e813ab62ec300f2f4813ab7c8f842cf16c9f9002fbaf2f402f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a091117090811170807111707061117060511170504111704031117030211170201111801db3c01111801c70501111601f2f411131114111300e2002604981112111311121111111211111110111111100f11100f550e813abd1116db3c01111701f2f4813abe1116db3c01111701f2f4813abf561201111701db3c01111701f2f4813ac056110111170101ba01d501bf002702c0db3c3e3f011115010cf2f4813ac1f828561101c705b3f2f4813ac2f828561001c705b3f2f41112111311121111111211111110111111100f11100f10ef10de8228354a6ba7a180007f50df1e10bc10ab109a108910781067105610451034403301bf01ea01fc5b1115d3fffa4030011116011117813a985610f2f4d0d3ff30813aca21c300f2f4813acbc8f842cf16c9f90022baf2f47fc812cbffca0001111601cbff011116cf16f82301cb3fc91113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035002900d4443012c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed54043ce30221821045564454bae302218210472d9d7dbae30221821041544811ba002b002e0031003903fe5b1115d37f301114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411164130813a985610f2f4813e8a5617c200f2f481010bf8422e5959f40a6fa1318e15813e8cf8416f24135f03561882081e8480a0bef2f4e30ef842db3c31002c0196002d003c813e8bf8416f24135f0356188208989680a082081e8480a0bef2f405a40501f4111c15a0f82381010bf842103610351034111e4770c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103e1201111801206e953059f45930944133f413e21114111511141113111411131112111311121111111211111110111111100f11100f10ef10de0c0d10ab109a108910781067105610451034413001ea01fe5b1115fa40301114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411164130813a985610f2f42c81010b561859f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2814204216eb3f2f4002f01fc6f27135f0381420504c00014f2f481420602c00012f2f4814207f8235003a1820bc26700bc12f2f4209c500c810101f45a3004a5040b9130e2011116010c81010bf4593004a51114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd104c10ab109a10891078106705061034003000d24130c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5401fc5b1115d33fd39fd37ffa40301115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a0911170908111608071117070611160605111705041116040311170302111602011118011119813a985610f2f4813e8df8425617c705003202fef2f4813e8e5619c200f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540813eca1116561adb3c01111701f2f41114111511141113111411131112111311121111111211111110111111100f11100f550e01bf003303fe56195618db3c2b8101012259f40c6fa131e3022d81010b561c59f40a6fa1318e12813e90f8416f24135f0382080f4240bef2f48e15813e8ff8416f24135f038208c65d40bef2f406a406e21115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0034003500370024c882104144504901cb1f58cf16cb3fc9f90001f8305719f8416f24135f0382080f4240be8e4bf84282080f4240111870111870111b01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc9140311180302111702011119014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0099021117025715571530e21111111511111110111411100f11130f0e11120e003600ee0d11110d0c11100c10bf10ae109d5538c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5402fe0b11160b0a11160a0911160911160807065540561adb3c055620a0105604431381010b5027c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103e1201111c01206e953059f45930944133f413e281010120103b1201111701561a01216e955b59f45a3098c801cf004133f442e201a4f84282080f42401118701118700196003801d4111b01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc9140311180302111702011119014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d106b109a104910384715400601ea043ce30221821041544813bae30221821050a61121bae3022182103215b5fdba003a00480058005c04f25b1115d33fd37f30011116011117813a985610f2f426810101561859f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e2206eb3e3023027810101561859f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e2206eb3e30230f8425616c705e302298101015618003b00400045004604fa6f2421814114111dba01111c01f2f4f8421115111911151114111811141113111711131112111611121111111911111110111811100f11170f0e11160e0d11190d0c11180c0b11170b0a11160a0911190908111808071117070611160605111905041118040311170302111602011119011118db3c01111901c705e30f003c003d003e003f01085611db3c00e201d45716571757180111160102810101f45a3011118ed40f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a1039487010464154db3c03111503051114050211130211120111110106111006103f105e4dbc106a1039105847164554df007c01fa814115f8425616c705f2f41114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a1039486607044313db3c03111503051114050211130211120111110106111006103f105e4dbc106a1039105847164554004a01580f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a103948701046415401ea04fa6f24218140ec111dba01111c01f2f4f8421115111911151114111811141113111711131112111611121111111911111110111811100f11170f0e11160e0d11190d0c11180c0b11170b0a11160a0911190908111808071117070611160605111905041118040311170302111602011119011118db3c01111901c705e30f004100420043004401085612db3c00e201d65716571757180111160103810101f45a3011118ed50f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a103910281047454612db3c03111503051114050211130211120111110107111007103f105e4dbc107a1039105847564140df008001fa8140edf8425616c705f2f41114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a1039486607044313db3c03111503051114050211130211120111110107111007103f105e4dbc107a1039105847564140004e015a0f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a10391028104745461201ea014c571657161113111511131112111411121111111311111110111211100f11110f0e11100e551d01ea02f859f40d6fa192306ddf206e92306d8e21d0fa40d200fa40fa40d37fd401d0d37fd33f30102710261025102410236c176f07e2813e9c216eb3f2f46f2722813e9d1120ba01111f01f2f4813e9ef84224c705f2f4f8416f24135f0325111f01db3c0111160109810101f45a30111691a5df1113111511131112111411120054004701441111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a551601ea03fe5b1115d33fd37f30011116011117813a985610f2f426810101561859f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e2206eb3e3023027810101561859f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e2206eb3e30230813ec6f8425617c705f2f4813ec75618c200f2f40049004d005102e46f242181411e111dba01111c01f2f481411ff842561ac705f2f41118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610355503db3c004a01ea02e4301115111911151114111811141113111711131112111611121111111911111110111811100f11170f0e11160e0d11190d0c11180c0b11170b0a11160a09111909081118080711170706111606051119050411180403111703021116020111190111185616db3c111f15a081010b111f15c80196004b01dc55605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103d0211190201111701206e953059f45930944133f413e20111150104810101f45a301116e3011111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d102c107b106a10591048103744440506004c01ba1111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d102c107b106a10591048103744440506db3c06111506011114010311130311120611110601111001103f0e106d1c103b0a10691028103706415504007c02e46f24218140f6111dba01111c01f2f48140f7f842561ac705f2f41118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610355503db3c004e01ea02e4301115111911151114111811141113111711131112111611121111111911111110111811100f11170f0e11160e0d11190d0c11180c0b11170b0a11160a09111909081118080711170706111606051119050411180403111703021116020111190111185616db3c111f15a081010b111f15c80196004f01da55605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103d0211190201111701206e953059f45930944133f413e20111150105810101f45a301116e3011111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d103c107b106a10595e344614505213005001b61111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d103c107b106a10595e344614505213db3c07111507011114010311130311120711110701111001103f0e107d1c103b0a107910281037065513008001fe29810101561859f40d6fa192306ddf206e92306d8e21d0fa40d200fa40fa40d37fd401d0d37fd33f30102710261025102410236c176f07e2813ec8216eb3f2f46f2722813ec91120ba01111f01f2f41115111b11151114111a11141113111911131112111811121111111711111110111611100f111b0f0e111a0e0d11190d005202f40c11180c0b11170b0a11160a09111b0908111a080711190706111806051117050411160403111b0302111a020111190111185617db3c055620a0105604431381010b5027c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9102e561901206e953059f45930944133f413e2f8416f24135f031116111c11160196005302fc1115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e011113010c11120c0b11110b0a11100a109f108e107d106c2b106c105b104a1039111f01db3c0111160109810101f45a30111691a5df1113111511131112111411121111111311111110111211100f11110f0054005701f0316c42702182081e8480bc973082081e8480a19131e25301bc91309131e220c101915be01115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a091117090811160807111707061116060511170504111604005502fe03111703021116020111170111165617db3c111d16a081010b111d16c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103d0211170201111801206e953059f45930944133f413e21113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd0c109b108a10791068105710461035019600560004440300f20e11100e10df10ce10bd10ac109b108a5516c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5403fc5b1115d33f31fa40d37f30011116011117813a985610f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655408141281116db3c01111701f2f4814129f8425613c705f2f481412a11165617db3c0111170101ba01bf005902f6f2f481412b5618c200f2f42b81010b561859f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e281412c216eb3f2f4f8416f24135f0382081e8480bb8ea530571657161112111511121111111411111110111311100f11120f0e11110e0d11100d552ce0f8416f24135f0301ea005a02f882081e8480a120561abc9130925719e25618c1018ea530571657161112111511121111111411111110111311100f11120f0e11110e0d11100d552ce06f27111e16a081010b111e16c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103c0211180201111701206e953059f45930944133f413e211121115111201ea005b015c1111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad0c108b107a106910581047103640550401ea048c8ea75b57151113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce021821052705edabae302218210874e5771bae302218210720bdd6eba01ea005d0065007001fe5b1115d3ffd3ffd3ffd430d0d3ffd30fd4d30f301115111a11151114111911141113111811131112111711121111111611111110111a11100f11190f0e11180e0d11170d0c11160c0b111a0b0a11190a09111809081117080711160706111a060511190504111804031117030211160201111b01111c813a985610f2f4561a005e04f6561a56195619561f5621db3c813ef65619c300f2f4813ef75619561bbdf2f481010bf8422e5959f40a6fa1311115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540561ddb3c5617e301005f013d006100620160813ee506c30016f2f4813ee604c30014f2f4813eeb24c002f2f4813ee902c30012f2f4813eea218104a0baf2f459db3c006000e8813eeb02c00212f2f4207af941813eec03c00a13f2f4813eed01812500baf2f4813ef101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d0813ef221d74923aa02baf2f45331bc9e32813ef322d74ac001f2f401d4309b813ef401d74ac000f2f401e259a101e85b000c8208989680a002f882081e8480a0813eeef8416f24135f0358bef2f4f842db3c3132813eef03c00013f2f470f8421116111b11161115111a11151114111911141113111811131112111711121111111b11111110111a11100f11190f0e11180e0d11170d0c111b0c0b111a0b0a11190a091118090811170807111b0706111a06051119050196006303fe041118040311170302111b0201111a01561a56225622562156215628db3c813ef02d8101012359f40c6fa131b3f2f4111c9305a405df810101f842f823f825561d20104b0a111f0a091126090811250807112307061122060511270504112804c855b0db3cc9102601111c01561601206e953059f45a30944133f415e21112014a014d006401eaa4f82381010bf84206111406051113050411170403111a0302111202011112011116c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c91023102c01111001206e953059f45930944133f413e20811150807111407061113060511120504111104031110034fe0109d0c0b0a090706503308451501ea02fe5b1115d3ffd33f30011116011117813a985610f2f48140a6f8425615c705f2f45616db3c298101012259f40d6fa192306ddf206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e28140a7216eb3f2f46f29303334038140a8111eba01111d01f2f41116111a111611151119111511141118111401a1006602fe1113111711131112111a11121111111911111110111811100f11170f0e111a0e0d11190d0c11180c0b11170b0a111a0a09111909081118080711170706111a0605111905041118040311170302111a0201111901561701111adb3c5615561556155615561556155615561556155615561556155615561556155615561556150067006a01f22fc101915be081409c2f81010b2459f40a6fa131f2f48212540be40001a8530fbc92302ede1115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a091117090811160807111707061116060511170504111604006802fe03111703021116020111170111165617db3c05561da001111401111da104111c04111381010b111dc855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103d0211170201111801206e953059f45930944133f413e21113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd0c109b01960069001c108a10791068105710461035440302fe56155615561556151115112b11151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011117011116562cdb3c6ce76c7737111c111d111c111b111c111b0196006b02f8111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078105755141121db3c111c111e111c111b111d111b111a111c111a1119111b11191118111a1118006c006d006081232870f83670f8416f24135f0322bc9a30f8416f24135f0301a19131e25301bc91309131e220c2009317a0069130e203fe1117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c71011122db3c060504431381010b5027c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103e1201111901206e953059f45930944133f413e21115e3010111160101ac006e006f018a1113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd109b5518db3c11150c11140c11130c11120c11110c11100c0f10ce0d0b55810077017606810101f45a301112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad10ac108b107a1069081047103645401301ea04fc8f6f5b1115d3ff301114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411164130813a985610f2f48140b3f8416f24135f0382081e8480bef2f45616db3c298101012259f40d6fa192306ddfe0218210720bdd6fbae302571701a100710078008402fe206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e28140b0216eb3f2f46f29228140b11122ba01112101f2f406e3028140b2f823112082015180a001112001be01111f01f2f4f82382015180a0561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d00720073019c5f078140b4f823011119be01111801f2f40111160108810101f45a301114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a0809550601ea02fa561d561d561d1115113311151114113211141113113111131112113011121111112f11111110112e11100f112d0f0e112c0e0d112b0d0c112a0c0b11290b0a11280a091127090811260807112507061124060511230504112204031121030211200201111f01111e561cdb3c6ce76c7737111c1124111c111b1123111b0196007402f4111a1122111a1119112111191118112011181117111f11171116111e11161115111d11151114112411141113112311131112112211121111112111111110112011100f111f0f0e111e0e0d111d0d0c11240c0b11230b0a11220a091121090811200807111f075505562273843fdb3c060504431381010b5027c801ac007501fa55605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9102e561801206e953059f45930944133f413e2061116068101017f0706111e0605111d0504111c0403111b030211200201111f01111ac855805089ce16ca0014ca0012cb3fcb07cb07cbffcb7fcb3fc910230211170201111101206e953059f45a30944133f415e2007602540c11150c0b11140b0a11130a091112090811110807111007106f105e104d4ba04918105740431615db3c007701ea000601a50104d65b1115d307d33f30011116011117813a985610f2f48140bdf8416f24135f0382081e8480bef2f4f82382015180a05617c001e3025617c002e3021117c003e302571657168140bcf2f01113111511131112111411121111111311111110111211100f11110f0e11100e551d0079007d008101ea02f8571726810101561959f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e28140ba216eb3f2f46f2402e3028140bbf8230382015180a013be12f2f48101017f59111ac855305034ceca00cb7fcb3fc910370211170201111801206e953059f45a30944133f415e2111311151113111211141112007a007b01ac303157178140bef823011118be01111701f2f40111160105810101f45a301113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105706103544301201ea025a1111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810570610354403db3c007c01ea000a01832fa10102f8571727810101561959f40d6fa192306ddf206e92306d9fd0fa40d200d37fd33f55306c146f04e28140ba216eb3f2f46f2402e3028140bbf8230382015180a013be12f2f48101017f59111ac855305034ceca00cb7fcb3fc910380211170201111801206e953059f45a30944133f415e2111311151113111211141112007e007f01a6303157178140bef823011118be01111701f2f40111160106810101f45a301113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068071046551301ea025c1111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910680710461035443012db3c008001ea000a01831fa10102fc29810101561959f40d6fa192306ddf206e92306d8e21d0fa40d200fa40fa40d37fd401d0d37fd33f30102710261025102410236c176f07e28140ba216eb3f2f46f2705e3028140bbf8230682015180a016be15f2f48101017f5055111dc855605067ce14ca0012cececb7f01c8cb7f12cb3fcdc9103a02111702011118010082008301a210455f0557178140bef823011118be01111701f2f40111160108810101f45a301113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a091068551501ea0168206e953059f45a30944133f415e207a51113111511131112111411121111111311111110111211100f11110f0e11100e10df551c01ea017cc0001116c12101111601b08ea9813ee3f2f01113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce05f0f5f07f2c08201ea020120008600910201200087008a02f9bb4f6ed44d0d200018e70fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de533570c85290cbffca00c9068e133023913693331025e28228354a6ba7a18000069137e26d6d6d6d6d6d6d70547000200e11130e0d11120d0e11110e0e11100e10cf10ce550be30d800c1008801601115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf36c730089007881010b2e0259f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2206e943070706de06f27316c22327f3301020158008b008e02f9b1a27b5134348000639c3e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd5c3214a432fff2803241a384cc08e44da4ccc40978a08a0d529ae9e8600001a44df89b5b5b5b5b5b5b5c151c0008038444c38344448343844443838444038433c4339542f8c36000c1008c01601115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6ce76c87008d007a81010b2e0259f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2206e983070705470005300e06f27307f555002f9b0357b5134348000639c3e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd5c3214a432fff2803241a384cc08e44da4ccc40978a08a0d529ae9e8600001a44df89b5b5b5b5b5b5b5c151c0008038444c38344448343844443838444038433c4339542f8c36000c1008f01601115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6ce76c870090008e8101012a0259f40d6fa192306ddf206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e2206e993070f8287054700070e06f29365b7f060510344130020120009200a20201200093009b0201580094009802f9afd276a268690000c7387d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299ab864294865ffe500648347099811c89b49998812f141141aa535d3d0c00003489bf136b6b6b6b6b6b6b82a38001007088987068889068708888707088807086788672a85f186c000c1009501721115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cdd3d3d3d3d3d3d3d3d3d55830096026c8101012d0259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206e8e8f3070f8287054700020885471115300e06f2c7f55b001460097000002f9ac24f6a268690000c7387d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299ab864294865ffe500648347099811c89b49998812f141141aa535d3d0c00003489bf136b6b6b6b6b6b6b82a38001007088987068889068708888707088807086788672a85f186c000c1009901681115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c6cc66ca6009a0208db3cdb3c00dd00ae020378a0009c009f02f7a10fb5134348000639c3e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd5c3214a432fff2803241a384cc08e44da4ccc40978a08a0d529ae9e8600001a44df89b5b5b5b5b5b5b5c151c0008038444c38344448343844443838444038433c4339542f8c3600c1009d01641115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6c61009e000670f83602f7a36fb5134348000639c3e903e903e9035007420404075c03480348020404075c00c0411c411841141f4554154d11c01649c4d7794cd5c3214a432fff2803241a384cc08e44da4ccc40978a08a0d529ae9e8600001a44df89b5b5b5b5b5b5b5c151c0008038444c38344448343844443838444038433c4339542f8c3600c100a00110db3c57105f0f6c6100a10014830c820807fff870f83802012000a300a602f9b6383da89a1a400031ce1f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa688e00b24e26bbca66ae190a52197ff9401920d1c266047226d2666204bc504506a94d74f4300000d226fc4dadadadadadadae0a8e000401c22261c1a22241a1c22221c1c22201c219e219caa17c61b000c100a4010cdb3c6cf56c7500a50122db3cf8276f10f8276f1022a1542280528000df02012000a700b902012000a800ab02f9acd376a268690000c7387d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299ab864294865ffe500648347099811c89b49998812f141141aa535d3d0c00003489bf136b6b6b6b6b6b6b82a38001007088987068889068708888707088807086788672a85f186c000c100a9016c1115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c57105f0f6c6100aa0104db3c00dd02012000ac00af02f5f5da89a1a400031ce1f481f481f481a803a1020203ae01a401a401020203ae0060208e208c208a0fa2aa0aa688e00b24e26bbca66ae190a52197ff9401920d1c266047226d2666204bc504506a94d74f4300000d226fc4dadadadadadadae0a8e000401c22261c1a22241a1c22221c1c22201c219e219caa17c61b00c100ad01601115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cc66ca600ae00988101012b0259f40d6fa192306ddf206e92306d8e21d0fa40d200fa40fa40d37fd401d0d37fd33f30102710261025102410236c176f07e2206e9a3070f828f828f8287020e06f2731347f050402f8abb3ed44d0d200018e70fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de533570c85290cbffca00c9068e133023913693331025e28228354a6ba7a18000069137e26d6d6d6d6d6d6d70547000200e11130e0d11120d0e11110e0e11100e10cf10ce550be30d00c100b0015cdb3c571657165716571657165716571657165716571657165716571657165716571657165716571657165716571600b102f270561092302dde56101115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a0911170908111608071117070611160605111705041116040311170302111602011117011116db3c11151116111511141116111400b200b3010671db3c01d602fe1113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540db3c1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609111601ba00b403fe0807065540db3c2f561556155615561a561a547cb91115111f11151114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b111f0b0a111e0a09111d0908111c0807111b0706111a060511190504111804031117030211160201111f01111edb3c11151116111501d500b500b6000821a9381f02fe1114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540db3c1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a01ca00b702f80911160911160807065540db3c820151808228354a6ba7a180005628a11112112711121111112611111110112511100f11220f0e11210e0d11200d0c111f0c0b111e0b0a111d0a09111c0908111b08071124070611230605111a050411190410235623031129018212540be4008228354a6ba7a18000111b112b111b01e800b800d8111a112a111a111911291119111811281118111711271117111611261116111a1125111a111911241119111811231118111a1122111a111911211119111811201118111a111f111a1119111e11191118111d1118111a111c111a1119111b11191117111a111711161119111602012000ba00bd02f9ac7976a268690000c7387d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299ab864294865ffe500648347099811c89b49998812f141141aa535d3d0c00003489bf136b6b6b6b6b6b6b82a38001007088987068889068708888707088807086788672a85f186c000c100bb016c1115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c57105f0f6c6100bc000670f83802f9acf7f6a268690000c7387d207d207d206a00e8408080eb8069006900408080eb801808238823082283e8aa82a9a23802c9389aef299ab864294865ffe500648347099811c89b49998812f141141aa535d3d0c00003489bf136b6b6b6b6b6b6b82a38001007088987068889068708888707088807086788672a85f186c000c100be010cdb3c6cc46ca400bf003220d0d3ff31d2000196307070f82821e17f01d3fffa40d33f3002f6f2ed44d0d200018e70fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de533570c85290cbffca00c9068e133023913693331025e28228354a6ba7a18000069137e26d6d6d6d6d6d6d70547000200e11130e0d11120d0e11110e0e11100e10cf10ce550be30d00c100c200e0fa40fa40fa40d401d0fa40fa40d307d200d3ffd430d0d3fff404f404f404d430d0f404f404f404d430d0f404d33fd33fd33fd33fd33fd43011131116111311131115111311131114111357161114111511141113111411131112111311121111111211111110111111100f11100f550e045c1116d70d1ff2e0822182107e1f5038bae3022182107e1f5039bae30221821089d648bbbae3022182107e1f5041ba00c300d10136014f01dc31fa408308d718d41116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a09111709081118080711170706111806051117050411180403111703021118020111190100c402f481420421d749c000f2f481420501d74ac000f2f4813a985610f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655408141a011165617db3c01111701f2f42b81010b561859f40b6fa192306ddf01bf00c501fa206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e28141a1216eb3f2f46f278141a224c300f2f48141a35620f90001112025f91001111f01f2f4111ed0d31f8141a402821056545731ba12f2f4d3ff8141a5025615ba12f2f4fa408141a6f82813c70512f2f4fa408141a702561ec70512f2f4d33f00c601f48141a85123ba12f2f48141b02682081e8480bef2f4f8000582081e8480a101a420a571705300111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a111811171119111711161118111611151117111511141116111411131115111311121114111200c704fe1111111311111110111211100f11110f0e11100e10df10ce10bd106b109a1089107810570611230605112205db3c81010b54776554776527c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c902111502562001206e953059f45930944133f413e2f80f561dd749c000e303561dd74ac001e303111dd430d0d37ffa402001d200c800c800c9015457135f06571657161113111511131112111411121111111311111110111211100f11110f0e11100e551d01ea04e8d749c0008ead5f093c57161113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd5519e1d74ac0008ead5f083c57161113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd5519e121c200e303f8285210c705b301ea01ea00ca00cb015a5f083c57161113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd551901ea02f88ead5f083c57161113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd5519e11115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e11160e0d111d0d0c111e0c0b111b0b0a111a0a0911190908111808071117070611160601ea00cc04f805111d0504111e0403111b0302111a020111190111185618db3c8ebc57165716571657165716571657165716571657160b11150b0a11140a09111309081112080711110706111006105f104e103d4c1a080644b419171513e15617561abee303f8276f1011151116111511141116111411131116111311121116111201bf01ea00cd00ce017857165716571657165716571657165716571657160b11150b0a11140a09111309081112080711110706111006105f104e103d4c1a080644b41917151301ea03fa1111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540db3c561b01a001111701be8eb257165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcbe111175619a1050411160403111d0300df01ea00cf01fe02111e0201111b01111a81010b111dc855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c910360211170201111a01206e953059f45930944133f413e201111001111170716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000a11150a0911140908111308071112070611110605111005104f103e102d104c00d000ec0b103a191078103710561045134440c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5401dc31fa408308d718d41116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a09111709081118080711170706111806051117050411180403111703021118020111190100d202f481420421d749c000f2f481420501d74ac000f2f4813a985610f2f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540813ecb11165617db3c01111701f2f42b81010b561859f40b6fa192306ddf01bf00d301fa206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2813e98216eb3f2f46f27813e9f24c300f2f4813ea05620f90001112025f91001111f01f2f4111ed0d31f813ea102821056574131ba12f2f4d3ff813ea2025615ba12f2f4fa40813ea3f82813c70512f2f4fa40813ea402561ec70512f2f4d33f00d401fc813ea55323baf2f4813e9b27820b750280bef2f4f80002a420a572705300112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111100d504f01110111111100f11100f10ef10de10cd10570611240605112305db3c06820b750280a181010b5471655477652dc855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c902111502561f01206e953059f45930944133f413e2f80f561ed749c000e303561ed74ac001e303111ed430d0d37ffa4020d749c00001d200d600d600d7015457135f065716571657161112111511121111111411111110111311100f11120f0e11110e0d11100d552c01ea04e08ead5f093c571557161112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be5e2a5528e1d74ac0008ead5f083c571557161112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be5e2a5528e121c200e303f8285210c705b301ea01ea00d800d9015a5f083c571557161112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be5e2a552801ea02f88ead5f083c571557161112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be5e2a5528e11115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e11160e0d111d0d0c111f0c0b111b0b0a111a0a0911190908111808071117070611160601ea00da04f805111d0504111f0403111b0302111a020111190111185618db3c8eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcbe15616561abee30311151116111511141115111411131114111311121113111211111112111111101111111001bf01ea00db00dc0168571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb01ea03fc0f11100f550e561e011121db3c2a8101012259f40c6fa1318ebd3057165716571657165716571657165716571657160b11150b0a11140a09111309081112080711110706111006105f104e103d4c1a080644b419171513e0f8276f101114111711141113111611131112111511121111111711111110111611100f11150f00dd01ea00de002ac882104157494401cb1f58cf16cb3fc9f900a9383f03da0e11170e0d11160d0c11150c0b11170b0a11160a0911150908111708071116070611150605111705041116040311150302111702011116011115820b7502801118db3c01111901a001111601bee30311205619a105111c050403111d0302111f0201111b01111a81010b1118c800df00e000e1001e258208989680a8258209c9c380a8a00180571557165716571657165716571657165716571657160811150807111407061113060511120504111104031110034fed108c107b106a1059104810374614505301ea02fc55605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9102501111201561901206e953059f45930944133f413e20c11150c0b11140b0a11130a091112090811110807111007106f105e104d4bac103907506805111605041118041023021119021118015618db3c81010170820b750280f82304111c041023561d0302111d0200e20134016a20fa443070585617db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d000e3012488c87001ca0055215023810101cf00cecec900e40114ff00f4a413f4bcf2c80b00e502016200e6012d04f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba00e700f100f300f404cc058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544815bae3022082104154481dba00e800ec00e900ea00e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54015c30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ec04f88eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e02082104154481bba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0208210178d4519bae302208210472d9d7dba00ec00ec00eb00ee015c30d33ffa00593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ec02ea81378c21c200f2f4f84210685e34103748705280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305167a0f8285220c705b3941028375be30d10455512012800ed006e7080400a7f0ac8598210415448135003cb1fcb3fcb7fc9134a4019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104503fc8eb830d33fd39f5932813800f84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821089129d60ba8eb830d33fd39f59328138eaf84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e000f000f000ef01868210a11a7002ba8eb7d33fd39f593281394ef84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f0700f003a655515376db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2813801216eb3f2f46f25135f0355512981380209db3c29ba18f2f4104810374614403305db3c0130012a012201fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa0200f20052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512011d043ce30221821041544814bae3022182104154481cbae3022182104154481aba00f500f700fb00ff04d25b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f4820adc6c0081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1555029db3c705410b5db3c5551547a9b2f01070124013300f601fedb3c5159a17f541ba5700fc855308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c47b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010354044c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54012704fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4555129db3c705410b5010700f8012400f9003082080f4240a082080f4240a082086acfc0a08209312d00a003fedb3c5551547dcb2ddb3c515ca150dc7f7126544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104d103e4a80103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f030133012700fa014e01a11047104610354440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54010504fe5b05d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422cc705f2f48138d7535bc705f2f4105b104a103948cd53badb3c55408138d85169db3c17f2f48138d927c200f2f48138da2ac200f2f48138db5357bef2f48138dc2a8209c9c380bef2f4550429db3c208208989680a08138ddf8416f24135f0322bef2f455512d0107011a010100fc04f4db3c705410f5db3c5551547baf5611db3c515aa1103b102a7f7126045611040311110302111002011114011115c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc9106c105c104a10394a90103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf8101240133012700fd02668ae2f400c901fb00f8416f24135f035006a146505e21db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400fe0105001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba010001060109010b04fc5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422fc705f2f481393b538ec705f2f4105e104d103c102b1110541f0828db3c554081393c516fdb3c17f2f481393d2ac200f2f481393e27c200f2f481393f535abef2f4813940278209c9c380bef2f4550426db3c208208989680a08139410107011a01010102003c82082dc6c0a082080f4240a082086acfc0a08209312d00a082081e8480a00486f8416f24135f0322bef2f455512adb3c705410c5db3c5551547edc2edb3c515da1106e105d7f71536d07106e05111605041115040311140302111302011117011118c8012401330127010302e055a0db3cc91035104a10394180103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110471045103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401040105005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe5b05d33ffa00fa40fa40f40431fa0081396cf8422ac705f2f410591048103746ab5376db3c81396d29c200f2f481396e5369bef2f481396f2bc000917f972b8209c9c380bee2f2f48209c9c3802ba08209406f40a082081e8480a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1555028db3c705410a5010701240108035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f45504011a011a011a03f0db3c5551547cba2cdb3c515ba14cb07f70264c13011110011111c855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec9106810581047103b4870103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0055200401330127011d02fe5b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382098cba80bef2f45134a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407107700124010a009e07c8598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010455512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba010c01100114011704c65b05d33ffa00fa40fa40fa0081397625c200f2f4813977f842105b104a103948cd2bdb3c1ec7051cf2f455030a81397851cadb3c1df2f427c2008e1a363881397df8416f24135f0382095ef3c0bef2f45128a0074414e30df842107846504a405441aa0124011a010d010e00cc813979288209c9c380bef2f481397af8416f24135f032982080f4240a082086acfc0a0bef2f4514aa0717027544d3a1dc8553082107362d09c5005cb1f13cb3f01fa02cecec9245139034c9c441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001e8db3cf8416f24135f030982080f4240a082080f4240a019be8e3782080f4240717009c8018210d53276db58cb1fcb3fc91048413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001034923535e245334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54010f006c82080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0004fa5b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a08209312d00a0bef2f410354014503b541a0a2adb3c555053b6db3c8137eb240124012a0130011101fc8101012359f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da081010182080f4240f8232e544e30561201c855405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544d9052fec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec91049011202fc10384b70441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053abc8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407109700bc8598210415448115003cb1fcb3fcb7fc9443049a0441359c8cf8580ca008901cc0113005acf16ce01fa02806acf40f400c901fb004430c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404f45b05d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842105d104c103b4aef27db3c01111001c7051ef2f48138e22cc200f2f48138e3f8416f24135f032d82082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030c8138e451ebdb3c1ff2f45504543d7ddb3c555053860124011a012a011502f8db3c8138e5248101012359f40c6fa131b3f2f48138e62e8209c9c380bef2f48138e7238101012359f40c6fa131b3f2f45168a081010182082dc6c0f823561203021112020111120152c01113c855405045ce12cecb3fcb7fcb3fc910344f70206e953059f45a30944133f415e2717f295159105904031111034edcc80130011601f05560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07cec9544114103a4c99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0040030504011d04f8e30221821041544811ba8f6e5b05d33fd37f308137a021c200f2f4f84210671056104510344880db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137a1216eb3f2f46f2430318137a20aba19f2f48137a3f8425009c70518f2f416810101f45a30104510344130e02101180128011d011e02fe5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f84205111005104f103e102d0111110111122adb3c01111301c70501111101f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030f8139481111260124011904fcdb3c01111201f2f45504111053a8db3c555053b6db3c813949248101012359f40c6fa131b3f2f481394a298209c9c380bef2f481394b238101012359f40c6fa131b3f2f4516ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb3fc910344a70206e953059f45a30944133f415e2717f2c08517c07011a012a0130011b000afa4430c00001fe106c05111405041113040311120302111102011110010fc855908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc92643144a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430011c0072441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0044145053c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404c48210472d9d7ebae3022182104154481eba8ebb5b05d33fd37fd39f3081380af84227c705f2f41068105710461035103401db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0218210504e5052bae3023720821041544807ba011f01220129012c04f65b05d33fd37fd39f30813804f84227c705f2f481380522c200f2f410561046103646785368db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206ee3026f2530813807511dbaf2f410591048103746982a81380808db3c500dba16f2f48101015415005467c001300120012a01210090303738810101530150884133f40c6fa19401d70030925b6de2813806216eb3f2f481380907ba16f2f445334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400dc216e955b59f45a3098c801cf004133f442e25054810101f45a307108700ac8598210415448115003cb1fcb3fcb7fc9104710364890441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003444405c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403f68137fa21c200f2f455525387db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53bcbef2f48137fd511cbaf2f455448137fe543ad8db3c2dba1bf2f4514aa150888101010130012a012304f2f45a3010574014541386db3c705385db3c10685e3410374870545ee9db3c539b82082dc6c0ba955b3839f8288e3d717011112fc8598210415448135003cb1fcb3fcb7fc9104d103e1201111101441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00090c0807e21046103544304970546cb052b00124013301250126016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d001330030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01c4db3c707f541db680400bc855308210415448125005cb1f13cb3fcb7fcecec91069105c104a103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00410504012701901069105810471039487927db3c813796228101012359f40c6fa131b3f2f4810101f82310394ba0c855305034cececb7fcb3fc910364780206e953059f45a30944133f415e245401201280026c8821041544f4701cb1f12cb3f01cf16c9f90003f65b05d33fd39f3081380df8416f24135f0382081e8480bef2f454167628db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e281380e216eb3f2f46f2533106a1059104810374a9b81380f08db3c500cba16f2f4813810f8230982015180a019be18f2f4813811060130012a012b002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f009882082dc6c0bd16f2f48101012010345445135099216e955b59f45a3098c801cf004133f442e25024810101f45a30403305c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ae8e21303510355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0c00006c12116b08e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c082020148012e0131017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c658012f0178db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e983070705456002802e06f25327f04431301300002310179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c64801320116705354db3c30546660526001330026f82ac87001ca0055215023810101cf00cecec901fc561f0201111e01c855605067ce14ca0012cececb7f01c8cb7f12cb3fcdc9102a01111801561701206e953059f45a30944133f415e201a4820b7502807f70f8280311190302111c0201111b01c855308210415448105005cb1f13cb3fcb7fcecec95615040311170302111a021119014343c8cf8580ca00cf8440ce01fa0201350178806acf40f400c901fb001111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a1069104810374614505301ea01dc31fa408308d718d41116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a091117090811180807111707061118060511170504111804031117030211180201111901013701fa81420421d749c000f2f481420501d74ac000f2f4813a985610f2f42c81010b561859f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2813ef8216eb3f2f46f27813ef925c300f2f4813f0024c300f2f4813f025620f90001112025f91001111f01f2f4111ed0813f0821d749013801fc810360baf2f4813f0921d74ac001f2f4d31f813f0302821056524b31ba12f2f4d3ff813f04025616ba12f2f4d3fff828813f0501d30a018309ba12f2f4813f0501d3ff3013ba12f2f4d3ff561d813f0601d30a018309ba12f2f4813f0601d3ff3013ba12f2f4d33f813f075123ba12f2f482081e8480813efe5371bef2f4013904fef8005166a102a420a573705300107b10570611240605112305db3c81010b54776554776527c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c902111502561f01206e953059f45930944133f413e2f80f111fd43020d020d749810320bae303d74ac001e3031115111c11151114111b11141113111a111311121119111201d2013a013b013c015a5f083c571557151112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad552801ea015a5f073c571557151112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad552801ea04e61111111811111110111711100f11160f0e111c0e0d111b0d0c111f0c0b11190b0a11180a091117090811160807111c0706111b0605111f0504111904031118030211170201111601111c72db3c561fa001111fa1561b21bee303111cd0d3ffd3ffd3ffd30fd4d30f20d749c000e303d74ac000013d013e013f0140001a813ee401c002f2f48209c9c3800176305715571557155715571557155715571557160b11150b0a11140a09111309081112080711110706111006105f104e103d4cba191817161514433001ea01785f075715571557155715571557155715571557160b11150b0a11140a09111309081112080711110706111006105f104e103d4cba191817161514433001ea02fe8ebc5f065715571557155715571557155715571557160b11150b0a11140a09111309081112080711110706111006105f104e103d4cba1918171615144330e11115111a11151114111911141113111811131112111711121111111611111110111a11100f11190f0e11180e0d11170d0c11160c0b111a0b0a11190a0911180901ea014104f2081117080711160706111a060511190504111804031117030211160201111a0111235619561956195619561e5628db3c8eb95716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f5576e15618561ebde3032b8101015620014201ea01440145014e05935f0570e103935f0470e123c302935f0470e001935f0370e1208104a0bd935f0370e059db3c014300eeeda2edfb01c302925b70e0207af94102c30a935f0470e0812500bd935f0370e0c309925b70e09321c2008e48807f228104a0ba933080299722c17f923021dee221d020d74922aa02bd955f0470db31e05331bc8e103221d74ac301955f0370db31e001d4309ad74a955f0370db31e001e259a101e85b7f01725716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f557601ea04ca59f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206e8eba305716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f5576e06f2c6c91025625c705e30301c000014601ea014701480046fa40d31fd3ffd3ffd401d0d3ffd30fd4d30fd33fd33fd33fd33f30108c108b108a108901745b5716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f557601ea03fe8eba305716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f5576e120841fb98eba305716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f5576e1a401ea01ea014903fe1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a091116091116080706554056235617561c561c561c561c562adb3c2c8101012259f40c6fa131e302011120010c810101f45a30810101f823f825702056280b0a111c0a014a014b014c0048c815cbff13cbffcbffc9c882104b45594901cb1f5005cf1613cb1f12cb0fcb0fccc9f900017230571657165716571657165716571657165716571657165716571657165716571605111505041114040311130302111202011111011110559501ea02e60911200908111f0807111e0706111d0605112105112a5530c855b0db3cc902111202011116015260206e953059f45a30944133f415e201111a01111ba10504111d040211160201111501111481010b1119c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9031118030211130201111601014d014e004850bcce19cb1f17cbff15cbff03c8cbff12cb0fcc12cb0f12cb3f12cb3f12cb3f12cb3fcd016a206e953059f45930944133f413e2051115050411140403111303021112020111110105111005105f103e0c4b1d103a46891045401401ea03f88eee31fa408308d718d41116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a091117090811180807111707061118060511170504111804031117030211180201111901e02182107e1f5033bae30201015001b401ce01fc81420421d749c000f2f481420501d74ac000f2f4813a985610f2f42c81010b561859f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2814043216eb3f2f46f2781404624c300f2f48140495620f90001112025f91001111f01f2f4561ed0810328d721d33f8140455324baf2f4015101f6d37fd30730814065821005867d6082085e9ac023a8a05230bef2f481404f5392bef2f4f8005181a104a4777020111f1121111f111e1120111e111d1121111d111c1120111c111b1121111b111a1120111a111911211119111811201118111711211117111611201116111511211115111411201114111311211113015202fe1112112011121111112111111110112011100f11210f0e11200e0d11210d0c11200c0b11210b0a11200a1079081120080611200610350411200403112303562355205622db3c81010b54776554776527c855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c902111502562101206e953059f45930944133f413e2f80f562101d2015301f8d0f828d30a31562102d31f01821056504232ba96d3ff015619ba9170e297d3ff02d3ff30ba923170e201d307028e1820c001917f9320c002e2917f9320c003e2917f9320c004e29170e29702d30a018309ba920270e29801d3ff02d3ff30ba923070e2018100c8d7210195d30701c0019170e29520d749c0009170e2015402fc9520d74ac0019170e201d430207020843f058e115624c101917f945624c208e293308011de93308017e2547111547000709b28562cb99327c0009170e28ae85f04343424f9001116112411161115112311151114112211141113112111131112112011121111111f11111110111e11100f111d0f0e111c0e108d0c111a0c0155019e047e562ba55290ba2ad07054700d5612c001917f945612c003e2917f945612c004e28f197326923074df25d749810310ba9525d74a01ba923070e2e30fe30e5628015601720173019201fe6c3101d307d307d3ffd3ffd3ffd4d4d40a9139963808d4300708e21115113211151114113111141113113011131112112f11121111112e11111110112d11100f112c0f0e112b0e0d112a0d0c11160c0b11280b0a11270a0911260908112508071124070611230605112205041121040311200302111f0201111e01111d5632015702665624562456245624db3c8e25571d571d5720572057215728572b80125628112c011128011118111e11181119111d111901e30d0175015803ec56235623562056205629db3c5633c0038edc301115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d011123011122561e561e5627db3c011122011121011116011115011114011113011112011111011110010f55c19457235723e2112101590165017103ee1116111a11161115111911151114111811141113111711131112111a11121111111911111110111811100f11170f0e111a0e0d11190d0c11180c0b11170b0a111a0a09111909081118080711170706111a0605111905041118040311170302111a0201111901111a7181014070db3ce3031115111611150170015a015b005657165716571657161111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae55397002fe1114111511141113111411131112111311121111111211111110111111100f11100f550e1118718100f070db3c8e275716571657161112111511121111111411111110111311100f11120f0e11110e0d11100d552c70e1561556155615561556155615561556155615561556155615561556155615561556155615561556150170015c02fc561556151115112b11151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011117011116562c562edb3c1115111611151114111611141113111611130161015d02fe1112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540562d562fdb3c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045015e015f0108db3caa02016202c21034413001112e01112fdb3c57105f0f6c611116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454013db3c016001700106db3ca501610110db3ca67e807fa904016203ee1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a091117090811170807111707061117060511170504111704031117030211170201111701db3c1117db3c01111701a01115111611150163016d01640016813fc701c002f2f48104b400781114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413003f6331116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a09111809081117080711190706111806051117050411190403111803021117021119017181015070db3ce3031115111611151114111511140170017a016602fa1113111411131112111311121111111211111110111111100f11100f550e1118718100f070db3c8e27571657161113111511131112111411121111111311111110111211100f11110f0e11100e551d70e156155615561556155615561556155615561556155615561556155615561556155615561556155615561556150170016702fc1115112b11151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011117011116562cdb3c111511161115111411161114111311161113111211161112016b016803fe1111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540562ddb3c112edb3c57105f0f6c611117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b0169016a016f0108db3caa02016c0106db3ca5016b0110db3ca67e807fa904016c02f61115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609111608070655408109541117db3c01111701a01115111611151114111511141113111411131112111311121111111211111110111111100f11100f016d016e02f61114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a0911150908111608071115070611160605111505041116040311150302111602011115011116813fc611165617db3c01111701f2f41116aa0911141116111411131115111301870188003410ef10de10cd10bc10ab109a10891078106710561045103441300120108a107910681057104610354140db3c017000f28e72eda2edfb5619561956195619561956195619561956195619561956195619561956195619561956195619561956195619ed41ed43ed44ed45ed47985b70db315f0f5f08ed67ed65ed64ed63ed6180167fed118e175132f9415024ba9201ba925b70e29201ba925b70e2db31ed41edf101f2ff801a7fdb38009e8e2f111cf900561fba97111af900561dba93571a70e2971121f900561bba93572170e29c5728572b5627112b80131128df8e1b571b571b57215728572b80145628112c0111280111181119111801e200d034343b3e80112b1110112d1110112c0e112b0e0d112a0d0c11290c011128010a11270a0911260908112508061123060511220504112104111c1120111c02111f021118111e11181119111d11190f111c0f0b111b0b03111a03031119030b11180b071111070f50b304f87226923073df25d749810250ba9525d74a01ba923070e28f25313202d307d3078040d721d3ffd3ffd4d4099138963607d4300507e2038100feb0c000e30fe30e112b112d112b112a112c112a1129112b11291128112a11281127112911271126112811261125112711251123112511231121112311211120112211200174018d018f019103ee7253661118113311181117113211171116113111161115113011151114112f11141113112e11131112112d11121111112c11111110112b11100f11320f0e11290e0d11280d0c11270c0b11260b0a11250a091124090811230807112207061121060511200504111f0403111e03562159562001db3ce30f0175017d018c023624c001917f9324c003e2917f9324c004e2e30204c002e3025f04700176017904fa01935f0470e1935f0370e11115111811151114111711141113111611131112111811121111111711111110111611100f11180f0e11170e0d11160d0c11180c0b11170b0a11160a09111809081117080711160706111806051117050411160403111803021117020111160111185616db3ce3031117c00493571570e30d0187017a0177017800081115c20800f68e3957161112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a10691058104710364513504270e01116c0021113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645401304e41116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a0911180908111708071119070611180605111705041119040311180302111702011119011117db3ce3031118e30211150186017a017b017c004e5716571657161112111511121111111411111110111311100f11120f0e11110e0d11100d552c70004e571557151112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b7000e68e2557151112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b70e111158e231112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b70e01112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b7f01d21115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111e561d5622db3c8e22111cf900561bba97111ff9005619ba93571f70e29c572657295625112980131126df8e10571c571f572657295625112980141126e2017e03f61116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a091117090811180807111707061118060511170504111804031117030211180211170171810240707fdb3ce303561556155615561556155615018a017f0180004e571657161113111511131112111411121111111311111110111211100f11110f0e11100e551d7001f856155615561556155615561556155615561556155615561556155615561556151115112b11151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802018104fa011117011116562ddb3c1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540562edb3c112fdb3c57105f0f6c6111171119111711161118111611151117111511141116111411131115111301840182018301890108db3caa0201850106db3ca501840110db3ca67e807fa904018502f61114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a0911150908111608071115070611160605111505041116040311150302111602011115011116813fca11165617db3c01111701f2f41116aa09111411161114111311151113018601880104db3c0187004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e200641112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354430016c1112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354140137fdb3c018a01c28edaeda2edfb561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561aed41ed43ed44ed45ed47985b70db315f0f5f08ed67ed65ed64ed63ed6180167fed118aed41edf101f2ff801b7fdb38018b007c5143f9415025bb955f0570db31e120c200955f0570db31e15203bb955f0470db31e112bb945b70db31e10196a93802c000b3923070e29370db31e07fdb3100a0571d571d571f5726572980125626112a01112601111b111e111b1113111b11131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034401301fe363d5b3e80112b1112112d111209112c091110112b1110112a0e11290e0d11280d0c11270c011126010a11250a0811230807112207061121060511200504111f041119111e111902111d020f111c0f1113111b11131118111a11180b11190b03111803111211131112091112091110111110ef10de0a50cb1d108910781067018e000c10560441550301fe34343b3e80112b1112112d111209112c091110112b1110112a0e11290e0d11280d0c11270c011126010a11250a0811230807112207061121060511200504111f041119111e11190b111d0b02111c021113111b11131118111a11180f11190f03111803111211131112091112091110111110ef10de0a50cb1d1089107810670190000a10565043150098111f1121111f02112002111c111f111c111a111e111a111a111d111a1119111c1119111a111b111a1118111a111811190111180101111301111202111102011110014e1f4bdc48a94576504302f49d03111f0302111c02571a571a5b8eb6562195561c5612ba9170e295561b5624ba9170e295561a5623ba9170e28e10571a571a571a571c5724572780155624e30e1128011124e21125a40c11290c0b11280b0a11270a09112609081125080711240706112306051122050411210402111f0201111e0108111d080193019d04fe571157205720572057260b11150b0a11140a09111309081112080711110706111006105f104e103d4cba0911250908111e0807111d0706111c06102504111b040311250302011118011119562b8208989680db3c01112301a011225628db3c01112201a011215628db3c01112101a00a11270a111a1125111a0911230911200194019a019b019c01f656119131e12fc2009131e07021c100923020de1116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011118019503f6db3c10565f0620822009184e72a000be8e2b3057161114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0822009184e72a00001a101111701a8822009184e72a000a0a5822009184e72a000a904205618b9e3025717111411161114111311151113111211141112019601980199016a81010b2e0259f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e2206e8e8330db3ce06f270197000e7054700053006d0052301114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d002c1111111311111110111211100f11110f0e11100e551d005420c00295308202bf20e020c00395308201d4c0e020c0049530820249f0e0813fe801c001f2f482029810005c20c002963082089eb100e020c003963082082dc6c0e020c00496308209620100e0813fe801c001f2f48208419ce000ac1116111e11161118111d11187f111d05111c0509111b0901111a010211190208111808071117070611160603111503041114040711130702111202111101111001105f109e108d106c103b104a107948175044461603004e111b111c111b1118111b11181117111a1117111611191116111411171114111511161115103d0802fe0b11190b0a11180a09111709081124080711230706112206051121050411200403111f0302111e0201111d0156270156290156255629db3c1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540019f01a0003ec882104250493101cb1f561401cbff5005cf1613cb3fcbffcb07cb07c9f90002fe5616db3c561f8e1b56178e11298101012259f40c6fa1319480195720de9480185720e2df830c820807fff8561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802561802564002563602563f0256360256360256360201a101a20006a9383f04fe563602563b02564902564702564902564702564602564402564902564502564902564902564102562b02ed41ed43ed44ed45ed47915bed67ed65ed64ed63ed61802c7fed118aed41edf101f2ff5c70f838018103f8a181039ca02bc0029702a402810098a0de1270f8387029923535e30e27e30236363b3b3b3b3b3b3b508501a301a501a901ae01fa112a830cf941301117112b11171116112a11161115112911151114112811141113112711131112112611121111112511111110112411100f11230f0e11220e0d11210d0c11200c0b111f0b0a111e0a09111d0908111c0807111b0706111a06051119050411180403111703021116020a11140a1112111311120811120801a400380711110706111006105f109e102d108c10ab107a105910671024102302fc301114112b11141113112a11131112112911121111112811111110112711100f11260f0e11250e0d11240d0c11230c0b11220b0a11210a0911200908111f0807111e0706111d0605111c0504111b0403111a03021119020111180111178200c35011175622db3c5624a801111801a070f836830c820807fff870f83821a001a601a7005420c002953082015f90e020c003953082015f90e020c004953082015f90e0813fe801c001f2f482015f9001f85619a0561fa0111e70f83601111e01a0111ca77d8064a90401111c01a08136b070f836a08209c9c380a0562301b9948016571fde1113112a11131112112911121111112811111110112711100f11260f0e11250e0d11240d0c11230c0b11220b0a11210a0911200908111f0807111e0706111d0605111c0504111b0401a8002803111a030211190201111801111703111603103401fc385f05331115112311151114112211141113112111131112112011121111111f11111110111e11100f111d0f0e111c0e0d111b0d0c111a0c0b11190b0a11180a09111709081116080711230706112206051121050411200403111f0302111e0201111d01111c561f821005867d6082085e9ac058a8a081271082015f900101aa01fe1122a801112101a070f83601111e01a0205620bc92571f9130e2561e5620bc96571e561e111ede1114111f11141113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11180d0c11170c0b11160b0a11150a0911140908111308071112070611110605111005104f103e4dcb106a10394816507501ab02fe04112204031121030211200201db3c01111e01111da115a0051034111c413081010b111cc855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9103c0211160201111801206e953059f45930944133f413e21112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad0c108b107a1069105801ac01ad00d2228014a90824782259f40f6fa192306ddf206e92306d8e13d0d33fd307d307d33fd307d33f55506c166f06e2206eb38e346f266c225238ba8e27443045507807c855505056cb3f13cb07cb07cb3fcb07cb3fc9206e953059f45b30944133f417e2925f07e2925f05e200dc10471036450402c87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5401fea05005a014a16d23c0028e1b30c8828873656e742076696120506c6174686f2e41707001cb97c9de810101707ff8232d542985546c90529dc855805089ce16ca0014ca0012cb3fcb07cb07cbffcb7fcb3fc902111302542580206e953059f45a30944133f415e21115111e11151114111d11141113111c11131112111b111201af02fa1111111a11111110111911100f11180f0e11170e0d11160d0c111e0c0b111d0b0a111c0a09111b09080711190706111806051117050411160403111e0302111d0201111c01111bdb3cf80f56131113111611131112111511121111111411111110111611100f11150f0e11140e0d11160d0c11150c0b11140b0a11160a01b001b1000601a40102fe09111509081114080711160706111506051114050411160403111503021114020111160111157f1115711118561fdb3c08111c0807061120060511210504111b0403111a0302111f0201111d011122c855808210a4f862d1500acb1f18cb3f16cb9f14cbff12cb07cb07cb7fceccf400c90411100403111603102f0111110101b201b30012c8cbffc9f900a9389f01844343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00091115090811140807111307061112060511110504111004103f4edc105a105908103710561035413401ea01dc31fa408308d718d41116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a09111709081118080711170706111806051117050411180403111703021118020111190101b501fe81420421d749c000f2f481420501d74ac000f2f4813a985610f2f42c81010b561859f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e28140d9216eb3f2f46f278140da24c300f2f48140dc5620f90001112025f91001111f01f2f4111ed0d31f8140dd02821056504131ba12f2f401b601fcd3ff8140de025616ba12f2f4fa408140ea02561ec70512f2f4d33f8140e35323baf2f4d37f8140e72282085b8d80bef2f4fa408140ebf82813c70512f2f48140e62882085b8d80bef2f4f80003a420a578705300112111221121112011221120111f1122111f111e1122111e111d1122111d111c1122111c111b1122111b01b702fe111a1122111a1119112211191118112211181117112211171116112211161115112211151114112211141113112211131112112211121111112211111110112211100f11220f0e11220e0d11220d0c11220c0b11220b0a11220a091122090811220810570611250605112405db3c0682085b8d80a181010b5471655477652d01d201b801fec855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c902111502562001206e953059f45930944133f413e2f80f1115111c11151114111b11141113111a11131112111911121111111811111110111711100f11160f0e111c0e0d111b0d0c0b11190b0a11180a091117090811160807111c0706111b0605041119040311180301b904fe0211170201111601111cdb3c8eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcbe1561dd749c0008eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb01ba01ea01ea01bb010672db3c01d604cce1561dd74ac0018eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcbe1111dd43020d020d7498102e3bae303d74ac000e303d0fa40d3ffd33fd37fd30fd30730055617c70501ea01d801d901bc02fa8eb65f0557155715571557155715571557155716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb5506e11115111911151114111811141113111711131112111611121111111911111110111811100f11170f0e11160e0d11190d0c11180c0b11170b0a11160a091119090811180801ea01bd04da07111707061116060511190504111804031117030211160201111901112156225618561b5624561cdb3c8eb95716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f5576e1db3c11255625be01be01ea01c201c303f41116111a11161115111911151114111811141113111711131112111a11121111111911111110111811100f11170f0e111a0e0d11190d0c11180c0b11170b0a111a0a09111909081118080711170706111a0605111905041118040311170302111a02011119011118db3c941116c30093571670e293571870e30d01bf01c001c1000cd30a308309ba00081118c30000a6945616c2009170e2941116c10393571670e2941114c00193571470e21112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a105910481037465013000c821006dac2c004fc8eb95716571657165716571657165716571657165716571657165716571657160611150605111405041113040311120302111102011110010f5576e1112482085b8d80a1561e21bee30356208218174876e800bee3031115111611151114111511141113111411131112111311121111111211111110111111100f11100f01ea01c401c401c5017030571557155715571557155715571557155715571557155715571557150611150605111405041113040311120302111102011110010f558501ea03fe10ef10de10cd10bc10ab109a10891078106710561045103441300111240156220111245618db3c288101012259f40c6fa1318eb9305716571657165716571657165716571657165716571657165716571607111507061114060511130504111204031111030211100250fe5557e001111e011123a1111f8218174876e800a101c601ea01c70030c882105650414901cb1f5003cf16cb3fcbffc9f900a9383f01fc05111f050403111c0302111b0201111a01111981010b111fc855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9102701111901561c01206e953059f45930944133f413e2810101708218174876e800f823561e5520c855305034ceca00cb7fcb3fc91027561d01206e953059f45a30944133f415e20e11150e0d11140d01c804fe0c11130c0b11120b0a11110a09111009108f107e556606111706051118050302111702011118011116db3cf80f8210067f35407f718218174876e800f8280811200817820bef1480561847680511210504111f040311230302111d0201112001111ec855a0db3cc956120403111703021118021116014343c8cf8580ca008901c901cb01cc01cd01f01114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655408141321116db3c840fb901111701f2f4831fa01114111511141113111411131112111311121111111211111110111111100f11100f550e01ca000c21ab1fa9380f005482104154481a500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd0001100162cf16ce01fa02806acf40f400c901fb000e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e55665e235901ea01fc82107e1f5034ba8eedfa408308d718d41116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a091117090811180807111707061118060511170504111804031117030211180201111901e05f0f5f08f2c08201cf01fe81420421d749c000f2f481420501d74ac000f2f4813a985610f2f42c81010b561859f40b6fa192306ddf206e92306d8e15d0d37fd37fd3ffd3ffd33fd33ff40455606c176f07e281413d216eb3f2f46f2781413e24c300f2f48141405620f90001112025f91001111f01f2f4111ed0d31f81414102821056554e31ba12f2f401d001fcd3ff814142025616ba12f2f4fa4081414c02561ec70512f2f4d33f8141475323baf2f4d37f81414b2282085b8d80bef2f4fa4081414df82813c70512f2f481414a2882085b8d80bef2f4f80003a420a579705300112111221121112011221120111f1122111f111e1122111e111d1122111d111c1122111c111b1122111b01d102fe111a1122111a1119112211191118112211181117112211171116112211161115112211151114112211141113112211131112112211121111112211111110112211100f11220f0e11220e0d11220d0c11220c0b11220b0a11220a091122090811220810570611250605112405db3c0682085b8d80a181010b5471655477652d01d201d3006e3678248014a908f8231056104610364680c855505056cb3f13cb07cb07cb3fcb07cb3fc94130206e953059f45b30944133f417e2f8230101fec855605067cb7f14cb7f12cbffcbffcb3fcb3ff400c902111502562001206e953059f45930944133f413e2f80f1115111c11151114111b11141113111a11131112111911121111111811111110111711100f11160f0e111c0e0d111b0d0c0b11190b0a11180a091117090811160807111c0706111b0605041119040311180301d404fe0211170201111601111cdb3c8eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcbe1561dd749c0008eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb01d501ea01ea01d7010674db3c01d60014561101a904a93800c00104bae1561dd74ac0018eb4571657165716571657165716571657165716571657160a11150a0911140908111308071112070611110605111005104f103e4dcbe1111dd43020d020d749810113bee303d74ac000e303d0fa40d307025613c70501ea01d801d901da016a5b57155715571557155715571557155716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb550601ea016a3057155715571557155715571557155716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb550601ea02f88eb55b57155715571557155715571557155716571657160a11150a0911140908111308071112070611110605111005104f103e4dcb5506e11115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a091116090811160801ea01db04fe07111607061116060511160504111604031116030211160201111601111e561e5617db3c8eb6571657165716571657165716571657165716571657165716091115090811140807111307061112060511110504111004103f4edc5519e1561edb3c11151116111511141116111411131116111311121116111211111116111101dc01ea01dd01de00d0eda2edfb21c104917f9321c210e2925b70e020d74922aa02bd925b70e020c702925b70e170935302b98e3801d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e2955f0370db31e101a4e83031c700006081410a21c203f2f481410b21c111f2f420c0049930822009184e72a000e0c005978218e8d4a51000e08218174876e80004f81110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540db3c11235623be8eb657165716571657165716571657165716571657165716571657160811150807111407061113060511120504111104031110034fed5538e1112282085b8d80a1561c21bee303561e5617be01df01ea01e001e1000c82103b9aca00016a305715571557155715571557155715571557155715571557150811150807111407061113060511120504111104031110034fed554701ea03fc8eb5305715571557155715571557155715571557155715571557150811150807111407061113060511120504111104031110034fed5547e111225617db3c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106701ea01e201e30020c88210c5cc7cd601cb1f01cf16c9f90003f41056104510344130562102112301db3c278101012259f40c6fa1318eb730571657165716571657165716571657165716571657165716091115090811140807111307061112060511110504111004103f4edc5519e001111c011122a1111d5620a105111d050403111a030211190201111801111781010b111dc801e401ea01e50030c8821056554e4901cb1f5003cf16cb3fcbffc9f900a9383f01fc55605067cb7f14cb7f12cbffcbffcb3fcb3ff400c9102701111701561a01206e953059f45930944133f413e281010170f823561b59561d01c855305034ceca00cb7fcb3fc902111702561c01206e953059f45a30944133f415e20e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e106d107c104b103a01e602fc49801057060511160510240311160301111601db3cf80f82103b3f3c807f71f82805111e0504111d04821038af1bc05616443502111e0201111d01111cc8557082104154481c5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc956140403111603021118021117014343c8cf8580ca00cf8440ce01fa02806a01e701e901f01114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655408141961116db3c840fb901111701f2f4832fa01114111511141113111411131112111311121111111211111110111111100f11100f550e01e8000621ab2f0154cf40f400c901fb001110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af55491034102301ea00cec87f01ca00111611151114111311121111111055e0011115011116ce01111301ce01111101ce0fc8ce1ece1ccb071aca0018cbff06c8cbff15f40013f400f40001c8f40012f40013f40003c8f40014cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed54551ada06');
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

const Vault_getters: ABIGetter[] = [
    {"name":"get_user","methodId":91785,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultUserView","optional":false}},
    {"name":"get_storage_health","methodId":119233,"arguments":[],"returnType":{"kind":"simple","type":"VaultStorageHealthView","optional":false}},
    {"name":"get_user_receipts","methodId":79094,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultUserReceiptsView","optional":false}},
    {"name":"diag_forward_fee","methodId":127218,"arguments":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"diag_compute_fee","methodId":107587,"arguments":[{"name":"gas","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"diag_ext_hard_import","methodId":107995,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_key_record","methodId":104356,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultKeyRecordView","optional":false}},
    {"name":"get_pending_batch_publish","methodId":94421,"arguments":[{"name":"bounceId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingBatchPublishView","optional":false}},
    {"name":"get_pending_ath_withdrawal","methodId":125951,"arguments":[{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_ath_withdrawal_id","methodId":123302,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_ath_withdrawal_for","methodId":104521,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_successor","methodId":129519,"arguments":[],"returnType":{"kind":"simple","type":"VaultSuccessorView","optional":false}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"VaultGlobalView","optional":false}},
]

export const Vault_getterMapping: { [key: string]: string } = {
    'get_user': 'getGetUser',
    'get_storage_health': 'getGetStorageHealth',
    'get_user_receipts': 'getGetUserReceipts',
    'diag_forward_fee': 'getDiagForwardFee',
    'diag_compute_fee': 'getDiagComputeFee',
    'diag_ext_hard_import': 'getDiagExtHardImport',
    'get_key_record': 'getGetKeyRecord',
    'get_pending_batch_publish': 'getGetPendingBatchPublish',
    'get_pending_ath_withdrawal': 'getGetPendingAthWithdrawal',
    'get_ath_withdrawal_id': 'getGetAthWithdrawalId',
    'get_pending_ath_withdrawal_for': 'getGetPendingAthWithdrawalFor',
    'get_successor': 'getGetSuccessor',
    'get_global': 'getGetGlobal',
}

const Vault_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindOfficialAthWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindProfileRegistry"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindUsernameRegistry"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AnnounceSuccessorManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"DepositTon"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EvictDormantUser"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotification"}},
    {"receiver":"external","message":{"kind":"typed","type":"WithdrawTonFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"WithdrawAthFromVaultBalance"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ProfileAvatarTonExcessRefund"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RegisterMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"ReplaceMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"PublishBatchFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"SetProfileAvatarFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"MintUsernameFromVaultBalance"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CapsuleHubBatchAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PruneBatchPublish"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PruneStuckAthPending"}},
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
export const STORAGE_RESERVE_RECOVERY = 23200000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | BindOfficialAthWallet | BindProfileRegistry | BindUsernameRegistry | SealGenesis | AnnounceSuccessorManifest | DepositTon | EvictDormantUser | AthTransferNotification | ATHTransferAck | ATHTransferFailed | ProfileAvatarTonExcessRefund | TopUpStorageReserve | RegisterMessagingKeys | CapsuleHubBatchAck | PruneBatchPublish | PruneStuckAthPending | null) {
        
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AnnounceSuccessorManifest') {
            body = beginCell().store(storeAnnounceSuccessorManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'DepositTon') {
            body = beginCell().store(storeDepositTon(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EvictDormantUser') {
            body = beginCell().store(storeEvictDormantUser(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotification') {
            body = beginCell().store(storeAthTransferNotification(message)).endCell();
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CapsuleHubBatchAck') {
            body = beginCell().store(storeCapsuleHubBatchAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PruneBatchPublish') {
            body = beginCell().store(storePruneBatchPublish(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PruneStuckAthPending') {
            body = beginCell().store(storePruneStuckAthPending(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async sendExternal(provider: ContractProvider, message: WithdrawTonFromVaultBalance | WithdrawAthFromVaultBalance | ReplaceMessagingKeys | PublishBatchFromVaultBalance | SetProfileAvatarFromVaultBalance | MintUsernameFromVaultBalance) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'WithdrawTonFromVaultBalance') {
            body = beginCell().store(storeWithdrawTonFromVaultBalance(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'WithdrawAthFromVaultBalance') {
            body = beginCell().store(storeWithdrawAthFromVaultBalance(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ReplaceMessagingKeys') {
            body = beginCell().store(storeReplaceMessagingKeys(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishBatchFromVaultBalance') {
            body = beginCell().store(storePublishBatchFromVaultBalance(message)).endCell();
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
    
    async getGetStorageHealth(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_storage_health', builder.build())).stack;
        const result = loadGetterTupleVaultStorageHealthView(source);
        return result;
    }
    
    async getGetUserReceipts(provider: ContractProvider, owner: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner);
        const source = (await provider.get('get_user_receipts', builder.build())).stack;
        const result = loadGetterTupleVaultUserReceiptsView(source);
        return result;
    }
    
    async getDiagForwardFee(provider: ContractProvider, cells: bigint, bits: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(cells);
        builder.writeNumber(bits);
        const source = (await provider.get('diag_forward_fee', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getDiagComputeFee(provider: ContractProvider, gas: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(gas);
        const source = (await provider.get('diag_compute_fee', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getDiagExtHardImport(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('diag_ext_hard_import', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetKeyRecord(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_key_record', builder.build())).stack;
        const result = loadGetterTupleVaultKeyRecordView(source);
        return result;
    }
    
    async getGetPendingBatchPublish(provider: ContractProvider, bounceId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(bounceId);
        const source = (await provider.get('get_pending_batch_publish', builder.build())).stack;
        const result = loadGetterTupleVaultPendingBatchPublishView(source);
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
    
    async getGetSuccessor(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_successor', builder.build())).stack;
        const result = loadGetterTupleVaultSuccessorView(source);
        return result;
    }
    
    async getGetGlobal(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_global', builder.build())).stack;
        const result = loadGetterTupleVaultGlobalView(source);
        return result;
    }
    
}