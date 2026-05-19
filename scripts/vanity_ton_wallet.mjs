#!/usr/bin/env node
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, WalletContractV5R1 } from '@ton/ton';

export const DEFAULT_SUFFIXES = ['PATH', 'OATH', 'MATH', 'ATHO', 'PLATHO'];
const BASE64URL_ALPHABET_SIZE = 64;
const DEFAULT_RATE_PER_WORKER = 10;

function usage() {
  return [
    'Usage:',
    '  node scripts/vanity_ton_wallet.mjs --suffix PATH,OATH,MATH,ATHO,PLATHO --wallet both --workers max --estimate-only',
    '  node scripts/vanity_ton_wallet.mjs --suffix PATH,OATH,MATH,ATHO,PLATHO --wallet both --workers max --keep-going --i-understand-this-prints-secrets',
    '',
    'Important:',
    '  The search prints a wallet mnemonic only when --i-understand-this-prints-secrets is passed.',
    '  Run it locally in a private terminal. Do not paste the mnemonic into chat, GitHub, or logs.',
    '  Importing the same mnemonic into an app that defaults to another wallet version may show another address.',
    '',
    'Options:',
    '  --suffix LIST       Comma-separated exact suffixes. Default: PATH,OATH,MATH,ATHO,PLATHO',
    '  --wallet VERSION   v4r2, v5r1, or both. Default: v4r2',
    '  --workers N|max    Worker count. Default: CPU count minus one',
    '  --bounceable       Search EQ... friendly form instead of default UQ...',
    '  --estimate-only    Print probability/time estimate and exit',
    '  --benchmark N      Benchmark N mnemonic attempts before estimating',
    '  --keep-going       Keep collecting matches until Ctrl+C instead of stopping at the first match',
    '  --out PATH         JSONL output for matches in keep-going mode. Default: artifacts/local/vanity-wallet-candidates.jsonl',
  ].join('\n');
}

export function normalizeSuffixes(input = DEFAULT_SUFFIXES.join(',')) {
  const suffixes = input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (suffixes.length === 0) throw new Error('At least one suffix is required.');
  for (const suffix of suffixes) {
    if (!/^[A-Za-z0-9_-]+$/.test(suffix)) {
      throw new Error(`Suffix "${suffix}" contains characters outside TON friendly-address alphabet.`);
    }
  }
  return [...new Set(suffixes)];
}

export function walletVersionCount(walletVersion = 'v4r2') {
  return walletVersion === 'both' ? 2 : 1;
}

export function expectedAttempts(suffixes, walletVersion = 'v4r2') {
  let p = 0;
  for (const suffix of suffixes) {
    p += 1 / (BASE64URL_ALPHABET_SIZE ** suffix.length);
  }
  p *= walletVersionCount(walletVersion);
  return Math.ceil(1 / p);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function parseArgs(argv) {
  const options = {
    suffixes: DEFAULT_SUFFIXES,
    walletVersion: 'v4r2',
    workers: Math.max(1, cpus().length - 1),
    bounceable: false,
    estimateOnly: false,
    allowSecretOutput: false,
    benchmarkAttempts: 0,
    ratePerWorker: DEFAULT_RATE_PER_WORKER,
    keepGoing: false,
    outPath: 'artifacts/local/vanity-wallet-candidates.jsonl',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--suffix') {
      options.suffixes = normalizeSuffixes(argv[++i] ?? '');
    } else if (arg.startsWith('--suffix=')) {
      options.suffixes = normalizeSuffixes(arg.slice('--suffix='.length));
    } else if (arg === '--wallet') {
      options.walletVersion = argv[++i] ?? '';
    } else if (arg.startsWith('--wallet=')) {
      options.walletVersion = arg.slice('--wallet='.length);
    } else if (arg === '--workers') {
      options.workers = parseWorkerCount(argv[++i] ?? '');
    } else if (arg.startsWith('--workers=')) {
      options.workers = parseWorkerCount(arg.slice('--workers='.length));
    } else if (arg === '--bounceable') {
      options.bounceable = true;
    } else if (arg === '--estimate-only') {
      options.estimateOnly = true;
    } else if (arg === '--i-understand-this-prints-secrets') {
      options.allowSecretOutput = true;
    } else if (arg === '--benchmark') {
      options.benchmarkAttempts = Number(argv[++i] ?? 0);
    } else if (arg.startsWith('--benchmark=')) {
      options.benchmarkAttempts = Number(arg.slice('--benchmark='.length));
    } else if (arg === '--keep-going') {
      options.keepGoing = true;
    } else if (arg === '--out') {
      options.outPath = argv[++i] ?? '';
    } else if (arg.startsWith('--out=')) {
      options.outPath = arg.slice('--out='.length);
    } else if (arg === '--rate-per-worker') {
      options.ratePerWorker = Number(argv[++i] ?? 0);
    } else if (arg.startsWith('--rate-per-worker=')) {
      options.ratePerWorker = Number(arg.slice('--rate-per-worker='.length));
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['v4r2', 'v5r1', 'both'].includes(options.walletVersion)) throw new Error('--wallet must be v4r2, v5r1, or both.');
  if (!Number.isInteger(options.workers) || options.workers < 1) throw new Error('--workers must be a positive integer.');
  if (!Number.isFinite(options.ratePerWorker) || options.ratePerWorker <= 0) throw new Error('--rate-per-worker must be positive.');
  if (!Number.isInteger(options.benchmarkAttempts) || options.benchmarkAttempts < 0) throw new Error('--benchmark must be a non-negative integer.');
  if (options.keepGoing && !options.outPath) throw new Error('--out must not be empty in keep-going mode.');
  return options;
}

function parseWorkerCount(value) {
  if (value === 'max' || value === 'all') return cpus().length;
  return Number(value);
}

function walletAddresses(publicKey, walletVersion, bounceable) {
  const versions = walletVersion === 'both' ? ['v4r2', 'v5r1'] : [walletVersion];
  return versions.map((version) => {
    const wallet = version === 'v5r1'
      ? WalletContractV5R1.create({ workchain: 0, publicKey })
      : WalletContractV4.create({ workchain: 0, publicKey });
    return {
      walletVersion: version,
      address: wallet.address.toString({ testOnly: false, bounceable }),
    };
  });
}

async function createCandidate(options) {
  const mnemonic = await mnemonicNew(24);
  const key = await mnemonicToWalletKey(mnemonic);
  const addresses = walletAddresses(key.publicKey, options.walletVersion, options.bounceable);
  return { mnemonic, addresses };
}

function findMatch(candidate, suffixes) {
  for (const entry of candidate.addresses) {
    const suffix = suffixes.find((item) => entry.address.endsWith(item));
    if (suffix) return { ...entry, suffix };
  }
  return null;
}

async function benchmark(options) {
  const start = Date.now();
  for (let i = 0; i < options.benchmarkAttempts; i += 1) {
    await createCandidate(options);
  }
  const elapsedSeconds = (Date.now() - start) / 1000;
  return options.benchmarkAttempts / elapsedSeconds;
}

function estimate(options, ratePerWorker) {
  const attempts = expectedAttempts(options.suffixes, options.walletVersion);
  const totalRate = ratePerWorker * options.workers;
  const uvThreadpoolSize = Number(process.env.UV_THREADPOOL_SIZE ?? 4);
  return {
    suffixes: options.suffixes,
    walletVersion: options.walletVersion,
    walletVersionsCheckedPerMnemonic: walletVersionCount(options.walletVersion),
    friendlyForm: options.bounceable ? 'bounceable EQ...' : 'non-bounceable UQ...',
    workers: options.workers,
    uvThreadpoolSize,
    recommendedPowerShellPrefix: `$env:UV_THREADPOOL_SIZE='${options.workers}'`,
    uvThreadpoolWarning: uvThreadpoolSize < options.workers
      ? `Set UV_THREADPOOL_SIZE=${options.workers} before starting node to avoid pbkdf2 bottleneck.`
      : null,
    expectedAttempts: attempts,
    ratePerWorker: Number(ratePerWorker.toFixed(2)),
    expectedWallTime: formatDuration(attempts / totalRate),
  };
}

async function runWorker() {
  const options = workerData.options;
  let attempts = 0;
  let lastProgressAt = Date.now();
  while (true) {
    attempts += 1;
    const candidate = await createCandidate(options);
    const match = findMatch(candidate, options.suffixes);
    if (match) {
      parentPort.postMessage({ type: 'found', attempts, match, candidate });
      if (!options.keepGoing) return;
      attempts = 0;
      lastProgressAt = Date.now();
    }
    const now = Date.now();
    if (now - lastProgressAt >= 5000) {
      parentPort.postMessage({ type: 'progress', attempts });
      attempts = 0;
      lastProgressAt = now;
    }
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error('');
    console.error(usage());
    process.exit(2);
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  let rate = options.ratePerWorker;
  if (options.benchmarkAttempts > 0) {
    rate = await benchmark(options);
  }

  console.log(JSON.stringify({ estimate: estimate(options, rate) }, null, 2));

  if (options.estimateOnly) return;
  if (!options.allowSecretOutput) {
    console.error('');
    console.error('Refusing to search without --i-understand-this-prints-secrets.');
    console.error('This prevents accidental mnemonic exposure in logs.');
    process.exit(2);
  }

  const startedAt = Date.now();
  let totalAttempts = 0;
  let foundCount = 0;
  const outputPath = resolve(options.outPath);
  if (options.keepGoing) {
    mkdirSync(dirname(outputPath), { recursive: true });
    console.log(JSON.stringify({
      collectionMode: true,
      outputPath,
      stop: 'Press Ctrl+C when you have enough candidates.',
    }, null, 2));
  }
  const workers = [];
  let done = false;

  for (let i = 0; i < options.workers; i += 1) {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { mode: 'search', options },
    });
    worker.on('message', (message) => {
      if (done) return;
      if (message.type === 'progress') {
        totalAttempts += message.attempts;
        const elapsed = (Date.now() - startedAt) / 1000;
        const rateNow = totalAttempts / Math.max(elapsed, 1);
        process.stderr.write(`attempts=${totalAttempts} rate=${rateNow.toFixed(1)}/s elapsed=${formatDuration(elapsed)}\n`);
      }
      if (message.type === 'found') {
        foundCount += 1;
        totalAttempts += message.attempts;
        const record = {
          found: true,
          foundCount,
          matchedSuffix: message.match.suffix,
          matchedWalletVersion: message.match.walletVersion,
          walletVersionSearchMode: options.walletVersion,
          friendlyForm: options.bounceable ? 'bounceable' : 'non-bounceable',
          suffixes: options.suffixes,
          attempts: totalAttempts,
          elapsed: formatDuration((Date.now() - startedAt) / 1000),
          address: message.match.address,
          mnemonic: message.candidate.mnemonic,
          warning: 'Keep this mnemonic private. Do not paste it into chat, GitHub, screenshots, or logs.',
        };
        if (options.keepGoing) {
          appendFileSync(outputPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
          console.log(JSON.stringify({
            foundCount,
            matchedSuffix: record.matchedSuffix,
            address: record.address,
            savedTo: outputPath,
            elapsed: record.elapsed,
            attempts: totalAttempts,
          }, null, 2));
          return;
        }
        done = true;
        for (const item of workers) {
          if (item !== worker) item.terminate();
        }
        console.log(JSON.stringify(record, null, 2));
      }
      if (message.type === 'error') {
        done = true;
        for (const item of workers) item.terminate();
        console.error(message.error);
        process.exit(1);
      }
    });
    worker.on('error', (err) => {
      if (!done) {
        done = true;
        for (const item of workers) item.terminate();
        console.error(err);
        process.exit(1);
      }
    });
    workers.push(worker);
  }
}

if (!isMainThread && workerData?.mode === 'search') {
  runWorker().catch((err) => {
    parentPort.postMessage({ type: 'error', error: String(err?.stack ?? err) });
  });
}

if (isMainThread && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
