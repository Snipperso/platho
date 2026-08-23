// thread-list-order — the ONE rule for how the contact list is ordered, shared by the Private thread list and the
// share-to-contact sheet.
//
// OWNER 2026-08-21: "add a Pin button to the chevron menu, so a contact is kept at the top of the contact list; and
// pinned contacts must still change places among themselves by the freshness of the last message."
//
//   1. "My notes" (the self thread) first — it was pinned by design before any user pin existed;
//   2. then every PINNED dialog, newest activity first;
//   3. then everything else, newest activity first.
//
// A sorted COPY — the callers' arrays keep their structural invariants untouched — and a STABLE one, so dialogs with
// equal or unknown activity keep their relative order. The predicates and the clock are injected: the rule is about
// ORDER, and the app owns what "saved", "pinned" and "activity" mean.
//
//   isSaved(thread)        -> true for "My notes" (the own-wallet dialog);     app: isSavedMessagesThread
//   isPinned(thread)       -> true for a pinned contact (default: thread.pinned === true)
//   lastActivityMs(thread) -> recency stamp in ms (newest activity);          app: threadLastActivityMs
//
// `isSavedMessages` is the same predicate under its earlier name — both spellings are honoured so neither caller
// has to move.

/** Newest activity first; a missing/invalid stamp counts as 0 (sinks), like threadLastActivityMs' fallback. */
const activityOf = (thread, lastActivityMs) => {
  const ms = Number(lastActivityMs(thread));
  return Number.isFinite(ms) ? ms : 0;
};

/** The bucket a dialog belongs to: 'saved' | 'pinned' | 'other'. Saved wins over pinned (pinning Saved is a no-op). */
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
  const byRecency = (a, b) => activityOf(b, lastActivityMs) - activityOf(a, lastActivityMs);
  return [...saved, ...pinned.sort(byRecency), ...other.sort(byRecency)];
}
