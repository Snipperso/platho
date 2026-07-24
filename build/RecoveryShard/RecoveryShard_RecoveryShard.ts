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

export type RecoveryStore = {
    $$type: 'RecoveryStore';
    owner_pubkey: bigint;
    slot_index: bigint;
    seq: bigint;
    h0: bigint;
    h1: bigint;
    bh: bigint;
    body: Cell;
    owner_sig: Cell;
}

export function storeRecoveryStore(src: RecoveryStore) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1380144689, 32);
        b_0.storeUint(src.owner_pubkey, 256);
        b_0.storeUint(src.slot_index, 32);
        b_0.storeUint(src.seq, 64);
        b_0.storeUint(src.h0, 256);
        b_0.storeUint(src.h1, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.bh, 256);
        b_1.storeRef(src.body);
        b_1.storeRef(src.owner_sig);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecoveryStore(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1380144689) { throw Error('Invalid prefix'); }
    const _owner_pubkey = sc_0.loadUintBig(256);
    const _slot_index = sc_0.loadUintBig(32);
    const _seq = sc_0.loadUintBig(64);
    const _h0 = sc_0.loadUintBig(256);
    const _h1 = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _bh = sc_1.loadUintBig(256);
    const _body = sc_1.loadRef();
    const _owner_sig = sc_1.loadRef();
    return { $$type: 'RecoveryStore' as const, owner_pubkey: _owner_pubkey, slot_index: _slot_index, seq: _seq, h0: _h0, h1: _h1, bh: _bh, body: _body, owner_sig: _owner_sig };
}

export function loadTupleRecoveryStore(source: TupleReader) {
    const _owner_pubkey = source.readBigNumber();
    const _slot_index = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _h0 = source.readBigNumber();
    const _h1 = source.readBigNumber();
    const _bh = source.readBigNumber();
    const _body = source.readCell();
    const _owner_sig = source.readCell();
    return { $$type: 'RecoveryStore' as const, owner_pubkey: _owner_pubkey, slot_index: _slot_index, seq: _seq, h0: _h0, h1: _h1, bh: _bh, body: _body, owner_sig: _owner_sig };
}

export function loadGetterTupleRecoveryStore(source: TupleReader) {
    const _owner_pubkey = source.readBigNumber();
    const _slot_index = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _h0 = source.readBigNumber();
    const _h1 = source.readBigNumber();
    const _bh = source.readBigNumber();
    const _body = source.readCell();
    const _owner_sig = source.readCell();
    return { $$type: 'RecoveryStore' as const, owner_pubkey: _owner_pubkey, slot_index: _slot_index, seq: _seq, h0: _h0, h1: _h1, bh: _bh, body: _body, owner_sig: _owner_sig };
}

export function storeTupleRecoveryStore(source: RecoveryStore) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.owner_pubkey);
    builder.writeNumber(source.slot_index);
    builder.writeNumber(source.seq);
    builder.writeNumber(source.h0);
    builder.writeNumber(source.h1);
    builder.writeNumber(source.bh);
    builder.writeCell(source.body);
    builder.writeCell(source.owner_sig);
    return builder.build();
}

export function dictValueParserRecoveryStore(): DictionaryValue<RecoveryStore> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecoveryStore(src)).endCell());
        },
        parse: (src) => {
            return loadRecoveryStore(src.loadRef().beginParse());
        }
    }
}

export type EvictRecovery = {
    $$type: 'EvictRecovery';
    refund_to: Address;
    owner_sig: Cell;
}

export function storeEvictRecovery(src: EvictRecovery) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1380144690, 32);
        b_0.storeAddress(src.refund_to);
        b_0.storeRef(src.owner_sig);
    };
}

export function loadEvictRecovery(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1380144690) { throw Error('Invalid prefix'); }
    const _refund_to = sc_0.loadAddress();
    const _owner_sig = sc_0.loadRef();
    return { $$type: 'EvictRecovery' as const, refund_to: _refund_to, owner_sig: _owner_sig };
}

export function loadTupleEvictRecovery(source: TupleReader) {
    const _refund_to = source.readAddress();
    const _owner_sig = source.readCell();
    return { $$type: 'EvictRecovery' as const, refund_to: _refund_to, owner_sig: _owner_sig };
}

export function loadGetterTupleEvictRecovery(source: TupleReader) {
    const _refund_to = source.readAddress();
    const _owner_sig = source.readCell();
    return { $$type: 'EvictRecovery' as const, refund_to: _refund_to, owner_sig: _owner_sig };
}

export function storeTupleEvictRecovery(source: EvictRecovery) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.refund_to);
    builder.writeCell(source.owner_sig);
    return builder.build();
}

export function dictValueParserEvictRecovery(): DictionaryValue<EvictRecovery> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEvictRecovery(src)).endCell());
        },
        parse: (src) => {
            return loadEvictRecovery(src.loadRef().beginParse());
        }
    }
}

export type RecoveryShardView = {
    $$type: 'RecoveryShardView';
    self_bucket_key: bigint;
    bound: boolean;
    owner_pubkey: bigint;
    seq: bigint;
    updated_at: bigint;
    retention: bigint;
    endowment: bigint;
    max_slots: bigint;
    h0: bigint;
    h1: bigint;
    bh: bigint;
    max_blob_cells: bigint;
}

export function storeRecoveryShardView(src: RecoveryShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.self_bucket_key, 257);
        b_0.storeBit(src.bound);
        b_0.storeInt(src.owner_pubkey, 257);
        b_0.storeInt(src.seq, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.updated_at, 257);
        b_1.storeInt(src.retention, 257);
        b_1.storeInt(src.endowment, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.max_slots, 257);
        b_2.storeInt(src.h0, 257);
        b_2.storeInt(src.h1, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.bh, 257);
        b_3.storeInt(src.max_blob_cells, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecoveryShardView(slice: Slice) {
    const sc_0 = slice;
    const _self_bucket_key = sc_0.loadIntBig(257);
    const _bound = sc_0.loadBit();
    const _owner_pubkey = sc_0.loadIntBig(257);
    const _seq = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _updated_at = sc_1.loadIntBig(257);
    const _retention = sc_1.loadIntBig(257);
    const _endowment = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _max_slots = sc_2.loadIntBig(257);
    const _h0 = sc_2.loadIntBig(257);
    const _h1 = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _bh = sc_3.loadIntBig(257);
    const _max_blob_cells = sc_3.loadIntBig(257);
    return { $$type: 'RecoveryShardView' as const, self_bucket_key: _self_bucket_key, bound: _bound, owner_pubkey: _owner_pubkey, seq: _seq, updated_at: _updated_at, retention: _retention, endowment: _endowment, max_slots: _max_slots, h0: _h0, h1: _h1, bh: _bh, max_blob_cells: _max_blob_cells };
}

export function loadTupleRecoveryShardView(source: TupleReader) {
    const _self_bucket_key = source.readBigNumber();
    const _bound = source.readBoolean();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _endowment = source.readBigNumber();
    const _max_slots = source.readBigNumber();
    const _h0 = source.readBigNumber();
    const _h1 = source.readBigNumber();
    const _bh = source.readBigNumber();
    const _max_blob_cells = source.readBigNumber();
    return { $$type: 'RecoveryShardView' as const, self_bucket_key: _self_bucket_key, bound: _bound, owner_pubkey: _owner_pubkey, seq: _seq, updated_at: _updated_at, retention: _retention, endowment: _endowment, max_slots: _max_slots, h0: _h0, h1: _h1, bh: _bh, max_blob_cells: _max_blob_cells };
}

export function loadGetterTupleRecoveryShardView(source: TupleReader) {
    const _self_bucket_key = source.readBigNumber();
    const _bound = source.readBoolean();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _updated_at = source.readBigNumber();
    const _retention = source.readBigNumber();
    const _endowment = source.readBigNumber();
    const _max_slots = source.readBigNumber();
    const _h0 = source.readBigNumber();
    const _h1 = source.readBigNumber();
    const _bh = source.readBigNumber();
    const _max_blob_cells = source.readBigNumber();
    return { $$type: 'RecoveryShardView' as const, self_bucket_key: _self_bucket_key, bound: _bound, owner_pubkey: _owner_pubkey, seq: _seq, updated_at: _updated_at, retention: _retention, endowment: _endowment, max_slots: _max_slots, h0: _h0, h1: _h1, bh: _bh, max_blob_cells: _max_blob_cells };
}

export function storeTupleRecoveryShardView(source: RecoveryShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.self_bucket_key);
    builder.writeBoolean(source.bound);
    builder.writeNumber(source.owner_pubkey);
    builder.writeNumber(source.seq);
    builder.writeNumber(source.updated_at);
    builder.writeNumber(source.retention);
    builder.writeNumber(source.endowment);
    builder.writeNumber(source.max_slots);
    builder.writeNumber(source.h0);
    builder.writeNumber(source.h1);
    builder.writeNumber(source.bh);
    builder.writeNumber(source.max_blob_cells);
    return builder.build();
}

export function dictValueParserRecoveryShardView(): DictionaryValue<RecoveryShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecoveryShardView(src)).endCell());
        },
        parse: (src) => {
            return loadRecoveryShardView(src.loadRef().beginParse());
        }
    }
}

export type RecoveryShard$Data = {
    $$type: 'RecoveryShard$Data';
    self_bucket_key: bigint;
    bound: boolean;
    owner_pubkey: bigint;
    seq: bigint;
    h0: bigint;
    h1: bigint;
    bh: bigint;
    body: Cell;
    updated_at: bigint;
}

export function storeRecoveryShard$Data(src: RecoveryShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.self_bucket_key, 256);
        b_0.storeBit(src.bound);
        b_0.storeUint(src.owner_pubkey, 256);
        b_0.storeUint(src.seq, 64);
        b_0.storeUint(src.h0, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.h1, 256);
        b_1.storeUint(src.bh, 256);
        b_1.storeRef(src.body);
        b_1.storeUint(src.updated_at, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadRecoveryShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _self_bucket_key = sc_0.loadUintBig(256);
    const _bound = sc_0.loadBit();
    const _owner_pubkey = sc_0.loadUintBig(256);
    const _seq = sc_0.loadUintBig(64);
    const _h0 = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _h1 = sc_1.loadUintBig(256);
    const _bh = sc_1.loadUintBig(256);
    const _body = sc_1.loadRef();
    const _updated_at = sc_1.loadUintBig(64);
    return { $$type: 'RecoveryShard$Data' as const, self_bucket_key: _self_bucket_key, bound: _bound, owner_pubkey: _owner_pubkey, seq: _seq, h0: _h0, h1: _h1, bh: _bh, body: _body, updated_at: _updated_at };
}

export function loadTupleRecoveryShard$Data(source: TupleReader) {
    const _self_bucket_key = source.readBigNumber();
    const _bound = source.readBoolean();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _h0 = source.readBigNumber();
    const _h1 = source.readBigNumber();
    const _bh = source.readBigNumber();
    const _body = source.readCell();
    const _updated_at = source.readBigNumber();
    return { $$type: 'RecoveryShard$Data' as const, self_bucket_key: _self_bucket_key, bound: _bound, owner_pubkey: _owner_pubkey, seq: _seq, h0: _h0, h1: _h1, bh: _bh, body: _body, updated_at: _updated_at };
}

export function loadGetterTupleRecoveryShard$Data(source: TupleReader) {
    const _self_bucket_key = source.readBigNumber();
    const _bound = source.readBoolean();
    const _owner_pubkey = source.readBigNumber();
    const _seq = source.readBigNumber();
    const _h0 = source.readBigNumber();
    const _h1 = source.readBigNumber();
    const _bh = source.readBigNumber();
    const _body = source.readCell();
    const _updated_at = source.readBigNumber();
    return { $$type: 'RecoveryShard$Data' as const, self_bucket_key: _self_bucket_key, bound: _bound, owner_pubkey: _owner_pubkey, seq: _seq, h0: _h0, h1: _h1, bh: _bh, body: _body, updated_at: _updated_at };
}

export function storeTupleRecoveryShard$Data(source: RecoveryShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.self_bucket_key);
    builder.writeBoolean(source.bound);
    builder.writeNumber(source.owner_pubkey);
    builder.writeNumber(source.seq);
    builder.writeNumber(source.h0);
    builder.writeNumber(source.h1);
    builder.writeNumber(source.bh);
    builder.writeCell(source.body);
    builder.writeNumber(source.updated_at);
    return builder.build();
}

export function dictValueParserRecoveryShard$Data(): DictionaryValue<RecoveryShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRecoveryShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadRecoveryShard$Data(src.loadRef().beginParse());
        }
    }
}

 type RecoveryShard_init_args = {
    $$type: 'RecoveryShard_init_args';
    self_bucket_key: bigint;
}

function initRecoveryShard_init_args(src: RecoveryShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.self_bucket_key, 257);
    };
}

async function RecoveryShard_init(self_bucket_key: bigint) {
    const __code = Cell.fromHex('b5ee9c72410212010003b3000114ff00f4a413f4bcf2c80b01020162020c04f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e21d3ffd200d3ffd33fd3ffd401d0d3ffd3ffd4d33f30104910481047104610456c198e90810101d7000101d17070547000208821e20a925f0ae07029d74920c21f953109d31f0ade21821052435631bae30221821052435632bae3023a1003080b02fc5b08d3ffd31fd33fd3ffd3ffd430d0d3ffd4d43081350325c3009324c3009170e29323c3009170e2f2f48134f522f90024baf2f4813504f8416f24135f03820a392720bef2f4218309f9415b8134f801c150f2f42d8e12368134fb517cba17f2f48134fc534abcf2f4e30e107c106b105a104910384cbd813506543f9d2e0406019e813505536cbcf2f481350827810110b9f2f48135072f09111009108f107e106d105c104b103a02111102011112015610011110db3c373750d5ba1ff2f4103d102c104b7f0b105a4980104706050304050024c8821052534c4b01cb1f12cbffcb1fc9f90002c05611db3c6c6105d0541505f91019f2f4f8238209bf152072fb02f8427081008270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00181710365e224130070a0044c813cbffcbffcbffc9c882104252533101cb1ff828cf1652b0cbff12cb3fccc9f90003e05b08fa40d4308134f928f2f418175069151443308134fd51b9db3c385f0505d001f91014f2f470705470008853111881008270136d6d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010571046550309100a0038c882105253455601cb1ff828cf1652a0cbff5270cb3f01cf16c9f900004cc87f01ca0055805089cbff16ca0014cbff12cb3fcbff01c8cbff12cbff12cc12cb3fcdc9ed540072c00009c12119b08e2a10685515c87f01ca0055805089cbff16ca0014cbff12cb3fcbff01c8cbff12cbff12cc12cb3fcdc9ed54e05f09f2c0820201200d0f0285bd4a976a268690000c710e9ffe90069ffe99fe9ffea00e869ffe9ffea699f9808248824082388230822b60cc748408080eb800080e8b8382a3800104410f16d9e364e4100e003e821005a39a808209bf15208307804f2c514c514c514c51485530546dd052d00285bcc2df6a268690000c710e9ffe90069ffe99fe9ffea00e869ffe9ffea699f9808248824082388230822b60cc748408080eb800080e8b8382a3800104410f16d9e3648c10110000000221c4c82759');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initRecoveryShard_init_args({ $$type: 'RecoveryShard_init_args', self_bucket_key })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const RecoveryShard_errors = {
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

export const RecoveryShard_errors_backward = {
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

const RecoveryShard_types: ABIType[] = [
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
    {"name":"RecoveryStore","header":1380144689,"fields":[{"name":"owner_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"slot_index","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"h0","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"h1","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"bh","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"owner_sig","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"EvictRecovery","header":1380144690,"fields":[{"name":"refund_to","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner_sig","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"RecoveryShardView","header":null,"fields":[{"name":"self_bucket_key","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"seq","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"updated_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"retention","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"endowment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_slots","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"h0","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"h1","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bh","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_blob_cells","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"RecoveryShard$Data","header":null,"fields":[{"name":"self_bucket_key","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"h0","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"h1","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"bh","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"body","type":{"kind":"simple","type":"cell","optional":false}},{"name":"updated_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const RecoveryShard_opcodes = {
    "RecoveryStore": 1380144689,
    "EvictRecovery": 1380144690,
}

const RecoveryShard_getters: ABIGetter[] = [
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"RecoveryShardView","optional":false}},
    {"name":"get_body","methodId":104539,"arguments":[],"returnType":{"kind":"simple","type":"cell","optional":false}},
]

export const RecoveryShard_getterMapping: { [key: string]: string } = {
    'get_view': 'getGetView',
    'get_body': 'getGetBody',
}

const RecoveryShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"RecoveryStore"}},
    {"receiver":"internal","message":{"kind":"typed","type":"EvictRecovery"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const RS_RECOVERY_DOMAIN = 1112691505n;
export const RS_SLOT_DOMAIN = 1381190731n;
export const RS_EVICT_DOMAIN = 1381188950n;
export const RS_MAX_SLOTS = 256n;
export const RS_NAMED_SLOTS = 16n;
export const RS_RECOVERY_RETENTION = 94608000n;
export const RS_RECOVERY_ENDOWMENT = 29300000n;
export const RS_MAX_BLOB_CELLS = 79n;
export const RS_BLOB_PROBE_CELLS = 1024n;
export const RS_RECOVERY_PATH_GAS = 8000000n;
export const RS_MIN_VALUE = 37300000n;

export class RecoveryShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = RecoveryShard_errors_backward;
    public static readonly opcodes = RecoveryShard_opcodes;
    
    static async init(self_bucket_key: bigint) {
        return await RecoveryShard_init(self_bucket_key);
    }
    
    static async fromInit(self_bucket_key: bigint) {
        const __gen_init = await RecoveryShard_init(self_bucket_key);
        const address = contractAddress(0, __gen_init);
        return new RecoveryShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new RecoveryShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  RecoveryShard_types,
        getters: RecoveryShard_getters,
        receivers: RecoveryShard_receivers,
        errors: RecoveryShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: RecoveryStore | EvictRecovery | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RecoveryStore') {
            body = beginCell().store(storeRecoveryStore(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'EvictRecovery') {
            body = beginCell().store(storeEvictRecovery(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTupleRecoveryShardView(source);
        return result;
    }
    
    async getGetBody(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_body', builder.build())).stack;
        const result = source.readCell();
        return result;
    }
    
}