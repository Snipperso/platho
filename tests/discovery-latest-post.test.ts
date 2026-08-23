import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// DISCOVER-LATEST — the channel's latest post on its Discover card.
//
// [OWNER 2026-08-21: "the description is not quite it — good to see the last post"; "yes, alongside".]
// Re-pinned 2026-08-23 to the redesign's implementation (the same contract, the designer's shape): the answer lives
// in a wallet-keyed map outside the card, the block is patched in place, the read is lazy and two abreast.
//
// What must hold, and why each half matters:
//   * the card carries a latest-post block, found by wallet, filled IN PLACE when the read lands — the list is
//     rebuilt by every streamed partial, so the answer must live outside the card;
//   * the read is LAZY: asked for only when the card reaches the screen (observer), two at a time, through the
//     lane's SMALL read (readLatestChannelPosts) — not readChannelPosts, not up front for every card;
//   * the block says it is loading, shows "Latest post" + the clock over the text, and is gone for a channel with no
//     visible post; the decode is the feed's own (profile divert, parts assembled);
//   * a closed panel forgets what it had not asked; a refresh / an open that starts a new sweep forgets the answers;
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
    // One states batch over the era/overflow coordinates, then ONLY the newest era with a LIVE (active) shard —
    // an 'unknown' row (the endpoint refused the address) or an uninit one is not readable.
    expect(fn).toMatch(/const live = await readLatestStates\(coords\.map\(\(c\) => c\.address\)\);/);
    expect(fn).toMatch(/const isLive = \(coord\) => \{ const state = live\.get\(addrKey\(coord\.address\)\); return Boolean\(state && state\.status === 'active'\); \};/);
    expect(fn).toMatch(/const newestLive = coords\.find\(isLive\);/);
    expect(fn).toMatch(/if \(coord\.era !== newestEra \|\| !isLive\(coord\)\) continue;/);
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
    // Reads the shared snapshot when it exists (a full answer is free), WRITES only its own — and never remembers a
    // tail whose rows came back without bodies as "no posts" (a genuinely empty shard is remembered).
    expect(fn).toMatch(/const full = readShardSnapshot\(key, marker\);/);
    expect(fn).toMatch(/if \(shardPosts\.length > 0 \|\| BigInt\(tail\.entry_count \?\? 0n\) === 0n\) writeLatestSnapshot\(key, marker, shardPosts\);/);
    expect(fn).not.toMatch(/writeShardSnapshot\(/);
    // Walk-back handle and the exhaustion flag a caller loops on — exhausted only when no LIVE shard is older.
    expect(fn).toMatch(/beforeEra = null/);
    expect(fn).toMatch(/const exhausted = !coords\.some\(\(coord\) => coord\.era < newestEra && isLive\(coord\)\);/);
    // The second cache is its own map, bounded on its own, and a null marker (an unmeasured shard) is never a key.
    expect(lane).toMatch(/const latestSnapshots = new Map\(\);/);
    expect(lane).toMatch(/while \(latestSnapshots\.size > LATEST_SNAPSHOT_MAX\)/);
    const readLatest = slice(lane, 'function readLatestSnapshot(key, marker) {', 'function writeLatestSnapshot(');
    expect(readLatest).toMatch(/if \(marker === null \|\| marker === undefined\) return null;/);
  });

  it('DLATEST-02: the card carries a latest block built from the kept answer, by wallet, and rebuilt in place', () => {
    const card = slice(app, 'function buildDiscoveryCard(channel)', 'function followContactPublicChannel(');
    // Built from the map (answer, loading, or nothing), keyed by the channel's wallet; the actions row follows it.
    expect(card).toMatch(/const latest = buildDiscoveryLatestNode\(rawWalletAddress\(channel\.authorWallet\)\);\s*if \(latest\) card\.append\(latest\);/);
    const latestAt = card.indexOf('buildDiscoveryLatestNode(');
    const actionsAt = card.indexOf("actions.className = 'discovery-card-actions';");
    expect(latestAt).toBeGreaterThan(-1);
    expect(actionsAt).toBeGreaterThan(latestAt);
    const builder = slice(app, 'function buildDiscoveryLatestNode(wallet)', 'function discoveryLatestPreview(item)');
    expect(builder).toMatch(/block\.className = 'discovery-card-latest';/);
    // Nothing at all for a channel with no visible post or a read that gave up; a ready answer carries the caption,
    // the clock and the preview; anything else is the loading shape (caption + shimmer).
    expect(builder).toMatch(/if \(state && \(state\.status === 'empty' \|\| state\.status === 'error'\)\) return null;/);
    expect(builder).toMatch(/label\.textContent = t\('public\.latestPost'\);/);
    expect(builder).toMatch(/const clock = formatMessageClock\(Number\(state\.createdAtMs\)\);/);
    expect(builder).toMatch(/text\.textContent = state\.preview;/);
    expect(builder).toMatch(/block\.dataset\.state = 'loading';\s*label\.textContent = t\('public\.latestPostLoading'\);/);
    // The answer lands IN PLACE on the one card (by data-wallet) — never a whole-list rebuild for one line.
    const apply = slice(app, 'function applyDiscoveryLatestToCard(wallet)', 'function ensureDiscoveryLatestObserver()');
    expect(apply).toMatch(/\.find\(\(node\) => node\.dataset\.wallet === wallet\);/);
    expect(apply).toMatch(/if \(previous && next\) previous\.replaceWith\(next\);/);
    // And every rebuild re-attaches the observer to the fresh nodes.
    const render = slice(app, 'function renderPublicDiscovery(options', 'function discoveryCardIdentityButton(');
    expect(render).toMatch(/observeDiscoveryLatestCards\(\);/);
  });

  it('DLATEST-03: the read is lazy (observer, a screen of margin), two abreast, through the small lane read and the feed decode', () => {
    const block = slice(app, '// ── Discover: the latest post of each card', 'function base64UrlToBytes(value)');
    expect(app).toMatch(/const PUBLIC_DISCOVERY_LATEST_CONCURRENCY = 2;/);
    expect(block).toMatch(/new IntersectionObserver\(/);
    expect(block).toMatch(/rootMargin: '100% 0px'/);
    expect(block).toMatch(/publicDiscoveryLatestObserver\.unobserve\(entry\.target\);\s*if \(wallet\) queueDiscoveryLatestPost\(wallet\);/);
    expect(block).toMatch(/while \(publicDiscoveryLatestInFlight\.size < PUBLIC_DISCOVERY_LATEST_CONCURRENCY && publicDiscoveryLatestQueue\.length > 0\)/);
    // The SMALL read, not the whole channel — and the feed's own decode.
    expect(block).toMatch(/await lane\.readLatestChannelPosts\(wallet, \{ beforeEra \}\)/);
    expect(block).not.toMatch(/readChannelPosts\(/);
    expect(block).toMatch(/publicPostPartsFromShardPosts\(posts, \{ id: `wallet:\$\{wallet\}`, authorWallet: wallet \}\)/);
    expect(block).toMatch(/assemblePublicParts\(parts\)/);
    // A profile-only tail walks one era back, boundedly.
    expect(app).toMatch(/const PUBLIC_DISCOVERY_LATEST_ERA_STEPS = 3;/);
    expect(block).toMatch(/if \(exhausted \|\| era === null\) break;\s*beforeEra = era;/);
    // An image-only post reads as the feed's image preview.
    expect(block).toMatch(/tPlural\('chat\.previewImages', 1\)/);
    // An answer is kept (ready / empty / error); a rate-limited read is re-queued a bounded number of times; an answer
    // from before a reset (generation bumped) is dropped on landing rather than stored.
    expect(block).toMatch(/const stillWanted = \(\) => generation === publicDiscoveryLatestGeneration;/);
    expect(block).toMatch(/if \(!stillWanted\(\)\) return;\s*\/\/ a reset happened underneath/);
    expect(block).toMatch(/if \(noteTonRpcRateLimit\(error\) && attempts <= PUBLIC_DISCOVERY_LATEST_RETRIES\)/);
    expect(block).toMatch(/settle\(\{ status: 'error', attempts \}\);/);
  });

  it('DLATEST-04: the panel lifecycle forgets the right things', () => {
    // Closing the panel drops the waiting queue and the observer; answers in hand stay for a reopen within the TTL.
    const close = slice(app, 'function closePublicDiscovery()', '// --- Channel view (v753)');
    expect(close).toMatch(/stopDiscoveryLatestPump\(\);/);
    const stop = slice(app, 'function stopDiscoveryLatestPump()', 'function resetPublicDiscoveryLatestPosts()');
    expect(stop).toMatch(/publicDiscoveryLatestQueue\.length = 0;/);
    expect(stop).toMatch(/if \(publicDiscoveryLatestObserver\) publicDiscoveryLatestObserver\.disconnect\(\);/);
    expect(stop).toMatch(/if \(state\.status === 'loading' && !publicDiscoveryLatestInFlight\.has\(wallet\)\) publicDiscoveryLatestPosts\.delete\(wallet\);/);
    // A refresh, and an open that will START a new sweep (no cache or an expired one, none in flight), forget the
    // answers and bump the generation so an in-flight answer is dropped on landing.
    const reset = slice(app, 'function resetPublicDiscoveryLatestPosts()', '// Debug hook');
    expect(reset).toMatch(/stopDiscoveryLatestPump\(\);\s*publicDiscoveryLatestPosts\.clear\(\);\s*publicDiscoveryLatestGeneration \+= 1;/);
    const refresh = slice(app, 'async function refreshPublicDiscovery()', 'function renderPublicDiscovery(options');
    expect(refresh).toMatch(/resetPublicDiscoveryLatestPosts\(\);/);
    const open = slice(app, 'async function openPublicDiscovery()', 'function closePublicDiscovery()');
    expect(open).toMatch(/if \(!publicDiscoverySweepInFlight\s*&& \(!publicDiscoveryCache \|\| \(Date\.now\(\) - publicDiscoveryCache\.at\) >= PUBLIC_DISCOVERY_CACHE_TTL_MS\)\) \{\s*resetPublicDiscoveryLatestPosts\(\);/);
    // The pump does nothing for a closed panel.
    const pump = slice(app, 'function pumpDiscoveryLatestPosts()', 'async function loadDiscoveryLatestPost(');
    expect(pump).toMatch(/if \(!publicDiscoveryOpen\) return;/);
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
    // ONE block of rules (the pre-redesign twin was removed 2026-08-23): a quote-like strip with an accent edge, a
    // dimmer edge while loading, the text clamped.
    expect(css.match(/\.discovery-card-latest \{/g)?.length, 'one rule block for the plate').toBe(1);
    expect(css).toMatch(/\.discovery-card-latest \{[\s\S]*?border-left: 2px solid var\(--a40\);/);
    expect(css).toMatch(/\.discovery-card-latest\[data-state="loading"\] \{[\s\S]*?border-left-color: var\(--a16\);/);
    expect(css).toMatch(/\.discovery-card-latest-text \{[\s\S]*?-webkit-line-clamp: 2;/);
    // The description yields the room: clamped, not removed ("alongside").
    expect(css).toMatch(/\.discovery-card-desc \{[\s\S]*?-webkit-line-clamp: 3;/);
  });
});
