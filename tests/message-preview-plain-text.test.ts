import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MSG_ALIGN_RE, MSG_HEADING_RE, MSG_OLIST_RE, MSG_QUOTE_RE, MSG_ULIST_RE,
  createInlineFormatRegex, messagePlainText, messagePreviewText,
} from '../web/message-plain-text.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const between = (text: string, start: string, end: string) => {
  const a = text.indexOf(start);
  expect(a, `anchor present: ${start}`).toBeGreaterThan(-1);
  const b = text.indexOf(end, a + start.length);
  expect(b, `end anchor after ${start}: ${end}`).toBeGreaterThan(a);
  return text.slice(a, b);
};
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
    expect(messagePlainText('# Заголовок\n- один\n- два')).toBe('Заголовок\nодин\nдва');
    expect(messagePreviewText('# Заголовок\n- один\n- два')).toBe('Заголовок один два');
  });

  it('PLAINTEXT-06: the inline regex is handed out as a FRESH instance per consumer', () => {
    const a = createInlineFormatRegex();
    const b = createInlineFormatRegex();
    expect(a).not.toBe(b);
    expect(a.global).toBe(true);
    a.exec('**жирный**');
    expect(a.lastIndex).toBeGreaterThan(0);
    expect(b.lastIndex).toBe(0);
  });

  it('PLAINTEXT-07: the renderer and the stripper share ONE grammar', () => {
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
    expect(app).toContain("thread.preview = last ? messagePreviewLine(last) : t('chat.previewNoMessages');");
    const lineAt = app.indexOf('function messagePreviewLine(');
    expect(lineAt).toBeGreaterThan(-1);
    const line = app.slice(lineAt, app.indexOf('\n}\n', lineAt));
    expect(line).toMatch(/messagePreviewText\(String\(message\.text \?\? ''\)\.slice\(0, 4096\)\)/);
    expect(line, 'the raw text must not go back into the row').not.toMatch(/\|\| message\.text \|\|/);
    expect(app, 'nor into the row directly').not.toMatch(/thread\.preview = last[\s\S]{0,80}\|\| last\.text \|\|/);
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
    const start = app.indexOf('function replySnippetFromContent(');
    const body = app.slice(start, start + 700);
    expect(body).toMatch(/if \(text\) return messagePreviewText\(text\);/);
    expect(body).not.toMatch(/return '(Image|File|Shared post|Message)'/);
    expect(app).toMatch(/const wanted = messagePreviewText\(snippet\);/);
    expect(app).toMatch(/const text = messagePreviewText\(messageForRow\(row\)\?\.text\);/);
  });

  it('PREVIEW-04: the public channel card projects too — and keeps the article body RAW', () => {
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
      expect(I18N_STRINGS[locale]['chat.previewImages#other'], `${locale} plural images`).toBeTruthy();
      expect(I18N_STRINGS[locale]['chat.previewFiles#other'], `${locale} plural files`).toBeTruthy();
    }
    expect(I18N_STRINGS.ru['chat.previewImages#many']).toContain('изображений');
  });

  it('PREVIEW-06: the key checker reads every module, not only app.js', () => {
    const checker = readFileSync('scripts/check_i18n_keys.mjs', 'utf8');
    expect(checker).toMatch(/readdirSync\('web'\)/);
    expect(checker).toMatch(/name\.endsWith\('\.mjs'\)/);
    expect(checker, 'the scan must loop over the collected sources, not one file').toMatch(/for \(const path of sources\)/);
  });
});

describe('a reply can quote MY OWN message', () => {
  it('REPLYSELF-01: an outgoing CONV message is stamped with its publish seq', () => {
    expect(app).toMatch(/message\.chainEntryId = String\(Math\.min\(\.\.\.parts\.map\(\(part\) => part\.seq\)\)\);/);
    expect(app).not.toMatch(/chainEntryId = String\(Math\.max/);
  });

  it('REPLYSELF-02: the affordances are gated on the anchor alone, never on direction', () => {
    const start = app.indexOf('function appendRowReplyButton(');
    const body = app.slice(start, start + 900);
    expect(body).toMatch(/if \(!row\?\.dataset\?\.entryId\) return;/);
    expect(body, 'a direction test here would re-break exactly what this fixes').not.toMatch(/type === 'in'/);
    expect(app).toMatch(/function privateMessageRenderSignature\(message, showMeta = true, groupStart = false\) \{[\s\S]{0,400}?message\?\.chainEntryId \?\? '',/);
    const builder = app.slice(app.indexOf('const buildMessageRow = (message, showMeta, groupStart) => {'), app.indexOf('// THE STRIP AS A KEYED LIST'));
    expect(builder.length, 'the slice really spans the row builder').toBeGreaterThan(1000);
    expect(builder).toMatch(/if \(message\.chainEntryId !== undefined && message\.chainEntryId !== null && messageStatusKey\(message\) !== 'failed'\) row\.dataset\.entryId = String\(message\.chainEntryId\);/);
    expect(builder.indexOf('row.dataset.entryId = String(message.chainEntryId)'), 'the anchor is set BEFORE the button is asked for')
      .toBeLessThan(builder.indexOf('appendRowReplyButton(row, beginPrivateReplyForRow)'));
    expect(body).toMatch(/cluster\.insertBefore\(button, copy\)/);
  });


  const mentionsIn = (text: string) => {
    const re = createInlineFormatRegex();
    const found: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[8] !== undefined) found.push(match[8]);
      if (re.lastIndex <= match.index) re.lastIndex = match.index + match[0].length;
    }
    return found;
  };

  it('MENTION-01: the pattern lights up exactly what the registry would accept as a name', () => {
    expect(mentionsIn('hi @autumnleaf there')).toEqual(['@autumnleaf']);
    expect(mentionsIn('@autumn-leaf and @under_4')).toEqual(['@autumn-leaf', '@under_4']);
    expect(mentionsIn('@autumnleaf.ath writes it in full')).toEqual(['@autumnleaf.ath']);
    expect(mentionsIn('@abc is three characters'), 'too short to be a name').toEqual([]);
    expect(mentionsIn('@abcdefghijklmnopqrstuvwxyz')).toEqual([]);
    expect(mentionsIn('@abcdefghijklmnop ok'), 'sixteen is the limit, not a truncation point').toEqual(['@abcdefghijklmnop']);
  });

  it('MENTION-02: a link keeps its own @, and a word does not grow one', () => {
    expect(mentionsIn('see https://host/@autumnleaf ok')).toEqual([]);
    const branch = between(app, "} else if (match[8] !== undefined) {", "} else {");
    expect(branch).toContain('const before = match.index > 0 ? str[match.index - 1] : \'\';');
    expect(branch).toContain('if (/[A-Za-z0-9_]/.test(before)) {');
    expect(branch, 'and then it is text, not a mention').toContain('parent.append(document.createTextNode(match[8]));');
  });

  it('MENTION-03: a preview keeps the mention as the person wrote it', () => {
    expect(messagePlainText('hi **bold** and @autumnleaf')).toBe('hi bold and @autumnleaf');
    expect(messagePreviewText('@autumnleaf take a look')).toContain('@autumnleaf');
  });

  it('MENTION-04: the press costs a chain read, and only on the press', () => {
    const build = between(app, 'function buildUsernameMention(raw) {', 'function appendInlineFormatted(');
    expect(build).toContain("const button = document.createElement('button');");
    expect(build).toContain("button.className = 'msg-mention';");
    expect(build).toContain('await resolvePlathoUsernameOwner(label);');
    expect(build.indexOf('addEventListener'), 'the read is inside the handler').toBeLessThan(build.indexOf('resolvePlathoUsernameOwner'));
    expect(build).toContain('event.stopPropagation();');
    expect(build).toContain("t('chat.usernameNotRegistered', { name: shown })");
    expect(Object.keys(I18N_STRINGS).every((locale) => Boolean((I18N_STRINGS as any)[locale]['chat.usernameNotRegistered'])),
      'the refusal ships in every locale').toBe(true);
  });

});
