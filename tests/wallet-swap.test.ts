import { describe, expect, it } from 'vitest';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell } from '@ton/core';
import { readFileSync } from 'node:fs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { isVerifiedJettonMaster } from '../web/verified-assets.mjs';
import { SWAP_POOLS, SWAP_TOKENS } from '../web/swap-pools.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import {
  GRAM, PTON_TON_TRANSFER_OPCODE, STONFI_SWAP_OPCODE, SWAP_GRAM_FORWARD_NANOTONS, SWAP_JETTON_FORWARD_NANOTONS, SWAP_JETTON_VALUE_NANOTONS,
  SWAP_PTON_GAS_NANOTONS, amountInFor, buildSwapMessage, buildSwapPayload, minimumOut, quoteSwap, readSwapPool, swapDeadline, swapPair, swapPairsFrom,
  swapToken,
} from '../web/wallet-swap.mjs';


const fixture = JSON.parse(readFileSync('tests/fixtures/stonfi-v2/gram-usdt.json', 'utf8'));
const at = Object.fromEntries(fixture.accounts.map((account: any) => [account.name, account.address]));
const GRAM_NANO = 1_000_000_000n;
const USDT = at.usdtMaster;
const coreCell = (cell: any) => Cell.fromBoc(Buffer.from(serializeBoc(cell)))[0];
const REFERRAL = { address: 'UQCxIdfXPHgRLe4DL25glJAPR2NU2Kbo8IDhbaVbjaqDFhuC', bps: 10 };
const BUYBACK = Address.parse(REFERRAL.address).toRawString();

async function chain(captured: any = fixture, master: string = USDT) {
  const blockchain = await Blockchain.create();
  blockchain.now = Math.floor(Date.now() / 1000);
  const libraries = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
  for (const [hash, boc] of Object.entries(captured.libraries)) libraries.set(Buffer.from(hash, 'hex'), Cell.fromBase64(boc as string));
  blockchain.libs = beginCell().storeDictDirect(libraries).endCell();
  for (const account of captured.accounts) {
    const address = Address.parse(account.address);
    await blockchain.setShardAccount(address, createShardAccount({
      address, code: Cell.fromBase64(account.code), data: Cell.fromBase64(account.data), balance: BigInt(account.balance), workchain: 0,
    }));
  }
  const person = await blockchain.treasury('person');
  const transport = {
    runGetMethod: async ({ address, method, stack }: any) => {
      expect(stack).toEqual([]);
      const result = await blockchain.runGetMethod(Address.parse(address), method, []);
      return { stack: result.stack.map((item: any) => (item.type === 'int' ? { type: 'num', value: `0x${item.value.toString(16)}` }
        : item.type === 'null' ? { type: 'null' } : { type: 'cell', value: item.cell.toBoc().toString('base64') })) };
    },
  };
  const usdtWallet = (await blockchain.runGetMethod(Address.parse(master), 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(person.address).endCell() }]))
    .stackReader.readAddress();
  const usdtHeld = async () => ((await blockchain.getContract(usdtWallet)).accountState?.type === 'active'
    ? (await blockchain.runGetMethod(usdtWallet, 'get_wallet_data')).stackReader.readBigNumber() : 0n);
  const send = (message: any) => person.send({ to: Address.parse(message.address), value: message.value, body: coreCell(message.body) });
  const vaultHolds = async (router: string, tokenWallet: string) => {
    const vault = (await blockchain.runGetMethod(Address.parse(router), 'get_vault_address', [
      { type: 'slice', cell: beginCell().storeAddress(Address.parse(BUYBACK)).endCell() }, { type: 'slice', cell: beginCell().storeAddress(Address.parse(tokenWallet)).endCell() },
    ])).stackReader.readAddress();
    if ((await blockchain.getContract(vault)).accountState?.type !== 'active') return { owner: '', amount: 0n };
    const data = (await blockchain.runGetMethod(vault, 'get_vault_data')).stackReader;
    const owner = data.readAddress().toRawString();
    data.readAddress(); data.readAddress();
    return { owner, amount: data.readBigNumber() };
  };
  return { blockchain, person, self: person.address.toRawString(), transport, usdtWallet, usdtHeld, send, vaultHolds };
}

describe('the built-in pools', () => {
  it('SWAP-01: every pair is two verified tokens (or GRAM) on one pool, deepest first; GRAM/USDT is the pool and the router wallets the chain holds', () => {
    const ATH = Address.parse(PLATHO_APP_CONFIG.ath.masterAddress).toRawString();
    for (const [id] of SWAP_TOKENS) {
      const master = `0:${Buffer.from(id, 'base64url').toString('hex')}`;
      expect(isVerifiedJettonMaster(master) || master === ATH, id).toBe(true);
    }
    expect(swapPair(GRAM, ATH)?.ask.symbol, 'ATH trades against GRAM').toBe('ATH');
    const pairs = new Set<string>();
    for (const [, , token0, token1] of SWAP_POOLS) {
      expect(token0).not.toBe(token1);
      const key = [token0, token1].sort().join('|');
      expect(pairs.has(key), 'one pool per pair').toBe(false);
      pairs.add(key);
    }
    const pair = swapPair(GRAM, USDT)!;
    expect([pair.pool, pair.router, pair.offerWallet, pair.askWallet]).toEqual([at.pool, at.router, at.routerPtonWallet, at.routerUsdtWallet]);
    expect([pair.offer.symbol, pair.ask.decimals]).toEqual(['GRAM', 6]);
    expect(swapPair(USDT, GRAM)!.offerWallet).toBe(at.routerUsdtWallet);
    const ranks = swapPairsFrom(GRAM).map((one) => one.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(swapToken('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs')?.id, 'any spelling of an address').toBe(USDT);
    expect(swapPair(GRAM, '0:' + '77'.repeat(32))).toBeNull();
    expect(PLATHO_APP_CONFIG.swapReferral).toBeUndefined();
  });
});

describe('the messages, read back', () => {
  it('SWAP-02: the swap payload is STON.fi v2\'s, field by field — the least accepted and the deadline in it, no referral, no custom payloads', () => {
    const slice = coreCell(buildSwapPayload({ askWallet: at.routerUsdtWallet, recipient: at.router, minOut: 12_345n, deadline: 1_800_000_000n })).beginParse();
    expect(BigInt(slice.loadUint(32))).toBe(STONFI_SWAP_OPCODE);
    expect(slice.loadAddress().toRawString()).toBe(at.routerUsdtWallet);
    expect([slice.loadAddress().toRawString(), slice.loadAddress().toRawString()], 'refund and change: the sender').toEqual([at.router, at.router]);
    expect(slice.loadUintBig(64)).toBe(1_800_000_000n);
    const more = slice.loadRef().beginParse();
    expect(more.loadCoins()).toBe(12_345n);
    expect(more.loadAddress().toRawString()).toBe(at.router);
    expect([more.loadCoins(), more.loadMaybeRef(), more.loadCoins(), more.loadMaybeRef(), more.loadUint(16), more.loadMaybeAddress()]).toEqual([0n, null, 0n, null, 0, null]);
    expect([more.remainingBits, more.remainingRefs, slice.remainingBits, slice.remainingRefs]).toEqual([0, 0, 0, 0]);
    const fee = coreCell(buildSwapPayload({ askWallet: at.routerUsdtWallet, recipient: at.router, minOut: 1n, deadline: 1n, referral: REFERRAL })).beginParse();
    fee.skip(32); fee.loadAddress(); fee.loadAddress(); fee.loadAddress(); fee.skip(64);
    const tail = fee.loadRef().beginParse();
    tail.loadCoins(); tail.loadAddress(); tail.loadCoins(); tail.loadMaybeRef(); tail.loadCoins(); tail.loadMaybeRef();
    expect([tail.loadUint(16), tail.loadAddress().toRawString(), tail.remainingBits]).toEqual([10, BUYBACK, 0]);
    expect(() => buildSwapPayload({ askWallet: at.routerUsdtWallet, recipient: at.router, minOut: 1n, deadline: 1n, referral: { ...REFERRAL, bps: 101 } })).toThrow(/0\.\.100/);
  });

  it('SWAP-03: GRAM offered goes to the router\'s proxy-GRAM wallet with the router\'s work attached; a jetton, to the person\'s own jetton wallet', () => {
    const deadline = swapDeadline(1_800_000_000_000);
    expect(deadline).toBe(1_800_000_900n);
    const gram = buildSwapMessage({ pair: swapPair(GRAM, USDT)!, amountIn: 5n * GRAM_NANO, minOut: 1n, recipient: at.router, deadline, queryId: 3n });
    expect([gram.address, gram.value]).toEqual([at.routerPtonWallet, 5n * GRAM_NANO + SWAP_GRAM_FORWARD_NANOTONS + SWAP_PTON_GAS_NANOTONS]);
    const body = coreCell(gram.body).beginParse();
    expect([BigInt(body.loadUint(32)), body.loadUintBig(64), body.loadCoins(), body.loadAddress().toRawString(), body.loadBit()])
      .toEqual([PTON_TON_TRANSFER_OPCODE, 3n, 5n * GRAM_NANO, at.router, true]);
    expect(BigInt(body.loadRef().beginParse().loadUint(32))).toBe(STONFI_SWAP_OPCODE);
    const mine = '0:' + '44'.repeat(32);
    const jetton = buildSwapMessage({ pair: swapPair(USDT, GRAM)!, amountIn: 7n, minOut: 1n, recipient: at.router, deadline, jettonWallet: mine });
    expect([jetton.address, jetton.value]).toEqual([mine, SWAP_JETTON_VALUE_NANOTONS]);
    const transfer = coreCell(jetton.body).beginParse();
    transfer.skip(32 + 64);
    expect([transfer.loadCoins(), transfer.loadAddress().toRawString(), transfer.loadAddress().toRawString(), transfer.loadBit(), transfer.loadCoins(), transfer.loadBit()])
      .toEqual([7n, at.router, at.router, false, SWAP_JETTON_FORWARD_NANOTONS, true]);
    expect(() => buildSwapMessage({ pair: swapPair(USDT, GRAM)!, amountIn: 7n, minOut: 1n, recipient: at.router, deadline })).toThrow(/jetton wallet/);
  });

  it('SWAP-04: the least accepted is the quote less the slippage chosen; a locked or empty pool quotes nothing', () => {
    expect([minimumOut(10_000n, 50), minimumOut(10_000n, 100), minimumOut(10_000n, 300), minimumOut(10_000n, 7), minimumOut(1n, 300)]).toEqual([9_950n, 9_900n, 9_700n, 9_900n, 1n]);
    const pair = swapPair(GRAM, USDT)!;
    const pool = { locked: false, reserves: [1_000_000n, 1_000_000n], lpFee: 7n, protocolFee: 3n };
    expect(quoteSwap({ pair, pool: { ...pool, locked: true }, amountIn: 1_000n }).out).toBe(0n);
    expect(quoteSwap({ pair, pool: { ...pool, reserves: [0n, 5n] }, amountIn: 1_000n }).out).toBe(0n);
    expect(quoteSwap({ pair, pool, amountIn: 0n }).out).toBe(0n);
    expect(quoteSwap({ pair, pool, amountIn: 1_000_000n }).impactBps, 'half the pool').toBe(5_000);
    const plain = quoteSwap({ pair, pool, amountIn: 1_000_000n });
    const withFee = quoteSwap({ pair, pool, amountIn: 1_000_000n, referral: REFERRAL });
    expect([plain.out, plain.referralFee, withFee.out, withFee.referralFee]).toEqual([499_674n, 0n, 499_174n, 500n]);
    const deep = { locked: false, reserves: [2_521_088_622_215n, 1_817_504_424_040_190n], lpFee: 7n, protocolFee: 3n };
    for (const want of [1n, 13_843_348n, 1_000_000_000n]) {
      const give = amountInFor({ pair, pool: deep, amountOut: want, referral: REFERRAL })!;
      expect(quoteSwap({ pair, pool: deep, amountIn: give, referral: REFERRAL }).out >= want, `${want}`).toBe(true);
      expect(quoteSwap({ pair, pool: deep, amountIn: give - 1n, referral: REFERRAL }).out < want, `${want} - 1`).toBe(true);
    }
    expect(amountInFor({ pair, pool: deep, amountOut: deep.reserves[0] }), 'more than the pool holds').toBeNull();
    expect(amountInFor({ pair, pool: { ...deep, locked: true }, amountOut: 5n })).toBeNull();
  });
});

describe('on STON.fi\'s own code, copied from mainnet', () => {
  it('SWAP-05: GRAM -> USDT: exactly the quoted USDT arrives, nothing is set aside for anyone, and of the attached work only the network\'s fee is spent', async () => {
    const { blockchain, person, self, transport, usdtHeld, send, vaultHolds } = await chain();
    const pair = swapPair(GRAM, USDT)!;
    const pool = await readSwapPool({ transport, pair });
    const amountIn = 10n * GRAM_NANO;
    const quote = quoteSwap({ pair, pool, amountIn });
    expect([quote.out > 0n, quote.referralFee]).toEqual([true, 0n]);
    const before = await person.getBalance();
    const result = await send(buildSwapMessage({ pair, amountIn, minOut: minimumOut(quote.out, 100), recipient: self, deadline: BigInt(blockchain.now! + 900) }));
    expect(result.transactions.every((tx: any) => tx.description.type !== 'generic' || !tx.description.aborted)).toBe(true);
    expect(await usdtHeld()).toBe(quote.out);
    expect(await vaultHolds(at.router, at.routerUsdtWallet), 'no fee set aside [decided 2026-10-24]').toEqual({ owner: '', amount: 0n });
    const spent = before - await person.getBalance();
    expect(spent - amountIn, 'the network\'s fee, the change returned').toBeLessThan(GRAM_NANO / 50n);
    const after = await readSwapPool({ transport, pair });
    expect(after.reserves[1] - pool.reserves[1], 'the pool took what was offered').toBe(amountIn);
  });

  it('SWAP-06: USDT -> GRAM: the proxy-GRAM payout carries exactly the quoted GRAM, nothing set aside; the 0.3 attached comes back but the fee', async () => {
    const { blockchain, person, self, transport, usdtWallet, usdtHeld, send, vaultHolds } = await chain();
    const deadline = BigInt(blockchain.now! + 900);
    await send(buildSwapMessage({ pair: swapPair(GRAM, USDT)!, amountIn: 20n * GRAM_NANO, minOut: 1n, recipient: self, deadline }));
    const held = await usdtHeld();
    const pair = swapPair(USDT, GRAM)!;
    const quote = quoteSwap({ pair, pool: await readSwapPool({ transport, pair }), amountIn: held });
    const before = await person.getBalance();
    const result = await send(buildSwapMessage({ pair, amountIn: held, minOut: minimumOut(quote.out, 50), recipient: self, deadline, jettonWallet: usdtWallet.toRawString() }));
    const payout = result.transactions.map((tx: any) => tx.inMessage).find((message: any) => message?.info?.type === 'internal'
      && message.info.dest.equals(person.address) && message.body.beginParse().loadUint(32) === Number(PTON_TON_TRANSFER_OPCODE));
    const body = payout.body.beginParse();
    body.skip(32 + 64);
    expect(body.loadCoins()).toBe(quote.out);
    expect(await usdtHeld()).toBe(0n);
    const gained = await person.getBalance() - before;
    expect(quote.out - gained, 'only the network\'s fee').toBeLessThan(GRAM_NANO / 50n);
    expect(quote.out - gained).toBeGreaterThan(0n);
    expect(await vaultHolds(at.router, at.routerPtonWallet), 'no fee set aside').toEqual({ owner: '', amount: 0n });
  });

  it('SWAP-07: below the least accepted, or past the deadline, the pool sends the GRAM back; a jetton below it comes back too', async () => {
    const { blockchain, person, self, transport, usdtWallet, usdtHeld, send } = await chain();
    const pair = swapPair(GRAM, USDT)!;
    const amountIn = 10n * GRAM_NANO;
    const quote = quoteSwap({ pair, pool: await readSwapPool({ transport, pair }), amountIn });
    for (const [why, minOut, deadline] of [['above the quote', quote.out + 1n, blockchain.now! + 900], ['past the deadline', 1n, blockchain.now! - 1]] as const) {
      const before = await person.getBalance();
      await send(buildSwapMessage({ pair, amountIn, minOut, recipient: self, deadline: BigInt(deadline) }));
      expect(before - await person.getBalance(), why).toBeLessThan(GRAM_NANO / 50n);
      expect(await usdtHeld(), why).toBe(0n);
    }
    await send(buildSwapMessage({ pair, amountIn, minOut: 1n, recipient: self, deadline: BigInt(blockchain.now! + 900) }));
    const held = await usdtHeld();
    const back = swapPair(USDT, GRAM)!;
    const out = quoteSwap({ pair: back, pool: await readSwapPool({ transport, pair: back }), amountIn: held }).out;
    const before = await person.getBalance();
    await send(buildSwapMessage({ pair: back, amountIn: held, minOut: out + 1n, recipient: self, deadline: BigInt(blockchain.now! + 900), jettonWallet: usdtWallet.toRawString() }));
    expect(await usdtHeld(), 'the USDT came back').toBe(held);
    expect(before - await person.getBalance()).toBeLessThan(GRAM_NANO / 50n);
  });

  it('SWAP-08: a pool that names another router or other wallets than the built-in list is refused before anything is quoted', async () => {
    const { transport } = await chain();
    const pair = swapPair(GRAM, USDT)!;
    await expect(readSwapPool({ transport, pair: { ...pair, askWallet: at.routerPtonWallet, offerWallet: at.routerUsdtWallet } })).rejects.toMatchObject({ code: 'SWAP_POOL_DISAGREES' });
    await expect(readSwapPool({ transport, pair: { ...pair, router: at.usdtMaster } })).rejects.toMatchObject({ code: 'SWAP_POOL_DISAGREES' });
  });

  it('SWAP-10: Platho\'s own ATH on its STON.fi pool — GRAM -> ATH and back, exactly as quoted, nothing set aside; the ATH wallet\'s own code carries the swap', async () => {
    const captured = JSON.parse(readFileSync('tests/fixtures/stonfi-v2/gram-ath.json', 'utf8'));
    const named = Object.fromEntries(captured.accounts.map((account: any) => [account.name, account.address]));
    const { blockchain, person, self, transport, usdtWallet: athWallet, usdtHeld: athHeld, send, vaultHolds } = await chain(captured, named.jettonMaster);
    expect(named.jettonMaster).toBe(Address.parse(PLATHO_APP_CONFIG.ath.masterAddress).toRawString());
    const pair = swapPair(GRAM, named.jettonMaster)!;
    expect([pair.pool, pair.router, pair.offerWallet, pair.askWallet], 'the built-in list holds this pool and its wallets').toEqual([named.pool, named.router, named.routerPtonWallet, named.routerJettonWallet]);
    const deadline = BigInt(blockchain.now! + 900);
    const amountIn = 5n * GRAM_NANO;
    const quote = quoteSwap({ pair, pool: await readSwapPool({ transport, pair }), amountIn });
    await send(buildSwapMessage({ pair, amountIn, minOut: minimumOut(quote.out, 100), recipient: self, deadline }));
    expect(await athHeld()).toBe(quote.out);
    expect(await vaultHolds(named.router, named.routerJettonWallet), 'no fee set aside, in ATH').toEqual({ owner: '', amount: 0n });
    const back = swapPair(named.jettonMaster, GRAM)!;
    const returning = quoteSwap({ pair: back, pool: await readSwapPool({ transport, pair: back }), amountIn: quote.out });
    const result = await send(buildSwapMessage({ pair: back, amountIn: quote.out, minOut: minimumOut(returning.out, 100), recipient: self, deadline,
      jettonWallet: athWallet.toRawString() }));
    const payout = result.transactions.map((tx: any) => tx.inMessage).find((message: any) => message?.info?.type === 'internal'
      && message.info.dest.equals(person.address) && message.body.beginParse().loadUint(32) === Number(PTON_TON_TRANSFER_OPCODE));
    const body = payout.body.beginParse();
    body.skip(32 + 64);
    expect(body.loadCoins()).toBe(returning.out);
    expect(await athHeld()).toBe(0n);
    expect(await vaultHolds(named.router, named.routerPtonWallet), 'nor in GRAM').toEqual({ owner: '', amount: 0n });
  });

  it('SWAP-09: a pool on an older 2.1 router computes the same: GRAM in and back out, exactly as quoted', async () => {
    const older = JSON.parse(readFileSync('tests/fixtures/stonfi-v2/gram-v21.json', 'utf8'));
    const named = Object.fromEntries(older.accounts.map((account: any) => [account.name, account.address]));
    const { blockchain, person, self, transport, usdtWallet: jettonWallet, usdtHeld: jettonHeld, send } = await chain(older, named.jettonMaster);
    expect(BigInt((await blockchain.runGetMethod(Address.parse(named.router), 'get_router_version')).stackReader.skip(1).readBigNumber()), 'a 2.1 router').toBe(1n);
    const data = (await transport.runGetMethod({ address: named.pool, method: 'get_pool_data', stack: [] })).stack;
    const wallets = [data[5], data[6]].map((item: any) => Cell.fromBase64(item.value).beginParse().loadAddress().toRawString());
    const gramSide = wallets.indexOf(named.routerPtonWallet);
    expect(gramSide).toBeGreaterThan(-1);
    const decimals = 9;
    const pair = { pool: named.pool, router: named.router, offerSide: gramSide, offer: { id: GRAM, symbol: 'GRAM', decimals: 9 }, ask: { id: named.jettonMaster, symbol: 'X', decimals },
      offerWallet: wallets[gramSide], askWallet: wallets[1 - gramSide], rank: 0 };
    const amountIn = 2n * GRAM_NANO;
    const quote = quoteSwap({ pair, pool: await readSwapPool({ transport, pair }), amountIn });
    expect(quote.out).toBeGreaterThan(0n);
    const deadline = BigInt(blockchain.now! + 900);
    await send(buildSwapMessage({ pair, amountIn, minOut: minimumOut(quote.out, 100), recipient: self, deadline }));
    expect(await jettonHeld()).toBe(quote.out);
    const back = { ...pair, offerSide: 1 - gramSide, offer: pair.ask, ask: pair.offer, offerWallet: pair.askWallet, askWallet: pair.offerWallet };
    const returning = quoteSwap({ pair: back, pool: await readSwapPool({ transport, pair: back }), amountIn: quote.out });
    const result = await send(buildSwapMessage({ pair: back, amountIn: quote.out, minOut: minimumOut(returning.out, 100), recipient: self, deadline, jettonWallet: jettonWallet.toRawString() }));
    const payout = result.transactions.map((tx: any) => tx.inMessage).find((message: any) => message?.info?.type === 'internal'
      && message.info.dest.equals(person.address) && message.body.beginParse().loadUint(32) === Number(PTON_TON_TRANSFER_OPCODE));
    const body = payout.body.beginParse();
    body.skip(32 + 64);
    expect(body.loadCoins()).toBe(returning.out);
    expect(await jettonHeld()).toBe(0n);
  });
});
