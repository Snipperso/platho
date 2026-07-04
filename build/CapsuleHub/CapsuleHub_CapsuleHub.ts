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
        b_0.storeUint(src.created_at, 64);
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
    const _created_at = sc_0.loadUintBig(64);
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
    private_sender_index: Dictionary<bigint, PrivateCapsuleKeyIndex>;
    private_recipient_index: Dictionary<bigint, PrivateCapsuleKeyIndex>;
    public_author_index: Dictionary<bigint, PublicCapsuleKeyIndex>;
    public_parent_index: Dictionary<bigint, PublicCapsuleKeyIndex>;
    public_oldest_live_id: bigint;
    private_oldest_live_id: bigint;
    public_profile_index: Dictionary<bigint, bigint>;
    public_profile_head: bigint;
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
        const b_2 = new Builder();
        b_2.storeDict(src.private_recipient_index, Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex());
        b_2.storeDict(src.public_author_index, Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex());
        b_2.storeDict(src.public_parent_index, Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex());
        b_2.storeUint(src.public_oldest_live_id, 64);
        b_2.storeUint(src.private_oldest_live_id, 64);
        b_2.storeDict(src.public_profile_index, Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64));
        b_2.storeUint(src.public_profile_head, 64);
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
    const _private_sender_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), sc_1);
    const sc_2 = sc_1.loadRef().beginParse();
    const _private_recipient_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), sc_2);
    const _public_author_index = Dictionary.load(Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex(), sc_2);
    const _public_parent_index = Dictionary.load(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex(), sc_2);
    const _public_oldest_live_id = sc_2.loadUintBig(64);
    const _private_oldest_live_id = sc_2.loadUintBig(64);
    const _public_profile_index = Dictionary.load(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64), sc_2);
    const _public_profile_head = sc_2.loadUintBig(64);
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_sender_index: _private_sender_index, private_recipient_index: _private_recipient_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head };
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
    source = source.readTuple();
    const _private_recipient_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPrivateCapsuleKeyIndex(), source.readCellOpt());
    const _public_author_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_parent_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_oldest_live_id = source.readBigNumber();
    const _private_oldest_live_id = source.readBigNumber();
    const _public_profile_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64), source.readCellOpt());
    const _public_profile_head = source.readBigNumber();
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_sender_index: _private_sender_index, private_recipient_index: _private_recipient_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head };
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
    const _public_author_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_parent_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex(), source.readCellOpt());
    const _public_oldest_live_id = source.readBigNumber();
    const _private_oldest_live_id = source.readBigNumber();
    const _public_profile_index = Dictionary.loadDirect(Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64), source.readCellOpt());
    const _public_profile_head = source.readBigNumber();
    return { $$type: 'CapsuleHub$Data' as const, fee_accumulator_address: _fee_accumulator_address, vault_address: _vault_address, vault_bound: _vault_bound, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_controller_address: _genesis_controller_address, private_latest_id: _private_latest_id, public_latest_id: _public_latest_id, private_live_count: _private_live_count, public_live_count: _public_live_count, accrued_plato_fee_ton: _accrued_plato_fee_ton, private_entries: _private_entries, public_entries: _public_entries, private_sender_index: _private_sender_index, private_recipient_index: _private_recipient_index, public_author_index: _public_author_index, public_parent_index: _public_parent_index, public_oldest_live_id: _public_oldest_live_id, private_oldest_live_id: _private_oldest_live_id, public_profile_index: _public_profile_index, public_profile_head: _public_profile_head };
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
    builder.writeCell(source.public_author_index.size > 0 ? beginCell().storeDictDirect(source.public_author_index, Dictionary.Keys.BigUint(256), dictValueParserPublicCapsuleKeyIndex()).endCell() : null);
    builder.writeCell(source.public_parent_index.size > 0 ? beginCell().storeDictDirect(source.public_parent_index, Dictionary.Keys.BigUint(64), dictValueParserPublicCapsuleKeyIndex()).endCell() : null);
    builder.writeNumber(source.public_oldest_live_id);
    builder.writeNumber(source.private_oldest_live_id);
    builder.writeCell(source.public_profile_index.size > 0 ? beginCell().storeDictDirect(source.public_profile_index, Dictionary.Keys.BigUint(256), Dictionary.Values.BigUint(64)).endCell() : null);
    builder.writeNumber(source.public_profile_head);
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
    const __code = Cell.fromHex('b5ee9c724102bb01003a24000114ff00f4a413f4bcf2c80b01020162027004f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e2bfa40fa40d200d200810101d700d401d0fa4030161514433006d1550470547000206d6d6d6d6d6d53666d21e30d11168e9f11148020d7217021d749c21f9430d31f01de8210ff775609bae3025f0f5f07e0705615d74920c21fe30021b903050602fcd37f01311113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c813393f8425616c705f2f48133945616c200f2f411151aa01113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc0a0b10896b0400d2107810671056104510344130c87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ca001eca001ccbff0ac8ce19cb3f17cb3f15cb3f13cb3fcb7ff400f400f40001c8f40013f40013f40013cb3f13cb3f13f40013cb3fcdcdc9ed54000e311115d31f1116044a821090e2e0cbbae3022182103a12d1adbae302218210a4f862d1bae3022182107a861031ba070a0d6504fe5b1114d3fffa4030011115011116db3cdb3c81326e5613b3f2f481326f5616c300f2f48132705611c000917f9556115617bae2f2f41113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a091114091114080706554081327111155617db3c5711571257120b0c0809000afa4430c0000160011113010ef2f4813272f828561501c705b3f2f41110111311101110111211107f11120e11110e0e11100e10cf552b126e03f85b1114d3ff301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3cdb3c57118132785615c300f2f42f8132791116ba01111501f2f481327a5611f2f41112111311121111111211111110111111107f11110f11100f550e0b0c6e00108132655612b3f2f40016813282f8425611c705f2f402fc5b1114d33f31d39f31d3ffd307d307d37ffa40d4f404301114111911141113111811131112111711121111111611111110111511100f11190f0e11180e0d11170d0c11160c0b11150b0a11190a091118090811170807111607061115060511190504111804031117030211160201111a01111bdb3c8134bcf8425615c7056b0e03fef2f48134bd5616c300f2f48134be561ac001917f94561ac002e2f2f48134bf5619c200945619c1099170e2f2f45619c0012e820898968022e3008134c022561da0843fbbf2f4561b8134c202a8561b01bbf2f42192571de30e8134c5f8416f24135f03561b82080f4240a8561b01a08209c9c380a0bef2f4561b708136b0700f111302fe5b2f1114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a091115090811160807111507061116060511150504111604031115030211160201111501111672db3c111511171115111411161114111311151113111211141112111111131111103f0014c002958208989680e07001608134c3561e6eb3f2f48134c4111ed0810098db3c828873656e742076696120506c6174686f2e417070ba01111e01f2f4120006d7013004fcf836561b01a08209c9c380a0219422561eb98ae8571b571e5b8134daf8416f24135f0301111dbe01111c01f2f4561a940e5618a0960d5618a00d0ee20a5617a0111a8eb21113111411131112111311121111111211111110111111100f11100f10ef109e10cd10bc10ab0a11190a550811195617db3ce30d111411151114144c566204fa561da55230ba04d0562124a01114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d111b0d0c111a0c0b11190b0a11180a09111709081116080711150706111b0605111a05041119040311180302111702011116011115561c561adb3c5622561de30f1117a411151119111515162f4b0024c882104550493101cb1f12cbffcb0fc9f90001fe73561d923074df8134c6561ad749810310ba96561ad74a58ba923170e2f2f41118d307d307d3ffd3ffd3ffd4d4d411249257239a571f1122d430111e1122e21113111c11131112111b11121111111a11111110111911100f11180f0e11170e0d11160d0c11150c0b11140b0a111c0a09111b0908111a0807111907061118061702fe0511170504111604031115030211140201111c01111b8134c7111b56195619db3c01111c01f2f48134c85617c300945616c3009170e2945615c3009170e2f2f41113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810675505111a72810460718134c9562004561b181a02f61115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a0911160911160807065540db3c941115c00293571570e21114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd3e19002810bc10ab109a108910781067105610451034413003fe44348134cadb3c718100f0708134cb561f04561a44348134ccdb3c5614561456145614561456145614561456145614561456145614561456145614561456145614561456141114112911141113112811131112112711121111112611111110112511100f11240f0e11230e0d11220d0c11210c0b11200b0a111f0a09111e0925251b03f608111d0807111c0706111b0605111a05041119040311180302111702011116011115562d562ddb3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540562e562edb3c1115111611151114111511141f1c1d0108db3caa022002fc1113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413001112f01112edb3c57105f0f6c511115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b1e240106db3ca51f0110db3ca67e807fa9042003ee1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a091116090811160807111607061116060511160504111604031116030211160201111601db3c1116db3c01111601a0111411151114111311141113212223001681328e01c002f2f48104b402f61113111511131112111411121111111511111110111411100f11150f0e11140e0d11150d0c11140c0b11150b0a11140a091115090811140807111507061114060511150504111404031115030211140201111501111481328d11165615db3c01111701f2f41114aa091113111511131112111411121111111311113e3f00601112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a108910781067105610451034413003fc107a1069105810471036454003112303561b0302111a021124018134cd8134cedb3c561adb3c5615561556155615561556155615561556155615561556155615561556155615561556155615561556151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c255928010c8a801c7fdb382601f826f9005006baf2f423561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561a561aed41ed43ed44ed45ed47955b1115f2f0ed67ed65ed64ed63ed6180167fed118e215142f9415024ba5240f2f401ba5220f2f458baf2f41114111311121111111055e0ed41edf101f2ff27003c1113111411131112111311121111111211111110111111100f11100f550e02f80b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011117011116562fdb3c57105f0f6c511115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a09111609081116085b2902f8071116070611160605111605041116040311160302111602011116015616db3c5615561556155615561556155615561556155615561556155615561556155615561556155615561556151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b2a2b00962983072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc9103b41b0206e953059f45b30944133f417e20803fc0a11200a09111f0908111e0807111d0706111c0605111b0504111a0403111903021118020111170111165630db3c57105f0f6c51011117db3c1115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107810671056104510344130561c025f2c2d00962883072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc9103a41a0206e953059f45b30944133f417e20702fc561902011123011119561bdb3c8040f823061119060504111a04031122030211180201111c01111bc855605067cbff14cb3f12cbffcb3fcb3fccccc910360211160201111701206e953059f45b30944133f417e206a48202981070f8360f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d1c106b105a1079a72e02ba10381027104604111504111a1371db3c01111b01a001111801a01113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454003111703111902db3c634a01fe72561d923073df8134d0561ad749810250ba96561ad74a58ba923170e2f2f41118d307d307d33fd3ffd3ffd4d411239257229a571e1121d430111d1121e28134d1258100feb0c000f2f40471b0c0011113111b11131112111a11121111111911111110111811100f11170f0e11160e0d11150d0c11140c0b111b0b0a111a0a3002f409111909081118080711170706111606051115050411140403111b0302111a020111190111188134d211185616db3c01111901f2f48134d3561bc30094561ac3009170e2f2f48134d95619b3917f94561cc000e2f2f48134d8561cc000917f95561c561ebbe2f2f41113111411131112111311121111111211113d3103fe1110111111100f11100f550e11178134d48134d5561902561d02db3c1114111611141113111511131112111411121111111311111110111211100f11110f0e11100e551d0111210156190111228134d68134d7db3c1114111511141113111411131112111311121111111211111110111111100f11100f550e561a0156200132354102f48ef823f9005003baf2f420561756175617561756175617561756175617561756175617561756175617561756175617561756175617ed41ed43ed44ed45ed47955b1115f2f0ed67ed65ed64ed63ed6180167fed118aed41edf101f2ff1113111411131112111311121111111211111110111111100f11100f550e333400680171f94102c1025230f2f420c2005230f2f420810240bb5230f2f4a93802c0005220f2f4c101f2f41114111311121111111055e0000a80197fdb3802f48ef824f9005004baf2f421561856185618561856185618561856185618561856185618561856185618561856185618561856185618ed41ed43ed44ed45ed47955b1115f2f0ed67ed65ed64ed63ed6180167fed118aed41edf101f2ff1113111411131112111311121111111211111110111111100f11100f550e364002fc1114111711141113111611131112111511121111111711111110111611100f11150f0e11170e0d11160d0c11150c0b11170b0a11160a09111509081117080711160706111506051117050411160403111503021117020111160111155615db3c01111801f9411114111611141113111511131112111611121111111511113b3703fe1110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a09111509081116080711150706111606051115050411160403111503021116020111150111195617db3c01111701bb561801f2f45614c200561801f2f41113111411131112111311121111111211111110111111100f11100f550e11155616db3c3b38390108db3caa023c01bc561601bb561801f2f41115a93802c000561701f2f41113111511131112111411121111111311111110111211100f11110f0e11100e10df551cdb3c01111701bb01111501f2f41112111311121111111211111110111111100f11100f550e3a0106db3ca53b0110db3ca67e807fa9043c02f61113111511131112111411121111111511111110111411100f11150f0e11140e0d11150d0c11140c0b11150b0a11140a091115090811140807111507061114060511150504111404031115030211140201111501111481329611165615db3c01111701f2f41114aa091113111511131112111411121111111311113d3f0104db3c3e004c20c001917f9320c002e2917f9320c004e2917f9320c008e2917f9320c010e292307f92c020e2004c1110111211100f11110f0e11100e10df10ce10bd10ac109b108a107910681057104610354430000a801a7fdb3803a2562401111b561adb3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540561adb3c70561b79594203fce30f8040f823061122060556250504111b0403111d0302111d0201111a01111cc855705078cbff15cb3f13cecbffcb3fcb3f01c8cb3f12cccdc910350211160201111701206e953059f45b30944133f417e205a48202bf2070f8360f11140f0e11130e0d11120d0c11110c0b11100b10af109e108d107c1b105a1049106843464901fc57185615561556155615561556155615561556155615561556155615561556155615561556155615561556151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190344022e02111802011117011116562fdb3c57105f0f6c5101db3cb74500962680402359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2804002a413c85902cb3fcb3fc910384180206e953059f45b30944133f417e20502fc1114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a09111509081116080711150706111606051115050411160403111503021116020111150111165624db3c111411151114111311151113111211151112111111151111111011151110524701f80f11150f0e11150e0d11150d0c11150c0b11150b0a11150a091115091115080706554056155617db3c111a8e215717830758111556168040216e955b59f45b3098c801cf014133f443e2111411139457155715e21115111711151112111511121111111411111110111311100f11120f0e11110e0d11100d10cf552b4800962783072359f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e27053016eb3945b6f22019132e2830702a413c85902cb3fcb3fc910394190206e953059f45b30944133f417e20602c4102710360411150403111a0301111501111a72db3c01111b01a001111801a01113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810471036454003111703111902db3c634a0012c812cbffcbffc9f900008a1114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a105910481037401650531401f02470708e1120b3935313b99170e294225612b99170e28eda2c80402459f40f6fa192306ddf206e92306d8e24d0d3ffd33ffa40d3ffd33fd33fd401d0d33fd4301028102710261025102410236c186f08e2206e933002a48e976f285b3234f823038209e13380a013b9935f047fe30e02e202e810235f03344d04f61114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d111b0d0c111a0c0b11190b0a11180a09111709081116080711150706111b0605111a05041119040311180302111702011116011115561adb3c5618e30f561750098040f45b300ba51117a41116a4111411181114594e515501f857165614561456145614561456145614561456145614561456145614561456145614561456145614561456141115112911151114112811141113112711131112112611121111112511111110112411100f11230f0e11220e0d11210d0c11200c0b111f0b0a111e0a09111d0908111c0807111b0706111a06051119054f02b004111804031117030211160201112901112cdb3c57105f0f6c511113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a1059104810374056db3cb75000c62780402459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c804002c85902cb3fcb3fc9103712206e953059f45b30944133f417e2985b50058040f45b30e204925f04e203fc57181114111511141113111411131112111311121111111211111110111111100f11100f550edb3c205618011118db3c218307561780404133f40e6fa19401d70130925b6de2206eb394011117ba9430571670e29b011114018307f45b301113925714e21112111411121111111311111110111211100f11110f0e11100e525354000ec801cf16c9f90000c62883072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c830702c85902cb3fcb3fc9103812206e953059f45b30944133f417e2985b50068307f45b30e205925f04e20004551d00741113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10ae109d10bc107b106a105910481037460501641113111411131112111311121111111211111110111111100f11100f10ef109e10cd10bc10ab0a11190a550811195617db3c5701ce2370708e1120b3935313b99170e294225613b99170e28ec92d80402459f40f6fa192306ddf206e92306d8e13d0d3ffd33fd3ffd33fd33fd4d455606c176f07e2206e933002a48e976f27303334f823038209e13380a013b9935f047fe30e02e202e810235f03335802fc1114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d111b0d0c111a0c0b11190b0a11180a09111709081116080711150706111b0605111a05041119040311180302111702011116011115561adb3c561556155615561556155615561556155615561556155615561556155615595a0002a403fc5615561556155615561556151114112a11141113112911131112112811121111112711111110112611100f11250f0e11240e0d11230d0c11220c0b11210b0a11200a09111f0908111e0807111d0706111c0605111b0504111a040311190302111802011117011116562bdb3c57105f0f6c5151101119db3c5614561456145b5c5d000ed0d33f31d3ff3000c62a83072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c830702c85902cb3fcb3fc9103a12206e953059f45b30944133f417e2985b50088307f45b30e207925f04e201f85614561456145614561456145614561456145614561456145614561456145614561456141115112911151114112811141113112711131112112611121111112511111110112411100f11230f0e11220e0d11210d0c11200c0b111f0b0a111e0a09111d0908111c0807111b0706111a060511190504111804031117035e03f60211160201112901112adb3c57105f0f6c511113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a10591048103740660503db3c5617500a8040f45b300ca51117a41116a41114111811141113111711131112111611121111111511115f60610014d0d33f31d3ff31d3ff3000c62983072459f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206eb38e3c6f225214ba91309131e221c2009301a501de218e1c830702c85902cb3fcb3fc9103912206e953059f45b30944133f417e2985b50078307f45b30e206925f04e200561110111411100f11130f0e11120e0d11110d0f11100f10bf10ae10cd108c107b106a10591048103746050402f81113111411131112111311121111111211111110111111100f11100f550e1118db3c561701a801111601a076fb02111770111970111783061119c855308210874e57715005cb1f13cbffcb3fcb07cbffc956120403111903021116021117014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb000f11140f6364003a82088f6ec001c00196308208325aa0de82080f424001a0a77d8064a904014c0e11130e0d11120d0c11110c0b11100b10af109e108d107c106b105a104910384715035044066e03fe8f7d5b1114d37f301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c8133905616c200f2f481339156162cbbf2f481339556168208989680be917f9456162cbae2f2f4813392f8416f24135f0382083d0900bef2f4f8276f106b666802fcf8416f24135f03a11113111511131112111411121111111511111110111411100f11150f0e11140e0d11150d0c11140c0b11150b0a11140a09111509081114080711150706111406051115050411140403111503021114020111150111148133961116db3c01111601be01111601f2f4085615a1561582081e8480a07f71846701b01118c8018210ff77560958cb1fcb7fc95615041119014343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb001111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b108a10695525126e0356e02182105331b880bae30221821053575052bae3025716c0001115c12101111501b0e3025f0f5f06f2c082696a6f00f85b57141112111411121111111311111110111211100f11110f0e11100e551dc87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ca001eca001ccbff0ac8ce19cb3f17cb3f15cb3f13cb3fcb7ff400f400f40001c8f40013f40013f40013cb3f13cb3f13f40013cb3fcdcdc9ed5402f45b1114d37f301113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411154130db3c8133a45616c200f2f48133a556168208989680bef2f48133a6f8416f24135f0382083d0900bef2f4f8276f10f8416f24135f03a11114111511146b6c000e8132645612f2f402fe1113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540db3c8133a7561722bcf2f401111601a156168133a802bbf2f4561582081e8480a07f711118c8018210ff77560958cb1fcb7fc95616041119014343c8cf8580ca00cf8440846d0158ce01fa02806acf40f400c901fb001112111411121111111311111110111211100f11110f0e11100e10df551c6e00bac87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ca001eca001ccbff0ac8ce19cb3f17cb3f15cb3f13cb3fcb7ff400f400f40001c8f40013f40013f40013cb3f13cb3f13f40013cb3fcdcdc9ed5400fc8136aff2f01112111411121111111311111110111211100f11110f0e11100e551dc87f01ca0011151114111311121111111055e0011114011115ce01111201ce01111001ca001eca001ccbff0ac8ce19cb3f17cb3f15cb3f13cb3fcb7ff400f400f40001c8f40013f40013f40013cb3f13cb3f13f40013cb3fcdcdc9ed540201207191020120727e020148737c02c3b0243b5134348000638afe903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b5b54d99b4878c34445044544450444c4450444c4448444c44484444444844444440444444403c44403d543b6cf1b3b9b1fa0b97402f42980402259f40f6fa192306ddf206e92306d8e24d0d3ffd33ffa40d3ffd33fd33fd401d0d33fd4301028102710261025102410236c186f08e2206ee3026f2820f9001113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11180d0c11170c0b11160b0a11150a0911140908111e08757802fc30707020f8281114111911141113111811131112111711121111111611111110111511100f11190f0e11180e0d11170d0c11160c0b11150b0a11190a09111809081117080711160706111506051119050411180403111703021116020111150111195618db3c111411151114111311151113111211151112111111151111a97603fa1110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405619db3c56175470005300880d11200d0c11210c0b111f0b0a111e0a0911220908111d08111c1122111c111b1121111b111a1120111a1119111f11191118111e11181117111d11171116111c11161115111b1115aaa47700601114111a11141113111911131112111811121111111711111110111611100f11150f0e11140e0e11130e0f11120f5e2e03fc07111d0706111c0605111b0504111a0403111903021118020111170111167f111656155620561f561a5620db3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405616db3c11141115111411131115111379a97a0044c85003cf16cbffcbffc9c88210d119020201cb1f5617cf1612cbff12cb3fccc9f90002fc1112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405617db3c0d11190d0c11180c0b11170b0a11220a0911200908111608070611210605111a0504111f0403111e0302111d0201111c01111b111511221115111411211114111311201113aa7b00a81112111f11121111111e11111110111d11100f111c0f0e111b0e1119111a11191118111911181117111811171115111711151113111611131113111511130e11140e0e11130e0e11120e0e11110e0e11100e10ef02c3b2bdbb5134348000638afe903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b5b54d99b4878c34445044544450444c4450444c4448444c44484444444844444440444444403c44403d543b6cf1b3d5b1960b97d01f62683072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221113111711131112111611121111111511111110111411100f11170f0e11160e0d11150d0c11140c0b11170b0a11160a0911150908111408071117070611160605111505041114040311170302111602b30201207f8f020158808b02c7add6f6a268690000c715fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6b6a9b33690f186ed9e2b8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8aab8ac0b98102ee561156135612561156111114111911141113111811131112111711121111111611111110111511100f11190f56180f0e11180e0d11170d0c11160c0b111a0b0a09111809081117080711160706111a060504111804031117030211160201111a011119db3c1114111511141113111511131112111511129a8202fa1111111511111110111511100f11150f0e11150e561555d01116db3c8307718209e133802e561956195616561456141114111e11141113111d11131112111c11121111111b11111110111a11100f11190f0e11180e0d11170d0c11160c0b11150b0a111e0a09111d0908111c0807111b0706111a0605111905041118049a8303fe031117030211160201111501111edb3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540db3c1111112511111110112411100f11230f0e11220e0d11260d0c11210c0b111f0b0a111e0a09111d0908111c088584890126db3c8218174876e8005cbc91309131e252b0a08502f02c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540db3c01111601a82b1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c8687000a8208419ce001f00b11150b0a11150a0911150908111508071115070611150605111505041115040311150302111502011115011116db3c01111701a801111501a0a77d8064a9041113111511131112111411121111111311111110111211100f11110f0e11100e10df10ce10bd10ac109b108a10791068105710461035443088000a82089eb10001f607111b0706111a0605111905041118040311170302112002011116018218174876e800807d80641118112911181117112811171116112711161115112611151117112511171116112411161115112311151117112211171118112111181116112011161117111f11171118111e11181116111d11161117111c11178a003c1118111b11181116111a111611171119111711161117111611151116111502c3af9bf6a268690000c715fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6b6a9b33690f186888a088a888a0889888a088988890889888908888889088888880888888807888807aa876d9e3673b63bc0b98c04f21114111511141113111511131112111511121111111511111110111511100f11150f0e11150e561555d0201117db3ce3031113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a09111409111408070655407f11155616db3c11141115111498959e8d03f41113111511131112111511121111111511111110111511100f11150f0e11150e561555d05618011117db3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e561555d05619011117db3c702006111a0605111b0504111904031118031117111b11171116111a11169d978e00841115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b1079107802c3b6f89da89a1a400031c57f481f481a401a401020203ae01a803a1f480602c2a2886600da2aa08e0a8e00040dadadadadadaa6ccda43c61a2228222a22282226222822262224222622242222222422222220222222201e22201eaa1db678d9ead8cb0b99001f62883072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221113111711131112111611121111111511111110111411100f11170f0e11160e0d11150d0c11140c0b11170b0a11160a0911150908111408071117070611160605111505041114040311170302111602b302012092ac02016293a002c3add8f6a268690000c715fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6b6a9b33690f186888a088a888a0889888a088988890889888908888889088888880888888807888807aa876d9e3673b63bc0b99404f61114111511141113111511131112111511121111111511111110111511100f11150f561555e0201117db3ce3031113111411131112111411121111111411111110111411100f11140f0e11140e0d11140d0c11140c0b11140b0a11140a09111409111408070655407f11155616db3c11141115111411131115111398959e9600d0705616aa075617aa07705300105605111b05111a111b111a1119111a11191118111911181117111811171116111711161115111611151114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a1089107803fc1112111511121111111511111110111511100f11150f561555e05618011117db3c1114111511141113111511131112111511121111111511111110111511100f11150f561555e05619011117db3c702006111a0605111b0504111904031118031117111b11171116111a11161115111911151114111811141113111711139d979f03ec1114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a091115090811160807111507061116060511150504111604031115030211160201111501111656155617db3ce303111411151114111311141113111211131112989b9c01a021c2ff9e5b1114111311121111111055e070e30d1114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441309901ce1115111611151114111611141113111611131112111611121111111611111110111611100f11160f0e11160e0d11160d0c11160c0b11160b0a11160a091116090811160807111607061116060511160504111604031116030211160201111601db3c01111601b99a001220923070e1a5ab07a40046571557151112111411121111111311111110111211100f11110f0e11100e10df551c7002b81111111211111110111111100f11100f550e201117db3c1116db3c01111601a11114111511141113111411131112111311121111111211111110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103441309d9e001601a4aa075301bc9130e0310004aa0700601112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b1079107802c3ae30f6a268690000c715fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6b6a9b33690f186888a088a888a0889888a088988890889888908888889088888880888888807888807aa876d9e367fb637c0b9a102f02a80402259f40f6fa192306ddf206e92306d8e13d0d3ffd33fd3ffd33fd33fd4d455606c176f07e2206ee3026f2721f90021f9001113111e11131112111d11121111111c11111110111b11100f111a0f0e11190e0d11180d0c11170c0b11160b0a11150a0911140908111e0807111d0706111c0605111b05a2a602f4307070547000f8281114111b11141113111a11131112111911121111111811111110111711100f11160f0e11150e0d111b0d0c111a0c0b11190b0a11180a09111709081116080711150706111b0605111a05041119040311180302111702011116011115561bdb3c111411151114111311151113111211151112a9a304fc1111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a0911150911150807065540561cdb3c561854700088880e11220e0d11230d0c11210c0b11200b0a111f0a09111e0908111d0807111c07111b1123111b111a1122111a1119112111191118112011181117111f11171116111e1116aaa4a4a5000000901115111d11151114111c11141113111b11131112111a11121111111911111110111811100f11170f1112111611121113111511131111111411111110111311100f11120f0f11110f02fe04111a0403111903021118020111170111167f111656155620561a561a5621db3c56141114111611141113111511131112111611121111111511111110111611100f11150f0e11160e0d11150d0c11160c0b11150b0a11160a0911150908111608071115070611160605111505041116040311150302111602011115011116a7a80042c813cbffcbffcbffc9c88210d119020101cb1f5617cf1612cbff12cb3fccc9f90003fc5617db3c1114111511141113111511131112111511121111111511111110111511100f11150f0e11150e0d11150d0c11150c0b11150b0a11150a09111509111508070655405618db3c0e111a0e0d11190d0c11200c0b111f0b0a11170a091123090811180807111607060511220504111c0403111b030211210201111e01a9aaab0004ab070006a9380700c0111d1115112311151114112211141113112111131112112011121111111f11111110111e11100f111d0f111a111c111a1119111b11191112111a11121111111911111117111811171115111711151115111611150f11140f0f11130f0f11100f020120adaf02c3b565fda89a1a400031c57f481f481a401a401020203ae01a803a1f480602c2a2886600da2aa08e0a8e00040dadadadadadaa6ccda43c61a2228222a22282226222822262224222622242222222422222220222222201e22201eaa1db678d9ead8cb0b9ae01f62783072259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221113111711131112111611121111111511111110111411100f11170f0e11160e0d11150d0c11140c0b11170b0a11160a0911150908111408071117070611160605111505041114040311170302111602b3020120b0b8020120b1b402c3ace9f6a268690000c715fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6b6a9b33690f186888a088a888a0889888a088988890889888908888889088888880888888807888807aa876d9e367ab632c0b9b201f62580402259f40f6fa192306ddf206e92306d9ad0d33fd33f596c126f02e2206e9730707053001034e06f221113111711131112111611121111111511111110111411100f11170f0e11160e0d11150d0c11140c0b11170b0a11160a0911150908111408071117070611160605111505041114040311170302111602b301c40111150111147f11185616db3c0411190403111803020111170111161115111911151114111811141113111711131112111611121111111511111110111411100f11130f0e11120e0d11110d0c11100c10bf10ae109d108c107b106a105910581057b702c3ad9376a268690000c715fd207d2069006900408080eb806a00e87d20180b0a8a21980368aa82382a38001036b6b6b6b6b6a9b33690f186888a088a888a0889888a088988890889888908888889088888880888888807888807aa876d9e367ab632c0b9b501f62283072280404133f40e6fa19401d70130925b6de2206e9730707053001034e01113111611131112111511121111111411111110111611100f11150f0e11140e0d11160d0c11150c0b11140b0a11160a09111509081114080711160706111506051114050411160403111503021114020111160111157f11155616b601b0db3c0311160302111802011117711116111911161115111811151114111711141113111611131112111511121111111411111110111311100f11120f0e11110e0d11100d10cf10be10ad109c108b107a1069105810571056b70002a5027fb241bb5134348000638afe903e903480348020404075c03500743e900c05854510cc01b455411c151c00081b5b5b5b5b5b54d99b4878c376cf15c417c3db1460b9ba00defa40fa40d200d200d3ffd401d0fa40d33fd33fd33fd33fd37ff404f404f404d430d0f404f404f404d33fd33ff404d33f3011101115111011101114111011101113111011101112111011101111111057151113111411131112111311121111111211111110111111100f11100f550e000220d6cd263a');
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
    {"name":"PublishBatchToHub","header":2767741649,"fields":[{"name":"bounce_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"bounce_tag","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"publish_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"protocol_fee_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"parts","type":{"kind":"simple","type":"cell","optional":false}},{"name":"marketing","type":{"kind":"simple","type":"cell","optional":true}}]},
    {"name":"CapsuleHubBatchAck","header":2270058353,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"first_entry_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"part_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"batch_uid","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CapsuleHubStateView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_latest_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"private_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_page_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_size","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_storage_years","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_retention_seconds","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"public_live_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"index_storage_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"protected_reserve_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_floor_ton","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_buffer_numerator","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"reserve_buffer_denominator","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHubPageView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"first_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"next_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"opened_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PrivateCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sender_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"recipient_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleEntry","header":null,"fields":[{"name":"publish_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"body_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"parent_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"profile_prev_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sender_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"recipient_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_1_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_0","type":{"kind":"simple","type":"cell","optional":false}},{"name":"header_1","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PrivateCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PrivateCapsuleKeyIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PublicCapsuleEntryView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_uid","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"publish_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"author_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"page_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"page_offset","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"parent_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"profile_prev_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"header","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"PublicCapsuleKeyIndex","header":null,"fields":[{"name":"latest_entry_link","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"entry_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"PublicCapsuleKeyIndexView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"latest_entry_link","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"entry_count","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CapsuleHub$Data","header":null,"fields":[{"name":"fee_accumulator_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"vault_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"private_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_latest_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_live_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accrued_plato_fee_ton","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"private_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PrivateCapsuleEntry","valueFormat":"ref"}},{"name":"public_entries","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleEntry","valueFormat":"ref"}},{"name":"private_sender_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PrivateCapsuleKeyIndex","valueFormat":"ref"}},{"name":"private_recipient_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PrivateCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_author_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"PublicCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_parent_index","type":{"kind":"dict","key":"uint","keyFormat":64,"value":"PublicCapsuleKeyIndex","valueFormat":"ref"}},{"name":"public_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"private_oldest_live_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"public_profile_index","type":{"kind":"dict","key":"uint","keyFormat":256,"value":"uint","valueFormat":64}},{"name":"public_profile_head","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const CapsuleHub_opcodes = {
    "BindDeploymentManifest": 2430787787,
    "SealGenesis": 974311853,
    "FlushFees": 2055606321,
    "TopUpStorageReserve": 1395767424,
    "SweepExcessReserve": 1398231122,
    "DepositProtocolFee": 4286010889,
    "PublishBatchToHub": 2767741649,
    "CapsuleHubBatchAck": 2270058353,
}

const CapsuleHub_getters: ABIGetter[] = [
    {"name":"get_private_entry","methodId":101473,"arguments":[{"name":"entryId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleEntryView","optional":false}},
    {"name":"get_private_sender_index","methodId":96196,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleKeyIndexView","optional":false}},
    {"name":"get_private_recipient_index","methodId":117551,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PrivateCapsuleKeyIndexView","optional":false}},
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
    'get_private_entry': 'getGetPrivateEntry',
    'get_private_sender_index': 'getGetPrivateSenderIndex',
    'get_private_recipient_index': 'getGetPrivateRecipientIndex',
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
export const CAPSULEHUB_ACK_FORWARD_RESERVE = 30000000n;
export const CAPSULEHUB_FLUSH_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_FEEACCUMULATOR_DEPOSIT_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_FEE_FLUSH_TON = 10000000n;
export const CAPSULEHUB_MIN_PROTECTED_RESERVE_TON = 100000000000n;
export const CAPSULEHUB_STORAGE_RESERVE_BUFFER_NUMERATOR = 125n;
export const CAPSULEHUB_STORAGE_RESERVE_BUFFER_DENOMINATOR = 100n;
export const CAPSULEHUB_SWEEP_LOCAL_EXEC_RESERVE = 2000000n;
export const CAPSULEHUB_MIN_RESERVE_SWEEP_TON = 10000000n;
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
export const MAX_BATCH_PARTS = 8n;
export const HUB_BATCH_BASE_GAS = 14000n;
export const HUB_PART_GAS_PRIVATE = 170000n;
export const HUB_PART_GAS_PUBLIC = 180000n;
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
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: BindDeploymentManifest | SealGenesis | PublishBatchToHub | FlushFees | TopUpStorageReserve | SweepExcessReserve | null) {
        
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