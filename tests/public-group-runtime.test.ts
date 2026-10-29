import { describe, expect, it } from 'vitest';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import {
  PUBLIC_GROUP_CONTROL_ABANDON_S, PUBLIC_GROUP_CONTROL_CONFIRM_S, PUBLIC_GROUP_MAX_PARTS, PUBLIC_GROUP_PARTS_MAX_BYTES, PUBLIC_GROUP_PARTS_MAX_AGE_S, PUBLIC_GROUP_PENDING_MAX, PUBLIC_GROUP_REANCHOR_S, PUBLIC_GROUP_TEXT_MAX_CHARS, assemblePublicGroupDocuments,
  createPublicGroupRuntime, publicGroupChatUid, publicGroupControlUid, publicGroupKeyOfWallet, publicGroupStreamKey,
} from '../web/public-group-runtime.mjs';
import {
  PUBLIC_GROUP_KIND, PUBLIC_GROUP_KNOWN_MAX, PUBLIC_GROUP_MEMBERS_MAX, applyPublicGroupRows, decodePublicGroupControl, encodePublicGroupControl, encodePublicGroupJoinToken,
  isPublicGroupAdmin, isPublicGroupBanned, isPublicGroupOwner, isPublicGroupMuted, parsePublicGroupJoinToken, parsePublicGroupRecord, serializePublicGroupRecord, PUBLIC_GROUP_EXCERPT_MAX,
} from '../web/public-group-protocol.mjs';


const CLOCK = 1_800_000_000;
const ERA_LEN = 2_592_000;
const ERA = Math.floor(CLOCK / ERA_LEN);

const walletOf = (fill: number) => `0:${fill.toString(16).padStart(2, '0').repeat(32)}`;
const walletNumbered = (n: number) => `0:${n.toString(16).padStart(8, '0')}${'ab'.repeat(28)}`;
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const keyOf = (wallet: string, streamId: string) => publicGroupStreamKey(streamId, hex(publicGroupKeyOfWallet(wallet)!));

function fakeChain({ window = 96 }: { window?: number } = {}) {
  const threads = new Map<string, any[]>();
  let clock = CLOCK;
  let declineLeft = 0;
  let declineAfter = 0;
  const now = () => clock;
  const tick = (s = 1) => { clock += s; };
  const decline = (n: number, { after = 0 }: { after?: number } = {}) => { declineLeft = n; declineAfter = after; };
  const encodeDocument = (blocks: any[]) => new TextEncoder().encode(JSON.stringify(blocks.map((b) => (
    b.bytes instanceof Uint8Array ? { ...b, bytes: [...b.bytes] } : b))));
  const decodeDocument = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)).map((b: any) => (
    Array.isArray(b.bytes) ? { ...b, bytes: new Uint8Array(b.bytes) } : b));
  const shardKeyOf = (uid: bigint) => `shard:${String(uid).slice(0, 10)}`;
  const rowOf = (uid: bigint, wallet: string, documentBytes: Uint8Array, streamId: string, partIndex = 0, partCount = 1) => {
    const key = String(uid);
    const rows = threads.get(key) ?? [];
    const era = Math.floor(clock / ERA_LEN);
    const row = {
      publisher: wallet, created_at: BigInt(clock), entry_id: BigInt(rows.length), hidden: false,
      thread_epoch_tag: String((1n << 32n) | BigInt(era)), thread_seq: 0, thread_generation: 17, thread_pk: '1234', shard_key: shardKeyOf(uid),
      header: null, body: { documentBytes, streamId: `0x${String(streamId).toLowerCase().replace(/^0x/, '')}`, partIndex, partCount },
    };
    rows.push(row);
    threads.set(key, rows);
    return row;
  };
  const publishAs = (wallet: string, { parts = 1 }: { parts?: number } = {}) => async ({ uid, blocks, streamId }: any) => {
    const bytes = encodeDocument(blocks);
    if (parts <= 1) { rowOf(uid, wallet, bytes, streamId); return { createdAtSec: clock }; }
    const size = Math.ceil(bytes.length / parts);
    for (let index = 0; index < parts; index += 1) rowOf(uid, wallet, bytes.slice(index * size, (index + 1) * size), streamId, index, parts);
    return { createdAtSec: clock };
  };
  const reads: { uid: bigint; olderThan: any; states: boolean }[] = [];
  const stateReads: number[] = [];
  const lane = {
    async threadCoordsByUid(uid: bigint) { return { coords: [`addr:${String(uid).slice(0, 10)}`], coordOf: new Map() }; },
    async readStates(addresses: string[]) { stateReads.push(addresses.length); return new Map(addresses.map((a) => [a, { status: 'active' }])); },
    async readThreadByUid(uid: bigint, { firstEra = null, olderThan = null, states = null }: any = {}) {
      reads.push({ uid, olderThan, states: states instanceof Map });
      const rows = (threads.get(String(uid)) ?? []).filter((r) => firstEra === null || Number(BigInt(r.thread_epoch_tag) & 0xFFFFFFFFn) >= Number(firstEra));
      const key = shardKeyOf(uid);
      const count = rows.length;
      const live = states instanceof Map ? states : new Map();
      if (count === 0) return { posts: [], cursors: {}, hasMore: false, shardsSeen: 0, hidden: [], states: live };
      const previous = olderThan?.[key];
      if (previous && Number(previous.from) === 0) return { posts: [], cursors: { [key]: { from: 0, entryCount: count } }, hasMore: false, shardsSeen: 1, hidden: [], states: live };
      const end = previous ? Math.min(Number(previous.from), count) : count;
      const from = Math.max(0, end - window);
      const declined = declineAfter === 0 && declineLeft > 0;
      if (declineAfter > 0) declineAfter -= 1; else if (declined) declineLeft -= 1;
      return { posts: declined ? [] : rows.slice(from, end).map((r) => ({ ...r })), cursors: { [key]: { from, entryCount: count, oldestLt: null } }, hasMore: from > 0, shardsSeen: 1, hidden: [], states: live };
    },
  };
  const readPayload = (post: any) => ({ type: 'document_comment', documentBytes: post.body.documentBytes, stream_id: post.body.streamId, partIndex: post.body.partIndex, partCount: post.body.partCount });
  const hide = (uid: bigint, entryId: number) => { const row = (threads.get(String(uid)) ?? [])[entryId]; if (row) row.hidden = true; };
  return { now, tick, decline, publishAs, lane, readPayload, decodeDocument, encodeDocument, threads, hide, rowOf, reads, stateReads, shardKeyOf };
}

function runtimeFor(chain: ReturnType<typeof fakeChain>, fill: number, extra: any = {}) {
  const wallet = walletOf(fill);
  const store = createMemoryGroupRecordStore();
  const puts: number[] = [];
  const counted = { ...store, put: async (id: string, record: any) => { puts.push(1); return store.put(id, record); } };
  const runtime = createPublicGroupRuntime({
    store: counted,
    self: { wallet, hash: publicGroupKeyOfWallet(wallet)! },
    lane: chain.lane,
    publish: chain.publishAs(wallet),
    decodeDocument: chain.decodeDocument,
    readPayload: chain.readPayload,
    threadEraOf: (unix: number) => Math.floor(unix / ERA_LEN),
    now: chain.now,
    random: (n: number) => { const out = new Uint8Array(n); for (let i = 0; i < n; i += 1) out[i] = (fill * 31 + i * 7 + Math.floor(chain.now() % 251)) & 0xff; return out; },
    ...extra,
  });
  return { runtime, wallet, hash: publicGroupKeyOfWallet(wallet)!, puts };
}

const pointerOf = (record: any, owner: Uint8Array | null = null) => ({ founder: record.founder, owner: owner ?? record.owner, foundedEra: record.foundedEra, name: record.name });
const controlRow = (chain: ReturnType<typeof fakeChain>, uid: bigint, wallet: string, kind: number, payload: any, n: number) => chain.publishAs(wallet)({
  uid, blocks: [{ type: 'group', bytes: encodePublicGroupControl(kind, { ...payload, sentAt: chain.now() }) }], streamId: n.toString(16).padStart(32, '0'),
});
const joinRow = (chain: ReturnType<typeof fakeChain>, uid: bigint, wallet: string, n: number) => controlRow(chain, uid, wallet, PUBLIC_GROUP_KIND.JOIN, {}, n);

describe('PUBLIC GROUPS — the runtime over a fake chain', () => {
  it('PGR-01: creating writes ONE founding row into a control thread addressed by the founder — both threads are — and the record survives a reload', async () => {
    const chain = fakeChain();
    const { runtime, hash } = runtimeFor(chain, 0x11);
    const record = await runtime.create({ name: 'the square' });
    expect(record.kind).toBe('public');
    expect(record.name).toBe('the square');
    expect(hex(record.founder)).toBe(hex(hash));
    expect(record.openedAt, 'when this device made the room — the list\'s recency until a message arrives').toBe(CLOCK);
    expect(isPublicGroupOwner(record, hash) && isPublicGroupAdmin(record, hash)).toBe(true);
    const control = chain.threads.get(String(publicGroupControlUid(record.groupId, hash))) ?? [];
    expect(control.length, 'one row, in the control thread').toBe(1);
    expect(chain.threads.get(String(publicGroupChatUid(record.groupId, hash))) ?? [], 'and none in the chat').toEqual([]);
    const [block] = chain.decodeDocument(control[0].body.documentBytes);
    expect(decodePublicGroupControl(block.bytes)).toMatchObject({ kind: PUBLIC_GROUP_KIND.FOUND, name: 'the square' });
    const other = publicGroupKeyOfWallet(walletOf(0x99))!;
    expect(publicGroupControlUid(record.groupId, hash)).not.toBe(publicGroupControlUid(record.groupId, other));
    expect(publicGroupChatUid(record.groupId, hash)).not.toBe(publicGroupChatUid(record.groupId, other));
    expect(publicGroupChatUid(record.groupId, hash)).not.toBe(publicGroupControlUid(record.groupId, hash));
    const stored = serializePublicGroupRecord(record);
    expect(stored).toMatchObject({ v: 2, kind: 'public', founder: hex(hash) });
    expect('epochs' in stored || 'rosterKeys' in stored, 'no epoch keys — there is nothing to seal').toBe(false);
    expect(hex(parsePublicGroupRecord(stored).founder!)).toBe(hex(hash));
    expect(parsePublicGroupRecord(stored).openedAt, 'and it survives the store').toBe(CLOCK);
    expect((await runtime.load()).length).toBe(1);
    expect((await runtime.sync())[0].chatRead, 'an empty chat was read — there was nothing to decline').toBe(true);
    const broken = runtimeFor(chain, 0x12, { publish: async () => { throw new Error('no GRAM'); } });
    await expect(broken.runtime.create({ name: 'never' })).rejects.toThrow();
    expect(broken.runtime.list().length).toBe(0);
    expect((await broken.runtime.sync()).length).toBe(0);
  });

  it('PGR-02: a guest joins from the pointer — nobody is asked — and the OWNER comes from the chain, never from the pointer', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const mallory = runtimeFor(chain, 0x66);
    const record = await owner.runtime.create({ name: 'the square' });
    const token = encodePublicGroupJoinToken({ groupId: record.groupId, ...owner.runtime.pointerOf(hex(record.groupId)) });
    const pointer = parsePublicGroupJoinToken(token)!;
    expect(pointer.public).toBe(true);
    expect(hex(pointer.founder)).toBe(hex(owner.hash));
    chain.tick();
    const joined = await guest.runtime.join(pointer.groupId, { ...pointer, displayName: 'Bo' });
    expect(joined.members.some((m) => hex(m.groupKey) === hex(guest.hash)), 'the guest is on their own card at once').toBe(true);
    const [ownerPass] = await owner.runtime.sync();
    expect(ownerPass.record.members.map((m) => hex(m.groupKey)).sort()).toEqual([hex(owner.hash), hex(guest.hash)].sort());
    expect(ownerPass.record.members.find((m) => hex(m.groupKey) === hex(guest.hash))?.name).toBe('Bo');
    expect(isPublicGroupAdmin(ownerPass.record, guest.hash), 'joining makes nobody an admin').toBe(false);
    const [guestPass] = await guest.runtime.sync();
    expect(guestPass.record.name).toBe('the square');
    expect(guestPass.record.foundedEra, 'the founding row says which era the group was born in').toBe(ERA);
    expect(hex(guestPass.record.owner!)).toBe(hex(owner.hash));
    chain.tick();
    await controlRow(chain, publicGroupControlUid(record.groupId, owner.hash), mallory.wallet, PUBLIC_GROUP_KIND.BAN, { groupKey: owner.hash }, 0x901);
    await controlRow(chain, publicGroupControlUid(record.groupId, owner.hash), mallory.wallet, PUBLIC_GROUP_KIND.PROFILE, { name: 'mine now' }, 0x902);
    const victim = runtimeFor(chain, 0x33);
    await victim.runtime.join(record.groupId, { ...pointer, owner: mallory.hash });
    const [victimPass] = await victim.runtime.sync();
    expect(hex(victimPass.record.owner!), 'the pointer\'s owner is not believed').toBe(hex(owner.hash));
    expect(victimPass.record.name).toBe('the square');
    expect(victimPass.record.banned.length).toBe(0);
    await expect(guest.runtime.join(record.groupId, { founder: null as any })).rejects.toThrow();
    await expect(guest.runtime.join(record.groupId, { founder: mallory.hash })).rejects.toThrow(/another founder/);
  });

  it('PGR-03: a message goes to the CHAT thread and comes back under the key the sender was given — writer and stream, in the reader\'s own spelling', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    await guest.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    const sent = await owner.runtime.say(hex(record.groupId), 'hello, square');
    expect(sent.key).toBe(keyOf(owner.wallet, sent.streamId));
    expect(sent.key.startsWith(`stream:${hex(owner.hash)}:`)).toBe(true);
    const chat = chain.threads.get(String(publicGroupChatUid(record.groupId, owner.hash))) ?? [];
    expect(chat.length, 'one row in the chat thread').toBe(1);
    expect(chat[0].body.streamId.startsWith('0x'), 'the chain spells the stream id with 0x, as the real reader does').toBe(true);
    const [guestPass] = await guest.runtime.sync();
    expect(guestPass.messages.length).toBe(1);
    expect(guestPass.messages[0]).toMatchObject({ key: sent.key, text: 'hello, square', senderWallet: owner.wallet, hidden: false });
    expect(guestPass.messages[0].coords).toMatchObject({ entryId: 0, seq: 0, generation: 17 });
    const [ownerPass] = await owner.runtime.sync();
    expect(ownerPass.messages[0].key, 'the sender\'s own pass returns the same key — how an echo is confirmed').toBe(sent.key);
    expect(ownerPass.chatRead).toBe(true);
    await expect(owner.runtime.say(hex(record.groupId), '   ')).rejects.toThrow();
  });

  it('PGR-04: only the OWNER names admins or hands over; a forged handover is ignored, a handover to a banned wallet too', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const third = runtimeFor(chain, 0x33);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    for (const r of [guest, third]) { chain.tick(); await r.runtime.join(record.groupId, pointerOf(record)); }
    await owner.runtime.sync();
    await guest.runtime.sync();
    await expect(guest.runtime.setAdmins(id, [guest.hash])).rejects.toThrow();
    chain.tick();
    await owner.runtime.setAdmins(id, [guest.hash]);
    const [ownerPass] = await owner.runtime.sync();
    expect(ownerPass.record.admins.map(hex).sort(), 'the owner stays in the set it named').toEqual([hex(owner.hash), hex(guest.hash)].sort());
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    chain.tick();
    await controlRow(chain, controlUid, guest.wallet, PUBLIC_GROUP_KIND.ADMIN, { admins: [guest.hash], owner: guest.hash }, 0xff1);
    const [afterForgery] = await third.runtime.sync();
    expect(hex(afterForgery.record.owner!), 'the forged handover changed nothing').toBe(hex(owner.hash));
    expect(afterForgery.record.admins.map(hex).sort()).toEqual([hex(owner.hash), hex(guest.hash)].sort());
    chain.tick();
    await owner.runtime.ban(id, third.hash);
    chain.tick();
    await controlRow(chain, controlUid, owner.wallet, PUBLIC_GROUP_KIND.ADMIN, { admins: [owner.hash, third.hash], owner: third.hash }, 0xff2);
    const [toBanned] = await guest.runtime.sync();
    expect(hex(toBanned.record.owner!), 'not handed to somebody shown the door').toBe(hex(owner.hash));
    chain.tick();
    await owner.runtime.transferOwnership(id, guest.hash);
    const [handed] = await third.runtime.sync();
    expect(hex(handed.record.owner!)).toBe(hex(guest.hash));
    expect(isPublicGroupAdmin(handed.record, owner.hash)).toBe(true);
    chain.tick();
    await controlRow(chain, controlUid, owner.wallet, PUBLIC_GROUP_KIND.ADMIN, { admins: [owner.hash], owner: owner.hash }, 0xff3);
    const [still] = await third.runtime.sync();
    expect(hex(still.record.owner!), 'and now the OLD owner\'s ADMIN row is the one that is ignored').toBe(hex(guest.hash));
  });

  it('PGR-05: a ban HIDES — the pass names who was banned and who was lifted, and a lift re-reads the chat', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    chain.tick();
    await guest.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await guest.runtime.say(id, 'I am loud');
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.ban(id, guest.hash);
    const reader = runtimeFor(chain, 0x55);
    await reader.runtime.join(record.groupId, pointerOf(record));
    const [seenByReader] = await reader.runtime.sync();
    expect(seenByReader.bannedNow, 'the pass says who — on a device that did not do it').toEqual([hex(guest.hash)]);
    const [banned] = await owner.runtime.sync();
    expect(banned.bannedNow, 'the banning device knew already; the pass repeats nothing').toEqual([]);
    expect(banned.record.members.some((m) => hex(m.groupKey) === hex(guest.hash)), 'off the card').toBe(false);
    expect(banned.record.known[hex(guest.hash)]?.wallet, 'but still known by wallet, for the banned list').toBe(guest.wallet);
    expect(banned.messages.length, 'the row is still there').toBe(1);
    expect(banned.messages[0].hidden, 'and hidden').toBe(true);
    chain.tick();
    await guest.runtime.say(id, 'still here');
    const [after] = await owner.runtime.sync();
    expect(after.messages.every((m) => m.hidden)).toBe(true);
    expect(after.bannedNow).toEqual([]);
    chain.tick();
    const liftedRecord = await owner.runtime.ban(id, guest.hash, { lift: true });
    expect(liftedRecord.read.chat, 'the lifting device drops its chat marks at once, so the words come back over the next passes').toEqual({});
    const [lifted] = await owner.runtime.sync();
    expect(lifted.liftedNow, 'already lifted here').toEqual([]);
    expect(lifted.messages.every((m) => !m.hidden), 'and the words are back on this very pass').toBe(true);
    const [liftSeen] = await reader.runtime.sync();
    expect(liftSeen.liftedNow, 'the reader learns the lift from the chain').toEqual([hex(guest.hash)]);
    expect(liftSeen.record.read.chat, 'and drops its chat marks').toEqual({});
    const [again] = await owner.runtime.sync();
    expect(again.messages.every((m) => !m.hidden)).toBe(true);
    expect(again.record.members.some((m) => hex(m.groupKey) === hex(guest.hash)), 'a writer is on the card again').toBe(true);
    await expect(owner.runtime.ban(id, owner.hash)).rejects.toThrow();
    chain.tick();
    await owner.runtime.setAdmins(id, [guest.hash]);
    await guest.runtime.sync();
    const third = runtimeFor(chain, 0x33);
    chain.tick();
    await third.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await owner.runtime.setAdmins(id, [guest.hash, third.hash]);
    await guest.runtime.sync();
    await expect(guest.runtime.ban(id, third.hash), 'an admin banning an admin is the hijack one door over').rejects.toThrow();
  });

  it('PGR-06: a founding row by anyone but the founder is noise, and a name of a megabyte is ninety-six bytes', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const squatter = runtimeFor(chain, 0x44);
    const record = await owner.runtime.create({ name: 'the square' });
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    chain.tick();
    await controlRow(chain, controlUid, squatter.wallet, PUBLIC_GROUP_KIND.FOUND, { name: 'mine now' }, 0xdd1);
    chain.tick();
    await chain.publishAs(squatter.wallet)({ uid: controlUid, blocks: [{ type: 'group', bytes: (() => { const json = new TextEncoder().encode(JSON.stringify({ v: 1, name: 'x'.repeat(1 << 20), sentAt: chain.now() })); const out = new Uint8Array(1 + json.length); out[0] = PUBLIC_GROUP_KIND.JOIN; out.set(json, 1); return out; })() }], streamId: 'dd2'.padStart(32, '0') });
    const reader = runtimeFor(chain, 0x55);
    await reader.runtime.join(record.groupId, pointerOf(record, null));
    const [pass] = await reader.runtime.sync();
    expect(hex(pass.record.owner!)).toBe(hex(owner.hash));
    expect(pass.record.name).toBe('the square');
    const seated = pass.record.members.find((m) => hex(m.groupKey) === hex(squatter.hash));
    expect(seated, 'a joiner is seated').toBeTruthy();
    expect(new TextEncoder().encode(seated!.name!).length).toBeLessThanOrEqual(96);
    expect(JSON.stringify(serializePublicGroupRecord(pass.record)).length).toBeLessThan(20_000);
  });

  it('PGR-07: a control write is believed on screen and TAKEN BACK when the chain never shows it — unless a later write landed', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    await owner.runtime.sync();
    const lostPublish = async () => ({ createdAtSec: chain.now() });
    const lost = runtimeFor(chain, 0x11, { publish: lostPublish });
    await lost.runtime.join(record.groupId, pointerOf(record));
    await lost.runtime.sync();
    chain.tick();
    const renamed = await lost.runtime.setName(id, 'the plaza');
    expect(renamed.name, 'believed at once').toBe('the plaza');
    const [soon] = await lost.runtime.sync();
    expect(soon.record.name, 'inside the window it stays').toBe('the plaza');
    chain.tick(PUBLIC_GROUP_CONTROL_CONFIRM_S + 1);
    const [late] = await lost.runtime.sync();
    expect(late.record.name, 'a name nobody else could ever see is not the name').toBe('the square');
    chain.tick();
    await owner.runtime.setName(id, 'the square II');
    const slow = runtimeFor(chain, 0x11, { publish: lostPublish });
    await slow.runtime.join(record.groupId, pointerOf(record));
    await slow.runtime.sync();
    chain.tick();
    await slow.runtime.setName(id, 'the plaza');
    const [held1] = await slow.runtime.sync();
    const [held2] = await slow.runtime.sync();
    expect([held1.record.name, held2.record.name], 'believed on every pass inside the window').toEqual(['the plaza', 'the plaza']);
    chain.tick(PUBLIC_GROUP_CONTROL_CONFIRM_S + 1);
    const [gone] = await slow.runtime.sync();
    expect(gone.record.name, 'and taken back to what the chain says').toBe('the square II');
    chain.tick();
    await owner.runtime.setName(id, 'the square');
    const flaky = runtimeFor(chain, 0x11, { publish: lostPublish });
    await flaky.runtime.join(record.groupId, pointerOf(record));
    await flaky.runtime.sync();
    chain.tick();
    await flaky.runtime.setName(id, 'A: lost');
    chain.tick();
    await owner.runtime.setName(id, 'B: landed');
    const [seenB] = await flaky.runtime.sync();
    expect(seenB.record.name, 'own write believed over a landed row: if A lands at all, it lands after B').toBe('A: lost');
    chain.tick(PUBLIC_GROUP_CONTROL_CONFIRM_S + 1);
    const [afterExpiry] = await flaky.runtime.sync();
    expect(afterExpiry.record.name, 'A\'s expiry does not roll back B').toBe('B: landed');
    expect(afterExpiry.record.pending.length).toBe(0);
  });

  it('PGR-08: whoever writes is on the card; the owner cannot leave; a member who left and rejoined is a member again, in any read order', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const writer = runtimeFor(chain, 0x77);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    await writer.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await chain.publishAs(walletOf(0x88))({ uid: publicGroupChatUid(record.groupId, owner.hash), blocks: [{ type: 'text', text: 'passing by' }], streamId: 'cc'.repeat(16) });
    const [pass] = await owner.runtime.sync();
    expect(pass.record.members.some((m) => m.wallet === walletOf(0x88)), 'a writer is a member').toBe(true);
    expect(pass.messages.length).toBe(1);
    await expect(owner.runtime.leave(id)).rejects.toThrow();
    chain.tick();
    const left = await writer.runtime.leave(id);
    expect(left.leftAt).toBeGreaterThan(0);
    const [after] = await owner.runtime.sync();
    expect(after.record.members.some((m) => hex(m.groupKey) === hex(writer.hash))).toBe(false);
    expect((await writer.runtime.sync()).length, 'read on for its own last rows').toBe(1);
    chain.tick();
    const back = runtimeFor(chain, 0x77);
    await back.runtime.join(record.groupId, pointerOf(record));
    const [rejoined] = await back.runtime.sync();
    expect(rejoined.record.leftAt).toBeNull();
    expect(rejoined.record.members.some((m) => hex(m.groupKey) === hex(writer.hash))).toBe(true);
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.transferOwnership(id, writer.hash);
    await back.runtime.sync();
    chain.tick();
    await back.runtime.transferOwnership(id, owner.hash);
    await back.runtime.sync();
    chain.tick();
    await back.runtime.leave(id);
    expect((await back.runtime.sync()).length, 'read on for its own last rows [round 7]').toBe(1);
    chain.tick();
    await back.runtime.join(record.groupId, pointerOf(record));
    const passes = [await back.runtime.sync(), await back.runtime.sync()].map((p) => p[0]);
    expect(passes.map((p) => p?.record.leftAt), 'open on both passes').toEqual([null, null]);
    expect(passes.map((p) => p && hex(p.record.owner!)), 'the owner the chain named, not the founder by default').toEqual([hex(owner.hash), hex(owner.hash)]);
    expect(passes[1]!.record.pending.length, 'the JOIN landed').toBe(0);
  });

  it('PGR-09: a row the chain hid is hidden here too, and one bad row does not take the pass down', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    chain.tick();
    await owner.runtime.say(id, 'fine');
    chain.tick();
    await owner.runtime.say(id, 'reported');
    chain.hide(publicGroupChatUid(record.groupId, owner.hash), 1);
    chain.rowOf(publicGroupChatUid(record.groupId, owner.hash), owner.wallet, new Uint8Array([1, 2, 3]), 'aa'.repeat(16));
    const [pass] = await owner.runtime.sync();
    expect(pass.messages.map((m) => [m.text, m.hidden])).toEqual([['fine', false], ['reported', true]]);
  });

  it('PGR-10: a document in parts is one row, put together across passes; a replayed stream id names a row of its own', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const reader = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    await reader.runtime.join(record.groupId, pointerOf(record));
    const chatUid = publicGroupChatUid(record.groupId, owner.hash);
    const long = runtimeFor(chain, 0x11, { publish: chain.publishAs(owner.wallet, { parts: 3 }) });
    await long.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    const words = 'a message long enough to need three capsules '.repeat(3);
    const sent = await long.runtime.say(id, words);
    const chat = chain.threads.get(String(chatUid))!;
    expect(chat.length, 'three rows on chain').toBe(3);
    const [pass] = await reader.runtime.sync();
    expect(pass.messages.length, 'one message on screen').toBe(1);
    expect(pass.messages[0].key).toBe(sent.key);
    expect(pass.messages[0].text).toBe(words.trim());
    expect(pass.messages[0].coords.entryId, 'seated at its first part').toBe(0);
    const held = chat.pop();
    const fresh = runtimeFor(chain, 0x33);
    await fresh.runtime.join(record.groupId, pointerOf(record));
    expect(assemblePublicGroupDocuments(chat, chain.readPayload).docs.length, 'two of three parts is no document').toBe(0);
    const [partial] = await fresh.runtime.sync();
    expect(partial.messages.length).toBe(0);
    expect(Object.keys(partial.record.parts.chat).length, 'the two parts wait in the record').toBe(1);
    chat.push(held);
    const [whole] = await fresh.runtime.sync();
    expect(whole.messages.length).toBe(1);
    expect(Object.keys(whole.record.parts.chat).length).toBe(0);
    const docs = assemblePublicGroupDocuments([{ ...chat[0], publisher: walletOf(0x99), entry_id: 9n, body: { ...chat[0].body, partIndex: 1 } }, ...chat], chain.readPayload).docs;
    expect(docs.length).toBe(1);
    expect(docs[0].publisher).toBe(owner.wallet);
    const bomb = chat.map((row) => ({ ...row, body: { ...row.body, partCount: PUBLIC_GROUP_MAX_PARTS + 1 } }));
    expect(assemblePublicGroupDocuments(bomb, chain.readPayload).docs.length).toBe(0);
    chain.tick();
    const banned = runtimeFor(chain, 0x44);
    await banned.runtime.join(record.groupId, pointerOf(record));
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.ban(id, banned.hash);
    chain.tick();
    await chain.publishAs(banned.wallet)({ uid: chatUid, blocks: [{ type: 'text', text: 'replay' }], streamId: sent.streamId });
    const [replayed] = await reader.runtime.sync();
    const theirs = replayed.messages.find((m) => m.senderWallet === banned.wallet);
    expect(replayed.messages.some((m) => m.key === sent.key && m.hidden), 'the owner\'s message stands').toBe(false);
    expect(theirs?.hidden, 'the replay is hidden with its writer').toBe(true);
    expect(theirs?.key).not.toBe(sent.key);
  });

  it('PGR-11: a thread is read COMPLETELY and folded IN CHAIN ORDER — a newcomer meets the appointment before the rename, whatever the window', async () => {
    const chain = fakeChain({ window: 96 });
    const owner = runtimeFor(chain, 0x11);
    const admin = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    chain.tick();
    await admin.runtime.join(record.groupId, pointerOf(record));
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.setAdmins(id, [admin.hash]);
    for (let n = 1; n <= 250; n += 1) { chain.tick(); await joinRow(chain, controlUid, walletNumbered(n), n); }
    await admin.runtime.sync();
    chain.tick();
    await admin.runtime.setName(id, 'the plaza');
    const newcomer = runtimeFor(chain, 0x33, { pagesPerPass: 1 });
    await newcomer.runtime.join(record.groupId, pointerOf(record));
    const [first] = await newcomer.runtime.sync();
    expect(first.connected, 'one round back is not the bottom').toBe(false);
    expect(first.record.name, 'nothing is believed before the thread is read to the bottom').toBe('the square');
    expect(first.record.buffer.length, 'the rows read so far wait in the record').toBeGreaterThan(0);
    let done = first;
    for (let pass = 0; pass < 4 && !done.connected; pass += 1) [done] = await newcomer.runtime.sync();
    expect(done.connected).toBe(true);
    expect(done.record.name, 'folded in chain order: the appointment, then the rename').toBe('the plaza');
    expect(isPublicGroupAdmin(done.record, admin.hash)).toBe(true);
    expect(done.record.members.length, 'the founder, the admin, 250 joiners, the newcomer').toBe(253);
    expect(done.record.buffer.length).toBe(0);
    expect(done.record.known[hex(admin.hash)]?.name ?? null, 'a rename names the room, never the admin who renamed it').not.toBe('the plaza');
    chain.reads.length = 0;
    newcomer.puts.length = 0;
    await newcomer.runtime.sync();
    expect(chain.reads.filter((r) => r.uid === controlUid).length, 'one read of the control thread').toBe(1);
    expect(newcomer.puts.length, 'a pass that changed nothing persists nothing').toBe(0);
    for (let n = 1001; n <= 1200; n += 1) { chain.tick(); await joinRow(chain, controlUid, walletNumbered(n), n); }
    chain.tick();
    await owner.runtime.transferOwnership(id, admin.hash);
    const [gap] = await newcomer.runtime.sync();
    expect(gap.connected, 'one round a pass cannot close a 200-row gap at once').toBe(false);
    expect(hex(gap.record.owner!), 'the handover at the top waits for the gap').toBe(hex(owner.hash));
    let closed = gap;
    for (let pass = 0; pass < 5 && !closed.connected; pass += 1) [closed] = await newcomer.runtime.sync();
    expect(closed.connected).toBe(true);
    expect(hex(closed.record.owner!)).toBe(hex(admin.hash));
    expect(closed.record.members.length, 'nobody in the gap was skipped').toBe(453);
  });

  it('PGR-17: a pointer\'s name is provisional — the founder\'s row names the room — and a shard declined on its first window keeps the thread from being called connected', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'cat photos' });
    chain.tick();
    const liar = runtimeFor(chain, 0x22);
    await liar.runtime.join(record.groupId, { ...pointerOf(record), name: 'Platho Official Support' });
    expect(liar.runtime.get(hex(record.groupId))!.name, 'the link\'s name, until the chain is read').toBe('Platho Official Support');
    await liar.runtime.sync();
    expect(liar.runtime.get(hex(record.groupId))!.name, 'the founder\'s row names the room').toBe('cat photos');
    chain.tick();
    await owner.runtime.setName(hex(record.groupId), 'dog photos');
    await liar.runtime.sync();
    expect(liar.runtime.get(hex(record.groupId))!.name).toBe('dog photos');
    await liar.runtime.sync();
    expect(liar.runtime.get(hex(record.groupId))!.name).toBe('dog photos');
    const newcomer = runtimeFor(chain, 0x33);
    await newcomer.runtime.join(record.groupId, pointerOf(record));
    chain.decline(1);
    const [dark] = await newcomer.runtime.sync();
    expect(dark.connected, 'a declined newest window is not a read thread').toBe(false);
    const [lit] = await newcomer.runtime.sync();
    expect(lit.connected).toBe(true);
    expect(lit.record.members.length).toBe(3);
  });

  it('PGR-18: the control buffer is bounded in bytes and keeps no stranger\'s heavy document; a HIDE older than everything held is not seated and does not dirty the record', async () => {
    const { PUBLIC_GROUP_BUFFER_MAX_BYTES, PUBLIC_GROUP_BUFFER_ROW_MAX_BYTES } = await import('../web/public-group-runtime.mjs');
    expect(PUBLIC_GROUP_BUFFER_ROW_MAX_BYTES).toBe(256 * 1024);
    expect(PUBLIC_GROUP_BUFFER_MAX_BYTES).toBe(4 * 1024 * 1024);
    const chain = fakeChain({ window: 96 });
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'the square' });
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    for (let n = 1; n <= 120; n += 1) { chain.tick(); await joinRow(chain, controlUid, walletNumbered(n), n); }
    chain.tick();
    await chain.publishAs(walletNumbered(500))({ uid: controlUid, blocks: [{ type: 'group', bytes: encodePublicGroupControl(PUBLIC_GROUP_KIND.JOIN, { sentAt: chain.now() }) }, { type: 'image', data: 'x'.repeat(300 * 1024) }], streamId: (500).toString(16).padStart(32, '0') });
    const newcomer = runtimeFor(chain, 0x22, { pagesPerPass: 0 });
    await newcomer.runtime.join(record.groupId, pointerOf(record));
    const [first] = await newcomer.runtime.sync();
    expect(first.connected).toBe(false);
    const buffered = newcomer.runtime.get(hex(record.groupId))!.buffer ?? [];
    expect(buffered.length, 'the window\'s rows wait in the buffer').toBeGreaterThan(0);
    expect(buffered.some((lite: any) => lite.documentBytes.length > 300 * 1024), 'the stranger\'s heavy document is not kept').toBe(false);
    chain.tick();
    await chain.publishAs(owner.wallet)({ uid: controlUid, blocks: [{ type: 'group', bytes: encodePublicGroupControl(PUBLIC_GROUP_KIND.PROFILE, { name: 'x', sentAt: chain.now() }) }, { type: 'image', data: 'y'.repeat(300 * 1024) }], streamId: (501).toString(16).padStart(32, '0') });
    await newcomer.runtime.sync();
    expect((newcomer.runtime.get(hex(record.groupId))!.buffer ?? []).some((lite: any) => lite.documentBytes.length > 300 * 1024), 'the owner\'s is').toBe(true);
  });

  it('PGR-19: a write flooded out of the window is not taken back until the thread is connected — and then it is confirmed; a re-join whose row never lands goes back to left', async () => {
    const chain = fakeChain({ window: 96 });
    const owner = runtimeFor(chain, 0x11, { pagesPerPass: 1 });
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    const spammer = walletNumbered(7);
    chain.tick(); await joinRow(chain, controlUid, spammer, 7);
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.ban(id, publicGroupKeyOfWallet(spammer)!);
    for (let n = 100; n < 300; n += 1) { chain.tick(); await joinRow(chain, controlUid, walletNumbered(n), n); }
    chain.tick(700);
    const [gapped] = await owner.runtime.sync();
    expect(gapped.connected, 'a gap below the newest window').toBe(false);
    expect(owner.runtime.get(id)!.pending.length, 'not taken back from an unconnected thread').toBe(1);
    expect(owner.runtime.get(id)!.banned.map(hex)).toContain(hex(publicGroupKeyOfWallet(spammer)!));
    for (let pass = 0; pass < 6 && owner.runtime.get(id)!.pending.length > 0; pass += 1) await owner.runtime.sync();
    expect(owner.runtime.get(id)!.pending.length, 'met while paging the gap: confirmed').toBe(0);
    expect(owner.runtime.get(id)!.banned.map(hex)).toContain(hex(publicGroupKeyOfWallet(spammer)!));
    let drop = false;
    const member = runtimeFor(chain, 0x44, { publish: async (args: any) => (drop ? undefined : chain.publishAs(walletOf(0x44))(args)) });
    await member.runtime.join(record.groupId, pointerOf(record));
    await member.runtime.sync();
    chain.tick();
    await member.runtime.leave(id);
    await member.runtime.sync();
    const leftAt = member.runtime.get(id)!.leftAt;
    expect(leftAt).toBeTruthy();
    for (let n = 400; n < 520; n += 1) { chain.tick(); await joinRow(chain, controlUid, walletNumbered(n), n); }
    for (let pass = 0; pass < 8; pass += 1) await member.runtime.sync();
    drop = true;
    chain.tick();
    await member.runtime.join(record.groupId, pointerOf(record));
    expect(member.runtime.get(id)!.leftAt, 'believed at broadcast').toBeNull();
    chain.tick(700);
    for (let pass = 0; pass < 8 && member.runtime.get(id)!.pending.length > 0; pass += 1) await member.runtime.sync();
    expect(member.runtime.get(id)!.leftAt, 'taken back: the chain never showed the row').toBeTruthy();
    expect(member.runtime.get(id)!.pending.length).toBe(0);
  });

  it('PGR-20: an ambiguous broadcast is a write — the control row and the message are believed, and confirmed or taken back by the chain', async () => {
    const chain = fakeChain();
    let ambiguous = false;
    const owner = runtimeFor(chain, 0x11, {
      publish: async (args: any) => { const out = await chain.publishAs(walletOf(0x11))(args); if (ambiguous) { const error: any = new Error('sendBoc timed out'); error.builtBoc = 'te6cc'; throw error; } return out; },
    });
    const record = await owner.runtime.create({ name: 'unsure' });
    const id = hex(record.groupId);
    ambiguous = true;
    const said = await owner.runtime.say(id, 'did this go?');
    expect(said.key).toBeTruthy();
    const renamed = await owner.runtime.setName(id, 'believed');
    expect(renamed.name).toBe('believed');
    expect(renamed.pending.some((p: any) => p.kind === PUBLIC_GROUP_KIND.PROFILE)).toBe(true);
    ambiguous = false;
    const [pass] = await owner.runtime.sync();
    expect(pass.messages.map((m: any) => m.key)).toContain(said.key);
    expect(owner.runtime.get(id)!.pending.length, 'the row landed: confirmed').toBe(0);
  });

  it('PGR-12: a page the pump declined is not read — the rows come back when the pump answers', async () => {
    const chain = fakeChain({ window: 96 });
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'the square' });
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    for (let n = 1; n <= 150; n += 1) { chain.tick(); await joinRow(chain, controlUid, walletNumbered(n), n); }
    const newcomer = runtimeFor(chain, 0x22, { pagesPerPass: 6 });
    await newcomer.runtime.join(record.groupId, pointerOf(record));
    chain.decline(1, { after: 1 });
    const [first] = await newcomer.runtime.sync();
    expect(first.connected, 'the declined page did not count as read').toBe(false);
    const shardKey = chain.shardKeyOf(controlUid);
    expect(first.record.read.control[shardKey]?.[0]?.bottom, 'the mark stayed at the window\'s foot').toBe(152 - 96);
    const [second] = await newcomer.runtime.sync();
    expect(second.connected).toBe(true);
    expect(second.record.members.length, 'the founder, 150 joiners, the newcomer').toBe(152);
    chain.tick();
    const said = await newcomer.runtime.say(hex(record.groupId), 'anybody?');
    chain.decline(1, { after: 1 });
    const [dark] = await newcomer.runtime.sync();
    expect(dark.chatRead).toBe(false);
    expect(dark.messages.length).toBe(0);
    expect(dark.record.read.chat, 'nothing marked').toEqual({});
    const [lit] = await newcomer.runtime.sync();
    expect(lit.chatRead).toBe(true);
    expect(lit.messages.map((m) => m.key)).toEqual([said.key]);
  });

  it('PGR-14: the restore plants a room from its pointer and publishes NOTHING — the JOIN already on chain is folded back in', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    chain.tick();
    await guest.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await guest.runtime.say(hex(record.groupId), 'from the old phone');
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    const rowsBefore = chain.threads.get(String(controlUid))!.length;
    const fresh = runtimeFor(chain, 0x22);
    const planted = await fresh.runtime.adopt(record.groupId, { founder: record.founder, foundedEra: record.foundedEra, name: 'the square' });
    expect(hex(planted.founder)).toBe(hex(owner.hash));
    expect(planted.pending, 'nothing on its way').toEqual([]);
    expect(planted.openedAt, 'planted now, so it sits where a new room sits').toBe(chain.now());
    expect(chain.threads.get(String(controlUid))!.length, 'nothing published').toBe(rowsBefore);
    expect((await fresh.runtime.load()).length, 'persisted').toBe(1);
    const [pass] = await fresh.runtime.sync();
    expect(pass.record.members.some((m) => hex(m.groupKey) === hex(guest.hash)), 'the JOIN from the old phone seats this wallet').toBe(true);
    expect(pass.messages.map((m) => m.text)).toEqual(['from the old phone']);
    expect(hex(pass.record.owner!)).toBe(hex(owner.hash));
    expect(await fresh.runtime.adopt(record.groupId, { founder: record.founder })).toBe(fresh.runtime.get(hex(record.groupId)));
    await expect(fresh.runtime.adopt(record.groupId, { founder: publicGroupKeyOfWallet(walletOf(0x66))! })).rejects.toThrow(/another founder/);
    const bare = runtimeFor(chain, 0x23);
    await expect(bare.runtime.adopt(record.groupId, { founder: null as any })).rejects.toThrow(/pointer without a founder/);
    expect(bare.runtime.list().length).toBe(0);
    const joined = await fresh.runtime.join(record.groupId, pointerOf(record));
    expect(joined.pending.length).toBe(1);
    expect(fresh.runtime.list().length).toBe(1);
    const founderAgain = runtimeFor(chain, 0x11);
    await founderAgain.runtime.adopt(record.groupId, { founder: record.founder, foundedEra: record.foundedEra, name: null });
    const [founderPass] = await founderAgain.runtime.sync();
    expect(founderPass.record.name, 'the name comes back with the founding row').toBe('the square');
    expect(isPublicGroupOwner(founderPass.record, owner.hash)).toBe(true);
  });

  it('PGR-15: a mute hides a wallet\'s rows everywhere and keeps it on the card; the owner is immune, an admin only by the owner; a lift brings the words back', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const admin = runtimeFor(chain, 0x22);
    const loud = runtimeFor(chain, 0x33);
    const reader = runtimeFor(chain, 0x44);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    for (const r of [admin, loud, reader]) { chain.tick(); await r.runtime.join(record.groupId, pointerOf(record)); }
    chain.tick();
    await loud.runtime.say(id, 'noise');
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.setAdmins(id, [admin.hash]);
    await admin.runtime.sync();
    chain.tick();
    const mutedRecord = await admin.runtime.mute(id, loud.hash);
    expect(isPublicGroupMuted(mutedRecord, loud.hash)).toBe(true);
    expect(mutedRecord.members.some((m) => hex(m.groupKey) === hex(loud.hash)), 'still on the card').toBe(true);
    const [readerPass] = await reader.runtime.sync();
    expect(readerPass.bannedNow, 'the pass names the silenced').toEqual([hex(loud.hash)]);
    expect(readerPass.messages.every((m) => m.hidden), 'their words are hidden').toBe(true);
    expect(readerPass.record.members.some((m) => hex(m.groupKey) === hex(loud.hash))).toBe(true);
    await expect(admin.runtime.mute(id, owner.hash)).rejects.toThrow(/cannot be muted/);
    await expect(owner.runtime.mute(id, owner.hash), 'not even by the owner').rejects.toThrow(/cannot be muted/);
    const foldedDirect = applyPublicGroupRows(mutedRecord, [{ senderKey: loud.hash, senderWallet: loud.wallet, createdAt: 1, coords: { era: 0, seq: 0, entryId: 0 }, key: `stream:${hex(loud.hash)}:${'ab'.repeat(16)}`, text: 'noise', hidden: false }]);
    expect(foldedDirect.messages[0].hidden).toBe(true);
    chain.tick();
    await owner.runtime.setAdmins(id, [admin.hash, reader.hash]);
    await admin.runtime.sync();
    await expect(admin.runtime.mute(id, reader.hash)).rejects.toThrow(/only the owner/);
    chain.tick();
    await controlRow(chain, controlUid, admin.wallet, PUBLIC_GROUP_KIND.MUTE, { groupKey: reader.hash }, 0xa11);
    const [forged] = await reader.runtime.sync();
    expect(isPublicGroupMuted(forged.record, reader.hash), 'a forged mute of an admin by an admin is noise').toBe(false);
    const rows = chain.threads.get(String(controlUid))!.length;
    await admin.runtime.mute(id, loud.hash);
    expect(chain.threads.get(String(controlUid))!.length).toBe(rows);
    chain.tick();
    const lifted = await admin.runtime.mute(id, loud.hash, { lift: true });
    expect(lifted.read.chat, 'the lifting device drops its chat marks').toEqual({});
    const [liftSeen] = await reader.runtime.sync();
    expect(liftSeen.liftedNow).toEqual([hex(loud.hash)]);
    const [again] = await reader.runtime.sync();
    expect(again.messages.every((m) => !m.hidden)).toBe(true);
  });

  it('PGR-16: an admin hides one row by its key with an excerpt — hidden everywhere, listed on every card — and a lift brings it back', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    chain.tick();
    await guest.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    const sent = await guest.runtime.say(id, 'the words that go');
    chain.tick();
    const stay = await guest.runtime.say(id, 'the words that stay');
    await owner.runtime.sync();
    chain.tick();
    const hid = await owner.runtime.hide(id, sent.key, { excerpt: '  the words   that go  ' + 'x'.repeat(200) });
    expect(Object.keys(hid.hidden)).toEqual([sent.key]);
    expect(hid.hidden[sent.key].excerpt.length, 'the excerpt is bounded and its whitespace collapsed').toBe(PUBLIC_GROUP_EXCERPT_MAX);
    expect(hid.hidden[sent.key].excerpt.startsWith('the words that go x')).toBe(true);
    const [guestPass] = await guest.runtime.sync();
    expect(guestPass.hiddenNow).toEqual([sent.key]);
    expect(guestPass.record.hidden[sent.key].excerpt.startsWith('the words that go')).toBe(true);
    expect(guestPass.messages.map((m) => [m.text, m.hidden])).toEqual([['the words that go', true], ['the words that stay', false]]);
    chain.tick();
    await controlRow(chain, controlUid, guest.wallet, PUBLIC_GROUP_KIND.HIDE, { key: stay.key, excerpt: 'mine' }, 0xb11);
    const [forged] = await owner.runtime.sync();
    expect(forged.record.hidden[stay.key], 'the stayer stays').toBeUndefined();
    expect(forged.messages.some((m) => m.key === stay.key && m.hidden)).toBe(false);
    expect(decodePublicGroupControl(encodePublicGroupControl(PUBLIC_GROUP_KIND.HIDE, { key: stay.key, excerpt: 'y'.repeat(300), sentAt: 1 }))!.excerpt!.length).toBe(PUBLIC_GROUP_EXCERPT_MAX);
    await expect(guest.runtime.hide(id, sent.key)).rejects.toThrow(/only an admin/);
    await expect(owner.runtime.hide(id, 'nonsense')).rejects.toThrow(/key/);
    const rows = chain.threads.get(String(controlUid))!.length;
    await owner.runtime.hide(id, sent.key);
    expect(chain.threads.get(String(controlUid))!.length).toBe(rows);
    chain.tick();
    const shown = await owner.runtime.hide(id, sent.key, { lift: true });
    expect(shown.hidden).toEqual({});
    expect(shown.read.chat, 'the lifting device re-reads').toEqual({});
    const [liftSeen] = await guest.runtime.sync();
    expect(liftSeen.unhiddenNow).toEqual([sent.key]);
    expect(liftSeen.record.read.chat, 'the reader re-reads too, so a row below the window comes back').toEqual({});
    const [again] = await guest.runtime.sync();
    expect(again.messages.every((m) => !m.hidden)).toBe(true);
    const back = parsePublicGroupRecord(serializePublicGroupRecord(hid));
    expect(back.hidden[sent.key].excerpt).toBe(hid.hidden[sent.key].excerpt);
  });

  it('PGR-13: the founder keeps a handover alive — one row, once the row that named the owner is ten months old', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const guest = runtimeFor(chain, 0x22);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    chain.tick();
    await guest.runtime.join(record.groupId, pointerOf(record));
    await owner.runtime.sync();
    chain.tick();
    await owner.runtime.transferOwnership(id, guest.hash);
    const [handed] = await owner.runtime.sync();
    expect(hex(handed.record.owner!)).toBe(hex(guest.hash));
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    const before = chain.threads.get(String(controlUid))!.length;
    chain.tick(PUBLIC_GROUP_REANCHOR_S - 100);
    await owner.runtime.sync();
    expect(chain.threads.get(String(controlUid))!.length, 'not yet').toBe(before);
    chain.tick(200);
    await owner.runtime.sync();
    expect(chain.threads.get(String(controlUid))!.length, 'the founder republished the handover').toBe(before + 1);
    const [row] = chain.decodeDocument(chain.threads.get(String(controlUid))!.at(-1)!.body.documentBytes);
    expect(decodePublicGroupControl(row.bytes)).toMatchObject({ kind: PUBLIC_GROUP_KIND.ADMIN, owner: guest.hash });
    chain.tick(PUBLIC_GROUP_CONTROL_CONFIRM_S + 1);
    await owner.runtime.sync();
    await owner.runtime.sync();
    expect(chain.threads.get(String(controlUid))!.length, 'one re-anchor, not one per pass').toBe(before + 1);
    const guestBefore = chain.threads.get(String(controlUid))!.length;
    chain.tick(PUBLIC_GROUP_REANCHOR_S);
    await guest.runtime.sync();
    expect(chain.threads.get(String(controlUid))!.length).toBe(guestBefore);
    void PUBLIC_GROUP_MEMBERS_MAX;
  });


  it('PGR-21: a name that is only bidi controls is NO name — a JOIN carries none, a PROFILE changes nothing', async () => {
    expect(decodePublicGroupControl(encodePublicGroupControl(PUBLIC_GROUP_KIND.JOIN, { name: '\u202e\u200f\u202c', sentAt: 1 }))!.name).toBeNull();
    expect(decodePublicGroupControl(encodePublicGroupControl(PUBLIC_GROUP_KIND.PROFILE, { name: '\u202e', sentAt: 1 }))!.name).toBeNull();
    expect(decodePublicGroupControl(encodePublicGroupControl(PUBLIC_GROUP_KIND.JOIN, { name: '\u202eAnn', sentAt: 1 }))!.name, 'the words survive the stripping').toBe('Ann');
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'the square' });
    const controlUid = publicGroupControlUid(record.groupId, owner.hash);
    chain.tick();
    await controlRow(chain, controlUid, walletOf(0x11), PUBLIC_GROUP_KIND.PROFILE, { name: '\u202e\u202d' }, 5);
    await owner.runtime.sync();
    expect(owner.runtime.get(hex(record.groupId))!.name, 'the room keeps its name').toBe('the square');
  });

  it('PGR-22: what this device wrote and never saw is bounded — sixty-four in flight at most, and a thread that never connects gives them up after a week', async () => {
    const chain = fakeChain();
    let drop = false;
    const owner = runtimeFor(chain, 0x11, { publish: async (args: any) => (drop ? undefined : chain.publishAs(walletOf(0x11))(args)) });
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    drop = true;
    for (let n = 0; n < PUBLIC_GROUP_PENDING_MAX + 6; n += 1) { chain.tick(); await owner.runtime.setName(id, `name ${n}`); }
    await owner.runtime.sync();
    expect(owner.runtime.get(id)!.pending.length, 'believed, and bounded by the pass').toBe(PUBLIC_GROUP_PENDING_MAX);
    chain.tick(PUBLIC_GROUP_CONTROL_CONFIRM_S + 5);
    chain.decline(4);
    const [declined] = await owner.runtime.sync();
    expect(declined.connected).toBe(false);
    expect(owner.runtime.get(id)!.pending.length, 'not taken back from an unconnected thread').toBe(PUBLIC_GROUP_PENDING_MAX);
    chain.tick(PUBLIC_GROUP_CONTROL_ABANDON_S + 5);
    chain.decline(4);
    const [abandoned] = await owner.runtime.sync();
    expect(abandoned.connected).toBe(false);
    expect(owner.runtime.get(id)!.pending.length, 'a week without the chain: given up').toBe(0);
  });

  it('PGR-23: a banned wallet is refused at the composer, not charged for a row nobody will see; the chat can be asked to be read again from the top', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const member = runtimeFor(chain, 0x44);
    await member.runtime.join(record.groupId, pointerOf(record));
    chain.tick(); await owner.runtime.say(id, 'one');
    chain.tick(); await owner.runtime.say(id, 'two');
    await owner.runtime.sync();
    const [first] = await member.runtime.sync();
    expect(first.messages.map((m: any) => m.text).sort()).toEqual(['one', 'two']);
    chain.tick();
    await owner.runtime.ban(id, member.hash);
    await member.runtime.sync();
    expect(isPublicGroupBanned(member.runtime.get(id)!, member.hash)).toBe(true);
    await expect(member.runtime.say(id, 'still here?')).rejects.toThrow(/banned/);
    expect(Object.keys(member.runtime.get(id)!.read?.chat ?? {}).length, 'the chat had been read').toBeGreaterThan(0);
    await member.runtime.rereadChat(id);
    expect(Object.keys(member.runtime.get(id)!.read?.chat ?? {}).length).toBe(0);
    const [again] = await member.runtime.sync();
    expect(again.messages.map((m: any) => m.text).sort(), 'read again from the top').toEqual(['one', 'two']);
  });

  it('PGR-24: the writers a room remembers are bounded and counted once — the eight-thousandth stranger costs the fold no listing', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'crowd' });
    const rows = Array.from({ length: PUBLIC_GROUP_KNOWN_MAX + 40 }, (_, n) => {
      const wallet = walletNumbered(n + 1);
      return { senderKey: publicGroupKeyOfWallet(wallet)!, senderWallet: wallet, createdAt: CLOCK + n + 1, coords: { era: ERA, seq: 0, entryId: n + 1 }, key: `stream:${n}`, control: { kind: PUBLIC_GROUP_KIND.JOIN, name: `w${n}`, sentAt: CLOCK + n + 1 } };
    });
    const folded = applyPublicGroupRows(record, rows).record;
    expect(Object.keys(folded.known).length).toBe(PUBLIC_GROUP_KNOWN_MAX);
    expect(folded.known[hex(publicGroupKeyOfWallet(walletNumbered(PUBLIC_GROUP_KNOWN_MAX + 40))!)]?.name, 'the newest writer is known').toBe(`w${PUBLIC_GROUP_KNOWN_MAX + 39}`);
    expect(folded.known[hex(publicGroupKeyOfWallet(walletNumbered(1))!)], 'the oldest gave way').toBeUndefined();
    const again = applyPublicGroupRows(folded, [rows[rows.length - 1]]).record;
    expect(Object.keys(again.known).length).toBe(PUBLIC_GROUP_KNOWN_MAX);
  });



  it('PGR-25: what waits for its missing parts is bounded in bytes and in age — the count cap alone admitted 85 MiB', () => {
    const readPayload = (post: any) => ({ type: 'document_comment', documentBytes: post.body.documentBytes, stream_id: post.body.streamId, partIndex: post.body.partIndex, partCount: post.body.partCount });
    const posts: any[] = [];
    for (let n = 0; n < 100; n += 1) {
      for (let part = 0; part < 3; part += 1) {
        posts.push({ publisher: walletNumbered(n % 7 + 1), created_at: BigInt(CLOCK + n), entry_id: BigInt(n * 4 + part), hidden: false, thread_epoch_tag: '1', thread_seq: 0, thread_generation: 17, thread_pk: '1', shard_key: 's',
          header: null, body: { documentBytes: new Uint8Array(50 * 1024).fill(7), streamId: `0x${n.toString(16).padStart(32, '0')}`, partIndex: part, partCount: 4 } });
      }
    }
    const { docs, parts } = assemblePublicGroupDocuments(posts, readPayload, { parts: {}, now: CLOCK + 400 });
    expect(docs).toEqual([]);
    const bytes = Object.values(parts).reduce((sum: number, stream: any) => sum + Object.values(stream.parts).reduce((s: number, lite: any) => s + Math.ceil(String(lite.documentBytes).length * 3 / 4), 0), 0);
    expect(bytes, 'held bytes under the bound').toBeLessThanOrEqual(PUBLIC_GROUP_PARTS_MAX_BYTES);
    expect(bytes, 'and not emptied either').toBeGreaterThan(PUBLIC_GROUP_PARTS_MAX_BYTES / 2);
    expect(Object.keys(parts).length).toBeLessThanOrEqual(PUBLIC_GROUP_MAX_PARTS);
    const stale = assemblePublicGroupDocuments([], readPayload, { parts, now: CLOCK + PUBLIC_GROUP_PARTS_MAX_AGE_S + 10_000 });
    expect(Object.keys(stale.parts).length).toBe(0);
  });

  it('PGR-26: a row\'s text has a ceiling; an ADMIN row from a stranger costs no work and the set is bounded; a PROFILE with no name says nothing; a quiet pass is free', async () => {
    const chain = fakeChain();
    const owner = runtimeFor(chain, 0x11);
    const record = await owner.runtime.create({ name: 'bounded' });
    const id = hex(record.groupId);
    const chatUid = publicGroupChatUid(record.groupId, owner.hash);
    chain.tick();
    await chain.publishAs(walletOf(0x11))({ uid: chatUid, blocks: [{ type: 'text', text: 'x'.repeat(PUBLIC_GROUP_TEXT_MAX_CHARS + 5000) }], streamId: 'ab'.repeat(16) });
    const [pass] = await owner.runtime.sync();
    expect(pass.messages[0].text.length, 'bounded on the read side').toBe(PUBLIC_GROUP_TEXT_MAX_CHARS);
    const stranger = walletNumbered(9);
    const many = Array.from({ length: 50_000 }, (_, i) => publicGroupKeyOfWallet(walletNumbered(i + 100))!);
    const before = owner.runtime.get(id)!;
    const t0 = performance.now();
    const folded = applyPublicGroupRows(before, [{ senderKey: publicGroupKeyOfWallet(stranger)!, senderWallet: stranger, createdAt: CLOCK + 5, coords: { era: ERA, seq: 0, entryId: 5 }, key: 'stream:x', control: { kind: PUBLIC_GROUP_KIND.ADMIN, admins: many, owner: null, sentAt: CLOCK + 5 } }]);
    expect(folded.record.admins.length, 'nobody seated').toBe(before.admins.length);
    expect(isPublicGroupAdmin(folded.record, many[0])).toBe(false);
    expect(performance.now() - t0, 'ms for a refused row of 50,000 keys').toBeLessThan(50);
    expect(decodePublicGroupControl(encodePublicGroupControl(PUBLIC_GROUP_KIND.ADMIN, { admins: many.slice(0, 5000), owner: many[0], sentAt: 1 }))!.admins.length, 'the decoder bounds the set').toBeLessThanOrEqual(PUBLIC_GROUP_MEMBERS_MAX);
    const nameless = decodePublicGroupControl(encodePublicGroupControl(PUBLIC_GROUP_KIND.PROFILE, { name: null, sentAt: 1 }))!;
    expect(nameless.name, 'a null name is no name — not the word "null"').toBeNull();
    const quiet = applyPublicGroupRows(before, []);
    expect(quiet.record, 'a pass with no rows hands back the very record').toBe(before);
    expect(quiet.changed).toBe(false);
  });

  it('PGR-27: a control write and the pass queue behind each other on the group\'s key — the rename a pass folded is not written over', async () => {
    const chain = fakeChain();
    let hold: Promise<void> | null = null;
    let release: (() => void) | null = null;
    const owner = runtimeFor(chain, 0x11, {
      publish: async (args: any) => {
        const out = await chain.publishAs(walletOf(0x11))(args);
        if (hold) await hold;
        return out;
      },
    });
    const record = await owner.runtime.create({ name: 'first name' });
    const id = hex(record.groupId);
    const other = runtimeFor(chain, 0x22);
    await other.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await owner.runtime.sync();
    await owner.runtime.setAdmins(id, [owner.hash, other.hash]);
    chain.tick();
    await other.runtime.sync();
    expect(isPublicGroupAdmin(other.runtime.get(id)!, other.hash)).toBe(true);
    hold = new Promise<void>((resolve) => { release = resolve; });
    const target = publicGroupKeyOfWallet(walletNumbered(3))!;
    const banning = owner.runtime.ban(id, target);
    await new Promise((resolve) => setTimeout(resolve, 5));
    chain.tick();
    await other.runtime.setName(id, 'renamed by the other admin');
    chain.tick();
    const passing = owner.runtime.sync();
    await new Promise((resolve) => setTimeout(resolve, 5));
    release!();
    await banning;
    await passing;
    expect(owner.runtime.get(id)!.name, 'the rename the pass folded stands').toBe('renamed by the other admin');
    expect(owner.runtime.get(id)!.banned.map(hex)).toContain(hex(target));
  });

});

describe('R12 avail-5 — a public room\'s pass reads its threads with no lock held', () => {
  const holding = (chain: ReturnType<typeof fakeChain>) => {
    let target: string | null = null;
    let gate: Promise<void> | null = null;
    let entered = () => {};
    const lane = {
      ...chain.lane,
      async readThreadByUid(uid: bigint, options: any) {
        if (gate && String(uid) === target) { entered(); await gate; }
        return chain.lane.readThreadByUid(uid, options);
      },
    };
    const hold = (uid: bigint) => {
      let open!: () => void;
      target = String(uid);
      gate = new Promise<void>((resolve) => { open = resolve; });
      const inside = new Promise<void>((resolve) => { entered = resolve; });
      return { entered: inside, release: () => { gate = null; open(); } };
    };
    return { lane, hold };
  };
  const waitedOn = (promise: Promise<any>, ms = 15_000) => Promise.race([
    promise.then(() => 'left'),
    new Promise((resolve) => setTimeout(() => resolve('waited for the pass'), ms)),
  ]);

  it('R12-AV5-P1: a message said while the pass reads leaves at once, and the pass says when its reads began', async () => {
    const chain = fakeChain();
    const held = holding(chain);
    const owner = runtimeFor(chain, 0x11, { lane: held.lane });
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    await owner.runtime.sync();
    const { entered, release } = held.hold(publicGroupChatUid(record.groupId, record.founder));
    const before = Date.now();
    const passing = owner.runtime.sync();
    await entered;
    expect(await waitedOn(owner.runtime.say(id, 'while it reads')), 'MEASURED before: the message waited for both threads\' reads').toBe('left');
    release();
    const [pass] = await passing;
    expect(pass.readFromMs).toBeGreaterThanOrEqual(before);
    expect(pass.readFromMs).toBeLessThanOrEqual(Date.now());
  }, 30_000);

  it('R12-AV5-P2: a reread asked while the pass reads is not written over — that pass hands nothing, the next reads the chat from the top', async () => {
    const chain = fakeChain();
    const held = holding(chain);
    const owner = runtimeFor(chain, 0x11, { lane: held.lane });
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    await owner.runtime.say(id, 'one');
    chain.tick();
    await owner.runtime.sync();
    expect(Object.keys(owner.runtime.get(id)!.read?.chat ?? {}).length, 'the chat was read').toBeGreaterThan(0);
    const { entered, release } = held.hold(publicGroupChatUid(record.groupId, record.founder));
    const passing = owner.runtime.sync();
    await entered;
    await owner.runtime.rereadChat(id);
    release();
    expect(await passing, 'the pass whose marks moved under its reads hands nothing').toEqual([]);
    expect(owner.runtime.get(id)!.read?.chat ?? {}, 'and does not write its marks over the reread').toEqual({});
    const [next] = await owner.runtime.sync();
    expect(next.messages.map((m: any) => m.text), 'the next pass reads the chat from the top').toContain('one');
  }, 30_000);

  it('R12-AV5-P3: a control write made while the pass reads is not taken back by that pass, however long its reads take', async () => {
    const chain = fakeChain();
    const held = holding(chain);
    const owner = runtimeFor(chain, 0x11, { lane: held.lane });
    const record = await owner.runtime.create({ name: 'first name' });
    const id = hex(record.groupId);
    await owner.runtime.sync();
    const { entered, release } = held.hold(publicGroupChatUid(record.groupId, record.founder));
    const passing = owner.runtime.sync();
    await entered;
    chain.tick();
    await owner.runtime.setName(id, 'second name');
    chain.tick(PUBLIC_GROUP_CONTROL_CONFIRM_S + 100);
    release();
    await passing;
    expect(owner.runtime.get(id)!.name, 'MEASURED with the fold\'s own clock: taken back to "first name"').toBe('second name');
    const [next] = await owner.runtime.sync();
    expect(next.record.name, 'and the next pass reads the row and confirms it').toBe('second name');
    expect(next.record.pending ?? []).toEqual([]);
  }, 30_000);
});
