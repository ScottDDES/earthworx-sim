#!/usr/bin/env bash
# Makes saves with an older build's own engine, for test/oldSaves.test.ts.
# Usage (from sim-engine): scripts/make-saves.sh <commit> [<commit> ...]
# Run it for each build that goes out to players, then commit the new files in test/saves.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for C in "$@"; do
  WT="$(mktemp -d)/wt-$C"
  git -C "$ROOT" worktree add -f "$WT" "$C" >/dev/null
  if command -v cygpath >/dev/null; then cmd //c "mklink /J $(cygpath -w "$WT/node_modules") $(cygpath -w "$ROOT/node_modules")" >/dev/null
  else ln -s "$ROOT/node_modules" "$WT/node_modules"; fi
  cp "$ROOT/test/saveBot.ts" "$WT/test/"
  cp "$ROOT/scripts/make-saves.gen.ts" "$WT/test/make-saves.test.ts"
  (cd "$WT" && SAVES_OUT="$ROOT/test/saves" SAVES_TAG="$C" npx vitest run test/make-saves.test.ts)
  git -C "$ROOT" worktree remove --force "$WT"
done
