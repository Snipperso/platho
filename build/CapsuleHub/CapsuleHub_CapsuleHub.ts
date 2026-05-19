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

export type PublishPrivateDirect = {
    $$type: 'PublishPrivateDirect';
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    protocol_fee_paid: bigint;
}

export function storePublishPrivateDirect(src: PublishPrivateDirect) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2047786991, 32);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        b_0.storeUint(src.header_1_hash, 256);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.protocol_fee_paid, 128);
    };
}

export function loadPublishPrivateDirect(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2047786991) { throw Error('Invalid prefix'); }
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const _header_1_hash = sc_0.loadUintBig(256);
    const _body_hash = sc_0.loadUintBig(256);
    const _protocol_fee_paid = sc_0.loadUintBig(128);
    return { $$type: 'PublishPrivateDirect' as const, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPrivateDirect(source: TupleReader) {
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateDirect' as const, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPrivateDirect(source: TupleReader) {
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateDirect' as const, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPrivateDirect(source: PublishPrivateDirect) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.protocol_fee_paid);
    return builder.build();
}

export function dictValueParserPublishPrivateDirect(): DictionaryValue<PublishPrivateDirect> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPrivateDirect(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPrivateDirect(src.loadRef().beginParse());
        }
    }
}

export type PublishPublicDirect = {
    $$type: 'PublishPublicDirect';
    author_wallet: Address;
    body_hash: bigint;
    protocol_fee_paid: bigint;
}

export function storePublishPublicDirect(src: PublishPublicDirect) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3714445049, 32);
        b_0.storeAddress(src.author_wallet);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.protocol_fee_paid, 128);
    };
}

export function loadPublishPublicDirect(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3714445049) { throw Error('Invalid prefix'); }
    const _author_wallet = sc_0.loadAddress();
    const _body_hash = sc_0.loadUintBig(256);
    const _protocol_fee_paid = sc_0.loadUintBig(128);
    return { $$type: 'PublishPublicDirect' as const, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicDirect(source: TupleReader) {
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicDirect' as const, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicDirect(source: TupleReader) {
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicDirect' as const, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicDirect(source: PublishPublicDirect) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.protocol_fee_paid);
    return builder.build();
}

export function dictValueParserPublishPublicDirect(): DictionaryValue<PublishPublicDirect> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePublishPublicDirect(src)).endCell());
        },
        parse: (src) => {
            return loadPublishPublicDirect(src.loadRef().beginParse());
        }
    }
}

export type PublishPrivateFromVault = {
    $$type: 'PublishPrivateFromVault';
    bounce_id: bigint;
    publish_id: bigint;
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    protocol_fee_paid: bigint;
}

export function storePublishPrivateFromVault(src: PublishPrivateFromVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2767741632, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        b_0.storeUint(src.header_0_hash, 256);
        b_0.storeUint(src.header_1_hash, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.body_hash, 256);
        b_1.storeUint(src.protocol_fee_paid, 128);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublishPrivateFromVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2767741632) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _publish_id = sc_0.loadUintBig(256);
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const _header_0_hash = sc_0.loadUintBig(256);
    const _header_1_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _body_hash = sc_1.loadUintBig(256);
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPrivateFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPrivateFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPrivateFromVault(source: PublishPrivateFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
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
    publish_id: bigint;
    author_wallet: Address;
    body_hash: bigint;
    protocol_fee_paid: bigint;
}

export function storePublishPublicFromVault(src: PublishPublicFromVault) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2351593143, 32);
        b_0.storeUint(src.bounce_id, 64);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeAddress(src.author_wallet);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.protocol_fee_paid, 128);
    };
}

export function loadPublishPublicFromVault(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2351593143) { throw Error('Invalid prefix'); }
    const _bounce_id = sc_0.loadUintBig(64);
    const _publish_id = sc_0.loadUintBig(256);
    const _author_wallet = sc_0.loadAddress();
    const _body_hash = sc_0.loadUintBig(256);
    const _protocol_fee_paid = sc_0.loadUintBig(128);
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, publish_id: _publish_id, author_wallet: _author_wallet, body_hash: _body_hash, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicFromVault(source: PublishPublicFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.body_hash);
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

export type CapsuleHubStateView = {
    $$type: 'CapsuleHubStateView';
    sealed: boolean;
    vault_bound: boolean;
    deployment_manifest_hash: bigint;
    private_latest_id: bigint;
    public_latest_id: bigint;
    accrued_plato_fee_ton: bigint;
    fee_accumulator_address: Address;
    vault_address: Address;
    genesis_controller_address: Address;
    private_page_count: bigint;
    public_page_count: bigint;
    private_entry_count: bigint;
    public_entry_count: bigint;
    last_private_entry_id: bigint;
    last_public_entry_id: bigint;
    last_private_entry_uid: bigint;
    last_public_entry_uid: bigint;
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
        b_1.storeInt(src.accrued_plato_fee_ton, 257);
        b_1.storeAddress(src.fee_accumulator_address);
        b_1.storeAddress(src.vault_address);
        const b_2 = new Builder();
        b_2.storeAddress(src.genesis_controller_address);
        b_2.storeInt(src.private_page_count, 257);
        b_2.storeInt(src.public_page_count, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.private_entry_count, 257);
        b_3.storeInt(src.public_entry_count, 257);
        b_3.storeInt(src.last_private_entry_id, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.last_public_entry_id, 257);
        b_4.storeInt(src.last_private_entry_uid, 257);
        b_4.storeInt(src.last_public_entry_uid, 257);
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
    const _accrued_plato_fee_ton = sc_1.loadIntBig(257);
    const _fee_accumulator_address = sc_1.loadAddress();
    const _vault_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _genesis_controller_address = sc_2.loadAddress();
    const _private_page_count = sc_2.loadIntBig(257);
    const _public_page_count = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _private_entry_count = sc_3.loadIntBig(257);
    const _public_entry_count = sc_3.loadIntBig(257);
    const _last_private_entry_id = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _last_public_entry_id = sc_4.loadIntBig(257);
    const _last_private_entry_uid = sc_4.loadIntBig(257);
    const _last_public_entry_uid = sc_4.loadIntBig(257);
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_page_count: _private_page_count, public_page_count: _public_page_count, private_entry_count: _private_entry_count, public_entry_count: _public_entry_count, last_private_entry_id: _last_private_entry_id, last_public_entry_id: _last_public_entry_id, last_private_entry_uid: _last_private_entry_uid, last_public_entry_uid: _last_public_entry_uid };
}

export function loadTupleCapsuleHubStateView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _private_latest_id = source.readBigNumber();
    const _public_latest_id = source.readBigNumber();
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _fee_accumulator_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _private_page_count = source.readBigNumber();
    const _public_page_count = source.readBigNumber();
    const _private_entry_count = source.readBigNumber();
    const _public_entry_count = source.readBigNumber();
    const _last_private_entry_id = source.readBigNumber();
    source = source.readTuple();
    const _last_public_entry_id = source.readBigNumber();
    const _last_private_entry_uid = source.readBigNumber();
    const _last_public_entry_uid = source.readBigNumber();
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_page_count: _private_page_count, public_page_count: _public_page_count, private_entry_count: _private_entry_count, public_entry_count: _public_entry_count, last_private_entry_id: _last_private_entry_id, last_public_entry_id: _last_public_entry_id, last_private_entry_uid: _last_private_entry_uid, last_public_entry_uid: _last_public_entry_uid };
}

export function loadGetterTupleCapsuleHubStateView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _vault_bound = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _private_latest_id = source.readBigNumber();
    const _public_latest_id = source.readBigNumber();
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _fee_accumulator_address = source.readAddress();
    const _vault_address = source.readAddress();
    const _genesis_controller_address = source.readAddress();
    const _private_page_count = source.readBigNumber();
    const _public_page_count = source.readBigNumber();
    const _private_entry_count = source.readBigNumber();
    const _public_entry_count = source.readBigNumber();
    const _last_private_entry_id = source.readBigNumber();
    const _last_public_entry_id = source.readBigNumber();
    const _last_private_entry_uid = source.readBigNumber();
    const _last_public_entry_uid = source.readBigNumber();
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_page_count: _private_page_count, public_page_count: _public_page_count, private_entry_count: _private_entry_count, public_entry_count: _public_entry_count, last_private_entry_id: _last_private_entry_id, last_public_entry_id: _last_public_entry_id, last_private_entry_uid: _last_private_entry_uid, last_public_entry_uid: _last_public_entry_uid };
}

export function storeTupleCapsuleHubStateView(source: CapsuleHubStateView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeBoolean(source.vault_bound);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.private_latest_id);
    builder.writeNumber(source.public_latest_id);
    builder.writeNumber(source.accrued_plato_fee_ton);
    builder.writeAddress(source.fee_accumulator_address);
    builder.writeAddress(source.vault_address);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.private_page_count);
    builder.writeNumber(source.public_page_count);
    builder.writeNumber(source.private_entry_count);
    builder.writeNumber(source.public_entry_count);
    builder.writeNumber(source.last_private_entry_id);
    builder.writeNumber(source.last_public_entry_id);
    builder.writeNumber(source.last_private_entry_uid);
    builder.writeNumber(source.last_public_entry_uid);
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
    accrued_plato_fee_ton: bigint;
    private_page_count: bigint;
    public_page_count: bigint;
    private_entry_count: bigint;
    public_entry_count: bigint;
    last_private_entry_id: bigint;
    last_public_entry_id: bigint;
    last_private_entry_uid: bigint;
    last_public_entry_uid: bigint;
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
        b_1.storeUint(src.accrued_plato_fee_ton, 128);
        b_1.storeUint(src.private_page_count, 64);
        b_1.storeUint(src.public_page_count, 64);
        b_1.storeUint(src.private_entry_count, 64);
        b_1.storeUint(src.public_entry_count, 64);
        b_1.storeUint(src.last_private_entry_id, 64);
        b_1.storeUint(src.last_public_entry_id, 64);
        const b_2 = new Builder();
        b_2.storeUint(src.last_private_entry_uid, 256);
        b_2.storeUint(src.last_public_entry_uid, 256);
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
    const _accrued_plato_fee_ton = sc_1.loadUintBig(128);
    const _private_page_count = sc_1.loadUintBig(64);
    const _public_page_count = sc_1.loadUintBig(64);
    const _private_entry_count = sc_1.loadUintBig(64);
    const _public_entry_count = sc_1.loadUintBig(64);
    const _last_private_entry_id = sc_1.loadUintBig(64);
    const _last_public_entry_id = sc_1.loadUintBig(64);
    const sc_2 = sc_1.loadRef().beginParse();
    const _last_private_entry_uid = sc_2.loadUintBig(256);
    const _last_public_entry_uid = sc_2.loadUintBig(256);
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_page_count: _private_page_count, public_page_count: _public_page_count, private_entry_count: _private_entry_count, public_entry_count: _public_entry_count, last_private_entry_id: _last_private_entry_id, last_public_entry_id: _last_public_entry_id, last_private_entry_uid: _last_private_entry_uid, last_public_entry_uid: _last_public_entry_uid };
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
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _private_page_count = source.readBigNumber();
    const _public_page_count = source.readBigNumber();
    const _private_entry_count = source.readBigNumber();
    const _public_entry_count = source.readBigNumber();
    const _last_private_entry_id = source.readBigNumber();
    source = source.readTuple();
    const _last_public_entry_id = source.readBigNumber();
    const _last_private_entry_uid = source.readBigNumber();
    const _last_public_entry_uid = source.readBigNumber();
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_page_count: _private_page_count, public_page_count: _public_page_count, private_entry_count: _private_entry_count, public_entry_count: _public_entry_count, last_private_entry_id: _last_private_entry_id, last_public_entry_id: _last_public_entry_id, last_private_entry_uid: _last_private_entry_uid, last_public_entry_uid: _last_public_entry_uid };
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
    const _accrued_plato_fee_ton = source.readBigNumber();
    const _private_page_count = source.readBigNumber();
    const _public_page_count = source.readBigNumber();
    const _private_entry_count = source.readBigNumber();
    const _public_entry_count = source.readBigNumber();
    const _last_private_entry_id = source.readBigNumber();
    const _last_public_entry_id = source.readBigNumber();
    const _last_private_entry_uid = source.readBigNumber();
    const _last_public_entry_uid = source.readBigNumber();
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_page_count: _private_page_count, public_page_count: _public_page_count, private_entry_count: _private_entry_count, public_entry_count: _public_entry_count, last_private_entry_id: _last_private_entry_id, last_public_entry_id: _last_public_entry_id, last_private_entry_uid: _last_private_entry_uid, last_public_entry_uid: _last_public_entry_uid };
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
    builder.writeNumber(source.accrued_plato_fee_ton);
    builder.writeNumber(source.private_page_count);
    builder.writeNumber(source.public_page_count);
    builder.writeNumber(source.private_entry_count);
    builder.writeNumber(source.public_entry_count);
    builder.writeNumber(source.last_private_entry_id);
    builder.writeNumber(source.last_public_entry_id);
    builder.writeNumber(source.last_private_entry_uid);
    builder.writeNumber(source.last_public_entry_uid);
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
    const __code = Cell.fromHex('b5ee9c7241022b01000cc7000114ff00f4a413f4bcf2c80b0102016202280130d001d072d721d200d200fa4021103450666f04f86102f8620303feed44d0d200018e3ffa40fa40d200d200d3ffd401d0fa40d33fd33fd37fd33fd33fd33fd33fd33fd33fd430d0d3ffd3ff300c11110c0c11100c10cf10ce10cd57110f11100f550e8e27fa40fa40d200d200810101d700d401d0fa4030161514433006d155047054700054700054700020e21112e302705611d74920c21fe30004050602f411108020d7217021d749c21f9430d31f01de8210ff775609ba8f5ad37f01310f11100f10ef10de10cd10bc10ab109a10891078106710561045103411114130db3c813393f8425612c705f2f48133945612c200f2f4111118a00f11100f10ef10de10cd10bc10ab109a080910671056104510344130e05f0f5f03260f000e311111d31f111204c421821090e2e0cbba8fcf5b1110d3fffa4030011111011112db3cdb3c3f81326e0eb31ef2f481326f5610c300f2f48132702bc000923b7f940b5610bae21bf2f410df10de7f0e10bd0c109b108a107910681057104610354403e02182103a12d1adba08090f0704b88fd15b1110d3ff300f11100f10ef10de10cd10bc10ab109a10891078106710561045103411114130db3cdb3c3d8132785611c300f2f42b8132791112ba01111101f2f481327a2df2f410ef10de10cd7f0d550be02182107a0ebfefba08090f0a000e8132652eb3f2f40014813282f8422dc705f2f4043ce302218210dd65eef9bae302218210a4f862c0bae3022182108c2a76b7ba0b10151e03fc5b1110d307d307d3ffd3ffd3ffd37f301110111411100f11130f0e11120e0d11110d0c11140c0b11130b0a11120a0911110908111408071113070611120605111105041114040311130302111202011115011116db3c8132c82b843fb9f2f456118132c91116db3c01111501f2f48132ca5613c300f2f48132cb5612c30026170c03faf2f48132cc5615c300f2f40f11100f550e11135613db3c8132cd21c200f2f48132ce561722baf2f42b0f11120f0e11110e0d11100d0c11120c0b11110b0a11100a09111209081111080711100706111206051111050411100403111203021111020111100111127011125613db3c9782089896805713de11101111111018210d03f00f11100f550e1116db3c01111601a082080f4240a082083d0900a05611a08132cff8416f24135f0358bef2f40f11130f0e11120e0d11110d0c11100c553b0311140354411302111502011116db3c323304a41111c2009305a405de08a4111116a00d11100d10cf10be10ad109c108b1069081047030644451a0e0f0046c813cbffcbffcbffc9c88210d119010101cb1ff842cf1612cb3ff82301cb1fccc9f9000088c87f01ca001111111055e0011110011111ce1ece1cca001aca0018cbff06c8ce15cb3f13cb3fcb7fcb3fcb3f12cb3f12cb3f12cb3f12cb3f02c8cbff13cbffcdcdc9ed5402fe5b1110fa40d3ffd37f301110111111100f11110f0e11110e0d11110d0c11110c0b11110b0a11110a0911110908111108071111070611110605111105041111040311110302111102011112011113db3c81332c2a843fb9f2f481332df8425613c705f2f481332e5613c300f2f481332f561482084c4b40baf2f4290f11110f261104fe5e3d0c11100c0b11110b0a11100a09111109081110080711110706111006051111050411100403111103021110020111110111107011125611db3c9782089896805713de8208b71b005613a0813330f8416f24135f0358bef2f41110111211100f11110f0e11100e551d21011114011115db3c313203a41110c200e30007a421121314003cc88210d119010201cb1ff842cf1613cb3ff82301cb1f01cf16cbffc9f900000604a40400c6111116a00d11100d10cf10be10ad109c108b107a1079081047103645144013c87f01ca001111111055e0011110011111ce1ece1cca001aca0018cbff06c8ce15cb3f13cb3fcb7fcb3fcb3f12cb3f12cb3f12cb3f12cb3f02c8cbff13cbffcdcdc9ed5402fa5b1110d33f31d3ffd307d307d3ffd3ffd430d0d3ffd37f301110111511100f11140f0e11130e0d11120d0c11110c0b11150b0a11140a0911130908111208071111070611150605111405041113040311120302111102011116011117db3c8133f4f8425611c705f2f48133f52b843fb9f2f48133f65616c300f2f45614261603fe8133f71115db3c01111401f2f48133f85612c300f2f48133f95611c300f2f48133fa5616c300f2f40f11100f550e11125613db3c8133fb21c200f2f456178133fd02bbf2f42a0f11110f5e3d0c11100c0b11110b0a11100a091111090811100807111107061110060511110504111004031111030211100201111101111070171819003821c0019320c0019170e2925b7fe001c00292c002923070e2917fe070002a20c001963082084c4b40e0c002958208989680e07003fe11125611db3c9782089896805713de1110111111100f11100f550e1115db3c561801a082080f4240a082083d0900a05612a08209c9c380a08133fef8416f24135f0322bef2f41111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443056150356174313011116011119211a1b001cc0029582083d0900e082082dc6c002fcdb3c32335611544116a41112c2009307a407de0aa4111518a0f8416f24135f0311148209c9c380a101111401a111127011127009c855208210874e576a5004cb1f12cbffcb3fcbffc92e04031113030211120250884343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000b11100b10af109e108d107c106b106a1c1d0042c813cbffcbffcbffc9c88210d119020101cb1f5613cf1612cbff12cb3fccc9f900009c1049106847605e225502c87f01ca001111111055e0011110011111ce1ece1cca001aca0018cbff06c8ce15cb3f13cb3fcb7fcb3fcb3f12cb3f12cb3f12cb3f12cb3f02c8cbff13cbffcdcdc9ed5402e2e3022182107a861031bae3025712c0001111c12101111101b08e4f8136aff2f00e11100e551dc87f01ca001111111055e0011110011111ce1ece1cca001aca0018cbff06c8ce15cb3f13cb3fcb7fcb3fcb3f12cb3f12cb3f12cb3f12cb3f02c8cbff13cbffcdcdc9ed54e05f0f5bf2c0821f2502fe5b1110d33f31d3fffa40d3ffd37f301110111211105e3e0d11110d0c11120c0b11110b0a11120a0911110908111208071111070611120605111105041112040311110302111202011113011114db3c813458f8425611c705f2f48134592a843fb9f2f481345a5612c300f2f481345b5614c300f2f481345d561582084c4b40262002fabbf2f4290f11110f5e3d0c11100c0b11110b0a11100a09111109081110080711110706111006051111050411100403111103021110020111110111107011125611db3c9782089896805713de561682082dc6c0a082080f4240a082082dc6c0a05613a08209c9c380a081345ef8416f24135f0322bef2f41111111211112122000aa93807c00002fe1110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413021561502011117011118db3c313256122205a41112c2009306a406de09a4111518a0f8416f24135f0311148209c9c380a101111401a111117011137003c855208210874e576a5004cb1f12cbffcb3fcbffc92e04031112031113592324003ec858cf16cbffc9c88210d119020201cb1f5613cf1612cbff12cb3fccc9f90000ea4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000b11100b10af109e108d107c106b105a1069105847654433c87f01ca001111111055e0011110011111ce1ece1cca001aca0018cbff06c8ce15cb3f13cb3fcb7fcb3fcb3f12cb3f12cb3f12cb3f12cb3f02c8cbff13cbffcdcdc9ed5402fe5b1110d37f300f11100f10ef10de10cd10bc10ab109a10891078106710561045103411114130db3c813390561282084c4b40bef2f481339156122abbf2f4813392f8416f24135f038209e84800bef2f4085611a156118209c9c380a07f701114c8018210ff77560958cb1fcb7fc95613041115014343c8cf8580ca00cf84402627000c8132642ef2f400ccce01fa02806acf40f400c901fb000f11100f10ef10de10cd10bc10ab109a10895506c87f01ca001111111055e0011110011111ce1ece1cca001aca0018cbff06c8ce15cb3f13cb3fcb7fcb3fcb3f12cb3f12cb3f12cb3f12cb3f02c8cbff13cbffcdcdc9ed5402fba0a75bda89a1a400031c7ff481f481a401a401a7ffa803a1f481a67fa67fa6ffa67fa67fa67fa67fa67fa67fa861a1a7ffa7fe601822221818222018219e219c219aae221e22201eaa1d1c4ff481f481a401a401020203ae01a803a1f480602c2a2886600da2aa08e0a8e000a8e000a8e00041c5b678ae22ae22ae22ae23292a0038547dec547dcb5616561656135610561056105610561056105610561000345711571157115711571157115711571157115711571157115711accb63a7');
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
    {"name":"BindDeploymentManifest","header":2430787787,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"counterpart_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"SealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"PublishPrivateDirect","header":2047786991,"fields":[{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicDirect","header":3714445049,"fields":[{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushFees","header":2055606321,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubStateView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_private_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_public_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_private_entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"last_public_entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHub$Data","header":null,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"private_page_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_page_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_private_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_public_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_private_entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"last_public_entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
]

const CapsuleHub_opcodes = {
    "BindDeploymentManifest": 2430787787,
    "SealGenesis": 974311853,
    "PublishPrivateDirect": 2047786991,
    "PublishPublicDirect": 3714445049,
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "FlushFees": 2055606321,
    "DepositProtocolFee": 4286010889,
}

const CapsuleHub_getters: ABIGetter[] = [
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"CapsuleHubStateView","optional":false}},
]

export const CapsuleHub_getterMapping: { [key: string]: string } = {
    'get_state': 'getGetState',
}

const CapsuleHub_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPrivateDirect"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPublicDirect"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPrivateFromVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPublicFromVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushFees"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const PLATO_PRIVATE_STANDARD_FEE_TON = 5000000n;
export const PLATO_PRIVATE_LONG_TERM_FEE_TON = 10000000n;
export const PLATO_PUBLIC_POST_FEE_TON = 5000000n;
export const SIZE_CLASS_STANDARD = 1n;
export const SIZE_CLASS_LONG_TERM = 2n;
export const CRYPTO_SUITE_CLASSICAL = 1n;
export const CRYPTO_SUITE_HYBRID = 2n;
export const CAPSULEHUB_PAGE_SIZE = 256n;
export const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE = 4000000n;
export const CAPSULEHUB_PUBLIC_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 4000000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 3000000n;
export const CAPSULEHUB_PAGE_STORAGE_ENDOWMENT = 10000000n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_FEE_FLUSH_TON = 5000000n;
export const OP_BIND_DEPLOYMENT_MANIFEST = 2430787787n;
export const OP_SEAL_GENESIS = 974311853n;
export const ENTRY_UID_DOMAIN_DIRECT_PRIVATE = 3508076801n;
export const ENTRY_UID_DOMAIN_DIRECT_PUBLIC = 3508076802n;
export const ENTRY_UID_DOMAIN_VAULT_PRIVATE = 3508077057n;
export const ENTRY_UID_DOMAIN_VAULT_PUBLIC = 3508077058n;

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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | SealGenesis | PublishPrivateDirect | PublishPublicDirect | PublishPrivateFromVault | PublishPublicFromVault | FlushFees | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindDeploymentManifest') {
            body = beginCell().store(storeBindDeploymentManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPrivateDirect') {
            body = beginCell().store(storePublishPrivateDirect(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPublicDirect') {
            body = beginCell().store(storePublishPublicDirect(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPrivateFromVault') {
            body = beginCell().store(storePublishPrivateFromVault(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishPublicFromVault') {
            body = beginCell().store(storePublishPublicFromVault(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FlushFees') {
            body = beginCell().store(storeFlushFees(message)).endCell();
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
        const result = loadGetterTupleCapsuleHubStateView(source);
        return result;
    }
    
}