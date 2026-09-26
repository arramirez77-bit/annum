#!/bin/sh
# Bank-file import flows on an iOS Simulator. The iOS file picker is outside the app, where
# Maestro can't reach, so this copies the fictional files in fixtures/bank-files into Annum's
# Documents folder and the flows open them the way "Open in Annum" does.
# Usage: scripts/maestro-files.sh <simulator-udid>   (Metro on :8082, development build installed)
SIM=${1:?Usage: scripts/maestro-files.sh <simulator-udid>}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DATA=$(xcrun simctl get_app_container "$SIM" com.highdesert.annum data) || exit 1
mkdir -p "$DATA/Documents/test-bank-files"
cp "$ROOT"/fixtures/bank-files/* "$DATA/Documents/test-bank-files/"
# The folder as a URL-encoded file:// prefix, for annum://import?file=…
BANK=$(python3 -c "import sys, urllib.parse; print(urllib.parse.quote('file://' + sys.argv[1] + '/', safe=''))" "$DATA/Documents/test-bank-files")
maestro --device "$SIM" test -e BANK="$BANK" "$ROOT/maestro/files/"
