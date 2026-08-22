#!/bin/sh
set -eu
umask 0027

command="${SSH_ORIGINAL_COMMAND:-}"

# WHICH SITE. The same receiver serves production and the stand (stage.platho.app, 2026-08-21): a command that
# begins with "stage " is the same command against /srv/platho-stage, and nothing else about it changes — same
# release-name rules, same archive checks, same ownership, same atomic switch. One receiver, two roots, so the
# stand cannot be deployed to by a different (and untested) path than production.
base=/srv/platho
case "$command" in
    stage\ *)
        base=/srv/platho-stage
        command="${command#stage }"
        ;;
esac
releases="$base/releases"
uploads="$base/.uploads"
current="$base/current"

valid_release_name() {
    case "$1" in
        release-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]-[A-Za-z0-9._-]*) return 0 ;;
        initial-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*) return 0 ;;
        *) return 1 ;;
    esac
}

deploy_release_name() {
    case "$1" in
        release-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]-[A-Za-z0-9._-]*) return 0 ;;
        *) return 1 ;;
    esac
}

switch_current() {
    target="$1"
    test -d "$target"
    test -f "$target/index.html"
    ln -sfn "$target" "$base/current.next"
    mv -Tf "$base/current.next" "$current"
}

list_releases() {
    current_target="$(readlink -f "$current" 2>/dev/null || true)"
    for d in "$releases"/initial-* "$releases"/release-*; do
        [ -d "$d" ] || continue
        name="$(basename "$d")"
        marker=""
        if [ "$(readlink -f "$d")" = "$current_target" ]; then
            marker=" *"
        fi
        printf '%s%s\n' "$name" "$marker"
    done | sort
}

rollback_release() {
    release="$1"
    if ! valid_release_name "$release"; then
        echo "invalid rollback release name" >&2
        exit 2
    fi
    target="$releases/$release"
    if [ ! -d "$target" ]; then
        echo "release not found" >&2
        exit 4
    fi
    switch_current "$target"
    printf 'rolled back to %s\n' "$release"
}

prune_releases() {
    keep="$1"
    case "$keep" in
        ''|*[!0-9]*) echo "invalid keep count" >&2; exit 2 ;;
    esac
    if [ "$keep" -lt 1 ]; then
        echo "keep count must be >= 1" >&2
        exit 2
    fi

    current_target="$(readlink -f "$current" 2>/dev/null || true)"
    kept=0
    find "$releases" -maxdepth 1 -mindepth 1 -type d -name 'release-*' -printf '%T@ %p\n' \
        | sort -rn \
        | while read -r _ d; do
            [ -d "$d" ] || continue
            if [ "$(readlink -f "$d")" = "$current_target" ]; then
                continue
            fi
            kept=$((kept + 1))
            if [ "$kept" -le "$keep" ]; then
                continue
            fi
            rm -rf -- "$d"
            printf 'pruned %s\n' "$(basename "$d")"
        done
}

deploy_release() {
    release="$1"
    if ! deploy_release_name "$release"; then
        echo "invalid release name" >&2
        exit 2
    fi

    target="$releases/$release"
    tmp="$releases/.incoming-$release-$$"
    upload="$uploads/$release-$$.tar"

    if [ -e "$target" ] || [ -e "$tmp" ] || [ -e "$upload" ]; then
        echo "release already exists" >&2
        exit 3
    fi

    mkdir -p "$uploads"
    chmod 700 "$uploads"
    cat > "$upload"
    trap 'rm -rf "$tmp" "$upload"' EXIT INT TERM

    size="$(wc -c < "$upload" | tr -d ' ')"
    if [ "$size" -le 0 ]; then
        echo "empty upload" >&2
        exit 5
    fi
    if [ "$size" -gt 134217728 ]; then
        echo "upload too large" >&2
        exit 5
    fi

    mkdir "$tmp"
    python3 - "$upload" "$tmp" <<'PY'
import os
import pathlib
import shutil
import sys
import tarfile

upload = sys.argv[1]
target = os.path.abspath(sys.argv[2])
max_entries = 10000
max_total_size = 128 * 1024 * 1024

def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(10)

def normalize(name: str):
    if not name:
        fail("empty archive member name")
    if "\\" in name or "\x00" in name:
        fail(f"unsafe archive member: {name!r}")
    pure = pathlib.PurePosixPath(name)
    if pure.is_absolute():
        fail(f"absolute archive path: {name!r}")
    parts = [part for part in pure.parts if part not in ("", ".")]
    if any(part == ".." for part in parts):
        fail(f"parent traversal archive path: {name!r}")
    return parts

with tarfile.open(upload, "r:*") as archive:
    members = archive.getmembers()
    if not members:
        fail("empty archive")
    if len(members) > max_entries:
        fail("too many archive entries")

    total_size = 0
    normalized = []
    for member in members:
        parts = normalize(member.name)
        if not parts:
            continue
        if member.issym() or member.islnk() or member.isdev() or member.isfifo():
            fail(f"unsupported archive member type: {member.name!r}")
        if not (member.isfile() or member.isdir()):
            fail(f"unsupported archive member type: {member.name!r}")
        if member.isfile():
            total_size += member.size
            if total_size > max_total_size:
                fail("archive payload too large")
        normalized.append((member, parts))

    for member, parts in normalized:
        dest = os.path.abspath(os.path.join(target, *parts))
        if dest != target and not dest.startswith(target + os.sep):
            fail(f"archive path escaped target: {member.name!r}")
        if member.isdir():
            os.makedirs(dest, exist_ok=True)
            os.chmod(dest, 0o2750)
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        src = archive.extractfile(member)
        if src is None:
            fail(f"cannot extract file: {member.name!r}")
        with src, open(dest, "wb") as out:
            shutil.copyfileobj(src, out)
        os.chmod(dest, 0o640)

index_path = os.path.join(target, "index.html")
if not os.path.isfile(index_path):
    fail("index.html missing")

for root, dirs, _files in os.walk(target):
    os.chmod(root, 0o2750)
    for directory in dirs:
        os.chmod(os.path.join(root, directory), 0o2750)
PY

    chgrp -R caddy "$tmp"
    mv "$tmp" "$target"
    switch_current "$target"
    rm -f "$upload"
    trap - EXIT INT TERM
    printf 'deployed %s\n' "$release"
}

case "$command" in
    list)
        list_releases
        ;;
    rollback\ *)
        rollback_release "${command#rollback }"
        ;;
    prune\ keep\ *)
        prune_releases "${command#prune keep }"
        ;;
    release-*)
        deploy_release "$command"
        ;;
    *)
        echo "invalid command" >&2
        exit 2
        ;;
esac
