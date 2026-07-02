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
- `connect-src` limited to same-origin plus the approved production TON RPC hosts (`https://toncenter.com` and `https://*.toncenter.com`);
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
