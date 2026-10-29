
const INLINE_FORMAT_SOURCE = '\\*\\*\\*([^*\\n]+)\\*\\*\\*|\\*\\*([^*\\n]+)\\*\\*|\\*([^*\\n]+)\\*|`([^`\\n]+)`|\\[([^\\]\\n]{1,200})\\]\\(([^\\s()]{1,2000})\\)|(https?:\\/\\/[^\\s<>"\']+)|(@[A-Za-z0-9_-]{4,16}(?:\\.ath)?)(?![A-Za-z0-9_-])';

export function createInlineFormatRegex() {
  return new RegExp(INLINE_FORMAT_SOURCE, 'g');
}

export const MSG_HEADING_RE = /^(#{1,3})[ \t]+(\S.*)$/;
export const MSG_QUOTE_RE = /^>\s?(.*)$/;
export const MSG_ULIST_RE = /^[-*][ \t]+(\S.*)$/;
export const MSG_OLIST_RE = /^\d+\.[ \t]+(\S.*)$/;
export const MSG_ALIGN_RE = /^::(center|justify)\s+([\s\S]*)$/;

const STRIP_INLINE_RE = createInlineFormatRegex();

function stripInlineMarkers(value) {
  return String(value ?? '').replace(
    STRIP_INLINE_RE,
    (match, boldItalic, bold, italic, code, linkLabel, _linkUrl, bareUrl) => {
      if (boldItalic !== undefined) return boldItalic;
      if (bold !== undefined) return bold;
      if (italic !== undefined) return italic;
      if (code !== undefined) return code;
      if (linkLabel !== undefined) return linkLabel;
      return bareUrl ?? match;
    },
  );
}

export function messagePlainText(value) {
  const str = String(value ?? '');
  if (!str) return '';
  const out = [];
  for (const rawLine of str.split('\n')) {
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

export function messagePreviewText(value) {
  return messagePlainText(value).replace(/\s+/g, ' ').trim();
}
