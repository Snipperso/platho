import { ed25519 } from './vendor/@noble/curves/ed25519.js';

export const TELEGRAM_INIT_DATA_PUBLIC_KEY_HEX = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

function hexToBytes(hex) {
  const text = String(hex);
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(text)) throw new TypeError('hex expected');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function base64UrlToBytes(text) {
  const value = String(text);
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) throw new TypeError('base64url expected');
  const padded = value.replace(/=+$/, '').replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function telegramInitDataCheckString(initData, botId) {
  const fields = [];
  for (const [key, value] of new URLSearchParams(String(initData ?? ''))) {
    if (key !== 'hash' && key !== 'signature') fields.push([key, value]);
  }
  fields.sort(([a], [b]) => (a < b ? -1 : (a > b ? 1 : 0)));
  return `${botId}:WebAppData\n${fields.map(([key, value]) => `${key}=${value}`).join('\n')}`;
}

export function telegramLaunchSignedFor(initData, botId, { publicKeyHex = TELEGRAM_INIT_DATA_PUBLIC_KEY_HEX } = {}) {
  if (!initData || !/^[1-9][0-9]{0,19}$/.test(String(botId ?? ''))) return false;
  const signature = new URLSearchParams(String(initData)).get('signature');
  if (!signature) return false;
  try {
    const bytes = base64UrlToBytes(signature);
    if (bytes.length !== 64) return false;
    const message = new TextEncoder().encode(telegramInitDataCheckString(initData, botId));
    return ed25519.verify(bytes, message, hexToBytes(publicKeyHex), { zip215: false }) === true;
  } catch {
    return false;
  }
}
