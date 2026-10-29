import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { declineGroupCandidate, groupCandidatesWaiting } from '../web/group-store.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => sourceBlock(app, declaration);
const key = (fill: number) => new Uint8Array(32).fill(fill);
const hexOf = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

class FakeElement {
  tag: string; className = ''; textContent = ''; type = ''; disabled = false; removed = false;
  children: FakeElement[] = [];
  listeners: Record<string, () => void> = {};
  constructor(tag: string) { this.tag = tag; }
  append(...kids: FakeElement[]) { this.children.push(...kids); }
  addEventListener(name: string, handler: () => void) { this.listeners[name] = handler; }
  remove() { this.removed = true; }
  all(): FakeElement[] { return [this, ...this.children.flatMap((child) => child.all())]; }
}

function joinCard({ record, mine = false, admin = true }: { record: any; mine?: boolean; admin?: boolean }) {
  const declines: any[] = [];
  const admits: any[] = [];
  const env: Record<string, any> = {
    document: { createElement: (tag: string) => new FakeElement(tag) },
    groupRuntimeInstance: { get: () => record },
    t: (k: string) => `<${k}>`,
    groupSelfIsAdmin: () => admin,
    groupJoinBoundToThread: (join: any) => join,
    activeThread: () => ({}),
    admitGroupCandidate: (...args: any[]) => { admits.push(args); },
    declineGroupCandidateRequest: async (...args: any[]) => { declines.push(args); return true; },
    showAppNotice: () => {},
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const build = new Function(...names, `${fn('function buildGroupJoinCard(')}\nreturn buildGroupJoinCard;`)(...names.map((n) => env[n]));
  const join = { groupId: 'room-1', groupKey: key(0x31) };
  const card: FakeElement = build(join, mine);
  const buttons = card.all().filter((el) => el.tag === 'button');
  const note = card.all().find((el) => el.className === 'group-invite-note')?.textContent ?? null;
  return { card, buttons, note, declines, admits, join };
}

const asker = { groupKey: key(0x31), wallet: '0:31', name: 'asker', at: 1, paid: null };
const room = (candidates: any[], members: any[] = []) => ({ name: 'the door', members, candidates });

describe('the join request card in a private conversation', () => {
  it('GD-01: a waiting request offers Admit and Decline; Decline marks the request the queue holds, by its key', () => {
    const { buttons, note, declines } = joinCard({ record: room([asker]) });
    expect(note).toBe('<group.candidateWaiting>');
    expect(buttons.map((b) => b.textContent)).toEqual(['<group.admit>', '<group.decline>']);
    buttons[1].listeners.click();
    expect(declines).toHaveLength(1);
    expect(declines[0][0]).toBe('room-1');
    expect(hexOf(declines[0][1])).toBe(hexOf(asker.groupKey));
  });

  it('GD-02: a declined request says so and keeps Admit alone — a change of mind is one press', () => {
    const declined = declineGroupCandidate(room([asker]), asker.groupKey);
    const { buttons, note } = joinCard({ record: declined });
    expect(note).toBe('<group.candidateDeclined>');
    expect(buttons.map((b) => b.textContent)).toEqual(['<group.admit>']);
  });

  it('GD-03: a token the queue does not hold yet has nothing to decline; a member, a non-admin and the sender see no buttons', () => {
    expect(joinCard({ record: room([]) }).buttons.map((b) => b.textContent)).toEqual(['<group.admit>']);
    const seated = joinCard({ record: room([], [{ groupKey: key(0x31) }]) });
    expect(seated.note).toBe('<group.joinAdmitted>');
    expect(seated.buttons).toHaveLength(0);
    expect(joinCard({ record: room([asker]), admin: false }).buttons).toHaveLength(0);
    expect(joinCard({ record: room([asker]), mine: true }).buttons).toHaveLength(0);
  });
});

describe('the members card', () => {
  it('GD-04: lists only the requests still waiting, and gives an admin Decline beside Admit — the row leaves on success', () => {
    const dialog = code(fn('async function openGroupMembersDialog('));
    expect(dialog).toContain('for (const candidate of groupCandidatesWaiting(record)) {');
    expect(dialog).not.toContain('for (const candidate of record.candidates ?? []) {');
    expect(dialog).toContain("decline.textContent = t('group.decline');");
    expect(dialog).toContain('if (await declineGroupCandidateRequest(groupId, candidate.groupKey, decline)) { row.remove(); next?.focus?.(); return; }');
    expect(dialog).toContain("actionHint.textContent = t('group.declineFailed');");
    expect(dialog).toContain('buttons.append(admit, decline);');
    expect(dialog).toContain("decline.className = 'mini-action-button is-quiet';");
    expect(groupCandidatesWaiting(declineGroupCandidate(room([asker]), asker.groupKey))).toEqual([]);
  });

  it('GD-05: the press signs nothing and asks nothing — the runtime marks the row, the screens repaint, a failure gives the button back', () => {
    const press = code(fn('async function declineGroupCandidateRequest('));
    expect(press).toContain('const after = await runtime.declineCandidate(groupId, groupKey);');
    expect(press).not.toContain('openActionDialog');
    expect(press).not.toContain('sendPlathoWalletTransaction');
    expect(press).toContain('if (button) button.disabled = false;');
    const runtime = readFileSync('web/group-runtime.mjs', 'utf8');
    const lockedList = runtime.slice(runtime.indexOf("for (const name of ['say', 'leave'"), runtime.indexOf(']) {', runtime.indexOf("for (const name of ['say', 'leave'")));
    expect(lockedList).toContain("'declineCandidate'");
    expect(lockedList).toContain("'noteCandidate'");
  });
});
