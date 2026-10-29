import { existsSync, readFileSync } from 'node:fs';

const KEY_FILE = new URL('../../artifacts/local/center.txt', import.meta.url);

export function toncenterAccess() {
  let key = String(process.env.TONCENTER_API_KEY ?? '').trim();
  if (!key && existsSync(KEY_FILE)) {
    try { key = readFileSync(KEY_FILE, 'utf8').trim(); } catch { key = ''; }
  }
  if (!/^[0-9a-f]{64}$/i.test(key)) key = '';
  return Object.freeze({ keyed: Boolean(key), headers: Object.freeze(key ? { 'X-API-Key': key } : {}), spacingMs: key ? 120 : 1100 });
}
