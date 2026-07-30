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

export type PublicPublish = {
    $$type: 'PublicPublish';
    kind: bigint;
    key_arg: bigint;
    shard_seq: bigint;
    header: Cell;
    body: Cell;
}

export function storePublicPublish(src: PublicPublish) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1347637297, 32);
        b_0.storeUint(src.kind, 8);
        b_0.storeUint(src.key_arg, 256);
        b_0.storeUint(src.shard_seq, 32);
        b_0.storeRef(src.header);
        b_0.storeRef(src.body);
    };
}

export function loadPublicPublish(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1347637297) { throw Error('Invalid prefix'); }
    const _kind = sc_0.loadUintBig(8);
    const _key_arg = sc_0.loadUintBig(256);
    const _shard_seq = sc_0.loadUintBig(32);
    const _header = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'PublicPublish' as const, kind: _kind, key_arg: _key_arg, shard_seq: _shard_seq, header: _header, body: _body };
}

export function loadTuplePublicPublish(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _key_arg = source.readBigNumber();
    const _shard_seq = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    return { $$type: 'PublicPublish' as const, kind: _kind, key_arg: _key_arg, shard_seq: _shard_seq, header: _header, body: _body };
}

export function loadGetterTuplePublicPublish(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _key_arg = source.readBigNumber();
    const _shard_seq = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    return { $$type: 'PublicPublish' as const, kind: _kind, key_arg: _key_arg, shard_seq: _shard_seq, header: _header, body: _body };
}

export function storeTuplePublicPublish(source: PublicPublish) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.kind);
    builder.writeNumber(source.key_arg);
    builder.writeNumber(source.shard_seq);
    builder.writeCell(source.header);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserPublicPublish(): DictionaryValue<PublicPublish> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicPublish(src)).endCell());
        },
        parse: (src) => {
            return loadPublicPublish(src.loadRef().beginParse());
        }
    }
}

export type RetirePublicShard = {
    $$type: 'RetirePublicShard';
}

export function storeRetirePublicShard(src: RetirePublicShard) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1347637299, 32);
    };
}

export function loadRetirePublicShard(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1347637299) { throw Error('Invalid prefix'); }
    return { $$type: 'RetirePublicShard' as const };
}

export function loadTupleRetirePublicShard(source: TupleReader) {
    return { $$type: 'RetirePublicShard' as const };
}

export function loadGetterTupleRetirePublicShard(source: TupleReader) {
    return { $$type: 'RetirePublicShard' as const };
}

export function storeTupleRetirePublicShard(source: RetirePublicShard) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserRetirePublicShard(): DictionaryValue<RetirePublicShard> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRetirePublicShard(src)).endCell());
        },
        parse: (src) => {
            return loadRetirePublicShard(src.loadRef().beginParse());
        }
    }
}

export type DepositCapsuleFee = {
    $$type: 'DepositCapsuleFee';
    amount: bigint;
    lane: bigint;
    init_arg0: bigint;
    init_arg1: bigint;
    publisher: Address;
}

export function storeDepositCapsuleFee(src: DepositCapsuleFee) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1381191750, 32);
        b_0.storeUint(src.amount, 128);
        b_0.storeUint(src.lane, 8);
        b_0.storeInt(src.init_arg0, 257);
        b_0.storeInt(src.init_arg1, 257);
        b_0.storeAddress(src.publisher);
    };
}

export function loadDepositCapsuleFee(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1381191750) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    const _lane = sc_0.loadUintBig(8);
    const _init_arg0 = sc_0.loadIntBig(257);
    const _init_arg1 = sc_0.loadIntBig(257);
    const _publisher = sc_0.loadAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, lane: _lane, init_arg0: _init_arg0, init_arg1: _init_arg1, publisher: _publisher };
}

export function loadTupleDepositCapsuleFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _init_arg0 = source.readBigNumber();
    const _init_arg1 = source.readBigNumber();
    const _publisher = source.readAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, lane: _lane, init_arg0: _init_arg0, init_arg1: _init_arg1, publisher: _publisher };
}

export function loadGetterTupleDepositCapsuleFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _init_arg0 = source.readBigNumber();
    const _init_arg1 = source.readBigNumber();
    const _publisher = source.readAddress();
    return { $$type: 'DepositCapsuleFee' as const, amount: _amount, lane: _lane, init_arg0: _init_arg0, init_arg1: _init_arg1, publisher: _publisher };
}

export function storeTupleDepositCapsuleFee(source: DepositCapsuleFee) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    builder.writeNumber(source.lane);
    builder.writeNumber(source.init_arg0);
    builder.writeNumber(source.init_arg1);
    builder.writeAddress(source.publisher);
    return builder.build();
}

export function dictValueParserDepositCapsuleFee(): DictionaryValue<DepositCapsuleFee> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDepositCapsuleFee(src)).endCell());
        },
        parse: (src) => {
            return loadDepositCapsuleFee(src.loadRef().beginParse());
        }
    }
}

export type PublicEntry = {
    $$type: 'PublicEntry';
    publisher: Address;
    body_commit: bigint;
    created_at: bigint;
}

export function storePublicEntry(src: PublicEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.publisher);
        b_0.storeInt(src.body_commit, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPublicEntry(slice: Slice) {
    const sc_0 = slice;
    const _publisher = sc_0.loadAddress();
    const _body_commit = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PublicEntry' as const, publisher: _publisher, body_commit: _body_commit, created_at: _created_at };
}

export function loadTuplePublicEntry(source: TupleReader) {
    const _publisher = source.readAddress();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicEntry' as const, publisher: _publisher, body_commit: _body_commit, created_at: _created_at };
}

export function loadGetterTuplePublicEntry(source: TupleReader) {
    const _publisher = source.readAddress();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicEntry' as const, publisher: _publisher, body_commit: _body_commit, created_at: _created_at };
}

export function storeTuplePublicEntry(source: PublicEntry) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.publisher);
    builder.writeNumber(source.body_commit);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPublicEntry(): DictionaryValue<PublicEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicEntry(src)).endCell());
        },
        parse: (src) => {
            return loadPublicEntry(src.loadRef().beginParse());
        }
    }
}

export type PublicEntryView = {
    $$type: 'PublicEntryView';
    exists: boolean;
    publisher: Address;
    body_commit: bigint;
    created_at: bigint;
}

export function storePublicEntryView(src: PublicEntryView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.publisher);
        b_0.storeInt(src.body_commit, 257);
        b_0.storeInt(src.created_at, 257);
    };
}

export function loadPublicEntryView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _publisher = sc_0.loadAddress();
    const _body_commit = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    return { $$type: 'PublicEntryView' as const, exists: _exists, publisher: _publisher, body_commit: _body_commit, created_at: _created_at };
}

export function loadTuplePublicEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _publisher = source.readAddress();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicEntryView' as const, exists: _exists, publisher: _publisher, body_commit: _body_commit, created_at: _created_at };
}

export function loadGetterTuplePublicEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _publisher = source.readAddress();
    const _body_commit = source.readBigNumber();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicEntryView' as const, exists: _exists, publisher: _publisher, body_commit: _body_commit, created_at: _created_at };
}

export function storeTuplePublicEntryView(source: PublicEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.publisher);
    builder.writeNumber(source.body_commit);
    builder.writeNumber(source.created_at);
    return builder.build();
}

export function dictValueParserPublicEntryView(): DictionaryValue<PublicEntryView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicEntryView(src)).endCell());
        },
        parse: (src) => {
            return loadPublicEntryView(src.loadRef().beginParse());
        }
    }
}

export type PublicPage = {
    $$type: 'PublicPage';
    from_id: bigint;
    count: bigint;
    entry_count: bigint;
    rows: Cell;
}

export function storePublicPage(src: PublicPage) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.from_id, 257);
        b_0.storeInt(src.count, 257);
        b_0.storeInt(src.entry_count, 257);
        b_0.storeRef(src.rows);
    };
}

export function loadPublicPage(slice: Slice) {
    const sc_0 = slice;
    const _from_id = sc_0.loadIntBig(257);
    const _count = sc_0.loadIntBig(257);
    const _entry_count = sc_0.loadIntBig(257);
    const _rows = sc_0.loadRef();
    return { $$type: 'PublicPage' as const, from_id: _from_id, count: _count, entry_count: _entry_count, rows: _rows };
}

export function loadTuplePublicPage(source: TupleReader) {
    const _from_id = source.readBigNumber();
    const _count = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    const _rows = source.readCell();
    return { $$type: 'PublicPage' as const, from_id: _from_id, count: _count, entry_count: _entry_count, rows: _rows };
}

export function loadGetterTuplePublicPage(source: TupleReader) {
    const _from_id = source.readBigNumber();
    const _count = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    const _rows = source.readCell();
    return { $$type: 'PublicPage' as const, from_id: _from_id, count: _count, entry_count: _entry_count, rows: _rows };
}

export function storeTuplePublicPage(source: PublicPage) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.from_id);
    builder.writeNumber(source.count);
    builder.writeNumber(source.entry_count);
    builder.writeCell(source.rows);
    return builder.build();
}

export function dictValueParserPublicPage(): DictionaryValue<PublicPage> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicPage(src)).endCell());
        },
        parse: (src) => {
            return loadPublicPage(src.loadRef().beginParse());
        }
    }
}

export type PublicShardView = {
    $$type: 'PublicShardView';
    partition_key: bigint;
    epoch_tag: bigint;
    kind: bigint;
    era_index: bigint;
    entry_count: bigint;
    safe_cap: bigint;
    era_seconds: bigint;
    retention: bigint;
    min_value: bigint;
    deploy_min_value: bigint;
    protocol_fee: bigint;
    retire_at: bigint;
    fee_sink: Address;
}

export function storePublicShardView(src: PublicShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.partition_key, 257);
        b_0.storeInt(src.epoch_tag, 257);
        b_0.storeInt(src.kind, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.era_index, 257);
        b_1.storeInt(src.entry_count, 257);
        b_1.storeInt(src.safe_cap, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.era_seconds, 257);
        b_2.storeInt(src.retention, 257);
        b_2.storeInt(src.min_value, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.deploy_min_value, 257);
        b_3.storeInt(src.protocol_fee, 257);
        b_3.storeInt(src.retire_at, 257);
        const b_4 = new Builder();
        b_4.storeAddress(src.fee_sink);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublicShardView(slice: Slice) {
    const sc_0 = slice;
    const _partition_key = sc_0.loadIntBig(257);
    const _epoch_tag = sc_0.loadIntBig(257);
    const _kind = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _era_index = sc_1.loadIntBig(257);
    const _entry_count = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _era_seconds = sc_2.loadIntBig(257);
    const _retention = sc_2.loadIntBig(257);
    const _min_value = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _deploy_min_value = sc_3.loadIntBig(257);
    const _protocol_fee = sc_3.loadIntBig(257);
    const _retire_at = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _fee_sink = sc_4.loadAddress();
    return { $$type: 'PublicShardView' as const, partition_key: _partition_key, epoch_tag: _epoch_tag, kind: _kind, era_index: _era_index, entry_count: _entry_count, safe_cap: _safe_cap, era_seconds: _era_seconds, retention: _retention, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function loadTuplePublicShardView(source: TupleReader) {
    const _partition_key = source.readBigNumber();
    const _epoch_tag = source.readBigNumber();
    const _kind = source.readBigNumber();
    const _era_index = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _era_seconds = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _min_value = source.readBigNumber();
    const _deploy_min_value = source.readBigNumber();
    const _protocol_fee = source.readBigNumber();
    const _retire_at = source.readBigNumber();
    const _fee_sink = source.readAddress();
    return { $$type: 'PublicShardView' as const, partition_key: _partition_key, epoch_tag: _epoch_tag, kind: _kind, era_index: _era_index, entry_count: _entry_count, safe_cap: _safe_cap, era_seconds: _era_seconds, retention: _retention, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function loadGetterTuplePublicShardView(source: TupleReader) {
    const _partition_key = source.readBigNumber();
    const _epoch_tag = source.readBigNumber();
    const _kind = source.readBigNumber();
    const _era_index = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _era_seconds = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _min_value = source.readBigNumber();
    const _deploy_min_value = source.readBigNumber();
    const _protocol_fee = source.readBigNumber();
    const _retire_at = source.readBigNumber();
    const _fee_sink = source.readAddress();
    return { $$type: 'PublicShardView' as const, partition_key: _partition_key, epoch_tag: _epoch_tag, kind: _kind, era_index: _era_index, entry_count: _entry_count, safe_cap: _safe_cap, era_seconds: _era_seconds, retention: _retention, min_value: _min_value, deploy_min_value: _deploy_min_value, protocol_fee: _protocol_fee, retire_at: _retire_at, fee_sink: _fee_sink };
}

export function storeTuplePublicShardView(source: PublicShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.partition_key);
    builder.writeNumber(source.epoch_tag);
    builder.writeNumber(source.kind);
    builder.writeNumber(source.era_index);
    builder.writeNumber(source.entry_count);
    builder.writeNumber(source.safe_cap);
    builder.writeNumber(source.era_seconds);
    builder.writeNumber(source.retention);
    builder.writeNumber(source.min_value);
    builder.writeNumber(source.deploy_min_value);
    builder.writeNumber(source.protocol_fee);
    builder.writeNumber(source.retire_at);
    builder.writeAddress(source.fee_sink);
    return builder.build();
}

export function dictValueParserPublicShardView(): DictionaryValue<PublicShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicShardView(src)).endCell());
        },
        parse: (src) => {
            return loadPublicShardView(src.loadRef().beginParse());
        }
    }
}

export type PublicShard$Data = {
    $$type: 'PublicShard$Data';
    partition_key: bigint;
    epoch_tag: bigint;
    entries: Dictionary<bigint, PublicEntry>;
    entry_count: bigint;
}

export function storePublicShard$Data(src: PublicShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.partition_key, 256);
        b_0.storeUint(src.epoch_tag, 64);
        b_0.storeDict(src.entries, Dictionary.Keys.BigInt(257), dictValueParserPublicEntry());
        b_0.storeUint(src.entry_count, 32);
    };
}

export function loadPublicShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _partition_key = sc_0.loadUintBig(256);
    const _epoch_tag = sc_0.loadUintBig(64);
    const _entries = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPublicEntry(), sc_0);
    const _entry_count = sc_0.loadUintBig(32);
    return { $$type: 'PublicShard$Data' as const, partition_key: _partition_key, epoch_tag: _epoch_tag, entries: _entries, entry_count: _entry_count };
}

export function loadTuplePublicShard$Data(source: TupleReader) {
    const _partition_key = source.readBigNumber();
    const _epoch_tag = source.readBigNumber();
    const _entries = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPublicEntry(), source.readCellOpt());
    const _entry_count = source.readBigNumber();
    return { $$type: 'PublicShard$Data' as const, partition_key: _partition_key, epoch_tag: _epoch_tag, entries: _entries, entry_count: _entry_count };
}

export function loadGetterTuplePublicShard$Data(source: TupleReader) {
    const _partition_key = source.readBigNumber();
    const _epoch_tag = source.readBigNumber();
    const _entries = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPublicEntry(), source.readCellOpt());
    const _entry_count = source.readBigNumber();
    return { $$type: 'PublicShard$Data' as const, partition_key: _partition_key, epoch_tag: _epoch_tag, entries: _entries, entry_count: _entry_count };
}

export function storeTuplePublicShard$Data(source: PublicShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.partition_key);
    builder.writeNumber(source.epoch_tag);
    builder.writeCell(source.entries.size > 0 ? beginCell().storeDictDirect(source.entries, Dictionary.Keys.BigInt(257), dictValueParserPublicEntry()).endCell() : null);
    builder.writeNumber(source.entry_count);
    return builder.build();
}

export function dictValueParserPublicShard$Data(): DictionaryValue<PublicShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadPublicShard$Data(src.loadRef().beginParse());
        }
    }
}

 type PublicShard_init_args = {
    $$type: 'PublicShard_init_args';
    partition_key: bigint;
    epoch_tag: bigint;
}

function initPublicShard_init_args(src: PublicShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.partition_key, 257);
        b_0.storeInt(src.epoch_tag, 257);
    };
}

async function PublicShard_init(partition_key: bigint, epoch_tag: bigint) {
    const __code = Cell.fromHex('b5ee9c72410225010006a6000114ff00f4a413f4bcf2c80b01020162020e04d6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019cd3ffd33ff404d31f55306c148e10810101d700810101d7005902d1016d70e205e3027024d74920c21f953104d31f05de21821050535031bae3023520821050535033bae302c00004c12114b003040c0d00de038020d7217021d749c21f9430d31f01de821052535046ba8e52d37fd30759303181358df8428d086004b26f916954c2325a585bcf798c2714e04cf49b96690cf7349f477571371eb3fcc705f2f481358e01c200f2f44003c87f01ca0055305034cbffcb3ff400cb1fc9ed54e05f05046c5b03d307d3ffd31fd4d430465781358509db3c5260ba1af2f45522102881358607db3c24ba15f2f4f82304db3c15a9045520813587051c051a0702da228e9c6c21c882105053434801cb1f5531db3c5005cbff15cb1fc9f9004430e122c0018e1232c882105053544801cb1fcbffcb1fc9f900e03001c0028e14c882105053424301cb1f01841fb001cb1fc9f900e030c882105053415601cb1f5530db3c5005cbffc9f9001034413006060024f84281358b01d30a018309ba12f2f4d3ff300342db3ca55250be8e85db3ca415bb923470e215f2f4813588f8416f24135f0324c00019190804fe8e845054db3c8e845054db3ce215be15f2f481358923830bb9f2f481358c23841fb9f2f42381010124f84210374698db3c32f8234770c855205023ce810101cf00810101cf00c910344460206e953059f45a30944133f415e202a48d086004b26f916954c2325a585bcf798c2714e04cf49b96690cf7349f477571371eb3fc1314090a0032c882105053464401cb1f02f90058cbff01f90001cbffc9f90003fc8208c042c07f71820898968072f8425468b0c855408210525350465006cb1f14cb7f12cb07810101cf00810101cf00cec94343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004330db3c21c0018e845530db3c93553070e215a076fb02f8427081008270136d6d50436d03c8cf8580ca00cf8440ce01fa02806915160b006ecf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb005502c87f01ca0055305034cbffcb3ff400cb1fc9ed5401d0303381358af8235045db3c6c2114bc12f2f46d70f842218100a270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb001023c87f01ca0055305034cbffcb3ff400cb1fc9ed5418003c8e164003c87f01ca0055305034cbffcb3ff400cb1fc9ed54e05f04f2c0820201200f1f020166101d0159b254bb51343480006734fff4cffd0134c7d54c1b05238420404075c020404075c01640b4405b5c38b6cf1b136011042a5d5531db3c5530db3c5414045043830b06db3c55301c191a120424db3c5530db3c5530db3c44348208989680041b1413170218db3c5530db3c15a01034413014160128db3c82082625a0a08208989680a082082ab980a0150136db3c20c00396308208249f00e0c002958208186a00e0820807a1201c0136db3c20c003963082094ca440e0c002958208dd40a0e0820844aa201c0188db3c8d086004b26f916954c2325a585bcf798c2714e04cf49b96690cf7349f477571371eb3fc0c11100c10bf10ae09111009108f107d106e05111005104f103d102e10de180330db3ca6025530db3c15a804db3c15a082015180a010344130191a1b000822841fb00122db3cc102958208278d00958209e13380e21c0138db3c20c0039730821005a39a80e0c002958209e13380e08209e133801c000622ab1f015db23dbb51343480006734fff4cffd0134c7d54c1b05238420404075c020404075c01640b4405b5c389540f6cf1b11201e0070810101230259f40d6fa192306ddf206e92306d8e13d0fa40810101d700810101d70055206c136f03e2206e963070f8287020e06f237f5520015dbf9bdf6a268690000ce69ffe99ffa02698faa98360a4708408080eb80408080eb802c816880b6b8712a89ed9e362242001520170b6095320bc935320a19170e270038060b60801b60812b60922103645465354db3c103645701047210118c8c97f9322c2008ae8135f032202fa2272b6085343a021a1c870935303b98ee88101015331a02b5959f40d6fa192306ddf206e92306d8e13d0fa40810101d700810101d70055206c136f03e2206e917095206f233031e25003cbff226e917095226f236c21e201cb3f226e9232708e92026f235b104c103b4a90db3c104c103b4a90e258cb7f01a4e83031222324000cfa4431a9387f001c946c22c9709413ccc901e25aa15909639d03');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initPublicShard_init_args({ $$type: 'PublicShard_init_args', partition_key, epoch_tag })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const PublicShard_errors = {
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

export const PublicShard_errors_backward = {
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

const PublicShard_types: ABIType[] = [
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
    {"name":"PublicPublish","header":1347637297,"fields":[{"name":"kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"key_arg","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"shard_seq","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"RetirePublicShard","header":1347637299,"fields":[]},
    {"name":"DepositCapsuleFee","header":1381191750,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"lane","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"init_arg0","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"init_arg1","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publisher","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PublicEntry","header":null,"fields":[{"name":"publisher","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PublicEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"publisher","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_commit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PublicPage","header":null,"fields":[{"name":"from_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"rows","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicShardView","header":null,"fields":[{"name":"partition_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"epoch_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"kind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"era_index","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"era_seconds","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retention","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"deploy_min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"protocol_fee","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retire_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_sink","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PublicShard$Data","header":null,"fields":[{"name":"partition_key","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch_tag","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entries","type":{"kind":"dict","key":"int","value":"PublicEntry","valueFormat":"ref"}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const PublicShard_opcodes = {
    "PublicPublish": 1347637297,
    "RetirePublicShard": 1347637299,
    "DepositCapsuleFee": 1381191750,
}

const PublicShard_getters: ABIGetter[] = [
    {"name":"get_page","methodId":127867,"arguments":[{"name":"from_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicPage","optional":false}},
    {"name":"get_entry","methodId":80118,"arguments":[{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicEntryView","optional":false}},
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"PublicShardView","optional":false}},
]

export const PublicShard_getterMapping: { [key: string]: string } = {
    'get_page': 'getGetPage',
    'get_entry': 'getGetEntry',
    'get_view': 'getGetView',
}

const PublicShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"PublicPublish"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RetirePublicShard"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const PS_SAFE_CAP = 4096n;
export const PS_ERA_SHORT = 2592000n;
export const PS_ERA_LONG = 31536000n;
export const PS_RETENTION_POST = 31536000n;
export const PS_RETENTION_BEACON = 31536000n;
export const PS_RETENTION_AVATAR = 94608000n;
export const PS_KIND_CHANNEL = 0n;
export const PS_KIND_THREAD = 1n;
export const PS_KIND_BEACON = 2n;
export const PS_KIND_AVATAR = 3n;
export const PS_CHANNEL_DOMAIN = 1347633992n;
export const PS_THREAD_DOMAIN = 1347638344n;
export const PS_BEACON_DOMAIN = 1347633731n;
export const PS_AVATAR_DOMAIN = 1347633494n;
export const PS_BODY_DOMAIN = 1347634756n;
export const PS_POST_UID_DOMAIN = 1347638596n;
export const PS_ENTRY_ENDOWMENT_POST = 500000n;
export const PS_ENTRY_ENDOWMENT_BEACON = 1600000n;
export const PS_ENTRY_ENDOWMENT_AVATAR = 2400000n;
export const PS_BASE_ENDOWMENT_POST = 4500000n;
export const PS_BASE_ENDOWMENT_BEACON = 14500000n;
export const PS_BASE_ENDOWMENT_AVATAR = 21800000n;
export const PS_PUBLISH_GAS = 2500000n;
export const PS_PROTOCOL_FEE = 10000000n;
export const PS_FEE_SINK = address("EQCWTfItKphGS0sLee8xhOKcCZ6Tcs0hnuaT6O6uJuPWf6ws");
export const PS_FEE_SINK_DEPOSIT_RESERVE = 2600000n;
export const PS_FEE_SINK_FWD_RESERVE = 200000n;
export const PS_FEE_TRANSPORT = 2800000n;
export const PS_RETIRE_SLACK = 86400n;
export const PS_UINT32_MAX = 4294967295n;
export const PS_ROW_BITS = 448n;
export const PS_PAIRS_PER_CELL = 2n;
export const PS_PUBLISHER_TAG_MOD = 340282366920938463463374607431768211456n;
export const PS_PAGE_CAP = 96n;

export class PublicShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = PublicShard_errors_backward;
    public static readonly opcodes = PublicShard_opcodes;
    
    static async init(partition_key: bigint, epoch_tag: bigint) {
        return await PublicShard_init(partition_key, epoch_tag);
    }
    
    static async fromInit(partition_key: bigint, epoch_tag: bigint) {
        const __gen_init = await PublicShard_init(partition_key, epoch_tag);
        const address = contractAddress(0, __gen_init);
        return new PublicShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new PublicShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  PublicShard_types,
        getters: PublicShard_getters,
        receivers: PublicShard_receivers,
        errors: PublicShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: PublicPublish | RetirePublicShard | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublicPublish') {
            body = beginCell().store(storePublicPublish(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RetirePublicShard') {
            body = beginCell().store(storeRetirePublicShard(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetPage(provider: ContractProvider, from_id: bigint, max_count: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(from_id);
        builder.writeNumber(max_count);
        const source = (await provider.get('get_page', builder.build())).stack;
        const result = loadGetterTuplePublicPage(source);
        return result;
    }
    
    async getGetEntry(provider: ContractProvider, entry_id: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entry_id);
        const source = (await provider.get('get_entry', builder.build())).stack;
        const result = loadGetterTuplePublicEntryView(source);
        return result;
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTuplePublicShardView(source);
        return result;
    }
    
}