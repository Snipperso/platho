import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// PRIVATE SENDS MUST LEAVE ONE AFTER ANOTHER.
//
// OBSERVED 2026-08-03 on the owner's phone, build v813: "по одному сообщения улетают быстро, но если запостить
// пачку, то сразу виснут. Потом какой-то резервный путь минут через 5 их подхватывает и отправляет."
//
// The composer's submit handler is `async` and nothing serialised it, so N taps started N independent publishes at
// once. One publish costs several chain reads before it broadcasts (peer bundle from the KeyShard, the shard's
// cold-floor last_seq, the wallet balance, the wallet seqno), so a burst dumps dozens of requests into the shared
// pump in one go; requests age out, the transport answers transient, and every message falls into the retry ladder —
// which IS the "backup path" that gets them out later.
//
// The lane is tested by DRIVING THE SHIPPED FUNCTION, not a copy of it: the source is sliced out of web/app.js and
// evaluated. A re-implementation here would prove only that this file can write a promise chain.
const APP = readFileSync('web/app.js', 'utf8');

function loadSerialLaneFactory(): () => (task: () => Promise<unknown>) => Promise<unknown> {
  const start = APP.indexOf('function createSerialLane() {');
  expect(start, 'createSerialLane is gone from web/app.js').toBeGreaterThan(-1);
  const end = APP.indexOf('\n}', start) + 2;
  const source = APP.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function(`${source}; return createSerialLane;`)() as any;
}

describe('SENDLANE — private sends are serialised', () => {
  it('SENDLANE-01: tasks never overlap and finish in submission order', async () => {
    const enqueue = loadSerialLaneFactory()();
    let running = 0;
    let maxConcurrent = 0;
    const finished: number[] = [];
    const settle = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

    await Promise.all([30, 5, 20, 1, 10].map((ms, index) => enqueue(async () => {
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      await settle(ms);
      running -= 1;
      finished.push(index);
    })));

    expect(maxConcurrent, 'two publishes ran at once — this is the burst that wedged the RPC pump').toBe(1);
    // Order is submission order, NOT completion order: the deliberately-shortest task is last because it was queued
    // last. Without the lane the fastest would finish first and messages would land out of order.
    expect(finished).toEqual([0, 1, 2, 3, 4]);
  });

  it('SENDLANE-02: a FAILED send does not wedge the lane for the rest of the session', async () => {
    // Counter-case, and the reason the tail is detached from the outcome. A naive `tail = tail.then(task)` leaves a
    // rejected chain, and every later send would reject without ever running — a burst failure would kill sending
    // until reload, which is far worse than the pile-up this replaces.
    const enqueue = loadSerialLaneFactory()();
    await expect(enqueue(async () => { throw new Error('broadcast failed'); })).rejects.toThrow('broadcast failed');
    await expect(enqueue(async () => 'next one still runs')).resolves.toBe('next one still runs');
  });

  it('SENDLANE-03: the caller still sees its OWN failure — errors are not swallowed', async () => {
    // settlePrivateComposerSendError drives the retry ladder off this rejection. Swallowing it would leave the
    // message on "sending" forever with nothing scheduled to move it.
    const enqueue = loadSerialLaneFactory()();
    await expect(enqueue(async () => { throw new Error('429'); })).rejects.toThrow('429');
  });

  it('SENDLANE-04: EVERY outgoing message goes through the lane, including retries', async () => {
    // Private send + its retry. A retry storm is the same apocalypse arriving later: if retries bypassed the lane, a
    // burst that failed once would re-fire all of itself at once.
    expect(APP).toContain('await enqueueOutgoingPublish(() => attemptPrivateComposerMessagePublish(sendContext));');
    expect(APP).toContain('await enqueueOutgoingPublish(() => attemptPrivateComposerMessagePublish({ ...context }));');
    // Public post + comment: same wallet, same seqno, same RPC budget — overlapping them is the same pile-up.
    expect(APP).toContain('await enqueueOutgoingPublish(() => submitPublicCommentDirect(');
    expect(APP).toContain('await enqueueOutgoingPublish(() => submitPublicPostDirect(');
    // Nothing awaits a message publish outside the lane. Notes-to-self and first contact are reached THROUGH
    // attemptPrivateComposerMessagePublish (publishSelfNoteSnapshot / attemptIntroFirstContactDirect), so they ride
    // it too — this assertion is what keeps that true when someone adds a fifth surface.
    for (const entry of ['attemptPrivateComposerMessagePublish', 'submitPublicPostDirect', 'submitPublicCommentDirect']) {
      const bare = [...APP.matchAll(new RegExp(`await ${entry}\\(`, 'g'))];
      expect(bare, `${entry} is awaited outside the outgoing-publish queue`).toHaveLength(0);
    }
  });

  it('SENDLANE-06: there is ONE serial-lane implementation and every lane uses it', async () => {
    // [OWNER 2026-08-03] "Дубли, которые стали мёртвым кодом убирай, нам не нужен мусорный легаси код."
    // The same eight lines had been written by hand three times (avatar reads, username hygiene, then sends).
    expect((APP.match(/function createSerialLane\(\)/g) ?? []).length).toBe(1);
    expect(APP).toContain('const enqueueAvatarChainRead = createSerialLane();');
    // The outgoing lane keeps the shared primitive but is no longer a bare alias: enqueueOutgoingPublish wraps it
    // to attach a send phase profile to every queued task (see PWA-SENDPROFILE-01). The invariant this line guards —
    // ONE createSerialLane implementation behind every lane — is unchanged.
    expect(APP).toContain('const outgoingPublishLane = createSerialLane();');
    expect(APP).toContain('function enqueueOutgoingPublish(task) {');
    expect(APP).toContain('return outgoingPublishLane(async () => {');
    expect(APP).toContain('const enqueueUsernameHygiene = createSerialLane();');
    // The hand-rolled chains are gone, not merely unused.
    expect(APP, 'a hand-rolled promise chain came back').not.toContain('usernameHygieneChain');
    expect(APP, 'a hand-rolled promise chain came back').not.toContain('avatarChainReadLane');
    // Hygiene keeps its fire-and-forget contract: callers drop the promise, so the rejection is swallowed at THAT
    // boundary rather than inside the shared primitive, where it would hide real failures from every other lane.
    expect(APP).toContain('return enqueueUsernameHygiene(task).catch(() => {});');
  });

  it('SENDLANE-05: the queue holds only the BROADCAST — typing and confirmation never wait on it', async () => {
    // The composer is cleared and the optimistic bubble inserted BEFORE the lane is entered, so the next message can
    // be typed while the previous is still going out; and the delivery confirm is armed in the background rather
    // than awaited, so a send never waits for the previous message's confirmation.
    // Anchor on a LINE START: "composer?.addEventListener('submit'" is also a suffix of the PUBLIC handler's
    // "publicComposer?.addEventListener('submit'", so a plain indexOf lands on the wrong composer.
    const submit = APP.slice(
      APP.indexOf("\ncomposer?.addEventListener('submit'"),
      APP.indexOf('\ncreateWalletButton?.addEventListener'),
    );
    expect(submit).toContain('attemptPrivateComposerMessagePublish');
    expect(submit.indexOf("messageInput.value = ''")).toBeLessThan(submit.indexOf('enqueueOutgoingPublish'));
    expect(submit.indexOf('insertThreadMessage(thread, message)')).toBeLessThan(submit.indexOf('enqueueOutgoingPublish'));
    expect(APP).toContain('armConvDeliveryConfirm(thread, message);   // verify the optimistic green');
  });
});
