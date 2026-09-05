#!/usr/bin/env node
/*
 * Is the site answering, and if not, does anyone know — and is the thing we are about to restart actually at fault?
 *
 * On 2026-08-20 platho.app was dead for forty minutes before its owner noticed. Everything else that day was made
 * worse by those forty minutes. This file was written that afternoon, reviewed adversarially the same evening,
 * and every guard below exists because the absence of it was OBSERVED — in production, in a drill, or in a review
 * that reproduced the failure. Nothing here is defensive decoration.
 *
 * TWO ROLES, and the difference is enforced rather than documented:
 *
 *   OBSERVER   --url https://platho.app/
 *              Runs somewhere that is NOT the server. Alerts. Never repairs anything.
 *
 *   WATCHDOG   --url https://platho.app/ --resolve-to 127.0.0.1 --recover "systemctl restart caddy"
 *              Runs ON the server and probes ITSELF. May repair. `--recover` is REFUSED unless `--resolve-to`
 *              names an address of THIS machine, because on 2026-08-20 13:54 a watchdog probing the public NAME
 *              restarted a perfectly healthy Caddy when the box lost its network — a fault entirely outside the
 *              process it killed. Checking that the flag was merely PRESENT was not enough: `--resolve-to` with
 *              another server's public address reproduces the same incident exactly.
 *
 * The probe uses curl when pinned to an address: fetch() SILENTLY DISCARDS a `Host` header (it is a forbidden
 * header name), so an earlier `--host` flag was a no-op and the self-probe asked Caddy about a vhost that does
 * not exist. curl --resolve sets both the connection target and the TLS server name, which is what was meant.
 */
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createConnection } from 'node:net';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback = null) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

/** A number from the command line, or die. NaN used to mean "never alert" and "probe every 2ms", both silently. */
function num(name, fallback, { integer = false } = {}) {
  const raw = arg(name, null);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    console.error(`--${name} must be a positive ${integer ? 'integer' : 'number'}, got "${raw}"`);
    process.exit(1);
  }
  return value;
}

const URL_TO_CHECK = arg('url', 'https://platho.app/');
const RESOLVE_TO = arg('resolve-to', null);      // pin the connection to this address -> this is a SELF probe
const CHAT = arg('chat', null);
const EXPECT = arg('expect', null);              // a substring the body must contain
const INTERVAL_MS = num('interval', 60) * 1000;
const TIMEOUT_MS = num('timeout', 15) * 1000;
const TELEGRAM_TIMEOUT_MS = 20_000;
const FAILURES_TO_ALERT = num('failures', 3, { integer: true });
const RECOVER_CMD = arg('recover', null);
const RECOVER_TIMEOUT_MS = 60_000;
const RECOVERY_LIMIT_PER_HOUR = num('max-recoveries-per-hour', 3, { integer: true });
const CANARY = arg('require-network', '1.1.1.1');   // proves the BOX has a network before blaming a process
const CANARY_PORT = num('require-network-port', 443, { integer: true });
const STATE_FILE = arg('state', `${ROOT}/artifacts/local/uptime-watch-state.json`);
const TOKEN_FILE = arg('token-file', `${ROOT}/artifacts/local/telegram-bot.txt`);
const LABEL = arg('label', new URL(URL_TO_CHECK).host);
const ONCE = has('once');

// STRUCTURAL, not advisory, and it checks the VALUE rather than the presence of the flag.
if (RECOVER_CMD !== null && RECOVER_CMD.trim() === '') {
  console.error('--recover was given an empty command. Refusing to start silently as an observer: a watchdog that '
    + 'quietly stopped being able to repair anything is worse than one that never claimed to.');
  process.exit(1);
}
if (RECOVER_CMD) {
  const local = new Set(['127.0.0.1', '::1', 'localhost']);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) local.add(address.address);
  }
  if (!RESOLVE_TO || !local.has(RESOLVE_TO)) {
    console.error(`--recover requires --resolve-to <an address of THIS machine>; got ${RESOLVE_TO ?? '(nothing)'}.\n`
      + 'Recovery may only be driven by a probe of the machine it can repair. A probe of a public name — or of\n'
      + "another server's address — cannot tell \"our web server broke\" from \"this box lost its network\", and on\n"
      + '2026-08-20 that distinction was the difference between a repair and an outage.');
    process.exit(1);
  }
}

function botToken() {
  try {
    const fromEnv = (process.env.PLATHO_TELEGRAM_BOT_TOKEN ?? '').trim();
    if (fromEnv) return fromEnv;
    if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch (error) {
    // An unreadable token file must not take the monitor down with it — the whole point is to outlive trouble.
    console.error(`[watch] token unreadable: ${error.message}`);
  }
  return null;
}

let alertingIsDead = false;   // set only by a PERMANENT Telegram refusal; stops an endless pointless retry loop

/** Returns true only when Telegram CONFIRMED delivery. The caller must not record an alert it did not send. */
async function tell(text) {
  if (alertingIsDead) return false;
  const token = botToken();
  if (!token || !CHAT) { console.error(`[watch] nowhere to send; would have said: ${text}`); return false; }
  const controller = new AbortController();
  // tell() once had no timeout, so a black-holed route to Telegram could stall the probe loop for minutes —
  // during exactly the partial-network failures this exists for.
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ chat_id: CHAT, text: text.slice(0, 3900), disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const detail = String(await res.text()).slice(0, 200);
      // A wrong token or chat id is not a blip: retrying it every minute forever buries the real reason in noise
      // and never delivers anything. Say it once, loudly, and stop.
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        alertingIsDead = true;
        console.error(`[watch] ALERTING IS DEAD — Telegram refused permanently (HTTP ${res.status}): ${detail}`);
        console.error('[watch] nothing will be delivered until the token or chat id is fixed and this restarts.');
      } else {
        console.error(`[watch] telegram refused: HTTP ${res.status} ${detail}`);
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[watch] telegram unreachable: ${detailOf(error, TELEGRAM_TIMEOUT_MS)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** undici collapses every transport failure into "fetch failed"; the diagnosis lives in .cause. */
function detailOf(error, timeoutMs) {
  if (error?.name === 'AbortError') return `no answer in ${Math.round(timeoutMs / 1000)}s`;
  const cause = error?.cause;
  const code = cause?.code ?? cause?.message;
  return code ? `${error.message} (${code})` : String(error?.message ?? error);
}

function run(cmd, args, timeoutMs) {
  return new Promise((done) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), timedOut: error?.killed === true });
    });
  });
}

/**
 * One probe. Never throws — a monitor that dies is worse than one that lies.
 *
 * Reads the BODY, not just the status: "the root answered 200" is a long way from "the app loads". An empty
 * index, a half-deployed tree, a dangling `current` symlink and a defacement all score 200.
 */
async function probe() {
  if (RESOLVE_TO) {
    const target = new URL(URL_TO_CHECK);
    const port = target.port || (target.protocol === 'https:' ? '443' : '80');
    const { error, stdout, stderr, timedOut } = await run('curl', [
      // -sS, not -s: silent progress but KEEP the error line. Without -S the failure reads "Command failed",
      // which is the same uselessness as undici's "fetch failed" that detailOf() exists to unwrap.
      '-sS', '--max-time', String(TIMEOUT_MS / 1000),
      // A body larger than this is not a shell, and without the cap a big response overruns execFile's buffer
      // and reports a spawn error — indistinguishable from "the site is down", forever, on a healthy server.
      '--max-filesize', '4000000',
      '--resolve', `${target.hostname}:${port}:${RESOLVE_TO}`,
      '-w', '\n%{http_code}', URL_TO_CHECK,
    ], TIMEOUT_MS + 5000);
    if (error) {
      if (timedOut) return { ok: false, detail: `no answer in ${TIMEOUT_MS / 1000}s` };
      const why = stderr.replace(/^curl:\s*(\(\d+\)\s*)?/i, '').trim().split('\n')[0];
      return { ok: false, detail: why || `curl failed: ${String(error.message).split('\n')[0]}` };
    }
    const cut = stdout.lastIndexOf('\n');
    const status = Number(stdout.slice(cut + 1).trim());
    const body = stdout.slice(0, cut);
    return judge(status, body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL_TO_CHECK, { signal: controller.signal, redirect: 'manual' });
    return judge(res.status, EXPECT ? await res.text() : '');
  } catch (error) {
    return { ok: false, detail: detailOf(error, TIMEOUT_MS) };
  } finally {
    clearTimeout(timer);
  }
}

/** 2xx only. A 3xx is not health — neither probe path follows redirects, so nobody ever saw the page behind it. */
function judge(status, body) {
  if (!(status >= 200 && status < 300)) return { ok: false, detail: `HTTP ${status || 'no answer'}` };
  if (EXPECT && !body.includes(EXPECT)) return { ok: false, detail: `HTTP ${status} but body lacks "${EXPECT}"` };
  return { ok: true, detail: `HTTP ${status}` };
}

/**
 * Does this MACHINE have a network at all?
 *
 * 2026-08-20 13:54: the provider's network went away, the probe failed, and the watchdog restarted a healthy
 * Caddy — killing live connections to fix a fault that was not in the building. A repair must be preceded by
 * evidence that the thing being repaired is the thing that broke.
 *
 * A TCP connect, NOT ping. Spawning ping made the answer depend on a binary that minimal containers often lack
 * and on ICMP being permitted — and both of those failures look exactly like "the network is gone", so the
 * watchdog would have announced a confident false cause and disabled its own recovery permanently.
 */
function boxIsOnline() {
  if (!CANARY) return Promise.resolve(true);
  return new Promise((done) => {
    const socket = createConnection({ host: CANARY, port: CANARY_PORT });
    const finish = (result) => { socket.destroy(); done(result); };
    socket.setTimeout(5000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

const EMPTY_STATE = { healthy: true, consecutiveFailures: 0, alertedDown: false, recoverTried: false, recoveries: [] };
let memoryState = null;     // survives an unwritable state file, which is otherwise a silent blindfold

function readState() {
  if (memoryState) return memoryState;
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    // Shape, not just syntax. `?? []` only guards null/undefined, so a hand-edited or older-format file with a
    // non-array in `recoveries` threw TypeError out of the top-level await and killed the daemon outright.
    return {
      ...EMPTY_STATE,
      ...parsed,
      recoveries: Array.isArray(parsed?.recoveries) ? parsed.recoveries.filter(Number.isFinite) : [],
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/** Atomic, and a failure here is itself worth knowing about — a full disk is both a cause of outages and, before
 *  this, a reason the monitor would never count past one failure and so never alert. */
let stateWriteBroken = false;
function writeState(state) {
  memoryState = state;
  try {
    writeFileSync(`${STATE_FILE}.tmp`, JSON.stringify(state, null, 1), 'utf8');
    renameSync(`${STATE_FILE}.tmp`, STATE_FILE);
    stateWriteBroken = false;
  } catch (error) {
    if (!stateWriteBroken) console.error(`[watch] STATE UNWRITABLE (counting in memory): ${error.message}`);
    stateWriteBroken = true;
  }
}

const recentRecoveries = (state, nowMs) => state.recoveries.filter((at) => nowMs - at < 3_600_000);

async function tick(nowMs = Date.now()) {
  const state = readState();
  const { ok, detail } = await probe();
  const stamp = new Date(nowMs).toISOString().replace('T', ' ').slice(0, 19);

  if (ok) {
    if (!state.healthy && state.alertedDown) {
      const told = await tell(`✅ ${LABEL} is answering again (${detail})\n${stamp} UTC`);
      if (!told) {
        // ASYMMETRY WAS THE BUG. The down path retried until delivered; the recovery path fired once and reset
        // regardless, and it is the message most likely to be lost — the network has only just come back. The
        // last thing in the chat then stays "🔴 not answering", and somebody drives to fix a working server.
        console.error('[watch] recovery message not delivered — staying latched so the next tick retries');
        writeState({ ...EMPTY_STATE, healthy: true, alertedDown: true, recoveries: recentRecoveries(state, nowMs) });
        return;
      }
    }
    writeState({ ...EMPTY_STATE, recoveries: recentRecoveries(state, nowMs) });
    console.error(`[watch] ${stamp} ${LABEL} ok — ${detail}`);
    return;
  }

  const failures = Number(state.consecutiveFailures ?? 0) + 1;
  console.error(`[watch] ${stamp} ${LABEL} FAILED (${failures}/${FAILURES_TO_ALERT}) — ${detail}`);

  const lines = [`🔴 ${LABEL} is not answering — ${detail}`, `${stamp} UTC`];
  let recoveries = recentRecoveries(state, nowMs);
  let recoverTried = state.recoverTried === true;

  // ONE ATTEMPT PER OUTAGE, and it is latched by ITS OWN flag.
  //
  // Both branches used to be gated on `!alertedDown`, which is only set once Telegram CONFIRMS delivery — so
  // while Telegram was unreachable the repair command ran again on EVERY tick. Reproduced in review: three
  // `systemctl restart caddy` in three minutes, each cutting live connections. And Telegram being unreachable is
  // not an exotic case here; it is a symptom of the very outages this watches for.
  if (failures >= FAILURES_TO_ALERT && RECOVER_CMD && !recoverTried) {
    recoverTried = true;
    if (!(await boxIsOnline())) {
      // The single most useful sentence this monitor can produce: it tells the reader where NOT to look.
      lines.push(`this machine cannot reach ${CANARY}:${CANARY_PORT} either — the network is gone, not the web server`);
      lines.push('no restart attempted');
    } else if (recoveries.length >= RECOVERY_LIMIT_PER_HOUR) {
      lines.push(`already restarted ${recoveries.length}x this hour — not restarting again, this needs a human`);
    } else {
      const { error, stderr, timedOut } = await run('/bin/sh', ['-c', RECOVER_CMD], RECOVER_TIMEOUT_MS);
      recoveries = [...recoveries, nowMs];
      if (timedOut) {
        // The shell was killed; `systemctl restart` is its child and may well still be running. Saying "FAILED"
        // here would be a guess, and a wrong one often enough to send someone the wrong way.
        lines.push(`restart did not finish within ${RECOVER_TIMEOUT_MS / 1000}s and may still be running`);
      } else if (error) {
        lines.push(`restart FAILED: ${String(stderr || error.message).slice(0, 200)}`);
      } else {
        // Say what HAPPENED, not what was attempted. An earlier version claimed a restart without re-checking.
        const after = await probe();
        lines.push(after.ok ? `restarted the web server — it is answering again (${after.detail})`
          : `restarted the web server — still not answering (${after.detail})`);
      }
    }
  }

  if (failures >= FAILURES_TO_ALERT && !state.alertedDown) {
    // ONLY latch when Telegram confirmed. Losing the message used to be recorded as having sent it, so an outage
    // that took the network down with it went completely unannounced — observed on 2026-08-20 13:54.
    const told = await tell(lines.join('\n'));
    writeState({ healthy: false, consecutiveFailures: failures, alertedDown: told, recoverTried, recoveries });
    if (!told) console.error('[watch] alert not delivered — will retry on the next tick');
    return;
  }
  writeState({
    healthy: false,
    consecutiveFailures: failures,
    alertedDown: state.alertedDown === true,
    recoverTried,
    recoveries,
  });
}

// A daemon that dies leaves no trace of why the site was never reported down. Log and keep the loop alive.
process.on('unhandledRejection', (reason) => console.error(`[watch] unhandled rejection: ${reason}`));
process.on('uncaughtException', (error) => console.error(`[watch] uncaught: ${error?.stack ?? error}`));

/**
 * Seconds since THIS machine booted, or null where that cannot be read.
 *
 * /proc/uptime rather than os.uptime() only because the former makes the source explicit: both read the same
 * file, and inside these LXC containers it is the CONTAINER's uptime, not the host's — verified 2026-09-05,
 * when A reported "up 15 days 21:57" against a journal boot of 2026-08-20 12:02, to the minute. Do not assume
 * the same of every /proc file here: /proc/loadavg on the same machines leaks the HOST's numbers (load 4.2 and
 * 14317 tasks while every local process idles), because this host runs no lxcfs.
 */
function machineUptimeSeconds() {
  try {
    const seconds = Number.parseFloat(readFileSync('/proc/uptime', 'utf8').split(/\s+/)[0]);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  } catch {
    // Not Linux, or /proc is not mounted. The ping is still worth sending without this.
  }
  return null;
}

/** Coarse on purpose: this is read at a glance in a chat window, not subtracted from anything. */
function humanDuration(seconds) {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Longer than any boot here (the container reaches this unit ~2s in) and shorter than any plausible gap
 *  between a boot and someone restarting the unit by hand. */
const JUST_BOOTED_S = 180;

if (ONCE) {
  await tick();
} else {
  const role = RECOVER_CMD ? 'watchdog (may restart)' : 'observer (alert only)';
  console.error(`[watch] ${LABEL} every ${INTERVAL_MS / 1000}s -> ${CHAT ?? 'nowhere'} | ${role}`);
  // A startup ping validates the token and the chat id NOW rather than during the first real outage, and gives
  // the reader something that distinguishes "quiet because all is well" from "quiet because I am not running".
  //
  // It also carries the machine's uptime, because on 2026-09-05 three reboots (the provider restarted B at
  // 09:52 and A at 10:35, then A again at 11:24) produced three IDENTICAL "watch started" lines. That message
  // is in fact the most reliable reboot detector here — it fires exactly once per boot, where the 60s polling
  // observer missed a 2s outage entirely by sampling either side of it — but it could not say whether the
  // machine had rebooted or somebody had merely restarted the unit. Now it says which.
  const uptime = machineUptimeSeconds();
  const since = uptime === null ? 'machine uptime unknown'
    : uptime < JUST_BOOTED_S ? `MACHINE REBOOTED ${humanDuration(uptime)} ago`
    : `service restarted; machine up ${humanDuration(uptime)}`;
  if (!(await tell(`👁 ${LABEL} watch started — ${role} | ${since}`))) {
    console.error('[watch] WARNING: the startup ping was not delivered. Alerting may be misconfigured; this '
      + 'process will keep probing, but nothing it finds may reach anyone.');
  }
  for (;;) {
    const startedAt = Date.now();
    await tick(startedAt);
    // Schedule from the START of the tick, not its end. A tick can take longer than the interval (probe, then
    // a canary check, then a repair, then a re-probe, then Telegram), and sleeping a fixed interval AFTER all of
    // that stretched the cycle to ~130s during an outage — so "3 failures in a row" quietly stopped meaning
    // three minutes at exactly the moment somebody would be reading the timestamps.
    await new Promise((r) => setTimeout(r, Math.max(1000, INTERVAL_MS - (Date.now() - startedAt))));
  }
}
