#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# npm's xlsx is frozen at 0.18.5 with unfixed advisories (GHSA-4r6h-8v6p-xvw6,
# GHSA-5pgg-2g8v-p4x9); SheetJS distributes the fixed 0.20.x from its own CDN.
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm audit --audit-level=high
echo "XLSX_UPDATE_DONE"
