import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// DISCOVER-LATEST — the channel's latest post on its Discover card.
//
// [OWNER 2026-08-21: "the description is not quite it — good to see the last post"; "yes, alongside".]
//
// What must hold, and why each half matters:
//   * the card carries a latest-post block, found by wallet, filled IN PLACE when the read lands — the list is
//     rebuilt by every streamed partial, so the answer must live outside the card;
//   * the read is LAZY: asked for only when the card reaches the screen (observer), two at a time, through the
//     lane's SMALL read (readLatestChannelPosts) — not readChannelPosts, not up front for every card;
//   * the block says it is loading, shows "Latest post · when" over the text, and is removed for a channel with no
//     visible post; the decode is the feed's own (profile divert, parts assembled);
//   * a closed panel forgets what it had not asked; a refresh / stale open forgets the answers too;
//   * the words exist in every locale; the CSS gives the block its plate and the clamp, and the description yields.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const lane = readFileSync('web/public-lane.mjs', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');

const slice = (text: string, from: string, to: string) => {
  const start = text.indexOf(from);
  expect(start, `anchor present: ${from}`).toBeGreaterThan(-1);
  const end = text.indexOf(to, start + from.length);
  expect(end, `anchor present: ${to}`).toBeGreaterThan(start);
  return text.slice(start, end);
};

describe('DISCOVER-LATEST — the latest post on a Discover card', () => {
  it('DLATEST-01: the lane has a SMALL latest-posts read — newest live era, tail window, own cache, never the shared one', () => {
    const fn = slice(lane, 'async readLatestChannelPosts(', 'async readPostAt(');
    // One states batch over the era/overflow coordinates, then ONLY the newest era with a live shard.
    expect(fn).toMatch(/const live = await readLatestStates\(coords\.map\(\(c\) => c\.address\)\);/);
    expect(fn).toMatch(/if \(live\.get\(addrKey\(coord\.address\)\)\) \{ newestEra = coord\.era; break; \}/);
    expect(fn).toMatch(/if \(coord\.era !== newestEra\) continue;/);
    // A small window by default, read through the provider's tail reader with that window.
    expect(fn).toMatch(/maxCount = PUBLIC_LATEST_POST_WINDOW/);
    expect(lane).toMatch(/const PUBLIC_LATEST_POST_WINDOW = 32n;/);
    expect(fn).toMatch(/await provider\.readPosts\(state\.address, \{\s*readMessagesWithSource: readLatestMessagesWithSource,\s*maxCount: BigInt\(maxCount\),\s*callOptions: \{ priority: LATEST_READ_OPTIONS\.priority \}/);
    // ITS OWN TRANSPORT SHAPE: ahead of the background sweep on the one pump, strict, never dropped into "no posts".
    expect(lane).toMatch(/const LATEST_READ_OPTIONS = Object\.freeze\(\{ priority: 'profile', skipIfRateLimited: false \}\);/);
    expect(lane).toMatch(/const latestStatesRequest = createShardStatesRequest\(\{ \.\.\.rpc, strict: true, requestOptions: LATEST_READ_OPTIONS \}\);/);
    expect(lane).toMatch(/const readLatestMessagesWithSource = createShardMessagesWithSourceReader\(\{ \.\.\.rpc, strict: true, opcode: PUBLIC_PUBLISH_OPCODE, requestOptions: LATEST_READ_OPTIONS \}\);/);
    // And the messages reader honours the knob (it used to build its pump options with no overrides at all).
    const rpc = readFileSync('web/shard-rpc.mjs', 'utf8');
    expect(rpc).toMatch(/export function createShardMessagesWithSourceReader\(\{[^}]*requestOptions = null \}/);
    expect(rpc).toMatch(/readMessageRows\(\{ base, key, doFetch, address, limit, opcode, maxPages, strict, endLt, startUtime, endUtime, requestOptions \}\)/);
    expect(rpc).toMatch(/scanRequestOptions\(requestOptions\)\);\s*if \(!response\) \{\s*\/\/ DECLINED BY THE PUMP/);
    // Reads the shared snapshot when it exists (a full answer is free), WRITES only its own.
    expect(fn).toMatch(/const full = readShardSnapshot\(key, marker\);/);
    expect(fn).toMatch(/writeLatestSnapshot\(key, marker, shardPosts\);/);
    expect(fn).not.toMatch(/writeShardSnapshot\(/);
    // Walk-back handle and the exhaustion flag a caller loops on.
    expect(fn).toMatch(/beforeEra = null/);
    expect(fn).toMatch(/exhausted: !coords\.some\(\(c\) => c\.era < newestEra\)/);
    // The second cache is its own map, bounded like the first.
    expect(lane).toMatch(/const latestSnapshots = new Map\(\);/);
    expect(lane).toMatch(/while \(latestSnapshots\.size > SHARD_SNAPSHOT_MAX\)/);
  });

  it('DLATEST-02: the card carries a latest block found by wallet, filled from the kept answer or queued for the observer', () => {
    const card = slice(app, 'function buildDiscoveryCard(channel)', 'function followContactPublicChannel(');
    expect(card).toMatch(/latest\.className = 'discovery-card-latest';/);
    expect(card).toMatch(/latest\.dataset\.wallet = channel\.authorWallet;/);
    // Answer in hand → painted at once; otherwise loading + observe (or queue where there is no observer).
    expect(card).toMatch(/const latestState = publicDiscoveryLatestPosts\.get\(channel\.authorWallet\) \?\? null;/);
    expect(card).toMatch(/fillDiscoveryLatestPost\(latest, \{ status: 'loading' \}\);\s*const observer = discoveryLatestObserver\(\);\s*if \(observer\) observer\.observe\(latest\);\s*else queueDiscoveryLatestPost\(channel\.authorWallet\);/);
    // The block sits between the head and the description: "alongside", the post first.
    const headAt = card.indexOf('card.append(head);');
    const latestAt = card.indexOf('card.append(latest);');
    const descAt = card.indexOf("desc.className = 'discovery-card-desc';");
    expect(headAt).toBeGreaterThan(-1);
    expect(latestAt).toBeGreaterThan(headAt);
    expect(descAt).toBeGreaterThan(latestAt);
  });

  it('DLATEST-03: the read is lazy (observer, a screen of margin), two abreast, through the small lane read and the feed decode', () => {
    const block = slice(app, '// ── Discover: the LATEST POST of a channel, on its card', 'function base64UrlToBytes(value)');
    expect(block).toMatch(/const PUBLIC_DISCOVERY_LATEST_CONCURRENCY = 2;/);
    expect(block).toMatch(/new IntersectionObserver\(/);
    expect(block).toMatch(/rootMargin: '100% 0px'/);
    expect(block).toMatch(/publicDiscoveryLatestObserver\?\.unobserve\(entry\.target\);\s*queueDiscoveryLatestPost\(entry\.target\.dataset\?\.wallet\);/);
    expect(block).toMatch(/while \(publicDiscoveryLatestActive < PUBLIC_DISCOVERY_LATEST_CONCURRENCY && publicDiscoveryLatestQueue\.length > 0\)/);
    // The SMALL read, not the whole channel — and the feed's own decode.
    expect(block).toMatch(/await lane\.readLatestChannelPosts\(wallet, beforeEra === null \? \{\} : \{ beforeEra \}\)/);
    expect(block).not.toMatch(/readChannelPosts\(/);
    expect(block).toMatch(/publicPostPartsFromShardPosts\(shardPosts, \{ id: `discover:\$\{wallet\}`, authorWallet: wallet \}\)/);
    expect(block).toMatch(/assemblePublicParts\(parts\)/);
    // A profile-only tail walks one era back, boundedly.
    expect(block).toMatch(/const PUBLIC_DISCOVERY_LATEST_ERA_HOPS = 3;/);
    expect(block).toMatch(/beforeEra = era;/);
    // An image-only post reads as the feed's image preview; a post with nothing visible is "none".
    expect(block).toMatch(/tPlural\('chat\.previewImages', 1\)/);
    // The answer lands IN PLACE, by wallet, on whatever cards are on screen now.
    expect(block).toMatch(/for \(const node of publicDiscoveryBody\.querySelectorAll\('\.discovery-card-latest'\)\) \{\s*if \(node\.dataset\?\.wallet === wallet\) fillDiscoveryLatestPost\(node, result\);/);
    // A read that failed is forgotten (the next sight asks again); an answer is kept.
    expect(block).toMatch(/if \(result\) publicDiscoveryLatestPosts\.set\(wallet, result\);\s*else publicDiscoveryLatestPosts\.delete\(wallet\);/);
  });

  it('DLATEST-04: the block paints loading / "Latest post · when" / nothing, and the panel lifecycle forgets the right things', () => {
    const fill = slice(app, 'function fillDiscoveryLatestPost(node, state)', 'function base64UrlToBytes(value)');
    expect(fill).toMatch(/if \(!state \|\| state\.status === 'none'\) \{ node\.remove\(\); return; \}/);
    expect(fill).toMatch(/node\.classList\.toggle\('is-loading', state\.status === 'loading'\);/);
    expect(fill).toMatch(/formatThreadListTimestamp\(Number\(state\.createdAtMs\)\)/);
    expect(fill).toMatch(/label\.textContent = when \? `\$\{t\('public\.latestPost'\)\} · \$\{when\}` : t\('public\.latestPost'\);/);
    expect(fill).toMatch(/text\.textContent = state\.status === 'ready' \? state\.text : t\('public\.latestPostLoading'\);/);
    // Closing the panel drops the observer; the pump drains an un-asked queue for a closed panel.
    const close = slice(app, 'function closePublicDiscovery()', '// --- Channel view (v753)');
    expect(close).toMatch(/publicDiscoveryLatestObserver\?\.disconnect\(\);\s*publicDiscoveryLatestObserver = null;/);
    const pump = slice(app, 'async function pumpDiscoveryLatestPosts()', 'async function loadDiscoveryLatestPost(');
    expect(pump).toMatch(/if \(!publicDiscoveryOpen\) \{[\s\S]*?publicDiscoveryLatestQueue\.splice\(0\)[\s\S]*?return;\s*\}/);
    // A refresh, and an open past the cache TTL, forget the answers too.
    const refresh = slice(app, 'async function refreshPublicDiscovery()', 'function renderPublicDiscovery(options');
    expect(refresh).toMatch(/resetDiscoveryLatestPosts\(\);/);
    const open = slice(app, 'async function openPublicDiscovery()', 'function closePublicDiscovery()');
    expect(open).toMatch(/if \(!publicDiscoveryCache \|\| \(Date\.now\(\) - publicDiscoveryCache\.at\) >= PUBLIC_DISCOVERY_CACHE_TTL_MS\) resetDiscoveryLatestPosts\(\);/);
    // The list rebuild drops detached observer targets.
    const render = slice(app, 'function renderPublicDiscovery(options', 'function discoveryCardIdentityButton(');
    expect(render).toMatch(/publicDiscoveryBody\.replaceChildren\(\);\s*\/\/[^\n]*\n\s*publicDiscoveryLatestObserver\?\.disconnect\(\);/);
  });

  it('DLATEST-05: the words exist in every locale and the CSS gives the block its plate and clamp', () => {
    for (const locale of I18N_LOCALES as any[]) {
      const code = typeof locale === 'string' ? locale : locale.code;
      const strings = (I18N_STRINGS as any)[code] ?? {};
      expect(String(strings['public.latestPost'] ?? '').trim(), `${code}: public.latestPost`).not.toBe('');
      expect(String(strings['public.latestPostLoading'] ?? '').trim(), `${code}: public.latestPostLoading`).not.toBe('');
    }
    expect((I18N_STRINGS as any).en['public.latestPost']).toBe('Latest post');
    expect((I18N_STRINGS as any).ru['public.latestPost']).toBe('Последний пост');
    expect(css).toMatch(/\.discovery-card-latest \{[\s\S]*?border-left: 2px solid rgba\(48, 213, 176, 0\.45\);/);
    expect(css).toMatch(/\.discovery-card-latest-text \{[\s\S]*?-webkit-line-clamp: 4;/);
    expect(css).toMatch(/\.discovery-card-latest\.is-loading \.discovery-card-latest-text \{[\s\S]*?color: var\(--muted\);/);
    // The description yields the room: clamped, not removed ("alongside").
    expect(css).toMatch(/\.discovery-card-desc \{[\s\S]*?-webkit-line-clamp: 3;/);
  });
});
