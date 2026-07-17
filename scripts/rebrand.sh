#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# primary action colors: near-black slate -> Sentiment Research navy
files=$(grep -rl "bg-slate-900" app components)
for f in $files; do
  sed -i 's/bg-slate-900/bg-brand-800/g; s/hover:bg-slate-700/hover:bg-brand-700/g' "$f"
done
echo "REBRAND_DONE"
grep -rn "bg-slate-900" app components || true
