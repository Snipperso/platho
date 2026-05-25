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

export type UsernameNFTItemStateView = {
    $$type: 'UsernameNFTItemStateView';
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: bigint;
}

export function storeUsernameNFTItemStateView(src: UsernameNFTItemStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.username_registry_address);
        b_0.storeInt(src.name_hash, 257);
    };
}

export function loadUsernameNFTItemStateView(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _username_registry_address = sc_0.loadAddress();
    const _name_hash = sc_0.loadIntBig(257);
    return { $$type: 'UsernameNFTItemStateView' as const, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash };
}

export function loadTupleUsernameNFTItemStateView(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    return { $$type: 'UsernameNFTItemStateView' as const, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash };
}

export function loadGetterTupleUsernameNFTItemStateView(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    return { $$type: 'UsernameNFTItemStateView' as const, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash };
}

export function storeTupleUsernameNFTItemStateView(source: UsernameNFTItemStateView) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.username_registry_address);
    builder.writeNumber(source.name_hash);
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

export type UsernameNFTItem$Data = {
    $$type: 'UsernameNFTItem$Data';
    owner_wallet: Address;
    username_registry_address: Address;
    name_hash: bigint;
}

export function storeUsernameNFTItem$Data(src: UsernameNFTItem$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.username_registry_address);
        b_0.storeUint(src.name_hash, 256);
    };
}

export function loadUsernameNFTItem$Data(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _username_registry_address = sc_0.loadAddress();
    const _name_hash = sc_0.loadUintBig(256);
    return { $$type: 'UsernameNFTItem$Data' as const, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash };
}

export function loadTupleUsernameNFTItem$Data(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    return { $$type: 'UsernameNFTItem$Data' as const, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash };
}

export function loadGetterTupleUsernameNFTItem$Data(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _username_registry_address = source.readAddress();
    const _name_hash = source.readBigNumber();
    return { $$type: 'UsernameNFTItem$Data' as const, owner_wallet: _owner_wallet, username_registry_address: _username_registry_address, name_hash: _name_hash };
}

export function storeTupleUsernameNFTItem$Data(source: UsernameNFTItem$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeAddress(source.username_registry_address);
    builder.writeNumber(source.name_hash);
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
    pruned_notification_acks: Dictionary<bigint, bigint>;
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
        const b_1 = new Builder();
        b_1.storeDict(src.pruned_notification_acks, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_1.storeDict(src.pending_outgoing_transfers, Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadATHWallet$Data(slice: Slice) {
    const sc_0 = slice;
    const _balance = sc_0.loadUintBig(128);
    const _owner_address = sc_0.loadAddress();
    const _ath_master_address = sc_0.loadAddress();
    const _pending_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), sc_0);
    const _processed_notifications = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pruned_notification_acks = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_1);
    const _pending_outgoing_transfers = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), sc_1);
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pruned_notification_acks: _pruned_notification_acks, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function loadTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pruned_notification_acks = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_outgoing_transfers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pruned_notification_acks: _pruned_notification_acks, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function loadGetterTupleATHWallet$Data(source: TupleReader) {
    const _balance = source.readBigNumber();
    const _owner_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pending_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification(), source.readCellOpt());
    const _processed_notifications = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pruned_notification_acks = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_outgoing_transfers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthOutgoingTransfer(), source.readCellOpt());
    return { $$type: 'ATHWallet$Data' as const, balance: _balance, owner_address: _owner_address, ath_master_address: _ath_master_address, pending_notifications: _pending_notifications, processed_notifications: _processed_notifications, pruned_notification_acks: _pruned_notification_acks, pending_outgoing_transfers: _pending_outgoing_transfers };
}

export function storeTupleATHWallet$Data(source: ATHWallet$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.balance);
    builder.writeAddress(source.owner_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeCell(source.pending_notifications.size > 0 ? beginCell().storeDictDirect(source.pending_notifications, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTransferNotification()).endCell() : null);
    builder.writeCell(source.processed_notifications.size > 0 ? beginCell().storeDictDirect(source.processed_notifications, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pruned_notification_acks.size > 0 ? beginCell().storeDictDirect(source.pruned_notification_acks, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
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

export type FlushAthRefundDue = {
    $$type: 'FlushAthRefundDue';
    query_id: bigint;
    owner_wallet: Address;
}

export function storeFlushAthRefundDue(src: FlushAthRefundDue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1804766023, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeAddress(src.owner_wallet);
    };
}

export function loadFlushAthRefundDue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1804766023) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _owner_wallet = sc_0.loadAddress();
    return { $$type: 'FlushAthRefundDue' as const, query_id: _query_id, owner_wallet: _owner_wallet };
}

export function loadTupleFlushAthRefundDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    return { $$type: 'FlushAthRefundDue' as const, query_id: _query_id, owner_wallet: _owner_wallet };
}

export function loadGetterTupleFlushAthRefundDue(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _owner_wallet = source.readAddress();
    return { $$type: 'FlushAthRefundDue' as const, query_id: _query_id, owner_wallet: _owner_wallet };
}

export function storeTupleFlushAthRefundDue(source: FlushAthRefundDue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeAddress(source.owner_wallet);
    return builder.build();
}

export function dictValueParserFlushAthRefundDue(): DictionaryValue<FlushAthRefundDue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushAthRefundDue(src)).endCell());
        },
        parse: (src) => {
            return loadFlushAthRefundDue(src.loadRef().beginParse());
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
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.name_hash, 256);
        b_0.storeUint(src.price_paid, 128);
        b_0.storeAddress(src.item_address);
        const b_1 = new Builder();
        b_1.storeUint(src.item_deploy_value, 128);
        b_1.storeUint(src.created_at, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingUsernameMint(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _name_hash = sc_0.loadUintBig(256);
    const _price_paid = sc_0.loadUintBig(128);
    const _item_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _item_deploy_value = sc_1.loadUintBig(128);
    const _created_at = sc_1.loadUintBig(32);
    return { $$type: 'PendingUsernameMint' as const, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadTuplePendingUsernameMint(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMint' as const, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadGetterTuplePendingUsernameMint(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMint' as const, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function storeTuplePendingUsernameMint(source: PendingUsernameMint) {
    const builder = new TupleBuilder();
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
    owner_wallet: Address;
    item_address: Address;
    registered_at: bigint;
}

export function storeNameRecord(src: NameRecord) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.item_address);
        b_0.storeUint(src.registered_at, 32);
    };
}

export function loadNameRecord(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _item_address = sc_0.loadAddress();
    const _registered_at = sc_0.loadUintBig(32);
    return { $$type: 'NameRecord' as const, owner_wallet: _owner_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadTupleNameRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'NameRecord' as const, owner_wallet: _owner_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadGetterTupleNameRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'NameRecord' as const, owner_wallet: _owner_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function storeTupleNameRecord(source: NameRecord) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
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
    refund_due_count: bigint;
    treasury_due_ath: bigint;
    burn_due_ath: bigint;
    pending_refund_flush_count: bigint;
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
        b_2.storeInt(src.refund_due_count, 257);
        b_2.storeInt(src.treasury_due_ath, 257);
        b_2.storeInt(src.burn_due_ath, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.pending_refund_flush_count, 257);
        b_3.storeInt(src.pending_treasury_flush_count, 257);
        b_3.storeInt(src.pending_burn_flush_count, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.pending_mint_stale_ttl, 257);
        b_3.storeRef(b_4.endCell());
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
    const _refund_due_count = sc_2.loadIntBig(257);
    const _treasury_due_ath = sc_2.loadIntBig(257);
    const _burn_due_ath = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_refund_flush_count = sc_3.loadIntBig(257);
    const _pending_treasury_flush_count = sc_3.loadIntBig(257);
    const _pending_burn_flush_count = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _pending_mint_stale_ttl = sc_4.loadIntBig(257);
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, refund_due_count: _refund_due_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_refund_flush_count: _pending_refund_flush_count, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
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
    const _refund_due_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_refund_flush_count = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    const _pending_mint_stale_ttl = source.readBigNumber();
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, refund_due_count: _refund_due_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_refund_flush_count: _pending_refund_flush_count, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
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
    const _refund_due_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _pending_refund_flush_count = source.readBigNumber();
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flush_count = source.readBigNumber();
    const _pending_mint_stale_ttl = source.readBigNumber();
    return { $$type: 'UsernameRegistryGlobalView' as const, sealed: _sealed, official_ath_wallet_bound: _official_ath_wallet_bound, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, official_ath_wallet_address: _official_ath_wallet_address, genesis_controller_address: _genesis_controller_address, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, refund_due_count: _refund_due_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, pending_refund_flush_count: _pending_refund_flush_count, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flush_count: _pending_burn_flush_count, pending_mint_stale_ttl: _pending_mint_stale_ttl };
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
    builder.writeNumber(source.refund_due_count);
    builder.writeNumber(source.treasury_due_ath);
    builder.writeNumber(source.burn_due_ath);
    builder.writeNumber(source.pending_refund_flush_count);
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
    owner_wallet: Address;
    item_address: Address;
    registered_at: bigint;
}

export function storeUsernameNameRecordView(src: UsernameNameRecordView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeAddress(src.item_address);
        b_0.storeInt(src.registered_at, 257);
    };
}

export function loadUsernameNameRecordView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _item_address = sc_0.loadAddress();
    const _registered_at = sc_0.loadIntBig(257);
    return { $$type: 'UsernameNameRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadTupleUsernameNameRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'UsernameNameRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function loadGetterTupleUsernameNameRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _item_address = source.readAddress();
    const _registered_at = source.readBigNumber();
    return { $$type: 'UsernameNameRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, item_address: _item_address, registered_at: _registered_at };
}

export function storeTupleUsernameNameRecordView(source: UsernameNameRecordView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
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
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.name_hash, 257);
        b_0.storeInt(src.price_paid, 257);
        const b_1 = new Builder();
        b_1.storeAddress(src.item_address);
        b_1.storeInt(src.item_deploy_value, 257);
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingUsernameMintView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _name_hash = sc_0.loadIntBig(257);
    const _price_paid = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _item_address = sc_1.loadAddress();
    const _item_deploy_value = sc_1.loadIntBig(257);
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'PendingUsernameMintView' as const, exists: _exists, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadTuplePendingUsernameMintView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintView' as const, exists: _exists, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function loadGetterTuplePendingUsernameMintView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _name_hash = source.readBigNumber();
    const _price_paid = source.readBigNumber();
    const _item_address = source.readAddress();
    const _item_deploy_value = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingUsernameMintView' as const, exists: _exists, owner_wallet: _owner_wallet, name_hash: _name_hash, price_paid: _price_paid, item_address: _item_address, item_deploy_value: _item_deploy_value, created_at: _created_at };
}

export function storeTuplePendingUsernameMintView(source: PendingUsernameMintView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
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

export type PendingAthRefundFlush = {
    $$type: 'PendingAthRefundFlush';
    owner_wallet: Address;
    amount: bigint;
    recipient_ath_wallet: Address;
    created_at: bigint;
}

export function storePendingAthRefundFlush(src: PendingAthRefundFlush) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient_ath_wallet);
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthRefundFlush(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadUintBig(128);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadUintBig(32);
    return { $$type: 'PendingAthRefundFlush' as const, owner_wallet: _owner_wallet, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadTuplePendingAthRefundFlush(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthRefundFlush' as const, owner_wallet: _owner_wallet, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingAthRefundFlush(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthRefundFlush' as const, owner_wallet: _owner_wallet, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function storeTuplePendingAthRefundFlush(source: PendingAthRefundFlush) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthRefundFlush(): DictionaryValue<PendingAthRefundFlush> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthRefundFlush(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthRefundFlush(src.loadRef().beginParse());
        }
    }
}

export type PendingAthRefundFlushView = {
    $$type: 'PendingAthRefundFlushView';
    exists: boolean;
    owner_wallet: Address;
    amount: bigint;
    recipient_ath_wallet: Address;
    created_at: bigint;
}

export function storePendingAthRefundFlushView(src: PendingAthRefundFlushView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.amount, 257);
        b_0.storeAddress(src.recipient_ath_wallet);
        const b_1 = new Builder();
        b_1.storeInt(src.created_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPendingAthRefundFlushView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _amount = sc_0.loadIntBig(257);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _created_at = sc_1.loadIntBig(257);
    return { $$type: 'PendingAthRefundFlushView' as const, exists: _exists, owner_wallet: _owner_wallet, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadTuplePendingAthRefundFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthRefundFlushView' as const, exists: _exists, owner_wallet: _owner_wallet, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function loadGetterTuplePendingAthRefundFlushView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _amount = source.readBigNumber();
    const _recipient_ath_wallet = source.readAddress();
    const _created_at = source.readBigNumber();
    return { $$type: 'PendingAthRefundFlushView' as const, exists: _exists, owner_wallet: _owner_wallet, amount: _amount, recipient_ath_wallet: _recipient_ath_wallet, created_at: _created_at };
}

export function storeTuplePendingAthRefundFlushView(source: PendingAthRefundFlushView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient_ath_wallet);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPendingAthRefundFlushView(): DictionaryValue<PendingAthRefundFlushView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingAthRefundFlushView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingAthRefundFlushView(src.loadRef().beginParse());
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
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthTreasuryFlush(slice: Slice) {
    const sc_0 = slice;
    const _amount = sc_0.loadUintBig(128);
    const _recipient_ath_wallet = sc_0.loadAddress();
    const _created_at = sc_0.loadUintBig(32);
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
        b_0.storeUint(src.created_at, 32);
    };
}

export function loadPendingAthBurnFlush(slice: Slice) {
    const sc_0 = slice;
    const _amount = sc_0.loadUintBig(128);
    const _created_at = sc_0.loadUintBig(32);
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
    refund_due_count: bigint;
    treasury_due_ath: bigint;
    burn_due_ath: bigint;
    name_records: Dictionary<bigint, NameRecord>;
    pending_mints: Dictionary<bigint, PendingUsernameMint>;
    pending_item_to_name_hash: Dictionary<Address, bigint>;
    ath_refunds_due: Dictionary<Address, bigint>;
    pending_refund_flushes: Dictionary<bigint, PendingAthRefundFlush>;
    pending_refund_flush_count: bigint;
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
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.treasury_ath_receiver_address);
        b_0.storeBit(src.official_ath_wallet_bound);
        b_0.storeBit(src.sealed);
        const b_1 = new Builder();
        b_1.storeUint(src.deployment_manifest_hash, 256);
        b_1.storeUint(src.genesis_config_hash, 256);
        b_1.storeUint(src.name_record_count, 64);
        b_1.storeUint(src.pending_mint_count, 64);
        b_1.storeUint(src.refund_due_count, 64);
        b_1.storeUint(src.treasury_due_ath, 128);
        b_1.storeUint(src.burn_due_ath, 128);
        b_1.storeDict(src.name_records, Dictionary.Keys.BigInt(257), dictValueParserNameRecord());
        b_1.storeDict(src.pending_mints, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint());
        b_1.storeDict(src.pending_item_to_name_hash, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257));
        const b_2 = new Builder();
        b_2.storeDict(src.ath_refunds_due, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257));
        b_2.storeDict(src.pending_refund_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthRefundFlush());
        b_2.storeUint(src.pending_refund_flush_count, 64);
        b_2.storeDict(src.pending_treasury_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush());
        b_2.storeUint(src.pending_treasury_flush_count, 64);
        b_2.storeDict(src.pending_burn_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush());
        b_2.storeUint(src.pending_burn_flush_count, 64);
        b_2.storeAddress(src.genesis_controller_address);
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
    const _refund_due_count = sc_1.loadUintBig(64);
    const _treasury_due_ath = sc_1.loadUintBig(128);
    const _burn_due_ath = sc_1.loadUintBig(128);
    const _name_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), sc_1);
    const _pending_mints = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), sc_1);
    const _pending_item_to_name_hash = Dictionary.load(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), sc_1);
    const sc_2 = sc_1.loadRef().beginParse();
    const _ath_refunds_due = Dictionary.load(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), sc_2);
    const _pending_refund_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthRefundFlush(), sc_2);
    const _pending_refund_flush_count = sc_2.loadUintBig(64);
    const _pending_treasury_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), sc_2);
    const _pending_treasury_flush_count = sc_2.loadUintBig(64);
    const _pending_burn_flushes = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), sc_2);
    const _pending_burn_flush_count = sc_2.loadUintBig(64);
    const _genesis_controller_address = sc_2.loadAddress();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, refund_due_count: _refund_due_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, ath_refunds_due: _ath_refunds_due, pending_refund_flushes: _pending_refund_flushes, pending_refund_flush_count: _pending_refund_flush_count, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address };
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
    const _refund_due_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _name_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), source.readCellOpt());
    const _pending_mints = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), source.readCellOpt());
    source = source.readTuple();
    const _pending_item_to_name_hash = Dictionary.loadDirect(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _ath_refunds_due = Dictionary.loadDirect(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_refund_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthRefundFlush(), source.readCellOpt());
    const _pending_refund_flush_count = source.readBigNumber();
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, refund_due_count: _refund_due_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, ath_refunds_due: _ath_refunds_due, pending_refund_flushes: _pending_refund_flushes, pending_refund_flush_count: _pending_refund_flush_count, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address };
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
    const _refund_due_count = source.readBigNumber();
    const _treasury_due_ath = source.readBigNumber();
    const _burn_due_ath = source.readBigNumber();
    const _name_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserNameRecord(), source.readCellOpt());
    const _pending_mints = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint(), source.readCellOpt());
    const _pending_item_to_name_hash = Dictionary.loadDirect(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _ath_refunds_due = Dictionary.loadDirect(Dictionary.Keys.Address(), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _pending_refund_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthRefundFlush(), source.readCellOpt());
    const _pending_refund_flush_count = source.readBigNumber();
    const _pending_treasury_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthTreasuryFlush(), source.readCellOpt());
    const _pending_treasury_flush_count = source.readBigNumber();
    const _pending_burn_flushes = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingAthBurnFlush(), source.readCellOpt());
    const _pending_burn_flush_count = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    return { $$type: 'UsernameRegistry$Data' as const, official_ath_wallet_address: _official_ath_wallet_address, ath_master_address: _ath_master_address, treasury_ath_receiver_address: _treasury_ath_receiver_address, official_ath_wallet_bound: _official_ath_wallet_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, name_record_count: _name_record_count, pending_mint_count: _pending_mint_count, refund_due_count: _refund_due_count, treasury_due_ath: _treasury_due_ath, burn_due_ath: _burn_due_ath, name_records: _name_records, pending_mints: _pending_mints, pending_item_to_name_hash: _pending_item_to_name_hash, ath_refunds_due: _ath_refunds_due, pending_refund_flushes: _pending_refund_flushes, pending_refund_flush_count: _pending_refund_flush_count, pending_treasury_flushes: _pending_treasury_flushes, pending_treasury_flush_count: _pending_treasury_flush_count, pending_burn_flushes: _pending_burn_flushes, pending_burn_flush_count: _pending_burn_flush_count, genesis_controller_address: _genesis_controller_address };
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
    builder.writeNumber(source.refund_due_count);
    builder.writeNumber(source.treasury_due_ath);
    builder.writeNumber(source.burn_due_ath);
    builder.writeCell(source.name_records.size > 0 ? beginCell().storeDictDirect(source.name_records, Dictionary.Keys.BigInt(257), dictValueParserNameRecord()).endCell() : null);
    builder.writeCell(source.pending_mints.size > 0 ? beginCell().storeDictDirect(source.pending_mints, Dictionary.Keys.BigInt(257), dictValueParserPendingUsernameMint()).endCell() : null);
    builder.writeCell(source.pending_item_to_name_hash.size > 0 ? beginCell().storeDictDirect(source.pending_item_to_name_hash, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.ath_refunds_due.size > 0 ? beginCell().storeDictDirect(source.ath_refunds_due, Dictionary.Keys.Address(), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.pending_refund_flushes.size > 0 ? beginCell().storeDictDirect(source.pending_refund_flushes, Dictionary.Keys.BigInt(257), dictValueParserPendingAthRefundFlush()).endCell() : null);
    builder.writeNumber(source.pending_refund_flush_count);
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
    const __code = Cell.fromHex('b5ee9c724102db0100432f000114ff00f4a413f4bcf2c80b0102016202520130d001d072d721d200d200fa4021103450666f04f86102f8620303f6ed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d1118e302705617d74920c21f97311117d31f1118de21d8040c036611168020d7217021d749c21f9430d31f01de208210639cfc6cbae30220821041544810bae302821041544801bae3025f0f5f0905080b02fe5b1114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c81010bf8422a598101014133f40a6fa19401d70030925b6de2814ac4216eb3f2f42a8101012259f40d6fa192306ddf206e92306d8e1dd0fa40d3ffd37ffa40d401d0d37fd31f3010261025102410236c166f06e24b0602fc814ac5016eb3f2f4db3c10345f0482081e84802a81010b2459f40a6fa131963082085b8d80df1117111911171116111811161115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a091119090811180807111907061118064e0703a20511190504111804031119030211180201111901561801111adb3c1116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c252b5103f430d33fd37f5932011117011118db3c814ad8f8425618c705f2f426810101561a59f40d6fa192306ddf206e92306d9fd0fa40d37ffa40d31f55306c146f04e26eb3e30224810101561a59f40d6fa192306ddf206e92306d9dd0d37ffa40d31f55206c136f03e2814b2a016eb3f2f41116111711161115111611154b090a03f41116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1118db3c5b814ad9111a21ba01111a01f2f41117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c424f5102f41114111511141113111411131112111311121111111211111110111111100f11100f550e1118db3c5b814b2b111921ba01111901f2f411171ca01115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de0c0d10ab109a1089107810671056104510344130445103fad33fd37f5932011117011118db3c814b5af8425618c705f2f41116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1118db3c30814b5b111921ba01111901f2f411171ba01115111611151114111511141113111411131112111311121111111211114b4849044a8210663df03dbae3022182103a12d1adbae30221821089129d5fbae302218210bba3ec19ba0d0f152c03fe5b1116d3fffa4030011117011118db3cdb3c814a565618c201f2f4814a575614b3f2f4814a585611c000f2f4814a5a5612c000917f9556125619bae2f2f4814a5bf8281117111811171116111811161115111811151114111811141113111811131112111811121111111811111110111811100f11180f0e11180e0d11180d10110e02ee0c11180c0b11180b0a11180a091118090811180807111807061118060511180504111804031118030211180201111801db3c57115711571257145616500ec70501111401f2f41110111311100f11120f717f11130f11120f0f11110f0111100110cf10be10ad109c108b107a10691058104710365e22027c5103f65b1116d3ff301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3cdb3c814a605618c201f2f4814a6156125619baf2f4814a625614f2f4814a635617f8281117111911171116111811161011120010814a385613b3f2f40014814a59f84222c705f2f402fe1115111911151114111811141113111911131112111811121111111911111110111811100f11190f0e11180e0d11190d0c11180c0b11190b0a11180a091119090811180807111907061118060511190504111804031119030211180201111901db3c01111901c70501111701f2f4111411151114111311141113814a6456137c1302fc11151113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034401301111801db3c57115712011116010ff2f41113111511131112111411121111111311111110111211107f11120f11110f111010df10ce10bd10ac109b108a10791068105710469e1400dc1035443012c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ce01111001ca001eca000cc8cbff1bcbff19cb3f17cb3f15cb3f13cb7fcb7ff400f400f40001c8f40012f40013cb3f13f40013cb3f13f40013cb3f13cecdcdc9ed5402fc5b1116d33fd37fd31ffa40d3071116111a11161115111911151114111811141113111711131112111a11121111111911111110111811100f11170f0e111a0e0d11190d0c11180c0b11170b0a111a0a09111909081118080711170706111a0605111905041118040311170302111a0201111b01111cdb3c814ab0f84256184b1602f6c705f2f4814ab15619c200f2f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540814ab61117561bdb3c01111801f2f41115111611151114111511141113111411131112111311129e1704a01111111211111110111111100f11100f550e561b561ddb3ce3031116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111cdb3c111b181d1f2003f6eda2edfb1116111811161115111711151114111811141113111711131112111811121111111711111110111811100f11170f0e11180e0d11170d0c11180c0b11170b0a11180a09111709081118080711170706111806051117050411180403111703021118020111170111185617db3ce3035618d7495618aa02bd70191a005e571757171114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c7002fa8e2f571757171114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c70e05618c7028e2f571757171114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c70e17094205619b98ae83057171117c7001115111711151b1c00b01119d30721c2609321c17b9170e222c22f9302c13a923270e20292317f9101e28e3230571757171114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c70db31e11119a4007e1114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544301202fe571b571b1114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d01111a0111195618db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708231e03fc070655405619561bdb3c1116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a10691058104710364513504201111b01111adb3c111611181116111511171115111411161114111311151113111211141112252a260020c88210c5cc7cd601cb1f01cf16c9f9000444db3c561801bde3022a810101561c59f40c6fa131e30229810101561c59f40c6fa1317222222103f8e3028209ba8140814ab2f8416f24135f0322bef2f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170911170807065540561a561cdb3c814ab32a81010b2359f40a6fa131b3f2f4810101225f2702fe571a1115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e11195618db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655402324008281010b29028101014133f40a6fa19401d70030925b6de26e8e1382086acfc0814ab4f8416f24135f0322bef2f4e082082dc6c0814ab5f8416f24135f0322bef2f403f45619561bdb3c1116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a10691058104710364513504201111b01111adb3c111611181116111511171115111411161114111311151113111211141112252a2600ec814aa621c200f2f42981010b238101014133f40a6fa19401d70030925b6de2206e8e3030814aa7f8416f24135f0382085b8d80bef2f4102981010b59810101216e955b59f4593098c801cf004133f441e20da48e1e81010b02a0103a12810101216e955b59f4593098c801cf004133f441e20de20d0702341111111311111110111211100f11110f0e11100e10df551cdb3c2b5102fc8209312d00f823561e02562002561e544630c855505056ce13cbffcb7fce01c8cb7f12cb1fcdc9102c561e01206e953059f45a30944133f415e20981010b2b561e810101216e955b59f4593098c801cf004133f441e20fa4f828561c02111edb3c8209312d007f716f00c801308210639cfc6c01cb1fc9106f1035443012602801fc103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e1111111a11110c11100c10bf10ae109d107c109b106a10591048103729038046144313111b5005db3c1116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c2a2b51007cf84282080f4240705054700401c855208210472d9d7e5004cb1f12cb3fcb7fcb1fc91443304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00005cf8416f24135f0301a120820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0003fe8f7d5b1116d3fffa4030011117011118db3c81010bf8422a598101014133f40a6fa19401d70030925b6de2814aba216eb3f2f4814abb015619baf2f429810101561959f40d6fa192306ddf206e92306d8e1dd0fa40d3ffd37ffa40d401d0d37fd31f3010261025102410236c166f06e2814abc216eb3f2f46f2610245f04014b2d2f02f4814abd111bc70501111a01f2f4814abef84201111a01c70501111901f2f4814abf2a810101561959f40c6fa131b3f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e11175617db3c5b32810101f8234430c855205023cececb1fc9103d1201111a014e2e01b6206e953059f45a30944133f415e20fa45617811388a8812710a90411185618a111181da011171ba01115111611151114111511141113111411131112111311121111111211111110111111100f11100f10bf10de10cd0b0c0a550851044ee021821060a9bddbbae302218210e9a2c2cbbae3022182106b928b47bae30221821041544811ba3033363c03fe5b1116d33f301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c814b0a5618c200f2f45617db3c814b0b2dc200f2f4814b0cf8416f24135f038209e84800bef2f41115111611151114111611144b383103fa814b0d561711151114111311121111111055e01118db3c01111801f2f47056141d01111801db3c810101f823561a4033c855205023cb7fcecb1fc91026561a01206e953059f45a30944133f415e203a48209c9c380717ff82802111c0201111b01561801c855308210415448105005cb1f13cb3fcb7fcecec9561843149e7c3201c002111b02111a01441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610355042135103f85b1116d33f301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c814b145618c200f2f45617db3c814b152cc200f2f4814b16f8416f24135f0382086acfc0bef2f470810101f82352e0c84b383401fa5902cb7fcb1fc91025561a01206e953059f45a30944133f415e202a482084c4b40717ff82802111c0201111001c855208210415448015004cb1f12cb3fcb7fcec95619431402111b0250ff441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001115111611151114111511141113111411131112111311123501501111111211111110111111100f11100f10ef10de10cd1b1c109a10891078106710561045103440135103f65b1116d33ffa4030011117011118db3c814acf5618c200f2f41115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540814ad011175619db3c01111801f2f41115111711151114111611144b9e3703fc1113111511131112111411121111111311111110111211100f11110f0e11100e10df551c561801db3c1116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405617db3c2781010bd538390068814b00288101012359f40c6fa131b3f2f4814b01268101012359f40c6fa131b3f2f4814b0281010154451359f40c6fa131b3f2f401fc561a8101014133f40a6fa19401d70030925b6de2814ad1216eb3f2f4814ad221c200f2f4814ad3f8416f24135f038209e84800bef2f45619500981010bf459300ea51116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d0c0b0a0908111707063a02fe55405619db3c810101f823561c02561b5042c855305034cecb7fcecb1fc91028561a01206e953059f45a30944133f415e205a48209c9c380717ff82803111c0302111b0201111d01c855308210415448105005cb1f13cb3fcb7fcecec956170403111a0302111902111b01441359c8cf8580ca00cf8440ce01fa02806acf407c3b017ef400c901fb001113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810474643125104fe8ffc5b1116d33fd37f30011117011118db3c26810101561959f40d6fa192306ddf206e92306d9fd0fa40d37ffa40d31f55306c146f04e26eb3e30224810101561959f40d6fa192306ddf206e92306d9dd0d37ffa40d31f55206c136f03e2814b1e016eb3f2f4111611171116111511161115111411151114111311141113e04b3d3e3f02f81116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c30321119814ad4111aba01111901f2f4814ad5f842011119c70501111801f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e425102bc1112111311121111111211111110111111100f11100f550edb3c301119814b1f02baf2f4814b20f842011119c70501111801f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e4451044c21821041544813bae30221821041544803bae30221821041544804bae3022182103796df2dba4045474a03f65b1116d33fd37f30011117011118db3c814ad6f8425618c705f2f426810101561959f40d6fa192306ddf206e92306d9fd0fa40d37ffa40d31f55306c146f04e26eb3e30224810101561959f40d6fa192306ddf206e92306d9dd0d37ffa40d31f55206c136f03e2814b28016eb3f2f41116111711161115111611154b414303f01116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c5b814ad7111a21ba01111a01f2f41117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c424f510076278101012259f40d6fa192306ddf206e92306d9fd0fa40d37ffa40d31f55306c146f04e2814ace216eb3f2f46f24504b810101f45a3009a509413a02f01114111511141113111411131112111311121111111211111110111111100f11100f550edb3c5b814b29111921ba01111901f2f411171ca01115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de0c0d10ab109a108910781067105610451034413044510072258101012259f40d6fa192306ddf206e92306d9dd0d37ffa40d31f55206c136f03e2814b32216eb3f2f46f235038810101f45a3006a506502702fe5b1116d33fd37ffa40301116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a0911170908111708071117070611170605111705041117040311170302111702011118011119db3c814b46f8425617c705f2f44b4602fc814b47f82801111b01c70501111a01f2f41115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d01111801db3c301118814b481119ba01111801f2f41115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e485103fa5b1116d33fd37f30011117011118db3c814b50f8425618c705f2f41116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c30814b51111921ba01111901f2f411171ba01115111611151114111511141113111411131112111311121111111211114b4849006a238101012259f40d6fa192306ddf206e92306d9ad0d37fd31f596c126f02e2814b3c216eb3f2f46f225025810101f45a3003a5030401441110111111100f11100f10ef10de10cd0b0c109a10891078106710561045103441305103f88f765b1116d3ff301115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c814b69f8416f24135f0382081e8480bef2f4814b655618c300f2f429810101561959f40d6fa192306ddfe05718204b4c50000e814a9c5613f2f401fc206e92306d8e1dd0fa40d3ffd37ffa40d401d0d37fd31f3010261025102410236c166f06e2814b66216eb3f2f46f266c41814b67f8230282015180a012bef2f4814b682c810101561b59f40c6fa131b3f2f481010b290259f40a6fa1318e12814b6af8416f24135f0382085b8d80bef2f4df1116111711161115111611154d03581114111511141113111411131112111311121111111211111110111111100f11100f550edb3c10345f04db3c4e4f5100b62a8101012259f40d6fa192306ddf206e92306d8e1dd0fa40d3ffd37ffa40d401d0d37fd31f3010261025102410236c166f06e2814b64216eb3f2f46f26111016810101f45a30521f81010bf459301114a511140e0f10451034413000c8814aa821c200f2f42981010b238101014133f40a6fa19401d70030925b6de2206e8e1e30102981010b59810101216e955b59f4593098c801cf004133f441e20da48e1e81010b02a0103a12810101216e955b59f4593098c801cf004133f441e20de20d0702ee82100aba5f1dba8eab3057161114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de0c0001117c12101111701b08ead814a9bf2f01114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de05f0f5f08f2c082515100d2c87f01ca001117111611151114111311121111111055e0011116011117ce01111401ce01111201ce01111001ca001eca000cc8cbff1bcbff19cb3f17cb3f15cb3f13cb7fcb7ff400f400f40001c8f40012f40013cb3f13f40013cb3f13f40013cb3f13cecdcdc9ed5402012053740201205469020120555802f3b69ebda89a1a400031cb7f481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadadadadae0e0a8e000a8e000401022261010222410102222101022201020fe20dc20ba2098207620f420d220b0208e206c8a0605c61a222c222e222c222a222c222a2228222a22290d85601481113111411131112111311121111111211111110111111100f11100f550edb3c6ce76c975700948101012b0259f40d6fa192306ddf206e92306d8e1dd0fa40d3ffd37ffa40d401d0d37fd31f3010261025102410236c166f06e2206e9e307070547000561b044313561c02e06f267f555002016e595c02f2ab9fed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d111611171116111511161115111411151114d85a01481113111411131112111311121111111211111110111111100f11100f550edb3c6cc46cb45b00648101012c0259f40d6fa192306ddf206e92306d9dd0fa40fa40d31f55206c136f03e2206e9730705617561870e06f237f552002f2aa13ed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d111611181116111511171115111411161114d85d01581113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c57105f0f6c715e0104db3c5f017a814a4c21c300f2f421fa4430f8284303db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d060012488c87001ca0055215023cece810101cf00c9610114ff00f4a413f4bcf2c80b62020162636703f2d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019afa40fa40d3ff55206c138e16fa40fa40810101d700552003d15881465121c300f2f4e204925f04e07023d74920c21f953103d31f309134e2208210639cfc6cbae30220821027acdf8bbae302c00003c12113b0e3025f03f2c08264656600d83032814652f8416f24135f0382083d0900bef2f4814653f8416f24135f038209312d00bbf2f482082dc6c07f715353c8598210bba3ec195003cb1fcbffcec92555304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002c87f01ca0055205023cececbffc9ed540026303202c87f01ca0055205023cececbffc9ed54002c8146b3f2f002c87f01ca0055205023cececbffc9ed540161a0a75bda89a1a4000335f481f481a7feaa40d8271c2df481f481020203ae00aa4007a2b1028ca2438601e5e9c5b678d8676800065472100201486a6d02f3b26e7b51343480006396fe903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c0008020444c2020444820204444202044402041fc41b84174413040ec41e841a44160411c40d9140c0b8c344458446044584454445c44544450445844520d86b01581113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c57105f0f6c716c0104db3cd502f3b173bb51343480006396fe903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c0008020444c2020444820204444202044402041fc41b84174413040ec41e841a44160411c40d9140c0b8c344458445c44584454445844544450445444520d86e01541113111411131112111311121111111211111110111111100f11100f550edb3c571257105f0f50675f066f04f41116111711161115111711151114111711141113111711131112111711121111111711111110111711100f11170f0e11170e0d11170d0c11170c0b11170b0a11170a09111709111708070655405617db3ce3037f1118db3c0111180111171118111711161117111611151116111511141115111411131114111370717273001420c20392c121923070e200a4571770701117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103410230060814a4221c203f2f4814a4321c121f2f420c0049930822009184e72a000e0c005978218e8d4a51000e08218174876e80000601112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034102302012075c9020120767802f3b4fe7da89a1a400031cb7f481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadadadadae0e0a8e000a8e000401022261010222410102222101022201020fe20dc20ba2098207620f420d220b0208e206c8a0605c61a222c222e222c222a222c222a2228222a22290d87701481113111411131112111311121111111211111110111111100f11100f550edb3c6cf56c85d602016679c602f2a821ed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d111611171116111511161115111411151114d87a014c1113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6c717b0104db3c7c016a20fa443070585618db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d07d012488c87001ca0055215023810101cf00cecec97e0114ff00f4a413f4bcf2c80b7f02016280c004eed001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1cd37ffa40fa40f404d401d0f404f404f4043010371036103510346c178e12810101d700fa40fa40552003d1586d6d6d6de208e3027027d74920c21f953107d31f08de21821041544801bae30221821041544805bae30221818e909104d4068020d7217021d749c21f9430d31f01de20821041544802bae30220821041544812ba8eb230d33fd37f593210681057104610354400db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54e020821041544815bae30220821041544817ba8285838400ea30d33fd37f59328136b3f84226c705f2f48136b422c200f2f45161a0708040087f04c8598210415448045003cb1fcb3fcb7fc92743144900441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010465513c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54016430d33fd37f593210681057104610354400db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed548504fa8eb230d33fd37f593210681057104610354400db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54e020821041544819ba8eb230d33fd37f593210681057104610354400db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54e0208210472d9d7dbae302208585878802d881378c21c200f2f4f84210795e351048103948905280db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd31f55306c146f04e281378d216eb3f2f46f243081378e511dbaf2f481378ff8425003c70512f2f402810101f45a305179a07080400a7f0cc8b7860064598210415448135003cb1fcb3fcb7fc9134a401b441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010565513018030d33fd37fd31f552033813800f84228c705f2f41079106810571046103512db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed548a02aa821089129d5fba8ec030d33fd37fd31f5520338138c2f84228c705f2f41079106810571046103512db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54e08210a11a7001bae3025f088a89017ed33fd37fd31f552033813930f84228c705f2f41079106810571046103512db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed548a03f68137fa21c200f2f48137fff8416f24135f038208895440bef2f48137fb53a1bef2f4106910581047103948795387db3c248101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e28137fc216eb3f2f46f23308137fd511dbaf2f455528137fe5197db3c2bba1af2f4515ba15072810101c3be8b0452f45a301610354413541277db3c705396db3c10891079106910591049103949cb29db3c55605477c82cb1b28c8d0030c882104154524601cb1f13cb3fcb1f01cf16c9f900a9383f01c8db3c707f5419e780400dc855308210415448125005cb1f13cb3fcb7fcecec910691058104d103a4cb0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb004516552004a101fe5b06d33fd37ffa40308136b0f84228c705f2f48136b122c200f2f48136b25382bef2f48136b55317c705f2f482083d09008136b6f8416f24135f0358bef2f4f8416f24135f0382081e8480a15182a1715414387f04c855308210415448025005cb1f13cb3fcb7fcecec92604095520441359c8cf8580ca00cf8440ce01fa028f005a806acf40f400c901fb0010465513c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed5401f05b06d33fd37ffa4030813840f84227c705f2f481384122c200f2f481384228c000f2f4813843f8416f24135f0382082dc6c0bef2f45171a082080f42407004705149c855208210415448065004cb1f12cb3fcb7fcec910494930441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010465513b8044a821041544810bae30221821041544814bae30221821041544816bae30221821041544818ba9294989b04e45b06d33fd37ffa40fa4030813778f84229c705f2f48137795318c705f2f410685e341037489a539adb3c81377a29c200f2f481377b5379bef2f48209c9c38081377cf8416f24135f0358bef2f4f8416f24135f0382081e8480a155602adb3c705410c6db3c10685e3410374878547abc56109db1b29302cadb3c516ba17f541bc6701110c855308210415448125005cb1f13cb3fcb7fcecec9106c1059104b103d4780103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010364015a1b803fc5b06d33fd37ffa40fa40d430d0fa40d37f308137dcf8422bc705f2f48137dd533ac705f2f48137de5324c705f2f4106a1059104810374abc537adb3c8137df29c200f2f48137e02dc200f2f48137e15379bef2f48137e22d8209c9c380bef2f42cdb3c208208989680a08137e3f8416f24135f0322bef2f410685e3410379d9f9504e8487829db3c705410b6db3c10685e3410374878547dcb5611db3c516ca150dc7f712702561102011113011114c855508210415448155007cb1f15cb3f13cb7fcece01c8ce12cb7fcdc9106a1058104e103f4a70103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf81b1b2a19602768ae2f400c901fb00f8416f24135f035003a11048104610354140db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed5497a3001a58cf8680cf8480f400f400cf8104f45b06d33fd37ffa40fa40d37fd3078138a4f8422cc705f2f48138a5534bc705f2f4106b105a1049103847cd5398db3c8138a62bc200f2f48138a728c200f2f48138a8537bbef2f48138a9288209c9c380bef2f427db3c208208989680a08138aaf8416f24135f0322bef2f410685e34103748782bdb3c705410d69d9fb19903fcdb3c10685e3410374878547fed2fdb3c516ea14fe07f7127513f4f13011114011115c855608210415448175008cb1f16cb3f14cb7f12cececb7fcb07cec9106b1057104f103947b0103645155034c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00b2a19a0162f8416f24135f0358a110784760141513db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54a3043ce30221821041544812bae30221821041544815bae30221821041544817ba9ca4a6aa03fe5b06d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd30730813912f8422fc705f2f4813913537ec705f2f4106e105d104c103b102a1110541f072fdb3c81391429c200f2f48139152ec200f2f48139165379bef2f48139172e8209c9c380bef2f42ddb3c208208989680a0813918f8416f24135f0322bef2f410685e349d9fa0035a105881390828061058104a481350a9db3c1af2f455050881390908db3c18f2f4550581390a08db3c18f2f455059e9e9e000afa4430c000003082080f4240a082080f4240a082086acfc0a082081e8480a004fa1037487829db3c705410b6db3c10685e3410374878547dcb5615db3c516ca1105d104c7f712f0656150605111505041114040311130302111202011117011118c85590821041544819500bcb1f19cb3f17cb7f15ce13cecb7f01c8cbff12cb3f12cb7f12cb0f12cb07cdc91045104a1913103645155034c8cf8580ca00b1b2a1a20198107a10691058104a103948a92adb3c813796228101012359f40c6fa131b3f2f4810101f823103c4ba0c855305034cececb7fcb1fc910394780206e953059f45a30944133f415e21036454012b702b889cf16ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00f8416f24135f035004a110481710361513db3cc87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54aea3004a20820186a0b9915be070706d4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002fe5b06d33fd37ffa40fa403081378223c200f2f4813783f842107a10691058104a10394bc9db3c19c7051bf2f4813784f8416f24135f0382087a1200bef2f45147a082082dc6c07170538ac8598210415448115003cb1fcb3fcb7fc9104c441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f424071b1a500ac07700ac8598210415448115003cb1fcb3fcb7fc944304790441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000541660403c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed5404fe5b06d33fd37ffa40fa40d430d0fa40d37f308137e625c200f2f48137e7f842106c105b104a103948de2bdb3c1fc7051df2f48137e85384c705f2f48137e927c200f2f48137eaf8416f24135f032882080f4240a082080f4240a082086acfc0a082081e8480a0bef2f4104610354014503c541b09db3c556053c7db3c8137ebb1bec3a701fc258101012359f40c6fa131b3f2f48137ec2f8209c9c380bef2f48137ed248101012359f40c6fa131b3f2f4517ca0810101f823546df0c855205023cecb7fcb1fc910364190206e953059f45a30944133f415e2717f544ea052ee12c855308210472d9d7d5005cb1f13cb3fcb7fcb1fcec91049103e4b80441359c8cf8580a801feca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053bac8598210415448115003cb1fcb3fcb7fc91049441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f4240710a700ac8598210415448115003cb1fcb3fcb7fc944304a90441359c8cf8580ca00cf8440ce01fa02806acf40f400a90052c901fb00105610454433c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54043ce30221821041544819bae30221821041544811bae302218210472d9d7ebaabb0b6b904f45b06d33fd37ffa40fa40d37fd3078138ae26c200f2f48138aff842106d105c104b103a49ef2ddb3c01111001c7051ef2f48138b02ac200f2f48138b1f8416f24135f032b82080f4240a082080f4240a082086acfc0a082081e8480a0bef2f4104610354014503d541c0bdb3c556053e7db3c8138b22581010123b1bec3ac01fc59f40c6fa131b3f2f48138b32c8209c9c380bef2f48138b4248101012359f40c6fa131b3f2f4517ea0810101f82352f0561101c855205023cecb7fcb1fc910364190206e953059f45a30944133f415e2717f561004103a5610030211100250dc1034c85550821089129d5f5007cb1f15cb3f13cb7fcb1fcecb07cec92404ad02fc103a48cc441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f4240707053cbc8598210415448115003cb1fcb3fcb7fc9104a441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f84282080f4240710b700bc8598210415448115003cb1fcb3fcb7fc944304ba0441359c8cf8580ca0089aeaf0001100068cf16ce01fa02806acf40f400c901fb001056103502c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed5402fe5b06d33fd37ffa40fa40d37fd430d0d3ffd33fd37fd30fd3073081391c29c200f2f481391df84206111006105f104e103d102c01111101111229db3c01111301c70501111101f2f481391e26c200f2f481391ff8416f24135f032782080f4240a082080f4240a082086acfc0a082081e8480a0bef2f4104610354014111013b1b3016820fa4430705827db3c20f90022f9005ad76501d76582020134c8cb17cb0fcb0fcbffcbff71f90400c87401cb0212ca07cbffc9d0b20026f82ac87001ca0055215023810101cf00cecec903fe541f07db3c556053a7db3c813920258101012359f40c6fa131b3f2f481392156128209c9c380bef2f4813922248101012359f40c6fa131b3f2f4517aa0810101f823546bd0c855205023cecb7fcb1fc910364190206e953059f45a30944133f415e2717f2c517c107b06105c041113040311120302111102011110010f1067bec3b401f8c855808210a11a7001500acb1f18cb3f16cb7f14cb1f12cecbffcb3fcb7fcb0fcb07c9544114103d4baa441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0082080f424070705354c8598210415448115003cb1fcb3fcb7fc9104d441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00f842b500b882080f424071047004c8598210415448115003cb1fcb3fcb7fc94430441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010561035504213c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed5402e45b06d33fd37f308137a021c200f2f4f842107810671056104510344990db3c218101012259f40d6fa192306ddf206e92306d9fd0fa40fa40d37fd31f55306c146f04e28137a1216eb3f2f46f2430318137a20bba1af2f48137a3f842500ac70519f2f417810101f45a301056104510344130b7b80026c8821041544f4701cb1f12cb3f01cf16c9f900003ec87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed540288e302218210504e5052bae30238c00007c12117b08e288132c8f2f010465513c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54e05f07f2c082babd04dc5b06d33fd37fd31f30813804f84228c705f2f481380522c200f2f4489828db3c248101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206ee3026f2330813807511cbaf2f410685e341037487881380809db3c500aba18f2f48101015410215447bbc3bbbebc0094303881010153020350aa4133f40c6fa19401d70030925b6de2813806216eb3f2f481380909ba18f2f45514c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54007c216e955b59f45a3098c801cf004133f442e25047810101f45a304613504405c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed5403de5b06d33fd31f301067105610451034438828db3c248101012259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e281380e216eb3f2f46f23106a1059104810374a9881380f0bdb3c500cba1af2f4813810f8230882015180a018be17f2f4810101541600546690c3bebf0026c8821041544e4901cb1f01cf16c9f900a9381f00b4216e955b59f45a3098c801cf004133f442e28101012010395446135099216e955b59f45a3098c801cf004133f442e25034810101f45a3045604433c87f01ca0055605067cb7f14ce12cef40001c8f40012f40012f400cdc9ed54020148c1c40183bb1c5ed44d0d200018e1cd37ffa40fa40f404d401d0f404f404f4043010371036103510346c178e12810101d700fa40fa40552003d1586d6d6d6de25516db3c6c748c20166db3c810101250259f40d6fa192306ddf206e92306d9dd0fa40d37fd31f55206c136f03e2206e96307070545700e06f237f5520c3000a01aa1f01a0017fbbb02ed44d0d200018e1cd37ffa40fa40f404d401d0f404f404f4043010371036103510346c178e12810101d700fa40fa40552003d1586d6d6d6de2db3c6c738c5000654765402f2a83fed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d111611171116111511161115111411151114d8c701481113111411131112111311121111111211111110111111100f11100f550edb3c6cf36c83c80056810101240259f40d6fa192306ddf206e92306d9ad0d37fd31f596c126f02e2206e9430707020e06f227f59020120cacd02f3b5531da89a1a400031cb7f481f481f481a401a803a1020203ae01020203ae01f48060206e206c206a20680fa2aa0adadadadadadadae0e0a8e000a8e000401022261010222410102222101022201020fe20dc20ba2098207620f420d220b0208e206c8a0605c61a222c222e222c222a222c222a2228222a22290d8cb01481113111411131112111311121111111211111110111111100f11100f550edb3c6cc46cb4cc0064810101260259f40d6fa192306ddf206e92306d9dd0d37ffa40d31f55206c136f03e2206e9730707020561901e06f237f5520020120ced002ebb3ecfb51343480006396fe903e903e90348035007420404075c020404075c03e900c040dc40d840d440d01f455415b5b5b5b5b5b5b5c1c151c00151c0008020444c2020444820204444202044402041fc41b84174413040ec41e841a44160411c40d9140c0b8c376cf1b3fcfcfcfcfcfcfcfcfd55da0d8cf003a5612561456135613561a2556155615561556155615561053fd82015180020158d1d702f2abc8ed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d111611181116111511171115111411161114d8d201541113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c6cf56c85d301f0561856185618561856185618561856185618561856185618561856185618561856185618561856185618561856181118112f11181117112e11171116112d11161115112c11151114112b11141113112a11131112112911121111112811111110112711100f11260f0e11250e0d11240d0c11230c0b11220bd402f20a11210a0911200908111f0807111e0706111d0605111c0504111b0403111a030211190201112f01112edb3c57105f0f6c711115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443012db3cd5d6002ac882105246494401cb1f58cf16cb3fc9f900a9383f006e810101280259f40d6fa192306ddf206e92306d9fd0fa40d37ffa40d31f55306c146f04e2206e9a30707020561959561a01e06f247f553002f2aa58ed44d0d200018e5bfa40fa40fa40d200d401d0810101d700810101d700fa4030103710361035103407d155056d6d6d6d6d6d6d70705470005470002008111308081112080811110808111008107f106e105d104c103b107a1069105810471036450302e30d111611171116111511161115111411151114d8d900fefa40fa40fa40d200d200d401d0d3ffd3ffd33fd33fd33fd37fd37ff404f404f404d430d0f404f404d33ff404d33ff404d33ffa403011121117111211121116111211121115111211121114111211121113111257171115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e014c1113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f6c71da003a81010b29028101014133f40a6fa19401d70030925b6de2206e923070e0555d552e');
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
    {"name":"ResendDeployedAck","header":1671232620,"fields":[]},
    {"name":"TopUpStorageReserve","header":665640843,"fields":[]},
    {"name":"UsernameItemDeployedAck","header":3148082201,"fields":[{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"UsernameNFTItemStateView","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameNFTItem$Data","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"username_registry_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
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
    {"name":"PendingAthOutgoingTransfer","header":null,"fields":[{"name":"recipient_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ATHWallet$Data","header":null,"fields":[{"name":"balance","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"owner_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_notifications","type":{"kind":"dict","key":"int","value":"PendingAthTransferNotification","valueFormat":"ref"}},{"name":"processed_notifications","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pruned_notification_acks","type":{"kind":"dict","key":"int","value":"int"}},{"name":"pending_outgoing_transfers","type":{"kind":"dict","key":"int","value":"PendingAthOutgoingTransfer","valueFormat":"ref"}}]},
    {"name":"BindOfficialAthWallet","header":1715335229,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushTreasuryAthDue","header":1621736923,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FlushBurnAthDue","header":3919758027,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FlushAthRefundDue","header":1804766023,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PrunePendingUsernameMint","header":932634413,"fields":[{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"UsernameRegistryTopUpStorageReserve","header":179986205,"fields":[]},
    {"name":"PendingUsernameMint","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"price_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_deploy_value","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"NameRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"UsernameRegistryGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_mint_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refund_due_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"burn_due_ath","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_refund_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_mint_stale_ttl","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernamePriceView","header":null,"fields":[{"name":"valid_length","type":{"kind":"simple","type":"bool","optional":false}},{"name":"price_ath_atomic","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameNameRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingUsernameMintView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"price_paid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"item_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"item_deploy_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthRefundFlush","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingAthRefundFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthTreasuryFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingAthBurnFlush","header":null,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingAthTreasuryFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_ath_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PendingAthBurnFlushView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"UsernameRegistry$Data","header":null,"fields":[{"name":"official_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_ath_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"official_ath_wallet_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"name_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_mint_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"refund_due_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"treasury_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"burn_due_ath","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"name_records","type":{"kind":"dict","key":"int","value":"NameRecord","valueFormat":"ref"}},{"name":"pending_mints","type":{"kind":"dict","key":"int","value":"PendingUsernameMint","valueFormat":"ref"}},{"name":"pending_item_to_name_hash","type":{"kind":"dict","key":"address","value":"int"}},{"name":"ath_refunds_due","type":{"kind":"dict","key":"address","value":"int"}},{"name":"pending_refund_flushes","type":{"kind":"dict","key":"int","value":"PendingAthRefundFlush","valueFormat":"ref"}},{"name":"pending_refund_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_treasury_flushes","type":{"kind":"dict","key":"int","value":"PendingAthTreasuryFlush","valueFormat":"ref"}},{"name":"pending_treasury_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_burn_flushes","type":{"kind":"dict","key":"int","value":"PendingAthBurnFlush","valueFormat":"ref"}},{"name":"pending_burn_flush_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}}]},
]

const UsernameRegistry_opcodes = {
    "ResendDeployedAck": 1671232620,
    "TopUpStorageReserve": 665640843,
    "UsernameItemDeployedAck": 3148082201,
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
    "BindOfficialAthWallet": 1715335229,
    "SealGenesis": 974311853,
    "FlushTreasuryAthDue": 1621736923,
    "FlushBurnAthDue": 3919758027,
    "FlushAthRefundDue": 1804766023,
    "PrunePendingUsernameMint": 932634413,
    "UsernameRegistryTopUpStorageReserve": 179986205,
}

const UsernameRegistry_getters: ABIGetter[] = [
    {"name":"get_username_price","methodId":87502,"arguments":[{"name":"name_len","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"UsernamePriceView","optional":false}},
    {"name":"get_username_item_address","methodId":81427,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_name_record","methodId":80799,"arguments":[{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"UsernameNameRecordView","optional":false}},
    {"name":"get_pending_mint","methodId":70901,"arguments":[{"name":"name_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingUsernameMintView","optional":false}},
    {"name":"get_refund_due","methodId":130648,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_refund_flush","methodId":100339,"arguments":[{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthRefundFlushView","optional":false}},
    {"name":"get_refund_flush_id","methodId":84409,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_pending_refund_flush_for","methodId":129992,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthRefundFlushView","optional":false}},
    {"name":"get_pending_treasury_flush","methodId":117400,"arguments":[{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthTreasuryFlushView","optional":false}},
    {"name":"get_pending_burn_flush","methodId":109631,"arguments":[{"name":"query_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingAthBurnFlushView","optional":false}},
    {"name":"get_ath_wallet_address","methodId":108577,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"UsernameRegistryGlobalView","optional":false}},
]

export const UsernameRegistry_getterMapping: { [key: string]: string } = {
    'get_username_price': 'getGetUsernamePrice',
    'get_username_item_address': 'getGetUsernameItemAddress',
    'get_name_record': 'getGetNameRecord',
    'get_pending_mint': 'getGetPendingMint',
    'get_refund_due': 'getGetRefundDue',
    'get_pending_refund_flush': 'getGetPendingRefundFlush',
    'get_refund_flush_id': 'getGetRefundFlushId',
    'get_pending_refund_flush_for': 'getGetPendingRefundFlushFor',
    'get_pending_treasury_flush': 'getGetPendingTreasuryFlush',
    'get_pending_burn_flush': 'getGetPendingBurnFlush',
    'get_ath_wallet_address': 'getGetAthWalletAddress',
    'get_global': 'getGetGlobal',
}

const UsernameRegistry_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindOfficialAthWallet"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotificationMintUsername"}},
    {"receiver":"internal","message":{"kind":"typed","type":"UsernameItemDeployedAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushTreasuryAthDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushBurnAthDue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushAthRefundDue"}},
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
export const ATH_TRANSFER_NOTIFY_ACK_VALUE = 1000000n;
export const ATH_INTERNAL_TRANSFER_ACK_VALUE = 3000000n;
export const ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE = 1000000n;
export const ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE = 21000000n;
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
export const ATH_OUTGOING_TRANSFER_ID_DOMAIN = 1096044359n;
export const ATH_NOTIFY_REFUND_QUERY_DOMAIN = 1096045126n;
export const ATH_TRANSFER_NOTIFY_SENDER_KEY_MOD = 4294967296n;
export const ATH_QUERY_ID_MOD = 18446744073709551616n;
export const ATH_PENDING_NOTIFICATION_TTL = 86400n;
export const USERNAME_PRICE_4_CHARS = 10000000000000n;
export const USERNAME_PRICE_5_CHARS = 1000000000000n;
export const USERNAME_PRICE_6_PLUS_CHARS = 100000000000n;
export const USERNAME_PENDING_MINT_STORAGE_ENDOWMENT = 6000000n;
export const USERNAME_ATH_REFUND_DUE_STORAGE_ENDOWMENT = 4000000n;
export const USERNAME_STATE_GROWTH_EXEC_RESERVE = 2000000n;
export const USERNAME_NFT_ITEM_DEPLOY_RESERVE = 20000000n;
export const USERNAME_ATH_TRANSFER_EXEC_RESERVE = 30000000n;
export const USERNAME_ATH_BURN_EXEC_RESERVE = 5000000n;
export const USERNAME_DUE_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const USERNAME_PRUNE_PENDING_MINT_EXEC_RESERVE = 2000000n;
export const USERNAME_ATH_NOTIFICATION_ACK_VALUE = 1000000n;
export const USERNAME_MINT_EXCESS_REFUND_MIN_VALUE = 100000n;
export const USERNAME_PENDING_MINT_STALE_TTL = 86400n;
export const USERNAME_MAX_LENGTH = 32n;
export const USERNAME_SPLIT_BASE_BPS = 10000n;
export const USERNAME_TREASURY_SHARE_BPS = 5000n;
export const USERNAME_NAME_HASH_DOMAIN = 3318512854n;
export const USERNAME_REFUND_FLUSH_ID_DOMAIN = 1380337988n;
export const UINT64_MOD = 18446744073709551616n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindOfficialAthWallet | SealGenesis | AthTransferNotificationMintUsername | UsernameItemDeployedAck | FlushTreasuryAthDue | FlushBurnAthDue | FlushAthRefundDue | ATHTransferAck | ATHTransferFailed | ATHBurnFinalized | ATHBurnFailed | PrunePendingUsernameMint | UsernameRegistryTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindOfficialAthWallet') {
            body = beginCell().store(storeBindOfficialAthWallet(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotificationMintUsername') {
            body = beginCell().store(storeAthTransferNotificationMintUsername(message)).endCell();
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushAthRefundDue') {
            body = beginCell().store(storeFlushAthRefundDue(message)).endCell();
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
    
    async getGetUsernameItemAddress(provider: ContractProvider, owner_wallet: Address, name_hash: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        builder.writeNumber(name_hash);
        const source = (await provider.get('get_username_item_address', builder.build())).stack;
        const result = source.readAddress();
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
    
    async getGetRefundDue(provider: ContractProvider, owner_wallet: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        const source = (await provider.get('get_refund_due', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetPendingRefundFlush(provider: ContractProvider, query_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(query_id);
        const source = (await provider.get('get_pending_refund_flush', builder.build())).stack;
        const result = loadGetterTuplePendingAthRefundFlushView(source);
        return result;
    }
    
    async getGetRefundFlushId(provider: ContractProvider, owner_wallet: Address, query_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        builder.writeNumber(query_id);
        const source = (await provider.get('get_refund_flush_id', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetPendingRefundFlushFor(provider: ContractProvider, owner_wallet: Address, query_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        builder.writeNumber(query_id);
        const source = (await provider.get('get_pending_refund_flush_for', builder.build())).stack;
        const result = loadGetterTuplePendingAthRefundFlushView(source);
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