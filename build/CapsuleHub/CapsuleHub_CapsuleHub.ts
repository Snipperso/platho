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

export type PublishAnonBatch = {
    $$type: 'PublishAnonBatch';
    bounce_id: bigint;
    bounce_tag: bigint;
    publish_id: bigint;
    publish_kind: bigint;
    part_count: bigint;
    parts: Cell;
    tokens: Cell;
    marketing: Cell | null;
}

export function storePublishAnonBatch(src: PublishAnonBatch) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1346458946, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.publish_kind, 8);
        b_0.storeUint(src.part_count, 8);
        b_0.storeRef(src.parts);
        b_0.storeRef(src.tokens);
        if (src.marketing !== null && src.marketing !== undefined) { b_0.storeBit(true).storeRef(src.marketing); } else { b_0.storeBit(false); }
    };
}

export function loadPublishAnonBatch(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1346458946) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _publish_kind = sc_0.loadUintBig(8);
    const _part_count = sc_0.loadUintBig(8);
    const _parts = sc_0.loadRef();
    const _tokens = sc_0.loadRef();
    const _marketing = sc_0.loadBit() ? sc_0.loadRef() : null;
    return { $$type: 'PublishAnonBatch' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, publish_kind: _publish_kind, part_count: _part_count, parts: _parts, tokens: _tokens, marketing: _marketing };
}

export function loadTuplePublishAnonBatch(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _parts = source.readCell();
    const _tokens = source.readCell();
    const _marketing = source.readCellOpt();
    return { $$type: 'PublishAnonBatch' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, publish_kind: _publish_kind, part_count: _part_count, parts: _parts, tokens: _tokens, marketing: _marketing };
}

export function loadGetterTuplePublishAnonBatch(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _publish_kind = source.readBigNumber();
    const _part_count = source.readBigNumber();
    const _parts = source.readCell();
    const _tokens = source.readCell();
    const _marketing = source.readCellOpt();
    return { $$type: 'PublishAnonBatch' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, publish_kind: _publish_kind, part_count: _part_count, parts: _parts, tokens: _tokens, marketing: _marketing };
}

export function storeTuplePublishAnonBatch(source: PublishAnonBatch) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.publish_kind);
    builder.writeNumber(source.part_count);
    builder.writeCell(source.parts);
    builder.writeCell(source.tokens);
    builder.writeCell(source.marketing);
    return builder.build();
}

export function dictValueParserPublishAnonBatch(): DictionaryValue<PublishAnonBatch> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishAnonBatch(src)).endCell());
        },
        parse: (src) => {
            return loadPublishAnonBatch(src.loadRef().beginParse());
        }
    }
}

export type PublishRecovery = {
    $$type: 'PublishRecovery';
    bounce_id: bigint;
    bounce_tag: bigint;
    publish_id: bigint;
    part: Cell;
    owner_pubkey: bigint;
    seq: bigint;
    owner_sig: Cell;
}

export function storePublishRecovery(src: PublishRecovery) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1346458179, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.bounce_tag, 160);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeRef(src.part);
        b_0.storeUint(src.owner_pubkey, 256);
        b_0.storeUint(src.seq, 64);
        b_0.storeRef(src.owner_sig);
    };
}

export function loadPublishRecovery(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1346458179) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _bounce_tag = sc_0.loadUintBig(160);
    const _publish_id = sc_0.loadUintBig(256);
    const _part = sc_0.loadRef();
    const _owner_pubkey = sc_0.loadUintBig(256);
    const _seq = sc_0.loadUintBig(64);
    const _owner_sig = sc_0.loadRef();
    return { $$type: 'PublishRecovery' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, part: _part, owner_pubkey: _owner_pubkey, seq: _seq, owner_sig: _owner_sig };
}

export function loadTuplePublishRecovery(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _part = source.readCell();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _owner_sig = source.readCell();
    return { $$type: 'PublishRecovery' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, part: _part, owner_pubkey: _owner_pubkey, seq: _seq, owner_sig: _owner_sig };
}

export function loadGetterTuplePublishRecovery(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _part = source.readCell();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _owner_sig = source.readCell();
    return { $$type: 'PublishRecovery' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, part: _part, owner_pubkey: _owner_pubkey, seq: _seq, owner_sig: _owner_sig };
}

export function storeTuplePublishRecovery(source: PublishRecovery) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
    builder.writeCell(source.part);
    builder.writeNumber(source.owner_pubkey);
    builder.writeNumber(source.seq);
    builder.writeCell(source.owner_sig);
    return builder.build();
}

export function dictValueParserPublishRecovery(): DictionaryValue<PublishRecovery> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishRecovery(src)).endCell());
        },
        parse: (src) => {
            return loadPublishRecovery(src.loadRef().beginParse());
        }
    }
}

export type FundAnonPool = {
    $$type: 'FundAnonPool';
    credits_k: bigint;
    epoch: bigint;
    purchase_id: bigint;
}

export function storeFundAnonPool(src: FundAnonPool) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1178685008, 32);
        b_0.storeUint(src.credits_k, 64);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.purchase_id, 64);
    };
}

export function loadFundAnonPool(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1178685008) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(64);
    const _epoch = sc_0.loadUintBig(32);
    const _purchase_id = sc_0.loadUintBig(64);
    return { $$type: 'FundAnonPool' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadTupleFundAnonPool(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPool' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadGetterTupleFundAnonPool(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPool' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function storeTupleFundAnonPool(source: FundAnonPool) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.purchase_id);
    return builder.build();
}

export function dictValueParserFundAnonPool(): DictionaryValue<FundAnonPool> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFundAnonPool(src)).endCell());
        },
        parse: (src) => {
            return loadFundAnonPool(src.loadRef().beginParse());
        }
    }
}

export type FundAnonPoolAck = {
    $$type: 'FundAnonPoolAck';
    credits_k: bigint;
    epoch: bigint;
    purchase_id: bigint;
}

export function storeFundAnonPoolAck(src: FundAnonPoolAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1178684993, 32);
        b_0.storeUint(src.credits_k, 64);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.purchase_id, 64);
    };
}

export function loadFundAnonPoolAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1178684993) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(64);
    const _epoch = sc_0.loadUintBig(32);
    const _purchase_id = sc_0.loadUintBig(64);
    return { $$type: 'FundAnonPoolAck' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadTupleFundAnonPoolAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPoolAck' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadGetterTupleFundAnonPoolAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPoolAck' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function storeTupleFundAnonPoolAck(source: FundAnonPoolAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.purchase_id);
    return builder.build();
}

export function dictValueParserFundAnonPoolAck(): DictionaryValue<FundAnonPoolAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFundAnonPoolAck(src)).endCell());
        },
        parse: (src) => {
            return loadFundAnonPoolAck(src.loadRef().beginParse());
        }
    }
}

export type HubMirrorIssuerKey = {
    $$type: 'HubMirrorIssuerKey';
    slot: bigint;
    pubkey: bigint;
    active: boolean;
    version: bigint;
}

export function storeHubMirrorIssuerKey(src: HubMirrorIssuerKey) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1213352753, 32);
        b_0.storeUint(src.slot, 8);
        b_0.storeUint(src.pubkey, 256);
        b_0.storeBit(src.active);
        b_0.storeUint(src.version, 32);
    };
}

export function loadHubMirrorIssuerKey(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1213352753) { throw Error('Invalid prefix'); }
    const _slot = sc_0.loadUintBig(8);
    const _pubkey = sc_0.loadUintBig(256);
    const _active = sc_0.loadBit();
    const _version = sc_0.loadUintBig(32);
    return { $$type: 'HubMirrorIssuerKey' as const, slot: _slot, pubkey: _pubkey, active: _active, version: _version };
}

export function loadTupleHubMirrorIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'HubMirrorIssuerKey' as const, slot: _slot, pubkey: _pubkey, active: _active, version: _version };
}

export function loadGetterTupleHubMirrorIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'HubMirrorIssuerKey' as const, slot: _slot, pubkey: _pubkey, active: _active, version: _version };
}

export function storeTupleHubMirrorIssuerKey(source: HubMirrorIssuerKey) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.slot);
    builder.writeNumber(source.pubkey);
    builder.writeBoolean(source.active);
    builder.writeNumber(source.version);
    return builder.build();
}

export function dictValueParserHubMirrorIssuerKey(): DictionaryValue<HubMirrorIssuerKey> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeHubMirrorIssuerKey(src)).endCell());
        },
        parse: (src) => {
            return loadHubMirrorIssuerKey(src.loadRef().beginParse());
        }
    }
}

export type BindCreditIssuer = {
    $$type: 'BindCreditIssuer';
    credit_issuer_address: Address;
}

export function storeBindCreditIssuer(src: BindCreditIssuer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1112297028, 32);
        b_0.storeAddress(src.credit_issuer_address);
    };
}

export function loadBindCreditIssuer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1112297028) { throw Error('Invalid prefix'); }
    const _credit_issuer_address = sc_0.loadAddress();
    return { $$type: 'BindCreditIssuer' as const, credit_issuer_address: _credit_issuer_address };
}

export function loadTupleBindCreditIssuer(source: TupleReader) {
    const _credit_issuer_address = source.readAddress();
    return { $$type: 'BindCreditIssuer' as const, credit_issuer_address: _credit_issuer_address };
}

export function loadGetterTupleBindCreditIssuer(source: TupleReader) {
    const _credit_issuer_address = source.readAddress();
    return { $$type: 'BindCreditIssuer' as const, credit_issuer_address: _credit_issuer_address };
}

export function storeTupleBindCreditIssuer(source: BindCreditIssuer) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.credit_issuer_address);
    return builder.build();
}

export function dictValueParserBindCreditIssuer(): DictionaryValue<BindCreditIssuer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBindCreditIssuer(src)).endCell());
        },
        parse: (src) => {
            return loadBindCreditIssuer(src.loadRef().beginParse());
        }
    }
}

export type EvictExpiredNullifiers = {
    $$type: 'EvictExpiredNullifiers';
    max_count: bigint;
}

export function storeEvictExpiredNullifiers(src: EvictExpiredNullifiers) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1314212940, 32);
        b_0.storeUint(src.max_count, 16);
    };
}

export function loadEvictExpiredNullifiers(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1314212940) { throw Error('Invalid prefix'); }
    const _max_count = sc_0.loadUintBig(16);
    return { $$type: 'EvictExpiredNullifiers' as const, max_count: _max_count };
}

export function loadTupleEvictExpiredNullifiers(source: TupleReader) {
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictExpiredNullifiers' as const, max_count: _max_count };
}

export function loadGetterTupleEvictExpiredNullifiers(source: TupleReader) {
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictExpiredNullifiers' as const, max_count: _max_count };
}

export function storeTupleEvictExpiredNullifiers(source: EvictExpiredNullifiers) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.max_count);
    return builder.build();
}

export function dictValueParserEvictExpiredNullifiers(): DictionaryValue<EvictExpiredNullifiers> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictExpiredNullifiers(src)).endCell());
        },
        parse: (src) => {
            return loadEvictExpiredNullifiers(src.loadRef().beginParse());
        }
    }
}

export type ReclaimExpiredFunding = {
    $$type: 'ReclaimExpiredFunding';
    epoch: bigint;
}

export function storeReclaimExpiredFunding(src: ReclaimExpiredFunding) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1380270918, 32);
        b_0.storeUint(src.epoch, 32);
    };
}

export function loadReclaimExpiredFunding(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1380270918) { throw Error('Invalid prefix'); }
    const _epoch = sc_0.loadUintBig(32);
    return { $$type: 'ReclaimExpiredFunding' as const, epoch: _epoch };
}

export function loadTupleReclaimExpiredFunding(source: TupleReader) {
    const _epoch = source.readBigNumber();
    return { $$type: 'ReclaimExpiredFunding' as const, epoch: _epoch };
}

export function loadGetterTupleReclaimExpiredFunding(source: TupleReader) {
    const _epoch = source.readBigNumber();
    return { $$type: 'ReclaimExpiredFunding' as const, epoch: _epoch };
}

export function storeTupleReclaimExpiredFunding(source: ReclaimExpiredFunding) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    return builder.build();
}

export function dictValueParserReclaimExpiredFunding(): DictionaryValue<ReclaimExpiredFunding> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeReclaimExpiredFunding(src)).endCell());
        },
        parse: (src) => {
            return loadReclaimExpiredFunding(src.loadRef().beginParse());
        }
    }
}

export type IssuerSlot = {
    $$type: 'IssuerSlot';
    pubkey: bigint;
    active: boolean;
    version: bigint;
}

export function storeIssuerSlot(src: IssuerSlot) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.pubkey, 256);
        b_0.storeBit(src.active);
        b_0.storeUint(src.version, 32);
    };
}

export function loadIssuerSlot(slice: Slice) {
    const sc_0 = slice;
    const _pubkey = sc_0.loadUintBig(256);
    const _active = sc_0.loadBit();
    const _version = sc_0.loadUintBig(32);
    return { $$type: 'IssuerSlot' as const, pubkey: _pubkey, active: _active, version: _version };
}

export function loadTupleIssuerSlot(source: TupleReader) {
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'IssuerSlot' as const, pubkey: _pubkey, active: _active, version: _version };
}

export function loadGetterTupleIssuerSlot(source: TupleReader) {
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'IssuerSlot' as const, pubkey: _pubkey, active: _active, version: _version };
}

export function storeTupleIssuerSlot(source: IssuerSlot) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.pubkey);
    builder.writeBoolean(source.active);
    builder.writeNumber(source.version);
    return builder.build();
}

export function dictValueParserIssuerSlot(): DictionaryValue<IssuerSlot> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIssuerSlot(src)).endCell());
        },
        parse: (src) => {
            return loadIssuerSlot(src.loadRef().beginParse());
        }
    }
}

export type NullRec = {
    $$type: 'NullRec';
    key: bigint;
    insert_time: bigint;
}

export function storeNullRec(src: NullRec) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.key, 256);
        b_0.storeUint(src.insert_time, 32);
    };
}

export function loadNullRec(slice: Slice) {
    const sc_0 = slice;
    const _key = sc_0.loadUintBig(256);
    const _insert_time = sc_0.loadUintBig(32);
    return { $$type: 'NullRec' as const, key: _key, insert_time: _insert_time };
}

export function loadTupleNullRec(source: TupleReader) {
    const _key = source.readBigNumber();
    const _insert_time = source.readBigNumber();
    return { $$type: 'NullRec' as const, key: _key, insert_time: _insert_time };
}

export function loadGetterTupleNullRec(source: TupleReader) {
    const _key = source.readBigNumber();
    const _insert_time = source.readBigNumber();
    return { $$type: 'NullRec' as const, key: _key, insert_time: _insert_time };
}

export function storeTupleNullRec(source: NullRec) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.key);
    builder.writeNumber(source.insert_time);
    return builder.build();
}

export function dictValueParserNullRec(): DictionaryValue<NullRec> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullRec(src)).endCell());
        },
        parse: (src) => {
            return loadNullRec(src.loadRef().beginParse());
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

export type FlushFees = {
    $$type: 'FlushFees';
    amount: bigint;
}

export function storeFlushFees(src: FlushFees) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2055606321, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadFlushFees(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2055606321) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'FlushFees' as const, amount: _amount };
}

export function loadTupleFlushFees(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushFees' as const, amount: _amount };
}

export function loadGetterTupleFlushFees(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'FlushFees' as const, amount: _amount };
}

export function storeTupleFlushFees(source: FlushFees) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserFlushFees(): DictionaryValue<FlushFees> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFlushFees(src)).endCell());
        },
        parse: (src) => {
            return loadFlushFees(src.loadRef().beginParse());
        }
    }
}

export type TopUpStorageReserve = {
    $$type: 'TopUpStorageReserve';
}

export function storeTopUpStorageReserve(src: TopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1395767424, 32);
    };
}

export function loadTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1395767424) { throw Error('Invalid prefix'); }
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

export type SweepExcessReserve = {
    $$type: 'SweepExcessReserve';
    amount: bigint;
}

export function storeSweepExcessReserve(src: SweepExcessReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1398231122, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadSweepExcessReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1398231122) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'SweepExcessReserve' as const, amount: _amount };
}

export function loadTupleSweepExcessReserve(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'SweepExcessReserve' as const, amount: _amount };
}

export function loadGetterTupleSweepExcessReserve(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'SweepExcessReserve' as const, amount: _amount };
}

export function storeTupleSweepExcessReserve(source: SweepExcessReserve) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserSweepExcessReserve(): DictionaryValue<SweepExcessReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSweepExcessReserve(src)).endCell());
        },
        parse: (src) => {
            return loadSweepExcessReserve(src.loadRef().beginParse());
        }
    }
}

export type DepositProtocolFee = {
    $$type: 'DepositProtocolFee';
    amount: bigint;
}

export function storeDepositProtocolFee(src: DepositProtocolFee) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4286010889, 32);
        b_0.storeUint(src.amount, 128);
    };
}

export function loadDepositProtocolFee(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4286010889) { throw Error('Invalid prefix'); }
    const _amount = sc_0.loadUintBig(128);
    return { $$type: 'DepositProtocolFee' as const, amount: _amount };
}

export function loadTupleDepositProtocolFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'DepositProtocolFee' as const, amount: _amount };
}

export function loadGetterTupleDepositProtocolFee(source: TupleReader) {
    const _amount = source.readBigNumber();
    return { $$type: 'DepositProtocolFee' as const, amount: _amount };
}

export function storeTupleDepositProtocolFee(source: DepositProtocolFee) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.amount);
    return builder.build();
}

export function dictValueParserDepositProtocolFee(): DictionaryValue<DepositProtocolFee> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDepositProtocolFee(src)).endCell());
        },
        parse: (src) => {
            return loadDepositProtocolFee(src.loadRef().beginParse());
        }
    }
}

export type EvictExpiredRecoverySlot = {
    $$type: 'EvictExpiredRecoverySlot';
    slot_key: bigint;
}

export function storeEvictExpiredRecoverySlot(src: EvictExpiredRecoverySlot) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1380270898, 32);
        b_0.storeUint(src.slot_key, 256);
    };
}

export function loadEvictExpiredRecoverySlot(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1380270898) { throw Error('Invalid prefix'); }
    const _slot_key = sc_0.loadUintBig(256);
    return { $$type: 'EvictExpiredRecoverySlot' as const, slot_key: _slot_key };
}

export function loadTupleEvictExpiredRecoverySlot(source: TupleReader) {
    const _slot_key = source.readBigNumber();
    return { $$type: 'EvictExpiredRecoverySlot' as const, slot_key: _slot_key };
}

export function loadGetterTupleEvictExpiredRecoverySlot(source: TupleReader) {
    const _slot_key = source.readBigNumber();
    return { $$type: 'EvictExpiredRecoverySlot' as const, slot_key: _slot_key };
}

export function storeTupleEvictExpiredRecoverySlot(source: EvictExpiredRecoverySlot) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.slot_key);
    return builder.build();
}

export function dictValueParserEvictExpiredRecoverySlot(): DictionaryValue<EvictExpiredRecoverySlot> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictExpiredRecoverySlot(src)).endCell());
        },
        parse: (src) => {
            return loadEvictExpiredRecoverySlot(src.loadRef().beginParse());
        }
    }
}

export type EvictExpiredCapsules = {
    $$type: 'EvictExpiredCapsules';
    kind: bigint;
    max_count: bigint;
}

export function storeEvictExpiredCapsules(src: EvictExpiredCapsules) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1163281219, 32);
        b_0.storeUint(src.kind, 8);
        b_0.storeUint(src.max_count, 16);
    };
}

export function loadEvictExpiredCapsules(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1163281219) { throw Error('Invalid prefix'); }
    const _kind = sc_0.loadUintBig(8);
    const _max_count = sc_0.loadUintBig(16);
    return { $$type: 'EvictExpiredCapsules' as const, kind: _kind, max_count: _max_count };
}

export function loadTupleEvictExpiredCapsules(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictExpiredCapsules' as const, kind: _kind, max_count: _max_count };
}

export function loadGetterTupleEvictExpiredCapsules(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _max_count = source.readBigNumber();
    return { $$type: 'EvictExpiredCapsules' as const, kind: _kind, max_count: _max_count };
}

export function storeTupleEvictExpiredCapsules(source: EvictExpiredCapsules) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.kind);
    builder.writeNumber(source.max_count);
    return builder.build();
}

export function dictValueParserEvictExpiredCapsules(): DictionaryValue<EvictExpiredCapsules> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictExpiredCapsules(src)).endCell());
        },
        parse: (src) => {
            return loadEvictExpiredCapsules(src.loadRef().beginParse());
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

export type CapsuleHubStateView = {
    $$type: 'CapsuleHubStateView';
    sealed: boolean;
    vault_bound: boolean;
    deployment_manifest_hash: bigint;
    private_latest_id: bigint;
    public_latest_id: bigint;
    private_page_count: bigint;
    public_page_count: bigint;
    page_size: bigint;
    index_storage_years: bigint;
    index_retention_seconds: bigint;
    accrued_plato_fee_ton: bigint;
    fee_accumulator_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
    private_live_count: bigint;
    public_live_count: bigint;
    intro_latest_id: bigint;
    intro_oldest_live_id: bigint;
    intro_live_count: bigint;
    recovery_live_count: bigint;
    index_storage_reserve_ton: bigint;
    protected_reserve_ton: bigint;
    reserve_floor_ton: bigint;
    reserve_buffer_numerator: bigint;
    reserve_buffer_denominator: bigint;
}

export function storeCapsuleHubStateView(src: CapsuleHubStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeBit(src.vault_bound);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.private_latest_id, 257);
        b_0.storeInt(src.public_latest_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.private_page_count, 257);
        b_1.storeInt(src.public_page_count, 257);
        b_1.storeInt(src.page_size, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.index_storage_years, 257);
        b_2.storeInt(src.index_retention_seconds, 257);
        b_2.storeInt(src.accrued_plato_fee_ton, 257);
        const b_3 = new Builder();
        b_3.storeAddress(src.fee_accumulator_address);
        b_3.storeAddress(src.vault_address);
        b_3.storeAddress(src.genesis_controller_address);
        const b_4 = new Builder();
        b_4.storeInt(src.private_live_count, 257);
        b_4.storeInt(src.public_live_count, 257);
        b_4.storeInt(src.intro_latest_id, 257);
        const b_5 = new Builder();
        b_5.storeInt(src.intro_oldest_live_id, 257);
        b_5.storeInt(src.intro_live_count, 257);
        b_5.storeInt(src.recovery_live_count, 257);
        const b_6 = new Builder();
        b_6.storeInt(src.index_storage_reserve_ton, 257);
        b_6.storeInt(src.protected_reserve_ton, 257);
        b_6.storeInt(src.reserve_floor_ton, 257);
        const b_7 = new Builder();
        b_7.storeInt(src.reserve_buffer_numerator, 257);
        b_7.storeInt(src.reserve_buffer_denominator, 257);
        b_6.storeRef(b_7.endCell());
        b_5.storeRef(b_6.endCell());
        b_4.storeRef(b_5.endCell());
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCapsuleHubStateView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _vault_bound = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _private_latest_id = sc_0.loadIntBig(257);
    const _public_latest_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _private_page_count = sc_1.loadIntBig(257);
    const _public_page_count = sc_1.loadIntBig(257);
    const _page_size = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _index_storage_years = sc_2.loadIntBig(257);
    const _index_retention_seconds = sc_2.loadIntBig(257);
    const _accrued_plato_fee_ton = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _fee_accumulator_address = sc_3.loadAddress();
    const _vault_address = sc_3.loadAddress();
    const _genesis_controller_address = sc_3.loadAddress();
    const sc_4 = sc_3.loadRef().beginParse();
    const _private_live_count = sc_4.loadIntBig(257);
    const _public_live_count = sc_4.loadIntBig(257);
    const _intro_latest_id = sc_4.loadIntBig(257);
    const sc_5 = sc_4.loadRef().beginParse();
    const _intro_oldest_live_id = sc_5.loadIntBig(257);
    const _intro_live_count = sc_5.loadIntBig(257);
    const _recovery_live_count = sc_5.loadIntBig(257);
    const sc_6 = sc_5.loadRef().beginParse();
    const _index_storage_reserve_ton = sc_6.loadIntBig(257);
    const _protected_reserve_ton = sc_6.loadIntBig(257);
    const _reserve_floor_ton = sc_6.loadIntBig(257);
    const sc_7 = sc_6.loadRef().beginParse();
    const _reserve_buffer_numerator = sc_7.loadIntBig(257);
    const _reserve_buffer_denominator = sc_7.loadIntBig(257);
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_page_count: _private_page_count, public_page_count: _public_page_count, page_size: _page_size, index_storage_years: _index_storage_years, index_retention_seconds: _index_retention_seconds, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_live_count: _private_live_count, public_live_count: _public_live_count, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_live_count: _recovery_live_count, index_storage_reserve_ton: _index_storage_reserve_ton, protected_reserve_ton: _protected_reserve_ton, reserve_floor_ton: _reserve_floor_ton, reserve_buffer_numerator: _reserve_buffer_numerator, reserve_buffer_denominator: _reserve_buffer_denominator };
}

export function loadTupleCapsuleHubStateView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _private_latest_id = source.readBigNumber();
    const _public_latest_id = source.readBigNumber();
    const _private_page_count = source.readBigNumber();
    const _public_page_count = source.readBigNumber();
    const _page_size = source.readBigNumber();
    const _index_storage_years = source.readBigNumber();
    const _index_retention_seconds = source.readBigNumber();
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _fee_accumulator_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    source = source.readTuple();
    const _private_live_count = source.readBigNumber();
    const _public_live_count = source.readBigNumber();
    const _intro_latest_id = source.readBigNumber();
    const _intro_oldest_live_id = source.readBigNumber();
    const _intro_live_count = source.readBigNumber();
    const _recovery_live_count = source.readBigNumber();
    const _index_storage_reserve_ton = source.readBigNumber();
    const _protected_reserve_ton = source.readBigNumber();
    const _reserve_floor_ton = source.readBigNumber();
    const _reserve_buffer_numerator = source.readBigNumber();
    const _reserve_buffer_denominator = source.readBigNumber();
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_page_count: _private_page_count, public_page_count: _public_page_count, page_size: _page_size, index_storage_years: _index_storage_years, index_retention_seconds: _index_retention_seconds, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_live_count: _private_live_count, public_live_count: _public_live_count, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_live_count: _recovery_live_count, index_storage_reserve_ton: _index_storage_reserve_ton, protected_reserve_ton: _protected_reserve_ton, reserve_floor_ton: _reserve_floor_ton, reserve_buffer_numerator: _reserve_buffer_numerator, reserve_buffer_denominator: _reserve_buffer_denominator };
}

export function loadGetterTupleCapsuleHubStateView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _private_latest_id = source.readBigNumber();
    const _public_latest_id = source.readBigNumber();
    const _private_page_count = source.readBigNumber();
    const _public_page_count = source.readBigNumber();
    const _page_size = source.readBigNumber();
    const _index_storage_years = source.readBigNumber();
    const _index_retention_seconds = source.readBigNumber();
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _fee_accumulator_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _private_live_count = source.readBigNumber();
    const _public_live_count = source.readBigNumber();
    const _intro_latest_id = source.readBigNumber();
    const _intro_oldest_live_id = source.readBigNumber();
    const _intro_live_count = source.readBigNumber();
    const _recovery_live_count = source.readBigNumber();
    const _index_storage_reserve_ton = source.readBigNumber();
    const _protected_reserve_ton = source.readBigNumber();
    const _reserve_floor_ton = source.readBigNumber();
    const _reserve_buffer_numerator = source.readBigNumber();
    const _reserve_buffer_denominator = source.readBigNumber();
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_page_count: _private_page_count, public_page_count: _public_page_count, page_size: _page_size, index_storage_years: _index_storage_years, index_retention_seconds: _index_retention_seconds, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_live_count: _private_live_count, public_live_count: _public_live_count, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_live_count: _recovery_live_count, index_storage_reserve_ton: _index_storage_reserve_ton, protected_reserve_ton: _protected_reserve_ton, reserve_floor_ton: _reserve_floor_ton, reserve_buffer_numerator: _reserve_buffer_numerator, reserve_buffer_denominator: _reserve_buffer_denominator };
}

export function storeTupleCapsuleHubStateView(source: CapsuleHubStateView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.vault_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.private_latest_id);
    builder.writeNumber(source.public_latest_id);
    builder.writeNumber(source.private_page_count);
    builder.writeNumber(source.public_page_count);
    builder.writeNumber(source.page_size);
    builder.writeNumber(source.index_storage_years);
    builder.writeNumber(source.index_retention_seconds);
    builder.writeNumber(source.accrued_plato_fee_ton);
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeAddress(source.vault_address);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.private_live_count);
    builder.writeNumber(source.public_live_count);
    builder.writeNumber(source.intro_latest_id);
    builder.writeNumber(source.intro_oldest_live_id);
    builder.writeNumber(source.intro_live_count);
    builder.writeNumber(source.recovery_live_count);
    builder.writeNumber(source.index_storage_reserve_ton);
    builder.writeNumber(source.protected_reserve_ton);
    builder.writeNumber(source.reserve_floor_ton);
    builder.writeNumber(source.reserve_buffer_numerator);
    builder.writeNumber(source.reserve_buffer_denominator);
    return builder.build();
}

export function dictValueParserCapsuleHubStateView(): DictionaryValue<CapsuleHubStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsuleHubStateView(src)).endCell());
        },
        parse: (src) => {
            return loadCapsuleHubStateView(src.loadRef().beginParse());
        }
    }
}

export type CapsuleHubPageView = {
    $$type: 'CapsuleHubPageView';
    exists: boolean;
    page_id: bigint;
    first_entry_id: bigint;
    next_entry_id: bigint;
    entry_count: bigint;
    opened_at: bigint;
    updated_at: bigint;
}

export function storeCapsuleHubPageView(src: CapsuleHubPageView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.page_id, 257);
        b_0.storeInt(src.first_entry_id, 257);
        b_0.storeInt(src.next_entry_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.entry_count, 257);
        b_1.storeInt(src.opened_at, 257);
        b_1.storeInt(src.updated_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCapsuleHubPageView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _page_id = sc_0.loadIntBig(257);
    const _first_entry_id = sc_0.loadIntBig(257);
    const _next_entry_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _entry_count = sc_1.loadIntBig(257);
    const _opened_at = sc_1.loadIntBig(257);
    const _updated_at = sc_1.loadIntBig(257);
    return { $$type: 'CapsuleHubPageView' as const, exists: _exists, page_id: _page_id, first_entry_id: _first_entry_id, next_entry_id: _next_entry_id, entry_count: _entry_count, opened_at: _opened_at, updated_at: _updated_at };
}

export function loadTupleCapsuleHubPageView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _page_id = source.readBigNumber();
    const _first_entry_id = source.readBigNumber();
    const _next_entry_id = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    const _opened_at = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    return { $$type: 'CapsuleHubPageView' as const, exists: _exists, page_id: _page_id, first_entry_id: _first_entry_id, next_entry_id: _next_entry_id, entry_count: _entry_count, opened_at: _opened_at, updated_at: _updated_at };
}

export function loadGetterTupleCapsuleHubPageView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _page_id = source.readBigNumber();
    const _first_entry_id = source.readBigNumber();
    const _next_entry_id = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    const _opened_at = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    return { $$type: 'CapsuleHubPageView' as const, exists: _exists, page_id: _page_id, first_entry_id: _first_entry_id, next_entry_id: _next_entry_id, entry_count: _entry_count, opened_at: _opened_at, updated_at: _updated_at };
}

export function storeTupleCapsuleHubPageView(source: CapsuleHubPageView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.page_id);
    builder.writeNumber(source.first_entry_id);
    builder.writeNumber(source.next_entry_id);
    builder.writeNumber(source.entry_count);
    builder.writeNumber(source.opened_at);
    builder.writeNumber(source.updated_at);
    return builder.build();
}

export function dictValueParserCapsuleHubPageView(): DictionaryValue<CapsuleHubPageView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsuleHubPageView(src)).endCell());
        },
        parse: (src) => {
            return loadCapsuleHubPageView(src.loadRef().beginParse());
        }
    }
}

export type PrivateCapsuleEntry = {
    $$type: 'PrivateCapsuleEntry';
    publish_id: bigint;
    created_at: bigint;
    body_hash: bigint;
    bucket_prev_link: bigint;
    header_0: Cell;
    header_1: Cell;
}

export function storePrivateCapsuleEntry(src: PrivateCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.created_at, 64);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.bucket_prev_link, 64);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
    };
}

export function loadPrivateCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _publish_id = sc_0.loadUintBig(256);
    const _created_at = sc_0.loadUintBig(64);
    const _body_hash = sc_0.loadUintBig(256);
    const _bucket_prev_link = sc_0.loadUintBig(64);
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    return { $$type: 'PrivateCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, bucket_prev_link: _bucket_prev_link, header_0: _header_0, header_1: _header_1 };
}

export function loadTuplePrivateCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _bucket_prev_link = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'PrivateCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, bucket_prev_link: _bucket_prev_link, header_0: _header_0, header_1: _header_1 };
}

export function loadGetterTuplePrivateCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _bucket_prev_link = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'PrivateCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, bucket_prev_link: _bucket_prev_link, header_0: _header_0, header_1: _header_1 };
}

export function storeTuplePrivateCapsuleEntry(source: PrivateCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.bucket_prev_link);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    return builder.build();
}

export function dictValueParserPrivateCapsuleEntry(): DictionaryValue<PrivateCapsuleEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrivateCapsuleEntry(src)).endCell());
        },
        parse: (src) => {
            return loadPrivateCapsuleEntry(src.loadRef().beginParse());
        }
    }
}

export type PublicCapsuleEntry = {
    $$type: 'PublicCapsuleEntry';
    publish_id: bigint;
    created_at: bigint;
    channel_id: bigint;
    body_hash: bigint;
    parent_link: bigint;
    prev_link: bigint;
    profile_prev_link: bigint;
    header: Cell;
}

export function storePublicCapsuleEntry(src: PublicCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.created_at, 64);
        b_0.storeUint(src.channel_id, 256);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.parent_link, 64);
        b_0.storeUint(src.prev_link, 64);
        const b_1 = new Builder();
        b_1.storeUint(src.profile_prev_link, 64);
        b_1.storeRef(src.header);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublicCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _publish_id = sc_0.loadUintBig(256);
    const _created_at = sc_0.loadUintBig(64);
    const _channel_id = sc_0.loadUintBig(256);
    const _body_hash = sc_0.loadUintBig(256);
    const _parent_link = sc_0.loadUintBig(64);
    const _prev_link = sc_0.loadUintBig(64);
    const sc_1 = sc_0.loadRef().beginParse();
    const _profile_prev_link = sc_1.loadUintBig(64);
    const _header = sc_1.loadRef();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, channel_id: _channel_id, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function loadTuplePublicCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _channel_id = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, channel_id: _channel_id, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function loadGetterTuplePublicCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _channel_id = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, channel_id: _channel_id, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function storeTuplePublicCapsuleEntry(source: PublicCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.channel_id);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.parent_link);
    builder.writeNumber(source.prev_link);
    builder.writeNumber(source.profile_prev_link);
    builder.writeCell(source.header);
    return builder.build();
}

export function dictValueParserPublicCapsuleEntry(): DictionaryValue<PublicCapsuleEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicCapsuleEntry(src)).endCell());
        },
        parse: (src) => {
            return loadPublicCapsuleEntry(src.loadRef().beginParse());
        }
    }
}

export type PrivateCapsuleEntryView = {
    $$type: 'PrivateCapsuleEntryView';
    exists: boolean;
    entry_id: bigint;
    bucket_prev_link: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    author_wallet: Address;
    page_id: bigint;
    page_offset: bigint;
    created_at: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
}

export function storePrivateCapsuleEntryView(src: PrivateCapsuleEntryView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.entry_id, 257);
        b_0.storeInt(src.bucket_prev_link, 257);
        b_0.storeInt(src.entry_uid, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.publish_id, 257);
        b_1.storeAddress(src.author_wallet);
        b_1.storeInt(src.page_id, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.page_offset, 257);
        b_2.storeInt(src.created_at, 257);
        b_2.storeInt(src.header_0_hash, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.header_1_hash, 257);
        b_3.storeInt(src.body_hash, 257);
        b_3.storeRef(src.header_0);
        b_3.storeRef(src.header_1);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPrivateCapsuleEntryView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _entry_id = sc_0.loadIntBig(257);
    const _bucket_prev_link = sc_0.loadIntBig(257);
    const _entry_uid = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _publish_id = sc_1.loadIntBig(257);
    const _author_wallet = sc_1.loadAddress();
    const _page_id = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _page_offset = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const _header_0_hash = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _header_1_hash = sc_3.loadIntBig(257);
    const _body_hash = sc_3.loadIntBig(257);
    const _header_0 = sc_3.loadRef();
    const _header_1 = sc_3.loadRef();
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, bucket_prev_link: _bucket_prev_link, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadTuplePrivateCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _bucket_prev_link = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _page_id = source.readBigNumber();
    const _page_offset = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, bucket_prev_link: _bucket_prev_link, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadGetterTuplePrivateCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _bucket_prev_link = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _page_id = source.readBigNumber();
    const _page_offset = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, bucket_prev_link: _bucket_prev_link, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function storeTuplePrivateCapsuleEntryView(source: PrivateCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.bucket_prev_link);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.page_id);
    builder.writeNumber(source.page_offset);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    return builder.build();
}

export function dictValueParserPrivateCapsuleEntryView(): DictionaryValue<PrivateCapsuleEntryView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrivateCapsuleEntryView(src)).endCell());
        },
        parse: (src) => {
            return loadPrivateCapsuleEntryView(src.loadRef().beginParse());
        }
    }
}

export type PrivateCapsuleKeyIndex = {
    $$type: 'PrivateCapsuleKeyIndex';
    latest_entry_link: bigint;
    entry_count: bigint;
}

export function storePrivateCapsuleKeyIndex(src: PrivateCapsuleKeyIndex) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.latest_entry_link, 64);
        b_0.storeUint(src.entry_count, 64);
    };
}

export function loadPrivateCapsuleKeyIndex(slice: Slice) {
    const sc_0 = slice;
    const _latest_entry_link = sc_0.loadUintBig(64);
    const _entry_count = sc_0.loadUintBig(64);
    return { $$type: 'PrivateCapsuleKeyIndex' as const, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadTuplePrivateCapsuleKeyIndex(source: TupleReader) {
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PrivateCapsuleKeyIndex' as const, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadGetterTuplePrivateCapsuleKeyIndex(source: TupleReader) {
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PrivateCapsuleKeyIndex' as const, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function storeTuplePrivateCapsuleKeyIndex(source: PrivateCapsuleKeyIndex) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.latest_entry_link);
    builder.writeNumber(source.entry_count);
    return builder.build();
}

export function dictValueParserPrivateCapsuleKeyIndex(): DictionaryValue<PrivateCapsuleKeyIndex> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrivateCapsuleKeyIndex(src)).endCell());
        },
        parse: (src) => {
            return loadPrivateCapsuleKeyIndex(src.loadRef().beginParse());
        }
    }
}

export type PrivateBucketIndexView = {
    $$type: 'PrivateBucketIndexView';
    exists: boolean;
    bucket_key: bigint;
    latest_entry_id: bigint;
    latest_entry_link: bigint;
    entry_count: bigint;
}

export function storePrivateBucketIndexView(src: PrivateBucketIndexView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.bucket_key, 257);
        b_0.storeInt(src.latest_entry_id, 257);
        b_0.storeInt(src.latest_entry_link, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.entry_count, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPrivateBucketIndexView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _bucket_key = sc_0.loadIntBig(257);
    const _latest_entry_id = sc_0.loadIntBig(257);
    const _latest_entry_link = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _entry_count = sc_1.loadIntBig(257);
    return { $$type: 'PrivateBucketIndexView' as const, exists: _exists, bucket_key: _bucket_key, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadTuplePrivateBucketIndexView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _bucket_key = source.readBigNumber();
    const _latest_entry_id = source.readBigNumber();
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PrivateBucketIndexView' as const, exists: _exists, bucket_key: _bucket_key, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadGetterTuplePrivateBucketIndexView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _bucket_key = source.readBigNumber();
    const _latest_entry_id = source.readBigNumber();
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PrivateBucketIndexView' as const, exists: _exists, bucket_key: _bucket_key, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function storeTuplePrivateBucketIndexView(source: PrivateBucketIndexView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.bucket_key);
    builder.writeNumber(source.latest_entry_id);
    builder.writeNumber(source.latest_entry_link);
    builder.writeNumber(source.entry_count);
    return builder.build();
}

export function dictValueParserPrivateBucketIndexView(): DictionaryValue<PrivateBucketIndexView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrivateBucketIndexView(src)).endCell());
        },
        parse: (src) => {
            return loadPrivateBucketIndexView(src.loadRef().beginParse());
        }
    }
}

export type IntroCapsuleEntry = {
    $$type: 'IntroCapsuleEntry';
    publish_id: bigint;
    created_at: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
}

export function storeIntroCapsuleEntry(src: IntroCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.created_at, 64);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
    };
}

export function loadIntroCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _publish_id = sc_0.loadUintBig(256);
    const _created_at = sc_0.loadUintBig(64);
    const _body_hash = sc_0.loadUintBig(256);
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    return { $$type: 'IntroCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadTupleIntroCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'IntroCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadGetterTupleIntroCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'IntroCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function storeTupleIntroCapsuleEntry(source: IntroCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    return builder.build();
}

export function dictValueParserIntroCapsuleEntry(): DictionaryValue<IntroCapsuleEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroCapsuleEntry(src)).endCell());
        },
        parse: (src) => {
            return loadIntroCapsuleEntry(src.loadRef().beginParse());
        }
    }
}

export type IntroCapsuleEntryView = {
    $$type: 'IntroCapsuleEntryView';
    exists: boolean;
    entry_id: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    created_at: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
}

export function storeIntroCapsuleEntryView(src: IntroCapsuleEntryView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.entry_id, 257);
        b_0.storeInt(src.entry_uid, 257);
        b_0.storeInt(src.publish_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.created_at, 257);
        b_1.storeInt(src.header_0_hash, 257);
        b_1.storeInt(src.header_1_hash, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.body_hash, 257);
        b_2.storeRef(src.header_0);
        b_2.storeRef(src.header_1);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadIntroCapsuleEntryView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _entry_id = sc_0.loadIntBig(257);
    const _entry_uid = sc_0.loadIntBig(257);
    const _publish_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _created_at = sc_1.loadIntBig(257);
    const _header_0_hash = sc_1.loadIntBig(257);
    const _header_1_hash = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _body_hash = sc_2.loadIntBig(257);
    const _header_0 = sc_2.loadRef();
    const _header_1 = sc_2.loadRef();
    return { $$type: 'IntroCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadTupleIntroCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'IntroCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadGetterTupleIntroCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'IntroCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function storeTupleIntroCapsuleEntryView(source: IntroCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    return builder.build();
}

export function dictValueParserIntroCapsuleEntryView(): DictionaryValue<IntroCapsuleEntryView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroCapsuleEntryView(src)).endCell());
        },
        parse: (src) => {
            return loadIntroCapsuleEntryView(src.loadRef().beginParse());
        }
    }
}

export type IntroScanRecord = {
    $$type: 'IntroScanRecord';
    entry_id: bigint;
    created_at: bigint;
    view_tag: bigint;
    ephemeral_r: bigint;
}

export function storeIntroScanRecord(src: IntroScanRecord) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.entry_id, 257);
        b_0.storeInt(src.created_at, 257);
        b_0.storeInt(src.view_tag, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.ephemeral_r, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadIntroScanRecord(slice: Slice) {
    const sc_0 = slice;
    const _entry_id = sc_0.loadIntBig(257);
    const _created_at = sc_0.loadIntBig(257);
    const _view_tag = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _ephemeral_r = sc_1.loadIntBig(257);
    return { $$type: 'IntroScanRecord' as const, entry_id: _entry_id, created_at: _created_at, view_tag: _view_tag, ephemeral_r: _ephemeral_r };
}

export function loadTupleIntroScanRecord(source: TupleReader) {
    const _entry_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _ephemeral_r = source.readBigNumber();
    return { $$type: 'IntroScanRecord' as const, entry_id: _entry_id, created_at: _created_at, view_tag: _view_tag, ephemeral_r: _ephemeral_r };
}

export function loadGetterTupleIntroScanRecord(source: TupleReader) {
    const _entry_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _view_tag = source.readBigNumber();
    const _ephemeral_r = source.readBigNumber();
    return { $$type: 'IntroScanRecord' as const, entry_id: _entry_id, created_at: _created_at, view_tag: _view_tag, ephemeral_r: _ephemeral_r };
}

export function storeTupleIntroScanRecord(source: IntroScanRecord) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.view_tag);
    builder.writeNumber(source.ephemeral_r);
    return builder.build();
}

export function dictValueParserIntroScanRecord(): DictionaryValue<IntroScanRecord> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroScanRecord(src)).endCell());
        },
        parse: (src) => {
            return loadIntroScanRecord(src.loadRef().beginParse());
        }
    }
}

export type IntroScanBoundsView = {
    $$type: 'IntroScanBoundsView';
    oldest_live_id: bigint;
    latest_id: bigint;
    live_count: bigint;
}

export function storeIntroScanBoundsView(src: IntroScanBoundsView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.oldest_live_id, 257);
        b_0.storeInt(src.latest_id, 257);
        b_0.storeInt(src.live_count, 257);
    };
}

export function loadIntroScanBoundsView(slice: Slice) {
    const sc_0 = slice;
    const _oldest_live_id = sc_0.loadIntBig(257);
    const _latest_id = sc_0.loadIntBig(257);
    const _live_count = sc_0.loadIntBig(257);
    return { $$type: 'IntroScanBoundsView' as const, oldest_live_id: _oldest_live_id, latest_id: _latest_id, live_count: _live_count };
}

export function loadTupleIntroScanBoundsView(source: TupleReader) {
    const _oldest_live_id = source.readBigNumber();
    const _latest_id = source.readBigNumber();
    const _live_count = source.readBigNumber();
    return { $$type: 'IntroScanBoundsView' as const, oldest_live_id: _oldest_live_id, latest_id: _latest_id, live_count: _live_count };
}

export function loadGetterTupleIntroScanBoundsView(source: TupleReader) {
    const _oldest_live_id = source.readBigNumber();
    const _latest_id = source.readBigNumber();
    const _live_count = source.readBigNumber();
    return { $$type: 'IntroScanBoundsView' as const, oldest_live_id: _oldest_live_id, latest_id: _latest_id, live_count: _live_count };
}

export function storeTupleIntroScanBoundsView(source: IntroScanBoundsView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.oldest_live_id);
    builder.writeNumber(source.latest_id);
    builder.writeNumber(source.live_count);
    return builder.build();
}

export function dictValueParserIntroScanBoundsView(): DictionaryValue<IntroScanBoundsView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroScanBoundsView(src)).endCell());
        },
        parse: (src) => {
            return loadIntroScanBoundsView(src.loadRef().beginParse());
        }
    }
}

export type IntroScanPageView = {
    $$type: 'IntroScanPageView';
    from_entry_id: bigint;
    count: bigint;
    records: Dictionary<number, IntroScanRecord>;
}

export function storeIntroScanPageView(src: IntroScanPageView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.from_entry_id, 257);
        b_0.storeInt(src.count, 257);
        b_0.storeDict(src.records, Dictionary.Keys.Uint(16), dictValueParserIntroScanRecord());
    };
}

export function loadIntroScanPageView(slice: Slice) {
    const sc_0 = slice;
    const _from_entry_id = sc_0.loadIntBig(257);
    const _count = sc_0.loadIntBig(257);
    const _records = Dictionary.load(Dictionary.Keys.Uint(16), dictValueParserIntroScanRecord(), sc_0);
    return { $$type: 'IntroScanPageView' as const, from_entry_id: _from_entry_id, count: _count, records: _records };
}

export function loadTupleIntroScanPageView(source: TupleReader) {
    const _from_entry_id = source.readBigNumber();
    const _count = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.Uint(16), dictValueParserIntroScanRecord(), source.readCellOpt());
    return { $$type: 'IntroScanPageView' as const, from_entry_id: _from_entry_id, count: _count, records: _records };
}

export function loadGetterTupleIntroScanPageView(source: TupleReader) {
    const _from_entry_id = source.readBigNumber();
    const _count = source.readBigNumber();
    const _records = Dictionary.loadDirect(Dictionary.Keys.Uint(16), dictValueParserIntroScanRecord(), source.readCellOpt());
    return { $$type: 'IntroScanPageView' as const, from_entry_id: _from_entry_id, count: _count, records: _records };
}

export function storeTupleIntroScanPageView(source: IntroScanPageView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.from_entry_id);
    builder.writeNumber(source.count);
    builder.writeCell(source.records.size > 0 ? beginCell().storeDictDirect(source.records, Dictionary.Keys.Uint(16), dictValueParserIntroScanRecord()).endCell() : null);
    return builder.build();
}

export function dictValueParserIntroScanPageView(): DictionaryValue<IntroScanPageView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIntroScanPageView(src)).endCell());
        },
        parse: (src) => {
            return loadIntroScanPageView(src.loadRef().beginParse());
        }
    }
}

export type RecoveryCapsuleRecord = {
    $$type: 'RecoveryCapsuleRecord';
    publish_id: bigint;
    updated_at: bigint;
    body_hash: bigint;
    owner_pubkey: bigint;
    seq: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

export function storeRecoveryCapsuleRecord(src: RecoveryCapsuleRecord) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.updated_at, 64);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.owner_pubkey, 256);
        b_0.storeUint(src.seq, 64);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
        b_0.storeRef(src.body);
    };
}

export function loadRecoveryCapsuleRecord(slice: Slice) {
    const sc_0 = slice;
    const _publish_id = sc_0.loadUintBig(256);
    const _updated_at = sc_0.loadUintBig(64);
    const _body_hash = sc_0.loadUintBig(256);
    const _owner_pubkey = sc_0.loadUintBig(256);
    const _seq = sc_0.loadUintBig(64);
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'RecoveryCapsuleRecord' as const, publish_id: _publish_id, updated_at: _updated_at, body_hash: _body_hash, owner_pubkey: _owner_pubkey, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadTupleRecoveryCapsuleRecord(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleRecord' as const, publish_id: _publish_id, updated_at: _updated_at, body_hash: _body_hash, owner_pubkey: _owner_pubkey, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadGetterTupleRecoveryCapsuleRecord(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleRecord' as const, publish_id: _publish_id, updated_at: _updated_at, body_hash: _body_hash, owner_pubkey: _owner_pubkey, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body };
}

export function storeTupleRecoveryCapsuleRecord(source: RecoveryCapsuleRecord) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.updated_at);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.owner_pubkey);
    builder.writeNumber(source.seq);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserRecoveryCapsuleRecord(): DictionaryValue<RecoveryCapsuleRecord> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecoveryCapsuleRecord(src)).endCell());
        },
        parse: (src) => {
            return loadRecoveryCapsuleRecord(src.loadRef().beginParse());
        }
    }
}

export type RecoveryCapsuleView = {
    $$type: 'RecoveryCapsuleView';
    exists: boolean;
    slot_key: bigint;
    updated_at: bigint;
    body_hash: bigint;
    owner_pubkey: bigint;
    seq: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
}

export function storeRecoveryCapsuleView(src: RecoveryCapsuleView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.slot_key, 257);
        b_0.storeInt(src.updated_at, 257);
        b_0.storeInt(src.body_hash, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.owner_pubkey, 257);
        b_1.storeInt(src.seq, 257);
        b_1.storeRef(src.header_0);
        b_1.storeRef(src.header_1);
        b_1.storeRef(src.body);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecoveryCapsuleView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _slot_key = sc_0.loadIntBig(257);
    const _updated_at = sc_0.loadIntBig(257);
    const _body_hash = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _owner_pubkey = sc_1.loadIntBig(257);
    const _seq = sc_1.loadIntBig(257);
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    return { $$type: 'RecoveryCapsuleView' as const, exists: _exists, slot_key: _slot_key, updated_at: _updated_at, body_hash: _body_hash, owner_pubkey: _owner_pubkey, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadTupleRecoveryCapsuleView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _slot_key = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleView' as const, exists: _exists, slot_key: _slot_key, updated_at: _updated_at, body_hash: _body_hash, owner_pubkey: _owner_pubkey, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadGetterTupleRecoveryCapsuleView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _slot_key = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleView' as const, exists: _exists, slot_key: _slot_key, updated_at: _updated_at, body_hash: _body_hash, owner_pubkey: _owner_pubkey, seq: _seq, header_0: _header_0, header_1: _header_1, body: _body };
}

export function storeTupleRecoveryCapsuleView(source: RecoveryCapsuleView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.slot_key);
    builder.writeNumber(source.updated_at);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.owner_pubkey);
    builder.writeNumber(source.seq);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    return builder.build();
}

export function dictValueParserRecoveryCapsuleView(): DictionaryValue<RecoveryCapsuleView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecoveryCapsuleView(src)).endCell());
        },
        parse: (src) => {
            return loadRecoveryCapsuleView(src.loadRef().beginParse());
        }
    }
}

export type PublicCapsuleEntryView = {
    $$type: 'PublicCapsuleEntryView';
    exists: boolean;
    entry_id: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    channel_id: bigint;
    page_id: bigint;
    page_offset: bigint;
    created_at: bigint;
    header_hash: bigint;
    body_hash: bigint;
    parent_link: bigint;
    prev_link: bigint;
    profile_prev_link: bigint;
    header: Cell;
}

export function storePublicCapsuleEntryView(src: PublicCapsuleEntryView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.entry_id, 257);
        b_0.storeInt(src.entry_uid, 257);
        b_0.storeInt(src.publish_id, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.channel_id, 257);
        b_1.storeInt(src.page_id, 257);
        b_1.storeInt(src.page_offset, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.created_at, 257);
        b_2.storeInt(src.header_hash, 257);
        b_2.storeInt(src.body_hash, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.parent_link, 257);
        b_3.storeInt(src.prev_link, 257);
        b_3.storeInt(src.profile_prev_link, 257);
        b_3.storeRef(src.header);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublicCapsuleEntryView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _entry_id = sc_0.loadIntBig(257);
    const _entry_uid = sc_0.loadIntBig(257);
    const _publish_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _channel_id = sc_1.loadIntBig(257);
    const _page_id = sc_1.loadIntBig(257);
    const _page_offset = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _created_at = sc_2.loadIntBig(257);
    const _header_hash = sc_2.loadIntBig(257);
    const _body_hash = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _parent_link = sc_3.loadIntBig(257);
    const _prev_link = sc_3.loadIntBig(257);
    const _profile_prev_link = sc_3.loadIntBig(257);
    const _header = sc_3.loadRef();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, channel_id: _channel_id, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function loadTuplePublicCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _channel_id = source.readBigNumber();
    const _page_id = source.readBigNumber();
    const _page_offset = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, channel_id: _channel_id, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function loadGetterTuplePublicCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _channel_id = source.readBigNumber();
    const _page_id = source.readBigNumber();
    const _page_offset = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, channel_id: _channel_id, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function storeTuplePublicCapsuleEntryView(source: PublicCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.channel_id);
    builder.writeNumber(source.page_id);
    builder.writeNumber(source.page_offset);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.parent_link);
    builder.writeNumber(source.prev_link);
    builder.writeNumber(source.profile_prev_link);
    builder.writeCell(source.header);
    return builder.build();
}

export function dictValueParserPublicCapsuleEntryView(): DictionaryValue<PublicCapsuleEntryView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicCapsuleEntryView(src)).endCell());
        },
        parse: (src) => {
            return loadPublicCapsuleEntryView(src.loadRef().beginParse());
        }
    }
}

export type PublicCapsuleKeyIndex = {
    $$type: 'PublicCapsuleKeyIndex';
    latest_entry_link: bigint;
    entry_count: bigint;
}

export function storePublicCapsuleKeyIndex(src: PublicCapsuleKeyIndex) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.latest_entry_link, 64);
        b_0.storeUint(src.entry_count, 64);
    };
}

export function loadPublicCapsuleKeyIndex(slice: Slice) {
    const sc_0 = slice;
    const _latest_entry_link = sc_0.loadUintBig(64);
    const _entry_count = sc_0.loadUintBig(64);
    return { $$type: 'PublicCapsuleKeyIndex' as const, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadTuplePublicCapsuleKeyIndex(source: TupleReader) {
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PublicCapsuleKeyIndex' as const, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadGetterTuplePublicCapsuleKeyIndex(source: TupleReader) {
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PublicCapsuleKeyIndex' as const, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function storeTuplePublicCapsuleKeyIndex(source: PublicCapsuleKeyIndex) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.latest_entry_link);
    builder.writeNumber(source.entry_count);
    return builder.build();
}

export function dictValueParserPublicCapsuleKeyIndex(): DictionaryValue<PublicCapsuleKeyIndex> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicCapsuleKeyIndex(src)).endCell());
        },
        parse: (src) => {
            return loadPublicCapsuleKeyIndex(src.loadRef().beginParse());
        }
    }
}

export type PublicCapsuleKeyIndexView = {
    $$type: 'PublicCapsuleKeyIndexView';
    exists: boolean;
    key_id: bigint;
    latest_entry_id: bigint;
    latest_entry_link: bigint;
    entry_count: bigint;
}

export function storePublicCapsuleKeyIndexView(src: PublicCapsuleKeyIndexView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.key_id, 257);
        b_0.storeInt(src.latest_entry_id, 257);
        b_0.storeInt(src.latest_entry_link, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.entry_count, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublicCapsuleKeyIndexView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _key_id = sc_0.loadIntBig(257);
    const _latest_entry_id = sc_0.loadIntBig(257);
    const _latest_entry_link = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _entry_count = sc_1.loadIntBig(257);
    return { $$type: 'PublicCapsuleKeyIndexView' as const, exists: _exists, key_id: _key_id, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadTuplePublicCapsuleKeyIndexView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _latest_entry_id = source.readBigNumber();
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PublicCapsuleKeyIndexView' as const, exists: _exists, key_id: _key_id, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadGetterTuplePublicCapsuleKeyIndexView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _latest_entry_id = source.readBigNumber();
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PublicCapsuleKeyIndexView' as const, exists: _exists, key_id: _key_id, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function storeTuplePublicCapsuleKeyIndexView(source: PublicCapsuleKeyIndexView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.latest_entry_id);
    builder.writeNumber(source.latest_entry_link);
    builder.writeNumber(source.entry_count);
    return builder.build();
}

export function dictValueParserPublicCapsuleKeyIndexView(): DictionaryValue<PublicCapsuleKeyIndexView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublicCapsuleKeyIndexView(src)).endCell());
        },
        parse: (src) => {
            return loadPublicCapsuleKeyIndexView(src.loadRef().beginParse());
        }
    }
}

export type AnonPoolStateView = {
    $$type: 'AnonPoolStateView';
    credit_issuer_bound: boolean;
    credit_issuer_address: Address;
    nullifier_live_count: bigint;
    nullifier_latest: bigint;
    nullifier_oldest_live: bigint;
    anon_pool_outstanding: bigint;
    prepaid_unit: bigint;
    max_batch_parts_anon: bigint;
}

export function storeAnonPoolStateView(src: AnonPoolStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.credit_issuer_bound);
        b_0.storeAddress(src.credit_issuer_address);
        b_0.storeInt(src.nullifier_live_count, 257);
        b_0.storeInt(src.nullifier_latest, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.nullifier_oldest_live, 257);
        b_1.storeInt(src.anon_pool_outstanding, 257);
        b_1.storeInt(src.prepaid_unit, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.max_batch_parts_anon, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadAnonPoolStateView(slice: Slice) {
    const sc_0 = slice;
    const _credit_issuer_bound = sc_0.loadBit();
    const _credit_issuer_address = sc_0.loadAddress();
    const _nullifier_live_count = sc_0.loadIntBig(257);
    const _nullifier_latest = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _nullifier_oldest_live = sc_1.loadIntBig(257);
    const _anon_pool_outstanding = sc_1.loadIntBig(257);
    const _prepaid_unit = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _max_batch_parts_anon = sc_2.loadIntBig(257);
    return { $$type: 'AnonPoolStateView' as const, credit_issuer_bound: _credit_issuer_bound, credit_issuer_address: _credit_issuer_address, nullifier_live_count: _nullifier_live_count, nullifier_latest: _nullifier_latest, nullifier_oldest_live: _nullifier_oldest_live, anon_pool_outstanding: _anon_pool_outstanding, prepaid_unit: _prepaid_unit, max_batch_parts_anon: _max_batch_parts_anon };
}

export function loadTupleAnonPoolStateView(source: TupleReader) {
    const _credit_issuer_bound = source.readBoolean();
    const _credit_issuer_address = source.readAddress();
    const _nullifier_live_count = source.readBigNumber();
    const _nullifier_latest = source.readBigNumber();
    const _nullifier_oldest_live = source.readBigNumber();
    const _anon_pool_outstanding = source.readBigNumber();
    const _prepaid_unit = source.readBigNumber();
    const _max_batch_parts_anon = source.readBigNumber();
    return { $$type: 'AnonPoolStateView' as const, credit_issuer_bound: _credit_issuer_bound, credit_issuer_address: _credit_issuer_address, nullifier_live_count: _nullifier_live_count, nullifier_latest: _nullifier_latest, nullifier_oldest_live: _nullifier_oldest_live, anon_pool_outstanding: _anon_pool_outstanding, prepaid_unit: _prepaid_unit, max_batch_parts_anon: _max_batch_parts_anon };
}

export function loadGetterTupleAnonPoolStateView(source: TupleReader) {
    const _credit_issuer_bound = source.readBoolean();
    const _credit_issuer_address = source.readAddress();
    const _nullifier_live_count = source.readBigNumber();
    const _nullifier_latest = source.readBigNumber();
    const _nullifier_oldest_live = source.readBigNumber();
    const _anon_pool_outstanding = source.readBigNumber();
    const _prepaid_unit = source.readBigNumber();
    const _max_batch_parts_anon = source.readBigNumber();
    return { $$type: 'AnonPoolStateView' as const, credit_issuer_bound: _credit_issuer_bound, credit_issuer_address: _credit_issuer_address, nullifier_live_count: _nullifier_live_count, nullifier_latest: _nullifier_latest, nullifier_oldest_live: _nullifier_oldest_live, anon_pool_outstanding: _anon_pool_outstanding, prepaid_unit: _prepaid_unit, max_batch_parts_anon: _max_batch_parts_anon };
}

export function storeTupleAnonPoolStateView(source: AnonPoolStateView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.credit_issuer_bound);
    builder.writeAddress(source.credit_issuer_address);
    builder.writeNumber(source.nullifier_live_count);
    builder.writeNumber(source.nullifier_latest);
    builder.writeNumber(source.nullifier_oldest_live);
    builder.writeNumber(source.anon_pool_outstanding);
    builder.writeNumber(source.prepaid_unit);
    builder.writeNumber(source.max_batch_parts_anon);
    return builder.build();
}

export function dictValueParserAnonPoolStateView(): DictionaryValue<AnonPoolStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAnonPoolStateView(src)).endCell());
        },
        parse: (src) => {
            return loadAnonPoolStateView(src.loadRef().beginParse());
        }
    }
}

export type IssuerSlotView = {
    $$type: 'IssuerSlotView';
    exists: boolean;
    slot: bigint;
    pubkey: bigint;
    active: boolean;
    version: bigint;
}

export function storeIssuerSlotView(src: IssuerSlotView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.slot, 257);
        b_0.storeInt(src.pubkey, 257);
        b_0.storeBit(src.active);
        b_0.storeInt(src.version, 257);
    };
}

export function loadIssuerSlotView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _slot = sc_0.loadIntBig(257);
    const _pubkey = sc_0.loadIntBig(257);
    const _active = sc_0.loadBit();
    const _version = sc_0.loadIntBig(257);
    return { $$type: 'IssuerSlotView' as const, exists: _exists, slot: _slot, pubkey: _pubkey, active: _active, version: _version };
}

export function loadTupleIssuerSlotView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _slot = source.readBigNumber();
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'IssuerSlotView' as const, exists: _exists, slot: _slot, pubkey: _pubkey, active: _active, version: _version };
}

export function loadGetterTupleIssuerSlotView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _slot = source.readBigNumber();
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'IssuerSlotView' as const, exists: _exists, slot: _slot, pubkey: _pubkey, active: _active, version: _version };
}

export function storeTupleIssuerSlotView(source: IssuerSlotView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.slot);
    builder.writeNumber(source.pubkey);
    builder.writeBoolean(source.active);
    builder.writeNumber(source.version);
    return builder.build();
}

export function dictValueParserIssuerSlotView(): DictionaryValue<IssuerSlotView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIssuerSlotView(src)).endCell());
        },
        parse: (src) => {
            return loadIssuerSlotView(src.loadRef().beginParse());
        }
    }
}

export type CapsuleHub$Data = {
    $$type: 'CapsuleHub$Data';
    fee_accumulator_address: Address;
    vault_address: Address;
    vault_bound: boolean;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_controller_address: Address;
    private_latest_id: bigint;
    public_latest_id: bigint;
    private_live_count: bigint;
    public_live_count: bigint;
    accrued_plato_fee_ton: bigint;
    private_entries: Dictionary<bigint, PrivateCapsuleEntry>;
    public_entries: Dictionary<bigint, PublicCapsuleEntry>;
    private_bucket_index: Dictionary<bigint, PrivateCapsuleKeyIndex>;
    public_author_index: Dictionary<bigint, PublicCapsuleKeyIndex>;
    public_parent_index: Dictionary<bigint, PublicCapsuleKeyIndex>;
    public_oldest_live_id: bigint;
    private_oldest_live_id: bigint;
    public_profile_index: Dictionary<bigint, bigint>;
    public_profile_head: bigint;
    intro_entries: Dictionary<bigint, IntroCapsuleEntry>;
    intro_latest_id: bigint;
    intro_oldest_live_id: bigint;
    intro_live_count: bigint;
    recovery_slots: Dictionary<bigint, RecoveryCapsuleRecord>;
    recovery_live_count: bigint;
    credit_issuer_address: Address;
    credit_issuer_bound: boolean;
    issuer_mirror: Dictionary<bigint, IssuerSlot>;
    spent_nullifiers: Dictionary<bigint, bigint>;
    nullifier_seq: Dictionary<bigint, NullRec>;
    nullifier_latest: bigint;
    nullifier_oldest_live: bigint;
    nullifier_live_count: bigint;
    funded_by_epoch: Dictionary<bigint, bigint>;
    spent_by_epoch: Dictionary<bigint, bigint>;
    anon_pool_outstanding: bigint;
}

export function storeCapsuleHub$Data(src: CapsuleHub$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.fee_accumulator_address);
        b_0.storeAddress(src.vault_address);
        b_0.storeBit(src.vault_bound);
        b_0.storeBit(src.sealed);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        const b_1 = new Builder();
        b_1.storeAddress(src.genesis_controller_address);
        b_1.storeUint(src.private_latest_id, 64);
        b_1.storeUint(src.public_latest_id, 64);
        b_1.storeUint(src.private_live_count, 64);
        b_1.storeUint(src.public_live_count, 64);
        b_1.storeUint(src.accrued_plato_fee_ton, 128);
        b_1.storeDict(src.private_entries, Dictionary.Keys.BigUint(64), dictValueParserPrivateCapsuleEntry());
        b_1.storeDict(src.public_entries, Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleEntry());
        b_1.storeDict(src.private_bucket_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex());
        const b_2 = new Builder();
        b_2.storeDict(src.public_author_index, Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex());
        b_2.storeDict(src.public_parent_index, Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex());
        b_2.storeUint(src.public_oldest_live_id, 64);
        b_2.storeUint(src.private_oldest_live_id, 64);
        b_2.storeDict(src.public_profile_index, Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64));
        b_2.storeUint(src.public_profile_head, 64);
        const b_3 = new Builder();
        b_3.storeDict(src.intro_entries, Dictionary.Keys.BigUint(64), dictValueParserIntroCapsuleEntry());
        b_3.storeUint(src.intro_latest_id, 64);
        b_3.storeUint(src.intro_oldest_live_id, 64);
        b_3.storeUint(src.intro_live_count, 64);
        b_3.storeDict(src.recovery_slots, Dictionary.Keys.BigUint(256), dictValueParserRecoveryCapsuleRecord());
        b_3.storeUint(src.recovery_live_count, 64);
        b_3.storeAddress(src.credit_issuer_address);
        b_3.storeBit(src.credit_issuer_bound);
        b_3.storeDict(src.issuer_mirror, Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot());
        const b_4 = new Builder();
        b_4.storeDict(src.spent_nullifiers, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_4.storeDict(src.nullifier_seq, Dictionary.Keys.BigInt(257), dictValueParserNullRec());
        b_4.storeUint(src.nullifier_latest, 64);
        b_4.storeUint(src.nullifier_oldest_live, 64);
        b_4.storeUint(src.nullifier_live_count, 32);
        b_4.storeDict(src.funded_by_epoch, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_4.storeDict(src.spent_by_epoch, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_4.storeUint(src.anon_pool_outstanding, 64);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCapsuleHub$Data(slice: Slice) {
    const sc_0 = slice;
    const _fee_accumulator_address = sc_0.loadAddress();
    const _vault_address = sc_0.loadAddress();
    const _vault_bound = sc_0.loadBit();
    const _sealed = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _genesis_controller_address = sc_1.loadAddress();
    const _private_latest_id = sc_1.loadUintBig(64);
    const _public_latest_id = sc_1.loadUintBig(64);
    const _private_live_count = sc_1.loadUintBig(64);
    const _public_live_count = sc_1.loadUintBig(64);
    const _accrued_plato_fee_ton = sc_1.loadUintBig(128);
    const _private_entries = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserPrivateCapsuleEntry(), sc_1);
    const _public_entries = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleEntry(), sc_1);
    const _private_bucket_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), sc_1);
    const sc_2 = sc_1.loadRef().beginParse();
    const _public_author_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex(), sc_2);
    const _public_parent_index = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex(), sc_2);
    const _public_oldest_live_id = sc_2.loadUintBig(64);
    const _private_oldest_live_id = sc_2.loadUintBig(64);
    const _public_profile_index = Dictionary.load(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64), sc_2);
    const _public_profile_head = sc_2.loadUintBig(64);
    const sc_3 = sc_2.loadRef().beginParse();
    const _intro_entries = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserIntroCapsuleEntry(), sc_3);
    const _intro_latest_id = sc_3.loadUintBig(64);
    const _intro_oldest_live_id = sc_3.loadUintBig(64);
    const _intro_live_count = sc_3.loadUintBig(64);
    const _recovery_slots = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserRecoveryCapsuleRecord(), sc_3);
    const _recovery_live_count = sc_3.loadUintBig(64);
    const _credit_issuer_address = sc_3.loadAddress();
    const _credit_issuer_bound = sc_3.loadBit();
    const _issuer_mirror = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot(), sc_3);
    const sc_4 = sc_3.loadRef().beginParse();
    const _spent_nullifiers = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_4);
    const _nullifier_seq = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserNullRec(), sc_4);
    const _nullifier_latest = sc_4.loadUintBig(64);
    const _nullifier_oldest_live = sc_4.loadUintBig(64);
    const _nullifier_live_count = sc_4.loadUintBig(32);
    const _funded_by_epoch = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_4);
    const _spent_by_epoch = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_4);
    const _anon_pool_outstanding = sc_4.loadUintBig(64);
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_bucket_index: _private_bucket_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head, intro_entries: _intro_entries, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_slots: _recovery_slots, recovery_live_count: _recovery_live_count, credit_issuer_address: _credit_issuer_address, credit_issuer_bound: _credit_issuer_bound, issuer_mirror: _issuer_mirror, spent_nullifiers: _spent_nullifiers, nullifier_seq: _nullifier_seq, nullifier_latest: _nullifier_latest, nullifier_oldest_live: _nullifier_oldest_live, nullifier_live_count: _nullifier_live_count, funded_by_epoch: _funded_by_epoch, spent_by_epoch: _spent_by_epoch, anon_pool_outstanding: _anon_pool_outstanding };
}

export function loadTupleCapsuleHub$Data(source: TupleReader) {
    const _fee_accumulator_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _vault_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _private_latest_id = source.readBigNumber();
    const _public_latest_id = source.readBigNumber();
    const _private_live_count = source.readBigNumber();
    const _public_live_count = source.readBigNumber();
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _private_entries = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPrivateCapsuleEntry(), source.readCellOpt());
    const _public_entries = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleEntry(), source.readCellOpt());
    const _private_bucket_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    source = source.readTuple();
    const _public_author_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_parent_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_oldest_live_id = source.readBigNumber();
    const _private_oldest_live_id = source.readBigNumber();
    const _public_profile_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64), source.readCellOpt());
    const _public_profile_head = source.readBigNumber();
    const _intro_entries = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserIntroCapsuleEntry(), source.readCellOpt());
    const _intro_latest_id = source.readBigNumber();
    const _intro_oldest_live_id = source.readBigNumber();
    const _intro_live_count = source.readBigNumber();
    const _recovery_slots = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserRecoveryCapsuleRecord(), source.readCellOpt());
    const _recovery_live_count = source.readBigNumber();
    const _credit_issuer_address = source.readAddress();
    const _credit_issuer_bound = source.readBoolean();
    source = source.readTuple();
    const _issuer_mirror = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot(), source.readCellOpt());
    const _spent_nullifiers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _nullifier_seq = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserNullRec(), source.readCellOpt());
    const _nullifier_latest = source.readBigNumber();
    const _nullifier_oldest_live = source.readBigNumber();
    const _nullifier_live_count = source.readBigNumber();
    const _funded_by_epoch = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _spent_by_epoch = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _anon_pool_outstanding = source.readBigNumber();
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_bucket_index: _private_bucket_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head, intro_entries: _intro_entries, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_slots: _recovery_slots, recovery_live_count: _recovery_live_count, credit_issuer_address: _credit_issuer_address, credit_issuer_bound: _credit_issuer_bound, issuer_mirror: _issuer_mirror, spent_nullifiers: _spent_nullifiers, nullifier_seq: _nullifier_seq, nullifier_latest: _nullifier_latest, nullifier_oldest_live: _nullifier_oldest_live, nullifier_live_count: _nullifier_live_count, funded_by_epoch: _funded_by_epoch, spent_by_epoch: _spent_by_epoch, anon_pool_outstanding: _anon_pool_outstanding };
}

export function loadGetterTupleCapsuleHub$Data(source: TupleReader) {
    const _fee_accumulator_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _vault_bound = source.readBoolean();
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _private_latest_id = source.readBigNumber();
    const _public_latest_id = source.readBigNumber();
    const _private_live_count = source.readBigNumber();
    const _public_live_count = source.readBigNumber();
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _private_entries = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPrivateCapsuleEntry(), source.readCellOpt());
    const _public_entries = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleEntry(), source.readCellOpt());
    const _private_bucket_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    const _public_author_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_parent_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_oldest_live_id = source.readBigNumber();
    const _private_oldest_live_id = source.readBigNumber();
    const _public_profile_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64), source.readCellOpt());
    const _public_profile_head = source.readBigNumber();
    const _intro_entries = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserIntroCapsuleEntry(), source.readCellOpt());
    const _intro_latest_id = source.readBigNumber();
    const _intro_oldest_live_id = source.readBigNumber();
    const _intro_live_count = source.readBigNumber();
    const _recovery_slots = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserRecoveryCapsuleRecord(), source.readCellOpt());
    const _recovery_live_count = source.readBigNumber();
    const _credit_issuer_address = source.readAddress();
    const _credit_issuer_bound = source.readBoolean();
    const _issuer_mirror = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot(), source.readCellOpt());
    const _spent_nullifiers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _nullifier_seq = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserNullRec(), source.readCellOpt());
    const _nullifier_latest = source.readBigNumber();
    const _nullifier_oldest_live = source.readBigNumber();
    const _nullifier_live_count = source.readBigNumber();
    const _funded_by_epoch = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _spent_by_epoch = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _anon_pool_outstanding = source.readBigNumber();
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_bucket_index: _private_bucket_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head, intro_entries: _intro_entries, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_slots: _recovery_slots, recovery_live_count: _recovery_live_count, credit_issuer_address: _credit_issuer_address, credit_issuer_bound: _credit_issuer_bound, issuer_mirror: _issuer_mirror, spent_nullifiers: _spent_nullifiers, nullifier_seq: _nullifier_seq, nullifier_latest: _nullifier_latest, nullifier_oldest_live: _nullifier_oldest_live, nullifier_live_count: _nullifier_live_count, funded_by_epoch: _funded_by_epoch, spent_by_epoch: _spent_by_epoch, anon_pool_outstanding: _anon_pool_outstanding };
}

export function storeTupleCapsuleHub$Data(source: CapsuleHub$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeAddress(source.vault_address);
    builder.writeBoolean(source.vault_bound);
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.private_latest_id);
    builder.writeNumber(source.public_latest_id);
    builder.writeNumber(source.private_live_count);
    builder.writeNumber(source.public_live_count);
    builder.writeNumber(source.accrued_plato_fee_ton);
    builder.writeCell(source.private_entries.size > 0 ? beginCell().storeDictDirect(source.private_entries, Dictionary.Keys.BigUint(64), dictValueParserPrivateCapsuleEntry()).endCell() : null);
    builder.writeCell(source.public_entries.size > 0 ? beginCell().storeDictDirect(source.public_entries, Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleEntry()).endCell() : null);
    builder.writeCell(source.private_bucket_index.size > 0 ? beginCell().storeDictDirect(source.private_bucket_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex()).endCell() : null);
    builder.writeCell(source.public_author_index.size > 0 ? beginCell().storeDictDirect(source.public_author_index, Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex()).endCell() : null);
    builder.writeCell(source.public_parent_index.size > 0 ? beginCell().storeDictDirect(source.public_parent_index, Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex()).endCell() : null);
    builder.writeNumber(source.public_oldest_live_id);
    builder.writeNumber(source.private_oldest_live_id);
    builder.writeCell(source.public_profile_index.size > 0 ? beginCell().storeDictDirect(source.public_profile_index, Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64)).endCell() : null);
    builder.writeNumber(source.public_profile_head);
    builder.writeCell(source.intro_entries.size > 0 ? beginCell().storeDictDirect(source.intro_entries, Dictionary.Keys.BigUint(64), dictValueParserIntroCapsuleEntry()).endCell() : null);
    builder.writeNumber(source.intro_latest_id);
    builder.writeNumber(source.intro_oldest_live_id);
    builder.writeNumber(source.intro_live_count);
    builder.writeCell(source.recovery_slots.size > 0 ? beginCell().storeDictDirect(source.recovery_slots, Dictionary.Keys.BigUint(256), dictValueParserRecoveryCapsuleRecord()).endCell() : null);
    builder.writeNumber(source.recovery_live_count);
    builder.writeAddress(source.credit_issuer_address);
    builder.writeBoolean(source.credit_issuer_bound);
    builder.writeCell(source.issuer_mirror.size > 0 ? beginCell().storeDictDirect(source.issuer_mirror, Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot()).endCell() : null);
    builder.writeCell(source.spent_nullifiers.size > 0 ? beginCell().storeDictDirect(source.spent_nullifiers, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.nullifier_seq.size > 0 ? beginCell().storeDictDirect(source.nullifier_seq, Dictionary.Keys.BigInt(257), dictValueParserNullRec()).endCell() : null);
    builder.writeNumber(source.nullifier_latest);
    builder.writeNumber(source.nullifier_oldest_live);
    builder.writeNumber(source.nullifier_live_count);
    builder.writeCell(source.funded_by_epoch.size > 0 ? beginCell().storeDictDirect(source.funded_by_epoch, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeCell(source.spent_by_epoch.size > 0 ? beginCell().storeDictDirect(source.spent_by_epoch, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeNumber(source.anon_pool_outstanding);
    return builder.build();
}

export function dictValueParserCapsuleHub$Data(): DictionaryValue<CapsuleHub$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCapsuleHub$Data(src)).endCell());
        },
        parse: (src) => {
            return loadCapsuleHub$Data(src.loadRef().beginParse());
        }
    }
}

 type CapsuleHub_init_args = {
    $$type: 'CapsuleHub_init_args';
    fee_accumulator_address: Address;
    vault_address: Address;
    vault_bound: boolean;
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_controller_address: Address;
}

function initCapsuleHub_init_args(src: CapsuleHub_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.fee_accumulator_address);
        b_0.storeAddress(src.vault_address);
        b_0.storeBit(src.vault_bound);
        b_0.storeBit(src.sealed);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        const b_1 = new Builder();
        b_1.storeAddress(src.genesis_controller_address);
        b_0.storeRef(b_1.endCell());
    };
}

async function CapsuleHub_init(fee_accumulator_address: Address, vault_address: Address, vault_bound: boolean, sealed: boolean, deployment_manifest_hash: bigint, genesis_controller_address: Address) {
    const __code = Cell.fromHex('b5ee9c72420201c100010000a77400000114ff00f4a413f4bcf2c80b00010201620002011404f0d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e9efa40fa40d200d200810101d700d401d0fa4030161514433006d15504db3ce30d11268ea111248020d7217021d749c21f9430d31f01de8210ff775609bae3025f0f5f0f5f08e0705625d74920c21f97311125d31f1126de2101bc01be0003000601f8d37f0131112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111111011111110000402fa0f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3c813393f8425626c705f2f48133945626c200f2f401111a011125a0112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b11181119111800eb0005019c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130010f044a821090e2e0cbbae3022182103a12d1adbae302218210424c4e44bae30221821048524b31ba0007000b000e001403fa5b1124d3fffa4030011125011126db3cdb3c81326e5623b3f2f481326f5626c300f2f48132705621c000917f9556215627bae2f2f4112311241123112211241122112111241121112011241120111f1124111f111e1124111e111d1124111d111c1124111c111b1124111b111a1124111a11191124111911181124111800100017000802fa1117112411171116112411161115112411151114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a091124091124080706554081327111255627db3c57215722572201112301111ef2f4813272f828562501c705b3f2f41120112311200012000901fe1120112211207f1122111e1121111e111e1120111e111c111f111c111b111e111b111a111d111a1119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a10691058000a017e10471036453304c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011201fc5b1124d3ff30112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111111011111110000c03fa0f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3cdb3c57218132785625c300f2f4561f8132791126ba01112501f2f481327a5621f2f481327b28f2f41122112311221121112211211120112111207f1121111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b00100017000d0190111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e010f01fc5b1124fa4030112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111111011111110000f03fc0f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3cdb3c112311241123112211241122112111241121112011241120111f1124111f111e1124111e111d1124111d111c1124111c111b1124111b111a1124111a11191124111911181124111811171124111711161124111611151124111500100017001100108132655622b3f2f402fc1114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a091124091124080706554081350c11255626db3c3a3a0111240108f2f481350df828562501c705b3f2f4112111231121112011221120111f1121111f111e1120111e111d111f111d00120013000afa4430c00001d0111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a7f0910685515010f043ce30221821046414e50bae3022182104e554c4cbae30221821052454346ba0015001c0022002501fc5b1124d307d3ffd200d31f30112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a111911251119111811261118111711251117111611261116111511251115111411261114111311251113111211261112001604fa1111112511111110112611100f11250f0e11260e0d11250d0c11260c0b11250b0a11260a0911250908112608071125070611260605112505041126040311250302112602011127011128db3c81350e5626c110f2f428810101562759f40d6fa192306ddf206e92306d9dd0d3ffd200d31f55206c136f03e2206eb3e30f001700180019001a0016813282f8425621c705f2f4001c81352f016f236c21562a01bcf2f400023001fa0111260111278101011129c855205023cbffca00cb1fc910370211270201112401206e953059f45a30944133f415e2112011241120111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a1116111511191115111411181114001b01e81113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a1059081037465312c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011201f85b1124d33fd31fd33f30112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119111811251118111711251117111611251116111511251115111411251114111311251113111211251112001d02fe1111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250908112508071125070611250605112505041125040311250302112502011126011127db3c81352bf8422cc705f2f481352a5626c200f2f4f82382015180a90481353121a6fc562901be9701a604562801bb923170e2f2f400eb001e01fa56258208a7c538a881352cf8416f24135f032282081e8480a0bef2f423112311261123112211251122112111241121112011261120111f1125111f111e1124111e111d1126111d111c1125111c111b1124111b111a1126111a111911251119111811241118111711261117111611251116111511241115111411261114001f02e21113112511131112112411121111112611111110112511100f11240f0e11260e0d11250d0c11240c0b11260b0a11250a091124090811260807112507061124060511260504112504031124030211260201112501112481010111275629db3c33025628a056270311260302112802562a590150002001f6216e955b59f45a3098c801cf004133f442e211235626a0112476fb02f8427011277011298306112bc85520821046414e415004cb1f12cb3fcb1fcb3fc9140311270302112802011129014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00111e1124111e111d1123111d111c1122111c111b1121111b002101de111a1120111a1119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a103948160550334717010f01fc5b1124d30f30112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111111011111110002302f40f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3c5625c2209480205726de112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111800eb002402e01117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3cc87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed5400aa0112043ce30221821050415542bae30221821050415243bae3022182107a861031ba0026002b00ad00d801fc5b1124d31f30112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111111011111110002703f80f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3cf82382015180a90481353001a6fc562701b9f2f45625db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a00eb0150002802fe1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655405626db3c01112601a120c2009701112501a111249130e28101016d21103456280151002901fc59216e955b59f45a3098c801cf004133f442e28101016d54120202112802216e955b59f45a3098c801cf004133f442e2112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a1118111711191117111611181116002a01f81115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354403c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011201f45b1124d33f31d39f31d3ffd307d307d4d4f40430112411281124112311271123112211261122112111251121112011281120111f1127111f111e1126111e111d1125111d111c1128111c111b1127111b111a1126111a111911251119111811281118111711271117111611261116111511251115111411281114002c02fe1113112711131112112611121111112511111110112811100f11270f0e11260e0d11250d0c11280c0b11270b0a11260a091125090811280807112707061126060511250504112804031127030211260201112901112adb3c8134bd5626c300f2f48134be5629c001917f945629c002e2917f945629c003e2f2f48134bf562800eb002d02fcc200945628c1059170e2f2f4813532561d561da02fa05629a08110ccbbf2f4813533245629a08106a4bbf2f4f842f82382015180a904562ac001562bc003562cc00256232293305614962193305622dee28134c021562fa0843fbbf2f421925730e30d8134c5f8416f24135f03562e82080f4240a88209c9c380a0bef2f4002e003001608134c356316eb3f2f48134c41131d0810098db3c828873656e742076696120506c6174686f2e417070ba01113101f2f4002f0006d70130048a562b562f708136b070f8368209c9c380a02194225632b98ae85730375f03572d572d8134daf8416f24135f035003be12f2f48e8d5729111e5627a0111e5627db3ce30e1129003100ee00a500a601f85631a55230ba563524a01124113011241123112f11231122112e11221121112d11211120112c1120111f112b111f111e112a111e111d1129111d111c1128111c111b1127111b111a1126111a1119112511191118113011181117112f11171116112e11161115112d11151114112c11141113112b11131112112a1112003202fe1111112911111110112811100f11270f0e11260e0d11250d0c11300c0b112f0b0a112e0a09112d0908112c0807112b0706112a060511290504112804031127030211260201112501113056315629db3c112ad0725627923073df81352922d749810268ba9522d74a58ba923170e2f2f4d3ffd307d3ffd31fd33fd401d001d4003300340024c882104550493101cb1f12cbffcb0fc9f90001f601d0563d562e9132953001d43001e21127112c11271126112b11261125112a11251124112911241123112811231122112c11221121112b11211120112a1120111f1129111f111e1128111e111d112c111d111c112b111c111b112a111b111a1129111a1119112811191118112c11181117112b11171116112a1116003504fc1115112911151114112811141113112c11131112112b11121111112a11111110112911100f11280f0e112c0e0d112b0d0c112a0c0b11290b0a11280a09112c0908112b0807112a07061129060511280504112c0403112b03562a0302112a02562902562e0201112e015639db3c56371130d05633e30f56255625562556250036003d0056009f01ec81352021a6fc5250be9601a6045240bb923170e2f2f41126112a11261125112911251124112811241123112711231122112a1122112111291121112011281120111f1127111f111e112a111e111d1129111d111c1128111c111b1127111b111a112a111a111911291119111811281118111711271117003702fe1116112a11161115112911151114112811141113112711131112112a11121111112911111110112811100f11270f0e112a0e0d11290d0c11280c0b11270b0a112a0a09112909081128080711270706112a0605112905041128040311270302112a0201112701112a8135211128db3c5628ba01112601f2f481010128021127003800390028c882104253493101cb1f13cbffcb1fcb3fc9f90001f459f40d6fa192306ddf206e92306d9dd0d3ffd200d31f55206c136f03e2813522216eb395216f2330319170e2f2f481352427112311251123112211241122112111251121112011241120111f1125111f111e1124111e111d1125111d111c1124111c111b1125111b111a1124111a111911251119111811241118003a02fa1117112511171116112411161115112511151114112411141113112511131112112411121111112511111110112411100f11250f0e11240e0d11250d0c11240c0b11250b0a11240a091125090811240807112507061124060511250504112404031125030211240201112501112781010111275629db3c562803112a03013e003b01f4021129024133f40c6fa19401d70030925b6de26e01112501f2f481352311236f235b0211270201112801f91001112101f2f4111e1124111e111d1123111d111c1122111c111b1121111b111a1120111a1119111f11191118111e11181117111d11171116111c11161115111b11151114111a1114111311191113003c007c1112111811121111111711111110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a103948165073151401fa73562c923074df8134c622d749810310ba9522d74a58ba923170e2f2f4d307d307d3ffd3ffd3ffd4d4d411339257329a57371131d43011361131e21123112b11231122112a1122112111291121112011281120111f1127111f111e1126111e111d1125111d111c1124111c111b112b111b111a112a111a111911291119003e02fe1118112811181117112711171116112611161115112511151114112411141113112b11131112112a11121111112911111110112811100f11270f0e11260e0d11250d0c11240c0b112b0b0a112a0a09112909081128080711270706112606051125050411240403112b0302112a020111290111288134c7112856275627db3c00b1003f01fe01112901f2f48134c85625c30094562cc3009170e294562bc3009170e2f2f4112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114004002fc1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10895507112771810140708134c9562d04562c44348134cadb3c112311241123112211241122112111241121112011241120111f1124111f111e1124111e111d1124111d111c1124111c111b1124111b111a1124111a00ca004102fa1119112411191118112411181117112411171116112411161115112411151114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a09112409112408070655408134cf1125562adb3c5642ba01112601f2f411231124112311221123112200b6004201fc112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089004302fc5507718100f0708134cb562c04563044348134ccdb3c562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562411241149112411231148112311221147112211211146112111201145112000ca004401f8111f1144111f111e1143111e111d1142111d111c1141111c111b1140111b111a113f111a1119113e11191118113d11181117113c11171116113b11161115113a11151114113911141113113811131112113711121111113611111110113511100f11340f0e11330e0d11320d0c11310c0b11300b0a112f0a09112e09004502f808112d0807112c0706112b0605112a05041129040311280302112702011126011125564b564bdb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a11191125111911181125111811171125111700bf004602fa1116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540564c564cdb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e00bc004702fe111d1125111d111c1125111c111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540564d564ddb3c571000be004801f45f0f57105f0f6c51112711281127112611271126112511261125112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115004902f41114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103403113403562d55208134cd8134cedb3c112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d00ca004a02f8111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e813525562e0256410211335629562e562edb3c0201112e01112bf91001112e01f2f4112111251121006a004b01f8112011241120111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c553b03112c03004c03fc0211270201112a01112bdb3c5636db3c56255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556251124114a1124112311491123112211481122112111471121112011461120111f1145111f008b0103004d01fc111e1144111e111d1143111d111c1142111c111b1141111b111a1140111a1119113f11191118113e11181117113d11171116113c11161115113b11151114113a11141113113911131112113811121111113711111110113611100f11350f0e11340e0d11330d0c11320c0b11310b0a11300a09112f0908112e0807112d07004e03fe06112c0605112b0504112a0403112903021128020111270111265650db3c57105f0f57105f0f6c5101db3c112511261125112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911180137004f005000a4561983072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc903111b031201111b01206e953059f45b30944133f417e2111802e61117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130563702563102112901562cdb3c8040f823051131050403112b030211280201112c01112dc801a1005101f655505056cbff13cb3fcbffcb3fccccc9031117030211270201113301206e953059f45b30944133f417e21117a45615112011241120111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a1119111d111901111c011117111b11171116111a1116111811191118111411181114005202f81113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a1059104810371026041125040311310302112a0211260172db3c571b01112601111aa08202981070f83681465070f836a001112801a0112311261123112211251122112111241121005300540014c002958208989680e07001fc112011231120111f1122111f111e1121111e111d1120111d111c111f111c111b111e111b111a111d111a111c1127111c1118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a005501201069105810471036102511274443db3c009e02145632e30f1126112811260057007001fa73562c923074df8134e422d749810310ba9522d74a58ba923170e2f2f4d307d307d3ffd3ffd3ffd4d4d411339257329a57371131d43011361131e21123112b11231122112a1122112111291121112011281120111f1127111f111e1126111e111d1125111d111c1124111c111b112b111b111a112a111a111911291119005802fe1118112811181117112711171116112611161115112511151114112411141113112b11131112112a11121111112911111110112811100f11270f0e11260e0d11250d0c11240c0b112b0b0a112a0a09112909081128080711270706112606051125050411240403112b0302112a020111290111288134e5112856275627db3c00b1005901fe01112901f2f48134e65625c30094562cc3009170e294562bc3009170e2f2f4112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114005a02fc1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10895507112771810150708134e7562d04562c44348134e8db3c112311241123112211241122112111241121112011241120111f1124111f111e1124111e111d1124111d111c1124111c111b1124111b111a1124111a00ca005b02fa1119112411191118112411181117112411171116112411161115112411151114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a09112409112408070655408134ed1125562adb3c5642ba01112601f2f411231124112311221123112200b6005c01fc112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089005d02fc5507718100f0708134e9562c04563044348134eadb3c562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562411241149112411231148112311221147112211211146112111201145112000ca005e01f8111f1144111f111e1143111e111d1142111d111c1141111c111b1140111b111a113f111a1119113e11191118113d11181117113c11171116113b11161115113a11151114113911141113113811131112113711121111113611111110113511100f11340f0e11330e0d11320d0c11310c0b11300b0a112f0a09112e09005f02f408112d0807112c0706112b0605112a05041129040311280302112702011126011125564bdb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a1119112511191118112511181117112511170064006002f61116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540564cdb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e006100620108db3caa02006502fe111d1125111d111c1125111c111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540564ddb3c57105f0f006300670106db3ca500640110db3ca67e807fa904006501f0112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119111811251118111711251117111611251116111511251115111411251114111311251113111211251112111111251111006602fa1110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655408109541126db3c01112601a0112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111900c3015201fc57105f0f6c51112711281127112611271126112511261125112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114006802f41113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103403113403562d55208134eb8134ecdb3c112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c00ca006902f8111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e813525562e0256410211335629562e562edb3c0201112e01112bf91001112e01f2f4112111251121112011241120006a006b005ac882104246433101cb1f15cb0713cb07cbffcbffcbffc9f900c882104253503101cb1f13cbffcb07cbffc9f90001fc111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c553b03112c030211270201112a01006c02f8112bdb3c112411261124112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a1118111711191117111611181116111511171115111411161114111311151113111211141112111111131111008b006d02f61110111211100f11110f0e11100e551d563602563059562bdb3c8040f823041130040302112a0201112b01112cc855405045cbff12cb3fcbffccccc9103f0211270201113301206e953059f45b30944133f417e209a48201d4c070f83681465070f836a001112801a0112011261120111f1125111f111e1124111e014a006e01fc111d1123111d111c1122111c111b1121111b111a1120111a1119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e0d11130d091112090b11110b0a11100a0f11270f108e107d106c105b104a10394870006f011810350411300411295023db3c009e01f672562c923073df8134d022d749810250ba9522d74a58ba923170e2f2f4d307d307d33fd3ffd3ffd4d411329257319a57361130d43011351130e28134d1258100feb0c000f2f42471b0c0011123112b11231122112a1122112111291121112011281120111f1127111f111e1126111e111d1125111d111c1124111c007101f8111b112b111b111a112a111a1119112911191118112811181117112711171116112611161115112511151114112411141113112b11131112112a11121111112911111110112811100f11270f0e11260e0d11250d0c11240c0b112b0b0a112a0a09112909081128080711270706112606051125050411240403112b03007202f802112a020111290111288134d211285627db3c01112901f2f48134d3562cc30094562bc3009170e2f2f48134d95629b3917f945625c000e2f2f48134d85625c000917f955625563ebbe2f2f4112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c0085007302f8111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e11278134d48134d5562b02562e02db3c11241125112411231124112311221123112211211122112111201121112000740077010c8a80297fdb38007502f423f9005003baf2f4205627562756275627562756275627562756275627562756275627562756275627562756275627562756275627562756275627562756275627562756275627562756275627562756275627ed41ed43ed44ed45ed47955b1125f2f0ed67ed65ed64ed63ed6180267fed118aed41edf101f2ff007600cd00a80171f94102c1025230f2f420c2005230f2f420810240bb5230f2f4a93802c0005220f2f4c101f2f411241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e002f8111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e11318134d68134d7562c02562902db3c11241125112400780087010c8a802a7fdb38007902f424f9005004baf2f4215628562856285628562856285628562856285628562856285628562856285628562856285628562856285628562856285628562856285628562856285628562856285628562856285628ed41ed43ed44ed45ed47955b1125f2f0ed67ed65ed64ed63ed6180267fed118aed41edf101f2ff007a00cd01fc112411271124112311261123112211251122112111271121112011261120111f1125111f111e1127111e111d1126111d111c1125111c111b1127111b111a1126111a111911251119111811271118111711261117111611251116111511271115111411261114111311251113111211271112111111261111111011251110007b02fc0f11270f0e11260e0d11250d0c11270c0b11260b0a11250a09112709081126080711250706112706051126050411250403112703021126020111250111275627db3c01112701f941112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c0082007c01f8111b1125111b111a1126111a1119112511191118112611181117112511171116112611161115112511151114112611141113112511131112112611121111112511111110112611100f11250f0e11260e0d11250d0c11260c0b11250b0a11260a09112509081126080711250706112606051125050411260403112503007d02f6021126020111250111285629db3c01112701bb562701f2f45624c200562701f2f4112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611150082007e02f61114111511141113111411131112111311121111111211111110111111100f11100f550e11255628db3c562601bb562701f2f41125a93802c000562601f2f4112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a007f00800108db3caa02008302f61119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c1127db3c01112601bb01112601f2f4112311241123112211231122112111221121112011211120111f1120111f111e111f111e008100860106db3ca500820110db3ca67e807fa904008301f0112311251123112211241122112111251121112011241120111f1125111f111e1124111e111d1125111d111c1124111c111b1125111b111a1124111a111911251119111811241118111711251117111611241116111511251115111411241114111311251113111211241112111111251111111011241110008402f60f11250f0e11240e0d11250d0c11240c0b11250b0a11240a091125090811240807112507061124060511250504112404031125030211240201112501112481329611265625db3c01112701f2f41124aa09112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d008500c60104db3c00c500b4111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e01fc112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e008802f4813525562e0256410211335629562e562edb3c01112e562bf91001112f01f2f4112211251122112111241121112011231120111f1122111f111e1121111e111d1120111d111c111f111c111b111e111b111a111d111a1119111c11191118111b11181117111a11171116111911161115111811151114111711140089008a005ac882104246433101cb1f15cb0713cb07cb3fcbffcbffc9f900c882104253503101cb1f13cbffcb07cbffc9f90002f81113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b02112d0201112b01112cdb3c112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119008b009001f0112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119111811251118111711251117111611251116111511251115111411251114111311251113111211251112111111251111008c02f61110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655405625db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a1119112511191118112511180150008d02f01117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655405626db3c81352d21a4011128bb01112701f2f48101011126a45626103403112703021128020151008e01f6216e955b59f45a3098c801cf004133f442e21124a5112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a1118111711191117111611181116111511171115111411161114111311151113111211141112008f005a1111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544301203fa1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e1127db3c563701563151101129562adb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d009101230092001ec882104250433101cb1fcbffc9f90004fc111c1125111c111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655405637db3c70562ee30f8040f823010300930097009b01f8572d56255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556251124114a1124112311491123112211481122112111471121112011461120111f1145111f111e1144111e111d1143111d009401fc111c1142111c111b1141111b111a1140111a1119113f11191118113e11181117113d11171116113c11161115113b11151114113a11141113113911131112113811121111113711111110113611100f11350f0e11340e0d11330d0c11320c0b11310b0a11300a09112f0908112e0807112d0706112c0605112b0504112a040095023e03112903021128020111270111265652db3c57105f0f57105f0f6c5101db3c01b8009600a4561780402359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2804002a413c85902cb3fcb3fc9031119031201111901206e953059f45b30944133f417e2111601fc112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a111911251119111811261118111711251117111611261116111511251115111411261114111311251113111211261112111111251111111011261110009802fc0f11250f0e11260e0d11250d0c11260c0b11250b0a11260a091125090811260807112507061126060511250504112604031125030211260201112501112656285626db3c112e8e2c572611118307562856268040216e955b59f45b3098c801cf014133f443e21110112511101110112411101111925725e21125112c11250099009a00a4561883072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc903111a031201111a01206e953059f45b30944133f417e2111701f8112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f00fd01f807113307060511290504112a0403112f0301112e01112dc855705078cbff15cb3f13cbffcbffcb3fcb3f01c8cb3f12cccdc9031114030211270201113301206e953059f45b30944133f417e21114a411138208989680a08202bf2070f83681465070f836a001112801a0111d1126111d111c1125111c111b1124111b009c01fc111a1123111a1119112211191118112111181117112011171116111f11161115111e11151113111d1113111c1127111c1112111b11121114111a11141110111911100f11180f0e11170e0d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e104d103c4ba01089071130070611290610251023009d0116112702db3c112611281126009e0012c812cbffcbffc9f90001fc5625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556251125114a1125112411491124112311481123112211471122112111461121112011451120111f1144111f111e1143111e111d1142111d111c1141111c00a001f8111b1140111b111a113f111a1119113e11191118113d11181117113c11171116113b11161115113a11151114113911141113113811131112113711121111113611111110113511100f11340f0e11330e0d11320d0c11310c0b11300b0a112f0a09112e0908112d0807112c0706112b0605112a05041129040311280300a102f802112702011126011154db3c57105f0f57105f0f6c51112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114013e00a202f61113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001112f01db3c1126a41124112e11241123112d11231122112c11221121112b11211120112a1120111f1129111f111e1128111e111d1127111d111c1126111c111b1125111b00a300a40088810101f8235312104c59216e955b59f45a3098c801cf004133f442e2810101f8231ac85902cbffcb1fc948905270206e953059f45a30944133f415e205a403a41056030500fa111a1124111a1119112311191118112211181117112111171116112011161115111f11151114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a11140a09111309081112080711110706111006105f104e103d4cb0108a105910481037405613023611298e8b111d5627a0111d5627db3c8e890f5627a00f5627db3ce2010000fa02fc8efb562620c204923074de112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112df00a700a801bc1111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001112901db3c112811241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e000fa01f85626a604112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111100a902f41110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001112901db3c7076fb02112870112a70112883061128c855308210874e57715005cb1f13cbffcb3fcb07cbffc9041127040311290302112602011125014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0000aa00ac0178eda2edfb709a5301b9935367b99170e28ea8288101012859f40d6fa192306ddf206e92306d9ad0d3ffd31f596c126f02e2206e933006a4e30e06e85b00ab00caf823216f223182080bdd80a0b9945f03db31e0810101016f22306d22104d216e955b59f45a3098c801cf004133f442e28101016dc8216e925b6d9b016f22585902cbffcb1fc9e228103b01206e953059f45a30944133f415e205a506a409a410891058060501f4111f1124111f111e1123111e111d1122111d111c1121111c111b1120111b111a111f111a1119111e11191118111d11181117111c11171116111b11161115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af55494330010f01fc5b1124d33f31d39f31d3ffd4d3ffd33fd430112411271124112311261123112211251122112111271121112011261120111f1125111f111e1127111e111d1126111d111c1125111c111b1127111b111a1126111a11191125111911181127111811171126111711161125111611151127111511141126111411131125111300ae02fe1112112711121111112611111110112511100f11270f0e11260e0d11250d0c11270c0b11260b0a11250a0911270908112608071125070611270605112605041125040311270302112602011128011129db3c8134bd5626c300f2f48134fd2c8100b4b9f2f4f8421128d08134ee21d749810310ba9521d74ac0039170e2f2f400eb00af01f4d307d307d3ffd3ffd3ffd4d4d4301123112c11231122112b11221121112a1121112011291120111f1128111f111e1127111e111d1126111d111c1125111c111b1124111b111a112c111a1119112b11191118112a111811171129111711161128111611151127111511141126111411131125111311121124111200b002fa1111112c11111110112b11100f112a0f0e11290e0d11280d0c11270c0b11260b0a11250a0911240908112c0807112b0706112a06051129050411280403112703021126020111250111248134ef112d562c562cdb3c01112e01f2f48134f0562ac300945629c3009170e2945628c3009170e2f2f48134f8562cc109f2f400b100b301f0112511261125112411261124112311261123112211261122112111261121112011261120111f1126111f111e1126111e111d1126111d111c1126111c111b1126111b111a1126111a11191126111911181126111811171126111711161126111611151126111511141126111411131126111311121126111200b202fa1111112611111110112611100f11260f0e11260e0d11260d0c11260c0b11260b0a11260a0911260911260807065540db3c941125c00293572570e2112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a00c5018a01fc112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef00b402fc10de10cd10bc10ab109a10895507112c71810140708134f1562a04562e44348134f2db3c112311241123112211241122112111241121112011241120111f1124111f111e1124111e111d1124111d111c1124111c111b1124111b111a1124111a11191124111911181124111811171124111711161124111611151124111500ca00b502f81114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a09112409112408070655408134f711255627db3cc00401112601f2f4112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d00b600b7000ed0d32731d3073002fc111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10895507718100f0708134f3562904562d44348134f4db3c562456245624562400ca00b801fc562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624112411491124112311481123112211471122112111461121112011451120111f1144111f111e1143111e111d1142111d111c1141111c111b1140111b00b901fc111a113f111a1119113e11191118113d11181117113c11171116113b11161115113a11151114113911141113113811131112113711121111113611111110113511100f11340f0e11330e0d11320d0c11310c0b11300b0a112f0a09112e0908112d0807112c0706112b0605112a050411290403112803021127020111260100ba02f4112556505650db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a11191125111911181125111811171125111711161125111611151125111511141125111411131125111311121125111200bf00bb02fa1111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a091125091125080706554056515651db3c112511261125112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a00bc00bd0108db3caa0200c002fc1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130011152011151db3c57105f0f57105f0f6c5111251127112511241126112411231125112300be00c80106db3ca500bf0110db3ca67e807fa90400c001f0112511261125112411261124112311261123112211261122112111261121112011261120111f1126111f111e1126111e111d1126111d111c1126111c111b1126111b111a1126111a11191126111911181126111811171126111711161126111611151126111511141126111411131126111311121126111200c103fa1111112611111110112611100f11260f0e11260e0d11260d0c11260c0b11260b0a11260a091126090811260807112607061126060511260504112604031126030211260201112601db3c1126db3c01112601a0112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e00c200c300c7001681328e01c002f2f48104b401f0112311251123112211241122112111251121112011241120111f1125111f111e1124111e111d1125111d111c1124111c111b1125111b111a1124111a11191125111911181124111811171125111711161124111611151125111511141124111411131125111311121124111211111125111111101124111000c402f60f11250f0e11240e0d11250d0c11240c0b11250b0a11240a091125090811240807112507061124060511250504112404031125030211240201112501112481328d11265625db3c01112701f2f41124aa09112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d00c500c6004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e200dc111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443000e4111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001fc112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce00c903fc10bd10ac109b108a1079106810571046103544308134f58134f6562f05562b050411300403112f030211300201112f011130db3c5629db3cc8562901cbff562801cbff562701cbffc9c882104252533101cb1f5220cbff563101cb3fccc9f9008135031132d0562ff91001113101f2f42c8307563159f40f6fa192306ddf00ca013700ce010c8a802c7fdb3800cb02f426f9005006baf2f423562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562a562aed41ed43ed44ed45ed47955b1125f2f0ed67ed65ed64ed63ed6180267fed118aed41edf101f2ff00cc00cd00825142f9415024ba5240f2f401ba5220f2f458baf2f411241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e000fc112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e02f8206e92306d8e14d0d3ffd33fd3ffd3ffd33fd4d4d455706c186f08e2206eb3208e208134fb226f2810475f075630baf2f48134fc026f2810375f07563101bc12f2f49131e28136b070f836820249f070f836a08209c9c380a07022e301813508f8416f24135f035003be12f2f48307f823562f5056562a050411320400cf00d301fe30112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a11191125111911181126111811171125111711161126111611151125111511141126111411131125111311121126111211111125111111101126111000d002f80f11250f0e11260e0d11250d0c11260c0b11250b0a11260a091125090811260807112507061126060511250504112604031125030211260201112501112674db3c11275627a0112511271125112411261124112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d00d100d2007e7021c001965b82080bf6808e2b21c002965b820808fcc88e1e21c003965b82080781e08e1101c0049630820962010095813517f2f0e2e2e2e2a77d8064a90400dc111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035440301fa0311340302112f0201112e011130c855705078cbff15cb3f13cbffcbffcb3fccccccc9102b01112d01562e01206e953059f45b30944133f417e211279307a407df112011281120111f1127111f111e1126111e111d1125111d111c1124111c111b1123111b111a1122111a1119112111191118112011181117111f111700d402fe1116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f0e11160e0d11150d0c11140c0b11130b0a11120a091111090e11100e107f106e105d104c103b4a18509706112a06104503112b03520302112c0201112cdb3c112776fb0270702101112a0183067101112b00d500d60042c813cbffcbffcbffc9c88210d119020401cb1f5627cf1612cbff12cbffccc9f90001fec855308210874e57715005cb1f13cbffcb3fcb07cbffc9041127041302112902011128014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00112111241121112011231120111f1122111f111e1121111e111d1120111d111c111f111c111b111e111b111a111d111a1119111c11191118111b11181117111a111700d701e61116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b12c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed540112043ce3022182105331b880bae30221821053575052bae30221821052454332ba00d900df00e000e501fc5b1124d37f30112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111111101111111000da02f60f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3c8133905626c200f2f48133915626561cbbf2f481339556268208989680be917f955626561cbae2f2f4813392f8416f24135f0382083d0900bef2f4f8276f10f8416f24135f03a111231125112311221124112211211125112100eb00db01fc112011241120111f1125111f111e1124111e111d1125111d111c1124111c111b1125111b111a1124111a1119112511191118112411181117112511171116112411161115112511151114112411141113112511131112112411121111112511111110112411100f11250f0e11240e0d11250d0c11240c0b11250b0a11240a00dc02f809112509081124080711250706112406051125050411240403112503021124020111250111248133961126db3c01112601be01112601f2f411185625a1562582081e8480a07f711128c8018210ff77560958cb1fcb7fc95625041129014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00112111241121015b00dd01fc112011231120111f1122111f111e1121111e111d1120111d111c111f111c111b111e111b111a111d111a1119111c11191118111b11181118111a11181116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a00de01861069105810471036453304c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011201fe5b5724112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d010f01fc5b1124d37f30112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111111101111111000e102f40f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3c8133a45626c200f2f48133a556268208989680bef2f48133a6f8416f24135f0382083d0900bef2f4f8276f10f8416f24135f03a1112411251124112311251123112211251122112111251121112011251120111f1125111f00eb00e202fe111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540db3c015b00e301f48133a7562722bcf2f401112601a156268133a802bbf2f4562582081e8480a07f711128c8018210ff77560958cb1fcb7fc95626041129014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c00e401a8111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c010f0348e30221821045564343bae3025726c0001125c12101112501b0e3025f0f5f0f5f07f2c08200e600ea011001fc5b1124d3ff30112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111111101111111000e702d80f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3c2c8307562759f40f6fa192306ddf206e92306d8e14d0d3ffd33fd3ffd3ffd33fd4d4d455706c186f08e28134fa216eb3f2f46f285f068134f932821005a39a80a0f823b9f2f483076dc800eb00e801f4216e925b6d8e19016f28550755705078cbff15cb3f13cbffcbffcb3fccccccc9e2103e1201112701206e953059f45b30944133f417e20aa5112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111900e901fa1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10ac0b5509c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011204405b1124d307d30f30011125011126db3c5626c2209480205727de5625c001e30f00eb00ec00f7010f000e8132645622f2f401fc5725112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f00ed01140e11100e10df551cdb3c00ee01d0561470708e1120b3935313b99170e294225623b99170e28ec8561d80402459f40f6fa192306ddf206e92306d8e11d0d3ffd33fd3ffd33fd4d455506c166f06e2206e933002a48e976f26303233f823028209e13380a012b9935f037fe30e02e202e810235f03571400ef01fc1124112a1124112311291123112211281122112111271121112011261120111f1125111f111e112a111e111d1129111d111c1128111c111b1127111b111a1126111a1119112511191118112a11181117112911171116112811161115112711151114112611141113112511131112112a111211111129111111101128111000f002fc0f11270f0e11260e0d11250d0c112a0c0b11290b0a11280a09112709081126080711250706112a060511290504112804031127030211260201112501112a5628db3c562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625562556255625010300f101f456255625562556255625562556251125114a1125112411491124112311481123112211471122112111461121112011451120111f1144111f111e1143111e111d1142111d111c1141111c111b1140111b111a113f111a1119113e11191118113d11181117113c11171116113b11161115113a111511141139111400f202f41113113811131112113711121111113611111110113511100f11340f0e11330e0d11320d0c11310c0b11300b0a112f0a09112e0908112d0807112c0706112b0605112a05041129040311280302112702011126011150db3c57105f0f57105f0f6c51112411271124112311261123112211251122112111241121013700f301fc112011231120111f1122111f111e1121111e111d1120111d111c111f111c111b111e111b111a111d111a1119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a00f402fc1069105810471036454003112b0302db3c562601111a8040f45b30111ca51126a41125a4112411281124112311271123112211261122112111251121112011241120111f1123111f111e1122111e111d1121111d111e1120111e111b111f111b111a111e111a111c111d111c1118111c11181117111b11171116111a111600f500f600d0561a83072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e406f225214ba91309131e221c2009301a501de218e1e830702c85902cb3fcb3fc903111a0312206e953059f45b30944133f417e2995b0111188307f45b30e21117925f04e200941115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a10591048103746054414031c5625c0028f061125c003e30fe30d00f800fc00fe01f8112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f00f901140e11100e10df551cdb3c00fa013470708e1220b3935312b99170e29556115613b99170e28ae85f0300fb00cc56138040561359f40f6fa192306ddf206e92306d9fd0d3ffd33fd3ffd4d455406c156f05e2206e94301111a48e356f2510345f04f823018209e13380a0b992307f8e1d56110111148040f45b301110a51111a401a41110111311100111111110e21111e2111101fa5725813502f2f0112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f00fd00100e11100e10df551c01fc5725112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f00ff01140e11100e10df551cdb3c010001f6561570708e1120b3935313b99170e294225622b99170e28edb561c80402459f40f6fa192306ddf206e92306d8e24d0d3ffd33fd3ffd3ffd33fd33fd401d0d33fd4301028102710261025102410236c186f08e2206e933002a48e976f285b3234f823038209e13380a013b9935f047fe30e02e202e810235f035715010101fc1124112b11241123112a1123112211291122112111281121112011271120111f1126111f111e1125111e111d112b111d111c112a111c111b1129111b111a1128111a1119112711191118112611181117112511171116112b11161115112a1115111411291114111311281113111211271112111111261111111011251110010204fa0f112b0f0e112a0e0d11290d0c11280c0b11270b0a11260a0911250908112b0807112a07061129060511280504112704031126030211250201112b01112a5628db3c5626e30f56250111198040f45b30111ba51125a41127a4112411281124112311271123112211261122112111251121112011241120111f1123111f010301040109010d0002a401f8572b5624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624562456245624112511491125112411481124112311471123112211461122112111451121112011441120111f1143111f111e1142111e010501f8111d1141111d111c1140111c111b113f111b111a113e111a1119113d11191118113c11181117113b11171116113a11161115113911151114113811141113113711131112113611121111113511111110113411100f11330f0e11320e0d11310d0c11300c0b112f0b0a112e0a09112d0908112c0807112b0706112a06010602f80511290504112804031127030211260201114901114adb3c57105f0f57105f0f6c51112311271123112211261122112111251121112011241120111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a111611151119111501b8010701961114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a10591048103740561301112a01112bdb3c010800d0561880402459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e406f225214ba91309131e221c2009301a501de218e1e804002c85902cb3fcb3fc90311180312206e953059f45b30944133f417e2995b0111168040f45b30e21115925f04e201f45726112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111010a02fa1110111111100f11100f550e562a5110112ddb3c56128307562b80404133f40e6fa19401d70130925b6de2206eb39401112bba9430572a70e29f0111280111118307f45b3011101127925728e2112311281123112411271124112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d010b010c00d0561983072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e406f225214ba91309131e221c2009301a501de218e1e830702c85902cb3fcb3fc90311190312206e953059f45b30944133f417e2995b0111178307f45b30e21116925f04e200b4111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c01fc111e1122111e111d1121111d111c1120111c111d111f111d111a111e111a1119111d1119111b111c111b1117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a1059104810374605010e000440130170c87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011201fe8136aff2f0112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e01110174551dc87f01ca00112511241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e0db3cc9ed54011201f6011124011125ce01112201ce01112001ca0001111e01ca0001111c01cbff111ac8ce01111901cb3f01111701cb3f01111501cb3f01111301cb3f01111101cb7f1ff4001df4001bf40009c8f40018f40016cb3f14cb3f12f400cb3f01c8f40012cb3f12cb3f13cb3f13f40013cb3f13ce13ca0013f40003c8f4001401130034f40015cb3f15cb3f15cb1f15f40015f40015cb3f14cd13cdcdcd02012001150175020120011601430201200117012d0201200118012a0201200119012803f1ac4876a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186889208928892089188920891889108918891089088910890889008908890088f8890088f888f088f888f088e888f088e888e088e888e088d888e088d888d088d888d088c888d088c888c088c888c4001bc01be011a018e1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cee6cee3e3e3e3e3e3e3e3e3e5584011b02f2561980402259f40f6fa192306ddf206e92306d8e24d0d3ffd33fd3ffd3ffd33fd33fd401d0d33fd4301028102710261025102410236c186f08e2206ee3026f2820f9001123112e11231122112d11221121112c11211120112b1120111f112a111f111e1129111e111d1128111d111c1127111c111b1126111b011c012101fa3070705300112411291124112311281123112211271122112111261121112011251120111f1129111f111e1128111e111d1127111d111c1126111c111b1125111b111a1129111a111911281119111811271118111711261117111611251116111511291115111411281114111311271113111211261112111111251111011d02fc1110112911100f11280f0e11270e0d11260d0c11250c0b11290b0a11280a09112709081126080711250706112906051128050411270403112603021125020111290111285627db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c01a4011e03fe111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655405628db3c56275470005300880d112f0d0c11300c01a6019d011f01f80b112e0b0a11320a0911310908112d08112c1132112c112b1131112b112a1130112a1129112f11291128112e11281127112d11271126112c11261125112b11251124112a1124112311291123112211281122112111271121112011261120111f1125111f111e1124111e111d1123111d111c1122111c111b1121111b012000b8111a1120111a1119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e1111111311111110111111100e11100e10ef01fc111a1125111a1119112411191118112e11181117112d11171116112c11161115112b11151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d112e0d0c112d0c0b112c0b0a112b0a09112a0908112908071128070611270605112605041125040311240302112e0201112d01012202fa112c7f112c562b562b562a5630562bdb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119111811251118111711251117111611251116111511251115111411251114111311251113012301240042c813cbffcbffcbffc9c88210d119020201cb1f5627cf1612cbff12cb3fccc9f90002f61112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540562cdb3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a01a4012502f81119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540562ddb3c0d112f0d0c112e0c0b11270b0a112d0a09112b09081126080701a6012601f406112c060511300504112a0403112903021128020111320111311125113211251124113111241123113011231122112f11221121112e11211120112d1120111f112c111f111e112b111e111d112a111d111c1129111c111b1128111b111a1127111a111911261119111811251118111711241117111611231116012700dc1115112211151114112111141113112011131112111f11121111111e11111110111d11100f111c0f0e111b0e1115111a11151114111911141115111811151113111711131111111611111114111511141113111411131112111311121111111211111110111111100f11100f10ef0369ad09f6a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186ed9e364436443644366c4001bc01be012900248208a7c538742b544d3027544a302a54473003f1b2bdbb513434800063a7be903e903480348020404075c03500743e900c05854510cc01b4554136cf38c34449044944490448c4490448c4488448c4488448444884484448044844480447c4480447c4478447c4478447444784474447044744470446c4470446c4468446c4468446444684464446044644462001bc01be012b017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf56cf56c75012c01f4561783072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f22112311271123112211261122112111251121112011241120111f1127111f111e1126111e111d1125111d111c1124111c111b1127111b111a1126111a11191125111911181124111811171127111701b1020120012e013a020148012f01310364ab7ced44d0d200018e9efa40fa40d200d200810101d700d401d0fa4030161514433006d15504db3ce30ddb3c6cf36cf36c7301bc01be01300006547efd03f0aafbed44d0d200018e9efa40fa40d200d200810101d700d401d0fa4030161514433006d15504db3ce30d112411261124112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a111801bc01be013201881117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c6cf36cf36c730133019820c24093308040de20c100923070de6d7020935313b98eb15341a0561680402259f40f6fa192306ddf206e92306d9fd0d3ffd33fd3ffd4d455406c156f05e2206eb3915be30d01a401e83132013401fa6f253031321123112c11231122112b11221121112a1121112011291120111f1128111f111e1127111e111d1126111d111c1125111c111b1124111b111a112c111a1119112b11191118112a11181117112911171116112811161115112711151114112611141113112511131112112411121111112c11111110112b1110013503fc0f112a0f0e11290e0d11280d0c11270c0b11260b0a11250a0911240908112c0807112b0706112a06051129050411280403112703021126020111250111248010112d5626db3c1127db3c031128030211260201112701c855305034810101cf00810101cf00810101cf0001c8810101cf00cdc90211280201112b015626010136013701380014d0d33f31d3ff31d30f30000ed0d33f31d3ff3001fe206e953059f45b30944133f417e21124a4112011291120111f1128111f111e1127111e111d1126111d111c1125111c111b1124111b111a1123111a1119112211191118112111181117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e013900580d11160d0c11150c0b11140b0a11130a091112090811110807111007106f105e104d103c4ba010291058105703f1b0f4bb513434800063a7be903e903480348020404075c03500743e900c05854510cc01b4554136cf38c34449044944490448c4490448c4488448c4488448444884484448044844480447c4480447c4478447c4478447444784474447044744470446c4470446c4468446c4468446444684464446044644462001bc01be013b01841117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f57105f0f6c51013c01f228112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a111911251119111811261118111711251117111611261116111511251115111411261114111311251113111211261112111111251111013d03f41110112611100f11250f0e11260e0d11250d0c11260c0b11250b0a11260a09112509081126080711250706112606051125050411260403112503021126020111250111268101011126db3c562603112803021127024133f40c6fa19401d70030925b6de2206ee302112311251123112211241122112111231121013e013f0141001ec88210424e4c3101cb1fcbffc9f90001fe30112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551c014000027001fc112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106801420012105710461035443012020148014401530201200145014c03f1ae29f6a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186889208928892089188920891889108918891089088910890889008908890088f8890088f888f088f888f088e888f088e888e088e888e088d888e088d888d088d888d088c888d088c888c088c888c4001bc01be014601801117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6caa6caa6caa6c7a014703f2561180402259f40f6fa192306ddf206e92306d9fd0d3ffd33fd3ffd4d455406c156f05e2206e8f0c307070547000530088881089e06f2521f90021f9001123112c11231122112b11221121112a1121112011291120111f1128111f111e1127111e111d1126111d111c1125111c111b1124111b111a112c111a019d019d014801fe1119112b11191118112a11181117112911171116112811161115112711151114112611141113112511131112112411121111112c11111110112b11100f112a0f0e11290e0d11280d0c11270c0b11260b0a11250a0911240908112c0807112b0706112a06051129050411280403112703021126020111250111247f112d562c014902f6562c56285628562ddb3c09112e0908112d080706112c0605112b05041127040311260302112a020111290111281125112e11251124112d11241123112c11231122112b11221121112a1121112011291120111f1128111f111e1127111e111d1126111d111c1125111c111b1124111b111a1123111a111911221119014a014b0042c813cbffcbffcbffc9c88210d119020301cb1f5627cf1612cbff12cb3fccc9f90000c81118112111181117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d11160d0c11150c0b11140b0a11130a0a11120a0a11110a0d11100d10af10de10cd10bc10ab03f1affbf6a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186889208928892089188920891889108918891089088910890889008908890088f8890088f888f088f888f088e888f088e888e088e888e088d888e088d888d088d888d088c888d088c888c088c888c4001bc01be014d01841117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c57105f0f57105f0f6c51014e01f0112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119111811251118111711251117111611251116111511251115111411251114111311251113111211251112111111251111014f03fc1110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a09112509112508070655405625db3c1126db3c01112601a1112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11190150015101520038810101530450334133f40c6fa19401d70030925b6de2206e923070e00038810101530350334133f40c6fa19401d70030925b6de2206e923070e000a81118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441300201200154016e04f5add6f6a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186ed9e2b8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8c86088c064001bc01be0155016d01f056215623562256215621112411291124112311281123112211271122112111261121112011251120111f1129111f5628111f111e1128111e111d1127111d111c1126111c111b112a111b111a1119112811191118112711181117112611171116112a11161115111411281114111311271113111211261112015602fe1111112a111111100f11280f0e11270e0d11260d0c112a0c0b0a11280a091127090811260807112a070605112805041127040311260302112a02011129db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e5625111e111d111c111b111a111911181117111611150189015702f41114111311121111111055e01126db3c8307718209e13380561e5629562956265624562456195619561956181124113211241123113111231122113011221121112f11211120112e1120111f112d111f111e112c111e111d112b111d111c112a111c111b1129111b111a1128111a1119112711191118112611180189015802f81117112511171116113211161115113111151114113011141113112f11131112112e11121111112d11111110112c11100f112b0f0e112a0e0d11290d0c11280c0b11270b0a11260a0911250908113208071131070611300605112f0504112e0403112d0302112c0201112b01112adb3c112411251124112311251123015c015901fc112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d015a02f20c11250c0b11250b0a11250a0911250911250807065540db3c1115113811151114113711141113113611131112113a11121111113911111110113511100f112b0f0e112a0e0d11290d0c11280c0b11270b0a11340a0911330908113208071131070611300605112f0504112e0403112d0302112c0201112601015b016b02f6db3c24112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a111911251119111811261118111711251117111611261116111511251115111411261114111311251113111211261112111111251111015c016501f4561c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119111811251118111711251117111611251116111511251115111411251114111311251113111211251112111111251111015d02f41110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540db3c01112601a8561b112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b111a1125111a111911251119015e015f000a82080bf68002fe1118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250908112508071125070611250605112505041125040311250302112502011125011126db3c01112701a80111250101600161000a820808fcc803f6a02c011125011126db3c01112701a801112501a02a011125011126db3c01112701a801112501a0a77d8064a904112311251123112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a1118111711191117016201630164000a82080781e0000a820962010000941116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443002f41110112611100f11250f0e11260e0d11250d0c11260c0b11250b0a11260a0911250908112608071125070611260605112505041126040311250302112602011125011126db3c01112701a801112501a0112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d016601670006813a9802fc111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411254130db3c01112601a08218174876e8005cbc01680169000e208208a7c538a801f691309131e2561a01a0112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119111811191118111711181117111611171116111511161115111411151114111311141113111211131112016a00541111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001fa8218174876e800807d80641128113d11281127113c11271126113b11261125113a1125112411391124112311381123112211371122112111361121112011351120111f1134111f111e1133111e111d1132111d111c1131111c111b1130111b111a112f111a1119112e11191126112d11261125112c11251124112b1124016c00301128112a1128112711291127112311281123111911271119004e0b11170b0a11160a091115090811140807111307061112060511110504111004103f4e1c55a00d03f1af9bf6a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186889208928892089188920891889108918891089088910890889008908890088f8890088f888f088f888f088e888f088e888e088e888e088d888e088d888d088d888d088c888d088c888c088c888c4001bc01be016f017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6ce76ce76c97017003ee112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e5625111e111d111c111b111a111911181117111611151114111311121111111055e0201127db3ce303112311241123112211241122112111241121112011241120111f1124111f111e1124111e0186017f017102fc111d1124111d111c1124111c111b1124111b111a1124111a1119112411191118112411181117112411171116112411161115112411151114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a09112409112408070655407f11255626db3c018f017202fe112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e5625111e111d111c111b111a111911181117111611151114111311121111111055e05628011127db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e5625018e017302f6111e111d111c111b111a111911181117111611151114111311121111111055e05629011127db3c702006112a0605112b0504112904031128031127112b11271126112a1126112511291125112411281124112311271123112211261122112111251121112011241120111f1123111f111e1122111e111d1121111d0184017400d8111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b10791078020120017601ac020120017701a9020148017801930201480179017c03efa4d3da89a1a400031d3df481f481a401a401020203ae01a803a1f480602c2a2886600da2aa09b679c61a2248224a2248224622482246224422462244224222442242224022422240223e2240223e223c223e223c223a223c223a2238223a223822362238223622342236223422322234223222302232223101bc01be017a017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf56cf56c75017b007e298101012259f40d6fa192306ddf206e92306d9dd0d3ffd200d31f55206c136f03e2206e9730707070211034e07f216f235b226f233031036f236c2141401303efa763da89a1a400031d3df481f481a401a401020203ae01a803a1f480602c2a2886600da2aa09b679c61a2248224a2248224622482246224422462244224222442242224022422240223e2240223e223c223e223c223a223c223a2238223a223822362238223622342236223422322234223222302232223101bc01be017d017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6ce76ce76c97017e03f2112411251124112311251123112211251122112111251121112011251120111f1125111f5625111f111e111d111c111b111a111911181117111611151114111311121111111055e0201127db3ce303112311241123112211241122112111241121112011241120111f1124111f111e1124111e111d1124111d0186017f018101fc705626aa075627aa07705300105605112b05112a112b112a1129112a1129112811291128112711281127112611271126112511261125112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a1119018000941118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107802fc111c1124111c111b1124111b111a1124111a1119112411191118112411181117112411171116112411161115112411151114112411141113112411131112112411121111112411111110112411100f11240f0e11240e0d11240d0c11240c0b11240b0a11240a09112409112408070655407f11255626db3c112411251124018f018202fe112311251123112211251122112111251121112011251120111f1125111f5625111f111e111d111c111b111a111911181117111611151114111311121111111055e05628011127db3c112411251124112311251123112211251122112111251121112011251120111f1125111f5625111f111e111d111c111b111a11191118018e018302fe1117111611151114111311121111111055e05629011127db3c702006112a0605112b0504112904031128031127112b11271126112a1126112511291125112411281124112311271123112211261122112111251121112011241120111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a0184019201f0112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a111911251119111811261118111711251117111611261116111511251115111411261114111311251113111211261112111111251111018503f81110112611100f11250f0e11260e0d11250d0c11260c0b11250b0a11260a091125090811260807112507061126060511250504112604031125030211260201112501112656255627db3ce303112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d0186018b018d02ee21c2ff8e2e5b11241123112211211120111f111e111d111c111b111a111911181117111611151114111311121111111055e070e30d112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a0187018a01fc112511261125112411261124112311261123112211261122112111261121112011261120111f1126111f111e1126111e111d1126111d111c1126111c111b1126111b111a1126111a111911261119111811261118111711261117111611261116111511261115111411261114111311261113111211261112111111261111018801921110112611100f11260f0e11260e0d11260d0c11260c0b11260b0a11260a091126090811260807112607061126060511260504112604031126030211260201112601db3c01112601b90189001220923070e1a5ab07a400b41119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001fc57255725112211241122112111231121112011221120111f1121111f111e1120111e111d111f111d111c111e111c111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e018c000a10df551c7003f4111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e201127db3c1126db3c01112601a1112411251124112311241123112211231122112111221121018e018f0190001601a4aa075301bc9130e0310004aa0701fc112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710560191000c10451034413000b41119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b107910780201200194019703f0abbced44d0d200018e9efa40fa40d200d200810101d700d401d0fa4030161514433006d15504db3ce30d112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111801bc01be019501801117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6c996c996c996ca90196037e2d83072259f40f6fa192306ddf206e92306d8e14d0d3ffd33fd3ffd3ffd33fd4d4d455706c186f08e2206e8f8b3070705470008888881078e06f28377f0807019d019d019d03f0a861ed44d0d200018e9efa40fa40d200d200810101d700d401d0fa4030161514433006d15504db3ce30d112411251124112311241123112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111801bc01be0198018e1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cee6cee3e3e3e3e3e3e3e3e3e5584019902f6561a80402259f40f6fa192306ddf206e92306d8e11d0d3ffd33fd3ffd33fd4d455506c166f06e2206ee3026f2621f90021f9001123112d11231122112c11221121112b11211120112a1120111f1129111f111e1128111e111d1127111d111c1126111c111b1125111b111a1124111a1119112d11191118112c1118019a01a001fe3070705300f8281124112a1124112311291123112211281122112111271121112011261120111f1125111f111e112a111e111d1129111d111c1128111c111b1127111b111a1126111a1119112511191118112a11181117112911171116112811161115112711151114112611141113112511131112112a1112111111291111019b02fc1110112811100f11270f0e11260e0d11250d0c112a0c0b11290b0a11280a09112709081126080711250706112a060511290504112804031127030211260201112501112a5629db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c01a4019c04fc111b1125111b111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540562adb3c562754700088880d11300d0c11310c01a6019d019d019e000001f40b112f0b0a112e0a09112d090811320807112c07112b1132112b112a1131112a1129113011291128112f11281127112e11271126112d11261125112c11251124112b11241123112a1123112211291122112111281121112011271120111f1126111f111e1125111e111d1124111d111c1123111c111b1122111b019f00b4111a1121111a1119112011191118111f11181117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0e11130e0e11120e0e11110e0e11100e02fe1117112b11171116112a11161115112911151114112811141113112711131112112611121111112511111110112411100f112d0f0e112c0e0d112b0d0c112a0c0b11290b0a11280a0911270908112608071125070611240605112d0504112c0403112b0302112a020111290111287f112856275627562c562c5632db3c562401a101a20042c813cbffcbffcbffc9c88210d119020101cb1f5627cf1612cbff12cb3fccc9f90001fc112411261124112311251123112211261122112111251121112011261120111f1125111f111e1126111e111d1125111d111c1126111c111b1125111b111a1126111a11191125111911181126111811171125111711161126111611151125111511141126111411131125111311121126111211111125111111101126111001a302fc0f11250f0e11260e0d11250d0c11260c0b11250b0a11260a09112509081126080711250706112606051125050411260403112503021126020111250111265629db3c112411251124112311251123112211251122112111251121112011251120111f1125111f111e1125111e111d1125111d111c1125111c111b1125111b01a401a50004ab0702fa111a1125111a1119112511191118112511181117112511171116112511161115112511151114112511141113112511131112112511121111112511111110112511100f11250f0e11250e0d11250d0c11250c0b11250b0a11250a0911250911250807065540562adb3c0d112c0d0c112b0c0b11310b0a11270a09112a0901a601a70006a9380701fe0811280807112607060511290504112e0403112d030211320201113001112f1125113211251124113111241123113011231122112f11221121112e11211120112d1120111f112c111f111e112b111e111d112a111d111c1129111c111b1128111b111a1127111a11191126111911181125111811171124111711161123111601a800c01115112211151114112111141113112011131112111f11121111111e11111110111d11100f111c0f0e111b0e1112111a11121111111911111117111811171112111711121110111611100e11150e1111111411110e11130e0f11120f0e11100e03f1b4f2dda89a1a400031d3df481f481a401a401020203ae01a803a1f480602c2a2886600da2aa09b679c61a2248224a2248224622482246224422462244224222442242224022422240223e2240223e223c223e223c223a223c223a2238223a2238223622382236223422362234223222342232223022322231001bc01be01aa017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf56cf56c7501ab01f4561883072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f22112311271123112211261122112111251121112011241120111f1127111f111e1126111e111d1125111d111c1124111c111b1127111b111a1126111a11191125111911181124111811171127111701b102015801ad01bb02012001ae01b403f1ace9f6a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186889208928892089188920891889108918891089088910890889008908890088f8890088f888f088f888f088e888f088e888e088e888e088d888e088d888d088d888d088c888d088c888c088c888c4001bc01be01af017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf56cf56c7501b001f4561680402259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f22112311271123112211261122112111251121112011241120111f1127111f111e1126111e111d1125111d111c1124111c111b1127111b111a1126111a11191125111911181124111811171127111701b102fc1116112611161115112511151114112411141113112711131112112611121111112511111110112411100f11270f0e11260e0d11250d0c11240c0b11270b0a11260a09112509081124080711270706112606051125050411240403112703021126020111250111247f11285626db3c04112904031128030201112701112601b801b201fc112511291125112411281124112311271123112211261122112111251121112011241120111f1123111f111e1122111e111d1121111d111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a111611151119111511141118111411131117111311121116111211111115111101b300501110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a10591058105703f1ad9376a268690000c74f7d207d2069006900408080eb806a00e87d20180b0a8a21980368aa826d9e7186889208928892089188920891889108918891089088910890889008908890088f8890088f888f088f888f088e888f088e888e088e888e088d888e088d888d088d888d088c888d088c888c088c888c4001bc01be01b5017c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550edb3c6cf56cf56c7501b601f6561383072280404133f40e6fa19401d70130925b6de2206e9730707053001034e0112311261123112211251122112111241121112011261120111f1125111f111e1124111e111d1126111d111c1125111c111b1124111b111a1126111a11191125111911181124111811171126111711161125111611151124111501b702f61114112611141113112511131112112411121111112611111110112511100f11240f0e11260e0d11250d0c11240c0b11260b0a11250a09112409081126080711250706112406051126050411250403112403021126020111250111247f11275625db3c03112803021127020111267111261129112611251128112501b801b90002a501fc112411271124112311261123112211251122112111241121112011231120111f1122111f111e1121111e111d1120111d111c111f111c111b111e111b111a111d111a1119111c11191118111b11181117111a111711161119111611151118111511141117111411131116111311121115111211111114111111101113111001ba00400f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810571056036db241bb513434800063a7be903e903480348020404075c03500743e900c05854510cc01b4554136cf38c376cf15c417c3d5c417c3db146001bc01be01c001f22570547000206d6d6d6d6d53556d216d5471116d21706d6d6d5474446d6d22111e1124111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111111101111111001bd001c0f11100f10ef10de10cd10bc10ab01fafa40fa40d200d200d3ffd401d0fa40d33fd33fd33fd33fd37ff404f404f404d430d0f404f404d33fd33ff404d33fd430d0f404d33fd33fd33ff404d33ffa40d200f404d430d0f404f404d33fd33fd31ff404f404d33f30112011251120112011241120112011231120112011221120112011211120572511231124112301bf00f0112211231122112111221121112011211120111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e00045611f6675d7d');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initCapsuleHub_init_args({ $$type: 'CapsuleHub_init_args', fee_accumulator_address, vault_address, vault_bound, sealed, deployment_manifest_hash, genesis_controller_address })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const CapsuleHub_errors = {
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

export const CapsuleHub_errors_backward = {
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

const CapsuleHub_types: ABIType[] = [
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
    {"name":"PublishAnonBatch","header":1346458946,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"parts","type":{"kind":"simple","type":"cell","optional":false}},{"name":"tokens","type":{"kind":"simple","type":"cell","optional":false}},{"name":"marketing","type":{"kind":"simple","type":"cell","optional":true}}]},
    {"name":"PublishRecovery","header":1346458179,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"part","type":{"kind":"simple","type":"cell","optional":false}},{"name":"owner_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"owner_sig","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"FundAnonPool","header":1178685008,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FundAnonPoolAck","header":1178684993,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"HubMirrorIssuerKey","header":1213352753,"fields":[{"name":"slot","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}},{"name":"version","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"BindCreditIssuer","header":1112297028,"fields":[{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"EvictExpiredNullifiers","header":1314212940,"fields":[{"name":"max_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"ReclaimExpiredFunding","header":1380270918,"fields":[{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"IssuerSlot","header":null,"fields":[{"name":"pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}},{"name":"version","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"NullRec","header":null,"fields":[{"name":"key","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"insert_time","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"BindDeploymentManifest","header":2430787787,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"counterpart_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushFees","header":2055606321,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"TopUpStorageReserve","header":1395767424,"fields":[]},
    {"name":"SweepExcessReserve","header":1398231122,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"EvictExpiredRecoverySlot","header":1380270898,"fields":[{"name":"slot_key","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"EvictExpiredCapsules","header":1163281219,"fields":[{"name":"kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"max_count","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"PublishBatchToHub","header":2767741649,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"protocol_fee_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"parts","type":{"kind":"simple","type":"cell","optional":false}},{"name":"marketing","type":{"kind":"simple","type":"cell","optional":true}}]},
    {"name":"CapsuleHubBatchAck","header":2270058353,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"first_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"batch_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CapsuleHubStateView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_size","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_storage_years","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_retention_seconds","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"intro_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"intro_oldest_live_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"intro_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recovery_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_storage_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"protected_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_floor_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_buffer_numerator","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_buffer_denominator","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHubPageView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"first_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"opened_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PrivateCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"bucket_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"channel_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"parent_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"profile_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bucket_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PrivateBucketIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"bucket_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"IntroCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"IntroScanRecord","header":null,"fields":[{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"view_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ephemeral_r","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroScanBoundsView","header":null,"fields":[{"name":"oldest_live_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroScanPageView","header":null,"fields":[{"name":"from_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"records","type":{"kind":"dict","key":"uint","keyFormat":16,"value":"IntroScanRecord","valueFormat":"ref"}}]},
    {"name":"RecoveryCapsuleRecord","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"updated_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"owner_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"RecoveryCapsuleView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"slot_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"owner_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"seq","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"channel_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"parent_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"profile_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PublicCapsuleKeyIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"AnonPoolStateView","header":null,"fields":[{"name":"credit_issuer_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"nullifier_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"nullifier_latest","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"nullifier_oldest_live","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"anon_pool_outstanding","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"prepaid_unit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_batch_parts_anon","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IssuerSlotView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"slot","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}},{"name":"version","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHub$Data","header":null,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"private_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PrivateCapsuleEntry","valueFormat":"ref"}},{"name":"public_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleEntry","valueFormat":"ref"}},{"name":"private_bucket_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PrivateCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_author_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PublicCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_parent_index","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_profile_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"uint","valueFormat":64}},{"name":"public_profile_head","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"intro_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"IntroCapsuleEntry","valueFormat":"ref"}},{"name":"intro_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"intro_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"intro_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"recovery_slots","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"RecoveryCapsuleRecord","valueFormat":"ref"}},{"name":"recovery_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"credit_issuer_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"issuer_mirror","type":{"kind":"dict","key":"int","value":"IssuerSlot","valueFormat":"ref"}},{"name":"spent_nullifiers","type":{"kind":"dict","key":"int","value":"int"}},{"name":"nullifier_seq","type":{"kind":"dict","key":"int","value":"NullRec","valueFormat":"ref"}},{"name":"nullifier_latest","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"nullifier_oldest_live","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"nullifier_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"funded_by_epoch","type":{"kind":"dict","key":"int","value":"int"}},{"name":"spent_by_epoch","type":{"kind":"dict","key":"int","value":"int"}},{"name":"anon_pool_outstanding","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const CapsuleHub_opcodes = {
    "PublishAnonBatch": 1346458946,
    "PublishRecovery": 1346458179,
    "FundAnonPool": 1178685008,
    "FundAnonPoolAck": 1178684993,
    "HubMirrorIssuerKey": 1213352753,
    "BindCreditIssuer": 1112297028,
    "EvictExpiredNullifiers": 1314212940,
    "ReclaimExpiredFunding": 1380270918,
    "BindDeploymentManifest": 2430787787,
    "SealGenesis": 974311853,
    "FlushFees": 2055606321,
    "TopUpStorageReserve": 1395767424,
    "SweepExcessReserve": 1398231122,
    "DepositProtocolFee": 4286010889,
    "EvictExpiredRecoverySlot": 1380270898,
    "EvictExpiredCapsules": 1163281219,
    "PublishBatchToHub": 2767741649,
    "CapsuleHubBatchAck": 2270058353,
}

const CapsuleHub_getters: ABIGetter[] = [
    {"name":"get_recovery_capsule","methodId":101308,"arguments":[{"name":"slotKey","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"RecoveryCapsuleView","optional":false}},
    {"name":"get_private_entry","methodId":101473,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleEntryView","optional":false}},
    {"name":"get_private_bucket_index","methodId":108438,"arguments":[{"name":"bucketKey","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateBucketIndexView","optional":false}},
    {"name":"get_intro_entry","methodId":83027,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"IntroCapsuleEntryView","optional":false}},
    {"name":"get_intro_scan_bounds","methodId":74620,"arguments":[],"returnType":{"kind":"simple","type":"IntroScanBoundsView","optional":false}},
    {"name":"get_intro_scan_page","methodId":75515,"arguments":[{"name":"fromEntryId","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"count","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"IntroScanPageView","optional":false}},
    {"name":"get_public_author_index","methodId":72438,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicCapsuleKeyIndexView","optional":false}},
    {"name":"get_public_profile_index","methodId":125734,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicCapsuleKeyIndexView","optional":false}},
    {"name":"get_public_profile_head","methodId":129286,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_public_parent_index","methodId":123347,"arguments":[{"name":"parentEntryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicCapsuleKeyIndexView","optional":false}},
    {"name":"get_public_entry","methodId":65680,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicCapsuleEntryView","optional":false}},
    {"name":"get_private_page","methodId":99249,"arguments":[{"name":"pageId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"CapsuleHubPageView","optional":false}},
    {"name":"get_public_page","methodId":89911,"arguments":[{"name":"pageId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"CapsuleHubPageView","optional":false}},
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"CapsuleHubStateView","optional":false}},
    {"name":"get_anon_pool_state","methodId":68115,"arguments":[],"returnType":{"kind":"simple","type":"AnonPoolStateView","optional":false}},
    {"name":"get_issuer_slot","methodId":98409,"arguments":[{"name":"slot","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"IssuerSlotView","optional":false}},
    {"name":"get_epoch_funding","methodId":86007,"arguments":[{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"get_nullifier_insert_time","methodId":78802,"arguments":[{"name":"serial","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
]

export const CapsuleHub_getterMapping: { [key: string]: string } = {
    'get_recovery_capsule': 'getGetRecoveryCapsule',
    'get_private_entry': 'getGetPrivateEntry',
    'get_private_bucket_index': 'getGetPrivateBucketIndex',
    'get_intro_entry': 'getGetIntroEntry',
    'get_intro_scan_bounds': 'getGetIntroScanBounds',
    'get_intro_scan_page': 'getGetIntroScanPage',
    'get_public_author_index': 'getGetPublicAuthorIndex',
    'get_public_profile_index': 'getGetPublicProfileIndex',
    'get_public_profile_head': 'getGetPublicProfileHead',
    'get_public_parent_index': 'getGetPublicParentIndex',
    'get_public_entry': 'getGetPublicEntry',
    'get_private_page': 'getGetPrivatePage',
    'get_public_page': 'getGetPublicPage',
    'get_state': 'getGetState',
    'get_anon_pool_state': 'getGetAnonPoolState',
    'get_issuer_slot': 'getGetIssuerSlot',
    'get_epoch_funding': 'getGetEpochFunding',
    'get_nullifier_insert_time': 'getGetNullifierInsertTime',
}

const CapsuleHub_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BindCreditIssuer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"HubMirrorIssuerKey"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FundAnonPool"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EvictExpiredNullifiers"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ReclaimExpiredFunding"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishAnonBatch"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishRecovery"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushFees"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SweepExcessReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EvictExpiredRecoverySlot"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EvictExpiredCapsules"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const PLATO_PRIVATE_LONG_TERM_FEE_TON = 10000000n;
export const PLATO_PUBLIC_POST_FEE_TON = 10000000n;
export const SIZE_CLASS_1K = 1n;
export const SIZE_CLASS_2K = 2n;
export const SIZE_CLASS_4K = 4n;
export const SIZE_CLASS_8K = 8n;
export const SIZE_CLASS_16K = 16n;
export const SIZE_CLASS_32K = 32n;
export const CRYPTO_SUITE_HYBRID = 2n;
export const CAPSULEHUB_INDEX_STORAGE_YEARS = 1n;
export const CAPSULEHUB_INDEX_RETENTION_SECONDS = 31536000n;
export const CAPSULEHUB_PAGE_SIZE = 256n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 784000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 589000n;
export const CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT = 492000n;
export const CAPSULEHUB_INTRO_SWEEP_CAP = 4n;
export const CAPSULEHUB_SAFE_LIVE_CAP = 4300n;
export const CAPSULEHUB_SAFE_RECOVERY_CAP = 180n;
export const CAPSULEHUB_SAFE_NULLIFIER_CAP = 1700n;
export const CAPSULEHUB_STANDALONE_EVICT_CAP = 32n;
export const CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS = 94608000n;
export const CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT = 23200000n;
export const RECOVERY_MAX_SIZE_CLASS = 8n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_FEE_FLUSH_TON = 10000000n;
export const CAPSULEHUB_MIN_PROTECTED_RESERVE_TON = 100000000000n;
export const CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR = 125n;
export const CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR = 100n;
export const CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_RESERVE_SWEEP_TON = 10000000n;
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
export const ENTRY_UID_DOMAIN_VAULT_PRIVATE = 3508077057n;
export const ENTRY_UID_DOMAIN_VAULT_PUBLIC = 3508077058n;
export const ENTRY_UID_DOMAIN_VAULT_INTRO = 3508077059n;
export const ENTRY_UID_DOMAIN_VAULT_RECOVERY = 3508077060n;
export const CAPSULEHUB_ENTRY_KIND_PRIVATE = 1n;
export const CAPSULEHUB_ENTRY_KIND_PUBLIC = 2n;
export const CAPSULEHUB_ENTRY_KIND_INTRO = 3n;
export const CAPSULEHUB_ENTRY_KIND_RECOVERY = 4n;
export const MAX_BATCH_PARTS = 8n;
export const HUB_BATCH_BASE_GAS = 14000n;
export const HUB_PART_GAS_PRIVATE = 170000n;
export const HUB_PART_GAS_PUBLIC = 180000n;
export const HUB_PART_GAS_INTRO = 120000n;
export const HUB_PART_GAS_RECOVERY = 150000n;
export const HUB_MIN_PER_PART_VALUE = 1000000n;
export const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN = 1162889521n;
export const PLATHO_PUBLIC_MARKETING_NOTE_ASCII = 2573421624129493433291659589718684717235138672n;
export const HUB_ANON_PUBLISH_KIND_PRIVATE = 1n;
export const HUB_ANON_PUBLISH_KIND_PUBLIC = 2n;
export const HUB_ANON_PUBLISH_KIND_INTRO = 3n;
export const MAX_BATCH_PARTS_ANON = 4n;
export const ISSUER_SIG_DOMAIN = 1112754481n;
export const SPEND_DOMAIN = 1112756273n;
export const FRAMECOMMIT_DOMAIN = 1111900977n;
export const NULL_DOMAIN = 1112427569n;
export const PUBLIC_CHANNEL_DOMAIN = 1112556337n;
export const RECOVERY_SLOT_DOMAIN = 1112691505n;
export const EPOCH_SECONDS = 86400n;
export const EPOCH_ACCEPT_PAST = 4n;
export const EPOCH_ACCEPT_FUTURE = 4n;
export const NULLIFIER_RETENTION_SECONDS = 777600n;
export const NULLIFIER_SWEEP_MARGIN = 4n;
export const CAPSULEHUB_STANDALONE_NULLIFIER_EVICT_CAP = 32n;
export const CAPSULEHUB_NULLIFIER_ENTRY_STORAGE_ENDOWMENT = 12000n;
export const HUB_TOKEN_VERIFY_GAS = 18000n;
export const CAPSULEHUB_PREPAID_UNIT = 10995000n;
export const CAPSULEHUB_FUND_LOCAL_EXEC_RESERVE = 2000000n;

export class CapsuleHub implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = CapsuleHub_errors_backward;
    public static readonly opcodes = CapsuleHub_opcodes;
    
    static async init(fee_accumulator_address: Address, vault_address: Address, vault_bound: boolean, sealed: boolean, deployment_manifest_hash: bigint, genesis_controller_address: Address) {
        return await CapsuleHub_init(fee_accumulator_address, vault_address, vault_bound, sealed, deployment_manifest_hash, genesis_controller_address);
    }
    
    static async fromInit(fee_accumulator_address: Address, vault_address: Address, vault_bound: boolean, sealed: boolean, deployment_manifest_hash: bigint, genesis_controller_address: Address) {
        const __gen_init = await CapsuleHub_init(fee_accumulator_address, vault_address, vault_bound, sealed, deployment_manifest_hash, genesis_controller_address);
        const address = contractAddress(0, __gen_init);
        return new CapsuleHub(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new CapsuleHub(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  CapsuleHub_types,
        getters: CapsuleHub_getters,
        receivers: CapsuleHub_receivers,
        errors: CapsuleHub_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | SealGenesis | BindCreditIssuer | HubMirrorIssuerKey | FundAnonPool | EvictExpiredNullifiers | ReclaimExpiredFunding | PublishAnonBatch | PublishRecovery | FlushFees | TopUpStorageReserve | SweepExcessReserve | EvictExpiredRecoverySlot | EvictExpiredCapsules | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindDeploymentManifest') {
            body = beginCell().store(storeBindDeploymentManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindCreditIssuer') {
            body = beginCell().store(storeBindCreditIssuer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'HubMirrorIssuerKey') {
            body = beginCell().store(storeHubMirrorIssuerKey(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FundAnonPool') {
            body = beginCell().store(storeFundAnonPool(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EvictExpiredNullifiers') {
            body = beginCell().store(storeEvictExpiredNullifiers(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ReclaimExpiredFunding') {
            body = beginCell().store(storeReclaimExpiredFunding(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishAnonBatch') {
            body = beginCell().store(storePublishAnonBatch(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishRecovery') {
            body = beginCell().store(storePublishRecovery(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushFees') {
            body = beginCell().store(storeFlushFees(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpStorageReserve') {
            body = beginCell().store(storeTopUpStorageReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SweepExcessReserve') {
            body = beginCell().store(storeSweepExcessReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EvictExpiredRecoverySlot') {
            body = beginCell().store(storeEvictExpiredRecoverySlot(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EvictExpiredCapsules') {
            body = beginCell().store(storeEvictExpiredCapsules(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetRecoveryCapsule(provider: ContractProvider, slotKey: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(slotKey);
        const source = (await provider.get('get_recovery_capsule', builder.build())).stack;
        const result = loadGetterTupleRecoveryCapsuleView(source);
        return result;
    }
    
    async getGetPrivateEntry(provider: ContractProvider, entryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entryId);
        const source = (await provider.get('get_private_entry', builder.build())).stack;
        const result = loadGetterTuplePrivateCapsuleEntryView(source);
        return result;
    }
    
    async getGetPrivateBucketIndex(provider: ContractProvider, bucketKey: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(bucketKey);
        const source = (await provider.get('get_private_bucket_index', builder.build())).stack;
        const result = loadGetterTuplePrivateBucketIndexView(source);
        return result;
    }
    
    async getGetIntroEntry(provider: ContractProvider, entryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entryId);
        const source = (await provider.get('get_intro_entry', builder.build())).stack;
        const result = loadGetterTupleIntroCapsuleEntryView(source);
        return result;
    }
    
    async getGetIntroScanBounds(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_intro_scan_bounds', builder.build())).stack;
        const result = loadGetterTupleIntroScanBoundsView(source);
        return result;
    }
    
    async getGetIntroScanPage(provider: ContractProvider, fromEntryId: bigint, count: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(fromEntryId);
        builder.writeNumber(count);
        const source = (await provider.get('get_intro_scan_page', builder.build())).stack;
        const result = loadGetterTupleIntroScanPageView(source);
        return result;
    }
    
    async getGetPublicAuthorIndex(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_public_author_index', builder.build())).stack;
        const result = loadGetterTuplePublicCapsuleKeyIndexView(source);
        return result;
    }
    
    async getGetPublicProfileIndex(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_public_profile_index', builder.build())).stack;
        const result = loadGetterTuplePublicCapsuleKeyIndexView(source);
        return result;
    }
    
    async getGetPublicProfileHead(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_public_profile_head', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetPublicParentIndex(provider: ContractProvider, parentEntryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(parentEntryId);
        const source = (await provider.get('get_public_parent_index', builder.build())).stack;
        const result = loadGetterTuplePublicCapsuleKeyIndexView(source);
        return result;
    }
    
    async getGetPublicEntry(provider: ContractProvider, entryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entryId);
        const source = (await provider.get('get_public_entry', builder.build())).stack;
        const result = loadGetterTuplePublicCapsuleEntryView(source);
        return result;
    }
    
    async getGetPrivatePage(provider: ContractProvider, pageId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(pageId);
        const source = (await provider.get('get_private_page', builder.build())).stack;
        const result = loadGetterTupleCapsuleHubPageView(source);
        return result;
    }
    
    async getGetPublicPage(provider: ContractProvider, pageId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(pageId);
        const source = (await provider.get('get_public_page', builder.build())).stack;
        const result = loadGetterTupleCapsuleHubPageView(source);
        return result;
    }
    
    async getGetState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_state', builder.build())).stack;
        const result = loadGetterTupleCapsuleHubStateView(source);
        return result;
    }
    
    async getGetAnonPoolState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_anon_pool_state', builder.build())).stack;
        const result = loadGetterTupleAnonPoolStateView(source);
        return result;
    }
    
    async getGetIssuerSlot(provider: ContractProvider, slot: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(slot);
        const source = (await provider.get('get_issuer_slot', builder.build())).stack;
        const result = loadGetterTupleIssuerSlotView(source);
        return result;
    }
    
    async getGetEpochFunding(provider: ContractProvider, epoch: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(epoch);
        const source = (await provider.get('get_epoch_funding', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getGetNullifierInsertTime(provider: ContractProvider, serial: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(serial);
        const source = (await provider.get('get_nullifier_insert_time', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
}