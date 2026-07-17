#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# B10.6 clean-database verification: wipe dev DB, apply migrations, seed.
docker exec research-ai-db psql -U postgres -d sentiment_hub -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;"
npx drizzle-kit migrate
npm run db:seed
echo "CLEAN_DB_VERIFIED"
