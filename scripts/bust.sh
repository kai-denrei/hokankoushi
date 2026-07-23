#!/usr/bin/env bash
# Cache-bust runner for the single-file app.
#
# Bumps the <meta name="cb"> token in index.html. On reload the About modal's build
# glyphs + the favicon regenerate from the new token (see renderBuild() in index.html),
# so a human can confirm at a glance that a fresh build reached the browser:
#   glyphs/favicon changed → the bust worked.
#   same glyphs after reload → the cache is still stale upstream (check Cache-Control;
#                              see CACHING.md).
#
# Run it after editing index.html (or wire into a post-commit hook / CI step).
# There are NO same-origin sub-assets to fingerprint — index.html is the whole app;
# Three.js / Tweakpane load from external CDNs (their caches aren't ours to bust).

set -euo pipefail
cd "$(dirname "$0")/.."
FILE="index.html"

# Fresh 32-bit token (portable: od is POSIX).
TOKEN=$(od -An -N4 -tx1 < /dev/urandom | tr -d ' \n')

# Rewrite the meta tag content in place (BSD/macOS + GNU compatible).
sed -i.cbbak -E "s/(<meta[[:space:]]+name=\"cb\"[[:space:]]+content=\")[^\"]*(\")/\1${TOKEN}\2/" "$FILE"
rm -f "${FILE}.cbbak"

echo "cache-bust token → ${TOKEN}"
echo "reload the page; the About-modal glyphs + tab favicon should change."
