import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLISHING INTO A CHANNEL NOBODY CAN FIND.
//
// Owner, 2026-08-13: "Пользователь может писать публичные посты, но их не видно, пока он не напишет описание
// канала. Пользователь может публиковать сообщения и не понимать, почему его сообщения никто не видит."
//
// The mechanism, checked rather than assumed: discovery sweeps the beacon directory and SKIPS any channel whose
// profile card has neither a description nor tags — it only suggests channels that describe themselves. So an
// author can publish for weeks while their channel is absent from channel search, and nothing in the app says so.
//
// Two things this file holds down. First the WORDING has to stay honest: the posts are not hidden — they are on
// chain and open to anyone with a link — the CHANNEL is not listed. Second, the notice and the filter must ask
// the SAME question, or the app will one day promise a listing it does not deliver.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');

function loadPredicate() {
  const start = app.indexOf('function publicChannelIsDiscoverable(');
  const end = app.indexOf('\n}', start) + 2;
  expect(start).toBeGreaterThan(-1);
  // eslint-disable-next-line no-new-func
  return new Function(`${app.slice(start, end)}\nreturn publicChannelIsDiscoverable;`)();
}

describe('channel discoverability notice', () => {
  it('CHDISC-01: a description OR tags is enough; neither is not', () => {
    const discoverable = loadPredicate();
    expect(discoverable({ description: 'Irish lace patterns', tags: [] })).toBe(true);
    expect(discoverable({ description: '', tags: ['lace'] })).toBe(true);
    expect(discoverable({ description: '   ', tags: [] })).toBe(false);   // whitespace is not a description
    expect(discoverable({ description: '', tags: [] })).toBe(false);
    expect(discoverable({ tags: [null, ''] })).toBe(false);               // empty tags do not count
    // No profile read yet is NOT discoverable, and that is the truth rather than a guess: the sweep skips a wallet
    // whose beacon card is not a profile document at all.
    expect(discoverable(null)).toBe(false);
    expect(discoverable(undefined)).toBe(false);
  });

  it('CHDISC-02: the discovery filter and the notice ask the SAME question', () => {
    // The rule was written out by hand inside the sweep. If the notice grows its own copy, one of them will
    // eventually be relaxed and the app will promise a listing that never appears.
    // The sweep gained a streaming callback on 2026-08-20, so the per-card work moved into an `absorb` helper
    // inside it and the declaration no longer ends in `()`. Anchor on the function NAME — the rule this gate is
    // about did not move, only the shape around it.
    const sweep = app.slice(
      app.indexOf('async function discoverChannelsFromBeacon('),
      app.indexOf('async function discoverChannels(options'),
    );
    expect(sweep).toContain('if (!publicChannelIsDiscoverable(profileDoc.profileBlock)) continue;');
    expect(sweep).not.toMatch(/!description && tags\.length === 0/);
    const notice = app.slice(
      app.indexOf('async function maybeWarnChannelNotDiscoverable()'),
      app.indexOf('async function confirmPublicCommentsRisk()'),
    );
    expect(notice).toContain('publicChannelIsDiscoverable(cachedChannelProfile(wallet))');
  });

  it('CHDISC-03: it fires after a POST, never after a comment, and at most once per session', () => {
    const handlerStart = app.indexOf("publicComposer?.addEventListener('submit'");
    const handler = app.slice(handlerStart, app.indexOf("composer?.addEventListener('submit'", handlerStart));
    // Inside the else branch — the one that publishes a post. A comment lands in someone else's thread and says
    // nothing about whether THIS author's channel is listed.
    const postBranch = handler.slice(handler.indexOf('} else {'));
    expect(postBranch).toContain('void maybeWarnChannelNotDiscoverable();');
    expect(handler.slice(0, handler.indexOf('} else {'))).not.toContain('maybeWarnChannelNotDiscoverable');
    // A burst of posts must not become a burst of dialogs.
    const notice = app.slice(
      app.indexOf('async function maybeWarnChannelNotDiscoverable()'),
      app.indexOf('async function confirmPublicCommentsRisk()'),
    );
    expect(notice).toContain('if (channelDiscoverabilityNoticeShown) return;');
    expect(notice).toContain('channelDiscoverabilityNoticeShown = true;');
  });

  it('CHDISC-04: it says the posts are LIVE and the channel is unlisted — not that the posts are hidden', () => {
    const strings = readFileSync('web/i18n-strings.mjs', 'utf8');
    for (const key of ['channelNotListedTitle', 'channelNotListedHint', 'channelNotListedPostsLive',
      'channelNotListedSearchNeeds', 'channelNotListedWrite']) {
      expect(strings.match(new RegExp(`"public\\.${key}":`, 'g'))?.length, key).toBe(10);
    }
    // The English copy must not claim the post is invisible — it is on chain and linkable.
    const postsLive = /"public\.channelNotListedPostsLive": "([^"]+)"/.exec(strings)?.[1] ?? '';
    expect(postsLive).toMatch(/on chain/i);
    expect(postsLive).not.toMatch(/hidden|nobody can (see|read)/i);
    // And the second button opens the editor rather than just describing it.
    const notice = app.slice(
      app.indexOf('async function maybeWarnChannelNotDiscoverable()'),
      app.indexOf('async function confirmPublicCommentsRisk()'),
    );
    expect(notice).toContain('await openEditChannelProfileDialog()');
  });

  it('CHDISC-05: the labelled dismiss is opt-in and never leaks into the next dialog', () => {
    // Two named buttons here (the owner asked for "ОК" plus one that opens the editor), but every OTHER dialog
    // keeps its ✕-only shape — so the button is hidden unless a caller names it, and re-hidden on close.
    expect(html).toContain('id="actionDismissButton"');
    expect(html).toMatch(/id="actionDismissButton"[^>]*\shidden/);
    const open = app.slice(app.indexOf('async function openActionDialog('), app.indexOf('async function openActionDialog(') + 3000);
    expect(open).toContain('actionDismissButton.hidden = !config.cancelLabel;');
    const close = app.slice(app.indexOf('function closeActionDialog('), app.indexOf('function closeActionDialog(') + 1200);
    expect(close).toContain('actionDismissButton.hidden = true;');
    // It resolves the same way the ✕ does: one meaning for "no".
    expect(app).toMatch(/actionDismissButton\?\.addEventListener\('click', \(\) => \{[\s\S]{0,160}closeActionDialog\(null\);/);
  });
});
