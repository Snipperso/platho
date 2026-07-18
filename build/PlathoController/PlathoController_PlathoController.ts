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

export type AnnounceSuccessorManifest = {
    $$type: 'AnnounceSuccessorManifest';
    successor_manifest_hash: bigint;
    successor_vault: Address;
}

export function storeAnnounceSuccessorManifest(src: AnnounceSuccessorManifest) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1398096717, 32);
        b_0.storeUint(src.successor_manifest_hash, 256);
        b_0.storeAddress(src.successor_vault);
    };
}

export function loadAnnounceSuccessorManifest(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1398096717) { throw Error('Invalid prefix'); }
    const _successor_manifest_hash = sc_0.loadUintBig(256);
    const _successor_vault = sc_0.loadAddress();
    return { $$type: 'AnnounceSuccessorManifest' as const, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault };
}

export function loadTupleAnnounceSuccessorManifest(source: TupleReader) {
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    return { $$type: 'AnnounceSuccessorManifest' as const, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault };
}

export function loadGetterTupleAnnounceSuccessorManifest(source: TupleReader) {
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    return { $$type: 'AnnounceSuccessorManifest' as const, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault };
}

export function storeTupleAnnounceSuccessorManifest(source: AnnounceSuccessorManifest) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.successor_manifest_hash);
    builder.writeAddress(source.successor_vault);
    return builder.build();
}

export function dictValueParserAnnounceSuccessorManifest(): DictionaryValue<AnnounceSuccessorManifest> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAnnounceSuccessorManifest(src)).endCell());
        },
        parse: (src) => {
            return loadAnnounceSuccessorManifest(src.loadRef().beginParse());
        }
    }
}

export type ControllerProposeSuccessor = {
    $$type: 'ControllerProposeSuccessor';
    nonce: bigint;
    target_vault: Address;
    successor_manifest_hash: bigint;
    successor_vault: Address;
    approvals: Cell;
}

export function storeControllerProposeSuccessor(src: ControllerProposeSuccessor) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3235774465, 32);
        b_0.storeUint(src.nonce, 64);
        b_0.storeAddress(src.target_vault);
        b_0.storeUint(src.successor_manifest_hash, 256);
        b_0.storeAddress(src.successor_vault);
        b_0.storeRef(src.approvals);
    };
}

export function loadControllerProposeSuccessor(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3235774465) { throw Error('Invalid prefix'); }
    const _nonce = sc_0.loadUintBig(64);
    const _target_vault = sc_0.loadAddress();
    const _successor_manifest_hash = sc_0.loadUintBig(256);
    const _successor_vault = sc_0.loadAddress();
    const _approvals = sc_0.loadRef();
    return { $$type: 'ControllerProposeSuccessor' as const, nonce: _nonce, target_vault: _target_vault, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault, approvals: _approvals };
}

export function loadTupleControllerProposeSuccessor(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _target_vault = source.readAddress();
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    const _approvals = source.readCell();
    return { $$type: 'ControllerProposeSuccessor' as const, nonce: _nonce, target_vault: _target_vault, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault, approvals: _approvals };
}

export function loadGetterTupleControllerProposeSuccessor(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _target_vault = source.readAddress();
    const _successor_manifest_hash = source.readBigNumber();
    const _successor_vault = source.readAddress();
    const _approvals = source.readCell();
    return { $$type: 'ControllerProposeSuccessor' as const, nonce: _nonce, target_vault: _target_vault, successor_manifest_hash: _successor_manifest_hash, successor_vault: _successor_vault, approvals: _approvals };
}

export function storeTupleControllerProposeSuccessor(source: ControllerProposeSuccessor) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.nonce);
    builder.writeAddress(source.target_vault);
    builder.writeNumber(source.successor_manifest_hash);
    builder.writeAddress(source.successor_vault);
    builder.writeCell(source.approvals);
    return builder.build();
}

export function dictValueParserControllerProposeSuccessor(): DictionaryValue<ControllerProposeSuccessor> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeControllerProposeSuccessor(src)).endCell());
        },
        parse: (src) => {
            return loadControllerProposeSuccessor(src.loadRef().beginParse());
        }
    }
}

export type ControllerProposeRotate = {
    $$type: 'ControllerProposeRotate';
    nonce: bigint;
    slot: bigint;
    new_pubkey: bigint;
    approvals: Cell;
}

export function storeControllerProposeRotate(src: ControllerProposeRotate) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3235774466, 32);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.slot, 8);
        b_0.storeUint(src.new_pubkey, 256);
        b_0.storeRef(src.approvals);
    };
}

export function loadControllerProposeRotate(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3235774466) { throw Error('Invalid prefix'); }
    const _nonce = sc_0.loadUintBig(64);
    const _slot = sc_0.loadUintBig(8);
    const _new_pubkey = sc_0.loadUintBig(256);
    const _approvals = sc_0.loadRef();
    return { $$type: 'ControllerProposeRotate' as const, nonce: _nonce, slot: _slot, new_pubkey: _new_pubkey, approvals: _approvals };
}

export function loadTupleControllerProposeRotate(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _slot = source.readBigNumber();
    const _new_pubkey = source.readBigNumber();
    const _approvals = source.readCell();
    return { $$type: 'ControllerProposeRotate' as const, nonce: _nonce, slot: _slot, new_pubkey: _new_pubkey, approvals: _approvals };
}

export function loadGetterTupleControllerProposeRotate(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _slot = source.readBigNumber();
    const _new_pubkey = source.readBigNumber();
    const _approvals = source.readCell();
    return { $$type: 'ControllerProposeRotate' as const, nonce: _nonce, slot: _slot, new_pubkey: _new_pubkey, approvals: _approvals };
}

export function storeTupleControllerProposeRotate(source: ControllerProposeRotate) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.slot);
    builder.writeNumber(source.new_pubkey);
    builder.writeCell(source.approvals);
    return builder.build();
}

export function dictValueParserControllerProposeRotate(): DictionaryValue<ControllerProposeRotate> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeControllerProposeRotate(src)).endCell());
        },
        parse: (src) => {
            return loadControllerProposeRotate(src.loadRef().beginParse());
        }
    }
}

export type ControllerProposeCancel = {
    $$type: 'ControllerProposeCancel';
    nonce: bigint;
    approvals: Cell;
}

export function storeControllerProposeCancel(src: ControllerProposeCancel) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3235774467, 32);
        b_0.storeUint(src.nonce, 64);
        b_0.storeRef(src.approvals);
    };
}

export function loadControllerProposeCancel(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3235774467) { throw Error('Invalid prefix'); }
    const _nonce = sc_0.loadUintBig(64);
    const _approvals = sc_0.loadRef();
    return { $$type: 'ControllerProposeCancel' as const, nonce: _nonce, approvals: _approvals };
}

export function loadTupleControllerProposeCancel(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _approvals = source.readCell();
    return { $$type: 'ControllerProposeCancel' as const, nonce: _nonce, approvals: _approvals };
}

export function loadGetterTupleControllerProposeCancel(source: TupleReader) {
    const _nonce = source.readBigNumber();
    const _approvals = source.readCell();
    return { $$type: 'ControllerProposeCancel' as const, nonce: _nonce, approvals: _approvals };
}

export function storeTupleControllerProposeCancel(source: ControllerProposeCancel) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.nonce);
    builder.writeCell(source.approvals);
    return builder.build();
}

export function dictValueParserControllerProposeCancel(): DictionaryValue<ControllerProposeCancel> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeControllerProposeCancel(src)).endCell());
        },
        parse: (src) => {
            return loadControllerProposeCancel(src.loadRef().beginParse());
        }
    }
}

export type ControllerExecute = {
    $$type: 'ControllerExecute';
}

export function storeControllerExecute(src: ControllerExecute) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3235774468, 32);
    };
}

export function loadControllerExecute(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3235774468) { throw Error('Invalid prefix'); }
    return { $$type: 'ControllerExecute' as const };
}

export function loadTupleControllerExecute(source: TupleReader) {
    return { $$type: 'ControllerExecute' as const };
}

export function loadGetterTupleControllerExecute(source: TupleReader) {
    return { $$type: 'ControllerExecute' as const };
}

export function storeTupleControllerExecute(source: ControllerExecute) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserControllerExecute(): DictionaryValue<ControllerExecute> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeControllerExecute(src)).endCell());
        },
        parse: (src) => {
            return loadControllerExecute(src.loadRef().beginParse());
        }
    }
}

export type ControllerStateView = {
    $$type: 'ControllerStateView';
    threshold: bigint;
    signer_count: bigint;
    nonce: bigint;
    timelock_seconds: bigint;
    has_pending: boolean;
    pending_kind: bigint;
    pending_effective_at: bigint;
    pending_manifest_hash: bigint;
    pending_target_vault: Address;
    pending_successor_vault: Address;
    pending_rotate_slot: bigint;
    pending_rotate_pubkey: bigint;
}

export function storeControllerStateView(src: ControllerStateView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.threshold, 257);
        b_0.storeInt(src.signer_count, 257);
        b_0.storeInt(src.nonce, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.timelock_seconds, 257);
        b_1.storeBit(src.has_pending);
        b_1.storeInt(src.pending_kind, 257);
        b_1.storeInt(src.pending_effective_at, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.pending_manifest_hash, 257);
        b_2.storeAddress(src.pending_target_vault);
        b_2.storeAddress(src.pending_successor_vault);
        const b_3 = new Builder();
        b_3.storeInt(src.pending_rotate_slot, 257);
        b_3.storeInt(src.pending_rotate_pubkey, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadControllerStateView(slice: Slice) {
    const sc_0 = slice;
    const _threshold = sc_0.loadIntBig(257);
    const _signer_count = sc_0.loadIntBig(257);
    const _nonce = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _timelock_seconds = sc_1.loadIntBig(257);
    const _has_pending = sc_1.loadBit();
    const _pending_kind = sc_1.loadIntBig(257);
    const _pending_effective_at = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pending_manifest_hash = sc_2.loadIntBig(257);
    const _pending_target_vault = sc_2.loadAddress();
    const _pending_successor_vault = sc_2.loadAddress();
    const sc_3 = sc_2.loadRef().beginParse();
    const _pending_rotate_slot = sc_3.loadIntBig(257);
    const _pending_rotate_pubkey = sc_3.loadIntBig(257);
    return { $$type: 'ControllerStateView' as const, threshold: _threshold, signer_count: _signer_count, nonce: _nonce, timelock_seconds: _timelock_seconds, has_pending: _has_pending, pending_kind: _pending_kind, pending_effective_at: _pending_effective_at, pending_manifest_hash: _pending_manifest_hash, pending_target_vault: _pending_target_vault, pending_successor_vault: _pending_successor_vault, pending_rotate_slot: _pending_rotate_slot, pending_rotate_pubkey: _pending_rotate_pubkey };
}

export function loadTupleControllerStateView(source: TupleReader) {
    const _threshold = source.readBigNumber();
    const _signer_count = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _timelock_seconds = source.readBigNumber();
    const _has_pending = source.readBoolean();
    const _pending_kind = source.readBigNumber();
    const _pending_effective_at = source.readBigNumber();
    const _pending_manifest_hash = source.readBigNumber();
    const _pending_target_vault = source.readAddress();
    const _pending_successor_vault = source.readAddress();
    const _pending_rotate_slot = source.readBigNumber();
    const _pending_rotate_pubkey = source.readBigNumber();
    return { $$type: 'ControllerStateView' as const, threshold: _threshold, signer_count: _signer_count, nonce: _nonce, timelock_seconds: _timelock_seconds, has_pending: _has_pending, pending_kind: _pending_kind, pending_effective_at: _pending_effective_at, pending_manifest_hash: _pending_manifest_hash, pending_target_vault: _pending_target_vault, pending_successor_vault: _pending_successor_vault, pending_rotate_slot: _pending_rotate_slot, pending_rotate_pubkey: _pending_rotate_pubkey };
}

export function loadGetterTupleControllerStateView(source: TupleReader) {
    const _threshold = source.readBigNumber();
    const _signer_count = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _timelock_seconds = source.readBigNumber();
    const _has_pending = source.readBoolean();
    const _pending_kind = source.readBigNumber();
    const _pending_effective_at = source.readBigNumber();
    const _pending_manifest_hash = source.readBigNumber();
    const _pending_target_vault = source.readAddress();
    const _pending_successor_vault = source.readAddress();
    const _pending_rotate_slot = source.readBigNumber();
    const _pending_rotate_pubkey = source.readBigNumber();
    return { $$type: 'ControllerStateView' as const, threshold: _threshold, signer_count: _signer_count, nonce: _nonce, timelock_seconds: _timelock_seconds, has_pending: _has_pending, pending_kind: _pending_kind, pending_effective_at: _pending_effective_at, pending_manifest_hash: _pending_manifest_hash, pending_target_vault: _pending_target_vault, pending_successor_vault: _pending_successor_vault, pending_rotate_slot: _pending_rotate_slot, pending_rotate_pubkey: _pending_rotate_pubkey };
}

export function storeTupleControllerStateView(source: ControllerStateView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.threshold);
    builder.writeNumber(source.signer_count);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.timelock_seconds);
    builder.writeBoolean(source.has_pending);
    builder.writeNumber(source.pending_kind);
    builder.writeNumber(source.pending_effective_at);
    builder.writeNumber(source.pending_manifest_hash);
    builder.writeAddress(source.pending_target_vault);
    builder.writeAddress(source.pending_successor_vault);
    builder.writeNumber(source.pending_rotate_slot);
    builder.writeNumber(source.pending_rotate_pubkey);
    return builder.build();
}

export function dictValueParserControllerStateView(): DictionaryValue<ControllerStateView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeControllerStateView(src)).endCell());
        },
        parse: (src) => {
            return loadControllerStateView(src.loadRef().beginParse());
        }
    }
}

export type PlathoController$Data = {
    $$type: 'PlathoController$Data';
    signers: Dictionary<bigint, bigint>;
    nonce: bigint;
    has_pending: boolean;
    pending_kind: bigint;
    pending_effective_at: bigint;
    pending_manifest_hash: bigint;
    pending_target_vault: Address;
    pending_successor_vault: Address;
    pending_rotate_slot: bigint;
    pending_rotate_pubkey: bigint;
}

export function storePlathoController$Data(src: PlathoController$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeDict(src.signers, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_0.storeUint(src.nonce, 64);
        b_0.storeBit(src.has_pending);
        b_0.storeUint(src.pending_kind, 8);
        b_0.storeUint(src.pending_effective_at, 64);
        b_0.storeUint(src.pending_manifest_hash, 256);
        b_0.storeAddress(src.pending_target_vault);
        b_0.storeAddress(src.pending_successor_vault);
        b_0.storeUint(src.pending_rotate_slot, 8);
        const b_1 = new Builder();
        b_1.storeUint(src.pending_rotate_pubkey, 256);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadPlathoController$Data(slice: Slice) {
    const sc_0 = slice;
    const _signers = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_0);
    const _nonce = sc_0.loadUintBig(64);
    const _has_pending = sc_0.loadBit();
    const _pending_kind = sc_0.loadUintBig(8);
    const _pending_effective_at = sc_0.loadUintBig(64);
    const _pending_manifest_hash = sc_0.loadUintBig(256);
    const _pending_target_vault = sc_0.loadAddress();
    const _pending_successor_vault = sc_0.loadAddress();
    const _pending_rotate_slot = sc_0.loadUintBig(8);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pending_rotate_pubkey = sc_1.loadUintBig(256);
    return { $$type: 'PlathoController$Data' as const, signers: _signers, nonce: _nonce, has_pending: _has_pending, pending_kind: _pending_kind, pending_effective_at: _pending_effective_at, pending_manifest_hash: _pending_manifest_hash, pending_target_vault: _pending_target_vault, pending_successor_vault: _pending_successor_vault, pending_rotate_slot: _pending_rotate_slot, pending_rotate_pubkey: _pending_rotate_pubkey };
}

export function loadTuplePlathoController$Data(source: TupleReader) {
    const _signers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _nonce = source.readBigNumber();
    const _has_pending = source.readBoolean();
    const _pending_kind = source.readBigNumber();
    const _pending_effective_at = source.readBigNumber();
    const _pending_manifest_hash = source.readBigNumber();
    const _pending_target_vault = source.readAddress();
    const _pending_successor_vault = source.readAddress();
    const _pending_rotate_slot = source.readBigNumber();
    const _pending_rotate_pubkey = source.readBigNumber();
    return { $$type: 'PlathoController$Data' as const, signers: _signers, nonce: _nonce, has_pending: _has_pending, pending_kind: _pending_kind, pending_effective_at: _pending_effective_at, pending_manifest_hash: _pending_manifest_hash, pending_target_vault: _pending_target_vault, pending_successor_vault: _pending_successor_vault, pending_rotate_slot: _pending_rotate_slot, pending_rotate_pubkey: _pending_rotate_pubkey };
}

export function loadGetterTuplePlathoController$Data(source: TupleReader) {
    const _signers = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _nonce = source.readBigNumber();
    const _has_pending = source.readBoolean();
    const _pending_kind = source.readBigNumber();
    const _pending_effective_at = source.readBigNumber();
    const _pending_manifest_hash = source.readBigNumber();
    const _pending_target_vault = source.readAddress();
    const _pending_successor_vault = source.readAddress();
    const _pending_rotate_slot = source.readBigNumber();
    const _pending_rotate_pubkey = source.readBigNumber();
    return { $$type: 'PlathoController$Data' as const, signers: _signers, nonce: _nonce, has_pending: _has_pending, pending_kind: _pending_kind, pending_effective_at: _pending_effective_at, pending_manifest_hash: _pending_manifest_hash, pending_target_vault: _pending_target_vault, pending_successor_vault: _pending_successor_vault, pending_rotate_slot: _pending_rotate_slot, pending_rotate_pubkey: _pending_rotate_pubkey };
}

export function storeTuplePlathoController$Data(source: PlathoController$Data) {
    const builder = new TupleBuilder();
    builder.writeCell(source.signers.size > 0 ? beginCell().storeDictDirect(source.signers, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeNumber(source.nonce);
    builder.writeBoolean(source.has_pending);
    builder.writeNumber(source.pending_kind);
    builder.writeNumber(source.pending_effective_at);
    builder.writeNumber(source.pending_manifest_hash);
    builder.writeAddress(source.pending_target_vault);
    builder.writeAddress(source.pending_successor_vault);
    builder.writeNumber(source.pending_rotate_slot);
    builder.writeNumber(source.pending_rotate_pubkey);
    return builder.build();
}

export function dictValueParserPlathoController$Data(): DictionaryValue<PlathoController$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePlathoController$Data(src)).endCell());
        },
        parse: (src) => {
            return loadPlathoController$Data(src.loadRef().beginParse());
        }
    }
}

 type PlathoController_init_args = {
    $$type: 'PlathoController_init_args';
    pk0: bigint;
    pk1: bigint;
    pk2: bigint;
    pk3: bigint;
    pk4: bigint;
}

function initPlathoController_init_args(src: PlathoController_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.pk0, 257);
        b_0.storeInt(src.pk1, 257);
        b_0.storeInt(src.pk2, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.pk3, 257);
        b_1.storeInt(src.pk4, 257);
        b_0.storeRef(b_1.endCell());
    };
}

async function PlathoController_init(pk0: bigint, pk1: bigint, pk2: bigint, pk3: bigint, pk4: bigint) {
    const __code = Cell.fromHex('b5ee9c724102150100057c000114ff00f4a413f4bcf2c80b01020162020e02f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e23f404d33fd200d307d33fd3fffa40fa40d307d401d0d3ff301a19181716151443306c1a8ea9810101d700810101d700810101d700d401d0810101d700810101d7003010251024102305d15503db3ce20b925f0be0702ad74920c21f1203045c95310ad31f0bde218210c0de0001bae302218210c0de0002bae302218210c0de0003bae3023b208210c0de0004ba0405080b04ec5b09d33ffa40d3fffa40d430c824cf165230cbff22cf16c9f9008161a9516dba16f2f4547cba547cba53cb561556170a11160a091115090811140807111307061112060511110504111004103f021117020111180171500fdb3c6ca1104d103e4d0cdb3c71db3c6c2232106910581047103610254400090a060c04fe5b09d33fd307d3ffd4308161aa23c105f2f48161ab22c300f2f4c85230cb075220cbffc9f9008161ac515cba15f2f4547ba9547ba953ba561456160a11150a0911140908111308071112070611110605111005104f103e021116020111170172500edb3c6ca110ab109a10891078106710561045104c103d4d0cdb3c72db3c090a0607003236368161bc07b317f2f47ff8238208093a80a008a408055076004e5b5517c87f01ca005590509af40017cb3f15ca0013cb07cb3fcbffcececb0701c8cbffcdc9ed5403be5b09d33fd4308161ad28f2f48161ae5129ba12f2f454787654787654787f5613091112090811110807111007106f105e104d103c102b0111130111147370db3c6ca1109b108a1079106810571046103510244300db3c3636707008a4085076090a0c0034c88210504c433101cb1ff828cf1652b0cb3f12cb07cbffc9f90000f0707f7f2298219320c1059170e28e5c24d0d3078308d718228161b207bc16f2f48161b322c105f2f48101012056135422434133f40c6fa19401d70030925b6de28161b4216eb3f2f48161b5544930f910f2f404a423d74ac001943502d430956c22037001e202a410241023e810345f048161b632c202f2f402fe8efd30398161c65006f2f48161c7f82324bef2f423c0018e3333707f80405336c85982105355434d5003cb1fcbffcec92655304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb008e2203c0028e1c8101015416005468a0216e955b59f45a3098c801cf004133f442e205dee210571046700670061035102443000c0d0048c87f01ca005590509af40017cb3f15ca0013cb07cb3fcbffcececb0701c8cbffcdc9ed540070e0c0000ac1211ab08e2810795516c87f01ca005590509af40017cb3f15ca0013cb07cb3fcbffcececb0701c8cbffcdc9ed54e05f0af2c0820202700f1102bbb3903b51343480006388fd0134cff48034c1f4cff4fffe903e9034c1f5007434ffcc06864605c5854510cc1b06a3aa60404075c020404075c020404075c035007420404075c020404075c00c040944090408c1745540f6cf38b6cf1b2b201210002073752a8208093a80547ba9547ba953ba02bfb3d63b51343480006388fd0134cff48034c1f4cff4fffe903e9034c1f5007434ffcc06864605c5854510cc1b06a3aa60404075c020404075c020404075c035007420404075c020404075c00c040944090408c1745540f6cf38954276cf1b2860121401f06d81010170211034413018216e955b59f45a3098c801cf004133f442e281010171211034413016216e955b59f45a3098c801cf004133f442e2810101722110344130216e955b59f45a3098c801cf004133f442e2810101732110344130216e955b59f45a3098c801cf004133f442e281010174211034413013003a216e955b59f45a3098c801cf004133f442e27070547111f828f82853220038810101530b50334133f40c6fa19401d70030925b6de2206e923070e094ebc66c');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initPlathoController_init_args({ $$type: 'PlathoController_init_args', pk0, pk1, pk2, pk3, pk4 })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const PlathoController_errors = {
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

export const PlathoController_errors_backward = {
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

const PlathoController_types: ABIType[] = [
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
    {"name":"AnnounceSuccessorManifest","header":1398096717,"fields":[{"name":"successor_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"successor_vault","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ControllerProposeSuccessor","header":3235774465,"fields":[{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"target_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"successor_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"successor_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"approvals","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"ControllerProposeRotate","header":3235774466,"fields":[{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"slot","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"new_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"approvals","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"ControllerProposeCancel","header":3235774467,"fields":[{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"approvals","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"ControllerExecute","header":3235774468,"fields":[]},
    {"name":"ControllerStateView","header":null,"fields":[{"name":"threshold","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"signer_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"timelock_seconds","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"has_pending","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pending_kind","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_effective_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_target_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_successor_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_rotate_slot","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pending_rotate_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"PlathoController$Data","header":null,"fields":[{"name":"signers","type":{"kind":"dict","key":"int","value":"int"}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"has_pending","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pending_kind","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"pending_effective_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"pending_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pending_target_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_successor_vault","type":{"kind":"simple","type":"address","optional":false}},{"name":"pending_rotate_slot","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"pending_rotate_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
]

const PlathoController_opcodes = {
    "AnnounceSuccessorManifest": 1398096717,
    "ControllerProposeSuccessor": 3235774465,
    "ControllerProposeRotate": 3235774466,
    "ControllerProposeCancel": 3235774467,
    "ControllerExecute": 3235774468,
}

const PlathoController_getters: ABIGetter[] = [
    {"name":"get_controller_state","methodId":69184,"arguments":[],"returnType":{"kind":"simple","type":"ControllerStateView","optional":false}},
    {"name":"get_signer","methodId":73560,"arguments":[{"name":"slot","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
]

export const PlathoController_getterMapping: { [key: string]: string } = {
    'get_controller_state': 'getGetControllerState',
    'get_signer': 'getGetSigner',
}

const PlathoController_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"ControllerProposeSuccessor"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ControllerProposeRotate"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ControllerProposeCancel"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ControllerExecute"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const CONTROLLER_THRESHOLD = 3n;
export const CONTROLLER_SIGNER_COUNT = 5n;
export const CONTROLLER_TIMELOCK_SECONDS = 604800n;
export const CONTROLLER_SIGN_DOMAIN = 1347175217n;
export const CTRL_ACT_ANNOUNCE_SUCCESSOR = 1n;
export const CTRL_ACT_ROTATE_SIGNER = 2n;
export const CTRL_ACT_CANCEL = 3n;

export class PlathoController implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = PlathoController_errors_backward;
    public static readonly opcodes = PlathoController_opcodes;
    
    static async init(pk0: bigint, pk1: bigint, pk2: bigint, pk3: bigint, pk4: bigint) {
        return await PlathoController_init(pk0, pk1, pk2, pk3, pk4);
    }
    
    static async fromInit(pk0: bigint, pk1: bigint, pk2: bigint, pk3: bigint, pk4: bigint) {
        const __gen_init = await PlathoController_init(pk0, pk1, pk2, pk3, pk4);
        const address = contractAddress(0, __gen_init);
        return new PlathoController(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new PlathoController(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  PlathoController_types,
        getters: PlathoController_getters,
        receivers: PlathoController_receivers,
        errors: PlathoController_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: ControllerProposeSuccessor | ControllerProposeRotate | ControllerProposeCancel | ControllerExecute | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ControllerProposeSuccessor') {
            body = beginCell().store(storeControllerProposeSuccessor(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ControllerProposeRotate') {
            body = beginCell().store(storeControllerProposeRotate(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ControllerProposeCancel') {
            body = beginCell().store(storeControllerProposeCancel(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ControllerExecute') {
            body = beginCell().store(storeControllerExecute(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetControllerState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_controller_state', builder.build())).stack;
        const result = loadGetterTupleControllerStateView(source);
        return result;
    }
    
    async getGetSigner(provider: ContractProvider, slot: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(slot);
        const source = (await provider.get('get_signer', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
}