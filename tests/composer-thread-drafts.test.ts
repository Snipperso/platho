import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMPOSER DRAFTS FOLLOW THEIR DIALOG — typed-but-unsent work must never ride into another chat.
//
// [OWNER 2026-08-26, relaying a user] "if you write something in the message box without sending and open
// another chat, the same message is sitting there — I do not think that should happen." The composer text,
// image/file attachments, the swipe-reply quote and the shared-post draft were ALL process-globals: whatever
// dialog was opened next inherited them, and one click would SEND them to the wrong contact.
//
// The real sync primitive is lifted from app.js and driven through the exact reported scenario.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const APP = readFileSync('web/app.js', 'utf8');

function loadDraftSync() {
  const start = APP.indexOf('const privateComposerDraftsByThread = new Map()');
  const end = APP.indexOf('let publicImageAttachments = [];');
  expect(start, 'draft store must exist').toBeGreaterThan(-1);
  expect(end, 'slice end anchor must exist').toBeGreaterThan(start);
  const source = APP.slice(start, end);
  expect(source.length, 'the slice no longer covers the sync primitive').toBeGreaterThan(900);
  const prelude = `
    let activeThreadId = null;
    let privateImageAttachments = [];
    let privateFileAttachments = [];
    let privateReplyDraft = null;
    let privateShareDraft = null;
    const setPrivateReplyDraft = (r) => { privateReplyDraft = r ?? null; };
    const setPrivateShareDraft = (r) => { privateShareDraft = r ?? null; };
    const messageInput = { _v: '', get value() { return this._v; }, set value(v) { this._v = String(v ?? ''); } };
  `;
  const epilogue = `
    return {
      sync: syncComposerDraftToActiveThread,
      open(id) { activeThreadId = id; syncComposerDraftToActiveThread(); },
      type(text) { messageInput.value = text; },
      attach(image) { privateImageAttachments = [...privateImageAttachments, image]; },
      reply(r) { setPrivateReplyDraft(r); },
      state() { return { text: messageInput.value, images: privateImageAttachments, reply: privateReplyDraft, share: privateShareDraft } },
      stashCount() { return privateComposerDraftsByThread.size; },
    };
  `;
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}\n${source}\n${epilogue}`)();
}

describe('CMPDRAFT — the composer belongs to one dialog at a time', () => {
  it('CMPDRAFT-01: the reported leak — text typed in chat A must NOT appear in chat B, and comes back in A', () => {
    const c = loadDraftSync();
    c.open('dm:a');
    c.type('for A only');
    c.open('dm:b');
    expect(c.state().text, 'chat B must open with an empty composer').toBe('');
    c.open('dm:a');
    expect(c.state().text, 'the unsent draft belongs to A and returns with it').toBe('for A only');
  });

  it('CMPDRAFT-02: attachments and the reply quote travel with their dialog, never across', () => {
    const c = loadDraftSync();
    const image = { name: 'cat.png' };
    const quote = { refEntryId: '7', author: 'other', snippet: 'hi' };
    c.open('dm:a');
    c.type('with baggage');
    c.attach(image);
    c.reply(quote);
    c.open('dm:b');
    expect(c.state().images).toEqual([]);
    expect(c.state().reply, 'a reply quote from A sent into B would anchor to a message B never saw').toBe(null);
    c.open('dm:a');
    expect(c.state().images[0]).toBe(image);
    expect(c.state().reply).toBe(quote);
  });

  it('CMPDRAFT-03: a sent (emptied) composer clears its stash — nothing resurrects on the way back', () => {
    const c = loadDraftSync();
    c.open('dm:a');
    c.type('will be sent');
    c.open('dm:b');
    expect(c.stashCount()).toBe(1);
    c.open('dm:a');
    c.type('');                       // the send path empties the composer in place
    c.open('dm:b');
    expect(c.stashCount(), 'an empty composer deletes its stash instead of storing it').toBe(0);
    c.open('dm:a');
    expect(c.state().text).toBe('');
  });

  it('CMPDRAFT-04: leaving to no-thread stashes; whitespace-only text counts as empty', () => {
    const c = loadDraftSync();
    c.open('dm:a');
    c.type('kept while browsing the list');
    c.open(null);                     // back to the thread list / another tab
    expect(c.state().text, 'the shared composer shows nothing outside a dialog').toBe('');
    c.open('dm:a');
    expect(c.state().text).toBe('kept while browsing the list');
    c.type('   ');
    c.open('dm:b');
    expect(c.stashCount(), 'whitespace is not a draft').toBe(0);
  });
});
