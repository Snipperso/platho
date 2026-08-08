// Measures the one cost that decides how many users this design can carry: checking a single incoming
// first-contact record. A recipient cannot know which IntroShard bucket a sender chose, so it recomputes the view
// tag for EVERY foreign intro in its window — the only work in the client that grows with the whole network's
// activity rather than the user's own.
//
// It calls the SHIPPED function. A benchmark that re-implements the thing it measures reports the speed of the
// benchmark, and this page exists precisely because desktop numbers do not answer what a phone does.
//
// ── WHY THE BREAKDOWN EXISTS ─────────────────────────────────────────────────────────────────────────────────
// First round of real devices, ms per record:
//   0.0335  Chromium desktop      0.0555  Galaxy / Chrome 150      0.3967  iPhone / Safari 18.5
// A phone running Chrome matches a desktop; the iPhone is 7x slower than ANOTHER PHONE, both on native X25519.
// So the ceiling is set by one engine's WebCrypto, not by the protocol and not by the hardware — and that is a
// claim about WHERE the time goes, which a single total cannot confirm. The stages below split it, and the
// concurrent variant tests the specific suspicion: if per-call overhead dominates, overlapping calls hides it.

import { privateScanViewTagOrNull, __x25519FastPathActiveForTests } from './crypto/platho-crypto.mjs?v=15';
import { x25519 } from './vendor/@noble/curves/ed25519.js';
import { hkdf } from './vendor/@noble/hashes/hkdf.js';
import { sha256 } from './vendor/@noble/hashes/sha2.js';

const SAFE_CAP = 8000;          // IS_SAFE_CAP: intros per bucket per day
const WARMUP = 300;             // let the JIT settle and the native-path probe resolve before timing anything
const SAMPLE = 3000;
const STAGE_SAMPLE = 1500;      // the stage split runs four passes; keep the whole page under a few seconds
const POINTS = 512;
const CONCURRENCY = 32;

const PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);
const encoder = new TextEncoder();
const SALT = encoder.encode('PLATHO.STEALTH.VIEWTAG.SALT.V1');
const INFO_PREFIX = encoder.encode('PLATHO.STEALTH.VIEWTAG.V1');

const runButton = document.getElementById('run');
const copyButton = document.getElementById('copy');
const statusLine = document.getElementById('status');
const resultBox = document.getElementById('result');
const summaryList = document.getElementById('summary');
const stageBody = document.querySelector('#stages tbody');
const curveBody = document.querySelector('#curve tbody');
const rawBox = document.getElementById('raw');

function addRow(list, label, value, className) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (className) dd.className = className;
  list.append(dt, dd);
}

function addCells(tbody, cells, className) {
  const row = document.createElement('tr');
  for (let i = 0; i < cells.length; i += 1) {
    const cell = document.createElement('td');
    cell.textContent = cells[i];
    if (i > 0 && className) cell.className = className;
    row.append(cell);
  }
  tbody.append(row);
  return row;
}

/** Yield to the event loop so the status text actually paints before a blocking measurement starts. */
function paint() {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

async function timed(count, fn) {
  const started = performance.now();
  await fn(count);
  return (performance.now() - started) / count;
}

/** Sequential, exactly as the scan loop runs today. */
async function sequentialScan(scanSecret, points) {
  return (count) => (async () => {
    for (let i = 0; i < count; i += 1) await privateScanViewTagOrNull(scanSecret, points[i % points.length]);
  })();
}

/**
 * The same work with CONCURRENCY records in flight. Nothing about the protocol changes — only whether the client
 * waits for each WebCrypto round trip before starting the next. If the engine's per-call overhead is the cost,
 * this is most of it back; if the scalar multiplication is the cost, this changes nothing and the idea is dead.
 */
async function concurrentScan(scanSecret, points) {
  return (count) => (async () => {
    for (let i = 0; i < count; i += CONCURRENCY) {
      const batch = [];
      for (let j = 0; j < CONCURRENCY && i + j < count; j += 1) {
        batch.push(privateScanViewTagOrNull(scanSecret, points[(i + j) % points.length]));
      }
      await Promise.all(batch);
    }
  })();
}

async function run() {
  runButton.disabled = true;
  resultBox.hidden = true;
  statusLine.textContent = 'Generating keys...';
  await paint();

  const scanSecret = x25519.utils.randomSecretKey();
  const points = [];
  for (let i = 0; i < POINTS; i += 1) points.push(x25519.getPublicKey(x25519.utils.randomSecretKey()));

  statusLine.textContent = 'Warming up...';
  await paint();
  await (await sequentialScan(scanSecret, points))(WARMUP);

  statusLine.textContent = 'Measuring the shipped path...';
  await paint();
  const perEntryMs = await timed(SAMPLE, await sequentialScan(scanSecret, points));

  let native = false;
  try {
    native = await __x25519FastPathActiveForTests();
  } catch {
    native = false;
  }

  statusLine.textContent = 'Measuring concurrent batches...';
  await paint();
  const concurrentMs = await timed(SAMPLE, await concurrentScan(scanSecret, points));

  // ── stage split ────────────────────────────────────────────────────────────────────────────────────────────
  const stages = [];
  if (native) {
    const subtle = globalThis.crypto.subtle;
    const pkcs8 = new Uint8Array(PKCS8_PREFIX.length + 32);
    pkcs8.set(PKCS8_PREFIX, 0);
    pkcs8.set(scanSecret, PKCS8_PREFIX.length);
    const privateKey = await subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, false, ['deriveBits']);

    statusLine.textContent = 'Splitting the cost...';
    await paint();
    stages.push(['import the peer point', await timed(STAGE_SAMPLE, (n) => (async () => {
      for (let i = 0; i < n; i += 1) await subtle.importKey('raw', points[i % points.length], { name: 'X25519' }, false, []);
    })())]);

    const oneKey = await subtle.importKey('raw', points[0], { name: 'X25519' }, false, []);
    stages.push(['derive the shared secret', await timed(STAGE_SAMPLE, (n) => (async () => {
      for (let i = 0; i < n; i += 1) await subtle.deriveBits({ name: 'X25519', public: oneKey }, privateKey, 256);
    })())]);
  }

  const shared = x25519.getSharedSecret(scanSecret, points[0]);
  const info = new Uint8Array(INFO_PREFIX.length + 32);
  info.set(INFO_PREFIX, 0);
  info.set(points[0], INFO_PREFIX.length);
  stages.push(['derive the tag (KDF)', await timed(STAGE_SAMPLE, (n) => (async () => {
    for (let i = 0; i < n; i += 1) hkdf(sha256, shared, SALT, info, 2);
  })())]);

  // The path older devices fall back to. Worth knowing per engine: the 21x measured on a desktop is not a promise
  // about this one, and if the gap here is small the fallback is not the disaster it looks like on paper.
  statusLine.textContent = 'Measuring the JS fallback...';
  await paint();
  stages.push(['JS fallback, multiplication only', await timed(STAGE_SAMPLE, (n) => (async () => {
    for (let i = 0; i < n; i += 1) x25519.getSharedSecret(scanSecret, points[i % points.length]);
  })())]);

  // ── render ─────────────────────────────────────────────────────────────────────────────────────────────────
  summaryList.replaceChildren();
  addRow(summaryList, 'Per record', `${perEntryMs.toFixed(4)} ms`);
  addRow(
    summaryList,
    'Native X25519',
    native ? 'yes - fast path in use' : 'no - running the JS fallback',
    native ? 'verdict-good' : 'verdict-slow',
  );
  const speedup = perEntryMs / concurrentMs;
  addRow(
    summaryList,
    `Batched ${CONCURRENCY} at a time`,
    `${concurrentMs.toFixed(4)} ms per record (${speedup.toFixed(1)}x)`,
    speedup >= 1.5 ? 'verdict-good' : undefined,
  );
  addRow(summaryList, 'Records measured', String(SAMPLE));
  addRow(summaryList, 'Device', navigator.userAgent);

  stageBody.replaceChildren();
  for (const [label, ms] of stages) addCells(stageBody, [label, `${ms.toFixed(4)} ms`]);

  curveBody.replaceChildren();
  for (const daily of [10_000, 100_000, 1_000_000, 10_000_000]) {
    const seconds = (daily * perEntryMs) / 1000;
    const best = (daily * Math.min(perEntryMs, concurrentMs)) / 1000;
    const fmt = (s) => (s < 1 ? `${s.toFixed(2)} s` : `${Math.round(s).toLocaleString('en-US')} s`);
    addCells(
      curveBody,
      [daily.toLocaleString('en-US'), fmt(seconds), fmt(best)],
      seconds > 120 ? 'verdict-slow' : (seconds < 30 ? 'verdict-good' : undefined),
    );
  }

  rawBox.textContent = [
    `per record          ${perEntryMs.toFixed(4)} ms`,
    `batched x${CONCURRENCY}        ${concurrentMs.toFixed(4)} ms  (${speedup.toFixed(2)}x)`,
    `native X25519       ${native ? 'yes' : 'no (JS fallback)'}`,
    `records measured    ${SAMPLE}`,
    `device              ${navigator.userAgent}`,
    '',
    ...stages.map(([label, ms]) => `${label.padEnd(34)}${ms.toFixed(4)} ms`),
    '',
    ...[10_000, 100_000, 1_000_000, 10_000_000].map((daily) => {
      const seconds = (daily * perEntryMs) / 1000;
      const best = (daily * Math.min(perEntryMs, concurrentMs)) / 1000;
      return `${String(daily).padStart(9)} intros/day -> ${seconds.toFixed(1).padStart(8)} s/day`
        + ` (batched ${best.toFixed(1).padStart(8)} s), ${Math.ceil(daily / SAFE_CAP)} live buckets`;
    }),
  ].join('\n');

  resultBox.hidden = false;
  statusLine.textContent = 'Done.';
  runButton.disabled = false;
}

runButton.addEventListener('click', () => {
  run().catch((error) => {
    runButton.disabled = false;
    statusLine.textContent = `Failed: ${error?.message ?? error}`;
  });
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(rawBox.textContent);
    copyButton.textContent = 'Copied';
    setTimeout(() => { copyButton.textContent = 'Copy result as text'; }, 1500);
  } catch {
    // Clipboard is blocked in some in-app browsers; the text is on screen and selectable either way.
    copyButton.textContent = 'Select the text below';
  }
});
