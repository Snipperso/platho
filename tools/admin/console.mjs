// Platho operator console — local only, never deployed.
//
// Addresses come from artifacts/mainnet_genesis_verify_input.json, the file whose sha256 the verification report
// names. That is deliberate and it is the second thing this page exists to prevent: hunting an address by hand sent
// me into artifacts/local, where a capture NAMED `...verify_input.live.json` describes a dead generation, and I
// reported a funded 60,000,000 ATH reserve as unfunded. One source, tied to the verification, or none.
//
// The RPC here is a twenty-line fetch wrapper rather than web/ton-rpc-transport.mjs, and that is a choice: the app's
// transport carries a paced request pump, a backoff ladder and a door carousel because a phone makes thousands of
// reads under a rate limit. A console makes a dozen. Inheriting that machinery would mean inheriting its
// configuration surface for no benefit — but SENDING goes through the app's own sendPlathoWalletTransaction, because
// that is where the seqno floor, the external-size guard and the re-broadcast actually live.

import { beginCell, serializeBoc, tonCell } from '../../web/pwa-contract-transactions.mjs';
import { importPlathoWallet, sendPlathoWalletTransaction } from '../../web/platho-wallet.mjs';
import { stackNumOr0 } from '../../web/ton-stack-num.mjs';
import { BUCKETS } from './buckets.mjs';

const MANIFEST_URL = '../../artifacts/mainnet_genesis_verify_input.json';
const REPORT_URL = '../../artifacts/mainnet_genesis_verify_report.json';
const TONCENTER = 'https://toncenter.com/api/v2';

const $ = (id) => document.getElementById(id);
let addresses = null;
let wallet = null;
let walletBalance = 0n;
const lastRead = new Map();   // bucket key -> decoded values, so an action can use the number it displayed

function setStatus(text, tone = '') {
  const el = $('status');
  el.textContent = text;
  el.dataset.tone = tone;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Gap between any two chain reads. ONE number: the buyback card's second getter must be paced like every other. */
const READ_SPACING_MS = 1100;

/**
 * MEASURED, twice. Six reads through Promise.all: four came back 429. Spaced 200ms apart: still four. The keyless
 * toncenter bucket is roughly one request per second and counted per IP, so the gap has to be about a second and a
 * retry has to exist anyway — a shared IP can be over the limit before this page asks for anything.
 *
 * A short ladder, not the app's 2/5/15/40/60: a console is watched by a person waiting for the answer, and giving up
 * after ~10s with "не прочитано" is a better report than a page that sits blank for a minute.
 */
async function rpc(path, body, attempt = 0) {
  const res = await fetch(`${TONCENTER}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 3) {
    await sleep([1500, 3000, 6000][attempt]);
    return rpc(path, body, attempt + 1);
  }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? `toncenter ${res.status}`);
  return json.result;
}

/** Positional read of a getter stack. The arity check is what makes positional survivable — see buckets.mjs. */
function decode(bucket, rows, stack) {
  if (!Array.isArray(stack)) throw new Error(`${bucket.key}: пустой стек`);
  const out = {};
  for (const row of rows) {
    const item = stack[row.at];
    if (!item) throw new Error(`${bucket.key}: в стеке нет позиции ${row.at} (${row.field})`);
    if (item[0] !== 'num') throw new Error(`${bucket.key}: позиция ${row.at} (${row.field}) не число — структура сдвинулась`);
    // NOT BigInt(item[1]). A TVM boolean arrives as the string "-0x1", which BigInt REFUSES to parse — so the first
    // bool row added to any card would have thrown and blanked the whole contract. web/ton-stack-num.mjs exists for
    // exactly this and is already what the app's readers use.
    out[row.field] = stackNumOr0(item[1], `${bucket.key}.${row.field}`);
  }
  return out;
}

const GRAM = (v) => `${(Number(v) / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 9 })} GRAM`;
const ATH = (v) => `${(Number(v) / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 4 })} ATH`;
const fmt = (value, unit) => (
  unit === 'GRAM' ? GRAM(value)
    : unit === 'ATH' ? ATH(value)
      : unit === 'bool' ? (value === 0n ? 'нет' : 'да')
        : String(value));

async function readBucket(bucket) {
  const address = addresses[bucket.manifest];
  const card = $(`card-${bucket.key}`);
  const body = card.querySelector('.rows');
  try {
    const result = await rpc('runGetMethod', { address, method: bucket.getter, stack: [] });
    if (result.exit_code !== 0) throw new Error(`геттер вернул ${result.exit_code}`);
    const values = decode(bucket, bucket.rows, result.stack);
    let rows = bucket.rows;
    // The second getter, where a card declares one. SEQUENTIAL and after the first, like every other read on this
    // page: six parallel reads is what earned the 429 that blanked the whole console on its first run.
    if (bucket.extra) {
      await sleep(READ_SPACING_MS);
      const more = await rpc('runGetMethod', { address, method: bucket.extra.getter, stack: [] });
      if (more.exit_code !== 0) throw new Error(`${bucket.extra.getter} вернул ${more.exit_code}`);
      Object.assign(values, decode(bucket, bucket.extra.rows, more.stack));
      rows = [...bucket.rows, ...bucket.extra.rows];
    }
    lastRead.set(bucket.key, values);
    body.replaceChildren(...rows.map((row) => {
      const line = document.createElement('div');
      line.className = row.primary ? 'row is-primary' : 'row';
      const label = document.createElement('span');
      label.textContent = row.label;
      const value = document.createElement('strong');
      value.textContent = fmt(values[row.field], row.unit);
      if (row.primary && values[row.field] > 0n) value.dataset.due = 'true';
      line.append(label, value);
      return line;
    }));
    renderActions(bucket, values);
    card.dataset.state = 'ok';
  } catch (error) {
    // A failed read must never render as a zero. A console that shows "0 к выводу" when it could not ask is the one
    // failure mode that makes the whole page worse than not having it.
    body.replaceChildren(Object.assign(document.createElement('div'), {
      className: 'row is-error', textContent: `не прочитано: ${error.message}`,
    }));
    card.dataset.state = 'error';
  }
}

function renderActions(bucket, values) {
  const box = $(`card-${bucket.key}`).querySelector('.actions');
  box.replaceChildren();
  for (const action of bucket.actions) {
    const amount = actionAmount(action, values);
    const unit = actionUnit(action);
    const blocked = actionBlockedReason(action, values);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = amount === null ? action.label : `${action.label} — ${fmt(amount, unit)}`;
    button.disabled = blocked !== null || (amount !== null && amount <= 0n);
    button.addEventListener('click', () => { runAction(bucket, action, values).catch((e) => setStatus(String(e.message ?? e), 'bad')); });
    const note = document.createElement('p');
    note.className = 'note';
    // The reason REPLACES the description while it applies: an operator looking at a dead button wants to know what
    // is missing, not what the button would have done.
    note.textContent = blocked === null ? (action.note ?? '') : `Недоступно: ${blocked}.`;
    if (blocked !== null) note.dataset.blocked = 'true';
    box.append(button, note);
  }
}

function buildBody(action, values) {
  const cell = beginCell().uint(action.opcode, 32, 'op');
  if (action.arg?.kind === 'amountFrom') cell.uint(values[action.arg.field], action.arg.bits, action.arg.field);
  // A query_id only has to be positive and not already used by a pending flush, so wall-clock milliseconds are safe
  // and — unlike the buyback's strict last+1 — cannot be raced out from under the caller.
  if (action.arg?.kind === 'queryId') cell.uint(BigInt(Date.now()), action.arg.bits, 'query_id');
  // The buyback is the one operation whose every argument is a value the contract will compare against ITSELF:
  // query_id against last_terminal + 1 (22044), and the pair against the frozen route evidence (22046/22047). So
  // all three are read back out of the state we just fetched. Nothing here is a choice, and offering the operator
  // a field to type into would only be offering them a way to bounce.
  if (action.arg?.kind === 'buybackExecute') {
    cell.uint(values.last_terminal_query_id + 1n, 64, 'query_id');
    cell.uint(values.evidence_quote_out_atomic_ath, 128, 'quote_out_atomic_ath');
    cell.uint(values.evidence_dex_min_out_atomic_ath, 128, 'dex_min_out_atomic_ath');
  }
  return cell.endCell();
}

/**
 * The unit of the figure on the button. Declared per action wherever the guess would be wrong: the registries' ATH
 * dues are the reason the fallback says ATH, and the buyback's enabling bucket is GRAM.
 */
function actionUnit(action) {
  if (action.unit) return action.unit;
  return action.arg?.kind === 'amountFrom' ? 'GRAM' : 'ATH';
}

/** The bucket whose being non-zero makes an action worth offering, and the figure to show on the button. */
function actionAmount(action, values) {
  if (action.arg?.kind === 'amountFrom') return values[action.arg.field];
  if (action.enabledBy) return values[action.enabledBy];
  return null;
}

/**
 * Why an action cannot run right now, in the operator's words, or null when it can.
 *
 * A disabled button that does not say why is a broken button. This exists because the buyback has FOUR conditions
 * and a non-zero balance satisfies only one of them: without this the console would offer the press at 3.27 GRAM
 * accumulated and the chain would answer with bounce code 22212, which explains nothing to anyone.
 */
function actionBlockedReason(action, values) {
  for (const rule of action.requires ?? []) {
    const value = values[rule.field];
    if (value === undefined) return `нет данных: ${rule.field}`;
    if (rule.equals !== undefined && value !== rule.equals) return rule.unmet;
    if (rule.atLeast !== undefined && value < rule.atLeast) return rule.unmet;
  }
  return null;
}

async function runAction(bucket, action, values) {
  if (!wallet) { setStatus('Сначала подключите кошелёк пульта', 'bad'); return; }
  const amount = actionAmount(action, values);
  if (amount !== null && amount <= 0n) return;
  // Re-checked here and not only at render: the read that disabled this button may be minutes old, and `phase`
  // in particular changes without anyone touching the page — a swap started elsewhere makes the press bounce.
  const blocked = actionBlockedReason(action, values);
  if (blocked !== null) { setStatus(`${action.label}: недоступно — ${blocked}`, 'bad'); return; }
  const unit = actionUnit(action);
  const human = amount === null ? action.label : `${action.label}: ${fmt(amount, unit)}`;
  // PRE-FLIGHT, because the chain's refusal is unreadable. An account that cannot pay rejects the external before the
  // VM starts, and the lite server reports that as "exitcode=0, steps=0, gas_used=0" — a sentence that says nothing
  // about an empty wallet to anyone who has not seen it before.
  const needed = action.value + 20_000_000n;   // the action's own value plus room for the external's own fees
  if (walletBalance < needed) {
    setStatus(`На кошельке пульта ${GRAM(walletBalance)} — для этой операции нужно около ${GRAM(needed)}. Пополните адрес, показанный выше.`, 'bad');
    return;
  }
  if (!window.confirm(`${bucket.title}\n${human}\n\nОтправить?`)) return;
  setStatus(`${bucket.title}: отправка…`);
  // THE EXIT CODE IS PART OF THE ANSWER, and dropping it cost the first real send.
  //
  // The console wallet held 2 GRAM but had never been deployed. `seqno` on an account with no code returns
  // exit_code -13 with GARBAGE on the stack — measured: 0x14c97, i.e. 85143. My wrapper checked only `ok`, so
  // getPlathoWalletSeqno read 85143 as the seqno, and because that is not zero the external went out WITHOUT the
  // StateInit that deploys the wallet. The chain rejected it before the VM started: "exitcode=0, steps=0,
  // gas_used=0" — a sentence with nothing in it about any of this.
  //
  // An uninit wallet's seqno IS zero, and saying so is what makes the first send deploy the wallet instead of
  // failing forever. -13 and -256 are the two shapes uninit takes across endpoints.
  const transport = {
    runGetMethod: async (call) => {
      const result = await rpc('runGetMethod', { address: call.address, method: call.method, stack: call.stack ?? [] });
      const exit = Number(result?.exit_code ?? 0);
      if (exit === 0) return result;
      if (call.method === 'seqno' && (exit === -13 || exit === -256)) return { ...result, stack: [['num', '0x0']] };
      throw new Error(`${call.method}: геттер вернул ${exit}`);
    },
    sendBoc: ({ boc }) => rpc('sendBoc', { boc }),
  };
  await sendPlathoWalletTransaction(wallet, {
    messages: [{
      address: addresses[bucket.manifest],
      amount: action.value.toString(),
      payload: tonCell.bytesToBase64(serializeBoc(buildBody(action, values))),
      bounce: true,   // a refused operation must return the money, not burn it
    }],
  }, { transport });
  setStatus(`${bucket.title}: отправлено. Перечитайте через несколько секунд.`, 'good');
}

async function connectWallet() {
  const phrase = $('phrase').value.trim();
  if (!phrase) { setStatus('Вставьте 24 слова кошелька пульта', 'bad'); return; }
  try {
    wallet = await importPlathoWallet(phrase);
    // The phrase is dropped from the DOM the moment it has been used. It still lived in a textarea for a few
    // seconds; this page is for a throwaway wallet holding pocket change, and that is the whole reason that is
    // acceptable rather than a compromise.
    $('phrase').value = '';
    $('walletAddress').textContent = wallet.address;
    // WHAT THE ADDRESS IS AND WHETHER IT CAN PAY, said out loud on connect.
    //
    // The first real send failed with "inbound external message rejected ... exitcode=0, steps=0, gas_used=0" — the
    // account could not accept the external at all, so no code ran and nothing in the message was at fault. The
    // account was empty. And the reason an operator can fund a wallet and still be looking at an empty one is that
    // THIS derivation is Platho's: same 24 words, v5r1, wallet_id 0x7fffff11 — another wallet app derives a
    // DIFFERENT address from the same phrase. Fund the address shown here, not the one another app shows.
    const info = await fetch(`${TONCENTER}/getAddressInformation?address=${wallet.address}`).then((r) => r.json());
    const balance = BigInt(info.result?.balance ?? 0);
    const state = info.result?.state ?? 'unknown';
    walletBalance = balance;
    $('walletBalance').textContent = GRAM(balance);
    if (balance === 0n) {
      setStatus(`Этот адрес ПУСТ (${state}). Пополните именно его — от той же фразы другой кошелёк даёт другой адрес.`, 'bad');
      return;
    }
    setStatus(`Кошелёк подключён${state !== 'active' ? ' (ещё не развёрнут — развернётся первой отправкой)' : ''}`, 'good');
  } catch (error) {
    setStatus(`Кошелёк не принят: ${error.message}`, 'bad');
  }
}

function buildCards() {
  const root = $('cards');
  root.replaceChildren(...BUCKETS.map((bucket) => {
    const card = document.createElement('section');
    card.className = 'card';
    card.id = `card-${bucket.key}`;
    const h = document.createElement('h2');
    h.textContent = bucket.title;
    const addr = document.createElement('code');
    addr.textContent = addresses[bucket.manifest] ?? 'адрес не найден в манифесте';
    const rows = document.createElement('div');
    rows.className = 'rows';
    const actions = document.createElement('div');
    actions.className = 'actions';
    card.append(h, addr, rows, actions);
    return card;
  }));
}

/**
 * ONE AT A TIME, and this is the reason the console is not simpler than it looks.
 *
 * The first live run fired all six reads with Promise.all and got 429 on four of them: the keyless toncenter bucket
 * is per-second and per-IP, so six simultaneous reads are four too many however few there are in total. I had argued
 * the console needs none of the app's request pump — true about the PACING MACHINERY, wrong about concurrency, and
 * the failure looked exactly like four contracts being unreadable.
 *
 * Sequential with a small gap is the whole fix. Twelve reads at 200ms is under three seconds, which nobody notices,
 * and it cannot trip the limit no matter how many buckets are added later.
 */
async function refreshAll() {
  setStatus('Чтение цепи…');
  for (const bucket of BUCKETS) {
    await readBucket(bucket);
    await sleep(READ_SPACING_MS);   // the keyless bucket is ~1 request per second; see rpc()
  }
  const failed = BUCKETS.filter((b) => $(`card-${b.key}`).dataset.state === 'error').length;
  setStatus(failed === 0 ? 'Прочитано' : `Прочитано, ${failed} не ответили`, failed === 0 ? 'good' : 'bad');
}

(async () => {
  try {
    const manifest = await fetch(MANIFEST_URL).then((r) => r.json());
    addresses = manifest.manifest.addresses;
    // The hash lives on the REPORT, not the input — the input is what was checked, the report is what the check
    // concluded. Showing it here is how the operator can tell at a glance which generation these addresses are.
    const report = await fetch(REPORT_URL).then((r) => r.json());
    $('manifestHash').textContent = report.checked_manifest_hash ?? '(в отчёте нет хеша)';
    if (report.mainnet_genesis_verified !== true) setStatus('ВНИМАНИЕ: генезис не подтверждён отчётом', 'bad');
  } catch (error) {
    setStatus(`Манифест не прочитан (${error.message}). Запускать из корня репозитория.`, 'bad');
    return;
  }
  buildCards();
  $('refresh').addEventListener('click', () => { refreshAll().catch((e) => setStatus(String(e.message ?? e), 'bad')); });
  $('connect').addEventListener('click', () => { connectWallet().catch((e) => setStatus(String(e.message ?? e), 'bad')); });
  await refreshAll();
})();
