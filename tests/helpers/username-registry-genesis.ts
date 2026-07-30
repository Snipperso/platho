import { beginCell, Cell, toNano } from '@ton/core';
import { readFileSync } from 'node:fs';

// SealGenesis now refuses unless the art and the collection metadata are already locked (19045 / 19046).
//
// That gate exists because the genesis seal does NOT revoke the genesis controller: requireGenesisController compares
// sender() to an init field nothing ever clears, so UploadArt (gated only on !art_sealed) and UploadCollectionMeta
// (gated only on !meta_sealed) stayed callable forever if the ceremony skipped SealArt / SealCollectionMeta — leaving
// a hot wallet permanent write authority over every .ath NFT's art in an otherwise immutable contract.
//
// Gating the SEAL rather than the UPLOADS is deliberate: forbidding uploads after the seal would instead have frozen
// an INCOMPLETE art set permanently whenever the ceremony sealed early. Demanding both locks up front rules out both.
//
// Every test that seals a UsernameRegistry genesis therefore has to satisfy the same precondition the ceremony does.
// This helper is that precondition, in one place.

/**
 * The art keys the registry demands, READ from the artefact the ceremony actually uploads rather than transcribed.
 * A hardcoded list here would be a second copy of a derived value, and would silently disagree with isValidArtKey the
 * first time the art set changed.
 */
export const ART_KEYS: number[] = Object.keys(
  JSON.parse(readFileSync('artifacts/username_art_v2/art_payload.json', 'utf8')) as Record<string, string>,
).map(Number).sort((a, b) => a - b);

/** Placeholder part. Content is irrelevant to the seal — username-art-dict.test.ts is what proves real rendering. */
function placeholder(): Cell {
  return beginCell().endCell();
}

/**
 * Bring a freshly deployed UsernameRegistry to the state SealGenesis requires: art_sealed and meta_sealed.
 *
 * IDEMPOTENT by construction, so a test that already uploaded its own real art or metadata can still call it: an
 * upload against a sealed dict is refused by the contract (19061 / 19071) and changes nothing, and re-sealing an
 * already sealed dict is a no-op. Sandbox `send` reports exit codes in its result rather than throwing, so those
 * refusals are absorbed here exactly as the contract intends.
 */
export async function sealArtAndCollectionMeta(registry: any, controller: any): Promise<void> {
  for (const key of ART_KEYS) {
    await registry.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'UploadArt', key: BigInt(key), data: placeholder(),
    });
  }
  await registry.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'SealArt' });

  for (const key of [1n, 2n, 3n]) {
    await registry.send(controller.getSender(), { value: toNano('0.05') }, {
      $$type: 'UploadCollectionMeta', key, data: placeholder(),
    });
  }
  await registry.send(controller.getSender(), { value: toNano('0.05') }, { $$type: 'SealCollectionMeta' });
}
