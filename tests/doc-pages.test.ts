import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOC_PAGES, buildPage } from '../scripts/build_doc_pages.mjs';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';

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
    expect(privacy).toContain('toncenter.com');
    expect(privacy).toMatch(/IP address/i);
    expect(privacy, 'the password claim may not be made over all stored data at once')
      .not.toMatch(/This data is stored in your browser's local storage and is encrypted with a\s+password/);
    expect(privacy, 'the phrase and its keys ARE password-encrypted, and that stays said')
      .toMatch(/recovery phrase and the keys derived from it[\s\S]{0,120}PBKDF2-SHA-256/);
    expect(privacy, 'the history is sealed by keys derived from the phrase')
      .toMatch(/Message history, the keys of your conversations and groups[\s\S]{0,200}encrypted\s+with keys derived from your recovery phrase/);
    expect(privacy).not.toMatch(/What such a copy can still see/);
    expect(privacy).toMatch(/On a device that holds your wallet, the same goes for what the app keeps so that it can show pictures, profiles and posts quickly/);
    expect(privacy, 'the node API key: sealed with a device key, said as what it is')
      .toMatch(/optional API key for a node provider, is sealed\s+with a key your browser keeps on this device rather than stored as plain text/);

    const terms = readFileSync('web/terms.html', 'utf8');
    expect(terms).toMatch(/no delete function/i);
    expect(terms).toMatch(/moderators[^.]*hidden/i);
    expect(terms).toMatch(/hidden post stays on the chain/i);
    expect(terms).toMatch(/lose the phrase/i);
  });
});
