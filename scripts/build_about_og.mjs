#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Build the social-share / Open Graph image for about.platho.app.
//
//   node scripts/build_about_og.mjs
//
// Renders a 1200x630 PNG (the size Facebook / Twitter / Telegram / LinkedIn
// expect) from an inline SVG, using the on-chain Platho logo path. The page
// CSP only constrains what the page itself loads — crawlers fetch the OG image
// URL directly, so a real raster (not the SVG favicon) is what social cards use.
//
// Output: web-about/assets/og.png  (bundled by scripts/deploy_about_web.sh)
// ---------------------------------------------------------------------------
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'web-about', 'assets', 'og.png');

// The Platho mark, drawn in a 512x512 box (same path as the favicon).
const MARK = 'M167.5 432.1 L330.5 432.1 L346.5 429.9 L364.5 424.8 L380.5 417.7 L393.5 409.6 L404.5 401.0 L416.0 389.5 L425.8 376.5 L435.9 358.5 L441.7 343.5 L445.9 325.5 L446.9 296.5 L445.8 285.5 L442.8 271.5 L435.7 251.5 L425.9 233.5 L416.9 221.5 L402.5 207.1 L387.5 196.1 L362.5 184.1 L348.5 180.1 L334.5 178.0 L221.5 177.2 L220.5 79.2 L137.5 79.4 L137.2 139.5 L166.5 140.2 L166.8 174.5 L136.5 175.1 L135.6 174.5 L135.7 163.5 L134.5 162.8 L104.1 163.5 L104.5 192.7 L134.5 192.9 L135.5 193.5 L135.4 220.5 L136.2 221.5 L166.8 222.5 L166.5 253.0 L135.5 253.3 L134.5 235.2 L105.5 235.1 L104.1 236.5 L104.3 264.5 L134.5 265.3 L135.5 292.5 L197.5 292.7 L198.4 293.5 L198.0 323.5 L166.8 324.5 L167.3 364.5 L198.4 365.5 L198.3 394.5 L166.9 395.5 L166.7 430.5 L167.5 432.1 Z M104.5 407.6 L134.9 407.5 L134.5 377.7 L104.5 377.9 L104.5 407.6 Z M221.5 372.3 L221.5 237.2 L322.5 237.1 L329.5 238.1 L342.5 242.1 L352.5 247.4 L359.5 252.8 L369.6 263.5 L377.0 275.5 L381.5 288.5 L383.1 298.5 L382.7 316.5 L379.7 327.5 L374.8 338.5 L368.9 347.5 L358.5 357.9 L344.5 366.7 L332.5 370.8 L322.5 372.4 L221.5 372.3 Z M65.5 324.3 L93.5 324.3 L93.9 294.5 L64.9 294.5 L64.6 322.5 L65.5 324.3 Z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="mark" x1="118" y1="430" x2="430" y2="82" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2be6ad"/>
      <stop offset="0.55" stop-color="#30d5b0"/>
      <stop offset="1" stop-color="#25c99b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.12" r="0.9">
      <stop offset="0" stop-color="#30d5b0" stop-opacity="0.20"/>
      <stop offset="0.5" stop-color="#30d5b0" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#30d5b0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="#0b0d0f"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="0" width="1200" height="6" fill="url(#mark)"/>

  <!-- logo mark + wordmark -->
  <g transform="translate(96 84) scale(0.232)">
    <rect width="512" height="512" rx="108" fill="#11161b"/>
    <g transform="translate(0 512) scale(1 -1)">
      <path fill="url(#mark)" fill-rule="evenodd" d="${MARK}"/>
    </g>
  </g>
  <text x="240" y="158" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#f4f7f6" letter-spacing="-1">Platho</text>
  <text x="242" y="196" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#30d5b0" letter-spacing="3">DECENTRALIZED MESSENGER ON TON</text>

  <!-- headline -->
  <text x="96" y="330" font-family="Arial, sans-serif" font-size="76" font-weight="800" fill="#f4f7f6" letter-spacing="-1.5">Own your messages.</text>
  <text x="96" y="416" font-family="Arial, sans-serif" font-size="76" font-weight="800" fill="#f4f7f6" letter-spacing="-1.5">Own your name.</text>
  <text x="96" y="502" font-family="Arial, sans-serif" font-size="76" font-weight="800" fill="#30d5b0" letter-spacing="-1.5">Own your keys.</text>

  <!-- footer line -->
  <text x="96" y="586" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="#8b9794">No backend &#183; Post-quantum encrypted &#183; Live on TON mainnet</text>
  <text x="1104" y="586" text-anchor="end" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#cfe9e1">about.platho.app</text>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true },
  background: '#0b0d0f',
});
const png = resvg.render().asPng();
writeFileSync(OUT, png);
console.log(`og.png written: ${OUT} (${png.length} bytes)`);
