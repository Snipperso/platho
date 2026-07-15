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
    author_wallet: Address;
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
        b_0.storeAddress(src.author_wallet);
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
    const _author_wallet = sc_0.loadAddress();
    const _body_hash = sc_0.loadUintBig(256);
    const _parent_link = sc_0.loadUintBig(64);
    const _prev_link = sc_0.loadUintBig(64);
    const sc_1 = sc_0.loadRef().beginParse();
    const _profile_prev_link = sc_1.loadUintBig(64);
    const _header = sc_1.loadRef();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, author_wallet: _author_wallet, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function loadTuplePublicCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, author_wallet: _author_wallet, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function loadGetterTuplePublicCapsuleEntry(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _body_hash = source.readBigNumber();
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntry' as const, publish_id: _publish_id, created_at: _created_at, author_wallet: _author_wallet, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
}

export function storeTuplePublicCapsuleEntry(source: PublicCapsuleEntry) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.created_at);
    builder.writeAddress(source.author_wallet);
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
    author_wallet: Address;
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
        b_0.storeAddress(src.author_wallet);
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
    const _author_wallet = sc_0.loadAddress();
    const _header_0 = sc_0.loadRef();
    const _header_1 = sc_0.loadRef();
    const _body = sc_0.loadRef();
    return { $$type: 'RecoveryCapsuleRecord' as const, publish_id: _publish_id, updated_at: _updated_at, body_hash: _body_hash, author_wallet: _author_wallet, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadTupleRecoveryCapsuleRecord(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleRecord' as const, publish_id: _publish_id, updated_at: _updated_at, body_hash: _body_hash, author_wallet: _author_wallet, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadGetterTupleRecoveryCapsuleRecord(source: TupleReader) {
    const _publish_id = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleRecord' as const, publish_id: _publish_id, updated_at: _updated_at, body_hash: _body_hash, author_wallet: _author_wallet, header_0: _header_0, header_1: _header_1, body: _body };
}

export function storeTupleRecoveryCapsuleRecord(source: RecoveryCapsuleRecord) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.publish_id);
    builder.writeNumber(source.updated_at);
    builder.writeNumber(source.body_hash);
    builder.writeAddress(source.author_wallet);
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
    author_wallet: Address;
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
        b_1.storeAddress(src.author_wallet);
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
    const _author_wallet = sc_1.loadAddress();
    const _header_0 = sc_1.loadRef();
    const _header_1 = sc_1.loadRef();
    const _body = sc_1.loadRef();
    return { $$type: 'RecoveryCapsuleView' as const, exists: _exists, slot_key: _slot_key, updated_at: _updated_at, body_hash: _body_hash, author_wallet: _author_wallet, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadTupleRecoveryCapsuleView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _slot_key = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleView' as const, exists: _exists, slot_key: _slot_key, updated_at: _updated_at, body_hash: _body_hash, author_wallet: _author_wallet, header_0: _header_0, header_1: _header_1, body: _body };
}

export function loadGetterTupleRecoveryCapsuleView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _slot_key = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _body_hash = source.readBigNumber();
    const _author_wallet = source.readAddress();
    const _header_0 = source.readCell();
    const _header_1 = source.readCell();
    const _body = source.readCell();
    return { $$type: 'RecoveryCapsuleView' as const, exists: _exists, slot_key: _slot_key, updated_at: _updated_at, body_hash: _body_hash, author_wallet: _author_wallet, header_0: _header_0, header_1: _header_1, body: _body };
}

export function storeTupleRecoveryCapsuleView(source: RecoveryCapsuleView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.slot_key);
    builder.writeNumber(source.updated_at);
    builder.writeNumber(source.body_hash);
    builder.writeAddress(source.author_wallet);
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
    author_wallet: Address;
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
        b_1.storeAddress(src.author_wallet);
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
    const _author_wallet = sc_1.loadAddress();
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
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
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
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
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
    const _parent_link = source.readBigNumber();
    const _prev_link = source.readBigNumber();
    const _profile_prev_link = source.readBigNumber();
    const _header = source.readCell();
    return { $$type: 'PublicCapsuleEntryView' as const, exists: _exists, entry_id: _entry_id, entry_uid: _entry_uid, publish_id: _publish_id, author_wallet: _author_wallet, page_id: _page_id, page_offset: _page_offset, created_at: _created_at, header_hash: _header_hash, body_hash: _body_hash, parent_link: _parent_link, prev_link: _prev_link, profile_prev_link: _profile_prev_link, header: _header };
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
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_bucket_index: _private_bucket_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head, intro_entries: _intro_entries, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_slots: _recovery_slots, recovery_live_count: _recovery_live_count };
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
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_bucket_index: _private_bucket_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head, intro_entries: _intro_entries, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_slots: _recovery_slots, recovery_live_count: _recovery_live_count };
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
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_bucket_index: _private_bucket_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head, intro_entries: _intro_entries, intro_latest_id: _intro_latest_id, intro_oldest_live_id: _intro_oldest_live_id, intro_live_count: _intro_live_count, recovery_slots: _recovery_slots, recovery_live_count: _recovery_live_count };
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
    const __code = Cell.fromHex('b5ee9c724202012a0001000060b000000114ff00f4a413f4bcf2c80b0001020162000200b303f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e30fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6d6d53556d216d5471116d21e30d111b8e9f11198020d7217021d749c21f9430d31f01de8210ff775609bae3025f0f5f0ce070561ad7492001270003000502f4d37f01311118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111a4130db3c813393f842561bc705f2f4813394561bc200f2f4111a1fa011181119111800970004019a1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f111010de10cd10bc10ab109a1089107810671056104510344130db3c00b10462c21f9731111ad31f111bde21821090e2e0cbbae3022182103a12d1adbae302218210a4f862d1bae3022182107a861031ba00060009000d008903fe5b1119d3fffa403001111a01111bdb3cdb3c81326e5618b3f2f481326f561bc300f2f48132705616c000917f955616561cbae2f2f41118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0c11190c0b11190b000a000b000702fc0a11190a0911190911190807065540813271111a561cdb3c571657175717011118011113f2f4813272f828561a01c705b3f2f41115111811151115111711157f11171113111611131113111511131111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645135042000800b0000afa4430c00003fc5b1119d3ff301118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111a4130db3cdb3c5716813278561ac300f2f45614813279111bba01111a01f2f481327a5616000a000b000c00108132655617b3f2f40016813282f8425616c705f2f4017af2f41117111811171116111711161115111611157f11161114111511141113111411131112111311121111111211111110111111100f11100f550edb3c00b101fe5b1119d33f31d39f31d3ffd307d307d37ffa40d4f404301119111e11191118111d11181117111c11171116111b11161115111a11151114111e11141113111d11131112111c11121111111b11111110111a11100f111e0f0e111d0e0d111c0d0c111b0c0b111a0b0a111e0a09111d0908111c0807111b0706111a0605111e05000e04fe04111d0403111c0302111b0201111f011120db3c8134bcf842561ac705f2f48134bd561bc300f2f48134be561fc001917f94561fc002e2917f94561fc003e2917f94561fc004e2f2f48134bf561ec20094561ec1099170e2f2f4561ec001561fc0035620c0025621c0045616820898968025e30f8134c056205625a0843fbb0097000f0011001601fc5b56171119111e11191118111d11181117111c11171116111b11161115111a11151114111e11141113111d11131112111c11121111111b11111110111a11100f111e0f0e111d0e0d111c0d0c111b0c0b111a0b0a111e0a09111d0908111c0807111b0706111a0605111e0504111d0403111c0302111b0201111a01111e7200100104db3c001502b0248ed322e30001111f0105111e0504111d0403111c0302111b0201111a0105111905041118040311170302111602011115010511140504111304031112030211110201111001105f104e103d4cb0105a104910384760e30d0012001402fc301119111e11191118111d11181117111c11171116111b11161115111a11151114111e11141113111d11131112111c11121111111b11111110111a11100f111e0f0e111d0e0d111c0d0c111b0c0b111a0b0a111e0a09111d0908111c0807111b0706111a0605111e0504111d0403111c0302111b0201111a01111e72db3c0015001300d0111a111f111a1119111e11191118111d11181117111c11171116111b11161115111a11151114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a10491038476001fe5b281119111e11191118111d11181117111c11171116111b11161115111a11151114111e11141113111d11131112111c11121111111b11111110111a11100f111e0f0e111d0e0d111c0d0c111b0c0b111a0b0a111e0a09111d0908111c0807111b0706111a0605111e0504111d0403111c0302111b0201111a01111e72db3c00150014c002958208989680e07004fef2f456238134c202a8562301bbf2f4561b8eb08134c356266eb3f2f48134c41126d0810098db3c828873656e742076696120506c6174686f2e417070ba01112601f2f4925725e28134c5f8416f24135f03562382080f4240a8562301a08209c9c380a0bef2f45623708136b070f836562301a08209c9c380a053118a8ae833001700180019007e0006d701300008235627b901f85626a55240ba05d0562325a01119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111f11131112111e11121111111d11111110111c11100f111b0f0e111a0e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111f0706111e0605111d0504111c0403111b03001a04fe02111a0201111f01112b5625561edb3c562b5625e30f111ba401112901111a111d111a1119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036001b001c002a007d0024c882104550493101cb1f12cbffcb0fc9f90001fa735621923074df8134c65623d749810310ba965623d74a58ba923170e2f2f41121d307d307d3ffd3ffd3ffd4d4d411289257279a57281126d43011271126e21118112111181117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11210f0e11200e001d02fc0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061121060511200504111f0403111e0302111d0201111c01111b8134c7111b56225622db3c01111c01f2f48134c85620c30094561fc3009170e294561ec3009170e2f2f41118111911181117111811171116111711161115111611151114111511140064001e02fc1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc550a111a71810140708134c9562004562444348134cadb3c1118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d0075001f02fe0c11190c0b11190b0a11190a09111909111908070655408134cf111a561ddb3c5633ba01111b01f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc550a718100f0708134cb561f04562344348134cc0068002002fcdb3c561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956191119113311191118113211181117113111171116113011161115112f11151114112e11141113112d11131112112c11121111112b11111110112a11100f11290f0e11280e0d11270d0075002102f80c11260c0b11250b0a11240a0911230908112208071121070611200605111f0504111e0403111d0302111c0201111b01111a563b563bdb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0035002202fe0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540563c563cdb3c111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510340032002302fe413001113d01113cdb3c57105f0f6ca1111a111d111a1119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454003112703561e03021123020034002403fe1122018134cd8134cedb3c5630db3c561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a1119113411191118113311181117113211171116113111161115113011151114112f11141113112e11131112112d11121111112c11111110112b1110007500a5002503f60f112a0f0e11290e0d11280d0c11270c0b11260b0a11250a091124090811230807112207061121060511200504111f0403111e0302111d0201111c01111b5638db3c57105f0f6ca101db3c111a111b111a1119111a111911181119111811171118111711161117111611151116111511141115111411131114111300cf0026002700a02e83072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc9031110031201111001206e953059f45b30944133f417e20d02e41112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413056310256250201111f01111e561fdb3c8040f823051125050403111e0302111d0201111f011120c855505056cbff13cb3fcbffcb3fccccc9103c02111a0201112d010110002802fc206e953059f45b30944133f417e20ca48202981070f8361115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e011111010c11100c10bf10de109d108c107b106a1059104810371026102503112b0302111e02112b71db3c01112c01a001111c01a01118111b11180087002901bc1117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454002112a0201112a01111ddb3c007c032056248f0a5622e30f111d1129111de30d002b0040006201fe572d735620923074df8134ee5622d749810310ba965622d74a58ba923170e2f2f41120d307d307d3ffd3ffd3ffd4d4d411279257269a57331125d43011321125e21118112011181117111f11171116111e11161115111d11151114111c11141113111b11131112111a11121111111911111110112011100f111f0f0e111e0e002c02f60d111d0d0c111c0c0b111b0b0a111a0a091119090811200807111f0706111e0605111d0504111c0403111b0302111a020111190111208134ef1120561f561fdb3c01112101f2f48134f0561dc30094561cc3009170e294561bc3009170e2f2f48134f8561fc109f2f41118111911181117111811171116111711160064002d02fc1115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc550a111f71810140708134f1562304562144348134f2db3c1118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100075002e02fc0f11190f0e11190e0d11190d0c11190c0b11190b0a11190a09111909111908070655408134f7111a5620db3c5632ba01111b01f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc550a718100f0700068002f02fe8134f3562404562044348134f4db3c561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956191119113311191118113211181117113111171116113011161115112f11151114112e11141113112d11131112112c11121111112b11111110112a11100075003002f40f11290f0e11280e0d11270d0c11260c0b11250b0a11240a0911230908112208071121070611200605111f0504111e0403111d0302111c0201111b01111a56385638db3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11110035003102fe1110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a080706554056395639db3c111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab003200330108db3caa02003602fc109a108910781067105610451034413001113a011139db3c57105f0f6ca1111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035003400390106db3ca500350110db3ca67e807fa904003601f4111a111b111a1119111b11191118111b11181117111b11171116111b11161115111b11151114111b11141113111b11131112111b11121111111b11111110111b11100f111b0f0e111b0e0d111b0d0c111b0c0b111b0b0a111b0a09111b0908111b0807111b0706111b0605111b0504111b0403111b0302111b02003702d201111b01db3c111bdb3c01111b01a01119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413000380070001681328e01c002f2f48104b403fc44308134f58134f656285154041123040311220302112302011122011123db3c561ddb3c2283072259f40f6fa192306ddf206e92306d8e12d0d3ffd33fd3fffa40d4d4d455606c176f07e2206eb3208e118134fb026f2710365f06562fc70512f2f49131e28307f823562850345621035631030211240201112501112ac8007500cf003a02fc55605067cbff14cb3f12cbffceccccccc901111f01561e01206e953059f45b30944133f417e2820249f070f83601112101a01122e3011117111e11171116111d11161115111c11151114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a003b003d02f8111ca4111da41117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443002111c0201111f01111d74db3c01112201a0112101111f01111c0111190111180111170111160087003c002801111501111401111301111201111101111055d102fe09111009108f107e556606111f060504111f04031122030211220201111f01db3c111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034003e003f0042c813cbffcbffcbffc9c88210d119020401cb1f561ccf1612cbff12cbffccc9f9000110413001111e01db3c007c01fe725621923073df8134d05623d749810250ba965623d74a58ba923170e2f2f41121d307d307d33fd3ffd3ffd4d411279257269a57271125d43011261125e28134d1258100feb0c000f2f40471b0c0011118112011181117111f11171116111e11161115111d11151114111c11141113111b11131112111a1112111111191111004104fe1110112011100f111f0f0e111e0e0d111d0d0c111c0c0b111b0b0a111a0a091119090811200807111f0706111e0605111d0504111c0403111b0302111a020111190111208134d21120561edb3c01112101f2f48134d3561bc30094561ac3009170e2f2f48134d95621b3917f94561cc000e2f2f48134d8561cc000e30ff2f4005400420043004400027f000a561c5634bb02f81118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111f8134d48134d5561e02561d02db3c1119111b11191118111a111811171119111711161118111611151117111511141116111411131115111311121114111200450048010c8a801e7fdb38004602f823f9005003baf2f420561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561c561ced41ed43ed44ed45ed47955b111af2f0ed67ed65ed64ed63ed61801b7fed118aed41edf101f2ff11181119111811171118111711161117111611151116111500470078007c0171f94102c1025230f2f420c2005230f2f420810240bb5230f2f4a93802c0005220f2f4c101f2f4111911181117111611151114111311121111111055e003fc1111111311111110111211100f11110f0e11100e551d01112501561f01111e8134d68134d7db3c1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e563001561d01562d01111e5620db3c1119111a1119004900bf0056010c8a801f7fdb38004a02f824f9005004baf2f421561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561d561ded41ed43ed44ed45ed47955b111af2f0ed67ed65ed64ed63ed61801b7fed118aed41edf101f2ff111811191118111711181117111611171116111511161115004b007802fc1119111c11191118111b11181117111a11171116111c11161115111b11151114111a11141113111c11131112111b11121111111a11111110111c11100f111b0f0e111a0e0d111c0d0c111b0c0b111a0b0a111c0a09111b0908111a0807111c0706111b0605111a0504111c0403111b0302111a0201111c01111b561bdb3c0051004c01fc01111b01f9411119111b11191118111a11181117111b11171116111a11161115111b11151114111a11141113111b11131112111a11121111111b11111110111a11100f111b0f0e111a0e0d111b0d0c111a0c0b111b0b0a111a0a09111b0908111a0807111b0706111a0605111b0504111a0403111b0302111a0201111b01004d03f4111c561ddb3c01111b01bb561e01f2f4561ac200561e01f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e561cdb3c561b01bb561e01f2f4111aa93802c000561d01f2f41118111a11181117111911170051004e004f0108db3caa02005202fc1116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354014111b13db3c01111b01bb01111b01f2f4111811191118111711181117111611171116111511161115111411151114111311141113005000550106db3ca500510110db3ca67e807fa904005201f61118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111901111a813296111a561b005301c4db3c01111b01f2f4111aaa091118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443000540104db3c007200301112111311121111111211111110111111100f11100f550e04fc1118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a08070655405630db3c705625e30f8040f82306111f0605562e050411210403112703021127020111220100a50057005a005f01fc5720561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a1119113411191118113311181117113211171116113111161115113011151114112f11141113112e11131112112d11121111112c11111110112b11100f112a0f0e11290e0d11280d0058027e0c11270c0b11260b0a11250a091124090811230807112207061121060511200504111f0403111e0302111d0201111c01111b563edb3c57105f0f6ca101db3c0124005900962c80402359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2804002a413c85902cb3fcb3fc9103e41e0206e953059f45b30944133f417e20b02fc1119111b11191118111a11181117111b11171116111a11161115111b11151114111a11141113111b11131112111a11121111111b11111110111a11100f111b0f0e111a0e0d111b0d0c111a0c0b111b0b0a111a0a09111b0908111a0807111b0706111a0605111b0504111a0403111b0302111a0201111b01111a562ddb3c00ac005b03f41119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540561a561ddb3c112294571a571be30d1119111f11191117111a1117005c005d005e00962d83072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc9103f41f0206e953059f45b30944133f417e20c005a571b16830701111a561c8040216e955b59f45b3098c801cf014133f443e21118111a1118041119040411180405009a1116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a106910581047103645330401fe111fc855705078cbff15cb3f13cecbffcb3fcb3f01c8cb3f12cccdc9103a0211200201112d01206e953059f45b30944133f417e20aa48202bf2070f8361114111911141113111811131112111711121111111611111110111511100f11140f0e11130e0d11120d0c11110c0111100110af109e10bd107c106b105a10491038006002fe1027103605111e0504112b0402111e0201111e01112b72db3c01112c01a001111c01a01118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454002112a0200870061011c01112a01111ddb3c111d1129111d007c01fe735621923074df8134e45623d749810310ba965623d74a58ba923170e2f2f41121d307d307d3ffd3ffd3ffd4d4d411289257279a57281126d43011271126e21119112111191118112011181117111f11171116111e11161115111d11151114111c11141113111b11131112111a11121111112111111110112011100f111f0f006302f40e111e0e0d111d0d0c111c0c0b111b0b0a111a0a091121090811200807111f0706111e0605111d0504111c0403111b0302111a02011121011120561e8134e5111fdb3c01111e01f2f48134e6561cc30094561bc3009170e294561ac3009170e2f2f41118111911181117111811171116111711161115111611150064006602ee111a111b111a1119111b11191118111b11181117111b11171116111b11161115111b11151114111b11141113111b11131112111b11121111111b11111110111b11100f111b0f0e111b0e0d111b0d0c111b0c0b111b0b0a111b0a09111b09111b0807065540db3c94111ac00293571a70e21119111a11190072006500a81118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413002f81114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc550a111c71810150708134e7562404562044348134e8db3c1118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0075006702fe0e11190e0d11190d0c11190c0b11190b0a11190a09111909111908070655408134ed111a5621db3c5632ba01111b01f2f41118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc550a718100f0708134e9562300680069000ed0d32731d3073002fc04561f44348134eadb3c561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956191119113311191118113211181117113111171116113011161115112f11151114112e11141113112d11131112112c11121111112b11111110112a11100f11290f0075006a02fc0e11280e0d11270d0c11260c0b11250b0a11240a0911230908112208071121070611200605111f0504111e0403111d0302111c0201111b01111a5637db3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f006e006b03fe0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a08070655405638db3c1139db3c57105f0f6ca1111b111d111b111a111c111a1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df006c006d00740108db3caa02006f0106db3ca5006e0110db3ca67e807fa904006f02ee1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540810954111bdb3c01111b01a01119111a11191118111911180070007301f61118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a080711190706111a060511190504111a040311190302111a0201111901111a81328d111a561b007101c4db3c01111b01f2f4111aaa091118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544300072004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e2009c1117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413003fe10ce10bd10ac109b108a10791068105710461035102403112703561e031120018134eb8134ecdb3c1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d563002561d021125015625db3c8040f823007500d60079010c8a80217fdb38007602f826f9005006baf2f423561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561f561fed41ed43ed44ed45ed47955b111af2f0ed67ed65ed64ed63ed61801b7fed118aed41edf101f2ff1118111911181117111811171116111711161115111611150077007800565142f9415024ba5240f2f401ba5220f2f458baf2f4111911181117111611151114111311121111111055e000481114111511141113111411131112111311121111111211111110111111100f11100f550e01fc04111d04030211240201111f01111ec855405045cbff12cb3fcbffccccc9103402111b0201112d01206e953059f45b30944133f417e2112aa48201d4c070f8361116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c007a02fe108b107a1069105810471036112b4155040373db3c01112c01a001111c01a01118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454002112a0201112a010087007b0108111ddb3c007c0012c812cbffcbffc9f90000081025443304f433571c572157248134daf8416f24135f0301111bbe01111a01f2f4561b9511115620a08e18561a94025620a09c56199711105620a01110de02e2021111e20d561fa0111be30f1121e301111811191118111711181117111611171116111511161115111411151114111311141113111211131112111111121111007f008000830085019c57181115111911151114111811141113111711131112111611121111111511111110111411100b11130b0e11120e0d11110d5e3c10ae109d108c107b106a105910481037461411214550561edb3c0098029656198ec51118e3001118112111181115111911151114111811141113111711131112111611121111111511111110111411100b11130b0e11120e0d11110d5e3c10ae109d108c553712e30d0081008201fa1115111911151114111811141113111711131112111611121111111511111110111411100b11130b0e11120e0d11110d5e3c10ae109d108c107b106a105910481037461411214550561edb3c11210f11190f111803111703011116010f11150f111403111303011112010f11110f11104fe04d1c103b49a8103745641200a3019c57181115111911151114111811141113111711131112111611121111111511111110111411100b11130b0e11120e0d11110d5e3c10ae109d108c107b106a105910481037461411214550561edb3c00a102fe561d20c204923074de1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001112101db3c1120111911181117111611151114111311121111111000a10084000455e003f41110111111100f11100f550e1120561edb3c561e01a8561d01a0111fc00494571b571be30d111c76fb02111770111e70111c8306111fc855308210874e57715005cb1f13cbffcb3fcb07cbffc956150403111e0302111b02111d014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0011121119111200870086008801c6571e1118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111d74db3c01111b01a801111b01a0111c11181117111611151114111311121111111055e00087008e7021c001965b8208325aa08e2c21c002965b82088f6ec08e1f21c003965b82081e84808e1201c004973082100bebc20095813517f2f0e2e2e2e282080f424001a0a77d8064a904016c1111111811111110111711100f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e5566103650040503db3c00b103fe8f7c5b1119d37f301118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111a4130db3c813390561bc200f2f4813391561b5611bbf2f4813395561b8208989680bee00097008a008d01fe917f95561b5611bae2f2f4813392f8416f24135f0382083d0900bef2f4f8276f10f8416f24135f03a11118111a11181117111911171116111a11161115111911151114111a11141113111911131112111a11121111111911111110111a11100f11190f0e111a0e0d11190d0c111a0c0b11190b0a111a0a0911190908111a08008b02fe0711190706111a060511190504111a040311190302111a0201111901111a813396111adb3c01111c01be01111a01f2f40d561aa1561a82081e8480a07f71111dc8018210ff77560958cb1fcb7fc9561a04111e014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0011161119111611151118111511141117111400de008c015c1113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10df10be10ad5529db3c00b104d02182105331b880ba8ec15b57191117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3ce021821053575052bae30221821052454332bae30221821045564343ba00b1008e0092009502fc5b1119d37f301118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111a4130db3c8133a4561bc200f2f48133a5561b8208989680bef2f48133a6f8416f24135f030097008f02fc82083d0900bef2f4f8276f10f8416f24135f03a11119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540db3c8133a7561c22bcf2f400de009001fe01111b01a1561b8133a802bbf2f4561a82081e8480a07f71111dc8018210ff77560958cb1fcb7fc9561b04111e014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e00910108551ddb3c00b102d85b1119d3ff301118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034111a4130db3c218307561c59f40f6fa192306ddf0097009301f4206e92306d8e12d0d3ffd33fd3fffa40d4d4d455606c176f07e28134fa216eb3f2f46f275f058134f932821005a39a80a0f823b9f2f483076dc8216e925b6d8e16016f27550655605067cbff14cb3f12cbffceccccccc9e21201111c01206e953059f45b30944133f417e21119a5111811191118111711181117009401941116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130db3c00b102b8e302571bc000111ac12101111a01b08ec38136aff2f01117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3ce05f0f5f0bf2c082009600b104cc5b1119d307d30f3001111a01111bdb3c561bc220948020571cde561ac0018ec4571a1118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3ce30e00970098009f00b0000e8132645617f2f401cc2970708e1120b3935313b99170e294225618b99170e28ec8561280402459f40f6fa192306ddf206e92306d8e11d0d3ffd33fd3ffd33fd4d455506c166f06e2206e933002a48e976f26303233f823028209e13380a012b9935f037fe30e02e202e810235f0339009902fc1119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111f11131112111e11121111111d11111110111c11100f111b0f0e111a0e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111f0706111e0605111d0504111c0403111b0302111a0201111f01111e561cdb3c00a5009a01fc561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a111a1134111a1119113311191118113211181117113111171116113011161115112f11151114112e11141113112d11131112112c11121111112b11111110112a11100f11290f0e11280e009b02fc0d11270d0c11260c0b11250b0a11240a0911230908112208071121070611200605111f0504111e0403111d0302111c0201111b011139db3c57105f0f6ca11119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f00cf009c02fe0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454003111f03591120db3c561a500f8040f45b301111a5111aa4111da41119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121112111511121110111411100f11130f111111121111009d009e00c62f83072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c830702c85902cb3fcb3fc9103f12206e953059f45b30944133f417e2985b500d8307f45b30e20c925f04e2003c0d11110d0c11100c10bf10ae109d108c107b106a1059104810374605401402a2561ac0028ec9111ac0038e41571a813502f2f01117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551de30de30d00a000a201841118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c00a100de70708e1020b3935312b99170e2935367b99170e28e562880402859f40f6fa192306ddf206e92306d9fd0d3ffd33fd3ffd4d455406c156f05e2206e933006a48e296f2510345f04f823018209e13380a0b992307f8e1252698040f45b3005a506a401a41058500605e206e206e85f030188571a1118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551ddb3c00a301f22a70708e1120b3935313b99170e294225617b99170e28edb561180402459f40f6fa192306ddf206e92306d8e24d0d3ffd33ffa40d3ffd33fd33fd401d0d33fd4301028102710261025102410236c186f08e2206e933002a48e976f285b3234f823038209e13380a013b9935f047fe30e02e202e810235f033a00a402fc1119112011191118111f11181117111e11171116111d11161115111c11151114111b11141113111a11131112112011121111111f11111110111e11100f111d0f0e111c0e0d111b0d0c111a0c0b11200b0a111f0a09111e0908111d0807111c0706111b0605111a050411200403111f0302111e0201111d01111c561adb3c00a500a60002a402f4561fe30f561a500e8040f45b301110a5111aa4111da41119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111112111411120f11130f0e11120e1110111111100c11100c10bf10ae109d108c107b106a1059104810374605441400a700ab01f8571d56195619561956195619561956195619561956195619561956195619561956195619561956195619561956195619561956195619111a1133111a1119113211191118113111181117113011171116112f11161115112e11151114112d11141113112c11131112112b11121111112a11111110112911100f11280f00a802f80e11270e0d11260d0c11250c0b11240b0a11230a09112209081121080711200706111f0605111e0504111d0403111c0302111b02011133011138db3c57105f0f6ca11118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f012400a901540e11120e0d11110d0c11100c10bf10ae109d108c107b106a10591048103746501403111e0302111ddb3c00aa00c62d80402459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c804002c85902cb3fcb3fc9103d12206e953059f45b30944133f417e2985b500b8040f45b30e20a925f04e204fe571f1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e111cdb3c20561f01111fdb3c278307561e80404133f40e6fa19401d70130925b6de2206eb39401111eba9430571d70e292571be30d1118111b111800ac00ad00ae00af000ec801cf16c9f90000c62e83072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c830702c85902cb3fcb3fc9103e12206e953059f45b30944133f417e2985b500c8307f45b30e20b925f04e2001a01111b01068307f45b3005111a00801119111a11191117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d0104db3c00b1013ac87f01ca00111a111911181117111611151114111311121111111055e000b200c801111901111ace01111701ce01111501ca0001111301ca0001111101cbff0fc8ce1ecb3f1ccb3f1acb3f18cb3f16cb7f14f40012f400f40001c8f40012f40012cb3f12cb3f12f40012cb3f03c8f40014cb3f14cb3f14cb3f14f40014cb3fcdcdcdc9ed5402012000b400ef02012000b500d102012000b600c602012000b700c302f9b0243b5134348000638c3e903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b54d55b485b551c445b4878c34446444684464446044644460445c4460445c4458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403e0012700b80128550edb3c6cee3e3e3e3e3e3e3e3e3e3e3e3e55b100b902f02e80402259f40f6fa192306ddf206e92306d8e24d0d3ffd33ffa40d3ffd33fd33fd401d0d33fd4301028102710261025102410236c186f08e2206ee3026f2820f9001118112311181117112211171116112111161115112011151114111f11141113111e11131112111d11121111111c11111110111b111000ba00be01fc30707020f8281119111e11191118111d11181117111c11171116111b11161115111a11151114111e11141113111d11131112111c11121111111b11111110111a11100f111e0f0e111d0e0d111c0d0c111b0c0b111a0b0a111e0a09111d0908111c0807111b0706111a0605111e0504111d0403111c0302111b0201111a0100bb04fa111e561ddb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540561edb3c561c5470005300880d11250d0c11260c0b11240b01120114010d00bc01f80a11230a0911270908112208112111271121112011261120111f1125111f111e1124111e111d1123111d111c1122111c111b1121111b111a1120111a1119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111911131112111811121111111711111110111611100f11150f00bd00200e11140e0e11120e0e11110e0e11100e02fa0f111a0f0e11190e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a0403111903021123020111220111217f112156205620561f56255620db3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a111200bf00c00044c85003cf16cbffcbffc9c88210d119020201cb1f561ccf1612cbff12cb3fccc9f90002fe1111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a08070655405621db3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c011200c102f40b111a0b0a111a0a09111a09111a08070655405622db3c0d11240d0c11230c0b111c0b0a11220a0911200908111b0807061121060511250504111f0403111e0302111d02011127011126111a1127111a111911261119111811251118111711241117111611231116111511221115111411211114111311201113011400c200981112111f11121111111e11111110111d11100f111c0f0e111b0e1117111a11171116111911160f11180f1115111711151113111611130e11150e1113111411130f11120f0f11110f0f11100f02f9b2bdbb5134348000638c3e903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b54d55b485b551c445b4878c34446444684464446044644460445c4460445c4458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403e0012700c40110550edb3c6cf56cb500c501f22c83072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221118111c11181117111b11171116111a11161115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a011e02016200c700c90284ab7ced44d0d200018e30fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6d6d53556d216d5471116d21e30ddb3c6cf36cb3012700c8000654734202f8aafbed44d0d200018e30fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6d6d53556d216d5471116d21e30d1119111b11191118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f012700ca01180e11100e551ddb3c6cf36cb300cb019620c24093308040de20c100923070de6d7020935313b98eb05341a02b80402259f40f6fa192306ddf206e92306d9fd0d3ffd33fd3ffd4d455406c156f05e2206eb3915be30d01a401e8313200cc01fe6f253031321118112111181117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11210f0e11200e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061121060511200504111f0403111e0302111d0201111c01111b8010111b561d00cd03fedb3c111edb3c03111f0302111d0201111e01c855305034810101cf00810101cf00810101cf0001c8810101cf00cdc902111f0201111901561d01206e953059f45b30944133f417e2111ba41115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d11160d0c11150c00ce00cf00d00014d0d33f31d3ff31d30f30000ed0d33f31d3ff3000480b11140b0a11130a091112090811110807111007106f105e104d103c4ba010291058105702014800d200d802f9b114fb5134348000638c3e903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b54d55b485b551c445b4878c34446444684464446044644460445c4460445c4458445c4458445444584454445044544450444c4450444c4448444c44484444444844444440444444403c44403e0012700d30114550edb3c6caa6caa6c6a00d403f42680402259f40f6fa192306ddf206e92306d9fd0d3ffd33fd3ffd4d455406c156f05e2206e8f0c307070547000530088881089e06f2521f90021f9001118112111181117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11210f0e11200e010d010d00d502f40d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111907061121060511200504111f0403111e0302111d0201111c01111b7f111b561a5623561f561f5624db3c09111c0908111b0807061123060511220504111e0403111d030211210201112001111f111a1123111a11191122111911181121111800d600d70042c813cbffcbffcbffc9c88210d119020301cb1f561ccf1612cbff12cb3fccc9f90000bc1117112011171116111f11161115111e11151114111d11141113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d11160d0c11150c0b11140b0a11130a0a11120a0a11110a0d11100d10af10de10cd10bc10ab02012000d900e903f1add6f6a268690000c7187d207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6a9aab690b6aa3888b690f186ed9e2b8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8cab8d2b8c088b088b888b40012700da00e801f2561656185617561656161119111e11191118111d11181117111c11171116111b11161115111a11151114111e1114561d11141113111d11131112111c11121111111b11111110111f11100f0e111d0e0d111c0d0c111b0c0b111f0b0a09111d0908111c0807111b0706111f060504111d0403111c0302111b0200db03fc01111f01111edb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a1113561a111311121111111055e0111bdb3c8307718209e133805613561e561e561b56195619547edc2d11191127111911181126111811171125111711161124111611151123111511141122111400fe00fe00dc02f81113112111131112112011121111111f11111110111e11100f111d0f0e111c0e0d111b0d0c111a0c0b11270b0a11260a09112509081124080711230706112206051121050411200403111f0302111e0201111d01111cdb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a111400df00dd02fa1113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540db3c1115112e11151114112d11141113112c11131112112b11121111112f11111110112a11100f111d0f0e111c0e0d11290d0c11280c0b11270b0a11260a0911250900de00e60128db3c8218174876e8005cbc91309131e2561001a000df02ec56111119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540db3c01111b01a856101119111a11191118111a111800e000e1000a8208419ce002fe1117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a0908111a0807111a0706111a0605111a0504111a0403111a0302111a0201111a01111bdb3c01111c01a801111a01a02101111a0100e200e3000a82089eb10002fe111bdb3c01111c01a801111a01a0561a01111a01111bdb3c01111c01a801111a01a0a77d8064a9041118111a11181117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a1079106810571046103544301200e400e5000a82082dc6c0000c82100bfb044001fe081124080711230706112206051121050411200403111f0302111e0201111b018218174876e800807d8064111d1132111d111c1131111c111b1130111b111a112f111a1119112e1119111c112d111c111b112c111b111a112b111a1119112a1119111d1129111d111c1128111c112011271120111f1126111f111b1125111b00e7006c111a1124111a111911231119111d1122111d111c1121111c111b111e111b111a111d111a1119111c1119111a111b111a1119111a111900541115111611151114111511141113111411131112111311121111111211111110111111100f11100f550e02f9af9bf6a268690000c7187d207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6a9aab690b6aa3888b690f186888c888d088c888c088c888c088b888c088b888b088b888b088a888b088a888a088a888a0889888a088988890889888908888889088888880888888807888807c0012700ea0110550edb3c6ce76cc700eb03f61119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a1113561a111311121111111055e020111cdb3ce3031118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e00fb00f500ec03fa0d11190d0c11190c0b11190b0a11190a09111909111908070655407f111a561bdb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a1113561a111311121111111055e0561d01111cdb3c1119111a11191118111a11181117111a11171116111a11161115111a11150101010000ed02fe1114111a11141113111a1113561a111311121111111055e0561e01111cdb3c702006111f060511200504111e0403111d03111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a111611151119111511141118111411131117111311121116111211111115111111101114111000f900ee003c0f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b5e27107802012000f0011902012000f1011602014800f2010302f9add8f6a268690000c7187d207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6a9aab690b6aa3888b690f186888c888d088c888c088c888c088b888c088b888b088b888b088a888b088a888a088a888a0889888a088988890889888908888889088888880888888807888807c0012700f30110550edb3c6ce76cc700f403f61119111a11191118111a11181117111a11171116111a11161115111a11151114111a1114561a1114111311121111111055e020111cdb3ce3031118111911181117111911171116111911161115111911151114111911141113111911131112111911121111111911111110111911100f11190f0e11190e0d11190d00fb00f500f701fc70561baa07561caa07705300105605112005111f1120111f111e111f111e111d111e111d111c111d111c111b111c111b111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc00f6001010ab109a1089107803fe0c11190c0b11190b0a11190a09111909111908070655407f111a561bdb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a1114561a1114111311121111111055e0561d01111cdb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a1114561a11140101010000f802fa111311121111111055e0561e01111cdb3c702006111f060511200504111e0403111d03111c1120111c111b111f111b111a111e111a1119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d00f9010201f41119111b11191118111a11181117111b11171116111a11161115111b11151114111a11141113111b11131112111a11121111111b11111110111a11100f111b0f0e111a0e0d111b0d0c111a0c0b111b0b0a111a0a09111b0908111a0807111b0706111a0605111b0504111a0403111b0302111a0201111b01111a00fa02fc561b561bdb3c8e3f571a571a1117111911171116111811161115111711151114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d70e11119111a111911181119111811171118111711161117111611151116111511141115111411131114111311121113111211111112111100fb00ff01f221c2ff8e185b111911181117111611151114111311121111111055e070e30d1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413000fc01fc111a111b111a1119111b11191118111b11181117111b11171116111b11161115111b11151114111b11141113111b11131112111b11121111111b11111110111b11100f111b0f0e111b0e0d111b0d0c111b0c0b111b0b0a111b0a09111b0908111b0807111b0706111b0605111b0504111b0403111b0302111b0201111b0100fd010edb3c01111b01b900fe001220923070e1a5ab07a402e81110111111100f11100f550e561b01db3c111bdb3c01111b01a11119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001000101001601a4aa075301bc9130e0310004aa0700240c11100c10bf10ae109d108c107b5e2710780201200104010702f8abbced44d0d200018e30fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6d6d53556d216d5471116d21e30d1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f012701050114550edb3c6c886c886ca80106037a2283072259f40f6fa192306ddf206e92306d8e12d0d3ffd33fd3fffa40d4d4d455606c176f07e2206e8f8b30707020f8288888881067e06f27367f0706010d010d010d02f8a861ed44d0d200018e30fa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6d6d53556d216d5471116d21e30d1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f012701080128550edb3c6cee3e3e3e3e3e3e3e3e3e3e3e3e55b1010902f02f80402259f40f6fa192306ddf206e92306d8e11d0d3ffd33fd3ffd33fd4d455506c166f06e2206ee3026f2621f90021f9001118112211181117112111171116112011161115111f11151114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11220e0d11210d0c11200c010a010f01fe3070705300f8281119111f11191118111e11181117111d11171116111c11161115111b11151114111a11141113111f11131112111e11121111111d11111110111c11100f111b0f0e111a0e0d111f0d0c111e0c0b111d0b0a111c0a09111b0908111a0807111f0706111e0605111d0504111c0403111b0302111a0201111f01010b04de111e561ddb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f0e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a0807065540561edb3c561c5470008801120114010d010c02fa880d11240d0c11250c0b11230b0a11220a091127090811260807112107112011271120111f1126111f111e1125111e111d1124111d111c1123111c111b1122111b111a1121111a1119112011191118111f11181117111e11171116111d11161115111c11151114111b11141113111a1113111211191112111111181111010d010e0000003c1110111711100f11160f0e11150e0f11140f1110111311105e3e0e11100e02fe0b111f0b0a111e0a09111d0908111c0807111b0706111a060511190504112204031121030211200201111f01111e7f111e561d561d56225622561edb3c56191119111b11191118111a11181117111b11171116111a11161115111b11151114111a11141113111b11131112111a11121111111b11111110111a11100f111b0f011001110042c813cbffcbffcbffc9c88210d119020101cb1f561ccf1612cbff12cb3fccc9f90002fc0e111a0e0d111b0d0c111a0c0b111b0b0a111a0a09111b0908111a0807111b0706111a0605111b0504111a0403111b0302111a0201111b01111a561fdb3c1119111a11191118111a11181117111a11171116111a11161115111a11151114111a11141113111a11131112111a11121111111a11111110111a11100f111a0f011201130004ab0702f40e111a0e0d111a0d0c111a0c0b111a0b0a111a0a09111a09111a08070655405620db3c0d11220d0c11210c0b11270b0a111d0a0911200908111c0807111b070605111f05041124040311230302111e02011126011125111a1127111a111911261119111811251118111711241117111611231116111511221115011401150006a9380700b41114112111141113112011131112111f11121111111e11111110111d11100f111c0f0e111b0e1115111a11151114111911141115111811151110111711101113111611130f11150f0e11140e0f11130f1110111111100f11100f02f9b4f2dda89a1a400031c61f481f481a401a401020203ae01a803a1f480602c2a2886600da2aa08e0a8e00040dadadadadaa6aada42daa8e222da43c61a223222342232223022322230222e2230222e222c222e222c222a222c222a2228222a22282226222822262224222622242222222422222220222222201e22201f0012701170110550edb3c6cf56cb5011801f22d83072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221118111c11181117111b11171116111a11161115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a011e020158011a0126020120011b012002f9ace9f6a268690000c7187d207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6a9aab690b6aa3888b690f186888c888d088c888c088c888c088b888c088b888b088b888b088a888b088a888a088a888a0889888a088988890889888908888889088888880888888807888807c00127011c0110550edb3c6cf56cb5011d01f22b80402259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221118111c11181117111b11171116111a11161115111911151114111c11141113111b11131112111a11121111111911111110111c11100f111b0f0e111a0e0d11190d0c111c0c0b111b0b0a111a0a011e02fc0911190908111c0807111b0706111a060511190504111c0403111b0302111a0201111901111c7f111c561adb3c04111d0403111c030201111b01111e111a111e111a1119111d11191118111c11181117111b11171116111a11161115111911151114111811141113111711131112111611121111111511111110111411100124011f00440f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a10591058105702f9ad9376a268690000c7187d207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6a9aab690b6aa3888b690f186888c888d088c888c088c888c088b888c088b888b088b888b088a888b088a888a088a888a0889888a088988890889888908888889088888880888888807888807c0012701210110550edb3c6cf56cb5012201f42883072280404133f40e6fa19401d70130925b6de2206e9730707053001034e01118111b11181117111a11171116111911161115111b11151114111a11141113111911131112111b11121111111a11111110111911100f111b0f0e111a0e0d11190d0c111b0c0b111a0b0a11190a09111b0908111a0807111907012302fa06111b0605111a050411190403111b0302111a0201111901111b7f111b561cdb3c03111c0302111b0201111d71111b111e111b111a111d111a1119111c11191118111b11181117111a11171116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e012401250002a500300d11100d10cf10be10ad109c108b107a10691058105710560289b241bb5134348000638c3e903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b54d55b485b551c445b4878c376cf15c417c3db28600127012901f8fa40fa40d200d200d3ffd401d0fa40d33fd33fd33fd33fd37ff404f404f404d430d0f404f404d33fd33ff404d33fd430d0f404d33fd33fd33ff404d33f301115111a1115111511191115111511181115111511171115111511161115571a1118111911181117111811171116111711161115111611151114111511140128003c1113111411131112111311121111111211111110111111100f11100f550e00022611454477');
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
    {"name":"PublicCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"parent_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"profile_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bucket_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PrivateBucketIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"bucket_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"IntroCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"IntroScanRecord","header":null,"fields":[{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"view_tag","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ephemeral_r","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroScanBoundsView","header":null,"fields":[{"name":"oldest_live_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"IntroScanPageView","header":null,"fields":[{"name":"from_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"records","type":{"kind":"dict","key":"uint","keyFormat":16,"value":"IntroScanRecord","valueFormat":"ref"}}]},
    {"name":"RecoveryCapsuleRecord","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"updated_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"RecoveryCapsuleView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"slot_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"parent_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"profile_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PublicCapsuleKeyIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHub$Data","header":null,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"private_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PrivateCapsuleEntry","valueFormat":"ref"}},{"name":"public_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleEntry","valueFormat":"ref"}},{"name":"private_bucket_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PrivateCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_author_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PublicCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_parent_index","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_profile_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"uint","valueFormat":64}},{"name":"public_profile_head","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"intro_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"IntroCapsuleEntry","valueFormat":"ref"}},{"name":"intro_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"intro_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"intro_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"recovery_slots","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"RecoveryCapsuleRecord","valueFormat":"ref"}},{"name":"recovery_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const CapsuleHub_opcodes = {
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
}

const CapsuleHub_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"BindDeploymentManifest"}},
    {"receiver":"internal","message":{"kind":"typed","type":"SealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"PublishBatchToHub"}},
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
export const CAPSULEHUB_STORAGE_KEEPALIVE_RESERVE = 1000000n;
export const CAPSULEHUB_PRIVATE_ENTRY_STORAGE_ENDOWMENT = 3300000n;
export const CAPSULEHUB_PUBLIC_ENTRY_STORAGE_ENDOWMENT = 9400000n;
export const CAPSULEHUB_INTRO_ENTRY_STORAGE_ENDOWMENT = 2000000n;
export const CAPSULEHUB_INTRO_SWEEP_CAP = 4n;
export const CAPSULEHUB_STANDALONE_EVICT_CAP = 32n;
export const CAPSULEHUB_RECOVERY_POOL_RETENTION_SECONDS = 94608000n;
export const CAPSULEHUB_RECOVERY_ENTRY_STORAGE_ENDOWMENT = 200000000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | SealGenesis | PublishBatchToHub | FlushFees | TopUpStorageReserve | SweepExcessReserve | EvictExpiredRecoverySlot | EvictExpiredCapsules | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BindDeploymentManifest') {
            body = beginCell().store(storeBindDeploymentManifest(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'SealGenesis') {
            body = beginCell().store(storeSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PublishBatchToHub') {
            body = beginCell().store(storePublishBatchToHub(message)).endCell();
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
    
}