import { describe, expect, it } from 'vitest';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import { createGroupReadLane } from '../web/group-lane-read.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { parseCapsulePublishBody, convFrameCommitOfParsed } from '../web/conv-lane-read.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
function identityFor(fill: number) {
  const kem = ml_kem768.keygen(new Uint8Array(64).fill(fill));
  const xSecret = bytes(fill ^ 0x5a);
  return {
    vaultSeed: bytes(fill), wallet: `0:${String(fill).padStart(2, '0').repeat(32).slice(0, 64)}`, keyId: `key-${fill}`, name: `member-${fill}`,
    x25519SecretKey: xSecret, x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey,
  };
}

async function roomWithLaggingGetter(kind: 'mute' | 'name') {
  let clock = 1_800_000_000;
  let lt = 1_000_000n;
  const view = { lagSec: 0, refuse: false };
  const shards = new Map<string, { rows: any[]; stored: { commit: string; at: number }[] }>();
  const send = async (messages: any[]) => {
    for (const m of messages) {
      const record = parseBocBase64(m.payload).refs?.[0];
      const commit = await convFrameCommitOfParsed(parseCapsulePublishBody(record));
      const key = addrKey(m.shard);
      if (!shards.has(key)) shards.set(key, { rows: [], stored: [] });
      lt += 1n;
      shards.get(key)!.rows.unshift({ bodyCell: record, source: null, createdAt: clock, createdLt: String(lt) });
      if (!view.refuse) shards.get(key)!.stored.push({ commit, at: clock });
    }
  };
  const readMessagesWithSource = async (address: string, options: any = {}) => {
    const rows = shards.get(addrKey(address))?.rows ?? [];
    const end = options?.endLt == null ? null : BigInt(options.endLt);
    return (end === null ? rows : rows.filter((r) => BigInt(r.createdLt) <= end)).slice(0, 128);
  };
  const readRecordPage = async (address: string, fromId: number, maxCount: number) => {
    if (!shards.has(addrKey(address))) return { exists: false, fromId: 0, count: 0, recordCount: 0, rows: [] };
    const stored = shards.get(addrKey(address))!.stored.filter((s) => s.at <= clock - view.lagSec);
    const rows = stored.slice(fromId, fromId + maxCount);
    return { exists: true, fromId, count: rows.length, recordCount: stored.length, rows: rows.map((s) => ({ frameCommit: s.commit, createdAt: s.at })) };
  };
  const readStates = async (addresses: string[]) => {
    const out = new Map();
    for (const a of addresses ?? []) { const s = shards.get(addrKey(a)); if (s?.rows.length) out.set(addrKey(a), { lastLt: s.rows[0].createdLt }); }
    return out;
  };
  const lane = createGroupReadLane({ readMessagesWithSource, readRecordPage, nowSec: () => clock });
  const admin = identityFor(0x71);
  const member = identityFor(0x72);
  const runtime = createGroupRuntime({
    store: createMemoryGroupRecordStore(), identity: admin, send,
    vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
    readMessagesWithSource, readStates, lane, publishValue: 19_100_000n, now: () => clock,
    random: (n: number) => { const out = new Uint8Array(n); globalThis.crypto.getRandomValues(out); return out; },
  });
  const room = await runtime.create({ name: 'test room' });
  const id = hex(room.groupId);
  const mKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: member.vaultSeed, groupId: room.groupId }));
  await runtime.admit(id, [{ groupKey: mKey, wallet: member.wallet, keyId: member.keyId, name: member.name, x25519PublicKey: member.x25519PublicKey, mlKem768PublicKey: member.mlKem768PublicKey }]);
  const state = () => (kind === 'mute' ? `muted=${runtime.get(id).muted?.length ?? 0}` : `name=${runtime.get(id).name}`);
  const pass = async () => { await runtime.sync({ deliver: async () => true }); return state(); };
  if (kind === 'mute') await runtime.mute(id, mKey); else await runtime.setName(id, 'first name');
  for (let i = 0; i < 2; i += 1) { clock += 12; await pass(); }
  clock += 300;
  return {
    async pressThen(steps: number[], { lagSec = 0, refuse = false } = {}) {
      view.lagSec = lagSec;
      view.refuse = refuse;
      if (kind === 'mute') await runtime.mute(id, mKey, { lift: true }); else await runtime.setName(id, 'second name');
      view.refuse = false;
      const seen = [state()];
      let at = 0;
      for (const t of steps) { clock += t - at; at = t; seen.push(await pass()); }
      return seen;
    },
  };
}

describe('an admin\'s own control write while the getter lags', () => {
  it('GPOW-01: a lift stays lifted on the admin\'s device through a getter 60 s behind, and after', async () => {
    const room = await roomWithLaggingGetter('mute');
    expect(await room.pressThen([12, 24, 36, 48, 60, 72], { lagSec: 60 })).toEqual(Array(7).fill('muted=0'));
  });

  it('GPOW-02: a second name stays through a getter 15 s behind', async () => {
    const room = await roomWithLaggingGetter('name');
    expect(await room.pressThen([12, 24, 36], { lagSec: 15 })).toEqual(Array(4).fill('name=second name'));
  });

  it('GPOW-03: a lift the shard refused stands while it waits, and is taken back when its wait runs out', async () => {
    const room = await roomWithLaggingGetter('mute');
    const seen = await room.pressThen([12, 300, 590, 612, 700], { refuse: true });
    expect(seen.slice(0, 4), 'pending: the device keeps its own word').toEqual(Array(4).fill('muted=0'));
    expect(seen.slice(4), 'refused: the chain\'s word comes back').toEqual(['muted=1', 'muted=1']);
  });
});
