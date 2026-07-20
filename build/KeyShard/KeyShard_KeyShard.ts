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

export type KeyShardRegisterKeys = {
    $$type: 'KeyShardRegisterKeys';
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    auth_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
}

export function storeKeyShardRegisterKeys(src: KeyShardRegisterKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748913, 32);
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

export function loadKeyShardRegisterKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748913) { throw Error('Invalid prefix'); }
    const _enc_pubkey = sc_0.loadUintBig(256);
    const _sign_pubkey = sc_0.loadUintBig(256);
    const _scan_pubkey = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _auth_pubkey = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_hash = sc_1.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_1.loadUintBig(16);
    const _pq_kem_pubkey = sc_1.loadRef();
    const _crypto_suite_mask = sc_1.loadUintBig(16);
    return { $$type: 'KeyShardRegisterKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadTupleKeyShardRegisterKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'KeyShardRegisterKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function loadGetterTupleKeyShardRegisterKeys(source: TupleReader) {
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    return { $$type: 'KeyShardRegisterKeys' as const, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, auth_pubkey: _auth_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask };
}

export function storeTupleKeyShardRegisterKeys(source: KeyShardRegisterKeys) {
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

export function dictValueParserKeyShardRegisterKeys(): DictionaryValue<KeyShardRegisterKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardRegisterKeys(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardRegisterKeys(src.loadRef().beginParse());
        }
    }
}

export type KeyShardReplaceKeys = {
    $$type: 'KeyShardReplaceKeys';
    signature: Buffer;
    signed_payload: Cell;
    envelope_padding: Slice;
}

export function storeKeyShardReplaceKeys(src: KeyShardReplaceKeys) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748914, 32);
        b_0.storeBuffer(src.signature);
        b_0.storeRef(src.signed_payload);
        b_0.storeBuilder(src.envelope_padding.asBuilder());
    };
}

export function loadKeyShardReplaceKeys(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748914) { throw Error('Invalid prefix'); }
    const _signature = sc_0.loadBuffer(64);
    const _signed_payload = sc_0.loadRef();
    const _envelope_padding = sc_0;
    return { $$type: 'KeyShardReplaceKeys' as const, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadTupleKeyShardReplaceKeys(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'KeyShardReplaceKeys' as const, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function loadGetterTupleKeyShardReplaceKeys(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signed_payload = source.readCell();
    const _envelope_padding = source.readCell().asSlice();
    return { $$type: 'KeyShardReplaceKeys' as const, signature: _signature, signed_payload: _signed_payload, envelope_padding: _envelope_padding };
}

export function storeTupleKeyShardReplaceKeys(source: KeyShardReplaceKeys) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeCell(source.signed_payload);
    builder.writeSlice(source.envelope_padding.asCell());
    return builder.build();
}

export function dictValueParserKeyShardReplaceKeys(): DictionaryValue<KeyShardReplaceKeys> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardReplaceKeys(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardReplaceKeys(src.loadRef().beginParse());
        }
    }
}

export type KeyShardTopUpStorageReserve = {
    $$type: 'KeyShardTopUpStorageReserve';
}

export function storeKeyShardTopUpStorageReserve(src: KeyShardTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1263748916, 32);
    };
}

export function loadKeyShardTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1263748916) { throw Error('Invalid prefix'); }
    return { $$type: 'KeyShardTopUpStorageReserve' as const };
}

export function loadTupleKeyShardTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'KeyShardTopUpStorageReserve' as const };
}

export function loadGetterTupleKeyShardTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'KeyShardTopUpStorageReserve' as const };
}

export function storeTupleKeyShardTopUpStorageReserve(source: KeyShardTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserKeyShardTopUpStorageReserve(): DictionaryValue<KeyShardTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type KeyShardView = {
    $$type: 'KeyShardView';
    exists: boolean;
    owner_wallet: Address;
    key_id: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
    min_register_value: bigint;
    min_replace_value: bigint;
}

export function storeKeyShardView(src: KeyShardView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.owner_wallet);
        b_0.storeInt(src.key_id, 257);
        b_0.storeInt(src.key_generation, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.rotation_nonce, 257);
        b_1.storeInt(src.enc_pubkey, 257);
        b_1.storeInt(src.sign_pubkey, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.scan_pubkey, 257);
        b_2.storeInt(src.pq_kem_pubkey_hash, 257);
        b_2.storeInt(src.pq_kem_pubkey_len, 257);
        b_2.storeRef(src.pq_kem_pubkey);
        const b_3 = new Builder();
        b_3.storeInt(src.crypto_suite_mask, 257);
        b_3.storeInt(src.created_at, 257);
        b_3.storeInt(src.created_lt, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.min_register_value, 257);
        b_4.storeInt(src.min_replace_value, 257);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyShardView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _owner_wallet = sc_0.loadAddress();
    const _key_id = sc_0.loadIntBig(257);
    const _key_generation = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _rotation_nonce = sc_1.loadIntBig(257);
    const _enc_pubkey = sc_1.loadIntBig(257);
    const _sign_pubkey = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _scan_pubkey = sc_2.loadIntBig(257);
    const _pq_kem_pubkey_hash = sc_2.loadIntBig(257);
    const _pq_kem_pubkey_len = sc_2.loadIntBig(257);
    const _pq_kem_pubkey = sc_2.loadRef();
    const sc_3 = sc_2.loadRef().beginParse();
    const _crypto_suite_mask = sc_3.loadIntBig(257);
    const _created_at = sc_3.loadIntBig(257);
    const _created_lt = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _min_register_value = sc_4.loadIntBig(257);
    const _min_replace_value = sc_4.loadIntBig(257);
    return { $$type: 'KeyShardView' as const, exists: _exists, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, min_register_value: _min_register_value, min_replace_value: _min_replace_value };
}

export function loadTupleKeyShardView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    source = source.readTuple();
    const _min_register_value = source.readBigNumber();
    const _min_replace_value = source.readBigNumber();
    return { $$type: 'KeyShardView' as const, exists: _exists, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, min_register_value: _min_register_value, min_replace_value: _min_replace_value };
}

export function loadGetterTupleKeyShardView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _owner_wallet = source.readAddress();
    const _key_id = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    const _min_register_value = source.readBigNumber();
    const _min_replace_value = source.readBigNumber();
    return { $$type: 'KeyShardView' as const, exists: _exists, owner_wallet: _owner_wallet, key_id: _key_id, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt, min_register_value: _min_register_value, min_replace_value: _min_replace_value };
}

export function storeTupleKeyShardView(source: KeyShardView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.owner_wallet);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    builder.writeNumber(source.min_register_value);
    builder.writeNumber(source.min_replace_value);
    return builder.build();
}

export function dictValueParserKeyShardView(): DictionaryValue<KeyShardView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShardView(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShardView(src.loadRef().beginParse());
        }
    }
}

export type KeyShard$Data = {
    $$type: 'KeyShard$Data';
    owner_wallet: Address;
    registered: boolean;
    key_id: bigint;
    auth_pubkey: bigint;
    key_generation: bigint;
    rotation_nonce: bigint;
    enc_pubkey: bigint;
    sign_pubkey: bigint;
    scan_pubkey: bigint;
    pq_kem_pubkey_hash: bigint;
    pq_kem_pubkey_len: bigint;
    pq_kem_pubkey: Cell;
    crypto_suite_mask: bigint;
    created_at: bigint;
    created_lt: bigint;
}

export function storeKeyShard$Data(src: KeyShard$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
        b_0.storeBit(src.registered);
        b_0.storeUint(src.key_id, 256);
        b_0.storeUint(src.auth_pubkey, 256);
        b_0.storeUint(src.key_generation, 32);
        b_0.storeUint(src.rotation_nonce, 64);
        const b_1 = new Builder();
        b_1.storeUint(src.enc_pubkey, 256);
        b_1.storeUint(src.sign_pubkey, 256);
        b_1.storeUint(src.scan_pubkey, 256);
        const b_2 = new Builder();
        b_2.storeUint(src.pq_kem_pubkey_hash, 256);
        b_2.storeUint(src.pq_kem_pubkey_len, 16);
        b_2.storeRef(src.pq_kem_pubkey);
        b_2.storeUint(src.crypto_suite_mask, 16);
        b_2.storeUint(src.created_at, 64);
        b_2.storeUint(src.created_lt, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadKeyShard$Data(slice: Slice) {
    const sc_0 = slice;
    const _owner_wallet = sc_0.loadAddress();
    const _registered = sc_0.loadBit();
    const _key_id = sc_0.loadUintBig(256);
    const _auth_pubkey = sc_0.loadUintBig(256);
    const _key_generation = sc_0.loadUintBig(32);
    const _rotation_nonce = sc_0.loadUintBig(64);
    const sc_1 = sc_0.loadRef().beginParse();
    const _enc_pubkey = sc_1.loadUintBig(256);
    const _sign_pubkey = sc_1.loadUintBig(256);
    const _scan_pubkey = sc_1.loadUintBig(256);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pq_kem_pubkey_hash = sc_2.loadUintBig(256);
    const _pq_kem_pubkey_len = sc_2.loadUintBig(16);
    const _pq_kem_pubkey = sc_2.loadRef();
    const _crypto_suite_mask = sc_2.loadUintBig(16);
    const _created_at = sc_2.loadUintBig(64);
    const _created_lt = sc_2.loadUintBig(64);
    return { $$type: 'KeyShard$Data' as const, owner_wallet: _owner_wallet, registered: _registered, key_id: _key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt };
}

export function loadTupleKeyShard$Data(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _registered = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    return { $$type: 'KeyShard$Data' as const, owner_wallet: _owner_wallet, registered: _registered, key_id: _key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt };
}

export function loadGetterTupleKeyShard$Data(source: TupleReader) {
    const _owner_wallet = source.readAddress();
    const _registered = source.readBoolean();
    const _key_id = source.readBigNumber();
    const _auth_pubkey = source.readBigNumber();
    const _key_generation = source.readBigNumber();
    const _rotation_nonce = source.readBigNumber();
    const _enc_pubkey = source.readBigNumber();
    const _sign_pubkey = source.readBigNumber();
    const _scan_pubkey = source.readBigNumber();
    const _pq_kem_pubkey_hash = source.readBigNumber();
    const _pq_kem_pubkey_len = source.readBigNumber();
    const _pq_kem_pubkey = source.readCell();
    const _crypto_suite_mask = source.readBigNumber();
    const _created_at = source.readBigNumber();
    const _created_lt = source.readBigNumber();
    return { $$type: 'KeyShard$Data' as const, owner_wallet: _owner_wallet, registered: _registered, key_id: _key_id, auth_pubkey: _auth_pubkey, key_generation: _key_generation, rotation_nonce: _rotation_nonce, enc_pubkey: _enc_pubkey, sign_pubkey: _sign_pubkey, scan_pubkey: _scan_pubkey, pq_kem_pubkey_hash: _pq_kem_pubkey_hash, pq_kem_pubkey_len: _pq_kem_pubkey_len, pq_kem_pubkey: _pq_kem_pubkey, crypto_suite_mask: _crypto_suite_mask, created_at: _created_at, created_lt: _created_lt };
}

export function storeTupleKeyShard$Data(source: KeyShard$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner_wallet);
    builder.writeBoolean(source.registered);
    builder.writeNumber(source.key_id);
    builder.writeNumber(source.auth_pubkey);
    builder.writeNumber(source.key_generation);
    builder.writeNumber(source.rotation_nonce);
    builder.writeNumber(source.enc_pubkey);
    builder.writeNumber(source.sign_pubkey);
    builder.writeNumber(source.scan_pubkey);
    builder.writeNumber(source.pq_kem_pubkey_hash);
    builder.writeNumber(source.pq_kem_pubkey_len);
    builder.writeCell(source.pq_kem_pubkey);
    builder.writeNumber(source.crypto_suite_mask);
    builder.writeNumber(source.created_at);
    builder.writeNumber(source.created_lt);
    return builder.build();
}

export function dictValueParserKeyShard$Data(): DictionaryValue<KeyShard$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeKeyShard$Data(src)).endCell());
        },
        parse: (src) => {
            return loadKeyShard$Data(src.loadRef().beginParse());
        }
    }
}

 type KeyShard_init_args = {
    $$type: 'KeyShard_init_args';
    owner_wallet: Address;
}

function initKeyShard_init_args(src: KeyShard_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner_wallet);
    };
}

async function KeyShard_init(owner_wallet: Address) {
    const __code = Cell.fromHex('b5ee9c7241021d010008a8000114ff00f4a413f4bcf2c80b01020120020f020148030d03f2d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e32fa40d200d3ffd3ffd31fd33fd401d0d3ffd3ffd3ffd430d0d3ffd30fd4d30fd33fd33f30109f109e109d109c109b109a6c1f8e93fa400101d17070547000547000530088547111e21110935f0f30e0702fd74920c21fe30021100405000c310fd31f111002c682104b534731bae30257102082104b534734ba8e3f303e10ce551bc87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed54e0c0000fc1211fb0e3025f0ff2c082060c02f85b0ed3ffd3ffd3ffd430d0d3ffd3ffd30fd4d30f30815622f8425616c705f2f40e11140e0d11130d0c11120c0b11110b0a11100a109f0811140807111307061112060511110504111004103f0211140201111501111656135613561356125618561a561cdb3c8156665611c300f2f481566756115614bdf2f481565e0709017081565507c30017f2f481565605c30015f2f481565703c30013f2f481565b24c002f2f481565901c300f2f481565a218104a0baf2f459db3c0800e881565b02c00212f2f4207af94181565c03c00a13f2f481565d01812500baf2f481566101c009f2f49321c2008e44807f228104a0ba933080299722c17f923021dee221d081566221d74923aa02baf2f45331bc9e3281566322d74ac001f2f401d4309b81566401d74ac000f2f401e259a101e85b02fef8416f24135f032f958208b71b0095820b65c040e2bef2f48156652b841fb9f2f453dd922ba49170e21110111611100f11150f0e11140e0d11130d0c11120c0b11110b0a11100a109f108e107d106c105b104a10394817103645144013011117011118db3c3b0e917095820aaea540e276fb02f8427081008270136d5520c81b0a01b289cf16ca00cf8440ce01fa02806acf40f400c901fb0010ce10bd10ac10ab5518c87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed540b000160007a10ce551bc87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed5402e9a052a5da89a1a400031c65f481a401a7ffa7ffa63fa67fa803a1a7ffa7ffa7ffa861a1a7ffa61fa9a61fa67fa67e60213e213c213a213821362134d83f1d27f4800203a2e0e0a8e000a8e000a60110a8e223c5b678ae20ae20ae20ae20ae20ae20ae20ae20ae20ae20ae20ae20ae20ae20ae20abc1100e0050820b65c0408208b71b002f025611025610544f302f544f302f544f302f544f302f544f302f544f3002d0f2ed44d0d200018e32fa40d200d3ffd3ffd31fd33fd401d0d3ffd3ffd3ffd430d0d3ffd30fd4d30fd33fd33f30109f109e109d109c109b109a6c1f8e93fa400101d17070547000547000530088547111e20fd70d1ff2e0820182104b534732bae3025f0f30f2c0821011000001fc8308d718d40f11100f0e11100e0d11100d0c11100c0b11100b0a11100a09111009081110080711100706111006051110050411100403111003021110020111110181597421d749c000f2f481597501d74ac000f2f48156682ef2f48156702cc300f2f48156725611f9000111112df91001111001f2f40fd081567821d7491204fa810160baf2f481567921d74ac001f2f4d31f8156730282104b534b31ba12f2f4d3fff82881567501d30a018309ba12f2f481567501d3ff3013ba12f2f4d33f815677512aba12f2f4f80008a4f80f08d430d020d749810320bae30320d74ac002e303d3ffd3ffd3ffd30fd30fd4d430d020d7498307bae30320d74ac00013131415007830551cc87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed54007a5f07551cc87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed5401fe8e3d5f07551cc87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed54e1d3ff300e11130e0d11120d0c11110c0b11100b10af09111309081112080711110706111006105f0411130403111203021111020111150111145610561056151604fc56175616561a5617db3c8e423f3f3f3f3f3f3f5567c87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed54e153fbbde3032a841fb9e3032aa40f11160f0e11150e0d11140d0c11130c0b11120b0a11110a09111009108f107e55661719191a015806935f0670e104935f0570e102935f0470e123c302935f0470e0935f0370e1208104a0bd935f0370e059db3c1800eeeda2edfb01c302925b70e0207af94102c30a935f0470e0812500bd935f0370e0c309925b70e09321c2008e48807f228104a0ba933080299722c17f923021dee221d020d74922aa02bd955f0470db31e05331bc8e103221d74ac301955f0370db31e001d4309ad74a955f0370db31e001e259a101e85b7f00843f3f3f3f3f3f3f5567c87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed5401801036451304db3cc87f01ca0055e050efce1cca001acbff18cbff16cb1f14cb3f02c8cbffcbff12cbff02c8cbff13cb0f13cc13cb0f13cb3f13cb3fcdcdc9ed541b01c60e11160e0d11150d0c11140c0b11130b0a11120a0911110908111008107f06111606051115050411140403111303021112020111110111102f56175617561656165615db3c3b5f093333f823f825105d7f0d105c103b107a10491068071056103555301c0046c815cbff13cbffcbffc9c882104b45594901cb1f5613cf1614cb1fcb0fcb0fccc9f9001b3ee6fc');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initKeyShard_init_args({ $$type: 'KeyShard_init_args', owner_wallet })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const KeyShard_errors = {
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

export const KeyShard_errors_backward = {
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

const KeyShard_types: ABIType[] = [
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
    {"name":"KeyShardRegisterKeys","header":1263748913,"fields":[{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}}]},
    {"name":"KeyShardReplaceKeys","header":1263748914,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signed_payload","type":{"kind":"simple","type":"cell","optional":false}},{"name":"envelope_padding","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"KeyShardTopUpStorageReserve","header":1263748916,"fields":[]},
    {"name":"KeyShardView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"key_generation","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"rotation_nonce","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"enc_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sign_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"scan_pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"created_lt","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_register_value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_replace_value","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"KeyShard$Data","header":null,"fields":[{"name":"owner_wallet","type":{"kind":"simple","type":"address","optional":false}},{"name":"registered","type":{"kind":"simple","type":"bool","optional":false}},{"name":"key_id","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"auth_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"key_generation","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"rotation_nonce","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"enc_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"sign_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"scan_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"pq_kem_pubkey_len","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"pq_kem_pubkey","type":{"kind":"simple","type":"cell","optional":false}},{"name":"crypto_suite_mask","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"created_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"created_lt","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const KeyShard_opcodes = {
    "KeyShardRegisterKeys": 1263748913,
    "KeyShardReplaceKeys": 1263748914,
    "KeyShardTopUpStorageReserve": 1263748916,
}

const KeyShard_getters: ABIGetter[] = [
    {"name":"get_view","methodId":76114,"arguments":[],"returnType":{"kind":"simple","type":"KeyShardView","optional":false}},
]

export const KeyShard_getterMapping: { [key: string]: string } = {
    'get_view': 'getGetView',
}

const KeyShard_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"KeyShardRegisterKeys"}},
    {"receiver":"external","message":{"kind":"typed","type":"KeyShardReplaceKeys"}},
    {"receiver":"internal","message":{"kind":"typed","type":"KeyShardTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const KS_CRYPTO_SUITE_HYBRID = 2n;
export const KS_MLKEM768_PUBKEY_LEN = 1184n;
export const KS_MLKEM768_PUBKEY_SNAKE_CHUNK_BYTES = 127n;
export const KS_MLKEM768_PUBKEY_SNAKE_FIRST_CHUNK_BYTES = 41n;
export const KS_MLKEM768_PUBKEY_SNAKE_CELLS = 10n;
export const KS_MLKEM768_PUBKEY_SNAKE_BITS = 9472n;
export const KS_MLKEM768_PUBKEY_SNAKE_REFS = 9n;
export const KS_UINT32_MAX = 4294967295n;
export const KS_KEY_ID_DOMAIN = 1262836041n;
export const KS_REPLACE_KEYS_SIGNING_DOMAIN = 1263749937n;
export const KS_YEARS_FUNDED = 10n;
export const KS_BASE_ENDOWMENT = 45000000n;
export const KS_REGISTER_GAS = 12000000n;
export const KS_MIN_REGISTER_VALUE = 57000000n;
export const KS_MIN_REPLACE_VALUE = 12000000n;

export class KeyShard implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = KeyShard_errors_backward;
    public static readonly opcodes = KeyShard_opcodes;
    
    static async init(owner_wallet: Address) {
        return await KeyShard_init(owner_wallet);
    }
    
    static async fromInit(owner_wallet: Address) {
        const __gen_init = await KeyShard_init(owner_wallet);
        const address = contractAddress(0, __gen_init);
        return new KeyShard(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new KeyShard(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  KeyShard_types,
        getters: KeyShard_getters,
        receivers: KeyShard_receivers,
        errors: KeyShard_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: KeyShardRegisterKeys | KeyShardTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardRegisterKeys') {
            body = beginCell().store(storeKeyShardRegisterKeys(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardTopUpStorageReserve') {
            body = beginCell().store(storeKeyShardTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async sendExternal(provider: ContractProvider, message: KeyShardReplaceKeys) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'KeyShardReplaceKeys') {
            body = beginCell().store(storeKeyShardReplaceKeys(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.external(body);
        
    }
    
    async getGetView(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_view', builder.build())).stack;
        const result = loadGetterTupleKeyShardView(source);
        return result;
    }
    
}