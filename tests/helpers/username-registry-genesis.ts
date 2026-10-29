import { beginCell, Cell, toNano } from '@ton/core';
import { readFileSync } from 'node:fs';


export const ART_KEYS: number[] = Object.keys(
  JSON.parse(readFileSync('artifacts/username_art_v2/art_payload.json', 'utf8')) as Record<string, string>,
).map(Number).sort((a, b) => a - b);

function placeholder(): Cell {
  return beginCell().endCell();
}

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
