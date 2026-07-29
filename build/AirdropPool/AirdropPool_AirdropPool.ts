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

export type AirdropBindAthMaster = {
    $$type: 'AirdropBindAthMaster';
    ath_master_address: Address;
    pool_ath_wallet_address: Address;
}

export function storeAirdropBindAthMaster(src: AirdropBindAthMaster) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996481, 32);
        b_0.storeAddress(src.ath_master_address);
        b_0.storeAddress(src.pool_ath_wallet_address);
    };
}

export function loadAirdropBindAthMaster(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996481) { throw Error('Invalid prefix'); }
    const _ath_master_address = sc_0.loadAddress();
    const _pool_ath_wallet_address = sc_0.loadAddress();
    return { $$type: 'AirdropBindAthMaster' as const, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address };
}

export function loadTupleAirdropBindAthMaster(source: TupleReader) {
    const _ath_master_address = source.readAddress();
    const _pool_ath_wallet_address = source.readAddress();
    return { $$type: 'AirdropBindAthMaster' as const, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address };
}

export function loadGetterTupleAirdropBindAthMaster(source: TupleReader) {
    const _ath_master_address = source.readAddress();
    const _pool_ath_wallet_address = source.readAddress();
    return { $$type: 'AirdropBindAthMaster' as const, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address };
}

export function storeTupleAirdropBindAthMaster(source: AirdropBindAthMaster) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.pool_ath_wallet_address);
    return builder.build();
}

export function dictValueParserAirdropBindAthMaster(): DictionaryValue<AirdropBindAthMaster> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropBindAthMaster(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropBindAthMaster(src.loadRef().beginParse());
        }
    }
}

export type AirdropBindCreditIssuer = {
    $$type: 'AirdropBindCreditIssuer';
    credit_issuer_address: Address;
}

export function storeAirdropBindCreditIssuer(src: AirdropBindCreditIssuer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996482, 32);
        b_0.storeAddress(src.credit_issuer_address);
    };
}

export function loadAirdropBindCreditIssuer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996482) { throw Error('Invalid prefix'); }
    const _credit_issuer_address = sc_0.loadAddress();
    return { $$type: 'AirdropBindCreditIssuer' as const, credit_issuer_address: _credit_issuer_address };
}

export function loadTupleAirdropBindCreditIssuer(source: TupleReader) {
    const _credit_issuer_address = source.readAddress();
    return { $$type: 'AirdropBindCreditIssuer' as const, credit_issuer_address: _credit_issuer_address };
}

export function loadGetterTupleAirdropBindCreditIssuer(source: TupleReader) {
    const _credit_issuer_address = source.readAddress();
    return { $$type: 'AirdropBindCreditIssuer' as const, credit_issuer_address: _credit_issuer_address };
}

export function storeTupleAirdropBindCreditIssuer(source: AirdropBindCreditIssuer) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.credit_issuer_address);
    return builder.build();
}

export function dictValueParserAirdropBindCreditIssuer(): DictionaryValue<AirdropBindCreditIssuer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropBindCreditIssuer(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropBindCreditIssuer(src.loadRef().beginParse());
        }
    }
}

export type AirdropRebindCreditIssuer = {
    $$type: 'AirdropRebindCreditIssuer';
    deployment_manifest_hash: bigint;
    credit_issuer_address: Address;
}

export function storeAirdropRebindCreditIssuer(src: AirdropRebindCreditIssuer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996537, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.credit_issuer_address);
    };
}

export function loadAirdropRebindCreditIssuer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996537) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _credit_issuer_address = sc_0.loadAddress();
    return { $$type: 'AirdropRebindCreditIssuer' as const, deployment_manifest_hash: _deployment_manifest_hash, credit_issuer_address: _credit_issuer_address };
}

export function loadTupleAirdropRebindCreditIssuer(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _credit_issuer_address = source.readAddress();
    return { $$type: 'AirdropRebindCreditIssuer' as const, deployment_manifest_hash: _deployment_manifest_hash, credit_issuer_address: _credit_issuer_address };
}

export function loadGetterTupleAirdropRebindCreditIssuer(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    const _credit_issuer_address = source.readAddress();
    return { $$type: 'AirdropRebindCreditIssuer' as const, deployment_manifest_hash: _deployment_manifest_hash, credit_issuer_address: _credit_issuer_address };
}

export function storeTupleAirdropRebindCreditIssuer(source: AirdropRebindCreditIssuer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.credit_issuer_address);
    return builder.build();
}

export function dictValueParserAirdropRebindCreditIssuer(): DictionaryValue<AirdropRebindCreditIssuer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropRebindCreditIssuer(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropRebindCreditIssuer(src.loadRef().beginParse());
        }
    }
}

export type AirdropBindTreasury = {
    $$type: 'AirdropBindTreasury';
    treasury_address: Address;
}

export function storeAirdropBindTreasury(src: AirdropBindTreasury) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996483, 32);
        b_0.storeAddress(src.treasury_address);
    };
}

export function loadAirdropBindTreasury(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996483) { throw Error('Invalid prefix'); }
    const _treasury_address = sc_0.loadAddress();
    return { $$type: 'AirdropBindTreasury' as const, treasury_address: _treasury_address };
}

export function loadTupleAirdropBindTreasury(source: TupleReader) {
    const _treasury_address = source.readAddress();
    return { $$type: 'AirdropBindTreasury' as const, treasury_address: _treasury_address };
}

export function loadGetterTupleAirdropBindTreasury(source: TupleReader) {
    const _treasury_address = source.readAddress();
    return { $$type: 'AirdropBindTreasury' as const, treasury_address: _treasury_address };
}

export function storeTupleAirdropBindTreasury(source: AirdropBindTreasury) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.treasury_address);
    return builder.build();
}

export function dictValueParserAirdropBindTreasury(): DictionaryValue<AirdropBindTreasury> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropBindTreasury(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropBindTreasury(src.loadRef().beginParse());
        }
    }
}

export type AirdropSealGenesis = {
    $$type: 'AirdropSealGenesis';
    deployment_manifest_hash: bigint;
}

export function storeAirdropSealGenesis(src: AirdropSealGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996484, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadAirdropSealGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996484) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'AirdropSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleAirdropSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'AirdropSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleAirdropSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'AirdropSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleAirdropSealGenesis(source: AirdropSealGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserAirdropSealGenesis(): DictionaryValue<AirdropSealGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropSealGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropSealGenesis(src.loadRef().beginParse());
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
        b_0.storeUint(src.credits_k, 32);
    };
}

export function loadAirdropAccrue(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996496) { throw Error('Invalid prefix'); }
    const _purchase_id = sc_0.loadUintBig(64);
    const _buyer = sc_0.loadAddress();
    const _credits_k = sc_0.loadUintBig(32);
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

export type AirdropTopUpStorageReserve = {
    $$type: 'AirdropTopUpStorageReserve';
}

export function storeAirdropTopUpStorageReserve(src: AirdropTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996497, 32);
    };
}

export function loadAirdropTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996497) { throw Error('Invalid prefix'); }
    return { $$type: 'AirdropTopUpStorageReserve' as const };
}

export function loadTupleAirdropTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'AirdropTopUpStorageReserve' as const };
}

export function loadGetterTupleAirdropTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'AirdropTopUpStorageReserve' as const };
}

export function storeTupleAirdropTopUpStorageReserve(source: AirdropTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserAirdropTopUpStorageReserve(): DictionaryValue<AirdropTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropTopUpStorageReserve(src.loadRef().beginParse());
        }
    }
}

export type AirdropSweepResidualToTreasury = {
    $$type: 'AirdropSweepResidualToTreasury';
}

export function storeAirdropSweepResidualToTreasury(src: AirdropSweepResidualToTreasury) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996498, 32);
    };
}

export function loadAirdropSweepResidualToTreasury(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996498) { throw Error('Invalid prefix'); }
    return { $$type: 'AirdropSweepResidualToTreasury' as const };
}

export function loadTupleAirdropSweepResidualToTreasury(source: TupleReader) {
    return { $$type: 'AirdropSweepResidualToTreasury' as const };
}

export function loadGetterTupleAirdropSweepResidualToTreasury(source: TupleReader) {
    return { $$type: 'AirdropSweepResidualToTreasury' as const };
}

export function storeTupleAirdropSweepResidualToTreasury(source: AirdropSweepResidualToTreasury) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserAirdropSweepResidualToTreasury(): DictionaryValue<AirdropSweepResidualToTreasury> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropSweepResidualToTreasury(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropSweepResidualToTreasury(src.loadRef().beginParse());
        }
    }
}

export type AirdropSweepUnaccountedTon = {
    $$type: 'AirdropSweepUnaccountedTon';
}

export function storeAirdropSweepUnaccountedTon(src: AirdropSweepUnaccountedTon) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1094996499, 32);
    };
}

export function loadAirdropSweepUnaccountedTon(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1094996499) { throw Error('Invalid prefix'); }
    return { $$type: 'AirdropSweepUnaccountedTon' as const };
}

export function loadTupleAirdropSweepUnaccountedTon(source: TupleReader) {
    return { $$type: 'AirdropSweepUnaccountedTon' as const };
}

export function loadGetterTupleAirdropSweepUnaccountedTon(source: TupleReader) {
    return { $$type: 'AirdropSweepUnaccountedTon' as const };
}

export function storeTupleAirdropSweepUnaccountedTon(source: AirdropSweepUnaccountedTon) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserAirdropSweepUnaccountedTon(): DictionaryValue<AirdropSweepUnaccountedTon> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropSweepUnaccountedTon(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropSweepUnaccountedTon(src.loadRef().beginParse());
        }
    }
}

export type ATHTransferRequest = {
    $$type: 'ATHTransferRequest';
    query_id: bigint;
    amount: bigint;
    recipient: Address;
    response_destination: Address;
}

export function storeATHTransferRequest(src: ATHTransferRequest) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096042512, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.recipient);
        b_0.storeAddress(src.response_destination);
    };
}

export function loadATHTransferRequest(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096042512) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _amount = sc_0.loadUintBig(128);
    const _recipient = sc_0.loadAddress();
    const _response_destination = sc_0.loadAddress();
    return { $$type: 'ATHTransferRequest' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination };
}

export function loadTupleATHTransferRequest(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHTransferRequest' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination };
}

export function loadGetterTupleATHTransferRequest(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _recipient = source.readAddress();
    const _response_destination = source.readAddress();
    return { $$type: 'ATHTransferRequest' as const, query_id: _query_id, amount: _amount, recipient: _recipient, response_destination: _response_destination };
}

export function storeTupleATHTransferRequest(source: ATHTransferRequest) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.recipient);
    builder.writeAddress(source.response_destination);
    return builder.build();
}

export function dictValueParserATHTransferRequest(): DictionaryValue<ATHTransferRequest> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeATHTransferRequest(src)).endCell());
        },
        parse: (src) => {
            return loadATHTransferRequest(src.loadRef().beginParse());
        }
    }
}

export type AthTransferNotification = {
    $$type: 'AthTransferNotification';
    query_id: bigint;
    sender_key: bigint;
    amount: bigint;
    sender_wallet: Address;
}

export function storeAthTransferNotification(src: AthTransferNotification) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1194171773, 32);
        b_0.storeUint(src.query_id, 64);
        b_0.storeUint(src.sender_key, 160);
        b_0.storeUint(src.amount, 128);
        b_0.storeAddress(src.sender_wallet);
    };
}

export function loadAthTransferNotification(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1194171773) { throw Error('Invalid prefix'); }
    const _query_id = sc_0.loadUintBig(64);
    const _sender_key = sc_0.loadUintBig(160);
    const _amount = sc_0.loadUintBig(128);
    const _sender_wallet = sc_0.loadAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, sender_wallet: _sender_wallet };
}

export function loadTupleAthTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_wallet = source.readAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, sender_wallet: _sender_wallet };
}

export function loadGetterTupleAthTransferNotification(source: TupleReader) {
    const _query_id = source.readBigNumber();
    const _sender_key = source.readBigNumber();
    const _amount = source.readBigNumber();
    const _sender_wallet = source.readAddress();
    return { $$type: 'AthTransferNotification' as const, query_id: _query_id, sender_key: _sender_key, amount: _amount, sender_wallet: _sender_wallet };
}

export function storeTupleAthTransferNotification(source: AthTransferNotification) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.query_id);
    builder.writeNumber(source.sender_key);
    builder.writeNumber(source.amount);
    builder.writeAddress(source.sender_wallet);
    return builder.build();
}

export function dictValueParserAthTransferNotification(): DictionaryValue<AthTransferNotification> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAthTransferNotification(src)).endCell());
        },
        parse: (src) => {
            return loadAthTransferNotification(src.loadRef().beginParse());
        }
    }
}

export type AirdropGlobalView = {
    $$type: 'AirdropGlobalView';
    sealed: boolean;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    genesis_controller_address: Address;
    ath_master_address: Address;
    pool_ath_wallet_address: Address;
    credit_issuer_address: Address;
    treasury_address: Address;
    ath_per_credit: bigint;
    total_pool: bigint;
    funded_amount: bigint;
    remaining_budget: bigint;
    distributed_total: bigint;
    claim_count: bigint;
    sealed_at: bigint;
    ath_master_bound: boolean;
    credit_issuer_bound: boolean;
    treasury_bound: boolean;
}

export function storeAirdropGlobalView(src: AirdropGlobalView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeAddress(src.genesis_controller_address);
        const b_1 = new Builder();
        b_1.storeAddress(src.ath_master_address);
        b_1.storeAddress(src.pool_ath_wallet_address);
        b_1.storeAddress(src.credit_issuer_address);
        const b_2 = new Builder();
        b_2.storeAddress(src.treasury_address);
        b_2.storeInt(src.ath_per_credit, 257);
        b_2.storeInt(src.total_pool, 257);
        const b_3 = new Builder();
        b_3.storeInt(src.funded_amount, 257);
        b_3.storeInt(src.remaining_budget, 257);
        b_3.storeInt(src.distributed_total, 257);
        const b_4 = new Builder();
        b_4.storeInt(src.claim_count, 257);
        b_4.storeInt(src.sealed_at, 257);
        b_4.storeBit(src.ath_master_bound);
        b_4.storeBit(src.credit_issuer_bound);
        b_4.storeBit(src.treasury_bound);
        b_3.storeRef(b_4.endCell());
        b_2.storeRef(b_3.endCell());
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadAirdropGlobalView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _genesis_config_hash = sc_0.loadIntBig(257);
    const _genesis_controller_address = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _ath_master_address = sc_1.loadAddress();
    const _pool_ath_wallet_address = sc_1.loadAddress();
    const _credit_issuer_address = sc_1.loadAddress();
    const sc_2 = sc_1.loadRef().beginParse();
    const _treasury_address = sc_2.loadAddress();
    const _ath_per_credit = sc_2.loadIntBig(257);
    const _total_pool = sc_2.loadIntBig(257);
    const sc_3 = sc_2.loadRef().beginParse();
    const _funded_amount = sc_3.loadIntBig(257);
    const _remaining_budget = sc_3.loadIntBig(257);
    const _distributed_total = sc_3.loadIntBig(257);
    const sc_4 = sc_3.loadRef().beginParse();
    const _claim_count = sc_4.loadIntBig(257);
    const _sealed_at = sc_4.loadIntBig(257);
    const _ath_master_bound = sc_4.loadBit();
    const _credit_issuer_bound = sc_4.loadBit();
    const _treasury_bound = sc_4.loadBit();
    return { $$type: 'AirdropGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address, credit_issuer_address: _credit_issuer_address, treasury_address: _treasury_address, ath_per_credit: _ath_per_credit, total_pool: _total_pool, funded_amount: _funded_amount, remaining_budget: _remaining_budget, distributed_total: _distributed_total, claim_count: _claim_count, sealed_at: _sealed_at, ath_master_bound: _ath_master_bound, credit_issuer_bound: _credit_issuer_bound, treasury_bound: _treasury_bound };
}

export function loadTupleAirdropGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pool_ath_wallet_address = source.readAddress();
    const _credit_issuer_address = source.readAddress();
    const _treasury_address = source.readAddress();
    const _ath_per_credit = source.readBigNumber();
    const _total_pool = source.readBigNumber();
    const _funded_amount = source.readBigNumber();
    const _remaining_budget = source.readBigNumber();
    const _distributed_total = source.readBigNumber();
    const _claim_count = source.readBigNumber();
    source = source.readTuple();
    const _sealed_at = source.readBigNumber();
    const _ath_master_bound = source.readBoolean();
    const _credit_issuer_bound = source.readBoolean();
    const _treasury_bound = source.readBoolean();
    return { $$type: 'AirdropGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address, credit_issuer_address: _credit_issuer_address, treasury_address: _treasury_address, ath_per_credit: _ath_per_credit, total_pool: _total_pool, funded_amount: _funded_amount, remaining_budget: _remaining_budget, distributed_total: _distributed_total, claim_count: _claim_count, sealed_at: _sealed_at, ath_master_bound: _ath_master_bound, credit_issuer_bound: _credit_issuer_bound, treasury_bound: _treasury_bound };
}

export function loadGetterTupleAirdropGlobalView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _genesis_controller_address = source.readAddress();
    const _ath_master_address = source.readAddress();
    const _pool_ath_wallet_address = source.readAddress();
    const _credit_issuer_address = source.readAddress();
    const _treasury_address = source.readAddress();
    const _ath_per_credit = source.readBigNumber();
    const _total_pool = source.readBigNumber();
    const _funded_amount = source.readBigNumber();
    const _remaining_budget = source.readBigNumber();
    const _distributed_total = source.readBigNumber();
    const _claim_count = source.readBigNumber();
    const _sealed_at = source.readBigNumber();
    const _ath_master_bound = source.readBoolean();
    const _credit_issuer_bound = source.readBoolean();
    const _treasury_bound = source.readBoolean();
    return { $$type: 'AirdropGlobalView' as const, sealed: _sealed, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, genesis_controller_address: _genesis_controller_address, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address, credit_issuer_address: _credit_issuer_address, treasury_address: _treasury_address, ath_per_credit: _ath_per_credit, total_pool: _total_pool, funded_amount: _funded_amount, remaining_budget: _remaining_budget, distributed_total: _distributed_total, claim_count: _claim_count, sealed_at: _sealed_at, ath_master_bound: _ath_master_bound, credit_issuer_bound: _credit_issuer_bound, treasury_bound: _treasury_bound };
}

export function storeTupleAirdropGlobalView(source: AirdropGlobalView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.pool_ath_wallet_address);
    builder.writeAddress(source.credit_issuer_address);
    builder.writeAddress(source.treasury_address);
    builder.writeNumber(source.ath_per_credit);
    builder.writeNumber(source.total_pool);
    builder.writeNumber(source.funded_amount);
    builder.writeNumber(source.remaining_budget);
    builder.writeNumber(source.distributed_total);
    builder.writeNumber(source.claim_count);
    builder.writeNumber(source.sealed_at);
    builder.writeBoolean(source.ath_master_bound);
    builder.writeBoolean(source.credit_issuer_bound);
    builder.writeBoolean(source.treasury_bound);
    return builder.build();
}

export function dictValueParserAirdropGlobalView(): DictionaryValue<AirdropGlobalView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropGlobalView(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropGlobalView(src.loadRef().beginParse());
        }
    }
}

export type AirdropPool$Data = {
    $$type: 'AirdropPool$Data';
    sealed: boolean;
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    ath_master_address: Address;
    pool_ath_wallet_address: Address;
    ath_master_bound: boolean;
    credit_issuer_address: Address;
    credit_issuer_bound: boolean;
    treasury_address: Address;
    treasury_bound: boolean;
    funded_amount: bigint;
    remaining_budget: bigint;
    distributed_total: bigint;
    claim_count: bigint;
    sealed_at: bigint;
    payout_seq: bigint;
    last_accrual_at: bigint;
}

export function storeAirdropPool$Data(src: AirdropPool$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeUint(src.genesis_config_hash, 256);
        const b_1 = new Builder();
        b_1.storeAddress(src.ath_master_address);
        b_1.storeAddress(src.pool_ath_wallet_address);
        b_1.storeBit(src.ath_master_bound);
        b_1.storeAddress(src.credit_issuer_address);
        b_1.storeBit(src.credit_issuer_bound);
        const b_2 = new Builder();
        b_2.storeAddress(src.treasury_address);
        b_2.storeBit(src.treasury_bound);
        b_2.storeUint(src.funded_amount, 128);
        b_2.storeUint(src.remaining_budget, 128);
        b_2.storeUint(src.distributed_total, 128);
        b_2.storeUint(src.claim_count, 64);
        b_2.storeUint(src.sealed_at, 64);
        b_2.storeUint(src.payout_seq, 64);
        b_2.storeUint(src.last_accrual_at, 64);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadAirdropPool$Data(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _genesis_controller_address = sc_0.loadAddress();
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _genesis_config_hash = sc_0.loadUintBig(256);
    const sc_1 = sc_0.loadRef().beginParse();
    const _ath_master_address = sc_1.loadAddress();
    const _pool_ath_wallet_address = sc_1.loadAddress();
    const _ath_master_bound = sc_1.loadBit();
    const _credit_issuer_address = sc_1.loadAddress();
    const _credit_issuer_bound = sc_1.loadBit();
    const sc_2 = sc_1.loadRef().beginParse();
    const _treasury_address = sc_2.loadAddress();
    const _treasury_bound = sc_2.loadBit();
    const _funded_amount = sc_2.loadUintBig(128);
    const _remaining_budget = sc_2.loadUintBig(128);
    const _distributed_total = sc_2.loadUintBig(128);
    const _claim_count = sc_2.loadUintBig(64);
    const _sealed_at = sc_2.loadUintBig(64);
    const _payout_seq = sc_2.loadUintBig(64);
    const _last_accrual_at = sc_2.loadUintBig(64);
    return { $$type: 'AirdropPool$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address, ath_master_bound: _ath_master_bound, credit_issuer_address: _credit_issuer_address, credit_issuer_bound: _credit_issuer_bound, treasury_address: _treasury_address, treasury_bound: _treasury_bound, funded_amount: _funded_amount, remaining_budget: _remaining_budget, distributed_total: _distributed_total, claim_count: _claim_count, sealed_at: _sealed_at, payout_seq: _payout_seq, last_accrual_at: _last_accrual_at };
}

export function loadTupleAirdropPool$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _pool_ath_wallet_address = source.readAddress();
    const _ath_master_bound = source.readBoolean();
    const _credit_issuer_address = source.readAddress();
    const _credit_issuer_bound = source.readBoolean();
    const _treasury_address = source.readAddress();
    const _treasury_bound = source.readBoolean();
    const _funded_amount = source.readBigNumber();
    const _remaining_budget = source.readBigNumber();
    const _distributed_total = source.readBigNumber();
    source = source.readTuple();
    const _claim_count = source.readBigNumber();
    const _sealed_at = source.readBigNumber();
    const _payout_seq = source.readBigNumber();
    const _last_accrual_at = source.readBigNumber();
    return { $$type: 'AirdropPool$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address, ath_master_bound: _ath_master_bound, credit_issuer_address: _credit_issuer_address, credit_issuer_bound: _credit_issuer_bound, treasury_address: _treasury_address, treasury_bound: _treasury_bound, funded_amount: _funded_amount, remaining_budget: _remaining_budget, distributed_total: _distributed_total, claim_count: _claim_count, sealed_at: _sealed_at, payout_seq: _payout_seq, last_accrual_at: _last_accrual_at };
}

export function loadGetterTupleAirdropPool$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _genesis_config_hash = source.readBigNumber();
    const _ath_master_address = source.readAddress();
    const _pool_ath_wallet_address = source.readAddress();
    const _ath_master_bound = source.readBoolean();
    const _credit_issuer_address = source.readAddress();
    const _credit_issuer_bound = source.readBoolean();
    const _treasury_address = source.readAddress();
    const _treasury_bound = source.readBoolean();
    const _funded_amount = source.readBigNumber();
    const _remaining_budget = source.readBigNumber();
    const _distributed_total = source.readBigNumber();
    const _claim_count = source.readBigNumber();
    const _sealed_at = source.readBigNumber();
    const _payout_seq = source.readBigNumber();
    const _last_accrual_at = source.readBigNumber();
    return { $$type: 'AirdropPool$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, genesis_config_hash: _genesis_config_hash, ath_master_address: _ath_master_address, pool_ath_wallet_address: _pool_ath_wallet_address, ath_master_bound: _ath_master_bound, credit_issuer_address: _credit_issuer_address, credit_issuer_bound: _credit_issuer_bound, treasury_address: _treasury_address, treasury_bound: _treasury_bound, funded_amount: _funded_amount, remaining_budget: _remaining_budget, distributed_total: _distributed_total, claim_count: _claim_count, sealed_at: _sealed_at, payout_seq: _payout_seq, last_accrual_at: _last_accrual_at };
}

export function storeTupleAirdropPool$Data(source: AirdropPool$Data) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeNumber(source.genesis_config_hash);
    builder.writeAddress(source.ath_master_address);
    builder.writeAddress(source.pool_ath_wallet_address);
    builder.writeBoolean(source.ath_master_bound);
    builder.writeAddress(source.credit_issuer_address);
    builder.writeBoolean(source.credit_issuer_bound);
    builder.writeAddress(source.treasury_address);
    builder.writeBoolean(source.treasury_bound);
    builder.writeNumber(source.funded_amount);
    builder.writeNumber(source.remaining_budget);
    builder.writeNumber(source.distributed_total);
    builder.writeNumber(source.claim_count);
    builder.writeNumber(source.sealed_at);
    builder.writeNumber(source.payout_seq);
    builder.writeNumber(source.last_accrual_at);
    return builder.build();
}

export function dictValueParserAirdropPool$Data(): DictionaryValue<AirdropPool$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropPool$Data(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropPool$Data(src.loadRef().beginParse());
        }
    }
}

 type AirdropPool_init_args = {
    $$type: 'AirdropPool_init_args';
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    genesis_config_hash: bigint;
    sealed: boolean;
}

function initAirdropPool_init_args(src: AirdropPool_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeInt(src.genesis_config_hash, 257);
        b_0.storeBit(src.sealed);
    };
}

async function AirdropPool_init(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
    const __code = Cell.fromHex('b5ee9c7241022001000a2f000114ff00f4a413f4bcf2c80b01020162021d03f6d0eda2edfb01d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e38fa40810101d700810101d700d200553004d1550254733370277070705470005470000e11110e0d11100d10df10de10cd10bc10ab109a1089e30d1113e302705612d74920c21f97315612d70b1f01de21821041445201ba1e030400f211118020d7217021d749c21f9430d31f309131e2821041544810ba8e570f11110f0e11100e10df551cc87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed54e05f0f5f0304908fbd5b11118020d721fa40fa4030011112011113db3cdb3c3c3c81659a0ab31af2f40e11100e10df10ce10bd10bc7f0b108a10791068105710461035440302e021821041445202ba0b0c1b0504cc8fdb5b11118020d721fa40301110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411124130db3cdb3c3a81659c09b319f2f40f11100f10ef10de10cd10bc10ab109a7f09107810671056104510344130e021821041445203ba0b0c1b0604cc8fdb5b11118020d721fa40301110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411124130db3cdb3c388165a107b317f2f40f11100f10ef10de10cd10bc10ab109a108910787f071056104510344130e021821041445239ba0b0c1b0704fee302218210472d9d7dba8f715b11118020d721d33f31d39f31d37f301110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411124130db3c81659b2cf2f48165a3f8422ec705f2f4065612a0111215a01110111111100f11100f10ef10de10cd10bc10ab109a1089107810670510344130e021080b1b0904bc5b11118020d721d3fffa4030011112011113db3cdb3c81659d11135610ba01111301f2f481659e29f2f481659f11125613db3c3b011112010af2f48165a0f828561301c705b3f2f40f11110f0e11100e10df10ce10bd10ac109b109a5517190c0f1b03f6821041445204bae30221821041445210bae302571320821041445211ba8e5a3057110f11110f0e11100e10df551cc87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed54e0200a0e1403f85b11118020d721d3ff301110111111100f11100f10ef10de10cd10bc10ab109a10891078106710561045103411124130db3cdb3c323e3f8165b85610c201f2f48165b929f2f48165ba27f2f48165bb25f2f48165bc248228354a6ba7a18000bef2f4228228354a6ba7a18000bc9a8228354a6ba7a1800033de7ff8230b0c0d00108165b25612b3f2f400168165b1f8425612c705f2f400d8011111010f11100f1f10de10cd10bc10ab109a1089107810671056104510344033c87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed5404fa5b11118020d721d33f31fa40d31f30011112011113db3c8165fef8422cc705f2f41110111111100f11110f0e11110e0d11110d0c11110c0b11110b0a11110a09111109111108070655408165ff11125613db3c01111301f2f48166005614c2009656148103e8bb9170e2f2f411138212540be400a85340b9925711e30d190f1011000cd30a308309ba00e830238212540be400a9048212540be400a8208e5d3057110e11110e0d11100d10cf552b12c87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed54db31e1571102f8816602f8416f24135f03820b938700bef2f4035610a1025610a001a41112a4f823820afaf0807170f828250302111602111701c855308210415448105005cb1f13cb3fcb7fcecec92d43140211150211140110246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c901fb001213001a58cf8680cf8480f400f400cf8100d40e11110e0d11100d10cf10be10ad109c108b107a1069105810471036505413c87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed5403f8821041445212bae30220821041445213bae302c0001112c12101111201b08e570f11110f0e11100e10df551cc87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed54e00f11110f15181c03fc3057110f11110f0e11100e10df551cdb3c81661cf82324821012cc0300a0bef2f481661ff823228209e13380a0bef2f481661d26c200f2f47002a481661ef8416f24135f03820b938700bef2f4820afaf0807170f8285444b052ecc855308210415448105005cb1f13cb3fcb7fcecec956100450aa10246d50436d03c88919161700016000f4cf16ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0015c87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed5403943057110f11110f0e11100e10df551cdb3c81662628f2f4821005f5e100f8276f108166275312bcf2f401a17071882c55304343c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00191a1b000e8165f45612f2f400420000000061697264726f702d756e6163636f756e7465642d746f6e2d73776565700096c87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed5400a60e11100e10df551cc87f01ca0011121111111055e0011111011112ca001fce1dcbff1bcbff09c8ce18ce16ca0014ce12ca0001c8ce12ca0012cb7f12cb7f13cb7f13cb3f13cb3f13cb3f13cb3f12cdcdc9ed5402d5a1df67da89a1a400031c71f481020203ae01020203ae01a400aa6009a2aa04a8e666e04ee0e0e0a8e000a8e0001c22221c1a22201a21be21bc219a2178215621342113c61bb678ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae24ae251e1f008ed200fa40d3ffd3ffd401d0fa40fa40d200fa40d200d430d0fa40d200d37fd37fd37fd33fd33fd33fd33f300e11120e0e11110e0e11100e10ef57121110111111100f11100f550e006e8212540be4008228354a6ba7a1800056130256120256120256150256130256130256120256110256105610561056105610561a56195618bfc7eb1c');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initAirdropPool_init_args({ $$type: 'AirdropPool_init_args', genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const AirdropPool_errors = {
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

export const AirdropPool_errors_backward = {
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

const AirdropPool_types: ABIType[] = [
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
    {"name":"AirdropBindAthMaster","header":1094996481,"fields":[{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pool_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropBindCreditIssuer","header":1094996482,"fields":[{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropRebindCreditIssuer","header":1094996537,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropBindTreasury","header":1094996483,"fields":[{"name":"treasury_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropSealGenesis","header":1094996484,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"AirdropAccrue","header":1094996496,"fields":[{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"AirdropTopUpStorageReserve","header":1094996497,"fields":[]},
    {"name":"AirdropSweepResidualToTreasury","header":1094996498,"fields":[]},
    {"name":"AirdropSweepUnaccountedTon","header":1094996499,"fields":[]},
    {"name":"ATHTransferRequest","header":1096042512,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"recipient","type":{"kind":"simple","type":"address","optional":false}},{"name":"response_destination","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AthTransferNotification","header":1194171773,"fields":[{"name":"query_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sender_key","type":{"kind":"simple","type":"uint","optional":false,"format":160}},{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"sender_wallet","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropGlobalView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pool_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_per_credit","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"total_pool","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"funded_amount","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"remaining_budget","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"distributed_total","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claim_count","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sealed_at","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"ath_master_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"credit_issuer_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_bound","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"AirdropPool$Data","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"genesis_config_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ath_master_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"pool_ath_wallet_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"ath_master_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"credit_issuer_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"credit_issuer_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"treasury_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"funded_amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"remaining_budget","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"distributed_total","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"claim_count","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"sealed_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"payout_seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"last_accrual_at","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const AirdropPool_opcodes = {
    "AirdropBindAthMaster": 1094996481,
    "AirdropBindCreditIssuer": 1094996482,
    "AirdropRebindCreditIssuer": 1094996537,
    "AirdropBindTreasury": 1094996483,
    "AirdropSealGenesis": 1094996484,
    "AirdropAccrue": 1094996496,
    "AirdropTopUpStorageReserve": 1094996497,
    "AirdropSweepResidualToTreasury": 1094996498,
    "AirdropSweepUnaccountedTon": 1094996499,
    "ATHTransferRequest": 1096042512,
    "AthTransferNotification": 1194171773,
}

const AirdropPool_getters: ABIGetter[] = [
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"AirdropGlobalView","optional":false}},
]

export const AirdropPool_getterMapping: { [key: string]: string } = {
    'get_global': 'getGetGlobal',
}

const AirdropPool_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropBindAthMaster"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropBindCreditIssuer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropBindTreasury"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropRebindCreditIssuer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AthTransferNotification"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropSealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropAccrue"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropSweepResidualToTreasury"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AirdropSweepUnaccountedTon"}},
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"any"}},
]

export const AIRDROP_TOTAL_POOL = 15000000000000000n;
export const AIRDROP_ATH_PER_CREDIT = 10000000000n;
export const AIRDROP_MAX_CREDITS_PER_ACCRUAL = 1000n;
export const AIRDROP_BASE_STORAGE_ENDOWMENT = 100000000n;
export const AIRDROP_ATHWALLET_LEG_GAS = 50000000n;
export const AIRDROP_PAYOUT_PATH_GAS = 60000000n;
export const AIRDROP_SWEEP_GRACE = 315360000n;
export const AIRDROP_SWEEP_INACTIVITY = 31536000n;

export class AirdropPool implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = AirdropPool_errors_backward;
    public static readonly opcodes = AirdropPool_opcodes;
    
    static async init(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
        return await AirdropPool_init(genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed);
    }
    
    static async fromInit(genesis_controller_address: Address, deployment_manifest_hash: bigint, genesis_config_hash: bigint, sealed: boolean) {
        const __gen_init = await AirdropPool_init(genesis_controller_address, deployment_manifest_hash, genesis_config_hash, sealed);
        const address = contractAddress(0, __gen_init);
        return new AirdropPool(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new AirdropPool(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  AirdropPool_types,
        getters: AirdropPool_getters,
        receivers: AirdropPool_receivers,
        errors: AirdropPool_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: AirdropBindAthMaster | AirdropBindCreditIssuer | AirdropBindTreasury | AirdropRebindCreditIssuer | AthTransferNotification | AirdropSealGenesis | AirdropAccrue | AirdropTopUpStorageReserve | AirdropSweepResidualToTreasury | AirdropSweepUnaccountedTon | null | Slice) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropBindAthMaster') {
            body = beginCell().store(storeAirdropBindAthMaster(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropBindCreditIssuer') {
            body = beginCell().store(storeAirdropBindCreditIssuer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropBindTreasury') {
            body = beginCell().store(storeAirdropBindTreasury(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropRebindCreditIssuer') {
            body = beginCell().store(storeAirdropRebindCreditIssuer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AthTransferNotification') {
            body = beginCell().store(storeAthTransferNotification(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropSealGenesis') {
            body = beginCell().store(storeAirdropSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropAccrue') {
            body = beginCell().store(storeAirdropAccrue(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropTopUpStorageReserve') {
            body = beginCell().store(storeAirdropTopUpStorageReserve(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropSweepResidualToTreasury') {
            body = beginCell().store(storeAirdropSweepResidualToTreasury(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AirdropSweepUnaccountedTon') {
            body = beginCell().store(storeAirdropSweepUnaccountedTon(message)).endCell();
        }
        if (message === null) {
            body = new Cell();
        }
        if (message && typeof message === 'object' && message instanceof Slice) {
            body = message.asCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetGlobal(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_global', builder.build())).stack;
        const result = loadGetterTupleAirdropGlobalView(source);
        return result;
    }
    
}