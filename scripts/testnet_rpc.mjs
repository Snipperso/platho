// Shared testnet RPC helper. Reads endpoint + API key from .env.testnet.local (gitignored).
// The key is passed into TonClient and NEVER printed.
import { readFileSync } from 'fs';
import { TonClient } from '@ton/ton';

export function parseEnv(path = '.env.testnet.local') {
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

export function makeTestnetClient(env = parseEnv()) {
  const endpoint = env.PLATHO_TON_RPC_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
  if (!endpoint.includes('testnet')) throw new Error('endpoint must be testnet');
  const apiKey = env.PLATHO_TON_RPC_API_KEY || undefined;
  return { client: new TonClient({ endpoint, apiKey }), hasKey: !!apiKey, endpoint };
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Sanitize any error so it NEVER carries axios config/headers (which include X-API-Key).
function sanitize(e) {
  const status = e?.response?.status ?? e?.status;
  const msg = String(e?.message ?? e).replace(/[a-f0-9]{48,}/gi, '<redacted>').slice(0, 120);
  const clean = new Error(status ? `HTTP ${status}: ${msg}` : msg);
  return clean; // deliberately drops e.config / e.request / e.response
}

// Spaced + backoff wrapper so even the keyless path degrades gracefully; keyed is fast.
export async function rpc(label, action, { spacingMs = 1200, tries = 6 } = {}) {
  let last;
  for (let a = 0; a < tries; a++) {
    try { const r = await action(); await sleep(spacingMs); return r; }
    catch (e) {
      last = sanitize(e);
      const status = e?.response?.status ?? e?.status;
      if (status !== 429) throw last;
      await sleep(1500 + a * 1500);
    }
  }
  throw last;
}
