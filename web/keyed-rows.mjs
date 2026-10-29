
export function reconcileKeyedRows(container, entries) {
  const empty = { built: 0, reused: 0, added: 0, dropped: 0, moved: 0, swept: 0 };
  if (!container) return empty;
  const rows = Array.isArray(entries) ? entries : [];
  const existing = new Map();
  let swept = 0;
  for (const node of Array.from(container.children)) {
    const key = node.dataset ? node.dataset.rowKey : undefined;
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
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    let node = existing.get(key);
    if (node && node.dataset.sig !== entry.sig) {
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
