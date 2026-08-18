#!/usr/bin/env node
/*
 * Render the legal documents as standalone HTML pages.
 *
 * The markdown under web/docs/ is the single source: the app reads it directly, and pasting the same text into
 * hand-written HTML would guarantee that one copy drifts. So the pages are GENERATED, and doc-pages.test.ts fails
 * if the checked-in HTML no longer matches the markdown it came from.
 *
 * Why a page at all, when the .md is already served: platho.app returns it as text/markdown with nosniff, so a
 * browser DOWNLOADS it instead of showing it. A privacy-policy link that hands the reader a file is worse than no
 * link — and one of the places that link goes is Telegram's app moderation.
 *
 *   node scripts/build_doc_pages.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DOC_PAGES = [
  { md: 'web/docs/privacy-policy.md', html: 'web/privacy.html', title: 'Privacy Policy' },
  { md: 'web/docs/terms-of-use.md', html: 'web/terms.html', title: 'Terms of Use' },
];

const escape = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Inline spans: bold, code, bare URLs. Deliberately small — the documents use nothing else. */
function inline(text) {
  let out = escape(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1">$1</a>');
  return out;
}

function render(markdown) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let para = [];
  let list = false;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushPara(); flushList();
      const level = Math.min(heading[1].length + 1, 6);   // the doc's h1 becomes the page h1, the rest shift down
      out.push(`<h${level - 1}>${inline(heading[2])}</h${level - 1}>`);
    } else if (bullet) {
      flushPara();
      if (!list) { out.push('<ul>'); list = true; }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      if (list) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`); }
      else para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join('\n      ');
}

export function buildPage({ md, title }) {
  const body = render(readFileSync(resolve(ROOT, md), 'utf8'));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0b0d0f">
    <meta name="color-scheme" content="dark">
    <title>Platho — ${title}</title>
    <link rel="icon" href="/assets/platho-icon-192.png?v=3" sizes="192x192" type="image/png">
    <link rel="stylesheet" href="/doc-page.css?v=1">
  </head>
  <body>
    <header class="doc-nav">
      <a class="doc-brand" href="/">
        <img src="/assets/platho-icon-192.png?v=3" alt="" width="28" height="28">
        <span>Platho</span>
      </a>
      <nav>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
      </nav>
    </header>
    <main class="doc">
      ${body}
    </main>
    <footer class="doc-foot">
      <a href="https://platho.app">platho.app</a>
      <a href="https://github.com/Snipperso/platho">Source</a>
      <a href="https://t.me/plathoapp">Telegram</a>
    </footer>
  </body>
</html>
`;
}

const invoked = (process.argv[1] || '').split(String.fromCharCode(92)).join('/');
if (import.meta.url === `file:///${invoked}`) {
  for (const page of DOC_PAGES) {
    writeFileSync(resolve(ROOT, page.html), buildPage(page), 'utf8');
    console.log(`wrote ${page.html}`);
  }
}
