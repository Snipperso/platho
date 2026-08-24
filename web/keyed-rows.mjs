// Keyed row reconciliation — the one way every long list in this app updates itself.
// English-only (OPSEC); no user-facing text.
//
// WHY THIS EXISTS [OWNER 2026-08-23, relaying user reports: "big dialogs and opening posts with lots of comments
// load the system heavily … the phone gets hot"]. A list that wipes itself and rebuilds every row costs O(rows) per
// render, and the lists here re-render WHILE THEY GROW: a comment thread pages itself in as the reader scrolls,
// twice per page (once to show "loading", once when the page lands). Measured on a desktop with the real markup —
// 50 rows 9 ms, 500 rows 134 ms, 1000 rows 268 ms — so a 960-comment post rebuilt 2 x 96 x (1+2+...+10) = 10,560
// rows to display 960. Eleven times the work, quadratic in the thread's length, with every <img> re-created and so
// re-decoded. A phone is several times slower: seconds of unbroken main thread, which is what a hot phone is.
//
// The owner's own proposal was to keep only the newest ~50 rows on screen and slide that window. That would have
// muffled the symptom — each rebuild cheaper, the churn unchanged. Reconciling instead makes a render cost what
// actually CHANGED, so the window is not needed and history stays reachable.
//
// This lives in its own module rather than inside app.js because it now drives every list — comments, the private
// conversation, the feed, the thread list, discovery, the channel view — and a mistake here means messages that
// vanish, duplicate, or appear in the wrong order. Here it can be tested against those failures directly.

/**
 * Reconcile `container`'s children against `entries`, in order.
 *
 * `entries`: [{ key, sig, build, adopt? }] in final DOM order.
 *   key   — the row's identity. Must be stable for as long as the row means the same thing, and unique within
 *           this container (see the entry-id caveat below).
 *   sig   — what the row LOOKS like, as a string. Unchanged sig ⇒ the existing node is reused untouched (moved
 *           only if it is out of place). Changed sig ⇒ that one row is rebuilt. Everything the row bakes into
 *           its DOM belongs in here, including display settings like the locale and the timestamp mode.
 *   build — makes the node. Called only when there is nothing to reuse.
 *   adopt — optional, called on EVERY reused node for state that does not live in the DOM — a node → object
 *           binding that must follow the current object after a merge replaced it, or a whole row's content
 *           when the list refreshes by patching (below).
 *
 * REBUILD OR PATCH — the two ways a row can stay current, and when each is right. Rows differ in one thing: how
 * often their content changes.
 *   - REBUILD, via `sig`: the default, and right for rows whose content is FIXED once created — a message, a
 *     comment, a published post. Their signature moves a handful of times in the row's life (a send confirming,
 *     an avatar resolving), so almost every render touches nothing, and the row stays a pure function of its data
 *     with no patch code to keep in step. Forgetting to keep patch code in step is the real cost of the
 *     alternative: a field patched nowhere silently shows yesterday's value.
 *   - PATCH, via a constant `sig` plus `adopt`: right for rows where practically every field can change on any
 *     tick — the thread list, whose preview, time, unread count, name and avatar all move as messages arrive.
 *     A signature there would be a second description of the row that can silently disagree with the patcher,
 *     and it would buy little: rebuilding instead would re-create and re-decode an avatar image several times a
 *     minute. Refreshing unconditionally cannot go stale.
 * Both are the SAME primitive with different fields filled in, which is the point — the choice is declared per
 * list, in one place, rather than each list inventing its own update strategy.
 *
 * Contract: every child of `container` is a row this function owns. Anything unkeyed is removed as debris, which
 * is also how a duplicate left by an earlier render heals itself.
 *
 * CAVEAT ON KEYS: a chain entry id is unique within a channel, not across the chain. A container that can be
 * pointed at a different post/conversation must therefore be dropped, not reused, when its subject changes —
 * this function cannot see that, and would happily reuse a row whose key and signature both happen to match.
 *
 * Returns what this render actually did:
 *   built   — nodes constructed (a key with nothing to reuse, or a row whose signature changed)
 *   reused  — nodes kept as they were
 *   added   — keys that were not in the container before
 *   dropped — keys that were in the container and are gone now
 *   moved   — reused nodes that had to change position
 *   swept   — unkeyed nodes and duplicate keys removed as debris
 *
 * `added + dropped + moved` is the question "did the SHAPE of this list change", which is different from "did any
 * row change". The private conversation needs exactly that distinction: a status tick rebuilds one row in place and
 * must not touch the scroller, while an arriving message must.
 */
export function reconcileKeyedRows(container, entries) {
  const empty = { built: 0, reused: 0, added: 0, dropped: 0, moved: 0, swept: 0 };
  if (!container) return empty;
  const rows = Array.isArray(entries) ? entries : [];
  const existing = new Map();
  let swept = 0;
  for (const node of Array.from(container.children)) {
    const key = node.dataset ? node.dataset.rowKey : undefined;
    // Keep the FIRST node per key; drop unkeyed nodes and duplicates.
    if (key !== undefined && key !== '' && !existing.has(key)) existing.set(key, node);
    else { node.remove(); swept += 1; }
  }
  const before = new Set(existing.keys());
  const seen = new Set();
  let prev = null;
  let built = 0;
  let added = 0;
  let moved = 0;
  for (const entry of rows) {
    const key = String(entry?.key ?? '');
    // A repeated key would make two entries fight over one node: the first wins, the rest are ignored. Silently
    // dropping the duplicate is the safe half of the choice — the alternative is a row that flickers between two
    // objects on every render.
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    let node = existing.get(key);
    if (node && node.dataset.sig !== entry.sig) {
      // Stale: REMOVE before rebuilding. The sweep at the end only removes keys that are NOT in `seen`, and this
      // key is — so a lingering old node would survive as a duplicate.
      node.remove();
      existing.delete(key);
      node = null;
    }
    let reusedThisRow = true;
    if (!node) {
      reusedThisRow = false;
      node = entry.build();
      if (!node) { seen.delete(key); continue; }
      node.dataset.rowKey = key;
      node.dataset.sig = entry.sig;
      existing.set(key, node);
      built += 1;
      if (!before.has(key)) added += 1;
    } else if (entry.adopt) {
      entry.adopt(node);
    }
    const anchor = prev ? prev.nextSibling : container.firstChild;
    if (node !== anchor) {
      container.insertBefore(node, anchor);
      // MOVED counts only a node that was kept and had to change place. A rebuilt row is inserted where its old
      // node stood — calling that a move would make an in-place status tick look like a change of shape, which is
      // the one thing the private conversation reads this number to rule out.
      if (reusedThisRow) moved += 1;
    }
    prev = node;
  }
  let dropped = 0;
  for (const [key, node] of existing) {
    if (!seen.has(key)) { node.remove(); dropped += 1; }
  }
  return { built, reused: seen.size - built, added, dropped, moved, swept };
}
