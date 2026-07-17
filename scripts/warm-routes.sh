#!/usr/bin/env bash
set -uo pipefail
# pre-compile dev-server routes so the screenshot tour doesn't hit cold-start timeouts
for route in /login / /ask /quotes /library /segments /compare /reports /help /admin; do
  curl -s -o /dev/null -m 120 "http://localhost:3000${route}"
  echo "warmed ${route}"
done
echo "WARM_DONE"
