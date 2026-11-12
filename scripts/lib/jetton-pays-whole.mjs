import { createRequire } from 'node:module';
import { JETTON_PROOF } from './swap-lists-age.mjs';
import { buildSwapMessage } from '../../web/wallet-swap.mjs';
import { buildDedustSwapMessage } from '../../web/wallet-swap-dedust.mjs';
import { serializeBoc } from '../../web/pwa-contract-transactions.mjs';

const require = createRequire(import.meta.url);
const { Blockchain, createShardAccount, internal } = require('@ton/sandbox');
const { Address, Cell, Dictionary, beginCell, toNano } = require('@ton/core');

const PERSON = Address.parse(`0:${'5a'.repeat(32)}`);
const JETTON_TRANSFER = 0x0f8a7ea5;
const LIBRARY_ROUNDS = 4;
const SALE_DEADLINE_SECONDS = 15 * 60;

export const jettonVerdictKey = (master, wallet) => `whole${JETTON_PROOF}|${master}|${wallet}`;

const transferBody = (amount, to, answerTo, forward) => beginCell().storeUint(JETTON_TRANSFER, 32).storeUint(153, 64).storeCoins(amount)
  .storeAddress(to).storeAddress(answerTo).storeBit(0).storeCoins(forward).storeBit(0).endCell();

function appSaleMessage(holder, { amount, jettonWallet, nowSec }) {
  const sale = holder.sale ?? {};
  const common = { amountIn: amount, minOut: 1n, recipient: PERSON.toRawString(), deadline: BigInt(nowSec + SALE_DEADLINE_SECONDS), jettonWallet: jettonWallet.toRawString() };
  let message = null;
  if (sale.dex === 'dedust' && sale.pool) message = buildDedustSwapMessage({ pair: { offer: { id: holder.master }, offerVault: holder.owner, pool: sale.pool }, ...common });
  else if (sale.dex === 'stonfi' && sale.askWallet) message = buildSwapMessage({ pair: { offer: { id: holder.master }, router: holder.owner, askWallet: sale.askWallet }, ...common });
  if (!message) return null;
  return { value: BigInt(message.value), body: Cell.fromBoc(Buffer.from(serializeBoc(message.body)))[0] };
}

export function libraryRefsOf(cell, found = new Set(), seen = new Set()) {
  if (!cell) return found;
  const id = cell.hash().toString('hex');
  if (seen.has(id)) return found;
  seen.add(id);
  if (cell.isExotic && cell.bits.length === 264 && cell.bits.subbuffer(0, 8)?.[0] === 2) found.add(cell.bits.subbuffer(8, 256).toString('hex'));
  for (const ref of cell.refs) libraryRefsOf(ref, found, seen);
  return found;
}

async function walletData(chain, address) {
  try {
    const reader = (await chain.runGetMethod(address, 'get_wallet_data')).stackReader;
    return { balance: reader.readBigNumber(), owner: reader.readAddress(), master: reader.readAddress() };
  } catch {
    return null;
  }
}

const percent = (part, whole) => (whole > 0n ? Number((part * 1_000_000n) / whole) / 10_000 : 0);

export async function runJettonPayout({ holder, state, libraries, nowSec = Math.floor(Date.now() / 1000) }) {
  const wanted = new Set();
  const want = (cell) => { for (const hash of libraryRefsOf(cell)) if (!libraries.has(hash)) wanted.add(hash); };
  const unproven = (why) => ({ whole: false, unproven: true, why, wanted });
  if (!state || state.status !== 'active' || !state.code || !state.data) return unproven(`the exchange's jetton wallet is ${state?.status ?? 'not read'}`);
  let code;
  let data;
  try { code = Cell.fromBase64(state.code); data = Cell.fromBase64(state.data); } catch { return unproven('its code or data is not a cell'); }
  want(code);
  if (wanted.size > 0) return unproven('its code is a library this run does not hold');
  const chain = await Blockchain.create();
  chain.now = nowSec;
  if (libraries.size > 0) {
    const dictionary = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    for (const [hash, cell] of libraries) dictionary.set(Buffer.from(hash, 'hex'), cell);
    chain.libs = beginCell().storeDictDirect(dictionary).endCell();
  }
  const wallet = Address.parse(holder.wallet);
  const owner = Address.parse(holder.owner);
  await chain.setShardAccount(wallet, createShardAccount({ address: wallet, code, data, balance: BigInt(state.balance || '0') + toNano('1'), workchain: 0 }));
  const before = await walletData(chain, wallet);
  if (!before) return unproven('it does not answer get_wallet_data');
  if (!before.owner.equals(owner)) return unproven('it names another owner than the exchange');
  if (before.master.toRawString() !== Address.parse(holder.master).toRawString()) return unproven('it names another master');
  if (before.balance <= 0n) return unproven('the exchange holds none of it');
  if (holder.atLeast !== undefined && before.balance < BigInt(holder.atLeast)) return unproven('it holds less than the pools it would pay for');
  let paid = before.balance / 1000n;
  if (paid < 1000n) paid = before.balance < 1000n ? before.balance : 1000n;

  const buy = await chain.sendMessage(internal({ from: owner, to: wallet, value: toNano('0.3'), bounce: true, body: transferBody(paid, PERSON, PERSON, 1n) }));
  let mine = null;
  const asked = new Set();
  for (const transaction of buy.transactions) {
    for (const message of transaction.outMessages.values()) {
      if (message.init?.code) want(message.init.code);
      const to = message.info.dest;
      if (!to || !Address.isAddress(to) || asked.has(to.toRawString())) continue;
      asked.add(to.toRawString());
      const held = await walletData(chain, to);
      if (held && held.owner.equals(PERSON) && held.master.equals(before.master)) mine = { address: to, balance: held.balance };
    }
  }
  const after = await walletData(chain, wallet);
  if (!after) return unproven('it stopped answering after the payout');
  const left = before.balance - after.balance;
  const came = mine?.balance ?? 0n;
  if (came === 0n && wanted.size > 0) return unproven('the receiving wallet\'s code is a library this run does not hold');
  if (left !== paid) return { whole: false, why: `sending ${paid} took ${left} from the exchange's wallet`, wanted };
  if (came !== paid) return { whole: false, why: `a payout arrives ${percent(paid - came, paid)}% short`, wanted, buyShort: percent(paid - came, paid) };

  let swap = null;
  try { swap = appSaleMessage(holder, { amount: came, jettonWallet: mine.address, nowSec }); } catch { swap = null; }
  if (!swap) return unproven('no sale of the app was given to run');
  const sales = [
    { name: 'a sale', value: toNano('0.3'), body: transferBody(came, owner, PERSON, toNano('0.05')) },
    { name: 'a sale carrying the swap', value: swap.value, body: swap.body },
  ];
  const held = chain.snapshot();
  for (const sale of sales) {
    await chain.loadFrom(held);
    const sell = await chain.sendMessage(internal({ from: PERSON, to: mine.address, value: sale.value, bounce: true, body: sale.body }));
    for (const transaction of sell.transactions) for (const message of transaction.outMessages.values()) if (message.init?.code) want(message.init.code);
    const back = await walletData(chain, wallet);
    if (!back) return unproven('it stopped answering after the sale');
    const took = back.balance - after.balance;
    if (took !== came) return { whole: false, why: `${sale.name} reaches the exchange ${percent(came - took, came)}% short`, wanted, sellShort: percent(came - took, came) };
  }
  return { whole: true, why: '', wanted };
}

export async function proveJettonsWhole({ holders, readStates, readLibrary, log = () => {} }) {
  const verdicts = new Map();
  const wallets = [...new Set(holders.map((holder) => Address.parse(holder.wallet).toRawString()))];
  const states = await readStates(wallets);
  const libraries = new Map();
  const missing = new Set();
  const fetchLibraries = async (hashes) => {
    let fetched = 0;
    for (const hash of hashes) {
      if (libraries.has(hash) || missing.has(hash)) continue;
      let boc = null;
      try { boc = await readLibrary(hash); } catch { boc = null; }
      let cell = null;
      try { cell = boc ? Cell.fromBase64(boc) : null; } catch { cell = null; }
      if (cell && cell.hash().toString('hex') === hash) { libraries.set(hash, cell); fetched += 1; } else missing.add(hash);
    }
    return fetched;
  };
  let ran = 0;
  for (const holder of holders) {
    const state = states.get(Address.parse(holder.wallet).toRawString()) ?? null;
    let verdict = null;
    for (let round = 0; round < LIBRARY_ROUNDS; round += 1) {
      try {
        verdict = await runJettonPayout({ holder, state, libraries });
      } catch (error) {
        verdict = { whole: false, unproven: true, why: `the run threw: ${String(error?.message ?? error).slice(0, 120)}`, wanted: new Set() };
      }
      if (verdict.whole || verdict.wanted.size === 0) break;
      if ((await fetchLibraries(verdict.wanted)) === 0) break;
    }
    verdicts.set(`${holder.master}|${holder.wallet}`, { whole: verdict.whole === true, why: verdict.why, unproven: verdict.unproven === true });
    ran += 1;
    if (ran % 50 === 0) log(`  ${ran} of ${holders.length} jettons run`);
  }
  return verdicts;
}

export function toncenterJettonReads(call) {
  return {
    async readStates(wallets) {
      const out = new Map();
      for (let at = 0; at < wallets.length; at += 50) {
        const batch = wallets.slice(at, at + 50);
        const answer = await call(`https://toncenter.com/api/v3/accountStates?${batch.map((wallet) => `address=${encodeURIComponent(wallet)}`).join('&')}&include_boc=true`, {});
        if (!Array.isArray(answer?.accounts)) throw new Error(`accountStates: ${JSON.stringify(answer).slice(0, 200)}`);
        for (const row of answer.accounts) {
          let raw = '';
          try { raw = Address.parse(String(row.address)).toRawString(); } catch { raw = ''; }
          if (raw) out.set(raw, { status: row.status, balance: row.balance, code: row.code_boc ?? '', data: row.data_boc ?? '' });
        }
      }
      return out;
    },
    async readLibrary(hash) {
      const answer = await call(`https://toncenter.com/api/v2/getLibraries?libraries=${hash}`, {});
      const rows = answer?.result?.result ?? answer?.result ?? [];
      return (Array.isArray(rows) ? rows[0]?.data : null) ?? null;
    },
  };
}
