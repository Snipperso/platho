import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { CAPSULE_PUBLISH_OPCODE, CONV_READ_OPCODES, convReadOpcodesForGeneration } from '../web/conv-lane-read.mjs';
import { M21C_VAULT_PUBLISH_OPCODE } from '../web/m21c-envelope.mjs';
import { createShardMessagesWithSourceReader } from '../web/shard-rpc.mjs';
import { incomingRecordShards, outgoingRecordShards } from '../web/conv-discovery.mjs';
import { groupLaneBuckets, groupAvatarBucket, groupRosterBuckets } from '../web/group-lane-read.mjs';
import {
  recordShardAddressBytesFor, rawAddress,
  __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests,
} from '../web/shard-address.mjs';
import { beginCell } from '@ton/core';
import { addrKey } from '../web/shard-discovery.mjs';
import { generationForEpoch, generationForEpochAt } from '../web/cutover-epoch.mjs';
import { createGroupFounding, groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';


const CLOCK = 1_800_000_000;
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);

const strippedTact = (path: string) => readFileSync(path, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');

const receiversOf = (src: string) => [...src.matchAll(/^\s*receive\(\s*(?:msg:\s*)?(\w*)/gm)].map((m) => m[1]);
const publishDoorsOf = (src: string) => receiversOf(src).filter((name) => name.endsWith('Publish'));

function declaredOpcode(dir: string, name: string): bigint | null {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tact'))) {
    const match = strippedTact(`${dir}/${file}`).match(new RegExp(`message\\((0x[0-9A-Fa-f]+)\\)\\s+${name}\\b`));
    if (match) return BigInt(match[1]);
  }
  return null;
}

function countingFetch(rowsByOpcode: Record<string, unknown[]> = {}) {
  const calls: { opcode: string | null; offset: number }[] = [];
  const fetch = async (url: string) => {
    const asked = new URL(url);
    calls.push({ opcode: asked.searchParams.get('opcode'), offset: Number(asked.searchParams.get('offset') ?? 0) });
    return { ok: true, status: 200, json: async () => ({ messages: rowsByOpcode[String(asked.searchParams.get('opcode'))] ?? [] }) };
  };
  return { calls, fetch };
}

const readerWith = (fetchImpl: any) => createShardMessagesWithSourceReader({
  endpoint: 'https://toncenter.com/api/v3/messages', apiKey: 'k', fetch: fetchImpl,
  opcode: [CAPSULE_PUBLISH_OPCODE, M21C_VAULT_PUBLISH_OPCODE], limit: 128, maxPages: 8, strict: true,
});
const ADDRESS = `0:${'ab'.repeat(32)}`;
const hexOpcode = (value: bigint) => `0x${BigInt.asUintN(32, value).toString(16).padStart(8, '0')}`;

describe('CONV READ — one opcode per shard generation', () => {
  it('CRO-01: a RecordShard has ONE publish door per generation and they are different ones — the contracts say so, not this client', () => {
    expect(publishDoorsOf('    receive(msg: VaultPublish) {\n    receive(msg: CapsulePublish) {'),
      'two live doors are seen as two').toEqual(['VaultPublish', 'CapsulePublish']);
    expect(publishDoorsOf('    // receive(CapsulePublish) — the struct survives only as the layout'),
      'a commented-out receiver is not a door').toEqual([]);
    expect(publishDoorsOf('    /* receive(msg: CapsulePublish) { */'), 'nor is a block-commented one').toEqual([]);
    expect(publishDoorsOf('    receive(msg: RetireShard) {\n    receive() {}'),
      'and a door is a PUBLISH door, not every receiver').toEqual([]);

    const conv17 = strippedTact('contracts/RecordShard.tact');
    const conv18 = strippedTact('contracts18/contracts/RecordShard.tact');

    expect(publishDoorsOf(conv17), 'clean-17 RecordShard takes a publish through exactly one door').toEqual(['CapsulePublish']);
    expect(publishDoorsOf(conv18), 'clean-18 RecordShard takes a publish through exactly one door, and a different one')
      .toEqual(['VaultPublish']);

    expect(declaredOpcode('contracts', 'CapsulePublish'), 'the clean-17 door is the opcode this client asks for')
      .toBe(BigInt(CAPSULE_PUBLISH_OPCODE));
    expect(declaredOpcode('contracts18/contracts', 'VaultPublish'), 'and so is the clean-18 one')
      .toBe(BigInt(M21C_VAULT_PUBLISH_OPCODE));

    expect(publishDoorsOf(strippedTact('contracts18/contracts/PublicShard.tact')),
      'clean-18 PublicShard takes a publish through BOTH doors — the PUBLIC set must not be narrowed')
      .toEqual(['PublicPublish', 'VaultPublish']);
  });

  it('CRO-02: the reader asks a stamped shard one question, an unstamped one both, and never asks with no filter at all', async () => {
    const rows = { [hexOpcode(BigInt(CAPSULE_PUBLISH_OPCODE))]: [], [hexOpcode(BigInt(M21C_VAULT_PUBLISH_OPCODE))]: [] };

    const seventeen = countingFetch(rows);
    await readerWith(seventeen.fetch)(ADDRESS, { opcode: convReadOpcodesForGeneration(17) });
    expect(seventeen.calls.map((c) => c.opcode), 'a generation-17 shard is asked for CapsulePublish, once')
      .toEqual([hexOpcode(BigInt(CAPSULE_PUBLISH_OPCODE))]);

    const eighteen = countingFetch(rows);
    await readerWith(eighteen.fetch)(ADDRESS, { opcode: convReadOpcodesForGeneration(18) });
    expect(eighteen.calls.map((c) => c.opcode), 'a generation-18 shard is asked for VaultPublish, once')
      .toEqual([hexOpcode(BigInt(M21C_VAULT_PUBLISH_OPCODE))]);

    for (const unknown of [undefined, null, 0, 19, 'x']) {
      const both = countingFetch(rows);
      await readerWith(both.fetch)(ADDRESS, { opcode: convReadOpcodesForGeneration(unknown as any) });
      expect(both.calls.map((c) => c.opcode), `an unrecognised generation (${String(unknown)}) asks the whole set`)
        .toEqual(CONV_READ_OPCODES.map((one) => hexOpcode(BigInt(one))));
    }
    expect(convReadOpcodesForGeneration(undefined as any)).toEqual(CONV_READ_OPCODES);

    for (const empty of [null, []]) {
      const fallback = countingFetch(rows);
      await readerWith(fallback.fetch)(ADDRESS, { opcode: empty as any });
      expect(fallback.calls.every((c) => c.opcode !== null), `an override of ${JSON.stringify(empty)} still filters`).toBe(true);
      expect(fallback.calls.length, 'and falls back to the set the reader was built with').toBe(2);
    }
  });

  it('CRO-03: every bucket producer stamps the generation its own address was derived with', async () => {
    const agrees = async (bucket: any, label: string) => {
      expect(Number.isFinite(Number(bucket.laneGeneration)), `${label} carries a stamp`).toBe(true);
      const expected = rawAddress(await recordShardAddressBytesFor(
        Number(bucket.laneGeneration), BigInt(`0x${Buffer.from(bucket.writePublicKey).toString('hex')}`), Number(bucket.epoch)));
      expect(addrKey(bucket.address), `${label}: the stamp names the generation that chose this address`)
        .toBe(addrKey(expected));
    };

    const conv = { kRoot: bytes(0x07), selfKeyId: bytes(0x01), peerKeyId: bytes(0x02), epochNow: 20_600, windowW: 2 };
    for (const [label, derive] of [['incoming', incomingRecordShards], ['outgoing', outgoingRecordShards]] as const) {
      for (const bucket of await derive(conv as any)) {
        expect(bucket.laneGeneration, `${label} stamps what generationForEpoch says for its epoch`)
          .toBe(generationForEpoch(Number(bucket.epoch)));
        await agrees(bucket, `conv ${label} epoch ${bucket.epoch}`);
      }
    }

    __setLaneGenerationCodeForTests('record', 18, beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64'));
    try {
    const founding = await createGroupFounding({ entropy: bytes(0x11), createdAtSec: CLOCK });
    const seed = await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: founding.groupId });
    const member = groupMemberPublicKey(seed);
    const epoch = Number(founding.epoch);
    for (const [label, boundary] of [['before the flip', epoch + 10], ['after the flip', epoch]] as const) {
      const want = generationForEpochAt(epoch, boundary);
      const lanes = await groupLaneBuckets({ state: { ...founding, epoch }, memberPublicKeys: [member], boundary });
      expect(lanes.length, 'the fixture derives a lane').toBeGreaterThan(0);
      for (const bucket of lanes) {
        expect(bucket.laneGeneration, `group lane ${label}: the stamp follows the INJECTED boundary`).toBe(want);
        expect(bucket.generation, 'and is not the same field as the group key generation').toBe(founding.generation);
        await agrees(bucket, `group lane ${label}`);
      }
      const avatar = await groupAvatarBucket({ groupId: founding.groupId, epoch, boundary });
      expect(avatar.laneGeneration, `group avatar ${label}`).toBe(want);
      expect(avatar.generation, 'the avatar lane has no group generation of its own').toBe(0);
      await agrees(avatar, `group avatar ${label}`);

      const roster = await groupRosterBuckets({
        rosterKey: founding.rosterKey ?? founding.key, groupId: founding.groupId, generation: founding.generation,
        epochs: [epoch], adminPublicKeys: [member], boundary,
      });
      for (const bucket of roster) {
        expect(bucket.laneGeneration, `group roster ${label}`).toBe(want);
        await agrees(bucket, `group roster ${label}`);
      }
    }
    } finally { __resetLaneGenerationCodeOverridesForTests(); }
  });
});
