
export const CUTOVER_EPOCH = 20730;

export const WRITES_GENERATION = 18;

export function currentEpochUtc(nowMs = Date.now()) {
  return Math.floor(nowMs / 86400000);
}

export function generationForEpochAt(epoch, boundary) {
  if (!Number.isFinite(boundary) || boundary <= 0) return 17;
  return epoch < boundary ? 17 : 18;
}

export function generationForEpoch(epoch) {
  return generationForEpochAt(epoch, CUTOVER_EPOCH);
}

export function cutoverUpdateRequiredAt(nowMs, boundary, writesGeneration) {
  return generationForEpochAt(Math.floor(nowMs / 86400000), boundary) > writesGeneration;
}

export function cutoverUpdateRequired(nowMs = Date.now()) {
  return cutoverUpdateRequiredAt(nowMs, CUTOVER_EPOCH, WRITES_GENERATION);
}

export function generationsForEraAt(eraLengthSeconds, eraIndex, boundary) {
  if (!Number.isFinite(boundary) || boundary <= 0) return [17];
  const boundarySec = boundary * 86400;
  const startSec = eraIndex * eraLengthSeconds;
  const endSec = (eraIndex + 1) * eraLengthSeconds;
  if (endSec <= boundarySec) return [17];
  if (startSec >= boundarySec) return [18];
  return [17, 18];
}

export function generationsForEra(eraLengthSeconds, eraIndex) {
  return generationsForEraAt(eraLengthSeconds, eraIndex, CUTOVER_EPOCH);
}

export function generationForUnixSeconds(unixSeconds) {
  return generationForEpoch(Math.floor(unixSeconds / 86400));
}
