# Platho Static Web Deploy

Platho PWA is deployed as static files. No backend process is required for login, messaging UI, crypto self-checks, or TonConnect bootstrap.

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
/var/www/platho.app/releases/<timestamp>/
/var/www/platho.app/current -> /var/www/platho.app/releases/<timestamp>
```

Copy the package contents into a new release directory, then atomically switch `current` to that directory. Keep old releases for rollback.

## Caddy

`deploy/Caddyfile` is the preferred config because Caddy handles TLS renewal cleanly.

Typical flow on the server:

```sh
sudo mkdir -p /var/www/platho.app/releases
sudo cp -a ./platho-web-static-preview /var/www/platho.app/releases/preview
sudo ln -sfn /var/www/platho.app/releases/preview /var/www/platho.app/current
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Point DNS `A` and `AAAA` records for `platho.app` at the server before expecting HTTPS issuance to work.

## Nginx fallback

`deploy/nginx-platho.app.conf` is provided if you choose Nginx instead. It assumes Let's Encrypt certificates at:

```text
/etc/letsencrypt/live/platho.app/fullchain.pem
/etc/letsencrypt/live/platho.app/privkey.pem
```

Install the config into `sites-available`, symlink it into `sites-enabled`, run `nginx -t`, then reload Nginx.
