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

export type ProveUsernameOwnership = {
    $$type: 'ProveUsernameOwnership';
    query_id: bigint;
    to: Address;
}

export function storeProveUsernameOwnership(src: ProveUsernameOwnership) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1431195730, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.to);
    };
}

export function loadProveUsernameOwnership(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1431195730) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _to = sc_0.loadAddress();
    return { $$type: 'ProveUsernameOwnership' as const, query_id: _query_id, to: _to };
}

export function loadTupleProveUsernameOwnership(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _to = source.readAddress();
    return { $$type: 'ProveUsernameOwnership' as const, query_id: _query_id, to: _to };
}

export function loadGetterTupleProveUsernameOwnership(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _to = source.readAddress();
    return { $$type: 'ProveUsernameOwnership' as const, query_id: _query_id, to: _to };
}

export function storeTupleProveUsernameOwnership(source: ProveUsernameOwnership) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.to);
    return builder.build();
}

export function dictValueParserProveUsernameOwnership(): DictionaryValue<ProveUsernameOwnership> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeProveUsernameOwnership(src)).endCell());
        },
        parse: (src) => {
            return loadProveUsernameOwnership(src.loadRef().beginParse());
        }
    }
}

export type UsernameOwnershipProof = {
    $$type: 'UsernameOwnershipProof';
    query_id: bigint;
    name_hash: bigint;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
}

export function storeUsernameOwnershipProof(src: UsernameOwnershipProof) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1431195727, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.name_hash, 256);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.username_len, 8);
        b_0.storeBuilder(src.username.asBuilder());
    };
}

export function loadUsernameOwnershipProof(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1431195727) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _name_hash = sc_0.loadUintBig(256);
    const _owner_wallet = sc_0.loadAddress();
    const _username_len = sc_0.loadUintBig(8);
    const _username = sc_0;
    return { $$type: 'UsernameOwnershipProof' as const, query_id: _query_id, name_hash: _name_hash, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleUsernameOwnershipProof(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _name_hash = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'UsernameOwnershipProof' as const, query_id: _query_id, name_hash: _name_hash, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleUsernameOwnershipProof(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _name_hash = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'UsernameOwnershipProof' as const, query_id: _query_id, name_hash: _name_hash, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function storeTupleUsernameOwnershipProof(source: UsernameOwnershipProof) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.name_hash);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.username_len);
    builder.writeSlice(source.username.asCell());
    return builder.build();
}

export function dictValueParserUsernameOwnershipProof(): DictionaryValue<UsernameOwnershipProof> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUsernameOwnershipProof(src)).endCell());
        },
        parse: (src) => {
            return loadUsernameOwnershipProof(src.loadRef().beginParse());
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
    payload: Slice;
}

export function storeNftTransfer(src: NftTransfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1607220500, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeBuilder(src.payload.asBuilder());
    };
}

export function loadNftTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1607220500) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _payload = sc_0;
    return { $$type: 'NftTransfer' as const, query_id: _query_id, payload: _payload };
}

export function loadTupleNftTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _payload = source.readCell().asSlice();
    return { $$type: 'NftTransfer' as const, query_id: _query_id, payload: _payload };
}

export function loadGetterTupleNftTransfer(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _payload = source.readCell().asSlice();
    return { $$type: 'NftTransfer' as const, query_id: _query_id, payload: _payload };
}

export function storeTupleNftTransfer(source: NftTransfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeSlice(source.payload.asCell());
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

export type AthTransferNotificationRegistryMintUsername = {
    $$type: 'AthTransferNotificationRegistryMintUsername';
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    payer_wallet: Address;
    owner_wallet: Address;
    username_len: bigint;
    username: Slice;
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
        b_0.storeBuilder(src.username.asBuilder());
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
    const _username = sc_0;
    return { $$type: 'AthTransferNotificationRegistryMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadTupleAthTransferNotificationRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
    return { $$type: 'AthTransferNotificationRegistryMintUsername' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, payer_wallet: _payer_wallet, owner_wallet: _owner_wallet, username_len: _username_len, username: _username };
}

export function loadGetterTupleAthTransferNotificationRegistryMintUsername(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _payer_wallet = source.readAddress();
    const _owner_wallet = source.readAddress();
    const _username_len = source.readBigNumber();
    const _username = source.readCell().asSlice();
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
    builder.writeSlice(source.username.asCell());
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
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    official_ath_wallet_address: Address;
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
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.official_ath_wallet_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.genesis_controller_address);
        b_1.storeInt(src.name_record_count, 257);
        b_1.storeInt(src.pending_mint_count, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.treasury_due_ath, 257);
        b_2.storeInt(src.burn_due_ath, 257);
        b_2.storeInt(src.pending_treasury_flush_count, 257);
        const b_3 = new Builder();
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
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _official_ath_wallet_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _genesis_controller_address = sc_1.loadAddress();
    const _name_record_count = sc_1.loadIntBig(257);
    const _pending_mint_count = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _treasury_due_ath = sc_2.loadIntBig(257);
    const _burn_due_ath = sc_2.loadIntBig(257);
    const _pending_treasury_flush_count = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_burn_flush_count = sc_3.loadIntBig(257);
    const _pending_mint_stale_ttl = sc_3.loadIntBig(257);
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
}

export function loadTupleUsernameRegistryGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _name_record_count = source.readBigNumber();
    const _pending_mint_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    const _pending_mint_stale_ttl = source.readBigNumber();
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
}

export function loadGetterTupleUsernameRegistryGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _official_ath_wallet_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _official_ath_wallet_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _name_record_count = source.readBigNumber();
    const _pending_mint_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    const _pending_mint_stale_ttl = source.readBigNumber();
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
}

export function storeTupleUsernameRegistryGlobalView(source: UsernameRegistryGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.official_ath_wallet_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.official_ath_wallet_address);
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

export type RoyaltyParamsView = {
    $$type: 'RoyaltyParamsView';
    numerator: bigint;
    denominator: bigint;
    destination: Address;
}

export function storeRoyaltyParamsView(src: RoyaltyParamsView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.numerator, 257);
        b_0.storeInt(src.denominator, 257);
        b_0.storeAddress(src.destination);
    };
}

export function loadRoyaltyParamsView(slice: Slice) {
    const sc_0 = slice;
    const _numerator = sc_0.loadIntBig(257);
    const _denominator = sc_0.loadIntBig(257);
    const _destination = sc_0.loadAddress();
    return { $$type: 'RoyaltyParamsView' as const, numerator: _numerator, denominator: _denominator, destination: _destination };
}

export function loadTupleRoyaltyParamsView(source: TupleReader) {
    const _numerator = source.readBigNumber();
    const _denominator = source.readBigNumber();
    const _destination = source.readAddress();
    return { $$type: 'RoyaltyParamsView' as const, numerator: _numerator, denominator: _denominator, destination: _destination };
}

export function loadGetterTupleRoyaltyParamsView(source: TupleReader) {
    const _numerator = source.readBigNumber();
    const _denominator = source.readBigNumber();
    const _destination = source.readAddress();
    return { $$type: 'RoyaltyParamsView' as const, numerator: _numerator, denominator: _denominator, destination: _destination };
}

export function storeTupleRoyaltyParamsView(source: RoyaltyParamsView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.numerator);
    builder.writeNumber(source.denominator);
    builder.writeAddress(source.destination);
    return builder.build();
}

export function dictValueParserRoyaltyParamsView(): DictionaryValue<RoyaltyParamsView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRoyaltyParamsView(src)).endCell());
        },
        parse: (src) => {
            return loadRoyaltyParamsView(src.loadRef().beginParse());
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

export type UploadArt = {
    $$type: 'UploadArt';
    key: bigint;
    data: Cell;
}

export function storeUploadArt(src: UploadArt) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1486822296, 32);
        b_0.storeUint(src.key, 16);
        b_0.storeRef(src.data);
    };
}

export function loadUploadArt(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1486822296) { throw Error('Invalid prefix'); }
    const _key = sc_0.loadUintBig(16);
    const _data = sc_0.loadRef();
    return { $$type: 'UploadArt' as const, key: _key, data: _data };
}

export function loadTupleUploadArt(source: TupleReader) {
    const _key = source.readBigNumber();
    const _data = source.readCell();
    return { $$type: 'UploadArt' as const, key: _key, data: _data };
}

export function loadGetterTupleUploadArt(source: TupleReader) {
    const _key = source.readBigNumber();
    const _data = source.readCell();
    return { $$type: 'UploadArt' as const, key: _key, data: _data };
}

export function storeTupleUploadArt(source: UploadArt) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.key);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserUploadArt(): DictionaryValue<UploadArt> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUploadArt(src)).endCell());
        },
        parse: (src) => {
            return loadUploadArt(src.loadRef().beginParse());
        }
    }
}

export type SealArt = {
    $$type: 'SealArt';
}

export function storeSealArt(src: SealArt) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3513294426, 32);
    };
}

export function loadSealArt(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3513294426) { throw Error('Invalid prefix'); }
    return { $$type: 'SealArt' as const };
}

export function loadTupleSealArt(source: TupleReader) {
    return { $$type: 'SealArt' as const };
}

export function loadGetterTupleSealArt(source: TupleReader) {
    return { $$type: 'SealArt' as const };
}

export function storeTupleSealArt(source: SealArt) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserSealArt(): DictionaryValue<SealArt> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSealArt(src)).endCell());
        },
        parse: (src) => {
            return loadSealArt(src.loadRef().beginParse());
        }
    }
}

export type UploadCollectionMeta = {
    $$type: 'UploadCollectionMeta';
    key: bigint;
    data: Cell;
}

export function storeUploadCollectionMeta(src: UploadCollectionMeta) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3151574565, 32);
        b_0.storeUint(src.key, 16);
        b_0.storeRef(src.data);
    };
}

export function loadUploadCollectionMeta(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3151574565) { throw Error('Invalid prefix'); }
    const _key = sc_0.loadUintBig(16);
    const _data = sc_0.loadRef();
    return { $$type: 'UploadCollectionMeta' as const, key: _key, data: _data };
}

export function loadTupleUploadCollectionMeta(source: TupleReader) {
    const _key = source.readBigNumber();
    const _data = source.readCell();
    return { $$type: 'UploadCollectionMeta' as const, key: _key, data: _data };
}

export function loadGetterTupleUploadCollectionMeta(source: TupleReader) {
    const _key = source.readBigNumber();
    const _data = source.readCell();
    return { $$type: 'UploadCollectionMeta' as const, key: _key, data: _data };
}

export function storeTupleUploadCollectionMeta(source: UploadCollectionMeta) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.key);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserUploadCollectionMeta(): DictionaryValue<UploadCollectionMeta> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeUploadCollectionMeta(src)).endCell());
        },
        parse: (src) => {
            return loadUploadCollectionMeta(src.loadRef().beginParse());
        }
    }
}

export type SealCollectionMeta = {
    $$type: 'SealCollectionMeta';
}

export function storeSealCollectionMeta(src: SealCollectionMeta) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1935875654, 32);
    };
}

export function loadSealCollectionMeta(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1935875654) { throw Error('Invalid prefix'); }
    return { $$type: 'SealCollectionMeta' as const };
}

export function loadTupleSealCollectionMeta(source: TupleReader) {
    return { $$type: 'SealCollectionMeta' as const };
}

export function loadGetterTupleSealCollectionMeta(source: TupleReader) {
    return { $$type: 'SealCollectionMeta' as const };
}

export function storeTupleSealCollectionMeta(source: SealCollectionMeta) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserSealCollectionMeta(): DictionaryValue<SealCollectionMeta> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSealCollectionMeta(src)).endCell());
        },
        parse: (src) => {
            return loadSealCollectionMeta(src.loadRef().beginParse());
        }
    }
}

export type UsernameRegistry$Data = {
    $$type: 'UsernameRegistry$Data';
    official_ath_wallet_address: Address;
    ath_master_address: Address;
    treasury_ath_receiver_address: Address;
    official_ath_wallet_bound: boolean;
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
    art: Dictionary<number, Cell>;
    art_count: bigint;
    art_sealed: boolean;
    meta: Dictionary<number, Cell>;
    meta_count: bigint;
    meta_sealed: boolean;
}

export function storeUsernameRegistry$Data(src: UsernameRegistry$Data) {
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
        b_1.storeUint(src.name_record_count, 64);
        b_1.storeUint(src.pending_mint_count, 64);
        b_1.storeUint(src.treasury_due_ath, 128);
        b_1.storeUint(src.burn_due_ath, 128);
        b_1.storeDict(src.name_records, Dictionary.Keys.BigInt(257), dictValueParserNameRecord());
        b_1.storeDict(src.pending_mints, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint());
        b_1.storeDict(src.pending_item_to_name_hash, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257));
        const b_2 = new Builder();
        b_2.storeDict(src.pending_treasury_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush());
        b_2.storeUint(src.pending_treasury_flush_count, 64);
        b_2.storeDict(src.pending_burn_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush());
        b_2.storeUint(src.pending_burn_flush_count, 64);
        b_2.storeAddress(src.genesis_controller_address);
        b_2.storeDict(src.art, Dictionary.Keys.Uint(16), Dictionary.Values.Cell());
        b_2.storeUint(src.art_count, 16);
        b_2.storeBit(src.art_sealed);
        b_2.storeDict(src.meta, Dictionary.Keys.Uint(16), Dictionary.Values.Cell());
        b_2.storeUint(src.meta_count, 16);
        b_2.storeBit(src.meta_sealed);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadUsernameRegistry$Data(slice: Slice) {
    const sc_0 = slice;
    const _official_ath_wallet_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _treasury_ath_receiver_address = sc_0.loadAddress();
    const _official_ath_wallet_bound = sc_0.loadBit();
    const _sealed = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _deployment_manifest_hash = sc_1.loadUintBig(256);
    const _genesis_config_hash = sc_1.loadUintBig(256);
    const _name_record_count = sc_1.loadUintBig(64);
    const _pending_mint_count = sc_1.loadUintBig(64);
    const _treasury_due_ath = sc_1.loadUintBig(128);
    const _burn_due_ath = sc_1.loadUintBig(128);
    const _name_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), sc_1);
    const _pending_mints = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), sc_1);
    const _pending_item_to_name_hash = Dictionary.load(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), sc_1);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pending_treasury_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), sc_2);
    const _pending_treasury_flush_count = sc_2.loadUintBig(64);
    const _pending_burn_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), sc_2);
    const _pending_burn_flush_count = sc_2.loadUintBig(64);
    const _genesis_controller_address = sc_2.loadAddress();
    const _art = Dictionary.load(Dictionary.Keys.Uint(16), Dictionary.Values.Cell(), sc_2);
    const _art_count = sc_2.loadUintBig(16);
    const _art_sealed = sc_2.loadBit();
    const _meta = Dictionary.load(Dictionary.Keys.Uint(16), Dictionary.Values.Cell(), sc_2);
    const _meta_count = sc_2.loadUintBig(16);
    const _meta_sealed = sc_2.loadBit();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address, art: _art, art_count: _art_count, art_sealed: _art_sealed, meta: _meta, meta_count: _meta_count, meta_sealed: _meta_sealed };
}

export function loadTupleUsernameRegistry$Data(source: TupleReader) {
    const _official_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _official_ath_wallet_bound = source.readBoolean();
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
    source = source.readTuple();
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _art = Dictionary.loadDirect(Dictionary.Keys.Uint(16), Dictionary.Values.Cell(), source.readCellOpt());
    const _art_count = source.readBigNumber();
    const _art_sealed = source.readBoolean();
    const _meta = Dictionary.loadDirect(Dictionary.Keys.Uint(16), Dictionary.Values.Cell(), source.readCellOpt());
    const _meta_count = source.readBigNumber();
    const _meta_sealed = source.readBoolean();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address, art: _art, art_count: _art_count, art_sealed: _art_sealed, meta: _meta, meta_count: _meta_count, meta_sealed: _meta_sealed };
}

export function loadGetterTupleUsernameRegistry$Data(source: TupleReader) {
    const _official_ath_wallet_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _treasury_ath_receiver_address = source.readAddress();
    const _official_ath_wallet_bound = source.readBoolean();
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
    const _art = Dictionary.loadDirect(Dictionary.Keys.Uint(16), Dictionary.Values.Cell(), source.readCellOpt());
    const _art_count = source.readBigNumber();
    const _art_sealed = source.readBoolean();
    const _meta = Dictionary.loadDirect(Dictionary.Keys.Uint(16), Dictionary.Values.Cell(), source.readCellOpt());
    const _meta_count = source.readBigNumber();
    const _meta_sealed = source.readBoolean();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address, art: _art, art_count: _art_count, art_sealed: _art_sealed, meta: _meta, meta_count: _meta_count, meta_sealed: _meta_sealed };
}

export function storeTupleUsernameRegistry$Data(source: UsernameRegistry$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.official_ath_wallet_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.treasury_ath_receiver_address);
    builder.writeBoolean(source.official_ath_wallet_bound);
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
    builder.writeCell(source.art.size > 0 ? beginCell().storeDictDirect(source.art, Dictionary.Keys.Uint(16), Dictionary.Values.Cell()).endCell() : null);
    builder.writeNumber(source.art_count);
    builder.writeBoolean(source.art_sealed);
    builder.writeCell(source.meta.size > 0 ? beginCell().storeDictDirect(source.meta, Dictionary.Keys.Uint(16), Dictionary.Values.Cell()).endCell() : null);
    builder.writeNumber(source.meta_count);
    builder.writeBoolean(source.meta_sealed);
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
    const __code = Cell.fromHex('b5ee9c7241022101000790000114ff00f4a413f4bcf2c80b01020162021303f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019fd200fa40fa40d3ffd307d455506c168e1cfa40810101d7005902d10181465121c300f2f4702270c8c910351024e207925f07e07026d74920c21f953106d31f07de218210554e494ebae302218210639cfc6cbae302218210554e5052ba03080a04c05b05fa40d30781465af84226c705f2f481465b27b3f2f410465e32505781465c5197db3c1af2f481465d543968db3c1af2f481465e5198db3c355b335112ba16f2f481465ff8416f24135f0382083d0900bef2f47fc85005cf16c910451034120e04060701deeda2edfb555127db3c936c2670e126d74928aa02bd936c2670e026c702936c2670e170935308b98e3907d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e296306c2670db31e107a4e8303705c7001046103544301205001420c20392c111923070e20020c88210c5cc7cd601cb1f01cf16c9f9000130db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed540901905b3581466424f2f4814665f8416f24135f0382083d0900bef2f4814666f8416f24135f038209312d00bbf2f410355512db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed5409006a82082dc6c07f715357c8598210bba3ec195003cb1fcbffcec92755304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002c4e3022182105fcc3d14bae3023720821027acdf8bba8e1c303510355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e0c00006c12116b08e1f8146b3f2f010355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e05f06f2c0820b0d02fc5b05d33ffa403081467826f2f450561443308146795187db3c19f2f481467af8416f24135f0382085b8d80bef2f481467bf8416f24135f038209312d00bbf2f482084c4b40717f2ad0542950546860c855408210554e504f5006cb1f14cb3f12cbffcecb07cec91049413018441359c8cf8580ca00cf8440ce01fa02806a0e0c0044cf40f400c901fb0045334414c87f01ca0055505056ca0013cececbffcb07ccc9ed5403fc5b05d33f81466e26f2f481466ff84226c705f2f4fa4010465e3250578146705196db3c1af2f427d70b01c3006d218e943008fa4010461035465681467151b6db3c1cf2f4990972d7210644941513e206d2000192d431defa008208989680f8416f24fa40fa0071d721fa00fa00306c6170f83aaa00b609f8416f24135f030e0e0f000afa4430c00003f282081e8480a123a101a181467321c2fff2f45392c2008ec5104745737150ae7007db3c544d99c85520821005138d915004cb1f12cb3fcecec9104b103a4e60441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00491346569336395be2089625820186a0be9170e2951026333430e30d10354413101112001820c700973070c8ca00c9d0e00064717008c8018210d53276db58cb1fcb3fc9104510374180441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003002cc87f01ca0055505056ca0013cececbffcb07ccc9ed5402012014170177be9d6f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3633c1501285475435475435555db3c106c105b104a1039487016001a21c0049171e021c0059172e0730177bc7e7f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3632c180130547523271059104810374698db3c104810374a90106a10591903f655226d8307507682f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce8906db3c10394870206e953059f45b30944133f417e28307507682f0c9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd10406db3c10394870206e953059f45b30944133f417e270011a1b200026c87001cb0721d0cf1682102e61746801cb1fc90242c87001cb076f00016f8c6d6f8c89db3c6f2201c993216eb396016f2259ccc9e8311c1f01fe5072697661746520636f72726573706f6e64656e636520697320612072696768742c206e6f7420612070726976696c6567652e2054686973206973206120757365726e616d65204e465420666f7220506c6174686f20e280942074686520616e6f6e796d6f75732c20706f73742d7175616e74756d2d656e637279707465641d01fe2c20756e63656e736f7261626c65206d657373656e6765722e2041207065726d616e656e742c207472616e7366657261626c652c2066756c6c79206f6e2d636861696e2068616e646c653a20746865206e616d65206f746865727320726561636820796f752062792c2068656c64206279206e6f206f6e652062757420796f1e001a752e20706c6174686f2e61707000b620d74a21d7499720c20022c200b18e48036f22807f22cf31ab02a105ab025155b60820c2009a20aa0215d71803ce4014de596f025341a1c20099c8016f025044a1aa028e123133c20099d430d020d74a21d749927020e2e2e85f030018c85902cb07f400c910364540ffecdc81');
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
    {"name":"ProveUsernameOwnership","header":1431195730,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"UsernameOwnershipProof","header":1431195727,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"UsernameItemDeployedAck","header":3148082201,"fields":[{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"NftTransfer","header":1607220500,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"payload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
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
    {"name":"AthTransferNotificationRegistryMintUsername","header":2299698528,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"payer_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_len","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"username","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
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
    {"name":"ATHWalletDataView","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"jetton_wallet_code","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PendingAthTransferNotificationView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTransferNotification","header":null,"fields":[{"name":"sender_owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_ack_value","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthOutgoingTransfer","header":null,"fields":[{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"pending_outgoing_transfers","type":{"kind":"dict","key":"int","value":"PendingAthOutgoingTransfer","valueFormat":"ref"}}]},
    {"name":"BindOfficialAthWallet","header":1715335229,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushTreasuryAthDue","header":1621736923,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FlushBurnAthDue","header":3919758027,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PrunePendingUsernameMint","header":932634413,"fields":[{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"UsernameRegistryTopUpStorageReserve","header":179986205,"fields":[]},
    {"name":"PendingUsernameMint","header":null,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"price_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_deploy_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"NameRecord","header":null,"fields":[{"name":"minter_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"UsernameRegistryGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_mint_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"burn_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_mint_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernamePriceView","header":null,"fields":[{"name":"valid_length","type":{"kind":"simple","type":"bool","optional":false}},{"name":"price_ath_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameNameRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"minter_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingUsernameMintView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sender_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"price_paid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_deploy_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTreasuryFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthBurnFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PendingAthTreasuryFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthBurnFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameCollectionDataView","header":null,"fields":[{"name":"next_item_index","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"collection_content","type":{"kind":"simple","type":"cell","optional":false}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"RoyaltyParamsView","header":null,"fields":[{"name":"numerator","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"denominator","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"UsernameCollectionOnchainContent","header":null,"fields":[{"name":"marker","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"metadata","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"cell","valueFormat":"ref"}}]},
    {"name":"UploadArt","header":1486822296,"fields":[{"name":"key","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"SealArt","header":3513294426,"fields":[]},
    {"name":"UploadCollectionMeta","header":3151574565,"fields":[{"name":"key","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"SealCollectionMeta","header":1935875654,"fields":[]},
    {"name":"UsernameRegistry$Data","header":null,"fields":[{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_ath_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"name_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_mint_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"burn_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"name_records","type":{"kind":"dict","key":"int","value":"NameRecord","valueFormat":"ref"}},{"name":"pending_mints","type":{"kind":"dict","key":"int","value":"PendingUsernameMint","valueFormat":"ref"}},{"name":"pending_item_to_name_hash","type":{"kind":"dict","key":"address","value":"int"}},{"name":"pending_treasury_flushes","type":{"kind":"dict","key":"int","value":"PendingAthTreasuryFlush","valueFormat":"ref"}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_burn_flushes","type":{"kind":"dict","key":"int","value":"PendingAthBurnFlush","valueFormat":"ref"}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"art","type":{"kind":"dict","key":"uint","keyFormat":16,"value":"cell","valueFormat":"ref"}},{"name":"art_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"art_sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"meta","type":{"kind":"dict","key":"uint","keyFormat":16,"value":"cell","valueFormat":"ref"}},{"name":"meta_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"meta_sealed","type":{"kind":"simple","type":"bool","optional":false}}]},
]

const UsernameNFTItem_opcodes = {
    "InitializeUsernameItem": 1431193934,
    "ResendDeployedAck": 1671232620,
    "TopUpStorageReserve": 665640843,
    "ProveUsernameOwnership": 1431195730,
    "UsernameOwnershipProof": 1431195727,
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
    "BindOfficialAthWallet": 1715335229,
    "SealGenesis": 974311853,
    "FlushTreasuryAthDue": 1621736923,
    "FlushBurnAthDue": 3919758027,
    "PrunePendingUsernameMint": 932634413,
    "UsernameRegistryTopUpStorageReserve": 179986205,
    "UploadArt": 1486822296,
    "SealArt": 3513294426,
    "UploadCollectionMeta": 3151574565,
    "SealCollectionMeta": 1935875654,
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
    {"receiver":"internal","message":{"kind":"typed","type":"ProveUsernameOwnership"}},
    {"receiver":"internal","message":{"kind":"typed","type":"NftTransfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const USERNAME_ITEM_ACK_FORWARD_RESERVE = 3000000n;
export const USERNAME_ITEM_ACK_EXEC_RESERVE = 1000000n;
export const USERNAME_ITEM_ACK_MAX_RESEND_VALUE = 20000000n;
export const USERNAME_ITEM_TRANSFER_EXEC_RESERVE = 2000000n;
export const USERNAME_ITEM_TRANSFER_FWD_FEE_ALLOWANCE = 10000000n;
export const USERNAME_ITEM_PROOF_FORWARD_RESERVE = 5000000n;
export const USERNAME_ITEM_PROOF_EXEC_RESERVE = 1000000n;
export const USERNAME_ITEM_PROOF_MAX_VALUE = 20000000n;
export const USERNAME_ITEM_EXCESSES_MIN_VALUE = 100000n;
export const USERNAME_ITEM_MAX_LENGTH = 16n;
export const USERNAME_ITEM_NAME_HASH_DOMAIN = 3318512854n;
export const USERNAME_ITEM_METADATA_KEY_NAME = 59089242681608890680090686026688704441792375738894456860693970539822503415433n;
export const USERNAME_ITEM_METADATA_KEY_DESCRIPTION = 90922719342317012409671596374183159143637506542604000676488204638996496437508n;
export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_REGISTRY_RESPONSE_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1000000n;
export const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 21000000n;
export const ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE = 2000000n;
export const ATH_TRANSFER_NOTIFY_MIN_VALUE = 45000000n;
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
export const ATH_REGISTRY_PENDING_TTL = 604800n;
export const JETTON_EXCESSES_VALUE = 1000000n;
export const USERNAME_PRICE_4_CHARS = 10000000000000n;
export const USERNAME_PRICE_5_CHARS = 1000000000000n;
export const USERNAME_PRICE_6_PLUS_CHARS = 100000000000n;
export const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = 6000000n;
export const USERNAME_STATE_GROWTH_EXEC_RESERVE = 4000000n;
export const USERNAME_NAME_RECORD_STORAGE_ENDOWMENT = 100000000n;
export const USERNAME_NFT_ITEM_DEPLOY_RESERVE = 829000000n;
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
export const USERNAME_COLLECTION_METADATA_KEY_IMAGE_DATA = 98449690268711667050166283313913751402364107788915545466587557261600130787812n;
export const USERNAME_COLLECTION_METADATA_KEY_DESCRIPTION = 90922719342317012409671596374183159143637506542604000676488204638996496437508n;
export const USERNAME_COLLECTION_METADATA_KEY_IMAGE = 43884663033947008978309661017057008345326326811558777475113826163084742639165n;
export const USERNAME_COLLECTION_METADATA_KEY_COVER_IMAGE = 42956871979619932309344551073564797192701919513518910325960307890830458850535n;
export const USERNAME_META_KEY_DESCRIPTION = 1n;
export const USERNAME_META_KEY_IMAGE = 2n;
export const USERNAME_META_KEY_COVER_IMAGE = 3n;
export const USERNAME_META_PART_COUNT = 3n;
export const USERNAME_COLLECTION_UNORDERED_NEXT_INDEX = -1n;
export const OP_USERNAME_BIND_OFFICIAL_ATH_WALLET = 1715335229n;
export const OP_SEAL_GENESIS = 974311853n;

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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: InitializeUsernameItem | ResendDeployedAck | ProveUsernameOwnership | NftTransfer | TopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'InitializeUsernameItem') {
            body = beginCell().store(storeInitializeUsernameItem(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ResendDeployedAck') {
            body = beginCell().store(storeResendDeployedAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ProveUsernameOwnership') {
            body = beginCell().store(storeProveUsernameOwnership(message)).endCell();
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