import { describe, expect, it } from 'vitest';
import {
  GROUP_RECORD_SHARD_GENERATION, advanceGroupWindow, createGroupRecord, groupEpochsToRead, markGroupEpochsRead,
  parseGroupRecord, serializeGroupRecord,
} from '../web/group-store.mjs';
import { createGroupFounding, groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { CUTOVER_EPOCH } from '../web/cutover-epoch.mjs';


const DAY = 86_400;
const E = CUTOVER_EPOCH as number;
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);

async function sceneAround(startEpoch: number, days: number) {
  const founding = await createGroupFounding({ entropy: bytes(0x21), createdAtSec: startEpoch * DAY + 100 });
  const self = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: founding.groupId }));
  let record: any = createGroupRecord({
    founding, name: 'across the flip', self,
    members: [{ groupKey: self, wallet: `0:${'ab'.repeat(32)}`, keyId: 'k-self', name: 'Self', x25519PublicKey: bytes(0x60), mlKem768PublicKey: bytes(0x61, 1184) }],
    admins: [self],
  });
  record = await advanceGroupWindow(record, (startEpoch + days) * DAY + 100);
  return record;
}

function oldBuildBlob(record: any, rosterCursor: number, readEpochs: number[]) {
  const marked = markGroupEpochsRead(record, record.epochs.filter((e: any) => readEpochs.includes(e.epoch)));
  const blob: any = JSON.parse(JSON.stringify(serializeGroupRecord({ ...marked, rosterCursor })));
  delete blob.sg;
  return blob;
}

describe('FLIP-03 — the group roster cursor and day marks carry the shard generation', () => {
  it('FLIP03-01: a record this build writes is stamped, and a stamped record parses untouched', async () => {
    expect(GROUP_RECORD_SHARD_GENERATION).toBe(18);
    const record = await sceneAround(E - 2, 6);
    const days = record.epochs.map((e: any) => e.epoch);
    const marked = markGroupEpochsRead(record, record.epochs);
    const blob: any = JSON.parse(JSON.stringify(serializeGroupRecord({ ...marked, rosterCursor: E + 4 })));
    expect(blob.sg, 'every record the flip build writes carries the stamp').toBe(18);
    const back = parseGroupRecord(blob);
    expect(back.rosterCursor, 'a cursor the flip build earned is kept').toBe(E + 4);
    expect(back.epochs.filter((e: any) => e.read === true).map((e: any) => e.epoch)).toEqual(days);
  });

  it('FLIP03-02: an UNSTAMPED record past E is pulled back to E — the cursor, and the marks of days at or after E', async () => {
    const record = await sceneAround(E - 3, 7);
    const blob = oldBuildBlob(record, E + 4, [E - 3, E - 2, E - 1, E, E + 1, E + 2]);
    const back = parseGroupRecord(blob);
    expect(back.rosterCursor, 'the roster walk restarts at E, the first clean-18 day').toBe(E);
    const read = back.epochs.filter((e: any) => e.read === true).map((e: any) => e.epoch);
    expect(read, 'days before E are generation 17 under every build: their marks stand').toEqual([E - 3, E - 2, E - 1]);
    const toRead = groupEpochsToRead(back, (E + 6) * DAY + 100).map((e: any) => e.epoch);
    expect(toRead.slice(0, 3), 'the days an old build called read are read again').toEqual([E, E + 1, E + 2]);
    const resaved: any = JSON.parse(JSON.stringify(serializeGroupRecord({ ...back, rosterCursor: E + 5 })));
    expect(parseGroupRecord(resaved).rosterCursor).toBe(E + 5);
  });

  it('FLIP03-03: an UNSTAMPED record that never reached E is not touched — nothing it read was misread', async () => {
    const record = await sceneAround(E - 6, 4);
    const blob = oldBuildBlob(record, E - 3, [E - 6, E - 5, E - 4]);
    const back = parseGroupRecord(blob);
    expect(back.rosterCursor).toBe(E - 3);
    expect(back.epochs.filter((e: any) => e.read === true).map((e: any) => e.epoch)).toEqual([E - 6, E - 5, E - 4]);
  });
});
