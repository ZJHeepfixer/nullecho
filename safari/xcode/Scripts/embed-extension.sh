#!/bin/sh
# Xcode build phase for both "Nullecho Extension" targets.
#
# 1. Runs the repo's Safari extension build (safari/tools/build-extension.mjs), which (re)creates
#    dist/safari/extension/ with manifest.json at its root. dist/ is gitignored: the extension is
#    built from ext/ on every build, never checked in twice.
# 2. Copies that folder's CONTENTS into the extension bundle's resources root, which is where
#    Safari expects manifest.json. (An Xcode folder reference would nest the folder itself, and
#    per-file references would silently miss anything added later.)
#
# Fails loudly when node or the build script is missing: a fresh clone must either build or say why.
set -eu

REPO="$SRCROOT/../.."
BUILD_SCRIPT="$REPO/safari/tools/build-extension.mjs"
SOURCE_DIR="$REPO/dist/safari/extension"
DEST_DIR="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"

fail() {
  echo "error: [Nullecho] $1" >&2
  exit 1
}

[ -f "$BUILD_SCRIPT" ] || fail "missing $BUILD_SCRIPT. The Safari extension build script is part of the repo; nothing to embed."

# Xcode's script environment has a minimal PATH. Honour an explicit NODE_BINARY, then PATH, then
# the usual install locations (Homebrew, nvm, volta, fnm, ~/.local), newest nvm version first.
find_node() {
  if [ -n "${NODE_BINARY:-}" ] && [ -x "$NODE_BINARY" ]; then echo "$NODE_BINARY"; return 0; fi
  if command -v node >/dev/null 2>&1; then command -v node; return 0; fi
  for candidate in \
      "$HOME/.local/bin/node" \
      /opt/homebrew/bin/node \
      /usr/local/bin/node \
      "$HOME/.volta/bin/node" \
      "$HOME/.fnm/aliases/default/bin/node" \
      "$HOME/Library/Application Support/fnm/aliases/default/bin/node"; do
    if [ -x "$candidate" ]; then echo "$candidate"; return 0; fi
  done
  if [ -d "$HOME/.nvm/versions/node" ]; then
    newest=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)
    if [ -n "$newest" ] && [ -x "$HOME/.nvm/versions/node/$newest/bin/node" ]; then
      echo "$HOME/.nvm/versions/node/$newest/bin/node"; return 0
    fi
  fi
  return 1
}

NODE=$(find_node) || fail "node not found. Install Node.js (https://nodejs.org) or set NODE_BINARY=/path/to/node in the build environment."
echo "[Nullecho] node: $NODE ($("$NODE" --version))"

echo "[Nullecho] building Safari extension: $BUILD_SCRIPT"
(cd "$REPO" && "$NODE" "$BUILD_SCRIPT") || fail "build-extension.mjs failed (see output above)."

[ -f "$SOURCE_DIR/manifest.json" ] || fail "build-extension.mjs ran but $SOURCE_DIR/manifest.json does not exist."

mkdir -p "$DEST_DIR"
# Copy contents, not the folder. ditto preserves nothing that matters here and merges into DEST_DIR.
/usr/bin/ditto "$SOURCE_DIR" "$DEST_DIR"

[ -f "$DEST_DIR/manifest.json" ] || fail "manifest.json did not land at the extension's resources root ($DEST_DIR)."
echo "[Nullecho] embedded $(find "$SOURCE_DIR" -type f | wc -l | tr -d ' ') extension files into $UNLOCALIZED_RESOURCES_FOLDER_PATH"
