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

export type BindOfficialAthWallet = {
    $$type: 'BindOfficialAthWallet';
    deployment_manifest_hash: bigint;
    official_ath_wallet_address: Address;
}

export function storeBindOfficialAthWallet(src: BindOfficialAthWallet) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1715335229, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.official_ath_wallet_address);
    };
}

export function loadBindOfficialAthWallet(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1715335229) { throw Error('Invalid prefix'); }
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

export type BindUsernameVault = {
    $$type: 'BindUsernameVault';
    deployment_manifest_hash: bigint;
    vault_address: Address;
}

export function storeBindUsernameVault(src: BindUsernameVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1621496068, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.vault_address);
    };
}

export function loadBindUsernameVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1621496068) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _vault_address = sc_0.loadAddress();
    return { $$type: 'BindUsernameVault' as const, deployment_manifest_hash: _deployment_manifest_hash, vault_address: _vault_address };
}

export function loadTupleBindUsernameVault(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _vault_address = source.readAddress();
    return { $$type: 'BindUsernameVault' as const, deployment_manifest_hash: _deployment_manifest_hash, vault_address: _vault_address };
}

export function loadGetterTupleBindUsernameVault(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _vault_address = source.readAddress();
    return { $$type: 'BindUsernameVault' as const, deployment_manifest_hash: _deployment_manifest_hash, vault_address: _vault_address };
}

export function storeTupleBindUsernameVault(source: BindUsernameVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.vault_address);
    return builder.build();
}

export function dictValueParserBindUsernameVault(): DictionaryValue<BindUsernameVault> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindUsernameVault(src)).endCell());
        },
        parse: (src) => {
            return loadBindUsernameVault(src.loadRef().beginParse());
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

export type FlushTreasuryAthDue = {
    $$type: 'FlushTreasuryAthDue';
    query_id: bigint;
}

export function storeFlushTreasuryAthDue(src: FlushTreasuryAthDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1621736923, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadFlushTreasuryAthDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1621736923) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'FlushTreasuryAthDue' as const, query_id: _query_id };
}

export function loadTupleFlushTreasuryAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushTreasuryAthDue' as const, query_id: _query_id };
}

export function loadGetterTupleFlushTreasuryAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushTreasuryAthDue' as const, query_id: _query_id };
}

export function storeTupleFlushTreasuryAthDue(source: FlushTreasuryAthDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserFlushTreasuryAthDue(): DictionaryValue<FlushTreasuryAthDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushTreasuryAthDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushTreasuryAthDue(src.loadRef().beginParse());
        }
    }
}

export type FlushBurnAthDue = {
    $$type: 'FlushBurnAthDue';
    query_id: bigint;
}

export function storeFlushBurnAthDue(src: FlushBurnAthDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3919758027, 32);
        b_0.storeUint(src.query_id, 64);
    };
}

export function loadFlushBurnAthDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3919758027) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    return { $$type: 'FlushBurnAthDue' as const, query_id: _query_id };
}

export function loadTupleFlushBurnAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushBurnAthDue' as const, query_id: _query_id };
}

export function loadGetterTupleFlushBurnAthDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    return { $$type: 'FlushBurnAthDue' as const, query_id: _query_id };
}

export function storeTupleFlushBurnAthDue(source: FlushBurnAthDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    return builder.build();
}

export function dictValueParserFlushBurnAthDue(): DictionaryValue<FlushBurnAthDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushBurnAthDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushBurnAthDue(src.loadRef().beginParse());
        }
    }
}

export type PrunePendingUsernameMint = {
    $$type: 'PrunePendingUsernameMint';
    name_hash: bigint;
}

export function storePrunePendingUsernameMint(src: PrunePendingUsernameMint) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(932634413, 32);
        b_0.storeUint(src.name_hash, 256);
    };
}

export function loadPrunePendingUsernameMint(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 932634413) { throw Error('Invalid prefix'); }
    const _name_hash = sc_0.loadUintBig(256);
    return { $$type: 'PrunePendingUsernameMint' as const, name_hash: _name_hash };
}

export function loadTuplePrunePendingUsernameMint(source: TupleReader) {
    const _name_hash = source.readBigNumber();
    return { $$type: 'PrunePendingUsernameMint' as const, name_hash: _name_hash };
}

export function loadGetterTuplePrunePendingUsernameMint(source: TupleReader) {
    const _name_hash = source.readBigNumber();
    return { $$type: 'PrunePendingUsernameMint' as const, name_hash: _name_hash };
}

export function storeTuplePrunePendingUsernameMint(source: PrunePendingUsernameMint) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.name_hash);
    return builder.build();
}

export function dictValueParserPrunePendingUsernameMint(): DictionaryValue<PrunePendingUsernameMint> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrunePendingUsernameMint(src)).endCell());
        },
        parse: (src) => {
            return loadPrunePendingUsernameMint(src.loadRef().beginParse());
        }
    }
}

export type UsernameRegistryTopUpStorageReserve = {
    $$type: 'UsernameRegistryTopUpStorageReserve';
}

export function storeUsernameRegistryTopUpStorageReserve(src: UsernameRegistryTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(179986205, 32);
    };
}

export function loadUsernameRegistryTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 179986205) { throw Error('Invalid prefix'); }
    return { $$type: 'UsernameRegistryTopUpStorageReserve' as const };
}

export function loadTupleUsernameRegistryTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'UsernameRegistryTopUpStorageReserve' as const };
}

export function loadGetterTupleUsernameRegistryTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'UsernameRegistryTopUpStorageReserve' as const };
}

export function storeTupleUsernameRegistryTopUpStorageReserve(source: UsernameRegistryTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserUsernameRegistryTopUpStorageReserve(): DictionaryValue<UsernameRegistryTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameRegistryTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameRegistryTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type PendingUsernameMint = {
    $$type: 'PendingUsernameMint';
    query_id: bigint;
    sender_key: bigint;
    owner_wallet: Address;
    name_hash: bigint;
    price_paid: bigint;
    item_address: Address;
    item_deploy_value: bigint;
    created_at: bigint;
}

export function storePendingUsernameMint(src: PendingUsernameMint) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.name_hash, 256);
        b_0.storeUint(src.price_paid, 128);
        const b_1 = new Builder();
        b_1.storeAddress(src.item_address);
        b_1.storeUint(src.item_deploy_value, 128);
        b_1.storeUint(src.created_at, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingUsernameMint(slice: Slice) {
    const sc_0 = slice;
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _owner_wallet = sc_0.loadAddress();
    const _name_hash = sc_0.loadUintBig(256);
    const _price_paid = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _item_address = sc_1.loadAddress();
    const _item_deploy_value = sc_1.loadUintBig(128);
    const _created_at = sc_1.loadUintBig(64);
    return { $$type: 'PendingUsernameMint' as const, query_id: _query_id, sender_key: _sender_key, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadTuplePendingUsernameMint(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMint' as const, query_id: _query_id, sender_key: _sender_key, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadGetterTuplePendingUsernameMint(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMint' as const, query_id: _query_id, sender_key: _sender_key, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function storeTuplePendingUsernameMint(source: PendingUsernameMint) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.name_hash);
    builder.writeNumber(source.price_paid);
    builder.writeAddress(source.item_address);
    builder.writeNumber(source.item_deploy_value);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingUsernameMint(): DictionaryValue<PendingUsernameMint> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingUsernameMint(src)).endCell());
        },
        parse: (src) => {
            return loadPendingUsernameMint(src.loadRef().beginParse());
        }
    }
}

export type NameRecord = {
    $$type: 'NameRecord';
    minter_wallet: Address;
    item_address: Address;
    registered_at: bigint;
}

export function storeNameRecord(src: NameRecord) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.minter_wallet);
        b_0.storeAddress(src.item_address);
        b_0.storeUint(src.registered_at, 64);
    };
}

export function loadNameRecord(slice: Slice) {
    const sc_0 = slice;
    const _minter_wallet = sc_0.loadAddress();
    const _item_address = sc_0.loadAddress();
    const _registered_at = sc_0.loadUintBig(64);
    return { $$type: 'NameRecord' as const, minter_wallet: _minter_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadTupleNameRecord(source: TupleReader) {
    const _minter_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'NameRecord' as const, minter_wallet: _minter_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadGetterTupleNameRecord(source: TupleReader) {
    const _minter_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'NameRecord' as const, minter_wallet: _minter_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function storeTupleNameRecord(source: NameRecord) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.minter_wallet);
    builder.writeAddress(source.item_address);
    builder.writeNumber(source.registered_at);
    return builder.build();
}

export function dictValueParserNameRecord(): DictionaryValue<NameRecord> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNameRecord(src)).endCell());
        },
        parse: (src) => {
            return loadNameRecord(src.loadRef().beginParse());
        }
    }
}

export type UsernameRegistryGlobalView = {
    $$type: 'UsernameRegistryGlobalView';
    sealed: boolean;
    official_ath_wallet_bound: boolean;
    vault_bound: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    official_ath_wallet_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
    name_record_count: bigint;
    pending_mint_count: bigint;
    treasury_due_ath: bigint;
    burn_due_ath: bigint;
    pending_treasury_flush_count: bigint;
    pending_burn_flush_count: bigint;
    pending_mint_stale_ttl: bigint;
}

export function storeUsernameRegistryGlobalView(src: UsernameRegistryGlobalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeBit(src.official_ath_wallet_bound);
        b_0.storeBit(src.vault_bound);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.official_ath_wallet_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.vault_address);
        b_1.storeAddress(src.genesis_controller_address);
        b_1.storeInt(src.name_record_count, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.pending_mint_count, 257);
        b_2.storeInt(src.treasury_due_ath, 257);
        b_2.storeInt(src.burn_due_ath, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.pending_treasury_flush_count, 257);
        b_3.storeInt(src.pending_burn_flush_count, 257);
        b_3.storeInt(src.pending_mint_stale_ttl, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadUsernameRegistryGlobalView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _official_ath_wallet_bound = sc_0.loadBit();
    const _vault_bound = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _official_ath_wallet_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _vault_address = sc_1.loadAddress();
    const _genesis_controller_address = sc_1.loadAddress();
    const _name_record_count = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pending_mint_count = sc_2.loadIntBig(257);
    const _treasury_due_ath = sc_2.loadIntBig(257);
    const _burn_due_ath = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_treasury_flush_count = sc_3.loadIntBig(257);
    const _pending_burn_flush_count = sc_3.loadIntBig(257);
    const _pending_mint_stale_ttl = sc_3.loadIntBig(257);
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
}

export function loadTupleUsernameRegistryGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _name_record_count = source.readBigNumber();
    const _pending_mint_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    const _pending_mint_stale_ttl = source.readBigNumber();
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
}

export function loadGetterTupleUsernameRegistryGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _name_record_count = source.readBigNumber();
    const _pending_mint_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    const _pending_mint_stale_ttl = source.readBigNumber();
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
}

export function storeTupleUsernameRegistryGlobalView(source: UsernameRegistryGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.vault_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.vault_address);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.name_record_count);
    builder.writeNumber(source.pending_mint_count);
    builder.writeNumber(source.treasury_due_ath);
    builder.writeNumber(source.burn_due_ath);
    builder.writeNumber(source.pending_treasury_flush_count);
    builder.writeNumber(source.pending_burn_flush_count);
    builder.writeNumber(source.pending_mint_stale_ttl);
    return builder.build();
}

export function dictValueParserUsernameRegistryGlobalView(): DictionaryValue<UsernameRegistryGlobalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameRegistryGlobalView(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameRegistryGlobalView(src.loadRef().beginParse());
        }
    }
}

export type UsernamePriceView = {
    $$type: 'UsernamePriceView';
    valid_length: boolean;
    price_ath_atomic: bigint;
}

export function storeUsernamePriceView(src: UsernamePriceView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.valid_length);
        b_0.storeInt(src.price_ath_atomic, 257);
    };
}

export function loadUsernamePriceView(slice: Slice) {
    const sc_0 = slice;
    const _valid_length = sc_0.loadBit();
    const _price_ath_atomic = sc_0.loadIntBig(257);
    return { $$type: 'UsernamePriceView' as const, valid_length: _valid_length, price_ath_atomic: _price_ath_atomic };
}

export function loadTupleUsernamePriceView(source: TupleReader) {
    const _valid_length = source.readBoolean();
    const _price_ath_atomic = source.readBigNumber();
    return { $$type: 'UsernamePriceView' as const, valid_length: _valid_length, price_ath_atomic: _price_ath_atomic };
}

export function loadGetterTupleUsernamePriceView(source: TupleReader) {
    const _valid_length = source.readBoolean();
    const _price_ath_atomic = source.readBigNumber();
    return { $$type: 'UsernamePriceView' as const, valid_length: _valid_length, price_ath_atomic: _price_ath_atomic };
}

export function storeTupleUsernamePriceView(source: UsernamePriceView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.valid_length);
    builder.writeNumber(source.price_ath_atomic);
    return builder.build();
}

export function dictValueParserUsernamePriceView(): DictionaryValue<UsernamePriceView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernamePriceView(src)).endCell());
        },
        parse: (src) => {
            return loadUsernamePriceView(src.loadRef().beginParse());
        }
    }
}

export type UsernameNameRecordView = {
    $$type: 'UsernameNameRecordView';
    exists: boolean;
    minter_wallet: Address;
    item_address: Address;
    registered_at: bigint;
}

export function storeUsernameNameRecordView(src: UsernameNameRecordView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.minter_wallet);
        b_0.storeAddress(src.item_address);
        b_0.storeInt(src.registered_at, 257);
    };
}

export function loadUsernameNameRecordView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _minter_wallet = sc_0.loadAddress();
    const _item_address = sc_0.loadAddress();
    const _registered_at = sc_0.loadIntBig(257);
    return { $$type: 'UsernameNameRecordView' as const, exists: _exists, minter_wallet: _minter_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadTupleUsernameNameRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _minter_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'UsernameNameRecordView' as const, exists: _exists, minter_wallet: _minter_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadGetterTupleUsernameNameRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _minter_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'UsernameNameRecordView' as const, exists: _exists, minter_wallet: _minter_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function storeTupleUsernameNameRecordView(source: UsernameNameRecordView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.minter_wallet);
    builder.writeAddress(source.item_address);
    builder.writeNumber(source.registered_at);
    return builder.build();
}

export function dictValueParserUsernameNameRecordView(): DictionaryValue<UsernameNameRecordView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameNameRecordView(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameNameRecordView(src.loadRef().beginParse());
        }
    }
}

export type PendingUsernameMintView = {
    $$type: 'PendingUsernameMintView';
    exists: boolean;
    query_id: bigint;
    sender_key: bigint;
    owner_wallet: Address;
    name_hash: bigint;
    price_paid: bigint;
    item_address: Address;
    item_deploy_value: bigint;
    created_at: bigint;
}

export function storePendingUsernameMintView(src: PendingUsernameMintView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.query_id, 257);
        b_0.storeInt(src.sender_key, 257);
        b_0.storeAddress(src.owner_wallet);
        const b_1 = new Builder();
        b_1.storeInt(src.name_hash, 257);
        b_1.storeInt(src.price_paid, 257);
        b_1.storeAddress(src.item_address);
        const b_2 = new Builder();
        b_2.storeInt(src.item_deploy_value, 257);
        b_2.storeInt(src.created_at, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingUsernameMintView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _query_id = sc_0.loadIntBig(257);
    const _sender_key = sc_0.loadIntBig(257);
    const _owner_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _name_hash = sc_1.loadIntBig(257);
    const _price_paid = sc_1.loadIntBig(257);
    const _item_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _item_deploy_value = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    return { $$type: 'PendingUsernameMintView' as const, exists: _exists, query_id: _query_id, sender_key: _sender_key, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadTuplePendingUsernameMintView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintView' as const, exists: _exists, query_id: _query_id, sender_key: _sender_key, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadGetterTuplePendingUsernameMintView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintView' as const, exists: _exists, query_id: _query_id, sender_key: _sender_key, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function storeTuplePendingUsernameMintView(source: PendingUsernameMintView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.name_hash);
    builder.writeNumber(source.price_paid);
    builder.writeAddress(source.item_address);
    builder.writeNumber(source.item_deploy_value);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingUsernameMintView(): DictionaryValue<PendingUsernameMintView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingUsernameMintView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingUsernameMintView(src.loadRef().beginParse());
        }
    }
}

export type PendingAthTreasuryFlush = {
    $$type: 'PendingAthTreasuryFlush';
    amount: bigint;
    recipient_ath_wallet: Address;
    created_at: bigint;
}

export function storePendingAthTreasuryFlush(src: PendingAthTreasuryFlush) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingAthTreasuryFlush(slice: Slice) {
    const sc_0 = slice;
    const _amount = sc_0.loadUintBig(128);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingAthTreasuryFlush' as const, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadTuplePendingAthTreasuryFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTreasuryFlush' as const, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingAthTreasuryFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTreasuryFlush' as const, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function storeTuplePendingAthTreasuryFlush(source: PendingAthTreasuryFlush) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthTreasuryFlush(): DictionaryValue<PendingAthTreasuryFlush> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthTreasuryFlush(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthTreasuryFlush(src.loadRef().beginParse());
        }
    }
}

export type PendingAthBurnFlush = {
    $$type: 'PendingAthBurnFlush';
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthBurnFlush(src: PendingAthBurnFlush) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.created_at, 64);
    };
}

export function loadPendingAthBurnFlush(slice: Slice) {
    const sc_0 = slice;
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(64);
    return { $$type: 'PendingAthBurnFlush' as const, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthBurnFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthBurnFlush' as const, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthBurnFlush(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthBurnFlush' as const, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthBurnFlush(source: PendingAthBurnFlush) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthBurnFlush(): DictionaryValue<PendingAthBurnFlush> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthBurnFlush(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthBurnFlush(src.loadRef().beginParse());
        }
    }
}

export type PendingAthTreasuryFlushView = {
    $$type: 'PendingAthTreasuryFlushView';
    exists: boolean;
    amount: bigint;
    recipient_ath_wallet: Address;
    created_at: bigint;
}

export function storePendingAthTreasuryFlushView(src: PendingAthTreasuryFlushView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.amount, 257);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPendingAthTreasuryFlushView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _amount = sc_0.loadIntBig(257);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PendingAthTreasuryFlushView' as const, exists: _exists, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadTuplePendingAthTreasuryFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTreasuryFlushView' as const, exists: _exists, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingAthTreasuryFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthTreasuryFlushView' as const, exists: _exists, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function storeTuplePendingAthTreasuryFlushView(source: PendingAthTreasuryFlushView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthTreasuryFlushView(): DictionaryValue<PendingAthTreasuryFlushView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthTreasuryFlushView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthTreasuryFlushView(src.loadRef().beginParse());
        }
    }
}

export type PendingAthBurnFlushView = {
    $$type: 'PendingAthBurnFlushView';
    exists: boolean;
    amount: bigint;
    created_at: bigint;
}

export function storePendingAthBurnFlushView(src: PendingAthBurnFlushView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.amount, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPendingAthBurnFlushView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _amount = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PendingAthBurnFlushView' as const, exists: _exists, amount: _amount, created_at: _created_at };
}

export function loadTuplePendingAthBurnFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthBurnFlushView' as const, exists: _exists, amount: _amount, created_at: _created_at };
}

export function loadGetterTuplePendingAthBurnFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _amount = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthBurnFlushView' as const, exists: _exists, amount: _amount, created_at: _created_at };
}

export function storeTuplePendingAthBurnFlushView(source: PendingAthBurnFlushView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.amount);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthBurnFlushView(): DictionaryValue<PendingAthBurnFlushView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthBurnFlushView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthBurnFlushView(src.loadRef().beginParse());
        }
    }
}

export type UsernameCollectionDataView = {
    $$type: 'UsernameCollectionDataView';
    next_item_index: bigint;
    collection_content: Cell;
    owner_address: Address;
}

export function storeUsernameCollectionDataView(src: UsernameCollectionDataView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.next_item_index, 257);
        b_0.storeRef(src.collection_content);
        b_0.storeAddress(src.owner_address);
    };
}

export function loadUsernameCollectionDataView(slice: Slice) {
    const sc_0 = slice;
    const _next_item_index = sc_0.loadIntBig(257);
    const _collection_content = sc_0.loadRef();
    const _owner_address = sc_0.loadAddress();
    return { $$type: 'UsernameCollectionDataView' as const, next_item_index: _next_item_index, collection_content: _collection_content, owner_address: _owner_address };
}

export function loadTupleUsernameCollectionDataView(source: TupleReader) {
    const _next_item_index = source.readBigNumber();
    const _collection_content = source.readCell();
    const _owner_address = source.readAddress();
    return { $$type: 'UsernameCollectionDataView' as const, next_item_index: _next_item_index, collection_content: _collection_content, owner_address: _owner_address };
}

export function loadGetterTupleUsernameCollectionDataView(source: TupleReader) {
    const _next_item_index = source.readBigNumber();
    const _collection_content = source.readCell();
    const _owner_address = source.readAddress();
    return { $$type: 'UsernameCollectionDataView' as const, next_item_index: _next_item_index, collection_content: _collection_content, owner_address: _owner_address };
}

export function storeTupleUsernameCollectionDataView(source: UsernameCollectionDataView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.next_item_index);
    builder.writeCell(source.collection_content);
    builder.writeAddress(source.owner_address);
    return builder.build();
}

export function dictValueParserUsernameCollectionDataView(): DictionaryValue<UsernameCollectionDataView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameCollectionDataView(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameCollectionDataView(src.loadRef().beginParse());
        }
    }
}

export type UsernameCollectionOnchainContent = {
    $$type: 'UsernameCollectionOnchainContent';
    marker: bigint;
    metadata: Dictionary<bigint, Cell>;
}

export function storeUsernameCollectionOnchainContent(src: UsernameCollectionOnchainContent) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.marker, 8);
        b_0.storeDict(src.metadata, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    };
}

export function loadUsernameCollectionOnchainContent(slice: Slice) {
    const sc_0 = slice;
    const _marker = sc_0.loadUintBig(8);
    const _metadata = Dictionary.load(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), sc_0);
    return { $$type: 'UsernameCollectionOnchainContent' as const, marker: _marker, metadata: _metadata };
}

export function loadTupleUsernameCollectionOnchainContent(source: TupleReader) {
    const _marker = source.readBigNumber();
    const _metadata = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), source.readCellOpt());
    return { $$type: 'UsernameCollectionOnchainContent' as const, marker: _marker, metadata: _metadata };
}

export function loadGetterTupleUsernameCollectionOnchainContent(source: TupleReader) {
    const _marker = source.readBigNumber();
    const _metadata = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell(), source.readCellOpt());
    return { $$type: 'UsernameCollectionOnchainContent' as const, marker: _marker, metadata: _metadata };
}

export function storeTupleUsernameCollectionOnchainContent(source: UsernameCollectionOnchainContent) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.marker);
    builder.writeCell(source.metadata.size > 0 ? beginCell().storeDictDirect(source.metadata, Dictionary.Keys.BigUint(256), Dictionary.Values.Cell()).endCell() : null);
    return builder.build();
}

export function dictValueParserUsernameCollectionOnchainContent(): DictionaryValue<UsernameCollectionOnchainContent> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameCollectionOnchainContent(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameCollectionOnchainContent(src.loadRef().beginParse());
        }
    }
}

export type UsernameRegistry$Data = {
    $$type: 'UsernameRegistry$Data';
    official_ath_wallet_address: Address;
    vault_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: boolean;
    vault_bound: boolean;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    name_record_count: bigint;
    pending_mint_count: bigint;
    treasury_due_ath: bigint;
    burn_due_ath: bigint;
    name_records: Dictionary<bigint, NameRecord>;
    pending_mints: Dictionary<bigint, PendingUsernameMint>;
    pending_item_to_name_hash: Dictionary<Address, bigint>;
    pending_treasury_flushes: Dictionary<bigint, PendingAthTreasuryFlush>;
    pending_treasury_flush_count: bigint;
    pending_burn_flushes: Dictionary<bigint, PendingAthBurnFlush>;
    pending_burn_flush_count: bigint;
    genesis_controller_address: Address;
}

export function storeUsernameRegistry$Data(src: UsernameRegistry$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.official_ath_wallet_address);
        b_0.storeAddress(src.vault_address);
        b_0.storeAddress(src.ath_master_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.treasury_ath_receiver_address);
        b_1.storeBit(src.official_ath_wallet_bound);
        b_1.storeBit(src.vault_bound);
        b_1.storeBit(src.sealed);
        b_1.storeUint(src.deployment_manifest_hash, 256);
        b_1.storeUint(src.genesis_config_hash, 256);
        b_1.storeUint(src.name_record_count, 64);
        b_1.storeUint(src.pending_mint_count, 64);
        const b_2 = new Builder();
        b_2.storeUint(src.treasury_due_ath, 128);
        b_2.storeUint(src.burn_due_ath, 128);
        b_2.storeDict(src.name_records, Dictionary.Keys.BigInt(257), dictValueParserNameRecord());
        b_2.storeDict(src.pending_mints, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint());
        b_2.storeDict(src.pending_item_to_name_hash, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257));
        const b_3 = new Builder();
        b_3.storeDict(src.pending_treasury_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush());
        b_3.storeUint(src.pending_treasury_flush_count, 64);
        b_3.storeDict(src.pending_burn_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush());
        b_3.storeUint(src.pending_burn_flush_count, 64);
        b_3.storeAddress(src.genesis_controller_address);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadUsernameRegistry$Data(slice: Slice) {
    const sc_0 = slice;
    const _official_ath_wallet_address = sc_0.loadAddress();
    const _vault_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _treasury_ath_receiver_address = sc_1.loadAddress();
    const _official_ath_wallet_bound = sc_1.loadBit();
    const _vault_bound = sc_1.loadBit();
    const _sealed = sc_1.loadBit();
    const _deployment_manifest_hash = sc_1.loadUintBig(256);
    const _genesis_config_hash = sc_1.loadUintBig(256);
    const _name_record_count = sc_1.loadUintBig(64);
    const _pending_mint_count = sc_1.loadUintBig(64);
    const sc_2 = sc_1.loadRef().beginParse();
    const _treasury_due_ath = sc_2.loadUintBig(128);
    const _burn_due_ath = sc_2.loadUintBig(128);
    const _name_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), sc_2);
    const _pending_mints = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), sc_2);
    const _pending_item_to_name_hash = Dictionary.load(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), sc_2);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_treasury_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), sc_3);
    const _pending_treasury_flush_count = sc_3.loadUintBig(64);
    const _pending_burn_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), sc_3);
    const _pending_burn_flush_count = sc_3.loadUintBig(64);
    const _genesis_controller_address = sc_3.loadAddress();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, vault_address: _vault_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address };
}

export function loadTupleUsernameRegistry$Data(source: TupleReader) {
    const _official_ath_wallet_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _official_ath_wallet_bound = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _name_record_count = source.readBigNumber();
    const _pending_mint_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _name_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), source.readCellOpt());
    source = source.readTuple();
    const _pending_mints = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), source.readCellOpt());
    const _pending_item_to_name_hash = Dictionary.loadDirect(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, vault_address: _vault_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address };
}

export function loadGetterTupleUsernameRegistry$Data(source: TupleReader) {
    const _official_ath_wallet_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _official_ath_wallet_bound = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _name_record_count = source.readBigNumber();
    const _pending_mint_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _name_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), source.readCellOpt());
    const _pending_mints = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), source.readCellOpt());
    const _pending_item_to_name_hash = Dictionary.loadDirect(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, vault_address: _vault_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address };
}

export function storeTupleUsernameRegistry$Data(source: UsernameRegistry$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.vault_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.treasury_ath_receiver_address);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeBoolean(source.vault_bound);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeNumber(source.name_record_count);
    builder.writeNumber(source.pending_mint_count);
    builder.writeNumber(source.treasury_due_ath);
    builder.writeNumber(source.burn_due_ath);
    builder.writeCell(source.name_records.size > 0 ? beginCell().storeDictDirect(source.name_records, Dictionary.Keys.BigInt(257), dictValueParserNameRecord()).endCell() : null);
    builder.writeCell(source.pending_mints.size > 0 ? beginCell().storeDictDirect(source.pending_mints, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint()).endCell() : null);
    builder.writeCell(source.pending_item_to_name_hash.size > 0 ? beginCell().storeDictDirect(source.pending_item_to_name_hash, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_treasury_flushes.size > 0 ? beginCell().storeDictDirect(source.pending_treasury_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush()).endCell() : null);
    builder.writeNumber(source.pending_treasury_flush_count);
    builder.writeCell(source.pending_burn_flushes.size > 0 ? beginCell().storeDictDirect(source.pending_burn_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush()).endCell() : null);
    builder.writeNumber(source.pending_burn_flush_count);
    builder.writeAddress(source.genesis_controller_address);
    return builder.build();
}

export function dictValueParserUsernameRegistry$Data(): DictionaryValue<UsernameRegistry$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameRegistry$Data(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameRegistry$Data(src.loadRef().beginParse());
        }
    }
}

 type UsernameRegistry_init_args = {
    $$type: 'UsernameRegistry_init_args';
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    genesis_controller_address: Address;
}

function initUsernameRegistry_init_args(src: UsernameRegistry_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.official_ath_wallet_address);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.treasury_ath_receiver_address);
        b_0.storeBit(src.sealed);
        const b_1 = new Builder();
        b_1.storeInt(src.deployment_manifest_hash, 257);
        b_1.storeInt(src.genesis_config_hash, 257);
        b_1.storeAddress(src.genesis_controller_address);
        b_0.storeRef(b_1.endCell());
    };
}

async function UsernameRegistry_init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: boolean, deployment_manifest_hash: bigint, genesis_config_hash: bigint, genesis_controller_address: Address) {
    const __code = Cell.fromHex('b5ee9c72420202f400010000ee3f00000114ff00f4a413f4bcf2c80b00010201620002003f02f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e57fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d2b70707054700053000811140808111308081112080811110807111007106f108e107d106c105b104a1039480302e30d111602f20003049e8fb311148020d7217021d749c21f9430d31f01de208210554e494ebae30220821041544810bae302821041544801bae3025f0f5f07e0705615d74920c21f97311115d31f1116de218210663df03dba000400070008000902fe5b1112111411121111111311111110111211100f11110f0e11100e551ddb3c81010bf84227598101014133f40a6fa19401d70030925b6de2814ac4216eb3f2f4278101012259f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814ac5016eb30039000502d6f2f4db3c10355f05db3cc87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce0ec8ce1dca001bca0019ca0017cbff15cbff13cb3fcb3f01c8cb7f12cb7f12f40012f40012f40002c8f40014cb3f14f40014cb3f14cecd12cdcdc9ed5400220006007a8208b71b007f5043710301c8552082104154481e5004cb1f12cb3fcb7fcb9fc9561855304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe30d33fd37f5932011115011116db3c814ad8f8425616c705f2f424810101561859f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b2a016eb3f2f41114111511141113111411131112111311121111111211111110111111100f11100f550e1116db3c5b814b2b111721ba01111701f2f4111519a000390031003203fed33fd37f5932011115011116db3c814b5af8425616c705f2f41114111511141113111411131112111311121111111211111110111111100f11100f550e1116db3c30814b5b111721ba01111701f2f4111518a01113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a0809106700390036003704fe8ffc5b1114d3fffa4030011115011116db3cdb3c814a565616c201f2f4814a575611b3f2f4814a582dc000f2f4814a5a2ec000917f942e5617bae2f2f4814a5bf8281115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160ae0000e000f000a000b02b2091116090811160807111607061116060511160504111604031116030211160201111601db3c3d3d3f57125614500ac70501111201f2f40e11110e0d11100d10cf717f111010cf10be50cd108b107a106910581047103645040296003e044c21821060a61104bae3022182103a12d1adbae30221821089129d60bae302218210bba3ec19ba000c000d0013001e04fe5b1114d3fffa4030011115011116db3cdb3c814a5c5616c201f2f4814a5d5610b3f2f42d814a5e1117ba01111601f2f4814a5f11155616db3c57105713011114010ef2f4814a66f828561501c705b3f2f41111111311111111111211110f11110f0e11100e10df7f0f10ce10bd10ac109b108a107910681057104610354430000e000f02d0003e03f45b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3cdb3c814a605616c201f2f4814a612e5617baf2f4814a625611f2f4814a635615f828111511171115111411161114111311171113111211161112000e000f0010000e814a382fb3f2f40014814a59f84222c705f2f402fe1111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a091117090811160807111707061116060511170504111604031117030211160201111701db3c01111701c70501111501f2f4111211131112111111121111111011111110814a64561011121110111111100f11100f10ef10de10cd0296001103f610bc10ab109a108910781067105610451034401301111601db3c01111601f2f4814a652ff2f4814a67561301111601db3c3d3e011114010bf2f4814a68f828561201c705b3f2f4814a69f828561001c705b3f2f4814a6a2f5613c705b3f2f4814a6b2f5612c705b3f2f4814a6c2f5611c705b3f2f411111113111102d002d0001201501110111211100f11110f0e11100e10df10ce7f0e10bd0c109b108a10791068105710461035443012003e02fe5b1114d33fd39fd37ffa40fa40d3071114111911141113111811131112111711121111111611111110111511100f11190f0e11180e0d11170d0c11160c0b11150b0a11190a091118090811170807111607061115060511190504111804031117030211160201111a01111bdb3c814aecf8425616c705f2f4814aed5610f2f40039001402a2814aee11185614c70501111801f2f41113111a11131112111911121111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e5566161510344033db3c0015003e03f0814ab124c200f2f41113111a11131112111911121111111811111110111711100f11160f0e11150e0d11140d0c111a0c0b11190b0a11180a0911170908111608071115070611140605111a05041119040311180302111702011116011115814ab611155618db3c01111601f2f4814ae2111556175617db3c02d00016001a04eaeda2edfb1114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a09111509081116080711150706111606051115050411160403111503021116020111150111165615db3ce3035616d7495616aa02bde3025616c70202720017001700180046571557151112111411121111111311111110111211100f11110f0e11100e10df551c7001dc8e23571557151112111411121111111311111110111211100f11110f0e11100e10df551c70e17094205617b98ae83057151115c7001113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443012001900b81117d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e28e2630571557151112111411121111111311111110111211100f11110f0e11100e10df551c70db31e11117a403fe01111601f2f41113111411131112111311121111111211111110111111100f11100f550e5615db3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405617db3c561a814ae302bdf2f2814ae428810101561802730266001b02fe59f40c6fa131f2f2814ae527810101561859f40c6fa131f2f282101e753dc0814ab2f8416f24135f0358bef2f45615db3c814ab32781010b2359f40a6fa131b3f2f481010182101dcd6500f82304111f0403111e03561c03561a0302111f025620021120c855705078cb3f15cb9f13cecbffcb7f01c8ce12cb7f12cb3fcdc9026b001c02fe102601111901561501206e953059f45a30944133f415e20381010b56195615810101216e955b59f4593098c801cf004133f441e208a4f828011114db3c82101dcd650011187f1118711118c855208210554e494e5004cb1f12cecb07cec906111a06051118050411170403111603103645155034c8cf8580ca00cf8440ce01026c001d009cfa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb000d11140d0c11130c0b11120b0a11110a09111009108f107e106d105c104b107a491750861035443012043ce30221821060a9bddbbae302218210e9a2c2cbbae30221821041544811ba001f00250029002d02fc5b1114d3fffa4030011115011116db3c81010bf84227598101014133f40a6fa19401d70030925b6de2814aba216eb3f2f4814abb015617baf2f426810101561759f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814abc216eb3f2f46f280039002002fe10245f046c221113111611131112111511121111111411111110111611100f11150f0e11140e0d11160d0c11150c0b11140b0a11160a0911150908111408071116070611150605111405041116040311150302111402011116011115814abd11155619db3c01111601f2f4814abef84201111701c70501111601f2f4814abf02d0002102fe26810101561959f40c6fa131b3f2f41117814ac01116c70501111501f2f41110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a1059104810374614111540055615db3c5b32810101f8234430c855205023cececb3fc9103c1201111a01206e953059f45a30944133f415e20da456178113880022002300c8278101012259f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814b64216eb3f2f46f28508f810101f45a30521e81010bf459301112a511120d0e1067105610451034413002b2a8812710a904561821a150dda050bca0561611181116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10bf10de1c1d1b109a108910781067105610451314db3c0024003e007282080f4240705043700301c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc94343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fc5b1114d33f301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c814b0a5616c200f2f45615db3c814b0b2ac200f2f4814b0cf8416f24135f03820afaf080bef2f4111311141113111211141112111111141111814b0d56150039002a002604fc11121111111055e01116db3c01111601f2f47056111a01111601db3c810101f82356184033c855205023cb7fcecb3fc91026561801206e953059f45a30944133f415e203a4820adc6c00717ff82802111a0201111901561501c855308210415448105005cb1f13cb3fcb7fcecec95616431402111902111801441359c88902d00296002700280001600190cf16ca00cf8440ce01fa02806acf40f400c901fb001112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035504213003e03f85b1114d33f301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c814b145616c200f2f45615db3c814b1529c200f2f4814b16f8416f24135f0382086acfc0bef2f470810101f82352b0c85902cb7fcb3fc910255618010039002a002b0046814b01268101012359f40c6fa131b3f2f4814b0281010154451359f40c6fa131b3f2f401fe206e953059f45a30944133f415e202a482084c4b40717ff82802111a021dc855208210415448015004cb1f12cb3fcb7fcec9561743140211190250cc441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a18002c00d81910671056104510344013c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce0ec8ce1dca001bca0019ca0017cbff15cbff13cb3fcb3f01c8cb7f12cb7f12f40012f40012f40002c8f40014cb3f14f40014cb3f14cecd12cdcdc9ed5404fe8ffb5b1114d33fd37f30011115011116db3c24810101561759f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b1e016eb3f2f41114111511141113111411131112111311121111111211111110111111100f11100f550edb3c301117814b1f02baf2f4814b20f842011117c70501111601f2f4e02100390031002e002f00fe1113111411131112111311121111111211111110111111100f11100f550ec87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce0ec8ce1dca001bca0019ca0017cbff15cbff13cb3fcb3f01c8cb7f12cb7f12f40012f40012f40002c8f40014cb3f14f40014cb3f14cecd12cdcdc9ed54044a821041544813bae30221821041544803bae30221821041544804bae3022182103796df2dba003000330035003803fc5b1114d33fd37f30011115011116db3c814ad6f8425616c705f2f424810101561759f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b28016eb3f2f41114111511141113111411131112111311121111111211111110111111100f11100f550edb3c5b814b29111721ba01111701f2f4111519a00039003100320072258101012259f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b32216eb3f2f46f235038810101f45a3006a506502701681113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab090a107810671056104510344130003e02fc5b1114d33fd37ffa40301114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150908111508071115070611150605111505041115040311150302111502011116011117db3c814b46f8425614c705f2f4814b47f82801111901c7050039003402b601111801f2f41113111511131112111411121111111311111110111211100f11110f0e11100e551d01111601db3c301116814b481117ba01111601f2f41113111411131112111311121111111211111110111111100f11100f550e0036003e03fe5b1114d33fd37f30011115011116db3c814b50f8425616c705f2f41114111511141113111411131112111311121111111211111110111111100f11100f550edb3c30814b51111721ba01111701f2f4111518a01113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a08091067003900360037006a238101012259f40d6fa192306ddf206e92306d9ad0d37fd33f596c126f02e2814b3c216eb3f2f46f225025810101f45a3003a5030400d21056104510344130c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce0ec8ce1dca001bca0019ca0017cbff15cbff13cb3fcb3f01c8cb7f12cb7f12f40012f40012f40002c8f40014cb3f14f40014cb3f14cecd12cdcdc9ed5404fe8f6a5b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c814b69f8416f24135f0382081e8480bef2f4814b655616c300f2f426810101561759f40d6fa192306ddfe057162082100aba5f1dbae302c0001115c1210039003a003c003d000c814a9c2ff2f401fc206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814b66216eb3f2f46f286c71814b67f8230282015180a012bef2f4814b688101012902111859f40c6fa131b301111601f2f4814b6bf2f01113111411131112111311121111111211111110111111100f11100f003b00c6550ec87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce0ec8ce1dca001bca0019ca0017cbff15cbff13cb3fcb3f01c8cb7f12cb7f12f40012f40012f40002c8f40014cb3f14f40014cb3f14cecd12cdcdc9ed54013e3057141112111411121111111311111110111211100f11110f0e11100e551d003e016001111501b08ea1814a9bf2f01112111411121111111311111110111211100f11110f0e11100e551de05f0f5f06f2c082003e00c2c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ce0ec8ce1dca001bca0019ca0017cbff15cbff13cb3fcb3f01c8cb7f12cb7f12f40012f40012f40002c8f40014cb3f14f40014cb3f14cecd12cdcdc9ed540201200040028a020120004102610201200042025c0201200043025902f7b2d77b51343480006395fe903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b4adc1c1c151c0014c002044502020444c2020444820204444201c44401c41bc423841f441b0416c412840e5200c0b8c34445044584450444c4454444c4448445044484444444c4446002f2004401341110111211100f11110f0e11100e10df551cdb3c57105f0f6c51004501f631d0d307f4045902d1013120830782f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce8959f40f6fa192306ddf814b96216eb3f2f4d0d3073120d749814b9721c23ff2f4814b9821a6e0a93802c000f2f4a6e0ab02814b9921c2039321c1119170e2f2f4c821aa0213d7183012cf16004602fec91112111711121111111611111110111511100f11140f0e11130e0d11170d0c11160c0b11150b0a11140a09111309081117080711160706111506051114050411130403111703021116020111150111148307111482f06105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d111956165618db3c00470167026ac86f00016f8c6d6f8c8d04d9185d184e9a5b5859d94bdcdd99cade1b5b0b20db3c59db3c6f2201c993216eb396016f2259ccc9e8310288004804da1115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a09111709081116080711170706111606051117050411160403111703021116020111170111165616db3c89db3c5616c004004900680288006c030e8912db3c21c004004a0288005001fe253343737667253230786d6c6e73253344253232687474702533412532462532467777772e77332e6f72672532463230303025324673766725323225323076696577426f7825334425323230253230302532303130323425323031303234253232253230726f6c65253344253232696d672532322533452533436465667325004b01fe33452533436c696e6561724772616469656e742532306964253344253232626725323225323078312533442532323025323225323079312533442532323025323225323078322533442532323025323225323079322533442532323125323225334525334373746f702532306f666673657425334425323230253232253230004c01fe73746f702d636f6c6f7225334425323225323330643131313325323225324625334525334373746f702532306f66667365742533442532323125323225323073746f702d636f6c6f722533442532322532333062306430662532322532462533452533432532466c696e6561724772616469656e742533452533436c696e65004d01fe61724772616469656e7425323069642533442532327465616c25323225323078312533442532323025323225323079312533442532323125323225323078322533442532323125323225323079322533442532323025323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f004e01fe6c6f7225334425323225323332626536616425323225324625334525334373746f702532306f66667365742533442532322e353525323225323073746f702d636f6c6f7225334425323225323333306435623025323225324625334525334373746f702532306f66667365742533442532323125323225323073746f702d63004f00666f6c6f722533442532322532333235633939622532322532462533452533432532466c696e6561724772616469656e74253345042e8f043189db3ce30e8bd253343253246646566732533458005102880059025401fe2533436c696e6561724772616469656e742532306964253344253232636f6d6d6f6e2d6c696e65253232253230783125334425323231303425323225323079312533442532323025323225323078322533442532323932302532322532307932253344253232302532322532306772616469656e74556e6974732533442532005201fe327573657253706163654f6e55736525323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f6c6f7225334425323225323330623064306625323225323073746f702d6f7061636974792533442532323025323225324625334525334373746f702532306f66667365742533005301fe442532322e303625323225323073746f702d636f6c6f7225334425323225323338643637323725323225323073746f702d6f7061636974792533442532322e373425323225324625334525334373746f702532306f66667365742533442532322e3525323225323073746f702d636f6c6f7225334425323225323366306337005401fe366225323225324625334525334373746f702532306f66667365742533442532322e393425323225323073746f702d636f6c6f7225334425323225323338643637323725323225323073746f702d6f7061636974792533442532322e373425323225324625334525334373746f702532306f66667365742533442532323125005501fe323225323073746f702d636f6c6f7225334425323225323330623064306625323225323073746f702d6f706163697479253344253232302532322532462533452533432532466c696e6561724772616469656e742533452533436c696e6561724772616469656e742532306964253344253232746965722d74696c65253232005601fe253230783125334425323230253232253230793125334425323233373425323225323078322533442532323025323225323079322533442532323532362532322532306772616469656e74556e6974732533442532327573657253706163654f6e55736525323225334525334373746f702532306f66667365742533442532005701fe323025323225323073746f702d636f6c6f7225334425323225323366366439386225323225324625334525334373746f702532306f66667365742533442532322e343825323225323073746f702d636f6c6f7225334425323225323364376164353725323225324625334525334373746f702532306f6666736574253344250058008432323125323225323073746f702d636f6c6f722533442532322532333864363732372532322532462533452533432532466c696e6561724772616469656e74253345031401c0058f0389db3ce30d005a0288005f01fe2533436c696e6561724772616469656e742532306964253344253232636f6d6d6f6e2d6c696e65253232253230783125334425323231303425323225323079312533442532323025323225323078322533442532323932302532322532307932253344253232302532322532306772616469656e74556e6974732533442532005b01fe327573657253706163654f6e55736525323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f6c6f7225334425323225323330623064306625323225323073746f702d6f7061636974792533442532323025323225324625334525334373746f702532306f66667365742533005c01fe442532322e303625323225323073746f702d636f6c6f7225334425323225323331653236326125323225323073746f702d6f7061636974792533442532322e363225323225324625334525334373746f702532306f66667365742533442532322e3525323225323073746f702d636f6c6f7225334425323225323333306435005d01fe623025323225324625334525334373746f702532306f66667365742533442532322e393425323225323073746f702d636f6c6f7225334425323225323331653236326125323225323073746f702d6f7061636974792533442532322e363225323225324625334525334373746f702532306f66667365742533442532323125005e00ae323225323073746f702d636f6c6f7225334425323225323330623064306625323225323073746f702d6f706163697479253344253232302532322532462533452533432532466c696e6561724772616469656e74253345020689db3c0060028801fe2533436c696e6561724772616469656e742532306964253344253232636f6d6d6f6e2d6c696e65253232253230783125334425323231303425323225323079312533442532323025323225323078322533442532323932302532322532307932253344253232302532322532306772616469656e74556e6974732533442532006101fe327573657253706163654f6e55736525323225334525334373746f702532306f66667365742533442532323025323225323073746f702d636f6c6f7225334425323225323330623064306625323225323073746f702d6f7061636974792533442532323025323225324625334525334373746f702532306f66667365742533006201fe442532322e303625323225323073746f702d636f6c6f7225334425323225323337323762383025323225323073746f702d6f7061636974792533442532322e373825323225324625334525334373746f702532306f66667365742533442532322e3525323225323073746f702d636f6c6f7225334425323225323365316538006301fe653625323225324625334525334373746f702532306f66667365742533442532322e393425323225323073746f702d636f6c6f7225334425323225323337323762383025323225323073746f702d6f7061636974792533442532322e373825323225324625334525334373746f702532306f66667365742533442532323125006401fe323225323073746f702d636f6c6f7225334425323225323330623064306625323225323073746f702d6f706163697479253344253232302532322532462533452533432532466c696e6561724772616469656e742533452533436c696e6561724772616469656e742532306964253344253232746965722d74696c65253232006501fe253230783125334425323230253232253230793125334425323233383625323225323078322533442532323025323225323079322533442532323531382532322532306772616469656e74556e6974732533442532327573657253706163654f6e55736525323225334525334373746f702532306f66667365742533442532006601fe323025323225323073746f702d636f6c6f7225334425323225323365656634663225323225324625334525334373746f702532306f66667365742533442532322e343825323225323073746f702d636f6c6f7225334425323225323362396333633325323225324625334525334373746f702532306f6666736574253344250067008432323125323225323073746f702d636f6c6f722533442532322532333638373237392532322532462533452533432532466c696e6561724772616469656e7425334501fe253343726563742532307769647468253344253232313032342532322532306865696768742533442532323130323425323225323066696c6c25334425323275726c28253233626729253232253246253345253343726563742532307825334425323237362532322532307925334425323237362532322532307769647468006901fe2533442532323837322532322532306865696768742533442532323837322532322532307278253344253232343425323225323066696c6c2533442532322532333131313431372532322532307374726f6b652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225006a01fe324625334525334372656374253230782533442532323130342532322532307925334425323231303425323225323077696474682533442532323831362532322532306865696768742533442532323831362532322532307278253344253232323825323225323066696c6c25334425323225323330623064306625323225006b007232307374726f6b652533442532322532333165323632612532322532307374726f6b652d776964746825334425323232253232253246253345040e8f0389db3ce30e006f0288006d007203165616c0058f0389db3ce30d006f0288006e020689db3c006f028801fe25334370617468253230642533442532324d313034253230313034683831362532322532307374726f6b6525334425323275726c28253233636f6d6d6f6e2d6c696e65292532322532307374726f6b652d7769647468253344253232362532322532307374726f6b652d6c696e65636170253344253232726f756e64253232007001fe25324625334525334370617468253230642533442532324d313034253230393230683831362532322532307374726f6b6525334425323275726c28253233636f6d6d6f6e2d6c696e65292532322532307374726f6b652d7769647468253344253232342532322532307374726f6b652d6c696e65636170253344253232726f00710044756e642532322532306f7061636974792533442532322e3434253232253246253345040889db3c89007302880076008201fe2533437265637425323078253344253232313234253232253230792533442532323132322532322532307769647468253344253232393425323225323068656967687425334425323239342532322532307278253344253232323225323225323066696c6c2533442532322532333131313431372532322532307374726f6b007401fe65253344253232253233316532363261253232253246253345253343672532307472616e73666f726d2533442532326d617472697828302e31363031353625323030253230302532302d302e313630313536253230313330253230323130292532322533452533437061746825323066696c6c25334425323275726c2825320075005e337465616c2925323225323066696c6c2d72756c652533442532326576656e6f64642532322532306425334425323201fe4d3136372e352532303433322e312532304c3333302e352532303433322e312532304c3334362e352532303432392e392532304c3336342e352532303432342e382532304c3338302e352532303431372e372532304c3339332e352532303430392e362532304c3430342e352532303430312e302532304c3431362e302532007701fe303338392e352532304c3432352e382532303337362e352532304c3433352e392532303335382e352532304c3434312e372532303334332e352532304c3434352e392532303332352e352532304c3434362e392532303239362e352532304c3434352e382532303238352e352532304c3434322e382532303237312e352532007801fe304c3433352e372532303235312e352532304c3432352e392532303233332e352532304c3431362e392532303232312e352532304c3430322e352532303230372e312532304c3338372e352532303139362e312532304c3336322e352532303138342e312532304c3334382e352532303138302e312532304c3333342e3525007901fe32303137382e302532304c3232312e352532303137372e322532304c3232302e3525323037392e322532304c3133372e3525323037392e342532304c3133372e322532303133392e352532304c3136362e352532303134302e322532304c3136362e382532303137342e352532304c3133362e352532303137352e31253230007a01fe4c3133352e362532303137342e352532304c3133352e372532303136332e352532304c3133342e352532303136322e382532304c3130342e312532303136332e352532304c3130342e352532303139322e372532304c3133342e352532303139322e392532304c3133352e352532303139332e352532304c3133352e342532007b01fe303232302e352532304c3133362e322532303232312e352532304c3136362e382532303232322e352532304c3136362e352532303235332e302532304c3133352e352532303235332e332532304c3133342e352532303233352e322532304c3130352e352532303233352e312532304c3130342e312532303233362e352532007c01fe304c3130342e332532303236342e352532304c3133342e352532303236352e332532304c3133352e352532303239322e352532304c3139372e352532303239322e372532304c3139382e342532303239332e352532304c3139382e302532303332332e352532304c3136362e382532303332342e352532304c3136372e3325007d01fe32303336342e352532304c3139382e342532303336352e352532304c3139382e332532303339342e352532304c3136362e392532303339352e352532304c3136362e372532303433302e352532304c3136372e352532303433322e312532305a2532304d3130342e352532303430372e362532304c3133342e392532303430007e01fe372e352532304c3133342e352532303337372e372532304c3130342e352532303337372e392532304c3130342e352532303430372e362532305a2532304d3232312e352532303337322e332532304c3232312e352532303233372e322532304c3332322e352532303233372e312532304c3332392e352532303233382e3125007f01fe32304c3334322e352532303234322e312532304c3335322e352532303234372e342532304c3335392e352532303235322e382532304c3336392e362532303236332e352532304c3337372e302532303237352e352532304c3338312e352532303238382e352532304c3338332e312532303239382e352532304c3338322e37008001fe2532303331362e352532304c3337392e372532303332372e352532304c3337342e382532303333382e352532304c3336382e392532303334372e352532304c3335382e352532303335372e392532304c3334342e352532303336362e372532304c3333322e352532303337302e382532304c3332322e352532303337322e34008100f22532304c3232312e352532303337322e332532305a2532304d36352e352532303332342e332532304c39332e352532303332342e332532304c39332e392532303239342e352532304c36342e392532303239342e352532304c36342e362532303332322e352532304c36352e352532303332342e332532305a0412db3c89db3c5616c004028800830288008501fe2532322532462533452533432532466725334525334374657874253230782533442532323234342532322532307925334425323231373625323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230008400a0666f6e742d73697a652533442532323334253232253230666f6e742d776569676874253344253232383030253232253345506c6174686f253230757365726e616d657325334325324674657874253345040e8f0389db3ce30e00860288008c009a01fe253343726563742532307825334425323237333225323225323079253344253232313334253232253230776964746825334425323231353625323225323068656967687425334425323235382532322532307278253344253232313225323225323066696c6c2533442532322532333137313330622532322532307374726f008701fe6b652533442532322532336437616435372532322532307374726f6b652d6f7061636974792533442532322e363825323225324625334525334374657874253230782533442532323831302532322532307925334425323231373325323225323066696c6c253344253232253233663063373662253232253230666f6e742d008801fe66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323235253232253230666f6e742d776569676874253344253232393030253232253230746578742d616e63686f722533442532326d6964646c6525323225334545504943253343253246746578008901fe74253345253343636972636c65253230637825334425323235313225323225323063792533442532323531322532322532307225334425323232383025323225323066696c6c2533442532326e6f6e652532322532307374726f6b652533442532322532336437616435372532322532307374726f6b652d77696474682533008a01fe44253232322532322532306f7061636974792533442532322e3039253232253246253345253343636972636c65253230637825334425323235313225323225323063792533442532323531322532322532307225334425323232313825323225323066696c6c2533442532326e6f6e652532322532307374726f6b65253344008b00882532322532336630633736622532322532307374726f6b652d7769647468253344253232322532322532306f7061636974792533442532322e313325323225324625334503165616c0058f0389db3ce30d008d0288009301fe253343726563742532307825334425323237333225323225323079253344253232313334253232253230776964746825334425323231353625323225323068656967687425334425323235382532322532307278253344253232313225323225323066696c6c2533442532322532333131313431372532322532307374726f008e01fe6b6525334425323225323332383331333625323225324625334525334374657874253230782533442532323831302532322532307925334425323231373325323225323066696c6c253344253232253233393661313963253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d73657269008f01fe66253232253230666f6e742d73697a652533442532323235253232253230666f6e742d776569676874253344253232393030253232253230746578742d616e63686f722533442532326d6964646c65253232253345434f4d4d4f4e25334325324674657874253345253343636972636c652532306378253344253232353132009001fe25323225323063792533442532323531322532322532307225334425323232383025323225323066696c6c2533442532326e6f6e652532322532307374726f6b652533442532322532333330643562302532322532307374726f6b652d7769647468253344253232322532322532306f7061636974792533442532322e3039009101fe253232253246253345253343636972636c65253230637825334425323235313225323225323063792533442532323531322532322532307225334425323232313825323225323066696c6c2533442532326e6f6e652532322532307374726f6b652533442532322532333636373236642532322532307374726f6b652d776900920052647468253344253232322532322532306f7061636974792533442532322e3133253232253246253345020689db3c0094028801fe253343726563742532307825334425323237333225323225323079253344253232313334253232253230776964746825334425323231353625323225323068656967687425334425323235382532322532307278253344253232313225323225323066696c6c2533442532322532333134313731612532322532307374726f009501fe6b652533442532322532336239633363332532322532307374726f6b652d6f7061636974792533442532322e363825323225324625334525334374657874253230782533442532323831302532322532307925334425323231373325323225323066696c6c253344253232253233643965306466253232253230666f6e742d009601fe66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323235253232253230666f6e742d776569676874253344253232393030253232253230746578742d616e63686f722533442532326d6964646c6525323225334552415245253343253246746578009701fe74253345253343636972636c65253230637825334425323235313225323225323063792533442532323531322532322532307225334425323232383025323225323066696c6c2533442532326e6f6e652532322532307374726f6b652533442532322532336239633363332532322532307374726f6b652d77696474682533009801fe44253232322532322532306f7061636974792533442532322e3039253232253246253345253343636972636c65253230637825334425323235313225323225323063792533442532323531322532322532307225334425323232313825323225323066696c6c2533442532326e6f6e652532322532307374726f6b65253344009900882532322532336439653064662532322532307374726f6b652d7769647468253344253232322532322532306f7061636974792533442532322e3133253232253246253345047e89db3c1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e11175617db3c8ba253343253246672533458009b0288009d015101fe25334372656374253230782533442532323132322532322532307925334425323233313225323225323077696474682533442532323738302532322532306865696768742533442532323335302532322532307278253344253232333225323225323066696c6c25334425323225323331313134313725323225323066696c009c00ac6c2d6f7061636974792533442532322e39342532322532307374726f6b652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334367253345046201d07022c0048e88329321c1048ae85be022c0058e88329321c1058ae85be022c1098e88935302b98ae85f03e09320c108009e00ac00bd00f202fcd3071116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117015618011118db3c1117a4111511171115111411161114009f01c00422218f05318901db3ce121c001e30221c00200a0015000a200a501fe25334372656374253230782533442532323136392532322532307925334425323233373425323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232323025323225323066696c6c25334425323225323331353161316425323225323073747200a101fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323234352532322532307925334425323234373825323225323066696c6c25334425323225323366346637663525323225323000ab020a318901db3c00a3015001fe25334372656374253230782533442532323334372532322532307925334425323233373425323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232323025323225323066696c6c25334425323225323331353161316425323225323073747200a401fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323432332532322532307925334425323234373825323225323066696c6c25334425323225323366346637663525323225323000ab031c8f05318901db3ce001c003e3023000a6015000a801fe25334372656374253230782533442532323532352532322532307925334425323233373425323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232323025323225323066696c6c25334425323225323331353161316425323225323073747200a701fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323630312532322532307925334425323234373825323225323066696c6c25334425323225323366346637663525323225323000ab02088901db3c00a9015001fe25334372656374253230782533442532323730332532322532307925334425323233373425323225323077696474682533442532323135322532322532306865696768742533442532323135322532322532307278253344253232323025323225323066696c6c25334425323225323331353161316425323225323073747200aa01fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323737392532322532307925334425323234373825323225323066696c6c25334425323225323366346637663525323225323000ab00ee666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323937253232253230666f6e742d776569676874253344253232383530253232253230746578742d616e63686f722533442532326d6964646c6525323225334502fcd3071116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117015618011118db3c1117a411151117111511141116111400ad01c00422218f05318901db3ce121c001e30221c00200ae015000b000b301fe25334372656374253230782533442532323136322532322532307925334425323233383625323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232313725323225323066696c6c25334425323225323331353161316425323225323073747200af01fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323232382532322532307925334425323234373625323225323066696c6c25334425323225323366346637663525323225323000bc020a318901db3c00b1015001fe25334372656374253230782533442532323330342532322532307925334425323233383625323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232313725323225323066696c6c25334425323225323331353161316425323225323073747200b201fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323337302532322532307925334425323234373625323225323066696c6c25334425323225323366346637663525323225323000bc04208f05318901db3ce021c003e30201c00400b4015000b600b901fe25334372656374253230782533442532323434362532322532307925334425323233383625323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232313725323225323066696c6c25334425323225323331353161316425323225323073747200b501fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323531322532322532307925334425323234373625323225323066696c6c25334425323225323366346637663525323225323000bc020a318901db3c00b7015001fe25334372656374253230782533442532323538382532322532307925334425323233383625323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232313725323225323066696c6c25334425323225323331353161316425323225323073747200b801fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323635342532322532307925334425323234373625323225323066696c6c25334425323225323366346637663525323225323000bc02108f048901db3ce03000ba015001fe25334372656374253230782533442532323733302532322532307925334425323233383625323225323077696474682533442532323133322532322532306865696768742533442532323133322532322532307278253344253232313725323225323066696c6c25334425323225323331353161316425323225323073747200bb01fe6f6b6525334425323275726c28253233746965722d74696c65292532322532307374726f6b652d77696474682533442532323425323225324625334525334374657874253230782533442532323739362532322532307925334425323234373625323225323066696c6c25334425323225323366346637663525323225323000bc00ee666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323834253232253230666f6e742d776569676874253344253232383530253232253230746578742d616e63686f722533442532326d6964646c6525323225334502f801d3071116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a091118090811170807111907061118060511170504111904031118030211170201111901561801561801111bdb3c1116a411151118111500be01e7032aeda2edfb22c006e30022c007e30002c008915be30d00bf00c500da0428218f086c218901db3cdb31e121c001e30221c00200de015000c000c102106c218901db3cdb3100e1015004268f086c218901db3cdb31e021c003e30221c00400e4015000c200c302106c218901db3cdb3100e7015003208f086c218901db3cdb31e021c005e30200ea015000c402106c218901db3cdb3100ed01500428218f086c218901db3cdb31e121c001e30221c00200c6015000c800cb01fe2533437265637425323078253344253232323038253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00c701fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323234382532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02106c218901db3cdb3100c9015001fe2533437265637425323078253344253232323936253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00ca01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323333362532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04268f086c218901db3cdb31e021c003e30221c00400cc015000ce00d101fe2533437265637425323078253344253232333834253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00cd01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323432342532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02106c218901db3cdb3100cf015001fe2533437265637425323078253344253232343732253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00d001fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323531322532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04268f086c218901db3cdb31e021c005e30221c00600d2015000d400d701fe2533437265637425323078253344253232353630253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00d301fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323630302532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02106c218901db3cdb3100d5015001fe2533437265637425323078253344253232363438253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00d601fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323638382532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02168f086c218901db3cdb31e000d8015001fe2533437265637425323078253344253232373336253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00d901fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323737362532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f0426208f07308901db3cdb31e120c001e30220c00200db015000dd00e001fe2533437265637425323078253344253232313634253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00dc01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323230342532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020e308901db3cdb3100de015001fe2533437265637425323078253344253232323532253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00df01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323239322532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04248f07308901db3cdb31e020c003e30220c00400e1015000e300e601fe2533437265637425323078253344253232333430253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00e201fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323338302532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020e308901db3cdb3100e4015001fe2533437265637425323078253344253232343238253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00e501fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323436382532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04248f07308901db3cdb31e020c005e30220c00600e7015000e900ec01fe2533437265637425323078253344253232353136253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00e801fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323535362532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020e308901db3cdb3100ea015001fe2533437265637425323078253344253232363034253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00eb01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323634342532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f031e8f07308901db3cdb31e0c007e3023000ed015000ef01fe2533437265637425323078253344253232363932253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00ee01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323733322532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020c8901db3cdb3100f0015001fe2533437265637425323078253344253232373830253232253230792533442532323431382532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00f101fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323832302532322532307925334425323234373425323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f021e8ae8307002a6f8935320b98ae85f0300f3010c02fe01d3071116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a091118090811170807111907061118060511170504111904031118030211170201111901561701111adb3c1116a411151118111511141117111400f401fa0422218f05318901db3ce121c001e30221c00200f5015000f700fa01fe2533437265637425323078253344253232313634253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00f601fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323230342532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020a318901db3c00f8015001fe2533437265637425323078253344253232323532253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00f901fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323239322532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04208f05318901db3ce021c003e30221c00400fb015000fd010001fe2533437265637425323078253344253232333430253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00fc01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323338302532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020a318901db3c00fe015001fe2533437265637425323078253344253232343238253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b00ff01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323436382532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04208f05318901db3ce021c005e30221c006010101500103010601fe2533437265637425323078253344253232353136253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b010201fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323535362532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020a318901db3c0104015001fe2533437265637425323078253344253232363034253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b010501fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323634342532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f031c8f05318901db3ce001c007e3023001070150010901fe2533437265637425323078253344253232363932253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b010801fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323733322532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02088901db3c010a015001fe2533437265637425323078253344253232373830253232253230792533442532323337322532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b010b01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323832302532322532307925334425323234323825323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02f801d3071116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a091118090811170807111907061118060511170504111904031118030211170201111901561701561901111bdb3c1117a4111511181115010d0231043ceda2edfb22c0018f0c218f086c218901db3cdb31e1de22c002e30022c003012c0150010e010f0322218f086c218901db3cdb31e121c001e30201410150011f041ee30022c004e30022c005e30022c006011001120116011b0428218f086c218901db3cdb31e121c001e30221c00201290150012b011102168f086c218901db3cdb31e0012f01500428218f086c218901db3cdb31e121c001e30221c002013e01500113011402106c218901db3cdb310141015003208f086c218901db3cdb31e021c003e30201440150011502106c218901db3cdb31014701500428218f086c218901db3cdb31e121c001e30221c002012601500117011802106c218901db3cdb310129015004268f086c218901db3cdb31e021c003e30221c004012c01500119011a02106c218901db3cdb31012f015002168f086c218901db3cdb31e001320150031ce30022c007e30002c008915be30d011c012201370428218f086c218901db3cdb31e121c001e30221c002013b0150011d011e02106c218901db3cdb31013e015004268f086c218901db3cdb31e021c003e30221c00401410150011f012002106c218901db3cdb310144015003208f086c218901db3cdb31e021c005e30201470150012102106c218901db3cdb31014a01500428218f086c218901db3cdb31e121c001e30221c002012301500125012801fe2533437265637425323078253344253232323038253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b012401fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323234382532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02106c218901db3cdb310126015001fe2533437265637425323078253344253232323936253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b012701fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323333362532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04268f086c218901db3cdb31e021c003e30221c00401290150012b012e01fe2533437265637425323078253344253232333834253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b012a01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323432342532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02106c218901db3cdb31012c015001fe2533437265637425323078253344253232343732253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b012d01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323531322532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04268f086c218901db3cdb31e021c005e30221c006012f01500131013401fe2533437265637425323078253344253232353630253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b013001fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323630302532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02106c218901db3cdb310132015001fe2533437265637425323078253344253232363438253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b013301fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323638382532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f02168f086c218901db3cdb31e00135015001fe2533437265637425323078253344253232373336253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b013601fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323737362532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f0426208f07308901db3cdb31e120c001e30220c00201380150013a013d01fe2533437265637425323078253344253232313634253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b013901fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323230342532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020e308901db3cdb31013b015001fe2533437265637425323078253344253232323532253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b013c01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323239322532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04248f07308901db3cdb31e020c003e30220c004013e01500140014301fe2533437265637425323078253344253232333430253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b013f01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323338302532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020e308901db3cdb310141015001fe2533437265637425323078253344253232343238253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b014201fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323436382532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f04248f07308901db3cdb31e020c005e30220c006014401500146014901fe2533437265637425323078253344253232353136253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b014501fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323535362532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020e308901db3cdb310147015001fe2533437265637425323078253344253232363034253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b014801fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323634342532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f031e8f07308901db3cdb31e0c007e30230014a0150014c01fe2533437265637425323078253344253232363932253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b014b01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323733322532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f020c8901db3cdb31014d015001fe2533437265637425323078253344253232373830253232253230792533442532323436342532322532307769647468253344253232383025323225323068656967687425334425323238302532322532307278253344253232313325323225323066696c6c2533442532322532333135316131642532322532307374726f6b014e01fe652533442532322532333238333133362532322532307374726f6b652d77696474682533442532323225323225324625334525334374657874253230782533442532323832302532322532307925334425323235323025323225323066696c6c253344253232253233663466376635253232253230666f6e742d66616d696c014f00da79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a652533442532323532253232253230666f6e742d776569676874253344253232383530253232253230746578742d616e63686f722533442532326d6964646c65253232253345032e59db3c01db3c8bd253343253246746578742533458db3c0288024702880418db3c5616c004e30f5616c0040288015201540159020689db3c0153028801fe25334374657874253230782533442532323531322532322532307925334425323235393225323225323066696c6c253344253232253233663063373662253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323234342532015803165616c0058f0389db3ce30d01550288015601fe25334374657874253230782533442532323531322532322532307925334425323235393225323225323066696c6c253344253232253233333064356230253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343425320158020689db3c0157028801fe25334374657874253230782533442532323531322532322532307925334425323235393225323225323066696c6c253344253232253233643965306466253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a65253344253232343425320158009832253230666f6e742d776569676874253344253232383530253232253230746578742d616e63686f722533442532326d6964646c652532322533452e6174682533432532467465787425334504128f0389db3ce30e5616015a0288015c016301fe25334370617468253230642533442532324d313736253230363132683637322532322532307374726f6b652533442532322532336437616435372532322532307374726f6b652d7769647468253344253232342532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f706163697479015b01fe2533442532322e373025323225324625334525334374657874253230782533442532323531322532322532307925334425323236343025323225323066696c6c253344253232253233623761613865253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d736572696625323225323066016203165616c0058f0389db3ce30d015d0288015f01fe25334370617468253230642533442532324d313736253230363132683637322532322532307374726f6b652533442532322532333330643562302532322532307374726f6b652d7769647468253344253232342532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f706163697479015e01fe2533442532322e363525323225324625334525334374657874253230782533442532323531322532322532307925334425323236343025323225323066696c6c253344253232253233393661313963253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230660162020689db3c0160028801fe25334370617468253230642533442532324d313736253230363132683637322532322532307374726f6b652533442532322532336239633363332532322532307374726f6b652d7769647468253344253232342532322532307374726f6b652d6c696e65636170253344253232726f756e642532322532306f706163697479016101fe2533442532322e373025323225324625334525334374657874253230782533442532323531322532322532307925334425323236343025323225323066696c6c253344253232253233616562386238253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230660162009a6f6e742d73697a652533442532323234253232253230666f6e742d776569676874253344253232383030253232253230746578742d616e63686f722533442532326d6964646c6525323225334504c4db3c1116c1068eaa8d08494c8c131155151154894c8c1554d15493905351494cd0c94c919d195e1d094cd16001111601db3c8ead8d09094c8c10d210549050d51154894c8c1554d15493905351494cd0c94c919d195e1d094cd16001111601db3ce20244028802880164027e89db3c1114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441300165028801fe25334374657874253230782533442532323531322532322532307925334425323237363025323225323066696c6c253344253232253233363637323664253232253230666f6e742d66616d696c79253344253232417269616c25324373616e732d7365726966253232253230666f6e742d73697a6525334425323232342532016600ec32253230666f6e742d776569676874253344253232373530253232253230746578742d616e63686f722533442532326d6964646c652532322533457472616e7366657261626c652532306f6e2d636861696e2532306964656e746974792533432532467465787425334525334325324673766725334502f8031119030211160201111a01206e953059f45b30944133f417e21112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544300211160211178307111782f0d9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e41117db3c016802580142c87001cb076f00016f8c6d6f8c59db3c6f2201c993216eb396016f2259ccc9e831016904da1115111711151114111611141113111711131112111611121111111711111110111611100f11170f0e11160e0d11170d0c11160c0b11170b0a11160a09111709081116080711170706111606051117050411160403111703021116020111170111165616db3c89db3c5616c004016a018002880183030e8912db3c21c004016b0288016f01fe3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130323420313032342220726f6c653d22696d67223e3c646566733e3c6c696e6561724772616469656e742069643d226267222078313d2230222079313d2230222078323d2230222079016c01fe323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223306431313133222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222f3e3c2f6c696e6561724772616469656e743e3c6c696e6561724772616469656e742069643d227465616c2220016d01fe78313d2230222079313d2231222078323d2231222079323d2230223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223326265366164222f3e3c73746f70206f66667365743d222e3535222073746f702d636f6c6f723d2223333064356230222f3e3c73746f70206f66667365743d223122207374016e004a6f702d636f6c6f723d2223323563393962222f3e3c2f6c696e6561724772616469656e743e04228f043189db3ce30e8b73c2f646566733e8017002880175025401fe3c6c696e6561724772616469656e742069643d22636f6d6d6f6e2d6c696e65222078313d22313034222079313d2230222078323d22393230222079323d223022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d222330017101fe6230643066222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e3036222073746f702d636f6c6f723d2223386436373237222073746f702d6f7061636974793d222e3734222f3e3c73746f70206f66667365743d222e35222073746f702d636f6c6f723d2223663063373662222f3e3c73017201fe746f70206f66667365743d222e3934222073746f702d636f6c6f723d2223386436373237222073746f702d6f7061636974793d222e3734222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222073746f702d6f7061636974793d2230222f3e3c2f6c696e6561724772616469017301fe656e743e3c6c696e6561724772616469656e742069643d22746965722d74696c65222078313d2230222079313d22333734222078323d2230222079323d2235323622206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d22017400d623663664393862222f3e3c73746f70206f66667365743d222e3438222073746f702d636f6c6f723d2223643761643537222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223386436373237222f3e3c2f6c696e6561724772616469656e743e031401c0058f0389db3ce30d01760288017a01fe3c6c696e6561724772616469656e742069643d22636f6d6d6f6e2d6c696e65222078313d22313034222079313d2230222078323d22393230222079323d223022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d222330017701fe6230643066222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e3036222073746f702d636f6c6f723d2223316532363261222073746f702d6f7061636974793d222e3632222f3e3c73746f70206f66667365743d222e35222073746f702d636f6c6f723d2223333064356230222f3e3c73017801fe746f70206f66667365743d222e3934222073746f702d636f6c6f723d2223316532363261222073746f702d6f7061636974793d222e3632222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222073746f702d6f7061636974793d2230222f3e3c2f6c696e656172477261646901790008656e743e020689db3c017b028801fe3c6c696e6561724772616469656e742069643d22636f6d6d6f6e2d6c696e65222078313d22313034222079313d2230222078323d22393230222079323d223022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d222330017c01fe6230643066222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e3036222073746f702d636f6c6f723d2223373237623830222073746f702d6f7061636974793d222e3738222f3e3c73746f70206f66667365743d222e35222073746f702d636f6c6f723d2223653165386536222f3e3c73017d01fe746f70206f66667365743d222e3934222073746f702d636f6c6f723d2223373237623830222073746f702d6f7061636974793d222e3738222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222073746f702d6f7061636974793d2230222f3e3c2f6c696e6561724772616469017e01fe656e743e3c6c696e6561724772616469656e742069643d22746965722d74696c65222078313d2230222079313d22333836222078323d2230222079323d2235313822206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d22017f00d623656566346632222f3e3c73746f70206f66667365743d222e3438222073746f702d636f6c6f723d2223623963336333222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223363837323739222f3e3c2f6c696e6561724772616469656e743e01fe3c726563742077696474683d223130323422206865696768743d2231303234222066696c6c3d2275726c2823626729222f3e3c7265637420783d2237362220793d223736222077696474683d2238373222206865696768743d22383732222072783d223434222066696c6c3d222331313134313722207374726f6b653d2223018101fe32383331333622207374726f6b652d77696474683d2232222f3e3c7265637420783d223130342220793d22313034222077696474683d2238313622206865696768743d22383136222072783d223238222066696c6c3d222330623064306622207374726f6b653d222331653236326122207374726f6b652d77696474683d220182000832222f3e040e8f0389db3ce30e018602880184018803165616c0058f0389db3ce30d018602880185020689db3c0186028801fe3c7061746820643d224d313034203130346838313622207374726f6b653d2275726c2823636f6d6d6f6e2d6c696e652922207374726f6b652d77696474683d223622207374726f6b652d6c696e656361703d22726f756e64222f3e3c7061746820643d224d313034203932306838313622207374726f6b653d2275726c28230187008a636f6d6d6f6e2d6c696e652922207374726f6b652d77696474683d223422207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3434222f3e040889db3c8901890288018b019501fe3c7265637420783d223132342220793d22313232222077696474683d22393422206865696768743d223934222072783d223232222066696c6c3d222331313134313722207374726f6b653d2223316532363261222f3e3c67207472616e73666f726d3d226d617472697828302e31363031353620302030202d302e31363031018a00783536203133302032313029223e3c706174682066696c6c3d2275726c28237465616c29222066696c6c2d72756c653d226576656e6f64642220643d2201fe4d3136372e35203433322e31204c3333302e35203433322e31204c3334362e35203432392e39204c3336342e35203432342e38204c3338302e35203431372e37204c3339332e35203430392e36204c3430342e35203430312e30204c3431362e30203338392e35204c3432352e38203337362e35204c3433352e3920333538018c01fe2e35204c3434312e37203334332e35204c3434352e39203332352e35204c3434362e39203239362e35204c3434352e38203238352e35204c3434322e38203237312e35204c3433352e37203235312e35204c3432352e39203233332e35204c3431362e39203232312e35204c3430322e35203230372e31204c3338372e3520018d01fe3139362e31204c3336322e35203138342e31204c3334382e35203138302e31204c3333342e35203137382e30204c3232312e35203137372e32204c3232302e352037392e32204c3133372e352037392e34204c3133372e32203133392e35204c3136362e35203134302e32204c3136362e38203137342e35204c3133362e35018e01fe203137352e31204c3133352e36203137342e35204c3133352e37203136332e35204c3133342e35203136322e38204c3130342e31203136332e35204c3130342e35203139322e37204c3133342e35203139322e39204c3133352e35203139332e35204c3133352e34203232302e35204c3133362e32203232312e35204c3136018f01fe362e38203232322e35204c3136362e35203235332e30204c3133352e35203235332e33204c3133342e35203233352e32204c3130352e35203233352e31204c3130342e31203233362e35204c3130342e33203236342e35204c3133342e35203236352e33204c3133352e35203239322e35204c3139372e35203239322e3720019001fe4c3139382e34203239332e35204c3139382e30203332332e35204c3136362e38203332342e35204c3136372e33203336342e35204c3139382e34203336352e35204c3139382e33203339342e35204c3136362e39203339352e35204c3136362e37203433302e35204c3136372e35203433322e31205a204d3130342e352034019101fe30372e36204c3133342e39203430372e35204c3133342e35203337372e37204c3130342e35203337372e39204c3130342e35203430372e36205a204d3232312e35203337322e33204c3232312e35203233372e32204c3332322e35203233372e31204c3332392e35203233382e31204c3334322e35203234322e31204c3335019201fe322e35203234372e34204c3335392e35203235322e38204c3336392e36203236332e35204c3337372e30203237352e35204c3338312e35203238382e35204c3338332e31203239382e35204c3338322e37203331362e35204c3337392e37203332372e35204c3337342e38203333382e35204c3336382e39203334372e3520019301fe4c3335382e35203335372e39204c3334342e35203336362e37204c3333322e35203337302e38204c3332322e35203337322e34204c3232312e35203337322e33205a204d36352e35203332342e33204c39332e35203332342e33204c39332e39203239342e35204c36342e39203239342e35204c36342e36203332322e35200194001a4c36352e35203332342e33205a0412db3c89db3c5616c004028801960288019801fe222f3e3c2f673e3c7465787420783d223234342220793d22313736222066696c6c3d22236634663766352220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2233342220666f6e742d7765696768743d22383030223e506c6174686f20757365726e616d65733c2f74019700086578743e040e8f0389db3ce30e01990288019d01a701fe3c7265637420783d223733322220793d22313334222077696474683d2231353622206865696768743d223538222072783d223132222066696c6c3d222331373133306222207374726f6b653d222364376164353722207374726f6b652d6f7061636974793d222e3638222f3e3c7465787420783d223831302220793d223137019a01fe33222066696c6c3d22236630633736622220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232352220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e455049433c2f746578743e3c636972636c652063783d2235019b01fe3132222063793d223531322220723d22323830222066696c6c3d226e6f6e6522207374726f6b653d222364376164353722207374726f6b652d77696474683d223222206f7061636974793d222e3039222f3e3c636972636c652063783d22353132222063793d223531322220723d22323138222066696c6c3d226e6f6e6522019c0064207374726f6b653d222366306337366222207374726f6b652d77696474683d223222206f7061636974793d222e3133222f3e03165616c0058f0389db3ce30d019e028801a201fe3c7265637420783d223733322220793d22313334222077696474683d2231353622206865696768743d223538222072783d223132222066696c6c3d222331313134313722207374726f6b653d2223323833313336222f3e3c7465787420783d223831302220793d22313733222066696c6c3d22233936613139632220666f6e019f01fe742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232352220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e434f4d4d4f4e3c2f746578743e3c636972636c652063783d22353132222063793d223531322220723d2232383001a001fe222066696c6c3d226e6f6e6522207374726f6b653d222333306435623022207374726f6b652d77696474683d223222206f7061636974793d222e3039222f3e3c636972636c652063783d22353132222063793d223531322220723d22323138222066696c6c3d226e6f6e6522207374726f6b653d222336363732366422207301a1003e74726f6b652d77696474683d223222206f7061636974793d222e3133222f3e020689db3c01a3028801fe3c7265637420783d223733322220793d22313334222077696474683d2231353622206865696768743d223538222072783d223132222066696c6c3d222331343137316122207374726f6b653d222362396333633322207374726f6b652d6f7061636974793d222e3638222f3e3c7465787420783d223831302220793d22313701a401fe33222066696c6c3d22236439653064662220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232352220666f6e742d7765696768743d223930302220746578742d616e63686f723d226d6964646c65223e524152453c2f746578743e3c636972636c652063783d223501a501fe3132222063793d223531322220723d22323830222066696c6c3d226e6f6e6522207374726f6b653d222362396333633322207374726f6b652d77696474683d223222206f7061636974793d222e3039222f3e3c636972636c652063783d22353132222063793d223531322220723d22323138222066696c6c3d226e6f6e652201a60064207374726f6b653d222364396530646622207374726f6b652d77696474683d223222206f7061636974793d222e3133222f3e047289db3c1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e11175617db3c8b43c2f673e801a8028801a9023200fe3c7265637420783d223132322220793d22333132222077696474683d2237383022206865696768743d22333530222072783d223332222066696c6c3d2223313131343137222066696c6c2d6f7061636974793d222e393422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c673e046201d07022c0048e88329321c1048ae85be022c0058e88329321c1058ae85be022c1098e88935302b98ae85f03e09320c10801aa01b401c101e802fcd3071116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117015618011118db3c1117a411151117111511141116111401ab01c00422218f05318901db3ce121c001e30221c00201ac023001ad01af01fe3c7265637420783d223136392220793d22333734222077696474683d2231353222206865696768743d22313532222072783d223230222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22323435222001b3020a318901db3c01ae023001fe3c7265637420783d223334372220793d22333734222077696474683d2231353222206865696768743d22313532222072783d223230222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22343233222001b3031c8f05318901db3ce001c003e3023001b0023001b101fe3c7265637420783d223532352220793d22333734222077696474683d2231353222206865696768743d22313532222072783d223230222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22363031222001b302088901db3c01b2023001fe3c7265637420783d223730332220793d22333734222077696474683d2231353222206865696768743d22313532222072783d223230222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22373739222001b300d8793d22343738222066696c6c3d22236634663766352220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2239372220666f6e742d7765696768743d223835302220746578742d616e63686f723d226d6964646c65223e02fcd3071116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a0911170908111808071117070611180605111705041118040311170302111802011117015618011118db3c1117a411151117111511141116111401b501c00422218f05318901db3ce121c001e30221c00201b6023001b701b901fe3c7265637420783d223136322220793d22333836222077696474683d2231333222206865696768743d22313332222072783d223137222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22323238222001bf020a318901db3c01b8023001fe3c7265637420783d223330342220793d22333836222077696474683d2231333222206865696768743d22313332222072783d223137222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22333730222001bf04208f05318901db3ce021c003e30201c00401ba023001bb01bd01fe3c7265637420783d223434362220793d22333836222077696474683d2231333222206865696768743d22313332222072783d223137222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22353132222001bf020a318901db3c01bc023001fe3c7265637420783d223538382220793d22333836222077696474683d2231333222206865696768743d22313332222072783d223137222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22363534222001bf02108f048901db3ce03001be023001fe3c7265637420783d223733302220793d22333836222077696474683d2231333222206865696768743d22313332222072783d223137222066696c6c3d222331353161316422207374726f6b653d2275726c2823746965722d74696c652922207374726f6b652d77696474683d2234222f3e3c7465787420783d22373936222001bf00d8793d22343736222066696c6c3d22236634663766352220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2238342220666f6e742d7765696768743d223835302220746578742d616e63686f723d226d6964646c65223e00721113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544030202f801d3071116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a091118090811170807111907061118060511170504111904031118030211170201111901561801561801111bdb3c1116a411151118111501c201e7032aeda2edfb22c006e30022c007e30002c008915be30d01c301c901d70428218f086c218901db3cdb31e121c001e30221c00201da023001c401c502106c218901db3cdb3101dc023004268f086c218901db3cdb31e021c003e30221c00401de023001c601c702106c218901db3cdb3101e0023003208f086c218901db3cdb31e021c005e30201e2023001c802106c218901db3cdb3101e402300428218f086c218901db3cdb31e121c001e30221c00201ca023001cb01cd01fe3c7265637420783d223230382220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223234382220793d2234373422206669022f02106c218901db3cdb3101cc023001fe3c7265637420783d223239362220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223333362220793d2234373422206669022f04268f086c218901db3cdb31e021c003e30221c00401ce023001cf01d101fe3c7265637420783d223338342220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223432342220793d2234373422206669022f02106c218901db3cdb3101d0023001fe3c7265637420783d223437322220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223531322220793d2234373422206669022f04268f086c218901db3cdb31e021c005e30221c00601d2023001d301d501fe3c7265637420783d223536302220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223630302220793d2234373422206669022f02106c218901db3cdb3101d4023001fe3c7265637420783d223634382220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223638382220793d2234373422206669022f02168f086c218901db3cdb31e001d6023001fe3c7265637420783d223733362220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223737362220793d2234373422206669022f0426208f07308901db3cdb31e120c001e30220c00201d8023001d901db01fe3c7265637420783d223136342220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223230342220793d2234373422206669022f020e308901db3cdb3101da023001fe3c7265637420783d223235322220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223239322220793d2234373422206669022f04248f07308901db3cdb31e020c003e30220c00401dc023001dd01df01fe3c7265637420783d223334302220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223338302220793d2234373422206669022f020e308901db3cdb3101de023001fe3c7265637420783d223432382220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223436382220793d2234373422206669022f04248f07308901db3cdb31e020c005e30220c00601e0023001e101e301fe3c7265637420783d223531362220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223535362220793d2234373422206669022f020e308901db3cdb3101e2023001fe3c7265637420783d223630342220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223634342220793d2234373422206669022f031e8f07308901db3cdb31e0c007e3023001e4023001e501fe3c7265637420783d223639322220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223733322220793d2234373422206669022f020c8901db3cdb3101e6023001fe3c7265637420783d223738302220793d22343138222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223832302220793d2234373422206669022f00821114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454013021e8ae8307002a6f8935320b98ae85f0301e901fb02fe01d3071116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a091118090811170807111907061118060511170504111904031118030211170201111901561701111adb3c1116a411151118111511141117111401ea01fa0422218f05318901db3ce121c001e30221c00201eb023001ec01ee01fe3c7265637420783d223136342220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223230342220793d2234323822206669022f020a318901db3c01ed023001fe3c7265637420783d223235322220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223239322220793d2234323822206669022f04208f05318901db3ce021c003e30221c00401ef023001f001f201fe3c7265637420783d223334302220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223338302220793d2234323822206669022f020a318901db3c01f1023001fe3c7265637420783d223432382220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223436382220793d2234323822206669022f04208f05318901db3ce021c005e30221c00601f3023001f401f601fe3c7265637420783d223531362220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223535362220793d2234323822206669022f020a318901db3c01f5023001fe3c7265637420783d223630342220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223634342220793d2234323822206669022f031c8f05318901db3ce001c007e3023001f7023001f801fe3c7265637420783d223639322220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223733322220793d2234323822206669022f02088901db3c01f9023001fe3c7265637420783d223738302220793d22333732222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223832302220793d2234323822206669022f00761113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645401302f801d3071116111911161115111811151114111711141113111911131112111811121111111711111110111911100f11180f0e11170e0d11190d0c11180c0b11170b0a11190a091118090811170807111907061118060511170504111904031118030211170201111901561701561901111bdb3c1117a411151118111501fc0231043ceda2edfb22c0018f0c218f086c218901db3cdb31e1de22c002e30022c0030218023001fd01fe0322218f086c218901db3cdb31e121c001e30202260230020e041ee30022c004e30022c005e30022c00601ff02010205020a0428218f086c218901db3cdb31e121c001e30221c002021602300217020002168f086c218901db3cdb31e0021a02300428218f086c218901db3cdb31e121c001e30221c002022402300202020302106c218901db3cdb310226023003208f086c218901db3cdb31e021c003e30202280230020402106c218901db3cdb31022a02300428218f086c218901db3cdb31e121c001e30221c002021402300206020702106c218901db3cdb310216023004268f086c218901db3cdb31e021c003e30221c004021802300208020902106c218901db3cdb31021a023002168f086c218901db3cdb31e0021c0230031ce30022c007e30002c008915be30d020b0211021f0428218f086c218901db3cdb31e121c001e30221c00202220230020c020d02106c218901db3cdb310224023004268f086c218901db3cdb31e021c003e30221c00402260230020e020f02106c218901db3cdb310228023003208f086c218901db3cdb31e021c005e302022a0230021002106c218901db3cdb31022c02300428218f086c218901db3cdb31e121c001e30221c002021202300213021501fe3c7265637420783d223230382220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223234382220793d2235323022206669022f02106c218901db3cdb310214023001fe3c7265637420783d223239362220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223333362220793d2235323022206669022f04268f086c218901db3cdb31e021c003e30221c004021602300217021901fe3c7265637420783d223338342220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223432342220793d2235323022206669022f02106c218901db3cdb310218023001fe3c7265637420783d223437322220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223531322220793d2235323022206669022f04268f086c218901db3cdb31e021c005e30221c006021a0230021b021d01fe3c7265637420783d223536302220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223630302220793d2235323022206669022f02106c218901db3cdb31021c023001fe3c7265637420783d223634382220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223638382220793d2235323022206669022f02168f086c218901db3cdb31e0021e023001fe3c7265637420783d223733362220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223737362220793d2235323022206669022f0426208f07308901db3cdb31e120c001e30220c002022002300221022301fe3c7265637420783d223136342220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223230342220793d2235323022206669022f020e308901db3cdb310222023001fe3c7265637420783d223235322220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223239322220793d2235323022206669022f04248f07308901db3cdb31e020c003e30220c004022402300225022701fe3c7265637420783d223334302220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223338302220793d2235323022206669022f020e308901db3cdb310226023001fe3c7265637420783d223432382220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223436382220793d2235323022206669022f04248f07308901db3cdb31e020c005e30220c006022802300229022b01fe3c7265637420783d223531362220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223535362220793d2235323022206669022f020e308901db3cdb31022a023001fe3c7265637420783d223630342220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223634342220793d2235323022206669022f031e8f07308901db3cdb31e0c007e30230022c0230022d01fe3c7265637420783d223639322220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223733322220793d2235323022206669022f020c8901db3cdb31022e023001fe3c7265637420783d223738302220793d22343634222077696474683d22383022206865696768743d223830222072783d223133222066696c6c3d222331353161316422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c7465787420783d223832302220793d2235323022206669022f00c46c6c3d22236634663766352220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2235322220666f6e742d7765696768743d223835302220746578742d616e63686f723d226d6964646c65223e032259db3c01db3c8b73c2f746578743e8db3c02880247028800861114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103640155033040418db3c5616c004e30f5616c004028802330235023a020689db3c0234028801fe3c7465787420783d223531322220793d22353932222066696c6c3d22236630633736622220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2234342220666f6e742d7765696768743d223835302220746578742d616e63686f723d226d6964646c65223e2e6174683c023903165616c0058f0389db3ce30d02360288023701fe3c7465787420783d223531322220793d22353932222066696c6c3d22233330643562302220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2234342220666f6e742d7765696768743d223835302220746578742d616e63686f723d226d6964646c65223e2e6174683c0239020689db3c0238028801fe3c7465787420783d223531322220793d22353932222066696c6c3d22236439653064662220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2234342220666f6e742d7765696768743d223835302220746578742d616e63686f723d226d6964646c65223e2e6174683c0239000c2f746578743e04128f0389db3ce30e5616023b0288023d024301fe3c7061746820643d224d313736203631326836373222207374726f6b653d222364376164353722207374726f6b652d77696474683d223422207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3730222f3e3c7465787420783d223531322220793d22363430222066696c6c3d2223623761023c00b46138652220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232342220666f6e742d7765696768743d223830302220746578742d616e63686f723d226d6964646c65223e03165616c0058f0389db3ce30d023e0288024001fe3c7061746820643d224d313736203631326836373222207374726f6b653d222333306435623022207374726f6b652d77696474683d223422207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3635222f3e3c7465787420783d223531322220793d22363430222066696c6c3d2223393661023f00b43139632220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232342220666f6e742d7765696768743d223830302220746578742d616e63686f723d226d6964646c65223e020689db3c0241028801fe3c7061746820643d224d313736203631326836373222207374726f6b653d222362396333633322207374726f6b652d77696474683d223422207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3730222f3e3c7465787420783d223531322220793d22363430222066696c6c3d2223616562024200b43862382220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232342220666f6e742d7765696768743d223830302220746578742d616e63686f723d226d6964646c65223e049cdb3c1116c1068ea08d05c8131155151154881554d154939053514f0bdd195e1d0fa001111601db3c8ea38d068810d210549050d51154881554d154939053514f0bdd195e1d0fa001111601db3ce20244028802880255021820c209e3007aa908a630db3c0245024702f4207aa904a6301116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a091117090811170807111707061117060511170504111704031117030211170201111701db3c11151116111511141115111402470246003c1113111411131112111311121111111211111110111111100f11100f550e044e20c02d8e86308b12d8db3ce020c0308e86308b1308db3ce020c0318e86308b1318db3ce020c032025402540254024804488e86308b1328db3ce020c0338e86308b1338db3ce020c0348e86308b1348db3ce020c035025402540254024904488e86308b1358db3ce020c0368e86308b1368db3ce020c0378e86308b1378db3ce020c038025402540254024a04488e86308b1388db3ce020c0398e86308b1398db3ce020c05f8e86308b15f8db3ce020c061025402540254024b04488e86308b1618db3ce020c0628e86308b1628db3ce020c0638e86308b1638db3ce020c064025402540254024c04488e86308b1648db3ce020c0658e86308b1658db3ce020c0668e86308b1668db3ce020c067025402540254024d04488e86308b1678db3ce020c0688e86308b1688db3ce020c0698e86308b1698db3ce020c06a025402540254024e04488e86308b16a8db3ce020c06b8e86308b16b8db3ce020c06c8e86308b16c8db3ce020c06d025402540254024f04488e86308b16d8db3ce020c06e8e86308b16e8db3ce020c06f8e86308b16f8db3ce020c070025402540254025004488e86308b1708db3ce020c0718e86308b1718db3ce020c0728e86308b1728db3ce020c073025402540254025104488e86308b1738db3ce020c0748e86308b1748db3ce020c0758e86308b1758db3ce020c076025402540254025204488e86308b1768db3ce020c0778e86308b1778db3ce020c0788e86308b1788db3ce020c079025402540254025302268e86308b1798db3ce0c07a8e858b17a8db3ce0025402540104db3c0288027e89db3c1114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441300256028801fe3c7465787420783d223531322220793d22373630222066696c6c3d22233636373236642220666f6e742d66616d696c793d22417269616c2c73616e732d73657269662220666f6e742d73697a653d2232342220666f6e742d7765696768743d223735302220746578742d616e63686f723d226d6964646c65223e7472616e730257004c66657261626c65206f6e2d636861696e206964656e746974793c2f746578743e3c2f7376673e00b0031118030211170201111601206e953059f45b30944133f417e27001c85902cb07f400c91112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454002f7b13d7b51343480006395fe903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b4adc1c1c151c0014c002044502020444c2020444820204444201c44401c41bc423841f441b0416c412840e5200c0b8c34445044544450444c4450444c4448444c4448444444484446002f2025a01241110111111100f11100f550edb3c6c996cc9025b00a6810101280259f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2206e8e103070705470005300561b044313561c02e06f287f557002016e025d026002f6ab9fed44d0d200018e57fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d2b70707054700053000811140808111308081112080811110807111007106f108e107d106c105b104a1039480302e30d11141115111411131114111311121113111211111112111102f2025e01241110111111100f11100f550edb3c6cc46c94025f0064810101290259f40d6fa192306ddf206e92306d9dd0fa40fa40d33f55206c136f03e2206e9730705615561670e06f237f552002f6aa13ed44d0d200018e57fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d2b70707054700053000811140808111308081112080811110807111007106f108e107d106c105b104a1039480302e30d11141115111411131114111311121113111211111112111102f202690201200262026802f7b6b9dda89a1a400031caff481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadada56e0e0e0a8e000a600102228101022261010222410102222100e22200e20de211c20fa20d820b620942072900605c61a2228222a2228222622282226222422262224222222242223002f20263012e1110111111100f11100f550edb3c571257105f0f35335b026404f41114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405615db3ce3037f1116db3c011116011115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef0272026502660267008c571570701115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103410230060814a4221c203f2f4814a4321c111f2f420c0049930822009184e72a000e0c005978218e8d4a51000e08218174876e800003010de10cd10bc10ab109a108910781067105610451034102302f7b4f47da89a1a400031caff481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadada56e0e0e0a8e000a600102228101022261010222410102222100e22200e20de211c20fa20d820b620942072900605c61a2228222a2228222622282226222422262224222222242223002f2026901281110111111100f11100f550edb3c57105f0f6c51026a0104db3c026b017a814a4c21c200f2f4f828fa4430f82858db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0026c011e88c87001ca005a02ce810101cf00c9026d0114ff00f4a413f4bcf2c80b026e020162026f027c03f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019fd200fa40fa40d3ffd307d455506c168e1cfa40810101d7005902d10181465121c300f2f4702270c8c910351024e207925f07e07026d74920c21f953106d31f07de218210554e494ebae302218210639cfc6cbae3022182105fcc3d14ba02700275027704c05b05fa40d30781465af84226c705f2f481465b27b3f2f410465e32505781465c5197db3c1af2f481465d543968db3c1af2f481465e5198db3c355b335112ba16f2f481465ff8416f24135f0382083d0900bef2f47fc85005cf16c9104510341202d002710273027401deeda2edfb555127db3c936c2670e126d74928aa02bd936c2670e026c702936c2670e170935308b98e3907d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e296306c2670db31e107a4e8303705c700104610354430120272001420c20392c111923070e20020c88210c5cc7cd601cb1f01cf16c9f9000130db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed54027601905b3581466424f2f4814665f8416f24135f0382083d0900bef2f4814666f8416f24135f038209312d00bbf2f410355512db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed540276006a82082dc6c07f715357c8598210bba3ec195003cb1fcbffcec92755304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001b0e3023720821027acdf8bba8e1c303510355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e0c00006c12116b08e1f8146b3f2f010355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e05f06f2c082027804fe5b05d33ffa40fa40f40431fa0081466e29f2f481466ff84229c705f2f410481037465981467051b8db3c1cf2f481467151b7db3c1cf2f481467226c2fff2f4814673f8416f24135f0382081e848028a08208989680a0bef2f45375c20095102a343730e30df8416f24135f0382081e84805005a08208989680a0820186a0a002d002d00279027b018a1045431371502c700cdb3c544b88c85520821005138d915004cb1f12cb3fcecec927104a4d1350cc441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00410805027a001820c700973070c8ca00c9d0e000a814be8e337080407008c8018210d53276db58cb1fcb3fc91046413018441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0013923334e2034445c87f01ca0055505056ca0013cececbffcb07ccc9ed54020120027d02800177be9d6f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3633c027e01285475435475435555db3c106c105b104a10394870027f001a21c0049171e021c0059172e0730177bc7e7f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3632c02810130547523271059104810374698db3c104810374a90106a1059028203f655226d8307507682f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce8906db3c10394870206e953059f45b30944133f417e28307507682f0c9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd10406db3c10394870206e953059f45b30944133f417e270010283028402890026c87001cb0721d0cf1682102e61746801cb1fc90242c87001cb076f00016f8c6d6f8c89db3c6f2201c993216eb396016f2259ccc9e8310285028801fe5072697661746520636f72726573706f6e64656e636520697320612072696768742c206e6f7420612070726976696c6567652e2054686973206973206120757365726e616d65204e465420666f7220506c6174686f20e280942074686520616e6f6e796d6f75732c20706f73742d7175616e74756d2d656e63727970746564028601fe2c20756e63656e736f7261626c65206d657373656e6765722e2041207065726d616e656e742c207472616e7366657261626c652c2066756c6c79206f6e2d636861696e2068616e646c653a20746865206e616d65206f746865727320726561636820796f752062792c2068656c64206279206e6f206f6e652062757420796f0287001a752e20706c6174686f2e61707000b620d74a21d7499720c20022c200b18e48036f22807f22cf31ab02a105ab025155b60820c2009a20aa0215d71803ce4014de596f025341a1c20099c8016f025044a1aa028e123133c20099d430d020d74a21d749927020e2e2e85f030018c85902cb07f400c910364540020120028b02ed020120028c029202d3b60b7da89a1a400031caff481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadada56e0e0e0a8e000a600102228101022261010222410102222100e22200e20de211c20fa20d820b620942072900605c61bb678d9e6d8c7002f2028d02f41113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a09111409111408070655407f1115db3c0111160156121116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd028e029102f61111111411111110111311100f11120f0e11140e0d11130d0c11120c0b11140b0a11130a09111209081114080711130706111206051114050411130403111203021114020111130111126d11158307111582f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce891115db3c03111803028f02900036c87001cb078270506c6174686f20757365726e616d657301cb7fc900a80211170201111601206e953059f45b30944133f417e27001c85902cb07f400c91112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a10691058104710364540002410bc10ab109a108910781067105610451034020166029302ea02f6a821ed44d0d200018e57fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d2b70707054700053000811140808111308081112080811110807111007106f108e107d106c105b104a1039480302e30d11141115111411131114111311121113111211111112111102f2029401281110111111100f11100f550edb3c57105f0f6c5102950104db3c0296016a20fa443070585615db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d00297012488c87001ca0055215023810101cf00cecec902980114ff00f4a413f4bcf2c80b0299020162029a02e404f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba029b02a502a702a804cc058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544815bae3022082104154481dba029c02a0029d029e00e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54015c30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402a004f88eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e02082104154481bba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0208210178d4519bae302208210472d9d7dba02a002a0029f02a2015c30d33ffa00593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402a002ea81378c21c200f2f4f84210685e34103748705280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305167a0f8285220c705b3941028375be30d1045551202df02a1006e7080400a7f0ac8598210415448135003cb1fcb3fcb7fc9134a4019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104503fc8eb830d33fd39f5932813800f84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821089129d60ba8eb830d33fd39f59328138eaf84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e002a402a402a301868210a11a7002ba8eb7d33fd39f593281394ef84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f0702a403a655515376db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2813801216eb3f2f46f25135f0355512981380209db3c29ba18f2f4104810374614403305db3c02e702e102d801fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa0202a60052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001035551202d3043ce30221821041544814bae3022182104154481cbae3022182104154481aba02a902ab02af02b304d25b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f4820adc6c0081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1555029db3c705410b5db3c5551547a9b2f02bb02da02db02aa01fedb3c5159a17f541ba5700fc855308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c47b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010354044c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402de04fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4555129db3c705410b502bb02ac02da02ad003082080f4240a082080f4240a082086acfc0a08209312d00a003fedb3c5551547dcb2ddb3c515ca150dc7f7126544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104d103e4a80103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0302db02de02ae014e01a11047104610354440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402b904fe5b05d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422cc705f2f48138d7535bc705f2f4105b104a103948cd53badb3c55408138d85169db3c17f2f48138d927c200f2f48138da2ac200f2f48138db5357bef2f48138dc2a8209c9c380bef2f4550429db3c208208989680a08138ddf8416f24135f0322bef2f455512d02bb02d002b502b004f4db3c705410f5db3c5551547baf5611db3c515aa1103b102a7f7126045611040311110302111002011114011115c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc9106c105c104a10394a90103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf8102da02db02de02b102668ae2f400c901fb00f8416f24135f035006a146505e21db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402b202b9001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba02b402ba02bd02bf04fc5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422fc705f2f481393b538ec705f2f4105e104d103c102b1110541f0828db3c554081393c516fdb3c17f2f481393d2ac200f2f481393e27c200f2f481393f535abef2f4813940278209c9c380bef2f4550426db3c208208989680a081394102bb02d002b502b6003c82082dc6c0a082080f4240a082086acfc0a08209312d00a082081e8480a00486f8416f24135f0322bef2f455512adb3c705410c5db3c5551547edc2edb3c515da1106e105d7f71536d07106e05111605041115040311140302111302011117011118c802da02db02de02b702e055a0db3cc91035104a10394180103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110471045103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402b802b9005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe5b05d33ffa00fa40fa40f40431fa0081396cf8422ac705f2f410591048103746ab5376db3c81396d29c200f2f481396e5369bef2f481396f2bc000917f972b8209c9c380bee2f2f48209c9c3802ba08209406f40a082081e8480a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1555028db3c705410a502bb02da02bc035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f4550402d002d002d003f0db3c5551547cba2cdb3c515ba14cb07f70264c13011110011111c855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec9106810581047103b4870103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0055200402db02de02d302fe5b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382098cba80bef2f45134a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071077002da02be009e07c8598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010455512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba02c002c502ca02cd04ce5b05d33ffa00fa40fa40fa003081397624c200f2f4813977f842105a1049103847bc29db3c1dc7051bf2f455030981397851b8db3c1cf2f425c2008e1b3781397df8416f24135f0382095ef3c0bef2f45137a01049030604e30df842104710364150544914509902da02d002c102c303ea813979268209c9c380bef2f481397af8416f24135f032782080f4240a082080f4240a082086acfc0a08209312d00a0bef2f45504543a97db3c555053a6db3c81397b248101012359f40c6fa131b3f2f481397c238101012359f40c6fa131b3f2f4516aa081010182080f4240f8232c544c3052f0c802e102e702c200ba55405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544c9052ccc855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec925513d034b9b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001e8db3cf8416f24135f030982080f4240a082080f4240a019be8e3782080f4240717009c8018210d53276db58cb1fcb3fc91048413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001034923535e245334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5402c4006c82080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0004fa5b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a08209312d00a0bef2f410354014503b541a0a2adb3c555053b6db3c8137eb2402da02e102e702c601fc8101012359f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da081010182080f4240f8232e544e30561201c855405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544d9052fec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec9104902c702fc10384b70441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053abc8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407109700bc8598210415448115003cb1fcb3fcb7fc9443049a0441359c8cf8580ca008902c802c9000110005acf16ce01fa02806acf40f400c901fb004430c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404f45b05d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842105d104c103b4aef27db3c01111001c7051ef2f48138e22cc200f2f48138e3f8416f24135f032d82082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030c8138e451ebdb3c1ff2f45504543d7ddb3c5550538602da02d002e102cb02f8db3c8138e5248101012359f40c6fa131b3f2f48138e62e8209c9c380bef2f48138e7238101012359f40c6fa131b3f2f45168a081010182082dc6c0f823561203021112020111120152c01113c855405045ce12cecb3fcb7fcb3fc910344f70206e953059f45a30944133f415e2717f295159105904031111034edcc802e702cc01f05560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07cec9544114103a4c99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004003050402d304f8e30221821041544811ba8f6e5b05d33fd37f308137a021c200f2f4f84210671056104510344880db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137a1216eb3f2f46f2430318137a20aba19f2f48137a3f8425009c70518f2f416810101f45a30104510344130e02102ce02df02d302d402fe5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f84205111005104f103e102d0111110111122adb3c01111301c70501111101f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030f81394811112602da02cf04fcdb3c01111201f2f45504111053a8db3c555053b6db3c813949248101012359f40c6fa131b3f2f481394a298209c9c380bef2f481394b238101012359f40c6fa131b3f2f4516ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb3fc910344a70206e953059f45a30944133f415e2717f2c08517c0702d002e102e702d1000afa4430c00001fe106c05111405041113040311120302111102011110010fc855908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc92643144a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc9443002d20072441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0044145053c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404c28210472d9d7ebae3022182104154481eba8ebb5b05d33fd37fd39f3081380af84227c705f2f41068105710461035103401db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0218210504e5052bae30237c00006c12116b002d502d802e002e304f65b05d33fd37fd39f30813804f84227c705f2f481380522c200f2f410561046103646785368db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206ee3026f2530813807511dbaf2f410591048103746982a81380808db3c500dba16f2f48101015415005467c002e702d602e102d70090303738810101530150884133f40c6fa19401d70030925b6de2813806216eb3f2f481380907ba16f2f445334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400dc216e955b59f45a3098c801cf004133f442e25054810101f45a307108700ac8598210415448115003cb1fcb3fcb7fc9104710364890441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003444405c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403f68137fa21c200f2f455525387db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53bcbef2f48137fd511cbaf2f455448137fe543ad8db3c2dba1bf2f4514aa1508881010102e702e102d904f2f45a3010574014541386db3c705385db3c10685e3410374870545ee9db3c539b82082dc6c0ba955b3839f8288e3d717011112fc8598210415448135003cb1fcb3fcb7fc9104d103e1201111101441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00090c0807e21046103544304970546cb052b002da02db02dc02dd016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d002db0026f82ac87001ca0055215023810101cf00cecec90030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01c4db3c707f541db680400bc855308210415448125005cb1f13cb3fcb7fcecec91069105c104a103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0041050402de01901069105810471039487927db3c813796228101012359f40c6fa131b3f2f4810101f82310394ba0c855305034cececb7fcb3fc910364780206e953059f45a30944133f415e245401202df0026c8821041544f4701cb1f12cb3f01cf16c9f90003f65b05d33fd39f3081380df8416f24135f0382081e8480bef2f454167628db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e281380e216eb3f2f46f2533106a1059104810374a9b81380f08db3c500cba16f2f4813810f8230982015180a019be18f2f48138110602e702e102e2002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f009882082dc6c0bd16f2f48101012010345445135099216e955b59f45a3098c801cf004133f442e25024810101f45a30403305c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400588e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c08202014802e502e8017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c65802e60178db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e983070705456002802e06f25327f04431302e70002310179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c63802e9000654754302f6a83fed44d0d200018e57fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d2b70707054700053000811140808111308081112080811110807111007106f108e107d106c105b104a1039480302e30d11141115111411131114111311121113111211111112111102f202eb01241110111111100f11100f550edb3c6cf36c6302ec0056810101240259f40d6fa192306ddf206e92306d9ad0d37fd33f596c126f02e2206e9430707020e06f227f5902012002ee02f102f7b5531da89a1a400031caff481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadada56e0e0e0a8e000a600102228101022261010222410102222100e22200e20de211c20fa20d820b620942072900605c61a2228222a2228222622282226222422262224222222242223002f202ef01241110111111100f11100f550edb3c6cc46c9402f00064810101260259f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2206e9730707020561701e06f237f552002d3b5f67da89a1a400031caff481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadada56e0e0e0a8e000a600102228101022261010222410102222100e22200e20de211c20fa20d820b620942072900605c61bb678d9fed8df002f202f300ccfa40fa40fa40d401d0fa40d200d200d200d3ffd3ffd33fd33fd430d0d37fd37ff404f404f404d430d0f404d33ff404d33ffa403011121115111211121114111211121113111257151113111411131112111311121111111211111110111111100f11100f550e00382e56115611561056105619561927561356135613561353fd82015180986875c0');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initUsernameRegistry_init_args({ $$type: 'UsernameRegistry_init_args', official_ath_wallet_address, ath_master_address, treasury_ath_receiver_address, sealed, deployment_manifest_hash, genesis_config_hash, genesis_controller_address })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const UsernameRegistry_errors = {
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

export const UsernameRegistry_errors_backward = {
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

const UsernameRegistry_types: ABIType[] = [
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
    {"name":"BindOfficialAthWallet","header":1715335229,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"BindUsernameVault","header":1621496068,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushTreasuryAthDue","header":1621736923,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FlushBurnAthDue","header":3919758027,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PrunePendingUsernameMint","header":932634413,"fields":[{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"UsernameRegistryTopUpStorageReserve","header":179986205,"fields":[]},
    {"name":"PendingUsernameMint","header":null,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"price_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_deploy_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"NameRecord","header":null,"fields":[{"name":"minter_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UsernameRegistryGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_mint_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"burn_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_mint_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernamePriceView","header":null,"fields":[{"name":"valid_length","type":{"kind":"simple","type":"bool","optional":false}},{"name":"price_ath_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameNameRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"minter_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingUsernameMintView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sender_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"price_paid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_deploy_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTreasuryFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthBurnFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthTreasuryFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthBurnFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameCollectionDataView","header":null,"fields":[{"name":"next_item_index","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"collection_content","type":{"kind":"simple","type":"cell","optional":false}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"UsernameCollectionOnchainContent","header":null,"fields":[{"name":"marker","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"metadata","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"cell","valueFormat":"ref"}}]},
    {"name":"UsernameRegistry$Data","header":null,"fields":[{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_ath_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"name_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_mint_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"burn_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"name_records","type":{"kind":"dict","key":"int","value":"NameRecord","valueFormat":"ref"}},{"name":"pending_mints","type":{"kind":"dict","key":"int","value":"PendingUsernameMint","valueFormat":"ref"}},{"name":"pending_item_to_name_hash","type":{"kind":"dict","key":"address","value":"int"}},{"name":"pending_treasury_flushes","type":{"kind":"dict","key":"int","value":"PendingAthTreasuryFlush","valueFormat":"ref"}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_burn_flushes","type":{"kind":"dict","key":"int","value":"PendingAthBurnFlush","valueFormat":"ref"}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}}]},
]

const UsernameRegistry_opcodes = {
    "InitializeUsernameItem": 1431193934,
    "ResendDeployedAck": 1671232620,
    "TopUpStorageReserve": 665640843,
    "UsernameItemDeployedAck": 3148082201,
    "NftTransfer": 1607220500,
    "NftOwnershipAssigned": 85167505,
    "NftExcesses": 3576854235,
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
    "BindOfficialAthWallet": 1715335229,
    "BindUsernameVault": 1621496068,
    "SealGenesis": 974311853,
    "FlushTreasuryAthDue": 1621736923,
    "FlushBurnAthDue": 3919758027,
    "PrunePendingUsernameMint": 932634413,
    "UsernameRegistryTopUpStorageReserve": 179986205,
}

const UsernameRegistry_getters: ABIGetter[] = [
    {"name":"get_username_price","methodId":87502,"arguments":[{"name":"name_len","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"UsernamePriceView","optional":false}},
    {"name":"get_username_item_address","methodId":81427,"arguments":[{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_nft_address_by_index","methodId":92067,"arguments":[{"name":"index","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_nft_content","methodId":68445,"arguments":[{"name":"index","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"individual_content","type":{"kind":"simple","type":"cell","optional":false}}],"returnType":{"kind":"simple","type":"cell","optional":false}},
    {"name":"get_collection_data","methodId":102491,"arguments":[],"returnType":{"kind":"simple","type":"UsernameCollectionDataView","optional":false}},
    {"name":"get_name_record","methodId":80799,"arguments":[{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"UsernameNameRecordView","optional":false}},
    {"name":"get_pending_mint","methodId":70901,"arguments":[{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingUsernameMintView","optional":false}},
    {"name":"get_pending_treasury_flush","methodId":117400,"arguments":[{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthTreasuryFlushView","optional":false}},
    {"name":"get_pending_burn_flush","methodId":109631,"arguments":[{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthBurnFlushView","optional":false}},
    {"name":"get_ath_wallet_address","methodId":108577,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"UsernameRegistryGlobalView","optional":false}},
]

export const UsernameRegistry_getterMapping: { [key: string]: string } = {
    'get_username_price': 'getGetUsernamePrice',
    'get_username_item_address': 'getGetUsernameItemAddress',
    'get_nft_address_by_index': 'getGetNftAddressByIndex',
    'get_nft_content': 'getGetNftContent',
    'get_collection_data': 'getGetCollectionData',
    'get_name_record': 'getGetNameRecord',
    'get_pending_mint': 'getGetPendingMint',
    'get_pending_treasury_flush': 'getGetPendingTreasuryFlush',
    'get_pending_burn_flush': 'getGetPendingBurnFlush',
    'get_ath_wallet_address': 'getGetAthWalletAddress',
    'get_global': 'getGetGlobal',
}

const UsernameRegistry_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindOfficialAthWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindUsernameVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotificationVaultMintUsername"}},
    {"receiver":"internal","message":{"kind":"typed","type":"UsernameItemDeployedAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushTreasuryAthDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushBurnAthDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHTransferFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHBurnFinalized"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ATHBurnFailed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PrunePendingUsernameMint"}},
    {"receiver":"internal","message":{"kind":"typed","type":"UsernameRegistryTopUpStorageReserve"}},
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
export const USERNAME_PRICE_4_CHARS = 10000000000000n;
export const USERNAME_PRICE_5_CHARS = 1000000000000n;
export const USERNAME_PRICE_6_PLUS_CHARS = 100000000000n;
export const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = 6000000n;
export const USERNAME_STATE_GROWTH_EXEC_RESERVE = 4000000n;
export const USERNAME_NFT_ITEM_DEPLOY_RESERVE = 500000000n;
export const USERNAME_ATH_TRANSFER_EXEC_RESERVE = 48000000n;
export const USERNAME_ATH_BURN_EXEC_RESERVE = 5000000n;
export const USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE = 2000000n;
export const USERNAME_ATH_NOTIFICATION_ACK_VALUE = 1000000n;
export const USERNAME_ATH_NOTIFICATION_REFUND_VALUE = 12000000n;
export const USERNAME_PENDING_MINT_STALE_TTL = 86400n;
export const USERNAME_MAX_LENGTH = 16n;
export const USERNAME_SPLIT_BASE_BPS = 10000n;
export const USERNAME_TREASURY_SHARE_BPS = 5000n;
export const USERNAME_NAME_HASH_DOMAIN = 3318512854n;
export const USERNAME_COLLECTION_METADATA_KEY_NAME = 59089242681608890680090686026688704441792375738894456860693970539822503415433n;
export const USERNAME_COLLECTION_METADATA_KEY_IMAGE = 43884663033947008978309661017057008345326326811558777475113826163084742639165n;
export const USERNAME_COLLECTION_METADATA_KEY_IMAGE_DATA = 98449690268711667050166283313913751402364107788915545466587557261600130787812n;
export const USERNAME_COLLECTION_UNORDERED_NEXT_INDEX = -1n;
export const OP_USERNAME_BIND_OFFICIAL_ATH_WALLET = 1715335229n;
export const OP_USERNAME_BIND_VAULT = 1621496068n;
export const OP_SEAL_GENESIS = 974311853n;

export class UsernameRegistry implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = UsernameRegistry_errors_backward;
    public static readonly opcodes = UsernameRegistry_opcodes;
    
    static async init(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: boolean, deployment_manifest_hash: bigint, genesis_config_hash: bigint, genesis_controller_address: Address) {
        return await UsernameRegistry_init(official_ath_wallet_address, ath_master_address, treasury_ath_receiver_address, sealed, deployment_manifest_hash, genesis_config_hash, genesis_controller_address);
    }
    
    static async fromInit(official_ath_wallet_address: Address, ath_master_address: Address, treasury_ath_receiver_address: Address, sealed: boolean, deployment_manifest_hash: bigint, genesis_config_hash: bigint, genesis_controller_address: Address) {
        const __gen_init = await UsernameRegistry_init(official_ath_wallet_address, ath_master_address, treasury_ath_receiver_address, sealed, deployment_manifest_hash, genesis_config_hash, genesis_controller_address);
        const address = contractAddress(0, __gen_init);
        return new UsernameRegistry(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new UsernameRegistry(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  UsernameRegistry_types,
        getters: UsernameRegistry_getters,
        receivers: UsernameRegistry_receivers,
        errors: UsernameRegistry_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindOfficialAthWallet | BindUsernameVault | SealGenesis | AthTransferNotificationVaultMintUsername | UsernameItemDeployedAck | FlushTreasuryAthDue | FlushBurnAthDue | ATHTransferAck | ATHTransferFailed | ATHBurnFinalized | ATHBurnFailed | PrunePendingUsernameMint | UsernameRegistryTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindOfficialAthWallet') {
            body = beginCell().store(storeBindOfficialAthWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindUsernameVault') {
            body = beginCell().store(storeBindUsernameVault(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotificationVaultMintUsername') {
            body = beginCell().store(storeAthTransferNotificationVaultMintUsername(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'UsernameItemDeployedAck') {
            body = beginCell().store(storeUsernameItemDeployedAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushTreasuryAthDue') {
            body = beginCell().store(storeFlushTreasuryAthDue(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushBurnAthDue') {
            body = beginCell().store(storeFlushBurnAthDue(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferAck') {
            body = beginCell().store(storeATHTransferAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHTransferFailed') {
            body = beginCell().store(storeATHTransferFailed(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHBurnFinalized') {
            body = beginCell().store(storeATHBurnFinalized(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ATHBurnFailed') {
            body = beginCell().store(storeATHBurnFailed(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PrunePendingUsernameMint') {
            body = beginCell().store(storePrunePendingUsernameMint(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'UsernameRegistryTopUpStorageReserve') {
            body = beginCell().store(storeUsernameRegistryTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetUsernamePrice(provider: ContractProvider, name_len: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(name_len);
        const source = (await provider.get('get_username_price', builder.build())).stack;
        const result = loadGetterTupleUsernamePriceView(source);
        return result;
    }
    
    async getGetUsernameItemAddress(provider: ContractProvider, name_hash: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(name_hash);
        const source = (await provider.get('get_username_item_address', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getGetNftAddressByIndex(provider: ContractProvider, index: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(index);
        const source = (await provider.get('get_nft_address_by_index', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getGetNftContent(provider: ContractProvider, index: bigint, individual_content: Cell) {
        const builder = new TupleBuilder();
        builder.writeNumber(index);
        builder.writeCell(individual_content);
        const source = (await provider.get('get_nft_content', builder.build())).stack;
        const result = source.readCell();
        return result;
    }
    
    async getGetCollectionData(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_collection_data', builder.build())).stack;
        const result = loadGetterTupleUsernameCollectionDataView(source);
        return result;
    }
    
    async getGetNameRecord(provider: ContractProvider, name_hash: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(name_hash);
        const source = (await provider.get('get_name_record', builder.build())).stack;
        const result = loadGetterTupleUsernameNameRecordView(source);
        return result;
    }
    
    async getGetPendingMint(provider: ContractProvider, name_hash: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(name_hash);
        const source = (await provider.get('get_pending_mint', builder.build())).stack;
        const result = loadGetterTuplePendingUsernameMintView(source);
        return result;
    }
    
    async getGetPendingTreasuryFlush(provider: ContractProvider, query_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(query_id);
        const source = (await provider.get('get_pending_treasury_flush', builder.build())).stack;
        const result = loadGetterTuplePendingAthTreasuryFlushView(source);
        return result;
    }
    
    async getGetPendingBurnFlush(provider: ContractProvider, query_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(query_id);
        const source = (await provider.get('get_pending_burn_flush', builder.build())).stack;
        const result = loadGetterTuplePendingAthBurnFlushView(source);
        return result;
    }
    
    async getGetAthWalletAddress(provider: ContractProvider, owner_wallet: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        const source = (await provider.get('get_ath_wallet_address', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getGetGlobal(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_global', builder.build())).stack;
        const result = loadGetterTupleUsernameRegistryGlobalView(source);
        return result;
    }
    
}