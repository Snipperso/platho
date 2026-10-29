
const activityOf = (thread, lastActivityMs) => {
  const ms = Number(lastActivityMs(thread));
  return Number.isFinite(ms) ? ms : 0;
};

export function threadListBucket(thread, { isSaved = () => false, isPinned = (t) => t?.pinned === true } = {}) {
  if (isSaved(thread)) return 'saved';
  if (isPinned(thread)) return 'pinned';
  return 'other';
}

export function orderThreadsForList(threads, {
  isSaved = null,
  isSavedMessages = null,
  isPinned = (thread) => thread?.pinned === true,
  lastActivityMs = () => 0,
} = {}) {
  const savedPredicate = typeof isSaved === 'function' ? isSaved : (typeof isSavedMessages === 'function' ? isSavedMessages : () => false);
  const saved = [];
  const pinned = [];
  const other = [];
  for (const thread of Array.isArray(threads) ? threads : []) {
    const bucket = threadListBucket(thread, { isSaved: savedPredicate, isPinned });
    (bucket === 'saved' ? saved : bucket === 'pinned' ? pinned : other).push(thread);
  }
  const stamps = new Map();
  const stampOf = (thread) => {
    if (!stamps.has(thread)) stamps.set(thread, activityOf(thread, lastActivityMs));
    return stamps.get(thread);
  };
  const byRecency = (a, b) => stampOf(b) - stampOf(a);
  return [...saved, ...pinned.sort(byRecency), ...other.sort(byRecency)];
}
