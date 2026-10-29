import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Address, Cell, Dictionary, beginCell, contractAddress, storeMessageRelaxed } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { buildAthWalletMessageBody } from '../web/pwa-contract-transactions.mjs';
import {
  ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE, ATH_REQUEST_COST, ATH_TOP_UP_RECEIVE_GAS, ATH_WALLET_RENT_PER_YEAR, ATH_WALLET_TOP_UP_OPCODE,
  athRequestCostNanotons, athRequestTopUpNanotons, athWalletRentOwedNanotons, buildAthWalletTopUpMessage,
  forwardFeeNanotons, gasFeeNanotons, parseForwardPrices, parseGasPrices,
} from '../web/ath-request-reserve.mjs';
import { createTonCenterV3Transport, deriveToncenterV2Endpoint } from '../web/ton-rpc-transport.mjs';
import { networkPricesWithin } from '../web/fee-vault.mjs';
import { code, sourceBlock } from './helpers/source';


const TACT = readFileSync('contracts/ATHWallet.tact', 'utf8');
const constOf = (name: string) => BigInt(new RegExp(`const ${name}: Int = (\\d+);`).exec(TACT)![1]);
const fixture = (label: string) => new Address(0, createHash('sha256').update(`PLATHO.V1.ATHREQ.${label}`).digest());
const RECIPIENT = fixture('RECIPIENT');
const NAME16 = new TextEncoder().encode('abcdefghijklmnop');

function configParams(bc: Blockchain) { return Dictionary.loadDirect(Dictionary.Keys.Int(32), Dictionary.Values.Cell(), bc.config); }
function scalePrices(bc: Blockchain, k: bigint) {
  const p = configParams(bc);
  const f = p.get(25)!.beginParse();
  const ftag = f.loadUint(8); const lump = f.loadUintBig(64); const bit = f.loadUintBig(64); const cell = f.loadUintBig(64);
  const ihr = f.loadUint(32); const first = f.loadUint(16); const next = f.loadUint(16);
  p.set(25, beginCell().storeUint(ftag, 8).storeUint(lump * k, 64).storeUint(bit * k, 64).storeUint(cell * k, 64).storeUint(ihr, 32).storeUint(first, 16).storeUint(next, 16).endCell());
  const g = p.get(21)!.beginParse();
  const gtag = g.loadUint(8); const flatLimit = g.loadUintBig(64); const flatPrice = g.loadUintBig(64); const itag = g.loadUint(8); const gasPrice = g.loadUintBig(64);
  let b = beginCell().storeUint(gtag, 8).storeUint(flatLimit, 64).storeUint(flatPrice * k, 64).storeUint(itag, 8).storeUint(gasPrice * k, 64);
  for (let i = 0; i < 6; i += 1) b = b.storeUint(g.loadUintBig(64), 64);
  p.set(21, b.endCell());
  bc.setConfig(beginCell().storeDictDirect(p).endCell());
}
const pricesOf = (bc: Blockchain) => ({ gas: parseGasPrices(configParams(bc).get(21)!), fwd: parseForwardPrices(configParams(bc).get(25)!) });

type Lane = 'notify' | 'mint' | 'avatar';
function requestFor(lane: Lane, owner: Address) {
  const common = { query_id: 7n, amount: 100_000_000_000n, recipient: RECIPIENT.toRawString(), response_destination: owner.toRawString() };
  const registryDown = (notify: bigint) => notify + constOf('ATH_REGISTRY_RESPONSE_ACK_VALUE') + constOf('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE')
    + constOf('ATH_TRANSFER_NOTIFY_EXEC_RESERVE') + constOf('ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT') + constOf('ATH_REGISTRY_PROFILE_AVATAR_FWD_FEE_ALLOWANCE');
  if (lane === 'notify') {
    const notify = 45_000_000n;
    const down = notify + constOf('ATH_TRANSFER_NOTIFY_ACK_VALUE') + constOf('ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE')
      + constOf('ATH_TRANSFER_NOTIFY_EXEC_RESERVE') + constOf('ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT');
    return { body: buildAthWalletMessageBody('ATHTransferRequestWithNotify', { ...common, notify_destination: RECIPIENT.toRawString(), notify_value: notify }), required: down + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE };
  }
  const notify = 66_000_000n;
  if (lane === 'mint') {
    return { body: buildAthWalletMessageBody('ATHTransferRequestRegistryMintUsername', { ...common, notify_value: notify, owner_wallet: owner.toRawString(), username: NAME16 }), required: registryDown(notify) + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE };
  }
  return {
    body: buildAthWalletMessageBody('ATHTransferRequestRegistryProfileAvatar', { ...common, notify_value: notify, owner_wallet: owner.toRawString(),
      avatar_hash: (1n << 255n) + 7n, avatar_entry_id: 0n, avatar_stream_id: (1n << 127n) + 3n, avatar_part_count: 2n, media_format: 1n }),
    required: registryDown(notify) + ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE,
  };
}

async function world(k: bigint, ton: bigint, now = 1_791_100_000) {
  const bc = await Blockchain.create();
  bc.now = now;
  if (k !== 1n) scalePrices(bc, k);
  const payer = await bc.treasury('athreq-payer');
  const master = fixture('MASTER');
  const zeroInit = await ATHWallet.init(0n, payer.address, master);
  const dataInit = await ATHWallet.init(1_000_000_000_000n, payer.address, master);
  const wallet = contractAddress(0, zeroInit);
  await bc.setShardAccount(wallet, createShardAccount({ address: wallet, code: zeroInit.code, data: dataInit.data, balance: ton, workchain: 0 }));
  const txTo = (res: any) => res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(wallet));
  return { bc, payer, wallet, txTo };
}
const send = (w: any, lane: Lane) => {
  const { body, required } = requestFor(lane, w.payer.address);
  return w.payer.send({ to: w.wallet, value: required + 150_000_000n, body: Cell.fromBase64(body), bounce: true } as any);
};

describe('ATHREQ — the frozen ATH wallet, funded for the request it is asked to send (T6-2)', () => {
  it('ATHREQ-01: the reserve and the top-up opcode are the contract\'s', () => {
    expect(ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE).toBe(constOf('ATH_NOTIFY_OWNER_REQUEST_EXEC_RESERVE'));
    expect(TACT).toContain(`message(0x${ATH_WALLET_TOP_UP_OPCODE.toString(16)}) ATHWalletTopUpStorageReserve {}`);
    const message = buildAthWalletTopUpMessage(RECIPIENT.toRawString(), 1_000n);
    expect(message.bounce, 'non-bounceable: the TON lands whatever the receive does').toBe(false);
    expect(Cell.fromBase64(message.payload).beginParse().loadUint(32)).toBe(ATH_WALLET_TOP_UP_OPCODE);
  });

  it('ATHREQ-02: the measured cost of every lane, and the client\'s formula, equal the frozen wallet\'s to the nanoton', async () => {
    for (const lane of ['notify', 'mint', 'avatar'] as const) {
      const w = await world(1n, 3_000_000_000n);
      const tx: any = w.txTo(await send(w, lane));
      const d = tx.description;
      expect([d.computePhase.exitCode, d.actionPhase.success], `${lane} ran`).toEqual([0, true]);
      const onward = tx.outMessages.get(0);
      const root = beginCell().store(storeMessageRelaxed(onward)).endCell();
      const seen = new Set<string>(); let cells = 0n; let bits = 0n;
      const walk = (c: Cell) => { for (const r of c.refs) { const h = r.hash().toString('hex'); if (seen.has(h)) continue; seen.add(h); cells += 1n; bits += BigInt(r.bits.length); walk(r); } };
      walk(root);
      expect({ gas: BigInt(d.computePhase.gasUsed), cells, bits }, `${lane}: the measured cost`).toEqual({ ...ATH_REQUEST_COST[lane] });
      const prices = pricesOf(w.bc);
      expect(gasFeeNanotons(ATH_REQUEST_COST[lane].gas, prices.gas), `${lane}: GETGASFEE`).toBe(BigInt(d.computePhase.gasFees));
      const onwardFwd = BigInt(d.actionPhase.totalFwdFees) - forwardFeeNanotons(0n, 0n, prices.fwd);
      expect(forwardFeeNanotons(cells, bits, prices.fwd), `${lane}: GETFORWARDFEE`).toBe(onwardFwd);
    }
  }, 300_000);

  it('ATHREQ-03: a 25,000,000 wallet fails the request from 7x — and the client\'s top-up, sent first, clears it at every level; at today\'s prices it is nothing', async () => {
    const outcomes: string[] = [];
    for (const k of [1n, 4n, 7n, 10n]) {
      for (const lane of ['mint', 'avatar'] as const) {
        const bare = await world(k, 25_000_000n);
        const failed: any = bare.txTo(await send(bare, lane));
        const w = await world(k, 25_000_000n);
        const walletTon = (await w.bc.getContract(w.wallet)).balance;
        const topUp = athRequestTopUpNanotons({ lane, prices: pricesOf(w.bc), walletTon, rentOwed: 0n });
        if (topUp > 0n) {
          await w.payer.send({ to: w.wallet, value: topUp, body: beginCell().storeUint(ATH_WALLET_TOP_UP_OPCODE, 32).endCell(), bounce: false } as any);
        }
        const tx: any = w.txTo(await send(w, lane));
        outcomes.push(`${k}x ${lane}: bare ${failed.description.actionPhase.success ? 'ok' : `exit ${failed.description.actionPhase.resultCode}`}, topUp ${topUp}, with ${tx.description.actionPhase.success ? 'ok' : 'FAIL'}`);
        expect(tx.description.actionPhase.success, `${k}x ${lane}: with the client's top-up (${topUp})`).toBe(true);
        if (k === 1n) expect(topUp, 'today: no top-up, the transfer is what it was').toBe(0n);
        if (k >= 7n) expect(failed.description.actionPhase.resultCode, `${k}x ${lane}: without it, the audit's failure`).toBe(37);
      }
    }
    void outcomes;
  }, 600_000);

  it('ATHREQ-04: the rent a wallet owes is counted where it bites — its own TON; a due it cannot pay lands on the refunded excess', async () => {
    expect(ATH_WALLET_RENT_PER_YEAR >= 5_781_633n).toBe(true);
    expect(athWalletRentOwedNanotons({ lastTransactionAt: 0, nowSec: 365 * 86_400 })).toBe(ATH_WALLET_RENT_PER_YEAR);
    expect(athWalletRentOwedNanotons({ lastTransactionAt: null, nowSec: 1 }), 'no transaction read: a year assumed').toBe(ATH_WALLET_RENT_PER_YEAR);
    const start = 1_791_100_000;
    const idle = async (k: bigint, ton: bigint, years: number, funded: boolean) => {
      const w = await world(k, ton, start);
      await w.payer.send({ to: w.wallet, value: 10_000_000n, body: beginCell().storeUint(ATH_WALLET_TOP_UP_OPCODE, 32).endCell(), bounce: false } as any);
      const later = start + Math.round(years * 365 * 86_400);
      w.bc.now = later;
      const walletTon = (await w.bc.getContract(w.wallet)).balance;
      const rentOwed = athWalletRentOwedNanotons({ lastTransactionAt: start, nowSec: later });
      const topUp = athRequestTopUpNanotons({ lane: 'avatar', prices: pricesOf(w.bc), walletTon, rentOwed });
      if (funded && topUp > 0n) await w.payer.send({ to: w.wallet, value: topUp, body: beginCell().storeUint(ATH_WALLET_TOP_UP_OPCODE, 32).endCell(), bounce: false } as any);
      const tx: any = w.txTo(await send(w, 'avatar'));
      return { topUp, ok: tx.description.actionPhase?.success === true, rentOwed, walletTon, prices: pricesOf(w.bc) };
    };
    const poor = await idle(1n, 0n, 2, false);
    expect([poor.topUp, poor.ok], 'the reserve is intact').toEqual([0n, true]);
    const unfunded = await idle(4n, 25_000_000n, 5, false);
    expect(unfunded.ok, 'unfunded, the rent-drained wallet fails at 4x').toBe(false);
    expect(athRequestTopUpNanotons({ lane: 'avatar', prices: unfunded.prices, walletTon: unfunded.walletTon, rentOwed: 0n }),
      'without the rent the client would have seen no shortfall').toBe(0n);
    const funded = await idle(4n, 25_000_000n, 5, true);
    expect(funded.topUp > 0n && funded.ok, `funded with ${funded.topUp}, it lands`).toBe(true);
  }, 300_000);

  it('ATHREQ-05: the top-up\'s own receive and the cost model agree with each other', () => {
    const today = { gas: { flatLimit: 100n, flatPrice: 6_667n, gasPrice: 4_369_067n }, fwd: { lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n } };
    expect(gasFeeNanotons(ATH_TOP_UP_RECEIVE_GAS, today.gas)).toBe(307_334n);
    expect(athRequestCostNanotons('avatar', today)).toBe(5_555_068n);
    expect(athRequestTopUpNanotons({ lane: 'avatar', prices: today, walletTon: 0n, rentOwed: 0n }), 'the reserve carries it today').toBe(0n);
  });

  it('ATHREQ-06: the prices come from toncenter v2 getConfigParam, through the one shared queue', async () => {
    expect(deriveToncenterV2Endpoint('https://toncenter.com/api/v3/runGetMethod', 'getConfigParam')).toBe('https://toncenter.com/api/v2/getConfigParam');
    expect(deriveToncenterV2Endpoint('https://example.org/rpc', 'getConfigParam'), 'not toncenter\'s shape: no config door').toBeNull();
    const urls: string[] = [];
    const transport = createTonCenterV3Transport({
      endpoint: 'https://toncenter.com/api/v3/runGetMethod', rateLimitKey: 'toncenter-shared',
      fetch: async (url: string) => { urls.push(url); return { ok: true, status: 200, json: async () => ({ ok: true, result: { config: { bytes: 'te6cckEBAQEAIwAAQuoAAAAAAAEEawAAAAAAQqqrAAAAABoKqqsAAYAAVVVVVXUQ/H0=' } } }) }; },
    });
    const bytes = await transport.getConfigParam(25, { priority: 'critical' });
    expect(urls).toEqual(['https://toncenter.com/api/v2/getConfigParam?config_id=25']);
    expect(parseForwardPrices(bytes)).toEqual({ lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n });
  });

  it('ATHREQ-07: the mint and the avatar purchase price the request live, and send the top-up FIRST, inside their affordability', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const mint = code(sourceBlock(app, 'async function submitUsernameMintDirect('));
    expect(mint).toContain("const topUp = await athRequestTopUpMessage('mint', athWalletAddress);");
    expect(mint).toContain('USERNAME_MINT_DIRECT_REQUEST_VALUE + BigInt(topUp.amount)');
    expect(mint).toContain('{ messages: topUp ? [topUp, athRequest] : [athRequest] }');
    const avatar = code(sourceBlock(app, 'async function submitProfileAvatarDirect('));
    expect(avatar).toContain("const athTopUp = await athRequestTopUpMessage('avatar', athWalletAddress);");
    expect(avatar).toContain('+ (athTopUp ? BigInt(athTopUp.amount) : 0n)');
    expect(avatar).toContain('extraMessages: athTopUp ? [athTopUp, athRequest] : [athRequest]');
    const helper = code(sourceBlock(app, 'async function athRequestTopUpMessage('));
    expect(helper).toContain('await readAthWalletFunding(athWalletAddress)');
    expect(helper).toContain("throw athUnpricedRefusal(error, 'the request');");
    const funding = code(sourceBlock(app, 'async function readAthWalletFunding('));
    expect(funding, 'the wallet\'s TON, read fresh').toContain('cacheTtlMs: 0');
    expect(funding, 'and its rent').toContain('createShardLastTransactionReader(');
    expect(code(sourceBlock(app, 'function athUnpricedRefusal(')), 'a failed read refuses before signing')
      .toContain("refused.code = 'ATH_REQUEST_UNPRICED';");
  });

  it('ATHREQ-08: the app\'s own helper (lifted) reads the prices, the TON and the last transaction, and answers the top-up — or refuses before signing', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const lift = (env: Record<string, any>) => {
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      return new Function(...names, `let networkPricesCache = null;\nconst NETWORK_PRICES_TTL_MS = 600000;\nconst NETWORK_PRICES_PLAUSIBLE_RATIO = 10n;\nconst networkPricesInFlight = new Map();\nlet networkPricesFailedAt = 0;\n${sourceBlock(app, 'async function readNetworkPrices(')}\n${sourceBlock(app, 'function networkPricesError(')}\n${sourceBlock(app, 'async function readNetworkPricesOnce(')}\n${sourceBlock(app, 'async function athRequestTopUpMessage(')}\n${sourceBlock(app, 'async function readAthWalletFunding(')}\n${sourceBlock(app, 'function athUnpricedRefusal(')}\nreturn athRequestTopUpMessage;`)(...names.map((n) => env[n]));
    };
    const bc = await Blockchain.create();
    scalePrices(bc, 7n);
    const p = configParams(bc);
    const configBoc = (id: number) => p.get(id)!.toBoc().toString('base64');
    const nowSec = Math.floor(Date.now() / 1000);
    const env = (overrides: Record<string, any> = {}) => ({
      parseGasPrices, parseForwardPrices, networkPricesWithin, athRequestTopUpNanotons, athWalletRentOwedNanotons, buildAthWalletTopUpMessage,
      createShardLastTransactionReader: () => async () => ({ now: nowSec - 30 * 86_400, storageFeesDue: 0n }),
      noteTonRpcRateLimit: () => true,
      t: (key: string) => `<${key}>`,
      ...overrides,
    });
    const transport = { getConfigParam: async (id: number) => configBoc(id), getAccountBalance: async () => '25000000' };
    (globalThis as any).plathoTonRpcTransport = transport;
    try {
      const topUp = await lift(env())('avatar', 'ATHWALLET');
      const expected = athRequestTopUpNanotons({ lane: 'avatar', prices: pricesOf(bc), walletTon: 25_000_000n,
        rentOwed: athWalletRentOwedNanotons({ lastTransactionAt: nowSec - 30 * 86_400, nowSec }) });
      expect(expected > 0n, 'at 7x a 25,000,000 wallet is short').toBe(true);
      expect(topUp).toMatchObject({ address: 'ATHWALLET', amount: expected, bounce: false });
      (globalThis as any).plathoTonRpcTransport = { ...transport, getAccountBalance: async () => { throw new Error('429'); } };
      const refused = await lift(env())('avatar', 'ATHWALLET').then(() => null, (error: any) => error);
      expect(refused?.code).toBe('ATH_REQUEST_UNPRICED');
      expect(refused?.message).toBe('<wallet.balanceUnreadNothingSent>');
    } finally {
      delete (globalThis as any).plathoTonRpcTransport;
    }
  });
});
