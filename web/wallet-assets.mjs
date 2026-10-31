import { isVerifiedJettonMaster, isVerifiedNftCollection } from './verified-assets.mjs?v=6';
import { parseTelegramGiftItemUri } from './telegram-gift-nfts.mjs?v=27';

export const WALLET_TOKEN_PAGE = 1000;
export const WALLET_NFT_PAGE = 1000;
export const WALLET_LIST_PAGES = 5;
export const WALLET_HISTORY_PAGE = 30;
export const WALLET_GRAM_DUST_NANOTONS = 10_000_000n;
export const WALLET_HISTORY_READ_ON = 6;

export function rawAccount(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return /^-?\d+:[0-9a-f]{64}$/.test(text) ? text : '';
}

export const TONCENTER_PICTURE_HOSTS = Object.freeze(['imgproxy.toncenter.com', 'proxy.toncenter.com']);
export function toncenterPicture(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && !url.username && !url.password && TONCENTER_PICTURE_HOSTS.includes(url.hostname.toLowerCase()) ? url.href : '';
  } catch { return ''; }
}

export function formatUnits(amount, decimals = 9, { shown = 4 } = {}) {
  let units;
  try { units = BigInt(String(amount ?? '0')); } catch { return '0'; }
  const negative = units < 0n;
  if (negative) units = -units;
  const places = Math.max(0, Math.min(36, Number.isInteger(Number(decimals)) ? Number(decimals) : 9));
  const base = 10n ** BigInt(places);
  const whole = units / base;
  let fraction = places ? (units % base).toString().padStart(places, '0').slice(0, Math.min(places, shown)) : '';
  if (units > 0n && whole === 0n && places && !/[1-9]/.test(fraction)) {
    const all = (units % base).toString().padStart(places, '0');
    fraction = all.slice(0, all.search(/[1-9]/) + 1);
  }
  fraction = fraction.replace(/0+$/, '');
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const text = fraction ? `${wholeText}.${fraction}` : wholeText;
  return negative && text !== '0' ? `-${text}` : text;
}

function infoOf(metadata, address) {
  const entry = metadata?.[String(address ?? '').toUpperCase()] ?? metadata?.[String(address ?? '')] ?? null;
  const info = Array.isArray(entry?.token_info) ? entry.token_info.find((one) => one?.valid !== false) ?? entry.token_info[0] : null;
  return info && typeof info === 'object' ? info : {};
}
export const WALLET_INLINE_PICTURE_MAX = 64 * 1024;
const INLINE_PICTURE_KINDS = [['PHN2Zy', 'svg+xml'], ['PD94bW', 'svg+xml'], ['iVBORw0KGgo', 'png'], ['/9j/', 'jpeg'], ['UklGR', 'webp'], ['R0lGOD', 'gif']];
export function inlinePictureOf(info) {
  const image = String(info?.image ?? '').trim();
  const carried = /^data:image\/(svg\+xml|png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (image.length <= WALLET_INLINE_PICTURE_MAX && carried && wholePicture(carried[1], carried[2])) return image;
  const data = String(info?.extra?.image_data ?? '').replace(/\s+/g, '');
  if (!data || data.length > WALLET_INLINE_PICTURE_MAX || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return '';
  const kind = INLINE_PICTURE_KINDS.find(([head]) => data.startsWith(head))?.[1];
  return kind && wholePicture(kind, data) ? `data:image/${kind};base64,${data}` : '';
}
function wholePicture(kind, base64) {
  if (kind !== 'svg+xml') return true;
  try {
    const svg = atob(base64);
    return /<\/svg>\s*$/.test(svg) || /^\s*(?:<\?xml[^>]*>\s*)?<svg\b[^<>]*\/>\s*$/.test(svg);
  } catch { return false; }
}
const FIRST_PARTY_NFT_COLLECTIONS = new Set([
  '0:b774d95eb20543f186c06b371ab88ad704f7e256130caf96189368a7d0cb6ccf',
  '0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2',
]);
export function listedNftCollection(collection) {
  return isVerifiedNftCollection(collection) || FIRST_PARTY_NFT_COLLECTIONS.has(rawAccount(collection));
}
function pictureOf(info, size = '_image_small') {
  return toncenterPicture(info?.extra?.[size]) || toncenterPicture(info?.extra?._image_medium) || toncenterPicture(info?.image);
}
function attributesOf(info) {
  const out = [];
  for (const one of Array.isArray(info?.extra?.attributes) ? info.extra.attributes : []) {
    const trait = text(one?.trait_type, 32);
    const value = typeof one?.value === 'number' && Number.isFinite(one.value) ? String(one.value) : text(one?.value, 48);
    if (trait && value) out.push({ trait, value });
    if (out.length >= 12) break;
  }
  return out;
}
function contentUriOf(content) {
  const uri = content?.uri;
  return typeof uri === 'string' && uri.length <= 512 ? uri : '';
}
function text(value, max = 80) {
  return typeof value === 'string'
    ? Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '').trim()).slice(0, max).join('') : '';
}

async function indexRead(path, params, { fetchImpl, origin = 'https://toncenter.com', apiKey = null } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('wallet assets: no fetch available');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = String(apiKey);
  const response = await fetchImpl(`${origin}/api/v3/${path}?${query}`, { headers, cache: 'no-store' });
  if (!response?.ok) {
    const error = new Error(`wallet assets: the index answered ${response?.status ?? 'nothing'}`);
    error.status = Number(response?.status) || 0;
    throw error;
  }
  return response.json();
}
async function indexPages(path, params, key, access) {
  let payload = null;
  for (let page = 0; page < WALLET_LIST_PAGES; page += 1) {
    const next = await indexRead(path, { ...params, offset: page * params.limit }, access);
    const rows = Array.isArray(next?.[key]) ? next[key] : [];
    payload = payload === null ? { ...next, [key]: rows }
      : { ...payload, [key]: [...payload[key], ...rows], metadata: { ...(payload.metadata ?? {}), ...(next?.metadata ?? {}) } };
    if (rows.length < params.limit) return { payload, capped: 0 };
  }
  return { payload, capped: payload[key].length };
}
function withCap(list, capped) {
  return capped ? Object.defineProperty(list, 'capped', { value: capped }) : list;
}

export function decimalsOf(info) {
  const raw = info?.extra?.decimals;
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  return /^\d{1,2}$/.test(text) && Number(text) <= 36 ? Number(text) : null;
}

export function parseJettonBalances(payload, { alsoVerified = [] } = {}) {
  const extra = new Set(alsoVerified.map(rawAccount).filter(Boolean));
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(payload?.jetton_wallets) ? payload.jetton_wallets : []) {
    const master = rawAccount(row?.jetton);
    if (!master || seen.has(master)) continue;
    let balance = '0';
    try { balance = BigInt(String(row?.balance ?? '0')).toString(); } catch { continue; }
    if (balance === '0') continue;
    seen.add(master);
    const info = infoOf(payload?.metadata, row.jetton);
    const stated = decimalsOf(info);
    const decimals = stated ?? 9;
    const scam = info?.is_scam === true;
    const verified = !scam && (isVerifiedJettonMaster(master) || extra.has(master));
    out.push({
      master,
      wallet: rawAccount(row?.address),
      balance,
      decimals,
      decimalsKnown: stated !== null,
      name: text(info?.name) || text(info?.symbol) || '',
      symbol: text(info?.symbol, 16),
      picture: verified ? pictureOf(info) || (extra.has(master) ? inlinePictureOf(info) : '') : '',
      verified,
      scam,
    });
  }
  const byName = (a, b) => (a.name || a.symbol || a.master).localeCompare(b.name || b.symbol || b.master);
  return [...out.filter((one) => one.verified).sort(byName), ...out.filter((one) => !one.verified).sort(byName)];
}
export async function readJettonBalances({ owner, alsoVerified = [], ...access } = {}) {
  const account = rawAccount(owner);
  if (!account) throw new Error('wallet assets: an owner is required');
  const { payload, capped } = await indexPages('jetton/wallets', { owner_address: account, exclude_zero_balance: 'true', limit: WALLET_TOKEN_PAGE }, 'jetton_wallets', access);
  return withCap(parseJettonBalances(payload, { alsoVerified }), capped);
}

export async function readCardBalances({ owner, jettonMaster, ...access } = {}) {
  const account = rawAccount(owner);
  const master = rawAccount(jettonMaster);
  if (!account || !master) throw new Error('wallet assets: an owner and a jetton are required');
  const state = await indexRead('walletInformation', { address: account, use_v2: 'false' }, access);
  const wallets = await indexRead('jetton/wallets', { owner_address: account, jetton_address: master, limit: 1, offset: 0 }, access);
  const row = (Array.isArray(wallets?.jetton_wallets) ? wallets.jetton_wallets : [])
    .find((one) => rawAccount(one?.jetton) === master && rawAccount(one?.owner) === account);
  const digits = (value) => (/^\d+$/.test(String(value ?? '')) ? String(value) : '0');
  return { gram: digits(state?.balance), jetton: digits(row?.balance) };
}

export function parseNftItems(payload, { verifiedItems = [], verifiedCollections = [], giftVerdictsKnown = true, examinedItems = null } = {}) {
  const examined = Array.isArray(examinedItems) ? new Set(examinedItems.map(rawAccount).filter(Boolean)) : null;
  const proven = new Set(verifiedItems.map(rawAccount).filter(Boolean));
  const ownCollections = new Set(verifiedCollections.map(rawAccount).filter(Boolean));
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(payload?.nft_items) ? payload.nft_items : []) {
    const address = rawAccount(row?.address);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    const info = infoOf(payload?.metadata, row.address);
    const collection = rawAccount(row?.collection_address);
    const collectionInfo = collection ? infoOf(payload?.metadata, row.collection_address) : {};
    const scam = info?.is_scam === true || collectionInfo?.is_scam === true;
    const listed = !scam && (listedNftCollection(collection) || ownCollections.has(collection) || proven.has(address));
    const decided = examined !== null ? examined.has(address) : giftVerdictsKnown;
    const verified = listed ? true : (!scam && !decided && collection && parseTelegramGiftItemUri(row?.content?.uri) ? null : false);
    out.push({
      address,
      collection,
      collectionName: text(collectionInfo?.name) || text(row?.collection?.collection_content?.name),
      name: text(info?.name) || text(row?.content?.domain) || '',
      domain: text(row?.content?.domain, 126),
      picture: verified ? pictureOf(info, '_image_medium') : '',
      pictureBig: verified ? pictureOf(info, '_image_big') : '',
      attributes: verified ? attributesOf(info) : [],
      uri: contentUriOf(row?.content),
      scam,
      verified,
      lastLt: String(row?.last_transaction_lt ?? ''),
    });
  }
  const lt = (one) => { try { return BigInt(one.lastLt || 0); } catch { return 0n; } };
  return out.map((one, at) => [one, at]).sort(([a, i], [b, j]) => { const d = lt(b) - lt(a); return d > 0n ? 1 : d < 0n ? -1 : i - j; }).map(([one]) => one);
}
export async function readNftItems({ owner, verifiedItems = [], verifiedCollections = [], giftVerdictsKnown = true, examinedItems = null, ...access } = {}) {
  const account = rawAccount(owner);
  if (!account) throw new Error('wallet assets: an owner is required');
  const { payload, capped } = await indexPages('nft/items', { owner_address: account, limit: WALLET_NFT_PAGE }, 'nft_items', access);
  return withCap(parseNftItems(payload, { verifiedItems, verifiedCollections, giftVerdictsKnown, examinedItems }), capped);
}

const PLATHO_SERVICE_OPS = Object.freeze({
  '0x52435631': 'recovery', '0x52435632': 'recovery',
  '0x52535031': 'message',
  '0x4d323144': 'publish', '0x4d323143': 'publish',
  '0x50535031': 'post', '0x50535034': 'react',
  '0x49535031': 'intro',
  '0x4b534731': 'keys', '0x4b534735': 'keys', '0x4b534737': 'keys', '0x4b534739': 'keys',
  '0x4d525231': 'report',
  '0x4d323145': 'vault', '0x4d323146': 'vault', '0x4d323147': 'vault', '0x4d323148': 'vault', '0x4d32314b': 'vault',
  '0x4d534558': 'athBuy',
  '0x554e5052': 'name',
  '0x41544807': 'storage', '0x4154480a': 'storage', '0x41545654': 'storage', '0x27acdf8b': 'storage', '0x906182d2': 'storage',
  '0x906182d3': 'storage', '0x0aba5f1d': 'storage', '0x46534b33': 'storage', '0x50a61120': 'storage',
});
function opcodeKey(opcode) {
  if (opcode === null || opcode === undefined || opcode === '') return '';
  try { return `0x${BigInt(opcode).toString(16).padStart(8, '0')}`; } catch { return ''; }
}
export function serviceCallsOf(payload, account) {
  const self = rawAccount(account);
  const calls = new Map();
  for (const action of Array.isArray(payload?.actions) ? payload.actions : []) {
    if (action?.type !== 'call_contract' || !action?.trace_id || rawAccount(action?.details?.source) !== self) continue;
    const service = PLATHO_SERVICE_OPS[opcodeKey(action.details.opcode)];
    if (service && !calls.has(String(action.trace_id))) calls.set(String(action.trace_id), service);
  }
  return calls;
}

export function parseWalletHistory(payload, account, { alsoVerified = [], verifiedItems = [], verifiedCollections = [], nftVerdictsKnown = true } = {}) {
  const self = rawAccount(account);
  const extra = new Set(alsoVerified.map(rawAccount).filter(Boolean));
  const provenItems = new Set(verifiedItems.map(rawAccount).filter(Boolean));
  const ownCollections = new Set(verifiedCollections.map(rawAccount).filter(Boolean));
  const out = [];
  const ownTraces = ownTracesOf(payload, self);
  const services = serviceCallsOf(payload, self);
  const traded = marketTradesOf(payload);
  for (const action of Array.isArray(payload?.actions) ? payload.actions : []) {
    const details = action?.details ?? {};
    const at = Number(action?.end_utime ?? action?.start_utime) || 0;
    const base = { id: String(action?.action_id ?? action?.trace_id ?? `${at}:${out.length}`), at, success: action?.success !== false, trace: String(action?.trace_id ?? '') };
    const directed = (from, to) => {
      const source = rawAccount(from);
      const destination = rawAccount(to);
      if (source === self && destination !== self) return { direction: 'out', counterparty: destination };
      if (destination === self && source !== self) return { direction: 'in', counterparty: source };
      return null;
    };
    if (action?.type === 'ton_transfer') {
      const way = directed(details.source, details.destination);
      if (!way) continue;
      out.push({ ...base, ...way, kind: 'gram', amount: String(details.value ?? '0'), decimals: 9, symbol: 'GRAM',
        comment: details.encrypted ? '' : text(details.comment, 120) });
    } else if (action?.type === 'jetton_transfer') {
      const way = directed(details.sender, details.receiver);
      if (!way) continue;
      const info = infoOf(payload?.metadata, details.asset);
      if (info?.is_scam === true) continue;
      const master = rawAccount(details.asset);
      out.push({ ...base, ...way, kind: 'jetton', amount: String(details.amount ?? '0'), master,
        decimals: decimalsOf(info) ?? 9, symbol: text(info?.symbol, 16), verified: isVerifiedJettonMaster(master) || extra.has(master),
        comment: details.is_encrypted_comment ? '' : text(details.comment, 120) });
    } else if (action?.type === 'jetton_swap') {
      const given = details.dex_incoming_transfer ?? {};
      const got = details.dex_outgoing_transfer ?? {};
      if (rawAccount(details.sender) !== self && rawAccount(given.source) !== self) continue;
      const side = (asset) => {
        const master = rawAccount(asset);
        if (!master) return { master: '', symbol: 'GRAM', decimals: 9 };
        const info = infoOf(payload?.metadata, asset);
        return { master, symbol: text(info?.symbol, 16), decimals: decimalsOf(info) ?? 9 };
      };
      out.push({ ...base, kind: 'swap', direction: 'out', counterparty: rawAccount(given.destination), amount: String(given.amount ?? '0'), ...side(given.asset ?? details.asset_in),
        got: { amount: rawAccount(got.destination) === self ? String(got.amount ?? '0') : '0', ...side(got.asset ?? details.asset_out) }, nftName: '', comment: '' });
    } else if (MARKET_NFT_ACTIONS.has(action?.type)) {
      const item = rawAccount(details.nft_item);
      const collection = rawAccount(details.nft_collection);
      const info = infoOf(payload?.metadata, details.nft_item);
      if (info?.is_scam === true || (collection && infoOf(payload?.metadata, details.nft_collection)?.is_scam === true)) continue;
      const grams = (value) => (/^\d+$/.test(String(value ?? '')) ? String(value) : '0');
      let trade = null;
      let way = null;
      let amount = '0';
      if (action.type === 'nft_purchase') {
        const seller = rawAccount(details.real_old_owner) || rawAccount(details.old_owner);
        if (rawAccount(details.new_owner) === self && seller !== self) {
          trade = 'bought';
          way = { direction: 'in', counterparty: seller };
          amount = grams(details.price);
        } else if (seller === self && rawAccount(details.new_owner) !== self) {
          trade = 'sold';
          way = { direction: 'out', counterparty: rawAccount(details.new_owner) };
          amount = rawAccount(details.payout_address) === self ? grams(details.payout_amount) : '0';
        }
      } else if (rawAccount(details.owner) === self) {
        trade = action.type === 'nft_put_on_sale' ? 'listed' : 'unlisted';
        way = { direction: trade === 'listed' ? 'out' : 'in', counterparty: rawAccount(details.sale_address) };
        amount = trade === 'listed' ? grams(details.full_price) : '0';
      }
      if (!trade) continue;
      out.push({ ...base, ...way, kind: 'nft', trade, nftName: text(info?.name), master: item, amount, decimals: 9, symbol: 'GRAM', comment: '',
        verified: listedNftCollection(collection) || ownCollections.has(collection) || provenItems.has(item) ? true : (nftVerdictsKnown ? false : null) });
    } else if (action?.type === 'nft_transfer') {
      const way = directed(details.old_owner, details.new_owner);
      if (!way) continue;
      if (traded.get(String(action?.trace_id ?? ''))?.has(rawAccount(details.nft_item))) continue;
      const info = infoOf(payload?.metadata, details.nft_item);
      const collection = rawAccount(details.nft_collection);
      if (info?.is_scam === true || (collection && infoOf(payload?.metadata, details.nft_collection)?.is_scam === true)) continue;
      const item = rawAccount(details.nft_item);
      out.push({ ...base, ...way, kind: 'nft', nftName: text(info?.name), master: item, amount: '0', decimals: 0, symbol: '', comment: '',
        verified: listedNftCollection(collection) || ownCollections.has(collection) || provenItems.has(item) ? true : (nftVerdictsKnown ? false : null) });
    }
  }
  const paid = paymentsInOwnTraces(payload, self);
  for (const row of out) {
    const payment = paid(row);
    if (payment) row.payment = payment;
  }
  return withoutServiceStorage(withoutOwnChange(out, ownTraces), services.keys()).sort((a, b) => b.at - a.at);
}
function paymentsInOwnTraces(payload, self) {
  const nftTo = new Set();
  const nftItems = new Set();
  const nftTraces = new Set();
  const gramTraces = new Set();
  const sentTo = new Map();
  for (const action of Array.isArray(payload?.actions) ? payload.actions : []) {
    const details = action?.details ?? {};
    const trace = String(action?.trace_id ?? '');
    if (!trace) continue;
    if (action.type === 'nft_transfer' && rawAccount(details.old_owner) === self) {
      nftTo.add(`${trace} ${rawAccount(details.new_owner)}`);
      nftItems.add(`${trace} ${rawAccount(details.nft_item)}`);
      nftTraces.add(trace);
    } else if ((action.type === 'ton_transfer' || action.type === 'call_contract') && rawAccount(details.source) === self) {
      gramTraces.add(trace);
      const at = `${trace} ${rawAccount(details.destination)}`;
      let value = 0n;
      try { value = BigInt(String(details.value ?? '0')); } catch { value = 0n; }
      sentTo.set(at, (sentTo.get(at) ?? 0n) + value);
    }
  }
  return (row) => {
    if (row.kind !== 'gram' || row.direction !== 'in' || !row.trace) return null;
    const at = `${row.trace} ${row.counterparty}`;
    if (nftTo.has(at)) return 'sale';
    let amount = 0n;
    try { amount = BigInt(row.amount || '0'); } catch { amount = 0n; }
    if (amount < WALLET_GRAM_DUST_NANOTONS) return null;
    if (nftTraces.has(row.trace) && !gramTraces.has(row.trace) && !nftItems.has(at)) return 'sale';
    return sentTo.has(at) && amount > sentTo.get(at) ? 'refund' : null;
  };
}
const MARKET_NFT_ACTIONS = new Set(['nft_purchase', 'nft_put_on_sale', 'nft_cancel_sale']);
function marketTradesOf(payload) {
  const traces = new Map();
  for (const action of Array.isArray(payload?.actions) ? payload.actions : []) {
    if (!MARKET_NFT_ACTIONS.has(action?.type) || !action?.trace_id) continue;
    const trace = String(action.trace_id);
    if (!traces.has(trace)) traces.set(trace, new Set());
    traces.get(trace).add(rawAccount(action.details?.nft_item));
  }
  return traces;
}
export function ownTracesOf(payload, account) {
  const self = rawAccount(account);
  const traces = new Set();
  for (const action of Array.isArray(payload?.actions) ? payload.actions : []) {
    const details = action?.details ?? {};
    const market = action?.type === 'nft_purchase' ? [details.new_owner] : MARKET_NFT_ACTIONS.has(action?.type) ? [details.owner] : [];
    const from = [details.source, details.sender, details.old_owner, ...market].map(rawAccount);
    if (self && action?.trace_id && from.includes(self)) traces.add(String(action.trace_id));
  }
  return traces;
}
export function withoutOwnChange(rows, ownTraces) {
  const own = ownTraces instanceof Set ? ownTraces : new Set(ownTraces ?? []);
  return rows.filter((row) => !(row.kind === 'gram' && row.direction === 'in' && row.trace && own.has(row.trace) && !row.payment));
}
export function withoutServiceStorage(rows, serviceTraces) {
  const services = new Set(serviceTraces ?? []);
  return rows.filter((row) => !(row.kind === 'gram' && row.direction === 'out' && !row.comment && row.trace && services.has(row.trace)));
}
export async function readWalletHistory({ account, offset = 0, alsoVerified = [], verifiedItems = [], verifiedCollections = [], nftVerdictsKnown = true, ...access } = {}) {
  const self = rawAccount(account);
  if (!self) throw new Error('wallet assets: an account is required');
  const payload = await indexRead('actions', { account: self, limit: WALLET_HISTORY_PAGE, offset, sort: 'desc' }, access);
  const list = Array.isArray(payload?.actions) ? payload.actions : [];
  const more = list.length >= WALLET_HISTORY_PAGE;
  let kept = list;
  if (more) {
    const last = String(list.at(-1)?.trace_id ?? '');
    let cut = list.length;
    while (last && cut > 0 && String(list[cut - 1]?.trace_id ?? '') === last) cut -= 1;
    if (cut > 0) kept = list.slice(0, cut);
  }
  const page = { ...payload, actions: kept };
  return { rows: parseWalletHistory(page, self, { alsoVerified, verifiedItems, verifiedCollections, nftVerdictsKnown }), ownTraces: [...ownTracesOf(page, self)],
    serviceTraces: [...serviceCallsOf(page, self).keys()], nextOffset: offset + kept.length, more };
}
export async function readWalletHistoryPages({ pages = WALLET_HISTORY_READ_ON, wanted = () => true, offset = 0, ...options } = {}) {
  let page = await readWalletHistory({ ...options, offset });
  for (let read = 1; page.more && !page.rows.length && read < pages && wanted(); read += 1) {
    const next = await readWalletHistory({ ...options, offset: page.nextOffset });
    page = { ...next, ownTraces: [...page.ownTraces, ...next.ownTraces], serviceTraces: [...page.serviceTraces, ...next.serviceTraces] };
  }
  return page;
}

export { infoOf as assetInfoOf, pictureOf as assetPictureOf, text as assetText, attributesOf as assetAttributesOf, contentUriOf as assetContentUriOf };
