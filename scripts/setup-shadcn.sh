#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes shadcn@latest init --yes --defaults --force
npx --yes shadcn@latest add --yes button card input select textarea badge table tabs label checkbox alert
echo "SHADCN_DONE"
