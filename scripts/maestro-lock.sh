#!/bin/sh
# Face ID lock flows on an iOS Simulator. Maestro can't answer Face ID, so this enrolls Face ID
# in the Simulator and keeps presenting a matching (or non-matching) face while each flow runs.
# Usage: scripts/maestro-lock.sh <simulator-udid>   (Metro on :8082, development build installed)
SIM=${1:?Usage: scripts/maestro-lock.sh <simulator-udid>}
DIR=$(cd "$(dirname "$0")/.." && pwd)/maestro/lock

xcrun simctl spawn "$SIM" notifyutil -s com.apple.BiometricKit.enrollmentChanged 1
xcrun simctl spawn "$SIM" notifyutil -p com.apple.BiometricKit.enrollmentChanged

FACE_PID=
stop_face() { [ -n "$FACE_PID" ] && kill "$FACE_PID" 2>/dev/null; FACE_PID=; }
trap stop_face EXIT INT TERM

run() { # run match|nomatch flow.yaml
  stop_face
  (while :; do
    xcrun simctl spawn "$SIM" notifyutil -p "com.apple.BiometricKit_Sim.pearl.$1" >/dev/null 2>&1
    sleep 1
  done) &
  FACE_PID=$!
  maestro --device "$SIM" test "$DIR/$2" || exit 1
}

run match 1-turn-on.yaml
run nomatch 2-not-recognized.yaml
run match 3-leave-with-a-sheet-open.yaml
run nomatch 4-relocked.yaml
run match 5-unlock-and-turn-off.yaml
echo "Lock flows passed."
