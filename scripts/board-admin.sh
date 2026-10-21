#!/usr/bin/env bash
# Look after the public board from this PC (uses the Cloudflare login wrangler already has; no keys needed).
#   scripts/board-admin.sh list [season]        the top 50 for a season (or every season), hidden ones marked
#   scripts/board-admin.sh hide "<nickname>"    take a name off the board (every season it's on)
#   scripts/board-admin.sh unhide "<nickname>"  put it back
#   scripts/board-admin.sh clear-all            launch day: delete every score (test scores from the beta)
set -e
cd "$(dirname "$0")/../server"
q() { npx wrangler d1 execute earthworx-board --remote --command "$1"; }
esc() { printf '%s' "$1" | sed "s/'/''/g"; }
case "$1" in
  list)
    if [ -n "$2" ]; then q "SELECT season, name, co, score, week, v, hidden FROM scores WHERE season = '$(esc "$2")' ORDER BY score DESC LIMIT 50"
    else q "SELECT season, name, co, score, week, v, hidden FROM scores ORDER BY season, score DESC LIMIT 200"; fi ;;
  hide)   q "UPDATE scores SET hidden = 1 WHERE name = '$(esc "$2")'"; ;;
  unhide) q "UPDATE scores SET hidden = 0 WHERE name = '$(esc "$2")'"; ;;
  clear-all)
    read -r -p "Delete EVERY score on the board? Type yes: " ok
    [ "$ok" = "yes" ] && q "DELETE FROM scores" || echo "Left alone." ;;
  *) sed -n 2,7p "$0" ;;
esac
