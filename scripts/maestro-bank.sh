#!/bin/sh
# Bank connection flows (M7) on an iOS Simulator, against the deployed Worker in Plaid Sandbox.
# Pairs the Simulator first with a NEW access key (npm run worker:rotate-key), so any phone
# paired before must scan the new code afterwards: pass --qr to also show the code for them.
# Usage: scripts/maestro-bank.sh <simulator-udid> [--qr]   (Metro on :8082, development build)
SIM=${1:?Usage: scripts/maestro-bank.sh <simulator-udid> [--qr]}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home}"
xcrun simctl spawn "$SIM" defaults write com.highdesert.annum EXDevMenuShowFloatingActionButton -bool NO
xcrun simctl spawn "$SIM" defaults write com.highdesert.annum EXDevMenuIsOnboardingFinished -bool YES

QR=--no-qr
[ "$2" = "--qr" ] && QR=
maestro --device "$SIM" test "$ROOT/maestro/bank/open-app.yaml" || exit 1
# Annum stays open: a development build's launcher catches links that start the app, so
# pairing from a closed app is checked on the iPhone with a TestFlight build instead.
node "$ROOT/worker/scripts/rotate-key.mjs" --simulator "$SIM" $QR || exit 1
for flow in 0-pair 1-connect-during-setup 2-settings-and-reconnect 3-delete-warns; do
  maestro --device "$SIM" test "$ROOT/maestro/bank/$flow.yaml" || exit 1
done
echo "Bank flows passed."
