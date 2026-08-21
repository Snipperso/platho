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
// equal or unknown activity keep their relative order. `isSavedMessages(thread)` and `lastActivityMs(thread)` are
// injected: the rule is about ORDER, and the app owns what "saved" and "activity" mean.
export function orderThreadsForList(threads, { isSavedMessages = () => false, lastActivityMs = () => 0 } = {}) {
  const list = Array.isArray(threads) ? threads : [];
  const byRecency = (a, b) => (Number(lastActivityMs(b)) || 0) - (Number(lastActivityMs(a)) || 0);
  const saved = list.filter((thread) => isSavedMessages(thread));
  const rest = list.filter((thread) => !isSavedMessages(thread));
  return [
    ...saved,
    ...rest.filter((thread) => thread?.pinned === true).sort(byRecency),
    ...rest.filter((thread) => thread?.pinned !== true).sort(byRecency),
  ];
}
