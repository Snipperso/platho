import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(NL))(...names.map((n) => env[n]));
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const world = (entry: any, { overlay = null }: { overlay?: any } = {}) => {
  const applied: string[] = [];
  const reads: string[] = [];
  let release: () => void = () => {};
  let hold = false;
  const cache: Record<string, any> = { W: entry };
  const env: Record<string, any> = {
    publicChannelProfileCache: cache, pendingChannelProfileOverlay: new Map(overlay ? [['W', overlay]] : []),
    channelProfileCacheKey: (w: string) => w, rawWalletAddress: (w: string) => w, canonicalUsernameDisplay: (v: string) => v,
    plathoUsernameIdentity: (label: string) => { const v = String(label ?? '').trim().toLowerCase().replace(/\.ath$/, ''); return /^[a-z0-9_]{4,32}$/.test(v) ? { value: v, label: v } : null; },
    applyVerifiedChannelUsername: (_key: string, name: string) => { applied.push(name); },
    nowSec: () => 10_000, CHANNEL_USERNAME_VERIFY_TTL_SEC: 21_600, criticalChainReadOptions: () => ({}),
    queueUsernameHygiene: (task: () => Promise<unknown>) => task(),
    verifiedPlathoUsernameIdentityForWallet: async (name: string) => { reads.push(name); if (hold) await new Promise<void>((resolve) => { release = resolve; }); return { value: name, label: name }; },
    verifiedPlathoUsernameOwnerCache: new Map(),
  };
  const verify = lift(env, [fn('function channelProfileDeclaresOtherName(key, value) {'), fn('function verifyChannelUsernameClaim(authorWallet, claimedName) {')], 'verifyChannelUsernameClaim');
  return { verify, applied, reads, cache, holdNext: () => { hold = true; }, release: () => release() };
};
const PROFILE = { ownerUsername: 'cash', entryId: '11', createdAtSec: 1_792_668_748, verifiedUsername: '', verifiedUsernameAt: 0 };

describe('the name a channel\'s profile declares is its name', () => {
  it('NAMEPROFILE-01: an old post\'s name, proven too, is not written over the profile\'s — nor even asked', async () => {
    const w = world({ ...PROFILE });
    w.verify('W', 'cash');
    await settle();
    expect(w.applied, 'the profile\'s own name is proven and written').toEqual(['cash']);
    w.verify('W', 'platho');
    await settle();
    expect(w.applied, 'MEASURED before: "platho" written five seconds later').toEqual(['cash']);
    expect(w.reads, 'and no read is spent proving it').toEqual(['cash']);
    w.verify('W', '');
    await settle();
    expect(w.applied).toEqual(['cash']);
  });

  it('NAMEPROFILE-02: a profile that changes while its name is proven drops the proof; one that takes its name off strips it', async () => {
    const w = world({ ...PROFILE });
    w.holdNext();
    w.verify('W', 'cash');
    await settle();
    w.cache.W = { ...PROFILE, ownerUsername: 'other', createdAtSec: PROFILE.createdAtSec + 60 };
    w.release();
    await settle();
    await settle();
    expect(w.applied, 'not written over the newer profile').toEqual([]);
    const bare = world({ ...PROFILE, ownerUsername: '', verifiedUsername: 'cash' });
    bare.verify('W', '');
    expect(bare.applied, 'the profile took its name off: the proof goes').toEqual(['']);
  });

  it('NAMEPROFILE-03: a channel with no profile of its own keeps its posts\' claims, as before; one\'s own just-published profile is proven at once', async () => {
    const seed = world({ ownerUsername: 'first', entryId: '', createdAtSec: 0, verifiedUsername: '' });
    seed.verify('W', 'second');
    await settle();
    expect(seed.applied, 'only posts to go by: the claim is proven and written').toEqual(['second']);
    const mine = world({ ...PROFILE, ownerUsername: 'platho', verifiedUsername: 'platho' }, { overlay: { ...PROFILE, entryId: '', createdAtSec: PROFILE.createdAtSec + 5 } });
    mine.verify('W', 'cash');
    await settle();
    expect(mine.applied, 'the overlay the owner just published declares "cash"').toEqual(['cash']);
  });

  it('NAMEPROFILE-04: a card open on the wallet takes the newly proven name — its title too, for a contact', () => {
    const apply = code(fn('function applyVerifiedChannelUsername(profileKey, verifiedUsername) {'));
    expect(apply).toContain("if ((prev.verifiedUsername ?? '') !== next) redressProfileCardAboutIfOpen(profileKey);");
    const redress = code(fn('function redressProfileCardAboutIfOpen(wallet) {'));
    expect(redress).toMatch(/if \(!sameWalletAddress\(raw, plathoWallet\?\.address \?\? ''\)\) \{\s*dressProfileCardTitle\(\{ thread: null, raw, own: false \}\);\s*redressProfileCardFaceIfOpen\(raw\);/);
  });
});
