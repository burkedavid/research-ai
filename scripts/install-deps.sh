#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm install drizzle-orm postgres next-auth@beta inngest @vercel/blob ai @ai-sdk/anthropic zod mammoth unzipper fast-xml-parser xlsx pdf-parse docx recharts d3-cloud
npm install -D drizzle-kit tsx vitest @playwright/test @types/unzipper @types/d3-cloud dotenv
echo "INSTALL_DONE"
