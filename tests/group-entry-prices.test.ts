import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Address, Cell, Dictionary, beginCell, contractAddress, storeMessageRelaxed } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { estimateAthWalletAttachedValueNanotons } from '../web/pwa-contract-transactions.mjs';
import { groupEntryPaymentMessages } from '../web/group-entry-fee.mjs';
import {
  ATH_BURN_ARRIVAL_MIN, ATH_ENTRY_LEG_COST, ATH_ENTRY_LEG_FLOOR, ATH_INTERNAL_TRANSFER_ACK_VALUE, ATH_INTERNAL_TRANSFER_ARRIVAL_MIN,
  ATH_JETTON_EXCESSES_MIN, ATH_TRANSFER_EXEC_RESERVE,
  ATH_WALLET_TOP_UP_OPCODE, buildAthWalletTopUpMessage, forwardFeeNanotons, gasFeeNanotons, groupEntryLegValues, groupEntryLegsSettledNanotons,
  groupEntryTopUpNanotons, groupEntryTopUpPossible, parseForwardPrices, parseGasPrices,
} from '../web/ath-request-reserve.mjs';
import { code, sourceBlock } from './helpers/source';


const WALLET_TACT = readFileSync('contracts/ATHWallet.tact', 'utf8');
const MASTER_TACT = readFileSync('contracts/ATHMaster.tact', 'utf8');
const constIn = (source: string, name: string) => BigInt(new RegExp(`const ${name}: Int = (\\d+);`).exec(source)![1]);
const fixture = (label: string) => new Address(0, createHash('sha256').update(`PLATHO.V1.GENTRY.${label}`).digest());
const MASTER_TOP_UP_OPCODE = 0x4154480a;

function configParams(bc: Blockchain) { return Dictionary.loadDirect(Dictionary.Keys.Int(32), Dictionary.Values.Cell(), bc.config); }
function scalePrices(bc: Blockchain, kGas: bigint, kFwd: bigint) {
  const p = configParams(bc);
  const f = p.get(25)!.beginParse();
  const ftag = f.loadUint(8); const lump = f.loadUintBig(64); const bit = f.loadUintBig(64); const cell = f.loadUintBig(64);
  const ihr = f.loadUint(32); const first = f.loadUint(16); const next = f.loadUint(16);
  p.set(25, beginCell().storeUint(ftag, 8).storeUint(lump * kFwd, 64).storeUint(bit * kFwd, 64).storeUint(cell * kFwd, 64).storeUint(ihr, 32).storeUint(first, 16).storeUint(next, 16).endCell());
  const g = p.get(21)!.beginParse();
  const gtag = g.loadUint(8); const flatLimit = g.loadUintBig(64); const flatPrice = g.loadUintBig(64); const itag = g.loadUint(8); const gasPrice = g.loadUintBig(64);
  let b = beginCell().storeUint(gtag, 8).storeUint(flatLimit, 64).storeUint(flatPrice * kGas, 64).storeUint(itag, 8).storeUint(gasPrice * kGas, 64);
  for (let i = 0; i < 6; i += 1) b = b.storeUint(g.loadUintBig(64), 64);
  p.set(21, b.endCell());
  bc.setConfig(beginCell().storeDictDirect(p).endCell());
}
const pricesOf = (bc: Blockchain) => ({ gas: parseGasPrices(configParams(bc).get(21)!), fwd: parseForwardPrices(configParams(bc).get(25)!) });

function shapeOf(message: any) {
  const root = beginCell().store(storeMessageRelaxed(message)).endCell();
  const seen = new Set<string>(); let cells = 0n; let bits = 0n;
  const walk = (c: Cell) => { for (const r of c.refs) { const h = r.hash().toString('hex'); if (seen.has(h)) continue; seen.add(h); cells += 1n; bits += BigInt(r.bits.length); walk(r); } };
  walk(root);
  return { cells, bits };
}

async function world(kGas = 1n, kFwd = 1n, ton = 25_000_000n) {
  const bc = await Blockchain.create();
  bc.now = 1_791_100_000;
  const payer = await bc.treasury('gentry-payer');
  const owner = await bc.treasury('gentry-owner');
  const masterInit = await ATHMaster.init(fixture('TREASURY'), beginCell().endCell(), 7n);
  const master = contractAddress(0, masterInit);
  await bc.setShardAccount(master, createShardAccount({ address: master, code: masterInit.code, data: masterInit.data, balance: 1_000_000_000n, workchain: 0 }));
  await payer.send({ to: master, value: 50_000_000n, body: beginCell().storeUint(MASTER_TOP_UP_OPCODE, 32).endCell(), bounce: false } as any);
  const zeroInit = await ATHWallet.init(0n, payer.address, master);
  const dataInit = await ATHWallet.init(1_000_000_000_000n, payer.address, master);
  const wallet = contractAddress(0, zeroInit);
  await bc.setShardAccount(wallet, createShardAccount({ address: wallet, code: zeroInit.code, data: dataInit.data, balance: 30_000_000n, workchain: 0 }));
  await payer.send({ to: wallet, value: 10_000_000n, body: beginCell().storeUint(ATH_WALLET_TOP_UP_OPCODE, 32).endCell(), bounce: false } as any);
  const state: any = (await bc.getContract(wallet)).accountState;
  await bc.setShardAccount(wallet, createShardAccount({ address: wallet, code: state.state.code, data: state.state.data, balance: ton, workchain: 0 }));
  if (kGas !== 1n || kFwd !== 1n) scalePrices(bc, kGas, kFwd);
  const ownerAth = contractAddress(0, await ATHWallet.init(0n, owner.address, master));
  return { bc, payer, owner, master, wallet, ownerAth };
}
type World = Awaited<ReturnType<typeof world>>;
const txsTo = (res: any, at: Address) => res.transactions.filter((t: any) => t.inMessage?.info?.dest?.equals?.(at));
const ok = (tx: any) => !!tx && tx.description.computePhase.type === 'vm' && tx.description.computePhase.exitCode === 0 && tx.description.actionPhase?.success === true;

const legsFor = (w: World, values: any = null) => groupEntryPaymentMessages({
  athWalletAddress: w.wallet.toRawString(), payerWallet: w.payer.address.toRawString(), ownerWallet: w.owner.address.toRawString(),
  entryFee: 10_000_000_000n, queryId: 7n, ...(values ? { values } : {}),
});
const sendLeg = (w: World, leg: any) => w.payer.send({ to: w.wallet, value: BigInt(leg.amount), body: Cell.fromBase64(leg.payload), bounce: true } as any);

async function payDoor(w: World, priced: boolean) {
  const prices = pricesOf(w.bc);
  const walletTon = (await w.bc.getContract(w.wallet)).balance;
  const values = priced ? groupEntryLegValues(prices) : null;
  const topUp = priced ? groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices, walletTon, rentOwed: 0n }) : 0n;
  if (topUp > 0n) {
    const message = buildAthWalletTopUpMessage(w.wallet.toRawString(), topUp);
    await w.payer.send({ to: w.wallet, value: message.amount, body: Cell.fromBase64(message.payload), bounce: false } as any);
  }
  const [ownerLeg, burnLeg] = legsFor(w, values);
  const r1: any = await sendLeg(w, ownerLeg);
  const r2: any = await sendLeg(w, burnLeg);
  const atWallet = txsTo(r1, w.wallet);
  return {
    values, topUp,
    ownerSent: atWallet[0], recipient: txsTo(r1, w.ownerAth)[0],
    back: atWallet[1] ?? null,
    burnSent: txsTo(r2, w.wallet)[0], master: txsTo(r2, w.master)[0],
  };
}

describe('GEP - the paid door\'s two legs at the network\'s prices (client audit round 11, money-2)', () => {
  it('GEP-01: the gates and the measured costs are the frozen contracts\' own, and the client\'s formula equals the chain to the nanoton', async () => {
    expect(ATH_INTERNAL_TRANSFER_ARRIVAL_MIN, 'gate 14212').toBe(constIn(WALLET_TACT, 'ATH_INTERNAL_TRANSFER_EXEC_RESERVE')
      + constIn(WALLET_TACT, 'ATH_INTERNAL_TRANSFER_ACK_VALUE') + constIn(WALLET_TACT, 'ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE')
      + constIn(WALLET_TACT, 'ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT'));
    expect(WALLET_TACT).toContain('throwUnless(14212, context().value >= ATH_INTERNAL_TRANSFER_EXEC_RESERVE + ATH_INTERNAL_TRANSFER_ACK_VALUE + ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE + ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT);');
    expect(MASTER_TACT).toContain('import "./ATHWallet.tact";');
    expect(ATH_BURN_ARRIVAL_MIN, 'gate 14103').toBe(constIn(WALLET_TACT, 'ATH_BURN_NOTIFICATION_EXEC_RESERVE'));
    expect(MASTER_TACT).toContain('throwUnless(14103, context().value >= ATH_BURN_NOTIFICATION_EXEC_RESERVE);');
    expect(ATH_TRANSFER_EXEC_RESERVE, 'the keep both handlers take').toBe(constIn(WALLET_TACT, 'ATH_OWNER_REQUEST_EXEC_RESERVE'));
    expect(ATH_INTERNAL_TRANSFER_ACK_VALUE, "the ack the owner's leg sends home").toBe(constIn(WALLET_TACT, 'ATH_INTERNAL_TRANSFER_ACK_VALUE'));
    expect(ATH_JETTON_EXCESSES_MIN, 'and the change, from this much up').toBe(constIn(WALLET_TACT, 'JETTON_EXCESSES_VALUE'));
    expect(ATH_ENTRY_LEG_FLOOR).toEqual({
      owner: estimateAthWalletAttachedValueNanotons('ATHTransferRequest'), burn: estimateAthWalletAttachedValueNanotons('ATHBurn'),
    });

    const w = await world();
    const prices = pricesOf(w.bc);
    const [ownerLeg, burnLeg] = legsFor(w);
    const r1: any = await sendLeg(w, ownerLeg);
    const sent = txsTo(r1, w.wallet)[0];
    const onward = shapeOf(sent.outMessages.get(0));
    expect({ gas: BigInt(sent.description.computePhase.gasUsed), onwardCells: onward.cells, onwardBits: onward.bits }).toEqual({ ...ATH_ENTRY_LEG_COST.owner });
    expect(gasFeeNanotons(ATH_ENTRY_LEG_COST.owner.gas, prices.gas)).toBe(BigInt(sent.description.computePhase.gasFees));
    expect(forwardFeeNanotons(onward.cells, onward.bits, prices.fwd)).toBe(BigInt(sent.description.actionPhase.totalFwdFees));
    expect(ok(txsTo(r1, w.ownerAth)[0]), 'credited').toBe(true);
    const r2: any = await sendLeg(w, burnLeg);
    const burn = txsTo(r2, w.wallet)[0];
    const notification = shapeOf(burn.outMessages.get(0));
    const master = txsTo(r2, w.master)[0];
    const finalized = shapeOf(master.outMessages.get(0));
    expect({
      gas: BigInt(burn.description.computePhase.gasUsed), notifyCells: notification.cells, notifyBits: notification.bits,
      masterGas: BigInt(master.description.computePhase.gasUsed), finalCells: finalized.cells, finalBits: finalized.bits,
    }).toEqual({ ...ATH_ENTRY_LEG_COST.burn });
    expect(gasFeeNanotons(ATH_ENTRY_LEG_COST.burn.gas, prices.gas)).toBe(BigInt(burn.description.computePhase.gasFees));
    expect(forwardFeeNanotons(notification.cells, notification.bits, prices.fwd)).toBe(BigInt(burn.description.actionPhase.totalFwdFees));
    expect(gasFeeNanotons(ATH_ENTRY_LEG_COST.burn.masterGas, prices.gas)).toBe(BigInt(master.description.computePhase.gasFees));
    expect(forwardFeeNanotons(finalized.cells, finalized.bits, prices.fwd)).toBe(BigInt(master.description.actionPhase.totalFwdFees));
    expect(ok(master), 'burned').toBe(true);
  }, 300_000);

  it('GEP-02: the old fixed legs fail the way the audit said - the owner\'s half bounces from 2x forward while the burn lands, the master starves from 4x, an empty wallet parks the leg from 3x', async () => {
    const twoFwd = await payDoor(await world(1n, 2n), false);
    expect(twoFwd.recipient.description.computePhase.exitCode, '2x forward: under gate 14212').toBe(14212);
    expect(twoFwd.back?.inMessage?.info?.bounced, 'the owner\'s half bounced home').toBe(true);
    expect(ok(twoFwd.master), 'while the burn landed: half the fee destroyed, nobody admitted').toBe(true);
    const four = await payDoor(await world(4n, 4n), false);
    expect(four.master.description.computePhase.exitCode, '4x: the master runs out of gas').toBe(-14);
    expect(four.master.outMessages.size, 'and nothing is left to bounce').toBe(0);
    const empty = await payDoor(await world(3n, 3n, 0n), false);
    expect(empty.ownerSent.description.actionPhase.resultCode, 'an empty wallet at 3x: the action phase fails').toBe(37);
    expect(empty.recipient, 'no leg left the wallet').toBeUndefined();
  }, 300_000);

  it('GEP-03: the client\'s legs and top-up land at every price level up to 8x, full wallet or empty; at today\'s prices they are today\'s legs and no top-up', async () => {
    const outcomes: string[] = [];
    for (const [kGas, kFwd] of [[1n, 1n], [1n, 2n], [2n, 2n], [3n, 1n], [3n, 3n], [1n, 4n], [4n, 4n], [6n, 6n], [8n, 8n]] as const) {
      for (const ton of [25_000_000n, 0n]) {
        const paid = await payDoor(await world(kGas, kFwd, ton), true);
        const label = `gas ${kGas}x fwd ${kFwd}x, wallet ${ton}`;
        outcomes.push(`${label}: owner ${paid.values!.owner} burn ${paid.values!.burn} topUp ${paid.topUp}`);
        expect(ok(paid.ownerSent), `${label}: the owner's leg left the wallet`).toBe(true);
        expect(ok(paid.recipient), `${label}: and was credited`).toBe(true);
        expect(paid.back?.inMessage?.info?.bounced, `${label}: what came back is the source ack, not a bounce`).toBe(false);
        expect(ok(paid.back), `${label}: and the ack ran`).toBe(true);
        expect(ok(paid.burnSent), `${label}: the burn left the wallet`).toBe(true);
        expect(ok(paid.master), `${label}: and the master took it off the supply`).toBe(true);
        if (kGas === 1n && kFwd === 1n) {
          expect(paid.values, 'today: the legs are what they were').toEqual({ ...ATH_ENTRY_LEG_FLOOR });
          expect(paid.topUp, 'today: no top-up, full wallet or empty').toBe(0n);
        }
      }
    }
    void outcomes;
  }, 900_000);

  it('GEP-08: what the legs leave gone from the payer once everything has come home is the client\'s figure, to the nanoton', async () => {
    for (const [kGas, kFwd] of [[1n, 1n], [1n, 2n], [3n, 3n], [6n, 6n]] as const) {
      const w = await world(kGas, kFwd);
      const prices = pricesOf(w.bc);
      const values = groupEntryLegValues(prices);
      const [ownerLeg, burnLeg] = legsFor(w, values);
      const results: any[] = [await sendLeg(w, ownerLeg), await sendLeg(w, burnLeg)];
      const returned = results.flatMap((res) => txsTo(res, w.payer.address)).filter((tx: any) => tx.inMessage.info.type === 'internal')
        .reduce((sum: bigint, tx: any) => sum + BigInt(tx.inMessage.info.value.coins), 0n);
      expect(values.owner + values.burn - returned, `gas ${kGas}x fwd ${kFwd}x`).toBe(groupEntryLegsSettledNanotons({ prices, values }));
      expect(groupEntryLegsSettledNanotons({ prices, legs: ['burn'], values }) + groupEntryLegsSettledNanotons({ prices, legs: ['owner'], values }))
        .toBe(groupEntryLegsSettledNanotons({ prices, values }));
    }
  }, 300_000);

  it('GEP-04: the pricing is pure and conservative - never below the gates, no table means today, the top-up follows the running balance leg by leg', () => {
    const today = { gas: { flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n }, fwd: { lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n } };
    const scaled = (k: bigint) => ({ gas: { ...today.gas, flatPrice: today.gas.flatPrice * k, gasPrice: today.gas.gasPrice * k },
      fwd: { lump: today.fwd.lump * k, bit: today.fwd.bit * k, cell: today.fwd.cell * k } });
    expect(groupEntryLegValues(today)).toEqual({ ...ATH_ENTRY_LEG_FLOOR });
    expect(groupEntryLegValues(null), 'no table: today').toEqual({ ...ATH_ENTRY_LEG_FLOOR });
    expect(groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices: null }), 'no table: no top-up').toBe(0n);
    for (const k of [2n, 3n, 5n, 10n]) {
      const values = groupEntryLegValues(scaled(k));
      const carriage = forwardFeeNanotons(ATH_ENTRY_LEG_COST.owner.onwardCells, ATH_ENTRY_LEG_COST.owner.onwardBits, scaled(k).fwd);
      expect(values.owner - ATH_TRANSFER_EXEC_RESERVE - carriage >= ATH_INTERNAL_TRANSFER_ARRIVAL_MIN + carriage / 5n, `${k}x: the owner's leg clears 14212 with margin`).toBe(true);
    }
    expect(groupEntryLegValues(scaled(2n)).burn).toBe(ATH_ENTRY_LEG_FLOOR.burn);
    expect(groupEntryLegValues(scaled(3n)).burn > ATH_ENTRY_LEG_FLOOR.burn).toBe(true);
    expect(groupEntryTopUpPossible(['owner', 'burn'], today)).toBe(false);
    expect(groupEntryTopUpPossible(['owner', 'burn'], scaled(2n)), 'at 2x an empty wallet is short').toBe(true);
    const empty = groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices: scaled(3n), walletTon: 0n });
    expect(empty > 0n).toBe(true);
    expect(groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices: scaled(3n), walletTon: 25_000_000n }), 'a wallet with TON carries it').toBe(0n);
    expect(groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices: scaled(3n), walletTon: 25_000_000n, rentOwed: 25_000_000n }), 'unless rent took it').toBe(empty);
    expect(groupEntryTopUpNanotons({ legs: ['burn'], prices: scaled(3n) }) < empty, 'one leg needs less than two').toBe(true);
    expect(() => groupEntryTopUpNanotons({ legs: ['stake'], prices: today })).toThrow(/no measured group entry leg/);
  });

  it('GEP-05: the legs never go below their gates, whatever value a caller passes', () => {
    const base = { athWalletAddress: '0:' + '1'.repeat(64), payerWallet: '0:' + '2'.repeat(64), ownerWallet: '0:' + '3'.repeat(64), entryFee: 10n, queryId: 1n };
    const amounts = (values: any) => groupEntryPaymentMessages({ ...base, values }).map((m: any) => BigInt(m.amount));
    expect(amounts(null)).toEqual([ATH_ENTRY_LEG_FLOOR.owner, ATH_ENTRY_LEG_FLOOR.burn]);
    expect(amounts({ owner: 1n, burn: 1n }), 'below the gates: the gates').toEqual([ATH_ENTRY_LEG_FLOOR.owner, ATH_ENTRY_LEG_FLOOR.burn]);
    expect(amounts({ owner: 50_000_000n, burn: 6_000_000n })).toEqual([50_000_000n, 6_000_000n]);
    expect(groupEntryPaymentMessages({ ...base, legs: { owner: false, burn: true }, values: { owner: 50_000_000n, burn: 6_000_000n } }).map((m: any) => BigInt(m.amount)))
      .toEqual([6_000_000n]);
  });

  it('GEP-06: the app prices the legs live before it builds them, tops the ATH wallet up AHEAD of them, and refuses an unpriced payment before signing', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const pay = code(sourceBlock(app, 'async function payGroupEntryLocked('));
    expect(pay).toContain('const { values, topUp } = await priceGroupEntryLegs(athWalletAddress, legs);');
    expect(pay).toContain('const messages = [...(topUp ? [topUp] : []), ...groupEntryPaymentMessages({');
    expect(pay).toContain('queryId: groupEntryQueryId(groupId, groupKey), legs, values,');
    expect(pay.indexOf('priceGroupEntryLegs('), 'priced before the wallet\'s GRAM is asserted').toBeLessThan(pay.indexOf('assertWalletGramAtLeast('));
    const lift = (env: Record<string, any>) => {
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      return new Function(...names, `${sourceBlock(app, 'async function priceGroupEntryLegs(')}\nreturn priceGroupEntryLegs;`)(...names.map((n) => env[n]));
    };
    const today = { gas: { flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n }, fwd: { lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n } };
    const seven = { gas: { ...today.gas, flatPrice: today.gas.flatPrice * 7n, gasPrice: today.gas.gasPrice * 7n },
      fwd: { lump: today.fwd.lump * 7n, bit: today.fwd.bit * 7n, cell: today.fwd.cell * 7n } };
    const funded: string[] = [];
    const env = (prices: any, overrides: Record<string, any> = {}) => ({
      readNetworkPrices: async () => prices, groupEntryLegValues, groupEntryTopUpNanotons, groupEntryTopUpPossible, buildAthWalletTopUpMessage,
      readAthWalletFunding: async (address: string) => { funded.push(address); return { ton: 0n, rentOwed: 0n }; },
      athUnpricedRefusal: (error: any) => Object.assign(new Error('unpriced'), { code: 'ATH_REQUEST_UNPRICED', cause: error }),
      ...overrides,
    });
    const both = { owner: true, burn: true };
    expect(await lift(env(today))('ATHW', both)).toEqual({ values: { ...ATH_ENTRY_LEG_FLOOR }, topUp: null });
    expect(funded, 'today: the wallet is not even read').toEqual([]);
    const priced = await lift(env(seven))('ATHW', both);
    expect(funded).toEqual(['ATHW']);
    expect(priced.values).toEqual(groupEntryLegValues(seven));
    expect(priced.topUp).toMatchObject({ address: 'ATHW', bounce: false, amount: groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices: seven, walletTon: 0n }) });
    const burnOnly = await lift(env(seven))('ATHW', { owner: false, burn: true });
    expect(burnOnly.topUp.amount).toBe(groupEntryTopUpNanotons({ legs: ['burn'], prices: seven, walletTon: 0n }));
    const refused = await lift(env(null, { readNetworkPrices: async () => { throw Object.assign(new Error('429'), { code: 'NETWORK_PRICES_UNREAD' }); } }))('ATHW', both)
      .then(() => null, (error: any) => error);
    expect(refused?.code).toBe('ATH_REQUEST_UNPRICED');
  });

  it('GEP-07: the dialog\'s figure is the legs at the held prices, with what an empty wallet would need - today\'s legs without a table', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const lift = (networkPricesCache: any) => new Function('networkPricesCache', 'groupEntryLegValues', 'groupEntryTopUpNanotons', 'walletSendFeeReserveNanotons',
      `${sourceBlock(app, 'function groupEntryPaymentGramNanotons(')}\nreturn groupEntryPaymentGramNanotons;`)(
      networkPricesCache, groupEntryLegValues, groupEntryTopUpNanotons, (sizes: number[]) => BigInt(sizes.length) * 1_000n);
    expect(lift(null)()).toBe(ATH_ENTRY_LEG_FLOOR.owner + ATH_ENTRY_LEG_FLOOR.burn + 2_000n);
    const today = { gas: { flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n }, fwd: { lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n } };
    const five = { gas: { ...today.gas, flatPrice: today.gas.flatPrice * 5n, gasPrice: today.gas.gasPrice * 5n },
      fwd: { lump: today.fwd.lump * 5n, bit: today.fwd.bit * 5n, cell: today.fwd.cell * 5n } };
    const values = groupEntryLegValues(five);
    const topUp = groupEntryTopUpNanotons({ legs: ['owner', 'burn'], prices: five });
    expect(topUp > 0n).toBe(true);
    expect(lift({ prices: five, at: 0 })()).toBe(values.owner + values.burn + topUp + 3_000n);
  });
});
