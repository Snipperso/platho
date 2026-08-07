// Measures the one cost that decides how many users this design can carry: checking a single incoming
// first-contact record. A recipient cannot know which IntroShard bucket a sender chose, so it recomputes the view
// tag for EVERY foreign intro in its window — the only work in the client that grows with the whole network's
// activity rather than the user's own.
//
// It calls the SHIPPED function. A benchmark that re-implements the thing it measures reports the speed of the
// benchmark, and this page exists precisely because desktop numbers do not answer what a phone does.

import { privateScanViewTagOrNull, __x25519FastPathActiveForTests } from './crypto/platho-crypto.mjs?v=14';
import { x25519 } from './vendor/@noble/curves/ed25519.js';

const SAFE_CAP = 8000;          // IS_SAFE_CAP: intros per bucket per day
const WARMUP = 300;             // let the JIT settle and the native-path probe resolve before timing anything
const SAMPLE = 3000;
const POINTS = 512;

const runButton = document.getElementById('run');
const copyButton = document.getElementById('copy');
const statusLine = document.getElementById('status');
const resultBox = document.getElementById('result');
const summaryList = document.getElementById('summary');
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

/** Yield to the event loop so the status text actually paints before a blocking measurement starts. */
function paint() {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

async function measure(scanSecret, points, count) {
  const started = performance.now();
  for (let i = 0; i < count; i += 1) {
    await privateScanViewTagOrNull(scanSecret, points[i % points.length]);
  }
  return performance.now() - started;
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
  await measure(scanSecret, points, WARMUP);

  statusLine.textContent = 'Measuring...';
  await paint();
  const elapsed = await measure(scanSecret, points, SAMPLE);
  const perEntryMs = elapsed / SAMPLE;

  // Whether the native path engaged is the whole question on older phones: the fallback is roughly twenty times
  // slower, and a device that quietly runs it looks fine until the network grows.
  let native = false;
  try {
    native = await __x25519FastPathActiveForTests();
  } catch {
    native = false;
  }

  summaryList.replaceChildren();
  addRow(summaryList, 'Per record', `${perEntryMs.toFixed(4)} ms`);
  addRow(
    summaryList,
    'Native X25519',
    native ? 'yes - fast path in use' : 'no - running the JS fallback',
    native ? 'verdict-good' : 'verdict-slow',
  );
  addRow(summaryList, 'Records measured', String(SAMPLE));
  addRow(summaryList, 'Device', navigator.userAgent);

  curveBody.replaceChildren();
  for (const daily of [10_000, 100_000, 1_000_000, 10_000_000]) {
    const seconds = (daily * perEntryMs) / 1000;
    const row = document.createElement('tr');
    const label = document.createElement('td');
    label.textContent = daily.toLocaleString('en-US');
    const value = document.createElement('td');
    value.textContent = seconds < 1 ? `${seconds.toFixed(2)} s` : `${Math.round(seconds).toLocaleString('en-US')} s`;
    // Anything past a couple of minutes a day is a phone that never finishes catching up in the background.
    if (seconds > 120) value.className = 'verdict-slow';
    else if (seconds < 30) value.className = 'verdict-good';
    row.append(label, value);
    curveBody.append(row);
  }

  const liveBuckets = (daily) => Math.ceil(daily / SAFE_CAP);
  rawBox.textContent = [
    `per record        ${perEntryMs.toFixed(4)} ms`,
    `native X25519     ${native ? 'yes' : 'no (JS fallback)'}`,
    `records measured  ${SAMPLE}`,
    `device            ${navigator.userAgent}`,
    '',
    ...[10_000, 100_000, 1_000_000, 10_000_000].map((daily) => {
      const seconds = (daily * perEntryMs) / 1000;
      return `${String(daily).padStart(9)} intros/day -> ${seconds.toFixed(1).padStart(9)} s/day, ${liveBuckets(daily)} live buckets`;
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
