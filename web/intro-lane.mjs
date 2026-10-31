
import { createIntroScanRunner } from './intro-scan-runner.mjs?v=114';
import { createIntroCursorStore } from './intro-cursor-store.mjs?v=16';
import { createScanPageReader, createEntryReader, fetchIntroCapsule } from './intro-transport.mjs?v=112';
import { createShardStatesRequest, createShardMessagesWithSourceReader } from './shard-rpc.mjs?v=70';
import { readAccountStates } from './shard-reader.mjs?v=109';
import { introShardAddress } from './shard-discovery.mjs?v=104';
import { INTRO_PUBLISH_OPCODE } from './intro-codec.mjs?v=4';

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
  cursorDbName = undefined,
  ledgerKey = null,
  readSpace = undefined,
  now = undefined,
  setTimer = undefined,
  clearTimer = undefined,
  build = '',
} = {}) {
  if (!scanSecretKey) throw new Error('createIntroLane requires scanSecretKey');
  if (typeof runGetMethod !== 'function') throw new Error('createIntroLane requires runGetMethod');
  if (typeof onIntro !== 'function') throw new Error('createIntroLane requires onIntro');

  const rpc = { endpoint, apiKey, fetch: fetchImpl ?? undefined };
  const statesRequest = createShardStatesRequest(rpc);
  const readMessages = createShardMessagesWithSourceReader({ ...rpc, opcode: INTRO_PUBLISH_OPCODE });
  const readScanPage = createScanPageReader(runGetMethod);
  const readEntry = createEntryReader(runGetMethod);

  const runner = createIntroScanRunner({
    scanSecretKey,
    readStates: (addresses) => readAccountStates(addresses, { request: statesRequest }),
    readScanPage,
    fetchCapsule: async ({ epoch, bucket, entryId }) => fetchIntroCapsule({
      address: await introShardAddress(epoch, bucket), entryId, readEntry, readMessages,
    }),
    onIntro,
    onError,
    build,
    store: store ?? await createIntroCursorStore({ ...(cursorDbName === undefined ? {} : { dbName: cursorDbName }), ...(ledgerKey ? { ledgerKey } : {}) }),
    policy,
    ...(readSpace === undefined ? {} : { readSpace }),
    ...(now === undefined ? {} : { now }),
    ...(setTimer === undefined ? {} : { setTimer }),
    ...(clearTimer === undefined ? {} : { clearTimer }),
  });

  return runner;
}
