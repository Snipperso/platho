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

export type CsBindAirdropPool = {
    $$type: 'CsBindAirdropPool';
    airdrop_pool_address: Address;
}

export function storeCsBindAirdropPool(src: CsBindAirdropPool) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525297, 32);
        b_0.storeAddress(src.airdrop_pool_address);
    };
}

export function loadCsBindAirdropPool(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525297) { throw Error('Invalid prefix'); }
    const _airdrop_pool_address = sc_0.loadAddress();
    return { $$type: 'CsBindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function loadTupleCsBindAirdropPool(source: TupleReader) {
    const _airdrop_pool_address = source.readAddress();
    return { $$type: 'CsBindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function loadGetterTupleCsBindAirdropPool(source: TupleReader) {
    const _airdrop_pool_address = source.readAddress();
    return { $$type: 'CsBindAirdropPool' as const, airdrop_pool_address: _airdrop_pool_address };
}

export function storeTupleCsBindAirdropPool(source: CsBindAirdropPool) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.airdrop_pool_address);
    return builder.build();
}

export function dictValueParserCsBindAirdropPool(): DictionaryValue<CsBindAirdropPool> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsBindAirdropPool(src)).endCell());
        },
        parse: (src) => {
            return loadCsBindAirdropPool(src.loadRef().beginParse());
        }
    }
}

export type CsBindFeeReceiver = {
    $$type: 'CsBindFeeReceiver';
    fee_receiver_address: Address;
}

export function storeCsBindFeeReceiver(src: CsBindFeeReceiver) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525298, 32);
        b_0.storeAddress(src.fee_receiver_address);
    };
}

export function loadCsBindFeeReceiver(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525298) { throw Error('Invalid prefix'); }
    const _fee_receiver_address = sc_0.loadAddress();
    return { $$type: 'CsBindFeeReceiver' as const, fee_receiver_address: _fee_receiver_address };
}

export function loadTupleCsBindFeeReceiver(source: TupleReader) {
    const _fee_receiver_address = source.readAddress();
    return { $$type: 'CsBindFeeReceiver' as const, fee_receiver_address: _fee_receiver_address };
}

export function loadGetterTupleCsBindFeeReceiver(source: TupleReader) {
    const _fee_receiver_address = source.readAddress();
    return { $$type: 'CsBindFeeReceiver' as const, fee_receiver_address: _fee_receiver_address };
}

export function storeTupleCsBindFeeReceiver(source: CsBindFeeReceiver) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.fee_receiver_address);
    return builder.build();
}

export function dictValueParserCsBindFeeReceiver(): DictionaryValue<CsBindFeeReceiver> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsBindFeeReceiver(src)).endCell());
        },
        parse: (src) => {
            return loadCsBindFeeReceiver(src.loadRef().beginParse());
        }
    }
}

export type CsSetCreditFee = {
    $$type: 'CsSetCreditFee';
    credit_fee: bigint;
}

export function storeCsSetCreditFee(src: CsSetCreditFee) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525299, 32);
        b_0.storeUint(src.credit_fee, 128);
    };
}

export function loadCsSetCreditFee(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525299) { throw Error('Invalid prefix'); }
    const _credit_fee = sc_0.loadUintBig(128);
    return { $$type: 'CsSetCreditFee' as const, credit_fee: _credit_fee };
}

export function loadTupleCsSetCreditFee(source: TupleReader) {
    const _credit_fee = source.readBigNumber();
    return { $$type: 'CsSetCreditFee' as const, credit_fee: _credit_fee };
}

export function loadGetterTupleCsSetCreditFee(source: TupleReader) {
    const _credit_fee = source.readBigNumber();
    return { $$type: 'CsSetCreditFee' as const, credit_fee: _credit_fee };
}

export function storeTupleCsSetCreditFee(source: CsSetCreditFee) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credit_fee);
    return builder.build();
}

export function dictValueParserCsSetCreditFee(): DictionaryValue<CsSetCreditFee> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsSetCreditFee(src)).endCell());
        },
        parse: (src) => {
            return loadCsSetCreditFee(src.loadRef().beginParse());
        }
    }
}

export type CsSealGenesis = {
    $$type: 'CsSealGenesis';
    deployment_manifest_hash: bigint;
}

export function storeCsSealGenesis(src: CsSealGenesis) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525300, 32);
        b_0.storeUint(src.deployment_manifest_hash, 256);
    };
}

export function loadCsSealGenesis(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525300) { throw Error('Invalid prefix'); }
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    return { $$type: 'CsSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadTupleCsSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'CsSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function loadGetterTupleCsSealGenesis(source: TupleReader) {
    const _deployment_manifest_hash = source.readBigNumber();
    return { $$type: 'CsSealGenesis' as const, deployment_manifest_hash: _deployment_manifest_hash };
}

export function storeTupleCsSealGenesis(source: CsSealGenesis) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.deployment_manifest_hash);
    return builder.build();
}

export function dictValueParserCsSealGenesis(): DictionaryValue<CsSealGenesis> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsSealGenesis(src)).endCell());
        },
        parse: (src) => {
            return loadCsSealGenesis(src.loadRef().beginParse());
        }
    }
}

export type CsBuyCredits = {
    $$type: 'CsBuyCredits';
    credits_k: bigint;
    redeem_pubkey: bigint;
}

export function storeCsBuyCredits(src: CsBuyCredits) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525301, 32);
        b_0.storeUint(src.credits_k, 16);
        b_0.storeUint(src.redeem_pubkey, 256);
    };
}

export function loadCsBuyCredits(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525301) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(16);
    const _redeem_pubkey = sc_0.loadUintBig(256);
    return { $$type: 'CsBuyCredits' as const, credits_k: _credits_k, redeem_pubkey: _redeem_pubkey };
}

export function loadTupleCsBuyCredits(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _redeem_pubkey = source.readBigNumber();
    return { $$type: 'CsBuyCredits' as const, credits_k: _credits_k, redeem_pubkey: _redeem_pubkey };
}

export function loadGetterTupleCsBuyCredits(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _redeem_pubkey = source.readBigNumber();
    return { $$type: 'CsBuyCredits' as const, credits_k: _credits_k, redeem_pubkey: _redeem_pubkey };
}

export function storeTupleCsBuyCredits(source: CsBuyCredits) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeNumber(source.redeem_pubkey);
    return builder.build();
}

export function dictValueParserCsBuyCredits(): DictionaryValue<CsBuyCredits> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsBuyCredits(src)).endCell());
        },
        parse: (src) => {
            return loadCsBuyCredits(src.loadRef().beginParse());
        }
    }
}

export type CsFlushFees = {
    $$type: 'CsFlushFees';
}

export function storeCsFlushFees(src: CsFlushFees) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525302, 32);
    };
}

export function loadCsFlushFees(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525302) { throw Error('Invalid prefix'); }
    return { $$type: 'CsFlushFees' as const };
}

export function loadTupleCsFlushFees(source: TupleReader) {
    return { $$type: 'CsFlushFees' as const };
}

export function loadGetterTupleCsFlushFees(source: TupleReader) {
    return { $$type: 'CsFlushFees' as const };
}

export function storeTupleCsFlushFees(source: CsFlushFees) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserCsFlushFees(): DictionaryValue<CsFlushFees> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsFlushFees(src)).endCell());
        },
        parse: (src) => {
            return loadCsFlushFees(src.loadRef().beginParse());
        }
    }
}

export type CsTopUpStorageReserve = {
    $$type: 'CsTopUpStorageReserve';
}

export function storeCsTopUpStorageReserve(src: CsTopUpStorageReserve) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1129525303, 32);
    };
}

export function loadCsTopUpStorageReserve(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1129525303) { throw Error('Invalid prefix'); }
    return { $$type: 'CsTopUpStorageReserve' as const };
}

export function loadTupleCsTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'CsTopUpStorageReserve' as const };
}

export function loadGetterTupleCsTopUpStorageReserve(source: TupleReader) {
    return { $$type: 'CsTopUpStorageReserve' as const };
}

export function storeTupleCsTopUpStorageReserve(source: CsTopUpStorageReserve) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserCsTopUpStorageReserve(): DictionaryValue<CsTopUpStorageReserve> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCsTopUpStorageReserve(src)).endCell());
        },
        parse: (src) => {
            return loadCsTopUpStorageReserve(src.loadRef().beginParse());
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

export type CreditSaleView = {
    $$type: 'CreditSaleView';
    sealed: boolean;
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    airdrop_pool_address: Address;
    airdrop_pool_bound: boolean;
    fee_receiver_address: Address;
    fee_receiver_bound: boolean;
    credit_fee: bigint;
    fees_collected: bigint;
    credits_sold: bigint;
    purchase_seq: bigint;
}

export function storeCreditSaleView(src: CreditSaleView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeAddress(src.airdrop_pool_address);
        b_0.storeBit(src.airdrop_pool_bound);
        const b_1 = new Builder();
        b_1.storeAddress(src.fee_receiver_address);
        b_1.storeBit(src.fee_receiver_bound);
        b_1.storeInt(src.credit_fee, 257);
        b_1.storeInt(src.fees_collected, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.credits_sold, 257);
        b_2.storeInt(src.purchase_seq, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCreditSaleView(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _genesis_controller_address = sc_0.loadAddress();
    const _deployment_manifest_hash = sc_0.loadIntBig(257);
    const _airdrop_pool_address = sc_0.loadAddress();
    const _airdrop_pool_bound = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _fee_receiver_address = sc_1.loadAddress();
    const _fee_receiver_bound = sc_1.loadBit();
    const _credit_fee = sc_1.loadIntBig(257);
    const _fees_collected = sc_1.loadIntBig(257);
    const sc_2 = sc_1.loadRef().beginParse();
    const _credits_sold = sc_2.loadIntBig(257);
    const _purchase_seq = sc_2.loadIntBig(257);
    return { $$type: 'CreditSaleView' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound, fee_receiver_address: _fee_receiver_address, fee_receiver_bound: _fee_receiver_bound, credit_fee: _credit_fee, fees_collected: _fees_collected, credits_sold: _credits_sold, purchase_seq: _purchase_seq };
}

export function loadTupleCreditSaleView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    const _fee_receiver_address = source.readAddress();
    const _fee_receiver_bound = source.readBoolean();
    const _credit_fee = source.readBigNumber();
    const _fees_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _purchase_seq = source.readBigNumber();
    return { $$type: 'CreditSaleView' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound, fee_receiver_address: _fee_receiver_address, fee_receiver_bound: _fee_receiver_bound, credit_fee: _credit_fee, fees_collected: _fees_collected, credits_sold: _credits_sold, purchase_seq: _purchase_seq };
}

export function loadGetterTupleCreditSaleView(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    const _fee_receiver_address = source.readAddress();
    const _fee_receiver_bound = source.readBoolean();
    const _credit_fee = source.readBigNumber();
    const _fees_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _purchase_seq = source.readBigNumber();
    return { $$type: 'CreditSaleView' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound, fee_receiver_address: _fee_receiver_address, fee_receiver_bound: _fee_receiver_bound, credit_fee: _credit_fee, fees_collected: _fees_collected, credits_sold: _credits_sold, purchase_seq: _purchase_seq };
}

export function storeTupleCreditSaleView(source: CreditSaleView) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.airdrop_pool_address);
    builder.writeBoolean(source.airdrop_pool_bound);
    builder.writeAddress(source.fee_receiver_address);
    builder.writeBoolean(source.fee_receiver_bound);
    builder.writeNumber(source.credit_fee);
    builder.writeNumber(source.fees_collected);
    builder.writeNumber(source.credits_sold);
    builder.writeNumber(source.purchase_seq);
    return builder.build();
}

export function dictValueParserCreditSaleView(): DictionaryValue<CreditSaleView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditSaleView(src)).endCell());
        },
        parse: (src) => {
            return loadCreditSaleView(src.loadRef().beginParse());
        }
    }
}

export type CreditSale$Data = {
    $$type: 'CreditSale$Data';
    sealed: boolean;
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    airdrop_pool_address: Address;
    airdrop_pool_bound: boolean;
    fee_receiver_address: Address;
    fee_receiver_bound: boolean;
    credit_fee: bigint;
    fees_collected: bigint;
    credits_sold: bigint;
    purchase_seq: bigint;
}

export function storeCreditSale$Data(src: CreditSale$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.sealed);
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeUint(src.deployment_manifest_hash, 256);
        b_0.storeAddress(src.airdrop_pool_address);
        b_0.storeBit(src.airdrop_pool_bound);
        const b_1 = new Builder();
        b_1.storeAddress(src.fee_receiver_address);
        b_1.storeBit(src.fee_receiver_bound);
        b_1.storeUint(src.credit_fee, 128);
        b_1.storeUint(src.fees_collected, 128);
        b_1.storeUint(src.credits_sold, 64);
        b_1.storeUint(src.purchase_seq, 64);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadCreditSale$Data(slice: Slice) {
    const sc_0 = slice;
    const _sealed = sc_0.loadBit();
    const _genesis_controller_address = sc_0.loadAddress();
    const _deployment_manifest_hash = sc_0.loadUintBig(256);
    const _airdrop_pool_address = sc_0.loadAddress();
    const _airdrop_pool_bound = sc_0.loadBit();
    const sc_1 = sc_0.loadRef().beginParse();
    const _fee_receiver_address = sc_1.loadAddress();
    const _fee_receiver_bound = sc_1.loadBit();
    const _credit_fee = sc_1.loadUintBig(128);
    const _fees_collected = sc_1.loadUintBig(128);
    const _credits_sold = sc_1.loadUintBig(64);
    const _purchase_seq = sc_1.loadUintBig(64);
    return { $$type: 'CreditSale$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound, fee_receiver_address: _fee_receiver_address, fee_receiver_bound: _fee_receiver_bound, credit_fee: _credit_fee, fees_collected: _fees_collected, credits_sold: _credits_sold, purchase_seq: _purchase_seq };
}

export function loadTupleCreditSale$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    const _fee_receiver_address = source.readAddress();
    const _fee_receiver_bound = source.readBoolean();
    const _credit_fee = source.readBigNumber();
    const _fees_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _purchase_seq = source.readBigNumber();
    return { $$type: 'CreditSale$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound, fee_receiver_address: _fee_receiver_address, fee_receiver_bound: _fee_receiver_bound, credit_fee: _credit_fee, fees_collected: _fees_collected, credits_sold: _credits_sold, purchase_seq: _purchase_seq };
}

export function loadGetterTupleCreditSale$Data(source: TupleReader) {
    const _sealed = source.readBoolean();
    const _genesis_controller_address = source.readAddress();
    const _deployment_manifest_hash = source.readBigNumber();
    const _airdrop_pool_address = source.readAddress();
    const _airdrop_pool_bound = source.readBoolean();
    const _fee_receiver_address = source.readAddress();
    const _fee_receiver_bound = source.readBoolean();
    const _credit_fee = source.readBigNumber();
    const _fees_collected = source.readBigNumber();
    const _credits_sold = source.readBigNumber();
    const _purchase_seq = source.readBigNumber();
    return { $$type: 'CreditSale$Data' as const, sealed: _sealed, genesis_controller_address: _genesis_controller_address, deployment_manifest_hash: _deployment_manifest_hash, airdrop_pool_address: _airdrop_pool_address, airdrop_pool_bound: _airdrop_pool_bound, fee_receiver_address: _fee_receiver_address, fee_receiver_bound: _fee_receiver_bound, credit_fee: _credit_fee, fees_collected: _fees_collected, credits_sold: _credits_sold, purchase_seq: _purchase_seq };
}

export function storeTupleCreditSale$Data(source: CreditSale$Data) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.sealed);
    builder.writeAddress(source.genesis_controller_address);
    builder.writeNumber(source.deployment_manifest_hash);
    builder.writeAddress(source.airdrop_pool_address);
    builder.writeBoolean(source.airdrop_pool_bound);
    builder.writeAddress(source.fee_receiver_address);
    builder.writeBoolean(source.fee_receiver_bound);
    builder.writeNumber(source.credit_fee);
    builder.writeNumber(source.fees_collected);
    builder.writeNumber(source.credits_sold);
    builder.writeNumber(source.purchase_seq);
    return builder.build();
}

export function dictValueParserCreditSale$Data(): DictionaryValue<CreditSale$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreditSale$Data(src)).endCell());
        },
        parse: (src) => {
            return loadCreditSale$Data(src.loadRef().beginParse());
        }
    }
}

 type CreditSale_init_args = {
    $$type: 'CreditSale_init_args';
    genesis_controller_address: Address;
    deployment_manifest_hash: bigint;
    sealed: boolean;
}

function initCreditSale_init_args(src: CreditSale_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.genesis_controller_address);
        b_0.storeInt(src.deployment_manifest_hash, 257);
        b_0.storeBit(src.sealed);
    };
}

async function CreditSale_init(genesis_controller_address: Address, deployment_manifest_hash: bigint, sealed: boolean) {
    const __code = Cell.fromHex('b5ee9c724102140100051c000114ff00f4a413f4bcf2c80b01020162021202f8d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e26d200fa40d3fffa40d200d401d0fa40d200d37fd37fd33fd33f30106b106a1069106810676c1b8e24fa40810101d700d200552003d158532270708208989680705300108a1079107810671056e20c925f0ce0702bd74920c21fe300210304000c312bd70b1f0104f6821043533031ba8f5f5b0a8020d721fa4030109a108910781067105610451034413bdb3cdb3c3781698206b316f2f41089107810677f06104510344130c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed54e021821043533032bae30221821043533033ba0809050602bc5b0a8020d721fa4030109a108910781067105610451034413bdb3cdb3c3581698404b314f2f4108910781067105610457f4134c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed54080904ea8f605b0a8020d721d37f30109a108910781067105610451034413bdb3cdb3c338169862bc200f2f4109a10891078106710561045103458c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed54e021821043533034bae30221821043533035ba0809070a02d45b0a8020d721d3ff30109a108910781067105610451034413bdb3cdb3c3a8169a051b8ba1bf2f48169a125f2f48169a223f2f48169a322c200f2f47f0a5508c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed540809000e81699a2bb3f2f40014816999f8422bc705f2f404ace3023c20821043533036bae30220821043533037ba8e31303a108a5517c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed54e0c0000bc1211bb0e302108a55170b0e101102fe5b0a8020d721d30f30109a108910781067105610451034413bdb3c8169dd2cc200952c8103e8bb9170e2f2f453b3a88169def8416f24135f0322821004c4b400a08208989680a0bef2f413a0511ba002a4821004c4b4007170f84224021110c855208210414452105004cb1f12cb3fcecb3fc92a0450ff10246d50436d03c80f0c01d489cf16ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00109a1089107810671056104510344013c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed540d00016002f8303a108a5517db3c8169e623c200f2f48169e7f8276f10821005f5e10025a082081e8480a0bef2f4702382081e8480a0717006c8018210ff77560958cb1fcb7fc92904507710246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb000f11000c8169dc2bf2f4005e108a5517c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed540056c87f01ca0055a050abca0018ce16cbff14ce12ca0001c8ce12ca0012cb7f12cb7f12cb3f12cb3fcdc9ed5401b7a1df67da89a1a400031c4da401f481a7fff481a401a803a1f481a401a6ffa6ffa67fa67e6020d620d420d220d020ced8371c49f481020203ae01a400aa4007a2b0a644e0e10411312d00e0a600211420f220f020ce20adc5b678d977130016547a98547a98547a9853a9ff2b1189');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initCreditSale_init_args({ $$type: 'CreditSale_init_args', genesis_controller_address, deployment_manifest_hash, sealed })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const CreditSale_errors = {
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

export const CreditSale_errors_backward = {
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

const CreditSale_types: ABIType[] = [
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
    {"name":"CsBindAirdropPool","header":1129525297,"fields":[{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"CsBindFeeReceiver","header":1129525298,"fields":[{"name":"fee_receiver_address","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"CsSetCreditFee","header":1129525299,"fields":[{"name":"credit_fee","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CsSealGenesis","header":1129525300,"fields":[{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CsBuyCredits","header":1129525301,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"redeem_pubkey","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"CsFlushFees","header":1129525302,"fields":[]},
    {"name":"CsTopUpStorageReserve","header":1129525303,"fields":[]},
    {"name":"AirdropAccrue","header":1094996496,"fields":[{"name":"purchase_id","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"DepositProtocolFee","header":4286010889,"fields":[{"name":"amount","type":{"kind":"simple","type":"uint","optional":false,"format":128}}]},
    {"name":"CreditSaleView","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"airdrop_pool_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"fee_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_receiver_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"credit_fee","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"fees_collected","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"credits_sold","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"purchase_seq","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"CreditSale$Data","header":null,"fields":[{"name":"sealed","type":{"kind":"simple","type":"bool","optional":false}},{"name":"genesis_controller_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"deployment_manifest_hash","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"airdrop_pool_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"airdrop_pool_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"fee_receiver_address","type":{"kind":"simple","type":"address","optional":false}},{"name":"fee_receiver_bound","type":{"kind":"simple","type":"bool","optional":false}},{"name":"credit_fee","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"fees_collected","type":{"kind":"simple","type":"uint","optional":false,"format":128}},{"name":"credits_sold","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"purchase_seq","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
]

const CreditSale_opcodes = {
    "CsBindAirdropPool": 1129525297,
    "CsBindFeeReceiver": 1129525298,
    "CsSetCreditFee": 1129525299,
    "CsSealGenesis": 1129525300,
    "CsBuyCredits": 1129525301,
    "CsFlushFees": 1129525302,
    "CsTopUpStorageReserve": 1129525303,
    "AirdropAccrue": 1094996496,
    "DepositProtocolFee": 4286010889,
}

const CreditSale_getters: ABIGetter[] = [
    {"name":"get_global","methodId":126899,"arguments":[],"returnType":{"kind":"simple","type":"CreditSaleView","optional":false}},
]

export const CreditSale_getterMapping: { [key: string]: string } = {
    'get_global': 'getGetGlobal',
}

const CreditSale_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"CsBindAirdropPool"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CsBindFeeReceiver"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CsSetCreditFee"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CsSealGenesis"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CsBuyCredits"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CsFlushFees"}},
    {"receiver":"internal","message":{"kind":"typed","type":"CsTopUpStorageReserve"}},
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"any"}},
]

export const CS_CREDIT_FEE_DEFAULT = 10000000n;
export const CS_MAX_CREDITS_PER_BUY = 1000n;
export const CS_AIRDROP_ACCRUE_GAS = 80000000n;
export const CS_BUY_EXEC_RESERVE = 10000000n;
export const CS_BASE_STORAGE_ENDOWMENT = 100000000n;
export const CS_FEEACC_DEPOSIT_EXEC_RESERVE = 2000000n;

export class CreditSale implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = CreditSale_errors_backward;
    public static readonly opcodes = CreditSale_opcodes;
    
    static async init(genesis_controller_address: Address, deployment_manifest_hash: bigint, sealed: boolean) {
        return await CreditSale_init(genesis_controller_address, deployment_manifest_hash, sealed);
    }
    
    static async fromInit(genesis_controller_address: Address, deployment_manifest_hash: bigint, sealed: boolean) {
        const __gen_init = await CreditSale_init(genesis_controller_address, deployment_manifest_hash, sealed);
        const address = contractAddress(0, __gen_init);
        return new CreditSale(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new CreditSale(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  CreditSale_types,
        getters: CreditSale_getters,
        receivers: CreditSale_receivers,
        errors: CreditSale_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: CsBindAirdropPool | CsBindFeeReceiver | CsSetCreditFee | CsSealGenesis | CsBuyCredits | CsFlushFees | CsTopUpStorageReserve | null | Slice) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsBindAirdropPool') {
            body = beginCell().store(storeCsBindAirdropPool(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsBindFeeReceiver') {
            body = beginCell().store(storeCsBindFeeReceiver(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsSetCreditFee') {
            body = beginCell().store(storeCsSetCreditFee(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsSealGenesis') {
            body = beginCell().store(storeCsSealGenesis(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsBuyCredits') {
            body = beginCell().store(storeCsBuyCredits(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsFlushFees') {
            body = beginCell().store(storeCsFlushFees(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CsTopUpStorageReserve') {
            body = beginCell().store(storeCsTopUpStorageReserve(message)).endCell();
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
        const result = loadGetterTupleCreditSaleView(source);
        return result;
    }
    
}