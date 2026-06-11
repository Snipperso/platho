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

- `Content-Security-Policy` with `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'`;
- `script-src 'self' 'wasm-unsafe-eval'` for the bundled WebP encoder; the bundle has no inline scripts and no inline import map (vendor modules use relative imports), so `script-src` carries no content hashes;
- `connect-src` limited to same-origin plus the approved production TON RPC hosts (`https://toncenter.com`, `https://*.toncenter.com`, and `https://rpc.platho.app`);
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

## Platho RPC gateway

The production PWA uses `https://rpc.platho.app` as the first concrete TON RPC provider after any user-supplied custom transport. This host must not expose a full public TON API. The preferred production mode is `toncenter-v3` with a server-side TonCenter API key stored outside the repo. The gateway only exposes the PWA routes: allowlisted `runGetMethod`, wallet `getAddressInformation`, restricted `/api/v3/messages` history routes for CapsuleHub publish body recovery plus CapsuleHub-to-Vault publish ACK confirmation, and restricted `/api/v3/message` BOC broadcast with only a JSON `{ "boc": "..." }` body.

DNS:

```text
A     rpc.platho.app     <server IPv4>
AAAA  rpc.platho.app     <server IPv6>
```

Install outline:

```sh
sudo mkdir -p /etc/platho
sudo mkdir -p /opt/platho
sudo cp deploy/platho-rpc-gateway.py /opt/platho/platho-rpc-gateway.py
sudo cp deploy/platho-rpc-gateway.env.example /etc/platho/rpc-gateway.env
sudoedit /etc/platho/rpc-gateway.env
sudo install -m 600 -o root -g root /path/to/toncenter-mainnet.key /etc/platho/toncenter-mainnet.key
sudo cp deploy/platho-rpc-gateway.service /etc/systemd/system/platho-rpc-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now platho-rpc-gateway
sudo systemctl status platho-rpc-gateway
```

Keep the key out of the PWA bundle and out of git. Prefer `PLATHO_RPC_TONCENTER_API_KEY_FILE=/etc/platho/toncenter-mainnet.key` over putting the key directly in the environment. The file should be root-owned and mode `600`. Keep a non-empty `PLATHO_RPC_UPSTREAM_USER_AGENT`; TonCenter's edge can reject default Python urllib traffic before the request reaches the API.

The gateway allowlists the PWA routes, applies CORS for `platho.app`, limits get-method names, restricts message history by destination/source/opcode, validates BOC broadcast bodies, and rate-limits clients. It is a production guardrail, not a full node. If you need an anonymous fallback, set `PLATHO_RPC_UPSTREAM_KIND=ton-access-v2`; that mode disables `/api/v3/messages` and `/api/v3/message` and uses Orbs TON Access for read verification.

## Nginx fallback

`deploy/nginx-platho.app.conf` is provided if you choose Nginx instead. It assumes Let's Encrypt certificates at:

```text
/etc/letsencrypt/live/platho.app/fullchain.pem
/etc/letsencrypt/live/platho.app/privkey.pem
```

Install the config into `sites-available`, symlink it into `sites-enabled`, run `nginx -t`, then reload Nginx.
