import { describe, expect, it } from 'vitest';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { Address, Cell, Dictionary, beginCell } from '@ton/core';
import { readFileSync } from 'node:fs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { isVerifiedJettonMaster } from '../web/verified-assets.mjs';
import { DEDUST_FACTORY, DEDUST_GRAM_VAULT, DEDUST_POOLS, DEDUST_TOKENS } from '../web/dedust-pools.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { GRAM, minimumOut, swapDeadline } from '../web/wallet-swap.mjs';
import {
  DEDUST_GRAM_GAS_NANOTONS, DEDUST_JETTON_FORWARD_NANOTONS, DEDUST_JETTON_SWAP_OPCODE, DEDUST_JETTON_VALUE_NANOTONS, DEDUST_NATIVE_SWAP_OPCODE,
  buildDedustSwapMessage, dedustAmountInFor, dedustAssetCell, dedustAssetFromStack, dedustPairs, dedustPairsFrom, dedustToken, estimateDedustSwap,
  quoteDedustSwap, readDedustPool,
} from '../web/wallet-swap-dedust.mjs';


const fixture = JSON.parse(readFileSync('tests/fixtures/dedust-v2/gram-usdt.json', 'utf8'));
const at = Object.fromEntries(fixture.accounts.map((account: any) => [account.name, account.address]));
const GRAM_NANO = 1_000_000_000n;
const coreCell = (cell: any) => Cell.fromBoc(Buffer.from(serializeBoc(cell)))[0];
const idOf = (base64url: string) => `0:${Buffer.from(base64url, 'base64url').toString('hex')}`;
const BLANK_CODE = Cell.fromBase64('te6ccgEBBAEAlgABFP8A9KQT9LzyyAsBAgJwAwIACb8pMvg8APXeA6DprkP0gGBB2onai9qPHDK3AgFA4LEAIZGWCgOeLAP0BQDXnoGSA/YB2s/ay9rI4v/aIxx72omh9IGmDqJljgvlwgcIHgmmPgMEITZ1R/V0K+XoB6Z+AmGpph4CA6hD9ghDodo92qYgjCCLBAHKTdqHsdqD2+ID5f8=');
const derivedVault = (asset: string) => {
  const data = beginCell().storeAddress(Address.parse(idOf(DEDUST_FACTORY))).storeUint(1, 8).storeSlice(coreCell(dedustAssetCell(asset)).beginParse()).endCell();
  return `0:${beginCell().storeUint(0, 2).storeMaybeRef(BLANK_CODE).storeMaybeRef(data).storeDict(null).endCell().hash().toString('hex')}`;
};
const derivedPool = (stable: number, a: string, b: string) => {
  const data = beginCell().storeAddress(Address.parse(idOf(DEDUST_FACTORY))).storeUint(2, 8).storeUint(stable, 1)
    .storeSlice(coreCell(dedustAssetCell(a)).beginParse()).storeSlice(coreCell(dedustAssetCell(b)).beginParse()).endCell();
  return `0:${beginCell().storeUint(0, 2).storeMaybeRef(BLANK_CODE).storeMaybeRef(data).storeDict(null).endCell().hash().toString('hex')}`;
};

async function chain() {
  const blockchain = await Blockchain.create();
  blockchain.now = Math.floor(Date.now() / 1000);
  const libraries = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
  for (const [hash, boc] of Object.entries(fixture.libraries)) libraries.set(Buffer.from(hash, 'hex'), Cell.fromBase64(boc as string));
  blockchain.libs = beginCell().storeDictDirect(libraries).endCell();
  for (const account of fixture.accounts) {
    const address = Address.parse(account.address);
    await blockchain.setShardAccount(address, createShardAccount({
      address, code: Cell.fromBase64(account.code), data: Cell.fromBase64(account.data), balance: BigInt(account.balance), workchain: 0,
    }));
  }
  const person = await blockchain.treasury('person');
  const transport = {
    calls: [] as string[],
    runGetMethod: async ({ address, method, stack = [] }: any) => {
      transport.calls.push(method);
      const args = stack.map((item: any) => (item.type === 'num' ? { type: 'int', value: BigInt(item.value) } : { type: 'slice', cell: Cell.fromBase64(item.value) }));
      const result = await blockchain.runGetMethod(Address.parse(address), method, args);
      return { stack: result.stack.map((item: any) => (item.type === 'int' ? { type: 'num', value: `0x${item.value.toString(16)}` }
        : item.type === 'null' ? { type: 'null' } : { type: 'cell', value: item.cell.toBoc().toString('base64') })) };
    },
  };
  const walletOf = async (master: string) => (await blockchain.runGetMethod(Address.parse(master), 'get_wallet_address', [
    { type: 'slice', cell: beginCell().storeAddress(person.address).endCell() }])).stackReader.readAddress();
  const held = async (master: string) => {
    const wallet = await walletOf(master);
    return (await blockchain.getContract(wallet)).accountState?.type === 'active' ? (await blockchain.runGetMethod(wallet, 'get_wallet_data')).stackReader.readBigNumber() : 0n;
  };
  const send = (message: any) => person.send({ to: Address.parse(message.address), value: message.value, body: coreCell(message.body) });
  const noAbort = (result: any) => result.transactions.every((tx: any) => tx.description.type !== 'generic' || !tx.description.aborted);
  return { blockchain, person, self: person.address.toRawString(), transport, walletOf, held, send, noAbort };
}

describe('the built-in DeDust pools', () => {
  it('DEDUST-01: every token is verified (or GRAM, or ATH); one pool per pair and type; the vaults are the factory\'s, derived from its proof; the captured pools are the list\'s', () => {
    const ATH = Address.parse(PLATHO_APP_CONFIG.ath.masterAddress).toRawString();
    for (const [id] of DEDUST_TOKENS) expect(isVerifiedJettonMaster(idOf(id)) || idOf(id) === ATH, id).toBe(true);
    const pairs = new Set<string>();
    for (const [, stable, token0, token1] of DEDUST_POOLS) {
      expect(token0).not.toBe(token1);
      const key = `${[token0, token1].sort().join('|')}|${stable}`;
      expect(pairs.has(key), 'one pool per pair and type').toBe(false);
      pairs.add(key);
    }
    expect(idOf(DEDUST_GRAM_VAULT)).toBe(derivedVault(GRAM));
    for (const [id, , , vault] of DEDUST_TOKENS) expect(idOf(vault), id).toBe(derivedVault(idOf(id)));
    const assetOf = (index: number) => (index === 0 ? GRAM : idOf(DEDUST_TOKENS[index - 1][0]));
    for (const [pool, stable, token0, token1] of DEDUST_POOLS) expect(idOf(pool), pool).toBe(derivedPool(stable, assetOf(token0), assetOf(token1)));
    expect([idOf(DEDUST_FACTORY), idOf(DEDUST_GRAM_VAULT)]).toEqual([at.factory, at.gramVault]);
    const usdt = dedustPairs(GRAM, at.usdtMaster).find((pair: any) => !pair.stable)!;
    expect([usdt.pool, usdt.offerVault, usdt.ask.decimals, usdt.ask.symbol]).toEqual([at.gramUsdtPool, at.gramVault, 6, 'USD₮']);
    expect(dedustPairs(at.usdtMaster, GRAM).find((pair: any) => !pair.stable)!.offerVault).toBe(at.usdtVault);
    const stable = dedustPairs(at.usdtMaster, at.jusdtMaster).find((pair: any) => pair.stable)!;
    expect([stable.pool, stable.offerVault]).toEqual([at.jusdtUsdtPool, at.usdtVault]);
    const ranks = dedustPairsFrom(GRAM).map((one: any) => one.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(dedustToken('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs')?.id, 'any spelling of an address').toBe(at.usdtMaster);
    expect(dedustPairs(GRAM, '0:' + '77'.repeat(32))).toEqual([]);
  });
});

describe('the messages, read back', () => {
  it('DEDUST-02: GRAM offered — the GRAM vault\'s swap, the amount and the work attached; a jetton — a transfer to its vault with the swap riding it; no referrer, no payloads', () => {
    const deadline = swapDeadline(1_800_000_000_000);
    const me = '0:' + '44'.repeat(32);
    const pair = dedustPairs(GRAM, at.usdtMaster).find((one: any) => !one.stable)!;
    const gram = buildDedustSwapMessage({ pair, amountIn: 5n * GRAM_NANO, minOut: 12_345n, recipient: me, deadline, queryId: 3n });
    expect([gram.address, gram.value]).toEqual([at.gramVault, 5n * GRAM_NANO + DEDUST_GRAM_GAS_NANOTONS]);
    const body = coreCell(gram.body).beginParse();
    expect([BigInt(body.loadUint(32)), body.loadUintBig(64), body.loadCoins()]).toEqual([DEDUST_NATIVE_SWAP_OPCODE, 3n, 5n * GRAM_NANO]);
    const step = (slice: any) => [slice.loadAddress().toRawString(), slice.loadBit(), slice.loadCoins(), slice.loadMaybeRef()];
    expect(step(body), 'one step: the pool, given_in, the least accepted, no next').toEqual([at.gramUsdtPool, false, 12_345n, null]);
    const params = (cell: any) => { const p = cell.beginParse(); const out = [p.loadUint(32), p.loadAddress().toRawString(), p.loadMaybeAddress(), p.loadMaybeRef(), p.loadMaybeRef(), p.remainingBits]; return out; };
    expect(params(body.loadRef()), 'the deadline, the wallet itself, no referrer, no payloads').toEqual([Number(deadline), me, null, null, null, 0]);
    expect([body.remainingBits, body.remainingRefs]).toEqual([0, 0]);
    const mine = '0:' + '55'.repeat(32);
    const back = dedustPairs(at.usdtMaster, GRAM).find((one: any) => !one.stable)!;
    const jetton = buildDedustSwapMessage({ pair: back, amountIn: 7n, minOut: 1n, recipient: me, deadline, jettonWallet: mine });
    expect([jetton.address, jetton.value]).toEqual([mine, DEDUST_JETTON_VALUE_NANOTONS]);
    const transfer = coreCell(jetton.body).beginParse();
    transfer.skip(32 + 64);
    expect([transfer.loadCoins(), transfer.loadAddress().toRawString(), transfer.loadAddress().toRawString(), transfer.loadBit(), transfer.loadCoins()])
      .toEqual([7n, at.usdtVault, me, false, DEDUST_JETTON_FORWARD_NANOTONS]);
    const payload = transfer.loadBit() ? transfer.loadRef().beginParse() : transfer;
    expect(BigInt(payload.loadUint(32))).toBe(DEDUST_JETTON_SWAP_OPCODE);
    expect(step(payload)).toEqual([at.gramUsdtPool, false, 1n, null]);
    expect(params(payload.loadRef())).toEqual([Number(deadline), me, null, null, null, 0]);
    expect(() => buildDedustSwapMessage({ pair: back, amountIn: 7n, minOut: 1n, recipient: me, deadline })).toThrow(/jetton wallet/);
    expect(() => buildDedustSwapMessage({ pair, amountIn: 7n, minOut: 0n, recipient: me, deadline })).toThrow(/least accepted/);
    expect(coreCell(dedustAssetCell(GRAM)).bits.length).toBe(4);
    const asset = coreCell(dedustAssetCell(at.usdtMaster)).beginParse();
    expect([asset.loadUint(4), asset.loadInt(8), `0:${asset.loadBuffer(32).toString('hex')}`]).toEqual([1, 0, at.usdtMaster]);
    expect(dedustAssetFromStack({ type: 'cell', value: Buffer.from(serializeBoc(dedustAssetCell(at.usdtMaster))).toString('base64') })).toBe(at.usdtMaster);
    expect(dedustAssetFromStack({ type: 'cell', value: Buffer.from(serializeBoc(dedustAssetCell(GRAM))).toString('base64') })).toBe(GRAM);
  });
});

describe('on DeDust\'s own code, copied from mainnet', () => {
  it('DEDUST-03: a volatile pool\'s quote here is its own estimate_swap_out, to the unit, both ways, from one nanoGRAM to a tenth of the pool', async () => {
    const { transport } = await chain();
    for (const pair of [dedustPairs(GRAM, at.usdtMaster).find((one: any) => !one.stable)!, dedustPairs(at.usdtMaster, GRAM).find((one: any) => !one.stable)!]) {
      const pool = await readDedustPool({ transport, pair });
      const reserveIn = pool.reserves[pair.offerSide];
      for (const amount of [1n, 999n, 1_000_003n, reserveIn / 10_000n + 7n, reserveIn / 1_000n, reserveIn / 100n + 13n, reserveIn / 10n]) {
        const mine = quoteDedustSwap({ pair, pool, amountIn: amount });
        const theirs = await estimateDedustSwap({ transport, pair, amountIn: amount });
        expect([mine.out, mine.fee], `${pair.offer.symbol} ${amount}`).toEqual([theirs.out, theirs.fee]);
      }
      for (const want of [1n, 1_234_567n]) {
        const give = dedustAmountInFor({ pair, pool, amountOut: want })!;
        expect(quoteDedustSwap({ pair, pool, amountIn: give }).out >= want).toBe(true);
        expect(quoteDedustSwap({ pair, pool, amountIn: give - 1n }).out < want).toBe(true);
      }
    }
    const pair = dedustPairs(GRAM, at.usdtMaster).find((one: any) => !one.stable)!;
    await expect(estimateDedustSwap({ transport, pair: { ...pair, ask: { ...pair.ask, id: at.jusdtMaster } }, amountIn: 5n })).rejects.toMatchObject({ code: 'SWAP_POOL_DISAGREES' });
    expect(() => quoteDedustSwap({ pair: { ...pair, stable: true }, pool: { reserves: [1n, 1n], feeNumerator: 1n, feeDenominator: 1000n }, amountIn: 1n })).toThrow(/stable/);
  });

  it('DEDUST-04: GRAM -> USD₮ and back: exactly what was quoted arrives, and of the work attached only the network\'s fee is spent', async () => {
    const { blockchain, person, self, transport, walletOf, held, send, noAbort } = await chain();
    const deadline = BigInt(blockchain.now! + 900);
    const pair = dedustPairs(GRAM, at.usdtMaster).find((one: any) => !one.stable)!;
    const amountIn = 10n * GRAM_NANO;
    const quote = quoteDedustSwap({ pair, pool: await readDedustPool({ transport, pair }), amountIn });
    expect(quote.out).toBeGreaterThan(0n);
    const before = await person.getBalance();
    const result = await send(buildDedustSwapMessage({ pair, amountIn, minOut: minimumOut(quote.out, 100), recipient: self, deadline }));
    expect(noAbort(result)).toBe(true);
    expect(await held(at.usdtMaster)).toBe(quote.out);
    const spent = before - await person.getBalance() - amountIn;
    expect(spent, 'the network\'s fee, the rest of the work returned').toBeLessThan(GRAM_NANO / 10n);
    expect(spent).toBeGreaterThan(0n);
    const usdt = await held(at.usdtMaster);
    const back = dedustPairs(at.usdtMaster, GRAM).find((one: any) => !one.stable)!;
    const returning = quoteDedustSwap({ pair: back, pool: await readDedustPool({ transport, pair: back }), amountIn: usdt });
    const before2 = await person.getBalance();
    const result2 = await send(buildDedustSwapMessage({ pair: back, amountIn: usdt, minOut: minimumOut(returning.out, 100), recipient: self, deadline,
      jettonWallet: (await walletOf(at.usdtMaster)).toRawString() }));
    expect(noAbort(result2)).toBe(true);
    expect(await held(at.usdtMaster)).toBe(0n);
    const gained = await person.getBalance() - before2;
    expect(returning.out - gained, 'only the network\'s fee').toBeLessThan(GRAM_NANO / 10n);
    expect(returning.out - gained).toBeGreaterThan(0n);
    console.log(`[DEDUST-04] GRAM->USD₮ fee ${spent} nanoGRAM of ${DEDUST_GRAM_GAS_NANOTONS} attached; USD₮->GRAM fee ${returning.out - gained} of ${DEDUST_JETTON_VALUE_NANOTONS}`);
  });

  it('DEDUST-05: above the quote or past the deadline, the GRAM comes back; a jetton below its least comes back too', async () => {
    const { blockchain, person, self, transport, walletOf, held, send } = await chain();
    const pair = dedustPairs(GRAM, at.usdtMaster).find((one: any) => !one.stable)!;
    const amountIn = 10n * GRAM_NANO;
    const quote = quoteDedustSwap({ pair, pool: await readDedustPool({ transport, pair }), amountIn });
    for (const [why, minOut, deadline] of [['above the quote', quote.out + 1n, blockchain.now! + 900], ['past the deadline', 1n, blockchain.now! - 1]] as const) {
      const before = await person.getBalance();
      await send(buildDedustSwapMessage({ pair, amountIn, minOut, recipient: self, deadline: BigInt(deadline) }));
      expect(before - await person.getBalance(), why).toBeLessThan(GRAM_NANO / 10n);
      expect(await held(at.usdtMaster), why).toBe(0n);
    }
    await send(buildDedustSwapMessage({ pair, amountIn, minOut: 1n, recipient: self, deadline: BigInt(blockchain.now! + 900) }));
    const usdt = await held(at.usdtMaster);
    const back = dedustPairs(at.usdtMaster, GRAM).find((one: any) => !one.stable)!;
    const out = quoteDedustSwap({ pair: back, pool: await readDedustPool({ transport, pair: back }), amountIn: usdt }).out;
    await send(buildDedustSwapMessage({ pair: back, amountIn: usdt, minOut: out + 1n, recipient: self, deadline: BigInt(blockchain.now! + 900),
      jettonWallet: (await walletOf(at.usdtMaster)).toRawString() }));
    expect(await held(at.usdtMaster), 'the USD₮ came back').toBe(usdt);
  });

  it('DEDUST-06: a stable pool (USD₮ -> jUSDT) pays exactly what its estimate_swap_out said; below that, the USD₮ comes back', async () => {
    const { blockchain, self, transport, walletOf, held, send, noAbort } = await chain();
    const deadline = BigInt(blockchain.now! + 900);
    await send(buildDedustSwapMessage({ pair: dedustPairs(GRAM, at.usdtMaster).find((one: any) => !one.stable)!, amountIn: 20n * GRAM_NANO, minOut: 1n, recipient: self, deadline }));
    const usdt = await held(at.usdtMaster);
    expect(usdt).toBeGreaterThan(0n);
    const pair = dedustPairs(at.usdtMaster, at.jusdtMaster).find((one: any) => one.stable)!;
    const half = usdt / 2n;
    const estimate = await estimateDedustSwap({ transport, pair, amountIn: half });
    expect(estimate.out).toBeGreaterThan(0n);
    const below = await send(buildDedustSwapMessage({ pair, amountIn: half, minOut: estimate.out + 1n, recipient: self, deadline, jettonWallet: (await walletOf(at.usdtMaster)).toRawString() }));
    expect(noAbort(below)).toBe(true);
    expect([await held(at.usdtMaster), await held(at.jusdtMaster)], 'refused: the USD₮ back, nothing else').toEqual([usdt, 0n]);
    const result = await send(buildDedustSwapMessage({ pair, amountIn: half, minOut: minimumOut(estimate.out, 50), recipient: self, deadline, jettonWallet: (await walletOf(at.usdtMaster)).toRawString() }));
    expect(noAbort(result)).toBe(true);
    expect([await held(at.usdtMaster), await held(at.jusdtMaster)]).toEqual([usdt - half, estimate.out]);
  });
});
