import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * postgres.js over TCP, against local Docker Postgres or Neon's pooled
 * endpoint. Co-located with the DB region on Vercel (see vercel.json:
 * lhr1 = Neon eu-west-2), so the connection is same-city and fast.
 *
 * Note: the Neon HTTP driver (drizzle-orm/neon-http) was evaluated for faster
 * cold starts, but it returns db.execute() raw-SQL results as { rows } rather
 * than a plain array, which the retrieval layer and services depend on — so
 * postgres.js is kept as the single driver for both environments.
 */
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: env.NODE_ENV === "production" ? 1 : 10,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
