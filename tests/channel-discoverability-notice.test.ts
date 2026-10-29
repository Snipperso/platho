import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


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
    expect(discoverable({ description: '   ', tags: [] })).toBe(false);
    expect(discoverable({ description: '', tags: [] })).toBe(false);
    expect(discoverable({ tags: [null, ''] })).toBe(false);
    expect(discoverable(null)).toBe(false);
    expect(discoverable(undefined)).toBe(false);
  });

  it('CHDISC-02: the discovery filter and the notice ask the SAME question', () => {
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
    const postBranch = handler.slice(handler.indexOf('} else {'));
    expect(postBranch).toContain('void maybeWarnChannelNotDiscoverable();');
    expect(handler.slice(0, handler.indexOf('} else {'))).not.toContain('maybeWarnChannelNotDiscoverable');
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
    const postsLive = /"public\.channelNotListedPostsLive": "([^"]+)"/.exec(strings)?.[1] ?? '';
    expect(postsLive).toMatch(/on chain/i);
    expect(postsLive).not.toMatch(/hidden|nobody can (see|read)/i);
    const notice = app.slice(
      app.indexOf('async function maybeWarnChannelNotDiscoverable()'),
      app.indexOf('async function confirmPublicCommentsRisk()'),
    );
    expect(notice).toContain('await openEditChannelProfileDialog()');
  });

  it('CHDISC-05: the labelled dismiss is opt-in and never leaks into the next dialog', () => {
    expect(html).toContain('id="actionDismissButton"');
    expect(html).toMatch(/id="actionDismissButton"[^>]*\shidden/);
    const open = app.slice(app.indexOf('async function openActionDialog('), app.indexOf('\n}\n', app.indexOf('async function openActionDialog(')) + 3);
    expect(open).toContain('actionDismissButton.hidden = !config.cancelLabel;');
    const close = app.slice(app.indexOf('function closeActionDialog('), app.indexOf('\n}\n', app.indexOf('function closeActionDialog(')) + 3);
    expect(close).toContain('actionDismissButton.hidden = true;');
    expect(app).toMatch(/actionDismissButton\?\.addEventListener\('click', \(\) => \{[\s\S]{0,160}closeActionDialog\(null\);/);
  });
});
