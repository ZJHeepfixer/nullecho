#!/bin/sh
# Runs the tip-jar tests on an iOS Simulator without signing, money or an Apple account.
#
#   sh safari/xcode/Scripts/test-tipjar.sh "<simulator name or udid>" [screenshot dir]
#
# Why the priming run: `xcodebuild test` does not push the scheme's StoreKit configuration into the
# Simulator; the SKTestSession inside the tests does, and the Simulator's StoreKit daemon then keeps it for
# the app's bundle id. The app's own StoreKit client is created at launch, before any test runs, so on a
# freshly created or erased Simulator the first test process still talks to the sandbox App Store and
# every product load fails. A short first run plants the configuration; the real runs follow.
# Measured on the iOS 27 Simulator (24A434), Xcode 27.0; see safari/VERIFY-TIP-JAR.md.

set -e
DEVICE="${1:?simulator name or udid}"
SHOTS="${2:-/tmp/nullecho-tipjar-shots}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DD="${NULLECHO_DD:-/tmp/nullecho-dd}"
case "$DEVICE" in
  *-*-*-*-*) DEST="platform=iOS Simulator,id=$DEVICE" ;;
  *) DEST="platform=iOS Simulator,name=$DEVICE" ;;
esac
run() {
  xcodebuild test -project "$HERE/Nullecho.xcodeproj" -scheme "Nullecho (iOS)" -destination "$DEST" \
    -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO "$@"
}

echo "== priming run (plants the StoreKit configuration; its result does not count)"
run -only-testing:"Nullecho Tests (iOS)/TipJarTests/testModelHoldsOnlyTransientState" >/dev/null 2>&1 || true

echo "== unit tests"
run -only-testing:"Nullecho Tests (iOS)" | grep -E "Test Case|TIPJAR|Executed|\*\* TEST|error:" | grep -v "export "

echo "== UI flow (screenshots in $SHOTS)"
mkdir -p "$SHOTS"
run -only-testing:"Nullecho UI Tests (iOS)" TEST_RUNNER_NE_SHOT_DIR="$SHOTS" TEST_RUNNER_NE_SHOT_PREFIX="${NE_SHOT_PREFIX:-tipjar}" \
  | grep -E "Test Case|TIPJAR|Executed|\*\* TEST|error:" | grep -v "export "
