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
const lastRead = new Map();   // bucket key -> decoded values, so an action can use the number it displayed

function setStatus(text, tone = '') {
  const el = $('status');
  el.textContent = text;
  el.dataset.tone = tone;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
function decode(bucket, stack) {
  if (!Array.isArray(stack)) throw new Error(`${bucket.key}: пустой стек`);
  const out = {};
  for (const row of bucket.rows) {
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
    const values = decode(bucket, result.stack);
    lastRead.set(bucket.key, values);
    body.replaceChildren(...bucket.rows.map((row) => {
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
    const amount = action.arg?.kind === 'amountFrom' ? values[action.arg.field] : null;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = amount === null ? action.label : `${action.label} — ${fmt(amount, 'GRAM')}`;
    button.disabled = amount !== null && amount <= 0n;
    button.addEventListener('click', () => { runAction(bucket, action, values).catch((e) => setStatus(String(e.message ?? e), 'bad')); });
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = action.note ?? '';
    box.append(button, note);
  }
}

function buildBody(action, values) {
  const cell = beginCell().uint(action.opcode, 32, 'op');
  if (action.arg?.kind === 'amountFrom') cell.uint(values[action.arg.field], action.arg.bits, action.arg.field);
  return cell.endCell();
}

async function runAction(bucket, action, values) {
  if (!wallet) { setStatus('Сначала подключите кошелёк пульта', 'bad'); return; }
  const amount = action.arg?.kind === 'amountFrom' ? values[action.arg.field] : null;
  if (amount !== null && amount <= 0n) return;
  const human = amount === null ? action.label : `${action.label}: ${fmt(amount, 'GRAM')}`;
  if (!window.confirm(`${bucket.title}\n${human}\n\nОтправить?`)) return;
  setStatus(`${bucket.title}: отправка…`);
  const transport = {
    runGetMethod: (call) => rpc('runGetMethod', { address: call.address, method: call.method, stack: call.stack ?? [] }),
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
    const info = await fetch(`${TONCENTER}/getAddressInformation?address=${wallet.address}`).then((r) => r.json());
    $('walletBalance').textContent = GRAM(BigInt(info.result?.balance ?? 0));
    setStatus('Кошелёк подключён', 'good');
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
    await sleep(1100);   // the keyless bucket is ~1 request per second; see rpc()
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
