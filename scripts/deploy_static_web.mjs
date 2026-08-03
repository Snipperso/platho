#!/usr/bin/env node
// Deploy the prepared static bundle: build the tarball, stream it to the server's forced command over ssh.
//
// WHY THIS REPLACES scripts/deploy_static_web.ps1, measured repeatedly and again on 2026-08-02:
//
// The PowerShell version piped the tarball into ssh through
// `[System.Diagnostics.Process]` + `StandardInput.BaseStream.CopyTo`. Under a non-interactive host that redirection
// MANGLES the bytes: the local tar is valid (`tar -tf` lists all 237 entries) and the remote python rejects it with
// `tarfile.ReadError: invalid header`. The corruption is purely in transit, and it looks like a server-side problem.
//
// Node hands the child a FILE DESCRIPTOR for stdin, so the bytes never pass through a stream the host can reinterpret
// — the same mechanism that makes `ssh … < file` work from a POSIX shell, which is how every deploy today was
// actually completed after the .ps1 failed.
//
//   node scripts/deploy_static_web.mjs                 production (default)
//   node scripts/deploy_static_web.mjs --mode preview
import { openSync, closeSync, readFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const die = (message) => { console.error(`ABORT: ${message}`); process.exit(1); };

const MODE = arg('--mode', 'production');
const HOST = arg('--host', '45.142.141.141');
const USER = arg('--user', 'platho-deploy');
const KEY = arg('--key', resolve(process.env.HOME ?? process.env.USERPROFILE ?? '.', '.ssh/platho_deploy_ed25519'));
const KNOWN_HOSTS = arg('--known-hosts', 'artifacts/local/njalla_known_hosts');
const PREP = 'artifacts/web_static_deploy_prep.json';

if (!['preview', 'production'].includes(MODE)) die(`--mode must be preview or production, got ${MODE}`);
for (const [label, path] of [['deploy key', KEY], ['known hosts', KNOWN_HOSTS], ['deploy prep', PREP]]) {
  if (!existsSync(path)) die(`${label} not found: ${path}`);
}

const prep = JSON.parse(readFileSync(PREP, 'utf8'));
if (prep.mode !== MODE) die(`deploy prep is for mode ${prep.mode}, asked for ${MODE} — re-run the prepare step`);
if (MODE === 'production' && prep.productionReady !== true) {
  die(`production prep is not ready. Blockers: ${(prep.blockers ?? []).join(', ') || '(none listed)'}`);
}
const bundleHash = prep.runtime?.bundleSha256;
if (!bundleHash) die(`missing runtime.bundleSha256 in ${PREP}`);

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '-');
const release = `release-${stamp}-${bundleHash.slice(0, 12)}`;
const tarPath = `artifacts/local/platho-web-static-${release}.tar`;

const tar = spawnSync('tar', ['-cf', tarPath, '-C', prep.outputDir, '.'], { stdio: 'inherit' });
if (tar.error) die(`could not run tar: ${tar.error.message}`);
if (tar.status !== 0) die(`tar failed with exit code ${tar.status}`);

// Verify the archive we are about to ship actually reads. The remote failure mode this script exists to avoid is
// indistinguishable from a corrupt tarball, so proving the LOCAL one is sound first makes the next failure legible.
const verify = spawnSync('tar', ['-tf', tarPath], { encoding: 'utf8' });
if (verify.status !== 0) die(`the tarball just built does not read back: ${verify.stderr}`);
const entries = verify.stdout.split('\n').filter(Boolean).length;
console.log(`${release}: ${entries} entries, ${statSync(tarPath).size} bytes`);

const fd = openSync(tarPath, 'r');
try {
  const ssh = spawnSync('ssh', [
    '-i', KEY,
    '-o', 'BatchMode=yes',
    '-o', `UserKnownHostsFile=${KNOWN_HOSTS}`,
    `${USER}@${HOST}`,
    release,
  ], { stdio: [fd, 'inherit', 'inherit'] });
  if (ssh.error) die(`could not run ssh: ${ssh.error.message}`);
  if (ssh.status !== 0) die(`deploy failed with exit code ${ssh.status}`);
} finally {
  closeSync(fd);
}

console.log(`deployed ${release}`);
console.log(`tarball: ${tarPath}`);
