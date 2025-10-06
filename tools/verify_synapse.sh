#!/usr/bin/env bash
set -euo pipefail
HOST="${1:-http://127.0.0.1:3000}"
SID=$(curl -s -X POST "$HOST/api/synapse/session" -H 'Content-Type: application/json' -d '{"prompt":"test prompt for CRE"}' | jq -r .sid)
[ "$SID" = "null" ] && { echo "session failed"; exit 2; }
echo "[ok] sid: $SID"
curl -s -N "$HOST/api/synapse/stream?sid=$SID" --max-time 5 | head -n 5
echo "[ok] stream head printed"
