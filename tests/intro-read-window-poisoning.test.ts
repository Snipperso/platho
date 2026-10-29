import { describe, expect, it } from 'vitest';
import { fetchIntroCapsule, introBodyCommitBrowser } from '../web/intro-transport.mjs';
import { buildIntroPublishBrowser } from '../web/intro-publish-browser.mjs';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { parseBocBase64, beginCell } from '../web/pwa-contract-transactions.mjs';


const PAGE = 128;
const STAMPED = 1_791_100_000;
const SENDER = '0:' + 'ab'.repeat(32);
const SHARD = '0:' + '44'.repeat(32);

const junk = () => beginCell().uint(0x49535031, 32).uint(0n, 64).endCell();

async function scene({ junkAfter = 0, junkBefore = 0, junkBetween = 0, cutBetween = false }: { junkAfter?: number; junkBefore?: number; junkBetween?: number; cutBetween?: boolean }) {
  const sender: any = await createMessagingIdentity();
  const recipient: any = await createMessagingIdentity();
  const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
  const header0 = parseBocBase64(built.chainCells.header0.boc);
  const body = parseBocBase64(built.chainCells.body.boc);
  const publish = await buildIntroPublishBrowser({ epoch: 20685, bucket: 0, r: 7n, viewTag: built.header0.viewTag, header0, body, value: 0n });
  const commit = await introBodyCommitBrowser(header0, body);
  const rows: Array<{ bodyCell: any; source: string; createdAt: number; createdLt: string }> = [];
  let lt = 1_000_000n;
  for (let i = 0; i < junkBefore; i += 1) rows.push({ bodyCell: junk(), source: '0:' + 'ee'.repeat(32), createdAt: STAMPED - 30 + Math.floor((i * 26) / Math.max(1, junkBefore)), createdLt: String(lt += 10n) });
  rows.push({ bodyCell: publish.body, source: SENDER, createdAt: STAMPED - 3, createdLt: String(lt += 10n) });
  for (let i = 0; i < junkBetween; i += 1) rows.push({ bodyCell: cutBetween && i === junkBetween - 1 ? null : junk(), source: '0:' + 'cc'.repeat(32), createdAt: STAMPED - 2 + Math.floor((i * 3) / Math.max(1, junkBetween)), createdLt: String(lt += 10n) });
  for (let i = 0; i < junkAfter; i += 1) rows.push({ bodyCell: junk(), source: '0:' + 'dd'.repeat(32), createdAt: STAMPED + 1 + Math.floor((i * 29) / Math.max(1, junkAfter)), createdLt: String(lt += 10n) });
  const asks: any[] = [];
  const readMessages = async (_address: string, options: any = {}) => {
    asks.push(options);
    const { startUtime = null, endUtime = null, endLt = null } = options ?? {};
    const page = rows
      .filter((r) => (startUtime === null || r.createdAt >= startUtime) && (endUtime === null || r.createdAt <= endUtime)
        && (endLt === null || BigInt(r.createdLt) <= BigInt(endLt)))
      .slice().reverse().slice(0, PAGE);
    const out = page.filter((r) => r.bodyCell !== null)
      .map(({ bodyCell, source, createdLt, createdAt }) => ({ bodyCell, source, createdLt, lt: createdLt, createdAt }));
    Object.defineProperty(out, 'rawCount', { value: page.length });
    Object.defineProperty(out, 'rawOldestLt', { value: page.length ? page[page.length - 1].createdLt : null });
    return out;
  };
  const readEntry = async () => ({ exists: true, body_commit: commit, created_at: STAMPED });
  const fetched = await fetchIntroCapsule({ address: SHARD, entryId: 7n, readEntry, readMessages });
  return { fetched, asks };
}

describe('INTRO read window under refused-message flooding', () => {
  it('INTRO-POISON-01: 128 refused messages sent in the 30 s AFTER the entry cannot hide it', async () => {
    const { fetched, asks } = await scene({ junkAfter: PAGE });
    expect(fetched, 'the first contact is still delivered').not.toBeNull();
    expect(fetched!.source).toBe(SENDER);
    expect(asks.every((a) => a?.endUtime == null || a.endUtime <= STAMPED), 'no window reaches above the stamp').toBe(true);
  });

  it('INTRO-POISON-02: a heavier flood after the entry (500 rows) changes nothing — none of it is in the window', async () => {
    const { fetched } = await scene({ junkAfter: 500 });
    expect(fetched?.source).toBe(SENDER);
  });

  it('INTRO-POISON-03: a page under the stamp that is full of OTHER traffic is paged past by lt, not taken as the end', async () => {
    const { fetched, asks } = await scene({ junkBefore: PAGE, junkBetween: 200, junkAfter: PAGE });
    expect(fetched?.source, 'found on a page below the first').toBe(SENDER);
    expect(asks.some((a) => a?.endLt != null), 'and it took an lt-bounded page to get there').toBe(true);
  });

  it('INTRO-POISON-04: one body that does not parse on a full page under the stamp is still a full page [client audit 58 — C3-1]', async () => {
    const { fetched, asks } = await scene({ junkBetween: PAGE, cutBetween: true });
    expect(fetched?.source, 'MEASURED before: null — 127 parsed rows read as the end').toBe(SENDER);
    expect(asks.some((a) => a?.endLt != null), 'paged below by the answered rows\' oldest lt').toBe(true);
  });
});
