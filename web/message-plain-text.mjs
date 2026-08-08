// THE MESSAGE FORMATTING GRAMMAR, plus the one projection of it that is not a DOM render.
//
// Composer formatting rides INSIDE the message text as raw UTF-8 markers ('# ' heading, '> ' quote, '- ' list,
// '::center ' alignment, '**bold**', '`code`', '[label](url)'). That is deliberate: no wire change, and a client
// that has not updated shows the literal markup instead of a broken message. Every reader that RENDERS a message
// parses those markers (appendFormattedMessageText). Every reader that SUMMARISES one did not — so the marker leaked
// straight through:
//
//   OBSERVED 2026-08-08 (owner): a message sent as a heading rendered as a heading inside the conversation and as
//   the literal "# Word" in the conversation LIST beside it. Same text, two readers, one of which had never been
//   told the text carries a grammar.
//
// The summarising readers are not one place — the private thread list, the public channel card, the reply quote
// strip, and the target-row matcher that compares a quote against message text. Giving each its own stripper is how
// four of them end up disagreeing about what '::center' means. So the grammar lives here once and they share a
// projection of it.
//
// The regexes are EXPORTED rather than duplicated for the same reason: app.js's renderer must parse exactly what
// this strips. Two copies that drift apart put the marker back on screen in whichever reader was not updated.

// Inline: ***bold+italic***, **bold**, *italic*, `code`, [label](url), and bare urls.
// Kept as a SOURCE string because the regex is /g and therefore stateful — see createInlineFormatRegex.
const INLINE_FORMAT_SOURCE = '\\*\\*\\*([^*\\n]+)\\*\\*\\*|\\*\\*([^*\\n]+)\\*\\*|\\*([^*\\n]+)\\*|`([^`\\n]+)`|\\[([^\\]\\n]{1,200})\\]\\(([^\\s()]{1,2000})\\)|(https?:\\/\\/[^\\s<>"\']+)';

/**
 * A FRESH instance per consumer. The inline regex is global, so it carries `lastIndex` between calls, and the
 * renderer drives it with exec() in a loop. A single shared object would let a strip running in the middle of that
 * loop move the cursor out from under the render — a class of bug that shows up as randomly truncated messages.
 */
export function createInlineFormatRegex() {
  return new RegExp(INLINE_FORMAT_SOURCE, 'g');
}

// Block (line-level). Non-global, therefore stateless, therefore safe to share.
export const MSG_HEADING_RE = /^(#{1,3})\s+(.+)$/;
export const MSG_QUOTE_RE = /^>\s?(.*)$/;
export const MSG_ULIST_RE = /^[-*]\s+(.+)$/;
export const MSG_OLIST_RE = /^\d+\.\s+(.+)$/;
export const MSG_ALIGN_RE = /^::(center|justify)\s+([\s\S]*)$/;

const STRIP_INLINE_RE = createInlineFormatRegex();

/** Inline markers off, content kept. A bare url is its own text, so it survives whole. */
function stripInlineMarkers(value) {
  return String(value ?? '').replace(
    STRIP_INLINE_RE,
    (match, boldItalic, bold, italic, code, linkLabel, _linkUrl, bareUrl) => {
      if (boldItalic !== undefined) return boldItalic;
      if (bold !== undefined) return bold;
      if (italic !== undefined) return italic;
      if (code !== undefined) return code;
      if (linkLabel !== undefined) return linkLabel;   // [label](url) -> label; the url is not preview material
      return bareUrl ?? match;
    },
  );
}

/**
 * The message as a human reads it: markers gone, words kept, line structure kept.
 *
 * Line structure survives because the callers differ — a one-line thread preview lets CSS collapse it, while the
 * snippet matcher in replyQuoteTargetRow compares against real message text and would mismatch on a collapse the
 * other side did not do. Callers that need a single line collapse it themselves.
 */
export function messagePlainText(value) {
  const str = String(value ?? '');
  if (!str) return '';
  const out = [];
  for (const rawLine of str.split('\n')) {
    // Alignment is a paragraph-leading prefix, so it is stripped BEFORE the line-level markers: '::center # Text'
    // is a centred heading, and testing for the heading first would leave '::center' glued to the front.
    const align = MSG_ALIGN_RE.exec(rawLine);
    const line = align ? align[2] : rawLine;
    const heading = MSG_HEADING_RE.exec(line);
    if (heading) { out.push(stripInlineMarkers(heading[2])); continue; }
    const quote = MSG_QUOTE_RE.exec(line);
    if (quote) { out.push(stripInlineMarkers(quote[1])); continue; }
    const ulist = MSG_ULIST_RE.exec(line);
    if (ulist) { out.push(stripInlineMarkers(ulist[1])); continue; }
    const olist = MSG_OLIST_RE.exec(line);
    if (olist) { out.push(stripInlineMarkers(olist[1])); continue; }
    out.push(stripInlineMarkers(line));
  }
  return out.join('\n').trim();
}

/** The same projection collapsed to ONE line — what a list row can actually show. */
export function messagePreviewText(value) {
  return messagePlainText(value).replace(/\s+/g, ' ').trim();
}
