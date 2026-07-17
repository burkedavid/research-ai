#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
files=(
  "app/(app)/compare/compare-client.tsx"
  "app/(app)/reports/reports-client.tsx"
  "app/(app)/segments/page.tsx"
  "app/(app)/library/page.tsx"
  "app/(app)/help/page.tsx"
  "app/(app)/admin/admin-client.tsx"
)
for f in "${files[@]}"; do
  if ! grep -q 'import { PageHeader }' "$f"; then
    # insert after the last import line
    line=$(grep -n '^import ' "$f" | tail -1 | cut -d: -f1)
    sed -i "${line}a import { PageHeader } from \"@/components/page-header\";" "$f"
    echo "added: $f"
  fi
done
echo "IMPORTS_DONE"
