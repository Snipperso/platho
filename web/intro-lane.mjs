// intro-lane — the assembly. Everything the INTRO receive path needs, wired together in one place.
//
// The pieces are all tested on their own: shard-rpc reads accounts in batch and history for bodies, intro-transport
// turns a get-method into a scan page and an entry, intro-cursor-store remembers where each shard was left off,
// intro-scan-policy decides how wide and how often, and intro-scan-runner runs the loop. What did not exist was
// anything that put them together — the app imported none of it, so the whole lane was a library with no caller.
//
// THIS FILE IS THE SEAM AND NOTHING MORE. It deliberately stops at `onIntro`. What a first contact MEANS — which
// conversation it starts, where its K_root comes from, which thread it lands in — is the app's decision and a
// subsystem that does not exist yet. Putting a guess at it here would bury that decision inside plumbing.
//
// WHY ASSEMBLY IS ITS OWN MODULE rather than lines in app.js: every scheduling decision in this lane has already
// been wrong twice in ways that cost real money on a phone, and app.js cannot be tested without a browser. Here
// the whole thing runs against a fake clock and a stub transport.

import { createIntroScanRunner } from './intro-scan-runner.mjs?v=12';
import { createIntroCursorStore } from './intro-cursor-store.mjs?v=1';
import { createScanPageReader, createEntryReader, fetchIntroCapsule } from './intro-transport.mjs?v=13';
import { createShardStatesRequest, createShardMessagesWithSourceReader } from './shard-rpc.mjs?v=13';
import { readAccountStates } from './shard-reader.mjs?v=12';
import { introShardAddress } from './shard-discovery.mjs?v=14';
import { INTRO_PUBLISH_OPCODE } from './intro-codec.mjs?v=2';

/**
 * Build the INTRO receive lane.
 *
 * `scanSecretKey` is the user's X25519 scan secret — already derived and already held by the app; it is what a
 * stealth view_tag is tested against, and the one thing here that must never leave the device.
 * `runGetMethod` is the app's existing transport method, passed in rather than imported so this stays testable.
 * `onIntro` receives every first contact exactly once, with its capsule body already fetched and VERIFIED
 * against the commitment the contract stored — a wrong, stale or hostile response never reaches it.
 *
 * Returns { start, stop, refreshNow, stats } — hook start/stop to the same visibility handling that drives the
 * app's other polling, so a hidden tab spends no battery.
 */
export async function createIntroLane({
  scanSecretKey,
  runGetMethod,
  onIntro,
  onError = () => {},
  policy = {},
  endpoint = null,
  apiKey = null,
  fetch: fetchImpl = null,
  store = null,
  readSpace = undefined,   // narrowable for tests; production uses INTRO_READ_SPACE
  // THE CLOCK IS INJECTABLE AND MUST BE. The runner derives the epoch window from it, and an epoch that does not
  // match the chain's puts the whole ten-epoch window somewhere the shards are not — the scan then reads real
  // addresses, finds nothing, and reports a clean empty pass. It is silent, and it has now bitten twice today:
  // the same divergence between Date.now() and a sandbox clock made a w5 wallet refuse an already-expired
  // external message. Production passes nothing and gets Date.now(); a sandbox must pass its own.
  now = undefined,
  setTimer = undefined,
  clearTimer = undefined,
} = {}) {
  if (!scanSecretKey) throw new Error('createIntroLane requires scanSecretKey');
  if (typeof runGetMethod !== 'function') throw new Error('createIntroLane requires runGetMethod');
  if (typeof onIntro !== 'function') throw new Error('createIntroLane requires onIntro');

  const rpc = { endpoint, apiKey, fetch: fetchImpl ?? undefined };
  const statesRequest = createShardStatesRequest(rpc);
  // With-source reader (not the source-free one): the INTRO publish transaction's src is the sender's wallet, which the
  // responder needs to resolve the sender's full bundle (KeyShard) for a reply. fetchIntroCapsule surfaces it, verified
  // downstream against the sender keyId. [clean17-private-lane-plan: Y reply-bundle resolution]
  // `opcode` closes a first-contact griefing vector, and this lane is the one it hurt most. An IntroShard address
  // is derivable by anyone — (epoch, bucket) — which is precisely what lets a stranger send a first contact, so a
  // stranger can equally flood the bucket with cheap junk. The body of an entry that IS on chain and paid for then
  // falls out of the newest-first window and fetchIntroCapsule returns null: the contact is lost with no error.
  const readMessages = createShardMessagesWithSourceReader({ ...rpc, opcode: INTRO_PUBLISH_OPCODE });
  const readScanPage = createScanPageReader(runGetMethod);
  const readEntry = createEntryReader(runGetMethod);

  const runner = createIntroScanRunner({
    scanSecretKey,
    readStates: (addresses) => readAccountStates(addresses, { request: statesRequest }),
    readScanPage,
    // The body is fetched only for the ~1-in-65536 entries whose view_tag matched, never for the whole page —
    // that ratio is what keeps a leak-free scan affordable, so it belongs here rather than in the scan.
    //
    // A hit carries (epoch, bucket, entryId) but NOT an address: the scan works in addrKey form internally. The
    // address is re-derived from the same function the scan used, so the body is fetched from exactly the shard
    // the hit came from — deriving it any other way would be a second place for the two to disagree.
    fetchCapsule: async ({ epoch, bucket, entryId }) => fetchIntroCapsule({
      address: await introShardAddress(epoch, bucket), entryId, readEntry, readMessages,
    }),
    onIntro,
    onError,
    store: store ?? await createIntroCursorStore(),
    policy,
    ...(readSpace === undefined ? {} : { readSpace }),
    ...(now === undefined ? {} : { now }),
    ...(setTimer === undefined ? {} : { setTimer }),
    ...(clearTimer === undefined ? {} : { clearTimer }),
  });

  return runner;
}
