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
// WHICH SITE ON THE MACHINE. `production` is platho.app (/srv/platho on the server); `stage` is the stand,
// stage.platho.app (/srv/platho-stage) — the same bundle, the same receiver, the same Caddy site body, a different
// root, so a build can be tried under the exact production headers and cache policy before it is released
// [OWNER 2026-08-21: "копия сайта для тестирования … по безопасности сделай также как на основном сайте"].
// The stand lives on the machine its DNS names (A); production defaults to the second machine as before.
const SITE = arg('--site', 'production');
if (!['production', 'stage'].includes(SITE)) die(`--site must be production or stage, got ${SITE}`);
const SITE_HOST = SITE === 'stage' ? 'stage.platho.app' : 'platho.app';
// WHERE THE BYTES GO IS NOT WRITTEN DOWN IN THIS REPOSITORY. [2026-09-05: the repo is public and it published
// both machine addresses, both SSH key filenames and the deploy account as defaults right here. None of that is a
// credential — SSH is key-only behind AllowUsers, fail2ban and a default-deny firewall — but one line of it
// mattered: the standby machine's only real property is that it is absent from DNS and carries no organic
// traffic, and this file named it as the DEFAULT deploy host. The production address is public through DNS
// anyway; the standby's was not, until we printed it.]
//
// Order: an explicit flag, then the environment, then the local file — and then a NAMED abort. Never a built-in
// address: a fallback would silently undo the removal, and could aim a release at the wrong machine while
// looking like it had worked.
const HOSTS_FILE = 'artifacts/local/deploy-hosts.env';
const hostSettings = (() => {
  if (!existsSync(HOSTS_FILE)) return null;
  const parsed = new Map();
  for (const line of readFileSync(HOSTS_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const at = trimmed.indexOf('=');
    if (at < 1) continue;
    parsed.set(trimmed.slice(0, at).trim(), trimmed.slice(at + 1).trim());
  }
  return parsed;
})();
const setting = (name) => {
  const fromEnv = (process.env[name] ?? '').trim();
  if (fromEnv) return fromEnv;
  const fromFile = (hostSettings?.get(name) ?? '').trim();
  if (fromFile) return fromFile;
  die(hostSettings === null
    ? `${name} is not set and ${HOSTS_FILE} does not exist — copy deploy/deploy-hosts.env.example there and fill it in`
    : `${name} is missing from ${HOSTS_FILE} — deploy/deploy-hosts.env.example lists every setting these scripts read`);
};

const HOST = arg('--host', null) ?? setting(SITE === 'stage' ? 'PLATHO_HOST_STAGE' : 'PLATHO_HOST_PRODUCTION');
const USER = arg('--user', null) ?? setting('PLATHO_DEPLOY_USER');
// A key setting holds a BASENAME inside ~/.ssh, not a path, so the local file carries between machines.
const KEY = arg('--key', null) ?? resolve(process.env.HOME ?? process.env.USERPROFILE ?? '.', '.ssh', setting('PLATHO_DEPLOY_KEY'));
const KNOWN_HOSTS = arg('--known-hosts', null) ?? setting('PLATHO_KNOWN_HOSTS');
const PREP = 'artifacts/web_static_deploy_prep.json';

if (!['preview', 'production'].includes(MODE)) die(`--mode must be preview or production, got ${MODE}`);
// PREVIEW MAY NOT TOUCH THE PRODUCTION SITE. [MEASURED 2026-08-29, audit 7: `--mode` and `--site` were
// independent axes and `--site` defaulted to production, so `npm run web:deploy:preview` — the script whose name
// promises a rehearsal — shipped to platho.app with BOTH production gates skipped, because each is written
// `MODE === 'production' && ...`. The bundles are identical (one prep, one bundleSha256, no mode in the file
// selection), so nothing wrong would be uploaded; what was wrong is that the genesis-verified blocker, the
// testnet-config blocker and the version-must-move guard all stand down on the live site.
// The owner deploys with `web:deploy` and `web:deploy:stage` only; preview exists for rehearsal, so it is pinned
// to the stand. Reaching production is `--mode production`, which is what turns the gates back on.]
if (MODE === 'preview' && SITE === 'production') {
  die('--mode preview may not target the production site: it stands the production gates down '
    + '(genesis verification, config mode, version-must-move). Use --site stage to rehearse, '
    + 'or --mode production to release.');
}
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

// THE VERSION MUST MOVE, AND THIS IS THE ONLY PLACE THAT CAN INSIST.
//
// The product version is semantic and deliberately hand-decided (it was split away from the cache keys on
// 2026-08-09 so it could stand still through a one-line hotfix). Nothing about that decision made anyone
// REMEMBER it: the number sat at 1.0.34 across several releases, because no step in the ritual required it.
//
// A bump cannot be automatic without turning the version back into a build counter. Refusing to ship a version
// that is ALREADY LIVE gets the same guarantee from the other side: you still choose patch or minor, and you
// cannot skip the choice.
//
// SOFT ON A FAILED LOOKUP, hard on a real match: an unreachable site must not block a deploy (that is when you
// most need one), but a version we can see and that equals ours is a mistake every time.
if (MODE === 'production' && !process.argv.includes('--same-version')) {
  const shipping = /(id="appVersionLabel">)(\d+\.\d+\.\d+)</.exec(readFileSync('web/index.html', 'utf8'))?.[2];
  if (!shipping) die('could not read the version out of web/index.html');
  // ASK THE MACHINE WE ARE SHIPPING TO, not the public name.
  //
  // This used to fetch https://platho.app/ no matter what --host said, so with two servers it compared the wrong
  // one: on 2026-08-20, immediately after 1.1.7 went to the live box, deploying the SAME release to the second
  // server was refused as "already live" while that server sat on 1.1.5. The guard fired on a machine it was not
  // being asked about, and the only way past it was --same-version — which would also have waved through the
  // genuine mistake it exists to catch.
  //
  // fetch() cannot be pinned to an address (it silently drops a Host header, and there is no connect override),
  // so this speaks https directly: connect to the target, but present the real name in SNI and Host, or Caddy
  // answers for a vhost that does not exist. The name is the SITE's: the stand is asked as stage.platho.app.
  const probe = spawnSync(process.execPath, ['-e', `
    const https = require('node:https');
    const done = (v) => { process.stdout.write(v); process.exit(0); };
    const req = https.request({
      host: ${JSON.stringify(HOST)}, port: 443, path: '/', method: 'GET', servername: ${JSON.stringify(SITE_HOST)},
      headers: { Host: ${JSON.stringify(SITE_HOST)}, 'Cache-Control': 'no-store' },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => done(/id="appVersionLabel">(\\d+\\.\\d+\\.\\d+)</.exec(body)?.[1] ?? ''));
    });
    req.setTimeout(15000, () => { req.destroy(); done(''); });
    req.on('error', () => done(''));
    req.end();
  `], { encoding: 'utf8', timeout: 20_000 });
  const live = (probe.stdout ?? '').trim();
  if (!live) {
    console.error(`note: could not read the version on ${HOST} (${SITE_HOST}) — shipping without the same-version check`);
  } else if (live === shipping && SITE === 'stage') {
    // THE STAND IS NOT A RELEASE. Re-shipping the same version number to it is the normal case — a build under
    // test carries the number it would ship with — so the guard only says so here and never refuses.
    console.error(`note: ${SITE_HOST} already shows ${shipping} — a stand takes the same version again`);
  } else if (live === shipping) {
    die(`version ${shipping} is already live on ${HOST}. Bump it first:\n`
      + '  node scripts/bump_release_version.mjs            (a fix)\n'
      + '  node scripts/bump_release_version.mjs --minor    (a feature a user can see)\n'
      + '  node scripts/bump_module_versions.mjs --run && npm run web:deploy:prepare\n'
      + 'Re-deploying the same version on purpose? Pass --same-version.');
  } else {
    console.error(`version ${live} -> ${shipping}`);
  }
}

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
    // The receiver's command: the release name, prefixed with the site for the stand ("stage release-…") —
    // see scripts/server/platho-deploy-receive.sh, which maps that prefix to /srv/platho-stage.
    `${SITE === 'stage' ? 'stage ' : ''}${release}`,
  ], { stdio: [fd, 'inherit', 'inherit'] });
  if (ssh.error) die(`could not run ssh: ${ssh.error.message}`);
  if (ssh.status !== 0) die(`deploy failed with exit code ${ssh.status}`);
} finally {
  closeSync(fd);
}

console.log(`deployed ${release} to ${SITE_HOST} (${HOST})`);

// CERTIFICATE WATCH, on the ritual that actually runs every day [OWNER 2026-08-27: "do we watch the renewals?
// can they die suddenly?"]. There is no monitoring on either machine (empty crontabs, no custom timers — the
// netwatch of record was not found on 2026-08-27), so the deploy — the one thing that provably happens daily —
// carries the check. Caddy starts renewing 30 days before expiry and retries forever, so a cert can only die
// after ~30 days of SILENT failures; shouting at <21 days means the renewal has already been failing for 9+
// days and someone finally hears it. A check failure must never fail the deploy it rides on.
try {
  const { connect } = await import('node:tls');
  const days = await new Promise((resolveDays) => {
    const socket = connect({ host: HOST, port: 443, servername: SITE_HOST, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const until = Date.parse(cert?.valid_to ?? '');
      resolveDays(Number.isFinite(until) ? Math.floor((until - Date.now()) / 86_400_000) : null);
    });
    socket.on('error', () => resolveDays(null));
    socket.on('timeout', () => { socket.destroy(); resolveDays(null); });
  });
  if (days === null) {
    console.warn(`cert check: could not read the ${SITE_HOST} certificate from ${HOST}`);
  } else if (days < 21) {
    console.error(`\n!!! CERTIFICATE ALERT: ${SITE_HOST} on ${HOST} expires in ${days} day(s) — Caddy renewal has`);
    console.error('!!! been failing for over a week. Check journalctl -u caddy on the machine NOW.\n');
  } else {
    console.log(`cert: ${SITE_HOST} valid for ${days} more days`);
  }
} catch (certError) {
  console.warn('cert check skipped:', String(certError?.message ?? certError).slice(0, 120));
}
console.log(`tarball: ${tarPath}`);
