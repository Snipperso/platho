#!/usr/bin/env node
/*
 * Is the site answering, and if not, does anyone know?
 *
 * On 2026-08-20 platho.app was dead for forty minutes before its owner noticed, and the first thing he knew about
 * it was that his own app would not load. Everything else that day — the OOM, the crash loop, the lost SSH, the
 * VPS resize — was made worse by those forty minutes.
 *
 * TWO ROLES, one script:
 *
 *   --url http://127.0.0.1/ --host platho.app --recover "systemctl restart caddy"
 *       Runs ON the server. Catches the common failure (the web server died, the machine lives) and fixes it
 *       without waking anybody, then says what it did.
 *
 *   --url https://platho.app/
 *       Runs ANYWHERE ELSE. Catches the failure the local one cannot see: the whole machine gone. Alerts only.
 *
 * A watcher on the machine it watches is not a monitor, it is a coin flip — so the second role must live
 * somewhere else. Together they cover both shapes.
 *
 * ALERTS ON TRANSITIONS, never on every check: an outage produces two messages (down, then back), not one per
 * probe. State lives in a small file so a restart of this script cannot re-announce an outage that is over.
 *
 * The Telegram bot token is read from a file, never from the command line — arguments land in shell history and
 * in `ps`. Default: artifacts/local/telegram-bot.txt (gitignored), overridable with --token-file or the
 * PLATHO_TELEGRAM_BOT_TOKEN environment variable.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback = null) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};

const URL_TO_CHECK = arg('url', 'https://platho.app/');
const HOST_HEADER = arg('host', null);                 // for a local probe against 127.0.0.1
// REQUIRED, with no default. A default would be somebody's actual Telegram handle or numeric id living in a
// public repository — the destination is deployment configuration, not source.
const CHAT = arg('chat', null);
const INTERVAL_MS = Number(arg('interval', 60)) * 1000;
const TIMEOUT_MS = Number(arg('timeout', 15)) * 1000;
const FAILURES_TO_ALERT = Number(arg('failures', 3));  // three misses, not one: a single blip is not an outage
const RECOVER_CMD = arg('recover', null);
const STATE_FILE = arg('state', `${ROOT}/artifacts/local/uptime-watch-state.json`);
const TOKEN_FILE = arg('token-file', `${ROOT}/artifacts/local/telegram-bot.txt`);
const LABEL = arg('label', new URL(URL_TO_CHECK).host);
const ONCE = process.argv.includes('--once');

function botToken() {
  const fromEnv = (process.env.PLATHO_TELEGRAM_BOT_TOKEN ?? '').trim();
  if (fromEnv) return fromEnv;
  if (existsSync(TOKEN_FILE)) return readFileSync(TOKEN_FILE, 'utf8').trim();
  return null;
}

async function tell(text) {
  const token = botToken();
  if (!token) { console.error(`[watch] no bot token; would have said: ${text}`); return false; }
  if (!CHAT) { console.error(`[watch] no --chat given; would have said: ${text}`); return false; }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
    });
    if (!res.ok) console.error(`[watch] telegram refused: HTTP ${res.status} ${String(await res.text()).slice(0, 160)}`);
    return res.ok;
  } catch (error) {
    console.error(`[watch] telegram unreachable: ${error.message}`);
    return false;
  }
}

/** One probe. Returns { ok, detail } — never throws, because a monitor that dies is worse than one that lies. */
async function probe() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL_TO_CHECK, {
      signal: controller.signal,
      redirect: 'manual',
      headers: HOST_HEADER ? { Host: HOST_HEADER } : {},
    });
    // 2xx and 3xx both mean "the server is answering"; the redirect to https is a healthy answer, not a fault.
    const ok = res.status >= 200 && res.status < 400;
    return { ok, detail: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, detail: error.name === 'AbortError' ? `no answer in ${TIMEOUT_MS / 1000}s` : error.message };
  } finally {
    clearTimeout(timer);
  }
}

function readState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch { return { healthy: true, consecutiveFailures: 0, alertedDown: false, recoveredAt: null }; }
}

function writeState(state) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 1), 'utf8'); }
  catch (error) { console.error(`[watch] could not persist state: ${error.message}`); }
}

function runRecovery() {
  return new Promise((done) => {
    if (!RECOVER_CMD) return done(null);
    execFile('/bin/sh', ['-c', RECOVER_CMD], { timeout: 60_000 }, (error, stdout, stderr) => {
      done(error ? `failed: ${String(stderr || error.message).slice(0, 200)}` : 'ok');
    });
  });
}

async function tick() {
  const state = readState();
  const { ok, detail } = await probe();
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  if (ok) {
    if (!state.healthy && state.alertedDown) {
      await tell(`✅ ${LABEL} is answering again (${detail})\n${stamp} UTC`);
    }
    writeState({ healthy: true, consecutiveFailures: 0, alertedDown: false, recoveredAt: stamp });
    console.error(`[watch] ${stamp} ${LABEL} ok — ${detail}`);
    return;
  }

  const failures = Number(state.consecutiveFailures ?? 0) + 1;
  console.error(`[watch] ${stamp} ${LABEL} FAILED (${failures}/${FAILURES_TO_ALERT}) — ${detail}`);

  let recovery = null;
  // Recovery fires ONCE per outage, at the alert threshold — not on every failed probe, or a machine that cannot
  // serve would be restarted every minute forever.
  if (failures === FAILURES_TO_ALERT && RECOVER_CMD) recovery = await runRecovery();

  if (failures >= FAILURES_TO_ALERT && !state.alertedDown) {
    const lines = [`🔴 ${LABEL} is not answering — ${detail}`, `${stamp} UTC`];
    if (recovery) lines.push(recovery === 'ok' ? 'tried to restart the web server' : `restart ${recovery}`);
    await tell(lines.join('\n'));
    writeState({ healthy: false, consecutiveFailures: failures, alertedDown: true, recoveredAt: state.recoveredAt ?? null });
    return;
  }
  writeState({ healthy: false, consecutiveFailures: failures, alertedDown: state.alertedDown === true, recoveredAt: state.recoveredAt ?? null });
}

if (ONCE) {
  await tick();
} else {
  console.error(`[watch] ${LABEL} every ${INTERVAL_MS / 1000}s -> ${CHAT}${RECOVER_CMD ? ' (with recovery)' : ''}`);
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}
