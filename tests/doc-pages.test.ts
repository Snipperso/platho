import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC_PAGES, buildPage } from '../scripts/build_doc_pages.mjs';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';

// The privacy policy and terms exist in two forms: markdown, which the app renders in its documents dialog, and
// standalone HTML, which is what a link in a bot profile or an app catalogue has to point at. Two copies of a legal
// text is exactly the shape that drifts — one gets a correction, the other keeps saying the old thing — so the HTML
// is GENERATED and this gate fails the moment the checked-in page stops matching the markdown it came from.
//
// The HTML exists at all because platho.app serves web/docs/*.md as text/markdown with X-Content-Type-Options:
// nosniff, so a browser downloads the file rather than displaying it. MEASURED against the live server.
describe('standalone document pages', () => {
  it('DOCPAGE-01: the published HTML is what the markdown currently renders to', () => {
    for (const page of DOC_PAGES) {
      const onDisk = readFileSync(page.html, 'utf8');
      expect(
        onDisk,
        `${page.html} is stale — re-run: node scripts/build_doc_pages.mjs`,
      ).toBe(buildPage(page));
    }
  });

  it('DOCPAGE-02: the pages and their stylesheet actually ship', () => {
    // Root files are an explicit allow-list, so a new page is invisible in production until it is named there.
    for (const path of ['privacy.html', 'terms.html', 'doc-page.css']) {
      expect(shouldIncludeWebRuntimeFile(path), `${path} is not in the deploy allow-list`).toBe(true);
    }
  });

  it('DOCPAGE-03: no inline styles — production CSP would drop them and serve a naked page', () => {
    for (const page of DOC_PAGES) {
      const html = readFileSync(page.html, 'utf8');
      expect(html, `${page.html} carries a <style> block`).not.toMatch(/<style[\s>]/i);
      expect(html, `${page.html} carries a style attribute`).not.toMatch(/\sstyle="/i);
      expect(html).toContain('href="/doc-page.css');
    }
  });

  it('DOCPAGE-04: each page carries the substance a reviewer looks for', () => {
    const privacy = readFileSync('web/privacy.html', 'utf8');
    // The two disclosures that make the policy honest rather than flattering.
    expect(privacy).toContain('toncenter.com');
    expect(privacy).toMatch(/IP address/i);
    const terms = readFileSync('web/terms.html', 'utf8');
    // The warning a moderator checks for, and the one a user most needs.
    expect(terms).toMatch(/no moderation and no\s+delete function/i);
    expect(terms).toMatch(/lose the phrase/i);
  });
});
