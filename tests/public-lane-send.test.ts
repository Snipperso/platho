import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { toNano, beginCell as coreCell } from '@ton/core';
import { PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { buildPublicPublishWalletMessage } from '../web/public-lane-send.mjs';
import { publicPublishValueForKind } from '../web/publish-price.mjs';
import { computeCellHashAndDepth, parseBocBase64, snakeCellFromBytes } from '../web/pwa-contract-transactions.mjs';
import { publicBeaconPartitionKey, publicChannelPartitionKey, publicWalletHash, publicEpochTag, publicEraOf } from '../web/shard-discovery.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC-LANE-SEND — the deploy figures the client attaches, and the wallet-message shape it builds.
//   * PLS-PRICE pins each kind's deploy figure against the LIVE get_view, so a contract endowment change is a red
//     test (loud) rather than a publish refused in production (silent) — the exact failure publish-price warns of.
//   * PLS-MSG proves the wallet message carries the built message unchanged (address/value/StateInit and a payload
//     whose bytes reproduce the body cell), so nothing is mangled between the pinned builder and the wallet send.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_790_000_000;
// snakeCellFromBytes chunks into 127-byte cells, exactly as createPublicPostPayloadV2 builds real bodies — a naive
// one-cell helper would overflow the 1023-bit cell limit and produce an unparseable BoC.
const cellOf = (fill: number, len = 48) => snakeCellFromBytes(new Uint8Array(len).fill(fill), 'chunk');
const hashOf = async (c: any) => Buffer.from((await computeCellHashAndDepth(c)).hash);

describe('PUBLIC-LANE-SEND', () => {
  it('PLS-PRICE: publicPublishValueForKind matches the live deploy_min_value for every kind', async () => {
    const bc = await Blockchain.create();
    bc.now = CLOCK;
    const funder = await bc.treasury('pls-price');
    for (const kind of [0, 1, 2, 3]) {
      const era = publicEraOf(kind, CLOCK);
      const pk = kind === 2 ? await publicBeaconPartitionKey(1n) : BigInt(2000 + kind);
      const shard = bc.openContract(await PublicShard.fromInit(pk, publicEpochTag(kind, era)));
      await shard.send(funder.getSender(), { value: toNano('0.05') }, null);
      const view = await shard.getGetView();
      expect(publicPublishValueForKind(kind), `deploy figure for kind ${kind}`).toBe(view.deploy_min_value);
    }
  }, 120_000);

  it('PLS-MSG: the wallet message carries the built PublicPublish unchanged', async () => {
    const ownerHash = publicWalletHash('EQCpZjky6GPpte-242B_1Hw-Py1lcPcUZk63p6bvzsXQUHy-');
    const partitionKey = await publicChannelPartitionKey(ownerHash, 0);
    const epochTag = publicEpochTag(0, publicEraOf(0, CLOCK));
    const header = cellOf(0x11);
    const body = cellOf(0x12, 200);

    const prepared = await buildPublicPublishWalletMessage({
      kind: 0, keyArg: 0n, header, body, value: publicPublishValueForKind(0), partitionKey, epochTag,
    });

    expect(prepared.message.address, 'destination is the built shard address').toBe(prepared.to);
    expect(prepared.message.amount, 'value is the deploy figure').toBe(publicPublishValueForKind(0));
    expect(prepared.message.stateInit, 'StateInit attached for lazy deploy').toBe(prepared.init);
    expect(prepared.message.bounce, 'bounceable so a refused publish returns funds').toBe(true);

    // the payload base64 must reproduce the exact body cell the builder produced
    const payloadCell = parseBocBase64(prepared.message.payload);
    expect(await hashOf(payloadCell), 'payload BoC == the built message body').toEqual(await hashOf(prepared.body));
  }, 60_000);
});
