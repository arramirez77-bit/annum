#!/bin/sh
# Push the current commit through the main-branch ruleset: push to a `ci-check` branch, wait for
# CI ("secrets" + "checks"), then move main to it and delete the branch. Never bypasses the rules.
# Usage: scripts/ship.sh   (needs the GitHub CLI, signed in)
cd "$(dirname "$0")/.." || exit 1
SHA=$(git rev-parse HEAD)
git push -q origin HEAD:refs/heads/ci-check 2>&1 | grep -vE "^remote: *$|pull request|pull/new"
RUN=""
for i in $(seq 1 40); do
  RUN=$(gh run list --commit "$SHA" --workflow CI --json databaseId --jq '.[0].databaseId' 2>/dev/null)
  [ -n "$RUN" ] && break
  sleep 3
done
[ -z "$RUN" ] && { echo "No CI run found for $SHA"; exit 1; }
gh run watch "$RUN" --exit-status --interval 10 >/dev/null 2>&1; OK=$?
gh run view "$RUN" --json conclusion,url,jobs \
  --jq '"CI \(.conclusion): \(.url)\n" + ([.jobs[] | "  \(.name): \(.conclusion)"] | join("\n"))'
if [ $OK -ne 0 ]; then echo "CI didn't pass: main was NOT updated"; exit 1; fi
git push -q origin HEAD:main && echo "main → $(git rev-parse --short HEAD)"
git push -q origin --delete ci-check && echo "ci-check deleted"
git fetch -q origin --prune
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && echo "local == origin/main"
