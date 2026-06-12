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

export type InitializeUsernameItem = {
    $$type: 'InitializeUsernameItem';
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeInitializeUsernameItem(src: InitializeUsernameItem) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1431193934, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.username_len, 8);
        b_0.storeBuilder(src.username.asBuilder());
    };
}

export function loadInitializeUsernameItem(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1431193934) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0;
    return { $$type: 'InitializeUsernameItem' as const, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleInitializeUsernameItem(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'InitializeUsernameItem' as const, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleInitializeUsernameItem(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'InitializeUsernameItem' as const, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleInitializeUsernameItem(source: InitializeUsernameItem) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserInitializeUsernameItem(): DictionaryValue<InitializeUsernameItem> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeInitializeUsernameItem(src)).endCell());
        },
        parse: (src) => {
            return loadInitializeUsernameItem(src.loadRef().beginParse());
        }
    }
}

export type ResendDeployedAck = {
    $$type: 'ResendDeployedAck';
}

export function storeResendDeployedAck(src: ResendDeployedAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1671232620, 32);
    };
}

export function loadResendDeployedAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1671232620) { throw Error('Invalid prefix'); }
    return { $$type: 'ResendDeployedAck' as const };
}

export function loadTupleResendDeployedAck(source: TupleReader) {
    return { $$type: 'ResendDeployedAck' as const };
}

export function loadGetterTupleResendDeployedAck(source: TupleReader) {
    return { $$type: 'ResendDeployedAck' as const };
}

export function storeTupleResendDeployedAck(source: ResendDeployedAck) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserResendDeployedAck(): DictionaryValue<ResendDeployedAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeResendDeployedAck(src)).endCell());
        },
        parse: (src) => {
            return loadResendDeployedAck(src.loadRef().beginParse());
        }
    }
}

export type TopUpStorageReserve = {
    $$type: 'TopUpStorageReserve';
}

export function storeTopUpStorageReserve(src: TopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(665640843, 32);
    };
}

export function loadTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 665640843) { throw Error('Invalid prefix'); }
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

export type UsernameItemDeployedAck = {
    $$type: 'UsernameItemDeployedAck';
    name_hash: bigint;
    owner_wallet: Address;
}

export function storeUsernameItemDeployedAck(src: UsernameItemDeployedAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3148082201, 32);
        b_0.storeUint(src.name_hash, 256);
        b_0.storeAddress(src.owner_wallet);
    };
}

export function loadUsernameItemDeployedAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3148082201) { throw Error('Invalid prefix'); }
    const _name_hash = sc_0.loadUintBig(256);
    const _owner_wallet = sc_0.loadAddress();
    return { $$type: 'UsernameItemDeployedAck' as const, name_hash: _name_hash, owner_wallet: _owner_wallet };
}

export function loadTupleUsernameItemDeployedAck(source: TupleReader) {
    const _name_hash = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    return { $$type: 'UsernameItemDeployedAck' as const, name_hash: _name_hash, owner_wallet: _owner_wallet };
}

export function loadGetterTupleUsernameItemDeployedAck(source: TupleReader) {
    const _name_hash = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    return { $$type: 'UsernameItemDeployedAck' as const, name_hash: _name_hash, owner_wallet: _owner_wallet };
}

export function storeTupleUsernameItemDeployedAck(source: UsernameItemDeployedAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.name_hash);
    builder.writeAddress(source.owner_wallet);
    return builder.build();
}

export function dictValueParserUsernameItemDeployedAck(): DictionaryValue<UsernameItemDeployedAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameItemDeployedAck(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameItemDeployedAck(src.loadRef().beginParse());
        }
    }
}

export type NftTransfer = {
    $$type: 'NftTransfer';
    query_id: bigint;
    new_owner: Address;
    response_destination: Address;
    custom_payload: Cell | null;
    forward_amount: bigint;
    forward_payload: Slice;
}

export function storeNftTransfer(src: NftTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1607220500, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.new_owner);
        b_0.storeAddress(src.response_destination);
        if (src.custom_payload !== null && src.custom_payload !== undefined) { b_0.storeBit(true).storeRef(src.custom_payload); } else { b_0.storeBit(false); }
        b_0.storeCoins(src.forward_amount);
        b_0.storeBuilder(src.forward_payload.asBuilder());
    };
}

export function loadNftTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1607220500) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _new_owner = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    const _custom_payload = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _forward_amount = sc_0.loadCoins();
    const _forward_payload = sc_0;
    return { $$type: 'NftTransfer' as const, query_id: _query_id, new_owner: _new_owner, response_destination: _response_destination, custom_payload: _custom_payload, forward_amount: _forward_amount, forward_payload: _forward_payload };
}

export function loadTupleNftTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _new_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _custom_payload = source.readCellOpt();
    const _forward_amount = source.readBigNumber();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'NftTransfer' as const, query_id: _query_id, new_owner: _new_owner, response_destination: _response_destination, custom_payload: _custom_payload, forward_amount: _forward_amount, forward_payload: _forward_payload };
}

export function loadGetterTupleNftTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _new_owner = source.readAddress();
    const _response_destination = source.readAddress();
    const _custom_payload = source.readCellOpt();
    const _forward_amount = source.readBigNumber();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'NftTransfer' as const, query_id: _query_id, new_owner: _new_owner, response_destination: _response_destination, custom_payload: _custom_payload, forward_amount: _forward_amount, forward_payload: _forward_payload };
}

export function storeTupleNftTransfer(source: NftTransfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.new_owner);
    builder.writeAddress(source.response_destination);
    builder.writeCell(source.custom_payload);
    builder.writeNumber(source.forward_amount);
    builder.writeSlice(source.forward_payload.asCell());
    return builder.build();
}

export function dictValueParserNftTransfer(): DictionaryValue<NftTransfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNftTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadNftTransfer(src.loadRef().beginParse());
        }
    }
}

export type NftOwnershipAssigned = {
    $$type: 'NftOwnershipAssigned';
    query_id: bigint;
    previous_owner: Address;
    forward_payload: Slice;
}

export function storeNftOwnershipAssigned(src: NftOwnershipAssigned) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(85167505, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.previous_owner);
        b_0.storeBuilder(src.forward_payload.asBuilder());
    };
}

export function loadNftOwnershipAssigned(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 85167505) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _previous_owner = sc_0.loadAddress();
    const _forward_payload = sc_0;
    return { $$type: 'NftOwnershipAssigned' as const, query_id: _query_id, previous_owner: _previous_owner, forward_payload: _forward_payload };
}

export function loadTupleNftOwnershipAssigned(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _previous_owner = source.readAddress();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'NftOwnershipAssigned' as const, query_id: _query_id, previous_owner: _previous_owner, forward_payload: _forward_payload };
}

export function loadGetterTupleNftOwnershipAssigned(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _previous_owner = source.readAddress();
    const _forward_payload = source.readCell().asSlice();
    return { $$type: 'NftOwnershipAssigned' as const, query_id: _query_id, previous_owner: _previous_owner, forward_payload: _forward_payload };
}

export function storeTupleNftOwnershipAssigned(source: NftOwnershipAssigned) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.previous_owner);
    builder.writeSlice(source.forward_payload.asCell());
    return builder.build();
}

export function dictValueParserNftOwnershipAssigned(): DictionaryValue<NftOwnershipAssigned> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNftOwnershipAssigned(src)).endCell());
        },
        parse: (src) => {
            return loadNftOwnershipAssigned(src.loadRef().beginParse());
        }
    }
}

export type NftExcesses = {
    $$type: 'NftExcesses';
    query_id: bigint;
}

export function storeNftExcesses(src: NftExcesses) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3576854235, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadNftExcesses(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3576854235) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'NftExcesses' as const, query_id: _query_id };
}

export function loadTupleNftExcesses(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'NftExcesses' as const, query_id: _query_id };
}

export function loadGetterTupleNftExcesses(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'NftExcesses' as const, query_id: _query_id };
}

export function storeTupleNftExcesses(source: NftExcesses) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserNftExcesses(): DictionaryValue<NftExcesses> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNftExcesses(src)).endCell());
        },
        parse: (src) => {
            return loadNftExcesses(src.loadRef().beginParse());
        }
    }
}

export type UsernameNFTItemStateView = {
    $$type: 'UsernameNFTItemStateView';
    initialized: boolean;
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: bigint;
    username_len: bigint;
    username: Cell;
    tier: bigint;
}

export function storeUsernameNFTItemStateView(src: UsernameNFTItemStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.initialized);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.username_registry_address);
        b_0.storeInt(src.name_hash, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.username_len, 257);
        b_1.storeRef(src.username);
        b_1.storeInt(src.tier, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadUsernameNFTItemStateView(slice: Slice) {
    const sc_0 = slice;
    const _initialized = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _username_registry_address = sc_0.loadAddress();
    const _name_hash = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _username_len = sc_1.loadIntBig(257);
    const _username = sc_1.loadRef();
    const _tier = sc_1.loadIntBig(257);
    return { $$type: 'UsernameNFTItemStateView' as const, initialized: _initialized, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash, username_len: _username_len, username: _username, tier: _tier };
}

export function loadTupleUsernameNFTItemStateView(source: TupleReader) {
    const _initialized = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell();
    const _tier = source.readBigNumber();
    return { $$type: 'UsernameNFTItemStateView' as const, initialized: _initialized, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash, username_len: _username_len, username: _username, tier: _tier };
}

export function loadGetterTupleUsernameNFTItemStateView(source: TupleReader) {
    const _initialized = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell();
    const _tier = source.readBigNumber();
    return { $$type: 'UsernameNFTItemStateView' as const, initialized: _initialized, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash, username_len: _username_len, username: _username, tier: _tier };
}

export function storeTupleUsernameNFTItemStateView(source: UsernameNFTItemStateView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.initialized);
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.username_registry_address);
    builder.writeNumber(source.name_hash);
    builder.writeNumber(source.username_len);
    builder.writeCell(source.username);
    builder.writeNumber(source.tier);
    return builder.build();
}

export function dictValueParserUsernameNFTItemStateView(): DictionaryValue<UsernameNFTItemStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameNFTItemStateView(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameNFTItemStateView(src.loadRef().beginParse());
        }
    }
}

export type UsernameNftDataView = {
    $$type: 'UsernameNftDataView';
    initialized: boolean;
    index: bigint;
    collection_address: Address;
    owner_address: Address;
    individual_content: Cell;
}

export function storeUsernameNftDataView(src: UsernameNftDataView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.initialized);
        b_0.storeInt(src.index, 257);
        b_0.storeAddress(src.collection_address);
        b_0.storeAddress(src.owner_address);
        b_0.storeRef(src.individual_content);
    };
}

export function loadUsernameNftDataView(slice: Slice) {
    const sc_0 = slice;
    const _initialized = sc_0.loadBit();
    const _index = sc_0.loadIntBig(257);
    const _collection_address = sc_0.loadAddress();
    const _owner_address = sc_0.loadAddress();
    const _individual_content = sc_0.loadRef();
    return { $$type: 'UsernameNftDataView' as const, initialized: _initialized, index: _index, collection_address: _collection_address, owner_address: _owner_address, individual_content: _individual_content };
}

export function loadTupleUsernameNftDataView(source: TupleReader) {
    const _initialized = source.readBoolean();
    const _index = source.readBigNumber();
    const _collection_address = source.readAddress();
    const _owner_address = source.readAddress();
    const _individual_content = source.readCell();
    return { $$type: 'UsernameNftDataView' as const, initialized: _initialized, index: _index, collection_address: _collection_address, owner_address: _owner_address, individual_content: _individual_content };
}

export function loadGetterTupleUsernameNftDataView(source: TupleReader) {
    const _initialized = source.readBoolean();
    const _index = source.readBigNumber();
    const _collection_address = source.readAddress();
    const _owner_address = source.readAddress();
    const _individual_content = source.readCell();
    return { $$type: 'UsernameNftDataView' as const, initialized: _initialized, index: _index, collection_address: _collection_address, owner_address: _owner_address, individual_content: _individual_content };
}

export function storeTupleUsernameNftDataView(source: UsernameNftDataView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.initialized);
    builder.writeNumber(source.index);
    builder.writeAddress(source.collection_address);
    builder.writeAddress(source.owner_address);
    builder.writeCell(source.individual_content);
    return builder.build();
}

export function dictValueParserUsernameNftDataView(): DictionaryValue<UsernameNftDataView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameNftDataView(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameNftDataView(src.loadRef().beginParse());
        }
    }
}

export type UsernameNftOnchainContent = {
    $$type: 'UsernameNftOnchainContent';
    marker: bigint;
    metadata: Dictionary<bigint, Cell>;
}

export function storeUsernameNftOnchainContent(src: UsernameNftOnchainContent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.marker, 8);
        b_0.storeDict(src.metadata, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    };
}

export function loadUsernameNftOnchainContent(slice: Slice) {
    const sc_0 = slice;
    const _marker = sc_0.loadUintBig(8);
    const _metadata = Dictionary.load(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), sc_0);
    return { $$type: 'UsernameNftOnchainContent' as const, marker: _marker, metadata: _metadata };
}

export function loadTupleUsernameNftOnchainContent(source: TupleReader) {
    const _marker = source.readBigNumber();
    const _metadata = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), source.readCellOpt());
    return { $$type: 'UsernameNftOnchainContent' as const, marker: _marker, metadata: _metadata };
}

export function loadGetterTupleUsernameNftOnchainContent(source: TupleReader) {
    const _marker = source.readBigNumber();
    const _metadata = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), source.readCellOpt());
    return { $$type: 'UsernameNftOnchainContent' as const, marker: _marker, metadata: _metadata };
}

export function storeTupleUsernameNftOnchainContent(source: UsernameNftOnchainContent) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.marker);
    builder.writeCell(source.metadata.size > 0 ? beginCell().storeDictDirect(source.metadata, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell() : null);
    return builder.build();
}

export function dictValueParserUsernameNftOnchainContent(): DictionaryValue<UsernameNftOnchainContent> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameNftOnchainContent(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameNftOnchainContent(src.loadRef().beginParse());
        }
    }
}

export type UsernameNFTItem$Data = {
    $$type: 'UsernameNFTItem$Data';
    initialized: boolean;
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: bigint;
    username_len: bigint;
    username: Cell;
}

export function storeUsernameNFTItem$Data(src: UsernameNFTItem$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.initialized);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.username_registry_address);
        b_0.storeUint(src.name_hash, 256);
        b_0.storeUint(src.username_len, 8);
        b_0.storeRef(src.username);
    };
}

export function loadUsernameNFTItem$Data(slice: Slice) {
    const sc_0 = slice;
    const _initialized = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _username_registry_address = sc_0.loadAddress();
    const _name_hash = sc_0.loadUintBig(256);
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0.loadRef();
    return { $$type: 'UsernameNFTItem$Data' as const, initialized: _initialized, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash, username_len: _username_len, username: _username };
}

export function loadTupleUsernameNFTItem$Data(source: TupleReader) {
    const _initialized = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell();
    return { $$type: 'UsernameNFTItem$Data' as const, initialized: _initialized, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash, username_len: _username_len, username: _username };
}

export function loadGetterTupleUsernameNFTItem$Data(source: TupleReader) {
    const _initialized = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _username_len = source.readBigNumber();
    const _username = source.readCell();
    return { $$type: 'UsernameNFTItem$Data' as const, initialized: _initialized, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash, username_len: _username_len, username: _username };
}

export function storeTupleUsernameNFTItem$Data(source: UsernameNFTItem$Data) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.initialized);
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.username_registry_address);
    builder.writeNumber(source.name_hash);
    builder.writeNumber(source.username_len);
    builder.writeCell(source.username);
    return builder.build();
}

export function dictValueParserUsernameNFTItem$Data(): DictionaryValue<UsernameNFTItem$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameNFTItem$Data(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameNFTItem$Data(src.loadRef().beginParse());
        }
    }
}

 type UsernameNFTItem_init_args = {
    $$type: 'UsernameNFTItem_init_args';
    username_registry_address: Address;
    name_hash: bigint;
}

function initUsernameNFTItem_init_args(src: UsernameNFTItem_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.username_registry_address);
        b_0.storeInt(src.name_hash, 257);
    };
}

async function UsernameNFTItem_init(username_registry_address: Address, name_hash: bigint) {
    const __code = Cell.fromHex('b5ee9c72420201e800010000942d00000114ff00f4a413f4bcf2c80b00010201620002001003f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019fd200fa40fa40d3ffd307d455506c168e1cfa40810101d7005902d10181465121c300f2f4702270c8c910351024e207925f07e07026d74920c21f953106d31f07de218210554e494ebae302218210639cfc6cbae3022182105fcc3d14ba00030008000a04c05b05fa40d30781465af84226c705f2f481465b27b3f2f410465e32505781465c5197db3c1af2f481465d543968db3c1af2f481465e5198db3c355b335112ba16f2f481465ff8416f24135f0382083d0900bef2f47fc85005cf16c91045103412000c00040006000701deeda2edfb555127db3c936c2670e126d74928aa02bd936c2670e026c702936c2670e170935308b98e3907d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e296306c2670db31e107a4e8303705c700104610354430120005001420c20392c111923070e20020c88210c5cc7cd601cb1f01cf16c9f9000130db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed54000901905b3581466424f2f4814665f8416f24135f0382083d0900bef2f4814666f8416f24135f038209312d00bbf2f410355512db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed540009006a82082dc6c07f715357c8598210bba3ec195003cb1fcbffcec92755304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001b0e3023720821027acdf8bba8e1c303510355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e0c00006c12116b08e1f8146b3f2f010355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e05f06f2c082000b04fe5b05d33ffa40fa40f40431fa0081466e29f2f481466ff84229c705f2f410481037465981467051b8db3c1cf2f481467151b7db3c1cf2f481467226c2fff2f4814673f8416f24135f0382081e848028a08208989680a0bef2f45375c20095102a343730e30df8416f24135f0382081e84805005a08208989680a0820186a0a0000c000c000d000f000afa4430c000018a1045431371502c700cdb3c544b88c85520821005138d915004cb1f12cb3fcecec927104a4d1350cc441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00410805000e001820c700973070c8ca00c9d0e000a814be8e337080407008c8018210d53276db58cb1fcb3fc91046413018441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0013923334e2034445c87f01ca0055505056ca0013cececbffcb07ccc9ed54020120001100140177be9d6f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3633c001201285475435475435555db3c106c105b104a103948700013001a21c0049171e021c0059172e0730177bc7e7f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3632c00150130547523271059104810374698db3c104810374a90106a1059001603f655226d8307507682f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce8906db3c10394870206e953059f45b30944133f417e28307507682f0c9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd10406db3c10394870206e953059f45b30944133f417e283070017001800190026c87001cb0721d0cf1682102e61746801cb1fc90034c87001cb078268506c6174686f20757365726e616d6501cb77c903fc507682f06105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d06db3c10394870206e953059f45b30944133f417e28307507682f0d9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e406db3c10394870206e953059f45b30944133f417e27001c85902cb07f400c9001a011a01e70270c87001cb076f00016f8c6d6f8c8d04d9185d184e9a5b5859d94bdcdd99cade1b5b0b20db3cdb3c6f2201c993216eb396016f2259ccc9e83101e6001b040adb3c89db3c001c003601e6003d030c89db3c22c004001d01e6002101fe253343737667253230786d6c6e73253344253232687474702533412532462532467777772e77332e6f72672532463230303025324673766725323225323076696577426f7825334425323230253230302532303130323425323031303234253232253230726f6c65253344253232696d672532322533452533436465667325001e01fe33452533436c696e6561724772616469656e742532306964253344253232626725323225323078312533442532323025323225323079312533442532323025323225323078322533442532323125323225323079322533442532323125323225334525334373746f702532306f666673657425334425323230253232253230001f01fe73746f702d636f6c6f7225334425323225323330353038303725323225324625334525334373746f702532306f66667365742533442532322e353525323225323073746f702d636f6c6f7225334425323225323330373134313125323225324625334525334373746f702532306f6666736574253344253232312532322532002000743073746f702d636f6c6f722533442532322532333035303830612532322532462533452533432532466c696e6561724772616469656e74253345042c8f0389db3ce30e8bd253343253246646566732533458002201e6002801e101fe2533436c696e6561724772616469656e742532306964253344253232616363656e7425323225323078312533442532323025323225323079312533442532323025323225323078322533442532323125323225323079322533442532323125323225334525334373746f702532306f66667365742533442532323025323225002301fe323073746f702d636f6c6f7225334425323225323366666635623725323225323073746f702d6f7061636974792533442532323025323225324625334525334373746f702532306f66667365742533442532322e313825323225323073746f702d636f6c6f7225334425323225323366666635623725323225324625334525002401fe334373746f702532306f66667365742533442532322e353525323225323073746f702d636f6c6f7225334425323225323366346238346225323225324625334525334373746f702532306f66667365742533442532322e393225323225323073746f702d636f6c6f7225334425323225323366666630613025323225323073002501fe746f702d6f706163697479253344253232302532322532462533452533432532466c696e6561724772616469656e742533452533436c696e6561724772616469656e74253230696425334425323274696c65253232253230783125334425323230253232253230793125334425323230253232253230783225334425323231002601fe25323225323079322533442532323125323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f6c6f7225334425323225323366666636623825323225324625334525334373746f702532306f66667365742533442532322e353225323225323073746f702d636f6c6f722533002700d84425323225323366326261346225323225324625334525334373746f702532306f66667365742533442532323125323225323073746f702d636f6c6f722533442532322532333764353532302532322532462533452533432532466c696e6561724772616469656e74253345031422c0058f0389db3ce30d002901e6002f01fe2533436c696e6561724772616469656e742532306964253344253232616363656e7425323225323078312533442532323025323225323079312533442532323025323225323078322533442532323125323225323079322533442532323125323225334525334373746f702532306f66667365742533442532323025323225002a01fe323073746f702d636f6c6f7225334425323225323332376434616425323225323073746f702d6f7061636974792533442532323025323225324625334525334373746f702532306f66667365742533442532322e313825323225323073746f702d636f6c6f7225334425323225323332376434616425323225324625334525002b01fe334373746f702532306f66667365742533442532322e353525323225323073746f702d636f6c6f7225334425323225323331656134383725323225324625334525334373746f702532306f66667365742533442532322e393225323225323073746f702d636f6c6f7225334425323225323332376434616425323225323073002c01fe746f702d6f706163697479253344253232302532322532462533452533432532466c696e6561724772616469656e742533452533436c696e6561724772616469656e74253230696425334425323274696c65253232253230783125334425323230253232253230793125334425323230253232253230783225334425323231002d01fe25323225323079322533442532323125323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f6c6f7225334425323225323333396533626625323225324625334525334373746f702532306f66667365742533442532322e353525323225323073746f702d636f6c6f722533002e00d84425323225323332346239393525323225324625334525334373746f702532306f66667365742533442532323125323225323073746f702d636f6c6f722533442532322532333134353534362532322532462533452533432532466c696e6561724772616469656e74253345020689db3c003001e601fe2533436c696e6561724772616469656e742532306964253344253232616363656e7425323225323078312533442532323025323225323079312533442532323025323225323078322533442532323125323225323079322533442532323125323225334525334373746f702532306f66667365742533442532323025323225003101fe323073746f702d636f6c6f7225334425323225323365656634663825323225323073746f702d6f7061636974792533442532323025323225324625334525334373746f702532306f66667365742533442532322e313825323225323073746f702d636f6c6f7225334425323225323365656634663825323225324625334525003201fe334373746f702532306f66667365742533442532322e353525323225323073746f702d636f6c6f7225334425323225323361616238633325323225324625334525334373746f702532306f66667365742533442532322e393225323225323073746f702d636f6c6f7225334425323225323366666666666625323225323073003301fe746f702d6f706163697479253344253232302532322532462533452533432532466c696e6561724772616469656e742533452533436c696e6561724772616469656e74253230696425334425323274696c65253232253230783125334425323230253232253230793125334425323230253232253230783225334425323231003401fe25323225323079322533442532323125323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f6c6f7225334425323225323366346638666125323225324625334525334373746f702532306f66667365742533442532322e353225323225323073746f702d636f6c6f722533003500d84425323225323361656238633125323225324625334525334373746f702532306f66667365742533442532323125323225323073746f702d636f6c6f722533442532322532333635373237652532322532462533452533432532466c696e6561724772616469656e7425334501fe253343726563742532307769647468253344253232313032342532322532306865696768742533442532323130323425323225323066696c6c25334425323275726c28253233626729253232253246253345253343726563742532307825334425323235322532322532307925334425323235322532322532307769647468003701fe2533442532323932302532322532306865696768742533442532323932302532322532307278253344253232373825323225323066696c6c2533442532322532333037313030662532322532307374726f6b652533442532322532333162326132392532322532307374726f6b652d77696474682533442532323325323225003801fe324625334525334370617468253230642533442532324d313034253230323630513130342532303130382532303235362532303130384839323025323225323066696c6c2533442532326e6f6e652532322532307374726f6b6525334425323275726c28253233616363656e74292532322532307374726f6b652d77696474003901fe6825334425323231302532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f7061636974792533442532322e343225323225324625334525334370617468253230642533442532324d3130342532303739365131303425323039313625323032323425323039313648383838253232003a01fe25323066696c6c2533442532326e6f6e652532322532307374726f6b6525334425323275726c28253233616363656e74292532322532307374726f6b652d7769647468253344253232382532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f7061636974792533442532322e3234003b01fe25323225324625334525334372656374253230782533442532323131322532322532307925334425323231303825323225323077696474682533442532323130382532322532306865696768742533442532323130382532322532307278253344253232323825323225323066696c6c253344253232253233306231353134003c007a2532322532307374726f6b652533442532322532333166333433322532322532307374726f6b652d776964746825334425323232253232253246253345040889db3c89003e01e60045004c01fe253343737667253230782533442532323132342532322532307925334425323231323025323225323077696474682533442532323838253232253230686569676874253344253232383825323225323076696577426f7825334425323230253230302532303531322532303531322532322532306f766572666c6f77253344003f01fe25323276697369626c65253232253345253343672532307472616e73666f726d2533442532327472616e736c6174652830253230353132292532307363616c6528312532302d31292532322533452533437061746825323066696c6c25334425323225323332386437623125323225323066696c6c2d72756c652533442532004001fe326576656e6f6464253232253230642533442532324d3136372e352532303433322e312532304c3333302e352532303433322e312532304c3334362e352532303432392e392532304c3336342e352532303432342e382532304c3338302e352532303431372e372532304c3339332e352532303430392e362532304c343034004101fe2e352532303430312e302532304c3431362e302532303338392e352532304c3432352e382532303337362e352532304c3433352e392532303335382e352532304c3434312e372532303334332e352532304c3434352e392532303332352e352532304c3434362e392532303239362e352532304c3434352e38253230323835004201fe2e352532304c3434322e382532303237312e352532304c3433352e372532303235312e352532304c3432352e392532303233332e352532304c3431362e392532303232312e352532304c3430322e352532303230372e312532304c3338372e352532303139362e312532304c3336322e352532303138342e312532304c3334004301fe382e352532303138302e312532304c3333342e352532303137382e302532304c3232312e352532303137372e322532304c3232302e3525323037392e322532304c3133372e3525323037392e342532304c3133372e322532303133392e352532304c3136362e352532303134302e322532304c3136362e382532303137342e004400b0352532304c3133362e352532303137352e312532304c3133352e362532303137342e352532304c3133352e372532303136332e352532304c3133342e352532303136322e382532304c3130342e312532303136332e35253201fe304c3130342e352532303139322e372532304c3133342e352532303139322e392532304c3133352e352532303139332e352532304c3133352e342532303232302e352532304c3133362e322532303232312e352532304c3136362e382532303232322e352532304c3136362e352532303235332e302532304c3133352e3525004601fe32303235332e332532304c3133342e352532303233352e322532304c3130352e352532303233352e312532304c3130342e312532303233362e352532304c3130342e332532303236342e352532304c3133342e352532303236352e332532304c3133352e352532303239322e352532304c3139372e352532303239322e3725004701fe32304c3139382e342532303239332e352532304c3139382e302532303332332e352532304c3136362e382532303332342e352532304c3136372e332532303336342e352532304c3139382e342532303336352e352532304c3139382e332532303339342e352532304c3136362e392532303339352e352532304c3136362e37004801fe2532303433302e352532304c3136372e352532303433322e312532305a2532304d3130342e352532303430372e362532304c3133342e392532303430372e352532304c3133342e352532303337372e372532304c3130342e352532303337372e392532304c3130342e352532303430372e362532305a2532304d3232312e35004901fe2532303337322e332532304c3232312e352532303233372e322532304c3332322e352532303233372e312532304c3332392e352532303233382e312532304c3334322e352532303234322e312532304c3335322e352532303234372e342532304c3335392e352532303235322e382532304c3336392e362532303236332e35004a01fe2532304c3337372e302532303237352e352532304c3338312e352532303238382e352532304c3338332e312532303239382e352532304c3338322e372532303331362e352532304c3337392e372532303332372e352532304c3337342e382532303333382e352532304c3336382e392532303334372e352532304c3335382e004b00b0352532303335372e392532304c3334342e352532303336362e372532304c3333322e352532303337302e382532304c3332322e352532303337322e342532304c3232312e352532303337322e332532305a2532304d36352e0410db3c89db3c22c00401e6004d01e6005001fe352532303332342e332532304c39332e352532303332342e332532304c39332e392532303239342e352532304c36342e392532303239342e352532304c36342e362532303332322e352532304c36352e352532303332342e332532305a25323225324625334525334325324667253345253343253246737667253345253343004e01fe74657874253230782533442532323234342532322532307925334425323231353225323225323066696c6c253344253232253233643765626536253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323234382532322532004f007430666f6e742d776569676874253344253232383030253232253345506c6174686f253230757365726e616d657325334325324674657874253345040e8f0389db3ce30e005101e60053005901fe25334374657874253230782533442532323234342532322532307925334425323232303225323225323066696c6c253344253232253233663262613462253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232323825320052009432253230666f6e742d7765696768742533442532323830302532322532306c65747465722d73706163696e67253344253232342532322533454550494325334325324674657874253345031422c0058f0389db3ce30d005401e6005601fe25334374657874253230782533442532323234342532322532307925334425323232303225323225323066696c6c253344253232253233323764346164253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232323825320055009832253230666f6e742d7765696768742533442532323830302532322532306c65747465722d73706163696e6725334425323234253232253345434f4d4d4f4e25334325324674657874253345020689db3c005701e601fe25334374657874253230782533442532323234342532322532307925334425323232303225323225323066696c6c253344253232253233643965316536253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232323825320058009432253230666f6e742d7765696768742533442532323830302532322532306c65747465722d73706163696e67253344253232342532322533455241524525334325324674657874253345040a89db3cdb3c005a01e6005d010d01fe25334372656374253230782533442532323130342532322532307925334425323232373625323225323077696474682533442532323831362532322532306865696768742533442532323430382532322532307278253344253232353225323225323066696c6c253344253232253233303931323131253232253230737472005b01fe6f6b652533442532322532333162326432622532322532307374726f6b652d77696474682533442532323325323225324625334525334370617468253230642533442532324d313534253230333138483837302532322532307374726f6b6525334425323275726c28253233616363656e74292532322532307374726f6b65005c00982d776964746825334425323231322532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f7061636974792533442532322e333825323225324625334504c821d07024c0048ea69320c1048e9e01d30710795e35104810394890528adb3c07a41068105710461035443012e85be024c0058ea69320c1058e9e01d30710795e35104810394890528adb3c07a41068105710461035443012e85be024c109e3029320c108005e006a007a00af0422218f05318901db3ce121c001e30221c002005f010c0061006401fe25334372656374253230782533442532323136392532322532307925334425323233373825323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232333025323225323066696c6c25334425323275726c2825323374696c6529253232253246006001fe25334525334374657874253230782533442532323234352532322532307925334425323234373425323225323066696c6c253344253232253233303631303064253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232370079020a318901db3c0062010c01fe25334372656374253230782533442532323334372532322532307925334425323233373825323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232333025323225323066696c6c25334425323275726c2825323374696c6529253232253246006301fe25334525334374657874253230782533442532323432332532322532307925334425323234373425323225323066696c6c253344253232253233303631303064253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232370079031c8f05318901db3ce001c003e302300065010c006701fe25334372656374253230782533442532323532352532322532307925334425323233373825323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232333025323225323066696c6c25334425323275726c2825323374696c6529253232253246006601fe25334525334374657874253230782533442532323630312532322532307925334425323234373425323225323066696c6c253344253232253233303631303064253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323237007902088901db3c0068010c01fe25334372656374253230782533442532323730332532322532307925334425323233373825323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232333025323225323066696c6c25334425323275726c2825323374696c6529253232253246006901fe25334525334374657874253230782533442532323737392532322532307925334425323234373425323225323066696c6c253344253232253233303631303064253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323700790422218f05318901db3ce121c001e30221c002006b010c006d007001fe25334372656374253230782533442532323136322532322532307925334425323233393225323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232323625323225323066696c6c25334425323275726c2825323374696c6529253232253246006c01fe25334525334374657874253230782533442532323232382532322532307925334425323234373725323225323066696c6c253344253232253233303731303066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232360079020a318901db3c006e010c01fe25334372656374253230782533442532323330342532322532307925334425323233393225323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232323625323225323066696c6c25334425323275726c2825323374696c6529253232253246006f01fe25334525334374657874253230782533442532323337302532322532307925334425323234373725323225323066696c6c253344253232253233303731303066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323236007904208f05318901db3ce021c003e30201c0040071010c0073007601fe25334372656374253230782533442532323434362532322532307925334425323233393225323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232323625323225323066696c6c25334425323275726c2825323374696c6529253232253246007201fe25334525334374657874253230782533442532323531322532322532307925334425323234373725323225323066696c6c253344253232253233303731303066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232360079020a318901db3c0074010c01fe25334372656374253230782533442532323538382532322532307925334425323233393225323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232323625323225323066696c6c25334425323275726c2825323374696c6529253232253246007501fe25334525334374657874253230782533442532323635342532322532307925334425323234373725323225323066696c6c253344253232253233303731303066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323236007902108f048901db3ce0300077010c01fe25334372656374253230782533442532323733302532322532307925334425323233393225323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232323625323225323066696c6c25334425323275726c2825323374696c6529253232253246007801fe25334525334374657874253230782533442532323739362532322532307925334425323234373725323225323066696c6c253344253232253233303731303066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232360079007c36253232253230666f6e742d776569676874253344253232393030253232253230746578742d616e63686f722533442532326d6964646c65253232253345014e935304b98e9f01d30710795e35291059041039542a93db3c07a41068105710461035443012e85b007b032aeda2edfb22c006e30022c007e30002c008915be30d007c008200970428218f086c218901db3cdb31e121c001e30221c002009b010c007d007e02106c218901db3cdb31009e010c04268f086c218901db3cdb31e021c003e30221c00400a1010c007f008002106c218901db3cdb3100a4010c03208f086c218901db3cdb31e021c005e30200a7010c008102106c218901db3cdb3100aa010c0428218f086c218901db3cdb31e121c001e30221c0020083010c0085008801fe2533437265637425323078253344253232323038253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533008401fe4525334374657874253230782533442532323234382532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02106c218901db3cdb310086010c01fe2533437265637425323078253344253232323936253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533008701fe4525334374657874253230782533442532323333362532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04268f086c218901db3cdb31e021c003e30221c0040089010c008b008e01fe2533437265637425323078253344253232333834253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533008a01fe4525334374657874253230782533442532323432342532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02106c218901db3cdb31008c010c01fe2533437265637425323078253344253232343732253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533008d01fe4525334374657874253230782533442532323531322532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04268f086c218901db3cdb31e021c005e30221c006008f010c0091009401fe2533437265637425323078253344253232353630253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533009001fe4525334374657874253230782533442532323630302532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02106c218901db3cdb310092010c01fe2533437265637425323078253344253232363438253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533009301fe4525334374657874253230782533442532323638382532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02168f086c218901db3cdb31e00095010c01fe2533437265637425323078253344253232373336253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533009601fe4525334374657874253230782533442532323737362532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b0426208f07308901db3cdb31e120c001e30220c0020098010c009a009d01fe2533437265637425323078253344253232313634253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533009901fe4525334374657874253230782533442532323230342532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020e308901db3cdb31009b010c01fe2533437265637425323078253344253232323532253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533009c01fe4525334374657874253230782533442532323239322532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04248f07308901db3cdb31e020c003e30220c004009e010c00a000a301fe2533437265637425323078253344253232333430253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533009f01fe4525334374657874253230782533442532323338302532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020e308901db3cdb3100a1010c01fe2533437265637425323078253344253232343238253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300a201fe4525334374657874253230782533442532323436382532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04248f07308901db3cdb31e020c005e30220c00600a4010c00a600a901fe2533437265637425323078253344253232353136253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300a501fe4525334374657874253230782533442532323535362532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020e308901db3cdb3100a7010c01fe2533437265637425323078253344253232363034253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300a801fe4525334374657874253230782533442532323634342532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b031e8f07308901db3cdb31e0c007e3023000aa010c00ac01fe2533437265637425323078253344253232363932253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300ab01fe4525334374657874253230782533442532323733322532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020c8901db3cdb3100ad010c01fe2533437265637425323078253344253232373830253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300ae01fe4525334374657874253230782533442532323832302532322532307925334425323234373225323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02628ae8307024a6f8925cb98ea202d307107a10691058104a103948a054699cdb3c07a4106910581047103645044313e85f0300b000c9013c01d30710795e35104810394890528adb3c07a4106810571046103544301200b10422218f05318901db3ce121c001e30221c00200b2010c00b400b701fe2533437265637425323078253344253232313634253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300b301fe4525334374657874253230782533442532323230342532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020a318901db3c00b5010c01fe2533437265637425323078253344253232323532253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300b601fe4525334374657874253230782533442532323239322532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04208f05318901db3ce021c003e30221c00400b8010c00ba00bd01fe2533437265637425323078253344253232333430253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300b901fe4525334374657874253230782533442532323338302532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020a318901db3c00bb010c01fe2533437265637425323078253344253232343238253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300bc01fe4525334374657874253230782533442532323436382532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04208f05318901db3ce021c005e30221c00600be010c00c000c301fe2533437265637425323078253344253232353136253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300bf01fe4525334374657874253230782533442532323535362532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020a318901db3c00c1010c01fe2533437265637425323078253344253232363034253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300c201fe4525334374657874253230782533442532323634342532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b031c8f05318901db3ce001c007e3023000c4010c00c601fe2533437265637425323078253344253232363932253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300c501fe4525334374657874253230782533442532323733322532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02088901db3c00c7010c01fe2533437265637425323078253344253232373830253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300c801fe4525334374657874253230782533442532323832302532322532307925334425323234323625323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b043ceda2edfb22c0018f0c218f086c218901db3cdb31e1de22c002e30022c00300e8010c00ca00cb0322218f086c218901db3cdb31e121c001e30200fd010c00db041ee30022c004e30022c005e30022c00600cc00ce00d200d70428218f086c218901db3cdb31e121c001e30221c00200e5010c00e700cd02168f086c218901db3cdb31e000eb010c0428218f086c218901db3cdb31e121c001e30221c00200fa010c00cf00d002106c218901db3cdb3100fd010c03208f086c218901db3cdb31e021c003e3020100010c00d102106c218901db3cdb310103010c0428218f086c218901db3cdb31e121c001e30221c00200e2010c00d300d402106c218901db3cdb3100e5010c04268f086c218901db3cdb31e021c003e30221c00400e8010c00d500d602106c218901db3cdb3100eb010c02168f086c218901db3cdb31e000ee010c031ce30022c007e30002c008915be30d00d800de00f30428218f086c218901db3cdb31e121c001e30221c00200f7010c00d900da02106c218901db3cdb3100fa010c04268f086c218901db3cdb31e021c003e30221c00400fd010c00db00dc02106c218901db3cdb310100010c03208f086c218901db3cdb31e021c005e3020103010c00dd02106c218901db3cdb310106010c0428218f086c218901db3cdb31e121c001e30221c00200df010c00e100e401fe2533437265637425323078253344253232323038253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300e001fe4525334374657874253230782533442532323234382532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02106c218901db3cdb3100e2010c01fe2533437265637425323078253344253232323936253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300e301fe4525334374657874253230782533442532323333362532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04268f086c218901db3cdb31e021c003e30221c00400e5010c00e700ea01fe2533437265637425323078253344253232333834253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300e601fe4525334374657874253230782533442532323432342532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02106c218901db3cdb3100e8010c01fe2533437265637425323078253344253232343732253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300e901fe4525334374657874253230782533442532323531322532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04268f086c218901db3cdb31e021c005e30221c00600eb010c00ed00f001fe2533437265637425323078253344253232353630253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300ec01fe4525334374657874253230782533442532323630302532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02106c218901db3cdb3100ee010c01fe2533437265637425323078253344253232363438253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300ef01fe4525334374657874253230782533442532323638382532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b02168f086c218901db3cdb31e000f1010c01fe2533437265637425323078253344253232373336253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300f201fe4525334374657874253230782533442532323737362532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b0426208f07308901db3cdb31e120c001e30220c00200f4010c00f600f901fe2533437265637425323078253344253232313634253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300f501fe4525334374657874253230782533442532323230342532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020e308901db3cdb3100f7010c01fe2533437265637425323078253344253232323532253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300f801fe4525334374657874253230782533442532323239322532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04248f07308901db3cdb31e020c003e30220c00400fa010c00fc00ff01fe2533437265637425323078253344253232333430253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300fb01fe4525334374657874253230782533442532323338302532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020e308901db3cdb3100fd010c01fe2533437265637425323078253344253232343238253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c6529253232253246253300fe01fe4525334374657874253230782533442532323436382532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b04248f07308901db3cdb31e020c005e30220c0060100010c0102010501fe2533437265637425323078253344253232353136253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533010101fe4525334374657874253230782533442532323535362532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020e308901db3cdb310103010c01fe2533437265637425323078253344253232363034253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533010401fe4525334374657874253230782533442532323634342532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b031e8f07308901db3cdb31e0c007e302300106010c010801fe2533437265637425323078253344253232363932253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533010701fe4525334374657874253230782533442532323733322532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b020c8901db3cdb310109010c01fe2533437265637425323078253344253232373830253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313625323225323066696c6c25334425323275726c2825323374696c65292532322532462533010a01fe4525334374657874253230782533442532323832302532322532307925334425323235313825323225323066696c6c253344253232253233303431323066253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343225010b00783232253230666f6e742d776569676874253344253232393030253232253230746578742d616e63686f722533442532326d6964646c65253232253345032e59db3c01db3c8bd253343253246746578742533458db3c01e601d401e6040a89db3cdb3c010e01e60113011401fe25334374657874253230782533442532323531322532322532307925334425323236303425323225323066696c6c253344253232253233646666386632253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323235382532010f01fe32253230666f6e742d776569676874253344253232393030253232253230746578742d616e63686f722533442532326d6964646c652532322533452e6174682533432532467465787425334525334370617468253230642533442532324d313736253230363234483834382532322532307374726f6b652533442532327572011001fe6c28253233616363656e74292532322532307374726f6b652d7769647468253344253232362532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f7061636974792533442532322e353825323225324625334525334374657874253230782533442532323531322532322532307925011101fe334425323237353425323225323066696c6c253344253232253233643765626536253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323434253232253230666f6e742d776569676874253344253232383030253232250112003e3230746578742d616e63686f722533442532326d6964646c652532322533450104db3c01d3020689db3c011501e601fe2e6174682533432532467465787425334525334374657874253230782533442532323531322532322532307925334425323238323625323225323066696c6c253344253232253233363838303761253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f011601fe6e742d73697a652533442532323236253232253230666f6e742d7765696768742533442532323730302532322532306c65747465722d73706163696e6725334425323233253232253230746578742d616e63686f722533442532326d6964646c65253232253345504c4154484f253230555345524e414d4525334325324674011701fe65787425334525334374657874253230782533442532323531322532322532307925334425323238393025323225323066696c6c253344253232253233326637303632253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425011801fe32323232253232253230666f6e742d7765696768742533442532323730302532322532306c65747465722d73706163696e6725334425323234253232253230746578742d616e63686f722533442532326d6964646c652532322533454f4e2d434841494e25323053564725334325324674657874253345253343253246737601190008672533450140c87001cb076f00016f8c6d6f8cdb3c6f2201c993216eb396016f2259ccc9e831011b040adb3c89db3c011c012f01e60134030c89db3c22c004011d01e6012001fe3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130323420313032342220726f6c653d22696d67223e3c646566733e3c6c696e6561724772616469656e742069643d226267222078313d2230222079313d2230222078323d2231222079011e01fe323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223303530383037222f3e3c73746f70206f66667365743d222e3535222073746f702d636f6c6f723d2223303731343131222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223303530383061222f3e3c2f011f001e6c696e6561724772616469656e743e04208f0389db3ce30e8b73c2f646566733e8012101e6012501e101fe3c6c696e6561724772616469656e742069643d22616363656e74222078313d2230222079313d2230222078323d2231222079323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223666666356237222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e012201fe3138222073746f702d636f6c6f723d2223666666356237222f3e3c73746f70206f66667365743d222e3535222073746f702d636f6c6f723d2223663462383462222f3e3c73746f70206f66667365743d222e3932222073746f702d636f6c6f723d2223666666306130222073746f702d6f7061636974793d2230222f3e3c2f012301fe6c696e6561724772616469656e743e3c6c696e6561724772616469656e742069643d2274696c65222078313d2230222079313d2230222078323d2231222079323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223666666366238222f3e3c73746f70206f66667365743d222e353222200124009c73746f702d636f6c6f723d2223663262613462222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223376435353230222f3e3c2f6c696e6561724772616469656e743e031422c0058f0389db3ce30d012601e6012a01fe3c6c696e6561724772616469656e742069643d22616363656e74222078313d2230222079313d2230222078323d2231222079323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223323764346164222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e012701fe3138222073746f702d636f6c6f723d2223323764346164222f3e3c73746f70206f66667365743d222e3535222073746f702d636f6c6f723d2223316561343837222f3e3c73746f70206f66667365743d222e3932222073746f702d636f6c6f723d2223323764346164222073746f702d6f7061636974793d2230222f3e3c2f012801fe6c696e6561724772616469656e743e3c6c696e6561724772616469656e742069643d2274696c65222078313d2230222079313d2230222078323d2231222079323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223333965336266222f3e3c73746f70206f66667365743d222e353522200129009c73746f702d636f6c6f723d2223323462393935222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223313435353436222f3e3c2f6c696e6561724772616469656e743e020689db3c012b01e601fe3c6c696e6561724772616469656e742069643d22616363656e74222078313d2230222079313d2230222078323d2231222079323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223656566346638222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e012c01fe3138222073746f702d636f6c6f723d2223656566346638222f3e3c73746f70206f66667365743d222e3535222073746f702d636f6c6f723d2223616162386333222f3e3c73746f70206f66667365743d222e3932222073746f702d636f6c6f723d2223666666666666222073746f702d6f7061636974793d2230222f3e3c2f012d01fe6c696e6561724772616469656e743e3c6c696e6561724772616469656e742069643d2274696c65222078313d2230222079313d2230222078323d2231222079323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223663466386661222f3e3c73746f70206f66667365743d222e35322220012e009c73746f702d636f6c6f723d2223616562386331222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223363537323765222f3e3c2f6c696e6561724772616469656e743e01fe3c726563742077696474683d223130323422206865696768743d2231303234222066696c6c3d2275726c2823626729222f3e3c7265637420783d2235322220793d223532222077696474683d2239323022206865696768743d22393230222072783d223738222066696c6c3d222330373130306622207374726f6b653d2223013001fe31623261323922207374726f6b652d77696474683d2233222f3e3c7061746820643d224d313034203236305131303420313038203235362031303848393230222066696c6c3d226e6f6e6522207374726f6b653d2275726c2823616363656e742922207374726f6b652d77696474683d22313022207374726f6b652d6c696e013101fe656361703d22726f756e6422206f7061636974793d222e3432222f3e3c7061746820643d224d313034203739365131303420393136203232342039313648383838222066696c6c3d226e6f6e6522207374726f6b653d2275726c2823616363656e742922207374726f6b652d77696474683d223822207374726f6b652d6c69013201fe6e656361703d22726f756e6422206f7061636974793d222e3234222f3e3c7265637420783d223131322220793d22313038222077696474683d2231303822206865696768743d22313038222072783d223238222066696c6c3d222330623135313422207374726f6b653d222331663334333222207374726f6b652d776964740133000e683d2232222f3e040889db3c89013501e6013c014101fe3c73766720783d223132342220793d22313230222077696474683d22383822206865696768743d223838222076696577426f783d22302030203531322035313222206f766572666c6f773d2276697369626c65223e3c67207472616e73666f726d3d227472616e736c61746528302035313229207363616c652831202d3129013601fe223e3c706174682066696c6c3d2223323864376231222066696c6c2d72756c653d226576656e6f64642220643d224d3136372e35203433322e31204c3333302e35203433322e31204c3334362e35203432392e39204c3336342e35203432342e38204c3338302e35203431372e37204c3339332e35203430392e36204c3430013701fe342e35203430312e30204c3431362e30203338392e35204c3432352e38203337362e35204c3433352e39203335382e35204c3434312e37203334332e35204c3434352e39203332352e35204c3434362e39203239362e35204c3434352e38203238352e35204c3434322e38203237312e35204c3433352e37203235312e3520013801fe4c3432352e39203233332e35204c3431362e39203232312e35204c3430322e35203230372e31204c3338372e35203139362e31204c3336322e35203138342e31204c3334382e35203138302e31204c3333342e35203137382e30204c3232312e35203137372e32204c3232302e352037392e32204c3133372e352037392e34013901fe204c3133372e32203133392e35204c3136362e35203134302e32204c3136362e38203137342e35204c3133362e35203137352e31204c3133352e36203137342e35204c3133352e37203136332e35204c3133342e35203136322e38204c3130342e31203136332e35204c3130342e35203139322e37204c3133342e35203139013a01fe322e39204c3133352e35203139332e35204c3133352e34203232302e35204c3133362e32203232312e35204c3136362e38203232322e35204c3136362e35203235332e30204c3133352e35203235332e33204c3133342e35203233352e32204c3130352e35203233352e31204c3130342e31203233362e35204c3130342e33013b00b0203236342e35204c3133342e35203236352e33204c3133352e35203239322e35204c3139372e35203239322e37204c3139382e34203239332e35204c3139382e30203332332e35204c3136362e38203332342e35204c313601fe372e33203336342e35204c3139382e34203336352e35204c3139382e33203339342e35204c3136362e39203339352e35204c3136362e37203433302e35204c3136372e35203433322e31205a204d3130342e35203430372e36204c3133342e39203430372e35204c3133342e35203337372e37204c3130342e35203337372e013d01fe39204c3130342e35203430372e36205a204d3232312e35203337322e33204c3232312e35203233372e32204c3332322e35203233372e31204c3332392e35203233382e31204c3334322e35203234322e31204c3335322e35203234372e34204c3335392e35203235322e38204c3336392e36203236332e35204c3337372e30013e01fe203237352e35204c3338312e35203238382e35204c3338332e31203239382e35204c3338322e37203331362e35204c3337392e37203332372e35204c3337342e38203333382e35204c3336382e39203334372e35204c3335382e35203335372e39204c3334342e35203336362e37204c3333322e35203337302e38204c3332013f01fe322e35203337322e34204c3232312e35203337322e33205a204d36352e35203332342e33204c39332e35203332342e33204c39332e39203239342e35204c36342e39203239342e35204c36342e36203332322e35204c36352e35203332342e33205a222f3e3c2f673e3c2f7376673e3c7465787420783d223234342220793d014000d822313532222066696c6c3d22236437656265362220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2234382220666f6e742d7765696768743d22383030223e506c6174686f20757365726e616d65733c2f746578743e040edb3c22c004e30f01e601420144014a020689db3c014301e601fe3c7465787420783d223234342220793d22323032222066696c6c3d22236632626134622220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232382220666f6e742d7765696768743d2238303022206c65747465722d73706163696e673d2234223e455049433c2f740149031422c0058f0389db3ce30d014501e6014701fe3c7465787420783d223234342220793d22323032222066696c6c3d22233237643461642220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232382220666f6e742d7765696768743d2238303022206c65747465722d73706163696e673d2234223e434f4d4d4f4e3c0146000c2f746578743e020689db3c014801e601fe3c7465787420783d223234342220793d22323032222066696c6c3d22236439653165362220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232382220666f6e742d7765696768743d2238303022206c65747465722d73706163696e673d2234223e524152453c2f74014900086578743e040a89db3cdb3c014b01e6014d01cf01fe3c7265637420783d223130342220793d22323736222077696474683d2238313622206865696768743d22343038222072783d223532222066696c6c3d222330393132313122207374726f6b653d222331623264326222207374726f6b652d77696474683d2233222f3e3c7061746820643d224d313534203331384838373022014c009e207374726f6b653d2275726c2823616363656e742922207374726f6b652d77696474683d22313222207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3338222f3e04c821d07024c0048ea69320c1048e9e01d30710795e35104810394890528adb3c07a41068105710461035443012e85be024c0058ea69320c1058e9e01d30710795e35104810394890528adb3c07a41068105710461035443012e85be024c109e3029320c108014e0157016201880422218f05318901db3ce121c001e30221c002014f01ce0150015201fe3c7265637420783d223136392220793d22333738222077696474683d2231353222206865696768743d22313532222072783d223330222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223234352220793d22343734222066696c6c3d22233036313030642220666f6e742d66616d696c793d224172690156020a318901db3c015101ce01fe3c7265637420783d223334372220793d22333738222077696474683d2231353222206865696768743d22313532222072783d223330222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223432332220793d22343734222066696c6c3d22233036313030642220666f6e742d66616d696c793d224172690156031c8f05318901db3ce001c003e30230015301ce015401fe3c7265637420783d223532352220793d22333738222077696474683d2231353222206865696768743d22313532222072783d223330222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223630312220793d22343734222066696c6c3d22233036313030642220666f6e742d66616d696c793d22417269015602088901db3c015501ce01fe3c7265637420783d223730332220793d22333738222077696474683d2231353222206865696768743d22313532222072783d223330222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223737392220793d22343734222066696c6c3d22233036313030642220666f6e742d66616d696c793d224172690156008a616c2c73616e732d73657269662220666f6e742d73697a653d2237362220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e0422218f05318901db3ce121c001e30221c002015801ce0159015b01fe3c7265637420783d223136322220793d22333932222077696474683d2231333222206865696768743d22313332222072783d223236222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223232382220793d22343737222066696c6c3d22233037313030662220666f6e742d66616d696c793d224172690161020a318901db3c015a01ce01fe3c7265637420783d223330342220793d22333932222077696474683d2231333222206865696768743d22313332222072783d223236222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223337302220793d22343737222066696c6c3d22233037313030662220666f6e742d66616d696c793d22417269016104208f05318901db3ce021c003e30201c004015c01ce015d015f01fe3c7265637420783d223434362220793d22333932222077696474683d2231333222206865696768743d22313332222072783d223236222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223531322220793d22343737222066696c6c3d22233037313030662220666f6e742d66616d696c793d224172690161020a318901db3c015e01ce01fe3c7265637420783d223538382220793d22333932222077696474683d2231333222206865696768743d22313332222072783d223236222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223635342220793d22343737222066696c6c3d22233037313030662220666f6e742d66616d696c793d22417269016102108f048901db3ce030016001ce01fe3c7265637420783d223733302220793d22333932222077696474683d2231333222206865696768743d22313332222072783d223236222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223739362220793d22343737222066696c6c3d22233037313030662220666f6e742d66616d696c793d224172690161008a616c2c73616e732d73657269662220666f6e742d73697a653d2236362220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e014e935304b98e9f01d30710795e35291059041039542a93db3c07a41068105710461035443012e85b0163032aeda2edfb22c006e30022c007e30002c008915be30d0164016a01780428218f086c218901db3cdb31e121c001e30221c002017b01ce0165016602106c218901db3cdb31017d01ce04268f086c218901db3cdb31e021c003e30221c004017f01ce0167016802106c218901db3cdb31018101ce03208f086c218901db3cdb31e021c005e302018301ce016902106c218901db3cdb31018501ce0428218f086c218901db3cdb31e121c001e30221c002016b01ce016c016e01fe3c7265637420783d223230382220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223234382220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02106c218901db3cdb31016d01ce01fe3c7265637420783d223239362220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223333362220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04268f086c218901db3cdb31e021c003e30221c004016f01ce0170017201fe3c7265637420783d223338342220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223432342220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02106c218901db3cdb31017101ce01fe3c7265637420783d223437322220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223531322220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04268f086c218901db3cdb31e021c005e30221c006017301ce0174017601fe3c7265637420783d223536302220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223630302220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02106c218901db3cdb31017501ce01fe3c7265637420783d223634382220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223638382220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02168f086c218901db3cdb31e0017701ce01fe3c7265637420783d223733362220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223737362220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd0426208f07308901db3cdb31e120c001e30220c002017901ce017a017c01fe3c7265637420783d223136342220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223230342220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020e308901db3cdb31017b01ce01fe3c7265637420783d223235322220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223239322220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04248f07308901db3cdb31e020c003e30220c004017d01ce017e018001fe3c7265637420783d223334302220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223338302220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020e308901db3cdb31017f01ce01fe3c7265637420783d223432382220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223436382220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04248f07308901db3cdb31e020c005e30220c006018101ce0182018401fe3c7265637420783d223531362220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223535362220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020e308901db3cdb31018301ce01fe3c7265637420783d223630342220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223634342220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd031e8f07308901db3cdb31e0c007e30230018501ce018601fe3c7265637420783d223639322220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223733322220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020c8901db3cdb31018701ce01fe3c7265637420783d223738302220793d22343138222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223832302220793d22343732222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02628ae8307024a6f8925cb98ea202d307107a10691058104a103948a054699cdb3c07a4106910581047103645044313e85f030189019a013c01d30710795e35104810394890528adb3c07a41068105710461035443012018a0422218f05318901db3ce121c001e30221c002018b01ce018c018e01fe3c7265637420783d223136342220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223230342220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020a318901db3c018d01ce01fe3c7265637420783d223235322220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223239322220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04208f05318901db3ce021c003e30221c004018f01ce0190019201fe3c7265637420783d223334302220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223338302220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020a318901db3c019101ce01fe3c7265637420783d223432382220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223436382220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04208f05318901db3ce021c005e30221c006019301ce0194019601fe3c7265637420783d223531362220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223535362220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020a318901db3c019501ce01fe3c7265637420783d223630342220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223634342220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd031c8f05318901db3ce001c007e30230019701ce019801fe3c7265637420783d223639322220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223733322220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02088901db3c019901ce01fe3c7265637420783d223738302220793d22333732222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223832302220793d22343236222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd043ceda2edfb22c0018f0c218f086c218901db3cdb31e1de22c002e30022c00301b601ce019b019c0322218f086c218901db3cdb31e121c001e30201c401ce01ac041ee30022c004e30022c005e30022c006019d019f01a301a80428218f086c218901db3cdb31e121c001e30221c00201b401ce01b5019e02168f086c218901db3cdb31e001b801ce0428218f086c218901db3cdb31e121c001e30221c00201c201ce01a001a102106c218901db3cdb3101c401ce03208f086c218901db3cdb31e021c003e30201c601ce01a202106c218901db3cdb3101c801ce0428218f086c218901db3cdb31e121c001e30221c00201b201ce01a401a502106c218901db3cdb3101b401ce04268f086c218901db3cdb31e021c003e30221c00401b601ce01a601a702106c218901db3cdb3101b801ce02168f086c218901db3cdb31e001ba01ce031ce30022c007e30002c008915be30d01a901af01bd0428218f086c218901db3cdb31e121c001e30221c00201c001ce01aa01ab02106c218901db3cdb3101c201ce04268f086c218901db3cdb31e021c003e30221c00401c401ce01ac01ad02106c218901db3cdb3101c601ce03208f086c218901db3cdb31e021c005e30201c801ce01ae02106c218901db3cdb3101ca01ce0428218f086c218901db3cdb31e121c001e30221c00201b001ce01b101b301fe3c7265637420783d223230382220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223234382220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02106c218901db3cdb3101b201ce01fe3c7265637420783d223239362220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223333362220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04268f086c218901db3cdb31e021c003e30221c00401b401ce01b501b701fe3c7265637420783d223338342220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223432342220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02106c218901db3cdb3101b601ce01fe3c7265637420783d223437322220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223531322220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04268f086c218901db3cdb31e021c005e30221c00601b801ce01b901bb01fe3c7265637420783d223536302220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223630302220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02106c218901db3cdb3101ba01ce01fe3c7265637420783d223634382220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223638382220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd02168f086c218901db3cdb31e001bc01ce01fe3c7265637420783d223733362220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223737362220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd0426208f07308901db3cdb31e120c001e30220c00201be01ce01bf01c101fe3c7265637420783d223136342220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223230342220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020e308901db3cdb3101c001ce01fe3c7265637420783d223235322220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223239322220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04248f07308901db3cdb31e020c003e30220c00401c201ce01c301c501fe3c7265637420783d223334302220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223338302220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020e308901db3cdb3101c401ce01fe3c7265637420783d223432382220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223436382220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd04248f07308901db3cdb31e020c005e30220c00601c601ce01c701c901fe3c7265637420783d223531362220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223535362220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020e308901db3cdb3101c801ce01fe3c7265637420783d223630342220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223634342220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd031e8f07308901db3cdb31e0c007e3023001ca01ce01cb01fe3c7265637420783d223639322220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223733322220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd020c8901db3cdb3101cc01ce01fe3c7265637420783d223738302220793d22343634222077696474683d22383022206865696768743d223830222072783d223136222066696c6c3d2275726c282374696c6529222f3e3c7465787420783d223832302220793d22353138222066696c6c3d22233034313230662220666f6e742d66616d696c793d22417269616c01cd00862c73616e732d73657269662220666f6e742d73697a653d2234322220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e032259db3c01db3c8b73c2f746578743e8db3c01e601d401e6040a89db3cdb3c01d001e601d301e201fe3c7465787420783d223531322220793d22363034222066696c6c3d22236466663866322220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2235382220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e2e6174683c01d101fe2f746578743e3c7061746820643d224d313736203632344838343822207374726f6b653d2275726c2823616363656e742922207374726f6b652d77696474683d223622207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3538222f3e3c7465787420783d223531322220793d223735342201d200ca2066696c6c3d22236437656265362220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2234342220666f6e742d7765696768743d223830302220746578742d616e63686f723d226d6964646c65223e014e21d070935304b98e9c01d30710795e35104810394899db3c07a41068105710461035443012e85b01d4044e20c02d8e86308b12d8db3ce020c0308e86308b1308db3ce020c0318e86308b1318db3ce020c03201e101e101e101d504488e86308b1328db3ce020c0338e86308b1338db3ce020c0348e86308b1348db3ce020c03501e101e101e101d604488e86308b1358db3ce020c0368e86308b1368db3ce020c0378e86308b1378db3ce020c03801e101e101e101d704488e86308b1388db3ce020c0398e86308b1398db3ce020c05f8e86308b15f8db3ce020c06101e101e101e101d804488e86308b1618db3ce020c0628e86308b1628db3ce020c0638e86308b1638db3ce020c06401e101e101e101d904488e86308b1648db3ce020c0658e86308b1658db3ce020c0668e86308b1668db3ce020c06701e101e101e101da04488e86308b1678db3ce020c0688e86308b1688db3ce020c0698e86308b1698db3ce020c06a01e101e101e101db04488e86308b16a8db3ce020c06b8e86308b16b8db3ce020c06c8e86308b16c8db3ce020c06d01e101e101e101dc04488e86308b16d8db3ce020c06e8e86308b16e8db3ce020c06f8e86308b16f8db3ce020c07001e101e101e101dd04488e86308b1708db3ce020c0718e86308b1718db3ce020c0728e86308b1728db3ce020c07301e101e101e101de04488e86308b1738db3ce020c0748e86308b1748db3ce020c0758e86308b1758db3ce020c07601e101e101e101df04488e86308b1768db3ce020c0778e86308b1778db3ce020c0788e86308b1788db3ce020c07901e101e101e101e002268e86308b1798db3ce0c07a8e858b17a8db3ce001e101e10104db3c01e6020689db3c01e301e601fe2e6174683c2f746578743e3c7465787420783d223531322220793d22383236222066696c6c3d22233638383037612220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232362220666f6e742d7765696768743d2237303022206c65747465722d73706163696e673d01e401fe22332220746578742d616e63686f723d226d6964646c65223e504c4154484f20555345524e414d453c2f746578743e3c7465787420783d223531322220793d22383930222066696c6c3d22233266373036322220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d223201e500ac322220666f6e742d7765696768743d2237303022206c65747465722d73706163696e673d22342220746578742d616e63686f723d226d6964646c65223e4f4e2d434841494e205356473c2f746578743e3c2f7376673e00b620d74a21d7499720c20022c200b18e48036f22807f22cf31ab02a105ab025155b60820c2009a20aa0215d71803ce4014de596f025341a1c20099c8016f025044a1aa028e123133c20099d430d020d74a21d749927020e2e2e85f03000810364540bb45860d');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initUsernameNFTItem_init_args({ $$type: 'UsernameNFTItem_init_args', username_registry_address, name_hash })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const UsernameNFTItem_errors = {
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

export const UsernameNFTItem_errors_backward = {
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

const UsernameNFTItem_types: ABIType[] = [
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
    {"name":"InitializeUsernameItem","header":1431193934,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"ResendDeployedAck","header":1671232620,"fields":[]},
    {"name":"TopUpStorageReserve","header":665640843,"fields":[]},
    {"name":"UsernameItemDeployedAck","header":3148082201,"fields":[{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"NftTransfer","header":1607220500,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"new_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"custom_payload","type":{"kind":"simple","type":"cell","optional":true}},{"name":"forward_amount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"NftOwnershipAssigned","header":85167505,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"previous_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"forward_payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"NftExcesses","header":3576854235,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UsernameNFTItemStateView","header":null,"fields":[{"name":"initialized","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"username_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"username","type":{"kind":"simple","type":"cell","optional":false}},{"name":"tier","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameNftDataView","header":null,"fields":[{"name":"initialized","type":{"kind":"simple","type":"bool","optional":false}},{"name":"index","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"collection_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"individual_content","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"UsernameNftOnchainContent","header":null,"fields":[{"name":"marker","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"metadata","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"cell","valueFormat":"ref"}}]},
    {"name":"UsernameNFTItem$Data","header":null,"fields":[{"name":"initialized","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"cell","optional":false}}]},
]

const UsernameNFTItem_opcodes = {
    "InitializeUsernameItem": 1431193934,
    "ResendDeployedAck": 1671232620,
    "TopUpStorageReserve": 665640843,
    "UsernameItemDeployedAck": 3148082201,
    "NftTransfer": 1607220500,
    "NftOwnershipAssigned": 85167505,
    "NftExcesses": 3576854235,
}

const UsernameNFTItem_getters: ABIGetter[] = [
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"UsernameNFTItemStateView","optional":false}},
    {"name":"get_nft_data","methodId":102351,"arguments":[],"returnType":{"kind":"simple","type":"UsernameNftDataView","optional":false}},
]

export const UsernameNFTItem_getterMapping: { [key: string]: string } = {
    'get_state': 'getGetState',
    'get_nft_data': 'getGetNftData',
}

const UsernameNFTItem_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"InitializeUsernameItem"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ResendDeployedAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"NftTransfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const USERNAME_ITEM_ACK_FORWARD_RESERVE = 3000000n;
export const USERNAME_ITEM_ACK_EXEC_RESERVE = 1000000n;
export const USERNAME_ITEM_ACK_MAX_RESEND_VALUE = 20000000n;
export const USERNAME_ITEM_TRANSFER_EXEC_RESERVE = 2000000n;
export const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE = 10000000n;
export const USERNAME_ITEM_EXCESSES_MIN_VALUE = 100000n;
export const USERNAME_ITEM_MAX_LENGTH = 16n;
export const USERNAME_ITEM_NAME_HASH_DOMAIN = 3318512854n;
export const USERNAME_ITEM_METADATA_KEY_NAME = 59089242681608890680090686026688704441792375738894456860693970539822503415433n;
export const USERNAME_ITEM_METADATA_KEY_DESCRIPTION = 90922719342317012409671596374183159143637506542604000676488204638996496437508n;
export const USERNAME_ITEM_METADATA_KEY_IMAGE = 43884663033947008978309661017057008345326326811558777475113826163084742639165n;
export const USERNAME_ITEM_METADATA_KEY_IMAGE_DATA = 98449690268711667050166283313913751402364107788915545466587557261600130787812n;

export class UsernameNFTItem implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = UsernameNFTItem_errors_backward;
    public static readonly opcodes = UsernameNFTItem_opcodes;
    
    static async init(username_registry_address: Address, name_hash: bigint) {
        return await UsernameNFTItem_init(username_registry_address, name_hash);
    }
    
    static async fromInit(username_registry_address: Address, name_hash: bigint) {
        const __gen_init = await UsernameNFTItem_init(username_registry_address, name_hash);
        const address = contractAddress(0, __gen_init);
        return new UsernameNFTItem(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new UsernameNFTItem(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  UsernameNFTItem_types,
        getters: UsernameNFTItem_getters,
        receivers: UsernameNFTItem_receivers,
        errors: UsernameNFTItem_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: InitializeUsernameItem | ResendDeployedAck | NftTransfer | TopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'InitializeUsernameItem') {
            body = beginCell().store(storeInitializeUsernameItem(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ResendDeployedAck') {
            body = beginCell().store(storeResendDeployedAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'NftTransfer') {
            body = beginCell().store(storeNftTransfer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpStorageReserve') {
            body = beginCell().store(storeTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_state', builder.build())).stack;
        const result = loadGetterTupleUsernameNFTItemStateView(source);
        return result;
    }
    
    async getGetNftData(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_nft_data', builder.build())).stack;
        const result = loadGetterTupleUsernameNftDataView(source);
        return result;
    }
    
}