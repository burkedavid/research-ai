#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# page containers: fixed p-8 -> responsive padding
grep -rl 'className="p-8"' "app/(app)" | while read -r f; do
  sed -i 's/className="p-8"/className="p-4 sm:p-6 lg:p-8"/g' "$f"
  echo "padded: $f"
done
# quotes shortlist rail: full-width on mobile
if grep -q 'className="w-72 shrink-0"' "app/(app)/quotes/quotes-client.tsx"; then
  sed -i 's/className="w-72 shrink-0"/className="w-full lg:w-72 lg:shrink-0"/' "app/(app)/quotes/quotes-client.tsx"
  echo "shortlist rail fixed"
fi
echo "RESPONSIVE_DONE"
