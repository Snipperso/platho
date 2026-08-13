# Platho Static Web Deploy

Platho PWA is deployed as static files. No backend process is required for wallet creation/import, messaging UI, or crypto self-checks.

## Local package

Preview package:

```powershell
npm.cmd run web:deploy:prepare
```

Production package:

```powershell
npm.cmd run preprod:check
npm.cmd run web:deploy:prepare:prod
```

The production package must stay blocked while the PWA still contains testnet labels, `.env.testnet.local` exists in the release workspace, or the Vault chain provider is not configured. The preview package is useful for server smoke tests, but it is explicitly non-production.

Before a production package can pass, `web/platho-config.mjs` must be switched to production mode with mainnet labels and a static Vault chain provider module. Do not edit scattered UI files for this; the config file is the release switchboard.

Production hosting must keep the security headers from `deploy/Caddyfile` or `deploy/nginx-platho.app.conf`, including:

- `Content-Security-Policy` with `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors https://web.telegram.org` (relaxed from `'none'` so the app can run as a Telegram Mini App, which embeds it in an iframe on `web.telegram.org`);
- `script-src 'self' 'wasm-unsafe-eval'` for the bundled WebP encoder; the bundle has no inline scripts and no inline import map (vendor modules use relative imports), so `script-src` carries no content hashes;
- `connect-src` limited to same-origin plus the approved production TON RPC hosts (`https://toncenter.com`, `https://*.toncenter.com`, plus the broadcast-only retry doors `https://tonapi.io` and `https://mainnet-v4.tonhubapi.com`);
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

If the production RPC host list changes, update the CSP before publishing. A production PWA with local wallet storage must not be served without these headers.

Generated files:

- `artifacts/platho-web-static-preview/` - deployable static preview bundle.
- `artifacts/web_static_deploy_prep.preview.json` - preview file hashes and release checks.
- `artifacts/WEB_STATIC_DEPLOY_PREP_PREVIEW.md` - human-readable preview deploy report.
- `artifacts/WEB_STATIC_DEPLOY_STATUS_PREVIEW.txt` - single-line preview status.
- `artifacts/web_static_deploy_prep.production.json` - production gate report when `web:deploy:prepare:prod` is run.

The unsuffixed `artifacts/web_static_deploy_prep.json`, `artifacts/WEB_STATIC_DEPLOY_PREP.md`, and `artifacts/WEB_STATIC_DEPLOY_STATUS.txt` files always contain the latest run.

## Server layout

Recommended layout:

```text
/srv/platho/releases/<timestamp>/
/srv/platho/current -> /srv/platho/releases/<timestamp>
```

Copy the package contents into a new release directory, then atomically switch `current` to that directory. Keep old releases for rollback.

## Caddy

`deploy/Caddyfile` is the preferred config because Caddy handles TLS renewal cleanly.

Typical flow on the server:

```sh
sudo mkdir -p /srv/platho/releases
sudo cp -a ./platho-web-static-preview /srv/platho/releases/preview
sudo ln -sfn /srv/platho/releases/preview /srv/platho/current
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Point DNS `A` and `AAAA` records for `platho.app` at the server before expecting HTTPS issuance to work.

## Platho RPC gateway (RETIRED)

`rpc.platho.app` has been decommissioned. The PWA is **client-direct**: each client talks to TON itself via the user's own optional free TonCenter API key (with keyless TonCenter as a last-resort fallback), so there is no central gateway to block or DoS. Transport is TonCenter-only — the former Orbs (TON Access) path has been removed. The former gateway code (`deploy/platho-rpc-gateway.*`) and its tests have been removed, and `validatePlathoAppConfig` now actively forbids any provider routing through `rpc.platho.app`.

## Nginx fallback

`deploy/nginx-platho.app.conf` is provided if you choose Nginx instead. It assumes Let's Encrypt certificates at:

```text
/etc/letsencrypt/live/platho.app/fullchain.pem
/etc/letsencrypt/live/platho.app/privkey.pem
```

Install the config into `sites-available`, symlink it into `sites-enabled`, run `nginx -t`, then reload Nginx.

## Verifiable delivery (release tags)

Platho has no backend, but the app still arrives from one domain — and whoever controls that domain controls the
code that holds the user's keys. That cannot be *solved* in a browser. What it can be is **detectable**.

The build is deterministic: the deploy step copies files, it never compiles or minifies. So `web/` at a release tag
is byte-for-byte what production serves, and **the tag is the announcement** — public git history, no post anyone
has to remember to publish, nothing in any user's feed.

Release ritual: after deploying, tag the release commit.

```bash
git tag -a v1.0.22 -m "1.0.22 — what shipped"
```

Anyone can then check what they were served:

```bash
git checkout v1.0.22
node scripts/verify_released_bundle.mjs
```

It fetches `index.html` and `sw.js`, compares them to the checkout, then follows the content-addressing already in
the bundle: `index.html` names the entry as `app.js?v=b<sha256 of app.js>`, and `sw.js` carries `CACHE_NAME` derived
from every precached asset's URL and bytes plus the list itself. Two files pin all 158. Exit 0 = match.

`tests/sw-precache-covers-runtime` keeps that chain whole — every module reachable from `app.js` must be precached,
or files ship that nothing pins. It was 46 modules short when the check was written.

**What this does NOT catch**, so nobody sells it as more than it is: a TARGETED swap (bad bundle to one address
while every verifier elsewhere sees a clean one), and a malicious release built and tagged honestly. It catches a
sustained substitution of the published build. The real answer to a single-domain chokepoint is that the client is
Apache-2.0 and forkable — anyone who distrusts our delivery can serve their own.

**Never build the check into the app.** A swapped build ships a swapped check that reports success. Verification
only counts performed by someone the server cannot edit.
