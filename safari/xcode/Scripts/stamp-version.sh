#!/bin/sh
# Xcode build phase, last in all four targets.
#
# The extension's manifest.json is the only place a Nullecho version is written by hand. This phase
# copies that version into the built bundle's CFBundleShortVersionString, so the App Store version
# always equals the extension version and nobody keeps a second number in sync. MARKETING_VERSION
# in the project is a deliberate sentinel (0.0.0): if you ever see it in a built app, this phase
# did not run.
set -eu

REPO="$SRCROOT/../.."
MANIFEST="$REPO/dist/safari/extension/manifest.json"
PLIST="$TARGET_BUILD_DIR/$INFOPLIST_PATH"

fail() {
  echo "error: [Nullecho] $1" >&2
  exit 1
}

[ -f "$MANIFEST" ] || fail "$MANIFEST not found; the extension build phase should have produced it."
[ -f "$PLIST" ] || fail "processed Info.plist not found at $PLIST; this phase must run after Info.plist processing."

VERSION=$(/usr/bin/plutil -extract version raw -o - "$MANIFEST" 2>/dev/null) || fail "could not read \"version\" from $MANIFEST"
case "$VERSION" in
  ''|*[!0-9.]*) fail "manifest version \"$VERSION\" is not of the form N.N.N that App Store Connect accepts." ;;
esac

/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$PLIST" \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string $VERSION" "$PLIST" \
  || fail "could not write CFBundleShortVersionString into $PLIST"

READBACK=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST")
[ "$READBACK" = "$VERSION" ] || fail "stamp verification failed: wrote $VERSION, read back $READBACK"
echo "[Nullecho] $PRODUCT_NAME CFBundleShortVersionString = $VERSION (from extension manifest)"
