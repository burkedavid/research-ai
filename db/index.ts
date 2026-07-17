import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// postgres.js works against both local Docker Postgres and Neon (§B3).
// max 1 in serverless contexts is handled by Neon's pooler URL in production.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: env.NODE_ENV === "production" ? 1 : 10,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
