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

export type PruneCapsuleEntry = {
    $$type: 'PruneCapsuleEntry';
    kind: bigint;
    entry_id: bigint;
    publish_id: bigint;
}

export function storePruneCapsuleEntry(src: PruneCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129337422, 32);
        b_0.storeUint(src.kind, 8);
        b_0.storeUint(src.entry_id, 64);
        b_0.storeUint(src.publish_id, 256);
    };
}

export function loadPruneCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129337422) { throw Error('Invalid prefix'); }
    const _kind = sc_0.loadUintBig(8);
    const _entry_id = sc_0.loadUintBig(64);
    const _publish_id = sc_0.loadUintBig(256);
    return { $$type: 'PruneCapsuleEntry' as const, kind: _kind, entry_id: _entry_id, publish_id: _publish_id };
}

export function loadTuplePruneCapsuleEntry(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _entry_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    return { $$type: 'PruneCapsuleEntry' as const, kind: _kind, entry_id: _entry_id, publish_id: _publish_id };
}

export function loadGetterTuplePruneCapsuleEntry(source: TupleReader) {
    const _kind = source.readBigNumber();
    const _entry_id = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    return { $$type: 'PruneCapsuleEntry' as const, kind: _kind, entry_id: _entry_id, publish_id: _publish_id };
}

export function storeTuplePruneCapsuleEntry(source: PruneCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.kind);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.publish_id);
    return builder.build();
}

export function dictValueParserPruneCapsuleEntry(): DictionaryValue<PruneCapsuleEntry> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePruneCapsuleEntry(src)).endCell());
        },
        parse: (src) => {
            return loadPruneCapsuleEntry(src.loadRef().beginParse());
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
        b_4.storeInt(src.index_storage_reserve_ton, 257);
        const b_5 = new Builder();
        b_5.storeInt(src.protected_reserve_ton, 257);
        b_5.storeInt(src.reserve_floor_ton, 257);
        b_5.storeInt(src.reserve_buffer_numerator, 257);
        const b_6 = new Builder();
        b_6.storeInt(src.reserve_buffer_denominator, 257);
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
    const _index_storage_reserve_ton = sc_4.loadIntBig(257);
    const sc_5 = sc_4.loadRef().beginParse();
    const _protected_reserve_ton = sc_5.loadIntBig(257);
    const _reserve_floor_ton = sc_5.loadIntBig(257);
    const _reserve_buffer_numerator = sc_5.loadIntBig(257);
    const sc_6 = sc_5.loadRef().beginParse();
    const _reserve_buffer_denominator = sc_6.loadIntBig(257);
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_page_count: _private_page_count, public_page_count: _public_page_count, page_size: _page_size, index_storage_years: _index_storage_years, index_retention_seconds: _index_retention_seconds, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_live_count: _private_live_count, public_live_count: _public_live_count, index_storage_reserve_ton: _index_storage_reserve_ton, protected_reserve_ton: _protected_reserve_ton, reserve_floor_ton: _reserve_floor_ton, reserve_buffer_numerator: _reserve_buffer_numerator, reserve_buffer_denominator: _reserve_buffer_denominator };
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
    const _index_storage_reserve_ton = source.readBigNumber();
    const _protected_reserve_ton = source.readBigNumber();
    const _reserve_floor_ton = source.readBigNumber();
    const _reserve_buffer_numerator = source.readBigNumber();
    const _reserve_buffer_denominator = source.readBigNumber();
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_page_count: _private_page_count, public_page_count: _public_page_count, page_size: _page_size, index_storage_years: _index_storage_years, index_retention_seconds: _index_retention_seconds, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_live_count: _private_live_count, public_live_count: _public_live_count, index_storage_reserve_ton: _index_storage_reserve_ton, protected_reserve_ton: _protected_reserve_ton, reserve_floor_ton: _reserve_floor_ton, reserve_buffer_numerator: _reserve_buffer_numerator, reserve_buffer_denominator: _reserve_buffer_denominator };
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
    const _index_storage_reserve_ton = source.readBigNumber();
    const _protected_reserve_ton = source.readBigNumber();
    const _reserve_floor_ton = source.readBigNumber();
    const _reserve_buffer_numerator = source.readBigNumber();
    const _reserve_buffer_denominator = source.readBigNumber();
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_page_count: _private_page_count, public_page_count: _public_page_count, page_size: _page_size, index_storage_years: _index_storage_years, index_retention_seconds: _index_retention_seconds, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address, private_live_count: _private_live_count, public_live_count: _public_live_count, index_storage_reserve_ton: _index_storage_reserve_ton, protected_reserve_ton: _protected_reserve_ton, reserve_floor_ton: _reserve_floor_ton, reserve_buffer_numerator: _reserve_buffer_numerator, reserve_buffer_denominator: _reserve_buffer_denominator };
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
    sender_prev_link: bigint;
    recipient_prev_link: bigint;
    header_0: Cell;
    header_1: Cell;
}

export function storePrivateCapsuleEntry(src: PrivateCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.created_at, 32);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeUint(src.sender_prev_link, 64);
        b_0.storeUint(src.recipient_prev_link, 64);
        b_0.storeRef(src.header_0);
        b_0.storeRef(src.header_1);
    };
}

export function loadPrivateCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _publish_id = sc_0.loadUintBig(256);
    const _created_at = sc_0.loadUintBig(32);
    const _body_hash = sc_0.loadUintBig(256);
    const _sender_prev_link = sc_0.loadUintBig(64);
    const _recipient_prev_link = sc_0.loadUintBig(64);
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    return { $$type: 'PrivateCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, sender_prev_link: _sender_prev_link, recipient_prev_link: _recipient_prev_link, header_0: _header_0, header_1: _header_1 };
}

export function loadTuplePrivateCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _sender_prev_link = source.readBigNumber();
    const _recipient_prev_link = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'PrivateCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, sender_prev_link: _sender_prev_link, recipient_prev_link: _recipient_prev_link, header_0: _header_0, header_1: _header_1 };
}

export function loadGetterTuplePrivateCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _sender_prev_link = source.readBigNumber();
    const _recipient_prev_link = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    return { $$type: 'PrivateCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, body_hash: _body_hash, sender_prev_link: _sender_prev_link, recipient_prev_link: _recipient_prev_link, header_0: _header_0, header_1: _header_1 };
}

export function storeTuplePrivateCapsuleEntry(source: PrivateCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.body_hash);
    builder.writeNumber(source.sender_prev_link);
    builder.writeNumber(source.recipient_prev_link);
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
    author_wallet: Address;
    body_hash: bigint;
    header: Cell;
}

export function storePublicCapsuleEntry(src: PublicCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.publish_id, 256);
        b_0.storeUint(src.created_at, 32);
        b_0.storeAddress(src.author_wallet);
        b_0.storeUint(src.body_hash, 256);
        b_0.storeRef(src.header);
    };
}

export function loadPublicCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _publish_id = sc_0.loadUintBig(256);
    const _created_at = sc_0.loadUintBig(32);
    const _author_wallet = sc_0.loadAddress();
    const _body_hash = sc_0.loadUintBig(256);
    const _header = sc_0.loadRef();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, author_wallet: _author_wallet, body_hash: _body_hash, header: _header };
}

export function loadTuplePublicCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, author_wallet: _author_wallet, body_hash: _body_hash, header: _header };
}

export function loadGetterTuplePublicCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, author_wallet: _author_wallet, body_hash: _body_hash, header: _header };
}

export function storeTuplePublicCapsuleEntry(source: PublicCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.body_hash);
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
    sender_prev_link: bigint;
    recipient_prev_link: bigint;
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
        b_0.storeInt(src.sender_prev_link, 257);
        b_0.storeInt(src.recipient_prev_link, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.entry_uid, 257);
        b_1.storeInt(src.publish_id, 257);
        b_1.storeAddress(src.author_wallet);
        const b_2 = new Builder();
        b_2.storeInt(src.page_id, 257);
        b_2.storeInt(src.page_offset, 257);
        b_2.storeInt(src.created_at, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.header_0_hash, 257);
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
    const _sender_prev_link = sc_0.loadIntBig(257);
    const _recipient_prev_link = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _entry_uid = sc_1.loadIntBig(257);
    const _publish_id = sc_1.loadIntBig(257);
    const _author_wallet = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _page_id = sc_2.loadIntBig(257);
    const _page_offset = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _header_0_hash = sc_3.loadIntBig(257);
    const _header_1_hash = sc_3.loadIntBig(257);
    const _body_hash = sc_3.loadIntBig(257);
    const _header_0 = sc_3.loadRef();
    const _header_1 = sc_3.loadRef();
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, sender_prev_link: _sender_prev_link, recipient_prev_link: _recipient_prev_link, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadTuplePrivateCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _sender_prev_link = source.readBigNumber();
    const _recipient_prev_link = source.readBigNumber();
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
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, sender_prev_link: _sender_prev_link, recipient_prev_link: _recipient_prev_link, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function loadGetterTuplePrivateCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _sender_prev_link = source.readBigNumber();
    const _recipient_prev_link = source.readBigNumber();
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
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, sender_prev_link: _sender_prev_link, recipient_prev_link: _recipient_prev_link, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1 };
}

export function storeTuplePrivateCapsuleEntryView(source: PrivateCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.sender_prev_link);
    builder.writeNumber(source.recipient_prev_link);
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

export type PrivateCapsuleKeyIndexView = {
    $$type: 'PrivateCapsuleKeyIndexView';
    exists: boolean;
    key_id: bigint;
    latest_entry_id: bigint;
    latest_entry_link: bigint;
    entry_count: bigint;
}

export function storePrivateCapsuleKeyIndexView(src: PrivateCapsuleKeyIndexView) {
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

export function loadPrivateCapsuleKeyIndexView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _key_id = sc_0.loadIntBig(257);
    const _latest_entry_id = sc_0.loadIntBig(257);
    const _latest_entry_link = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _entry_count = sc_1.loadIntBig(257);
    return { $$type: 'PrivateCapsuleKeyIndexView' as const, exists: _exists, key_id: _key_id, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadTuplePrivateCapsuleKeyIndexView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _latest_entry_id = source.readBigNumber();
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PrivateCapsuleKeyIndexView' as const, exists: _exists, key_id: _key_id, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function loadGetterTuplePrivateCapsuleKeyIndexView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _latest_entry_id = source.readBigNumber();
    const _latest_entry_link = source.readBigNumber();
    const _entry_count = source.readBigNumber();
    return { $$type: 'PrivateCapsuleKeyIndexView' as const, exists: _exists, key_id: _key_id, latest_entry_id: _latest_entry_id, latest_entry_link: _latest_entry_link, entry_count: _entry_count };
}

export function storeTuplePrivateCapsuleKeyIndexView(source: PrivateCapsuleKeyIndexView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.latest_entry_id);
    builder.writeNumber(source.latest_entry_link);
    builder.writeNumber(source.entry_count);
    return builder.build();
}

export function dictValueParserPrivateCapsuleKeyIndexView(): DictionaryValue<PrivateCapsuleKeyIndexView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePrivateCapsuleKeyIndexView(src)).endCell());
        },
        parse: (src) => {
            return loadPrivateCapsuleKeyIndexView(src.loadRef().beginParse());
        }
    }
}

export type PublicCapsuleEntryView = {
    $$type: 'PublicCapsuleEntryView';
    exists: boolean;
    entry_id: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    author_wallet: Address;
    page_id: bigint;
    page_offset: bigint;
    created_at: bigint;
    header_hash: bigint;
    body_hash: bigint;
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
        b_1.storeAddress(src.author_wallet);
        b_1.storeInt(src.page_id, 257);
        b_1.storeInt(src.page_offset, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.created_at, 257);
        b_2.storeInt(src.header_hash, 257);
        b_2.storeInt(src.body_hash, 257);
        b_2.storeRef(src.header);
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
    const _author_wallet = sc_1.loadAddress();
    const _page_id = sc_1.loadIntBig(257);
    const _page_offset = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _created_at = sc_2.loadIntBig(257);
    const _header_hash = sc_2.loadIntBig(257);
    const _body_hash = sc_2.loadIntBig(257);
    const _header = sc_2.loadRef();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, header: _header };
}

export function loadTuplePublicCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _page_id = source.readBigNumber();
    const _page_offset = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, header: _header };
}

export function loadGetterTuplePublicCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _page_id = source.readBigNumber();
    const _page_offset = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, header: _header };
}

export function storeTuplePublicCapsuleEntryView(source: PublicCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.page_id);
    builder.writeNumber(source.page_offset);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
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
    private_sender_index: Dictionary<bigint, PrivateCapsuleKeyIndex>;
    private_recipient_index: Dictionary<bigint, PrivateCapsuleKeyIndex>;
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
        b_1.storeDict(src.private_sender_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex());
        b_1.storeDict(src.private_recipient_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex());
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
    const _private_sender_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), sc_1);
    const _private_recipient_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), sc_1);
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_sender_index: _private_sender_index, private_recipient_index: _private_recipient_index };
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
    const _private_sender_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    const _private_recipient_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_sender_index: _private_sender_index, private_recipient_index: _private_recipient_index };
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
    const _private_sender_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    const _private_recipient_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_sender_index: _private_sender_index, private_recipient_index: _private_recipient_index };
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
    builder.writeCell(source.private_sender_index.size > 0 ? beginCell().storeDictDirect(source.private_sender_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex()).endCell() : null);
    builder.writeCell(source.private_recipient_index.size > 0 ? beginCell().storeDictDirect(source.private_recipient_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex()).endCell() : null);
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
    const __code = Cell.fromHex('b5ee9c7241027301001e2d000114ff00f4a413f4bcf2c80b01020162024302f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e2efa40fa40d200d200d3ffd401d0fa40d33fd33fd33fd33fd37ff404f404f404f4043010af10ae10ad10ac10ab6c1f8e25fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6de21110e302702f0305013a0e8020d7217021d749c21f9430d31f01de8210ff775609bae3025f0f300401fed37f013110de10cd10bc10ab109a108910781067105610451034413fdb3c813393f8425610c705f2f48133945610c200f2f4504fa010de10cd10bc10ab109a1089107810671056044135c87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed54370466d74920c21f96310fd31f1110de21821090e2e0cbbae3022182103a12d1adbae302218210a4f862c0bae3022182108c2a76b7ba06080b2104b45b0ed3fffa403011101fdb3cdb3c81326e2db3f2f481326f5610c300f2f48132702bc000917f942b5611bae2f2f455d08132710f5611db3c3b3c3c50d8f2f4813272f82852f0c705b3f2f410ad10ac7f0c108b108a1069552512090a0741000afa4430c00002f25b0ed3ff3010de10cd10bc10ab109a108910781067105610451034413fdb3cdb3c3b8132782fc300f2f4298132791110ba1ff2f481327a2bf2f410cd10bc10ab7f0b5509c87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed54090a000e8132652cb3f2f40014813282f8422bc705f2f403fe5b0ed33f31d39f31d3ffd307d307d3ffd430d0d3ffd3ffd4d4d4d37f300e11160e0d11150d0c11140c0b11130b0a11120a0911110908111008107f0611160605111505041114040311130302111202011117011118db3c8133f4f8422fc705f2f48133f529843fb9f2f48133f65612c300f2f455d08133f70f56115611db3c370c0d018e0f11100f0e11100e0d11100d0c11100c0b11100b0a11100a0911100911100807065540db3c930fc002923f70e210ef10de10cd10bc10ab109a10891078106710561045103441302f03fc01111001f2f48133f85617c300f2f48133f95616c300f2f48133fa5615c300f2f4550d72810460718133ff561704561b4434813400db3c718100f070813401561604561a4434813402db3c547edc547edc547edc547edc547edc0e111d0e0d111c0d0c111b0c0b111a0b0a11190a0911180908111708071116070611150616160e04c605111405041113040311120302111102011110010f561f561fdb3c55e056205620db3c55e056215621db3c6cf11111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103403111a0356175520813403813404110f10150108db3caa02120106db3ca5110110db3ca67e807fa9041202c20f11100f0e11100e0d11100d0c11100c0b11100b0a11100a091110090811100807111007061110060511100504111004031110030211100201111001db3c1110db3c01111001a010ef10de10cd10bc10ab109a10891078106710561045103441301314001681328e01c002f2f48104b4015655d181328d11102fdb3c01111101f2f40eaa0910df10ce10bd10ac109b108a1079106810571046103544302f04d0db3c5616db3c8133fb21c200f2f456188133fd02bbf2f4280f11100f10ef10de10cd10bc10ab109a10891078106710561045103411174130db3c561701a082080f4240a08208325aa0a08209c9c380a08133fef8416f24135f0358bef2f455d08209c9c3800f56161617181b00dc8e6726f9005006baf2f423561456145614561456145614561456145614561456145614561456145614ed41ed43ed44ed45ed47945b0ff2f0ed67ed65ed64ed63ed6180107fed118e175142f9415024ba5240f2f401ba5220f2f458baf2f455d0ed41edf101f2ff550d80167fdb380014c002958208989680e07003f60d11100d10cf10be0a11100a109f108e07111007106f105e04111004103f102e011110010f81328b0f5611db3c01111001f2f481328c1110c00201111001f2f42fc001983f552b8208401640e02fc002983f552b8208419ce0e02fc004983f552b820844aa20e02fc008983f552b82084c4b40e00fc010e302552b2f191a000e552b8208588040000a820873f7800424db3c55e05613db3c55e05614db3c11105611393a3b1c04dadb3c0f11100f10ef10de10cd10bc10ab109a10891078106710561045103411114130db3c0f11100f10ef10de10cd10bc10ab109a10891078106710561045103441305618025613020111190111185617db3c8040f82356135056041117040311190302111802011116011115c81d1e6a1f00962383072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc910354150206e953059f45b30944133f417e20200962283072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc910344140206e953059f45b30944133f417e20101fc55605067cbff14cb1f12cbffcb3fcb3fccccc91201111201561401206e953059f45b30944133f417e204a402a4011110011113a07011121c711112c855208210874e576a5004cb1f12cbffcb3fcbffc92804103b021112021111014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00105e104d103c4ba9104820007a1067105610254400c87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed5404fe8ffc5b0ed33f31d39f31d3ffd307d397fa40d430d0d3ffd3ffd4d4d37f300e11150e0d11140d0c11130c0b11120b0a11110a09111009108f071115070611140605111305041112040311110302111002011116011117db3c813458f8422fc705f2f481345928843fb9f2f481345a5610c300f2f455d08134650f5616db3ce0372e223103fc01111001f2f481345f1115828873656e742076696120506c6174686f2e417070ba01111501f2f48134625612c300f2f481345b5611c300f2f410ce10bd10ac109b108a10791068105710461035401411135003813463813464561102561402db3c550e1115813460813461561202561702db3c81345d56168208989680bb23252c010c8a80137fdb382400f423f9005003baf2f420561156115611561156115611561156115611561156115611561156115611ed41ed43ed44ed45ed47945b0ff2f0ed67ed65ed64ed63ed6180107fed118e2a0171f94102c1025230f2f420c2005230f2f420810240bb5230f2f4a93802c0005220f2f4c101f2f455d0ed41edf101f2ff550d01ac8ecf24f9005004baf2f421561256125612561256125612561256125612561256125612561256125612ed41ed43ed44ed45ed47945b0ff2f0ed67ed65ed64ed63ed6180107fed118aed41edf101f2ff550d80147fdb382604fe0e11110e0d11100d10cf0b11110b0a11100a109f0811110807111007106f0511110504111004103f021111020111100151ffdb3c01111201f9410e11100e5e3c10bf0a11100a109f08111008107f06111006105f04111004103f0211100211131f5611db3c01111101bb561201f2f42ec200561201f2f4550e5610db3c56102a2a27280108db3caa022b014401bb561201f2f40fa93802c000561101f2f410df551cdb3c01111101bb1ff2f4550c290106db3ca52a0110db3ca67e807fa9042b015655d181329611102fdb3c01111101f2f40eaa0910df10ce10bd10ac109b108a1079106810571046103544302e03fef2f4271114db3c561601a082080f4240a0820870ea40a08209c9c380a081345ef8416f24135f0358bef2f45613561356138209c9c38011145613db3c8040f8235615503402111502011113011118c855405045cbff12cb1fcecbffccc901111101561301206e953059f45b30944133f417e205a403a4111312a00f701111712d493001c655d181329511102fdb3c01111101f2f42ec0019a3e10ce551b8208249f00e02ec0029a3e10ce551b8208419ce0e02ec0049a3e10ce551b820844aa20e02ec0089a3e10ce551b82084c4b40e00ec0109910ce551b8208588040e010ce551b820873f7802e0104db3c2f004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e200fe0ec855208210874e576a5004cb1f12cbffcb3fcbffc92a04103e0211110250dd4343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00107e106d105c104b103a40890705503306c87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed5404da2182107a861031bae3022182105331b880ba8e3b5b3e10ce551bc87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed54e021821053575052bae3022182104350524ebae3025710c0000fc1211fb03234364203f85b0ed37f3010de10cd10bc10ab109a108910781067105610451034413fdb3c8133905610c200f2f4813391561026bbf2f481339556108208989680be917f94561026bae2f2f4813392f8416f24135f0382083d0900bef2f4f8276f10f8416f24135f03a155d18133961110db3c01111001be01111001f2f4512fa12f375033019882081e8480a07f711112c8018210ff77560958cb1fcb7fc92f041113014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0010be10ad109c108b107a1069105810471036102541434103f45b0ed37f3010de10cd10bc10ab109a108910781067105610451034413fdb3c8133a45610c200f2f48133a556108208989680bef2f48133a6f8416f24135f0382083d0900bef2f4f8276f10f8416f24135f03a155e0db3c8133a7561122bcf2f401111001a156108133a802bbf2f42f82081e8480a07f711112c837503500c6018210ff77560958cb1fcb7fc95610041113014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00551cc87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed5404ae5b0ed307d33fd3ff3010ef10df10cf10bf10af109f108f107f106f105f104f103f102f011110011111db3c8134daf8416f24135f0382081e8480bef2f42fc001e30f10de10cd10bc10ab109a108910780607104510345837383f41000c8132642cf2f404fe3f228040561159f40f6fa192306ddf206e92306d8e13d0d3ffd31fd3ffd33fd33fd4d455606c176f07e28134bc216eb3f2f46f273033048134bd1116ba01111501f2f48134bef823038209e13380a013be12f2f410ef10df10cf10bf10af1f111019181716151443305611db3c55e05611db3c1112db3c0f11100f10ef10de393a3b3c0002a4000ed0d33f31d3ff300014d0d33f31d3ff31d3ff30027810cd10bc10ab109a1089107810671056104510344130011112015612011115db3c0e11110e0d11100d10cf552b02111202db3c50f38040f45b3005a53d3e00c42483072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3b6f225214ba91309131e221c2009301a501de218e1c830702c85902cb3fcb3fc9103412206e953059f45b30944133f417e2975b588307f45b30e201925f04e200be2383072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e386f225214ba91309131e221c2009301a501de218e1a830702c85902cb3fcb3fc912206e953059f45b30944133f417e2975b018307f45b30e2925f04e201fe0fc0028e5f218040561159f40f6fa192306ddf206e92306d8e10d0d3ffd31ffa40d3ffd455406c156f05e28134c6216eb3f2f46f255f03018134c71113ba01111201f2f48134c8f82311128209e13380a001111201be01111101f2f41e8040f45b3002a59a3f3f8134d0f2f00d4e1ee210bd10ac109b108a10791068105704400006466603006ac87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed54008c8e3e8136aff2f010ce551bc87f01ca0055e050efce1cce1aca0018ca0016cbff04c8ce13cb3fcb3fcb3f12cb3f12cb7f12f40012f40012f40012f400cdc9ed54e05f0ff2c082020120445b020120454b01d1b8090ed44d0d200018e2efa40fa40d200d200d3ffd401d0fa40d33fd33fd33fd33fd37ff404f404f404f4043010af10ae10ad10ac10ab6c1f8e25fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6de2550edb3c6cbb6c4b84604f02380402259f40f6fa192306ddf206e92306d8e10d0d3ffd31ffa40d3ffd455406c156f05e2206ee3026f2520f9000d11150d0c11140c0b11130b0a11120a0911110908111008107f106e051115050411140403111303021112020111110111107f11102f5617561656145617db3c55e05610db3c55e0561147496c4a04fc30707020f8280e11130e0d11120d0c11110c0b11100b10af09111309081112080711110706111006105f041113040311120302111102011110010f5613db3c55e05614db3c56125300880a11180a09111909081117080711160706111506051114051113111911131112111811121111111711111110111611100f11150f6c6d694800200e11140e0d11130d0c11120c5e5b5e2b0044c85003cf16cbffcbffc9c88210d119020201cb1f5611cf1612cbff12cb3fccc9f90001bedb3c0a11130a09111209081111080711190706111706051110050403111803021114020111160111150f11190f0e11180e0d11170d0c11160c0b11150b1113111411131112111311121111111211110f11110f0d11100d10df10be10bd10bc6d0201204c590201584d5602f9add6f6a268690000c7177d207d206900690069ffea00e87d20699fe99fe99fe99fe9bffa027a027a027a021808578857085688560855b60fc712fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6f16d9e2b8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8ac04e5503f2547bca53ba0e11130e0d11120d0c11110c0b11100b10af0911130956120908111208071111070611100605111405040311120302111102011110011113db3c10ef10df10cf10bf10af109f108f2f55701110db3c8307718209e133802856135613561053ed0e11180e0d11170d0c11160c0b11150b0a11140a62624f03fa09111309081112080711110706111006105f041118040311170302111602011115011114db3c55e0db3c1111112011111110111f11100f111e0f0e111d0e0d111c0d0c111b0c0b11150b0a11140a09111309081112080711200706111a060511190504111804031117030211160201111f018218174876e800807d80645150540126db3c8218174876e8005cbc91309131e25250a051028e2655e0db3c01111001a82510ef10df10cf10bf10af1f11101918171615144330db3c01111101a81fa0a77d8064a90410df10ce10bd10ac109b108a1079106810571046103544305253000a8208419ce0000a8208802c80009c112111231121112011221120111f1121111f111e1120111e1118111f11181117111e11171116111d11161115111c11151118111b11181116111a111611151119111511161117111611151116111500365715571505111405041113040311120302111102011110010f558501cdaf9bf6a268690000c7177d207d206900690069ffea00e87d20699fe99fe99fe99fe9bffa027a027a027a021808578857085688560855b60fc712fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6f12a876d9e367bc05703f610ef10df10cf10bf10af109f108f2f5570201111db3c8e44705610aa075611aa077053001056051115051114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078e155d07f0f5610db3c10ef10df10cf10bf10af109f108f2f5570561201111161645802a8db3c10ef10df10cf10bf10af109f108f2f55705613011111db3c7020061114060511150504111304031112031111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c5e371078636001cdb6f89da89a1a400031c5df481f481a401a401a7ffa803a1f481a67fa67fa67fa67fa6ffe809e809e809e80860215e215c215a21582156d83f1c4bf481f481a401a401020203ae01a803a1f480602c2a2886600da2aa08e0a8e00040dadadadbc4aa1db678d9eb05a02f62283072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f220d11110d0c11100c10bf10ae0911110908111008107f106e0511110504111004103f102e0111110111107f11105612db3c0411110403111003020111130111120f11130f0e11120e0d11110d0c11100c71720201205c6f0201625d6501cdadd8f6a268690000c7177d207d206900690069ffea00e87d20699fe99fe99fe99fe9bffa027a027a027a021808578857085688560855b60fc712fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6f12a876d9e367bc05e04f610ef10df10cf10bf10af109f2f5580201111db3c8e44705610aa075611aa077053001056051115051114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078e155d07f0f5610db3c10ef10df10cf10bf10af109f2f55805612011111db3c10ef6164635f019c10df10cf10bf10af109f2f55805613011111db3c7020061114060511150504111304031112031111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c5e3710786003b00e11100e5e3c10bf0a11100a109f08111008107f06111006105f04111004103f1110541f2f5611db3c936c2f70e1550e201111db3c1110db3c01111001a110ef10de10cd10bc10ab109a108910781067105610451034413061636401d021c2ff8ec30f11100f0e11100e0d11100d0c11100c0b11100b0a11100a091110090811100807111007061110060511100504111004031110030211100201111001db3c01111001b9945b55d070e210ef10de10cd10bc10ab109a108910781067105610451034413062001220923070e1a5ab07a4001601a4aa075301bc9130e0310004aa0701cdae30f6a268690000c7177d207d206900690069ffea00e87d20699fe99fe99fe99fe9bffa027a027a027a021808578857085688560855b60fc712fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6f12a876d9e367fc06603f42480402259f40f6fa192306ddf206e92306d8e13d0d3ffd31fd3ffd33fd33fd4d455606c176f07e2206ee3026f2721f90021f9000d11180d0c11170c0b11160b0a11150a0911140908111308071112070611110605111005104f103e021118020111170111167f111656155615561a561a5616db3c2e0e11100e676a6b049a307070547000f8280e11150e0d11140d0c11130c0b11120b0a11110a09111009108f07111507061114060511130504111204031111030211100211151f5614db3c55e05615db3c5611547000886c6d696801d6880e111b0e0d111c0d0c111a0c0b11190b0a11180a0911170908111d08071116071115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f1113111611131114111511141112111411121111111311111110111211100f11110f6900000042c813cbffcbffcbffc9c88210d119020101cb1f5611cf1612cbff12cb3fccc9f90003fa5e3c10bf0a11100a109f08111008107f06111006105f04111004103f111050f25617db3c55e05618db3c0e111a0e0d11190d0c11150c0b11140b0a11110a091118090811120807111007060511170504111c0403111b030211160201111301111d0f111d0f111a111c111a1119111b11191115111a11151114111911146c6d6e0004ab070006a9380700581111111811111111111711111112111611121110111511100f11140f1111111311111110111211100f11110f01cdb8b2fed44d0d200018e2efa40fa40d200d200d3ffd401d0fa40d33fd33fd33fd33fd37ff404f404f404f4043010af10ae10ad10ac10ab6c1f8e25fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6de2550edb3c6cf587002f62183072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f220d11110d0c11100c10bf10ae0911110908111008107f106e0511110504111004103f102e0111110111107f11105612db3c0411110403111003020111130111120f11130f0e11120e0d11110d0c11100c71720002a5002410bf10ae109d108c107b106a105910581057a43f9870');
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
    {"name":"PublishPrivateFromVault","header":2767741632,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushFees","header":2055606321,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"TopUpStorageReserve","header":1395767424,"fields":[]},
    {"name":"SweepExcessReserve","header":1398231122,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PruneCapsuleEntry","header":1129337422,"fields":[{"name":"kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CapsuleHubStateView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_size","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_storage_years","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_retention_seconds","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_storage_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"protected_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_floor_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_buffer_numerator","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_buffer_denominator","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHubPageView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"first_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"opened_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PrivateCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sender_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"recipient_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sender_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PrivateCapsuleKeyIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PublicCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"CapsuleHub$Data","header":null,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"private_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PrivateCapsuleEntry","valueFormat":"ref"}},{"name":"public_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleEntry","valueFormat":"ref"}},{"name":"private_sender_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PrivateCapsuleKeyIndex","valueFormat":"ref"}},{"name":"private_recipient_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PrivateCapsuleKeyIndex","valueFormat":"ref"}}]},
]

const CapsuleHub_opcodes = {
    "BindDeploymentManifest": 2430787787,
    "SealGenesis": 974311853,
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "FlushFees": 2055606321,
    "TopUpStorageReserve": 1395767424,
    "SweepExcessReserve": 1398231122,
    "DepositProtocolFee": 4286010889,
    "PruneCapsuleEntry": 1129337422,
}

const CapsuleHub_getters: ABIGetter[] = [
    {"name":"get_private_entry","methodId":101473,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleEntryView","optional":false}},
    {"name":"get_private_sender_index","methodId":96196,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleKeyIndexView","optional":false}},
    {"name":"get_private_recipient_index","methodId":117551,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleKeyIndexView","optional":false}},
    {"name":"get_public_entry","methodId":65680,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicCapsuleEntryView","optional":false}},
    {"name":"get_private_page","methodId":99249,"arguments":[{"name":"pageId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"CapsuleHubPageView","optional":false}},
    {"name":"get_public_page","methodId":89911,"arguments":[{"name":"pageId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"CapsuleHubPageView","optional":false}},
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"CapsuleHubStateView","optional":false}},
]

export const CapsuleHub_getterMapping: { [key: string]: string } = {
    'get_private_entry': 'getGetPrivateEntry',
    'get_private_sender_index': 'getGetPrivateSenderIndex',
    'get_private_recipient_index': 'getGetPrivateRecipientIndex',
    'get_public_entry': 'getGetPublicEntry',
    'get_private_page': 'getGetPrivatePage',
    'get_public_page': 'getGetPublicPage',
    'get_state': 'getGetState',
}

const CapsuleHub_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPrivateFromVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPublicFromVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushFees"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SweepExcessReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PruneCapsuleEntry"}},
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
export const CAPSULEHUB_PRIVATE_HYBRID_1K_EXEC_RESERVE = 4200000n;
export const CAPSULEHUB_PRIVATE_HYBRID_2K_EXEC_RESERVE = 4300000n;
export const CAPSULEHUB_PRIVATE_HYBRID_4K_EXEC_RESERVE = 4500000n;
export const CAPSULEHUB_PRIVATE_HYBRID_8K_EXEC_RESERVE = 5000000n;
export const CAPSULEHUB_PRIVATE_HYBRID_16K_EXEC_RESERVE = 5800000n;
export const CAPSULEHUB_PRIVATE_HYBRID_32K_EXEC_RESERVE = 7600000n;
export const CAPSULEHUB_PUBLIC_1K_EXEC_RESERVE = 2400000n;
export const CAPSULEHUB_PUBLIC_2K_EXEC_RESERVE = 4300000n;
export const CAPSULEHUB_PUBLIC_4K_EXEC_RESERVE = 4500000n;
export const CAPSULEHUB_PUBLIC_8K_EXEC_RESERVE = 5000000n;
export const CAPSULEHUB_PUBLIC_16K_EXEC_RESERVE = 5800000n;
export const CAPSULEHUB_PUBLIC_32K_EXEC_RESERVE = 7600000n;
export const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 3300000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 7400000n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_FEE_FLUSH_TON = 10000000n;
export const CAPSULEHUB_MIN_PROTECTED_RESERVE_TON = 100000000000n;
export const CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR = 125n;
export const CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR = 100n;
export const CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_RESERVE_SWEEP_TON = 10000000n;
export const CAPSULEHUB_PRUNE_ENTRY_EXEC_RESERVE = 2000000n;
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
export const ENTRY_UID_DOMAIN_VAULT_PRIVATE = 3508077057n;
export const ENTRY_UID_DOMAIN_VAULT_PUBLIC = 3508077058n;
export const CAPSULEHUB_ENTRY_KIND_PRIVATE = 1n;
export const CAPSULEHUB_ENTRY_KIND_PUBLIC = 2n;
export const PLATHO_PUBLIC_MARKETING_NOTE_ASCII = 2573421624129493433291659589718684717235138672n;

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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | SealGenesis | PublishPrivateFromVault | PublishPublicFromVault | FlushFees | TopUpStorageReserve | SweepExcessReserve | PruneCapsuleEntry | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindDeploymentManifest') {
            body = beginCell().store(storeBindDeploymentManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
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
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TopUpStorageReserve') {
            body = beginCell().store(storeTopUpStorageReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SweepExcessReserve') {
            body = beginCell().store(storeSweepExcessReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PruneCapsuleEntry') {
            body = beginCell().store(storePruneCapsuleEntry(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetPrivateEntry(provider: ContractProvider, entryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entryId);
        const source = (await provider.get('get_private_entry', builder.build())).stack;
        const result = loadGetterTuplePrivateCapsuleEntryView(source);
        return result;
    }
    
    async getGetPrivateSenderIndex(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_private_sender_index', builder.build())).stack;
        const result = loadGetterTuplePrivateCapsuleKeyIndexView(source);
        return result;
    }
    
    async getGetPrivateRecipientIndex(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_private_recipient_index', builder.build())).stack;
        const result = loadGetterTuplePrivateCapsuleKeyIndexView(source);
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
    
}