#!/usr/bin/env node
/*
 * Serve the operator console over http, because opening it as a FILE cannot work and fails unhelpfully.
 *
 * The page is ES modules, and a module fetched from a file:// origin is blocked by CORS — the browser reports it as
 * "Access to script ... from origin 'null' has been blocked", which says nothing about the actual problem. The owner
 * hit exactly that on the first try, following instructions that said "serve from the repo root" without giving him
 * a way to do it.
 *
 * Serving from the REPO ROOT is not incidental: the console reads its addresses from
 * artifacts/mainnet_genesis_verify_input.json, the file whose sha256 the genesis verification report names, so the
 * document root has to contain both tools/ and artifacts/.
 *
 *   npm run admin
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve('.');
const PORT = Number(process.env.PLATHO_ADMIN_PORT ?? 8778);

// Only what the console needs. A local tool has no business exposing the whole tree — contracts/, build/ and the
// session scratchpads are none of a browser's business even on localhost.
const ALLOWED_PREFIXES = ['tools', 'web', 'artifacts'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function resolveRequest(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = normalize(clean.replace(/^\/+/, '')).replace(/^(\.\.[/\\])+/, '');
  const target = rel === '' || rel === '.' ? 'tools/admin/index.html' : rel;
  const full = join(ROOT, target);
  if (!full.startsWith(ROOT + sep)) return null;                       // traversal
  const top = target.split(/[/\\]/)[0];
  if (!ALLOWED_PREFIXES.includes(top)) return null;
  try {
    const stat = statSync(full);
    return stat.isDirectory() ? join(full, 'index.html') : full;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const file = resolveRequest(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Операторский пульт:  http://127.0.0.1:${PORT}/tools/admin/\n`);
  console.log('  Ctrl+C — остановить.\n');
});
