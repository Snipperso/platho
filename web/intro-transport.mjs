
import { readAccountStates, toWireAddress } from './shard-reader.mjs?v=108';
import { parseIntroPublish, parseIntroEntryStack } from './intro-codec.mjs?v=4';
import { stackNumOr0 } from './ton-stack-num.mjs?v=2';
import { parseBocBase64, computeCellHashAndDepth, beginCell, bytesToBigUint } from './pwa-contract-transactions.mjs?v=59';

export function createShardStateReader(sendRequest) {
  if (typeof sendRequest !== 'function') throw new Error('createShardStateReader requires a request function');
  return (addresses) => readAccountStates(addresses, { request: sendRequest });
}

export function createScanPageReader(runGetMethod, { parseStack } = {}) {
  if (typeof runGetMethod !== 'function') throw new Error('createScanPageReader requires runGetMethod');
  return async (address, fromId, maxCount) => {
    let raw;
    try {
      raw = await runGetMethod({
        address: toWireAddress(address),
        method: 'get_scan_page',
        stack: [{ type: 'num', value: String(fromId) }, { type: 'num', value: String(maxCount) }],
      });
    } catch (error) {
      if (isStructurallyAbsent(error)) return null;
      throw error;
    }
    if (!raw) throw new Error('runGetMethod returned no response');
    if (raw.exit_code === -256 || raw.exit_code === -13) return null;
    if (raw.exit_code !== 0) throw new Error(`get_scan_page failed with exit_code ${raw.exit_code}`);
    return (parseStack ?? parseScanPageStack)(raw.stack);
  };
}

function isStructurallyAbsent(error) {
  const code = Number(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);
  return code === -13 || code === -256;
}

export const INTRO_SCAN_PAGE_ARITY = 4;

export function parseScanPageStack(stack) {
  if (!Array.isArray(stack) || stack.length !== INTRO_SCAN_PAGE_ARITY) {
    throw new Error(`get_scan_page returned ${stack?.length ?? 0} stack items, expected ${INTRO_SCAN_PAGE_ARITY}`);
  }
  const num = (i) => stackNumOr0(stack[i]?.value, `get_scan_page[${i}]`);
  const cell = (i) => {
    const value = stack[i]?.value;
    if (!value) return beginCell().endCell();
    return typeof value === 'string' ? cellFromBase64(value) : value;
  };
  return { from_id: num(0), count: num(1), next_id: num(2), pairs: cell(3) };
}

const cellFromBase64 = (value) => parseBocBase64(value);

const IS_BODY_DOMAIN = 0x49534243;
export async function introBodyCommitBrowser(header0, body) {
  const h0 = (await computeCellHashAndDepth(header0)).hash;
  const bodyHash = (await computeCellHashAndDepth(body)).hash;
  const preimage = beginCell();
  preimage.uint(IS_BODY_DOMAIN, 32, 'IS_BODY_DOMAIN');
  preimage.uint(bytesToBigUint(h0), 256, 'header_0 hash');
  preimage.uint(bytesToBigUint(bodyHash), 256, 'body hash');
  const { hash } = await computeCellHashAndDepth(preimage.endCell());
  return bytesToBigUint(hash);
}

const INTRO_BODY_TIME_SLACK_S = 600;
const INTRO_BODY_WINDOW_FULL_ROWS = 128;
const INTRO_BODY_EXTRA_PAGES = 6;

export async function fetchIntroCapsule({ address, entryId, readEntry, readMessages }) {
  if (typeof readEntry !== 'function' || typeof readMessages !== 'function') {
    throw new Error('fetchIntroCapsule requires readEntry and readMessages');
  }
  const entry = await readEntry(address, entryId);
  if (!entry?.exists) return null;
  const wanted = BigInt(entry.body_commit);

  let capsuleCells = null;
  const sources = [];
  const lateSources = [];
  const stampedAt = Number(entry.created_at ?? 0);
  const match = async (items) => {
    for (const item of items ?? []) {
      const message = item?.bodyCell ?? item;
      const source = item?.source ?? null;
      let parsed;
      try { parsed = parseIntroPublish(message); } catch { continue; }
      if ((await introBodyCommitBrowser(parsed.header0, parsed.body)) !== wanted) continue;
      if (!capsuleCells) capsuleCells = { header0: parsed.header0, body: parsed.body, r: parsed.r, viewTag: parsed.viewTag };
      if (!source) continue;
      const at = Number(item?.createdAt ?? item?.created_at ?? NaN);
      if (stampedAt > 0 && Number.isFinite(at) && at > stampedAt) lateSources.push(source);
      else sources.push(source);
    }
  };
  await match(await readMessages(address));
  if ((!capsuleCells || sources.length === 0) && stampedAt > 0) {
    let cursor = null;
    for (let page = 0; page <= INTRO_BODY_EXTRA_PAGES; page += 1) {
      const rows = await readMessages(address, {
        startUtime: Math.max(0, stampedAt - INTRO_BODY_TIME_SLACK_S),
        endUtime: stampedAt,
        ...(cursor === null ? {} : { endLt: cursor }),
      });
      await match(rows);
      const answered = Number.isFinite(rows?.rawCount) ? rows.rawCount : (rows?.length ?? 0);
      if ((capsuleCells && sources.length > 0) || answered < INTRO_BODY_WINDOW_FULL_ROWS) break;
      let oldestLt = null;
      try { if (rows?.rawOldestLt != null) oldestLt = BigInt(rows.rawOldestLt); } catch { }
      for (const row of rows ?? []) {
        const raw = row?.createdLt ?? row?.lt;
        if (raw == null) continue;
        try { const lt = BigInt(raw); if (oldestLt === null || lt < oldestLt) oldestLt = lt; } catch { }
      }
      if (oldestLt === null || oldestLt === 0n) break;
      const next = String(oldestLt - 1n);
      if (next === cursor) break;
      cursor = next;
    }
  }
  if (!capsuleCells) return null;

  const candidates = [...sources].reverse().concat([...lateSources].reverse().filter((s) => !sources.includes(s)));
  return {
    ...capsuleCells,
    bodyCommit: wanted,
    created_at: entry.created_at,
    source: candidates.length ? candidates[0] : null,
    sourceCandidates: candidates,
  };
}

export function createEntryReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createEntryReader requires runGetMethod');
  return async (address, entryId) => {
    const raw = await runGetMethod({
      address: toWireAddress(address),
      method: 'get_entry',
      stack: [{ type: 'num', value: String(entryId) }],
    });
    if (!raw || raw.exit_code !== 0) return { exists: false };
    return parseIntroEntryStack(raw.stack);
  };
}
