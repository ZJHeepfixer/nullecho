#!/usr/bin/env bash
# Prove the Chrome and Firefox store packages are unchanged by the Safari work.
#
#   safari/tools/compare-store-packages.sh              # base = origin/main, head = this working tree
#   safari/tools/compare-store-packages.sh <base-ref>
#   safari/tools/compare-store-packages.sh --self-test  # proves the check can fail
#
# WHY CONTENTS, NOT ZIP BYTES. `ext/tools/package.mjs` copies each file into a fresh staging dir,
# so every entry gets the current mtime and two runs on the SAME commit give different zip bytes
# (measured 2026-10-01: two back-to-back Chrome builds of d9a3580 hashed 2c876f71… and e3e10ee4…).
# What a store receives is the file set and each file's bytes, so that is what is compared:
# the sorted entry list and a sha256 per entry, for both targets, base vs head.
#
# Both sides are built in a temp dir, so the repo's own dist/ is never written.
set -euo pipefail

SELF_TEST=0
BASE=origin/main
for a in "$@"; do
  case "$a" in
    --self-test) SELF_TEST=1 ;;
    *) BASE="$a" ;;
  esac
done

REPO=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/base" "$TMP/head"

# base: the committed ext/ at BASE
git -C "$REPO" archive "$BASE" ext | tar -x -C "$TMP/base"
# head: the working tree's ext/, uncommitted changes included (that is what would be packaged)
rsync -a --exclude node_modules --exclude _metadata "$REPO/ext" "$TMP/head/"

if [ "$SELF_TEST" = 1 ]; then
  # Negative control: change one shipped byte on the head side. The comparison MUST report it.
  printf '\n' >> "$TMP/head/ext/src/gpc.js"
fi

fingerprint() {  # $1 = zip → "sha256  path" per entry, sorted
  local dir; dir=$(mktemp -d "$TMP/unz.XXXX")
  unzip -q "$1" -d "$dir"
  (cd "$dir" && find . -type f | LC_ALL=C sort | while read -r f; do shasum -a 256 "$f"; done)
}

status=0
for target in chrome firefox; do
  flag=""; [ "$target" = firefox ] && flag="--firefox"
  for side in base head; do
    node "$TMP/$side/ext/tools/package.mjs" $flag > "$TMP/$side-$target.log"
  done
  bz=$(ls "$TMP"/base/dist/nullecho-*-"$target".zip)
  hz=$(ls "$TMP"/head/dist/nullecho-*-"$target".zip)
  fingerprint "$bz" > "$TMP/base-$target.sha"
  fingerprint "$hz" > "$TMP/head-$target.sha"
  n=$(wc -l < "$TMP/base-$target.sha" | tr -d ' ')
  if diff -u "$TMP/base-$target.sha" "$TMP/head-$target.sha" > "$TMP/$target.diff"; then
    echo "IDENTICAL  $target: $n files, every sha256 equal ($BASE vs working tree)"
  else
    echo "DIFFERENT  $target ($BASE vs working tree):"
    cat "$TMP/$target.diff"
    status=1
  fi
done

if [ "$SELF_TEST" = 1 ]; then
  if [ "$status" = 1 ]; then echo "SELF-TEST PASS: a one-byte change to src/gpc.js was detected"; exit 0
  else echo "SELF-TEST FAIL: a planted change went unnoticed"; exit 1; fi
fi
exit "$status"
