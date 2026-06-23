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

export type CreateReceiveIntent = {
    $$type: 'CreateReceiveIntent';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeCreateReceiveIntent(src: CreateReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981365, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadCreateReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981365) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'CreateReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleCreateReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'CreateReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleCreateReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'CreateReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleCreateReceiveIntent(source: CreateReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
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
    envelope_padding: Slice;
}

export function storeClaimReceiveIntent(src: ClaimReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981366, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadClaimReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981366) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'ClaimReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleClaimReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'ClaimReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleClaimReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'ClaimReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleClaimReceiveIntent(source: ClaimReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
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
    envelope_padding: Slice;
}

export function storeCancelReceiveIntent(src: CancelReceiveIntent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2115981367, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadCancelReceiveIntent(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2115981367) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'CancelReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleCancelReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'CancelReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleCancelReceiveIntent(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'CancelReceiveIntent' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleCancelReceiveIntent(source: CancelReceiveIntent) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
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
        b_1.storeUint(src.created_at, 64);
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
    const _created_at = sc_1.loadUintBig(64);
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
    amount: bigint;
    created_at: bigint;
}

export function storePendingProfileAvatarPayment(src: PendingProfileAvatarPayment) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingProfileAvatarPayment(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
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
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingUsernameMintPayment(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
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
        b_1.storeUint(src.created_at, 64);
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
    const _created_at = sc_1.loadUintBig(64);
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
    const _receipts = Dictionary.load(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), sc_0);
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, receipts: _receipts };
}

export function loadTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    const _receipts = Dictionary.loadDirect(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), source.readCellOpt());
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, receipts: _receipts };
}

export function loadGetterTupleUserState(source: TupleReader) {
    const _ton_balance = source.readBigNumber();
    const _ath_balance = source.readBigNumber();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _publish_nonce = source.readBigNumber();
    const _receipts = Dictionary.loadDirect(Dictionary.Keys.Uint(8), dictValueParserReceiptSlot(), source.readCellOpt());
    return { $$type: 'UserState' as const, ton_balance: _ton_balance, ath_balance: _ath_balance, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, publish_nonce: _publish_nonce, receipts: _receipts };
}

export function storeTupleUserState(source: UserState) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ton_balance);
    builder.writeNumber(source.ath_balance);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.publish_nonce);
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
    pending_batch_publishes: Dictionary<bigint, PendingBatchPublish>;
    pending_profile_avatar_payments: Dictionary<bigint, PendingProfileAvatarPayment>;
    pending_username_mint_payments: Dictionary<bigint, PendingUsernameMintPayment>;
    user_count: bigint;
    key_record_count: bigint;
    receive_intent_count: bigint;
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
        b_2.storeDict(src.receive_intents, Dictionary.Keys.BigUint(128), dictValueParserReceiveIntent());
        const b_3 = new Builder();
        b_3.storeDict(src.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_3.storeDict(src.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal());
        b_3.storeDict(src.pending_batch_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish());
        const b_4 = new Builder();
        b_4.storeDict(src.pending_profile_avatar_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment());
        b_4.storeDict(src.pending_username_mint_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment());
        b_4.storeUint(src.user_count, 64);
        b_4.storeUint(src.key_record_count, 64);
        b_4.storeUint(src.receive_intent_count, 64);
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
    const _receive_intents = Dictionary.load(Dictionary.Keys.BigUint(128), dictValueParserReceiveIntent(), sc_2);
    const sc_3 = sc_2.loadRef().beginParse();
    const _processed_ath_deposits = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_3);
    const _pending_ath_withdrawals = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), sc_3);
    const _pending_batch_publishes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish(), sc_3);
    const sc_4 = sc_3.loadRef().beginParse();
    const _pending_profile_avatar_payments = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), sc_4);
    const _pending_username_mint_payments = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), sc_4);
    const _user_count = sc_4.loadUintBig(64);
    const _key_record_count = sc_4.loadUintBig(64);
    const _receive_intent_count = sc_4.loadUintBig(64);
    const _processed_ath_deposit_count = sc_4.loadUintBig(64);
    const _pending_ath_withdrawal_count = sc_4.loadUintBig(64);
    const _pending_publish_count = sc_4.loadUintBig(64);
    const _genesis_ext = sc_4.loadRef();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_batch_publishes: _pending_batch_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, genesis_ext: _genesis_ext };
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
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigUint(128), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    source = source.readTuple();
    const _pending_batch_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish(), source.readCellOpt());
    const _pending_profile_avatar_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), source.readCellOpt());
    const _pending_username_mint_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _genesis_ext = source.readCell();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_batch_publishes: _pending_batch_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, genesis_ext: _genesis_ext };
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
    const _receive_intents = Dictionary.loadDirect(Dictionary.Keys.BigUint(128), dictValueParserReceiveIntent(), source.readCellOpt());
    const _processed_ath_deposits = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_ath_withdrawals = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal(), source.readCellOpt());
    const _pending_batch_publishes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish(), source.readCellOpt());
    const _pending_profile_avatar_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment(), source.readCellOpt());
    const _pending_username_mint_payments = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment(), source.readCellOpt());
    const _user_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _receive_intent_count = source.readBigNumber();
    const _processed_ath_deposit_count = source.readBigNumber();
    const _pending_ath_withdrawal_count = source.readBigNumber();
    const _pending_publish_count = source.readBigNumber();
    const _genesis_ext = source.readCell();
    return { $$type: 'Vault$Data' as const, vault_ath_wallet_address: _vault_ath_wallet_address, ath_master_address: _ath_master_address, capsule_hub_address: _capsule_hub_address, profile_registry_address: _profile_registry_address, username_registry_address: _username_registry_address, binding_flags: _binding_flags, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, users: _users, key_records: _key_records, receive_intents: _receive_intents, processed_ath_deposits: _processed_ath_deposits, pending_ath_withdrawals: _pending_ath_withdrawals, pending_batch_publishes: _pending_batch_publishes, pending_profile_avatar_payments: _pending_profile_avatar_payments, pending_username_mint_payments: _pending_username_mint_payments, user_count: _user_count, key_record_count: _key_record_count, receive_intent_count: _receive_intent_count, processed_ath_deposit_count: _processed_ath_deposit_count, pending_ath_withdrawal_count: _pending_ath_withdrawal_count, pending_publish_count: _pending_publish_count, genesis_ext: _genesis_ext };
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
    builder.writeCell(source.receive_intents.size > 0 ? beginCell().storeDictDirect(source.receive_intents, Dictionary.Keys.BigUint(128), dictValueParserReceiveIntent()).endCell() : null);
    builder.writeCell(source.processed_ath_deposits.size > 0 ? beginCell().storeDictDirect(source.processed_ath_deposits, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_ath_withdrawals.size > 0 ? beginCell().storeDictDirect(source.pending_ath_withdrawals, Dictionary.Keys.BigInt(257), dictValueParserPendingAthWithdrawal()).endCell() : null);
    builder.writeCell(source.pending_batch_publishes.size > 0 ? beginCell().storeDictDirect(source.pending_batch_publishes, Dictionary.Keys.BigInt(257), dictValueParserPendingBatchPublish()).endCell() : null);
    builder.writeCell(source.pending_profile_avatar_payments.size > 0 ? beginCell().storeDictDirect(source.pending_profile_avatar_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingProfileAvatarPayment()).endCell() : null);
    builder.writeCell(source.pending_username_mint_payments.size > 0 ? beginCell().storeDictDirect(source.pending_username_mint_payments, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMintPayment()).endCell() : null);
    builder.writeNumber(source.user_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.receive_intent_count);
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
    const __code = Cell.fromHex('b5ee9c72420201f800010000aa7100000114ff00f4a413f4bcf2c80b0001020120000200af02014800030079047ad001d072d721d200d200fa4021103450666f04f86102f862ed44d0d20001e30f1119e302705618d74920c21f97311118d31f1119de21821090e2e0cbba00b000b200040017046e11178020d7217021d749c21f9430d31f01de20821041544810bae3022082104154481abae3022082104154481cbae3028210a4f862d1ba00050009000b000d01fe30d33fd37f5932011118011119813a985612f2f4813ebcf8425619c705f2f4813ebd5619c200f2f42a810101561b59f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd33f3010261025102410236c166f06e2813ebe216eb3f2f46f2622813ebf1120ba01111f01f2f41117111c11171116111b1116000602e81115111a11151114111911141113111811131112111c11121111111b11111110111a11100f11190f0e11180e0d111c0d0c111b0c0b111a0b0a11190a0911180908111c0807111b0706111a06051119050411180403111c0302111b0201111a0111195618db3c045620a01045431381010b5026c801a0000701fc55505056cb7f13cb7fcbffcbffcb3ff400c902111002561a01206e953059f45930944133f413e2f8416f24135f031118111e11181117111d11171116111c11161115111b11151114111a1114111311191113111211181112111111171111111011161110011115010e11140e0d11130d0c11120c0b11110b0a11100a109f000802ca108e107d106c105b104a103948301716db3c011118010a810101f45a3001a51116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc1a1b1089107810671056104510344013005501f701f430d33fd37f5932011118011119813a985612f2f48140fbf8425619c705f2f48140fc5619c200f2f428810101561b59f40d6fa192306ddf206e92306d9dd0fa40d37fd33f55206c136f03e28140fd216eb3f2f46f23218140fe111dba01111c01f2f41119111b11191118111a1118111711191117111611181116000a028c1115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354104db3c004f01f701f430d33fd37f5932011118011119813a985612f2f4814123f8425619c705f2f48141245619c200f2f427810101561b59f40d6fa192306ddf206e92306d9dd0fa40d37fd33f55206c136f03e2814125216eb3f2f46f2321814126111dba01111c01f2f41119111b11191118111a1118111711191117111611181116000c028c1115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354104db3c004b01f704fe8ffad33fd39f5932f8425616c705b38eb15b1115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce0298101012259f40d6fa192306ddf206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e2206ee3026f29306c2233e05f0f01f7000e000f001601645f031115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c01f703fc1118111c11181117111b11171116111a11161115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a0911190908111c0807111b0706111a060511190504111c0403111b0302111d0201111e01db3c01111abde3025616561601b900100011017e571757185718571857181111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a103948660701f701f8561656165616561656165616561656165616561656165616561656165616561656165616561656165616562f1117112e11171116112d11161115112c11151114112b11141113112a11131112112911121111112811111110112711100f11260f0e11250e0d11240d0c11230c0b11220b0a11210a0911200908111f08001202fc07111e0706111d0605111c0504111b0403111a03021119020111180111305632db3c6cc66cc6111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df01a0001303fe10ce10bd10ac109b108a1079106855061121db3c111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e112172843fdb3c0504431381010b5026c8006d01b3001402ee55505056cb7f13cb7fcbffcbffcb3ff400c9031110031201111a01206e953059f45930944133f413e21119e3010111170107810101f45a301114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10ad109c108b107a0910581047103645404330001501f701b61115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df0e11180e10bd551a1118db3c0e11180e0e11170e11160e11150e11140e11130e11120e11110e11100e0f0d55a1007800045f0a043ce30221821018db2ccbbae30221821050a61103bae30221821050a61104ba0018001a001d002004fa5b1117d3fffa4030011118011119db3cdb3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540813aa21118db3cb301111901f2f4813aa35619c300f2f4813aa45610c0000025002600a2001902d0917f955610561abae2f2f4813aaa1118561adb3c57115715011117010ff2f4813aabf828561901c705b3f2f40fa411141117111411131116111311141115111411111114111111101113111011120e11110e10cf10be10ad109c108b107a1069105810471036454001c701f703f65b1117d3fffa4030011118011119db3cdb3c813aa5f842561901c705f2f4813aa65619c201f2f4813aa75611c000917f955611561abae2f2f4813aa8f842561b01c705b3f2f4813aa9f82811181119111811171119111711161119111611151119111511141119111411131119111311121119111211111119111100250026001b02fe1110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a091119090811190807111907061119060511190504111904031119030211190201111901db3c571157175619011110c70501111701f2f41113111611131112111511121111111411111110111311100f11120f0e11110e10cf10be10ad109c108b00cc001c011c107a10691058104710364513504201f704fa5b1117d3fffa4030011118011119db3cdb3c813ab15619c201f2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540813ab21118db3cb301111901f2f42f813ab3111aba0025002601c2001e02fc01111901f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1117813ab411185619db3c5715011118011114f2f4813ab5f828561901c705b3f2f41110a60211151117111511141116111411131115111311131114111311111113111111120f11110f0e11100e01c7001f013010df10ce10bd10ac109b108a10791068105710461035443001f7043ce3022182103a12d1adbae3022182105355434dbae3022182102aafbd98ba00210024002b002d04fa5b1117d3fffa4030011118011119db3cdb3c813ab85619c201f2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540813ab91118db3cb301111901f2f42f813aba111aba0025002601de002202fc01111901f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1117813abb11185619db3c5714011118011113f2f4813abcf828561901c705b3f2f41110a604111511171115111411161114111311151113111211140f11110f0e11100e10df10ce10bd10ac109b01c70023011c108a10791068105710461035440301f704fe5b1117d3ff301116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411184130db3cdb3c813aac5619c201f2f45610813aad111aba01111901f2f4813aae1118db3c01111901f2f4813aaff84256180025002600a200270010813a995612b3f2f40032813ab65610c300f2f4813ab7c8f842cf16c9f9005611baf2f401fe01c705b3f2f4813ab05617f8281118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a091119090811190807111907061119060511190504111904031119030211190201111a01002804b6db3c01111a01c70501111801f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e813abd1118db3c01111901f2f4813abe1118db3c01111901f2f4813abf56140111190100cc01c201de002903fedb3c01111901f2f4813ac0561301111901db3c57105711011117010ef2f4813ac1f828561301c705b3f2f4813ac2f828561201c705b3f2f41114111511141113111411131112111311121111111211111110111111100f11100f8228354a6ba7a180007f11110f11100f1f10de10cd10bc10ab109a1089107810671056104501c701c7002a00f410344033c87f01ca0011181117111611151114111311121111111055e0011117011118ce01111501ce01111301ce1111c8ce01111001ce1ecb071cca001acbff08c8cbff17f40015f40013f40001c8f40012f40012f40002c8f40014f40014cb3f14cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed5401fe5b1117d3fffa4030011118011119813a985612f2f4d0d3ff813aca22c300f2f4813acbc8f842cf16c9f90023baf2f4813acc01d20030b3f2f47fc812cbffca0001111801cbff011118cf16f82301cb3fc91115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df002c012e10ce10bd10ac109b108a1079106810571046103544301201f7043ce302218210472d9d7dbae30221821041544811bae30221821041544813ba002e0032003b004804fe5b1117d37f301116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411184130813a985612f2f4813e8a5619c200f2f481010bf84256105959f40a6fa131e30ff842db3c111e15a081010bf8421025002f003001a00031002a813e8cf8416f24135f03561a82081e8480a0bef2f4003c813e8bf8416f24135f03561a8208989680a082081e8480a0bef2f406a40601ee10241023111f16c855505056cb7f13cb7fcbffcbffcb3ff400c9031110031201111a01206e953059f45930944133f413e21116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f0e0f10cd10bc10ab109a108910781067105610451034413001f701f45b1117d33fd39fd37ffa40301117111911171116111811161115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a091119090811180807111907061118060511190504111804031119030211180201111a01111b003302fa813a985612f2f4813e8df8425619c705f2f4813e8e561bc200f2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540813eca1118561cdb3c01111901f2f411161117111601c7003403f61115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e561b561adb3c2c8101012259f40c6fa131e3022f81010b561e59f40a6fa1318e12813e90f8416f24135f0382080f4240bef2f48e15813e8ff8416f24135f038208c65d40bef2f407a407e21117111811170035003600380024c882104144504901cb1f58cf16cb3fc9f90001f430571bf8416f24135f0382080f4240be8e4bf84282080f4240111a70111a70111d01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc91403111a030211190201111b014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0099021119025717571730e2111311171113111211161112111111151111003701341110111411100f11130f0e11120e0d11110d0c11100c10bf553a01f702f41116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540561cdb3c045621a01045431381010b5026c855505056cb7f13cb7fcbffcbffcb3ff400c9031110031201111e0101a0003901f6206e953059f45930944133f413e281010120103c1201111901561c01216e955b59f45a3098c801cf004133f442e201a4f84282080f4240111a70111a70111d01c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc91403111a030211190201111b014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00003a01641112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af108d107c105a5544414301f704fc5b1117d33fd37f30011118011119813a985612f2f427810101561a59f40d6fa192306ddf206e92306d9dd0fa40d37fd33f55206c136f03e2206eb3e3023028810101561a59f40d6fa192306ddf206e92306d9dd0fa40d37fd33f55206c136f03e2206eb3e30230f8425618c705e3022a810101561a59f40d6fa192306ddf003c00400044004501fe6f2321814114111eba01111d01f2f4f8421117111a11171116111911161115111811151114111a11141113111911131112111811121111111a11111110111911100f11180f0e111a0e0d11190d0c11180c0b111a0b0a11190a0911180908111a08071119070611180605111a05041119040311180302111a02011119011118003d04dadb3c01111901c7058ee1814115f8425618c705f2f41116111b11161115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a10491038471550621314db3ce30d003e004b003f01f701085613db3c00cc019e5718571857190111170103810101f45a301112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a10491038075055461604db3c004d01fe6f23218140ec111eba01111d01f2f4f8421117111a11171116111911161115111811151114111a11141113111911131112111811121111111a11111110111911100f11180f0e111a0e0d11190d0c11180c0b111a0b0a11190a0911180908111a08071119070611180605111a05041119040311180302111a02011119011118004104dadb3c01111901c7058ee18140edf8425618c705f2f41116111b11161115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a10491038471550621314db3ce30d0042004f004301f701085614db3c00cc019a5718571857190111170104810101f45a301112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a1049476845135024db3c00510164571857181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d01f701fa206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd33f3010261025102410236c166f06e2813e9c216eb3f2f46f2622813e9d1121ba01112001f2f4813e9ef84224c705f2f4f8416f24135f03111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116004602fe1115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001111f01db3c011118010a810101f45a3001a51116111711161115111611151114111511141113111411131112111311121111111211111110111111100055004701380f11100f10ef10de10cd10bc1a1b108910781067105610451034401301f704a4e30221821050a61121bae3022182103215b5fdba8eb35b57171115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce021821052705edaba0049005901f7005d03fe5b1117d33fd37f30011118011119813a985612f2f427810101561a59f40d6fa192306ddf206e92306d9dd0fa40d37fd33f55206c136f03e2206eb3e3023028810101561a59f40d6fa192306ddf206e92306d9dd0fa40d37fd33f55206c136f03e2206eb3e30230813ec6f8425619c705f2f4813ec7561ac200f2f42a810101004a004e005202f26f232181411e111eba01111d01f2f481411ff842561bc705f2f41119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035410403db3c004b01f702f4301117111a11171116111911161115111811151114111a11141113111911131112111811121111111a11111110111911100f11180f0e111a0e0d11190d0c11180c0b111a0b0a11190a0911180908111a08071119070611180605111a05041119040311180302111a020111190111185619db3c111e14a081010b01a0004c01f6111e14c855505056cb7f13cb7fcbffcbffcb3ff400c9103f0211190201111a01206e953059f45930944133f413e20111180105810101f45a301114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf104e10ad109c108b107a10691058071036454013db3c004d000a01832fa10102f26f23218140f6111eba01111d01f2f48140f7f842561bc705f2f41119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035410403db3c004f01f702f4301117111a11171116111911161115111811151114111a11141113111911131112111811121111111a11111110111911100f11180f0e111a0e0d11190d0c11180c0b111a0b0a11190a0911180908111a08071119070611180605111a05041119040311180302111a020111190111185619db3c111e14a081010b01a0005001fa111e14c855505056cb7f13cb7fcbffcbffcb3ff400c9103f0211190201111a01206e953059f45930944133f413e20111180106810101f45a301114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf105e10ad109c108b107a106908104710364015503304db3c0051000a01831fa10101fe561a59f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd33f3010261025102410236c166f06e2813ec8216eb3f2f46f2622813ec91121ba01112001f2f41117111c11171116111b11161115111a11151114111911141113111811131112111c11121111111b11111110111a11100f11190f0e11180e005302f80d111c0d0c111b0c0b111a0b0a11190a0911180908111c0807111b0706111a06051119050411180403111c0302111b0201111a0111195618db3c045620a01045431381010b5026c855505056cb7f13cb7fcbffcbffcb3ff400c902111002561a01206e953059f45930944133f413e2f8416f24135f031118111e111801a0005402fe1117111d11171116111c11161115111b11151114111a1114111311191113111211181112111111171111111011161110011115010e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a10394830171601111f01db3c011118010a810101f45a3001a51116111711161115111611151114111511140055005801f4316c2232702282081e8480bc99300182081e8480a1019132e25cbc91319130e220c101915be01117111911171116111811161115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a091119090811180807111907005602fe06111806051119050411180403111903021118020111190111185619db3c111e15a081010b111e15c855505056cb7f13cb7fcbffcbffcb3ff400c9103f0211190201111a01206e953059f45930944133f413e21115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e01a00057002e10df0e10bd10ac109b108a10791068105710461035440301681113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc1a1b108910781067105610451034401301f702fa5b1117d33f31fa40d37f30011118011119813a985612f2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655408141281118db3c01111901f2f4814129f8425615c705f2f401c2005a04fe81412a11185619db3c01111901f2f481412b561ac200f2f42d81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e281412c216eb3f2f4f8416f24135f0382081e8480bbe302f8416f24135f0382081e8480a120561cbc913092571be2561ac101e3026f26111f15a081010b01c7005b005b005c016630571857181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b01f701de111f15c855505056cb7f13cb7fcbffcbffcb3ff400c9103e02111a0201111901206e953059f45930944133f413e21114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf0e10ad109c108b107a10691058104710364015504301f702fe8efc5b1117d3ffd3ffd3ffd430d0d3ffd30fd4d30f301117111c11171116111b11161115111a11151114111911141113111811131112111c11121111111b11111110111a11100f11190f0e11180e0d111c0d0c111b0c0b111a0b0a11190a0911180908111c0807111b0706111a06051119050411180403111c0302111b02e0005e006502f801111d01111e813a985612f2f4561a561a561e561e56215623db3c813ef65619c300f2f4813ef75619561bbdf2f481010bf84256105959f40a6fa1311117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c005f00610160813ee506c30016f2f4813ee604c30014f2f4813eeb24c002f2f4813ee902c30012f2f4813eea218104a0baf2f459db3c006000e8813eeb02c00212f2f4207af941813eec03c00a13f2f4813eed01812500baf2f4813ef101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d0813ef221d74923aa02baf2f45331bc9e32813ef322d74ac001f2f401d4309b813ef401d74ac000f2f401e259a101e85b03f80b11180b0a11180a0911180911180807065540561fdb3c5619968208989680a0df82081e8480a0813eeef8416f24135f0358bef2f4f842db3c32813eef03c00013f2f470f8421118111d11181117111c11171116111b11161115111a11151114111911141113111d11131112111c11121111111b11111110111a1110012a01a0006202f80f11190f0e111d0e0d111c0d0c111b0c0b111a0b0a11190a09111d0908111c0807111b0706111a060511190504111d0403111c0302111b0201111a01561a5622562256265626562adb3c813ef02f8101012359f40c6fa131b3f2f4111e9306a406df810101f842f823f825561d20104b0a111f0a09112609081125080137006302fc07112807061127060511290504112a04c855b0db3cc9102801111e01561801206e953059f45a30944133f415e2111da481010bf84205111305041117040311180302111902011116011115c855505056cb7f13cb7fcbffcbffcb3ff400c910340211110201111001206e953059f45930944133f413e20a11170a09111609013a006401520811150807111407061113060511120504111104031110034f1e10ad0c10ab1029103846744515503301f703c0218210874e5771bae302218210720bdd6ebae3025719c0001118c12101111801b08eb5813ee3f2f01115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551ce05f0f5f09f2c0820066007101f702fe5b1117d3ffd33f30011118011119813a985612f2f48140a6f8425617c705f2f45618db3c2a8101012259f40d6fa192306ddf206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e28140a7216eb3f2f46f29303334038140a81120ba01111f01f2f41118111c11181117111b11171116111a111601aa006702fe1115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a0911190908111c0807111b0706111a060511190504111c0403111b0302111a0201111901561b01111adb3c5617561756175617561756175617561756175617561756170068006b01f25611c101915be081409c561181010b2459f40a6fa131f2f48212540be40001a8205612bc93305610de1117111911171116111811161115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a0911190908111808006902f60711190706111806051119050411180403111903021118020111190111185619db3c04561ea001111501111ea103111d03111481010b111ec855505056cb7f13cb7fcbffcbffcb3ff400c9103f0211190201111a01206e953059f45930944133f413e211151117111511141116111411131115111311121114111201a0006a00561111111311111110111211100f11110f0e11100e10df0e10bd10ac109b108a10791068105710461035440301f85617561756175617561756175617561756175617561756171117112f11171116112e11161115112d11151114112c11141113112b11131112112a11121111112911111110112811100f11270f0e11260e0d11250d0c11240c0b11230b0a11220a091121090811200807111f0706111e0605111d0504111c0403111b03006c03f802111a020111190111185632db3c6cc66cc6111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1122db3c111d111f111d111c111e111c01a0006d006e006081232870f83670f8416f24135f0322bc9a30f8416f24135f0301a19131e25301bc91309131e220c2009316a0059130e202fa111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d0111210171011123db3c0504431381010b5026c855505056cb7f13cb7fcbffcbffcb3ff400c9031110031201b3006f02f401111b01206e953059f45930944133f413e211198ed81115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df0e11180e10bd551adb3c0e11180e11170e11160e11150e11140e11130e11120e11110e11100e0f0d55a1df0111160107810101f45a300078007001761114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10ad109c108b107a0910581047552301f702f65b1117d3ff301116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411184130813a985612f2f48140b3f8416f24135f0382081e8480bef2f45618db3c2a8101012259f40d6fa192306ddf01aa007202fe206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e28140b0216eb3f2f46f29228140b11124ba01112301f2f406e3028140b2f823112282015180a001112201be01112101f2f4f82382015180a0561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f0073007401b05f078140b4f82301111bbe01111a01f2f40111180109810101f45a301116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab090a550701f702fc561f561f561f561f561f1117113711171116113611161115113511151114113411141113113311131112113211121111113111111110113011100f112f0f0e112e0e0d112d0d0c112c0c0b112b0b0a112a0a0911290908112808071127070611260605112505041124040311230302112202011121011120561edb3c6cc601a0007501fc6cc6111d1125111d111c1124111c111b1123111b111a1122111a1119112111191118112011181117111f11171116111e11161115112511151114112411141113112311131112112211121111112111111110112011100f111f0f0e111e0e0d11250d0c11240c0b11230b0a11220a091121090811200807111f0706111e06007602fa562173843fdb3c0504431381010b5026c855505056cb7f13cb7fcbffcbffcb3ff400c902111002562001206e953059f45930944133f413e206111e068101017f0706111e0605111d0504111c0403111b030211220201111f01111ac855805089ce16ca0014ca0012cb3fcb07cb07cbffcb7fcb3fc9021117020111190101b300770280206e953059f45a30944133f415e20e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f104d103c4ba91028104703065045db3c007801f7000601a501020120007a0085020120007b0080020120007c007e03b9b7791da89a1a40003c61e222e2238222e222c2236222c222a2234222a2228223222282226223022262224222e22242222222c22222220222a22201e22281e1c22261c1a22241a1822221816222016215eaa92aa07b678ae20be1ed903000b000b2007d0104db3c014f038db69edda89a1a40003c61e222e2230222e222c222e222c222a222c222a2228222a22282226222822262224222622242222222422222220222222201e22201eaa1db678d9e6d927000b000b2007f007481010b56100259f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2206e943070706de06f266c22327f330102015800810083038db1a27b513434800078c3c445c4460445c4458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403d543b6cf1b319b31a000b000b20082007681010b56100259f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2206e9730707054700020e06f26307f5540038db0357b513434800078c3c445c4460445c4458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403d543b6cf1b39db29e000b000b20084008e8101012b0259f40d6fa192306ddf206e92306d8e19d0fa40d200d200d33fd307d307d3ffd37fd33f55806c196f09e2206e993070f8287054700070e06f29365b7f06051034413002012000860096020120008700910201580088008b03a3afd276a268690000f187888b888c088b888b088b888b088a888b088a888a088a888a0889888a088988890889888908888889088888880888888807888807aa876d9e366e9e9e9e9e9e9e9e9e9e9e9eaad0c000b000b20089026c8101012f0259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206e8e8f3070f8287054700020885471115300e06f2c7f55b00132008a0000020162008c008e0393a127b513434800078c3c445c4464445c4458446044584454445c4454445044584450444c4454444c4448445044484444444c44444440444844403c44443c3844403954776cf1b319b31a00b000b2008d0208db3cdb3c00ca009f03a3a25bb513434800078c3c445c4468445c4458446444584454446044544450445c4450444c4458444c4448445444484444445044444440444c44403c44483c3844443834444034433d54af6cf15c417c3db20600b000b2008f0104db3c009000046c21020378a000920094038fa10fb513434800078c3c445c4460445c4458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403d543b6cf15c417c3db20600b000b20093000670f8360323a36fb513434800078c3f6cf15c417c3db20600b000b200950014830c820807fff870f838020120009700990391b5c69da89a1a40003c61e222e2230222e222c222e222c222a222c222a2228222a22282226222822262224222622242222222422222220222222201e22201eaa1db678d954d954d895000b000b2009800a483062e0259f40f6fa192306ddf206e92306d8e27d0fa40fa40d307d37fd3ffd33fd401d0d37fd33fd200301039103810371036103510346c196f09e2206e9d3070f828f82870547000530070e06f297f5580020120009a00aa020120009b009d0399acd376a268690000f187888b888c888b888b088c088b088a888b888a888a088b088a0889888a88898889088a088908888889888888880889088807888887870888072a8eed9e2b882f87b640c000b000b2009c0104db3c00ca020120009e00a00389f5da89a1a40003c61e222e2230222e222c222e222c222a222c222a2228222a22282226222822262224222622242222222422222220222222201e22201eaa1db678d98cd98d00b000b2009f008e8101012c0259f40d6fa192306ddf206e92306d8e1dd0fa40fa40fa40d37fd401d0d37fd33f3010261025102410236c166f06e2206e9a3070f828f828f8287020e06f26317f554003c0abb3ed44d0d20001e30fdb3c5717571757175717571757175717571757175717571757175717571757175717571757175717571757175717571857161114111511141113111411131112111311121111111211111110111111100f11100f550e00b000b200a102f270561292302fde56121117111911171116111811161115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a0911190908111808071119070611180605111905041118040311190302111802011119011118db3c00a200a3010671db3c01df02fe1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540db3c11171118111711161118111611151118111511141118111411131118111311121118111211111118111101c200a402fe1110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540db3c5611561756175617561c561c547dcb2c1117112211171116112111161115112011151114111f11141113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11180d0c11220c0b11210b01de00a502fe0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011122011121db3c1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a091118091118080706554000a600a7000821a9381f03fedb3c1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540db3c820151808228354a6ba7a18000562ba11113112a111311121129111211111128111111101125111001d401f300a801fa0f11240f0e11230e0d11220d0c11210c0b11200b0a111f0a09111e0908111d08071127070611260605111c0504111b041023562603112c018212540be4008228354a6ba7a18000111d112e111d111c112d111c111b112c111b111a112b111a1119112a1119111811291118111711281117111c1127111c111b1126111b00a900a8111a1125111a111711241117111c1123111c111b1122111b111a1121111a111711201117111c111f111c111b111e111b111a111d111a1117111c11171119111b11191118111a111811171119111711171118111702012000ab00ad0399ac7976a268690000f187888b888c888b888b088c088b088a888b888a888a088b088a0889888a88898889088a088908888889888888880889088807888887870888072a8eed9e2b882f87b640c000b000b200ac000670f8380321acf7f6a268690000f187ed9e366236624000b000b200ae003220d0d3ff31d2000196307070f82821e17f01d3fffa40d33f30044ef2eda2edfbed44d0d20001e30f1118d70d1ff2e0822182107e1f5038bae3022182107e1f5039ba00b000b200b300bf01fcfa40fa40fa40d401d0fa40fa40d307d200d3ffd430d0d3fff404f404f404d430d0f404f404f404d430d0f404f404d33fd33fd33fd33fd33fd33fd43011151118111511151117111511151116111557181116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f00b10004550e00f8fa40fa40fa40d401d0810101d700d200d200810101d7003010471046104507d1550553447005927135de533570c85290cbffca00c9068e133023913693331025e28228354a6ba7a18000069137e26d6d6d6d6d6d6d6d7054700053001110111511100f11140f1110111311101110111211100e11110e0e11100e550d01f431fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b0100b402fa81420421d749c000f2f481420501d74ac000f2f4813a985612f2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655408141a011185619db3c01111901f2f42d81010b561a01c700b501fe59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e28141a1216eb3f2f46f268141a223c300f2f48141a35621f90001112124f91001112001f2f4111fd0d31f8141a402821056545731ba12f2f4d3ff8141a5025616ba12f2f4fa408141a6f82813c70512f2f4fa408141a702561fc70500b601f612f2f4d33f8141a8025621ba12f2f48141b02582081e8480bef2f4f8000482081e8480a1111fa420a571705300112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a111811171119111711161118111611151117111511141116111400b704fe1113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac0a11240a108910781067105605112305db3c81010b547654547654c855505056cb7f13cb7fcbffcbffcb3ff400c902111602562101206e953059f45930944133f413e2f80f561ed749c000e303561ed74ac001e303111e01db00b800b800b9016c57145f05571857181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d01f703fed430d0d37ffa4020d749c0008eb55f083e57181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551be1d74ac0008eb55f073e57181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551b01f701f700ba03f6e121c2008eb55f073e57181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551be1f8285210c705b38eb55f073e57181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551be101f701f700bb04fe1117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111e11100f111d0f0e111f0e0d111b0d0c111a0c0b11190b0a11180a09111e0908111d0807111f0706111b0605111a05041119040311180302111e0201111d01111f561fdb3ce303561b561ebee303111b561d01c700bc00bc00bd016c5718571857185718571857185718571857180e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f558501f701fca10403111a030211190201111801111e81010b111dc855505056cb7f13cb7fcbffcbffcb3ff400c9103a0211180201111c01206e953059f45930944133f413e201111801111670716d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000e11170e0d11160d0c11150c0b11140b0a11130a091112090811110800be012407111007106f10be104d103c4ba95e345e4101f702fc8efa31fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b01e02100c0012202fa81420421d749c000f2f481420501d74ac000f2f4813a985612f2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540813ecb11185619db3c01111901f2f42d81010b561a01c700c101fe59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2813e98216eb3f2f46f26813e9f23c300f2f4813ea05621f90001112124f91001112001f2f4111fd0d31f813ea102821056574131ba12f2f4d3ff813ea2025616ba12f2f4fa40813ea3f82813c70512f2f4fa40813ea402561fc70500c201fe12f2f4d33f813ea5225622baf2f4813e9b26820b750280bef2f4f8001120a420a572705300112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111300c304fc1112111311121111111211111110111111100f11100f10ef10de10cd10bc105605112405db3c05820b750280a181010b547154547659c855505056cb7f13cb7fcbffcbffcb3ff400c902111602562001206e953059f45930944133f413e2f80f5620d749c000e3035620d74ac001e3031120d430d0d37ffa4020d749c00001db00c400c400c5017057145f055718571857181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b01f704fe8eb55f083e571757171114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552ae1d74ac0008eb55f073e571757171114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552ae121c200e303f8285210c70501f701f700c600c7016a5f073e571757171114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552a01f702fab38eb55f073e571757171114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552ae11117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111e11100f111d0f0e11210e0d111b0d0c111a0c0b11190b01f700c804fc0a11180a09111e0908111d080711210706111b0605111a05041119040311180302111e0201111d0111215621db3c8eba57185718571857185718571857185718571857180d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e5593e1561a561ebee30311171118111711161117111601c701f701e000c903fe1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e561f011121db3c2b8101012259f40c6fa1318eb7305718571857185718571857185718571857180e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f5585e0111a561da104111c0400ca01f700cb002ac882104157494401cb1f58cf16cb3fc9f900a9383f02fe030211190201112001111e81010b111cc855505056cb7f13cb7fcbffcbffcb3ff400c9102b01111701561b01206e953059f45930944133f413e21112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af0e108d107c106b105a1049103847601443500211180201111a561bdb3c00cc0120016a20fa443070585619db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d000cd012488c87001ca0055215023810101cf00cecec900ce0114ff00f4a413f4bcf2c80b00cf02016200d0011a04f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba00d100db00dd00de04cc058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544815bae3022082104154481dba00d200d600d300d400e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54015c30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400d604f88eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e02082104154481bba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0208210178d4519bae302208210472d9d7dba00d600d600d500d8015c30d33ffa00593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400d602ea81378c21c200f2f4f84210685e34103748705280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305167a0f8285220c705b3941028375be30d10455512011500d7006e7080400a7f0ac8598210415448135003cb1fcb3fcb7fc9134a4019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104503fc8eb830d33fd39f5932813800f84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821089129d60ba8eb830d33fd39f59328138eaf84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e000da00da00d901868210a11a7002ba8eb7d33fd39f593281394ef84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f0700da03a655515376db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2813801216eb3f2f46f25135f0355512981380209db3c29ba18f2f4104810374614403305db3c011d0117010e01fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa0200dc0052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00103555120109043ce30221821041544814bae3022182104154481cbae3022182104154481aba00df00e100e500e904d25b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f4820adc6c0081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1555029db3c705410b5db3c5551547a9b2f00f10110011100e001fedb3c5159a17f541ba5700fc855308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c47b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010354044c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54011404fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4555129db3c705410b500f100e2011000e3003082080f4240a082080f4240a082086acfc0a08209312d00a003fedb3c5551547dcb2ddb3c515ca150dc7f7126544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104d103e4a80103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f030111011400e4014e01a11047104610354440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ef04fe5b05d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422cc705f2f48138d7535bc705f2f4105b104a103948cd53badb3c55408138d85169db3c17f2f48138d927c200f2f48138da2ac200f2f48138db5357bef2f48138dc2a8209c9c380bef2f4550429db3c208208989680a08138ddf8416f24135f0322bef2f455512d00f1010600eb00e604f4db3c705410f5db3c5551547baf5611db3c515aa1103b102a7f7126045611040311110302111002011114011115c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc9106c105c104a10394a90103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf8101100111011400e702668ae2f400c901fb00f8416f24135f035006a146505e21db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400e800ef001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba00ea00f000f300f504fc5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422fc705f2f481393b538ec705f2f4105e104d103c102b1110541f0828db3c554081393c516fdb3c17f2f481393d2ac200f2f481393e27c200f2f481393f535abef2f4813940278209c9c380bef2f4550426db3c208208989680a081394100f1010600eb00ec003c82082dc6c0a082080f4240a082086acfc0a08209312d00a082081e8480a00486f8416f24135f0322bef2f455512adb3c705410c5db3c5551547edc2edb3c515da1106e105d7f71536d07106e05111605041115040311140302111302011117011118c801100111011400ed02e055a0db3cc91035104a10394180103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110471045103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ee00ef005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe5b05d33ffa00fa40fa40f40431fa0081396cf8422ac705f2f410591048103746ab5376db3c81396d29c200f2f481396e5369bef2f481396f2bc000917f972b8209c9c380bee2f2f48209c9c3802ba08209406f40a082081e8480a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1555028db3c705410a500f1011000f2035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f4550401060106010603f0db3c5551547cba2cdb3c515ba14cb07f70264c13011110011111c855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec9106810581047103b4870103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0055200401110114010902fe5b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382098cba80bef2f45134a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f4240710770011000f4009e07c8598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010455512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba00f600fb0100010304ce5b05d33ffa00fa40fa40fa003081397624c200f2f4813977f842105a1049103847bc29db3c1dc7051bf2f455030981397851b8db3c1cf2f425c2008e1b3781397df8416f24135f0382095ef3c0bef2f45137a01049030604e30df84210471036415054491450990110010600f700f903ea813979268209c9c380bef2f481397af8416f24135f032782080f4240a082080f4240a082086acfc0a08209312d00a0bef2f45504543a97db3c555053a6db3c81397b248101012359f40c6fa131b3f2f481397c238101012359f40c6fa131b3f2f4516aa081010182080f4240f8232c544c3052f0c80117011d00f800ba55405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544c9052ccc855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec925513d034b9b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001e8db3cf8416f24135f030982080f4240a082080f4240a019be8e3782080f4240717009c8018210d53276db58cb1fcb3fc91048413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001034923535e245334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400fa006c82080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0004fa5b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a08209312d00a0bef2f410354014503b541a0a2adb3c555053b6db3c8137eb2401100117011d00fc01fc8101012359f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da081010182080f4240f8232e544e30561201c855405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544d9052fec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec9104900fd02fc10384b70441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053abc8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407109700bc8598210415448115003cb1fcb3fcb7fc9443049a0441359c8cf8580ca008900fe00ff000110005acf16ce01fa02806acf40f400c901fb004430c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404f45b05d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842105d104c103b4aef27db3c01111001c7051ef2f48138e22cc200f2f48138e3f8416f24135f032d82082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030c8138e451ebdb3c1ff2f45504543d7ddb3c55505386011001060117010102f8db3c8138e5248101012359f40c6fa131b3f2f48138e62e8209c9c380bef2f48138e7238101012359f40c6fa131b3f2f45168a081010182082dc6c0f823561203021112020111120152c01113c855405045ce12cecb3fcb7fcb3fc910344f70206e953059f45a30944133f415e2717f295159105904031111034edcc8011d010201f05560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07cec9544114103a4c99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0040030504010904f8e30221821041544811ba8f6e5b05d33fd37f308137a021c200f2f4f84210671056104510344880db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137a1216eb3f2f46f2430318137a20aba19f2f48137a3f8425009c70518f2f416810101f45a30104510344130e021010401150109010a02fe5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f84205111005104f103e102d0111110111122adb3c01111301c70501111101f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030f8139481111260110010504fcdb3c01111201f2f45504111053a8db3c555053b6db3c813949248101012359f40c6fa131b3f2f481394a298209c9c380bef2f481394b238101012359f40c6fa131b3f2f4516ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb3fc910344a70206e953059f45a30944133f415e2717f2c08517c0701060117011d0107000afa4430c00001fe106c05111405041113040311120302111102011110010fc855908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc92643144a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc9443001080072441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0044145053c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404c28210472d9d7ebae3022182104154481eba8ebb5b05d33fd37fd39f3081380af84227c705f2f41068105710461035103401db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0218210504e5052bae30237c00006c12116b0010b010e0116011904f65b05d33fd37fd39f30813804f84227c705f2f481380522c200f2f410561046103646785368db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206ee3026f2530813807511dbaf2f410591048103746982a81380808db3c500dba16f2f48101015415005467c0011d010c0117010d0090303738810101530150884133f40c6fa19401d70030925b6de2813806216eb3f2f481380907ba16f2f445334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400dc216e955b59f45a3098c801cf004133f442e25054810101f45a307108700ac8598210415448115003cb1fcb3fcb7fc9104710364890441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003444405c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403f68137fa21c200f2f455525387db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53bcbef2f48137fd511cbaf2f455448137fe543ad8db3c2dba1bf2f4514aa15088810101011d0117010f04f2f45a3010574014541386db3c705385db3c10685e3410374870545ee9db3c539b82082dc6c0ba955b3839f8288e3d717011112fc8598210415448135003cb1fcb3fcb7fc9104d103e1201111101441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00090c0807e21046103544304970546cb052b00110011101120113016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d001110026f82ac87001ca0055215023810101cf00cecec90030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01c4db3c707f541db680400bc855308210415448125005cb1f13cb3fcb7fcecec91069105c104a103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00410504011401901069105810471039487927db3c813796228101012359f40c6fa131b3f2f4810101f82310394ba0c855305034cececb7fcb3fc910364780206e953059f45a30944133f415e245401201150026c8821041544f4701cb1f12cb3f01cf16c9f90003f65b05d33fd39f3081380df8416f24135f0382081e8480bef2f454167628db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e281380e216eb3f2f46f2533106a1059104810374a9b81380f08db3c500cba16f2f4813810f8230982015180a019be18f2f481381106011d01170118002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f009882082dc6c0bd16f2f48101012010345445135099216e955b59f45a3098c801cf004133f442e25024810101f45a30403305c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400588e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c082020148011b011e017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c658011c0178db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e983070705456002802e06f25327f044313011d0002310179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c638011f000654754301fc810101820b750280f82303111d03561f0302111e02561d0201111f01c855505056ce13cececb7f01c8cb7f12cb3fcdc9102b01111a01561b01206e953059f45a30944133f415e201a4820b7502807f70f82803111d0302111b0201111e01c855308210415448105005cb1f13cb3fcb7fcecec956170403111b0302111902012101b0111c014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b1059104810374614400501f7044a821089d648bbbae3022182107e1f5035bae3022182107e1f5036bae3022182107e1f5037ba0123013c0153015901f431fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b01012401fe81420421d749c000f2f481420501d74ac000f2f4813a985612f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2813ef8216eb3f2f46f26813ef924c300f2f4813f0023c300f2f4813f025621f90001112124f91001112001f2f4111fd0813f0821d749810360ba012501fef2f4813f0921d74ac001f2f4d31f813f0302821056524b31ba12f2f4d3ff813f04025617ba12f2f4d3fff828813f0501d30a018309ba12f2f4813f0501d3ff3013ba12f2f4d3ff561e813f0601d30a018309ba12f2f4813f0601d3ff3013ba12f2f4d33f813f07025621ba12f2f482081e8480813efe5361bef2f4f8005155012604f8a11120a420a5737053000a11250a105605112405db3c81010b547654547654c855505056cb7f13cb7fcbffcbffcb3ff400c902111602562001206e953059f45930944133f413e2f80f111fd43020d020d749810320bae303d74ac001e3031117111d11171116111c11161115111b11151114111a111411131119111301db012701280129016a5f073e571757181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d5e2c552a01f7016a5f063e571757181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d5e2c552a01f704f21112111811121111111d11111110111c11100f111b0f0e111f0e0d11190d0c11180c0b111d0b0a111c0a09111b0908111f08071119070611180605111d0504111c0403111b0302111f0201111901111872db3c5621a0011121a1561d21bee3031118d0d3ffd3ffd3ffd30fd4d30f20d749c000e303d74ac000012a012b012c012d001a813ee401c002f2f48209c9c380016e30571757175717571757175717571757170e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e558401f701705f07571757175717571757175717571757170e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e558401f702fe8eb85f06571757175717571757175717571757170e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e5584e11117111c11171116111b11161115111a11151114111911141113111811131112111c11121111111b11111110111a11100f11190f0e11180e0d111c0d0c111b0c0b111a0b01f7012e03fe0a11190a0911180908111c0807111b0706111a06051119050411180403111c0302111b0201111a01112556195619561e561e561e562adb3c8ec057185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe5539e156185625012f01f70131014e05935f0570e103935f0470e123c302935f0470e001935f0370e1208104a0bd935f0370e059db3c013000eeeda2edfb01c302925b70e0207af94102c30a935f0470e0812500bd935f0370e0c309925b70e09321c2008e48807f228104a0ba933080299722c17f923021dee221d020d74922aa02bd955f0470db31e05331bc8e103221d74ac301955f0370db31e001d4309ad74a955f0370db31e001e259a101e85b7f04dcbd8ec057185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe5539e12d810101562259f40d6fa192306ddf206e92306d8e87d0db3c6c1c6f0ce2206ee3026f2c312a562fc70501f70132013301340046fa40d31fd3ffd3ffd401d0d3ffd30fd4d30fd33fd33fd33fd33f30108c108b108a108901823057185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe553901f704f68ec25f0b57185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe5539e1c000e30328841fb9e30328a41117112211171116112111161115112011151114111f11141113111e11131112111d11121111111c111101f701350135013601845f0a57185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe553901f703fa1110111b11100f111a0f0e11190e0d11180d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011122011121562e562256265626562b562b5636db3c2e8101012259f40c6fa131e302f823f8250a11230a09112209081121080711200706111f0605111e050137013801390048c815cbff13cbffcbffc9c882104b45594901cb1f5005cf1613cb1f12cb0fcb0fccc9f90001ba3057185718571857185718571857185718571857185718571857185718571857185718571857185718571857185718571957171115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e01f703f804111d0403111c0302111b0201112501810101112601c855b0db3cc9103602111b0201112401206e953059f45a30944133f415e2810101f823f825702056290b0a111d0a0911200908111f08071123070611220605112105112c5530c855b0db3cc902111702011116015290206e953059f45a30944133f415e20da4013a013a013b004850bcce19cb1f17cbff15cbff03c8cbff12cb0fcc12cb0f12cb3f12cb3f12cb3f12cb3fcd01f601111c011117a10403111a03102601111d01111781010b1119c855505056cb7f13cb7fcbffcbffcb3ff400c9103b0211140201111801206e953059f45930944133f413e21115111711151110111611101113111511131111111411111110111311101111111211110d11110d0c11100c10cf0e105d10ac0b0a050801f701f431fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b01013d01fe81420501d74ac000f2f4813a985612f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2813f56216eb3f2f46f26813f5d23c300f2f4813f5e5621f90001112124f91001112001f2f4561fd0d31f813f5f02821056524331ba12f2f4d3ff813f60025618ba12f2f4013e01fed3fff828800bd721813f6101d3ff3013ba12f2f48307d721813f6201d30701c00112f2f4d33f813f695323baf2f482081e8480813f895381bef2f4f8001122d0810220d7215620800bd721813fa002d3ff3001d3ff30baf2f402a420a574705300112211231122112111231121112011231120111f1123111f111e1123111e013f01fc111d1123111d111c1123111c111b1123111b111a1123111a1119112311191118112311181117112311171116112311161115112311151114112311141113112311131112112311121111112311111110112311100f11230f0e11230e0d11230d0c11230c0b11230b0a11230a091123090811230807112307105605112505014003fedb3c055621a1572181010b56215475435359c855505056cb7f13cb7fcbffcbffcb3ff400c902111502562001206e953059f45930944133f413e2f80f561dd749c0008eb657135f0457185718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c553be1561dd74a01db01f7014104bec0018eb657135f0457185718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c553be1111dd430d0d307d37ffa40d3ff20d749c000e303d74ac000e30323c001917f9323c002e201f7014201440143018a5f093e5718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c5e3b109d108c107b106a1059104810374614505201f704b08ec55f083e5718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c5e3b109d108c107b106a10591048103746145052e122c200e30320e30382086acfc024c00101f7014401440145018a5f083e5718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c5e3b109d108c107b106a1059104810374614505201f70374e30f0a11170a09111609081115080711140706111306051112050411110403111003102f102e109d106c102b108a1039105810471610355044030146014b01f702fe5330a0562501be8ec55f093e5718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c5e3b109d108c107b106a10591048103746145052e11117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100150014703ec0f11180f0e11210e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061118060511210504111f0403111e0302111d0201111c01111b5622561e562156215627db3c2d83062259f40e6fa131e302561f01111da001112501a104031119030211180201112101112081010b111bc8014f01480149017e3057185718571857185718571857185718571857185718571857180a11170a091116090811150807111407061113060511120504111104031110034fed551a015001e655505056cb7f13cb7fcbffcbffcb3ff400c9102a01111601561e01206e953059f45930944133f413e2830682081e8480f82307111f0706111a0605111c0504111b04031119030211200270c855805089ce16ce14cb0712cb7fcbffcb3f01c8cb7f12cb3f12ca00cdc910230211190201111101014a0022206e953059f45b30944133f417e21113a404f01117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11210e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061118060511210504111f0403111e0302111d0201111c01111b5622db3ce303561ddb3c01c7014d01c7014c04b28ebe57185718571857185718571857185718571857185718571857180a11170a091116090811150807111407061113060511120504111104031110034fed551ae15619561fbee3035624561cbee3035622561e5621562156270150014d014d014e017c57185718571857185718571857185718571857185718571857180a11170a091116090811150807111407061113060511120504111104031110034fed551a015003dedb3c2d83062259f40e6fa1318ebf3057185718571857185718571857185718571857185718571857180a11170a091116090811150807111407061113060511120504111104031110034fed551ae0111a561fa101112501111ca10403111b030211180201112101112081010b111bc8014f01500151003cc882105243494401cb1f5005cf165003cf16cb07cb7fcb3fc9f900a9387f00f0c87f01ca0011181117111611151114111311121111111055e0011117011118ce01111501ce01111301ce1111c8ce01111001ce1ecb071cca001acbff08c8cbff17f40015f40013f40001c8f40012f40012f40002c8f40014f40014cb3f14cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed54db3101fc55505056cb7f13cb7fcbffcbffcb3ff400c9102a01111601561e01206e953059f45930944133f413e2830682081e8480f82307111f0706111a0605111c0504111b04031119030211200270c855805089ce16ce14cb0712cb7fcbffcb3f01c8cb7f12cb3f12ca00cdc91023021119021f206e953059f45b30944133f417e20152000a1113a410ce01f431fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b01015401fc81420501d74ac000f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2813f6f216eb3f2f46f26813f7023c300f2f4813f715621f90001112124f91001112001f2f4561fd0d31f813f7202821056524331ba12f2f4d3ff813f73025618ba12f2f4d3fff828800b015501fcd721813f7401d3ff3013ba12f2f48307d721813f7501d30701c00212f2f4d33f30813f795112baf2f4f800111fd0810368d721d430d0d3ffd3ff30561283062359f40f6fa192306ddf206e92306d8e27d0fa40fa40d307d37fd3ffd33fd401d0d37fd33fd200301039103810371036103510346c196f09e2813f94216eb3015601fcf2f46f295f04345622813f9604c70513f2f403813f9803ba12f2f41121a420a575705300112211231122112111231121112011231120111f1123111f111e1123111e111d1123111d111c1123111c111b1123111b111a1123111a111911231119111811231118111711231117111611231116111511231115111411231114015702f81113112311131112112311121111112311111110112311100f11230f0e11230e0d11230d0c11230c0b11230b0a11230a091123090811230807112307105605112505db3c1120c00194112014a096112013a04013e204111f413081010b111fc855505056cb7f13cb7fcbffcbffcb3ff400c9103e02111a020111190101db015801ae206e953059f45930944133f413e201111501098306f45b301114a51113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf108e109d107b106a1059104810374614405301f702fc8efa31fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b01e021015a015f01fc81420501d74ac000f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2813f7c216eb3f2f46f26813f7d23c300f2f4813f7e5621f90001112124f91001112001f2f4561fd0d31f813f7f02821056524331ba12f2f4d3ff813f80025618ba12f2f4d3fff828800b015b01fcd721813f8101d3ff3013ba12f2f48307d721813f8201d30701c00312f2f4d33f30813f865112baf2f4f800111fd0810368d721d430d0d3ff30561183062259f40f6fa192306ddf206e92306d8e27d0fa40fa40d307d37fd3ffd33fd401d0d37fd33fd200301039103810371036103510346c196f09e2813f9d216eb3f2f4015c01fe6f295f05325620813f9e04c70513f2f41121a420a576705300112211231122112111231121112011231120111f1123111f111e1123111e111d1123111d111c1123111c111b1123111b111a1123111a111911231119111811231118111711231117111611231116111511231115111411231114111311231113111211231112015d02fc1111112311111110112311100f11230f0e11230e0d11230d0c11230c0b11230b0a11230a091123090811230807112307105605112505db3c1120c00194112014a096112013a04013e204111f413081010b111fc855505056cb7f13cb7fcbffcbffcb3ff400c9103e02111a0201111901206e953059f45930944133f413e201db015e019201111501098306f45b301114a51113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf108e109d107b106a1059104810374614405301f7034882107e1f5041bae3022182107e1f5033bae3020182107e1f5034bae3025f0f5f0af2c082016001bc01d701f431fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b01016101fc81420421d749c000f2f481420501d74ac000f2f4813a985612f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2814043216eb3f2f46f2681404623c300f2f48140495621f90001112124f91001112001f2f4561fd0810328d721d33f8140455323baf2f4d37f016201fed30730814065821005867d6082085e9ac023a8a05230bef2f481404f5382bef2f4f8005171a103a4777020112011221120111f1121111f111e1122111e111d1121111d111c1122111c111b1121111b111a1122111a111911211119111811221118111711211117111611221116111511211115111411221114111311211113016302fc1112112211121111112111111110112211100f11210f0e11220e0d11210d0c11220c0b11210b0a11220a0911210910680711210705112105103403112403562155205623db3c81010b547654547654c855505056cb7f13cb7fcbffcbffcb3ff400c902111602562201206e953059f45930944133f413e2f80f5622d0f82801db016401f8d30a31562202d31f01821056504232ba96d3ff01561aba9170e297d3ff02d3ff30ba923170e201d307029a20c001917f9320c002e29170e29702d30a018309ba920270e29801d3ff02d3ff30ba923070e2018100c8d7210195d30701c0019170e29520d749c0009170e29520d74ac0019170e201d430207020843f05016502f88e115625c101917f945625c208e293308011de93308017e2547111547000709b28562db99327c0009170e28ae85f04343424f9001118112511181117112411171116112311161115112211151114112111141113112011131112111f11121111111e11111110111d1110108f0e111b0e0d111a0d0c11190c0b11250b016601a7045e562ca55290ba2ad07054700d5612c0018f197326923074df25d749810310ba9525d74a01ba923070e2e30fe30e56270167017a017c019c01fe6c3101d307d307d3ffd3ffd3ffd4d4d40a9139963808d4300708e21117113311171116113211161115113111151114113011141113112f11131112112e11121111112d11111110112c11100f112b0f0e11320e0d11290d0c11280c0b11270b0a11260a09112509081124080711230706112206051121050411200403111f03016802f802111e0201111d01111c715623562356235623db3c8e63571c571c571f571f57205727572a80125627112b01112701111c111f111c1114111d11141113111c11131117111811171112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443302e30d017f016902ce1117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d011122011121561d561d5626db3c8e1b571a571a57205727572a80145627112b0111270111171118111701e30d016a017902f61118111c11181117111b11171116111a11161115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a0911190908111c0807111b0706111a060511190504111c0403111b0302111a0201111901111a7281046071db3c0177016b03fe8e3357185718571857181113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c553b70e11117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e718100f070db3ce3035617561756175617561701770184016c01fc56175617561756175617561756175617561756175617561756175617561756175617561756171117112f11171116112e11161115112d11151114112c11141113112b11131112112a11121111112911111110112811100f11270f0e11260e0d11250d0c11240c0b11230b0a11220a091121090811200807111f0706111e06016d03f605111d0504111c0403111b0302111a0201111901111856325632db3c1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a091118091118080706554056335633db3c1118111911180171016e016f0108db3caa02017202f41117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130011134011133db3c57105f0f6c811118111b11181117111a1117111611191116111511181115111411171114017001760106db3ca501710110db3ca67e807fa904017203f01118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a091119090811190807111907061119060511190504111904031119030211190201111901db3c1119db3c0173017401750016813fc701c002f2f48104b402f61116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011118813fc611185619db3c01111901f2f41118aa090193019400a601111901a01117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130017c1113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645404330db3c017701f68e76eda2edfb561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561b561bed41ed43ed44ed45ed47985b70db315f0f5f0aed67ed65ed64ed63ed6180187fed118e175132f9415024ba9201ba925b70e29201ba925b70e2db31ed41edf101f2ff801c7f01780004db38005e111bf900561eba971119f900561cba93571970e2971120f900561aba93572070e29c5727572a5626112a80131127df01fe34343b3e80112b1112112e111209112d091110112c1110112b0e112a0e0d11290d0c11280c011127010a11260a08112408071123070611220605112105041120041119111f111902111e021114111d11141113111c11130f111b0f0b111a0b031119031117111811171112111411120911130911101112111011110e11100e017b003010df10ce1d10ac0b108a107910681057104610351024102304fc7226923073df25d749810250ba9525d74a01ba923070e28f21313202d307d3078040d721d3ffd3ffd4d4099138963607d4300507e203c000e30fe30e112c112e112c1123112d1123112a112c112a1129112b11291128112a1128112711291127112611281126112411261124112211241122112111231121112011221120017d01970199019b01fe725366111a1134111a1119113311191118113211181117113111171116113011161115112f11151114112e11141113112d11131112112c11121111113111111110112a11100f11290f0e11280e0d11270d0c11260c0b11250b0a11240a0911230908112208071121070611200605111f0504111e0403111d03562059561f01017e0294db3c8e44571c571c571e5729572a8012562501112b011129111a111d111a1115111a11151114111511141113111411131112111311121111111211111110111111100f11100f550ee30d017f0188021a24c001e30204c002e3025f04700180018302fe34935f0370e102925b70e11118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a091119090811190807111907061119060511190504111904031119030211190201111901db3c0193018101fc8e3357181116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e70e11118c0021117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078018200141067105610451034413004fc1118111b11181117111a11171116111911161115111b11151114111a11141113111911131112111b11121111111a11111110111911100f111b0f0e111a0e0d11190d0c111b0c0b111a0b0a11190a09111b0908111a080711190706111b0605111a050411190403111b0302111a0201111901111adb3ce3031118e30211180192018401850186006a5718571857181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b700066571857181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b7001f48e3157181114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b70e111188e2f1114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b70e01114111711141113111611131112111511120187003a1111111411111110111311100f11120f0e11110e0d11100d10cf552b7f01f21117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111d561c5621db3c8e24111bf900561aba97111ef9005618ba93571e70e29e5729572a8013562501112b011129df8e12571b571e5729572a8014562501112b011129e2018903f61118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0211190171810240707fdb3ce3030195018a018b0066571857181115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d7001f85617561756175617561756175617561756175617561756175617561756175617561756175617561756175617561756171117112f11171116112e11161115112d11151114112c11141113112b11131112112a11121111112911111110112811100f11270f0e11260e0d11250d0c11240c0b11230b0a11220a09112109018c03fe0811200807111f0706111e0605111d0504111c0403111b0302111a020111190111185631db3c1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a09111809111808070655405632db3c11330190018d018e0108db3caa02019102d0db3c57105f0f6c811119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354140137fdb3c018f01950106db3ca501900110db3ca67e807fa904019102f61116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117011118813fca11185619db3c01111901f2f41118aa09019201940104db3c0193004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e200941116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443001ca8edeeda2edfb561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561ced41ed43ed44ed45ed47985b70db315f0f5f0aed67ed65ed64ed63ed6180187fed118aed41edf101f2ff801d7fdb380196007c5143f9415025bb955f0570db31e120c200955f0570db31e15203bb955f0470db31e112bb945b70db31e10196a93802c000b3923070e29370db31e07fdb3101f6363d5b3e80112b1114112e11141113112d11131112112c111201112b011110112a111011290e11280e0d11270d0c11260c0a11240a0911230908112208071121070611200605111f0504111e041118111d111802111c020f111b0f1115111a11151117111911170b11180b0311170311141115111411131114111301980048111211131112011112011110111110ef10de0c0d10ab109a10891078106710561045401301f634343b3e80112b1114112e11141113112d11131112112c111201112b011110112a111011290e11280e0d11270d0c11260c0a11240a0911230908112208071121070611200605111f0504111e041118111d11180b111c0b02111b021115111a11151117111911170f11180f03111703111411151114111311141113019a0046111211131112011112011110111110ef10de0c0d10ab109a1089107810671056040503007c111f1121111f111e1120111e111f111b111e111b111b111d111b111c1118111b1118111a11171119111711171118111711151114111311121111111055e002f89d03111e0302111b02571957195b8eb6562095561b5624ba9170e295561a5623ba9170e29556195622ba9170e28e10571957195719571b5723572680155623e30e1127011123e21124a41110112a11100f11290f0e11280e0d11270d0c11260c0b11250b0a11240a09112309081122080611200605111f0504111e04019d01a604fe572057205720572057250f11170f0e11160e0d11150d0c11140c0b11130b0a11120a091111090811100855770711240706111e0605111d0504111c0403111b0302111a0201111a01111b562c8208989680db3c01112201a011215627db3c01112901a011285627db3c01112001a00811260811191124111907112207111f7f019e01a301a401a501f456139131e15611c2009131e07021c100923020de1118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a04019f02fe0311190302111a0201111901111adb3c10455f0520822009184e72a000be8e373057181116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0822009184e72a00001a101111901a8822009184e72a000a0a5822009184e72a000a90420561ab901a001a2016881010b56100259f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e2206e8e8330db3ce06f2601a1000c70547000206d00dc8e35301116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de057191116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d0018c002948202bf20e082029810001cc0029582089eb100e08208419ce00080111c03111b0307111a0707111807061117060511160504111504011114010211130203111203111107111007106f105e104d4bc0103a09107810671056144350008603111d0302111c0201111b010a111a0a0a11190a111711181117111611171116111511161115011115011113111411130a11100a1f10ae107d10ac107b10790806553102f80a11240a0911230908112208071121070611200605111f0504111e0403111d030211220201111b015628015627015623562adb3c1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a01a801a9003ec882104250493101cb1f561601cbff5005cf1613cb3fcbffcb07cb07c9f90002fc09111809111808070655405618db3c56238e1b56198e112a8101012259f40c6fa1319480195724de9480185724e2df830c820807fff8561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a02561a0201aa01ab0006a9383f02fe564302563602563602564302564302564302563d02564802564c02564b02564602564502564902564802564402564802564802564402562c59ed41ed43ed44ed45ed47915bed67ed65ed64ed63ed61802d7fed118aed41edf101f2ff5c70f838018103f8a181039ca02bc0029702a402810098a0de1270f8381116112c111601ac01ae01fe112b830cf941301119112c11191118112b11181117112a11171116112911161115112811151114112711141113112611131112112511121111112411111110112311100f11220f0e11210e0d11200d0c111f0c0b111e0b0a111d0a09111c0908111b0807111a0706111906051118050411170403111603021115020411140401ad005409111309081112080411110409111009108f10be102d105c103b109a103910481047103610251024102302fe1115112b11151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a04031119030211180201111701112c8200c350112c5621db3c5623a801112d01a070f836830c820807fff87001af01b00018c0029482015f90e082015f9003fef83821a0562ea0561ea0111d70f83601111d01a0111ba77d8064a90401111b01a08136b070f836a08209c9c380a0561ec00094562201b9923070e2948016571ede561de302571c571c57215721572157215721572111121ea0011122a001111701a16d5615c002e300810101707ff82356230401111d01561a01561c01561501b101b501b601fc571657165716571757175719571957240d11180d0c11170c0b11160b0a11150a0911140908111308071112070611110605111005104f103e4dcb0a11230a0807469601112201821005867d6082085e9ac058a8a01118112011181117111f11171116111e11161115111d11151114111c11141113111b11131112111a111201b202fc1111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a11120a0911110908111008107f106e105d104c103b4a90011123011122db3c01112001111fa114a004111e413081010b111ec855505056cb7f13cb7fcbffcbffcb3ff400c9103e0211190201111801206e953059f45930944133f413e201b301b400d2228014a90824782259f40f6fa192306ddf206e92306d8e13d0d33fd307d307d33fd307d33f55506c166f06e2206eb38e346f266c225238ba8e27443045507807c855505056cb3f13cb07cb07cb3fcb07cb3fc9206e953059f45b30944133f417e2925f07e2925f05e201821114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf0e10ad109c108b107a10691058104710364540413001f7003630c8828873656e742076696120506c6174686f2e41707001cb97c901fc52921121c855805089ce16ca0014ca0012cb3fcb07cb07cbffcb7fcb3fc902111f020111190152e0206e953059f45a30944133f415e20a11170a091116090811150807111407061113060511120504111104031110034fe0109d0c11200c4a1908111c0807111b0706111a0605111905041118040311190302111802111f01b703fedb3cf80f56151115111811151114111711141113111611131112111811121111111711111110111611100f11180f0e11170e0d11160d0c11180c0b11170b0a11160a09111809081117080711160706111806051117050411160403111803021117020111160111187f11187111185622db3c08112408070611230605111f0501b801b901ba000601a4010012c8cbffc9f900a9389f01fe0411200403111d030211220201111e01111cc855808210a4f862d1500acb1f18cb3f16cb9f14cbff12cb07cb07cb7fceccf400c9041113040311190302111202011111014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000b11170b0a11160a091115090811140807111307061112060511110504111004103f01bb011a4edc4b18479a1036051034102301f701f431fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b0101bd01fe81420421d749c000f2f481420501d74ac000f2f4813a985612f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e28140d9216eb3f2f46f268140da23c300f2f48140dc5621f90001112124f91001112001f2f4111fd0d31f8140dd02821056504131ba12f2f4d3ff01be01fc8140de025617ba12f2f4fa408140ea02561fc70512f2f4d33f8140e3225622baf2f4d37f8140e72282085b8d80bef2f4fa408140ebf82813c70512f2f48140e62782085b8d80bef2f4f8001121a420a578705300112211231122112111231121112011231120111f1123111f111e1123111e111d1123111d111c1123111c01bf02fc111b1123111b111a1123111a1119112311191118112311181117112311171116112311161115112311151114112311141113112311131112112311121111112311111110112311100f11230f0e11230e0d11230d0c11230c0b11230b0a11230a091123090811230807112307105605112505db3c0582085b8d80a181010b01db01c001fc547154547659c855505056cb7f13cb7fcbffcbffcb3ff400c902111602562101206e953059f45930944133f413e2f80f1117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111d11111110111c11100f111b0f0e0d11190d0c11180c0b111d0b0a111c0a09111b09080711190701c104c80611180605111d0504111c0403111b0302011119011118db3c8eba57185718571857185718571857185718571857180d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e5593e15621d749c000e3035621d74ac00101c201f701e001c3010672db3c01df04ca8eba57185718571857185718571857185718571857180d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e5593e11121d43020d020d7498102e3bae303d74ac000e303d0fa40d3ffd33fd37fd30fd30730055619c70501f701e201e301c402fe8ebc5f055717571757175717571757175717571757170d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d5592e11117111b11171116111a11161115111911151114111811141113111b11131112111a11121111111911111110111811100f111b0f0e111a0e0d11190d0c11180c01f701c504fe0b111b0b0a111a0a091119090811180807111b0706111a06051119050411180403111b0302111a020111190111255623561c561b5628561cdb3c8ec057185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe5539e1db3c01c601f701cb01cc04f01118111c11181117111b11171116111a11161115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a0911190908111c0807111b0706111a060511190504111c0403111b0302111a0201111901111cdb3ce30f01c701c801c901ca000cd30a308309ba0008111ac3000006571a7000d2941118c30093571870e2945616c2009170e2941116c10393571670e2941118c00193571870e21114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a105910481037465013000c821006dac2c004f411255625be8ec057185718571857185718571857185718571857185718571857185718091117090811160807111507061114060511130504111204031111030211100250fe5539e1112482085b8d80a1561e21bee30356208218174876e800bee30311171118111711161117111611151116111511141115111401f701cd01cd01ce019c305717571757175717571757175717571757175717571757175718091117090811160807111507061114060511130504111204031111030211100250fe109d107c106b105a10491038475546160301f703ec1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130011124015623011123561cdb3c298101012259f40c6fa131e30201111e011122a1111f8218174876e800a104111f040302111e0201111b01111c81010b1121c801cf01d001d10030c882105650414901cb1f5003cf16cb3fcbffc9f900a9383f017e3057185718571857185718571857185718571857185718571857180a11170a091116090811150807111407061113060511120504111104031110034fed551a01f701fc55505056cb7f13cb7fcbffcbffcb3ff400c9102a01111c01561e01206e953059f45930944133f413e28101018218174876e800f823561f59c855205023cecb7fcb3fc91024561d01206e953059f45a30944133f415e21111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f102e01d203fe107d106c105b104a103908507605111a0504111904031119030211180201111901111adb3cf80f8210067f35407f718218174876e800f8280811200817820bef1480561a47680511230504111f040311200302112102011125011124c855a0db3cc956140403111c0302111a021116014343c8cf8580ca00cf8440ce01fa0201d301d501d602f01116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655408141321118db3c840fb901111901f2f4831fa011161117111611151116111511141115111411131114111301d401f4000c21ab1fa9380f005482104154481a500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd016e806acf40f400c901fb001110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e5566103645140201f701f2fa408308d718d41118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111b0101d801fe81420421d749c000f2f481420501d74ac000f2f4813a985612f2f42e81010b561a59f40b6fa192306ddf206e92306d8e13d0d37fd37fd3ffd3ffd33ff40455506c166f06e281413d216eb3f2f46f2681413e23c300f2f48141405621f90001112124f91001112001f2f4111fd0d31f81414102821056554e31ba12f2f4d3ff01d901fc814142025617ba12f2f4fa4081414c02561fc70512f2f4d33f814147225622baf2f4d37f81414b2282085b8d80bef2f4fa4081414df82813c70512f2f481414a2782085b8d80bef2f4f8001121a420a579705300112211231122112111231121112011231120111f1123111f111e1123111e111d1123111d111c1123111c01da02fc111b1123111b111a1123111a1119112311191118112311181117112311171116112311161115112311151114112311141113112311131112112311121111112311111110112311100f11230f0e11230e0d11230d0c11230c0b11230b0a11230a091123090811230807112307105605112505db3c0582085b8d80a181010b01db01dc006078258014a908f82310575e334670c855505056cb3f13cb07cb07cb3fcb07cb3fc912206e953059f45b30944133f417e201fc547154547659c855505056cb7f13cb7fcbffcbffcb3ff400c902111602562101206e953059f45930944133f413e2f80f1117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111d11111110111c11100f111b0f0e0d11190d0c11180c0b111d0b0a111c0a09111b09080711190701dd04c80611180605111d0504111c0403111b0302011119011118db3c8eba57185718571857185718571857185718571857180d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e5593e15621d749c000e3035621d74ac00101de01f701e001e1010674db3c01df0014561301a904a93800c001017457185718571857185718571857185718571857180d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e559301f704b88eba57185718571857185718571857185718571857180d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e5593e11121d43020d020d749810113bee303d74ac000e303d0fa40d307025615c70501f701e201e301e401765b5717571757175717571757175717571757170d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d559201f70176305717571757175717571757175717571757170d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d559201f702fc8ebb5b5717571757175717571757175717571757170d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d5592e11117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c01f701e503fc0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111801112256225619db3c8ec7571857185718571857185718571857185718571857180c11170c0b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b090750c550a35008064414e101e601f701e700d0eda2edfb21c104917f9321c210e2925b70e020d74922aa02bd925b70e020c702925b70e170935302b98e3801d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e2955f0370db31e101a4e83031c70004d85622db3c1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a0911180911180807065540db3c11235623bee303112282085b8d80a1561c21be01e801e901ea01eb006081410a21c203f2f481410b21c111f2f420c0049930822009184e72a000e0c005978218e8d4a51000e08218174876e800000c821022a15b4001785718571857185718571857185718571857185718571857180b11170b0a11160a091115090811140807111307061112060511110504111004103f4edc01f704fa8ebd30571757175717571757175717571757175717571757180b11170b0a11160a091115090811140807111307061112060511110504111004103f4edc5509e1561e5619bee30311225619db3c11181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111101f701ec01ed01ee017a30571757175717571757175717571757175717571757180b11170b0a11160a091115090811140807111307061112060511110504111004103f4edc550901f70020c88210c5cc7cd601cb1f01cf16c9f90003ea1110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130562202112201db3c288101012259f40c6fa131e30201111c011122a1111d561fa104111d040302111c0201111901111a81010b111fc855505056cb7f13cb7fcbffcbffcb3ff400c9102a01111a01561c0101ef01f001f10030c8821056554e4901cb1f5003cf16cb3fcbffc9f900a9383f019030571857185718571857185718571857185718571857180c11170c0b11160b0a11150a0911140908111308071112070611110605111005104f103e4d1b090750c550a3500806441401f702fc206e953059f45930944133f413e2810101f823561c01561c01c855205023cecb7fcb3fc91023561d01206e953059f45a30944133f415e21111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f1e107d106c105b104a1039481710260511180504111804130211180201db3cf80f01f201f502f01116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655408141961118db3c840fb901111901f2f4832fa011161117111611151116111511141115111411131114111301f301f4000621ab2f00301112111311121111111211111110111111100f11100f550e01f682102245cdc07f71f82805111f0504111d0482101fb5ad00561844350211200201112201111ec8557082104154481c5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc95616040311180302111a02111c014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0011121117111211111116111101f601421110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af554910341201f700ecc87f01ca0011181117111611151114111311121111111055e0011117011118ce01111501ce01111301ce1111c8ce01111001ce1ecb071cca001acbff08c8cbff17f40015f40013f40001c8f40012f40012f40002c8f40014f40014cb3f14cb3f14cb3f15cb3f15cb3f15cb3f15cccd12cdcdcdc9ed54193655d7');
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
    {"name":"CreateReceiveIntent","header":2115981365,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ClaimReceiveIntent","header":2115981366,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"CancelReceiveIntent","header":2115981367,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"WithdrawTonFromVaultBalance","header":2115981368,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"WithdrawAthFromVaultBalance","header":2115981369,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"SetProfileAvatarFromVaultBalance","header":2115981363,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"MintUsernameFromVaultBalance","header":2115981364,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"PublishBatchFromVaultBalance","header":2115981377,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"PublishBatchToHub","header":2767741649,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"protocol_fee_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"parts","type":{"kind":"simple","type":"cell","optional":false}},{"name":"marketing","type":{"kind":"simple","type":"cell","optional":true}}]},
    {"name":"CapsuleHubBatchAck","header":2270058353,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"first_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"batch_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PruneBatchPublish","header":1913380206,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"AnnounceSuccessorManifest","header":1398096717,"fields":[{"name":"successor_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"successor_vault","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TopUpStorageReserve","header":840283645,"fields":[]},
    {"name":"ProfileAvatarTonExcessRefund","header":1353060641,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PendingAthWithdrawal","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"refundable_ton_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingBatchPublish","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}},{"name":"refund_to_vault","type":{"kind":"simple","type":"bool","optional":false}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"refundable_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingProfileAvatarPayment","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingUsernameMintPayment","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ReceiveIntent","header":null,"fields":[{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"commitment","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"client_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"settlement_reserve_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ReceiptSlot","header":null,"fields":[{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"action","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"result","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"aux","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UserState","header":null,"fields":[{"name":"ton_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"ath_balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receipts","type":{"kind":"dict","key":"uint","keyFormat":8,"value":"ReceiptSlot","valueFormat":"ref"}}]},
    {"name":"VaultReceiveIntentView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"commitment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"client_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"settlement_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claimed","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"ton_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"auth_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultUserReceiptsView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"publish_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receipts","type":{"kind":"dict","key":"uint","keyFormat":8,"value":"ReceiptSlot","valueFormat":"ref"}}]},
    {"name":"VaultPendingAthWithdrawalView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultSuccessorView","header":null,"fields":[{"name":"announced","type":{"kind":"simple","type":"bool","optional":false}},{"name":"successor_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"successor_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"announced_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"VaultPendingBatchPublishView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_kind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"part_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"tombstone","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"VaultGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"profile_registry_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"username_registry_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"user_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"receive_intent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_profile_avatar_payment_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_username_mint_payment_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_publish_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_remaining_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_distributed_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_reward_per_message_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_total_allocation_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"Vault$Data","header":null,"fields":[{"name":"vault_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"profile_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"binding_flags","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"users","type":{"kind":"dict","key":"address","value":"UserState","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}},{"name":"receive_intents","type":{"kind":"dict","key":"uint","keyFormat":128,"value":"ReceiveIntent","valueFormat":"ref"}},{"name":"processed_ath_deposits","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_ath_withdrawals","type":{"kind":"dict","key":"int","value":"PendingAthWithdrawal","valueFormat":"ref"}},{"name":"pending_batch_publishes","type":{"kind":"dict","key":"int","value":"PendingBatchPublish","valueFormat":"ref"}},{"name":"pending_profile_avatar_payments","type":{"kind":"dict","key":"int","value":"PendingProfileAvatarPayment","valueFormat":"ref"}},{"name":"pending_username_mint_payments","type":{"kind":"dict","key":"int","value":"PendingUsernameMintPayment","valueFormat":"ref"}},{"name":"user_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"receive_intent_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"processed_ath_deposit_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_ath_withdrawal_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_publish_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"genesis_ext","type":{"kind":"simple","type":"cell","optional":false}}]},
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
    "RegisterMessagingKeys": 1383096026,
    "ReplaceMessagingKeys": 2312521915,
    "CreateReceiveIntent": 2115981365,
    "ClaimReceiveIntent": 2115981366,
    "CancelReceiveIntent": 2115981367,
    "WithdrawTonFromVaultBalance": 2115981368,
    "WithdrawAthFromVaultBalance": 2115981369,
    "SetProfileAvatarFromVaultBalance": 2115981363,
    "MintUsernameFromVaultBalance": 2115981364,
    "PublishBatchFromVaultBalance": 2115981377,
    "PublishBatchToHub": 2767741649,
    "CapsuleHubBatchAck": 2270058353,
    "PruneBatchPublish": 1913380206,
    "AnnounceSuccessorManifest": 1398096717,
    "TopUpStorageReserve": 840283645,
    "ProfileAvatarTonExcessRefund": 1353060641,
}

const Vault_getters: ABIGetter[] = [
    {"name":"get_user","methodId":91785,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultUserView","optional":false}},
    {"name":"get_user_receipts","methodId":79094,"arguments":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"VaultUserReceiptsView","optional":false}},
    {"name":"diag_forward_fee","methodId":127218,"arguments":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"diag_compute_fee","methodId":107587,"arguments":[{"name":"gas","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"diag_ext_hard_import","methodId":107995,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_key_record","methodId":104356,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultKeyRecordView","optional":false}},
    {"name":"get_receive_intent","methodId":118324,"arguments":[{"name":"intentId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultReceiveIntentView","optional":false}},
    {"name":"get_receive_intent_id","methodId":72648,"arguments":[{"name":"senderWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"recipientWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"asset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"clientNonce","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_receive_intent_commitment","methodId":104854,"arguments":[{"name":"intentId","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipientWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"secret32","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_batch_publish","methodId":94421,"arguments":[{"name":"bounceId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingBatchPublishView","optional":false}},
    {"name":"get_pending_ath_withdrawal","methodId":125951,"arguments":[{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_ath_withdrawal_id","methodId":123302,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_ath_withdrawal_for","methodId":104521,"arguments":[{"name":"ownerWallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"queryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"VaultPendingAthWithdrawalView","optional":false}},
    {"name":"get_successor","methodId":129519,"arguments":[],"returnType":{"kind":"simple","type":"VaultSuccessorView","optional":false}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"VaultGlobalView","optional":false}},
]

export const Vault_getterMapping: { [key: string]: string } = {
    'get_user': 'getGetUser',
    'get_user_receipts': 'getGetUserReceipts',
    'diag_forward_fee': 'getDiagForwardFee',
    'diag_compute_fee': 'getDiagComputeFee',
    'diag_ext_hard_import': 'getDiagExtHardImport',
    'get_key_record': 'getGetKeyRecord',
    'get_receive_intent': 'getGetReceiveIntent',
    'get_receive_intent_id': 'getGetReceiveIntentId',
    'get_receive_intent_commitment': 'getGetReceiveIntentCommitment',
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
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotification"}},
    {"receiver":"external","message":{"kind":"typed","type":"WithdrawTonFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"WithdrawAthFromVaultBalance"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ProfileAvatarTonExcessRefund"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RegisterMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"ReplaceMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"CreateReceiveIntent"}},
    {"receiver":"external","message":{"kind":"typed","type":"ClaimReceiveIntent"}},
    {"receiver":"external","message":{"kind":"typed","type":"CancelReceiveIntent"}},
    {"receiver":"external","message":{"kind":"typed","type":"PublishBatchFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"SetProfileAvatarFromVaultBalance"}},
    {"receiver":"external","message":{"kind":"typed","type":"MintUsernameFromVaultBalance"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CapsuleHubBatchAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PruneBatchPublish"}},
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
export const VAULT_RECEIVE_INTENT_STORAGE_ENDOWMENT = 5000000n;
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
export const RECEIVE_INTENT_ID_DOMAIN = 1380141380n;
export const RECEIVE_INTENT_COMMITMENT_DOMAIN = 1380139853n;
export const VAULT_RECEIVE_INTENT_SIGNING_DOMAIN = 1448231729n;
export const VAULT_WITHDRAW_TON_SIGNING_DOMAIN = 1448367921n;
export const VAULT_WITHDRAW_ATH_SIGNING_DOMAIN = 1448558897n;
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
export const UINT128_MOD = 340282366920938463463374607431768211456n;
export const UINT160_MOD = 1461501637330902918203684832716283019655932542976n;
export const UINT32_MAX = 4294967295n;
export const ATH_DEPOSIT_ID_DOMAIN = 1094996041n;
export const ATH_WITHDRAWAL_ID_DOMAIN = 1096239428n;
export const KEY_ID_DOMAIN = 1262836041n;
export const PUBLISH_KIND_PRIVATE = 1n;
export const PUBLISH_KIND_PUBLIC = 2n;
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
export const USERNAME_NOTIFY_VALUE = 532000000n;
export const USERNAME_MAX_LENGTH = 16n;
export const USERNAME_NAME_HASH_DOMAIN = 3318512854n;
export const VAULT_USERNAME_MINT_LOCAL_EXEC_RESERVE = 6000000n;
export const VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE = 575000000n;
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
export const ACT_CREATE_INTENT = 4n;
export const ACT_CLAIM_INTENT = 5n;
export const ACT_CANCEL_INTENT = 6n;
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
export const VAULT_BATCH_BASE_GAS = 50000n;
export const VAULT_PART_GAS_PRIVATE = 90000n;
export const VAULT_PART_GAS_PUBLIC = 90000n;
export const HUB_BATCH_BASE_GAS = 14000n;
export const HUB_PART_GAS_PRIVATE = 170000n;
export const HUB_PART_GAS_PUBLIC = 180000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | BindOfficialAthWallet | BindProfileRegistry | BindUsernameRegistry | SealGenesis | AnnounceSuccessorManifest | DepositTon | AthTransferNotification | ATHTransferAck | ATHTransferFailed | ProfileAvatarTonExcessRefund | TopUpStorageReserve | RegisterMessagingKeys | CapsuleHubBatchAck | PruneBatchPublish | null) {
        
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
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async sendExternal(provider: ContractProvider, message: WithdrawTonFromVaultBalance | WithdrawAthFromVaultBalance | ReplaceMessagingKeys | CreateReceiveIntent | ClaimReceiveIntent | CancelReceiveIntent | PublishBatchFromVaultBalance | SetProfileAvatarFromVaultBalance | MintUsernameFromVaultBalance) {
        
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreateReceiveIntent') {
            body = beginCell().store(storeCreateReceiveIntent(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ClaimReceiveIntent') {
            body = beginCell().store(storeClaimReceiveIntent(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CancelReceiveIntent') {
            body = beginCell().store(storeCancelReceiveIntent(message)).endCell();
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