import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import {
  createKeyShardTonRpcProvider,
  avatarRecordFromKeyShardView,
  deriveKeyShardRawAddress,
  KEYSHARD_PREDECESSOR_WRITTEN_BEFORE,
} from '../web/key-shard-ton-rpc-provider.mjs';
import { resolvePeerReplyBundle, RECIPIENT_NOT_ACTIVATED } from '../web/conv-reply-bundle.mjs';
import { encodeTonAddressSliceBoc, decodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';


const REGISTRY_18 = Address.parse(PLATHO_APP_CONFIG.profileRegistry.address).toRawString();
const PREDECESSOR = Address.parse(PLATHO_APP_CONFIG.profileRegistry.predecessorAddress).toRawString();
const OWNER = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH').toRawString();
const E = KEYSHARD_PREDECESSOR_WRITTEN_BEFORE;

const num = (value: bigint) => ({ type: 'num', value: value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}` });
const addr = (address: string) => ['slice', encodeTonAddressSliceBoc(address)];
const viewStack = ({ registered, createdAt, registry, signKey, avatarVersion = 0n }: {
  registered: boolean; createdAt: bigint; registry: string; signKey: bigint; avatarVersion?: bigint;
}) => [
  num(registered ? -1n : 0n), addr(OWNER), num(0x1111n), num(3n), num(4n), num(0x5555n), num(signKey), num(0x7777n),
  num(0x8888n), num(1184n), ['cell', 'te6ccgEBAQEAAgAAAA=='], num(2n), num(createdAt), num(12345n), num(57_000_000n),
  num(12_000_000n), addr(registry), num(avatarVersion), num(avatarVersion ? 0xabcn : 0n), num(avatarVersion ? 7n : 0n),
  num(avatarVersion ? 9n : 0n), num(avatarVersion ? 1n : 0n), num(avatarVersion ? 1n : 0n), num(avatarVersion ? 1_700_000_000n : 0n),
  num(20_000_000n),
];
const absent = () => Object.assign(new Error('TON RPC get-method exit code -13'), { exitCode: -13 });

async function scene(answers: { at18: 'absent' | 'error' | object; at17: 'absent' | object }, withPredecessor = true) {
  const a18 = await deriveKeyShardRawAddress(OWNER, REGISTRY_18, 18);
  const a17 = await deriveKeyShardRawAddress(OWNER, PREDECESSOR, 17);
  const reads: string[] = [];
  const provider = createKeyShardTonRpcProvider({
    profileRegistryAddress: REGISTRY_18,
    ...(withPredecessor ? { predecessorRegistryAddress: PREDECESSOR } : {}),
    decodeAddressSliceBoc: decodeTonAddressSliceBoc,
    transport: {
      async runGetMethod({ address }: { address: string }) {
        reads.push(address === a18 ? '18' : address === a17 ? '17' : `other:${address}`);
        const answer = address === a18 ? answers.at18 : address === a17 ? answers.at17 : 'absent';
        if (answer === 'absent') throw absent();
        if (answer === 'error') throw Object.assign(new Error('HTTP 429 Too Many Requests'), { status: 429 });
        return { stack: answer };
      },
    },
  });
  return { provider, reads, a18, a17 };
}

describe('KSFB — the 18 -> 17 identity fallback for stragglers', () => {
  it('KSFB-01: a REGISTERED clean-18 shard always wins — the old generation is not even read', async () => {
    const { provider, reads } = await scene({
      at18: viewStack({ registered: true, createdAt: 1_790_000_000n, registry: REGISTRY_18, signKey: 0x18n }),
      at17: viewStack({ registered: true, createdAt: 1_700_000_000n, registry: PREDECESSOR, signKey: 0x17n }),
    });
    const view = await provider.getView(OWNER);
    expect(view.sign_pubkey).toBe(0x18n);
    expect((view as any).fromPredecessor).toBeUndefined();
    expect(reads).toEqual(['18']);
  });

  it('KSFB-02: an ABSENT clean-18 shard falls back to the clean-17 one at (wallet, predecessor) — marked as such', async () => {
    const { provider, reads } = await scene({
      at18: 'absent',
      at17: viewStack({ registered: true, createdAt: 1_790_500_000n, registry: PREDECESSOR, signKey: 0x17n }),
    });
    const view = await provider.getView(OWNER);
    expect(view.sign_pubkey).toBe(0x17n);
    expect((view as any).fromPredecessor).toBe(true);
    expect((view as any).generation).toBe(17);
    expect(reads, 'the clean-17 shard is derived from the PREDECESSOR registry, at generation 17').toEqual(['18', '17']);
  });

  it('KSFB-03: an initialised but UNREGISTERED clean-18 shard (a squat, dust) falls back too', async () => {
    const { provider } = await scene({
      at18: viewStack({ registered: false, createdAt: 0n, registry: REGISTRY_18, signKey: 0n }),
      at17: viewStack({ registered: true, createdAt: 1_760_000_000n, registry: PREDECESSOR, signKey: 0x17n }),
    });
    const view = await provider.getView(OWNER);
    expect(view.sign_pubkey).toBe(0x17n);
    expect((view as any).fromPredecessor).toBe(true);
  });

  it('KSFB-04: the bound is E’s first second — a clean-17 bundle written at or after it is no identity here', async () => {
    const atE = await scene({ at18: 'absent', at17: viewStack({ registered: true, createdAt: E, registry: PREDECESSOR, signKey: 0x17n }) });
    await expect(atE.provider.getView(OWNER), 'written at E: refused, the clean-18 absence stands').rejects.toMatchObject({ exitCode: -13 });
    const justBefore = await scene({ at18: 'absent', at17: viewStack({ registered: true, createdAt: E - 1n, registry: PREDECESSOR, signKey: 0x17n }) });
    expect((await justBefore.provider.getView(OWNER)).sign_pubkey, 'one second before E: an identity').toBe(0x17n);
    const unregistered = await scene({
      at18: viewStack({ registered: false, createdAt: 0n, registry: REGISTRY_18, signKey: 0n }),
      at17: viewStack({ registered: true, createdAt: E + 10n, registry: PREDECESSOR, signKey: 0x17n }),
    });
    expect((await unregistered.provider.getView(OWNER)).exists).toBe(false);
  });

  it('KSFB-05: a provider WITHOUT the predecessor never falls back — the own-account reads stay on clean-18', async () => {
    const { provider, reads } = await scene({
      at18: 'absent',
      at17: viewStack({ registered: true, createdAt: 1_700_000_000n, registry: PREDECESSOR, signKey: 0x17n }),
    }, false);
    await expect(provider.getView(OWNER)).rejects.toMatchObject({ exitCode: -13 });
    expect(reads).toEqual(['18']);
  });

  it('KSFB-06: a TRANSPORT failure is never answered from the old generation', async () => {
    const { provider, reads } = await scene({
      at18: 'error',
      at17: viewStack({ registered: true, createdAt: 1_700_000_000n, registry: PREDECESSOR, signKey: 0x17n }),
    });
    await expect(provider.getView(OWNER)).rejects.toThrow(/429/);
    expect(reads).toEqual(['18']);
  });

  it('KSFB-07: a predecessor view SHOWS the old avatar but never OPENS a purchase (M-1: registered stays false)', async () => {
    const { provider } = await scene({
      at18: 'absent',
      at17: viewStack({ registered: true, createdAt: 1_700_000_000n, registry: PREDECESSOR, signKey: 0x17n, avatarVersion: 4n }),
    });
    const record = avatarRecordFromKeyShardView(await provider.getView(OWNER), OWNER);
    expect(record.exists, 'the clean-17 avatar is shown').toBe(true);
    expect(record.registered, 'but the clean-18 shard cannot take a pointer — the purchase is refused before signing').toBe(false);
  });

  it('KSFB-08: a reply to a peer with no shard in either generation says NOT ACTIVATED, not a raw -13', async () => {
    const { provider } = await scene({ at18: 'absent', at17: 'absent' });
    await expect(resolvePeerReplyBundle({ provider, peerWallet: OWNER, peerKeyId: 'kid-x' }))
      .rejects.toMatchObject({ code: RECIPIENT_NOT_ACTIVATED });
  });

  it('KSFB-09: exactly the PEER reads carry the predecessor — never the own activation read', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const calls = [...app.matchAll(/createKeyShardTonRpcProvider\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
    const withPredecessor = calls.filter((c) => c.includes('predecessorRegistryAddress: configuredProfileRegistryPredecessorAddress()'));
    expect(withPredecessor.length, 'avatar reads, the anonymous peer identity, first contact, its price, the reply bundle').toBe(5);
    for (const marker of ['stopOnUninitializedAccount: true }));', "priority: 'critical', cacheTtlMs: 0, stopOnUninitializedAccount: true }));"]) {
      const at = app.indexOf(marker);
      expect(at, `the own-account read ending ${marker} must still be there`).toBeGreaterThan(-1);
      const before = app.slice(Math.max(0, at - 700), at);
      const provider = before.slice(before.lastIndexOf('createKeyShardTonRpcProvider('));
      expect(provider, 'an own-account read must not fall back to clean-17').not.toContain('predecessorRegistryAddress');
    }
  });
});
