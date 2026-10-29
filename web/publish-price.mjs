import { generationForUnixSeconds } from './cutover-epoch.mjs?v=7';

export const CONV_MIN_VALUE = 15_600_000n;
export const CONV_PUBLISH_VALUE = 19_100_000n;

export const INTRO_MIN_VALUE = 15_310_000n;
export const INTRO_PUBLISH_VALUE = 17_810_000n;

export const RECOVERY_PUBLISH_VALUE = 38_400_000n;

export const KEYSHARD_REGISTER_VALUE = 60_000_000n;

export function publishValueFor(lane) {
  if (lane === 'conv') return CONV_PUBLISH_VALUE;
  if (lane === 'intro') return INTRO_PUBLISH_VALUE;
  if (lane === 'recovery') return RECOVERY_PUBLISH_VALUE;
  if (lane === 'keyshard-register') return KEYSHARD_REGISTER_VALUE;
  throw new Error(`publishValueFor: unknown lane "${lane}" (expected "conv", "intro", "recovery" or "keyshard-register")`);
}

export const PUBLIC_CHANNEL_PUBLISH_VALUE = 20_300_000n;
export const PUBLIC_THREAD_PUBLISH_VALUE = 20_300_000n;
export const PUBLIC_BEACON_PUBLISH_VALUE = 31_400_000n;
export const PUBLIC_AVATAR_PUBLISH_VALUE = 39_500_000n;

const PUBLIC_PUBLISH_VALUE_BY_GENERATION = Object.freeze({
  17: Object.freeze({ 0: PUBLIC_CHANNEL_PUBLISH_VALUE, 1: PUBLIC_THREAD_PUBLISH_VALUE, 2: PUBLIC_BEACON_PUBLISH_VALUE, 3: PUBLIC_AVATAR_PUBLISH_VALUE }),
  18: Object.freeze({ 0: 23_600_000n, 1: 23_600_000n, 2: 39_400_000n, 3: 53_600_000n }),
});

export function publicPublishValueForKind(kind, generation = generationForUnixSeconds(Math.floor(Date.now() / 1000))) {
  const table = PUBLIC_PUBLISH_VALUE_BY_GENERATION[Number(generation)];
  if (!table) throw new Error(`publicPublishValueForKind: no PublicShard deploy figures for generation ${generation}`);
  const value = table[Number(kind)];
  if (value === undefined) throw new Error(`publicPublishValueForKind: unknown PublicShard kind ${kind} (expected 0..3)`);
  return value;
}
