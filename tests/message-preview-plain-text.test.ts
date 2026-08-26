import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MSG_ALIGN_RE, MSG_HEADING_RE, MSG_OLIST_RE, MSG_QUOTE_RE, MSG_ULIST_RE,
  createInlineFormatRegex, messagePlainText, messagePreviewText,
} from '../web/message-plain-text.mjs';

// Composer formatting lives INSIDE the message text as markers ('# ', '> ', '**bold**') so the wire never changed
// and an old client degrades to literal markup. Every reader that renders a message parses them; every reader that
// SUMMARISES one did not, so the marker went straight to the screen:
//
//   OBSERVED 2026-08-08 (owner): a message sent as a heading rendered as a heading inside the conversation and as
//   the literal "# Каеф" in the conversation list beside it.
//
// The summarising readers are four (thread list, channel card, reply quote strip, and the matcher that compares a
// quote against message text), which is why the projection is a shared primitive rather than a strip at one site.

const app = readFileSync('web/app.js', 'utf8');
const publicChannels = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');

describe('message plain text', () => {
  it('PLAINTEXT-01: block markers come off, the words stay', () => {
    expect(messagePlainText('# Каеф')).toBe('Каеф');
    expect(messagePlainText('### Третий уровень')).toBe('Третий уровень');
    expect(messagePlainText('> цитата')).toBe('цитата');
    expect(messagePlainText('- пункт')).toBe('пункт');
    expect(messagePlainText('* пункт')).toBe('пункт');
    expect(messagePlainText('1. пункт')).toBe('пункт');
    expect(messagePlainText('::center по центру')).toBe('по центру');
  });

  it('PLAINTEXT-02: alignment is stripped BEFORE the line marker, not instead of it', () => {
    // '::center # Text' is a centred heading. Testing the heading first leaves '::center' glued to the front, which
    // is the one ordering mistake this projection can make and still look like it works on every other input.
    expect(messagePlainText('::center # Заголовок')).toBe('Заголовок');
    expect(messagePlainText('::justify > цитата')).toBe('цитата');
  });

  it('PLAINTEXT-03: inline markers come off, and a bare url survives whole', () => {
    expect(messagePlainText('**жирный**')).toBe('жирный');
    expect(messagePlainText('*курсив*')).toBe('курсив');
    expect(messagePlainText('***оба***')).toBe('оба');
    expect(messagePlainText('`код`')).toBe('код');
    expect(messagePlainText('[метка](https://example.com)')).toBe('метка');
    expect(messagePlainText('смотри https://example.com/x тут')).toBe('смотри https://example.com/x тут');
    expect(messagePlainText('# **Каеф** и `код`')).toBe('Каеф и код');
  });

  it('PLAINTEXT-04: text without formatting is returned unchanged', () => {
    expect(messagePlainText('обычное сообщение')).toBe('обычное сообщение');
    expect(messagePlainText('')).toBe('');
    expect(messagePlainText(null)).toBe('');
    expect(messagePlainText(undefined)).toBe('');
  });

  it('PLAINTEXT-05: line structure survives the projection; only the preview collapses it', () => {
    // The two callers differ: a list row wants one line, while replyQuoteTargetRow compares the projection against
    // real message text and would mismatch on a collapse the other side did not perform.
    expect(messagePlainText('# Заголовок\n- один\n- два')).toBe('Заголовок\nодин\nдва');
    expect(messagePreviewText('# Заголовок\n- один\n- два')).toBe('Заголовок один два');
  });

  it('PLAINTEXT-06: the inline regex is handed out as a FRESH instance per consumer', () => {
    // It is global, so it carries lastIndex, and the renderer drives it with exec() in a loop. One shared object
    // would let a strip running mid-loop move the cursor out from under the render.
    const a = createInlineFormatRegex();
    const b = createInlineFormatRegex();
    expect(a).not.toBe(b);
    expect(a.global).toBe(true);
    a.exec('**жирный**');
    expect(a.lastIndex).toBeGreaterThan(0);
    expect(b.lastIndex).toBe(0);
  });

  it('PLAINTEXT-07: the renderer and the stripper share ONE grammar', () => {
    // Two copies of the block regexes is how one reader keeps printing '# ' after the other was fixed. app.js must
    // import them rather than declare them.
    expect(app).toMatch(/import \{[\s\S]{0,240}MSG_HEADING_RE[\s\S]{0,240}\} from '\.\/message-plain-text\.mjs/);
    expect(app, 'app.js must not re-declare the grammar it imports').not.toMatch(/const MSG_HEADING_RE\s*=/);
    expect(app).not.toMatch(/const MSG_ALIGN_RE\s*=/);
    for (const re of [MSG_HEADING_RE, MSG_QUOTE_RE, MSG_ULIST_RE, MSG_OLIST_RE, MSG_ALIGN_RE]) {
      expect(re.global, 'block regexes must stay non-global — they are shared and would carry lastIndex').toBe(false);
    }
  });
});

describe('previews say words, not markup, and say them in the reader’s language', () => {
  it('PREVIEW-01: the private thread list projects the text', () => {
    expect(app).toMatch(/thread\.preview = last[\s\S]{0,200}messagePreviewText\(last\.text\)/);
    expect(app, 'the raw text must not go back into the row').not.toMatch(/thread\.preview = last[\s\S]{0,80}\|\| last\.text \|\|/);
  });

  it('PREVIEW-02: the block preview projects the text and translates the media words', () => {
    const start = app.indexOf('function messagePreviewFromBlocks(');
    const body = app.slice(start, start + 900);
    expect(body).toMatch(/if \(text\) return messagePreviewText\(text\);/);
    expect(body).toMatch(/tPlural\('chat\.previewImages', imageCount\)/);
    expect(body).toMatch(/tPlural\('chat\.previewFiles'/);
    expect(body).toMatch(/t\('chat\.previewSharedPost'\)/);
    expect(body, 'no English literals left in a user-visible preview').not.toMatch(/'(Image|Shared post|File)'/);
    expect(body).not.toMatch(/`\$\{[^}]+\} (images|files)`/);
  });

  it('PREVIEW-03: the reply snippet is projected and the quote matcher compares LIKE FOR LIKE', () => {
    // The snippet is built stripped and the row's message is not. Comparing the two forms directly makes every quote
    // of a formatted message fail to match, and the resolver falls back to position — the coin flip the snippet
    // check exists to replace. Both sides must go through the same projection.
    const start = app.indexOf('function replySnippetFromContent(');
    const body = app.slice(start, start + 700);
    expect(body).toMatch(/if \(text\) return messagePreviewText\(text\);/);
    expect(body).not.toMatch(/return '(Image|File|Shared post|Message)'/);
    expect(app).toMatch(/const wanted = messagePreviewText\(snippet\);/);
    expect(app).toMatch(/const text = messagePreviewText\(messageForRow\(row\)\?\.text\);/);
  });

  it('PREVIEW-04: the public channel card projects too — and keeps the article body RAW', () => {
    // feedBlocksPreview feeds the rendered article as well as the card. Stripping inside it would delete the
    // formatting from every public post that has any; the strip belongs at the preview call site alone.
    expect(publicChannels).toMatch(/function publicChannelPreviewLine\(latest\)/);
    expect(publicChannels).toMatch(/preview: publicChannelPreviewLine\(latest\),/);
    const start = publicChannels.indexOf('function feedBlocksPreview(');
    const body = publicChannels.slice(start, start + 500);
    expect(body, 'the first text block must reach the renderer with its markers intact')
      .toMatch(/if \(text\) return text;/);
    expect(body).not.toMatch(/messagePreviewText/);
    expect(publicChannels).not.toMatch(/'Waiting for public feed'|'Shared post'|'Image'/);
  });

  it('PREVIEW-05: every locale can answer, including the plural forms', async () => {
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs');
    const plain = [
      'chat.previewImage', 'chat.previewFile', 'chat.previewSharedPost', 'chat.previewMessage',
      'chat.previewNoMessages', 'chat.previewSavedNotes', 'public.previewWaitingFeed',
    ];
    for (const locale of Object.keys(I18N_STRINGS)) {
      for (const key of plain) {
        expect(I18N_STRINGS[locale][key], `${locale} is missing ${key}`).toBeTruthy();
      }
      // #other is the guaranteed fallback tPlural lands on for any category a locale does not define.
      expect(I18N_STRINGS[locale]['chat.previewImages#other'], `${locale} plural images`).toBeTruthy();
      expect(I18N_STRINGS[locale]['chat.previewFiles#other'], `${locale} plural files`).toBeTruthy();
    }
    expect(I18N_STRINGS.ru['chat.previewImages#many']).toContain('изображений');
  });

  it('PREVIEW-06: the key checker reads every module, not only app.js', () => {
    // public-channel-subscriptions.mjs now calls t(). A checker that scans app.js alone would report "чисто" while
    // a card on screen renders [public.previewWaitingFeed].
    const checker = readFileSync('scripts/check_i18n_keys.mjs', 'utf8');
    expect(checker).toMatch(/readdirSync\('web'\)/);
    expect(checker).toMatch(/name\.endsWith\('\.mjs'\)/);
    expect(checker, 'the scan must loop over the collected sources, not one file').toMatch(/for \(const path of sources\)/);
  });
});

describe('a reply can quote MY OWN message', () => {
  it('REPLYSELF-01: an outgoing CONV message is stamped with its publish seq', () => {
    // Nothing ever gave an outgoing message a chainEntryId — privateChainMessageOrderFields runs only on RECEIVED
    // entries — and every reply affordance is gated on the row carrying one. The receiving half was fully built.
    expect(app).toMatch(/message\.chainEntryId = String\(Math\.min\(\.\.\.parts\.map\(\(part\) => part\.seq\)\)\);/);
    // MIN, not max: a multipart message is anchored by its FIRST record on both sides (the receiver takes
    // orderedByChain[0]), so quoting it by the last part's seq would point the peer at the wrong record.
    expect(app).not.toMatch(/chainEntryId = String\(Math\.max/);
  });

  it('REPLYSELF-02: the affordances are gated on the anchor alone, never on direction', () => {
    const start = app.indexOf('function appendRowReplyButton(');
    const body = app.slice(start, start + 900);
    expect(body).toMatch(/if \(!row\?\.dataset\?\.entryId\) return;/);
    expect(body, 'a direction test here would re-break exactly what this fixes').not.toMatch(/type === 'in'/);
    // And the desktop button must appear when the anchor arrives AFTER the row was first rendered — a message is
    // sent, and its chain entry id lands seconds later. This used to need a hand-written patch that noticed the id
    // appearing on an existing node; the strip is reconciled now (KEYROW-*), so the id is part of the row's
    // SIGNATURE: gaining it rebuilds that one row, and the builder sets the anchor before it asks for the button.
    // (appendRowReplyButton refuses a row with no anchor — that is the gate above.)
    expect(app).toMatch(/function privateMessageRenderSignature\(message, showMeta = true, groupStart = false\) \{[\s\S]{0,400}?message\?\.chainEntryId \?\? '',/);
    const builder = app.slice(app.indexOf('const buildMessageRow = (message, showMeta, groupStart) => {'), app.indexOf('// THE STRIP AS A KEYED LIST'));
    expect(builder.length, 'the slice really spans the row builder').toBeGreaterThan(1000);
    // Direction still plays no part. The one exclusion is STATUS: a FAILED send's anchor points at records the
    // chain never accepted (or at a sibling device's record under the same seq), so it offers no reply — see
    // PWA-REPLYDEAD-01. A failed row that later proves delivered changes meta, and meta is in the row signature,
    // so the rebuild re-evaluates this gate.
    expect(builder).toMatch(/if \(message\.chainEntryId !== undefined && message\.chainEntryId !== null && messageStatusKey\(message\) !== 'failed'\) row\.dataset\.entryId = String\(message\.chainEntryId\);/);
    expect(builder.indexOf('row.dataset.entryId = String(message.chainEntryId)'), 'the anchor is set BEFORE the button is asked for')
      .toBeLessThan(builder.indexOf('appendRowReplyButton(row, beginPrivateReplyForRow)'));
    // Reply sits before Copy on every row, including the ones that gain it late.
    expect(body).toMatch(/cluster\.insertBefore\(button, copy\)/);
  });
});
