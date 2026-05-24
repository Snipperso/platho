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
    const _marketing_note = sc_0.loadUintBig(152);
    const _author_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _protocol_fee_paid = sc_1.loadUintBig(128);
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function loadGetterTuplePublishPublicFromVault(source: TupleReader) {
    const _bounce_id = source.readBigNumber();
    const _bounce_tag = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _marketing_note = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _protocol_fee_paid = source.readBigNumber();
    return { $$type: 'PublishPublicFromVault' as const, bounce_id: _bounce_id, bounce_tag: _bounce_tag, publish_id: _publish_id, marketing_note: _marketing_note, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, protocol_fee_paid: _protocol_fee_paid };
}

export function storeTuplePublishPublicFromVault(source: PublishPublicFromVault) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.bounce_id);
    builder.writeNumber(source.bounce_tag);
    builder.writeNumber(source.publish_id);
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
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address };
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
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address };
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
    return { $$type: 'CapsuleHubStateView' as const, sealed: _sealed, vault_bound: _vault_bound, deployment_manifest_hash: _deployment_manifest_hash, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, genesis_controller_address: _genesis_controller_address };
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

export type PrivateCapsuleEntry = {
    $$type: 'PrivateCapsuleEntry';
    entry_id: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    author_wallet: Address;
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    created_at: bigint;
}

export function storePrivateCapsuleEntry(src: PrivateCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.entry_id, 64);
        b_0.storeUint(src.entry_uid, 256);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeAddress(src.author_wallet);
        b_0.storeUint(src.size_class, 8);
        b_0.storeUint(src.crypto_suite, 8);
        const b_1 = new Builder();
        b_1.storeUint(src.header_0_hash, 256);
        b_1.storeUint(src.header_1_hash, 256);
        b_1.storeUint(src.body_hash, 256);
        b_1.storeRef(src.header_0);
        b_1.storeRef(src.header_1);
        b_1.storeRef(src.body);
        b_1.storeUint(src.created_at, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPrivateCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _entry_id = sc_0.loadUintBig(64);
    const _entry_uid = sc_0.loadUintBig(256);
    const _publish_id = sc_0.loadUintBig(256);
    const _author_wallet = sc_0.loadAddress();
    const _size_class = sc_0.loadUintBig(8);
    const _crypto_suite = sc_0.loadUintBig(8);
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_0_hash = sc_1.loadUintBig(256);
    const _header_1_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _created_at = sc_1.loadUintBig(32);
    return { $$type: 'PrivateCapsuleEntry' as const, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, created_at: _created_at };
}

export function loadTuplePrivateCapsuleEntry(source: TupleReader) {
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PrivateCapsuleEntry' as const, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, created_at: _created_at };
}

export function loadGetterTuplePrivateCapsuleEntry(source: TupleReader) {
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PrivateCapsuleEntry' as const, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, created_at: _created_at };
}

export function storeTuplePrivateCapsuleEntry(source: PrivateCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    builder.writeNumber(source.created_at);
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
    entry_id: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    author_wallet: Address;
    header_hash: bigint;
    body_hash: bigint;
    header: Cell;
    body: Cell;
    created_at: bigint;
}

export function storePublicCapsuleEntry(src: PublicCapsuleEntry) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.entry_id, 64);
        b_0.storeUint(src.entry_uid, 256);
        b_0.storeUint(src.publish_id, 256);
        b_0.storeAddress(src.author_wallet);
        const b_1 = new Builder();
        b_1.storeUint(src.header_hash, 256);
        b_1.storeUint(src.body_hash, 256);
        b_1.storeRef(src.header);
        b_1.storeRef(src.body);
        b_1.storeUint(src.created_at, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPublicCapsuleEntry(slice: Slice) {
    const sc_0 = slice;
    const _entry_id = sc_0.loadUintBig(64);
    const _entry_uid = sc_0.loadUintBig(256);
    const _publish_id = sc_0.loadUintBig(256);
    const _author_wallet = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _header_hash = sc_1.loadUintBig(256);
    const _body_hash = sc_1.loadUintBig(256);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const _created_at = sc_1.loadUintBig(32);
    return { $$type: 'PublicCapsuleEntry' as const, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, created_at: _created_at };
}

export function loadTuplePublicCapsuleEntry(source: TupleReader) {
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicCapsuleEntry' as const, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, created_at: _created_at };
}

export function loadGetterTuplePublicCapsuleEntry(source: TupleReader) {
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicCapsuleEntry' as const, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, created_at: _created_at };
}

export function storeTuplePublicCapsuleEntry(source: PublicCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header);
    builder.writeCell(source.body);
    builder.writeNumber(source.created_at);
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
    entry_uid: bigint;
    publish_id: bigint;
    author_wallet: Address;
    size_class: bigint;
    crypto_suite: bigint;
    header_0_hash: bigint;
    header_1_hash: bigint;
    body_hash: bigint;
    header_0: Cell;
    header_1: Cell;
    body: Cell;
    created_at: bigint;
}

export function storePrivateCapsuleEntryView(src: PrivateCapsuleEntryView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.entry_id, 257);
        b_0.storeInt(src.entry_uid, 257);
        b_0.storeInt(src.publish_id, 257);
        const b_1 = new Builder();
        b_1.storeAddress(src.author_wallet);
        b_1.storeInt(src.size_class, 257);
        b_1.storeInt(src.crypto_suite, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.header_0_hash, 257);
        b_2.storeInt(src.header_1_hash, 257);
        b_2.storeInt(src.body_hash, 257);
        b_2.storeRef(src.header_0);
        b_2.storeRef(src.header_1);
        b_2.storeRef(src.body);
        const b_3 = new Builder();
        b_3.storeInt(src.created_at, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPrivateCapsuleEntryView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _entry_id = sc_0.loadIntBig(257);
    const _entry_uid = sc_0.loadIntBig(257);
    const _publish_id = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _author_wallet = sc_1.loadAddress();
    const _size_class = sc_1.loadIntBig(257);
    const _crypto_suite = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _header_0_hash = sc_2.loadIntBig(257);
    const _header_1_hash = sc_2.loadIntBig(257);
    const _body_hash = sc_2.loadIntBig(257);
    const _header_0 = sc_2.loadRef();
    const _header_1 = sc_2.loadRef();
    const _body = sc_2.loadRef();
    const sc_3 = sc_2.loadRef().beginParse();
    const _created_at = sc_3.loadIntBig(257);
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, created_at: _created_at };
}

export function loadTuplePrivateCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, created_at: _created_at };
}

export function loadGetterTuplePrivateCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _size_class = source.readBigNumber();
    const _crypto_suite = source.readBigNumber();
    const _header_0_hash = source.readBigNumber();
    const _header_1_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PrivateCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, size_class: _size_class, crypto_suite: _crypto_suite, header_0_hash: _header_0_hash, header_1_hash: _header_1_hash, body_hash: _body_hash, header_0: _header_0, header_1: _header_1, body: _body, created_at: _created_at };
}

export function storeTuplePrivateCapsuleEntryView(source: PrivateCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.size_class);
    builder.writeNumber(source.crypto_suite);
    builder.writeNumber(source.header_0_hash);
    builder.writeNumber(source.header_1_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header_0);
    builder.writeCell(source.header_1);
    builder.writeCell(source.body);
    builder.writeNumber(source.created_at);
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

export type PublicCapsuleEntryView = {
    $$type: 'PublicCapsuleEntryView';
    exists: boolean;
    entry_id: bigint;
    entry_uid: bigint;
    publish_id: bigint;
    author_wallet: Address;
    header_hash: bigint;
    body_hash: bigint;
    header: Cell;
    body: Cell;
    created_at: bigint;
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
        b_1.storeInt(src.header_hash, 257);
        b_1.storeInt(src.body_hash, 257);
        b_1.storeRef(src.header);
        b_1.storeRef(src.body);
        const b_2 = new Builder();
        b_2.storeInt(src.created_at, 257);
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
    const _header_hash = sc_1.loadIntBig(257);
    const _body_hash = sc_1.loadIntBig(257);
    const _header = sc_1.loadRef();
    const _body = sc_1.loadRef();
    const sc_2 = sc_1.loadRef().beginParse();
    const _created_at = sc_2.loadIntBig(257);
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, created_at: _created_at };
}

export function loadTuplePublicCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, created_at: _created_at };
}

export function loadGetterTuplePublicCapsuleEntryView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _entry_id = source.readBigNumber();
    const _entry_uid = source.readBigNumber();
    const _publish_id = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_hash = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _header = source.readCell();
    const _body = source.readCell();
    const _created_at = source.readBigNumber();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, header_hash: _header_hash, body_hash: _body_hash, header: _header, body: _body, created_at: _created_at };
}

export function storeTuplePublicCapsuleEntryView(source: PublicCapsuleEntryView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.entry_id);
    builder.writeNumber(source.entry_uid);
    builder.writeNumber(source.publish_id);
    builder.writeAddress(source.author_wallet);
    builder.writeNumber(source.header_hash);
    builder.writeNumber(source.body_hash);
    builder.writeCell(source.header);
    builder.writeCell(source.body);
    builder.writeNumber(source.created_at);
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
    accrued_plato_fee_ton: bigint;
    private_entries: Dictionary<bigint, PrivateCapsuleEntry>;
    public_entries: Dictionary<bigint, PublicCapsuleEntry>;
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
        b_1.storeDict(src.private_entries, Dictionary.Keys.BigInt(257), dictValueParserPrivateCapsuleEntry());
        b_1.storeDict(src.public_entries, Dictionary.Keys.BigInt(257), dictValueParserPublicCapsuleEntry());
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
    const _private_entries = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPrivateCapsuleEntry(), sc_1);
    const _public_entries = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPublicCapsuleEntry(), sc_1);
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries };
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
    const _private_entries = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPrivateCapsuleEntry(), source.readCellOpt());
    const _public_entries = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPublicCapsuleEntry(), source.readCellOpt());
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries };
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
    const _private_entries = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPrivateCapsuleEntry(), source.readCellOpt());
    const _public_entries = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPublicCapsuleEntry(), source.readCellOpt());
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries };
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
    builder.writeCell(source.private_entries.size > 0 ? beginCell().storeDictDirect(source.private_entries, Dictionary.Keys.BigInt(257), dictValueParserPrivateCapsuleEntry()).endCell() : null);
    builder.writeCell(source.public_entries.size > 0 ? beginCell().storeDictDirect(source.public_entries, Dictionary.Keys.BigInt(257), dictValueParserPublicCapsuleEntry()).endCell() : null);
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
    const __code = Cell.fromHex('b5ee9c7241022f01000b5f000114ff00f4a413f4bcf2c80b01020162022402f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e26fa40fa40d200d200d3ffd401d0fa40d33fd33fd37ff404f40430106b106a1069106810676c1b8e21fa40fa40d200d200810101d700d401d0fa4030161514433006d155047053006d6de20ce302702bd74920c21f95310bd31f0cde21030501380a8020d7217021d749c21f9430d31f01de8210ff775609bae3025f0c0401ccd37f0131109a108910781067105610451034413bdb3c813393f8422cc705f2f48133942cc200f2f4502ba0109a1089107810671056104510344013c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed542104f8821090e2e0cbba8f675b0ad3fffa403050bcdb3cdb3c3981326e08b318f2f481326f2ac300f2f481327025c00092357f93515abae215f2f4107910787f0810570610354403c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed54e02182103a12d1adbae302210708060902cc5b0ad3ff30109a108910781067105610451034413bdb3cdb3c378132782bc300f2f4258132790cba1bf2f481327a27f2f41089107810677f075505c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed540708000e81326528b3f2f40014813282f84227c705f2f404c28210a4f862c0bae3022182108c2a76b7bae3022182107a861031bae3023c2082105331b880ba8e31303a108a5517c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed54e0c0000bc1211bb00a19202303fc5b0ad33f31d39f31d3ffd307d307d3ffd430d0d3ffd3ffd4d4d4d37f300a11120a0911110908111008107f106e105d104c103b02111202011113011114db3c8133f4f8422bc705f2f48133f525843fb9f2f48133f65612c300f2f455908133f70b56115611db3c1cf2f48133f82fc300f2f48133f92ec300f2f48133fa2d210b0c003821c0019320c0019170e2925b7fe001c00292c002923070e2917fe07004bcc300f2f4550972810460718133ff2f0456134434813400db3c718100f07081340156160456124434813402db3c547a98547a98547a9853a90a11150a0911140908111308071112070611110605111005104f103e4dcb561bdb3c55a0561c11110d0e000ec002928012e0790436db3c55a0561ddb3c6cb181340356170456114434813404db3c56100f1011120014c002938145a0e08123a0000ec002928011e07800c88e5d26f9005006baf2f45473fe561056105610561056105610561056105610ed41ed43ed44ed45ed47945b0bf2f0ed67ed65ed64ed63ed61800c7fed118e175142f9415024ba5240f2f401ba5220f2f458baf2f45590ed41edf101f2ff550980127fdb3804f4db3c8133fb21c200f2f456158133fd02bbf2f42455a05611db3c561601a082080f4240a082083d0900a08209c9c380a08133fef8416f24135f0358bef2f42b5613561156115611db3c810101f8232e5193095617519f0908111808071117070611160605111505041114040311130302111a0201111b011114c813141516002a20c001963082084c4b40e0c002958208989680e070001cc0029582083d0900e082082dc6c00040c813cbffcbffcbffc9c88210d119020101cb1f2dcf1612cbff12cb3fccc9f90002cc55c0db3cc94c905260206e953059f45a30944133f415e20ca4506ea08209c9c3807050c5710ac855208210874e576a5004cb1f12cbffcb3fcbffc92204103c45994343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00104a107910281067103640051718004c50cdcb3f1acbff18cbff16ce14cb0712cb0701c8cbff12cbff12cbff12cc12cc12cc12cb1fcd0056c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed5402fe5b0ad33f31d39f31d3ffd397fa40d430d0d3ffd3ffd4d4d37f300a11100a109f108e107d106c105b04111004103f102e011111011112db3c813458f8422bc705f2f481345924843fb9f2f481345a2ec300f2f481345f0d828873656e742076696120506c6174686f2e417070ba1df2f48134625610c300f2f481345b2fc300211a04f8f2f4550a8134638134642f02561202db3c813460813461561202561102db3c81345d561282084c4b40bbf2f423561282082dc6c0a082080f4240a082080f4240a08209c9c380a081345ef8416f24135f0358bef2f455a0547bdc56135613db3c810101f8232e516306561206051112050411160403111503021114021b1c1d1e00d68e6723f9005003baf2f45470cb547dcb547dcb547dcbed41ed43ed44ed45ed47945b0bf2f0ed67ed65ed64ed63ed61800c7fed118e2a0171f94102c1025230f2f420c2005230f2f420810240bb5230f2f4a93802c0005220f2f4c101f2f45590ed41edf101f2ff5509db0f00c08e5c23f9005003baf2f45470cb547dcb547dcb547dcbed41ed43ed44ed45ed47945b0bf2f0ed67ed65ed64ed63ed61800c7fed118e1f0179f94102c10a5230f2f420c2005230f2f4830cbb5220f2f4c109f2f45590ed41edf101f2ff5509db0f0042c85003cf16cbffcbffc9c88210d119020201cb1f2dcf1612cbff12cb3fccc9f90001fc011117011115c855805089cb3f16cbff14cbff12ce01c8cbff12cbff12cc12cc12cb1fcdc94de05290206e953059f45a30944133f415e20ca450aea08209c9c3807050a8710ac855208210874e576a5004cb1f12cbffcb3fcbffc92504103a48994343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb004a985e241f005a1023c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed5402fc5b0ad37f30109a108910781067105610451034413bdb3c8133902cc200f2f481339153c3bbf2f48133952c82084c4b40be917f9353c3bae2f2f4813392f8416f24135f0382083d0900bef2f4512ba12b82081e8480a07f710ec8018210ff77560958cb1fcb7fc92d0450ff4343c8cf8580ca00cf8440ce01fa02806acf402122000c81326428f2f40082f400c901fb00109a1089107810671056104510344300c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed5400788e348136aff2f0108a5517c87f01ca0055a050abce18ce16ca0014ca0012cbff01c8ce12cb3f12cb3f12cb7f12f40012f400cdc9ed54e05f0bf2c082020120252a020120262801b5b8090ed44d0d200018e26fa40fa40d200d200d3ffd401d0fa40d33fd33fd37ff404f40430106b106a1069106810676c1b8e21fa40fa40d200d200810101d700d401d0fa4030161514433006d155047053006d6de2550adb3c6cba827029e218101012259f40d6fa192306ddf206e92306d8e21d0d33fd3ffd3fffa40d401d0d3ffd3ffd4d4d31f3010591058105710566c196f09e2206e8f0d30707020f82853118888221089e0316f297f55802e2e01b1b93aded44d0d200018e26fa40fa40d200d200d3ffd401d0fa40d33fd33fd37ff404f40430106b106a1069106810676c1b8e21fa40fa40d200d200810101d700d401d0fa4030161514433006d155047053006d6de2db3c6cb98290016547786547765561056102d01cbbc630f6a268690000c7137d207d206900690069ffea00e87d20699fe99fe9bffa027a021808358835083488340833b60dc710fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa8238298036b6f12a856d9e1f1f1f1f1f1f1f1f1f1f1f2ad142b024e228101012259f40d6fa192306ddf206e92306d8e87d0db3c6c1d6f0de2206ee302316f2d7f55c02c2d004ed33fd3ffd3fffa40d307d307d401d0d3ffd3ffd3ffd4d4d4d31f30107d107c107b107a10791078032230707020f82854711153008888882310cd2e2e2e0000744ff5e5');
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
    {"name":"PublishPublicFromVault","header":2351593143,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"marketing_note","type":{"kind":"simple","type":"uint","optional":false,"format":152}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"protocol_fee_paid","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubPublishAck","header":2270058346,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"FlushFees","header":2055606321,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"TopUpStorageReserve","header":1395767424,"fields":[]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CapsuleHubStateView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PrivateCapsuleEntry","header":null,"fields":[{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"size_class","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"crypto_suite","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"header_0_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_1_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PublicCapsuleEntry","header":null,"fields":[{"name":"entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PrivateCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"size_class","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"crypto_suite","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PublicCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHub$Data","header":null,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"private_entries","type":{"kind":"dict","key":"int","value":"PrivateCapsuleEntry","valueFormat":"ref"}},{"name":"public_entries","type":{"kind":"dict","key":"int","value":"PublicCapsuleEntry","valueFormat":"ref"}}]},
]

const CapsuleHub_opcodes = {
    "BindDeploymentManifest": 2430787787,
    "SealGenesis": 974311853,
    "PublishPrivateFromVault": 2767741632,
    "PublishPublicFromVault": 2351593143,
    "CapsuleHubPublishAck": 2270058346,
    "FlushFees": 2055606321,
    "TopUpStorageReserve": 1395767424,
    "DepositProtocolFee": 4286010889,
}

const CapsuleHub_getters: ABIGetter[] = [
    {"name":"get_private_entry","methodId":101473,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleEntryView","optional":false}},
    {"name":"get_public_entry","methodId":65680,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PublicCapsuleEntryView","optional":false}},
    {"name":"get_state","methodId":86957,"arguments":[],"returnType":{"kind":"simple","type":"CapsuleHubStateView","optional":false}},
]

export const CapsuleHub_getterMapping: { [key: string]: string } = {
    'get_private_entry': 'getGetPrivateEntry',
    'get_public_entry': 'getGetPublicEntry',
    'get_state': 'getGetState',
}

const CapsuleHub_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPrivateFromVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishPublicFromVault"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FlushFees"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const PLATO_PRIVATE_STANDARD_FEE_TON = 5000000n;
export const PLATO_PRIVATE_LONG_TERM_FEE_TON = 10000000n;
export const PLATO_PUBLIC_POST_FEE_TON = 5000000n;
export const SIZE_CLASS_STANDARD = 1n;
export const SIZE_CLASS_LONG_TERM = 2n;
export const CRYPTO_SUITE_CLASSICAL = 1n;
export const CRYPTO_SUITE_HYBRID = 2n;
export const CAPSULEHUB_PRIVATE_STANDARD_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_EXEC_RESERVE = 4000000n;
export const CAPSULEHUB_PUBLIC_EXEC_RESERVE = 3000000n;
export const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 4000000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 1000000n;
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_FEE_FLUSH_TON = 5000000n;
export const CAPSULEHUB_PRIVATE_HEADER0_BITS = 1120n;
export const CAPSULEHUB_PRIVATE_HEADER1_BITS = 240n;
export const CAPSULEHUB_PRIVATE_HEADER0_CELLS = 2n;
export const CAPSULEHUB_PRIVATE_HEADER0_REFS = 1n;
export const CAPSULEHUB_PRIVATE_HEADER1_CELLS = 1n;
export const CAPSULEHUB_PRIVATE_HEADER1_REFS = 0n;
export const CAPSULEHUB_PRIVATE_STANDARD_BODY_BITS = 9120n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_BODY_BITS = 17824n;
export const CAPSULEHUB_PRIVATE_STANDARD_BODY_CELLS = 9n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_BODY_CELLS = 18n;
export const CAPSULEHUB_PRIVATE_STANDARD_BODY_REFS = 8n;
export const CAPSULEHUB_PRIVATE_LONG_TERM_BODY_REFS = 17n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_BITS = 576n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_CELLS = 1n;
export const CAPSULEHUB_PUBLIC_HEADER_MAX_REFS = 0n;
export const CAPSULEHUB_PUBLIC_BODY_MAX_BITS = 8192n;
export const CAPSULEHUB_PUBLIC_BODY_MAX_CELLS = 9n;
export const CAPSULEHUB_PUBLIC_BODY_MAX_REFS = 8n;
export const ENTRY_UID_DOMAIN_VAULT_PRIVATE = 3508077057n;
export const ENTRY_UID_DOMAIN_VAULT_PUBLIC = 3508077058n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | SealGenesis | PublishPrivateFromVault | PublishPublicFromVault | FlushFees | TopUpStorageReserve | null) {
        
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
    
    async getGetPublicEntry(provider: ContractProvider, entryId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(entryId);
        const source = (await provider.get('get_public_entry', builder.build())).stack;
        const result = loadGetterTuplePublicCapsuleEntryView(source);
        return result;
    }
    
    async getGetState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_state', builder.build())).stack;
        const result = loadGetterTupleCapsuleHubStateView(source);
        return result;
    }
    
}