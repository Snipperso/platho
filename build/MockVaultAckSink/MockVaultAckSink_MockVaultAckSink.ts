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

export type PublishPrivateFromVault = {
    $$type: 'PublishPrivateFromVault';
    bounce_id: bigint;
    bounce_tag: bigint;
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
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.header_1_hash, 256);
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
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_1_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
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
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
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
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPrivateFromVault(source: PublishPrivateFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
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
    bounce_tag: bigint;
    publish_id: bigint;
    size_class: bigint;
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
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
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
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _marketing_note = sc_0.loadUintBig(152);
    const _author_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicFromVault(source: PublishPublicFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.size_class);
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

export type ForwardVaultPrivate = {
    $$type: 'ForwardVaultPrivate';
    capsule_hub_address: Address;
    bounce_id: bigint;
    bounce_tag: bigint;
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
    value_to_capsule: bigint;
}

export function storeForwardVaultPrivate(src: ForwardVaultPrivate) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4194308097, 32);
        b_0.storeAddress(src.capsule_hub_address);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        const b_1 = new Builder();
        b_1.storeUint(src.header_0_hash, 256);
        b_1.storeUint(src.header_1_hash, 256);
        b_1.storeUint(src.body_hash, 256);
        b_1.storeRef(src.header_0);
        b_1.storeRef(src.header_1);
        b_1.storeRef(src.body);
        b_1.storeUint(src.protocol_fee_paid, 128);
        const b_2 = new Builder();
        b_2.storeUint(src.value_to_capsule, 128);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadForwardVaultPrivate(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4194308097) { throw Error('Invalid prefix'); }
    const _capsule_hub_address = sc_0.loadAddress();
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_0_hash = sc_1.loadUintBig(256);
    const _header_1_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    const sc_2 = sc_1.loadRef().beginParse();
    const _value_to_capsule = sc_2.loadUintBig(128);
    return { $$type: 'ForwardVaultPrivate' as const, capsule_hub_address: _capsule_hub_address, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid, value_to_capsule: _value_to_capsule };
}

export function loadTupleForwardVaultPrivate(source: TupleReader) {
    const _capsule_hub_address = source.readAddress();
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
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
    const _value_to_capsule = source.readBigNumber();
    return { $$type: 'ForwardVaultPrivate' as const, capsule_hub_address: _capsule_hub_address, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid, value_to_capsule: _value_to_capsule };
}

export function loadGetterTupleForwardVaultPrivate(source: TupleReader) {
    const _capsule_hub_address = source.readAddress();
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
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
    const _value_to_capsule = source.readBigNumber();
    return { $$type: 'ForwardVaultPrivate' as const, capsule_hub_address: _capsule_hub_address, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, protocol_fee_paid: _protocol_fee_paid, value_to_capsule: _value_to_capsule };
}

export function storeTupleForwardVaultPrivate(source: ForwardVaultPrivate) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.capsule_hub_address);
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
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
    builder.writeNumber(source.value_to_capsule);
    return builder.build();
}

export function dictValueParserForwardVaultPrivate(): DictionaryValue<ForwardVaultPrivate> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeForwardVaultPrivate(src)).endCell());
        },
        parse: (src) => {
            return loadForwardVaultPrivate(src.loadRef().beginParse());
        }
    }
}

export type ForwardVaultPublic = {
    $$type: 'ForwardVaultPublic';
    capsule_hub_address: Address;
    bounce_id: bigint;
    bounce_tag: bigint;
    publish_id: bigint;
    size_class: bigint;
    marketing_note: bigint;
    author_wallet: Address;
    header_hash: bigint;
    body_hash: bigint;
    header: Cell;
    body: Cell;
    protocol_fee_paid: bigint;
    value_to_capsule: bigint;
}

export function storeForwardVaultPublic(src: ForwardVaultPublic) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4194308098, 32);
        b_0.storeAddress(src.capsule_hub_address);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.marketing_note, 152);
        const b_1 = new Builder();
        b_1.storeAddress(src.author_wallet);
        b_1.storeUint(src.header_hash, 256);
        b_1.storeUint(src.body_hash, 256);
        b_1.storeRef(src.header);
        b_1.storeRef(src.body);
        b_1.storeUint(src.protocol_fee_paid, 128);
        const b_2 = new Builder();
        b_2.storeUint(src.value_to_capsule, 128);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadForwardVaultPublic(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4194308098) { throw Error('Invalid prefix'); }
    const _capsule_hub_address = sc_0.loadAddress();
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _marketing_note = sc_0.loadUintBig(152);
    const sc_1 = sc_0.loadRef().beginParse();
    const _author_wallet = sc_1.loadAddress();
    const _header_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    const sc_2 = sc_1.loadRef().beginParse();
    const _value_to_capsule = sc_2.loadUintBig(128);
    return { $$type: 'ForwardVaultPublic' as const, capsule_hub_address: _capsule_hub_address, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid, value_to_capsule: _value_to_capsule };
}

export function loadTupleForwardVaultPublic(source: TupleReader) {
    const _capsule_hub_address = source.readAddress();
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    const _value_to_capsule = source.readBigNumber();
    return { $$type: 'ForwardVaultPublic' as const, capsule_hub_address: _capsule_hub_address, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid, value_to_capsule: _value_to_capsule };
}

export function loadGetterTupleForwardVaultPublic(source: TupleReader) {
    const _capsule_hub_address = source.readAddress();
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    const _value_to_capsule = source.readBigNumber();
    return { $$type: 'ForwardVaultPublic' as const, capsule_hub_address: _capsule_hub_address, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, size_class: _size_class, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid, value_to_capsule: _value_to_capsule };
}

export function storeTupleForwardVaultPublic(source: ForwardVaultPublic) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.capsule_hub_address);
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.marketing_note);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header);
    builder.writeCell(source.body);
    builder.writeNumber(source.protocol_fee_paid);
    builder.writeNumber(source.value_to_capsule);
    return builder.build();
}

export function dictValueParserForwardVaultPublic(): DictionaryValue<ForwardVaultPublic> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeForwardVaultPublic(src)).endCell());
        },
        parse: (src) => {
            return loadForwardVaultPublic(src.loadRef().beginParse());
        }
    }
}

export type MockVaultStateView = {
    $$type: 'MockVaultStateView';
    ack_count: bigint;
    last_publish_id: bigint;
    last_entry_id: bigint;
    last_entry_uid: bigint;
}

export function storeMockVaultStateView(src: MockVaultStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.ack_count, 257);
        b_0.storeInt(src.last_publish_id, 257);
        b_0.storeInt(src.last_entry_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.last_entry_uid, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadMockVaultStateView(slice: Slice) {
    const sc_0 = slice;
    const _ack_count = sc_0.loadIntBig(257);
    const _last_publish_id = sc_0.loadIntBig(257);
    const _last_entry_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _last_entry_uid = sc_1.loadIntBig(257);
    return { $$type: 'MockVaultStateView' as const, ack_count: _ack_count, last_publish_id: _last_publish_id, last_entry_id: _last_entry_id, last_entry_uid: _last_entry_uid };
}

export function loadTupleMockVaultStateView(source: TupleReader) {
    const _ack_count = source.readBigNumber();
    const _last_publish_id = source.readBigNumber();
    const _last_entry_id = source.readBigNumber();
    const _last_entry_uid = source.readBigNumber();
    return { $$type: 'MockVaultStateView' as const, ack_count: _ack_count, last_publish_id: _last_publish_id, last_entry_id: _last_entry_id, last_entry_uid: _last_entry_uid };
}

export function loadGetterTupleMockVaultStateView(source: TupleReader) {
    const _ack_count = source.readBigNumber();
    const _last_publish_id = source.readBigNumber();
    const _last_entry_id = source.readBigNumber();
    const _last_entry_uid = source.readBigNumber();
    return { $$type: 'MockVaultStateView' as const, ack_count: _ack_count, last_publish_id: _last_publish_id, last_entry_id: _last_entry_id, last_entry_uid: _last_entry_uid };
}

export function storeTupleMockVaultStateView(source: MockVaultStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ack_count);
    builder.writeNumber(source.last_publish_id);
    builder.writeNumber(source.last_entry_id);
    builder.writeNumber(source.last_entry_uid);
    return builder.build();
}

export function dictValueParserMockVaultStateView(): DictionaryValue<MockVaultStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMockVaultStateView(src)).endCell());
        },
        parse: (src) => {
            return loadMockVaultStateView(src.loadRef().beginParse());
        }
    }
}

export type MockVaultAckSink$Data = {
    $$type: 'MockVaultAckSink$Data';
    ack_count: bigint;
    last_publish_id: bigint;
    last_entry_id: bigint;
    last_entry_uid: bigint;
}

export function storeMockVaultAckSink$Data(src: MockVaultAckSink$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.ack_count, 64);
        b_0.storeUint(src.last_publish_id, 256);
        b_0.storeUint(src.last_entry_id, 64);
        b_0.storeUint(src.last_entry_uid, 256);
    };
}

export function loadMockVaultAckSink$Data(slice: Slice) {
    const sc_0 = slice;
    const _ack_count = sc_0.loadUintBig(64);
    const _last_publish_id = sc_0.loadUintBig(256);
    const _last_entry_id = sc_0.loadUintBig(64);
    const _last_entry_uid = sc_0.loadUintBig(256);
    return { $$type: 'MockVaultAckSink$Data' as const, ack_count: _ack_count, last_publish_id: _last_publish_id, last_entry_id: _last_entry_id, last_entry_uid: _last_entry_uid };
}

export function loadTupleMockVaultAckSink$Data(source: TupleReader) {
    const _ack_count = source.readBigNumber();
    const _last_publish_id = source.readBigNumber();
    const _last_entry_id = source.readBigNumber();
    const _last_entry_uid = source.readBigNumber();
    return { $$type: 'MockVaultAckSink$Data' as const, ack_count: _ack_count, last_publish_id: _last_publish_id, last_entry_id: _last_entry_id, last_entry_uid: _last_entry_uid };
}

export function loadGetterTupleMockVaultAckSink$Data(source: TupleReader) {
    const _ack_count = source.readBigNumber();
    const _last_publish_id = source.readBigNumber();
    const _last_entry_id = source.readBigNumber();
    const _last_entry_uid = source.readBigNumber();
    return { $$type: 'MockVaultAckSink$Data' as const, ack_count: _ack_count, last_publish_id: _last_publish_id, last_entry_id: _last_entry_id, last_entry_uid: _last_entry_uid };
}

export function storeTupleMockVaultAckSink$Data(source: MockVaultAckSink$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.ack_count);
    builder.writeNumber(source.last_publish_id);
    builder.writeNumber(source.last_entry_id);
    builder.writeNumber(source.last_entry_uid);
    return builder.build();
}

export function dictValueParserMockVaultAckSink$Data(): DictionaryValue<MockVaultAckSink$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMockVaultAckSink$Data(src)).endCell());
        },
        parse: (src) => {
            return loadMockVaultAckSink$Data(src.loadRef().beginParse());
        }
    }
}

 type MockVaultAckSink_init_args = {
    $$type: 'MockVaultAckSink_init_args';
}

function initMockVaultAckSink_init_args(src: MockVaultAckSink_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
    };
}

async function MockVaultAckSink_init() {
    const __code = Cell.fromHex('b5ee9c7241020b0100022b000114ff00f4a413f4bcf2c80b01020162020904d6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019cd33fd3ffd33fd3ff55306c14953070547000e205925f05e07024d74920c21f953104d31f05de218210fa001001bae302218210fa001002bae302218210874e576abae30235c00004c12114b00305070801d85b03fa40d33fd39fd3ffd307d307d430d0d3ffd3ffd3ffd4d4d4d37fd430d0d37f30109c108b107a106c105b104a103c4ba07f50dc700cc855b0db3cc94343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004003c87f01ca0055305034cb3fcbffcb3fcbffc9ed540400588210a4f862c0500dcb1f1bcb3f19cb9f17cbff15cb0713cb07cbff01c8cbff12cbff12cc12cc12cc12cb7fcd01d65b03fa40d33fd39fd3ffd307d397d430d0fa40d3ffd3ffd4d4d37fd430d0d37f30108b107a1069105b104a10394ba07f50ac700cc855a0db3cc943304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004003c87f01ca0055305034cb3fcbffcb3fcbffc9ed5406005282108c2a76b7500ccb1f1acb3f18cb9f16cbff14cb0712cb97ce01c8cbff12cbff12cc12cc12cb7fcd00425f0432d3ffd33fd3ff3003a403c87f01ca0055305034cb3fcbffcb3fcbffc9ed5400468e1b815207f2f04003c87f01ca0055305034cb3fcbffcb3fcbffc9ed54e05f04f2c0820141a0a75bda89a1a4000339a67fa7ffa67fa7feaa60d8292a60e0a8e001c5b678d8890a0008547321231f660dc4');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initMockVaultAckSink_init_args({ $$type: 'MockVaultAckSink_init_args' })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const MockVaultAckSink_errors = {
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

export const MockVaultAckSink_errors_backward = {
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

const MockVaultAckSink_types: ABIType[] = [
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
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"ForwardVaultPrivate","header":4194308097,"fields":[{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"value_to_capsule","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"ForwardVaultPublic","header":4194308098,"fields":[{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"value_to_capsule","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"MockVaultStateView","header":null,"fields":[{"name":"ack_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"MockVaultAckSink$Data","header":null,"fields":[{"name":"ack_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"last_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
]

const MockVaultAckSink_opcodes = {
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "ForwardVaultPrivate": 4194308097,
    "ForwardVaultPublic": 4194308098,
}

const MockVaultAckSink_getters: ABIGetter[] = [
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"MockVaultStateView","optional":false}},
]

export const MockVaultAckSink_getterMapping: { [key: string]: string } = {
    'get_state': 'getGetState',
}

const MockVaultAckSink_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"ForwardVaultPrivate"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ForwardVaultPublic"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CapsuleHubPublishAck"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]


export class MockVaultAckSink implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = MockVaultAckSink_errors_backward;
    public static readonly opcodes = MockVaultAckSink_opcodes;
    
    static async init() {
        return await MockVaultAckSink_init();
    }
    
    static async fromInit() {
        const __gen_init = await MockVaultAckSink_init();
        const address = contractAddress(0, __gen_init);
        return new MockVaultAckSink(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new MockVaultAckSink(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  MockVaultAckSink_types,
        getters: MockVaultAckSink_getters,
        receivers: MockVaultAckSink_receivers,
        errors: MockVaultAckSink_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: ForwardVaultPrivate | ForwardVaultPublic | CapsuleHubPublishAck | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ForwardVaultPrivate') {
            body = beginCell().store(storeForwardVaultPrivate(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ForwardVaultPublic') {
            body = beginCell().store(storeForwardVaultPublic(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CapsuleHubPublishAck') {
            body = beginCell().store(storeCapsuleHubPublishAck(message)).endCell();
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
        const result = loadGetterTupleMockVaultStateView(source);
        return result;
    }
    
}