#!/bin/sh
# Run Maestro flows on an iOS Simulator (Metro on :8082, development build installed).
# Usage: SIM=<simulator-udid> scripts/maestro.sh maestro/            (all flows)
#        SIM=<simulator-udid> scripts/maestro.sh maestro/review.yaml (one flow)
# Screenshots go to Maestro's own folder (~/.maestro/tests), never into this repo.
: "${SIM:?Set SIM to the simulator UDID (xcrun simctl list devices booted)}"
export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home}"
# Hide the dev build's floating "Tools" button (it covers the header) and skip the dev menu intro.
xcrun simctl spawn "$SIM" defaults write com.highdesert.annum EXDevMenuShowFloatingActionButton -bool NO
xcrun simctl spawn "$SIM" defaults write com.highdesert.annum EXDevMenuIsOnboardingFinished -bool YES
cd "$(dirname "$0")/.." && maestro --device "$SIM" test "$@"
