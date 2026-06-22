#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deploy the static informational site to about.platho.app.
#
# The site is tiny and changes rarely, so it uses the owner's admin SSH
# (sudo NOPASSWD) directly rather than the forced-command deploy account the
# main PWA uses. Run from the repo root WITH THE BASH TOOL (the tar is piped
# over stdin with `< file` — PowerShell corrupts the binary stream).
#
#   bash scripts/deploy_about_web.sh
#
# IMPORTANT: the live /etc/caddy/Caddyfile is hand-maintained on the server and
# has diverged from deploy/Caddyfile (own security_headers snippet, route blocks,
# Telegram frame-ancestors, etc.). NEVER `cp deploy/Caddyfile` over it. This
# script APPENDS the about.platho.app block once (idempotent-ish: re-running
# appends again, so only run the Caddy step when the block is missing — it makes
# a timestamped backup and validates before reloading, rolling back on failure).
# ---------------------------------------------------------------------------
set -euo pipefail

REMOTE="platho@45.142.141.141"
KEY="$HOME/.ssh/platho_njalla_ed25519"
SSHOPTS=(-i "$KEY" -o BatchMode=yes -o ConnectTimeout=30 -o StrictHostKeyChecking=accept-new)
SRC="web-about"
TS="$(date -u +%Y%m%d-%H%M%S)"
REL="release-${TS}-about"
TARBALL="$(mktemp)"

# --- 1. Bundle ONLY the served files (no serve.js / launch tooling) ---------
# assets/ carries the OG image (og.png); robots.txt + sitemap.xml are real
# files so Caddy's `try_files {path} /index.html` serves them instead of HTML.
tar -cf "$TARBALL" -C "$SRC" index.html styles.css main.js robots.txt sitemap.xml assets
echo "bundle: $TARBALL ($(wc -c < "$TARBALL") bytes) -> $REL"

# --- 2. Upload + unpack into a fresh release, fix perms, switch symlink ------
ssh "${SSHOPTS[@]}" "$REMOTE" "cat > /tmp/${REL}.tar" < "$TARBALL"
ssh "${SSHOPTS[@]}" "$REMOTE" "REL='$REL' bash -s" <<'EOF'
set -euo pipefail
sudo mkdir -p /srv/about/releases
sudo rm -rf "/srv/about/releases/$REL"
sudo mkdir -p "/srv/about/releases/$REL"
sudo tar -xf "/tmp/$REL.tar" -C "/srv/about/releases/$REL"
test -f "/srv/about/releases/$REL/index.html"
sudo chgrp -R caddy "/srv/about/releases/$REL"
sudo find "/srv/about/releases/$REL" -type d -exec chmod 2750 {} +
sudo find "/srv/about/releases/$REL" -type f -exec chmod 640 {} +
sudo chmod 755 /srv/about /srv/about/releases
sudo ln -sfn "/srv/about/releases/$REL" /srv/about/current.next
sudo mv -Tf /srv/about/current.next /srv/about/current
rm -f "/tmp/$REL.tar"
echo "current -> $(readlink -f /srv/about/current)"
EOF
rm -f "$TARBALL"
echo "bundle deployed."

# --- 3. ONE-TIME: add the about.platho.app vhost to the LIVE Caddyfile -------
# Run this block only when the site is not yet configured. It backs up, appends,
# validates, and reloads (restoring the backup if validation fails). Skip on
# subsequent content-only deploys (steps 1-2 are enough; the symlink is atomic).
add_caddy_vhost() {
  ssh "${SSHOPTS[@]}" "$REMOTE" "cat > /tmp/about-block.caddy" <<'EOF'

about.platho.app {
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		Content-Security-Policy "default-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "no-referrer"
		Permissions-Policy "accelerometer=(), bluetooth=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), serial=(), usb=()"
	}
	root * /srv/about/current
	route {
		@unsupported_methods method OPTIONS POST PUT PATCH DELETE TRACE CONNECT
		respond @unsupported_methods 405
		@sensitive_paths path /.git* /.env* /scripts/* /artifacts/*
		respond @sensitive_paths 404
		encode zstd gzip
		try_files {path} /index.html
		file_server
	}
}
EOF
  ssh "${SSHOPTS[@]}" "$REMOTE" "bash -s" <<'EOF'
set -euo pipefail
BK="/etc/caddy/Caddyfile.bak.$(date -u +%Y%m%d-%H%M%S)"
sudo cp /etc/caddy/Caddyfile "$BK"
sudo tee -a /etc/caddy/Caddyfile < /tmp/about-block.caddy >/dev/null
if sudo caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile; then
  sudo systemctl reload caddy
  echo "caddy reloaded; backup=$BK"
else
  echo "validate FAILED — restoring $BK"; sudo cp "$BK" /etc/caddy/Caddyfile; exit 1
fi
rm -f /tmp/about-block.caddy
EOF
}

case "${1:-}" in
  --with-caddy) add_caddy_vhost ;;
  *) echo "note: Caddy vhost not touched. Run with --with-caddy for first-time setup." ;;
esac

echo "verify: curl -sI https://about.platho.app/"
