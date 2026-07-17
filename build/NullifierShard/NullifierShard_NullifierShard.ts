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

export type NullifierSpend = {
    $$type: 'NullifierSpend';
    spend_pubkey: bigint;
    epoch: bigint;
    nonce: bigint;
    subkey_pubkey: bigint;
    valid_from: bigint;
    valid_to: bigint;
    root_idx_a: bigint;
    root_idx_b: bigint;
    issuer_sig: Cell;
    cert_sig_a: Cell;
    cert_sig_b: Cell;
}

export function storeNullifierSpend(src: NullifierSpend) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1314082866, 32);
        b_0.storeUint(src.spend_pubkey, 256);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.nonce, 64);
        b_0.storeUint(src.subkey_pubkey, 256);
        b_0.storeUint(src.valid_from, 32);
        b_0.storeUint(src.valid_to, 32);
        b_0.storeUint(src.root_idx_a, 8);
        b_0.storeUint(src.root_idx_b, 8);
        b_0.storeRef(src.issuer_sig);
        b_0.storeRef(src.cert_sig_a);
        b_0.storeRef(src.cert_sig_b);
    };
}

export function loadNullifierSpend(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1314082866) { throw Error('Invalid prefix'); }
    const _spend_pubkey = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    const _nonce = sc_0.loadUintBig(64);
    const _subkey_pubkey = sc_0.loadUintBig(256);
    const _valid_from = sc_0.loadUintBig(32);
    const _valid_to = sc_0.loadUintBig(32);
    const _root_idx_a = sc_0.loadUintBig(8);
    const _root_idx_b = sc_0.loadUintBig(8);
    const _issuer_sig = sc_0.loadRef();
    const _cert_sig_a = sc_0.loadRef();
    const _cert_sig_b = sc_0.loadRef();
    return { $$type: 'NullifierSpend' as const, spend_pubkey: _spend_pubkey, epoch: _epoch, nonce: _nonce, subkey_pubkey: _subkey_pubkey, valid_from: _valid_from, valid_to: _valid_to, root_idx_a: _root_idx_a, root_idx_b: _root_idx_b, issuer_sig: _issuer_sig, cert_sig_a: _cert_sig_a, cert_sig_b: _cert_sig_b };
}

export function loadTupleNullifierSpend(source: TupleReader) {
    const _spend_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _subkey_pubkey = source.readBigNumber();
    const _valid_from = source.readBigNumber();
    const _valid_to = source.readBigNumber();
    const _root_idx_a = source.readBigNumber();
    const _root_idx_b = source.readBigNumber();
    const _issuer_sig = source.readCell();
    const _cert_sig_a = source.readCell();
    const _cert_sig_b = source.readCell();
    return { $$type: 'NullifierSpend' as const, spend_pubkey: _spend_pubkey, epoch: _epoch, nonce: _nonce, subkey_pubkey: _subkey_pubkey, valid_from: _valid_from, valid_to: _valid_to, root_idx_a: _root_idx_a, root_idx_b: _root_idx_b, issuer_sig: _issuer_sig, cert_sig_a: _cert_sig_a, cert_sig_b: _cert_sig_b };
}

export function loadGetterTupleNullifierSpend(source: TupleReader) {
    const _spend_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _nonce = source.readBigNumber();
    const _subkey_pubkey = source.readBigNumber();
    const _valid_from = source.readBigNumber();
    const _valid_to = source.readBigNumber();
    const _root_idx_a = source.readBigNumber();
    const _root_idx_b = source.readBigNumber();
    const _issuer_sig = source.readCell();
    const _cert_sig_a = source.readCell();
    const _cert_sig_b = source.readCell();
    return { $$type: 'NullifierSpend' as const, spend_pubkey: _spend_pubkey, epoch: _epoch, nonce: _nonce, subkey_pubkey: _subkey_pubkey, valid_from: _valid_from, valid_to: _valid_to, root_idx_a: _root_idx_a, root_idx_b: _root_idx_b, issuer_sig: _issuer_sig, cert_sig_a: _cert_sig_a, cert_sig_b: _cert_sig_b };
}

export function storeTupleNullifierSpend(source: NullifierSpend) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.spend_pubkey);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.nonce);
    builder.writeNumber(source.subkey_pubkey);
    builder.writeNumber(source.valid_from);
    builder.writeNumber(source.valid_to);
    builder.writeNumber(source.root_idx_a);
    builder.writeNumber(source.root_idx_b);
    builder.writeCell(source.issuer_sig);
    builder.writeCell(source.cert_sig_a);
    builder.writeCell(source.cert_sig_b);
    return builder.build();
}

export function dictValueParserNullifierSpend(): DictionaryValue<NullifierSpend> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullifierSpend(src)).endCell());
        },
        parse: (src) => {
            return loadNullifierSpend(src.loadRef().beginParse());
        }
    }
}

export type NullifierShardView = {
    $$type: 'NullifierShardView';
    epoch: bigint;
    lane: bigint;
    spent_count: bigint;
    lane_count: bigint;
    safe_cap: bigint;
    root_threshold: bigint;
    max_cert_epochs: bigint;
}

export function storeNullifierShardView(src: NullifierShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.lane, 257);
        b_0.storeInt(src.spent_count, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.lane_count, 257);
        b_1.storeInt(src.safe_cap, 257);
        b_1.storeInt(src.root_threshold, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.max_cert_epochs, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadNullifierShardView(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadIntBig(257);
    const _lane = sc_0.loadIntBig(257);
    const _spent_count = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _lane_count = sc_1.loadIntBig(257);
    const _safe_cap = sc_1.loadIntBig(257);
    const _root_threshold = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _max_cert_epochs = sc_2.loadIntBig(257);
    return { $$type: 'NullifierShardView' as const, epoch: _epoch, lane: _lane, spent_count: _spent_count, lane_count: _lane_count, safe_cap: _safe_cap, root_threshold: _root_threshold, max_cert_epochs: _max_cert_epochs };
}

export function loadTupleNullifierShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent_count = source.readBigNumber();
    const _lane_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _root_threshold = source.readBigNumber();
    const _max_cert_epochs = source.readBigNumber();
    return { $$type: 'NullifierShardView' as const, epoch: _epoch, lane: _lane, spent_count: _spent_count, lane_count: _lane_count, safe_cap: _safe_cap, root_threshold: _root_threshold, max_cert_epochs: _max_cert_epochs };
}

export function loadGetterTupleNullifierShardView(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent_count = source.readBigNumber();
    const _lane_count = source.readBigNumber();
    const _safe_cap = source.readBigNumber();
    const _root_threshold = source.readBigNumber();
    const _max_cert_epochs = source.readBigNumber();
    return { $$type: 'NullifierShardView' as const, epoch: _epoch, lane: _lane, spent_count: _spent_count, lane_count: _lane_count, safe_cap: _safe_cap, root_threshold: _root_threshold, max_cert_epochs: _max_cert_epochs };
}

export function storeTupleNullifierShardView(source: NullifierShardView) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.lane);
    builder.writeNumber(source.spent_count);
    builder.writeNumber(source.lane_count);
    builder.writeNumber(source.safe_cap);
    builder.writeNumber(source.root_threshold);
    builder.writeNumber(source.max_cert_epochs);
    return builder.build();
}

export function dictValueParserNullifierShardView(): DictionaryValue<NullifierShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullifierShardView(src)).endCell());
        },
        parse: (src) => {
            return loadNullifierShardView(src.loadRef().beginParse());
        }
    }
}

export type NullifierShard$Data = {
    $$type: 'NullifierShard$Data';
    epoch: bigint;
    lane: bigint;
    spent: Dictionary<bigint, boolean>;
    spent_count: bigint;
}

export function storeNullifierShard$Data(src: NullifierShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.lane, 32);
        b_0.storeDict(src.spent, Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
        b_0.storeUint(src.spent_count, 32);
    };
}

export function loadNullifierShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _epoch = sc_0.loadUintBig(32);
    const _lane = sc_0.loadUintBig(32);
    const _spent = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), sc_0);
    const _spent_count = sc_0.loadUintBig(32);
    return { $$type: 'NullifierShard$Data' as const, epoch: _epoch, lane: _lane, spent: _spent, spent_count: _spent_count };
}

export function loadTupleNullifierShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), source.readCellOpt());
    const _spent_count = source.readBigNumber();
    return { $$type: 'NullifierShard$Data' as const, epoch: _epoch, lane: _lane, spent: _spent, spent_count: _spent_count };
}

export function loadGetterTupleNullifierShard$Data(source: TupleReader) {
    const _epoch = source.readBigNumber();
    const _lane = source.readBigNumber();
    const _spent = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), source.readCellOpt());
    const _spent_count = source.readBigNumber();
    return { $$type: 'NullifierShard$Data' as const, epoch: _epoch, lane: _lane, spent: _spent, spent_count: _spent_count };
}

export function storeTupleNullifierShard$Data(source: NullifierShard$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.lane);
    builder.writeCell(source.spent.size > 0 ? beginCell().storeDictDirect(source.spent, Dictionary.Keys.BigInt(257), Dictionary.Values.Bool()).endCell() : null);
    builder.writeNumber(source.spent_count);
    return builder.build();
}

export function dictValueParserNullifierShard$Data(): DictionaryValue<NullifierShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNullifierShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadNullifierShard$Data(src.loadRef().beginParse());
        }
    }
}

 type NullifierShard_init_args = {
    $$type: 'NullifierShard_init_args';
    epoch: bigint;
    lane: bigint;
}

function initNullifierShard_init_args(src: NullifierShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.epoch, 257);
        b_0.storeInt(src.lane, 257);
    };
}

async function NullifierShard_init(epoch: bigint, lane: bigint) {
    const __code = Cell.fromHex('b5ee9c7241021001000308000114ff00f4a413f4bcf2c80b01020162020a02f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019cd31fd31ff404d31f55306c148e10810101d700810101d7005902d1016d70e205925f05e07024d74920c21f953104d31f05de2182104e535032bae30235c00004c12114b08e164003c87f01ca0055305034cb1fcb1ff400cb1fc9ed54e0030903fe5b03d3ffd31fd33fd3ffd31fd31fd307d307d4d4d430f82382015180a90481352021a6fc52c0be9601a60452b0bb923170e2f2f481353553adbaf2f4105c104b103d4ea05299db3c81353621a9381325baf2f481353e5396be93519cbb923970e219f2f481354425810226a052c0bbf2f481353f53acb9f2f4550309db3c0b0406050028c882104253493101cb1f13cbffcb1fcb3fc9f90004fcdb3c81354053c1bdf2f41045103441305441abdb3c81354108d054411cf91017f2f481354204d04907f91012f2f481352107d0544216f91016f2f44104db3c8135242381010123714133f40c6fa19401d70030925b6de26ef2f481353722830bb9f2f412810101017f71216e955b59f45a3098c801cf004133f442e201a406070f0800f081354321c103f2f4208e233082f0884b8857f4eaa1613c61504db34d4beaf346517a0e31de3cddd4d9b4201d9d0be1c0018e2282f0a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0e082f074f85cda34d1c27c4621484731e91579c3d9c6cfc0d94b281aa11e9162058aa90028c882104341433101cb1f13cbffcb1fcb1fc9f9000028c87f01ca0055305034cb1fcb1ff400cb1fc9ed54000a5f04f2c0820201200b0d0159bd4a976a268690000ce698fe98ffa02698faa98360a4708408080eb80408080eb802c816880b6b8716d9e3623c0c001c8313830b72265136513503810226015dbf524f6a268690000ce698fe98ffa02698faa98360a4708408080eb80408080eb802c816880b6b8712a81ed9e3620c0e014022553181010106db3c4560714133f40c6fa19401d70030925b6de26eb34430120f001ec88210424e4c3101cb1fcbffc9f9005489b174');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initNullifierShard_init_args({ $$type: 'NullifierShard_init_args', epoch, lane })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const NullifierShard_errors = {
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

export const NullifierShard_errors_backward = {
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

const NullifierShard_types: ABIType[] = [
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
    {"name":"NullifierSpend","header":1314082866,"fields":[{"name":"spend_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"subkey_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"valid_from","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"valid_to","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"root_idx_a","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"root_idx_b","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"issuer_sig","type":{"kind":"simple","type":"cell","optional":false}},{"name":"cert_sig_a","type":{"kind":"simple","type":"cell","optional":false}},{"name":"cert_sig_b","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"NullifierShardView","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"lane","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"spent_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"lane_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"safe_cap","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"root_threshold","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_cert_epochs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"NullifierShard$Data","header":null,"fields":[{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"lane","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"spent","type":{"kind":"dict","key":"int","value":"bool"}},{"name":"spent_count","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const NullifierShard_opcodes = {
    "NullifierSpend": 1314082866,
}

const NullifierShard_getters: ABIGetter[] = [
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"NullifierShardView","optional":false}},
    {"name":"is_spent","methodId":125513,"arguments":[{"name":"serial","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"bool","optional":false}},
]

export const NullifierShard_getterMapping: { [key: string]: string } = {
    'get_view': 'getGetView',
    'is_spent': 'getIsSpent',
}

const NullifierShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"NullifierSpend"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const NS_ISSUER_SIG_DOMAIN = 1112754481n;
export const NS_NULL_DOMAIN = 1112427569n;
export const NS_CERT_DOMAIN = 1128350513n;
export const NS_EPOCH_SECONDS = 86400n;
export const NS_EPOCH_ACCEPT_PAST = 4n;
export const NS_EPOCH_ACCEPT_FUTURE = 4n;
export const NS_LANE_COUNT = 1048576n;
export const NS_SAFE_CAP = 4096n;
export const NS_MAX_CERT_EPOCHS = 550n;
export const NS_ROOT_THRESHOLD = 2n;
export const NS_ROOT_0 = 61648001945993851713387341017509757467197514600518013224456945346175643262219n;
export const NS_ROOT_1 = 72643295600563315702315007365945353005398927859637280636436839326056233411824n;
export const NS_ROOT_2 = 52907109351218747841695970573523340373205112110913690393551713332454347868841n;

export class NullifierShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = NullifierShard_errors_backward;
    public static readonly opcodes = NullifierShard_opcodes;
    
    static async init(epoch: bigint, lane: bigint) {
        return await NullifierShard_init(epoch, lane);
    }
    
    static async fromInit(epoch: bigint, lane: bigint) {
        const __gen_init = await NullifierShard_init(epoch, lane);
        const address = contractAddress(0, __gen_init);
        return new NullifierShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new NullifierShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  NullifierShard_types,
        getters: NullifierShard_getters,
        receivers: NullifierShard_receivers,
        errors: NullifierShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: NullifierSpend | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'NullifierSpend') {
            body = beginCell().store(storeNullifierSpend(message)).endCell();
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
        const result = loadGetterTupleNullifierShardView(source);
        return result;
    }
    
    async getIsSpent(provider: ContractProvider, serial: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(serial);
        const source = (await provider.get('is_spent', builder.build())).stack;
        const result = source.readBoolean();
        return result;
    }
    
}