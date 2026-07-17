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

export type CreditUploadIssuerKey = {
    $$type: 'CreditUploadIssuerKey';
    slot: bigint;
    pubkey: bigint;
}

export function storeCreditUploadIssuerKey(src: CreditUploadIssuerKey) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464881, 32);
        b_0.storeUint(src.slot, 8);
        b_0.storeUint(src.pubkey, 256);
    };
}

export function loadCreditUploadIssuerKey(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464881) { throw Error('Invalid prefix'); }
    const _slot = sc_0.loadUintBig(8);
    const _pubkey = sc_0.loadUintBig(256);
    return { $$type: 'CreditUploadIssuerKey' as const, slot: _slot, pubkey: _pubkey };
}

export function loadTupleCreditUploadIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    const _pubkey = source.readBigNumber();
    return { $$type: 'CreditUploadIssuerKey' as const, slot: _slot, pubkey: _pubkey };
}

export function loadGetterTupleCreditUploadIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    const _pubkey = source.readBigNumber();
    return { $$type: 'CreditUploadIssuerKey' as const, slot: _slot, pubkey: _pubkey };
}

export function storeTupleCreditUploadIssuerKey(source: CreditUploadIssuerKey) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.slot);
    builder.writeNumber(source.pubkey);
    return builder.build();
}

export function dictValueParserCreditUploadIssuerKey(): DictionaryValue<CreditUploadIssuerKey> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditUploadIssuerKey(src)).endCell());
        },
        parse: (src) => {
            return loadCreditUploadIssuerKey(src.loadRef().beginParse());
        }
    }
}

export type CreditSetPrice = {
    $$type: 'CreditSetPrice';
    credit_price: bigint;
}

export function storeCreditSetPrice(src: CreditSetPrice) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464882, 32);
        b_0.storeUint(src.credit_price, 128);
    };
}

export function loadCreditSetPrice(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464882) { throw Error('Invalid prefix'); }
    const _credit_price = sc_0.loadUintBig(128);
    return { $$type: 'CreditSetPrice' as const, credit_price: _credit_price };
}

export function loadTupleCreditSetPrice(source: TupleReader) {
    const _credit_price = source.readBigNumber();
    return { $$type: 'CreditSetPrice' as const, credit_price: _credit_price };
}

export function loadGetterTupleCreditSetPrice(source: TupleReader) {
    const _credit_price = source.readBigNumber();
    return { $$type: 'CreditSetPrice' as const, credit_price: _credit_price };
}

export function storeTupleCreditSetPrice(source: CreditSetPrice) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credit_price);
    return builder.build();
}

export function dictValueParserCreditSetPrice(): DictionaryValue<CreditSetPrice> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditSetPrice(src)).endCell());
        },
        parse: (src) => {
            return loadCreditSetPrice(src.loadRef().beginParse());
        }
    }
}

export type CreditSealGenesis = {
    $$type: 'CreditSealGenesis';
    deployment_manifest_hash: bigint;
}

export function storeCreditSealGenesis(src: CreditSealGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(974311853, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadCreditSealGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 974311853) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'CreditSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleCreditSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'CreditSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleCreditSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'CreditSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleCreditSealGenesis(source: CreditSealGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserCreditSealGenesis(): DictionaryValue<CreditSealGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditSealGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadCreditSealGenesis(src.loadRef().beginParse());
        }
    }
}

export type CreditReplaceIssuerKey = {
    $$type: 'CreditReplaceIssuerKey';
    slot: bigint;
    new_pubkey: bigint;
}

export function storeCreditReplaceIssuerKey(src: CreditReplaceIssuerKey) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464883, 32);
        b_0.storeUint(src.slot, 8);
        b_0.storeUint(src.new_pubkey, 256);
    };
}

export function loadCreditReplaceIssuerKey(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464883) { throw Error('Invalid prefix'); }
    const _slot = sc_0.loadUintBig(8);
    const _new_pubkey = sc_0.loadUintBig(256);
    return { $$type: 'CreditReplaceIssuerKey' as const, slot: _slot, new_pubkey: _new_pubkey };
}

export function loadTupleCreditReplaceIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    const _new_pubkey = source.readBigNumber();
    return { $$type: 'CreditReplaceIssuerKey' as const, slot: _slot, new_pubkey: _new_pubkey };
}

export function loadGetterTupleCreditReplaceIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    const _new_pubkey = source.readBigNumber();
    return { $$type: 'CreditReplaceIssuerKey' as const, slot: _slot, new_pubkey: _new_pubkey };
}

export function storeTupleCreditReplaceIssuerKey(source: CreditReplaceIssuerKey) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.slot);
    builder.writeNumber(source.new_pubkey);
    return builder.build();
}

export function dictValueParserCreditReplaceIssuerKey(): DictionaryValue<CreditReplaceIssuerKey> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditReplaceIssuerKey(src)).endCell());
        },
        parse: (src) => {
            return loadCreditReplaceIssuerKey(src.loadRef().beginParse());
        }
    }
}

export type CreditRevokeIssuerKey = {
    $$type: 'CreditRevokeIssuerKey';
    slot: bigint;
}

export function storeCreditRevokeIssuerKey(src: CreditRevokeIssuerKey) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464884, 32);
        b_0.storeUint(src.slot, 8);
    };
}

export function loadCreditRevokeIssuerKey(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464884) { throw Error('Invalid prefix'); }
    const _slot = sc_0.loadUintBig(8);
    return { $$type: 'CreditRevokeIssuerKey' as const, slot: _slot };
}

export function loadTupleCreditRevokeIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    return { $$type: 'CreditRevokeIssuerKey' as const, slot: _slot };
}

export function loadGetterTupleCreditRevokeIssuerKey(source: TupleReader) {
    const _slot = source.readBigNumber();
    return { $$type: 'CreditRevokeIssuerKey' as const, slot: _slot };
}

export function storeTupleCreditRevokeIssuerKey(source: CreditRevokeIssuerKey) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.slot);
    return builder.build();
}

export function dictValueParserCreditRevokeIssuerKey(): DictionaryValue<CreditRevokeIssuerKey> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditRevokeIssuerKey(src)).endCell());
        },
        parse: (src) => {
            return loadCreditRevokeIssuerKey(src.loadRef().beginParse());
        }
    }
}

export type CreditBuyCredits = {
    $$type: 'CreditBuyCredits';
    credits_k: bigint;
    redeem_pubkey: bigint;
    epoch: bigint;
}

export function storeCreditBuyCredits(src: CreditBuyCredits) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464885, 32);
        b_0.storeUint(src.credits_k, 16);
        b_0.storeUint(src.redeem_pubkey, 256);
        b_0.storeUint(src.epoch, 32);
    };
}

export function loadCreditBuyCredits(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464885) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(16);
    const _redeem_pubkey = sc_0.loadUintBig(256);
    const _epoch = sc_0.loadUintBig(32);
    return { $$type: 'CreditBuyCredits' as const, credits_k: _credits_k, redeem_pubkey: _redeem_pubkey, epoch: _epoch };
}

export function loadTupleCreditBuyCredits(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _redeem_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    return { $$type: 'CreditBuyCredits' as const, credits_k: _credits_k, redeem_pubkey: _redeem_pubkey, epoch: _epoch };
}

export function loadGetterTupleCreditBuyCredits(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _redeem_pubkey = source.readBigNumber();
    const _epoch = source.readBigNumber();
    return { $$type: 'CreditBuyCredits' as const, credits_k: _credits_k, redeem_pubkey: _redeem_pubkey, epoch: _epoch };
}

export function storeTupleCreditBuyCredits(source: CreditBuyCredits) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.redeem_pubkey);
    builder.writeNumber(source.epoch);
    return builder.build();
}

export function dictValueParserCreditBuyCredits(): DictionaryValue<CreditBuyCredits> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditBuyCredits(src)).endCell());
        },
        parse: (src) => {
            return loadCreditBuyCredits(src.loadRef().beginParse());
        }
    }
}

export type CreditBindHub = {
    $$type: 'CreditBindHub';
    capsule_hub_address: Address;
}

export function storeCreditBindHub(src: CreditBindHub) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464886, 32);
        b_0.storeAddress(src.capsule_hub_address);
    };
}

export function loadCreditBindHub(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464886) { throw Error('Invalid prefix'); }
    const _capsule_hub_address = sc_0.loadAddress();
    return { $$type: 'CreditBindHub' as const, capsule_hub_address: _capsule_hub_address };
}

export function loadTupleCreditBindHub(source: TupleReader) {
    const _capsule_hub_address = source.readAddress();
    return { $$type: 'CreditBindHub' as const, capsule_hub_address: _capsule_hub_address };
}

export function loadGetterTupleCreditBindHub(source: TupleReader) {
    const _capsule_hub_address = source.readAddress();
    return { $$type: 'CreditBindHub' as const, capsule_hub_address: _capsule_hub_address };
}

export function storeTupleCreditBindHub(source: CreditBindHub) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.capsule_hub_address);
    return builder.build();
}

export function dictValueParserCreditBindHub(): DictionaryValue<CreditBindHub> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditBindHub(src)).endCell());
        },
        parse: (src) => {
            return loadCreditBindHub(src.loadRef().beginParse());
        }
    }
}

export type CreditTopUpStorageReserve = {
    $$type: 'CreditTopUpStorageReserve';
}

export function storeCreditTopUpStorageReserve(src: CreditTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464887, 32);
    };
}

export function loadCreditTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464887) { throw Error('Invalid prefix'); }
    return { $$type: 'CreditTopUpStorageReserve' as const };
}

export function loadTupleCreditTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'CreditTopUpStorageReserve' as const };
}

export function loadGetterTupleCreditTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'CreditTopUpStorageReserve' as const };
}

export function storeTupleCreditTopUpStorageReserve(source: CreditTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserCreditTopUpStorageReserve(): DictionaryValue<CreditTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadCreditTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type CreditBindAirdropPool = {
    $$type: 'CreditBindAirdropPool';
    airdrop_pool_address: Address;
}

export function storeCreditBindAirdropPool(src: CreditBindAirdropPool) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464889, 32);
        b_0.storeAddress(src.airdrop_pool_address);
    };
}

export function loadCreditBindAirdropPool(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464889) { throw Error('Invalid prefix'); }
    const _airdrop_pool_address = sc_0.loadAddress();
    return { $$type: 'CreditBindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function loadTupleCreditBindAirdropPool(source: TupleReader) {
    const _airdrop_pool_address = source.readAddress();
    return { $$type: 'CreditBindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function loadGetterTupleCreditBindAirdropPool(source: TupleReader) {
    const _airdrop_pool_address = source.readAddress();
    return { $$type: 'CreditBindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function storeTupleCreditBindAirdropPool(source: CreditBindAirdropPool) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.airdrop_pool_address);
    return builder.build();
}

export function dictValueParserCreditBindAirdropPool(): DictionaryValue<CreditBindAirdropPool> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditBindAirdropPool(src)).endCell());
        },
        parse: (src) => {
            return loadCreditBindAirdropPool(src.loadRef().beginParse());
        }
    }
}

export type AirdropAccrue = {
    $$type: 'AirdropAccrue';
    purchase_id: bigint;
    buyer: Address;
    credits_k: bigint;
}

export function storeAirdropAccrue(src: AirdropAccrue) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996496, 32);
        b_0.storeUint(src.purchase_id, 64);
        b_0.storeAddress(src.buyer);
        b_0.storeUint(src.credits_k, 64);
    };
}

export function loadAirdropAccrue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996496) { throw Error('Invalid prefix'); }
    const _purchase_id = sc_0.loadUintBig(64);
    const _buyer = sc_0.loadAddress();
    const _credits_k = sc_0.loadUintBig(64);
    return { $$type: 'AirdropAccrue' as const, purchase_id: _purchase_id, buyer: _buyer, credits_k: _credits_k };
}

export function loadTupleAirdropAccrue(source: TupleReader) {
    const _purchase_id = source.readBigNumber();
    const _buyer = source.readAddress();
    const _credits_k = source.readBigNumber();
    return { $$type: 'AirdropAccrue' as const, purchase_id: _purchase_id, buyer: _buyer, credits_k: _credits_k };
}

export function loadGetterTupleAirdropAccrue(source: TupleReader) {
    const _purchase_id = source.readBigNumber();
    const _buyer = source.readAddress();
    const _credits_k = source.readBigNumber();
    return { $$type: 'AirdropAccrue' as const, purchase_id: _purchase_id, buyer: _buyer, credits_k: _credits_k };
}

export function storeTupleAirdropAccrue(source: AirdropAccrue) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.purchase_id);
    builder.writeAddress(source.buyer);
    builder.writeNumber(source.credits_k);
    return builder.build();
}

export function dictValueParserAirdropAccrue(): DictionaryValue<AirdropAccrue> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropAccrue(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropAccrue(src.loadRef().beginParse());
        }
    }
}

export type CreditPurchaseRefund = {
    $$type: 'CreditPurchaseRefund';
    purchase_id: bigint;
    credits_k: bigint;
}

export function storeCreditPurchaseRefund(src: CreditPurchaseRefund) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129464888, 32);
        b_0.storeUint(src.purchase_id, 64);
        b_0.storeUint(src.credits_k, 64);
    };
}

export function loadCreditPurchaseRefund(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129464888) { throw Error('Invalid prefix'); }
    const _purchase_id = sc_0.loadUintBig(64);
    const _credits_k = sc_0.loadUintBig(64);
    return { $$type: 'CreditPurchaseRefund' as const, purchase_id: _purchase_id, credits_k: _credits_k };
}

export function loadTupleCreditPurchaseRefund(source: TupleReader) {
    const _purchase_id = source.readBigNumber();
    const _credits_k = source.readBigNumber();
    return { $$type: 'CreditPurchaseRefund' as const, purchase_id: _purchase_id, credits_k: _credits_k };
}

export function loadGetterTupleCreditPurchaseRefund(source: TupleReader) {
    const _purchase_id = source.readBigNumber();
    const _credits_k = source.readBigNumber();
    return { $$type: 'CreditPurchaseRefund' as const, purchase_id: _purchase_id, credits_k: _credits_k };
}

export function storeTupleCreditPurchaseRefund(source: CreditPurchaseRefund) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.purchase_id);
    builder.writeNumber(source.credits_k);
    return builder.build();
}

export function dictValueParserCreditPurchaseRefund(): DictionaryValue<CreditPurchaseRefund> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditPurchaseRefund(src)).endCell());
        },
        parse: (src) => {
            return loadCreditPurchaseRefund(src.loadRef().beginParse());
        }
    }
}

export type FundAnonPool = {
    $$type: 'FundAnonPool';
    credits_k: bigint;
    epoch: bigint;
    purchase_id: bigint;
}

export function storeFundAnonPool(src: FundAnonPool) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1178685008, 32);
        b_0.storeUint(src.credits_k, 64);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.purchase_id, 64);
    };
}

export function loadFundAnonPool(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1178685008) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(64);
    const _epoch = sc_0.loadUintBig(32);
    const _purchase_id = sc_0.loadUintBig(64);
    return { $$type: 'FundAnonPool' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadTupleFundAnonPool(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPool' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadGetterTupleFundAnonPool(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPool' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function storeTupleFundAnonPool(source: FundAnonPool) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.purchase_id);
    return builder.build();
}

export function dictValueParserFundAnonPool(): DictionaryValue<FundAnonPool> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFundAnonPool(src)).endCell());
        },
        parse: (src) => {
            return loadFundAnonPool(src.loadRef().beginParse());
        }
    }
}

export type FundAnonPoolAck = {
    $$type: 'FundAnonPoolAck';
    credits_k: bigint;
    epoch: bigint;
    purchase_id: bigint;
}

export function storeFundAnonPoolAck(src: FundAnonPoolAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1178684993, 32);
        b_0.storeUint(src.credits_k, 64);
        b_0.storeUint(src.epoch, 32);
        b_0.storeUint(src.purchase_id, 64);
    };
}

export function loadFundAnonPoolAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1178684993) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(64);
    const _epoch = sc_0.loadUintBig(32);
    const _purchase_id = sc_0.loadUintBig(64);
    return { $$type: 'FundAnonPoolAck' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadTupleFundAnonPoolAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPoolAck' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function loadGetterTupleFundAnonPoolAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _epoch = source.readBigNumber();
    const _purchase_id = source.readBigNumber();
    return { $$type: 'FundAnonPoolAck' as const, credits_k: _credits_k, epoch: _epoch, purchase_id: _purchase_id };
}

export function storeTupleFundAnonPoolAck(source: FundAnonPoolAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.epoch);
    builder.writeNumber(source.purchase_id);
    return builder.build();
}

export function dictValueParserFundAnonPoolAck(): DictionaryValue<FundAnonPoolAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFundAnonPoolAck(src)).endCell());
        },
        parse: (src) => {
            return loadFundAnonPoolAck(src.loadRef().beginParse());
        }
    }
}

export type IssuerSlot = {
    $$type: 'IssuerSlot';
    pubkey: bigint;
    active: boolean;
    version: bigint;
}

export function storeIssuerSlot(src: IssuerSlot) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.pubkey, 256);
        b_0.storeBit(src.active);
        b_0.storeUint(src.version, 32);
    };
}

export function loadIssuerSlot(slice: Slice) {
    const sc_0 = slice;
    const _pubkey = sc_0.loadUintBig(256);
    const _active = sc_0.loadBit();
    const _version = sc_0.loadUintBig(32);
    return { $$type: 'IssuerSlot' as const, pubkey: _pubkey, active: _active, version: _version };
}

export function loadTupleIssuerSlot(source: TupleReader) {
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'IssuerSlot' as const, pubkey: _pubkey, active: _active, version: _version };
}

export function loadGetterTupleIssuerSlot(source: TupleReader) {
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'IssuerSlot' as const, pubkey: _pubkey, active: _active, version: _version };
}

export function storeTupleIssuerSlot(source: IssuerSlot) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.pubkey);
    builder.writeBoolean(source.active);
    builder.writeNumber(source.version);
    return builder.build();
}

export function dictValueParserIssuerSlot(): DictionaryValue<IssuerSlot> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeIssuerSlot(src)).endCell());
        },
        parse: (src) => {
            return loadIssuerSlot(src.loadRef().beginParse());
        }
    }
}

export type PendingPurchase = {
    $$type: 'PendingPurchase';
    payer: Address;
    credits_k: bigint;
    refund_amount: bigint;
}

export function storePendingPurchase(src: PendingPurchase) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.payer);
        b_0.storeUint(src.credits_k, 64);
        b_0.storeUint(src.refund_amount, 128);
    };
}

export function loadPendingPurchase(slice: Slice) {
    const sc_0 = slice;
    const _payer = sc_0.loadAddress();
    const _credits_k = sc_0.loadUintBig(64);
    const _refund_amount = sc_0.loadUintBig(128);
    return { $$type: 'PendingPurchase' as const, payer: _payer, credits_k: _credits_k, refund_amount: _refund_amount };
}

export function loadTuplePendingPurchase(source: TupleReader) {
    const _payer = source.readAddress();
    const _credits_k = source.readBigNumber();
    const _refund_amount = source.readBigNumber();
    return { $$type: 'PendingPurchase' as const, payer: _payer, credits_k: _credits_k, refund_amount: _refund_amount };
}

export function loadGetterTuplePendingPurchase(source: TupleReader) {
    const _payer = source.readAddress();
    const _credits_k = source.readBigNumber();
    const _refund_amount = source.readBigNumber();
    return { $$type: 'PendingPurchase' as const, payer: _payer, credits_k: _credits_k, refund_amount: _refund_amount };
}

export function storeTuplePendingPurchase(source: PendingPurchase) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.payer);
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.refund_amount);
    return builder.build();
}

export function dictValueParserPendingPurchase(): DictionaryValue<PendingPurchase> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingPurchase(src)).endCell());
        },
        parse: (src) => {
            return loadPendingPurchase(src.loadRef().beginParse());
        }
    }
}

export type PendingPurchaseView = {
    $$type: 'PendingPurchaseView';
    exists: boolean;
    payer: Address;
    credits_k: bigint;
    refund_amount: bigint;
}

export function storePendingPurchaseView(src: PendingPurchaseView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeAddress(src.payer);
        b_0.storeInt(src.credits_k, 257);
        b_0.storeInt(src.refund_amount, 257);
    };
}

export function loadPendingPurchaseView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _payer = sc_0.loadAddress();
    const _credits_k = sc_0.loadIntBig(257);
    const _refund_amount = sc_0.loadIntBig(257);
    return { $$type: 'PendingPurchaseView' as const, exists: _exists, payer: _payer, credits_k: _credits_k, refund_amount: _refund_amount };
}

export function loadTuplePendingPurchaseView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _payer = source.readAddress();
    const _credits_k = source.readBigNumber();
    const _refund_amount = source.readBigNumber();
    return { $$type: 'PendingPurchaseView' as const, exists: _exists, payer: _payer, credits_k: _credits_k, refund_amount: _refund_amount };
}

export function loadGetterTuplePendingPurchaseView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _payer = source.readAddress();
    const _credits_k = source.readBigNumber();
    const _refund_amount = source.readBigNumber();
    return { $$type: 'PendingPurchaseView' as const, exists: _exists, payer: _payer, credits_k: _credits_k, refund_amount: _refund_amount };
}

export function storeTuplePendingPurchaseView(source: PendingPurchaseView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeAddress(source.payer);
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.refund_amount);
    return builder.build();
}

export function dictValueParserPendingPurchaseView(): DictionaryValue<PendingPurchaseView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePendingPurchaseView(src)).endCell());
        },
        parse: (src) => {
            return loadPendingPurchaseView(src.loadRef().beginParse());
        }
    }
}

export type CreditIssuerSlotView = {
    $$type: 'CreditIssuerSlotView';
    exists: boolean;
    pubkey: bigint;
    active: boolean;
    version: bigint;
}

export function storeCreditIssuerSlotView(src: CreditIssuerSlotView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.exists);
        b_0.storeInt(src.pubkey, 257);
        b_0.storeBit(src.active);
        b_0.storeInt(src.version, 257);
    };
}

export function loadCreditIssuerSlotView(slice: Slice) {
    const sc_0 = slice;
    const _exists = sc_0.loadBit();
    const _pubkey = sc_0.loadIntBig(257);
    const _active = sc_0.loadBit();
    const _version = sc_0.loadIntBig(257);
    return { $$type: 'CreditIssuerSlotView' as const, exists: _exists, pubkey: _pubkey, active: _active, version: _version };
}

export function loadTupleCreditIssuerSlotView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'CreditIssuerSlotView' as const, exists: _exists, pubkey: _pubkey, active: _active, version: _version };
}

export function loadGetterTupleCreditIssuerSlotView(source: TupleReader) {
    const _exists = source.readBoolean();
    const _pubkey = source.readBigNumber();
    const _active = source.readBoolean();
    const _version = source.readBigNumber();
    return { $$type: 'CreditIssuerSlotView' as const, exists: _exists, pubkey: _pubkey, active: _active, version: _version };
}

export function storeTupleCreditIssuerSlotView(source: CreditIssuerSlotView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.exists);
    builder.writeNumber(source.pubkey);
    builder.writeBoolean(source.active);
    builder.writeNumber(source.version);
    return builder.build();
}

export function dictValueParserCreditIssuerSlotView(): DictionaryValue<CreditIssuerSlotView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditIssuerSlotView(src)).endCell());
        },
        parse: (src) => {
            return loadCreditIssuerSlotView(src.loadRef().beginParse());
        }
    }
}

export type CreditIssuerGlobalView = {
    $$type: 'CreditIssuerGlobalView';
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    genesis_controller_address: Address;
    issuer_slot_count: bigint;
    active_slot_count: bigint;
    credit_price: bigint;
    pool_collected: bigint;
    credits_sold: bigint;
    min_issuer_slots: bigint;
    max_issuer_slots: bigint;
    max_credits_per_buy: bigint;
    base_storage_endowment: bigint;
    hub_bound: boolean;
    capsule_hub_address: Address;
    prepaid_unit: bigint;
    hub_fund_gas: bigint;
    airdrop_pool_address: Address;
    airdrop_pool_bound: boolean;
}

export function storeCreditIssuerGlobalView(src: CreditIssuerGlobalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.genesis_controller_address);
        const b_1 = new Builder();
        b_1.storeInt(src.issuer_slot_count, 257);
        b_1.storeInt(src.active_slot_count, 257);
        b_1.storeInt(src.credit_price, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.pool_collected, 257);
        b_2.storeInt(src.credits_sold, 257);
        b_2.storeInt(src.min_issuer_slots, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.max_issuer_slots, 257);
        b_3.storeInt(src.max_credits_per_buy, 257);
        b_3.storeInt(src.base_storage_endowment, 257);
        b_3.storeBit(src.hub_bound);
        const b_4 = new Builder();
        b_4.storeAddress(src.capsule_hub_address);
        b_4.storeInt(src.prepaid_unit, 257);
        b_4.storeInt(src.hub_fund_gas, 257);
        const b_5 = new Builder();
        b_5.storeAddress(src.airdrop_pool_address);
        b_5.storeBit(src.airdrop_pool_bound);
        b_4.storeRef(b_5.endCell());
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCreditIssuerGlobalView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _genesis_controller_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _issuer_slot_count = sc_1.loadIntBig(257);
    const _active_slot_count = sc_1.loadIntBig(257);
    const _credit_price = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _pool_collected = sc_2.loadIntBig(257);
    const _credits_sold = sc_2.loadIntBig(257);
    const _min_issuer_slots = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _max_issuer_slots = sc_3.loadIntBig(257);
    const _max_credits_per_buy = sc_3.loadIntBig(257);
    const _base_storage_endowment = sc_3.loadIntBig(257);
    const _hub_bound = sc_3.loadBit();
    const sc_4 = sc_3.loadRef().beginParse();
    const _capsule_hub_address = sc_4.loadAddress();
    const _prepaid_unit = sc_4.loadIntBig(257);
    const _hub_fund_gas = sc_4.loadIntBig(257);
    const sc_5 = sc_4.loadRef().beginParse();
    const _airdrop_pool_address = sc_5.loadAddress();
    const _airdrop_pool_bound = sc_5.loadBit();
    return { $$type: 'CreditIssuerGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, issuer_slot_count: _issuer_slot_count, active_slot_count: _active_slot_count, credit_price: _credit_price, pool_collected: _pool_collected, credits_sold: _credits_sold, min_issuer_slots: _min_issuer_slots, max_issuer_slots: _max_issuer_slots, max_credits_per_buy: _max_credits_per_buy, base_storage_endowment: _base_storage_endowment, hub_bound: _hub_bound, capsule_hub_address: _capsule_hub_address, prepaid_unit: _prepaid_unit, hub_fund_gas: _hub_fund_gas, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound };
}

export function loadTupleCreditIssuerGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _issuer_slot_count = source.readBigNumber();
    const _active_slot_count = source.readBigNumber();
    const _credit_price = source.readBigNumber();
    const _pool_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _min_issuer_slots = source.readBigNumber();
    const _max_issuer_slots = source.readBigNumber();
    const _max_credits_per_buy = source.readBigNumber();
    const _base_storage_endowment = source.readBigNumber();
    const _hub_bound = source.readBoolean();
    source = source.readTuple();
    const _capsule_hub_address = source.readAddress();
    const _prepaid_unit = source.readBigNumber();
    const _hub_fund_gas = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    return { $$type: 'CreditIssuerGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, issuer_slot_count: _issuer_slot_count, active_slot_count: _active_slot_count, credit_price: _credit_price, pool_collected: _pool_collected, credits_sold: _credits_sold, min_issuer_slots: _min_issuer_slots, max_issuer_slots: _max_issuer_slots, max_credits_per_buy: _max_credits_per_buy, base_storage_endowment: _base_storage_endowment, hub_bound: _hub_bound, capsule_hub_address: _capsule_hub_address, prepaid_unit: _prepaid_unit, hub_fund_gas: _hub_fund_gas, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound };
}

export function loadGetterTupleCreditIssuerGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _issuer_slot_count = source.readBigNumber();
    const _active_slot_count = source.readBigNumber();
    const _credit_price = source.readBigNumber();
    const _pool_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _min_issuer_slots = source.readBigNumber();
    const _max_issuer_slots = source.readBigNumber();
    const _max_credits_per_buy = source.readBigNumber();
    const _base_storage_endowment = source.readBigNumber();
    const _hub_bound = source.readBoolean();
    const _capsule_hub_address = source.readAddress();
    const _prepaid_unit = source.readBigNumber();
    const _hub_fund_gas = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    return { $$type: 'CreditIssuerGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, issuer_slot_count: _issuer_slot_count, active_slot_count: _active_slot_count, credit_price: _credit_price, pool_collected: _pool_collected, credits_sold: _credits_sold, min_issuer_slots: _min_issuer_slots, max_issuer_slots: _max_issuer_slots, max_credits_per_buy: _max_credits_per_buy, base_storage_endowment: _base_storage_endowment, hub_bound: _hub_bound, capsule_hub_address: _capsule_hub_address, prepaid_unit: _prepaid_unit, hub_fund_gas: _hub_fund_gas, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound };
}

export function storeTupleCreditIssuerGlobalView(source: CreditIssuerGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.issuer_slot_count);
    builder.writeNumber(source.active_slot_count);
    builder.writeNumber(source.credit_price);
    builder.writeNumber(source.pool_collected);
    builder.writeNumber(source.credits_sold);
    builder.writeNumber(source.min_issuer_slots);
    builder.writeNumber(source.max_issuer_slots);
    builder.writeNumber(source.max_credits_per_buy);
    builder.writeNumber(source.base_storage_endowment);
    builder.writeBoolean(source.hub_bound);
    builder.writeAddress(source.capsule_hub_address);
    builder.writeNumber(source.prepaid_unit);
    builder.writeNumber(source.hub_fund_gas);
    builder.writeAddress(source.airdrop_pool_address);
    builder.writeBoolean(source.airdrop_pool_bound);
    return builder.build();
}

export function dictValueParserCreditIssuerGlobalView(): DictionaryValue<CreditIssuerGlobalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditIssuerGlobalView(src)).endCell());
        },
        parse: (src) => {
            return loadCreditIssuerGlobalView(src.loadRef().beginParse());
        }
    }
}

export type CreditIssuer$Data = {
    $$type: 'CreditIssuer$Data';
    sealed: boolean;
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    issuer_slot_count: bigint;
    active_slot_count: bigint;
    issuer_slots: Dictionary<bigint, IssuerSlot>;
    credit_price: bigint;
    pool_collected: bigint;
    credits_sold: bigint;
    capsule_hub_address: Address;
    hub_bound: boolean;
    pending_purchases: Dictionary<bigint, PendingPurchase>;
    purchase_seq: bigint;
    airdrop_pool_address: Address;
    airdrop_pool_bound: boolean;
}

export function storeCreditIssuer$Data(src: CreditIssuer$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeUint(src.genesis_config_hash, 256);
        b_0.storeUint(src.issuer_slot_count, 8);
        b_0.storeUint(src.active_slot_count, 8);
        b_0.storeDict(src.issuer_slots, Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot());
        b_0.storeUint(src.credit_price, 128);
        const b_1 = new Builder();
        b_1.storeUint(src.pool_collected, 128);
        b_1.storeUint(src.credits_sold, 64);
        b_1.storeAddress(src.capsule_hub_address);
        b_1.storeBit(src.hub_bound);
        b_1.storeDict(src.pending_purchases, Dictionary.Keys.BigInt(257), dictValueParserPendingPurchase());
        b_1.storeUint(src.purchase_seq, 64);
        b_1.storeAddress(src.airdrop_pool_address);
        b_1.storeBit(src.airdrop_pool_bound);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCreditIssuer$Data(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _genesis_controller_address = sc_0.loadAddress();
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _genesis_config_hash = sc_0.loadUintBig(256);
    const _issuer_slot_count = sc_0.loadUintBig(8);
    const _active_slot_count = sc_0.loadUintBig(8);
    const _issuer_slots = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot(), sc_0);
    const _credit_price = sc_0.loadUintBig(128);
    const sc_1 = sc_0.loadRef().beginParse();
    const _pool_collected = sc_1.loadUintBig(128);
    const _credits_sold = sc_1.loadUintBig(64);
    const _capsule_hub_address = sc_1.loadAddress();
    const _hub_bound = sc_1.loadBit();
    const _pending_purchases = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserPendingPurchase(), sc_1);
    const _purchase_seq = sc_1.loadUintBig(64);
    const _airdrop_pool_address = sc_1.loadAddress();
    const _airdrop_pool_bound = sc_1.loadBit();
    return { $$type: 'CreditIssuer$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, issuer_slot_count: _issuer_slot_count, active_slot_count: _active_slot_count, issuer_slots: _issuer_slots, credit_price: _credit_price, pool_collected: _pool_collected, credits_sold: _credits_sold, capsule_hub_address: _capsule_hub_address, hub_bound: _hub_bound, pending_purchases: _pending_purchases, purchase_seq: _purchase_seq, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound };
}

export function loadTupleCreditIssuer$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _issuer_slot_count = source.readBigNumber();
    const _active_slot_count = source.readBigNumber();
    const _issuer_slots = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot(), source.readCellOpt());
    const _credit_price = source.readBigNumber();
    const _pool_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _hub_bound = source.readBoolean();
    const _pending_purchases = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPurchase(), source.readCellOpt());
    const _purchase_seq = source.readBigNumber();
    source = source.readTuple();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    return { $$type: 'CreditIssuer$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, issuer_slot_count: _issuer_slot_count, active_slot_count: _active_slot_count, issuer_slots: _issuer_slots, credit_price: _credit_price, pool_collected: _pool_collected, credits_sold: _credits_sold, capsule_hub_address: _capsule_hub_address, hub_bound: _hub_bound, pending_purchases: _pending_purchases, purchase_seq: _purchase_seq, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound };
}

export function loadGetterTupleCreditIssuer$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _issuer_slot_count = source.readBigNumber();
    const _active_slot_count = source.readBigNumber();
    const _issuer_slots = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot(), source.readCellOpt());
    const _credit_price = source.readBigNumber();
    const _pool_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _capsule_hub_address = source.readAddress();
    const _hub_bound = source.readBoolean();
    const _pending_purchases = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserPendingPurchase(), source.readCellOpt());
    const _purchase_seq = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    return { $$type: 'CreditIssuer$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, issuer_slot_count: _issuer_slot_count, active_slot_count: _active_slot_count, issuer_slots: _issuer_slots, credit_price: _credit_price, pool_collected: _pool_collected, credits_sold: _credits_sold, capsule_hub_address: _capsule_hub_address, hub_bound: _hub_bound, pending_purchases: _pending_purchases, purchase_seq: _purchase_seq, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound };
}

export function storeTupleCreditIssuer$Data(source: CreditIssuer$Data) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeNumber(source.issuer_slot_count);
    builder.writeNumber(source.active_slot_count);
    builder.writeCell(source.issuer_slots.size > 0 ? beginCell().storeDictDirect(source.issuer_slots, Dictionary.Keys.BigInt(257), dictValueParserIssuerSlot()).endCell() : null);
    builder.writeNumber(source.credit_price);
    builder.writeNumber(source.pool_collected);
    builder.writeNumber(source.credits_sold);
    builder.writeAddress(source.capsule_hub_address);
    builder.writeBoolean(source.hub_bound);
    builder.writeCell(source.pending_purchases.size > 0 ? beginCell().storeDictDirect(source.pending_purchases, Dictionary.Keys.BigInt(257), dictValueParserPendingPurchase()).endCell() : null);
    builder.writeNumber(source.purchase_seq);
    builder.writeAddress(source.airdrop_pool_address);
    builder.writeBoolean(source.airdrop_pool_bound);
    return builder.build();
}

export function dictValueParserCreditIssuer$Data(): DictionaryValue<CreditIssuer$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditIssuer$Data(src)).endCell());
        },
        parse: (src) => {
            return loadCreditIssuer$Data(src.loadRef().beginParse());
        }
    }
}

 type CreditIssuer_init_args = {
    $$type: 'CreditIssuer_init_args';
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    sealed: boolean;
}

function initCreditIssuer_init_args(src: CreditIssuer_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeBit(src.sealed);
    };
}

async function CreditIssuer_init(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
    const __code = Cell.fromHex('b5ee9c7241022901000bf5000114ff00f4a413f4bcf2c80b01020162021e0130d001d072d721d200d200fa4021103450666f04f86102f8620302feed44d0d200018e3ad200fa40d3ffd3ffd307d307f404d37fd401d0d37fd33ffa40d200f404d33ffa40d2003008111008108f108e108d108c108b108a10895710550e8e36fa40810101d700810101d700d200553004d155026d24705470005309702210ad108c108b108a1079106810561045103410236d401370e21111e3020407013a0f8020d7217021d749c21f9430d31f01de821046414e50bae3025f0f5b0501e6d33fd31fd33f55206c31228101012259f40d6fa192306ddf206e92306d9dd0fa40d33fd37f55206c136f03e2206eb3915be30d10df551cc87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed540600e86f238101016dc8216e925b6d9f016f23550255205023cecb3fcb7fc9e225103801206e953059f45a30944133f415e25381be945181a108de5395be945195a109de70047003c8598210435244385003cb1fcb3fcb3fc910341643304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00046e705610d74920c21f97311110d31f1111de21821043524436bae30221821043524431bae30221821043524432bae3022182103a12d1adba080a0b0c04b65b0ffa403010ef10de10cd10bc10ab109a10891078106710561045103411104130db3cdb3c55e081524e11105611db3c353550f3f2f481524ff828561001c705b3f2f410ce10bd10ac109b108a107910681057104610357f4444030d12091a000afa4430c00003f45b0fd307d3ff30011110011111db3cdb3c8152125611c110f2f48152135612c300f2f48152142a810101561359f40c6fa131b3f2f481010111127f70c855205023cbffca00cb1fc9103a0211120201111101206e953059f45a30944133f415e209a408a410df10ce10bd10ac108b0a10681057104610354430120d121a02f65b0fd37f3010ef10de10cd10bc10ab109a10891078106710561045103411104130db3cdb3c388152155610c200f2f410ef10de10cd10bc10ab109a10895506c87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed540d1204f88ff15b0fd3ff3010ef10de10cd10bc10ab109a10891078106710561045103411104130db3cdb3c3c3e8152302fc201f2f481523153cfbaf2f48152322ac207f2f48152332ac111f2f481523429c207f2f481523527c200f2f481523623f2f4815237278208a7c538bef2f47f0f10de0c0d550ae021821043524433ba0d121a0e00108152085610b3f2f4043ce30221821043524434bae30221821043524435bae30221821046414e41ba0f11141802fe5b0fd307d3ff30011110011111db3c81523a5612c300f2f429810101561259f40d6fa192306ddf206e92306d9dd0d3ffd200d31f55206c136f03e281523b216eb3f2f46f2332930ba40bdf8101017f02a40211140201111401c855205023cbffca00cb1fc9103a0211120201111101206e953059f45a30944133f415e210df121000a410ce10bd10ac109b108a091068105710461035440302c87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed5402e85b0fd3073010ef10de10cd10bc10ab109a10891078106710561045103411104130db3c29810101561259f40d6fa192306ddf206e92306d9dd0d3ffd200d31f55206c136f03e281523f216eb3f2f46f2381524058f2f40ca5810101700ea443e0c855205023cbffca00cb1fc9103b102c0111120112130016815229f8425610c705f2f400c2206e953059f45a30944133f415e210ef10de10cd10bc10ab09107810671056104510344130c87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed5402fa5b0fd30fd3ffd31f300f11100f0e11100e0d11100d0c11100c0b11100b0a11100a0911100908111008071110070611100605111005041110040311100302111002011111011112db3c8152445611c200f2f481524556118103e8bbf2f48152461112c30001111201f2f453f7a8208208989680a08208989680a08152471516000e81526c5610f2f401fef8416f24135f0358bef2f45177a0065610a022a4810101f842015613500bc855205023cecb3fcb7fc945905240206e953059f45a30944133f415e256108208a7c538a88208989680a011117f11147005c85520821046414e505004cb1f12cb3fcb1fcb3fc926040311120302111402014343c8cf8580ca00cf8440ce01fa021700b8806acf40f400c901fb0010cf10be10ad109c108b107a10691058103745165521c87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed5403f48f765b0fd33f31d31f31d33f30815258f84226c705f2f4228101012259f40d6fa192306ddf206e92306d9dd0fa40d33fd37f55206c136f03e28101016dc8216e925b6d9f016f23550255205023cecb3fcb7fc9e223103601206e953059f45a30944133f415e2561193236eb39170e2923330e30d10df551ce021191a1b00ca821004c4b4007170266f235b076f2330314570c855208210414452105004cb1f12cb3fcecb3fc95612441403506610246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb000078c87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed5402fc821043524439ba8e645f030efa403081526c2eb3f2f4815229f8422ec705f2f48152381110b301111001f2f410ce551b7fc87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed54e0571120821043524437bae302c00011101c1d0084303f10df551cc87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed5400a0c12101111001b08e4010df551cc87f01ca00111055e011101fca001dce1bcbff19cbff17cb0715cb0713f400cb7f01c8cb7f12cb3f12ce12ca0012f40012cb3f12ce12ca00cdc9ed54e05f0f30f2c0820201581f26020120202301fbb40d3da89a1a400031c75a401f481a7ffa7ffa60fa60fe809a6ffa803a1a6ffa67ff481a401e809a67ff481a4006010222010211e211c211a2118211621142112ae20aa1d1c6df481020203ae01020203ae01a400aa6009a2aa04da48e0a8e000a612e044215a21182116211420f220d020ac208a20682046da8026e1c502101180f11100f550edb3c6cc46c442200608101012b0259f40d6fa192306ddf206e92306d9dd0d3ffd200d31f55206c136f03e2206e953070707021e06f237f552001fbb693dda89a1a400031c75a401f481a7ffa7ffa60fa60fe809a6ffa803a1a6ffa67ff481a401e809a67ff481a4006010222010211e211c211a2118211621142112ae20aa1d1c6df481020203ae01020203ae01a400aa6009a2aa04da48e0a8e000a612e044215a21182116211420f220d020ac208a20682046da8026e1c502401180f11100f550edb3c6cc46c44250062810101250259f40d6fa192306ddf206e92306d9dd0fa40d33fd37f55206c136f03e2206e963070f8287020e06f237f552001fbbafb3ed44d0d200018e3ad200fa40d3ffd3ffd307d307f404d37fd401d0d37fd33ffa40d200f404d33ffa40d2003008111008108f108e108d108c108b108a10895710550e8e36fa40810101d700810101d700d200553004d155026d24705470005309702210ad108c108b108a1079106810561045103410236d401370e2827015cdb3c57135713571357135713571357135713571357135713571357135713571357130211120201111101111055c228007c7880108103e8821005f5e1008208a7c538820898968056150656140656140656170656150656150656140656140656144516504356130256150256125612e6916fa3');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initCreditIssuer_init_args({ $$type: 'CreditIssuer_init_args', genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const CreditIssuer_errors = {
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

export const CreditIssuer_errors_backward = {
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

const CreditIssuer_types: ABIType[] = [
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
    {"name":"CreditUploadIssuerKey","header":1129464881,"fields":[{"name":"slot","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CreditSetPrice","header":1129464882,"fields":[{"name":"credit_price","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CreditSealGenesis","header":974311853,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CreditReplaceIssuerKey","header":1129464883,"fields":[{"name":"slot","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"new_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CreditRevokeIssuerKey","header":1129464884,"fields":[{"name":"slot","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"CreditBuyCredits","header":1129464885,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"redeem_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"CreditBindHub","header":1129464886,"fields":[{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"CreditTopUpStorageReserve","header":1129464887,"fields":[]},
    {"name":"CreditBindAirdropPool","header":1129464889,"fields":[{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropAccrue","header":1094996496,"fields":[{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"CreditPurchaseRefund","header":1129464888,"fields":[{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FundAnonPool","header":1178685008,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FundAnonPoolAck","header":1178684993,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"epoch","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"IssuerSlot","header":null,"fields":[{"name":"pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}},{"name":"version","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"PendingPurchase","header":null,"fields":[{"name":"payer","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"refund_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"PendingPurchaseView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"payer","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits_k","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refund_amount","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CreditIssuerSlotView","header":null,"fields":[{"name":"exists","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pubkey","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}},{"name":"version","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CreditIssuerGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"issuer_slot_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"active_slot_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"credit_price","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"pool_collected","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"credits_sold","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_issuer_slots","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_issuer_slots","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_credits_per_buy","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"base_storage_endowment","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"prepaid_unit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"hub_fund_gas","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"airdrop_pool_bound","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"CreditIssuer$Data","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"issuer_slot_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"active_slot_count","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"issuer_slots","type":{"kind":"dict","key":"int","value":"IssuerSlot","valueFormat":"ref"}},{"name":"credit_price","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"pool_collected","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"credits_sold","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"capsule_hub_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"hub_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"pending_purchases","type":{"kind":"dict","key":"int","value":"PendingPurchase","valueFormat":"ref"}},{"name":"purchase_seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"airdrop_pool_bound","type":{"kind":"simple","type":"bool","optional":false}}]},
]

const CreditIssuer_opcodes = {
    "CreditUploadIssuerKey": 1129464881,
    "CreditSetPrice": 1129464882,
    "CreditSealGenesis": 974311853,
    "CreditReplaceIssuerKey": 1129464883,
    "CreditRevokeIssuerKey": 1129464884,
    "CreditBuyCredits": 1129464885,
    "CreditBindHub": 1129464886,
    "CreditTopUpStorageReserve": 1129464887,
    "CreditBindAirdropPool": 1129464889,
    "AirdropAccrue": 1094996496,
    "CreditPurchaseRefund": 1129464888,
    "FundAnonPool": 1178685008,
    "FundAnonPoolAck": 1178684993,
}

const CreditIssuer_getters: ABIGetter[] = [
    {"name":"get_issuer_slot","methodId":98409,"arguments":[{"name":"slot","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"CreditIssuerSlotView","optional":false}},
    {"name":"get_pending_purchase","methodId":111774,"arguments":[{"name":"purchaseId","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"PendingPurchaseView","optional":false}},
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"CreditIssuerGlobalView","optional":false}},
]

export const CreditIssuer_getterMapping: { [key: string]: string } = {
    'get_issuer_slot': 'getGetIssuerSlot',
    'get_pending_purchase': 'getGetPendingPurchase',
    'get_global': 'getGetGlobal',
}

const CreditIssuer_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"CreditBindHub"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditUploadIssuerKey"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditSetPrice"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditSealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditReplaceIssuerKey"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditRevokeIssuerKey"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditBuyCredits"}},
    {"receiver":"internal","message":{"kind":"typed","type":"FundAnonPoolAck"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditBindAirdropPool"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CreditTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
]

export const CREDIT_MIN_ISSUER_SLOTS = 8n;
export const CREDIT_MAX_ISSUER_SLOTS = 16n;
export const CREDIT_MAX_CREDITS_PER_BUY = 1000n;
export const CREDIT_BUY_EXEC_RESERVE = 10000000n;
export const CREDIT_BASE_STORAGE_ENDOWMENT = 100000000n;
export const CREDIT_PREPAID_UNIT = 10995000n;
export const CREDIT_HUB_FUND_GAS = 10000000n;
export const CREDIT_AIRDROP_ACCRUE_GAS = 80000000n;

export class CreditIssuer implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = CreditIssuer_errors_backward;
    public static readonly opcodes = CreditIssuer_opcodes;
    
    static async init(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
        return await CreditIssuer_init(genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed);
    }
    
    static async fromInit(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
        const __gen_init = await CreditIssuer_init(genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed);
        const address = contractAddress(0, __gen_init);
        return new CreditIssuer(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new CreditIssuer(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  CreditIssuer_types,
        getters: CreditIssuer_getters,
        receivers: CreditIssuer_receivers,
        errors: CreditIssuer_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: CreditBindHub | CreditUploadIssuerKey | CreditSetPrice | CreditSealGenesis | CreditReplaceIssuerKey | CreditRevokeIssuerKey | CreditBuyCredits | FundAnonPoolAck | CreditBindAirdropPool | CreditTopUpStorageReserve | null) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditBindHub') {
            body = beginCell().store(storeCreditBindHub(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditUploadIssuerKey') {
            body = beginCell().store(storeCreditUploadIssuerKey(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditSetPrice') {
            body = beginCell().store(storeCreditSetPrice(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditSealGenesis') {
            body = beginCell().store(storeCreditSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditReplaceIssuerKey') {
            body = beginCell().store(storeCreditReplaceIssuerKey(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditRevokeIssuerKey') {
            body = beginCell().store(storeCreditRevokeIssuerKey(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditBuyCredits') {
            body = beginCell().store(storeCreditBuyCredits(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'FundAnonPoolAck') {
            body = beginCell().store(storeFundAnonPoolAck(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditBindAirdropPool') {
            body = beginCell().store(storeCreditBindAirdropPool(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreditTopUpStorageReserve') {
            body = beginCell().store(storeCreditTopUpStorageReserve(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetIssuerSlot(provider: ContractProvider, slot: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(slot);
        const source = (await provider.get('get_issuer_slot', builder.build())).stack;
        const result = loadGetterTupleCreditIssuerSlotView(source);
        return result;
    }
    
    async getGetPendingPurchase(provider: ContractProvider, purchaseId: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(purchaseId);
        const source = (await provider.get('get_pending_purchase', builder.build())).stack;
        const result = loadGetterTuplePendingPurchaseView(source);
        return result;
    }
    
    async getGetGlobal(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_global', builder.build())).stack;
        const result = loadGetterTupleCreditIssuerGlobalView(source);
        return result;
    }
    
}