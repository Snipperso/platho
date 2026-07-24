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

export type TicketCredit = {
    $$type: 'TicketCredit';
}

export function storeTicketCredit(src: TicketCredit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041265, 32);
    };
}

export function loadTicketCredit(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041265) { throw Error('Invalid prefix'); }
    return { $$type: 'TicketCredit' as const };
}

export function loadTupleTicketCredit(source: TupleReader) {
    return { $$type: 'TicketCredit' as const };
}

export function loadGetterTupleTicketCredit(source: TupleReader) {
    return { $$type: 'TicketCredit' as const };
}

export function storeTupleTicketCredit(source: TicketCredit) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserTicketCredit(): DictionaryValue<TicketCredit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketCredit(src)).endCell());
        },
        parse: (src) => {
            return loadTicketCredit(src.loadRef().beginParse());
        }
    }
}

export type TicketClaim = {
    $$type: 'TicketClaim';
}

export function storeTicketClaim(src: TicketClaim) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041266, 32);
    };
}

export function loadTicketClaim(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041266) { throw Error('Invalid prefix'); }
    return { $$type: 'TicketClaim' as const };
}

export function loadTupleTicketClaim(source: TupleReader) {
    return { $$type: 'TicketClaim' as const };
}

export function loadGetterTupleTicketClaim(source: TupleReader) {
    return { $$type: 'TicketClaim' as const };
}

export function storeTupleTicketClaim(source: TicketClaim) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserTicketClaim(): DictionaryValue<TicketClaim> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketClaim(src)).endCell());
        },
        parse: (src) => {
            return loadTicketClaim(src.loadRef().beginParse());
        }
    }
}

export type TicketExportCredits = {
    $$type: 'TicketExportCredits';
    to: Address;
}

export function storeTicketExportCredits(src: TicketExportCredits) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041269, 32);
        b_0.storeAddress(src.to);
    };
}

export function loadTicketExportCredits(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041269) { throw Error('Invalid prefix'); }
    const _to = sc_0.loadAddress();
    return { $$type: 'TicketExportCredits' as const, to: _to };
}

export function loadTupleTicketExportCredits(source: TupleReader) {
    const _to = source.readAddress();
    return { $$type: 'TicketExportCredits' as const, to: _to };
}

export function loadGetterTupleTicketExportCredits(source: TupleReader) {
    const _to = source.readAddress();
    return { $$type: 'TicketExportCredits' as const, to: _to };
}

export function storeTupleTicketExportCredits(source: TicketExportCredits) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.to);
    return builder.build();
}

export function dictValueParserTicketExportCredits(): DictionaryValue<TicketExportCredits> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketExportCredits(src)).endCell());
        },
        parse: (src) => {
            return loadTicketExportCredits(src.loadRef().beginParse());
        }
    }
}

export type TicketCreditsMigrated = {
    $$type: 'TicketCreditsMigrated';
    credits_k: bigint;
    owner: Address;
}

export function storeTicketCreditsMigrated(src: TicketCreditsMigrated) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041270, 32);
        b_0.storeUint(src.credits_k, 32);
        b_0.storeAddress(src.owner);
    };
}

export function loadTicketCreditsMigrated(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041270) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(32);
    const _owner = sc_0.loadAddress();
    return { $$type: 'TicketCreditsMigrated' as const, credits_k: _credits_k, owner: _owner };
}

export function loadTupleTicketCreditsMigrated(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _owner = source.readAddress();
    return { $$type: 'TicketCreditsMigrated' as const, credits_k: _credits_k, owner: _owner };
}

export function loadGetterTupleTicketCreditsMigrated(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _owner = source.readAddress();
    return { $$type: 'TicketCreditsMigrated' as const, credits_k: _credits_k, owner: _owner };
}

export function storeTupleTicketCreditsMigrated(source: TicketCreditsMigrated) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeAddress(source.owner);
    return builder.build();
}

export function dictValueParserTicketCreditsMigrated(): DictionaryValue<TicketCreditsMigrated> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketCreditsMigrated(src)).endCell());
        },
        parse: (src) => {
            return loadTicketCreditsMigrated(src.loadRef().beginParse());
        }
    }
}

export type TicketRedeem = {
    $$type: 'TicketRedeem';
    credits_k: bigint;
    owner: Address;
}

export function storeTicketRedeem(src: TicketRedeem) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041267, 32);
        b_0.storeUint(src.credits_k, 32);
        b_0.storeAddress(src.owner);
    };
}

export function loadTicketRedeem(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041267) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(32);
    const _owner = sc_0.loadAddress();
    return { $$type: 'TicketRedeem' as const, credits_k: _credits_k, owner: _owner };
}

export function loadTupleTicketRedeem(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _owner = source.readAddress();
    return { $$type: 'TicketRedeem' as const, credits_k: _credits_k, owner: _owner };
}

export function loadGetterTupleTicketRedeem(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    const _owner = source.readAddress();
    return { $$type: 'TicketRedeem' as const, credits_k: _credits_k, owner: _owner };
}

export function storeTupleTicketRedeem(source: TicketRedeem) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    builder.writeAddress(source.owner);
    return builder.build();
}

export function dictValueParserTicketRedeem(): DictionaryValue<TicketRedeem> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketRedeem(src)).endCell());
        },
        parse: (src) => {
            return loadTicketRedeem(src.loadRef().beginParse());
        }
    }
}

export type AirdropTicketView = {
    $$type: 'AirdropTicketView';
    owner: Address;
    credits: bigint;
    in_flight: bigint;
    min_claim_credits: bigint;
    max_credits_per_claim: bigint;
    claim_min_value: bigint;
}

export function storeAirdropTicketView(src: AirdropTicketView) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner);
        b_0.storeInt(src.credits, 257);
        b_0.storeInt(src.in_flight, 257);
        const b_1 = new Builder();
        b_1.storeInt(src.min_claim_credits, 257);
        b_1.storeInt(src.max_credits_per_claim, 257);
        b_1.storeInt(src.claim_min_value, 257);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadAirdropTicketView(slice: Slice) {
    const sc_0 = slice;
    const _owner = sc_0.loadAddress();
    const _credits = sc_0.loadIntBig(257);
    const _in_flight = sc_0.loadIntBig(257);
    const sc_1 = sc_0.loadRef().beginParse();
    const _min_claim_credits = sc_1.loadIntBig(257);
    const _max_credits_per_claim = sc_1.loadIntBig(257);
    const _claim_min_value = sc_1.loadIntBig(257);
    return { $$type: 'AirdropTicketView' as const, owner: _owner, credits: _credits, in_flight: _in_flight, min_claim_credits: _min_claim_credits, max_credits_per_claim: _max_credits_per_claim, claim_min_value: _claim_min_value };
}

export function loadTupleAirdropTicketView(source: TupleReader) {
    const _owner = source.readAddress();
    const _credits = source.readBigNumber();
    const _in_flight = source.readBigNumber();
    const _min_claim_credits = source.readBigNumber();
    const _max_credits_per_claim = source.readBigNumber();
    const _claim_min_value = source.readBigNumber();
    return { $$type: 'AirdropTicketView' as const, owner: _owner, credits: _credits, in_flight: _in_flight, min_claim_credits: _min_claim_credits, max_credits_per_claim: _max_credits_per_claim, claim_min_value: _claim_min_value };
}

export function loadGetterTupleAirdropTicketView(source: TupleReader) {
    const _owner = source.readAddress();
    const _credits = source.readBigNumber();
    const _in_flight = source.readBigNumber();
    const _min_claim_credits = source.readBigNumber();
    const _max_credits_per_claim = source.readBigNumber();
    const _claim_min_value = source.readBigNumber();
    return { $$type: 'AirdropTicketView' as const, owner: _owner, credits: _credits, in_flight: _in_flight, min_claim_credits: _min_claim_credits, max_credits_per_claim: _max_credits_per_claim, claim_min_value: _claim_min_value };
}

export function storeTupleAirdropTicketView(source: AirdropTicketView) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner);
    builder.writeNumber(source.credits);
    builder.writeNumber(source.in_flight);
    builder.writeNumber(source.min_claim_credits);
    builder.writeNumber(source.max_credits_per_claim);
    builder.writeNumber(source.claim_min_value);
    return builder.build();
}

export function dictValueParserAirdropTicketView(): DictionaryValue<AirdropTicketView> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropTicketView(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropTicketView(src.loadRef().beginParse());
        }
    }
}

export type AirdropTicket$Data = {
    $$type: 'AirdropTicket$Data';
    owner: Address;
    credits: bigint;
    in_flight: bigint;
}

export function storeAirdropTicket$Data(src: AirdropTicket$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner);
        b_0.storeUint(src.credits, 32);
        b_0.storeUint(src.in_flight, 32);
    };
}

export function loadAirdropTicket$Data(slice: Slice) {
    const sc_0 = slice;
    const _owner = sc_0.loadAddress();
    const _credits = sc_0.loadUintBig(32);
    const _in_flight = sc_0.loadUintBig(32);
    return { $$type: 'AirdropTicket$Data' as const, owner: _owner, credits: _credits, in_flight: _in_flight };
}

export function loadTupleAirdropTicket$Data(source: TupleReader) {
    const _owner = source.readAddress();
    const _credits = source.readBigNumber();
    const _in_flight = source.readBigNumber();
    return { $$type: 'AirdropTicket$Data' as const, owner: _owner, credits: _credits, in_flight: _in_flight };
}

export function loadGetterTupleAirdropTicket$Data(source: TupleReader) {
    const _owner = source.readAddress();
    const _credits = source.readBigNumber();
    const _in_flight = source.readBigNumber();
    return { $$type: 'AirdropTicket$Data' as const, owner: _owner, credits: _credits, in_flight: _in_flight };
}

export function storeTupleAirdropTicket$Data(source: AirdropTicket$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner);
    builder.writeNumber(source.credits);
    builder.writeNumber(source.in_flight);
    return builder.build();
}

export function dictValueParserAirdropTicket$Data(): DictionaryValue<AirdropTicket$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAirdropTicket$Data(src)).endCell());
        },
        parse: (src) => {
            return loadAirdropTicket$Data(src.loadRef().beginParse());
        }
    }
}

export type TicketRedeemAck = {
    $$type: 'TicketRedeemAck';
    credits_k: bigint;
}

export function storeTicketRedeemAck(src: TicketRedeemAck) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1096041268, 32);
        b_0.storeUint(src.credits_k, 32);
    };
}

export function loadTicketRedeemAck(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1096041268) { throw Error('Invalid prefix'); }
    const _credits_k = sc_0.loadUintBig(32);
    return { $$type: 'TicketRedeemAck' as const, credits_k: _credits_k };
}

export function loadTupleTicketRedeemAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    return { $$type: 'TicketRedeemAck' as const, credits_k: _credits_k };
}

export function loadGetterTupleTicketRedeemAck(source: TupleReader) {
    const _credits_k = source.readBigNumber();
    return { $$type: 'TicketRedeemAck' as const, credits_k: _credits_k };
}

export function storeTupleTicketRedeemAck(source: TicketRedeemAck) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.credits_k);
    return builder.build();
}

export function dictValueParserTicketRedeemAck(): DictionaryValue<TicketRedeemAck> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTicketRedeemAck(src)).endCell());
        },
        parse: (src) => {
            return loadTicketRedeemAck(src.loadRef().beginParse());
        }
    }
}

 type AirdropTicket_init_args = {
    $$type: 'AirdropTicket_init_args';
    owner: Address;
}

function initAirdropTicket_init_args(src: AirdropTicket_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner);
    };
}

async function AirdropTicket_init(owner: Address) {
    const __code = Cell.fromHex('b5ee9c7241020d01000328000114ff00f4a413f4bcf2c80b01020162020b04c0d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200019afa40d31fd31f55206c1397fa400101d17020e204e3027023d74920c21f963123d70b1f01de21821041544331bae30221821041544332bae30221821041544335ba0304050700b4028020d7217021d749c21f9430d31f01de20821041544333ba8e1a303302d31f0131a070c87f01ca0055205023cecb1fcb1fc9ed54e0821041544336ba8e18d31f013112a058c87f01ca0055205023cecb1fcb1fc9ed54e05f0401ac5b32816979f8428d086002724d8a3bfe1153dbfba190d971be239600c5322de69e1578edb39bebe6f0664cc705f2f481697b541232db3c14f2f481697a21841fb9f2f4a458c87f01ca0055205023cecb1fcb1fc9ed540801fa5b32816982f84222c705f2f481698303c00013f2f481698421c209f2f4816985f8416f24135f03820bc14dc0bef2f453008103e8bc94308103e8de66a1218d086002724d8a3bfe1153dbfba190d971be239600c5322de69e1578edb39bebe6f0664c7080407f5167c8598210415443335003cb1fcb1fcec91034413016060058441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0001c87f01ca0055205023cecb1fcb1fc9ed5403f88f775b028020d721fa4030816996f84223c705f2f481699724c000f2f481699823c200f2f4028169995143db3c15f2f481699af8416f24135f038209312d00bef2f4702080407f5145c8598210415443365003cb1fcb1fcec91046413016441359c8cf8580ca00cf8440ce01fa02806acf40f400c901fb0002e0342008090a000cd30a308309ba0022c87f01ca0055205023cecb1fcb1fc9ed5400f4821041544334ba8e42306c2281698cf8428d086002724d8a3bfe1153dbfba190d971be239600c5322de69e1578edb39bebe6f0664cc705f2f470c87f01ca0055205023cecb1fcb1fc9ed54e0c00003c12113b08e1202c87f01ca0055205023cecb1fcb1fc9ed54e002c87f01ca0055205023cecb1fcb1fc9ed540141a12dbdda89a1a4000335f481a63fa63eaa40d8272ff4800203a2e041c5b678d86d0c001e7a8103e8820bc14dc0255135513503503f9750');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initAirdropTicket_init_args({ $$type: 'AirdropTicket_init_args', owner })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const AirdropTicket_errors = {
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

export const AirdropTicket_errors_backward = {
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

const AirdropTicket_types: ABIType[] = [
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
    {"name":"TicketCredit","header":1096041265,"fields":[]},
    {"name":"TicketClaim","header":1096041266,"fields":[]},
    {"name":"TicketExportCredits","header":1096041269,"fields":[{"name":"to","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TicketCreditsMigrated","header":1096041270,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"TicketRedeem","header":1096041267,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AirdropTicketView","header":null,"fields":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"in_flight","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"min_claim_credits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"max_credits_per_claim","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"claim_min_value","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"AirdropTicket$Data","header":null,"fields":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"credits","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"in_flight","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"TicketRedeemAck","header":1096041268,"fields":[{"name":"credits_k","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const AirdropTicket_opcodes = {
    "TicketCredit": 1096041265,
    "TicketClaim": 1096041266,
    "TicketExportCredits": 1096041269,
    "TicketCreditsMigrated": 1096041270,
    "TicketRedeem": 1096041267,
    "TicketRedeemAck": 1096041268,
}

const AirdropTicket_getters: ABIGetter[] = [
    {"name":"get_ticket","methodId":104158,"arguments":[],"returnType":{"kind":"simple","type":"AirdropTicketView","optional":false}},
]

export const AirdropTicket_getterMapping: { [key: string]: string } = {
    'get_ticket': 'getGetTicket',
}

const AirdropTicket_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"TicketCredit"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TicketClaim"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TicketExportCredits"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TicketRedeemAck"}},
    {"receiver":"internal","message":{"kind":"empty"}},
    {"receiver":"internal","message":{"kind":"any"}},
]

export const AT_FEE_SINK = address("EQBOSbFHf8Iqe390MhsuN8RywBimRbzTwq8dtnN9fN4MyZOP");
export const AT_BASE_ENDOWMENT = 40000000n;
export const AT_MIN_CLAIM_CREDITS = 10n;
export const AT_MAX_CREDITS_PER_CLAIM = 1000n;
export const AT_CLAIM_MIN_VALUE = 63000000n;
export const AT_EXPORT_MIN_VALUE = 20000000n;

export class AirdropTicket implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = AirdropTicket_errors_backward;
    public static readonly opcodes = AirdropTicket_opcodes;
    
    static async init(owner: Address) {
        return await AirdropTicket_init(owner);
    }
    
    static async fromInit(owner: Address) {
        const __gen_init = await AirdropTicket_init(owner);
        const address = contractAddress(0, __gen_init);
        return new AirdropTicket(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new AirdropTicket(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  AirdropTicket_types,
        getters: AirdropTicket_getters,
        receivers: AirdropTicket_receivers,
        errors: AirdropTicket_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: TicketCredit | TicketClaim | TicketExportCredits | TicketRedeemAck | null | Slice) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TicketCredit') {
            body = beginCell().store(storeTicketCredit(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TicketClaim') {
            body = beginCell().store(storeTicketClaim(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TicketExportCredits') {
            body = beginCell().store(storeTicketExportCredits(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TicketRedeemAck') {
            body = beginCell().store(storeTicketRedeemAck(message)).endCell();
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
    
    async getGetTicket(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_ticket', builder.build())).stack;
        const result = loadGetterTupleAirdropTicketView(source);
        return result;
    }
    
}