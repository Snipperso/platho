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

export type KeyRegRegisterMessagingKeys = {
    $$type: 'KeyRegRegisterMessagingKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    auth_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
}

export function storeKeyRegRegisterMessagingKeys(src: KeyRegRegisterMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263683377, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        b_0.storeUint(src.scan_pubkey, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.auth_pubkey, 256);
        b_1.storeUint(src.pq_kem_pubkey_hash, 256);
        b_1.storeUint(src.pq_kem_pubkey_len, 16);
        b_1.storeRef(src.pq_kem_pubkey);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyRegRegisterMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263683377) { throw Error('Invalid prefix'); }
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const _scan_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _auth_pubkey = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    return { $$type: 'KeyRegRegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleKeyRegRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'KeyRegRegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleKeyRegRegisterMessagingKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'KeyRegRegisterMessagingKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleKeyRegRegisterMessagingKeys(source: KeyRegRegisterMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    return builder.build();
}

export function dictValueParserKeyRegRegisterMessagingKeys(): DictionaryValue<KeyRegRegisterMessagingKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegRegisterMessagingKeys(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegRegisterMessagingKeys(src.loadRef().beginParse());
        }
    }
}

export type KeyRegReplaceMessagingKeys = {
    $$type: 'KeyRegReplaceMessagingKeys';
    owner_wallet: Address;
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeKeyRegReplaceMessagingKeys(src: KeyRegReplaceMessagingKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263683378, 32);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadKeyRegReplaceMessagingKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263683378) { throw Error('Invalid prefix'); }
    const _owner_wallet = sc_0.loadAddress();
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'KeyRegReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleKeyRegReplaceMessagingKeys(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'KeyRegReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleKeyRegReplaceMessagingKeys(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'KeyRegReplaceMessagingKeys' as const, owner_wallet: _owner_wallet, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleKeyRegReplaceMessagingKeys(source: KeyRegReplaceMessagingKeys) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserKeyRegReplaceMessagingKeys(): DictionaryValue<KeyRegReplaceMessagingKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegReplaceMessagingKeys(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegReplaceMessagingKeys(src.loadRef().beginParse());
        }
    }
}

export type KeyRegBindController = {
    $$type: 'KeyRegBindController';
    deployment_manifest_hash: bigint;
}

export function storeKeyRegBindController(src: KeyRegBindController) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263683379, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadKeyRegBindController(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263683379) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'KeyRegBindController' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleKeyRegBindController(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'KeyRegBindController' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleKeyRegBindController(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'KeyRegBindController' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleKeyRegBindController(source: KeyRegBindController) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserKeyRegBindController(): DictionaryValue<KeyRegBindController> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegBindController(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegBindController(src.loadRef().beginParse());
        }
    }
}

export type KeyRegSealGenesis = {
    $$type: 'KeyRegSealGenesis';
    deployment_manifest_hash: bigint;
}

export function storeKeyRegSealGenesis(src: KeyRegSealGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(974311853, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadKeyRegSealGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 974311853) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'KeyRegSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleKeyRegSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'KeyRegSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleKeyRegSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'KeyRegSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleKeyRegSealGenesis(source: KeyRegSealGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserKeyRegSealGenesis(): DictionaryValue<KeyRegSealGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegSealGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegSealGenesis(src.loadRef().beginParse());
        }
    }
}

export type KeyRegTopUpStorageReserve = {
    $$type: 'KeyRegTopUpStorageReserve';
}

export function storeKeyRegTopUpStorageReserve(src: KeyRegTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263683380, 32);
    };
}

export function loadKeyRegTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263683380) { throw Error('Invalid prefix'); }
    return { $$type: 'KeyRegTopUpStorageReserve' as const };
}

export function loadTupleKeyRegTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'KeyRegTopUpStorageReserve' as const };
}

export function loadGetterTupleKeyRegTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'KeyRegTopUpStorageReserve' as const };
}

export function storeTupleKeyRegTopUpStorageReserve(source: KeyRegTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserKeyRegTopUpStorageReserve(): DictionaryValue<KeyRegTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type KeyAccount = {
    $$type: 'KeyAccount';
    owner_wallet: Address;
    current_key_id: bigint;
    auth_pubkey: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    registered_at: bigint;
}

export function storeKeyAccount(src: KeyAccount) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.current_key_id, 256);
        b_0.storeUint(src.auth_pubkey, 256);
        b_0.storeUint(src.key_generation, 32);
        b_0.storeUint(src.rotation_nonce, 64);
        b_0.storeUint(src.registered_at, 64);
    };
}

export function loadKeyAccount(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _current_key_id = sc_0.loadUintBig(256);
    const _auth_pubkey = sc_0.loadUintBig(256);
    const _key_generation = sc_0.loadUintBig(32);
    const _rotation_nonce = sc_0.loadUintBig(64);
    const _registered_at = sc_0.loadUintBig(64);
    return { $$type: 'KeyAccount' as const, owner_wallet: _owner_wallet, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, registered_at: _registered_at };
}

export function loadTupleKeyAccount(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _registered_at = source.readBigNumber();
    return { $$type: 'KeyAccount' as const, owner_wallet: _owner_wallet, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, registered_at: _registered_at };
}

export function loadGetterTupleKeyAccount(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _current_key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _registered_at = source.readBigNumber();
    return { $$type: 'KeyAccount' as const, owner_wallet: _owner_wallet, current_key_id: _current_key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, registered_at: _registered_at };
}

export function storeTupleKeyAccount(source: KeyAccount) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.registered_at);
    return builder.build();
}

export function dictValueParserKeyAccount(): DictionaryValue<KeyAccount> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyAccount(src)).endCell());
        },
        parse: (src) => {
            return loadKeyAccount(src.loadRef().beginParse());
        }
    }
}

export type KeyRecord = {
    $$type: 'KeyRecord';
    owner_wallet: Address;
    key_generation: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    revoked_at: bigint;
    revoked_lt: bigint;
}

export function storeKeyRecord(src: KeyRecord) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeUint(src.key_generation, 32);
        b_0.storeUint(src.enc_pubkey, 256);
        b_0.storeUint(src.sign_pubkey, 256);
        const b_1 = new Builder();
        b_1.storeUint(src.scan_pubkey, 256);
        b_1.storeUint(src.pq_kem_pubkey_hash, 256);
        b_1.storeUint(src.pq_kem_pubkey_len, 16);
        b_1.storeRef(src.pq_kem_pubkey);
        b_1.storeUint(src.crypto_suite_mask, 16);
        b_1.storeUint(src.created_at, 64);
        b_1.storeUint(src.created_lt, 64);
        b_1.storeUint(src.revoked_at, 64);
        b_1.storeUint(src.revoked_lt, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyRecord(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _key_generation = sc_0.loadUintBig(32);
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _scan_pubkey = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    const _created_at = sc_1.loadUintBig(64);
    const _created_lt = sc_1.loadUintBig(64);
    const _revoked_at = sc_1.loadUintBig(64);
    const _revoked_lt = sc_1.loadUintBig(64);
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadTupleKeyRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadGetterTupleKeyRecord(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRecord' as const, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function storeTupleKeyRecord(source: KeyRecord) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.revoked_at);
    builder.writeNumber(source.revoked_lt);
    return builder.build();
}

export function dictValueParserKeyRecord(): DictionaryValue<KeyRecord> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRecord(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRecord(src.loadRef().beginParse());
        }
    }
}

export type KeyRegKeyRecordView = {
    $$type: 'KeyRegKeyRecordView';
    exists: boolean;
    owner_wallet: Address;
    key_generation: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    revoked_at: bigint;
    revoked_lt: bigint;
}

export function storeKeyRegKeyRecordView(src: KeyRegKeyRecordView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.key_generation, 257);
        b_0.storeInt(src.enc_pubkey, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.sign_pubkey, 257);
        b_1.storeInt(src.scan_pubkey, 257);
        b_1.storeInt(src.pq_kem_pubkey_hash, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.pq_kem_pubkey_len, 257);
        b_2.storeRef(src.pq_kem_pubkey);
        b_2.storeInt(src.crypto_suite_mask, 257);
        b_2.storeInt(src.created_at, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.created_lt, 257);
        b_3.storeInt(src.revoked_at, 257);
        b_3.storeInt(src.revoked_lt, 257);
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyRegKeyRecordView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _key_generation = sc_0.loadIntBig(257);
    const _enc_pubkey = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _sign_pubkey = sc_1.loadIntBig(257);
    const _scan_pubkey = sc_1.loadIntBig(257);
    const _pq_kem_pubkey_hash = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pq_kem_pubkey_len = sc_2.loadIntBig(257);
    const _pq_kem_pubkey = sc_2.loadRef();
    const _crypto_suite_mask = sc_2.loadIntBig(257);
    const _created_at = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _created_lt = sc_3.loadIntBig(257);
    const _revoked_at = sc_3.loadIntBig(257);
    const _revoked_lt = sc_3.loadIntBig(257);
    return { $$type: 'KeyRegKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadTupleKeyRegKeyRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRegKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function loadGetterTupleKeyRegKeyRecordView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_generation = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _revoked_at = source.readBigNumber();
    const _revoked_lt = source.readBigNumber();
    return { $$type: 'KeyRegKeyRecordView' as const, exists: _exists, owner_wallet: _owner_wallet, key_generation: _key_generation, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, revoked_at: _revoked_at, revoked_lt: _revoked_lt };
}

export function storeTupleKeyRegKeyRecordView(source: KeyRegKeyRecordView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.revoked_at);
    builder.writeNumber(source.revoked_lt);
    return builder.build();
}

export function dictValueParserKeyRegKeyRecordView(): DictionaryValue<KeyRegKeyRecordView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegKeyRecordView(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegKeyRecordView(src.loadRef().beginParse());
        }
    }
}

export type KeyRegAccountView = {
    $$type: 'KeyRegAccountView';
    exists: boolean;
    owner_wallet: Address;
    current_key_id: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    registered_at: bigint;
}

export function storeKeyRegAccountView(src: KeyRegAccountView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.current_key_id, 257);
        b_0.storeInt(src.key_generation, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.rotation_nonce, 257);
        b_1.storeInt(src.registered_at, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyRegAccountView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _current_key_id = sc_0.loadIntBig(257);
    const _key_generation = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _rotation_nonce = sc_1.loadIntBig(257);
    const _registered_at = sc_1.loadIntBig(257);
    return { $$type: 'KeyRegAccountView' as const, exists: _exists, owner_wallet: _owner_wallet, current_key_id: _current_key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, registered_at: _registered_at };
}

export function loadTupleKeyRegAccountView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _current_key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _registered_at = source.readBigNumber();
    return { $$type: 'KeyRegAccountView' as const, exists: _exists, owner_wallet: _owner_wallet, current_key_id: _current_key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, registered_at: _registered_at };
}

export function loadGetterTupleKeyRegAccountView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _current_key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _registered_at = source.readBigNumber();
    return { $$type: 'KeyRegAccountView' as const, exists: _exists, owner_wallet: _owner_wallet, current_key_id: _current_key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, registered_at: _registered_at };
}

export function storeTupleKeyRegAccountView(source: KeyRegAccountView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.current_key_id);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.registered_at);
    return builder.build();
}

export function dictValueParserKeyRegAccountView(): DictionaryValue<KeyRegAccountView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegAccountView(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegAccountView(src.loadRef().beginParse());
        }
    }
}

export type KeyRegGlobalView = {
    $$type: 'KeyRegGlobalView';
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    genesis_controller_address: Address;
    account_count: bigint;
    key_record_count: bigint;
    key_record_storage_endowment: bigint;
    account_storage_endowment: bigint;
    base_storage_endowment: bigint;
}

export function storeKeyRegGlobalView(src: KeyRegGlobalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.genesis_controller_address);
        const b_1 = new Builder();
        b_1.storeInt(src.account_count, 257);
        b_1.storeInt(src.key_record_count, 257);
        b_1.storeInt(src.key_record_storage_endowment, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.account_storage_endowment, 257);
        b_2.storeInt(src.base_storage_endowment, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyRegGlobalView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _genesis_controller_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _account_count = sc_1.loadIntBig(257);
    const _key_record_count = sc_1.loadIntBig(257);
    const _key_record_storage_endowment = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _account_storage_endowment = sc_2.loadIntBig(257);
    const _base_storage_endowment = sc_2.loadIntBig(257);
    return { $$type: 'KeyRegGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, account_count: _account_count, key_record_count: _key_record_count, key_record_storage_endowment: _key_record_storage_endowment, account_storage_endowment: _account_storage_endowment, base_storage_endowment: _base_storage_endowment };
}

export function loadTupleKeyRegGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _account_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _key_record_storage_endowment = source.readBigNumber();
    const _account_storage_endowment = source.readBigNumber();
    const _base_storage_endowment = source.readBigNumber();
    return { $$type: 'KeyRegGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, account_count: _account_count, key_record_count: _key_record_count, key_record_storage_endowment: _key_record_storage_endowment, account_storage_endowment: _account_storage_endowment, base_storage_endowment: _base_storage_endowment };
}

export function loadGetterTupleKeyRegGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _account_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _key_record_storage_endowment = source.readBigNumber();
    const _account_storage_endowment = source.readBigNumber();
    const _base_storage_endowment = source.readBigNumber();
    return { $$type: 'KeyRegGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, account_count: _account_count, key_record_count: _key_record_count, key_record_storage_endowment: _key_record_storage_endowment, account_storage_endowment: _account_storage_endowment, base_storage_endowment: _base_storage_endowment };
}

export function storeTupleKeyRegGlobalView(source: KeyRegGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.account_count);
    builder.writeNumber(source.key_record_count);
    builder.writeNumber(source.key_record_storage_endowment);
    builder.writeNumber(source.account_storage_endowment);
    builder.writeNumber(source.base_storage_endowment);
    return builder.build();
}

export function dictValueParserKeyRegGlobalView(): DictionaryValue<KeyRegGlobalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegGlobalView(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegGlobalView(src.loadRef().beginParse());
        }
    }
}

export type KeyRegistry$Data = {
    $$type: 'KeyRegistry$Data';
    sealed: boolean;
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    account_count: bigint;
    key_record_count: bigint;
    accounts: Dictionary<bigint, KeyAccount>;
    key_records: Dictionary<bigint, KeyRecord>;
}

export function storeKeyRegistry$Data(src: KeyRegistry$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeUint(src.genesis_config_hash, 256);
        b_0.storeUint(src.account_count, 64);
        b_0.storeUint(src.key_record_count, 64);
        b_0.storeDict(src.accounts, Dictionary.Keys.BigInt(257), dictValueParserKeyAccount());
        b_0.storeDict(src.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord());
    };
}

export function loadKeyRegistry$Data(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _genesis_controller_address = sc_0.loadAddress();
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _genesis_config_hash = sc_0.loadUintBig(256);
    const _account_count = sc_0.loadUintBig(64);
    const _key_record_count = sc_0.loadUintBig(64);
    const _accounts = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserKeyAccount(), sc_0);
    const _key_records = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), sc_0);
    return { $$type: 'KeyRegistry$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, account_count: _account_count, key_record_count: _key_record_count, accounts: _accounts, key_records: _key_records };
}

export function loadTupleKeyRegistry$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _account_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _accounts = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyAccount(), source.readCellOpt());
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    return { $$type: 'KeyRegistry$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, account_count: _account_count, key_record_count: _key_record_count, accounts: _accounts, key_records: _key_records };
}

export function loadGetterTupleKeyRegistry$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _account_count = source.readBigNumber();
    const _key_record_count = source.readBigNumber();
    const _accounts = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyAccount(), source.readCellOpt());
    const _key_records = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserKeyRecord(), source.readCellOpt());
    return { $$type: 'KeyRegistry$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, account_count: _account_count, key_record_count: _key_record_count, accounts: _accounts, key_records: _key_records };
}

export function storeTupleKeyRegistry$Data(source: KeyRegistry$Data) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeNumber(source.account_count);
    builder.writeNumber(source.key_record_count);
    builder.writeCell(source.accounts.size > 0 ? beginCell().storeDictDirect(source.accounts, Dictionary.Keys.BigInt(257), dictValueParserKeyAccount()).endCell() : null);
    builder.writeCell(source.key_records.size > 0 ? beginCell().storeDictDirect(source.key_records, Dictionary.Keys.BigInt(257), dictValueParserKeyRecord()).endCell() : null);
    return builder.build();
}

export function dictValueParserKeyRegistry$Data(): DictionaryValue<KeyRegistry$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyRegistry$Data(src)).endCell());
        },
        parse: (src) => {
            return loadKeyRegistry$Data(src.loadRef().beginParse());
        }
    }
}

 type KeyRegistry_init_args = {
    $$type: 'KeyRegistry_init_args';
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    sealed: boolean;
}

function initKeyRegistry_init_args(src: KeyRegistry_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeBit(src.sealed);
    };
}

async function KeyRegistry_init(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
    const __code = Cell.fromHex('b5ee9c7241022e01000be0000114ff00f4a413f4bcf2c80b01020120021a020148030e02f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e14d200fa40d3ffd3ffd33fd33ff404f40455706c188e1ffa40810101d700810101d700d200553004d155026d6d70201047104610455ae209925f09e07028d74920c21f953108d31f09de2182103a12d1adbae3022182104b524731ba040702945b07d3ff3010671056104510344138db3cdb3c3436814e4827c201f2f4814e495347baf2f47f07105604415503c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed540506000e814e2028b3f2f40014814e41f84228c705f2f401c2e302392082104b524734ba8e23303710575514c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e0c00008c12118b08e2110575514c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e05f08f2c0820804bc5b07d3ffd3ffd3ffd430d0d3ffd3ffd30fd4d30f30107d106c105b104a103948efdb3c547dcb53cb56135615db3c814e962bc300f2f4814e9753bdbdf2f4814e53f8421918171615144330db3c19f2f4f8421078106710561045103441301c090b0c0170814e8507c30017f2f4814e8605c30015f2f4814e8703c30013f2f4814e8b24c002f2f4814e8901c300f2f4814e8a218104a0baf2f459db3c0a00e8814e8b02c00212f2f4207af941814e8c03c00a13f2f4814e8d01812500baf2f4814e9101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d0814e9221d74923aa02baf2f45331bc9e32814e9322d74ac001f2f401d4309b814e9401d74ac000f2f401e259a101e85b000afa4430c00003fadb3c814e8f238101012359f40c6fa131b3f2f4820a80de80814e8ef8416f24135f0358bef2f470f842108a5e361059104a10394a90295611561153fe5617db3c814e90228101012359f40c6fa131b3f2f4810101f842f823f82553dd2f105c0b0a11170a091116090811150807111307061112060511180511195530c81d2b0d01e255c0db3cc949605270206e953059f45a30944133f415e209a4810101f84224f82310251049103a1026c855505056ce13cbffcbffcb1fcb3fcb3fc910374550206e953059f45a30944133f415e207a45e42035024c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed542c0201200f11018dbdc6af6a268690000c70a69007d2069ffe9ffe99fe99ffa027a022ab8360c470ffd20408080eb80408080eb8069002a980268aa8136b6b810082388230822ad712a83ed9e3647410039e2255718101010adb3c49a059f40d6fa192306ddf206e92306d8e13d0fa40d3ffd3ffd31fd33fd33f55506c166f06e2206e8e88301057551470db3ce06f2610455f051068105710461035443012db3c1d141402012012180201201316018db6f49da89a1a400031c29a401f481a7ffa7ffa67fa67fe809e808aae0d8311c3ff481020203ae01020203ae01a400aa6009a2aa04dadae040208e208c208ab5c4aa0fb678d91d014026e810101220259f40d6fa192306ddf206e92306d8e87d0db3c6c1d6f0de2206e8e903070f828705470005300885471115300e06f2d7f55c027150000018db5d31da89a1a400031c29a401f481a7ffa7ffa67fa67fe809e808aae0d8311c3ff481020203ae01020203ae01a400aa6009a2aa04dadae040208e208c208ab5c4aa0fb678d90d01701be2255718101010adb3c49a059f40d6fa192306ddf206e92306d8e13d0fa40d3ffd3ffd31fd33fd33f55506c166f06e2206e8e163070f8287054700010bd10ac109b108a107910681067e06f26337f05040310bd10ac109b108a1079106810671d0189bafb3ed44d0d200018e14d200fa40d3ffd3ffd33fd33ff404f40455706c188e1ffa40810101d700810101d700d200553004d155026d6d70201047104610455ae2db3c6c8981900388209c9c3808208989680821005f5e1002a51395139513c513a513a0301aaf2ed44d0d200018e14d200fa40d3ffd3ffd33fd33ff404f40455706c188e1ffa40810101d700810101d700d200553004d155026d6d70201047104610455ae208d70d1ff2e0820182104b524732bae3025f09f2c0821b03f8fa408308d718d4108a5e361059104a10394ab08151a421d749c000f2f48151a501d74ac000f2f4db3c28db3c228101012259f40d6fa192306ddf206e92306d8e13d0fa40d3ffd3ffd31fd33fd33f55506c166f06e2814e98216eb3f2f46f26814e9925c300f2f4814ea024c300f2f4814ea25612f90001111225f9101c1d1e000c814e8428f2f40020814e5201d30a018309ba12f2f4d3ff3001fc01111101f2f41110d0814ea821d749810360baf2f4814ea921d74ac001f2f4d31f814ea30282104b524b31ba12f2f4d3ff814ea4512dba12f2f4d3fff828814ea501d30a018309ba12f2f4814ea501d3ff3013ba12f2f4d3ff814ea65127ba12f2f4d33f814ea7025612ba12f2f4f8001110a4810101c8265446305446601f03fe52505615500855505056ce13cbffcbffcb1fcb3fcb3fc948805260206e953059f45a30944133f415e2f80f0fd43020d020d749810320ba8e2b10675f0737371047103645135042c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e1d74ac002e303d0d3ffd3ffd3ffd30fd30fd4d420d749c000e303202122005610565f0637371047103645135042c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54005610cd5f0d37371047103645135042c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed5402fed74ac0008e2b10bc5f0c37371047103645135042c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e1d020d7498307ba8e2b10bc5f0c37371047103645135042c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e120d74ac000e303d3ff30071112070611110605111005104f2324005610bc5f0c37371047103645135042c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed5403fe103e102d011115010b5611561156112e5612561a5613db3c8e1f6ce8c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e156105613bd8e1f6ce8c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e1208101012a59f40d6fa192306ddf206e92306d8e87d0db3c6c1d6f0de220252728015806935f0670e104935f0570e102935f0470e123c302935f0470e0935f0370e1208104a0bd935f0370e059db3c2600eeeda2edfb01c302925b70e0207af94102c30a935f0470e0812500bd935f0370e0c309925b70e09321c2008e48807f228104a0ba933080299722c17f923021dee221d020d74922aa02bd955f0470db31e05331bc8e103221d74ac301955f0370db31e001d4309ad74a955f0370db31e001e259a101e85b7f004afa40d31fd3ffd3ffd401d0d3ffd3ffd30fd4d30fd33fd33fd33fd33f30109d109c109b109a02fe6e8e20306ce8c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e06f2d6ca1025616c7058e205b6ce8c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e101c0008e20306ce8c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e120841fb9e303a45570292a0040306ce8c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed5403fc56142956145614561056145614db3c218101012259f40c6fa1318e22306c886c78c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e050aa810101f45a30810101f823f82570200b11190b2d0b0a11180a0911170908111608071112070611150605111c0511145530c855c0db3cc91029011110012b2c2d0048c815cbff13cbffcbffc9c882104b45594901cb1f5005cf1613cb1f12cb0fcb0fccc9f900004c50cdce1acb1f18cbff16cbff04c8cbff13cbffcb0fcc12cb0f12cb3f12cb3f12cb3f12cb3fcd00bc5230206e953059f45a30944133f415e244304b70810101506ec855505056ce13cbffcbffcb1fcb3fcb3fc910374970206e953059f45a30944133f415e210565503c87f01ca0055705078ca0015ce13cbffcbffcb3fcb3ff400f400c9ed54e7466e3a');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initKeyRegistry_init_args({ $$type: 'KeyRegistry_init_args', genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const KeyRegistry_errors = {
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

export const KeyRegistry_errors_backward = {
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

const KeyRegistry_types: ABIType[] = [
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
    {"name":"KeyRegRegisterMessagingKeys","header":1263683377,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"KeyRegReplaceMessagingKeys","header":1263683378,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"KeyRegBindController","header":1263683379,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"KeyRegSealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"KeyRegTopUpStorageReserve","header":1263683380,"fields":[]},
    {"name":"KeyAccount","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"current_key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"rotation_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"registered_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"KeyRecord","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"revoked_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"KeyRegKeyRecordView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"scan_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"revoked_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"KeyRegAccountView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"current_key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"rotation_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"registered_at","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"KeyRegGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"account_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_record_storage_endowment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"account_storage_endowment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"base_storage_endowment","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"KeyRegistry$Data","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"account_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"key_record_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"accounts","type":{"kind":"dict","key":"int","value":"KeyAccount","valueFormat":"ref"}},{"name":"key_records","type":{"kind":"dict","key":"int","value":"KeyRecord","valueFormat":"ref"}}]},
]

const KeyRegistry_opcodes = {
    "KeyRegRegisterMessagingKeys": 1263683377,
    "KeyRegReplaceMessagingKeys": 1263683378,
    "KeyRegBindController": 1263683379,
    "KeyRegSealGenesis": 974311853,
    "KeyRegTopUpStorageReserve": 1263683380,
}

const KeyRegistry_getters: ABIGetter[] = [
    {"name":"get_key_record","methodId":104356,"arguments":[{"name":"keyId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"KeyRegKeyRecordView","optional":false}},
    {"name":"get_account","methodId":110232,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"KeyRegAccountView","optional":false}},
    {"name":"get_current_key_record","methodId":80085,"arguments":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"KeyRegKeyRecordView","optional":false}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"KeyRegGlobalView","optional":false}},
]

export const KeyRegistry_getterMapping: { [key: string]: string } = {
    'get_key_record': 'getGetKeyRecord',
    'get_account': 'getGetAccount',
    'get_current_key_record': 'getGetCurrentKeyRecord',
    'get_global': 'getGetGlobal',
}

const KeyRegistry_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"KeyRegSealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"KeyRegRegisterMessagingKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"KeyRegReplaceMessagingKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"KeyRegTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const KEYREG_CRYPTO_SUITE_HYBRID = 2n;
export const KEYREG_MLKEM768_PUBKEY_LEN = 1184n;
export const KEYREG_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES = 127n;
export const KEYREG_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES = 41n;
export const KEYREG_MLKEM768_PUBKEY_SNAKE_CELLS = 10n;
export const KEYREG_MLKEM768_PUBKEY_SNAKE_BITS = 9472n;
export const KEYREG_MLKEM768_PUBKEY_SNAKE_REFS = 9n;
export const KEYREG_UINT32_MAX = 4294967295n;
export const KEYREG_KEY_ID_DOMAIN = 1262836041n;
export const KEYREG_REPLACE_KEYS_SIGNING_DOMAIN = 1263684401n;
export const KEYREG_KEY_RECORD_STORAGE_ENDOWMENT = 30000000n;
export const KEYREG_ACCOUNT_STORAGE_ENDOWMENT = 10000000n;
export const KEYREG_STATE_GROWTH_EXEC_RESERVE = 2000000n;
export const KEYREG_BASE_STORAGE_ENDOWMENT = 100000000n;

export class KeyRegistry implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = KeyRegistry_errors_backward;
    public static readonly opcodes = KeyRegistry_opcodes;
    
    static async init(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
        return await KeyRegistry_init(genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed);
    }
    
    static async fromInit(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
        const __gen_init = await KeyRegistry_init(genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed);
        const address = contractAddress(0, __gen_init);
        return new KeyRegistry(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new KeyRegistry(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  KeyRegistry_types,
        getters: KeyRegistry_getters,
        receivers: KeyRegistry_receivers,
        errors: KeyRegistry_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: KeyRegSealGenesis | KeyRegRegisterMessagingKeys | KeyRegTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyRegSealGenesis') {
            body = beginCell().store(storeKeyRegSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyRegRegisterMessagingKeys') {
            body = beginCell().store(storeKeyRegRegisterMessagingKeys(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyRegTopUpStorageReserve') {
            body = beginCell().store(storeKeyRegTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async sendExternal(provider: ContractProvider, message: KeyRegReplaceMessagingKeys) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyRegReplaceMessagingKeys') {
            body = beginCell().store(storeKeyRegReplaceMessagingKeys(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.external(body);
        
    }
    
    async getGetKeyRecord(provider: ContractProvider, keyId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(keyId);
        const source = (await provider.get('get_key_record', builder.build())).stack;
        const result = loadGetterTupleKeyRegKeyRecordView(source);
        return result;
    }
    
    async getGetAccount(provider: ContractProvider, owner_wallet: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        const source = (await provider.get('get_account', builder.build())).stack;
        const result = loadGetterTupleKeyRegAccountView(source);
        return result;
    }
    
    async getGetCurrentKeyRecord(provider: ContractProvider, owner_wallet: Address) {
        const builder = new TupleBuilder();
        builder.writeAddress(owner_wallet);
        const source = (await provider.get('get_current_key_record', builder.build())).stack;
        const result = loadGetterTupleKeyRegKeyRecordView(source);
        return result;
    }
    
    async getGetGlobal(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_global', builder.build())).stack;
        const result = loadGetterTupleKeyRegGlobalView(source);
        return result;
    }
    
}