#!/usr/bin/env bash
# End-to-end smoke test against a running stack, through the web server only.
# Usage: scripts/smoke-test.sh [base-url]   (default http://localhost:8088)
# Reads demo passwords from .env. Exits non-zero on the first failed check.
set -euo pipefail

BASE="${1:-http://localhost:8088}"
API="$BASE/api/v1"
set -a; [ -f .env ] && . ./.env; set +a
ADMIN_JAR=$(mktemp); VIEWER_JAR=$(mktemp)
trap 'rm -f "$ADMIN_JAR" "$VIEWER_JAR"' EXIT

pass() { printf '  ✓ %s\n' "$1"; }
fail() { printf '  ✗ %s\n' "$1" >&2; exit 1; }
# Print a value from JSON on stdin; prints nothing (so the check fails) if the body isn't JSON.
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)" 2>/dev/null || true; }

echo "Smoke test: $BASE"

[ "$(curl -s "$API/health" | json "d['status']+'/'+d['checks']['database']")" = "ok/up" ] \
  && pass "health: api ok, database up" || fail "health check"

headers=$(curl -sI "$BASE/customers/C0001")
grep -qi '^content-security-policy:' <<<"$headers" && grep -qi '^x-frame-options: DENY' <<<"$headers" \
  && pass "web: SPA route served with security headers" || fail "web security headers"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API/customers")
[ "$code" = 401 ] && pass "unauthenticated request rejected (401)" || fail "expected 401, got $code"

login() { curl -s -o /dev/null -w '%{http_code}' -c "$1" -X POST "$API/auth/login" \
  -H 'content-type: application/json' -d "{\"email\":\"$2\",\"password\":\"$3\"}"; }
[ "$(login "$ADMIN_JAR" admin@finpilot.test "$SEED_ADMIN_PASSWORD")" = 200 ] && pass "admin login" || fail "admin login"
[ "$(login "$VIEWER_JAR" viewer@finpilot.test "$SEED_VIEWER_PASSWORD")" = 200 ] && pass "viewer login" || fail "viewer login"

value=$(curl -s -b "$VIEWER_JAR" "$API/customers/C0026/portfolio" | json "d['totals']['marketValue']")
[ "$value" = "1953574.61" ] && pass "portfolio C0026 = 1953574.61" || fail "portfolio value was $value"

tx=$(curl -s -b "$VIEWER_JAR" "$API/customers/C0026/transactions?type=BUY&pageSize=5" | json "len(d['data'])")
[ "$tx" = 5 ] && pass "transactions filtered and paginated" || fail "transactions returned $tx rows"

upload() { curl -s -b "$1" -o /dev/stderr -w '%{http_code}' -X POST \
  "$API/admin/imports/transactions?fileName=$(basename "$2")" -H 'content-type: text/csv' --data-binary "@$2" 2>/dev/null; }
code=$(upload "$VIEWER_JAR" data/samples/transactions_with_errors.csv)
[ "$code" = 403 ] && pass "viewer cannot import (403)" || fail "viewer import returned $code"

result=$(curl -s -b "$ADMIN_JAR" -X POST "$API/admin/imports/transactions?fileName=transactions_with_errors.csv" \
  -H 'content-type: text/csv' --data-binary @data/samples/transactions_with_errors.csv)
counts=$(json "d['status']+' '+str(d['acceptedRows'])+'/'+str(d['rejectedRows'])" <<<"$result")
case "$counts" in
  "IMPORTED 4/13"|"ALREADY_IMPORTED 4/13") pass "import: $counts (accepted/rejected)" ;;
  *) fail "import returned $counts" ;;
esac

again=$(curl -s -b "$ADMIN_JAR" -X POST "$API/admin/imports/transactions?fileName=again.csv" \
  -H 'content-type: text/csv' --data-binary @data/samples/transactions_with_errors.csv | json "d['status']")
[ "$again" = ALREADY_IMPORTED ] && pass "re-import is a no-op (ALREADY_IMPORTED)" || fail "re-import returned $again"

echo "All smoke checks passed."
