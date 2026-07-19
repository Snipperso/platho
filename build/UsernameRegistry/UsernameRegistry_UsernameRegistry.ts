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
    const __code = Cell.fromHex('b5ee9c72420201f9000100009e0100000114ff00f4a413f4bcf2c80b0001020162000200490130d001d072d721d200d200fa4021103450666f04f86102f862000303feed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30d111ae302705619d74920c21f97311119d31f111ade01f60004000b036611188020d7217021d749c21f9430d31f01de208210554e494ebae30220821041544810bae302821041544801bae3025f0f5f0b00050008000a02cc5b1116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c81010bf8422d598101014133f40a6fa19401d70030925b6de2814ac4216eb3f2f42d8101012259f40d6fa192306ddf004400060376206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814ac5016eb3f2f4db3c10355f05db3c002c00070048007a8208b71b007f5043710301c8552082104154481e5004cb1f12cb3fcb7fcb9fc9561c55304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002fe30d33fd37f593201111901111adb3c814ad8f842561ac705f2f42a810101561c59f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b2a016eb3f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f0044000902c6550e111adb3c5b814b2b111b21ba01111b01f2f411191fa01117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f111010de10cd10bc10ab109a1089107810671056104510344130003c004803fad33fd37f593201111901111adb3c814b5af842561ac705f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111adb3c30814b5b111b21ba01111b01f2f411191ea0111711181117111611171116111511161115004400400041044c218210663df03dbae3022182103a12d1adbae302218210589f1b98bae302218210d1689e5aba000c000f0014001603fe5b1118d3fffa403001111901111adb3cdb3c814a56561ac201f2f4814a575616b3f2f4814a585613c000f2f4814a5a5614c000917f955614561bbae2f2f4814a5bf8281119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100010001a000d02fe0f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a0908111a0807111a0706111a0605111a0504111a0403111a0302111a0201111a01db3c57135713571457165618011110c70501111601f2f4111211151112111111141111717f1115111111141111111111131111011112010e11110e0d11100d10cf10be0191000e012610ad109c108b107a1069105810471036401504004803f65b1118d3ff301117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411194130db3cdb3c814a60561ac201f2f4814a615614561bbaf2f4814a625616f2f4814a635619f8280010001a00110010814a385615b3f2f402fc1119111b11191118111a11181117111b11171116111a11161115111b11151114111a11141113111b11131112111a11121111111b11111110111a11100f111b0f0e111a0e0d111b0d0c111a0c0b111b0b0a111a0a09111b0908111a0807111b0706111a0605111b0504111a0403111b0302111a0201111b01db3c01111b010191001202fec70501111901f2f4111611171116111511161115814a64561511171115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034401301111a01db3c57135714011118011111f2f4814a69f828561501c705b3f2f4814a6a01ca001301b256145617c705b3f2f4814a6c56145616c705b3f2f41115111711151114111611141113111511131112111411127f111411111113111111120f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443012004802fe5b1118d30fd43001111901111adb3c814a7524b3f2f4258010561b59f40f6fa192306ddf6e9304a404de102580100201111a01111b206e953059f45b30944133f417e21116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b001a0015011a108a1079106810571046443512004804b28f445b57181116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c33814a7424c038f2f47f03e0218210bbd93625bae30221821073631e46ba001a00480017001902f85b1118d30fd43001111901111adb3c814a7f21b3f2f4814a80561ac20094561ac1049170e2f2f4228010561b59f40f6fa192306ddf6e9301a401de80100201111a01111b206e953059f45b30944133f417e2111611181116111511171115111411161114111311151113111211141112111111131111111011121110001a001801180f11110f0e11100e10df551c004804b08f435b57181116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c30814a7e21c003f2f47fe021821089129d60bae302218210bba3ec19ba001a0048001b00280014814a59f84228c705f2f401fa5b1118d33fd39fd37ffa40fa40d3071118111d11181117111c11171116111b11161115111a11151114111911141113111d11131112111c11121111111b11111110111a11100f11190f0e111d0e0d111c0d0c111b0c0b111a0b0a11190a09111d0908111c0807111b0706111a060511190504111d0403111c0302111b02001c04f201111e01111fdb3c814aecf842561ac705f2f4814aef111ddb3c01111d01f2f41117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e55661045034414db3c004401ca001d004801f6814ab124c200f2f41117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111e11100f111d0f0e111c0e0d111b0d0c111a0c0b11190b0a11180a09111e0908111d0807111c0706111b0605111a05041119040311180302111e0201111d01111c814ab6111c001e04f6561fdb3c01111d01f2f4814ae2111c561e561edb3c01111d01f2f41117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111b561cdb3c11181119111811171119111711161119111611151119111511141119111411131119111301ca001f0168002401f4eda2edfb1118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111901111a5619002004aedb3c8e3b571957191116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c70e1561ad749561aaa02bde302561ac702e303709420561bb901670021002100220076571957191116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c7001b48ae83057191119c7001117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443012002300e8111bd30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e28e3e30571957191116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c70db31e1111ba403fe1112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a0911190911190807065540561edb3c561d814ae302bdf2f2814ae42e810101561c59f40c6fa131f2f2814ae52d810101561c59f40c6fa131f2f2821038074300814ab2f8416f24135f0358bef2f45619db3c814ab3015b0160002501fe2d81010b2359f40a6fa131b3f2f4810101821031698940f82304111f0403111e03562303561e03021122025620021123c855705078cb3f15cb9f13cecbffcb7f01c8ce12cb7f12cb3fcdc9102c01111c01561901206e953059f45a30944133f415e20981010b56195619810101216e955b59f4593098c801cf004133f441e2002602f80ea4f828011118db3c821031698940111f7f111f71111fc855208210554e494e5004cb1f12cecb07cec906111a0605111f0504111e0403111d03103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001111111811111110111711100161002700620f11160f0e11150e0d11140d0c11130c0b11120b0a11110a0b11100b108f107e106d104c109b103a498710461035440302043ce30221821060a9bddbbae302218210e9a2c2cbbae30221821041544811ba002900300033003702fc5b1118d3fffa403001111901111adb3c81010bf8422d598101014133f40a6fa19401d70030925b6de2814aba216eb3f2f4814abb01561bbaf2f42c810101561b59f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814abc216eb3f2f46f280044002a02fa10245f046c221117111a11171116111911161115111811151114111a11141113111911131112111811121111111a11111110111911100f11180f0e111a0e0d11190d0c11180c0b111a0b0a11190a0911180908111a08071119070611180605111a05041119040311180302111a02011119011118814abd111b561ddb3c01ca002b02f601111c01f2f4814abef84201111a01c70501111901f2f4814abf2c810101561d59f40c6fa131b3f2f4111b814ac01119c70501111801f2f41114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c553b10231119025619db3c5b32810101f8234430c8002c002d00d22d8101012259f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814b64216eb3f2f46f28111518810101f45a305210111481010bf459301118a51118111311141067105610451034413001fe55205023cececb3fc9031112031201111e01206e953059f45a30944133f415e21113a4561b811388a8812710a904561c21a1111301a0011111011112a0561a111c111a111b111a1119111a11191118111911181117111811171116111711161115111611151111111511111113111411131112111311120111120101111101002e023c0f11100f10ef10de10cd10bc10ab109a108910781067105610451314db3c002f0048007282080f4240705043700301c855208210472d9d7e5004cb1f12cb3fcb7fcb9fc94343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fc5b1118d33f301117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411194130db3c814b0a561ac200f2f45619db3c814b0b5610c200f2f4814b0cf8416f24135f03820afaf080be00440034003103f4f2f4111711181117111611181116814b0d56191117111611151114111311121111111055e0111adb3c01111a01f2f47056160111100101111a01db3c810101f823561c4033c855205023cb7fcecb3fc9102c561c01206e953059f45a30944133f415e209a4820adc6c00717ff82802111e0201111d01561a01c801ca0191003201f255308210415448105005cb1f13cb3fcb7fcecec9561a431402111d02111c01441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b107a5517004803fe5b1118d33f301117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411194130db3c814b14561ac200f2f45619db3c814b152fc200f2f4814b16f8416f24135f0382086acfc0bef2f40044003400350046814b012c8101012359f40c6fa131b3f2f4814b02810101544b1359f40c6fa131b3f2f401f870810101f823561101c85902cb7fcb3fc9102b561c01206e953059f45a30944133f415e208a482084c4b40717ff82802111e0201111301c855208210415448015004cb1f12cb3fcb7fcec9561b431402111d02111201441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00111711181117111611171116003601741115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef107e10cd10bc10ab109a1089106855050048043ce30221821041544813bae30221821041544803bae30221821041544804ba0038003a003d003f03fe5b1118d33fd37f3001111901111adb3c2a810101561b59f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b1e016eb3f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c30111b814b1f0044003c0039019402baf2f4814b20f84201111bc70501111a01f2f41117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e004802f85b1118d33fd37f3001111901111adb3c814ad6f842561ac705f2f42a810101561b59f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b28016eb3f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100044003b02ca0f11100f550edb3c5b814b29111b21ba01111b01f2f411191fa01117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f111010de10cd10bc10ab109a1089107810671056104510344130003c004800722b8101012259f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2814b32216eb3f2f46f23503e810101f45a300ca50c502d01fc5b1118d33fd37ffa40301118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a091119090811190807111907061119060511190504111904031119030211190201111a01111b003e03fedb3c814b46f8425619c705f2f4814b47f82801111d01c70501111c01f2f41117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d01111a01db3c30111a814b48111bba01111a01f2f411171118111711161117111611151116111500440040004604fe8ffd5b1118d33fd37f3001111901111adb3c814b50f842561ac705f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c30814b51111b21ba01111b01f2f411191ea01117111811171116111711161115111611150044004000410042006a298101012259f40d6fa192306ddf206e92306d9ad0d37fd33f596c126f02e2814b3c216eb3f2f46f22502b810101f45a3009a5090a01741114111511141113111411131112111311121111111211111110111111100f11100f0e0f10cd10bc10ab109a1089107810671056104510344130004803c6e02182103796df2dbae302571a2082100aba5f1dba8eb73057181116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0c0001119c12101111901b0e3025f0f5f0af2c08200430048004702f25b1118d3ff301117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411194130db3c814b69f8416f24135f0382081e8480bef2f4814b65561ac300f2f42c810101561b00440045000e814a9c5615f2f401fa59f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2814b66216eb3f2f46f286c71814b67f8230282015180a012bef2f4814b688101012f02111c59f40c6fa131b301111a01f2f4814b6bf2f0111711181117111611171116111511161115004601481114111511141113111411131112111311121111111211111110111111100f11100f550e00480172814a9bf2f01116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d004800f0c87f01ca00111911181117111611151114111311121111111055e0011118011119ce01111601ce01111401ce01111201ca0001111001ca000ec8cbff1dcbff1bcb3f19cb3f17cb7f15cb7f13f400f400f40001c8f40012cb3f12f40012cb3f12ce13f40013cb0f13ca0013f40013cb0f13ca00cdcdc9ed54020120004a0182020120004b0153020120004c014e020120004d014802f1b2d77b513434800063983e903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c001c0842444502424444c2424444824244444242044402041fc41b84174423041ec41a841644120411c40d904c1c38c34446044684460445c4464445e001f6004e017c1116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c57105f0f6c91004f01f631d0d307f4045902d1013120830782f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce8959f40f6fa192306ddf814b96216eb3f2f4d0d3073120d749814b9721c23ff2f4814b9821a6e0a93802c000f2f4a6e0ab02814b9921c2039321c1119170e2f2f4c821aa0213d7183012cf16005001f0c91118111b11181117111a11171116111911161115111b11151114111a11141113111911131112111b11121111111a11111110111911100f111b0f0e111a0e0d11190d0c111b0c0b111a0b0a11190a09111b0908111a080711190706111b0605111a050411190403111b0302111a02011119018307111c01005102f882f0d9a88ccec79eef59c84b671136a20ece4cd00caaad5bc47e2c208829154ee9e4111bdb3c03111b0302111c0201111a01206e953059f45b30944133f417e27001c85902cb07f400c91116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e005201470142c87001cb076f00016f8c6d6f8c59db3c6f2201c993216eb396016f2259ccc9e831005301f41119111b11191118111a11181117111b11171116111a11161115111b11151114111a11141113111b11131112111a11121111111b11111110111a11100f111b0f0e111a0e0d111b0d0c111a0c0b111b0b0a111a0a09111b0908111a0807111b0706111a0605111b0504111a0403111b0302111a0201111b01111a0054040e561adb3c89db3c0055006b0180006e030e8912db3c21c00400560180005a01fe3c73766720786d6c6e733d22687474703a2f2f7777772e77332e6f72672f323030302f737667222076696577426f783d22302030203130323420313032342220726f6c653d22696d67223e3c646566733e3c6c696e6561724772616469656e742069643d226267222078313d2230222079313d2230222078323d2230222079005701fe323d2231223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223306431313133222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222f3e3c2f6c696e6561724772616469656e743e3c6c696e6561724772616469656e742069643d227465616c2220005801fe78313d2230222079313d2231222078323d2231222079323d2230223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d2223326265366164222f3e3c73746f70206f66667365743d222e3535222073746f702d636f6c6f723d2223333064356230222f3e3c73746f70206f66667365743d2231222073740059004a6f702d636f6c6f723d2223323563393962222f3e3c2f6c696e6561724772616469656e743e04228f043189db3ce30e8b73c2f646566733e8005b01800060014601fe3c6c696e6561724772616469656e742069643d22636f6d6d6f6e2d6c696e65222078313d22313034222079313d2230222078323d22393230222079323d223022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d222330005c01fe6230643066222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e3036222073746f702d636f6c6f723d2223386436373237222073746f702d6f7061636974793d222e3734222f3e3c73746f70206f66667365743d222e35222073746f702d636f6c6f723d2223663063373662222f3e3c73005d01fe746f70206f66667365743d222e3934222073746f702d636f6c6f723d2223386436373237222073746f702d6f7061636974793d222e3734222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222073746f702d6f7061636974793d2230222f3e3c2f6c696e6561724772616469005e01fe656e743e3c6c696e6561724772616469656e742069643d22746965722d74696c65222078313d2230222079313d22333734222078323d2230222079323d2235323622206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d22005f00d623663664393862222f3e3c73746f70206f66667365743d222e3438222073746f702d636f6c6f723d2223643761643537222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223386436373237222f3e3c2f6c696e6561724772616469656e743e031401c0058f0389db3ce30d00610180006501fe3c6c696e6561724772616469656e742069643d22636f6d6d6f6e2d6c696e65222078313d22313034222079313d2230222078323d22393230222079323d223022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d222330006201fe6230643066222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e3036222073746f702d636f6c6f723d2223316532363261222073746f702d6f7061636974793d222e3632222f3e3c73746f70206f66667365743d222e35222073746f702d636f6c6f723d2223333064356230222f3e3c73006301fe746f70206f66667365743d222e3934222073746f702d636f6c6f723d2223316532363261222073746f702d6f7061636974793d222e3632222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222073746f702d6f7061636974793d2230222f3e3c2f6c696e656172477261646900640008656e743e020689db3c0066018001fe3c6c696e6561724772616469656e742069643d22636f6d6d6f6e2d6c696e65222078313d22313034222079313d2230222078323d22393230222079323d223022206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d222330006701fe6230643066222073746f702d6f7061636974793d2230222f3e3c73746f70206f66667365743d222e3036222073746f702d636f6c6f723d2223373237623830222073746f702d6f7061636974793d222e3738222f3e3c73746f70206f66667365743d222e35222073746f702d636f6c6f723d2223653165386536222f3e3c73006801fe746f70206f66667365743d222e3934222073746f702d636f6c6f723d2223373237623830222073746f702d6f7061636974793d222e3738222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223306230643066222073746f702d6f7061636974793d2230222f3e3c2f6c696e6561724772616469006901fe656e743e3c6c696e6561724772616469656e742069643d22746965722d74696c65222078313d2230222079313d22333836222078323d2230222079323d2235313822206772616469656e74556e6974733d227573657253706163654f6e557365223e3c73746f70206f66667365743d2230222073746f702d636f6c6f723d22006a00d623656566346632222f3e3c73746f70206f66667365743d222e3438222073746f702d636f6c6f723d2223623963336333222f3e3c73746f70206f66667365743d2231222073746f702d636f6c6f723d2223363837323739222f3e3c2f6c696e6561724772616469656e743e01fe3c726563742077696474683d223130323422206865696768743d2231303234222066696c6c3d2275726c2823626729222f3e3c7265637420783d2237362220793d223736222077696474683d2238373222206865696768743d22383732222072783d223434222066696c6c3d222331313134313722207374726f6b653d2223006c01fe32383331333622207374726f6b652d77696474683d2232222f3e3c7265637420783d223130342220793d22313034222077696474683d2238313622206865696768743d22383136222072783d223238222066696c6c3d222330623064306622207374726f6b653d222331653236326122207374726f6b652d77696474683d22006d000832222f3e040889db3c89006f01800071007c01fe3c7061746820643d224d313034203130346838313622207374726f6b653d2275726c2823636f6d6d6f6e2d6c696e652922207374726f6b652d77696474683d223622207374726f6b652d6c696e656361703d22726f756e64222f3e3c7061746820643d224d313034203932306838313622207374726f6b653d2275726c28230070008a636f6d6d6f6e2d6c696e652922207374726f6b652d77696474683d223422207374726f6b652d6c696e656361703d22726f756e6422206f7061636974793d222e3434222f3e01fe3c7265637420783d223132342220793d22313232222077696474683d22393422206865696768743d223934222072783d223232222066696c6c3d222331313134313722207374726f6b653d2223316532363261222f3e3c67207472616e73666f726d3d226d617472697828302e31363031353620302030202d302e31363031007201fe3536203133302032313029223e3c706174682066696c6c3d2275726c28237465616c29222066696c6c2d72756c653d226576656e6f64642220643d224d3136372e35203433322e31204c3333302e35203433322e31204c3334362e35203432392e39204c3336342e35203432342e38204c3338302e35203431372e37204c33007301fe39332e35203430392e36204c3430342e35203430312e30204c3431362e30203338392e35204c3432352e38203337362e35204c3433352e39203335382e35204c3434312e37203334332e35204c3434352e39203332352e35204c3434362e39203239362e35204c3434352e38203238352e35204c3434322e38203237312e35007401fe204c3433352e37203235312e35204c3432352e39203233332e35204c3431362e39203232312e35204c3430322e35203230372e31204c3338372e35203139362e31204c3336322e35203138342e31204c3334382e35203138302e31204c3333342e35203137382e30204c3232312e35203137372e32204c3232302e35203739007501fe2e32204c3133372e352037392e34204c3133372e32203133392e35204c3136362e35203134302e32204c3136362e38203137342e35204c3133362e35203137352e31204c3133352e36203137342e35204c3133352e37203136332e35204c3133342e35203136322e38204c3130342e31203136332e35204c3130342e352031007601fe39322e37204c3133342e35203139322e39204c3133352e35203139332e35204c3133352e34203232302e35204c3133362e32203232312e35204c3136362e38203232322e35204c3136362e35203235332e30204c3133352e35203235332e33204c3133342e35203233352e32204c3130352e35203233352e31204c3130342e007701fe31203233362e35204c3130342e33203236342e35204c3133342e35203236352e33204c3133352e35203239322e35204c3139372e35203239322e37204c3139382e34203239332e35204c3139382e30203332332e35204c3136362e38203332342e35204c3136372e33203336342e35204c3139382e34203336352e35204c31007801fe39382e33203339342e35204c3136362e39203339352e35204c3136362e37203433302e35204c3136372e35203433322e31205a204d3130342e35203430372e36204c3133342e39203430372e35204c3133342e35203337372e37204c3130342e35203337372e39204c3130342e35203430372e36205a204d3232312e352033007901fe37322e33204c3232312e35203233372e32204c3332322e35203233372e31204c3332392e35203233382e31204c3334322e35203234322e31204c3335322e35203234372e34204c3335392e35203235322e38204c3336392e36203236332e35204c3337372e30203237352e35204c3338312e35203238382e35204c3338332e007a01fe31203239382e35204c3338322e37203331362e35204c3337392e37203332372e35204c3337342e38203333382e35204c3336382e39203334372e35204c3335382e35203335372e39204c3334342e35203336362e37204c3333322e35203337302e38204c3332322e35203337322e34204c3232312e35203337322e33205a20007b00a04d36352e35203332342e33204c39332e35203332342e33204c39332e39203239342e35204c36342e39203239342e35204c36342e36203332322e35204c36352e35203332342e33205a222f3e3c2f673e0452db3c8d060f1c185d1a08199a5b1b0f4888d98d198dd98d4888190f48a0db3c81012cdb3c8b3222f3e8018001800145007d0410db3c561ac004e30f0180007e0083008e04ee8d1b0f1c9958dd081e0f488dcccc88881e4f488c4ccd08881dda591d1a0f488c4d4d88881a195a59da1d0f488d4e08881c9e0f488c4c8888199a5b1b0f4888cc4dcc4ccc1888881cdd1c9bdad94f4888d90dd8590d4dc8881cdd1c9bdad94b5bdc1858da5d1e4f488b8d8e088bcfa0db3c89db3c81012e0180007f0180008000303c706174682066696c6c3d22236630633736622220643d220414db3c8b3222f3e8db3c89014501800081014601fe3c636972636c652063783d22353132222063793d223531322220723d22323830222066696c6c3d226e6f6e6522207374726f6b653d222364376164353722207374726f6b652d77696474683d223222206f7061636974793d222e3039222f3e3c636972636c652063783d22353132222063793d223531322220723d223231380082007e222066696c6c3d226e6f6e6522207374726f6b653d222366306337366222207374726f6b652d77696474683d223222206f7061636974793d222e3133222f3e020c561ac005e30f0084008904ee8d1b0f1c9958dd081e0f488dcccc88881e4f488c4ccd08881dda591d1a0f488c4d4d88881a195a59da1d0f488d4e08881c9e0f488c4c8888199a5b1b0f4888cc4d0c4dcc5848881cdd1c9bdad94f4888d88e58ccd8ccc8881cdd1c9bdad94b5bdc1858da5d1e4f488b8d8e088bcfa0db3c89db3c81012f018000850180008600303c706174682066696c6c3d22236439653064662220643d220414db3c8b3222f3e8db3c89014501800087014601fe3c636972636c652063783d22353132222063793d223531322220723d22323830222066696c6c3d226e6f6e6522207374726f6b653d222362396333633322207374726f6b652d77696474683d223222206f7061636974793d222e3039222f3e3c636972636c652063783d22353132222063793d223531322220723d223231380088007e222066696c6c3d226e6f6e6522207374726f6b653d222364396530646622207374726f6b652d77696474683d223222206f7061636974793d222e3133222f3e04fc8d15cf1c9958dd081e0f488dcccc88881e4f488c4ccd08881dda591d1a0f488c4d4d88881a195a59da1d0f488d4e08881c9e0f488c4c8888199a5b1b0f4888cc4c4c4d0c4dc8881cdd1c9bdad94f4888cc8e0ccc4ccd888bcfa0db3c8d060f1c185d1a08199a5b1b0f4888ce4d984c4e58c888190f48a0db3c810130db3c018001800145008a040889db3c89008b0180008c01460006222f3e01fe3c636972636c652063783d22353132222063793d223531322220723d22323830222066696c6c3d226e6f6e6522207374726f6b653d222333306435623022207374726f6b652d77696474683d223222206f7061636974793d222e3039222f3e3c636972636c652063783d22353132222063793d223531322220723d22323138008d007e222066696c6c3d226e6f6e6522207374726f6b653d222336363732366422207374726f6b652d77696474683d223222206f7061636974793d222e3133222f3e04a289db3c1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111b561bdb3c8b43c2f673e8008f01800090011b00fe3c7265637420783d223132322220793d22333132222077696474683d2237383022206865696768743d22333530222072783d223332222066696c6c3d2223313131343137222066696c6c2d6f7061636974793d222e393422207374726f6b653d222332383331333622207374726f6b652d77696474683d2232222f3e3c673e046201d07022c0048e88329321c1048ae85be022c0058e88329321c1058ae85be022c1098e88935302b98ae85f03e09320c1080091009c00a900d001f8d307111a111c111a1119111b11191118111c11181117111b11171116111c11161115111b11151114111c11141113111b11131112111c11121111111b11111110111c11100f111b0f0e111c0e0d111b0d0c111c0c0b111b0b0a111c0a09111b0908111c0807111b0706111c0605111b0504111c0403111b0302111c02009201d601111b01561c01111cdb3c111ba41119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354403020093042021e30321c001e30221c002e30201c003009400960098009a02f2318d1c4f1c9958dd081e0f488c4d8e48881e4f488ccdcd08881dda591d1a0f488c4d4c88881a195a59da1d0f488c4d4c88881c9e0f488c8c0888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3c00950119003a6d617472697828302e39372030203020302e393720323435203437382902f2318d1c4f1c9958dd081e0f488ccd0dc8881e4f488ccdcd08881dda591d1a0f488c4d4c88881a195a59da1d0f488c4d4c88881c9e0f488c8c0888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3c00970119003a6d617472697828302e39372030203020302e393720343233203437382902f2318d1c4f1c9958dd081e0f488d4c8d48881e4f488ccdcd08881dda591d1a0f488c4d4c88881a195a59da1d0f488c4d4c88881c9e0f488c8c0888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3c00990119003a6d617472697828302e39372030203020302e393720363031203437382902f88f788d1c4f1c9958dd081e0f488dcc0cc8881e4f488ccdcd08881dda591d1a0f488c4d4c88881a195a59da1d0f488c4d4c88881c9e0f488c8c0888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3ce030009b0119003a6d617472697828302e39372030203020302e393720373739203437382901f8d307111a111c111a1119111b11191118111c11181117111b11171116111c11161115111b11151114111c11141113111b11131112111c11121111111b11111110111c11100f111b0f0e111c0e0d111b0d0c111c0c0b111b0b0a111c0a09111b0908111c0807111b0706111c0605111b0504111c0403111b0302111c02009d01d601111b01561c01111cdb3c111ba41119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035440302009e042021e30321c001e30221c002e30221c003009f00a100a300a502f2318d1c4f1c9958dd081e0f488c4d8c88881e4f488cce0d88881dda591d1a0f488c4ccc88881a195a59da1d0f488c4ccc88881c9e0f488c4dc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3c00a00119003a6d617472697828302e38342030203020302e383420323238203437362902f2318d1c4f1c9958dd081e0f488ccc0d08881e4f488cce0d88881dda591d1a0f488c4ccc88881a195a59da1d0f488c4ccc88881c9e0f488c4dc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3c00a20119003a6d617472697828302e38342030203020302e383420333730203437362902f2318d1c4f1c9958dd081e0f488d0d0d88881e4f488cce0d88881dda591d1a0f488c4ccc88881a195a59da1d0f488c4ccc88881c9e0f488c4dc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3c00a40119003a6d617472697828302e38342030203020302e383420353132203437362903fe8f79318d1c4f1c9958dd081e0f488d4e0e08881e4f488cce0d88881dda591d1a0f488c4ccc88881a195a59da1d0f488c4ccc88881c9e0f488c4dc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3ce001c00400a6011900a7003a6d617472697828302e38342030203020302e383420363534203437362902f88f788d1c4f1c9958dd081e0f488dcccc08881e4f488cce0d88881dda591d1a0f488c4ccc88881a195a59da1d0f488c4ccc88881c9e0f488c4dc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f489d5c9b0a08dd1a595c8b5d1a5b194a48881cdd1c9bdad94b5dda591d1a0f488d088bcfa08958db3ce03000a80119003a6d617472697828302e38342030203020302e383420373936203437362901fa01d307111a111d111a1119111c11191118111b11181117111d11171116111c11161115111b11151114111d11141113111c11131112111b11121111111d11111110111c11100f111b0f0e111d0e0d111c0d0c111b0c0b111d0b0a111c0a09111b0908111d0807111c0706111b0605111d0504111c0403111b0302111d0200aa01e001111c01561b01561e01111edb3c111ca41119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645401300ab032aeda2edfb22c006e30022c007e30002c008915be30d00ac00b200c004fc218f726c218d19cf1c9958dd081e0f488c8d4c88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c00200c3011900ad00ae02e46c218d19cf1c9958dd081e0f488ccd0c08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100c5011904fa8f726c218d19cf1c9958dd081e0f488d0c8e08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c003e30221c00400c7011900af00b002e46c218d19cf1c9958dd081e0f488d4c4d88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100c9011903f48f726c218d19cf1c9958dd081e0f488d8c0d08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c005e30200cb011900b102e46c218d19cf1c9958dd081e0f488d8e4c88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100cd011904fc218f726c218d19cf1c9958dd081e0f488c8c0e08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c00200b3011900b400b6003a6d617472697828302e35322030203020302e353220323438203437342902e46c218d19cf1c9958dd081e0f488c8e4d88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100b50119003a6d617472697828302e35322030203020302e353220333336203437342904fa8f726c218d19cf1c9958dd081e0f488cce0d08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c003e30221c00400b7011900b800ba003a6d617472697828302e35322030203020302e353220343234203437342902e46c218d19cf1c9958dd081e0f488d0dcc88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100b90119003a6d617472697828302e35322030203020302e353220353132203437342904fa8f726c218d19cf1c9958dd081e0f488d4d8c08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c005e30221c00600bb011900bc00be003a6d617472697828302e35322030203020302e353220363030203437342902e46c218d19cf1c9958dd081e0f488d8d0e08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100bd0119003a6d617472697828302e35322030203020302e353220363838203437342902ea8f726c218d19cf1c9958dd081e0f488dcccd88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e000bf0119003a6d617472697828302e35322030203020302e353220373736203437342904fa208f71308d19cf1c9958dd081e0f488c4d8d08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e120c001e30220c00200c1011900c200c4003a6d617472697828302e35322030203020302e353220323034203437342902e2308d19cf1c9958dd081e0f488c8d4c88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100c30119003a6d617472697828302e35322030203020302e353220323932203437342904f88f71308d19cf1c9958dd081e0f488ccd0c08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e020c003e30220c00400c5011900c600c8003a6d617472697828302e35322030203020302e353220333830203437342902e2308d19cf1c9958dd081e0f488d0c8e08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100c70119003a6d617472697828302e35322030203020302e353220343638203437342904f88f71308d19cf1c9958dd081e0f488d4c4d88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e020c005e30220c00600c9011900ca00cc003a6d617472697828302e35322030203020302e353220353536203437342902e2308d19cf1c9958dd081e0f488d8c0d08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100cb0119003a6d617472697828302e35322030203020302e353220363434203437342903f28f71308d19cf1c9958dd081e0f488d8e4c88881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e0c007e3023000cd011900ce003a6d617472697828302e35322030203020302e353220373332203437342902e08d19cf1c9958dd081e0f488dce0c08881e4f488d0c4e08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100cf0119003a6d617472697828302e35322030203020302e3532203832302034373429021e8ae8307002a6f8935320b98ae85f0300d100e301fa01d307111a111d111a1119111c11191118111b11181117111d11171116111c11161115111b11151114111d11141113111c11131112111b11121111111d11111110111c11100f111b0f0e111d0e0d111c0d0c111b0c0b111d0b0a111c0a09111b0908111d0807111c0706111b0605111d0504111c0403111b0302111d0200d201da01111c01561d01111ddb3c111ca41119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645401300d304f6218f6f318d19cf1c9958dd081e0f488c4d8d08881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3ce121c001e30221c00200d4011900d500d7003a6d617472697828302e35322030203020302e353220323034203432382902de318d19cf1c9958dd081e0f488c8d4c88881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3c00d60119003a6d617472697828302e35322030203020302e353220323932203432382904f48f6f318d19cf1c9958dd081e0f488ccd0c08881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3ce021c003e30221c00400d8011900d900db003a6d617472697828302e35322030203020302e353220333830203432382902de318d19cf1c9958dd081e0f488d0c8e08881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3c00da0119003a6d617472697828302e35322030203020302e353220343638203432382904f48f6f318d19cf1c9958dd081e0f488d4c4d88881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3ce021c005e30221c00600dc011900dd00df003a6d617472697828302e35322030203020302e353220353536203432382902de318d19cf1c9958dd081e0f488d8c0d08881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3c00de0119003a6d617472697828302e35322030203020302e353220363434203432382903f08f6f318d19cf1c9958dd081e0f488d8e4c88881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3ce001c007e3023000e0011900e1003a6d617472697828302e35322030203020302e353220373332203432382902dc8d19cf1c9958dd081e0f488dce0c08881e4f488ccdcc88881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3c00e20119003a6d617472697828302e35322030203020302e353220383230203432382901fa01d307111a111d111a1119111c11191118111b11181117111d11171116111c11161115111b11151114111d11141113111c11131112111b11121111111d11111110111c11100f111b0f0e111d0e0d111c0d0c111b0c0b111d0b0a111c0a09111b0908111d0807111c0706111b0605111d0504111c0403111b0302111d0200e401e401111c01561d01561c01111edb3c111aa41119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036401550330400e5042ceda2edfb22c001e30022c002e30022c003e30022c00400e600e700e800ea02ec218f726c218d19cf1c9958dd081e0f488d0dcc88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e10102011903f6218f726c218d19cf1c9958dd081e0f488d0c8e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e3020110011900f704fc218f726c218d19cf1c9958dd081e0f488cce0d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c00201000119010100e902ea8f726c218d19cf1c9958dd081e0f488d4d8c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e001040119041ee30022c005e30022c006e30022c00700eb00ef00f400fa04fc218f726c218d19cf1c9958dd081e0f488ccd0c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c002010e011900ec00ed02e46c218d19cf1c9958dd081e0f488d0c8e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb310110011903f48f726c218d19cf1c9958dd081e0f488d4c4d88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c003e3020112011900ee02e46c218d19cf1c9958dd081e0f488d8c0d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb310114011904fc218f726c218d19cf1c9958dd081e0f488c8e4d88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c00200fe011900f000f102e46c218d19cf1c9958dd081e0f488cce0d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb310100011904fa8f726c218d19cf1c9958dd081e0f488d0dcc88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c003e30221c0040102011900f200f302e46c218d19cf1c9958dd081e0f488d4d8c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb310104011902ea8f726c218d19cf1c9958dd081e0f488d8d0e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e00106011904fc218f726c218d19cf1c9958dd081e0f488c8d4c88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c002010c011900f500f602e46c218d19cf1c9958dd081e0f488ccd0c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31010e011904fa8f726c218d19cf1c9958dd081e0f488d0c8e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c003e30221c0040110011900f700f802e46c218d19cf1c9958dd081e0f488d4c4d88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb310112011903f48f726c218d19cf1c9958dd081e0f488d8c0d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c005e3020114011900f902e46c218d19cf1c9958dd081e0f488d8e4c88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31011601190212e30002c008915be30d00fb010904fc218f726c218d19cf1c9958dd081e0f488c8c0e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e121c001e30221c00200fc011900fd00ff003a6d617472697828302e35322030203020302e353220323438203532302902e46c218d19cf1c9958dd081e0f488c8e4d88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3100fe0119003a6d617472697828302e35322030203020302e353220333336203532302904fa8f726c218d19cf1c9958dd081e0f488cce0d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c003e30221c0040100011901010103003a6d617472697828302e35322030203020302e353220343234203532302902e46c218d19cf1c9958dd081e0f488d0dcc88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3101020119003a6d617472697828302e35322030203020302e353220353132203532302904fa8f726c218d19cf1c9958dd081e0f488d4d8c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e021c005e30221c0060104011901050107003a6d617472697828302e35322030203020302e353220363030203532302902e46c218d19cf1c9958dd081e0f488d8d0e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3101060119003a6d617472697828302e35322030203020302e353220363838203532302902ea8f726c218d19cf1c9958dd081e0f488dcccd88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e001080119003a6d617472697828302e35322030203020302e353220373736203532302904fa208f71308d19cf1c9958dd081e0f488c4d8d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e120c001e30220c002010a0119010b010d003a6d617472697828302e35322030203020302e353220323034203532302902e2308d19cf1c9958dd081e0f488c8d4c88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31010c0119003a6d617472697828302e35322030203020302e353220323932203532302904f88f71308d19cf1c9958dd081e0f488ccd0c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e020c003e30220c004010e0119010f0111003a6d617472697828302e35322030203020302e353220333830203532302902e2308d19cf1c9958dd081e0f488d0c8e08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3101100119003a6d617472697828302e35322030203020302e353220343638203532302904f88f71308d19cf1c9958dd081e0f488d4c4d88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e020c005e30220c0060112011901130115003a6d617472697828302e35322030203020302e353220353536203532302902e2308d19cf1c9958dd081e0f488d8c0d08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3101140119003a6d617472697828302e35322030203020302e353220363434203532302903f28f71308d19cf1c9958dd081e0f488d8e4c88881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb31e0c007e30230011601190117003a6d617472697828302e35322030203020302e353220373332203532302902e08d19cf1c9958dd081e0f488dce0c08881e4f488d0d8d08881dda591d1a0f488e0c08881a195a59da1d0f488e0c08881c9e0f488c4cc888199a5b1b0f4888cc4d4c584c5908881cdd1c9bdad94f4888cc8e0ccc4ccd88881cdd1c9bdad94b5dda591d1a0f488c888bcfa08958db3cdb3101180119003a6d617472697828302e35322030203020302e353220383230203532302904645adb3c8d080f1c185d1a08199a5b1b0f4888d98d198dd98d48881d1c985b9cd99bdc9b4f48a0db3c58db3c8b52220643d228018001800180011a0318db3c01db3c8b3222f3e8db3c0180014501800418db3c561ac004e30f561ac0040180011c011d012003528d060f1c185d1a08199a5b1b0f4888d98c18cdcd988888190f48a0db3c81012ddb3c8b3222f3e8db3c018001450180020c561ac005e30f011e011f03528d060f1c185d1a08199a5b1b0f4888d90e594c19198888190f48a0db3c81012ddb3c8b3222f3e8db3c01800145018003528d060f1c185d1a08199a5b1b0f4888cccc190d588c0888190f48a0db3c81012ddb3c8b3222f3e8db3c01800145018004f88f6c561ac0058ee48d17cf1c185d1a08190f48934c4dcd880d8c4c9a0d8dcc88881cdd1c9bdad94f4888cccc190d588c08881cdd1c9bdad94b5dda591d1a0f488d08881cdd1c9bdad94b5b1a5b9958d85c0f489c9bdd5b9908881bdc1858da5d1e4f488b8d8d488bcfa0db3ce30de30d1119111a1119111811191118018001210122012301c88d17cf1c185d1a08190f48934c4dcd880d8c4c9a0d8dcc88881cdd1c9bdad94f4888d88e58ccd8ccc8881cdd1c9bdad94b5dda591d1a0f488d08881cdd1c9bdad94b5b1a5b9958d85c0f489c9bdd5b9908881bdc1858da5d1e4f488b8dcc088bcfa0db3c018001c88d17cf1c185d1a08190f48934c4dcd880d8c4c9a0d8dcc88881cdd1c9bdad94f4888d90dd8590d4dc8881cdd1c9bdad94b5dda591d1a0f488d08881cdd1c9bdad94b5b1a5b9958d85c0f489c9bdd5b9908881bdc1858da5d1e4f488b8dcc088bcfa0db3c018004ca1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c8d060f1c185d1a08199a5b1b0f4888cd8d8dcc8d990888190f48a0db3c810131db3c8b9222f3e3c2f7376673e80124018001450146042420c004e30220c005e30220c006e30220c00701250128012b012c0492308d0dcf1c185d1a08199a5b1b0f4888d88dd8584e1948881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0cce0d080d8d0c0a4888190f48a0db3c8100ccdb3c8b3222f3e8db3c0180014501800126041a89db3c810132db3c8b3222f3e80127018001450146006e3c706174682066696c6c3d222362376161386522207472616e73666f726d3d227472616e736c6174652833393720363430292220643d220492308d0dcf1c185d1a08199a5b1b0f4888d859588e188e08881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0cce0d080d8d0c0a4888190f48a0db3c8100cddb3c8b3222f3e8db3c0180014501800129041a89db3c810132db3c8b3222f3e8012a018001450146006e3c706174682066696c6c3d222361656238623822207472616e73666f726d3d227472616e736c6174652833393720363430292220643d220492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd4d080d8d0c0a4888190f48a0db3c8100cedb3c8b3222f3e8db3c0180014501800130041ee30220c008e30220c009e30220c00a012d012e012f01320492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd4d080d8d0c0a4888190f48a0db3c8100cfdb3c8b3222f3e8db3c01800145018001300492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd4d080d8d0c0a4888190f48a0db3c8100d0db3c8b3222f3e8db3c01800145018001300492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd4d080d8d0c0a4888190f48a0db3c8100d1db3c8b3222f3e8db3c0180014501800130041a89db3c810133db3c8b3222f3e80131018001450146006e3c706174682066696c6c3d222339366131396322207472616e73666f726d3d227472616e736c6174652833363720363430292220643d22041ee30220c00be30220c00ce30220c00d01330135013701390492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c0180014501800134041a89db3c8100c8db3c8b3222f3e801430180014501440492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c0180014501800136041a89db3c8100c9db3c8b3222f3e801430180014501440492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c0180014501800138041a89db3c8100cadb3c8b3222f3e80143018001450144041ce30220c00ee30220c00fe302c010013a013c013e01400492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c018001450180013b041a89db3c8100cbdb3c8b3222f3e801430180014501440492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c018001450180013d041a89db3c8100ccdb3c8b3222f3e801430180014501440492308d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c018001450180013f041a89db3c8100cddb3c8b3222f3e801430180014501440104e302014104908d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccd0e080d8d0c0a4888190f48a0db3c8100c9db3c8b3222f3e8db3c0180014501800142041a89db3c8100cedb3c8b3222f3e80143018001450144006e3c706174682066696c6c3d222339366131396322207472616e73666f726d3d227472616e736c6174652833363120363430292220643d220490db3c8d0dcf1c185d1a08199a5b1b0f4888ce4d984c4e58c8881d1c985b9cd99bdc9b4f489d1c985b9cdb185d194a0ccdcd080d8d0c0a4888190f48a0db3c810133db3c8b3222f3e8018001800145014601308010280259f40f6fa192306ddf206eb38e83d0db3c9130e201800104db3c018000360d11100d10cf10be10ad109c108b107a10691058104710364540120201200149014c02f1ae7af6a268690000c7307d207d207d2069006a00e8408080eb80408080eb807d2018081b881b081a881a03e8aa82b6b6b6b6b6b6b6b8382a38002a3800381084888a0484888984848889048488888484088804083f8837082e8846083d8835082c88240823881b2098387186888c088c888c088b888c088bc001f6014a01701116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6c996c996c79014b00a68101012e0259f40d6fa192306ddf206e92306d8e23d0d33fd39ffa40d3ffd37fd401d0fa40d37fd33f30103810371036103510346c186f08e2206e8e103070705470005300561f044313562002e06f287f557002e9adb1f6a268690000c7307d207d207d2069006a00e8408080eb80408080eb807d2018081b881b081a881a03e8aa82b6b6b6b6b6b6b6b8382a38002a3800381084888a0484888984848889048488888484088804083f8837082e8846083d8835082c88240823881b2098387186ed9e2b882f87b648c001f6014d00022002016e014f015202f0ab9fed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30d11181119111811171118111701f60150016c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cc46cd4015100648101012f0259f40d6fa192306ddf206e92306d9dd0fa40fa40d33f55206c136f03e2206e9730705619561a70e06f237f552002f0aa13ed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30d11181119111811171118111701f6015e0201200154015d0201200155015702e5b3b5fb513434800063983e903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c001c0842444502424444c2424444824244444242044402041fc41b84174423041ec41a841644120411c40d904c1c38c376cf1b3cdb28e001f60156004e7580648d0860039649ab5829dd039c8f539e26f51bc75e976dae3bcde9800682bcb6e7b93e19c402f1b173bb513434800063983e903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c001c0842444502424444c2424444824244444242044402041fc41b84174423041ec41a841644120411c40d904c1c38c34446044644460445c4460445e001f6015801781116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c571257105f0f50895f08015904f41118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b0a11190a09111909111908070655405619db3ce3037f111adb3c01111a011119111a11191118111911181117111811170167015a015b015c00bc571970701119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103410230060814a4221c203f2f4814a4321c111f2f420c0049930822009184e72a000e0c005978218e8d4a51000e08218174876e80000901116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034102302f1b4f47da89a1a400031cc1f481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadadadadae0e0a8e000a8e000e042122228121222261212222412122222121022201020fe20dc20ba211820f620d420b22090208e206c8260e1c61a223022322230222e2230222f001f6015e01701116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6c91015f0104db3c0160017a814a4c21c200f2f4f828fa4430f82858db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d00161011e88c87001ca005a02ce810101cf00c901620114ff00f4a413f4bcf2c80b01630201620164017403f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019fd200fa40fa40d3ffd307d455506c168e1cfa40810101d7005902d10181465121c300f2f4702270c8c910351024e207925f07e07026d74920c21f953106d31f07de218210554e494ebae302218210639cfc6cbae302218210554e5052ba0165016a016c04c05b05fa40d30781465af84226c705f2f481465b27b3f2f410465e32505781465c5197db3c1af2f481465d543968db3c1af2f481465e5198db3c355b335112ba16f2f481465ff8416f24135f0382083d0900bef2f47fc85005cf16c9104510341201ca01660168016901deeda2edfb555127db3c936c2670e126d74928aa02bd936c2670e026c702936c2670e170935308b98e3907d30721c2609321c17b9170e222c22f9322c13a9170e223c02d92337f9303c05fe20192327f9102e292317f9101e296306c2670db31e107a4e8303705c700104610354430120167001420c20392c111923070e20020c88210c5cc7cd601cb1f01cf16c9f9000130db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed54016b01905b3581466424f2f4814665f8416f24135f0382083d0900bef2f4814666f8416f24135f038209312d00bbf2f410355512db3cc87f01ca0055505056ca0013cececbffcb07ccc9ed54016b006a82082dc6c07f715357c8598210bba3ec195003cb1fcbffcec92755304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002c4e3022182105fcc3d14bae3023720821027acdf8bba8e1c303510355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e0c00006c12116b08e1f8146b3f2f010355512c87f01ca0055505056ca0013cececbffcb07ccc9ed54e05f06f2c082016d016f02fc5b05d33ffa403081467826f2f450561443308146795187db3c19f2f481467af8416f24135f0382085b8d80bef2f481467bf8416f24135f038209312d00bbf2f482084c4b40717f2ad0542950546860c855408210554e504f5006cb1f14cb3f12cbffcecb07cec91049413018441359c8cf8580ca00cf8440ce01fa02806a01ca016e0044cf40f400c901fb0045334414c87f01ca0055505056ca0013cececbffcb07ccc9ed5403fc5b05d33f81466e26f2f481466ff84226c705f2f4fa4010465e3250578146705196db3c1af2f427d70b01c3006d218e943008fa4010461035465681467151b6db3c1cf2f4990972d7210644941513e206d2000192d431defa008208989680f8416f24fa40fa0071d721fa00fa00306c6170f83aaa00b609f8416f24135f0301ca01ca017003f282081e8480a123a101a181467321c2fff2f45392c2008ec5104745737150ae7007db3c544d99c85520821005138d915004cb1f12cb3fcecec9104b103a4e60441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00491346569336395be2089625820186a0be9170e2951026333430e30d10354413017101720173001820c700973070c8ca00c9d0e00064717008c8018210d53276db58cb1fcb3fc9104510374180441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003002cc87f01ca0055505056ca0013cececbffcb07ccc9ed54020120017501780177be9d6f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3633c017601285475435475435555db3c106c105b104a103948700177001a21c0049171e021c0059172e0730177bc7e7f6a268690000cfe9007d207d2069ffe983ea2aa8360b470e7d20408080eb802c816880c0a32890e180797a3811386464881a8812716d9e3632c01790130547523271059104810374698db3c104810374a90106a1059017a03f655226d8307507682f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce8906db3c10394870206e953059f45b30944133f417e28307507682f0c9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd10406db3c10394870206e953059f45b30944133f417e27001017b017c01810026c87001cb0721d0cf1682102e61746801cb1fc90242c87001cb076f00016f8c6d6f8c89db3c6f2201c993216eb396016f2259ccc9e831017d018001fe5072697661746520636f72726573706f6e64656e636520697320612072696768742c206e6f7420612070726976696c6567652e2054686973206973206120757365726e616d65204e465420666f7220506c6174686f20e280942074686520616e6f6e796d6f75732c20706f73742d7175616e74756d2d656e63727970746564017e01fe2c20756e63656e736f7261626c65206d657373656e6765722e2041207065726d616e656e742c207472616e7366657261626c652c2066756c6c79206f6e2d636861696e2068616e646c653a20746865206e616d65206f746865727320726561636820796f752062792c2068656c64206279206e6f206f6e652062757420796f017f001a752e20706c6174686f2e61707000b620d74a21d7499720c20022c200b18e48036f22807f22cf31ab02a105ab025155b60820c2009a20aa0215d71803ce4014de596f025341a1c20099c8016f025044a1aa028e123133c20099d430d020d74a21d749927020e2e2e85f030018c85902cb07f400c910364540020120018301e70201200184018d02e5b60b7da89a1a400031cc1f481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadadadadae0e0a8e000a8e000e042122228121222261212222412122222121022201020fe20dc20ba211820f620d420b22090208e206c8260e1c61bb678d9e6d947001f6018502ec1117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d0c11180c0b11180b0a11180a09111809111808070655407f1119db3c01111a015617111a111b111a1119111a11191118111911181117111811170186018c01de814ba021f2f41115111811151114111711141113111611131112111811121111111711111110111611100f11180f0e11170e0d11160d0c11180c0b11170b0a11160a09111809081117080711160706111806051117050411160403111803021117020111160111186d111883071118018703f282f082a3537ff0dbce7eec35d69edc3a189ee6f17d82f353a553f9aa96cb0be3ce89111bdb3c03111b0302111a0201111c01206e953059f45b30944133f417e211188307111882f0c9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104111b71db3c03111b0302111a0201111c010188018b01890036c87001cb078270506c6174686f20757365726e616d657301cb7fc902fe206e953059f45b30944133f417e211188307111882f06105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d111b72db3c03111b0302111a0201111c01206e953059f45b30944133f417e211188307111882f05ef8ba599c69728c698d4cdca2040e121acb2aa9b6d4a2c8af02dd0b91398ce7111b018b018a01e673db3c03111b0302111a0201111c01206e953059f45b30944133f417e27001c85902cb07f400c91116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a10691058104710364540018b002a8010240259f40f6fa192306ddf814ba1216eb3f2f4008c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034020166018e01e402f0a821ed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30d11181119111811171118111701f6018f01701116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6c9101900104db3c0191016a20fa44307058561adb3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d00192012488c87001ca0055215023810101cf00cecec901930114ff00f4a413f4bcf2c80b0194020162019501dd04f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de207e3027026d74920c21f953106d31f07de21821041544801bae30221821041544805bae30221821041544810ba019601a001a201a304cc058020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821041544815bae3022082104154481dba0197019b0198019900e230d33fd37f59328136b3f84225c705f2f48136b422c200f2f45151a0708040077f04c8598210415448045003cb1fcb3fcb7fc92643144800441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54015c30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54019b04f88eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e02082104154481bba8eae30d33fd37f593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0208210178d4519bae302208210472d9d7dba019b019b019a019d015c30d33ffa00593210571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54019b02ea81378c21c200f2f4f84210685e34103748705280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e281378d216eb3f2f46f243081378e511bbaf2f481378ff8425003c70512f2f402810101f45a305167a0f8285220c705b3941028375be30d1045551201d8019c006e7080400a7f0ac8598210415448135003cb1fcb3fcb7fc9134a4019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104503fc8eb830d33fd39f5932813800f84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e020821089129d60ba8eb830d33fd39f59328138eaf84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0019f019f019e01868210a11a7002ba8eb7d33fd39f593281394ef84226c705f2f410571046103510244300db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f07019f03a655515376db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2813801216eb3f2f46f25135f0355512981380209db3c29ba18f2f4104810374614403305db3c01e001da01d201fe5b05d33fd37ffa40308136b0f84227c705f2f48136b122c200f2f48136b25372bef2f48136b55316c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15172a1715414377f04c855308210415448025005cb1f13cb3fcb7fcecec92504085520441359c8cf8580ca00cf8440ce01fa0201a10052806acf40f400c901fb0010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401f05b05d33fd37ffa4030813840f84226c705f2f481384122c200f2f481384227c000f2f4813843f8416f24135f0382082dc6c0bef2f45161a082080f42407004705148c855208210415448065004cb1f12cb3fcb7fcec910484830441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001035551201cd043ce30221821041544814bae3022182104154481cbae3022182104154481aba01a401a601aa01ae04d25b05d33fd37ffa40fa4030813778f84228c705f2f48137795317c705f2f410575e3346895389db3c81377a27c200f2f481377b5367bef2f4820adc6c0081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a1555029db3c705410b5db3c5551547a9b2f01b601d401e301a501fedb3c5159a17f541ba5700fc855308210415448125005cb1f13cb3fcb7fcecec9106b10581049103c47b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010354044c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401d704fe5b05d33fd37ffa40fa40d430d0fa40d37f308137dcf8422ac705f2f48137dd5339c705f2f48137de5324c705f2f410591048103746ab5376db3c8137df29c200f2f48137e02cc200f2f48137e15369bef2f48137e22c8209c9c380bef2f42bdb3c208208989680a08137e3f8416f24135f0322bef2f4555129db3c705410b501b601a701d401a8003082080f4240a082080f4240a082086acfc0a08209312d00a003fedb3c5551547dcb2ddb3c515ca150dc7f7126544d30011112011113c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104d103e4a80103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0301e301d701a9014e01a11047104610354440db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401b404fe5b05d33fd37ffa40fa40d37fd430d0fa40d3078138d6f8422cc705f2f48138d7535bc705f2f4105b104a103948cd53badb3c55408138d85169db3c17f2f48138d927c200f2f48138da2ac200f2f48138db5357bef2f48138dc2a8209c9c380bef2f4550429db3c208208989680a08138ddf8416f24135f0322bef2f455512d01b601ca01b001ab04f4db3c705410f5db3c5551547baf5611db3c515aa1103b102a7f7126045611040311110302111002011114011115c8557082104154481d5009cb1f17cb3f15cb7f13cececb7f01c8ce12cb0712cecdc9106c105c104a10394a90103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf8101d401e301d701ac02668ae2f400c901fb00f8416f24135f035006a146505e21db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401ad01b4001a58cf8680cf8480f400f400cf81043ce3022182100f8a7ea5bae30221821041544812bae302218210178d4519ba01af01b501b801ba04fc5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd3073081393af8422fc705f2f481393b538ec705f2f4105e104d103c102b1110541f0828db3c554081393c516fdb3c17f2f481393d2ac200f2f481393e27c200f2f481393f535abef2f4813940278209c9c380bef2f4550426db3c208208989680a081394101b601ca01b001b1003c82082dc6c0a082080f4240a082086acfc0a08209312d00a082081e8480a00486f8416f24135f0322bef2f455512adb3c705410c5db3c5551547edc2edb3c515da1106e105d7f71536d07106e05111605041115040311140302111302011117011118c801d401e301d701b202e055a0db3cc91035104a10394180103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f0358a110471045103412db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401b301b4005482104154481b500ccb1f1acb3f18cb7f16ce14ce12cb7f01c8ce12cbff12cb3f12cb7f12cb0f12cb07cd004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe5b05d33ffa00fa40fa40f40431fa0081396cf8422ac705f2f410591048103746ab5376db3c81396d29c200f2f481396e5369bef2f481396f2bc000917f972b8209c9c380bee2f2f48209c9c3802ba08209406f40a082081e8480a0813970f8416f24135f0358bef2f4f8416f24135f0382081e8480a1555028db3c705410a501b601d401b7035410478139082705104710394078db3c17f2f4550481390908db3c18f2f4550581390a07db3c17f2f4550401ca01ca01ca03f0db3c5551547cba2cdb3c515ba14cb07f70264c13011110011111c855508210178d45195007cb1f15cb3f5003fa02cece01fa02cec9106810581047103b4870103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0055200401e301d701cd02fe5b05d33fd37ffa40fa403081378223c200f2f4813783f84210691058104710394ab9db3c19c7051af2f4813784f8416f24135f0382098cba80bef2f45134a082082dc6c071705387c8598210415448115003cb1fcb3fcb7fc9104b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071077001d401b9009e07c8598210415448115003cb1fcb3fcb7fc944304760441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010455512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54043ce30221821041544815bae3022182104154481dbae3022182104154481bba01bb01bf01c401c704c65b05d33ffa00fa40fa40fa0081397625c200f2f4813977f842105b104a103948cd2bdb3c1ec7051cf2f455030a81397851cadb3c1df2f427c2008e1a363881397df8416f24135f0382095ef3c0bef2f45128a0074414e30df842107846504a405441aa01d401ca01bc01bd00cc813979288209c9c380bef2f481397af8416f24135f032982080f4240a082086acfc0a0bef2f4514aa0717027544d3a1dc8553082107362d09c5005cb1f13cb3f01fa02cecec9245139034c9c441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001e8db3cf8416f24135f030982080f4240a082080f4240a019be8e3782080f4240717009c8018210d53276db58cb1fcb3fc91048413019441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001034923535e245334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5401be006c82080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0004fa5b05d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842105b104a103948cd2bdb3c1ec7051cf2f48137e85383c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a08209312d00a0bef2f410354014503b541a0a2adb3c555053b6db3c8137eb2401d401da01e001c001fc8101012359f40c6fa131b3f2f48137ec298209c9c380bef2f48137ed238101012359f40c6fa131b3f2f4516da081010182080f4240f8232e544e30561201c855405045ce12cecb3fcb7fcb3fc910354180206e953059f45a30944133f415e2717f544d9052fec855308210472d9d7d5005cb1f13cb3fcb9fcb7fcec9104901c102fc10384b70441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053abc8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f42407109700bc8598210415448115003cb1fcb3fcb7fc9443049a0441359c8cf8580ca008901c201c3000110005acf16ce01fa02806acf40f400c901fb004430c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404f45b05d33fd37ffa40fa40d37fd430d0fa40d3078138e027c200f2f48138e1f842105d104c103b4aef27db3c01111001c7051ef2f48138e22cc200f2f48138e3f8416f24135f032d82082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030c8138e451ebdb3c1ff2f45504543d7ddb3c5550538601d401ca01da01c502f8db3c8138e5248101012359f40c6fa131b3f2f48138e62e8209c9c380bef2f48138e7238101012359f40c6fa131b3f2f45168a081010182082dc6c0f823561203021112020111120152c01113c855405045ce12cecb3fcb7fcb3fc910344f70206e953059f45a30944133f415e2717f295159105904031111034edcc801e001c601f05560821089129d605008cb1f16cb3f14cb9f12cb7fcececb07cec9544114103a4c99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004003050401cd04f8e30221821041544811ba8f6e5b05d33fd37f308137a021c200f2f4f84210671056104510344880db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd33f55306c146f04e28137a1216eb3f2f46f2430318137a20aba19f2f48137a3f8425009c70518f2f416810101f45a30104510344130e02101c801d801cd01ce02fe5b05d33fd37ffa40fa40d37fd430d0fa40d3ffd33fd37fd30fd307308139442ac200f2f4813945f84205111005104f103e102d0111110111122adb3c01111301c70501111101f2f481394627c200f2f4813947f8416f24135f032882082dc6c0a082080f4240a082086acfc0a08209312d00a0bef2f455030f81394811112601d401c904fcdb3c01111201f2f45504111053a8db3c555053b6db3c813949248101012359f40c6fa131b3f2f481394a298209c9c380bef2f481394b238101012359f40c6fa131b3f2f4516ba081010182082dc6c0f8232d4dd352fec855405045ce12cecb3fcb7fcb3fc910344a70206e953059f45a30944133f415e2717f2c08517c0701ca01da01e001cb000afa4430c00001fe106c05111405041113040311120302111102011110010fc855908210a11a7002500bcb1f19cb3f17cb9f15cb7f13cece01c8cbff12cb3f12cb7f12cb0f12cb07cdc92643144a99441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071047004c8598210415448115003cb1fcb3fcb7fc9443001cc0072441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0044145053c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed540036c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5404c48210472d9d7ebae3022182104154481eba8ebb5b05d33fd37fd39f3081380af84227c705f2f41068105710461035103401db3cc87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0218210504e5052bae3023720821041544807ba01cf01d201d901dc04f65b05d33fd37fd39f30813804f84227c705f2f481380522c200f2f410561046103646785368db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206ee3026f2530813807511dbaf2f410591048103746982a81380808db3c500dba16f2f48101015415005467c001e001d001da01d10090303738810101530150884133f40c6fa19401d70030925b6de2813806216eb3f2f481380907ba16f2f445334414c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400dc216e955b59f45a3098c801cf004133f442e25054810101f45a307108700ac8598210415448115003cb1fcb3fcb7fc9104710364890441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003444405c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5403f68137fa21c200f2f455525387db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e28137fc216eb3f2f46f25308137fff8416f24135f03820889544024a0bef2f48137fb53bcbef2f48137fd511cbaf2f455448137fe543ad8db3c2dba1bf2f4514aa1508881010101e001da01d304f2f45a3010574014541386db3c705385db3c10685e3410374870545ee9db3c539b82082dc6c0ba955b3839f8288e3d717011112fc8598210415448135003cb1fcb3fcb7fc9104d103e1201111101441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00090c0807e21046103544304970546cb052b001d401e301d501d6016820fa4430705826db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d001e30030c882104154524601cb1f13cb3fcb9f01cf16c9f900a9383f01c4db3c707f541db680400bc855308210415448125005cb1f13cb3fcb7fcecec91069105c104a103847b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0041050401d701901069105810471039487927db3c813796228101012359f40c6fa131b3f2f4810101f82310394ba0c855305034cececb7fcb3fc910364780206e953059f45a30944133f415e245401201d80026c8821041544f4701cb1f12cb3f01cf16c9f90003f65b05d33fd39f3081380df8416f24135f0382081e8480bef2f454167628db3c238101012259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e281380e216eb3f2f46f2533106a1059104810374a9b81380f08db3c500cba16f2f4813810f8230982015180a019be18f2f48138110601e001da01db002cc8821041544e4901cb1f12cb3f01cf16c9f900a9389f009882082dc6c0bd16f2f48101012010345445135099216e955b59f45a3098c801cf004133f442e25024810101f45a30403305c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed5400ae8e21303510355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e0c00006c12116b08e248132c8f2f010355512c87f01ca0055505056cb7f13cecef40001c8f40012f400cdc9ed54e05f06f2c08202014801de01e1017dbb1c5ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de25515db3c6c65801df0178db3c810101240259f40d6fa192306ddf206e92306d8e11d0fa40fa40d33fd37fd33f55406c156f05e2206e983070705456002802e06f25327f04431301e00002310179bbb02ed44d0d200018e1ad37ffa40fa40f404d401d0f404f4043010261025102410236c168e11810101d700fa40fa40552003d1586d6d6de2db3c6c64801e20116705354db3c30546660526001e30026f82ac87001ca0055215023810101cf00cecec902f0a83fed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30d11181119111811171118111701f601e5016c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf36ca301e600568101012a0259f40d6fa192306ddf206e92306d9ad0d37fd33f596c126f02e2206e9430707020e06f227f5902012001e801f102012001e901ec02f1b2a63b513434800063983e903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c001c0842444502424444c2424444824244444242044402041fc41b84174423041ec41a841644120411c40d904c1c38c34446044644460445c4460445e001f601ea016c1116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cc46cd401eb00648101012c0259f40d6fa192306ddf206e92306d9dd0d37ffa40d33f55206c136f03e2206e9730707020561b01e06f237f552002015801ed01ef02e8a979ed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30ddb3c57105f0f6c9101f601ee00022402e8a828ed44d0d200018e60fa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d707054700054700070210911140909111309091112090911110908111008107f106e105d108c107b106a1059104810471036413070e30ddb3c57105f0f6c9101f601f000022302012001f201f503f9b3ecfb513434800063983e903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c001c0842444502424444c2424444824244444242044402041fc41b84174423041ec41a841644120411c40d904c1c38c376cf1b374f4f4f4f4f4f4f4f4f4f4f4f6001f601f301f400365614561656155615561c2b56175617561756175613561282015180000455b002e9b002fb513434800063983e903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c001c0842444502424444c2424444824244444242044402041fc41b84174423041ec41a841644120411c40d904c1c38c376cf15c417c3db246001f601f801fafa40fa40fa40d200d200d401d0d3ffd3ffd33fd33fd37fd37ff404f404f404d430d0f404d33ff404d33ffa40f404d30fd200f404d30fd20030111411191114111411181114111411171114111411161114111411151114571911171118111711161117111611151116111511141115111411131114111311121113111201f700241111111211111110111111100f11100f550e0002213635384d');
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

const UsernameRegistry_opcodes = {
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

const UsernameRegistry_getters: ABIGetter[] = [
    {"name":"get_username_price","methodId":87502,"arguments":[{"name":"name_len","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"UsernamePriceView","optional":false}},
    {"name":"get_username_item_address","methodId":81427,"arguments":[{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_nft_address_by_index","methodId":92067,"arguments":[{"name":"index","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_art_count","methodId":121209,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_art_sealed","methodId":121896,"arguments":[],"returnType":{"kind":"simple","type":"bool","optional":false}},
    {"name":"get_meta_count","methodId":126987,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_meta_sealed","methodId":72547,"arguments":[],"returnType":{"kind":"simple","type":"bool","optional":false}},
    {"name":"royalty_params","methodId":85719,"arguments":[],"returnType":{"kind":"simple","type":"RoyaltyParamsView","optional":false}},
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
    'get_art_count': 'getGetArtCount',
    'get_art_sealed': 'getGetArtSealed',
    'get_meta_count': 'getGetMetaCount',
    'get_meta_sealed': 'getGetMetaSealed',
    'royalty_params': 'getRoyaltyParams',
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
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"UploadArt"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealArt"}},
    {"receiver":"internal","message":{"kind":"typed","type":"UploadCollectionMeta"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealCollectionMeta"}},
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
export const USERNAME_ITEM_PROOF_FORWARD_RESERVE = 5000000n;
export const USERNAME_ITEM_PROOF_EXEC_RESERVE = 1000000n;
export const USERNAME_ITEM_PROOF_MAX_VALUE = 20000000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindOfficialAthWallet | SealGenesis | UploadArt | SealArt | UploadCollectionMeta | SealCollectionMeta | AthTransferNotificationVaultMintUsername | UsernameItemDeployedAck | FlushTreasuryAthDue | FlushBurnAthDue | ATHTransferAck | ATHTransferFailed | ATHBurnFinalized | ATHBurnFailed | PrunePendingUsernameMint | UsernameRegistryTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindOfficialAthWallet') {
            body = beginCell().store(storeBindOfficialAthWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'UploadArt') {
            body = beginCell().store(storeUploadArt(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealArt') {
            body = beginCell().store(storeSealArt(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'UploadCollectionMeta') {
            body = beginCell().store(storeUploadCollectionMeta(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealCollectionMeta') {
            body = beginCell().store(storeSealCollectionMeta(message)).endCell();
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
    
    async getGetArtCount(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_art_count', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetArtSealed(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_art_sealed', builder.build())).stack;
        const result = source.readBoolean();
        return result;
    }
    
    async getGetMetaCount(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_meta_count', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetMetaSealed(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_meta_sealed', builder.build())).stack;
        const result = source.readBoolean();
        return result;
    }
    
    async getRoyaltyParams(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('royalty_params', builder.build())).stack;
        const result = loadGetterTupleRoyaltyParamsView(source);
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