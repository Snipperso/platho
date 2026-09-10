// A prepared bundle is a SNAPSHOT of web/, and the deploy ships the snapshot — nothing in the deploy rebuilds it.
// [2026-09-08] Two source edits and a module-version bump went into web/ after the last prepare step, and the stand
// deploy shipped the earlier bundle without a word: the log said "deployed", the stand still showed the old build
// id. The only check on the prep was its mode. The prep records every bundled file with its hash, so a tree that
// has moved on is one comparison away from being caught — before a byte leaves the machine.
//
// Only the files the prep LISTS are compared. A file added to web/ after the prep is not this check's to find:
// whether it belongs in the bundle is the prepare step's selection, and the runtime gates that pin the bundle
// (sw-precache-covers-runtime, module-version-coverage) already refuse a tree with an unregistered module.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Paths from the prep's file list whose source under `webDir` no longer matches the hash the prep recorded.
 * A listed file that is gone is reported too — a bundle cannot ship what the tree has removed.
 */
export function stalePrepFiles(prep, webDir = 'web') {
  const stale = [];
  for (const file of prep?.runtime?.files ?? []) {
    const source = join(webDir, file.path);
    if (!existsSync(source)) {
      stale.push(`${file.path} (missing)`);
      continue;
    }
    const hash = createHash('sha256').update(readFileSync(source)).digest('hex');
    if (hash !== file.sha256) stale.push(file.path);
  }
  return stale;
}
